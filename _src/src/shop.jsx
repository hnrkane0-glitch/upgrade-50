import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_DESIGN, mergeDesign, Announcement, BannerSlider, Section, applyTheme, safeUrl, safeImg } from './blocks.jsx';

/* ───────── store identity & data namespace ───────── */
const params = new URLSearchParams(location.search);
const OWNER = (params.get('store') || localStorage.getItem('qc_store_owner') || '').trim();
if (params.get('store')) { try { localStorage.setItem('qc_store_owner', OWNER); } catch (e) {} }
const NS = window.QCDB ? QCDB.baseFor(OWNER) : '';
const MAIN = window.QCDB ? QCDB.MAIN : '';
const EDIT = params.get('edit') === '1' && window.parent !== window;
const PREVIEW = params.get('preview') === '1' && window.parent !== window;
const viewer = (localStorage.getItem('qc_owner') || localStorage.getItem('qc_logged_user') || '').toLowerCase();
const IS_OWNER = !!viewer && (viewer === OWNER.toLowerCase());
const CART_KEY = 'qc_cart_' + OWNER;
const WISH_KEY = 'qc_wish_' + OWNER;

const naira = (n) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');
const jget = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const EMOJI = { Smartphones: '📱', Laptops: '💻', Gaming: '🎮', Electronics: '🔌', Accessories: '🎧', Fashion: '👔', Sneakers: '👟', Appliances: '🏠' };
const GRADS = [['#ff7a45', '#ffb36b'], ['#6a5cff', '#9a8cff'], ['#00b894', '#55efc4'], ['#e84393', '#fd79a8'], ['#0984e3', '#74b9ff'], ['#f9a825', '#ffd36b']];
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const waNumber = (p) => { p = String(p || '').replace(/\D/g, ''); if (p.startsWith('0')) p = '234' + p.slice(1); return p; };

function loadPaystack() {
  return new Promise((res, rej) => {
    if (window.PaystackPop) return res();
    const s = document.createElement('script'); s.src = 'https://js.paystack.co/v1/inline.js';
    s.onload = () => res(); s.onerror = () => rej(new Error('paystack')); document.head.appendChild(s);
  });
}

/* ───────── tiny hooks ───────── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    const o = new IntersectionObserver((e) => e.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); o.disconnect(); } }), { threshold: 0.12 });
    o.observe(el); return () => o.disconnect();
  }, []);
  return ref;
}

/* ───────── components ───────── */
function Img({ p, big }) {
  const [bad, setBad] = useState(false);
  const src = p.image || p.img || '';
  if (src && !bad) return <img src={src} alt={p.name} loading="lazy" onError={() => setBad(true)} />;
  const g = GRADS[hash(p.name || '') % GRADS.length];
  return (
    <div className="ph" style={{ background: `linear-gradient(135deg,${g[0]},${g[1]})` }}>
      <span style={{ fontSize: big ? 84 : 46 }}>{EMOJI[p.category] || '🛍️'}</span>
    </div>
  );
}

function Card({ p, onAdd, onOpen, wished, onWish, idx }) {
  const ref = useReveal();
  const stock = typeof p.quantity === 'number' ? p.quantity : null;
  const out = stock !== null && stock <= 0;
  const off = p.originalPrice && p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  return (
    <article ref={ref} className={'card reveal' + (out ? ' out' : '')} style={{ transitionDelay: Math.min(idx % 8, 7) * 45 + 'ms' }}>
      <div className="card-img" onClick={() => onOpen(p)}>
        <Img p={p} />
        {off > 0 && <span className="badge off">-{off}%</span>}
        {!off && p.tag && <span className="badge tag">{p.tag}</span>}
        {out && <span className="badge sold">Sold out</span>}
        <button className={'heart' + (wished ? ' on' : '')} aria-label="Save" onClick={(e) => { e.stopPropagation(); onWish(p.id); }}>{wished ? '♥' : '♡'}</button>
      </div>
      <div className="card-b">
        {p.brand && <div className="brand">{p.brand}</div>}
        <h3 onClick={() => onOpen(p)}>{p.name}</h3>
        <div className="prices"><b className="price">{naira(p.price)}</b>{off > 0 && <s>{naira(p.originalPrice)}</s>}</div>
        {stock !== null && stock > 0 && stock <= 5 && <div className="low">Only {stock} left</div>}
        <button className="add" disabled={out} onClick={() => onAdd(p)}>{out ? 'Sold out' : 'Add to cart'}</button>
      </div>
    </article>
  );
}

function QuickView({ p, onClose, onAdd }) {
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const [size, setSize] = useState(sizes[0] || '');
  const stock = typeof p.quantity === 'number' ? p.quantity : null;
  const out = stock !== null && stock <= 0;
  const off = p.originalPrice && p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  const [gal, setGal] = useState([]); const [gi, setGi] = useState(0);
  useEffect(() => { setGal([]); setGi(0); if (p.hasGallery) jget(NS + '/product_gallery/' + encodeURIComponent(p.id) + '.json').then((g) => { if (Array.isArray(g)) setGal(g.filter((x) => safeImg(x))); }); }, [p.id]);
  return (
    <div className="ov" onClick={onClose}>
      <div className="qv" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">✕</button>
        <div className="qv-img">{gal.length > 1 ? <img src={gal[gi]} alt={p.name} /> : <Img p={p} big />}{gal.length > 1 && <div className="qv-th">{gal.map((g, i) => <button key={i} className={i === gi ? 'on' : ''} onClick={() => setGi(i)}><img src={g} alt="" /></button>)}</div>}</div>
        <div className="qv-b">
          {p.brand && <div className="brand">{p.brand}</div>}
          <h2>{p.name}</h2>
          <div className="prices big"><b className="price">{naira(p.price)}</b>{off > 0 && <><s>{naira(p.originalPrice)}</s><span className="badge off inline">-{off}%</span></>}</div>
          {p.description && <p className="desc">{p.description}</p>}
          {Array.isArray(p.keySpecs) && p.keySpecs.length > 0 && <ul className="specs">{p.keySpecs.slice(0, 6).map((s, i) => <li key={i}>{typeof s === 'string' ? s : (s.label ? s.label + ': ' : '') + (s.value || '')}</li>)}</ul>}
          {sizes.length > 0 && <div className="sizes">{sizes.map((s) => <button key={s} className={s === size ? 'on' : ''} onClick={() => setSize(s)}>{s}</button>)}</div>}
          {stock !== null && stock > 0 && stock <= 5 && <div className="low">Only {stock} left in stock</div>}
          <button className="add big" disabled={out} onClick={() => { onAdd(p, size); onClose(); }}>{out ? 'Sold out' : 'Add to cart · ' + naira(p.price)}</button>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ open, cart, setQty, remove, onClose, onCheckout }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <>
      <div className={'ov side' + (open ? ' on' : '')} onClick={onClose} />
      <aside className={'drawer' + (open ? ' on' : '')} aria-hidden={!open}>
        <div className="dr-h"><h3>Your cart <span>({cart.reduce((s, i) => s + i.qty, 0)})</span></h3><button className="x" onClick={onClose}>✕</button></div>
        <div className="dr-body">
          {!cart.length && <div className="dr-empty"><div>🛒</div><p>Your cart is empty</p><button className="ghost" onClick={onClose}>Keep shopping</button></div>}
          {cart.map((i) => (
            <div className="line" key={i.key}>
              <div className="line-img"><Img p={i} /></div>
              <div className="line-b">
                <div className="line-n">{i.name}{i.size ? <em> · {i.size}</em> : null}</div>
                <div className="line-p">{naira(i.price)}</div>
                <div className="qty"><button onClick={() => setQty(i.key, i.qty - 1)}>−</button><span>{i.qty}</span><button onClick={() => setQty(i.key, i.qty + 1)}>+</button></div>
              </div>
              <button className="rm" onClick={() => remove(i.key)} aria-label="Remove">🗑</button>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="dr-f">
            <div className="tot"><span>Subtotal</span><b>{naira(total)}</b></div>
            <button className="add big" onClick={onCheckout}>Checkout</button>
          </div>
        )}
      </aside>
    </>
  );
}

function Checkout({ cart, cfg, brandName, onClose, onDone }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const methods = [];
  const opt = (k, d) => (cfg.opts ? !!cfg.opts[k] : d);
  if (cfg.paystack && opt('card', true)) methods.push(['card', '💳 Pay now (card)']);
  if (cfg.opts && cfg.opts.monnify && cfg.online && cfg.online.monnify && cfg.online.monnify.ready) methods.push(['monnify', '💳 Pay now (Moniepoint)']);
  if (cfg.opts && cfg.opts.opay && cfg.online && cfg.online.opay && cfg.online.opay.ready) methods.push(['opay', '💳 Pay now (OPay)']);
  if (cfg.bank && cfg.bank.accountNumber && opt('transfer', true)) methods.push(['transfer', '🏦 Bank transfer']);
  if (cfg.phone && opt('whatsapp', true)) methods.push(['whatsapp', '💬 Order on WhatsApp']);
  if (opt('cod', false)) methods.push(['cod', '🚚 Pay on delivery']);
  if (!methods.length) methods.push(['cod', '📝 Place order (pay on delivery)']);
  const [method, setMethod] = useState(methods[0][0]);
  const [f, setF] = useState({ name: '', email: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(order) {
    await fetch(NS + '/orders/' + order.ref + '.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
    await Promise.all(order.items.filter((i) => i.stockTracked).map((i) =>
      fetch(NS + '/products/' + encodeURIComponent(i.k) + '/quantity.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ '.sv': { increment: -i.q } }) }).catch(() => {})));
  }
  async function submit() {
    setErr('');
    if (!f.name.trim()) return setErr('Please enter your full name');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Please enter a valid email');
    if (f.phone.replace(/\D/g, '').length < 10) return setErr('Please enter a valid phone number');
    if (!f.address.trim()) return setErr('Please enter your delivery address');
    setBusy(true);
    const ref = 'QC_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const base = {
      ref, customer: { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), address: f.address.trim() },
      customerName: f.name.trim(), phone: f.phone.trim(), address: f.address.trim(),
      items: cart.map((i) => ({ k: i.id, id: i.id, name: i.name, price: i.price, q: i.qty, qty: i.qty, size: i.size || '', image: i.image || '', stockTracked: i.stockTracked })),
      total, method, source: 'online', createdAt: new Date().toISOString(),
    };
    try {
      if (method === 'card') {
        await loadPaystack();
        const h = window.PaystackPop.setup({
          key: cfg.paystack, email: f.email.trim(), amount: Math.max(10000, Math.round(total * 100)), currency: 'NGN', ref,
          metadata: { custom_fields: [{ display_name: 'Name', variable_name: 'name', value: f.name }, { display_name: 'Phone', variable_name: 'phone', value: f.phone }] },
          callback: function (r) { save({ ...base, ref: r.reference || ref, status: 'paid' }).then(() => onDone({ ...base, status: 'paid' })); },
          onClose: function () { setBusy(false); },
        });
        h.openIframe();
        return;
      }
      if (method === 'monnify' || method === 'opay') {
        // hosted card page (Moniepoint/Monnify or OPay): save the order unpaid, then send the customer to pay
        await fetch(NS + '/orders/' + ref + '.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, status: 'awaiting_payment' }) });
        let tu; try { tu = new URL(window.top.location.href); } catch (e) { tu = new URL(window.location.href); }
        tu.searchParams.set('qc_pay', ref); tu.hash = '';
        const rr = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'init', owner: OWNER, provider: method, reference: ref, returnUrl: tu.toString() }) }).then((x) => x.json()).catch(() => null);
        if (!rr || !rr.ok || !rr.url) { setErr((rr && rr.error) || 'Could not start the payment. Please try another method.'); setBusy(false); return; }
        try { window.top.location.href = rr.url; } catch (e) { window.location.href = rr.url; }
        return;
      }
      await save({ ...base, status: 'pending' });
      if (method === 'whatsapp' && cfg.phone) {
        const lines = cart.map((i) => `• ${i.qty} × ${i.name}${i.size ? ' (' + i.size + ')' : ''} — ${naira(i.price * i.qty)}`).join('\n');
        const msg = `Hello ${brandName}! I'd like to order:\n${lines}\n\nTotal: ${naira(total)}\nName: ${f.name}\nPhone: ${f.phone}\nAddress: ${f.address}\nRef: ${ref}`;
        window.open('https://wa.me/' + waNumber(cfg.phone) + '?text=' + encodeURIComponent(msg), '_blank');
      }
      onDone({ ...base, status: 'pending' });
    } catch (e) { setErr('Something went wrong. Please try again.'); setBusy(false); }
  }

  return (
    <div className="ov" onClick={onClose}>
      <div className="co" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <h2>Checkout</h2>
        <p className="muted">{cart.reduce((s, i) => s + i.qty, 0)} item(s) · <b>{naira(total)}</b></p>
        <div className="grid2">
          <label>Full name<input value={f.name} onChange={up('name')} autoComplete="name" /></label>
          <label>Phone<input value={f.phone} onChange={up('phone')} inputMode="tel" autoComplete="tel" /></label>
        </div>
        <label>Email<input value={f.email} onChange={up('email')} type="email" autoComplete="email" /></label>
        <label>Delivery address<textarea rows="2" value={f.address} onChange={up('address')} /></label>
        <div className="methods">{methods.map(([k, l]) => <button key={k} className={method === k ? 'on' : ''} onClick={() => setMethod(k)}>{l}</button>)}</div>
        {method === 'transfer' && cfg.bank && (
          <div className="bank"><b>{cfg.bank.bankName}</b><span>{cfg.bank.accountNumber}</span><small>{cfg.bank.accountName}</small><small>Transfer {naira(total)}, then send your receipt to us. Your order is reserved.</small></div>
        )}
        {err && <div className="err">{err}</div>}
        <button className="add big" disabled={busy} onClick={submit}>{busy ? 'Please wait…' : method === 'card' || method === 'monnify' || method === 'opay' ? 'Pay ' + naira(total) : 'Place order · ' + naira(total)}</button>
        <p className="secure">🔒 Your details are only shared with {brandName}.</p>
      </div>
    </div>
  );
}

function Success({ order, cfg, onClose }) {
  return (
    <div className="ov" onClick={onClose}>
      <div className="co ok" onClick={(e) => e.stopPropagation()}>
        <div className="check">✓</div>
        <h2>{order.status === 'paid' ? 'Payment received!' : 'Order placed!'}</h2>
        <p className="muted">Reference <b>{order.ref}</b></p>
        {order.status === 'pending' && order.method === 'transfer' && cfg.bank && <div className="bank"><b>{cfg.bank.bankName}</b><span>{cfg.bank.accountNumber}</span><small>{cfg.bank.accountName}</small><small>Pay {naira(order.total)} to complete your order.</small></div>}
        <p>Thank you, {order.customer.name.split(' ')[0]}! We'll reach you on {order.customer.phone} shortly.</p>
        <button className="add big" onClick={onClose}>Continue shopping</button>
      </div>
    </div>
  );
}

function Toast({ t }) { return <div className={'toast' + (t ? ' on' : '')}>{t}</div>; }

/* ───────── app ───────── */
function App() {
  const [info, setInfo] = useState({ name: '', phone: '' });
  const [products, setProducts] = useState(null);
  const [cfg, setCfg] = useState({ paystack: '', bank: null, phone: '' });
  const [cart, setCart] = useState(() => readLS(CART_KEY, []));
  const [wish, setWish] = useState(() => readLS(WISH_KEY, []));
  const [cat, setCat] = useState('All');
  const [sub, setSub] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('new');
  const [qv, setQv] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [co, setCo] = useState(false);
  const [done, setDone] = useState(null);
  const [toast, setToast] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const tt = useRef();

  const say = useCallback((m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(''), 2200); }, []);

  useEffect(() => {
    (async () => {
      const [biz, ph, prods, pk, bank, prof, des, copt, onl] = await Promise.all([
        jget(MAIN + '/users/' + encodeURIComponent(OWNER) + '/businessName.json'),
        jget(MAIN + '/users/' + encodeURIComponent(OWNER) + '/phone.json'),
        jget(NS + '/products.json'),
        jget(NS + '/settings/paystack_key.json'),
        jget(NS + '/settings/bank_account.json'),
        jget(NS + '/settings/store_profile.json'),
        jget(NS + '/settings/store_design.json'),
        jget(NS + '/settings/checkout_options.json'),
        jget(NS + '/settings/online_pay.json'),
      ]);
      if (!PREVIEW || des) setDesign((cur) => (PREVIEW && cur !== DEFAULT_DESIGN ? cur : mergeDesign(des)));
      const name = (prof && prof.name) || (typeof biz === 'string' && biz) || (OWNER && OWNER.toLowerCase() !== 'admin' ? OWNER : 'QuickCart Store');
      setInfo({ name, phone: (prof && prof.whatsapp) || (typeof ph === 'string' ? ph : ''), tagline: prof && prof.tagline });
      document.title = name;
      setCfg({ paystack: typeof pk === 'string' && /^pk_/.test(pk) ? pk : '', bank: bank && typeof bank === 'object' ? bank : null, phone: (prof && prof.whatsapp) || (typeof ph === 'string' ? ph : ''), opts: copt && typeof copt === 'object' ? copt : null, online: onl && typeof onl === 'object' ? onl : null });
      const list = prods ? Object.entries(prods).map(([id, p]) => ({ id, ...p })).filter((p) => p && p.name && p.price && !p.hidden && p.status !== 'hidden') : [];
      setProducts(list);
      // customer is back from the Moniepoint/OPay payment page → confirm it with the server
      const q = params.get('qc_pay');
      if (q) {
        try {
          const rs = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', owner: OWNER, reference: q }) }).then((x) => x.json());
          if (rs && rs.paid && rs.order) { setCart([]); setDone({ ...rs.order, status: 'paid' }); }
          else { say(rs && rs.pending ? 'We have not received your payment yet. If you paid, please refresh in a minute.' : 'Your payment was not completed.'); }
        } catch (e) { say('Could not confirm your payment. Please contact the store with reference ' + q); }
        try { const tu = new URL(window.top.location.href); tu.searchParams.delete('qc_pay'); window.top.history.replaceState(null, '', tu.toString()); } catch (e) {}
      }
    })();
    const onMsg = (e) => { if (e.origin !== location.origin || !e.data || e.data.type !== 'qc-design') return; setDesign(mergeDesign(e.data.design)); };
    if (PREVIEW) { window.addEventListener('message', onMsg); try { window.parent.postMessage({ type: 'qc-ready' }, location.origin); } catch (e) {} }
    const onS = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onS, { passive: true });
    window.QC_SHOWVIEW = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    return () => { window.removeEventListener('scroll', onS); window.removeEventListener('message', onMsg); };
  }, []);
  useEffect(() => { applyTheme(design); }, [design]);

  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} }, [cart]);
  useEffect(() => { try { localStorage.setItem(WISH_KEY, JSON.stringify(wish)); } catch (e) {} }, [wish]);

  const catList = useMemo(() => {
    const fromProducts = Array.from(new Set((products || []).map((p) => p.category).filter(Boolean)));
    const custom = (design.categories || []).filter((c) => c && c.name);
    const shownCustom = custom.filter((c) => !c.hidden).map((c) => ({ name: c.name, meta: c }));
    const rest = fromProducts.filter((n) => !custom.some((c) => c.name === n)).map((n) => ({ name: n, meta: {} }));
    return [...shownCustom, ...rest];
  }, [products, design.categories]);
  const cats = useMemo(() => ['All', ...catList.map((c) => c.name)], [catList]);
  const subsOf = (name) => { const c = catList.find((x) => x.name === name); return c && c.meta && Array.isArray(c.meta.subs) ? c.meta.subs.filter(Boolean) : []; };
  const curSubs = useMemo(() => subsOf(cat), [cat, catList]);
  const inCat = (p) => {
    if (cat === 'All') return true;
    const subs = subsOf(cat);
    if (sub) return (p.category === cat || subs.includes(p.category)) && (p.subcategory === sub || p.category === sub);
    return p.category === cat || subs.includes(p.category);
  };
  const shown = useMemo(() => {
    let l = (products || []).filter((p) => inCat(p) && (!q || (p.name + ' ' + (p.brand || '')).toLowerCase().includes(q.toLowerCase())));
    if (sort === 'low') l = [...l].sort((a, b) => a.price - b.price);
    if (sort === 'high') l = [...l].sort((a, b) => b.price - a.price);
    return l;
  }, [products, cat, sub, q, sort, catList]);

  function add(p, size) {
    const stock = typeof p.quantity === 'number' ? p.quantity : null;
    const key = p.id + '|' + (size || '');
    setCart((c) => {
      const ex = c.find((i) => i.key === key);
      const have = ex ? ex.qty : 0;
      if (stock !== null && have + 1 > stock) { say('Only ' + stock + ' available'); return c; }
      say('Added to cart ✓');
      if (ex) return c.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { key, id: p.id, name: p.name, price: Number(p.price), image: p.image || p.img || '', category: p.category, size: size || '', qty: 1, stockTracked: stock !== null, max: stock }];
    });
  }
  const setQty = (key, n) => setCart((c) => c.map((i) => (i.key === key ? { ...i, qty: Math.max(1, i.max != null ? Math.min(n, i.max) : n) } : i)));
  const remove = (key) => setCart((c) => c.filter((i) => i.key !== key));
  const toggleWish = (id) => setWish((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const initial = (info.name || '?').trim().charAt(0).toUpperCase();
  const wa = waNumber(cfg.phone);

  const D = design, brandName = (D.brand && D.brand.name) || info.name, logo = safeImg(D.brand && D.brand.logo);
  const navLinks = (D.nav && D.nav.links && D.nav.links.length ? D.nav.links : [{ label: 'Shop', url: '#products' }, { label: 'About', url: '#about' }, { label: 'Contact', url: '#contact' }]).filter((l) => l.label && safeUrl(l.url));
  const H = D.hero || {}, heroTitle = H.title || (brandName ? null : '');
  const pickCat = (n, sb) => { setCat(n); setSub(sb || ''); const el = document.getElementById('products'); if (el) el.scrollIntoView({ behavior: 'smooth' }); };
  const wrap = (s, el) => el ? <div key={s.id} className={'blkw' + (PREVIEW ? ' pv' : '')} data-blk={s.id} onClickCapture={PREVIEW ? (e) => { e.preventDefault(); e.stopPropagation(); try { window.parent.postMessage({ type: 'qc-select', id: s.id }, location.origin); } catch (er) {} } : undefined}>{el}</div> : null;
  const renderBlock = (s) => {
    if (s.hidden) return null;
    if (s.type === 'hero') return wrap(s, D.banners && D.banners.length ? <BannerSlider banners={D.banners} speed={D.bannerSpeed} /> : (
      <section className="hero">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
        <div className="hero-in">
          {H.eyebrow !== '' && <span className="eyebrow">{H.eyebrow || '✨ Welcome'}</span>}
          <h1 className="hero-h">{H.title ? H.title : brandName ? <>Shop at <em>{brandName}</em></> : <>&nbsp;</>}</h1>
          <p className="hero-p">{H.subtitle || info.tagline || 'Quality products, honest prices and fast delivery. Browse the collection and order in a few taps.'}</p>
          <div className="hero-cta">
            {(H.cta1 === undefined || H.cta1) && <a className="btn-main" href={safeUrl(H.cta1Link) || '#products'}>{H.cta1 || 'Shop now ↓'}</a>}
            {H.cta2 ? <a className="btn-alt" href={safeUrl(H.cta2Link) || '#products'}>{H.cta2}</a> : wa && <a className="btn-alt" href={'https://wa.me/' + wa} target="_blank" rel="noreferrer">Chat on WhatsApp</a>}
          </div>
          {H.showTrust !== false && <div className="trust"><span>🔒 Secure checkout</span><span>🚚 Delivery available</span><span>💬 Friendly support</span></div>}
        </div>
      </section>));
    if (s.type === 'products') return wrap(s, (
      <main className="sec" id="products">
        <div className="sec-h"><h2>{(D.products && D.products.title) || (products && products.length ? 'Our products' : 'Products')}</h2>{products && products.length > 0 && <span className="muted">{shown.length} item{shown.length !== 1 ? 's' : ''}</span>}</div>
        {products && products.length > 0 && (
          <div className="tools">
            <div className="chips">{cats.map((c) => <button key={c} className={c === cat ? 'on' : ''} onClick={() => { setCat(c); setSub(''); }}>{c}</button>)}</div>
            {curSubs.length > 0 && <div className="chips subchips"><button className={!sub ? 'on' : ''} onClick={() => setSub('')}>All {cat}</button>{curSubs.map((c) => <button key={c} className={c === sub ? 'on' : ''} onClick={() => setSub(c)}>{c}</button>)}</div>}
            <div className="tools-r">
              {(!D.products || D.products.showSearch !== false) && <input className="search" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />}
              {(!D.products || D.products.showSort !== false) && <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="new">Newest</option><option value="low">Price: low → high</option><option value="high">Price: high → low</option></select>}
            </div>
          </div>
        )}
        {products === null && <div className="grid">{[...Array(8)].map((_, i) => <div className="card skel" key={i}><div className="card-img" /><div className="card-b"><i /><i /><i /></div></div>)}</div>}
        {products && products.length === 0 && (
          <div className="empty">
            <div className="empty-art">🛍️<span>✨</span></div>
            <h3>{IS_OWNER ? 'Your store is ready — add your first product' : 'New products are on the way'}</h3>
            <p>{IS_OWNER ? 'Customers can already see this page. Add products in your dashboard and they appear here instantly.' : 'This store is getting ready. Check back soon, or message us to ask what is coming.'}</p>
            {IS_OWNER ? <a className="btn-main" href="/dashboard" target="_top">Go to dashboard →</a> : wa ? <a className="btn-main" href={'https://wa.me/' + wa} target="_blank" rel="noreferrer">Message us on WhatsApp</a> : null}
          </div>
        )}
        {products && products.length > 0 && shown.length === 0 && <div className="empty small"><h3>No matches</h3><p>Try a different search or category.</p></div>}
        {shown.length > 0 && <div className="grid">{shown.map((p, i) => <Card key={p.id} p={p} idx={i} onAdd={add} onOpen={setQv} wished={wish.includes(p.id)} onWish={toggleWish} />)}</div>}
      </main>));
    if (s.type === 'about') { const A = D.about || {}, img = safeImg(A.image); return wrap(s, (
      <section className="about" id="about"><div className={'about-in' + (img ? ' with-img' : '')}>{img && <img className="about-img" src={img} alt="" loading="lazy" />}<div><h2>{A.title || 'About ' + (brandName || 'us')}</h2><p style={{ whiteSpace: 'pre-line' }}>{A.text || 'We are a local business that cares about quality and great service. Every order is packed with care and supported by real people.'}</p></div></div></section>)); }
    return wrap(s, <Section s={s} products={products || []} onAdd={add} onOpen={setQv} wish={wish} onWish={toggleWish} Card={Card} cats={catList} onPick={pickCat} />);
  };
  const F = D.footer || {}, soc = F.socials || {};
  const SOC = [['instagram', 'Instagram', 'https://instagram.com/'], ['facebook', 'Facebook', 'https://facebook.com/'], ['tiktok', 'TikTok', 'https://tiktok.com/@'], ['x', 'X', 'https://x.com/'], ['youtube', 'YouTube', 'https://youtube.com/@']];
  const socUrl = (k, base, v) => (/^https?:/i.test(v) ? v : base + String(v).replace(/^@/, ''));

  return (
    <div id="home-view">
      <Announcement a={D.announcement} />
      <header className={'nav' + (scrolled ? ' scrolled' : '')} id="top">
        <div className="nav-in">
          <a className="logo" href="#top">{logo ? <img className="logo-img" src={logo} alt={brandName} style={{ height: Math.max(20, Math.min(80, Number(D.brand.logoHeight) || 38)) }} /> : <span className="logo-mark">{initial}</span>}{(!logo || D.brand.showName !== false) && <span className="logo-text">{brandName || ' '}</span>}</a>
          <nav className="nav-links">{navLinks.map((l, i) => { const h = safeUrl(l.url); return <a key={i} href={h} {...(/^https?:/i.test(h) ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{l.label}</a>; })}</nav>
          <div className="nav-r">
            {wa && <a className="wa-btn" href={'https://wa.me/' + wa} target="_blank" rel="noreferrer">💬 <span>Chat</span></a>}
            <button className="cart-btn" onClick={() => setDrawer(true)} aria-label="Open cart">🛒{count > 0 && <i key={count}>{count}</i>}</button>
          </div>
        </div>
      </header>

      {(D.layout || []).map(renderBlock)}

      <footer id="contact">
        <div className="foot-in">
          <div><div className="logo light">{logo ? <img className="logo-img" src={logo} alt="" style={{ height: 34 }} /> : <span className="logo-mark">{initial}</span>}<span className="logo-text">{brandName}</span></div><p className="muted-l">{F.text || 'Thanks for shopping with us.'}</p>
            {(F.address || F.hours || F.email || F.phone) && <div className="foot-info">{F.address && <div>📍 {F.address}</div>}{F.hours && <div>🕒 {F.hours}</div>}{F.phone && <div>📞 {F.phone}</div>}{F.email && <div>✉️ {F.email}</div>}</div>}
            <div className="foot-soc">{SOC.filter((x) => soc[x[0]]).map((x) => <a key={x[0]} href={socUrl(x[0], x[2], soc[x[0]])} target="_blank" rel="noreferrer noopener">{x[1]}</a>)}</div></div>
          <div className="foot-links">{wa && <a href={'https://wa.me/' + wa} target="_blank" rel="noreferrer">💬 WhatsApp us</a>}{cfg.phone && <a href={'tel:' + cfg.phone}>📞 {cfg.phone}</a>}<a href="#products">🛍️ Shop</a>{(F.links || []).filter((l) => l.label && safeUrl(l.url)).map((l, i) => <a key={i} href={safeUrl(l.url)} {...(/^https?:/i.test(l.url) ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{l.label}</a>)}</div>
        </div>
        <div className="foot-b">© {new Date().getFullYear()} {brandName}. <a href="/" target="_blank" rel="noreferrer">Powered by QuickCart</a></div>
      </footer>

      {wa && <a className="wa-fab" href={'https://wa.me/' + wa} target="_blank" rel="noreferrer" aria-label="WhatsApp">💬</a>}

      {qv && <QuickView p={qv} onClose={() => setQv(null)} onAdd={add} />}
      <CartDrawer open={drawer} cart={cart} setQty={setQty} remove={remove} onClose={() => setDrawer(false)} onCheckout={() => { setDrawer(false); setCo(true); }} />
      {co && <Checkout cart={cart} cfg={cfg} brandName={info.name} onClose={() => setCo(false)} onDone={(o) => { setCo(false); setCart([]); setDone(o); }} />}
      {done && <Success order={done} cfg={cfg} onClose={() => setDone(null)} />}
      <Toast t={toast} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
