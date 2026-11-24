'use strict';

globalThis.MNC_CATALOG = (() => {
  const schema=MNC_CATALOG_SCHEMA, game=MNC_GAME;
  const metadata=MNC_CARD_METADATA;
  const normalize=value=>String(value??'').trim().toLowerCase();
  const cardId=value=>String(value??'').trim().toUpperCase();
  const validId=/^[A-Z0-9][A-Z0-9._-]{0,63}$/;
  const validArt=/\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i;
  const artPath=value=>normalize(value).replaceAll('\\','/').replace(/^assets\//,'');
  const filenameFor=asset=>asset.diskPath?.replace(/^assets\//i,'')||asset.originalFilename||'';
  const nameKey=value=>normalize(value).replace(/[^\p{L}\p{N}]+/gu,'');

  const numberKey=number=>/^\d+$/.test(number)?number.replace(/^0+(?=\d)/,''):normalize(number);
  const option=(value,options)=>options.find(x=>normalize(x)===normalize(value));
  const ignored={
    collections:new Set(['Regular logged','Secret logged']),
    cards:new Set(['Catalog check']),
    characters:new Set(['Name','Episode','Character check'])
  };

  function records(sheet,rows,issues) {
    const expected=schema.sheets[sheet];
    const headings=rows.find(row=>row.number===1)?.values||[];
    const names=headings.map(normalize);
    const offsets=new Map();
    for(const key of expected){
      if(ignored[sheet].has(key))continue;
      const positions=names.flatMap((name,i)=>name===normalize(key)?[i]:[]);
      if(positions.length!==1)issues.push(sheet+' needs one '+key+' column.');
      else offsets.set(key,positions[0]);
    }
    if(offsets.size<expected.length-ignored[sheet].size)return [];
    for(const key of schema.optionalColumns[sheet]||[]){
      const positions=names.flatMap((name,i)=>name===normalize(key)?[i]:[]);
      if(positions.length>1)issues.push(sheet+' needs only one '+key+' column.');
      else if(positions.length)offsets.set(key,positions[0]);
    }
    if(sheet==='characters'){
      const legacy=names.indexOf('matchup class');
      if(legacy>=0)offsets.set('Matchup class',legacy);
    }
    const read=[];
    for(const row of rows) {
      if(row.number===1)continue;
      const entry={row:row.number};
      let populated=false;
      for(const [name,index] of offsets) {
        const value=row.values[index];
        if(value&&typeof value==='object'&&Object.hasOwn(value,'error')) {
          issues.push(sheet+' row '+row.number+' has '+value.error+' in '+name+'.');
          continue;
        }
        const field=String(value??'').trim();
        if(field)populated=true;
        entry[name]=field;
      }
      if(populated)read.push(entry);
    }
    return read;
  }

  function unique(entries,key,label,issues) {
    const result=new Map();
    for(const row of entries){
      const id=cardId(row[key]);
      if(!validId.test(id)){
        issues.push(label+' row '+row.row+' needs a valid '+key+'.');
        continue;
      }
      if(result.has(id))issues.push(label+' row '+row.row+' repeats '+id+'.');
      else result.set(id,row);
    }
    return result;
  }

  function positive(value) {
    return /^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>0;
  }

  function workbookDate(value) {
    if(!value)return '';
    if(/^\d+(?:\.\d+)?$/.test(value)){
      const days=Number(value);
      if(days>=61&&days<=2958465)return new Date(Date.UTC(1899,11,30)+Math.floor(days)*86400000).toISOString().slice(0,10);
      return '';
    }
    if(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)){
      const date=new Date(value.slice(0,10)+'T00:00:00Z');
      if(Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value.slice(0,10))return value.slice(0,10);
    }
    return '';
  }

  function parse(sheets,project) {
    const errors=[],warnings=[];
    const releases=unique(records('collections',sheets.collections,errors),'Collection ID','collections',errors);
    const cards=unique(records('cards',sheets.cards,errors),'Card ID','cards',errors);
    const characters=unique(records('characters',sheets.characters,errors),'Card ID','characters',errors);
    const collections=Object.create(null);
    if(!releases.size)errors.push('Add a collection to collections.');
    if(!cards.size)errors.push('Add a card to cards.');
    for(const [id,row] of releases){
      const label='collections row '+row.row;
      if(!row['Collection name']||!row['Set name'])errors.push(label+' needs a collection name and set name.');
      const releaseDate=workbookDate(row['Release date']);
      if(row['Release date']&&!releaseDate)errors.push(label+' needs an Excel date or YYYY-MM-DD release date.');
      const readCount=(key,optional=false)=>{
        const value=row[key];
        if(!value&&optional)return null;
        if(!/^\d+$/.test(value)||Number(value)>9999){
          errors.push(label+' needs a whole-number '+key.toLowerCase()+'.');
          return 0;
        }
        return Number(value);
      };
      const regularTarget=readCount('Regular target');
      const code=metadata.normalizeCode(row['Collection code']);
      if(row['Collection code']&&!code)errors.push(label+' needs a collection code of up to 12 letters, digits or hyphens.');
      const familyTargets=Object.fromEntries(['Character','Critic','Movie','Item'].map(family=>[family,readCount(family+' target')]));
      if(regularTarget!==Object.values(familyTargets).reduce((sum,n)=>sum+n,0))errors.push(label+' regular target must equal the four family targets.');
      collections[id]={
        id,name:row['Collection name'],setName:row['Set name'],releaseDate,
        ...(code?{code}:{}),
        glyph:row['Set glyph'],edition:row.Edition,regularTarget,familyTargets,secretTarget:readCount('Secret target',true)
      };
    }
    const roster=[];
    const setNumbers=new Set();
    for(const [id,row] of cards) {
      const label='cards row '+row.row+' ('+id+')';
      const family=option(row.Family,schema.families);
      const classification=option(row.Classification,schema.classifications);
      const status=option(row.Status,schema.statuses);
      const rarity=row.Rarity?option(row.Rarity,schema.rarities):'Unassigned';
      const collectionId=cardId(row['Collection ID']);
      const collection=collections[collectionId];
      if(!collection)errors.push(label+' references an unknown collection.');
      if(!row.Name||!family||!classification||!status||!rarity)errors.push(label+' needs a name and valid family, classification, status and rarity.');
      const collectorNumber=row['Set card number'];
      if(collectorNumber) {
        if(collectorNumber.length>12)errors.push(label+' needs a set number of at most 12 characters.');
        const key=collectionId+'|'+numberKey(collectorNumber);
        if(setNumbers.has(key))errors.push(label+' repeats a set number in '+collectionId+'.');
        setNumbers.add(key);
        if(classification==='Regular'&&metadata.isPromo({collectionId},collection)&&!metadata.promoNumber(collectorNumber)){
          warnings.push(label+' has an LX26 number outside 001–100.');
        }
      }
      const episode=row.Episode;
      if(episode&&!positive(episode))errors.push(label+' needs a positive whole-number episode.');
      const artworkFilename=row['Artwork filename'];
      if(artworkFilename&&(!validArt.test(artworkFilename)||artPath(artworkFilename).split('/').some(part=>
        !part||part==='.'||part==='..'||/[:\u0000-\u001f]/.test(part)))){
        errors.push(label+' needs a filename or a path inside assets, including its extension.');
      }
      const timing=normalize(row.Timing)==='before match ends'?'Before final scoring':row.Timing;
      const timings=game.roles[family]?.timing||[];
      if(timing&&!option(timing,timings))errors.push(label+' has a timing that does not apply to '+(family||'this family')+'.');
      const creditType=option(row['Credit type'],metadata.creditTypes);
      const episodeBadge=option(row['Episode badge'],metadata.badgeTypes);
      if(row['Credit type']&&!creditType)errors.push(label+' needs Art or Actor in Credit type.');
      if(row['Episode badge']&&!episodeBadge)errors.push(label+' needs Auto, Cassette or None in Episode badge.');
      const conceptCredit=row['Concept credit'];
      if(conceptCredit?.length>96)errors.push(label+' needs a Concept credit of at most 96 characters.');
      const actorCredit=row['Actor credit'], typeIconGlyph=row['Type icon'];
      if(actorCredit?.length>96)errors.push(label+' needs an Actor credit of at most 96 characters.');
      if(typeIconGlyph?.length>24)errors.push(label+' needs a Type icon of at most 24 characters.');
      const legacyActor=creditType==='Actor'||(!creditType&&!actorCredit&&metadata.isLuigi({title:row.Name,family,episode,film:row.Film}));

      const character=characters.get(id);
      if(family==='Character'&&!character)errors.push(label+' needs one matching row on characters.');
      if(family!=='Character'&&character)errors.push('characters row '+character.row+' links to a '+family+' card.');
      const category=option(character?.Category,Object.keys(schema.characterGroups))||'';
      const characterType=character?.Type||'';
      if(character?.Category&&!category)errors.push('characters row '+character.row+' has an unknown category.');
      if(characterType&&!category)errors.push('characters row '+character.row+' needs a category for its type.');
      const oldClass=character?.['Matchup class']||'';
      const inherited=game.migrateCharacter({family,characterCategory:category,characterType,gameType:normalize(oldClass)});
      const sidekickPartner=character?.['Sidekick partner'];
      if(sidekickPartner){
        const partner=cards.get(cardId(sidekickPartner));
        if(sidekickPartner.length>80||cardId(sidekickPartner)===id||normalize(sidekickPartner)===normalize(row.Name)||
          (partner&&normalize(partner.Family)!=='character')){
          errors.push('characters row '+character.row+' needs a different Character as its Sidekick partner.');
        }
      }
      const text=family==='Character'?character?.Skill||'':row['Rule text'];
      const quote=family==='Character'?character?.Quote||'':row.Quote;
      if(family==='Character'&&(row['Rule text']||row.Quote)){
        warnings.push(row.Name+' uses Skill and Quote from characters.');
      }
      if(status==='Ready'&&(!collectorNumber||!artworkFilename||(game.roles[family]&&(family!=='Character'&&!text||text&&!timing))||
        (family==='Character'&&(!inherited.characterCategory||(inherited.characterCategory==='Creature'&&!inherited.characterType))))){
        warnings.push(row.Name+' is marked Ready and still has missing fields.');
      }
      roster.push({
        id,collectionId,title:row.Name,family,classification,catalogStatus:status,rarity,
        collectorNumber,artist:row.Artist,artworkFilename,episode,
        film:row.Film,picker:row['Picked by'],roleSubtype:family==='Character'?'':row.Subtype,
        characterCategory:inherited.characterCategory,characterType:inherited.characterType,characterSubtype:character?.Subtype||'',
        ...(Object.hasOwn(row,'Credit type')||actorCredit?{creditType:creditType||(actorCredit?'Art':'')}:{}),
        ...(Object.hasOwn(row,'Episode badge')?{episodeBadge:episodeBadge||'Auto'}:{}),
        ...(Object.hasOwn(row,'Concept credit')?{conceptCredit}:{}),
        ...(Object.hasOwn(row,'Actor credit')?{actorCredit:actorCredit||(!legacyActor?'':undefined)}:{}),
        ...(Object.hasOwn(row,'Type icon')?{typeIconGlyph}:{}),
        ...(character&&Object.hasOwn(character,'Sidekick partner')?{sidekickPartner:sidekickPartner||null}:{}),
        gameType:normalize(oldClass),timing:option(timing,timings)||'',ruleTitle:row['Rule name'],
        ruleText:text,quote,notes:row.Notes
      });
    }
    for(const [id,row] of characters)if(!cards.has(id))errors.push('characters row '+row.row+' references '+id+', which is missing from cards.');
    return {collections,roster,errors,warnings};
  }

  function assetFor(filename,assets,priorId) {
    if(!filename)return {asset:null,ambiguous:false};
    const expected=artPath(filename);
    const hasFolders=expected.includes('/');
    const matches=assets.filter(asset=>hasFolders?asset.diskPath&&artPath(asset.diskPath)===expected:
      normalize(asset.originalFilename)===expected||normalize(asset.file?.split('/').at(-1))===expected);
    const permanent=matches.filter(asset=>asset.diskPath);
    const candidates=permanent.length?permanent:matches;
    const prior=candidates.find(asset=>asset.id===priorId);
    return {asset:prior||(candidates.length===1?candidates[0]:null),ambiguous:!prior&&candidates.length>1};
  }

  function namedArtwork(card,assets) {
    const files=assets.filter(asset=>asset.diskPath&&asset.kind!=='Glyph');
    const stem=asset=>asset.originalFilename.replace(/\.[^.]+$/,'');
    const id=normalize(card.catalogId||card.id);
    const byId=files.filter(asset=>normalize(stem(asset))===id);
    if(byId.length===1)return byId[0];
    if(byId.length>1)return null;
    const title=nameKey(card.title);
    if(!title||title==='untitled')return null;
    const byTitle=files.filter(asset=>nameKey(stem(asset))===title);
    return byTitle.length===1?byTitle[0]:null;
  }

  function matchExisting(project,record) {
    const exact=project.cards.find(card=>card.catalogId===record.id);
    if(exact)return exact;
    const ashmanTitle=['ashman','the ashman'].includes(normalize(record.title));
    if(record.collectionId===schema.promoId&&record.family==='Character'&&record.episode==='216'&&
      (ashmanTitle||normalize(record.artworkFilename)==='ashman.png')){
      const ashman=project.cards.find(card=>card.id===game.ashman.id&&!card.catalogId);
      if(ashman)return ashman;
    }
    const legacy=project.cards.find(card=>card.id===record.id&&!card.catalogId);
    if(legacy)return legacy;
    if(record.collectionId===schema.promoId&&record.family==='Item'&&normalize(record.title)==='golden jupie'){
      return project.cards.find(card=>card.conceptId==='golden-jupie'&&!card.catalogId);
    }
  }

  function plan(project,parsed) {
    const errors=[...parsed.errors],warnings=[...parsed.warnings];
    const changes=[];
    let retainedEdits=0;
    const used=new Set();
    for(const record of parsed.roster) {
      const current=matchExisting(project,record);
      if(current&&used.has(current.id))errors.push(record.title+' maps to a design already linked to another card.');
      if(current&&current.family!==record.family){
        warnings.push(record.title+' changes family. The layout will switch when the current template does not support the new family.');
      }
      if(current)used.add(current.id);
      if(current?.catalogEdits&&Object.keys(current.catalogEdits).length)retainedEdits++;
      const {asset,ambiguous}=assetFor(record.artworkFilename,project.assets,current?.sourceAssetId);
      if(ambiguous)warnings.push(record.title+' matches more than one artwork file. Choose the intended asset in Artwork.');
      else if(record.artworkFilename&&!asset&&!(current?.sourceAssetId&&artPath(current.artworkFilename)===artPath(record.artworkFilename)))warnings.push(record.title+' needs '+record.artworkFilename+' in Artwork.');
      if(current&&!current.catalogId&&(current.ruleText||current.effectText)&&(current.ruleText||current.effectText)!==record.ruleText){
        warnings.push(record.title+' has rule text in the existing design. Add it to the workbook to carry it forward.');
      }
      changes.push({record,current,asset});
    }
    if(retainedEdits)warnings.push(retainedEdits+' designs have edits from Card Designer. Choose whether to retain them.');
    const present=new Set(parsed.roster.map(card=>card.id));
    const unlisted=project.cards.filter(card=>card.catalogId&&!present.has(card.catalogId));
    if(unlisted.length)warnings.push(unlisted.length+' linked designs are absent from this workbook. Their layouts and print slots are retained as unlisted designs.');
    return {collections:parsed.collections,changes,unlisted,retainedEdits,errors,warnings:[...new Set(warnings)]};
  }

  function newDesign(record) {
    const family=record.family;
    const base=game.role(record) ? game.newFields(family) : {family,template:'Standard'};
    return {
      ...base,fit:'cover',zoom:1,panX:0,panY:0,accent:'#a79874',rarityGlyph:'',symbols:'',
      tags:[],foilRecipe:{mode:'None',strength:.45,scale:1,angle:0,mask:'art'}
    };
  }

  function nextProject(project,prepared,{useWorkbook=false}={}) {
    if(prepared.errors.length)throw Error('Resolve the workbook errors before importing.');
    const occupied=new Set(project.cards.map(card=>card.id));
    const byId=new Map(project.cards.map(card=>[card.id,card]));
    for(const card of prepared.unlisted)byId.set(card.id,{...card,catalogUnlisted:true,releaseReady:false});
    for(const {record,current,asset} of prepared.changes){
      const collection=prepared.collections[record.collectionId];
      const view=current?{...current}:newDesign(record);
      let id=current?.id||record.id;
      if(!current){
        let suffix=2;
        while(occupied.has(id))id=record.id+'-'+suffix++;
        occupied.add(id);
      }
      const {id:catalogId,...metadata}=record;
      const sameCredit=view.artist===record.artist;
      const sameFilename=current&&artPath(current.artworkFilename)===artPath(record.artworkFilename);
      const keepArt=current&&(!record.artworkFilename||sameFilename);
      const named=record.artworkFilename?null:namedArtwork({...record,catalogId:record.id},project.assets);
      const sourceAssetId=asset?.id||(keepArt?current?.sourceAssetId:'')||named?.id||'';
      const [artistFirst='',...artistParts]=record.artist.split(/\s+/);
      const workbookFields={
        ...metadata,sourceAssetId,
        parentFamily:record.family==='Critic'?'Member':null,
        set:collection.setName,setGlyph:collection.glyph,edition:collection.edition,
        releaseReady:record.catalogStatus==='Ready',
        artistFirst:sameCredit?view.artistFirst||artistFirst:artistFirst,
        artistLast:sameCredit?view.artistLast||artistParts.join(' '):artistParts.join(' '),
        lore:record.quote,effectText:record.ruleText,subtype:record.roleSubtype||record.characterSubtype
      };
      if(record.family==='Movie'&&!workbookFields.subtype&&record.episode)workbookFields.subtype='Episode '+record.episode;
      const catalogEdits=useWorkbook?{}:current?.catalogEdits||{};
      Object.assign(view,workbookFields,catalogEdits,{id,catalogId,catalogUnlisted:false,catalogEdits});
      if(useWorkbook){
        view.sourceAssetId=asset?.id||named?.id||'';
        view.artworkChosen=false;
      }else if(record.artworkFilename&&!sameFilename&&!Object.hasOwn(catalogEdits,'sourceAssetId')){
        view.artworkChosen=false;
      }
      if(view.family==='Critic')view.parentFamily='Member';
      else view.parentFamily=null;
      if(game.role(view)&&!game.isGameCard(view)&&(!current||current.family!==view.family))view.template='Game Frame';
      if(!game.role(view)&&['Game Frame','Game Full Art'].includes(view.template))view.template='Standard';
      if(record.family==='Item'&&normalize(record.title)==='golden jupie')view.conceptId='golden-jupie';
      byId.set(id,MNC_CARD_METADATA.migrate(view,collection));
    }
    return {...project,cards:[...byId.values()],catalogCollections:prepared.collections};
  }

  return {parse,plan,nextProject,assetFor,namedArtwork,filenameFor,schema};
})();
