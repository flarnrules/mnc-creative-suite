'use strict';
/* MNC Creative Suite v0.4. All modules run offline and share v0.3's artwork/card/print data. */
(()=>{
 const $=id=>document.getElementById(id);
 const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
 const freshID=prefix=>{let i=1,id;do{id=prefix+String(i++).padStart(4,'0')}while(state.assets.some(a=>a.id===id));return id};
 const getCard=()=>cardById(currentId);
 let selectedLayer=null;
 const baselineLayer=(style='text')=>({id:'LY-'+Date.now()+'-'+Math.floor(Math.random()*10000),style,text:style==='text'?'NEW LABEL':'',assetId:'',x:.5,y:.51,w:style==='text'?.55:.28,h:style==='text'?.08:.20,size:36,color:'#ffffff',opacity:1,rotation:0,visible:true});
 function ensureLayers(c){if(c&&!Array.isArray(c.layers))c.layers=[];return c?.layers||[]}
 function layerLabel(layer){return layer.style==='image'?(artById(layer.assetId)?.title||'Artwork / icon'):(layer.text||layer.style.toUpperCase())}
 async function drawLayer(ctx,c,layer){
   const x=CW*Number(layer.x??.5),y=CH*Number(layer.y??.5),w=CW*Number(layer.w??.25),h=CH*Number(layer.h??.2);
   ctx.save();ctx.globalAlpha=bound(Number(layer.opacity??1),0,1);ctx.translate(x,y);ctx.rotate((Number(layer.rotation)||0)*Math.PI/180);ctx.fillStyle=layer.color||'#ffffff';
   if(layer.style==='text'){
    ctx.textAlign='center';ctx.textBaseline='middle';let fs=Number(layer.size)||36;ctx.font=`800 ${fs}px system-ui`;
    while(ctx.measureText(String(layer.text||'')).width>w && fs>12){fs--;ctx.font=`800 ${fs}px system-ui`}
    const fontId=layer.fontId||c.fontId||'system';
    const custom=(fontId!=='system'&&window.MNC_drawFontLine)?await window.MNC_drawFontLine(ctx,layer.text||'',0,fs*.35,fs,{fontId,variation:c.glyphVariantMode||'seeded',seed:c.glyphSeed||1,maxWidth:w,align:'center',color:layer.color||'#ffffff'}):false;
    if(!custom){ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='rgba(12,13,20,.85)';ctx.strokeText(layer.text||'',0,0);ctx.fillText(layer.text||'',0,0);}
   }else if(layer.style==='rect'||layer.style==='circle'){
    const gradient=MNC_LAYOUT.get(c,'extra:'+layer.id)?.gradient;
    if(gradient)ctx.fillStyle=MNC_FRONT_EFFECTS.paintGradient(ctx,{x:-w/2,y:-h/2,w,h},gradient);
    if(layer.style==='rect')ctx.fillRect(-w/2,-h/2,w,h);
    else{ctx.beginPath();ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);ctx.fill();}
   }else if(layer.style==='image'){
    let asset=artById(layer.assetId),im=await imgLoad(assetURI(asset));if(im)fitImage(ctx,im,{x:-w/2,y:-h/2,w,h},'contain');
   }
   ctx.restore();
 }
 window.MNC_addExtraLayers=(scene,c)=>{
   for(const layer of Array.isArray(c.layers)?c.layers:[]){
     if(!layer)continue;
     const w=CW*Number(layer.w??.25),h=CH*Number(layer.h??.2);
     const base={x:CW*Number(layer.x??.5)-w/2,y:CH*Number(layer.y??.5)-h/2,w,h};
     scene.add('extra:'+layer.id,base,ctx=>drawLayer(ctx,c,layer),{
       label:layerLabel(layer),empty:layer.visible===false||layer.style==='image'&&!layer.assetId,foilText:layer.style==='text'
     });
   }
 };
 window.MNC_newExtraLayer=baselineLayer;
 async function foilTexture(ctx,c,r,rect){
  let a=artById(r?.textureAssetId);if(!a)return;const im=await imgLoad(assetURI(a));if(!im)return;
  let mask=r.mask||'whole';ctx.save();
  if(mask==='art'){ctx.beginPath();ctx.rect(rect.x,rect.y,rect.w,rect.h);ctx.clip()}
  if(mask==='reverse'){ctx.beginPath();ctx.rect(0,0,CW,CH);ctx.rect(rect.x+24,rect.y+30,rect.w-48,Math.max(1,rect.h-205));ctx.clip('evenodd')}
  ctx.globalAlpha=bound(.13+Number(r.strength??.5)*.38,0,.62);ctx.globalCompositeOperation='screen';fitImage(ctx,im,{x:0,y:0,w:CW,h:CH},'cover');ctx.restore();
 }
 window.MNC_foilTexture=foilTexture;
 // Variant glyphs are selected deterministically from assets marked with glyphKey.
 async function drawGlyphTitle(ctx,c,title,x,y,size){
  const fs=Math.max(15,size),letterSpacing=1,choices=state.assets.filter(a=>a.glyphKey);
  ctx.save();ctx.textBaseline='alphabetic';ctx.font=`900 ${fs}px system-ui`;ctx.lineJoin='round';
  let cursor=x,seed=strhash((c.id||'')+'|'+(c.glyphSeed||1));
  for(let i=0;i<title.length;i++){
   const char=title[i], variants=choices.filter(a=>String(a.glyphKey).toUpperCase()===char.toUpperCase());
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const width=ctx.measureText(char).width+letterSpacing,jitter=(seed%7)-3;
   if(variants.length){let src=variants[seed%variants.length],im=await imgLoad(assetURI(src));if(im){const h=fs*1.42;ctx.drawImage(im,cursor-3,y-h+.22*fs+jitter,width+6,h)} }
   else{ctx.fillStyle=seed%5===0?'#ead6ad':'#fff';ctx.strokeStyle='#121822';ctx.lineWidth=3.5;ctx.strokeText(char,cursor,y+jitter);ctx.fillText(char,cursor,y+jitter)}
   cursor+=width;if(cursor>CW-45)break;
  }
  ctx.restore();
 }
 window.MNC_drawGlyphTitle=drawGlyphTitle;
 function layHit(x,y,l){return x>=l.x-l.w/2&&x<=l.x+l.w/2&&y>=l.y-l.h/2&&y<=l.y+l.h/2}
 function drawSelection(cv,c){if(activeTab!=='studio'||!selectedLayer)return;let layer=ensureLayers(c).find(l=>l.id===selectedLayer);if(!layer||!layer.visible)return;
  const ctx=cv.getContext('2d'),x=layer.x*CW,y=layer.y*CH,w=layer.w*CW,h=layer.h*CH;ctx.save();ctx.strokeStyle='#ffe19d';ctx.lineWidth=3;ctx.setLineDash([10,7]);ctx.strokeRect(x-w/2,y-h/2,w,h);ctx.setLineDash([]);for(let [px,py] of [[x-w/2,y-h/2],[x+w/2,y+h/2]]){ctx.fillStyle='#f1cf81';ctx.fillRect(px-5,py-5,10,10)}ctx.restore();
 }
 window.MNC_drawSelection=drawSelection;
 function renderLayerControls(){const c=getCard();if(!c)return;const el=$('layerList');if(!el)return;el.innerHTML='';
  for(let l of ensureLayers(c).slice().reverse()){
   const r=document.createElement('div');r.className='layer-row'+(selectedLayer===l.id?' selected':'');
   const t=document.createElement('button');t.className='layer-select';t.textContent=layerLabel(l);t.title='Select to edit';t.onclick=()=>{selectedLayer=l.id;renderLayerControls();drawStudioPreview()};
   const kind=document.createElement('span');kind.className='layer-icon';kind.textContent=l.style;
   const vis=document.createElement('button');vis.className='layer-btn';vis.textContent=l.visible===false?'◌':'◉';vis.title='Toggle visibility';vis.onclick=()=>{l.visible=l.visible===false;persist();renderLayerControls();drawStudioPreview()};
   const up=document.createElement('button');up.className='layer-btn';up.textContent='↑';up.title='Bring forward';up.onclick=()=>{let ls=c.layers,i=ls.findIndex(x=>x.id===l.id);if(i<ls.length-1)[ls[i],ls[i+1]]=[ls[i+1],ls[i]];persist();renderLayerControls();drawStudioPreview()};
   const down=document.createElement('button');down.className='layer-btn';down.textContent='↓';down.title='Send backward';down.onclick=()=>{let ls=c.layers,i=ls.findIndex(x=>x.id===l.id);if(i>0)[ls[i],ls[i-1]]=[ls[i-1],ls[i]];persist();renderLayerControls();drawStudioPreview()};
   r.append(kind,t,vis,up,down);el.append(r);
  }
  const d=$('layerDetails'),l=ensureLayers(c).find(x=>x.id===selectedLayer);d.hidden=!l;
  if(l){$('layerText').value=l.text||'';$('layerStyle').value=l.style;$('layerColor').value=l.color||'#ffffff';$('layerAsset').innerHTML='';dropDownOptions($('layerAsset'),state.assets.map(a=>[a.id,a.title]),l.assetId||state.assets[0]?.id);$('layerX').value=Math.round((l.x??.5)*100);$('layerY').value=Math.round((l.y??.5)*100);$('layerW').value=Math.round((l.w??.25)*100);$('layerH').value=Math.round((l.h??.2)*100);$('layerFontSelect').value=l.fontId||'';$('layerSize').value=l.size||36;$('layerRotate').value=l.rotation||0;$('layerOpacity').value=l.opacity??1;}
 }
 window.MNC_refreshLayers=renderLayerControls;
 function addLayer(style){let c=getCard();if(!c)return;const l=baselineLayer(style);if(style==='image')l.assetId=c.sourceAssetId;ensureLayers(c).push(l);selectedLayer=l.id;persist();renderLayerControls();drawStudioPreview()}
 $('addTextLayer').onclick=()=>addLayer('text');$('addShapeLayer').onclick=()=>addLayer('rect');$('addImageLayer').onclick=()=>addLayer('image');
 for(const [id,key,conv] of [['layerText','text',s=>s],['layerStyle','style',s=>s],['layerColor','color',s=>s],['layerAsset','assetId',s=>s],['layerX','x',s=>bound(+s/100,0,1)],['layerY','y',s=>bound(+s/100,0,1)],['layerW','w',s=>bound(+s/100,.03,1)],['layerH','h',s=>bound(+s/100,.03,1)],['layerSize','size',s=>+s],['layerFontSelect','fontId',s=>s],['layerRotate','rotation',s=>+s],['layerOpacity','opacity',s=>+s]]){
  $(id).addEventListener(['layerText','layerX','layerY','layerW','layerH','layerSize','layerRotate','layerOpacity','layerColor'].includes(id)?'input':'change',e=>{let c=getCard(),l=ensureLayers(c).find(x=>x.id===selectedLayer);if(!l)return;l[key]=conv(e.target.value);persist();drawStudioPreview();if(['layerText','layerStyle','layerAsset'].includes(id))renderLayerControls()});
 }
 $('layerDuplicate').onclick=()=>{let c=getCard(),l=ensureLayers(c).find(x=>x.id===selectedLayer);if(!l)return;let d=deep(l);d.id=baselineLayer().id;d.x=bound(d.x+.04,0,1);d.y=bound(d.y+.04,0,1);c.layers.push(d);selectedLayer=d.id;persist();renderLayerControls();drawStudioPreview()};
 $('layerDelete').onclick=()=>{let c=getCard();if(!c)return;c.layers=ensureLayers(c).filter(l=>l.id!==selectedLayer);selectedLayer=null;persist();renderLayerControls();drawStudioPreview()};
 // Support custom elements and existing caption positions via the same pointer editor.
 let drag=null;
 const cv=$('cardPreview');const pos=e=>{let r=cv.getBoundingClientRect();return {x:bound((e.clientX-r.left)/r.width,0,1),y:bound((e.clientY-r.top)/r.height,0,1)}};
 cv.addEventListener('pointerdown',e=>{const c=getCard();if(!c)return;const p=pos(e);const l=ensureLayers(c).slice().reverse().find(l=>l.visible!==false&&layHit(p.x,p.y,l));
  if(l){selectedLayer=l.id;drag={type:'layer',layerId:l.id,dx:p.x-l.x,dy:p.y-l.y}}else if(!game.isGameCard(c)&&p.y<.18){drag={type:'title'}}else if(!game.isGameCard(c)&&p.y>.90){drag={type:p.x>.55?'micro':'credit'}}else{selectedLayer=null;renderLayerControls();drawStudioPreview();return}
  cv.setPointerCapture(e.pointerId);renderLayerControls();drawStudioPreview();});
 cv.addEventListener('pointermove',e=>{if(!drag)return;const c=getCard(),p=pos(e);if(drag.type==='layer'){let l=ensureLayers(c).find(x=>x.id===drag.layerId);if(l){l.x=bound(p.x-drag.dx,.01,.99);l.y=bound(p.y-drag.dy,.01,.99)}}else{c[drag.type==='title'?'titlePosition':drag.type==='credit'?'creditPosition':'microPosition']=[bound(p.x,.02,.98),bound(p.y,.02,.98)]}drawStudioPreview();});
 const endDrag=()=>{if(drag){persist();renderLayerControls();drawStudioPreview()}drag=null};cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
 // Comparison cards use the actual renderer, avoiding a different print-versus-preview engine.
 async function showVariants(){let c=getCard(),wrap=$('variantsGrid');if(!c||!wrap||!$('legacyVariants').open)return;wrap.innerHTML='';let key=currentId;for(let template of ['Full Art','Archive','Glitch']){let d=deep(c);d.template=template;let tile=document.createElement('div');tile.className='variant-tile';let title=document.createElement('small');title.textContent=template;let canvas=document.createElement('canvas');canvas.width=375;canvas.height=525;tile.append(title,canvas);let btn=document.createElement('button');btn.textContent='Use '+template;btn.onclick=()=>{let c=getCard();if(!c)return;c.template=template;persist();refreshStudio();showVariants()};tile.append(btn);wrap.append(tile);try{await drawCard(d,canvas)}catch(e){console.error(e)}if(currentId!==key)return}}
 $('refreshVariants').onclick=showVariants;$('legacyVariants').addEventListener('toggle',showVariants);
 for(let id of ['c_template','c_asset','c_accent'])$(id).addEventListener('change',()=>setTimeout(showVariants,50));let variantTimer=null;for(let id of ['c_title','c_lore','c_artist','c_symbols'])$(id).addEventListener('input',()=>{clearTimeout(variantTimer);variantTimer=setTimeout(showVariants,350)});
 $('c_useHandGlyphs').addEventListener('change',e=>{let c=getCard();if(!c)return;c.useHandGlyphs=e.target.checked;persist();drawStudioPreview()});
 $('c_glyphSeed').addEventListener('input',e=>{let c=getCard();if(!c)return;c.glyphSeed=Math.max(1,Number(e.target.value)||1);persist();drawStudioPreview()});
 const oldRefresh=window.MNC_refreshLayers;window.MNC_refreshLayers=()=>{oldRefresh();let c=getCard();if(c){$('c_useHandGlyphs').checked=!!c.useHandGlyphs;$('c_glyphSeed').value=c.glyphSeed||1}};
 // ---- Foil Lab: pointer 3D lighting and front/back flip, using the 2D foil renderer. ----
 const stage=$('foilStage'),glint=$('foilGlint');let yaw=-9,pitch=7,flipped=false,orbitRaf=null,lastOrbit=0,pointerStart=null;
 async function paintFoilBack(){try{const bc=await backCanvas();$('foilBackCanvas').getContext('2d').drawImage(bc,0,0)}catch(e){console.warn('Back preview unavailable',e)}}
 function pose(){stage.style.transform=`perspective(950px) rotateX(${pitch.toFixed(1)}deg) rotateY(${(yaw+(flipped?180:0)).toFixed(1)}deg)`;glint.style.setProperty('--light-x',`${bound(50+yaw*1.8,6,94)}%`);glint.style.setProperty('--light-y',`${bound(50-pitch*1.7,5,95)}%`)}
 stage.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY,yaw,pitch};stage.classList.add('dragging');stage.setPointerCapture(e.pointerId)});
 stage.addEventListener('pointermove',e=>{if(!pointerStart)return;const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;yaw=bound(pointerStart.yaw+dx*.25,-65,65);pitch=bound(pointerStart.pitch-dy*.25,-55,55);pose()});
 const release=()=>{pointerStart=null;stage.classList.remove('dragging')};stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
 $('foilFlip').onclick=()=>{flipped=!flipped;stage.style.transition='transform .48s cubic-bezier(.2,.8,.2,1)';pose();setTimeout(()=>stage.style.transition='',500)};
 $('foilCenter').onclick=()=>{yaw=-9;pitch=7;flipped=false;pose()};
 function orbitFrame(t){if(activeTab!=='foil'||!$('foilOrbit').checked){orbitRaf=null;return}if(!pointerStart && t-lastOrbit>32){lastOrbit=t;yaw=Math.sin(t/2400)*24;pitch=Math.cos(t/3200)*13;pose()}orbitRaf=requestAnimationFrame(orbitFrame)}
 $('foilOrbit').onchange=()=>{if($('foilOrbit').checked&&!orbitRaf)orbitRaf=requestAnimationFrame(orbitFrame)};
 pose();paintFoilBack();
 // ---- Glyph Kit: locally stored transparent assets / hand-drawn alternate glyphs. ----
 const glyph=$('glyphCanvas'),gctx=glyph.getContext('2d');let undo=[],drawing=false,lastP=null;
 const snap=()=>{undo.push(gctx.getImageData(0,0,glyph.width,glyph.height));if(undo.length>25)undo.shift()};
 function glyphP(e){let r=glyph.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*512,y:(e.clientY-r.top)/r.height*512}}
 glyph.addEventListener('pointerdown',e=>{snap();drawing=true;lastP=glyphP(e);glyph.setPointerCapture(e.pointerId);gctx.save();gctx.lineCap='round';gctx.lineJoin='round';gctx.lineWidth=Number($('glyphSize').value);gctx.strokeStyle=$('glyphColor').value;gctx.globalCompositeOperation=$('glyphEraser').checked?'destination-out':'source-over';gctx.beginPath();gctx.moveTo(lastP.x,lastP.y);gctx.lineTo(lastP.x+.1,lastP.y+.1);gctx.stroke()});
 glyph.addEventListener('pointermove',e=>{if(!drawing)return;let p=glyphP(e);gctx.beginPath();gctx.moveTo(lastP.x,lastP.y);gctx.lineTo(p.x,p.y);gctx.stroke();lastP=p});
 glyph.addEventListener('pointerup',()=>{if(drawing)gctx.restore();drawing=false;lastP=null});glyph.addEventListener('pointercancel',()=>{if(drawing)gctx.restore();drawing=false;lastP=null});
 $('glyphClear').onclick=()=>{snap();gctx.clearRect(0,0,512,512)};
 $('glyphUndo').onclick=()=>{if(undo.length)gctx.putImageData(undo.pop(),0,0)};
 $('glyphExport').onclick=()=>canvasPNG(glyph,slug($('glyphName').value||'handdrawn_glyph')+'.png');
 $('glyphSave').onclick=()=>{const id=freshID('ART-'),name=$('glyphName').value.trim()||'Handdrawn primitive',key=$('glyphKey').value.trim().toUpperCase();state.assets.push({id,title:name,originalFilename:slug(name)+'.png',kind:'primitive',source:'MNC Glyph Kit',credit:'Credit pending',reviewStatus:'Draft',glyphKey:key,dataURI:glyph.toDataURL('image/png'),w:512,h:512});persist();refreshAll();alert('Saved '+name+' as '+id+'. Find it in Artwork and use the Card Designer image layer.');};
 // ---- Fractal Lab: CPU pixel shader, artwork-aware formulas and periodic motion. ----
 const fc=$('fractCanvas'),fx=fc.getContext('2d',{willReadFrequently:true}),sourceBuffer=document.createElement('canvas');sourceBuffer.width=sourceBuffer.height=360;
 let sourcePixels=null,sourceId='',fractRunning=true,fractRaf=null,fractLast=0,fractStart=performance.now(),phase=0,loadingSource=false,renderBusy=false;
 const fractDefaults={sourceAssetId:state.assets[0]?.id||'',mode:'kaleido',folds:7,iterations:3,distortion:.36,preserve:.55,color:.72,zoom:1,rotation:0,duration:12};
 state.fractal={...fractDefaults,...(state.fractal||{})};
 const fractFields={fractSource:'sourceAssetId',fractMode:'mode',fractFolds:'folds',fractIterations:'iterations',fractDistortion:'distortion',fractPreserve:'preserve',fractColor:'color',fractZoom:'zoom',fractRotation:'rotation',fractDuration:'duration'};
 function fractRead(){return {...state.fractal}}
 function loadControls(){let r=state.fractal;dropDownOptions($('fractSource'),state.assets.map(a=>[a.id,a.title]),r.sourceAssetId);
  for(let [id,key] of Object.entries(fractFields)){if(id!=='fractSource')$(id).value=r[key]}
  for(let id of ['Folds','Iterations','Distortion','Preserve','Color','Zoom','Rotation','Duration'])$('fract'+id+'Val').textContent=$('fract'+id).value;
 }
 async function ensureSource(size=360){let a=artById(state.fractal.sourceAssetId)||state.assets[0];if(!a)return null;let key=a.id+'|'+size;if(sourceId===key&&sourcePixels)return sourcePixels;const im=await imgLoad(assetURI(a));if(!im)return null;sourceBuffer.width=sourceBuffer.height=size;
  const ctx=sourceBuffer.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#1c2533';ctx.fillRect(0,0,size,size);let scale=Math.max(size/im.width,size/im.height),w=im.width*scale,h=im.height*scale;ctx.drawImage(im,(size-w)/2,(size-h)/2,w,h);sourcePixels=ctx.getImageData(0,0,size,size).data;sourceId=key;return sourcePixels}
 const FRACT_TAU=Math.PI*2;
 function renderShader(N,rec,t,src){let out=new ImageData(N,N),dest=out.data;
  const str=Math.max(0,Number(rec.distortion)||0),keep=bound(+rec.preserve,0,1),tint=bound(+rec.color,0,1),iter=Number(rec.iterations)||2,folds=Number(rec.folds)||7,zoom=Math.max(.3,+rec.zoom||1),rot=(+rec.rotation||0)*Math.PI/180,amp=.5-.5*Math.cos(FRACT_TAU*t);
  const effective=str*(.2+.8*amp),colEff=tint*amp;
  for(let y=0;y<N;y++){let py=(y+.5)/N*2-1;for(let x=0;x<N;x++){
   let px=(x+.5)/N*2-1,qx=px/zoom,qy=py/zoom;const rad=Math.hypot(qx,qy),theta=Math.atan2(qy,qx);let a=theta+rot;
   switch(rec.mode){
    case 'kaleido':{
     const seg=FRACT_TAU/folds;let z=((a+t*FRACT_TAU*.25)%seg+seg)%seg;if(z>seg/2)z=seg-z;
     const angle=theta*(1-effective)+z*effective;qx=Math.cos(angle)*rad;qy=Math.sin(angle)*rad;
     for(let k=0;k<iter;k++){let h=.095*effective/(k+1);qx+=Math.sin(qy*(5+k)+t*FRACT_TAU)*h;qy+=Math.sin(qx*(7+k)-t*FRACT_TAU)*h}break;
    }
    case 'recursive':{
     for(let k=0;k<iter;k++){const f=2.2+k*.5,g=.22*effective/(k+1);let xx=qx+Math.sin(qy*f+t*FRACT_TAU)*g;let yy=qy+Math.sin(qx*(f+1)-t*FRACT_TAU)*g;qx=xx;qy=yy}break;
    }
    case 'orbit':{
     const cx=.28*Math.cos(t*FRACT_TAU),cy=.28*Math.sin(t*FRACT_TAU),trap=Math.abs(Math.hypot(px-cx,py-cy)-.34);const v=Math.cos(trap*48*folds/7+t*FRACT_TAU);qx+=effective*.28*v; qy+=effective*.17*Math.sin(trap*30-t*FRACT_TAU);break;
    }
    case 'living':{
     const band=Math.sin((rad*folds*2 + theta*3 - t*FRACT_TAU)*2);qx+=effective*.12*Math.sin(qy*14+t*FRACT_TAU)+effective*.045*band;qy+=effective*.12*Math.sin(qx*12-t*FRACT_TAU);break;
    }
    case 'mirror':{
     const seg=FRACT_TAU/folds;let z=((a+t*FRACT_TAU*.18)%seg+seg)%seg;if(z>seg/2)z=seg-z;qx=qx*(1-effective)+Math.cos(z)*rad*effective;qy=qy*(1-effective)+Math.sin(z)*rad*effective;qx+=.08*effective*Math.sin(rad*25+t*FRACT_TAU);break;
    }
   }
   const sx=bound(Math.floor((qx+1)*.5*N),0,N-1),sy=bound(Math.floor((qy+1)*.5*N),0,N-1),ci=(sy*N+sx)*4,oi=(y*N+x)*4;
   const mixr=(1-keep)*src[ci]+keep*src[oi],mixg=(1-keep)*src[ci+1]+keep*src[oi+1],mixb=(1-keep)*src[ci+2]+keep*src[oi+2];
   const band=Math.sin(rad*17+theta*folds+t*FRACT_TAU),wave=(.5+.5*band)*colEff;
   dest[oi]=bound(mixr*(1-wave*.19)+mixg*wave*.13 + 42*wave,0,255);
   dest[oi+1]=bound(mixg*(1-wave*.18)+mixb*wave*.15+30*wave,0,255);
   dest[oi+2]=bound(mixb*(1-wave*.13)+mixr*wave*.20+50*wave,0,255);
   dest[oi+3]=255;
  }}return out}
 async function fractDraw(size=360,t=phase,target=fc){if(renderBusy&&target===fc)return;renderBusy=true;try{let src=await ensureSource(size);if(!src)return;let image=renderShader(size,state.fractal,t,src);const ctx=target.getContext('2d',{willReadFrequently:true});ctx.putImageData(image,0,0);if(target===fc)$('fractStatus').textContent=`${state.fractal.mode.toUpperCase()} · ${Math.round(t*state.fractal.duration*10)/10}s / ${state.fractal.duration}s`;}
  catch(e){console.error('Fractal renderer',e);$('fractStatus').textContent='Render error: '+e.message}finally{renderBusy=false}}
 function fractFrame(now){if(activeTab!=='fractalLite'){fractRaf=null;return}if(now-fractLast>110){fractLast=now;if(fractRunning){phase=((now-fractStart)/1000/state.fractal.duration)%1;$('fractTime').value=Math.round(phase*1000)}fractDraw(360,phase,fc)}fractRaf=requestAnimationFrame(fractFrame)}
 function fractSetTab(){loadControls();if(activeTab==='fractalLite'&&!fractRaf)fractRaf=requestAnimationFrame(fractFrame)}
 for(let [id,key] of Object.entries(fractFields))$(id).addEventListener(id==='fractMode'||id==='fractSource'?'change':'input',e=>{let val=['sourceAssetId','mode'].includes(key)?e.target.value:Number(e.target.value);state.fractal[key]=val;if(id==='fractSource')sourceId='';if(id==='fractDuration')fractStart=performance.now()-phase*val*1000;persist();loadControls();if(!fractRunning)fractDraw()});
 $('fractTime').oninput=e=>{phase=(+e.target.value)/1000;fractRunning=false;$('fractPlay').textContent='Play motion';fractDraw()};
 $('fractPlay').onclick=()=>{fractRunning=!fractRunning;if(fractRunning)fractStart=performance.now()-phase*1000*state.fractal.duration;$('fractPlay').textContent=fractRunning?'Pause motion':'Play motion'};
 $('fractReset').onclick=()=>{state.fractal={...fractDefaults,sourceAssetId:state.fractal.sourceAssetId};sourceId='';phase=0;fractStart=performance.now();loadControls();persist();fractDraw()};
 async function fractExportCanvas(){let out=document.createElement('canvas');out.width=out.height=720;let src=await ensureSource(720);if(!src)throw Error('Artwork source could not be loaded');out.getContext('2d').putImageData(renderShader(720,state.fractal,phase,src),0,0);sourceId='';return out}
 $('fractPNG').onclick=async()=>{try{canvasPNG(await fractExportCanvas(),`mnc_fractal_${slug(state.fractal.mode)}.png`)}catch(e){alert(e.message)}};
 $('fractRecipe').onclick=()=>downloadText(JSON.stringify({format:'mnc-fractal-v1',sourceAssetId:state.fractal.sourceAssetId,recipe:fractRead(),loop:'0→1→0',timeSeconds:phase*state.fractal.duration},null,2),'mnc_fractal_recipe.json','application/json');
 $('fractToCard').onclick=async()=>{let c=getCard();if(!c)return alert('Select a card first in the Card Designer');try{let out=await fractExportCanvas(),id=freshID('ART-');let name=`Fractal · ${artById(state.fractal.sourceAssetId)?.title||'source'}`;
  state.assets.push({id,title:name,originalFilename:slug(name)+'.png',kind:'generated-texture',source:'MNC Fractal Lab',credit:'Derived from artwork; original credit retained separately',sourceAssetId:state.fractal.sourceAssetId,dataURI:out.toDataURL('image/png'),recipe:fractRead(),w:720,h:720});
  if($('fractSendMode').value==='overlay'){c.overlayAssetId=id;c.overlayOpacity=.40;tab('studio')}else{c.foilRecipe={...(c.foilRecipe||{}),mode:'Fractal',mask:c.foilRecipe?.mask||'art',strength:Math.max(.58,c.foilRecipe?.strength||0),scale:c.foilRecipe?.scale||1,angle:c.foilRecipe?.angle||0,textureAssetId:id};tab('foil');$('foilCard').value=c.id;populateFoil();renderFoil()}persist();refreshStudio();renderLibrary();refreshFractSource();alert('Saved new artwork '+id+' and linked it to '+c.title)}catch(e){alert('Could not save texture: '+e.message)}};
 $('fractRecord').onclick=async()=>{
  if(typeof fc.captureStream!=='function'||typeof MediaRecorder==='undefined'){alert('Video recording is not supported by this browser. PNG and JSON export are available.');return}
  if(activeTab!=='fractalLite')tab('fractalLite');let btn=$('fractRecord'),duration=state.fractal.duration,wasPlaying=fractRunning;fractRunning=true;fractStart=performance.now();let stream=fc.captureStream(12),type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!type){alert('WebM encoding unavailable in this browser');return}
  const rec=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:3000000}),chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=()=>{dl(new Blob(chunks,{type}),`mnc_fractal_${slug(state.fractal.mode)}_${duration}s.webm`);stream.getTracks().forEach(t=>t.stop());btn.disabled=false;btn.textContent='Record loop WebM';fractRunning=wasPlaying};
  btn.disabled=true;btn.textContent=`Recording ${duration}s…`;rec.start();setTimeout(()=>{if(rec.state==='recording')rec.stop()},duration*1000);
 };
 function refreshFractSource(){let previous=state.fractal.sourceAssetId;dropDownOptions($('fractSource'),state.assets.map(a=>[a.id,a.title]),previous);}
 // Print launch: sample 16 cards, correct physical finish plan, and calibration guide maintained in legacy exporter.
 window.MNC_tabChanged=(name)=>{if(name==='studio'){renderLayerControls();showVariants()}if(name==='fractalLite')fractSetTab();if(name==='foil'){paintFoilBack();if($('foilOrbit').checked&&!orbitRaf)orbitRaf=requestAnimationFrame(orbitFrame)}if(name==='data')renderSummary()};
 loadControls();renderLayerControls();showVariants();

})();
