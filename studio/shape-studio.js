'use strict';

(() => {
  const board=$('shapeCanvas'), ctx=board.getContext('2d');
  const choice=$('shapeCard'), target=$('shapeTarget'), title=$('shapeName'), list=$('shapeList');
  const notice=$('shapeStatus');
  const undo=[], redo=[];
  let draft, selected=-1, mode='move', pointer=null, previewStamp=0, previewFrame=0, project, returnTab='studio';
  const card=()=>cardById(choice.value);
  const canUse=(c,part)=>c&&(c.template==='Standard'||game.isGameCard(c)&&(part==='plate'||c.template!=='Game Full Art'));
  const saved=()=>state.cardShapes.find(item=>item.id===list.value);
  const usable=()=>draft.kind==='svg'||shapes.validPoints(draft.points);
  const bounds=()=>target.value==='plate'?{x:23,y:109,w:board.width-46,h:63}:{x:23,y:24,w:board.width-46,h:board.height-48};
  const ready=()=>usable()&&mode!=='draw';

  function addUndo() {
    undo.push({draft:deep(draft),selected,mode});
    if(undo.length>60)undo.shift();
    redo.length=0;
  }

  function restoreHistory(from,to) {
    if(!from.length)return;
    to.push({draft:deep(draft),selected,mode});
    const snapshot=from.pop();
    draft=snapshot.draft;selected=snapshot.selected;
    setMode(snapshot.mode);
    title.value=draft.name;
    update();
  }

  function updateCatalog(id='') {
    dropDownOptions(list,[['','Select a saved shape'],...state.cardShapes.map(item=>[item.id,item.name])],id);
    $('shapeLoad').disabled=$('shapeDelete').disabled=!saved();
  }

  function eligibleCards() {
    return state.cards.filter(c=>canUse(c,target.value));
  }

  function setCards(preferred) {
    const cards=eligibleCards();
    dropDownOptions(choice,cards.map(item=>[item.id,item.title]),cards.some(item=>item.id===preferred)?preferred:cards[0]?.id||'');
  }

  function begin(value) {
    draft=deep(value);
    selected=-1; undo.length=redo.length=0;
    title.value=draft.name||'';
    if(draft.kind==='svg')setMode('move');
    else setMode(draft.points.length?'move':'draw');
    update();
  }

  function fromCard() {
    const c=card(), part=target.value;
    const item=c&&shapes.forCard(c,part,state);
    if(item){
      updateCatalog(item.id);
      begin(item);
    }else{
      list.value='';
      $('shapeLoad').disabled=$('shapeDelete').disabled=true;
      const starter=part==='plate'?(c?.nameplatePreset||(c?.nameplate==='pill'?'pill':'rounded')):
        c?.artShape==='cut'?'clipped':c?.artShape==='square'?'rectangle':
        c?.artShape==='ellipse'?'oval':c?.artShape==='rounded'?'rounded':c?.template==='Standard'?'rounded':'arch';
      begin({name:'',kind:'points',points:shapes.start(starter)});
    }
  }

  function open(part,c,{blank=false,fromDesigns=false,starterId,shapeId}={}) {
    const destination=fromDesigns?'visualLanguage':activeTab==='layoutDesigner'?'layoutDesigner':'studio';
    tab('shapes');
    if(activeTab!=='shapes')return;
    project=state;
    returnTab=destination;
    $('shapeBack').textContent={visualLanguage:'Back to components',layoutDesigner:'Back to Layout Designer',studio:'Back to Card Designer'}[returnTab];
    $('shapeSaveUse').hidden=fromDesigns;
    if(part)target.value=part;
    setCards(c?.id||currentId);
    const item=shapeId&&state.cardShapes.find(shape=>shape.id===shapeId);
    if(item){
      updateCatalog(item.id);
      begin(item);
    }else if(starterId||blank){
      $('shapeStarter').value=starterId||'blank';
      updateCatalog();
      begin({name:'',kind:'points',points:shapes.start(starterId)});
      if(blank)title.focus();
    }else fromCard();
  }

  function setMode(next) {
    mode=next;
    $('shapeAddMode').setAttribute('aria-pressed',String(mode!=='move'));
    $('shapeMoveMode').setAttribute('aria-pressed',String(mode==='move'));
    board.classList.toggle('shape-add-mode',mode!=='move');
  }

  function draw() {
    const rect=bounds();
    ctx.clearRect(0,0,board.width,board.height);
    ctx.save();
    ctx.strokeStyle='#343e35';ctx.lineWidth=1;
    for(let i=0;i<=10;i++){
      const x=rect.x+rect.w*i/10, y=rect.y+rect.h*i/10;
      ctx.beginPath();ctx.moveTo(x,rect.y);ctx.lineTo(x,rect.y+rect.h);
      ctx.moveTo(rect.x,y);ctx.lineTo(rect.x+rect.w,y);ctx.stroke();
    }
    if(target.value==='plate'){
      ctx.fillStyle='#aaa48a';ctx.font='600 12px system-ui';ctx.textAlign='center';
      ctx.fillText('Title area',board.width/2,rect.y+rect.h+22);
    }
    const points=draft.kind==='points'?draft.points:[];
    if(ready()){
      const traced=shapes.path(draft,rect);
      ctx.fillStyle='#c4b48338';ctx.fill(traced,'evenodd');
      ctx.strokeStyle='#e5d09d';ctx.lineWidth=2;ctx.stroke(traced);
    }else if(points.length){
      ctx.beginPath();
      points.forEach((p,index)=>ctx[index?'lineTo':'moveTo'](rect.x+p.x*rect.w,rect.y+p.y*rect.h));
      ctx.strokeStyle='#e5d09d';ctx.lineWidth=2;ctx.stroke();
    }
    points.forEach((p,i)=>{
      const x=rect.x+p.x*rect.w,y=rect.y+p.y*rect.h;
      ctx.beginPath();ctx.arc(x,y,i===selected?7:5,0,Math.PI*2);
      ctx.fillStyle=i===selected?'#f8df9f':p.smooth?'#aed7ab':'#293b30';ctx.fill();
      ctx.strokeStyle='#f4e1b4';ctx.lineWidth=1.3;ctx.stroke();
    });
    ctx.restore();
  }

  async function preview(stamp) {
    const c=card(), canvas=$('shapeCardPreview'), paint=canvas.getContext('2d');
    if(!c){paint.clearRect(0,0,canvas.width,canvas.height);return;}
    const demo=deep(c), part=target.value;
    if(ready()){
      demo.shapePreview={[part]:deep(draft)};
      if(part==='plate' && demo.nameplate==='none')demo.nameplate='solid';
    }
    const rendered=await cardCanvas(demo,{w:canvas.width,h:canvas.height});
    if(activeTab==='shapes'&&stamp===previewStamp){
      paint.clearRect(0,0,canvas.width,canvas.height);
      paint.drawImage(rendered,0,0);
    }
  }

  function queuePreview() {
    if(activeTab!=='shapes')return;
    previewStamp++;
    if(previewFrame)return;
    previewFrame=requestAnimationFrame(()=>{
      previewFrame=0;
      preview(previewStamp).catch(error=>{notice.textContent=error.message;});
    });
  }

  function updatePointFields() {
    const points=draft.kind==='points'?draft.points:[];
    const node=points[selected];
    $('shapePointTools').hidden=draft.kind==='svg';
    $('shapeCoordinates').hidden=draft.kind==='svg';
    $('shapeSvgHelp').hidden=draft.kind!=='svg';
    $('shapePointLabel').textContent=node?'Point '+(selected+1)+' of '+points.length:points.length+' points';
    $('shapePrevious').disabled=$('shapeNext').disabled=!points.length;
    for(const id of ['shapePointX','shapePointY','shapeSmooth','shapeRemovePoint'])$(id).disabled=!node;
    if(node){
      $('shapePointX').value=Number((node.x*100).toFixed(1));
      $('shapePointY').value=Number((node.y*100).toFixed(1));
      $('shapeSmooth').value=Math.round(node.smooth*100);
    }
    $('shapeAddMode').disabled=draft.kind==='svg'||points.length>=shapes.anchors;
    $('shapeMoveMode').disabled=draft.kind==='svg'||mode==='draw';
    $('shapeClose').hidden=mode!=='draw';
    $('shapeClose').disabled=!usable();
  }

  function update() {
    updatePointFields();
    $('shapeUndo').disabled=!undo.length;
    $('shapeRedo').disabled=!redo.length;
    $('shapeSave').disabled=$('shapeCopy').disabled=!ready();
    $('shapeSaveUse').disabled=!ready()||!card();
    $('shapePreviewTitle').textContent=card()?.title||'Choose a compatible card';
    draw();queuePreview();
  }

  function translated(event) {
    const element=board.getBoundingClientRect(), rect=bounds();
    const x=(event.clientX-element.left)*board.width/element.width, y=(event.clientY-element.top)*board.height/element.height;
    return {x,y,px:clamp((x-rect.x)/rect.w,0,1),py:clamp((y-rect.y)/rect.h,0,1),rect};
  }

  function closestEdge(points,p) {
    let edge=0,best=Infinity;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      const dx=(b.x-a.x)*p.rect.w,dy=(b.y-a.y)*p.rect.h;
      const ax=(p.px-a.x)*p.rect.w,ay=(p.py-a.y)*p.rect.h;
      const t=clamp((ax*dx+ay*dy)/(dx*dx+dy*dy||1),0,1);
      const distance=Math.hypot(ax-t*dx,ay-t*dy);
      if(distance<best){best=distance;edge=i;}
    }
    return edge;
  }

  board.addEventListener('pointerdown',event=>{
    if(event.button!==0 || draft.kind!=='points' || pointer)return;
    const p=translated(event), {points}=draft;
    const scale=board.width/board.getBoundingClientRect().width;
    let hit=-1, nearest=Math.max(9,9*scale);
    points.forEach((node,index)=>{
      const distance=Math.hypot(p.rect.x+node.x*p.rect.w-p.x,p.rect.y+node.y*p.rect.h-p.y);
      if(distance<nearest){nearest=distance;hit=index;}
    });
    const inside=p.x>=p.rect.x-3&&p.x<=p.rect.x+p.rect.w+3&&p.y>=p.rect.y-3&&p.y<=p.rect.y+p.rect.h+3;
    if(mode==='draw'&&hit===0&&usable()){
      setMode('move');update();
    }else if(mode!=='move' && hit<0 && inside && points.length<shapes.anchors){
      addUndo();
      selected=mode==='draw'||points.length<3?points.length:closestEdge(points,p)+1;
      points.splice(selected,0,shapes.point(p.px,p.py));
      update();
    }else if(hit>=0){
      selected=hit;
      pointer={id:event.pointerId,moved:false};
      board.setPointerCapture(event.pointerId);
      updatePointFields();draw();
    }
    event.preventDefault();
  });
  board.addEventListener('pointermove',event=>{
    if(pointer?.id!==event.pointerId)return;
    const p=translated(event);
    if(!pointer.moved){ addUndo(); pointer.moved=true; }
    Object.assign(draft.points[selected],{x:p.px,y:p.py});
    update();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    board.addEventListener(type,event=>{if(pointer?.id===event.pointerId)pointer=null;});
  }

  function use(saveToCard) {
    if(!ready())return;
    try {
      const next=shapes.make({...draft,name:title.value});
      const index=state.cardShapes.findIndex(item=>item.id===draft.id);
      const id=index<0?uniqueId('SHAPE-',state.cardShapes):draft.id;
      const savedShape={id,...next};
      if(index<0)state.cardShapes.push(savedShape);
      else state.cardShapes[index]=savedShape;
      draft={id,...deep(next)};
      updateCatalog(id);
      const c=card();
      if(saveToCard && c){
        c[shapes.fields[target.value]]=id;
        if(target.value==='plate' && c.nameplate==='none')c.nameplate='solid';
        currentId=c.id;
      }
      persist();
      update();
      notice.textContent=saveToCard&&c?next.name+' applied to '+c.title+'.':'Saved '+next.name+'.';
      if(saveToCard&&c)tab(returnTab);
    }catch(error){notice.textContent=error.message;title.focus();}
  }

  function chooseStarter() {
    addUndo();
    draft={id:draft.id,name:title.value,kind:'points',points:shapes.start($('shapeStarter').value)};
    selected=-1;
    setMode(draft.points.length?'move':'draw');
    notice.textContent='';
    update();
  }

  $('shapeStarterApply').onclick=chooseStarter;
  $('shapeNew').onclick=()=>{
    updateCatalog();
    begin({name:'',kind:'points',points:[]});
    title.focus();
  };
  $('shapeCopy').onclick=()=>{
    if(!usable())return;
    const copy=deep(draft);delete copy.id;
    copy.name=copy.name?copy.name.slice(0,75)+' copy':'';
    updateCatalog();begin(copy);title.focus();
  };
  $('shapeLoad').onclick=()=>{const item=saved();if(item)begin(item);};
  list.onchange=()=>{$('shapeLoad').disabled=$('shapeDelete').disabled=!saved();};
  $('shapeDelete').onclick=()=>{
    const item=saved();
    if(!item)return;
    const inUse=state.cards.some(c=>Object.values(shapes.fields).some(key=>c[key]===item.id)) ||
      state.templates.some(preset=>Object.values(shapes.fields).some(key=>preset[key]===item.id));
    if(inUse){notice.textContent='This shape is used on a card or layout preset. Remove those links before deleting it.';return;}
    if(!confirm('Delete '+item.name+'?'))return;
    state.cardShapes=state.cardShapes.filter(shape=>shape!==item);
    if(draft.id===item.id)delete draft.id;
    updateCatalog(); persist();
    notice.textContent='Shape deleted.';
  };
  target.onchange=()=>{setCards(choice.value);update();};
  choice.onchange=()=>update();
  title.oninput=()=>{draft.name=title.value;};
  $('shapeAddMode').onclick=()=>{if(mode!=='draw')setMode('add');update();};
  $('shapeMoveMode').onclick=()=>{setMode('move');update();};
  $('shapeClose').onclick=()=>{if(usable()){setMode('move');update();}};
  $('shapeUndo').onclick=()=>restoreHistory(undo,redo);
  $('shapeRedo').onclick=()=>restoreHistory(redo,undo);
  $('shapePrevious').onclick=()=>{
    selected=(selected<0?draft.points.length:selected)-1;
    if(selected<0)selected=draft.points.length-1;
    update();
  };
  $('shapeNext').onclick=()=>{selected=(selected+1)%draft.points.length;update();};
  $('shapeRemovePoint').onclick=()=>{
    if(selected<0)return;
    addUndo();draft.points.splice(selected,1);
    selected=Math.min(selected,draft.points.length-1);update();
  };
  for(const [id,key] of [['shapePointX','x'],['shapePointY','y'],['shapeSmooth','smooth']]){
    $(id).onchange=event=>{
      if(selected<0 || !Number.isFinite(event.target.valueAsNumber))return;
      addUndo();draft.points[selected][key]=clamp(event.target.valueAsNumber/100,0,1);
      update();
    };
  }
  $('shapeSvg').onchange=async event=>{
    const input=event.target, file=input.files[0];
    if(!file)return;
    const previous=draft;
    try {
      if(file.size>180000)throw Error('Choose a path-only SVG under 180 KB.');
      const svg=shapes.importedPath(await file.text());
      if(previous!==draft)return;
      addUndo();
      draft={id:previous.kind==='svg'?previous.id:undefined,name:file.name.replace(/\.svg$/i,'').slice(0,80),kind:'svg',svg};
      selected=-1;title.value=draft.name;setMode('move');update();
      notice.textContent='SVG outline loaded.';
    }catch(error){notice.textContent=error.message;}
    finally {input.value='';}
  };
  $('shapeSave').onclick=()=>use(false);
  $('shapeSaveUse').onclick=()=>use(true);
  $('shapeBack').onclick=()=>tab(returnTab,returnTab==='visualLanguage'?{components:true}:undefined);
  window.MNC_openShapeDesigner=open;
  window.MNC_refreshShapeDesigner=()=>{
    if(!['art','plate'].includes(target.value))target.value='art';
    if(!draft || project!==state){
      project=state;
      setCards(currentId);fromCard();
    }else{
      setCards(choice.value||currentId);updateCatalog(draft.id||'');update();
    }
  };
})();
