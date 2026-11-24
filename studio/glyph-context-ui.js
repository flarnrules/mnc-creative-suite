'use strict';

(() => {
  const model=MNC_TYPE_DESIGN,design=MNC_LAYOUT,symbols=MNC_SYMBOLS,effects=MNC_FRONT_EFFECTS;
  const plan=MNC_SET_PLAN,copy=value=>JSON.parse(JSON.stringify(value));
  const profile=()=>$('symbolProfile').value,menu=$('symbolContextCard'),mode=$('symbolPreviewMode');
  const section=$('symbolContextSection'),mini=$('symbolContextMini'),full=design.full;
  const status=$('symbolContextStatus'),choices=new Map();
  const fields=[['symbolPlacementSize','size'],['symbolPlacementSizeNumber','size'],['symbolPlacementX','x'],['symbolPlacementY','y']];
  let revision=0,frame=0,rendering=false,menuSignature='',last=null,drag=null,notice=null;

  function selection() {
    const id=profile();
    if(activeTab!=='visualLanguage'||$('designStandards').hidden||!state.visualLanguage.profiles[id])return null;
    const actual=cardById(menu.value),collection=id==='collection';
    return {id,actual,collection,isType:!!state.typeDesigns.profiles[id],
      layer:collection?'setIcon':'cornerIcon',saved:!!actual&&mode.value==='card'};
  }

  function same(a,b) {
    return !!a&&!!b&&a.id===b.id&&a.actual===b.actual&&a.saved===b.saved;
  }

  function syncMenu() {
    const id=profile();
    const available=state.cards.filter(card=>!card.catalogUnlisted&&(!state.typeDesigns.profiles[id]||model.matching(card,id)));
    const options=[...available.map(card=>[card.id,card.title]),['','Type preview']];
    const preferred=choices.get(id);
    const next=options.some(([value])=>value===preferred)?preferred:
      (available.find(card=>card.id===currentId)||available[0])?.id||'';
    const signature=JSON.stringify([id,options]);
    if(signature!==menuSignature)dropDownOptions(menu,options,next);
    menuSignature=signature;
    $('symbolPreviewModeRow').hidden=!menu.value;
    if(!menu.value)mode.value='standard';
  }

  function target({collection,isType,id}) {
    if(collection)return state.footerDesign;
    if(isType)return state.typeDesigns.profiles[id].frontLayout;
    return state.visualLanguage.profiles[id].placement;
  }

  function sourceCard(context) {
    return context.actual||window.MNC_typePreviewCard(context.isType?context.id:'hero');
  }

  function configFor(context,source) {
    const settings=target(context);
    if(context.collection)return {size:settings.setIcon??29,x:settings.setIconX??0,y:settings.setIconY??0};
    // Keep the card's template and text styles, but omit its local glyph placement.
    const inherited={...source,frontLayout:{...source.frontLayout,offsets:{...source.frontLayout?.offsets}}};
    delete inherited.frontLayout.typeIcon;
    delete inherited.frontLayout.offsets.cornerIcon;
    if(context.id==='creature')inherited.characterType='';
    const offset=settings.offsets?.cornerIcon??front.offset(inherited,'cornerIcon');
    return {size:settings.typeIcon??front.typeIconBox(inherited).w,x:offset.x,y:offset.y};
  }

  function setPlacement(layout,{collection},{size,x,y}) {
    if(collection)Object.assign(layout,{setIcon:size,setIconX:x,setIconY:y});
    else{
      layout.typeIcon=size;
      (layout.offsets??={}).cornerIcon={x,y};
    }
  }

  function clearGeometry(card,id,{show=false}={}) {
    const layer=design.get(card,id);
    if(!layer)return;
    for(const key of ['x','y','w','h'])delete layer[key];
    if(show)delete layer.hidden;
    design.cleanLayer(card,id);
  }

  function standardSymbol({id}) {
    const symbol=symbols.profileSymbol(state,id);
    if(symbol.source==='builtin')symbol.builtinId??=id;
    return symbol;
  }

  function previewCard(context,source,config) {
    const card=copy(source);
    if(context.saved)return card;
    // Layout Designer stores absolute positions. The standard is edited in template coordinates.
    clearGeometry(card,context.layer,{show:true});
    setPlacement(front.editable(card),context,config);
    const key=context.collection?'collectionSymbol':'typeSymbol';
    card[key]=standardSymbol(context);
    card[key+'Mode']='custom';
    return card;
  }

  function limits({collection}) {
    return {size:[0,collection?200:250],x:collection?[-300,300]:[-CW,CW],y:collection?[-300,300]:[-CH,CH]};
  }

  function syncControls(context,source,config) {
    $('symbolContextWindow').dataset.preview=context.saved?'card':'standard';
    $('symbolPlacementTools').hidden=context.saved;
    $('symbolContextLocation').textContent=context.collection?'Live card section · collection mark':'Live card section · top-right type icon';
    mini.tabIndex=section.tabIndex=context.saved?-1:0;
    if(context.saved)return;
    const ranges=limits(context);
    for(const [id,key] of fields){
      const input=$(id),[min,max]=ranges[key];
      input.min=min;input.max=max;
      if(id==='symbolPlacementSize'||document.activeElement!==input)input.value=Math.round(config[key]);
    }
    $('symbolPlacementSizeLabel').textContent=Math.round(config.size)+' px';
    $('symbolPlacementCard').disabled=!context.actual;
    const destination=context.isType?context.id:model.idFor(source),name=plan.profile(destination)?.name;
    $('symbolPlacementType').textContent=context.collection?'Use placement on all cards':
      context.isType?'Use placement for '+name:'Use glyph and placement for '+(name||'this type');
    $('symbolPlacementType').disabled=!context.collection&&!state.typeDesigns.profiles[destination];
  }

  async function render(card,{layer:id}) {
    const ink=effects.canvas(CW,CH).getContext('2d',{willReadFrequently:true});
    const cut=new Path2D();
    cut.roundRect(0,0,CW,CH,cardCutRadius(card));
    ink.clip(cut);
    let layer,captured=false;
    const image=await cardCanvas(card,{rounded:true,captureText:false,
      onLayout:layers=>{layer=layers.find(item=>item.id===id);},
      onLayer:(name,canvas)=>{
        if(name===id){
          ink.drawImage(canvas,0,0);
          ink.globalCompositeOperation='destination-out';
          captured=true;
        }else if(captured)ink.drawImage(canvas,0,0);
      }
    });
    return {image,layer,box:captured?effects.alphaBounds(ink):null};
  }

  function closeUp(collection,box) {
    const base=collection?{x:CW-500,y:CH-235,w:500,h:225}:{x:CW-500,y:0,w:500,h:315};
    if(!box)return base;
    const margin=30,w=Math.min(CW,Math.ceil(Math.max(base.w,box.w+margin*2))),
      h=Math.min(CH,Math.ceil(Math.max(base.h,box.h+margin*2)));
    const x=clamp(base.x,box.x+box.w+margin-w,box.x-margin);
    const y=clamp(base.y,box.y+box.h+margin-h,box.y-margin);
    return {x:Math.round(clamp(x,0,CW-w)),y:Math.round(clamp(y,0,CH-h)),w,h};
  }

  function project(box,crop,canvas) {
    const xScale=canvas.width/crop.w,yScale=canvas.height/crop.h;
    return {x:(box.x-crop.x)*xScale,y:(box.y-crop.y)*yScale,w:box.w*xScale,h:box.h*yScale};
  }

  function drawPreview(canvas,image,crop,box,close) {
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,crop.x,crop.y,crop.w,crop.h,0,0,canvas.width,canvas.height);
    ctx.save();
    if(close){
      const r=project(close,crop,canvas);
      ctx.strokeStyle='rgba(250,237,196,.5)';ctx.lineWidth=1;
      ctx.strokeRect(r.x,r.y,r.w,r.h);
    }
    if(box){
      const r=project(box,crop,canvas),pad=canvas===mini?1:2;
      ctx.strokeStyle='#f5ad56';ctx.lineWidth=canvas===mini?1.5:2;
      ctx.setLineDash(canvas===mini?[3,2]:[5,4]);
      ctx.strokeRect(r.x-pad,r.y-pad,r.w+pad*2,r.h+pad*2);
    }
    ctx.restore();
  }

  function description(context,layer,box) {
    const scope=context.saved?'Card’s saved placement.':'Editing the selected standard.';
    const visibility=box?'':layer?.hidden||layer?.empty?' The glyph is hidden or has zero size.':' No glyph pixels are visible on the card.';
    const message=same(notice?.context,context)?' '+notice.message:'';
    return scope+visibility+message;
  }

  function schedule() {
    if(frame||rendering||!selection())return;
    frame=requestAnimationFrame(()=>{frame=0;paint();});
  }

  async function paint() {
    const context=selection();
    if(!context)return;
    const token=revision;
    rendering=true;
    try{
      const source=sourceCard(context),config=configFor(context,source);
      syncControls(context,source,config);
      const {image,layer,box}=await render(previewCard(context,source,config),context);
      if(!same(context,selection())||token!==revision&&!same(drag?.context,context))return;
      const crop=drag?.canvas===section?drag.crop:closeUp(context.collection,box||layer?.rect);
      section.height=Math.round(section.width*crop.h/crop.w);
      drawPreview(section,image,crop,box);
      drawPreview(mini,image,full(),box,crop);
      last={context,token,config,box,crop};
      const message=description(context,layer,box);
      if(status.textContent!==message)status.textContent=message;
    }catch(error){
      if(token===revision&&same(context,selection())){
        last=null;
        status.textContent='This card preview could not be drawn.';
        console.error('Type standard card preview',error);
      }
    }finally{
      rendering=false;
      if(token!==revision)schedule();
    }
  }

  function stopDrag() {
    if(!drag)return;
    const {canvas,id}=drag;
    drag=null;
    if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
  }

  function refresh({sync=false}={}) {
    revision++;
    if(!selection()){stopDrag();return;}
    if(sync||!menuSignature)syncMenu();
    const context=selection();
    if(sync||!same(drag?.context,context))stopDrag();
    if(last&&!same(last.context,context)){
      for(const canvas of [section,mini])canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
      last=null;
    }
    if(!last&&status.textContent!=='Drawing card preview…')status.textContent='Drawing card preview…';
    if(sync){
      const source=sourceCard(context);
      syncControls(context,source,configFor(context,source));
    }
    schedule();
  }
  window.MNC_refreshSymbolContext=refresh;

  function editableSelection() {
    const context=selection();
    return context?.saved?null:context;
  }

  function write(values,context=editableSelection()) {
    if(!context||!same(context,editableSelection()))return;
    const before=configFor(context,sourceCard(context)),next={...before,...values};
    for(const [key,[lo,hi]] of Object.entries(limits(context)))if(Object.hasOwn(values,key))next[key]=clamp(Math.round(next[key]),lo,hi);
    if(Object.keys(next).every(key=>next[key]===before[key]))return;
    setPlacement(target(context),context,next);
    notice=null;
    persist();refresh();
  }

  for(const [id,key] of fields){
    const input=$(id);
    input.oninput=()=>{if(Number.isFinite(input.valueAsNumber))write({[key]:input.valueAsNumber});};
    input.onchange=()=>{
      input.oninput();
      const context=editableSelection();
      if(context)input.value=Math.round(configFor(context,sourceCard(context))[key]);
    };
    input.onblur=()=>{
      const context=editableSelection();
      if(context)input.value=Math.round(configFor(context,sourceCard(context))[key]);
    };
  }

  function nudge(axis,delta) {
    const context=editableSelection();
    if(context)write({[axis]:configFor(context,sourceCard(context))[axis]+delta},context);
  }

  for(const [id,axis,delta] of [['symbolMoveLeft','x',-5],['symbolMoveRight','x',5],['symbolMoveUp','y',-5],['symbolMoveDown','y',5]]){
    $(id).onclick=()=>nudge(axis,delta);
  }
  $('symbolPlacementReset').onclick=()=>{
    const context=editableSelection();
    if(context)write({size:context.collection?29:38,x:0,y:0},context);
  };
  menu.onchange=()=>{choices.set(profile(),menu.value);notice=null;refresh({sync:true});};
  mode.onchange=()=>{notice=null;refresh({sync:true});};

  function applied(context,message) {
    notice={context,message};
    status.textContent=message;
    persist();refresh();
  }

  $('symbolPlacementCard').onclick=()=>{
    const context=editableSelection(),card=context?.actual;
    if(!card)return;
    const config=configFor(context,card),key=context.collection?'collectionSymbol':'typeSymbol';
    const follows=context.collection||context.id===model.idFor(card);
    editCardFields(card,{[key]:follows?null:standardSymbol(context),[key+'Mode']:follows?'standard':'custom'});
    setPlacement(front.editable(card),context,config);
    clearGeometry(card,context.layer,{show:true});
    applied(context,'Applied the glyph and placement to '+card.title+'.');
  };

  $('symbolPlacementType').onclick=()=>{
    const context=editableSelection();
    if(!context)return;
    const source=sourceCard(context),{collection,isType,id}=context;
    const destination=isType?id:model.idFor(source);
    const targets=state.cards.filter(card=>collection||model.matching(card,destination));
    const clear=layout=>{
      if(!layout)return;
      if(collection){delete layout.setIcon;delete layout.setIconX;delete layout.setIconY;}
      else{delete layout.typeIcon;if(layout.offsets)delete layout.offsets.cornerIcon;}
    };
    if(collection)for(const profile of Object.values(state.typeDesigns.profiles))clear(profile.frontLayout);
    else if(id==='creature')for(const info of plan.definitions.filter(info=>info.category==='Creature'))clear(state.typeDesigns.profiles[info.id].frontLayout);
    else if(!isType){
      const settings=state.typeDesigns.profiles[destination];
      if(!settings)return;
      state.visualLanguage.profiles[destination].symbol=standardSymbol(context);
      setPlacement(settings.frontLayout,context,configFor(context,source));
      for(const card of targets)editCardFields(card,{typeSymbol:null,typeSymbolMode:'standard'});
    }
    for(const card of targets){
      clear(card.frontLayout);
      clearGeometry(card,context.layer);
    }
    applied(context,'Applied placement to '+targets.length+' cards.');
  };

  for(const canvas of [section,mini]){
    canvas.addEventListener('pointerdown',event=>{
      const context=editableSelection();
      if(drag||event.button!==0||!last?.box||last.token!==revision||!same(last.context,context))return;
      const crop=canvas===mini?full():last.crop,rect=canvas.getBoundingClientRect(),box=last.box;
      if(!rect.width||!rect.height)return;
      const scaleX=crop.w/rect.width,scaleY=crop.h/rect.height;
      const x=crop.x+(event.clientX-rect.left)*scaleX,y=crop.y+(event.clientY-rect.top)*scaleY;
      const padX=scaleX*12,padY=scaleY*12;
      if(x<box.x-padX||x>box.x+box.w+padX||y<box.y-padY||y>box.y+box.h+padY)return;
      drag={id:event.pointerId,canvas,context,crop,scaleX,scaleY,startX:event.clientX,startY:event.clientY,config:last.config};
      canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);event.preventDefault();
    });
    canvas.addEventListener('pointermove',event=>{
      if(drag?.id!==event.pointerId||drag.canvas!==canvas)return;
      if(!same(drag.context,editableSelection())){stopDrag();return;}
      const {config,startX,startY,scaleX,scaleY,context}=drag;
      write({x:config.x+(event.clientX-startX)*scaleX,y:config.y+(event.clientY-startY)*scaleY},context);
      event.preventDefault();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      canvas.addEventListener(type,event=>{
        if(drag?.id!==event.pointerId||drag.canvas!==canvas)return;
        stopDrag();refresh();
      });
    }
    canvas.addEventListener('keydown',event=>{
      const move={ArrowLeft:['x',-1],ArrowRight:['x',1],ArrowUp:['y',-1],ArrowDown:['y',1]}[event.key];
      if(move&&editableSelection()){
        event.preventDefault();
        nudge(move[0],move[1]*(event.shiftKey?10:1));
      }
    });
  }
})();
