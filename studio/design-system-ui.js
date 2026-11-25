'use strict';

(() => {
  const planModel=MNC_SET_PLAN,symbols=MNC_SYMBOLS,types=MNC_TYPE_DESIGN,borders=MNC_OUTER_BORDER;
  const itemGroups=planModel.definitions.filter(group=>group.family==='Item');
  const current=()=>cardById(currentId);
  const plan=()=>state.setPlan;
  const canLink=card=>planModel.eligible(card,state.catalogCollections?.[card.collectionId]);
  const selectedGroup=()=>plan().groups.find(group=>group.id===$('setGroup').value)||plan().groups[0];
  const selectedProfile=()=>state.visualLanguage.profiles[$('symbolProfile').value];
  let previewRevision=0,chartRevision=0,cardRevision=0;
  let designArtwork='',standardsPane='colors',designPreviewRevision=0;
  let designChoicesProject;
  const chosenDesigns=new Map();
  let footerPreviewRevision=0,footerUndo=null;
  const colorFields=[
    ['mainColor','Main','Card background'],
    ['borderColor','Secondary','Outer frame'],
    ['accent','Accent','Type and nameplate highlights']
  ];

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

  function openProfile(id,pane='layout') {
    tab('visualLanguage',{profileId:planModel.profile(id)?id:'other',pane,
      assetId:activeTab==='visualLanguage'?designArtwork:''});
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
    applyStartingDesign(card,group.id);
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

  async function paintSymbol(canvas,symbol,id,size=canvas.width*.72,ink='#000000') {
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    await symbols.drawBadge(ctx,symbol,canvas.width/2,canvas.height/2,size,ink,id);
  }

  const playableProfile=playableDesignType;

  function draftFor(id) {
    const profile=playableProfile(id);
    return cardDraft(null,profile.family,profile);
  }

  function designTile(profile) {
    const label=profile.type||profile.category||(profile.family==='Item'?profile.subtype+' item':profile.family==='Movie'?'Film':profile.family);
    const tile=element('article',undefined,'design-choice');
    const canvas=element('canvas');canvas.width=canvas.height=96;
    canvas.setAttribute('aria-hidden','true');
    const glyph=element('button',undefined,'design-glyph');
    glyph.type='button';
    glyph.setAttribute('aria-label','Edit '+label+' glyph');
    glyph.title='Edit '+label+' glyph';
    glyph.onclick=()=>openProfile(profile.id,'glyphs');
    glyph.append(canvas);
    const colors=element('button',undefined,'design-swatches');
    colors.type='button';
    colors.setAttribute('aria-label','Edit '+label+' default colors');
    colors.onclick=()=>openProfile(profile.id,'colors');
    const starting=typeDesignPreset({family:profile.family,characterCategory:profile.category},profile.id);
    const options=[['',starting&&!starting.typeDefaultFor?'Default · '+starting.name:'Default'],
      ...typeDesignVariants(profile.id).map(design=>[design.id,design.name])];
    const designField=element('select');
    designField.setAttribute('aria-label',label+' design');
    const savedChoice=chosenDesigns.get(profile.id);
    dropDownOptions(designField,options,options.some(([id])=>id===savedChoice)?savedChoice:'');
    const designRow=element('label','Design','label');designRow.append(designField);
    const subtypeField=element('select');
    const subtypeRow=element('label','Villain subtype','label');subtypeRow.append(subtypeField);
    if(profile.id==='villain')dropDownOptions(subtypeField,[['','None'],...game.villainSubtypeOptions(state).map(name=>[name,name])],'');
    let styleRevision=0;
    async function paintChoice(){
      const revision=++styleRevision,card=cardDraft(null,profile.family,profile,{designId:designField.value});
      const palette=types.palette(card);
      tile.style.setProperty('--design-accent',palette.accent);
      canvas.style.backgroundColor=palette.mainColor;
      colors.replaceChildren(...colorFields.map(([key,name])=>{
        const chip=element('span',name);
        chip.title=name+' '+palette[key].toUpperCase();
        chip.style.setProperty('--swatch',palette[key]);
        return chip;
      }));
      const sample=element('canvas');sample.width=sample.height=canvas.width;
      await paintSymbol(sample,symbols.cardSymbol(state,card).symbol,profile.id,62,palette.ink);
      if(revision!==styleRevision)return;
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(sample,0,0);
    }
    designField.onchange=()=>{chosenDesigns.set(profile.id,designField.value);paintChoice().catch(console.error);};
    const create=element('button','New card','design-create');
    create.type='button';
    create.setAttribute('aria-label','New '+label+' card');
    create.onclick=()=>beginCardArtwork(profile.family,profile,{designId:designField.value,
      characterSubtype:subtypeField.value,assetId:designArtwork});
    const border=element('button','Border','design-border');
    border.type='button';
    border.setAttribute('aria-label','Edit '+label+' border');
    border.onclick=()=>openProfile(profile.id,'border');
    const starter=element('button','Starting design','design-border');
    starter.type='button';starter.setAttribute('aria-label','Open '+label+' starting design');
    starter.onclick=()=>openProfile(profile.id,'layout');
    const actions=element('div',undefined,'design-style-actions');
    actions.append(starter,border);
    const heading=element('div',undefined,'design-choice-heading');
    heading.append(glyph,element('strong',label),create);
    tile.append(heading,colors,designRow);
    if(profile.id==='villain')tile.append(subtypeRow);
    tile.append(actions);
    paintChoice().catch(console.error);
    return tile;
  }

  function renderGallery() {
    if(designChoicesProject!==state){designChoicesProject=state;chosenDesigns.clear();}
    const art=artById(designArtwork);
    $('designArtworkNote').hidden=!art;
    $('designArtworkNote').textContent=art?'Start a card using “'+art.title+'”.':'';
    $('openSavedCards').disabled=!state.cards.length;
    const profiles=planModel.definitions;
    const groups=[
      ['Characters',[...profiles.filter(profile=>profile.family==='Character'),playableProfile('creature')]],
      ['Critics & films',profiles.filter(profile=>['Critic','Movie'].includes(profile.family))],
      ['Items',itemGroups]
    ];
    $('designChoices').replaceChildren(...groups.map(([name,entries])=>{
      const group=element('section',undefined,'design-group'),grid=element('div',undefined,'design-grid');
      grid.append(...entries.map(designTile));
      group.append(element('h3',name),grid);
      return group;
    }));
    const previewType=$('designNewType');
    dropDownOptions(previewType,types.profiles().map(type=>[type.id,type.name]),previewType.value||'hero');
    const assigned=new Set(types.profiles().flatMap(({id})=>{
      const setting=state.visualLanguage.profiles[id];
      return [setting.presetId,...(setting.variantIds||[])];
    }));
    const other=state.templates.filter(design=>design.name&&!design.typeDefaultFor&&!assigned.has(design.id));
    $('designOtherList').replaceChildren(...(other.length?other.map(design=>{
      const {family,profile}=designPreviewContext(design);
      const create=element('button','New card');create.type='button';
      create.onclick=()=>beginCardArtwork(family,profile,{designId:design.id,assetId:designArtwork});
      return designListRow(design,profile?.id,create);
    }):[element('p','No unassigned designs.','status-line')]));
  }

  function designListRow(design,previewType,action){
    const row=element('div',undefined,'design-list-row'),buttons=element('div',undefined,'buttonbar');
    const edit=element('button','Edit design');edit.type='button';
    edit.setAttribute('aria-label','Edit '+design.name);
    edit.onclick=()=>window.MNC_editReusableDesign(design.id,previewType);
    buttons.append(edit,action);row.append(element('strong',design.name),buttons);
    return row;
  }

  function renderComponents(){
    function thumbnail(name,part,path,options){
      const button=element('button',undefined,'design-shape-tile');button.type='button';
      const sample=element('canvas');sample.width=108;sample.height=66;
      sample.setAttribute('aria-hidden','true');
      const ctx=sample.getContext('2d');
      ctx.fillStyle='#a58b5d';ctx.fill(path,'evenodd');
      ctx.strokeStyle='#ead6a1';ctx.lineWidth=1.5;ctx.stroke(path);
      button.append(sample,element('span',name));
      button.onclick=()=>window.MNC_openShapeDesigner(part,null,{fromDesigns:true,...options});
      return button;
    }
    const artRect={x:16,y:6,w:76,h:54},plateRect={x:6,y:20,w:96,h:26};
    const outlines=[['arch','Marquee arch'],['rectangle','Rectangle'],['rounded','Rounded'],
      ['clipped','Cut corners'],['oval','Oval'],['ticket','Ticket']];
    $('designArtShapes').replaceChildren(...outlines.map(([starterId,name])=>
      thumbnail(name,'art',shapes.polygonPath(shapes.start(starterId),artRect),{starterId})));
    $('designPlateShapes').replaceChildren(...shapes.platePresets.map(([starterId,name])=>
      thumbnail(name,'plate',shapes.platePath(starterId,plateRect),{starterId})));
    $('designSavedShapes').replaceChildren(...(state.cardShapes.length?state.cardShapes.map(shape=>
      thumbnail(shape.name,'art',shapes.path(shape,artRect),{shapeId:shape.id})):
      [element('p','No saved shapes.','status-line')]));
  }

  async function renderChart() {
    const token=++chartRevision,host=$('symbolChart');host.replaceChildren();
    const work=[];
    for(const profile of symbolCanvases()){
      const tile=element('button',undefined,'symbol-tile');tile.type='button';
      const selected=profile.id===$('symbolProfile').value;
      tile.classList.toggle('active',selected);
      tile.setAttribute('aria-pressed',String(selected));
      const canvas=element('canvas');canvas.width=canvas.height=144;
      canvas.setAttribute('aria-hidden','true');
      tile.append(canvas,element('span',profile.name));
      tile.onclick=()=>{$('symbolProfile').value=profile.id;$('symbolProfile').onchange();};
      host.append(tile);
      work.push(paintSymbol(canvas,symbols.profileSymbol(state,profile.id),profile.id));
    }
    await Promise.all(work);
    return token===chartRevision;
  }

  function editedGlyph() {
    const id=$('symbolProfile').value;
    const mark=!!state.typeDesigns.profiles[id]&&$('symbolTarget').value==='setMark';
    return {id,mark,key:mark?'setMark':'symbol',project:state};
  }

  function glyphValue({id,mark,project}=editedGlyph()) {
    return mark?symbols.typeMark(project,id):symbols.profileSymbol(project,id);
  }

  function setGlyph(value,target=editedGlyph()) {
    if(target.project!==state)return;
    target.project.visualLanguage.profiles[target.id][target.key]=value;
    changed();
  }

  const glyphCanvas=$('symbolAlignment');
  const glyphBox=160;
  let alignmentRevision=0,alignmentDrag=null;

  async function paintAlignment() {
    const token=++alignmentRevision,target=editedGlyph(),symbol=glyphValue(target);
    const canvas=element('canvas');canvas.width=canvas.height=glyphCanvas.width;
    const ctx=canvas.getContext('2d'),middle=canvas.width/2,edge=(canvas.width-glyphBox)/2;
    ctx.strokeStyle='#8f948b';ctx.lineWidth=1;ctx.setLineDash([5,4]);
    ctx.strokeRect(edge,edge,glyphBox,glyphBox);
    ctx.beginPath();ctx.moveTo(edge,middle);ctx.lineTo(canvas.width-edge,middle);
    ctx.moveTo(middle,edge);ctx.lineTo(middle,canvas.height-edge);ctx.stroke();
    ctx.setLineDash([]);
    $('symbolAlignmentStatus').textContent='X '+symbol.offsetX+'% · Y '+symbol.offsetY+'%';
    await symbols.drawBadge(ctx,symbol,middle,middle,glyphBox,'#20251e',target.mark?'collection':target.id);
    if(token===alignmentRevision){
      const output=glyphCanvas.getContext('2d');output.clearRect(0,0,glyphCanvas.width,glyphCanvas.height);
      output.drawImage(canvas,0,0);
    }
  }

  function alignGlyph(x,y) {
    const target=editedGlyph(),symbol=glyphValue(target);
    const offsetX=clamp(Math.round(x),-50,50),offsetY=clamp(Math.round(y),-50,50);
    if(offsetX===symbol.offsetX&&offsetY===symbol.offsetY)return;
    setGlyph({...symbol,offsetX,offsetY},target);
    syncMarkTools(target);
    paintAlignment().catch(console.error);
  }

  glyphCanvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||glyphValue().source==='hidden')return;
    const symbol=glyphValue(),rect=glyphCanvas.getBoundingClientRect();
    alignmentDrag={pointer:event.pointerId,x:event.clientX,y:event.clientY,offsetX:symbol.offsetX,offsetY:symbol.offsetY,
      scaleX:glyphCanvas.width*100/(rect.width*glyphBox),scaleY:glyphCanvas.height*100/(rect.height*glyphBox)};
    glyphCanvas.focus({preventScroll:true});glyphCanvas.setPointerCapture(event.pointerId);event.preventDefault();
  });
  glyphCanvas.addEventListener('pointermove',event=>{
    const drag=alignmentDrag;
    if(!drag||drag.pointer!==event.pointerId)return;
    alignGlyph(drag.offsetX+(event.clientX-drag.x)*drag.scaleX,drag.offsetY+(event.clientY-drag.y)*drag.scaleY);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])glyphCanvas.addEventListener(name,event=>{
    if(alignmentDrag?.pointer===event.pointerId)alignmentDrag=null;
  });
  glyphCanvas.addEventListener('keydown',event=>{
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(!delta||glyphValue().source==='hidden')return;
    const {offsetX,offsetY}=glyphValue(),step=event.shiftKey?5:1;
    event.preventDefault();alignGlyph(offsetX+delta[0]*step,offsetY+delta[1]*step);
  });
  $('symbolAlignReset').onclick=()=>alignGlyph(0,0);
  $('symbolAlignCenter').onclick=async()=>{
    const target=editedGlyph(),version=alignmentRevision;
    const {offsetX,offsetY}=await symbols.centerOffsets(glyphValue(target),target.mark?'collection':target.id);
    if(target.project===state&&target.id===editedGlyph().id&&target.key===editedGlyph().key&&version===alignmentRevision)alignGlyph(offsetX,offsetY);
  };

  function syncMarkTools(target=editedGlyph()) {
    $('typeMarkTools').hidden=!target.mark;
    const own=Boolean(selectedProfile()?.setMark);
    $('resetTypeMark').disabled=!own;
    $('typeMarkStatus').textContent=own?'Custom mark for this type':'Inherits the LX26 mark';
  }

  function syncSymbolEditor() {
    const target=editedGlyph(),id=target.mark?'collection':target.id;
    const profile=planModel.profile(id),symbol=glyphValue(target);
    $('symbolTargetRow').hidden=!state.typeDesigns.profiles[target.id];
    syncMarkTools(target);
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
      button.onclick=()=>{setGlyph({...symbol,source:'text',glyph},target);syncSymbolEditor();renderChart();};
      return button;
    });
    $('symbolCandidates').replaceChildren(...suggestions);
    previewSymbol().catch(console.error);
  }

  async function previewSymbol() {
    const token=++previewRevision,target=editedGlyph(),id=target.mark?'collection':target.id,symbol=glyphValue(target);
    await Promise.all([
      paintAlignment(),
      paintSymbol($('symbolLarge'),symbol,id),
      paintSymbol($('symbolSegoe'),{...symbol,source:'text',font:'Segoe UI Symbol'},id,95),
      paintSymbol($('symbolTimes'),{...symbol,source:'text',font:'Times New Roman'},id,95)
    ]);
    const status=await symbols.fontStatus(symbol.font);
    if(token===previewRevision)$('symbolFontStatus').textContent=status;
  }

  const sourceCard=()=>cardById($('standardSource').value);
  function sourceOptions() {
    const id=$('symbolProfile').value;
    const cards=state.cards.filter(card=>!card.catalogUnlisted&&types.matching(card,id));
    const options=cards.length?cards.map(card=>[card.id,card.title||'Untitled']):[['','Create or open a card of this type']];
    for(const [select,buttons] of [
      ['standardSource',['symbolSaveDesign','editSourceColors']],
      ['typeBorderSource',['captureTypeBorder','applyTypeBorder']]
    ]){
      const selected=cards.find(card=>card.id===$(select).value)||cards.find(card=>card.id===currentId)||cards[0];
      dropDownOptions($(select),options,selected?.id||'');
      $(select).disabled=!selected;
      for(const button of buttons)$(button).disabled=!selected;
    }
    const selected=sourceCard();
    $('editSourceColors').textContent=selected?'Edit card colors · '+(selected.title||'Untitled'):'Edit card colors';
  }

  async function paintStartingCard() {
    const token=++designPreviewRevision,id=$('symbolProfile').value;
    const card=window.MNC_typePreviewCard?.(id)||draftFor(id);
    const image=await cardCanvas(card,{rounded:true});
    if(token!==designPreviewRevision||$('typeStandardPreviewPanel').hidden)return;
    const canvas=$('typeStandardPreview'),ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  }

  let previewQueued=false;
  function previewStartingCard() {
    if(previewQueued)return;
    previewQueued=true;
    requestAnimationFrame(()=>{
      previewQueued=false;
      if(!$('typeStandardPreviewPanel').hidden)paintStartingCard().catch(console.error);
    });
  }

  function editPalette() {
    const id=$('symbolProfile').value,palette=types.palette(draftFor(id)),setting=selectedProfile();
    $('resetTypeColors').disabled=!Object.keys(setting.palette).length;
    $('typeColorFields').replaceChildren(...colorFields.map(([key,label,role])=>{
      const row=element('div',undefined,'type-color-row');
      const picker=element('input');picker.type='color';picker.value=palette[key];
      picker.setAttribute('aria-label',label+' color picker');
      const description=element('div',undefined,'type-color-label');
      description.append(element('strong',label),element('span',role));
      const hex=element('input');hex.type='text';hex.maxLength=7;hex.spellcheck=false;hex.value=picker.value.toUpperCase();
      hex.setAttribute('aria-label',label+' hex color');
      const update=(value,formatHex=true)=>{
        setting.palette[key]=value.toLowerCase();
        picker.value=value;
        if(formatHex)hex.value=value.toUpperCase();
        $('resetTypeColors').disabled=false;
        setStatus('typeColorStatus','Starting colors updated.');
        persist();previewStartingCard();
      };
      picker.oninput=()=>update(picker.value);
      const hexValue=()=>'#'+hex.value.trim().replace(/^#/,'');
      hex.oninput=()=>{
        const value=hexValue();
        if(front.hex(value))update(value,false);
      };
      hex.onchange=()=>{
        const value=hexValue();
        if(!front.hex(value)){
          setStatus('typeColorStatus','Enter a six-digit hex color for '+label.toLowerCase()+'.',true);
          hex.value=picker.value.toUpperCase();
          return;
        }
        update(value);
      };
      row.append(picker,description,hex);
      return row;
    }));
  }

  function editStartingLayout() {
    const id=$('symbolProfile').value,setting=selectedProfile(),profile=playableProfile(id);
    const preset=typeDesignPreset(draftFor(id),id),inherit=profile.category==='Creature'&&id!=='creature';
    $('startingDesignSource').textContent=preset?(preset.typeDefaultFor===id?'Custom starting design':preset.name):
      inherit?'Inherits the Creature starting layout':'Built-in starting layout';
    $('resetStartingDesign').hidden=!setting.presetId;
    $('resetStartingDesign').textContent=inherit?'Inherit Creature layout':'Use built-in layout';
    const assign=$('typeAssignDesign'),options=state.templates.filter(design=>
      !design.typeDefaultFor&&designFitsFamily(design,profile.family)&&design.id!==setting.presetId);
    const value=options.some(design=>design.id===assign.value)?assign.value:options[0]?.id||'';
    dropDownOptions(assign,options.map(design=>[design.id,design.name]),value);
    $('typeAssignSection').hidden=!options.length;
    const variants=typeDesignVariants(id);
    $('typeDesignVariants').replaceChildren(...(variants.length?variants.map(design=>{
      const remove=element('button','Remove variant');remove.type='button';
      remove.setAttribute('aria-label','Remove '+design.name+' from '+profile.name);
      remove.onclick=()=>{
        setting.variantIds=setting.variantIds.filter(key=>key!==design.id);
        persist();editStartingLayout();
        setStatus('symbolDesignStatus','Removed '+design.name+' from '+profile.name+'.');
      };
      return designListRow(design,id,remove);
    }):[element('p','No variants for this type.','status-line')]));
  }

  function assignSelectedDesign(assignment){
    const id=$('symbolProfile').value,design=state.templates.find(item=>item.id===$('typeAssignDesign').value);
    if(!assignDesign(design,id,assignment))return;
    editStartingLayout();previewStartingCard();
    setStatus('symbolDesignStatus',design.name+(assignment==='default'?' is now the default.':' was added as a variant.'));
  }

  const selectedFooterLayout=()=>$('sharedFooterLayout').value||'character';
  const footerScopeMatches=(mode,card)=>!!card&&(mode==='shared'||card.family==='Character');

  async function paintSharedFooter(){
    const token=++footerPreviewRevision,id=$('sharedFooterPreviewType').value;
    const card=window.MNC_typePreviewCard?.(id)||draftFor(id);
    card.collectionFooterMode=selectedFooterLayout();
    const image=await cardCanvas(card,{rounded:true});
    if(token!==footerPreviewRevision||$('sharedFooterPanel').hidden)return;
    const canvas=$('sharedFooterPreview'),ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  }

  function sharedFooterTarget(){
    return $('sharedFooterScope').value==='card'?cardById($('sharedFooterCard').value):draftFor($('sharedFooterPreviewType').value);
  }
  function syncFooterConnection(){
    const card=sharedFooterTarget();
    $('sharedFooterCardRow').hidden=$('sharedFooterScope').value!=='card';
    $('sharedFooterLink').disabled=$('sharedFooterOpenLayout').disabled=!card;
    $('sharedFooterLink').checked=front.footerMode(card)===selectedFooterLayout();
  }
  function renderSharedFooter(){
    const mode=selectedFooterLayout(),character=mode==='character';
    const type=$('sharedFooterPreviewType'),profiles=types.profiles().filter(profile=>footerScopeMatches(mode,profile));
    dropDownOptions(type,profiles.map(profile=>[profile.id,profile.name]),profiles.some(p=>p.id===type.value)?type.value:'hero');
    const cards=state.cards.filter(card=>footerScopeMatches(mode,card));
    const menu=$('sharedFooterCard'),chosen=cards.find(card=>card.id===menu.value)||cards.find(card=>card.id===currentId)||cards[0];
    dropDownOptions(menu,cards.map(item=>[item.id,item.title]),chosen?.id);
    syncFooterConnection();
    const linked=cards.filter(card=>front.footerMode(card)===mode).length;
    const allNew=character?state.characterFooter.useForNewCards:state.sharedFooter.useForNewCards&&!state.characterFooter.useForNewCards;
    $('sharedFooterTitle').textContent=character?'Character footer':'Project-wide footer';
    $('sharedFooterSummary').textContent=`${linked} of ${cards.length} saved ${character?'Character ':''}cards use this layout. `+
      (allNew?(character?'All new Character cards use it.':'All new cards use it.'):
        character?'Save this layout to make it the default for every new Character.':'Link all cards to make this the project-wide default.');
    $('sharedFooterEditLayout').textContent=character?'Edit Character footer':'Edit shared footer layout';
    $('sharedFooterApplyAll').textContent=character?'Use on saved Character cards':'Use shared footer on all cards';
    $('sharedFooterApplyAll').disabled=allNew&&linked===cards.length;
    $('sharedFooterEditMark').hidden=character;
    $('sharedFooterUndo').hidden=footerUndo?.project!==state;
    paintSharedFooter().catch(console.error);
  }

  function openSharedFooter({footerScope,previewType,footerLayout}={}){
    $('sharedFooterExceptions').open=!!footerScope;
    if(footerLayout||footerScope==='card'||previewType){
      const reference=previewType?MNC_SET_PLAN.profile(previewType):current();
      $('sharedFooterLayout').value=footerLayout||(reference?.family==='Character'?'character':'shared');
    }
    if(footerScope){
      $('sharedFooterScope').value=footerScope;
      if(footerScope==='card')$('sharedFooterCard').value=currentId;
    }
    tab('visualLanguage',{sharedFooter:true});
    if(previewType&&activeTab==='visualLanguage'){
      const type=$('sharedFooterPreviewType');
      type.value=previewType;
      type.onchange();
    }
  }
  function editFooterInLayout(mode){
    const card=sharedFooterTarget();
    if(!card)return;
    if($('sharedFooterScope').value==='card')window.MNC_editCardFooter(card,mode);
    else window.MNC_editTypeStarter($('sharedFooterPreviewType').value,{layer:'footer',footerMode:mode,fromSharedFooter:true});
  }
  $('sharedFooterScope').onchange=$('sharedFooterCard').onchange=syncFooterConnection;
  $('sharedFooterOpenLayout').onclick=()=>editFooterInLayout();
  $('sharedFooterEditLayout').onclick=()=>window.MNC_editSharedFooter($('sharedFooterPreviewType').value,'footer',null,selectedFooterLayout());
  $('sharedFooterLink').onchange=()=>{
    const mode=$('sharedFooterLink').checked?selectedFooterLayout():'custom';
    if(mode!=='custom'&&$('sharedFooterScope').value==='card'){
      const card=sharedFooterTarget();if(!card)return;
      front.setFooterMode(card,mode);persist();syncFooterConnection();
      setStatus('sharedFooterStatus','Shared footer enabled for '+card.title+'.');
    }else editFooterInLayout(mode);
  };
  $('sharedFooterLayout').onchange=()=>{setStatus('sharedFooterStatus','');renderSharedFooter();};
  $('sharedFooterPreviewType').onchange=()=>{syncFooterConnection();paintSharedFooter().catch(console.error);};
  $('sharedFooterEditMark').onclick=()=>openProfile('collection','glyphs');
  $('sharedFooterApplyAll').onclick=()=>{
    const mode=selectedFooterLayout();
    const cards=state.cards.filter(card=>footerScopeMatches(mode,card)&&front.footerMode(card)!==mode);
    footerUndo={project:state,mode,useForNewCards:state.sharedFooter.useForNewCards,characterDefault:state.characterFooter.useForNewCards,
      cards:cards.map(card=>[card.id,card.collectionFooterMode,card.catalogEdits?.collectionFooterMode])};
    cards.forEach(card=>front.setFooterMode(card,mode));
    if(mode==='shared')state.sharedFooter.useForNewCards=true;
    state.characterFooter.useForNewCards=mode==='character';
    setStatus('sharedFooterStatus',mode==='character'?'Character footer applied to saved and future Character cards.':
      'Project-wide footer applied to saved and future cards.');
    persist();renderSharedFooter();
  };
  $('sharedFooterUndo').onclick=()=>{
    if(footerUndo?.project!==state)return;
    for(const [id,mode,catalogMode] of footerUndo.cards){
      const card=cardById(id);
      if(front.footerMode(card)!==footerUndo.mode)continue;
      if(mode===undefined)delete card.collectionFooterMode;
      else card.collectionFooterMode=mode;
      if(card.catalogEdits){
        if(catalogMode===undefined)delete card.catalogEdits.collectionFooterMode;
        else card.catalogEdits.collectionFooterMode=catalogMode;
      }
    }
    state.sharedFooter.useForNewCards=footerUndo.useForNewCards;
    state.characterFooter.useForNewCards=footerUndo.characterDefault;
    footerUndo=null;setStatus('sharedFooterStatus','Restored the previous footer choices.');
    persist();renderSharedFooter();
  };

  function editBorder() {
    const card=draftFor($('symbolProfile').value),frame=borders.settings(card),setting=selectedProfile();
    const classic=frame.style==='classic',gameFrame=game.isGameCard(card);
    dropDownOptions($('typeBorderProfile'),borders.styles,frame.style);
    dropDownOptions($('typeBorderClassic'),Object.entries(borders.classicStyles),card.frameStyle||'double');
    dropDownOptions($('typeBorderContour'),borders.contours,frame.shape);
    $('typeBorderClassicRow').hidden=!classic||!gameFrame;
    $('typeBorderWidthRow').hidden=classic&&!gameFrame;
    $('typeBorderWidthLabel').textContent=classic?'Stroke width (px)':'Band width (px)';
    $('typeBorderWidth').max=classic?24:160;
    $('typeBorderWidth').value=classic?card.frameWidth??13:frame.width;
    $('typeBorderInsetRow').hidden=$('typeBorderContourRow').hidden=classic;
    $('typeBorderInset').value=frame.inset;
    $('typeBorderOpacity').value=Math.round(frame.opacity*100);
    $('typeBorderVisible').checked=!MNC_LAYOUT.hidden(card,'border');
    $('typeBorderColorLabel').textContent=MNC_LAYOUT.get(card,'border')?.gradient?'First gradient color':'Border color';
    $('typeBorderColor').value=types.palette(card).borderColor;
    $('resetTypeBorder').disabled=!setting.border&&!setting.palette.borderColor;
  }

  function saveBorder(update) {
    const card=draftFor($('symbolProfile').value);
    update(card);
    selectedProfile().border=borders.standard(card);
    persist();editBorder();previewStartingCard();
    setStatus('typeBorderStatus','Starting border updated.');
  }

  function showPane(requested) {
    const isType=!!state.typeDesigns.profiles[$('symbolProfile').value];
    standardsPane=isType?requested:'glyphs';
    for(const button of document.querySelectorAll('button[data-standard-tab]')){
      button.disabled=!isType&&button.dataset.standardTab!=='glyphs';
      button.setAttribute('aria-pressed',String(button.dataset.standardTab===standardsPane));
    }
    $('standardColors').hidden=standardsPane!=='colors';
    $('standardBorder').hidden=standardsPane!=='border';
    $('standardLayout').hidden=standardsPane!=='layout';
    $('standardGlyphs').hidden=$('standardGlyphTools').hidden=standardsPane!=='glyphs';
    $('typeStandardPreviewPanel').hidden=standardsPane==='glyphs';
    designPreviewRevision++;
    alignmentDrag=null;
    if(standardsPane==='glyphs'){
      syncSymbolEditor();renderChart();window.MNC_refreshSymbolContext?.({sync:true});
    }else{
      sourceOptions();
      if(standardsPane==='colors')editPalette();
      else if(standardsPane==='border')editBorder();
      else editStartingLayout();
      previewStartingCard();window.MNC_refreshSymbolContext?.();
    }
  }

  function renderStandards(id=$('symbolProfile').value||'hero') {
    dropDownOptions($('symbolProfile'),symbolCanvases().map(profile=>[profile.id,profile.name]),id);
    showPane(standardsPane);
  }
  function renderDesigns(){
    if(!$('designComponentsPanel').hidden)renderComponents();
    else if(!$('sharedFooterPanel').hidden)renderSharedFooter();
    else if($('designStandards').hidden)renderGallery();
    else renderStandards();
  }
  function showStandards(open) {
    $('designComponentsPanel').hidden=true;
    $('openDesignComponents').hidden=open;
    $('openDesignComponents').setAttribute('aria-expanded','false');
    $('openDesignComponents').textContent='Shapes & components';
    $('sharedFooterPanel').hidden=true;
    $('openSharedFooter').setAttribute('aria-expanded','false');
    $('openSharedFooter').textContent='Shared footer';
    $('designStandards').hidden=!open;
    $('designGallery').hidden=$('designsIntro').hidden=$('openSavedCards').hidden=open;
    const button=$('toggleDesignStandards');
    button.hidden=false;
    button.setAttribute('aria-expanded',String(open));
    button.textContent=open?'Back to card types':'Edit type standards';
  }
  function renderLanguage({assetId='',profileId,pane='glyphs',sharedFooter=false,components=false,otherDesigns=false}={}) {
    designArtwork=artById(assetId)?.id||'';
    showStandards(Boolean(profileId));
    if(components){
      $('designGallery').hidden=$('designsIntro').hidden=$('openSavedCards').hidden=$('toggleDesignStandards').hidden=true;
      $('designComponentsPanel').hidden=false;
      $('openDesignComponents').setAttribute('aria-expanded','true');
      $('openDesignComponents').textContent='Back to card types';
      renderComponents();
    }else if(sharedFooter){
      $('designGallery').hidden=$('designsIntro').hidden=$('openSavedCards').hidden=true;
      $('toggleDesignStandards').hidden=true;
      $('sharedFooterPanel').hidden=false;
      $('openSharedFooter').setAttribute('aria-expanded','true');
      $('openSharedFooter').textContent='Back to card types';
      setStatus('sharedFooterStatus','');
      renderSharedFooter();
    }else if(profileId){
      standardsPane=pane;
      $('symbolTarget').value='icon';
      $('standardSource').value=currentId||'';
      setStatus('typeColorStatus','');setStatus('typeBorderStatus','');setStatus('symbolDesignStatus','');
      renderStandards(profileId);
    }else{
      renderGallery();$('designGallery').scrollTop=0;window.MNC_refreshSymbolContext?.();
      if(otherDesigns){$('otherDesigns').open=true;$('otherDesigns').scrollIntoView({block:'nearest'});}
    }
  }
  $('openDesignComponents').onclick=()=>tab('visualLanguage',{components:$('designComponentsPanel').hidden});
  $('drawDesignShape').onclick=()=>window.MNC_openShapeDesigner('art',null,{fromDesigns:true,blank:true});
  $('designNewLayout').onclick=()=>window.MNC_editReusableDesign('',$('designNewType').value);
  $('openSharedFooter').onclick=()=>{
    if($('sharedFooterPanel').hidden)openSharedFooter();
    else tab('visualLanguage');
  };

  $('toggleDesignStandards').onclick=()=>{
    showStandards($('designStandards').hidden);
    if(!$('designStandards').hidden)standardsPane='colors';
    renderDesigns();
    if($('designStandards').hidden)window.MNC_refreshSymbolContext?.();
  };
  for(const button of document.querySelectorAll('button[data-standard-tab]'))button.onclick=()=>showPane(button.dataset.standardTab);
  $('createOtherCard').onclick=()=>beginCardArtwork($('otherCardType').value,null,{assetId:designArtwork});
  $('symbolProfile').onchange=()=>{
    $('symbolTarget').value='icon';
    setStatus('typeColorStatus','');setStatus('typeBorderStatus','');setStatus('symbolDesignStatus','');
    showPane(standardsPane);
  };
  $('symbolTarget').onchange=()=>{alignmentDrag=null;syncSymbolEditor();window.MNC_refreshSymbolContext?.({sync:true});};
  $('resetTypeMark').onclick=()=>{setGlyph(null);syncSymbolEditor();};
  dropDownOptions($('symbolFont'),symbols.fonts.map(font=>[font,font]));
  dropDownOptions($('cardSymbolFont'),symbols.fonts.map(font=>[font,font]));
  const controls={symbolSource:'source',symbolFont:'font',symbolPresentation:'presentation',
    symbolBackdrop:'backdrop',symbolAsset:'assetId',symbolImageMode:'imageMode',symbolRemoveWhite:'removeWhite'};
  for(const [id,key] of Object.entries(controls)){
    $(id).onchange=()=>{
      const field=$(id),value=field.type==='checkbox'?field.checked:field.value;
      setGlyph({...glyphValue(),[key]:value});syncSymbolEditor();renderChart();
    };
  }
  $('symbolGlyph').oninput=()=>{
    setGlyph({...glyphValue(),glyph:$('symbolGlyph').value});
    syncMarkTools();
    previewSymbol().catch(console.error);renderChart();
  };
  $('symbolInkMode').onchange=()=>{
    setGlyph({...glyphValue(),color:$('symbolInkMode').value==='custom'?$('symbolColor').value:''});
    syncSymbolEditor();renderChart();
  };
  $('symbolColor').onchange=()=>{setGlyph({...glyphValue(),color:$('symbolColor').value});syncSymbolEditor();renderChart();};

  async function uploadSymbol(file,input) {
    const target=editedGlyph(),symbol=glyphValue(target);
    try{
      const asset=await symbols.storeGlyph(file,target.id+'-'+Date.now()+'.png');
      setGlyph({...symbol,source:'image',assetId:asset.id},target);
      if(activeTab==='visualLanguage'&&standardsPane==='glyphs')syncSymbolEditor();
      renderChart();
      setStatus('symbolStatus','Glyph saved and linked.');
    }catch(error){setStatus('symbolStatus',error.message,true);}
    finally{input.value='';}
  }
  $('symbolUpload').onchange=event=>{
    const file=event.target.files[0];if(file)uploadSymbol(file,event.target);
  };
  $('symbolFreeze').onclick=async()=>{
    const target=editedGlyph(),symbol=glyphValue(target),button=$('symbolFreeze');button.disabled=true;
    try{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
      const id=target.mark?'collection':target.id;
      await paintSymbol(canvas,{...symbol,color:'#000000',backdrop:'none',offsetX:0,offsetY:0},id,400);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      const asset=await symbols.storeGlyph(blob,'frozen-'+id+'-'+Date.now()+'.png');
      setGlyph({...symbol,source:'image',assetId:asset.id},target);
      if(activeTab==='visualLanguage'&&standardsPane==='glyphs')syncSymbolEditor();
      renderChart();
      setStatus('symbolStatus','Saved the current appearance as a 512 × 512 PNG.');
    }catch(error){setStatus('symbolStatus',error.message,true);}
    finally{button.disabled=false;}
  };
  $('symbolFindDrawing').onclick=()=>{
    const target=editedGlyph(),id=target.mark?'collection':target.id,matches=symbols.matchingGlyphs(state,id);
    if(matches.length!==1){setStatus('symbolStatus',matches.length?'Several drawings match. Choose one in Glyph image.':'No matching PNG found in the glyph folder.');return;}
    setGlyph({...glyphValue(target),source:'image',assetId:matches[0].id},target);syncSymbolEditor();renderChart();
  };
  $('symbolRefresh').onclick=async()=>{
    try{
      await window.MNC_DISK?.refreshAssets();renderStandards();
      setStatus('symbolStatus',glyphOptions().length+' glyph images available.');
    }catch(error){setStatus('symbolStatus',error.message,true);}
  };

  function applyStandard(card,id) {
    applyTypeDesignPreset(card,id,{followSymbols:true});
    persist();refreshStudio();
  }
  $('resetTypeColors').onclick=()=>{
    selectedProfile().palette={};
    persist();editPalette();previewStartingCard();setStatus('typeColorStatus','Using the starting layout colors.');
  };
  $('editSourceColors').onclick=()=>{
    const card=sourceCard();if(!card)return;
    window.MNC_openStudioCard(card);editSection('art');
  };
  $('typeBorderProfile').onchange=()=>saveBorder(card=>borders.setFrame(card,{style:$('typeBorderProfile').value}));
  $('typeBorderClassic').onchange=()=>saveBorder(card=>{card.frameStyle=$('typeBorderClassic').value;});
  $('typeBorderContour').onchange=()=>saveBorder(card=>borders.setFrame(card,{shape:$('typeBorderContour').value}));
  $('typeBorderVisible').onchange=()=>saveBorder(card=>{
    const layer=MNC_LAYOUT.layerEdit(card,'border');
    if($('typeBorderVisible').checked)delete layer.hidden;
    else layer.hidden=true;
    MNC_LAYOUT.cleanLayer(card,'border');
  });
  for(const [id,update] of [
    ['typeBorderWidth',(card,value)=>{
      if(borders.settings(card).style==='classic')card.frameWidth=clamp(value,2,24);
      else borders.setFrame(card,{width:value});
    }],
    ['typeBorderInset',(card,value)=>borders.setFrame(card,{inset:value})],
    ['typeBorderOpacity',(card,value)=>borders.setFrame(card,{opacity:value/100})]
  ]){
    $(id).onchange=()=>{
      const value=$(id).valueAsNumber;
      if(Number.isFinite(value))saveBorder(card=>update(card,value));
      else editBorder();
    };
  }
  $('typeBorderColor').oninput=()=>{
    selectedProfile().palette.borderColor=$('typeBorderColor').value;
    $('resetTypeBorder').disabled=false;
    persist();previewStartingCard();setStatus('typeBorderStatus','Starting border color updated.');
  };
  $('resetTypeBorder').onclick=()=>{
    const setting=selectedProfile();
    setting.border=null;
    delete setting.palette.borderColor;
    persist();editBorder();previewStartingCard();setStatus('typeBorderStatus','Using the inherited border.');
  };
  $('typeBorderSource').onchange=()=>setStatus('typeBorderStatus','');
  $('captureTypeBorder').onclick=()=>{
    const card=cardById($('typeBorderSource').value);
    if(!card)return;
    const setting=selectedProfile();
    setting.border=borders.standard(card);
    setting.palette.borderColor=types.palette(card).borderColor;
    persist();editBorder();previewStartingCard();
    setStatus('typeBorderStatus','Copied the border from '+card.title+'.');
  };
  $('applyTypeBorder').onclick=()=>{
    const card=cardById($('typeBorderSource').value);
    if(!card)return;
    const example=draftFor($('symbolProfile').value);
    borders.applyStandard(card,borders.standard(example));
    card.borderColor=borders.color(example);
    persist();setStatus('typeBorderStatus','Applied the starting border to '+card.title+'.');
  };
  $('standardSource').onchange=()=>setStatus('symbolDesignStatus','');
  function finishTypeStarter(id){
    openProfile(id,'layout');
    setStatus('symbolDesignStatus','Starting design saved for '+planModel.profile(id).name+'.');
  }
  function useCardAsStarter(card,id){
    if(!card||!id)return;
    const name=planModel.profile(id).name;
    if(!confirm('Use “'+card.title+'” as the starting design for '+name+'?'))return;
    if(captureTypeDesign(card,id))finishTypeStarter(id);
  }
  $('symbolSaveDesign').onclick=()=>useCardAsStarter(sourceCard(),$('symbolProfile').value);
  $('standardEditLayout').onclick=()=>window.MNC_editTypeStarter($('symbolProfile').value);
  $('standardNewVariant').onclick=()=>window.MNC_editReusableDesign('',$('symbolProfile').value,'variant');
  $('standardTypeRules').onclick=()=>window.MNC_openTypeDesigner($('symbolProfile').value);
  $('typeSetDesignDefault').onclick=()=>assignSelectedDesign('default');
  $('typeAddDesignVariant').onclick=()=>assignSelectedDesign('variant');
  $('resetStartingDesign').onclick=()=>{
    selectedProfile().presetId='';
    persist();editStartingLayout();previewStartingCard();
    setStatus('symbolDesignStatus','Starting layout reset.');
  };
  $('symbolExportChart').onclick=async()=>{
    const profiles=symbolCanvases(),canvas=document.createElement('canvas');
    canvas.width=1200;canvas.height=Math.ceil(profiles.length/4)*250+70;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fbf9f2';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#202820';ctx.font='700 28px sans-serif';ctx.fillText('LX26 · Type standards',30,43);
    for(const [i,profile] of profiles.entries()){
      const x=i%4*300,y=70+Math.floor(i/4)*250;
      await symbols.draw(ctx,symbols.profileSymbol(state,profile.id),x+150,y+98,130,'#000000',profile.id);
      ctx.fillStyle='#202820';ctx.font='700 19px sans-serif';ctx.textAlign='center';ctx.fillText(profile.name,x+150,y+193,280);
    }
    canvasPNG(canvas,'LX26_Type_Standards.png');
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
      !eligible?'Set the Set Abbrev to LX26 under Credits & set to link this item.':
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
    $('cardStandardName').textContent=name+' starting design';
    $('cardApplyStandard').disabled=!id;$('cardEditStandard').disabled=!id;
    const {symbol}=symbols.cardSymbol(state,card);
    $('cardSymbolMode').value=symbols.cardMode(card,'type');
    $('cardSymbolOverrides').hidden=$('cardSymbolMode').value!=='custom';
    $('typeIconNote').textContent=$('cardSymbolMode').value==='custom'?'Custom symbol for '+card.title:name+' · '+(symbol.source==='image'?'PNG glyph':symbol.font);
    $('typeIconGlyph').value=symbol.glyph;populateAssets($('typeIconAsset'),symbol.assetId);
    $('cardSymbolFont').value=symbol.font;$('cardSymbolPresentation').value=symbol.presentation;
    $('cardSymbolImageMode').value=symbol.imageMode;
    const collection= symbols.cardSymbol(state,card,'collection').symbol;
    const characterMark=front.footerMode(card)==='character'&&MNC_CARD_METADATA.isPromo(card,collectionFor(card));
    $('cardCharacterMark').hidden=!characterMark;
    $('cardCollectionSymbolMode').disabled=characterMark;
    $('cardCollectionSymbolMode').value=characterMark?'character':symbols.cardMode(card,'collection');
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
  $('cardSymbolToChart').onclick=()=>openProfile(planModel.profileFor(current()),'glyphs');
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
  window.MNC_refreshDesigns=renderDesigns;
  window.MNC_openTypeStandard=openProfile;
  window.MNC_openSharedFooter=openSharedFooter;
  window.MNC_useCardAsTypeStarter=useCardAsStarter;
  window.MNC_finishTypeStarter=finishTypeStarter;
  window.MNC_editCardSection=editSection;
  window.MNC_applyCardStandard=applyStandard;
  editSection('content');
})();
