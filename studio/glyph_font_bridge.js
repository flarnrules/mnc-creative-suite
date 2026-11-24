/* MNC Custom PNG Font Adapter. Original 512x512 images are never modified. */
'use strict';
(()=>{
 const bundled=window.MNC_GLYPH_FONTS||{};
 let fonts=Object.assign(Object.create(null),bundled);
 const glyphCache=new Map();
 const tintCache=new Map();
 const $=id=>document.getElementById(id);
 const normalizeColor=(s)=>s;
 async function glyphData(path,background='transparent'){
   const ck=path+'::'+background;
   if(glyphCache.has(ck))return glyphCache.get(ck);
   const p=new Promise(resolve=>{
     let im=new Image(); im.onload=()=>{
       try{
         const cv=document.createElement('canvas');cv.width=512;cv.height=512;
         const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0,512,512);
         let data=cx.getImageData(0,0,512,512),pix=data.data;
         if(background==='white'){
           for(let i=0;i<pix.length;i+=4){const white=Math.min(pix[i],pix[i+1],pix[i+2]);pix[i+3]=Math.round(pix[i+3]*(1-Math.max(0,white-220)/35));}
           cx.putImageData(data,0,0);
         }
         let x0=511,y0=511,x1=0,y1=0,found=false;
         for(let y=0;y<512;y++)for(let x=0;x<512;x++){
           const a=pix[(y*512+x)*4+3];if(a<24)continue;
           found=true;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
         }
         if(!found){resolve(null);return;}
         resolve({canvas:cv,bbox:{x:x0,y:y0,w:Math.max(1,x1-x0+1),h:Math.max(1,y1-y0+1)}});
       }catch(e){console.warn('Glyph image failed',path,e);resolve(null)}
     }; im.onerror=()=>resolve(null); im.src=path;
   }); glyphCache.set(ck,p);return p;
 }
 function hash(seed,str){let h=(Number(seed)||1)>>>0;for(const ch of str)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h>>>0;}
 function possible(font,ch){return font.glyphs[ch] || font.glyphs[ch.toLowerCase()] || font.glyphs[ch.toUpperCase()] || null;}
 async function buildRuns(ctx,str,fs,fontId,opts={}){
   const font=fonts[fontId];if(!font)return null;
   const runs=[];let total=0;const seed=opts.seed??1;
   for(let i=0;i<str.length;i++){
     const ch=str[i];if(ch===' '){runs.push({kind:'space',width:fs*.35});total+=fs*.35;continue;}
     const arr=possible(font,ch);let glyph=null;
     if(arr?.length){
       const idx=opts.variation==='first'?0:hash(seed,`${str}|${i}|${ch}`)%arr.length;
       glyph=await glyphData(arr[idx],font.background);
     }
     if(glyph){const width=fs*Math.min(1.5,Math.max(.18,glyph.bbox.w/glyph.bbox.h));runs.push({kind:'png',glyph,width});total+=width+fs*.055;}
     else{ctx.save();ctx.font=`700 ${fs}px Georgia, serif`;const width=ctx.measureText(ch).width;ctx.restore();runs.push({kind:'fallback',ch,width});total+=width+fs*.04;}
   }
   return {runs,total};
 }
 window.MNC_drawFontLine=async function(ctx,str,x,y,fs,opts={}){
   const fontId=opts.fontId||'system';if(fontId==='system'||!fonts[fontId])return false;
   const display=await buildRuns(ctx,String(str),fs,fontId,opts);if(!display)return false;
   const scale=Math.min(1,(opts.maxWidth||1e6)/Math.max(1,display.total));
   const width=display.total*scale;
   let dx=x-(opts.align==='right'?width:opts.align==='center'?width/2:0);
   ctx.save();ctx.fillStyle=opts.color||'#F2E7D5';ctx.textAlign='left';ctx.textBaseline='alphabetic';
   for(const run of display.runs){
     const w=run.width*scale,ht=fs*scale;
     if(run.kind==='png'){
       const b=run.glyph.bbox;
       // Trim transparent margins; scale actual ink bounds independently of source canvas width.
       if(fonts[fontId].colorMode==='tint'){
         const key=fontId+'|'+opts.color+'|'+b.x+'|'+b.y+'|'+b.w+'|'+b.h+'|'+str+'|'+dx;
         let tc=tintCache.get(key);
         if(!tc){tc=document.createElement('canvas');tc.width=b.w;tc.height=b.h;const tcx=tc.getContext('2d');tcx.drawImage(run.glyph.canvas,b.x,b.y,b.w,b.h,0,0,b.w,b.h);tcx.globalCompositeOperation='source-in';tcx.fillStyle=opts.color||'#EEE5D5';tcx.fillRect(0,0,b.w,b.h);
           if(tintCache.size>250)tintCache.clear();tintCache.set(key,tc);}
         ctx.drawImage(tc,dx,y-ht*.82,w,ht);
       }else ctx.drawImage(run.glyph.canvas,b.x,b.y,b.w,b.h,dx,y-ht*.82,w,ht);
     }else if(run.kind==='fallback'){
       ctx.font=`700 ${ht}px Georgia, serif`;
       ctx.fillText(run.ch,dx,y);
     }
     dx+=w+fs*scale*.045;
   }
   ctx.restore();return true;
 };
 function populate(){
   const select=$('mncFontSelect');if(!select)return;
   const prior=select.value;
   select.replaceChildren(new Option('Built-in system font','system'));
   for(const [key,v] of Object.entries(fonts))select.append(new Option(`${v.name} (${Object.keys(v.glyphs).length} characters)`,key));
   select.value=Object.hasOwn(fonts,prior)?prior:'system';
   const layer=$('layerFontSelect');if(layer){layer.replaceChildren(new Option('Inherit card font',''),new Option('Built-in system font','system'));for(const [key,v] of Object.entries(fonts))layer.append(new Option(v.name,key));}
   $('mncFontStatus').textContent=`${Object.keys(fonts).length} PNG fonts · ${Object.values(fonts).reduce((n,f)=>n+Object.keys(f.glyphs).length,0)} glyph keys. Missing letters use Georgia.`;
 }
 window.MNC_projectFonts=project=>{
   fonts=Object.assign(Object.create(null),bundled,project);
   glyphCache.clear();tintCache.clear();
   populate();
 };
 const prev=window.refreshStudio;
 window.refreshStudio=function(){prev();const c=cardById(currentId);if(!c)return;
   $('mncFontSelect').value=c.fontId&&fonts[c.fontId]?c.fontId:'system';
   $('mncGlyphVariation').value=c.glyphVariantMode||'seeded';
   $('mncLetterSeed').value=c.glyphSeed??1;
   $('mncFilmTheme').value=c.filmTheme||'classic';
 };
 for(const [id,key] of [['mncFontSelect','fontId'],['mncGlyphVariation','glyphVariantMode'],['mncLetterSeed','glyphSeed']]){
   $(id).addEventListener(id==='mncLetterSeed'?'input':'change',e=>{
     const c=cardById(currentId);if(!c)return;c[key]=id==='mncLetterSeed'?Number(e.target.value):e.target.value;
     persist();drawStudioPreview();
   });
 }
 populate();window.refreshStudio();
})();
