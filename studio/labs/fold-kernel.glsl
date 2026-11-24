// Shared by Fractal Lab and the card shader. GLSL column-major rotation.
float foldField(vec2 p, mat2 rotation, int iterations, vec2 offset,
 float gain, int trap, float radius, float scale, float phase){
 vec2 q=p;float d=10.0;
 for(int i=0;i<24;i++){
  if(i>=iterations)break;
  q=gain*(rotation*abs(q))-offset;
  float distanceToTrap=length(q);
  if(trap==1)distanceToTrap=abs(length(q)-radius);
  else if(trap==2)distanceToTrap=abs(q.y);
  else if(trap==3)distanceToTrap=min(abs(q.x),abs(q.y));
  d=min(d,distanceToTrap);
 }
 return .5+.5*cos(d*scale*35.0+phase*8.0);
}
