'use strict';

globalThis.MNC_BACKS = (() => {
  const logoFilename='movie_night_club_logo_july_2023_square.png';
  const blends=['source-over','multiply','screen','overlay','soft-light'];
  const defaults={
    background:'#171a22',backgroundTo:'#293348',fill:'solid',angle:45,gradientMidpoint:'',
    pattern:'none',patternColor:'#dbc69c',patternOpacity:.12,patternSpacing:34,patternAngle:0,
    border:'none',borderColor:'#d9b77c',borderInner:'#9d9d8e',borderInset:27,borderWidth:12,borderRadius:30
  };
  const layerDefaults={
    name:'',text:'',assetId:'',visible:true,repeat:false,blend:'source-over',
    x:50,y:50,w:48,h:34,rotation:0,opacity:1,
    color:'#f0dfba',size:45,font:'serif',align:'center',bold:true,italic:false,
    shape:'rectangle',filled:true,outline:0,outlineColor:'#e6ca96',radius:28,
    fit:'contain',zoom:1,panX:0,panY:0,flipX:false,flipY:false
  };
  const layerKinds={image:'Image',text:'Text',shape:'Shape'};
  const colors=['background','backgroundTo','patternColor','borderColor','borderInner'];
  const limits={
    angle:[0,360],patternOpacity:[0,1],patternSpacing:[12,125],patternAngle:[0,360],
    borderInset:[8,165],borderWidth:[1,40],borderRadius:[0,125]
  };
  const layerLimits={
    x:[-50,150],y:[-50,150],w:[1,200],h:[1,200],rotation:[-180,180],opacity:[0,1],
    size:[8,230],outline:[0,40],radius:[0,125],zoom:[1,4],panX:[-1,1],panY:[-1,1]
  };
  const validId=id=>typeof id==='string'&&id.length>0&&id.length<=100;
  const bounded=(value,fallback,[min,max])=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  const pick=(value,options,fallback)=>options.includes(value)?value:fallback;
  const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
  const string=(value,limit)=>typeof value==='string'?value.slice(0,limit):'';
  const name=design=>design?.name.trim()||'Untitled back';
  const layerName=layer=>layer.name.trim()||layerKinds[layer.kind];
  const byId=(project,id)=>project.backDesigns?.find(back=>back.id===id);
  const active=project=>byId(project,project.activeBackDesignId);

  function newLayer(kind,id) {
    const layer={...layerDefaults,id,kind};
    if(kind==='text')Object.assign(layer,{text:'Your text',w:74,h:12});
    if(kind==='shape')Object.assign(layer,{w:43,h:22});
    return layer;
  }

  function newDesign(preset,id,assets=[],uploadedId='') {
    const design={...defaults,id,name:'Blank back',layers:[]};
    if(preset==='blank')return design;
    Object.assign(design,{
      name:preset==='uploaded'?'Uploaded back':'MNC logo back',
      fill:'gradient',background:'#202f43',backgroundTo:'#151727',angle:Math.atan2(1050,750)*180/Math.PI,
      gradientMidpoint:'#1c2134',
      pattern:'rings',patternColor:'#c9b27f',patternOpacity:.08,patternSpacing:26,
      border:'double',borderRadius:0
    });
    if(preset==='uploaded'){
      design.layers.push({...newLayer('image','L-001'),name:'Uploaded artwork',assetId:uploadedId,w:86.7,h:90.5,fit:'cover'});
      return design;
    }
    const logo=assets.find(asset=>asset.originalFilename===logoFilename);
    if(logo){
      design.layers.push(
        {...newLayer('shape','L-001'),name:'Logo plate',color:'#f7f5ec',y:46.86,w:54.67,h:39.05},
        {...newLayer('image','L-002'),name:'MNC logo',assetId:logo.id,y:46.86,w:52,h:37.14}
      );
    }
    design.layers.push(
      {...newLayer('text','L-003'),name:'Club name',text:'MOVIE NIGHT CLUB',font:'system',size:33,y:73.6,h:7,color:'#efd39a'},
      {...newLayer('text','L-004'),name:'Tagline',text:'COLLECT · PLAY · ARCHIVE',font:'system',size:18,y:77.7,h:5,color:'#efd39a'}
    );
    return design;
  }

  function normalizeLayer(value) {
    const layer=newLayer(value.kind,value.id);
    for(const [key,bounds] of Object.entries(layerLimits))layer[key]=bounded(value[key],layer[key],bounds);
    for(const key of ['name','assetId','text'])layer[key]=string(value[key],key==='text'?1000:160);
    for(const key of ['visible','repeat','bold','italic','filled','flipX','flipY']){
      if(typeof value[key]==='boolean')layer[key]=value[key];
    }
    for(const key of ['color','outlineColor'])layer[key]=color(value[key],layer[key]);
    layer.font=pick(value.font,['system','sans','serif','mono'],layer.font);
    layer.align=pick(value.align,['left','center','right'],layer.align);
    layer.shape=pick(value.shape,['rectangle','rounded','ellipse','diamond'],layer.shape);
    layer.fit=pick(value.fit,['contain','cover','stretch'],layer.fit);
    layer.blend=pick(value.blend,blends,layer.blend);
    return layer;
  }

  function normalizeDesign(value) {
    const design={...defaults,id:value.id,name:string(value.name,90),layers:[]};
    for(const [key,bounds] of Object.entries(limits))design[key]=bounded(value[key],design[key],bounds);
    for(const key of colors)design[key]=color(value[key],design[key]);
    design.gradientMidpoint=color(value.gradientMidpoint,'');
    design.fill=pick(value.fill,['solid','gradient'],design.fill);
    design.pattern=pick(value.pattern,['none','rings','diagonal','lattice','dots','film'],design.pattern);
    design.border=pick(value.border,['none','single','double'],design.border);
    const ids=new Set();
    for(const layer of Array.isArray(value.layers)?value.layers:[]){
      if(!validId(layer?.id)||ids.has(layer.id)||!Object.hasOwn(layerKinds,layer.kind))continue;
      ids.add(layer.id);
      design.layers.push(normalizeLayer(layer));
    }
    return design;
  }

  function restore(project) {
    const designs=[],ids=new Set();
    for(const value of Array.isArray(project.backDesigns)?project.backDesigns:[]){
      if(!validId(value?.id)||ids.has(value.id))continue;
      ids.add(value.id);
      designs.push(normalizeDesign(value));
    }
    project.backDesigns=designs;
    project.activeBackDesignId=active(project)?.id||'';
    project.backEditingId=byId(project,project.backEditingId)?.id||project.activeBackDesignId||designs[0]?.id||'';
    if(!['mnc','custom','calibration','designed'].includes(project.backMode)||
      (project.backMode==='designed'&&!project.activeBackDesignId))project.backMode='mnc';
  }

  return {newDesign,newLayer,restore,name,layerName,layerKinds,byId,active};
})();
