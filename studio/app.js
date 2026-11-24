'use strict';
/* MNC Card Lab v0.3. Standalone local HTML application; no server or external JS dependencies. */
const $=id=>document.getElementById(id);
const CW=750,CH=1050;
const deep=x=>JSON.parse(JSON.stringify(x));
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const ascii=s=>String(s||'').normalize('NFKD').replace(/[^\x20-\x7e]/g,'?');
const slug=s=>String(s||'file').replace(/[^a-z0-9_-]+/gi,'_').slice(0,70);
const storageKey = window.MNC_EDITION?.storageKey||'mnc-creative-suite-v09';
const cardSelectionKey=storageKey+':active-card';
const projectVersion=9;
const catalog = window.MNC_CATALOG;
const game = window.MNC_GAME;
const backs = window.MNC_BACKS;
const shapes = window.MNC_SHAPES;
const front = window.MNC_FRONT;
const newPrintSheet = (number, slots=[]) => ({
  id:'S-'+String(number).padStart(2,'0'), finish:'Standard',
  slots:Array.from({length:8}, (_, i)=>slots[i]||'')
});
const baseDefaults = () => ({
  version:projectVersion, typeGlyphs:{},fractal:{sourceAssetId:game.ashArt.id,mode:'kaleido',folds:7,iterations:3,distortion:.36,preserve:.55,color:.72,zoom:1,rotation:0,duration:12},
  templates:[], cardShapes:[], villainSubtypes:[], assets:[deep(game.ashArt),...deep(window.MNC_STARTER_ASSETS)],
  cards:[deep(game.ashman),...deep(window.MNC_STARTER_CARDS)], sheets:[newPrintSheet(1,[game.ashman.id])],
  customBack:null,backMode:'mnc',backDesigns:[],activeBackDesignId:'',backEditingId:'',
  duplex:'same',includeFinishPreview:false,bleed:true,
  backOffsetX:0,backOffsetY:0,typeOverrides:{},setTotals:{},packPlan:null,catalogCollections:{},catalogFileName:''
});
function getDefaults() {
  const project=baseDefaults();
  const starter=window.MNC_CATALOG_STARTER;
  const result=starter?{...catalog.nextProject(project,catalog.plan(project,starter)),catalogFileName:'Starter catalog'}:project;
  MNC_SET_PLAN.restore(result);MNC_SYMBOLS.restore(result);MNC_TYPE_DESIGN.restore(result);
  return result;
}
function restoreProject(saved) {
  if (!Array.isArray(saved?.cards) || !Array.isArray(saved?.assets) || !Array.isArray(saved?.sheets)) {
    throw Error('The backup needs cards, artwork, and print sheets.');
  }
  for (const list of [saved.cards,saved.assets]) {
    const ids=list.map(item=>item?.id);
    if (ids.some(id=>typeof id!=='string'||!id) || new Set(ids).size!==ids.length) throw Error('Each card and artwork source must have a unique ID.');
  }
  if (saved.sheets.some(sheet=>!Array.isArray(sheet?.slots))) throw Error('Every print sheet needs a slot list.');
  const next={...baseDefaults(),...saved,version:Math.max(Number(saved.version)||0,projectVersion)};
  if (Number(saved.version||0)<7 && !next.cards.some(card=>card.id===game.ashman.id)) {
    const ashAsset=next.assets.find(asset=>asset.originalFilename?.toLowerCase()==='ashman.png');
    const sourceAssetId=ashAsset?.id || (next.assets.some(asset=>asset.id===game.ashArt.id) ? uniqueId('ART-',next.assets) : game.ashArt.id);
    if(!ashAsset)next.assets.unshift({...deep(game.ashArt),id:sourceAssetId});
    next.cards.unshift({...deep(game.ashman),sourceAssetId});
  }
  for(const key of ['typeOverrides','typeGlyphs','setTotals','catalogCollections']){
    if(!next[key]||typeof next[key]!=='object'||Array.isArray(next[key]))next[key]={};
  }
  next.sheets=next.sheets.map((sheet,index)=>({...newPrintSheet(index+1,sheet.slots),finish:sheet.finish||'Standard'}));
  next.templates=Array.isArray(next.templates)?next.templates.filter(t=>typeof t?.id==='string'&&typeof t.name==='string'):[];
  next.cards=next.cards.map(value=>{
    const card={...MNC_CARD_METADATA.migrate(game.migrateCharacter(value),next.catalogCollections[value.collectionId])};
    if (card.frontLayout) card.frontLayout=front.settings(card.frontLayout);
    if (card.layoutDesign) card.layoutDesign=MNC_LAYOUT.normalize(card.layoutDesign);
    if (card.artCutout) card.artCutout=MNC_ART_CUTOUT.normalize(card.artCutout);
    if (card.mirrorMask) card.mirrorMask=MNC_MIRROR_MASK.normalize(card.mirrorMask);
    delete card.shapePreview;
    return card;
  });
  MNC_SET_PLAN.restore(next);
  MNC_SYMBOLS.restore(next);
  MNC_TYPE_DESIGN.restore(next);
  next.villainSubtypes=game.villainSubtypeOptions(next);
  shapes.restore(next);
  backs.restore(next);
  return next;
}
let state=getDefaults();
let savedCardId='';
try {
  const saved=localStorage.getItem(storageKey)||localStorage.getItem('mnc-creative-suite-v08')||localStorage.getItem('mnc-creative-suite-v07')||localStorage.getItem('mnc-creative-suite-v05')||localStorage.getItem('mnc-creative-suite-v04')||localStorage.getItem('mnc-card-lab-v03');
  if(saved) state=restoreProject(JSON.parse(saved));
  savedCardId=localStorage.getItem(cardSelectionKey)||'';
} catch(error) {console.warn('Could not read autosave',error);}
let currentId=state.cards.find(c=>c.id===savedCardId)?.id||state.cards.find(c=>c.id===game.ashman.id)?.id||state.cards.find(inWorkingCatalog)?.id||state.cards[0]?.id||null;
let activeTab='visualLanguage';
let pendingCardDesign=null;
const fallbackImageData=window.MNC_IMAGE_DATA||{};
const imageCache=new Map();
const imageSizes=new Map();
function artById(id){return id?state.assets.find(x=>x.id===id):undefined}
function cardById(id){return id?state.cards.find(x=>x.id===id):undefined}
function assetURI(a){if(!a)return ''; if(a.dataURI)return a.dataURI;const key=a.file?.split('/').pop().split('-')[0];return a.file||fallbackImageData[key]}
function imgLoad(uri){if(!uri)return Promise.resolve(null);if(imageCache.has(uri))return imageCache.get(uri);const promise=new Promise(resolve=>{let im=new Image();im.onload=()=>{imageSizes.set(uri,{w:im.naturalWidth||im.width,h:im.naturalHeight||im.height});resolve(im);};im.onerror=()=>resolve(null);im.src=uri;});imageCache.set(uri,promise);return promise}
let saveTimer=null;
function cardSaveStatus(message) {
  for(const id of ['cardSaveStatus','designSaveStatus']){
    const status=$(id);
    if(status.textContent!==message)status.textContent=message;
  }
}
function writeAutosave() {
  clearTimeout(saveTimer);
  saveTimer=null;
  try {
    localStorage.setItem(storageKey,JSON.stringify(state));
    if(!window.MNC_DISK?.connected)cardSaveStatus('Saved in this browser');
    if(!window.MNC_DISK?.connected)$('saveStatus').textContent='Project saved in this browser.';
  } catch(error) {
    if(!window.MNC_DISK?.connected)cardSaveStatus('Couldn’t save in this browser. Export a project backup.');
    if(!window.MNC_DISK?.connected)$('saveStatus').textContent='Browser storage is full or unavailable. Export a project JSON to keep your edits.';
  }
  window.MNC_DISK?.save();
}
function persist() {
  clearTimeout(saveTimer);
  cardSaveStatus('Saving…');
  saveTimer=setTimeout(writeAutosave,250);
}
function editCardFields(card,fields) {
  Object.assign(card,fields);
  if(catalogCard(card))Object.assign(card.catalogEdits??={},fields);
}
function setCardArtwork(card,id) {
  const asset=artById(id);
  editCardFields(card,{sourceAssetId:asset?.id||'',artworkFilename:asset?catalog.filenameFor(asset):''});
  card.artworkChosen=true;
  if(asset&&!game.isGameCard(card))card.accent=asset.accent||card.accent;
}
window.addEventListener('pagehide',()=>{if(saveTimer!==null)writeAutosave();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&saveTimer!==null)writeAutosave();});
function dl(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}
function downloadText(text,name,mime='text/plain'){dl(new Blob([text],{type:mime}),name)}
function canvasPNG(cv,name){cv.toBlob(blob=>{if(blob)dl(blob,name)},'image/png')}
function tab(name,options){
  if(activeTab==='layoutDesigner'&&name!=='layoutDesigner'&&window.MNC_closeLayoutTrace?.()===false)return;
  if(activeTab==='library'&&name!=='library')pendingCardDesign=null;
  activeTab=name;
  document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===name));
  document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id===name));
  const track=$('suiteTabs'), visible=track.querySelector('button.active');
  if(visible){
    const area=track.getBoundingClientRect(), item=visible.getBoundingClientRect();
    if(item.right>area.right)track.scrollLeft+=item.right-area.right;
    else if(item.left<area.left)track.scrollLeft+=item.left-area.left;
  }
  if(name==='studio')refreshStudio();
  if(name==='library'){refreshAssetsFilter();renderLibrary();}
  if(name==='layoutDesigner')window.MNC_refreshLayoutDesigner?.();
  if(name==='foil'){refreshFoilCardOptions();renderFoil();}
  if(name==='production')renderSheets();
  if(name==='backs')window.MNC_refreshBackDesigner?.();
  if(name==='shapes')window.MNC_refreshShapeDesigner?.();
  if(name==='mirror')window.MNC_refreshMirrorFinish?.();
  if(name==='setDesigner')window.MNC_refreshSetDesigner?.();
  if(name==='visualLanguage')window.MNC_refreshVisualLanguage?.(options);
  if(name==='typeDesigner')window.MNC_refreshTypeDesigner?.();
  if(name==='data')renderSummary();
  window.MNC_tabChanged?.(name);
}
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>tab(btn.dataset.tab)));
{
 const tray=$('suiteTray'), button=$('suiteTrayToggle'), key='mnc-suite-header-open';
 function show(open){
   tray.hidden=!open;
   button.setAttribute('aria-expanded',String(open));
   button.title=open?'Hide suite header':'Show suite header';
 }
 try{show(localStorage.getItem(key)==='true');}catch{show(false);}
 button.onclick=()=>{
   const open=tray.hidden;
   show(open);
   try{localStorage.setItem(key,String(open));}catch{}
 };
}
function uniqueId(prefix,existing){let i=1;while(existing.some(x=>x.id===`${prefix}${String(i).padStart(3,'0')}`))i++;return `${prefix}${String(i).padStart(3,'0')}`}
function catalogCard(card) {
  return Boolean(card?.catalogId&&!card.catalogUnlisted);
}
function inWorkingCatalog(card) {
  return Boolean(card&&!card.catalogUnlisted&&(catalogCard(card)||game.isGameCard(card)));
}
function collectionFor(card) {
  return catalogCard(card)?state.catalogCollections?.[card.collectionId]:undefined;
}
function dropDownOptions(select,items,value){select.innerHTML='';for(const [v,t] of items){let op=document.createElement('option');op.value=v;op.textContent=t;select.append(op)}if(value!=null)select.value=value}

const presetAppearanceFields=[
  'fit','zoom','panX','panY','accent','useTypeColor','surface','mainColor','backgroundLightness','frameColor','borderColor',
  'frameStyle','frameWidth','frameRadius','cutRadius','artHeight','artInset','filmTheme','nameplatePreset','fontId','glyphSeed','glyphVariantMode',
  'showIcons','showMatchupNames','showTiming','showPower','showQuote','showStats','episodeBadge','setGlyph','setGlyphAsset',
  'typeIconGlyph','typeIconAsset','typeSymbol','collectionSymbol','typeSymbolMode','collectionSymbolMode','collectionFooterMode',
  'artworkProfile','overlayAssetId','overlayOpacity','foilRecipe','prismRecipe'
];

function designPreset(c,id,name,{typeDefaultFor}={}) {
  const appearance=Object.fromEntries(presetAppearanceFields.map(key=>[key,c[key]??null]));
  appearance.setGlyph=c.setGlyph??collectionFor(c)?.glyph??(game.isGameCard(c)?'✦':'');
  appearance.setGlyphAsset=c.setGlyphAsset||'';
  appearance.typeIconGlyph=MNC_CARD_METADATA.customIcon(c)||null;
  appearance.collectionFooterMode=front.usesSharedFooter(c)?'shared':'custom';
  const frontLayout=typeDefaultFor?front.settings(front.values({...c,collectionFooterMode:'custom'})):c.frontLayout||null;
  if(typeDefaultFor&&frontLayout.text.matchLabel){
    const heading=frontLayout.text.matchLabel;
    for(const key of ['font','style','size','color']){
      if(!Object.hasOwn(c.frontLayout?.text?.matchLabel||{},key))delete heading[key];
    }
    if(!Object.keys(heading).length)delete frontLayout.text.matchLabel;
  }
  return deep({
    id,name,template:c.template,typeDefaultFor,designFamily:c.family,designType:MNC_SET_PLAN.profileFor(c),
    titlePosition:c.titlePosition||[.075,.075],creditPosition:c.creditPosition||[.07,.958],
    microPosition:c.microPosition||[.93,.958],layers:c.layers||[],useHandGlyphs:!!c.useHandGlyphs,
    artWindow:c.artWindow||{x:.07,y:.14,w:.86,h:.52},artShape:c.artShape||'rounded',
    artBorder:c.artBorder||'solid',artRadius:c.artRadius??24,nameplate:c.nameplate||'solid',
    artShapeId:c.artShapeId||'',nameplateShapeId:c.nameplateShapeId||'',
    frontLayout,
    layoutDesign:c.layoutDesign||null,
    appearance
  });
}

function writeDesignPreset(template) {
  const index=state.templates.findIndex(entry=>entry.id===template.id);
  if(index>=0)state.templates[index]=template;
  else state.templates.push(template);
  renderTemplateOptions(template.id);
  persist();
}

function saveDesignPreset(c,{defaultName,name:enteredName,id}={}) {
  const name=(enteredName??prompt('Name this layout preset:',defaultName||(c.title||'Untitled')+' layout'))?.trim();
  if(!name)return;
  const original=id&&state.templates.find(t=>t.id===id);
  const collision=state.templates.find(t=>!t.typeDefaultFor&&t.id!==id&&t.name.toLowerCase()===name.toLowerCase());
  if(collision&&(original||!confirm('Replace the design “'+collision.name+'”?')))return;
  const template=designPreset(c,original?.id||collision?.id||uniqueId('LAY-',state.templates),name,{typeDefaultFor:original?.typeDefaultFor});
  writeDesignPreset(template);
  $('presetStatus').textContent='Saved design “'+name+'”.';
  return template;
}

function applyDesignPreset(c,t,{refresh=true}={}) {
  const gameTemplate=['Game Frame','Game Full Art'].includes(t.template);
  if(gameTemplate&&!game.role(c)){alert('Choose Character, Critic, or Item to use this layout.');return false;}
  if(gameTemplate&&!game.isGameCard(c))window.MNC_enableGameFrame?.(c);
  Object.assign(c,{
    template:t.template,titlePosition:deep(t.titlePosition||[.075,.075]),
    creditPosition:deep(t.creditPosition||[.07,.958]),microPosition:deep(t.microPosition||[.93,.958]),
    useHandGlyphs:!!t.useHandGlyphs,artWindow:deep(t.artWindow||{x:.07,y:.14,w:.86,h:.52}),
    artShape:t.artShape||'rounded',artBorder:t.artBorder||'solid',artRadius:t.artRadius??24,
    nameplate:t.nameplate||'solid',artShapeId:t.artShapeId||'',nameplateShapeId:t.nameplateShapeId||''
  });
  if(t.layers)c.layers=deep(t.layers);
  if(t.frontLayout)c.frontLayout=front.settings(t.frontLayout);
  else delete c.frontLayout;
  if(t.layoutDesign)c.layoutDesign=MNC_LAYOUT.normalize(t.layoutDesign);
  else delete c.layoutDesign;
  if(t.appearance){
    for(const key of presetAppearanceFields){
      if(!Object.hasOwn(t.appearance,key))continue;
      const value=t.appearance[key];
      if(['typeIconGlyph','typeIconAsset','typeSymbol','collectionSymbol','typeSymbolMode','collectionSymbolMode'].includes(key)){
        if(value!==null)editCardFields(c,{[key]:value});
      }
      else if(['setGlyph','setGlyphAsset','episodeBadge'].includes(key))editCardFields(c,{[key]:value??''});
      else if(value===null)delete c[key];
      else c[key]=deep(value);
    }
    if(c.family!=='Character'&&!Object.hasOwn(t.appearance,'typeIconGlyph')){
      const legacyIcon=MNC_CARD_METADATA.customIcon(t.appearance);
      if(legacyIcon)editCardFields(c,{typeIconGlyph:legacyIcon,typeIconAsset:''});
    }
  }else{
    if(t.gameLayout)Object.assign(c,deep(t.gameLayout));
    if(!catalogCard(c)){
      c.effectText=t.effectText||c.effectText||'';
      c.subtype=t.subtype||c.subtype||'';
    }
  }
  if(refresh){
    persist();refreshStudio();
    $('presetStatus').textContent='Applied '+t.name+' to '+c.title+'.'+
      (t.appearance?'':' Save this preset again to include the current set icon.');
  }
  return true;
}

function designProfileIds(card,id=MNC_SET_PLAN.profileFor(card)){
  return card.family==='Character'&&game.categoryFor(card.characterCategory)?.id==='creature'&&id!=='creature'
    ?['creature',id]:[id];
}

function designFitsFamily(design,family){
  return !!design&&!!family&&(!['Game Frame','Game Full Art'].includes(design.template)||Object.hasOwn(game.roles,family));
}

function playableDesignType(id){
  const profile=MNC_SET_PLAN.profile(id);
  return id==='creature'?{...profile,family:'Character',category:'Creature'}:profile;
}

function designPreviewContext(design,previewType){
  const profile=playableDesignType(previewType||design?.designType);
  if(profile?.family&&(!design||designFitsFamily(design,profile.family)))return {profile,family:profile.family};
  const family=design?.designFamily||(design?.template==='Archive'?'Archive':'Character');
  const fallback=family==='Character'?playableDesignType('hero'):MNC_TYPE_DESIGN.profiles().find(type=>type.family===family);
  return {profile:fallback,family};
}

function typeDesignVariants(id){
  const profile=playableDesignType(id),setting=state.visualLanguage.profiles[id];
  if(!profile||!setting)return [];
  return (setting.variantIds||[]).map(key=>state.templates.find(design=>design.id===key))
    .filter(design=>designFitsFamily(design,profile.family)&&design.id!==setting.presetId);
}

function assignDesign(design,typeId,assignment){
  const profile=playableDesignType(typeId),setting=state.visualLanguage.profiles[typeId];
  if(!setting||!state.typeDesigns.profiles[typeId]||!designFitsFamily(design,profile?.family))return false;
  const variants=setting.variantIds??=[];
  if(assignment==='default'){
    if(setting.presetId===design.id)return true;
    if(setting.presetId&&state.templates.some(item=>item.id===setting.presetId))variants.push(setting.presetId);
    setting.presetId=design.id;
    setting.palette={};
    setting.border=null;
  }else if(assignment==='variant'){
    if(setting.presetId===design.id)return true;
    variants.push(design.id);
  }else return false;
  setting.variantIds=[...new Set(variants)].filter(id=>id!==setting.presetId);
  persist();
  return true;
}

function typeDesignPreset(card,id=MNC_SET_PLAN.profileFor(card)){
  const profiles=state.visualLanguage?.profiles||{};
  const presetId=designProfileIds(card,id).reverse().map(key=>profiles[key]?.presetId).find(Boolean);
  return state.templates.find(item=>item.id===presetId);
}

function applyTypeDesignPreset(card,id=MNC_SET_PLAN.profileFor(card),{followSymbols=false,designId}={}){
  const chosen=state.templates.find(item=>designId&&item.id===designId);
  const variant=designFitsFamily(chosen,card.family);
  const preset=variant?chosen:typeDesignPreset(card,id);
  const compatible=designFitsFamily(preset,card.family);
  if(compatible)applyDesignPreset(card,preset,{refresh:false});
  const profiles=variant?[]:designProfileIds(card,id).map(key=>state.visualLanguage.profiles[key]);
  const border=profiles.map(profile=>profile?.border).filter(Boolean).at(-1);
  if(border)MNC_OUTER_BORDER.applyStandard(card,border);
  const palette=Object.assign({},...profiles.map(profile=>profile?.palette));
  MNC_TYPE_DESIGN.applyPalette(card,palette);
  if(compatible||followSymbols)editCardFields(card,{typeSymbol:null,collectionSymbol:null,typeSymbolMode:'standard',collectionSymbolMode:'standard'});
  return !!compatible||!!border||Object.keys(palette).length>0;
}

function applyStartingDesign(card,id,designId){
  card.collectionFooterMode='shared';
  MNC_OUTER_BORDER.applyStartingBand(card);
  applyTypeDesignPreset(card,id,{designId});
}

function captureTypeDesign(card,id){
  const setting=state.visualLanguage.profiles[id],type=MNC_SET_PLAN.profile(id);
  if(!setting||!type||!MNC_TYPE_DESIGN.matching(card,id))return null;
  const previous=state.templates.find(item=>item.id===setting.presetId&&item.typeDefaultFor===id);
  const template=designPreset(card,previous?.id||uniqueId('LAY-',state.templates),type.name+' · starting layout',{typeDefaultFor:id});
  const {symbol}=MNC_SYMBOLS.cardSymbol(state,card);
  const {symbol:mark}=MNC_SYMBOLS.cardSymbol(state,card,'collection');
  if(MNC_SYMBOLS.cardMode(card,'type')!=='standard')setting.symbol=deep(symbol);
  if(MNC_SYMBOLS.cardMode(card,'collection')!=='standard')setting.setMark=deep(mark);
  setting.palette={};
  setting.border=null;
  if(setting.presetId&&setting.presetId!==template.id&&state.templates.some(item=>item.id===setting.presetId)){
    setting.variantIds=[...new Set([...(setting.variantIds||[]),setting.presetId])];
  }
  setting.presetId=template.id;
  writeDesignPreset(template);
  return template;
}

function attachListeners(){
 $('catalogStarterLink').hidden=!window.MNC_EDITION?.starterWorkbook;
 $('assetSearch').oninput=renderLibrary;$('assetFilter').onchange=renderLibrary;
 $('artworkWithoutImage').onclick=()=>finishCardArtwork();
 $('newArtwork').addEventListener('change', async e=>{const fs=[...e.target.files];await importImages(fs);e.target.value=''});
 $('cardSearch').oninput=renderCardList; $('cardScope').onchange=renderCardList;
 $('addCard').onclick=()=>openCardDesigns();
 $('cloneCard').onclick=duplicateCard;
 $('saveCardPNG').onclick=async()=>{
   const c=cardById(currentId);
   if(!c)return;
   const canvas=await cardCanvas(deep(c),{rounded:true});
   canvasPNG(canvas,slug(c.id)+'_'+slug(c.title)+'.png');
 };
 $('pngBack').onclick=async()=>{
   const design=state.backMode==='designed'?backs.active(state):null;
   const cv=await backCanvas();
   canvasPNG(cv,'MNC_Back_'+slug(design?backs.name(design):state.backMode)+'.png');
 };
 $('saveTemplate').onclick=()=>{const c=cardById(currentId);if(c)saveDesignPreset(c);};
 $('layoutPresets').onchange=event=>{$('applyTemplate').disabled=!event.target.value||!cardById(currentId);};
 $('applyTemplate').onclick=()=>{
   const c=cardById(currentId), t=(state.templates||[]).find(layout=>layout.id===$('layoutPresets').value);
   if(t&&c)applyDesignPreset(c,t);
 };
 $('resetTextPositions').onclick=()=>{const c=cardById(currentId);if(!c)return;c.titlePosition=[.075,.075];c.creditPosition=[.07,.958];c.microPosition=[.93,.958];persist();refreshStudio()};
 $('useArt').onclick=()=>tab('library');
 const cardFields=['title','family','rarity','symbols','artist','lore','template','fit','zoom','panX','panY','tags','showStats'];
 const linkedFields=new Set(['title','family','rarity','lore']);
 for(const key of cardFields){
   const el=$('c_'+key);
   const event=['zoom','panX','panY','title','artist','lore'].includes(key)?'input':'change';
   el.addEventListener(event,()=>{
     const c=cardById(currentId);
     if(!c)return;
     const value=key==='tags'?el.value.split(',').map(x=>x.trim()).filter(Boolean):
       key==='showStats'?el.checked:['zoom','panX','panY'].includes(key)?Number(el.value):el.value;
     if(key==='artist'){
       const [first='',...last]=value.trim().split(/\s+/);
       const metadata=MNC_CARD_METADATA;
       const legacy=metadata.creditType(c)==='Actor';
       const actor=legacy?{actorCredit:metadata.attribution(c).actor,creditType:'Art'}:{};
       editCardFields(c,{artist:value,artistFirst:first,artistLast:last.join(' '),...actor});
       $('artistFirst').value=c.artistFirst;
       $('artistLast').value=c.artistLast;
       $('gameCreditFields').hidden=false;
     }else if(linkedFields.has(key))editCardFields(c,{[key]:value});
     else c[key]=value;
     if(key==='lore')editCardFields(c,{quote:c.lore});
     if(key==='family'){
       c.parentFamily=c.family==='Critic'?'Member':null;
       if(game.role(c)&&game.isGameCard(c))game.changeRole(c,c.family);
       if(!game.role(c)&&['Game Frame','Game Full Art'].includes(c.template))c.template='Standard';
       if(catalogCard(c))editCardFields(c,{timing:c.timing||''});
     }
     if(key==='template'&&['Game Frame','Game Full Art'].includes(c.template)){
       if(!game.role(c))c.template='Standard';
       else window.MNC_enableGameFrame?.(c);
     }
     persist();
     if(['family','template'].includes(key))refreshStudio();
     else {
       if(key==='title'){setPreviewTitle(c);window.MNC_syncTypeIcon?.(c);}
       window.MNC_updateCatalogCardLabel?.(c);drawStudioPreview();renderCardList();
     }
   });
 }
 $('c_overlayAssetId').onchange=()=>{let c=cardById(currentId);c.overlayAssetId=$('c_overlayAssetId').value;persist();drawStudioPreview()};
 $('c_overlayOpacity').oninput=()=>{let c=cardById(currentId);c.overlayOpacity=+$('c_overlayOpacity').value;persist();drawStudioPreview()};
 $('c_asset').onchange=()=>{let c=cardById(currentId);if(!c)return;setCardArtwork(c,$('c_asset').value);persist();refreshStudio()};
 $('c_accent').oninput=()=>{let c=cardById(currentId);c.accent=$('c_accent').value;persist();drawStudioPreview()};
 for(const k of ['presence','influence','chaos','hp','attack','defense'])$('c_'+k).oninput=e=>{let c=cardById(currentId);c.gameData??={};c.gameData[k]=Number(e.target.value)||0;persist();drawStudioPreview()};
 $('foilCard').onchange=()=>{currentId=$('foilCard').value;populateFoil();renderFoil()};
 for(const k of ['Mode','Mask','Strength','Scale','Angle'])$('foil'+k).addEventListener('input',renderFoil);
 $('foilApply').onclick=()=>{let c=cardById($('foilCard').value);if(!c)return;c.foilRecipe=readFoil();persist();alert('Foil recipe stored with '+c.id+' (artwork itself is unchanged).')};
 $('foilExport').onclick=()=>downloadText(JSON.stringify({cardId:$('foilCard').value,recipe:readFoil()},null,2),'mnc_foil_recipe.json','application/json');
 $('foilPNG').onclick=async()=>{const c=cardById($('foilCard').value);if(!c)return;canvasPNG(await cardCanvas(deep(c),{rounded:true,foil:true,recipe:readFoil()}),slug(c.id)+'_foil_preview.png')};
 $('foilMaskPNG').onclick=()=>{let c=cardById($('foilCard').value);if(!c)return;canvasPNG(makeFoilMask(c,$('foilMask').value),slug(c.id)+'_foil_mask.png')};
 $('addSheet').onclick=()=>{state.sheets.push(newPrintSheet(state.sheets.length+1));persist();renderSheets()};
 $('resetSheets').onclick=()=>{if(!confirm('Replace the print queue with the legacy sample sheets?'))return;const ids=state.cards.filter(c=>!game.isGameCard(c)).slice(0,16).map(c=>c.id);state.sheets=[newPrintSheet(1,ids.slice(0,8)),newPrintSheet(2,ids.slice(8,16))];persist();renderSheets()};
 $('duplexMode').onchange=()=>{state.duplex=$('duplexMode').value;persist()};
 $('backMode').onchange=()=>{state.backMode=$('backMode').value;persist();syncPrintBack()};
 $('bleedOn').onchange=()=>{state.bleed=$('bleedOn').checked;persist()};
 $('includeFinishPreview').onchange=()=>{state.includeFinishPreview=$('includeFinishPreview').checked;persist()};
 $('customBackUpload').onchange=async event=>{
   const input=event.target,file=input.files[0];
   if(!file)return;
   input.disabled=true;
   try{
     state.customBack=await fileToData(file,1800);
     state.backMode='custom';
     persist();syncPrintBack();
     if(activeTab==='production')window.MNC_showBackProof?.();
   }catch(error){alert('Could not load the card back. '+error.message);}
   finally {input.disabled=false;input.value='';}
 };
 $('pdfExport').onclick=exportPDF;
 $('printManifest').onclick=downloadManifest;
 $('exportProject').onclick=()=>downloadText(JSON.stringify(state,null,2),'mnc_creative_suite_backup_'+new Date().toISOString().slice(0,10)+'.json','application/json');
 $('importProject').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const loaded=JSON.parse(await f.text());const next=restoreProject(loaded);if(!confirm('Replace current project with this backup?'))return;state=next;currentId=state.cards.find(inWorkingCatalog)?.id||state.cards[0]?.id;imageCache.clear();window.MNC_clearCatalogImport?.();await window.MNC_DISK?.refreshAssets();persist();refreshAll();alert('Project restored')}catch(err){alert('Cannot import project: '+err.message)}finally{e.target.value=''}};
 $('exportCardsCSV').onclick=()=>{
   const keys=['id','title','family','parentFamily','rarity','rarityGlyph','symbols','sourceAssetId','artist','creditType','conceptCredit','actorCredit',
     'typeIconGlyph','typeIconAsset',
     'lore','edition','set','template','accent','tags','gameType','timing','ruleTitle','ruleText','episode','episodeBadge',
     'picker','film','artistFirst','artistLast','collectorNumber','setGlyph','setGlyphAsset','releaseReady','catalogId',
     'collectionId','collectionCode','classification','catalogStatus','artworkFilename','characterCategory','characterType','characterSubtype',
     'sidekickPartner','quote','notes'];
   const rows=state.cards.map(c=>({...c,creditType:MNC_CARD_METADATA.creditType(c),episodeBadge:c.episodeBadge||'Auto',
     actorCredit:MNC_CARD_METADATA.attribution(c).actor,typeIconGlyph:MNC_CARD_METADATA.customIcon(c),
     collectionCode:MNC_CARD_METADATA.collectionCode(c,collectionFor(c)),
     sidekickPartner:c.characterCategory==='Sidekick'?game.partnerRef(c):'',tags:(c.tags||[]).join('|')}));
   downloadCSV('mnc_cards.csv',keys,rows);
 };
 $('exportAssetsCSV').onclick=()=>{let keys=['id','title','originalFilename','kind','credit','source','reviewStatus','sha256','w','h'];downloadCSV('mnc_assets.csv',keys,state.assets)};
 // Canvas editing handled by the Creative Suite layer editor.
}
function csvEscape(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
function downloadCSV(name,keys,rows){downloadText('\ufeff'+[keys.map(csvEscape).join(','),...rows.map(row=>keys.map(k=>csvEscape(row[k])).join(','))].join('\r\n'),name,'text/csv;charset=utf-8')}
function dataDecodeCanvas(file,limit){return new Promise((resolve,reject)=>{let r=new FileReader();r.onerror=()=>reject(new Error('File unreadable'));r.onload=()=>{const im=new Image();im.onload=()=>{const sf=Math.min(1,limit/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.round(im.width*sf);cv.height=Math.round(im.height*sf);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);resolve(cv.toDataURL('image/webp',.9))};im.onerror=()=>reject(new Error('Unsupported image'));im.src=r.result};r.readAsDataURL(file)})}
async function fileToData(file,limit=1700){if(file.type==='image/gif')return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});return await dataDecodeCanvas(file,limit)}
async function importImages(files) {
  const imported=[];
  for(const file of files){
    if(!file.type.startsWith('image/'))continue;
    try {
      const disk=window.MNC_DISK;
      const stored=disk?.connected&&/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name)
        ? await disk.upload(file,file.name,'art'):null;
      if(stored){
        imported.push(stored.id);
        continue;
      }
      const uri=await fileToData(file);
      const id=uniqueId('ART-',state.assets);
      const image=await imgLoad(uri);
      state.assets.push({id,title:file.name.replace(/\.[^.]+$/,''),file:'',dataURI:uri,originalFilename:file.name,
        kind:file.type==='image/gif'?'Animation':'Imported artwork',credit:'Unverified - assign before release',
        source:'Browser import',reviewStatus:'candidate',accent:'#d6af80',w:image?.width||0,h:image?.height||0});
      imported.push(id);
    }catch(error){alert('Could not import '+file.name+': '+error.message);}
  }
  persist();refreshAll();
  return imported;
}
function renderLibrary() {
  const request=pendingCardDesign;
  $('artworkForDesign').hidden=!request;
  if(request)$('artworkDesignName').textContent='Choose artwork for '+request.name;
  const q=$('assetSearch').value.trim().toLowerCase(),kind=$('assetFilter').value;
  const assets=state.assets.filter(a=>(!q||[a.title,a.originalFilename,a.id].join(' ').toLowerCase().includes(q))&&(!kind||a.kind===kind));
  $('assetCount').textContent=assets.length+' / '+state.assets.length+' sources';
  const empty=$('assetEmpty');
  empty.hidden=assets.length>0;
  empty.textContent=state.assets.length?'No artwork matches the search and type filter.':'Import images or refresh the project artwork to get started.';
  const grid=$('assetGrid');
  grid.replaceChildren();
  for(const asset of assets) {
    const tile=document.createElement('div');
    tile.className='asset-card';
    const thumb=document.createElement('img');
    thumb.className='asset-thumb';
    thumb.loading='lazy';
    thumb.decoding='async';
    const source=assetURI(asset);
    if(source)thumb.src=source;
    thumb.alt=asset.title;
    const info=document.createElement('div');
    info.className='asset-info';
    info.innerHTML=`<div class="asset-title" title="${safe(asset.title)}">${safe(asset.title)}</div><div class="asset-sub">${safe(asset.id)} · ${safe(asset.kind)}<br>${asset.w||'–'}×${asset.h||'–'} · ${safe(asset.credit||'Credit pending')}</div>`;
    const actions=document.createElement('div');
    actions.className='asset-actions';
    const use=document.createElement('button');
    use.textContent='Use on selected card';
    use.onclick=()=>{
      const c=cardById(currentId);
      if(!c){openCardDesigns(asset.id);return;}
      setCardArtwork(c,asset.id);
      persist();tab('studio');
    };
    const create=document.createElement('button');
    create.className='accent-btn';
    create.textContent=request?'Use this artwork':'New card with this art';
    create.setAttribute('aria-label',request?'Use artwork '+asset.title:'New card with this art');
    create.onclick=()=>request?finishCardArtwork(asset.id):openCardDesigns(asset.id);
    actions.append(create);
    if(!request)actions.append(use);
    info.append(actions);tile.append(thumb,info);grid.append(tile);
  }
}
function openCardDesigns(assetId='') {
  tab('visualLanguage',{assetId});
  $('currentDesignsTitle').focus({preventScroll:true});
}

function beginCardArtwork(family,profile,{designId,characterSubtype,assetId}={}){
  if(assetId&&artById(assetId))return createCard(assetId,family,profile,{designId,characterSubtype});
  const design=state.templates.find(item=>designId&&item.id===designId);
  const name=[profile?.type||profile?.category||profile?.name||family,characterSubtype,design?.name].filter(Boolean).join(' · ');
  pendingCardDesign={family,profile,designId,characterSubtype,name};
  $('assetSearch').value=$('assetFilter').value='';
  $('assetScroll').scrollTop=0;
  tab('library');
}

function finishCardArtwork(assetId=''){
  const request=pendingCardDesign;
  if(!request||assetId&&!artById(assetId))return;
  pendingCardDesign=null;
  return createCard(assetId,request.family,request.profile,request);
}

function cardDraft(assetId,family='Character',profile,{designId,characterSubtype}={}) {
  const asset=artById(assetId);
  const gameplay=Object.hasOwn(game.roles,family);
  const card={
    title:asset?.title||'Untitled',
    family, parentFamily:family==='Critic'?'Member':null, rarity:'Unassigned',rarityGlyph:'·',symbols:'',
    sourceAssetId:asset?.id||'',artworkFilename:asset?catalog.filenameFor(asset):'',artist:'',lore:'',sourceRef:asset?'Asset: '+asset.originalFilename:'',
    edition:'2026 Preview',set:game.release,fit:'cover',zoom:1,panX:0,panY:0,
    typeSymbolMode:'standard',collectionSymbolMode:'standard',
    template:family==='Movie'?'Standard':family==='Archive'?'Archive':'Full Art',artworkProfile:'standard',accent:asset?.accent||'#bbac8b',
    titlePosition:[.075,.075],creditPosition:[.07,.958],microPosition:[.93,.958],
    showStats:false,gameData:{},tags:[],foilRecipe:{mode:'None',strength:.45,scale:1,angle:0,mask:'whole'}
  };
  if(gameplay)Object.assign(card,game.newFields(family));
  if(profile)Object.assign(card,{
    characterCategory:profile.category||'',characterType:profile.type||'',roleSubtype:profile.subtype||''
  });
  applyStartingDesign(card,profile?.id,designId);
  if(characterSubtype){card.characterSubtype=characterSubtype;card.subtype=characterSubtype;}
  if(asset?.id===game.ashArt.id){
    for(const field of ['artist','artistFirst','artistLast','sourceRef','episode','picker','fit','zoom','panX','panY'])card[field]=game.ashman[field];
  }
  return card;
}

function openNewCard(card) {
  state.cards.push(card);
  currentId=card.id;
  $('cardSearch').value='';
  $('cardScope').value='all';
  $('rightPane').scrollTop=0;
  persist();
  refreshAll();
  tab('studio');
  window.MNC_editCardSection?.('content');
  $('c_title').focus({preventScroll:true});
  $('c_title').select();
  return card;
}

function createCard(assetId,family='Character',profile,options) {
  const card=cardDraft(assetId,family,profile,options);
  card.id=uniqueId(game.role(card)?'MNC-LX':'MNC-P',state.cards);
  return openNewCard(card);
}

function duplicateCard() {
  const source=cardById(currentId);
  if(!source)return;
  const card=deep(source);
  card.id=uniqueId(game.isGameCard(card)?'MNC-LX':'MNC-P',state.cards);
  card.title=(source.title||'Untitled')+' (copy)';
  if(game.isGameCard(card)||catalogCard(card)||MNC_CARD_METADATA.isPromo(card,collectionFor(card))){
    card.collectorNumber='';
    card.releaseReady=false;
  }
  for(const key of ['catalogId','catalogUnlisted','catalogStatus','collectionId','classification','conceptId','catalogEdits','catalogSource'])delete card[key];
  return openNewCard(card);
}
function refreshAssetsFilter(){let current=$('assetFilter').value;dropDownOptions($('assetFilter'),[['','All artwork types'],...Array.from(new Set(state.assets.map(a=>a.kind))).sort().map(t=>[t,t])],current)}
function renderCardList() {
  const query=$('cardSearch').value.trim().toLowerCase(), scope=$('cardScope').value;
  const list=$('cardList');
  list.replaceChildren();
  for (const c of state.cards) {
    const working=inWorkingCatalog(c);
    if ((scope==='game'&&!working)||(scope==='archive'&&working)) continue;
    const type=game.visualFor(c,state.typeOverrides)?.name||'';
    if (query && ![c.title,c.id,c.catalogId,c.family,c.characterCategory,c.characterType,type].join(' ').toLowerCase().includes(query)) continue;
    const row=document.createElement('button');
    row.type='button';
    row.className='card-tile'+(c.id===currentId?' active':'');
    row.setAttribute('aria-pressed',String(c.id===currentId));
    const asset=artById(c.sourceAssetId);
    const thumb=document.createElement(asset?'img':'span');
    thumb.className='card-thumb';
    if(asset){thumb.src=assetURI(asset)||'';thumb.alt='';thumb.loading='lazy';}
    const labels=document.createElement('span');
    const variant=c.characterCategory==='Creature'?c.characterType:!c.characterCategory?type:'';
    labels.innerHTML=`<b>${safe(c.title)}</b><span>${safe([c.family,c.characterCategory,variant,c.catalogStatus].filter(Boolean).join(' · '))}</span>`;
    row.append(thumb,labels);
    row.onclick=()=>{currentId=c.id;$('rightPane')?.scrollTo(0,0);refreshStudio();};
    list.append(row);
  }
  if(!list.childElementCount)list.textContent='No cards match.';
}
function renderTemplateOptions(selected=$('layoutPresets').value){
 const presets=state.templates.filter(t=>!t.typeDefaultFor).map(t=>[t.id,t.name]);
 const value=presets.some(([id])=>id===selected)?selected:'';
 dropDownOptions($('layoutPresets'),[['',presets.length?'Choose a saved layout':'No saved layouts yet'],...presets],value);
 $('layoutPresets').disabled=!presets.length;
 $('applyTemplate').disabled=!value||!cardById(currentId);
}
function setPreviewTitle(card) {
  const label=$('activeCardTitle');
  label.textContent=card?.title||(card?'Untitled':'No card selected');
  label.title=card?(card.catalogId||card.id)+' · '+label.textContent:'';
}
function refreshStudio(){
  const c=cardById(currentId);
  const pane=$('rightPane'), cardId=c?.id||'';
  const switched=pane.dataset.cardId!==cardId;
  pane.dataset.cardId=cardId;
  if(switched)$('presetStatus').textContent='';
  for(const id of ['cloneCard','saveCardPNG','openCardView','cardEditLayout','cardOpenFoil'])$(id).disabled=!c;
  pane.hidden=$('cardPreview').hidden=!c;
  $('cardPreviewEmpty').hidden=!!c;
  renderCardList();
  setPreviewTitle(c);
  renderTemplateOptions(switched?'':undefined);
  if(!c){
    studioFrame++;
    $('cardPreview').getContext('2d').clearRect(0,0,CW,CH);
    return;
  }
  if(activeTab==='studio'&&savedCardId!==c.id){
    savedCardId=c.id;
    try{localStorage.setItem(cardSelectionKey,savedCardId);}catch{}
  }
  for(const key of ['title','family','rarity','symbols','artist','lore','template','fit','zoom','panX','panY'])$('c_'+key).value=c[key]??'';
  $('c_accent').value=/^#[0-9a-fA-F]{6}$/.test(c.accent)?c.accent:'#c3a470';
  $('c_tags').value=(c.tags||[]).join(', ');
  $('c_showStats').checked=!!c.showStats;
  window.MNC_refreshLayers?.();
  for(const key of ['presence','influence','chaos','hp','attack','defense'])$('c_'+key).value=c.gameData?.[key]??0;
  dropDownOptions($('c_asset'),[['','Choose artwork'],...state.assets.map(a=>[a.id,a.title+' ['+a.id+']'])],c.sourceAssetId||'');
  dropDownOptions($('c_overlayAssetId'),[['','No overlay'],...state.assets.map(a=>[a.id,a.title])],c.overlayAssetId||'');
  $('c_overlayOpacity').value=c.overlayOpacity??.8;
  drawStudioPreview();
}
function refreshFoilCardOptions(){dropDownOptions($('foilCard'),state.cards.map(c=>[c.id,c.title+' ['+c.id+']']),currentId);populateFoil()}
function readFoil(){return {mode:$('foilMode').value,mask:$('foilMask').value,strength:+$('foilStrength').value,scale:+$('foilScale').value,angle:+$('foilAngle').value,textureAssetId:cardById($('foilCard').value)?.foilRecipe?.textureAssetId||''}}
function populateFoil(){let c=cardById($('foilCard').value);let r=c?.foilRecipe||{};$('foilMode').value=r.mode||'None';$('foilMask').value=r.mask||'whole';$('foilStrength').value=r.strength??.45;$('foilScale').value=r.scale??1;$('foilAngle').value=r.angle??0}
function renderSummary(){window.MNC_showCatalogStatus?.();let p=state;$('projectSummary').innerHTML=`<div><b>${p.assets.length}</b><small>Images / GIFs</small></div><div><b>${p.cards.length}</b><small>Card designs</small></div><div><b>${p.sheets.reduce((n,s)=>n+s.slots.filter(id=>cardById(id)).length,0)}</b><small>Queued print slots</small></div>`}
function refreshAll(){refreshAssetsFilter();renderLibrary();refreshStudio();refreshFoilCardOptions();renderFoil();renderSheets();renderSummary();if(activeTab==='backs')window.MNC_refreshBackDesigner?.();if(activeTab==='layoutDesigner')window.MNC_refreshLayoutDesigner?.();if(activeTab==='visualLanguage')window.MNC_refreshDesigns?.();}
/* Shared canvas rendering for the designers, labs, and exports. */
function cardCutRadius(c){
 const radius=Number(c.cutRadius??38);
 return Number.isFinite(radius)?clamp(radius,0,80):38;
}
function baseImgBox(c){
 if(game.isGameCard(c)&&window.MNC_artBox)return window.MNC_artBox(c);
 if(c.template==='Standard'&&window.MNC_standardArtBox)return window.MNC_standardArtBox(c);
 switch(c.template){
   case 'Archive':return {x:48,y:176,w:654,h:704};
   case 'Minimal':return {x:17,y:106,w:716,h:825};
   default:return {x:0,y:0,w:CW,h:CH};
 }
}
function imgBox(c) {
 return MNC_LAYOUT.geometry(c,'art',baseImgBox(c));
}
function frontArtworkPath(c) {
 if(MNC_LAYOUT.hidden(c,'art'))return new Path2D();
 const rect=imgBox(c);
 if(game.isGameCard(c)&&window.MNC_gameArtworkPath)return window.MNC_gameArtworkPath(c,rect);
 if(c.template==='Standard'&&window.MNC_standardArtworkPath)return window.MNC_standardArtworkPath(c,rect);
 const path=new Path2D();
 path.rect(rect.x,rect.y,rect.w,rect.h);
 return path;
}
function imagePlacement(width,height,rect,fit,zoom=1,panX=0,panY=0) {
 const {x,y,w,h}=rect;
 const scale=(fit==='contain'?Math.min(w/width,h/height):Math.max(w/width,h/height))*zoom;
 const dw=width*scale,dh=height*scale;
 return {x:x+(w-dw)/2+panX*Math.max(0,(dw-w)/2),y:y+(h-dh)/2+panY*Math.max(0,(dh-h)/2),w:dw,h:dh};
}
function fitImage(ctx,im,rect,fit,zoom=1,px=0,py=0) {
 const destination=imagePlacement(im.width,im.height,rect,fit,zoom,px,py);
 ctx.save();
 ctx.beginPath();
 ctx.rect(rect.x,rect.y,rect.w,rect.h);
 ctx.clip();
 ctx.drawImage(im,destination.x,destination.y,destination.w,destination.h);
 ctx.restore();
}
function textWithOutline(ctx,txt,x,y,style={}){ctx.save();ctx.textBaseline='alphabetic';ctx.textAlign=style.align||'left';ctx.fillStyle=style.color||'#ffffff';ctx.strokeStyle=style.stroke||'#11131b';ctx.lineWidth=style.line??5;ctx.lineJoin='round';ctx.font=style.font||'700 42px system-ui';ctx.shadowColor='rgba(0,0,0,.72)';ctx.shadowBlur=5;ctx.strokeText(txt,x,y);ctx.fillText(txt,x,y);ctx.restore()}
function fittedText(ctx,txt,limit,size=46){let fontSize=size;ctx.font=`800 ${fontSize}px system-ui`;while(ctx.measureText(txt).width>limit&&fontSize>19){fontSize-=1;ctx.font=`800 ${fontSize}px system-ui`}return fontSize}
function drawGradientBand(ctx,x,y,w,h,topFirst=false){let g=ctx.createLinearGradient(0,y,0,y+h);if(topFirst){g.addColorStop(0,'rgba(9,13,24,.82)');g.addColorStop(1,'rgba(9,13,24,0)')}else{g.addColorStop(0,'rgba(9,13,24,0)');g.addColorStop(1,'rgba(9,13,24,.94)')}ctx.fillStyle=g;ctx.fillRect(x,y,w,h)}
function lineText(ctx,txt,x,y,maxWidth=620,lineHeight=27,size=22,color='#e9e5de',maxLines=2){let words=String(txt||'').split(/\s+/),lines=[],line='';ctx.font=`500 ${size}px system-ui`;for(let word of words){if(!word)continue;let test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='alphabetic';lines.slice(0,maxLines).forEach((l,i)=>ctx.fillText(l.slice(0,90),x,y+i*lineHeight))}
async function cardCanvas(c,{w=CW,h=CH,...options}={}){
 const cv=document.createElement('canvas');
 cv.width=w;cv.height=h;
 await drawCard(c,cv,options);
 return cv;
}

async function drawCard(c,cv,{foil=false,recipe=null,rounded=false,onLayout,onLayer,captureText=true,includeImprint=true}={}){
 if(!c)return;
 const ctx=cv.getContext('2d');
 ctx.save();
 try{
   ctx.setTransform(cv.width/CW,0,0,cv.height/CH,0,0);
   ctx.clearRect(0,0,CW,CH);
   if(rounded){
     const cut=new Path2D();
     cut.roundRect(0,0,CW,CH,cardCutRadius(c));
     ctx.clip(cut);
   }
   const scene=cardScene(ctx,c,{foil,recipe,includeImprint});
   if(onLayout)onLayout(scene.inspect());
   await scene.render(onLayer,{captureText});
 }finally{ctx.restore();}
}

function cardScene(ctx,c,options){
 const scene=MNC_LAYOUT.scene(ctx,c);
 if(game.isGameCard(c)&&window.MNC_addGameLayers)window.MNC_addGameLayers(scene,ctx,c,options);
 else if(c.template==='Standard'&&window.MNC_addContentLayers)window.MNC_addStandardLayers(scene,ctx,c,options);
 else addLegacyLayers(scene,ctx,c,options);
 window.MNC_addExtraLayers?.(scene,c);
 if(options.includeImprint!==false&&c.foilImprintAssetId){
   const source=assetURI(artById(c.foilImprintAssetId));
   scene.add('foilImprint',MNC_LAYOUT.full(),async ctx=>{
     const image=await imgLoad(source);
     if(image)ctx.drawImage(image,0,0,CW,CH);
   },{empty:!source,hit:'none'});
 }
 return scene;
}

function addFoilLayer(scene,c,recipe){
 scene.add('foil',MNC_LAYOUT.full(),async ctx=>{
   const finish=recipe||c.foilRecipe||{}, rect=imgBox(c);
   const draw=async(target,style)=>{
     drawFoil(target,c,style,rect);
     await window.MNC_foilTexture?.(target,c,style,rect);
   };
   const whole={...finish,mask:'whole'};
   if(MNC_ART_CUTOUT.visible(c)&&['art','reverse'].includes(finish.mask)){
     const {width,height}=ctx.canvas;
     const overlay=MNC_FRONT_EFFECTS.canvas(width,height),paint=overlay.getContext('2d');
     const mask=MNC_FRONT_EFFECTS.canvas(width,height),stencil=mask.getContext('2d');
     MNC_FRONT_EFFECTS.copyTransform(paint,ctx);
     MNC_FRONT_EFFECTS.copyTransform(stencil,ctx);
     await draw(paint,whole);
     if(finish.mask==='reverse'){
       stencil.fillRect(0,0,CW,CH);
       stencil.globalCompositeOperation='destination-out';
     }
     fillArtworkRegion(stencil,c);
     paint.setTransform(1,0,0,1,0,0);
     paint.globalCompositeOperation='destination-in';
     paint.drawImage(mask,0,0);
     ctx.setTransform(1,0,0,1,0,0);
     ctx.globalCompositeOperation='screen';
     ctx.drawImage(overlay,0,0);
   }else if(usesArtworkPath(c)){
     clipArtwork(ctx,frontArtworkPath(c),finish.mask);
     await draw(ctx,whole);
   }else await draw(ctx,finish);
 },{internal:true});
}

function addLegacyLayers(scene,ctx,c,{foil,recipe}={}){
 const layout=MNC_LAYOUT, accent=c.accent||'#c2aa80';
 const archive=c.template==='Archive',minimal=c.template==='Minimal';
 const full=c.template==='Full Art'||c.template==='Glitch';
 scene.add('background',layout.full(),ctx=>{
   layout.background(ctx,c,archive?'#ddd5c8':minimal?'#e9e2d5':'#161a24');
   if(archive){
     ctx.fillStyle='#252836';ctx.fillRect(0,0,CW,142);
     ctx.fillStyle='#aaa28e';ctx.fillRect(26,150,698,763);
   }
   if(minimal){ctx.fillStyle=accent;ctx.fillRect(0,0,CW,96);}
 });
 scene.add('art',baseImgBox(c),async (ctx,rect)=>{
   const image=MNC_ARTWORK.image(c,await imgLoad(assetURI(artById(c.sourceAssetId))));
   if(!image){
     ctx.fillStyle='#34394a';ctx.fillRect(rect.x,rect.y,rect.w,rect.h);
     ctx.font='26px system-ui';ctx.fillStyle='#ddd';ctx.fillText('ARTWORK MISSING',rect.x+64,rect.y+rect.h/2);
     return;
   }
   if(c.fit==='contain'){ctx.fillStyle=accent;ctx.fillRect(rect.x,rect.y,rect.w,rect.h);}
   fitImage(ctx,image,rect,c.fit||'cover',Number(c.zoom)||1,Number(c.panX)||0,Number(c.panY)||0);
 },{adjustBox:true});
 MNC_ART_CUTOUT.addLayer(scene,c);
 MNC_OUTER_BORDER.addLayer(scene,c);
 layout.addOverlay(scene,c);
 if(foil)addFoilLayer(scene,c,recipe);
 if(full)scene.add('shade',layout.full(),ctx=>{
   drawGradientBand(ctx,0,0,CW,250,true);drawGradientBand(ctx,0,CH-250,CW,250);
 },{hit:'none'});
 else scene.add('footerPanel',{x:0,y:CH-145,w:CW,h:145},ctx=>{
   ctx.fillStyle=archive?'#272633':'#151b26';ctx.fillRect(0,CH-145,CW,145);
 });
 const tp=c.titlePosition||[.075,.075],cp=c.creditPosition||[.07,.958],mp=c.microPosition||[.93,.958];
 const value=String(c.title||'Untitled').toUpperCase(), corner=front.typeIconBox(c);
 const x=CW*tp[0], y=CH*tp[1], width=corner.w?Math.max(65,Math.min(625,corner.x-x-15)):625;
 const base={size:fittedText(ctx,value,width,44),weight:800,family:'system-ui',color:'#ffffff',width};
 const style=front.style(c,'title',base), delta=front.textOffset(c,'title');
 scene.add('title',layout.textBox(ctx,c,'title',value,x,y,base),async ctx=>{
   const fontId=front.effective(c).text?.title?.font?'system':c.fontId;
   const custom=await window.MNC_drawFontLine?.(ctx,value,x+delta.x,y+delta.y,style.size,
     {fontId,variation:c.glyphVariantMode||'seeded',seed:c.glyphSeed||1,maxWidth:width,align:style.align||'left',color:style.color});
   if(custom)return;
   if(c.template==='Glitch'&&!front.effective(c).text?.title){
     if(typeof window.MNC_drawGlyphTitle==='function'&&c.useHandGlyphs)await window.MNC_drawGlyphTitle(ctx,c,value,x,y,style.size);
     else drawGlitchTitle(ctx,value,x,y,style.size,c.id);
   }else textWithOutline(ctx,value,x+delta.x,y+delta.y,{...style,line:full?5:3});
 },{text:{key:'title',value,size:base.size,color:base.color}});
 layout.addIcon(scene,c,'#ffffff');
 if(c.family==='Character')front.addHeader(scene,ctx,c,{x:56,y:133,ink:'#ffffff'});
 else layout.textLayer(scene,ctx,c,'family',c.family==='Critic'?'CRITIC · MEMBER':String(c.family||'Archive').toUpperCase(),56,126,
   {size:22,weight:700,color:'#ffffff',family:'system-ui',width:610});

 const credit={x:CW*cp[0],y:CH*cp[1],ink:'#ffffff',outline:true};
 if(window.MNC_addContentLayers)window.MNC_addContentLayers(scene,ctx,c,legacyCopyLayout(ctx,c),{ink:'#ffffff',quiet:'#f8f5e9'},{shadow:true});
 scene.add('symbols',{x:455,y:CH-157,w:240,h:34},ctx=>{
   ctx.textAlign='right';ctx.fillStyle='#fff';ctx.shadowBlur=7;ctx.shadowColor='#111';
   ctx.font='26px sans-serif';ctx.fillText(String(c.symbols).slice(0,30),CW-55,CH-132);
 },{empty:!c.symbols});
 layout.addCredits(scene,c,credit);
 const top=front.attributionBox(c,credit).y-8;
 scene.add('footerLine',{x:46,y:top-3,w:658,h:6},ctx=>{
   ctx.strokeStyle='#ffffff70';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(46,top);ctx.lineTo(704,top);ctx.stroke();
 },{empty:front.values(c).footerRule===false});
 front.addCollection(scene,ctx,c,{x:CW*mp[0],y:CH*mp[1],ink:'#ffffff',outline:true});
 layout.addEpisodeBadge(scene,c,'#eedcb9');
 if(c.showStats){
  const paintStats=(ctx,textOnly)=>{
   const stats=c.gameData||{};
   ctx.globalAlpha=.89;
   if(!textOnly){ctx.fillStyle='#111928';ctx.fillRect(28,CH-232,460,38);}
   ctx.fillStyle='#fff';ctx.font='600 17px monospace';ctx.fillText(
     'P'+(stats.presence||0)+'  I'+(stats.influence||0)+'  C'+(stats.chaos||0)+'  H'+(stats.hp||0)+'  A'+(stats.attack||0)+'  D'+(stats.defense||0),38,CH-208);
  };
  scene.add('stats',{x:28,y:CH-232,w:460,h:38},ctx=>paintStats(ctx,false),{foilText:ctx=>paintStats(ctx,true)});
 }
}

function legacyCopyLayout(ctx,c) {
 const colors={ink:'#fff',quiet:'#f8f5e9'},credit=c.creditPosition||[.07,.958];
 const footerTop=front.attributionBox(c,{x:750*credit[0],y:1050*credit[1]}).y-18;
 const measure=window.MNC_contentLayout(ctx,c,0,colors,{x:55,width:632,footerTop:10000});
 const height=Math.max(0,...[measure.typeRuleBox,measure.ruleBox,measure.quoteBox].filter(box=>box.h).map(box=>box.y+box.h));
 return window.MNC_contentLayout(ctx,c,Math.max(180,Math.min(913,footerTop-height)),colors,{x:55,width:632,footerTop});
}
window.MNC_legacyCopyLayout=legacyCopyLayout;
function strhash(s){let n=2166136261;for(let ch of String(s)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0}
function drawGlitchTitle(ctx,str,x,y,fs,id){let seed=strhash(id);ctx.save();ctx.font=`900 ${fs}px system-ui`;ctx.textBaseline='alphabetic';ctx.textAlign='left';let dx=x;for(let i=0;i<str.length;i++){seed=(seed*1664525+1013904223)>>>0;let jitter=(seed%7)-3;const ch=str[i];ctx.fillStyle=i%7===0?'#f6df9e':'#fff';ctx.strokeStyle='#16151b';ctx.lineWidth=3;ctx.strokeText(ch,dx,y+jitter);ctx.fillText(ch,dx,y+jitter);dx+=ctx.measureText(ch).width+(seed%3)-1;if(dx>700)break}ctx.restore()}
function drawFoil(ctx,c,r,rect){let mode=r.mode||'None';if(mode==='None')return;const power=clamp(Number(r.strength??.45),0,1),scale=clamp(+r.scale||1,.2,3),angle=+r.angle||0,mask=r.mask||'whole';ctx.save();
 if(mask==='art'){ctx.beginPath();ctx.rect(rect.x,rect.y,rect.w,rect.h);ctx.clip()}
 if(mask==='reverse'){ctx.beginPath();ctx.rect(0,0,CW,CH);ctx.rect(rect.x+24,rect.y+30,rect.w-48,Math.max(1,rect.h-205));ctx.clip('evenodd')}
 ctx.globalCompositeOperation='screen';ctx.globalAlpha=.08+.26*power;ctx.translate(CW/2,CH/2);ctx.rotate(angle*Math.PI/180);ctx.translate(-CW/2,-CH/2);
 let seed=strhash(c.id+'foil');
 if(mode==='Prism'||mode==='Aurora'){for(let i=-24;i<60;i++){const x=i*(15+12/scale),g=ctx.createLinearGradient(x,0,x+60/scale,0);for(let s=0;s<=5;s++){let hue=(i*29+s*65+(mode==='Aurora'?110:0)+angle/2)%360;g.addColorStop(s/5,`hsla(${hue},94%,64%,${mode==='Aurora'?.7:.9})`)}ctx.fillStyle=g;ctx.fillRect(x,-500,32/scale,2000)}}
 if(mode==='Fractal'){for(let i=0;i<250;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;let t=i*.12*scale,a=t+angle*Math.PI/180,radius=4*Math.pow(i,.79)*scale,x=CW/2+Math.cos(a)*radius,y=CH/2+Math.sin(a*1.31)*radius;ctx.fillStyle=`hsla(${(i*8+angle)%360},95%,70%,.8)`;ctx.beginPath();ctx.arc(x,y,Math.max(1,20*scale/(1+i/22)),0,Math.PI*2);ctx.fill()}}
 if(mode==='Static'){for(let i=0;i<1900;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;let x=seed%CW;seed=(Math.imul(seed,1664525)+1013904223)>>>0;let y=seed%CH;ctx.fillStyle=`hsl(${seed%360},95%,65%)`;ctx.fillRect(x,y,2+seed%4,1+seed%3)}}
 ctx.restore()}
function usesArtworkPath(c){
 return game.isGameCard(c)||c.template==='Standard'||!!MNC_LAYOUT.get(c,'art')||MNC_ART_CUTOUT.visible(c);
}

function fillArtworkRegion(ctx,c){
 ctx.fill(frontArtworkPath(c),'evenodd');
 MNC_ART_CUTOUT.fill(ctx,c);
}

function makeFoilMask(c,mask){
 const cv=document.createElement('canvas');
 cv.width=CW;cv.height=CH;
 const ctx=cv.getContext('2d'),reverse=mask==='reverse';
 ctx.fillStyle=mask==='whole'||reverse?'#fff':'#000';
 ctx.fillRect(0,0,CW,CH);
 if(mask==='art'||reverse){
   ctx.fillStyle=reverse?'#000':'#fff';
   if(reverse&&!usesArtworkPath(c)){
     const r=imgBox(c);
     ctx.fillRect(r.x+24,r.y+30,r.w-48,Math.max(1,r.h-205));
   }else fillArtworkRegion(ctx,c);
 }
 return cv;
}
function clipArtwork(ctx,path,mask){
 if(mask==='art')ctx.clip(path,'evenodd');
 if(mask==='reverse'){
   const reverse=new Path2D(path);
   reverse.rect(0,0,CW,CH);
   ctx.clip(reverse,'evenodd');
 }
}
async function backCanvas(regNumber=null,project=state){
 const design=project.backMode==='designed'?backs.active(project):null;
 if(design)return window.MNC_renderBackDesign(design,project);
 let cv=document.createElement('canvas');cv.width=CW;cv.height=CH;let ctx=cv.getContext('2d');ctx.fillStyle='#171a2b';ctx.fillRect(0,0,CW,CH);ctx.save();let bg=ctx.createLinearGradient(0,0,CW,CH);bg.addColorStop(0,'#202f43');bg.addColorStop(.52,'#1c2134');bg.addColorStop(1,'#151727');ctx.fillStyle=bg;ctx.fillRect(0,0,CW,CH);for(let i=0;i<24;i++){ctx.lineWidth=2;ctx.strokeStyle='rgba(201,178,127,.08)';ctx.beginPath();ctx.ellipse(375,525,145+i*26,185+i*26,0,0,2*Math.PI);ctx.stroke()}
 ctx.strokeStyle='#d9b77c';ctx.lineWidth=12;ctx.strokeRect(27,27,CW-54,CH-54);ctx.lineWidth=2;ctx.strokeStyle='#9d9d8e';ctx.strokeRect(45,45,CW-90,CH-90);
 const logo=project.assets.find(a=>a.originalFilename==='movie_night_club_logo_july_2023_square.png');
 let custom=project.backMode==='custom'&&project.customBack?await imgLoad(project.customBack):null;
 if(custom){fitImage(ctx,custom,{x:50,y:50,w:650,h:950},'cover',1,0,0)}else{let im=await imgLoad(assetURI(logo));if(im){ctx.fillStyle='#f7f5ec';ctx.fillRect(170,287,410,410);fitImage(ctx,im,{x:180,y:297,w:390,h:390},'contain',1,0,0)}ctx.textAlign='center';ctx.fillStyle='#efd39a';ctx.font='bold 33px system-ui';ctx.fillText('MOVIE NIGHT CLUB',CW/2,780);ctx.font='bold 18px system-ui';ctx.fillText('COLLECT · PLAY · ARCHIVE',CW/2,822)}
 if(regNumber!=null){ctx.fillStyle='#fff';ctx.strokeStyle='#000';ctx.lineWidth=8;ctx.font='bold 150px monospace';ctx.textAlign='center';ctx.strokeText(String(regNumber),CW/2,210);ctx.fillText(String(regNumber),CW/2,210)}ctx.restore();return cv}
let studioFrame=0,foilFrame=0;
async function drawStudioPreview(){
  const c=cardById(currentId);
  if(!c)return;
  const frame=++studioFrame;
  try {
    const cv=await cardCanvas(deep(c),{rounded:true});
    if(frame!==studioFrame)return;
    const preview=$('cardPreview');
    const ctx=preview.getContext('2d');
    ctx.clearRect(0,0,CW,CH);
    ctx.drawImage(cv,0,0);
    if(window.MNC_drawSelection)window.MNC_drawSelection(preview,c);
    window.MNC_drawFrontGuides?.(preview,c);
  }catch(error){console.error(error);}
}
async function renderFoil(){
  const c=cardById($('foilCard').value);
  if(!c)return;
  const frame=++foilFrame;
  try {
    const cv=await cardCanvas(deep(c),{foil:true,recipe:readFoil()});
    if(frame===foilFrame)$('foilCanvas').getContext('2d').drawImage(cv,0,0);
  }catch(error){console.error(error);}
}
function installDrag(){let cv=$('cardPreview'),drag=null;cv.addEventListener('pointerdown',e=>{let c=cardById(currentId);if(!c)return;let r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;let which=y<.18?'title':y>.91?(x>.55?'micro':'credit'):null;if(!which)return;drag=which;cv.setPointerCapture(e.pointerId)});cv.addEventListener('pointermove',e=>{if(!drag)return;let c=cardById(currentId),r=cv.getBoundingClientRect(),x=clamp((e.clientX-r.left)/r.width,.025,.975),y=clamp((e.clientY-r.top)/r.height,.03,.98);c[drag==='title'?'titlePosition':drag==='credit'?'creditPosition':'microPosition']=[x,y];drawStudioPreview()});cv.addEventListener('pointerup',()=>{if(drag)persist();drag=null});cv.addEventListener('pointercancel',()=>{drag=null})}
/* Staples: editable eight-up queue, duplex pairing and direct self-contained PDF writer. */
function renderSheets() {
  const wrap=$('sheetQueue');
  wrap.replaceChildren();
  const options=[['','Empty slot'],...state.cards.map(c=>[c.id,c.title+' · '+c.family])];
  for (const [i,sheet] of state.sheets.entries()) {
    const entry=document.createElement('details');
    entry.className='sheet-entry';
    entry.open=i===Number($('proofSheet').value||0);
    const header=document.createElement('summary');
    header.textContent='Sheet '+String(i+1).padStart(2,'0')+' · '+sheet.slots.filter(id=>cardById(id)).length+' / 8 filled';
    entry.append(header);
    const actions=document.createElement('div');
    actions.className='buttonbar sheet-actions';
    const makeButton=(label,action)=>{
      const btn=document.createElement('button');
      btn.textContent=label;btn.onclick=action;actions.append(btn);
    };
    makeButton('Preview',()=>window.MNC_chooseProofSheet(i));
    makeButton('Duplicate',()=>{
      state.sheets.splice(i+1,0,deep(sheet));persist();renderSheets();window.MNC_chooseProofSheet(i+1);
    });
    makeButton('Remove',()=>{state.sheets.splice(i,1);persist();renderSheets();});
    const finish=document.createElement('select');
    finish.setAttribute('aria-label','Sheet '+(i+1)+' finish');
    dropDownOptions(finish,['Standard','Reverse Holo','Art Holo','Prism','Crazy Holo'].map(v=>[v,v]),sheet.finish);
    finish.onchange=()=>{sheet.finish=finish.value;persist();window.MNC_renderProof();};
    actions.append(finish);entry.append(actions);
    const slots=document.createElement('div');
    slots.className='sheet-slots';
    for(let j=0;j<8;j++){
      const label=document.createElement('label');
      label.className='label sheet-slot';
      label.textContent='Slot '+(j+1);
      const select=document.createElement('select');
      dropDownOptions(select,options,cardById(sheet.slots[j])?sheet.slots[j]:'');
      select.onchange=()=>{
        sheet.slots[j]=select.value;
        header.textContent='Sheet '+String(i+1).padStart(2,'0')+' · '+sheet.slots.filter(id=>cardById(id)).length+' / 8 filled';
        persist();window.MNC_chooseProofSheet(i,false);
      };
      label.append(select);slots.append(label);
    }
    entry.append(slots);wrap.append(entry);
  }
  if(!state.sheets.length)wrap.textContent='Add a sheet to start the queue.';
  const count=state.sheets.reduce((total,sheet)=>total+sheet.slots.filter(id=>cardById(id)).length,0);
  $('sheetsSummary').textContent=`${state.sheets.length} sheets · ${count} cards · ${state.sheets.length*2} PDF pages`;
  $('duplexMode').value=state.duplex||'same';
  syncPrintBack();
  $('includeFinishPreview').checked=!!state.includeFinishPreview;
  $('bleedOn').checked=state.bleed!==false;
  $('backOffsetX').value=state.backOffsetX||0;
  $('backOffsetY').value=state.backOffsetY||0;
  $('pdfExport').disabled=!count;
  window.MNC_updateProof?.();
}
function syncPrintBack() {
  const active=backs.active(state);
  const option=$('backDesignedOption');
  option.hidden=option.disabled=!active;
  option.textContent=active?'Designed back · '+backs.name(active):'Designed back';
  $('backMode').value=state.backMode||'mnc';
}
function downloadManifest() {
  const keys=['sheet','pdf_front_page','pdf_back_page','front_row','front_column','slot','card_id','catalog_card_id','collection_id','set_card_number','card_title','asset_id','source_filename','finish','back_mode','duplex_mapping','back_x_mm','back_y_mm','back_design'];
  const design=state.backMode==='designed'?backs.active(state):null;
  const records=state.sheets.flatMap((sheet,i)=>sheet.slots.map((id,j)=>{
    const c=cardById(id),a=artById(c?.sourceAssetId);
    return {sheet:i+1,pdf_front_page:2*i+1,pdf_back_page:2*i+2,front_row:Math.floor(j/4)+1,front_column:j%4+1,slot:j+1,card_id:c?.id||'',catalog_card_id:c?.catalogId||'',collection_id:c?.collectionId||'',set_card_number:c?.collectorNumber||'',card_title:c?.title||'',
      asset_id:a?.id||'',source_filename:a?.originalFilename||'',finish:sheet.finish,back_mode:state.backMode,duplex_mapping:state.duplex,back_x_mm:state.backOffsetX,back_y_mm:state.backOffsetY,
      back_design:design?backs.name(design):''};
  }));
  downloadCSV('MNC_Print_Sheets_Manifest.csv',keys,records);
}
function indexOnBack(j,mode){let row=Math.floor(j/4),col=j%4;if(mode==='mirrorColumns')return row*4+(3-col);if(mode==='mirrorRows')return (1-row)*4+col;if(mode==='rotate')return (1-row)*4+(3-col);return j}
const bytes=s=>new TextEncoder().encode(s);
function fromB64(str){const raw=atob(str),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return u}
function concat(chunks){let len=chunks.reduce((s,a)=>s+a.length,0),res=new Uint8Array(len),off=0;for(let a of chunks){res.set(a,off);off+=a.length}return res}
class OfflinePDF{
 constructor(){this.objs=[null]}
 reserve(){this.objs.push(null);return this.objs.length-1}
 put(id,u){this.objs[id]=typeof u==='string'?bytes(u):u}
 obj(u){let i=this.reserve();this.put(i,u);return i}
 stream(dict,data){data=typeof data==='string'?bytes(data):data;return this.obj(concat([bytes(dict.replace('%LENGTH%',String(data.length))+'\nstream\n'),data,bytes('\nendstream')]))}
 imageFromCanvas(cv){let b64=cv.toDataURL('image/jpeg',.90).split(',')[1];let data=fromB64(b64);return this.stream(`<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %LENGTH% >>`,data)}
 finish(root){let chunks=[new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10])],off=chunks[0].length,positions=[0];for(let i=1;i<this.objs.length;i++){positions[i]=off;let part=concat([bytes(`${i} 0 obj\n`),this.objs[i]||bytes('<< >>'),bytes('\nendobj\n')]);chunks.push(part);off+=part.length}let xref=off;let tail=`xref\n0 ${this.objs.length}\n0000000000 65535 f \n`;for(let i=1;i<this.objs.length;i++)tail+=`${String(positions[i]).padStart(10,'0')} 00000 n \n`;tail+=`trailer\n<< /Size ${this.objs.length} /Root ${root} 0 R >>\nstartxref\n${xref}\n%%EOF`;chunks.push(bytes(tail));return new Blob([concat(chunks)],{type:'application/pdf'})}
}
function pdfEscape(s){return ascii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
const SHEET_W=792, SHEET_H=612;
function sheetSlot(index,back,project=state) {
  const mm=72/25.4;
  const x=(.29+index%4*2.64)*72+(back?Number(project.backOffsetX||0)*mm:0);
  const top=(.59+Math.floor(index/4)*3.82)*72+(back?Number(project.backOffsetY||0)*mm:0);
  return {x,top,w:180,h:252,bleed:project.bleed===false?0:.04*72};
}
function trimTicks({x,top,w,h}) {
  return [0,w].flatMap(dx=>[0,h].flatMap(dy=>{
    const left=dx===0?-1:1,up=dy===0?-1:1,gx=x+dx,gy=top+dy;
    return [[gx+left*3.5,gy,gx+left*7,gy],[gx,gy+up*3.5,gx,gy+up*7]];
  }));
}
function sheetHeading(number,back,finish) {
  return `MNC | SHEET ${String(number).padStart(2,'0')} | ${back?'BACK':'FRONT'} | ${finish.toUpperCase()} | LETTER LANDSCAPE`;
}
function sheetFootnote(back) {
  return '2.5 x 3.5 IN CUT | SCALE 100% | '+(back?'CHECK DUPLEX REGISTRATION':'KEEP FRONT/BACK TOGETHER');
}
function finishOptions(sheet,c,project=state) {
  const foil=project.includeFinishPreview&&sheet.finish!=='Standard';
  const recipe=foil?{...(c.foilRecipe||{}),mode:sheet.finish==='Prism'?'Prism':sheet.finish==='Crazy Holo'?'Fractal':'Aurora',
    mask:sheet.finish==='Reverse Holo'?'reverse':sheet.finish==='Art Holo'?'art':'whole'}:null;
  return {foil,recipe};
}
function printPageCommands(sheet,back,refs,number,project) {
  const cmd=['q 1 1 1 rg 0 0 792 612 re f Q'];
  const color=back?'0.56 0.26 0.16':'0.12 0.31 0.46';
  cmd.push(`BT /F1 9 Tf ${color} rg 27 588 Td (${pdfEscape(sheetHeading(number,back,sheet.finish))}) Tj ET`);
  cmd.push(`BT /F1 8 Tf ${color} rg 27 19 Td (${pdfEscape(sheetFootnote(back))}) Tj ET`);
  for(const [index,ref] of refs.entries()){
    if(!ref)continue;
    const r=sheetSlot(index,back,project),y=SHEET_H-r.top-r.h;
    const place=(x,y,w,h)=>`q ${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /I${index} Do Q`;
    if(r.bleed)cmd.push(place(r.x-r.bleed,y-r.bleed,r.w+2*r.bleed,r.h+2*r.bleed));
    cmd.push(place(r.x,y,r.w,r.h));
    for(const [x0,y0,x1,y1] of trimTicks(r)){
      cmd.push(`q .19 .24 .30 RG .32 w ${x0.toFixed(3)} ${(SHEET_H-y0).toFixed(3)} m ${x1.toFixed(3)} ${(SHEET_H-y1).toFixed(3)} l S Q`);
    }
  }
  return cmd.join('\n')+'\n';
}

async function exportPDF(){
  const button=$('pdfExport');
  if(!state.sheets.some(sheet=>sheet.slots.some(id=>cardById(id))))return;
  const project={...state,sheets:deep(state.sheets),cards:deep(state.cards),assets:[...state.assets],backDesigns:deep(state.backDesigns)};
  const cardsById=new Map(project.cards.map(card=>[card.id,card]));
  button.disabled=true;button.textContent='Preparing PDF…';
  try {
    const pdf=new OfflinePDF(),catalog=pdf.reserve(),pagesRoot=pdf.reserve();
    const font=pdf.obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const pageIds=[],frontCache=new Map(),backCache=new Map();
    for(const [index,sheet] of project.sheets.entries()){
      const cards=sheet.slots.map(id=>cardsById.get(id));
      for (const back of [false,true]) {
        const refs=[];
        for(let j=0;j<8;j++){
          const source=back?indexOnBack(j,project.duplex):j;
          const c=cards[source];
          if(!c){refs.push(null);continue;}
          const reg=project.backMode==='calibration'?source+1:null;
          const cache=back?backCache:frontCache;
          const key=back?reg:c.id+'|'+(project.includeFinishPreview?sheet.finish:'Standard');
          if(!cache.has(key)){
            const canvas=back?await backCanvas(reg,project):await cardCanvas(c,finishOptions(sheet,c,project));
            cache.set(key,pdf.imageFromCanvas(canvas));
          }
          refs.push(cache.get(key));
        }
        const content=pdf.stream('<< /Length %LENGTH% >>',printPageCommands(sheet,back,refs,index+1,project));
        const images=refs.map((ref,j)=>ref?`/I${j} ${ref} 0 R`:'').join(' ');
        const page=pdf.obj(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${SHEET_W} ${SHEET_H}] /Resources << /Font << /F1 ${font} 0 R >> /XObject << ${images} >> >> /Contents ${content} 0 R >>`);
        pageIds.push(page);
      }
      button.textContent='Rendering sheet '+(index+1)+' / '+project.sheets.length+'…';
    }
    pdf.put(pagesRoot,`<< /Type /Pages /Kids [ ${pageIds.map(id=>id+' 0 R').join(' ')} ] /Count ${pageIds.length} >>`);
    pdf.put(catalog,`<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`);
    dl(pdf.finish(catalog),'MNC_8up_Duplex_'+project.sheets.length+'_Sheets.pdf');
  } catch(error) {
    console.error(error);alert('PDF export failed: '+error.message);
  } finally {
    button.disabled=false;button.textContent='Download Staples PDF';
  }
}
attachListeners();
