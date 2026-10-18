import { describe, expect, it } from 'vitest';
import { buildCertificate, kindOf, renderCertificateMd, type CertReport } from '../src/bench/certificate.js';
import { buildLeaderboard, renderLeaderboardMd, type LbReport } from '../src/bench/leaderboard.js';

const row = (
  kind: string,
  rep: string,
  correct: boolean | null,
  o: Partial<{ model: string; error: string; scoredBy: string; seed: number; taskId: string }> = {},
) => ({
  taskId: o.taskId ?? `synthetic-pacific/${kind}#${rep}@1024`,
  model: o.model ?? 'opencode/example-model-free',
  representation: rep,
  seed: o.seed ?? 0,
  correct,
  scoredBy: o.scoredBy ?? 'exact',
  error: o.error ?? null,
});

const report = (rows: unknown[], models: string[], generatedAt = '2026-10-18T00:00:00Z') => ({
  generatedAt,
  models,
  rows,
}) as unknown as CertReport;

describe('certificate', () => {
  it('picks the task kind out of a detail id', () => {
    expect(kindOf('synthetic-pacific/omission-awareness#supercarto@1024')).toBe('omission-awareness');
    expect(kindOf('bare-id')).toBe('bare-id');
  });

  it('builds the 9/9-style headline with scorable-row denominators', () => {
    const r = report(
      [
        row('omission-awareness', 'supercarto', true), row('omission-awareness', 'supercarto', true), row('omission-awareness', 'supercarto', true),
        row('omission-awareness', 'geojson', true), row('omission-awareness', 'geojson', false), row('omission-awareness', 'geojson', true),
        row('omission-awareness', 'none', false), row('omission-awareness', 'none', false), row('omission-awareness', 'none', false),
      ],
      ['example-model'],
    );
    const cert = buildCertificate([{ file: 'r.json', sha256: 'abc' }], [r], { generatedAt: '2026-10-18T00:00:00Z' });
    expect(cert.scorec).toEqual({ supercarto: '3/3', geojson: '2/3', none: '0/3' });
    expect(cert.kinds[0]!.arms.supercarto).toEqual({ solved: 3, total: 3 });
    expect(cert.skipped).toBe(0);
  });

  it('excludes errored rows from every denominator and says so', () => {
    const r = report(
      [
        row('nearest-poi', 'supercarto', true),
        row('nearest-poi', 'supercarto', null, { error: 'harvest failed' }),
        row('nearest-poi', 'geojson', true),
        row('nearest-poi', 'none', false, { scoredBy: 'failed' }),
      ],
      ['example-model'],
    );
    const cert = buildCertificate([{ file: 'r.json', sha256: 'abc' }], [r]);
    expect(cert.kinds[0]!.arms.supercarto).toEqual({ solved: 1, total: 1 });
    expect(cert.kinds[0]!.arms.none).toEqual({ solved: 0, total: 0 });
    expect(cert.skipped).toBe(2);
    const md = renderCertificateMd(cert);
    expect(md).toContain('2 archived row(s) did not score');
  });

  it('keeps adapter arms as their own column', () => {
    const r = report(
      [
        row('omission-awareness', 'supercarto', true),
        row('omission-awareness', 'rival-json', false),
      ],
      ['example-model'],
    );
    const cert = buildCertificate([{ file: 'r.json', sha256: 'abc' }], [r]);
    expect(cert.armOrder).toEqual(['supercarto', 'geojson', 'none', 'rival-json']);
    expect(cert.scorec['rival-json']).toBe('0/1');
  });

  it('refuses a certificate with no scorable rows', () => {
    expect(() => buildCertificate([], [], { generatedAt: 'x' })).toThrow(/no reports/);
    const r = report([row('omission-awareness', 'supercarto', null, { error: 'x' })], ['m']);
    expect(() =>
      renderCertificateMd(buildCertificate([{ file: 'r', sha256: 'h' }], [r])),
    ).toThrow(/nothing scorable/);
  });

  it('renders a shareable md with the verify command and a one-line citation', () => {
    const r = report(
      [
        row('omission-awareness', 'supercarto', true), row('omission-awareness', 'supercarto', true), row('omission-awareness', 'supercarto', true),
        row('omission-awareness', 'geojson', true),
        row('omission-awareness', 'none', false),
      ],
      ['example-model'],
    );
    const cert = buildCertificate([{ file: 'reports/a.report.json', sha256: 'deadbeef' }], [r], {
      generatedAt: '2026-10-18T00:00:00Z',
    });
    const md = renderCertificateMd(cert);
    expect(md).toContain('| kind | supercarto | geojson | none |');
    expect(md).toContain('## scoreC');
    expect(md).toContain('sha256 `deadbeef`');
    expect(md).toContain('supercarto-bench scoreC supercarto 3/3 · geojson 1/1 · none 0/1');
    expect(md).toContain('npx tsx scripts/certificate.ts');
  });
});

describe('leaderboard', () => {
  const lbReport = (detail: unknown[], summary: unknown[] = [], source = 'a.report.json') =>
    ({ source, report: { generatedAt: '2026-10-18T00:00:00Z', models: [], detail, summary } }) as unknown as LbReport;

  it('aggregates one row per (model, arm) across runs', () => {
    const lb = buildLeaderboard(
      [
        lbReport([
          row('omission-awareness', 'supercarto', true),
          row('omission-awareness', 'none', false),
        ]),
        lbReport([
          row('omission-awareness', 'supercarto', false, { seed: 1 }),
        ], [], 'b.report.json'),
      ],
      '2026-10-18T00:00:00Z',
    );
    const sup = lb.entries.find((e) => e.arm === 'supercarto')!;
    expect(sup.solved).toBe(1);
    expect(sup.rows).toBe(2);
    expect(sup.runs).toEqual(['a.report.json', 'b.report.json']);
    expect(lb.scorec.supercarto).toBe('1/2');
  });

  it('sorts by rate, then cheaper tokens, then name — deterministically', () => {
    const mk = (model: string, rep: string, correct: boolean, o = {}) => row('omission-awareness', rep, correct, { model, ...o });
    const lb = buildLeaderboard(
      [
        lbReport([
          mk('m/a', 'supercarto', true),
          mk('m/b', 'supercarto', true),
          mk('m/b', 'supercarto', true, { seed: 1 }),
        ], [{ model: 'm-b', representation: 'supercarto', medianInputTokens: 400 }, { model: 'm-a', representation: 'supercarto', medianInputTokens: 900 }]),
      ],
      'x',
    );
    // Equal rates: the cheaper median context wins the higher row.
    const [a, b] = lb.entries.filter((e) => e.arm === 'supercarto');
    expect(a!.model).toBe('m/b');
    expect(b!.model).toBe('m/a');
    // Running the same aggregation again gives the same order.
    const again = buildLeaderboard(
      [
        lbReport([
          row('omission-awareness', 'supercarto', true, { model: 'm/a' }),
          row('omission-awareness', 'supercarto', true, { model: 'm/b' }),
          row('omission-awareness', 'supercarto', true, { model: 'm/b', seed: 1 }),
        ], [{ model: 'm-a', representation: 'supercarto', medianInputTokens: 900 }, { model: 'm-b', representation: 'supercarto', medianInputTokens: 400 }]),
      ],
      'y',
    );
    expect(again.entries.map((e) => e.model)).toEqual(lb.entries.map((e) => e.model));
  });

  it('annotates adapter arms with the same guarantees', () => {
    const lb = buildLeaderboard([
      lbReport([row('omission-awareness', 'rival-json', true)]),
    ]);
    expect(lb.entries[0]!.arm).toBe('rival-json');
    expect(lb.scorec['rival-json']).toBe('1/1');
  });

  it('refuses to publish an empty leaderboard', () => {
    expect(() =>
      renderLeaderboardMd(buildLeaderboard([lbReport([])])),
    ).toThrow(/no scored rows/);
  });
});
