/**
 * Recompile every archived supercarto-arm context with the installed
 * supercarto package and report which archived rows would change.
 *
 * Zero model calls: reads the committed archives, rebuilds the compiled
 * prompt through the harness's own buildContext, and diffs against what the
 * model actually saw when the archive was written. Used to decide whether a
 * package bump changes the benchmark or only the version string.
 *
 *   npx tsx scripts/recompile-diff.ts            # archive dir default bench-results
 *   npx tsx scripts/recompile-diff.ts --out .bench/my-run
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { buildContext } from '../src/bench/runner.js';
import { FREE_LADDER_AREAS, buildTasks } from '../src/bench/tasks.js';
import { SuperCarto } from 'supercarto';
import type { GeoJsonFeatureCollection } from 'supercarto';

const FIXTURE_DIR = 'fixtures/bench';

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
}

const archiveDir = arg('--out', 'bench-results')!;

const fixtures: Record<string, GeoJsonFeatureCollection> = {};
for (const f of existsSync(FIXTURE_DIR) ? readdirSync(FIXTURE_DIR) : []) {
  if (f.endsWith('.geojson')) fixtures[f.replace(/\.geojson$/, '')] = JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8'));
}

const tasks = new Map(buildTasks(FREE_LADDER_AREAS).map((t) => [t.id, t]));

/** Collect every archived supercarto row. */
interface Row {
  key: string;
  taskId: string;
  budget: number;
  user: string;
}
const rows: Array<Row> = [];
for (const f of readdirSync(archiveDir)) {
  if (!f.endsWith('.jsonl')) continue;
  for (const line of readFileSync(join(archiveDir, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.representation !== 'supercarto') continue;
    rows.push({ key: r.key, taskId: r.taskId, budget: r.budget, user: r.user ?? '' });
  }
}

/** Header lines that change with the clock, not with the package. */
function normalize(text: string): string {
  return text
    .split('\n')
    .filter((l) => !l.includes('sun:') && !l.includes('sunrise:') && !l.includes('center:'))
    .map((l) => (l.includes('radius:') ? '  radius: <r>' : l))
    .join('\n');
}

const carto = new SuperCarto();
const log = () => {};
const seen = new Set<string>();
let same = 0;
let changed = 0;
let missing = 0;
const changedKeys: Array<string> = [];

for (const row of rows) {
  const ck = `${row.taskId}|${row.budget}`;
  if (seen.has(ck)) continue;
  seen.add(ck);
  const task = tasks.get(row.taskId);
  if (!task) {
    console.log(`MISS   ${ck}: no matching task definition`);
    missing++;
    continue;
  }
  const built = await buildContext(task, 'supercarto', row.budget, carto, log, new Map(), fixtures);
  if (normalize(built.text) === normalize(row.user)) {
    same++;
    continue;
  }
  changed++;
  changedKeys.push(ck);
  // First structural difference, for a human glance.
  const a = normalize(row.user).split('\n');
  const b = normalize(built.text).split('\n');
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  console.log(`CHANGED ${ck}: first diff at line ${i + 1}`);
  console.log(`  archive: ${(a[i] ?? '').slice(0, 200)}`);
  console.log(`  rebuilt: ${(b[i] ?? '').slice(0, 200)}`);
}

console.log(`\nunique archived (task,budget) pairs: ${seen.size}`);
console.log(`unchanged: ${same}   changed: ${changed}   unmatched task: ${missing}`);
if (changed > 0) {
  console.log('changed pairs:', changedKeys.join(', '));
}
