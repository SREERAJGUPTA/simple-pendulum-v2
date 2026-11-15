import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTrials, saveTrials, trialsCsv, type Trial } from '../src/records';

class MemoryStorage {
  readonly entries = new Map<string, string>();
  getItem(key: string): string | null { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string): void { this.entries.set(key, value); }
}

function trial(overrides: Partial<Trial> = {}): Trial {
  return {
    id: 'trial-one', length: 1.25, gravity: 3.71, damping: 0.2,
    mass: 0.75, releaseAngle: -7.5, cycles: 5, period: 2.125, elapsed: 10.625,
    ...overrides,
  };
}

let storage: MemoryStorage;
const firstScope = 'https://example.test/Pendulum-v2/';
const key = 'time-in-motion:observations:v1:/Pendulum-v2/';

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('location', { href: firstScope });
});

afterEach(() => vi.unstubAllGlobals());

describe('observation persistence', () => {
  it('round-trips full trial conditions and unrounded measurements without changing the input', () => {
    const period = 2.012345678901234;
    const rows = [trial({ period, elapsed: period * 5 })];
    const before = structuredClone(rows);
    expect(loadTrials()).toEqual({ rows: [], warning: '' });
    expect(saveTrials(rows)).toBe(true);
    expect(loadTrials()).toEqual({ rows, warning: '' });
    expect(rows).toEqual(before);
    expect(storage.entries.has(key)).toBe(true);
  });

  it('keeps deployment paths separate while hashes and index.html retain the same notebook', () => {
    const first = trial({ id: 'first-scope' });
    expect(saveTrials([first])).toBe(true);
    vi.stubGlobal('location', { href: `${firstScope}#notebook` });
    expect(loadTrials().rows).toEqual([first]);
    vi.stubGlobal('location', { href: `${firstScope}index.html?view=lab#notebook` });
    expect(loadTrials().rows).toEqual([first]);

    vi.stubGlobal('location', { href: 'https://example.test/Another-Pendulum/' });
    expect(loadTrials()).toEqual({ rows: [], warning: '' });
    const second = trial({ id: 'second-scope', length: 2 });
    expect(saveTrials([second])).toBe(true);
    expect(loadTrials().rows).toEqual([second]);

    vi.stubGlobal('location', { href: firstScope });
    expect(loadTrials().rows).toEqual([first]);
    expect(storage.entries.size).toBe(2);
  });

  it('keeps the newest 50 observations in order without mutating the caller array', () => {
    const rows = Array.from({ length: 55 }, (_, i) => trial({ id: `trial-${i}` }));
    expect(saveTrials(rows)).toBe(true);
    const result = loadTrials();
    expect(result.rows).toEqual(rows.slice(5));
    expect(result.warning).toBe('');
    expect(rows).toHaveLength(55);
  });

  it('recovers from corrupt JSON and unsupported or missing record schemas', () => {
    for (const raw of ['{', 'null', '[]', '{}', '{"version":2,"rows":[]}', '{"version":1,"rows":null}']) {
      storage.setItem(key, raw);
      const result = loadTrials();
      expect(result.rows).toEqual([]);
      expect(result.warning.length).toBeGreaterThan(0);
    }
  });

  it('rejects inconsistent elapsed time, invalid physics and nonfinite squared periods but keeps valid neighbours', () => {
    const valid = trial();
    const rows = [
      valid,
      trial({ id: 'contradictory', cycles: 1, elapsed: 10, period: 2 }),
      trial({ id: 'bad-length', length: 0 }),
      trial({ id: 'bad-angle', releaseAngle: 81 }),
      trial({ id: 'bad-cycle-count', cycles: 3, elapsed: 6.375 }),
      trial({ id: 'square-overflow', cycles: 1, period: 1e200, elapsed: 1e200 }),
      trial({ id: 'nonfinite-period', period: NaN }),
      { ...trial({ id: 'missing-condition' }), gravity: undefined },
      null,
    ];
    storage.setItem(key, JSON.stringify({ version: 1, rows }));
    const result = loadTrials();
    expect(result.rows).toEqual([valid]);
    expect(result.warning.length).toBeGreaterThan(0);
  });

  it('rejects empty and duplicated IDs without throwing away distinct valid trials', () => {
    const first = trial({ id: 'same-id' });
    const another = trial({ id: 'another-id', length: 2 });
    storage.setItem(key, JSON.stringify({ version: 1, rows: [
      first, trial({ id: 'same-id', length: 1.5 }), trial({ id: '' }), trial({ id: 'x'.repeat(100) }), another,
    ] }));
    const result = loadTrials();
    expect(result.rows).toEqual([first, another]);
    expect(result.warning.length).toBeGreaterThan(0);
  });

  it('accepts harmless floating-point rounding in an otherwise consistent observation', () => {
    const period = 2.0060666807106475;
    const row = trial({ period, elapsed: period * 5 + Number.EPSILON * 16 });
    storage.setItem(key, JSON.stringify({ version: 1, rows: [row] }));
    expect(loadTrials()).toEqual({ rows: [row], warning: '' });
  });

  it('reports blocked reads and quota failures while leaving the session data exportable', () => {
    const rows = [trial()];
    vi.stubGlobal('localStorage', {
      getItem() { throw new DOMException('Storage denied', 'SecurityError'); },
      setItem() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
    });
    const result = loadTrials();
    expect(result.rows).toEqual([]);
    expect(result.warning.length).toBeGreaterThan(0);
    expect(saveTrials(rows)).toBe(false);
    expect(rows).toEqual([trial()]);
    expect(trialsCsv(rows)).toContain('10.625000,2.125000,4.515625');
  });
});

describe('observation CSV', () => {
  const header = 'trial,length_m,gravity_m_s2,damping_s-1,mass_kg,release_angle_deg,cycles,elapsed_simulated_s,period_s,period_squared_s2';

  it('exports explicit SI-unit columns, signed release angle and independently checked T²', () => {
    const rows = [trial({ id: '=HYPERLINK("example")' })];
    const before = structuredClone(rows);
    const csv = trialsCsv(rows);
    expect(csv).toBe(`${header}\r\n1,1.250,3.710,0.200,0.750,-7.50,5,10.625000,2.125000,4.515625\r\n`);
    expect(csv).not.toContain('HYPERLINK'); // IDs and other strings never enter numeric CSV cells.
    expect(rows).toEqual(before);
  });

  it('produces a valid header-only export for an empty notebook', () => {
    expect(trialsCsv([])).toBe(`${header}\r\n`);
  });
});
