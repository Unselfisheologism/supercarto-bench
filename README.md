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

`route` was demoted, not hidden. The reference router returns impossible
distances and calls them success, so turn-by-turn rows had no trustworthy
truth; the `route` tool in the package is now an explicit **feasibility**
answer (straight-line distance, compass direction, then verify the approach
on arrival), and the ladder measures exactly that promise with a
`feasibility` task whose ground truth is the question's own geometry -
no router in the loop at all.

The living aggregation lives in [`bench-results/certificate.md`](bench-results/certificate.md)
(scoreC per arm, with provenance and a no-model-calls verify command) and
[`bench-results/leaderboard.md`](bench-results/leaderboard.md) (per model and
arm). Regenerate both from the committed archives with `npm run certificate`
and `npm run leaderboard`.

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

## Run a rival tool

Adapter arms are how another map tool or representation joins the
comparison — same tasks, same model, same prompt template, same pass rules,
same archive. The adapter builds its own context: it gets the raw features
and the task, and never supercarto's compiled output, so the contest is
between representations, not between summarisers.

```js
// my-tool.mjs — export a default { name, prepare } module
export default {
  name: 'my-tool',
  description: 'My map representation',
  async prepare({ task, budget, features }) {
    return { text: renderMyTool(features, budget) }; // what the model sees
  },
};
```

```bash
npx tsx scripts/run-free-ladder.ts --adapter ./my-tool.mjs \
  --only "synthetic-pacific/omission-awareness" --seeds 3
```

`--adapter` is repeatable (more than one rival per run), and adapter arms
appear in the report, on the leaderboard, and in the certificate as their
own column. Default is one pass at the largest budget; add
`--sweep-adapters` to run the full budget sweep a rival's own fitting
claims to need. A malformed module fails before the first model call.

## Certificate and leaderboard

```bash
# scoreC from every archived run: integers like "9/9 vs 4/9 vs 0/9",
# with sha256 provenance and a re-derive recipe, no model calls needed
npx tsx scripts/certificate.ts bench-results/*.report.json

# aggregate every archived run into the per-(model, arm) table
npx tsx scripts/leaderboard.ts
```

Both write into `bench-results/` (`certificate.md`/`.json`,
`leaderboard.md`/`.json`) and are regenerated with one command each; the
committed files are mirrors of the committed archives. Cite the
certificate's one-line score, verify against the archives by re-running it.

## Keep it alive

A leaderboard is a screenshot the day nobody runs it. One free model, one
real-city area, every arm, one seed, once a week:

```bash
bash scripts/weekly.sh
```

It runs the ladder (`glm-5.3-flash-free`, `sf-cbd`: connectivity, nearest,
feasibility), regenerates both mirrors, commits the raw archives and pushes.
A model that stops serving is recorded in `driver/opencode.ts`, not swapped
out — the list is an audit, not a population.

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
