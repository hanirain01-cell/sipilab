-- =====================================================================
--  SiPinLab v6 – Skema database (alur pengajuan siswa → persetujuan kepala lab)
--  Satu database untuk banyak sekolah. Setiap baris data punya school_id,
--  dan Row Level Security memastikan tiap sekolah hanya melihat datanya sendiri.
--
--  Cara pakai: Supabase → SQL Editor → New query → tempel SELURUH isi file
--  ini → Run. Aman dijalankan ulang, dan juga meng-upgrade database v3
--  (data lama dipindahkan ke sekolah pertama). Database v5 juga di-upgrade
--  otomatis ke v6 tanpa kehilangan data.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- SEKOLAH (tenant) ----------
create table if not exists public.schools (
  id          uuid primary key default gen_random_uuid(),
  kode        text not null unique,
  nama        text not null,
  warna       text not null default '#2563eb',
  warna2      text not null default '#0b1f4d',
  logo        text not null default '🔬',
  alamat      text not null default '',
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.schools drop constraint if exists schools_kode_chk;
alter table public.schools add constraint schools_kode_chk
  check (kode ~ '^[a-z0-9][a-z0-9-]{1,29}$' and kode not in ('api','css','js','admin','super','superadmin','login','index','assets','static'));
alter table public.schools drop constraint if exists schools_warna_chk;
alter table public.schools add constraint schools_warna_chk check (warna ~ '^#[0-9a-fA-F]{6}$' and warna2 ~ '^#[0-9a-fA-F]{6}$');

-- ---------- TABEL DATA ----------
create table if not exists public.labs (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  gaya text not null default 'lab' check (gaya in ('oto','lab','kom')),
  lebar real not null default 14 check (lebar between 4 and 60),
  panjang real not null default 10 check (panjang between 4 and 60),
  urutan int not null default 0,
  created_at timestamptz not null default now()
);
create sequence if not exists public.anggota_seq;
create table if not exists public.anggota (
  id text primary key default ('AGT-' || lpad(nextval('public.anggota_seq')::text, 4, '0')),
  nama text not null, peran text not null default 'Siswa', kelas text not null default '', nis text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  nama text not null default '',
  role text not null default 'anggota',
  menus text[] not null default '{beranda,lab3d}',
  anggota_id text references public.anggota (id) on delete set null,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
create sequence if not exists public.item_seq;
create table if not exists public.items (
  id text primary key default ('ALT-' || lpad(nextval('public.item_seq')::text, 4, '0')),
  nama text not null, kategori text not null default '',
  lab_id uuid references public.labs (id) on delete set null,
  lokasi text not null default '',
  status text not null default 'tersedia' check (status in ('tersedia','dipinjam','rusak')),
  model text not null default '', foto_url text, foto3d_url text,
  tinggi_cm int not null default 50 check (tinggi_cm between 1 and 600),
  pos_x real, pos_z real, rot real not null default 0,
  skala real not null default 1 check (skala between 0.2 and 5),
  ditempatkan boolean not null default false,
  pemakai_terakhir text, pemakai_nama text, waktu_terakhir timestamptz,
  created_at timestamptz not null default now()
);
-- kolom visual 3D (v5): model 3D realistis hasil AI
alter table public.items add column if not exists model3d_url   text;
alter table public.items add column if not exists ai3d_task     text;
alter table public.items add column if not exists ai3d_status   text not null default '';
alter table public.items add column if not exists ai3d_progress int  not null default 0;
alter table public.items add column if not exists ai3d_error    text;
alter table public.schools add column if not exists ai3d boolean not null default false;  -- izin 3D AI (berbayar) per sekolah

create table if not exists public.furniture (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs (id) on delete cascade,
  jenis text not null, x real not null default 0, z real not null default 0, rot real not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.loans (
  id bigint generated always as identity primary key,
  anggota_id text not null, anggota_nama text not null, item_id text not null, item_nama text not null,
  pinjam timestamptz not null default now(), kembali timestamptz, kondisi text not null default '', petugas uuid
);

-- ---------- kolom school_id di semua tabel ----------
alter table public.labs      add column if not exists school_id uuid references public.schools (id) on delete cascade;
alter table public.anggota   add column if not exists school_id uuid references public.schools (id) on delete cascade;
alter table public.profiles  add column if not exists school_id uuid references public.schools (id) on delete cascade;
alter table public.items     add column if not exists school_id uuid references public.schools (id) on delete cascade;
alter table public.furniture add column if not exists school_id uuid references public.schools (id) on delete cascade;
alter table public.loans     add column if not exists school_id uuid references public.schools (id) on delete cascade;

-- ---------- MIGRASI dari v3 (satu sekolah) ----------
do $$
declare sid uuid; nama_lama text := 'Sekolah Utama';
begin
  if exists (select 1 from public.labs where school_id is null) or exists (select 1 from public.anggota where school_id is null)
     or exists (select 1 from public.items where school_id is null) or exists (select 1 from public.loans where school_id is null)
     or exists (select 1 from public.profiles where school_id is null and role <> 'superadmin') then
    if to_regclass('public.settings') is not null then
      execute 'select school from public.settings where id = 1' into nama_lama;
    end if;
    select id into sid from public.schools order by created_at limit 1;
    if sid is null then
      insert into public.schools (kode, nama) values ('sekolah-1', coalesce(nama_lama, 'Sekolah Utama')) returning id into sid;
    end if;
    update public.labs      set school_id = sid where school_id is null;
    update public.anggota   set school_id = sid where school_id is null;
    update public.items     set school_id = sid where school_id is null;
    update public.furniture f set school_id = coalesce((select l.school_id from public.labs l where l.id = f.lab_id), sid) where school_id is null;
    update public.loans     set school_id = sid where school_id is null;
    update public.profiles  set school_id = sid where school_id is null and role <> 'superadmin';
  end if;
end $$;
drop table if exists public.settings;
alter table public.labs      alter column school_id set not null;
alter table public.anggota   alter column school_id set not null;
alter table public.items     alter column school_id set not null;
alter table public.furniture alter column school_id set not null;
alter table public.loans     alter column school_id set not null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_role_chk;
alter table public.profiles add constraint profiles_role_chk check (role in ('superadmin','admin','staf','anggota'));
alter table public.profiles drop constraint if exists profiles_school_chk;
alter table public.profiles add constraint profiles_school_chk check ((role = 'superadmin') = (school_id is null));
alter table public.profiles drop constraint if exists profiles_username_key;
create unique index if not exists profiles_username_uq on public.profiles (coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid), username);

create index if not exists labs_school_idx      on public.labs (school_id);
create index if not exists anggota_school_idx   on public.anggota (school_id);
create index if not exists items_school_idx     on public.items (school_id);
create index if not exists items_lab_idx        on public.items (lab_id);
create index if not exists furniture_lab_idx    on public.furniture (lab_id);
create index if not exists loans_school_idx     on public.loans (school_id, pinjam);
create index if not exists loans_open_idx       on public.loans (item_id) where kembali is null;

-- =====================================================================
--  FUNGSI HAK AKSES
-- =====================================================================
create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and aktif and role = 'superadmin');
$$;
-- sekolah milik pengguna yang login (null jika akun/sekolah nonaktif)
create or replace function public.my_school() returns uuid
language sql stable security definer set search_path = public as $$
  select p.school_id from public.profiles p join public.schools s on s.id = p.school_id
   where p.id = auth.uid() and p.aktif and s.aktif;
$$;
create or replace function public.in_school(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super() or (sid is not null and sid = public.my_school());
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super() or exists (select 1 from public.profiles p join public.schools s on s.id = p.school_id
                                       where p.id = auth.uid() and p.aktif and s.aktif and p.role = 'admin');
$$;
create or replace function public.can(menu text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super() or exists (select 1 from public.profiles p join public.schools s on s.id = p.school_id
                                       where p.id = auth.uid() and p.aktif and s.aktif and (p.role = 'admin' or menu = any (p.menus)));
$$;

-- isi school_id otomatis (pengguna sekolah) ----------
alter table public.labs      alter column school_id set default public.my_school();
alter table public.anggota   alter column school_id set default public.my_school();
alter table public.items     alter column school_id set default public.my_school();
alter table public.furniture alter column school_id set default public.my_school();
alter table public.loans     alter column school_id set default public.my_school();

-- untuk halaman login (tanpa login): tampilan sekolah dari kode
create or replace function public.info_sekolah(p_kode text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'kode', kode, 'nama', nama, 'warna', warna, 'warna2', warna2, 'logo', logo, 'aktif', aktif)
    from public.schools where kode = lower(trim(p_kode));
$$;
create or replace function public.ada_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where role = 'superadmin');
$$;
drop function if exists public.ada_admin();

-- =====================================================================
--  v6: ALUR PENGAJUAN → PERSETUJUAN
--  status peminjaman:
--    menunggu  = siswa mengajukan lewat link siswa, belum disetujui
--    dipinjam  = disetujui kepala lab & alat sudah diserahkan
--    kembali   = alat sudah dikembalikan (dikonfirmasi kepala lab)
--    ditolak   = pengajuan ditolak kepala lab
--    batal     = pengajuan dibatalkan siswa sebelum disetujui
-- =====================================================================
alter table public.loans alter column pinjam drop not null;
alter table public.loans add column if not exists status    text;
alter table public.loans add column if not exists diajukan  timestamptz;
alter table public.loans add column if not exists catatan   text not null default '';
alter table public.loans add column if not exists alasan    text not null default '';
alter table public.loans add column if not exists sumber    text not null default 'admin';
update public.loans set diajukan = coalesce(diajukan, pinjam, now()) where diajukan is null;
update public.loans set status = case when kembali is not null then 'kembali' else 'dipinjam' end where status is null;
alter table public.loans alter column diajukan set default now();
alter table public.loans alter column diajukan set not null;
alter table public.loans alter column status set default 'menunggu';
alter table public.loans alter column status set not null;
alter table public.loans drop constraint if exists loans_status_chk;
alter table public.loans add constraint loans_status_chk check (status in ('menunggu','dipinjam','kembali','ditolak','batal'));
create index if not exists loans_status_idx on public.loans (school_id, status);
create index if not exists loans_anggota_idx on public.loans (anggota_id, diajukan);

alter table public.items add column if not exists deskripsi text not null default '';

-- =====================================================================
--  TRANSAKSI (khusus Admin / Kepala Lab)
-- =====================================================================
drop function if exists public.pinjam_alat(text, text);
drop function if exists public.kembalikan_alat(text, text);

-- serahkan alat ke peminjam (dipakai saat menyetujui & saat admin membuat peminjaman langsung)
create or replace function public._serahkan(p_loan bigint) returns public.loans
language plpgsql security definer set search_path = public as $$
declare l public.loans; i public.items;
begin
  select * into l from public.loans where id = p_loan for update;
  select * into i from public.items where id = l.item_id for update;
  if not found then raise exception 'Alat % sudah tidak terdaftar', l.item_nama; end if;
  if i.status = 'dipinjam' then raise exception 'Alat % sedang dipinjam orang lain', i.nama; end if;
  if i.status = 'rusak'    then raise exception 'Alat % berstatus rusak', i.nama; end if;
  update public.loans set status = 'dipinjam', pinjam = now(), petugas = auth.uid() where id = l.id returning * into l;
  update public.items set status = 'dipinjam', pemakai_terakhir = l.anggota_id, pemakai_nama = l.anggota_nama, waktu_terakhir = now() where id = i.id;
  -- pengajuan lain untuk unit yang sama otomatis ditolak
  update public.loans set status = 'ditolak', alasan = 'Alat sudah dipinjam peminjam lain'
   where item_id = i.id and status = 'menunggu' and id <> l.id;
  return l;
end $$;
revoke execute on function public._serahkan(bigint) from public, anon, authenticated;

create or replace function public.setujui_pinjam(p_loan bigint) returns json
language plpgsql security definer set search_path = public as $$
declare l public.loans;
begin
  select * into l from public.loans where id = p_loan;
  if not found or not public.is_admin() or not public.in_school(l.school_id) then raise exception 'Pengajuan tidak ditemukan'; end if;
  if l.status <> 'menunggu' then raise exception 'Pengajuan ini sudah diproses'; end if;
  return row_to_json(public._serahkan(l.id));
end $$;

create or replace function public.tolak_pinjam(p_loan bigint, p_alasan text default '') returns json
language plpgsql security definer set search_path = public as $$
declare l public.loans;
begin
  select * into l from public.loans where id = p_loan for update;
  if not found or not public.is_admin() or not public.in_school(l.school_id) then raise exception 'Pengajuan tidak ditemukan'; end if;
  if l.status <> 'menunggu' then raise exception 'Pengajuan ini sudah diproses'; end if;
  update public.loans set status = 'ditolak', alasan = left(coalesce(p_alasan, ''), 300), petugas = auth.uid() where id = l.id returning * into l;
  return row_to_json(l);
end $$;

-- admin membuatkan peminjaman (siswa tidak bisa mengajukan sendiri)
create or replace function public.admin_pinjamkan(p_anggota text, p_items text[], p_catatan text default '') returns json
language plpgsql security definer set search_path = public as $$
declare a public.anggota; i public.items; l public.loans; v text; hasil json[] := '{}';
begin
  if not public.is_admin() then raise exception 'Hanya kepala lab (admin) yang boleh membuat peminjaman'; end if;
  select * into a from public.anggota where id = upper(trim(p_anggota));
  if not found or not public.in_school(a.school_id) then raise exception 'Anggota % tidak terdaftar', p_anggota; end if;
  if coalesce(array_length(p_items, 1), 0) = 0 then raise exception 'Pilih minimal satu alat'; end if;
  foreach v in array p_items loop
    select * into i from public.items where id = upper(trim(v));
    if not found or i.school_id <> a.school_id then raise exception 'Alat % tidak terdaftar', v; end if;
    insert into public.loans (school_id, anggota_id, anggota_nama, item_id, item_nama, status, catatan, sumber, pinjam)
         values (a.school_id, a.id, a.nama, i.id, i.nama, 'menunggu', left(coalesce(p_catatan, ''), 300), 'admin', null) returning * into l;
    l := public._serahkan(l.id);
    hasil := hasil || row_to_json(l);
  end loop;
  return array_to_json(hasil);
end $$;

create or replace function public.konfirmasi_kembali(p_loan bigint, p_kondisi text default 'Baik') returns json
language plpgsql security definer set search_path = public as $$
declare l public.loans; k text := coalesce(nullif(trim(p_kondisi), ''), 'Baik');
begin
  select * into l from public.loans where id = p_loan for update;
  if not found or not public.is_admin() or not public.in_school(l.school_id) then raise exception 'Peminjaman tidak ditemukan'; end if;
  if l.status <> 'dipinjam' then raise exception 'Alat pada peminjaman ini tidak sedang dipinjam'; end if;
  update public.loans set status = 'kembali', kembali = now(), kondisi = k, petugas = auth.uid() where id = l.id returning * into l;
  update public.items set status = case when k = 'Baik' then 'tersedia' else 'rusak' end, waktu_terakhir = now() where id = l.item_id;
  return row_to_json(l);
end $$;

-- =====================================================================
--  PORTAL SISWA (tanpa login) – siswa harus sudah terdaftar sebagai anggota.
--  Identitas: kode anggota ATAU NIS, ditambah nama (cukup nama depan).
-- =====================================================================
create or replace function public._portal_anggota(p_kode text, p_ident text, p_nama text) returns public.anggota
language plpgsql stable security definer set search_path = public as $$
declare s public.schools; a public.anggota; v text := upper(trim(coalesce(p_ident, ''))); n text := lower(trim(coalesce(p_nama, '')));
begin
  select * into s from public.schools where kode = lower(trim(coalesce(p_kode, '')));
  if not found then raise exception 'Sekolah tidak ditemukan. Periksa link dari kepala lab.'; end if;
  if not s.aktif then raise exception 'Layanan peminjaman sekolah ini sedang nonaktif'; end if;
  if v = '' or length(n) < 2 then raise exception 'Isi kode anggota/NIS dan nama kamu'; end if;
  if v ~ '^[0-9]{1,4}$' then v := 'AGT-' || lpad(v, 4, '0'); end if;
  select * into a from public.anggota
   where school_id = s.id and (upper(id) = v or (nis <> '' and upper(nis) = upper(trim(p_ident))))
     and position(n in lower(nama)) > 0
   limit 1;
  if not found then raise exception 'Data tidak cocok. Pastikan kode/NIS dan nama benar, atau minta kepala lab mendaftarkanmu sebagai anggota.'; end if;
  return a;
end $$;
revoke execute on function public._portal_anggota(text, text, text) from public, anon, authenticated;

create or replace function public.portal_masuk(p_kode text, p_ident text, p_nama text) returns json
language plpgsql stable security definer set search_path = public as $$
declare a public.anggota;
begin
  a := public._portal_anggota(p_kode, p_ident, p_nama);
  return json_build_object(
    'anggota', json_build_object('id', a.id, 'nama', a.nama, 'kelas', a.kelas, 'peran', a.peran),
    'items', coalesce((select json_agg(json_build_object('id', i.id, 'nama', i.nama, 'kategori', i.kategori, 'lokasi', i.lokasi,
              'deskripsi', i.deskripsi, 'status', i.status, 'model', i.model, 'foto_url', i.foto_url, 'foto3d_url', i.foto3d_url,
              'model3d_url', i.model3d_url, 'tinggi_cm', i.tinggi_cm) order by i.nama, i.id)
              from public.items i where i.school_id = a.school_id), '[]'::json),
    'loans', coalesce((select json_agg(json_build_object('id', l.id, 'item_id', l.item_id, 'item_nama', l.item_nama, 'status', l.status,
              'diajukan', l.diajukan, 'pinjam', l.pinjam, 'kembali', l.kembali, 'kondisi', l.kondisi, 'alasan', l.alasan, 'catatan', l.catatan) order by l.diajukan desc)
              from (select * from public.loans where anggota_id = a.id and school_id = a.school_id order by diajukan desc limit 40) l), '[]'::json));
end $$;

create or replace function public.portal_ajukan(p_kode text, p_ident text, p_nama text, p_items text[], p_catatan text default '') returns json
language plpgsql security definer set search_path = public as $$
declare a public.anggota; i public.items; v text; n int;
begin
  a := public._portal_anggota(p_kode, p_ident, p_nama);
  n := coalesce(array_length(p_items, 1), 0);
  if n = 0 then raise exception 'Pilih minimal satu alat'; end if;
  if n > 10 then raise exception 'Maksimal 10 alat dalam satu pengajuan'; end if;
  if (select count(*) from public.loans where anggota_id = a.id and status = 'menunggu') + n > 15 then
    raise exception 'Pengajuanmu yang menunggu sudah terlalu banyak. Tunggu kepala lab memprosesnya dulu.'; end if;
  foreach v in array p_items loop
    select * into i from public.items where id = upper(trim(v)) and school_id = a.school_id;
    if not found then raise exception 'Alat % tidak ditemukan', v; end if;
    if i.status <> 'tersedia' then raise exception 'Alat % sedang tidak tersedia', i.nama; end if;
    if exists (select 1 from public.loans where item_id = i.id and anggota_id = a.id and status = 'menunggu') then
      raise exception 'Kamu sudah mengajukan %', i.nama; end if;
    insert into public.loans (school_id, anggota_id, anggota_nama, item_id, item_nama, status, catatan, sumber, pinjam)
         values (a.school_id, a.id, a.nama, i.id, i.nama, 'menunggu', left(coalesce(p_catatan, ''), 300), 'siswa', null);
  end loop;
  return public.portal_masuk(p_kode, p_ident, p_nama);
end $$;

create or replace function public.portal_batal(p_kode text, p_ident text, p_nama text, p_loan bigint) returns json
language plpgsql security definer set search_path = public as $$
declare a public.anggota;
begin
  a := public._portal_anggota(p_kode, p_ident, p_nama);
  update public.loans set status = 'batal' where id = p_loan and anggota_id = a.id and status = 'menunggu';
  if not found then raise exception 'Pengajuan tidak bisa dibatalkan (mungkin sudah diproses)'; end if;
  return public.portal_masuk(p_kode, p_ident, p_nama);
end $$;

-- =====================================================================
--  ROW LEVEL SECURITY (isolasi antar sekolah)
-- =====================================================================
alter table public.schools   enable row level security;
alter table public.labs      enable row level security;
alter table public.anggota   enable row level security;
alter table public.profiles  enable row level security;
alter table public.items     enable row level security;
alter table public.furniture enable row level security;
alter table public.loans     enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
           and tablename in ('schools','labs','anggota','profiles','items','furniture','loans') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy schools_read   on public.schools for select to authenticated using (public.is_super() or id = public.my_school());
create policy schools_insert on public.schools for insert to authenticated with check (public.is_super());
create policy schools_update on public.schools for update to authenticated
  using (public.is_super() or (public.is_admin() and id = public.my_school()))
  with check (public.is_super() or (public.is_admin() and id = public.my_school()));
-- kepala lab boleh mengubah nama/logo/warna sekolahnya, tetapi bukan kode, status aktif, atau izin AI
create or replace function public._lindungi_sekolah() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_super() then
    new.kode := old.kode; new.aktif := old.aktif; new.ai3d := old.ai3d;
  end if;
  return new;
end $$;
drop trigger if exists schools_lindungi on public.schools;
create trigger schools_lindungi before update on public.schools for each row execute function public._lindungi_sekolah();
create policy schools_delete on public.schools for delete to authenticated using (public.is_super());

create policy labs_read   on public.labs for select to authenticated using (public.in_school(school_id));
create policy labs_insert on public.labs for insert to authenticated with check (public.in_school(school_id) and public.can('tataletak'));
create policy labs_update on public.labs for update to authenticated using (public.in_school(school_id) and public.can('tataletak')) with check (public.in_school(school_id));
create policy labs_delete on public.labs for delete to authenticated using (public.in_school(school_id) and public.can('tataletak'));

create policy furn_read   on public.furniture for select to authenticated using (public.in_school(school_id));
create policy furn_insert on public.furniture for insert to authenticated with check (public.in_school(school_id) and public.can('tataletak')
  and exists (select 1 from public.labs l where l.id = lab_id and l.school_id = furniture.school_id));
create policy furn_update on public.furniture for update to authenticated using (public.in_school(school_id) and public.can('tataletak')) with check (public.in_school(school_id));
create policy furn_delete on public.furniture for delete to authenticated using (public.in_school(school_id) and public.can('tataletak'));

create policy anggota_read   on public.anggota for select to authenticated using (public.in_school(school_id));
create policy anggota_insert on public.anggota for insert to authenticated with check (public.in_school(school_id) and public.can('anggota'));
create policy anggota_update on public.anggota for update to authenticated using (public.in_school(school_id) and public.can('anggota')) with check (public.in_school(school_id));
create policy anggota_delete on public.anggota for delete to authenticated using (public.in_school(school_id) and public.can('anggota'));

create policy items_read   on public.items for select to authenticated using (public.in_school(school_id));
create policy items_insert on public.items for insert to authenticated with check (public.in_school(school_id) and public.can('alat'));
create policy items_update on public.items for update to authenticated using (public.in_school(school_id) and (public.can('alat') or public.can('tataletak'))) with check (public.in_school(school_id));
create policy items_delete on public.items for delete to authenticated using (public.in_school(school_id) and public.can('alat'));

create policy loans_read on public.loans for select to authenticated using (public.in_school(school_id));

create policy profiles_read   on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super() or (public.is_admin() and school_id = public.my_school()));
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_super() or (public.is_admin() and school_id = public.my_school() and role <> 'superadmin'))
  with check (public.is_super() or (school_id = public.my_school() and role <> 'superadmin'));

grant usage on sequence public.anggota_seq, public.item_seq to authenticated;
grant execute on function public.info_sekolah(text), public.ada_superadmin() to anon, authenticated;
grant execute on function public.setujui_pinjam(bigint), public.tolak_pinjam(bigint, text), public.admin_pinjamkan(text, text[], text),
  public.konfirmasi_kembali(bigint, text) to authenticated;
grant execute on function public.portal_masuk(text, text, text), public.portal_ajukan(text, text, text, text[], text),
  public.portal_batal(text, text, text, bigint) to anon, authenticated;

-- =====================================================================
--  STORAGE: bucket foto (folder pertama = id sekolah)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('foto-alat', 'foto-alat', true)
on conflict (id) do update set public = true;
drop policy if exists foto_read   on storage.objects;
drop policy if exists foto_insert on storage.objects;
drop policy if exists foto_update on storage.objects;
drop policy if exists foto_delete on storage.objects;
create policy foto_read   on storage.objects for select using (bucket_id = 'foto-alat');
create policy foto_insert on storage.objects for insert to authenticated with check (bucket_id = 'foto-alat'
  and (public.is_super() or (public.can('alat') and (storage.foldername(name))[1] = public.my_school()::text)));
create policy foto_update on storage.objects for update to authenticated using (bucket_id = 'foto-alat'
  and (public.is_super() or (public.can('alat') and (storage.foldername(name))[1] = public.my_school()::text)));
create policy foto_delete on storage.objects for delete to authenticated using (bucket_id = 'foto-alat'
  and (public.is_super() or (public.can('alat') and (storage.foldername(name))[1] = public.my_school()::text)));

-- =====================================================================
--  REALTIME
-- =====================================================================
do $$ begin
  begin alter publication supabase_realtime add table public.items;     exception when others then null; end;
  begin alter publication supabase_realtime add table public.loans;     exception when others then null; end;
  begin alter publication supabase_realtime add table public.furniture; exception when others then null; end;
end $$;

-- =====================================================================
--  AKUN LOGIN TANPA SERVER (v6.1)
--  Akun Super Admin & kepala lab dibuat langsung oleh database, jadi
--  aplikasi cukup memakai URL + anon key (tidak perlu service_role key
--  atau Environment Variables di Vercel).
-- =====================================================================
create or replace function public._domain() returns text language sql immutable as $$ select 'sipinlab.app' $$;

create or replace function public._buat_user(p_email text, p_password text) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_id uuid := gen_random_uuid(); v_email text := lower(trim(p_email));
begin
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password minimal 6 karakter'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'Username sudah dipakai di sekolah ini'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          crypt(p_password, gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_id;
end $$;
revoke execute on function public._buat_user(text, text) from public, anon, authenticated;

-- Super Admin pertama (hanya bisa sekali, saat belum ada Super Admin)
create or replace function public.setup_super(p_username text, p_password text, p_nama text default '') returns json
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(coalesce(p_username, ''))); v_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'superadmin') then raise exception 'Super Admin sudah ada. Silakan login.'; end if;
  if u !~ '^[a-z0-9._-]{3,32}$' then raise exception 'Username 3–32 karakter: huruf kecil, angka, titik, minus, garis bawah'; end if;
  v_id := public._buat_user(u || '@' || public._domain(), p_password);
  insert into public.profiles (id, username, nama, role, school_id, menus, aktif)
  values (v_id, u, coalesce(nullif(trim(p_nama), ''), u), 'superadmin', null, '{beranda,lab3d,scan,anggota,alat,riwayat,tataletak,pengaturan}', true);
  return json_build_object('id', v_id, 'username', u);
end $$;

-- buat akun kepala lab (admin sekolah) atau Super Admin lain
create or replace function public.buat_akun(p_username text, p_password text, p_nama text default '', p_role text default 'admin', p_school uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(coalesce(p_username, ''))); r text := case when p_role = 'superadmin' then 'superadmin' else 'admin' end;
        s public.schools; v_id uuid; p public.profiles;
begin
  if r = 'superadmin' then
    if not public.is_super() then raise exception 'Hanya Super Admin yang boleh membuat akun Super Admin'; end if;
  else
    if p_school is null then raise exception 'Sekolah wajib dipilih'; end if;
    if not (public.is_super() or (public.is_admin() and p_school = public.my_school())) then raise exception 'Anda tidak punya akses untuk tindakan ini'; end if;
    select * into s from public.schools where id = p_school;
    if not found then raise exception 'Sekolah tidak ditemukan'; end if;
  end if;
  if u !~ '^[a-z0-9._-]{3,32}$' then raise exception 'Username 3–32 karakter: huruf kecil, angka, titik, minus, garis bawah'; end if;
  if exists (select 1 from public.profiles where username = u and school_id is not distinct from (case when r = 'superadmin' then null else p_school end)) then
    raise exception 'Username sudah dipakai di sekolah ini'; end if;
  v_id := public._buat_user(case when r = 'superadmin' then u else u || '.' || s.kode end || '@' || public._domain(), p_password);
  insert into public.profiles (id, username, nama, role, school_id, menus, aktif)
  values (v_id, u, coalesce(nullif(trim(p_nama), ''), u), r, case when r = 'superadmin' then null else p_school end,
          '{beranda,lab3d,scan,anggota,alat,riwayat,tataletak,pengaturan}', true) returning * into p;
  return row_to_json(p);
end $$;

create or replace function public._boleh_kelola(t public.profiles) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super() or (public.is_admin() and t.role <> 'superadmin' and t.school_id = public.my_school());
$$;
revoke execute on function public._boleh_kelola(public.profiles) from public, anon, authenticated;

create or replace function public.ubah_akun(p_id uuid, p_password text default null, p_nama text default null, p_aktif boolean default null) returns json
language plpgsql security definer set search_path = public, extensions, auth as $$
declare t public.profiles;
begin
  select * into t from public.profiles where id = p_id;
  if not found or not public._boleh_kelola(t) then raise exception 'Akun tidak ditemukan'; end if;
  if p_aktif = false and p_id = auth.uid() then raise exception 'Tidak bisa menonaktifkan akun sendiri'; end if;
  if coalesce(p_password, '') <> '' then
    if length(p_password) < 6 then raise exception 'Password minimal 6 karakter'; end if;
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_id;
  end if;
  update public.profiles set nama = coalesce(nullif(trim(p_nama), ''), nama), aktif = coalesce(p_aktif, aktif) where id = p_id returning * into t;
  return row_to_json(t);
end $$;

create or replace function public.hapus_akun(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare t public.profiles;
begin
  select * into t from public.profiles where id = p_id;
  if not found or not public._boleh_kelola(t) then raise exception 'Akun tidak ditemukan'; end if;
  if p_id = auth.uid() then raise exception 'Tidak bisa menghapus akun sendiri'; end if;
  delete from auth.users where id = p_id;
end $$;

create or replace function public.hapus_sekolah(p_school uuid, p_konfirmasi text) returns json
language plpgsql security definer set search_path = public, auth as $$
declare s public.schools; n int;
begin
  if not public.is_super() then raise exception 'Hanya Super Admin yang boleh menghapus sekolah'; end if;
  select * into s from public.schools where id = p_school;
  if not found then raise exception 'Sekolah tidak ditemukan'; end if;
  if coalesce(p_konfirmasi, '') <> s.kode then raise exception 'Ketik kode sekolah dengan benar untuk konfirmasi'; end if;
  delete from auth.users where id in (select id from public.profiles where school_id = s.id);
  get diagnostics n = row_count;
  delete from public.schools where id = s.id;
  return json_build_object('ok', true, 'akunDihapus', n);
end $$;

grant execute on function public.setup_super(text, text, text) to anon, authenticated;
grant execute on function public.buat_akun(text, text, text, text, uuid), public.ubah_akun(uuid, text, text, boolean),
  public.hapus_akun(uuid), public.hapus_sekolah(uuid, text) to authenticated;
