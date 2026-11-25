'use strict';

globalThis.MNC_LAYOUT = (() => {
  const effects=MNC_FRONT_EFFECTS;
  const labels = {
    background:'Background', border:'Outer border', family:'Family label', typeLabel:'Type heading',
    headerSubtype:'Subtype', cornerIcon:'Type symbol', art:'Artwork', cutout:'Artwork cutout', overlay:'Artwork overlay',
    shade:'Text shading', plate:'Nameplate', title:'Card title', match:'Matchups',
    typeRule:'Shared type rule', ruleTitle:'Power name', timing:'Power timing', rule:'Power text',
    quote:'Quote', copyRule:'Content divider', footerPanel:'Footer panel', footerLine:'Footer divider',
    artist:'Credits & source', footer:'Set Abbrev', setIcon:'Set Symbol', number:'Card number',
    foilImprint:'Foil pattern imprint',
    episodeBadge:'Cassette badge', symbols:'Legacy symbols', stats:'Legacy stats'
  };
  const geometryKeys=['x','y','w','h'];
  const legal=id=>Object.hasOwn(labels,id)||/^extra:[\w-]{1,96}$/.test(id);
  const full=()=>({x:0,y:0,w:CW,h:CH});
  const bounded=(key,value)=>clamp(value,key==='x'?-CW:key==='y'?-CH:4,key==='y'||key==='h'?CH*2:CW*2);
  const get=(card,id)=>MNC_FRONT.isSharedFooterLayer(card,id)?state.sharedFooter.layers[id]:card.layoutDesign?.layers?.[id];
  const hidden=(card,id)=>get(card,id)?.hidden===true;

  function normalize(value) {
    if(value?.version!==1)return undefined;
    const layers={};
    for(const [id,input] of Object.entries(value.layers||{}).slice(0,200)){
      if(!legal(id)||!input||typeof input!=='object')continue;
      const change={};
      for(const key of geometryKeys)if(Number.isFinite(input[key]))change[key]=bounded(key,input[key]);
      if(input.hidden===true&&id!=='background')change.hidden=true;
      if(id!=='background'){
        const outline=effects.outline(input.outline),shadow=effects.shadow(input.shadow);
        if(outline)change.outline=outline;
        if(shadow)change.shadow=shadow;
      }
      if(id==='plate'||id==='border'||id.startsWith('extra:')){
        const gradient=effects.gradient(input.gradient);
        if(gradient)change.gradient=gradient;
      }
      if(id==='border'){
        const frame=MNC_OUTER_BORDER.normalize(input.frame),imageMask=MNC_OUTER_BORDER.normalizeMask(input.imageMask);
        if(frame)change.frame=frame;
        if(imageMask)change.imageMask=imageMask;
      }
      if(Object.keys(change).length)layers[id]=change;
    }
    const order=Array.isArray(value.order)?[...new Set(value.order.filter(id=>typeof id==='string'&&legal(id)))].slice(0,200):[];
    const result={version:1,layers,order};
    if(Number.isFinite(value.contentTop))result.contentTop=clamp(value.contentTop,0,CH);
    if(Number.isFinite(value.artFlow))result.artFlow=clamp(value.artFlow,-CH,CH);
    if(value.followArt===false)result.followArt=false;
    const bg=value.background;
    if(bg?.mode==='solid'){
      const color=bg.color||bg.start;
      if(MNC_FRONT.hex(color))result.background={mode:'solid',color};
    }
    if(bg?.mode==='gradient'){
      const prior=MNC_FRONT.hex(bg.start)?effects.ramp(bg.start,MNC_FRONT.hex(bg.end)?bg.end:bg.start,
        Number.isFinite(bg.angle)?bg.angle:90):null;
      const gradient=effects.gradient(bg.gradient||prior);
      if(gradient)result.background={mode:'gradient',gradient};
    }
    return result;
  }

  function editable(card) {
    return card.layoutDesign ??= {version:1,layers:{},order:[]};
  }

  function geometry(card,id,base) {
    const edit=get(card,id)||{};
    return Object.fromEntries(geometryKeys.map(key=>[key,edit[key]??base[key]]));
  }

  function transform(ctx,base,rect) {
    const sx=base.w>0?rect.w/base.w:1, sy=base.h>0?rect.h/base.h:1;
    if(sx===1&&sy===1&&base.x===rect.x&&base.y===rect.y)return;
    ctx.translate(rect.x,rect.y);
    ctx.scale(sx,sy);
    ctx.translate(-base.x,-base.y);
  }

  function replaceBackground(card,spec){
    const layout=editable(card);
    if(spec)layout.background=spec;
    else delete layout.background;
    if(spec)card.mainColor=spec.mode==='solid'?spec.color:effects.firstColor(spec.gradient);
    else delete card.mainColor;
    card.backgroundLightness=0;
  }

  function backgroundStart(card,color){
    const bg=card.layoutDesign?.background;
    if(bg?.mode==='solid')bg.color=color;
    if(bg?.mode==='gradient'){
      const first=bg.gradient.stops.reduce((left,stop)=>stop.at<left.at?stop:left);
      first.color=color;
    }
  }

  function background(ctx,card,fallback) {
    const bg=card.layoutDesign?.background;
    const tone=color=>MNC_FRONT.tone(color,card.backgroundLightness);
    let fill;
    if(bg?.mode==='solid')fill=tone(bg.color);
    else if(bg?.mode==='gradient')fill=effects.paintGradient(ctx,full(),bg.gradient,tone);
    else fill=typeof fallback==='function'?fallback():fallback;
    ctx.fillStyle=fill;
    ctx.fillRect(0,0,CW,CH);
  }

  function artFlow(card){
    return card.layoutDesign?.artFlow||0;
  }

  function canFollowArt(card){
    return card.template==='Standard'||(game.isGameCard(card)&&card.template!=='Game Full Art'&&card.artworkProfile!=='full');
  }

  function shiftArtFlow(card,before,after){
    if(!canFollowArt(card)||card.layoutDesign?.followArt===false||before.h===after.h)return;
    const edge=before.y+before.h, shift=after.y+after.h-edge;
    if(!shift)return;
    const layout=editable(card);
    layout.artFlow=clamp(artFlow(card)+shift,-CH,CH);
    for(const id of ['plate','title','match','typeRule','ruleTitle','timing','rule','quote','copyRule']){
      const layer=get(card,id);
      if(Number.isFinite(layer?.y)&&layer.y>=edge-8)layer.y=bounded('y',layer.y+shift);
    }
  }

  function layerEdit(card,id){
    return editable(card).layers[id]??={};
  }

  function cleanLayer(card,id){
    if(!Object.keys(get(card,id)||{}).length)delete card.layoutDesign?.layers?.[id];
  }

  function linear(ctx,stops) {
    const fill=ctx.createLinearGradient(0,0,CW,CH);
    for(const [position,color] of stops)fill.addColorStop(position,color);
    return fill;
  }

  function scene(ctx,card) {
    const layers=[];
    function add(id,base,paint,options={}) {
      const {label=labels[id],adjustBox=false,empty=false,hit='inside',text=null,internal=false,foilText=!!text}=options;
      const rect=id==='background'||internal?base:geometry(card,id,base);
      layers.push({id,label,base,rect,paint,adjustBox,hidden:hidden(card,id),empty,hit,text,internal,foilText});
    }
    function ordered() {
      const order=card.layoutDesign?.order;
      if(!order?.length)return layers;
      const byId=new Map(layers.filter(layer=>!layer.internal&&layer.id!=='background').map(layer=>[layer.id,layer]));
      const sorted=order.map(id=>byId.get(id)).filter(Boolean);
      const used=new Set(sorted);
      sorted.push(...[...byId.values()].filter(layer=>!used.has(layer)));
      let index=0;
      return layers.map(layer=>layer.internal||layer.id==='background'?layer:sorted[index++]);
    }
    async function render(onLayer,{captureText=true}={}) {
      const {width,height}=ctx.canvas;
      const target=onLayer?effects.canvas(width,height).getContext('2d'):ctx;
      let styled,textTarget;
      const clearLayer=paint=>{
        paint.setTransform(1,0,0,1,0,0);
        paint.clearRect(0,0,width,height);
        effects.copyTransform(paint,ctx);
      };
      for(const layer of ordered()){
        if(layer.hidden||layer.empty)continue;
        if(onLayer)clearLayer(target);
        const draw=async (target,paint=layer.paint)=>{
          target.save();
          try{
            if(!layer.adjustBox)transform(target,layer.base,layer.rect);
            await paint(target,layer.rect);
          }finally{target.restore();}
        };
        const edit=get(card,layer.id);
        if(!layer.internal&&(edit?.outline||edit?.shadow)){
          styled??=effects.styledPainter(target);
          await styled(edit,draw);
        }else await draw(target);
        if(onLayer){
          ctx.save();
          ctx.setTransform(1,0,0,1,0,0);
          ctx.drawImage(target.canvas,0,0);
          ctx.restore();
          let lettering=captureText&&layer.foilText===true?target.canvas:null;
          if(captureText&&typeof layer.foilText==='function'){
            textTarget??=effects.canvas(width,height).getContext('2d');
            clearLayer(textTarget);
            await draw(textTarget,layer.foilText);
            lettering=textTarget.canvas;
          }
          onLayer(layer.id,target.canvas,lettering);
        }
      }
    }
    function inspect() {
      return ordered().filter(layer=>!layer.internal).map(({id,label,base,rect,hidden,empty,hit,text})=>
        ({id,label,base,rect,hidden,empty,hit,text}));
    }
    return {add,render,inspect};
  }

  function textBox(ctx,card,id,value,x,baseline,base) {
    const style=MNC_FRONT.style(card,id,base), offset=MNC_FRONT.textOffset(card,id);
    ctx.font=style.font;
    const width=Math.min(style.width||CW,Math.max(24,ctx.measureText(value||'').width+
      Math.max(0,(String(value||'').length-1)*(style.spacing||0))+6));
    const left=x-(style.align==='center'?width/2:style.align==='right'?width:0);
    return {x:left+offset.x,y:baseline-style.size+offset.y,w:width,h:style.size*1.2};
  }

  function textLayer(scene,ctx,card,id,value,x,y,style) {
    scene.add(id,textBox(ctx,card,id,value,x,y,style),ctx=>MNC_FRONT.draw(ctx,card,id,value,x,y,style),
      {empty:!value,text:{key:id,value,size:style.size,color:style.color}});
  }

  function contentBox(ctx,box,rows,style) {
    ctx.font=style.font;
    const width=Math.max(65,Math.min(box.w,Math.max(0,...rows.map(row=>ctx.measureText(row).width))+10));
    const x=box.x+(style.align==='center'?(box.w-width)/2:style.align==='right'?box.w-width:0);
    return {x,y:box.y,w:width,h:Math.max(style.size*1.2,box.h)};
  }

  function addTitle(scene,ctx,card,box,{size,min,weight,family,color,inset,baseline}) {
    const options=MNC_FRONT.effective(card);
    const width=Math.max(45,box.w*(1-2*(options.titleSafe??0)/100)-inset);
    const value=String(card.title||'Untitled').trim()||'Untitled';
    const base={size,weight,family,color,align:'center',width};
    let active=MNC_FRONT.style(card,'title',base);
    ctx.font=active.font;
    while(!options.text?.title?.size&&ctx.measureText(value).width>width&&active.size>min){
      active=MNC_FRONT.style(card,'title',{...base,size:active.size-1});
      ctx.font=active.font;
    }
    const x=box.x+(active.align==='left'?(box.w-width)/2:active.align==='right'?(box.w+width)/2:box.w/2);
    const y=box.y+box.h/2+active.size*baseline;
    scene.add('title',textBox(ctx,card,'title',value,x,y,{...base,size:active.size}),async ctx=>{
      const delta=MNC_FRONT.textOffset(card,'title');
      const custom=await window.MNC_drawFontLine?.(ctx,value,x+delta.x,y+delta.y,active.size,
        {fontId:options.text?.title?.font?'system':card.fontId,variation:card.glyphVariantMode||'seeded',
          seed:card.glyphSeed||1,maxWidth:width,align:active.align,color:active.color});
      if(!custom)MNC_FRONT.draw(ctx,card,'title',value,x,y,{...base,size:active.size});
    },{text:{key:'title',value,size:active.size,color}});
  }

  function addIcon(scene,card,ink) {
    const box=MNC_FRONT.typeIconBox(card);
    const source=MNC_SYMBOLS.cardSymbol(state,card).symbol.source;
    scene.add('cornerIcon',box,ctx=>MNC_FRONT.drawTypeIcon(ctx,card,ink),{empty:!box.w||source==='hidden'});
  }

  function addCredits(scene,card,options) {
    scene.add('artist',MNC_FRONT.attributionBox(card,options),ctx=>MNC_FRONT.drawCredit(ctx,card,options),{foilText:true});
  }

  function addEpisodeBadge(scene,card,color) {
    const box=MNC_FRONT.episodeBadgeBox(card);
    scene.add('episodeBadge',box||{x:315,y:972,w:32,h:23},
      ctx=>MNC_FRONT.drawEpisodeBadge(ctx,card,color),{empty:!box});
  }

  function addOverlay(scene,card) {
    scene.add('overlay',full(),async (ctx,rect)=>{
      const image=await imgLoad(assetURI(artById(card.overlayAssetId)));
      if(!image)return;
      ctx.globalAlpha=clamp(Number(card.overlayOpacity??.8),0,1);
      fitImage(ctx,image,rect,'contain');
    },{adjustBox:true,empty:!card.overlayAssetId,hit:'none'});
  }

  function starters(card) {
    if(card.family==='Critic'||card.family==='Member')return [['critic','Critic · Review column']];
    if(card.family==='Movie')return [['movie','Movie · Projection Booth']];
    if(card.family==='Character'||card.family==='Item')return [['game','Gameplay frame']];
    return [['standard','Standard frame']];
  }

  function applyStarter(card,id) {
    if(!starters(card).some(([key])=>key===id))return;
    const layout=editable(card);
    const gameFrame=id==='game'||id==='critic'&&card.family==='Critic';
    card.template=gameFrame?'Game Frame':'Standard';
    const text=card.frontLayout?.text||{};
    card.frontLayout=MNC_FRONT.settings({...card.frontLayout,offsets:{},text});
    layout.layers={};
    layout.order=[];
    delete layout.background;
    delete layout.contentTop;
    delete layout.artFlow;
    if(id==='critic'){
      layout.background={mode:'gradient',gradient:effects.ramp('#f7efe0','#d0bda4',125)};
      layout.contentTop=696;
      const rects={
        art:{x:57,y:140,w:636,h:416},
        plate:{x:56,y:576,w:638,h:94},
        title:{x:76,y:594}
      };
      layout.layers=rects;
      Object.assign(card,{mainColor:'#f7efe0',surface:'paper',borderColor:'#6d3f52',nameplate:'outline',
        artBorder:'solid',artShape:'rounded',artRadius:20,frameStyle:'single',frameWidth:6});
      Object.assign(card.frontLayout,{plateStroke:'#6d3f52',plateStrokeWidth:2,
        offsets:{typeRule:{x:13,y:0},rule:{x:13,y:0},quote:{x:13,y:0}}});
      Object.assign(card.frontLayout.text,{title:{size:52,font:'serif',color:'#432637'},
        ruleTitle:{size:26,font:'serif',color:'#432637'},quote:{size:24,font:'serif',style:'italic',color:'#523447'}});
    }else if(id==='movie'){
      layout.contentTop=733;
      layout.layers={family:{y:44},typeLabel:{x:402,y:46},art:{x:42,y:185,w:666,h:483},
        plate:{x:42,y:98,w:666,h:78},title:{y:105},copyRule:{y:710}};
      Object.assign(card,{filmTheme:'projection',mainColor:null,borderColor:null,nameplate:'outline',
        artBorder:'double',artShape:'cut',artRadius:24});
      Object.assign(card.frontLayout,{plateStroke:'#aa9072',plateStrokeWidth:2});
      Object.assign(card.frontLayout.text,{family:{size:26,font:'sans',color:'#d3b991'},
        title:{size:48,font:'serif',color:'#f7ecda'},quote:{size:22,font:'serif',style:'italic',color:'#e4cba6'}});
    }else if(gameFrame){
      Object.assign(card,{artworkProfile:'standard',artHeight:52,artInset:6,artShape:'marquee',artBorder:'solid',nameplate:'solid'});
    }
    MNC_OUTER_BORDER.applyStartingBand(card);
  }

  return {labels,normalize,editable,get,hidden,geometry,bounded,transform,full,background,linear,scene,
    layerEdit,cleanLayer,artFlow,canFollowArt,shiftArtFlow,replaceBackground,backgroundStart,
    textBox,textLayer,contentBox,addTitle,addIcon,addCredits,addEpisodeBadge,addOverlay,starters,applyStarter};
})();
