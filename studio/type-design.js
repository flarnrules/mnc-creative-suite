'use strict';

globalThis.MNC_TYPE_DESIGN = (() => {
  const profiles=()=>[...MNC_SET_PLAN.definitions,MNC_SET_PLAN.profile('creature')];
  const idFor=card=>MNC_SET_PLAN.profileFor(card);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const matchKeys=['matchLayout','matchOrder','matchLabels','matchIcons','matchNames','matchStyle','matchColor','matchOpacity','matchGap','matchIcon','matchIconX','matchIconY','winLabel','lossLabel'];
  const footerKeys=['footerPosition','independentFooter','numberFormat','numberBadge','creditMode','creditAlign','creditLabel','creditWidth','setIcon','setIconX','setIconY','printCollectionCode','printEdition','footerRule'];
  const footerText=['artist','concept','actor','film','episode','edition','number','artLabel'];
  const footerOffsets=['artist','footer','number','episodeBadge'];
  const typeText=['typeRule','rule','ruleTitle','timing','quote','matchLabel','matchValue','headerSubtype'];
  const typeOffsets=['match','typeRule','rule','quote'];
  const paletteFields=['mainColor','borderColor','accent'];

  function normalizePalette(value) {
    return Object.fromEntries(paletteFields.filter(key=>MNC_FRONT.hex(value?.[key])).map(key=>[key,value[key].toLowerCase()]));
  }

  function setColor(card,key,color) {
    if(!MNC_FRONT.hex(color))return;
    card[key]=color;
    if(key==='mainColor'){
      if(!MNC_GAME.isGameCard(card)&&card.template!=='Standard'&&!card.layoutDesign?.background){
        MNC_LAYOUT.replaceBackground(card,{mode:'solid',color});
      }else MNC_LAYOUT.backgroundStart(card,color);
    }
    if(key==='borderColor'){
      const stops=MNC_LAYOUT.get(card,'border')?.gradient?.stops;
      if(stops?.length)stops.reduce((first,stop)=>stop.at<first.at?stop:first).color=color;
    }
    if(key==='accent')card.useTypeColor=false;
  }

  function applyPalette(card,palette) {
    for(const key of paletteFields)if(palette[key])setColor(card,key,palette[key]);
  }

  function palette(card) {
    const visual=MNC_GAME.isGameCard(card)?window.MNC_gamePalette(card):
      card.template==='Standard'?window.MNC_standardPalette(card):
      {base:card.template==='Archive'?'#ddd5c8':'#161a24',ink:'#ffffff',accent:card.accent};
    const background=card.layoutDesign?.background,edge=MNC_LAYOUT.get(card,'border')?.gradient;
    return {
      mainColor:background?.mode==='solid'?background.color:background?.gradient?
        MNC_FRONT_EFFECTS.firstColor(background.gradient):visual.sourceBase||visual.base,
      borderColor:edge?MNC_FRONT_EFFECTS.firstColor(edge):MNC_OUTER_BORDER.color(card),
      accent:visual.accent||visual.outer||card.accent||'#bbac8b',
      ink:visual.ink
    };
  }

  function restore(project) {
    const previous=project.typeDesigns?.profiles||{};
    project.typeDesigns={version:1,profiles:Object.fromEntries(profiles().map(profile=>{
      const value=previous[profile.id]||{};
      return [profile.id,{ruleMode:['custom','hidden'].includes(value.ruleMode)?value.ruleMode:'default',
        ruleText:String(value.ruleText||'').slice(0,4000),frontLayout:MNC_FRONT.settings(value.frontLayout)}];
    }))};
    project.footerDesign=MNC_FRONT.settings(project.footerDesign);
    project.sharedFooter=MNC_FRONT.sharedFooterSettings(project.sharedFooter);
    project.characterFooter=MNC_FRONT.sharedFooterSettings(project.characterFooter,'character');
  }

  function matching(card,id) {
    return !!id&&(idFor(card)===id||id==='creature'&&card.family==='Character'&&MNC_GAME.categoryFor(card.characterCategory)?.id==='creature');
  }

  function chain(project,card) {
    const result=[],id=idFor(card);
    if(card.family==='Character'&&MNC_GAME.categoryFor(card.characterCategory)?.id==='creature')result.push(project.typeDesigns?.profiles?.creature);
    if(id!=='creature')result.push(project.typeDesigns?.profiles?.[id]);
    return result.filter(Boolean);
  }

  function merge(...layouts) {
    const result={offsets:{},text:{}};
    for(const value of layouts.filter(Boolean)){
      const {offsets,text,...flat}=value;
      Object.assign(result,flat);
      for(const [id,point] of Object.entries(offsets||{}))result.offsets[id]={...result.offsets[id],...point};
      for(const [id,style] of Object.entries(text||{}))result.text[id]={...result.text[id],...style};
    }
    return result;
  }

  function layout(project,card) {
    const result=merge(project.footerDesign,...chain(project,card).map(profile=>profile.frontLayout),card.frontLayout);
    const mode=MNC_FRONT.footerMode(card);
    if(mode!=='custom'){
      const shared=MNC_FRONT.footerSettingsFor(project,mode);
      Object.assign(result,{footerPosition:shared.position,numberFormat:'fraction',numberBadge:'none',
        setIcon:shared.markSize,printCollectionCode:true,printEdition:false});
      const character=mode==='character';
      if(character)result.footerRule=true;
      delete result.offsets.number;
      result.text.edition={size:shared.codeSize,font:'system',style:'bold',align:character?'left':'right',...shared.text.edition};
      result.text.number={size:shared.numberSize,font:'serif',style:'bold',align:character?'left':shared.position,...shared.text.number};
    }else if(card.frontLayout?.independentFooter?.copiedShared){
      // These layers start from the shown shared footer. Older inherited text styles stay out of the copy.
      result.text.edition={...card.frontLayout.text?.edition};
      result.text.number={...card.frontLayout.text?.number};
    }
    return result;
  }

  function rule(project,card,fallback='') {
    if(card.typeRuleMode==='hidden')return '';
    if(card.typeRuleMode==='custom')return String(card.typeRuleText||'').trim();
    let text=fallback;
    for(const setting of chain(project,card)){
      if(setting.ruleMode==='hidden')text='';
      if(setting.ruleMode==='custom')text=setting.ruleText.trim();
    }
    const partner=MNC_GAME.partnerFor(card,project.cards)?.title||MNC_GAME.partnerRef(card)||'your partner';
    return text.replace(/\{partner\}/gi,partner);
  }

  function original(id) {
    if(id==='redshirt')return MNC_GAME.redshirtRule;
    if(id==='sidekick')return 'Draw against Hero, Sidekick or a Redshirt pair. If you revealed {partner} earlier this match, beat Animal and draw with Monster.';
    return '';
  }

  function selectedLayout(layout,keys,texts,offsets) {
    const result={offsets:{},text:{}};
    for(const key of keys)if(Object.hasOwn(layout,key))result[key]=copy(layout[key]);
    for(const key of texts)if(layout.text?.[key])result.text[key]=copy(layout.text[key]);
    for(const key of offsets)if(layout.offsets?.[key])result.offsets[key]=copy(layout.offsets[key]);
    return result;
  }

  function clear(layout,keys,texts,offsets) {
    if(!layout)return;
    for(const key of keys)delete layout[key];
    for(const key of texts)if(layout.text)delete layout.text[key];
    for(const key of offsets)if(layout.offsets)delete layout.offsets[key];
  }

  function footer(layout) {return selectedLayout(layout,footerKeys,footerText,footerOffsets);}
  function clearFooter(layout) {clear(layout,footerKeys,footerText,footerOffsets);}
  function clearType(layout) {clear(layout,[...matchKeys,'showCharacterSubtype'],typeText,typeOffsets);}

  return {profiles,idFor,matching,restore,merge,layout,rule,original,footer,clearFooter,clearType,matchKeys,typeText,typeOffsets,
    paletteFields,normalizePalette,palette,setColor,applyPalette};
})();
