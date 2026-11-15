import { describe, expect, it } from 'vitest';
import {
  advance, DEFAULT_PARAMETERS, DT, energy, fitGravity, initialState,
  nonlinearPeriod, PeriodTracker, smallAnglePeriod, validateParameters,
  type PendulumParameters, type PendulumState,
} from '../src/physics';

const parameters = (overrides: Partial<PendulumParameters> = {}): PendulumParameters =>
  ({ ...DEFAULT_PARAMETERS, ...overrides });

function evolve(p: PendulumParameters, seconds: number, dt = DT): PendulumState {
  let state = initialState(p);
  for (let step = 0; step < Math.round(seconds / dt); step++) state = advance(state, p, dt);
  return state;
}

function observedPeriods(p: PendulumParameters, count: number, dt = DT): number[] {
  let state = initialState(p);
  const tracker = new PeriodTracker();
  for (let step = 0; step < 200_000 && tracker.count < count; step++) {
    const next = advance(state, p, dt);
    tracker.update(state, next);
    state = next;
  }
  expect(tracker.count).toBe(count);
  return tracker.periods;
}

/** Independent composite Simpson quadrature: not the production AGM method. */
function periodByQuadrature(length: number, gravity: number, amplitudeDegrees: number): number {
  const kSquared = Math.sin(amplitudeDegrees * Math.PI / 360) ** 2;
  const panels = 4096;
  const h = (Math.PI / 2) / panels;
  const integrand = (phi: number) => 1 / Math.sqrt(1 - kSquared * Math.sin(phi) ** 2);
  let sum = integrand(0) + integrand(Math.PI / 2);
  for (let i = 1; i < panels; i++) sum += (i % 2 === 0 ? 2 : 4) * integrand(i * h);
  return 4 * Math.sqrt(length / gravity) * sum * h / 3;
}

describe('the declared model and domain', () => {
  it('rejects NaN, infinity, missing values and out-of-domain parameters', () => {
    for (const key of Object.keys(DEFAULT_PARAMETERS) as (keyof PendulumParameters)[]) {
      for (const invalid of [NaN, Infinity, -Infinity, undefined]) {
        expect(() => validateParameters({ ...parameters(), [key]: invalid } as PendulumParameters)).toThrow();
      }
    }
    for (const patch of [{ length: 0 }, { gravity: 0 }, { mass: -1 }, { damping: -0.01 },
      { damping: 1.001 }, { releaseAngle: 80.001 }, { releaseAngle: -80.001 }]) {
      expect(() => validateParameters(parameters(patch))).toThrow();
    }
    expect(validateParameters(parameters({ length: 0.25, gravity: 0.5, mass: 0.1, damping: 1, releaseAngle: -80 })))
      .toMatchObject({ length: 0.25, gravity: 0.5, mass: 0.1, damping: 1, releaseAngle: -80 });
  });

  it('starts at rest; restores toward the downward vertical; does not mutate inputs', () => {
    const p = parameters({ releaseAngle: 30 });
    const state = initialState(p);
    expect(state.theta).toBeCloseTo(Math.PI / 6, 14);
    expect(state).toMatchObject({ omega: 0, time: 0, heat: 0 });
    const next = advance(state, p);
    expect(next.omega).toBeLessThan(0);
    expect(next.theta).toBeLessThan(state.theta);
    expect(state).toEqual(initialState(p));
    expect(next.time).toBe(DT);
    expect(() => initialState(p, NaN)).toThrow();
    expect(() => advance({ ...state, omega: NaN }, p)).toThrow();
    for (const invalidStep of [0, -DT, NaN, Infinity, 0.1]) {
      expect(() => advance(state, p, invalidStep)).toThrow();
    }
  });

  it('keeps exact equilibrium stationary without inventing measured periods', () => {
    const p = parameters({ releaseAngle: 0, damping: 1 });
    let state = initialState(p);
    const tracker = new PeriodTracker();
    for (let i = 0; i < 1000; i++) {
      const next = advance(state, p);
      expect(tracker.update(state, next)).toBeNull();
      state = next;
    }
    expect(state.theta).toBe(0);
    expect(state.omega).toBe(0);
    expect(energy(state, p).total).toBe(0);
    expect(tracker.count).toBe(0);
  });
});

describe('period reference checks', () => {
  it('matches the hand-derived 1 m Earth small-angle period and a tiny-amplitude observation', () => {
    const p = parameters({ length: 1, gravity: 9.81, releaseAngle: 0.001 });
    const reference = 2.0060666807106475;
    expect(smallAnglePeriod(p)).toBeCloseTo(reference, 13);
    for (const observed of observedPeriods(p, 4)) expect(Math.abs(observed - reference)).toBeLessThan(2e-7);
  });

  it.each([5, 30, 60, 80])('matches independent finite-angle quadrature at %s°', (amplitude) => {
    const p = parameters({ length: 1, gravity: 9.81, releaseAngle: amplitude });
    const reference = periodByQuadrature(1, 9.81, amplitude);
    expect(Math.abs(nonlinearPeriod(p) - reference)).toBeLessThan(2e-12);
    for (const observed of observedPeriods(p, 3)) expect(Math.abs(observed - reference)).toBeLessThan(5e-7);
    expect(nonlinearPeriod(p, -amplitude)).toBe(nonlinearPeriod(p, amplitude));
  });

  it('makes large-amplitude cycles longer, with the correct small-amplitude limit', () => {
    const p = parameters();
    expect(nonlinearPeriod(p, 0)).toBe(smallAnglePeriod(p));
    expect(nonlinearPeriod(p, 60) / smallAnglePeriod(p)).toBeCloseTo(1.073182007149364, 12);
    expect(nonlinearPeriod(p, 80)).toBeGreaterThan(nonlinearPeriod(p, 60));
  });

  it('preserves the square-root length and gravity scaling', () => {
    const earthShort = parameters({ length: 0.5, gravity: 9.81, releaseAngle: 10 });
    const earthLong = parameters({ length: 2, gravity: 9.81, releaseAngle: 10 });
    const lowGravity = parameters({ length: 0.5, gravity: 9.81 / 4, releaseAngle: 10 });
    const shortPeriod = observedPeriods(earthShort, 1)[0];
    expect(observedPeriods(earthLong, 1)[0] / shortPeriod).toBeCloseTo(2, 6);
    expect(observedPeriods(lowGravity, 1)[0] / shortPeriod).toBeCloseTo(2, 6);
  });

  it('does not invent cycles for the allowed low-gravity overdamped case', () => {
    const p = parameters({ length: 2.5, gravity: 0.5, releaseAngle: 10, damping: 1 });
    let state = initialState(p);
    const tracker = new PeriodTracker();
    for (let i = 0; i < 120 / DT; i++) {
      const next = advance(state, p);
      tracker.update(state, next);
      state = next;
      expect(state.theta).toBeGreaterThanOrEqual(0);
    }
    expect(state.theta).toBeLessThan(1e-12);
    expect(tracker.count).toBe(0);
    expect(tracker.periods).toEqual([]);
  });
});

describe('energy and numerical integration', () => {
  it('uses pivot-to-centre length and a bottom-zero potential reference', () => {
    const p = parameters({ length: 2, gravity: 10, mass: 0.5, releaseAngle: 60 });
    expect(energy(initialState(p), p).potential).toBeCloseTo(5, 13);
    expect(energy({ theta: 0, omega: 3, time: 1, heat: 2 }, p))
      .toEqual({ kinetic: 9, potential: 0, mechanical: 9, heat: 2, total: 11 });
    expect(energy(initialState(p, 1e-8), p).potential).toBeGreaterThan(0);
  });

  it('conserves undamped mechanical energy over 120 simulated seconds at the fastest setting', () => {
    const p = parameters({ length: 0.25, gravity: 25, releaseAngle: 80, damping: 0 });
    let state = initialState(p);
    const start = energy(state, p).mechanical;
    let maxRelativeDrift = 0;
    for (let i = 0; i < 120 / DT; i++) {
      state = advance(state, p);
      maxRelativeDrift = Math.max(maxRelativeDrift, Math.abs(energy(state, p).mechanical / start - 1));
    }
    expect(maxRelativeDrift).toBeLessThan(2e-6);
    expect(state.heat).toBe(0);
  });

  it('transfers mechanical energy into independently integrated dissipated energy', () => {
    const p = parameters({ length: 0.25, gravity: 25, releaseAngle: 80, damping: 0.45 });
    let state = initialState(p);
    const start = energy(state, p).total;
    let priorMechanical = start;
    let priorHeat = 0;
    let maxBalanceError = 0;
    for (let i = 0; i < 30 / DT; i++) {
      state = advance(state, p);
      const e = energy(state, p);
      expect(e.heat).toBeGreaterThanOrEqual(priorHeat);
      expect(e.mechanical).toBeLessThanOrEqual(priorMechanical + 1e-10);
      maxBalanceError = Math.max(maxBalanceError, Math.abs(e.total / start - 1));
      priorMechanical = e.mechanical;
      priorHeat = e.heat;
    }
    expect(maxBalanceError).toBeLessThan(2e-7);
    expect(priorHeat / start).toBeGreaterThan(0.999);
  });

  it('converges under timestep halving against an independently analytic linear limit', () => {
    const p = parameters({ length: 0.25, gravity: 25, releaseAngle: 0.000001, damping: 0 });
    const seconds = 0.9;
    const amplitude = p.releaseAngle * Math.PI / 180;
    const referenceTheta = amplitude * Math.cos(10 * seconds);
    const referenceOmega = -amplitude * 10 * Math.sin(10 * seconds);
    const error = (dt: number) => {
      const state = evolve(p, seconds, dt);
      return Math.hypot(state.theta - referenceTheta, (state.omega - referenceOmega) / 10) / amplitude;
    };
    const coarse = error(1 / 60);
    const fine = error(1 / 120);
    const finer = error(1 / 240);
    expect(coarse / fine).toBeGreaterThan(14);
    expect(fine / finer).toBeGreaterThan(14);
    expect(finer).toBeLessThan(3e-7);
  });

  it('agrees with the damped small-angle analytic solution using this γ convention', () => {
    const p = parameters({ length: 1, gravity: 9.81, releaseAngle: 0.00001, damping: 0.6 });
    const seconds = 5;
    const a = p.releaseAngle * Math.PI / 180;
    const decay = p.damping / 2;
    const frequency = Math.sqrt(p.gravity / p.length - decay ** 2);
    const expectedTheta = a * Math.exp(-decay * seconds)
      * (Math.cos(frequency * seconds) + decay / frequency * Math.sin(frequency * seconds));
    const state = evolve(p, seconds);
    expect(Math.abs(state.theta - expectedTheta) / a).toBeLessThan(2e-8);
  });

  it('makes dynamics independent of mass at fixed γ while energy scales with mass', () => {
    const light = parameters({ mass: 0.25, damping: 0.1 });
    const heavy = parameters({ mass: 1, damping: 0.1 });
    const lightState = evolve(light, 3);
    const heavyState = evolve(heavy, 3);
    expect(heavyState.theta).toBe(lightState.theta);
    expect(heavyState.omega).toBe(lightState.omega);
    expect(energy(heavyState, heavy).mechanical / energy(lightState, light).mechanical).toBeCloseTo(4, 12);
    expect(heavyState.heat / lightState.heat).toBeCloseTo(4, 12);
  });

  it('produces identical simulated state regardless of playback/render batching', () => {
    const p = parameters({ damping: 0.2 });
    const batch = (counts: number[]) => {
      let state = initialState(p);
      for (const count of counts) for (let i = 0; i < count; i++) state = advance(state, p);
      return state;
    };
    expect(batch(Array(240).fill(1))).toEqual(batch(Array(60).fill(4)));
    expect(batch(Array(240).fill(1))).toEqual(batch(Array(20).fill(12)));
  });
});

describe('measurement integrity', () => {
  it('interpolates same-direction crossings and excludes half-cycles and duplicate samples', () => {
    const tracker = new PeriodTracker();
    const sample = (theta: number, time: number): PendulumState => ({ theta, omega: 1, time, heat: 0 });
    const before = sample(-0.03, 0.9);
    const after = sample(0.01, 1.1); // crossing = 1.05
    expect(tracker.update(before, after)).toBeNull();
    expect(tracker.count).toBe(0);
    expect(tracker.update(sample(0.01, 1.9), sample(-0.01, 2.1))).toBeNull();
    expect(tracker.update(sample(-0.01, 2.9), sample(0.03, 3.1))).toBeCloseTo(1.9, 13);
    expect(tracker.count).toBe(1);
    expect(tracker.update(sample(-0.01, 2.9), sample(0.03, 3.1))).toBeNull();
    const copy = tracker.periods;
    copy.push(99);
    expect(tracker.periods).toHaveLength(1);
    tracker.reset();
    expect(tracker.periods).toEqual([]);
    expect(tracker.count).toBe(0);
  });

  it('fits measured T² versus L with a free intercept and infers g from the slope', () => {
    const records = [0.5, 0.75, 1, 1.5, 2].map(length => ({ length, period: Math.sqrt(4 * length + 0.2) }));
    const result = fitGravity(records)!;
    expect(result.slope).toBeCloseTo(4, 13);
    expect(result.intercept).toBeCloseTo(0.2, 13);
    expect(result.rSquared).toBeCloseTo(1, 13);
    expect(result.gravity).toBeCloseTo(Math.PI ** 2, 13);
    expect(records[0].period).toBe(Math.sqrt(2.2));
  });

  it('refuses insufficient, singular, invalid and nonphysical fits', () => {
    expect(fitGravity([])).toBeNull();
    expect(fitGravity([{ length: 1, period: 2 }])).toBeNull();
    expect(fitGravity([{ length: 1, period: 2 }, { length: 1, period: 2.1 }])).toBeNull();
    expect(fitGravity([{ length: 1, period: 2 }, { length: 2, period: 1 }])).toBeNull();
    expect(fitGravity([{ length: 1, period: NaN }, { length: 2, period: 3 }])).toBeNull();
    expect(fitGravity([{ length: 1, period: 2 }, { length: 2, period: 2 }])).toBeNull();
  });
});
