'use strict';

globalThis.MNC_ART_CUTOUT = (() => {
  const maxPoints=160;
  const normalizeCoordinate=value=>Math.round(clamp(value,0,1)*100000)/100000;

  function normalize(value){
    if(typeof value?.assetId!=='string'||!value.assetId||value.assetId.length>250)return undefined;
    const {width,height}=value;
    if(![width,height].every(n=>Number.isFinite(n)&&n>=1&&n<=100000))return undefined;
    if(!Array.isArray(value.points)||value.points.length<3||value.points.length>maxPoints)return undefined;
    if(value.points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))return undefined;
    const points=value.points.map(p=>({x:normalizeCoordinate(p.x),y:normalizeCoordinate(p.y)}));
    const area=points.reduce((sum,p,i)=>{
      const next=points[(i+1)%points.length];
      return sum+p.x*next.y-next.x*p.y;
    },0);
    if(Math.abs(area)<.00001)return undefined;
    return {assetId:value.assetId,width,height,points};
  }

  function active(card){
    const mask=card.artCutout;
    return mask?.assetId===card.sourceAssetId&&artById(mask?.assetId)?mask:null;
  }

  function placement(card,width,height) {
    const region=MNC_ARTWORK.region(card,width,height);
    const image=imagePlacement(region.w,region.h,imgBox(card),card.fit||'cover',
      Number(card.zoom)||1,Number(card.panX)||0,Number(card.panY)||0);
    const sx=image.w/region.w, sy=image.h/region.h;
    const source={x:image.x-region.x*sx,y:image.y-region.y*sy,w:width*sx,h:height*sy};
    return {region,image,source};
  }

  function bounds(points,source){
    const left=Math.min(...points.map(point=>point.x)), top=Math.min(...points.map(point=>point.y));
    const right=Math.max(...points.map(point=>point.x)), bottom=Math.max(...points.map(point=>point.y));
    return {x:source.x+source.w*left,y:source.y+source.h*top,w:(right-left)*source.w,h:(bottom-top)*source.h};
  }

  function drawSource(ctx,image,placement){
    const region=placement.region, out=placement.image;
    ctx.drawImage(image,region.x,region.y,region.w,region.h,out.x,out.y,out.w,out.h);
  }

  function fixedPlacement(card,mask){
    const asset=artById(mask.assetId), loaded=imageSizes.get(assetURI(asset));
    return placement(card,loaded?.w||mask.width,loaded?.h||mask.height);
  }

  function outlineFor(ctx,card,mask,fit){
    const base=bounds(mask.points,fit.source);
    MNC_LAYOUT.transform(ctx,base,MNC_LAYOUT.geometry(card,'cutout',base));
    const cover=new Path2D();
    cover.rect(fit.image.x,fit.image.y,fit.image.w,fit.image.h);
    ctx.clip(cover);
    return MNC_SHAPES.polygonPath(mask.points,fit.source);
  }

  function addLayer(scene,card) {
    const mask=active(card);
    if(!mask)return;
    const fit=fixedPlacement(card,mask), box=bounds(mask.points,fit.source);
    scene.add('cutout',box,async ctx=>{
      const image=await imgLoad(assetURI(artById(mask.assetId)));
      if(!image)return;
      const actual=placement(card,image.width,image.height);
      ctx.clip(MNC_SHAPES.polygonPath(mask.points,actual.source),'evenodd');
      drawSource(ctx,image,actual);
    });
  }

  function visible(card){
    return !!active(card)&&!MNC_LAYOUT.hidden(card,'cutout');
  }

  function fill(ctx,card){
    const mask=active(card);
    if(!mask||MNC_LAYOUT.hidden(card,'cutout'))return;
    ctx.save();
    try{
      const fit=fixedPlacement(card,mask);
      ctx.fill(outlineFor(ctx,card,mask,fit),'evenodd');
    }finally{ctx.restore();}
  }

  return {maxPoints,normalize,active,placement,drawSource,addLayer,visible,fill};
})();
