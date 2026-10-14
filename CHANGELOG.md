# Changelog (supercarto-bench)

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
