uniform int family, artMode;
uniform float rotationZ, tiltX, tiltY, artMix, artWarp;
uniform vec2 julia;
uniform int depth;
uniform sampler2D artwork, dragon;
// Inverse perspective projection of an infinite plane rotated around X/Y/Z.
vec2 planePoint(vec2 screen){
 float x=radians(tiltX),y=radians(tiltY),z=radians(rotationZ);
 vec3 ex=vec3(cos(y),0.,-sin(y));
 vec3 ey=vec3(sin(x)*sin(y),cos(x),sin(x)*cos(y));
 vec3 normal=cross(ex,ey),ray=vec3(screen,-3.);
 float denominator=dot(normal,ray);
 float t=dot(normal,vec3(0.,0.,-3.))/min(-.08,denominator);
 vec3 hit=vec3(0.,0.,3.)+t*ray;
 vec2 p=vec2(dot(hit,ex),dot(hit,ey));
 return mat2(cos(z),-sin(z),sin(z),cos(z))*p;
}
vec2 artUV(vec2 p){return 1.-abs(mod(p*.5+.5,2.)-1.);}
__INTERNAL_FIELDS__
float fractalValue(vec2 p,mat2 rot,out vec2 samplePoint){
 samplePoint=p;
 if(family==9||((family==0||family==1||family==2||family>=6)&&(dimensionMix>0.||artMode>=4||recurrenceSpin!=0.||power!=2.||juliaMorph!=0.||gain!=1.||bailout!=8.)))return advancedField(p,rot,samplePoint);
 if(family==3&&(dimensionMix>0.||artMode>=4||recurrenceSpin!=0.)){vec4 q=liftInternal(p);vec3 memory=vec3(0.);for(int i=0;i<16;i++){if(i>=iterations)break;q=mix(q,rotateInternal(q),dimensionMix);q.xy=internalSpin(q.xy,recurrenceSpin);q=artInternal(q,float(i),memory);}p=q.xy;}

 if(family==0){
  vec2 q=p;
  for(int i=0;i<24;i++){if(i>=iterations)break;q=gain*(rot*abs(q))-offset;}
  samplePoint=q;
  return foldField(p,rot,iterations,offset,gain,trap,radius,scale,phase);
 }
 if(family==3){vec2 t=p/3.+.5;float inBounds=step(0.,t.x)*step(t.x,1.)*step(0.,t.y)*step(t.y,1.);return texture2D(dragon,t).r*inBounds;}
 if(family==4){
  // Convert to triangle coordinates: x >= 0, y >= 0, x + y <= 1.
  vec2 q=vec2((p.x+1.25)/2.5-(p.y+1.1)/4.4,(p.y+1.1)/2.2);
  float v=step(0.,q.x)*step(0.,q.y)*step(q.x+q.y,1.);
  for(int i=0;i<9;i++){if(i>=iterations)break;vec4 internal=liftInternal(q-.5);internal=mix(internal,rotateInternal(internal),dimensionMix);vec3 memory=vec3(0.);internal=artInternal(internal,float(i),memory);q=internalSpin(internal.xy,recurrenceSpin)*gain+.5;q*=2.;if(q.x<1.&&q.y<1.&&q.x+q.y>1.)v=0.;q=fract(q);}
  samplePoint=q;return v;
 }
 if(family==5){
  vec2 q=p/2.5+.5;float v=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);
  for(int i=0;i<6;i++){if(i>=iterations)break;vec4 internal=liftInternal(q-.5);internal=mix(internal,rotateInternal(internal),dimensionMix);vec3 memory=vec3(0.);internal=artInternal(internal,float(i),memory);q=internalSpin(internal.xy,recurrenceSpin)*gain+.5;q*=3.;vec2 cell=floor(q);if(cell.x==1.&&cell.y==1.)v=0.;q=fract(q);}
  samplePoint=q;return v;
 }
 vec2 c=family==2?julia:p-(family==1||family==6?vec2(.5,0.):vec2(0.));
 vec2 q=family==2?p:vec2(0.);float count=0.;bool escaped=false;
 for(int i=0;i<192;i++){
  if(i>=depth)break;
  if(family==6)q=abs(q);if(family==7)q.y=-q.y;
  if(family==8)q=vec2(q.x*(q.x*q.x-3.*q.y*q.y),q.y*(3.*q.x*q.x-q.y*q.y))+c;
  else q=vec2(q.x*q.x-q.y*q.y,2.*q.x*q.y)+c;
  count+=1.;if(dot(q,q)>64.){escaped=true;break;}
 }
 samplePoint=q;
 if(!escaped)return 0.;
 float smoothCount=count+1.-log2(max(1.,log2(max(2.,length(q)))));
 return .5+.5*cos(smoothCount*.16*scale+phase*8.);
}
