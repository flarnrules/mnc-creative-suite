'use strict';

globalThis.MNC_XLSX = (() => {
  const limit=15*1024*1024;
  const xmlLimit=24*1024*1024;

  function formatCodes(styles) {
    const formats=new Map(Array.from(child(styles,'numFmts')?.children??[])
      .map(format=>[format.getAttribute('numFmtId'),format.getAttribute('formatCode')]));
    return Array.from(child(styles,'cellXfs')?.children??[]).map(style=>formats.get(style.getAttribute('numFmtId'))||'');
  }

  function xmlFrom(source) {
    const doc=new DOMParser().parseFromString(source,'application/xml');
    if(doc.getElementsByTagNameNS('*','parsererror').length)throw Error('The workbook contains unreadable XML.');
    return doc.documentElement;
  }

  function child(node,name) {
    return Array.from(node.children).find(element=>element.localName===name);
  }

  function textRuns(node) {
    return Array.from(node.getElementsByTagNameNS('*','t'))
      .filter(element=>element.parentElement.localName!=='rPh')
      .map(element=>element.textContent).join('');
  }

  function packagePath(base,target) {
    const parts=(target.startsWith('/')?target:base+target).split('/');
    const path=[];
    for(const part of parts) {
      if(!part||part==='.')continue;
      if(part==='..'){
        if(!path.length)throw Error('Invalid worksheet path.');
        path.pop();
      }else path.push(part);
    }
    return path.join('/');
  }

  function sheetRows(doc,strings,sheet,uses1904,formats) {
    const data=child(doc,'sheetData');
    if(!data)return [];
    const rows=Array.from(data.children).filter(row=>row.localName==='row').map((row,index)=>{
      const rowNum=Number(row.getAttribute('r'))||index+1;

      const values=[];
      for(const cell of row.children) {
        if(cell.localName!=='c')continue;
        const column=cell.getAttribute('r')?.match(/^[A-Z]+/)?.[0];
        if(!column)continue;
        const offset=Array.from(column).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
        if(offset>40)continue;
        const type=cell.getAttribute('t');
        const value=child(cell,'v')?.textContent??'';
        if(type==='inlineStr'){
          const inline=child(cell,'is');
          values[offset]=inline?textRuns(inline):'';
        } else if(type==='s'){
          const shared=strings[Number(value)];
          if(value===''||shared===undefined)throw Error(sheet+' contains an invalid text cell at '+cell.getAttribute('r')+'.');
          values[offset]=shared;
        } else if(type==='e') {
          values[offset]={error:value||'Excel error'};
        } else if(type==='b') {
          values[offset]=value==='1';
        } else {
          const format=formats[Number(cell.getAttribute('s')||0)]?.split(';')[0];
          values[offset]=/^0{2,12}$/.test(format||'')&&/^\d+$/.test(value)?value.padStart(format.length,'0'):value;
        }
      }
      if(rowNum>1000&&values.some(value=>value!==''&&value!=null)){
        throw Error(sheet+' contains a row past the workbook’s 999-record capacity.');
      }
      return {number:rowNum,values};
    }).filter(row=>row.number<=1000);
    if(sheet==='collections'&&uses1904){
      const header=rows.find(row=>row.number===1);
      const dateColumn=header?.values.findIndex(value=>String(value).trim().toLowerCase()==='release date')??-1;
      for(const row of rows){
        const value=row.values[dateColumn];
        if(row.number>1&&typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value)){
          row.values[dateColumn]=String(Number(value)+1462);
        }
      }
    }
    return rows;
  }

  async function read(input) {
    if(input.byteLength>limit)throw Error('Choose an .xlsx file under 15 MB. Keep image files in Artwork.');
    let archive;
    try {archive=await JSZip.loadAsync(input);}
    catch {throw Error('Choose a readable, unencrypted .xlsx workbook.');}
    const readXML=async file=>{
      const entry=archive.file(file);
      if(!entry)throw Error('Missing workbook data at '+file+'.');
      const source=await entry.async('string');
      if(source.length>xmlLimit)throw Error('The workbook has a worksheet too large for this catalog.');
      return xmlFrom(source);
    };
    const [workbook,links]=await Promise.all([readXML('xl/workbook.xml'),readXML('xl/_rels/workbook.xml.rels')]);
    const targets=new Map(Array.from(links.children).filter(r=>r.getAttribute('TargetMode')!=='External')
      .map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
    const stylesPath=Array.from(links.children).find(link=>link.getAttribute('Type')?.endsWith('/styles'))?.getAttribute('Target');
    const formats=stylesPath?formatCodes(await readXML(packagePath('xl/',stylesPath))):[];
    const sharedPath=Array.from(links.children).find(link=>link.getAttribute('Type')?.endsWith('/sharedStrings'))?.getAttribute('Target');
    const sharedFile=sharedPath?packagePath('xl/',sharedPath):'xl/sharedStrings.xml';
    const strings=archive.file(sharedFile)?Array.from((await readXML(sharedFile)).children).filter(e=>e.localName==='si').map(textRuns):[];
    const sheetNodes=Array.from(child(workbook,'sheets')?.children??[]);
    const uses1904=['1','true'].includes(child(workbook,'workbookPr')?.getAttribute('date1904'));
    const required=Object.keys(MNC_CATALOG_SCHEMA.sheets);
    return Object.fromEntries(await Promise.all(required.map(async name=>{
      const node=sheetNodes.find(e=>e.getAttribute('name')?.toLowerCase()===name);
      if(!node)throw Error('The workbook needs the '+name+' sheet.');
      const ref=Array.from(node.attributes).find(a=>a.localName==='id')?.value;
      const target=targets.get(ref);
      if(!target)throw Error('Could not find the '+name+' worksheet.');
      const doc=await readXML(packagePath('xl/',target));
      return [name,sheetRows(doc,strings,name,uses1904,formats)];
    })));
  }

  return {read};
})();
