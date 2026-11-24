'use strict';

const mncEmbedded=parent!==window && new URLSearchParams(location.search).get('mnc')==='1';
let mncCard=null,mncBackVersion=0;

function mncReport(type,data={}) {
  if(mncEmbedded)parent.postMessage({type,...data},location.origin);
}
function mncImage(value) {
  return typeof value==='string'&&/^data:image\/(?:png|jpeg|webp);base64,/i.test(value);
}
function mncTextureKey() {
  return mncCard ? 'mnc|'+mncCard.revision : null;
}
function mncComposedCard() {
  return {front:mncCard.front,mask:mncCard.mask,layers:mncCard.layers};
}
function mncAppearance() {
  if (!mncEmbedded) return;
  $('mncCardLabel').hidden=!mncCard;
  if(mncCard){
    $('mncCardLabel').textContent=mncCard.title;
    fallback.src=mncCard.front;
  }
  $('artwork').disabled=$('scheme').disabled=!!mncCard;
  for(const id of ['paletteMode','numberLayout','showArtStats'])$(id).disabled=!!mncCard;
  for(const value of [4,5]){
    const option=$('region').querySelector(`option[value="${value}"]`);
    option.hidden=option.disabled=!mncCard?.layers;
  }
  $('region').querySelector('option[value="1"]').textContent=mncCard?.mirror?'Mirror finish mask':'Artwork';
  $('region').querySelector('option[value="2"]').textContent=mncCard?.mirror?'Reverse · outside mirror mask':'Reverse · outside art';
}
function mncApplyPattern(transfer) {
  const fields=['foldX','foldY','foldGain','foldTrap','foldRadius','foldPhase','foldPanX','foldPanY','iterations','zoom','twist','scale','contrast'];
  const next={};
  for(const key of fields)if(Number.isFinite(transfer[key]))next[key]=transfer[key];
  state=validate({...state,...next,pattern:transfer.patternMap?17:8,patternMap:transfer.patternMap||'',
    foil:state.foil<.05?.65:state.foil,region:transfer.region===2?2:1});
  $('preset').value='custom';
  sync();
}
function mncSavePatternPreset(transfer) {
  if(!transfer.presetName||userPresets.length>=100)return;
  try{
    const preset={id:crypto.randomUUID(),name:String(transfer.presetName).slice(0,60),settings:finishSettings(state)};
    const next=[...userPresets,preset];
    localStorage.setItem('mnc-foil-presets-v1',JSON.stringify(next));
    userPresets=next;refreshUserPresets();$('preset').value='saved:'+preset.id;
  }catch{
    status.textContent='Pattern loaded. Use Export JSON to keep this finish.';
  }
}
function mncLoaded() {
  mncReport('mnc:foil-ready',{webgl:ready});
}

if (mncEmbedded) {
  document.body.classList.add('mnc-embedded');
  $('randomCard').textContent='Random finish';
  window.addEventListener('message',async e=>{
    if(e.source!==parent||e.origin!==location.origin||!e.data)return;
    const payload=e.data;
    if (payload.type==='mnc:foil-pause') {
      window.mncFoilPaused=!payload.active;
      if(payload.active&&ready&&!raf)raf=requestAnimationFrame(tick);
      if(!payload.active&&showcase)finishShowcase(true,'Showcase stopped when the lab was hidden.');
      return;
    }
    if (payload.type==='mnc:foil-recipe' && mncCard) {
      mncReport('mnc:foil-saved',{cardId:mncCard.id,revision:mncCard.revision,recipe:{version:'prism-foil-lab-0.11',...state}});
      return;
    }
    if(payload.type==='mnc:foil-imprint'){
      const {request,cardId,revision}=payload;
      try{
        if(cardId!==mncCard?.id||revision!==mncCard.revision)throw Error('Load the selected card again before imprinting.');
        const image=imprintPattern(mncCard.width,mncCard.height);
        mncReport('mnc:foil-imprinted',{request,cardId,revision,image,recipe:{version:'prism-foil-lab-0.11',...state}});
      }catch(error){
        mncReport('mnc:foil-imprint-error',{request,cardId,revision,message:error.message});
      }
      return;
    }
    if(payload.type==='mnc:foil-pattern'&&payload.pattern){
      mncApplyPattern(payload.pattern);
      mncSavePatternPreset(payload.pattern);
      mncReport('mnc:foil-pattern-applied',{webgl:ready});
      return;
    }
    if(payload.type!=='mnc:foil-card'||![payload.front,payload.back,payload.mask].every(mncImage)||
      (payload.layers&&!mncImage(payload.layers)))return;
    if(showcase)finishShowcase(true,'Card changed.');
    mncCard=payload;
    state=validate(payload.recipe ? {...state,...payload.recipe} : {...state,region:payload.defaultRegion??1});
    $('preset').value='custom';
    sync();
    const rev=++mncBackVersion;
    try {
      if(ready){
        const back=await texture(payload.back);
        if(rev!==mncBackVersion){gl.deleteTexture(back);return;}
        if(textures.back)gl.deleteTexture(textures.back);
        textures.back=back;
        await loadDesign(textureKey());
        if(rev!==mncBackVersion)return;
        await ensureDesign();
      }else{
        const showFront=()=>{fallback.src=mncCard.front;};
        $('front').onclick=$('pose').onclick=showFront;
        $('flip').onclick=()=>{fallback.src=fallback.src===mncCard.back?mncCard.front:mncCard.back;};
      }
      if(rev!==mncBackVersion)return;
      if(!ready)status.textContent='2D preview · WebGL is unavailable.';
      mncReport('mnc:foil-loaded',{title:payload.title,cardId:payload.id,webgl:ready,revision:payload.revision});
    }catch(error){
      mncReport('mnc:foil-error',{message:error.message});
    }
  });
}
