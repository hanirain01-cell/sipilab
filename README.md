# SiPinLab v6 – Peminjaman Alat Lab (alur pengajuan & persetujuan)

Versi ini memakai tampilan biru seperti v5 (menu samping, kartu statistik), tetapi **tanpa scan barcode**, dan alur peminjaman lewat **pengajuan siswa → persetujuan kepala lab**. Setiap alat tetap punya **tampilan 3D**.

## Alur peminjaman

| Langkah | Siapa | Di mana |
|---|---|---|
| 1. Mendaftarkan siswa sebagai **anggota** (hanya anggota yang bisa meminjam) | Kepala lab | Halaman kepala lab → **Anggota → Tambah anggota** |
| 2. Membuka link siswa, masuk dengan **kode anggota / NIS + nama**, memilih alat (lihat 3D), lalu **Ajukan peminjaman** | Siswa | Link siswa `https://aplikasi-anda.vercel.app/<kode-sekolah>` |
| 3. Pengajuan langsung muncul di **Peminjaman → Menunggu persetujuan**. Kepala lab **Setujui** lalu menyerahkan alat (atau **Tolak** + alasan) | Kepala lab | Halaman kepala lab |
| 4. Siswa mengembalikan alat langsung ke kepala lab, lalu kepala lab menekan **Terima kembali** dan memilih kondisinya | Kepala lab | **Peminjaman → Sedang dipinjam** |
| Jika siswa tidak bisa mengajukan sendiri, kepala lab menekan **Buat peminjaman** dan memilih anggota + alat | Kepala lab | **Peminjaman → Buat peminjaman** |

Siswa melihat status pengajuannya di tab **Pinjamanku** (Menunggu, Dipinjam, Selesai, Ditolak), yang diperbarui otomatis. Pengajuan yang masih menunggu bisa dibatalkan siswa.

Jika satu unit alat diajukan beberapa siswa sekaligus, setelah kepala lab menyetujui salah satunya, pengajuan lain untuk unit itu otomatis ditolak.

## Halaman

**Halaman siswa** (`/<kode-sekolah>`), tanpa akun:
- Masuk dengan kode anggota (contoh `AGT-0001`, cukup ketik `1`) **atau NIS**, ditambah **nama** (cukup nama depan). Nama dicocokkan agar orang lain tidak bisa memakai kode temannya.
- Katalog alat dikelompokkan per nama (contoh "Jangka Sorong · 3 tersedia"). Ketuk alat untuk memutar tampilan 3D, pilih jumlah, lalu ajukan beserta keperluannya.

**Halaman kepala lab** (`/<kode-sekolah>/admin`):
- **Peminjaman**: pengajuan masuk, alat yang sedang dipinjam, link siswa (tombol Salin).
- **Alat**: daftar alat dengan gambar 3D. **Tambah alat** ada di halaman terpisah, dengan pratinjau 3D langsung saat mengetik nama atau mengunggah foto. Klik alat untuk melihat 3D, mengubah data, mengganti foto, menandai "sudah diperbaiki", dan melihat riwayat.
- **Anggota**: daftar anggota. **Tambah anggota** ada di halaman terpisah: satu per satu, atau banyak sekaligus dengan menempel dari Excel (`Nama; Kelas; NIS`).
- **Riwayat**: semua pengajuan & peminjaman, unduh CSV.
- **Pengaturan**: link siswa & link kepala lab, nama/logo/warna sekolah, ganti password.

**Super Admin** (`/admin` → "Masuk sebagai Super Admin"): menambah sekolah beserta akun kepala lab, menonaktifkan/menghapus sekolah, reset password kepala lab, mengizinkan 3D AI.

## Visual 3D alat
Sama seperti v5, dengan urutan otomatis: **Model 3D AI** (opsional, Meshy) → **3D dari foto** (latar foto dihapus otomatis, diberi volume) → **model bawaan dari nama** (multimeter, dongkrak, jangka sorong, mikroskop, kipas, proyektor, dan lainnya). Tampilan bisa diganti per alat lewat **Ubah → Tampilan 3D**.

Tips foto: satu alat utuh, cahaya terang, latar polos yang kontras.

Denah lab 3D & editor tata letak dari v5 **tidak dipakai lagi** agar aplikasi lebih ringkas.

## Pemasangan (tanpa pengaturan di Vercel)
Koneksi ke Supabase cukup diatur **di aplikasinya sendiri**. Hanya butuh **Project URL** dan **anon key**; `service_role key` dan Environment Variables Vercel **tidak diperlukan lagi**.

1. **Supabase**: https://supabase.com → **New project** (region Singapore) → **SQL Editor → New query** → tempel isi `supabase/schema.sql` → **Run**. Lalu (opsional) jalankan `supabase/data-contoh.sql` dengan cara yang sama.
2. **Ambil kunci**: **Project Settings → API Keys** → salin **Project URL** dan **anon key** (tab *Legacy API keys*). Jika tidak ada, pakai *publishable key*. Jangan pakai service_role / secret key.
3. **Hubungkan**, pilih salah satu:
   - **Dari aplikasi**: buka halaman kepala lab → klik **🔌 Hubungkan ke Supabase** → tempel URL & anon key → **Tes & hubungkan** → klik **Unduh config.js**.
   - **Atau edit langsung** file `js/config.js` (buka dengan Notepad) dan isi `url` dan `anonKey`.
4. **Pastikan `js/config.js` yang sudah terisi ikut diunggah** ke hosting (Vercel/GitHub/Netlify). Tanpa langkah ini, hanya browser Anda yang terhubung, sedangkan HP siswa masih Mode demo.
5. Buka halaman kepala lab → muncul **Buat akun Super Admin** → isi. Lalu **Kelola Sekolah** → pilih sekolah → **Ubah** → *Akun kepala lab* → **Tambah**.

Link yang dibagikan:
- Di Vercel: siswa `https://app-anda.vercel.app/<kode-sekolah>`, kepala lab `https://app-anda.vercel.app/<kode-sekolah>/admin`.
- Di hosting lain: siswa `.../pinjam.html?s=<kode-sekolah>`, kepala lab `.../index.html?s=<kode-sekolah>`.

### Upgrade dari v5
Jalankan ulang `supabase/schema.sql` (data lama aman), lalu ganti semua file aplikasi dengan isi folder ini (hapus `js/app.js`, `js/barcode.js`, `css/app.css` lama). Jika dulu memakai Environment Variables di Vercel, itu tetap berfungsi; `js/config.js` yang terisi akan dipakai lebih dulu.

### Model 3D AI (opsional)
Fitur Meshy AI tetap butuh server Vercel dengan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `MESHY_API_KEY`. Tanpa itu, visual 3D dari foto dan model bawaan tetap berjalan.

### Isi data contoh (alat + anggota)
Setelah `schema.sql`, jalankan juga `supabase/data-contoh.sql` di SQL Editor. File ini mengisi **70 unit alat** (26 jenis, masing-masing dengan model 3D) dan **36 anggota** (32 siswa + guru/laboran) ke sekolah berkode `smk-contoh`. Ganti kode di baris `v_kode` (dan di query paling bawah) dengan kode sekolah Anda. Jika sekolahnya belum ada, file ini membuatnya; akun kepala lab lalu dibuat dari menu Super Admin. Aman dijalankan ulang (tidak dobel).

## Mode demo (tanpa server)
Jika Supabase belum diatur, aplikasi berjalan dengan data contoh di browser. Cukup klik dua kali `index.html` (kepala lab) atau `pinjam.html` (siswa), atau jalankan server lokal:
```
python -m http.server 8000
```
- Kepala lab: http://localhost:8000/index.html?s=demo → `admin` / `admin123`
- Siswa: http://localhost:8000/pinjam.html?s=demo → kode `1`, nama `andi` (atau kode `3`, nama `citra`)
- Super Admin: `super` / `super123`

Buka keduanya di tab berbeda pada browser yang sama: pengajuan siswa langsung muncul di halaman kepala lab.

## Keamanan
- Siswa tidak bisa membaca tabel database secara langsung. Halaman siswa hanya memanggil fungsi `portal_masuk`, `portal_ajukan`, dan `portal_batal`, yang memeriksa kode/NIS + nama dan hanya mengembalikan daftar alat serta pinjaman milik siswa itu sendiri.
- Menyetujui, menolak, membuat peminjaman, dan mengonfirmasi pengembalian hanya bisa dilakukan akun kepala lab (admin) di sekolahnya sendiri. Aturan ini ditegakkan oleh database.
- Batas: maksimal 10 alat per pengajuan dan 15 pengajuan menunggu per siswa.
- Akun login dibuat oleh fungsi database (`setup_super`, `buat_akun`, `ubah_akun`, `hapus_akun`) yang memeriksa hak akses pemanggil. Aplikasi hanya memakai anon key yang memang aman untuk publik; service_role key tidak pernah dibutuhkan.

## Struktur folder
```
index.html            halaman kepala lab & super admin
pinjam.html           halaman siswa
css/style.css         tampilan
js/core.js            fungsi bersama + visual 3D alat
js/admin.js           logika halaman kepala lab
js/siswa.js           logika halaman siswa
js/config.js          PENGATURAN SUPABASE (url + anon key)
js/api.js             koneksi data (Supabase / demo)
js/g3.js              mesin 3D & model alat bawaan
api/config.js         (Vercel) konfigurasi publik
api/admin.js          (Vercel) kelola akun & hapus sekolah
api/ai3d.js           (Vercel) foto → model 3D AI (opsional)
supabase/schema.sql   tabel, RLS, fungsi pengajuan/persetujuan
vercel.json           link /<kode> (siswa) dan /<kode>/admin (kepala lab)
```
