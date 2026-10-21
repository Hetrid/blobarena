import { clamp,direction } from '../../shared/src/math.js';
import { prefs } from './storage.js';
import type { Renderer } from './renderer.js';
export class Input {
 x=0;y=0;eject=false;active=false;private joyPointer=-1;private actionPointers=new Set<number>();private touchPointer=-1;private origin={x:0,y:0};private pointer:{x:number;y:number}|null=null;private keyEject=false;private touchEject=false;
 constructor(private renderer:Renderer,private split:()=>void,private pause:()=>void){
  const joystick=document.querySelector<HTMLElement>('#joystick')!,stick=document.querySelector<HTMLElement>('#stick')!,canvas=renderer.canvas;
  window.addEventListener('mousemove',e=>{if(!this.active||e.buttons>1)return;this.pointer={x:e.clientX,y:e.clientY};});
  window.addEventListener('keydown',e=>{if(!this.active||document.querySelector('dialog[open]')||document.activeElement?.matches('input,select,textarea'))return;if(e.code==='Space'){e.preventDefault();if(!e.repeat)this.split();}if(e.code==='KeyW'){e.preventDefault();this.keyEject=true;}if(e.code==='Escape')this.pause();});
  window.addEventListener('keyup',e=>{if(e.code==='KeyW')this.keyEject=false;});
  window.addEventListener('blur',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  joystick.addEventListener('pointerdown',e=>{if(!this.active)return;e.preventDefault();this.pointer=null;this.joyPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);const r=joystick.getBoundingClientRect();this.origin={x:r.left+r.width/2,y:r.top+r.height/2};this.moveJoy(e,stick,r.width*.33);});
  joystick.addEventListener('pointermove',e=>{if(e.pointerId===this.joyPointer){const r=joystick.getBoundingClientRect();this.moveJoy(e,stick,r.width*.33);}});
  const end=(e:PointerEvent)=>{if(e.pointerId===this.joyPointer){this.joyPointer=-1;this.x=0;this.y=0;stick.style.transform='';}};joystick.addEventListener('pointerup',end);joystick.addEventListener('pointercancel',end);joystick.addEventListener('lostpointercapture',end);
  const splitButton=document.querySelector<HTMLButtonElement>('#splitButton')!,feed=document.querySelector<HTMLButtonElement>('#ejectButton')!;
  splitButton.addEventListener('pointerdown',e=>{if(!this.active)return;e.preventDefault();this.split();});
  feed.addEventListener('pointerdown',e=>{if(!this.active)return;e.preventDefault();this.touchEject=true;this.actionPointers.add(e.pointerId);feed.setPointerCapture(e.pointerId);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])feed.addEventListener(event,e=>{this.actionPointers.delete((e as PointerEvent).pointerId);if(!this.actionPointers.size)this.touchEject=false;});
  canvas.addEventListener('pointerdown',e=>{if(!this.active||e.pointerType==='mouse'||prefs.touchMode!=='touch')return;e.preventDefault();this.touchPointer=e.pointerId;canvas.setPointerCapture(e.pointerId);this.pointer={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointermove',e=>{if(this.touchPointer===e.pointerId)this.pointer={x:e.clientX,y:e.clientY};});
  const touchEnd=(e:PointerEvent)=>{if(e.pointerId===this.touchPointer){this.touchPointer=-1;this.pointer=null;this.x=0;this.y=0;}};canvas.addEventListener('pointerup',touchEnd);canvas.addEventListener('pointercancel',touchEnd);
  canvas.addEventListener('contextmenu',e=>{if(this.active)e.preventDefault();});
 }
 private moveJoy(e:PointerEvent,stick:HTMLElement,max:number){const dx=(e.clientX-this.origin.x)/max,dy=(e.clientY-this.origin.y)/max;const d=direction(dx,dy);this.x=clamp(d.x*prefs.sensitivity,-1,1);this.y=clamp(d.y*prefs.sensitivity,-1,1);stick.style.transform=`translate(${d.x*max}px,${d.y*max}px)`;}
 update(player:{x:number;y:number}|null){if(!this.active){this.x=0;this.y=0;this.eject=false;return;}if(this.pointer&&this.joyPointer<0&&player){const camera=this.renderer.camera;const sx=(player.x-camera.x)*camera.zoom+this.renderer.width/2,sy=(player.y-camera.y)*camera.zoom+this.renderer.height/2;const dx=this.pointer.x-sx,dy=this.pointer.y-sy;const d=direction(dx/65,dy/65);this.x=d.x;this.y=d.y;}this.eject=this.keyEject||this.touchEject;}
 clear(){this.x=0;this.y=0;this.eject=false;this.keyEject=false;this.touchEject=false;this.pointer=null;this.joyPointer=-1;this.touchPointer=-1;this.actionPointers.clear();document.querySelector<HTMLElement>('#stick')!.style.transform='';}
}
