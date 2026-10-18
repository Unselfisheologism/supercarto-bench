/**
 * Generate the scoreC certificate from one or more report files.
 *
 *   npx tsx scripts/certificate.ts bench-results/*.report.json
 *   npx tsx scripts/certificate.ts --out .bench/cert bench-results/synthetic-*.report.json
 *
 * Writes `<out>.certificate.md` and `.json` next to the first report, or into
 * --out. Every number is re-derivable from the archives with no model calls;
 * the certificate says exactly how.
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildCertificate,
  hashSource,
  readReport,
  renderCertificateMd,
  type Certificate,
} from '../src/bench/certificate.js';

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const out = outIdx !== -1 ? resolve(argv[outIdx + 1] ?? 'bench-results/certificate') : null;

const reports = argv
  .filter((a, i) => !a.startsWith('--') && (outIdx === -1 || i < outIdx || i > outIdx + 1))
  .filter((a) => a.endsWith('.report.json'));

if (reports.length === 0) {
  console.error('no *.report.json paths given (or none matched). Example:');
  console.error('  npx tsx scripts/certificate.ts bench-results/*.report.json');
  process.exit(1);
}

const sources = reports.map((p) => hashSource(p));
const parsed = reports.map((p) => readReport(p));
const cert = buildCertificate(sources, parsed);

const md = renderCertificateMd(cert);
console.log(md);

const base = out ?? resolve(reports[0]!.replace(/\.report\.json$/, '.certificate'));
writeFileSync(`${base}.md`, md);
writeFileSync(`${base}.json`, JSON.stringify(cert, null, 2) + '\n');
console.log(`wrote ${base}.md and ${base}.json from ${reports.length} report(s)`);
