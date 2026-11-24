'use strict';

globalThis.MNC_ARTWORK = (() => {
  const ratios={standard:3/2,tall:4/3,wide:2};
  const cropped=new WeakMap();

  function rect(card,{x,y,w,h}) {
    if(card.artworkProfile==='full')return {x:0,y:0,w:750,h:1050};
    const ratio=ratios[card.artworkProfile];
    return {x,y,w,h:ratio?w/ratio:h};
  }

  function region(card,w,h) {
    const scale=card.artworkProfile==='full'
      ? (w===1650&&h===2250?1:w===825&&h===1125?.5:0)
      : 0;
    const trim=75*scale;
    return {x:trim,y:trim,w:w-2*trim,h:h-2*trim};
  }

  function image(card,source) {
    if(!source)return source;
    const {x,y,w,h}=region(card,source.width,source.height);
    if(!x)return source;
    if(!cropped.has(source)){
      const output=document.createElement('canvas');output.width=w;output.height=h;
      output.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);
      cropped.set(source,output);
    }
    return cropped.get(source);
  }

  return {rect,image,region,ratios};
})();
