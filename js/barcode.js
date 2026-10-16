"use strict";
/* ======================================================================
   1. CODE 128 (pembuat & pembaca barcode – tanpa library/internet)
   ====================================================================== */
const C128 = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
"221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
"221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
"212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
"231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
"231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
"314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
"112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
"111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
"214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
"114131","311141","411131","211412","211214","211232","2331112"];

function c128Values(text){
  const vals=[104];
  for(const ch of String(text)){
    const c=ch.charCodeAt(0);
    if(c<32||c>126) throw new Error('Karakter tidak didukung: '+ch);
    vals.push(c-32);
  }
  let sum=104; for(let i=1;i<vals.length;i++) sum+=vals[i]*i;
  vals.push(sum%103); vals.push(106);
  return vals;
}
function c128Widths(text){ return c128Values(text).map(v=>C128[v]).join('').split('').map(Number); }

/* Gambar batang barcode sebagai <rect> SVG di area (x,y,w,h) */
function barRects(text,x,y,w,h){
  const ws=c128Widths(text), total=ws.reduce((a,b)=>a+b,0), m=w/total;
  let cx=x, out='';
  ws.forEach((n,i)=>{ if(i%2===0) out+=`<rect x="${(cx).toFixed(2)}" y="${y}" width="${(n*m).toFixed(2)}" height="${h}"/>`; cx+=n*m; });
  return out;
}
function barcodeSVG(text,cls='mini-bc'){
  const ws=c128Widths(text), total=ws.reduce((a,b)=>a+b,0)+20; // +quiet zone 10 modul kiri/kanan
  const W=total*2, H=70;
  return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${barRects(text,20,4,W-40,46)}</g><text x="${W/2}" y="66" text-anchor="middle" font-family="Consolas,monospace" font-size="15" font-weight="700">${String(text).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';')}</text></svg>`;
}

/* ---------- Pembaca (decoder) ---------- */
const C6 = C128.map(p=>p.slice(0,6).split('').map(Number));
const ALLV=[...Array(107).keys()], STARTV=[103,104,105];
function bestMatch(r,off,cands){
  let s=0; for(let k=0;k<6;k++) s+=r[off+k];
  const sc=11/s; let best=-1,be=1e9;
  for(const v of cands){ const p=C6[v]; let e=0;
    for(let k=0;k<6;k++){ const d=r[off+k]*sc-p[k]; e+=d*d; if(e>=be) break; }
    if(e<be){be=e;best=v;} }
  return [best,be,s];
}
function valsToText(vals){
  let set=vals[0]===103?'A':vals[0]===104?'B':'C', out='';
  for(let i=1;i<vals.length;i++){
    const v=vals[i];
    if(set==='C'){ if(v<100) out+=String(v).padStart(2,'0'); else if(v===100) set='B'; else if(v===101) set='A'; }
    else if(set==='B'){ if(v<96) out+=String.fromCharCode(v+32); else if(v===99) set='C'; else if(v===101) set='A'; }
    else { if(v<64) out+=String.fromCharCode(v+32); else if(v<96) out+=String.fromCharCode(v-64); else if(v===99) set='C'; else if(v===100) set='B'; }
  }
  return out;
}
function decodeRuns(runs,firstDark){
  for(let i=firstDark?0:1;i+6+6+6+6<=runs.length;i+=2){
    const [sv,se,sw]=bestMatch(runs,i,STARTV);
    if(se>0.7) continue;
    const mw=sw/11;
    if(i>0 && runs[i-1]<mw*3) continue;              // butuh zona putih sebelum start
    const vals=[sv]; let j=i+6, ok=false;
    while(j+6<=runs.length && vals.length<64){
      const [v,e,w]=bestMatch(runs,j,ALLV);
      if(e>1.0 || w<sw*0.7 || w>sw*1.3) break;
      if(v===106){ ok=true; break; }
      if(v>=103) break;
      vals.push(v); j+=6;
    }
    if(!ok||vals.length<3) continue;
    const chk=vals.pop(); let sum=vals[0];
    for(let k=1;k<vals.length;k++) sum+=vals[k]*k;
    if(sum%103!==chk) continue;
    const t=valsToText(vals);
    if(t) return t;
  }
  return null;
}
function runsFrom(sig,thr){
  const n=sig.length, edges=[]; let prev=sig[0]<thr[0]; const firstDarkPx=prev;
  for(let x=1;x<n;x++){
    const cur=sig[x]<thr[x];
    if(cur!==prev){ const d0=sig[x-1]-thr[x-1], d1=sig[x]-thr[x]; edges.push(x-1+(d0/((d0-d1)||1e-6))); prev=cur; }
  }
  const runs=[]; for(let k=1;k<edges.length;k++) runs.push(edges[k]-edges[k-1]);
  return {runs, firstDark:!firstDarkPx};
}
function decodeLine(g){
  const n=g.length; if(n<60) return null;
  const s=new Float32Array(n);
  s[0]=g[0]; s[n-1]=g[n-1];
  for(let x=1;x<n-1;x++) s[x]=(g[x-1]+2*g[x]+g[x+1])/4;
  let mn=255,mx=0; for(let x=0;x<n;x++){ if(s[x]<mn)mn=s[x]; if(s[x]>mx)mx=s[x]; }
  if(mx-mn<35) return null;
  const variants=[];
  // a) ambang global
  variants.push(new Float32Array(n).fill((mn+mx)/2));
  // b) ambang lokal (min/max bergeser)
  const w=Math.max(12,Math.round(n/18)), t=new Float32Array(n), gmid=(mn+mx)/2, grange=mx-mn;
  for(let x=0;x<n;x++){
    let a=255,b=0; const lo=Math.max(0,x-w), hi=Math.min(n-1,x+w);
    for(let k=lo;k<=hi;k+=2){ const v=s[k]; if(v<a)a=v; if(v>b)b=v; }
    t[x]=(b-a)<grange*0.3?gmid:(a+b)/2;
  }
  variants.push(t);
  const tries=[]; for(const thr of variants){ tries.push([s,thr]); tries.push([g,thr]); }
  for(const [sig,thr] of tries){
    const {runs,firstDark}=runsFrom(sig,thr);
    if(runs.length<30) continue;
    let r=decodeRuns(runs,firstDark); if(r) return r;
    const rev=runs.slice().reverse(); const lastDark = (runs.length%2===1)?firstDark:!firstDark;
    r=decodeRuns(rev,lastDark); if(r) return r;
  }
  return null;
}
function decodeImageData(img,rowsN=28,colsN=10){
  const {width:W,height:H,data}=img;
  const lum=(i)=>data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114;
  const ys=[]; const mid=H/2;
  for(let k=0;k<rowsN;k++){ const off=Math.ceil(k/2)*(H*0.9/rowsN)*(k%2?1:-1); ys.push(Math.round(mid+off)); }
  for(const y of ys){
    if(y<1||y>=H-1) continue;
    const g=new Float32Array(W);
    for(let x=0;x<W;x++){ const i=(y*W+x)*4; g[x]=(lum(i-W*4)+lum(i)*2+lum(i+W*4))/4; }
    const r=decodeLine(g); if(r) return r;
  }
  for(let k=1;k<=colsN;k++){
    const x=Math.round(W*k/(colsN+1)); const g=new Float32Array(H);
    for(let y=0;y<H;y++) g[y]=lum((y*W+x)*4);
    const r=decodeLine(g); if(r) return r;
  }
  return null;
}

