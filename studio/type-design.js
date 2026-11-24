'use strict';

globalThis.MNC_TYPE_DESIGN = (() => {
  const profiles=()=>[...MNC_SET_PLAN.definitions,MNC_SET_PLAN.profile('creature')];
  const idFor=card=>MNC_SET_PLAN.profileFor(card);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const matchKeys=['matchLayout','matchOrder','matchLabels','matchIcons','matchNames','matchStyle','matchColor','matchOpacity','matchGap','matchIcon','matchIconX','matchIconY','winLabel','lossLabel'];
  const footerKeys=['footerPosition','numberFormat','numberBadge','creditMode','creditAlign','creditLabel','creditWidth','setIcon','setIconX','setIconY','printCollectionCode','printEdition','footerRule'];
  const footerText=['artist','concept','actor','film','episode','edition','number','artLabel'];
  const footerOffsets=['artist','footer','number','episodeBadge'];
  const typeText=['typeRule','rule','ruleTitle','timing','quote','matchLabel','matchValue','headerSubtype'];
  const typeOffsets=['match','typeRule','rule','quote'];

  function restore(project) {
    const previous=project.typeDesigns?.profiles||{};
    project.typeDesigns={version:1,profiles:Object.fromEntries(profiles().map(profile=>{
      const value=previous[profile.id]||{};
      return [profile.id,{ruleMode:['custom','hidden'].includes(value.ruleMode)?value.ruleMode:'default',
        ruleText:String(value.ruleText||'').slice(0,4000),frontLayout:MNC_FRONT.settings(value.frontLayout)}];
    }))};
    project.footerDesign=MNC_FRONT.settings(project.footerDesign);
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
    return merge(project.footerDesign,...chain(project,card).map(profile=>profile.frontLayout),card.frontLayout);
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

  return {profiles,idFor,matching,restore,merge,layout,rule,original,footer,clearFooter,clearType,matchKeys,typeText,typeOffsets};
})();
