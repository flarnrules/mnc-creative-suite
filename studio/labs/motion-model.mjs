import {controls} from './fold-model.mjs';
export const cyclePeriods={hue:1,foldPhase:Math.PI/4,rotationZ:360,twist:360,recurrenceSpin:360,rotateXZ:360,rotateXW:360,rotateYW:360,rotateZW:360};
export function trackSeam(t){if(t.mode!=='forward')return t.mode==='close'?'Smooth return connects the end to the start.':'Retraces the journey.';const period=cyclePeriods[t.key],delta=t.to-t.from;const joined=Math.abs(delta)<1e-8||(period&&Math.abs(delta/period-Math.round(delta/period))<1e-7);return joined?'Endpoints connect. Linear easing with no hold gives steady cyclic motion.':'Visible seam likely: end and start differ. Use a full cycle or smooth return.';}
export const motionKeys=Object.keys(controls);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f)=>Number.isFinite(v)?v:f;
export const easings={linear:t=>t,smooth:t=>t*t*(3-2*t),sine:t=>(1-Math.cos(Math.PI*t))/2,in:t=>t*t,out:t=>1-(1-t)*(1-t),hold:t=>t<1?0:1};
export function cleanTracks(input,duration=8){
 if(!Array.isArray(input))return [];duration=clamp(finite(duration,8),.2,3600);const used=new Set();
 return input.slice(0,motionKeys.length).filter(t=>t&&motionKeys.includes(t.key)&&!used.has(t.key)&&used.add(t.key)).map(t=>{
  const [min,max]=controls[t.key],mode=['forward','close'].includes(t.mode)?t.mode:'boomerang',period=mode==='forward'?cyclePeriods[t.key]||0:0;
  const lower=min-8*period,upper=max+8*period,start=clamp(finite(t.start,0),0,duration-.1),span=clamp(finite(t.span,duration-start),.1,duration-start);
  return {key:t.key,mode,returnFraction:clamp(finite(t.returnFraction,.25),.05,.75),from:clamp(finite(t.from,min),min,max),to:clamp(finite(t.to,max),lower,upper),start,span,cycles:clamp(Math.round(finite(t.cycles,1)),1,8),ease:Object.hasOwn(easings,t.ease)?t.ease:'sine',hold:clamp(finite(t.hold,0),0,.4),enabled:t.enabled!==false,points:Array.isArray(t.points)?t.points.slice(0,6).filter(p=>p&&Number.isFinite(p.t)&&Number.isFinite(p.value)).map(p=>({t:clamp(p.t,.01,.99),value:clamp(p.value,lower,upper)})).sort((a,b)=>a.t-b.t).filter((p,i,a)=>!i||p.t>a[i-1].t):[]};
 });
}
export function trackValue(track,seconds,duration){
 const t=((seconds%duration)+duration)%duration;let value=track.from;
 if(t>=track.start&&t<track.start+track.span){
  const p=((t-track.start)/track.span*track.cycles)%1,mode=track.mode||'boomerang',join=1-(track.returnFraction||.25);
  if(mode==='close'&&p>=join){const u=(p-join)/(1-join),smooth=u*u*u*(u*(u*6-15)+10);value=track.to+(track.from-track.to)*smooth;}
  else{
   const journey=mode==='boomerang'?1-Math.abs(2*p-1):mode==='close'?p/join:p;
   const f=clamp((journey-track.hold)/(1-2*track.hold),0,1),points=[{t:0,value:track.from},...track.points,{t:1,value:track.to}];
   let i=0;while(i<points.length-2&&f>points[i+1].t)i++;
   const a=points[i],b=points[i+1],u=clamp((f-a.t)/(b.t-a.t),0,1);
   // Smooth endpoint velocity for the closed journey, even with linear easing selected.
   const eased=mode==='close'?u*u*u*(u*(u*6-15)+10):easings[track.ease](u);
   value=a.value+(b.value-a.value)*eased;
  }
 }
 if(['iterations','depth'].includes(track.key))value=Math.round(value);return value;
}
export function applyTracks(base,seconds,tracks,duration){const s={...base};for(const t of tracks)if(t.enabled)s[t.key]=trackValue(t,seconds,duration);return s;}
export function cleanRecording(input){if(!Array.isArray(input)||input.length<2||input.length>1600)return null;const filtered=input.filter(p=>p&&typeof p==='object');const timed=filtered.length>1&&filtered[0].at===0&&filtered.every((p,i)=>Number.isFinite(p.at)&&p.at>=0&&p.at<1&&(!i||p.at>filtered[i-1].at));return filtered.map(p=>({...Object.fromEntries(motionKeys.filter(k=>Number.isFinite(p[k])).map(k=>[k,Math.max(controls[k][0],Math.min(k==='foldPhase'?30:controls[k][1],p[k]))])),...(timed?{at:p.at}:{})}));}
export function chooseVideoType(supported){return ['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(supported)||'';}

// One shared, deterministic clock for preview and frame-by-frame exports.
export function applyTrackLoop(base,t,tracks,duration,options={}){
 const u=((t%1)+1)%1,s=applyTracks(base,u*duration,tracks,duration);
 if(options.bands!==false&&!tracks.some(track=>track.enabled&&track.key==='foldPhase'))s.foldPhase=base.foldPhase+u*(Math.PI/4)*Math.max(1,Math.min(16,Math.round(options.bandCycles||2)));
 return s;
}
export function livingLoopTracks(tracks=[]){return cleanTracks([...tracks.filter(t=>t.key!=='colorAmount'),{key:'colorAmount',from:0,to:1,start:0,span:12,cycles:1,mode:'boomerang',ease:'sine',hold:0}],12);}
