'use strict';

(() => {
  const current = () => cardById(currentId);
  const metadata=MNC_CARD_METADATA;
  const chart = () => game.typeChart(state.typeOverrides);
  const controlMap = {
    gameArt:'sourceAssetId', gameFit:'fit', gameZoom:'zoom', gamePanX:'panX', gamePanY:'panY',
    gameShape:'artShape', gameBorder:'artBorder', gameArtRadius:'artRadius',
    gameAccent:'accent', frameStyle:'frameStyle', frameWidth:'frameWidth',
    frameRadius:'frameRadius', surface:'surface', artHeight:'artHeight', artInset:'artInset',
    gameCharacterType:'characterType', gameCharacterSubtype:'characterSubtype',
    sidekickPartner:'sidekickPartner',
    showTiming:'showTiming', showIcons:'showIcons', showMatchupNames:'showMatchupNames', useTypeColor:'useTypeColor', releaseReady:'releaseReady'
  };
  const metadataKeys=new Set(['timing','ruleTitle','ruleText','quote','characterType','characterSubtype','sidekickPartner']);
  const footerFields={
    artistFirst:'artistFirst',artistLast:'artistLast',conceptCredit:'conceptCredit',actorCredit:'actorCredit',
    gameFilm:'film',gameEpisode:'episode',gamePicker:'picker',collectorNumber:'collectorNumber',
    gameEdition:'edition',gameSet:'set'
  };
  const groups=window.MNC_CATALOG_SCHEMA.characterGroups;
  dropDownOptions($('gameCategory'),[['','Choose a category'],...Object.keys(groups).map(label=>[label,label])],'');
  dropDownOptions($('frameStyle'),Object.entries(window.MNC_gameFrameStyles),'double');

  function enableGameFrame(card) {
    const family=game.role(card);
    if (!family) return;
    const defaults=game.newFields(family);
    for (const [key,value] of Object.entries(defaults)) {
      if (card[key]===undefined) card[key]=value;
    }
    if(!game.isGameCard(card))card.template='Game Frame';
    game.changeRole(card,family);
    if (!card.ruleText && card.effectText && !card.legacyEffectCopied) {
      card.ruleText=card.effectText;
      card.legacyEffectCopied=true;
    }
    if (!card.artistFirst&&!card.artistLast&&card.artist&&!/^(?:unverified|credit pending)/i.test(card.artist)) {
      const [first,...last]=card.artist.trim().split(/\s+/);
      card.artistFirst=first;
      card.artistLast=last.join(' ');
    }
  }
  window.MNC_enableGameFrame=enableGameFrame;

  function setInspectorStatus(c) {
    const fit=window.MNC_gameRuleFits(c);
    const status=$('ruleFit');
    status.textContent=fit ? '' : 'The rule or quote overlaps another text block or extends beyond the rules area. Adjust its position or size.';
    status.classList.toggle('mnc-error',!fit);
    const issues=game.readyIssues(c,state.cards);

    if(catalogCard(c)&&c.artworkFilename&&!c.sourceAssetId)issues.push('Import '+c.artworkFilename+' into Artwork');
    if (c.sourceAssetId&&!artById(c.sourceAssetId)) issues.push('Link available artwork');
    if (!fit) issues.push('Fit the rule text');
    $('cardReadiness').textContent=issues.length ? issues.join(' · ') : c.releaseReady?'In the promo pool.':'Ready to include.';
  }
  window.MNC_refreshRuleStatus=setInspectorStatus;

  function updateCatalogLabel(c) {
    const source=$('catalogCardStatus');
    source.hidden=!c?.catalogId;
    const edits=Object.keys(c?.catalogEdits||{}).length;
    source.textContent=catalogCard(c)?[c.catalogId,c.classification,c.releaseReady?'Ready':c.catalogStatus,edits?'Edited in Card Designer':'Linked to Excel'].filter(Boolean).join(' · '):
      c?.catalogId?'Unlisted from the latest workbook. This design is available for proofing.':'';
  }
  window.MNC_updateCatalogCardLabel=updateCatalogLabel;

  function showPartner(c) {
    const partner=game.partnerFor(c,state.cards);
    $('sidekickPartnerName').textContent=partner?.title||'';
  }

  function imageOptions(selected) {
    const images=state.assets.map(asset=>[asset.id,asset.title+' ['+asset.id+']']);
    if(selected&&!images.some(([id])=>id===selected))images.push([selected,'Missing icon image']);
    return images;
  }

  function syncTypeIcon(c) {
    const character=c.family==='Character';
    const type=character&&game.visualFor(c,state.typeOverrides);
    $('customTypeIcon').hidden=character;
    $('roleSubtypeControl').hidden=c.template==='Standard';
    $('typeIconNote').textContent=character?
      (type?type.name+' glyph from Glyph Kit.':'Choose a Character category to set the glyph.'):'';
    $('roleSubtype').value=c.roleSubtype||'';
    $('typeIconGlyph').value=metadata.customIcon(c);
    $('typeIconGlyph').placeholder=metadata.defaultIcon(c)+' · Auto';
    dropDownOptions($('typeIconAsset'),[['','Use symbol'],...imageOptions(c.typeIconAsset)],c.typeIconAsset||'');
  }
  window.MNC_syncTypeIcon=syncTypeIcon;

  function syncAttribution(c) {
    const info=metadata.attribution(c);
    $('c_artist').value=info.illustration;
    $('actorCredit').value=info.actor;
    $('gameCreditFields').hidden=metadata.creditType(c)==='Actor';
    for(const [id,key] of Object.entries(footerFields)){
      if(id!=='actorCredit')$(id).value=c[key]??'';
    }
    $('gameFilm').placeholder=c.family==='Movie'?'Use card title':'';
  }

  function syncCollection(c) {
    const collection=collectionFor(c), promo=metadata.isPromo(c,collection);
    const base=promo&&c.classification!=='Secret';
    const code=metadata.collectionCode(c,collection);
    const field=$('cardCollectionCode');
    field.value=c.collectionCode||'';
    field.placeholder=code||'From collection';
    const total=promo?state.setPlan.target:state.setTotals?.[c.set]??collection?.regularTarget;
    $('collectionCodeStatus').textContent=metadata.collectionLine(promo?{...c,edition:state.setPlan.edition}:c,collection,total);
    $('customCollectionFields').hidden=promo;
    $('jumpNumberPlan').hidden=!promo;
    $('setTotal').value=total??'';
    $('collectorNumber').placeholder=base?'TBD':'';
    const raw=String(c.collectorNumber??'').trim(), number=metadata.promoNumber(raw,total);
    const collision=base&&number&&state.cards.some(other=>other!==c&&!other.catalogUnlisted&&
      other.classification!=='Secret'&&metadata.isPromo(other,collectionFor(other))&&metadata.promoNumber(other.collectorNumber,total)===number);
    $('cardNumberStatus').textContent=base&&raw&&!number?'Use a number from 001 to '+total+'.':
      collision?'This number is shared by another LX26 card.':'';
    $('cardNumberStatus').classList.toggle('mnc-error',!!(collision||base&&raw&&!number));
  }

  function syncColors(c) {
    const palette=game.isGameCard(c)?window.MNC_gamePalette(c):
      c.template==='Standard'?window.MNC_standardPalette(c):null;
    if(palette){
      $('mainColor').value=palette.sourceBase;
      const gradient=MNC_LAYOUT.get(c,'border')?.gradient;
      $('frameColor').value=gradient?MNC_FRONT_EFFECTS.firstColor(gradient):palette.outer;
      if(palette.accent)$('gameAccent').value=palette.accent;
    }
    const light=c.backgroundLightness??0;
    $('backgroundLightness').value=light;
    $('lightnessValue').textContent=(light>0?'+':'')+light;
    const cut=cardCutRadius(c);
    $('cutRadius').value=cut;
    $('cutRadiusValue').textContent=cut+' px';
  }

  function syncDesignSections(c,framed) {
    const standard=c?.template==='Standard';
    $('cardLook').hidden=!c;
    $('cardColors').hidden=!(framed||standard);
    $('surfaceControl').hidden=$('gameFrameLook').hidden=!framed;
    $('filmThemeControl').hidden=!standard;
    $('gameCredit').hidden=!c;
    $('openMirrorFinish').disabled=!c;
    $('gameReadiness').hidden=!framed;
    $('legacyBasics').hidden=framed;
    $('legacyAccent').hidden=standard;
    $('jumpRules').hidden=$('jumpArt').hidden=!framed;
    $('jumpLook').hidden=!c;
    $('jumpFooter').hidden=!c;
    $('gameHeader').hidden=$('jumpHeader').hidden=!c;
    if(!c)return;
    if(!framed)syncColors(c);
    syncAttribution(c);
    syncCollection(c);
    syncTypeIcon(c);
    $('setGlyph').value=c.setGlyph??'';
    dropDownOptions($('setGlyphAsset'),[['','Use typed icon'],...imageOptions(c.setGlyphAsset)],c.setGlyphAsset||'');
  }

  function syncGameInspector() {
    const c=current();
    const framed=game.isGameCard(c);
    $('gameInspector').hidden=!framed;
    const linked=catalogCard(c);
    updateCatalogLabel(c);
    $('deleteDraftCard').disabled=linked;
    $('cardTools').hidden=!c;
    $('legacyFields').hidden=!c;
    $('cardToolStatus').textContent='';
    $('useGameFrame').hidden=framed||!game.role(c);
    $('legacyStandard').hidden=framed;

    $('legacyVariants').hidden=framed;
    $('resetTextPositions').hidden=framed;
    const previousMode=$('legacyFields').dataset.mode;
    $('legacyFields').dataset.mode=framed?'game':'legacy';
    if (previousMode!==$('legacyFields').dataset.mode) $('legacyFields').open=!framed;
    $('legacyFields').querySelector('summary').textContent=framed?'Lettering, overlays & layers':'Details & layers';
    syncDesignSections(c,framed);
    if (!framed) return;
    const types=chart();
    const isCharacter=c.family==='Character';
    $('gameRoleHelp').textContent=game.roles[c.family].action;
    for(const id of ['gameShape','gameBorder','gameArtRadius','artInset'])$(id).disabled=c.template==='Game Full Art';
    $('typeControl').hidden=$('iconControl').hidden=$('nameControl').hidden=!isCharacter;
    $('gameCategory').value=c.characterCategory||'';
    $('creatureTypeControl').hidden=c.characterCategory!=='Creature';
    $('gameCharacterTypeOptions').replaceChildren(...(groups[c.characterCategory]||[]).map(label=>new Option(label,label)));
    const isSidekick=c.characterCategory==='Sidekick';
    $('sidekickPartnerRow').hidden=!isSidekick;
    if(isSidekick){
      const candidates=state.cards.filter(card=>card!==c&&card.family==='Character'&&!card.catalogUnlisted);
      $('sidekickPartners').replaceChildren(...candidates.map(card=>new Option(card.title,card.catalogId||card.id)));
    }
    $('gameMatchups').hidden=!isCharacter;
    const {wins,losses}=game.matchups(c.characterCategory,types);
    const intrinsic=game.categoryRule(c,state.cards,state);
    if(!isCharacter)$('gameMatchups').textContent='';
    else if(intrinsic)$('gameMatchups').textContent=intrinsic;
    else $('gameMatchups').textContent=wins.length?'Beats '+wins[0].name+'  /  Beaten by '+losses[0].name:'Choose a Character category.';
    dropDownOptions($('gameTiming'),[['','Unassigned'],...game.roles[c.family].timing.map(t=>[t,game.timingLabel(t)])],c.timing||'');
    const assetOptions=state.assets.map(asset=>[asset.id,asset.title+' ['+asset.id+']']);
    dropDownOptions($('gameArt'),[['','Choose artwork'],...assetOptions],c.sourceAssetId||'');
    const defaults=game.newFields(c.family);
    for (const [id,key] of Object.entries(controlMap)) {
      const el=$(id);
      if (el.type==='checkbox') el.checked=c[key]??defaults[key]??true;
      else el.value=c[key]??defaults[key]??'';
    }
    if(isSidekick){
      $('sidekickPartner').value=game.partnerRef(c);
      showPartner(c);
    }
    syncColors(c);
    setInspectorStatus(c);
  }

  const priorRefresh=window.refreshStudio;
  window.refreshStudio=function() {
    priorRefresh();
    syncGameInspector();
  };

  for (const [id,key] of Object.entries(controlMap)) {
    const el=$(id);
    const eventType=['range','textarea','color'].includes(el.type)||['ruleTitle','roleBadgeText','roleBadgeIcon'].includes(id)?'input':'change';
    el.addEventListener(eventType,()=>{
      const c=current();
      if(!game.isGameCard(c))return;
      const value=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):key==='sidekickPartner'?el.value.trim():el.value;
      if(key==='sourceAssetId')setCardArtwork(c,value);
      else if(key==='releaseReady'){
        editCardFields(c,{releaseReady:value,catalogStatus:value?'Ready':c.catalogStatus==='Ready'?'Draft':c.catalogStatus});
      }
      else if(metadataKeys.has(key))editCardFields(c,{[key]:value});
      else c[key]=value;
      if(key==='showIcons')front.editable(c).matchIcons=value;
      if(key==='showMatchupNames')front.editable(c).matchNames=value;
      if(key==='artShape'){c.artShapeId='';$('frontArtShape').value='';}
      if(key==='quote')editCardFields(c,{lore:c.quote});
      if(key==='ruleText')editCardFields(c,{effectText:c.ruleText});
      if(key==='characterSubtype')editCardFields(c,{subtype:c.characterSubtype});
      if(key==='accent'){
        c.useTypeColor=false;
        $('useTypeColor').checked=false;
      }
      if(key==='surface'){
        delete c.mainColor;
        delete c.backgroundLightness;
        delete c.layoutDesign?.background;
      }
      if(['accent','useTypeColor','surface'].includes(key)){
        syncColors(c);
        if(key==='surface')window.MNC_syncFrontStudio?.();
      }
      updateCatalogLabel(c);
      persist();setInspectorStatus(c);drawStudioPreview();
      if(key==='sourceAssetId')refreshStudio();
      if(key==='sidekickPartner'){
        showPartner(c);
        $('gameMatchups').textContent=game.categoryRule(c,state.cards,state);
      }
      if(key==='characterType'){syncTypeIcon(c);renderCardList();}
    });
  }
  for(const [button,section] of [['jumpRules','gameplayGroup'],['jumpHeader','gameHeader'],['jumpArt','gameArtwork'],
    ['jumpLook','cardLook'],['jumpFooter','gameCredit']]){
    $(button).onclick=()=>{
      const target=$(section);
      target.open=true;target.scrollIntoView({block:'nearest'});
      target.querySelector('summary').focus({preventScroll:true});
    };
  }
  const setGlyph=()=>{
    const c=current();
    if(!c||c.setGlyph===$('setGlyph').value)return;
    editCardFields(c,{setGlyph:$('setGlyph').value,setGlyphAsset:''});
    $('setGlyphAsset').value='';
    updateCatalogLabel(c);persist();drawStudioPreview();
  };
  $('setGlyph').oninput=$('setGlyph').onchange=setGlyph;
  for(const [id,key] of Object.entries(footerFields)){
    $(id).onchange=event=>{
      const c=current();
      if(!c)return;
      const input=event.target, value=input.value.trim();
      const base=metadata.isPromo(c,collectionFor(c))&&c.classification!=='Secret';
      const total=state.setPlan.target;
      if(key==='collectorNumber'&&base&&value&&!metadata.promoNumber(value,total)){
        $('cardNumberStatus').textContent='Use a number from 001 to '+total+'.';
        $('cardNumberStatus').classList.add('mnc-error');
        return;
      }
      editCardFields(c,{[key]:key==='collectorNumber'&&base&&value?metadata.printNumber(metadata.promoNumber(value,total)):value});
      if(key==='artistFirst'||key==='artistLast'){
        editCardFields(c,{artist:[c.artistFirst,c.artistLast].filter(Boolean).join(' ')});
      }
      syncAttribution(c);syncCollection(c);updateCatalogLabel(c);
      if(game.isGameCard(c))setInspectorStatus(c);
      window.MNC_syncFrontStudio?.();persist();drawStudioPreview();
    };
  }
  $('cardCollectionCode').onchange=event=>{
    const c=current();
    if(!c)return;
    const input=event.target, code=metadata.normalizeCode(input.value);
    if(input.value.trim()&&!code){
      $('collectionCodeStatus').textContent='Use up to 12 letters, digits or hyphens.';
      return;
    }
    editCardFields(c,{collectionCode:code});
    window.MNC_refreshItemSetGroup?.(c);
    syncCollection(c);updateCatalogLabel(c);persist();drawStudioPreview();
  };
  for(const [id,key] of [['typeIconGlyph','typeIconGlyph'],['typeIconAsset','typeIconAsset'],['roleSubtype','roleSubtype']]){
    $(id).onchange=event=>{
      const c=current();
      if(!c||c.family==='Character')return;
      const value=event.target.value.trim();
      const fields=key==='roleSubtype'?{roleSubtype:value,subtype:value}:{[key]:value};
      if(key==='typeIconGlyph')fields.typeIconAsset='';
      editCardFields(c,fields);
      if(key==='roleSubtype')window.MNC_refreshItemSetGroup?.(c);
      syncTypeIcon(c);updateCatalogLabel(c);persist();drawStudioPreview();
    };
  }
  $('jumpNumberPlan').onclick=()=>{
    tab('rules');$('numberPlan').open=true;$('numberPlan').scrollIntoView({block:'nearest'});
  };
  $('setGlyphAsset').onchange=()=>{
    const c=current();
    if(!c)return;
    editCardFields(c,{setGlyphAsset:$('setGlyphAsset').value});
    updateCatalogLabel(c);persist();drawStudioPreview();
  };
  for(const [id,key] of [['mainColor','mainColor'],['frameColor','borderColor'],['backgroundLightness','backgroundLightness'],['cutRadius','cutRadius']]){
    $(id).oninput=event=>{
      const c=current();
      if(!c)return;
      const {target}=event;
      c[key]=target.type==='range'?Number(target.value):target.value;
      if(key==='mainColor')MNC_LAYOUT.backgroundStart(c,c.mainColor);
      const gradient=key==='borderColor'&&MNC_LAYOUT.get(c,'border')?.gradient;
      if(gradient){
        const first=gradient.stops.reduce((left,stop)=>stop.at<left.at?stop:left);
        first.color=c.borderColor;
      }
      syncColors(c);persist();drawStudioPreview();
    };
  }
  $('resetCardColors').onclick=()=>{
    const c=current();
    if(!c)return;
    for(const key of ['mainColor','borderColor','backgroundLightness'])delete c[key];
    delete c.layoutDesign?.background;
    const border=MNC_LAYOUT.get(c,'border');
    if(border)delete border.gradient;
    MNC_LAYOUT.cleanLayer(c,'border');
    syncColors(c);window.MNC_syncFrontStudio?.();persist();drawStudioPreview();
  };
  $('mncFilmTheme').onchange=event=>{
    const c=current();
    if(c?.template!=='Standard')return;
    c.filmTheme=event.target.value;
    delete c.layoutDesign?.background;
    delete c.mainColor;delete c.backgroundLightness;
    syncColors(c);window.MNC_syncFrontStudio?.();persist();drawStudioPreview();
  };
  $('gameCategory').onchange=()=>{
    const c=current();
    if(!game.isGameCard(c))return;
    editCardFields(c,{characterCategory:$('gameCategory').value});
    persist();refreshStudio();
  };
  $('setTotal').onchange=()=>{
    const c=current();
    if(!c?.set||metadata.isPromo(c,collectionFor(c)))return;
    const value=$('setTotal').valueAsNumber;
    if (!Number.isInteger(value)||value<1||value>9999) delete state.setTotals[c.set];
    else Object.defineProperty(state.setTotals,c.set,{value,writable:true,configurable:true,enumerable:true});
    persist();refreshStudio();
  };
  $('useGameFrame').onclick=()=>{
    const c=current();
    enableGameFrame(c);
    $('cardScope').value='game';
    persist();refreshStudio();
  };
  $('queueCurrentCard').onclick=()=>{
    const c=current();if(!c)return;
    let index=state.sheets.findIndex(sheet=>sheet.slots.some(id=>!id));
    if(index<0){index=state.sheets.length;state.sheets.push(newPrintSheet(index+1));}
    const slots=state.sheets[index].slots,slot=slots.findIndex(id=>!id);
    slots[slot]=c.id;
    $('cardToolStatus').textContent='Added to sheet '+(index+1)+', slot '+(slot+1)+'.';
    persist();
  };
  $('deleteDraftCard').onclick=()=>{
    const c=current();
    if(!c||catalogCard(c)||!confirm('Remove '+c.title+' from this project and its print slots?'))return;
    state.cards=state.cards.filter(card=>card.id!==c.id);
    for(const sheet of state.sheets)sheet.slots=sheet.slots.map(id=>id===c.id?'':id);
    currentId=state.cards.find(game.isGameCard)?.id||state.cards[0]?.id||null;
    if(!state.cards.some(game.isGameCard))$('cardScope').value='all';
    persist();refreshAll();
  };
  $('fitArt').onclick=()=>{
    const c=current();
    if(!game.isGameCard(c))return;
    Object.assign(c,{fit:'cover',zoom:1,panX:0,panY:0});
    persist();refreshStudio();
  };
  $('gameArtUpload').onchange=async e=>{
    const c=current(), file=e.target.files[0];
    if(!c||!file)return;
    const [id]=await importImages([file]);
    if(id){
      setCardArtwork(c,id);
      Object.assign(c,{fit:'cover',zoom:1,panX:0,panY:0});
      persist();
      if(currentId===c.id) refreshStudio();
    }
    e.target.value='';
  };

  const preview=$('cardPreview');
  let cropDrag;
  function pointer(e) {
    const rect=preview.getBoundingClientRect();
    return {x:(e.clientX-rect.x)*CW/rect.width, y:(e.clientY-rect.y)*CH/rect.height};
  }
  preview.addEventListener('pointerdown',e=>{
    const c=current();
    if(window.MNC_frontMoveActive?.())return;
    if(!game.isGameCard(c)||!c.sourceAssetId||e.button!==0||e.altKey)return;
    const at=pointer(e),r=window.MNC_artBox(c);
    if(at.x<r.x||at.y<r.y||at.x>r.x+r.w||at.y>r.y+r.h)return;
    const overlapsLayer=(c.layers||[]).some(layer=>layer.visible!==false&&
      Math.abs(at.x/CW-layer.x)<=layer.w/2&&Math.abs(at.y/CH-layer.y)<=layer.h/2);
    if(overlapsLayer)return;
    cropDrag={at,c,x:c.panX||0,y:c.panY||0,id:e.pointerId};
    preview.setPointerCapture(e.pointerId);
    e.stopImmediatePropagation();
  },true);
  preview.addEventListener('pointermove',e=>{
    if(!cropDrag||e.pointerId!==cropDrag.id)return;
    const {c,at,x,y}=cropDrag,r=window.MNC_artBox(c),next=pointer(e);
    const asset=artById(c.sourceAssetId);
    const measured=imageSizes.get(assetURI(asset));
    const w=asset?.w||measured?.w||r.w,h=asset?.h||measured?.h||r.h;
    const scale=Math[c.fit==='contain'?'min':'max'](r.w/w,r.h/h)*(c.zoom||1);
    c.panX=clamp(x+(next.x-at.x)/Math.max(1,(w*scale-r.w)/2),-1,1);
    c.panY=clamp(y+(next.y-at.y)/Math.max(1,(h*scale-r.h)/2),-1,1);
    $('gamePanX').value=c.panX;$('gamePanY').value=c.panY;
    drawStudioPreview();e.stopImmediatePropagation();
  },true);
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    preview.addEventListener(type,e=>{
      if(!cropDrag||e.pointerId!==cropDrag.id)return;
      cropDrag=null;persist();e.stopImmediatePropagation();
    },true);
  }

  $('addGolden').onclick=()=>{
    const existing=state.cards.find(c=>c.conceptId==='golden-jupie'&&!c.catalogUnlisted);
    if(existing)openCard(existing);
    else {
      const c=createCard(null,'Item');
      const {subtype,...rules}=game.golden;
      Object.assign(c,rules,{roleSubtype:subtype,conceptId:'golden-jupie'});
      persist();refreshStudio();
    }
  };

  function renderTypeEditor() {
    const host=$('typeEditor');
    host.replaceChildren();
    const groups=[['Character categories',chart()],['Creature types',game.creatures.map(type=>game.paletteEntry(type,state.typeOverrides))]];
    for(const [name,types] of groups){
      const group=document.createElement('fieldset');
      const legend=document.createElement('legend');
      legend.textContent=name;group.append(legend);
      for(const type of types){
        const row=document.createElement('div');row.className='type-row';
        const color=document.createElement('input');color.type='color';color.value=type.color;
        color.setAttribute('aria-label',type.name+' color');
        color.onchange=()=>{
          state.typeOverrides[type.id]={color:color.value};
          persist();renderMatrix();
        };
        const label=document.createElement('span');label.textContent=type.name;
        const draw=document.createElement('button');draw.textContent='Draw symbol';
        draw.onclick=()=>{$('glyphTypeTarget').value=type.id;tab('glyph');};
        row.append(color,label,draw);group.append(row);
      }
      host.append(group);
    }
  }

  function outcomeLabel(first,second) {
    const result=game.compare(first,second);
    return result===null?'Open':result===0?'Draw':result===1?'Win':'Loss';
  }

  function matchupResult() {
    const first=game.profiles.find(type=>type.id===$('testFirst').value);
    const second=game.profiles.find(type=>type.id===$('testSecond').value);
    if(!first||!second){
      $('matchResult').textContent='Choose plays to compare.';
      $('matchDefeatNote').textContent='';
      return;
    }
    const outcome=game.compare(first.id,second.id);
    $('matchResult').textContent=outcome===0?first.name+' draws with '+second.name:
      outcome===1?first.name+' beats '+second.name:second.name+' beats '+first.name;
    const before=id=>clamp(Math.trunc($(id).valueAsNumber||0),0,game.defeatLimit-1);
    const total=game.countDefeats(before('testFirstDefeats'),before('testSecondDefeats'),outcome,first.pair?2:1,second.pair?2:1);
    const after='Player 1: '+total.firstTotal+' · Player 2: '+total.secondTotal+' defeats taken.';
    const end=total.winner==='first'?' Player 1 wins.':total.winner==='second'?' Player 2 wins.':'';
    $('matchDefeatNote').textContent=after+end;
  }

  const testProfiles=game.profiles.filter(type=>!type.variant || groups.Creature.includes(type.name));

  function renderMatrix() {
    const types=testProfiles;
    for(const [id,initial] of [['testFirst','creature'],['testSecond','hero']]){
      const el=$(id);
      dropDownOptions(el,types.map(type=>[type.id,type.name]),el.value||initial);
    }
    matchupResult();
    const cell=(tag,text)=>'<'+tag+'>'+safe(text)+'</'+tag+'>';
    $('matchMatrix').innerHTML='<thead><tr>'+cell('th','Row vs. column')+types.map(type=>cell('th',type.name)).join('')+'</tr></thead><tbody>'+
      types.map(first=>'<tr><th scope="row">'+safe(first.name)+'</th>'+types.map(second=>{
        const label=outcomeLabel(first.id,second.id);
        return '<td class="result-'+label.toLowerCase()+'">'+label+'</td>';
      }).join('')+'</tr>').join('')+'</tbody>';
    renderPool();
  }

  $('testFirst').onchange=$('testSecond').onchange=matchupResult;
  $('testFirstDefeats').oninput=$('testSecondDefeats').oninput=matchupResult;
  $('exportMatrix').onclick=()=>{
    const types=testProfiles;
    const rows=types.map(first=>Object.fromEntries([
      ['Row type',first.name],...types.map(second=>['vs '+second.name,outcomeLabel(first.id,second.id)])
    ]));
    downloadCSV('MNC_Character_Matchups.csv',['Row type',...types.map(type=>'vs '+type.name)],rows);
  };

  function promoCards() {
    return state.cards.filter(c=>game.isGameCard(c)&&!c.catalogUnlisted&&
      (catalogCard(c)?c.collectionId===window.MNC_CATALOG_SCHEMA.promoId:c.set===game.release)&&c.releaseReady&&
      artById(c.sourceAssetId)&&game.readyIssues(c,state.cards).length===0&&window.MNC_gameRuleFits(c));
  }

  const isChase=c=>c.classification==='Secret'||['Ultra Rare','Special'].includes(c.rarity)||c.conceptId==='golden-jupie';
  function cardPlanRows() {
    return Array.isArray(state.packPlan?.rows) ? state.packPlan.rows : [];
  }

  function planValid(rows, eligible) {
    const ids=new Set(eligible.map(c=>c.id));
    return rows.length&&rows.every(row=>Array.isArray(row)&&row.length===3&&
      row.every((id,index)=>ids.has(id)&&cardById(id)?.family===['Character','Critic','Item'][index]));
  }

  function renderPool(message) {
    const ready=promoCards();
    const release=state.catalogCollections?.[window.MNC_CATALOG_SCHEMA.promoId];
    const tracked=state.cards.filter(c=>catalogCard(c)&&c.collectionId===window.MNC_CATALOG_SCHEMA.promoId);
    const regular=tracked.filter(c=>c.classification==='Regular');
    const secret=tracked.filter(c=>c.classification==='Secret');
    $('promoPoolTitle').textContent=release?release.name:'December 12 promo pool';
    $('promoCatalogSummary').hidden=!release;
    $('promoCatalogSummary').textContent=release?
      regular.length+' / '+release.regularTarget+' regular designs logged · '+secret.length+' Secret logged · '+
      regular.filter(c=>c.family==='Movie').length+' / '+release.familyTargets.Movie+' Movies logged':'';
    const types=chart();
    $('poolCounts').replaceChildren(...Object.keys(game.roles).map(family=>{
      const stat=document.createElement('div');
      const n=ready.filter(c=>c.family===family).length;
      stat.innerHTML='<strong>'+n+'</strong><span>'+family+' ready</span>';
      return stat;
    }));
    $('poolCoverage').replaceChildren(...types.map(type=>{
      const stat=document.createElement('div');
      const n=ready.filter(c=>c.family==='Character'&&game.categoryFor(c.characterCategory)?.id===type.id).length;
      stat.style.borderLeftColor=type.color;
      stat.textContent=type.name+' · '+n;
      return stat;
    }));
    const eligibleChase=ready.filter(c=>c.family==='Item'&&(c.rarity==='Rare'||isChase(c)));
    dropDownOptions($('chaseCard'),[['','Choose a chase Item'],...eligibleChase.map(c=>[c.id,c.title])],$('chaseCard').value||state.packPlan?.chaseId||'');
    const rows=cardPlanRows(), valid=planValid(rows,ready);
    $('exportPackPlan').disabled=$('queuePacks').disabled=!valid;
    const packStatus=$('packStatus');
    packStatus.textContent=message??(rows.length?(valid?rows.length+' packs · '+rows.length*3+' cards':'Some cards changed after collation. Rebuild the pack list.'):release?'Mark designs for the promo pool in Card Designer or set them to Ready in Excel.':'Complete a card and select Include in promo pool to use it here.');
    $('packTable').innerHTML=rows.length ? '<thead><tr><th>Pack</th><th>Character</th><th>Critic</th><th>Item</th></tr></thead><tbody>'+
      rows.map((row,i)=>'<tr><th scope="row">'+String(i+1).padStart(2,'0')+'</th>'+
        row.map(id=>'<td>'+safe(cardById(id)?.title||'Unavailable')+'</td>').join('')+'</tr>').join('')+'</tbody>' : '';
  }

  function buildPackPlan() {
    const packCount=$('packCount').valueAsNumber,chaseCount=$('chaseCount').valueAsNumber,chaseId=$('chaseCard').value;
    if (!Number.isInteger(packCount)||packCount<1||packCount>200||!Number.isInteger(chaseCount)||chaseCount<0||chaseCount>packCount) {
      renderPool('Use 1–200 packs and a chase count between zero and the number of packs.');
      return;
    }
    const eligible=promoCards();
    const base=eligible.filter(c=>!isChase(c)&&!(chaseCount&&c.id===chaseId));
    const byRole=['Character','Critic','Item'].map(family=>base.filter(c=>c.family===family));
    if(!byRole[0].length||!byRole[1].length||(!byRole[2].length&&chaseCount!==packCount)){
      renderPool('Add at least one ready Character, Critic and regular Item before building this run.');
      return;
    }
    if (chaseCount&&!eligible.some(c=>c.id===chaseId&&c.family==='Item'&&(c.rarity==='Rare'||isChase(c)))) {
      renderPool('Choose a ready Rare, Ultra Rare or Special Item for the chase slot.');
      return;
    }
    const typePools=chart().map(t=>byRole[0].filter(c=>game.categoryFor(c.characterCategory)?.id===t.id)).filter(pool=>pool.length);
    const rows=Array.from({length:packCount},(_,i)=>{
      const typePool=typePools[i%typePools.length];
      const hero=typePool[Math.floor(i/typePools.length)%typePool.length];
      const critic=byRole[1][i%byRole[1].length];
      const isChaseSlot=Math.floor((i+1)*chaseCount/packCount)>Math.floor(i*chaseCount/packCount);
      const item=isChaseSlot?chaseId:byRole[2][(i-Math.floor(i*chaseCount/packCount))%byRole[2].length].id;
      return [hero.id,critic.id,item];
    });
    state.packPlan={packCount,chaseCount,chaseId,rows};
    persist();renderPool();
  }

  $('buildPacks').onclick=buildPackPlan;
  $('exportPackPlan').onclick=()=>{
    const rows=cardPlanRows();
    if(!planValid(rows,promoCards()))return renderPool();
    const keys=['Pack','Character ID','Character','Critic ID','Critic','Item ID','Item'];
    downloadCSV('MNC_December_12_Pack_Manifest.csv',keys,rows.map((row,i)=>({
      Pack:i+1,'Character ID':cardById(row[0]).catalogId||row[0],Character:cardById(row[0]).title,'Critic ID':cardById(row[1]).catalogId||row[1],Critic:cardById(row[1]).title,
      'Item ID':cardById(row[2]).catalogId||row[2],Item:cardById(row[2]).title
    })));
  };
  $('queuePacks').onclick=()=>{
    const rows=cardPlanRows();
    if(!planValid(rows,promoCards()))return renderPool();
    const ids=rows.flat();
    const firstNew=state.sheets.length;
    for(let i=0;i<ids.length;i+=8)state.sheets.push(newPrintSheet(state.sheets.length+1,ids.slice(i,i+8)));
    persist();tab('production');
    window.MNC_chooseProofSheet(firstNew);
  };

  function openCard(c) {
    currentId=c.id;
    $('cardSearch').value='';
    $('cardScope').value=inWorkingCatalog(c)?'game':'all';
    tab('studio');
  }

  function renderNumberPlan() {
    const {slots,unnumbered,invalid}=metadata.numberPlan(state.cards,state.catalogCollections,state);
    const filter=$('numberPlanFilter');
    const blocks=new Map();
    for(const slot of slots){
      const range=blocks.get(slot.group)||[slot.number,slot.number];
      range[1]=slot.number;
      blocks.set(slot.group,range);
    }
    dropDownOptions(filter,[['','All '+state.setPlan.target+' slots'],...[...blocks].map(([group,[start,end]])=>
      [group,metadata.printNumber(start)+'–'+metadata.printNumber(end)+' · '+group])],filter.value||'');
    const button=card=>'<button type="button" data-number-card="'+safe(card.id)+'">'+safe(card.title)+'</button>';
    const chosen=slots.filter(slot=>!filter.value||slot.group===filter.value);
    $('numberTable').innerHTML='<thead><tr><th scope="col">Number</th><th scope="col">Draft block</th><th scope="col">Assigned card</th></tr></thead><tbody>'+
      chosen.map(({number,group,cards})=>'<tr><th scope="row">'+metadata.printNumber(number)+
        '</th><td>'+safe(group)+'</td><td>'+(cards.length?cards.map(button).join(' '):'Open')+
        (cards.length>1?' <span class="mnc-error">Duplicate</span>':'')+'</td></tr>').join('')+'</tbody>';
    const filled=slots.filter(slot=>slot.cards.length).length;
    const duplicates=slots.filter(slot=>slot.cards.length>1).length;
    $('numberPlanSummary').textContent=filled+'/'+state.setPlan.target+' slots assigned · '+unnumbered.length+' unnumbered'+
      (duplicates?' · '+duplicates+' duplicate '+(duplicates===1?'slot':'slots'):'')+
      (invalid.length?' · '+invalid.length+' outside 001–'+metadata.printNumber(state.setPlan.target):'');
    const loose=[...invalid,...unnumbered];
    $('numberUnassignedLabel').textContent=loose.length?'Cards that need a number':'';
    $('numberUnassigned').innerHTML=loose.map(button).join('');
  }

  $('numberPlanFilter').onchange=renderNumberPlan;
  $('numberPlan').addEventListener('click',event=>{
    const id=event.target.closest?.('[data-number-card]')?.dataset.numberCard;
    const c=id&&cardById(id);
    if(!c)return;
    openCard(c);$('gameCredit').open=true;$('collectorNumber').focus();
  });
  $('exportNumberPlan').onclick=()=>{
    const {slots}=metadata.numberPlan(state.cards,state.catalogCollections,state);
    downloadCSV('LX26_Draft_Card_Numbers.csv',['Number','Draft block','Assigned card','Card ID'],slots.map(({number,group,cards})=>({
      Number:metadata.printNumber(number),'Draft block':group,
      'Assigned card':cards.map(card=>card.title).join(' | '),'Card ID':cards.map(card=>card.catalogId||card.id).join(' | ')
    })));
  };
  window.MNC_openStudioCard=openCard;
  window.MNC_renderGamePage=function() {
    $('packCount').value=state.packPlan?.packCount??$('packCount').value;
    $('chaseCount').value=state.packPlan?.chaseCount??$('chaseCount').value;
    renderTypeEditor();renderMatrix();renderNumberPlan();
  };
})();
