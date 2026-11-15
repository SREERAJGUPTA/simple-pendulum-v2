import {describe,it,expect} from 'vitest';
import {DEFAULT_PARAMETERS,initialState,advance,energy,DT} from '../src/physics';
import {linearReference,mechanics,regression,gravityUncertainty,electricPendulum,response} from '../src/advanced';
const P=(patch={})=>({...DEFAULT_PARAMETERS,...patch});
describe('Sakura advanced models',()=>{
 it('linear ghost starts at the same angle from rest in all damping regimes',()=>{
  for(const p of [P(),P({damping:.4}),P({length:2.5,gravity:.5,damping:Math.sqrt(.8)}),P({length:2.5,gravity:.5,damping:1})]){
   const q=linearReference(p,0);expect(q.theta).toBeCloseTo(p.releaseAngle*Math.PI/180,14);expect(q.omega).toBeCloseTo(0,14);
  }
 });
 it('undamped ghost matches a separately calculated harmonic solution',()=>{
  const p=P({length:1,gravity:4,releaseAngle:10});const q=linearReference(p,Math.PI/4);
  expect(Math.abs(q.theta)).toBeLessThan(1e-14);expect(q.omega).toBeCloseTo(-Math.PI/9,13);
 });
 it('damped ghost solves the declared linear differential equation',()=>{
  for(const p of [P({damping:.3}),P({length:2.5,gravity:.5,damping:Math.sqrt(.8)}),P({length:2.5,gravity:.5,damping:1})]){
   const t=1.3,h=1e-5,q=linearReference(p,t),before=linearReference(p,t-h),after=linearReference(p,t+h);
   expect(Math.abs((after.theta-before.theta)/(2*h)-q.omega)).toBeLessThan(2e-9);
   expect(Math.abs((after.omega-before.omega)/(2*h)+p.damping*q.omega+p.gravity/p.length*q.theta)).toBeLessThan(2e-8);
  }
 });
 it('tiny-amplitude RK4 agrees with the ghost across damping regimes',()=>{
  for(const patch of [{damping:.3},{length:2.5,gravity:.5,damping:Math.sqrt(.8)},{length:2.5,gravity:.5,damping:1}]){
   const p=P({...patch,releaseAngle:.0001});let s=initialState(p);for(let i=0;i<1200;i++)s=advance(s,p,DT);
   const q=linearReference(p,5);expect(Math.abs(s.theta-q.theta)).toBeLessThan(2e-13);expect(Math.abs(s.omega-q.omega)).toBeLessThan(4e-13);
  }
 });
 it('ghost rejects negative or nonfinite time',()=>{for(const t of [-1,NaN,Infinity])expect(()=>linearReference(P(),t)).toThrow()});
 it('bottom-of-swing radial acceleration is nonzero and tension exceeds weight',()=>{
  const m=mechanics({theta:0,omega:3,time:0,heat:0},P({length:2,mass:.5,gravity:10}));
  expect(m.tangential).toBeCloseTo(0,14);expect(m.radial).toBe(18);expect(m.weight).toBe(5);expect(m.tension).toBe(14);expect(m.velocity).toBe(6);
 });
 it('restoring torque and angular acceleration have the restoring sign',()=>{
  const p=P({length:2,mass:.5,gravity:10,releaseAngle:30});const m=mechanics(initialState(p),p);
  expect(m.torque).toBeCloseTo(-5,13);expect(m.tangential).toBeCloseTo(-5,13);expect(m.tension).toBeCloseTo(5*Math.sqrt(3)/2,13);
 });
 it('drag power equals the heat-production rate and is never positive',()=>{
  const p=P({damping:.4,length:1.5,mass:.8});const s={theta:.4,omega:-2,time:0,heat:0};const m=mechanics(s,p);
  expect(m.drag*m.velocity).toBeCloseTo(-p.damping*p.mass*p.length**2*s.omega**2,13);
 });
 it('tension stays positive over the allowed 80 degree release domain',()=>{
  const p=P({releaseAngle:80,length:.25,gravity:25,damping:.6});let s=initialState(p);
  for(let i=0;i<5000;i++){s=advance(s,p,DT);expect(mechanics(s,p).tension).toBeGreaterThan(0)}
 });
 it('fits a free-intercept line without mutating observations',()=>{
  const points=[{x:.5,y:2.1},{x:1,y:4.1},{x:2,y:8.1}],copy=structuredClone(points);const f=regression(points)!;
  expect(f.slope).toBeCloseTo(4,13);expect(f.intercept).toBeCloseTo(.1,13);expect(f.rSquared).toBeCloseTo(1,13);expect(points).toEqual(copy);
 });
 it('refuses insufficient and singular line fits',()=>{
  expect(regression([])).toBeNull();expect(regression([{x:1,y:2},{x:1,y:3},{x:1,y:4}])).toBeNull();expect(regression([{x:1,y:NaN},{x:2,y:3},{x:3,y:4}])).toBeNull();
 });
 it('uncertainty uses total N-cycle time and a first-order worst-case bound',()=>{
  const u=gravityUncertainty(1,20,10,.002,.2)!;
  expect(u.g).toBeCloseTo(Math.PI**2,13);expect(u.relative).toBeCloseTo(.022,14);expect(u.delta).toBeCloseTo(Math.PI**2*.022,13);
  expect(u.minimum).toBeCloseTo(4*Math.PI**2*.998/2.02**2,13);expect(u.maximum).toBeCloseTo(4*Math.PI**2*1.002/1.98**2,13);
 });
 it('invalid error bounds never yield an infinity or a fabricated interval',()=>{
  for(const args of [[1,0,10,.002,.2],[1,1,10,.01,2],[1,10,1,1,.2],[1,10,1,-.1,.2],[1,10,2.5,.1,.2]])expect(gravityUncertainty(...args as [number,number,number,number,number])).toBeNull();
 });
 it('more timed cycles reduce the assumed timing contribution but not length error',()=>{
  const a=gravityUncertainty(1,2,1,.002,.2)!,b=gravityUncertainty(1,20,10,.002,.2)!;
  expect(a.g).toBe(b.g);expect(a.relative).toBeCloseTo(.202,14);expect(b.relative).toBeCloseTo(.022,14);
 });
 it('horizontal electric field changes equilibrium and effective gravity consistently',()=>{
  const a=electricPendulum(.02,1e-6,196200,0,1)!;
  expect(a.angle).toBeCloseTo(45,12);expect(a.effective).toBeCloseTo(9.81*Math.SQRT2,12);
  const b=electricPendulum(.02,-1e-6,196200,0,1)!;expect(b.angle).toBeCloseTo(-45,12);expect(b.period).toBe(a.period);
 });
 it('zero electric force restores the ordinary pendulum formula',()=>{
  const a=electricPendulum(.02,0,200000,0,1)!;expect(a.angle).toBe(0);expect(a.period).toBeCloseTo(2.0060666807106475,13);
 });
 it('cancelled effective gravity yields no defined equilibrium or oscillation period',()=>{
  const q=electricPendulum(.02,1e-6,0,196200,1)!;expect(q.period).toBeNull();expect(q.angle).toBeNull();expect(q.effective).toBe(0);
 });
 it('electric calculator rejects nonphysical inputs',()=>{expect(electricPendulum(0,1,1,0,1)).toBeNull();expect(electricPendulum(1,1,NaN,0,1)).toBeNull()});
 it('resonance response has the static and natural-frequency limits',()=>{
  expect(response(0,.2).magnitude).toBe(1);expect(response(0,.2).phase).toBe(0);expect(response(1,.2).magnitude).toBe(2.5);expect(response(1,.2).phase).toBe(Math.PI/2);
 });
 it('finite damping shifts the displacement peak below the natural frequency',()=>{
  const z=.3,pk=Math.sqrt(.82);expect(response(1,z).peak).toBeCloseTo(pk,13);expect(response(pk,z).magnitude).toBeGreaterThan(response(1,z).magnitude);
  expect(response(1,Math.SQRT1_2).peak).toBeNull();expect(response(1,1).peak).toBeNull();
 });
 it('the resonance model guards zero damping and invalid ratios',()=>{for(const args of [[1,0],[-1,.2],[NaN,.2],[1,Infinity]])expect(()=>response(...args as [number,number])).toThrow()});
});
