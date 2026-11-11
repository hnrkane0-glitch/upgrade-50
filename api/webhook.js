// QuickCart — payment webhooks → payment inbox (Vercel serverless function).
//
// Give each bank this URL (the POS Settings screen shows it ready to copy):
//   https://YOUR-SITE/api/webhook?p=<provider>&o=<owner-username>
//   p = paystack | moniepoint | opay | generic
//
// Verified payments are written to  <owner DB>/payment_inbox/<id>  and the POS
// matches them by EXACT amount (and terminal, where the bank sends it) to finish the sale.
const { baseFor, getSecrets, fbPut, fbGet, timingSafe, raw, crypto } = require('./_qc');

module.exports.config = { api: { bodyParser: false } }; // we need the exact raw body for signatures

const ok = (res, extra) => res.status(200).json(Object.assign({ ok: true }, extra || {}));
const hdr = (req, k) => req.headers[k.toLowerCase()] || '';
const pick = (o, ...ks) => { for (const k of ks) { const v = k.split('.').reduce((a, p) => (a == null ? a : a[p]), o); if (v != null && v !== '') return v; } return null; };

const verifiers = {
  // Paystack: x-paystack-signature = HMAC-SHA512(body, secret key)
  async paystack(req, body, sec) {
    const key = sec.secretKey || (sec._platform ? process.env.PAYSTACK_SECRET_KEY : ''); if (!key) return false;
    return timingSafe(crypto.createHmac('sha512', key).update(body).digest('hex'), hdr(req, 'x-paystack-signature'));
  },
  // Moniepoint: base64(HMAC-SHA256(`${id}__${timestamp}__${body}`, webhookSecret))
  async moniepoint(req, body, sec) {
    if (!sec.webhookSecret) return false;
    const id = hdr(req, 'moniepoint-webhook-id'), ts = hdr(req, 'moniepoint-webhook-timestamp'), sig = hdr(req, 'moniepoint-webhook-signature');
    if (!id || !ts || !sig) return false;
    if (Math.abs(Date.now() - Number(ts)) > 15 * 60 * 1000) return false; // replay window
    return timingSafe(crypto.createHmac('sha256', sec.webhookSecret).update(`${id}__${ts}__${body}`).digest('base64'), sig);
  },
  // OPay: body {paramContent, timestamp, sign}; sign = RSA-SHA256(paramContent+timestamp) by OPay → verify with OPay public key
  async opay(req, body, sec, parsed) {
    if (!sec.opayPublicKey || !parsed || !parsed.paramContent || !parsed.sign) return false;
    if (Math.abs(Date.now() - Number(parsed.timestamp)) > 5 * 60 * 1000) return false;
    try { const pub = /-----BEGIN/.test(sec.opayPublicKey) ? sec.opayPublicKey : `-----BEGIN PUBLIC KEY-----\n${sec.opayPublicKey.replace(/\s+/g, '').match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
      return crypto.createVerify('RSA-SHA256').update(parsed.paramContent + parsed.timestamp).verify(pub, parsed.sign, 'base64'); } catch (e) { return false; }
  },
  // Generic bank-alert: shared secret in header x-qc-secret (or ?s=)
  async generic(req, body, sec) { const s = hdr(req, 'x-qc-secret') || (req.query && req.query.s) || ''; return !!sec.webhookSecret && !!s && timingSafe(s, sec.webhookSecret); },
};

// Turn each provider's payload into { id, amount (₦), ref, terminal, success, channel }
const normalise = {
  paystack(j) {
    const ev = j.event, d = j.data || {};
    if (ev === 'charge.success') return { id: 'ps_' + d.id, amount: Number(d.amount) / 100, ref: d.reference, terminal: pick(d, 'source.identifier'), success: d.status === 'success', channel: d.channel || 'card' };
    if (ev === 'paymentrequest.success') return { id: 'psr_' + d.id, amount: Number(d.amount) / 100, ref: d.request_code, terminal: null, success: true, channel: 'pos' };
    return null;
  },
  moniepoint(j) {
    const t = String(j.eventType || ''), d = j.data || {};
    if (!/PURCHASE|COLLECTION|TRANSFER|PAY_CODE/.test(t) || /WITHDRAWAL|AIRTIME|BILL|BOOM/.test(t)) return null;
    const code = pick(d, 'responseCode', 'code'), txt = String(pick(d, 'status', 'transactionStatus', 'responseMessage') || '');
    const success = code != null ? (String(code) === '00' || String(code) === '0') : /success|approved|complete/i.test(txt);
    return { id: 'mp_' + (pick(d, 'transactionReference', 'reference', 'rrn', 'id') || (j.eventId || Date.now())), amount: Number(d.amount), ref: pick(d, 'merchantReference', 'transactionReference', 'reference'), terminal: pick(d, 'terminalSerial'), success, channel: /TRANSFER|COLLECTION/.test(t) ? 'transfer' : 'card' };
  },
  opay(j) {
    const d = j.data || j; const st = String(d.status || '').toUpperCase();
    return { id: 'op_' + (d.orderNo || d.outOrderNo || Date.now()), amount: Number(d.amount), ref: d.outOrderNo, terminal: d.sn, success: st === 'SUCCESS', channel: /POS/i.test(d.payType || '') ? 'card' : 'transfer' };
  },
  generic(j) { return { id: 'gx_' + (j.id || j.reference || Date.now()), amount: Number(j.amount), ref: j.reference || null, terminal: j.terminal || null, success: j.status ? /success|paid|credit/i.test(j.status) : true, channel: j.channel || 'transfer' }; },
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return ok(res, { hint: 'QuickCart webhook endpoint — POST only' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const q = req.query || {}, p = String(q.p || '').toLowerCase(), owner = String(q.o || '').toLowerCase();
  if (!verifiers[p] || !owner) return res.status(400).json({ ok: false, error: 'Bad webhook URL' });
  try {
    const body = await raw(req); let parsed = null; try { parsed = JSON.parse(body); } catch (e) {}
    const base = await baseFor(owner);
    const sec0 = await getSecrets(base, p === 'generic' ? 'generic' : p);
    const sec = Object.assign({}, sec0, { _platform: owner === 'admin' });
    if (!(await verifiers[p](req, body, sec, parsed))) return res.status(401).json({ ok: false, error: 'Signature check failed' });

    let j = parsed || {};
    if (p === 'opay') { // decrypt the notification body with the merchant private key
      try { j = require('./terminal')._internals.opayDecrypt(sec, parsed.paramContent); }
      catch (e) { return ok(res, { skipped: 'could not decrypt' }); }
      j = { data: (j && j.data && typeof j.data === 'object') ? j.data : j };
    }
    const n = normalise[p](j);
    if (!n || !(n.amount > 0)) return ok(res, { ignored: true });
    const at = Date.now(), key = `${at}_${n.id}`.replace(/[.#$/\[\]]/g, '_');
    const seen = await fbGet(`${base}/payment_seen/${String(n.id).replace(/[.#$/\[\]]/g, '_')}`); // idempotent: banks retry
    if (seen) return ok(res, { duplicate: true });
    await fbPut(`${base}/payment_seen/${String(n.id).replace(/[.#$/\[\]]/g, '_')}`, at);
    await fbPut(`${base}/payment_inbox/${key}`, { provider: p, eid: n.id, amount: Math.round(n.amount * 100) / 100, ref: n.ref || '', terminal: n.terminal || '', channel: n.channel || '', success: !!n.success, at, atISO: new Date(at).toISOString() });
    return ok(res, { stored: key });
  } catch (e) {
    // return 200 for decrypt/config problems so banks don't retry forever; 500 only for transient DB failures
    return res.status(/Database/.test(e.message) ? 500 : 200).json({ ok: false, error: String(e.message || e) });
  }
};
