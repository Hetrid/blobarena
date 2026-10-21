import type { Vec } from './types.js';
export class Spatial<T extends Vec> {
 private buckets=new Map<number,T[]>(); constructor(private step=180){}
 clear(){this.buckets.clear();}
 add(v:T){const k=Math.floor(v.x/this.step)*1024+Math.floor(v.y/this.step);const a=this.buckets.get(k);if(a)a.push(v);else this.buckets.set(k,[v]);}
 query(x:number,y:number,r:number):T[]{const out:T[]=[];for(let i=Math.floor((x-r)/this.step);i<=Math.floor((x+r)/this.step);i++)for(let j=Math.floor((y-r)/this.step);j<=Math.floor((y+r)/this.step);j++){const b=this.buckets.get(i*1024+j);if(b)out.push(...b);}return out;}
}
