import { useCallback, useEffect, useRef, useState } from '../vendor/react-runtime.js';
import { advance, DEFAULT_PARAMETERS, DT, energy, initialState, PeriodTracker, validateParameters } from './physics.js';
const idleMeasurement = (p) => ({
    id: '', status: 'idle', target: 5, periods: [], elapsed: 0, startTime: null, parameters: { ...p },
});
function sample(s, p) {
    const e = energy(s, p);
    return { time: s.time, theta: s.theta, omega: s.omega, ...e };
}
export function usePendulum(reducedMotion) {
    const [parameters, setParameters] = useState({ ...DEFAULT_PARAMETERS });
    const parametersRef = useRef(parameters);
    const stateRef = useRef(initialState(parameters));
    const [snapshot, setSnapshot] = useState({ ...stateRef.current });
    const [running, setRunningState] = useState(!reducedMotion);
    const runningRef = useRef(running);
    const [rate, setRateState] = useState(1);
    const rateRef = useRef(rate);
    const peaksRef = useRef([{ time: 0, amplitude: pInitial() }]);
    function pInitial() { return Math.abs(DEFAULT_PARAMETERS.releaseAngle); }
    const tracker = useRef(new PeriodTracker());
    const [periods, setPeriods] = useState([]);
    const samplesRef = useRef([sample(stateRef.current, parameters)]);
    const [samples, setSamples] = useState(samplesRef.current);
    const measurementRef = useRef(idleMeasurement(parameters));
    const [measurement, setMeasurement] = useState(measurementRef.current);
    const [notice, setNotice] = useState('Drag the bob, then let go. Or choose a release angle below.');
    const accumulator = useRef(0);
    const nextSample = useRef(1 / 30);
    const dragging = useRef(false);
    const setRunning = useCallback((value) => {
        runningRef.current = value;
        setRunningState(value);
        accumulator.current = 0;
    }, []);
    const publish = useCallback(() => {
        setSnapshot({ ...stateRef.current });
        setSamples([...samplesRef.current]);
        setPeriods(tracker.current.periods);
        setMeasurement({ ...measurementRef.current, periods: [...measurementRef.current.periods] });
    }, []);
    const reset = useCallback((next, message) => {
        const p = validateParameters(next ?? parametersRef.current);
        parametersRef.current = p;
        setParameters(p);
        stateRef.current = initialState(p);
        tracker.current.reset();
        peaksRef.current = [{ time: 0, amplitude: Math.abs(p.releaseAngle) }];
        samplesRef.current = [sample(stateRef.current, p)];
        measurementRef.current = idleMeasurement(p);
        nextSample.current = 1 / 30;
        accumulator.current = 0;
        publish();
        if (message)
            setNotice(message);
    }, [publish]);
    const configure = useCallback((patch) => {
        if (Object.entries(patch).every(([key, value]) => parametersRef.current[key] === value))
            return;
        reset({ ...parametersRef.current, ...patch }, 'New conditions · timing and energy traces restarted. Saved trials are kept.');
    }, [reset]);
    const integrateOneStep = useCallback(() => {
        const previous = stateRef.current;
        const next = advance(previous, parametersRef.current, DT);
        stateRef.current = next;
        if (previous.omega * next.omega < 0) {
            const f = -previous.omega / (next.omega - previous.omega);
            peaksRef.current.push({ time: previous.time + f * DT, amplitude: Math.abs(previous.theta + f * (next.theta - previous.theta)) * 180 / Math.PI });
            if (peaksRef.current.length > 160)
                peaksRef.current.shift();
        }
        const measuredPeriod = tracker.current.update(previous, next);
        const m = measurementRef.current;
        if (m.status === 'arming' && previous.theta <= 0 && next.theta > 0) {
            const fraction = -previous.theta / (next.theta - previous.theta);
            m.startTime = previous.time + fraction * DT;
            m.status = 'timing';
        }
        if (m.status === 'timing') {
            m.elapsed = next.time - (m.startTime ?? next.time);
            if (measuredPeriod !== null) {
                m.periods.push(measuredPeriod);
                if (m.periods.length >= m.target) {
                    m.elapsed = m.periods.reduce((sum, value) => sum + value, 0);
                    m.status = 'complete';
                    runningRef.current = false;
                    setRunningState(false);
                    setNotice(`${m.target} complete ${m.target === 1 ? 'oscillation' : 'oscillations'} measured. Record this trial in your notebook.`);
                }
            }
        }
        if (next.time + DT / 2 >= nextSample.current) {
            samplesRef.current.push(sample(next, parametersRef.current));
            if (samplesRef.current.length > 600)
                samplesRef.current.shift();
            nextSample.current += 1 / 30;
        }
    }, []);
    useEffect(() => {
        let frame = 0;
        let lastWall = 0;
        let lastPublish = 0;
        const animate = (wall) => {
            const wallDelta = lastWall ? Math.max(0, (wall - lastWall) / 1000) : 0;
            lastWall = wall;
            if (runningRef.current && !document.hidden) {
                // A suspended browser must not turn a long wall-clock gap into an experiment.
                if (wallDelta > 2) {
                    setRunning(false);
                    setNotice('Paused after a browser interruption. Resume to continue from the same state.');
                }
                else {
                    accumulator.current += wallDelta * rateRef.current;
                    let steps = 0;
                    while (accumulator.current + 1e-12 >= DT && runningRef.current && steps < 240) {
                        integrateOneStep();
                        accumulator.current -= DT;
                        steps++;
                    }
                }
            }
            if (wall - lastPublish > 80) {
                publish();
                lastPublish = wall;
            }
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        const visibility = () => {
            lastWall = 0;
            accumulator.current = 0;
            if (document.hidden && runningRef.current) {
                setRunning(false);
                setNotice('Paused while this tab was hidden. Resume when you are ready.');
            }
        };
        document.addEventListener('visibilitychange', visibility);
        return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); };
    }, [integrateOneStep, publish, setRunning]);
    const startMeasurement = useCallback((target) => {
        if (![1, 5, 10, 20].includes(target)) {
            setNotice('Choose 1, 5, 10 or 20 complete oscillations.');
            return;
        }
        const p = parametersRef.current;
        if (Math.abs(p.releaseAngle) < 0.1) {
            setNotice('Choose a nonzero release angle before measuring an oscillation.');
            return;
        }
        if (p.damping >= 2 * Math.sqrt(p.gravity / p.length)) {
            setNotice('This damping prevents repeated oscillations. Reduce damping to measure a period.');
            return;
        }
        reset(undefined);
        measurementRef.current = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, status: 'arming', target, periods: [], elapsed: 0, startTime: null, parameters: { ...p },
        };
        publish();
        setRunning(true);
        setNotice('The clock starts at the next rightward centre crossing, then counts full cycles.');
    }, [publish, reset, setRunning]);
    const step = useCallback(() => {
        if (runningRef.current)
            return;
        for (let i = 0; i < 12; i++)
            integrateOneStep();
        publish();
    }, [integrateOneStep, publish]);
    const setRate = useCallback((value) => {
        if (![0.1, 0.25, 0.5, 1].includes(value))
            return;
        rateRef.current = value;
        setRateState(value);
    }, []);
    const grab = useCallback(() => {
        dragging.current = true;
        setRunning(false);
        reset({ ...parametersRef.current, releaseAngle: stateRef.current.theta * 180 / Math.PI });
        setNotice('Position the bob, then release it from rest.');
    }, [setRunning, reset]);
    const drag = useCallback((degrees) => {
        if (!dragging.current || !Number.isFinite(degrees))
            return;
        reset({ ...parametersRef.current, releaseAngle: Math.max(-80, Math.min(80, degrees)) });
    }, [reset]);
    const release = useCallback(() => {
        if (!dragging.current)
            return;
        dragging.current = false;
        setRunning(true);
        setNotice('Released from rest · watch potential energy become kinetic energy.');
    }, [setRunning]);
    return { peaks: peaksRef.current, parameters, stateRef, snapshot, running, setRunning, rate, setRate, samples, periods,
        measurement, startMeasurement, reset, configure, step, grab, drag, release, notice, setNotice };
}
