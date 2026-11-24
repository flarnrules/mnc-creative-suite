export const MODES=[['hue','Spectrum','All colors, in hue order. Equal-width samples.'],['ranked','Dominance swatches','Leading colors, ranked by pixel share. Equal-size swatches.'],['weighted','Proportional strip','Every color; rectangle width equals its share of visible pixels.'],['canvas','Canvas mosaic','Original canvas proportions; each color occupies its proportional area.'],['contour','Canvas contour','Original canvas proportions; each color occupies its share of the perimeter.']];
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const ranked=colors=>[...colors].sort((a,b)=>b.pixels-a.pixels||a.rgb.localeCompare(b.rgb)||a.alpha-b.alpha);
export function segments(colors){const total=colors.reduce((n,c)=>n+c.pixels,0);let x=0;return colors.map(c=>{const part={...c,start:x,share:total?c.pixels/total:0};x+=part.share;return part;});}
export function fitCanvas(width,height,maxWidth,maxHeight){const scale=Math.min(maxWidth/width,maxHeight/height);return{width:width*scale,height:height*scale};}
const pct=n=>(100*n).toFixed(n<.001?4:2)+'%';
function title(c){return`<title>${c.rgb} · ${pct(c.share??c.fraction)} · ${c.pixels.toLocaleString()} pixels${c.alpha<255?' · alpha '+c.alpha+'/255':''}</title>`;}
function rects(colors,x,y,w,h){return segments(colors).map(c=>`<rect x="${x+c.start*w}" y="${y}" width="${c.share*w}" height="${h}" fill="${c.rgb}" fill-opacity="${c.alpha/255}">${title(c)}</rect>`).join('');}
export function paletteGraphic(art,mode,x,y,w,h){
 const colors=mode==='hue'?art.colors:ranked(art.colors);
 if(mode==='ranked'){const shown=colors.slice(0,12),step=w/shown.length;return shown.map((c,i)=>`<rect x="${x+i*step}" y="${y}" width="${Math.max(0,step-2)}" height="${h}" rx="2" fill="${c.rgb}" fill-opacity="${c.alpha/255}">${title(c)}</rect>`).join('');}
 if(mode==='canvas'||mode==='contour'){
  const box=fitCanvas(art.width,art.height,w,h),xx=x+(w-box.width)/2,yy=y+(h-box.height)/2;
  if(mode==='canvas')return rects(colors,xx,yy,box.width,box.height)+`<rect x="${xx}" y="${yy}" width="${box.width}" height="${box.height}" fill="none" stroke="#d9eaca" stroke-width=".8"/>`;
  const perimeter=2*(box.width+box.height);return`<rect x="${xx}" y="${yy}" width="${box.width}" height="${box.height}" fill="#162a24"/>`+segments(colors).map(c=>`<rect x="${xx}" y="${yy}" width="${box.width}" height="${box.height}" fill="none" stroke="${c.rgb}" stroke-opacity="${c.alpha/255}" stroke-width="4" stroke-dasharray="${c.share*perimeter} ${perimeter}" stroke-dashoffset="${-c.start*perimeter}">${title(c)}</rect>`).join('');
 }
 if(mode==='hue')return colors.map((c,i)=>`<rect x="${x+i*w/colors.length}" y="${y}" width="${w/colors.length}" height="${h}" fill="${c.rgb}" fill-opacity="${c.alpha/255}">${title(c)}</rect>`).join('');
 return rects(colors,x,y,w,h);
}
export function cardPaletteGroup(art,mode,showStats=true){
 const x=art.fullArt?63:49,y=art.paletteY,ink=art.fullArt?'#ffffff':'#d4eed5';
 const label=(text,xx,yy,size=10)=>`<text x="${xx}" y="${yy}" fill="${ink}" font-family="Arial,sans-serif" font-weight="600" font-size="${size}" paint-order="stroke" stroke="#11251f" stroke-width="2" stroke-linejoin="round">${safe(text)}</text>`;
 const canvasMode=mode==='canvas'||mode==='contour';
 let out=`<g id="palette-preview" data-style="${mode}">`+paletteGraphic(art,mode,x,y,320,canvasMode?34:11);
 const shown=Math.min(12,art.colors.length),coverage=ranked(art.colors).slice(0,shown).reduce((n,c)=>n+c.fraction,0);
 out+=label(mode==='ranked'?`TOP ${shown} / ${art.color_count} · ${pct(coverage)} COVERAGE`:`${art.color_count} COLORS · ${mode==='weighted'?'PIXEL SHARE':mode==='canvas'?'AREA SHARE':mode==='contour'?'EDGE SHARE':'HUE ORDER'}`,x+334,y+10,12);
 if(showStats){const box=fitCanvas(art.width,art.height,42,25),gx=x+334,gy=y+17;
 out+=`<rect x="${gx}" y="${gy}" width="${box.width}" height="${box.height}" fill="none" stroke="${ink}" stroke-width="1"/>`;
 out+=label(`${art.width} × ${art.height} PX`,gx+50,gy+9,14)+label(`${art.width===art.height?'SQUARE':art.width>art.height?'LANDSCAPE':'PORTRAIT'} · ${art.ratio}`,gx+50,gy+22,12);
 }
 return out+'</g>';
}
