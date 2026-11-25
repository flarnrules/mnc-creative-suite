'use strict';

globalThis.MNC_SHAPES = (() => {
  const anchors = 64;
  const range = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const rounded = n => Math.round(n * 10000) / 10000;
  const point = (x, y) => ({x, y, smooth:0});
  const fields = {art:'artShapeId', plate:'nameplateShapeId'};
  const starters = {
    rectangle:[[0,0],[1,0],[1,1],[0,1]],
    clipped:[[.08,0],[.92,0],[1,.12],[1,.88],[.92,1],[.08,1],[0,.88],[0,.12]],
    arch:[[0,.2],[.16,.055,.8],[.5,0,1],[.84,.055,.8],[1,.2],[1,.91],[.95,1,.45],[.05,1,.45],[0,.91]],
    rounded:[[.09,0],[.91,0],[.98,.035,.85],[1,.09],[1,.91],[.98,.965,.85],[.91,1],[.09,1],[.02,.965,.85],[0,.91],[0,.09],[.02,.035,.85]],
    oval:[[.5,0,1],[.854,.146,1],[1,.5,1],[.854,.854,1],[.5,1,1],[.146,.854,1],[0,.5,1],[.146,.146,1]],
    ticket:[[.07,0],[.93,0],[1,.23],[.95,.5],[1,.77],[.93,1],[.07,1],[0,.77],[.05,.5],[0,.23]],
    pill:[[.08,0,.6],[.92,0,.6],[1,.5,1],[.92,1,.6],[.08,1,.6],[0,.5,1]],
    scroll:[[.015,.50,1],[.026,.13,.6],[.06,0,.8],[.098,.17,.3],[.902,.17,.3],
      [.94,0,.8],[.974,.13,.6],[.985,.50,1],[.974,.87,.6],[.94,1,.8],[.902,.83,.3],
      [.098,.83,.3],[.06,1,.8],[.026,.87,.6]],
    ribbon:[[0,.16],[.14,.24],[.14,.06],[.86,.06],[.86,.24],[1,.16],[.957,.5],
      [1,.86],[.86,.78],[.86,.94],[.14,.94],[.14,.78],[0,.86],[.043,.5]],
    wave:[[0,.21],[.13,.32,.9],[.33,.21,1],[.54,.06,1],[.74,.14,1],[.88,.28,.9],[1,.2],
      [.966,.56],[1,.89],[.88,.98,.9],[.74,.84,1],[.54,.76,1],[.33,.91,1],[.13,1,.9],[0,.89],[.034,.55]],
    pennant:[[0,.04],[.86,.04],[1,.5],[.86,.96],[0,.96],[.047,.5]],
    decoPlaque:[[.085,0],[.915,0],[.915,.13],[.96,.13],[.96,.31],[1,.31],[1,.69],[.96,.69],
      [.96,.87],[.915,.87],[.915,1],[.085,1],[.085,.87],[.04,.87],[.04,.69],[0,.69],[0,.31],[.04,.31],[.04,.13],[.085,.13]],
    shield:[[.02,.10],[.15,0],[.85,0],[.98,.10],[.96,.64],[.85,.84],[.5,1],[.15,.84],[.04,.64]]
  };
  const platePresets=[['rounded','Rounded'],['pill','Pill'],['scroll','Scroll'],['ribbon','Ribbon'],
    ['wave','Wavy banner'],['pennant','Pennant'],['decoPlaque','Art Deco plaque'],
    ['ticket','Ticket'],['shield','Shield'],['clipped','Cut corners'],['oval','Oval']];

  function start(name) {
    return (Object.hasOwn(starters,name)?starters[name]:[]).map(([x,y,smooth=0]) => ({x,y,smooth}));
  }

  function normalizePoints(value) {
    if (!Array.isArray(value) || value.length > anchors || value.some(p => !Number.isFinite(p?.x) || !Number.isFinite(p?.y))) return [];
    return value.map(p => ({
      x:rounded(range(p.x,0,1)), y:rounded(range(p.y,0,1)),
      smooth:rounded(range(Number.isFinite(p.smooth) ? p.smooth : 0,0,1))
    }));
  }

  function polygonPath(points, rect={x:0,y:0,w:1,h:1}) {
    const path = new Path2D();
    if (!points.length) return path;
    // A smooth anchor shares a tangent across both adjacent cubic segments.
    const nodes = points.map((p,i) => {
      const previous = points[(i+points.length-1)%points.length], next = points[(i+1)%points.length];
      const x = rect.x+p.x*rect.w, y = rect.y+p.y*rect.h;
      const dx = (next.x-previous.x)*p.smooth/6, dy = (next.y-previous.y)*p.smooth/6;
      return {x,y,dx:dx*rect.w,dy:dy*rect.h};
    });
    path.moveTo(nodes[0].x,nodes[0].y);
    for (let i=0; i<nodes.length; i++) {
      const a=nodes[i], b=nodes[(i+1)%nodes.length];
      if (a.dx || a.dy || b.dx || b.dy) path.bezierCurveTo(a.x+a.dx,a.y+a.dy,b.x-b.dx,b.y-b.dy,b.x,b.y);
      else path.lineTo(b.x,b.y);
    }
    path.closePath();
    return path;
  }

  function validPoints(points) {
    if (points.length < 3 || points.length > anchors) return false;
    const area = points.reduce((sum,p,i) => {
      const next = points[(i+1)%points.length];
      return sum+p.x*next.y-next.x*p.y;
    },0);
    return Math.abs(area) >= .005;
  }

  function simplifyStroke(points, tolerance) {
    // Keep the samples that depart from the straight line between retained points.
    const last = points.length-1;
    const keep = new Set([0,last]);
    const segments = [[0,last]];
    while (segments.length) {
      const [start,end] = segments.pop();
      const a = points[start], b = points[end];
      const dx = b.x-a.x, dy = b.y-a.y;
      const lengthSquared = dx*dx+dy*dy || 1;
      let furthest = -1, error = tolerance*tolerance;
      for (let i=start+1; i<end; i++) {
        const x = points[i].x-a.x, y = points[i].y-a.y;
        const t = range((x*dx+y*dy)/lengthSquared,0,1);
        const distanceSquared = (x-t*dx)**2+(y-t*dy)**2;
        if (distanceSquared>error) {furthest=i;error=distanceSquared;}
      }
      if (furthest>=0) {
        keep.add(furthest);
        segments.push([start,furthest],[furthest,end]);
      }
    }
    return points.filter((_,i)=>keep.has(i));
  }

  function fromStroke(samples, width, height) {
    if (samples.length<3 || !(width>0 && height>0)) return [];
    const pixels = samples.map(({x,y})=>({x:x*width,y:y*height}));
    const first = pixels[0], last = pixels.at(-1);
    const joinsStart = Math.hypot(last.x-first.x,last.y-first.y)<=6;
    if (joinsStart) pixels[pixels.length-1]=first;
    let tolerance = Math.max(1.6,Math.min(width,height)*.006);
    let nodes = simplifyStroke(pixels,tolerance);
    while (nodes.length>anchors+(joinsStart?1:0)) {
      tolerance *= 1.35;
      nodes = simplifyStroke(pixels,tolerance);
    }
    if (joinsStart) nodes.pop();
    const points = normalizePoints(nodes.map((node,i)=>{
      const prior=nodes[(i+nodes.length-1)%nodes.length], next=nodes[(i+1)%nodes.length];
      const incomingX=node.x-prior.x, incomingY=node.y-prior.y;
      const outgoingX=next.x-node.x, outgoingY=next.y-node.y;
      const lengths=Math.hypot(incomingX,incomingY)*Math.hypot(outgoingX,outgoingY);
      const cosine=(incomingX*outgoingX+incomingY*outgoingY)/(lengths||1);
      const smooth=.85*range((cosine-.3)/.6,0,1);
      return {x:node.x/width,y:node.y/height,smooth};
    }));
    return validPoints(points)?points:[];
  }

  const svgCommands = /[MmZzLlHhVvCcSsQqTtAa]/g;
  const svgNumbers = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
  const commandSize = {m:2,l:2,h:1,v:1,c:6,s:4,q:4,t:2,a:7,z:0};

  function pathData(value) {
    if (typeof value !== 'string' || value.length > 24000) throw Error('The SVG outline is too large.');
    const tokens = value.match(new RegExp(svgCommands.source+'|'+svgNumbers.source,'g')) || [];
    if (value.replace(new RegExp(svgCommands.source+'|'+svgNumbers.source+'|[ ,\\t\\r\\n]','g'),'') ||
      !/^[Mm]$/.test(tokens[0] ?? '') || !/^[Zz]$/.test(tokens.at(-1) ?? '')) {
      throw Error('Use a closed SVG path. In GIMP, close the outline before exporting.');
    }
    let command = '', remaining = 0, first = true;
    const commands = [];
    for (const token of tokens) {
      if (/^[a-z]$/i.test(token)) {
        if (remaining || (!first && !command && !/^[Mm]$/.test(token)) || (command && /^[Mm]$/.test(token))) {
          throw Error('Each contour must have a move command and end with a close command.');
        }
        command = token;
        remaining = commandSize[token.toLowerCase()];
        if (!remaining) command = '';
        commands.push(token);
        first = false;
      } else {
        const number = Number(token);
        if (!command || !Number.isFinite(number) || Math.abs(number) > 1e6) throw Error('The SVG contains an invalid coordinate.');
        if (!remaining) remaining = commandSize[command.toLowerCase()];
        remaining--;
        if (!remaining && /^[Mm]$/.test(command)) command = command === 'M' ? 'L' : 'l';
        commands.push(token);
      }
    }
    return commands.join(' ');
  }

  function bounds(path) {
    const canvas = document.createElement('canvas');
    const size=512, margin=4;
    canvas.width=canvas.height=size;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    // GIMP includes all anchors and control points in the path data. Use
    // the numbers as a conservative view of the canvas before measuring its ink.
    const data=path.data.match(svgNumbers).map(Number);
    const extent=Math.max(1,...data.map(Math.abs)), scale=(size-2*margin)/(4*extent);
    let sx=scale, sy=scale, tx=size/2, ty=size/2;
    let box=null;
    for(let pass=0;pass<2;pass++){
      ctx.resetTransform();ctx.clearRect(0,0,size,size);
      ctx.setTransform(sx,0,0,sy,tx,ty);
      ctx.fill(path.outline,'evenodd');
      const rgba=ctx.getImageData(0,0,size,size).data;
      let minX=size,minY=size,maxX=-1,maxY=-1;
      for(let pixel=0;pixel<rgba.length;pixel+=4){
        if(rgba[pixel+3]<32)continue;
        const col=(pixel/4)%size, row=Math.floor(pixel/(4*size));
        minX=Math.min(minX,col);maxX=Math.max(maxX,col);minY=Math.min(minY,row);maxY=Math.max(maxY,row);
      }
      if(minX<1||minY<1||maxX>=size-1||maxY>=size-1||maxX-minX<2||maxY-minY<1)break;
      box={x:(minX-tx)/sx,y:(minY-ty)/sy,w:(maxX-minX+1)/sx,h:(maxY-minY+1)/sy};
      sx=(size-2*margin)/box.w;sy=(size-2*margin)/box.h;
      tx=margin-box.x*sx;ty=margin-box.y*sy;
    }
    if(box)return box;
    throw Error('No usable filled outline was found in the SVG.');
  }

  function importedPath(source) {
    const xml=new DOMParser().parseFromString(source,'image/svg+xml');
    if (xml.documentElement?.localName !== 'svg' || xml.getElementsByTagNameNS('*','parsererror').length) {
      throw Error('Choose an SVG exported from the GIMP Paths panel.');
    }
    const paths=Array.from(xml.getElementsByTagNameNS('*','path'));
    if (!paths.length || paths.length>24) throw Error('The SVG needs one outline or a small set of closed contours.');
    for (const element of paths) {
      for (let parent=element; parent; parent=parent.parentElement) {
        if (parent.getAttribute('transform') || !['svg','g','path'].includes(parent.localName)) {
          throw Error('Export the path directly from GIMP. Transformed or embedded paths are unsupported.');
        }
      }
    }
    const data=pathData(paths.map(p=>p.getAttribute('d')||'').join(' '));
    return {data, box:bounds({data,outline:new Path2D(data)})};
  }

  const cached = new WeakMap();
  function path(shape, rect) {
    if (!shape) return null;
    if (shape.kind === 'points') return polygonPath(shape.points,rect);
    let source=cached.get(shape.svg);
    if (!source) {
      source=new Path2D(shape.svg.data);
      cached.set(shape.svg,source);
    }
    const box=shape.svg.box, sx=rect.w/box.w, sy=rect.h/box.h;
    const fitted=new Path2D();
    fitted.addPath(source,new DOMMatrix([sx,0,0,sy,rect.x-box.x*sx,rect.y-box.y*sy]));
    return fitted;
  }

  function make(value) {
    const name=typeof value.name==='string' ? value.name.trim().slice(0,80) : '';
    if (!name) throw Error('Give this shape a name.');
    if (value.kind === 'svg') {
      const data=pathData(value.svg?.data);
      const box=value.svg?.box;
      if (!box || !['x','y','w','h'].every(key=>Number.isFinite(box[key])&&Math.abs(box[key])<=1e6) || box.w<1 || box.h<1) {
        throw Error('The imported outline has invalid bounds.');
      }
      return {name,kind:'svg',svg:{data,box:{x:box.x,y:box.y,w:box.w,h:box.h}}};
    }
    const points=normalizePoints(value.points);
    if (!validPoints(points)) throw Error('Draw at least three points that enclose an area.');
    return {name,kind:'points',points};
  }

  function restore(project) {
    const restored=[], ids=new Set();
    for (const shape of Array.isArray(project.cardShapes) ? project.cardShapes : []) {
      if (typeof shape?.id !== 'string' || !/^SHAPE-[A-Za-z0-9-]{1,70}$/.test(shape.id) || ids.has(shape.id)) continue;
      try {
        restored.push({id:shape.id,...make(shape)});
        ids.add(shape.id);
      } catch { /* Ignore an invalid outline while restoring the rest of the project. */ }
    }
    project.cardShapes=restored;
  }

  function forCard(card,target,project) {
    return card.shapePreview?.[target] || project.cardShapes?.find(shape=>shape.id===card[fields[target]]);
  }

  function platePath(preset,rect){
    if(preset==='pill'||preset==='rounded'){
      const path=new Path2D();
      path.roundRect(rect.x,rect.y,rect.w,rect.h,preset==='pill'?Math.min(rect.w,rect.h)/2:Math.min(15,rect.h/5));
      return path;
    }
    return Object.hasOwn(starters,preset)?polygonPath(start(preset),rect):null;
  }

  return {anchors,fields,point,start,validPoints,polygonPath,path,make,importedPath,restore,forCard,platePresets,platePath,fromStroke};
})();
