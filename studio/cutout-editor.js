'use strict';

globalThis.MNC_CUTOUT_EDITOR = ({current,change,choose,selectionChanged,message,addForeground,showCanvas})=>{
  const model=MNC_ART_CUTOUT, guide=$('ldMaskGuide'), ctx=guide.getContext('2d');
  const traceTools=$('ldTraceTools'),traceFinish=$('ldTraceFinish'),traceUndo=$('ldTraceUndo');
  let trace=null, pending=0, controls=null, grabbed=null;

  function parts(){
    return current()&&model.active(current());
  }

  function update(){
    traceTools.hidden=!trace;
    traceFinish.disabled=!trace||trace.points.length<3;
    traceUndo.disabled=!trace||!trace.points.length;
    if(!controls)return;
    const {start,apply,undo,cancel,clear,status}=controls;
    start.disabled=!current()?.sourceAssetId||!!trace;
    const saved=parts();
    start.textContent=saved?'Edit outline':'Trace outline';
    apply.hidden=undo.hidden=cancel.hidden=!trace;
    clear.hidden=!saved||!!trace;
    apply.disabled=traceFinish.disabled;
    undo.disabled=traceUndo.disabled;
    status.textContent=trace?trace.points.length+' of '+model.maxPoints+' points':
      saved?'Cutout follows the source artwork and its crop.':'Trace a subject that crosses the artwork window.';
  }

  function paint(){
    ctx.clearRect(0,0,CW,CH);
    if(!trace)return;
    const {image,fit,points}=trace;
    ctx.save();
    ctx.globalAlpha=.52;
    model.drawSource(ctx,image,fit);
    ctx.restore();

    ctx.strokeStyle='#fff2ac';
    ctx.lineWidth=2;
    ctx.setLineDash([7,5]);
    ctx.stroke(frontArtworkPath(trace.card));
    ctx.setLineDash([]);
    if(!points.length)return;
    const mapped=points.map(p=>pagePoint(p,fit.source));
    ctx.beginPath();
    mapped.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x,p.y));
    if(points.length>=3){
      ctx.closePath();
      ctx.fillStyle='#f8d16f25';
      ctx.fill('evenodd');
    }
    ctx.lineWidth=2;
    ctx.strokeStyle='#ffffff';
    ctx.stroke();
    ctx.fillStyle='#ffe7a1';
    for(const p of mapped){
      ctx.beginPath();
      ctx.arc(p.x,p.y,4,0,Math.PI*2);
      ctx.fill();
    }
  }

  function pagePoint(point,source){
    return {x:source.x+point.x*source.w,y:source.y+point.y*source.h};
  }

  function point(event){
    const rect=guide.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*CW/rect.width,y:(event.clientY-rect.top)*CH/rect.height};
  }

  function toSource(p,fit){
    const {source,image}=fit;
    return {x:(clamp(p.x,image.x,image.x+image.w)-source.x)/source.w,
      y:(clamp(p.y,image.y,image.y+image.h)-source.y)/source.h};
  }

  function cancel(){
    pending++;
    if(!trace)return;
    trace=null;
    grabbed=null;
    guide.hidden=true;
    selectionChanged();
    update();
  }

  async function start(){
    const card=current(), sourceId=card?.sourceAssetId;
    if(!sourceId)return;
    const token=++pending;
    let image;
    try{image=await imgLoad(assetURI(artById(sourceId)));}
    catch(error){if(token===pending)message(error.message);return;}
    if(token!==pending||card!==current()||sourceId!==card.sourceAssetId)return;
    if(!image){message('Could not open the source artwork.');return;}
    trace={card,sourceId,image,fit:model.placement(card,image.width,image.height),points:deep(parts()?.points||[])};
    guide.hidden=false;
    selectionChanged();
    update();
    paint();
    showCanvas();
    guide.focus({preventScroll:true});
    message('Place points around the cutout. Drag a point to adjust it.');
  }

  function apply(){
    if(!trace||trace.card!==current())return;
    const {sourceId,image,points}=trace;
    const mask=model.normalize({assetId:sourceId,width:image.width,height:image.height,points});
    if(!mask){message('Use at least three points that enclose the part to reveal.');return;}
    cancel();
    change(card=>{
      card.artCutout=mask;
      const edit=MNC_LAYOUT.get(card,'cutout');
      if(edit)delete edit.hidden;
    },{sync:true});
    choose('cutout');
    message('Cutout applied. Select its Effects tab to add depth.');
  }

  function undo(){
    if(!trace?.points.length)return;
    trace.points.pop();
    update();
    paint();
  }

  function cancelTrace(){cancel();message();}
  traceFinish.onclick=apply;
  traceUndo.onclick=undo;
  $('ldTraceCancel').onclick=cancelTrace;

  function render(host){
    const blurb=document.createElement('p');
    blurb.className='ld-muted';
    blurb.textContent='Trace around the part you want in front of the frame. Crop zoom gives you more of the source artwork to work with.';
    host.append(blurb);
    const bar=document.createElement('div');
    bar.className='buttonbar ld-mask-actionbar';
    function button(label,callback){
      const item=document.createElement('button');
      item.type='button';
      item.textContent=label;
      item.onclick=callback;
      bar.append(item);
      return item;
    }
    const startButton=button('Trace outline',start);
    const applyButton=button('Finish outline',apply);
    const undoButton=button('Remove last point',undo);
    const cancelButton=button('Cancel trace',cancelTrace);
    const clearButton=button('Remove cutout',()=>change(card=>{
      delete card.artCutout;
      const layout=card.layoutDesign;
      if(layout){
        delete layout.layers.cutout;
        layout.order=layout.order.filter(id=>id!=='cutout');
      }
    },{sync:true}));
    host.append(bar);
    const status=document.createElement('p');
    status.className='ld-detail-status';
    status.setAttribute('role','status');
    host.append(status);
    controls={start:startButton,apply:applyButton,undo:undoButton,cancel:cancelButton,clear:clearButton,status};

    const label=document.createElement('label'), input=document.createElement('input');
    label.className='file-label secondary';
    label.textContent='Add transparent PNG';
    input.type='file';input.accept='image/png,.png';
    input.onchange=async()=>{
      const file=input.files[0], card=current();
      input.value='';
      if(!file||!card)return;
      cancel();
      try{
        const [assetId]=await importImages([file]);
        if(assetId&&card===current())addForeground(assetId);
      }catch(error){message(error.message);}
    };
    label.append(input);
    host.append(label);
    update();
  }

  guide.addEventListener('pointerdown',event=>{
    if(!trace||trace.card!==current()||event.button!==0||grabbed)return;
    const p=point(event), {image,source}=trace.fit;
    if(p.x<image.x||p.x>image.x+image.w||p.y<image.y||p.y>image.y+image.h)return;
    const threshold=10*CW/guide.getBoundingClientRect().width;
    const index=trace.points.findIndex(item=>{
      const mapped=pagePoint(item,source);
      return Math.hypot(mapped.x-p.x,mapped.y-p.y)<=threshold;
    });
    if(index<0&&trace.points.length===model.maxPoints)return;
    if(index<0)trace.points.push(toSource(p,trace.fit));
    grabbed={id:event.pointerId,index:index<0?trace.points.length-1:index};
    guide.setPointerCapture(event.pointerId);
    guide.focus({preventScroll:true});
    paint();
    update();
    event.preventDefault();
  });
  guide.addEventListener('pointermove',event=>{
    if(!trace||grabbed?.id!==event.pointerId)return;
    trace.points[grabbed.index]=toSource(point(event),trace.fit);
    paint();
  });
  for(const action of ['pointerup','pointercancel','lostpointercapture']){
    guide.addEventListener(action,event=>{if(grabbed?.id===event.pointerId)grabbed=null;});
  }
  guide.addEventListener('keydown',event=>{
    if(!trace)return;
    if(event.key==='Enter')apply();
    else if(event.key==='Escape'){cancel();message();}
    else if(event.key==='Backspace')undo();
    else return;
    event.preventDefault();
    event.stopPropagation();
  });

  return {render,cancel,active:()=>!!trace};
};
