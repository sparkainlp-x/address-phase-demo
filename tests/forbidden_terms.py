#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Fail if a banned term appears anywhere in the repository text files.

Some terms are allowed only inside an explicit negation (allowed phrases). A line passes if,
after removing every allowed phrase, no banned pattern matches. LICENSE (the verbatim AGPL
text) and this file (which must list the patterns) are excluded.
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXCLUDE = {"LICENSE", "tests/forbidden_terms.py"}
APOS = "['’]"

ALLOWED = [
    rf"le quantique n{APOS}entre pas dans le score",
    r"no quantum component enters the score",
    r"pas une subvention",
    r"not a grant",
    r"pas un produit certifié",
    r"not a certified product",
]
BANNED = [
    r"quantique", r"quantum", r"\bQEC\b",
    r"conscien", r"gravit[ée]", r"gravity",
    r"m[ée]dic", r"\bsoins?\b", r"health ?care",
    r"fondation", r"foundation", r"ch[eè]que", r"\bcheck payable",
    r"subvention", r"\bgrant", r"\bbourse", r"financement", r"funding",
    r"produit certifi", r"certified product",
    r"(bat|battu|surpass|d[ée]pass|beat|outperform|meilleur que|better than|sup[ée]rieur).{0,60}(NASA|SMAP|MSL)",
    r"(NASA|SMAP|MSL).{0,60}(battu|surpass|beaten|outperformed)",
]
allowed_re = [re.compile(p, re.I) for p in ALLOWED]
banned_re = [re.compile(p, re.I) for p in BANNED]

proc = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True)
files = proc.stdout.splitlines() if proc.returncode == 0 else []
if not files:  # not yet committed: scan the working tree
    files = [str(p.relative_to(ROOT)) for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts]
hits = 0
for rel in sorted(files):
    if rel in EXCLUDE:
        continue
    p = ROOT / rel
    try:
        text = p.read_text(encoding="utf-8")
    except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
        continue  # binary (PNG) or missing
    for n, line in enumerate(text.splitlines(), 1):
        cleaned = line
        for a in allowed_re:
            cleaned = a.sub(" ", cleaned)
        for b in banned_re:
            m = b.search(cleaned)
            if m:
                hits += 1
                print(f"{rel}:{n}: banned pattern {b.pattern!r} -> {m.group(0)!r}")
print(f"forbidden-terms scan: {hits} hit(s) in {len(files)} tracked file(s)")
sys.exit(1 if hits else 0)
