'use strict';

globalThis.MNC_GAME = (() => {
  const release = 'Liquor Exchange 2026';
  const categories = [
    {id:'hero',name:'Hero',color:'#527ea2',glyph:'hero'},
    {id:'villain',name:'Villain',color:'#a45e51',glyph:'villain'},
    {id:'creature',name:'Creature',color:'#758658',glyph:'creature'},
    {id:'redshirt',name:'Redshirt',color:'#a46d73',glyph:'redshirt'},
    {id:'sidekick',name:'Sidekick',color:'#aa8956',glyph:'sidekick'}
  ];
  const creatures = [
    {id:'monster',name:'Monster',color:'#918649',glyph:'monster'},
    {id:'animal',name:'Animal',color:'#b18669',glyph:'animal'},
    {id:'ghost',name:'Ghost',color:'#8e7ca5',glyph:'ghost'},
    {id:'alien',name:'Alien',color:'#528e8b',glyph:'alien'}
  ];
  const core=['hero','villain','creature'];
  const winsOver={hero:'villain',villain:'creature',creature:'hero'};
  const redshirtRule='Play up to two Redshirts. Solo, draw with a lone Redshirt. A pair draws against Hero, Sidekick or another pair. Only the lead uses its special rule. A defeated pair counts as two losses.';
  const defeatLimit=3;
  const pair={id:'redshirt-pair',name:'Redshirt pair',category:'redshirt',pair:true};
  const linked={id:'sidekick-ready',name:'Sidekick (partner revealed)',category:'sidekick',linked:true};
  const profiles=[
    ...categories.filter(type=>core.includes(type.id)).map(type=>({...type,category:type.id})),
    ...creatures.map(type=>({...type,category:'creature',variant:type.id})),
    {...categories[3],name:'Lone Redshirt',category:'redshirt'},pair,
    {...categories[4],category:'sidekick'},linked
  ];
  const roles = {
    Character: {action:'Played in a round', timing:['On reveal','After matchup','End of round']},
    Critic: {action:'Player identity · passive buff', timing:['Passive']},
    Item: {action:'Single-use consumable', timing:['After matchup','Before final scoring']}
  };
  const timingLabel=value=>value==='Before final scoring'?'Before match ends':value;
  const golden = {
    title:'Golden Jupie',
    timing:'Before final scoring',
    ruleTitle:'Accept the award',
    ruleText:'To play, permanently give this copy to someone outside the match who accepts it. Then win the match immediately. If both players reveal one, neither transfers and play continues.',
    subtype:'Award',
    rarity:'Ultra Rare'
  };

  function role(card) {
    return Object.hasOwn(roles, card?.family) ? card.family : '';
  }

  const key=value=>String(value??'').trim().toLowerCase();
  const categoryFor=value=>categories.find(category=>category.id===key(value));
  const creatureFor=value=>creatures.find(creature=>creature.id===key(value));

  function paletteEntry(entry,overrides) {
    const edit=overrides?.[entry.id];
    return {...entry,color:/^#[\da-f]{6}$/i.test(edit?.color??'')?edit.color:entry.color};
  }

  function typeChart(overrides) {
    return categories.map(category=>paletteEntry(category,overrides));
  }

  function visualFor(card,overrides) {
    const category=categoryFor(card?.characterCategory);
    if(!category)return null;
    const creature=category.id==='creature'?creatureFor(card.characterType):null;
    return paletteEntry(creature||category,overrides);
  }

  function partnerRef(card) {
    return String(card.sidekickPartner??(MNC_CARD_METADATA.isLuigi(card)?'Mario':'')).trim();
  }

  function partnerFor(card, candidates) {
    const reference=key(partnerRef(card));
    if(!reference)return null;
    const possible=candidates.filter(other=>other?.family==='Character' && other!==card && (!card.id || key(other.id)!==key(card.id)));
    const match=possible.find(other=>key(other.catalogId)===reference||key(other.id)===reference);
    if(match)return match;
    const titles=possible.filter(other=>key(other.title)===reference);
    return titles.length===1?titles[0]:null;
  }

  function playProfile(play,revealed) {
    if(typeof play==='string')return profiles.find(type=>type.id===key(play));
    const cards=Array.isArray(play)?play:[play];
    if(cards.some(card=>card?.family!=='Character'))return null;
    if(cards.length===2){
      return cards.every(card=>key(card.characterCategory)==='redshirt') &&
        cards[0]!==cards[1] && (!cards[0].id || cards[0].id!==cards[1].id) ? pair:null;
    }
    if(cards.length!==1)return null;
    const [card]=cards;
    const category=key(card.characterCategory);
    if(category==='sidekick'&&partnerFor(card,revealed))return linked;
    const id=category==='creature'?creatureFor(card.characterType)?.id||category:category;
    return profiles.find(type=>type.id===id);
  }

  function redshirtAgainst(a,b) {
    if(b.category==='redshirt')return Number(!!a.pair)-Number(!!b.pair);
    if(!a.pair||b.category==='creature')return -1;
    return b.category==='villain'?1:0;
  }

  function sidekickAgainst(a,b) {
    if(b.category==='hero')return 0;
    if(a.linked && b.variant==='animal')return 1;
    if(a.linked && b.variant==='monster')return 0;
    return -1;
  }

  function compare(first,second,{firstRevealed=[],secondRevealed=[]}={}) {
    const a=playProfile(first,firstRevealed),b=playProfile(second,secondRevealed);
    if(!a||!b)return null;
    if(a.category===b.category&&a.category!=='redshirt')return 0;
    const special=a.category==='redshirt'?redshirtAgainst(a,b):
      b.category==='redshirt'?-redshirtAgainst(b,a):
      a.category==='sidekick'?sidekickAgainst(a,b):
      b.category==='sidekick'?-sidekickAgainst(b,a):null;
    return special===null?(winsOver[a.category]===b.category?1:-1):(special||0);
  }

  function countDefeats(first,second,result,firstSize=1,secondSize=1) {
    const firstLost=result===-1?firstSize:0;
    const secondLost=result===1?secondSize:0;
    const firstTotal=first+firstLost,secondTotal=second+secondLost;
    let winner='';
    if(firstTotal>=defeatLimit&&secondTotal>=defeatLimit)winner='draw';
    else if(firstTotal>=defeatLimit)winner='second';
    else if(secondTotal>=defeatLimit)winner='first';
    return {firstLost,secondLost,firstTotal,secondTotal,winner};
  }

  function matchupHeading(category) {
    const id=key(category);
    if(id==='redshirt')return ['BEATS · PAIR','BEATEN BY · PAIR'];
    if(id==='sidekick')return ['BEATS · BASE','BEATEN BY · BASE'];
    return ['BEATS','BEATEN BY'];
  }

  function matchups(category, chart=categories) {
    const id=key(category);
    const profile=id==='redshirt'?pair.id:id;
    const eligible=core.includes(id)?core:[...core,'redshirt'];
    const wins=[],losses=[];
    for(const other of eligible){
      const result=compare(profile,other);
      const type=chart.find(entry=>entry.id===other);
      if(!result||!type)continue;
      const entry=other==='redshirt'?{...type,name:'Lone Redshirt'}:type;
      (result===1?wins:losses).push(entry);
    }
    return {wins,losses};
  }

  function categoryRule(card, cards=[],project) {
    let text='';
    if(card?.family==='Character'&&key(card.characterCategory)==='redshirt')text=redshirtRule;
    if(card?.family==='Character'&&key(card.characterCategory)==='sidekick'){
      const partner=partnerFor(card,cards)?.title||partnerRef(card);
      text='Draw against Hero, Sidekick or a Redshirt pair.'+
        (partner?' If you revealed '+partner+' earlier this match, beat Animal and draw with Monster.':'');
    }
    return project&&globalThis.MNC_TYPE_DESIGN?MNC_TYPE_DESIGN.rule(project,card,text):text;
  }

  function migrateCharacter(card) {
    if(card.family!=='Character')return card;
    if(card.characterCategory)return card;
    const old=key(card.gameType);
    if(old==='monster')return {...card,characterCategory:'Creature',characterType:card.characterType||'Monster'};
    if(core.includes(old))return {...card,characterCategory:categoryFor(old).name};
    return card;
  }

  function newFields(family = 'Character') {
    return {
      family, template:'Game Frame', gameType:'', characterCategory:'', characterType:'', characterSubtype:'', quote:'',
      useTypeColor:true, timing:roles[family].timing[0], ruleTitle:'', ruleText:'',
      episode:'', picker:'', film:'', artistFirst:'', artistLast:'', collectorNumber:'',
      setGlyph:'🍸', setGlyphAsset:'', edition:'01', set:release,artworkProfile:'standard',
      typeSymbolMode:'standard',collectionSymbolMode:'standard',
      artShape:'marquee', artRadius:31, artBorder:'solid', nameplate:'solid',
      frameStyle:'double', frameWidth:13, frameRadius:27, artHeight:52,
      artInset:6, surface:'ink', frameColor:'#b8a788',
      showIcons:true,showMatchupNames:true,roleSubtype:'',releaseReady:false
    };
  }

  function changeRole(card, family) {
    const defaults = newFields(family);
    card.family = family;
    card.parentFamily = family==='Critic' ? 'Member' : null;
    if (!roles[family].timing.includes(card.timing)) card.timing = defaults.timing;
  }

  const {artwork:ashArt,card:starterCard}=globalThis.MNC_EDITION.gameSeed;
  const ashman={...newFields(),...starterCard};

  function isGameCard(card) {
    return !!role(card) && ['Game Frame','Game Full Art'].includes(card.template);
  }

  function readyIssues(card, cards) {
    const issues = [];
    if (!role(card)) issues.push('Choose a role');
    if (!card.title?.trim()) issues.push('Add a title');
    if (!card.sourceAssetId) issues.push('Choose artwork');
    if(card.family==='Character'){
      const category=categoryFor(card.characterCategory);
      if(!category)issues.push('Choose a Character category');
      if(category?.id==='creature'&&!card.characterType?.trim())issues.push('Choose a Creature type');
      if(category?.id==='sidekick'&&(!partnerRef(card)||[card.id,card.catalogId,card.title].some(value=>key(value)===key(partnerRef(card)))))issues.push('Choose a different Character as the Sidekick’s partner');
    }
    if(card.ruleText?.trim()&&!card.timing)issues.push('Set the rule timing');
    const rule = normalizeRule(card.ruleText);
    if (!rule) issues.push('Write the card’s unique rule');
    if (rule&&cards.some(other => other.id!==card.id && isGameCard(other) && normalizeRule(other.ruleText)===rule)) issues.push('Rule text is shared with another card');
    if (!card.collectorNumber?.trim()) issues.push('Assign a card number');
    else if (cards.some(other => other.id!==card.id && isGameCard(other) && (card.collectionId?other.collectionId===card.collectionId:other.set===card.set) &&
      cardNumberKey(other.collectorNumber)===cardNumberKey(card.collectorNumber))) issues.push('Card number is shared within this set');
    return issues;
  }

  function normalizeRule(value) {
    return String(value??'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }

  function cardNumberKey(value) {
    const number = String(value??'').trim();
    return /^\d+$/.test(number) ? String(Number(number)) : number.toLowerCase();
  }

  return {categories,creatures,core,profiles,roles,timingLabel,defeatLimit,countDefeats,golden,release,redshirtRule,ashArt,ashman,typeChart,visualFor,paletteEntry,
    categoryFor,creatureFor,categoryRule,migrateCharacter,role,matchups,matchupHeading,compare,partnerFor,partnerRef,
    newFields,changeRole,isGameCard,readyIssues};
})();
