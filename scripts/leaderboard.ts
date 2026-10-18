/**
 * Aggregate every archived run into the leaderboard.
 *
 *   npx tsx scripts/leaderboard.ts
 *
 * Reads `bench-results/*.report.json`, mirrors the numbers, and writes
 * `bench-results/leaderboard.md` (+ .json). Deterministic for a fixed
 * directory: run it twice, diff, nothing should move.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildLeaderboard, renderLeaderboardMd, type LbReport } from '../src/bench/leaderboard.js';

const DIR = 'bench-results';
const files = readdirSync(DIR).filter(
  (f) => f.endsWith('.report.json') && !/certificate|leaderboard/i.test(f),
);
if (files.length === 0) {
  console.error(`no report files in ${DIR}; run the ladder first`);
  process.exit(1);
}

const reports: LbReport[] = files.map((f) => ({
  source: f,
  report: JSON.parse(readFileSync(join(DIR, f), 'utf8')),
}));

const lb = buildLeaderboard(reports);
const md = renderLeaderboardMd(lb);
console.log(md);
writeFileSync(join(DIR, 'leaderboard.md'), md);
writeFileSync(join(DIR, 'leaderboard.json'), JSON.stringify(lb, null, 2) + '\n');
console.log(`wrote ${DIR}/leaderboard.md from ${files.length} run(s)`);
