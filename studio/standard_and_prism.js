/* MNC Creative Suite v0.5 — standard card layout + bridge to ORIGINAL Daily Prism v0.8 */
'use strict';
(() => {
 const el = id => document.getElementById(id);
 const defaults = {x:.07,y:.14,w:.86,h:.52};
 const num = (v,a,b) => Math.min(b,Math.max(a,Number(v)));
 const current = () => cardById(currentId);
 const windowOf = c => ({...defaults,...c.artWindow});
 const baseRect = c => {const b=windowOf(c);return MNC_ARTWORK.rect(c,{x:b.x*CW,y:b.y*CH,w:b.w*CW,h:b.h*CH})};
 const cardRect = c => front.box(c,'art',baseRect(c));
 window.MNC_standardArtBox=cardRect;
 function artPath(ctx,r,shape='rounded',radius=18){
  const {x,y,w,h}=r;const rad=num(radius,0,Math.min(w,h)/2);
  if(shape==='ellipse'){ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);return;}
  if(shape==='cut'){const t=rad;ctx.moveTo(x+t,y);ctx.lineTo(x+w-t,y);ctx.lineTo(x+w,y+t);ctx.lineTo(x+w,y+h-t);ctx.lineTo(x+w-t,y+h);ctx.lineTo(x+t,y+h);ctx.lineTo(x,y+h-t);ctx.lineTo(x,y+t);ctx.closePath();return;}
  if(shape==='square')radius=0;
  else radius=rad;
  ctx.roundRect(x,y,w,h,radius);
 }
 window.MNC_drawArtPath=artPath;
 function standardArtPath(c,r=cardRect(c)){
  const shape=shapes.forCard(c,'art',state);
  if(shape)return shapes.path(shape,r);
  const path=new Path2D();
  artPath(path,r,c.artShape||'rounded',c.artRadius??24);
  return path;
 }
 window.MNC_standardArtworkPath=standardArtPath;
 function bodyStart(c){
  const art=baseRect(c);
  return Math.min(875,art.y+art.h+25+MNC_LAYOUT.artFlow(c));
 }
 function plateBox(c){
  const {plateWidth:w,plateHeight:h}=front.values(c);
  return front.box(c,'title',{x:(CW-w)/2,y:bodyStart(c),w,h});
 }
 function content(ctx,c,paper={ink:'#fff',quiet:'#ddd'}){
  const {plateHeight}=front.values(c), anchor=c.layoutDesign?.contentTop;
  const y=Number.isFinite(anchor)?anchor+MNC_LAYOUT.artFlow(c):bodyStart(c)+plateHeight+30;
  return window.MNC_contentLayout(ctx,c,y,paper,{width:634,x:58});
 }
 function standardBoxes(c,ctx){
  const copy=content(ctx,c);
  return {
    art:cardRect(c), title:plateBox(c), typeRule:copy.typeRuleRows.length?copy.typeRuleBox:null,
    rule:copy.header||copy.rows.length?copy.ruleBox:null,quote:copy.quoteRows.length?copy.quoteBox:null,
    type:front.box(c,'type',{x:45,y:58,w:581,h:50}),
    cornerIcon:front.typeIconBox(c),
    artist:front.attributionBox(c,{x:57,y:1008}),
    footer:front.box(c,'footer',{x:343,y:967-front.footerReserve(c),w:360,h:57}),
    number:front.numberBox(c),
    episodeBadge:front.episodeBadgeBox(c)
  };
 }
  window.MNC_standardFrontBoxes=standardBoxes;
  window.MNC_standardRuleFits=c=>!content(document.createElement('canvas').getContext('2d'),c).overflow;
 const looks={
    projection:{bg:['#1E2730','#10151A'],plate:'#20272D',text:'#EEE5D5',footer:'#12191E',frame:'#AA9072'},
    contact:{bg:['#E1D8C8','#C6BFAF'],plate:'#E9E2D5',text:'#20282C',footer:'#D4CCBD',frame:'#768073'},
    matinee:{bg:['#203A3C','#101B20'],plate:'#243638',text:'#EAE3D7',footer:'#142226',frame:'#997979'}
 };
 function palette(c){
   const look=looks[c.filmTheme];
   const sourceBase=front.hex(c.mainColor)?c.mainColor:look?.bg[0]||'#222739';
   const base=front.tone(sourceBase,c.backgroundLightness);
   const custom=front.hex(c.mainColor)||!!c.backgroundLightness;
   const ink=custom?front.surfaceText(base).ink:look?.text||'#f7f4ee';
   const type=c.useTypeColor!==false?game.visualFor(c,state.typeOverrides):null;
   const outer=front.hex(c.borderColor)?c.borderColor:look?.frame||type?.color||c.accent||'#4d82b1';
   return {sourceBase,base,ink,outer,
     bottom:front.tone(c.mainColor?front.mix(sourceBase,'#101519',.11):look?.bg[1]||'#11151f',c.backgroundLightness),
     plate:custom?front.mix(base,ink,.07):look?.plate||'#181e2c',
     footer:custom?front.mix(base,ink,.06):look?.footer||'rgba(10,13,20,.9)'};
 }
 window.MNC_standardPalette=palette;
 window.MNC_addStandardLayers=function(scene,ctx,c,{foil,recipe}={}){
   const border=c.artBorder||'solid';
   const {base,bottom,ink,outer:trim,plate:plateColor,footer:footerColor}=palette(c);
   const layout=front.values(c), nameBox=plateBox(c), design=MNC_LAYOUT;
   scene.add('background',design.full(),ctx=>design.background(ctx,c,()=>design.linear(ctx,[[0,base],[1,bottom]])));
   MNC_OUTER_BORDER.addLayer(scene,c);
   front.addHeader(scene,ctx,c,{x:54,y:128,ink,quiet:trim,standard:true});
   scene.add('art',cardRect(c),async (ctx,rect)=>{
     const outline=standardArtPath(c,rect);
     ctx.fillStyle=trim;ctx.fill(outline,'evenodd');
     const im=MNC_ARTWORK.image(c,await imgLoad(assetURI(artById(c.sourceAssetId))));
     if(im){ctx.save();ctx.clip(outline,'evenodd');fitImage(ctx,im,rect,c.fit||'cover',Number(c.zoom)||1,Number(c.panX)||0,Number(c.panY)||0);ctx.restore();}
     if(border==='none')return;
     ctx.strokeStyle=ink;ctx.lineWidth=border==='double'?7:5;
     ctx.setLineDash(border==='dashed'?[20,12]:[]);ctx.stroke(outline);
     if(border==='double'){
       ctx.lineWidth=2;ctx.strokeStyle=trim;
       const inner={x:rect.x+10,y:rect.y+10,w:Math.max(1,rect.w-20),h:Math.max(1,rect.h-20)};
       ctx.stroke(standardArtPath({...c,artRadius:Math.max(0,(c.artRadius??24)-8)},inner));
     }
   },{adjustBox:true});
   MNC_ART_CUTOUT.addLayer(scene,c);
   const plate=c.nameplate||'solid';
   scene.add('plate',nameBox,ctx=>front.paintNameplate(ctx,c,nameBox,plate,{fill:plate==='banner'?trim:plateColor,
     stroke:trim,weight:plate==='outline'?4:0,radius:plate==='banner'?2:19}),{empty:plate==='none'});
   design.addTitle(scene,ctx,c,nameBox,{size:45,min:20,weight:800,family:'system-ui',color:ink,inset:45,baseline:14.5/45});
   const contentTop=bodyStart(c)+layout.plateHeight+39;
   const footer=front.offset(c,'footer');
   const creditTop=front.attributionBox(c,{x:57,y:1008}).y;
   const footerTop=Math.min(967+footer.y,creditTop-8);
   scene.add('copyRule',{x:52,y:contentTop-18,w:644,h:6},ctx=>{
     ctx.strokeStyle=trim;ctx.globalAlpha=.62;ctx.lineWidth=2;
     ctx.beginPath();ctx.moveTo(52,contentTop-18);ctx.lineTo(696,contentTop-18);ctx.stroke();
   });
   const paper={ink,quiet:ink};
   window.MNC_addContentLayers(scene,ctx,c,content(ctx,c,paper),paper);
   const panel={x:43+footer.x,y:footerTop,w:664,h:1024+footer.y-footerTop};
   scene.add('footerPanel',panel,ctx=>{ctx.fillStyle=footerColor;ctx.fillRect(panel.x,panel.y,panel.w,panel.h);});
   scene.add('footerLine',{x:52,y:footerTop-3,w:644,h:6},ctx=>{
     ctx.strokeStyle=trim;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(52,footerTop);ctx.lineTo(696,footerTop);ctx.stroke();
   },{empty:layout.footerRule===false});
   design.addCredits(scene,c,{x:57,y:1008,ink});
   front.addCollection(scene,ctx,c,{x:694,y:1008,ink});
   design.addEpisodeBadge(scene,c,trim);
   design.addIcon(scene,c,ink);
   design.addOverlay(scene,c);
   if(foil)addFoilLayer(scene,c,recipe);
 };
 const ids={stdSubtype:'subtype',stdEffect:'effectText',stdShape:'artShape',stdBorder:'artBorder',stdRadius:'artRadius'};
 const dims={stdX:'x',stdY:'y',stdW:'w',stdH:'h'};
 function syncControls(){
  const c=current();if(!c)return;
  for(const [id,key] of Object.entries(ids))el(id).value=c[key]??({artShape:'rounded',artBorder:'solid',artRadius:24}[key]??'');
  for(const [id,key] of Object.entries(dims))el(id).value=Math.round(windowOf(c)[key]*100);
  el('stdRadiusValue').textContent=el('stdRadius').value;
  const border=c.borderColor||c.accent;
  el('stdPalette').value=[...el('stdPalette').options].some(x=>x.value===border)?border:'';
 }
 function changeWindow(key,val){
  const c=current();if(!c)return;const b=windowOf(c);b[key]=num(Number(val)/100,0,1);
  b.w=num(b.w,.10,1-b.x);b.h=num(b.h,.1,1-b.y);
  if(b.x+b.w>1)b.x=1-b.w;if(b.y+b.h>1)b.y=1-b.h;
  c.artWindow=b;persist();drawStudioPreview();
 }
 for(const [id,key] of Object.entries(ids))el(id).addEventListener(id==='stdEffect'||id==='stdSubtype'||id==='stdRadius'?'input':'change',e=>{
  const c=current();if(!c)return;
  const value=id==='stdRadius'?Number(e.target.value):e.target.value;
  if(id==='stdEffect')editCardFields(c,{effectText:value,ruleText:value});
  else if(id==='stdSubtype'){
    editCardFields(c,{subtype:value,roleSubtype:value});
    window.MNC_refreshItemSetGroup?.(c);
  }
  else c[key]=value;
  if(id==='stdShape'){c.artShapeId='';el('frontArtShape').value='';}
  window.MNC_updateCatalogCardLabel?.(c);
  if(id==='stdRadius')el('stdRadiusValue').textContent=c.artRadius;
  persist();drawStudioPreview();
 });
 for(const [id,key] of Object.entries(dims))el(id).addEventListener('input',e=>{changeWindow(key,e.target.value);});
 el('stdPalette').onchange=e=>{const c=current();if(!c||!e.target.value)return;c.borderColor=e.target.value;persist();refreshStudio();};
 el('stdApply').onclick=()=>{const c=current();if(!c)return;c.template='Standard';persist();refreshStudio();};
 el('stdReset').onclick=()=>{const c=current();if(!c)return;c.artWindow={...defaults};persist();syncControls();drawStudioPreview();};
 // Override existing refresh function (works because functions in app.js are classic-script globals).
 const priorRefresh=window.refreshStudio;
 window.refreshStudio=function(){priorRefresh();syncControls();};
 // Capture-phase pointer listeners supersede other card-layer drag modes only when explicitly enabled.
 const cv=el('cardPreview');let drag=null;
 const pp=e=>{const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
 cv.addEventListener('pointerdown',e=>{
  if(window.MNC_frontMoveActive?.()||!el('stdDrag').checked||current()?.template!=='Standard')return;
  const b=windowOf(current()),p=pp(e);
  if(p.x<b.x||p.y<b.y||p.x>b.x+b.w||p.y>b.y+b.h)return;
  drag={dx:p.x-b.x,dy:p.y-b.y};cv.setPointerCapture(e.pointerId);e.stopImmediatePropagation();
 },true);
 cv.addEventListener('pointermove',e=>{if(!drag)return;const b=windowOf(current()),p=pp(e);b.x=num(p.x-drag.dx,.02,1-b.w);b.y=num(p.y-drag.dy,.02,1-b.h);current().artWindow=b;syncControls();drawStudioPreview();e.stopImmediatePropagation();},true);
 function dragEnd(e){if(drag){persist();syncControls();drawStudioPreview();drag=null;e.stopImmediatePropagation();}}
 cv.addEventListener('pointerup',dragEnd,true);cv.addEventListener('pointercancel',dragEnd,true);
 // Original Daily Prism engine lives in an iframe, sandboxed from our main state unless explicitly sent data.
 const engine=el('prismEngine'),cardSelect=el('prismCard'),status=el('prismStatus');let engineReady=false,loadCount=0;
 function refreshCards(){const selected=cardSelect.value||currentId;dropDownOptions(cardSelect,state.cards.map(c=>[c.id,c.id+' · '+c.title]),state.cards.some(c=>c.id===selected)?selected:currentId);}
 async function sendToPrism(){
  if(!engineReady){status.textContent='Foil engine loading; trying again when ready…';return;}
  const c=cardById(cardSelect.value)||current();if(!c)return;
  try{
   status.textContent='Rendering '+c.title+' for original WebGL engine…';
   const front=(await cardCanvas(c,{foil:false})).toDataURL('image/png');
   const back=(await backCanvas()).toDataURL('image/png');
   const mask=makeFoilMask(c,el('prismMask').value).toDataURL('image/png');
   engine.contentWindow.postMessage({type:'mnc:load-card',front,back,mask,cardId:c.id,title:c.title},'*');
  }catch(err){status.textContent='Could not send card: '+err.message;console.error(err);}
 }
 el('prismSend').onclick=sendToPrism;
 el('prismCapture').onclick=()=>{if(!engineReady)return;engine.contentWindow.postMessage({type:'mnc:prism-capture'},'*');status.textContent='Capturing from original WebGL… (requires 3D renderer)';};
 el('prismRecipe').onclick=()=>{if(!engineReady)return;engine.contentWindow.postMessage({type:'mnc:prism-recipe'},'*');};
 el('prismMask').onchange=()=>{if(engineReady)sendToPrism();};
 cardSelect.onchange=()=>{sendToPrism();};
 window.addEventListener('message',async e=>{
   if(e.source!==engine.contentWindow||!e.data?.type?.startsWith('mnc:'))return;
   const msg=e.data;
   if(msg.type==='mnc:prism-ready'){engineReady=true;status.textContent=e.data.webgl?'Original WebGL engine ready':'Original renderer loaded; WebGL unavailable in this browser';refreshCards();await sendToPrism();}
   if(msg.type==='mnc:prism-loaded'){status.textContent=(msg.fallback?'Card loaded (2D fallback; WebGL unavailable): ':'Prism WebGL card ready: ')+msg.title;}
   if(msg.type==='mnc:prism-error'){status.textContent='3D engine error: '+msg.message;}
   if(msg.type==='mnc:prism-captured'&&typeof msg.image==='string'&&msg.image.startsWith('data:image/png;base64,')){
     const origin=cardById(msg.cardId)||current();if(!origin)return;
     const id=uniqueId('ART-',state.assets);
     state.assets.push({id,title:'Prism capture · '+origin.title,originalFilename:id+'.png',kind:'Foil preview',source:'Original Daily Prism v0.8',sourceAssetId:origin.sourceAssetId,credit:'Derived from '+(origin.artist||'unverified credit'),reviewStatus:'generated',accent:origin.accent||'#d6af80',dataURI:msg.image});
     persist();refreshAll();status.textContent='Prism capture saved to Artwork Library: '+id+'. Export your project JSON to retain it.';
   }
   if(msg.type==='mnc:prism-recipe-data'){
      const origin=cardById(msg.cardId)||current();if(!origin)return;
      origin.prismV08Recipe=msg.recipe;persist();status.textContent='Original Prism v0.8 recipe saved to '+origin.id+'.';
   }
 });
 const older=window.MNC_tabChanged;
 window.MNC_tabChanged=function(name){if(typeof older==='function')older(name);if(name==='studio')syncControls();if(name==='prismLegacy'){refreshCards();if(!engine.hasAttribute('src'))engine.src=engine.dataset.src;else if(engineReady)sendToPrism();}};
 syncControls();refreshCards();
})();
