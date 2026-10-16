"use strict";
/* ======================================================================
   SiPinLab v6 – Halaman Siswa (tanpa login akun)
   Siswa terdaftar masuk dengan kode anggota / NIS + nama, memilih alat
   (lengkap dengan tampilan 3D), lalu mengajukan peminjaman.
   Pengajuan masuk ke kepala lab untuk disetujui.
   ====================================================================== */
let API=null, school=null, kode='', who=null, P=null, tab='alat', cart=new Map(), fq='', fkat='', pollT=null;
const KEY=()=>'siswa_'+kode;

async function boot(){
  busy(true);
  try{ API=await createAPI(); }catch(e){ busy(false); return msgPage('Tidak bisa terhubung',e.message); }
  kode=urlKode()||(API.mode==='demo'?'demo':'');
  if(!kode){ busy(false); return msgPage('Link belum lengkap','Buka link peminjaman yang dibagikan kepala lab sekolahmu.'); }
  school=await API.schoolInfo(kode); busy(false);
  if(!school) return msgPage('Sekolah tidak ditemukan','Periksa kembali link dari kepala lab.');
  applyTheme(school,'Pinjam Alat Lab');
  if(!school.aktif) return msgPage('Layanan sedang nonaktif','Peminjaman di sekolah ini sedang dinonaktifkan.');
  try{ who=JSON.parse(store.get(KEY(),'null')); }catch(e){ who=null; }
  if(who&&await masuk(who.ident,who.nama,true)) return;
  showLogin();
}
function msgPage(t,m){ $('root').innerHTML=`<div class="center blue"><div class="auth" style="text-align:center"><div class="logo" style="margin:0 auto 18px">${school?logoHTML(school.logo):icon('cube',28)}</div><h1>${esc(t)}</h1><p class="lead">${esc(m)}</p></div></div>`; }

function showLogin(err,ident='',nama=''){
  cartbar();
  $('root').innerHTML=`<div class="center blue"><div class="auth" style="max-width:440px">
    <div class="logo">${logoHTML(school.logo)}</div>
    <h1>🔬 Pinjam alat lab</h1><p class="lead">${esc(school.nama)}</p>
    <form class="card" id="inForm">
      <label class="f">Kode anggota atau NIS</label><input id="inId" value="${esc(ident)}" placeholder="contoh: AGT-0001, 1, atau NIS" autocapitalize="characters" autocomplete="off" spellcheck="false">
      <label class="f">Nama kamu</label><input id="inNama" value="${esc(nama)}" placeholder="cukup nama depan" autocomplete="given-name">
      <button class="btn lg full" style="margin-top:18px">Masuk</button>
      ${err?`<div class="err">${esc(err)}</div>`:''}
    </form>
    <div class="steps"><div><b>1 · Pilih</b>Pilih alat yang mau dipinjam, lihat bentuk 3D-nya.</div><div><b>2 · Ajukan</b>Pengajuan dikirim ke kepala lab.</div><div><b>3 · Ambil</b>Setelah disetujui, ambil alat ke kepala lab.</div></div>
    <div class="foot">Belum terdaftar? Minta kepala lab mendaftarkanmu sebagai anggota.</div>
    ${API.mode==='demo'?`<div class="demo"><b>Mode demo</b> — coba kode <b>1</b> dengan nama <b>andi</b>, atau kode <b>3</b> nama <b>citra</b>. Halaman kepala lab: <a href="index.html?s=demo">index.html</a> (admin / admin123).</div>`:''}
  </div></div>`;
  setTimeout(()=>(ident?$('inNama'):$('inId')).focus(),30);
  $('inForm').onsubmit=async e=>{ e.preventDefault(); const i=$('inId').value.trim(), n=$('inNama').value.trim();
    if(!i||n.length<2) return showLogin('Isi kode anggota/NIS dan nama kamu',i,n); masuk(i,n); };
}
async function masuk(ident,nama,silent){
  busy(true);
  try{ P=await API.portalMasuk(kode,ident,nama); who={ident,nama}; store.set(KEY(),JSON.stringify(who)); render(); startPoll(); return true; }
  catch(e){ if(!silent) showLogin(translateErr(e.message),ident,nama); else store.del(KEY()); return false; }
  finally{ busy(false); }
}
function keluar(){ store.del(KEY()); who=null; P=null; cart.clear(); clearInterval(pollT); tab='alat'; showLogin(); }
function startPoll(){ clearInterval(pollT); pollT=setInterval(refresh,API.mode==='demo'?4000:20000); }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&who) refresh(); });
async function refresh(){ if(!who||document.visibilityState!=='visible') return;
  try{ const n=await API.portalMasuk(kode,who.ident,who.nama); const old=new Map((P.loans||[]).map(l=>[l.id,l.status]));
    for(const l of n.loans){ const o=old.get(l.id);
      if(o==='menunggu'&&l.status==='dipinjam') toast(`<b>${esc(l.item_nama)}</b> disetujui — ambil ke kepala lab`,'ok');
      if(o==='menunggu'&&l.status==='ditolak') toast(`<b>${esc(l.item_nama)}</b> ditolak${l.alasan?': '+esc(l.alasan):''}`,'bad');
      if(o==='dipinjam'&&l.status==='kembali') toast(`<b>${esc(l.item_nama)}</b> sudah tercatat dikembalikan. Terima kasih!`,'ok'); }
    const changed=JSON.stringify(n)!==JSON.stringify(P); P=n; if(changed&&!$('dlgModal').classList.contains('show')) render(); }
  catch(e){ if(/tidak cocok|tidak ditemukan|nonaktif/i.test(e.message)) keluar(); }
}

/* ---------- data turunan ---------- */
const myPending=id=>P.loans.some(l=>l.item_id===id&&l.status==='menunggu');
function groups(){ const m=new Map();
  for(const it of P.items){ const k=baseName(it.nama).toLowerCase(); let g=m.get(k);
    if(!g){ g={k,nama:baseName(it.nama),kategori:it.kategori,lokasi:it.lokasi,deskripsi:it.deskripsi,units:[],rep:it}; m.set(k,g); }
    g.units.push(it); if(!g.rep.foto_url&&it.foto_url) g.rep=it; if(!g.deskripsi&&it.deskripsi) g.deskripsi=it.deskripsi; }
  for(const g of m.values()){ g.free=g.units.filter(u=>u.status==='tersedia'&&!myPending(u.id)); g.pend=g.units.filter(u=>myPending(u.id)).length; }
  return [...m.values()].sort((a,b)=>(b.free.length>0)-(a.free.length>0)||a.nama.localeCompare(b.nama)); }
const activeLoans=()=>P.loans.filter(l=>l.status==='menunggu'||l.status==='dipinjam');

/* ---------- tampilan ---------- */
function render(){
  const act=activeLoans().length, a=P.anggota;
  $('root').innerHTML=`<header class="top blue"><div class="top-in"><div class="top-row">
      <div class="brand"><div class="logo">${logoHTML(school.logo)}</div><div style="min-width:0"><b>${esc(school.nama)}</b><small>Peminjaman alat lab</small></div></div>
      <div class="row" style="gap:6px;flex-wrap:nowrap"><div class="av" title="${esc(a.nama)}">${esc(a.nama.charAt(0).toUpperCase())}</div><div class="hide-m hello" style="line-height:1.25"><b style="font-size:14px">${esc(a.nama)}</b><div class="small muted">${esc([a.kelas,a.id].filter(Boolean).join(' · '))}</div></div>
      <button class="btn link sm" data-act="keluar" title="Keluar">${icon('out',17)}</button></div></div>
    <nav class="tabs"><a href="#" data-act="tab" data-t="alat" class="${tab==='alat'?'on':''}">🧪 Pinjam alat</a><a href="#" data-act="tab" data-t="saya" class="${tab==='saya'?'on':''}">📦 Pinjamanku${act?` <span class="count">${act}</span>`:''}</a></nav></div></header>
  <main class="wrap" id="view"></main>`;
  (tab==='alat'?pgAlat:pgSaya)($('view')); cartbar();
}
function pgAlat(v){
  const G=groups(), kats=[...new Set(G.map(g=>g.kategori).filter(Boolean))].sort(), q=fq.toLowerCase();
  const list=G.filter(g=>(!fkat||g.kategori===fkat)&&(g.nama+' '+g.kategori+' '+(g.deskripsi||'')).toLowerCase().includes(q));
  const nFree=G.reduce((t,g)=>t+g.free.length,0), act=activeLoans();
  v.innerHTML=`<div class="hero"><div class="grow" style="position:relative;z-index:1"><h2 style="font-size:22px">👋 Halo, ${esc(P.anggota.nama.split(' ')[0])}!</h2><p>Pilih alat yang ingin kamu pinjam. Ketuk alat untuk memutar bentuk 3D-nya, lalu ajukan ke kepala lab.</p></div>
    <div class="imgs">${G.slice(0,3).map(g=>`<img src="${esc(itemImg(g.rep))}" alt="">`).join('')}</div></div>
  <div class="stats">
    <div class="stat"><div class="si" style="background:#d1fae5">✅</div><div><b>${nFree}</b><span>Alat tersedia</span></div></div>
    <div class="stat"><div class="si" style="background:#ede9fe">🧪</div><div><b>${G.length}</b><span>Jenis alat</span></div></div>
    <div class="stat"><div class="si" style="background:#e0eaff">⏳</div><div><b>${act.filter(l=>l.status==='menunggu').length}</b><span>Menunggu persetujuan</span></div></div>
    <div class="stat"><div class="si" style="background:#fef3c7">📦</div><div><b>${act.filter(l=>l.status==='dipinjam').length}</b><span>Sedang kamu pinjam</span></div></div>
  </div>
  <div class="row" style="margin-bottom:12px"><div class="search">${icon('search')}<input id="fq" placeholder="Cari alat" value="${esc(fq)}"></div></div>
  ${kats.length>1?`<div class="chips" style="margin-bottom:18px"><button class="chip ${!fkat?'on':''}" data-act="kat" data-k="">Semua</button>${kats.map(k=>`<button class="chip ${fkat===k?'on':''}" data-act="kat" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>`:''}
  ${list.length?`<div class="items">${list.map(g=>{ const n=cart.get(g.k)||0, off=!g.free.length;
    return `<button class="tile ${n?'sel':''} ${off?'off':''}" data-act="lihat" data-k="${esc(g.k)}">${imgHTML(g.rep).replace('</div>',`<span class="b3d">${icon('cube',13)}3D</span></div>`)}
      <div class="body"><b>${esc(g.nama)}</b><div class="meta"><span>${off?(g.pend?'Sudah kamu ajukan':'Sedang tidak tersedia'):`${g.free.length} tersedia`}</span>${n?`<span class="count">${n}</span>`:''}</div></div></button>`; }).join('')}</div>`
  :`<div class="list"><div class="empty">${P.items.length?'<b>Tidak ditemukan</b>':'<b>Belum ada alat</b>Kepala lab belum menambahkan alat.'}</div></div>`}`;
  const i=$('fq'); i.oninput=()=>{ fq=i.value; const p=i.selectionStart; pgAlat(v); const n=$('fq'); n.focus(); n.setSelectionRange(p,p); };
}
function lihat(k){ const g=groups().find(x=>x.k===k); if(!g) return; let n=Math.max(1,cart.get(k)||1); const max=g.free.length;
  dialog(`<div class="dlg-head"><h3>${esc(g.nama)}</h3><button class="btn link sm icon" data-act="closeDlg">${icon('x')}</button></div>
    <div class="detail" style="gap:22px"><div><div class="stage" id="stage"><span class="tip">Seret untuk memutar</span>
      <div class="ctl"><button class="btn ghost sm" data-act="v3spin">${icon('rotate',16)}</button><button class="btn ghost sm" data-act="v3reset">Reset</button></div>
      ${ok3D?'':'<div class="ph">Tampilan 3D tidak didukung browser ini.</div>'}</div></div>
    <div>
      <div class="row">${max?`<span class="pill p-tersedia">${max} tersedia</span>`:g.pend?'<span class="pill p-menunggu">Sudah kamu ajukan</span>':'<span class="pill p-dipinjam">Sedang tidak tersedia</span>'}</div>
      ${g.deskripsi?`<p style="color:var(--ink2);margin:12px 0 0">${esc(g.deskripsi)}</p>`:''}
      <dl class="kv">${g.kategori?`<dt>Kategori</dt><dd>${esc(g.kategori)}</dd>`:''}${g.lokasi?`<dt>Lokasi</dt><dd>${esc(g.lokasi)}</dd>`:''}<dt>Jumlah unit</dt><dd>${g.units.length}</dd></dl>
      ${max?`<label class="f">Jumlah yang dipinjam</label><div class="row"><div class="qty"><button data-d="-1" aria-label="Kurangi">−</button><span id="qN">${Math.min(n,max)}</span><button data-d="1" aria-label="Tambah">+</button></div>
        <button class="btn grow" id="addCart">${cart.get(k)?'Perbarui daftar':'Tambah ke daftar pinjam'}</button></div>
        ${cart.get(k)?`<button class="btn link sm" id="rmCart" style="margin-top:8px;color:var(--bad)">Hapus dari daftar</button>`:''}`
      :`<p class="note" style="margin-top:16px">${g.pend?'Kamu sudah mengajukan alat ini. Lihat statusnya di <b>Pinjamanku</b>.':'Semua unit sedang dipinjam atau diperbaiki. Coba lagi nanti.'}</p>`}
    </div></div>`,'wide');
  const s=$('stage'); if(ok3D&&s){ mountViewer(s,g.rep); s.insertBefore(_viewer.cv,s.firstChild); }
  if(max){ n=Math.min(n,max); document.querySelector('.qty').onclick=e=>{ const b=e.target.closest('[data-d]'); if(!b) return; n=Math.min(max,Math.max(1,n+ +b.dataset.d)); $('qN').textContent=n; };
    $('addCart').onclick=()=>{ cart.set(k,n); closeDialog(); render(); toast(`${esc(g.nama)} ×${n} ditambahkan`,'ok'); };
    if($('rmCart')) $('rmCart').onclick=()=>{ cart.delete(k); closeDialog(); render(); }; }
}
function cartbar(){ const G=P?groups():[]; let tot=0; const names=[];
  for(const [k,n] of cart){ const g=G.find(x=>x.k===k); if(!g||!g.free.length){ cart.delete(k); continue; } const m=Math.min(n,g.free.length); cart.set(k,m); tot+=m; names.push(g.nama+(m>1?' ×'+m:'')); }
  $('cartbar').classList.toggle('show',!!(P&&tab==='alat'&&tot)); $('cartN').textContent=tot+' alat dipilih'; $('cartList').textContent=names.join(', '); }
function ajukanDlg(){ const G=groups(), rows=[...cart].map(([k,n])=>({g:G.find(x=>x.k===k),n})).filter(r=>r.g);
  dialog(`<div class="dlg-head"><h3>Ajukan peminjaman</h3><button class="btn link sm icon" data-act="closeDlg">${icon('x')}</button></div>
    <div class="list">${rows.map(r=>`<div class="li">${imgHTML(r.g.rep,'pic xs')}<div class="main"><b>${esc(r.g.nama)}</b></div><span class="muted">×${r.n}</span></div>`).join('')}</div>
    <label class="f" style="margin-top:16px">Untuk keperluan apa?</label><textarea id="ajCat" placeholder="contoh: praktik kelistrikan bodi, kelas XI TKR 1" maxlength="300"></textarea>
    <p class="hint">Pengajuan dikirim ke kepala lab. Setelah disetujui, ambil alatnya ke kepala lab.</p>
    <div class="dlg-actions"><button class="btn ghost" data-act="closeDlg">Kembali</button><button class="btn" id="ajOk">Kirim pengajuan</button></div>`,'mid');
  $('ajOk').onclick=async()=>{ const ids=[]; for(const r of rows) ids.push(...r.g.free.slice(0,r.n).map(u=>u.id));
    busy(true); try{ P=await API.portalAjukan(kode,who.ident,who.nama,ids,$('ajCat').value.trim()); cart.clear(); tab='saya'; closeDialog(); render();
      dialog(`<div style="text-align:center;padding:8px 0"><div class="av" style="width:56px;height:56px;margin:0 auto 14px;background:var(--ok-bg);color:var(--ok)">${icon('check',28)}</div>
        <h3>Pengajuan terkirim</h3><p class="dlg-text">Tunggu kepala lab menyetujui. Status akan berubah otomatis di halaman ini. Setelah disetujui, ambil alatnya ke kepala lab.</p>
        <button class="btn full" data-act="closeDlg">Oke</button></div>`); }
    catch(e){ toast(esc(translateErr(e.message)),'bad'); refresh(); } finally{ busy(false); } };
}
function pgSaya(v){
  const act=activeLoans(), old=P.loans.filter(l=>!(l.status==='menunggu'||l.status==='dipinjam'));
  const itm=id=>P.items.find(i=>i.id===id)||{nama:'',id};
  const row=l=>{ const t={menunggu:`Diajukan ${fmtJam(l.diajukan)} · menunggu persetujuan kepala lab`,dipinjam:`Disetujui ${fmtJam(l.pinjam)} · kembalikan ke kepala lab setelah selesai`,
      kembali:`Dikembalikan ${fmtJam(l.kembali)}${l.kondisi&&l.kondisi!=='Baik'?' · kondisi: '+esc(l.kondisi):''}`,ditolak:`Ditolak${l.alasan?': '+esc(l.alasan):''}`,batal:'Kamu membatalkan pengajuan ini'}[l.status];
    return `<div class="li">${imgHTML(itm(l.item_id),'pic sm')}<div class="main"><b>${esc(l.item_nama)}</b><span>${t}</span></div>
      <div class="row" style="flex-direction:column;align-items:flex-end;gap:6px">${pill(l.status,{menunggu:'Menunggu',dipinjam:'Dipinjam',kembali:'Selesai',ditolak:'Ditolak',batal:'Batal'}[l.status])}
      ${l.status==='menunggu'?`<button class="btn link sm" data-act="batal" data-id="${l.id}">Batalkan</button>`:''}</div></div>`; };
  v.innerHTML=`<div class="page-head"><div><h1>📦 Pinjamanku</h1><p>Status diperbarui otomatis.</p></div></div>
  <div class="section"><div class="section-head"><h2>Sedang berjalan</h2></div>
    <div class="list">${act.length?act.map(row).join(''):`<div class="empty"><b>Belum ada pinjaman</b><a href="#" data-act="tab" data-t="alat">Pilih alat untuk dipinjam</a></div>`}</div></div>
  ${old.length?`<div class="section"><div class="section-head"><h2>Riwayat</h2></div><div class="list">${old.map(row).join('')}</div></div>`:''}`;
}
window.onDialogClose=()=>{ if(_viewer&&_viewer.view) _viewer.view.stop(); };

const ACTIONS={
  keluar, closeDlg:closeDialog,
  tab:b=>{ tab=b.dataset.t; render(); window.scrollTo(0,0); },
  kat:b=>{ fkat=b.dataset.k; pgAlat($('view')); },
  lihat:b=>lihat(b.dataset.k),
  ajukan:ajukanDlg,
  v3spin:()=>{ if(_viewer) _viewer.spin(); },
  v3reset:()=>{ if(_viewer) _viewer.reset(); },
  batal:async b=>{ if(!await confirmBox('Batalkan pengajuan ini?','Batalkan',true)) return;
    busy(true); try{ P=await API.portalBatal(kode,who.ident,who.nama,+b.dataset.id); render(); toast('Pengajuan dibatalkan','ok'); }catch(e){ toast(esc(translateErr(e.message)),'bad'); } finally{ busy(false); } },
};
document.addEventListener('click',e=>{ const b=e.target.closest('[data-act]'); if(!b||b.disabled) return; const f=ACTIONS[b.dataset.act]; if(!f) return; e.preventDefault(); f(b,e); });
boot();
