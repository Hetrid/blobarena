export const TUNE = {
  tick: 25, snapshotEvery: 2, arena: 3000, food: 820, viruses: 14,
  spawnMass: 42, foodMass: 2.5, radiusScale: 4.1, eatRatio: 1.18,
  maxCells: 16, minSplit: 46, splitImpulse: 740, splitCooldown: .6,
  mergeBase: 10, mergeMass: .015, ejectCost: 13, ejectMass: 10,
  ejectCooldown: .16, decayAbove: 180, decayPerSecond: .0035,
  spawnShield: 2.8, virusMass: 110, virusFeeds: 5, maxHumans: 20,
  duelMass: 135, vision: 1050, maxMass: 80000
} as const;
export const COLORS = ['#a6ed64','#b48aff','#58d9ed','#ff9e5f','#ff7196','#ffe26b','#739eff','#62e6b4'];
export const MODES = ['classic','duel','coop','chaos','teams'] as const;
export type Mode = typeof MODES[number];
export type Difficulty = 'mixed'|'easy'|'normal'|'hard'|'expert';
export const SKILLS = {
 easy:{reaction:.72,predict:.05,risk:.95,split:.1},
 normal:{reaction:.42,predict:.25,risk:1.15,split:.35},
 hard:{reaction:.24,predict:.5,risk:1.35,split:.65},
 expert:{reaction:.16,predict:.7,risk:1.5,split:.9}
};
export interface RoomSettings { mode:Mode; bots:number; difficulty:Difficulty; size:number; events:boolean }
export const DEFAULT_SETTINGS:RoomSettings = {mode:'classic',bots:9,difficulty:'mixed',size:3000,events:true};
export function settings(raw:Partial<RoomSettings> = {}):RoomSettings {
 const mode=MODES.includes(raw.mode as Mode)?raw.mode!:'classic';
 return {mode,bots:Math.min(18,Math.max(0,Math.floor(Number.isFinite(raw.bots)?raw.bots!:mode==='duel'?0:9))),difficulty:raw.difficulty && ['mixed','easy','normal','hard','expert'].includes(raw.difficulty)?raw.difficulty:'mixed',size:Math.min(5000,Math.max(1800,Number.isFinite(raw.size)?raw.size!:mode==='duel'?2000:3000)),events:raw.events!==false};
}
export function radius(mass:number){ return Math.sqrt(Math.max(1,mass))*TUNE.radiusScale; }
export function speed(mass:number){ return 290*Math.pow(Math.max(20,mass)/35,-.17); }
