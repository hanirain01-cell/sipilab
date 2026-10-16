/* ======================================================================
   MESIN 3D MINI (WebGL, tanpa library) – bayangan, orbit, picking
   ====================================================================== */
const G3=(()=>{
const D2R=Math.PI/180;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], mulS=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
function hex(h){h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.substr(i,2),16)/255);}
const mat=(c,m,g,k=0)=>({c:hex(c),m,g,k});
const MT={
  paint:(c,g=.75)=>mat(c,0,g), metal:(c='#a8afb7',g=.6)=>mat(c,1,g), chrome:()=>mat('#eef1f4',1,.93),
  rubber:(c='#1d1e21')=>mat(c,0,.2), plastic:(c,g=.45)=>mat(c,0,g), glass:(c='#dcefff')=>mat(c,0,.95,2),
  glow:c=>mat(c,0,0,3), ground:(c='#e3e8ee')=>mat(c,0,.1,1), wood:(c='#a8743f')=>mat(c,0,.3)
};
/* ---------- transformasi ---------- */
function rotE(v,r){
  let [x,y,z]=v;
  if(r[0]){const c=Math.cos(r[0]*D2R),s=Math.sin(r[0]*D2R);[y,z]=[y*c-z*s,y*s+z*c];}
  if(r[1]){const c=Math.cos(r[1]*D2R),s=Math.sin(r[1]*D2R);[x,z]=[x*c+z*s,-x*s+z*c];}
  if(r[2]){const c=Math.cos(r[2]*D2R),s=Math.sin(r[2]*D2R);[x,y]=[x*c-y*s,x*s+y*c];}
  return [x,y,z];
}
const rotB=(v,B)=>[B[0][0]*v[0]+B[1][0]*v[1]+B[2][0]*v[2],B[0][1]*v[0]+B[1][1]*v[1]+B[2][1]*v[2],B[0][2]*v[0]+B[1][2]*v[1]+B[2][2]*v[2]];
function aP(p,tf){let q=tf.s?[p[0]*tf.s[0],p[1]*tf.s[1],p[2]*tf.s[2]]:p; if(tf.B)q=rotB(q,tf.B); else if(tf.r)q=rotE(q,tf.r); return tf.t?add(q,tf.t):q;}
function aN(n,tf){let q=tf.s?[n[0]/tf.s[0],n[1]/tf.s[1],n[2]/tf.s[2]]:n; if(tf.B)q=rotB(q,tf.B); else if(tf.r)q=rotE(q,tf.r); return q;}
/* ---------- primitif ---------- */
function earcut(pts){
  const idx=[...pts.keys()],out=[];let guard=0;
  const a2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const ins=(p,a,b,c)=>a2(a,b,p)>=-1e-12&&a2(b,c,p)>=-1e-12&&a2(c,a,p)>=-1e-12;
  while(idx.length>3&&guard++<4000){
    let cut=false;
    for(let i=0;i<idx.length;i++){
      const ia=idx[(i+idx.length-1)%idx.length],ib=idx[i],ic=idx[(i+1)%idx.length],a=pts[ia],b=pts[ib],c=pts[ic];
      if(a2(a,b,c)<=1e-12) continue;
      let ok=true; for(const j of idx){ if(j===ia||j===ib||j===ic) continue; if(ins(pts[j],a,b,c)){ok=false;break;} }
      if(ok){out.push([ia,ib,ic]);idx.splice(i,1);cut=true;break;}
    }
    if(!cut) break;
  }
  if(idx.length===3) out.push(idx.slice());
  return out;
}
const P={
  box(w,h,d){const x=w/2,y=h/2,z=d/2,o=[];const f=(n,a,b,c,e)=>o.push([a,n],[b,n],[c,n],[a,n],[c,n],[e,n]);
    f([0,0,1],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]); f([0,0,-1],[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]);
    f([1,0,0],[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]); f([-1,0,0],[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]);
    f([0,1,0],[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]); f([0,-1,0],[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]); return o;},
  cyl(rt,rb,h,seg=28,caps=true,smooth=true){const o=[],y0=-h/2,y1=h/2,ny=(rb-rt)/h;
    for(let i=0;i<seg;i++){const a0=i/seg*2*Math.PI,a1=(i+1)/seg*2*Math.PI,c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
      let n0=nrm([c0,ny,s0]),n1=nrm([c1,ny,s1]); if(!smooth){const am=(a0+a1)/2;n0=n1=nrm([Math.cos(am),ny,Math.sin(am)]);}
      const A=[rb*c0,y0,rb*s0],B=[rb*c1,y0,rb*s1],C=[rt*c1,y1,rt*s1],D=[rt*c0,y1,rt*s0];
      o.push([A,n0],[B,n1],[C,n1],[A,n0],[C,n1],[D,n0]);
      if(caps){ if(rt>0)o.push([[0,y1,0],[0,1,0]],[D,[0,1,0]],[C,[0,1,0]]); if(rb>0)o.push([[0,y0,0],[0,-1,0]],[B,[0,-1,0]],[A,[0,-1,0]]); }
    } return o;},
  sph(r,seg=24,rings=16){const o=[];const pt=(i,j)=>{const th=j/rings*Math.PI,ph=i/seg*2*Math.PI,n=[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];return [[n[0]*r,n[1]*r,n[2]*r],n];};
    for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const a=pt(i,j),b=pt(i+1,j),c=pt(i+1,j+1),d=pt(i,j+1);o.push(a,b,c,a,c,d);} return o;},
  tor(R,r,seg=40,sides=14,arc=Math.PI*2){const o=[];const pt=(i,j)=>{const u=i/seg*arc,v=j/sides*2*Math.PI,cu=Math.cos(u),su=Math.sin(u);
      return [[(R+r*Math.cos(v))*cu,r*Math.sin(v),(R+r*Math.cos(v))*su],[Math.cos(v)*cu,Math.sin(v),Math.cos(v)*su]];};
    for(let i=0;i<seg;i++)for(let j=0;j<sides;j++){const a=pt(i,j),b=pt(i+1,j),c=pt(i+1,j+1),d=pt(i,j+1);o.push(a,b,c,a,c,d);} return o;},
  lathe(pts,seg=36){const o=[],n=pts.length,sn=[];
    for(let i=0;i<n-1;i++){const dr=pts[i+1][0]-pts[i][0],dy=pts[i+1][1]-pts[i][1],l=Math.hypot(dr,dy)||1;sn.push([dy/l,-dr/l]);}
    const sm=(a,b)=>(a[0]*b[0]+a[1]*b[1])>0.75?nrm([a[0]+b[0],a[1]+b[1],0]).slice(0,2):a;
    for(let k=0;k<n-1;k++){
      const n0=k>0?sm(sn[k],sn[k-1]):sn[k], n1=k<n-2?sm(sn[k],sn[k+1]):sn[k];
      for(let i=0;i<seg;i++){const a0=i/seg*2*Math.PI,a1=(i+1)/seg*2*Math.PI,c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
        const p=(pt,c,s)=>[pt[0]*c,pt[1],pt[0]*s], q=(nn,c,s)=>[nn[0]*c,nn[1],nn[0]*s];
        const A=[p(pts[k],c0,s0),q(n0,c0,s0)],B=[p(pts[k],c1,s1),q(n0,c1,s1)],C=[p(pts[k+1],c1,s1),q(n1,c1,s1)],D=[p(pts[k+1],c0,s0),q(n1,c0,s0)];
        o.push(A,B,C,A,C,D);}
    } return o;},
  ext(pts,d){let ar=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];ar+=a[0]*b[1]-b[0]*a[1];}
    if(ar<0)pts=pts.slice().reverse();
    const o=[],z=d/2,tr=earcut(pts);
    for(const [a,b,c] of tr){o.push([[...pts[a],z],[0,0,1]],[[...pts[b],z],[0,0,1]],[[...pts[c],z],[0,0,1]]);o.push([[...pts[a],-z],[0,0,-1]],[[...pts[c],-z],[0,0,-1]],[[...pts[b],-z],[0,0,-1]]);}
    for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],n=nrm([b[1]-a[1],-(b[0]-a[0]),0]);
      const A=[a[0],a[1],z],B=[b[0],b[1],z],C=[b[0],b[1],-z],D=[a[0],a[1],-z];o.push([A,n],[D,n],[C,n],[A,n],[C,n],[B,n]);}
    return o;}
};
/* ---------- pembangun geometri ---------- */
class Geo{
  constructor(){this.op=[];this.tr=[];this.st=[];this.lo=[1e9,1e9,1e9];this.hi=[-1e9,-1e9,-1e9];}
  push(tf){this.st.push(tf);return this;} pop(){this.st.pop();return this;}
  emit(vs,m,tf){const arr=(m.k===1||m.k===2||m.k===4)?this.tr:this.op;
    for(const [p,n] of vs){let Pp=tf?aP(p,tf):p,N=tf?aN(n,tf):n;
      for(let i=this.st.length-1;i>=0;i--){Pp=aP(Pp,this.st[i]);N=aN(N,this.st[i]);}
      N=nrm(N); arr.push(Pp[0],Pp[1],Pp[2],N[0],N[1],N[2],m.c[0],m.c[1],m.c[2],m.m,m.g,m.k);
      if(m.k!==1&&m.k!==4)for(let k=0;k<3;k++){if(Pp[k]<this.lo[k])this.lo[k]=Pp[k];if(Pp[k]>this.hi[k])this.hi[k]=Pp[k];}}
    return this;}
  box(w,h,d,m,t,r){return this.emit(P.box(w,h,d),m,{t,r});}
  cyl(rt,rb,h,m,t,r,seg=28,caps=true,smooth=true){return this.emit(P.cyl(rt,rb,h,seg,caps,smooth),m,{t,r});}
  sph(r,m,t,s,seg=24){return this.emit(P.sph(r,seg,Math.max(8,seg*2/3|0)),m,{t,s});}
  tor(R,r,m,t,rot,arc,seg=40,sides=12){return this.emit(P.tor(R,r,seg,sides,arc??Math.PI*2),m,{t,r:rot});}
  lathe(pts,m,t,r,seg=36){return this.emit(P.lathe(pts,seg),m,{t,r});}
  ext(pts,d,m,t,r){return this.emit(P.ext(pts,d),m,{t,r});}
  seg(a,b,rad,m,sides=14,caps=true){const dir=sub(b,a),L=Math.hypot(...dir);if(L<1e-6)return this;const y=nrm(dir);
    const x=nrm(cross(Math.abs(y[1])<.95?[0,1,0]:[1,0,0],y)),z=cross(x,y);
    return this.emit(P.cyl(rad,rad,L,sides,caps),m,{t:mulS(add(a,b),.5),B:[x,y,z]});}
  blob(rx,rz,t=[0,0,0],seg=32){const C={c:[0,0,0],m:0,g:0,k:4},E={c:[1,1,1],m:0,g:0,k:4},n=[0,1,0];
    for(let i=0;i<seg;i++){const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2;
      this.emit([[[t[0],t[1],t[2]],n]],C);this.emit([[[t[0]+Math.cos(a1)*rx,t[1],t[2]+Math.sin(a1)*rz],n],[[t[0]+Math.cos(a0)*rx,t[1],t[2]+Math.sin(a0)*rz],n]],E);}
    return this;}
  tube(pts,rad,m,sides=12){for(let i=0;i<pts.length-1;i++){this.seg(pts[i],pts[i+1],rad,m,sides,false);}
    for(let i=0;i<pts.length;i++)this.sph(rad,m,pts[i],null,sides);return this;}
}
/* ---------- matriks ---------- */
const M={
  persp(f,a,n,fa){const t=1/Math.tan(f/2);return new Float32Array([t/a,0,0,0,0,t,0,0,0,0,(fa+n)/(n-fa),-1,0,0,2*fa*n/(n-fa),0]);},
  ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);},
  look(e,c,u){const z=nrm(sub(e,c)),x=nrm(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1]);},
  mul(a,b){const o=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s;}return o;},
  inst(x,y,z,ry=0,s=1){const c=Math.cos(ry)*s,n=Math.sin(ry)*s;return new Float32Array([c,0,-n,0,0,s,0,0,n,0,c,0,x,y,z,1]);},
  tr(x,y,z){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);}
};
/* ---------- shader ---------- */
const VS=`attribute vec3 aPos;attribute vec3 aNor;attribute vec3 aCol;attribute vec3 aMat;
uniform mat4 uProj,uView,uModel,uLight;varying vec3 vW,vN,vC,vM;varying vec4 vL;
void main(){vec4 w=uModel*vec4(aPos,1.);vW=w.xyz;vN=mat3(uModel)*aNor;vC=aCol;vM=aMat;vL=uLight*w;gl_Position=uProj*uView*w;}`;
const FS=`precision highp float;
uniform vec3 uEye,uSun,uSky,uGnd,uCenter;uniform sampler2D uSM;uniform float uSMs,uFade,uExp;
varying vec3 vW,vN,vC,vM;varying vec4 vL;
float unpack(vec4 c){return dot(c,vec4(1.,1./255.,1./65025.,1./16581375.));}
float shadow(float ndl){vec3 p=vL.xyz/vL.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;
 float b=.0012+.003*(1.-ndl);float s=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=unpack(texture2D(uSM,p.xy+vec2(float(x),float(y))*1.5/uSMs));s+=(p.z-b>d)?0.:1.;}return s/9.;}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
 vec3 N=normalize(vN),V=normalize(uEye-vW);if(dot(N,V)<0.)N=-N;
 vec3 base=pow(vC,vec3(2.2));float metal=vM.x,gloss=vM.y,kind=vM.z;
 if(kind>3.5){float ba=(1.-vC.r)*.42;gl_FragColor=vec4(0.,0.,0.,ba);return;}
 if(kind>2.5){gl_FragColor=vec4(pow(aces(base*1.7*uExp),vec3(1./2.2)),1.);return;}
 vec3 L=normalize(uSun);float ndl=max(dot(N,L),0.);float sh=shadow(ndl);
 vec3 F=normalize(vec3(-uSun.x,.35,-uSun.z));float ndf=max(dot(N,F),0.);
 vec3 amb=mix(uGnd,uSky,N.y*.5+.5);
 vec3 R=reflect(-V,N);
 vec3 env=mix(uGnd*.5,uSky*1.25,smoothstep(-.25,.45,R.y))+vec3(1.6)*smoothstep(.6,.92,R.y)*gloss+vec3(.6)*smoothstep(.85,1.,dot(R,normalize(vec3(-.8,.3,.5))))*gloss;
 float fr=pow(1.-max(dot(N,V),0.),5.);
 vec3 f0=mix(vec3(.04),base,metal);vec3 kS=f0+(1.-f0)*fr*gloss*.8;
 vec3 H=normalize(L+V);float shin=exp2(gloss*10.+1.5);float spec=pow(max(dot(N,H),0.),shin)*(shin+8.)/30.;
 vec3 diff=base*(1.-metal);
 vec3 col=diff*(amb*.85+vec3(1.,.96,.9)*2.3*ndl*sh+vec3(.55,.62,.78)*.45*ndf)
  +kS*(env*mix(.3,1.,gloss)*(.45+.55*sh)+vec3(2.2)*spec*ndl*sh*gloss);
 float a=1.;
 if(kind>1.5){a=clamp(.16+fr*.75+spec*gloss*.25,0.,.95);}
 else if(kind>.5){float d=length(vW.xz-uCenter.xz);a=1.-smoothstep(uFade*.35,uFade,d);col=diff*(amb*.95+vec3(2.)*ndl*sh*.85);}
 col=pow(aces(col*uExp),vec3(1./2.2));
 gl_FragColor=vec4(col*a,a);}`;
const DVS=`attribute vec3 aPos;uniform mat4 uLight,uModel;void main(){gl_Position=uLight*uModel*vec4(aPos,1.);}`;
const DFS=`precision highp float;vec4 pack(float d){vec4 e=fract(vec4(1.,255.,65025.,16581375.)*d);e-=e.yzww*vec4(1./255.,1./255.,1./255.,0.);return e;}void main(){gl_FragColor=pack(gl_FragCoord.z);}`;

const BVS=`attribute vec3 aPos;uniform mat4 uProj,uView;uniform vec3 uP,uR;uniform vec2 uS;varying vec2 vUV;
void main(){vec3 p=uP+uR*(aPos.x-.5)*uS.x+vec3(0.,1.,0.)*aPos.y*uS.y;vUV=vec2(aPos.x,1.-aPos.y);gl_Position=uProj*uView*vec4(p,1.);}`;
const BFS=`precision mediump float;uniform sampler2D uT;uniform float uE;varying vec2 vUV;void main(){vec4 c=texture2D(uT,vUV);if(c.a<.45)discard;gl_FragColor=vec4(c.rgb*uE,1.);}`;
const TVS=`attribute vec3 aPos;attribute vec3 aNor;attribute vec2 aUV;attribute float aSh;
uniform mat4 uProj,uView,uModel,uLight;varying vec3 vW,vN;varying vec2 vUV;varying float vSh;varying vec4 vL;
void main(){vec4 w=uModel*vec4(aPos,1.);vW=w.xyz;vN=mat3(uModel)*aNor;vUV=aUV;vSh=aSh;vL=uLight*w;gl_Position=uProj*uView*w;}`;
const TFS=`precision highp float;
uniform vec3 uEye,uSun,uSky,uGnd;uniform sampler2D uSM,uT;uniform float uSMs,uExp,uGl;uniform vec4 uTint;
varying vec3 vW,vN;varying vec2 vUV;varying float vSh;varying vec4 vL;
float unpack(vec4 c){return dot(c,vec4(1.,1./255.,1./65025.,1./16581375.));}
float shadow(float ndl){vec3 p=vL.xyz/vL.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;
 float b=.0015+.003*(1.-ndl);float s=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=unpack(texture2D(uSM,p.xy+vec2(float(x),float(y))*1.5/uSMs));s+=(p.z-b>d)?0.:1.;}return s/9.;}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec4 tx=texture2D(uT,vUV)*uTint;if(tx.a<.35)discard;
 vec3 N=normalize(vN),V=normalize(uEye-vW);if(dot(N,V)<0.)N=-N;
 vec3 base=pow(tx.rgb,vec3(2.2))*vSh;vec3 L=normalize(uSun);float ndl=max(dot(N,L),0.);float sh=shadow(ndl);
 vec3 F=normalize(vec3(-uSun.x,.35,-uSun.z));float ndf=max(dot(N,F),0.);vec3 amb=mix(uGnd,uSky,N.y*.5+.5);
 vec3 H=normalize(L+V);float shin=exp2(uGl*9.+2.);float spec=pow(max(dot(N,H),0.),shin)*(shin+8.)/30.;float fr=pow(1.-max(dot(N,V),0.),5.);
 vec3 col=base*(amb*.95+vec3(1.,.96,.9)*2.1*ndl*sh+vec3(.55,.62,.78)*.45*ndf)+(vec3(.04)+vec3(.3)*fr)*uGl*(mix(uGnd,uSky,.7)*.6+vec3(2.2)*spec*ndl*sh);
 gl_FragColor=vec4(pow(aces(col*uExp),vec3(1./2.2)),1.);}`;
class View{
  constructor(cv,opt={}){
    this.cv=cv; this.opt=opt;
    const gl=this.gl=cv.getContext('webgl',{antialias:true,alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:!!opt.preserve});
    if(!gl) throw new Error('WebGL tidak tersedia');
    this.prog=this._prog(VS,FS); this.dprog=this._prog(DVS,DFS);
    this.U={}; ['uProj','uView','uModel','uLight','uEye','uSun','uSky','uGnd','uCenter','uSM','uSMs','uFade','uExp'].forEach(n=>this.U[n]=gl.getUniformLocation(this.prog,n));
    this.DU={uLight:gl.getUniformLocation(this.dprog,'uLight'),uModel:gl.getUniformLocation(this.dprog,'uModel')};
    this.SM=opt.smSize||2048; this.tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,this.tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.SM,this.SM,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST));
    [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE));
    this.fbo=gl.createFramebuffer(); const rb=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,rb);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,this.SM,this.SM);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.tex,0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    this.tprog=this._prog(TVS,TFS,['aPos','aNor','aUV','aSh']); this.TU={}; ['uProj','uView','uModel','uLight','uEye','uSun','uSky','uGnd','uSM','uT','uSMs','uExp','uGl','uTint'].forEach(n=>this.TU[n]=gl.getUniformLocation(this.tprog,n));
    this.tmc=new Map();
    this.bprog=this._prog(BVS,BFS); this.BU={}; ['uProj','uView','uP','uR','uS','uT','uE'].forEach(n=>this.BU[n]=gl.getUniformLocation(this.bprog,n));
    this.quad=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);
    const q=[0,0,0,1,0,0,1,1,0,0,0,0,1,1,0,0,1,0]; const qa=[]; for(let i=0;i<q.length;i+=3) qa.push(q[i],q[i+1],q[i+2],0,0,0,0,0,0,0,0,0);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(qa),gl.STATIC_DRAW); this.texs=new Map();
    this.cache=new Map(); this.objs=[];
    this.cam={t:[0,.3,0],yaw:.75,pitch:.42,dist:2,min:.2,max:30,fov:38};
    this.scene={center:[0,0,0],radius:1,sun:[-.6,.95,.45],sky:[.78,.84,.95],gnd:[.42,.4,.38],fade:3,exp:1};
    this.auto=opt.auto!==false; this.idle=0; this.dirty=true; this.anim=false; this._sz='';
    if(!opt.noInput) this._input();
  }
  _prog(vs,fs,names){const gl=this.gl,p=gl.createProgram();
    for(const [t,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}
    (names||['aPos','aNor','aCol','aMat']).forEach((n,i)=>gl.bindAttribLocation(p,i,n)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)); return p;}
  geo(key,build){
    if(this.cache.has(key)) return this.cache.get(key);
    const g=new Geo(); build(g); const gl=this.gl;
    const up=a=>{if(!a.length)return null;const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);return {b,n:a.length/12};};
    const r={op:up(g.op),tr:up(g.tr),lo:g.lo,hi:g.hi}; this.cache.set(key,r); return r;
  }
  photoTex(url){
    if(!url) return null; if(this.texs.has(url)) return this.texs.get(url);
    const gl=this.gl, T={t:null,ready:false,failed:false,aspect:1}; this.texs.set(url,T);
    const im=new Image(); if(!/^data:|^blob:/.test(url)) im.crossOrigin='anonymous';
    im.onload=()=>{ T.t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,T.t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
      [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR));
      [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE));
      T.aspect=im.naturalWidth/im.naturalHeight; T.ready=true; this.dirty=true; if(this.onTex) this.onTex(url); };
    im.onerror=()=>{T.failed=true;}; im.src=url; return T;
  }
  tmesh(key,data){ if(this.tmc.has(key)) return this.tmc.get(key); const gl=this.gl;
    const parts=data.parts.map(pt=>{ const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,pt.data,gl.STATIC_DRAW); return {b,n:pt.data.length/9,tex:pt.tex,tint:pt.tint||[1,1,1,1],gl:pt.gloss??.25}; });
    const r={parts,lo:data.lo,hi:data.hi}; this.tmc.set(key,r); return r; }
  _bindT(b,full){ const gl=this.gl; gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,36,0);
    if(full){ gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,36,12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,2,gl.FLOAT,false,36,24); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,1,gl.FLOAT,false,36,32); }
    else for(let i=1;i<4;i++) gl.disableVertexAttribArray(i); }
  _bind(buf,full){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buf.b);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,48,0);
    for(let i=1;i<4;i++){ if(full){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,48,i*12);} else gl.disableVertexAttribArray(i); }}
  eye(){const c=this.cam;return [c.t[0]+c.dist*Math.cos(c.pitch)*Math.sin(c.yaw),c.t[1]+c.dist*Math.sin(c.pitch),c.t[2]+c.dist*Math.cos(c.pitch)*Math.cos(c.yaw)];}
  size(){const cv=this.cv,dpr=Math.min(2,window.devicePixelRatio||1);let w=cv.clientWidth?Math.round(cv.clientWidth*dpr):cv.width,h=cv.clientHeight?Math.round(cv.clientHeight*dpr):cv.height;
    if(cv.clientWidth&&(cv.width!==w||cv.height!==h)){cv.width=w;cv.height=h;} return [cv.width,cv.height];}
  render(time=0){
    const gl=this.gl,S=this.scene,c=this.cam,[w,h]=this.size();
    if(this.auto&&!this.drag&&performance.now()-this.idle>2500) c.yaw+=0.0035;
    if(this.onFrame) this.onFrame(time);
    const eye=this.eye(),view=M.look(eye,c.t,[0,1,0]),proj=M.persp(c.fov*D2R,w/h,Math.max(.02,c.dist*.03),c.dist*6+S.radius*6);
    const sun=nrm(S.sun),R=S.radius,lpos=add(S.center,mulS(sun,R*2.5));
    const light=M.mul(M.ortho(-R,R,-R,R,R*.3,R*5),M.look(lpos,S.center,Math.abs(sun[1])>.98?[0,0,1]:[0,1,0]));
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    // bayangan
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo); gl.viewport(0,0,this.SM,this.SM); gl.clearColor(1,1,1,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.dprog); gl.uniformMatrix4fv(this.DU.uLight,false,light);
    for(const o of this.objs){ if(!o.g||!o.g.op||o.noShadow) continue; gl.uniformMatrix4fv(this.DU.uModel,false,o.m); this._bind(o.g.op,false); gl.drawArrays(gl.TRIANGLES,0,o.g.op.n); }
    for(const o of this.objs){ if(!o.tm||o.hidden) continue; gl.uniformMatrix4fv(this.DU.uModel,false,o.m); for(const pt of o.tm.parts){ this._bindT(pt.b,false); gl.drawArrays(gl.TRIANGLES,0,pt.n); } }
    // utama
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,w,h); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog); const U=this.U;
    gl.uniformMatrix4fv(U.uProj,false,proj); gl.uniformMatrix4fv(U.uView,false,view); gl.uniformMatrix4fv(U.uLight,false,light);
    gl.uniform3fv(U.uEye,eye); gl.uniform3fv(U.uSun,sun); gl.uniform3fv(U.uSky,S.sky); gl.uniform3fv(U.uGnd,S.gnd); gl.uniform3fv(U.uCenter,S.center);
    gl.uniform1f(U.uSMs,this.SM); gl.uniform1f(U.uFade,S.fade); gl.uniform1f(U.uExp,S.exp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.tex); gl.uniform1i(U.uSM,0);
    for(const o of this.objs){ if(!o.g||!o.g.op||o.hidden) continue; gl.uniformMatrix4fv(U.uModel,false,o.m); this._bind(o.g.op,true); gl.drawArrays(gl.TRIANGLES,0,o.g.op.n); }
    const tms=this.objs.filter(o=>o.tm&&!o.hidden);
    if(tms.length){ const T=this.TU; gl.useProgram(this.tprog);
      gl.uniformMatrix4fv(T.uProj,false,proj); gl.uniformMatrix4fv(T.uView,false,view); gl.uniformMatrix4fv(T.uLight,false,light);
      gl.uniform3fv(T.uEye,eye); gl.uniform3fv(T.uSun,sun); gl.uniform3fv(T.uSky,S.sky); gl.uniform3fv(T.uGnd,S.gnd); gl.uniform1f(T.uSMs,this.SM); gl.uniform1f(T.uExp,S.exp);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.tex); gl.uniform1i(T.uSM,0);
      for(const o of tms){ gl.uniformMatrix4fv(T.uModel,false,o.m);
        for(const pt of o.tm.parts){ const X=this.photoTex(pt.tex); if(!X||!X.ready) continue; gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,X.t); gl.uniform1i(T.uT,1);
          gl.uniform4fv(T.uTint,pt.tint); gl.uniform1f(T.uGl,pt.gl); this._bindT(pt.b,true); gl.drawArrays(gl.TRIANGLES,0,pt.n); } }
      gl.useProgram(this.prog); }
    const bbs=this.objs.filter(o=>o.bb&&!o.hidden);
    if(bbs.length){ const B=this.BU; gl.useProgram(this.bprog); gl.uniformMatrix4fv(B.uProj,false,proj); gl.uniformMatrix4fv(B.uView,false,view); gl.uniform1f(B.uE,S.exp);
      const f=sub(c.t,eye), rt=nrm([-f[2],0,f[0]]); gl.uniform3fv(B.uR,[-rt[0],0,-rt[2]]);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,48,0); for(let i=1;i<4;i++) gl.disableVertexAttribArray(i);
      for(const o of bbs){ const T=this.photoTex(o.bb.url); if(!T||!T.ready) continue; gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,T.t); gl.uniform1i(B.uT,1);
        gl.uniform3fv(B.uP,o.bb.pos); gl.uniform2fv(B.uS,[o.bb.h*T.aspect,o.bb.h]); gl.drawArrays(gl.TRIANGLES,0,6); }
      gl.useProgram(this.prog); }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for(const o of this.objs){ if(!o.g||!o.g.tr||o.hidden) continue; gl.uniformMatrix4fv(U.uModel,false,o.m); this._bind(o.g.tr,true); gl.drawArrays(gl.TRIANGLES,0,o.g.tr.n); }
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  invalidate(){ this.dirty=true; }
  start(){ if(this.running) return; this.running=true; this.dirty=true;
    const loop=t=>{ if(!this.running) return;
      if(this.cv.isConnected&&this.cv.offsetParent!==null){ const sz=this.cv.clientWidth+'x'+this.cv.clientHeight;
        if(sz!==this._sz){ this._sz=sz; this.dirty=true; }
        if(this.dirty||this.anim||(this.auto&&!this.drag&&performance.now()-this.idle>2500)){ this.dirty=false; this.render(t); } }
      this.raf=requestAnimationFrame(loop); };
    this.raf=requestAnimationFrame(loop); }
  stop(){ this.running=false; cancelAnimationFrame(this.raf); }
  ray(px,py){ const c=this.cam,r=this.cv.getBoundingClientRect(),x=((px-r.left)/r.width)*2-1,y=1-((py-r.top)/r.height)*2;
    const e=this.eye(),f=nrm(sub(c.t,e)),rt=nrm(cross(f,[0,1,0])),u=cross(rt,f),th=Math.tan(c.fov*D2R/2),asp=r.width/r.height;
    return {o:e,d:nrm(add(f,add(mulS(rt,x*th*asp),mulS(u,y*th))))}; }
  rayPlane(px,py,y=0){ const {o,d}=this.ray(px,py); if(Math.abs(d[1])<1e-6) return null; const t=(y-o[1])/d[1]; return t>0?[o[0]+d[0]*t,y,o[2]+d[2]*t]:null; }
  pick(px,py){ const {o,d}=this.ray(px,py); let best=null,bt=1e9,bp=-1;
    for(const ob of this.objs){ if(!ob.pick||ob.hidden) continue; const oc=sub(ob.pick.c,o),t=dot(oc,d); if(t<0) continue;
      const d2=dot(oc,oc)-t*t, pr=ob.pick.prio||0; if(d2<ob.pick.r*ob.pick.r&&(pr>bp||(pr===bp&&t<bt))){bt=t;best=ob;bp=pr;} } return best; }
  _input(){
    const cv=this.cv,c=this.cam,pts=new Map();let moved=0,pinch=0;
    cv.style.touchAction='none';
    cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);
      if(pts.size===0&&e.button===0&&this.onDown&&this.onDown(e)){this.objDrag=e.pointerId;this.idle=performance.now();return;}
      pts.set(e.pointerId,[e.clientX,e.clientY]);moved=0;this.drag=true;this.idle=performance.now();this.btn=e.button;
      if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);}});
    cv.addEventListener('pointermove',e=>{
      if(this.objDrag===e.pointerId){ if(this.onDragMove) this.onDragMove(e); this.dirty=true; return; }
      if(!pts.has(e.pointerId)){ if(this.onHover) this.onHover(this.pick(e.clientX,e.clientY),e); return; }
      const p=pts.get(e.pointerId),dx=e.clientX-p[0],dy=e.clientY-p[1]; pts.set(e.pointerId,[e.clientX,e.clientY]); moved+=Math.abs(dx)+Math.abs(dy); this.idle=performance.now();
      if(pts.size===2){const [a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]); if(pinch) c.dist=Math.min(c.max,Math.max(c.min,c.dist*pinch/d)); this.dirty=true; pinch=d; return;}
      if(this.btn===2||e.shiftKey){ const yaw=c.yaw,k=c.dist*.0015; this.dirty=true; c.t[0]+=(-Math.cos(yaw)*dx-Math.sin(yaw)*dy)*k; c.t[2]+=(Math.sin(yaw)*dx-Math.cos(yaw)*dy)*k; if(this.bounds){const B=this.bounds;c.t[0]=Math.max(-B,Math.min(B,c.t[0]));c.t[2]=Math.max(-B,Math.min(B,c.t[2]));} return; }
      c.yaw-=dx*.008; c.pitch=Math.min(1.45,Math.max(.05,c.pitch+dy*.006)); this.dirty=true;});
    const up=e=>{ if(this.objDrag===e.pointerId){ this.objDrag=null; if(this.onDragEnd) this.onDragEnd(e); return; } if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if(pts.size<2) pinch=0; if(!pts.size){this.drag=false;
      if(moved<6&&this.onPick) this.onPick(this.pick(e.clientX,e.clientY),e);} };
    cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
    cv.addEventListener('pointerleave',()=>{ if(this.onHover&&!pts.size) this.onHover(null); });
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    cv.addEventListener('wheel',e=>{e.preventDefault();this.idle=performance.now();c.dist=Math.min(c.max,Math.max(c.min,c.dist*Math.pow(1.0015,e.deltaY))); this.dirty=true;},{passive:false});
  }
}
return {Geo,View,MT,M,P,rotE,mul:M.mul};
})();

/* ======================================================================
   MODEL 3D ALAT
   ====================================================================== */
const MODELS={};
function defModel(key,name,place,build){MODELS[key]={key,name,place,build};}
const MT=G3.MT;

function wheelY(g,R=.31,W=.2,rimC='#c9ced4',spokes=5){
  const ri=R*.64,hw=W/2;
  g.lathe([[ri,-hw*.9],[ri+R*.06,-hw],[R*.86,-hw*1.03],[R*.96,-hw*.96],[R,-hw*.72],[R*1.005,0],[R,hw*.72],[R*.96,hw*.96],[R*.86,hw*1.03],[ri+R*.06,hw],[ri,hw*.9]],MT.rubber('#1f2023'),null,null,56);
  const n=Math.max(24,Math.round(R*110));
  for(let i=0;i<n;i++){const a=i/n*360;for(const s of [-1,1]){g.push({r:[0,a+(s>0?180/n:0),0]});g.box(R*.035,W*.36,R*.075,MT.rubber('#2a2b2f'),[R*.992,s*W*.21,0]);g.pop();}}
  g.cyl(ri,ri,W*.9,MT.metal('#34373c',.35),[0,0,0],null,40,false);
  g.cyl(ri*.97,ri*.97,.004,MT.paint('#202227',.3),[0,-hw*.25,0]);
  g.tor(ri*.99,R*.028,MT.metal(rimC,.85),[0,hw*.86,0]);
  for(let k=0;k<spokes;k++){g.push({r:[0,k*360/spokes,0]});g.box(ri*.92,W*.12,R*.13,MT.metal(rimC,.85),[ri*.52,hw*.62,0]);g.box(ri*.5,W*.1,R*.05,MT.metal(rimC,.85),[ri*.7,hw*.5,R*.09],[0,-12,0]);g.pop();}
  g.cyl(R*.21,R*.24,W*.22,MT.metal(rimC,.85),[0,hw*.6,0]);
  g.cyl(R*.09,R*.1,W*.12,MT.chrome(),[0,hw*.78,0]);
  for(let k=0;k<spokes;k++){const a=(k+.5)/spokes*Math.PI*2;g.cyl(R*.025,R*.025,W*.1,MT.chrome(),[Math.cos(a)*R*.15,hw*.74,Math.sin(a)*R*.15],null,6);}
}
function batteryAt(g,t=[0,0,0],s=1){
  g.push({t,s:[s,s,s]});
  g.box(.24,.18,.17,MT.plastic('#202124',.35),[0,.09,0]);
  g.box(.245,.02,.175,MT.plastic('#3a3c40',.4),[0,.19,0]);
  g.box(.16,.07,.002,MT.paint('#1d4ed8',.5),[0,.1,.086]); g.box(.16,.012,.003,MT.paint('#f8fafc',.5),[0,.12,.087]);
  g.cyl(.013,.013,.025,MT.metal('#9ca3af',.5),[-.08,.21,.04]); g.cyl(.013,.013,.025,MT.metal('#9ca3af',.5),[.08,.21,.04]);
  g.cyl(.022,.026,.02,MT.plastic('#dc2626',.6),[.08,.205,.04]); g.cyl(.022,.026,.02,MT.plastic('#111',.6),[-.08,.205,.04]);
  g.tube([[-.06,.2,-.03],[-.04,.25,-.03],[.04,.25,-.03],[.06,.2,-.03]],.008,MT.plastic('#111',.4));
  g.pop();
}
/* ---------- OTOMOTIF ---------- */
defModel('engine','Engine Stand / Trainer Mesin','floor',g=>{
  const fr=MT.paint('#1e40af',.6), red=MT.paint('#c81e1e',.85), blk=MT.plastic('#1b1c1f',.4), alu=MT.metal('#b9bec4',.55), iron=MT.metal('#5f656d',.45);
  // rangka stand
  for(const x of [-.4,.4]) g.box(.05,.05,1,fr,[x,.1,0]);
  for(const z of [-.45,.45]) g.box(.85,.05,.05,fr,[0,.1,z]);
  for(const [x,z] of [[-.4,-.45],[.4,-.45],[-.4,.45],[.4,.45]]){g.box(.04,.04,.04,iron,[x,.06,z]);g.cyl(.035,.035,.03,MT.rubber(),[x,.035,z],[90,0,0]);}
  for(const x of [-.3,.3]){g.box(.06,.42,.06,fr,[x,.32,0]);g.box(.16,.03,.12,fr,[x,.54,0]);}
  // blok mesin
  g.box(.56,.3,.34,iron,[0,.7,0]);
  for(let i=0;i<4;i++) g.box(.02,.24,.36,iron,[-.21+i*.14,.7,0]);
  g.box(.5,.09,.28,MT.metal('#4b5057',.5),[0,.51,0]);
  g.box(.56,.12,.3,alu,[0,.91,0]);
  g.box(.52,.07,.25,red,[0,1.005,0]);
  for(let i=0;i<4;i++){const x=-.18+i*.12;g.cyl(.024,.024,.07,blk,[x,1.07,0]);g.box(.05,.02,.07,blk,[x,1.11,.0]);}
  g.cyl(.025,.025,.03,MT.plastic('#facc15',.6),[.2,1.05,.07]);
  // intake (depan)
  for(let i=0;i<4;i++){const x=-.18+i*.12;g.tube([[x,.9,.15],[x,.93,.24],[x,.86,.32],[x,.74,.34]],.026,blk);}
  g.cyl(.06,.06,.52,blk,[0,.72,.36],[0,0,90]); g.cyl(.045,.045,.1,alu,[.3,.72,.36],[0,0,90]);
  // exhaust (belakang)
  const rust=MT.metal('#8a5a3c',.35);
  for(let i=0;i<4;i++){const x=-.18+i*.12;g.tube([[x,.86,-.15],[x,.84,-.24],[x*.4,.74,-.29],[0,.64,-.3]],.022,rust);}
  g.tube([[0,.64,-.3],[0,.5,-.32],[-.2,.42,-.34]],.035,rust);
  // depan mesin: puli & alternator
  g.box(.03,.42,.3,alu,[.295,.72,0]);
  g.cyl(.075,.075,.04,iron,[.33,.56,0],[0,0,90]); g.cyl(.05,.05,.035,iron,[.33,.8,-.08],[0,0,90]);
  g.cyl(.06,.06,.11,alu,[.34,.83,.13],[0,0,90]); g.cyl(.035,.035,.03,iron,[.4,.83,.13],[0,0,90]);
  g.seg([.345,.63,0],[.345,.86,.12],.01,blk,8); g.seg([.345,.5,0],[.345,.78,-.12],.01,blk,8); g.seg([.345,.86,.12],[.345,.85,-.05],.01,blk,8);
  // flywheel & starter
  g.cyl(.15,.15,.03,MT.metal('#7c838c',.6),[-.3,.62,0],[0,0,90]); g.cyl(.04,.04,.16,iron,[-.25,.55,.17],[0,0,90]);
  // filter oli
  g.cyl(.04,.04,.09,MT.paint('#ea580c',.6),[.12,.55,.2],[90,0,0]);
  // radiator + kipas
  g.box(.04,.4,.38,MT.metal('#2f3338',.4),[.62,.7,0]); g.box(.03,.34,.32,MT.metal('#6b7280',.3),[.645,.7,0]);
  g.box(.12,.04,.04,fr,[.56,.48,0]); g.cyl(.12,.12,.02,blk,[.58,.7,0],[0,0,90]);
  // panel instrumen
  g.box(.04,.5,.04,fr,[-.42,.4,.42]); g.box(.36,.24,.04,MT.paint('#e5e7eb',.5),[-.3,.72,.44]);
  g.cyl(.04,.04,.01,MT.glow('#f8fafc'),[-.4,.75,.465],[90,0,0]); g.cyl(.04,.04,.01,MT.glow('#f8fafc'),[-.29,.75,.465],[90,0,0]);
  g.box(.002,.035,.003,MT.glow('#dc2626'),[-.4,.765,.472],[0,0,35]); g.box(.002,.035,.003,MT.glow('#dc2626'),[-.29,.765,.472],[0,0,-30]);
  g.cyl(.012,.012,.02,MT.glow('#22c55e'),[-.18,.75,.47],[90,0,0]); g.cyl(.012,.012,.02,MT.glow('#ef4444'),[-.18,.7,.47],[90,0,0]);
  g.box(.12,.025,.005,MT.glow('#38bdf8'),[-.34,.66,.465]);
  batteryAt(g,[-.18,.125,-.22],.9);
});
defModel('jack','Dongkrak Buaya (Floor Jack)','floor',g=>{
  const red=MT.paint('#d11a1a',.8), stl=MT.metal('#6b7280',.5);
  const prof=[[-.34,.05],[.32,.05],[.34,.1],[.22,.17],[-.28,.17],[-.36,.12]];
  for(const x of [-.12,.12]) g.ext(prof,.014,red,[x,0,0],[0,90,0]);
  g.box(.24,.02,.5,red,[0,.16,-.04]);
  g.box(.25,.05,.06,red,[0,.08,-.3]);
  for(const x of [-.135,.135]) g.cyl(.045,.045,.03,stl,[x,.045,.27],[0,0,90]);
  for(const x of [-.1,.1]){g.box(.03,.03,.03,stl,[x,.04,-.3]);g.cyl(.025,.025,.02,MT.rubber(),[x,.026,-.31],[0,0,90]);}
  g.push({t:[0,.15,-.2],r:[-10,0,0]}); g.box(.16,.035,.5,red,[0,0,.25]); g.pop();
  g.cyl(.06,.055,.035,MT.chrome(),[0,.255,.29]); g.cyl(.045,.045,.01,MT.rubber(),[0,.275,.29]);
  g.seg([0,.08,-.12],[0,.15,.08],.032,MT.chrome());
  g.cyl(.045,.045,.12,stl,[0,.1,-.24],[90,0,0]);
  g.tube([[0,.13,-.3],[0,.24,-.42],[0,.62,-.92]],.018,red); g.seg([0,.52,-.79],[0,.7,-1.03],.024,MT.rubber());
  g.box(.002,.04,.12,MT.paint('#facc15',.6),[.128,.11,.05]);
});
defModel('jackstand','Jack Stand (sepasang)','floor',g=>{
  const org=MT.paint('#ea580c',.75);
  for(const ox of [-.2,.2]){ g.push({t:[ox,0,0]});
    for(const [x,z] of [[-.13,-.13],[.13,-.13],[.13,.13],[-.13,.13]]) g.seg([x,.005,z],[x*.25,.3,z*.25],.014,org,8);
    for(const s of [-1,1]){g.seg([-.11,.06,s*.11],[.11,.06,s*.11],.008,org,8);g.seg([s*.11,.06,-.11],[s*.11,.06,.11],.008,org,8);}
    g.box(.08,.06,.08,org,[0,.3,0]); g.box(.04,.26,.04,MT.chrome(),[0,.42,0]);
    for(let i=0;i<7;i++) g.box(.045,.008,.012,MT.metal('#9ca3af',.6),[0,.34+i*.03,.022]);
    g.box(.11,.02,.06,MT.chrome(),[0,.555,0]); for(const s of [-1,1]) g.box(.015,.05,.06,MT.chrome(),[s*.05,.58,0]);
    g.seg([.04,.31,.05],[.12,.36,.08],.01,MT.paint('#111827',.5),6);
    g.pop(); }
});
defModel('torque','Kunci Momen (Torque Wrench)','bench',g=>{
  g.push({t:[0,.024,0]});
  g.seg([-.24,0,0],[.2,0,0],.014,MT.chrome());
  g.seg([.2,0,0],[.36,0,0],.02,MT.rubber('#111')); for(let i=0;i<5;i++) g.tor(.0205,.003,MT.paint('#c81e1e',.6),[.22+i*.032,0,0],[0,0,90],null,24,6);
  g.cyl(.02,.02,.01,MT.paint('#c81e1e',.6),[.365,0,0],[0,0,90]);
  g.box(.05,.008,.016,MT.glow('#f1f5f9'),[.1,.012,0]); g.box(.002,.009,.016,MT.glow('#111'),[.09,.013,0]);
  g.box(.06,.02,.025,MT.chrome(),[-.27,0,0]); g.cyl(.03,.03,.026,MT.chrome(),[-.31,0,0]); g.cyl(.012,.012,.006,MT.metal('#888'),[-.31,.016,0]);
  g.box(.014,.014,.014,MT.metal('#9ca3af'),[-.31,-.018,0]);
  g.pop();
  g.box(.7,.02,.09,MT.plastic('#111827',.3),[.03,-.0,0]); g.box(.7,.002,.07,MT.plastic('#7f1d1d',.2),[.03,.011,0]);
});
defModel('impact','Impact Wrench','bench',g=>{
  const body=MT.plastic('#2b2d31',.5), acc=MT.paint('#f97316',.6);
  g.box(.08,.06,.11,acc,[0,.03,0]); g.box(.082,.012,.112,MT.plastic('#111',.3),[0,.065,0]);
  g.push({t:[0,.07,-.01],r:[12,0,0]}); g.box(.04,.13,.05,MT.rubber('#18191c'),[0,.07,0]); g.pop();
  g.cyl(.045,.045,.16,body,[0,.19,.03],[90,0,0]); g.cyl(.047,.047,.03,acc,[0,.19,-.02],[90,0,0]);
  g.cyl(.04,.045,.02,MT.plastic('#111',.4),[0,.19,-.06],[90,0,0]);
  g.cyl(.03,.04,.05,MT.metal('#9aa1a9',.6),[0,.19,.135],[90,0,0]);
  g.box(.014,.014,.03,MT.chrome(),[0,.19,.17]); g.cyl(.018,.018,.04,MT.chrome(),[0,.19,.2],[90,0,0]);
  g.box(.012,.03,.02,MT.plastic('#111',.5),[0,.14,.035]);
});
defModel('compressor','Kompresor Udara','floor',g=>{
  const red=MT.paint('#c81e1e',.85), blk=MT.plastic('#1f2023',.4), stl=MT.metal('#8b939c',.55);
  g.cyl(.17,.17,.6,red,[0,.3,0],[0,0,90],40); for(const x of [-.3,.3]) g.sph(.17,red,[x,.3,0],[.35,1,1],32);
  for(const z of [-.15,.15]) g.cyl(.09,.09,.06,MT.rubber(),[.25,.09,z],[90,0,0]); g.cyl(.05,.05,.07,stl,[.25,.09,0],[90,0,0]);
  for(const z of [-.12,.12]){g.box(.04,.1,.04,stl,[-.28,.06,z]);g.box(.06,.01,.06,MT.rubber(),[-.28,.006,z]);}
  g.box(.5,.02,.24,stl,[0,.475,0]);
  g.cyl(.085,.085,.2,blk,[-.1,.57,0],[0,0,90]); for(let i=0;i<6;i++) g.box(.012,.17,.17,MT.metal('#2f3236',.4),[-.17+i*.028,.57,0]);
  g.box(.05,.16,.22,red,[.04,.57,0]);
  for(let i=0;i<7;i++) g.cyl(.065,.065,.01,MT.metal('#a7aeb6',.5),[.16,.52+i*.022,0]); g.cyl(.05,.05,.04,stl,[.16,.68,0]);
  g.seg([.16,.6,0],[.33,.45,.0],.012,MT.metal('#b08d57',.7),8);
  g.box(.02,.08,.02,stl,[.33,.42,.12]); g.cyl(.045,.045,.02,MT.chrome(),[.33,.5,.13],[90,0,0]); g.cyl(.038,.038,.022,MT.glow('#f8fafc'),[.33,.5,.135],[90,0,0]); g.box(.002,.03,.003,MT.glow('#dc2626'),[.335,.505,.147],[0,0,-40]);
  g.tube([[-.28,.48,-.12],[-.38,.65,-.12],[-.38,.65,.12],[-.28,.48,.12]],.012,blk);
  for(let i=0;i<3;i++) g.tor(.13,.012,MT.plastic('#facc15',.55),[.0,.02+i*.024,.34]);
});
defModel('toolbox','Troli Perkakas (Tool Trolley)','floor',g=>{
  const red=MT.paint('#c81e1e',.8), chr=MT.chrome(), gap=MT.plastic('#111',.3);
  g.box(.72,.7,.46,red,[0,.45,0]);
  const hs=[.1,.1,.12,.14,.2]; let y=.79;
  for(const h of hs){ y-=h; g.box(.68,.006,.005,gap,[0,y,.231]); g.box(.3,.018,.02,chr,[0,y+h/2,.24]); }
  g.box(.73,.02,.47,MT.rubber('#111'),[0,.81,0]);
  g.box(.72,.28,.44,red,[0,.96,-.01]); g.box(.74,.03,.46,red,[0,1.115,-.01]);
  for(let i=0;i<3;i++){g.box(.68,.006,.005,gap,[0,.88+i*.07,.211]);g.box(.2,.015,.018,chr,[0,.9+i*.07,.22]);}
  for(const s of [-1,1]) g.tube([[s*.37,.55,-.16],[s*.42,.55,-.16],[s*.42,.55,.16],[s*.37,.55,.16]],.012,chr);
  for(const [x,z] of [[-.3,-.18],[.3,-.18],[-.3,.18],[.3,.18]]){g.box(.05,.03,.05,MT.metal('#555'),[x,.085,z]);g.cyl(.045,.045,.035,MT.rubber(),[x,.045,z],[90,0,0]);}
  g.box(.2,.04,.002,MT.paint('#f8fafc',.4),[-.2,.95,.211]);
});
defModel('wheel','Ban & Velg','floor',g=>{ g.push({t:[0,.31,0],r:[0,0,-90]}); wheelY(g,.31,.2,'#d0d5da'); g.pop(); });
defModel('battery','Aki / Baterai 12V','bench',g=>batteryAt(g));
defModel('obd','Scanner OBD-II','bench',g=>{
  const org=MT.rubber('#f59e0b');
  g.push({t:[0,.03,0],r:[-72,0,0]});
  g.box(.13,.22,.04,org,[0,0,0]); g.box(.11,.2,.042,MT.plastic('#27272a',.5),[0,0,.002]);
  g.box(.095,.08,.01,MT.glow('#38bdf8'),[0,.045,.02]); g.box(.07,.006,.012,MT.glow('#e0f2fe'),[0,.07,.021]); g.box(.05,.006,.012,MT.glow('#e0f2fe'),[-.01,.055,.021]);
  for(const [x,y,c] of [[0,-.04,'#e5e7eb'],[-.03,-.04,'#e5e7eb'],[.03,-.04,'#e5e7eb'],[0,-.07,'#e5e7eb'],[0,-.01,'#e5e7eb'],[-.035,-.08,'#ef4444'],[.035,-.08,'#22c55e']])
    g.cyl(.009,.009,.01,MT.plastic(c,.6),[x,y,.024],[90,0,0]);
  g.pop();
  g.tube([[0,.02,-.11],[0,.02,-.2],[.12,.012,-.24],[.2,.012,-.12],[.2,.012,0]],.006,MT.rubber());
  g.box(.05,.025,.035,MT.plastic('#18181b',.4),[.2,.014,.03]); g.box(.04,.02,.02,MT.plastic('#3f3f46',.4),[.2,.014,.055]);
});
defModel('sparkplug','Set Busi (Spark Plug)','bench',g=>{
  g.box(.24,.02,.08,MT.plastic('#1f2937',.3),[0,.01,0]);
  for(let i=0;i<4;i++){ g.push({t:[-.09+i*.06,.02,0]});
    g.cyl(.006,.006,.012,MT.metal('#9ca3af'),[0,.0,0]); g.cyl(.008,.008,.02,MT.metal('#b7bcc2',.5),[0,.016,0],null,16);
    g.cyl(.011,.011,.012,MT.chrome(),[0,.032,0],null,6,true,false);
    g.lathe([[.009,.038],[.0095,.05],[.0085,.055],[.0092,.06],[.008,.065],[.0088,.07],[.0075,.075],[.0082,.08],[.0065,.088],[.006,.092]],MT.plastic('#f8fafc',.8),null,null,20);
    g.cyl(.0035,.0035,.012,MT.metal('#6b7280'),[0,.097,0]); g.cyl(.005,.005,.006,MT.metal('#9ca3af'),[0,.105,0]);
    g.pop(); }
});
defModel('multimeter','Multimeter Digital','bench',g=>{
  g.push({t:[0,.04,0],r:[-75,0,0]});
  g.box(.1,.19,.045,MT.rubber('#facc15'),[0,0,0]); g.box(.085,.17,.046,MT.plastic('#27272a',.4),[0,0,.001]);
  g.box(.065,.04,.01,MT.glow('#c7d2a7'),[0,.05,.022]);
  for(const x of [-.018,0,.018]) g.box(.01,.022,.004,MT.glow('#111'),[x,.05,.0275]);
  g.cyl(.026,.026,.012,MT.plastic('#111',.5),[0,-.01,.025],[90,0,0]); g.box(.005,.022,.006,MT.plastic('#f8fafc'),[0,-.0,.032],[0,0,-30]);
  for(const [x,c] of [[-.03,'#111'],[0,'#111'],[.03,'#ef4444']]) g.cyl(.006,.006,.006,MT.plastic(c),[x,-.065,.026],[90,0,0]);
  g.pop();
  g.tube([[.03,.012,-.06],[.06,.006,-.12],[.15,.006,-.1],[.2,.006,.0]],.0035,MT.rubber('#dc2626'));
  g.tube([[0,.012,-.06],[.02,.006,-.14],[.12,.006,-.17],[.22,.006,-.06]],.0035,MT.rubber('#111'));
  g.seg([.2,.008,0],[.22,.008,.09],.006,MT.plastic('#dc2626',.5)); g.seg([.22,.008,.09],[.225,.008,.12],.0015,MT.chrome());
  g.seg([.22,.008,-.06],[.27,.008,.02],.006,MT.plastic('#111',.5)); g.seg([.27,.008,.02],[.29,.008,.045],.0015,MT.chrome());
});
defModel('caliper','Jangka Sorong','bench',g=>{
  const s=MT.metal('#d1d5db',.8);
  g.box(.42,.025,.11,MT.plastic('#0f172a',.3),[.0,.0125,0]); g.box(.4,.004,.09,MT.plastic('#1e3a8a',.2),[0,.027,0]);
  g.push({t:[0,.034,0]});
  g.box(.3,.004,.018,s,[0,0,0]); for(let i=0;i<30;i++) g.box(.0008,.0045,i%5?.004:.007,MT.glow('#111'),[-.13+i*.009,.0003,-.006]);
  g.ext([[-.15,-.009],[-.13,-.009],[-.13,-.07],[-.142,-.075],[-.15,-.07]],.004,s,[0,0,0],[90,0,0]);
  g.ext([[-.15,.009],[-.14,.009],[-.14,.035],[-.15,.03]],.004,s,[0,0,0],[90,0,0]);
  g.box(.05,.007,.03,s,[-.08,.0,0]);
  g.ext([[-.105,-.012],[-.095,-.012],[-.095,-.072],[-.1,-.075],[-.105,-.07]],.004,s,[0,0,0],[90,0,0]);
  g.ext([[-.105,.012],[-.098,.012],[-.098,.035],[-.105,.031]],.004,s,[0,0,0],[90,0,0]);
  g.cyl(.006,.006,.004,MT.metal('#9ca3af'),[-.068,.003,-.018]);
  g.box(.03,.0015,.012,MT.glow('#e5e7eb'),[-.08,.0042,.002]);
  g.box(.12,.002,.002,s,[.21,0,.007]);
  g.pop();
});
defModel('wrenchset','Set Kunci Kombinasi','bench',g=>{
  g.box(.5,.025,.28,MT.plastic('#7f1d1d',.25),[0,.0125,0]); g.box(.48,.004,.26,MT.plastic('#111827',.2),[0,.026,0]);
  for(let i=0;i<9;i++){ const sz=.6+i*.06, x=-.2+i*.05, L=.17*sz+.06;
    g.push({t:[x,.032,0],r:[0,0,0]});
    g.box(.012*sz,.004,L,MT.chrome(),[0,0,0]);
    g.tor(.012*sz,.004*sz,MT.chrome(),[0,0,L/2+.009*sz],[90,0,0],null,24,8);
    g.box(.009*sz,.005,.022*sz,MT.chrome(),[.009*sz,0,-L/2-.008*sz],[0,-15,0]); g.box(.009*sz,.005,.022*sz,MT.chrome(),[-.009*sz,0,-L/2-.008*sz],[0,15,0]);
    g.pop(); }
});
/* ---------- LAB LAIN ---------- */
defModel('microscope','Mikroskop','bench',g=>{
  const wht=MT.paint('#eef1f4',.6), blk=MT.plastic('#1f2023',.5);
  g.box(.17,.035,.22,MT.plastic('#374151',.5),[0,.0175,0]); g.cyl(.02,.02,.004,MT.glow('#fef9c3'),[0,.037,.03]);
  g.tube([[0,.03,-.08],[0,.2,-.085],[0,.3,-.05]],.024,wht);
  g.box(.14,.012,.14,blk,[0,.15,.03]); g.cyl(.025,.02,.03,blk,[0,.13,.03]);
  for(const x of [-.035,.035]) g.box(.012,.003,.05,MT.chrome(),[x,.158,.04]);
  g.cyl(.04,.04,.025,MT.chrome(),[0,.265,.03],[-15,0,0]);
  for(let i=0;i<3;i++){const a=(i-1)*0.55; g.seg([Math.sin(a)*.022,.255,.03+Math.cos(a)*.012],[Math.sin(a)*.03,.215,.035+Math.cos(a)*.016],.009,i===1?MT.chrome():MT.metal('#9ca3af',.7),12);}
  g.box(.07,.06,.09,wht,[0,.305,-.01]);
  for(const x of [-.022,.022]) g.seg([x,.33,-.01],[x*1.3,.38,-.06],.012,blk);
  for(const s of [-1,1]){g.cyl(.026,.026,.018,blk,[s*.04,.12,-.08],[0,0,90]);g.cyl(.014,.014,.03,blk,[s*.045,.12,-.08],[0,0,90]);}
});
defModel('beaker','Gelas Kimia & Erlenmeyer','bench',g=>{
  const gl=MT.glass();
  g.push({t:[-.07,0,0]}); g.lathe([[0,0],[.045,0],[.05,.004],[.05,.13],[.056,.136]],gl,null,null,40); g.lathe([[0,.003],[.047,.003],[.047,.07],[0,.07]],MT.plastic('#3b82f6',.8),null,null,32);
  for(let i=1;i<5;i++) g.tor(.0505,.0008,MT.glow('#f8fafc'),[0,.025*i,0],null,null,40,4); g.pop();
  g.push({t:[.06,0,.0]}); g.lathe([[0,0],[.065,0],[.07,.008],[.07,.02],[.026,.13],[.022,.17],[.027,.176]],gl,null,null,40); g.lathe([[0,.004],[.066,.004],[.066,.02],[.05,.06],[0,.06]],MT.plastic('#22c55e',.8),null,null,32); g.pop();
  g.push({t:[0,0,.12]}); g.box(.2,.02,.05,MT.wood(),[0,.01,0]); g.box(.2,.012,.05,MT.wood(),[0,.08,0]); for(const x of [-.095,.095]) g.box(.01,.08,.05,MT.wood(),[x,.05,0]);
  [['#ef4444',.07],['#a855f7',.05],['#f59e0b',.09]].forEach(([c,lv],i)=>{const x=-.05+i*.05; g.cyl(.009,.009,.14,gl,[x,.08,0],null,20,false); g.cyl(.008,.008,lv,MT.plastic(c,.8),[x,.015+lv/2,0],null,16);});
  g.pop();
});
defModel('balance','Neraca Ohaus','bench',g=>{
  const blk=MT.plastic('#1f2023',.5), s=MT.chrome();
  g.box(.4,.05,.14,blk,[0,.025,0]); g.box(.06,.06,.08,blk,[-.13,.08,0]);
  g.cyl(.075,.075,.008,s,[-.13,.12,0]); g.cyl(.07,.074,.006,MT.metal('#cfd4da',.8),[-.13,.127,0]);
  g.box(.05,.08,.03,blk,[.02,.09,-.04]);
  for(let i=0;i<3;i++){g.box(.32,.012,.006,s,[.04,.1+i*.025,.0]); g.box(.012,.02,.012,MT.metal('#9ca3af'),[-.05+i*.07,.1+i*.025,.0]);}
  g.box(.004,.09,.004,MT.glow('#dc2626'),[.2,.13,.0]); g.box(.01,.09,.01,blk,[.205,.12,-.02]);
  g.cyl(.012,.012,.02,blk,[-.18,.06,.06],[90,0,0]);
});
defModel('projector','Proyektor','bench',g=>{
  const w=MT.plastic('#f3f4f6',.55);
  g.box(.3,.09,.23,w,[0,.055,0]); g.box(.29,.01,.22,MT.plastic('#d1d5db',.4),[0,.1,0]);
  g.cyl(.042,.042,.02,MT.plastic('#111',.5),[-.08,.055,.116],[90,0,0]); g.cyl(.03,.034,.02,MT.metal('#374151',.8),[-.08,.055,.12],[90,0,0]); g.cyl(.025,.025,.006,MT.glass('#93c5fd'),[-.08,.055,.13],[90,0,0]);
  for(let i=0;i<6;i++) g.box(.06,.004,.002,MT.plastic('#4b5563'),[.08,.03+i*.01,.116]);
  g.cyl(.012,.012,.006,MT.plastic('#111'),[.1,.103,.0]); g.cyl(.006,.006,.008,MT.glow('#22c55e'),[.06,.103,.07]);
  for(const [x,z] of [[-.12,.09],[.12,.09],[0,-.09]]) g.cyl(.012,.012,.012,MT.rubber(),[x,.006,z]);
});
defModel('laptop','Laptop','bench',g=>{
  const al=MT.metal('#c4c9cf',.6);
  g.box(.34,.018,.24,al,[0,.009,0]); g.box(.3,.002,.11,MT.plastic('#1f2937',.4),[0,.0185,-.03]);
  for(let r=0;r<5;r++)for(let c=0;c<13;c++) g.box(.018,.002,.016,MT.plastic('#374151',.4),[-.132+c*.022,.02,-.075+r*.02]);
  g.box(.1,.001,.06,MT.metal('#b0b6bd',.7),[0,.0185,.07]);
  g.push({t:[0,.018,-.12],r:[-14,0,0]}); g.box(.34,.23,.01,al,[0,.115,-.006]); g.box(.32,.2,.002,MT.glow('#1e40af'),[0,.12,0]); g.box(.18,.05,.003,MT.glow('#60a5fa'),[-.04,.15,.001]); g.box(.1,.01,.003,MT.glow('#e0f2fe'),[-.06,.09,.001]); g.pop();
});
defModel('ball','Bola Olahraga','floor',g=>{
  g.push({t:[0,.12,0]}); g.sph(.12,MT.plastic('#ea580c',.25),[0,0,0],null,40);
  g.tor(.1195,.0045,MT.plastic('#111'),[0,0,0],[90,0,0],null,60,6); g.tor(.1195,.0045,MT.plastic('#111'),[0,0,0],[0,0,90],null,60,6);
  for(const s of [-1,1]) g.tor(.0835,.0045,MT.plastic('#111'),[s*.085,0,0],[0,0,90],null,48,6);
  g.pop();
});
defModel('torso','Model Torso Manusia','bench',g=>{
  const skin=MT.plastic('#e8b796',.45);
  g.cyl(.08,.09,.02,MT.plastic('#111',.4),[0,.01,0]); g.seg([0,.02,0],[0,.12,0],.012,MT.chrome());
  g.lathe([[0,.12],[.07,.12],[.09,.16],[.1,.25],[.11,.33],[.12,.38],[.09,.41],[.035,.42],[.035,.45],[0,.45]],skin,null,null,40);
  g.sph(.075,skin,[0,.53,0],[.85,1.05,.95]);
  g.sph(.04,MT.plastic('#f472b6',.6),[-.04,.33,.08],[1,1.5,.6]); g.sph(.04,MT.plastic('#f472b6',.6),[.045,.33,.08],[1,1.5,.6]);
  g.sph(.025,MT.plastic('#dc2626',.7),[.01,.3,.1],[1,1.2,.8]); g.sph(.05,MT.plastic('#7f1d1d',.6),[-.03,.24,.085],[1.2,.5,.6]);
  for(let i=0;i<3;i++) g.tor(.04,.012,MT.plastic('#fda4af',.6),[0,.15+i*.025,.07],[90,0,0],null,24,8);
});
defModel('generic','Alat Umum (Koper Alat)','bench',g=>{
  const c=MT.plastic('#334155',.45);
  g.box(.4,.28,.12,c,[0,.15,0]); g.box(.402,.012,.122,MT.plastic('#1e293b',.4),[0,.2,0]);
  g.tube([[-.07,.29,0],[-.06,.33,0],[.06,.33,0],[.07,.29,0]],.012,MT.rubber());
  for(const x of [-.14,.14]) g.box(.04,.03,.01,MT.chrome(),[x,.2,.065]);
  g.box(.12,.05,.002,MT.paint('#facc15',.5),[.08,.1,.061]);
});
/* deteksi model dari nama alat */
const MODEL_RULES=[['engine',/mesin|engine|trainer|motor bakar/],['jackstand',/jack ?stand|penyangga|kaki tiga/],['jack',/dongkrak|floor ?jack|jack/],
 ['torque',/momen|torque/],['impact',/impact|bor|gun|obeng listrik/],['compressor',/kompres/],['toolbox',/troli|trolley|toolbox|tool ?box|lemari perkakas|kotak perkakas|cabinet/],
 ['wheel',/ban|velg|roda|wheel|tire|tyre/],['battery',/aki|accu|baterai|battery/],['obd',/obd|scanner|scan ?tool|diagnos/],['sparkplug',/busi|spark/],
 ['multimeter',/multimeter|multitester|avometer|avo meter/],['caliper',/sorong|caliper|mikrometer|micrometer/],['wrenchset',/kunci|wrench|spanner|ring ?pas|sok|socket/],
 ['microscope',/mikroskop|microscope/],['beaker',/gelas|beaker|erlenmeyer|tabung|labu|pipet/],['balance',/neraca|timbangan|balance|ohaus/],
 ['projector',/proyektor|projector|lcd/],['laptop',/laptop|komputer|notebook|\bpc\b/],['ball',/bola|ball/],['torso',/torso|anatomi|kerangka/]];
function guessModel(nama,kat){const s=String(nama||'').toLowerCase();for(const [k,re] of MODEL_RULES) if(re.test(s)) return k; return 'generic';}
/* tampilkan satu model di View (studio) */
function stageModel(view,key){
  const def=MODELS[key]||MODELS.generic, geo=view.geo(def.key,def.build), lo=geo.lo, hi=geo.hi;
  const sx=hi[0]-lo[0], sy=hi[1]-lo[1], sz=hi[2]-lo[2], R=.5*Math.hypot(sx,sy,sz);
  const ground=view.geo('ground',g=>g.cyl(10,10,.002,G3.MT.ground(),[0,-.001,0],null,64));
  view.objs=[{g:ground,m:G3.M.inst(0,0,0,0,R*.4),noShadow:true},{g:geo,m:G3.M.tr(-(lo[0]+hi[0])/2,-lo[1],-(lo[2]+hi[2])/2)}];
  Object.assign(view.scene,{center:[0,sy/2,0],radius:R*1.7,fade:R*2.6,exp:1.05,sun:[-.6,.95,.45]});
  Object.assign(view.cam,{t:[0,sy*.42,0],dist:R/Math.tan(view.cam.fov*Math.PI/360)*1.08,min:R*.6,max:R*6,pitch:.42});
  return def;
}
/* ======================================================================
   RUANG LAB 3D
   ====================================================================== */
function carModel(g,col='#c81e1e'){
  const paint=MT.paint(col,.92), dark=MT.plastic('#15181d',.4), win=G3.MT.metal('#1b2430',.95);
  g.ext([[-2.1,.32],[2.05,.32],[2.12,.45],[2.1,.64],[1.2,.8],[.55,.86],[0,1.32],[-1.05,1.34],[-1.75,.98],[-2.08,.93],[-2.12,.64]],1.76,paint);
  g.ext([[.42,.9],[.05,1.25],[-1.0,1.27],[-1.6,.98]],1.775,win);
  g.box(.02,1.77,.06,paint,[-.45,1.12,0],[90,0,0]);
  g.box(.72,.012,1.5,win,[.282,1.098,0],[0,0,140]); g.box(.78,.012,1.5,win,[-1.405,1.168,0],[0,0,-152.8]);
  g.box(3.9,.06,1.6,dark,[0,.33,0]);
  g.box(.08,.16,1.7,dark,[2.1,.42,0]); g.box(.08,.14,1.7,dark,[-2.12,.42,0]); g.box(.02,.1,.8,MT.plastic('#0b0c0e',.6),[2.115,.56,0]);
  for(const s of [-1,1]){ g.box(.03,.08,.3,MT.glow('#fef9c3'),[2.1,.66,s*.6]); g.box(.03,.07,.3,MT.glow('#dc2626'),[-2.115,.8,s*.62]);
    g.box(.12,.07,.06,paint,[.45,.98,s*.92]); g.box(.15,.012,.02,MT.chrome(),[-.2,.78,s*.885]); g.box(.15,.012,.02,MT.chrome(),[-1.05,.8,s*.885]); }
  for(const x of [1.3,-1.3]) for(const s of [-1,1]){ g.push({t:[x,.31,s*.78],r:[s*90,0,0]}); wheelY(g,.31,.2,'#cfd4da'); g.pop(); }
}
function workbench(g,x,z,oto){
  g.push({t:[x,0,z]});
  if(oto){
    g.box(2.1,.06,.7,MT.wood('#9c6b3c'),[0,.89,0]);
    for(const [a,b] of [[-1,-.3],[1,-.3],[-1,.3],[1,.3]]) g.box(.05,.86,.05,MT.paint('#374151',.5),[a,.43,b]);
    g.box(2,.03,.6,MT.paint('#374151',.5),[0,.18,0]);
    g.box(.55,.62,.62,MT.paint('#1e3a8a',.6),[.7,.52,0]); for(let i=0;i<3;i++){g.box(.5,.004,.005,MT.plastic('#0b1020'),[.7,.36+i*.2,.311]);g.box(.18,.015,.02,MT.chrome(),[.7,.3+i*.2,.32]);}
    g.box(.16,.1,.12,MT.paint('#1d4ed8',.6),[-.85,.97,.15]); g.box(.04,.06,.2,MT.chrome(),[-.85,1.04,.15]);
    g.box(2,1,.03,MT.paint('#d6cfc0',.2),[0,1.75,-.33]);
    for(let i=0;i<9;i++){const tx=-.85+i*.21; g.box(.025,.28+(i%3)*.06,.01,MT.chrome(),[tx,1.65,-.31]); g.tor(.025,.006,MT.chrome(),[tx,1.82+(i%3)*.03,-.31],[90,0,0],null,16,6);}
    g.box(.36,.06,.02,MT.paint('#dc2626',.6),[.6,2.05,-.31]);
  } else {
    g.box(2.1,.05,.7,MT.plastic('#111827',.6),[0,.9,0]);
    g.box(2.06,.86,.66,MT.paint('#f1f5f9',.4),[0,.44,0]);
    for(let i=0;i<3;i++){g.box(.004,.8,.005,MT.plastic('#94a3b8'),[-.34+i*.69,.44,.331]); g.box(.02,.12,.02,MT.chrome(),[-.6+i*.69,.6,.34]);}
    g.box(2,.03,.3,MT.paint('#e2e8f0',.4),[0,1.7,-.2]);
    ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#14b8a6'].forEach((c,i)=>{g.cyl(.04,.04,.18,MT.glass(),[-.8+i*.3,1.81,-.2],null,16);g.cyl(.036,.036,.1,MT.plastic(c,.7),[-.8+i*.3,1.77,-.2],null,16);});
  }
  g.pop();
}
function pinGeo(g,c){ g.sph(.12,MT.glow(c),[0,.3,0],null,20); g.cyl(.09,0,.22,MT.glow(c),[0,.11,0],null,20); g.sph(.05,MT.glow('#ffffff'),[0,.31,.07],null,10); }
function ringGeo(g,c){ g.tor(.5,.025,MT.glow(c),[0,.01,0],null,null,48,8); }

/* ======================================================================
   PERABOT LAB (bisa diatur admin) + RUANGAN + TEMPLATE
   w,d = ukuran tapak (m); top = tinggi permukaan untuk meletakkan alat
   ====================================================================== */
const FURN={};
function defFurn(key,name,o,build){FURN[key]=Object.assign({key,name,top:0},o,{build});}
function chair(g,x,z,ry=0,c='#334155'){ g.push({t:[x,0,z],r:[0,ry,0]});
  g.box(.42,.04,.42,MT.plastic(c,.4),[0,.46,0]); g.box(.42,.38,.04,MT.plastic(c,.4),[0,.7,-.2]);
  for(const [a,b] of [[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]]) g.box(.025,.46,.025,MT.metal('#6b7280'),[a,.23,b]); g.pop(); }
defFurn('meja_kerja','Meja Kerja Bengkel (+papan perkakas)',{w:2.1,d:.75,top:.92,td:.7},g=>workbench(g,0,0,true));
defFurn('meja_dinding','Meja Lab Dinding (+rak botol)',{w:2.1,d:.7,top:.93},g=>workbench(g,0,0,false));
defFurn('meja_praktikum','Meja Praktikum + 6 Kursi',{w:2.5,d:2.1,top:.91,td:1.2},g=>{
  g.box(2.4,.86,1.1,MT.paint('#f8fafc',.4),[0,.43,0]); g.box(2.5,.05,1.2,MT.plastic('#111827',.65),[0,.885,0]);
  g.box(.4,.02,.3,MT.metal('#9ca3af',.8),[1,.915,-.35]); g.tube([[1,.91,-.48],[1,1.2,-.48],[1,1.2,-.38]],.012,MT.chrome());
  for(const s of [-1,1]) for(const dx of [-.7,0,.7]){ g.cyl(.17,.17,.04,MT.plastic('#334155',.4),[dx,.62,s*.85],null,18); g.cyl(.02,.02,.6,MT.chrome(),[dx,.3,s*.85],null,8); }});
defFurn('meja_guru','Meja Guru + Kursi',{w:1.6,d:1.3,top:.76,td:.8,tz:-.25},g=>{
  g.box(1.6,.05,.8,MT.wood('#8b5a2b'),[0,.75,-.25]); g.box(1.5,.7,.04,MT.wood('#7a4e25'),[0,.38,-.63]);
  for(const s of [-1,1]) g.box(.05,.72,.75,MT.wood('#7a4e25'),[s*.76,.36,-.25]); g.box(.45,.5,.7,MT.wood('#7a4e25'),[.5,.4,-.25]);
  chair(g,0,.2,180,'#1e3a8a');});
defFurn('meja_siswa','Meja Siswa + Kursi',{w:1.2,d:1.1,top:.75,td:.6,tz:-.2},g=>{
  g.box(1.2,.04,.6,MT.wood('#c08a4e'),[0,.74,-.2]); for(const [a,b] of [[-.55,-.45],[.55,-.45],[-.55,.05],[.55,.05]]) g.box(.04,.72,.04,MT.metal('#6b7280'),[a,.36,b]);
  chair(g,0,.3,180);});
defFurn('meja_komputer','Meja Komputer (PC + kursi)',{w:1.4,d:1.2,top:.76,td:.7,tz:-.2},g=>{
  g.box(1.4,.04,.7,MT.plastic('#e5e7eb',.4),[0,.74,-.2]); for(const s of [-1,1]) g.box(.04,.72,.66,MT.plastic('#9ca3af',.4),[s*.68,.36,-.2]);
  g.box(.56,.34,.03,MT.plastic('#111827',.5),[0,1.06,-.42]); g.box(.52,.3,.005,MT.glow('#1d4ed8'),[0,1.06,-.404]); g.box(.04,.14,.04,MT.plastic('#111827'),[0,.83,-.44]); g.box(.2,.01,.14,MT.plastic('#111827'),[0,.765,-.44]);
  g.box(.44,.015,.14,MT.plastic('#1f2937',.4),[0,.77,-.12]); g.box(.07,.02,.1,MT.plastic('#1f2937',.5),[.32,.77,-.1]);
  g.box(.2,.42,.45,MT.plastic('#1f2937',.4),[.5,.21,-.3]); chair(g,0,.3,180,'#0f172a');});
defFurn('lemari','Lemari Alat (pintu)',{w:1,d:.5},g=>{
  g.box(1,2,.5,MT.paint('#cbd5e1',.5),[0,1,0]); g.box(.004,1.9,.005,MT.plastic('#64748b'),[0,1,.251]);
  for(const s of [-1,1]) g.box(.02,.2,.02,MT.chrome(),[s*.06,1.05,.26]); g.box(.9,.08,.005,MT.paint('#1e3a8a',.5),[0,1.8,.252]);});
defFurn('lemari_kaca','Lemari Kaca (bahan/alat)',{w:1.2,d:.45},g=>{
  g.box(1.2,1.9,.45,MT.wood('#9a6b3f'),[0,.95,0]); g.box(1.12,1.8,.38,MT.paint('#f1f5f9',.3),[0,.97,.02]);
  for(const y of [.55,1.0,1.45]) g.box(1.1,.02,.38,MT.wood('#9a6b3f'),[0,y,.02]);
  ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7'].forEach((c,i)=>{ g.cyl(.05,.05,.22,MT.glass(),[-.4+i*.2,1.12,.05],null,16); g.cyl(.045,.045,.12,MT.plastic(c,.7),[-.4+i*.2,1.07,.05],null,16); g.cyl(.045,.05,.18,MT.plastic(c,.6),[-.4+i*.2,.65,.05],null,16); });
  g.box(1.14,1.84,.01,MT.glass('#e0f2fe'),[0,.97,.226]);});
defFurn('rak','Rak Besi + Kotak',{w:1.2,d:.45},g=>{
  for(const [a,b] of [[-.58,-.2],[.58,-.2],[-.58,.2],[.58,.2]]) g.box(.04,1.8,.04,MT.metal('#64748b',.5),[a,.9,b]);
  for(const y of [.1,.6,1.1,1.6]) g.box(1.2,.03,.45,MT.metal('#94a3b8',.5),[0,y,0]);
  [['#2563eb',-.35,.25],['#f59e0b',.3,.25],['#16a34a',-.2,.75],['#dc2626',.35,.75],['#64748b',0,1.25]].forEach(([c,x,y])=>g.box(.4,.25,.35,MT.plastic(c,.4),[x,y,0]));});
defFurn('lift_mobil','Lift 2 Tiang + Mobil',{w:4.6,d:3.4},g=>{
  for(const s of [-1,1]){ g.box(.32,3.1,.32,MT.paint('#1d4ed8',.6),[0,1.55,s*1.4]); g.box(.36,.1,.36,MT.paint('#facc15',.6),[0,3.12,s*1.4]); g.box(.5,.08,.5,MT.paint('#1e293b',.4),[0,.04,s*1.4]);
    g.box(.38,.3,.38,MT.paint('#1e3a8a',.6),[0,1.0,s*1.4]); for(const d of [-1,1]) g.seg([0,.95,s*1.4],[d*1.05,.95,s*.55],.045,MT.paint('#facc15',.6),8); }
  g.box(.1,.05,2.8,MT.paint('#1d4ed8',.6),[0,3.15,0]); g.box(.18,.3,.12,MT.paint('#111',.4),[0,1.3,1.62]); g.cyl(.02,.02,.02,MT.glow('#22c55e'),[-.04,1.36,1.69],[90,0,0]);
  g.push({t:[0,1.0,0]}); carModel(g,'#c81e1e'); g.pop();});
defFurn('garis_area','Garis Area Kerja (lantai)',{w:7.2,d:5,flat:true},g=>{
  const Y=MT.paint('#facc15',.5); g.box(7.2,.004,5,MT.paint('#7b8591',.65),[0,.002,0]);
  g.box(7.2,.006,.1,Y,[0,.004,-2.5]); g.box(7.2,.006,.1,Y,[0,.004,2.5]); g.box(.1,.006,5,Y,[-3.6,.004,0]); g.box(.1,.006,5,Y,[3.6,.004,0]);
  for(let i=0;i<8;i++) g.box(.35,.007,.1,MT.paint('#111',.4),[-3.3+i*.95,.005,2.5]);});
defFurn('rak_ban','Rak Ban',{w:1,d:1.2},g=>{
  for(const x of [-.4,.4]) for(const z of [-.5,.5]) g.box(.05,1.4,.05,MT.paint('#374151',.5),[x,.7,z]);
  for(const y of [.35,1.05]) for(const x of [-.4,.4]) g.box(.05,.05,1.05,MT.paint('#374151',.5),[x,y,0]);
  for(const y of [.35,1.05]) for(const z of [-.32,0,.32]){ g.push({t:[0,y+.31,z],r:[90,0,0]}); wheelY(g,.31,.2,'#9ca3af',6); g.pop(); }});
defFurn('drum_oli','Drum Oli',{w:.6,d:.6},g=>{ g.cyl(.29,.29,.88,MT.paint('#1d4ed8',.65),[0,.44,0],null,32); for(const y of [.3,.6]) g.tor(.292,.012,MT.paint('#1e40af',.6),[0,y,0]); g.cyl(.04,.04,.02,MT.metal('#9ca3af'),[.15,.89,0]);});
defFurn('apar','APAR (Pemadam Api)',{w:.35,d:.3},g=>{ g.cyl(.08,.08,.5,MT.paint('#dc2626',.85),[0,.45,0],null,20); g.sph(.08,MT.paint('#dc2626',.85),[0,.7,0],[1,.5,1]); g.box(.04,.08,.06,MT.plastic('#111'),[0,.78,0]); g.tube([[0,.8,.03],[.05,.75,.1],[.07,.5,.1]],.012,MT.rubber()); g.box(.3,.3,.02,MT.paint('#dc2626',.5),[0,1.25,-.14]);});
defFurn('papan_tulis','Papan Tulis',{w:3.2,d:.5},g=>{ g.box(3.2,1.3,.04,MT.paint('#ffffff',.6),[0,1.9,0]); g.box(3.3,.06,.08,MT.metal('#9ca3af'),[0,1.22,.02]);
  for(const s of [-1,1]){ g.box(.05,2.6,.05,MT.metal('#9ca3af'),[s*1.62,1.3,-.02]); g.box(.05,.04,.5,MT.metal('#9ca3af'),[s*1.62,.02,0]); }});
defFurn('wastafel','Wastafel',{w:.8,d:.55,top:0},g=>{ g.box(.8,.85,.55,MT.paint('#e2e8f0',.4),[0,.425,0]); g.box(.82,.04,.57,MT.plastic('#f8fafc',.7),[0,.87,0]);
  g.box(.5,.02,.35,MT.metal('#9ca3af',.85),[0,.885,.03]); g.tube([[0,.88,-.2],[0,1.15,-.2],[0,1.15,-.08]],.014,MT.chrome());});
defFurn('pintu','Pintu',{w:1.1,d:.15},g=>{ g.box(1.1,2.2,.12,MT.paint('#94a3b8',.4),[0,1.1,0]); g.box(.9,2.05,.06,MT.wood('#8b5a2b'),[0,1.03,.04]); g.box(.12,.03,.04,MT.chrome(),[.32,1.05,.09]);});
defFurn('kursi','Kursi',{w:.45,d:.45},g=>chair(g,0,0,0));
defFurn('kotak','Kotak / Peti Alat',{w:.8,d:.5,top:.5},g=>{ g.box(.8,.5,.5,MT.paint('#1f2937',.5),[0,.25,0]); g.box(.82,.04,.52,MT.paint('#111827',.5),[0,.5,0]); for(const s of [-1,1]) g.box(.12,.03,.03,MT.chrome(),[s*.25,.4,.26]);});

/* ---------- cangkang ruangan (lantai + 2 dinding potongan) ---------- */
const GAYA={oto:{nama:'Bengkel Otomotif',lantai:'#9aa3ad',pita:'#1e3a8a',ubin:false},lab:{nama:'Lab IPA / Sains',lantai:'#dfe4ea',pita:'#0f766e',ubin:true},kom:{nama:'Lab Komputer / Kelas',lantai:'#d9c6a5',pita:'#6d28d9',ubin:false}};
function buildShell(g,gaya,W,D){
  const G=GAYA[gaya]||GAYA.lab, hw=W/2, hd=D/2;
  g.box(W,.1,D,MT.paint(G.lantai,gaya==='oto'?.55:.35),[0,-.05,0]);
  if(G.ubin){ for(let i=-Math.floor(hw);i<=hw;i++) g.box(.015,.003,D,MT.paint('#c5ccd5',.3),[i,.002,0]); for(let j=-Math.floor(hd);j<=hd;j++) g.box(W,.003,.015,MT.paint('#c5ccd5',.3),[0,.002,j]); }
  if(gaya==='kom'){ for(let i=-Math.floor(hw*2);i<=hw*2;i++) g.box(.01,.003,D,MT.paint('#b89a6c',.3),[i/2,.002,0]); }
  const wall=MT.paint('#eef2f6',.25), band=MT.paint(G.pita,.4), Y=MT.paint('#facc15',.5);
  g.box(W+.2,3.4,.2,wall,[0,1.7,-hd-.1]); g.box(.2,3.4,D,wall,[-hw-.1,1.7,0]);
  g.box(W,1.1,.02,band,[0,.55,-hd+.01]); g.box(.02,1.1,D,band,[-hw+.01,.55,0]);
  g.box(W,.08,.03,Y,[0,1.14,-hd+.02]); g.box(.03,.08,D,Y,[-hw+.02,1.14,0]);
  for(let x=-hw+2;x<hw-1;x+=3.2){ g.box(1.9,.9,.03,MT.glow('#dbeafe'),[x,2.6,-hd+.02]); g.box(.04,.9,.04,MT.paint('#94a3b8',.5),[x,2.6,-hd+.04]); g.box(1.9,.04,.04,MT.paint('#94a3b8',.5),[x,2.6,-hd+.04]); }
  for(let z=-hd+2;z<hd-1;z+=3.2) g.box(.03,.9,1.9,MT.glow('#dbeafe'),[-hw+.02,2.6,z]);
}
/* ---------- template perabot awal per gaya lab ---------- */
function labTemplate(gaya,W,D){
  const hw=W/2, hd=D/2, F=[], add=(jenis,x,z,rot=0)=>F.push({jenis,x:+x.toFixed(2),z:+z.toFixed(2),rot});
  if(gaya==='oto'){
    for(let i=0,x=-hw+2.1;i<4&&x<hw-6;i++,x+=2.3) add('meja_kerja',x,-hd+.45);
    add('garis_area',Math.min(1,hw-4),-.5); add('lift_mobil',Math.min(1,hw-4),-.5);
    add('rak_ban',hw-.7,-hd+1.2); add('drum_oli',-hw+.6,-hd+.65); add('drum_oli',-hw+.6,-hd+1.4);
    add('apar',-hw+.25,hd-1.2,Math.PI/2); add('pintu',-hw+.1,hd-2.6,Math.PI/2);
  } else if(gaya==='kom'){
    add('papan_tulis',0,-hd+.3); add('meja_guru',-hw+2.2,-hd+1.6);
    for(let r=0;r<3;r++) for(let c=0;c<4;c++){ const x=-hw+3+c*1.8, z=-hd+3.2+r*1.9; if(x<hw-1&&z<hd-.8) add('meja_komputer',x,z); }
    add('lemari',-hw+.3,hd-2,Math.PI/2); add('pintu',-hw+.1,hd-.9,Math.PI/2);
  } else if(gaya==='lab'){
    for(const x of [-hw+2.1,-hw+4.4]) add('meja_dinding',x,-hd+.4);
    add('papan_tulis',hw-2.5,-hd+.3);
    for(const z of [-hd+3.3,-hd+6.3]) for(const x of [-hw+3.5,-hw+7.2,-hw+10.9]) if(x<hw-1.2&&z<hd-1) add('meja_praktikum',x,z);
    add('lemari_kaca',-hw+.3,-hd+2,Math.PI/2); add('lemari_kaca',-hw+.3,-hd+3.4,Math.PI/2); add('wastafel',-hw+.35,-hd+4.8,Math.PI/2);
    add('apar',-hw+.25,hd-1,Math.PI/2); add('pintu',-hw+.1,hd-2.4,Math.PI/2);
  }
  return F;
}
/* ---------- geometri bantu tata letak ---------- */
function toLocal(f,x,z){ const c=Math.cos(f.rot||0), s=Math.sin(f.rot||0), dx=x-f.x, dz=z-f.z; return [c*dx-s*dz, s*dx+c*dz]; }
function toWorld(f,lx,lz){ const c=Math.cos(f.rot||0), s=Math.sin(f.rot||0); return [f.x+c*lx+s*lz, f.z-s*lx+c*lz]; }
function furnTopAt(furn,x,z){ let best=0;
  for(const f of furn){ const D=FURN[f.jenis]; if(!D||!D.top) continue; const [lx,lz]=toLocal(f,x,z);
    if(Math.abs(lx)<=(D.tw||D.w)/2 && Math.abs(lz-(D.tz||0))<=(D.td||D.d)/2) best=Math.max(best,D.top); }
  return best; }
function insideFurn(furn,x,z,pad=0){ return furn.some(f=>{ const D=FURN[f.jenis]; if(!D||D.flat) return false; const [lx,lz]=toLocal(f,x,z); return Math.abs(lx)<=D.w/2+pad && Math.abs(lz)<=D.d/2+pad; }); }
/* cari tempat kosong otomatis untuk alat baru */
function autoSpot(lab,furn,placed,pref){
  const W=lab.lebar, D=lab.panjang, free=(x,z,r)=>!placed.some(p=>Math.hypot(p.x-x,p.z-z)<r);
  const bench=()=>{ for(const f of furn){ const Df=FURN[f.jenis]; if(!Df||!Df.top) continue; const tw=(Df.tw||Df.w), n=Math.max(1,Math.floor((tw-.3)/.55));
      for(let i=0;i<n;i++){ const lx=-tw/2+.15+.275+i*((tw-.3)/n), [x,z]=toWorld(f,lx,(Df.tz||0)+(f.jenis==='meja_kerja'?.05:0)); if(free(x,z,.45)) return {x,z,rot:f.rot||0}; } } return null; };
  const floor=()=>{ const c=[]; for(let x=-W/2+.9;x<=W/2-.9;x+=.8) for(let z=-D/2+.9;z<=D/2-.9;z+=.8) c.push([x,z]);
      c.sort((a,b)=>(Math.min(a[0]+W/2,a[1]+D/2))-(Math.min(b[0]+W/2,b[1]+D/2)));
      for(const [x,z] of c) if(!insideFurn(furn,x,z,.35)&&free(x,z,.9)) return {x,z,rot:0}; return null; };
  const r=pref==='bench'?(bench()||floor()):(floor()||bench());
  return r||{x:0,z:D/2-1,rot:0};
}

/* ======================================================================
   "3D DARI FOTO": foto tanpa latar → benda 3D bervolume (relief/inflasi)
   Siluet alat diberi ketebalan membulat; depan & belakang bertekstur foto.
   ====================================================================== */
function reliefFromImage(img,texUrl,opt={}){
  const N=opt.grid||128, iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height, sc=N/Math.max(iw,ih);
  const W=Math.max(8,Math.round(iw*sc)), H=Math.max(8,Math.round(ih*sc));
  const c=document.createElement('canvas'); c.width=W; c.height=H; const cx=c.getContext('2d',{willReadFrequently:true}); cx.drawImage(img,0,0,W,H);
  const px=cx.getImageData(0,0,W,H).data, inside=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++) inside[i]=px[i*4+3]>110?1:0;
  // buang bintik kecil, tapi pertahankan semua bagian penting (mis. alas & kepala kipas)
  const comp=new Int32Array(W*H).fill(-1), sizes=[]; let best=-1,bestN=0,cid=0; const q=new Int32Array(W*H);
  for(let s=0;s<W*H;s++){ if(!inside[s]||comp[s]>=0) continue; let h=0,t=0,n=0; q[t++]=s; comp[s]=cid;
    while(h<t){ const i=q[h++]; n++; const x=i%W,y=(i/W)|0; for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1]) if(j>=0&&inside[j]&&comp[j]<0){ comp[j]=cid; q[t++]=j; } }
    sizes.push(n); if(n>bestN){ bestN=n; best=cid; } cid++; }
  if(bestN<12) return null;
  const keep=sizes.map(n=>n>=Math.max(12,bestN*.015));
  for(let i=0;i<W*H;i++) inside[i]=comp[i]>=0&&keep[comp[i]]?1:0;
  // jarak ke tepi (chamfer)
  const D=new Float32Array(W*H); for(let i=0;i<W*H;i++) D[i]=inside[i]?1e9:0;
  const g=(x,y)=>(x<0||y<0||x>=W||y>=H)?0:D[y*W+x];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x; if(!D[i]) continue; D[i]=Math.min(D[i],g(x-1,y)+1,g(x,y-1)+1,g(x-1,y-1)+1.414,g(x+1,y-1)+1.414); }
  for(let y=H-1;y>=0;y--) for(let x=W-1;x>=0;x--){ const i=y*W+x; if(!D[i]) continue; D[i]=Math.min(D[i],g(x+1,y)+1,g(x,y+1)+1,g(x+1,y+1)+1.414,g(x-1,y+1)+1.414); }
  let dmax=0,x0=W,x1=0,y0=H,y1=0; for(let i=0;i<W*H;i++) if(inside[i]){ dmax=Math.max(dmax,D[i]); const x=i%W,y=(i/W)|0; x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y); }
  const objW=x1-x0+1, objH=y1-y0+1, unit=1/objH;                 // tinggi benda = 1 satuan
  const halfT=(opt.thick||.22)*Math.min(objW,objH)*unit;          // setengah ketebalan
  let Hh=new Float32Array(W*H);
  for(let i=0;i<W*H;i++) if(inside[i]){ const t=Math.min(1,D[i]/(dmax*.7)); Hh[i]=halfT*(.12+.88*Math.sqrt(1-(1-t)*(1-t))); }
  for(let pass=0;pass<2;pass++){ const o=new Float32Array(W*H); for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x; if(!inside[i]) continue; let s=0,n=0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=W||yy>=H) continue; const j=yy*W+xx; if(inside[j]){ s+=Hh[j]; n++; } } o[i]=s/n; } Hh=o; }
  const cxw=(x0+x1+1)/2, wx=x=>(x+.5-cxw)*unit, wy=y=>(y1+1-(y+.5))*unit;
  const hd=(x,y)=>{ x=Math.max(0,Math.min(W-1,x)); y=Math.max(0,Math.min(H-1,y)); const i=y*W+x; return inside[i]?Hh[i]:0; };
  const out=[], push=(x,y,z,n,u,v,sh)=>out.push(x,y,z,n[0],n[1],n[2],u,v,sh);
  const nrmF=(x,y,s)=>{ const gx=(hd(x+1,y)-hd(x-1,y))/(2*unit), gy=-(hd(x,y+1)-hd(x,y-1))/(2*unit), l=Math.hypot(gx,gy,1); return [-gx*s/l,-gy*s/l,s/l]; };
  const V=(x,y,side)=>{ const i=y*W+x, z=Hh[i]*side, n=nrmF(x,y,side); return [wx(x),wy(y),z,n,(x+.5)/W,(y+.5)/H,side>0?1:.8]; };
  const edges=new Map(), ek=(a,b)=>a<b?a+'_'+b:b+'_'+a;
  const tri=(a,b,c)=>{ for(const side of [1,-1]){ const L=side>0?[a,b,c]:[a,c,b]; for(const [x,y] of L){ const v=V(x,y,side); push(v[0],v[1],v[2],v[3],v[4],v[5],v[6]); } }
    for(const [p,r] of [[a,b],[b,c],[c,a]]){ const k=ek(p[1]*W+p[0],r[1]*W+r[0]); const e=edges.get(k); if(e) e.n++; else edges.set(k,{n:1,p,r,o:a===p?c:(b===p?a:b)}); } };
  const IN=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&inside[y*W+x];
  for(let y=0;y<H-1;y++) for(let x=0;x<W-1;x++){
    const a=IN(x,y),b=IN(x+1,y),c2=IN(x,y+1),d=IN(x+1,y+1), A=[x,y],B=[x+1,y],C=[x,y+1],Dd=[x+1,y+1];
    if(a&&b&&c2&&d){ tri(A,C,B); tri(B,C,Dd); }
    else if(a&&b&&c2) tri(A,C,B); else if(a&&b&&d) tri(A,Dd,B); else if(a&&c2&&d) tri(A,C,Dd); else if(b&&c2&&d) tri(B,C,Dd);
  }
  // dinding samping pada tepi siluet
  for(const e of edges.values()){ if(e.n!==1) continue; const [ax,ay]=e.p,[bx,by]=e.r;
    const pa=[wx(ax),wy(ay)], pb=[wx(bx),wy(by)], po=[wx(e.o[0]),wy(e.o[1])]; let nx=pb[1]-pa[1], ny=-(pb[0]-pa[0]);
    const mx=(pa[0]+pb[0])/2-po[0], my=(pa[1]+pb[1])/2-po[1]; if(nx*mx+ny*my<0){ nx=-nx; ny=-ny; } const l=Math.hypot(nx,ny)||1, n=[nx/l,ny/l,0];
    const ha=Hh[ay*W+ax], hb=Hh[by*W+bx], ox=e.o[0]+.5, oy=e.o[1]+.5;
    const ua=((ax+.5)*.4+ox*.6)/W, va=((ay+.5)*.4+oy*.6)/H, ub=((bx+.5)*.4+ox*.6)/W, vb=((by+.5)*.4+oy*.6)/H;
    push(pa[0],pa[1],ha,n,ua,va,.78); push(pb[0],pb[1],hb,n,ub,vb,.78); push(pb[0],pb[1],-hb,n,ub,vb,.78);
    push(pa[0],pa[1],ha,n,ua,va,.78); push(pb[0],pb[1],-hb,n,ub,vb,.78); push(pa[0],pa[1],-ha,n,ua,va,.78); }
  const ext=(x1-x0+1)*unit/2;
  return {parts:[{data:new Float32Array(out),tex:texUrl,tint:[1,1,1,1],gloss:.3}],lo:[-ext,0,-halfT],hi:[ext,1,halfT],kind:'relief'};
}

/* ======================================================================
   PEMBACA GLB (glTF 2.0 biner) – untuk model 3D realistis hasil AI
   ====================================================================== */
const WHITE_PX='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
function parseGLB(ab){
  const dv=new DataView(ab); if(ab.byteLength<20||dv.getUint32(0,true)!==0x46546C67) throw new Error('File model bukan GLB');
  let off=12,json=null,bin=null;
  while(off+8<=ab.byteLength){ const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true); const ch=ab.slice(off+8,off+8+len);
    if(type===0x4E4F534A) json=JSON.parse(new TextDecoder().decode(ch)); else if(type===0x004E4942) bin=ch; off+=8+len; }
  if(!json) throw new Error('GLB rusak');
  if((json.extensionsRequired||[]).some(e=>/draco|meshopt/i.test(e))) throw new Error('GLB terkompresi (Draco/Meshopt) belum didukung');
  const BD=bin?new DataView(bin):null, SZ={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}, NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const rd=(t,o,norm)=>{ switch(t){ case 5126: return BD.getFloat32(o,true); case 5125: return BD.getUint32(o,true);
    case 5123: { const v=BD.getUint16(o,true); return norm?v/65535:v; } case 5121: { const v=BD.getUint8(o); return norm?v/255:v; }
    case 5122: { const v=BD.getInt16(o,true); return norm?Math.max(v/32767,-1):v; } case 5120: { const v=BD.getInt8(o); return norm?Math.max(v/127,-1):v; } } return 0; };
  const acc=i=>{ const a=json.accessors[i], nc=NC[a.type], out=new Float32Array(a.count*nc); if(a.bufferView===undefined) return {d:out,nc};
    const v=json.bufferViews[a.bufferView], es=SZ[a.componentType], st=v.byteStride||nc*es, base=(v.byteOffset||0)+(a.byteOffset||0);
    for(let k=0;k<a.count;k++) for(let c=0;c<nc;c++) out[k*nc+c]=rd(a.componentType,base+k*st+c*es,a.normalized); return {d:out,nc}; };
  const imgUrl=(json.images||[]).map(im=>{ if(im.uri) return im.uri; if(im.bufferView===undefined) return null; const v=json.bufferViews[im.bufferView];
    return URL.createObjectURL(new Blob([new Uint8Array(bin,v.byteOffset||0,v.byteLength)],{type:im.mimeType||'image/png'})); });
  const matTex=m=>{ const pb=m&&m.pbrMetallicRoughness||{}; const ti=pb.baseColorTexture&&json.textures&&json.textures[pb.baseColorTexture.index];
    return {tex:(ti&&ti.source!==undefined&&imgUrl[ti.source])||WHITE_PX,tint:pb.baseColorFactor||[1,1,1,1],gloss:1-(pb.roughnessFactor??.7)*.8}; };
  const trs=n=>{ if(n.matrix) return new Float32Array(n.matrix); const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
    return new Float32Array([(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1]); };
  const parts=[], lo=[1e9,1e9,1e9], hi=[-1e9,-1e9,-1e9];
  const visit=(ni,parent)=>{ const n=json.nodes[ni], m=G3.mul(parent,trs(n));
    if(n.mesh!==undefined) for(const pr of json.meshes[n.mesh].primitives){ if(pr.mode!==undefined&&pr.mode!==4) continue;
      const P=acc(pr.attributes.POSITION).d, Nn=pr.attributes.NORMAL!==undefined?acc(pr.attributes.NORMAL).d:null, UV=pr.attributes.TEXCOORD_0!==undefined?acc(pr.attributes.TEXCOORD_0).d:null;
      const idx=pr.indices!==undefined?acc(pr.indices).d:null, cnt=idx?idx.length:P.length/3, out=new Float32Array(cnt*9);
      const tp=k=>{ const x=P[k*3],y=P[k*3+1],z=P[k*3+2]; return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]]; };
      const tn=k=>{ const x=Nn[k*3],y=Nn[k*3+1],z=Nn[k*3+2]; const a=[m[0]*x+m[4]*y+m[8]*z,m[1]*x+m[5]*y+m[9]*z,m[2]*x+m[6]*y+m[10]*z], l=Math.hypot(...a)||1; return [a[0]/l,a[1]/l,a[2]/l]; };
      for(let t=0;t<cnt;t+=3){ const ks=[0,1,2].map(j=>idx?idx[t+j]:t+j), ps=ks.map(tp); let fn=null;
        if(!Nn){ const u=[ps[1][0]-ps[0][0],ps[1][1]-ps[0][1],ps[1][2]-ps[0][2]], v=[ps[2][0]-ps[0][0],ps[2][1]-ps[0][1],ps[2][2]-ps[0][2]]; const c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], l=Math.hypot(...c)||1; fn=[c[0]/l,c[1]/l,c[2]/l]; }
        for(let j=0;j<3;j++){ const k=ks[j], p=ps[j], nn=fn||tn(k), o=(t+j)*9; out.set([p[0],p[1],p[2],nn[0],nn[1],nn[2],UV?UV[k*2]:0,UV?UV[k*2+1]:0,1],o);
          for(let a=0;a<3;a++){ if(p[a]<lo[a]) lo[a]=p[a]; if(p[a]>hi[a]) hi[a]=p[a]; } } }
      parts.push(Object.assign({data:out},matTex(json.materials&&json.materials[pr.material]))); }
    for(const c of n.children||[]) visit(c,m); };
  const I=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]), sc=json.scenes&&json.scenes[json.scene||0];
  for(const ni of (sc?sc.nodes:json.nodes.map((_,i)=>i))) visit(ni,I);
  if(!parts.length) throw new Error('GLB tidak berisi mesh');
  return {parts,lo,hi,kind:'glb'};
}

/* ---------- model tambahan: kipas angin ---------- */
defModel('fan','Kipas Angin (berdiri)','floor',g=>{
  const w=MT.plastic('#f1f5f9',.55), d=MT.plastic('#1f2937',.5), bl=MT.plastic('#93c5fd',.6);
  g.cyl(.2,.22,.04,w,[0,.02,0],null,40); g.cyl(.06,.07,.03,d,[0,.055,0]);
  g.cyl(.018,.018,.9,MT.chrome(),[0,.5,0],null,16); g.cyl(.026,.026,.25,w,[0,.25,0],null,16);
  g.box(.06,.05,.06,d,[0,.97,0]); g.sph(.07,w,[0,1.02,-.07],[1,1,1.3]); g.cyl(.03,.03,.04,d,[0,1.02,.02],[90,0,0]);
  g.push({t:[0,1.02,.07],r:[90,0,0]});
  for(let i=0;i<5;i++){ g.push({r:[0,i*72,0]}); g.sph(.11,bl,[.11,0,0],[1,.12,.45],20); g.pop(); }
  g.cyl(.035,.035,.03,d,[0,0,0]);
  g.tor(.2,.006,MT.chrome(),[0,.05,0],null,null,48,6); g.tor(.2,.006,MT.chrome(),[0,-.05,0],null,null,48,6);
  for(const r of [.06,.12,.17]){ g.tor(r,.003,MT.chrome(),[0,.07+(.2-r)*.15,0],null,null,40,4); g.tor(r,.003,MT.chrome(),[0,-.07-(.2-r)*.15,0],null,null,40,4); }
  for(let i=0;i<24;i++){ const a=i/24*Math.PI*2; g.seg([Math.cos(a)*.2,.05,Math.sin(a)*.2],[Math.cos(a)*.2,-.05,Math.sin(a)*.2],.003,MT.chrome(),4,false); }
  g.cyl(.03,.03,.03,MT.plastic('#2563eb',.6),[0,.1,0]); g.pop();
});
MODEL_RULES.unshift(['fan',/kipas|\bfan\b|blower angin/]);
MODEL_RULES.unshift(['impact',/gerinda|grinder|bor listrik|mesin bor|drill/],['multimeter',/osiloskop|oscilloscope|tang ampere|clamp meter|tester/]);
MODEL_RULES.push(['toolbox',/lemari alat|rak alat|kotak alat/],['laptop',/monitor|printer/],['projector',/speaker|sound/]);
