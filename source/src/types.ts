/** One sampled state, shared by every linked plot. Angles are radians. */
export interface Sample {
 time:number; theta:number; omega:number;
 kinetic:number; potential:number; mechanical:number; heat:number; total:number;
}
