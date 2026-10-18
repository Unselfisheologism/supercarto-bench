/**
 * The scoreC certificate.
 *
 * A benchmark report nobody can verify is an advert. The certificate reduces
 * one or more reports to the wedge claim — per task kind, arm by arm, in
 * whole numbers like "9/9" — and attaches the provenance needed to re-derive
 * every number: the source report hashes, the models answered, the repeats,
 * and the no-model-calls re-score command. Citations that come with their own
 * reproduction recipe are the ones rivals cannot dismiss.
 *
 * Deliberately integer-based. Percentages invite rounding debates; "9/9" is
 * either reproducible from the archives or it is not, and both readings are
 * instantly checkable by anyone with the repo.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Representation } from './score.js';

/** One scored row, exactly as a report file carries it. */
export interface CertRow {
  taskId: string;
  model: string;
  representation: string;
  seed: number;
  correct: boolean | null;
  scoredBy: string;
  error?: string | null;
}

export interface CertReport {
  generatedAt: string;
  models: unknown[];
  rows: CertRow[];
  summary?: unknown;
  fixtures?: unknown;
}

export interface CertSource {
  /** Report file path, as cited on the command line. */
  file: string;
  /** sha256 of the exact file bytes: the citation is content-addressed. */
  sha256: string;
}

export interface CertKindScore {
  kind: string;
  /** Per arm: solved/denominator. Denominators count scorable rows only. */
  arms: Record<string, { solved: number; total: number }>;
}

export interface CertModel {
  /** The model id exactly as the archive rows spell it. */
  id: string;
  rows: number;
  solved: number;
}

export interface Certificate {
  /** UTC instant, so two certificates with the same numbers still differ. */
  generatedAt: string;
  sources: CertSource[];
  /** Model aliases as each report headlined them. */
  aliases: string[];
  /** Rows grouped by their exact archive model id. */
  models: CertModel[];
  /** Task kinds present, alphabetically, each arm already summed. */
  kinds: CertKindScore[];
  /** Arms in fixed built-in order, then any adapter arm that showed data. */
  armOrder: string[];
  /**
   * The wedge score, computed exactly like the headline table: solved rows
   * over scorable rows, summed across kinds and models, for every arm.
   */
  scorec: Record<string, string>;
  /** Rows excluded from every denominator, always stated rather than buried. */
  skipped: number;
  /** The re-score command that re-derives every number with no model calls. */
  verify: string;
}

/** Task kind out of a detail taskId: `<area>/<kind>#<rep>@<budget>`. */
export function kindOf(taskId: string): string {
  const slash = taskId.indexOf('/');
  const rest = slash === -1 ? taskId : taskId.slice(slash + 1);
  const hash = rest.indexOf('#');
  return hash === -1 ? rest : rest.slice(0, hash);
}

/** A row is scorable when the harness actually got an answer and scored it. */
function scorable(r: CertRow): boolean {
  return r.error == null && r.scoredBy !== 'failed' && r.correct !== null && r.correct !== undefined;
}

export function buildCertificate(
  sources: CertSource[],
  reports: CertReport[],
  opts: { generatedAt?: string; verify?: string } = {},
): Certificate {
  if (reports.length === 0) {
    throw new Error('no reports given; a certificate with no rows would be an advert, not a certificate');
  }
  const rows = reports.flatMap((r) => (r.rows ?? []) as CertRow[]);
  const scorableRows = rows.filter(scorable);
  const skipped = rows.length - scorableRows.length;

  const kindSet = [...new Set(scorableRows.map((r) => kindOf(r.taskId)))].sort();
  const adapters = [
    ...new Set(
      scorableRows
        .map((r) => r.representation)
        .filter((rep): rep is string => !BUILTINS.includes(rep)),
    ),
  ];
  const armOrder: Representation[] = ['supercarto', 'geojson', 'none', ...adapters];

  const kinds: CertKindScore[] = kindSet.map((kind) => {
    const arms: Record<string, { solved: number; total: number }> = {};
    for (const rep of armOrder) {
      const rs = scorableRows.filter((r) => kindOf(r.taskId) === kind && r.representation === rep);
      arms[rep] = { solved: rs.filter((r) => r.correct === true).length, total: rs.length };
    }
    return { kind, arms };
  });

  // Denominators exclude unscored rows, so the headline stays an integer
  // comparison of what was actually answered. The skipped count is printed
  // rather than buried, because "9/9" should hide nothing.
  const scorec: Record<string, string> = {};
  for (const rep of armOrder) {
    const solved = kinds.reduce((n, k) => n + k.arms[rep]!.solved, 0);
    const total = kinds.reduce((n, k) => n + k.arms[rep]!.total, 0);
    scorec[rep] = total === 0 ? '0/0' : `${solved}/${total}`;
  }

  const models: CertModel[] = [...new Set(scorableRows.map((r) => r.model))].map(
    (id) => {
      const rs = scorableRows.filter((r) => r.model === id);
      return { id, rows: rs.length, solved: rs.filter((r) => r.correct === true).length };
    },
  );

  return {
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    sources,
    aliases: [...new Set(reports.flatMap((r) => (r.models ?? []).map(aliasString)))],
    models,
    kinds,
    armOrder,
    scorec,
    skipped,
    verify:
      opts.verify ??
      'npx tsx scripts/certificate.ts bench-results/*.report.json  # re-derive, no model calls',
  };
}

const BUILTINS: readonly string[] = ['supercarto', 'geojson', 'none'];

/** Report model entries are aliases or {model}-shaped summaries; both label. */
function aliasString(m: unknown): string {
  if (typeof m === 'string') return m;
  if (typeof m === 'object' && m !== null) {
    const o = m as Record<string, unknown>;
    for (const k of ['model', 'modelId', 'alias', 'id']) {
      if (typeof o[k] === 'string') return o[k] as string;
    }
  }
  return JSON.stringify(m);
}

/**
 * Hash a report file's bytes, so a cited certificate pins its inputs.
 *
 * The cited label is the path as given (repo-relative reads best in a
 * committed certificate); the bytes are read from that exact path.
 */
export function hashSource(path: string): CertSource {
  const bytes = readFileSync(path);
  return { file: path, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Parses a report file into the certificate's row shape. */
export function readReport(path: string): CertReport {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const detail = Array.isArray(raw.detail) ? raw.detail : [];
  return {
    generatedAt: raw.generatedAt ?? '',
    models: raw.models ?? [],
    rows: detail,
    summary: raw.summary,
    fixtures: raw.fixtures,
  };
}

const frac = (s: { solved: number; total: number }): string =>
  s.total === 0 ? '—' : `${s.solved}/${s.total}`;

export function renderCertificateMd(cert: Certificate): string {
  if (cert.kinds.length === 0) {
    throw new Error('nothing scorable in the given reports; refusing to publish an empty headline');
  }
  const lines: string[] = [];

  lines.push('# supercarto bench — scoreC certificate');
  lines.push('');
  lines.push(
    `Generated ${cert.generatedAt}. Every number below is derived from archived ` +
    'rows in this repo: prompts, answers and token counts stored per exchange. ' +
    'Re-scoring spends no model calls.',
  );
  lines.push('');
  lines.push('## Headline — solved/scorable, by task kind and arm');
  lines.push('');
  lines.push(`| kind | ${cert.armOrder.join(' | ')} |`);
  lines.push(`| --- |${cert.armOrder.map(() => ' --- |').join('')}`);
  for (const k of cert.kinds) {
    lines.push(`| ${k.kind} | ${cert.armOrder.map((rep) => frac(k.arms[rep] ?? { solved: 0, total: 0 })).join(' | ')} |`);
  }
  lines.push('');
  lines.push('## scoreC — solved across every kind, one fraction per arm');
  lines.push('');
  for (const rep of cert.armOrder) {
    lines.push(`- ${rep}: **${cert.scorec[rep]}**`);
  }
  if (cert.skipped > 0) {
    lines.push('');
    lines.push(
      `${cert.skipped} archived row(s) did not score (errors, refusals that void the pass ` +
      'rule, harvest failures). They are excluded from every denominator above.',
    );
  }
  lines.push('');
  lines.push('## Provenance');
  lines.push('');
  for (const a of cert.aliases) lines.push(`- model alias **${a}**`);
  for (const m of cert.models) lines.push(`- model **${m.id}**: ${m.solved}/${m.rows} answered rows solved`);
  for (const s of cert.sources) lines.push(`- ${s.file} — sha256 \`${s.sha256}\``);
  lines.push('');
  lines.push('## Verify');
  lines.push('');
  lines.push(`    ${cert.verify}`);
  lines.push('');
  lines.push('Cite as:');
  lines.push('');
  lines.push(
    `    supercarto-bench scoreC ${cert.armOrder.map((rep) => `${rep} ${cert.scorec[rep]}`).join(' · ')} (${cert.generatedAt})`,
  );
  lines.push('');
  return lines.join('\n') + '\n';
}
