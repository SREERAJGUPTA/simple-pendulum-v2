import { validateParameters } from './physics.js';
const storageKey = () => `time-in-motion:observations:v1:${typeof location === 'undefined' ? '/' : new URL('.', location.href).pathname}`;
export function loadTrials() {
    try {
        const raw = localStorage.getItem(storageKey());
        if (!raw)
            return { rows: [], warning: '' };
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1 || !Array.isArray(parsed.rows))
            throw new Error('format');
        const ids = new Set();
        const rows = parsed.rows.slice(-50).filter((row) => {
            try {
                validateParameters(row);
                const valid = typeof row.id === 'string' && row.id.length > 0 && row.id.length < 100 && !ids.has(row.id) && Number.isFinite(row.period)
                    && row.period > 0 && Number.isFinite(row.elapsed) && row.elapsed > 0
                    && Number.isFinite(row.period ** 2) && [1, 5, 10, 20].includes(row.cycles)
                    && Math.abs(row.period * row.cycles - row.elapsed) <= 1e-8 * Math.max(1, row.elapsed);
                if (valid)
                    ids.add(row.id);
                return valid;
            }
            catch {
                return false;
            }
        });
        return { rows, warning: rows.length !== parsed.rows.length ? 'Some saved observations could not be read. Valid rows were kept.' : '' };
    }
    catch {
        return { rows: [], warning: 'Saved observations are unavailable in this browser. You can still record and export this session.' };
    }
}
export function saveTrials(rows) {
    try {
        localStorage.setItem(storageKey(), JSON.stringify({ version: 1, rows: rows.slice(-50) }));
        return true;
    }
    catch {
        return false;
    }
}
export function trialsCsv(rows) {
    const lines = ['trial,length_m,gravity_m_s2,damping_s-1,mass_kg,release_angle_deg,cycles,elapsed_simulated_s,period_s,period_squared_s2'];
    rows.forEach((row, i) => lines.push([i + 1, row.length.toFixed(3), row.gravity.toFixed(3), row.damping.toFixed(3), row.mass.toFixed(3), row.releaseAngle.toFixed(2), row.cycles, row.elapsed.toFixed(6), row.period.toFixed(6), (row.period ** 2).toFixed(6)].join(',')));
    return lines.join('\r\n') + '\r\n';
}
export function downloadText(filename, content, type = 'text/csv;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
