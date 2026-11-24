uniform int labMode;
uniform float artAspect,colorAmount,colorHue,colorPulse,colorSaturation,colorDrift;
uniform float layerRed,layerYellow,layerGreen,layerCyan,layerBlue,layerMagenta,layerDark;
vec3 rgbHSV(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y),e=1e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 hsvRGB(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}
float hueWeight(float h,float center){float d=abs(h-center);d=min(d,1.-d);return max(0.,1.-d*6.);}
float response(vec3 hsv){float colored=smoothstep(.1,.3,hsv.y)*smoothstep(.12,.35,hsv.z);float r=hueWeight(hsv.x,0.)*layerRed+hueWeight(hsv.x,1./6.)*layerYellow+hueWeight(hsv.x,2./6.)*layerGreen+hueWeight(hsv.x,3./6.)*layerCyan+hueWeight(hsv.x,4./6.)*layerBlue+hueWeight(hsv.x,5./6.)*layerMagenta;return mix(layerDark,r,colored);}
vec3 livingColor(){
 float aspect=resolution.x/resolution.y;vec2 fit=vec2(min(1.,artAspect/aspect),min(1.,aspect/artAspect));vec2 at=(uv-.5)/fit+.5;
 if(at.x<0.||at.y<0.||at.x>1.||at.y>1.)return vec3(.025,.04,.055);
 vec3 original=texture2D(artwork,at).rgb;vec3 hsv=rgbHSV(original);float mask=response(hsv),t=phase*8.;
 float a=twist*.0174533;mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a));vec2 samplePoint;
 float field=fractalValue(rot*(at-.5)*2./zoom+pan,rot,samplePoint);
 float wave=sin(t+hsv.x*6.28318+field*6.28318),second=cos(t-hsv.x*12.56636+field*3.14159);
 float edge=min(min(at.x,1.-at.x),min(at.y,1.-at.y));float guard=smoothstep(0.,.06,edge);
 vec2 drift=vec2(wave,second)*colorDrift*colorAmount*mask*guard;
 vec3 changed=texture2D(artwork,clamp(at+drift,0.,1.)).rgb;vec3 c=rgbHSV(changed);
 c.x=fract(c.x+colorHue*wave*mask);c.y=clamp(c.y*(1.+colorSaturation*second*mask),0.,1.);c.z=clamp(c.z*(1.+colorPulse*wave*mask),0.,1.);
 return mix(original,hsvRGB(c),colorAmount);
}
