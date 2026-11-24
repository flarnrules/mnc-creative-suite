'use strict';

(() => {
  const getCard=()=>cardById(currentId);
  const buttonModes=['Front','Back','Both'];
  let proofFrame=0,viewFrame=0,viewMode='Front',proofMode='Front',draftBackId='';

  function showSides(prefix, mode) {
    for(const button of buttonModes){
      const id=prefix+(prefix==='view'&&button==='Both'?'Pair':button);
      $(id).setAttribute('aria-pressed',String(button===mode));
    }
    $(prefix+'FrontCanvas').hidden=mode==='Back';
    $(prefix+'BackCanvas').hidden=mode==='Front';
    $(prefix==='proof'?'sheetProof':'viewStage').classList.toggle('show-both',mode==='Both');
  }

  function composeProof(ctx,sheet,number,back,images) {
    ctx.fillStyle='#fff';ctx.fillRect(0,0,SHEET_W,SHEET_H);
    ctx.fillStyle=back?'#8f4231':'#1f4f75';
    ctx.font='9px Arial';ctx.fillText(sheetHeading(number,back,sheet.finish),27,24);
    ctx.font='8px Arial';ctx.fillText(sheetFootnote(back),27,SHEET_H-19);
    for(const [index,image] of images.entries()){
      if(!image)continue;
      const r=sheetSlot(index,back);
      if(r.bleed)ctx.drawImage(image,r.x-r.bleed,r.top-r.bleed,r.w+2*r.bleed,r.h+2*r.bleed);
      ctx.drawImage(image,r.x,r.top,r.w,r.h);
      ctx.lineWidth=.32;ctx.strokeStyle='#303d4c';
      for(const [x0,y0,x1,y1] of trimTicks(r)){
        ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
      }
    }
  }

  async function renderProof() {
    showSides('proof',proofMode);
    if(activeTab!=='production')return;
    const seq=++proofFrame,index=Number($('proofSheet').value);
    const sheet=state.sheets[index];
    const draft=backs.byId(state,draftBackId);
    const backProject=draft?{...state,backMode:'designed',activeBackDesignId:draft.id}:state;
    $('proofDraftNotice').hidden=!draft;
    $('proofDraftName').textContent=draft?'Previewing '+backs.name(draft)+'. PDF export uses the shared back.':'';
    const fronts=new Map(),backImages=new Map(),cards=sheet?.slots.map(cardById)||[];
    const paint=async (side,back)=>{
      const target=$('proof'+side+'Canvas');
      if(target.hidden)return;
      const images=await Promise.all(cards.map((_,j)=>{
        const src=back?indexOnBack(j,state.duplex):j;
        const c=cards[src];
        if(!c)return null;
        if(!back){
          if(!fronts.has(c.id))fronts.set(c.id,cardCanvas(c,finishOptions(sheet,c)));
          return fronts.get(c.id);
        }
        const reg=backProject.backMode==='calibration'?src+1:null;
        if(!backImages.has(reg))backImages.set(reg,backCanvas(reg,backProject));
        return backImages.get(reg);
      }));
      if(seq!==proofFrame)return;
      const ctx=target.getContext('2d');
      ctx.setTransform(target.width/SHEET_W,0,0,target.height/SHEET_H,0,0);
      if(sheet)composeProof(ctx,sheet,index+1,back,images);
      else ctx.clearRect(0,0,SHEET_W,SHEET_H);
    };
    try {await Promise.all([paint('Front',false),paint('Back',true)]);}
    catch(error){console.error(error);}
  }

  window.MNC_renderProof=renderProof;
  window.MNC_showBackProof=(draftId='')=>{draftBackId=draftId;proofMode='Back';return renderProof();};
  window.MNC_chooseProofSheet=function(index,updateEditor=true){
    if(!state.sheets[index])return;
    $('proofSheet').value=String(index);
    if(updateEditor) Array.from($('sheetQueue').children).forEach((child,i)=>child.open=i===index);
    renderProof();
  };
  window.MNC_updateProof=function(){
    const el=$('proofSheet');
    const index=Math.min(Number(el.value)||0,state.sheets.length-1);
    dropDownOptions(el,state.sheets.map((_,i)=>[String(i),'Sheet '+String(i+1).padStart(2,'0')]),String(index));
    el.disabled=!state.sheets.length;
    renderProof();
  };
  $('proofSheet').onchange=()=>window.MNC_chooseProofSheet(Number($('proofSheet').value));
  for(const mode of buttonModes)$('proof'+mode).onclick=()=>{proofMode=mode;renderProof();};
  $('proofClearDraft').onclick=()=>window.MNC_showBackProof();
  $('backMode').addEventListener('change',()=>{draftBackId='';renderProof();});
  for(const id of ['duplexMode','includeFinishPreview','bleedOn'])$(id).addEventListener('change',renderProof);
  for(const id of ['backOffsetX','backOffsetY'])$(id).onchange=()=>{
    state[id]=clamp($(id).valueAsNumber||0,-3,3);
    $(id).value=state[id];persist();renderProof();
  };

  function filteredCards() {
    const filter=$('viewFilter').value;
    if(filter==='all')return state.cards;
    return filter==='game'?state.cards.filter(inWorkingCatalog):state.cards.filter(c=>c.family===filter);
  }

  async function renderView() {
    const seq=++viewFrame;
    const activeCards=filteredCards();
    if(activeCards.length&&!activeCards.some(card=>card.id===currentId))currentId=activeCards[0].id;
    const c=getCard();
    showSides('view',viewMode);
    const stage=$('viewStage');
    stage.style.setProperty('--view-zoom',$('viewZoom').value);
    const list=$('viewGallery');
    const choices=activeCards.map(card=>{
      const button=document.createElement('button');
      button.className='view-tile';
      button.setAttribute('aria-pressed',String(card.id===currentId));
      const thumb=document.createElement('canvas');thumb.width=150;thumb.height=210;thumb.setAttribute('aria-hidden','true');
      const title=document.createElement('span');title.textContent=card.title;
      button.append(thumb,title);
      button.onclick=()=>{currentId=card.id;renderView();};
      cardCanvas(card,{w:150,h:210}).then(cv=>{if(seq===viewFrame)thumb.getContext('2d').drawImage(cv,0,0);}).catch(console.error);
      return button;
    });
    list.replaceChildren(...choices);
    if(!choices.length)list.textContent='No cards match.';
    const info=$('viewDetails');
    $('viewTitle').textContent=c?.title||'No card selected';
    $('viewEdit').disabled=$('viewFoil').disabled=!c;
    $('viewPrev').disabled=$('viewNext').disabled=activeCards.length<2;
    if(!c){
      for(const side of ['Front','Back']){
        const target=$('view'+side+'Canvas');target.getContext('2d').clearRect(0,0,target.width,target.height);
      }
      info.textContent='';return;
    }
    const label=game.visualFor(c,state.typeOverrides)?.name;
    const variant=c.characterCategory==='Creature'?c.characterType:!c.characterCategory?label:'';
    const credited=[c.artistFirst,c.artistLast].filter(Boolean).join(' ')||c.artist;
    const partner=c.characterCategory==='Sidekick'&&(game.partnerFor(c,state.cards)?.title||game.partnerRef(c));
    info.textContent=[c.family,c.characterCategory,variant,partner&&'Partner: '+partner,c.film,
      c.episode&&'Episode '+c.episode,c.picker&&'Picked by '+c.picker,
      MNC_CARD_METADATA.hasCassette(c)&&'📼 Club copies',credited&&MNC_CARD_METADATA.creditType(c)+': '+credited,
      c.conceptCredit&&'Concept: '+c.conceptCredit,MNC_CARD_METADATA.collectionCode(c,collectionFor(c)),c.catalogStatus]
      .filter(Boolean).join(' · ');
    const [front,back]=await Promise.all([viewMode!=='Back'?cardCanvas(c,{rounded:true}):null,viewMode!=='Front'?backCanvas():null]);
    if(seq!==viewFrame)return;
    if(front){
      const ctx=$('viewFrontCanvas').getContext('2d');
      ctx.clearRect(0,0,CW,CH);ctx.drawImage(front,0,0);
    }
    if(back)$('viewBackCanvas').getContext('2d').drawImage(back,0,0);
  }
  const updateView=()=>renderView().catch(console.error);
  window.MNC_renderCardView=updateView;

  $('openCardView').onclick=()=>{
    if(getCard())$('viewFilter').value=inWorkingCatalog(getCard())?'game':'all';
    tab('viewer');
  };
  $('viewFilter').onchange=()=>{
    const list=filteredCards();
    if(list.length&&!list.some(card=>card.id===currentId))currentId=list[0].id;
    updateView();
  };
  $('viewZoom').onchange=()=>{
    $('viewStage').style.setProperty('--view-zoom',$('viewZoom').value);
  };
  for(const mode of buttonModes)$(mode==='Both'?'viewPair':'view'+mode).onclick=()=>{viewMode=mode;updateView();};
  for(const [id,step] of [['viewPrev',-1],['viewNext',1]])$(id).onclick=()=>{
    const list=filteredCards(),start=list.findIndex(c=>c.id===currentId);
    if(!list.length)return;
    currentId=list[(Math.max(start,0)+step+list.length)%list.length].id;updateView();
  };
  $('viewEdit').onclick=()=>{if(getCard())window.MNC_openStudioCard(getCard());};
  $('viewFoil').onclick=()=>tab('prism');
  const priorTab=window.MNC_tabChanged;
  window.MNC_tabChanged=name=>{
    priorTab?.(name);
    if(name!=='production')draftBackId='';
  };
})();
