#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Tests for Address.html. The score logic lives in ONE place: the <script id="core"> block of
// Address.html. This runner extracts that block and executes it in a fresh VM context, so the
// page and the tests can never diverge. An independent reference formula (written here from the
// contract, not copied) cross-checks every block score.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HTML_PATH = path.join(__dirname, "..", "Address.html");
const html = fs.readFileSync(HTML_PATH, "utf8");

let failures = 0, passes = 0;
function check(name, cond, info) {
  if (cond) { passes++; console.log("PASS " + name + (info ? "  (" + info + ")" : "")); }
  else { failures++; console.log("FAIL " + name + (info ? "  (" + info + ")" : "")); }
}

// ---- 1. Extract the single core block -------------------------------------------------------
const coreBlocks = [...html.matchAll(/<script id="core">([\s\S]*?)<\/script>/g)];
check("Address.html contains exactly one <script id=\"core\"> block", coreBlocks.length === 1, "found " + coreBlocks.length);
if (coreBlocks.length !== 1) process.exit(1);
const coreSrc = coreBlocks[0][1];
const sandbox = { module: { exports: {} } };
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox, { filename: "Address.html#core" });
const core = sandbox.module.exports;

// The UI script must call the core, not re-implement the score.
const otherScripts = [...html.matchAll(/<script(?! id="core")[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
check("UI script does not redefine blockScore/scoreFrame/THRESHOLD",
  !/function\s+(blockScore|scoreFrame)\b|\bTHRESHOLD\s*=/.test(otherScripts));
check("UI script uses scoreFrame from the core", /scoreFrame\(/.test(otherScripts));

// ---- 2. Contract constants --------------------------------------------------------------------
check("THRESHOLD === 0.50", core.THRESHOLD === 0.5, String(core.THRESHOLD));
check("512 = 16 x 32", core.FRAME_LEN === 512 && core.N_BLOCKS === 16 && core.BLOCK_LEN === 32);
check("weights 0.45 / 0.35 / 0.20 appear in the core", /W_MAX = 0\.45, W_RMS = 0\.35, W_MEAN = 0\.20/.test(coreSrc));

// ---- 3. In-page self-test (the same function the page displays) -------------------------------
const st = core.selfTest();
st.forEach(r => check("selfTest: " + r.name, r.ok, r.info));

// ---- 4. Independent reference formula ---------------------------------------------------------
function refScore(x) {
  const n = x.length;
  const peak = Math.max(...x.map(Math.abs));
  const rms = Math.sqrt(x.reduce((s, v) => s + v * v, 0) / n);
  const mean = x.reduce((s, v) => s + Math.abs(v), 0) / n;
  return 0.45 * peak + 0.35 * rms + 0.20 * mean;
}
let maxDiff = 0, frames = 0;
for (const quart of [0, 1, 2]) for (const cycle of [0, 2, 14, 23]) for (const block of [0, 3, 7, 15]) for (const amp of [0.2, 0.3, 0.5, 1.0, 1.15, 2.2]) {
  const x = core.makeBurst(block, amp, core.seedOf(block, cycle, quart, amp));
  const r = core.scoreFrame(x);
  for (let b = 0; b < 16; b++) {
    const ref = refScore(x.slice(b * 32, b * 32 + 32));
    maxDiff = Math.max(maxDiff, Math.abs(ref - r.scores[b]));
    if (r.lit[b] !== (r.scores[b] >= 0.5)) maxDiff = Infinity;
  }
  frames++;
}
check("core scores match the reference formula on " + frames + " synthetic frames", maxDiff < 1e-12, "max |diff| = " + maxDiff);

// Noise-only blocks never light; threshold boundary is inclusive.
const quiet = core.scoreFrame(core.makeBurst(7, 1.15, core.seedOf(7, 14, 2, 1.15)));
check("noise-only blocks stay below 0.50", quiet.scores.every((s, i) => i === 7 || s < 0.5));
const justBelow = new Array(512).fill(0); for (let i = 0; i < 32; i++) justBelow[i] = 0.4999;
check("constant 0.4999 block does not light", core.scoreFrame(justBelow).lit[0] === false);

// Non-finite and wrong-length inputs are rejected.
for (const bad of [NaN, Infinity, -Infinity, "1", null, undefined]) {
  const f = new Array(512).fill(0); f[200] = bad;
  let rejected = false; try { core.scoreFrame(f); } catch (e) { rejected = !!e && e.name === "RangeError"; }
  check("value " + String(bad) + " rejected", rejected);
}
let lenRejected = false; try { core.scoreFrame(new Array(511).fill(0)); } catch (e) { lenRejected = true; }
check("frame of 511 values rejected", lenRejected);

// ---- 5. Memories: three recur, one does not ---------------------------------------------------
const memSrc = html.match(/const MEMORIES = \[([\s\S]*?)\]\.map/);
check("MEMORIES table found in Address.html", !!memSrc);
const mems = vm.runInNewContext("[" + memSrc[1] + "]");
const QUARTS = ["jour", "soir", "nuit"];
const status = mems.map(m => {
  const r = core.scoreFrame(core.makeBurst(m.bloc, m.amp, core.seedOf(m.bloc, m.cycle, QUARTS.indexOf(m.quart), m.amp)));
  return { m, S: r.scores[m.bloc], lit: r.lit[m.bloc] };
});
check("four preloaded memories", mems.length === 4);
const recur = status.filter(s => s.m.quart === "nuit" && s.m.cycle === 14 && s.m.bloc === 7);
check("three memories at nuit/14/7 recur (S >= 0.50, expected 'revient')",
  recur.length === 3 && recur.every(s => s.lit && s.m.attendu === "revient"), recur.map(s => s.S.toFixed(3)).join(", "));
const odd = status.find(s => s.m.quart === "jour" && s.m.cycle === 2 && s.m.bloc === 3);
check("memory at jour/2/3 does not recur (S < 0.50, expected 'ne revient pas')",
  !!odd && !odd.lit && odd.m.attendu === "ne revient pas", odd ? odd.S.toFixed(3) : "missing");

// ---- 6. Page content and self-containment -----------------------------------------------------
check("banner text present", html.includes("Synthétique — pas un détecteur de terrain, pas une preuve NASA."));
check("'pas un produit certifié' present", html.includes("Prototype éducatif, pas un produit certifié."));
check("'Le quantique n’entre pas dans le score.' present", html.includes("Le quantique n’entre pas dans le score."));
const urls = (html.match(/https?:\/\/[^\s"'<>)]+/g) || []).filter(u => u !== "http://www.w3.org/2000/svg");
check("no external URL (only the SVG namespace string)", urls.length === 0, urls.join(" "));
check("no <link>, @import, src= or fetch()", !/<link\b|@import|\bsrc\s*=|fetch\(|XMLHttpRequest/.test(html));
check("no Math.random (deterministic)", !/Math\.random/.test(html));

console.log("\n" + passes + " passed, " + failures + " failed");
process.exit(failures ? 1 : 0);
