'use strict';

(() => {
  const status=$('catalogStatus'),issues=$('catalogIssues'),apply=$('catalogApply');
  const retain=$('catalogKeepEdits'),retainRow=$('catalogKeepEditsRow');
  let selection=null,sequence=0,reading=false;

  function issueList(entries) {
    const items=entries.slice(0,12).map(message=>{
      const item=document.createElement('li');
      item.textContent=message;
      return item;
    });
    if(entries.length>items.length){
      const more=document.createElement('li');
      more.textContent=(entries.length-items.length)+' more notices.';
      items.push(more);
    }
    issues.replaceChildren(...items);
    issues.hidden=!items.length;
  }

  function showLastImport() {
    if(selection||reading)return;
    const count=state.cards.filter(catalogCard).length;
    status.textContent=count
      ? count+' linked designs from '+(state.catalogFileName||'the workbook')+'.'
      : 'Choose a catalog workbook to link your designs.';
    status.classList.remove('mnc-error');
  }
  window.MNC_showCatalogStatus=showLastImport;
  window.MNC_clearCatalogImport=()=>{
    ++sequence;
    selection=null;
    reading=false;
    apply.disabled=true;
    retainRow.hidden=true;
    issueList([]);
    showLastImport();
  };

  function showPlan(prepared,filename) {
    const blocked=prepared.errors.length>0;
    const updates=prepared.changes.filter(row=>row.current).length;
    const additions=prepared.changes.length-updates;
    status.classList.toggle('mnc-error',blocked);
    status.textContent=blocked
      ? filename+' has '+prepared.errors.length+' '+(prepared.errors.length===1?'error':'errors')+'. Review the rows below.'
      : filename+' · '+additions+' new · '+updates+' updates'+(prepared.unlisted.length?' · '+prepared.unlisted.length+' unlisted':'')+'.';
    issueList(blocked?prepared.errors:prepared.warnings);
    retainRow.hidden=!prepared.retainedEdits||blocked;
    apply.disabled=blocked;
  }

  async function preview(filename,read) {
    const stamp=++sequence;
    selection=null;
    reading=true;
    retain.checked=true;
    retainRow.hidden=true;
    apply.disabled=true;
    status.classList.remove('mnc-error');
    status.textContent='Reading '+filename+'…';
    issueList([]);
    try {
      const rows=await window.MNC_XLSX.read(await read());
      if(stamp!==sequence)return;
      selection={rows,filename};
      showPlan(catalog.plan(state,catalog.parse(rows,state)),filename);
    }catch(error){
      if(stamp!==sequence)return;
      status.classList.add('mnc-error');
      status.textContent=error.message;
    }finally{
      if(stamp===sequence)reading=false;
    }
  }

  $('catalogFile').onchange=async event=>{
    const file=event.target.files[0];
    if(!file)return;
    event.target.value='';
    await preview(file.name,()=>file.arrayBuffer());
  };

  $('loadProjectWorkbook').onclick=()=>preview('MNC_TCG_Catalog.xlsx',async()=>{
    const response=await fetch('/api/mnc/workbook',{cache:'no-store'});
    if(!response.ok)throw Error('The project workbook could not be opened.');
    return response.arrayBuffer();
  });

  apply.onclick=()=>{
    if(!selection)return;
    const {rows,filename}=selection;
    const prepared=catalog.plan(state,catalog.parse(rows,state));
    if(prepared.errors.length){showPlan(prepared,filename);return;}
    const next=catalog.nextProject(state,prepared,{useWorkbook:!retain.checked});
    const existing=new Set(state.cards.map(card=>card.id));
    for(const card of next.cards)if(!existing.has(card.id))applyStartingDesign(card);
    state={...next,catalogFileName:filename};
    selection=null;
    apply.disabled=true;
    retainRow.hidden=true;
    issueList(prepared.warnings);
    $('cardScope').value='game';
    $('cardSearch').value='';
    if(!inWorkingCatalog(cardById(currentId)))currentId=state.cards.find(inWorkingCatalog)?.id||state.cards[0]?.id;
    persist();
    refreshAll();
    status.classList.remove('mnc-error');
    status.textContent=prepared.changes.length+' linked designs from '+filename+'.';
  };
})();
