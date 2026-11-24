'use strict';

(() => {
  const planModel=MNC_SET_PLAN,symbols=MNC_SYMBOLS;
  const itemGroups=planModel.definitions.filter(group=>group.family==='Item');
  const current=()=>cardById(currentId);
  const plan=()=>state.setPlan;
  const canLink=card=>planModel.eligible(card,state.catalogCollections?.[card.collectionId]);
  const selectedGroup=()=>plan().groups.find(group=>group.id===$('setGroup').value)||plan().groups[0];
  const selectedProfile=()=>state.visualLanguage.profiles[$('symbolProfile').value];
  let previewRevision=0,chartRevision=0,cardRevision=0;

  function element(tag,text,className) {
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    if(className)node.className=className;
    return node;
  }

  function setStatus(id,message,error=false) {
    $(id).textContent=message;
    $(id).classList.toggle('mnc-error',error);
  }

  function changed() {
    persist();
    if(activeTab==='studio')drawStudioPreview();
    window.MNC_refreshSymbolContext?.();
  }

  const glyphOptions=()=>symbols.glyphAssets(state);

  function populateAssets(select,chosen) {
    dropDownOptions(select,symbols.imageOptions(state,chosen),chosen||'');
  }

  function openProfile(id) {
    $('symbolProfile').value=planModel.profile(id)?id:'other';
    tab('visualLanguage');
  }

  function renderCounts() {
    const totals=planModel.totals(plan());
    $('setPlanSummary').textContent=plan().code+' · '+plan().name+' · '+totals.planned+' planned / '+plan().target;
    $('setTarget').value=plan().target;
    $('setEdition').value=plan().edition;
    $('setPlanStats').replaceChildren(...[['Total',totals.planned],['Characters',totals.Character],['Items',totals.Item],['Critics',totals.Critic],['Films',totals.Movie]].map(([label,value])=>{
      const node=element('div',undefined,'set-stat');
      node.append(element('strong',String(value)),element('span',label));
      return node;
    }));
    const delta=plan().target-totals.planned;
    setStatus('setPlanBalance',delta===0?'The plan totals '+plan().target+' cards.':
      delta>0?delta+' slots left to allocate.':Math.abs(delta)+' slots over the set size.',delta!==0);
    const host=$('setGroupCounts');host.replaceChildren();
    for(const group of plan().groups){
      const row=element('tr'),info=planModel.definition(group.id);
      row.className=selectedGroup().id===group.id?'selected':'';
      const title=element('td'),open=element('button',info.name);
      open.type='button';open.onclick=()=>{$('setGroup').value=group.id;renderSet();};
      title.append(open);
      const quantity=element('td'),input=element('input');
      input.type='number';input.min='0';input.max='300';input.value=group.target;
      input.setAttribute('aria-label',info.name+' planned quantity');
      input.onchange=()=>{
        if(!Number.isInteger(input.valueAsNumber)||input.valueAsNumber<0||input.valueAsNumber>300){input.value=group.target;return;}
        planModel.resize(group,input.valueAsNumber);changed();renderCounts();renderSlots();
      };
      quantity.append(input);
      const named=group.slots.slice(0,group.target).filter(slot=>slot.name.trim()).length;
      row.append(title,quantity,element('td',String(named)));host.append(row);
    }
  }

  function makeDraft(slot,group) {
    let card=cardById(slot.cardId);
    if(card)return card;
    if(!slot.name.trim())throw Error('Enter a card name first.');
    const info=planModel.definition(group.id);
    const reused=planModel.matching(state.cards,slot.name,group.id,state.catalogCollections);
    if(reused){slot.cardId=reused.id;return reused;}
    const gameFields=game.roles[info.family]?game.newFields(info.family):{};
    card={...gameFields,id:uniqueId('MNC-LX',state.cards),title:slot.name.trim(),family:info.family,
      template:info.family==='Movie'?'Standard':'Game Frame',set:game.release,collectionCode:'LX26',
      collectorNumber:'',classification:'Regular',edition:plan().edition,artworkProfile:'standard',
      artist:'',sourceAssetId:'',rarity:'Unassigned',catalogStatus:'Draft',releaseReady:false,
      typeSymbolMode:'standard',collectionSymbolMode:'standard',setGlyph:'🍸',
      characterCategory:info.category||'',characterType:info.type||'',
      roleSubtype:info.subtype||'',parentFamily:info.family==='Critic'?'Member':null};
    const art=catalog.namedArtwork(card,state.assets);
    if(art)card.sourceAssetId=art.id;
    state.cards.push(card);slot.cardId=card.id;
    applyTypeDesignPreset(card,group.id);
    return card;
  }

  function slotRow(slot,index,group,overflow=false) {
    const row=element('tr');row.append(element('td',String(index+1)));
    const nameCell=element('td'),name=element('input');
    name.value=slot.name;name.maxLength=96;name.placeholder='Card name';
    name.setAttribute('aria-label',planModel.definition(group.id).name+' slot '+(index+1)+' name');
    name.onchange=()=>{
      slot.name=name.value.trim();
      const card=cardById(slot.cardId);
      if(card&&slot.name)editCardFields(card,{title:slot.name});
      changed();renderCounts();
    };
    nameCell.append(name);
    const linkCell=element('td'),select=element('select');
    const bound=new Set(planModel.slots(plan(),{includeOverflow:true}).filter(item=>item.id!==slot.id).map(item=>item.cardId));
    const available=state.cards.filter(card=>canLink(card)&&planModel.groupFor(card)===group.id&&(!bound.has(card.id)||card.id===slot.cardId));
    const choices=[['','Create when opened'],...available.map(card=>[card.id,card.title])];
    if(slot.cardId&&!available.some(card=>card.id===slot.cardId))choices.push([slot.cardId,'Linked card needs review']);
    dropDownOptions(select,choices,slot.cardId);
    select.setAttribute('aria-label','Linked design for '+(slot.name||'slot '+(index+1)));
    select.onchange=()=>{
      slot.cardId=select.value;
      const card=cardById(slot.cardId);
      if(card)slot.name=card.title;
      changed();renderCounts();renderSlots();
    };
    linkCell.append(select);
    const action=element('td'),open=element('button',overflow?'Open saved':'Open');open.type='button';
    open.onclick=()=>{
      try{
        const card=makeDraft(slot,group);
        if(slot.name&&card.title!==slot.name)editCardFields(card,{title:slot.name});
        changed();window.MNC_openStudioCard(card);
      }catch(error){setStatus('setActionStatus',error.message,true);}
    };
    action.append(open);row.append(nameCell,linkCell,action);return row;
  }

  function renderSlots() {
    const group=selectedGroup();
    const info=planModel.definition(group.id);
    $('setGroupTitle').textContent=info.name+' · '+group.target+' slots';
    $('itemSlotHelp').hidden=info.family!=='Item'||state.cards.some(card=>canLink(card)&&planModel.groupFor(card)===group.id);
    $('itemSlotHelp').textContent='To link an existing item, choose '+info.name+' under Item set group in Card Designer.';
    $('setSlotRows').replaceChildren(...group.slots.slice(0,group.target).map((slot,i)=>slotRow(slot,i,group)));
    const overflow=group.slots.slice(group.target).map((slot,i)=>({slot,index:i+group.target})).filter(({slot})=>slot.name||slot.cardId);
    $('setOverflow').hidden=!overflow.length;
    const table=element('table',undefined,'set-slots'),body=element('tbody');
    body.append(...overflow.map(({slot,index})=>slotRow(slot,index,group,true)));
    table.append(body);$('setOverflowRows').replaceChildren(table);
  }

  function selectSetGroup(id) {
    dropDownOptions($('setGroup'),plan().groups.map(group=>[group.id,planModel.definition(group.id).name]),id);
  }

  function renderSet() {
    selectSetGroup($('setGroup').value||'critic');
    renderCounts();renderSlots();
    if(!$('setNumbering').hidden)renderNumbering();
  }

  function renderNumbering() {
    const rows=planModel.slots(plan()),issues=planModel.issueFor(plan(),state.cards,state.catalogCollections);
    $('setNumberRows').replaceChildren(...rows.map(slot=>{
      const row=element('tr'),card=cardById(slot.cardId);
      row.append(...[MNC_CARD_METADATA.printNumber(slot.number),planModel.definition(slot.group).name,slot.name||'Open',card?.collectorNumber||'—'].map(text=>element('td',text)));
      return row;
    }));
    const linked=rows.filter(slot=>cardById(slot.cardId)).length;
    setStatus('setNumberWarning',issues.join(' ')||linked+' linked cards will receive the numbers shown.',!!issues.length);
    $('setApplyNumbers').disabled=!!issues.length||!linked;
  }

  $('setGroup').onchange=renderSet;
  $('setEditGroupStyle').onclick=()=>openProfile(selectedGroup().id);
  $('setTarget').onchange=()=>{
    const value=$('setTarget').valueAsNumber;
    if(!Number.isInteger(value)||value<1||value>300){$('setTarget').value=plan().target;return;}
    plan().target=value;changed();renderSet();
  };
  $('setEdition').onchange=()=>{plan().edition=$('setEdition').value.trim()||'01';changed();};
  $('setCreateNamed').onclick=()=>{
    let created=0;
    for(const group of plan().groups)for(const slot of group.slots.slice(0,group.target)){
      if(!slot.name.trim()||cardById(slot.cardId))continue;
      const before=state.cards.length;makeDraft(slot,group);created+=state.cards.length-before;
    }
    changed();renderSet();setStatus('setActionStatus',created+' drafts created.');
  };
  $('setNumberPreview').onclick=()=>{$('setNumbering').hidden=false;$('setNumbering').open=true;renderNumbering();};
  $('setApplyNumbers').onclick=()=>{
    if(planModel.issueFor(plan(),state.cards,state.catalogCollections).length)return;
    const rows=planModel.slots(plan()).filter(slot=>cardById(slot.cardId));
    const assigned=new Set(rows.map(slot=>slot.cardId));
    const proposed=new Set(rows.map(slot=>slot.number));
    const collision=state.cards.find(card=>canLink(card)&&!assigned.has(card.id)&&proposed.has(Number(card.collectorNumber)));
    if(collision){setStatus('setNumberWarning',collision.title+' already uses one of these numbers. Link it to a slot or edit its number first.',true);return;}
    if(!confirm('Assign the previewed numbers to '+rows.length+' linked cards?'))return;
    for(const slot of rows)editCardFields(cardById(slot.cardId),{collectorNumber:MNC_CARD_METADATA.printNumber(slot.number)});
    changed();renderNumbering();
  };
  $('setExportPlan').onclick=()=>downloadCSV('LX26_Set_Plan.csv',
    ['Group','Family','Planned','Slot','Proposed number','Card name','Card ID','Current number'],
    planModel.slots(plan()).map(slot=>{
      const group=plan().groups.find(item=>item.id===slot.group),info=planModel.definition(slot.group),card=cardById(slot.cardId);
      return {Group:info.name,Family:info.family,Planned:group.target,Slot:slot.id,
        'Proposed number':MNC_CARD_METADATA.printNumber(slot.number),'Card name':slot.name,'Card ID':card?.catalogId||card?.id||'','Current number':card?.collectorNumber||''};
    }));

  function symbolCanvases() {
    return [...MNC_SET_PLAN.definitions,...MNC_SET_PLAN.auxiliaries];
  }

  async function paintSymbol(canvas,symbol,id,size=canvas.width*.72) {
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    await symbols.draw(ctx,symbol,canvas.width/2,canvas.height/2,size,'#000000',id);
  }

  async function renderChart() {
    const token=++chartRevision,host=$('symbolChart');host.replaceChildren();
    const work=[];
    for(const profile of symbolCanvases()){
      const tile=element('button',undefined,'symbol-tile');tile.type='button';
      tile.classList.toggle('active',profile.id===$('symbolProfile').value);
      const canvas=element('canvas');canvas.width=canvas.height=144;
      canvas.setAttribute('aria-label',profile.name+' symbol');
      const setting=state.visualLanguage.profiles[profile.id];
      tile.append(canvas,element('span',profile.name),element('small',setting.presetId?'Saved design linked':'Symbol standard'));
      tile.onclick=()=>{$('symbolProfile').value=profile.id;$('symbolProfile').onchange();};
      host.append(tile);
      work.push(paintSymbol(canvas,symbols.profileSymbol(state,profile.id),profile.id));
    }
    await Promise.all(work);
    return token===chartRevision;
  }

  function syncSymbolEditor() {
    const id=$('symbolProfile').value,profile=planModel.profile(id),setting=selectedProfile();
    const symbol=symbols.profileSymbol(state,id);
    for(const [name,key] of [['symbolSource','source'],['symbolGlyph','glyph'],['symbolFont','font'],['symbolPresentation','presentation'],['symbolBackdrop','backdrop'],['symbolImageMode','imageMode']])$(name).value=symbol[key];
    $('symbolRemoveWhite').checked=symbol.removeWhite;
    $('symbolInkMode').value=symbol.color?'custom':'auto';$('symbolColor').value=symbol.color||'#000000';
    $('symbolColorRow').hidden=!symbol.color;
    $('symbolTextFields').hidden=symbol.source!=='text';
    $('symbolImageFields').hidden=symbol.source!=='image';
    populateAssets($('symbolAsset'),symbol.assetId);
    const suggestions=(profile.choices||[profile.glyph]).map(glyph=>{
      const button=element('button',symbols.presentation(glyph,'text'));button.type='button';
      button.style.fontFamily=symbols.fontStack(symbol);
      button.onclick=()=>{setting.symbol={...symbol,source:'text',glyph};changed();syncSymbolEditor();renderChart();};
      return button;
    });
    $('symbolCandidates').replaceChildren(...suggestions);
    dropDownOptions($('symbolPreset'),[['','No saved design'],...state.templates.map(preset=>[preset.id,preset.name])],setting.presetId);
    $('symbolDesignStatus').textContent=current()?'Selected card · '+current().title:'';
    previewSymbol();
  }

  async function previewSymbol() {
    const token=++previewRevision,id=$('symbolProfile').value,symbol=symbols.profileSymbol(state,id);
    await Promise.all([
      paintSymbol($('symbolLarge'),symbol,id),
      paintSymbol($('symbolSegoe'),{...symbol,source:'text',font:'Segoe UI Symbol'},id,95),
      paintSymbol($('symbolTimes'),{...symbol,source:'text',font:'Times New Roman'},id,95)
    ]);
    const status=await symbols.fontStatus(symbol.font);
    if(token===previewRevision)$('symbolFontStatus').textContent=status;
  }

  function renderLanguage() {
    dropDownOptions($('symbolProfile'),symbolCanvases().map(profile=>[profile.id,profile.name]),$('symbolProfile').value||'hero');
    syncSymbolEditor();renderChart();window.MNC_refreshSymbolContext?.({sync:true});
  }
  $('symbolProfile').onchange=()=>{syncSymbolEditor();renderChart();window.MNC_refreshSymbolContext?.({sync:true});};
  dropDownOptions($('symbolFont'),symbols.fonts.map(font=>[font,font]));
  dropDownOptions($('cardSymbolFont'),symbols.fonts.map(font=>[font,font]));
  const controls={symbolSource:'source',symbolGlyph:'glyph',symbolFont:'font',symbolPresentation:'presentation',
    symbolBackdrop:'backdrop',symbolAsset:'assetId',symbolImageMode:'imageMode',symbolRemoveWhite:'removeWhite'};
  for(const [id,key] of Object.entries(controls)){
    $(id).onchange=()=>{
      const setting=selectedProfile(),value=$(id).type==='checkbox'?$(id).checked:$(id).value;
      setting.symbol={...symbols.profileSymbol(state,$('symbolProfile').value),[key]:value};
      changed();syncSymbolEditor();renderChart();
    };
  }
  $('symbolInkMode').onchange=()=>{
    selectedProfile().symbol.color=$('symbolInkMode').value==='custom'?$('symbolColor').value:'';
    changed();syncSymbolEditor();renderChart();
  };
  $('symbolColor').onchange=()=>{selectedProfile().symbol.color=$('symbolColor').value;changed();previewSymbol();renderChart();};

  async function uploadSymbol(file,input) {
    const id=$('symbolProfile').value;
    try{
      const asset=await symbols.storeGlyph(file,id+'-'+Date.now()+'.png');
      state.visualLanguage.profiles[id].symbol={...symbols.profileSymbol(state,id),source:'image',assetId:asset.id};
      changed();if($('symbolProfile').value===id)syncSymbolEditor();renderChart();
      setStatus('symbolStatus','Glyph saved and linked.');
    }catch(error){setStatus('symbolStatus',error.message,true);}
    finally{input.value='';}
  }
  $('symbolUpload').onchange=event=>{
    const file=event.target.files[0];if(file)uploadSymbol(file,event.target);
  };
  $('symbolFreeze').onclick=async()=>{
    const id=$('symbolProfile').value,button=$('symbolFreeze');button.disabled=true;
    try{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
      const symbol=symbols.profileSymbol(state,id);
      await paintSymbol(canvas,{...symbol,color:'#000000'},id,400);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      const asset=await symbols.storeGlyph(blob,'frozen-'+id+'-'+Date.now()+'.png');
      state.visualLanguage.profiles[id].symbol={...symbol,source:'image',assetId:asset.id};
      changed();syncSymbolEditor();renderChart();
      setStatus('symbolStatus','Saved the current appearance as a 512 × 512 PNG.');
    }catch(error){setStatus('symbolStatus',error.message,true);}
    finally{button.disabled=false;}
  };
  $('symbolFindDrawing').onclick=()=>{
    const id=$('symbolProfile').value,matches=symbols.matchingGlyphs(state,id);
    if(matches.length!==1){setStatus('symbolStatus',matches.length?'Several drawings match. Choose one in Glyph image.':'No matching PNG found in the glyph folder.');return;}
    selectedProfile().symbol={...symbols.profileSymbol(state,id),source:'image',assetId:matches[0].id};
    changed();syncSymbolEditor();renderChart();
  };
  $('symbolRefresh').onclick=async()=>{
    try{
      await window.MNC_DISK?.refreshAssets();renderLanguage();
      setStatus('symbolStatus',glyphOptions().length+' glyph images available.');
    }catch(error){setStatus('symbolStatus',error.message,true);}
  };

  function applyStandard(card,id) {
    const setting=state.visualLanguage.profiles[id],preset=state.templates.find(item=>item.id===setting?.presetId);
    if(preset)applyDesignPreset(card,preset);
    editCardFields(card,{typeSymbol:null,collectionSymbol:null,typeSymbolMode:'standard',collectionSymbolMode:'standard'});
    persist();refreshStudio();
  }
  $('symbolPreset').onchange=()=>{selectedProfile().presetId=$('symbolPreset').value;changed();renderChart();};
  $('symbolApplyDesign').onclick=()=>{
    if(current())applyStandard(current(),$('symbolProfile').value);
  };
  $('symbolSaveDesign').onclick=()=>{
    const card=current();if(!card)return;
    const before=state.templates.map(preset=>JSON.stringify(preset)).join('');
    saveDesignPreset(card);
    if(before===state.templates.map(preset=>JSON.stringify(preset)).join(''))return;
    selectedProfile().presetId=$('layoutPresets').value;changed();syncSymbolEditor();renderChart();
  };
  $('symbolExportChart').onclick=async()=>{
    const profiles=symbolCanvases(),canvas=document.createElement('canvas');
    canvas.width=1200;canvas.height=Math.ceil(profiles.length/4)*250+70;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fbf9f2';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#202820';ctx.font='700 28px sans-serif';ctx.fillText('LX26 · Visual language',30,43);
    for(const [i,profile] of profiles.entries()){
      const x=i%4*300,y=70+Math.floor(i/4)*250;
      await symbols.draw(ctx,symbols.profileSymbol(state,profile.id),x+150,y+98,130,'#000000',profile.id);
      ctx.fillStyle='#202820';ctx.font='700 19px sans-serif';ctx.textAlign='center';ctx.fillText(profile.name,x+150,y+193,280);
    }
    canvasPNG(canvas,'LX26_Visual_Language.png');
  };

  function editSection(section) {
    $('rightPane').dataset.editSection=section;
    document.querySelectorAll('button[data-edit-section]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.editSection===section)));
    for(const id of section==='content'?['gameplayGroup','cardWriting','legacyFields']:section==='attributes'?['cardAttributes']:section==='art'?['gameArtwork','cardLook']:section==='symbols'?['gameHeader']:section==='footer'?['gameCredit']:['frontLayoutPanel'])$(id).open=true;
  }
  document.querySelectorAll('button[data-edit-section]').forEach(button=>button.onclick=()=>editSection(button.dataset.editSection));
  for(const [id,section] of [['jumpRules','content'],['jumpHeader','symbols'],['jumpArt','art'],['jumpLook','art'],['jumpFooter','footer']]){
    const previous=$(id).onclick;
    $(id).onclick=event=>{editSection(section);previous?.(event);};
  }
  const previousFront=$('frontOpen').onclick;
  $('frontOpen').onclick=event=>{editSection('type');previousFront?.(event);};

  function itemLinks(card) {
    return plan().groups.flatMap(group=>group.slots.flatMap((slot,index)=>slot.cardId===card.id?[{group,slot,index}]:[]));
  }

  function syncItemSetGroup(card=current()) {
    const isItem=card?.family==='Item';
    $('cardItemSetControls').hidden=!isItem;
    if(!isItem)return;
    const automatic=planModel.definition(planModel.profileFor(card));
    const group=planModel.definition(planModel.groupFor(card));
    const selected=itemGroups.some(entry=>entry.id===card.itemSetGroup)?card.itemSetGroup:'';
    dropDownOptions($('cardItemSetGroup'),[['','From card subtype · '+automatic.name],
      ...itemGroups.map(entry=>[entry.id,entry.name])],selected);
    const linked=itemLinks(card)[0];
    const eligible=canLink(card);
    $('cardOpenSetSlots').disabled=!eligible&&!linked;
    const message=card.catalogUnlisted?'Restore this item to the catalog to link it to an LX26 slot.':
      card.classification==='Secret'?'Set Designer slots are for regular LX26 cards.':
      !eligible?'Set the Collection code to LX26 under Footer to link this item.':
      linked?'Linked to '+planModel.definition(linked.group.id).name+', slot '+(linked.index+1)+'.':
      'Choose this card under Linked design in '+group.name+'.';
    setStatus('cardItemSetStatus',message);
  }

  $('cardItemSetGroup').onchange=()=>{
    const card=current();
    if(card?.family!=='Item')return;
    const value=$('cardItemSetGroup').value;
    if(value&&!itemGroups.some(group=>group.id===value)){syncItemSetGroup(card);return;}
    const next=planModel.groupFor({...card,itemSetGroup:value});
    const oldLinks=itemLinks(card).filter(link=>link.group.id!==next);
    if(oldLinks.length&&!confirm('Move this card to '+planModel.definition(next).name+'? This will unlink it from its previous set slots.')){
      syncItemSetGroup(card);
      return;
    }
    for(const {slot} of oldLinks)slot.cardId='';
    editCardFields(card,{itemSetGroup:value});
    syncItemSetGroup(card);
    window.MNC_updateCatalogCardLabel?.(card);
    persist();
  };

  $('cardOpenSetSlots').onclick=()=>{
    const card=current();
    if(card?.family!=='Item')return;
    const linked=itemLinks(card)[0];
    if(!canLink(card)&&!linked)return;
    selectSetGroup(linked?.group.id||planModel.groupFor(card));
    tab('setDesigner');
  };

  function syncCard() {
    const card=current();
    syncItemSetGroup(card);
    if(!card)return;
    const id=planModel.profileFor(card),name=planModel.profile(id)?.name||card.family;
    $('cardStandardName').textContent=name+' standard';
    $('cardApplyStandard').disabled=!id;$('cardEditStandard').disabled=!id;
    const {symbol}=symbols.cardSymbol(state,card);
    $('cardSymbolMode').value=symbols.cardMode(card,'type');
    $('cardSymbolOverrides').hidden=$('cardSymbolMode').value!=='custom';
    $('typeIconNote').textContent=$('cardSymbolMode').value==='custom'?'Custom symbol for '+card.title:name+' · '+(symbol.source==='image'?'PNG glyph':symbol.font);
    $('typeIconGlyph').value=symbol.glyph;populateAssets($('typeIconAsset'),symbol.assetId);
    $('cardSymbolFont').value=symbol.font;$('cardSymbolPresentation').value=symbol.presentation;
    $('cardSymbolImageMode').value=symbol.imageMode;
    const collection= symbols.cardSymbol(state,card,'collection').symbol;
    $('cardCollectionSymbolMode').value=symbols.cardMode(card,'collection');
    $('footerSetIcons').hidden=$('cardCollectionSymbolMode').value!=='custom';
    $('setGlyph').value=collection.glyph;populateAssets($('setGlyphAsset'),collection.assetId);
    $('artworkProfile').value=card.artworkProfile||'custom';
    const token=++cardRevision;
    const canvas=$('cardSymbolPreview'),paint=canvas.getContext('2d');
    symbols.centeredPreview(symbol,canvas.width,canvas.height,'#000000',id).then(preview=>{
      if(token!==cardRevision)return;
      paint.clearRect(0,0,canvas.width,canvas.height);
      paint.drawImage(preview,0,0);
    }).catch(console.error);
  }

  function updateCardSymbol(place,fields) {
    const card=current();if(!card)return;
    symbols.setCardSymbol(card,place,fields);
    changed();syncCard();
  }
  for(const [control,place] of [['cardSymbolMode','type'],['cardCollectionSymbolMode','collection']]){
    $(control).onchange=()=>{
      const card=current();if(!card)return;
      symbols.setCardMode(card,place,$(control).value);
      changed();syncCard();
    };
  }
  $('cardSymbolPosition').onclick=()=>window.MNC_openLayoutSymbol?.('type');
  $('typeIconGlyph').onchange=()=>updateCardSymbol('type',{glyph:$('typeIconGlyph').value,source:'text',assetId:''});
  $('typeIconAsset').onchange=()=>updateCardSymbol('type',{assetId:$('typeIconAsset').value,source:$('typeIconAsset').value?'image':'text'});
  $('cardSymbolFont').onchange=()=>updateCardSymbol('type',{font:$('cardSymbolFont').value});
  $('cardSymbolPresentation').onchange=()=>updateCardSymbol('type',{presentation:$('cardSymbolPresentation').value});
  $('cardSymbolImageMode').onchange=()=>updateCardSymbol('type',{imageMode:$('cardSymbolImageMode').value});
  $('artworkProfile').onchange=()=>{
    const card=current();if(!card)return;
    const profile=$('artworkProfile').value;
    card.artworkProfile=profile;
    if(game.role(card)){
      card.template=profile==='full'?'Game Full Art':profile==='custom'?card.template:'Game Frame';
    }else if(profile==='full')card.template='Full Art';
    persist();refreshStudio();
  };
  $('setGlyph').oninput=$('setGlyph').onchange=()=>updateCardSymbol('collection',{glyph:$('setGlyph').value,source:'text',assetId:''});
  $('setGlyphAsset').onchange=()=>updateCardSymbol('collection',{assetId:$('setGlyphAsset').value,source:$('setGlyphAsset').value?'image':'text'});
  $('cardSymbolToChart').onclick=()=>openProfile(planModel.profileFor(current()));
  $('cardEditStandard').onclick=()=>openProfile(planModel.profileFor(current()));
  $('cardApplyStandard').onclick=()=>{const card=current();if(card)applyStandard(card,planModel.profileFor(card));};
  $('cardSymbolUpload').onchange=async event=>{
    const file=event.target.files[0],card=current();if(!file||!card)return;
    try{
      const asset=await symbols.storeGlyph(file,'card-symbol-'+Date.now()+'.png');
      const id=planModel.profileFor(card);
      editCardFields(card,{typeSymbol:{...symbols.defaults(id),source:'image',assetId:asset.id},typeSymbolMode:'custom'});
      changed();if(card===current())syncCard();
    }catch(error){$('typeIconNote').textContent=error.message;}
    finally{event.target.value='';}
  };
  $('jumpNumberPlan').onclick=()=>{tab('setDesigner');$('setNumbering').hidden=false;$('setNumbering').open=true;renderNumbering();};
  const refresh=window.refreshStudio;
  window.refreshStudio=()=>{refresh();syncCard();};
  window.MNC_refreshSetDesigner=renderSet;
  window.MNC_refreshItemSetGroup=syncItemSetGroup;
  window.MNC_refreshVisualLanguage=renderLanguage;
  window.MNC_applyCardStandard=applyStandard;
  editSection('content');
})();
