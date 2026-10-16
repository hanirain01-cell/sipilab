// Vercel Serverless Function: membuat model 3D REALISTIS dari foto alat memakai AI (Meshy Image-to-3D).
// Aktif jika Environment Variable MESHY_API_KEY diisi DAN Super Admin mengizinkan "3D AI" untuk sekolah tsb.
//   POST {action:'start',  item_id}  → mulai membuat model 3D dari foto alat
//   POST {action:'status', item_id}  → cek progres; jika selesai, GLB disalin ke Supabase Storage
// Dokumentasi Meshy: https://docs.meshy.ai/en/api/image-to-3d
export const config = { maxDuration: 300 };

const MESHY_URL = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MAX_GLB = 45 * 1024 * 1024;

function cfg() {
  return {
    url: (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, ''),
    srk: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    anon: (process.env.SUPABASE_ANON_KEY || '').trim(),
    meshy: (process.env.MESHY_API_KEY || '').trim(),
    model: (process.env.MESHY_AI_MODEL || 'latest').trim(),
    poly: parseInt(process.env.MESHY_TARGET_POLYCOUNT || '30000', 10) || 30000,
  };
}
function fail(status, message) { const e = new Error(message); e.status = status; return e; }
const enc = encodeURIComponent;

async function sb(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const { url, srk } = cfg();
  const r = await fetch(url + path, {
    method,
    headers: { apikey: srk, ...(srk.startsWith("sb_") ? {} : { Authorization: `Bearer ${srk}` }), ...(raw ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw fail(502, 'Supabase: ' + ((data && (data.message || data.error || data.msg)) || r.status));
  return data;
}

async function meshy(path, { method = 'GET', body } = {}) {
  const r = await fetch(MESHY_URL + path, {
    method, headers: { Authorization: `Bearer ${cfg().meshy}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${r.status}`;
    if (r.status === 401) throw fail(502, 'MESHY_API_KEY tidak valid');
    if (r.status === 402) throw fail(402, 'Kredit Meshy habis. Isi ulang kredit di meshy.ai');
    if (r.status === 429) throw fail(429, 'Terlalu banyak permintaan ke Meshy, coba lagi sebentar');
    throw fail(502, 'Meshy: ' + msg);
  }
  return data;
}

async function caller(req) {
  const { url, anon, srk } = cfg();
  const h = req.headers.authorization || req.headers.Authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw fail(401, 'Belum login');
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon || srk, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw fail(401, 'Sesi login tidak valid, silakan login ulang');
  const user = await r.json();
  const me = (await sb(`/rest/v1/profiles?id=eq.${enc(user.id)}&select=*`))[0];
  if (!me || !me.aktif) throw fail(403, 'Akun tidak aktif');
  return me;
}
async function loadItem(me, itemId) {
  const it = (await sb(`/rest/v1/items?id=eq.${enc(itemId)}&select=*`))[0];
  if (!it) throw fail(404, 'Alat tidak ditemukan');
  const school = (await sb(`/rest/v1/schools?id=eq.${enc(it.school_id)}&select=*`))[0];
  if (me.role !== 'superadmin') {
    if (it.school_id !== me.school_id) throw fail(404, 'Alat tidak ditemukan');
    if (!school || !school.aktif) throw fail(403, 'Sekolah sedang dinonaktifkan');
  }
  return { it, school };
}
const canAlat = me => me.role === 'superadmin' || me.role === 'admin' || (me.menus || []).includes('alat');
const pick = it => ({ id: it.id, model3d_url: it.model3d_url, ai3d_status: it.ai3d_status, ai3d_progress: it.ai3d_progress, ai3d_error: it.ai3d_error });
async function patchItem(id, patch, extra = '') {
  const rows = await sb(`/rest/v1/items?id=eq.${enc(id)}${extra}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: patch });
  return rows && rows[0];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  const c = cfg();
  if (!c.url || !c.srk) return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel' });
  if (!c.meshy) return res.status(501).json({ error: '3D AI belum diaktifkan: isi MESHY_API_KEY di Vercel' });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  try {
    const me = await caller(req);
    if (!b.item_id) throw fail(400, 'item_id wajib');
    const { it, school } = await loadItem(me, b.item_id);

    if (b.action === 'start') {
      if (!canAlat(me)) throw fail(403, 'Anda tidak punya akses menu Alat');
      if (!school || !school.ai3d) throw fail(403, 'Fitur 3D AI belum diizinkan Super Admin untuk sekolah ini');
      if (!it.foto_url) throw fail(400, 'Unggah foto alat terlebih dahulu');
      if (it.ai3d_status === 'proses' && !b.ulang) return res.status(200).json({ item: pick(it) });
      const task = await meshy('', { method: 'POST', body: {
        image_url: it.foto_url, ai_model: c.model, should_texture: true, enable_pbr: false,
        should_remesh: true, target_polycount: c.poly,
      } });
      if (!task || !task.result) throw fail(502, 'Meshy tidak mengembalikan id tugas');
      const row = await patchItem(it.id, { ai3d_task: task.result, ai3d_status: 'proses', ai3d_progress: 0, ai3d_error: null });
      return res.status(200).json({ item: pick(row) });
    }

    if (b.action === 'status') {
      if (it.ai3d_status !== 'proses' || !it.ai3d_task) return res.status(200).json({ item: pick(it) });
      const t = await meshy('/' + enc(it.ai3d_task));
      if (t.status === 'PENDING' || t.status === 'IN_PROGRESS') {
        const prog = Math.max(0, Math.min(99, t.progress || 0));
        const row = prog !== it.ai3d_progress ? await patchItem(it.id, { ai3d_progress: prog }) : it;
        return res.status(200).json({ item: pick(row || it) });
      }
      if (t.status === 'SUCCEEDED') {
        const glbUrl = t.model_urls && t.model_urls.glb;
        if (!glbUrl) throw fail(502, 'Meshy tidak menyediakan file GLB');
        const g = await fetch(glbUrl);
        if (!g.ok) throw fail(502, 'Gagal mengunduh model 3D dari Meshy');
        const buf = Buffer.from(await g.arrayBuffer());
        if (buf.length > MAX_GLB) throw fail(413, 'Model 3D terlalu besar');
        const path = `${it.school_id}/${it.id}/ai-${Date.now()}.glb`;
        await sb(`/storage/v1/object/foto-alat/${path}`, { method: 'POST', raw: true, body: buf, headers: { 'Content-Type': 'model/gltf-binary', 'x-upsert': 'true', 'cache-control': 'max-age=31536000' } });
        const pub = `${c.url}/storage/v1/object/public/foto-alat/${path}`;
        const row = await patchItem(it.id, { model3d_url: pub, ai3d_status: 'siap', ai3d_progress: 100, ai3d_error: null }, `&ai3d_task=eq.${enc(it.ai3d_task)}`);
        return res.status(200).json({ item: pick(row || Object.assign({}, it, { model3d_url: pub, ai3d_status: 'siap', ai3d_progress: 100 })) });
      }
      const msg = (t.task_error && t.task_error.message) || (t.status === 'CANCELED' ? 'Dibatalkan' : 'Gagal membuat model 3D');
      const row = await patchItem(it.id, { ai3d_status: 'gagal', ai3d_error: msg });
      return res.status(200).json({ item: pick(row || it) });
    }

    throw fail(400, 'Aksi tidak dikenal');
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Terjadi kesalahan' });
  }
}
