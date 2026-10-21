import { prefs } from './storage.js';
export class Audio {
 private ctx:AudioContext|null=null;private lastEat=0;private musicTimer:ReturnType<typeof setInterval>|null=null;private note=0;
 unlock(){try{this.ctx??=new window.AudioContext();void this.ctx.resume().catch(()=>{});if(!this.musicTimer)this.musicTimer=setInterval(()=>this.music(),900);}catch{}}
 play(type:string){if(!this.ctx||this.ctx.state!=='running'||prefs.soundVolume<=0)return;const now=this.ctx.currentTime;if(type==='eat'&&now-this.lastEat<.09)return;if(type==='eat')this.lastEat=now;
  const frequencies:Record<string,number[]>={eat:[420,620],split:[260,100],eject:[230,170],kill:[420,630,840],death:[300,180,100],achievement:[420,540,660,840],click:[520],virus:[100,80,60],round:[330,440,550,660]};const notes=frequencies[type]??[400];
  notes.forEach((f,i)=>this.tone(f,now+i*.065,type==='virus'?'triangle':'sine',.1,prefs.soundVolume*.08));
 }
 private tone(freq:number,at:number,type:OscillatorType,length:number,gain:number){if(!this.ctx)return;const osc=this.ctx.createOscillator(),amp=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,at);osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.8),at+length);amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),at+.01);amp.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(amp);amp.connect(this.ctx.destination);osc.start(at);osc.stop(at+length+.05);}
 private music(){if(!this.ctx||this.ctx.state!=='running'||prefs.musicVolume<=0||document.hidden)return;const n=[130.81,164.81,196,261.63,196,164.81,146.83,196][this.note++%8];this.tone(n,this.ctx.currentTime,'sine',1.6,prefs.musicVolume*.035);}
}
