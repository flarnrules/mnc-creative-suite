export const families={
 fold:{name:'Kaleidoscope folds',formula:'At 1, loaded artwork is shown as the starting image. The fold rule is qₙ₊₁ = gain · R(twist) · |qₙ| − offset. The closest orbit-trap distance creates the bands.'},
 mandelbrot:{name:'Mandelbrot',formula:'z₀ = 0; zₙ₊₁ = zₙ² + c. Each pixel supplies c; colors measure escape time.'},
 julia:{name:'Julia set',formula:'z₀ = pixel; zₙ₊₁ = zₙ² + c. Change the real and imaginary parts of c to explore different sets.'},
 dragon:{name:'Heighway dragon',formula:'Start with one segment. Append a reversed copy rotated 90° around its endpoint at every generation. Iterations controls 1–16 generations.'},
 triangle:{name:'Sierpiński triangle',formula:'Repeatedly keep the three corner triangles and remove the central triangle. Iterations controls 1–9 visible subdivision levels.'},
 carpet:{name:'Sierpiński carpet',formula:'Divide each square into a 3 × 3 grid, remove its center, and repeat. Iterations controls 1–6 visible subdivision levels.'},
 ship:{name:'Burning ship',formula:'z₀ = 0; zₙ₊₁ = (|Re zₙ| + i|Im zₙ|)² + c. Absolute values produce the ship-like folds.'},
 tricorn:{name:'Tricorn',formula:'z₀ = 0; zₙ₊₁ = conjugate(zₙ)² + c. Conjugation creates threefold symmetry.'},
 quaternion:{name:'Quaternion Julia · 4D',formula:'qₙ₊₁ = R₄(qₙ²) + c, with q=(x,y,z,w). The image is a 2D Z/W slice through a four-dimensional recurrence.'},
 cubic:{name:'Cubic Multibrot',formula:'z₀ = 0; zₙ₊₁ = zₙ³ + c. A higher-power relative of the Mandelbrot set.'},
 tree:{name:'Feedback tree',formula:'Each fork repeats a curved stem on two smaller, rotated branches. Start with one generation for the stem, then add generations to grow the tree. Loaded artwork can color the branches.'}
};
export const familyIds=['fold','mandelbrot','julia','dragon','triangle','carpet','ship','tricorn','cubic','quaternion','tree'];
export function dragonPoints(iterations,turn=90,branchScale=1){let p=[[0,0],[1,0]];const a=turn*Math.PI/180,c=turn===90?0:Math.cos(a),s=turn===90?1:Math.sin(a);for(let n=0;n<Math.max(1,Math.min(16,Math.round(iterations)));n++){const [x,y]=p.at(-1),tail=[];for(let i=p.length-2;i>=0;i--){const dx=p[i][0]-x,dy=p[i][1]-y;tail.push([x+branchScale*(c*dx-s*dy),y+branchScale*(s*dx+c*dy)]);}p.push(...tail);}return p;}

export const treeGenerationLimit=9;

export function treeBranches(spread,shrink,curl) {
 const fork=spread*Math.PI/180, bend=curl*Math.PI/180;
 let stems=[{x:0,y:0,angle:0,length:1}];
 const layers=[];
 for(let generation=0;generation<treeGenerationLimit;generation++){
  const children=[];
  const branches=stems.map(({x,y,angle,length})=>{
   const mid=angle+bend/2, tip=angle+bend;
   const endX=x+length*Math.sin(mid), endY=y-length*Math.cos(mid);
   const tangent=length*.36;
   children.push({x:endX,y:endY,angle:tip-fork,length:length*shrink},
    {x:endX,y:endY,angle:tip+fork,length:length*shrink*.93});
   return [x,y,x+tangent*Math.sin(angle),y-tangent*Math.cos(angle),
    endX-tangent*Math.sin(tip),endY+tangent*Math.cos(tip),endX,endY];
  });
  layers.push(branches);
  stems=children;
 }
 return layers;
}
