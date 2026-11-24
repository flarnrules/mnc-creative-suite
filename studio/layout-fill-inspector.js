'use strict';

globalThis.MNC_LAYOUT_FILL_INSPECTOR = ({fields,input,action,change,palette,additionalLayer,openType})=>{
  const model=MNC_LAYOUT, effects=MNC_FRONT_EFFECTS;
  const schemes={
    ink:['#202523','#0f1518','#bdab84'],
    paper:['#f3e7cc','#d6c5a4','#7c6856'],
    critic:['#f7efe0','#d0bda4','#6d3f52'],
    projection:['#1e2730','#0c1117','#aa9072'],
    matinee:['#203a3c','#101b20','#a58282']
  };
  const presets=[
    ['brass','Brushed brass',[[0,'#70502f'],[.46,'#d4b486'],[1,'#755533']]],
    ['parchment','Parchment',[[0,'#fff1c8'],[.55,'#dfba7d'],[1,'#987047']]],
    ['ink','Theater ink',[[0,'#33374f'],[.55,'#191f2f'],[1,'#090d16']]],
    ['plum','Club plum',[[0,'#673b62'],[.45,'#3c264b'],[1,'#171b2d']]]
  ];

  function allows(layer,card){
    if(!layer||!card)return false;
    return ['background','plate','border'].includes(layer.id)||['rect','circle'].includes(additionalLayer(card,layer.id)?.style);
  }

  function solidColor(card,id){
    const theme=palette(card);
    if(id==='background')return card.layoutDesign?.background?.color||theme.sourceBase||theme.base;
    if(id==='plate')return front.values(card).plateFill||theme.plate||theme.panel||theme.base;
    if(id==='border')return MNC_OUTER_BORDER.color(card);
    return additionalLayer(card,id)?.color||'#ffffff';
  }

  function gradientFor(card,id){
    if(id==='background')return card.layoutDesign?.background?.gradient;
    return model.get(card,id)?.gradient;
  }

  function writeGradient(card,id,ramp){
    if(id==='background'){
      model.replaceBackground(card,{mode:'gradient',gradient:ramp});
      return;
    }
    model.layerEdit(card,id).gradient=ramp;
    if(id==='plate'&&['outline','none'].includes(card.nameplate))card.nameplate='solid';
  }

  function writeSolid(card,id,color){
    if(id==='background'){
      model.replaceBackground(card,{mode:'solid',color});
      return;
    }
    const layer=model.get(card,id);
    if(layer)delete layer.gradient;
    model.cleanLayer(card,id);
    if(id==='plate'){
      const layout=front.editable(card);
      layout.plateFill=color;
      if(['outline','none'].includes(card.nameplate))card.nameplate='solid';
    }else if(id==='border')card.borderColor=color;
    else additionalLayer(card,id).color=color;
  }

  function paintRamp(sample,ramp){
    const colors=[...ramp.stops].sort((a,b)=>a.at-b.at).map(stop=>stop.color+' '+Math.round(stop.at*100)+'%');
    sample.style.background=ramp.kind==='linear'
      ? 'linear-gradient('+((ramp.angle+90)%360)+'deg, '+colors.join(', ')+')'
      : 'radial-gradient(ellipse at center, '+colors.join(', ')+')';
  }

  function nextStop(stops){
    const ordered=[...stops].sort((a,b)=>a.at-b.at);
    let left=ordered[0],right=ordered[1];
    for(let i=1;i<ordered.length-1;i++){
      if(ordered[i+1].at-ordered[i].at>right.at-left.at)[left,right]=[ordered[i],ordered[i+1]];
    }
    return {at:(left.at+right.at)/2,color:front.mix(left.color,right.color,.5)};
  }

  function rampControls(host,id,initial){
    const sample=document.createElement('div');
    sample.className='ld-stop-preview';
    sample.setAttribute('aria-label','Gradient preview');
    sample.setAttribute('role','img');
    paintRamp(sample,initial);
    host.append(sample);

    const adjust=(c,fn)=>{
      const spec=deep(gradientFor(c,id));
      if(!spec)return;
      fn(spec);
      writeGradient(c,id,spec);
      paintRamp(sample,spec);
    };
    if(initial.kind==='linear'){
      const angle=input(host,'Angle (°)',initial.angle,(c,value)=>{
        adjust(c,spec=>{spec.angle=value;});
        angleLabel.textContent=value+'°';
      },{type:'range',min:0,max:360,step:1,live:true});
      const angleLabel=document.createElement('output');
      angleLabel.textContent=initial.angle+'°';
      angle.parentElement.append(angleLabel);
    }

    for(const [index,stop] of initial.stops.entries()){
      const row=document.createElement('div');
      row.className='ld-stop';
      input(row,'Color '+(index+1),stop.color,(c,value)=>adjust(c,ramp=>{ramp.stops[index].color=value;}),
        {type:'color',live:true});
      input(row,'Position %',Math.round(stop.at*100),(c,value)=>{
        if(value!=='')adjust(c,ramp=>{ramp.stops[index].at=value/100;});
      },{type:'number',min:0,max:100});
      if(initial.stops.length>2){
        const button=action(row,'×',()=>change(c=>adjust(c,ramp=>{ramp.stops.splice(index,1);}),{sync:true}));
        button.setAttribute('aria-label','Remove color '+(index+1));
      }
      host.append(row);
    }
    const buttons=document.createElement('div');
    buttons.className='buttonbar';
    const add=action(buttons,'Add stop',()=>change(c=>adjust(c,ramp=>{
      if(ramp.stops.length<effects.maxStops)ramp.stops.push(nextStop(ramp.stops));
    }),{sync:true}));
    add.disabled=initial.stops.length>=effects.maxStops;
    action(buttons,'Reverse colors',()=>change(c=>adjust(c,ramp=>{
      ramp.stops=ramp.stops.map(stop=>({...stop,at:1-stop.at})).sort((a,b)=>a.at-b.at);
    }),{sync:true}));
    host.append(buttons);
  }

  function backgroundPalette(card){
    const host=fields('Card palette');
    input(host,'Color scheme','',(c,value)=>{
      if(value==='type'){
        model.replaceBackground(c,null);
        delete c.borderColor;
        c.useTypeColor=true;
        c.surface='ink';
        c.filmTheme='classic';
      }else if(schemes[value]){
        const [start,end,trim]=schemes[value];
        model.replaceBackground(c,{mode:'gradient',gradient:effects.ramp(start,end,120)});
        c.borderColor=trim;
      }
    },{choices:[['','Choose a scheme'],['type','Type colors'],['ink','Ink'],['paper','Warm paper'],
      ['critic','Critic newsprint'],['projection','Projection Booth'],['matinee','Midnight Matinée']],refresh:true});
    if(card.family!=='Character')return;
    input(host,'Use shared type accent',card.useTypeColor!==false,(c,value)=>{c.useTypeColor=value;},{type:'checkbox',refresh:true});
    if(card.useTypeColor===false)input(host,'Accent',card.accent||palette(card).accent,(c,value)=>{c.accent=value;},{type:'color',live:true});
    action(host,'Edit shared type defaults',()=>openType(card));
  }

  function render(layer,card) {
    const id=layer.id, background=id==='background', ramp=gradientFor(card,id), color=solidColor(card,id);
    const host=fields(layer.label+' fill');
    const mode=ramp?.kind||(background&&!card.layoutDesign?.background?'palette':'solid');
    input(host,'Fill type',mode,(c,value)=>{
      if(value==='palette')model.replaceBackground(c,null);
      else if(value==='solid')writeSolid(c,id,ramp?effects.firstColor(ramp):color);
      else{
        const spec=gradientFor(c,id)||effects.ramp(color,front.tone(color,-45),90);
        writeGradient(c,id,{...spec,kind:value});
      }
    },{choices:[...(background?[['palette','Card palette']]:[]),['solid','Solid color'],
      ['linear','Linear gradient'],['radial','Radial gradient']],refresh:true});
    input(host,'Gradient preset','',(c,value)=>{
      const preset=presets.find(item=>item[0]===value);
      if(!preset)return;
      const stops=preset[2].map(([at,color])=>({at,color}));
      writeGradient(c,id,{kind:ramp?.kind||'linear',angle:ramp?.angle??120,stops});
    },{choices:[['','Choose a gradient'],...presets.map(([key,name])=>[key,name])],refresh:true});
    if(ramp)rampControls(host,id,ramp);
    else if(mode==='solid')input(host,'Solid color',color,(c,value)=>writeSolid(c,id,value),{type:'color',live:true});
    if(background)backgroundPalette(card);
  }

  return {allows,render};
};
