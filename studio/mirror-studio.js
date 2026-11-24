'use strict';

(() => {
  const model=MNC_MIRROR_MASK;
  const board=$('mirrorCanvas'),ctx=board.getContext('2d'),choice=$('mirrorCard');
  const notice=$('mirrorStatus'),tool=$('mirrorTool'),effect=$('mirrorEffect');
  const scratch=model.canvas(),working=model.canvas();
  let art=null,alpha=null,base=null,borderMask=null,mask=model.normalize(),revision=0,frame=0;
  let outline=[],brush=null,busy=false;
  const undo=[],redo=[];
  const current=()=>cardById(choice.value);
  const ready=()=>!!(art&&current()&&!busy);
  const keep=()=>effect.value==='keep';

  function refreshControls() {
    const drawn=model.hasMask(mask);
    $('mirrorBrushSettings').hidden=tool.value!=='brush';
    $('mirrorClose').disabled=!ready()||outline.length<3;
    $('mirrorCancelTrace').disabled=!outline.length;
    $('mirrorUndo').disabled=!ready()||!undo.length;
    $('mirrorRedo').disabled=!ready()||!redo.length;
    $('mirrorBorder').disabled=!ready()||!MNC_OUTER_BORDER.visible(current());
    $('mirrorClear').disabled=!ready()||!drawn;
    $('mirrorDownload').disabled=!ready()||!drawn;
    $('mirrorFoil').disabled=!ready()||!drawn;
    $('mirrorImport').disabled=!ready();
    board.setAttribute('aria-busy',String(busy));
  }

  function paint() {
    ctx.clearRect(0,0,board.width,board.height);
    if(!art||!alpha)return;
    const mode=$('mirrorPreview').value;
    ctx.drawImage(art,0,0);
    let layer=alpha;
    if(brush){
      const test=working.getContext('2d');
      test.clearRect(0,0,board.width,board.height);
      test.drawImage(alpha,0,0);
      model.applyStep(test,current(),brush);
      layer=working;
    }
    model.proofLayer(ctx,layer,mode,scratch);
    if(!outline.length)return;
    ctx.save();
    ctx.strokeStyle=keep()?'#bfdaca':'#ffe0a0';
    ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.beginPath();
    ctx.moveTo(...outline[0]);outline.slice(1).forEach(point=>ctx.lineTo(...point));
    ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=ctx.strokeStyle;
    outline.forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();});
    ctx.restore();
  }

  function requestPaint() {
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;paint();});
  }

  async function openCard() {
    const card=current();
    const token=++revision;
    art=alpha=base=borderMask=null;busy=true;outline=[];brush=null;
    undo.length=redo.length=0;
    mask=model.normalize(card?.mirrorMask);
    refreshControls();paint();
    if(!card){busy=false;notice.textContent='Choose a card to start.';return;}
    currentId=card.id;
    notice.textContent='Loading '+card.title+'…';
    try{
      const [canvas,image,border]=await Promise.all([
        cardCanvas(deep(card)),mask.base?imgLoad(mask.base):null,MNC_OUTER_BORDER.loadMask(card)
      ]);
      if(token!==revision)return;
      art=canvas;base=image;borderMask=border;alpha=model.draw(card,mask,base,borderMask);
      notice.textContent=mask.base&&!image?'Could not open the imported mask.':
        model.hasMask(mask)?'Saved mask for '+card.title+'.':'Trace an area or brush over it to expose the mirror.';
    }catch(error){
      if(token===revision)notice.textContent=error.message;
    }finally{
      if(token===revision){busy=false;refreshControls();paint();}
    }
  }

  function activate() {
    const selected=state.cards.find(c=>c.id===currentId)||state.cards[0];
    dropDownOptions(choice,state.cards.map(c=>[c.id,c.title]),selected?.id||'');
    return openCard();
  }

  async function changeMask(next) {
    const card=current(),token=revision;
    if(!ready())return false;
    if(next.base!==mask.base){
      busy=true;refreshControls();
      const image=next.base?await imgLoad(next.base):null;
      if(token!==revision||current()!==card)return false;
      base=image;busy=false;
    }
    mask=next;
    alpha=model.draw(card,mask,base,borderMask);
    if(model.hasMask(mask))card.mirrorMask=mask;
    else delete card.mirrorMask;
    persist();paint();
    return true;
  }

  async function commit(next,message) {
    const before=mask;
    if(!await changeMask(next))return;
    undo.push(before);
    if(undo.length>24)undo.shift();
    redo.length=0;
    notice.textContent=message;
    refreshControls();
  }

  async function travel(from,to,message) {
    if(!ready()||!from.length)return;
    const before=mask;
    outline=[];brush=null;
    if(!await changeMask(from.at(-1)))return;
    from.pop();to.push(before);
    notice.textContent=message;refreshControls();
  }

  function add(step) {
    if(mask.steps.length===model.maxSteps){
      notice.textContent='Export and reimport the mask to combine the edits before adding more.';
      return;
    }
    const next=model.normalize({base:mask.base,steps:[...mask.steps,step]});
    return commit(next,step.keep?'Restored printed area.':'Updated reflective area.');
  }

  function locationOnCard(event) {
    const rect=board.getBoundingClientRect();
    return [clamp((event.clientX-rect.left)/rect.width*model.width,0,model.width),
      clamp((event.clientY-rect.top)/rect.height*model.height,0,model.height)];
  }

  function closeTrace() {
    if(!ready()||outline.length<3)return;
    const points=outline;outline=[];
    refreshControls();requestPaint();
    return add({kind:'polygon',points,keep:keep()});
  }

  board.addEventListener('pointerdown',event=>{
    if(!ready()||event.button!==0||brush)return;
    const point=locationOnCard(event);
    if(tool.value==='brush'){
      brush={kind:'brush',keep:keep(),size:Number($('mirrorBrushSize').value)||30,points:[point],pointer:event.pointerId};
      board.setPointerCapture(event.pointerId);
    }else if(outline.length<model.maxPoints){
      if(outline.length>=3&&Math.hypot(point[0]-outline[0][0],point[1]-outline[0][1])<14){closeTrace();return;}
      outline.push(point);
      notice.textContent=outline.length+' points. Choose Close area to apply the outline.';
    }
    refreshControls();requestPaint();event.preventDefault();
  });
  board.addEventListener('pointermove',event=>{
    if(!brush||brush.pointer!==event.pointerId||brush.points.length>=model.maxPoints)return;
    const point=locationOnCard(event),prior=brush.points.at(-1);
    if(Math.hypot(point[0]-prior[0],point[1]-prior[1])<2)return;
    brush.points.push(point);requestPaint();
  });
  const brushEnd=event=>{
    if(!brush||brush.pointer!==event.pointerId)return;
    const step=brush;
    brush=null;requestPaint();
    return add(step);
  };
  board.addEventListener('pointerup',brushEnd);
  board.addEventListener('lostpointercapture',brushEnd);
  board.addEventListener('pointercancel',()=>{
    brush=null;requestPaint();
  });
  function cancelTrace() {
    outline=[];notice.textContent='Trace an area or brush over it to expose the mirror.';
    refreshControls();requestPaint();
  }
  board.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&outline.length>=3){event.preventDefault();closeTrace();}
    if(event.key==='Escape'&&outline.length){event.preventDefault();cancelTrace();}
  });

  choice.onchange=openCard;
  tool.onchange=cancelTrace;
  effect.onchange=requestPaint;
  $('mirrorPreview').onchange=requestPaint;
  $('mirrorBrushSize').oninput=event=>{$('mirrorBrushValue').textContent=event.target.value+' px';};
  $('mirrorClose').onclick=closeTrace;
  $('mirrorCancelTrace').onclick=cancelTrace;
  $('mirrorUndo').onclick=()=>travel(undo,redo,'Undid the last mask edit.');
  $('mirrorRedo').onclick=()=>travel(redo,undo,'Restored the last mask edit.');
  $('mirrorBorder').onclick=()=>add({kind:'border',keep:false});
  $('mirrorClear').onclick=()=>{
    outline=[];brush=null;
    return commit(model.normalize(),'Cleared the finish mask.');
  };

  $('mirrorImport').onchange=async event=>{
    const file=event.target.files[0],card=current(),token=revision;
    if(!file||!ready())return;
    let url;
    try{
      url=URL.createObjectURL(file);
      const image=await new Promise((resolve,reject)=>{
        const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not read the mask image.'));
        img.src=url;
      });
      if(token!==revision||current()!==card)return;
      const imported=model.importImage(image).toDataURL('image/png');
      outline=[];brush=null;
      await commit({base:imported,steps:[]},'Imported a mask. White exposes the mirror.');
    }catch(error){
      if(token===revision)notice.textContent=error.message;
    }finally{
      if(url)URL.revokeObjectURL(url);
      event.target.value='';
    }
  };

  $('mirrorDownload').onclick=()=>{
    const card=current();
    if(!ready()||!model.hasMask(mask))return;
    const kind=$('mirrorDownloadKind').value;
    const options={
      ink:['ink-layer',()=>model.inkLayer(art,alpha)],
      area:['finish-mask-white-is-mirror',()=>model.coverage(alpha)],
      white:['underprint-white-is-ink',()=>model.coverage(alpha,{inverse:true})]
    };
    const [label,render]=options[kind]||options.ink;
    canvasPNG(render(),slug(card.id)+'_'+label+'.png');
    notice.textContent='Exported 750 × 1050 PNG.';
  };
  $('mirrorBack').onclick=()=>tab('studio');
  $('mirrorFoil').onclick=()=>tab('prism');
  $('openMirrorFinish').onclick=()=>tab('mirror');
  window.MNC_refreshMirrorFinish=activate;
})();
