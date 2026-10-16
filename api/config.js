// Vercel Serverless Function: memberi konfigurasi publik Supabase ke browser.
// Isi Environment Variables di Vercel: SUPABASE_URL, SUPABASE_ANON_KEY (+ SUPABASE_SERVICE_ROLE_KEY untuk /api/admin)
export default function handler(req, res) {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    configured: Boolean(url && anonKey),
    url,
    anonKey,
    domain: (process.env.LOGIN_EMAIL_DOMAIN || 'sipinlab.app').trim(),
    adminApi: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ai3d: Boolean(process.env.MESHY_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
