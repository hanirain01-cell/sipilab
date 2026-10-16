-- =====================================================================
--  SiPinLab v6 – DATA CONTOH: alat lab + anggota
--
--  Cara pakai (Supabase → SQL Editor → New query → tempel → Run):
--   1. Jalankan schema.sql lebih dulu.
--   2. Ubah KODE dan NAMA sekolah di bawah (baris "v_kode" dan "v_nama").
--      • Jika sekolah dengan kode itu SUDAH ADA (dibuat dari menu Kelola
--        Sekolah), data ditambahkan ke sekolah tersebut.
--      • Jika BELUM ADA, sekolah baru dibuat otomatis. Akun kepala lab-nya
--        lalu dibuat dari aplikasi: login Super Admin → Kelola Sekolah →
--        Ubah → "Akun kepala lab" → Tambah.
--   3. Aman dijalankan ulang: alat/anggota yang namanya sudah ada di
--      sekolah itu dilewati (tidak dobel).
--
--  Isi: 26 jenis alat (70 unit) dan 36 anggota (32 siswa + 4 guru/laboran).
--  Kode alat (ALT-xxxx) dan kode anggota (AGT-xxxx) dibuat otomatis.
-- =====================================================================
do $$
declare
  v_kode  text := 'smk-contoh';            -- <<< ganti dengan kode sekolah Anda
  v_nama  text := 'SMK Negeri Contoh';     -- <<< dipakai hanya jika sekolah belum ada
  sid uuid; r record; k int; n_alat int := 0; n_agt int := 0;
begin
  select id into sid from public.schools where kode = lower(trim(v_kode));
  if sid is null then
    insert into public.schools (kode, nama, warna, warna2, logo)
    values (lower(trim(v_kode)), v_nama, '#2563eb', '#0b1f4d', '🔧') returning id into sid;
    raise notice 'Sekolah baru dibuat: % (%)', v_nama, v_kode;
  end if;

  -- ------------------------------------------------------------- ALAT
  -- nama, kategori, lokasi simpan, keterangan, model 3D bawaan, jumlah unit
  for r in select * from (values
    ('Engine Stand Trainer Mesin Bensin', 'Otomotif',     'Area praktik A',     'Trainer mesin 4 tak lengkap dengan dudukan. Wajib didampingi guru.', 'engine',     2),
    ('Dongkrak Buaya 3 Ton',             'Chassis',      'Area angkat',        'Kapasitas 3 ton. Pasang di titik angkat kendaraan.',                 'jack',       3),
    ('Jack Stand 3 Ton (sepasang)',      'Chassis',      'Area angkat',        'Selalu dipakai setelah kendaraan didongkrak.',                       'jackstand',  4),
    ('Kunci Momen 1/2 inci',             'Perkakas',     'Lemari B-2',         'Rentang 40–210 Nm. Kembalikan ke posisi skala terendah.',            'torque',     3),
    ('Impact Wrench Pneumatik',          'Perkakas',     'Lemari B-3',         'Membutuhkan kompresor. Gunakan kacamata pelindung.',                 'impact',     2),
    ('Kompresor Udara 1 HP',             'Perkakas',     'Ruang kompresor',    'Tangki 50 liter.',                                                   'compressor', 1),
    ('Troli Perkakas 7 Laci',            'Perkakas',     'Area praktik B',     'Berisi kunci, obeng, dan tang lengkap. Cek isi saat mengembalikan.', 'toolbox',    2),
    ('Ban dan Velg Ring 14',             'Chassis',      'Rak ban',            'Untuk praktik bongkar pasang & balancing.',                          'wheel',      4),
    ('Aki 12V 45Ah',                     'Kelistrikan',  'Rak aki',            'Simpan dalam keadaan terisi. Hati-hati air aki.',                    'battery',    3),
    ('Scanner OBD-II',                   'Kelistrikan',  'Lemari A-1',         'Membaca kode kerusakan (DTC) mobil injeksi.',                        'obd',        2),
    ('Set Busi dan Kunci Busi',          'Otomotif',     'Lemari A-2',         'Berisi 4 busi, kunci busi 16 & 21 mm, dan feeler gauge.',            'sparkplug',  3),
    ('Multimeter Digital',               'Kelistrikan',  'Lemari A-1',         'Untuk mengukur tegangan, arus, dan hambatan.',                       'multimeter', 6),
    ('Jangka Sorong 150 mm',             'Alat ukur',    'Lemari A-3',         'Ketelitian 0,05 mm. Simpan di kotaknya.',                            'caliper',    6),
    ('Mikrometer Sekrup 0–25 mm',        'Alat ukur',    'Lemari A-3',         'Ketelitian 0,01 mm.',                                                'caliper',    3),
    ('Set Kunci Kombinasi 8–24 mm',      'Perkakas',     'Lemari B-1',         '14 pcs kunci ring-pas.',                                             'wrenchset',  4),
    ('Mikroskop Binokuler',              'Lab IPA',      'Lemari kaca 1',      'Perbesaran 40×–1000×. Bawa dengan dua tangan.',                     'microscope', 3),
    ('Gelas Kimia 250 ml',               'Lab IPA',      'Lemari kaca 2',      'Satu set berisi 6 gelas kimia.',                                     'beaker',     2),
    ('Erlenmeyer 100 ml',                'Lab IPA',      'Lemari kaca 2',      'Satu set berisi 6 labu erlenmeyer.',                                 'beaker',     2),
    ('Neraca Ohaus 311 g',               'Lab IPA',      'Meja timbang',       'Kalibrasi ke nol sebelum dipakai.',                                  'balance',    2),
    ('Model Torso Manusia',              'Lab IPA',      'Lemari peraga',      'Organ bisa dilepas-pasang.',                                         'torso',      1),
    ('Proyektor',                        'Multimedia',   'Lemari guru',        'Termasuk kabel HDMI dan remote.',                                    'projector',  2),
    ('Laptop Praktik',                   'Multimedia',   'Lemari guru',        'Termasuk charger. Jangan menyimpan file pribadi.',                   'laptop',     4),
    ('Kipas Angin Berdiri',              'Umum',         'Gudang',             '',                                                                   'fan',        2),
    ('Bola Voli',                        'Olahraga',     'Gudang olahraga',    '',                                                                   'ball',       2),
    ('Kotak P3K',                        'Umum',         'Dinding dekat pintu','Laporkan ke kepala lab jika isinya terpakai.',                       'generic',    1),
    ('Osiloskop Digital 2 Kanal',        'Kelistrikan',  'Lemari A-1',         'Untuk melihat bentuk gelombang sinyal sensor.',                      'multimeter', 1)
  ) as t(nama, kategori, lokasi, deskripsi, model, jumlah) loop
    if not exists (select 1 from public.items where school_id = sid and (nama = r.nama or nama like r.nama || ' #%')) then
      for k in 1..r.jumlah loop
        insert into public.items (school_id, nama, kategori, lokasi, deskripsi, model, status)
        values (sid, case when r.jumlah > 1 then r.nama || ' #' || k else r.nama end, r.kategori, r.lokasi, r.deskripsi, r.model, 'tersedia');
        n_alat := n_alat + 1;
      end loop;
    end if;
  end loop;

  -- ---------------------------------------------------------- ANGGOTA
  -- nama, peran, kelas, NIS/NIP
  for r in select * from (values
    ('Andi Saputra',        'Siswa', 'X TKR 1',   '24001'), ('Bunga Lestari',      'Siswa', 'X TKR 1',   '24002'),
    ('Citra Ayuningtyas',   'Siswa', 'X TKR 1',   '24003'), ('Dimas Pratama',      'Siswa', 'X TKR 1',   '24004'),
    ('Eka Wulandari',       'Siswa', 'X TKR 2',   '24005'), ('Fajar Nugroho',      'Siswa', 'X TKR 2',   '24006'),
    ('Gilang Ramadhan',     'Siswa', 'X TKR 2',   '24007'), ('Hana Safitri',       'Siswa', 'X TKR 2',   '24008'),
    ('Irfan Hakim',         'Siswa', 'XI TKR 1',  '23001'), ('Jihan Aulia',        'Siswa', 'XI TKR 1',  '23002'),
    ('Kevin Saputra',       'Siswa', 'XI TKR 1',  '23003'), ('Lia Maharani',       'Siswa', 'XI TKR 1',  '23004'),
    ('Muhammad Rizky',      'Siswa', 'XI TKR 1',  '23005'), ('Nadia Putri',        'Siswa', 'XI TKR 2',  '23006'),
    ('Oki Setiawan',        'Siswa', 'XI TKR 2',  '23007'), ('Putri Amelia',       'Siswa', 'XI TKR 2',  '23008'),
    ('Rahmat Hidayat',      'Siswa', 'XI TKR 2',  '23009'), ('Siti Rahmawati',     'Siswa', 'XI TKR 2',  '23010'),
    ('Taufik Ismail',       'Siswa', 'XII TKR 1', '22001'), ('Umi Kalsum',         'Siswa', 'XII TKR 1', '22002'),
    ('Vino Alfarizi',       'Siswa', 'XII TKR 1', '22003'), ('Wahyu Setiadi',      'Siswa', 'XII TKR 1', '22004'),
    ('Yoga Pratama',        'Siswa', 'XII TKR 1', '22005'), ('Zahra Nabila',       'Siswa', 'XII TKR 2', '22006'),
    ('Agus Salim',          'Siswa', 'XII TKR 2', '22007'), ('Bayu Anggara',       'Siswa', 'XII TKR 2', '22008'),
    ('Dewi Kartika',        'Siswa', 'XII TKR 2', '22009'), ('Erlangga Putra',     'Siswa', 'XII TKR 2', '22010'),
    ('Farhan Maulana',      'Siswa', 'XI TKJ 1',  '23101'), ('Gita Permata',       'Siswa', 'XI TKJ 1',  '23102'),
    ('Hendra Wijaya',       'Siswa', 'XI TKJ 1',  '23103'), ('Intan Permatasari',  'Siswa', 'XI TKJ 1',  '23104'),
    ('Pak Budi Santoso',    'Guru',    'Guru Produktif TKR', '197805122005011002'),
    ('Bu Sri Wahyuni',      'Guru',    'Guru IPA',           '198203142008012004'),
    ('Pak Joko Susilo',     'Guru',    'Guru Kelistrikan',   '198511202010011007'),
    ('Mas Rudi Hartanto',   'Laboran', 'Laboran Bengkel',    '')
  ) as t(nama, peran, kelas, nis) loop
    if not exists (select 1 from public.anggota where school_id = sid and lower(nama) = lower(r.nama)) then
      insert into public.anggota (school_id, nama, peran, kelas, nis) values (sid, r.nama, r.peran, r.kelas, r.nis);
      n_agt := n_agt + 1;
    end if;
  end loop;

  raise notice 'Selesai: % unit alat dan % anggota ditambahkan ke sekolah %.', n_alat, n_agt, v_kode;
end $$;

-- Lihat hasilnya (kode anggota untuk dibagikan ke siswa):
select a.id as kode_anggota, a.nama, a.kelas, a.nis
  from public.anggota a join public.schools s on s.id = a.school_id
 where s.kode = 'smk-contoh'          -- <<< samakan dengan kode di atas
 order by a.id;
