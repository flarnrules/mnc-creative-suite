'use strict';

globalThis.MNC_SET_PLAN = (() => {
  const definitions = [
    {id:'critic',name:'Critics',family:'Critic',target:9,glyph:'🎤',choices:['🎤','📰','🗣','💬']},
    {id:'movie',name:'Films',family:'Movie',target:9,glyph:'🎞',choices:['🎞','🎥','🎬']},
    {id:'hero',name:'Heroes',family:'Character',category:'Hero',target:11,glyph:'⚔',choices:['⚔','🛡']},
    {id:'villain',name:'Villains',family:'Character',category:'Villain',target:11,glyph:'🦹',choices:['🦹','☠','😈','👹','🎯'],builtin:'villain'},
    {id:'monster',name:'Monsters',family:'Character',category:'Creature',type:'Monster',target:3,glyph:'👾',choices:['👾','👹'],builtin:'monster'},
    {id:'ghost',name:'Ghosts',family:'Character',category:'Creature',type:'Ghost',target:3,glyph:'👻',choices:['👻','☠'],builtin:'ghost'},
    {id:'animal',name:'Animals',family:'Character',category:'Creature',type:'Animal',target:3,glyph:'🐕',choices:['🐕','🐾'],builtin:'animal'},
    {id:'alien',name:'Aliens',family:'Character',category:'Creature',type:'Alien',target:3,glyph:'👽',choices:['👽','🛸'],builtin:'alien'},
    {id:'redshirt',name:'Redshirts',family:'Character',category:'Redshirt',target:12,glyph:'☠',choices:['☠','👕'],builtin:'redshirt'},
    {id:'sidekick',name:'Sidekicks',family:'Character',category:'Sidekick',target:11,glyph:'🤝',choices:['🤝','🧑'],builtin:'sidekick'},
    {id:'meme',name:'Meme items',family:'Item',subtype:'Meme',target:7,glyph:'🗣',choices:['🗣','😂','💬']},
    {id:'weapon',name:'Weapon items',family:'Item',subtype:'Weapon',target:7,glyph:'🗡',choices:['🗡','💣','⚔']},
    {id:'shield',name:'Shield items',family:'Item',subtype:'Shield',target:7,glyph:'🛡',choices:['🛡','🪞']},
    {id:'other',name:'Other items',family:'Item',subtype:'Other',target:4,glyph:'◆',choices:['◆','🏆','🪞']}
  ];
  const auxiliaries = [
    {id:'creature',name:'Creature category',glyph:'◉',choices:['◉','👁'],builtin:'creature'},
    {id:'collection',name:'LX26 set mark',glyph:'🍸',choices:['🍸','✦']},
    {id:'telescope',name:'Telescope mark',glyph:'🔭',choices:['🔭']}
  ];
  const key=value=>String(value??'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const definition=id=>definitions.find(entry=>entry.id===id);
  const profile=id=>definition(id)||auxiliaries.find(entry=>entry.id===id);
  const aliases=globalThis.MNC_EDITION?.setAliases||{};
  const names=globalThis.MNC_EDITION?.setNames||{};

  function profileFor(card) {
    if(card?.family==='Character'){
      const category=MNC_GAME.categoryFor(card.characterCategory);
      if(!category)return '';
      if(category.id==='creature')return MNC_GAME.creatureFor(card.characterType)?.id||'creature';
      return category.id;
    }
    if(card?.family==='Item')return definitions.find(entry=>entry.family==='Item'&&key(entry.subtype)===key(card.roleSubtype||card.subtype))?.id||'other';
    return definitions.find(entry=>entry.family===card?.family)?.id||'';
  }

  function groupFor(card) {
    const planned=definition(card?.itemSetGroup);
    if(card?.family==='Item'&&planned?.family==='Item')return planned.id;
    return profileFor(card);
  }

  function eligible(card,collection) {
    return !!card&&!card.catalogUnlisted&&card.classification!=='Secret'&&MNC_CARD_METADATA.isPromo(card,collection);
  }

  function matching(cards,name,group,collections) {
    const expected=key(name),accepted=new Set([expected,...(aliases[expected]||[])]);
    const found=cards.filter(card=>eligible(card,collections?.[card.collectionId])&&groupFor(card)===group&&accepted.has(key(card.title)));
    return found.length===1?found[0]:null;
  }

  function fresh(project) {
    return {version:1,code:'LX26',name:'Liquor Exchange 2026',target:100,edition:'01',
      groups:definitions.map(group=>({id:group.id,target:group.target,slots:Array.from({length:group.target},(_,i)=>{
        const name=names[group.id]?.[i]||'',card=name&&matching(project.cards,name,group.id,project.catalogCollections);
        return {id:group.id+'-'+String(i+1).padStart(3,'0'),name,cardId:card?.id||''};
      })}))};
  }

  function restore(project) {
    const previous=project.setPlan;
    if(!previous||previous.version!==1){project.setPlan=fresh(project);return;}
    const groups=definitions.map(group=>{
      const prior=previous.groups?.find(entry=>entry.id===group.id)||{};
      const target=count(prior.target,group.target);
      const seen=new Set();
      const slots=(Array.isArray(prior.slots)?prior.slots:[]).slice(0,300).map((slot,i)=>{
        const id=group.id+'-'+String(i+1).padStart(3,'0');
        const cardId=typeof slot.cardId==='string'&&!seen.has(slot.cardId)?slot.cardId:'';
        if(cardId)seen.add(cardId);
        return {id,name:String(slot.name??'').slice(0,96),cardId};
      });
      while(slots.length<target)slots.push({id:group.id+'-'+String(slots.length+1).padStart(3,'0'),name:'',cardId:''});
      return {id:group.id,target,slots};
    });
    project.setPlan={version:1,code:'LX26',name:String(previous.name||'Liquor Exchange 2026').slice(0,96),
      target:count(previous.target,100,1),edition:String(previous.edition||'01').slice(0,14),groups};
  }

  function count(value,fallback=0,min=0) {
    return Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=300?Number(value):fallback;
  }

  function totals(plan) {
    const summary={planned:0,Character:0,Critic:0,Movie:0,Item:0,Creature:0};
    for(const group of plan.groups){
      const info=definition(group.id);
      summary.planned+=group.target;
      summary[info.family]+=group.target;
      if(info.category==='Creature')summary.Creature+=group.target;
    }
    return summary;
  }

  function resize(group,quantity) {
    group.target=count(quantity,group.target);
    while(group.slots.length<group.target)group.slots.push({
      id:group.id+'-'+String(group.slots.length+1).padStart(3,'0'),name:'',cardId:''
    });
  }

  function slots(plan,{includeOverflow=false}={}) {
    let number=0;
    return plan.groups.flatMap(group=>group.slots.slice(0,includeOverflow?group.slots.length:group.target).map((slot,index)=>({
      ...slot,group:group.id,number:index<group.target?++number:0,overflow:index>=group.target
    })));
  }

  function issueFor(plan,cards,collections) {
    const seen=new Set(),issues=[];
    for(const slot of slots(plan)){
      if(!slot.cardId)continue;
      if(seen.has(slot.cardId))issues.push('A card is linked to more than one slot.');
      seen.add(slot.cardId);
      const card=cards.find(item=>item.id===slot.cardId);
      if(!card)issues.push('A linked card is missing from the project.');
      else if(!eligible(card,collections?.[card.collectionId])||groupFor(card)!==slot.group)issues.push(card.title+' is outside its planned group.');
    }
    if(totals(plan).planned!==plan.target)issues.push('Planned quantities must total '+plan.target+' before assigning all numbers.');
    return [...new Set(issues)];
  }

  return {definitions,auxiliaries,definition,profile,profileFor,groupFor,eligible,matching,fresh,restore,resize,slots,totals,issueFor};
})();
