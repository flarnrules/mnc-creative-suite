import {families,familyIds,dragonPoints,treeBranches,treeGenerationLimit} from './fractal-families.mjs?v=0.9.25';
import {motionKeys,cleanTracks,trackValue,applyTracks,cleanRecording,chooseVideoType,easings,cyclePeriods,trackSeam,applyTrackLoop,livingLoopTracks} from './motion-model.mjs?v=0.9.25';
import {LoopGif,loopSample,closeRecording} from './loop-gif.mjs?v=0.9.25';
import {defaults,controls,studies,validate,orbit,transfer,vary,needsCapturedPattern,artworkBaseline,showsOriginalArtwork} from './fold-model.mjs?v=0.9.25';
let hudLast=0,hudFrames=0,hudStart=0,drawMs=0,diagnostics=true;
const embedded=parent!==window;
let mncPaused=false,mncSourceAssetId='';
function report(type,data={}){if(embedded)parent.postMessage({type,...data},location.origin);}
const $=id=>document.getElementById(id),canvas=$('fractal'),status=$('status'),STORE='mnc-fold-lab-v1',SAVED='mnc-fold-discoveries-v1';
const iterativeFamilies=['fold','dragon','triangle','carpet'];
const builtInArt=Array.from($('artChoice').options).find(option=>/^assets\/fractal-art\/(262|demo)\.webp$/.test(option.value));
let loopJob=null,recordedLoop=null,gifUrl=null,videoUrl=null,motionTracks=[],perfBounds={};
let state={...defaults},history=[],playing=false,last=0,dirty=true,gl,program,drag=null,available=false;
try{state=validate(JSON.parse(localStorage.getItem(STORE)));}catch{}
function message(text){status.textContent=text;}
function remember(){history.push({...state});if(history.length>60)history.shift();$('undo').disabled=false;}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(state));}catch{message('Browser storage unavailable. Export settings to keep this pattern.');}}
function showBaselineArtwork(){
 const preview=$('baselineArtwork'),source=!available&&showsOriginalArtwork(state)?state.artSource:'';
 preview.hidden=!source;
 if(source&&preview.getAttribute('src')!==source)preview.src=source;
}
function sync(){
 showBaselineArtwork();
 $('labMode').value=state.labMode;$('livingPanel').hidden=state.labMode!=='living';
 const tree=state.family==='tree', iterated=iterativeFamilies.includes(state.family), escapeFamily=!iterated&&!tree;
 for(const k of ['artFrequency','artDrift','artMemory'])$(k).closest('.field').hidden=state.artMode<4||tree;
 for(const k of ['treeGenerations','treeSpread','treeScale','treeCurl'])$(k).closest('.field').hidden=!tree;
 for(const k of ['artWarp','scale','recurrenceSpin'])$(k).closest('.field').hidden=tree;
 $('geometry').parentElement.hidden=$('dimensions').parentElement.hidden=tree;
 $('artMode').hidden=document.querySelector('label[for=artMode]').hidden=tree;
 $('orbitHost').hidden=tree;
 for(const k of ['power','juliaMorph'])$(k).closest('.field').hidden=!escapeFamily||state.family==='quaternion'||(k==='juliaMorph'&&state.family==='julia');
 $('bailout').closest('.field').hidden=!escapeFamily;
 for(const k of ['quaternionZ','quaternionW'])$(k).closest('.field').hidden=state.family!=='quaternion';
 for(const k of ['dragonTurn','dragonScale'])$(k).closest('.field').hidden=state.family!=='dragon';

 $('seed').disabled=state.family!=='fold'||!!loopJob;$('family').value=state.family;$('familyFormula').textContent=families[state.family].formula;
 $('foldFormula').hidden=state.family!=='fold'||state.dimensionMix>0||state.artMode>=4||state.recurrenceSpin!==0;$('foldTrap').hidden=state.family!=='fold';document.querySelector('label[for=foldTrap]').hidden=state.family!=='fold';
 $('foldGain').closest('.field').hidden=state.family==='dragon';
 for(const k of ['foldX','foldY'])$(k).closest('.field').hidden=state.family!=='fold';
 $('iterations').closest('.field').hidden=!iterated;
 for(const k of ['juliaReal','juliaImag'])$(k).closest('.field').hidden=!escapeFamily;
 $('depth').closest('.field').hidden=!escapeFamily;
 $('artMode').value=state.artMode;$('artChoice').value=state.artSource.startsWith('data:')?'custom':state.artSource;
 $('artStatus').textContent=state.artName?state.artName+' · embedded working texture':'Choose a drawing or import PNG, JPEG or WebP.';
 if(available)ensureArt();
if(loopJob?.mode==='record'){for(const key of motionKeys){$(key).value=state[key];$(key+'Value').value=Number(state[key].toFixed(4));}$('fGain').textContent=state.foldGain.toFixed(4);refreshPerf();dirty=true;return;}for(const key of Object.keys(controls)){ $(key).value=state[key];$(key+'Value').value=Number(state[key].toFixed(4));}$('foldTrap').value=state.foldTrap;$('view').value=state.view;$('foldRadius').closest('.field').hidden=state.family!=='fold'||state.foldTrap!==1;
 for(const [id,key]of Object.entries({fGain:'foldGain',fAngle:'twist',fX:'foldX',fY:'foldY',fScale:'scale',fContrast:'contrast',fPhase:'foldPhase'}))$(id).textContent=Number(state[key].toFixed(4));$('fTrap').textContent=['point','ring','line','cross'][state.foldTrap];$('viewLabel').textContent={spectrum:'SPECTRUM STUDY',mono:'MONOCHROME PATTERN',reverse:'REVERSE-FOIL LAYOUT STUDY'}[state.view];
 const points=orbit(state),bound=Math.max(.01,...points.flat().map(Math.abs)),coords=points.map(([x,y])=>`${150+x/bound*135},${50-y/bound*42}`).join(' ');$('orbit').innerHTML=`<svg viewBox="0 0 300 100" role="img" aria-label="Sample orbit through ${state.iterations} folds"><path d="M150 0V100M0 50H300" stroke="#31434a"/><polyline points="${coords}" fill="none" stroke="#d8bb83" stroke-width="1.2"/>${points.map(([x,y],i)=>`<circle cx="${150+x/bound*135}" cy="${50-y/bound*42}" r="${i===0?3:1.5}" fill="${i===0?'#9be6dc':'#e0be84'}"/>`).join('')}</svg>`;dirty=true;if($('perfParam').options.length)refreshPerf();persist();}
for(const [key,[min,max,step,label,group,help]]of Object.entries(controls)){const field=document.createElement('div');field.className='field';field.innerHTML=`<label for="${key}">${label}<input type="number" id="${key}Value" aria-label="${label} value" min="${min}" max="${max}" step="${step}"></label><input id="${key}" type="range" min="${min}" max="${max}" step="${step}">`;$(group).append(field);const range=$(key),number=$(key+'Value');range.addEventListener('pointerdown',remember);range.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow'))remember();});range.oninput=()=>{state=validate({...state,[key]:Number(range.value)});sync();};number.onchange=()=>{if(number.value.trim()&&Number.isFinite(number.valueAsNumber)){remember();state=validate({...state,[key]:number.valueAsNumber});}sync();};for(const input of [range,number])input.onfocus=()=>{$('explain').textContent=help;};}
for(const key of ['foldTrap','view','artMode'])$(key).onchange=()=>{remember();state=validate({...state,[key]:key!=='view'?Number($(key).value):$(key).value});sync();};
const experiments={
 living:{labMode:'living',family:'fold',artMode:0,colorAmount:.65,colorDrift:0,scale:1.2},
 ink:{family:'fold',artMode:4,artWarp:.2,artFrequency:1.1,artDrift:.41,artMemory:.45,iterations:14,foldGain:1.09,twist:63},
 hyperfold:{family:'fold',artMode:0,dimensionMix:1,sliceZ:.25,sliceW:-.3,rotateXZ:24,rotateXW:38,rotateYW:-17,rotateZW:12,depthWave:.35,iterations:14,foldGain:1.12,twist:60},
 quaternion:{family:'quaternion',artMode:0,juliaReal:-.28,juliaImag:.65,sliceZ:.2,sliceW:.15,rotateXW:18,rotateZW:30,dimensionMix:1,depth:48,twist:0,zoom:1.2}
};
$('applyExperiment').onclick=()=>{remember();pause();const e=experiments[$('experiment').value];state=validate({...defaults,...e,artSource:state.artSource||builtInArt?.value,artName:state.artSource?state.artName:builtInArt?.textContent});$('perfParam').value=e.labMode==='living'?'colorHue':e.dimensionMix?'rotateXW':'artWarp';$('perfPrecision').value='0';sync();refreshPerf(true);if(state.labMode==='living'){setupLivingLoop();playing=true;$('play').textContent='Pause';}message('Experiment loaded. All numeric parameters can be recorded or added to a motion track.');};
$('labMode').onchange=()=>{remember();state=validate({...state,labMode:$('labMode').value});if(state.labMode==='living'&&!state.artSource&&builtInArt){state.artSource=builtInArt.value;state.artName=builtInArt.textContent;}if(state.labMode==='living'){$('perfParam').value='colorHue';$('perfPrecision').value='0';}if(state.labMode==='living'&&!motionTracks.length)setupLivingLoop();sync();refreshPerf(true);};
$('enterDimensions').onclick=()=>{remember();state=validate({...state,dimensionMix:1,rotateXZ:24,rotateXW:35,rotateYW:-17,sliceZ:.2,sliceW:.15});$('perfParam').value='rotateXW';$('perfPrecision').value='0';sync();refreshPerf(true);};
function familyPerformanceKey(family){
 if(family==='tree')return 'treeSpread';
 if(family==='fold')return 'foldGain';
 if(['julia','quaternion'].includes(family))return 'juliaReal';
 return iterativeFamilies.includes(family)?'iterations':'zoom';
}
$('family').onchange=()=>{
 remember();
 const family=$('family').value;
 const tree=family==='tree';
 state=validate({...state,family,zoom:1,foldPanX:0,foldPanY:0,
  labMode:tree?'fractal':state.labMode,fractalAmount:tree&&state.fractalAmount===0?1:state.fractalAmount});
 $('perfParam').value=familyPerformanceKey(state.family);
 $('perfPrecision').value='0';
 sync();refreshPerf(true);
};
$('artChoice').onchange=()=>{if($('artChoice').value==='custom'){$('artFile').click();return;}remember();state=validate({...state,artSource:$('artChoice').value,artName:$('artChoice').selectedOptions[0].textContent,artMode:$('artChoice').value?4:0});sync();};
$('artFile').onchange=async()=>{const file=$('artFile').files[0];if(!file)return;try{if(file.size>20*1024*1024)throw Error('Choose an image smaller than 20 MB.');const bitmap=await createImageBitmap(file);const copy=document.createElement('canvas'),factor=Math.min(1,512/Math.max(bitmap.width,bitmap.height));copy.width=Math.max(1,Math.round(bitmap.width*factor));copy.height=Math.max(1,Math.round(bitmap.height*factor));const ctx=copy.getContext('2d');ctx.fillStyle='#10191d';ctx.fillRect(0,0,copy.width,copy.height);ctx.drawImage(bitmap,0,0,copy.width,copy.height);bitmap.close();remember();state=validate({...state,artSource:copy.toDataURL('image/jpeg',.88),artName:file.name,artMode:4});sync();message('Artwork loaded. Choose Living artwork for color-led animation, or Recursive force to weave it into the fractal.');}catch(e){message(e.message||'Could not read that image.');}$('artFile').value='';};
$('seed').onchange=()=>{remember();state=validate({...state,...defaults,...studies[$('seed').value],artSource:state.artSource,artName:state.artName,artMode:state.artMode});sync();};$('mutate').onclick=()=>{remember();state=vary(state);sync();message('Small variation applied. Undo returns to the previous pattern.');};$('undo').onclick=()=>{if(history.length)state=history.pop();$('undo').disabled=!history.length;sync();};
function pause(){playing=false;$('play').textContent='Animate';persist();}
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Animate';if(!playing)persist();};document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','SUMMARY'].includes(document.activeElement.tagName)){e.preventDefault();$('play').click();}});
$('resetView').onclick=()=>{remember();state.zoom=1;state.foldPanX=state.foldPanY=0;sync();};
$('resetBaseline').onclick=()=>{
 if(loopJob){message('Stop the current take before resetting.');return;}
 remember();pause();state=artworkBaseline(state);sync();
 message(state.artSource?'Artwork baseline. Raise Fractal amount to blend in the pattern.':'Minimal fractal baseline. Choose artwork to blend with the pattern.');
};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(canvas.parentElement.requestFullscreen)await canvas.parentElement.requestFullscreen();else message('Fullscreen is unavailable in this browser.');}catch{message('Fullscreen is unavailable in this browser.');}};
canvas.onpointerdown=e=>{remember();drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;const dx=(e.clientX-drag.x)/canvas.clientHeight*3/state.zoom,dy=-(e.clientY-drag.y)/canvas.clientHeight*3/state.zoom,a=state.family==='tree'?0:state.twist*Math.PI/180;state=validate({...state,foldPanX:state.foldPanX-Math.cos(a)*dx-Math.sin(a)*dy,foldPanY:state.foldPanY+Math.sin(a)*dx-Math.cos(a)*dy});drag={x:e.clientX,y:e.clientY};sync();};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};let lastWheel=0;canvas.addEventListener('wheel',e=>{e.preventDefault();if(performance.now()-lastWheel>250)remember();lastWheel=performance.now();state=validate({...state,zoom:state.zoom*Math.exp(-e.deltaY*.001)});sync();},{passive:false});
function saved(){try{const a=JSON.parse(localStorage.getItem(SAVED)||'[]');return Array.isArray(a)?a.filter(x=>x&&typeof x.name==='string'&&x.state).slice(0,40):[];}catch{return [];}}
function listSaved(){const list=saved();$('saved').replaceChildren(new Option('Choose a discovery',''));list.forEach((x,i)=>$('saved').add(new Option(x.name,String(i))));}
$('saveDiscovery').onclick=()=>{const list=saved();if(list.length>=40){message('40 discoveries saved. Export or delete one before adding another.');return;}const name=$('discoveryName').value.trim()||'Fold study '+(list.length+1);list.push({name,state:{...state},loop:loopRecipe()});try{localStorage.setItem(SAVED,JSON.stringify(list));listSaved();$('saved').value=String(list.length-1);message('Discovery saved on this browser.');}catch{message('Could not save locally. Use Export settings.');}};
$('loadDiscovery').onclick=()=>{if($('saved').value==='')return;const item=saved()[Number($('saved').value)];if(item){remember();pause();state=validate(item.state);restoreLoopRecipe(item.loop);sync();message('Discovery recalled.');}};
$('deleteDiscovery').onclick=()=>{if($('saved').value==='')return;const list=saved();list.splice(Number($('saved').value),1);try{localStorage.setItem(SAVED,JSON.stringify(list));listSaved();message('Discovery deleted. Current pattern is still available.');}catch{message('Could not update browser storage.');}};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('exportJson').onclick=()=>download(new Blob([JSON.stringify({kind:'daily-fold-study',version:1,state,loop:loopRecipe()},null,2)],{type:'application/json'}),'fractal-study.json');$('importJson').onclick=()=>$('jsonFile').click();$('jsonFile').onchange=async()=>{try{const file=$('jsonFile').files[0];if(!file)return;if(file.size>1500000)throw Error();const data=JSON.parse(await file.text());if(data.kind!=='daily-fold-study'||data.version!==1||!data.state||typeof data.state!=='object')throw Error();remember();pause();state=validate(data.state);restoreLoopRecipe(data.loop);sync();message('Settings imported, including any saved loop.');}catch{message('Choose a valid Fractal Lab settings JSON file.');}$('jsonFile').value='';};
$('png').onclick=()=>{if(!available)return;draw();canvas.toBlob(blob=>{if(blob){download(blob,'fractal-study.png');message('PNG exported at '+canvas.width+' × '+canvas.height+'.');}else message('PNG export failed.');},'image/png');};
$('send').onclick=()=>{
 try{
  if(artLoading){message('Artwork is still loading. Try again in a moment.');return;}
  const baked=needsCapturedPattern(state);
  if(baked&&!available){message('A working graphics preview is needed to transfer this pattern.');return;}
  let patternMap='';
  if(baked){draw({...state,view:'mono'},{width:512,height:512});patternMap=canvas.toDataURL('image/png');dirty=true;}
  const recipe={...transfer(state,Number($('coverage').value)),patternMap,transferId:crypto.randomUUID(),
    presetName:$('foilName').value.trim()||$('discoveryName').value.trim()||families[state.family].name};
  if(embedded)report('mnc:fractal-pattern',{recipe,sourceAssetId:mncSourceAssetId});
  else {
   localStorage.setItem('daily-fold-transfer-v1',JSON.stringify(recipe));
   location.href='foil-lab.html?fold=1';
  }
 }catch(error){message(error.message||'Could not transfer this pattern.');}
};
let artTexture,artFieldTexture,artAspect=1,curveTexture,loadedArt=null,artRequest=0,curveKey='',artLoading=false;
let treeCanvas;
function uploadTexture(texture,image){gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);if(image)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
async function ensureArt(){if(loadedArt===state.artSource)return;loadedArt=state.artSource;const token=++artRequest;artLoading=!!loadedArt;if(!loadedArt){uploadTexture(artTexture,null);uploadTexture(artFieldTexture,null);dirty=true;return;}try{const img=new Image();img.src=loadedArt;await img.decode();if(token!==artRequest)return;uploadTexture(artTexture,img);artAspect=img.width/img.height;const field=document.createElement('canvas');field.width=field.height=32;const ctx=field.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,32,32);uploadTexture(artFieldTexture,field);artLoading=false;dirty=true;}catch{if(token===artRequest){artLoading=false;uploadTexture(artTexture,null);uploadTexture(artFieldTexture,null);message('Artwork texture could not load. Re-select or import the artwork.');}}}
function ensureDragon(generation,turn=90,branchScale=1){generation=Math.min(16,Math.round(generation));const key=['dragon',generation,turn,branchScale].join(':');if(key===curveKey)return;curveKey=key;const points=dragonPoints(generation,turn,branchScale);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const [x,y]of points){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d'),factor=920/Math.max(maxX-minX,maxY-minY);ctx.fillStyle='#000';ctx.fillRect(0,0,1024,1024);ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1.1,Math.min(4,factor*.25));ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>{const px=512+(x-(minX+maxX)/2)*factor,py=512+(y-(minY+maxY)/2)*factor;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.stroke();uploadTexture(curveTexture,c);}

function ensureTree({treeGenerations,treeSpread,treeScale,treeCurl}) {
 const generations=Math.max(1,Math.min(treeGenerationLimit,Math.round(treeGenerations)));
 const key=['tree',generations,treeSpread,treeScale,treeCurl].join(':');
 if(key===curveKey)return;
 const layers=treeBranches(treeSpread,treeScale,treeCurl);
 const size=1024;
 if(!treeCanvas){treeCanvas=document.createElement('canvas');treeCanvas.width=treeCanvas.height=size;}
 const ctx=treeCanvas.getContext('2d');
 const points=layers.flat();
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const branch of points){
  for(let i=0;i<branch.length;i+=2){
   minX=Math.min(minX,branch[i]);maxX=Math.max(maxX,branch[i]);
   minY=Math.min(minY,branch[i+1]);maxY=Math.max(maxY,branch[i+1]);
  }
 }
 // Frame the full tree once so adding a generation leaves the trunk in place.
 const factor=884/Math.max(maxX-minX,maxY-minY);
 const x=value=>size/2+(value-(minX+maxX)/2)*factor;
 const y=value=>size/2+(value-(minY+maxY)/2)*factor;
 ctx.fillStyle='#000';ctx.fillRect(0,0,size,size);
 ctx.lineCap='round';ctx.lineJoin='round';
 const paths=layers.slice(0,generations).map(branches=>{
  const path=new Path2D();
  for(const [sx,sy,c1x,c1y,c2x,c2y,ex,ey] of branches){
   path.moveTo(x(sx),y(sy));path.bezierCurveTo(x(c1x),y(c1y),x(c2x),y(c2y),x(ex),y(ey));
  }
  return path;
 });
 for(const [width,light] of [[4.6,.10],[2.3,.24],[1,.94]]){
  for(const [i,path] of paths.entries()){
   ctx.lineWidth=Math.max(1,15*treeScale**i)*width;
   ctx.strokeStyle='rgba(255,255,255,'+light+')';
   ctx.stroke(path);
  }
 }
 uploadTexture(curveTexture,treeCanvas);
 curveKey=key;
}
async function setup(){try{gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL is unavailable. Try a browser with hardware acceleration.');const response=await fetch('fold-kernel.glsl');if(!response.ok)throw Error('Could not load the fold formula. Reload to try again.');const kernel=await response.text();const familyResponse=await fetch('fractal-families.glsl?v=0.9.25');if(!familyResponse.ok)throw Error('Could not load fractal families.');const internalResponse=await fetch('internal-fields.glsl'),livingResponse=await fetch('living-colors.glsl');if(!internalResponse.ok||!livingResponse.ok)throw Error('Could not load the internal or color-layer formulas.');const familyKernel=(await familyResponse.text()).replace('__INTERNAL_FIELDS__',await internalResponse.text());const livingKernel=await livingResponse.text();const vertex='attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';const fragment=`precision highp float;varying vec2 uv;uniform vec2 resolution,offset,pan;uniform float twist,gain,radius,scale,phase,zoom,contrast,hue;uniform int iterations,trap,view;uniform float fractalAmount;${kernel}
${familyKernel}
${livingKernel}
vec3 rainbow(float h){return clamp(abs(fract(vec3(h)+vec3(0.,.666667,.333333))*6.-3.)-1.,0.,1.);}
vec3 originalArt(){
 float aspect=resolution.x/resolution.y;
 vec2 fit=vec2(min(1.,artAspect/aspect),min(1.,aspect/artAspect));
 vec2 at=(uv-.5)/fit+.5;
 if(at.x<0.||at.y<0.||at.x>1.||at.y>1.)return vec3(.025,.04,.055);
 return texture2D(artwork,at).rgb;
}
vec3 withArtwork(vec3 color){
 if(fractalAmount>=1.)return color;
 vec3 original=originalArt();
 if(view==1)original=vec3(dot(original,vec3(.299,.587,.114)));
 return mix(original,color,fractalAmount);
}
void main(){
 if(fractalAmount<=0.){gl_FragColor=vec4(withArtwork(vec3(0.)),1.);return;}
 if(labMode==1){vec3 living=livingColor();if(view==1)living=vec3(dot(living,vec3(.299,.587,.114)));gl_FragColor=vec4(withArtwork(living),1.);return;}float a=twist*.0174533;mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a));vec2 plane=planePoint((uv-.5)*vec2(resolution.x/resolution.y,1.));
 vec2 p=(family==10?plane:rot*plane)*3./zoom+pan;
if(family!=10&&(artMode==2||artMode==3)){vec3 tex=texture2D(artwork,artUV(p)).rgb;float l=dot(tex,vec3(.299,.587,.114))-.5;p+=artWarp*vec2(l,tex.r-tex.b);}
vec2 samplePoint;float v=pow(clamp(fractalValue(p,rot,samplePoint),0.,1.),contrast);
 vec3 color;
 if(family==10){
  vec3 light=rainbow(hue+.065*cos(phase*8.)+v*.14)*.8+.2;
  if(artMode>0)light=mix(light,.23+.77*texture2D(artwork,artUV(p)).rgb,artMix);
  color=mix(vec3(.015,.025,.038),light,v);
 }else{
  color=mix(vec3(.025,.045,.065),rainbow(hue+v*.72)*.8+.2,v);
  if(artMode==1||artMode==3||artMode>=4){vec3 art=texture2D(artwork,artUV(samplePoint)).rgb;color=mix(color,art*(.25+.75*v),artMix);}
 }
if(view==1){float pattern=v;if(family!=10&&(artMode==1||artMode==3||artMode>=4))pattern=mix(v,dot(texture2D(artwork,artUV(samplePoint)).rgb,vec3(.299,.587,.114))*(.25+.75*v),artMix);color=vec3(pattern);}if(view==2){float ratio=.716;vec2 q=abs((uv-.5)*vec2(resolution.x/resolution.y,1.));float card=step(q.x,ratio*.42)*step(q.y,.42);float art=step(q.x,ratio*.34)*step(q.y,.29);color=mix(vec3(.025,.04,.05),color,card);color=mix(color,vec3(.12,.18,.20),art);}gl_FragColor=vec4(withArtwork(color),1.);}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);artTexture=gl.createTexture();artFieldTexture=gl.createTexture();uploadTexture(artFieldTexture,null);curveTexture=gl.createTexture();uploadTexture(artTexture,null);uploadTexture(curveTexture,null);available=true;ensureArt();dirty=true;}catch(error){$('error').hidden=false;$('error').textContent=error.message;message('Preview unavailable. Settings can still be saved.');}}
const locations={};function loc(name){return locations[name]??(locations[name]=gl.getUniformLocation(program,name));}
function draw(renderState=state,output=null){if(!available)return;const drawStart=performance.now();const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(output?.width||canvas.clientWidth*dpr)),h=Math.max(1,Math.round(output?.height||canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.uniform2f(loc('resolution'),w,h);
 gl.uniform1i(loc('family'),familyIds.indexOf(renderState.family));gl.uniform1i(loc('artMode'),renderState.artSource?(renderState.family==='tree'?Number(!artLoading):renderState.artMode):0);gl.uniform1i(loc('depth'),Math.round(renderState.depth));gl.uniform2f(loc('julia'),renderState.juliaReal,renderState.juliaImag);gl.uniform2f(loc('quaternionConstant'),renderState.quaternionZ,renderState.quaternionW);gl.uniform1i(loc('labMode'),renderState.labMode==='living'?1:0);gl.uniform1f(loc('artAspect'),artAspect);const amount=showsOriginalArtwork(renderState)?0:renderState.fractalAmount;
 gl.uniform1f(loc('fractalAmount'),renderState.artSource&&!artLoading?amount:1);
 for(const k of ['rotationZ', 'tiltX', 'tiltY', 'artMix', 'artWarp', 'artFrequency', 'artDrift', 'artMemory', 'dimensionMix', 'sliceZ', 'sliceW', 'rotateXZ', 'rotateXW', 'rotateYW', 'rotateZW', 'depthWave', 'recurrenceSpin', 'power', 'juliaMorph', 'bailout', 'colorAmount', 'colorHue', 'colorPulse', 'colorSaturation', 'colorDrift', 'layerRed', 'layerYellow', 'layerGreen', 'layerCyan', 'layerBlue', 'layerMagenta', 'layerDark'])gl.uniform1f(loc(k),renderState[k]);
 if(renderState.labMode==='fractal'){
  if(renderState.family==='dragon')ensureDragon(renderState.iterations,renderState.dragonTurn,renderState.dragonScale);
  if(renderState.family==='tree')ensureTree(renderState);
 }
 for(const [unit,name,texture]of [[0,'artwork',artTexture],[1,'curveField',curveTexture],[2,'artField',artFieldTexture]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(loc(name),unit);}
 gl.uniform2f(loc('offset'),renderState.foldX,renderState.foldY);gl.uniform2f(loc('pan'),renderState.foldPanX,renderState.foldPanY);for(const [u,k]of Object.entries({twist:'twist',gain:'foldGain',radius:'foldRadius',scale:'scale',phase:'foldPhase',zoom:'zoom',contrast:'contrast',hue:'hue'}))gl.uniform1f(loc(u),renderState[k]);gl.uniform1i(loc('iterations'),renderState.iterations);gl.uniform1i(loc('trap'),renderState.foldTrap);gl.uniform1i(loc('view'),['spectrum','mono','reverse'].indexOf(renderState.view));gl.drawArrays(gl.TRIANGLES,0,6);drawMs=performance.now()-drawStart;updateHud(renderState);dirty=false;}
function frame(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;if(!mncPaused&&!document.hidden){if(loopJob){tickLoop(t);requestAnimationFrame(frame);return;}if(playing){state.foldPhase=(state.foldPhase+dt*.16)%6.283;$('foldPhase').value=state.foldPhase;$('foldPhaseValue').value=state.foldPhase.toFixed(4);$('fPhase').textContent=state.foldPhase.toFixed(4);dirty=true;}if(dirty)draw();}requestAnimationFrame(frame);}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();available=false;showBaselineArtwork();pause();if(loopJob){if(loopJob.mode==='export')loopJob.cancelled=true;else endLoop('Graphics context lost.');}message('Graphics context lost. Reload this page to restore the preview.');});new ResizeObserver(()=>{dirty=true;}).observe(canvas);document.addEventListener('visibilitychange',()=>{last=0;});sync();listSaved();await setup();showBaselineArtwork();requestAnimationFrame(frame);

document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';});

function durationSeconds(){return Math.max(2,Math.min(30,Number($('loopDuration').value)||8));}
function loopOptions(){return {bands:$('trackBands').checked,bandCycles:Math.max(1,Math.min(16,Math.round(Number($('bandCycles').value)||2))),phase:$('loopPhase').checked,hue:$('loopHue').checked,zoom:$('loopZoom').checked,zoomFactor:Math.max(.5,Math.min(2,Number($('zoomFactor').value)||1.4))};}
function sampleMotion(base,t,options=loopOptions()){
 if($('motionSource').value==='tracks')return applyTrackLoop(base,t,motionTracks,durationSeconds(),options);
 return loopSample(base,t,options,$('motionSource').value==='recording'?recordedLoop:null);
}
function perfKey(){return $('perfParam').value||'foldGain';}
function refreshPerf(recenter=false){const key=perfKey(),[min,max,step]=controls[key],precision=controls[key][2]===1?0:Number($('perfPrecision').value);if(recenter||perfBounds.key!==key){perfBounds={key,min:precision?Math.max(min,state[key]-precision):min,max:precision?Math.min(max,state[key]+precision):max};}const slider=$('perfSlider');slider.min=perfBounds.min;slider.max=perfBounds.max;slider.step=controls[key][2]===1?1:Math.min(step,.0001);slider.value=state[key];$('perfValue').min=min;$('perfValue').max=max;$('perfValue').step=step;$('perfValue').value=Number(state[key].toFixed(4));}
function setPerf(value){if(!Number.isFinite(value))return;state=validate({...state,[perfKey()]:value});sync();}
function addTrack(){const key=perfKey();if(motionTracks.some(t=>t.key===key)){message('This parameter already has a track. Use its Take current A/B buttons.');$('motionSection').open=true;return;}
 const [min,max]=controls[key],delta=key==='foldGain'?.02:(max-min)*.12;
 motionTracks=cleanTracks([...motionTracks,{key,from:state[key],to:Math.min(max,state[key]+delta),start:0,span:durationSeconds(),cycles:1,ease:'sine',hold:.05}],durationSeconds());$('motionSource').value='tracks';renderTracks();saveLoopRecipe();$('motionSection').open=true;showDock('motion');}
function renderTracks(){const root=$('motionTracks');root.replaceChildren();for(const [index,t]of motionTracks.entries()){
 const card=document.createElement('div');card.className='motion-track';const [min,max,step,label]=controls[t.key],period=t.mode==='forward'?(cyclePeriods[t.key]||0):0,lower=min-period*8,upper=max+period*8,curveMin=Math.min(t.from,t.to,...t.points.map(p=>p.value)),curveMax=Math.max(t.from,t.to,...t.points.map(p=>p.value));
 card.innerHTML=`<h3>${label}</h3><label><input type="checkbox" data-field="enabled" ${t.enabled?'checked':''}> Enabled</label><label>Loop behavior<select data-field="mode" aria-label="${label}: loop behavior">${[['boomerang','Boomerang · out and back'],['forward','Forward repeat · end → start'],['close','Forward + smooth return']].map(([v,l])=>`<option value="${v}" ${t.mode===v?'selected':''}>${l}</option>`).join('')}</select></label><p>${trackSeam(t)}${t.mode==='close'?' Uses smooth easing at every waypoint and on the return.':''}</p><div class="track-grid">${[['from','Start value',min,max,step],['to','End value',lower,upper,step],['start','Starts at · seconds',0,durationSeconds()-.1,.1],['span','Active time · seconds',.1,durationSeconds(),.1],['cycles','Repeats',1,8,1],['hold','Endpoint hold · 0–0.4',0,.4,.01],...(t.mode==='close'?[['returnFraction','Return fraction · 0.05–0.75',.05,.75,.01]]:[])].map(([key,title,a,b,s])=>`<label>${title}<input aria-label="${label}: ${title}" data-field="${key}" type="number" min="${a}" max="${b}" step="${s}" value="${Number(t[key].toFixed(4))}"></label>`).join('')}</div><label>Easing<select ${t.mode==='close'?'disabled':''} data-field="ease" aria-label="${label}: easing">${Object.keys(easings).map(e=>`<option value="${e}" ${e===t.ease?'selected':''}>${e}</option>`).join('')}</select></label><svg class="motion-curve" viewBox="0 0 240 42" role="img" aria-label="${label} over the master timeline"><polyline fill="none" stroke="#e5c68b" stroke-width="1.5" points="${Array.from({length:121},(_,i)=>{const v=trackValue(t,i/120*durationSeconds(),durationSeconds());return `${i*2},${38-(v-curveMin)/Math.max(.00001,curveMax-curveMin)*34}`;}).join(' ')}"/></svg><div class="actions">${cyclePeriods[t.key]?'<button data-action="cycle">Connect one full cycle</button>':''}<button data-action="a">Take current A</button><button data-action="b">Take current B</button><button data-action="waypoint">+ Waypoint</button><button data-action="remove">Remove</button></div><div class="motion-keys"></div>`;
 card.querySelectorAll('[data-field]').forEach(el=>el.onchange=()=>{t[el.dataset.field]=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:Number(el.value);motionTracks=cleanTracks(motionTracks,durationSeconds());renderTracks();saveLoopRecipe();});
 card.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>{const action=el.dataset.action;if(action==='cycle'){Object.assign(t,{mode:'forward',to:t.from+cyclePeriods[t.key],ease:'linear',hold:0,points:[],start:0,span:durationSeconds()});}else if(action==='remove')motionTracks.splice(index,1);else if(action==='a')t.from=state[t.key];else if(action==='b')t.to=state[t.key];else if(t.points.length<6){const points=[0,...t.points.map(p=>p.t),1];let best=0;for(let i=1;i<points.length-1;i++)if(points[i+1]-points[i]>points[best+1]-points[best])best=i;t.points.push({t:(points[best]+points[best+1])/2,value:state[t.key]});}motionTracks=cleanTracks(motionTracks,durationSeconds());renderTracks();saveLoopRecipe();});
 for(const [i,p]of t.points.entries()){const row=document.createElement('div');row.className='motion-key';row.innerHTML=`<input type="number" aria-label="Waypoint ${i+1} position in forward journey" min="0.01" max="0.99" step="0.01" value="${p.t}"><input type="number" aria-label="Waypoint ${i+1} value" min="${lower}" max="${upper}" step="${step}" value="${Number(p.value.toFixed(4))}"><button aria-label="Remove waypoint ${i+1}">×</button>`;row.children[0].onchange=()=>{p.t=Number(row.children[0].value);motionTracks=cleanTracks(motionTracks,durationSeconds());renderTracks();saveLoopRecipe();};row.children[1].onchange=()=>{p.value=Number(row.children[1].value);motionTracks=cleanTracks(motionTracks,durationSeconds());renderTracks();saveLoopRecipe();};row.children[2].onclick=()=>{t.points.splice(i,1);renderTracks();saveLoopRecipe();};card.querySelector('.motion-keys').append(row);}root.append(card);
 }}
function loopLock(mode){const allowed=new Set(['stopLoop','perfStop','dockStop','closeDock','toolFormula','toolMotion','toggleHud']);if(mode==='record'){for(const key of motionKeys)for(const id of [key,key+'Value'])allowed.add(id);for(const id of ['perfParam','perfPrecision','perfValue','perfSlider','perfCenter'])allowed.add(id);}const locked=[];for(const el of document.querySelectorAll('button,input,select'))if(!allowed.has(el.id)){locked.push([el,el.disabled]);el.disabled=true;}$('stopLoop').disabled=$('perfStop').disabled=false;canvas.style.pointerEvents='none';return locked;}
function finishVideo(job){if(!job.recorder)return;if(job.recorder.state!=='inactive')job.recorder.stop();else job.stream?.getTracks().forEach(t=>t.stop());}
function endLoop(text){if(!loopJob)return;const job=loopJob;loopJob=null;finishVideo(job);state={...job.base};for(const [el,disabled]of job.locked||[])el.disabled=disabled;canvas.style.pointerEvents='';document.body.classList.remove('recording');$('stopLoop').disabled=$('perfStop').disabled=true;$('clearRecording').disabled=!recordedLoop;$('perfTime').textContent='Ready';sync();saveLoopRecipe();$('loopStatus').textContent=text;}
function videoSize(){const edge=Number($('videoSize').value),ratio=canvas.clientWidth/canvas.clientHeight;return {width:Math.max(2,Math.round((ratio>=1?edge:edge*ratio)/2)*2),height:Math.max(2,Math.round((ratio>=1?edge/ratio:edge)/2)*2)};}
function attachVideo(job){if(typeof MediaRecorder==='undefined'||!canvas.captureStream)throw Error('Video recording is unavailable here. Your parameter take and GIF export still work.');const mime=chooseVideoType(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('No supported video encoder. Use GIF export.');job.output=videoSize();draw(state,job.output);job.stream=canvas.captureStream(30);try{job.recorder=new MediaRecorder(job.stream,{mimeType:mime,videoBitsPerSecond:5000000});}catch(error){job.stream.getTracks().forEach(t=>t.stop());throw error;}const chunks=[];job.recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};job.recorder.onerror=()=>{job.videoFailed=true;if(loopJob===job)endLoop('Video encoder failed. Your study is preserved; try GIF export.');};job.recorder.onstop=()=>{job.stream.getTracks().forEach(t=>t.stop());if(job.videoFailed||!chunks.length)return;const type=job.recorder.mimeType||mime,blob=new Blob(chunks,{type}),extension=type.includes('mp4')?'mp4':'webm';if(videoUrl)URL.revokeObjectURL(videoUrl);videoUrl=URL.createObjectURL(blob);$('videoDownload').href=videoUrl;$('videoDownload').download='fractal-'+(job.mode==='record'?'performance':'loop')+'.'+extension;$('videoDownload').textContent='Download '+extension.toUpperCase()+' · '+(blob.size/1048576).toFixed(2)+' MB';$('videoDownload').hidden=false;$('videoPreview').src=videoUrl;$('videoPreview').hidden=false;$('loopSection').open=true;message('Video ready in Record & export. Tap Download to keep it.');};job.recorder.start(250);}
function beginLoop(mode){if(loopJob)return null;if(artLoading){message('Wait for the artwork texture to finish loading.');return null;}if(!available){message('Preview needs WebGL before recording or exporting.');return null;}pause();const job={mode,base:{...state},start:performance.now(),duration:durationSeconds()*1000,options:loopOptions(),samples:[],locked:loopLock(mode),autoBands:$('recordBands').checked};loopJob=job;if(mode==='record'||mode==='video'){document.body.classList.add('recording');if(mode==='video'||$('captureVideo').checked){try{attachVideo(job);}catch(error){if(mode==='video'){endLoop(error.message);return null;}job.output=null;message(error.message);}}}job.start=performance.now();return job;}
function tickLoop(t){const job=loopJob;if(!job||job.mode==='export')return;const elapsed=t-job.start,u=elapsed/job.duration;$('perfTime').textContent=(job.mode==='record'?'● ':'')+(elapsed/1000).toFixed(1)+' / '+(job.duration/1000)+' s';if(job.mode==='preview'||job.mode==='video'){draw(sampleMotion(job.base,Math.min(u,job.mode==='video'?1-1e-8:Infinity),job.options),job.output);$('motionScrub').value=u%1;$('scrubTime').textContent=((u%1)*job.duration/1000).toFixed(2)+' s';if(job.mode==='video'&&u>=1)endLoop('Loop video captured. Preparing download…');return;}
 if(job.autoBands)state.foldPhase=job.base.foldPhase+u*(Math.PI/4)*job.options.bandCycles;job.lastTick=t;
 if(!job.samples.length||elapsed-job.samples.at(-1).time>=40)job.samples.push({time:elapsed,...Object.fromEntries(motionKeys.map(k=>[k,state[k]]))});
 draw(state,job.output);if(elapsed>=job.duration){recordedLoop=closeRecording(job.samples);$('motionSource').value='recording';endLoop('Take saved. Playback retraces it; video keeps the original forward performance.');}
}
$('previewLoop').onclick=()=>{if(beginLoop('preview'))$('loopStatus').textContent='Playing '+$('motionSource').selectedOptions[0].textContent.toLowerCase()+'.';};
$('recordLoop').onclick=()=>{if(beginLoop('record'))$('loopStatus').textContent='Recording every numeric slider. Use the precision controls above.';};
$('clearRecording').onclick=()=>{recordedLoop=null;$('clearRecording').disabled=true;if($('motionSource').value==='recording')$('motionSource').value='tracks';saveLoopRecipe();$('loopStatus').textContent='Take cleared. Tracks and saved discoveries are unchanged.';};
$('stopLoop').onclick=()=>{if(loopJob?.mode==='export'){loopJob.cancelled=true;return;}if(loopJob?.mode==='record'&&loopJob.samples.length>1){recordedLoop=closeRecording(loopJob.samples);$('motionSource').value='recording';}endLoop('Stopped. Saved takes are ready for replay or export.');};
$('exportVideo').onclick=()=>{if(beginLoop('video'))$('loopStatus').textContent='Recording one loop in real time. Keep this tab visible.';};
$('exportGif').onclick=async()=>{const job=beginLoop('export');if(!job)return;try{const edge=Number($('loopSize').value),ratio=canvas.clientWidth/canvas.clientHeight,width=Math.max(1,Math.round(ratio>=1?edge:edge*ratio)),height=Math.max(1,Math.round(ratio>=1?edge/ratio:edge)),fps=Number($('loopFps').value),count=Math.round(job.duration/1000*fps),encoder=new LoopGif(width,height,Number($('loopColors').value)),raw=new Uint8Array(width*height*4),upright=new Uint8Array(raw.length);
 for(let i=0;i<count;i++){if(job.cancelled||!available)throw Error('GIF export cancelled.');draw(sampleMotion(job.base,i/count,job.options),{width,height});gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,raw);if(gl.getError()!==gl.NO_ERROR)throw Error('Graphics readback failed. Try a smaller GIF.');for(let y=0;y<height;y++)upright.set(raw.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);encoder.add(upright,Math.round((i+1)*100/fps)-Math.round(i*100/fps));$('loopStatus').textContent='Encoding '+(i+1)+' / '+count;$('perfTime').textContent=Math.round((i+1)/count*100)+'%';await new Promise(r=>setTimeout(r,0));}
 const blob=encoder.finish();if(gifUrl)URL.revokeObjectURL(gifUrl);gifUrl=URL.createObjectURL(blob);$('gifDownload').href=gifUrl;$('gifDownload').download='kaleidoscope-loop.gif';$('gifDownload').hidden=false;$('gifPreview').src=gifUrl;$('gifPreview').hidden=false;download(blob,'kaleidoscope-loop.gif');endLoop('GIF ready · '+width+' × '+height+' · '+(blob.size/1048576).toFixed(2)+' MB.');}catch(error){endLoop(error.message||'GIF export failed.');}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&loopJob){if(loopJob.mode==='export')loopJob.cancelled=true;else{if(loopJob.mode==='record'&&loopJob.samples.length>1){recordedLoop=closeRecording(loopJob.samples);$('motionSource').value='recording';}endLoop('Stopped when tab was hidden; any partial take was kept.');}}});
function loopRecipe(){return {version:4,source:$('motionSource').value,tracks:motionTracks,options:loopOptions(),recording:recordedLoop,duration:durationSeconds(),size:Number($('loopSize').value),fps:Number($('loopFps').value),colors:Number($('loopColors').value)};}
function restoreLoopRecipe(recipe){recordedLoop=null;motionTracks=[];if(recipe&&typeof recipe==='object'){const o=recipe.options||{};setBandToggles(typeof o.bands==='boolean'?o.bands:o.phase!==false);$('bandCycles').value=Math.max(1,Math.min(16,Math.round(o.bandCycles||2)));for(const [id,key]of [['loopPhase','phase'],['loopHue','hue'],['loopZoom','zoom']])if(typeof o[key]==='boolean')$(id).checked=o[key];if(Number.isFinite(o.zoomFactor))$('zoomFactor').value=Math.max(.5,Math.min(2,o.zoomFactor));if(Number.isFinite(recipe.duration))$('loopDuration').value=Math.max(2,Math.min(30,recipe.duration));for(const [id,key,allowed]of [['loopSize','size',[256,384,512]],['loopFps','fps',[12,20,25]],['loopColors','colors',[64,256]]])if(allowed.includes(recipe[key]))$(id).value=recipe[key];recordedLoop=cleanRecording(recipe.recording);motionTracks=cleanTracks(recipe.tracks,durationSeconds());$('motionSource').value=['generated','tracks','recording'].includes(recipe.source)?recipe.source:recordedLoop?'recording':'generated';}$('clearRecording').disabled=!recordedLoop;renderTracks();}
function saveLoopRecipe(){try{localStorage.setItem('daily-fold-loop-v1',JSON.stringify(loopRecipe()));}catch{message('Local storage is full. Export settings to keep this animation.');}}
for(const key of motionKeys)$('perfParam').add(new Option(controls[key][3],key));$('perfParam').value=familyPerformanceKey(state.family);if(state.family!=='fold')$('perfPrecision').value='0';refreshPerf(true);
$('perfParam').onchange=$('perfPrecision').onchange=()=>refreshPerf(true);$('perfCenter').onclick=()=>refreshPerf(true);$('perfSlider').onpointerdown=remember;$('perfSlider').oninput=()=>setPerf(Number($('perfSlider').value));$('perfValue').onchange=()=>{if($('perfValue').value.trim()){remember();setPerf(Number($('perfValue').value));refreshPerf(true);}};
$('perfRecord').onclick=()=>$('recordLoop').click();$('perfStop').onclick=()=>$('stopLoop').click();$('perfTrack').onclick=$('addMotionTrack').onclick=addTrack;
$('motionExample').onclick=()=>{const g=state.foldGain;motionTracks=cleanTracks([{key:'foldGain',from:g-.015,to:g+.015,start:0,span:durationSeconds(),cycles:1,ease:'sine',hold:.1},{key:'hue',from:state.hue,to:Math.min(1,state.hue+.45),start:0,span:durationSeconds(),cycles:2,ease:'smooth',hold:0}],durationSeconds());$('motionSource').value='tracks';renderTracks();saveLoopRecipe();message('Duet added around your current magnification. Play loop to explore it.');};
$('motionScrub').oninput=()=>{if(loopJob)return;pause();const t=Number($('motionScrub').value);draw(sampleMotion(state,t));$('scrubTime').textContent=(t*durationSeconds()).toFixed(2)+' s';};$('keepFrame').onclick=()=>{remember();state=validate(sampleMotion(state,Number($('motionScrub').value)));sync();refreshPerf(true);message('Timeline frame is now your current pattern. Save it or send it to Foil Lab.');};
try{restoreLoopRecipe(JSON.parse(localStorage.getItem('daily-fold-loop-v1')||'null'));}catch{}
for(const id of ['loopPhase','loopHue','loopZoom','zoomFactor','loopDuration','loopSize','loopFps','loopColors','motionSource'])$(id).addEventListener('change',()=>{motionTracks=cleanTracks(motionTracks,durationSeconds());renderTracks();saveLoopRecipe();});

function setBandToggles(on){for(const id of ['trackBands','recordBands','loopPhase'])$(id).checked=on;}
for(const id of ['trackBands','recordBands','loopPhase'])$(id).addEventListener('change',()=>{setBandToggles($(id).checked);saveLoopRecipe();});
$('bandCycles').addEventListener('change',()=>{ $('bandCycles').value=loopOptions().bandCycles;saveLoopRecipe();});
function setupLivingLoop(){ $('loopDuration').value=12;motionTracks=livingLoopTracks(motionTracks);setBandToggles(true);$('bandCycles').value=2;$('motionSource').value='tracks';renderTracks();saveLoopRecipe();}
$('livingLoop').onclick=()=>{setupLivingLoop();message('12-second strength breath added. Other tracks are retained; bands complete two full cycles.');};
// Move the existing controls, preserving their listeners and saved state.
const dock=$('labDock'),formula=$('foldFormula'),motion=$('motionSection');
const motionShortcut=document.createElement('button');motionShortcut.textContent='06 / Motion studio ↗';motionShortcut.className='motion-shortcut';motion.before(motionShortcut);
$('orbitHost').append($('orbit'));$('formulaHost').append(formula);$('motionHost').append(motion);formula.open=true;motion.open=true;
function showDock(tab){dock.hidden=false;dock.scrollTop=0;$('formulaPane').hidden=tab!=='formula';$('motionHost').hidden=tab!=='motion';$('dockTitle').textContent=tab==='formula'?(state.family==='tree'?'Formula':'Formula & point orbit'):'Motion studio';$('toolFormula').setAttribute('aria-expanded',String(tab==='formula'));$('toolMotion').setAttribute('aria-expanded',String(tab==='motion'));$('inspectorFormula').textContent=families[state.family].formula;}
$('toolFormula').onclick=()=>showDock('formula');$('toolMotion').onclick=motionShortcut.onclick=()=>showDock('motion');
$('dockPlay').onclick=()=>$('previewLoop').click();$('dockStop').onclick=()=>$('stopLoop').click();
$('closeDock').onclick=()=>{dock.hidden=true;for(const id of ['toolFormula','toolMotion'])$(id).setAttribute('aria-expanded','false');};
$('toggleHud').onclick=()=>{diagnostics=!diagnostics;$('toggleHud').setAttribute('aria-pressed',String(diagnostics));document.querySelectorAll('.hud').forEach(el=>el.hidden=!diagnostics);};
// Pin rendered values; DOM diagnostics update at most four times a second.
let orbitSignature='';
function updateHud(s,rendered=true){const now=performance.now();if(rendered)hudFrames++;if(!hudStart)hudStart=now;if(now-hudLast<250)return;hudLast=now;
 $('hudState').textContent=(s.labMode==='living'?'LIVING COLOR':'FRACTAL')+' · '+s.family+'\n'+(s.family==='tree'?'Generations '+Math.round(s.treeGenerations)+' · spread '+s.treeSpread.toFixed(1)+'°':'Gain '+s.foldGain.toFixed(4)+' · phase '+s.foldPhase.toFixed(3));
 $('hudSpeed').textContent=(!available?'WebGL unavailable\n': '')+Math.round(hudFrames*1000/Math.max(1,now-hudStart))+' draws/s\n'+drawMs.toFixed(2)+' ms CPU submit';hudStart=now;hudFrames=0;
 const elapsed=loopJob?(now-loopJob.start)/1000:0;$('hudTime').textContent=(loopJob?loopJob.mode.toUpperCase()+' · '+(elapsed%(loopJob.duration/1000)).toFixed(1)+' / '+(loopJob.duration/1000)+' s':playing?'ANIMATING':'PAUSED')+'\n'+motionTracks.filter(t=>t.enabled).length+' active tracks';
 $('hudRender').textContent=canvas.width+' × '+canvas.height+'\nStrength '+s.colorAmount.toFixed(3)+' · drift '+(s.colorDrift*100).toFixed(2)+'%';
 if(!dock.hidden){$('inspectorFormula').textContent=families[s.family].formula;
  if(!$('formulaPane').hidden){
   for(const [id,key]of Object.entries({fGain:'foldGain',fAngle:'twist',fX:'foldX',fY:'foldY',fScale:'scale',fContrast:'contrast',fPhase:'foldPhase'}))$(id).textContent=Number(s[key].toFixed(4));
   const signature=[s.iterations,s.foldGain,s.twist,s.foldX,s.foldY].join(':');
   if(signature!==orbitSignature){orbitSignature=signature;const points=orbit(s),bound=Math.max(.01,...points.flat().map(Math.abs));$('orbit').innerHTML='<svg viewBox="0 0 300 100" role="img" aria-label="Reference fold orbit"><polyline fill="none" stroke="#e5c68b" stroke-width="1.4" points="'+points.map(([x,y])=>`${150+x/bound*135},${50-y/bound*42}`).join(' ')+'"/></svg>';}
  }
 }
}
if(state.labMode==='living'&&!motionTracks.length)setupLivingLoop();

updateHud(state,false);

if(embedded){
 $('mncFoilLink').onclick=e=>{e.preventDefault();report('mnc:open-foil');};
 $('mncSaveFrame').hidden=false;
 $('mncSaveFrame').onclick=()=>{
  if(!available||artLoading)return message('Wait until the artwork and renderer are ready.');
  draw();
  report('mnc:fractal-frame',{image:canvas.toDataURL('image/png'),title:state.artName||families[state.family].name,sourceAssetId:mncSourceAssetId});
  message('Saved the current frame to the MNC artwork list.');
 };
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin||!e.data)return;
  if(e.data.type==='mnc:fractal-pause'){
   mncPaused=!e.data.active;
   if(mncPaused&&loopJob){
    if(loopJob.mode==='export')loopJob.cancelled=true;
    else endLoop('Stopped because the lab was hidden.');
   }
   if(!mncPaused)dirty=true;
   return;
  }
  if(e.data.type!=='mnc:fractal-art'||!/^data:image\/(png|jpeg|webp);base64,/i.test(e.data.image||''))return;
  if(loopJob){message('Stop the current take before changing artwork.');return;}
  remember();
  mncSourceAssetId=e.data.id;
  state=validate({...state,artSource:e.data.image,artName:String(e.data.title||'MNC artwork'),artMode:state.labMode==='living'?0:4});
  sync();message('MNC artwork loaded · '+state.artName);
  report('mnc:fractal-loaded',{title:state.artName,webgl:available});
 });
 $('artFile').addEventListener('change',()=>{mncSourceAssetId='';});
 $('artChoice').addEventListener('change',()=>{mncSourceAssetId='';});
 report('mnc:fractal-ready',{webgl:available});
}
