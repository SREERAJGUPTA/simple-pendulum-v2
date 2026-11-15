import { jsx as _jsx, jsxs as _jsxs } from '../vendor/react-runtime.js';
import { useEffect, useState, useRef } from '../vendor/react-runtime.js';
/** A student's manual interval. Does not populate the automatic observation table. */
export function Stopwatch({ time, parameters }) {
    const [start, setStart] = useState(null), [held, setHeld] = useState(0), [active, setActive] = useState(false);
    const previous = useRef(time);
    const key = JSON.stringify(parameters);
    useEffect(() => { setStart(null); setHeld(0); setActive(false); }, [key]);
    useEffect(() => { if (time < previous.current - 1e-6) {
        setStart(null);
        setHeld(0);
        setActive(false);
    } previous.current = time; }, [time]);
    const elapsed = active && start !== null ? held + Math.max(0, time - start) : held;
    return _jsxs("details", { className: "manual-stopwatch", children: [_jsxs("summary", { children: ["Manual stopwatch ", _jsx("span", { children: "Practice your timing +" })] }), _jsxs("div", { className: "stopwatch-face", children: [_jsxs("output", { "aria-label": "Manual stopwatch interval", children: [elapsed.toFixed(2), _jsx("small", { children: " s" })] }), _jsx("button", { className: "button button-outline", onClick: () => { if (active) {
                            setHeld(elapsed);
                            setActive(false);
                        }
                        else {
                            setStart(time);
                            setActive(true);
                        } }, children: active ? 'Stop timer' : 'Start timer' }), _jsx("button", { className: "text-button", onClick: () => { setHeld(0); setActive(false); setStart(null); }, children: "Clear" })] }), _jsx("p", { className: "microcopy", children: "Uses simulated time: pauses and playback speed apply. Start the pendulum first; time N full cycles and divide by N. This practice interval is not an automatic observation." })] });
}
