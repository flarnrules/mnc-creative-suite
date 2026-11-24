'use strict';

globalThis.MNC_SYMBOLS = (() => {
  const fonts=['Segoe UI Symbol','Times New Roman','MNC Symbols','Segoe UI Emoji'];
  const availability=new Map(),imageCache=new Map(),textCache=new Map();
  const clean=value=>String(value??'').replace(/[\ufe0e\ufe0f]/g,'').trim();
  const monoStack='"MNC Symbols", "MNC Symbols One", "MNC Emoji Fallback", "DejaVu Sans", serif';
  const safeColor=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'';
  const backdrops=['none','circle','square','pill','diamond','shield'];
  const alignment=value=>Number.isFinite(value)?Math.max(-50,Math.min(50,Math.round(value))):0;
  const defaults=id=>({source:'text',glyph:MNC_SET_PLAN.profile(id)?.glyph||'◆',font:'Segoe UI Symbol',
    presentation:'text',assetId:'',imageMode:'tint',removeWhite:true,color:'',backdrop:'none',offsetX:0,offsetY:0});

  function normalize(value,id='') {
    const base=defaults(id),v=value||{};
    const symbol={source:['text','image','builtin','hidden'].includes(v.source)?v.source:base.source,
      glyph:typeof v.glyph==='string'?v.glyph.slice(0,32):base.glyph,
      font:fonts.includes(v.font)?v.font:base.font,
      presentation:v.presentation==='emoji'?'emoji':'text',assetId:typeof v.assetId==='string'?v.assetId:'',
      imageMode:v.imageMode==='original'?'original':'tint',removeWhite:v.removeWhite!==false,
      color:safeColor(v.color),backdrop:backdrops.includes(v.backdrop)?v.backdrop:'none',
      offsetX:alignment(v.offsetX),offsetY:alignment(v.offsetY)};
    if(symbol.source==='builtin'&&MNC_SET_PLAN.profile(v.builtinId))symbol.builtinId=v.builtinId;
    return symbol;
  }

  function restore(project) {
    const prior=project.visualLanguage||{};
    const previousCritic={...defaults('critic'),glyph:'📰'};
    project.visualLanguage={version:3,profiles:Object.fromEntries(
      [...MNC_SET_PLAN.definitions,...MNC_SET_PLAN.auxiliaries].map(({id})=>{
        const value=prior.profiles?.[id];
        const symbol=normalize(value?.symbol,id);
        // Update the original default in existing saves and retain customized standards.
        if(id==='critic'&&(prior.version??1)<2&&Object.entries(previousCritic).every(([key,value])=>symbol[key]===value)){
          symbol.glyph=defaults(id).glyph;
        }
        return [id,{symbol,presetId:String(value?.presetId||''),
          setMark:value?.setMark?normalize(value.setMark,'collection'):null,
          palette:globalThis.MNC_TYPE_DESIGN?.normalizePalette(value?.palette)||{},
          placement:globalThis.MNC_FRONT?MNC_FRONT.settings(value?.placement):{offsets:{},text:{}}}];
      }))};
    for(const card of project.cards){
      if(card.typeSymbol)card.typeSymbol=normalize(card.typeSymbol,MNC_SET_PLAN.profileFor(card));
      if(card.collectionSymbol)card.collectionSymbol=normalize(card.collectionSymbol,'collection');
    }
  }

  function matchingGlyphs(project,id) {
    const aliases={collection:['martini','cocktail'],telescope:['telescope']};
    const words=aliases[id]||[id];
    return project.assets.filter(asset=>asset.kind==='Glyph'||/\bglyphs[\/\\]/i.test(asset.diskPath||''))
      .filter(asset=>words.some(word=>(asset.originalFilename||asset.title||'').toLowerCase().replace(/[^a-z]/g,'').includes(word)));
  }

  function profileSymbol(project,id) {
    const symbol=normalize(project.visualLanguage?.profiles?.[id]?.symbol,id);
    if(symbol.source!=='hidden'&&!symbol.assetId&&['collection','telescope'].includes(id)){
      const matches=matchingGlyphs(project,id);
      if(matches.length===1)return {...symbol,source:'image',assetId:matches[0].id};
    }
    return symbol;
  }

  function typeMark(project,type) {
    const settings=project.visualLanguage?.profiles;
    const own=settings?.[type]?.setMark;
    const profile=MNC_SET_PLAN.profile(type);
    const inherited=profile?.category==='Creature'?settings?.creature?.setMark:null;
    return own||inherited?normalize(own||inherited,'collection'):profileSymbol(project,'collection');
  }

  function cardSymbol(project,card,place='type') {
    const collection=place==='collection', id=collection?'collection':MNC_SET_PLAN.profileFor(card);
    const policy=card[collection?'collectionSymbolMode':'typeSymbolMode'];
    if(policy==='hidden')return {symbol:{...defaults(id),source:'hidden'},id};
    const override=card[collection?'collectionSymbol':'typeSymbol'];
    if(override)return {symbol:normalize(override,id),id};
    const promo=collection&&MNC_CARD_METADATA.isPromo(card,project.catalogCollections?.[card.collectionId]);
    const standard=promo?typeMark(project,MNC_SET_PLAN.profileFor(card)):profileSymbol(project,id);
    if(policy==='standard')return {symbol:standard,id};
    const assetId=collection?card.setGlyphAsset:card.typeIconAsset;
    const glyph=collection?card.setGlyph:MNC_CARD_METADATA.customIcon(card);
    if(assetId)return {symbol:{...standard,source:'image',assetId},id};
    if(glyph&&(!collection||glyph!=='✦'))return {symbol:{...standard,source:'text',glyph},id};
    if(!collection&&card.family==='Item'&&['🪞','💣'].includes(MNC_CARD_METADATA.defaultIcon(card))){
      return {symbol:{...standard,source:'text',glyph:MNC_CARD_METADATA.defaultIcon(card)},id};
    }
    if(!id)return {symbol:{...standard,glyph:MNC_CARD_METADATA.defaultIcon(card)},id};
    return {symbol:standard,id};
  }

  function cardMode(card,place){
    const key=place==='collection'?'collectionSymbol':'typeSymbol';
    const mode=card[key+'Mode'];
    if(mode==='hidden')return mode;
    if(card[key]||mode==='custom')return 'custom';
    if(mode==='standard')return mode;
    const legacy=place==='collection'?card.setGlyphAsset||card.setGlyph&&card.setGlyph!=='✦':
      card.typeIconAsset||MNC_CARD_METADATA.customIcon(card);
    return legacy?'custom':'standard';
  }

  function setCardMode(card,place,mode){
    const key=place==='collection'?'collectionSymbol':'typeSymbol';
    let value=null;
    if(mode==='custom'){
      const {symbol,id}=cardSymbol(state,card,place);
      value=symbol.source==='hidden'?profileSymbol(state,id):symbol;
      if(value.source==='hidden')value={...value,source:'text',assetId:''};
    }
    editCardFields(card,{[key]:value,[key+'Mode']:mode});
  }

  function setCardSymbol(card,place,patch){
    const key=place==='collection'?'collectionSymbol':'typeSymbol';
    const {symbol,id}=cardSymbol(state,card,place);
    editCardFields(card,{[key]:normalize({...symbol,...patch},id),[key+'Mode']:'custom'});
  }

  function glyphAssets(project){
    return project.assets.filter(asset=>asset.kind==='Glyph'||/glyphs[\/\\]/i.test(asset.diskPath||''));
  }

  function imageOptions(project,chosen,placeholder='Choose glyph'){
    const items=glyphAssets(project);
    if(chosen&&!items.some(asset=>asset.id===chosen)){
      items.push(project.assets.find(asset=>asset.id===chosen)||{id:chosen,title:'Missing glyph image'});
    }
    return [['',placeholder],...items.map(asset=>[asset.id,asset.title])];
  }

  async function storeGlyph(file,name) {
    const {image,dataURI}=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(Error('Could not read this PNG.'));
      reader.onload=()=>{
        const image=new Image();
        image.onload=()=>resolve({image,dataURI:reader.result});
        image.onerror=()=>reject(Error('Choose a PNG image.'));
        image.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
    if(window.MNC_DISK?.connected)return window.MNC_DISK.upload(file,name,'glyph',false);
    const asset={id:uniqueId('GLYPH-',state.assets),title:name.replace(/\.png$/i,''),originalFilename:name,
      dataURI,kind:'Glyph',w:image.width,h:image.height};
    state.assets.push(asset);
    return asset;
  }

  function presentation(value,mode) {
    const glyph=clean(value);
    if(mode==='emoji')return glyph.replace(/\p{Extended_Pictographic}/gu,char=>char+'\ufe0f');
    return glyph.replace(/\p{Extended_Pictographic}/gu,char=>char+'\ufe0e');
  }

  function fontStack(symbol) {
    if(symbol.presentation==='emoji')return '"Segoe UI Emoji", "Apple Color Emoji", "MNC Emoji Fallback", "Noto Color Emoji", sans-serif';
    return '"'+symbol.font+'", '+monoStack;
  }

  async function ready() {
    if(!document.fonts)return;
    await Promise.all(['MNC Symbols','MNC Symbols One','MNC Emoji Fallback'].map(name=>document.fonts.load('24px "'+name+'"')));
  }

  async function fontStatus(name) {
    if(!document.fonts||typeof FontFace==='undefined')return 'Font availability can be checked in your browser.';
    if(!availability.has(name)){
      availability.set(name,(async()=>{
        if(name==='MNC Symbols'){
          try{await ready();return 'Bundled monochrome font.';}catch{return 'Bundled font could not load.';}
        }
        try{
          const font=await new FontFace('MNC probe '+name,'local("'+name+'")').load();
          return font?'Installed on this device. Glyph fallback can vary by character.':'';
        }catch{return name+' is unavailable on this device. Using the bundled symbol font.';}
      })());
    }
    return availability.get(name);
  }

  async function preparedImage(asset,symbol,ink) {
    if(!asset)return null;
    const uri=assetURI(asset),key=uri+'|'+symbol.imageMode+'|'+symbol.removeWhite+'|'+ink;
    if(!imageCache.has(key)){
      if(imageCache.size>100)imageCache.clear();
      imageCache.set(key,(async()=>{
        const img=await imgLoad(uri);
        if(!img)return null;
        const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        fitImage(ctx,img,{x:0,y:0,w:512,h:512},'contain');
        const sample=ctx.getImageData(0,0,512,512);
        const corners=[0,511*4,511*512*4,(512*512-1)*4];
        const whitePaper=corners.every(i=>sample.data[i+3]>245&&Math.min(sample.data[i],sample.data[i+1],sample.data[i+2])>245);
        if(symbol.imageMode==='tint'&&symbol.removeWhite&&whitePaper){
          const pixels=ctx.getImageData(0,0,512,512),data=pixels.data;
          for(let i=0;i<data.length;i+=4){
            const white=Math.min(data[i],data[i+1],data[i+2])/255;
            data[i+3]=Math.round(data[i+3]*(1-white));
          }
          ctx.putImageData(pixels,0,0);
        }
        if(symbol.imageMode==='tint'){
          ctx.globalCompositeOperation='source-in';ctx.fillStyle=ink;ctx.fillRect(0,0,512,512);
        }
        return canvas;
      })());
    }
    return imageCache.get(key);
  }

  async function draw(ctx,symbol,x,y,size,ink,id='') {
    const s=normalize(symbol,id);
    if(!size||s.source==='hidden')return false;
    x+=s.offsetX*size/100;
    y+=s.offsetY*size/100;
    const color=s.color||ink;
    if(s.source==='image'){
      const image=await preparedImage(artById(s.assetId),s,color);
      if(image){ctx.drawImage(image,x-size/2,y-size/2,size,size);return true;}
    }
    if(s.source==='builtin'){
      const profile=s.builtinId||id;
      const builtin=MNC_SET_PLAN.profile(profile)?.builtin||profile;
      if(MNC_TYPE_GLYPHS.sourceFor(builtin)||MNC_TYPE_GLYPHS.has(builtin)){
        await MNC_TYPE_GLYPHS.draw(ctx,builtin,x,y,size,color);return true;
      }
    }
    await ready();
    const text=presentation(s.glyph||MNC_SET_PLAN.profile(id)?.glyph||'◆',s.presentation);
    if(s.presentation==='text'){
      const resolution=Math.min(512,Math.max(64,Math.ceil(size*1.5)));
      const key=[text,s.font,color,resolution].join('|');
      if(!textCache.has(key)){
        if(textCache.size>96)textCache.clear();
        const stamp=document.createElement('canvas');
        const extent=resolution+2*Math.ceil(resolution*.34);
        stamp.width=stamp.height=extent;
        const paint=stamp.getContext('2d',{willReadFrequently:true});
        paint.font='400 '+resolution*.78+'px '+fontStack(s);paint.fillStyle='#000000';
        paint.textAlign='center';paint.textBaseline='middle';paint.fillText(text,extent/2,extent/2,resolution*.95);
        const sample=paint.getImageData(0,0,extent,extent),data=sample.data;
        let coloredFallback=false;
        for(let i=0;i<data.length;i+=4)if(data[i+3]>100&&Math.max(data[i],data[i+1],data[i+2])>12){coloredFallback=true;break;}
        if(coloredFallback){
          for(let i=0;i<data.length;i+=4){
            const light=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])/255;
            data[i+3]=Math.round(data[i+3]*(1-light));data[i]=data[i+1]=data[i+2]=0;
          }
          paint.putImageData(sample,0,0);
        }
        paint.globalCompositeOperation='source-in';
        paint.fillStyle=color;paint.fillRect(0,0,extent,extent);
        textCache.set(key,stamp);
      }
      const image=textCache.get(key),span=size/.78*image.width/resolution;
      ctx.drawImage(image,x-span/2,y-span/2,span,span);
    }else{
      ctx.save();ctx.font='400 '+size+'px '+fontStack(s);ctx.fillStyle=color;
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y,size*1.2);ctx.restore();
    }
    return true;
  }

  async function centeredPreview(symbol,width,height,ink,id){
    const work=document.createElement('canvas'), output=document.createElement('canvas');
    const extent=256;
    work.width=work.height=extent;
    output.width=width;output.height=height;
    const paint=work.getContext('2d',{willReadFrequently:true});
    if(!await draw(paint,symbol,extent/2,extent/2,extent*.52,ink,id))return output;
    const bounds=MNC_FRONT_EFFECTS.alphaBounds(paint);
    if(!bounds)return output;
    const {x,y,w,h}=bounds,scale=Math.min(width*.74/w,height*.74/h);
    output.getContext('2d').drawImage(work,x,y,w,h,(width-w*scale)/2,(height-h*scale)/2,w*scale,h*scale);
    return output;
  }

  function badgeScale(shape){
    return {none:1,circle:.75,square:.75,pill:.68,diamond:.58,shield:.64}[shape]||1;
  }

  async function drawBadge(ctx,symbol,x,y,size,ink,id='') {
    const s=normalize(symbol,id),shape=s.backdrop,r=size/2;
    if(!size||s.source==='hidden')return false;
    if(shape==='none')return draw(ctx,s,x,y,size,ink,id);
    ctx.save();
    ctx.beginPath();
    if(shape==='circle')ctx.arc(x,y,r,0,Math.PI*2);
    else if(shape==='square')ctx.roundRect(x-r,y-r,size,size,r*.22);
    else if(shape==='pill')ctx.roundRect(x-r,y-r*.68,size,size*.68,r*.68);
    else if(shape==='diamond'){
      ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();
    }else{
      ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y-r);ctx.lineTo(x+r*.85,y+r*.34);
      ctx.quadraticCurveTo(x+r*.57,y+r*.78,x,y+r);
      ctx.quadraticCurveTo(x-r*.57,y+r*.78,x-r*.85,y+r*.34);
      ctx.closePath();
    }
    ctx.fillStyle='#e3d4b5';ctx.fill();ctx.restore();
    return draw(ctx,{...s,offsetX:0,offsetY:0},x+s.offsetX*size/100,y+s.offsetY*size/100,
      size*badgeScale(shape),'#20251e',id);
  }

  async function centerOffsets(symbol,id=''){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),size=144;
    const s=normalize(symbol,id);
    await draw(ctx,{...s,offsetX:0,offsetY:0},128,128,size*badgeScale(s.backdrop),'#000000',id);
    const box=MNC_FRONT_EFFECTS.alphaBounds(ctx);
    return {offsetX:box?alignment((128-box.x-box.w/2)*100/size):0,offsetY:box?alignment((128-box.y-box.h/2)*100/size):0};
  }

  async function drawCard(ctx,card,x,y,size,ink,place='type') {
    const {symbol,id}=cardSymbol(state,card,place);
    return drawBadge(ctx,symbol,x,y,size,ink,id);
  }

  return {fonts,normalize,defaults,restore,profileSymbol,typeMark,cardSymbol,cardMode,setCardMode,setCardSymbol,
    glyphAssets,imageOptions,storeGlyph,matchingGlyphs,fontStack,presentation,fontStatus,ready,draw,drawBadge,drawCard,
    centeredPreview,centerOffsets,preparedImage};
})();
