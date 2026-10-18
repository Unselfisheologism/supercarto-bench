# Changelog (supercarto-bench)

## Unreleased — own the eval: adapter arms, certificate, leaderboard

- **Adapter arms** (`src/bench/adapter.ts`, `--adapter <file>`, repeatable):
  a rival map tool joins the comparison as its own arm — same tasks, same
  models, same prompts, same archiving and scoring. The adapter gets the
  same *inputs* the reference gets (raw features, the compiled wire
  document, task, budget hint) and never supercarto's rendered output, so
  the contest is between representations rather than between summarisers.
  Arm ids cannot shadow the built-ins; empty contexts are refused loudly
  rather than archived as uniform failures; default is one pass at the
  largest budget, `--sweep-adapters` opts into the full sweep.
- **scoreC certificate** (`scripts/certificate.ts`): any set of archived
  reports reduces to the integer headline — per task kind, arm by arm
  (9/9-style) — with sha256 provenance for every source report and a
  re-derive command that spends no model calls. Sharing the score now ships
  with its own reproduction recipe.
- **Leaderboard** (`scripts/leaderboard.ts`): aggregates every report under
  `bench-results/` into a per-(model, arm) table, sorted by solve rate then
  median context tokens. Re-deriving it from the archives is idempotent.
  Committed mirrors: `bench-results/certificate.{md,json}`,
  `bench-results/leaderboard.{md,json}`.
- **supercarto dep `^0.4.9` → `^0.4.11`**, with the drift measured, not
  absorbed: 0.4.11's connectivity-preserving budgeter keeps the same
  connected core at every grid scale (bbox-scoped and unscoped compiles now
  agree, so three validity tests that pinned the old prune behaviour were
  rewritten around the new invariants), and it is materially slower and
  poorer on names at low budget — sf-cbd names 3 places at budget 1024
  where 0.4.9 named 10, and one 4,570-feature compile measurably costs
  ~30s (per-removal articulation recompute in place of the old batching).
  Test timeouts record the measurement; the certificate above is scoreC
  36/44 · 14/41 · 0/44 over the 0.4.9-era archived runs.

## 0.4.9

Split from the supercarto monorepo into its own repository. The harness tests
the released `supercarto` npm package, not local source.

- 6 task kinds across 4 synthetic areas + 8 real-city areas:
  omission / nearest / connectivity (9/9 supercarto on both models),
  expansion (footprint m², agentic track), heat (peak value + location),
  diff (previous map + changes). Route/turns unmeasurable (reference
  router returns impossible distances) — recorded, not hidden.
- Frozen fixtures, safe resume (prompt-hash guard), real call cap, committed
  raw archives re-scorable with zero model calls.
- Isolation: clean cwd + clean config home per subject; tool allowlists with
  shared matcher; codenames excluded from defaults.
