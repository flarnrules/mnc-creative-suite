'use strict';

(() => {
  const model=MNC_LAYOUT, effects=MNC_FRONT_EFFECTS, canvas=$('ldCanvas'), stage=$('ldStage'), board=$('ldArtboard');
  const inspector=$('ldInspector'), selection=$('ldSelection'), cards=$('ldCard'), status=$('ldStatus');
  const workspace=$('ldWorkspace'),setup=$('ldSetupToggle'),pan=$('ldPan'),zoom=$('ldZoom');
  const views=[['canvas',$('ldCanvasView')],['layers',$('ldLayersView')],['edit',$('ldEditView')]];
  const footerParts=front.footerLayers('character');
  const histories=new Map();
  const current=()=>typeDraft?.card||cardById(currentId);
  const json=value=>JSON.stringify(value);
  const defaultHint='Drag to move. Double-click text to edit.';
  let activeId='',selected='art',layers=[],listSignature='',drag=null,requested=0,queued=false;
  let mode='properties',lockRatio=true,lockArtRatio=false;
  let typeDraft=null;
  const editingSharedFooter=()=>typeDraft?.kind==='footer';
  const editingCharacterFooter=()=>editingSharedFooter()&&typeDraft.footerMode==='character';

  function saveCardEdit(card){
    if(card!==typeDraft?.card)persist();
  }

  const fonts=[['','Inherit'],['serif','Georgia'],['sans','Arial'],['system','System UI'],['mono','Courier New']];
  const weights=[['','Inherit'],['normal','Regular'],['bold','Bold'],['italic','Italic'],['bold-italic','Bold italic']];
  function node(tag,content,className) {
    const element=document.createElement(tag);
    if(content)element.textContent=content;
    if(className)element.className=className;
    return element;
  }

  function message(value=defaultHint) {
    status.textContent=value;
    status.classList.toggle('ld-hint',value===defaultHint);
  }

  function showPane(pane) {
    workspace.dataset.pane=pane;
    for(const [id,button] of views)button.setAttribute('aria-pressed',String(pane===id));
    setup.setAttribute('aria-expanded','false');
    if(pane==='canvas'||compactWorkspace?.matches)fit();
    if(compactWorkspace?.matches)syncFooterShortcuts(currentLayer());
  }

  function setPan(enabled) {
    board.dataset.pan=String(enabled);
    pan.setAttribute('aria-pressed',String(enabled));
  }

  function history(card) {
    if(!histories.has(card.id))histories.set(card.id,{undo:[],redo:[]});
    return histories.get(card.id);
  }

  function showHistory() {
    const card=current(), entry=card?history(card):null;
    $('ldUndo').disabled=!entry?.undo.length;
    $('ldRedo').disabled=!entry?.redo.length;
  }

  function checkpoint(card,before) {
    const edits=[];
    for(const key of new Set([...Object.keys(before),...Object.keys(card)])){
      if(json(before[key])!==json(card[key]))edits.push([key,before[key],card[key]===undefined?undefined:deep(card[key])]);
    }
    if(!edits.length)return;
    const h=history(card);
    h.undo.push(edits);
    if(h.undo.length>40)h.undo.shift();
    h.redo.length=0;
    saveCardEdit(card);
    showHistory();
  }

  function restoreEdit(direction) {
    const card=current();
    if(!card)return;
    maskEditor.cancel();
    const h=history(card), change=h[direction].pop();
    if(!change)return;
    const undo=direction==='undo';
    const restored=[];
    for(const [key,before,after] of change){
      if(json(card[key])!==json(undo?after:before))continue;
      const value=undo?before:after;
      if(value===undefined)delete card[key];
      else card[key]=deep(value);
      restored.push([key,before,after]);
    }
    if(restored.length)h[undo?'redo':'undo'].push(restored);
    saveCardEdit(card);
    showHistory();
    message(restored.length?(undo?'Layout edit undone.':'Layout edit redone.'):'This edit was superseded by later changes.');
    repaint(true);
  }

  function change(update,{sync=false,card=current()}={}) {
    if(!card||card!==typeDraft?.card&&cardById(card.id)!==card)return;
    const before=deep(card);
    update(card);
    checkpoint(card,before);
    if(card===current())repaint(sync);
  }

  function currentLayer(){
    return layers.find(layer=>layer.id===selected);
  }

  function select(id,{scroll=false,view='properties'}={}){
    if(selected!==id||mode!==view)maskEditor.cancel();
    selected=id;
    mode=view;
    showSelected(scroll);
    renderInspector();
  }

  function showSelected(scroll=false) {
    const layer=currentLayer(),shared=layer&&front.isSharedFooterLayer(current(),layer.id);
    selection.hidden=maskEditor.active()||!layer||layer.id==='background'||layer.hidden||layer.empty||!layer.rect.w||!layer.rect.h;
    if(!selection.hidden){
      selection.dataset.layer=layer.id;
      selection.dataset.shared=String(!!shared);
      const {x,y,w,h}=layer.rect;
      Object.assign(selection.style,{left:x/CW*100+'%',top:y/CH*100+'%',width:w/CW*100+'%',height:h/CH*100+'%'});
    }
    for(const row of $('ldLayers').children){
      const active=row.dataset.layer===selected;
      row.setAttribute('aria-current',String(active));
      if(active&&scroll)row.scrollIntoView({block:'nearest'});
    }
    const position=layers.indexOf(layer);
    $('ldForward').disabled=editingSharedFooter()||!!shared||position<1||position>=layers.length-1;
    $('ldBackward').disabled=editingSharedFooter()||!!shared||position<=1;
    for(const input of inspector.querySelectorAll('[data-coordinate]')){
      if(layer&&input!==document.activeElement)input.value=String(Math.round(layer.rect[input.dataset.coordinate]));
    }
    const measure=inspector.querySelector('[data-art-height]');
    if(measure&&layer?.id==='art')measure.textContent=Math.round(layer.rect.h)+' px';
    $('ldPlatesQuick').disabled=!layers.some(item=>item.id==='plate');
    if(compactWorkspace?.matches)syncFooterShortcuts(layer);
  }

  function syncFooterShortcuts(layer){
    const menu=$('ldFooterPart'),button=$('ldFooterQuick');
    const isFooter=footerParts.includes(layer?.id);
    menu.hidden=!isFooter;
    button.disabled=!layers.some(item=>footerParts.includes(item.id));
    button.setAttribute('aria-pressed',String(isFooter&&workspace.dataset.pane==='edit'));
    if(isFooter){
      for(const option of menu.options)option.disabled=!layers.some(item=>item.id===option.value);
      menu.value=layer.id;
    }
  }

  function layerList(){
    const card=current();
    const signature=json(layers.map(({id,label,hidden,empty})=>[id,label,hidden,empty,front.isSharedFooterLayer(card,id)]));
    if(signature===listSignature)return;
    listSignature=signature;
    const host=$('ldLayers'),top=host.scrollTop;
    host.replaceChildren();
    for(const layer of [...layers].reverse()){
      const item=node('li');
      item.dataset.layer=layer.id;
      item.classList.toggle('ld-layer-dim',layer.hidden||layer.empty);
      const open=node('button',layer.label||'Layer');
      open.type='button';
      open.title=layer.label||'Layer';
      open.onclick=()=>editLayer(layer.id);
      item.append(open);
      if(!editingSharedFooter()&&layer.id!=='background'&&!front.isSharedFooterLayer(card,layer.id)){
        const toggle=node('button',layer.hidden?'○':'●','ld-eye');
        toggle.type='button';
        toggle.ariaLabel=(layer.hidden?'Show ':'Hide ')+layer.label;
        toggle.title=toggle.ariaLabel;
        toggle.onclick=()=>change(card=>{
          const edit=model.editable(card).layers[layer.id]??={};
          if(layer.hidden)delete edit.hidden;
          else edit.hidden=true;
          if(!Object.keys(edit).length)delete card.layoutDesign.layers[layer.id];
        },{sync:true});
        item.append(toggle);
      }
      host.append(item);
    }
    host.scrollTop=top;
  }

  let syncInspector=false;
  function repaint(sync=false) {
    requested++;
    syncInspector||=sync;
    if(queued)return;
    queued=true;
    requestAnimationFrame(async()=>{
      queued=false;
      const card=current(), token=requested, refreshInspector=syncInspector;
      syncInspector=false;
      if(!card||activeTab!=='layoutDesigner')return;
      try{
        const preview=await cardCanvas(deep(card),{rounded:true,onLayout:result=>{
          if(token!==requested)return;
          layers=editingSharedFooter()?result.filter(layer=>front.footerLayers(typeDraft.footerMode).includes(layer.id)):result;
          if(!currentLayer())selected=layers.find(layer=>layer.id==='art')?.id||layers[0]?.id||'background';
          layerList();
          showSelected();
          if(refreshInspector)renderInspector();
        }});
        if(token!==requested||activeTab!=='layoutDesigner')return;
        canvas.getContext('2d').clearRect(0,0,CW,CH);
        canvas.getContext('2d').drawImage(preview,0,0);
      }catch(error){
        if(token===requested)message('The front could not be rendered. '+error.message);
        console.error(error);
      }
    });
  }

  function fit(){
    if(!stage.clientWidth||!stage.clientHeight)return;
    const scale=zoom.value,compact=compactWorkspace?.matches;
    const width=scale==='fit'?Math.min(stage.clientWidth-(compact?20:40),(stage.clientHeight-(compact?12:32))*CW/CH,900):Number(scale)*CW;
    board.style.setProperty('--ld-card-width',Math.max(compact?32:80,Math.floor(width))+'px');
  }

  function revealZoomedLayer(){
    if(!compactWorkspace?.matches||zoom.value==='fit'||selection.hidden)return;
    const viewport=stage.getBoundingClientRect(),layer=selection.getBoundingClientRect();
    if(!viewport.width||!viewport.height)return;
    stage.scrollLeft+=layer.left+layer.width/2-viewport.left-viewport.width/2;
    stage.scrollTop+=layer.top+layer.height/2-viewport.top-viewport.height/2;
  }

  function fields(title){
    const section=node('section');
    section.append(node('h4',title));
    inspector.append(section);
    return section;
  }

  function action(host,text,callback,className){
    const button=node('button',text,className);
    button.type='button';
    button.onclick=callback;
    host.append(button);
    return button;
  }

  function pair(host){
    const row=node('div',null,'pair');
    host.append(row);
    return row;
  }

  function input(host,label,value,update,options={}){
    const {type='text',choices,min,max,step,live=false,primary=false,placeholder='',refresh=false}=options;
    const wrapper=node('label',label,type==='checkbox'?'toggle':'label');
    const control=node(choices?'select':type==='textarea'?'textarea':'input');
    const numeric=type==='number'||type==='range';
    if(choices)dropDownOptions(control,choices,String(value??''));
    else if(type==='textarea'){
      control.rows=label==='Quote'?4:3;
      control.value=value??'';
      control.maxLength=4000;
    }else{
      control.type=type;
      if(numeric){
        control.min=min??'';
        control.max=max??'';
        control.step=step??1;
      }else if(type==='text')control.maxLength=500;
      if(type==='checkbox')control.checked=!!value;
      else control.value=value??'';
    }
    control.placeholder=placeholder;
    if(primary)control.dataset.editCopy='true';
    const read=()=>type==='checkbox'?control.checked:numeric&&control.value!==''?control.valueAsNumber:control.value;
    function apply(card){
      const next=read();
      if(numeric&&next!==''&&!Number.isFinite(next))return;
      update(card,numeric&&next!==''?clamp(next,min,max):next,control);
    }
    if(live){
      let before=null, card=null;
      const commit=()=>{
        if(before&&card)checkpoint(card,before);
        before=null;
        card=null;
        if(refresh)repaint(true);
      };
      control.oninput=()=>{
        card=current();
        if(!card)return;
        before??=deep(card);
        apply(card);
        saveCardEdit(card);
        repaint();
      };
      control.onchange=commit;
      control.onblur=()=>{if(before)commit();};
    }else control.onchange=()=>change(apply,{sync:refresh});
    if(type==='checkbox')wrapper.prepend(control);
    else wrapper.append(control);
    host.append(wrapper);
    return control;
  }

  function setGeometry(card,layer,patch){
    const before=layer.id==='art'?model.geometry(card,'art',layer.base):null;
    const edit=model.layerEdit(card,layer.id);
    for(const [axis,v] of Object.entries(patch)){
      const value=model.bounded(axis,Math.round(v));
      if(value===Math.round(layer.base[axis]))delete edit[axis];
      else edit[axis]=value;
    }
    model.cleanLayer(card,layer.id);
    if(before)model.shiftArtFlow(card,before,model.geometry(card,'art',layer.base));
  }

  function geometryFields(layer) {
    const host=fields('Position & size');
    for(const axes of [['x','y'],['w','h']]){
      const row=pair(host);
      for(const axis of axes){
        const label={x:'X (px)',y:'Y (px)',w:'Width (px)',h:'Height (px)'}[axis];
        const control=input(row,label,Math.round(layer.rect[axis]),(card,value)=>{
          const known=layers.find(item=>item.id===layer.id)||layer;
          setGeometry(card,known,{[axis]:value===''?known.base[axis]:value});
        },{type:'number',min:model.bounded(axis,-10000),max:model.bounded(axis,10000)});
        control.dataset.coordinate=axis;
      }
    }
    const foot=node('div',null,'ld-geometry-foot');
    const lock=node('label','Lock resize ratio','toggle'), check=node('input');
    check.type='checkbox';
    check.checked=layer.id==='art'?lockArtRatio:lockRatio;
    check.onchange=()=>{
      if(layer.id==='art')lockArtRatio=check.checked;
      else lockRatio=check.checked;
    };
    lock.prepend(check);
    foot.append(lock);
    action(foot,'Reset placement',()=>change(card=>{
      if(!model.get(card,layer.id))return;
      setGeometry(card,layer,layer.base);
    },{sync:true}));
    host.append(foot);
  }

  function setStyle(card,id,key,value){
    const typography=front.editable(card).text;
    const style=typography[id]??={};
    if(value===''||value===undefined)delete style[key];
    else style[key]=value;
    if(!Object.keys(style).length)delete typography[id];
  }

  function typography(host,card,{key,size=19,color='#f1ecde'},align=false,{pickColor=true}={}) {
    const style=front.effective(card).text?.[key]||{};
    const theme=palette(card);
    const inheritFont=key==='title'&&card.fontId&&card.fontId!=='system'&&!style.font?'png:'+card.fontId:'';
    const availableFonts=key==='title'?[...fonts,...pngFonts()]:fonts;
    const row=pair(host);
    input(row,'Font',style.font||inheritFont,(c,value)=>{
      if(key==='title'){
        if(value.startsWith('png:')){
          c.fontId=value.slice(4);
          setStyle(c,key,'font','');
          return;
        }
        c.fontId='system';
      }
      setStyle(c,key,'font',value);
    },{choices:availableFonts});
    input(row,'Style',style.style||'',(c,value)=>setStyle(c,key,'style',value),{choices:weights});
    const measure=pair(host);
    input(measure,'Font size (px)',style.size??'',(c,value)=>setStyle(c,key,'size',value),
      {type:'number',min:7,max:144,placeholder:String(Math.round(size))});
    if(pickColor)input(measure,'Text color',style.color||color||theme.ink,(c,value)=>setStyle(c,key,'color',value),{type:'color',live:true});
    if(align)input(host,'Align',style.align||'',(c,value)=>setStyle(c,key,'align',value),
      {choices:[['','Inherit'],['left','Left'],['center','Center'],['right','Right']]});
    action(host,'Reset text formatting',()=>change(c=>{
      delete c.frontLayout?.text?.[key];
      if(key==='title')c.fontId='system';
    },{sync:true}));
  }

  function pngFonts(){
    return [...$('mncFontSelect').options].filter(option=>option.value!=='system').map(option=>['png:'+option.value,option.textContent]);
  }

  function palette(card){
    return game.isGameCard(card)?window.MNC_gamePalette(card):card.template==='Standard'?window.MNC_standardPalette(card):
      {base:'#161a24',ink:'#ffffff',outer:card.accent||'#c2aa80',accent:card.accent||'#c2aa80'};
  }

  function openType(card){
    const id=MNC_SET_PLAN.profileFor(card);
    if(id)window.MNC_openTypeDesigner(id);
    else tab('rules');
  }

  function setQuote(c,value){
    editCardFields(c,{quote:value,lore:value,showQuote:true});
  }

  function setRule(c,value){
    editCardFields(c,{ruleText:value,effectText:value,showPower:true});
  }

  function typeHeading(host,card){
    if(card.family!=='Character'){
      input(host,'Type heading',card.roleSubtype??card.subtype??'',(c,value)=>editCardFields(c,{roleSubtype:value,subtype:value}),
        {live:true,primary:true});
      return;
    }
    input(host,'Character category',game.categoryFor(card.characterCategory)?.name||'',(c,value)=>{
      editCardFields(c,{characterCategory:value,gameType:value.toLowerCase()});
    },{choices:[['','Unassigned'],...game.categories.map(type=>[type.name,type.name])],refresh:true});
    if(game.categoryFor(card.characterCategory)?.id==='creature'){
      const choices=game.creatures.map(type=>[type.name,type.name]);
      if(card.characterType&&!choices.some(([value])=>value===card.characterType))choices.push([card.characterType,card.characterType]);
      input(host,'Creature type',card.characterType||'',(c,value)=>editCardFields(c,{characterType:value}),
        {choices:[['','Unassigned'],...choices],refresh:true});
    }
    action(host,'Edit shared type defaults',()=>openType(card));
  }

  function copyFields(layer,card) {
    const host=fields('Content');
    const details=layer.text;
    switch(layer.id){
      case 'title':
        input(host,'Card title',card.title,(c,value)=>editCardFields(c,{title:value}),{live:true,primary:true});
        break;
      case 'quote':
        input(host,'Quote',card.quote??card.lore??'',setQuote,{type:'textarea',live:true,primary:true});
        break;
      case 'rule':
        input(host,'Power text',card.ruleText??card.effectText??'',setRule,{type:'textarea',live:true,primary:true});
        break;
      case 'ruleTitle':
        input(host,'Power name',card.ruleTitle||'',(c,value)=>editCardFields(c,{ruleTitle:value,showPower:true}),{live:true,primary:true});
        break;
      case 'timing': {
        const choices=(game.roles[card.family]?.timing||[]).map(value=>[value,game.timingLabel(value)]);
        if(card.timing&&!choices.some(([value])=>value===card.timing))choices.push([card.timing,game.timingLabel(card.timing)]);
        input(host,'Power timing',card.timing||'',(c,value)=>editCardFields(c,{timing:value,showTiming:!!value}),
          {choices:[['','None'],...choices],primary:true});
        break;
      }
      case 'typeRule':
        input(host,'Printed type rule',card.typeRuleMode==='custom'?card.typeRuleText:game.categoryRule(card,state.cards,state),
          (c,value)=>editCardFields(c,{typeRuleMode:'custom',typeRuleText:value}),{type:'textarea',live:true,primary:true});
        action(host,'Follow shared wording',()=>change(c=>editCardFields(c,{typeRuleMode:'inherit'}),{sync:true}));
        break;
      case 'headerSubtype':
        input(host,'Character subtype',card.characterSubtype||'',(c,value)=>{
          editCardFields(c,{characterSubtype:value,subtype:value});
          if(value)front.editable(c).showCharacterSubtype=true;
        },{live:true,primary:true,refresh:true});
        input(host,'Print subtype',String(card.frontLayout?.showCharacterSubtype??''),(c,value)=>{
          const layout=front.editable(c);
          if(!value)delete layout.showCharacterSubtype;
          else layout.showCharacterSubtype=value==='true';
        },{choices:[['','Follow type'],['true','Show in italics'],['false','Hide']]});
        break;
      case 'typeLabel':
        typeHeading(host,card);
        break;
      case 'family':
        host.append(node('p',details.value,'status-line'));
        break;
      case 'footer':
      case 'number': {
        const footer=front.values(card),combined=footer.footerPosition==='right'&&!footer.independentFooter;
        if(layer.id==='footer'&&!typeDraft)input(host,'Set Abbrev',MNC_CARD_METADATA.collectionCode(card,collectionFor(card)),
          (c,value)=>editCardFields(c,{collectionCode:MNC_CARD_METADATA.normalizeCode(value)}),{primary:true});
        if(!typeDraft&&(layer.id==='number'||combined))input(host,'Card number',card.collectorNumber||'',(c,value,control)=>{
          const metadata=MNC_CARD_METADATA, promo=metadata.isPromo(c,collectionFor(c))&&c.classification!=='Secret';
          const input=value.trim(), number=metadata.promoNumber(input,state.setPlan.target);
          if(promo&&input&&!number){
            control.value=c.collectorNumber||'';
            message('Enter a card number from 001 to '+state.setPlan.target+'.');
          }else editCardFields(c,{collectorNumber:promo&&input?metadata.printNumber(number):input});
        },{primary:true});
        if(!typeDraft&&layer.id==='footer'){
          if(MNC_CARD_METADATA.isPromo(card,collectionFor(card)))action(host,'Edit set edition',()=>tab('setDesigner'));
          else input(host,'Edition',card.edition||'',(c,value)=>editCardFields(c,{edition:value}),{live:true});
        }
        if(layer.id==='number'||combined)input(host,'Number location',footer.footerPosition,(c,value)=>{front.editable(c).footerPosition=value;},
          {choices:[['right',footer.independentFooter?'Bottom right':'On Set Abbrev line'],['center','Centered below']],refresh:true});
        break;
      }
    }
    const style=fields('Typography'),adaptive=footerParts.includes(layer.id)&&front.hasAlignedFooter(card);
    typography(style,card,details,adaptive||['title','typeRule','rule','quote'].includes(layer.id));
    if(adaptive)action(style,'Use automatic ink',()=>change(c=>{
      front.editable(c).independentFooter.autoContrast=true;
      setStyle(c,details.key,'color','');
    },{sync:true}));
  }

  function assetChoices(){
    return [['','None'],...state.assets.map(a=>[a.id,a.title+' · '+a.id])];
  }

  function artSizeFields(layer,card){
    const host=fields('Window size'), heading=host.firstElementChild;
    const amount=node('output',Math.round(layer.rect.h)+' px');
    amount.dataset.artHeight='true';
    heading.classList.add('ld-art-size-heading');
    heading.append(amount);
    const height=input(host,'Height',Math.round(layer.rect.h),(c,value)=>{
      if(value!=='')setGeometry(c,layer,{h:value});
    },{type:'range',min:40,max:Math.max(CH,layer.rect.h),step:1,live:true});
    height.dataset.coordinate='h';
    if(model.canFollowArt(card))input(host,'Move content below when resizing',card.layoutDesign?.followArt!==false,
      (c,value)=>{if(value)delete c.layoutDesign?.followArt;else model.editable(c).followArt=false;},{type:'checkbox'});
  }

  function artFields(card) {
    const host=fields('Artwork');
    input(host,'Source image',card.sourceAssetId||'',setCardArtwork,{choices:assetChoices()});
    input(host,'Fit',card.fit||'cover',(c,value)=>{c.fit=value;},{choices:[['cover','Cover'],['contain','Contain']]});
    input(host,'Crop zoom',card.zoom??1,(c,value)=>{c.zoom=value||1;},{type:'number',min:.2,max:6,step:.01});
    const axes=pair(host);
    for(const [key,label] of [['panX','Pan X'],['panY','Pan Y']]){
      input(axes,label,card[key]??0,(c,value)=>{c[key]=value||0;},{type:'number',min:-1,max:1,step:.01});
    }
    if(card.template==='Standard'||game.isGameCard(card)&&card.template!=='Game Full Art'){
      input(host,'Window shape',card.artShape||'rounded',(c,value)=>{c.artShape=value;c.artShapeId='';},
        {choices:[['rounded','Rounded'],['square','Square'],['cut','Cut corners'],['ellipse','Ellipse'],...(game.isGameCard(card)?[['marquee','Marquee']]:[])]});
      input(host,'Window border',card.artBorder||'solid',(c,value)=>{c.artBorder=value;},
        {choices:[['none','None'],['solid','Single line'],['double','Double line'],['dashed','Dashed']]});
      if(state.cardShapes.length)input(host,'Saved artwork outline',card.artShapeId||'',(c,value)=>{c.artShapeId=value;},
        {choices:[['','Use preset'],...state.cardShapes.map(shape=>[shape.id,shape.name])],refresh:true});
      if(!typeDraft)action(host,'Edit custom art shape',()=>window.MNC_openShapeDesigner('art',card));
    }
  }

  function plateFields(card) {
    const shapeHost=fields('Nameplate shape'), layout=front.values(card), theme=palette(card);
    const gallery=node('div',null,'ld-plate-gallery');
    const preset=card.nameplatePreset||(card.nameplate==='pill'?'pill':'rounded');
    for(const [id,label] of shapes.platePresets){
      const button=action(gallery,label,()=>change(c=>{
        c.nameplatePreset=id;
        c.nameplateShapeId='';
        if(c.nameplate!=='outline')c.nameplate='solid';
      },{sync:true}));
      button.setAttribute('aria-pressed',String(!card.nameplateShapeId&&id===preset));
      const sample=node('canvas');
      sample.width=96;sample.height=31;
      sample.setAttribute('aria-hidden','true');
      const paint=sample.getContext('2d');
      const path=shapes.platePath(id,{x:5,y:5,w:86,h:22});
      paint.fillStyle='#cbad77';paint.fill(path);
      paint.strokeStyle='#fae2ad';paint.lineWidth=1.1;paint.stroke(path);
      button.prepend(sample);
    }
    shapeHost.append(gallery);
    if(state.cardShapes.length){
      input(shapeHost,'Saved shape',card.nameplateShapeId||'',(c,value)=>{
        c.nameplateShapeId=value;
        if(value&&c.nameplate==='none')c.nameplate='solid';
      },{choices:[['','Use preset'],...state.cardShapes.map(shape=>[shape.id,shape.name])],refresh:true});
    }
    if(!typeDraft){
      const buttons=node('div',null,'buttonbar');
      action(buttons,'Draw a shape',()=>window.MNC_openShapeDesigner('plate',card,{blank:true}));
      action(buttons,'Edit shape',()=>window.MNC_openShapeDesigner('plate',card));
      shapeHost.append(buttons);
    }

    const host=fields('Nameplate style');
    input(host,'Style',card.nameplate||'solid',(c,value)=>{c.nameplate=value;},
      {choices:[['solid','Filled'],['pill','Legacy pill'],['banner','Legacy banner'],['outline','Outline only'],['none','Hidden']]});
    input(host,'Stroke color',layout.plateStroke||theme.line||theme.outer,(c,value)=>{front.editable(c).plateStroke=value;},
      {type:'color',live:true});
    const numbers=pair(host);
    input(numbers,'Stroke (px)',layout.plateStrokeWidth,(c,value)=>{front.editable(c).plateStrokeWidth=value||0;},
      {type:'number',min:0,max:16});
    input(numbers,'Opacity (%)',Math.round((layout.plateOpacity??1)*100),(c,value)=>{
      front.editable(c).plateOpacity=(value===''?100:value)/100;
    },{type:'number',min:0,max:100});
  }

  function effectFields(layer,card){
    const edit=model.get(card,layer.id)||{};
    const outline=effects.outline(edit.outline), shadow=effects.shadow(edit.shadow);
    function set(c,key,value){
      if(value)model.layerEdit(c,layer.id)[key]=value;
      else {
        delete model.get(c,layer.id)?.[key];
        model.cleanLayer(c,layer.id);
      }
    }
    function adjust(key,attribute,fallback){
      return (c,value)=>{
        const item=model.get(c,layer.id)?.[key];
        if(item)set(c,key,{...item,[attribute]:value===''?fallback:value});
      };
    }
    const line=fields('Outline');
    input(line,'Add outline',!!outline,(c,value)=>set(c,'outline',value?{color:'#15131b',width:3}:null),
      {type:'checkbox',refresh:true});
    if(outline){
      const row=pair(line);
      input(row,'Color',outline.color,adjust('outline','color','#15131b'),{type:'color',live:true});
      input(row,'Width (px)',outline.width,adjust('outline','width',3),{type:'number',min:1,max:24});
    }

    const drop=fields('Drop shadow');
    input(drop,'Add drop shadow',!!shadow,(c,value)=>set(c,'shadow',
      value?{color:'#0a0b10',opacity:.6,blur:9,x:4,y:7}:null),{type:'checkbox',refresh:true});
    if(shadow){
      const inks=pair(drop);
      input(inks,'Color',shadow.color,adjust('shadow','color','#0a0b10'),{type:'color',live:true});
      input(inks,'Opacity',shadow.opacity,adjust('shadow','opacity',.6),{type:'number',min:.01,max:1,step:.01});
      const axes=pair(drop);
      input(axes,'X offset (px)',shadow.x,adjust('shadow','x',4),{type:'number',min:-60,max:60});
      input(axes,'Y offset (px)',shadow.y,adjust('shadow','y',7),{type:'number',min:-60,max:60});
      input(drop,'Blur (px)',shadow.blur,adjust('shadow','blur',9),{type:'range',min:0,max:48,step:1,live:true});
    }
  }

  function creditFields(card) {
    const host=fields('Credits & source');
    const attribution=MNC_CARD_METADATA.attribution(card);
    input(host,'Illustrator',attribution.illustration,(c,value)=>{
      const [first='',...last]=value.trim().split(/\s+/);
      editCardFields(c,{artist:value,artistFirst:first,artistLast:last.join(' '),creditType:'Art'});
    },{live:true,primary:true});
    for(const [key,label,value] of [['conceptCredit','Concept',attribution.concept],['actorCredit','Actor',attribution.actor],
      ['film','Film',attribution.film],['episode','Episode',card.episode],['picker','Picked by',card.picker]]){
      input(host,label,value,(c,value)=>editCardFields(c,{[key]:value}),{live:true});
    }
    const style=fields('Typography');
    const options=['artist','concept','actor','film','episode'].map(key=>[key,front.textFields[key][0]]);
    const follow=node('div');
    const control=input(style,'Credit line','artist',()=>{}, {choices:options});
    style.append(follow);
    const sync=()=>{
      follow.replaceChildren();
      typography(follow,current(),{key:control.value,size:front.textFields[control.value][2]});
    };
    control.onchange=sync;
    sync();
  }

  function uploadField(host,label,accept,upload){
    const wrapper=node('label',label,'file-label secondary mini-file'),control=node('input');
    control.type='file';
    control.accept=accept;
    control.setAttribute('aria-label',label);
    control.onchange=async()=>{
      const file=control.files[0],card=current();
      control.value='';
      if(!file||!card)return;
      control.disabled=true;
      try{await upload(file,card);}
      catch(error){message(error.message);}
      finally{control.disabled=false;}
    };
    wrapper.append(control);
    host.append(wrapper);
  }

  function symbolFields(layer,card) {
    const host=fields(layer.label),symbols=MNC_SYMBOLS;
    const collection=layer.id==='setIcon',place=collection?'collection':'type',size=collection?'setIcon':'typeIcon';
    const {symbol,id}=symbols.cardSymbol(state,card,place), using=symbols.cardMode(card,place);
    const modeSelect=input(host,'Glyph mode',using,(c,value)=>symbols.setCardMode(c,place,value),
      {choices:[['standard','Follow shared glyph'],['custom',typeDraft?'This design':'This card only'],['hidden','Hidden']],refresh:true});
    if(using!=='hidden'){
      const set=(c,patch)=>{
        symbols.setCardSymbol(c,place,patch);
        modeSelect.value='custom';
      };
      const glyph=input(host,'Glyph or emoji',symbol.glyph,(c,value)=>set(c,{source:'text',glyph:value,assetId:''}),
        {live:true,primary:true,refresh:true});
      glyph.maxLength=32;
      input(host,'Glyph image',symbol.assetId,(c,value)=>set(c,{assetId:value,source:value?'image':'text'}),
        {choices:symbols.imageOptions(state,symbol.assetId,'Use text glyph'),refresh:true});
      uploadField(host,'Upload glyph PNG','image/png,.png',async(file,c)=>{
        const asset=await symbols.storeGlyph(file,'card-'+place+'-glyph-'+Date.now()+'.png');
        change(card=>symbols.setCardSymbol(card,place,{assetId:asset.id,source:'image'}),{sync:true,card:c});
        saveCardEdit(c);
        if(c===current())message('Glyph applied to '+c.title+'.');
      });
      const format=pair(host);
      if(symbol.source==='image'){
        input(format,'Image color',symbol.imageMode,(c,value)=>set(c,{imageMode:value}),
          {choices:[['tint','Tint to ink'],['original','Original colors']]});
      }else{
        input(format,'Font',symbol.font,(c,value)=>set(c,{font:value,source:'text'}),
          {choices:symbols.fonts.map(font=>[font,font])});
        input(format,'Presentation',symbol.presentation,(c,value)=>set(c,{presentation:value,source:'text'}),
          {choices:[['text','Monochrome'],['emoji','Color emoji']]});
      }
      const theme=palette(card),ink=collection&&game.isGameCard(card)?theme.trim:theme.ink;
      input(host,'Symbol ink',symbol.color||ink,(c,value)=>set(c,{color:value}),{type:'color',live:true});
      if(collection&&symbol.color)action(host,'Use card palette',()=>change(c=>symbols.setCardSymbol(c,place,{color:''}),{sync:true}));
    }
    input(host,'Symbol size (px)',front.values(card)[size]??29,(c,value)=>{front.editable(c)[size]=value||0;},
      {type:'number',min:0,max:200});
    action(host,'Edit shared symbol',()=>window.MNC_openTypeStandard(id,'glyphs'));
  }

  function borderFields(card){
    const host=fields('Frame'),spec=MNC_OUTER_BORDER.settings(card),classic=spec.style==='classic';
    const set=MNC_OUTER_BORDER.setFrame;
    input(host,'Border profile',spec.style,(c,value)=>set(c,{style:value}),
      {choices:MNC_OUTER_BORDER.styles,refresh:true});
    if(classic&&game.isGameCard(card)){
      input(host,'Classic style',card.frameStyle||'double',(c,value)=>{c.frameStyle=value;},
        {choices:Object.entries(window.MNC_gameFrameStyles),refresh:true});
      input(host,'Stroke width (px)',card.frameWidth??13,(c,value)=>{c.frameWidth=value||13;},
        {type:'number',min:2,max:24});
    }
    if(!classic){
      const dimensions=pair(host);
      input(dimensions,'Band width (px)',spec.width,(c,value)=>set(c,{width:value||48}),{type:'number',min:2,max:160});
      input(dimensions,'Inset (px)',spec.inset,(c,value)=>set(c,{inset:value||0}),{type:'number',min:0,max:90});
      input(host,'Contour',spec.shape,(c,value)=>set(c,{shape:value}),{choices:MNC_OUTER_BORDER.contours});
    }
    const appearance=pair(host);
    input(appearance,'Opacity (%)',Math.round(spec.opacity*100),(c,value)=>set(c,{opacity:(value===''?100:value)/100}),
      {type:'number',min:0,max:100});
    input(appearance,'PNG corner radius',cardCutRadius(card),(c,value)=>{c.cutRadius=value||0;},{type:'number',min:0,max:80});
  }

  function borderMaskFields(card){
    const host=fields('Border image mask'),spec=MNC_OUTER_BORDER.maskSettings(card);
    const setImage=(c,id)=>{
      if(id)model.layerEdit(c,'border').imageMask={...MNC_OUTER_BORDER.maskDefaults,...MNC_OUTER_BORDER.maskSettings(c),assetId:id};
      else{
        delete model.get(c,'border')?.imageMask;
        model.cleanLayer(c,'border');
      }
    };
    const options=assetChoices();
    if(spec&&!options.some(([id])=>id===spec.assetId))options.push([spec.assetId,'Missing image']);
    input(host,'Mask image',spec?.assetId||'',setImage,{choices:options,refresh:true});
    uploadField(host,'Upload mask image','image/png,image/jpeg,image/webp',async(file,c)=>{
      const [id]=await importImages([file]);
      if(id)change(card=>setImage(card,id),{sync:true,card:c});
    });
    if(!spec)return;
    const set=(c,patch)=>Object.assign(model.layerEdit(c,'border').imageMask,patch);
    input(host,'Mask channel',spec.channel,(c,value)=>set(c,{channel:value}),{choices:MNC_OUTER_BORDER.channels});
    input(host,'Image placement',spec.mapping,(c,value)=>set(c,{mapping:value}),{choices:MNC_OUTER_BORDER.mappings});
    input(host,'Scale (%)',Math.round(spec.scale*100),(c,value)=>set(c,{scale:(value||100)/100}),
      {type:'number',min:20,max:400});
    const offsets=pair(host);
    input(offsets,'X offset (px)',spec.x,(c,value)=>set(c,{x:value||0}),{type:'number',min:-750,max:750});
    input(offsets,'Y offset (px)',spec.y,(c,value)=>set(c,{y:value||0}),{type:'number',min:-1050,max:1050});
  }

  function additionalLayer(card,id) {
    return card.layers?.find(layer=>'extra:'+layer.id===id);
  }

  function extraFields(layer,card) {
    const edit=additionalLayer(card,layer.id);
    if(!edit)return;
    const host=fields('Layer content');
    const set=key=>(c,value)=>{additionalLayer(c,layer.id)[key]=value;};
    if(edit.style==='text'){
      input(host,'Text',edit.text,set('text'),{type:'textarea',live:true,primary:true});
      input(host,'Font',edit.fontId||'',set('fontId'),{choices:[['','Inherit card font'],['system','System UI'],...pngFonts().map(([id,name])=>[id.slice(4),name])]});
      input(host,'Font size (px)',edit.size,set('size'),{type:'number',min:8,max:144});
    }
    if(edit.style==='image')input(host,'Source image',edit.assetId,set('assetId'),{choices:assetChoices()});
    else input(host,'Color',edit.color||'#ffffff',set('color'),{type:'color',live:true});
    const row=pair(host);
    input(row,'Opacity',edit.opacity??1,set('opacity'),{type:'number',min:0,max:1,step:.05});
    input(row,'Rotation (°)',edit.rotation??0,set('rotation'),{type:'number',min:-180,max:180});
    action(host,'Remove layer',()=>change(c=>{
      c.layers=c.layers.filter(item=>'extra:'+item.id!==layer.id);
      if(c.layoutDesign){
        delete c.layoutDesign.layers[layer.id];
        c.layoutDesign.order=c.layoutDesign.order.filter(id=>id!==layer.id);
      }
    },{sync:true}),'ld-remove');
  }

  function matchFields(card){
    const attrs=fields('Matchups'),layout=front.values(card);
    for(const [key,label,defaultValue] of [['winLabel','Beats heading',game.matchupHeading(card.characterCategory)[0]],
      ['lossLabel','Beaten by heading',game.matchupHeading(card.characterCategory)[1]]]){
      input(attrs,label,layout[key]??'',(c,value)=>{
        const settings=front.editable(c);
        if(value)settings[key]=value;
        else delete settings[key];
      },{live:true,primary:key==='winLabel',placeholder:defaultValue});
    }
    input(attrs,'Arrangement',layout.matchLayout||'columns',(c,value)=>{front.editable(c).matchLayout=value;},
      {choices:[['columns','Side by side'],['stacked','Stacked']]});
    input(attrs,'Background',layout.matchStyle||'tint',(c,value)=>{front.editable(c).matchStyle=value;},
      {choices:[['tint','Type colors'],['solid','Solid'],['outline','Outline'],['none','None']],refresh:true});
    if(['solid','outline'].includes(layout.matchStyle))input(attrs,'Matchup color',layout.matchColor||'#30382f',
      (c,value)=>{front.editable(c).matchColor=value;},{type:'color',live:true});
    typography(fields('Matchup names'),card,{key:'matchValue',size:23,color:palette(card).ink});
    action(attrs,'Game & Set',()=>tab('rules'));
  }

  const fillInspector=MNC_LAYOUT_FILL_INSPECTOR({fields,input,action,change,palette,additionalLayer,openType});
  const maskEditor=MNC_CUTOUT_EDITOR({current,change,choose:select,selectionChanged:showSelected,message,addForeground,
    showCanvas:()=>{setPan(false);showPane('canvas');}});

  function resetSharedFooterDraft(card) {
    const standard=front.sharedFooterSettings(null,typeDraft.footerMode),layout=front.editable(card);
    layout.footerPosition=standard.position;
    layout.setIcon=standard.markSize;
    layout.independentFooter.autoContrast=standard.autoContrast;
    for(const key of ['edition','number'])delete layout.text[key];
    for(const id of front.footerLayers(typeDraft.footerMode))delete card.layoutDesign?.layers?.[id];
  }

  function sharedFooterFields(layer,card) {
    for(const id of ['ldFillTab','ldMaskTab'])$(id).hidden=true;
    for(const [id,view] of [['ldPropertiesTab','properties'],['ldEffectsTab','effects']]){
      $(id).hidden=false;
      $(id).setAttribute('aria-pressed',String(mode===view));
    }
    if(mode==='effects'){effectFields(layer,card);return;}
    const character=editingCharacterFooter(),layout=front.values(card),options=fields(character?'Character footer':'Shared footer');
    input(options,'Footer ink',layout.independentFooter.autoContrast?'auto':'palette',
      (c,value)=>{front.editable(c).independentFooter.autoContrast=value==='auto';},
      {choices:[['auto','Auto contrast'],['palette','Card palette']]});
    if(!character)input(options,'Card number position',layout.footerPosition,(c,value)=>{
      const ed=front.editable(c);
      ed.footerPosition=value;
      delete ed.text.number?.align;
      for(const id of front.footerLayers(typeDraft.footerMode)){
        const layer=MNC_LAYOUT.get(c,id);
        if(layer){delete layer.x;delete layer.y;MNC_LAYOUT.cleanLayer(c,id);}
      }
    },{choices:[['right','Bottom right'],['center','Bottom center']],refresh:true});
    if(layer.text&&layout.footerPosition==='right')action(options,'Align number with Set Abbrev',()=>change(c=>{
      const code=layers.find(item=>item.id==='footer'),number=layers.find(item=>item.id==='number');
      const abbrev=model.geometry(c,code.id,code.base),count=model.geometry(c,number.id,number.base);
      const align=front.values(c).text?.edition?.align||(character?'left':'right');
      const anchor=align==='left'?0:align==='center'?.5:1;
      setGeometry(c,number,{x:abbrev.x+(abbrev.w-count.w)*anchor});
      setStyle(c,'number','align',align);
    },{sync:true}));
    action(options,character?'Restore Character defaults':'Restore corner defaults',()=>change(resetSharedFooterDraft,{sync:true}));
    geometryFields(layer);
    if(layer.text)typography(fields('Typography'),card,layer.text,true,{pickColor:false});
    else if(layer.id==='setIcon')input(fields('Set Symbol'),'Symbol size (px)',layout.setIcon,(c,value)=>{
      front.editable(c).setIcon=value===''?front.sharedFooterSettings(null,typeDraft.footerMode).markSize:value;
    },
      {type:'number',min:0,max:200});
    else input(fields('Footer divider'),'Show divider',!layer.hidden,(c,value)=>{
      const edit=model.layerEdit(c,'footerLine');
      if(value)delete edit.hidden;
      else edit.hidden=true;
      model.cleanLayer(c,'footerLine');
    },{type:'checkbox',refresh:true});
  }

  function renderInspector(){
    const layer=currentLayer(),card=current();
    inspector.replaceChildren();
    $('ldLayerTitle').textContent=layer?.label||'Properties';
    inspector.scrollTop=0;
    if(!layer||!card)return;
    if(editingSharedFooter()){sharedFooterFields(layer,card);return;}
    if(front.isSharedFooterLayer(card,layer.id)){
      for(const id of ['ldFillTab','ldEffectsTab','ldMaskTab'])$(id).hidden=true;
      $('ldPropertiesTab').hidden=false;
      $('ldPropertiesTab').setAttribute('aria-pressed','true');
      const character=front.footerMode(card)==='character';
      const host=fields(character?'Character footer':'Shared footer');
      const description=node('p',character?'This card uses the Character footer.':'This footer follows the shared layout.','ld-muted');
      host.append(description);
      if(!typeDraft)action(host,character?'Edit Character footer':'Edit shared footer layout',()=>window.MNC_editSharedFooter(MNC_TYPE_DESIGN.idFor(card),layer.id,card));
      action(host,'Customize footer here',()=>{
        change(c=>front.setFooterMode(c,'custom',{copyShared:true}),{sync:true});
        message('Footer copied. Edits apply to '+(typeDraft?'this design.':'this card.'));
      });
      if(card.frontLayout?.independentFooter)action(host,'Resume custom footer',()=>change(c=>front.setFooterMode(c,'custom'),{sync:true}));
      if(character)action(host,'Use project-wide footer',()=>change(c=>front.setFooterMode(c,'shared'),{sync:true}));
      else if(card.family==='Character')action(host,'Use Character footer',()=>change(c=>front.setFooterMode(c,'character'),{sync:true}));
      return;
    }
    const fill=fillInspector.allows(layer,card), artMask=['art','cutout'].includes(layer.id);
    const border=layer.id==='border', mask=artMask||border, styled=layer.id!=='background';
    $('ldFillTab').hidden=!fill;
    $('ldMaskTab').hidden=!mask;
    $('ldEffectsTab').hidden=!styled;
    $('ldPropertiesTab').hidden=layer.id==='background';
    if(layer.id==='background')mode='fill';
    else if((mode==='fill'&&!fill)||(mode==='mask'&&!mask)||(mode==='effects'&&!styled))mode='properties';
    for(const [id,tabMode] of [['ldPropertiesTab','properties'],['ldFillTab','fill'],['ldEffectsTab','effects'],['ldMaskTab','mask']]){
      $(id).setAttribute('aria-pressed',String(mode===tabMode));
    }
    $('ldArtQuick').setAttribute('aria-pressed',String(layer.id==='art'&&mode==='properties'));
    $('ldMaskQuick').setAttribute('aria-pressed',String(artMask&&mode==='mask'));
    $('ldBorderQuick').setAttribute('aria-pressed',String(border));
    $('ldPlatesQuick').setAttribute('aria-pressed',String(layer.id==='plate'&&mode==='properties'));
    $('ldGradientQuick').setAttribute('aria-pressed',String(mode==='fill'));
    if(mode==='fill'){fillInspector.render(layer,card);return;}
    if(mode==='effects'){effectFields(layer,card);return;}
    if(mode==='mask'){
      if(border)borderMaskFields(card);
      else maskEditor.render(fields('Artwork cutout'));
      return;
    }
    if(footerParts.includes(layer.id)&&!front.usesSharedFooter(card)){
      const host=fields(typeDraft?'Footer for this design':'Footer for this card');
      if(card.family==='Character'&&front.footerMode(card)!=='character'){
        action(host,'Use Character footer',()=>change(c=>front.setFooterMode(c,'character'),{sync:true}));
      }
      action(host,'Use shared footer',()=>change(c=>front.setFooterMode(c,'shared'),{sync:true}));
      if(layer.id!=='footerLine'&&!front.effective(card).independentFooter)action(host,'Edit footer pieces separately',()=>change(c=>front.setFooterMode(c,'custom'),{sync:true}));
    }
    if(layer.id==='art')artSizeFields(layer,card);
    if(layer.text)copyFields(layer,card);
    else if(layer.id.startsWith('extra:'))extraFields(layer,card);
    else switch(layer.id){
      case 'art': artFields(card);break;
      case 'plate': plateFields(card);break;
      case 'artist': creditFields(card);break;
      case 'match': matchFields(card);break;
      case 'cornerIcon':
      case 'setIcon': symbolFields(layer,card);break;
      case 'border': borderFields(card);break;
      case 'overlay': {
        const host=fields('Overlay');
        input(host,'Image',card.overlayAssetId||'',(c,value)=>{c.overlayAssetId=value;},{choices:assetChoices()});
        input(host,'Opacity',card.overlayOpacity??.8,(c,value)=>{c.overlayOpacity=value===''?.8:value;},{type:'number',min:0,max:1,step:.05});
        break;
      }
      case 'episodeBadge': {
        const host=fields('Cassette badge');
        input(host,'Display',card.episodeBadge||'Auto',(c,value)=>editCardFields(c,{episodeBadge:value}),
          {choices:[['Auto','Auto by episode'],['Cassette','Always show'],['None','Hide']]});
        input(host,'Color',front.values(card).episodeBadgeColor||palette(card).outer,
          (c,value)=>{front.editable(c).episodeBadgeColor=value;},{type:'color',live:true});
        break;
      }
      case 'symbols':
        input(fields('Symbols'),'Printed symbols',card.symbols||'',(c,value)=>{c.symbols=value;},{live:true,primary:true});
        break;
    }
    geometryFields(layer);
  }

  function point(event) {
    const rect=canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*CW/rect.width,y:(event.clientY-rect.top)*CH/rect.height};
  }

  function hit(p){
    return [...layers].reverse().find(layer=>{
      if(layer.id==='background'||layer.empty||layer.hidden||layer.hit==='none')return false;
      const {x,y,w,h}=layer.rect;
      const padded=7;
      if(p.x<x-padded||p.x>x+w+padded||p.y<y-padded||p.y>y+h+padded)return false;
      if(layer.hit!=='edge')return true;
      const edge=Math.min(Math.abs(p.x-x),Math.abs(p.x-x-w),Math.abs(p.y-y),Math.abs(p.y-y-h));
      return edge<=(layer.id==='border'?MNC_OUTER_BORDER.hitWidth(current(),layer):14);
    });
  }

  function beginDrag(event){
    const card=current(), handle=event.target.dataset.handle;
    if(!card||drag||maskEditor.active()||event.isPrimary===false||event.button!==0||event.target!==canvas&&!handle)return;
    const start=point(event),layer=handle?currentLayer():hit(start);
    if(!layer){select('background');return;}
    if(selected!==layer.id)select(layer.id,{scroll:true});
    if(front.isSharedFooterLayer(card,layer.id))return;
    if(event.pointerType==='touch')event.preventDefault();
    else canvas.focus({preventScroll:true});
    const rect=canvas.getBoundingClientRect();
    board.setPointerCapture(event.pointerId);
    drag={id:event.pointerId,card,layer,handle,clientX:event.clientX,clientY:event.clientY,scaleX:CW/rect.width,scaleY:CH/rect.height,
      before:deep(card),changed:false};
  }

  function resize({rect},handle,dx,dy,locked){
    const west=handle.includes('w'),north=handle.includes('n');
    const horizontal=west||handle.includes('e'), vertical=north||handle.includes('s');
    const right=rect.x+rect.w,bottom=rect.y+rect.h;
    const dw=west?-dx:dx,dh=north?-dy:dy;
    let w=horizontal?model.bounded('w',rect.w+dw):rect.w;
    let h=vertical?model.bounded('h',rect.h+dh):rect.h;
    if(locked&&horizontal&&vertical){
      // Project onto the corner's resize axis so crossing it cannot switch the dominant dimension.
      const startScale=1+(rect.w*dw+rect.h*dh)/(rect.w**2+rect.h**2);
      const min=Math.max(model.bounded('w',0)/rect.w,model.bounded('h',0)/rect.h);
      const max=Math.min(model.bounded('w',Infinity)/rect.w,model.bounded('h',Infinity)/rect.h);
      const scale=clamp(startScale,min,max);
      w=rect.w*scale;
      h=rect.h*scale;
    }
    return {x:west?right-w:rect.x,y:north?bottom-h:rect.y,w,h};
  }

  function moveDrag(event){
    if(drag?.id!==event.pointerId)return;
    const clientX=event.clientX-drag.clientX,clientY=event.clientY-drag.clientY;
    const dx=clientX*drag.scaleX,dy=clientY*drag.scaleY;
    const nearStart=drag.handle?Math.abs(dx)+Math.abs(dy)<.5:
      event.pointerType==='touch'?Math.hypot(clientX,clientY)<5:Math.hypot(dx,dy)<3;
    if(!drag.changed&&nearStart)return;
    const {layer,handle,card}=drag;
    const ratio=layer.id==='art'?lockArtRatio:lockRatio;
    const delta=handle?resize(layer,handle,dx,dy,ratio!==!!event.shiftKey):
      {x:layer.rect.x+dx,y:layer.rect.y+dy};
    drag.changed=true;
    setGeometry(card,layer,delta);
    repaint();
  }

  function finishDrag(event,cancel=false){
    if(drag?.id!==event.pointerId)return;
    const {card,before,changed}=drag;
    drag=null;
    if(!changed)return;
    if(cancel){
      if(before.layoutDesign)card.layoutDesign=before.layoutDesign;
      else delete card.layoutDesign;
    }else checkpoint(card,before);
    repaint();
  }

  function moveLayer(delta){
    const ordered=layers.map(layer=>layer.id), index=ordered.indexOf(selected);
    if(index<=0||index+delta<=0||index+delta>=ordered.length)return;
    [ordered[index],ordered[index+delta]]=[ordered[index+delta],ordered[index]];
    change(c=>{model.editable(c).order=ordered.filter(id=>id!=='background');});
  }

  function presetOptions(card){
    const select=$('ldPreset');
    select.replaceChildren(new Option('Choose a layout',''));
    if(!card)return;
    function group(title,options){ 
      if(!options.length)return;
      const items=node('optgroup');
      items.label=title;
      options.forEach(([id,name])=>items.append(new Option(name,id)));
      select.append(items);
    }
    group('Starting layouts',model.starters(card).map(([id,name])=>['start:'+id,name]));
    group('Saved layouts',state.templates
      .filter(item=>!item.typeDefaultFor&&(!['Game Frame','Game Full Art'].includes(item.template)||game.role(card)))
      .map(item=>[item.id,item.name]));
  }

  function refresh(){
    const card=current()||state.cards.find(inWorkingCatalog)||state.cards[0];
    if(card&&!typeDraft)currentId=card.id;
    const same=activeId===card?.id;
    activeId=card?.id||'';
    dropDownOptions(cards,state.cards.map(c=>[c.id,c.title+' · '+c.family+' · '+(c.catalogId||c.id)]),activeId);
    cards.disabled=!card||!!typeDraft;
    $('ldCardChoice').hidden=!!typeDraft;
    $('ldTypeActions').hidden=!typeDraft;
    const reusable=typeDraft?.kind==='design',shared=editingSharedFooter();
    $('layoutDesigner').dataset.editingFooter=String(shared);
    $('ldSetup').hidden=setup.hidden=shared;
    const character=editingCharacterFooter();
    $('ldTitle').textContent=character?'Edit Character footer':shared?'Edit shared footer':reusable?'Edit reusable design':typeDraft?'Edit type default':'Layout Designer';
    $('ldEditScope').textContent=character?'Save for new and linked Character cards.':shared?'Save to update every linked card.':reusable?typeDraft.name+' · Choose where to use it when you save.':
      typeDraft?typeDraft.name+' · Save to use on new cards.':card?'Edits autosave to this card.':'Create a reusable design.';
    $('ldCommitType').textContent=character?'Save Character default':shared?'Save shared footer':reusable?'Save design':'Save default';
    $('ldNewDesign').hidden=!!typeDraft;
    $('ldSave').hidden=$('ldTypeDefault').hidden=$('ldExport').hidden=$('ldStatusLinks').hidden=!!typeDraft;
    setup.textContent=typeDraft?'Layouts':'Card & layout';
    $('ldEmpty').hidden=!!card;
    workspace.hidden=$('ldStatusbar').hidden=$('ldQuickTools').hidden=$('ldMobilePanes').hidden=!card;
    $('ldSave').disabled=$('ldExport').disabled=!card;
    const type=card&&MNC_SET_PLAN.profile(MNC_TYPE_DESIGN.idFor(card));
    $('ldTypeDefault').disabled=!type;
    $('ldTypeDefault').textContent=type?'Use card for '+type.name:'Use as starting design';
    presetOptions(card);
    $('ldApply').disabled=true;
    if(!same){
      maskEditor.cancel();
      showPane('canvas');
      selected='art';
      mode='properties';
      layers=[];
      canvas.getContext('2d').clearRect(0,0,CW,CH);
      message();
    }
    fit();
    showHistory();
    repaint(true);
  }

  function addForeground(assetId){
    change(c=>{
      const artwork=imgBox(c), layer=window.MNC_newExtraLayer('image');
      const asset=artById(assetId), measured=imageSizes.get(assetURI(asset));
      const aspect=measured?measured.w/measured.h:(asset?.w&&asset?.h?asset.w/asset.h:1);
      const height=Math.min(artwork.h*.65,390);
      const width=Math.min(artwork.w*.75,height*aspect);
      layer.w=width/CW;
      layer.h=width/aspect/CH;
      layer.x=(artwork.x+artwork.w/2)/CW;
      layer.y=(artwork.y+height*.18)/CH;
      layer.assetId=assetId;
      (c.layers??=[]).push(layer);
      selected='extra:'+layer.id;
      mode='properties';
    },{sync:true});
    message('Foreground image added. Move it above the art window using the layer controls.');
  }

  window.MNC_refreshLayoutDesigner=refresh;
  window.MNC_openLayoutSymbol=(place='type')=>{
    if(!current())return;
    tab('layoutDesigner');
    showPane('canvas');
    select(place==='collection'?'setIcon':'cornerIcon',{scroll:true});
  };
  window.MNC_closeLayoutTrace=()=>{
    if(drag)finishDrag({pointerId:drag.id},true);
    if(typeDraft&&typeDraft.initial!==json(typeDraft.card)&&!confirm('Discard unsaved edits to “'+typeDraft.name+'”?'))return false;
    if(typeDraft)histories.delete(typeDraft.card.id);
    typeDraft=null;
    maskEditor.cancel();
    showPane('canvas');
    setPan(false);
  };
  window.MNC_editTypeStarter=(id,{layer,footerMode,fromSharedFooter=false}={})=>{
    const profile=MNC_SET_PLAN.profile(id);
    if(!profile||!state.typeDesigns.profiles[id])return;
    const card=window.MNC_typePreviewCard(id);
    histories.delete(card.id);
    typeDraft={kind:'type',id,name:profile.name+' default',card,fromSharedFooter,initial:json(card)};
    tab('layoutDesigner');
    if(footerMode)change(c=>front.setFooterMode(c,footerMode,{copyShared:true}),{sync:true});
    if(layer)editLayer(layer,{scroll:true});
  };
  window.MNC_editCardFooter=(card,footerMode)=>{
    if(!card)return;
    currentId=card.id;
    tab('layoutDesigner');
    if(footerMode)change(c=>front.setFooterMode(c,footerMode,{copyShared:true}),{sync:true});
    editLayer('footer',{scroll:true});
  };
  window.MNC_editSharedFooter=(id='hero',layer='footer',reference,scope=front.footerMode(reference))=>{
    if(typeDraft&&window.MNC_closeLayoutTrace()===false)return;
    const card=deep(reference||window.MNC_typePreviewCard(id));
    card.collectionCode=MNC_CARD_METADATA.collectionCode(card,collectionFor(card));
    card.id='SHARED-FOOTER-PREVIEW';
    const footerMode=scope==='character'?'character':'shared';
    card.collectionFooterMode=footerMode;
    front.setFooterMode(card,'custom',{copyShared:true});
    histories.delete(card.id);
    typeDraft={kind:'footer',id,footerMode,name:footerMode==='character'?'Character footer':'shared footer',card,initial:json(card)};
    tab('layoutDesigner');
    editLayer(layer,{scroll:true});
  };
  window.MNC_editReusableDesign=(designId='',previewType,assignment='other')=>{
    const saved=state.templates.find(design=>design.id===designId);
    if(designId&&!saved)return;
    if(typeDraft&&window.MNC_closeLayoutTrace()===false)return;
    const {profile,family}=designPreviewContext(saved,previewType);
    const card=profile?window.MNC_typePreviewCard(profile.id):cardDraft(null,family);
    card.id='DESIGN-PREVIEW';
    if(saved&&!applyDesignPreset(card,saved,{refresh:false}))return;
    histories.delete(card.id);
    const name=saved?.name||'New design';
    typeDraft={kind:'design',id:profile?.id,designId,name,assignment,card,initial:json(card)};
    activeId='';
    tab('layoutDesigner');
  };
  $('ldCommitType').onclick=()=>{
    if(!typeDraft)return;
    if(typeDraft.kind==='design'){openSaveDialog();return;}
    const {card,id,fromSharedFooter}=typeDraft;
    if(editingSharedFooter()){
      const layout=front.values(card),footerLayout=typeDraft.footerMode,character=editingCharacterFooter();
      const key=character?'characterFooter':'sharedFooter';
      state[key]=front.sharedFooterSettings({...state[key],position:layout.footerPosition,useForNewCards:character||state[key].useForNewCards,
        codeSize:layout.text.edition?.size,numberSize:layout.text.number?.size,markSize:layout.setIcon,
        text:layout.text,layers:card.layoutDesign?.layers,autoContrast:layout.independentFooter.autoContrast},footerLayout);
      histories.delete(card.id);
      typeDraft=null;
      persist();
      window.MNC_openSharedFooter({previewType:id,footerLayout});
      $('sharedFooterStatus').textContent=character?'Footer saved for new and linked Character cards.':'Shared layout saved for linked cards.';
      return;
    }
    if(!captureTypeDesign(card,id))return;
    histories.delete(card.id);
    typeDraft=null;
    if(fromSharedFooter){
      window.MNC_openSharedFooter({footerScope:'type'});
      $('sharedFooterStatus').textContent='Saved footer for '+MNC_SET_PLAN.profile(id).name+' default.';
    }else window.MNC_finishTypeStarter(id);
  };
  $('ldCancelType').onclick=()=>{
    if(editingSharedFooter())window.MNC_openSharedFooter({previewType:typeDraft.id,footerLayout:typeDraft.footerMode});
    else if(typeDraft?.kind==='design')tab('visualLanguage',{otherDesigns:true});
    else if(typeDraft?.fromSharedFooter)window.MNC_openSharedFooter({footerScope:'type'});
    else if(typeDraft)window.MNC_openTypeStandard(typeDraft.id,'layout');
  };
  $('ldNewDesign').onclick=()=>window.MNC_editReusableDesign('',MNC_TYPE_DESIGN.idFor(current())||'hero');
  $('ldGuideHelp').onclick=()=>$('ldGuideDialog').showModal();
  function editLayer(id,options){
    showPane('edit');
    select(id,options);
    revealZoomedLayer();
  }
  for(const [id,button] of views)button.onclick=()=>showPane(id);
  setup.onclick=()=>setup.setAttribute('aria-expanded',String(setup.getAttribute('aria-expanded')!=='true'));
  for(const [id,view] of [['ldPropertiesTab','properties'],['ldFillTab','fill'],['ldEffectsTab','effects'],['ldMaskTab','mask']]){
    $(id).onclick=()=>select(selected,{view});
  }
  $('ldArtQuick').onclick=()=>editLayer('art',{scroll:true});
  $('ldFooterQuick').onclick=()=>{
    const id=footerParts.includes(selected)?selected:footerParts.find(key=>layers.some(layer=>layer.id===key));
    if(id)editLayer(id,{scroll:true});
  };
  $('ldFooterPart').onchange=event=>editLayer(event.target.value,{scroll:true});
  $('ldMaskQuick').onclick=()=>editLayer('art',{view:'mask',scroll:true});
  $('ldBorderQuick').onclick=()=>editLayer('border',{scroll:true});
  $('ldPlatesQuick').onclick=()=>editLayer('plate',{scroll:true});
  $('ldGradientQuick').onclick=()=>editLayer(fillInspector.allows(currentLayer(),current())?selected:'background',{view:'fill',scroll:true});
  cards.onchange=()=>{currentId=cards.value;refresh();};
  zoom.onchange=()=>{
    pan.hidden=zoom.value==='fit';
    setPan(false);
    showPane(compactWorkspace?.matches?workspace.dataset.pane:'canvas');
    if(pan.hidden){stage.scrollLeft=0;stage.scrollTop=0;}
    else revealZoomedLayer();
  };
  pan.onclick=()=>{
    setPan(board.dataset.pan!=='true');
    showPane(compactWorkspace?.matches?workspace.dataset.pane:'canvas');
  };
  $('ldGuides').onchange=()=>{$('ldSafeArea').hidden=!$('ldGuides').checked;};
  new ResizeObserver(()=>{
    if(activeTab!=='layoutDesigner')return;
    fit();
    if(!drag&&workspace.dataset.pane==='edit')revealZoomedLayer();
  }).observe(stage);
  compactWorkspace?.addEventListener('change',()=>{
    if(activeTab==='layoutDesigner'&&compactWorkspace.matches)syncFooterShortcuts(currentLayer());
  });
  $('ldUndo').onclick=()=>restoreEdit('undo');
  $('ldRedo').onclick=()=>restoreEdit('redo');
  $('ldForward').onclick=()=>moveLayer(1);
  $('ldBackward').onclick=()=>moveLayer(-1);
  $('ldStudio').onclick=()=>window.MNC_openStudioCard(current());
  $('ldView').onclick=()=>$('openCardView').click();
  $('ldExport').onclick=async()=>{
    const c=current();
    if(!c)return;
    const button=$('ldExport');
    button.disabled=true;
    try{
      const image=await cardCanvas(deep(c),{rounded:true});
      canvasPNG(image,slug(c.id)+'_'+slug(c.title)+'.png');
    }catch(error){message('PNG export failed. '+error.message);}
    finally{button.disabled=!current();}
  };

  $('ldAdd').onclick=()=>change(card=>{
    const layer=window.MNC_newExtraLayer($('ldNewLayer').value);
    if(layer.style==='image')layer.assetId=card.sourceAssetId||'';
    (card.layers??=[]).push(layer);
    selected='extra:'+layer.id;
    mode='properties';
  },{sync:true});

  const preset=$('ldPreset');
  preset.onchange=()=>{$('ldApply').disabled=!preset.value;};
  $('ldApply').onclick=()=>{
    const chosen=preset.value;
    if(!chosen)return;
    const name=preset.selectedOptions[0].text;
    maskEditor.cancel();
    change(c=>{
      if(chosen.startsWith('start:'))model.applyStarter(c,chosen.slice(6));
      else{
        const saved=state.templates.find(item=>item.id===chosen);
        if(saved)applyDesignPreset(c,saved,{refresh:false});
      }
    },{sync:true});
    showPane('canvas');
    message('Applied '+name+'.');
  };

  const dialog=$('ldSaveDialog');
  function syncAssignment(){
    const assignment=$('ldAssignment').value;
    $('ldAssignmentTypeRow').hidden=assignment==='other';
    $('ldAssignmentStatus').textContent=assignment==='default'?'New cards of this type start with this design.':
      assignment==='variant'?'This design appears in the card type’s Design menu.':'';
  }
  function openSaveDialog(){
    const card=current();
    if(!card)return;
    const existing=state.templates.find(item=>item.id===typeDraft?.designId);
    $('ldSaveName').value=existing?.name||'';
    $('ldOtherAssignment').textContent=existing?'Keep current placements':'Other designs';
    $('ldAssignment').value=typeDraft?.assignment||'other';
    const options=MNC_TYPE_DESIGN.profiles().map(({id})=>playableDesignType(id))
      .filter(profile=>designFitsFamily(card,profile.family));
    const preferred=typeDraft?.id||MNC_TYPE_DESIGN.idFor(card);
    dropDownOptions($('ldAssignmentType'),options.map(({id,name})=>[id,name]),options.some(({id})=>id===preferred)?preferred:options[0]?.id);
    syncAssignment();
    dialog.showModal();
    $('ldSaveName').focus();
  }
  $('ldAssignment').onchange=syncAssignment;
  $('ldSave').onclick=openSaveDialog;
  $('ldTypeDefault').onclick=()=>{
    const card=current(),id=card&&MNC_TYPE_DESIGN.idFor(card);
    if(id&&!typeDraft)window.MNC_useCardAsTypeStarter(card,id);
  };
  $('ldSaveCancel').onclick=()=>dialog.close();
  $('ldSaveForm').onsubmit=event=>{
    event.preventDefault();
    const card=current();
    if(!card)return;
    const assignment=$('ldAssignment').value||'other',typeId=$('ldAssignmentType').value;
    const profile=assignment==='other'?null:playableDesignType(typeId);
    if(assignment!=='other'&&(!state.typeDesigns.profiles[typeId]||!designFitsFamily(card,profile?.family))){
      $('ldAssignmentStatus').textContent='Select a compatible card type.';
      return;
    }
    const name=$('ldSaveName').value.trim();
    const existing=state.templates.find(item=>item.id===typeDraft?.designId||!item.typeDefaultFor&&item.name.toLowerCase()===name.toLowerCase());
    if(existing&&MNC_TYPE_DESIGN.profiles().some(({id})=>{
      const setting=state.visualLanguage.profiles[id];
      return (setting.presetId===existing.id||setting.variantIds?.includes(existing.id))&&!designFitsFamily(card,playableDesignType(id).family);
    })){
      $('ldAssignmentStatus').textContent='Choose a new name. This design is used by a card type that needs its current frame.';
      return;
    }
    const saved=saveDesignPreset(card,{name,id:typeDraft?.designId});
    if(!saved){$('ldAssignmentStatus').textContent='Enter a unique design name to continue.';return;}
    if(profile)assignDesign(saved,typeId,assignment);
    dialog.close();
    const savedMessage=profile?'Saved '+saved.name+' as '+profile.name+' '+assignment+'.':'Saved '+saved.name+'.';
    if(typeDraft){
      histories.delete(card.id);
      typeDraft=null;
      const returnType=profile?.id||MNC_TYPE_DESIGN.profiles().find(({id})=>{
        const setting=state.visualLanguage.profiles[id];
        return setting.presetId===saved.id||setting.variantIds?.includes(saved.id);
      })?.id;
      if(returnType)window.MNC_openTypeStandard(returnType,'layout');
      else tab('visualLanguage',{otherDesigns:true});
      $(returnType?'symbolDesignStatus':'designSaveStatus').textContent=savedMessage;
      return;
    }
    presetOptions(card);
    preset.value=saved.id;
    $('ldApply').disabled=false;
    message(savedMessage);
  };

  board.addEventListener('pointerdown',beginDrag);
  board.addEventListener('pointermove',moveDrag);
  board.addEventListener('pointerup',finishDrag);
  board.addEventListener('lostpointercapture',finishDrag);
  board.addEventListener('pointercancel',event=>finishDrag(event,true));
  board.addEventListener('dblclick',event=>{
    if(maskEditor.active())return;
    const layer=hit(point(event));
    if(!layer)return;
    editLayer(layer.id,{scroll:true});
    inspector.querySelector('[data-edit-copy]')?.focus();
  });

  $('layoutDesigner').addEventListener('keydown',event=>{
    if(event.key==='Escape'&&setup.getAttribute('aria-expanded')==='true'){
      setup.setAttribute('aria-expanded','false');
      setup.focus();
      return;
    }
    if(dialog.open||maskEditor.active()||event.target.matches('input,textarea,select'))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      event.preventDefault();
      restoreEdit(event.shiftKey?'redo':'undo');
      return;
    }
    if(event.target!==canvas)return;
    const step=event.shiftKey?10:1;
    const layer=currentLayer();
    const movement={ArrowLeft:['x',-step],ArrowRight:['x',step],ArrowUp:['y',-step],ArrowDown:['y',step]}[event.key];
    if(movement&&layer&&layer.id!=='background'&&!front.isSharedFooterLayer(current(),layer.id)){
      event.preventDefault();
      const [axis,amount]=movement;
      change(c=>setGeometry(c,layer,{[axis]:layer.rect[axis]+amount}));
    }else if(event.key==='Enter'){
      event.preventDefault();
      showPane('edit');
      inspector.querySelector('[data-edit-copy]')?.focus();
    }
  });
})();
