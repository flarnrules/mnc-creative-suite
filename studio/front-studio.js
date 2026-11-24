'use strict';

(() => {
  const preview=$('cardPreview'), panel=$('frontLayoutPanel'), move=$('frontMove');
  const selection=$('frontGroup'), textSelection=$('frontText');
  const metadata=MNC_CARD_METADATA;
  const current=()=>cardById(currentId);
  const framed=c=>game.isGameCard(c)||c?.template==='Standard';
  const supported=c=>!!c;
  const active=()=>activeTab==='studio'&&move.checked&&supported(current());
  let drag=null, frame=0;

  function clearDrag(event) {
    if(drag?.id!==event.pointerId)return;
    if(drag.moved)changed(drag.card);
    drag=null;event.stopImmediatePropagation();
  }

  const groups=[
    ['frontPlateStyle','title'],['frontMatchStyle','match'],['frontCreditStyle','artist'],
    ['frontTypeStyle','cornerIcon'],['frontFooterStyle','footer'],['frontEpisodeStyle','episodeBadge']
  ];
  const composedGroups={
    type:['family','typeLabel','headerSubtype'],
    title:['plate','title'],
    rule:['ruleTitle','timing','rule'],
    footer:['footerLine','footerPanel','footer','setIcon']
  };
  const layerIds=group=>composedGroups[group]||[group];

  function moveGroup(c,group,position) {
    const before=front.offset(c,group);
    const offsets=front.editable(c).offsets;
    if(position)offsets[group]=position;
    else delete offsets[group];
    const after=front.offset(c,group);
    for(const id of layerIds(group)){
      const layer=MNC_LAYOUT.get(c,id);
      if(!layer)continue;
      for(const axis of ['x','y']){
        if(Number.isFinite(layer[axis]))layer[axis]=MNC_LAYOUT.bounded(axis,layer[axis]+after[axis]-before[axis]);
      }
    }
  }
  const designControls=[
    ['frontArtShape','frontDesignArt','art'],['frontPlateShape','frontDesignPlate','plate']
  ];
  const controls=[
    ['frontPlateWidth','plateWidth'],['frontPlateHeight','plateHeight'],
    ['frontPlateFill','plateFill','#303125'],['frontPlateStroke','plateStroke','#595345'],
    ['frontPlateStrokeWidth','plateStrokeWidth'],['frontPlateOpacity','plateOpacity',100,100],['frontTitleInset','titleSafe',0],
    ['frontMatchMode','matchStyle','tint'],['frontMatchColor','matchColor','#30382f'],
    ['frontMatchOpacity','matchOpacity',100,100],['frontMatchGap','matchGap',19],['frontMatchIcon','matchIcon',34],
    ['frontCreditMode','creditMode'],['frontCreditAlign','creditAlign','left'],['frontCreditLabel','creditLabel',''],
    ['frontTypeIcon','typeIcon',38],['frontSetIcon','setIcon',32],
    ['frontEpisodeSize','episodeBadgeSize',32],['frontEpisodeColor','episodeBadgeColor','#b8a788']
  ];

  function shapePicker(id,key,c) {
    const chosen=c?.[key]||'';
    const options=[['','Use built-in shape'],...state.cardShapes.map(shape=>[shape.id,shape.name])];
    if(chosen&&!options.some(([value])=>value===chosen))options.push([chosen,'Missing shape']);
    dropDownOptions($(id),options,chosen);
  }

  function allowedGroups(c) {
    return Object.entries(front.groups).filter(([id])=>
      (framed(c)||['cornerIcon','artist','footer','number','typeRule','rule','quote','episodeBadge'].includes(id))&&
      (id!=='number'||front.values(c).footerPosition==='center')&&
      (id!=='match'||game.isGameCard(c)&&c.family==='Character'));
  }

  function visibleText(c,id) {
    if(['rarity','rarityGlyph','role','roleGlyph','source'].includes(id))return false;
    if(id==='concept'||id==='actor'||id==='film')return !!metadata.attribution(c)[id];
    if(id==='episode')return !!(c.episode||c.picker);
    return true;
  }

  function sync() {
    const c=current(), available=supported(c);
    panel.hidden=!available;
    $('frontQuick').hidden=!available;
    $('frontArtQuick').hidden=!framed(c)||c?.template==='Game Full Art';
    $('frontPlateQuick').hidden=!framed(c);
    if(!c)return;
    for(const [id,,part] of designControls)shapePicker(id,shapes.fields[part],c);
    if(!available)return;
    const options=allowedGroups(c);
    const requested=selection.value||'title';
    dropDownOptions(selection,options,options.some(([id])=>id===requested)?requested:options[0][0]);
    syncGroup(c);
  }

  function syncGroup(c) {
    const id=selection.value, layout=front.values(c), standard=c.template==='Standard';
    const offset=front.offset(c,id);
    $('frontX').value=Math.round(offset.x);$('frontY').value=Math.round(offset.y);
    const texts=Object.entries(front.textFields).filter(([key,entry])=>entry[1]===id&&visibleText(c,key));
    const choice=textSelection.value;
    dropDownOptions(textSelection,texts.map(([key,entry])=>[key,key==='artist'&&metadata.creditType(c)==='Actor'?'Actor name':entry[0]]),
      texts.some(([key])=>key===choice)?choice:texts[0]?.[0]||'');
    $('frontTextTools').hidden=!texts.length;
    for(const [area,group] of groups)$(area).hidden=id!==group;
    $('frontTypeStyle').hidden=id!=='cornerIcon';
    $('frontFooterStyle').hidden=id!=='footer';
    $('frontShapeArt').hidden=id!=='art'||c.template==='Game Full Art';
    $('frontFullArtNote').hidden=id!=='art'||c.template!=='Game Full Art';
    $('frontShapePlate').hidden=id!=='title';
    for(const [element,key,fallback,multiplier] of controls){
      $(element).value=layout[key]===undefined?fallback:multiplier?Math.round(layout[key]*multiplier):layout[key];
    }
    $('frontPlateMode').value=c.nameplate||'solid';
    $('frontCreditLabel').placeholder=front.creditLabel(c,$('frontCreditMode').value);
    $('frontEpisodeBadge').value=c.episodeBadge||'Auto';
    $('frontEpisodeAppearance').hidden=!metadata.hasCassette(c);
    syncStyleVisibility(layout);
    syncText(c);
  }

  function syncStyleVisibility(layout) {
    $('frontMatchColorRow').hidden=!['solid','outline'].includes(layout.matchStyle);
    $('frontMatchOpacityRow').hidden=layout.matchStyle==='none';
  }

  function syncText(c) {
    const id=textSelection.value, field=front.textFields[id];
    if(!field)return;
    const edit=front.effective(c).text?.[id]||{};
    const defaults=c.template==='Standard'?{family:37,typeLabel:20,title:45,rule:24,artist:16,edition:16}:{};
    $('frontTextSize').value=edit.size??defaults[id]??field[2];
    $('frontTextFont').value=edit.font||'';
    $('frontTextStyle').value=edit.style||'';
    const palette=game.isGameCard(c)?window.MNC_gamePalette(c):window.MNC_standardPalette(c);
    $('frontTextColor').value=edit.color||palette.ink;
    $('frontTextX').value=edit.x??0;
    $('frontTextY').value=edit.y??0;
  }

  function repaint() {
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;drawStudioPreview();});
  }

  function changed(c) {
    if(game.isGameCard(c))window.MNC_refreshRuleStatus?.(c);
    persist();repaint();
  }

  function assignShape(c,part,value) {
    c[shapes.fields[part]]=value;
    if(value && part==='plate' && c.nameplate==='none')c.nameplate='solid';
    persist();refreshStudio();
  }

  for(const [id,button,part] of designControls){
    $(id).onchange=()=>{const c=current();if(c)assignShape(c,part,$(id).value);};
    $(button).onclick=()=>window.MNC_openShapeDesigner(part,current());
  }
  $('frontOpen').onclick=()=>{
    panel.open=true;move.checked=true;
    panel.scrollIntoView({block:'nearest'});
    repaint();
  };
  $('frontArtQuick').onclick=()=>window.MNC_openShapeDesigner('art',current());
  $('frontPlateQuick').onclick=()=>window.MNC_openShapeDesigner('plate',current());

  selection.onchange=()=>{const c=current();if(c){syncGroup(c);repaint();}};
  textSelection.onchange=()=>{const c=current();if(c)syncText(c);};
  move.onchange=repaint;
  panel.addEventListener('toggle',()=>{
    if(!panel.open&&move.checked){move.checked=false;repaint();}
  });

  for(const [id,axis] of [['frontX','x'],['frontY','y']]){
    $(id).onchange=event=>{
      const c=current(), value=event.target.valueAsNumber;
      if(!c||!Number.isFinite(value))return;
      const part=selection.value;
      const next=clamp(value,Number(event.target.min),Number(event.target.max));
      moveGroup(c,part,{...front.offset(c,part),[axis]:next});
      event.target.value=next;
      changed(c);
    };
  }

  $('frontResetPosition').onclick=()=>{
    const c=current();
    if(!c?.frontLayout)return;
    moveGroup(c,selection.value,null);
    syncGroup(c);changed(c);
  };

  $('frontPlateMode').onchange=event=>{
    const c=current();
    if(!c)return;
    c.nameplate=event.target.value;
    syncGroup(c);
    changed(c);
  };

  $('frontEpisodeBadge').onchange=event=>{
    const c=current();
    if(!c)return;
    editCardFields(c,{episodeBadge:event.target.value});
    persist();refreshStudio();
  };

  for(const [id,key,,multiplier] of controls){
    $(id).onchange=event=>{
      const {target}=event, c=current();
      if(!c)return;
      let value=target.value;
      if(target.type==='number'){
        if(!Number.isFinite(target.valueAsNumber))return;
        value=clamp(target.valueAsNumber,Number(target.min),Number(target.max));
        target.value=value;
        value/=multiplier||1;
      }
      const layout=front.editable(c);
      layout[key]=value;
      syncStyleVisibility(layout);
      if(key==='creditMode')$('frontCreditLabel').placeholder=front.creditLabel(c,value);
      changed(c);
    };
  }

  for(const [id,key] of [['frontTextSize','size'],['frontTextFont','font'],['frontTextStyle','style'],['frontTextColor','color'],['frontTextX','x'],['frontTextY','y']]){
    $(id).onchange=event=>{
      const {target}=event, c=current(), field=textSelection.value;
      if(!c||!field)return;
      const spec=front.editable(c).text;
      const style=spec[field]??={};
      if(target.type==='number'){
        if(!Number.isFinite(target.valueAsNumber))delete style[key];
        else style[key]=clamp(target.valueAsNumber,Number(target.min),Number(target.max));
      }else if(target.value)style[key]=target.value;
      else delete style[key];
      syncText(c);changed(c);
    };
  }

  $('frontResetText').onclick=()=>{
    const c=current();
    if(!c?.frontLayout)return;
    delete c.frontLayout.text[textSelection.value];
    syncText(c);changed(c);
  };

  function position(event) {
    const rect=preview.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*CW/rect.width,y:(event.clientY-rect.top)*CH/rect.height};
  }
  const inside=(b,p)=>b&&p.x>=b.x-4&&p.x<=b.x+b.w+4&&p.y>=b.y-4&&p.y<=b.y+b.h+4;

  preview.addEventListener('pointerdown',event=>{
    if(!active()||event.button!==0||event.altKey||drag)return;
    const c=current(), point=position(event), boxes=frontBoxes(c,preview.getContext('2d'));
    const selected=selection.value;
    const candidates=['cornerIcon','episodeBadge','artist','number','footer','quote','rule','typeRule','match','title','type','art'];
    const part=inside(boxes.episodeBadge,point)?'episodeBadge':
      inside(boxes[selected],point)?selected:candidates.find(id=>inside(boxes[id],point));
    if(!part)return;
    selection.value=part;
    drag={card:c,part,point,offset:front.offset(c,part),id:event.pointerId,moved:false};
    preview.setPointerCapture(event.pointerId);
    syncGroup(c);repaint();
    event.preventDefault();event.stopImmediatePropagation();
  },true);

  preview.addEventListener('pointermove',event=>{
    if(drag?.id!==event.pointerId||drag.card!==current())return;
    const point=position(event), {card,part,offset}=drag;
    const x=Math.round(clamp(offset.x+point.x-drag.point.x,-750,750));
    const y=Math.round(clamp(offset.y+point.y-drag.point.y,-1050,1050));
    moveGroup(card,part,{x,y});
    $('frontX').value=x;$('frontY').value=y;
    drag.moved=true;
    repaint();event.stopImmediatePropagation();
  },true);

  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    preview.addEventListener(type,clearDrag,true);
  }

  window.MNC_frontMoveActive=active;
  window.MNC_syncFrontStudio=sync;
  window.MNC_drawFrontGuides=(canvas,c)=>{
    if(!active())return;
    const paint=canvas.getContext('2d'), box=frontBoxes(c,paint)[selection.value];
    if(!box)return;
    paint.save();paint.lineWidth=2;paint.strokeStyle='#f3d79a';paint.setLineDash([7,5]);
    paint.strokeRect(box.x,box.y,box.w,box.h);paint.restore();
  };
  function frontBoxes(c,ctx) {
    if(c.layoutDesign){
      const layers=cardScene(ctx,c,{}).inspect().filter(layer=>!layer.hidden&&!layer.empty);
      return Object.fromEntries(Object.keys(front.groups).map(group=>{
        const boxes=layers.filter(layer=>layerIds(group).includes(layer.id)).map(layer=>layer.rect);
        if(!boxes.length)return [group,null];
        const x=Math.min(...boxes.map(box=>box.x)),y=Math.min(...boxes.map(box=>box.y));
        return [group,{x,y,w:Math.max(...boxes.map(box=>box.x+box.w))-x,h:Math.max(...boxes.map(box=>box.y+box.h))-y}];
      }));
    }
    if(c.template==='Standard')return window.MNC_standardFrontBoxes(c,ctx);
    if(game.isGameCard(c))return window.MNC_frontBoxes(c,ctx);
    const credit=c.creditPosition||[.07,.958], collection=c.microPosition||[.93,.958];
    const copy=window.MNC_legacyCopyLayout?.(ctx,c);
    return {
      cornerIcon:front.typeIconBox(c),
      typeRule:copy?.typeRuleRows.length?copy.typeRuleBox:null,
      rule:copy?.rows.length||copy?.header?copy.ruleBox:null,
      quote:copy?.quoteRows.length?copy.quoteBox:null,
      number:front.numberBox(c),
      artist:front.attributionBox(c,{x:CW*credit[0],y:CH*credit[1]}),
      footer:front.box(c,'footer',{x:CW*collection[0]-306,y:CH*collection[1]-27,w:306,h:40}),
      episodeBadge:front.episodeBadgeBox(c)
    };
  }
  const priorRefresh=window.refreshStudio;
  window.refreshStudio=()=>{priorRefresh();sync();};
})();
