'use strict';

globalThis.MNC_MIRROR_MASK = (() => {
  const width=750,height=1050,maxSteps=180,maxPoints=800;
  const png=/^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
  const within=(value,max)=>Math.round(Math.min(max,Math.max(0,value))*10)/10;

  function normalize(value) {
    const steps=[];
    for(const item of Array.isArray(value?.steps)?value.steps.slice(0,maxSteps):[]){
      if(!item||!['polygon','brush','border'].includes(item.kind))continue;
      const step={kind:item.kind,keep:item.keep===true};
      if(item.kind!=='border'){
        const points=Array.isArray(item.points)?item.points.slice(0,maxPoints):[];
        step.points=points.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))
          .map(([x,y])=>[within(x,width),within(y,height)]);
        if(step.points.length<(item.kind==='polygon'?3:1))continue;
      }
      if(item.kind==='brush')step.size=Math.min(150,Math.max(2,Number(item.size)||30));
      steps.push(step);
    }
    const base=typeof value?.base==='string'&&value.base.length<4500000&&png.test(value.base)?value.base:'';
    return {base,steps};
  }

  function canvas() {
    const result=document.createElement('canvas');
    result.width=width;result.height=height;
    return result;
  }

  function hasMask(mask) {
    return !!(mask?.base||mask?.steps?.length);
  }

  function applyStep(ctx,c,step,borderMask) {
    ctx.save();
    ctx.globalCompositeOperation=step.keep?'destination-out':'source-over';
    ctx.fillStyle=ctx.strokeStyle='#fff';
    if(step.kind==='border')MNC_OUTER_BORDER.drawMask(ctx,c,borderMask);
    else if(step.kind==='brush'&&step.points.length===1){
      const [x,y]=step.points[0];
      ctx.beginPath();ctx.arc(x,y,step.size/2,0,Math.PI*2);ctx.fill();
    }else{
      const [[x,y],...rest]=step.points;
      ctx.beginPath();ctx.moveTo(x,y);
      for(const point of rest)ctx.lineTo(...point);
      if(step.kind==='polygon'){ctx.closePath();ctx.fill('evenodd');}
      else{ctx.lineWidth=step.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
    }
    ctx.restore();
  }

  function draw(c,mask,base,borderMask) {
    const result=canvas(),ctx=result.getContext('2d');
    if(base)ctx.drawImage(base,0,0,width,height);
    for(const step of mask.steps)applyStep(ctx,c,step,borderMask);
    return result;
  }

  async function render(c) {
    const mask=normalize(c.mirrorMask);
    const [base,borderMask]=await Promise.all([
      mask.base?imgLoad(mask.base):null,
      mask.steps.some(step=>step.kind==='border')?MNC_OUTER_BORDER.loadMask(c):null
    ]);
    return draw(c,mask,base,borderMask);
  }

  function importImage(image) {
    const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
    if(w!==width||h!==height)throw Error('Use a 750 × 1050 PNG so the mask aligns with the card.');
    const result=canvas(),ctx=result.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,width,height),rgba=pixels.data;
    for(let i=0;i<rgba.length;i+=4){
      const whiteness=(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2])/255;
      rgba[i+3]=Math.round(rgba[i+3]*whiteness);
      rgba[i]=rgba[i+1]=rgba[i+2]=255;
    }
    ctx.putImageData(pixels,0,0);
    return result;
  }

  function coverage(alpha,{inverse=false,foil=false}={}) {
    const result=canvas(),ctx=result.getContext('2d');
    ctx.fillStyle=inverse?'#fff':foil?'#f00':'#000';
    ctx.fillRect(0,0,width,height);
    const area=canvas(),paint=area.getContext('2d');
    paint.drawImage(alpha,0,0);
    paint.globalCompositeOperation='source-in';
    paint.fillStyle=inverse?'#000':foil?'#ff0':'#fff';
    paint.fillRect(0,0,width,height);
    ctx.drawImage(area,0,0);
    return result;
  }

  function inkLayer(art,alpha) {
    const result=canvas(),ctx=result.getContext('2d');
    ctx.drawImage(art,0,0);
    ctx.globalCompositeOperation='destination-out';
    ctx.drawImage(alpha,0,0);
    return result;
  }

  function proofLayer(ctx,alpha,mode,scratch) {
    const paint=scratch.getContext('2d');
    paint.clearRect(0,0,width,height);
    paint.save();paint.drawImage(alpha,0,0);
    paint.globalCompositeOperation='source-in';
    if(mode==='silver'){
      const silver=paint.createLinearGradient(20,220,720,800);
      for(const [position,color] of [[0,'#242d3a'],[.24,'#7c8796'],[.38,'#f1f5f9'],[.50,'#b3bfcb'],
        [.52,'#56616f'],[.70,'#263341'],[.83,'#acb9c6'],[1,'#eaf1f7']])silver.addColorStop(position,color);
      paint.fillStyle=silver;
    }else paint.fillStyle=mode==='mask'?'#fff':'#ffd2789e';
    paint.fillRect(0,0,width,height);paint.restore();
    if(mode==='mask'){ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);}
    ctx.drawImage(scratch,0,0);
  }

  return {width,height,maxSteps,maxPoints,normalize,canvas,hasMask,applyStep,draw,render,importImage,coverage,inkLayer,proofLayer};
})();
