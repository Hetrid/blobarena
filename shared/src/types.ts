import type { RoomSettings, Difficulty } from './config.js';
export interface Vec { x:number; y:number }
export interface Cell extends Vec { id:number; owner:string; mass:number; vx:number; vy:number; mergeAt:number }
export interface Food extends Vec { id:number; mass:number; color:number; vx:number; vy:number; born:number; from?:string }
export interface Virus extends Vec { id:number; feeds:number; vx:number; vy:number }
export type Personality='hunter'|'survivor'|'farmer'|'opportunist'|'strategist'|'team';
export interface Player {
 id:string; name:string; color:string; skin:number; bot:boolean; team:number;
 cells:Cell[]; input:Vec; eject:boolean; nextSplit:number; nextEject:number;
 shieldUntil:number; born:number; kills:number; streak:number; peak:number;
 score:number; deaths:number; lastKiller:string; biggest:number; bestSurvival:number;
 alive:boolean; spectating:boolean; respawnAt:number; difficulty:Exclude<Difficulty,'mixed'>;
 personality:Personality; nextThink:number; target:Vec; state:string; wins:number;
}
export interface PlayerView { id:string; name:string; color:string; skin:number; bot:boolean; team:number; mass:number; kills:number; score:number; alive:boolean; spectating:boolean; shield:boolean; peak:number; born:number; lastKiller:string; wins:number; biggest:number; bestSurvival:number; deaths:number; state:string }
export interface GameEvent { id:number; time:number; kind:string; text:string; x?:number; y?:number; color?:string; actor?:string; victim?:string; mass?:number; revenge?:boolean; king?:boolean }
export interface ArenaEvent { type:string; title:string; x:number; y:number; radius:number; starts:number; ends:number }
export interface Snapshot { time:number; size:number; cells:Cell[]; players:PlayerView[]; food:Food[]; viruses:Virus[]; events:GameEvent[]; arenaEvent:ArenaEvent|null; round:{number:number; until:number; winner:string; finished:boolean}; teamScores:number[]; config:RoomSettings }
export type ClientMessage =
 | {type:'join'; action:'quick'|'create'|'join'; code?:string; name:string; color:string; skin:number; settings?:Partial<RoomSettings>; spectate?:boolean; token?:string}
 | {type:'input'; x:number; y:number; eject:boolean; seq:number}
 | {type:'split'} | {type:'respawn'} | {type:'spectate'; enabled:boolean}
 | {type:'settings'; settings:Partial<RoomSettings>} | {type:'restart'} | {type:'ping'; stamp:number};
export type ServerMessage =
 | {type:'welcome'; id:string; code:string; token:string; host:string; settings:RoomSettings; resumed:boolean}
 | {type:'state'; snapshot:Snapshot; foodRemove:number[]; foodReset:boolean; host:string}
 | {type:'error'; message:string}
 | {type:'pong'; stamp:number};
