export const families={
 fold:{name:'Kaleidoscope folds',formula:'qₙ₊₁ = gain · R(twist) · |qₙ| − offset. The closest orbit-trap distance creates the bands.'},
 mandelbrot:{name:'Mandelbrot',formula:'z₀ = 0; zₙ₊₁ = zₙ² + c. Each pixel supplies c; colors measure escape time.'},
 julia:{name:'Julia set',formula:'z₀ = pixel; zₙ₊₁ = zₙ² + c. Change the real and imaginary parts of c to explore different sets.'},
 dragon:{name:'Heighway dragon',formula:'Start with one segment. Append a reversed copy rotated 90° around its endpoint at every generation. Iterations controls 3–16 generations.'},
 triangle:{name:'Sierpiński triangle',formula:'Repeatedly keep the three corner triangles and remove the central triangle. Iterations controls 3–9 visible subdivision levels.'},
 carpet:{name:'Sierpiński carpet',formula:'Divide each square into a 3 × 3 grid, remove its center, and repeat. Iterations controls 3–6 visible subdivision levels.'},
 ship:{name:'Burning ship',formula:'z₀ = 0; zₙ₊₁ = (|Re zₙ| + i|Im zₙ|)² + c. Absolute values produce the ship-like folds.'},
 tricorn:{name:'Tricorn',formula:'z₀ = 0; zₙ₊₁ = conjugate(zₙ)² + c. Conjugation creates threefold symmetry.'},
 quaternion:{name:'Quaternion Julia · 4D',formula:'qₙ₊₁ = R₄(qₙ²) + c, with q=(x,y,z,w). The image is a 2D Z/W slice through a four-dimensional recurrence.'},
 cubic:{name:'Cubic Multibrot',formula:'z₀ = 0; zₙ₊₁ = zₙ³ + c. A higher-power relative of the Mandelbrot set.'}
};
export const familyIds=['fold','mandelbrot','julia','dragon','triangle','carpet','ship','tricorn','cubic','quaternion'];
export function dragonPoints(iterations,turn=90,branchScale=1){let p=[[0,0],[1,0]];const a=turn*Math.PI/180,c=turn===90?0:Math.cos(a),s=turn===90?1:Math.sin(a);for(let n=0;n<Math.max(3,Math.min(16,Math.round(iterations)));n++){const [x,y]=p.at(-1),tail=[];for(let i=p.length-2;i>=0;i--){const dx=p[i][0]-x,dy=p[i][1]-y;tail.push([x+branchScale*(c*dx-s*dy),y+branchScale*(s*dx+c*dy)]);}p.push(...tail);}return p;}
