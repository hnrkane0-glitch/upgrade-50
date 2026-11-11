// QuickCart — online card checkout via Moniepoint (Monnify) and OPay (Vercel serverless function).
//
// POST /api/checkout  { action, owner, ... }
//   config  → which online providers this store has set up (never returns secrets)
//   save    → store a provider's credentials (password-protected, secrets encrypted)
//   init    → create a hosted payment page for an order and return its URL
//   verify  → ask the provider if the order was really paid, then mark it paid + deduct stock
//
// Providers (the owner needs a merchant account with each):
//   monnify → Moniepoint's online gateway   (API Key, Secret Key, Contract Code)
//   opay    → OPay Cashier / Checkout       (Merchant ID, Public Key, Secret Key)
//
// Env: QC_ENC_KEY (required, encrypts the owner's keys). QC_ADMIN_PASSWORD (optional, lets the
// platform "admin" account save its own keys).
const { MAIN, baseFor, fbGet, fbPut, getSecrets, putSecrets, jbody, crypto, enc } = require('./_qc');

const PROVIDERS = ['monnify', 'opay'];
const bad = (res, code, msg, extra) => res.status(code).json(Object.assign({ ok: false, error: msg }, extra || {}));
const kobo = (n) => Math.round(Number(n) * 100);
const jfetch = async (url, opt) => {
  const r = await fetch(url, opt); const t = await r.text(); let j = null;
  try { j = JSON.parse(t); } catch (e) { j = { raw: t.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, json: j };
};
const vault = (p) => 'online_' + p;
const cfgPath = (base, p) => `${base}/settings/online_pay/${p}`;

// Required secret fields per provider (merchantId / contractCode live in the vault too)
const FIELDS = {
  monnify: ['apiKey', 'secretKey', 'contractCode'],
  opay: ['merchantId', 'publicKey', 'secretKey'],
};

/* ── who is allowed to change payment keys ── */
async function ownerPasswordOk(owner, password) {
  owner = String(owner || '').toLowerCase(); password = String(password || '');
  if (!owner || !password) return false;
  if (owner === 'admin') return !!process.env.QC_ADMIN_PASSWORD && password === process.env.QC_ADMIN_PASSWORD;
  const users = await fbGet(`${MAIN}/users`);
  if (!users || typeof users !== 'object') return false;
  const want = Buffer.from(password, 'utf8').toString('base64'); // same scheme the login uses
  return Object.values(users).some((u) => u && typeof u === 'object' && !u.isStaff && String(u.username || '').toLowerCase() === owner && u.password === want);
}

/* ═════════════ MONNIFY (Moniepoint) ═════════════ */
const monBase = (cfg) => (cfg.env === 'sandbox' ? 'https://sandbox.monnify.com' : 'https://api.monnify.com');
async function monToken(cfg, sec) {
  const basic = Buffer.from(`${sec.apiKey}:${sec.secretKey}`).toString('base64');
  const r = await jfetch(monBase(cfg) + '/api/v1/auth/login', { method: 'POST', headers: { Authorization: 'Basic ' + basic } });
  const t = r.json && r.json.responseBody && r.json.responseBody.accessToken;
  if (!r.ok || !t) throw new Error((r.json && r.json.responseMessage) || 'Monnify rejected the API Key / Secret Key');
  return t;
}
const monnify = {
  async init(ctx) {
    const token = await monToken(ctx.cfg, ctx.sec);
    const r = await jfetch(monBase(ctx.cfg) + '/api/v1/merchant/transactions/init-transaction', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(ctx.total), customerName: ctx.name, customerEmail: ctx.email,
        paymentReference: ctx.reference, paymentDescription: ('Order ' + ctx.reference).slice(0, 100),
        currencyCode: 'NGN', contractCode: ctx.sec.contractCode, redirectUrl: ctx.returnUrl,
        paymentMethods: ['CARD', 'ACCOUNT_TRANSFER'],
      }),
    });
    const d = r.json && r.json.responseBody;
    if (!r.ok || !d || !d.checkoutUrl) return { ok: false, error: (r.json && r.json.responseMessage) || ('Monnify error ' + r.status) };
    return { ok: true, url: d.checkoutUrl, payRef: d.transactionReference };
  },
  async verify(ctx) {
    const token = await monToken(ctx.cfg, ctx.sec);
    let r = null;
    if (ctx.order.payRef) r = await jfetch(`${monBase(ctx.cfg)}/api/v2/transactions/${encodeURIComponent(ctx.order.payRef)}`, { headers: { Authorization: 'Bearer ' + token } });
    if (!r || !r.ok) {
      const basic = Buffer.from(`${ctx.sec.apiKey}:${ctx.sec.secretKey}`).toString('base64');
      r = await jfetch(`${monBase(ctx.cfg)}/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(ctx.reference)}`, { headers: { Authorization: 'Basic ' + basic } });
    }
    const d = r.json && r.json.responseBody;
    if (!r.ok || !d) return { ok: false, error: (r.json && r.json.responseMessage) || ('Monnify error ' + r.status) };
    const st = String(d.paymentStatus || '').toUpperCase(), got = Number(d.amountPaid);
    const paid = (st === 'PAID' || st === 'OVERPAID') && got + 0.01 >= ctx.total;
    return { ok: true, paid, pending: st === 'PENDING', status: st, amount: got };
  },
};

/* ═════════════ OPAY (Cashier / Checkout) ═════════════ */
const opBase = (cfg) => (cfg.env === 'sandbox' ? 'https://testapi.opaycheckout.com' : 'https://liveapi.opaycheckout.com');
const opay = {
  async init(ctx) {
    const body = {
      country: 'NG', reference: ctx.reference,
      amount: { total: kobo(ctx.total), currency: 'NGN' },
      returnUrl: ctx.returnUrl, cancelUrl: ctx.returnUrl, expireAt: 30,
      userInfo: { userEmail: ctx.email, userId: ctx.email, userMobile: ctx.phone, userName: ctx.name },
      product: { name: ('Order ' + ctx.reference).slice(0, 60), description: 'Online order' },
    };
    const r = await jfetch(opBase(ctx.cfg) + '/api/v1/international/cashier/create', {
      method: 'POST', headers: { Authorization: 'Bearer ' + ctx.sec.publicKey, MerchantId: ctx.sec.merchantId, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = r.json || {}, d = j.data || {};
    if (j.code !== '00000' || !d.cashierUrl) return { ok: false, error: j.message || ('OPay error ' + r.status) };
    return { ok: true, url: d.cashierUrl, payRef: d.orderNo };
  },
  async verify(ctx) {
    const raw = JSON.stringify({ country: 'NG', reference: ctx.reference });
    const sig = crypto.createHmac('sha512', ctx.sec.secretKey).update(raw).digest('hex');
    const r = await jfetch(opBase(ctx.cfg) + '/api/v1/international/cashier/status', {
      method: 'POST', headers: { Authorization: 'Bearer ' + sig, MerchantId: ctx.sec.merchantId, 'Content-Type': 'application/json' }, body: raw,
    });
    const j = r.json || {}, d = j.data || {};
    if (j.code !== '00000') return { ok: false, error: j.message || ('OPay error ' + r.status) };
    const st = String(d.status || '').toUpperCase();
    const tot = d.amount && d.amount.total != null ? Number(d.amount.total) : null;
    const paid = st === 'SUCCESS' && (tot == null || tot >= kobo(ctx.total));
    return { ok: true, paid, pending: st === 'INITIAL' || st === 'PENDING', status: st };
  },
};
const ADAPTERS = { monnify, opay };

/* ── helpers on orders ── */
// Price the order from the owner's own product list so a customer can never change the amount.
async function priceOrder(base, order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) throw new Error('This order has no items.');
  let total = 0;
  for (const it of items) {
    const id = it.k || it.id, qty = Math.max(1, Math.floor(Number(it.q || it.qty) || 0));
    const p = id ? await fbGet(`${base}/products/${enc(id)}`) : null;
    if (!p || !Number(p.price)) throw new Error('A product in this order is no longer available.');
    total += Number(p.price) * qty;
  }
  return Math.round(total * 100) / 100;
}
async function deductStock(base, order) {
  for (const it of order.items || []) {
    const id = it.k || it.id, qty = Math.max(1, Math.floor(Number(it.q || it.qty) || 0));
    if (!id) continue;
    const p = await fbGet(`${base}/products/${enc(id)}`);
    if (!p || typeof p.quantity !== 'number') continue; // stock not tracked
    await fetch(`${base}/products/${enc(id)}/quantity.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ '.sv': { increment: -qty } }) }).catch(() => {});
  }
}
const publicOrder = (o) => ({ ref: o.ref, status: o.status, method: o.method, total: o.total, customer: { name: (o.customer && o.customer.name) || o.customerName || '', phone: (o.customer && o.customer.phone) || o.phone || '' } });
const safeRef = (r) => /^[A-Za-z0-9_-]{6,80}$/.test(String(r || ''));

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return bad(res, 405, 'POST only');
  const b = jbody(req), action = b.action, provider = b.provider;
  try {
    const base = await baseFor(b.owner);

    if (action === 'config') {
      const out = {};
      for (const p of PROVIDERS) {
        const cfg = (await fbGet(cfgPath(base, p))) || {};
        out[p] = { ready: !!cfg.ready, env: cfg.env || 'live', updatedAt: cfg.updatedAt || null };
      }
      return res.status(200).json({ ok: true, providers: out });
    }

    if (action === 'save') {
      if (!PROVIDERS.includes(provider)) return bad(res, 400, 'Unknown provider');
      if (!(await ownerPasswordOk(b.owner, b.password))) return bad(res, 403, 'Wrong password. Enter the password you log in with.');
      const incoming = b.secrets || {};
      const keep = await getSecrets(base, vault(provider)).catch((e) => { if (e.code === 'NO_ENC_KEY') throw e; return {}; });
      FIELDS[provider].forEach((f) => { const v = incoming[f]; if (typeof v === 'string' && v.trim()) keep[f] = v.trim().slice(0, 400); });
      const ready = FIELDS[provider].every((f) => !!keep[f]);
      await putSecrets(base, vault(provider), keep);
      await fbPut(cfgPath(base, provider), { ready, env: b.env === 'sandbox' ? 'sandbox' : 'live', updatedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true, ready });
    }

    if (action === 'init' || action === 'verify') {
      if (action === 'init' && !PROVIDERS.includes(provider)) return bad(res, 400, 'Unknown provider');
      const reference = String(b.reference || '');
      if (!safeRef(reference)) return bad(res, 400, 'Bad order reference');
      const order = await fbGet(`${base}/orders/${enc(reference)}`);
      if (!order) return bad(res, 404, 'Order not found');
      const prov = action === 'init' ? provider : order.payProvider;
      if (!PROVIDERS.includes(prov)) return bad(res, 400, 'This order was not started with an online payment.');
      const cfg = (await fbGet(cfgPath(base, prov))) || {};
      const sec = await getSecrets(base, vault(prov));
      if (!cfg.ready || !FIELDS[prov].every((f) => sec[f])) return bad(res, 400, 'This store has not finished setting up ' + (prov === 'monnify' ? 'Moniepoint' : 'OPay') + ' payments.');

      if (action === 'init') {
        if (order.status !== 'awaiting_payment') return bad(res, 400, 'This order can no longer be paid.');
        let returnUrl = String(b.returnUrl || '');
        try { const u = new URL(returnUrl); if (!/^https?:$/.test(u.protocol)) throw new Error('x'); returnUrl = u.toString(); } catch (e) { return bad(res, 400, 'Bad return URL'); }
        const total = await priceOrder(base, order);
        const c = order.customer || {};
        const r = await ADAPTERS[prov].init({ cfg, sec, total, reference, returnUrl, name: c.name || order.customerName || 'Customer', email: c.email || 'customer@example.com', phone: c.phone || order.phone || '' });
        if (!r.ok) return bad(res, 400, r.error);
        await fbPut(`${base}/orders/${enc(reference)}`, Object.assign({}, order, { payProvider: prov, payRef: r.payRef || '', total, payStartedAt: new Date().toISOString() }));
        return res.status(200).json({ ok: true, url: r.url });
      }

      // verify
      if (order.status === 'paid') return res.status(200).json({ ok: true, paid: true, order: publicOrder(order) });
      const total = await priceOrder(base, order);
      const r = await ADAPTERS[prov].verify({ cfg, sec, order, reference, total });
      if (!r.ok) return bad(res, 502, r.error);
      if (!r.paid) return res.status(200).json({ ok: true, paid: false, pending: !!r.pending, status: r.status || '' });
      const paidOrder = Object.assign({}, order, { status: 'paid', paidAt: new Date().toISOString(), method: prov, total });
      await fbPut(`${base}/orders/${enc(reference)}`, paidOrder); // flag first so a second check can't deduct twice
      await deductStock(base, order);
      return res.status(200).json({ ok: true, paid: true, order: publicOrder(paidOrder) });
    }

    return bad(res, 400, 'Unknown action');
  } catch (e) {
    if (e.code === 'NO_ENC_KEY') return bad(res, 500, e.message, { code: 'NO_ENC_KEY' });
    return bad(res, 500, 'Payment server error: ' + (e.message || e));
  }
};
