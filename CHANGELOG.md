# Changelog

All notable changes to this project. Evidence tag: SYNTHETIC (everything here runs on generated data).

## Unreleased

## 0.1.0 — 2026-10-03

### Added
- `Address.html`: self-contained educational page (French UI, no external resources). Phase address `E = (saison, quart, cycle, bloc)`, five concentric SVG rings, sliders (amplitude, bloc 0–15, cycle 0–23, quart), « Lancer la rafale » (deterministic seeded burst, 16 block scores, lit blocks), « Effacer la date » (date wiped, address kept), four preloaded memories (three recur, one does not), a NaN rejection demo and an in-page self-test panel.
- Score contract: 512 = 16 × 32, `S = 0.45·max|x| + 0.35·RMS + 0.20·mean|x|`, lit if `S ≥ 0.50`, fixed threshold, non-finite values rejected.
- `tests/run_tests.js`: Node tests that execute the page's single `<script id="core">` block (no second copy), with an independent reference formula, memory statuses and self-containment checks.
- `tests/forbidden_terms.py`: repository-wide banned-terms scan.
- GitHub Actions CI (Node 20 / 22 / 24), `CITATION.cff`, `.zenodo.json`, AGPL-3.0-only `LICENSE`, `COMMERCIAL-LICENSE.md`, `SECURITY.md`.
