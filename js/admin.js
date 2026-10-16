"use strict";
/* ======================================================================
   SiPinLab v6 – Halaman Kepala Lab (admin)
   Alur: siswa mengajukan lewat link siswa → kepala lab menyetujui &
   menyerahkan alat → siswa mengembalikan → kepala lab mengonfirmasi.
   ====================================================================== */
let API=null, me=null, db={school:null,anggota:[],items:[],loans:[]}, schools=[], route='', loginSuper=false;
const anggotaById=id=>db.anggota.find(a=>a.id===id);
const itemById=id=>db.items.find(i=>i.id===id);
const isSuper=()=>!!me&&me.role==='superadmin';
const kodeNow=()=>(db.school&&db.school.kode)||'';
const initial=n=>esc(String(n||'?').trim().charAt(0).toUpperCase());
const pending=()=>db.loans.filter(l=>l.status==='menunggu');

/* ======================================================================
   BOOT & LOGIN
   ====================================================================== */
async function boot(){
  busy(true);
  try{ API=await createAPI(); }catch(e){ busy(false); $('root').innerHTML=`<div class="center"><div class="auth"><div class="err">${esc(e.message)}</div></div></div>`; return; }
  try{ me=await API.session(); if(me) return enterApp(); await showLogin(); }
  catch(e){ await showLogin(translateErr(e.message)); }
  finally{ busy(false); }
}
async function showLogin(err){
  const kodeUrl=urlKode(), kode=kodeUrl||store.get('kode',API.mode==='demo'?'demo':'');
  const setup=API.mode==='supabase'&&await API.needsSetup().catch(()=>false);
  const sc=!loginSuper&&kode?await API.schoolInfo(kode):null; applyTheme(sc,'Kepala Lab');
  $('root').innerHTML=`<div class="center blue"><div class="auth">
    <div class="logo">${sc?logoHTML(sc.logo):'🔬'}</div>
    <h1>${setup?'Selamat datang':loginSuper?'Super Admin':esc(sc?sc.nama:'Masuk Kepala Lab')}</h1>
    <p class="lead">${setup?'Buat akun Super Admin pertama untuk mulai.':loginSuper?'Pengelola semua sekolah.':'Kelola alat, anggota, dan persetujuan peminjaman.'}</p>
    <div class="card">${setup?`
      <form id="setupForm"><label class="f">Nama</label><input id="suNama" required placeholder="contoh: Pak Irwan">
        <label class="f">Username</label><input id="suUser" required autocapitalize="none" placeholder="contoh: super">
        <label class="f">Password <span class="muted">(min. 6)</span></label><input id="suPass" type="password" minlength="6" required>
        <button class="btn lg full" style="margin-top:18px">Buat akun Super Admin</button></form>`:`
      <form id="loginForm" autocomplete="on">
        ${loginSuper?'':`<label class="f">Kode sekolah</label><input id="lgKode" value="${esc(kode)}" ${kodeUrl?'readonly':''} autocapitalize="none" spellcheck="false" placeholder="contoh: smkn1">`}
        <label class="f">Username</label><input id="lgUser" autocomplete="username" autocapitalize="none" required>
        <label class="f">Password</label><input id="lgPass" type="password" autocomplete="current-password" required>
        <button class="btn lg full" style="margin-top:18px">Masuk</button></form>`}
      ${err?`<div class="err">${esc(err)}</div>`:''}
    </div>
    ${setup?'':`<div class="foot"><a href="#" data-act="toggleSuper">${loginSuper?'Masuk sebagai kepala lab':'Masuk sebagai Super Admin'}</a>${sc&&!loginSuper?` · <a href="${esc(isLocal()?'pinjam.html?s='+sc.kode:'/'+sc.kode)}">Halaman siswa</a>`:''}</div>`}
    ${API.mode==='demo'?`<div class="demo"><b>Mode demo</b> — belum terhubung ke Supabase, data hanya tersimpan di browser ini.<div style="margin:10px 0"><button class="btn sm" data-act="hubungkan">🔌 Hubungkan ke Supabase</button></div>Coba dulu: kode <b>demo</b>, <b>admin</b> / <b>admin123</b> · Super Admin: <b>super</b> / <b>super123</b><br>Halaman siswa: <a href="pinjam.html?s=demo">pinjam.html?s=demo</a> (kode <b>1</b>, nama <b>andi</b>)</div>`:`<div class="foot" style="margin-top:8px"><a href="#" data-act="hubungkan">🔌 Pengaturan koneksi Supabase</a></div>`}
  </div></div>`;
  const lf=$('loginForm');
  if(lf){ setTimeout(()=>(($('lgKode')&&!$('lgKode').value)?$('lgKode'):$('lgUser')).focus(),30);
    lf.onsubmit=async e=>{ e.preventDefault(); const k=loginSuper?'':$('lgKode').value.trim().toLowerCase();
      if(!loginSuper&&!k) return showLogin('Isi kode sekolah');
      busy(true); try{ me=await API.login(k,$('lgUser').value,$('lgPass').value); if(k) store.set('kode',k); await enterApp(); }
      catch(er){ const u=$('lgUser').value; await showLogin(translateErr(er.message)); $('lgUser').value=u; $('lgPass').focus(); } finally{ busy(false); } }; }
  const sf=$('setupForm');
  if(sf) sf.onsubmit=async e=>{ e.preventDefault(); busy(true);
    try{ await API.setupSuper({nama:$('suNama').value,username:$('suUser').value,password:$('suPass').value}); me=await API.login('',$('suUser').value,$('suPass').value); await enterApp(); toast('Akun Super Admin dibuat. Tambahkan sekolah pertama.','ok'); }
    catch(er){ toast(esc(translateErr(er.message)),'bad'); } finally{ busy(false); } };
}

let liveT=null, pollT=null, lastPending=null, lastSig='';
async function enterApp(){
  if(isSuper()){ await loadSchools(); const keep=store.get('sid',''); API.sid=schools.some(x=>x.id===keep)?keep:null; }
  else API.sid=me.school_id;
  await reload();
  API.subscribe(()=>{ clearTimeout(liveT); liveT=setTimeout(()=>reload(true),400); });
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') reload(true); });
  clearInterval(pollT); pollT=setInterval(()=>{ if(document.visibilityState==='visible') reload(true); },API.mode==='demo'?4000:45000);
  window.addEventListener('hashchange',render);
  if(!location.hash) location.hash=API.sid?'#peminjaman':'#sekolah'; else render();
}
async function loadSchools(){ const r=await run(()=>API.listSchools()); if(r.ok) schools=r.r; }
async function reload(silent){
  const r=silent?{ok:true,r:await API.loadAll().catch(()=>null)}:await run(()=>API.loadAll());
  if(!r.ok||!r.r) return; const sig=JSON.stringify(r.r); if(silent&&sig===lastSig&&document.querySelector('.top')) return; lastSig=sig;
  db=r.r; applyTheme(db.school,'Kepala Lab');
  const n=pending().length;
  if(lastPending!==null&&n>lastPending){ const l=pending().slice(-1)[0]; toast(`Pengajuan baru dari <b>${esc(l.anggota_nama)}</b>`,'ok'); }
  lastPending=n;
  if(!document.querySelector('.dlg input:focus,.dlg textarea:focus,.wrap input:focus,.wrap textarea:focus')||!silent) render(); else renderShell();
}

/* ======================================================================
   KERANGKA: header + tab
   ====================================================================== */
const TABS=[['peminjaman','📋','Peminjaman'],['alat','🧪','Alat Lab'],['anggota','👥','Anggota'],['riwayat','📜','Riwayat'],['pengaturan','⚙️','Pengaturan']];
function renderShell(){
  const base=route.split('/')[0], n=pending().length, sc=db.school;
  const tabs=(API.sid?TABS:[]).concat(isSuper()?[['sekolah','🏫','Kelola Sekolah']]:[]);
  let side=document.querySelector('.side');
  if(!side){ $('root').innerHTML='<div class="app"><aside class="side"></aside><div class="main"><main class="wrap" id="view"></main></div></div>'; side=document.querySelector('.side'); }
  side.innerHTML=`<div class="brand"><div class="logo">${sc?logoHTML(sc.logo):'🔬'}</div><div style="min-width:0"><b>${esc(sc?sc.nama:'SiPinLab')}</b><small>Peminjaman Alat Lab</small></div></div>
    ${isSuper()?`<div class="sw"><label>🛡️ Kelola sekolah</label><select id="sidSel"><option value="">— pilih sekolah —</option>${schools.map(s=>`<option value="${s.id}" ${s.id===API.sid?'selected':''}>${esc(s.nama)}</option>`).join('')}</select></div>`:''}
    ${tabs.map(([k,e,t])=>`<a href="#${k}" class="navbtn ${base===k?'on':''}"><span class="e">${e}</span>${t}${k==='peminjaman'&&n?`<span class="count">${n}</span>`:''}</a>`).join('')}
    <div class="uchip"><div class="av">${initial(me.nama||me.username)}</div><div class="who" style="min-width:0"><b>${esc(me.nama&&me.nama!==ROLE_NAME[me.role]?me.nama:me.username)}</b><small>${esc(ROLE_NAME[me.role]||me.role)}${API.mode==='demo'?'<span class="mpill">DEMO</span>':''}</small></div>
      <button data-act="logout" title="Keluar">${icon('out',16)}</button></div>`;
  const ss=$('sidSel'); if(ss) ss.onchange=()=>switchSchool(ss.value);
}
async function switchSchool(id){ API.sid=id||null; store.set('sid',API.sid||''); lastPending=null; await reload(); location.hash=API.sid?'#peminjaman':'#sekolah'; }
function render(){
  route=location.hash.slice(1)||'peminjaman';
  const [base,sub]=route.split('/');
  if(!API.sid&&base!=='sekolah'){ if(isSuper()){ location.hash='#sekolah'; return; } }
  renderShell();
  const v=$('view'); const keep=v.dataset.route===route; const y=window.scrollY;
  const P={peminjaman:sub==='baru'?pgPinjamBaru:pgPeminjaman,alat:sub==='baru'?pgAlatBaru:sub?pgAlatDetail:pgAlat,anggota:sub==='baru'?pgAnggotaBaru:pgAnggota,riwayat:pgRiwayat,pengaturan:pgPengaturan,sekolah:pgSekolah}[base]||pgPeminjaman;
  if(keep&&P.live===false) return;           // halaman form: jangan hapus isian saat data diperbarui
  v.dataset.route=route; P(v,sub);
  if(keep) window.scrollTo(0,y); else window.scrollTo(0,0);
}

/* ======================================================================
   PEMINJAMAN
   ====================================================================== */
function pgPeminjaman(v){
  const pend=pending(), out=db.loans.filter(l=>l.status==='dipinjam').sort((a,b)=>a.pinjam.localeCompare(b.pinjam));
  const groups=[]; for(const l of pend.slice().sort((a,b)=>a.diajukan.localeCompare(b.diajukan))){ const k=l.anggota_id+'|'+String(l.diajukan).slice(0,16);
    let g=groups.find(x=>x.k===k); if(!g){ g={k,anggota_id:l.anggota_id,nama:l.anggota_nama,diajukan:l.diajukan,catatan:l.catatan,loans:[]}; groups.push(g); } g.loans.push(l); }
  const today=new Date().toDateString(), hariIni=db.loans.filter(l=>[l.diajukan,l.pinjam,l.kembali].some(t=>t&&new Date(t).toDateString()===today)).length;
  const k=kodeNow(), url=k?linkSiswa(k):'', pics=db.items.filter((x,i,arr)=>arr.findIndex(y=>baseName(y.nama)===baseName(x.nama))===i).slice(0,3);
  v.innerHTML=`
  <div class="page-head"><div><h1><span class="e">📋</span>Peminjaman</h1><p>Setujui pengajuan siswa, serahkan alat, lalu konfirmasi saat alat dikembalikan.</p></div>
    <a class="btn" href="#peminjaman/baru">${icon('plus')} Buat peminjaman</a></div>
  <div class="stats">
    <div class="stat"><div class="si" style="background:#fee2e2">⏳</div><div><b>${pend.length}</b><span>Menunggu persetujuan</span></div></div>
    <div class="stat"><div class="si" style="background:#fef3c7">📦</div><div><b>${out.length}</b><span>Sedang dipinjam</span></div></div>
    <div class="stat"><div class="si" style="background:#ede9fe">🧪</div><div><b>${db.items.length}</b><span>Total alat</span></div></div>
    <div class="stat"><div class="si" style="background:#e0eaff">👥</div><div><b>${db.anggota.length}</b><span>Anggota terdaftar</span></div></div>
  </div>
  ${url?`<div class="hero"><div class="grow" style="min-width:0;position:relative;z-index:1"><h2>📲 Link peminjaman untuk siswa</h2><p>Bagikan ke grup kelas. Siswa masuk dengan kode anggota / NIS, memilih alat dalam 3D, lalu mengajukan. ${hariIni} aktivitas hari ini.</p>
    <code>${esc(url)}</code><div class="row" style="margin-top:12px"><button class="btn ghost sm" data-act="copy" data-v="${esc(url)}">${icon('copy',16)} Salin link</button><a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener">Buka halaman siswa</a></div></div>
    <div class="imgs">${pics.map(i=>`<img src="${esc(itemImg(i))}" alt="">`).join('')}</div></div>`:''}
  <div class="section"><div class="section-head"><h2>⏳ Menunggu persetujuan</h2><span class="count ${groups.length?'':'grey'}">${pend.length}</span></div>
    ${groups.length?groups.map(reqCard).join(''):`<div class="list"><div class="empty"><b>Tidak ada pengajuan baru</b>Pengajuan dari halaman siswa akan muncul di sini secara otomatis.</div></div>`}</div>
  <div class="section"><div class="section-head"><h2>📦 Sedang dipinjam</h2><span class="count grey">${out.length}</span></div>
    <div class="list">${out.length?out.map(l=>{ const it=itemById(l.item_id)||{nama:l.item_nama}, a=anggotaById(l.anggota_id), lama=(Date.now()-new Date(l.pinjam))>864e5;
      return `<div class="li">${imgHTML(it,'pic sm')}<div class="main"><b>${esc(l.item_nama)} <span class="mono muted">${esc(l.item_id)}</span></b>
        <span>${esc(l.anggota_nama)}${a&&a.kelas?' · '+esc(a.kelas):''} · sejak ${fmtJam(l.pinjam)} <span style="color:${lama?'var(--bad)':'inherit'}">(${dur(l.pinjam)})</span></span></div>
        <button class="btn ghost sm" data-act="kembali" data-id="${l.id}">${icon('check',16)} Terima kembali</button></div>`; }).join('')
      :`<div class="empty"><b>Tidak ada alat yang sedang dipinjam</b></div>`}</div></div>`;
}
function linkBox(){ const k=kodeNow(); if(!k) return ''; const url=linkSiswa(k);
  return `<div class="linkbox">${icon('link')}<div class="grow" style="min-width:0"><div class="small muted">Link untuk siswa</div><code>${esc(url)}</code></div>
    <button class="btn ghost sm" data-act="copy" data-v="${esc(url)}">${icon('copy',16)} Salin</button><a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener">Buka</a></div>`; }
function reqCard(g){ const a=anggotaById(g.anggota_id);
  return `<div class="req"><div class="req-head"><div class="av">${initial(g.nama)}</div><div class="grow"><b>${esc(g.nama)}</b>
    <div class="small muted">${a?esc([a.kelas,a.id].filter(Boolean).join(' · ')):'(anggota sudah dihapus)'} · ${fmtJam(g.diajukan)}</div></div>
    ${g.loans.length>1?`<button class="btn sm" data-act="setujuiSemua" data-ids="${g.loans.map(l=>l.id).join(',')}">${icon('check',16)} Setujui semua</button>`:''}</div>
    ${g.catatan?`<div class="req-note"><span class="muted">Keperluan:</span> ${esc(g.catatan)}</div>`:''}
    ${g.loans.map(l=>{ const it=itemById(l.item_id), st=it?it.status:'hilang';
      return `<div class="li">${it?imgHTML(it,'pic xs'):'<div class="pic xs"></div>'}<div class="main"><b>${esc(l.item_nama)}</b><span class="mono">${esc(l.item_id)}</span>
        ${st!=='tersedia'?` · ${it?pill(st,st==='dipinjam'?'Sedang dipinjam orang lain':'Rusak'):'<span class="small" style="color:var(--bad)">alat dihapus</span>'}`:''}</div>
        <button class="btn link sm" data-act="tolak" data-id="${l.id}">Tolak</button>
        <button class="btn sm" data-act="setujui" data-id="${l.id}" ${st!=='tersedia'?'disabled':''}>Setujui</button></div>`; }).join('')}</div>`; }

async function setujui(ids){ const r=await run(async()=>{ for(const id of ids) await API.setujui(id); },ids.length>1?`${ids.length} alat disetujui — serahkan alatnya ke siswa`:'Disetujui — serahkan alatnya ke siswa'); await reload(true); return r; }
function tolakDlg(id){ const l=db.loans.find(x=>x.id===id); if(!l) return;
  dialog(`<h3>Tolak pengajuan?</h3><p class="dlg-text">${esc(l.anggota_nama)} — ${esc(l.item_nama)}</p>
    <label class="f">Alasan <span class="muted">(opsional, terlihat oleh siswa)</span></label><textarea id="tlAlasan" placeholder="contoh: alat sedang dipakai praktik kelas lain"></textarea>
    <div class="dlg-actions"><button class="btn ghost" data-act="closeDlg">Batal</button><button class="btn danger" id="tlOk">Tolak</button></div>`);
  $('tlOk').onclick=async()=>{ const al=$('tlAlasan').value.trim(); closeDialog(); await run(()=>API.tolak(id,al),'Pengajuan ditolak'); reload(true); }; }
const KONDISI=['Baik','Rusak ringan','Rusak berat','Hilang sebagian'];
function kembaliDlg(id){ const l=db.loans.find(x=>x.id===id); if(!l) return; let k='Baik';
  dialog(`<h3>Terima pengembalian</h3><p class="dlg-text">${esc(l.item_nama)} dari <b>${esc(l.anggota_nama)}</b>. Periksa alatnya, lalu pilih kondisinya.</p>
    <div class="chips" id="kdChips">${KONDISI.map(x=>`<button class="chip ${x===k?'on':''}" data-k="${x}">${x}</button>`).join('')}</div>
    <p class="hint">Jika tidak "Baik", alat otomatis berstatus <b>rusak</b> dan tidak bisa dipinjam sampai ditandai sudah diperbaiki.</p>
    <div class="dlg-actions"><button class="btn ghost" data-act="closeDlg">Batal</button><button class="btn" id="kbOk">${icon('check',16)} Konfirmasi dikembalikan</button></div>`);
  $('kdChips').onclick=e=>{ const b=e.target.closest('[data-k]'); if(!b) return; k=b.dataset.k; $('kdChips').querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===b)); };
  $('kbOk').onclick=async()=>{ closeDialog(); await run(()=>API.kembali(id,k),'Alat dikonfirmasi sudah kembali'); reload(true); }; }

/* ---------- buat peminjaman langsung oleh kepala lab ---------- */
let pb={anggota:null,items:new Set(),qa:'',qi:''};
function pgPinjamBaru(v){
  const a=pb.anggota&&anggotaById(pb.anggota);
  const qa=pb.qa.toLowerCase(), list=qa?db.anggota.filter(x=>(x.nama+' '+x.id+' '+x.kelas+' '+x.nis).toLowerCase().includes(qa)).slice(0,8):[];
  const avail=db.items.filter(i=>i.status==='tersedia'&&(i.nama+' '+i.id+' '+i.kategori).toLowerCase().includes(pb.qi.toLowerCase()));
  v.innerHTML=`<a class="back" href="#peminjaman">${icon('back',16)} Peminjaman</a>
  <div class="page-head"><div><h1><span class="e">📝</span>Buat peminjaman</h1><p>Untuk siswa yang tidak bisa mengajukan sendiri. Alat langsung tercatat dipinjam.</p></div></div>
  <div class="card"><h2>1. Peminjam</h2>
    ${a?`<div class="li" style="padding:14px 0 0;border-top:0"><div class="av">${initial(a.nama)}</div><div class="main"><b>${esc(a.nama)}</b><span>${esc([a.kelas,a.id,a.nis&&'NIS '+a.nis].filter(Boolean).join(' · '))}</span></div><button class="btn ghost sm" data-act="pbGanti">Ganti</button></div>`
    :`<div class="search" style="max-width:none;margin-top:12px">${icon('search')}<input id="pbQa" placeholder="Cari nama, kode anggota, kelas, atau NIS" value="${esc(pb.qa)}"></div>
      <div id="pbList" style="margin-top:8px">${qa?(list.length?`<div class="list">${list.map(x=>`<div class="li" style="cursor:pointer" data-act="pbPilih" data-id="${x.id}"><div class="av">${initial(x.nama)}</div><div class="main"><b>${esc(x.nama)}</b><span>${esc([x.kelas,x.id].filter(Boolean).join(' · '))}</span></div></div>`).join('')}</div>`:`<p class="hint">Tidak ditemukan. Hanya anggota terdaftar yang bisa meminjam — <a href="#anggota/baru">daftarkan anggota</a>.</p>`):''}</div>`}
  </div>
  <div class="card"><div class="row"><h2 class="grow">2. Alat <span class="muted" style="font-weight:500">(${pb.items.size} dipilih)</span></h2><div class="search">${icon('search')}<input id="pbQi" placeholder="Cari alat" value="${esc(pb.qi)}"></div></div>
    <div class="items" style="margin-top:14px">${avail.length?avail.map(i=>`<button class="tile ${pb.items.has(i.id)?'sel':''}" data-act="pbItem" data-id="${i.id}">${imgHTML(i)}<div class="body"><b>${esc(i.nama)}</b><div class="meta"><span class="mono">${i.id}</span>${pb.items.has(i.id)?icon('check',18):''}</div></div></button>`).join(''):'<p class="muted">Tidak ada alat tersedia.</p>'}</div></div>
  <div class="card"><h2>3. Keperluan <span class="muted" style="font-weight:500">(opsional)</span></h2><input id="pbCat" style="margin-top:12px" placeholder="contoh: praktik kelistrikan XI TKR 1"></div>
  <div class="row" style="margin-top:18px;justify-content:flex-end"><a class="btn ghost" href="#peminjaman">Batal</a><button class="btn lg" data-act="pbSimpan" ${a&&pb.items.size?'':'disabled'}>Pinjamkan ${pb.items.size||''} alat</button></div>`;
  const qi=$('pbQa'); if(qi){ qi.oninput=()=>{ pb.qa=qi.value; const p=qi.selectionStart; pgPinjamBaru(v); const n=$('pbQa'); n.focus(); n.setSelectionRange(p,p); }; if(!pb.qa) qi.focus(); }
  const qj=$('pbQi'); qj.oninput=()=>{ pb.qi=qj.value; const p=qj.selectionStart; const c=$('pbCat').value; pgPinjamBaru(v); $('pbCat').value=c; const n=$('pbQi'); n.focus(); n.setSelectionRange(p,p); };
}
pgPinjamBaru.live=false;

/* ======================================================================
   ALAT
   ====================================================================== */
let fAlat={q:'',st:''};
function pgAlat(v){
  const q=fAlat.q.toLowerCase(), st=fAlat.st;
  const list=db.items.filter(i=>(!st||i.status===st)&&(i.nama+' '+i.id+' '+i.kategori+' '+i.lokasi).toLowerCase().includes(q));
  const c=s=>db.items.filter(i=>i.status===s).length;
  v.innerHTML=`<div class="page-head"><div><h1><span class="e">🧪</span>Alat</h1><p>${db.items.length} alat · ${c('tersedia')} tersedia · ${c('dipinjam')} dipinjam${c('rusak')?` · ${c('rusak')} rusak`:''}</p></div>
    <a class="btn" href="#alat/baru">${icon('plus')} Tambah alat</a></div>
  <div class="row" style="margin-bottom:16px"><div class="search">${icon('search')}<input id="aQ" placeholder="Cari alat, kode, kategori" value="${esc(fAlat.q)}"></div>
    <div class="seg" id="aSt">${[['','Semua'],['tersedia','Tersedia'],['dipinjam','Dipinjam'],['rusak','Rusak']].map(([k,t])=>`<button data-st="${k}" class="${st===k?'on':''}">${t}</button>`).join('')}</div></div>
  ${list.length?`<div class="items">${list.map(i=>`<a class="tile" href="#alat/${i.id}" style="text-decoration:none;color:inherit">${imgHTML(i).replace('</div>',`<span class="b3d">${icon('cube',13)}3D</span></div>`)}
    <div class="body"><b>${esc(i.nama)}</b><div class="meta"><span class="mono">${i.id}</span>${pill(i.status)}</div></div></a>`).join('')}</div>`
  :`<div class="list"><div class="empty">${db.items.length?'<b>Tidak ditemukan</b>':`<b>Belum ada alat</b>Tambahkan alat pertama — visual 3D dibuat otomatis.<div style="margin-top:14px"><a class="btn" href="#alat/baru">${icon('plus')} Tambah alat</a></div>`}</div></div>`}`;
  const q1=$('aQ'); q1.oninput=()=>{ fAlat.q=q1.value; const p=q1.selectionStart; pgAlat(v); const n=$('aQ'); n.focus(); n.setSelectionRange(p,p); };
  $('aSt').onclick=e=>{ const b=e.target.closest('[data-st]'); if(b){ fAlat.st=b.dataset.st; pgAlat(v); } };
}
function stageHTML(){ return `<div class="stage" id="stage"><span class="tip hide-m">Seret untuk memutar · scroll untuk zoom</span>
  <div class="ctl"><button class="btn ghost sm" data-act="v3spin" title="Putar otomatis">${icon('rotate',16)}</button><button class="btn ghost sm" data-act="v3reset">Reset</button></div>
  ${ok3D?'':'<div class="ph">Tampilan 3D tidak didukung browser ini.</div>'}</div>`; }
function mountStage(it){ const s=$('stage'); if(!s||!ok3D) return;
  const same=_viewer&&_viewer.item&&_viewer.item.id===it.id&&JSON.stringify(visualOf(_viewer.item))===JSON.stringify(visualOf(it));
  mountViewer(s,same?null:it); s.insertBefore(_viewer.cv,s.firstChild); if(same) _viewer.item=it; }

function pgAlatDetail(v,id){
  const it=itemById(id); if(!it){ v.innerHTML=`<a class="back" href="#alat">${icon('back',16)} Alat</a><div class="list"><div class="empty"><b>Alat tidak ditemukan</b></div></div>`; return; }
  const cur=db.loans.find(l=>l.item_id===id&&l.status==='dipinjam'), hist=db.loans.filter(l=>l.item_id===id&&(l.status==='dipinjam'||l.status==='kembali')).slice(-6).reverse(), vis=visualOf(it);
  v.innerHTML=`<a class="back" href="#alat">${icon('back',16)} Alat</a>
  <div class="detail"><div>${stageHTML()}
    ${it.foto_url?`<div class="row" style="margin-top:12px"><img src="${esc(it.foto_url)}" alt="Foto asli" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid var(--line)"><span class="small muted grow">Foto asli. Visual 3D dibuat dari foto ini.</span></div>`:''}</div>
  <div>
    <div class="row"><span class="mono muted">${it.id}</span>${pill(it.status)}</div>
    <h1 style="margin-top:6px">${esc(it.nama)}</h1>
    ${it.deskripsi?`<p style="color:var(--ink2);margin:8px 0 0">${esc(it.deskripsi)}</p>`:''}
    <dl class="kv"><dt>Kategori</dt><dd>${esc(it.kategori||'–')}</dd><dt>Lokasi simpan</dt><dd>${esc(it.lokasi||'–')}</dd><dt>Tampilan 3D</dt><dd>${esc(visName(vis))}</dd>
      <dt>${cur?'Dipinjam oleh':'Pemakai terakhir'}</dt><dd>${esc(cur?cur.anggota_nama:(it.pemakai_nama||'–'))}${cur?` <span class="muted">· ${dur(cur.pinjam)}</span>`:''}</dd></dl>
    ${aiPanel(it)}
    <div class="row" style="margin-top:16px">
      <button class="btn ghost sm" data-act="alatEdit" data-id="${it.id}">${icon('edit',16)} Ubah</button>
      <label class="btn ghost sm" style="cursor:pointer">${icon('camera',16)} ${it.foto_url?'Ganti foto':'Unggah foto'}<input type="file" id="dFoto" accept="image/*" hidden></label>
      ${it.status==='rusak'?`<button class="btn ok sm" data-act="alatFix" data-id="${it.id}">${icon('check',16)} Sudah diperbaiki</button>`:''}
      ${cur?`<button class="btn sm" data-act="kembali" data-id="${cur.id}">Terima kembali</button>`:''}
      <button class="btn link sm" data-act="alatDel" data-id="${it.id}" style="color:var(--bad)">${icon('trash',16)} Hapus</button></div>
    <h3 style="margin:26px 0 10px">Riwayat</h3>
    <div class="list">${hist.length?hist.map(l=>`<div class="li"><div class="main"><b>${esc(l.anggota_nama)}</b><span>${fmt(l.pinjam)}${l.kembali?' → '+fmt(l.kembali):''}${l.kondisi&&l.kondisi!=='Baik'?' · '+esc(l.kondisi):''}</span></div>${pill(l.status,l.status==='dipinjam'?'Dipinjam':'Kembali')}</div>`).join(''):'<div class="empty">Belum pernah dipinjam</div>'}</div>
  </div></div>`;
  mountStage(it);
  $('dFoto').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return;
    const r=await run(async()=>API.updateItem(it.id,Object.assign(await uploadPhoto(f,it.id),{model3d_url:null,ai3d_status:''})),'Foto disimpan — visual 3D diperbarui'); if(!r.ok) return;
    await reload(true); if(aiOn()) aiStart(it.id,true); };
}
function alatEditDlg(id){ const it=itemById(id); if(!it) return;
  dialog(`<div class="dlg-head"><h3>Ubah alat</h3><button class="btn link sm icon" data-act="closeDlg">${icon('x')}</button></div>
    <label class="f">Nama</label><input id="eNama" value="${esc(it.nama)}">
    <div class="grid2"><div><label class="f">Kategori</label><input id="eKat" value="${esc(it.kategori)}" list="katList"></div><div><label class="f">Lokasi simpan</label><input id="eLok" value="${esc(it.lokasi)}"></div></div>
    <label class="f">Keterangan</label><textarea id="eDes">${esc(it.deskripsi||'')}</textarea>
    <label class="f">Tampilan 3D</label><select id="eModel">${modelOptions(it.model||'',it)}</select>
    ${katDatalist()}
    <div class="dlg-actions"><button class="btn ghost" data-act="closeDlg">Batal</button><button class="btn" id="eOk">Simpan</button></div>`,'mid');
  $('eOk').onclick=async()=>{ const patch={nama:$('eNama').value.trim()||it.nama,kategori:$('eKat').value.trim(),lokasi:$('eLok').value.trim(),deskripsi:$('eDes').value.trim(),model:$('eModel').value};
    closeDialog(); if((await run(()=>API.updateItem(it.id,patch),'Data alat disimpan')).ok) reload(true); }; }
function katDatalist(){ return `<datalist id="katList">${[...new Set(db.items.map(i=>i.kategori).filter(Boolean))].map(k=>`<option value="${esc(k)}">`).join('')}</datalist>`; }
function modelOptions(sel,it){ const o=(v,t)=>`<option value="${v}" ${sel===v?'selected':''}>${t}</option>`;
  return o('','Otomatis (disarankan)')+(it&&it.model3d_url?o('ai','Model 3D AI'):'')+o('relief','3D dari foto')+o('foto','Foto berdiri (datar)')
    +'<optgroup label="Model bawaan">'+Object.values(MODELS).map(m=>`<option value="${m.key}" ${sel===m.key?'selected':''}>${esc(m.name)}</option>`).join('')+'</optgroup>'; }

/* ---------- halaman tambah alat (terpisah) ---------- */
let draft=null;
function pgAlatBaru(v){
  draft={nama:'',model:'',file:null,preview:null,cutOk:true};
  v.innerHTML=`<a class="back" href="#alat">${icon('back',16)} Alat</a>
  <div class="page-head"><div><h1><span class="e">➕</span>Tambah alat</h1><p>Unggah foto alat agar bentuk 3D-nya mengikuti alat asli. Tanpa foto, model 3D dipilih otomatis dari nama.</p></div></div>
  <div class="detail"><div class="card">
    <label class="f">Nama alat *</label><input id="nNama" placeholder="contoh: Multimeter Digital" autofocus>
    <div class="grid2"><div><label class="f">Kategori</label><input id="nKat" list="katList" placeholder="contoh: Kelistrikan"></div><div><label class="f">Lokasi simpan</label><input id="nLok" placeholder="contoh: Lemari A-1"></div></div>
    <label class="f">Jumlah unit</label><input id="nQty" type="number" min="1" max="50" value="1" style="max-width:140px"><div class="hint">Setiap unit mendapat kode sendiri (ALT-xxxx) agar bisa dilacak.</div>
    <label class="f">Keterangan <span class="muted">(terlihat oleh siswa)</span></label><textarea id="nDes" placeholder="contoh: ketelitian 0,05 mm"></textarea>
    <label class="f">Foto alat</label><label class="drop" id="nDrop">${icon('camera',22)}<span id="nDropTxt">Pilih atau ambil foto · latar polos lebih bagus</span><input type="file" id="nFoto" accept="image/*" hidden></label>
    <label class="f">Tampilan 3D</label><select id="nModel">${modelOptions('',null)}</select>
    ${katDatalist()}
    <div class="row" style="margin-top:22px;justify-content:flex-end"><a class="btn ghost" href="#alat">Batal</a><button class="btn lg" data-act="alatSimpan">Simpan alat</button></div>
  </div>
  <div>${stageHTML()}<p class="hint" id="nVis" style="text-align:center"></p></div></div>`;
  const upd=()=>{ draft.nama=$('nNama').value.trim(); draft.model=$('nModel').value; previewDraft(); };
  let t=null; $('nNama').oninput=()=>{ clearTimeout(t); t=setTimeout(upd,300); }; $('nModel').onchange=upd;
  $('nFoto').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; const r=await run(()=>processPhoto(f)); if(!r.ok) return;
    Object.assign(draft,{file:f,preview:r.r.preview,cutOk:r.r.cutOk});
    $('nDropTxt').innerHTML=`<b>${esc(f.name)}</b><br><span class="small muted">${r.r.cutOk?'Latar dihapus otomatis → jadi objek 3D':'Latar tidak polos → tampil sebagai foto berbingkai'}</span>`;
    const old=$('nDrop').querySelector('img'); if(old) old.remove(); $('nDrop').insertAdjacentHTML('afterbegin',`<img src="${r.r.preview}" alt="">`); upd(); };
  previewDraft();
}
pgAlatBaru.live=false;
function previewDraft(){ if(!draft) return; const it={id:'baru',nama:draft.nama||'alat',model:draft.model,foto3d_url:draft.preview};
  mountStage(it); $('nVis').textContent=draft.nama||draft.preview?'Pratinjau: '+visName(visualOf(it)):'Ketik nama atau unggah foto untuk melihat pratinjau 3D'; }
async function alatSimpan(){
  const nama=$('nNama').value.trim(); if(!nama){ toast('Nama alat wajib diisi','bad'); return $('nNama').focus(); }
  const qty=Math.min(50,Math.max(1,parseInt($('nQty').value)||1)), file=draft.file;
  const rows=[]; for(let k=1;k<=qty;k++) rows.push({nama:qty>1?`${nama} #${k}`:nama,kategori:$('nKat').value.trim(),lokasi:$('nLok').value.trim(),deskripsi:$('nDes').value.trim(),model:$('nModel').value});
  const r=await run(async()=>{ const added=await API.addItems(rows); if(file){ const ph=await uploadPhoto(file,added[0].id); for(const a of added) await API.updateItem(a.id,ph); } return added; },`${qty} alat ditambahkan`);
  if(!r.ok) return; await reload(true); if(file&&aiOn()) for(const a of r.r) await aiStart(a.id,true);
  location.hash=r.r.length===1?'#alat/'+r.r[0].id:'#alat';
}

/* ---------- foto → visual 3D ---------- */
function loadImg(file){ return new Promise((res,rej)=>{ const url=URL.createObjectURL(file), im=new Image(); im.onload=()=>{ res(im); setTimeout(()=>URL.revokeObjectURL(url),1000); }; im.onerror=()=>rej(new Error('File bukan gambar yang valid')); im.src=url; }); }
function canvasFrom(img,max){ const s=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)), c=document.createElement('canvas');
  c.width=Math.max(1,Math.round((img.naturalWidth||img.width)*s)); c.height=Math.max(1,Math.round((img.naturalHeight||img.height)*s)); c.getContext('2d').drawImage(img,0,0,c.width,c.height); return c; }
const toBlob=(c,type,q)=>new Promise(r=>c.toBlob(r,type,q));
/* hapus latar polos (flood-fill dari tepi) agar foto bisa berdiri sebagai objek 3D */
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
  if(!ph.cutOk) toast('Latar foto tidak polos, jadi bentuk 3D kurang rapi. Coba foto di depan dinding/kain polos.','');
  return {foto_url,foto3d_url};
}
/* ---------- 3D AI (Meshy, opsional) ---------- */
const aiOn=()=>API.mode==='supabase'&&!!(API.cfgInfo&&API.cfgInfo.ai3d)&&!!(db.school&&db.school.ai3d);
function aiPanel(it){ if(!aiOn()) return ''; const st=it.ai3d_status||'';
  if(st==='proses') return `<div class="note">Model 3D AI sedang dibuat… ${it.ai3d_progress||0}% · biasanya 1–3 menit</div>`;
  if(st==='gagal') return `<div class="note" style="color:var(--bad)">Gagal membuat model AI: ${esc(it.ai3d_error||'-')} ${it.foto_url?`<button class="btn ghost sm" data-act="aiStart" data-id="${it.id}">Coba lagi</button>`:''}</div>`;
  if(it.model3d_url) return `<div class="note">Model 3D AI tersedia. <button class="btn link sm" data-act="aiStart" data-id="${it.id}">Buat ulang</button></div>`;
  return it.foto_url?`<div class="note"><button class="btn ghost sm" data-act="aiStart" data-id="${it.id}">Buat model 3D realistis (AI)</button> <span class="small muted">memakai kredit Meshy</span></div>`:''; }
async function aiStart(id,silent){ const it=itemById(id); if(!it) return;
  try{ const r=await API.ai3dStart(id,!!it.model3d_url||it.ai3d_status==='gagal'); Object.assign(it,r.item); if(!silent) toast('Pembuatan model 3D AI dimulai','ok'); render(); aiPoll(); }
  catch(e){ if(!silent) toast(esc(e.message),'bad'); } }
let aiTimer=null;
function aiPoll(){ clearTimeout(aiTimer); if(API.mode!=='supabase'||!db.items.some(i=>i.ai3d_status==='proses')) return;
  aiTimer=setTimeout(async()=>{ for(const it of db.items.filter(i=>i.ai3d_status==='proses').slice(0,3)){ try{ await API.ai3dStatus(it.id); }catch(e){} } await reload(true); aiPoll(); },7000); }

/* ======================================================================
   ANGGOTA
   ====================================================================== */
let fAg='';
function pgAnggota(v){
  const q=fAg.toLowerCase(), list=db.anggota.filter(a=>(a.nama+' '+a.id+' '+a.kelas+' '+a.nis+' '+a.peran).toLowerCase().includes(q));
  const aktif=id=>db.loans.filter(l=>l.anggota_id===id&&l.status==='dipinjam').length;
  v.innerHTML=`<div class="page-head"><div><h1><span class="e">👥</span>Anggota</h1><p>Hanya anggota terdaftar yang bisa meminjam. Siswa masuk di halaman siswa dengan <b>kode anggota atau NIS</b> + <b>nama</b>.</p></div>
    <a class="btn" href="#anggota/baru">${icon('plus')} Tambah anggota</a></div>
  <div class="row" style="margin-bottom:16px"><div class="search">${icon('search')}<input id="agQ" placeholder="Cari nama, kode, kelas, NIS" value="${esc(fAg)}"></div><span class="muted small">${db.anggota.length} anggota</span></div>
  ${list.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Nama</th><th class="hide-m">Kelas</th><th class="hide-m">NIS</th><th>Dipinjam</th><th></th></tr></thead><tbody>
    ${list.map(a=>`<tr><td class="mono">${a.id}</td><td><b style="font-weight:600">${esc(a.nama)}</b><div class="small muted">${esc(a.peran)}</div></td><td class="hide-m">${esc(a.kelas||'–')}</td><td class="hide-m">${esc(a.nis||'–')}</td>
      <td>${aktif(a.id)?`<span class="pill p-dipinjam">${aktif(a.id)} alat</span>`:'<span class="muted">–</span>'}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn link sm icon" data-act="agEdit" data-id="${a.id}" title="Ubah">${icon('edit',16)}</button><button class="btn link sm icon" data-act="agDel" data-id="${a.id}" title="Hapus">${icon('trash',16)}</button></td></tr>`).join('')}
    </tbody></table></div>`
  :`<div class="list"><div class="empty">${db.anggota.length?'<b>Tidak ditemukan</b>':`<b>Belum ada anggota</b>Daftarkan siswa agar mereka bisa meminjam.<div style="margin-top:14px"><a class="btn" href="#anggota/baru">${icon('plus')} Tambah anggota</a></div>`}</div></div>`}`;
  const q1=$('agQ'); q1.oninput=()=>{ fAg=q1.value; const p=q1.selectionStart; pgAnggota(v); const n=$('agQ'); n.focus(); n.setSelectionRange(p,p); };
}
let agMode='satu', agHasil=null;
function pgAnggotaBaru(v){
  v.innerHTML=`<a class="back" href="#anggota">${icon('back',16)} Anggota</a>
  <div class="page-head"><div><h1><span class="e">➕</span>Tambah anggota</h1><p>Setiap anggota otomatis mendapat kode (AGT-xxxx) yang bisa dipakai siswa untuk masuk.</p></div></div>
  <div class="card" style="max-width:640px">
    <div class="seg" id="agSeg"><button data-m="satu" class="${agMode==='satu'?'on':''}">Satu per satu</button><button data-m="banyak" class="${agMode==='banyak'?'on':''}">Banyak sekaligus</button></div>
    ${agMode==='satu'?`<label class="f" style="margin-top:18px">Nama lengkap *</label><input id="agNama" placeholder="contoh: Andi Saputra" autofocus>
      <div class="grid2"><div><label class="f">Kelas</label><input id="agKelas" placeholder="contoh: XI TKR 1"></div><div><label class="f">NIS / NIP</label><input id="agNis" placeholder="opsional"></div></div>
      <label class="f">Peran</label><select id="agPeran"><option>Siswa</option><option>Guru</option><option>Laboran</option><option>Staf</option></select>`
    :`<label class="f" style="margin-top:18px">Tempel daftar — satu orang per baris</label><textarea id="agBulk" style="min-height:200px" placeholder="Nama; Kelas; NIS&#10;Andi Saputra; XI TKR 1; 12345&#10;Siti Rahma; XI TKR 1; 12346"></textarea>
      <div class="hint">Pisahkan dengan titik koma, koma, atau Tab (bisa langsung salin dari Excel). Kelas dan NIS boleh kosong.</div>`}
    <div class="row" style="margin-top:22px;justify-content:flex-end"><a class="btn ghost" href="#anggota">Selesai</a><button class="btn" data-act="agSimpan">${icon('plus',16)} Daftarkan</button></div>
  </div>
  ${agHasil?`<div class="card" style="max-width:640px"><h3>Baru didaftarkan</h3><p class="small muted" style="margin:4px 0 12px">Beri tahu siswa kode anggotanya.</p>
    ${agHasil.map(a=>`<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><span class="mono" style="min-width:80px">${a.id}</span><span class="grow">${esc(a.nama)}</span><span class="muted small">${esc(a.kelas)}</span></div>`).join('')}</div>`:''}`;
  $('agSeg').onclick=e=>{ const b=e.target.closest('[data-m]'); if(b){ agMode=b.dataset.m; pgAnggotaBaru(v); } };
}
pgAnggotaBaru.live=false;
async function agSimpan(){
  let rows=[];
  if(agMode==='satu'){ const nama=$('agNama').value.trim(); if(!nama){ toast('Nama wajib diisi','bad'); return $('agNama').focus(); }
    rows=[{nama,kelas:$('agKelas').value.trim(),nis:$('agNis').value.trim(),peran:$('agPeran').value}]; }
  else rows=$('agBulk').value.split(/\r?\n/).map(l=>l.split(/[;\t]|,(?=\s*[^,]*$)|,/).map(s=>s.trim())).filter(p=>p[0]).map(p=>({nama:p[0],kelas:p[1]||'',nis:p[2]||'',peran:'Siswa'}));
  if(!rows.length) return toast('Belum ada data','bad');
  const r=await run(()=>API.addAnggota(rows),`${rows.length} anggota didaftarkan`); if(!r.ok) return;
  agHasil=r.r.concat(agHasil||[]).slice(0,50); await reload(true); pgAnggotaBaru($('view'));
}
function agEditDlg(id){ const a=anggotaById(id); if(!a) return;
  dialog(`<div class="dlg-head"><h3>Ubah anggota <span class="mono muted">${a.id}</span></h3><button class="btn link sm icon" data-act="closeDlg">${icon('x')}</button></div>
    <label class="f">Nama</label><input id="eaNama" value="${esc(a.nama)}">
    <div class="grid2"><div><label class="f">Kelas</label><input id="eaKelas" value="${esc(a.kelas)}"></div><div><label class="f">NIS / NIP</label><input id="eaNis" value="${esc(a.nis)}"></div></div>
    <label class="f">Peran</label><select id="eaPeran">${['Siswa','Guru','Laboran','Staf'].map(p=>`<option ${p===a.peran?'selected':''}>${p}</option>`).join('')}</select>
    <div class="dlg-actions"><button class="btn ghost" data-act="closeDlg">Batal</button><button class="btn" id="eaOk">Simpan</button></div>`);
  $('eaOk').onclick=async()=>{ const p={nama:$('eaNama').value.trim()||a.nama,kelas:$('eaKelas').value.trim(),nis:$('eaNis').value.trim(),peran:$('eaPeran').value};
    closeDialog(); if((await run(()=>API.updateAnggota(id,p),'Anggota disimpan')).ok) reload(true); }; }

/* ======================================================================
   RIWAYAT
   ====================================================================== */
let fH={q:'',st:''};
function filteredLoans(){ const q=fH.q.toLowerCase(); return db.loans.filter(l=>(!fH.st||l.status===fH.st)&&(l.anggota_nama+' '+l.item_nama+' '+l.anggota_id+' '+l.item_id).toLowerCase().includes(q)).slice().reverse(); }
function pgRiwayat(v){
  const list=filteredLoans();
  v.innerHTML=`<div class="page-head"><div><h1><span class="e">📜</span>Riwayat</h1><p>Semua pengajuan dan peminjaman.</p></div><button class="btn ghost" data-act="csv">${icon('download',16)} Unduh CSV</button></div>
  <div class="row" style="margin-bottom:16px"><div class="search">${icon('search')}<input id="hQ" placeholder="Cari nama atau alat" value="${esc(fH.q)}"></div>
    <select id="hSt" style="width:auto"><option value="">Semua status</option>${Object.entries(LOAN_STATUS).map(([k,t])=>`<option value="${k}" ${fH.st===k?'selected':''}>${t}</option>`).join('')}</select></div>
  ${list.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Diajukan</th><th>Anggota</th><th>Alat</th><th>Status</th><th class="hide-m">Dipinjam</th><th class="hide-m">Kembali</th><th class="hide-m">Catatan</th></tr></thead><tbody>
    ${list.slice(0,400).map(l=>`<tr><td style="white-space:nowrap">${fmt(l.diajukan)}</td><td>${esc(l.anggota_nama)}</td><td>${esc(l.item_nama)} <span class="mono muted">${l.item_id}</span></td><td>${pill(l.status,({menunggu:'Menunggu',dipinjam:'Dipinjam',kembali:'Kembali',ditolak:'Ditolak',batal:'Batal'})[l.status])}</td>
      <td class="hide-m" style="white-space:nowrap">${fmt(l.pinjam)}</td><td class="hide-m" style="white-space:nowrap">${fmt(l.kembali)}</td><td class="hide-m small">${esc([l.kondisi&&l.kondisi!=='Baik'?l.kondisi:'',l.alasan,l.catatan].filter(Boolean).join(' · '))}</td></tr>`).join('')}
  </tbody></table></div>`:`<div class="list"><div class="empty"><b>Belum ada riwayat</b></div></div>`}`;
  const q1=$('hQ'); q1.oninput=()=>{ fH.q=q1.value; const p=q1.selectionStart; pgRiwayat(v); const n=$('hQ'); n.focus(); n.setSelectionRange(p,p); };
  $('hSt').onchange=e=>{ fH.st=e.target.value; pgRiwayat(v); };
}
function exportCSV(){ const rows=[['Diajukan','Kode anggota','Anggota','Kode alat','Alat','Status','Dipinjam','Dikembalikan','Kondisi','Catatan','Alasan ditolak','Sumber']]
  .concat(filteredLoans().reverse().map(l=>[fmt(l.diajukan),l.anggota_id,l.anggota_nama,l.item_id,l.item_nama,LOAN_STATUS[l.status]||l.status,l.pinjam?fmt(l.pinjam):'',l.kembali?fmt(l.kembali):'',l.kondisi||'',l.catatan||'',l.alasan||'',l.sumber==='siswa'?'Pengajuan siswa':'Kepala lab']));
  const csv='﻿'+rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
  download(new Blob([csv],{type:'text/csv'}),`riwayat-${kodeNow()||'sipinlab'}-${new Date().toISOString().slice(0,10)}.csv`); }

/* ======================================================================
   PENGATURAN
   ====================================================================== */
function pgPengaturan(v){
  const s=db.school||{}, k=s.kode||'';
  const adminUrl=linkAdmin(k);
  v.innerHTML=`<div class="page-head"><div><h1><span class="e">⚙️</span>Pengaturan</h1></div></div>
  <div style="max-width:680px">
  ${linkBox()}
  <div class="linkbox" style="margin-top:10px;background:var(--card);border-color:var(--line)">${icon('out')}<div class="grow" style="min-width:0"><div class="small muted">Link masuk kepala lab</div><code style="color:var(--ink2)">${esc(adminUrl)}</code></div><button class="btn ghost sm" data-act="copy" data-v="${esc(adminUrl)}">${icon('copy',16)} Salin</button></div>
  <div class="card" style="margin-top:22px"><h2>Identitas sekolah</h2><p class="small muted" style="margin:4px 0 0">Tampil di halaman siswa dan halaman ini.</p>
    <label class="f" style="margin-top:16px">Nama sekolah / lab</label><input id="sNama" value="${esc(s.nama||'')}">
    <div class="grid2"><div><label class="f">Logo <span class="muted">(emoji atau link gambar)</span></label><input id="sLogo" value="${esc(s.logo||'')}"></div>
      <div><label class="f">Warna</label><div class="swatches" id="sWarna">${PALETTES.map(c=>`<button style="background:${c}" data-c="${c}" class="${c===s.warna?'on':''}" title="${c}"></button>`).join('')}</div></div></div>
    <div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" data-act="saveSchool">Simpan</button></div></div>
  <div class="card"><h2>Ganti password</h2><p class="small muted" style="margin:4px 0 0">Akun: <b>${esc(me.username)}</b></p>
    <div class="grid2"><div><label class="f">Password baru</label><input id="pw1" type="password" minlength="6" autocomplete="new-password"></div><div><label class="f">Ulangi</label><input id="pw2" type="password" autocomplete="new-password"></div></div>
    <div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn ghost" data-act="savePw">Ganti password</button></div></div>
  ${koneksiCard()}
  ${API.mode==='demo'?`<div class="card"><h2>Data demo</h2><p class="small muted" style="margin:4px 0 14px">Data demo tersimpan di browser ini saja.</p><button class="btn ghost" data-act="resetDemo" style="color:var(--bad)">Kembalikan data demo awal</button></div>`:''}
  </div>`;
  let w=s.warna; $('sWarna').onclick=e=>{ const b=e.target.closest('[data-c]'); if(!b) return; w=b.dataset.c; $('sWarna').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); applyTheme(Object.assign({},s,{warna:w})); };
  $('sWarna').dataset.get='1'; v._warna=()=>w;
}
pgPengaturan.live=false;

/* ======================================================================
   KONEKSI SUPABASE (diatur dari aplikasi)
   ====================================================================== */
const SRC_NAME={file:'file js/config.js',browser:'disimpan di browser ini',vercel:'Environment Variables Vercel'};
function koneksiCard(){ const on=API.mode==='supabase';
  return `<div class="card"><h2>🔌 Koneksi database</h2>
    <p class="small muted" style="margin:4px 0 12px">${on?`Terhubung ke Supabase <b>${esc(API.cfgInfo.url)}</b> · pengaturan dari ${esc(SRC_NAME[API.cfgSource]||'-')}.`:'Belum terhubung — aplikasi berjalan dalam <b>Mode demo</b>.'}</p>
    ${on&&API.cfgSource==='browser'?`<div class="note" style="margin-bottom:12px">⚠️ Pengaturan ini baru tersimpan di browser ini. Agar siswa (HP lain) juga terhubung, unduh <b>config.js</b> lalu ganti file <b>js/config.js</b> di aplikasi Anda.</div>`:''}
    <div class="row"><button class="btn ghost" data-act="hubungkan">${on?'Ubah koneksi':'🔌 Hubungkan ke Supabase'}</button>${on?`<button class="btn ghost" data-act="unduhConfig">${icon('download',16)} Unduh config.js</button>`:''}${API.cfgSource==='browser'?`<button class="btn link" data-act="putuskan" style="color:var(--bad)">Putuskan</button>`:''}</div></div>`; }
function configJS(c){ return `/* PENGATURAN SUPABASE – dibuat oleh SiPinLab. Simpan sebagai js/config.js */\nwindow.SIPINLAB_CONFIG = {\n  url: '${c.url}',\n  anonKey: '${c.anonKey}'\n};\n`; }
function unduhConfig(c){ download(new Blob([configJS(c)],{type:'text/javascript'}),'config.js'); }
function hubungkanDlg(){ const c=(API.mode==='supabase'&&API.cfgInfo)||{};
  dialog(`<div class="dlg-head"><h3>🔌 Hubungkan ke Supabase</h3><button class="btn link sm icon" data-act="closeDlg">${icon('x')}</button></div>
    <ol class="small" style="margin:0 0 6px;padding-left:18px;color:var(--ink2);line-height:1.7">
      <li>Buat project di <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com</a>.</li>
      <li>Buka <b>SQL Editor</b> → jalankan <b>supabase/schema.sql</b> (lalu <b>data-contoh.sql</b> jika ingin data contoh).</li>
      <li>Buka <b>Project Settings → API Keys</b>, salin <b>Project URL</b> dan <b>anon key</b> ke sini.</li></ol>
    <label class="f">Project URL</label><input id="cUrl" value="${esc(c.url||'')}" placeholder="https://abcdxyz.supabase.co" autocapitalize="none" spellcheck="false">
    <label class="f">Anon key / publishable key</label><textarea id="cKey" style="min-height:70px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px" placeholder="eyJhbGciOi... atau sb_publishable_..." spellcheck="false">${esc(c.anonKey||'')}</textarea>
    <p class="hint">Jangan memasukkan <b>service_role</b> / <b>secret</b> key — kunci itu rahasia dan tidak diperlukan.</p>
    <div id="cErr"></div>
    <div class="dlg-actions"><button class="btn ghost" data-act="closeDlg">Batal</button><button class="btn" id="cOk">Tes &amp; hubungkan</button></div>`,'mid');
  $('cOk').onclick=async()=>{ $('cErr').innerHTML=''; busy(true);
    try{ const cfg=await testSupabase($('cUrl').value,$('cKey').value); localStorage.setItem(CFG_KEY,JSON.stringify(cfg));
      dialog(`<h3>✅ Berhasil terhubung</h3><p class="dlg-text">Browser ini sekarang memakai Supabase Anda.</p>
        <div class="note"><b>Langkah terakhir agar siswa juga terhubung:</b><br>Unduh <b>config.js</b> di bawah, lalu ganti file <b>js/config.js</b> di folder aplikasi (atau di GitHub/hosting Anda) dengan file ini.</div>
        <div class="dlg-actions"><button class="btn ghost" id="cDl">${icon('download',16)} Unduh config.js</button><button class="btn" id="cGo">Lanjut</button></div>`,'mid');
      $('cDl').onclick=()=>unduhConfig(cfg); $('cGo').onclick=()=>{ location.hash=''; location.reload(); }; }
    catch(e){ $('cErr').innerHTML=`<div class="err">${esc(e.message)}</div>`; } finally{ busy(false); } }; }

/* ======================================================================
   SEKOLAH (Super Admin)
   ====================================================================== */
function pgSekolah(v){
  v.innerHTML=`<div class="page-head"><div><h1><span class="e">🏫</span>Sekolah</h1><p>Setiap sekolah punya link siswa dan akun kepala lab sendiri. Data antar sekolah terpisah.</p></div>
    <button class="btn" data-act="schNew">${icon('plus')} Tambah sekolah</button></div>
  <div class="list">${schools.length?schools.map(s=>`<div class="li"><div class="pic sm" style="font-size:24px;border-radius:12px">${logoHTML(s.logo)}</div>
    <div class="main"><b>${esc(s.nama)}</b><span><span class="mono">/${esc(s.kode)}</span> · ${s.n_anggota} anggota · ${s.n_alat} alat${s.ai3d?' · AI 3D':''}</span></div>
    ${s.aktif?'':pill('rusak','Nonaktif')}
    <button class="btn sm" data-act="schKelola" data-id="${s.id}">Kelola</button><button class="btn ghost sm" data-act="schEdit" data-id="${s.id}">Ubah</button></div>`).join('')
    :`<div class="empty"><b>Belum ada sekolah</b>Tambahkan sekolah, lalu berikan akun kepala lab-nya.</div>`}</div>`;
}
function schNewDlg(){
  dialog(`<div class="dlg-head"><h3>Tambah sekolah</h3><button class="btn link sm icon" data-act="closeDlg">${icon('x')}</button></div>
    <label class="f">Nama sekolah</label><input id="nsNama" placeholder="contoh: SMK Negeri 1 Makassar">
    <div class="grid2"><div><label class="f">Kode (untuk link)</label><input id="nsKode" placeholder="smkn1-makassar" autocapitalize="none"></div><div><label class="f">Logo</label><input id="nsLogo" value="🔬"></div></div>
    <div class="hint" id="nsHint"></div>
    <h3 style="margin:22px 0 4px">Akun kepala lab</h3>
    <div class="grid2"><div><label class="f">Username</label><input id="nsUser" value="admin" autocapitalize="none"></div><div><label class="f">Password awal</label><input id="nsPass" placeholder="min. 6 karakter"></div></div>
    <div class="dlg-actions"><button class="btn ghost" data-act="closeDlg">Batal</button><button class="btn" id="nsOk">Simpan</button></div>`,'mid');
  const sl=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,30);
  let touched=false; const hint=()=>{ const k=$('nsKode').value; $('nsHint').textContent=k?'Link siswa: '+linkSiswa(k)+'   ·   Link kepala lab: '+linkAdmin(k):''; };
  $('nsNama').oninput=()=>{ if(!touched){ $('nsKode').value=sl($('nsNama').value.replace(/^sekolah\s+/i,'').replace(/negeri/i,'n')); hint(); } };
  $('nsKode').oninput=()=>{ touched=true; hint(); };
  $('nsOk').onclick=async()=>{ const row={nama:$('nsNama').value.trim(),kode:$('nsKode').value.trim(),logo:$('nsLogo').value.trim()||'🔬',warna:PALETTES[schools.length%PALETTES.length]};
    if(!row.nama) return toast('Nama wajib diisi','bad'); const un=$('nsUser').value.trim().toLowerCase(), pw=$('nsPass').value;
    const r=await run(async()=>{ const s=await API.createSchool(row); try{ await API.createUser({role:'admin',school_id:s.id,username:un,password:pw,nama:'Kepala Lab'}); }catch(e){ await API.deleteSchool(s.id,s.kode).catch(()=>{}); throw e; } return s; },'Sekolah & akun kepala lab dibuat');
    if(!r.ok) return; closeDialog(); await loadSchools(); render();
    dialog(`<h3>Kirim ke kepala lab</h3><p class="dlg-text">Bagikan informasi ini ke kepala lab ${esc(r.r.nama)}.</p>
      <div class="note" style="white-space:pre-line">Link masuk kepala lab: ${esc(linkAdmin(r.r.kode))}\nUsername: ${esc(un)}\nLink untuk siswa: ${esc(linkSiswa(r.r.kode))}</div>
      <div class="dlg-actions"><button class="btn" data-act="closeDlg">Selesai</button></div>`); };
}
async function schEditDlg(id){ const s=schools.find(x=>x.id===id); if(!s) return;
  const ur=await run(()=>API.listUsers(id)); const admins=ur.ok?ur.r:[];
  dialog(`<div class="dlg-head"><h3>${esc(s.nama)}</h3><button class="btn link sm icon" data-act="closeDlg">${icon('x')}</button></div>
    <label class="f">Nama</label><input id="esNama" value="${esc(s.nama)}">
    <div class="grid2"><div><label class="f">Logo</label><input id="esLogo" value="${esc(s.logo)}"></div><div><label class="f">Kode</label><input value="${esc(s.kode)}" disabled></div></div>
    <label class="row" style="margin-top:14px;font-size:14px"><input type="checkbox" id="esAktif" ${s.aktif?'checked':''} style="width:18px"> Sekolah aktif</label>
    ${API.cfgInfo&&API.cfgInfo.ai3d?`<label class="row" style="margin-top:8px;font-size:14px"><input type="checkbox" id="esAi" ${s.ai3d?'checked':''} style="width:18px"> Izinkan model 3D AI (memakai kredit Meshy)</label>`:''}
    <h3 style="margin:22px 0 8px">Akun kepala lab</h3>
    <div class="list">${admins.map(u=>`<div class="li"><div class="main"><b>${esc(u.username)}</b><span>${esc(u.nama)}${u.aktif?'':' · nonaktif'}</span></div><button class="btn ghost sm" data-act="schPw" data-id="${u.id}">Reset password</button></div>`).join('')||'<div class="empty">Belum ada akun</div>'}</div>
    <div class="row" style="margin-top:10px"><input id="esUser" placeholder="username baru" style="flex:1" autocapitalize="none"><input id="esPass" placeholder="password" style="flex:1"><button class="btn ghost" id="esAdd">Tambah</button></div>
    <div class="dlg-actions" style="justify-content:space-between"><button class="btn link" id="esDel" style="color:var(--bad)">${icon('trash',16)} Hapus sekolah</button><span class="row"><button class="btn ghost" data-act="closeDlg">Batal</button><button class="btn" id="esOk">Simpan</button></span></div>`,'mid');
  $('esOk').onclick=async()=>{ const p={nama:$('esNama').value.trim()||s.nama,logo:$('esLogo').value.trim()||'🔬',aktif:$('esAktif').checked}; if($('esAi')) p.ai3d=$('esAi').checked;
    if((await run(()=>API.updateSchool(id,p),'Disimpan')).ok){ closeDialog(); await loadSchools(); if(API.sid===id) await reload(true); render(); } };
  $('esAdd').onclick=async()=>{ if((await run(()=>API.createUser({role:'admin',school_id:id,username:$('esUser').value,password:$('esPass').value,nama:'Kepala Lab'}),'Akun ditambahkan')).ok) schEditDlg(id); };
  $('esDel').onclick=async()=>{ const k=prompt(`Hapus PERMANEN ${s.nama} beserta semua alat, anggota, riwayat, dan akunnya?\nKetik kode sekolah (${s.kode}) untuk konfirmasi:`); if(k===null) return;
    if((await run(()=>API.deleteSchool(id,k.trim()),'Sekolah dihapus')).ok){ closeDialog(); if(API.sid===id){ API.sid=null; store.set('sid',''); } await loadSchools(); location.hash='#sekolah'; render(); } };
}

/* ======================================================================
   AKSI (klik)
   ====================================================================== */
const ACTIONS={
  logout:async()=>{ await API.logout(); location.hash=''; location.reload(); },
  toggleSuper:()=>{ loginSuper=!loginSuper; showLogin(); },
  hubungkan:hubungkanDlg,
  unduhConfig:()=>unduhConfig(API.cfgInfo),
  putuskan:async()=>{ if(!await confirmBox('Putuskan koneksi Supabase di browser ini dan kembali ke Mode demo?','Putuskan',true)) return; localStorage.removeItem(CFG_KEY); try{ await API.logout(); }catch(e){} location.hash=''; location.reload(); },
  closeDlg:closeDialog,
  copy:b=>copyText(b.dataset.v),
  setujui:b=>setujui([+b.dataset.id]),
  setujuiSemua:b=>setujui(b.dataset.ids.split(',').map(Number).filter(id=>{ const l=db.loans.find(x=>x.id===id), it=l&&itemById(l.item_id); return it&&it.status==='tersedia'; })),
  tolak:b=>tolakDlg(+b.dataset.id),
  kembali:b=>kembaliDlg(+b.dataset.id),
  pbPilih:b=>{ pb.anggota=b.dataset.id; pgPinjamBaru($('view')); },
  pbGanti:()=>{ pb.anggota=null; pb.qa=''; pgPinjamBaru($('view')); },
  pbItem:b=>{ const id=b.dataset.id; pb.items.has(id)?pb.items.delete(id):pb.items.add(id); const c=$('pbCat').value; pgPinjamBaru($('view')); $('pbCat').value=c; },
  pbSimpan:async()=>{ const r=await run(()=>API.pinjamkan(pb.anggota,[...pb.items],$('pbCat').value.trim()),'Peminjaman dicatat — serahkan alatnya'); if(!r.ok) return;
    pb={anggota:null,items:new Set(),qa:'',qi:''}; await reload(true); location.hash='#peminjaman'; },
  v3spin:b=>{ if(_viewer) b.classList.toggle('on',!_viewer.spin()); },
  v3reset:()=>{ if(_viewer) _viewer.reset(); },
  alatSimpan,
  alatEdit:b=>alatEditDlg(b.dataset.id),
  alatFix:async b=>{ if((await run(()=>API.updateItem(b.dataset.id,{status:'tersedia'}),'Alat kembali tersedia')).ok) reload(true); },
  alatDel:async b=>{ const id=b.dataset.id; if(db.loans.some(l=>l.item_id===id&&l.status==='dipinjam')) return toast('Alat sedang dipinjam, tidak bisa dihapus','bad');
    if(!await confirmBox('Hapus alat ini? Riwayatnya tetap tersimpan.','Hapus',true)) return; if((await run(()=>API.deleteItem(id),'Alat dihapus')).ok){ await reload(true); location.hash='#alat'; } },
  aiStart:b=>aiStart(b.dataset.id),
  agSimpan,
  agEdit:b=>agEditDlg(b.dataset.id),
  agDel:async b=>{ const id=b.dataset.id; if(db.loans.some(l=>l.anggota_id===id&&l.status==='dipinjam')) return toast('Anggota masih meminjam alat','bad');
    if(!await confirmBox(`Hapus anggota <b>${esc((anggotaById(id)||{}).nama)}</b>? Ia tidak bisa meminjam lagi.`,'Hapus',true)) return; if((await run(()=>API.deleteAnggota(id),'Anggota dihapus')).ok) reload(true); },
  csv:exportCSV,
  saveSchool:async()=>{ const v=$('view'), p={nama:$('sNama').value.trim()||db.school.nama,logo:$('sLogo').value.trim()||'🔬',warna:v._warna?v._warna():db.school.warna};
    if((await run(()=>API.updateSchool(API.sid,p),'Identitas disimpan')).ok){ await reload(true); if(isSuper()) loadSchools(); renderShell(); } },
  savePw:async()=>{ const a=$('pw1').value, b=$('pw2').value; if(a.length<6) return toast('Password minimal 6 karakter','bad'); if(a!==b) return toast('Password tidak sama','bad');
    if((await run(()=>API.updateUser({id:me.id,password:a}),'Password diganti')).ok){ $('pw1').value=''; $('pw2').value=''; } },
  resetDemo:async()=>{ if(!await confirmBox('Kembalikan semua data demo ke awal?','Reset',true)) return; await API.resetAll(); location.hash=''; location.reload(); },
  schNew:schNewDlg,
  schEdit:b=>schEditDlg(b.dataset.id),
  schKelola:b=>switchSchool(b.dataset.id),
  schPw:async b=>{ const p=prompt('Password baru (min. 6 karakter):'); if(!p) return; await run(()=>API.updateUser({id:b.dataset.id,password:p}),'Password direset'); },
};
document.addEventListener('click',e=>{ const b=e.target.closest('[data-act]'); if(!b||b.disabled) return; const f=ACTIONS[b.dataset.act]; if(!f) return; e.preventDefault(); f(b,e); });
boot();
