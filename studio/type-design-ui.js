'use strict';

(() => {
  const model=MNC_TYPE_DESIGN,current=()=>cardById(currentId);
  const selected=()=>state.typeDesigns.profiles[$('typeDesignProfile').value];
  let queued=false,previewVersion=0,footerUndo=null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const text=(layout,id)=>layout.text[id]??={};
  const setValue=(id,value)=>{$(id)[$(id).type==='checkbox'?'checked':'value']=value;};
  const copyFits=c=>game.isGameCard(c)?window.MNC_gameRuleFits(c):c.template==='Standard'?window.MNC_standardRuleFits(c):
    !window.MNC_legacyCopyLayout(document.createElement('canvas').getContext('2d'),c).overflow;

  function previewCard(id,requested='') {
    const info=MNC_SET_PLAN.profile(id),matches=state.cards.filter(card=>!card.catalogUnlisted&&model.matching(card,id));
    const actual=matches.find(card=>card.id===requested);
    if(actual)return clone(actual);
    const family=info?.family||'Character',fields=game.roles[family]?game.newFields(family):{};
    const card={...fields,id:'TYPE-PREVIEW-'+id,title:(info?.name||'Type')+' preview',family,
      template:family==='Movie'?'Standard':'Game Frame',characterCategory:info?.category||(id==='creature'?'Creature':'Hero'),
      characterType:info?.type||'',roleSubtype:info?.subtype||'',artworkProfile:'standard',
      sourceAssetId:matches[0]?.sourceAssetId||state.assets.find(asset=>asset.id===game.ashArt.id)?.id||state.assets[0]?.id||'',
      set:game.release,collectionCode:'LX26',collectorNumber:'',typeSymbolMode:'standard',collectionSymbolMode:'standard',
      ruleTitle:'Preview power',ruleText:'Card-specific powers appear here.',quote:'Your quote appears here.'};
    if(id==='villain')card.characterSubtype=game.villainSubtypeOptions(state)[0];
    applyStartingDesign(card,id);
    return card;
  }
  window.MNC_typePreviewCard=previewCard;

  function changed() {
    persist();
    if(queued)return;
    queued=true;requestAnimationFrame(()=>{
      queued=false;
      if(activeTab==='studio'){
        drawStudioPreview();
        if(game.isGameCard(current()))window.MNC_refreshRuleStatus?.(current());
        else $('ruleFit').textContent=copyFits(current())?'':'The text reaches the metadata area. Try smaller text or shorter copy.';
      }
      if(activeTab==='typeDesigner')paintType();
      window.MNC_refreshSymbolContext?.();
    });
  }

  function readNumber(node) {
    return Number.isFinite(node.valueAsNumber)?clamp(node.valueAsNumber,Number(node.min),Number(node.max)):null;
  }

  function bindAttributes(prefix,target,card,onChange=changed) {
    const fields={Layout:'matchLayout',Order:'matchOrder',Style:'matchStyle',Gap:'matchGap',IconSize:'matchIcon',
      Labels:'matchLabels',Icons:'matchIcons',Names:'matchNames',WinLabel:'winLabel',LossLabel:'lossLabel'};
    for(const [suffix,key] of Object.entries(fields)){
      const node=$(prefix+suffix);
      node.oninput=node.onchange=()=>{
        const layout=target();if(!layout)return;
        const value=node.type==='number'?readNumber(node):node.type==='checkbox'?node.checked:node.value;
        if(value===null)return;
        if((key==='winLabel'||key==='lossLabel')&&!value)delete layout[key];else layout[key]=value;
        onChange();
      };
    }
    for(const [suffix,id] of [['ValueSize','matchValue'],['LabelSize','matchLabel']]){
      $(prefix+suffix).oninput=$(prefix+suffix).onchange=()=>{
        const value=readNumber($(prefix+suffix));if(value===null)return;
        text(target(),id).size=value;onChange();
      };
    }
  }

  function syncAttributes(prefix,c) {
    const layout=front.effective(c),defaults={Layout:'columns',Order:'wins-first',Style:'tint',Gap:19,IconSize:34,
      Labels:true,Icons:c.showIcons!==false,Names:c.showMatchupNames!==false,WinLabel:'',LossLabel:''};
    const keys={Layout:'matchLayout',Order:'matchOrder',Style:'matchStyle',Gap:'matchGap',IconSize:'matchIcon',
      Labels:'matchLabels',Icons:'matchIcons',Names:'matchNames',WinLabel:'winLabel',LossLabel:'lossLabel'};
    for(const [suffix,key] of Object.entries(keys))setValue(prefix+suffix,layout[key]??defaults[suffix]);
    setValue(prefix+'ValueSize',layout.text?.matchValue?.size??23);
    setValue(prefix+'LabelSize',layout.text?.matchLabel?.size??15);
  }

  function bindCopy(prefix,target) {
    for(const [suffix,id] of [['TypeSize','typeRule'],['PowerSize','rule'],['QuoteSize','quote']]){
      $(prefix+suffix).oninput=$(prefix+suffix).onchange=()=>{
        const value=readNumber($(prefix+suffix));if(value===null)return;
        text(target(),id).size=value;changed();
      };
    }
    $(prefix+'Font').onchange=()=>{for(const id of ['typeRule','rule','ruleTitle','timing'])text(target(),id).font=$(prefix+'Font').value;changed();};
    $(prefix+'QuoteFont').onchange=()=>{text(target(),'quote').font=$(prefix+'QuoteFont').value;changed();};
    $(prefix+'Italic').onchange=()=>{text(target(),'quote').style=$(prefix+'Italic').checked?'italic':'normal';changed();};
    $(prefix+'Align').onchange=()=>{text(target(),'quote').align=$(prefix+'Align').value;changed();};
  }

  function syncCopy(prefix,c) {
    const styles=front.effective(c).text||{};
    for(const [suffix,id,size] of [['TypeSize','typeRule',20],['PowerSize','rule',23],['QuoteSize','quote',19]])setValue(prefix+suffix,styles[id]?.size??size);
    setValue(prefix+'Font',styles.rule?.font||'sans');setValue(prefix+'QuoteFont',styles.quote?.font||'serif');
    setValue(prefix+'Italic',styles.quote?.style?styles.quote.style.includes('italic'):true);
    setValue(prefix+'Align',styles.quote?.align||'left');
  }

  async function paintType() {
    const token=++previewVersion,id=$('typeDesignProfile').value,c=previewCard(id,$('typePreviewCard').value);
    if(!$('typePreviewCard').value&&c.frontLayout?.text?.matchLabel){
      const {x,y}=c.frontLayout.text.matchLabel;
      c.frontLayout.text.matchLabel={x,y};
    }
    const canvas=document.createElement('canvas');canvas.width=750;canvas.height=1050;
    await drawCard(c,canvas,{rounded:true});if(token!==previewVersion)return;
    $('typeDesignPreview').getContext('2d').drawImage(canvas,0,0);
    const fits=copyFits(c);
    $('typePreviewStatus').textContent=fits?
      (['custom','hidden'].includes(c.typeRuleMode)?'This card has its own type rule. Choose Type preview to see the shared wording.':'Changes are shown on the card.'):
      'Text reaches the metadata area. Try smaller text, shorter copy, or a shorter artwork window.';
  }

  function renderType() {
    const id=$('typeDesignProfile').value||'redshirt';
    dropDownOptions($('typeDesignProfile'),model.profiles().map(profile=>[profile.id,profile.name]),id);
    const cards=state.cards.filter(card=>!card.catalogUnlisted&&model.matching(card,id));
    dropDownOptions($('typePreviewCard'),[['','Type preview'],...cards.map(card=>[card.id,card.title])],$('typePreviewCard').value||'');
    const overridden=cards.filter(card=>['custom','hidden'].includes(card.typeRuleMode)).length;
    $('typeDesignCount').textContent=cards.length+' matching cards · '+overridden+' individual rule overrides';
    $('typeDesignRuleMode').value=selected().ruleMode;
    $('typeDesignRule').value=selected().ruleMode==='custom'?selected().ruleText:model.original(id);
    $('typeDesignRule').disabled=selected().ruleMode==='hidden';
    const palette=[...game.categories,...game.creatures].find(type=>type.id===id);
    $('typeColorLabel').hidden=!palette;
    if(palette)$('typeDesignColor').value=state.typeOverrides[id]?.color||palette.color;
    $('typeHeaderSubtypeRow').hidden=!game.categories.some(type=>type.id===id&&id!=='creature');
    $('typeHeaderSubtype').value=String(selected().frontLayout.showCharacterSubtype??'');
    const c=previewCard(id,$('typePreviewCard').value);
    delete c.frontLayout;
    $('villainSubtypeSettings').hidden=id!=='villain';
    $('typeMatchHeading').hidden=c.family!=='Character';
    $('villainSubtypeNames').textContent=game.villainSubtypeOptions(state).join(' · ');
    syncMatchHeading(c);
    syncAttributes('typeAttr',c);syncCopy('typeCopy',c);paintType();
  }

  function syncMatchHeading(card){
    const heading=front.effective(card).text.matchLabel||{};
    const ink=game.isGameCard(card)?window.MNC_gamePalette(card).quiet:model.palette(card).ink;
    $('typeMatchHeadingFont').value=heading.font||'';
    $('typeMatchHeadingStyle').value=heading.style||'';
    $('typeMatchHeadingColor').value=heading.color||ink;
    $('typeMatchHeadingAuto').disabled=!selected().frontLayout.text.matchLabel?.color;
  }

  for(const [id,key] of [['typeMatchHeadingFont','font'],['typeMatchHeadingStyle','style'],['typeMatchHeadingColor','color']]){
    $(id).onchange=()=>{
      const style=text(selected().frontLayout,'matchLabel'),value=$(id).value;
      if(value)style[key]=value;
      else delete style[key];
      $('typeMatchHeadingAuto').disabled=!style.color;
      changed();
    };
  }
  $('typeMatchHeadingAuto').onclick=()=>{
    delete text(selected().frontLayout,'matchLabel').color;
    changed();renderType();
  };
  $('addVillainSubtype').onclick=()=>{
    const field=$('newVillainSubtype'),name=field.value.trim();
    if(!name)return;
    state.villainSubtypes=game.villainSubtypeOptions({...state,villainSubtypes:[...state.villainSubtypes,name]});
    field.value='';changed();renderType();
  };
  window.MNC_refreshTypeDesigner=renderType;
  window.MNC_openTypeDesigner=id=>{
    $('typeDesignProfile').value=model.profiles().some(profile=>profile.id===id)?id:'other';
    $('typePreviewCard').value=current()&&model.matching(current(),id)?currentId:'';tab('typeDesigner');
  };
  $('typeDesignProfile').onchange=renderType;$('typePreviewCard').onchange=paintType;
  $('typeDesignRule').oninput=()=>{selected().ruleMode='custom';selected().ruleText=$('typeDesignRule').value;$('typeDesignRuleMode').value='custom';changed();};
  $('typeDesignRuleMode').onchange=()=>{
    selected().ruleMode=$('typeDesignRuleMode').value;
    if(selected().ruleMode==='custom'&&!selected().ruleText)selected().ruleText=model.original($('typeDesignProfile').value);
    changed();renderType();
  };
  $('typeRestoreRule').onclick=()=>{selected().ruleMode='default';selected().ruleText='';changed();renderType();};
  $('typeDesignColor').oninput=()=>{
    const id=$('typeDesignProfile').value;state.typeOverrides[id]={...state.typeOverrides[id],color:$('typeDesignColor').value};changed();
  };
  $('typeHeaderSubtype').onchange=()=>{
    const layout=selected().frontLayout,value=$('typeHeaderSubtype').value;
    if(!value)delete layout.showCharacterSubtype;
    else layout.showCharacterSubtype=value==='true';
    changed();
  };
  $('typeOpenSymbols').onclick=()=>window.MNC_openTypeStandard($('typeDesignProfile').value,'colors');
  $('typeOpenCard').onclick=()=>{
    const id=$('typePreviewCard').value||state.cards.find(card=>model.matching(card,$('typeDesignProfile').value))?.id;
    if(id)window.MNC_openStudioCard(cardById(id));else $('typeDesignStatus').textContent='Create or link a named card in Set Designer first.';
  };
  $('typeOpenLayout').onclick=()=>{
    const id=$('typeDesignProfile').value;
    const card=cardById($('typePreviewCard').value)||state.cards.find(card=>!card.catalogUnlisted&&model.matching(card,id));
    if(card){currentId=card.id;tab('layoutDesigner');}
    else window.MNC_editTypeStarter(id);
  };
  $('typeApplyFormatting').onclick=()=>{
    const cards=state.cards.filter(card=>model.matching(card,$('typeDesignProfile').value));
    cards.forEach(card=>model.clearType(card.frontLayout));changed();
    $('typeDesignStatus').textContent=cards.length+' cards now follow this type’s text and matchup formatting.';
  };
  bindAttributes('typeAttr',()=>selected().frontLayout,()=>previewCard($('typeDesignProfile').value));
  bindCopy('typeCopy',()=>selected().frontLayout);
  bindAttributes('cardAttr',()=>current()&&front.editable(current()),current);
  bindCopy('cardCopy',()=>front.editable(current()));

  function syncWriting(c) {
    $('cardTypeRuleMode').value=['custom','hidden'].includes(c.typeRuleMode)?c.typeRuleMode:'inherit';
    $('cardTypeRuleText').disabled=c.typeRuleMode!=='custom';
    $('cardTypeRuleText').value=c.typeRuleMode==='custom'?c.typeRuleText||'':game.categoryRule(c,state.cards,state);
    for(const [id,key] of [['showPower','showPower'],['showQuote','showQuote'],['showTiming','showTiming']])setValue(id,c[key]!==false);
    $('ruleTitle').value=c.ruleTitle||'';$('ruleText').value=c.ruleText??c.effectText??'';$('gameQuote').value=c.quote??c.lore??'';
    const timings=game.roles[c.family]?.timing||['On reveal','After matchup','End of round','Passive','Before final scoring'];
    dropDownOptions($('gameTiming'),[['','No timing'],...Array.from(new Set([...timings,...(c.timing?[c.timing]:[])])).map(timing=>[timing,game.timingLabel(timing)])],c.timing||'');
    $('cardAttributes').hidden=c.family!=='Character';
    syncAttributes('cardAttr',c);syncCopy('cardCopy',c);
    setValue('cardAttrX',front.offset(c,'match').x);setValue('cardAttrY',front.offset(c,'match').y);
    const layout=front.effective(c);$('showIcons').checked=layout.matchIcons??c.showIcons!==false;$('showMatchupNames').checked=layout.matchNames??c.showMatchupNames!==false;
    if(!game.isGameCard(c)){
      const fits=copyFits(c);
      $('ruleFit').textContent=fits?'':'The text reaches the metadata area. Try smaller text or shorter copy.';
    }
  }

  for(const [id,key] of [['ruleTitle','ruleTitle'],['ruleText','ruleText'],['gameQuote','quote'],['gameTiming','timing'],['showPower','showPower'],['showQuote','showQuote'],['showTiming','showTiming']]){
    const node=$(id);node[node.type==='checkbox'||id==='gameTiming'?'onchange':'oninput']=()=>{
      const c=current();if(!c)return;
      const value=node.type==='checkbox'?node.checked:node.value,fields={[key]:value};
      if(key==='ruleText')fields.effectText=value;if(key==='quote')fields.lore=value;
      editCardFields(c,fields);changed();
    };
  }
  $('cardTypeRuleMode').onchange=()=>{
    const c=current(),mode=$('cardTypeRuleMode').value;if(!c)return;
    const text=c.typeRuleText??game.categoryRule({...c,typeRuleMode:'inherit'},state.cards,state);
    editCardFields(c,{typeRuleMode:mode,...(mode==='custom'?{typeRuleText:text}:{})});changed();syncWriting(c);
  };
  $('cardTypeRuleText').oninput=()=>{if(current()){editCardFields(current(),{typeRuleText:$('cardTypeRuleText').value,typeRuleMode:'custom'});changed();}};
  const openType=()=>window.MNC_openTypeDesigner(model.idFor(current()));
  for(const id of ['typeManageFromCard','cardEditTypeRule','cardEditStandard'])$(id).onclick=openType;
  $('setEditGroupStyle').onclick=()=>window.MNC_openTypeDesigner($('setGroup').value);
  $('cardCopyReset').onclick=()=>{
    const c=current();if(!c)return;const layout=front.editable(c);
    for(const id of ['typeRule','rule','ruleTitle','timing','quote'])delete layout.text[id];
    for(const id of ['typeRule','rule','quote'])delete layout.offsets[id];changed();syncCopy('cardCopy',c);
  };
  $('cardAttrReset').onclick=()=>{
    const c=current();if(!c)return;const layout=front.editable(c);
    model.matchKeys.forEach(key=>delete layout[key]);delete layout.text.matchLabel;delete layout.text.matchValue;delete layout.offsets.match;
    changed();syncWriting(c);
  };
  $('cardAttrStandard').onclick=()=>{
    const c=current(),id=model.idFor(c),profile=state.typeDesigns.profiles[id];if(!profile)return;
    const layout=front.effective(c);
    for(const key of model.matchKeys)if(Object.hasOwn(layout,key))profile.frontLayout[key]=clone(layout[key]);
    for(const key of ['matchLabel','matchValue'])if(layout.text[key])profile.frontLayout.text[key]=clone(layout.text[key]);
    if(layout.offsets.match)profile.frontLayout.offsets.match=clone(layout.offsets.match);
    $('cardAttrReset').onclick();
  };
  for(const [id,axis] of [['cardAttrX','x'],['cardAttrY','y']])$(id).oninput=$(id).onchange=()=>{
    const c=current(),value=readNumber($(id));if(!c||value===null)return;
    front.editable(c).offsets.match={...front.offset(c,'match'),[axis]:value};changed();
  };

  function syncFooter(c) {
    const layout=front.values(c),styles=layout.text||{};
    const shared=front.usesSharedFooter(c);
    $('cardFooterMode').value=shared?'shared':'custom';
    for(const id of ['footerPosition','footerNumberFormat','footerNumberBadge','footerNumberSize','footerNumberFont',
      'footerCollectionSize','footerMarkSize','footerPrintCode','footerPrintEdition','footerCenterPreset','footerRightPreset','footerUseAll'])$(id).disabled=shared;
    for(const [id,key,fallback] of [['footerPosition','footerPosition','right'],['footerNumberFormat','numberFormat','fraction'],['footerNumberBadge','numberBadge','none'],
      ['footerCreditMode','creditMode','byline'],['footerCreditAlign','creditAlign','left'],['footerCreditWidth','creditWidth',265],['footerMarkSize','setIcon',29]])setValue(id,layout[key]??fallback);
    setValue('footerNumberSize',styles.number?.size??36);setValue('footerNumberFont',styles.number?.font||'serif');
    setValue('footerCreditSize',styles.artist?.size??16);setValue('footerCollectionSize',styles.edition?.size??17);setValue('footerCreditFont',styles.artist?.font||'sans');
    for(const [id,key] of [['footerPrintCode','printCollectionCode'],['footerPrintEdition','printEdition'],['footerSeparator','footerRule']])setValue(id,layout[key]!==false);
    $('footerUseType').disabled=shared||!state.typeDesigns.profiles[model.idFor(c)];
  }
  $('cardFooterMode').onchange=()=>{
    const card=current();if(!card)return;
    front.setFooterMode(card,$('cardFooterMode').value);
    changed();syncFooter(card);
  };
  $('cardEditSharedFooter').onclick=()=>window.MNC_openSharedFooter({footerScope:'card'});
  for(const [id,key] of [['footerPosition','footerPosition'],['footerNumberFormat','numberFormat'],['footerNumberBadge','numberBadge'],
    ['footerCreditMode','creditMode'],['footerCreditAlign','creditAlign'],['footerCreditWidth','creditWidth'],['footerMarkSize','setIcon'],
    ['footerPrintCode','printCollectionCode'],['footerPrintEdition','printEdition'],['footerSeparator','footerRule']]){
    const node=$(id);node.oninput=node.onchange=()=>{
      const c=current();if(!c)return;const value=node.type==='number'?readNumber(node):node.type==='checkbox'?node.checked:node.value;
      if(value===null)return;front.editable(c)[key]=value;changed();
    };
  }
  for(const [id,fields,property] of [['footerNumberSize',['number'],'size'],['footerNumberFont',['number'],'font'],
    ['footerCreditSize',['artist','concept','actor','film','episode','artLabel'],'size'],['footerCollectionSize',['edition'],'size'],
    ['footerCreditFont',['artist','concept','actor','film','episode','artLabel','edition'],'font']]){
    $(id).oninput=$(id).onchange=()=>{
      const c=current(),value=$(id).type==='number'?readNumber($(id)):$(id).value;if(!c||value===null)return;
      for(const field of fields)text(front.editable(c),field)[property]=value;changed();
    };
  }
  $('footerCenterPreset').onclick=()=>{
    const c=current();if(!c)return;const layout=front.editable(c);
    Object.assign(layout,{footerPosition:'center',numberFormat:'fraction',numberBadge:'none'});
    Object.assign(text(layout,'number'),{size:36,font:'serif',style:'bold'});changed();syncFooter(c);
  };
  $('footerRightPreset').onclick=()=>{if(current()){front.editable(current()).footerPosition='right';changed();syncFooter(current());}};

  function applyFooter(all) {
    const c=current(),id=model.idFor(c),profile=state.typeDesigns.profiles[id];if(!c||front.usesSharedFooter(c)||!all&&!profile)return;
    const targets=state.cards.filter(card=>all||model.matching(card,id)),source=model.footer(front.effective(c));
    footerUndo={defaults:clone(state.footerDesign),profiles:Object.fromEntries(Object.entries(state.typeDesigns.profiles).map(([id,value])=>[id,model.footer(value.frontLayout)])),
      cards:targets.map(card=>[card.id,model.footer(card.frontLayout||{})])};
    if(all){state.footerDesign=source;for(const value of Object.values(state.typeDesigns.profiles))model.clearFooter(value.frontLayout);}
    else{model.clearFooter(profile.frontLayout);profile.frontLayout=model.merge(profile.frontLayout,source);}
    targets.forEach(card=>model.clearFooter(card.frontLayout));
    $('footerUndo').disabled=false;$('footerFormatStatus').textContent='Footer applied to '+targets.length+' cards.';
    changed();syncFooter(c);
  }
  $('footerUseAll').onclick=()=>applyFooter(true);$('footerUseType').onclick=()=>applyFooter(false);
  $('footerUndo').onclick=()=>{
    if(!footerUndo)return;state.footerDesign=footerUndo.defaults;
    for(const [id,previous] of Object.entries(footerUndo.profiles)){
      const value=state.typeDesigns.profiles[id];model.clearFooter(value.frontLayout);value.frontLayout=model.merge(value.frontLayout,previous);
    }
    for(const [id,previous] of footerUndo.cards){const c=cardById(id);if(c){model.clearFooter(c.frontLayout);c.frontLayout=model.merge(c.frontLayout,previous);}}
    footerUndo=null;$('footerUndo').disabled=true;$('footerFormatStatus').textContent='Restored the previous footer formatting.';changed();if(current())syncFooter(current());
  };
  const refresh=window.refreshStudio;
  window.refreshStudio=()=>{refresh();if(current()){syncWriting(current());syncFooter(current());}};
  if(current()){syncWriting(current());syncFooter(current());}
})();
