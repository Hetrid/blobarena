import { TUNE,COLORS,DEFAULT_SETTINGS,settings,radius,speed } from './config.js';
import type { RoomSettings } from './config.js';
import { Random,clamp,center,distance,direction } from './math.js';
import { Spatial } from './spatial.js';
import { thinkBot } from './bots.js';
import type { Cell,Player,Food,Virus,Snapshot,GameEvent,ArenaEvent,Personality } from './types.js';
const NAMES=['Mochi','Orbit','Pickle','Nimbus','Boba','Squish','Peach','Wobble','Miso','Pixel','Jelly','Comet','Sprout','Pip','Gloop','Noodle','Kiwi','Pluto'];
const PERSONAS:Personality[]=['hunter','survivor','farmer','opportunist','strategist','team'];
export class Engine {
 time=0;size:number;config:RoomSettings;players=new Map<string,Player>();food:Food[]=[];viruses:Virus[]=[];
 events:GameEvent[]=[];arenaEvent:ArenaEvent|null=null;round={number:1,until:0,winner:'',finished:false};
 teamScores=[0,0,0];rng:Random;private nextId=1;private botId=0;private nextEvent=25;private leader='';private leaderSince=0;
 private rivals=new Map<string,number>();private lastEat=new Map<string,number>();
 cellsGrid=new Spatial<Cell>(220);foodGrid=new Spatial<Food>(150);
 constructor(raw:Partial<RoomSettings>=DEFAULT_SETTINGS,seed=Date.now()){
  this.config=settings(raw);this.size=this.config.size;this.rng=new Random(seed);if(this.config.mode==='duel')this.seedDuel();else this.seedArena();
 }
 id(){return this.nextId++;}
 seedArena(){this.food=[];this.viruses=[];while(this.food.length<this.foodTarget())this.addFood();if(this.config.mode!=='duel')for(let i=0;i<TUNE.viruses;i++)this.viruses.push({id:this.id(),x:this.rng.range(180,this.size-180),y:this.rng.range(180,this.size-180),feeds:0,vx:0,vy:0});this.rebuild();}
 foodTarget(){return Math.round(TUNE.food*(this.size/3000)**1.2);}
 addFood(x?:number,y?:number,mass=TUNE.foodMass as number){const f:Food={id:this.id(),x:x??this.rng.range(15,this.size-15),y:y??this.rng.range(15,this.size-15),mass,color:Math.floor(this.rng.next()*COLORS.length),vx:0,vy:0,born:this.time};this.food.push(f);return f;}
 addPlayer(id:string,name:string,options:{bot?:boolean;color?:string;skin?:number;spectate?:boolean;mass?:number}={}){
  const humans=[...this.players.values()].filter(p=>!p.bot&&!p.spectating).length;
  let spectator=!!options.spectate;if(this.config.mode==='duel'&&!options.bot&&humans>=2)spectator=true;
  let team=0;if(this.config.mode==='coop')team=options.bot?2:1;
  if(this.config.mode==='teams'){const a=[...this.players.values()].filter(p=>!p.spectating&&p.team===1).length,b=[...this.players.values()].filter(p=>!p.spectating&&p.team===2).length;team=a<=b?1:2;}
  const p:Player={id,name:sanitizeName(name),color:options.color&&/^#[0-9a-f]{6}$/i.test(options.color)?options.color:this.rng.pick(COLORS),skin:clamp(Math.floor(options.skin??0),0,3),bot:!!options.bot,team,cells:[],input:{x:0,y:0},eject:false,nextSplit:0,nextEject:0,shieldUntil:0,born:this.time,kills:0,streak:0,peak:0,score:0,deaths:0,lastKiller:'',biggest:0,bestSurvival:0,alive:false,spectating:spectator,respawnAt:0,difficulty:this.config.difficulty==='mixed'?this.rng.pick(['easy','normal','hard','expert'] as const):this.config.difficulty,personality:PERSONAS[this.botId%PERSONAS.length],nextThink:0,target:{x:this.size/2,y:this.size/2},state:'foraging',wins:0};
  this.players.set(id,p);if(!spectator)this.spawn(p,options.mass);this.rebuild();return p;
 }
 spawn(p:Player,mass?:number){if(p.spectating)return;if(this.config.mode==='duel'&&(this.round.until>this.time||this.round.finished))return;
  const start=mass??(this.config.mode==='duel'?TUNE.duelMass:TUNE.spawnMass);let best={x:this.size/2,y:this.size/2},bestScore=-Infinity;
  for(let i=0;i<48;i++){const pos={x:this.rng.range(90,this.size-90),y:this.rng.range(90,this.size-90)};let score=this.size;
   for(const other of this.players.values())if(other.id!==p.id&&!this.friendly(p,other))for(const c of other.cells)if(c.mass>start*TUNE.eatRatio)score=Math.min(score,distance(pos,c)-radius(c.mass)-320);
   for(const v of this.viruses)score=Math.min(score,distance(pos,v)+180);
   if(p.team&&this.config.mode==='teams')score-=Math.abs(pos.x-(p.team===1?this.size*.2:this.size*.8))*.45;
   if(this.config.mode==='duel'){const idx=[...this.players.values()].filter(a=>!a.spectating).indexOf(p);pos.x=this.size*(idx%2?.75:.25);pos.y=this.size/2;}
   if(score>bestScore){best=pos;bestScore=score;}}
  p.cells=[{id:this.id(),owner:p.id,...best,mass:start,vx:0,vy:0,mergeAt:this.time}];p.alive=true;p.born=this.time;p.shieldUntil=this.time+TUNE.spawnShield;p.streak=0;p.peak=Math.max(p.peak,start);p.input={x:0,y:0};p.eject=false;
 }
 removePlayer(id:string){this.players.delete(id);this.rivals.forEach((_,k)=>{if(k.startsWith(id+'|')||k.endsWith('|'+id))this.rivals.delete(k);});this.lastEat.delete(id);}
 syncBots(){const humans=[...this.players.values()].filter(p=>!p.bot&&!p.spectating).length;
  const target=this.config.mode==='duel'?this.config.bots:Math.max(0,this.config.bots+1-humans);
  const bots=[...this.players.values()].filter(p=>p.bot);
  while(bots.length>target){const p=bots.pop()!;this.removePlayer(p.id);}
  while(bots.length<target){const index=this.botId++;const id='bot-'+index;const p=this.addPlayer(id,NAMES[index%NAMES.length],{bot:true,mass:this.config.mode==='duel'?TUNE.duelMass:this.rng.range(38,170),skin:index%4,color:COLORS[index%COLORS.length]});p.personality=PERSONAS[index%PERSONAS.length];bots.push(p);}
 }
 friendly(a:Player,b:Player){return a.id===b.id||(a.team!==0&&a.team===b.team);}
 input(id:string,x:number,y:number,eject=false){const p=this.players.get(id);if(!p||!Number.isFinite(x)||!Number.isFinite(y))return;p.input=direction(x,y);p.eject=!!eject;}
 split(id:string){const p=this.players.get(id);if(!p?.alive||p.spectating||this.time<p.nextSplit||this.round.until>this.time||this.round.finished)return false;
  let did=false;const original=[...p.cells];let aim=direction(p.input.x,p.input.y);if(Math.hypot(aim.x,aim.y)<.01)aim={x:1,y:0};
  for(const c of original){if(p.cells.length>=TUNE.maxCells)break;if(c.mass<TUNE.minSplit)continue;did=true;c.mass/=2;const r=radius(c.mass);c.mergeAt=this.time+TUNE.mergeBase+c.mass*TUNE.mergeMass;
   const newCell:Cell={id:this.id(),owner:p.id,mass:c.mass,x:clamp(c.x+aim.x*r*.7,r,this.size-r),y:clamp(c.y+aim.y*r*.7,r,this.size-r),vx:aim.x*TUNE.splitImpulse,vy:aim.y*TUNE.splitImpulse,mergeAt:c.mergeAt};p.cells.push(newCell);c.vx-=aim.x*30;c.vy-=aim.y*30;}
  if(did){p.nextSplit=this.time+TUNE.splitCooldown;this.emit('split',p.cells.length>=8?'MASSIVE SPLIT!':'Split!',p.id,undefined,center(p.cells));}return did;
 }
 eject(p:Player){if(this.food.length>this.foodTarget()+700)return;if(this.time<p.nextEject||!p.alive||this.round.until>this.time||this.round.finished)return;const d=direction(p.input.x,p.input.y);if(Math.hypot(d.x,d.y)<.05)return;let done=false;
  for(const c of p.cells){if(c.mass<35)continue;c.mass-=TUNE.ejectCost;const r=radius(c.mass)+14;const f=this.addFood(clamp(c.x+d.x*r,10,this.size-10),clamp(c.y+d.y*r,10,this.size-10),TUNE.ejectMass);f.vx=d.x*520;f.vy=d.y*520;f.from=p.id;done=true;}
  if(done){p.nextEject=this.time+TUNE.ejectCooldown;this.emit('eject','',p.id);}
 }
 burst(p:Player,c:Cell){const count=Math.min(TUNE.maxCells-p.cells.length+1,Math.max(2,Math.floor(c.mass/32)));if(count<2){c.mass*=.95;return;}
  const each=c.mass/count;c.mass=each;c.mergeAt=this.time+TUNE.mergeBase+each*TUNE.mergeMass;
  for(let i=1;i<count;i++){const a=i/count*Math.PI*2;const rr=radius(each)*.7;p.cells.push({id:this.id(),owner:p.id,mass:each,x:clamp(c.x+Math.cos(a)*rr,10,this.size-10),y:clamp(c.y+Math.sin(a)*rr,10,this.size-10),vx:Math.cos(a)*430,vy:Math.sin(a)*430,mergeAt:c.mergeAt});}
  this.emit('virus','VIRUS BURST',p.id,undefined,c);
 }
 emit(kind:string,text:string,actor?:string,victim?:string,pos?:{x:number;y:number},extra:Partial<GameEvent>={}){this.events.push({id:this.id(),time:this.time,kind,text,actor,victim,...pos,...extra});if(this.events.length>45)this.events.shift();}
 kill(victim:Player,killer:Player,mass:number,pos:Cell){victim.alive=false;victim.deaths++;victim.bestSurvival=Math.max(victim.bestSurvival,this.time-victim.born);victim.lastKiller=killer.id;victim.respawnAt=this.time+2;victim.eject=false;
  killer.kills++;killer.streak++;killer.score+=100;killer.biggest=Math.max(killer.biggest,mass);const revenge=killer.lastKiller===victim.id,king=this.leader===victim.id&&this.time-this.leaderSince>20;
  const last=this.lastEat.get(killer.id)??-100;this.lastEat.set(killer.id,this.time);const double=this.time-last<7;
  const rivalry=killer.id+'|'+victim.id;this.rivals.set(rivalry,(this.rivals.get(rivalry)??0)+1);if(king)killer.score+=300;
  this.emit('kill',revenge?'REVENGE!':king?'KING ELIMINATED!':double?'DOUBLE EAT!':killer.streak===3?'ON A ROLL!':`${killer.name} ate ${victim.name}`,killer.id,victim.id,pos,{mass,revenge,king});
  if(this.config.mode==='duel'&&[...this.players.values()].filter(p=>!p.spectating).length>=2){killer.wins++;this.round.winner=killer.id;this.round.until=this.time+4;this.round.finished=killer.wins>=3;this.emit('round',this.round.finished?`${killer.name} wins the duel!`:`${killer.name} takes the round`,killer.id);}
 }
 rebuild(){this.cellsGrid.clear();this.foodGrid.clear();for(const p of this.players.values())for(const c of p.cells)this.cellsGrid.add(c);for(const f of this.food)this.foodGrid.add(f);}
 step(dt=1/TUNE.tick){this.time+=dt;this.events=this.events.filter(ev=>this.time-ev.time<12);
  if(this.config.mode==='duel'&&this.round.until){if(this.time<this.round.until||this.round.finished)return;this.round.until=0;this.round.number++;this.seedDuel();for(const p of this.players.values())if(!p.spectating)this.spawn(p);}
  this.rebuild();for(const p of this.players.values())if(p.bot){if(!p.alive&&this.time>=p.respawnAt)this.spawn(p);thinkBot(this,p);}
  for(const p of this.players.values()){
   if(p.eject)this.eject(p);
   for(const c of p.cells){c.mass=Math.min(c.mass,TUNE.maxMass,Math.pow(this.size*.42/TUNE.radiusScale,2));const r=radius(c.mass),s=speed(c.mass);c.x+= (p.input.x*s+c.vx)*dt;c.y+=(p.input.y*s+c.vy)*dt;c.vx*=Math.exp(-dt*5.3);c.vy*=Math.exp(-dt*5.3);c.x=clamp(c.x,r,this.size-r);c.y=clamp(c.y,r,this.size-r);if(c.mass>TUNE.decayAbove)c.mass-=c.mass*TUNE.decayPerSecond*dt;}
   // Own cells repel until both merge clocks expire, then attract and merge.
   for(let i=0;i<p.cells.length;i++)for(let j=i+1;j<p.cells.length;j++){const a=p.cells[i],b=p.cells[j],d=distance(a,b),rr=radius(a.mass)+radius(b.mass),ready=this.time>Math.max(a.mergeAt,b.mergeAt);const dx=(b.x-a.x)/(d||1),dy=(b.y-a.y)/(d||1);
    if(ready&&d<rr*.7){const total=a.mass+b.mass;a.x=(a.x*a.mass+b.x*b.mass)/total;a.y=(a.y*a.mass+b.y*b.mass)/total;a.mass=Math.min(total,TUNE.maxMass,Math.pow(this.size*.42/TUNE.radiusScale,2));p.cells.splice(j--,1);}
    else if(ready&&d<rr+180){const f=Math.min(90,(d+20))*dt;a.x+=dx*f;a.y+=dy*f;b.x-=dx*f;b.y-=dy*f;}
    else if(d<rr&&!(Math.hypot(a.vx,a.vy)>100||Math.hypot(b.vx,b.vy)>100)){const f=(rr-d)*.5;const nx=d?dx:1,ny=d?dy:0;a.x-=nx*f;a.y-=ny*f;b.x+=nx*f;b.y+=ny*f;}
   }
   for(const c of p.cells){const rr=radius(c.mass);c.x=clamp(c.x,rr,this.size-rr);c.y=clamp(c.y,rr,this.size-rr);}
  }
  for(const f of this.food){f.x=clamp(f.x+f.vx*dt,8,this.size-8);f.y=clamp(f.y+f.vy*dt,8,this.size-8);f.vx*=Math.exp(-dt*4);f.vy*=Math.exp(-dt*4);}
  for(const v of this.viruses){const r=radius(TUNE.virusMass);v.x=clamp(v.x+v.vx*dt,r,this.size-r);v.y=clamp(v.y+v.vy*dt,r,this.size-r);v.vx*=Math.exp(-dt*4);v.vy*=Math.exp(-dt*4);}
  this.rebuild();const eaten=new Set<number>();const cells=[...this.players.values()].flatMap(p=>p.cells).sort((a,b)=>b.mass-a.mass);
  for(const c of cells){const p=this.players.get(c.owner)!;if(!p.cells.includes(c))continue;const r=radius(c.mass);
   for(const f of this.foodGrid.query(c.x,c.y,r+18)){if(eaten.has(f.id)||(f.from===p.id&&this.time-f.born<.8))continue;if(distance(c,f)<r-1){eaten.add(f.id);const bonus=this.arenaEvent?.type==='double'&&this.time>=this.arenaEvent.starts?2:1;c.mass=Math.min(TUNE.maxMass,c.mass+f.mass*bonus);if(!p.bot&&f.mass>3)this.emit('collect','',p.id,undefined,f,{color:COLORS[f.color],mass:f.mass});}}
   for(const other of this.cellsGrid.query(c.x,c.y,r+160)){if(other===c||other.mass*TUNE.eatRatio>=c.mass)continue;const victim=this.players.get(other.owner)!;if(this.friendly(p,victim)||p.shieldUntil>this.time||victim.shieldUntil>this.time||!victim.cells.includes(other))continue;
    if(distance(c,other)<r-radius(other.mass)*.4){const total=victim.cells.reduce((a,v)=>a+v.mass,0);const consumed=other.mass;c.mass=Math.min(TUNE.maxMass,c.mass+consumed);victim.cells.splice(victim.cells.indexOf(other),1);if(!victim.cells.length)this.kill(victim,p,total,c);}}
   for(const v of [...this.viruses])if(c.mass>TUNE.virusMass*TUNE.eatRatio&&distance(c,v)<r-radius(TUNE.virusMass)*.3){this.viruses.splice(this.viruses.indexOf(v),1);c.mass+=TUNE.virusMass*.65;this.burst(p,c);break;}
  }
  for(const v of [...this.viruses])for(const f of this.foodGrid.query(v.x,v.y,60)){if(eaten.has(f.id)||!f.from)continue;if(distance(v,f)<radius(TUNE.virusMass)+8){eaten.add(f.id);v.feeds++;if(v.feeds>=TUNE.virusFeeds){v.feeds=0;const d=direction(f.vx,f.vy);const n=Math.hypot(d.x,d.y)<.1?{x:1,y:0}:d;this.viruses.push({id:this.id(),x:v.x+n.x*85,y:v.y+n.y*85,feeds:0,vx:n.x*520,vy:n.y*520});}}}
  this.food=this.food.filter(f=>!eaten.has(f.id)&&(f.mass<=TUNE.foodMass||this.time-f.born<45));
  let missing=Math.min(12,this.foodTarget()-this.food.filter(f=>!f.from).length);while(missing-->0){const f=this.addFood();if(this.config.mode==='duel'){this.addFood(this.size-f.x,f.y,f.mass);missing--;}}if(this.viruses.length<TUNE.viruses&&this.config.mode!=='duel'&&this.rng.next()<dt*.35)this.viruses.push({id:this.id(),x:this.rng.range(100,this.size-100),y:this.rng.range(100,this.size-100),feeds:0,vx:0,vy:0});if(this.viruses.length>50)this.viruses.splice(0,this.viruses.length-50);
  this.teamScores=[0,0,0];let top:Player|undefined,topMass=0;
  for(const p of this.players.values()){const mass=p.cells.reduce((s,c)=>s+c.mass,0);p.peak=Math.max(p.peak,mass);p.score=Math.max(p.score,Math.floor(mass))+0;if(p.team)this.teamScores[p.team]+=mass;if(mass>topMass){top=p;topMass=mass;}}
  if(top&&top.id!==this.leader){this.leader=top.id;this.leaderSince=this.time;if(this.time>5)this.emit('leader','NEW LEADER: '+top.name,top.id);}
  if(this.config.mode==='chaos'&&this.config.events){this.updateEvent();this.applyEvent();}
 }
 seedDuel(){this.food=[];this.viruses=[];for(let i=0;i<180;i++){const x=this.rng.range(35,this.size/2-35),y=this.rng.range(35,this.size-35);this.addFood(x,y);this.addFood(this.size-x,y);}this.rebuild();}
 updateEvent(){if(this.arenaEvent&&this.time>this.arenaEvent.ends)this.arenaEvent=null;if(this.time<this.nextEvent)return;const type=this.rng.pick(['frenzy','outbreak','double','bounty']);const x=this.rng.range(400,this.size-400),y=this.rng.range(400,this.size-400);
  this.arenaEvent={type,title:({frenzy:'Food frenzy',outbreak:'Virus outbreak',double:'Double growth',bounty:'King hunt'} as Record<string,string>)[type],x,y,radius:340,starts:this.time+5,ends:this.time+30};this.emit('warning',this.arenaEvent.title+' in 5 seconds');this.nextEvent=this.time+45;
 }
 applyEvent(){const a=this.arenaEvent;if(!a||a.starts>this.time||a.starts<0)return;if(a.type==='frenzy')for(let i=0;i<100;i++){const ang=this.rng.range(0,Math.PI*2),d=this.rng.range(0,a.radius);this.addFood(a.x+Math.cos(ang)*d,a.y+Math.sin(ang)*d,6);}if(a.type==='outbreak')for(let i=0;i<8;i++)this.viruses.push({id:this.id(),x:clamp(a.x+this.rng.range(-250,250),60,this.size-60),y:clamp(a.y+this.rng.range(-250,250),60,this.size-60),feeds:0,vx:0,vy:0});a.starts=-1;this.emit('event',a.title.toUpperCase());}
 respawn(id:string){const p=this.players.get(id);if(p&&!p.alive&&!p.spectating)this.spawn(p);}
 spectate(id:string,on:boolean){const p=this.players.get(id);if(!p)return;p.spectating=on;p.cells=[];p.alive=false;if(!on){if(this.config.mode==='duel'&&[...this.players.values()].filter(v=>v.id!==id&&!v.spectating).length>=2){p.spectating=true;return;}this.spawn(p);}this.syncBots();}
 restart(raw?:Partial<RoomSettings>){if(raw)this.config=settings({...this.config,...raw});this.size=this.config.size;this.time=0;this.events=[];this.arenaEvent=null;this.round={number:1,until:0,winner:'',finished:false};this.nextEvent=25;this.leader='';this.rivals.clear();this.lastEat.clear();for(const p of [...this.players.values()])if(p.bot)this.removePlayer(p.id);let i=0;for(const p of this.players.values()){p.cells=[];p.alive=false;p.kills=0;p.score=0;p.wins=0;p.peak=0;p.team=this.config.mode==='coop'?1:this.config.mode==='teams'?(i++%2+1):0;}
  if(this.config.mode==='duel')this.seedDuel();else this.seedArena();i=0;for(const p of this.players.values()){if(this.config.mode==='duel'&&!p.spectating&&i++>=2)p.spectating=true;if(!p.spectating)this.spawn(p);}this.syncBots();}
 snapshot():Snapshot {return {time:this.time,size:this.size,cells:[...this.players.values()].flatMap(p=>p.cells.map(c=>({...c}))),players:[...this.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,skin:p.skin,bot:p.bot,team:p.team,mass:p.cells.reduce((a,c)=>a+c.mass,0),kills:p.kills,score:p.score,alive:p.alive,spectating:p.spectating,shield:p.shieldUntil>this.time,peak:p.peak,born:p.born,lastKiller:p.lastKiller,wins:p.wins,biggest:p.biggest,bestSurvival:p.bestSurvival,deaths:p.deaths,state:p.state})),food:this.food,viruses:this.viruses.map(v=>({...v})),events:this.events,arenaEvent:this.arenaEvent?{...this.arenaEvent}:null,round:{...this.round},teamScores:[...this.teamScores],config:{...this.config}};}
}
export function sanitizeName(value:unknown){return String(value??'Blob').replace(/[<>\u0000-\u001f\u007f]/g,'').trim().slice(0,18)||'Blob';}
