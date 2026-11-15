import {useId,useState,useRef,useEffect} from 'react';
import type {Sample} from './types';
import type {PendulumParameters,GravityFit} from './physics';
import {linearReference,regression} from './advanced';
import type {Trial} from './records';
export type GraphMode='energy'|'angle'|'velocity'|'acceleration'|'phase'|'decay';
const H=280,L=52,R=18,T=34,B=43,PH=H-T-B;
export const ink={kinetic:'#34776c',potential:'#ad5474',mechanical:'#826433',heat:'#776c8c',angle:'#a94e70',ghost:'#9b906e'};
function upper(x:number) { if(!Number.isFinite(x)||x<=1e-10)return 1;const n=10**Math.floor(Math.log10(x));return Math.ceil(x/n)*n; }
function fmt(x:number){return Math.abs(x)>=100?x.toFixed(0):Math.abs(x)>=1?x.toFixed(1):x===0?'0':x.toFixed(2)}
export function Plot({curves,xmin=0,xmax,ymin=0,ymax,xLabel,yLabel,title,points=false}:{curves:{label:string;color:string;dash?:boolean;values:{x:number;y:number}[]}[];xmin?:number;xmax:number;ymin?:number;ymax:number;xLabel:string;yLabel:string;title:string;points?:boolean}){
  const host=useRef<HTMLElement>(null);const [W,setW]=useState(720);useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(([entry])=>setW(Math.max(320,Math.min(720,entry.contentRect.width))));observer.observe(host.current);return()=>observer.disconnect()},[]);const PW=W-L-R;
  const id=useId().replace(/:/g,'');const sx=(x:number)=>L+(x-xmin)/(xmax-xmin)*PW, sy=(y:number)=>T+(1-(y-ymin)/(ymax-ymin))*PH;
  return <figure className="live-chart" ref={host}><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Horizontal axis: ${xLabel}. Vertical axis: ${yLabel}.`}><defs><clipPath id={id}><rect x={L} y={T} width={PW} height={PH}/></clipPath></defs>
    {Array.from({length:5},(_,i)=>{const y=ymin+(ymax-ymin)*i/4,x=xmin+(xmax-xmin)*i/4;return <g key={i}><line x1={L} x2={W-R} y1={sy(y)} y2={sy(y)} stroke="currentColor" opacity=".12"/><text x={L-12} y={sy(y)+4} textAnchor="end">{fmt(y)}</text><line x1={sx(x)} x2={sx(x)} y1={T} y2={H-B} stroke="currentColor" opacity=".06"/><text x={sx(x)} y={H-B+20} textAnchor="middle">{fmt(x)}</text></g>})}
    <text x={L} y="14" className="axis-title">{yLabel}</text><text x={W-R} y={H-3} textAnchor="end" className="axis-title">{xLabel}</text>
    {ymin<0&&<line x1={L} x2={W-R} y1={sy(0)} y2={sy(0)} stroke="currentColor" opacity=".22"/>}
    <g clipPath={`url(#${id})`}>{curves.map((c,j)=><g key={j}>{(!points||c.dash)&&<path d={c.values.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ')} fill="none" stroke={c.color} strokeWidth={c.dash?1.6:2.3} strokeDasharray={c.dash?'6 5':undefined} strokeLinecap="round" strokeLinejoin="round"/>}{points&&!c.dash?c.values.map((p,i)=><circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={c.color}><title>{`${c.label}: ${p.x.toFixed(4)}, ${p.y.toFixed(4)}`}</title></circle>):c.values.length>0&&<circle cx={sx(c.values.at(-1)!.x)} cy={sy(c.values.at(-1)!.y)} r="3.5" fill={c.color}/>}</g>)}</g>
    {!curves.some(c=>c.values.length>1)&&<text x={W/2} y={H/2} textAnchor="middle" className="empty-plot">{points?'Collect observations to draw the graph.':'Set the pendulum in motion.'}</text>}
  </svg><figcaption className="chart-legend">{curves.map(c=><span key={c.label}><i style={{background:c.color}} className={c.dash?'legend-dashed':''}/>{c.label}</span>)}</figcaption></figure>
}
export function LiveGraph({samples,mode,currentTime,parameters:p,comparison,peaks}:{samples:Sample[];mode:GraphMode;currentTime:number;parameters:PendulumParameters;comparison:boolean;peaks:{time:number;amplitude:number}[]}){
  const start=Math.max(0,currentTime-12),end=Math.max(12,currentTime);const a=samples.filter(s=>s.time>=start);
  let curves:{label:string;color:string;dash?:boolean;values:{x:number;y:number}[]}[]=[],xmin=start,xmax=end,ymin=0,ymax=1,xLabel='SIMULATED TIME (s)',yLabel='',caption='';
  if(mode==='energy'){
    curves=(['kinetic','potential','mechanical','heat'] as const).map(k=>({label:{kinetic:'Kinetic',potential:'Potential',mechanical:'Mechanical',heat:'Dissipated'}[k],color:ink[k],dash:k==='mechanical'||k==='heat',values:a.map(s=>({x:s.time,y:s[k]}))}));
    ymax=upper(Math.max(.001,...a.map(s=>s.total))*1.12);yLabel='ENERGY (J)';caption='K + U is mechanical energy. K + U + dissipated energy is conserved within numerical accuracy. Potential energy is zero at the bottom.';
  } else if(mode==='decay'){
    curves=[{label:'Observed turning points',color:ink.angle,values:peaks.map(s=>({x:s.time,y:s.amplitude**2}))}];
    xmin=0;xmax=Math.max(12,currentTime);ymax=upper(Math.max(1,p.releaseAngle**2)*1.08);yLabel='TURNING AMPLITUDE SQUARED (deg\u00b2)';caption='Each point is detected when angular velocity changes sign. For weak, small-angle damping, the peak A\u00b2 decays approximately as exp(-\u03b3t). No synthetic observations are inserted.';
  } else if(mode==='phase') {
    const A=Math.max(1,Math.abs(p.releaseAngle))*Math.PI/180;const vmax=Math.max(.1,Math.sqrt(2*p.gravity/p.length*(1-Math.cos(A))));
    curves=[{label:'Nonlinear trajectory',color:ink.angle,values:a.map(s=>({x:s.theta,y:s.omega}))}];
    xmin=-A*1.2;xmax=A*1.2;ymin=-vmax*1.2;ymax=vmax*1.2;xLabel='ANGLE \u03b8 (rad)';yLabel='ANGULAR VELOCITY (rad/s)';caption='One point shows both position and velocity. Ideal motion makes a closed loop; damping draws an inward spiral. The last 12 simulated seconds are shown.';
  } else {
    const value=(theta:number,omega:number)=>mode==='angle'?theta*180/Math.PI:mode==='velocity'?p.length*omega:-p.gravity*Math.sin(theta)-p.damping*p.length*omega;
    curves=[{label:mode==='angle'?'Angle':mode==='velocity'?'Signed tangential velocity':'Tangential acceleration',color:ink.angle,values:a.map(s=>({x:s.time,y:value(s.theta,s.omega)}))}];
    if(comparison)curves.push({label:'Linearized reference',color:ink.ghost,dash:true,values:a.map(s=>{const q=linearReference(p,s.time);return {x:s.time,y:mode==='acceleration'?-p.gravity*q.theta-p.damping*p.length*q.omega:value(q.theta,q.omega)}})});
    ymax=upper(Math.max(.05,...curves.flatMap(c=>c.values.map(v=>Math.abs(v.y))))*1.1);ymin=-ymax;
    yLabel=mode==='angle'?'ANGLE \u03b8 (degrees)':mode==='velocity'?'TANGENTIAL VELOCITY v (m/s)':'TANGENTIAL ACCELERATION (m/s\u00b2)';
    caption=mode==='acceleration'?'This is tangential acceleration, not the total acceleration. At the mean position, radial acceleration v\u00b2/L is generally not zero.':mode==='velocity'?'Positive velocity points along increasing angle. A zero value marks a turning point, not zero acceleration.':(comparison?'The rose curve uses sin \u03b8. The dashed comparison replaces it with \u03b8 and uses the same release and damping.':'This angle trace follows the nonlinear equation. Turn on the small-angle ghost to compare it with the linear approximation.');
  }
  return <><Plot {...{curves,xmin,xmax,ymin,ymax,xLabel,yLabel}} title={mode+' graph'} points={mode==='decay'}/><p className="chart-caption">{caption}</p></>;
}
export function NotebookPlot({records,fit}:{records:Trial[];fit:GravityFit|null}){
  const [mode,setMode]=useState<'squared'|'root'|'length'>('squared');
  const points=records.map(r=>({x:mode==='squared'?r.length:mode==='root'?Math.sqrt(r.length):r.period,y:mode==='squared'?r.period**2:mode==='root'?r.period:r.length}));
  const f=mode==='squared'?fit:mode==='root'&&new Set(records.map(r=>r.length)).size>=3?regression(points):null;
  const xmax=upper(Math.max(mode==='root'?1.6:mode==='length'?3.3:2.5,...points.map(p=>p.x))*1.05);
  const ymax=upper(Math.max(mode==='squared'?12:mode==='root'?4:2.5,...points.map(p=>p.y))*1.05);
  const curves=[{label:'Recorded trials',color:ink.potential,values:points,dash:false}];
  if(f)curves.push({label:'Least-squares fit',color:ink.mechanical,dash:true,values:[{x:0,y:f.intercept},{x:xmax,y:f.intercept+f.slope*xmax}]});
  return <><div className="segmented plot-options" role="group" aria-label="Notebook graph"><button aria-pressed={mode==='squared'} className={mode==='squared'?'selected':''} onClick={()=>setMode('squared')}>T&sup2; vs L</button><button aria-pressed={mode==='root'} className={mode==='root'?'selected':''} onClick={()=>setMode('root')}>T vs &radic;L</button><button aria-pressed={mode==='length'} className={mode==='length'?'selected':''} onClick={()=>setMode('length')}>L vs T</button></div><Plot curves={curves} xmax={xmax} ymax={ymax} xLabel={mode==='squared'?'LENGTH L (m)':mode==='root'?'SQUARE ROOT OF LENGTH (\u221am)':'PERIOD T (s)'} yLabel={mode==='squared'?'PERIOD SQUARED T\u00b2 (s\u00b2)':mode==='root'?'PERIOD T (s)':'LENGTH L (m)'} title="Experimental observation graph" points/>
  <p className="chart-caption">{f?<>Slope {f.slope.toFixed(4)} {mode==='root'?'s / \u221am':'s\u00b2 / m'} &middot; R&sup2; {f.rSquared.toFixed(4)}. {mode==='root'&&<>g from this fit: {(4*Math.PI**2/f.slope**2).toFixed(3)} m/s&sup2;.</>}</>:mode==='length'?'The length-period relationship is curved. The straight-line fit is only shown in the linearized views.':'Record at least three distinct lengths with a small release angle and no damping.'}</p></>;
}
