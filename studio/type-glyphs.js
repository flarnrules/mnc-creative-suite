'use strict';

(() => {
  // All built-in marks are drawn in one ink at any scale.
  const silhouettes={
    hero:'M3 4h18v8c0 5-5 8-9 11-4-3-9-6-9-11zm5 6v3h8v-3zm2 5v2h4v-2z',
    villain:'M3 3l5 3c2-1 6-1 8 0l5-3-1 8 1 3-3 5-6 3-6-3-3-5 1-3zm3 8 2 4 3-1zm12 0-5 3 3 1z',
    creature:'M1 12q3-7 11-7t11 7q-3 7-11 7T1 12zm11-4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    redshirt:'M7 3 2 6 0 11l5 3 2-3v11h10V11l2 3 5-3-2-5-5-3-2 2H9zm1 12h8v2H8z',
    sidekick:'M2 10h8V2h4v8h8v4h-8v8h-4v-8H2zM1 3l3-2 3 3-3 3zm16 17 3-3 3 3-3 3z',
    monster:'M4 3h2v3h3v2h6V6h3V3h2v5h2v3h2v9h-3v-5h-3v4h-3v-3H9v3H6v-4H3v5H0v-9h2V8h2zm3 8v3h3v-3zm7 0v3h3v-3z',
    animal:'M3 3l6 3h6l6-3 3 6-4 8-3 4H7l-3-4-4-8zm4 8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm10 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm-7 5 2 3 2-3z',
    ghost:'M3 21V11a9 9 0 0 1 18 0v10l-4-2-3 3-3-3-3 3-2-3zm5-10a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm8 0a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm-4 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
    alien:'M12 2c6 0 10 3 10 8 0 6-7 12-10 12S2 16 2 10c0-5 4-8 10-8zM5 10c0 3 2 5 5 5 0-3-2-5-5-5zm14 0c-3 0-5 2-5 5 3 0 5-2 5-5zM10 18v1h4v-1z',
    collection:'M1 6h22L13 15v6h6v2H5v-2h6v-6zM15 4l4-4 1.3 1.3L17.6 4z'
  };
  const cache=new Map();

  function sourceFor(id) {
    const assigned=artById(state.typeGlyphs?.[id]);
    return assigned||state.assets.find(asset=>asset.typeGlyph===id);
  }

  async function maskFor(asset,ink) {
    const uri=assetURI(asset);
    if(!uri)return null;
    const key=uri+'|'+ink;
    if(!cache.has(key)){
      if(cache.size>96)cache.clear();
      cache.set(key,(async()=>{
        const image=await imgLoad(uri);
        if(!image)return null;
        const scratch=document.createElement('canvas');
        scratch.width=scratch.height=96;
        const ctx=scratch.getContext('2d');
        fitImage(ctx,image,{x:0,y:0,w:96,h:96},'contain');
        const pixels=ctx.getImageData(0,0,96,96).data;
        let left=96,top=96,right=-1,bottom=-1;
        for(let y=0;y<96;y++){
          for(let x=0;x<96;x++){
            if(pixels[(y*96+x)*4+3]<15)continue;
            left=Math.min(left,x);right=Math.max(right,x);
            top=Math.min(top,y);bottom=Math.max(bottom,y);
          }
        }
        if(right<left)return null;
        ctx.globalCompositeOperation='source-in';
        ctx.fillStyle=ink;ctx.fillRect(0,0,96,96);
        return {canvas:scratch,left,top,w:right-left+1,h:bottom-top+1};
      })().catch(()=>null));
    }
    return cache.get(key);
  }

  async function draw(ctx,id,x,y,size,ink) {
    const custom=await maskFor(sourceFor(id),ink);
    if(custom){
      const factor=size/Math.max(custom.w,custom.h);
      const w=custom.w*factor,h=custom.h*factor;
      ctx.drawImage(custom.canvas,custom.left,custom.top,custom.w,custom.h,x-w/2,y-h/2,w,h);
      return;
    }
    const path=silhouettes[id];
    if(!path)return;
    ctx.save();
    ctx.translate(x-size/2,y-size/2);
    ctx.scale(size/24,size/24);
    ctx.fillStyle=ink;
    ctx.fill(new Path2D(path),'evenodd');
    ctx.restore();
  }

  function empty(canvas) {
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    return !pixels.some((alpha,index)=>index%4===3&&alpha>15);
  }

  async function saveDrawing() {
    const status=$('typeGlyphStatus'),id=$('glyphTypeTarget').value,canvas=$('glyphCanvas');
    if(!Object.hasOwn(silhouettes,id))return;
    if(empty(canvas)){status.textContent='Draw a symbol first.';return;}
    const button=$('saveTypeGlyph');
    if(sourceFor(id)&&!confirm('Replace the '+id+' symbol on all cards?'))return;
    button.disabled=true;
    try{
      if(window.MNC_DISK?.connected){
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
        const asset=await window.MNC_DISK.upload(blob,id+'.png','glyph',true);
        delete state.typeGlyphs[id];
        status.textContent='Saved to assets/glyphs/types/'+asset.originalFilename+'.';
      }else{
        const assetId=uniqueId('ART-',state.assets);
        state.assets.push({id:assetId,title:id+' symbol',originalFilename:id+'.png',kind:'Glyph',
          dataURI:canvas.toDataURL('image/png'),w:canvas.width,h:canvas.height,source:'Glyph Kit'});
        state.typeGlyphs[id]=assetId;
        status.textContent='Saved with the browser project. Export a project backup to carry it forward.';
      }
      persist();refreshAll();
    }catch(error){status.textContent=error.message;}
    finally{button.disabled=false;}
  }

  window.MNC_TYPE_GLYPHS={draw,sourceFor,has:id=>Object.hasOwn(silhouettes,id)};
  dropDownOptions($('glyphTypeTarget'),[...game.categories,...game.creatures].map(type=>[type.id,type.name]),'hero');
  $('saveTypeGlyph').onclick=saveDrawing;
})();
