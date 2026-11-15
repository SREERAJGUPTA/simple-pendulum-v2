/**
 * Simple Pendulum — Time in Motion
 *
 * Model: a point mass on a massless, inextensible suspension in one vertical
 * plane, with a fixed pivot, uniform gravity and optional linear damping.
 * θ is measured from the downward vertical; positive θ moves the bob right.
 * Internally use metres, seconds, kilograms, radians and joules.
 *
 * θ̇ = ω;  ω̇ = −(g/L) sin θ − γω
 * Q̇ = γ m L² ω²   (energy transferred to the surroundings)
 *
 * A caller advances simulated time, independently of rendering/playback rate.
 * Changing parameters or placing the bob begins a new energy experiment.
 */

export interface PendulumParameters {
  /** Pivot to bob centre, in metres. */
  length: number;
  /** Uniform gravitational acceleration, in m/s². */
  gravity: number;
  /** Angular-velocity damping coefficient γ, in s⁻¹. */
  damping: number;
  /** Point mass, in kg. */
  mass: number;
  /** Release from rest, in degrees. */
  releaseAngle: number;
}

export interface PendulumState {
  theta: number;
  omega: number;
  time: number;
  heat: number;
}

export interface PendulumEnergy {
  kinetic: number;
  potential: number;
  mechanical: number;
  heat: number;
  total: number;
}

export interface GravityFit {
  /** Least-squares slope of T² versus L, in s²/m. */
  slope: number;
  /** Free fitted intercept in s²; the fit is not forced through the origin. */
  intercept: number;
  rSquared: number;
  /** Inference 4π² / slope, valid for small-angle, undamped, fixed-g trials. */
  gravity: number;
}

export const DT = 1 / 240;

export const DEFAULT_PARAMETERS: Readonly<PendulumParameters> = Object.freeze({
  length: 1.2,
  gravity: 9.81,
  damping: 0,
  mass: 0.5,
  releaseAngle: 30,
});

const PARAMETER_BOUNDS: Record<keyof PendulumParameters, readonly [number, number]> = {
  length: [0.25, 2.5],
  gravity: [0.5, 25],
  damping: [0, 1],
  mass: [0.1, 2],
  releaseAngle: [-80, 80],
};

/** Reject invalid values rather than silently converting/clamping a trial. */
export function validateParameters(parameters: PendulumParameters): PendulumParameters {
  if (!parameters || typeof parameters !== 'object') {
    throw new RangeError('Pendulum parameters must be an object.');
  }
  for (const key of Object.keys(PARAMETER_BOUNDS) as (keyof PendulumParameters)[]) {
    const value = parameters[key];
    const [minimum, maximum] = PARAMETER_BOUNDS[key];
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new RangeError(`${key} must be finite and between ${minimum} and ${maximum}.`);
    }
  }
  return { ...parameters };
}

function validateState(state: PendulumState): void {
  if (!state || !Number.isFinite(state.theta) || !Number.isFinite(state.omega)
    || !Number.isFinite(state.time) || !Number.isFinite(state.heat)
    || state.time < 0 || state.heat < 0) {
    throw new RangeError('Pendulum state must be finite, with nonnegative time and dissipated energy.');
  }
}

function validateAmplitude(angle: number): void {
  if (!Number.isFinite(angle) || Math.abs(angle) > 80) {
    throw new RangeError('Release angle must be finite and within −80° to +80°.');
  }
}

export function initialState(
  parameters: PendulumParameters,
  angleDegrees = parameters.releaseAngle,
): PendulumState {
  validateParameters(parameters);
  validateAmplitude(angleDegrees);
  return { theta: angleDegrees * Math.PI / 180, omega: 0, time: 0, heat: 0 };
}

/**
 * A pure, coupled fourth-order Runge–Kutta step. The heat integral uses the
 * very same RK stages, rather than being manufactured from energy residuals.
 * The app normally calls this at DT; smaller steps support convergence checks.
 */
export function advance(
  state: PendulumState,
  parameters: PendulumParameters,
  dt = DT,
): PendulumState {
  validateParameters(parameters);
  validateState(state);
  if (!Number.isFinite(dt) || dt <= 0 || dt > 1 / 30) {
    throw new RangeError('Integration step must be finite, positive and no larger than 1/30 s.');
  }

  const restoring = parameters.gravity / parameters.length;
  const lossFactor = parameters.damping * parameters.mass * parameters.length ** 2;
  const acceleration = (theta: number, omega: number) =>
    -restoring * Math.sin(theta) - parameters.damping * omega;

  const a1 = state.omega;
  const b1 = acceleration(state.theta, state.omega);
  const q1 = lossFactor * state.omega ** 2;

  const theta2 = state.theta + dt * a1 / 2;
  const omega2 = state.omega + dt * b1 / 2;
  const a2 = omega2;
  const b2 = acceleration(theta2, omega2);
  const q2 = lossFactor * omega2 ** 2;

  const theta3 = state.theta + dt * a2 / 2;
  const omega3 = state.omega + dt * b2 / 2;
  const a3 = omega3;
  const b3 = acceleration(theta3, omega3);
  const q3 = lossFactor * omega3 ** 2;

  const theta4 = state.theta + dt * a3;
  const omega4 = state.omega + dt * b3;
  const a4 = omega4;
  const b4 = acceleration(theta4, omega4);
  const q4 = lossFactor * omega4 ** 2;

  const result = {
    theta: state.theta + dt * (a1 + 2 * a2 + 2 * a3 + a4) / 6,
    omega: state.omega + dt * (b1 + 2 * b2 + 2 * b3 + b4) / 6,
    time: state.time + dt,
    heat: state.heat + dt * (q1 + 2 * q2 + 2 * q3 + q4) / 6,
  };
  validateState(result);
  return result;
}

/** Potential energy is zero at the lowest position. */
export function energy(state: PendulumState, parameters: PendulumParameters): PendulumEnergy {
  validateParameters(parameters);
  validateState(state);
  const kinetic = 0.5 * parameters.mass * (parameters.length * state.omega) ** 2;
  // This form avoids subtracting nearly equal values at very small angles.
  const potential = 2 * parameters.mass * parameters.gravity * parameters.length
    * Math.sin(state.theta / 2) ** 2;
  const mechanical = kinetic + potential;
  return { kinetic, potential, mechanical, heat: state.heat, total: mechanical + state.heat };
}

/** Undamped small-amplitude limiting period; zero amplitude itself has no crossings. */
export function smallAnglePeriod(parameters: PendulumParameters): number {
  validateParameters(parameters);
  return 2 * Math.PI * Math.sqrt(parameters.length / parameters.gravity);
}

/**
 * Undamped finite-amplitude period, not a damped-cycle prediction.
 * T = 4√(L/g)K(sin(|θ₀|/2)) = 2π√(L/g) / AGM(1, cos(θ₀/2)).
 * At θ₀ = 0 this returns the limiting period, not an observed oscillation.
 */
export function nonlinearPeriod(
  parameters: PendulumParameters,
  amplitudeDegrees = parameters.releaseAngle,
): number {
  validateParameters(parameters);
  validateAmplitude(amplitudeDegrees);
  let arithmetic = 1;
  let geometric = Math.cos(amplitudeDegrees * Math.PI / 360);
  for (let i = 0; i < 12 && Math.abs(arithmetic - geometric) > 2 * Number.EPSILON; i++) {
    const nextArithmetic = (arithmetic + geometric) / 2;
    const nextGeometric = Math.sqrt(arithmetic * geometric);
    arithmetic = nextArithmetic;
    geometric = nextGeometric;
  }
  return 2 * Math.PI * Math.sqrt(parameters.length / parameters.gravity) / arithmetic;
}

/**
 * Measure complete cycles from successive negative-to-positive centre crossings.
 * The first crossing arms the clock; it is not counted as a complete cycle.
 * Event time is linearly interpolated within a numerical integration step.
 * Keep the most recent 128 periods while retaining the total cycle count.
 * Call reset() after any new release or physical-parameter change.
 */
export class PeriodTracker {
  private lastCrossing: number | null = null;
  private measuredPeriods: number[] = [];
  private completedCycles = 0;

  get periods(): number[] {
    return [...this.measuredPeriods];
  }

  get count(): number {
    return this.completedCycles;
  }

  reset(): void {
    this.lastCrossing = null;
    this.measuredPeriods = [];
    this.completedCycles = 0;
  }

  update(previous: PendulumState, next: PendulumState): number | null {
    validateState(previous);
    validateState(next);
    if (next.time <= previous.time || previous.theta > 0 || next.theta <= 0) return null;

    const fraction = -previous.theta / (next.theta - previous.theta);
    const crossingTime = previous.time + fraction * (next.time - previous.time);
    if (this.lastCrossing === null) {
      this.lastCrossing = crossingTime;
      return null;
    }
    // Replaying an already-consumed sample must not duplicate a period.
    if (crossingTime <= this.lastCrossing) return null;

    const period = crossingTime - this.lastCrossing;
    this.lastCrossing = crossingTime;
    this.measuredPeriods.push(period);
    if (this.measuredPeriods.length > 128) this.measuredPeriods.shift();
    this.completedCycles++;
    return period;
  }
}

/**
 * Ordinary least squares of measured T² against measured L.
 * This function never supplies synthetic observations. The caller must group
 * trials with the same gravity and small amplitude, and zero damping, before
 * interpreting the slope as g. Return null for an indeterminate/invalid fit.
 */
export function fitGravity(records: { length: number; period: number }[]): GravityFit | null {
  if (records.length < 2 || records.some(({ length, period }) =>
    !Number.isFinite(length) || length <= 0 || !Number.isFinite(period) || period <= 0)) return null;

  const n = records.length;
  const meanLength = records.reduce((sum, record) => sum + record.length, 0) / n;
  const meanPeriodSquared = records.reduce((sum, record) => sum + record.period ** 2, 0) / n;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const record of records) {
    const x = record.length - meanLength;
    const y = record.period ** 2 - meanPeriodSquared;
    xx += x * x;
    xy += x * y;
    yy += y * y;
  }
  if (!Number.isFinite(xx) || !Number.isFinite(xy) || !Number.isFinite(yy)
    || xx <= Number.EPSILON * Math.max(1, meanLength ** 2) || yy <= 0 || xy <= 0) return null;

  const slope = xy / xx;
  const intercept = meanPeriodSquared - slope * meanLength;
  const rSquared = Math.max(0, Math.min(1, xy ** 2 / (xx * yy)));
  const gravity = 4 * Math.PI ** 2 / slope;
  if (![slope, intercept, rSquared, gravity].every(Number.isFinite)) return null;
  return { slope, intercept, rSquared, gravity };
}
