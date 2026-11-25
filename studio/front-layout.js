'use strict';

globalThis.MNC_FRONT = (() => {
  const groups = {
    art: 'Artwork window',
    type: 'Family and type text',
    cornerIcon: 'Top-right type icon',
    title: 'Nameplate and title',
    match: 'Matchups',
    typeRule: 'Shared type rule',
    rule: 'Special rule',
    quote: 'Quote',
    artist: 'Attribution and source',
    footer: 'Set Abbrev',
    number: 'Card number',
    episodeBadge: 'Cassette badge'
  };
  const textFields = {
    family: ['Family label','type',19],
    typeLabel: ['Type / subtype','type',35],
    headerSubtype: ['Character subtype','type',19],
    rarity: ['Rarity','type',15],
    role: ['Header badge text','type',15],
    roleGlyph: ['Header badge icon','type',34],
    title: ['Card title','title',54],
    matchLabel: ['Beats / beaten by labels','match',15],
    matchValue: ['Matchup names','match',23],
    ruleTitle: ['Rule name','rule',23],
    timing: ['Rule timing','rule',14],
    typeRule: ['Shared type rule','typeRule',20],
    rule: ['Special rule text','rule',23],
    quote: ['Quote','quote',19],
    artLabel: ['Credit label','artist',13],
    artist: ['Illustration credit','artist',16],
    concept: ['Concept credit','artist',16],
    actor: ['Actor credit','artist',16],
    film: ['Film title','artist',15],
    episode: ['Episode / picker','artist',14],
    edition: ['Collection / edition / card number','footer',17],
    number: ['Card number','number',36],
    source: ['Episode / picker (previous layout)','footer',15],
    rarityGlyph: ['Rarity glyph','type',28]
  };
  const defaults = {
    game:{plateWidth:656,plateHeight:62,plateStrokeWidth:1,creditMode:'byline'},
    standard:{plateWidth:646,plateHeight:91,plateStrokeWidth:0,creditMode:'byline'}
  };
  const styleByFont = {
    sans:'Arial, sans-serif', serif:'Georgia, serif', mono:'"Courier New", monospace', system:'system-ui'
  };
  const clampNumber = (n,min,max) => Math.max(min,Math.min(max,n));
  const hex = value => typeof value==='string' && /^#[\da-f]{6}$/i.test(value);
  const channels = color=>color.slice(1).match(/../g).map(value=>parseInt(value,16));
  const emojiFont = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  const sharedFooterLayers=['footer','number','setIcon'];
  const usesSharedFooter=card=>card?.collectionFooterMode==='shared';
  const isSharedFooterLayer=(card,id)=>usesSharedFooter(card)&&sharedFooterLayers.includes(id);
  const cornerFooter={codeSize:23,numberSize:19,markSize:42};

  function sharedFooterSettings(value){
    const size=(key,fallback,min,max)=>Number.isFinite(value?.[key])?clampNumber(Math.round(value[key]),min,max):fallback;
    const text=settings({text:{edition:value?.text?.edition,number:value?.text?.number}}).text;
    for(const style of Object.values(text)){
      for(const key of ['size','color','x','y'])delete style[key];
    }
    const layers=MNC_LAYOUT.normalize({version:1,layers:Object.fromEntries(
      sharedFooterLayers.map(id=>[id,value?.layers?.[id]])
    )}).layers;
    for(const layer of Object.values(layers))delete layer.hidden;
    return {position:value?.position==='center'?'center':'right',codeSize:size('codeSize',cornerFooter.codeSize,7,144),
      numberSize:size('numberSize',cornerFooter.numberSize,7,144),markSize:size('markSize',cornerFooter.markSize,0,200),
      autoContrast:value?.autoContrast!==false,useForNewCards:value?.useForNewCards===true,text,layers};
  }

  function mix(a,b,weight) {
    const from=channels(a),to=channels(b);
    return '#'+from.map((value,i)=>Math.round(value*(1-weight)+to[i]*weight).toString(16).padStart(2,'0')).join('');
  }

  function tone(color,amount=0) {
    const strength=clampNumber(Number(amount)||0,-60,60)/100;
    return mix(color,strength<0?'#000000':'#fffaf0',Math.abs(strength));
  }

  function luminance(r,g,b) {
    const linear=value=>{
      const s=value/255;
      return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;
    };
    return .2126*linear(r)+.7152*linear(g)+.0722*linear(b);
  }

  function surfaceText(color) {
    const ink=luminance(...channels(color))>.183?'#171b1b':'#fff8eb';
    return {ink,quiet:mix(color,ink,.83)};
  }

  function values(card) {
    const standard=card.template==='Standard';
    const promo=MNC_CARD_METADATA.isPromo(card,collectionFor(card));
    const options=effective(card);
    const layout={footerPosition:promo?'center':'right',printEdition:!promo,numberFormat:'fraction',numberBadge:'none',
      ...defaults[standard?'standard':'game'],...options};
    if(standard&&card.nameplate==='outline'&&options.plateStrokeWidth===undefined)layout.plateStrokeWidth=4;
    layout.typeIcon=typeIconSize(card);
    return layout;
  }

  function settings(value) {
    const offsets = {}, text = {};
    for (const id of Object.keys(groups)) {
      const p=value?.offsets?.[id];
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) {
        offsets[id]={x:clampNumber(p.x,-750,750),y:clampNumber(p.y,-1050,1050)};
      }
    }
    for (const id of Object.keys(textFields)) {
      const item=value?.text?.[id];
      if (!item || typeof item!=='object') continue;
      const style={};
      if (Number.isFinite(item.size)) style.size=clampNumber(item.size,7,144);
      for(const [key,limit] of [['x',750],['y',1050]]){
        if(Number.isFinite(item[key]))style[key]=clampNumber(item[key],-limit,limit);
      }
      if (Object.hasOwn(styleByFont,item.font)) style.font=item.font;
      if (['normal','bold','italic','bold-italic'].includes(item.style)) style.style=item.style;
      if (hex(item.color)) style.color=item.color;
      if (['left','center','right'].includes(item.align)) style.align=item.align;
      if (Object.keys(style).length) text[id]=style;
    }
    const next={offsets,text};
    if (['stacked','line','byline','hidden'].includes(value?.creditMode)) next.creditMode=value.creditMode;
    if (['left','center','right'].includes(value?.creditAlign)) next.creditAlign=value.creditAlign;
    if (typeof value?.creditLabel==='string') next.creditLabel=value.creditLabel.slice(0,32);
    if (['right','center'].includes(value?.footerPosition)) next.footerPosition=value.footerPosition;
    const independent=value?.independentFooter;
    if(Number.isFinite(independent?.markSpace)&&Number.isFinite(independent?.numberSpace)){
      next.independentFooter={markSpace:clampNumber(independent.markSpace,0,209),numberSpace:clampNumber(independent.numberSpace,0,149)};
      if(independent.copiedShared===true)next.independentFooter.copiedShared=true;
      if(independent.fixedBoxes===true){
        next.independentFooter.fixedBoxes=true;
        next.independentFooter.autoContrast=independent.autoContrast!==false;
      }
    }
    if (['number','fraction','label'].includes(value?.numberFormat)) next.numberFormat=value.numberFormat;
    if (['none','outline','pill'].includes(value?.numberBadge)) next.numberBadge=value.numberBadge;
    if (['columns','stacked'].includes(value?.matchLayout)) next.matchLayout=value.matchLayout;
    if (['wins-first','losses-first'].includes(value?.matchOrder)) next.matchOrder=value.matchOrder;
    for(const key of ['matchLabels','matchIcons','matchNames','printCollectionCode','printEdition','footerRule','showCharacterSubtype']){
      if(typeof value?.[key]==='boolean')next[key]=value[key];
    }
    for(const key of ['winLabel','lossLabel'])if(typeof value?.[key]==='string')next[key]=value[key].slice(0,48);
    if (['none','tint','solid','outline'].includes(value?.matchStyle)) next.matchStyle=value.matchStyle;
    if (hex(value?.matchColor)) next.matchColor=value.matchColor;
    for (const [key,lo,hi] of [['matchOpacity',0,1],['matchGap',4,180],['matchIcon',0,60],
      ['typeIcon',0,250],['setIcon',0,200],['matchIconX',-300,300],['matchIconY',-300,300],['setIconX',-300,300],['setIconY',-300,300],['episodeBadgeSize',12,80],['titleSafe',0,45],['creditWidth',120,640]]) {
      if (Number.isFinite(value?.[key])) next[key]=clampNumber(value[key],lo,hi);
    }
    if (hex(value?.episodeBadgeColor)) next.episodeBadgeColor=value.episodeBadgeColor;
    if (hex(value?.plateFill)) next.plateFill=value.plateFill;
    if (hex(value?.plateStroke)) next.plateStroke=value.plateStroke;
    if (Number.isFinite(value?.plateOpacity)) next.plateOpacity=clampNumber(value.plateOpacity,0,1);
    if (Number.isFinite(value?.plateStrokeWidth)) next.plateStrokeWidth=clampNumber(value.plateStrokeWidth,0,16);
    if (Number.isFinite(value?.plateHeight)) next.plateHeight=clampNumber(value.plateHeight,24,140);
    if (Number.isFinite(value?.plateWidth)) next.plateWidth=clampNumber(value.plateWidth,130,706);
    return next;
  }

  function editable(card) {
    return card.frontLayout ??= settings();
  }

  function collectionMark(card){
    const {symbol,id}=MNC_SYMBOLS.cardSymbol(state,card,'collection');
    return {symbol:usesSharedFooter(card)?{...symbol,color:''}:symbol,id};
  }

  function copySharedFooter(card,layout,from){
    const {symbol}=collectionMark(card);
    const shared=state.sharedFooter;
    Object.assign(layout,{footerPosition:from.footerPosition,numberFormat:from.numberFormat,numberBadge:from.numberBadge,
      printCollectionCode:from.printCollectionCode,printEdition:from.printEdition,setIcon:from.setIcon,setIconX:0,setIconY:0,
      independentFooter:{markSpace:from.setIcon+9,numberSpace:from.text.number.size+5,copiedShared:true,
        fixedBoxes:true,autoContrast:shared.autoContrast}});
    const offsets=layout.offsets??={},text=layout.text??={};
    offsets.number={x:0,y:0};
    text.edition={...from.text.edition};
    text.number={...from.text.number};
    for(const id of sharedFooterLayers){
      delete card.layoutDesign?.layers?.[id];
      const layer=shared.layers[id];
      if(layer)Object.assign(MNC_LAYOUT.layerEdit(card,id),deep(layer));
    }
    editCardFields(card,{collectionSymbol:symbol,collectionSymbolMode:symbol.source==='hidden'?'hidden':'custom'});
  }

  function setFooterMode(card,mode,{copyShared=false}={}){
    if(mode==='custom'){
      const layout=editable(card),from=values(card);
      if(usesSharedFooter(card)&&(copyShared||!layout.independentFooter))copySharedFooter(card,layout,from);
      else if(!layout.independentFooter)layout.independentFooter={markSpace:(from.setIcon??29)+9,
        numberSpace:(from.text?.number?.size??36)+5};
    }
    editCardFields(card,{collectionFooterMode:mode});
  }

  function effective(card) {
    return globalThis.MNC_TYPE_DESIGN?MNC_TYPE_DESIGN.layout(state,card):card.frontLayout||{};
  }

  function offset(card,id) {
    return effective(card).offsets?.[id] ?? {x:0,y:0};
  }

  function box(card,id,rect) {
    const delta=offset(card,id);
    return {...rect,x:rect.x+delta.x,y:rect.y+delta.y};
  }

  function style(card,id,base) {
    const edit=effective(card).text?.[id] || {};
    const size=edit.size??base.size;
    const family=styleByFont[edit.font]??base.family??'Arial, sans-serif';
    const weight=edit.style ? (edit.style.includes('bold')?700:400) : (base.weight??500);
    const italic=edit.style ? edit.style.includes('italic') : !!base.italic;
    return {...base,...edit,size,weight,italic,family,font:`${italic?'italic ':''}${weight} ${size}px ${family}`};
  }

  function textOffset(card,id) {
    const delta=effective(card).text?.[id];
    return {x:delta?.x??0,y:delta?.y??0};
  }

  function draw(ctx,card,id,value,x,y,base) {
    const options=style(card,id,base), delta=textOffset(card,id);
    ctx.font=options.font;ctx.fillStyle=options.color;
    ctx.textAlign=options.align||'left';ctx.textBaseline='alphabetic';
    const previous=ctx.letterSpacing;
    if('letterSpacing' in ctx)ctx.letterSpacing=(options.spacing??0)+'px';
    if(options.width)ctx.fillText(String(value),x+delta.x,y+delta.y,options.width);
    else ctx.fillText(String(value),x+delta.x,y+delta.y);
    if('letterSpacing' in ctx)ctx.letterSpacing=previous;
    return options;
  }

  function addHeader(scene,ctx,card,{x=47,y=99,ink,quiet=ink,standard=false}={}) {
    const delta=offset(card,'type');
    x+=delta.x;y+=delta.y;
    const heading=(id,value,baseline,style)=>MNC_LAYOUT.textLayer(scene,ctx,card,id,value,x,baseline,style);
    const category=MNC_GAME.categoryFor(card.characterCategory);
    if(card.family==='Character'){
      const creature=category?.id==='creature'?String(card.characterType||'').trim():'';
      const subtype=String(card.characterSubtype||'').trim();
      const showSubtype=category?.id!=='creature'&&(effective(card).showCharacterSubtype??category?.id==='villain');
      if(creature)heading('family','CREATURE',y-36,{size:17,weight:700,color:quiet,spacing:2,width:430});
      heading('typeLabel',creature||category?.name||'Character',y-(showSubtype&&subtype?16:2),
        {size:39,weight:700,family:'Georgia, serif',color:ink,width:545});
      if(category?.id!=='creature')heading('headerSubtype',showSubtype?subtype:'',y+8,
        {size:19,weight:400,family:'Georgia, serif',italic:true,color:quiet,width:520});
      return;
    }
    const type=card.roleSubtype||(standard&&!/^episode\b/i.test(card.subtype||'')?card.subtype:'');
    heading('family',String(card.family||'Card').toUpperCase(),y-(standard?29:34),
      {size:standard?37:19,weight:standard?900:700,family:standard?'system-ui':'Arial, sans-serif',
        color:standard?ink:quiet,width:390,spacing:standard?0:2.1});
    heading('typeLabel',type,y,{size:standard?20:35,weight:700,
      family:standard?'system-ui':'Georgia, serif',color:standard?quiet:ink,width:518});
  }

  function nameplatePath(card,rect,appearance,radius=4) {
    const custom=MNC_SHAPES.forCard(card,'plate',state);
    if(custom)return MNC_SHAPES.path(custom,rect);
    const preset=MNC_SHAPES.platePath(card.nameplatePreset,rect);
    if(preset)return preset;
    const path=new Path2D();
    path.roundRect(rect.x,rect.y,rect.w,rect.h,appearance==='pill'?rect.h/2:radius);
    return path;
  }

  function paintNameplate(ctx,card,rect,appearance,{fill,stroke,weight=0,radius=4}) {
    if(appearance==='none')return;
    const layout=effective(card), outline=nameplatePath(card,rect,appearance,radius);
    ctx.save();
    ctx.globalAlpha=layout.plateOpacity??1;
    const gradient=MNC_LAYOUT.get(card,'plate')?.gradient;
    ctx.fillStyle=gradient?MNC_FRONT_EFFECTS.paintGradient(ctx,rect,gradient):layout.plateFill||fill;
    if(appearance!=='outline')ctx.fill(outline,'evenodd');
    const lineWidth=layout.plateStrokeWidth??weight;
    if(lineWidth>0){
      ctx.strokeStyle=layout.plateStroke||stroke;
      ctx.lineWidth=lineWidth;ctx.stroke(outline);
    }
    if(!MNC_SHAPES.forCard(card,'plate',state)&&['scroll','ribbon'].includes(card.nameplatePreset)){
      const scroll=card.nameplatePreset==='scroll';
      ctx.strokeStyle=layout.plateStroke||stroke;
      ctx.lineWidth=Math.max(1,Math.min(2.5,lineWidth));
      ctx.beginPath();
      for(const side of [.09,.91]){
        const x=rect.x+rect.w*(scroll?side:side<.5?.14:.86);
        const y=rect.y+rect.h*(scroll?.17:.24);
        ctx.moveTo(x,y);
        ctx.lineTo(x,rect.y+rect.h*(scroll?.83:.78));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function creditLabel(c) {
    return MNC_CARD_METADATA.creditType(c)==='Actor'?'ACTOR':'ILLUS.';
  }

  function attributionLayout(c,{x=46,y=1007,width}={}) {
    const info=MNC_CARD_METADATA.attribution(c), layout=values(c);
    width=width??layout.creditWidth??265;y-=footerReserve(c);
    const anchor=box(c,'artist',{x,y,w:width,h:0});
    const align=layout.creditAlign||'left', rows=[];
    if(layout.creditMode!=='hidden'){
      const split=layout.creditMode==='stacked'&&c.artistFirst&&c.artistLast;
      if(info.illustration){
        rows.push({id:'artist',name:split?c.artistFirst:info.illustration,label:layout.creditLabel??'ILLUS.'});
        if(split)rows.push({id:'artist',name:c.artistLast,label:''});
      }
      if(info.concept)rows.push({id:'concept',name:info.concept,label:'CONCEPT'});
      if(info.actor){
        const legacy=MNC_CARD_METADATA.creditType(c)==='Actor';
        rows.push({id:legacy&&!layout.text?.actor?'artist':'actor',name:info.actor,
          label:legacy?(layout.creditLabel??'ACTOR'):'ACTOR'});
      }
    }
    if(layout.creditMode==='line'&&rows.length>1){
      const name=rows.map(row=>[row.label,row.name].filter(Boolean).join(' ')).join(' · ');
      rows.splice(0,rows.length,{id:'artist',name,label:''});
    }
    if(info.film)rows.push({id:'film',name:info.film,label:''});
    const episode=[info.episode&&'EP '+info.episode,info.picker&&'PICK '+info.picker].filter(Boolean).join(' · ');
    if(episode)rows.push({id:'episode',name:episode,label:''});

    let baseline=anchor.y, top=anchor.y-20;
    for(const row of [...rows].reverse()){
      const size=style(c,row.id,{size:textFields[row.id][2]}).size;
      row.baseline=baseline;
      top=Math.min(top,baseline-size+textOffset(c,row.id).y);
      baseline-=Math.max(19,size+4);
    }
    return {rows,align,x:anchor.x,top,width,baseline:anchor.y};
  }

  function attributionBox(c,at) {
    const block=attributionLayout(c,at);
    return {x:block.x,y:block.top,w:block.width,h:block.baseline-block.top+10};
  }

  function outlined(ctx,c,id,value,x,y,options,outline) {
    if(outline){
      const s=style(c,id,options), shift=textOffset(c,id);
      ctx.save();
      ctx.font=s.font;ctx.textAlign=s.align||'left';ctx.textBaseline='alphabetic';ctx.lineJoin='round';
      ctx.strokeStyle='#11131b';ctx.lineWidth=3;
      ctx.strokeText(value,x+shift.x,y+shift.y,s.width);
      ctx.restore();
    }
    draw(ctx,c,id,value,x,y,options);
  }

  function drawCredit(ctx,c,{x,y,ink,muted=ink,outline=false}) {
    const block=attributionLayout(c,{x,y});
    const {align,width}=block;
    const alignedX=block.x+(align==='left'?0:align==='center'?width/2:width);
    for(const {id,name,label,baseline} of block.rows){
      const options={size:textFields[id][2],weight:600,family:'system-ui',
        color:id==='film'||id==='episode'?muted:ink,align,width};
      if(id==='artist'&&label&&align==='left'&&effective(c).text?.artLabel){
        const tag={size:13,weight:700,color:muted,width:95};
        const tagStyle=style(c,'artLabel',tag);
        ctx.font=tagStyle.font;
        const indent=Math.min(tag.width,ctx.measureText(label).width)+8;
        outlined(ctx,c,'artLabel',label,alignedX,baseline,tag,outline);
        outlined(ctx,c,id,name,alignedX+indent,baseline,{...options,width:width-indent},outline);
      }else{
        outlined(ctx,c,id,[label,name].filter(Boolean).join(' '),alignedX,baseline,options,outline);
      }
    }
  }

  function typeIconSize(c) {
    const layout=effective(c);
    const legacy=c.family==='Character'?null:layout.text?.[MNC_GAME.isGameCard(c)?'roleGlyph':'rarityGlyph'];
    return layout.typeIcon??Math.min(65,legacy?.size??38);
  }

  function typeIconBox(c) {
    const type=offset(c,'type'), size=typeIconSize(c);
    return box(c,'cornerIcon',{x:697-size+type.x,y:65-size/2+type.y,w:size,h:size});
  }

  async function drawTypeIcon(ctx,c,color) {
    const r=typeIconBox(c);
    if(!r.w)return;
    await MNC_SYMBOLS.drawCard(ctx,c,r.x+r.w/2,r.y+r.h/2,r.w,color);
  }

  function hasAlignedFooter(card,layout=values(card)) {
    return usesSharedFooter(card)||layout.independentFooter?.fixedBoxes===true;
  }

  function alignedFooterBox(layout,id) {
    const centered=layout.footerPosition==='center',right=708,bottom=1002;
    const markSize=layout.setIcon??cornerFooter.markSize;
    const codeSize=layout.text?.edition?.size??cornerFooter.codeSize;
    const numberSize=layout.text?.number?.size??cornerFooter.numberSize;
    const codeBaseline=bottom-(centered?0:numberSize+7);
    if(id==='setIcon'){
      const y=centered?1009-markSize:(codeBaseline-codeSize+bottom+3-markSize)/2;
      return {x:right-markSize,y,w:markSize,h:markSize};
    }
    const textRight=right-(markSize?markSize+10:0), width=144;
    if(id==='footer')return {x:textRight-width,y:codeBaseline-codeSize,w:width,h:codeSize+5};
    return {x:centered?225:textRight-width,y:bottom-numberSize,w:centered?300:width,h:numberSize+5};
  }

  let contrastSampler;
  function footerInk(ctx,rect,fallback) {
    const {a,d,e,f}=ctx.getTransform();
    const {width,height}=ctx.canvas;
    const left=clampNumber(Math.floor(rect.x*a+e),0,width),top=clampNumber(Math.floor(rect.y*d+f),0,height);
    const right=clampNumber(Math.ceil((rect.x+rect.w)*a+e),0,width),bottom=clampNumber(Math.ceil((rect.y+rect.h)*d+f),0,height);
    if(right<=left||bottom<=top)return {ink:fallback};
    try{
      if(!contrastSampler){
        contrastSampler=MNC_FRONT_EFFECTS.canvas(21,9).getContext('2d',{willReadFrequently:true});
        contrastSampler.imageSmoothingEnabled=false;
      }
      const sample=contrastSampler;
      sample.clearRect(0,0,21,9);
      sample.drawImage(ctx.canvas,left,top,right-left,bottom-top,0,0,21,9);
      const pixels=sample.getImageData(0,0,21,9).data;
      let darkest=1,lightest=0,count=0;
      for(let i=0;i<pixels.length;i+=4){
        if(pixels[i+3]<128)continue;
        const level=luminance(pixels[i],pixels[i+1],pixels[i+2]);
        darkest=Math.min(darkest,level);
        lightest=Math.max(lightest,level);
        count++;
      }
      if(!count)return {ink:fallback};
      const white=1.05/(lightest+.05),black=(darkest+.05)/.05;
      const light=white>=black;
      return {ink:light?'#ffffff':'#000000',halo:Math.max(white,black)<4.5?(light?'#000000':'#ffffff'):null};
    }catch{
      // An imported image can prevent reading back canvas pixels.
      contrastSampler=null;
      return {ink:fallback};
    }
  }

  function addAlignedFooter(scene,ctx,c,layout,parts,{ink,glyphColor,outline}) {
    const auto=usesSharedFooter(c)?state.sharedFooter.autoContrast:layout.independentFooter.autoContrast;
    const contrast=(rect,color,override)=>auto&&!override?footerInk(ctx,rect,color):{ink:override||color};
    const mark=collectionMark(c),symbol=alignedFooterBox(layout,'setIcon');
    scene.add('setIcon',symbol,async (paint,rect)=>{
      const colors=contrast(rect,glyphColor,mark.symbol.color);
      MNC_LAYOUT.transform(paint,symbol,rect);
      if(colors.halo){paint.shadowColor=colors.halo;paint.shadowBlur=3;}
      await MNC_SYMBOLS.drawBadge(paint,mark.symbol,symbol.x+symbol.w/2,symbol.y+symbol.h/2,symbol.w,colors.ink,mark.id);
    },{adjustBox:true,empty:!symbol.w||mark.symbol.source==='hidden'});

    const abbrev=[layout.printCollectionCode===false?'':parts.code,layout.printEdition===false?'':parts.edition].filter(Boolean).join(' · ');
    const number=layout.numberFormat==='number'?parts.number.split('/')[0]:
      (layout.numberFormat==='label'&&parts.number?'CARD ':'')+parts.number;
    for(const [id,key,value,options] of [
      ['footer','edition',abbrev,{size:cornerFooter.codeSize,family:'system-ui',align:'right'}],
      ['number','number',number,{size:cornerFooter.numberSize,family:'Georgia, serif',align:layout.footerPosition}]
    ]){
      const base=alignedFooterBox(layout,id);
      const text=style(c,key,{...options,weight:700,color:ink,width:base.w});
      const badge=id==='number'&&layout.numberBadge&&layout.numberBadge!=='none';
      const paintText=(paint,rect,showBadge=true)=>{
        const colors=contrast(rect,ink,layout.text?.[key]?.color);
        MNC_LAYOUT.transform(paint,base,rect);
        if(badge&&showBadge){
          paint.save();paint.fillStyle=paint.strokeStyle=colors.ink;paint.lineWidth=1.5;
          paint.beginPath();paint.roundRect(base.x,base.y,base.w,base.h,Math.min(12,base.h/2));
          if(layout.numberBadge==='pill'){paint.globalAlpha=.12;paint.fill();}else paint.stroke();
          paint.restore();
        }
        const {x:dx,y:dy}=textOffset(c,key);
        const x=base.x+(text.align==='left'?0:text.align==='center'?base.w/2:base.w)+dx;
        const y=base.y+text.size+dy;
        paint.font=text.font;paint.textAlign=text.align;paint.textBaseline='alphabetic';
        const halo=colors.halo||(!auto&&outline?'#11131b':null);
        if(halo){
          paint.lineJoin='round';paint.lineWidth=3;paint.strokeStyle=halo;
          paint.strokeText(value,x,y,text.width);
        }
        paint.fillStyle=colors.ink;paint.fillText(value,x,y,text.width);
      };
      scene.add(id,base,paintText,{adjustBox:true,empty:!value,text:{key,value,size:text.size,color:text.color},
        foilText:badge?(paint,rect)=>paintText(paint,rect,false):true});
    }
  }

  function addCollection(scene,ctx,c,{x=699,y=1007,ink,glyphColor=ink,outline=false}) {
    const collection=collectionFor(c);
    const promo=MNC_CARD_METADATA.isPromo(c,collection);
    const total=promo?state.setPlan.target:Number(state.setTotals?.[c.set])||collection?.regularTarget||
      (game.isGameCard(c)?Math.max(0,...state.cards.filter(card=>card.set===c.set)
        .map(card=>Number(card.collectorNumber)||0)):0);
    const layout=values(c), parts=MNC_CARD_METADATA.collectionParts(promo?{...c,edition:state.setPlan.edition}:c,collection,total);
    if(hasAlignedFooter(c,layout)){
      addAlignedFooter(scene,ctx,c,layout,parts,{ink,glyphColor,outline});
      return;
    }
    const delta=layout.independentFooter?.copiedShared?{x:0,y:0}:offset(c,'footer');
    const centered=layout.footerPosition==='center';
    const independent=!!layout.independentFooter,separateNumber=centered||independent;
    const label=[layout.printCollectionCode===false?'':parts.code,separateNumber?'':parts.number,layout.printEdition===false?'':parts.edition].filter(Boolean).join(' · ');
    const size=layout.setIcon??29,right=(independent?708:x)+delta.x;
    const baseline=independent?1002-(centered?0:layout.independentFooter.numberSpace)+delta.y:y+delta.y-footerReserve(c);
    const mark=collectionMark(c),active=mark.symbol.source!=='hidden';
    const symbol=collectionIconBox(c,{x,y});
    scene.add('setIcon',symbol,ctx=>{
      const mx=symbol.x+size/2,my=symbol.y+size/2;
      return MNC_SYMBOLS.drawBadge(ctx,mark.symbol,mx,my,size,glyphColor,mark.id);
    },
      {empty:!size||!active});
    const gap=size>0&&active?(layout.independentFooter?.markSpace??size+9):0;
    const editionStyle={size:17,weight:700,family:'system-ui',color:ink,align:'right',width:Math.max(40,309-gap)};
    scene.add('footer',MNC_LAYOUT.textBox(ctx,c,'edition',label,right-gap,baseline,editionStyle),
      ctx=>outlined(ctx,c,'edition',label,right-gap,baseline,editionStyle,outline),
      {empty:!label,text:{key:'edition',value:label,size:editionStyle.size,color:ink}});
    if(separateNumber){
      const value=layout.numberFormat==='number'?parts.number.split('/')[0]:
        (layout.numberFormat==='label'?'CARD ':'')+parts.number;
      const r=numberBox(c),textStyle=style(c,'number',{size:36,weight:700,family:'Georgia, serif',color:ink});
      const rightAligned=independent&&!centered;
      const badge=layout.numberBadge&&layout.numberBadge!=='none';
      const paintNumber=(ctx,textOnly)=>{
        if(badge&&!textOnly){
          ctx.save();ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=1.5;
          ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,Math.min(12,r.h/2));
          if(layout.numberBadge==='pill'){ctx.globalAlpha=.12;ctx.fill();}else ctx.stroke();
          ctx.restore();
        }
        outlined(ctx,c,'number',value,rightAligned?r.x+r.w:r.x+r.w/2,r.y+r.h-9,
          {...textStyle,align:rightAligned?'right':'center',width:r.w-20},outline);
      };
      scene.add('number',r,ctx=>paintNumber(ctx,false),{
        empty:!value,text:{key:'number',value,size:36,color:ink},foilText:badge?ctx=>paintNumber(ctx,true):true
      });
    }
  }

  function footerReserve(c) {
    return values(c).footerPosition==='center'?Math.max(44,style(c,'number',{size:36}).size+24):0;
  }

  function numberBox(c) {
    const layout=values(c),centered=layout.footerPosition==='center';
    if(hasAlignedFooter(c,layout))return alignedFooterBox(layout,'number');
    if(!centered&&!layout.independentFooter)return null;
    const size=style(c,'number',{size:36}).size;
    if(!centered){
      const right=708-layout.independentFooter.markSpace;
      const rect={x:right-188,y:1002-size-7,w:188,h:size+16};
      return box(c,'number',rect);
    }
    return box(c,'number',{x:225,y:1004-size-7,w:300,h:size+16});
  }

  function collectionIconBox(c,{x=699,y=1007}={}) {
    const layout=values(c),size=layout.setIcon??29;
    if(hasAlignedFooter(c,layout))return alignedFooterBox(layout,'setIcon');
    const delta=layout.independentFooter?.copiedShared?{x:0,y:0}:offset(c,'footer');
    if(layout.independentFooter)return {x:708-size+delta.x+(layout.setIconX||0),
      y:1009-size+delta.y+(layout.setIconY||0),w:size,h:size};
    return {x:x+delta.x-size+(layout.setIconX||0),y:y+delta.y-footerReserve(c)-size*.75+(layout.setIconY||0),w:size,h:size};
  }

  const tapePath=new Path2D('M3 2h30a3 3 0 0 1 3 3v16a3 3 0 0 1 -3 3H3a3 3 0 0 1 -3 -3V5a3 3 0 0 1 3 -3zM7 7h22v9H7zM7 21l3-3h16l3 3zM10 11.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0 -5 0zM21 11.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0 -5 0zM16 11h4v1h-4z');

  function episodeBadgeBox(c) {
    if (!MNC_CARD_METADATA.hasCassette(c)) return null;
    const size=effective(c).episodeBadgeSize??32, footer=offset(c,'footer');
    return box(c,'episodeBadge',{x:(c.template==='Standard'?320:331)-size/2+footer.x,
      y:984-size*13/36+footer.y-footerReserve(c),w:size,h:size*26/36});
  }

  function drawEpisodeBadge(ctx,c,color) {
    const badge=episodeBadgeBox(c);
    if(!badge)return;
    ctx.save();
    ctx.translate(badge.x,badge.y);
    ctx.scale(badge.w/36,badge.w/36);
    ctx.fillStyle=effective(c).episodeBadgeColor||color;
    ctx.fill(tapePath,'evenodd');
    ctx.restore();
  }

  function wrap(ctx,value,width) {
    const lines=[];
    for(const paragraph of value.split(/\r?\n/)){
      let row='';
      for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
        const candidate=row?row+' '+word:word;
        if(row&&ctx.measureText(candidate).width>width){
          lines.push(row);row=word;
        }else row=candidate;
      }
      lines.push(row);
    }
    return lines;
  }

  return {groups,textFields,settings,editable,effective,offset,box,style,textOffset,draw,paintNameplate,drawCredit,creditLabel,
    addHeader,attributionBox,addCollection,footerReserve,numberBox,collectionIconBox,typeIconBox,drawTypeIcon,
    usesSharedFooter,isSharedFooterLayer,hasAlignedFooter,sharedFooterSettings,setFooterMode,
    episodeBadgeBox,drawEpisodeBadge,wrap,values,hex,mix,tone,surfaceText,emojiFont};
})();
