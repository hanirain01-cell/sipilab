"use strict";
/* ======================================================================
   SiPinLab v6 – fungsi bersama (UI dasar, tema sekolah, visual 3D alat)
   ====================================================================== */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>t?new Date(t).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'–';
const fmtJam=t=>{ if(!t) return '–'; const d=new Date(t), n=new Date(); const same=d.toDateString()===n.toDateString();
  return same?'Hari ini '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):d.toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); };
function dur(from){ const m=Math.max(0,Math.floor((Date.now()-new Date(from))/60000)); if(m<60) return m+' menit'; const h=Math.floor(m/60); if(h<24) return h+' jam'; return Math.floor(h/24)+' hari'; }
const store={get(k,d){try{const v=localStorage.getItem('sipinlab_'+k);return v===null?d:v;}catch(e){return d;}},set(k,v){try{localStorage.setItem('sipinlab_'+k,v);}catch(e){}},del(k){try{localStorage.removeItem('sipinlab_'+k);}catch(e){}}};
const pill=(st,txt)=>`<span class="pill p-${st}">${esc(txt||({tersedia:'Tersedia',dipinjam:'Dipinjam',rusak:'Rusak'})[st]||LOAN_STATUS[st]||st)}</span>`;
const baseName=n=>String(n||'').replace(/\s*#\d+\s*$/,'').trim();

/* ---------- ikon garis sederhana ---------- */
const IC={
  plus:'<path d="M12 5v14M5 12h14"/>', search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', check:'<path d="m5 12 5 5L20 7"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>', back:'<path d="M15 18l-6-6 6-6"/>', copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  out:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>', cube:'<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  rotate:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>', camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>', link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  download:'<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>', bag:'<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon=(k,s=18)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]||''}</svg>`;

/* ---------- toast, sibuk, dialog ---------- */
let busyN=0;
function toast(msg,type=''){ const t=document.createElement('div'); t.className='toast '+type; t.innerHTML=msg; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),3400); setTimeout(()=>t.remove(),3800); }
function busy(on){ busyN=Math.max(0,busyN+(on?1:-1)); $('busy').classList.toggle('show',busyN>0); }
async function run(fn,okMsg){ busy(true); try{ const r=await fn(); if(okMsg) toast(okMsg,'ok'); return {ok:true,r}; }
  catch(e){ console.warn(e); toast(esc(translateErr(e&&e.message||e)),'bad'); return {ok:false,e}; } finally{ busy(false); } }
function dialog(html,cls=''){ const b=$('dlgBox'); b.className='dlg '+cls; b.innerHTML=html; $('dlgModal').classList.add('show'); const f=b.querySelector('[autofocus],input,select,textarea'); if(f) setTimeout(()=>f.focus(),40); }
function closeDialog(){ $('dlgModal').classList.remove('show'); $('dlgBox').innerHTML=''; if(window.onDialogClose) window.onDialogClose(); }
function confirmBox(msg,okText='Ya, lanjutkan',danger=false){
  return new Promise(res=>{ dialog(`<h3>Konfirmasi</h3><p class="dlg-text">${msg}</p><div class="dlg-actions"><button class="btn ghost" id="cNo">Batal</button><button class="btn ${danger?'danger':''}" id="cYes">${okText}</button></div>`);
    $('cNo').onclick=()=>{closeDialog();res(false);}; $('cYes').onclick=()=>{closeDialog();res(true);}; });
}
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
async function copyText(t){ try{ await navigator.clipboard.writeText(t); toast('Link disalin','ok'); }catch(e){ prompt('Salin link ini:',t); } }
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&$('dlgModal').classList.contains('show')) closeDialog(); });
document.addEventListener('click',e=>{ if(e.target.id==='dlgModal') closeDialog(); });

/* ---------- tema sekolah ---------- */
const PALETTES=['#2563eb','#0f766e','#b45309','#be123c','#7c3aed','#15803d','#0e7490','#334155'];
function hx(h){ h=String(h||'#2563eb').replace('#',''); return [0,2,4].map(i=>parseInt(h.substr(i,2),16)||0); }
function mixc(a,b,t){ const A=hx(a),B=hx(b); return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join(''); }
const isImg=l=>/^(https?:|data:image)/.test(String(l||''));
function logoHTML(l){ return isImg(l)?`<img src="${esc(l)}" alt="">`:esc(l||'🔬'); }
function applyTheme(sc,suffix){
  const w=(sc&&sc.warna)||'#2563eb', w2=(sc&&sc.warna2)||mixc(w,'#020617',.72), r=document.documentElement.style;
  r.setProperty('--acc',w); r.setProperty('--acc-ink',mixc(w,'#000000',.25)); r.setProperty('--acc-soft',mixc(w,'#ffffff',.86)); r.setProperty('--acc-line',mixc(w,'#ffffff',.6)); r.setProperty('--acc-l',mixc(w,'#ffffff',.35));
  r.setProperty('--side1',w2); r.setProperty('--side2',mixc(w2,w,.28));
  const m=document.querySelector('meta[name=theme-color]'); if(m) m.setAttribute('content',w2);
  document.title=(sc&&sc.nama?sc.nama+' · ':'')+(suffix||'SiPinLab');
}
/* kode sekolah dari URL: /<kode>, /<kode>/admin, atau ?s=<kode> */
function urlKode(){ const q=new URLSearchParams(location.search).get('s'); if(q) return q.toLowerCase();
  if(location.protocol==='file:'||/\.html$/.test(location.pathname)) return '';
  const seg=location.pathname.replace(/^\/+|\/+$/g,'').split('/')[0]||''; return /^[a-z0-9][a-z0-9-]{1,29}$/.test(seg)&&!['admin','index','pinjam'].includes(seg)?seg:''; }
const isLocal=()=>/\.html$/.test(location.pathname)||/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)||location.protocol==='file:';
const localURL=f=>new URL(f,location.href).href.replace(/#.*$/,'');
const linkSiswa=kode=>isLocal()?localURL('pinjam.html?s='+kode):location.origin+'/'+kode;
const linkAdmin=kode=>isLocal()?localURL('index.html?s='+kode):location.origin+'/'+kode+'/admin';

/* ======================================================================
   VISUAL 3D ALAT (dipakai halaman kepala lab & siswa)
   Urutan: model AI (.glb) → 3D dari foto → model bawaan dari nama
   ====================================================================== */
function visualOf(it){
  const url=it.foto3d_url||it.foto_url, m=it.model||'';
  if(m==='ai'&&it.model3d_url) return {type:'glb',url:it.model3d_url};
  if(m==='relief'&&url) return {type:'relief',url};
  if(m==='foto'&&url) return {type:'foto',url};
  if(m&&MODELS[m]) return {type:'model',key:m};
  if(it.model3d_url) return {type:'glb',url:it.model3d_url};
  if(url) return {type:'relief',url};
  return {type:'model',key:guessModel(baseName(it.nama))};
}
const VIS_NAME={glb:'Model 3D AI',relief:'3D dari foto',foto:'Foto berdiri'};
const visName=v=>v.type==='model'?'Model bawaan: '+MODELS[v.key].name:VIS_NAME[v.type];
const tmCache=new Map(); const meshListeners=new Set();
function loadImgURL(url){ return new Promise((res,rej)=>{ const im=new Image(); if(!/^data:|^blob:/.test(url)) im.crossOrigin='anonymous'; im.onload=()=>res(im); im.onerror=()=>rej(new Error('Gambar tidak bisa dimuat')); im.src=url; }); }
function tmData(v){ const key=v.type+':'+v.url; let e=tmCache.get(key); if(e) return e; e={key,state:'loading'}; tmCache.set(key,e);
  const job=v.type==='relief'?loadImgURL(v.url).then(img=>reliefFromImage(img,v.url))
    :fetch(v.url).then(r=>{ if(!r.ok) throw new Error('Model 3D tidak bisa diunduh ('+r.status+')'); return r.arrayBuffer(); }).then(parseGLB);
  job.then(d=>{ if(!d) throw new Error('Bentuk alat tidak terdeteksi pada foto'); e.state='ready'; e.data=d; },err=>{ e.state='error'; e.err=err; console.warn('visual 3D:',err.message); })
    .then(()=>meshListeners.forEach(f=>f(key)));
  return e; }
function resolveVisual(V,it){ const v=visualOf(it);
  if(v.type==='relief'||v.type==='glb'){ const e=tmData(v);
    if(e.state==='ready') return {kind:'tm',tm:V.tmesh(e.key,e.data),v};
    const ph=it.foto3d_url||it.foto_url; if(ph) return {kind:'bb',url:ph,v,loading:e.state==='loading'};
    return {kind:'model',key:guessModel(baseName(it.nama)),v}; }
  if(v.type==='foto') return {kind:'bb',url:v.url,v};
  return {kind:'model',key:v.key,v}; }
function stageFoto(view,url,h){
  const ground=view.geo('ground',g=>g.cyl(10,10,.002,G3.MT.ground(),[0,-.001,0],null,64)), blob=view.geo('blob',g=>g.blob(.5,.5));
  view.objs=[{g:ground,m:G3.M.inst(0,0,0,0,h*.45),noShadow:true},{g:blob,m:G3.M.inst(0,.003,0,0,h*.75),noShadow:true},{bb:{url,h,pos:[0,0,0]}}];
  const R=h*.75; Object.assign(view.scene,{center:[0,h/2,0],radius:R*1.7,fade:R*2.6,exp:1.02,sun:[-.6,.95,.45]});
  Object.assign(view.cam,{t:[0,h*.48,0],dist:R/Math.tan(view.cam.fov*Math.PI/360)*1.15,min:R*.6,max:R*6,pitch:.18});
}
function stageTM(view,tm,keepCam){ const lo=tm.lo,hi=tm.hi, s=1/Math.max(1e-6,hi[1]-lo[1]), w=Math.max(hi[0]-lo[0],hi[2]-lo[2])*s, R=.5*Math.hypot(w,1,w);
  const ground=view.geo('ground',g=>g.cyl(10,10,.002,G3.MT.ground(),[0,-.001,0],null,64));
  view.objs=[{g:ground,m:G3.M.inst(0,0,0,0,R*.4),noShadow:true},{tm,m:G3.M.mul(G3.M.inst(0,0,0,0,s),G3.M.tr(-(lo[0]+hi[0])/2,-lo[1],-(lo[2]+hi[2])/2))}];
  Object.assign(view.scene,{center:[0,.5,0],radius:R*1.7,fade:R*2.6,exp:1.05,sun:[-.6,.95,.45]});
  if(!keepCam) Object.assign(view.cam,{t:[0,.45,0],dist:R/Math.tan(view.cam.fov*Math.PI/360)*1.1,min:R*.5,max:R*6,pitch:.28}); }
function stageItem(view,it,keepCam){ const r=resolveVisual(view,it);
  if(r.kind==='tm') stageTM(view,r.tm,keepCam); else if(r.kind==='bb') stageFoto(view,r.url,1); else stageModel(view,r.key); view.invalidate(); return r; }

/* gambar diam untuk kartu alat */
let thumbView=null; const thumbCache={};
function thumb(key){ if(key in thumbCache) return thumbCache[key];
  try{ if(!thumbView){ const c=document.createElement('canvas'); c.width=360; c.height=300; thumbView=new G3.View(c,{auto:false,noInput:true,smSize:1024}); }
    stageModel(thumbView,key); thumbView.cam.yaw=.7; thumbView.render(0); thumbCache[key]=thumbView.cv.toDataURL('image/png'); }catch(e){ thumbCache[key]=''; }
  return thumbCache[key]; }
function itemImg(it){ const v=visualOf(it); if(v.type==='model') return thumb(v.key); return it.foto3d_url||it.foto_url||thumb(guessModel(baseName(it.nama))); }
function imgHTML(it,cls='pic'){ const s=itemImg(it), fill=s&&s.startsWith('data:image/png')&&Object.values(thumbCache).includes(s); return `<div class="${cls}${fill?' fill':''}">${s?`<img src="${esc(s)}" alt="" loading="lazy">`:icon('cube',28)}</div>`; }

/* penampil 3D interaktif (satu kanvas, bisa dipakai ulang) */
class Viewer3D{
  constructor(canvas){ this.cv=canvas; this.item=null; try{ this.view=new G3.View(canvas,{auto:true}); }catch(e){ this.view=null; }
    this._l=key=>{ if(this.item&&this.view&&this.cv.isConnected){ const v=visualOf(this.item); if(v.url&&key===v.type+':'+v.url) stageItem(this.view,this.item,true); } };
    meshListeners.add(this._l); }
  show(it){ this.item=it; if(!this.view) return false; const r=stageItem(this.view,it); this.view.cam.yaw=.75; this.view.auto=true; this.view.start(); return r; }
  reset(){ if(this.item&&this.view){ stageItem(this.view,this.item); this.view.cam.yaw=.75; } }
  spin(){ if(this.view){ this.view.auto=!this.view.auto; this.view.idle=0; this.view.invalidate(); } return this.view&&this.view.auto; }
  destroy(){ if(this.view) this.view.stop(); meshListeners.delete(this._l); this.item=null; }
}
const ok3D=(()=>{ try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl')); }catch(e){ return false; } })();
let _viewer=null;
function mountViewer(container,it){
  if(!_viewer){ const c=document.createElement('canvas'); c.className='v3-canvas'; _viewer=new Viewer3D(c); }
  container.appendChild(_viewer.cv); if(it) _viewer.show(it); return _viewer;
}
