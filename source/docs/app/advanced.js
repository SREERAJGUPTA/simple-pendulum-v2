import { validateParameters } from './physics.js';
/** Analytic linearized solution, from rest. This is a comparison, not the live solver. */
export function linearReference(p, t) {
    validateParameters(p);
    if (!Number.isFinite(t) || t < 0)
        throw new RangeError('Time must be finite and nonnegative.');
    const a = p.releaseAngle * Math.PI / 180, k = p.gravity / p.length, b = p.damping / 2;
    const discriminant = k - b * b;
    if (Math.abs(discriminant) < 1e-12)
        return { theta: a * (1 + b * t) * Math.exp(-b * t), omega: -a * b * b * t * Math.exp(-b * t) };
    if (discriminant > 0) {
        const w = Math.sqrt(discriminant), e = Math.exp(-b * t);
        return { theta: a * e * (Math.cos(w * t) + b / w * Math.sin(w * t)), omega: -a * e * k / w * Math.sin(w * t) };
    }
    const d = Math.sqrt(-discriminant), r1 = -b + d, r2 = -b - d;
    const c1 = -a * r2 / (r1 - r2), c2 = a * r1 / (r1 - r2);
    return { theta: c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t), omega: c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t) };
}
export function mechanics(s, p) {
    const alpha = -p.gravity / p.length * Math.sin(s.theta) - p.damping * s.omega;
    return { alpha, arc: p.length * s.theta, velocity: p.length * s.omega,
        tangential: p.length * alpha, radial: p.length * s.omega * s.omega,
        tension: p.mass * (p.gravity * Math.cos(s.theta) + p.length * s.omega * s.omega),
        weight: p.mass * p.gravity, restoring: -p.mass * p.gravity * Math.sin(s.theta),
        torque: -p.mass * p.gravity * p.length * Math.sin(s.theta),
        drag: -p.damping * p.mass * p.length * s.omega,
        natural: Math.sqrt(p.gravity / p.length), zeta: p.damping / (2 * Math.sqrt(p.gravity / p.length)) };
}
export function regression(points) {
    if (points.length < 3 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
        return null;
    const n = points.length, xm = points.reduce((a, p) => a + p.x, 0) / n, ym = points.reduce((a, p) => a + p.y, 0) / n;
    const xx = points.reduce((a, p) => a + (p.x - xm) ** 2, 0);
    if (xx < 1e-16)
        return null;
    const slope = points.reduce((a, p) => a + (p.x - xm) * (p.y - ym), 0) / xx, intercept = ym - slope * xm;
    const residual = points.reduce((a, p) => a + (p.y - slope * p.x - intercept) ** 2, 0);
    const total = points.reduce((a, p) => a + (p.y - ym) ** 2, 0);
    return { slope, intercept, rSquared: total > 0 ? 1 - residual / total : 1 };
}
/** First-order worst-case bound, not an RSS/statistical confidence interval. */
export function gravityUncertainty(length, elapsed, cycles, deltaLength, deltaTime) {
    if (![length, elapsed, cycles, deltaLength, deltaTime].every(Number.isFinite) || length <= 0 || elapsed <= 0 || !Number.isInteger(cycles) || cycles < 1 || deltaLength < 0 || deltaTime < 0 || deltaLength >= length || deltaTime >= elapsed)
        return null;
    const period = elapsed / cycles, g = 4 * Math.PI ** 2 * length / period ** 2;
    const relative = deltaLength / length + 2 * deltaTime / elapsed;
    const minimum = 4 * Math.PI ** 2 * (length - deltaLength) / ((elapsed + deltaTime) / cycles) ** 2;
    const maximum = 4 * Math.PI ** 2 * (length + deltaLength) / ((elapsed - deltaTime) / cycles) ** 2;
    return { period, g, relative, delta: g * relative, minimum, maximum };
}
/** Constant electric field; y is upward. Used only by the separate bridge calculator. */
export function electricPendulum(mass, charge, ex, ey, length, g = 9.81) {
    if (![mass, charge, ex, ey, length, g].every(Number.isFinite) || mass <= 0 || length <= 0 || g < 0)
        return null;
    const gx = charge * ex / mass, gy = g - charge * ey / mass, effective = Math.hypot(gx, gy);
    if (effective < 1e-10)
        return { effective: 0, angle: null, period: null };
    return { effective, angle: Math.atan2(gx, gy) * 180 / Math.PI, period: 2 * Math.PI * Math.sqrt(length / effective) };
}
/** Displacement / static displacement for the LINEAR steady-state driven oscillator. */
export function response(r, zeta) {
    if (!Number.isFinite(r) || !Number.isFinite(zeta) || r < 0 || zeta <= 0)
        throw new RangeError('A finite nonnegative frequency ratio and positive damping are required.');
    const magnitude = 1 / Math.hypot(1 - r * r, 2 * zeta * r);
    return { magnitude, phase: Math.atan2(2 * zeta * r, 1 - r * r), peak: zeta < Math.SQRT1_2 ? Math.sqrt(1 - 2 * zeta * zeta) : null };
}
