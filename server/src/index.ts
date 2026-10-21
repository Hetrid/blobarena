import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer,WebSocket } from 'ws';
import { Engine } from '../../shared/src/engine.js';
import { settings,TUNE } from '../../shared/src/config.js';
import type { RoomSettings } from '../../shared/src/config.js';
import type { ClientMessage,ServerMessage,Food } from '../../shared/src/types.js';
interface Room {code:string;public:boolean;engine:Engine;host:string;emptySince:number}
interface Session {id:string;token:string;room:Room;socket:WebSocket|null;expires:number;food:Map<number,string>;seq:number}
interface Peer {socket:WebSocket;session?:Session;alive:boolean;count:number;window:number;lastSeen:number}
export function startServer(port=Number(process.env.PORT)||3001,host='0.0.0.0'){
 const rooms=new Map<string,Room>(),sessions=new Map<string,Session>(),peers=new Set<Peer>();
 const allowed=(process.env.ALLOWED_ORIGINS||'http://localhost:4173,http://127.0.0.1:4173').split(',').map(v=>v.trim());
 const maxRooms=Number(process.env.MAX_ROOMS)||30,maxClients=Number(process.env.MAX_CLIENTS)||100;
 const server=createServer((req,res)=>{if(req.url==='/health'||req.url==='/'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:true,game:'Blob Arena',rooms:rooms.size,players:sessions.size}));}else{res.writeHead(404);res.end('Not found');}});
 const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{const origin=req.headers.origin;if(origin&&!allowed.includes(origin)){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}if(peers.size>=maxClients){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
 const send=(ws:WebSocket,data:ServerMessage)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<512000)ws.send(JSON.stringify(data));};
 const error=(peer:Peer,message:string)=>send(peer.socket,{type:'error',message});
 function newRoom(config:Partial<RoomSettings>,isPublic=false){if(rooms.size>=maxRooms)throw Error('All arenas are busy. Try again shortly.');let code='';do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));const engine=new Engine(config);const room:Room={code,public:isPublic,engine,host:'',emptySince:Date.now()};rooms.set(code,room);return room;}
 wss.on('connection',(socket)=>{
  const peer:Peer={socket,alive:true,count:0,window:Date.now(),lastSeen:Date.now()};peers.add(peer);
  socket.on('pong',()=>{peer.alive=true;});socket.on('error',()=>{});
  socket.on('message',(raw)=>{
   const now=Date.now();if(now-peer.window>1000){peer.window=now;peer.count=0;}if(++peer.count>80){socket.close(1008,'Too many messages');return;}peer.lastSeen=now;
   let m:ClientMessage;try{m=JSON.parse(raw.toString());if(!m||typeof m!=='object'||Array.isArray(m))return error(peer,'Invalid message.');}catch{return error(peer,'Invalid JSON.');}
   if(m.type==='ping'){if(Number.isFinite(m.stamp))send(socket,{type:'pong',stamp:m.stamp});return;}
   if(m.type==='join'){
    if(peer.session)return error(peer,'Already in a room.');
    try{
     if(m.token&&typeof m.token==='string'){const old=sessions.get(m.token);if(old&&old.expires>now&&(!m.code||m.code===old.room.code)){if(old.socket&&old.socket!==socket)old.socket.close(4000,'Reconnected in another tab');old.socket=socket;old.expires=Infinity;old.food.clear();old.seq=-1;peer.session=old;send(socket,{type:'welcome',id:old.id,token:old.token,code:old.room.code,host:old.room.host,settings:old.room.engine.config,resumed:true});return;}}
     if(!['quick','create','join'].includes(m.action))return error(peer,'Unknown join action.');
     const config=settings(m.settings);let room:Room|undefined;
     if(m.action==='join')room=rooms.get(String(m.code??'').toUpperCase());
     else if(m.action==='quick')room=[...rooms.values()].find(r=>r.public&&r.engine.config.mode===config.mode&&[...r.engine.players.values()].filter(p=>!p.bot).length<12)??newRoom(config,true);
     else room=newRoom(config);
     if(!room)return error(peer,'Room not found. Check the invitation code.');
     if([...room.engine.players.values()].filter(p=>!p.bot).length>=TUNE.maxHumans)return error(peer,'That room is full.');
     const id=randomBytes(6).toString('hex'),token=randomBytes(24).toString('hex');
     const duelBefore=[...room.engine.players.values()].filter(p=>!p.spectating).length;room.engine.addPlayer(id,m.name,{color:m.color,skin:m.skin,spectate:!!m.spectate});room.engine.syncBots();if(room.engine.config.mode==='duel'&&duelBefore<2&&[...room.engine.players.values()].filter(p=>!p.spectating).length===2)room.engine.restart();if(!room.host)room.host=id;room.emptySince=0;
     const session:Session={id,token,room,socket,expires:Infinity,food:new Map(),seq:-1};sessions.set(token,session);peer.session=session;
     send(socket,{type:'welcome',id,code:room.code,token,host:room.host,settings:room.engine.config,resumed:false});
    }catch(e){error(peer,e instanceof Error?e.message:'Unable to join.');}return;
   }
   const s=peer.session;if(!s||s.socket!==socket)return error(peer,'Join a room first.');const e=s.room.engine;
   switch(m.type){
    case 'input':if(Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isSafeInteger(m.seq)&&m.seq>s.seq){s.seq=m.seq;e.input(s.id,m.x,m.y,!!m.eject);}break;
    case 'split':e.split(s.id);break;
    case 'respawn':e.respawn(s.id);break;
    case 'spectate':e.spectate(s.id,!!m.enabled);break;
    case 'restart':case 'settings':if(s.room.host!==s.id){error(peer,'Only the room host can change the arena.');return;}if(m.type==='settings'){if(!m.settings||typeof m.settings!=='object')return;e.restart(m.settings);}else e.restart();for(const v of sessions.values())if(v.room===s.room)v.food.clear();break;
    default:error(peer,'Unknown message.');
   }
  });
  socket.on('close',()=>{peers.delete(peer);const s=peer.session;if(s&&s.socket===socket){s.socket=null;s.expires=Date.now()+20000;s.room.engine.input(s.id,0,0,false);}});
 });
 let tick=0;
 const interval=setInterval(()=>{
  const now=Date.now();for(const [token,s]of sessions){if(s.expires<now){sessions.delete(token);s.room.engine.removePlayer(s.id);s.room.engine.syncBots();if(s.room.host===s.id)s.room.host=[...sessions.values()].find(v=>v.room===s.room)?.id??'';}}
  for(const [code,room]of rooms){const active=[...sessions.values()].some(s=>s.room===room);if(!active){if(!room.emptySince)room.emptySince=now;if(now-room.emptySince>60000){rooms.delete(code);continue;}}else room.emptySince=0;
   room.engine.step();room.engine.applyEvent();
   if(tick%TUNE.snapshotEvery!==0)continue;
   const full=room.engine.snapshot();for(const s of sessions.values()){if(s.room!==room||!s.socket||s.socket.readyState!==WebSocket.OPEN||s.socket.bufferedAmount>512000)continue;
    const reset=s.food.size===0;const next=new Map<number,string>(),add:Food[]=[];for(const f of full.food){const signature=`${Math.round(f.x)},${Math.round(f.y)}`;next.set(f.id,signature);if(s.food.get(f.id)!==signature)add.push(f);}
    const removed=[...s.food.keys()].filter(id=>!next.has(id));send(s.socket,{type:'state',snapshot:{...full,food:add},foodRemove:removed,foodReset:reset,host:room.host});s.food=next;
   }
  }tick++;
 },1000/TUNE.tick);
 const heartbeat=setInterval(()=>{const now=Date.now();for(const p of peers){if(!p.alive||(!p.session&&now-p.lastSeen>15000)){p.socket.terminate();continue;}p.alive=false;p.socket.ping();}},15000);
 server.listen(port,host);
 const close=()=>new Promise<void>(resolve=>{clearInterval(interval);clearInterval(heartbeat);for(const p of peers)p.socket.terminate();wss.close();server.close(()=>resolve());});
 return {server,wss,rooms,sessions,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const running=startServer();running.server.on('listening',()=>console.log(`Blob Arena server listening on ${JSON.stringify(running.server.address())}`));process.on('SIGTERM',()=>{void running.close().then(()=>process.exit(0));});}
