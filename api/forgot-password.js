// QuickCart — "Forgot password": emails a one-time reset link to the owner's registered address.
// POST { email }  →  { ok:true }  (always the same answer, so nobody can probe which emails exist)
// Errors that the OWNER of the platform must fix (e.g. email not set up) are returned as { ok:false, code }.
const crypto = require('crypto');
const { sendMail, configured, shell, esc } = require('./_mail');

const FB = 'https://sneakerai-c96f0-default-rtdb.firebaseio.com';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const COOLDOWN_MS = 60 * 1000;        // one email per minute per account
const TTL_MS = 60 * 60 * 1000;        // link valid for 1 hour

function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return proto + '://' + host;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, code: 'bad_email', error: 'Please enter a valid email address.' });
  if (!configured()) return res.status(503).json({ ok: false, code: 'mail_not_configured', error: 'Email sending is not set up on this site yet.' });

  try {
    const r = await fetch(`${FB}/users.json`);
    const users = (r.ok && (await r.json())) || {};
    const hit = Object.entries(users).find(([, u]) => u && !u.isStaff && String(u.email || '').trim().toLowerCase() === email);
    if (hit) {
      const [key, user] = hit;
      const last = user.resetToken && user.resetToken.sentAt ? Number(user.resetToken.sentAt) : 0;
      if (Date.now() - last < COOLDOWN_MS) return res.status(200).json({ ok: true, throttled: true });
      const token = crypto.randomBytes(32).toString('hex');
      const put = await fetch(`${FB}/users/${encodeURIComponent(key)}/resetToken.json`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: sha(token), expires: Date.now() + TTL_MS, sentAt: Date.now() })
      });
      if (!put.ok) throw Object.assign(new Error('db'), { code: 'db_failed' });
      const link = `${baseUrl(req)}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      const name = (user.name || '').split(' ')[0] || 'there';
      const html = shell('Reset your password', `
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3b4a6b">Hi ${esc(name)}, we received a request to reset the password for your QuickCart account. Tap the button below to choose a new one. This link works <b>once</b> and expires in <b>1 hour</b>.</p>
        <p style="margin:26px 0"><a href="${link}" style="display:inline-block;background:#ff5a1f;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px">Choose a new password →</a></p>
        <p style="margin:0 0 8px;font-size:13px;color:#7a88a8">Button not working? Paste this into your browser:</p>
        <p style="margin:0 0 18px;font-size:12px;word-break:break-all;color:#14306b">${esc(link)}</p>
        <p style="margin:0;font-size:13px;color:#7a88a8">Didn't ask for this? You can ignore this email — your password stays the same.</p>`);
      await sendMail({ to: email, subject: 'Reset your QuickCart password', html,
        text: `Reset your QuickCart password (valid 1 hour, one use):\n${link}\n\nIf you didn't request this, ignore this email.` });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('forgot-password failed:', e.code || '', e.message, e.detail ? JSON.stringify(e.detail) : '');
    if (e.code === 'mail_failed') return res.status(502).json({ ok: false, code: 'mail_failed', error: 'The email provider rejected the message. Check MAIL_FROM is a verified sender.' });
    return res.status(500).json({ ok: false, code: 'server', error: 'Something went wrong. Please try again.' });
  }
};
