import type { Vec } from './types.js';
export const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
export const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
export function direction(x:number,y:number):Vec {const n=Math.hypot(x,y);return n>1?{x:x/n,y:y/n}:{x,y};}
export function center(cells:{x:number;y:number;mass:number}[]):Vec {let x=0,y=0,m=0;for(const c of cells){x+=c.x*c.mass;y+=c.y*c.mass;m+=c.mass;}return {x:x/(m||1),y:y/(m||1)};}
export class Random { constructor(public seed=12345){} next(){let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;} range(a:number,b:number){return a+(b-a)*this.next();} pick<T>(a:readonly T[]):T{return a[Math.floor(this.next()*a.length)];} }
