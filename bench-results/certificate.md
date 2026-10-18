# supercarto bench — scoreC certificate

Generated 2026-10-18T02:35:35.835Z. Every number below is derived from archived rows in this repo: prompts, answers and token counts stored per exchange. Re-scoring spends no model calls.

## Headline — solved/scorable, by task kind and arm

| kind | supercarto | geojson | none |
| --- | --- | --- | --- |
| connectivity | 6/6 | 5/6 | 0/6 |
| diff | 5/5 | 4/4 | 0/6 |
| expansion | 7/15 | 3/13 | 0/14 |
| heat | 6/6 | 0/6 | 0/6 |
| nearest-poi | 6/6 | 0/6 | 0/6 |
| omission-awareness | 6/6 | 2/6 | 0/6 |

## scoreC — solved across every kind, one fraction per arm

- supercarto: **36/44**
- geojson: **14/41**
- none: **0/44**

6 archived row(s) did not score (errors, refusals that void the pass rule, harvest failures). They are excluded from every denominator above.

## Provenance

- model alias **opencode-muse-spark-1.3-contributor-free**
- model alias **opencode-step-5-preview-free**
- model alias **opencode/muse-spark-1.3-contributor-free**
- model alias **opencode-fledge-alpha-free**
- model **opencode/muse-spark-1.3-contributor-free**: 22/67 answered rows solved
- model **opencode/step-5-preview-free**: 28/62 answered rows solved
- bench-results/diff-muse.report.json — sha256 `0fa91bf32b307ca2fef8319b1d6d19dc57bc03a1e8f69f5b1106d7ccf858b61a`
- bench-results/diff-step5.report.json — sha256 `ed120c4ef4fa946c216945e3109d98151ad2b772ae0d476fdf0a05500abe04c7`
- bench-results/expansion-muse-area.report.json — sha256 `a84fb52c76f3dc790475b64eb3bc686a74a6ee3f40f0b8d7b5c802e456153982`
- bench-results/expansion-muse-containment-agentic.report.json — sha256 `28150c53b1d63641d3ade1260c1353a0b489f807f1871e38839c95e8df1e5b30`
- bench-results/expansion-muse-containment.report.json — sha256 `c43ccfbdb6bbad23bc282572287d3b5e3eca99744ca4c9cd2057a5269e79d421`
- bench-results/expansion-step5-area.report.json — sha256 `2e6c3cc4df21d720f371e4f91126562366a43eeacfdde6e4e18971f1f35e8348`
- bench-results/expansion-step5-containment.report.json — sha256 `90e9ead0a2d629fb2b0b9a227c0174cd9c00233391f6807c42a96c88410dcaf0`
- bench-results/heat-muse-voided.report.json — sha256 `ea012bc6c323265b7d23ff8b36420a2699d42f285c63b3efe73e4121bffaf4d9`
- bench-results/heat-muse.report.json — sha256 `232aafbe25b0d9dad4756e2827cbdccc31a876ee908e79b5b42b83c3b68c9a42`
- bench-results/heat-step5.report.json — sha256 `d1ecd3dd474f4bc5663c862796272bca89308bf99aa6ba3bc9f0c9837e51f243`
- bench-results/smoke-full.report.json — sha256 `6bf6ddca056f06eaff2245724bdfa91d63b6ecedec80364e5ac1aed27c0847dc`
- bench-results/smoke2.report.json — sha256 `f1968abb240a76e1c3315b09119e26304f3840e27a20e94a100cb14c5f600865`
- bench-results/synthetic-muse.report.json — sha256 `4c03b0b951d78625b3e823c01a4004ddb3bc99aa5f5699026f6c2afbfd86dca0`
- bench-results/synthetic-step5.report.json — sha256 `6dd378939f1fe9f024db38cc43b8853918a3264ebced4cb8a3848971ebbd8f06`

## Verify

    npx tsx scripts/certificate.ts bench-results/*.report.json  # re-derive, no model calls

Cite as:

    supercarto-bench scoreC supercarto 36/44 · geojson 14/41 · none 0/44 (2026-10-18T02:35:35.835Z)

