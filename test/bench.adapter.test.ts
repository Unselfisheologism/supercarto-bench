import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBenchmark } from '../src/bench/runner.js';
import { armsFor, isAdapterArm, loadAdapters, type AdapterArm } from '../src/bench/adapter.js';
import { SuperCarto } from 'supercarto';
import type { RoutingSource } from 'supercarto';
import type { ModelClient } from '../src/bench/models.js';
import type { ModelRequest, ModelResponse } from '../src/bench/types.js';
import type { SourceRequest, SourceResult, MapSource } from 'supercarto';
import type { TaskArea } from '../src/bench/tasks.js';
import type { GeoJsonFeatureCollection } from 'supercarto';

/** The runner call is the test surface; the model is a scripted stand-in. */
class ScriptedModel implements ModelClient {
  calls = 0;
  seen: string[] = [];
  constructor(
    readonly id: string,
    readonly model: string,
    private readonly answer: (req: ModelRequest) => string,
  ) {}

  async call(req: ModelRequest): Promise<ModelResponse> {
    this.calls++;
    this.seen.push(req.user);
    const text = this.answer(req);
    return { text, inputTokens: req.user.length, outputTokens: text.length };
  }
}

class StubMapSource implements MapSource {
  readonly name = 'stub';
  readonly description = 'fixture';
  async available() {
    return true;
  }
  async fetch(_req: SourceRequest): Promise<SourceResult> {
    const features: GeoJsonFeatureCollection['features'] = [
      {
        type: 'Feature',
        id: 1,
        properties: { highway: 'primary', name: 'Market St' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122.3962, 37.7932],
            [-122.3938, 37.7932],
          ],
        },
      },
      {
        type: 'Feature',
        id: 2,
        properties: { amenity: 'cafe', name: 'Blue Bottle' },
        geometry: { type: 'Point', coordinates: [-122.395, 37.794] },
      },
      {
        type: 'Feature',
        id: 3,
        properties: { amenity: 'cafe', name: 'Ritual Coffee' },
        geometry: { type: 'Point', coordinates: [-122.3942, 37.7945] },
      },
    ];
    return { features, source: 'stub', truncated: false, elapsedMs: 1, warnings: [] };
  }
}

class StubRouter implements RoutingSource {
  readonly name = 'stub-router';
  async available() {
    return true;
  }
  async route() {
    return {
      route: { dist: 480, time: 380, steps: [] },
      source: 'stub',
      freeFlowOnly: false,
    } as never;
  }
}

const AREA: TaskArea = {
  id: 'test-area',
  label: 'Test area',
  center: { lat: 37.7936, lon: -122.3958 },
  radiusM: 400,
  rationale: 'fixed geometry so no network is needed',
};

function stubCarto(): SuperCarto {
  return new SuperCarto({ sources: [new StubMapSource()], router: new StubRouter() });
}

const FIXTURES: Record<string, GeoJsonFeatureCollection> = {
  'test-area': {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { highway: 'primary', name: 'Market St' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122.3962, 37.7932],
            [-122.3938, 37.7932],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { amenity: 'cafe', name: 'Blue Bottle' },
        geometry: { type: 'Point', coordinates: [-122.395, 37.794] },
      },
      {
        type: 'Feature',
        properties: { amenity: 'cafe', name: 'Ritual Coffee' },
        geometry: { type: 'Point', coordinates: [-122.3942, 37.7945] },
      },
    ],
  },
};

/** An adapter that mirrors its inputs into its text, for assertions. */
function inputEchoAdapter(name = 'rival-json'): AdapterArm & { sawBudgets: number[]; hadFeatures: boolean[] } {
  const sawBudgets: number[] = [];
  const hadFeatures: boolean[] = [];
  return {
    name,
    sawBudgets,
    hadFeatures,
    prepare(input) {
      sawBudgets.push(input.budget);
      hadFeatures.push((input.features?.features.length ?? 0) > 0);
      return {
        text: `Rival map: ${input.features?.features.map((f) => f.properties?.name).join(', ')}`,
      };
    },
  };
}

describe('adapter arms', () => {
  it('joins the representation set with the built-ins in fixed order', () => {
    const arm = inputEchoAdapter();
    expect(armsFor([arm])).toEqual(['supercarto', 'geojson', 'none', 'rival-json']);
  });

  it('runs a rival arm end to end: archived, summarised, costed', async () => {
    const arm = inputEchoAdapter();
    const model = new ScriptedModel('m1', 'fake-1', () => 'Blue Bottle');
    const report = await runBenchmark({
      areas: [AREA],
      budgets: [1024],
      seeds: 1,
      models: [model],
      carto: stubCarto(),
      router: new StubRouter(),
      adapters: [arm],
    });
    const reps = new Set(report.detail.map((d) => d.representation));
    expect(reps).toEqual(new Set(['supercarto', 'geojson', 'none', 'rival-json']));
    const rival = report.detail.filter((d) => d.representation === 'rival-json');
    expect(rival.length).toBeGreaterThan(0);
    // The adapter arm is on the cost table, ordered after the built-ins.
    expect(report.tokenCost.map((t) => t.representation)).toEqual([
      'supercarto',
      'geojson',
      'none',
      'rival-json',
    ]);

    // The subject saw the adapter's text as its map context.
    const shown = model.seen.filter((s) => s.startsWith('Rival map: '));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown[0]).toContain('Blue Bottle');
  });

  it('gives an adapter the raw inputs and never supercarto output', async () => {
    const arm = inputEchoAdapter();
    await runBenchmark({
      areas: [AREA],
      budgets: [1024],
      carto: stubCarto(),
      router: new StubRouter(),
      adapters: [arm],
    });
    expect(arm.hadFeatures.every(Boolean)).toBe(true);
    // One prepare per task, all at the single declared budget.
    expect(new Set(arm.sawBudgets)).toEqual(new Set([1024]));
  });

  it('sweeps every budget only when asked', async () => {
    const notSwept = inputEchoAdapter();
    await runBenchmark({
      areas: [AREA],
      budgets: [512, 1024],
      carto: stubCarto(),
      router: new StubRouter(),
      adapters: [notSwept],
    });
    // One pass, at the largest budget: a first rival run is cheap.
    expect(new Set(notSwept.sawBudgets)).toEqual(new Set([1024]));

    const swept = inputEchoAdapter();
    await runBenchmark({
      areas: [AREA],
      budgets: [512, 1024],
      carto: stubCarto(),
      router: new StubRouter(),
      adapters: [swept],
      sweepAdapters: true,
    });
    expect(new Set(swept.sawBudgets)).toEqual(new Set([512, 1024]));
  });

  it('refuses an adapter that returns an empty context', async () => {
    const empty: AdapterArm = { name: 'empty-arm', prepare: () => ({ text: '' }) };
    await expect(
      runBenchmark({
        areas: [AREA],
        budgets: [1024],
        carto: stubCarto(),
        router: new StubRouter(),
        adapters: [empty],
      }),
    ).rejects.toThrow(/returned no context/);
  });

  it('cannot shadow a built-in arm id silently', async () => {
    // A rival arm named `geojson` would replace the honest baseline in the
    // summary tables without changing any score row - the worst kind of rig.
    const impostor: AdapterArm = { name: 'supercarto', prepare: () => ({ text: 'fake' }) };
    await expect(
      runBenchmark({
        areas: [AREA],
        budgets: [1024],
        carto: stubCarto(),
        router: new StubRouter(),
        adapters: [impostor],
      }),
    ).rejects.toThrow(/duplicate arm|already|built-in/);
  });

  it('loads adapter modules from a path and rejects shapeless ones', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'adapter-'));
    const ok = join(dir, 'ok.mjs');
    writeFileSync(ok, 'export default { name: "shoehorn", prepare: () => ({ text: "x" }) };');
    const loaded = await loadAdapters([ok]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.name).toBe('shoehorn');
    expect(isAdapterArm(loaded[0])).toBe(true);

    const bad = join(dir, 'bad.mjs');
    writeFileSync(bad, 'export default { name: "", prepare: () => ({ text: "x" }) };');
    await expect(loadAdapters([bad])).rejects.toThrow(/expected a default export/);
  });
});
