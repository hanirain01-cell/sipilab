"use strict";
/* ======================================================================
   SiPinLab v3 – aplikasi utama
   ====================================================================== */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>t?new Date(t).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-';
function dur(from){ const m=Math.floor((Date.now()-new Date(from))/60000); if(m<60) return m+' menit'; const h=Math.floor(m/60); if(h<24) return h+' jam '+(m%60)+' mnt'; return Math.floor(h/24)+' hari'; }
const pref={get(k,d){try{const v=localStorage.getItem('sipinlab_pref_'+k);return v===null?d:v;}catch(e){return d;}},set(k,v){try{localStorage.setItem('sipinlab_pref_'+k,v);}catch(e){}}};

let API=null, me=null, users=[], busyN=0;
let db={school:null,labs:[],furniture:[],anggota:[],items:[],loans:[]}, schools=[], superMode=false;
const anggotaById=id=>db.anggota.find(a=>a.id===id);
const itemById=id=>db.items.find(i=>i.id===id);
const labById=id=>db.labs.find(l=>l.id===id);
const openLoan=itemId=>db.loans.find(l=>l.item_id===itemId&&!l.kembali);
const isSuper=()=>!!me&&me.role==='superadmin';
const isAdmin=()=>!!me&&(me.role==='admin'||isSuper());
const can=k=>!!me&&me.aktif!==false&&(isSuper()?!!API.sid:(me.role==='admin'||(me.menus||[]).includes(k)));
const schoolName=()=>(db.school&&db.school.nama)||'SiPinLab';
const appLink=kode=>location.origin+'/'+kode;

/* ---------------- UI dasar ---------------- */
function toast(msg,type=''){ const t=document.createElement('div'); t.className='toast '+type; t.innerHTML=msg; $('toasts').appendChild(t); setTimeout(()=>t.remove(),3800); }
function busy(on){ busyN=Math.max(0,busyN+(on?1:-1)); $('busy').classList.toggle('show',busyN>0); }
async function run(fn,okMsg){ busy(true); try{ const r=await fn(); if(okMsg) toast(okMsg,'ok'); return {ok:true,r}; }
  catch(e){ console.warn(e); toast('❌ '+esc(translateErr(e&&e.message||e)),'bad'); return {ok:false,e}; } finally{ busy(false); } }
function dialog(html){ $('dlgBox').className='box'; $('dlgBox').innerHTML=html; $('dlgModal').classList.add('show'); }
function closeDialog(){ $('dlgModal').classList.remove('show'); $('dlgBox').innerHTML=''; }
function confirmBox(msg,okText='Ya, lanjutkan',danger=false){
  return new Promise(res=>{ dialog(`<h3>Konfirmasi</h3><p style="margin:0 0 18px">${msg}</p><div class="row" style="justify-content:flex-end"><button class="btn sec" id="cNo">Batal</button><button class="btn ${danger?'red':''}" id="cYes">${okText}</button></div>`);
    $('cNo').onclick=()=>{closeDialog();res(false);}; $('cYes').onclick=()=>{closeDialog();res(true);}; });
}
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
let audioCtx=null;
function beep(ok=true){ try{ audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.frequency.value=ok?1200:300; o.connect(g); g.connect(audioCtx.destination);
  g.gain.setValueAtTime(.15,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.18); o.start(); o.stop(audioCtx.currentTime+.2); }catch(e){} }
const slug=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'').slice(0,24);

/* ======================================================================
   TEMA SEKOLAH (warna & logo)
   ====================================================================== */
const PALETTES=[['#2563eb','#0b1f4d'],['#dc2626','#450a0a'],['#16a34a','#052e16'],['#7c3aed','#2e1065'],['#ea580c','#431407'],['#0891b2','#083344'],['#db2777','#500724'],['#475569','#0f172a']];
function hx(h){ h=String(h||'#2563eb').replace('#',''); return [0,2,4].map(i=>parseInt(h.substr(i,2),16)||0); }
function mixc(a,b,t){ const A=hx(a),B=hx(b); return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join(''); }
const isImg=l=>/^(https?:|data:image)/.test(String(l||''));
function logoHTML(l){ return isImg(l)?`<img src="${esc(l)}" alt="">`:esc(l||'🔬'); }
function applyTheme(sc){
  const w=(sc&&sc.warna)||'#2563eb', w2=(sc&&sc.warna2)||'#0b1f4d', r=document.documentElement.style;
  r.setProperty('--pri',w); r.setProperty('--pri-d',mixc(w,'#000000',.22)); r.setProperty('--pri-soft',mixc(w,'#ffffff',.86)); r.setProperty('--pri-l',mixc(w,'#ffffff',.35));
  r.setProperty('--side1',w2); r.setProperty('--side2',mixc(w2,w,.28));
  document.querySelector('meta[name=theme-color]').setAttribute('content',w2);
  document.title=(sc&&sc.nama?sc.nama+' – ':'')+'SiPinLab';
}

/* ======================================================================
   BOOT & LOGIN
   ====================================================================== */
function urlKode(){ const q=new URLSearchParams(location.search).get('s'); if(q) return q.toLowerCase();
  const seg=location.pathname.replace(/^\/+|\/+$/g,''); return /^[a-z0-9][a-z0-9-]{1,29}$/.test(seg)&&seg!=='index.html'?seg:''; }
let loginKodeTimer=null, kodeFromLink='';
async function showLoginSchool(kode){
  kode=String(kode||'').trim().toLowerCase(); const hint=$('kodeHint');
  if(superMode||!kode){ applyTheme(null); $('loginLogo').innerHTML='🔬'; $('loginTitle').textContent='SiPinLab'; $('loginSchool').textContent=superMode?'Masuk sebagai Super Admin (pengelola semua sekolah)':'Sistem Peminjaman Alat Laboratorium'; hint.textContent=''; return null; }
  const sc=await API.schoolInfo(kode);
  if(!sc){ applyTheme(null); $('loginLogo').innerHTML='🔬'; $('loginTitle').textContent='SiPinLab'; $('loginSchool').textContent='Sistem Peminjaman Alat Laboratorium'; hint.innerHTML='⚠️ Kode sekolah tidak ditemukan'; return null; }
  applyTheme(sc); $('loginLogo').innerHTML=logoHTML(sc.logo); $('loginTitle').textContent=sc.nama; $('loginSchool').textContent='SiPinLab – Peminjaman Alat Laboratorium';
  hint.innerHTML=sc.aktif?`✅ ${esc(sc.nama)}`:'⛔ Sekolah ini sedang dinonaktifkan'; return sc;
}
function setSuperMode(on){ superMode=on; $('kodeWrap').hidden=on; $('superToggle').textContent=on?'🏫 Masuk sebagai akun sekolah':'🛡️ Masuk sebagai Super Admin'; showLoginSchool($('lgKode').value); }
async function boot(){
  busy(true);
  try{ API=await createAPI(); }
  catch(e){ busy(false); $('loginView').hidden=false; showLoginErr(e.message); $('loginForm').hidden=true; return; }
  try{
    kodeFromLink=urlKode(); let k=kodeFromLink||pref.get('kode','');
    $('lgKode').value=k; if(kodeFromLink){ $('lgKode').readOnly=true; $('kodeHint').dataset.locked=1; }
    if(API.mode==='demo'){ $('demoNote').hidden=false;
      $('demoNote').innerHTML=(API.cfgMissing?'⚠️ <b>Supabase belum dikonfigurasi</b> di Vercel → <b>Mode Demo</b>.<br>':'🧪 <b>Mode Demo</b> – data tersimpan di browser ini saja.<br>')+'Sekolah: kode <b>demo</b>, login <b>admin</b> / <b>admin123</b><br>Super Admin: <b>super</b> / <b>super123</b>';
      if(!k){ k='demo'; $('lgKode').value='demo'; } }
    me=await API.session();
    if(me) return enterApp();
    if(API.mode==='supabase'&&await API.needsSetup()){ $('loginForm').hidden=true; $('setupForm').hidden=false;
      if(API.cfgInfo&&!API.cfgInfo.adminApi) showLoginErr('SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel, akun belum bisa dibuat.'); }
    await showLoginSchool(k);
    $('loginView').hidden=false; setTimeout(()=>($('setupForm').hidden?(k?$('lgUser'):$('lgKode')):$('suNama')).focus(),50);
  }catch(e){ $('loginView').hidden=false; showLoginErr(translateErr(e.message)); }
  finally{ busy(false); }
}
function showLoginErr(m){ $('loginErr').hidden=!m; $('loginErr').textContent=m||''; }
$('lgKode').addEventListener('input',()=>{ clearTimeout(loginKodeTimer); loginKodeTimer=setTimeout(()=>showLoginSchool($('lgKode').value),350); });
$('superToggle').addEventListener('click',e=>{ e.preventDefault(); setSuperMode(!superMode); });
$('loginForm').addEventListener('submit',async e=>{ e.preventDefault(); showLoginErr('');
  const kode=superMode?'':$('lgKode').value.trim().toLowerCase();
  if(!superMode&&!kode){ showLoginErr('Isi kode sekolah (tanya admin sekolah Anda)'); return $('lgKode').focus(); }
  busy(true); try{ me=await API.login(kode,$('lgUser').value,$('lgPass').value); $('lgPass').value=''; if(kode) pref.set('kode',kode); await enterApp(); }
  catch(err){ showLoginErr(translateErr(err.message)); } finally{ busy(false); } });
$('setupForm').addEventListener('submit',async e=>{ e.preventDefault(); showLoginErr('');
  busy(true); try{ await API.setupSuper({nama:$('suNama').value,username:$('suUser').value,password:$('suPass').value});
    me=await API.login('',$('suUser').value,$('suPass').value); await enterApp(); toast('Akun Super Admin dibuat. Langkah berikutnya: tambah sekolah.','ok'); }
  catch(err){ showLoginErr(translateErr(err.message)); } finally{ busy(false); } });
$('logoutBtn').addEventListener('click',async()=>{ if(ed&&ed.dirty&&!await confirmBox('Perubahan tata letak belum disimpan. Tetap keluar?','Keluar',true)) return;
  await API.logout(); location.reload(); });

let liveTimer=null;
async function enterApp(){
  $('loginView').hidden=true; $('appView').hidden=false;
  $('ucName').textContent=me.nama||me.username; $('ucRole').innerHTML=esc(ROLE_NAME[me.role]||me.role)+`<span class="mode-pill ${API.mode==='demo'?'mode-demo':'mode-live'}">${API.mode==='demo'?'DEMO':'ONLINE'}</span>`;
  $('ucAv').textContent=(me.nama||me.username||'?').trim().charAt(0).toUpperCase();
  if(isSuper()){ await loadSchools(); const keep=pref.get('sid',''); API.sid=schools.some(x=>x.id===keep)?keep:null; $('schoolSwitch').hidden=false; }
  else API.sid=me.school_id;
  buildNav(); await reload(); if(isAdmin()&&API.sid) loadUsers();
  API.subscribe(()=>{ clearTimeout(liveTimer); liveTimer=setTimeout(()=>reload(true),500); });
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&API.mode==='supabase') reload(true); });
  const want=location.hash.slice(1)||pref.get('tab','beranda'); goTab(allowedTab(want)?want:firstTab());
}
async function loadSchools(){ const r=await run(()=>API.listSchools()); if(r.ok) schools=r.r; renderSidSel(); renderSekolah(); }
function renderSidSel(){ if(!isSuper()) return; $('sidSel').innerHTML='<option value="">— pilih sekolah —</option>'+schools.map(x=>`<option value="${x.id}" ${x.id===API.sid?'selected':''}>${esc(x.nama)}${x.aktif?'':' (nonaktif)'}</option>`).join(''); }
async function switchSchool(id){
  if(ed&&ed.dirty&&!await confirmBox('Perubahan tata letak belum disimpan. Tetap pindah sekolah?','Pindah',true)){ renderSidSel(); return; }
  ed=null; API.sid=id||null; pref.set('sid',API.sid||''); activeMember=null; users=[]; window.__hero=0; if(labView) labView._lab=null;
  buildNav(); await reload(); if(API.sid) loadUsers(); renderSidSel();
  goTab(API.sid?(curTab==='sekolah'?'beranda':curTab):'sekolah');
  if(API.sid) toast(`Sekarang mengelola <b>${esc(schoolName())}</b>`,'ok');
}
async function reload(silent){
  const r=silent?{ok:true,r:await API.loadAll().catch(()=>null)}:await run(()=>API.loadAll());
  if(r.ok&&r.r) db=r.r; renderAll(); aiPoll();
}
async function loadUsers(){ if(!isAdmin()||!API.sid) return; const r=await API.listUsers().catch(e=>{ toast('❌ '+esc(e.message),'bad'); return null; }); if(r){ users=r; renderAkun(); renderUsers(); } }

/* ======================================================================
   NAVIGASI & HAK AKSES
   ====================================================================== */
const TITLES={sekolah:'Kelola Sekolah',beranda:'Beranda',lab3d:'Lab 3D',scan:'Scan Pinjam / Kembali',anggota:'Anggota & Kartu Barcode',alat:'Alat Laboratorium',riwayat:'Riwayat Peminjaman',akun:'Akun & Hak Akses',pengaturan:'Pengaturan'};
function navItems(){ const L=MENUS.filter(m=>!m.nonav&&can(m.key));
  if(isAdmin()&&API.sid){ const i=L.findIndex(m=>m.key==='pengaturan'); L.splice(i>=0?i:L.length,0,{key:'akun',ic:'🔑',label:'Akun & Hak Akses'}); }
  if(isSuper()) L.unshift({key:'sekolah',ic:'🏫',label:'Kelola Sekolah'}); return L; }
const allowedTab=k=>navItems().some(m=>m.key===k);
const firstTab=()=>(navItems()[0]||{key:'beranda'}).key;
function buildNav(){ $('nav').innerHTML=navItems().map(m=>`<button class="navbtn" data-tab="${m.key}"><span class="ic">${m.ic}</span>${esc(m.label)}</button>`).join(''); }
let curTab='beranda';
function goTab(name){
  if(!allowedTab(name)) name=firstTab(); curTab=name; pref.set('tab',name); history.replaceState(null,'','#'+name);
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id==='tab-'+name));
  $('pageTitle').textContent=TITLES[name]||'';
  renderAll();
  if(name==='lab3d'){ renderLab(); if(labView) labView.start(); } else if(labView) labView.stop();
  if(name==='scan') setTimeout(()=>$('scanInput').focus(),60);
  if(name==='akun') loadUsers();
  if(name==='sekolah'){ loadSchools(); loadSupers(); }
  window.scrollTo(0,0);
}

/* ======================================================================
   RENDER
   ====================================================================== */
const STATUS_COL={tersedia:'#22c55e',dipinjam:'#f59e0b',rusak:'#ef4444'};
const STATUS_TXT={tersedia:'Tersedia',dipinjam:'Dipinjam',rusak:'Rusak'};
function statusBadge(it){ return it.status==='dipinjam'?'<span class="badge b-warn">Dipinjam</span>':it.status==='rusak'?'<span class="badge b-bad">Rusak</span>':'<span class="badge b-ok">Tersedia</span>'; }
function lastUserText(it){ if(!it.pemakai_terakhir) return '<span class="muted">Belum pernah dipakai</span>';
  const u=anggotaById(it.pemakai_terakhir); return `<b>${esc(u?u.nama:(it.pemakai_nama||it.pemakai_terakhir))}</b><div class="muted">${esc(u?[u.peran,u.kelas].filter(Boolean).join(' • '):it.pemakai_terakhir)}</div>`; }
const labName=id=>{ const l=labById(id); return l?l.nama:'—'; };

function renderAll(){
  if(!me) return;
  const sc=db.school; applyTheme(sc);
  $('schoolName').textContent=sc?sc.nama+' — catat siapa memakai alat apa, kapan, dan bagaimana kondisinya':'Pilih sekolah yang ingin dikelola di menu samping.';
  $('brandName').textContent=sc?sc.nama:'SiPinLab'; $('sideSchool').textContent=sc?'SiPinLab':'Super Admin'; $('brandLogo').innerHTML=logoHTML(sc&&sc.logo);
  renderIdent(); if(isSuper()) renderSekolah();
  $('modeBanner').classList.toggle('show',API.mode==='demo');
  $('modeBanner').innerHTML=API.mode==='demo'?`🧪 <b>Mode Demo</b>: data tersimpan di browser ini saja.${API.cfgMissing?' Isi Environment Variables Supabase di Vercel agar data tersimpan online.':''}`:'';
  $('dbInfo').innerHTML=`Mode: <b>${API.mode==='demo'?'Demo (browser)':'Supabase (online)'}</b> • Sekolah: <b>${esc(schoolName())}</b>${sc?` (kode <b>${esc(sc.kode)}</b>)`:''} • ${db.labs.length} lab • ${db.anggota.length} anggota • ${db.items.length} alat • ${db.loans.length} transaksi`;
  $('btnSeed').hidden=!(isAdmin()&&API.sid); $('btnResetDemo').hidden=!(isSuper()&&API.mode==='demo');
  fillSelects(); renderHome(); renderUsers(); renderItems(); renderHistory(); renderRecent(); renderMember(); renderAkun();
  if(curTab==='lab3d') renderLab();
  if(v3Id&&$('v3Modal').classList.contains('show')) renderV3Info();
}
function fillSelects(){
  const labOpts=db.labs.map(l=>`<option value="${l.id}">${esc(l.nama)}</option>`).join('');
  const keep=(el,html)=>{ const v=el.value; el.innerHTML=html; if([...el.options].some(o=>o.value===v)) el.value=v; };
  keep($('iLab'),'<option value="">— tanpa lab —</option>'+labOpts);
  if(!$('iLab').value&&db.labs[0]&&!$('iLab').dataset.touched) $('iLab').value=db.labs[0].id;
  keep($('iFilterLab'),'<option value="">Semua lab</option>'+labOpts);
  keep($('akAnggota'),'<option value="">— tidak dihubungkan —</option>'+db.anggota.map(a=>`<option value="${a.id}">${esc(a.nama)} (${a.id})</option>`).join(''));
  keep($('manUser'),'<option value="">— Pilih anggota —</option>'+db.anggota.map(u=>`<option value="${u.id}">${esc(u.nama)} (${u.id})</option>`).join(''));
  keep($('manItem'),'<option value="">— Pilih alat —</option>'+db.items.map(i=>`<option value="${i.id}">${esc(i.nama)} — ${i.status}</option>`).join(''));
  if(!$('iModel').options.length) $('iModel').innerHTML=modelOptions('');
}
function renderHome(){
  const today=new Date().toDateString();
  $('sUser').textContent=db.anggota.length; $('sItem').textContent=db.items.length;
  $('sOut').textContent=db.items.filter(i=>i.status==='dipinjam').length;
  $('sToday').textContent=db.loans.filter(l=>new Date(l.pinjam).toDateString()===today||(l.kembali&&new Date(l.kembali).toDateString()===today)).length;
  $('welcomeCard').hidden=!(isAdmin()&&API.sid&&!db.items.length&&!db.labs.length);
  $('hero3d').hidden=!can('lab3d');
  if(can('lab3d')&&!window.__hero){ window.__hero=1; const u=heroImage(); if(u) $('heroImg').src=u; else $('heroImg').style.display='none'; }
  const mine=me.anggota_id&&anggotaById(me.anggota_id);
  $('myCard').hidden=!mine;
  if(mine){ const L=db.loans.filter(l=>l.anggota_id===mine.id&&!l.kembali);
    $('myCard').innerHTML=`<div class="grid two" style="align-items:center"><div class="mycard">${cardSVG(mine)}</div><div><h2>🪪 Kartu pinjam saya</h2>
      <p class="sub">Tunjukkan kartu ini (atau layar ini) ke petugas saat meminjam alat.</p>
      <b>Sedang saya pinjam:</b> ${L.length?L.map(l=>`<div class="row" style="margin-top:6px"><span class="badge b-warn">${esc(l.item_nama)}</span><span class="muted">sejak ${fmt(l.pinjam)}</span></div>`).join(''):'<div class="muted">Tidak ada</div>'}
      <div class="row" style="margin-top:12px"><button class="btn sm" data-act="pngCard" data-id="${mine.id}">⬇️ Unduh kartu</button></div></div></div>`; }
  const out=db.loans.filter(l=>!l.kembali);
  $('tOut').innerHTML=out.length?out.map(l=>`<tr><td><b>${esc(l.item_nama)}</b><div class="muted code">${l.item_id}</div></td><td>${esc(l.anggota_nama)}</td><td>${fmt(l.pinjam)}</td>
    <td><span class="badge ${Date.now()-new Date(l.pinjam)>864e5?'b-bad':'b-warn'}">${dur(l.pinjam)}</span></td></tr>`).join(''):`<tr><td colspan="4" class="empty">Semua alat ada di tempat 👍</td></tr>`;
  $('tStatus').innerHTML=db.items.length?db.items.map(i=>`<tr><td class="code">${i.id}</td><td><div class="row" style="flex-wrap:nowrap">${thumbHTML(i,'thumb sm')}<span>${esc(i.nama)}</span></div></td>
    <td>${esc(labName(i.lab_id))}</td><td>${statusBadge(i)}</td><td>${lastUserText(i)}</td><td>${fmt(i.waktu_terakhir)}</td></tr>`).join('')
    :`<tr><td colspan="6" class="empty">Belum ada alat.</td></tr>`;
}

/* ---------------- ANGGOTA ---------------- */
async function addUser(){
  const nama=$('uNama').value.trim(); if(!nama){ toast('Nama wajib diisi','bad'); return $('uNama').focus(); }
  const r=await run(()=>API.addAnggota([{nama,peran:$('uPeran').value,kelas:$('uKelas').value.trim(),nis:$('uNis').value.trim()}]));
  if(!r.ok) return; ['uNama','uKelas','uNis'].forEach(id=>$(id).value=''); await reload(); toast(`Anggota <b>${esc(nama)}</b> terdaftar (${r.r[0].id})`,'ok'); showCard(r.r[0].id);
}
async function delUser(id){
  if(db.loans.some(l=>l.anggota_id===id&&!l.kembali)) return toast('Anggota masih meminjam alat. Kembalikan dulu.','bad');
  if(!await confirmBox('Hapus anggota ini? Riwayat peminjamannya tetap tersimpan.','Hapus',true)) return;
  if((await run(()=>API.deleteAnggota(id),'Anggota dihapus')).ok){ if(activeMember&&activeMember.id===id) activeMember=null; await reload(); }
}
function renderUsers(){
  const q=$('uSearch').value.toLowerCase(), list=db.anggota.filter(u=>(u.nama+' '+u.id+' '+u.kelas+' '+u.nis).toLowerCase().includes(q));
  $('tUsers').innerHTML=list.length?list.map(u=>{ const n=db.loans.filter(l=>l.anggota_id===u.id&&!l.kembali).length, acc=users.filter(x=>x.anggota_id===u.id);
    return `<tr><td>${barcodeSVG(u.id)}</td><td><b>${esc(u.nama)}</b><div class="muted">${esc(u.nis)||'&nbsp;'}</div></td><td><span class="badge b-pri">${esc(u.peran)}</span></td><td>${esc(u.kelas)||'-'}</td>
      <td>${acc.length?acc.map(a=>`<span class="chip">@${esc(a.username)}</span>`).join(' '):isAdmin()?`<button class="btn sm sec" data-act="mkAkun" data-id="${u.id}">🔑 Buat akun</button>`:'<span class="muted">-</span>'}</td>
      <td>${n?`<span class="badge b-warn">${n} alat</span>`:'<span class="muted">-</span>'}</td>
      <td><div class="row"><button class="btn sm" data-act="showCard" data-id="${u.id}">🪪 Kartu</button>${can('anggota')?`<button class="btn sm red" data-act="delUser" data-id="${u.id}">Hapus</button>`:''}</div></td></tr>`; }).join('')
    :`<tr><td colspan="7" class="empty">${db.anggota.length?'Tidak ditemukan':'Belum ada anggota.'}</td></tr>`;
}

/* ---------------- ALAT ---------------- */
/* Prioritas visual otomatis: model AI realistis → 3D dari foto → model bawaan dari nama → umum */
function visualOf(it){
  const url=it.foto3d_url||it.foto_url, m=it.model||'';
  if(m==='ai'&&it.model3d_url) return {type:'glb',url:it.model3d_url};
  if(m==='relief'&&url) return {type:'relief',url};
  if(m==='foto'&&url) return {type:'foto',url};
  if(m&&MODELS[m]) return {type:'model',key:m};
  if(it.model3d_url) return {type:'glb',url:it.model3d_url};
  if(url) return {type:'relief',url};
  return {type:'model',key:guessModel(it.nama)};
}
const VIS_NAME={glb:'model 3D AI (realistis)',relief:'3D dari foto',foto:'foto berdiri (datar)'};
const visName=v=>v.type==='model'?'model bawaan: '+MODELS[v.key].name:VIS_NAME[v.type];
function placePref(it){ const v=visualOf(it); return v.type==='model'?MODELS[v.key].place:((it.tinggi_cm||50)>100?'floor':'bench'); }
/* mesh 3D asinkron (relief dari foto / GLB dari AI) */
const tmCache=new Map();
function loadImgURL(url){ return new Promise((res,rej)=>{ const im=new Image(); if(!/^data:|^blob:/.test(url)) im.crossOrigin='anonymous'; im.onload=()=>res(im); im.onerror=()=>rej(new Error('Gambar tidak bisa dimuat')); im.src=url; }); }
function tmData(v){ const key=v.type+':'+v.url; let e=tmCache.get(key); if(e) return e; e={key,state:'loading'}; tmCache.set(key,e);
  const job=v.type==='relief'?loadImgURL(v.url).then(img=>reliefFromImage(img,v.url))
    :fetch(v.url).then(r=>{ if(!r.ok) throw new Error('Model 3D tidak bisa diunduh ('+r.status+')'); return r.arrayBuffer(); }).then(parseGLB);
  job.then(d=>{ if(!d) throw new Error('Bentuk alat tidak terdeteksi pada foto'); e.state='ready'; e.data=d; },err=>{ e.state='error'; e.err=err; console.warn('visual 3D:',err.message); })
    .then(()=>{ if(curTab==='lab3d') renderLab(); const it=v3Id&&itemById(v3Id); if(it&&v3View&&$('v3Modal').classList.contains('show')){ stageItem(v3View,it,true); renderV3Info(); } });
  return e; }
/* visual siap pakai untuk View tertentu: {tm} | {bb} | {model} */
function resolveVisual(V,it){ const v=visualOf(it);
  if(v.type==='relief'||v.type==='glb'){ const e=tmData(v);
    if(e.state==='ready') return {kind:'tm',tm:V.tmesh(e.key,e.data),v};
    const ph=it.foto3d_url||it.foto_url; if(ph) return {kind:'bb',url:ph,v,loading:e.state==='loading',err:e.err};
    return {kind:'model',key:guessModel(it.nama),v,err:e.err}; }
  if(v.type==='foto') return {kind:'bb',url:v.url,v};
  return {kind:'model',key:v.key,v}; }
function labPlaced(labId,exceptId){ return db.items.filter(i=>i.lab_id===labId&&i.ditempatkan&&i.pos_x!=null&&i.id!==exceptId).map(i=>({x:i.pos_x,z:i.pos_z})); }
function spotFor(lab,it,extra=[]){ return autoSpot(lab,db.furniture.filter(f=>f.lab_id===lab.id),labPlaced(lab.id,it.id).concat(extra),placePref(it)); }
let pendingFoto=null;
async function addItem(){
  const nama=$('iNama').value.trim(); if(!nama){ toast('Nama alat wajib diisi','bad'); return $('iNama').focus(); }
  const qty=Math.min(50,Math.max(1,parseInt($('iQty').value)||1)), lab=labById($('iLab').value), model=$('iModel').value, tinggi=Math.min(600,Math.max(1,parseInt($('iTinggi').value)||50));
  const file=pendingFoto, extra=[], rows=[];
  for(let k=1;k<=qty;k++){
    const row={nama:qty>1?`${nama} #${k}`:nama,kategori:lab?lab.nama:'',lab_id:lab?lab.id:null,lokasi:$('iLok').value.trim(),model,tinggi_cm:tinggi};
    if(lab){ const probe=Object.assign({},row,{foto3d_url:file?'x':null}), s=spotFor(lab,probe,extra); extra.push(s); Object.assign(row,{pos_x:+s.x.toFixed(3),pos_z:+s.z.toFixed(3),rot:s.rot,ditempatkan:true}); }
    rows.push(row);
  }
  const r=await run(async()=>{
    const added=await API.addItems(rows);
    if(file){ const ph=await uploadPhoto(file,added[0].id); for(const a of added) await API.updateItem(a.id,ph); }
    return added;
  },`${qty} alat ditambahkan${lab?' dan diletakkan di denah '+esc(lab.nama):''}`);
  if(!r.ok) return;
  $('iNama').value=''; $('iQty').value=1; $('iLok').value=''; $('iModel').value=''; resetFotoInput(); $('iPreview').innerHTML='';
  await reload(); if(file&&aiOn()) for(const a of r.r) await aiStart(a.id,true);
  if(r.r.length===1) openViewer(r.r[0].id);
}
function resetFotoInput(){ pendingFoto=null; $('iFoto').value=''; $('iFotoDrop').classList.remove('has'); $('iFotoTxt').innerHTML='📷 Klik untuk unggah / ambil foto alat'; }
async function delItem(id){
  if(openLoan(id)) return toast('Alat sedang dipinjam, tidak bisa dihapus.','bad');
  if(!await confirmBox('Hapus alat ini dari inventaris?','Hapus',true)) return;
  if((await run(()=>API.deleteItem(id),'Alat dihapus')).ok) await reload();
}
function renderItems(){
  $('itemFormCard').hidden=!can('alat');
  const q=$('iSearch').value.toLowerCase(), fl=$('iFilterLab').value;
  const list=db.items.filter(i=>(!fl||i.lab_id===fl)&&(i.nama+' '+i.id+' '+i.lokasi+' '+labName(i.lab_id)).toLowerCase().includes(q));
  $('tItems').innerHTML=list.length?list.map(i=>`<tr>
    <td>${thumbHTML(i)}</td><td>${barcodeSVG(i.id)}</td><td><b>${esc(i.nama)}</b><div class="muted">${i.ditempatkan?'📍 di denah':(i.lab_id?'⚠️ belum diletakkan':'')}</div>${i.ai3d_status==='proses'?`<span class="chip">🤖 AI 3D ${i.ai3d_progress||0}%</span>`:i.model3d_url?'<span class="chip">🤖 3D AI</span>':(i.foto_url?'<span class="chip">🧊 3D dari foto</span>':'')}</td>
    <td>${esc(labName(i.lab_id))}<div class="muted">${esc(i.lokasi)||''}</div></td><td>${statusBadge(i)}</td>
    <td>${lastUserText(i)}<div class="muted">${fmt(i.waktu_terakhir)}</div></td>
    <td><div class="row"><button class="btn sm" data-act="view3d" data-id="${i.id}">🧊 3D</button><button class="btn sm sec" data-act="showLabel" data-id="${i.id}">🏷️ Label</button>
    <button class="btn sm sec" data-act="itemHist" data-id="${i.id}">Riwayat</button>
    ${i.status==='rusak'&&can('alat')?`<button class="btn sm green" data-act="fixItem" data-id="${i.id}">✔ Diperbaiki</button>`:''}
    ${can('alat')?`<button class="btn sm red" data-act="delItem" data-id="${i.id}">Hapus</button>`:''}</div></td></tr>`).join('')
    :`<tr><td colspan="7" class="empty">${db.items.length?'Tidak ditemukan':'Belum ada alat.'}</td></tr>`;
}

/* ---------------- FOTO → VISUAL 3D ---------------- */
function loadImg(file){ return new Promise((res,rej)=>{ const url=URL.createObjectURL(file), im=new Image(); im.onload=()=>{ res(im); setTimeout(()=>URL.revokeObjectURL(url),1000); }; im.onerror=()=>rej(new Error('File bukan gambar yang valid')); im.src=url; }); }
function canvasFrom(img,max){ const s=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)), c=document.createElement('canvas');
  c.width=Math.max(1,Math.round((img.naturalWidth||img.width)*s)); c.height=Math.max(1,Math.round((img.naturalHeight||img.height)*s)); c.getContext('2d').drawImage(img,0,0,c.width,c.height); return c; }
const toBlob=(c,type,q)=>new Promise(r=>c.toBlob(r,type,q));
/* hapus latar belakang polos (flood-fill dari tepi) agar foto bisa berdiri sebagai objek 3D */
function cutout(img,max){
  const c=canvasFrom(img,max), W=c.width, H=c.height, x=c.getContext('2d',{willReadFrequently:true}), im=x.getImageData(0,0,W,H), d=im.data;
  const P=i=>[d[i*4],d[i*4+1],d[i*4+2]], dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const samp=[]; for(let i=0;i<W;i+=2){ samp.push(P(i),P((H-1)*W+i)); } for(let j=0;j<H;j+=2){ samp.push(P(j*W),P(j*W+W-1)); }
  const med=[0,1,2].map(k=>samp.map(s=>s[k]).sort((a,b)=>a-b)[samp.length>>1]);
  const spread=samp.reduce((s,p)=>s+dist(p,med),0)/samp.length, T=Math.min(80,Math.max(28,24+spread*1.6));
  const bg=new Uint8Array(W*H), q=new Int32Array(W*H); let qh=0,qt=0;
  const seed=i=>{ if(!bg[i]&&dist(P(i),med)<T*1.25){ bg[i]=1; q[qt++]=i; } };
  for(let i=0;i<W;i++){ seed(i); seed((H-1)*W+i); } for(let j=0;j<H;j++){ seed(j*W); seed(j*W+W-1); }
  while(qh<qt){ const i=q[qh++], px=i%W, py=(i/W)|0, pc=P(i);
    for(const n of [px>0?i-1:-1,px<W-1?i+1:-1,py>0?i-W:-1,py<H-1?i+W:-1]){ if(n<0||bg[n]) continue; const nc=P(n), dm=dist(nc,med);
      if(dm<T||(dist(nc,pc)<9&&dm<T*1.9)){ bg[n]=1; q[qt++]=n; } } }
  const frac=qt/(W*H);
  if(frac<.05||frac>.93) return {ok:false,canvas:photoCard(img,max)};
  let x0=W,y0=H,x1=0,y1=0;
  for(let i=0;i<W*H;i++){ const px=i%W, py=(i/W)|0;
    if(bg[i]){ d[i*4+3]=0; continue; }
    const edge=(px>0&&bg[i-1])||(px<W-1&&bg[i+1])||(py>0&&bg[i-W])||(py<H-1&&bg[i+W]); d[i*4+3]=edge?170:255;
    if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py; }
  x.putImageData(im,0,0);
  const m=3; x0=Math.max(0,x0-m); y0=Math.max(0,y0-m); x1=Math.min(W-1,x1+m); y1=Math.min(H-1,y1+m);
  const o=document.createElement('canvas'); o.width=x1-x0+1; o.height=y1-y0+1; o.getContext('2d').drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);
  return {ok:true,canvas:o};
}
function photoCard(img,max){ const c=canvasFrom(img,max), o=document.createElement('canvas'), b=Math.round(Math.max(c.width,c.height)*.035);
  o.width=c.width+b*2; o.height=c.height+b*2; const x=o.getContext('2d'), r=b*2.2;
  x.beginPath(); x.moveTo(r,0); x.arcTo(o.width,0,o.width,o.height,r); x.arcTo(o.width,o.height,0,o.height,r); x.arcTo(0,o.height,0,0,r); x.arcTo(0,0,o.width,0,r); x.closePath();
  x.fillStyle='#ffffff'; x.fill(); x.drawImage(c,b,b); return o; }
async function processPhoto(file){
  const img=await loadImg(file), demo=API.mode==='demo';
  const asli=await toBlob(canvasFrom(img,demo?720:1280),'image/jpeg',demo?.72:.84);
  const cut=cutout(img,demo?360:640), cutBlob=await toBlob(cut.canvas,'image/png');
  return {asli,cutBlob,cutOk:cut.ok,preview:cut.canvas.toDataURL('image/png')};
}
async function uploadPhoto(file,itemId){
  const ph=await processPhoto(file), t=Date.now();
  const foto_url=await API.uploadFoto(`${API.sid}/${itemId}/${t}-asli.jpg`,ph.asli,'image/jpeg');
  const foto3d_url=await API.uploadFoto(`${API.sid}/${itemId}/${t}-3d.png`,ph.cutBlob,'image/png');
  if(!ph.cutOk) toast('Latar foto tidak polos sehingga bentuk 3D kurang rapi. Tips: foto alat di depan dinding/kain polos.','');
  return {foto_url,foto3d_url};
}
/* ---------- 3D AI (Meshy) ---------- */
const aiOn=()=>API.mode==='supabase'&&!!(API.cfgInfo&&API.cfgInfo.ai3d)&&!!(db.school&&db.school.ai3d);
function aiPanel(it){ if(!(API.cfgInfo&&API.cfgInfo.ai3d)) return '';
  const st=it.ai3d_status||'', E=can('alat');
  if(st==='proses') return `<div class="ai-box"><b>🤖 Model 3D AI sedang dibuat…</b><div class="ai-bar"><i style="width:${Math.max(4,it.ai3d_progress||0)}%"></i></div><div class="muted">${it.ai3d_progress||0}% • biasanya 1–3 menit, boleh ditinggal</div></div>`;
  if(!db.school||!db.school.ai3d) return isSuper()?`<div class="ai-box muted">🤖 3D AI belum diizinkan untuk sekolah ini (Kelola Sekolah → Ubah).</div>`:'';
  if(st==='gagal') return `<div class="ai-box bad">🤖 Gagal membuat model AI: ${esc(it.ai3d_error||'-')}${E&&it.foto_url?`<div style="margin-top:6px"><button class="btn sm" data-act="aiStart" data-id="${it.id}">Coba lagi</button></div>`:''}</div>`;
  if(it.model3d_url) return `<div class="ai-box ok">🤖 Model 3D AI realistis tersedia.${E?` <button class="btn sm sec" data-act="aiStart" data-id="${it.id}">Buat ulang</button>`:''}</div>`;
  return E&&it.foto_url?`<div class="ai-box"><button class="btn sm" data-act="aiStart" data-id="${it.id}">🤖 Buat model 3D realistis (AI)</button><div class="muted" style="margin-top:4px">Memakai kredit Meshy.</div></div>`:''; }
async function aiStart(id,silent){ const it=itemById(id); if(!it) return;
  try{ const r=await API.ai3dStart(id,!!it.model3d_url||it.ai3d_status==='gagal'); Object.assign(it,r.item); if(!silent) toast('🤖 Pembuatan model 3D AI dimulai','ok'); renderAll(); aiPoll(); }
  catch(e){ if(!silent||!/belum/.test(e.message)) toast('❌ '+esc(e.message),'bad'); } }
let aiTimer=null, aiBusy=false;
function aiPoll(){ clearTimeout(aiTimer); if(API.mode!=='supabase'||!db.items.some(i=>i.ai3d_status==='proses')) return; aiTimer=setTimeout(aiTick,7000); }
async function aiTick(){ if(aiBusy) return; aiBusy=true;
  try{ for(const it of db.items.filter(i=>i.ai3d_status==='proses').slice(0,3)){
      try{ const r=await API.ai3dStatus(it.id), cur=itemById(it.id); if(!cur) continue; const before=cur.ai3d_status; Object.assign(cur,r.item);
        if(before==='proses'&&cur.ai3d_status==='siap'){ toast(`🤖 Model 3D AI <b>${esc(cur.nama)}</b> sudah jadi!`,'ok');
          if(v3Id===cur.id&&v3View&&$('v3Modal').classList.contains('show')) stageItem(v3View,cur,true); }
        if(before==='proses'&&cur.ai3d_status==='gagal') toast(`🤖 Model 3D AI <b>${esc(cur.nama)}</b> gagal: ${esc(cur.ai3d_error||'')}`,'bad'); }catch(e){ console.warn('ai3d',e.message); } }
    renderAll(); } finally{ aiBusy=false; aiPoll(); } }
$('iFoto').addEventListener('change',async e=>{ const f=e.target.files[0]; if(!f) return;
  const r=await run(()=>processPhoto(f)); if(!r.ok) return resetFotoInput(); pendingFoto=f;
  $('iFotoDrop').classList.add('has'); $('iFotoTxt').innerHTML=`<img src="${r.r.preview}" alt=""> <span><b>${esc(f.name)}</b><br>${r.r.cutOk?'✅ Latar dihapus otomatis → jadi objek 3D':'ℹ️ Latar tidak polos → ditampilkan sebagai bingkai foto 3D'}</span>`;
  updatePreview(); });

/* ---------------- RIWAYAT ---------------- */
function filteredLoans(){
  const q=$('hSearch').value.toLowerCase(), f=$('hFilter').value, own=me.role==='anggota'&&me.anggota_id&&!can('scan');
  return db.loans.slice().reverse().filter(l=>{ if(own&&l.anggota_id!==me.anggota_id) return false; if(f==='open'&&l.kembali) return false; if(f==='done'&&!l.kembali) return false;
    return (l.anggota_nama+' '+l.anggota_id+' '+l.item_nama+' '+l.item_id).toLowerCase().includes(q); });
}
function renderHistory(){ const list=filteredLoans();
  $('tHistory').innerHTML=list.length?list.slice(0,800).map(l=>`<tr><td>${l.id}</td><td>${esc(l.anggota_nama)}<div class="muted code">${l.anggota_id}</div></td><td>${esc(l.item_nama)}<div class="muted code">${l.item_id}</div></td>
    <td>${fmt(l.pinjam)}</td><td>${l.kembali?fmt(l.kembali):'<span class="badge b-warn">Belum kembali</span>'}</td><td>${l.kondisi?`<span class="badge ${l.kondisi==='Baik'?'b-ok':'b-bad'}">${esc(l.kondisi)}</span>`:'-'}</td></tr>`).join('')
    :`<tr><td colspan="6" class="empty">Tidak ada data</td></tr>`; }
function exportCSV(){ const rows=[['No','Kode Anggota','Nama','Kode Alat','Alat','Dipinjam','Dikembalikan','Kondisi']];
  filteredLoans().forEach(l=>rows.push([l.id,l.anggota_id,l.anggota_nama,l.item_id,l.item_nama,fmt(l.pinjam),l.kembali?fmt(l.kembali):'Belum kembali',l.kondisi]));
  download(new Blob(['﻿sep=;\n'+rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(';')).join('\n')],{type:'text/csv;charset=utf-8'}),'riwayat-peminjaman.csv'); toast('File CSV diunduh','ok'); }

/* ---------------- AKUN & HAK AKSES ---------------- */
function menuChecks(containerId,sel,role){ const dis=role==='admin';
  $(containerId).innerHTML=MENUS.map(m=>`<label><input type="checkbox" value="${m.key}" ${dis||sel.includes(m.key)?'checked':''} ${dis?'disabled':''}> ${m.ic} ${esc(m.label)}</label>`).join('')
   +(dis?'<div class="muted" style="grid-column:1/-1">Admin otomatis bisa membuka semua menu + Akun & Hak Akses.</div>':''); }
const checkedMenus=id=>[...$(id).querySelectorAll('input:checked')].map(i=>i.value);
function renderAkun(){
  if(!isAdmin()||!API.sid) return;
  if(!$('akMenus').children.length) menuChecks('akMenus',ROLE_PRESET.anggota,'anggota');
  $('tAkun').innerHTML=users.length?users.map(u=>{ const a=u.anggota_id&&anggotaById(u.anggota_id);
    return `<tr><td><b>${esc(u.nama)}</b><div class="muted code">@${esc(u.username)}</div></td><td><span class="badge ${u.role==='admin'?'b-bad':u.role==='staf'?'b-warn':'b-pri'}">${esc(ROLE_NAME[u.role]||u.role)}</span></td>
      <td><div class="chips">${u.role==='admin'?'<span class="chip">Semua menu</span>':(u.menus||[]).map(k=>{const m=MENUS.find(x=>x.key===k);return m?`<span class="chip">${m.ic} ${esc(m.label)}</span>`:'';}).join('')}</div></td>
      <td>${a?esc(a.nama)+`<div class="muted code">${a.id}</div>`:'<span class="muted">-</span>'}</td><td>${u.aktif?'<span class="badge b-ok">Aktif</span>':'<span class="badge b-bad">Nonaktif</span>'}</td>
      <td><div class="row"><button class="btn sm" data-act="akEdit" data-id="${u.id}">✏️ Ubah</button>${u.id!==me.id?`<button class="btn sm red" data-act="akDel" data-id="${u.id}">Hapus</button>`:''}</div></td></tr>`; }).join('')
    :`<tr><td colspan="6" class="empty">Memuat…</td></tr>`;
}
$('akRole').addEventListener('change',e=>menuChecks('akMenus',ROLE_PRESET[e.target.value],e.target.value));
$('akNama').addEventListener('input',()=>{ if(!$('akUser').dataset.touched) $('akUser').value=slug($('akNama').value); });
$('akUser').addEventListener('input',()=>{ $('akUser').dataset.touched=1; });
async function akCreate(){
  const b={nama:$('akNama').value.trim(),username:$('akUser').value.trim().toLowerCase(),password:$('akPass').value,role:$('akRole').value,menus:checkedMenus('akMenus'),anggota_id:$('akAnggota').value||null};
  if(!b.nama) return toast('Nama wajib diisi','bad');
  if(!USERNAME_RE.test(b.username)) return toast('Username 3–32 karakter: huruf kecil, angka, titik, minus, garis bawah','bad');
  if(b.password.length<6) return toast('Password minimal 6 karakter','bad');
  const r=await run(()=>API.createUser(b),`Akun <b>@${esc(b.username)}</b> dibuat`); if(!r.ok) return;
  ['akNama','akUser','akPass'].forEach(id=>$(id).value=''); delete $('akUser').dataset.touched; $('akAnggota').value='';
  dialog(`<h3>✅ Akun berhasil dibuat</h3><p>Berikan info login ini kepada <b>${esc(b.nama)}</b>:</p><div class="info-item"><div>Link login: <b>${esc(appLink(db.school.kode))}</b></div><div>Kode sekolah: <b class="code">${esc(db.school.kode)}</b></div><div>Username: <b class="code">${esc(b.username)}</b></div><div>Password: <b class="code">${esc(b.password)}</b></div></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closeDialog">OK</button></div>`);
  await loadUsers();
}
function akEdit(id){ const u=users.find(x=>x.id===id); if(!u) return;
  dialog(`<div class="row between"><h3 style="margin:0">Ubah akun @${esc(u.username)}</h3><button class="btn sec sm" data-act="closeDialog">✕</button></div>
    <label class="f">Nama</label><input id="aeNama" value="${esc(u.nama)}">
    <div class="grid two"><div><label class="f">Peran</label><select id="aeRole">${['anggota','staf','admin'].map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${ROLE_NAME[r]}</option>`).join('')}</select></div>
    <div><label class="f">Status</label><select id="aeAktif"><option value="1" ${u.aktif?'selected':''}>Aktif</option><option value="0" ${!u.aktif?'selected':''}>Nonaktif (tidak bisa login)</option></select></div></div>
    <label class="f">Hubungkan ke anggota</label><select id="aeAng"><option value="">— tidak dihubungkan —</option>${db.anggota.map(a=>`<option value="${a.id}" ${u.anggota_id===a.id?'selected':''}>${esc(a.nama)} (${a.id})</option>`).join('')}</select>
    <label class="f">Hak akses menu</label><div class="menu-checks" id="aeMenus"></div>
    <label class="f">Reset password (kosongkan jika tidak diubah)</label><input id="aePass" type="text" placeholder="password baru, min. 6" autocomplete="off">
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" data-act="closeDialog">Batal</button><button class="btn" id="aeSave">💾 Simpan</button></div>`);
  menuChecks('aeMenus',u.menus||[],u.role);
  $('aeRole').onchange=e=>menuChecks('aeMenus',e.target.value==='admin'?MENU_KEYS:ROLE_PRESET[e.target.value],e.target.value);
  $('aeSave').onclick=async()=>{ const b={id,nama:$('aeNama').value.trim(),role:$('aeRole').value,aktif:$('aeAktif').value==='1',anggota_id:$('aeAng').value||null,menus:checkedMenus('aeMenus')};
    if($('aePass').value){ if($('aePass').value.length<6) return toast('Password minimal 6 karakter','bad'); b.password=$('aePass').value; }
    const r=await run(()=>API.updateUser(b),'Akun diperbarui'); if(r.ok){ closeDialog(); await loadUsers(); if(id===me.id){ me=Object.assign(me,r.r||{}); buildNav(); } } };
}
async function akDel(id){ const u=users.find(x=>x.id===id)||supers.find(x=>x.id===id); if(!u) return;
  if(!await confirmBox(`Hapus akun <b>@${esc(u.username)}</b>? Orang ini tidak bisa login lagi (data anggota & riwayat tetap ada).`,'Hapus akun',true)) return;
  if((await run(()=>API.deleteUser(id),'Akun dihapus')).ok){ await loadUsers(); loadSupers(); } }
function mkAkun(aid){ const a=anggotaById(aid); if(!a) return; goTab('akun');
  $('akNama').value=a.nama; $('akUser').value=slug(a.nama); $('akRole').value='anggota'; $('akAnggota').value=a.id; menuChecks('akMenus',ROLE_PRESET.anggota,'anggota'); $('akPass').focus(); }

/* ---------------- PENGATURAN ---------------- */
function renderIdent(){ const sc=db.school, box=$('identForm'); if(!box) return;
  if(!sc){ box.innerHTML='<div class="muted">Belum ada sekolah dipilih.</div>'; return; }
  if(!isSuper()){ $('identNote').textContent='Nama, logo, dan warna sekolah diatur oleh Super Admin.';
    box.innerHTML=`<div class="sch-cell"><div class="sch-logo" style="background:${esc(sc.warna)}">${logoHTML(sc.logo)}</div><div><b>${esc(sc.nama)}</b><div class="muted">Kode: ${esc(sc.kode)} • Link login: <b>${esc(appLink(sc.kode))}</b></div></div></div>`; return; }
  if(box.dataset.sid===sc.id&&box.contains(document.activeElement)) return; box.dataset.sid=sc.id;
  box.innerHTML=brandFields('id',sc)+`<div class="row" style="margin-top:12px"><button class="btn" data-act="saveSchool">💾 Simpan tampilan sekolah</button></div>`; wireBrand('id'); }
async function saveSchool(){ const sc=db.school; if(!sc||!isSuper()) return; const v=readBrand('id'); if(!v.nama) return toast('Nama sekolah tidak boleh kosong','bad');
  if((await run(()=>API.updateSchool(sc.id,v),'Tampilan sekolah disimpan')).ok){ window.__hero=0; $('identForm').dataset.sid=''; await reload(); await loadSchools(); } }
function exportJson(){ download(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),'sipinlab-data-'+new Date().toISOString().slice(0,10)+'.json'); toast('Data diekspor','ok'); }
async function resetDemo(){ if(!await confirmBox('Kosongkan semua data demo (akun admin tetap ada)?','Kosongkan',true)) return; await API.resetAll(); location.reload(); }
async function seed(){
  if(!isAdmin()) return;
  if(!await confirmBox('Tambahkan <b>data contoh</b>: 2 lab (Bengkel Teknik Otomotif & Lab IPA) lengkap dengan perabot, 5 anggota, 20 alat, serta 2 akun contoh: <b>toolman</b> (staf) dan <b>andi</b> (siswa), password <b>sipinlab123</b>?')) return;
  const r=await run(async()=>{
    const tO=labTemplate('oto',18,13), tI=labTemplate('lab',15,11);
    const LO=await API.addLab({nama:'Bengkel Teknik Otomotif',gaya:'oto',lebar:18,panjang:13,urutan:db.labs.length+1},tO);
    const LI=await API.addLab({nama:'Lab IPA Terpadu',gaya:'lab',lebar:15,panjang:11,urutan:db.labs.length+2},tI);
    const ag=await API.addAnggota([['Andi Saputra','Siswa','XI TKR 1','2210012'],['Nur Aisyah','Siswa','XI TKR 2','2210045'],['Rahmat Hidayat','Siswa','XII TKR 1','2110077'],['Sitti Rahma, S.Pd','Guru','Produktif TKR','19870512'],['Irwan Setiawan','Laboran','Toolman Bengkel','']].map(([nama,peran,kelas,nis])=>({nama,peran,kelas,nis})));
    const spec=[['Engine Stand Toyota 1NZ-FE',LO,'Bay 1',120],['Dongkrak Buaya 3 Ton #1',LO,'Bay 2',25],['Dongkrak Buaya 3 Ton #2',LO,'Bay 2',25],['Jack Stand 3 Ton (sepasang)',LO,'Bay 2',45],['Kompresor Udara 2 HP',LO,'Pojok Bengkel',70],['Troli Perkakas (Tool Trolley)',LO,'Bay 1',110],['Ban & Velg R15 (Demo)',LO,'Rak Ban',62],
      ['Kunci Momen 1/2" 40–210 Nm',LO,'Meja Kerja 1',5],['Impact Wrench 1/2"',LO,'Meja Kerja 1',25],['Aki 12V 45Ah',LO,'Meja Kerja 2',22],['Scanner OBD-II',LO,'Lemari Alat Ukur',20],['Set Busi (4 pcs)',LO,'Meja Kerja 2',10],['Multimeter Digital Otomotif',LO,'Lemari Alat Ukur',18],['Jangka Sorong 0,05 mm',LO,'Lemari Alat Ukur',3],['Kunci Kombinasi 8–24 mm (Set)',LO,'Meja Kerja 3',5],
      ['Mikroskop Binokuler',LI,'Lemari Kaca 1',40],['Gelas Kimia & Erlenmeyer (Set)',LI,'Lemari Kaca 2',18],['Neraca Ohaus',LI,'Meja Dinding',15],['Model Torso Manusia',LI,'Lemari Kaca 1',60],['Laptop Praktikum',LI,'Meja Dinding',25]];
    const placed={[LO.id]:[],[LI.id]:[]};
    const rows=spec.map(([nama,L,lokasi,tinggi])=>{ const s=autoSpot(L,L===LO?tO:tI,placed[L.id],MODELS[guessModel(nama)].place); placed[L.id].push(s);
      return {nama,kategori:L.nama,lab_id:L.id,lokasi,tinggi_cm:tinggi,model:'',pos_x:+s.x.toFixed(3),pos_z:+s.z.toFixed(3),rot:s.rot,ditempatkan:true}; });
    await API.addItems(rows);
    for(const [username,nama,role,aid] of [['toolman','Irwan Setiawan','staf',ag[4].id],['andi','Andi Saputra','anggota',ag[0].id]])
      try{ await API.createUser({username,nama,password:'sipinlab123',role,menus:ROLE_PRESET[role],anggota_id:aid}); }catch(e){ console.warn('akun contoh:',e.message); }
    pref.set('lab',LO.id);
  },'Data contoh ditambahkan. Buka menu Lab 3D!');
  if(r.ok){ await reload(); loadUsers(); }
}

/* ======================================================================
   SCAN & TRANSAKSI
   ====================================================================== */
let activeMember=null, scanMode='pinjam', scanBusy=false;
function setMsg(text,type){ const m=$('scanMsg'); m.className='msg show '+type; m.innerHTML=text; camStatus(text,type); }
function renderMember(){ const box=$('memberBox');
  if(activeMember&&!anggotaById(activeMember.id)) activeMember=null;
  if(!activeMember){ box.className='member-box'; box.innerHTML='Belum ada anggota yang di-scan'; return; }
  const loans=db.loans.filter(l=>l.anggota_id===activeMember.id&&!l.kembali); box.className='member-box on';
  box.innerHTML=`<div class="nm">${esc(activeMember.nama)}</div><div>${esc(activeMember.peran)}${activeMember.kelas?' • '+esc(activeMember.kelas):''}</div><div class="muted code">${activeMember.id}</div>
    <div style="margin-top:6px;font-size:13px">${loans.length?'Sedang meminjam: '+loans.map(l=>esc(l.item_nama)).join(', '):'Tidak sedang meminjam alat'}</div>`; }
function clearMember(){ activeMember=null; renderMember(); setMsg('Silakan scan kartu anggota berikutnya.','info'); focusScan(); }
function focusScan(){ const s=$('scanInput'); s.value=''; if(!$('camModal').classList.contains('show')&&curTab==='scan') s.focus(); }
function showItemInfo(it){ const hist=db.loans.filter(l=>l.item_id===it.id).slice(-5).reverse(), cur=openLoan(it.id);
  $('itemInfo').innerHTML=`<div class="info-item"><div class="row" style="gap:12px;flex-wrap:nowrap">${thumbHTML(it,'thumb lg')}<div style="flex:1"><div class="row between"><h3>${esc(it.nama)}</h3>${statusBadge(it)}</div><button class="btn sm" data-act="view3d" data-id="${it.id}">🧊 Lihat 3D & foto</button></div></div>
    <div class="muted code" style="margin-top:8px">${it.id} • ${esc(labName(it.lab_id))} • ${esc(it.lokasi)||'-'}</div>
    <p style="margin:10px 0 4px"><b>${cur?'Sedang dipakai oleh':'Pemakai terakhir'}:</b></p>${lastUserText(it)}<div class="muted">${fmt(it.waktu_terakhir)}</div>
    ${hist.length?`<p style="margin:12px 0 4px"><b>5 pemakaian terakhir</b></p><div class="tbl-wrap"><table>${hist.map(l=>`<tr><td>${esc(l.anggota_nama)}</td><td>${fmt(l.pinjam)}</td><td>${l.kembali?`<span class="badge ${l.kondisi==='Baik'?'b-ok':'b-bad'}">${esc(l.kondisi)}</span>`:'<span class="badge b-warn">Dipinjam</span>'}</td></tr>`).join('')}</table></div>`:''}</div>`; }
function applyTx(r){ if(!r) return; if(r.item){ const i=db.items.findIndex(x=>x.id===r.item.id); if(i>=0) db.items[i]=r.item; }
  if(r.loan){ const j=db.loans.findIndex(l=>l.id===r.loan.id); if(j>=0) db.loans[j]=r.loan; else db.loans.push(r.loan); } renderAll(); }
async function handleCode(raw){
  const code=String(raw||'').trim().toUpperCase(); if(!code||scanBusy) return false;
  const u=anggotaById(code);
  if(u){ if(scanMode==='cek'){ setMsg(`👤 Kartu milik <b>${esc(u.nama)}</b> (${u.id}). Mode cek hanya untuk barcode alat.`,'info'); focusScan(); return true; }
    activeMember=u; renderMember(); beep(true); setMsg(`👋 Halo <b>${esc(u.nama)}</b>! Sekarang scan barcode alat yang ingin dipinjam.`,'info'); focusScan(); return true; }
  const it=itemById(code);
  if(!it){ beep(false); setMsg(`❌ Kode <b>${esc(code)}</b> tidak terdaftar.`,'bad'); focusScan(); return false; }
  if(scanMode==='cek'){ showItemInfo(it); beep(true); setMsg(`🔎 Info alat <b>${esc(it.nama)}</b> ditampilkan.`,'info'); focusScan(); return true; }
  $('itemInfo').innerHTML='';
  if(it.status==='rusak'){ beep(false); setMsg(`⚠️ <b>${esc(it.nama)}</b> berstatus <b>rusak</b> dan belum bisa dipinjam.`,'bad'); focusScan(); return false; }
  if(it.status!=='dipinjam'&&!activeMember){ beep(false); setMsg(`⚠️ Scan <b>kartu anggota</b> dulu sebelum meminjam <b>${esc(it.nama)}</b>.`,'bad'); focusScan(); return false; }
  scanBusy=true;
  try{
    if(it.status==='dipinjam'){ const kondisi=$('kondisi').value, r=await API.kembali(it.id,kondisi); applyTx(r); beep(true);
      setMsg(`✅ <b>${esc(it.nama)}</b> dikembalikan oleh <b>${esc(r.loan?r.loan.anggota_nama:'-')}</b> • kondisi: ${esc(kondisi)}.`,'ok'); $('kondisi').value='Baik'; }
    else { const r=await API.pinjam(activeMember.id,it.id); applyTx(r); beep(true);
      setMsg(`📦 <b>${esc(it.nama)}</b> dipinjam oleh <b>${esc(activeMember.nama)}</b>. Scan alat lain, atau klik "Ganti / selesai".`,'ok'); }
    return true;
  }catch(e){ beep(false); setMsg('❌ '+esc(translateErr(e.message)),'bad'); reload(true); return false; }
  finally{ scanBusy=false; focusScan(); }
}
function setMode(m){ scanMode=m; document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
  $('stepsPinjam').style.display=m==='pinjam'?'':'none'; $('stepsCek').style.display=m==='cek'?'grid':'none'; $('kondisiWrap').style.display=m==='pinjam'?'':'none';
  $('itemInfo').innerHTML=''; $('scanMsg').className='msg'; focusScan(); }
function renderRecent(){ const ev=[]; db.loans.forEach(l=>{ ev.push({t:l.pinjam,l,a:'pinjam'}); if(l.kembali) ev.push({t:l.kembali,l,a:'kembali'}); });
  ev.sort((a,b)=>new Date(b.t)-new Date(a.t));
  $('tRecent').innerHTML=ev.slice(0,10).map(e=>`<tr><td>${fmt(e.t)}</td><td>${esc(e.l.anggota_nama)}</td><td>${esc(e.l.item_nama)}</td><td>${e.a==='pinjam'?'<span class="badge b-warn">Pinjam</span>':'<span class="badge b-ok">Kembali</span>'}</td></tr>`).join('')||`<tr><td colspan="4" class="empty">Belum ada transaksi</td></tr>`; }

/* ---------------- KAMERA ---------------- */
let camStream=null,camTimer=null,lastCode='',lastTime=0,nativeDetector=null,camBusy=false;
function camStatus(text,type){ const s=$('camStatus'); if(!s) return; s.innerHTML=text; s.style.background=type==='ok'?'var(--ok-soft)':type==='bad'?'var(--bad-soft)':'#f1f5f9'; }
function camError(html){ const e=$('camErr'); e.innerHTML=html; e.style.display='block'; $('camWrap').style.display='none'; }
async function openCamera(deviceId){
  $('camModal').classList.add('show'); $('camErr').style.display='none'; $('camWrap').style.display=''; camStatus('Menyalakan kamera… (izinkan akses kamera jika diminta)'); stopStream();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return camError('<b>Kamera tidak tersedia.</b> Buka aplikasi lewat alamat <b>https://</b> (Vercel) di Chrome/Edge. Sementara itu gunakan scanner USB, "Scan dari foto", atau pilih manual.');
  try{ const video={width:{ideal:1280},height:{ideal:720}}; if(deviceId) video.deviceId={exact:deviceId}; else video.facingMode={ideal:'environment'};
    camStream=await navigator.mediaDevices.getUserMedia({video,audio:false}); }
  catch(err){ const n=err&&err.name; return camError(n==='NotAllowedError'||n==='SecurityError'?'<b>Akses kamera ditolak.</b> Klik ikon 🔒 di kolom alamat → izinkan <b>Kamera</b> → muat ulang halaman.'
      :n==='NotFoundError'||n==='OverconstrainedError'?'<b>Kamera tidak ditemukan.</b>':n==='NotReadableError'?'<b>Kamera sedang dipakai aplikasi lain.</b>':`<b>Kamera tidak bisa dibuka:</b> ${esc(err&&err.message||err)}`); }
  const v=$('camVideo'); v.srcObject=camStream; try{ await v.play(); }catch(e){}
  try{ const devs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'), cur=camStream.getVideoTracks()[0]?.getSettings?.().deviceId;
    $('camSelect').innerHTML=devs.map((d,k)=>`<option value="${esc(d.deviceId)}" ${d.deviceId===cur?'selected':''}>${esc(d.label||('Kamera '+(k+1)))}</option>`).join(''); $('camSelect').style.display=devs.length>1?'':'none'; }catch(e){}
  if(!nativeDetector&&'BarcodeDetector' in window){ try{ const f=await BarcodeDetector.getSupportedFormats(); if(f.includes('code_128')) nativeDetector=new BarcodeDetector({formats:['code_128']}); }catch(e){} }
  camStatus(activeMember?`Anggota aktif: <b>${esc(activeMember.nama)}</b>. Arahkan ke barcode alat.`:'Arahkan kamera ke barcode kartu anggota atau label alat.'); camLoop();
}
function stopStream(){ clearTimeout(camTimer); camTimer=null; if(camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream=null; } const v=$('camVideo'); if(v) v.srcObject=null; }
function closeCamera(){ stopStream(); $('camModal').classList.remove('show'); focusScan(); }
async function camLoop(){ if(!camStream) return; const v=$('camVideo');
  if(v.readyState>=2&&v.videoWidth&&!camBusy){ camBusy=true;
    try{ let code=null; if(nativeDetector){ try{ const r=await nativeDetector.detect(v); if(r&&r[0]) code=r[0].rawValue; }catch(e){} }
      if(!code){ const c=$('workCanvas'),sc=Math.min(1,1280/v.videoWidth); c.width=Math.round(v.videoWidth*sc); c.height=Math.round(v.videoHeight*sc);
        const ctx=c.getContext('2d',{willReadFrequently:true}); ctx.drawImage(v,0,0,c.width,c.height); code=decodeImageData(ctx.getImageData(0,0,c.width,c.height),22,6); }
      if(code) await onCamCode(code); }finally{ camBusy=false; } }
  if(camStream) camTimer=setTimeout(camLoop,90); }
async function onCamCode(code){ const now=Date.now(); if(code===lastCode&&now-lastTime<3000) return; lastCode=code; lastTime=now;
  const f=$('camFlash'); f.classList.add('on'); setTimeout(()=>f.classList.remove('on'),250); try{ navigator.vibrate&&navigator.vibrate(120); }catch(e){} await handleCode(code); }
async function scanPhoto(file){ if(!file) return; toast('Membaca barcode dari foto…');
  try{ const img=await loadImg(file); let code=null;
    if('BarcodeDetector' in window){ try{ const d=new BarcodeDetector({formats:['code_128']}),r=await d.detect(img); if(r[0]) code=r[0].rawValue; }catch(e){} }
    const c=$('workCanvas'),ctx=c.getContext('2d',{willReadFrequently:true});
    for(const maxW of [1600,1000,2400]){ if(code) break; const sc=Math.min(1,maxW/img.naturalWidth); c.width=Math.round(img.naturalWidth*sc); c.height=Math.round(img.naturalHeight*sc); ctx.drawImage(img,0,0,c.width,c.height); code=decodeImageData(ctx.getImageData(0,0,c.width,c.height),70,30); }
    if(code) await handleCode(code); else setMsg('❌ Barcode tidak terbaca dari foto. Foto lebih dekat, lurus, dan terang.','bad'); }
  catch(e){ setMsg('❌ Foto tidak bisa dibaca.','bad'); } }

/* ======================================================================
   KARTU ANGGOTA & LABEL (SVG → cetak / PNG)
   ====================================================================== */
function fitText(s,max){ s=String(s||''); return s.length>max?s.slice(0,max-1)+'…':s; }
function cardSVG(u){ const gid='g'+u.id.replace(/\W/g,''), nm=fitText(u.nama,30), fs=nm.length>22?32:40, detail=[u.peran,u.kelas,u.nis?('NIS/NIP '+u.nis):''].filter(Boolean).join('  •  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="856" height="540" font-family="Segoe UI, Arial, sans-serif">
<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${esc((db.school&&db.school.warna2)||'#0b1f4d')}"/><stop offset="1" stop-color="${esc((db.school&&db.school.warna)||'#2563eb')}"/></linearGradient></defs>
<rect x="1" y="1" width="854" height="538" rx="30" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
<path d="M31 1 H825 A30 30 0 0 1 855 31 V160 H1 V31 A30 30 0 0 1 31 1 Z" fill="url(#${gid})"/>
<circle cx="770" cy="40" r="90" fill="#ffffff" opacity=".07"/><circle cx="830" cy="140" r="60" fill="#ffffff" opacity=".07"/>
<text x="44" y="70" fill="#ffffff" font-size="36" font-weight="800" letter-spacing="1">KARTU PINJAM LAB</text>
<text x="44" y="118" fill="#cfe0ff" font-size="25">${esc(fitText(schoolName(),42))}</text>
<text x="44" y="226" font-size="${fs}" font-weight="800" fill="#0f172a">${esc(nm)}</text>
<text x="44" y="266" font-size="22" fill="#475569">${esc(fitText(detail,60))}</text>
<rect x="44" y="292" width="768" height="168" rx="12" fill="#ffffff"/><g fill="#000000">${barRects(u.id,84,300,688,128)}</g>
<text x="428" y="470" text-anchor="middle" font-family="Consolas, Courier New, monospace" font-size="30" font-weight="700" letter-spacing="6" fill="#0f172a">${esc(u.id)}</text>
<text x="428" y="515" text-anchor="middle" font-size="17" fill="#94a3b8">Tunjukkan kartu ini saat meminjam alat laboratorium</text></svg>`; }
function labelSVG(i){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 330" width="700" height="330" font-family="Segoe UI, Arial, sans-serif">
<rect x="1" y="1" width="698" height="328" rx="18" fill="#fff" stroke="#94a3b8" stroke-width="2" stroke-dasharray="8 6"/>
<text x="350" y="50" text-anchor="middle" font-size="30" font-weight="800" fill="#0f172a">${esc(fitText(i.nama,34))}</text>
<text x="350" y="84" text-anchor="middle" font-size="18" fill="#64748b">${esc(fitText(schoolName(),40))}${i.lokasi?'  •  '+esc(fitText(i.lokasi,20)):''}</text>
<g fill="#000">${barRects(i.id,70,104,560,150)}</g><text x="350" y="300" text-anchor="middle" font-family="Consolas, Courier New, monospace" font-size="30" font-weight="700" letter-spacing="6">${esc(i.id)}</text></svg>`; }
const PRINT_CSS=`@page{size:A4;margin:10mm}body{margin:0;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.wrap{display:flex;flex-wrap:wrap;gap:6mm}.c{width:85.6mm;height:54mm;break-inside:avoid;page-break-inside:avoid}.c svg,.l svg{width:100%;height:100%;display:block}.l{width:70mm;height:33mm;break-inside:avoid;page-break-inside:avoid}h4{margin:0 0 4mm;font-size:11pt;color:#555}`;
function printHTML(inner,title){ const old=$('printFrame'); if(old) old.remove(); const f=document.createElement('iframe'); f.id='printFrame'; f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'; document.body.appendChild(f);
  const d=f.contentWindow.document; d.open(); d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${inner}</body></html>`); d.close();
  setTimeout(()=>{ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ toast('Cetak diblokir. Gunakan tombol "Unduh PNG".','bad'); } },300); }
function printCards(us){ us=us.filter(Boolean); if(!us.length) return toast('Belum ada anggota','bad'); printHTML(`<h4>Kartu Pinjam Lab — ${esc(schoolName())} (potong mengikuti garis)</h4><div class="wrap">${us.map(u=>`<div class="c">${cardSVG(u)}</div>`).join('')}</div>`,'Kartu Anggota'); }
function printLabels(items){ items=items.filter(Boolean); if(!items.length) return toast('Belum ada alat','bad'); printHTML(`<h4>Label Alat — ${esc(schoolName())}</h4><div class="wrap">${items.map(i=>`<div class="l">${labelSVG(i)}</div>`).join('')}</div>`,'Label Alat'); }
function svgToPng(svg,name,scale=2){ const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=img.width*scale; c.height=img.height*scale; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.drawImage(img,0,0,c.width,c.height); c.toBlob(b=>{ download(b,name); toast('Gambar diunduh: '+esc(name),'ok'); },'image/png'); };
  img.onerror=()=>toast('Gagal membuat gambar','bad'); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); }
function showCard(id){ const u=anggotaById(id); if(!u) return;
  dialog(`<div class="row between" style="margin-bottom:12px"><h3 style="margin:0">Kartu anggota</h3><button class="btn sec sm" data-act="closeDialog">✕</button></div><div class="card-preview">${cardSVG(u)}</div>
    <div class="row" style="margin-top:14px;justify-content:center"><button class="btn" data-act="printCard" data-id="${u.id}">🖨️ Cetak kartu</button><button class="btn sec" data-act="pngCard" data-id="${u.id}">⬇️ Unduh PNG</button></div>`); }
function showLabel(id){ const i=itemById(id); if(!i) return;
  dialog(`<div class="row between" style="margin-bottom:12px"><h3 style="margin:0">Label alat</h3><button class="btn sec sm" data-act="closeDialog">✕</button></div><div class="card-preview">${labelSVG(i)}</div>
    <div class="row" style="margin-top:14px;justify-content:center"><button class="btn" data-act="printLabel" data-id="${i.id}">🖨️ Cetak label</button><button class="btn sec" data-act="pngLabel" data-id="${i.id}">⬇️ Unduh PNG</button></div>`); }

/* ======================================================================
   3D: thumbnail, viewer alat
   ====================================================================== */
let thumbView=null; const thumbCache={};
function thumb(key){ if(key in thumbCache) return thumbCache[key];
  try{ if(!thumbView){ const c=document.createElement('canvas'); c.width=320; c.height=240; thumbView=new G3.View(c,{auto:false,noInput:true,smSize:1024}); }
    stageModel(thumbView,key); thumbView.cam.yaw=.7; thumbView.render(0); thumbCache[key]=thumbView.cv.toDataURL('image/png'); }catch(e){ thumbCache[key]=''; }
  return thumbCache[key]; }
function thumbHTML(it,cls='thumb'){ const v=visualOf(it), src=it.foto_url||(v.type==='model'?thumb(v.key):v.url);
  return src?`<img class="${cls}" src="${esc(src)}" alt="${esc(it.nama)}" data-act="view3d" data-id="${it.id}" title="Lihat 3D / foto" loading="lazy">`:`<div class="${cls} thumb-fb" data-act="view3d" data-id="${it.id}">🧪</div>`; }
function modelOptions(sel,it){ const o=(v,t)=>`<option value="${v}" ${sel===v?'selected':''}>${t}</option>`;
  return o('','✨ Otomatis (AI → 3D dari foto → model dari nama)')+(it&&it.model3d_url?o('ai','🤖 Model 3D AI (realistis)'):'')+o('relief','🧊 3D dari foto (bervolume)')+o('foto','🖼️ Foto berdiri (datar)')+Object.values(MODELS).map(m=>`<option value="${m.key}" ${sel===m.key?'selected':''}>${esc(m.name)}</option>`).join(''); }
function updatePreview(){ const nama=$('iNama').value.trim(), m=$('iModel').value; if(!nama&&!pendingFoto){ $('iPreview').innerHTML=''; return; }
  const v=visualOf({nama,model:m,foto3d_url:pendingFoto?'x':null}), ai=aiOn();
  $('iPreview').innerHTML=v.type==='model'?`<img src="${thumb(v.key)}" alt=""><span>Visual 3D otomatis: <b>${esc(MODELS[v.key].name)}</b>. Unggah foto agar bentuk 3D-nya mengikuti alat asli.</span>`
    :`<span>Visual 3D: <b>${esc(visName(v))}</b>${v.type==='relief'?' – dibuat otomatis dari foto (bentuk, ketebalan & tekstur)':''}${ai&&pendingFoto?'<br>🤖 Lalu <b>model 3D AI realistis</b> dibuat otomatis (± 1–3 menit).':''}</span>`; }
function stageFoto(view,url,h){
  const ground=view.geo('ground',g=>g.cyl(10,10,.002,G3.MT.ground(),[0,-.001,0],null,64)), blob=view.geo('blob',g=>g.blob(.5,.5));
  view.objs=[{g:ground,m:G3.M.inst(0,0,0,0,h*.45),noShadow:true},{g:blob,m:G3.M.inst(0,.003,0,0,h*.75),noShadow:true},{bb:{url,h,pos:[0,0,0]}}];
  const R=h*.75; Object.assign(view.scene,{center:[0,h/2,0],radius:R*1.7,fade:R*2.6,exp:1.02,sun:[-.6,.95,.45]});
  Object.assign(view.cam,{t:[0,h*.48,0],dist:R/Math.tan(view.cam.fov*Math.PI/360)*1.15,min:R*.6,max:R*6,pitch:.18});
}
let v3View=null,v3Id=null;
function stageTM(view,tm,keepCam){ const lo=tm.lo,hi=tm.hi, s=1/Math.max(1e-6,hi[1]-lo[1]), w=Math.max(hi[0]-lo[0],hi[2]-lo[2])*s, R=.5*Math.hypot(w,1,w);
  const ground=view.geo('ground',g=>g.cyl(10,10,.002,G3.MT.ground(),[0,-.001,0],null,64));
  view.objs=[{g:ground,m:G3.M.inst(0,0,0,0,R*.4),noShadow:true},{tm,m:G3.M.mul(G3.M.inst(0,0,0,0,s),G3.M.tr(-(lo[0]+hi[0])/2,-lo[1],-(lo[2]+hi[2])/2))}];
  Object.assign(view.scene,{center:[0,.5,0],radius:R*1.7,fade:R*2.6,exp:1.05,sun:[-.6,.95,.45]});
  if(!keepCam) Object.assign(view.cam,{t:[0,.45,0],dist:R/Math.tan(view.cam.fov*Math.PI/360)*1.1,min:R*.5,max:R*6,pitch:.28}); }
function stageItem(view,it,keepCam){ const r=resolveVisual(view,it);
  if(r.kind==='tm') stageTM(view,r.tm,keepCam); else if(r.kind==='bb') stageFoto(view,r.url,1); else stageModel(view,r.key); view.invalidate(); }
function openViewer(id){ const it=itemById(id); if(!it) return; v3Id=id; $('v3Modal').classList.add('show'); $('v3Title').textContent=it.nama;
  if(!v3View){ try{ v3View=new G3.View($('v3Canvas'),{auto:true}); }catch(e){ v3View=null; } }
  if(v3View){ stageItem(v3View,it); v3View.cam.yaw=.75; v3View.start(); }
  setV3Mode(!v3View&&it.foto_url?'foto':'3d'); renderV3Info(); }
function setV3Mode(m){ const it=itemById(v3Id), has=!!(it&&it.foto_url);
  document.querySelectorAll('#v3Seg button').forEach(b=>b.classList.toggle('on',b.dataset.v3===m));
  $('v3Canvas').style.display=m==='3d'&&v3View?'block':'none'; $('v3Foto').style.display=m==='foto'&&has?'block':'none';
  $('v3NoFoto').style.display=m==='foto'&&!has?'flex':'none'; $('v3No3d').style.display=m==='3d'&&!v3View?'flex':'none'; $('v3Hint').style.display=m==='3d'&&v3View?'':'none';
  if(has) $('v3Foto').src=it.foto_url; $('v3DelFoto').hidden=!(has&&can('alat')); $('v3FotoBtn').hidden=!can('alat'); }
function renderV3Info(){ const it=itemById(v3Id); if(!it) return; const hist=db.loans.filter(l=>l.item_id===it.id).slice(-4).reverse(), cur=openLoan(it.id), v=visualOf(it), E=can('alat');
  $('v3Info').innerHTML=`<div class="row between"><span class="code muted">${it.id}</span>${statusBadge(it)}</div>
    <h3 style="margin:6px 0 2px">${esc(it.nama)}</h3><div class="muted">${esc(labName(it.lab_id))} • ${esc(it.lokasi)||'-'} • visual: ${esc(visName(v))}</div>${aiPanel(it)}
    <div class="info-item" style="margin-top:12px"><div class="muted" style="font-weight:700">${cur?'SEDANG DIPAKAI OLEH':'PEMAKAI TERAKHIR'}</div><div style="margin-top:4px">${lastUserText(it)}</div><div class="muted">${fmt(it.waktu_terakhir)}</div></div>
    ${hist.length?`<p style="margin:12px 0 6px;font-weight:700">Riwayat singkat</p>${hist.map(l=>`<div class="row between hist-row"><span>${esc(l.anggota_nama)}</span><span class="muted">${fmt(l.pinjam)}</span></div>`).join('')}`:''}
    ${E?`<p style="margin:14px 0 4px;font-weight:700">Ubah data alat</p>
      <label class="f">Nama</label><input id="veNama" value="${esc(it.nama)}">
      <div class="grid two" style="gap:8px"><div><label class="f">Lab</label><select id="veLab"><option value="">— tanpa lab —</option>${db.labs.map(l=>`<option value="${l.id}" ${l.id===it.lab_id?'selected':''}>${esc(l.nama)}</option>`).join('')}</select></div>
      <div><label class="f">Lokasi</label><input id="veLok" value="${esc(it.lokasi)}"></div>
      <div><label class="f">Tinggi asli (cm)</label><input id="veTinggi" type="number" min="1" max="600" value="${it.tinggi_cm||50}"></div>
      <div><label class="f">Skala di denah</label><input id="veSkala" type="number" min="0.2" max="5" step="0.1" value="${it.skala||1}"></div></div>
      <label class="f">Visual 3D</label><select id="veModel">${modelOptions(it.model||'',it)}</select>
      <div class="row" style="margin-top:10px"><button class="btn sm" data-act="veSave">💾 Simpan</button><button class="btn sm sec" data-act="showLabel" data-id="${it.id}">🏷️ Label</button></div>`
    :`<div class="barcode-box">${barcodeSVG(it.id,'mini-bc')}</div>`}`; }
async function veSave(){ const it=itemById(v3Id); if(!it) return;
  const patch={nama:$('veNama').value.trim()||it.nama,lab_id:$('veLab').value||null,lokasi:$('veLok').value.trim(),tinggi_cm:Math.min(600,Math.max(1,parseInt($('veTinggi').value)||50)),skala:Math.min(5,Math.max(.2,parseFloat($('veSkala').value)||1)),model:$('veModel').value};
  const lab=labById(patch.lab_id); patch.kategori=lab?lab.nama:'';
  if(patch.lab_id!==it.lab_id){ if(lab){ const s=spotFor(lab,Object.assign({},it,patch)); Object.assign(patch,{pos_x:+s.x.toFixed(3),pos_z:+s.z.toFixed(3),rot:s.rot,ditempatkan:true}); } else Object.assign(patch,{ditempatkan:false,pos_x:null,pos_z:null}); }
  const r=await run(()=>API.updateItem(it.id,patch),'Data alat disimpan'); if(!r.ok) return; await reload(); if(v3View) stageItem(v3View,itemById(it.id)); $('v3Title').textContent=patch.nama; }
function closeV3(){ $('v3Modal').classList.remove('show'); if(v3View) v3View.stop(); v3Id=null; }
$('v3FotoInput').addEventListener('change',async e=>{ const f=e.target.files[0]; e.target.value=''; const it=itemById(v3Id); if(!f||!it) return;
  const r=await run(async()=>API.updateItem(it.id,Object.assign(await uploadPhoto(f,it.id),{model3d_url:null,ai3d_status:''})),'Foto disimpan & visual 3D diperbarui'); if(!r.ok) return;
  await reload(); if(aiOn()) await aiStart(it.id,true); if(v3View) stageItem(v3View,itemById(it.id)); setV3Mode('3d'); renderV3Info(); });

/* ======================================================================
   DENAH LAB 3D + EDITOR TATA LETAK
   ====================================================================== */
let labView=null, labPinned=null, ed=null;
const curLab=()=>labById(pref.get('lab',''))||db.labs[0]||null;
function ensureLab(){ if(labView) return labView;
  try{ labView=new G3.View($('labCanvas'),{auto:false,smSize:2048}); }
  catch(e){ $('labEmpty').innerHTML='<div><b>Tampilan 3D tidak didukung browser ini.</b><br>Gunakan Chrome / Edge terbaru dan aktifkan akselerasi hardware.</div>'; $('labEmpty').style.display='flex'; return null; }
  labView.onPick=o=>{ if(ed){ ed.sel=null; renderLab(); renderEd(); return; } if(o&&o.iid) showLabPanel(o.iid); else hideLabPanel(); };
  labView.onHover=(o,e)=>{ const tip=$('labTip'), name=o&&(o.iid?(itemById(o.iid)||{}).nama:o.fid&&ed?(FURN[(ed.furn.find(f=>f.id===o.fid)||{}).jenis]||{}).name:null);
    $('labCanvas').style.cursor=name?(ed?'move':'pointer'):'grab';
    if(!name||!e){ tip.style.display='none'; return; } const r=$('labStage').getBoundingClientRect(), it=o.iid&&itemById(o.iid);
    tip.innerHTML=`<b>${esc(name)}</b>${it&&!ed?' · '+STATUS_TXT[it.status]:''}`; tip.style.display='block';
    tip.style.left=Math.min(r.width-tip.offsetWidth-8,e.clientX-r.left+14)+'px'; tip.style.top=(e.clientY-r.top+14)+'px'; };
  labView.onDown=e=>{ if(!ed) return false; const o=labView.pick(e.clientX,e.clientY); if(!o||!(o.fid||o.iid)) return false;
    ed.sel=o.fid?{t:'f',id:o.fid}:{t:'i',id:o.iid}; const p=edPos(ed.sel), hit=labView.rayPlane(e.clientX,e.clientY,0);
    ed.drag=hit&&p?{dx:p.x-hit[0],dz:p.z-hit[2],moved:false}:null; renderLab(); renderEd(); return true; };
  labView.onDragMove=e=>{ if(!ed||!ed.drag) return; const hit=labView.rayPlane(e.clientX,e.clientY,0); if(!hit) return; const lab=labById(ed.labId), st=ed.snap?.25:.05;
    const x=Math.max(-lab.lebar/2+.1,Math.min(lab.lebar/2-.1,Math.round((hit[0]+ed.drag.dx)/st)*st)), z=Math.max(-lab.panjang/2+.1,Math.min(lab.panjang/2-.1,Math.round((hit[2]+ed.drag.dz)/st)*st));
    edSetPos(ed.sel,x,z); ed.drag.moved=true; renderLab(); };
  labView.onDragEnd=()=>{ if(ed){ const m=ed.drag&&ed.drag.moved; ed.drag=null; if(m) renderEd(); } };
  return labView; }
function labPreset(p){ if(!labView) return; const lab=curLab(), S=lab?Math.max(lab.lebar,lab.panjang):16, c=labView.cam;
  if(p==='top') Object.assign(c,{t:[0,0,0],yaw:0,pitch:1.45,dist:S*1.2}); else Object.assign(c,{t:[0,.6,0],yaw:.55,pitch:.62,dist:S*.98});
  c.min=2; c.max=S*2.5; labView.bounds=S/2; labView.invalidate(); }
function placedItems(lab){ return db.items.filter(i=>i.lab_id===lab.id).map(i=>{ const o=ed&&ed.labId===lab.id?ed.items[i.id]:null;
  const p=o?o:{x:i.pos_x,z:i.pos_z,rot:i.rot||0,placed:!!i.ditempatkan&&i.pos_x!=null}; return {it:i,x:p.x,z:p.z,rot:p.rot,placed:p.placed}; }).filter(p=>p.placed); }
function renderLab(){
  const V=ensureLab(); if(!V) return;
  const canEdit=can('tataletak'); $('btnEdit').hidden=!canEdit||!!ed||!db.labs.length; $('btnLabNew').hidden=!canEdit||!!ed;
  $('labSel').disabled=!!ed; $('labSel').innerHTML=db.labs.map(l=>`<option value="${l.id}">${esc(l.nama)}</option>`).join('')||'<option>— belum ada lab —</option>';
  const lab=curLab(); if(lab) $('labSel').value=lab.id;
  $('labStage').classList.toggle('editing',!!ed); $('edPanel').hidden=!ed; $('labLegend').hidden=!!ed; $('labPanel').style.display=ed?'none':$('labPanel').style.display;
  $('labHint').textContent=ed?'Mode atur tata letak: klik & seret meja/alat untuk memindahkan • R = putar • Delete = hapus • seret area kosong untuk memutar kamera':'Seret untuk memutar • scroll/cubit untuk zoom • klik kanan/Shift+seret untuk menggeser • klik alat untuk detail';
  if(!lab){ V.objs=[]; $('labCount').textContent=''; $('labEmpty').style.display='flex';
    $('labEmpty').innerHTML=`<div><b>Belum ada lab.</b><br>${canEdit?'Klik <b>+ Lab baru</b> untuk membuat ruangan sesuai lab asli.':'Minta admin membuat denah lab.'}</div>`; return; }
  const furn=ed?ed.furn:db.furniture.filter(f=>f.lab_id===lab.id), P=placedItems(lab), objs=[], pins=[], M=G3.M;
  objs.push({g:V.geo(`shell_${lab.gaya}_${lab.lebar}_${lab.panjang}`,g=>buildShell(g,lab.gaya,lab.lebar,lab.panjang)),m:M.inst(0,0,0)});
  for(const f of furn){ const D=FURN[f.jenis]; if(!D) continue;
    objs.push({g:V.geo('f_'+f.jenis,D.build),m:M.inst(f.x,0,f.z,f.rot||0),fid:f.id,noShadow:!!D.flat,pick:ed?{c:[f.x,D.flat?0:.6,f.z],r:Math.max(.35,Math.min(D.w,D.d)*.55,Math.max(D.w,D.d)*.4),prio:D.flat?0:1}:null}); }
  P.forEach((p,k)=>{ const it=p.it, v=visualOf(it), y=furnTopAt(furn,p.x,p.z), sk=it.skala||1, st=STATUS_COL[it.status]?it.status:'tersedia'; let h, foot;
    const rv=resolveVisual(V,it);
    if(rv.kind==='tm'){ const lo=rv.tm.lo, hi=rv.tm.hi, tH=Math.max(.25,(it.tinggi_cm||50)/100)*sk, sc=tH/Math.max(1e-6,hi[1]-lo[1]);
      h=tH; foot=Math.max(hi[0]-lo[0],hi[2]-lo[2])*sc;
      objs.push({tm:rv.tm,m:M.mul(M.inst(p.x,y,p.z,p.rot||0,sc),M.tr(-(lo[0]+hi[0])/2,-lo[1],-(lo[2]+hi[2])/2)),iid:it.id,pick:{c:[p.x,y+h/2,p.z],r:Math.max(.3,Math.max(h,foot)*.55),prio:2}}); }
    else if(rv.kind==='bb'){ h=Math.max(.3,(it.tinggi_cm||50)/100)*sk; foot=h*.7;
      objs.push({g:V.geo('blob',g=>g.blob(.5,.5)),m:M.inst(p.x,y+.004,p.z,0,foot),noShadow:true});
      objs.push({bb:{url:rv.url,h,pos:[p.x,y,p.z]},iid:it.id,pick:{c:[p.x,y+h/2,p.z],r:Math.max(.3,h*.5),prio:2}}); }
    else { const vk=rv.key, geo=V.geo(vk,MODELS[vk].build), lo=geo.lo, hi=geo.hi, dx=hi[0]-lo[0], dy=hi[1]-lo[1], dz=hi[2]-lo[2], mx=Math.max(dx,dy,dz), sc=Math.min(2.2,Math.max(1,.5/mx))*sk;
      h=dy*sc; foot=Math.max(dx,dz)*sc;
      objs.push({g:geo,m:M.mul(M.inst(p.x,y,p.z,p.rot||0,sc),M.tr(-(lo[0]+hi[0])/2,-lo[1],-(lo[2]+hi[2])/2)),iid:it.id,pick:{c:[p.x,y+h/2,p.z],r:Math.max(.3,mx*sc*.55),prio:2}}); }
    if(!ed){ objs.push({g:V.geo('ring_'+st,g=>ringGeo(g,STATUS_COL[st])),m:M.inst(p.x,y+.006,p.z,0,Math.max(.45,foot*.75)),noShadow:true});
      const pin={g:V.geo('pin_'+st,g=>pinGeo(g,STATUS_COL[st])),m:M.inst(p.x,y+h+.25,p.z),base:[p.x,y+h+.2,p.z],ph:k*.7,iid:it.id,pick:{c:[p.x,y+h+.5,p.z],r:.25,prio:3},noShadow:true}; objs.push(pin); pins.push(pin); }
    else if(ed.sel&&ed.sel.t==='i'&&ed.sel.id===it.id) objs.push({g:V.geo('ring_sel',g=>ringGeo(g,'#06b6d4')),m:M.inst(p.x,y+.008,p.z,0,Math.max(.45,foot*.8)),noShadow:true}); });
  if(ed&&ed.sel&&ed.sel.t==='f'){ const f=furn.find(x=>x.id===ed.sel.id), D=f&&FURN[f.jenis]; if(D) objs.push({g:V.geo('ring_sel',g=>ringGeo(g,'#06b6d4')),m:M.inst(f.x,.01,f.z,0,Math.max(D.w,D.d)*.62),noShadow:true}); }
  V.objs=objs; V.onFrame=null; V.invalidate();
  Object.assign(V.scene,{center:[0,1,0],radius:Math.hypot(lab.lebar,lab.panjang)/2+1,sun:[-.55,1,.6],exp:1,fade:100,sky:[.85,.88,.95],gnd:[.5,.48,.46]});
  if(V._lab!==lab.id+'_'+lab.lebar+'_'+lab.panjang){ V._lab=lab.id+'_'+lab.lebar+'_'+lab.panjang; labPreset('iso'); if(!ed) hideLabPanel(); }
  const items=db.items.filter(i=>i.lab_id===lab.id), unplaced=items.length-P.length;
  $('labCount').textContent=`${lab.lebar}×${lab.panjang} m • ${items.length} alat • ${items.filter(i=>i.status==='dipinjam').length} dipinjam • ${items.filter(i=>i.status==='rusak').length} rusak${unplaced>0?` • ${unplaced} belum diletakkan`:''}`;
  $('labEmpty').style.display='none';
  if(labPinned&&!ed&&$('labPanel').style.display==='block') showLabPanel(labPinned);
}
function showLabPanel(id){ const it=itemById(id); if(!it) return hideLabPanel(); labPinned=id; const cur=openLoan(it.id);
  $('labPanel').innerHTML=`<div class="row between"><span class="code muted">${it.id}</span><button class="btn sec sm" data-act="hideLabPanel">✕</button></div>
    <div class="row" style="gap:12px;margin-top:6px;flex-wrap:nowrap">${thumbHTML(it,'thumb lg')}<div><b style="font-size:16px">${esc(it.nama)}</b><div class="muted">${esc(it.lokasi)||'-'}</div><div style="margin-top:4px">${statusBadge(it)}</div></div></div>
    <div class="info-item" style="margin-top:10px;padding:12px"><div class="muted" style="font-weight:700;font-size:12px">${cur?'SEDANG DIPAKAI OLEH':'PEMAKAI TERAKHIR'}</div><div>${lastUserText(it)}</div><div class="muted">${fmt(it.waktu_terakhir)}</div></div>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="view3d" data-id="${it.id}">🧊 Lihat 3D & foto</button>${can('riwayat')?`<button class="btn sm sec" data-act="itemHist" data-id="${it.id}">Riwayat</button>`:''}</div>`;
  $('labPanel').style.display='block'; }
function hideLabPanel(){ $('labPanel').style.display='none'; labPinned=null; }

/* ---------- editor ---------- */
function edStart(){ const lab=curLab(); if(!lab||!can('tataletak')) return; hideLabPanel();
  ed={labId:lab.id,furn:JSON.parse(JSON.stringify(db.furniture.filter(f=>f.lab_id===lab.id))),items:{},removed:[],dirty:false,sel:null,snap:false,drag:null};
  db.items.filter(i=>i.lab_id===lab.id).forEach(i=>ed.items[i.id]={x:i.pos_x??0,z:i.pos_z??0,rot:i.rot||0,placed:!!i.ditempatkan&&i.pos_x!=null});
  renderLab(); renderEd();
  if(labView){ labView.auto=false; if(window.innerWidth>760){ labPreset('iso'); labView.cam.t=[-lab.lebar*.16,.6,0]; } labView.invalidate(); } }
async function edCancel(){ if(ed&&ed.dirty&&!await confirmBox('Buang perubahan tata letak yang belum disimpan?','Buang',true)) return; ed=null; renderLab(); }
async function edSave(){ if(!ed) return; const lab=labById(ed.labId);
  const items=Object.entries(ed.items).map(([id,p])=>({id,pos_x:p.placed?+(+p.x).toFixed(3):null,pos_z:p.placed?+(+p.z).toFixed(3):null,rot:+(+p.rot||0).toFixed(4),ditempatkan:!!p.placed}));
  const r=await run(()=>API.saveLayout(ed.labId,{upsert:ed.furn,remove:ed.removed,items}),`Tata letak ${esc(lab.nama)} disimpan`); if(!r.ok) return;
  ed=null; await reload(); }
function edPos(sel){ if(!ed||!sel) return null; if(sel.t==='f') return ed.furn.find(f=>f.id===sel.id)||null; return ed.items[sel.id]||null; }
function edSetPos(sel,x,z){ const p=edPos(sel); if(!p) return; p.x=+x.toFixed(3); p.z=+z.toFixed(3); ed.dirty=true; }
function edRotate(deg){ const p=edPos(ed&&ed.sel); if(!p) return; p.rot=(((p.rot||0)+deg*Math.PI/180)%(Math.PI*2)+Math.PI*2)%(Math.PI*2); ed.dirty=true; renderLab(); renderEd(); }
function edAddFurn(){ const j=$('edFurnSel').value, D=FURN[j], lab=labById(ed.labId); if(!D) return;
  const c=labView?labView.cam.t:[0,0,0], f={id:'new-'+Date.now(),lab_id:lab.id,jenis:j,x:+Math.max(-lab.lebar/2+D.w/2,Math.min(lab.lebar/2-D.w/2,c[0])).toFixed(2),z:+Math.max(-lab.panjang/2+D.d/2,Math.min(lab.panjang/2-D.d/2,c[2])).toFixed(2),rot:0};
  ed.furn.push(f); ed.sel={t:'f',id:f.id}; ed.dirty=true; renderLab(); renderEd(); toast(`${esc(D.name)} ditambahkan di tengah layar. Seret ke posisinya.`); }
function edDelSel(){ if(!ed||!ed.sel) return; if(ed.sel.t==='f'){ const id=ed.sel.id; ed.furn=ed.furn.filter(f=>f.id!==id); if(!String(id).startsWith('new-')) ed.removed.push(id); }
  else { const p=ed.items[ed.sel.id]; if(p) p.placed=false; } ed.sel=null; ed.dirty=true; renderLab(); renderEd(); }
function edDup(){ const f=edPos(ed&&ed.sel); if(!f||ed.sel.t!=='f') return; const n=Object.assign({},f,{id:'new-'+Date.now(),x:+(f.x+.6).toFixed(2),z:+(f.z+.6).toFixed(2)}); ed.furn.push(n); ed.sel={t:'f',id:n.id}; ed.dirty=true; renderLab(); renderEd(); }
function edPlace(id){ const lab=labById(ed.labId), it=itemById(id), p=ed.items[id]; if(!it||!p) return;
  const placed=Object.entries(ed.items).filter(([k,v])=>v.placed&&k!==id).map(([,v])=>({x:v.x,z:v.z}));
  const s=autoSpot(lab,ed.furn,placed,placePref(it)); Object.assign(p,{x:+s.x.toFixed(3),z:+s.z.toFixed(3),rot:s.rot,placed:true}); ed.sel={t:'i',id}; ed.dirty=true; renderLab(); renderEd(); }
function edPlaceAll(){ Object.keys(ed.items).filter(id=>!ed.items[id].placed).forEach(edPlace); }
function renderEd(){ if(!ed){ $('edPanel').hidden=true; return; } const lab=labById(ed.labId); if(!lab){ ed=null; return; }
  const sel=ed.sel, p=edPos(sel), selName=sel?(sel.t==='f'?(FURN[(p||{}).jenis]||{}).name:(itemById(sel.id)||{}).nama):'';
  const un=Object.entries(ed.items).filter(([,v])=>!v.placed), on=Object.entries(ed.items).filter(([,v])=>v.placed);
  const opts=Object.values(FURN).map(F=>`<option value="${F.key}">${esc(F.name)}</option>`).join('');
  $('edPanel').innerHTML=`<div class="ed-head"><b>${ed.dirty?'<span class="dirty-dot"></span>':''}✏️ ${esc(lab.nama)}</b><button class="btn sec sm" data-act="edCancel">✕</button></div>
  <div class="ed-body">
    <div class="muted">${esc(GAYA[lab.gaya]?.nama||lab.gaya)} • ${lab.lebar} × ${lab.panjang} m</div>
    <div class="row" style="margin-top:6px"><button class="btn sec sm" data-act="labEdit">📐 Ubah ukuran/nama</button><button class="btn sec sm" data-act="labDel">🗑️ Hapus lab</button></div>
    <h4>Tambah perabot</h4><div class="row"><select id="edFurnSel" style="flex:1">${opts}</select><button class="btn sm" data-act="edAddFurn">+ Tambah</button></div>
    <h4>Objek terpilih</h4>
    ${sel&&p?`<div class="ed-sel"><b>${esc(selName||'-')}</b>
      <div class="xyz" style="margin-top:8px"><label class="muted">X (m)<input type="number" step="0.05" data-ed="x" value="${(+p.x).toFixed(2)}"></label><label class="muted">Z (m)<input type="number" step="0.05" data-ed="z" value="${(+p.z).toFixed(2)}"></label><label class="muted">Putar (°)<input type="number" step="15" data-ed="rot" value="${Math.round((p.rot||0)*180/Math.PI)}"></label></div>
      <div class="row" style="margin-top:8px"><button class="btn sec sm" data-act="edRotL">⟲ 90°</button><button class="btn sec sm" data-act="edRotR">⟳ 90°</button><button class="btn sec sm" data-act="edRot15">⟳ 15°</button>
      ${sel.t==='f'?'<button class="btn sec sm" data-act="edDup">⧉ Duplikat</button><button class="btn red sm" data-act="edDel">Hapus</button>':'<button class="btn red sm" data-act="edDel">Keluarkan dari denah</button>'}</div></div>`
    :'<div class="muted">Klik meja/perabot/alat di denah untuk memilih, lalu <b>seret</b> untuk memindahkan.</div>'}
    <h4>Alat belum diletakkan (${un.length})</h4>
    ${un.length?`<div class="ed-list">${un.map(([id])=>{const it=itemById(id);return it?`<div class="it"><span>${esc(it.nama)}</span><button class="btn sm" data-act="edPlace" data-id="${id}">Letakkan</button></div>`:'';}).join('')}</div><button class="btn sec sm" style="margin-top:6px" data-act="edPlaceAll">Letakkan semua otomatis</button>`:'<div class="muted">Semua alat lab ini sudah ada di denah.</div>'}
    <h4>Alat di denah (${on.length})</h4>
    <div class="ed-list">${on.map(([id])=>{const it=itemById(id);return it?`<div class="it"><span>${esc(it.nama)}</span><button class="btn sec sm" data-act="edSelItem" data-id="${id}">Pilih</button></div>`:'';}).join('')||'<div class="muted">-</div>'}</div>
  </div>
  <div class="ed-foot"><button class="btn green" data-act="edSave">💾 Simpan tata letak</button><button class="btn sec" data-act="edCancel">Batal</button>
    <label class="row muted" style="gap:4px;margin-left:auto"><input type="checkbox" id="edSnap" ${ed.snap?'checked':''} style="width:auto"> Snap 25 cm</label></div>`;
}
$('edPanel').addEventListener('change',e=>{ if(!ed) return; if(e.target.id==='edSnap'){ ed.snap=e.target.checked; return; }
  const k=e.target.dataset.ed, p=edPos(ed.sel); if(!k||!p) return; const v=parseFloat(e.target.value); if(isNaN(v)) return;
  if(k==='rot') p.rot=v*Math.PI/180; else p[k]=v; ed.dirty=true; renderLab(); renderEd(); });
function labDialog(lab){ const n=!lab;
  dialog(`<h3>${n?'+ Lab / ruangan baru':'📐 Ubah lab'}</h3>
    <label class="f">Nama lab</label><input id="lbNama" value="${esc(lab?lab.nama:'')}" placeholder="contoh: Bengkel TKR 1">
    <label class="f">Jenis ruangan</label><select id="lbGaya">${Object.entries(GAYA).map(([k,g])=>`<option value="${k}" ${lab&&lab.gaya===k?'selected':''}>${esc(g.nama)}</option>`).join('')}</select>
    <div class="grid two"><div><label class="f">Lebar (m, kiri–kanan)</label><input id="lbW" type="number" min="4" max="60" step="0.5" value="${lab?lab.lebar:14}"></div><div><label class="f">Panjang (m, depan–belakang)</label><input id="lbD" type="number" min="4" max="60" step="0.5" value="${lab?lab.panjang:10}"></div></div>
    ${n?'<label class="row" style="margin-top:12px;gap:8px"><input type="checkbox" id="lbTmpl" checked style="width:auto"> Isi perabot awal sesuai jenis ruangan (bisa diatur ulang)</label>':''}
    <p class="muted">Ukur ruangan asli dengan meteran agar denah 3D serupa dengan lab sebenarnya.</p>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" data-act="closeDialog">Batal</button><button class="btn" id="lbSave">${n?'Buat lab':'Simpan'}</button></div>`);
  $('lbSave').onclick=async()=>{ const nama=$('lbNama').value.trim(), gaya=$('lbGaya').value, W=Math.min(60,Math.max(4,parseFloat($('lbW').value)||14)), D=Math.min(60,Math.max(4,parseFloat($('lbD').value)||10));
    if(!nama) return toast('Nama lab wajib diisi','bad');
    if(n){ const r=await run(()=>API.addLab({nama,gaya,lebar:W,panjang:D,urutan:db.labs.length+1},$('lbTmpl').checked?labTemplate(gaya,W,D):[]),`Lab ${esc(nama)} dibuat`); if(!r.ok) return; closeDialog(); pref.set('lab',r.r.id); await reload(); edStart(); }
    else { const r=await run(()=>API.updateLab(lab.id,{nama,gaya,lebar:W,panjang:D}),'Lab diperbarui'); if(!r.ok) return; closeDialog(); const keep=ed; await reload(); if(keep){ ed=keep; } renderLab(); renderEd(); } }; }
async function labDel(){ const lab=labById(ed?ed.labId:pref.get('lab','')); if(!lab) return;
  if(!await confirmBox(`Hapus lab <b>${esc(lab.nama)}</b> beserta seluruh perabotnya? Alat di lab ini tidak dihapus (menjadi "tanpa lab").`,'Hapus lab',true)) return;
  if((await run(()=>API.deleteLab(lab.id),'Lab dihapus')).ok){ ed=null; pref.set('lab',''); await reload(); } }
function heroImage(){ try{ const c=document.createElement('canvas'); c.width=440; c.height=280; const V=new G3.View(c,{auto:false,noInput:true,smSize:2048}), F=labTemplate('oto',18,13), M=G3.M;
  V.objs=[{g:V.geo('s',g=>buildShell(g,'oto',18,13)),m:M.inst(0,0,0)}].concat(F.map(f=>({g:V.geo('f_'+f.jenis,FURN[f.jenis].build),m:M.inst(f.x,0,f.z,f.rot),noShadow:!!FURN[f.jenis].flat})));
  const P=[]; ['engine','compressor','toolbox','jack','jackstand'].forEach(k=>{ const s=autoSpot({lebar:18,panjang:13},F,P,'floor'); P.push(s); const geo=V.geo(k,MODELS[k].build); V.objs.push({g:geo,m:M.mul(M.inst(s.x,0,s.z,s.rot,1),M.tr(-(geo.lo[0]+geo.hi[0])/2,-geo.lo[1],-(geo.lo[2]+geo.hi[2])/2))}); });
  Object.assign(V.scene,{center:[0,1,0],radius:12,sun:[-.55,1,.6],exp:1,fade:100,sky:[.85,.88,.95],gnd:[.5,.48,.46]}); Object.assign(V.cam,{t:[0,.4,0],yaw:.55,pitch:.6,dist:16,fov:40});
  V.render(0); const url=c.toDataURL('image/png'), x=V.gl.getExtension('WEBGL_lose_context'); if(x) x.loseContext(); return url; }catch(e){ return ''; } }

/* ======================================================================
   SUPER ADMIN: KELOLA SEKOLAH
   ====================================================================== */
let supers=[]; const brandImg={};
function slugKode(nama){ let t=String(nama||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\bnegeri\b/g,'n').replace(/\bswasta\b/g,'s');
  const tk=t.split(/[^a-z0-9]+/).filter(Boolean); let out='';
  tk.forEach((w,i)=>{ const short=w.length<=3||/^\d+$/.test(w), prevShort=i>0&&(tk[i-1].length<=3||/^\d+$/.test(tk[i-1])); out+=(i===0?'':(short&&prevShort?'':'-'))+w; });
  return out.replace(/^-+/,'').slice(0,30).replace(/-+$/,''); }
function brandFields(p,sc){ const lg=sc&&sc.logo||'🔬'; brandImg[p]=isImg(lg)?lg:'';
  return `<div class="grid two">
    <div><label class="f">Nama sekolah *</label><input id="${p}Nama" value="${esc(sc?sc.nama:'')}" placeholder="contoh: SMK Negeri 1 Makassar"></div>
    <div><label class="f">Kode sekolah ${sc?'(tidak bisa diubah)':'*'}</label><input id="${p}Kode" value="${esc(sc?sc.kode:'')}" ${sc?'disabled':''} placeholder="contoh: smkn1-makassar" autocapitalize="none">
      <div class="muted" style="margin-top:4px">Link login: <b id="${p}Link">${esc(appLink(sc?sc.kode:'…'))}</b></div></div>
    <div><label class="f">Logo: emoji atau unggah gambar</label><div class="row"><input id="${p}Logo" value="${esc(isImg(lg)?'':lg)}" style="width:80px;font-size:20px;text-align:center" maxlength="4">
      <label class="btn sec sm" style="cursor:pointer">🖼️ Unggah logo<input type="file" id="${p}LogoFile" accept="image/*" hidden></label><button type="button" class="btn sec sm" id="${p}LogoClr">Pakai emoji</button></div></div>
    <div><label class="f">Alamat (opsional)</label><input id="${p}Alamat" value="${esc(sc&&sc.alamat||'')}"></div></div>
  <label class="f">Warna tema</label><div class="palette" id="${p}Pal">${PALETTES.map(([a,b],i)=>`<button type="button" data-pal="${i}" title="${a}" style="background:linear-gradient(135deg,${b} 50%,${a} 50%)"></button>`).join('')}</div>
  <div class="color-row" style="margin-top:8px"><label class="muted">Warna utama (tombol)<input type="color" id="${p}W" value="${esc(sc&&sc.warna||'#2563eb')}"></label><label class="muted">Warna menu samping (gelap)<input type="color" id="${p}W2" value="${esc(sc&&sc.warna2||'#0b1f4d')}"></label></div>
  <div class="brand-preview" id="${p}Prev"></div>
  <label class="row" style="gap:8px;margin-top:12px;align-items:flex-start"><input type="checkbox" id="${p}Ai" ${sc&&sc.ai3d?'checked':''} style="width:auto;margin-top:3px">
    <span><b>Izinkan model 3D realistis dengan AI</b> (Meshy, memakai kredit berbayar).<br><span class="muted">${API.cfgInfo&&API.cfgInfo.ai3d?'MESHY_API_KEY sudah terpasang di server.':'Belum aktif: isi MESHY_API_KEY di Vercel.'} Tanpa AI, foto tetap otomatis jadi "3D dari foto".</span></span></label>`; }
function readBrand(p){ const v={nama:$(p+'Nama').value.trim(),warna:$(p+'W').value,warna2:$(p+'W2').value,logo:brandImg[p]||$(p+'Logo').value.trim()||'🔬',alamat:$(p+'Alamat').value.trim(),ai3d:$(p+'Ai').checked};
  if(!$(p+'Kode').disabled) v.kode=$(p+'Kode').value.trim().toLowerCase(); return v; }
function wireBrand(p){
  const prev=()=>{ const v=readBrand(p);
    $(p+'Prev').innerHTML=`<div class="bp-top" style="background:linear-gradient(120deg,${esc(v.warna2)},${esc(mixc(v.warna2,v.warna,.35))})"><div class="sch-logo" style="background:${esc(v.warna)}">${logoHTML(v.logo)}</div><div><b>${esc(v.nama||'Nama sekolah')}</b><div style="font-size:12px;opacity:.8">Pratinjau tampilan</div></div></div>
      <div class="bp-body"><span class="btn sm" style="background:${esc(v.warna)};pointer-events:none">Tombol</span><span class="badge" style="background:${esc(mixc(v.warna,'#ffffff',.86))};color:${esc(mixc(v.warna,'#000000',.25))}">Label</span></div>`;
    if(!$(p+'Kode').disabled) $(p+'Link').textContent=appLink(v.kode||'…'); };
  $(p+'Nama').addEventListener('input',()=>{ if(!$(p+'Kode').disabled&&!$(p+'Kode').dataset.touched) $(p+'Kode').value=slugKode($(p+'Nama').value); prev(); });
  $(p+'Kode').addEventListener('input',()=>{ $(p+'Kode').dataset.touched=1; $(p+'Kode').value=$(p+'Kode').value.toLowerCase().replace(/[^a-z0-9-]/g,''); prev(); });
  [p+'W',p+'W2',p+'Logo',p+'Alamat'].forEach(id=>$(id).addEventListener('input',()=>{ if(id===p+'Logo') brandImg[p]=''; prev(); }));
  $(p+'Pal').addEventListener('click',e=>{ const b=e.target.closest('[data-pal]'); if(!b) return; const [a,c]=PALETTES[+b.dataset.pal]; $(p+'W').value=a; $(p+'W2').value=c; prev(); });
  $(p+'LogoClr').addEventListener('click',()=>{ brandImg[p]=''; if(!$(p+'Logo').value) $(p+'Logo').value='🔬'; prev(); });
  $(p+'LogoFile').addEventListener('change',async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return;
    const r=await run(async()=>{ const img=await loadImg(f), c=document.createElement('canvas'), S=256, sc=Math.max(S/img.naturalWidth,S/img.naturalHeight);
      c.width=S; c.height=S; const x=c.getContext('2d'); x.drawImage(img,(S-img.naturalWidth*sc)/2,(S-img.naturalHeight*sc)/2,img.naturalWidth*sc,img.naturalHeight*sc);
      return API.uploadFoto(`_logo/${uid()}.png`,await toBlob(c,'image/png'),'image/png'); },'Logo diunggah');
    if(r.ok){ brandImg[p]=r.r; prev(); } });
  prev(); }
async function loadSupers(){ if(!isSuper()) return; const r=await API.listUsers(null).catch(e=>{ toast('❌ '+esc(e.message),'bad'); return null; }); if(r){ supers=r; renderSekolah(); } }
function renderSekolah(){ if(!isSuper()||!$('tSekolah')) return;
  $('tSekolah').innerHTML=schools.length?schools.map(x=>`<tr><td><div class="sch-cell"><div class="sch-logo" style="background:linear-gradient(135deg,${esc(x.warna2)},${esc(x.warna)})">${logoHTML(x.logo)}</div><div><b>${esc(x.nama)}</b><div class="muted code">${esc(x.kode)}</div></div></div></td>
    <td><div class="link-copy"><code>${esc(appLink(x.kode))}</code><button class="btn sec sm" data-act="copyLink" data-id="${esc(x.kode)}">Salin</button></div></td>
    <td><span class="swatch" style="background:${esc(x.warna)}"></span> <span class="swatch" style="background:${esc(x.warna2)}"></span></td>
    <td class="muted">${x.n_anggota||0} anggota<br>${x.n_alat||0} alat • ${x.n_akun||0} akun</td>
    <td>${x.aktif?'<span class="badge b-ok">Aktif</span>':'<span class="badge b-bad">Nonaktif</span>'}${x.id===API.sid?'<div class="muted" style="margin-top:4px">● sedang dikelola</div>':''}</td>
    <td><div class="row"><button class="btn sm" data-act="schManage" data-id="${x.id}">Kelola →</button><button class="btn sm sec" data-act="schEdit" data-id="${x.id}">✏️ Ubah</button>
      <button class="btn sm sec" data-act="schToggle" data-id="${x.id}">${x.aktif?'Nonaktifkan':'Aktifkan'}</button><button class="btn sm red" data-act="schDel" data-id="${x.id}">Hapus</button></div></td></tr>`).join('')
    :`<tr><td colspan="6" class="empty">Belum ada sekolah. Klik <b>+ Tambah sekolah</b>.</td></tr>`;
  $('tSuper').innerHTML=supers.map(u=>`<tr><td><b>${esc(u.nama)}</b><div class="muted code">@${esc(u.username)}</div></td><td>${u.aktif?'<span class="badge b-ok">Aktif</span>':'<span class="badge b-bad">Nonaktif</span>'}</td>
    <td><div class="row"><button class="btn sm sec" data-act="superPass" data-id="${u.id}">Reset password</button>${u.id!==me.id?`<button class="btn sm red" data-act="akDel" data-id="${u.id}">Hapus</button>`:'<span class="muted">(Anda)</span>'}</div></td></tr>`).join('')||`<tr><td colspan="3" class="empty">Memuat…</td></tr>`; }
function schNew(){
  dialog(`<div class="row between"><h3 style="margin:0">🏫 Tambah sekolah</h3><button class="btn sec sm" data-act="closeDialog">✕</button></div>
    ${brandFields('nw',null)}
    <h4 style="margin:18px 0 4px">Admin pertama sekolah ini</h4><p class="muted" style="margin:0 0 6px">Admin ini yang nanti membuat akun staf & siswa di sekolahnya.</p>
    <div class="grid two"><div><label class="f">Nama admin</label><input id="nwANama" placeholder="contoh: Pak Budi"></div><div><label class="f">Username admin</label><input id="nwAUser" value="admin"></div>
    <div><label class="f">Password admin (min. 6)</label><input id="nwAPass" type="text" placeholder="contoh: rahasia123"></div></div>
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" data-act="closeDialog">Batal</button><button class="btn" id="nwSave">Buat sekolah</button></div>`);
  $('dlgBox').classList.add('wide'); wireBrand('nw');
  $('nwSave').onclick=async()=>{ const v=readBrand('nw'), an=$('nwANama').value.trim(), au=$('nwAUser').value.trim().toLowerCase(), ap=$('nwAPass').value;
    if(!v.nama) return toast('Nama sekolah wajib diisi','bad'); if(!validKode(v.kode)) return toast('Kode sekolah: 2–30 huruf kecil/angka/minus, bukan kata khusus (api, admin, …)','bad');
    if(!USERNAME_RE.test(au)) return toast('Username admin 3–32 karakter: huruf kecil, angka, titik, minus','bad'); if(ap.length<6) return toast('Password admin minimal 6 karakter','bad');
    const r=await run(async()=>{ const sc=await API.createSchool(v); let akunErr=null; try{ await API.createUser({role:'admin',school_id:sc.id,username:au,nama:an||'Admin '+v.nama,password:ap}); }catch(e){ akunErr=e.message; } return {sc,akunErr}; },`Sekolah ${esc(v.nama)} dibuat`);
    if(!r.ok) return; await loadSchools(); const {sc,akunErr}=r.r;
    dialog(`<h3>✅ Sekolah ${esc(sc.nama)} siap dipakai</h3>${akunErr?`<div class="login-err">Sekolah dibuat, tetapi akun admin gagal: ${esc(akunErr)}. Buat lewat Kelola → Akun.</div>`:''}
      <p>Kirim info ini ke admin sekolah:</p><div class="info-item"><div>Link login: <b>${esc(appLink(sc.kode))}</b></div><div>Kode sekolah: <b class="code">${esc(sc.kode)}</b></div>
      <div>Username: <b class="code">${esc(au)}</b></div><div>Password: <b class="code">${esc(ap)}</b></div></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sec" data-act="copyLink" data-id="${esc(sc.kode)}">Salin link</button><button class="btn sec" data-act="closeDialog">Tutup</button><button class="btn" data-act="schManage" data-id="${sc.id}">Kelola sekarang →</button></div>`); };
}
function schEdit(id){ const sc=schools.find(x=>x.id===id); if(!sc) return;
  dialog(`<div class="row between"><h3 style="margin:0">✏️ Ubah sekolah</h3><button class="btn sec sm" data-act="closeDialog">✕</button></div>${brandFields('ed',sc)}
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" data-act="closeDialog">Batal</button><button class="btn" id="edSchSave">💾 Simpan</button></div>`);
  wireBrand('ed');
  $('edSchSave').onclick=async()=>{ const v=readBrand('ed'); if(!v.nama) return toast('Nama sekolah wajib diisi','bad');
    if((await run(()=>API.updateSchool(id,v),'Sekolah diperbarui')).ok){ closeDialog(); await loadSchools(); if(id===API.sid){ window.__hero=0; $('identForm').dataset.sid=''; await reload(); } } }; }
async function schToggle(id){ const sc=schools.find(x=>x.id===id); if(!sc) return;
  if(sc.aktif&&!await confirmBox(`Nonaktifkan <b>${esc(sc.nama)}</b>? Semua akun sekolah ini tidak bisa login sampai diaktifkan lagi. Data tetap aman.`,'Nonaktifkan',true)) return;
  if((await run(()=>API.updateSchool(id,{aktif:!sc.aktif}),sc.aktif?'Sekolah dinonaktifkan':'Sekolah diaktifkan')).ok) await loadSchools(); }
function schDel(id){ const sc=schools.find(x=>x.id===id); if(!sc) return;
  dialog(`<h3>🗑️ Hapus sekolah ${esc(sc.nama)}?</h3><p>Semua data sekolah ini akan <b>dihapus permanen</b>: lab, perabot, alat, anggota, riwayat, dan semua akun login-nya. Sebaiknya <b>Ekspor data</b> dulu.</p>
    <label class="f">Ketik kode sekolah <b class="code">${esc(sc.kode)}</b> untuk konfirmasi</label><input id="delKode" autocomplete="off">
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sec" data-act="closeDialog">Batal</button><button class="btn red" id="delGo">Hapus permanen</button></div>`);
  $('delGo').onclick=async()=>{ if($('delKode').value.trim()!==sc.kode) return toast('Kode tidak cocok','bad');
    if((await run(()=>API.deleteSchool(id,sc.kode),'Sekolah dihapus')).ok){ closeDialog(); if(API.sid===id) await switchSchool(null); await loadSchools(); } }; }
function superNew(){
  dialog(`<h3>🛡️ Tambah Super Admin</h3><p class="muted">Super Admin bisa mengelola semua sekolah. Berikan hanya kepada orang yang dipercaya.</p>
    <label class="f">Nama</label><input id="spNama"><label class="f">Username</label><input id="spUser" autocomplete="off"><label class="f">Password (min. 6)</label><input id="spPass" type="text" autocomplete="off">
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sec" data-act="closeDialog">Batal</button><button class="btn" id="spGo">Buat</button></div>`);
  $('spGo').onclick=async()=>{ const b={role:'superadmin',nama:$('spNama').value.trim(),username:$('spUser').value.trim().toLowerCase(),password:$('spPass').value};
    if(!USERNAME_RE.test(b.username)) return toast('Username tidak valid','bad'); if(b.password.length<6) return toast('Password minimal 6 karakter','bad');
    if((await run(()=>API.createUser(b),'Super Admin ditambahkan')).ok){ closeDialog(); loadSupers(); } }; }
function superPass(id){ dialog(`<h3>Reset password</h3><label class="f">Password baru (min. 6)</label><input id="rpPass" type="text" autocomplete="off">
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sec" data-act="closeDialog">Batal</button><button class="btn" id="rpGo">Simpan</button></div>`);
  $('rpGo').onclick=async()=>{ const pw=$('rpPass').value; if(pw.length<6) return toast('Password minimal 6 karakter','bad'); if((await run(()=>API.updateUser({id,password:pw}),'Password diganti')).ok) closeDialog(); }; }
function copyLink(kode){ const l=appLink(kode); (navigator.clipboard?navigator.clipboard.writeText(l):Promise.reject()).then(()=>toast('Link disalin: '+esc(l),'ok'),()=>toast('Link: '+esc(l))); }

/* ======================================================================
   EVENT
   ====================================================================== */
const ACTIONS={
  aiStart:id=>aiStart(id), schNew, schEdit, schToggle, schDel, superNew, superPass, copyLink, schManage:id=>{ closeDialog(); switchSchool(id); },
  seed, addUser, addItem, csv:exportCSV, exportJson, saveSchool, resetDemo, clearMember,
  camera:()=>openCamera(), closeCamera, closeDialog, closeV3, hideLabPanel, veSave,
  printAllCards:()=>printCards(db.anggota), printAllLabels:()=>printLabels(db.items),
  manUser:()=>{ const v=$('manUser').value; if(!v) return toast('Pilih anggota dulu','bad'); handleCode(v); },
  manItem:()=>{ const v=$('manItem').value; if(!v) return toast('Pilih alat dulu','bad'); handleCode(v); },
  showCard, showLabel, delUser, delItem, mkAkun, akCreate, akEdit, akDel, akReload:loadUsers,
  printCard:id=>printCards([anggotaById(id)]), pngCard:id=>svgToPng(cardSVG(anggotaById(id)),'kartu-'+id+'.png'),
  printLabel:id=>printLabels([itemById(id)]), pngLabel:id=>svgToPng(labelSVG(itemById(id)),'label-'+id+'.png'),
  fixItem:async id=>{ if((await run(()=>API.updateItem(id,{status:'tersedia'}),'Alat kembali tersedia')).ok) await reload(); },
  itemHist:id=>{ closeV3(); goTab('riwayat'); $('hSearch').value=id; renderHistory(); },
  view3d:id=>openViewer(id),
  v3Reset:()=>{ const it=itemById(v3Id); if(v3View&&it){ stageItem(v3View,it); v3View.cam.yaw=.75; v3View.invalidate(); } },
  v3Auto:()=>{ if(v3View){ v3View.auto=!v3View.auto; v3View.idle=0; toast(v3View.auto?'Putar otomatis aktif':'Putar otomatis mati'); } },
  v3DelFoto:async()=>{ const it=itemById(v3Id); if(!it||!await confirmBox('Hapus foto asli alat ini?','Hapus',true)) return; $('v3Modal').classList.add('show');
    if((await run(()=>API.updateItem(it.id,{foto_url:null,foto3d_url:null}),'Foto dihapus')).ok){ await reload(); if(v3View) stageItem(v3View,itemById(it.id)); setV3Mode('3d'); } },
  labIso:()=>labPreset('iso'), labTop:()=>labPreset('top'),
  labAuto:()=>{ if(labView){ labView.auto=!labView.auto; labView.idle=0; toast(labView.auto?'Putar otomatis aktif':'Putar otomatis mati'); } },
  labNew:()=>labDialog(null), labEdit:()=>labDialog(labById(ed?ed.labId:pref.get('lab',''))), labDel,
  edStart, edCancel, edSave, edAddFurn, edDel:edDelSel, edDup, edPlace, edPlaceAll,
  edRotL:()=>edRotate(-90), edRotR:()=>edRotate(90), edRot15:()=>edRotate(15),
  edSelItem:id=>{ ed.sel={t:'i',id}; renderLab(); renderEd(); },
};
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-tab]'); if(nav) return goTab(nav.dataset.tab);
  const go=e.target.closest('[data-go]'); if(go) return goTab(go.dataset.go);
  const md=e.target.closest('[data-mode]'); if(md) return setMode(md.dataset.mode);
  const v3=e.target.closest('[data-v3]'); if(v3) return setV3Mode(v3.dataset.v3);
  const b=e.target.closest('[data-act]'); if(!b) return; const fn=ACTIONS[b.dataset.act]; if(fn) fn(b.dataset.id);
});
$('dlgModal').addEventListener('click',e=>{ if(e.target===$('dlgModal')) closeDialog(); });
$('camModal').addEventListener('click',e=>{ if(e.target===$('camModal')) closeCamera(); });
$('v3Modal').addEventListener('click',e=>{ if(e.target===$('v3Modal')) closeV3(); });
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ if($('camModal').classList.contains('show')) return closeCamera(); if($('dlgModal').classList.contains('show')) return closeDialog(); if($('v3Modal').classList.contains('show')) return closeV3(); }
  if(ed&&ed.sel&&curTab==='lab3d'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)&&!$('dlgModal').classList.contains('show')){
    const p=edPos(ed.sel), st=e.shiftKey?.5:.1;
    if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); edDelSel(); }
    else if(e.key==='r'||e.key==='R'){ edRotate(e.shiftKey?-90:90); }
    else if(p&&e.key.startsWith('Arrow')){ e.preventDefault(); const d={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]}[e.key]; edSetPos(ed.sel,p.x+d[0],p.z+d[1]); renderLab(); renderEd(); }
  }
});
$('scanInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); handleCode(e.target.value); } });
$('uNama').addEventListener('keydown',e=>{ if(e.key==='Enter') addUser(); });
$('uSearch').addEventListener('input',renderUsers); $('iSearch').addEventListener('input',renderItems); $('iFilterLab').addEventListener('change',renderItems);
$('hSearch').addEventListener('input',renderHistory); $('hFilter').addEventListener('change',renderHistory);
$('iNama').addEventListener('input',updatePreview); $('iModel').addEventListener('change',updatePreview); $('iLab').addEventListener('change',()=>$('iLab').dataset.touched=1);
$('camSelect').addEventListener('change',e=>openCamera(e.target.value));
$('photoInput').addEventListener('change',e=>{ scanPhoto(e.target.files[0]); e.target.value=''; });
$('sidSel').addEventListener('change',e=>switchSchool(e.target.value));
$('labSel').addEventListener('change',e=>{ pref.set('lab',e.target.value); hideLabPanel(); renderLab(); });
window.addEventListener('beforeunload',e=>{ stopStream(); if(ed&&ed.dirty){ e.preventDefault(); e.returnValue=''; } });

boot();
