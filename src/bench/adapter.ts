/**
 * Adapter arms: how a rival map tool runs on this benchmark.
 *
 * The comparison the harness exists to make is between map-data
 * representations, not between supercarto and its own source code. The three
 * built-in arms (`supercarto`, `geojson`, `none`) are the reference; an adapter
 * registers one more arm that is prepared, prompted, archived and scored like
 * any other - same model, same task, same budget, same scoring rule.
 *
 * The contract is deliberately narrow: the adapter never sees supercarto's
 * compiled output. A rival that is only asked to re-format the YAML it is
 * handed would be a summary contest, not a representation contest, and the
 * score would not say what either tool costs to be correct end to end. The
 * adapter gets the same *inputs* the reference implementation gets - raw
 * features and the task - and produces its own context, whatever it costs.
 */

import type { ScrDocument, GeoJsonFeatureCollection } from 'supercarto';
import type { Representation } from './score.js';
import type { BenchmarkTask } from './tasks.js';

export interface AdapterPrepareInput {
  /** The question, its kind and the pass rule. */
  task: BenchmarkTask;
  /**
   * Token budget hint, in the same units the supercarto arm sweeps.
   *
   * A rival tool budgets itself; this is what "the same" means for the run's
   * crossover math. Ignore it and the report still works, but the cost column
   * no longer lines up with a budget row.
   */
  budget: number;
  /**
   * The raw source features for this task, the same data the geojson arm
   * serialises.
   *
   * Present for fixture-backed runs (the offline path) and recovered from the
   * same document the supercarto arm compiles from for live runs. Absent only
   * when the fetch failed, which the harness reports as a failed row.
   */
  features?: GeoJsonFeatureCollection;
  /**
   * The compiled wire document at this budget.
   *
   * Give it to feed a rival's own compiler over the same grid, not as a text
   * to paste: the shape an adapter returns is its own, and the harness scores
   * the answer, not the verbosity.
   */
  doc?: ScrDocument;
  /**
   * The previous snapshot, for diff tasks.
   *
   * diff asks what changed between two ingests; a rival that wants to compare
   * on equal terms gets the same two raw snapshots the supercarto arm's
   * session diff runs on.
   */
  prevFeatures?: GeoJsonFeatureCollection;
  /** The previous snapshot's compiled document, for diff tasks. */
  prevDoc?: ScrDocument;
}

export interface AdapterArmResult {
  /** Exactly what the subject model sees as its map context. */
  text: string;
}

/**
 * One adapter arm.
 *
 * Export either a default object or a named `adapter` from the module the
 * `--adapter` flag points at; the loader accepts both.
 */
export interface AdapterArm {
  /**
   * Stable arm id: it appears in reports, archive rows and the leaderboard, so
   * changing it forks the identity of every historical row.
   */
  name: string;
  /** One line on what the tool is, for the report header. */
  description?: string;
  /** Build the map context for one task+budget. */
  prepare(input: AdapterPrepareInput): Promise<AdapterArmResult> | AdapterArmResult;
}

/** Runtime check for a user-supplied adapter module, with the failing part named. */
export function isAdapterArm(value: unknown): value is AdapterArm {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<AdapterArm>;
  return typeof v.name === 'string' && v.name.length > 0 && typeof v.prepare === 'function';
}

/**
 * Load adapter modules from file paths.
 *
 * Accepts a default export, a named `adapter` export, or a module object that
 * *is* the arm. Fails loudly with the offending load reason rather than
 * registering a broken arm that would run and error halfway through a
 * metered model ladder.
 */
export async function loadAdapters(paths: readonly string[]): Promise<AdapterArm[]> {
  const arms: AdapterArm[] = [];
  for (const p of paths) {
    let mod: unknown;
    try {
      mod = await import(p);
    } catch (err) {
      throw new Error(`--adapter ${p} could not be imported: ${err instanceof Error ? err.message : String(err)}`);
    }
    const m = mod as Record<string, unknown> | null;
    const candidate = (m as { default?: unknown } | null)?.default ?? (m as { adapter?: unknown } | null)?.adapter ?? m;
    if (!isAdapterArm(candidate)) {
      throw new Error(
        `--adapter ${p}: expected a default export or named ` +
        '`adapter` with { name, prepare(input) }; got ' +
        `${typeof candidate}`,
      );
    }
    if (arms.some((a) => a.name === candidate.name)) {
      throw new Error(`two adapters are named ${candidate.name}; arm ids must be unique`);
    }
    arms.push(candidate);
  }
  return arms;
}

/** The built-in arms, in the fixed order the report lays them out. */
export const BUILTIN_REPS: readonly string[] = ['supercarto', 'geojson', 'none'];

/** Every arm of a run, built-ins in order and then the registered adapters. */
export function armsFor(adapters: readonly AdapterArm[]): Representation[] {
  return [...BUILTIN_REPS, ...adapters.map((a) => a.name)];
}
