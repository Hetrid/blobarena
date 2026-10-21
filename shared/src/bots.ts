import { radius,SKILLS,TUNE } from './config.js';
import { center,distance,direction } from './math.js';
import type { Engine } from './engine.js';
import type { Player } from './types.js';
export function thinkBot(e:Engine,p:Player){
 if(!p.alive || p.spectating || e.time<p.nextThink)return;
 const skill=SKILLS[p.difficulty];p.nextThink=e.time+skill.reaction*e.rng.range(.8,1.25);
 const at=center(p.cells),largest=p.cells.reduce((a,b)=>a.mass>b.mass?a:b),r=radius(largest.mass);
 const visible=e.cellsGrid.query(at.x,at.y,TUNE.vision).filter(c=>c.owner!==p.id && distance(at,c)<TUNE.vision);
 let fleeX=0,fleeY=0,danger=0;let prey:typeof largest|undefined;let preyUtility=-Infinity;
 for(const c of visible){const other=e.players.get(c.owner)!;if(e.friendly(p,other)||other.shieldUntil>e.time)continue;
  const d=distance(at,c),cr=radius(c.mass);
  if(c.mass>largest.mass*TUNE.eatRatio){const reach=cr+320*(skill.risk)+(p.personality==='survivor'?180:0);if(d<reach){const u=(reach-d)/reach;fleeX+=(at.x-c.x)/(d||1)*u;fleeY+=(at.y-c.y)/(d||1)*u;danger+=u;}}
  else if(largest.mass>c.mass*TUNE.eatRatio){const utility=c.mass/(d+80)*(p.personality==='hunter'?2.4:p.personality==='opportunist'&&other.cells.length>1?2:1);if(utility>preyUtility){prey=c;preyUtility=utility;}}
 }
 let dx=0,dy=0;
 if(danger>.08){dx=fleeX;dy=fleeY;p.state='evading';
  // Escape around a virus if small enough to shelter there.
  if(largest.mass<TUNE.virusMass*.9 && p.personality==='strategist'){const cover=e.viruses.find(v=>distance(at,v)<330);if(cover){dx+=(cover.x-at.x)/220;dy+=(cover.y-at.y)/220;}}
 }else if(prey && p.personality!=='farmer' && distance(at,prey)<(p.personality==='survivor'?300:740)){
  const owner=e.players.get(prey.owner)!;dx=prey.x+owner.input.x*100*skill.predict-at.x;dy=prey.y+owner.input.y*100*skill.predict-at.y;p.state='hunting';
  const d=distance(at,prey);
  if(p.shieldUntil<e.time&&largest.mass/2>prey.mass*1.32 && p.cells.length<4 && d>r*.8 && d<r+290 && e.rng.next()<skill.split && danger===0){p.input=direction(dx,dy);e.split(p.id);}
 }else{
  let best=-Infinity;let tx=p.target.x,ty=p.target.y;
  // Evaluate food clusters, not just the nearest pellet. Ejected mass is attractive.
  const food=e.foodGrid.query(at.x,at.y,750);
  for(let i=0;i<food.length;i+=Math.max(1,Math.floor(food.length/36))){const f=food[i];if(distance(at,f)>TUNE.vision)continue;let density=0;for(const n of e.foodGrid.query(f.x,f.y,105))if(distance(f,n)<105)density+=n.mass;
   const u=(density+f.mass*3)/(distance(at,f)+100);if(u>best){best=u;tx=f.x;ty=f.y;}}
  if(!food.length || distance(at,{x:tx,y:ty})<20){tx=e.rng.range(100,e.size-100);ty=e.rng.range(100,e.size-100);}
  p.target={x:tx,y:ty};dx=tx-at.x;dy=ty-at.y;p.state='foraging';
  if(p.personality==='team'&&p.team){const ally=[...e.players.values()].find(a=>a.id!==p.id&&a.team===p.team&&a.alive&&a.cells[0]?.mass>largest.mass*1.6&&distance(at,center(a.cells))<230);if(ally&&largest.mass>65){const c=center(ally.cells);dx=c.x-at.x;dy=c.y-at.y;p.eject=e.rng.next()<.38;p.state='supporting';}else p.eject=false;}
 }
 // Steer around dangerous viruses, and keep a buffer from arena walls.
 const desired=direction(dx,dy);dx=desired.x;dy=desired.y;
 for(const v of e.viruses){const d=distance(at,v),safe=r+radius(TUNE.virusMass)+100;if(largest.mass>TUNE.virusMass*TUNE.eatRatio&&d<safe){const force=(safe-d)/safe*3;dx+=(at.x-v.x)/(d||1)*force;dy+=(at.y-v.y)/(d||1)*force;}}
 const margin=r+85;if(at.x<margin)dx+=(margin-at.x)/90;if(at.y<margin)dy+=(margin-at.y)/90;if(at.x>e.size-margin)dx-=(at.x-e.size+margin)/90;if(at.y>e.size-margin)dy-=(at.y-e.size+margin)/90;
 p.input=direction(dx,dy);
}
