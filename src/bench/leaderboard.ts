/**
 * The leaderboard.
 *
 * Machines run the ladder; the leaderboard is the persisted, aggregated view
 * of every archived run in `bench-results/`. One row per (model, arm): the
 * arms are comparable because the tasks, prompts and pass rules are shared;
 * the models are comparable because the aggregation is per model.
 *
 * Sorted by solve rate, then by median context tokens, then by id - so the
 * cheapest correct arm is near the top and the ordering has no hidden
 * weighting. Nothing here judges vibe; it mirrors the archive files, and a
 * re-run of the aggregation is idempotent.
 */

import type { Representation } from './score.js';

export interface LbReport {
  source: string;
  report: {
    generatedAt: string;
    models: unknown[];
    detail: LbRow[];
    summary?: {
      model: string;
      representation: string;
      medianInputTokens?: number;
      accuracy?: number;
    }[];
  };
}

export interface LbRow {
  taskId: string;
  model: string;
  representation: string;
  correct: boolean | null;
  scoredBy: string;
  error?: string | null;
}

export function scorable(r: LbRow): boolean {
  return (
    r.error == null &&
    r.scoredBy !== 'failed' &&
    r.correct !== null &&
    r.correct !== undefined
  );
}

/** Two ids spelled differently (slash vs dash aliases) should still match. */
function modelKey(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9.]/g, '');
}

export interface LbEntry {
  model: string;
  arm: string;
  solved: number;
  rows: number;
  percent: string;
  medianTokens: number | null;
  runs: string[];
}

export interface Leaderboard {
  generatedAt: string;
  /** (model, arm) rows, sorted by rate, then tokens, then ids. */
  entries: LbEntry[];
  /** Whole-fraction wedge per arm across every run, the certificate's scoreC. */
  scorec: Record<string, string>;
  notes: string[];
}

export function buildLeaderboard(reports: LbReport[], generatedAt = new Date().toISOString()): Leaderboard {
  const entries: LbEntry[] = [];
  const solvedByArm: Record<string, { solved: number; total: number }> = {};

  for (const { source, report } of reports) {
    // Token medians come from the run's summary; report model aliases use a
    // different spelling than archive row ids, so the match is normalised.
    const tokens = new Map<string, number>();
    for (const s of report.summary ?? []) {
      if (typeof s.medianInputTokens === 'number') {
        tokens.set(`${modelKey(s.model)}|${s.representation}`, s.medianInputTokens);
      }
    }

    // Some archives of narrower tracks (diff/expansion) carry rows under
    // `detail` only when a model ran; a report that stores another shape is
    // treated as empty rather than crashing the whole aggregation.
    const rows: LbRow[] = Array.isArray((report as { detail?: LbRow[] }).detail)
      ? ((report as { detail: LbRow[] }).detail)
      : [];

    for (const row of rows) {
      if (!scorable(row)) continue;
      const key = `${row.model}|${row.representation}`;
      let e = entries.find((x) => x.model === row.model && x.arm === row.representation);
      if (!e) {
        e = { model: row.model, arm: row.representation, solved: 0, rows: 0, percent: '', medianTokens: null, runs: [] };
        entries.push(e);
      }
      e.rows += 1;
      if (row.correct === true) e.solved += 1;
      if (!e.runs.includes(source)) e.runs.push(source);

      const t = tokens.get(`${modelKey(row.model)}|${row.representation}`);
      if (t != null) {
        e.medianTokens = e.medianTokens == null ? t : Math.round((e.medianTokens + t) / 2);
      }

      const arm = solvedByArm[row.representation] ?? { solved: 0, total: 0 };
      arm.total += 1;
      if (row.correct === true) arm.solved += 1;
      solvedByArm[row.representation] = arm;
    }
  }

  for (const e of entries) {
    e.percent = e.rows === 0 ? '0%' : `${Math.round((100 * e.solved) / e.rows)}%`;
  }

  entries.sort((a, b) => {
    const ra = a.solved / a.rows;
    const rb = b.solved / b.rows;
    if (rb !== ra) return rb - ra;
    const ta = a.medianTokens ?? Number.POSITIVE_INFINITY;
    const tb = b.medianTokens ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return `${a.model}|${a.arm}` < `${b.model}|${b.arm}` ? -1 : 1;
  });

  const scorec: Record<string, string> = {};
  for (const [arm, v] of Object.entries(solvedByArm).sort()) {
    scorec[arm] = `${v.solved}/${v.total}`;
  }

  const notes = [
    'solve rate counts scorable rows only; unscored rows (errors, voided refusals) are excluded from numerators and denominators and stay visible in the per-report files.',
    'token medians are chars/4 estimates unless a run recorded provider usage.',
    'arms registered by adapters (`--adapter`) appear as their own arm, same tasks, same pass rules.',
  ];

  return { generatedAt, entries, scorec, notes };
}

export function renderLeaderboardMd(lb: Leaderboard): string {
  if (lb.entries.length === 0) {
    throw new Error('no scored rows in the given reports; refusing to publish an empty leaderboard');
  }
  const lines: string[] = [];
  lines.push('# supercarto bench — leaderboard');
  lines.push('');
  lines.push(`Aggregated ${lb.generatedAt} from the archives under \`bench-results/\`.`);
  lines.push('');
  lines.push('## scoreC across every run — solved/scorable per arm');
  lines.push('');
  for (const [arm, v] of Object.entries(lb.scorec)) {
    lines.push(`- ${arm}: **${v}**`);
  }
  lines.push('');
  lines.push('## Per model and arm');
  lines.push('');
  lines.push('| model | arm | score | rate | median tokens | runs |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const e of lb.entries) {
    lines.push(
      `| ${e.model} | ${e.arm} | ${e.solved}/${e.rows} | ${e.percent} | ` +
      `${e.medianTokens == null ? '—' : e.medianTokens} | ${e.runs.length} |`,
    );
  }
  lines.push('');
  lines.push('## How to read it');
  lines.push('');
  for (const n of lb.notes) lines.push(`- ${n}`);
  lines.push('');
  lines.push('To add a run: `scripts/run-free-ladder.ts --out <dir> --report <file>` and commit the report; the leaderboard re-derives on the next aggregate.');
  lines.push('');
  return lines.join('\n') + '\n';
}
