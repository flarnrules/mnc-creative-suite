'use strict';

(() => {
  const backs=window.MNC_BACKS,preview=$('backPreview'),panel=$('backWorkspace');
  const projectFields=panel.querySelectorAll('[data-back-field]');
  const layerFields=panel.querySelectorAll('[data-back-layer]');
  const assetSelect=$('backLayerAsset');
  const status=$('backStatus');
  const undoStack=[],redoStack=[];
  let projectRef,selectedId='',drag=null,frame=0,updateFrame=0,turned=false;

  const editDesign=()=>backs.byId(state,state.backEditingId);
  const editLayer=()=>editDesign()?.layers.find(layer=>layer.id===selectedId);
  const prettyValue=el=>el.type==='checkbox'?el.checked:
    ['range','number'].includes(el.type)?el.valueAsNumber:el.value;

  function putControl(el,value) {
    if(el.type==='checkbox')el.checked=!!value;
    else el.value=value??'';
  }

  function snapshot() {
    const {backDesigns,backEditingId,activeBackDesignId,backMode}=state;
    return deep({backDesigns,backEditingId,activeBackDesignId,backMode,selectedId});
  }

  function setHistoryButtons() {
    $('backUndo').disabled=!undoStack.length;
    $('backRedo').disabled=!redoStack.length;
  }

  function remember() {
    undoStack.push(snapshot());
    if(undoStack.length>60)undoStack.shift();
    redoStack.length=0;
    setHistoryButtons();
  }

  function restoreHistory(source,target) {
    if(!source.length)return;
    target.push(snapshot());
    const {selectedId:id,...properties}=source.pop();
    Object.assign(state,properties);
    selectedId=id;
    changed();
  }

  function editableInputs(fields,read,key) {
    for(const el of fields){
      const valueKey=el.dataset[key];
      el.addEventListener('input',()=>{
        const object=read();
        if(!object)return;
        const value=prettyValue(el);
        if(Number.isNaN(value)||value===object[valueKey])return;
        const continuous=['range','number','color','text','textarea'].includes(el.type);
        if(!continuous||el.dataset.backChanging!=='true'){
          remember();
          if(continuous)el.dataset.backChanging='true';
        }
        object[valueKey]=typeof value==='number'?
          clamp(value,el.min===''?-Infinity:Number(el.min),el.max===''?Infinity:Number(el.max)):value;
        if(object===editDesign()&&['background','backgroundTo'].includes(valueKey))object.gradientMidpoint='';
        persist();
        if(valueKey==='name'){
          if(object===editDesign())updateDesignOptions();
          else renderLayers();
          updateActiveStatus();
        }else if(['visible','repeat'].includes(valueKey))renderLayers();
        updateControlsVisibility();
        queueRender();
      });
      for(const type of ['change','blur'])el.addEventListener(type,()=>{
        delete el.dataset.backChanging;
        const object=read();
        if(object&&el.type==='number')putControl(el,object[valueKey]);
      });
    }
  }

  function activeMessage() {
    const active=backs.active(state);
    if(state.backMode==='designed'&&active)return 'Shared back in use · '+backs.name(active);
    if(state.backMode==='calibration')return 'Print mode · Calibration numbers';
    if(state.backMode==='custom'&&state.customBack)return 'Shared back in use · Uploaded image';
    return 'Shared back in use · Original MNC logo';
  }

  function updateActiveStatus() {
    $('backActiveStatus').textContent=activeMessage();
    const current=editDesign();
    $('backUse').disabled=!current||state.backMode==='designed'&&state.activeBackDesignId===current.id;
  }

  function updateDesignOptions() {
    const choices=state.backDesigns.map(back=>[back.id,backs.name(back)]);
    dropDownOptions($('backSelect'),choices,editDesign()?.id||'');
  }

  function updateControlsVisibility() {
    const design=editDesign();
    if(!design)return;
    $('backGradientFields').hidden=design.fill!=='gradient';
    $('backPatternFields').hidden=design.pattern==='none';
    $('backBorderFields').hidden=design.border==='none';
    $('backInnerColor').hidden=design.border!=='double';
    const layer=editLayer();
    for(const section of panel.querySelectorAll('[data-back-kind]'))section.hidden=layer?.kind!==section.dataset.backKind;
    $('backLayerOutline').hidden=layer?.kind==='image';
    $('backShapeRadiusField').hidden=layer?.shape!=='rounded';
    $('backImageNotice').textContent=layer?.kind==='image'&&layer.assetId&&!window.MNC_backImageSource(layer,state)?
      'Image is unavailable. Choose a source or refresh project artwork.':'';
  }

  function renderLayers() {
    const design=editDesign(),layers=design?.layers??[];
    const list=$('backLayerList');
    list.replaceChildren();
    for(const layer of layers.slice().reverse()){
      const row=document.createElement('div');
      row.className='back-layer-row';
      const select=document.createElement('button');
      select.type='button';
      select.className='back-layer-select';
      select.setAttribute('aria-pressed',String(layer.id===selectedId));
      const title=document.createElement('strong');
      title.textContent=backs.layerName(layer);
      const details=document.createElement('span');
      details.textContent=[backs.layerKinds[layer.kind],layer.repeat?'180° pair':'',layer.visible?'':'Hidden'].filter(Boolean).join(' · ');
      select.append(title,details);
      select.onclick=()=>selectLayer(layer.id);
      const visibility=document.createElement('button');
      visibility.type='button';
      visibility.textContent=layer.visible?'Hide':'Show';
      visibility.setAttribute('aria-label',(layer.visible?'Hide ':'Show ')+backs.layerName(layer));
      visibility.onclick=()=>{
        remember();
        layer.visible=!layer.visible;
        changed();
      };
      row.append(select,visibility);
      list.append(row);
    }
    $('backEmptyLayers').hidden=!!layers.length;
    const index=layers.findIndex(layer=>layer.id===selectedId);
    $('backRaise').disabled=index<0||index===layers.length-1;
    $('backLower').disabled=index<1;
    $('backDuplicateLayer').disabled=$('backDeleteLayer').disabled=index<0;
  }

  function syncLayerControls() {
    const layer=editLayer();
    $('backLayerEditor').hidden=!layer;
    if(!layer)return;
    const choices=[['','Choose an image'],...state.assets.map(asset=>[asset.id,asset.title||asset.originalFilename])];
    if(layer.assetId&&!choices.some(([id])=>id===layer.assetId))choices.push([layer.assetId,'Missing image']);
    dropDownOptions(assetSelect,choices,layer.assetId);
    for(const el of layerFields)putControl(el,layer[el.dataset.backLayer]);
    updateControlsVisibility();
  }

  function selectLayer(id) {
    selectedId=id;
    renderLayers();
    syncLayerControls();
    queueRender();
  }

  function sync() {
    if(projectRef!==state){
      projectRef=state;
      undoStack.length=redoStack.length=0;
      selectedId='';
    }
    setHistoryButtons();
    const design=editDesign();
    $('backHasDesign').hidden=!design;
    $('backEmptyState').hidden=!!design;
    $('backDuplicate').disabled=$('backDelete').disabled=$('backExportPNG').disabled=$('backPreviewPrint').disabled=!design;
    updateDesignOptions();
    updateActiveStatus();
    $('backStartUpload').hidden=!state.customBack;
    if(design)for(const el of projectFields)putControl(el,design[el.dataset.backField]);
    renderLayers();
    syncLayerControls();
    updateControlsVisibility();
    queueRender();
  }

  function changed() {
    persist();
    sync();
  }

  function uniqueName(base) {
    const used=new Set(state.backDesigns.map(back=>back.name.toLowerCase()));
    let name=base,index=2;
    while(used.has(name.toLowerCase()))name=base.slice(0,82)+' '+index++;
    return name;
  }

  function uploadedArtwork() {
    const existing=state.assets.find(asset=>asset.dataURI===state.customBack);
    if(existing)return existing.id;
    const id=uniqueId('ART-',state.assets);
    state.assets.push({id,title:'Uploaded back artwork',kind:'Imported artwork',
      source:'Print Sheets',dataURI:state.customBack});
    return id;
  }

  function createDesign(preset) {
    remember();
    const design=backs.newDesign(preset,uniqueId('BACK-',state.backDesigns),state.assets,
      preset==='uploaded'?uploadedArtwork():'');
    design.name=uniqueName(design.name);
    state.backDesigns.push(design);
    state.backEditingId=design.id;
    selectedId='';
    status.textContent='Draft ready to edit.';
    changed();
    $('backName').focus();
  }

  function useDesign(design) {
    if(state.backMode==='designed'&&state.activeBackDesignId===design.id)return;
    remember();
    state.activeBackDesignId=design.id;
    state.backMode='designed';
    status.textContent='Using '+backs.name(design)+' on every card back.';
    changed();
  }

  function addLayer(kind,assetId='') {
    const design=editDesign();
    if(!design)return null;
    const layer=backs.newLayer(kind,uniqueId('L-',design.layers));
    if(assetId)layer.assetId=assetId;
    design.layers.push(layer);
    selectedId=layer.id;
    return layer;
  }

  function moveLayer(step) {
    const layers=editDesign()?.layers;
    const index=layers?.findIndex(layer=>layer.id===selectedId);
    if(index==null||index<0||!layers[index+step])return;
    remember();
    [layers[index],layers[index+step]]=[layers[index+step],layers[index]];
    changed();
  }

  function queueRender() {
    if(activeTab!=='backs')return;
    frame++;
    if(updateFrame)return;
    updateFrame=requestAnimationFrame(()=>{
      updateFrame=0;
      renderPreview(frame).catch(error=>{status.textContent=error.message;});
    });
  }

  async function renderPreview(stamp) {
    const design=editDesign(),project=state;
    const image=design?await window.MNC_renderBackDesign(deep(design),project):await backCanvas();
    if(stamp!==frame||activeTab!=='backs')return;
    const ctx=preview.getContext('2d');
    ctx.save();
    ctx.clearRect(0,0,CW,CH);
    if(turned){ctx.translate(CW,CH);ctx.rotate(Math.PI);}
    ctx.drawImage(image,0,0);
    if(design)window.MNC_backGuides(ctx,editLayer(),$('backSafeGuide').checked);
    ctx.restore();
  }

  function pointer(event) {
    const rect=preview.getBoundingClientRect();
    const x=(event.clientX-rect.left)*CW/rect.width,y=(event.clientY-rect.top)*CH/rect.height;
    return turned?{x:CW-x,y:CH-y}:{x,y};
  }

  preview.addEventListener('pointerdown',event=>{
    const design=editDesign();
    if(event.button!==0||!design||drag)return;
    const point=pointer(event),hit=window.MNC_backHit(design,point.x,point.y);
    selectLayer(hit?.layer.id||'');
    if(!hit)return;
    drag={design,layer:hit.layer,turn:hit.turn,start:point,id:event.pointerId,
      x:hit.layer.x,y:hit.layer.y,changed:false};
    preview.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  preview.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId||drag.design!==editDesign())return;
    const point=pointer(event),dir=drag.turn?-1:1;
    const x=Math.round(clamp(drag.x+dir*(point.x-drag.start.x)*100/CW,-50,150)*10)/10;
    const y=Math.round(clamp(drag.y+dir*(point.y-drag.start.y)*100/CH,-50,150)*10)/10;
    if(x===drag.layer.x&&y===drag.layer.y)return;
    if(!drag.changed){remember();drag.changed=true;}
    Object.assign(drag.layer,{x,y});
    putControl($('backLayerX'),x);
    putControl($('backLayerY'),y);
    queueRender();
  });
  function endDrag(event) {
    if(!drag||drag.id!==event.pointerId)return;
    if(drag.changed)persist();
    drag=null;
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])preview.addEventListener(type,endDrag);

  $('backSelect').onchange=event=>{
    state.backEditingId=event.target.value;
    selectedId='';
    changed();
  };
  $('backStartBlank').onclick=()=>createDesign('blank');
  $('backStartLogo').onclick=()=>createDesign('logo');
  $('backStartUpload').onclick=()=>createDesign('uploaded');
  $('backUse').onclick=()=>{const design=editDesign();if(design)useDesign(design);};
  $('backPreviewPrint').onclick=()=>{
    const design=editDesign();
    if(!design)return;
    tab('production');
    return window.MNC_showBackProof?.(state.backMode==='designed'&&state.activeBackDesignId===design.id?'':design.id);
  };
  $('backDuplicate').onclick=()=>{
    const source=editDesign();
    if(!source)return;
    remember();
    const design={...deep(source),id:uniqueId('BACK-',state.backDesigns),name:uniqueName(backs.name(source).slice(0,79)+' copy')};
    state.backDesigns.push(design);
    state.backEditingId=design.id;
    selectedId='';
    status.textContent='Draft copied.';
    changed();
  };
  $('backDelete').onclick=()=>{
    const design=editDesign();
    if(!design||!confirm('Delete '+backs.name(design)+'?'))return;
    remember();
    state.backDesigns=state.backDesigns.filter(back=>back!==design);
    if(state.activeBackDesignId===design.id){
      state.activeBackDesignId='';
      if(state.backMode==='designed')state.backMode='mnc';
    }
    state.backEditingId=backs.active(state)?.id||state.backDesigns[0]?.id||'';
    selectedId='';
    status.textContent='Back deleted. Undo is available.';
    changed();
  };
  $('backUndo').onclick=()=>restoreHistory(undoStack,redoStack);
  $('backRedo').onclick=()=>restoreHistory(redoStack,undoStack);
  $('backSafeGuide').onchange=queueRender;
  $('backTurn').onclick=()=>{
    turned=!turned;
    $('backTurn').setAttribute('aria-pressed',String(turned));
    queueRender();
  };
  $('backExportPNG').onclick=async()=>{
    const design=editDesign();
    if(!design)return;
    try{
      const rendered=await window.MNC_renderBackDesign(deep(design),state);
      canvasPNG(rendered,'MNC_Back_'+slug(backs.name(design))+'.png');
    }catch(error){status.textContent=error.message;}
  };
  for(const [id,kind] of [['backAddImage','image'],['backAddText','text'],['backAddShape','shape']]){
    $(id).onclick=()=>{
      if(!editDesign())return;
      remember();
      addLayer(kind);
      changed();
      $(kind==='image'?'backLayerAsset':kind==='text'?'backLayerText':'backShape').focus();
    };
  }
  $('backImageUpload').onchange=async event=>{
    const input=event.target,file=input.files[0],design=editDesign(),target=editLayer();
    if(!file||!design)return;
    input.disabled=true;
    status.textContent='Importing image…';
    try{
      const [id]=await importImages([file]);
      if(!id){status.textContent='Choose a supported image file.';return;}
      if(editDesign()!==design){status.textContent='Image added to Artwork.';return;}
      remember();
      if(target?.kind==='image'&&design.layers.includes(target)){
        target.assetId=id;
        selectedId=target.id;
      }else addLayer('image',id);
      status.textContent='Image added.';
      changed();
    }finally{input.disabled=false;input.value='';}
  };
  $('backRaise').onclick=()=>moveLayer(1);
  $('backLower').onclick=()=>moveLayer(-1);
  $('backDuplicateLayer').onclick=()=>{
    const source=editLayer(),layers=editDesign()?.layers;
    if(!source)return;
    remember();
    const copy={...deep(source),id:uniqueId('L-',layers),x:Math.min(150,source.x+4),y:Math.min(150,source.y+4)};
    layers.splice(layers.indexOf(source)+1,0,copy);
    selectedId=copy.id;
    changed();
  };
  $('backDeleteLayer').onclick=()=>{
    const source=editLayer(),layers=editDesign()?.layers;
    if(!source)return;
    remember();
    const index=layers.indexOf(source);
    layers.splice(index,1);
    selectedId=layers[Math.min(index,layers.length-1)]?.id||'';
    changed();
  };
  editableInputs(projectFields,editDesign,'backField');
  editableInputs(layerFields,editLayer,'backLayer');

  document.addEventListener('keydown',event=>{
    if(activeTab!=='backs'||event.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      event.preventDefault();
      if(event.shiftKey)restoreHistory(redoStack,undoStack);
      else restoreHistory(undoStack,redoStack);
    }
  });
  window.MNC_refreshBackDesigner=sync;
})();
