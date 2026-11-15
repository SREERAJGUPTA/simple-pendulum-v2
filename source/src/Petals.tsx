import type { CSSProperties } from 'react';
export default function Petals({enabled}:{enabled:boolean}) {
  return <div className={`petal-garden ${enabled?'':'still'}`} aria-hidden="true">
    {Array.from({length:14},(_,i)=><span key={i} className="petal-drift" style={{'--x':`${(i*37+9)%100}%`,'--delay':`${-i*2.47}s`,'--duration':`${18+i%5*4}s`,'--size':`${10+i%4*4}px`,'--turn':`${i*47}deg`} as CSSProperties}><svg viewBox="0 0 40 46"><defs><linearGradient id={`petal${i}`} x2="1" y2="1"><stop stopColor="#f3d9db"/><stop offset=".55" stopColor="#d9a0b0"/><stop offset="1" stopColor="#bd7b90"/></linearGradient></defs><path d="M19 44C-8 24 4 4 14 2L20 8 25 1C43 9 41 31 19 44Z" fill={`url(#petal${i})`}/><path d="M19 40Q28 21 20 8" fill="none" stroke="#b9758c" opacity=".28"/></svg></span>)}
  </div>;
}
