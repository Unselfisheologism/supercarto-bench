# supercarto bench — leaderboard

Aggregated 2026-10-18T09:31:05.394Z from the archives under `bench-results/`.

## scoreC across every run — solved/scorable per arm

- geojson: **15/44**
- none: **0/47**
- supercarto: **38/47**

## Per model and arm

| model | arm | score | rate | median tokens | runs |
| --- | --- | --- | --- | --- | --- |
| opencode/step-5-preview-free | supercarto | 19/21 | 90% | 930 | 5 |
| opencode/muse-spark-1.3-contributor-free | supercarto | 17/23 | 74% | 930 | 6 |
| opencode/glm-5.3-flash-free | supercarto | 2/3 | 67% | 1043 | 1 |
| opencode/step-5-preview-free | geojson | 9/21 | 43% | 172674 | 5 |
| opencode/glm-5.3-flash-free | geojson | 1/3 | 33% | 69610 | 1 |
| opencode/muse-spark-1.3-contributor-free | geojson | 5/20 | 25% | 172674 | 6 |
| opencode/muse-spark-1.3-contributor-free | none | 0/24 | 0% | 189 | 6 |
| opencode/step-5-preview-free | none | 0/20 | 0% | 189 | 5 |
| opencode/glm-5.3-flash-free | none | 0/3 | 0% | 191 | 1 |

## How to read it

- solve rate counts scorable rows only; unscored rows (errors, voided refusals) are excluded from numerators and denominators and stay visible in the per-report files.
- token medians are chars/4 estimates unless a run recorded provider usage.
- arms registered by adapters (`--adapter`) appear as their own arm, same tasks, same pass rules.

To add a run: `scripts/run-free-ladder.ts --out <dir> --report <file>` and commit the report; the leaderboard re-derives on the next aggregate.

