// QuickCart — custom domain helper (Vercel serverless function)
// Adds / checks / removes a store owner's domain on THIS Vercel project via the Vercel API.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   VERCEL_API_TOKEN   – create at vercel.com/account/tokens
//   VERCEL_PROJECT_ID  – Project → Settings → General → Project ID
//   VERCEL_TEAM_ID     – only if the project lives under a team (optional)
//
// If these are not set the endpoint answers {notConfigured:true} and the admin UI
// falls back to manual mode (you add the domain in Vercel yourself).

const FB = 'https://sneakerai-c96f0-default-rtdb.firebaseio.com';
const key = (d) => String(d).toLowerCase().replace(/\./g, ',');
const validDomain = (d) => /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = body.action;
  const domain = String(body.domain || '').trim().toLowerCase();
  const owner = String(body.owner || '').trim().toLowerCase();

  const TOKEN = process.env.VERCEL_API_TOKEN, PROJECT = process.env.VERCEL_PROJECT_ID, TEAM = process.env.VERCEL_TEAM_ID;
  if (!TOKEN || !PROJECT) return res.status(200).json({ ok: false, notConfigured: true });

  if (!validDomain(domain) || /(^|\.)quickcart\.(ng|com)$/.test(domain) || /\.vercel\.app$/.test(domain)) {
    return res.status(400).json({ ok: false, error: 'Invalid domain' });
  }
  if (!owner) return res.status(400).json({ ok: false, error: 'Missing owner' });

  // A domain can only be touched by the store that claimed it
  try {
    const r = await fetch(`${FB}/domains/${key(domain)}.json`);
    const claim = r.ok ? await r.json() : null;
    if (claim && claim.owner && String(claim.owner).toLowerCase() !== owner) {
      return res.status(403).json({ ok: false, error: 'This domain belongs to another store' });
    }
  } catch (e) { /* DB unreachable – continue */ }

  const q = TEAM ? `?teamId=${encodeURIComponent(TEAM)}` : '';
  const qAnd = TEAM ? `&teamId=${encodeURIComponent(TEAM)}` : '';
  const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  const base = `https://api.vercel.com`;

  async function vc(method, path, payload) {
    const r = await fetch(base + path, { method, headers: H, body: payload ? JSON.stringify(payload) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) {}
    return { status: r.status, data: j };
  }
  async function status() {
    const info = await vc('GET', `/v9/projects/${PROJECT}/domains/${encodeURIComponent(domain)}${q}`);
    const cfg = await vc('GET', `/v6/domains/${encodeURIComponent(domain)}/config${q}`);
    const verified = !!(info.data && info.data.verified);
    const misconfigured = cfg.data && typeof cfg.data.misconfigured === 'boolean' ? cfg.data.misconfigured : true;
    const v = info.data && info.data.verification && info.data.verification[0];
    return { connected: verified && !misconfigured, verified, misconfigured, txt: v ? { domain: v.domain, value: v.value } : null };
  }

  try {
    if (action === 'add') {
      const a = await vc('POST', `/v10/projects/${PROJECT}/domains${q}`, { name: domain });
      if (a.status >= 400 && !(a.data.error && /already/i.test(a.data.error.message || ''))) {
        return res.status(200).json({ ok: false, error: (a.data.error && a.data.error.message) || 'Could not add domain' });
      }
      const st = await status();
      return res.status(200).json({ ok: true, ...st, verification: a.data.verification || null });
    }
    if (action === 'check') {
      // ask Vercel to re-verify first (harmless if already verified)
      await vc('POST', `/v9/projects/${PROJECT}/domains/${encodeURIComponent(domain)}/verify${q}`);
      return res.status(200).json({ ok: true, ...(await status()) });
    }
    if (action === 'remove') {
      await vc('DELETE', `/v9/projects/${PROJECT}/domains/${encodeURIComponent(domain)}${q}`);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'Domain service error' });
  }
};
