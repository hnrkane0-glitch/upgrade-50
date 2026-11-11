/* QuickCart POS — React view layer.
   The POS engine (pos.html + pos-ext.js) keeps owning the data (_prods, _cart), checkout and terminals.
   It calls window.QCPOS.* whenever the list/cart changes; React renders the product grid, category chips and cart. */
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const store = { grid: [], cats: ['All'], active: 'All', cart: [], loading: true, subs: new Set() };
const emit = () => store.subs.forEach((f) => f());
function useStore() {
  const [, n] = useState(0);
  useEffect(() => { const f = () => n((x) => x + 1); store.subs.add(f); return () => store.subs.delete(f); }, []);
  return store;
}
window.QCPOS = {
  grid(list) { store.grid = list || []; store.loading = false; emit(); },
  pills(cats) { store.cats = cats; emit(); },
  active(c) { store.active = c; emit(); },
  cart(c) { store.cart = (c || []).map((x) => ({ ...x })); emit(); },
};

const naira = (n) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');
const Icon = ({ n, s = 18 }) => {
  const P = (window.QCIcons && window.QCIcons.paths) || {};
  return (
    <svg className="qci" data-n={n} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[n] || P.package || 'M12 2v20M2 12h20'} />
    </svg>
  );
};
const catIcon = (c) => {
  c = String(c || '').toLowerCase();
  if (c === 'all') return 'layers';
  if (/phone|mobile|tablet/.test(c)) return 'phone';
  if (/laptop|computer|pc/.test(c)) return 'laptop';
  if (/gam/.test(c)) return 'gamepad';
  if (/access|audio|head|ear/.test(c)) return 'headphones';
  if (/electr|power|cable|charg/.test(c)) return 'plug';
  if (/shoe|fashion|cloth|wear|bag|sneak/.test(c)) return 'bag';
  if (/gift|toy/.test(c)) return 'gift';
  if (/camera|photo/.test(c)) return 'camera';
  if (/home|kitchen|furn/.test(c)) return 'home';
  return 'tag';
};
const HUES = [['#ff5a1f', '#ff8a3d'], ['#14306b', '#2a58c8'], ['#0a1f44', '#1d3a75'], ['#e8480f', '#ffb36b'], ['#2a58c8', '#6c8fe8']];
const hue = (s) => HUES[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];

function Thumb({ src, name, size }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  if (src && !bad) return <img className="qp-img" src={src} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setBad(true)} />;
  const [a, b] = hue(name || '?');
  return <span className="qp-img qp-ph" style={{ background: `linear-gradient(135deg,${a},${b})` }}>{(name || '?').trim().charAt(0).toUpperCase()}</span>;
}

function Card({ p, inCart }) {
  const qty = Number(p.quantity) || 0;
  const oos = p.inStock === false || qty <= 0;
  const low = !oos && qty <= (Number(p.reorderPoint) || 5);
  const [pops, setPops] = useState([]);
  const img = window.prodImg ? window.prodImg(p) : p.image || '';
  const add = () => {
    if (oos) { window.addItem && window.addItem(p._k); return; }
    window.addItem && window.addItem(p._k);
    const id = Math.random();
    setPops((x) => [...x, id]);
    setTimeout(() => setPops((x) => x.filter((i) => i !== id)), 800);
  };
  return (
    <button type="button" className={'pcx' + (oos ? ' oos' : '') + (inCart ? ' in' : '')} onClick={add} title={p.name}>
      <Thumb src={img} name={p.name} size={46} />
      <span className="pcx-body">
        <span className="pcx-name">{p.name || 'Product'}</span>
        <span className="pcx-price">{naira(p.price)}</span>
        <span className={'pcx-stock' + (oos ? ' out' : low ? ' low' : '')}>{oos ? 'Out of stock' : low ? `Low · ${qty} left` : `${qty} in stock`}</span>
      </span>
      <span className="pcx-add" aria-hidden="true"><Icon n="plus" s={16} /></span>
      {inCart > 0 && <span className="pcx-badge" key={inCart}>{inCart}</span>}
      {pops.map((id) => <span key={id} className="pcx-pop">+1</span>)}
    </button>
  );
}

function Grid() {
  const s = useStore();
  const inCart = {}; s.cart.forEach((i) => { inCart[i._k] = i.qty; });
  if (s.loading) return Array.from({ length: 12 }, (_, i) => <div key={i} className="pcx sk" style={{ animationDelay: i * 60 + 'ms' }} />);
  if (!s.grid.length) return (
    <div className="qp-empty"><div className="qp-empty-ico"><Icon n="search" s={34} /></div><b>No products found</b><span>Try another word, a barcode, or a different category.</span></div>
  );
  return s.grid.map((p) => <Card key={p._k} p={p} inCart={inCart[p._k] || 0} />);
}

function Pills() {
  const s = useStore();
  return s.cats.map((c) => (
    <button key={c} type="button" className={'cp' + (c === s.active ? ' on' : '')}
      onClick={() => window.filterCat && window.filterCat(c)}>
      <Icon n={catIcon(c)} s={15} />{c}
    </button>
  ));
}

function Row({ item }) {
  return (
    <div className="cix">
      <Thumb src={item.img} name={item.name} size={40} />
      <div className="cix-info"><b>{item.name}</b><small>{naira(item.price)} each</small></div>
      <div className="cix-step">
        <button type="button" onClick={() => window.adjQty(item._k, -1)} aria-label="Less">−</button>
        <span key={item.qty} className="cix-q">{item.qty}</span>
        <button type="button" onClick={() => window.adjQty(item._k, 1)} aria-label="More">+</button>
      </div>
      <div className="cix-total">{naira(item.price * item.qty)}</div>
      <button type="button" className="cix-del" onClick={() => window.remItem(item._k)} aria-label="Remove"><Icon n="trash" s={16} /></button>
    </div>
  );
}
function Cart() {
  const s = useStore();
  if (!s.cart.length) return (
    <div className="cart-empty qp-cart-empty"><div className="qp-bag"><Icon n="cart" s={40} /></div><b>Your sale is empty</b><span>Tap a product or scan a barcode to start.</span></div>
  );
  return s.cart.map((i) => <Row key={i._k} item={i} />);
}

/* animated money: count up/down to the new value, and bump the item counter */
function liveNumbers() {
  const parse = (t) => Number(String(t).replace(/[^0-9.-]/g, '')) || 0;
  ['ctot', 'csub'].forEach((id) => {
    const el = document.getElementById(id); if (!el) return;
    let shown = parse(el.textContent), raf = 0;
    const obs = new MutationObserver(() => {
      const target = parse(el.textContent); // an external write (the POS engine) = the new target
      if (target === shown) return;
      const from = shown, t0 = performance.now(), dur = 450;
      cancelAnimationFrame(raf);
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        shown = k < 1 ? from + (target - from) * e : target;
        el.textContent = naira(shown); obs.takeRecords(); // ignore our own writes
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  });
  const cc = document.getElementById('cc');
  if (cc) new MutationObserver(() => { cc.classList.remove('bump'); void cc.offsetWidth; cc.classList.add('bump'); }).observe(cc, { childList: true, characterData: true, subtree: true });
}

function mount(id, C) {
  const el = document.getElementById(id); if (!el) return;
  el.setAttribute('data-noicons', ''); // the icon engine must not rewrite React-owned DOM
  createRoot(el).render(<C />);
}
mount('cpills', Pills); mount('pgrid', Grid); mount('citems', Cart);
liveNumbers();
