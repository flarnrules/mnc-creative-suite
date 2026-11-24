'use strict';

(() => {
  const fullFractal=$('fullFractal'),fullFoil=$('fullFoil');
  const controls={fractal:$('fullFractalArt'),prism:$('fullFoilCard')};
  const notice={fractal:$('fractalBridgeStatus'),prism:$('foilBridgeStatus')};
  const useMask=$('foilUseFinishMask');
  const imprintButton=$('imprintFoilPattern');
  const foilSurfaces=new Set(['background','border','art','cutout','overlay','shade','copyRule','footerLine','footerPanel']);
  const http=location.protocol==='http:'||location.protocol==='https:';
  let fractalReady=false,foilReady=false,fractalRequest=0,foilRequest=0;
  let pendingPattern=null,savePending=false,loadedFoilId='',fractalCardId='',foilWebgl=false;
  let imprintRequest=0,imprintPending=null;
  const selected=()=>cardById(currentId);

  function post(frame,type,data={}) {
    frame.contentWindow.postMessage({type,...data},location.origin);
  }

  function readyMessage(which,detail) {
    notice[which].textContent=detail;
  }

  async function sendArt() {
    if(!fractalReady)return;
    const id=controls.fractal.value,asset=artById(id);
    if(!asset)return;
    const stamp=++fractalRequest;
    readyMessage('fractal','Loading '+asset.title+'…');
    try{
      const im=await imgLoad(assetURI(asset));
      if(!im)throw Error('Could not open the selected artwork.');
      if(stamp!==fractalRequest)return;
      const cv=document.createElement('canvas');
      const scale=Math.min(1,512/Math.max(im.naturalWidth,im.naturalHeight));
      cv.width=Math.max(1,Math.round(im.naturalWidth*scale));
      cv.height=Math.max(1,Math.round(im.naturalHeight*scale));
      const ctx=cv.getContext('2d');
      ctx.fillStyle='#10191d';ctx.fillRect(0,0,cv.width,cv.height);
      ctx.drawImage(im,0,0,cv.width,cv.height);
      post(fullFractal,'mnc:fractal-art',{id,title:asset.title,image:cv.toDataURL('image/jpeg',.91)});
    }catch(error){readyMessage('fractal',error.message);}
  }

  function channelCanvas() {
    return MNC_FRONT_EFFECTS.canvas(CW,CH).getContext('2d',{willReadFrequently:true});
  }

  function cover(ctx,canvas,add) {
    ctx.globalCompositeOperation=add?'source-over':'destination-out';
    ctx.drawImage(canvas,0,0);
  }

  function foilLayerMask(background,text) {
    const result=channelCanvas(), pixels=result.createImageData(CW,CH);
    const paper=background.getImageData(0,0,CW,CH).data, letters=text.getImageData(0,0,CW,CH).data;
    for(let offset=0;offset<pixels.data.length;offset+=4){
      pixels.data[offset]=paper[offset+3];
      pixels.data[offset+1]=letters[offset+3];
      pixels.data[offset+3]=255;
    }
    result.putImageData(pixels,0,0);
    return result.canvas.toDataURL('image/png');
  }

  function foilMask(c,ink) {
    const cv=MNC_FRONT_EFFECTS.canvas(CW,CH);
    const ctx=cv.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#ff0000';ctx.fillRect(0,0,CW,CH);
    ctx.fillStyle='#ffff00';
    fillArtworkRegion(ctx,c);
    const pixels=ctx.getImageData(0,0,CW,CH);
    const layers=ink.getImageData(0,0,CW,CH).data;
    // The shader reads artwork coverage from green and ink protection from red.
    for(let offset=0;offset<pixels.data.length;offset+=4)pixels.data[offset]=255-layers[offset+3];
    ctx.putImageData(pixels,0,0);
    return cv.toDataURL('image/png');
  }

  function loadedCard() {
    return controls.prism.value===loadedFoilId?cardById(loadedFoilId):null;
  }

  function syncFoilActions() {
    const card=loadedCard(), hasImprint=!!card?.foilImprintAssetId;
    $('savePrismRecipe').disabled=!card||savePending;
    imprintButton.disabled=!card||!foilWebgl||!!imprintPending;
    imprintButton.textContent=hasImprint?'Replace imprint':'Imprint pattern';
    $('viewFoilImprint').hidden=$('removeFoilImprint').hidden=!hasImprint;
    $('removeFoilImprint').disabled=!!imprintPending;
  }

  async function sendCard() {
    if(!foilReady)return;
    const c=cardById(controls.prism.value);
    if(!c)return;
    const snapshot=deep(c),revision=++foilRequest;
    loadedFoilId='';syncFoilActions();
    readyMessage('prism','Loading '+snapshot.title+'…');
    try{
      const custom=useMask.checked&&MNC_MIRROR_MASK.hasMask(snapshot.mirrorMask);
      const ink=custom?null:channelCanvas(), background=channelCanvas(), text=channelCanvas();
      const onLayer=(id,canvas,lettering)=>{
        if(ink)cover(ink,canvas,!foilSurfaces.has(id));
        cover(background,canvas,id==='background');
        if(lettering!==canvas)cover(text,canvas,false);
        if(lettering)cover(text,lettering,true);
      };
      const [front,back,alpha]=await Promise.all([
        cardCanvas(snapshot,{onLayer,includeImprint:false}),backCanvas(),custom?MNC_MIRROR_MASK.render(snapshot):null
      ]);
      if(revision!==foilRequest)return;
      const defaultRegion=custom?1:snapshot.foilRecipe?.mask==='reverse'?2:snapshot.foilRecipe?.mask==='whole'?0:1;
      const recipe=custom&&snapshot.prismRecipe?{...snapshot.prismRecipe,region:1}:snapshot.prismRecipe;
      const mask=alpha?MNC_MIRROR_MASK.coverage(alpha,{foil:true}).toDataURL('image/png'):foilMask(snapshot,ink);
      post(fullFoil,'mnc:foil-card',{id:snapshot.id,title:snapshot.title,revision,recipe,
        defaultRegion,front:front.toDataURL('image/png'),back:back.toDataURL('image/png'),mask,
        layers:foilLayerMask(background,text),mirror:custom,width:CW,height:CH});
    }catch(error){readyMessage('prism',error.message);}
  }

  $('sendFractalArt').onclick=()=>{fractalCardId=selected()?.sourceAssetId===controls.fractal.value?currentId:'';sendArt();};
  $('sendFoilCard').onclick=sendCard;
  function pickMask() {
    const card=cardById(controls.prism.value);
    const available=MNC_MIRROR_MASK.hasMask(card?.mirrorMask);
    $('foilFinishMaskRow').hidden=!available;
    useMask.checked=available;
    syncFoilActions();
  }
  controls.prism.onchange=pickMask;
  useMask.onchange=sendCard;
  $('artToFractal').onclick=()=>{
    const c=selected();
    if(!c?.sourceAssetId)return;
    fractalCardId=c.id;
    tab('fractal');
    controls.fractal.value=c.sourceAssetId;
    sendArt();
  };
  $('savePrismRecipe').onclick=()=>{
    if(!foilReady||!loadedCard()||savePending)return;
    savePending=true;syncFoilActions();post(fullFoil,'mnc:foil-recipe');
  };

  imprintButton.onclick=()=>{
    const card=loadedCard();
    if(!card||!foilWebgl||imprintPending)return;
    const request=++imprintRequest, revision=foilRequest;
    imprintPending={card,request,revision};
    syncFoilActions();
    readyMessage('prism','Capturing the pattern straight-on…');
    post(fullFoil,'mnc:foil-imprint',{cardId:card.id,request,revision});
  };
  $('viewFoilImprint').onclick=()=>{
    const card=loadedCard();
    if(card){currentId=card.id;tab('viewer');}
  };
  $('removeFoilImprint').onclick=()=>{
    const card=loadedCard();
    if(!card||imprintPending)return;
    delete card.foilImprintAssetId;
    persist();syncFoilActions();
    readyMessage('prism','Imprint removed from '+card.title+'.');
  };

  async function saveImprint(payload) {
    const job=imprintPending;
    if(!job||job.saving||payload.request!==job.request||payload.revision!==job.revision||payload.cardId!==job.card.id)return;
    if(payload.type==='mnc:foil-imprint-error'){
      imprintPending=null;syncFoilActions();readyMessage('prism',payload.message);
      return;
    }
    job.saving=true;
    const {card}=job;
    try{
      if(typeof payload.image!=='string'||payload.image.length>5000000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(payload.image)){
        throw Error('Foil Lab did not return a card-sized PNG.');
      }
      const name='Foil imprint '+slug(card.id)+' '+Date.now()+'.png';
      let asset;
      if(window.MNC_DISK?.connected){
        const blob=await (await fetch(payload.image)).blob();
        asset=await window.MNC_DISK.upload(blob,name,'art');
      }else{
        asset={id:uniqueId('IMPRINT-',state.assets),title:'Foil imprint · '+card.title,kind:'Foil imprint',
          originalFilename:name,dataURI:payload.image,w:CW,h:CH};
        state.assets.push(asset);
      }
      if(cardById(card.id)!==card||!asset?.id)throw Error('The card changed before the imprint could be attached.');
      if(card.layoutDesign?.layers)delete card.layoutDesign.layers.foilImprint;
      if(Array.isArray(card.layoutDesign?.order)){
        card.layoutDesign.order=card.layoutDesign.order.filter(id=>id!=='foilImprint');
      }
      card.foilImprintAssetId=asset.id;
      if(payload.recipe)card.prismRecipe=payload.recipe;
      persist();
      readyMessage('prism','Imprint added to '+card.title+' for card previews and exports.');
    }catch(error){readyMessage('prism',error.message);}
    finally{imprintPending=null;syncFoilActions();}
  }

  function start(which) {
    if(!http){
      $(which==='fractal'?'fractalFileNotice':'foilFileNotice').hidden=false;
      return;
    }
    if(which==='fractal'){
      const previous=controls.fractal.value;
      dropDownOptions(controls.fractal,state.assets.map(a=>[a.id,a.title]),
        state.assets.some(a=>a.id===previous)?previous:selected()?.sourceAssetId||state.assets[0]?.id);
      if(!fullFractal.hasAttribute('src'))fullFractal.src='labs/fractal-lab.html?mnc=1&v=0.9.16';
      else if(fractalReady)post(fullFractal,'mnc:fractal-pause',{active:true});
    }else{
      dropDownOptions(controls.prism,state.cards.map(c=>[c.id,c.title]),currentId);
      pickMask();
      if(!fullFoil.hasAttribute('src'))fullFoil.src='labs/foil-lab.html?mnc=1&v=0.9.16';
      else if(foilReady){post(fullFoil,'mnc:foil-pause',{active:true});sendCard();}
    }
  }

  function receiveFractal(payload) {
    switch(payload.type){
      case 'mnc:fractal-ready':
        fractalReady=true;post(fullFractal,'mnc:fractal-pause',{active:activeTab==='fractal'});
        readyMessage('fractal',payload.webgl?'Choose artwork or work with a built-in study.':'WebGL is unavailable in this browser.');
        if(activeTab==='fractal')sendArt();
        break;
      case 'mnc:fractal-loaded':
        readyMessage('fractal',payload.title+(payload.webgl?' loaded':' · WebGL unavailable'));
        break;
      case 'mnc:open-foil': tab('prism');break;
      case 'mnc:fractal-pattern': {
        const source=cardById(fractalCardId);
        if(source?.sourceAssetId===payload.sourceAssetId)currentId=source.id;
        pendingPattern=payload.recipe;tab('prism');break;
      }
      case 'mnc:fractal-frame': {
        if(typeof payload.image!=='string'||!payload.image.startsWith('data:image/png;base64,'))return;
        const title='Fractal study · '+String(payload.title||'Untitled');
        const asset={id:uniqueId('ART-',state.assets),title,originalFilename:slug(title)+'.png',
          dataURI:payload.image,kind:'Fractal study',source:'Fractal Lab',sourceAssetId:payload.sourceAssetId||'',reviewStatus:'study',accent:'#a48b63'};
        state.assets.push(asset);persist();readyMessage('fractal',title+' saved to Artwork.');
        break;
      }
    }
  }

  function receiveFoil(payload) {
    switch(payload.type){
      case 'mnc:foil-ready':
        foilReady=true;
        post(fullFoil,'mnc:foil-pause',{active:activeTab==='prism'});
        if(activeTab==='prism')sendCard();
        break;
      case 'mnc:foil-loaded':
        if(payload.revision!==foilRequest)break;
        loadedFoilId=payload.cardId;
        foilWebgl=payload.webgl;
        syncFoilActions();
        readyMessage('prism',payload.title+(payload.webgl?' · Prism v0.11':' · 2D preview'));
        if(pendingPattern){
          post(fullFoil,'mnc:foil-pattern',{pattern:pendingPattern});
          pendingPattern=null;
        }
        break;
      case 'mnc:foil-pattern-applied':
        readyMessage('prism',payload.webgl?'Fractal pattern applied. Save the finish to keep it with this card.':'Fractal pattern loaded. WebGL is needed to preview it.');
        break;
      case 'mnc:foil-saved': {
        savePending=false;
        syncFoilActions();
        const card=cardById(payload.cardId);
        if(!card||!payload.recipe)return;
        card.prismRecipe=payload.recipe;persist();
        readyMessage('prism','Prism finish saved to '+card.title+'.');
        break;
      }
      case 'mnc:foil-imprinted':
      case 'mnc:foil-imprint-error': saveImprint(payload);break;
      case 'mnc:foil-error': savePending=false;syncFoilActions();readyMessage('prism',payload.message);break;
    }
  }

  window.addEventListener('message',e=>{
    if(!http||e.origin!==location.origin||!e.data||typeof e.data.type!=='string')return;
    if(e.source===fullFractal.contentWindow)receiveFractal(e.data);
    if(e.source===fullFoil.contentWindow)receiveFoil(e.data);
  });
  const olderTab=window.MNC_tabChanged;
  window.MNC_tabChanged=name=>{
    if(olderTab)olderTab(name);
    if(http&&fractalReady&&name!=='fractal')post(fullFractal,'mnc:fractal-pause',{active:false});
    if(http&&foilReady&&name!=='prism')post(fullFoil,'mnc:foil-pause',{active:false});
    if(name==='fractal'||name==='prism')start(name);
    if(name==='rules')window.MNC_renderGamePage();
    if(name==='viewer')window.MNC_renderCardView();
  };
  async function startProject(){
    await window.MNC_DISK?.init();
    if(!state.cards.some(inWorkingCatalog))$('cardScope').value='all';
    refreshAll();
    if(!window.MNC_DISK?.hasSave)writeAutosave();
  }
  startProject().catch(error=>{
    $('saveStatus').textContent=error.message;
    refreshAll();
  });
})();
