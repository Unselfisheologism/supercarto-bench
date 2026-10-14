# supercarto-bench

Benchmark fixtures, harness, and raw runs comparing **map-data representations
for LLM agents**: a compiled topological graph vs raw GeoJSON vs no map.

This repo exists separately from the tool it measures
([supercarto](https://github.com/Unselfisheologism/supercarto)) on purpose:
a benchmark should be runnable without the system under test, versioned on its
own, and open for rival frameworks to run. It tests the released `supercarto`
npm package (see `package.json`), not local source.

## Current headline (both official free models)

| | supercarto | geojson | none |
|---|---|---|---|
| omission / nearest / connectivity | 9/9 | ~4/9 | 0/9 |
| expansion (footprint m²) | 5/6 | 3/9 | 0/9 |
| heat (peak value + location) | 6/6 | 0/6 | 0/6 |
| diff (previous map + changes) | 5/5 answered | 4/4 | 0/6 |

`route` / `turns` are unmeasurable: the reference router returns impossible
distances. Saying so is part of the result.

## Run it

```bash
npm ci

# Representation comparison, 1 task x 3 arms x 3 seeds (set --model, --seeds)
npx tsx scripts/run-free-ladder.ts \
  --only "synthetic-pacific/omission-awareness,synthetic-pacific/nearest-poi,synthetic-pacific/connectivity" \
  --model opencode/muse-spark-1.3-contributor-free \
  --seeds 3 --budget 30 --out .bench/my-run --report .bench/my-run.json

# Re-score any archive with current code, spending no model calls
npx tsx scripts/report-free-ladder.ts --out bench-results --report recheck.json
```

Rules: `--budget` caps calls; resume reuses rows by key and refuses
prompt-hash mismatches (fresh `--out` after prompt changes); free-model runs
need the `opencode` CLI with a model that serves.

## Layout

- `src/bench/` — task builders, runner, scorers, rescore, drivers, archiving
- `scripts/` — ladder driver, report, fixture capture/generation/checks
- `fixtures/bench/` — frozen fixtures + `ATTRIBUTION.md` (per-file licences)
- `bench-results/` — raw archives (prompts, answers, tokens) + scored reports
- `docs/` — `benchmark.md` (protocol), `datasheet.md` (13-section datasheet),
  `benchmark-sop.txt` (methodology checklist)
- `croissant.json` — dataset metadata (DOI minted separately, see Zenodo)

## Honest limits

No seed control on the free path (repeats are uncontrolled draws, not
samples), token counts are `chars/4` estimates (ratios only), two models
tested. All stated in `docs/datasheet.md` §11/§13 alongside everything else
that would embarrass us if a reviewer found it first.

## Licence

Code and synthetic fixtures: Apache-2.0. City extracts: ODbL 1.0,
© OpenStreetMap contributors. Details in `fixtures/bench/ATTRIBUTION.md`.
