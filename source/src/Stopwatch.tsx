import {useEffect,useState,useRef} from 'react';
import type {PendulumParameters} from './physics';
/** A student's manual interval. Does not populate the automatic observation table. */
export function Stopwatch({time,parameters}:{time:number;parameters:PendulumParameters}) {
 const [start,setStart]=useState<number|null>(null),[held,setHeld]=useState(0),[active,setActive]=useState(false);
 const previous=useRef(time);const key=JSON.stringify(parameters);
 useEffect(()=>{setStart(null);setHeld(0);setActive(false)},[key]);
 useEffect(()=>{if(time<previous.current-1e-6){setStart(null);setHeld(0);setActive(false)}previous.current=time},[time]);
 const elapsed=active && start!==null?held+Math.max(0,time-start):held;
 return <details className="manual-stopwatch"><summary>Manual stopwatch <span>Practice your timing +</span></summary><div className="stopwatch-face"><output aria-label="Manual stopwatch interval">{elapsed.toFixed(2)}<small> s</small></output><button className="button button-outline" onClick={()=>{if(active){setHeld(elapsed);setActive(false)}else{setStart(time);setActive(true)}}>{active?'Stop timer':'Start timer'}</button><button className="text-button" onClick={()=>{setHeld(0);setActive(false);setStart(null)}}>Clear</button></div><p className="microcopy">Uses simulated time: pauses and playback speed apply. Start the pendulum first; time N full cycles and divide by N. This practice interval is not an automatic observation.</p></details>
}
