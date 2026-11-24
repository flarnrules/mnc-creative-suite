uniform sampler2D artField;
uniform float artFrequency,artDrift,artMemory,dimensionMix,sliceZ,sliceW,rotateXZ,rotateXW,rotateYW,rotateZW,depthWave,recurrenceSpin,power,juliaMorph,bailout;
uniform vec2 quaternionConstant;
vec2 internalSpin(vec2 p,float deg){float a=radians(deg);return mat2(cos(a),-sin(a),sin(a),cos(a))*p;}
vec4 rotateInternal(vec4 q){q.xz=internalSpin(q.xz,rotateXZ);q.xw=internalSpin(q.xw,rotateXW);q.yw=internalSpin(q.yw,rotateYW);q.zw=internalSpin(q.zw,rotateZW);return q;}
vec4 liftInternal(vec2 p){return vec4(p,sliceZ+depthWave*sin(p.x*1.7)*cos(p.y*1.3),sliceW+depthWave*.5*sin(p.x-p.y));}
vec4 artInternal(vec4 q,float n,inout vec3 memory){
 if(artMode<4)return q;
 vec2 at=internalSpin(clamp(q.xy+q.zw*.37,vec2(-1000.),vec2(1000.))*artFrequency,n*artDrift*57.2958)+vec2(.137,.219)*n*artDrift;
 vec3 f=texture2D(artField,artUV(at)).rgb*2.-1.;memory=mix(f,memory,artMemory);
 if(artMode==4)q+=artWarp*.12*vec4(memory.r-memory.g,memory.b-memory.g,(memory.r+memory.b)*dimensionMix,memory.g*dimensionMix);
 if(artMode==5){q.xy=internalSpin(q.xy,artWarp*memory.b*18.)*(1.+artWarp*memory.r*.08);q.zw*=1.+artWarp*memory.g*.08;}
 return q;
}
vec2 powerInternal(vec2 q,float exponent){float r=length(q);if(r<1e-8)return vec2(0.);float a=atan(q.y,q.x)*exponent;return pow(min(r,64.),exponent)*vec2(cos(a),sin(a));}
float advancedField(vec2 p,mat2 rot,out vec2 samplePoint){
 vec4 q=liftInternal(p);vec3 memory=vec3(0.);float d=10.,count=0.;bool escaped=false;
 vec2 c=family==2||family==9?julia:mix(p-(family==1||family==6?vec2(.5,0.):vec2(0.)),julia,juliaMorph);
 if(family!=0&&family!=2&&family!=9)q.xy=vec2(0.);
 for(int i=0;i<192;i++){
  if(i>=(family==0?iterations:depth))break;
  if(family==0){vec4 f=abs(q);f.xy=rot*f.xy;q=gain*mix(f,rotateInternal(f),dimensionMix)-vec4(offset,offset.y*.73,offset.x*.61);q.xy=internalSpin(q.xy,recurrenceSpin);}
  else if(family==9){q=vec4(q.x*q.x-dot(q.yzw,q.yzw),2.*q.x*q.yzw);q=rotateInternal(q)*gain+vec4(c,quaternionConstant);q.xy=internalSpin(q.xy,recurrenceSpin);}
  else{if(family==6)q.xy=abs(q.xy);if(family==7)q.y=-q.y;q.xy=internalSpin(powerInternal(q.xy,power+(family==8?1.:0.)),recurrenceSpin)*gain+c;q.zw=.65*q.zw+.2*sin(q.xy)+vec2(sliceZ,sliceW)*.1;q=mix(q,rotateInternal(q),dimensionMix);}
  q=artInternal(q,float(i),memory);
  float distance=mix(length(q.xy),length(q),dimensionMix);
  if(family==0){if(trap==1)distance=abs(distance-radius);else if(trap==2)distance=abs(q.y);else if(trap==3)distance=min(abs(q.x),abs(q.y));}
  if(artMode==6)distance=abs(distance-artWarp*(.5+.5*dot(memory,vec3(.299,.587,.114))));d=min(d,distance);count+=1.;
  if(family!=0&&(family==9?dot(q,q):mix(dot(q.xy,q.xy),dot(q,q),dimensionMix))>bailout*bailout){escaped=true;break;}
  q=clamp(q,vec4(-10000.),vec4(10000.));
 }
 samplePoint=clamp(q.xy,vec2(-1000.),vec2(1000.));
 if(family==0||artMode==6)return .5+.5*cos(d*scale*35.+phase*8.);
 if(!escaped)return 0.;float smoothCount=count+1.-log2(max(1.,log2(max(2.,length(q.xy)))));return .5+.5*cos(smoothCount*.16*scale+phase*8.);
}
