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

## Pemasangan / upgrade

### Upgrade dari v5 (database sudah ada)
1. Supabase → **SQL Editor → New query** → tempel **seluruh isi** `supabase/schema.sql` → **Run**. Data lama (sekolah, alat, anggota, riwayat) tetap ada; riwayat lama otomatis diberi status *dipinjam/kembali*.
2. Ganti semua file di GitHub dengan isi folder ini (hapus `js/app.js`, `js/barcode.js`, `css/app.css` yang lama), lalu Vercel akan deploy ulang otomatis.
3. Akun staf/siswa lama tidak dipakai lagi (siswa tidak perlu akun). Akun kepala lab = akun **admin** sekolah yang sudah ada.

### Pemasangan baru
1. https://supabase.com → **New project** (region Singapore) → **SQL Editor** → jalankan `supabase/schema.sql`.
2. **Project Settings → API**: catat Project URL, anon key, service_role key.
3. Unggah folder ini ke GitHub → https://vercel.com → **Add New → Project** → Framework Preset **Other**.
4. **Environment Variables**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `LOGIN_EMAIL_DOMAIN` | *(opsional, default `sipinlab.app`; jangan diubah setelah ada akun)* |
| `MESHY_API_KEY` | *(opsional)* untuk model 3D AI |

5. Deploy → buka `https://aplikasi-anda.vercel.app/admin` → buat akun Super Admin → **Sekolah → Tambah sekolah** (sekaligus membuat akun kepala lab) → kirim link & akun ke kepala lab.

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
- `SUPABASE_SERVICE_ROLE_KEY` hanya ada di server Vercel.

## Struktur folder
```
index.html            halaman kepala lab & super admin
pinjam.html           halaman siswa
css/style.css         tampilan
js/core.js            fungsi bersama + visual 3D alat
js/admin.js           logika halaman kepala lab
js/siswa.js           logika halaman siswa
js/api.js             koneksi data (Supabase / demo)
js/g3.js              mesin 3D & model alat bawaan
api/config.js         (Vercel) konfigurasi publik
api/admin.js          (Vercel) kelola akun & hapus sekolah
api/ai3d.js           (Vercel) foto → model 3D AI (opsional)
supabase/schema.sql   tabel, RLS, fungsi pengajuan/persetujuan
vercel.json           link /<kode> (siswa) dan /<kode>/admin (kepala lab)
```
