// Vercel Serverless Function: manajemen akun multi-sekolah.
// • Super Admin  : kelola semua sekolah & semua akun (termasuk super admin lain), hapus sekolah.
// • Admin sekolah: kelola akun di sekolahnya sendiri saja.
// Memakai SUPABASE_SERVICE_ROLE_KEY yang HANYA ada di server (tidak pernah dikirim ke browser).
const MENUS = ['beranda', 'lab3d', 'scan', 'anggota', 'alat', 'riwayat', 'tataletak', 'pengaturan'];
const ROLES = ['superadmin', 'admin', 'staf', 'anggota'];
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function cfg() {
  return {
    url: (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, ''),
    srk: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    anon: (process.env.SUPABASE_ANON_KEY || '').trim(),
    domain: (process.env.LOGIN_EMAIL_DOMAIN || 'sipinlab.app').trim(),
  };
}
function fail(status, message) { const e = new Error(message); e.status = status; return e; }
const enc = encodeURIComponent;

async function sb(path, { method = 'GET', body, headers = {} } = {}) {
  const { url, srk } = cfg();
  const r = await fetch(url + path, {
    method,
    headers: { apikey: srk, ...(srk.startsWith("sb_") ? {} : { Authorization: `Bearer ${srk}` }), 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    let msg = (data && (data.msg || data.message || data.error_description || data.error)) || `HTTP ${r.status}`;
    if (/already (been )?registered|already exists|duplicate key/i.test(msg)) msg = 'Username sudah dipakai di sekolah ini';
    throw fail(r.status >= 400 && r.status < 500 ? r.status : 502, msg);
  }
  return data;
}

const loginEmail = (username, kode) => (kode ? `${username}.${kode}` : username) + '@' + cfg().domain;
async function superExists() {
  const rows = await sb('/rest/v1/profiles?select=id&role=eq.superadmin&limit=1');
  return Array.isArray(rows) && rows.length > 0;
}
async function getSchool(id) {
  const rows = await sb(`/rest/v1/schools?id=eq.${enc(id)}&select=*`);
  if (!rows || !rows[0]) throw fail(404, 'Sekolah tidak ditemukan');
  return rows[0];
}

async function whoAmI(req) {
  const { url, anon, srk } = cfg();
  const h = req.headers.authorization || req.headers.Authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw fail(401, 'Belum login');
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon || srk, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw fail(401, 'Sesi login tidak valid, silakan login ulang');
  const user = await r.json();
  const rows = await sb(`/rest/v1/profiles?id=eq.${enc(user.id)}&select=*`);
  const me = rows && rows[0];
  if (!me || !me.aktif) throw fail(403, 'Akun tidak aktif');
  if (me.role === 'superadmin') return me;
  if (me.role !== 'admin') throw fail(403, 'Hanya admin yang boleh mengelola akun');
  const s = await getSchool(me.school_id);
  if (!s.aktif) throw fail(403, 'Sekolah Anda sedang dinonaktifkan oleh Super Admin');
  return me;
}
// pastikan "me" berhak mengelola akun target / sekolah target
function scopeCheck(me, schoolId, role) {
  if (me.role === 'superadmin') return;
  if (role === 'superadmin') throw fail(403, 'Hanya Super Admin yang boleh mengelola akun Super Admin');
  if (schoolId !== me.school_id) throw fail(403, 'Anda hanya boleh mengelola akun di sekolah Anda sendiri');
}
const cleanMenus = m => (Array.isArray(m) ? [...new Set(m.filter(x => MENUS.includes(x)))] : ['beranda', 'lab3d']);

async function createUser(b, me) {
  const username = String(b.username || '').trim().toLowerCase();
  const password = String(b.password || '');
  const role = ROLES.includes(b.role) ? b.role : 'anggota';
  const schoolId = role === 'superadmin' ? null : (b.school_id || (me && me.school_id) || null);
  if (me) scopeCheck(me, schoolId, role);
  if (!USERNAME_RE.test(username)) throw fail(400, 'Username 3–32 karakter: huruf kecil, angka, titik, minus, garis bawah');
  if (password.length < 6) throw fail(400, 'Password minimal 6 karakter');
  if (role !== 'superadmin' && !schoolId) throw fail(400, 'Sekolah wajib dipilih');
  const school = schoolId ? await getSchool(schoolId) : null;
  const user = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: { email: loginEmail(username, school && school.kode), password, email_confirm: true, user_metadata: { username, nama: b.nama || username, school: school && school.kode } },
  });
  try {
    const rows = await sb('/rest/v1/profiles', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: {
        id: user.id, username, nama: String(b.nama || username).trim(), role, school_id: schoolId,
        menus: role === 'admin' || role === 'superadmin' ? MENUS : cleanMenus(b.menus),
        anggota_id: role === 'superadmin' ? null : (b.anggota_id || null), aktif: true,
      },
    });
    return rows[0];
  } catch (e) {
    await sb(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE' }).catch(() => {});
    throw e;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  const { url, srk } = cfg();
  if (!url || !srk) return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel' });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  try {
    switch (b.action) {
      case 'status':
        return res.status(200).json({ superExists: await superExists() });

      case 'setup': { // Super Admin pertama
        if (await superExists()) throw fail(409, 'Super Admin sudah ada. Silakan login.');
        return res.status(200).json({ profile: await createUser({ ...b, role: 'superadmin' }, null) });
      }

      case 'list': {
        const me = await whoAmI(req);
        let q = '/rest/v1/profiles?select=*&order=created_at.asc';
        if (me.role === 'superadmin') { if (b.school_id === null) q += '&role=eq.superadmin'; else if (b.school_id) q += `&school_id=eq.${enc(b.school_id)}`; }
        else q += `&school_id=eq.${enc(me.school_id)}`;
        return res.status(200).json({ users: await sb(q) });
      }

      case 'create': {
        const me = await whoAmI(req);
        return res.status(200).json({ profile: await createUser(b, me) });
      }

      case 'update': {
        const me = await whoAmI(req);
        if (!b.id) throw fail(400, 'id akun wajib');
        const rows = await sb(`/rest/v1/profiles?id=eq.${enc(b.id)}&select=*`);
        const target = rows && rows[0];
        if (!target) throw fail(404, 'Akun tidak ditemukan');
        scopeCheck(me, target.school_id, target.role);
        const patch = {};
        if (b.nama !== undefined) patch.nama = String(b.nama).trim();
        if (b.role !== undefined) {
          if (!ROLES.includes(b.role)) throw fail(400, 'Peran tidak valid');
          if ((b.role === 'superadmin') !== (target.role === 'superadmin')) throw fail(400, 'Peran Super Admin tidak bisa diubah menjadi peran sekolah (atau sebaliknya)');
          patch.role = b.role;
        }
        const newRole = patch.role || target.role;
        if (b.menus !== undefined || patch.role) patch.menus = newRole === 'admin' || newRole === 'superadmin' ? MENUS : cleanMenus(b.menus !== undefined ? b.menus : target.menus);
        if (b.anggota_id !== undefined) patch.anggota_id = b.anggota_id || null;
        if (b.aktif !== undefined) patch.aktif = Boolean(b.aktif);
        if (b.id === me.id && ((patch.role && patch.role !== me.role) || patch.aktif === false))
          throw fail(400, 'Tidak bisa menurunkan peran atau menonaktifkan akun Anda sendiri');
        if (b.password !== undefined && b.password !== '') {
          if (String(b.password).length < 6) throw fail(400, 'Password minimal 6 karakter');
          await sb(`/auth/v1/admin/users/${b.id}`, { method: 'PUT', body: { password: String(b.password) } });
        }
        if (patch.aktif !== undefined)
          await sb(`/auth/v1/admin/users/${b.id}`, { method: 'PUT', body: { ban_duration: patch.aktif ? 'none' : '876000h' } });
        let profile = target;
        if (Object.keys(patch).length) {
          const out = await sb(`/rest/v1/profiles?id=eq.${enc(b.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: patch });
          profile = out[0];
        }
        return res.status(200).json({ profile });
      }

      case 'delete': {
        const me = await whoAmI(req);
        if (!b.id) throw fail(400, 'id akun wajib');
        if (b.id === me.id) throw fail(400, 'Tidak bisa menghapus akun Anda sendiri');
        const rows = await sb(`/rest/v1/profiles?id=eq.${enc(b.id)}&select=*`);
        if (!rows || !rows[0]) throw fail(404, 'Akun tidak ditemukan');
        scopeCheck(me, rows[0].school_id, rows[0].role);
        await sb(`/auth/v1/admin/users/${b.id}`, { method: 'DELETE' });
        return res.status(200).json({ ok: true });
      }

      case 'deleteSchool': { // hapus sekolah + semua akun login & datanya (khusus Super Admin)
        const me = await whoAmI(req);
        if (me.role !== 'superadmin') throw fail(403, 'Hanya Super Admin yang boleh menghapus sekolah');
        const s = await getSchool(b.school_id);
        if (String(b.konfirmasi || '') !== s.kode) throw fail(400, 'Ketik kode sekolah dengan benar untuk konfirmasi');
        const people = await sb(`/rest/v1/profiles?school_id=eq.${enc(s.id)}&select=id`);
        for (const p of people || []) await sb(`/auth/v1/admin/users/${p.id}`, { method: 'DELETE' });
        await sb(`/rest/v1/schools?id=eq.${enc(s.id)}`, { method: 'DELETE' });
        return res.status(200).json({ ok: true, akunDihapus: (people || []).length });
      }

      default:
        throw fail(400, 'Aksi tidak dikenal');
    }
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Terjadi kesalahan' });
  }
}
