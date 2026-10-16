"use strict";
/* ======================================================================
   SiPinLab v6 – LAPISAN DATA
   Dua mode dengan antarmuka yang sama:
   • SupaAPI : Supabase (otomatis jika /api/config berisi kunci)
   • DemoAPI : penyimpanan browser (coba tanpa server)
   Dipakai oleh halaman Kepala Lab (index.html) dan halaman Siswa (pinjam.html).
   ====================================================================== */
const ROLE_NAME={superadmin:'Super Admin',admin:'Kepala Lab',staf:'Staf',anggota:'Anggota'};
const USERNAME_RE=/^[a-z0-9._-]{3,32}$/;
const KODE_RE=/^[a-z0-9][a-z0-9-]{1,29}$/;
const KODE_RESERVED=['api','css','js','admin','super','superadmin','login','index','assets','static','pinjam'];
const SUPABASE_CDN=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js','https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'];
const LOAN_STATUS={menunggu:'Menunggu persetujuan',dipinjam:'Sedang dipinjam',kembali:'Sudah dikembalikan',ditolak:'Ditolak',batal:'Dibatalkan'};

const nowISO=()=>new Date().toISOString();
const pad4=n=>String(n).padStart(4,'0');
function uid(){ try{ if(crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);}); }
const clone=o=>JSON.parse(JSON.stringify(o));
function blobToDataURL(b){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(b); }); }
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('gagal memuat '+src)); document.head.appendChild(s); }); }
function validKode(k){ return KODE_RE.test(k)&&!KODE_RESERVED.includes(k); }
function translateErr(msg){
  msg=String(msg||'');
  if(/row-level security|permission denied|not authorized|tidak punya akses/i.test(msg)) return 'Anda tidak punya akses untuk tindakan ini';
  if(/JWT expired|invalid JWT/i.test(msg)) return 'Sesi login habis, silakan login ulang';
  if(/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Tidak bisa terhubung ke server. Periksa internet.';
  if(/schools_kode_key|duplicate key.*kode/i.test(msg)) return 'Kode sekolah sudah dipakai sekolah lain';
  if(/schools_kode_chk/i.test(msg)) return 'Kode sekolah hanya huruf kecil, angka, dan tanda minus (2–30 karakter)';
  if(/duplicate key/i.test(msg)) return 'Data dengan kode yang sama sudah ada';
  if(/Payload too large|exceeded the maximum/i.test(msg)) return 'Ukuran file terlalu besar';
  if(/Could not find the function|column .* does not exist|schema cache/i.test(msg)) return 'Database belum di-update ke v6. Jalankan ulang supabase/schema.sql di Supabase.';
  return msg;
}
const emptyData=()=>({school:null,anggota:[],items:[],loans:[]});

/* ---------------------------------------------------------------- DEMO */
class DemoAPI{
  constructor(){ this.mode='demo'; this.K='sipinlab_demo_v6c'; this.SK=this.K+'_sesi'; this.sid=null; this._load(); }
  _fresh(){
    const s={id:uid(),kode:'demo',nama:'SMK Negeri Contoh',warna:'#2563eb',warna2:'#0b1f4d',logo:'🔬',alamat:'',aktif:true,ai3d:false,created_at:nowISO()};
    const d={schools:[s],anggota:[],items:[],loans:[],seq:{a:0,i:0,l:0},users:[
      {id:uid(),username:'super',nama:'Super Admin',password:'super123',role:'superadmin',school_id:null,aktif:true,created_at:nowISO()},
      {id:uid(),username:'admin',nama:'Kepala Lab',password:'admin123',role:'admin',school_id:s.id,aktif:true,created_at:nowISO()}]};
    const A=[["Andi Saputra", "Siswa", "X TKR 1", "24001"], ["Bunga Lestari", "Siswa", "X TKR 1", "24002"], ["Citra Ayuningtyas", "Siswa", "X TKR 1", "24003"], ["Dimas Pratama", "Siswa", "X TKR 1", "24004"], ["Eka Wulandari", "Siswa", "X TKR 2", "24005"], ["Fajar Nugroho", "Siswa", "X TKR 2", "24006"], ["Gilang Ramadhan", "Siswa", "X TKR 2", "24007"], ["Hana Safitri", "Siswa", "X TKR 2", "24008"], ["Irfan Hakim", "Siswa", "XI TKR 1", "23001"], ["Jihan Aulia", "Siswa", "XI TKR 1", "23002"], ["Kevin Saputra", "Siswa", "XI TKR 1", "23003"], ["Lia Maharani", "Siswa", "XI TKR 1", "23004"], ["Muhammad Rizky", "Siswa", "XI TKR 1", "23005"], ["Nadia Putri", "Siswa", "XI TKR 2", "23006"], ["Oki Setiawan", "Siswa", "XI TKR 2", "23007"], ["Putri Amelia", "Siswa", "XI TKR 2", "23008"], ["Rahmat Hidayat", "Siswa", "XI TKR 2", "23009"], ["Siti Rahmawati", "Siswa", "XI TKR 2", "23010"], ["Taufik Ismail", "Siswa", "XII TKR 1", "22001"], ["Umi Kalsum", "Siswa", "XII TKR 1", "22002"], ["Vino Alfarizi", "Siswa", "XII TKR 1", "22003"], ["Wahyu Setiadi", "Siswa", "XII TKR 1", "22004"], ["Yoga Pratama", "Siswa", "XII TKR 1", "22005"], ["Zahra Nabila", "Siswa", "XII TKR 2", "22006"], ["Agus Salim", "Siswa", "XII TKR 2", "22007"], ["Bayu Anggara", "Siswa", "XII TKR 2", "22008"], ["Dewi Kartika", "Siswa", "XII TKR 2", "22009"], ["Erlangga Putra", "Siswa", "XII TKR 2", "22010"], ["Farhan Maulana", "Siswa", "XI TKJ 1", "23101"], ["Gita Permata", "Siswa", "XI TKJ 1", "23102"], ["Hendra Wijaya", "Siswa", "XI TKJ 1", "23103"], ["Intan Permatasari", "Siswa", "XI TKJ 1", "23104"], ["Pak Budi Santoso", "Guru", "Guru Produktif TKR", "197805122005011002"], ["Bu Sri Wahyuni", "Guru", "Guru IPA", "198203142008012004"], ["Pak Joko Susilo", "Guru", "Guru Kelistrikan", "198511202010011007"], ["Mas Rudi Hartanto", "Laboran", "Laboran Bengkel", ""]];
    A.forEach(([nama,peran,kelas,nis])=>d.anggota.push({id:'AGT-'+pad4(++d.seq.a),school_id:s.id,nama,peran,kelas,nis,created_at:nowISO()}));
    const I=[["Engine Stand Trainer Mesin Bensin", "Otomotif", "Area praktik A", "Trainer mesin 4 tak lengkap dengan dudukan. Wajib didampingi guru.", "engine", 2], ["Dongkrak Buaya 3 Ton", "Chassis", "Area angkat", "Kapasitas 3 ton. Pasang di titik angkat kendaraan.", "jack", 3], ["Jack Stand 3 Ton (sepasang)", "Chassis", "Area angkat", "Selalu dipakai setelah kendaraan didongkrak.", "jackstand", 4], ["Kunci Momen 1/2 inci", "Perkakas", "Lemari B-2", "Rentang 40–210 Nm. Kembalikan ke posisi skala terendah.", "torque", 3], ["Impact Wrench Pneumatik", "Perkakas", "Lemari B-3", "Membutuhkan kompresor. Gunakan kacamata pelindung.", "impact", 2], ["Kompresor Udara 1 HP", "Perkakas", "Ruang kompresor", "Tangki 50 liter.", "compressor", 1], ["Troli Perkakas 7 Laci", "Perkakas", "Area praktik B", "Berisi kunci, obeng, dan tang lengkap. Cek isi saat mengembalikan.", "toolbox", 2], ["Ban dan Velg Ring 14", "Chassis", "Rak ban", "Untuk praktik bongkar pasang & balancing.", "wheel", 4], ["Aki 12V 45Ah", "Kelistrikan", "Rak aki", "Simpan dalam keadaan terisi. Hati-hati air aki.", "battery", 3], ["Scanner OBD-II", "Kelistrikan", "Lemari A-1", "Membaca kode kerusakan (DTC) mobil injeksi.", "obd", 2], ["Set Busi dan Kunci Busi", "Otomotif", "Lemari A-2", "Berisi 4 busi, kunci busi 16 & 21 mm, dan feeler gauge.", "sparkplug", 3], ["Multimeter Digital", "Kelistrikan", "Lemari A-1", "Untuk mengukur tegangan, arus, dan hambatan.", "multimeter", 6], ["Jangka Sorong 150 mm", "Alat ukur", "Lemari A-3", "Ketelitian 0,05 mm. Simpan di kotaknya.", "caliper", 6], ["Mikrometer Sekrup 0–25 mm", "Alat ukur", "Lemari A-3", "Ketelitian 0,01 mm.", "caliper", 3], ["Set Kunci Kombinasi 8–24 mm", "Perkakas", "Lemari B-1", "14 pcs kunci ring-pas.", "wrenchset", 4], ["Mikroskop Binokuler", "Lab IPA", "Lemari kaca 1", "Perbesaran 40×–1000×. Bawa dengan dua tangan.", "microscope", 3], ["Gelas Kimia 250 ml", "Lab IPA", "Lemari kaca 2", "Satu set berisi 6 gelas kimia.", "beaker", 2], ["Erlenmeyer 100 ml", "Lab IPA", "Lemari kaca 2", "Satu set berisi 6 labu erlenmeyer.", "beaker", 2], ["Neraca Ohaus 311 g", "Lab IPA", "Meja timbang", "Kalibrasi ke nol sebelum dipakai.", "balance", 2], ["Model Torso Manusia", "Lab IPA", "Lemari peraga", "Organ bisa dilepas-pasang.", "torso", 1], ["Proyektor", "Multimedia", "Lemari guru", "Termasuk kabel HDMI dan remote.", "projector", 2], ["Laptop Praktik", "Multimedia", "Lemari guru", "Termasuk charger. Jangan menyimpan file pribadi.", "laptop", 4], ["Kipas Angin Berdiri", "Umum", "Gudang", "", "fan", 2], ["Bola Voli", "Olahraga", "Gudang olahraga", "", "ball", 2], ["Kotak P3K", "Umum", "Dinding dekat pintu", "Laporkan ke kepala lab jika isinya terpakai.", "generic", 1], ["Osiloskop Digital 2 Kanal", "Kelistrikan", "Lemari A-1", "Untuk melihat bentuk gelombang sinyal sensor.", "multimeter", 1]];
    I.forEach(([nama,kategori,lokasi,deskripsi,model,qty])=>{ for(let u=1;u<=qty;u++) d.items.push(this._itemRow({nama:qty>1?nama+' #'+u:nama,kategori,lokasi,deskripsi,model},d,s.id)); });
    const mk=(a,i,status,extra={})=>{ const l=Object.assign({id:++d.seq.l,school_id:s.id,anggota_id:a.id,anggota_nama:a.nama,item_id:i.id,item_nama:i.nama,status,diajukan:new Date(Date.now()-36e5).toISOString(),pinjam:null,kembali:null,kondisi:'',catatan:'',alasan:'',sumber:'siswa',petugas:null},extra); d.loans.push(l); return l; };
    const F=n=>d.items.find(i=>i.nama.startsWith(n));
    const dj=F('Dongkrak'); mk(d.anggota[17],dj,'dipinjam',{pinjam:new Date(Date.now()-3e6).toISOString(),catatan:'Praktik chassis'});
    Object.assign(dj,{status:'dipinjam',pemakai_terakhir:d.anggota[17].id,pemakai_nama:d.anggota[17].nama,waktu_terakhir:nowISO()});
    mk(d.anggota[0],F('Multimeter'),'menunggu',{diajukan:new Date(Date.now()-6e5).toISOString(),catatan:'Praktik kelistrikan bodi'});
    mk(d.anggota[0],F('Jangka Sorong'),'menunggu',{diajukan:new Date(Date.now()-6e5).toISOString(),catatan:'Praktik kelistrikan bodi'});
    return d;
  }
  _itemRow(r,d,sid){ return Object.assign({kategori:'',lab_id:null,lokasi:'',deskripsi:'',status:'tersedia',model:'',foto_url:null,foto3d_url:null,model3d_url:null,ai3d_status:'',ai3d_progress:0,tinggi_cm:50,skala:1,pemakai_terakhir:null,pemakai_nama:null,waktu_terakhir:null},r,{id:'ALT-'+pad4(++d.seq.i),school_id:sid,created_at:nowISO()}); }
  _load(){ try{ this.d=JSON.parse(localStorage.getItem(this.K)); }catch(e){ this.d=null; }
    if(!this.d||!this.d.users||!this.d.schools){ this.d=this._fresh(); try{ localStorage.setItem(this.K,JSON.stringify(this.d)); }catch(e){} } }
  _save(){ try{ localStorage.setItem(this.K,JSON.stringify(this.d)); }catch(e){ throw new Error('Penyimpanan browser penuh (foto terlalu banyak). Hapus beberapa foto.'); } }
  _me(){ let id=null; try{ id=localStorage.getItem(this.SK); }catch(e){} const u=this.d.users.find(x=>x.id===id&&x.aktif); if(!u) return null;
    if(u.role!=='superadmin'){ const s=this.d.schools.find(x=>x.id===u.school_id); if(!s||!s.aktif) return null; } return u; }
  _super(){ const u=this._me(); return !!u&&u.role==='superadmin'; }
  _admin(){ const u=this._me(); if(!u||!(u.role==='superadmin'||(u.role==='admin'&&u.school_id===this.sid))||!this.sid) throw new Error('Anda tidak punya akses untuk tindakan ini'); return u; }
  _needSuper(){ if(!this._super()) throw new Error('Hanya Super Admin yang boleh melakukan ini'); }
  _pub(u){ const {password,...p}=u; return clone(p); }
  async init(){ return this; }
  async schoolInfo(kode){ this._load(); const s=this.d.schools.find(x=>x.kode===String(kode||'').trim().toLowerCase()); return s?clone(s):null; }
  async needsSetup(){ return false; }
  async session(){ const u=this._me(); if(!u) return null; const p=this._pub(u); p.school=u.school_id?clone(this.d.schools.find(s=>s.id===u.school_id)):null; return p; }
  async login(kode,username,password){
    this._load(); kode=String(kode||'').trim().toLowerCase(); username=String(username||'').trim().toLowerCase();
    const s=kode?this.d.schools.find(x=>x.kode===kode):null; if(kode&&!s) throw new Error('Kode sekolah tidak ditemukan');
    const u=this.d.users.find(x=>x.username===username&&(kode?x.school_id===s.id:x.role==='superadmin'));
    if(!u||u.password!==password) throw new Error('Username atau password salah');
    if(!u.aktif) throw new Error('Akun dinonaktifkan'); if(s&&!s.aktif) throw new Error('Sekolah ini sedang dinonaktifkan oleh Super Admin');
    localStorage.setItem(this.SK,u.id); return this.session();
  }
  async logout(){ try{ localStorage.removeItem(this.SK); }catch(e){} }
  async loadAll(){ this._load(); const sid=this.sid, me=this._me(); if(!sid||!me||(me.role!=='superadmin'&&me.school_id!==sid)) return emptyData();
    const d=this.d, f=r=>r.school_id===sid;
    return clone({school:d.schools.find(s=>s.id===sid)||null,anggota:d.anggota.filter(f),items:d.items.filter(f),loans:d.loans.filter(f)}); }
  /* sekolah (Super Admin) */
  async listSchools(){ this._needSuper(); const d=this.d; return clone(d.schools.map(s=>Object.assign({},s,{n_anggota:d.anggota.filter(a=>a.school_id===s.id).length,n_alat:d.items.filter(i=>i.school_id===s.id).length}))); }
  async createSchool(s){ this._needSuper(); const kode=String(s.kode||'').trim().toLowerCase(); if(!validKode(kode)) throw new Error(translateErr('schools_kode_chk'));
    if(this.d.schools.some(x=>x.kode===kode)) throw new Error('Kode sekolah sudah dipakai sekolah lain');
    const row=Object.assign({warna:'#2563eb',warna2:'#0b1f4d',logo:'🔬',alamat:'',aktif:true,ai3d:false},s,{id:uid(),kode,created_at:nowISO()}); this.d.schools.push(row); this._save(); return clone(row); }
  async updateSchool(id,patch){ const me=this._me(); if(!me||!(me.role==='superadmin'||(me.role==='admin'&&me.school_id===id))) throw new Error('Anda tidak punya akses');
    const s=this.d.schools.find(x=>x.id===id); if(!s) throw new Error('Sekolah tidak ditemukan'); patch=Object.assign({},patch); delete patch.kode;
    if(me.role!=='superadmin'){ delete patch.aktif; delete patch.ai3d; } Object.assign(s,patch); this._save(); return clone(s); }
  async deleteSchool(id,konfirmasi){ this._needSuper(); const s=this.d.schools.find(x=>x.id===id); if(!s) throw new Error('Sekolah tidak ditemukan'); if(konfirmasi!==s.kode) throw new Error('Ketik kode sekolah dengan benar untuk konfirmasi');
    const d=this.d, f=r=>r.school_id!==id; d.schools=d.schools.filter(x=>x.id!==id); ['anggota','items','loans','users'].forEach(k=>d[k]=d[k].filter(f)); this._save(); }
  /* anggota */
  async addAnggota(rows){ this._admin(); const out=rows.map(r=>({id:'AGT-'+pad4(++this.d.seq.a),school_id:this.sid,nama:r.nama,peran:r.peran||'Siswa',kelas:r.kelas||'',nis:r.nis||'',created_at:nowISO()}));
    this.d.anggota.push(...out); this._save(); return clone(out); }
  async updateAnggota(id,patch){ this._admin(); const a=this.d.anggota.find(x=>x.id===id&&x.school_id===this.sid); if(!a) throw new Error('Anggota tidak ditemukan');
    ['nama','peran','kelas','nis'].forEach(k=>{ if(patch[k]!==undefined) a[k]=patch[k]; }); this._save(); return clone(a); }
  async deleteAnggota(id){ this._admin(); this.d.anggota=this.d.anggota.filter(a=>!(a.id===id&&a.school_id===this.sid)); this._save(); }
  /* alat */
  async addItems(rows){ this._admin(); const out=rows.map(r=>this._itemRow(r,this.d,this.sid)); this.d.items.push(...out); this._save(); return clone(out); }
  async updateItem(id,patch){ this._admin(); const it=this.d.items.find(i=>i.id===id&&i.school_id===this.sid); if(!it) throw new Error('Alat tidak ditemukan');
    patch=Object.assign({},patch); delete patch.school_id; delete patch.id; Object.assign(it,patch); this._save(); return clone(it); }
  async deleteItem(id){ this._admin(); this.d.items=this.d.items.filter(i=>!(i.id===id&&i.school_id===this.sid)); this._save(); }
  async uploadFoto(path,blob){ this._admin(); return blobToDataURL(blob); }
  /* peminjaman (Kepala Lab) */
  _serahkan(l){ const i=this.d.items.find(x=>x.id===l.item_id&&x.school_id===l.school_id);
    if(!i) throw new Error(`Alat ${l.item_nama} sudah tidak terdaftar`);
    if(i.status==='dipinjam') throw new Error(`Alat ${i.nama} sedang dipinjam orang lain`); if(i.status==='rusak') throw new Error(`Alat ${i.nama} berstatus rusak`);
    Object.assign(l,{status:'dipinjam',pinjam:nowISO(),petugas:this._me().id});
    Object.assign(i,{status:'dipinjam',pemakai_terakhir:l.anggota_id,pemakai_nama:l.anggota_nama,waktu_terakhir:nowISO()});
    this.d.loans.forEach(o=>{ if(o.item_id===i.id&&o.status==='menunggu'&&o.id!==l.id) Object.assign(o,{status:'ditolak',alasan:'Alat sudah dipinjam peminjam lain'}); }); return l; }
  _loan(id){ this._load(); this._admin(); const l=this.d.loans.find(x=>x.id===id&&x.school_id===this.sid); if(!l) throw new Error('Peminjaman tidak ditemukan'); return l; }
  async setujui(id){ const l=this._loan(id); if(l.status!=='menunggu') throw new Error('Pengajuan ini sudah diproses'); this._serahkan(l); this._save(); return clone(l); }
  async tolak(id,alasan){ const l=this._loan(id); if(l.status!=='menunggu') throw new Error('Pengajuan ini sudah diproses');
    Object.assign(l,{status:'ditolak',alasan:String(alasan||'').slice(0,300),petugas:this._me().id}); this._save(); return clone(l); }
  async pinjamkan(anggotaId,itemIds,catatan){ this._load(); this._admin(); const a=this.d.anggota.find(x=>x.id===anggotaId&&x.school_id===this.sid); if(!a) throw new Error('Anggota tidak terdaftar');
    if(!itemIds.length) throw new Error('Pilih minimal satu alat');
    const snap=JSON.stringify(this.d), out=[];
    try{ for(const iid of itemIds){ const i=this.d.items.find(x=>x.id===iid&&x.school_id===this.sid); if(!i) throw new Error(`Alat ${iid} tidak terdaftar`);
        const l={id:++this.d.seq.l,school_id:this.sid,anggota_id:a.id,anggota_nama:a.nama,item_id:i.id,item_nama:i.nama,status:'menunggu',diajukan:nowISO(),pinjam:null,kembali:null,kondisi:'',catatan:String(catatan||'').slice(0,300),alasan:'',sumber:'admin',petugas:null};
        this.d.loans.push(l); out.push(this._serahkan(l)); } }
    catch(e){ this.d=JSON.parse(snap); throw e; }
    this._save(); return clone(out); }
  async kembali(id,kondisi){ const l=this._loan(id); if(l.status!=='dipinjam') throw new Error('Alat pada peminjaman ini tidak sedang dipinjam'); const k=kondisi||'Baik';
    Object.assign(l,{status:'kembali',kembali:nowISO(),kondisi:k,petugas:this._me().id});
    const i=this.d.items.find(x=>x.id===l.item_id); if(i) Object.assign(i,{status:k==='Baik'?'tersedia':'rusak',waktu_terakhir:nowISO()}); this._save(); return clone(l); }
  /* akun */
  async listUsers(schoolId){ const me=this._me(); if(!me) throw new Error('Belum login'); const sid=me.role==='superadmin'?schoolId:me.school_id;
    return this.d.users.filter(u=>sid===null?u.role==='superadmin':u.school_id===sid).map(u=>this._pub(u)); }
  async createUser(b){ const me=this._me(); if(!me||!(me.role==='superadmin'||me.role==='admin')) throw new Error('Tidak punya akses');
    const role=b.role==='superadmin'?'superadmin':'admin', sid=role==='superadmin'?null:(b.school_id||this.sid);
    if(me.role!=='superadmin'&&(role==='superadmin'||sid!==me.school_id)) throw new Error('Tidak punya akses');
    const username=String(b.username||'').trim().toLowerCase();
    if(!USERNAME_RE.test(username)) throw new Error('Username 3–32 karakter: huruf kecil, angka, titik, minus, garis bawah');
    if(String(b.password||'').length<6) throw new Error('Password minimal 6 karakter');
    if(this.d.users.some(u=>u.username===username&&u.school_id===sid)) throw new Error('Username sudah dipakai di sekolah ini');
    const u={id:uid(),username,nama:String(b.nama||username).trim(),password:String(b.password),role,school_id:sid,aktif:true,created_at:nowISO()};
    this.d.users.push(u); this._save(); return this._pub(u); }
  async updateUser(b){ const me=this._me(), u=this.d.users.find(x=>x.id===b.id); if(!u||!me) throw new Error('Akun tidak ditemukan');
    if(me.role!=='superadmin'&&u.school_id!==me.school_id) throw new Error('Tidak punya akses');
    if(b.password){ if(String(b.password).length<6) throw new Error('Password minimal 6 karakter'); u.password=String(b.password); }
    if(b.nama!==undefined) u.nama=b.nama; if(b.aktif!==undefined){ if(b.id===me.id&&!b.aktif) throw new Error('Tidak bisa menonaktifkan akun sendiri'); u.aktif=b.aktif; }
    this._save(); return this._pub(u); }
  async deleteUser(id){ const me=this._me(); if(id===me.id) throw new Error('Tidak bisa menghapus akun sendiri'); this.d.users=this.d.users.filter(x=>x.id!==id); this._save(); }
  subscribe(cb){ window.addEventListener('storage',e=>{ if(e.key===this.K){ this._load(); cb('loans'); } }); }
  async ai3dStart(){ throw new Error('3D AI hanya tersedia saat aplikasi online (Supabase + Vercel + MESHY_API_KEY)'); }
  async ai3dStatus(id){ return {item:clone(this.d.items.find(i=>i.id===id)||{})}; }
  async resetAll(){ localStorage.removeItem(this.K); localStorage.removeItem(this.SK); }
  /* ---------- portal siswa (tanpa login) ---------- */
  _portalAnggota(kode,ident,nama){ this._load();
    const s=this.d.schools.find(x=>x.kode===String(kode||'').trim().toLowerCase()); if(!s) throw new Error('Sekolah tidak ditemukan. Periksa link dari kepala lab.');
    if(!s.aktif) throw new Error('Layanan peminjaman sekolah ini sedang nonaktif');
    let v=String(ident||'').trim().toUpperCase(); const n=String(nama||'').trim().toLowerCase();
    if(!v||n.length<2) throw new Error('Isi kode anggota/NIS dan nama kamu');
    if(/^[0-9]{1,4}$/.test(v)) v='AGT-'+pad4(v);
    const a=this.d.anggota.find(x=>x.school_id===s.id&&(x.id.toUpperCase()===v||(x.nis&&x.nis.toUpperCase()===String(ident).trim().toUpperCase()))&&x.nama.toLowerCase().includes(n));
    if(!a) throw new Error('Data tidak cocok. Pastikan kode/NIS dan nama benar, atau minta kepala lab mendaftarkanmu sebagai anggota.');
    return a; }
  _portalOut(a){ const d=this.d;
    return clone({anggota:{id:a.id,nama:a.nama,kelas:a.kelas,peran:a.peran},
      items:d.items.filter(i=>i.school_id===a.school_id).map(i=>({id:i.id,nama:i.nama,kategori:i.kategori,lokasi:i.lokasi,deskripsi:i.deskripsi,status:i.status,model:i.model,foto_url:i.foto_url,foto3d_url:i.foto3d_url,model3d_url:i.model3d_url,tinggi_cm:i.tinggi_cm})),
      loans:d.loans.filter(l=>l.anggota_id===a.id&&l.school_id===a.school_id).sort((x,y)=>y.diajukan.localeCompare(x.diajukan)).slice(0,40)}); }
  async portalMasuk(kode,ident,nama){ return this._portalOut(this._portalAnggota(kode,ident,nama)); }
  async portalAjukan(kode,ident,nama,itemIds,catatan){ const a=this._portalAnggota(kode,ident,nama), d=this.d;
    if(!itemIds.length) throw new Error('Pilih minimal satu alat'); if(itemIds.length>10) throw new Error('Maksimal 10 alat dalam satu pengajuan');
    if(d.loans.filter(l=>l.anggota_id===a.id&&l.status==='menunggu').length+itemIds.length>15) throw new Error('Pengajuanmu yang menunggu sudah terlalu banyak. Tunggu kepala lab memprosesnya dulu.');
    const rows=[]; for(const iid of itemIds){ const i=d.items.find(x=>x.id===iid&&x.school_id===a.school_id); if(!i) throw new Error(`Alat ${iid} tidak ditemukan`);
      if(i.status!=='tersedia') throw new Error(`Alat ${i.nama} sedang tidak tersedia`);
      if(d.loans.some(l=>l.item_id===i.id&&l.anggota_id===a.id&&l.status==='menunggu')) throw new Error(`Kamu sudah mengajukan ${i.nama}`);
      rows.push({id:++d.seq.l,school_id:a.school_id,anggota_id:a.id,anggota_nama:a.nama,item_id:i.id,item_nama:i.nama,status:'menunggu',diajukan:nowISO(),pinjam:null,kembali:null,kondisi:'',catatan:String(catatan||'').slice(0,300),alasan:'',sumber:'siswa',petugas:null}); }
    d.loans.push(...rows); this._save(); return this._portalOut(a); }
  async portalBatal(kode,ident,nama,loanId){ const a=this._portalAnggota(kode,ident,nama), l=this.d.loans.find(x=>x.id===loanId&&x.anggota_id===a.id&&x.status==='menunggu');
    if(!l) throw new Error('Pengajuan tidak bisa dibatalkan (mungkin sudah diproses)'); l.status='batal'; this._save(); return this._portalOut(a); }
}

/* ------------------------------------------------------------- SUPABASE */
class SupaAPI{
  constructor(cfg){ this.mode='supabase'; this.cfg=cfg; this.sid=null; }
  async init(){
    if(!window.supabase){ for(const u of SUPABASE_CDN){ try{ await loadScript(u); if(window.supabase) break; }catch(e){} }
      if(!window.supabase) throw new Error('Pustaka Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang.'); }
    this.sb=window.supabase.createClient(this.cfg.url,this.cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'sipinlab-auth'}});
    return this;
  }
  _q(p){ return Promise.resolve(p).then(r=>{ if(r&&r.error) throw new Error(translateErr(r.error.message)); return r?r.data:null; }); }
  _email(u,kode){ u=String(u||'').trim().toLowerCase(); kode=String(kode||'').trim().toLowerCase(); return (kode?`${u}.${kode}`:u)+'@'+(this.cfg.domain||'sipinlab.app'); }
  async schoolInfo(kode){ if(!kode) return null; try{ return await this._q(this.sb.rpc('info_sekolah',{p_kode:kode})); }catch(e){ return null; } }
  async needsSetup(){ return !(await this._q(this.sb.rpc('ada_superadmin'))); }
  async _post(path,body){
    const {data}=await this.sb.auth.getSession(); const tok=data&&data.session&&data.session.access_token;
    let r; try{ r=await fetch(path,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{Authorization:'Bearer '+tok}:{}),body:JSON.stringify(body)}); }
    catch(e){ throw new Error('Tidak bisa menghubungi server ('+path+')'); }
    const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||`Gagal (${r.status})`); return j;
  }
  async setupSuper(b){ return this._post('/api/admin',Object.assign({action:'setup'},b)); }
  async _profile(){
    const {data:{user}}=await this.sb.auth.getUser(); if(!user) return null;
    const p=await this._q(this.sb.from('profiles').select('*').eq('id',user.id).maybeSingle());
    if(!p){ await this.sb.auth.signOut(); throw new Error('Akun ini belum terdaftar. Hubungi Super Admin.'); }
    if(!p.aktif){ await this.sb.auth.signOut(); throw new Error('Akun dinonaktifkan'); }
    if(p.role!=='superadmin'&&p.role!=='admin'){ await this.sb.auth.signOut(); throw new Error('Halaman ini khusus kepala lab. Siswa meminjam lewat link siswa.'); }
    if(p.role!=='superadmin'){ const s=await this._q(this.sb.from('schools').select('*').eq('id',p.school_id).maybeSingle());
      if(!s||!s.aktif){ await this.sb.auth.signOut(); throw new Error('Sekolah ini sedang dinonaktifkan oleh Super Admin'); } p.school=s; }
    else p.school=null;
    return p;
  }
  async session(){ const {data}=await this.sb.auth.getSession(); if(!data||!data.session) return null; try{ return await this._profile(); }catch(e){ return null; } }
  async login(kode,username,password){
    const {error}=await this.sb.auth.signInWithPassword({email:this._email(username,kode),password});
    if(error) throw new Error(/invalid login|invalid credentials/i.test(error.message)?'Username atau password salah':/banned/i.test(error.message)?'Akun dinonaktifkan':translateErr(error.message));
    return this._profile();
  }
  async logout(){ await this.sb.auth.signOut(); }
  async loadAll(){
    const s=this.sb, sid=this.sid; if(!sid) return emptyData(); const by=q=>q.eq('school_id',sid);
    const [school,anggota,items,loans]=await Promise.all([
      this._q(s.from('schools').select('*').eq('id',sid).maybeSingle()),
      this._q(by(s.from('anggota').select('*')).order('id',{ascending:true})),
      this._q(by(s.from('items').select('*')).order('id',{ascending:true})),
      this._q(by(s.from('loans').select('*')).order('diajukan',{ascending:true}).limit(10000)),
    ]);
    return {school,anggota:anggota||[],items:items||[],loans:loans||[]};
  }
  async listSchools(){
    const s=this.sb, [rows,ag,it]=await Promise.all([this._q(s.from('schools').select('*').order('created_at',{ascending:true})),
      this._q(s.from('anggota').select('school_id')),this._q(s.from('items').select('school_id'))]);
    const cnt=(arr,id)=>(arr||[]).filter(r=>r.school_id===id).length;
    return (rows||[]).map(r=>Object.assign(r,{n_anggota:cnt(ag,r.id),n_alat:cnt(it,r.id)}));
  }
  async createSchool(row){ row=Object.assign({},row,{kode:String(row.kode||'').trim().toLowerCase()}); if(!validKode(row.kode)) throw new Error(translateErr('schools_kode_chk'));
    return this._q(this.sb.from('schools').insert(row).select().single()); }
  async updateSchool(id,patch){ patch=Object.assign({},patch); delete patch.kode; return this._q(this.sb.from('schools').update(patch).eq('id',id).select().single()); }
  async deleteSchool(id,konfirmasi){ return this._post('/api/admin',{action:'deleteSchool',school_id:id,konfirmasi}); }
  async addAnggota(rows){ return this._q(this.sb.from('anggota').insert(rows.map(r=>Object.assign({},r,{school_id:this.sid}))).select()); }
  async updateAnggota(id,patch){ return this._q(this.sb.from('anggota').update(patch).eq('id',id).select().single()); }
  async deleteAnggota(id){ await this._q(this.sb.from('anggota').delete().eq('id',id)); }
  async addItems(rows){ return this._q(this.sb.from('items').insert(rows.map(r=>Object.assign({},r,{school_id:this.sid}))).select()); }
  async updateItem(id,patch){ patch=Object.assign({},patch); delete patch.school_id; delete patch.id; return this._q(this.sb.from('items').update(patch).eq('id',id).select().single()); }
  async deleteItem(id){ await this._q(this.sb.from('items').delete().eq('id',id)); }
  async uploadFoto(path,blob,contentType){
    await this._q(this.sb.storage.from('foto-alat').upload(path,blob,{upsert:true,contentType:contentType||blob.type,cacheControl:'31536000'}));
    return this.sb.storage.from('foto-alat').getPublicUrl(path).data.publicUrl;
  }
  async setujui(id){ return this._q(this.sb.rpc('setujui_pinjam',{p_loan:id})); }
  async tolak(id,alasan){ return this._q(this.sb.rpc('tolak_pinjam',{p_loan:id,p_alasan:alasan||''})); }
  async pinjamkan(anggotaId,itemIds,catatan){ return this._q(this.sb.rpc('admin_pinjamkan',{p_anggota:anggotaId,p_items:itemIds,p_catatan:catatan||''})); }
  async kembali(id,kondisi){ return this._q(this.sb.rpc('konfirmasi_kembali',{p_loan:id,p_kondisi:kondisi||'Baik'})); }
  async listUsers(schoolId){ return (await this._post('/api/admin',{action:'list',school_id:schoolId})).users; }
  async createUser(b){ return (await this._post('/api/admin',Object.assign({action:'create'},b,b.role==='superadmin'?{}:{school_id:b.school_id||this.sid}))).profile; }
  async updateUser(b){ return (await this._post('/api/admin',Object.assign({action:'update'},b))).profile; }
  async deleteUser(id){ await this._post('/api/admin',{action:'delete',id}); }
  async ai3dStart(id,ulang){ return this._post('/api/ai3d',{action:'start',item_id:id,ulang:!!ulang}); }
  async ai3dStatus(id){ return this._post('/api/ai3d',{action:'status',item_id:id}); }
  subscribe(cb){
    try{ const ch=this.sb.channel('sipinlab-live');
      ['items','loans'].forEach(t=>ch.on('postgres_changes',{event:'*',schema:'public',table:t},p=>{ const r=(p&&(p.new||p.old))||{}; if(!r.school_id||r.school_id===this.sid) cb(t); }));
      ch.subscribe(); }catch(e){ console.warn('realtime tidak aktif',e); }
  }
  /* portal siswa */
  async portalMasuk(kode,ident,nama){ return this._q(this.sb.rpc('portal_masuk',{p_kode:kode,p_ident:ident,p_nama:nama})); }
  async portalAjukan(kode,ident,nama,itemIds,catatan){ return this._q(this.sb.rpc('portal_ajukan',{p_kode:kode,p_ident:ident,p_nama:nama,p_items:itemIds,p_catatan:catatan||''})); }
  async portalBatal(kode,ident,nama,loanId){ return this._q(this.sb.rpc('portal_batal',{p_kode:kode,p_ident:ident,p_nama:nama,p_loan:loanId})); }
}

async function createAPI(){
  let cfg=null;
  try{ const r=await fetch('/api/config',{cache:'no-store'}); if(r.ok&&/json/.test(r.headers.get('content-type')||'')) cfg=await r.json(); }catch(e){}
  if(cfg&&cfg.configured){ const a=new SupaAPI(cfg); await a.init(); a.cfgInfo=cfg; return a; }
  const d=new DemoAPI(); d.cfgMissing=!!cfg; return d.init();
}
