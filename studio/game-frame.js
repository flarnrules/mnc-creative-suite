'use strict';

(() => {
  const game = window.MNC_GAME;
  const frames = MNC_OUTER_BORDER.classicStyles;
  const surfaces = {
    ink:{base:'#191b18', panel:'#212420', ink:'#f4ecda', quiet:'#b7b3a4'},
    paper:{base:'#e8deca', panel:'#f2e7d2', ink:'#27271f', quiet:'#595647'},
    midnight:{base:'#152027', panel:'#1a2a31', ink:'#f6eddd', quiet:'#b8c3c4'},
    slate:{base:'#56626c', panel:'#626e76', ink:'#fff8eb', quiet:'#e0e5e5'}
  };

  const tint=front.mix;

  function palette(c) {
    const finish=surfaces[c.surface]||surfaces.ink;
    const type=game.visualFor(c,state.typeOverrides);
    const roleColor=c.family==='Critic'?'#8f788d':c.family==='Item'?'#a6835d':'#81875f';
    const accent=c.useTypeColor!==false?type?.color||roleColor:front.hex(c.accent)?c.accent:roleColor;
    const sourceBase=front.hex(c.mainColor)?c.mainColor:finish.base;
    const base=front.tone(sourceBase,c.backgroundLightness);
    const custom=base!==finish.base;
    const {ink,quiet}=custom?front.surfaceText(base):finish;
    const panel=custom?tint(base,ink,.07):finish.panel;
    const edge=front.hex(c.frameColor)?c.frameColor:'#b8a788';
    const outer=front.hex(c.borderColor)?c.borderColor:tint(accent,edge,.36);
    return {base,sourceBase,panel,ink,quiet,accent,outer,trim:tint(accent,ink,.45),
      line:tint(base,c.borderColor&&front.hex(c.borderColor)?outer:edge,.40)};
  }
  window.MNC_gamePalette=palette;

  function artBox(c) {
    const full=c.template==='Game Full Art';
    const inset=full ? 0 : clamp(Number(c.artInset??6),4.4,16)*CW/100;
    const height=clamp(Number(c.artHeight??52),37,61)*CH/100;
    return front.box(c,'art',MNC_ARTWORK.rect(c,{x:inset,y:full?0:111,w:CW-2*inset,h:height+(full?111:0)}));
  }

  function artworkPath(c,rect) {
    const full=c.template==='Game Full Art';
    const custom=!full&&shapes.forCard(c,'art',state);
    return custom ? shapes.path(custom,rect) : framePath(new Path2D(),rect,full?'square':c.artShape||'marquee',Number(c.artRadius??31));
  }

  function framePath(ctx, rect, shape, radius) {
    if (shape!=='marquee') {
      window.MNC_drawArtPath(ctx,rect,shape,radius);
      return ctx;
    }
    const {x,y,w,h} = rect;
    const cap = Math.min(w*.22, h*.27, Math.max(20,radius)*2);
    ctx.moveTo(x,y+h-9);
    ctx.lineTo(x,y+cap);
    ctx.bezierCurveTo(x,y+cap*.25,x+w*.25,y,x+w/2,y);
    ctx.bezierCurveTo(x+w*.75,y,x+w,y+cap*.25,x+w,y+cap);
    ctx.lineTo(x+w,y+h-9);
    ctx.quadraticCurveTo(x+w,y+h,x+w-9,y+h);
    ctx.lineTo(x+9,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-9);
    ctx.closePath();
    return ctx;
  }

  function drawText(ctx, value, x, y, {font,color,align='left',width,spacing=0}) {
    ctx.textAlign=align;
    ctx.textBaseline='alphabetic';
    ctx.font=font;
    ctx.fillStyle=color;
    const previousSpacing=ctx.letterSpacing;
    if ('letterSpacing' in ctx) ctx.letterSpacing=spacing+'px';
    if (width) ctx.fillText(String(value),x,y,width);
    else ctx.fillText(String(value),x,y);
    if ('letterSpacing' in ctx) ctx.letterSpacing=previousSpacing;
  }

  function line(ctx, x0,y0,x1,y1,color,width=1) {
    ctx.beginPath();
    ctx.moveTo(x0,y0);
    ctx.lineTo(x1,y1);
    ctx.strokeStyle=color;
    ctx.lineWidth=width;
    ctx.stroke();
  }

  function emblem(ctx, icon, x, y, size, color) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(size/24,size/24);
    ctx.fillStyle=color;
    ctx.strokeStyle=color;
    ctx.lineWidth=1.6;
    ctx.lineCap='round';
    ctx.lineJoin='round';
    ctx.beginPath();
    if (icon==='win') {
      for (let i=0; i<10; i++) {
        const a = -Math.PI/2+i*Math.PI/5, radius=i%2===0 ? 10 : 4.7;
        ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(-8,5);ctx.lineTo(8,10);
      ctx.moveTo(8,5);ctx.lineTo(-8,10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4,3);ctx.bezierCurveTo(-13,-7,-1,-13,5,-8);
      ctx.bezierCurveTo(10,-5,8,1,4,3);
      ctx.lineTo(4,6);ctx.lineTo(-4,6);
      ctx.closePath();
      ctx.stroke();
      for (const side of [-1,1]) {
        ctx.beginPath();ctx.arc(side*3,-3,1.45,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }

  function ruleLayout(ctx,c,start,paper,{width=656,x=47,footerTop=front.attributionBox(c).y-8}={}) {
    const active=c.showPower!==false;
    const ruleTitle=active?(c.ruleTitle||'').trim():'',rule=active?(c.ruleText||c.effectText||'').trim():'';
    const timing=c.showTiming===false||!rule?'':game.timingLabel(c.timing)||'';
    const shared=game.categoryRule(c,state.cards,state),quote=c.showQuote===false?'':(c.quote||c.lore||'').trim();
    const options=front.effective(c);
    const header=Math.max(ruleTitle?front.style(c,'ruleTitle',{size:23}).size:0,timing?front.style(c,'timing',{size:14}).size:0);
    const headerHeight=header?Math.max(33,header+10):0;
    let result;
    for(let reduction=0;reduction<=7;reduction++){
      const measure=(id,text,size,extra={})=>{
        const fixed=Number.isFinite(options.text?.[id]?.size);
        const style=front.style(c,id,{size:fixed?size:Math.max(16,size-reduction),color:paper.ink,width,...extra});
        ctx.font=style.font;
        const rows=text?front.wrap(ctx,text,width):[],leading=Math.ceil(style.size*1.22);
        return {style,rows,leading,height:rows.length*leading};
      };
      const type=measure('typeRule',shared,20,{color:paper.quiet});
      const power=measure('rule',rule,23);
      const quoteStyle=front.style(c,'quote',{size:19,weight:400,italic:true,family:'Georgia, serif',color:paper.quiet,width});
      ctx.font=quoteStyle.font;
      const quoteRows=quote?front.wrap(ctx,quote,width):[],quoteLeading=Math.ceil(quoteStyle.size*1.2);
      let cursor=start;
      const place=(id,height)=>{
        const group=front.offset(c,id),text=front.textOffset(c,id);
        return {x:x+group.x+text.x,y:cursor+group.y+text.y,w:width,h:height};
      };
      const typeRuleBox=place('typeRule',type.height);
      if(type.height)cursor+=type.height+10;
      const ruleBox=place('rule',headerHeight+power.height);
      if(ruleBox.h)cursor+=ruleBox.h+10;
      const quoteBox=place('quote',quoteRows.length*quoteLeading);
      const boxes=[typeRuleBox,ruleBox,quoteBox].filter(box=>box.h);
      const overlap=boxes.some((first,i)=>boxes.slice(i+1).some(second=>
        first.x<second.x+second.w&&second.x<first.x+first.w&&first.y<second.y+second.h&&second.y<first.y+first.h));
      const overflow=overlap||boxes.some(box=>box.y<12||box.y+box.h>footerTop);
      result={ruleTitle,timing,header,headerHeight,ruleStyle:power.style,rows:power.rows,leading:power.leading,
        ruleBox,ruleX:ruleBox.x,ruleY:ruleBox.y,quoteBox,quoteRows,quoteStyle,quoteLeading,
        typeRuleBox,typeRuleRows:type.rows,typeRuleStyle:type.style,typeRuleLeading:type.leading,overflow};
      if(!overflow)break;
    }
    return result;
  }

  function addRules(scene,ctx,c,layout,paper,{shadow=false}={}) {
    const {ruleTitle,timing,header,headerHeight,ruleStyle,rows,leading,ruleBox,quoteBox,quoteRows,quoteStyle,quoteLeading,
      typeRuleBox,typeRuleRows,typeRuleStyle,typeRuleLeading}=layout;
    const block=(id,lines,box,style,step)=>{
      const x=box.x+(style.align==='center'?box.w/2:style.align==='right'?box.w:0);
      scene.add(id,MNC_LAYOUT.contentBox(ctx,box,lines,style),ctx=>{
        if(shadow){ctx.shadowColor='#111';ctx.shadowBlur=5;}
        lines.forEach((row,i)=>drawText(ctx,row,x,box.y+style.size+i*step,style));
      },{empty:!lines.length,text:{key:id,value:lines.join('\n'),size:style.size,color:style.color}});
    };
    block('typeRule',typeRuleRows,typeRuleBox,typeRuleStyle,typeRuleLeading);
    MNC_LAYOUT.textLayer(scene,ctx,c,'ruleTitle',ruleTitle,ruleBox.x,ruleBox.y+(header>23?header*.9:20),
      {size:23,weight:700,family:'Georgia, serif',color:paper.ink,width:timing?ruleBox.w*.62:ruleBox.w});
    MNC_LAYOUT.textLayer(scene,ctx,c,'timing',timing.toUpperCase(),ruleTitle?ruleBox.x+ruleBox.w:ruleBox.x,ruleBox.y+(header>23?header*.9:19),
      {size:14,weight:600,color:paper.quiet,align:ruleTitle?'right':'left',spacing:.9,width:ruleTitle?ruleBox.w*.35:ruleBox.w});
    block('rule',rows,{...ruleBox,y:ruleBox.y+headerHeight,h:ruleBox.h-headerHeight},ruleStyle,leading);
    block('quote',quoteRows,quoteBox,quoteStyle,quoteLeading);
  }
  window.MNC_contentLayout=ruleLayout;
  window.MNC_addContentLayers=addRules;

  async function badge(ctx,type,x,y,radius) {
    if(!radius)return;
    const symbol=MNC_SYMBOLS.profileSymbol(state,type.id);
    if(symbol.backdrop==='circle'){
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.fillStyle=tint(type.color,'#f6ecd5',.35);ctx.fill();
    }
    await MNC_SYMBOLS.draw(ctx,symbol,x,y,radius*1.7,tint(type.color,'#f6ecd5',.65),type.id);
  }

  async function drawMatchup(ctx,heading,icon,x,y,width,types,paper,c,textOnly) {
    const options=front.effective(c),icons=options.matchIcons??c.showIcons!==false,names=options.matchNames??c.showMatchupNames!==false;
    const layout=front.effective(c), iconSize=layout.matchIcon??34;
    const valueStyle=front.style(c,'matchValue',{size:23,weight:700,color:paper.ink});
    const headingSize=layout.text?.matchLabel?.size??15;
    const emblemSize=Math.min(34,headingSize*22/15);
    const labels=layout.matchLabels!==false;
    if(icons&&labels&&!textOnly)emblem(ctx,icon,x+emblemSize/2,y-headingSize*.46,emblemSize,paper.trim);
    if(labels)front.draw(ctx,c,'matchLabel',heading,x+(icons?emblemSize+3:0),y,{size:15,weight:700,color:paper.quiet,spacing:1.3,width:width-(icons?emblemSize+3:0)});
    const rowHeight=matchupRowHeight(c);
    const centerY=y+(labels?9:0)+rowHeight/2;
    if(!types.length){
      front.draw(ctx,c,'matchValue',c.characterCategory?'—':'Open',x+2,centerY+valueStyle.size*.3,
        {size:19,color:paper.quiet,width:width-4});
      return;
    }
    const gap=types.length>1?8:0, cellWidth=(width-gap*(types.length-1))/types.length;
    for (const [index,type] of types.entries()) {
      await drawMatchupType(ctx,type,x+index*(cellWidth+gap),y,cellWidth,centerY,rowHeight,valueStyle,paper,c,icons,names,textOnly);
    }
  }

  async function drawMatchupType(ctx,type,x,y,width,centerY,rowHeight,valueStyle,paper,c,icons,names,textOnly) {
    const layout=front.effective(c), iconSize=layout.matchIcon??34;
    const style=layout.matchStyle||'tint';
    const inset=style==='none'?0:7;
    const showBadge=icons&&iconSize>0;
    if(style!=='none'&&!textOnly){
      ctx.save();
      ctx.globalAlpha=layout.matchOpacity??1;
      ctx.fillStyle=style==='solid'?(layout.matchColor||'#30382f'):tint(paper.panel,type.color,.27);
      ctx.strokeStyle=layout.matchColor||paper.line;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.roundRect(x,centerY-rowHeight/2,width,rowHeight,10);
      if(style==='outline')ctx.stroke();
      else ctx.fill();
      ctx.restore();
    }
    if(showBadge&&!textOnly)await badge(ctx,type,x+inset+iconSize/2+(layout.matchIconX||0),centerY+(layout.matchIconY||0),iconSize/2);
    const textInset=showBadge?inset+iconSize+9:inset+(style==='none'?0:6);
    const delta=front.textOffset(c,'matchValue');
    if(names||!showBadge)drawText(ctx,type.name,x+textInset+delta.x,centerY+valueStyle.size*(8/23)+delta.y,
      {...valueStyle,width:Math.max(12,width-textInset-12)});
  }

  function addFooter(scene,ctx,c,paper) {
    const footer=front.offset(c,'footer');
    const y=Math.min(956+footer.y,front.attributionBox(c).y-7);
    scene.add('footerLine',{x:43,y:y-3,w:664,h:6},ctx=>line(ctx,43,y,707,y,paper.line,1.5),
      {empty:front.values(c).footerRule===false});
    MNC_LAYOUT.addCredits(scene,c,{ink:paper.ink,muted:paper.quiet});
    front.addCollection(scene,ctx,c,{ink:paper.ink,glyphColor:paper.trim});
    MNC_LAYOUT.addEpisodeBadge(scene,c,paper.trim);
  }

  window.MNC_artBox=artBox;
  window.MNC_gameArtworkPath=(c,r=artBox(c))=>artworkPath(c,r);
  window.MNC_gameFrameStyles=frames;
  window.MNC_gameRuleFits=function(c) {
    const ctx=document.createElement('canvas').getContext('2d');
    return !ruleLayout(ctx,c,ruleStart(c),surfaces.ink).overflow;
  };

  function flowEnd(c) {
    if(c.artworkProfile==='full')return 625+MNC_LAYOUT.artFlow(c);
    const rect=artBox(c);
    return rect.y+rect.h-front.offset(c,'art').y+MNC_LAYOUT.artFlow(c);
  }

  function ruleStart(c) {
    if(Number.isFinite(c.layoutDesign?.contentTop))return c.layoutDesign.contentTop+MNC_LAYOUT.artFlow(c);
    if(c.family==='Character'){const match=matchupBox(c);return match.y+match.h+12;}
    return flowEnd(c)+90+plateGrowth(c);
  }

  function plateBox(c) {
    const {plateWidth:w,plateHeight:h}=front.values(c);
    return front.box(c,'title',{x:(CW-w)/2,y:flowEnd(c)+12,w,h});
  }

  function matchupRowHeight(c) {
    const layout=front.effective(c),icons=layout.matchIcons??c.showIcons!==false;
    return Math.max(32,(layout.text?.matchValue?.size??23)+12,icons?(layout.matchIcon??34)+10:0);
  }

  function plateGrowth(c) {
    return Math.max(0,front.values(c).plateHeight-62);
  }

  function matchupBaseline(c) {
    return flowEnd(c)+101+plateGrowth(c)+Math.max(0,(front.effective(c).text?.matchLabel?.size??15)-21);
  }

  function matchupBox(c) {
    const layout=front.effective(c),row=matchupRowHeight(c),labels=layout.matchLabels!==false;
    const height=row+(labels?9:0)+(layout.matchLayout==='stacked'?row+(labels?Math.max(20,layout.text?.matchLabel?.size??15)+9:0)+(layout.matchGap??19):0);
    return front.box(c,'match',{x:47,y:matchupBaseline(c),w:656,h:height});
  }

  window.MNC_frontBoxes=(c,ctx)=>{
    const rule=ruleLayout(ctx,c,ruleStart(c),surfaces.ink);
    const typeHeight=Math.max(64,(front.effective(c).text?.typeLabel?.size??35)+32);
    const matchHeight=matchupRowHeight(c);
    return {
      art:artBox(c),
      type:front.box(c,'type',{x:43,y:42,w:521,h:typeHeight}),
      cornerIcon:front.typeIconBox(c),
      title:plateBox(c),
      match:c.family==='Character'?{...matchupBox(c),y:matchupBox(c).y-18,h:matchupBox(c).h+18}:null,
      typeRule:rule.typeRuleRows.length?rule.typeRuleBox:null,
      rule:rule.header||rule.rows.length?rule.ruleBox:null, quote:rule.quoteRows.length?rule.quoteBox:null,
      artist:front.attributionBox(c),
      footer:front.box(c,'footer',{x:342,y:956-front.footerReserve(c),w:361,h:63}),
      number:front.numberBox(c),
      episodeBadge:front.episodeBadgeBox(c)
    };
  }

  window.MNC_addGameLayers=function(scene,ctx,c,{foil,recipe}={}) {
    const chart=game.typeChart(state.typeOverrides);
    const paper=palette(c), accent=paper.accent;
    const full=c.template==='Game Full Art';
    const layout=MNC_LAYOUT;
    scene.add('background',layout.full(),ctx=>layout.background(ctx,c,()=>layout.linear(ctx,[
      [0,tint(paper.base,accent,.30)],[.65,paper.base],[1,tint(paper.base,accent,.10)]
    ])));
    scene.add('art',artBox(c),async (ctx,rect)=>{
      const outline=artworkPath(c,rect);
      const image=MNC_ARTWORK.image(c,await imgLoad(assetURI(artById(c.sourceAssetId))));
      ctx.save();
      ctx.clip(outline,'evenodd');
      ctx.fillStyle=tint(paper.base,accent,.21);
      ctx.fillRect(rect.x,rect.y,rect.w,rect.h);
      if(image)fitImage(ctx,image,rect,c.fit||'cover',Number(c.zoom)||1,Number(c.panX)||0,Number(c.panY)||0);
      ctx.restore();

      const border=full?'none':c.artBorder||'solid';
      if(border==='none')return;
      ctx.strokeStyle=paper.trim;
      ctx.lineWidth=border==='double'?4:2;
      if(border==='dashed')ctx.setLineDash([11,8]);
      ctx.stroke(outline);
      if(border==='double'){
        const inner=artworkPath(c,{x:rect.x+6,y:rect.y+6,w:Math.max(1,rect.w-12),h:Math.max(1,rect.h-12)});
        ctx.strokeStyle=paper.line;ctx.lineWidth=1.5;ctx.stroke(inner);
      }
    },{adjustBox:true});
    MNC_ART_CUTOUT.addLayer(scene,c);
    layout.addOverlay(scene,c);
    if(foil)addFoilLayer(scene,c,recipe);

    if(full){
      const typeOffset=front.offset(c,'type');
      scene.add('shade',layout.full(),ctx=>{
        drawGradientBand(ctx,0,Math.max(0,typeOffset.y),CW,161,true);
        if(c.artworkProfile==='full')drawGradientBand(ctx,0,600,CW,450);
      },{hit:'none'});
    }
    MNC_OUTER_BORDER.addLayer(scene,c);
    front.addHeader(scene,ctx,c,{ink:paper.ink,quiet:paper.quiet});
    layout.addIcon(scene,c,paper.ink);

    const plate=c.nameplate||'solid', nameBox=plateBox(c), options=front.effective(c);
    scene.add('plate',nameBox,ctx=>front.paintNameplate(ctx,c,nameBox,plate,{
      fill:tint(paper.panel,accent,plate==='banner'?.30:.13),stroke:paper.line,weight:1
    }),{empty:plate==='none'});
    layout.addTitle(scene,ctx,c,nameBox,{size:54,min:27,weight:700,family:'Georgia, serif',color:paper.ink,inset:49,baseline:16/54});
    if(c.family==='Character'){
      const match=matchupBox(c);
      const box={...match,y:match.y-18,h:match.h+18};
      const paintMatchups=async (ctx,textOnly)=>{
        const {wins,losses}=game.matchups(c.characterCategory,chart);
        const [defaultWin,defaultLoss]=game.matchupHeading(c.characterCategory);
        const entries=[{heading:options.winLabel??defaultWin,icon:'win',types:wins},
          {heading:options.lossLabel??defaultLoss,icon:'loss',types:losses}];
        if(options.matchOrder==='losses-first')entries.reverse();
        const gap=options.matchGap??19,stacked=options.matchLayout==='stacked';
        const width=stacked?match.w:(match.w-gap)/2;
        const step=matchupRowHeight(c)+(options.matchLabels!==false?Math.max(20,options.text?.matchLabel?.size??15)+9:0)+gap;
        for(const [index,entry] of entries.entries())await drawMatchup(ctx,entry.heading,entry.icon,
          match.x+(stacked?0:index*(width+gap)),match.y+(stacked?index*step:0),width,entry.types,paper,c,textOnly);
      };
      scene.add('match',box,ctx=>paintMatchups(ctx,false),{foilText:ctx=>paintMatchups(ctx,true)});
    }
    addRules(scene,ctx,c,ruleLayout(ctx,c,ruleStart(c),paper),paper);
    addFooter(scene,ctx,c,paper);
  };

})();
