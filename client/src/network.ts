import type { ClientMessage,ServerMessage,Snapshot,Food } from '../../shared/src/types.js';
export function normalizeServerUrl(raw:string){if(!raw.trim())return '';const u=new URL(raw.trim());if(u.protocol==='https:')u.protocol='wss:';if(u.protocol==='http:')u.protocol='ws:';if(!['ws:','wss:'].includes(u.protocol))throw Error('Use a wss:// multiplayer server URL.');if(location.protocol==='https:'&&u.protocol!=='wss:')throw Error('This page needs a secure wss:// server URL.');if(u.username||u.password)throw Error('The server URL must not include a password.');return u.toString();}
export class Network {
 socket:WebSocket|null=null;token='';code='';id='';host='';ping=0;private foods=new Map<number,Food>();private timer:ReturnType<typeof setInterval>|null=null;private generation=0;
 onState:(s:Snapshot)=>void=()=>{};onWelcome:(m:Extract<ServerMessage,{type:'welcome'}>)=>void=()=>{};onStatus:(s:string)=>void=()=>{};onError:(s:string)=>void=()=>{};onClose:()=>void=()=>{};
 connect(url:string,join:Extract<ClientMessage,{type:'join'}>){this.close();const gen=++this.generation;this.foods.clear();let ws:WebSocket;try{ws=new WebSocket(normalizeServerUrl(url));}catch(e){this.onError(e instanceof Error?e.message:'Invalid server URL.');return;}this.socket=ws;let welcomed=false;
  ws.onopen=()=>{if(gen!==this.generation)return;this.onStatus('Connected. Entering arena…');ws.send(JSON.stringify(join));this.timer=setInterval(()=>this.send({type:'ping',stamp:performance.now()}),3000);};
  ws.onmessage=ev=>{if(gen!==this.generation)return;let m:ServerMessage;try{m=JSON.parse(ev.data);}catch{return;}if(m.type==='welcome'){welcomed=true;this.token=m.token;this.code=m.code;this.id=m.id;this.host=m.host;this.onWelcome(m);}else if(m.type==='state'){if(m.foodReset)this.foods.clear();for(const id of m.foodRemove)this.foods.delete(id);for(const f of m.snapshot.food)this.foods.set(f.id,f);this.host=m.host;this.onState({...m.snapshot,food:[...this.foods.values()]});}else if(m.type==='pong'){this.ping=Math.round(performance.now()-m.stamp);}else if(m.type==='error')this.onError(m.message);};
  ws.onerror=()=>{if(gen===this.generation)this.onStatus('Server unavailable or waking up. Bot practice is ready.');};
  ws.onclose=()=>{if(gen!==this.generation)return;if(this.timer)clearInterval(this.timer);this.timer=null;this.socket=null;if(welcomed)this.onClose();else this.onError('Could not reach the server. Check its URL or play with bots.');};
 }
 send(data:ClientMessage){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(data));}
 close(){this.generation++;if(this.timer)clearInterval(this.timer);this.timer=null;this.socket?.close(1000,'Leaving arena');this.socket=null;}
}
