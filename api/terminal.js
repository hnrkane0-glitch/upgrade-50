// QuickCart — unified card/transfer terminal gateway (Vercel serverless function).
//
// POST /api/terminal  { action, owner, provider, ... }
//   providers: paystack | moniepoint | opay
//   actions  : config  → which providers are set up (never returns secrets)
//              save    → store settings (public) + secrets (encrypted)
//              test    → check credentials / terminal reachability
//              push    → send an amount to the terminal
//              status  → poll a pushed payment
//              verify  → (paystack online checkout) verify a reference
//
// Env (Vercel → Settings → Environment Variables):
//   QC_ENC_KEY            REQUIRED – long random string; encrypts every owner's terminal secrets
//   PAYSTACK_SECRET_KEY   optional – used ONLY for the platform owner (admin) account; other owners must save their own key
const { MAIN, baseFor, getSecrets, putSecrets, getCfg, fbPut, fbGet, jbody, crypto } = require('./_qc');

const PROVIDERS = ['paystack', 'moniepoint', 'opay'];
const bad = (res, code, msg, extra) => res.status(code).json(Object.assign({ ok: false, error: msg }, extra || {}));
const naira = (n) => Math.round(Number(n) || 0);
const jfetch = async (url, opt) => {
  const r = await fetch(url, opt); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch (e) { j = { raw: t.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, json: j };
};

/* ═════════════ PAYSTACK ═════════════ */
const PS = 'https://api.paystack.co';
const psAuth = (k) => ({ Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' });
// The platform-wide env key is ONLY used for the platform owner's own database (MAIN).
// Every other store must save its own Paystack secret key, so one owner's money can never go to another owner's account.
async function psKey(base) { const s = await getSecrets(base, 'paystack'); return s.secretKey || (base === MAIN ? (process.env.PAYSTACK_SECRET_KEY || '') : ''); }
const paystack = {
  async test(ctx) {
    const k = await psKey(ctx.base); if (!k) return { ok: false, error: 'No Paystack secret key saved yet.' };
    const id = ctx.cfg.terminalId; if (!id) return { ok: false, error: 'Add the Terminal ID first.' };
    const r = await jfetch(`${PS}/terminal/${encodeURIComponent(id)}/presence`, { headers: psAuth(k) });
    if (!r.ok) return { ok: false, error: (r.json && r.json.message) || 'Paystack rejected the request (' + r.status + ')' };
    const d = r.json.data || {};
    return { ok: true, online: !!d.online, available: !!d.available, message: d.online ? (d.available ? 'Terminal online and ready' : 'Terminal online but busy') : 'Terminal found but offline — switch it on' };
  },
  async push(ctx) {
    const k = await psKey(ctx.base); if (!k) return { ok: false, code: 'NO_KEY', error: 'Paystack secret key not set. Open POS Settings → Payment terminals.' };
    const id = ctx.cfg.terminalId; if (!id) return { ok: false, error: 'Paystack Terminal ID not set.' };
    const email = ctx.email || 'pos@quickcart.ng', kobo = naira(ctx.amount) * 100;
    // 1) customer (create or reuse)
    let cust = await jfetch(`${PS}/customer`, { method: 'POST', headers: psAuth(k), body: JSON.stringify({ email }) });
    let code = cust.json && cust.json.data && (cust.json.data.customer_code || cust.json.data.id);
    if (!code) { const g = await jfetch(`${PS}/customer/${encodeURIComponent(email)}`, { headers: psAuth(k) }); code = g.json && g.json.data && g.json.data.customer_code; }
    if (!code) return { ok: false, error: 'Could not create the Paystack customer: ' + ((cust.json && cust.json.message) || 'unknown error') };
    // 2) payment request (invoice)
    const pr = await jfetch(`${PS}/paymentrequest`, { method: 'POST', headers: psAuth(k), body: JSON.stringify({ customer: code, description: ctx.description || ('POS sale ' + ctx.reference), line_items: [{ name: 'POS sale ' + ctx.reference, amount: String(kobo), quantity: 1 }] }) });
    const d = pr.json && pr.json.data;
    if (!pr.ok || !d) return { ok: false, error: (pr.json && pr.json.message) || 'Paystack could not create the payment request' };
    // 3) push to terminal
    const ev = await jfetch(`${PS}/terminal/${encodeURIComponent(id)}/event`, { method: 'POST', headers: psAuth(k), body: JSON.stringify({ type: 'invoice', action: 'process', data: { id: d.id, reference: d.offline_reference } }) });
    if (!ev.ok) return { ok: false, error: (ev.json && ev.json.message) || 'Terminal did not accept the request. Is it online and idle?' };
    return { ok: true, requestCode: d.request_code, eventId: ev.json.data && ev.json.data.id, handle: { requestCode: d.request_code, eventId: ev.json.data && ev.json.data.id, terminalId: id } };
  },
  async status(ctx) {
    const k = await psKey(ctx.base); if (!k) return { ok: false, error: 'No Paystack key' };
    const h = ctx.handle || {}; let delivered = false, paid = false, amount = 0;
    if (h.eventId && h.terminalId) { const e = await jfetch(`${PS}/terminal/${encodeURIComponent(h.terminalId)}/event/${h.eventId}`, { headers: psAuth(k) }); delivered = !!(e.json && e.json.data && e.json.data.delivered); }
    if (h.requestCode) { const v = await jfetch(`${PS}/paymentrequest/verify/${encodeURIComponent(h.requestCode)}`, { headers: psAuth(k) }); const d = v.json && v.json.data; if (d) { paid = d.paid === true || d.status === 'success'; amount = Number(d.amount || 0) / 100; } }
    if (paid && ctx.amount && amount && amount + 0.01 < Number(ctx.amount)) return { ok: true, paid: false, delivered, mismatch: true, error: 'Amount paid (' + amount + ') is less than the sale total.' };
    return { ok: true, paid, delivered, amount, method: 'paystack' };
  },
  async verify(ctx) {
    const k = await psKey(ctx.base); if (!k) return { ok: false, code: 'NO_KEY', error: 'Paystack secret key not set' };
    const v = await jfetch(`${PS}/transaction/verify/${encodeURIComponent(ctx.reference)}`, { headers: psAuth(k) });
    const d = v.json && v.json.data; const paid = !!d && d.status === 'success' && Number(d.amount) >= naira(ctx.amount) * 100;
    return { ok: true, paid };
  },
};

/* ═════════════ MONIEPOINT (POS Push Payment API) ═════════════
   Docs: Moniepoint POS Apps Developer Support → "Push Payment Request (API Reference)".
   Auth: POST {base}/v1/auth {clientId, clientSecret} → accessToken.  Push: POST {base}/v1/transactions.
   Needs: ERP Integration enabled on the terminal, terminal app ≥ 1.7.2. */
const tokenCache = {};
async function mpToken(base, cfg, sec) {
  const base_url = (cfg.baseUrl || 'https://channel.moniepoint.com').replace(/\/+$/, '');
  const ck = base_url + sec.clientId, c = tokenCache[ck];
  if (c && c.exp > Date.now() + 30000) return { token: c.token, base_url };
  const r = await jfetch(base_url + '/v1/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: sec.clientId, clientSecret: sec.clientSecret }) });
  const t = r.json && r.json.accessToken;
  if (!r.ok || !t) throw Object.assign(new Error((r.json && (r.json.message || (r.json.errors || [])[0])) || 'Moniepoint rejected the Client ID / Secret'), { code: 'AUTH' });
  tokenCache[ck] = { token: t, exp: Date.now() + (Number(r.json.expiresIn) || 3000) * 1000 };
  return { token: t, base_url };
}
const mpAmt = (cfg, a) => (cfg.amountUnit === 'kobo' ? naira(a) * 100 : naira(a));
const moniepoint = {
  async test(ctx) {
    if (!ctx.cfg.serial) return { ok: false, error: 'Add the terminal serial number first.' };
    if (!ctx.sec.clientId || !ctx.sec.clientSecret) return { ok: false, error: 'Client ID / Client Secret not saved yet.' };
    try { await mpToken(ctx.base, ctx.cfg, ctx.sec); } catch (e) { return { ok: false, error: e.message }; }
    return { ok: true, message: 'Credentials accepted by Moniepoint. Do a ₦50 test sale to confirm the terminal responds.' };
  },
  async push(ctx) {
    if (!ctx.cfg.serial) return { ok: false, error: 'Moniepoint terminal serial not set.' };
    let t; try { t = await mpToken(ctx.base, ctx.cfg, ctx.sec); } catch (e) { return { ok: false, error: e.message }; }
    const pm = ctx.method === 'transfer' ? 'POS_TRANSFER' : ctx.method === 'card' ? 'CARD_PURCHASE' : 'ANY';
    const r = await jfetch(t.base_url + '/v1/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t.token }, body: JSON.stringify({ terminalSerial: ctx.cfg.serial, amount: mpAmt(ctx.cfg, ctx.amount), merchantReference: ctx.reference, transactionType: 'PURCHASE', paymentMethod: pm }) });
    if (r.status !== 202 && !r.ok) return { ok: false, error: (r.json && (r.json.message || (r.json.errors || [])[0])) || ('Moniepoint error ' + r.status) };
    return { ok: true, handle: { reference: ctx.reference } };
  },
  async status(ctx) {
    let t; try { t = await mpToken(ctx.base, ctx.cfg, ctx.sec); } catch (e) { return { ok: false, error: e.message }; }
    const ref = (ctx.handle && ctx.handle.reference) || ctx.reference;
    const r = await jfetch(`${t.base_url}/v1/transactions/merchants/${encodeURIComponent(ref)}`, { headers: { Authorization: 'Bearer ' + t.token } });
    if (r.status === 404) return { ok: true, paid: false, delivered: false };
    if (!r.ok) return { ok: false, error: (r.json && r.json.message) || 'Moniepoint error ' + r.status };
    const d = r.json || {}, st = String(d.processingStatus || '').toUpperCase();
    const approved = st === 'PROCESSED' && (d.responseCode == null || d.responseCode === '00' || d.responseCode === '0');
    const div = ctx.cfg.amountUnit === 'kobo' ? 100 : 1, got = d.actualAmount != null ? Number(d.actualAmount) / div : null;
    if (approved && got != null && ctx.amount && got + 0.01 < Number(ctx.amount)) return { ok: true, paid: false, delivered: true, mismatch: true, error: 'Terminal collected ₦' + got + ', less than the sale total.' };
    return { ok: true, paid: approved, delivered: true, declined: st === 'CANCELLED' || (st === 'PROCESSED' && !approved), message: d.responseMessage || '', amount: got, method: String(d.actualPaymentMethod || '').toLowerCase() };
  },
};

/* ═════════════ OPAY (POS Integration API) ═════════════
   Docs: documentation.opayweb.com → Offline Payments → POS Integration (API) + Authentication.
   Requests are RSA-encrypted with OPay's public key and signed (SHA256withRSA) with the merchant private key. */
const forge = (() => { try { return require('node-forge'); } catch (e) { return null; } })();
const pem = (s, type) => { s = String(s || '').trim(); if (/-----BEGIN/.test(s)) return s; const body = s.replace(/\s+/g, '').match(/.{1,64}/g).join('\n'); return `-----BEGIN ${type}-----\n${body}\n-----END ${type}-----`; };
const sortKeys = (o) => Array.isArray(o) ? o.map(sortKeys) : (o && typeof o === 'object') ? Object.keys(o).sort().reduce((a, k) => (a[k] = sortKeys(o[k]), a), {}) : o;
function opayEncrypt(sec, params, ts) {
  const pub = crypto.createPublicKey(pem(sec.opayPublicKey, 'PUBLIC KEY'));
  const size = pub.asymmetricKeyDetails.modulusLength / 8, buf = Buffer.from(JSON.stringify(sortKeys(params)), 'utf8'), parts = [];
  for (let i = 0; i < buf.length; i += size - 11) parts.push(crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_PADDING }, buf.subarray(i, i + size - 11)));
  const paramContent = Buffer.concat(parts).toString('base64');
  const sign = crypto.createSign('RSA-SHA256').update(paramContent + ts).sign(pem(sec.privateKey, 'PRIVATE KEY'), 'base64');
  return { paramContent, sign };
}
function opayDecrypt(sec, b64) {
  if (!forge) throw new Error('node-forge is not installed on the server (run npm install).');
  const key = forge.pki.privateKeyFromPem(pem(sec.privateKey, 'PRIVATE KEY')), size = Math.ceil(key.n.bitLength() / 8), buf = Buffer.from(b64, 'base64'), out = [];
  for (let i = 0; i < buf.length; i += size) out.push(Buffer.from(key.decrypt(buf.subarray(i, i + size).toString('binary'), 'RSAES-PKCS1-V1_5'), 'binary'));
  return JSON.parse(Buffer.concat(out).toString('utf8'));
}
async function opayCall(ctx, path, params) {
  const ts = String(Date.now()), body = opayEncrypt(ctx.sec, params, ts);
  const r = await jfetch('https://payapi.opayweb.com/openApi/order/checkout/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', version: 'V1.0.1', bodyFormat: 'JSON', clientAuthKey: ctx.sec.clientAuthKey, timestamp: ts }, body: JSON.stringify(body) });
  const j = r.json || {};
  if (j.code !== '00000') return { ok: false, error: j.message || ('OPay error ' + r.status) };
  let data = null; try { data = typeof j.data === 'string' ? opayDecrypt(ctx.sec, j.data) : j.data; } catch (e) { return { ok: true, data: null, warn: 'Could not decrypt OPay response: ' + e.message }; }
  return { ok: true, data };
}
const opayReady = (ctx) => ctx.cfg.headMerchantId && ctx.cfg.merchantId && ctx.cfg.serial && ctx.sec.privateKey && ctx.sec.opayPublicKey && ctx.sec.clientAuthKey;
const opay = {
  async test(ctx) {
    if (!opayReady(ctx)) return { ok: false, error: 'Fill in Business ID, Branch ID, terminal SN, Client Auth Key and both RSA keys.' };
    try { pem(ctx.sec.privateKey, 'PRIVATE KEY'); crypto.createPrivateKey(pem(ctx.sec.privateKey, 'PRIVATE KEY')); crypto.createPublicKey(pem(ctx.sec.opayPublicKey, 'PUBLIC KEY')); }
    catch (e) { return { ok: false, error: 'An RSA key is not valid PEM: ' + e.message }; }
    return { ok: true, message: 'Keys look valid. OPay does not offer a ping — do a ₦50 test sale to confirm the terminal responds.' };
  },
  async push(ctx) {
    if (!opayReady(ctx)) return { ok: false, error: 'OPay is not fully set up. Open POS Settings → Payment terminals.' };
    const r = await opayCall(ctx, 'createOrder', { headMerchantId: ctx.cfg.headMerchantId, merchantId: ctx.cfg.merchantId, outOrderNo: ctx.reference, amount: String(naira(ctx.amount)), currency: 'NGN', orderExpireTime: 180, isSplit: 'N', remark: 'POS ' + ctx.reference, sceneEnum: 'CASH_API', subSceneEnum: ctx.cfg.subScene || 'CASH_API', sn: ctx.cfg.serial });
    if (!r.ok) return r;
    return { ok: true, handle: { reference: ctx.reference, orderNo: r.data && r.data.orderNo } };
  },
  async status(ctx) {
    const h = ctx.handle || {};
    const r = await opayCall(ctx, 'qryOrderDetail', { headMerchantId: ctx.cfg.headMerchantId, merchantId: ctx.cfg.merchantId, outOrderNo: h.reference || ctx.reference });
    if (!r.ok) return r; const d = r.data || {}, st = String(d.status || '').toUpperCase();
    const paid = st === 'SUCCESS', got = d.amount != null ? Number(d.amount) : null;
    if (paid && got != null && ctx.amount && got + 0.01 < Number(ctx.amount)) return { ok: true, paid: false, delivered: true, mismatch: true, error: 'Terminal collected ₦' + got + ', less than the sale total.' };
    return { ok: true, paid, delivered: st !== '' && st !== 'INITIAL', declined: st === 'FAIL' || st === 'CLOSE', amount: got };
  },
};

const ADAPTERS = { paystack, moniepoint, opay };
// settings that are safe to store/show in the browser (NOT secrets)
const PUBLIC_FIELDS = { paystack: ['terminalId', 'label'], moniepoint: ['serial', 'label', 'baseUrl', 'amountUnit'], opay: ['serial', 'label', 'headMerchantId', 'merchantId', 'subScene'] };
const SECRET_FIELDS = { paystack: ['secretKey'], moniepoint: ['clientId', 'clientSecret', 'webhookSecret'], opay: ['privateKey', 'opayPublicKey', 'clientAuthKey'] };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return bad(res, 405, 'POST only');
  const b = jbody(req), action = b.action, provider = b.provider || 'paystack';
  try {
    // ── legacy calls from the previous POS build (single Paystack terminal) ──
    if (!b.owner && b.terminalId && ['push', 'status', 'presence', 'verify'].includes(action)) b._legacy = true;
    const base = await baseFor(b.owner);

    if (action === 'config') {
      const out = {};
      for (const p of PROVIDERS) {
        const cfg = await getCfg(base, p); let sec = {};
        try { sec = await getSecrets(base, p); } catch (e) { if (e.code === 'NO_ENC_KEY') out.noEncKey = true; }
        out[p] = { cfg, secretsSet: SECRET_FIELDS[p].reduce((a, f) => (a[f] = !!sec[f], a), {}) };
      }
      out.paystackEnvKey = base === MAIN && !!process.env.PAYSTACK_SECRET_KEY;
      return res.status(200).json({ ok: true, providers: out });
    }

    if (action === 'save') {
      if (!PROVIDERS.includes(provider)) return bad(res, 400, 'Unknown provider');
      const pub = {}, cfg = b.cfg || {};
      PUBLIC_FIELDS[provider].forEach((f) => { if (cfg[f] != null) pub[f] = String(cfg[f]).trim().slice(0, 300); });
      pub.enabled = !!cfg.enabled; pub.updatedAt = new Date().toISOString();
      await fbPut(`${base}/settings/terminals/${provider}`, pub);
      const incoming = b.secrets || {}, keep = await getSecrets(base, provider).catch((e) => { if (e.code === 'NO_ENC_KEY') throw e; return {}; });
      let changed = false;
      SECRET_FIELDS[provider].forEach((f) => { const v = incoming[f]; if (typeof v === 'string' && v.trim()) { keep[f] = v.trim(); changed = true; } });
      if (changed) await putSecrets(base, provider, keep);
      return res.status(200).json({ ok: true });
    }

    if (action === 'saveWebhookSecret') { // generic / moniepoint webhook secret
      const keep = await getSecrets(base, provider); keep.webhookSecret = String(b.secret || '').trim(); await putSecrets(base, provider, keep); return res.status(200).json({ ok: true });
    }

    if (action === 'newGenericToken') {
      const token = crypto.randomBytes(24).toString('hex'); const keep = await getSecrets(base, 'generic'); keep.webhookSecret = token; await putSecrets(base, 'generic', keep);
      await fbPut(`${base}/settings/terminals/generic`, Object.assign({}, await getCfg(base, 'generic'), { enabled: true, updatedAt: new Date().toISOString() }));
      return res.status(200).json({ ok: true, token });
    }

    /* ── legacy Paystack-only shim ── */
    if (b._legacy) {
      const ctx = { base, cfg: { terminalId: b.terminalId }, amount: b.amount, reference: b.reference, email: b.email, description: b.description, handle: { requestCode: b.requestCode, eventId: b.eventId, terminalId: b.terminalId }, sec: {} };
      if (action === 'presence') return res.status(200).json(await paystack.test(ctx));
      if (action === 'push') { const r = await paystack.push(ctx); return r.ok ? res.status(200).json(r) : bad(res, 400, r.error, { code: r.code }); }
      if (action === 'status') return res.status(200).json(await paystack.status(ctx));
      if (action === 'verify') { const r = await paystack.verify(ctx); return r.ok ? res.status(200).json(r) : bad(res, 400, r.error, { code: r.code }); }
    }

    if (action === 'verify') { const r = await paystack.verify({ base, reference: b.reference, amount: b.amount }); return r.ok ? res.status(200).json(r) : bad(res, 400, r.error, { code: r.code }); }

    const ad = ADAPTERS[provider];
    if (!ad) return bad(res, 400, 'Unknown provider');
    const cfg = await getCfg(base, provider), sec = await getSecrets(base, provider);
    const ctx = { base, cfg, sec, amount: b.amount, reference: String(b.reference || ''), email: b.email, description: b.description, method: b.method, handle: b.handle };

    if (action === 'test') return res.status(200).json(await ad.test(ctx));
    if (action === 'push') {
      if (!ctx.reference || !(Number(ctx.amount) > 0)) return bad(res, 400, 'Missing amount or reference');
      const r = await ad.push(ctx); return r.ok ? res.status(200).json(r) : bad(res, 400, r.error, { code: r.code });
    }
    if (action === 'status') { const r = await ad.status(ctx); return res.status(200).json(r); }
    return bad(res, 400, 'Unknown action');
  } catch (e) {
    if (e.code === 'NO_ENC_KEY') return bad(res, 500, e.message, { code: 'NO_ENC_KEY' });
    return bad(res, 500, 'Payment server error: ' + (e.message || e));
  }
};
module.exports._internals = { opayEncrypt, opayDecrypt, sortKeys, moniepoint, paystack, opay };
