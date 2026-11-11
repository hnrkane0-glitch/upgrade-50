// QuickCart — completes a password reset.
// POST { action:'check', email, token }                → { ok:true }  if the link is still valid
// POST { action:'reset', email, token, password }      → { ok:true }  sets the new password, burns the token
const crypto = require('crypto');
const { sendMail, configured, shell } = require('./_mail');

const FB = 'https://sneakerai-c96f0-default-rtdb.firebaseio.com';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  let b = {};
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}
  const email = String(b.email || '').trim().toLowerCase(), token = String(b.token || '');
  const invalid = () => res.status(400).json({ ok: false, code: 'invalid_link', error: 'This reset link is invalid or has expired. Please request a new one.' });
  if (!email || !/^[a-f0-9]{64}$/.test(token)) return invalid();

  try {
    const r = await fetch(`${FB}/users.json`);
    const users = (r.ok && (await r.json())) || {};
    const hit = Object.entries(users).find(([, u]) => u && !u.isStaff && String(u.email || '').trim().toLowerCase() === email);
    const rt = hit && hit[1].resetToken;
    if (!rt || !rt.hash || !same(rt.hash, sha(token)) || Number(rt.expires) < Date.now()) return invalid();
    if (b.action !== 'reset') return res.status(200).json({ ok: true });

    const pw = String(b.password || '');
    if (pw.length < 6) return res.status(400).json({ ok: false, code: 'weak', error: 'Password must be at least 6 characters.' });
    if (/[^\u0000-\u00ff]/.test(pw)) return res.status(400).json({ ok: false, code: 'chars', error: 'Please use letters, numbers and common symbols only.' });
    // the app stores passwords as btoa(password) — keep that format so existing login keeps working
    const stored = Buffer.from(pw, 'latin1').toString('base64');
    const key = hit[0];
    const up = await fetch(`${FB}/users/${encodeURIComponent(key)}.json`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: stored, resetToken: null, passwordChangedAt: new Date().toISOString() })
    });
    if (!up.ok) throw new Error('db write failed');
    if (configured()) {   // courtesy heads-up, never blocks the reset
      sendMail({ to: email, subject: 'Your QuickCart password was changed',
        html: shell('Password changed', '<p style="margin:0;font-size:15px;line-height:1.7;color:#3b4a6b">Your QuickCart password was just changed. If this was not you, reset it again right away.</p>'),
        text: 'Your QuickCart password was just changed. If this was not you, reset it again right away.' }).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('reset-password failed:', e.message);
    return res.status(500).json({ ok: false, code: 'server', error: 'Something went wrong. Please try again.' });
  }
};
