'use strict';

globalThis.MNC_FRONT_EFFECTS = (() => {
  const maxStops=6;
  const hex=value=>MNC_FRONT.hex(value);
  const number=(value,fallback,min,max)=>Number.isFinite(value)?clamp(value,min,max):fallback;

  function ramp(start,end,angle=90){
    return {kind:'linear',angle,stops:[{at:0,color:start},{at:1,color:end}]};
  }

  function gradient(value){
    if(!['linear','radial'].includes(value?.kind)||!Array.isArray(value.stops))return undefined;
    const stops=value.stops.slice(0,maxStops).filter(stop=>hex(stop?.color)&&Number.isFinite(stop.at))
      .map(({at,color})=>({at:clamp(at,0,1),color}));
    if(stops.length<2)return undefined;
    return {kind:value.kind,angle:number(value.angle,90,0,360),stops};
  }

  function firstColor(spec){
    return [...spec.stops].sort((a,b)=>a.at-b.at)[0].color;
  }

  function paintGradient(ctx,box,spec,tone=color=>color){
    const cx=box.x+box.w/2, cy=box.y+box.h/2;
    let fill;
    if(spec.kind==='radial')fill=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.hypot(box.w,box.h)/2);
    else{
      const angle=spec.angle*Math.PI/180, dx=Math.cos(angle), dy=Math.sin(angle);
      const extent=(Math.abs(dx)*box.w+Math.abs(dy)*box.h)/2;
      fill=ctx.createLinearGradient(cx-dx*extent,cy-dy*extent,cx+dx*extent,cy+dy*extent);
    }
    for(const {at,color} of spec.stops)fill.addColorStop(at,tone(color));
    return fill;
  }

  function outline(value){
    if(!hex(value?.color)||!Number.isFinite(value.width)||value.width<=0)return undefined;
    return {color:value.color,width:clamp(value.width,1,24)};
  }

  function shadow(value){
    if(!hex(value?.color)||!Number.isFinite(value.opacity)||value.opacity<=0)return undefined;
    return {color:value.color,opacity:clamp(value.opacity,.01,1),blur:number(value.blur,9,0,48),
      x:number(value.x,4,-60,60),y:number(value.y,7,-60,60)};
  }

  function canvas(width,height){
    const image=document.createElement('canvas');
    image.width=width;
    image.height=height;
    return image;
  }

  function alphaBounds(ctx){
    const {width,height}=ctx.canvas;
    const rgba=ctx.getImageData(0,0,width,height).data;
    let left=width,right=-1,top=height,bottom=-1;
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        if(rgba[(y*width+x)*4+3]<8)continue;
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
    }
    return right<left?null:{x:left,y:top,w:right-left+1,h:bottom-top+1};
  }

  function context(width,height){
    return canvas(width,height).getContext('2d');
  }

  function copyTransform(target,source){
    const {a,b,c,d,e,f}=source.getTransform();
    target.setTransform(a,b,c,d,e,f);
  }

  function clear(ctx){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  }

  function edge(layer,paint,stencil,color,rx,ry){
    const {width,height}=layer;
    clear(stencil);
    stencil.save();
    stencil.drawImage(layer,0,0);
    stencil.globalCompositeOperation='source-in';
    stencil.fillStyle=color;
    stencil.fillRect(0,0,width,height);
    stencil.restore();

    clear(paint);
    paint.drawImage(stencil.canvas,0,0);
    const radius=Math.max(rx,ry), count=Math.max(10,Math.min(32,Math.ceil(radius*2)));
    const rings=radius>7?[.52,1]:[1];
    for(const ring of rings){
      for(let i=0;i<count;i++){
        const angle=i/count*Math.PI*2;
        paint.drawImage(stencil.canvas,rx*ring*Math.cos(angle),ry*ring*Math.sin(angle));
      }
    }
    paint.drawImage(layer,0,0);
    return paint.canvas;
  }

  function styledPainter(output){
    const {width,height}=output.canvas;
    const actual=context(width,height);
    let outlinePaint,stencil;
    return async (layer,draw)=>{
      const {outline:border,shadow:drop}=layer;
      clear(actual);
      actual.save();
      try{
        copyTransform(actual,output);
        await draw(actual);
      }finally{actual.restore();}
      const matrix=output.getTransform();
      let image=actual.canvas;
      const sx=Math.hypot(matrix.a,matrix.b), sy=Math.hypot(matrix.c,matrix.d);
      if(border){
        outlinePaint??=context(width,height);
        stencil??=context(width,height);
        image=edge(image,outlinePaint,stencil,border.color,border.width*sx,border.width*sy);
      }
      output.save();
      try{
        output.setTransform(1,0,0,1,0,0);
        if(drop){
          const rgb=drop.color.slice(1).match(/../g).map(value=>parseInt(value,16));
          output.shadowColor='rgba('+rgb.join(',')+','+drop.opacity+')';
          output.shadowBlur=drop.blur*(sx+sy)/2;
          output.shadowOffsetX=drop.x*sx;
          output.shadowOffsetY=drop.y*sy;
        }
        output.drawImage(image,0,0);
      }finally{output.restore();}
    };
  }

  return {maxStops,ramp,gradient,firstColor,paintGradient,outline,shadow,canvas,alphaBounds,copyTransform,styledPainter};
})();
