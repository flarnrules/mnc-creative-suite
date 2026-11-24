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

  const ashArt = {"id":"MNC-DEMO-ART","title":"Projection Room","originalFilename":"projection-room.png","dataURI":"data:image/png;base64,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","kind":"Demo artwork","credit":"Demo illustration","source":"Browser edition sample","accent":"#537190","w":720,"h":480};
  const ashman = {
    ...newFields(), id:'MNC-LX001', title:'Midnight Runner', sourceAssetId:ashArt.id,
    characterCategory:'Hero', gameType:'hero', artist:'Demo illustration',
    rarity:'Unassigned', fit:'cover', zoom:1, panX:0, panY:0, accent:ashArt.accent,
    ruleTitle:'After the credits', ruleText:'Once per match, replay this card after a draw.',
    foilRecipe:{mode:'None',strength:.45,scale:1,angle:0,mask:'art'}
  };

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
