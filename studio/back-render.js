'use strict';

(() => {
  const fonts={system:'system-ui',sans:'Arial, sans-serif',serif:'Georgia, serif',mono:'"Courier New", monospace'};
  const radians=degrees=>degrees*Math.PI/180;
  const center={x:CW/2,y:CH/2};

  function bounds(layer) {
    return {x:layer.x*CW/100,y:layer.y*CH/100,w:layer.w*CW/100,h:layer.h*CH/100};
  }

  function placeLayer(ctx,layer,box,turn=0) {
    if(turn){
      ctx.translate(center.x,center.y);
      ctx.rotate(Math.PI);
      ctx.translate(-center.x,-center.y);
    }
    ctx.translate(box.x,box.y);
    ctx.rotate(radians(layer.rotation));
  }

  function fillBackground(ctx,design) {
    let fill=design.background;
    if(design.fill==='gradient'){
      const a=radians(design.angle),dx=Math.cos(a),dy=Math.sin(a);
      const length=(Math.abs(dx)*CW+Math.abs(dy)*CH)/2;
      fill=ctx.createLinearGradient(center.x-length*dx,center.y-length*dy,center.x+length*dx,center.y+length*dy);
      fill.addColorStop(0,design.background);
      if(design.gradientMidpoint)fill.addColorStop(.52,design.gradientMidpoint);
      fill.addColorStop(1,design.backgroundTo);
    }
    ctx.fillStyle=fill;
    ctx.fillRect(0,0,CW,CH);
  }

  function drawPattern(ctx,design) {
    if(design.pattern==='none'||!design.patternOpacity)return;
    const step=design.patternSpacing,extent=Math.ceil(Math.hypot(CW,CH)/2/step)*step;
    ctx.save();
    ctx.translate(center.x,center.y);
    ctx.rotate(radians(design.patternAngle));
    ctx.globalAlpha=design.patternOpacity;
    ctx.fillStyle=ctx.strokeStyle=design.patternColor;
    ctx.lineWidth=2;
    ctx.beginPath();
    switch(design.pattern){
      case 'rings':
        for(let r=145;r<=extent;r+=step){
          ctx.moveTo(r,0);
          ctx.ellipse(0,0,r,r+40,0,0,Math.PI*2);
        }
        ctx.stroke();
        break;
      case 'diagonal':
      case 'lattice':
        ctx.rotate(Math.PI/4);
        for(let x=-extent;x<=extent;x+=step){
          ctx.moveTo(x,-extent);ctx.lineTo(x,extent);
          if(design.pattern==='lattice'){ctx.moveTo(-extent,x);ctx.lineTo(extent,x);}
        }
        ctx.stroke();
        break;
      case 'dots':
        for(let y=-extent;y<=extent;y+=step){
          for(let x=-extent;x<=extent;x+=step){
            ctx.moveTo(x+step*.075,y);
            ctx.arc(x,y,step*.075,0,Math.PI*2);
          }
        }
        ctx.fill();
        break;
      case 'film':
        for(let y=-extent;y<=extent;y+=step){
          for(const x of [-1,1]){
            ctx.roundRect(x*(CW/2-38)-step*.23,y-step*.23,step*.46,step*.46,step*.10);
          }
        }
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  function drawBorder(ctx,design) {
    if(design.border==='none')return;
    const {borderInset:inset,borderWidth:width,borderRadius:radius}=design;
    ctx.save();
    ctx.lineWidth=width;
    ctx.strokeStyle=design.borderColor;
    ctx.beginPath();
    ctx.roundRect(inset,inset,CW-2*inset,CH-2*inset,radius);
    ctx.stroke();
    if(design.border==='double'){
      const inner=inset+Math.max(18,width*.9+6);
      ctx.lineWidth=Math.max(1,width/6);
      ctx.strokeStyle=design.borderInner;
      ctx.beginPath();
      ctx.roundRect(inner,inner,CW-2*inner,CH-2*inner,Math.max(0,radius-(inner-inset)));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShape(ctx,layer,w,h) {
    ctx.beginPath();
    switch(layer.shape){
      case 'ellipse': ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);break;
      case 'diamond':
        ctx.moveTo(0,-h/2);ctx.lineTo(w/2,0);ctx.lineTo(0,h/2);ctx.lineTo(-w/2,0);ctx.closePath();break;
      case 'rounded': ctx.roundRect(-w/2,-h/2,w,h,layer.radius);break;
      default: ctx.rect(-w/2,-h/2,w,h);
    }
    if(layer.filled)ctx.fill();
    if(layer.outline)ctx.stroke();
  }

  function textLines(ctx,text,width) {
    return text.split(/\r?\n/).flatMap(paragraph=>{
      const lines=[];
      let line='';
      for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
        const next=line?line+' '+word:word;
        if(line&&ctx.measureText(next).width>width){
          lines.push(line);
          line=word;
        }else line=next;
      }
      return [...lines,line];
    });
  }

  function drawText(ctx,layer,w,h) {
    if(!layer.text.trim())return;
    let size=layer.size,lines,leading;
    for(let attempt=0;attempt<4;attempt++){
      ctx.font=`${layer.italic?'italic ':''}${layer.bold?'700':'400'} ${size}px ${fonts[layer.font]}`;
      lines=textLines(ctx,layer.text,w);
      leading=size*1.18;
      const naturalWidth=Math.max(1,...lines.map(line=>ctx.measureText(line).width));
      const scale=Math.min(1,w/naturalWidth,h/(lines.length*leading));
      if(scale>=.995||attempt===3)break;
      size*=scale;
    }
    ctx.textAlign=layer.align;
    ctx.textBaseline='middle';
    const x=layer.align==='left'?-w/2:layer.align==='right'?w/2:0;
    for(const [index,line] of lines.entries()){
      const y=(index-(lines.length-1)/2)*leading;
      if(layer.outline)ctx.strokeText(line,x,y,w);
      ctx.fillText(line,x,y,w);
    }
  }

  function imageSource(layer,project) {
    return assetURI(project.assets.find(asset=>asset.id===layer.assetId));
  }

  function drawImageLayer(ctx,layer,im,w,h) {
    if(!im)return;
    ctx.scale(layer.flipX?-1:1,layer.flipY?-1:1);
    const rect={x:-w/2,y:-h/2,w,h};
    if(layer.fit==='stretch'){
      ctx.beginPath();
      ctx.rect(rect.x,rect.y,w,h);
      ctx.clip();
      const dw=w*layer.zoom,dh=h*layer.zoom;
      ctx.drawImage(im,-dw/2+layer.panX*(dw-w)/2,-dh/2+layer.panY*(dh-h)/2,dw,dh);
      return;
    }
    fitImage(ctx,im,rect,layer.fit,layer.zoom,layer.panX,layer.panY);
  }

  async function render(design,project) {
    const cv=document.createElement('canvas');
    cv.width=CW;cv.height=CH;
    const ctx=cv.getContext('2d');
    const layers=design.layers.filter(layer=>layer.visible&&layer.opacity>0);
    const images=await Promise.all(layers.map(layer=>layer.kind==='image'?imgLoad(imageSource(layer,project)):null));
    fillBackground(ctx,design);
    drawPattern(ctx,design);
    for(const [i,layer] of layers.entries()){
      const box=bounds(layer);
      for(let turn=0;turn<(layer.repeat?2:1);turn++){
        ctx.save();
        placeLayer(ctx,layer,box,turn);
        ctx.globalAlpha=layer.opacity;
        ctx.globalCompositeOperation=layer.blend;
        ctx.fillStyle=layer.color;
        ctx.strokeStyle=layer.outlineColor;
        ctx.lineWidth=layer.outline||1;
        ctx.lineJoin='round';
        if(layer.kind==='image')drawImageLayer(ctx,layer,images[i],box.w,box.h);
        else if(layer.kind==='shape')drawShape(ctx,layer,box.w,box.h);
        else drawText(ctx,layer,box.w,box.h);
        ctx.restore();
      }
    }
    drawBorder(ctx,design);
    return cv;
  }

  function drawGuides(ctx,layer,showSafe) {
    if(showSafe){
      ctx.save();
      ctx.lineWidth=2;
      ctx.setLineDash([9,7]);
      ctx.strokeStyle='#0a1018';
      ctx.strokeRect(37,37,CW-74,CH-74);
      ctx.lineDashOffset=8;
      ctx.strokeStyle='#f4f0dc';
      ctx.strokeRect(37,37,CW-74,CH-74);
      ctx.restore();
    }
    if(!layer?.visible)return;
    const box=bounds(layer);
    for(let turn=0;turn<(layer.repeat?2:1);turn++){
      ctx.save();
      placeLayer(ctx,layer,box,turn);
      ctx.lineWidth=2;
      ctx.strokeStyle='#101419';
      ctx.strokeRect(-box.w/2-1,-box.h/2-1,box.w+2,box.h+2);
      ctx.strokeStyle='#f7d995';
      if(turn)ctx.setLineDash([8,5]);
      ctx.strokeRect(-box.w/2,-box.h/2,box.w,box.h);
      ctx.restore();
    }
  }

  function hit(design,x,y) {
    for(const layer of design.layers.slice().reverse()){
      if(!layer.visible||!layer.opacity)continue;
      const box=bounds(layer),angle=radians(layer.rotation),cos=Math.cos(angle),sin=Math.sin(angle);
      for(let turn=layer.repeat?1:0;turn>=0;turn--){
        const dx=(turn?CW-x:x)-box.x,dy=(turn?CH-y:y)-box.y;
        if(Math.abs(dx*cos+dy*sin)<=box.w/2&&Math.abs(dy*cos-dx*sin)<=box.h/2)return {layer,turn};
      }
    }
    return null;
  }

  window.MNC_renderBackDesign=render;
  window.MNC_backGuides=drawGuides;
  window.MNC_backHit=hit;
  window.MNC_backImageSource=imageSource;
})();
