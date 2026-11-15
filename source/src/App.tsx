import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import PendulumScene from './PendulumScene';
import { LiveGraph, NotebookPlot, type GraphMode } from './LiveGraph';
import Petals from './Petals';
import { LearningStudio, GuidedExperiments, MechanicsPanel, UncertaintyLens } from './LearningStudio';
import { Stopwatch } from './Stopwatch';

import { DEFAULT_PARAMETERS, energy, fitGravity, nonlinearPeriod, smallAnglePeriod, type PendulumParameters } from './physics';
import { usePendulum } from './usePendulum';
import { downloadText, loadTrials, saveTrials, trialsCsv, type Trial } from './records';

type IconName = 'arrow' | 'play' | 'pause' | 'reset' | 'step' | 'expand' | 'download' | 'check' | 'close' | 'book' | 'sun' | 'moon';
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    play: <path d="m8 5 11 7-11 7Z" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    reset: <><path d="M4 11a8 8 0 1 1 1.5 6M4 5v6h6" /></>,
    step: <><path d="m5 5 10 7L5 19ZM19 5v14" /></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m5 5 14 14M19 5 5 19" /></>,
    book: <><path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" /></>,
    moon: <path d="M20 14A8 8 0 0 1 10 4 8 8 0 1 0 20 14Z" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Brand() {
  return <a href="#top" className="brand" aria-label="Time in Motion, back to top">
    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" aria-hidden="true"><path d="M10 5h20M20 5l10 24" stroke="currentColor" strokeWidth="1.3" /><circle cx="31" cy="32" r="4" fill="currentColor" /><path d="M5 26a26 26 0 0 0 28 10" stroke="currentColor" strokeDasharray="2 3" strokeWidth="1" /></svg>
    <span>SAKURA ATELIER<small>TIME IN MOTION / 03</small></span>
  </a>;
}

function ParameterControl({ label, symbol, value, min, max, step, unit, digits = 2, onChange, hint }: {
  label: string; symbol: string; value: number; min: number; max: number; step: number; unit: string; digits?: number;
  onChange: (value: number) => void; hint?: string;
}) {
  const [draft, setDraft] = useState(value.toFixed(digits));
  const [invalid, setInvalid] = useState(false);
  const id = `parameter-${symbol.replace(/[^a-zA-Z]/g, '') || label.replace(/\W/g, '')}`;
  useEffect(() => { setDraft(value.toFixed(digits)); setInvalid(false); }, [value, digits]);
  const commit = () => {
    const next = Number(draft);
    if (!draft.trim() || !Number.isFinite(next) || next < min || next > max) { setInvalid(true); return; }
    if (draft === value.toFixed(digits) || Math.abs(next - value) < 1e-10) { setInvalid(false); return; }
    const increments = (next - min) / step;
    if (Math.abs(increments - Math.round(increments)) > 1e-7) { setInvalid(true); return; }
    setInvalid(false); onChange(next);
  };
  const progress = (value - min) / (max - min) * 100;
  return <div className="parameter-control">
    <div className="parameter-label"><label htmlFor={id}>{label}<span>{symbol}</span></label><div className="parameter-value"><input id={id} type="number" min={min} max={max} step={step} value={draft} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') commit(); }} /><span>{unit}</span></div></div>
    <input className="parameter-range" type="range" min={min} max={max} step={step} value={value} aria-label={`${label} slider`} aria-valuetext={`${value.toFixed(digits)} ${unit}`} onChange={event => onChange(Number(event.target.value))} style={{ '--progress': `${progress}%` } as CSSProperties} />
    <div className="range-endpoints"><span>{min} {unit}</span><span>{max} {unit}</span></div>
    {hint && <p className="parameter-hint">{hint}</p>}
    {invalid && <p id={`${id}-error`} className="input-error">Enter {min} to {max}, in steps of {step}.</p>}
  </div>;
}

function useOfflineStatus() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !['https:','http:'].includes(location.protocol)) return;
    let live = true;
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(registration => {
      if (registration.waiting && live) setUpdate(registration);
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', () => {
          if (registration.waiting && navigator.serviceWorker.controller && live) setUpdate(registration);
        });
      });
      return navigator.serviceWorker.ready;
    }).then(registration => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => { channel.port1.close(); }, 5000);
      channel.port1.onmessage = event => {
        clearTimeout(timeout);
        if (live) setOfflineReady(event.data?.type === 'OFFLINE_CACHE_STATUS' && event.data.complete === true);
        channel.port1.close();
      };
      registration.active?.postMessage({ type: 'GET_CACHE_STATUS' }, [channel.port2]);
    }).catch(() => { if (live) setOfflineReady(false); });
    return () => { live = false; };
  }, []);
  const activateUpdate = () => {
    if (!update?.waiting) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    update.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  };
  return { offlineReady, update, activateUpdate };
}

export default function App() {
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [ambient, setAmbient] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [comparison, setComparison] = useState(false);
  const [view, setView] = useState<'front'|'perspective'>('front');
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReducedMotion(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  const simulation = usePendulum(reducedMotion);
  const { parameters: p, snapshot: s, running, setRunning, rate, setRate, measurement: m } = simulation;
  const [showTrail, setShowTrail] = useState(true);
  const [showForces, setShowForces] = useState(false);
  const [chartMode, setChartMode] = useState<GraphMode>('energy');
  const [cycles, setCycles] = useState(5);
  const [loaded] = useState(loadTrials);
  const [rows, setRows] = useState<Trial[]>(loaded.rows);
  const [storageWarning, setStorageWarning] = useState(loaded.warning);
  const [undo, setUndo] = useState<Trial[] | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [quality, setQuality] = useState<'standard' | 'high'>('high');
  const [renderer, setRenderer] = useState<'webgl' | 'fallback'>('webgl');
  const laboratory = useRef<HTMLElement>(null);
  const journeyRef = useRef(0);
  useEffect(()=>{let frame=0;const update=()=>{frame=0;const progress=reducedMotion?0:Math.max(0,Math.min(1,window.scrollY/Math.max(600,window.innerHeight)));journeyRef.current=progress;document.documentElement.style.setProperty('--journey',String(progress));};const scroll=()=>{if(!frame)frame=requestAnimationFrame(update)};update();window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',scroll);return()=>{window.removeEventListener('scroll',scroll);window.removeEventListener('resize',scroll);cancelAnimationFrame(frame)}},[reducedMotion]);
  const { offlineReady, update, activateUpdate } = useOfflineStatus();
  const e = energy(s, p);
  const smallPeriod = smallAnglePeriod(p);
  const exactPeriod = nonlinearPeriod(p);
  const measuredPeriod = m.status === 'complete' ? m.elapsed / m.target : null;
  const latestPeriod = simulation.periods.at(-1);
  const undamped = p.damping === 0;
  const nonOscillatory = p.damping >= 2 * Math.sqrt(p.gravity / p.length);
  const energyScale = Math.max(e.total, 1e-12);
  const compatible = rows.filter(row => row.damping === 0 && Math.abs(row.releaseAngle) <= 10 && Math.abs(row.gravity - p.gravity) < 1e-8);
  const fit = new Set(compatible.map(row => row.length)).size >= 3 ? fitGravity(compatible) : null;
  const alreadyRecorded = rows.some(row => row.id === m.id);
  const planet = Math.abs(p.gravity - 9.81) < 0.001 ? 'Earth' : Math.abs(p.gravity - 1.62) < 0.001 ? 'Moon' : Math.abs(p.gravity - 3.71) < 0.001 ? 'Mars' : 'Custom gravity';

  useEffect(() => {
    if (!saveTrials(rows)) setStorageWarning('Browser storage is unavailable. Export CSV to keep this session’s observations.');
  }, [rows]);
  useEffect(() => {
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await laboratory.current?.requestFullscreen();
    } catch { simulation.setNotice('Fullscreen is unavailable in this browser. The laboratory remains fully usable here.'); }
  };
  const record = () => {
    if (m.status !== 'complete' || alreadyRecorded) return;
    setRows(previous => [...previous, { ...m.parameters, id: m.id, period: m.elapsed / m.target, elapsed: m.elapsed, cycles: m.target }].slice(-50));
    setUndo(null);
    simulation.setNotice('Trial saved to your notebook on this device. Export CSV to take it with you.');
  };
  const practical = (length = p.length) => {
    simulation.configure({ length, releaseAngle: 5, damping: 0 });
    setRunning(false);
    simulation.setNotice('Gravity experiment ready: 5° release, no damping. Measure several lengths at the same gravity.');
    location.hash = 'laboratory';
    laboratory.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };
  const replay = (row: Trial) => {
    const params: PendulumParameters = { length: row.length, gravity: row.gravity, damping: row.damping, mass: row.mass, releaseAngle: row.releaseAngle };
    simulation.reset(params, 'Replaying this trial’s original release conditions. Its saved observation is unchanged.');
    setCycles(row.cycles);
    setRunning(true);
    location.hash = 'laboratory';
    laboratory.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return <>
    <a className="skip-link" href="#laboratory">Skip to laboratory</a>
    <div className="hero-shell" id="top"><Petals enabled={ambient && !reducedMotion} />
      <header className="site-header"><Brand /><nav aria-label="Main navigation"><a href="#laboratory">The laboratory</a><a href="#notebook">Your notebook</a><a href="#field-notes">The physics</a></nav><a className="nav-start" href="#laboratory">Start exploring <Icon name="arrow" size={16} /></a></header>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-rule" />
        <div className="hero-copy">
          <div className="eyebrow"><span className="tiny-line" /> A STUDY IN STILLNESS &amp; MOTION</div>
          <h1 id="hero-title">Time<br /><em>in motion.</em></h1>
          <p className="hero-description">A quiet rhythm. An extraordinary idea.<br />Pull back a little, and discover the physics<br className="desktop-break" /> hiding in every swing.</p>
          <a className="button button-brass hero-cta" href="#laboratory">Enter the laboratory <Icon name="arrow" /></a>
          <div className="hero-caption"><span className="live-dot" /> A living experiment, not a looping animation.</div>
        </div>
        <div className="hero-specimen"><div className="pavilion-arch" aria-hidden="true"/><div className="pavilion-window" aria-hidden="true"/>
          <div className="specimen-index">FIG. 01 <span>THE SIMPLE PENDULUM</span></div>
          <div className="hero-scene"><PendulumScene parameters={p} stateRef={simulation.stateRef} variant="hero" journeyRef={journeyRef} reducedMotion={reducedMotion} quality={quality} /></div>
          <div className="specimen-caption"><span>BRASS, GRAVITY &amp; A LITTLE CURIOSITY.</span><button className="hero-motion" onClick={() => setRunning(!running)} aria-label={running ? 'Pause pendulum motion' : 'Play pendulum motion'}><Icon name={running ? 'pause' : 'play'} size={14} /> {running ? 'Pause motion' : 'Play motion'}</button></div>
        </div>
        <div className="hero-bottom"><a href="#laboratory" className="scroll-cue"><span>↓</span> FOLLOW THE MOTION</a><div className="hero-facts"><div><span>EFFECTIVE LENGTH</span><strong>{p.length.toFixed(2)} <small>m</small></strong></div><div><span>GRAVITY / {planet.toUpperCase()}</span><strong>{p.gravity.toFixed(2)} <small>m/s²</small></strong></div><div><span>UNDAMPED PERIOD</span><strong>{exactPeriod.toFixed(2)} <small>s</small></strong></div></div></div>
      </section>
    </div>

    <main><div className="chapter-bridge container"><span>THE BEAUTY IS IN THE RETURN.</span><p>One simple movement.<br /><em>A language for all oscillations.</em></p><span className="bridge-line"/></div>
      <section id="laboratory" className={`laboratory-section ${fullscreen ? 'is-fullscreen' : ''}`} ref={laboratory} aria-labelledby="laboratory-title">
        <div className="container">
          <div className="section-heading lab-heading"><div><p className="section-kicker">01 / THE LABORATORY</p><h2 id="laboratory-title" className="section-title">Find your rhythm.</h2></div><div className="section-heading-aside"><p>Change a little. Notice a lot.<br />Every swing, reading and graph stays connected.</p><button className="icon-button" onClick={toggleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen laboratory'} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen laboratory'}><Icon name={fullscreen ? 'close' : 'expand'} /></button></div></div>

          <div className="lab-toolbar"><div className="segmented" role="group" aria-label="Learning level"><button className={!advanced?'selected':''} aria-pressed={!advanced} onClick={()=>{setAdvanced(false); if(!['energy','angle'].includes(chartMode))setChartMode('energy');}}>Explore</button><button className={advanced?'selected':''} aria-pressed={advanced} onClick={()=>setAdvanced(true)}>Advanced mechanics</button></div><label className="ambient-toggle"><input type="checkbox" checked={ambient} onChange={e=>setAmbient(e.target.checked)}/> Sakura atmosphere</label><span className="lab-edition">GRADE 11 CORE / GRADE 12 CONNECTIONS</span></div><div className="lab-grid">
            <div className="apparatus-panel">
              <div className="apparatus-topline"><span><i className={`status-dot ${running ? 'active' : ''}`} />{running ? 'IN MOTION' : 'PAUSED'}<b>{rate < 1 ? ` / ${rate}× SLOW MOTION` : ''}</b></span><div className="stage-toggles"><label><input type="checkbox" checked={showTrail} onChange={event => setShowTrail(event.target.checked)} /> Swing arc</label><label><input type="checkbox" checked={showForces} onChange={event => setShowForces(event.target.checked)} /> Forces</label></div></div>
              <div className="lab-scene"><PendulumScene parameters={p} stateRef={simulation.stateRef} variant="lab" onGrab={simulation.grab} onDrag={simulation.drag} onRelease={simulation.release} showTrail={showTrail} showForces={showForces} showComparison={comparison} view={view} reducedMotion={reducedMotion} quality={quality} onReady={setRenderer} /></div>
              <div className="scene-tools"><div className="segmented" role="group" aria-label="Camera view"><button className={view==='front'?'selected':''} onClick={()=>setView('front')} aria-pressed={view==='front'}>Front</button><button className={view==='perspective'?'selected':''} onClick={()=>setView('perspective')} disabled={renderer==='fallback'} title={renderer==='fallback'?'Perspective requires WebGL; the diagram stays front-on.':'Inspect the 3D instrument from an oblique angle'} aria-pressed={view==='perspective'}>Perspective</button></div><label className="ghost-toggle"><input type="checkbox" checked={comparison} onChange={e=>{setComparison(e.target.checked);setChartMode('angle');}}/> Small-angle ghost</label></div><div className="scene-hint"><span className="hand-mark">↔</span> Drag the bob and release. <span>Or use the release-angle control.</span></div>
              <div className="live-readouts"><div><span>ANGLE FROM VERTICAL</span><strong>{(s.theta * 180 / Math.PI).toFixed(1)}<small>°</small></strong></div><div><span>BOB SPEED</span><strong>{Math.abs(s.omega * p.length).toFixed(2)} <small>m/s</small></strong></div><div><span>SIMULATED TIME</span><strong>{s.time.toFixed(2)} <small>s</small></strong></div></div>
              <div className="transport-bar"><div className="transport-actions"><button className="transport-play" onClick={() => setRunning(!running)} aria-label={running ? 'Pause simulation' : 'Play simulation'}><Icon name={running ? 'pause' : 'play'} size={18} /><span>{running ? 'Pause' : 'Play'}</span></button><button className="transport-secondary" onClick={() => simulation.reset(undefined, 'Released again from the selected angle. Notebook observations are kept.')} title="Restart this release"><Icon name="reset" size={17} /><span>Restart</span></button><button className="transport-secondary" onClick={simulation.step} disabled={running} title="Advance 0.05 simulated seconds"><Icon name="step" size={17} /><span>Step</span></button></div><div className="speed-control" role="group" aria-label="Playback speed"><span>SPEED</span>{[0.1, 0.25, 0.5, 1].map(value => <button key={value} className={rate === value ? 'selected' : ''} aria-pressed={rate === value} onClick={() => setRate(value)}>{value}×</button>)}</div></div>
            </div>

            <aside className="control-panel" aria-label="Pendulum conditions">
              <div className="panel-heading"><div><p className="panel-kicker">MAKE IT YOURS</p><h3>The conditions</h3></div><span className="small-orbit" aria-hidden="true">θ</span></div>
              <ParameterControl label="Length" symbol="L" value={p.length} min={0.25} max={2.5} step={0.01} unit="m" onChange={length => simulation.configure({ length })} hint="Measured from the pivot to the bob’s centre." />
              <ParameterControl label="Gravity" symbol="g" value={p.gravity} min={0.5} max={25} step={0.01} unit="m/s²" onChange={gravity => simulation.configure({ gravity })} />
              <div className="planet-presets" role="group" aria-label="Gravity presets">{[{ name: 'Earth', gravity: 9.81 }, { name: 'Moon', gravity: 1.62 }, { name: 'Mars', gravity: 3.71 }].map(world => <button key={world.name} aria-pressed={planet === world.name} className={planet === world.name ? 'selected' : ''} onClick={() => simulation.configure({ gravity: world.gravity })}><span className={`planet-dot ${world.name.toLowerCase()}`} />{world.name}</button>)}</div>
              <ParameterControl label="Release angle" symbol="θ₀" value={p.releaseAngle} min={-80} max={80} step={0.1} unit="°" digits={1} onChange={releaseAngle => simulation.configure({ releaseAngle })} />
              <ParameterControl label="Damping" symbol="γ" value={p.damping} min={0} max={1} step={0.01} unit="s⁻¹" onChange={damping => simulation.configure({ damping })} hint={undamped ? 'An ideal swing: no mechanical energy is lost.' : 'Energy is transferred to the surroundings.'} />
              <details className="extra-controls"><summary>Mass & display <span>+</span></summary><ParameterControl label="Bob mass" symbol="m" value={p.mass} min={0.1} max={2} step={0.1} unit="kg" onChange={mass => simulation.configure({ mass })} /><p>At fixed angular damping rate, mass changes energy and forces, not the motion in this model. For the same physical drag force law, the damping rate can depend on mass.</p><label className="quality-label">Rendering<select value={quality} onChange={event => setQuality(event.target.value as 'standard' | 'high')}><option value="high">Detailed</option><option value="standard">Lighter</option></select></label><button className="text-button" onClick={() => simulation.reset({ ...DEFAULT_PARAMETERS }, 'Default conditions restored. Your notebook is unchanged.')}><Icon name="reset" size={14} /> Restore starting conditions</button></details>
            </aside>
          </div>
          <p className="experiment-status" role="status"><span>↳</span>{simulation.notice}</p>
          {nonOscillatory && <p className="context-note warning-note">At these settings, damping prevents repeated swings near equilibrium. Reduce damping to measure a period.</p>}

          {comparison && <p className="comparison-note"><span className="ghost-swatch"/>The pink ghost is the linearized model: sin &theta; replaced by &theta;. Same release, length, gravity and damping; no data is changed. At large angles this approximation is deliberately inaccurate.</p>}{advanced && <MechanicsPanel p={p} s={s}/>}<div className="signal-grid">
            <section className="graph-card" aria-labelledby="energy-title"><div className="card-heading"><div><p className="panel-kicker">FOLLOW THE EXCHANGE</p><h3 id="energy-title">{{energy:'The exchange of energy.',angle:'Two ways to swing.',velocity:'The pace of motion.',acceleration:'A restoring tendency.',phase:'The shape of a state.',decay:'A quieter return.'}[chartMode]}</h3></div><label className="graph-selector"><span className="sr-only">Graph view</span><select value={chartMode} onChange={e=>setChartMode(e.target.value as GraphMode)} aria-label="Graph view"><option value="energy">Energy exchange</option><option value="angle">Angle &amp; approximation</option>{advanced && <><option value="velocity">Signed velocity</option><option value="acceleration">Tangential acceleration</option><option value="phase">Phase space</option><option value="decay">Turning amplitude squared</option></>}</select></label></div>
              <LiveGraph samples={simulation.samples} mode={chartMode} currentTime={s.time} parameters={p} comparison={comparison} peaks={simulation.peaks} />
              <div className="energy-balance"><div className="energy-composition" aria-label={`Kinetic ${(100 * e.kinetic / energyScale).toFixed(0)} percent, potential ${(100 * e.potential / energyScale).toFixed(0)} percent, dissipated ${(100 * e.heat / energyScale).toFixed(0)} percent`}><span className="ke" style={{ width: `${100 * e.kinetic / energyScale}%` }} /><span className="pe" style={{ width: `${100 * e.potential / energyScale}%` }} /><span className="heat" style={{ width: `${100 * e.heat / energyScale}%` }} /></div><p><span>Mechanical + dissipated energy</span><strong>{e.total.toFixed(3)} J</strong></p></div>
            </section>

            <section className="measurement-card" aria-labelledby="period-title"><div className="card-heading"><div><p className="panel-kicker">MAKE AN OBSERVATION</p><h3 id="period-title">The time of a swing</h3></div><span className="clock-icon" aria-hidden="true">◷</span></div>
              <div className="period-result"><div><span>{m.status === 'complete' ? 'MEASURED AVERAGE PERIOD' : 'LAST COMPLETE PERIOD'}</span><strong>{(measuredPeriod ?? latestPeriod)?.toFixed(3) ?? '—'}<small> s</small></strong></div><div className="period-definition">One complete<br />back-and-forth.</div></div>
              {advanced && <div className="frequency-readout"><span>Measured f <strong>{(measuredPeriod??latestPeriod)?(1/(measuredPeriod??latestPeriod)!).toFixed(3):'—'} Hz</strong></span><span>2&pi;/T <strong>{(measuredPeriod??latestPeriod)?(2*Math.PI/(measuredPeriod??latestPeriod)!).toFixed(3):'—'} rad/s</strong></span></div>}<div className="theory-comparison"><div><span>Small-angle prediction</span><strong>{smallPeriod.toFixed(3)} s</strong></div><div><span>Finite-angle prediction</span><strong>{exactPeriod.toFixed(3)} s</strong></div></div><p className="microcopy">Both predictions assume no damping. The measured value comes from the bob’s centre crossings.</p>
              <div className="measurement-controls"><label htmlFor="cycle-count">Time<select id="cycle-count" value={cycles} onChange={event => setCycles(Number(event.target.value))} disabled={m.status === 'arming' || m.status === 'timing'}><option value={1}>1 oscillation</option><option value={5}>5 oscillations</option><option value={10}>10 oscillations</option><option value={20}>20 oscillations</option></select></label><span>{m.status === 'timing' ? `${m.periods.length} / ${m.target} cycles` : m.status === 'arming' ? 'Waiting for centre…' : m.status === 'complete' ? `${m.target} / ${m.target} cycles` : 'SIMULATION SECONDS'}</span></div>
              {(m.status === 'timing' || m.status === 'arming') && <div className="measurement-progress"><div style={{ width: `${100 * m.periods.length / m.target}%` }} /><span>{m.elapsed.toFixed(2)} s elapsed</span></div>}
              {m.status === 'complete' && <div className="measurement-equation">T = {m.elapsed.toFixed(3)} s ÷ {m.target} = <strong>{(m.elapsed / m.target).toFixed(3)} s</strong></div>}
              <div className="measure-actions"><button className="button button-dark" onClick={() => simulation.startMeasurement(cycles)} disabled={nonOscillatory || Math.abs(p.releaseAngle) < 0.1}>{m.status === 'arming' || m.status === 'timing' ? 'Restart measurement' : `Measure ${cycles} ${cycles === 1 ? 'oscillation' : 'oscillations'}`}<Icon name="arrow" size={16} /></button>{m.status === 'complete' && <button className="button button-outline" onClick={record} disabled={alreadyRecorded}><Icon name={alreadyRecorded ? 'check' : 'book'} size={16} />{alreadyRecorded ? 'Recorded' : 'Record trial'}</button>}</div>
              <Stopwatch time={s.time} parameters={p}/><p className="measurement-note">Timing starts at a rightward centre crossing and ends after {cycles} full {cycles === 1 ? 'cycle' : 'cycles'}. Slow motion preserves these readings.</p>
            </section>
          </div>
        </div>
      </section>

      <GuidedExperiments onPreset={(patch,message,compare)=>{simulation.reset({...p,...patch},message);setRunning(false);setAdvanced(true);setComparison(!!compare);setChartMode(patch.damping && patch.damping>0 && patch.damping<1?'decay':compare?'angle':'energy');setCycles(10);location.hash='laboratory';laboratory.current?.scrollIntoView({behavior:reducedMotion?'auto':'smooth'});}}/>
      <section id="notebook" className="notebook-section" aria-labelledby="notebook-title"><div className="container">
        <div className="section-heading"><div><p className="section-kicker">03 / YOUR EXPERIMENT NOTEBOOK</p><h2 id="notebook-title" className="section-title">From a swing to a discovery.</h2></div><p className="section-intro">How can a pendulum measure gravity?<br />Collect the evidence. Let the graph tell you.</p></div>
        <div className="practical-guide"><div className="guide-number">g</div><div><h3>A small-angle investigation</h3><p>Use a 5° release and no damping. Measure at least three different lengths, keeping gravity fixed.</p></div><button className="button button-dark" onClick={() => practical()}>Set up the experiment <Icon name="arrow" size={16} /></button></div>
        <div className="suggested-lengths"><span>TRY THESE LENGTHS</span>{[0.5, 1, 1.5, 2].map(length => <button key={length} onClick={() => practical(length)}>{length.toFixed(1)} m <Icon name="arrow" size={12} /></button>)}<small>Each preset keeps your current gravity.</small></div>
        <div className="notebook-grid"><section className="notebook-graph"><div className="card-heading"><div><p className="panel-kicker">LOOK FOR A RELATIONSHIP</p><h3>Let the data speak.</h3></div><span className="count-pill">{compatible.length} compatible {compatible.length === 1 ? 'trial' : 'trials'}</span></div><NotebookPlot records={compatible} fit={fit} /></section><aside className="inference-card"><p className="panel-kicker">WHAT THE SLOPE TELLS US</p><div className="inference-formula">T² = <span>4π²<br /><i>g</i></span> L</div><p>Plot T² against length. For small, undamped swings, the slope is approximately 4π² / g.</p><div className="inference-result"><span>YOUR ESTIMATE OF g</span><strong>{fit ? fit.gravity.toFixed(2) : '—'} <small>m/s²</small></strong><small>{fit ? `From ${compatible.length} measured trials · R² = ${fit.rSquared.toFixed(5)}` : 'Record at least three different lengths.'}</small></div>{fit && <dl className="fit-detail"><div><dt>Slope</dt><dd>{fit.slope.toFixed(4)} s²/m</dd></div><div><dt>Intercept</dt><dd>{fit.intercept.toFixed(4)} s²</dd></div><div><dt>Set gravity</dt><dd>{p.gravity.toFixed(2)} m/s²</dd></div></dl>}<p className="microcopy">Fit uses trials at {p.gravity.toFixed(2)} m/s², with no damping and |release angle| ≤ 10°. Small-angle approximation error remains. Smaller releases reduce it.</p></aside></div>
        {fit && <div className="seconds-result"><span>YOUR GRAPH'S SECONDS PENDULUM</span><strong>L = {((4-fit.intercept)/fit.slope).toFixed(4)} m</strong><p>For T = 2 s, solve L = (4 &minus; intercept) / slope. A half-swing takes one second.</p></div>}<UncertaintyLens length={m.status==='complete'?m.parameters.length:p.length} elapsed={m.status==='complete'?m.elapsed:null} cycles={m.target}/><div className="observations-heading"><h3>Your observations <span>{rows.length}</span></h3><div><button className="text-button" onClick={() => downloadText('Time-in-Motion-Observations.csv', trialsCsv(rows))} disabled={!rows.length}><Icon name="download" size={16} />Export CSV</button>{undo && <button className="text-button" onClick={() => { setRows(undo); setUndo(null); }}>Undo clear</button>}<button className="text-button muted" onClick={() => { setUndo(rows); setRows([]); }} disabled={!rows.length}>Clear notebook</button></div></div>
        {!rows.length ? <div className="notebook-empty"><Icon name="book" size={27} /><div><strong>Every discovery starts with a first observation.</strong><p>Measure a few oscillations in the laboratory, then choose “Record trial”.</p></div><a href="#laboratory">Make a measurement <Icon name="arrow" size={17} /></a></div> : <div className="observation-scroll" role="region" aria-label="Recorded trials" tabIndex={0}><table><thead><tr><th scope="col">Trial</th><th scope="col">Length / m</th><th scope="col">Release / °</th><th scope="col">Cycles</th><th scope="col">Total time / s</th><th scope="col">Period / s</th><th scope="col">T² / s²</th><th scope="col">Fit status</th><th scope="col">Revisit</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><th scope="row">{String(index + 1).padStart(2, '0')}</th><td>{row.length.toFixed(2)}</td><td>{row.releaseAngle.toFixed(1)}</td><td>{row.cycles}</td><td>{row.elapsed.toFixed(3)}</td><td>{row.period.toFixed(3)}</td><td>{(row.period ** 2).toFixed(3)}</td><td><span className={`fit-badge ${compatible.includes(row) ? 'included' : ''}`}>{compatible.includes(row) ? 'Included' : row.damping > 0 ? 'Damped' : Math.abs(row.releaseAngle) > 10 ? 'Large angle' : 'Different g'}</span></td><td><button className="replay-trial" onClick={() => replay(row)} aria-label={`Replay trial ${index + 1}`}><Icon name="play" size={14} />Replay</button></td></tr>)}</tbody></table></div>}
        <p className="notebook-footnote">Observations stay on this device (up to 50 trials). CSV includes every trial’s gravity, damping, mass and release angle. <span>Simulation readings have no human reaction-time error.</span></p>
        {storageWarning && <p className="context-note" role="status">{storageWarning}</p>}
      </div></section>

      <div className="container"><LearningStudio /></div>
    </main>
    <footer className="site-footer"><div className="container footer-inner"><Brand /><p>A learning experience by <strong>Sreeraj</strong></p><div className="footer-status"><span className="status-dot active" />{location.protocol==='file:'?'Self-contained / no network needed':offlineReady ? 'Ready for offline use' : 'Physics runs in your browser'}<small>{renderer === 'fallback' ? 'Interactive diagram mode' : 'Sakura Atelier / A study in mechanics.'}</small></div></div></footer>
    {update && <div className="update-notice" role="status"><span>A new version is ready. Your saved trials will be kept.</span><button onClick={() => { setRunning(false); activateUpdate(); }}>Update & reload</button></div>}
  </>;
}
