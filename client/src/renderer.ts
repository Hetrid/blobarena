import { COLORS,radius,TUNE } from '../../shared/src/config.js';
import { center,clamp } from '../../shared/src/math.js';
import type { Cell,Snapshot,PlayerView } from '../../shared/src/types.js';
import { prefs } from './storage.js';
interface Visual {x:number;y:number;mass:number;vx:number;vy:number}
interface Particle {x:number;y:number;vx:number;vy:number;life:number;max:number;color:string;r:number}
export class Renderer {
 canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;camera={x:1500,y:1500,zoom:.5};width=0;height=0;fps=60;
 private visual=new Map<number,Visual>();private particles:Particle[]=[];private lastDpr=0;private gridColors=['#283c30','#3c314b','#27434b','#4b3a2c'];private previousTime=-1;
 target='';drawFood=true;low=false;
 constructor(canvas:HTMLCanvasElement){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false})!;this.resize();window.addEventListener('resize',()=>this.resize());}
 resize(){this.width=innerWidth;this.height=innerHeight;this.low=prefs.quality==='low';const dpr=Math.min(devicePixelRatio||1,prefs.quality==='high'?2:this.low?1:1.5);this.lastDpr=dpr;this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 burst(x:number,y:number,color:string,n=14){if(this.low)return;for(let i=0;i<n&&this.particles.length<180;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*170;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.45+Math.random()*.35,max:.8,color,r:2+Math.random()*4});}}
 draw(s:Snapshot,id:string,dt:number,menu=false){
  this.fps+=((1/Math.max(.001,dt))-this.fps)*.04;if(prefs.quality==='auto'&&this.fps<34&&!this.low){this.low=true;this.canvas.width=this.width;this.canvas.height=this.height;this.lastDpr=1;}
  if(s.time<this.previousTime){this.visual.clear();this.particles=[];}this.previousTime=s.time;
  const c=this.ctx;c.setTransform(this.lastDpr,0,0,this.lastDpr,0,0);c.fillStyle='#111b23';c.fillRect(0,0,this.width,this.height);
  const byId=new Map(s.players.map(p=>[p.id,p]));const own=s.cells.filter(c=>c.owner===(this.target||id));const focus=own.length?own:s.cells.filter(c=>c.owner===s.players.filter(p=>p.alive).sort((a,b)=>b.mass-a.mass)[0]?.id);
  const mass=focus.reduce((n,c)=>n+c.mass,0),at=focus.length?center(focus):{x:s.size/2,y:s.size/2};
  let extent=radius(mass)*3+700;for(const cell of focus)extent=Math.max(extent,Math.hypot(cell.x-at.x,cell.y-at.y)*2+radius(cell.mass)*2+350);
  const zoom=clamp(Math.min(this.width,this.height)*1.1/extent,.15,Math.min(this.width,this.height)<600?.64:.92)*(menu?.8:1);
  const smooth=1-Math.exp(-dt*4);this.camera.x+=(at.x-this.camera.x)*smooth;this.camera.y+=(at.y-this.camera.y)*smooth;this.camera.zoom+=(zoom-this.camera.zoom)*smooth;
  c.save();c.translate(this.width/2,this.height/2);c.scale(this.camera.zoom,this.camera.zoom);c.translate(-this.camera.x,-this.camera.y);
  const z=this.camera.zoom,left=this.camera.x-this.width/2/z,top=this.camera.y-this.height/2/z,right=left+this.width/z,bottom=top+this.height/z;
  c.fillStyle='#162129';c.fillRect(0,0,s.size,s.size);c.strokeStyle='#c1e3c008';c.lineWidth=1/z;c.beginPath();for(let x=Math.max(0,Math.floor(left/80)*80);x<Math.min(s.size,right);x+=80){c.moveTo(x,Math.max(0,top));c.lineTo(x,Math.min(s.size,bottom));}for(let y=Math.max(0,Math.floor(top/80)*80);y<Math.min(s.size,bottom);y+=80){c.moveTo(Math.max(0,left),y);c.lineTo(Math.min(s.size,right),y);}c.stroke();
  c.strokeStyle='#78957577';c.lineWidth=6;c.strokeRect(0,0,s.size,s.size);
  if(s.arenaEvent&&s.arenaEvent.type!=='double'&&s.arenaEvent.type!=='bounty'){const a=s.arenaEvent;c.fillStyle=a.type==='outbreak'?'#76c86a0e':'#ffe06b10';c.strokeStyle=a.type==='outbreak'?'#78ba7166':'#ffe06b66';c.setLineDash([12,12]);c.lineWidth=2;c.beginPath();c.arc(a.x,a.y,a.radius,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([]);c.font='700 22px system-ui';c.textAlign='center';c.fillStyle=a.type==='outbreak'?'#9fd58f':'#f5e3a8';c.fillText(a.title,a.x,a.y-a.radius-20);}
  for(let color=0;color<COLORS.length;color++){c.fillStyle=COLORS[color];c.beginPath();for(const f of s.food){if(f.color!==color||f.x<left-20||f.x>right+20||f.y<top-20||f.y>bottom+20)continue;const rr=f.from?9:Math.max(4,Math.sqrt(f.mass)*2.4);c.moveTo(f.x+rr,f.y);c.arc(f.x,f.y,rr,0,Math.PI*2);}c.fill();}
  for(const v of s.viruses){const vr=radius(TUNE.virusMass)+v.feeds*2;if(v.x<left-vr||v.x>right+vr||v.y<top-vr||v.y>bottom+vr)continue;c.save();c.translate(v.x,v.y);c.rotate(s.time*.07);c.beginPath();for(let k=0;k<48;k++){const a=k/48*Math.PI*2,rr=vr*(k%2?1:.86);if(k===0)c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fillStyle='#588e3d';c.strokeStyle='#b1de62';c.lineWidth=3;c.fill();c.stroke();c.beginPath();c.arc(0,0,vr*.65,0,Math.PI*2);c.fillStyle='#a0c96333';c.fill();c.fillStyle='#244d24';for(let k=0;k<3;k++){c.beginPath();c.arc((k-1)*16,k===1?-7:6,5,0,Math.PI*2);c.fill();}c.restore();}
  const existing=new Set<number>();const cellSmooth=1-Math.exp(-dt*13);const ordered=[...s.cells].sort((a,b)=>a.mass-b.mass);
  for(const cell of ordered){existing.add(cell.id);const player=byId.get(cell.owner);if(!player)continue;let v=this.visual.get(cell.id);if(!v){v={x:cell.x,y:cell.y,mass:cell.mass,vx:0,vy:0};this.visual.set(cell.id,v);}const ox=v.x,oy=v.y;v.x+=(cell.x-v.x)*cellSmooth;v.y+=(cell.y-v.y)*cellSmooth;v.mass+=(cell.mass-v.mass)*(1-Math.exp(-dt*9));v.vx=(v.x-ox)/Math.max(dt,.001);v.vy=(v.y-oy)/Math.max(dt,.001);const r=radius(v.mass);if(v.x+r<left||v.x-r>right||v.y+r<top||v.y-r>bottom)continue;
   if(prefs.trails&&!this.low&&Math.hypot(cell.vx,cell.vy)>180&&Math.random()<.35)this.burst(v.x,v.y,player.color,1);
   this.cell(v,r,cell,player,cell.owner===id,s.time);
  }
  for(const id of this.visual.keys())if(!existing.has(id))this.visual.delete(id);
  for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;c.globalAlpha=clamp(p.life/p.max,0,1);c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.r,0,Math.PI*2);c.fill();}c.globalAlpha=1;c.restore();
  // A soft vignette gives the arena edges depth without obscuring play.
  if(!this.low){const g=c.createRadialGradient(this.width/2,this.height/2,this.height*.25,this.width/2,this.height/2,Math.max(this.width,this.height)*.7);g.addColorStop(0,'#00000000');g.addColorStop(1,'#07101755');c.fillStyle=g;c.fillRect(0,0,this.width,this.height);}
 }
 private cell(v:Visual,r:number,cell:Cell,p:PlayerView,me:boolean,time:number){const c=this.ctx;c.save();c.translate(v.x,v.y);const velocity=Math.hypot(v.vx,v.vy),stretch=clamp(velocity/5000,0,.09);c.rotate(Math.atan2(v.vy,v.vx));c.scale(1+stretch,1-stretch);c.rotate(-Math.atan2(v.vy,v.vx));
  const color=p.team===1?'#719fff':p.team===2?'#ff8794':p.color;let fill:string|CanvasGradient=color;
  if(!this.low){const g=c.createRadialGradient(-r*.32,-r*.4,r*.08,0,0,r*1.08);g.addColorStop(0,color);g.addColorStop(.72,color);g.addColorStop(1,color+'bb');fill=g;}
  c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fillStyle=fill;c.fill();c.strokeStyle=me?'#efffdbaa':color;c.lineWidth=me?3:2;c.stroke();
  if(p.skin===2){c.save();c.clip();c.strokeStyle='#ffffff28';c.lineWidth=Math.max(7,r*.14);for(let i=-3;i<4;i++){c.beginPath();c.moveTo(-r,i*r*.45);c.lineTo(r,i*r*.45+r*.6);c.stroke();}c.restore();}
  if(p.skin===3){c.save();c.clip();c.fillStyle='#ffffff22';for(let i=0;i<7;i++){c.beginPath();c.arc(Math.sin(i*4)*r*.7,Math.cos(i*3)*r*.7,r*.14,0,Math.PI*2);c.fill();}c.restore();}
  // Friendly little faces stay legible at small sizes.
  if(r*this.camera.zoom>14){c.fillStyle='#182c36cc';const eyeR=Math.max(2,r*.05),ey=-r*.17,ex=r*.22;c.beginPath();c.ellipse(-ex,ey,eyeR,eyeR*1.6,0,0,Math.PI*2);c.ellipse(ex,ey,eyeR,eyeR*1.6,0,0,Math.PI*2);c.fill();if(p.skin===1){c.fillStyle='#182c36';c.fillRect(-r*.4,-r*.3,r*.32,r*.16);c.fillRect(r*.08,-r*.3,r*.32,r*.16);c.fillRect(-r*.09,-r*.27,r*.18,r*.04);}else{c.strokeStyle='#182c36a0';c.lineWidth=Math.max(1.5,r*.025);c.beginPath();c.arc(0,r*.05,r*.11,.15,Math.PI-.15);c.stroke();}}
  const font=clamp(r*.23,12,35);c.textAlign='center';c.textBaseline='middle';c.font=`750 ${font}px system-ui`;c.fillStyle='#16242fd9';if(r*this.camera.zoom>16){const label=p.name+(p.bot?'':'');c.fillText(label,0,r*.43,r*1.65);if(r*this.camera.zoom>35){c.font=`600 ${font*.6}px system-ui`;c.globalAlpha=.65;c.fillText(Math.floor(cell.mass).toLocaleString(),0,r*.68);c.globalAlpha=1;}}
  if(p.shield){c.strokeStyle='#e3f4dd'+(Math.sin(time*8)>.2?'99':'44');c.lineWidth=3/this.camera.zoom;c.setLineDash([6/this.camera.zoom,6/this.camera.zoom]);c.beginPath();c.arc(0,0,r+8,0,Math.PI*2);c.stroke();c.setLineDash([]);}c.restore();
 }
 minimap(canvas:HTMLCanvasElement,s:Snapshot,id:string){const c=canvas.getContext('2d')!,w=canvas.width;c.clearRect(0,0,w,w);c.fillStyle='#17282b';c.fillRect(0,0,w,w);c.strokeStyle='#516b5244';c.lineWidth=1;for(let i=1;i<4;i++){c.beginPath();c.moveTo(w*i/4,0);c.lineTo(w*i/4,w);c.moveTo(0,w*i/4);c.lineTo(w,w*i/4);c.stroke();}
  for(const p of s.players){const cells=s.cells.filter(c=>c.owner===p.id);if(!cells.length)continue;const at=center(cells);c.fillStyle=p.id===id?'#e7ffd1':p.team===1?'#719fff':p.team===2?'#ff8794':p.color;c.globalAlpha=p.id===id?1:.6;c.beginPath();c.arc(at.x/s.size*w,at.y/s.size*w,p.id===id?4:2.3,0,Math.PI*2);c.fill();}c.globalAlpha=1;
  if(s.arenaEvent){const a=s.arenaEvent;c.strokeStyle='#ffde89aa';c.beginPath();c.arc(a.x/s.size*w,a.y/s.size*w,a.radius/s.size*w,0,Math.PI*2);c.stroke();}
 }
}
