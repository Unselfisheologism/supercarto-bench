/**
 * Weekly living-leaderboard run.
 *
 * One free model, one real-city area, every arm, one seed. Fills the
 * columns that matter (connectivity, nearest, feasibility), refreshes the
 * committed certificate and leaderboard mirrors, commits the archives.
 *
 *   bash scripts/weekly.sh
 *
 * Honesty rules the script keeps:
 *  - No retry loops and no model swaps on failure. A model that stops
 *    serving is recorded below, not swapped out to keep numbers flowing.
 *  - The mirrors are regenerated from whichever rows exist; a partial run
 *    refreshes fewer rows, and the certificate's provenance section shows
 *    exactly which archives produced it.
 *  - This box has no cron. Run it by hand on a cadence you keep, or hang
 *    it on whatever scheduler you have. The benchmark stays alive only if
 *    someone actually runs this.
 */
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL="opencode/glm-5.3-flash-free"
STAMP="$(date -u +%Y%m%d)"
NAME="feas-glm53-${STAMP}"

# 40-call cap: 3 tasks x 3 arms x 1 seed = 9 calls minimum, and room for the
# tool turns inside the agentic track. Enough to fill the column, cheap
# enough to run every week forever.
npx tsx scripts/run-free-ladder.ts \
  --model "$MODEL" \
  --only "sf-cbd/route-feasibility,sf-cbd/nearest-poi,sf-cbd/connectivity" \
  --seeds 1 --budget 40 \
  --out "bench-results/${NAME}" \
  --report "bench-results/${NAME}.report.json"

npm run certificate
npm run leaderboard

# Commit the archives and mirrors, so the committed numbers are always
# re-derivable from the committed raw rows.
if [ -n "$(git status --porcelain bench-results)" ]; then
  git add bench-results
  git -c user.name="Jeffrin James" -c user.email="jeffrinjames99@gmail.com" \
    commit -m "Weekly living-leaderboard run (${STAMP}): ${MODEL}, sf-cbd"
  git -c credential.helper='!gh auth git-credential' push origin master
else
  echo "no new rows; nothing to commit"
fi
