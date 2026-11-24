'use strict';

globalThis.MNC_CARD_METADATA = (() => {
  const cassetteEpisodes = new Set([39,103]);
  const textKey = value => String(value??'').trim().toLowerCase();
  const titleKey = value => textKey(value).replace(/[^\p{L}\p{N}]/gu,'');
  const creditTypes = ['Art','Actor'];
  const badgeTypes = ['Auto','Cassette','None'];
  const promoCode='LX26';
  const promoTotal=100;
  const numberBlocks=[
    ['Villain',12],['Hero',12],['Creature',12],['Redshirt',8],['Sidekick',6],
    ['Critic',9],['Movie',20],['Item',21]
  ];
  const familyIcons={Character:'♟',Critic:'🎤',Movie:'🎬',Member:'👤',Item:'◆',
    Archive:'▤',Meme:'💬',Moment:'◷',Location:'⌖',Byline:'✎',Award:'🏆',Reaction:'💬',Artifact:'◆'};
  const codePattern=/^[A-Z0-9][A-Z0-9-]{0,11}$/;

  function cassetteEpisode(card) {
    const episode = String(card.episode??'').trim();
    const film = titleKey(card.film || (card.family==='Movie' ? card.title : ''));
    if (/^\d+$/.test(episode)) return cassetteEpisodes.has(Number(episode));
    return ['supermariobros','supermariobros1993','metropolis2001'].includes(film);
  }

  function isLuigi(card) {
    return card.family==='Character' && textKey(card.title)==='luigi' &&
      (Number(card.episode)===103 || ['supermariobros','supermariobros1993'].includes(titleKey(card.film)));
  }

  function creditType(card) {
    return creditTypes.find(type=>type===card.creditType) || (isLuigi(card)?'Actor':'Art');
  }

  function hasCassette(card) {
    if (card.episodeBadge==='Cassette') return true;
    if (card.episodeBadge==='None') return false;
    return cassetteEpisode(card);
  }

  function normalizeCode(value) {
    const code=String(value??'').trim().toUpperCase();
    return codePattern.test(code)?code:'';
  }

  function collectionCode(card,collection) {
    const code=normalizeCode(card.collectionCode)||normalizeCode(collection?.code);
    if(code)return code;
    const promo=['le26p','lx26'].includes(textKey(card.collectionId))||
      (!card.collectionId&&(/^mnc-lx\d+$/i.test(card.id||'')||textKey(card.set).startsWith('liquor exchange 2026')));
    return promo?promoCode:'';
  }

  function isPromo(card,collection) {
    return collectionCode(card,collection)===promoCode;
  }

  function promoNumber(value,total=promoTotal) {
    const raw=String(value??'').trim(), number=Number(raw);
    return /^\d+$/.test(raw)&&number>=1&&number<=total?number:0;
  }

  const printNumber=number=>String(number).padStart(3,'0');

  function collectionParts(card,collection,total=0) {
    const code=collectionCode(card,collection);
    const promo=isPromo(card,collection);
    const base=card.classification!=='Secret';
    const target=total||promoTotal;
    const slot=promo&&base?promoNumber(card.collectorNumber,target):0;
    const assigned=String(card.collectorNumber??'').trim();
    const number=promo&&base?(slot?printNumber(slot):'TBD')+'/'+target:
      assigned&&base&&total?assigned+'/'+total:assigned;
    const rawEdition=String(card.edition||collection?.edition||'').trim();
    const edition=promo&&!/^\d+$/.test(rawEdition)?'01':rawEdition;
    const editionLabel=/^0*1$/.test(edition)?'1ST EDITION':
      /^\d+$/.test(edition)?'ED '+edition:edition.toUpperCase();
    return {code:code||card.collectionId||card.set||'',number,edition:editionLabel};
  }

  function collectionLine(card,collection,total=0) {
    const parts=collectionParts(card,collection,total);
    return [parts.code,parts.number,parts.edition].filter(Boolean).join(' · ');
  }

  function attribution(card) {
    const name=[card.artistFirst,card.artistLast].filter(Boolean).join(' ')||card.artist||'';
    const legacyActor=creditType(card)==='Actor';
    return {
      illustration:legacyActor?'':String(name).trim(),
      concept:String(card.conceptCredit??'').trim(),
      actor:String(card.actorCredit??(legacyActor?name:'')).trim(),
      film:String(card.film||(card.family==='Movie'?card.title:'')||'').trim(),
      episode:String(card.episode??'').trim().replace(/^ep(?:isode)?\.?\s+/i,''),
      picker:String(card.picker??'').trim()
    };
  }

  function customIcon(card) {
    if(Object.hasOwn(card,'typeIconGlyph'))return String(card.typeIconGlyph??'').trim();
    return ['icon','both'].includes(card.roleBadgeMode)?String(card.roleBadgeIcon??'').trim():'';
  }

  function defaultIcon(card) {
    if(card.family==='Item'){
      const title=titleKey(String(card.title??'').replace(/\s*\[variant\].*$/i,''));
      if(['oculusmirror','theoculusmirror'].includes(title))return '🪞';
      if(['sorcerer','thesorcerer'].includes(title)||titleKey(card.roleSubtype||card.subtype)==='bomb')return '💣';
    }
    return Object.hasOwn(familyIcons,card.family)?familyIcons[card.family]:'◆';
  }

  function numberPlan(cards,collections,project) {
    const target=project?.setPlan?.target||promoTotal;
    const numbered=new Map(), unnumbered=[], invalid=[];
    for(const card of cards){
      if(card.catalogUnlisted||card.classification==='Secret'||!isPromo(card,collections?.[card.collectionId]))continue;
      const number=promoNumber(card.collectorNumber,target);
      if(number){
        if(!numbered.has(number))numbered.set(number,[]);
        numbered.get(number).push(card);
      }else if(String(card.collectorNumber??'').trim())invalid.push(card);
      else unnumbered.push(card);
    }
    let number=0;
    const blocks=project?.setPlan?.groups?.map(group=>[MNC_SET_PLAN.definition(group.id).name,group.target])||numberBlocks;
    const slots=blocks.flatMap(([group,count])=>Array.from({length:count},()=>{
      number++;
      return {number,group,cards:numbered.get(number)||[]};
    }));
    return {slots,unnumbered,invalid};
  }

  function correctOculus(card) {
    if(card.family!=='Item'||titleKey(card.title)!=='oculusmirror')return card;
    const artist=titleKey(card.artist||[card.artistFirst,card.artistLast].filter(Boolean).join(' '));
    const outdated=['','rfeldman','ryan','ryanfeldman'].includes(artist);
    if(card.conceptCredit || (card.conceptCredit===''&&!outdated))return card;
    if(!outdated&&artist!=='staud')return card;
    const credits={artist:'Staud',artistFirst:'Staud',artistLast:'',creditType:'Art',conceptCredit:'Ryan'};
    return {...card,...credits,...(card.catalogId?{catalogEdits:{...card.catalogEdits,...credits}}:{})};
  }

  function migrate(card,collection) {
    card=correctOculus(card);
    if (!card.creditType && isLuigi(card)) card={...card,creditType:'Actor'};
    if (!cassetteEpisode(card) || card.setGlyphAsset ||
      String(card.setGlyph??'').replace(/\ufe0f/g,'').trim()!=='📼') return card;
    const glyph = collection?.glyph;
    const setGlyph = glyph && glyph.replace(/\ufe0f/g,'').trim()!=='📼' ? glyph : '✦';
    const episodeBadge=card.episodeBadge||'Cassette';
    const restored = {...card,episodeBadge,setGlyph};
    if (card.catalogEdits?.setGlyph!==undefined) {
      restored.catalogEdits={...card.catalogEdits,setGlyph};
    }
    return restored;
  }

  return {creditTypes,badgeTypes,creditType,isLuigi,hasCassette,normalizeCode,collectionCode,collectionLine,collectionParts,
    promoCode,promoTotal,isPromo,promoNumber,printNumber,numberPlan,attribution,customIcon,defaultIcon,migrate};
})();
