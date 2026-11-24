'use strict';

globalThis.MNC_OUTER_BORDER=(()=>{
  const styles=[['classic','Classic frame'],['band','Solid band'],['double','Double band'],['bevel','Beveled band']];
  const contours=[['match','Match card'],['rounded','Rounded'],['cut','Cut corners'],['square','Square']];
  const channels=[['alpha','Image transparency'],['light','Keep light areas'],['dark','Keep dark areas']];
  const mappings=[['stretch','Stretch to frame'],['cover','Crop to fill'],['tile','Tile']];
  const defaults={style:'classic',width:48,inset:0,shape:'match',opacity:1};
  const maskDefaults={channel:'alpha',mapping:'stretch',scale:1,x:0,y:0};
  const converted=new Map();
  const number=(value,fallback,min,max)=>Number.isFinite(value)?clamp(value,min,max):fallback;
  const choice=(value,list,fallback)=>list.some(([id])=>id===value)?value:fallback;

  function normalize(value){
    if(!value||typeof value!=='object')return undefined;
    return {
      style:choice(value.style,styles,defaults.style),
      width:number(value.width,defaults.width,2,160),
      inset:number(value.inset,defaults.inset,0,90),
      shape:choice(value.shape,contours,defaults.shape),
      opacity:number(value.opacity,defaults.opacity,0,1)
    };
  }

  function normalizeMask(value){
    if(typeof value?.assetId!=='string'||!value.assetId||value.assetId.length>320)return undefined;
    return {
      assetId:value.assetId,
      channel:choice(value.channel,channels,maskDefaults.channel),
      mapping:choice(value.mapping,mappings,maskDefaults.mapping),
      scale:number(value.scale,maskDefaults.scale,.2,4),
      x:number(value.x,maskDefaults.x,-750,750),
      y:number(value.y,maskDefaults.y,-1050,1050)
    };
  }

  function settings(card){
    return MNC_LAYOUT.get(card,'border')?.frame||defaults;
  }

  function maskSettings(card){
    return MNC_LAYOUT.get(card,'border')?.imageMask;
  }

  function classicVisible(card){
    return !(game.isGameCard(card)&&card.frameStyle==='none');
  }

  function visible(card){
    return !MNC_LAYOUT.hidden(card,'border')&&
      (settings(card).style!=='classic'||classicVisible(card));
  }

  function box(card){
    const spec=settings(card);
    if(spec.style!=='classic'){
      const n=spec.inset;
      return {x:n,y:n,w:CW-n*2,h:CH-n*2};
    }
    if(game.isGameCard(card))return {x:21,y:21,w:708,h:1008};
    if(card.template==='Standard')return {x:14,y:14,w:722,h:1022};
    if(['Archive','Minimal'].includes(card.template))return imgBox(card);
    return {x:9,y:9,w:CW-18,h:CH-18};
  }

  function color(card){
    if(game.isGameCard(card)&&window.MNC_gamePalette)return window.MNC_gamePalette(card).outer;
    if(card.template==='Standard'&&window.MNC_standardPalette)return window.MNC_standardPalette(card).outer;
    if(MNC_FRONT.hex(card.borderColor))return card.borderColor;
    if(card.template==='Archive')return '#27222b';
    if(card.template==='Minimal')return '#1e2230';
    return MNC_FRONT.hex(card.accent)?card.accent:'#c2aa80';
  }

  function hitWidth(card,layer){
    const spec=settings(card);
    if(spec.style==='classic')return 16;
    const scale=Math.max(layer.rect.w/layer.base.w,layer.rect.h/layer.base.h);
    return spec.width*scale+5;
  }

  function shapePath(rect,shape,radius){
    const path=new Path2D();
    const {x,y,w,h}=rect, r=clamp(radius,0,Math.min(w,h)/2);
    if(shape==='cut'&&r){
      path.moveTo(x+r,y);
      path.lineTo(x+w-r,y);path.lineTo(x+w,y+r);path.lineTo(x+w,y+h-r);
      path.lineTo(x+w-r,y+h);path.lineTo(x+r,y+h);path.lineTo(x,y+h-r);path.lineTo(x,y+r);
      path.closePath();
    }else if(shape==='rounded'&&r)path.roundRect(x,y,w,h,r);
    else path.rect(x,y,w,h);
    return path;
  }

  function outline(ctx,rect,shape,radius,ink,width){
    ctx.strokeStyle=ink;
    ctx.lineWidth=width;
    ctx.stroke(shapePath(rect,shape,radius));
  }

  function classicWidth(card){
    if(game.isGameCard(card))return number(Number(card.frameWidth??13),13,2,24);
    if(card.template==='Standard')return 15;
    return card.template==='Archive'?10:card.template==='Minimal'?12:14;
  }

  function paintClassic(ctx,card,rect,ink,mask){
    const width=classicWidth(card);
    if(game.isGameCard(card)){
      const style=card.frameStyle||'double';
      const radius=number(Number(card.frameRadius??27),27,0,65);
      outline(ctx,rect,style==='cut'?'cut':'rounded',radius,ink,width);
      if(mask)return;
      const trim=window.MNC_gamePalette?.(card)?.line||ink;
      if(style==='double'||style==='film'){
        outline(ctx,{x:31+width/4,y:31+width/4,w:688-width/2,h:988-width/2},'rounded',Math.max(0,radius-8),trim,1.5);
      }
      if(style==='film'){
        ctx.fillStyle=trim;
        for(let y=64;y<=996;y+=25){
          ctx.fillRect(18,y,6,12);
          ctx.fillRect(726,y,6,12);
        }
      }
    }else if(card.template==='Standard'){
      outline(ctx,rect,'rounded',27,ink,width);
      if(!mask)outline(ctx,{x:28,y:28,w:694,h:994},'rounded',20,'rgba(255,255,255,.17)',2);
    }else{
      outline(ctx,rect,'square',0,ink,width);
      if(!mask&&width===14)outline(ctx,{x:18,y:18,w:CW-36,h:CH-36},'square',0,'rgba(255,255,255,.18)',2);
    }
  }

  function ring(rect,shape,radius,outer,inner){
    const radiusReduction=shape==='cut'?2-Math.SQRT2:1;
    const contour=inset=>shapePath({x:rect.x+inset,y:rect.y+inset,w:rect.w-inset*2,h:rect.h-inset*2},
      shape,Math.max(0,radius-inset*radiusReduction));
    const band=contour(outer);
    band.addPath(contour(inner));
    return band;
  }

  function paintBand(ctx,card,rect,spec,ink,mask){
    const inherited=game.isGameCard(card)&&card.frameStyle==='cut'?'cut':'rounded';
    const shape=spec.shape==='match'?inherited:spec.shape;
    const radius=shape==='cut'?number(card.frameRadius,27,0,80):cardCutRadius(card);
    const width=Math.min(spec.width,Math.min(rect.w,rect.h)/2-1);
    const fill=(start,end,color)=>{
      ctx.fillStyle=color;
      ctx.fill(ring(rect,shape,radius,start,end),'evenodd');
    };
    if(spec.style==='double'){
      fill(0,width*.52,ink);
      fill(width*.72,width,ink);
      return;
    }
    fill(0,width,ink);
    if(spec.style!=='bevel'||mask)return;
    const bevel=width*.18, light=ctx.createLinearGradient(rect.x,rect.y,rect.x+rect.w,rect.y+rect.h);
    light.addColorStop(0,'rgba(255,255,255,.52)');
    light.addColorStop(1,'rgba(0,0,0,.37)');
    const shade=ctx.createLinearGradient(rect.x,rect.y,rect.x+rect.w,rect.y+rect.h);
    shade.addColorStop(0,'rgba(0,0,0,.39)');
    shade.addColorStop(1,'rgba(255,255,255,.38)');
    fill(0,bevel,light);
    fill(width-bevel,width,shade);
  }

  async function loadMask(card){
    const spec=maskSettings(card);
    const uri=spec&&assetURI(artById(spec.assetId));
    if(!uri||!visible(card))return null;
    if(spec.channel==='alpha')return imgLoad(uri);
    const key=spec.channel+'|'+uri;
    if(!converted.has(key)){
      if(converted.size>=24)converted.clear();
      converted.set(key,(async()=>{
        const image=await imgLoad(uri);
        if(!image)return null;
        const scale=Math.min(1,1200/Math.max(image.width,image.height));
        const canvas=MNC_FRONT_EFFECTS.canvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height), data=pixels.data;
        for(let i=0;i<data.length;i+=4){
          const value=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])/255;
          data[i+3]*=spec.channel==='dark'?1-value:value;
        }
        ctx.putImageData(pixels,0,0);
        return canvas;
      })());
    }
    return converted.get(key);
  }

  function paintImageMask(ctx,rect,image,spec){
    if(spec.mapping==='tile'){
      const scale=Math.min(rect.w/3,image.width)/image.width*spec.scale;
      ctx.translate(rect.x+spec.x,rect.y+spec.y);
      ctx.scale(scale,scale);
      ctx.fillStyle=ctx.createPattern(image,'repeat');
      const pad=180;
      ctx.fillRect((-spec.x-pad)/scale,(-spec.y-pad)/scale,(rect.w+pad*2)/scale,(rect.h+pad*2)/scale);
      return;
    }
    const cover=Math.max(rect.w/image.width,rect.h/image.height);
    const width=(spec.mapping==='cover'?image.width*cover:rect.w)*spec.scale;
    const height=(spec.mapping==='cover'?image.height*cover:rect.h)*spec.scale;
    ctx.drawImage(image,rect.x+(rect.w-width)/2+spec.x,rect.y+(rect.h-height)/2+spec.y,width,height);
  }

  function paint(ctx,card,image,mask=false){
    const spec=settings(card), rect=box(card), layers=MNC_LAYOUT.get(card,'border');
    const draw=target=>{
      const base=mask?'#ffffff':layers?.gradient
        ? MNC_FRONT_EFFECTS.paintGradient(target,rect,layers.gradient)
        : color(card);
      if(spec.style==='classic')paintClassic(target,card,rect,base,mask);
      else paintBand(target,card,rect,spec,base,mask);
    };
    ctx.save();
    try{
      ctx.globalAlpha*=spec.opacity;
      if(!image){draw(ctx);return;}
      const {width,height}=ctx.canvas;
      const border=MNC_FRONT_EFFECTS.canvas(width,height),stencil=MNC_FRONT_EFFECTS.canvas(width,height);
      const borderCtx=border.getContext('2d'), stencilCtx=stencil.getContext('2d');
      MNC_FRONT_EFFECTS.copyTransform(borderCtx,ctx);
      MNC_FRONT_EFFECTS.copyTransform(stencilCtx,ctx);
      draw(borderCtx);
      const padding=spec.style==='classic'?Math.max(classicWidth(card)/2,card.frameStyle==='film'?4:0):0;
      const footprint={x:rect.x-padding,y:rect.y-padding,w:rect.w+2*padding,h:rect.h+2*padding};
      paintImageMask(stencilCtx,footprint,image,maskSettings(card));
      borderCtx.setTransform(1,0,0,1,0,0);
      borderCtx.globalCompositeOperation='destination-in';
      borderCtx.drawImage(stencil,0,0);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.drawImage(border,0,0);
    }finally{ctx.restore();}
  }

  function addLayer(scene,card){
    scene.add('border',box(card),async ctx=>paint(ctx,card,await loadMask(card)),
      {hit:'edge',empty:!visible(card)});
  }

  function drawMask(ctx,card,image){
    if(!visible(card))return;
    const base=box(card);
    ctx.save();
    try{
      MNC_LAYOUT.transform(ctx,base,MNC_LAYOUT.geometry(card,'border',base));
      paint(ctx,card,image,true);
    }finally{ctx.restore();}
  }

  return {styles,contours,channels,mappings,maskDefaults,normalize,normalizeMask,settings,maskSettings,visible,
    color,hitWidth,loadMask,addLayer,drawMask};
})();
