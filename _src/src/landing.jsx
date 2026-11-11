import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

/* ───── editable content ───── */
const PLANS = [ // ← change prices here (monthly, ₦)
  { id: 'starter', name: 'Starter', price: 7900, note: 'per month', cta: 'Start Free Trial',
    feats: [['Online Store (50 products)', 1], ['Paystack Checkout', 1], ['Basic POS', 1], ['Inventory Tracking', 1], ['Advanced Analytics', 0], ['WhatsApp Marketing', 0], ['Accounting Module', 0]] },
  { id: 'pro', name: 'Pro', price: 16590, note: 'per month', hot: true, cta: 'Start Free Trial',
    feats: [['Unlimited Products', 1], ['Full POS + Offline Mode', 1], ['Inventory Management', 1], ['Accounting & Reports', 1], ['WhatsApp Marketing', 1], ['Growth Advisor', 1], ['Custom Domain', 1]] },
  { id: 'ent', name: 'Enterprise', price: 45000, note: 'per month · multi-branch', cta: 'Contact Sales',
    feats: [['Everything in Pro', 1], ['Multiple Branches', 1], ['Staff Management', 1], ['API Access', 1], ['Priority Support', 1], ['White-label Option', 1], ['Dedicated Account Manager', 1]] },
];
const FEATURES = [
  ['🏪', 'Online Store Builder', 'Launch a beautiful, mobile-first store in minutes. Click any element to edit it — no coding, no templates, just your brand.'],
  ['🖥️', 'Point of Sale (POS)', 'Works online and offline. Serve walk-in customers, issue receipts, split payments and sync stock in real time.'],
  ['📦', 'Inventory Management', 'Track every item. Low-stock alerts, batch updates, reorder points, and variants — sizes, colors, units.'],
  ['📒', 'Accounting & Bookkeeping', 'Automated income, expense and profit tracking. P&L, VAT reports and cash flow in one click.'],
  ['📈', 'Growth Advisor', 'Know what to restock before it sells out, which prices to fix, what to clear, and which customers to win back. Your own sales turned into one-click actions.'],
  ['🌐', 'Your Own Domain', 'Connect www.yourbrand.com to your store so customers shop on your name, not ours.'],
];
const STEPS = [
  ['Register & choose a plan', 'Sign up with your email. Pick a plan or start with 14 days completely free — no card required.'],
  ['Customize your store', 'Open the visual editor. Click on any element to change it — logo, colors, text, everything.'],
  ['Add products', 'Add products one by one, scan barcodes, or bulk-import a spreadsheet. Manage stock from the same screen.'],
  ['Start selling', 'Share your store link or your own domain. Use the POS for walk-in customers. Paystack payments straight to you.'],
];
const REVIEWS = [
  ['“QuickCart changed everything for my electronics shop in Ikeja. The POS works even when NEPA takes light, and the inventory sync is perfect.”', 'Chukwuemeka Obi', 'Electronics — Computer Village, Lagos'],
  ['“I was managing my fashion store on WhatsApp before. Now I have a real website, proper inventory, and I can see my profits every day.”', 'Adaeze Nwosu', 'Fashion Boutique — Abuja'],
  ['“The Growth Advisor told me which products to restock before the weekend. I stopped running out of my bestsellers.”', 'Emmanuel Adeyemi', 'General Merchandise — Ibadan'],
  ['“The accounting module alone is worth the subscription. I used to hire an accountant just for monthly reports. Now it’s automatic.”', 'Fatima Suleiman', 'Grocery Store — Kano'],
  ['“Three branches, one dashboard. I can see which branch is performing, transfer stock between them, and manage all cashiers from one place.”', 'Kingsley Eze', 'Multi-branch Supermarket — Port Harcourt'],
];
const FAQ = [
  ['Do I need a card to start?', 'No. Every plan starts with a 14-day free trial and no card is required.'],
  ['Can I use my own domain name?', 'Yes. In your dashboard open “Domain & Store Link”, type your domain and add the DNS record we show you. Your store then opens on your own address.'],
  ['Does the POS work without internet?', 'Yes — the POS has an offline mode, so sales continue when the network or power drops and sync when you are back online.'],
  ['How do I get paid?', 'Customers can pay by card through Paystack, by bank transfer, or you can take the order on WhatsApp. Card payments go straight to your Paystack account.'],
  ['Can my staff use it?', 'Yes. Add staff with their own login and choose exactly which features each person can see.'],
];

const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG');
const open = (t) => { if (window.openModal) window.openModal(t); };

/* ───── hooks ───── */
function useInView(th = 0.15) {
  const ref = useRef(null); const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { setOn(true); return; }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); o.disconnect(); } }, { threshold: th });
    o.observe(el); return () => o.disconnect();
  }, []);
  return [ref, on];
}
function Reveal({ children, d = 0, className = '' }) {
  const [ref, on] = useInView();
  return <div ref={ref} className={'lp-rv ' + (on ? 'in ' : '') + className} style={{ transitionDelay: d + 'ms' }}>{children}</div>;
}
function Count({ to, prefix = '', suffix = '', dec = 0 }) {
  const [ref, on] = useInView(0.4); const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) return; let raf, t0;
    const step = (t) => { t0 = t0 || t; const p = Math.min(1, (t - t0) / 1400); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [on]);
  return <span ref={ref}>{prefix}{dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-NG')}{suffix}</span>;
}
function Spot({ children, className = '' }) { // mouse-follow glow
  const r = useRef(null);
  const mv = (e) => { const b = r.current.getBoundingClientRect(); r.current.style.setProperty('--mx', e.clientX - b.left + 'px'); r.current.style.setProperty('--my', e.clientY - b.top + 'px'); };
  return <div ref={r} className={'lp-spot ' + className} onMouseMove={mv}>{children}</div>;
}

/* ───── sections ───── */
function Nav() {
  const [sc, setSc] = useState(false); const [m, setM] = useState(false);
  useEffect(() => { const f = () => setSc(window.scrollY > 24); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  const go = () => setM(false);
  return (
    <nav className={'lp-nav' + (sc ? ' sc' : '')} id="main-nav">
      <div className="lp-nav-in">
        <a className="lp-logo" href="#top"><span className="lp-logo-mark">Q</span>QuickCart</a>
        <div className={'lp-links' + (m ? ' open' : '')}>
          <a href="#features" onClick={go}>Features</a><a href="#demo" onClick={go}>See it live</a><a href="#how" onClick={go}>How it works</a><a href="#pricing" onClick={go}>Pricing</a><a href="#faq" onClick={go}>FAQ</a>
          <button className="lp-ghost m-only" onClick={() => { go(); open('login'); }}>Log in</button>
        </div>
        <div className="lp-nav-r">
          <button className="lp-ghost d-only" onClick={() => open('login')}>Log in</button>
          <button className="lp-btn sm" onClick={() => open('register')}>Start free <span>→</span></button>
          <button className="lp-burger" aria-label="Menu" onClick={() => setM(!m)}><i /><i /><i /></button>
        </div>
      </div>
    </nav>
  );
}

const WORDS = ['online store', 'point of sale', 'inventory', 'accounting', 'own domain'];
const SALES = [['📱', 'Samsung Galaxy A35', 285000, 'Ikeja'], ['💻', 'HP Laptop 15s', 520000, 'Abuja'], ['👟', 'Nike Air Max 90', 95000, 'Lekki'], ['🎧', 'AirPods Pro', 165000, 'Ibadan'], ['⌚', 'Apple Watch SE', 210000, 'Port Harcourt']];
function Hero() {
  const [w, setW] = useState(0); const [sales, setSales] = useState([{ ...SALES[0], k: 0 }]); const [rev, setRev] = useState(1240000);
  useEffect(() => { const t = setInterval(() => setW((x) => (x + 1) % WORDS.length), 2200); return () => clearInterval(t); }, []);
  useEffect(() => {
    let i = 1; const t = setInterval(() => {
      const s = SALES[i % SALES.length]; setSales((l) => [{ ...s, k: i }, ...l].slice(0, 3)); setRev((r) => r + s[2]); i++;
    }, 2600); return () => clearInterval(t);
  }, []);
  return (
    <header className="lp-hero" id="top">
      <div className="lp-orb o1" /><div className="lp-orb o2" /><div className="lp-grid" />
      <div className="lp-hero-in">
        <div className="lp-hero-l">
          <span className="lp-pill"><i className="lp-dot" /> Now live in Nigeria · 2,400+ active stores</span>
          <h1>Run your <span className="lp-swap" key={w}>{WORDS[w]}</span><br />from one place.</h1>
          <p>Launch your online store, run your point of sale, manage inventory and track finances — one platform built for every Nigerian entrepreneur, from market stall to enterprise.</p>
          <div className="lp-cta">
            <button className="lp-btn lg" onClick={() => open('register')}>🚀 Start free — 14 days, no card</button>
            <a className="lp-btn lg ghost" href="#demo">▶ See it in action</a>
          </div>
          <div className="lp-stats">
            <div><b><Count to={2.4} prefix="₦" suffix="B" dec={1} /></b><span>GMV processed</span></div>
            <div><b><Count to={2400} suffix="+" /></b><span>Active stores</span></div>
            <div><b><Count to={99.9} suffix="%" dec={1} /></b><span>Uptime SLA</span></div>
          </div>
        </div>
        <div className="lp-hero-r">
          <div className="lp-mock">
            <div className="lp-mock-bar"><i /><i /><i /><span>your-store.quickcart.ng</span></div>
            <div className="lp-mock-body">
              <div className="lp-mock-top"><div><small>Today’s revenue</small><b>{naira(rev)}</b></div><span className="lp-up">▲ 18.4%</span></div>
              <svg viewBox="0 0 300 70" className="lp-spark"><defs><linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff4d00" stopOpacity=".35" /><stop offset="1" stopColor="#ff4d00" stopOpacity="0" /></linearGradient></defs><path d="M0 55 C30 50 40 30 70 35 S120 60 150 40 S210 10 240 22 S280 14 300 8 V70 H0Z" fill="url(#g1)" /><path d="M0 55 C30 50 40 30 70 35 S120 60 150 40 S210 10 240 22 S280 14 300 8" fill="none" stroke="#ff4d00" strokeWidth="2.5" strokeLinecap="round" /></svg>
              <div className="lp-feed">{sales.map((s) => (
                <div className="lp-sale" key={s.k}><span className="lp-sale-i">{s[0]}</span><div><b>{s[1]}</b><small>New order · {s[3]}</small></div><em>+{naira(s[2])}</em></div>))}
              </div>
            </div>
          </div>
          <div className="lp-float f1">🔒 Paystack secured</div>
          <div className="lp-float f2">🛒 Order #4821 <b>+₦45,000</b></div>
          <div className="lp-float f3">📦 14 in stock</div>
        </div>
      </div>
      <div className="lp-marq"><div>{[...Array(2)].map((_, k) => <span key={k}>🔒 Paystack Secured &nbsp;•&nbsp; 🏦 CBN Compliant &nbsp;•&nbsp; 📱 WhatsApp Integration &nbsp;•&nbsp; 🇳🇬 Built for Nigeria &nbsp;•&nbsp; ⚡ Real-time Sync &nbsp;•&nbsp; 📊 Full Analytics &nbsp;•&nbsp; 🔌 Offline Mode POS &nbsp;•&nbsp; 📈 Growth Advisor &nbsp;•&nbsp; </span>)}</div></div>
    </header>
  );
}

function Features() {
  return (
    <section className="lp-sec" id="features">
      <Reveal><span className="lp-tag">Everything you need</span><h2>One platform. Every tool your business needs.</h2><p className="lp-sub">From a single market stall to a multi-branch enterprise — QuickCart scales with you. No technical skills needed.</p></Reveal>
      <div className="lp-bento">{FEATURES.map((f, i) => (
        <Reveal key={f[1]} d={i * 70} className={i === 0 || i === 5 ? 'wide' : ''}>
          <Spot className="lp-fcard"><div className="lp-fico">{f[0]}</div><h3>{f[1]}</h3><p>{f[2]}</p></Spot>
        </Reveal>))}
      </div>
    </section>
  );
}

function Demo() {
  const tabs = ['Store', 'POS', 'Inventory', 'Accounting']; const [t, setT] = useState(0);
  const items = [['Galaxy A35', 285000, 14, 80], ['HP Laptop 15s', 520000, 3, 18], ['AirPods Pro', 165000, 22, 100], ['Nike Air Max', 95000, 2, 10]];
  return (
    <section className="lp-sec dark" id="demo">
      <Reveal><span className="lp-tag">See it live</span><h2>Click around. This is the real thing.</h2><p className="lp-sub">Every module shares the same stock and the same customers, so nothing is ever out of sync.</p></Reveal>
      <div className="lp-demo">
        <div className="lp-tabs">{tabs.map((x, i) => <button key={x} className={i === t ? 'on' : ''} onClick={() => setT(i)}>{['🏪', '🖥️', '📦', '📒'][i]} {x}</button>)}</div>
        <div className="lp-screen" key={t}>
          {t === 0 && <div className="lp-d-store">{['📱 Galaxy A35|₦285,000', '💻 HP Laptop|₦520,000', '🎧 AirPods Pro|₦165,000', '👟 Air Max 90|₦95,000'].map((x) => { const [a, b] = x.split('|'); return <div className="lp-pc" key={a}><div className="lp-pc-i">{a.split(' ')[0]}</div><b>{a.slice(3)}</b><span>{b}</span><button>Add to cart</button></div>; })}</div>}
          {t === 1 && <div className="lp-d-pos"><div className="lp-pos-l">{items.slice(0, 3).map((x) => <div className="lp-row" key={x[0]}><span>{x[0]}</span><b>{naira(x[1])}</b></div>)}<div className="lp-row tot"><span>Total</span><b>{naira(970000)}</b></div></div><div className="lp-pos-r"><button className="on">💳 Card</button><button>🏦 Transfer</button><button>💵 Cash</button><button className="pay">Charge {naira(970000)}</button></div></div>}
          {t === 2 && <div className="lp-d-inv">{items.map((x) => <div className="lp-inv" key={x[0]}><span>{x[0]}</span><div className="lp-bar"><i style={{ width: x[3] + '%', background: x[3] < 25 ? '#ff4d00' : '#00b894' }} /></div><b>{x[2]} left</b>{x[2] < 5 && <em>Low stock</em>}</div>)}</div>}
          {t === 3 && <div className="lp-d-acc"><div className="lp-kpis"><div><small>Income</small><b>₦4.2M</b></div><div><small>Expenses</small><b>₦1.9M</b></div><div><small>Profit</small><b className="g">₦2.3M</b></div></div><div className="lp-bars">{[40, 62, 48, 80, 66, 92, 74].map((h, i) => <i key={i} style={{ height: h + '%', animationDelay: i * 80 + 'ms' }} />)}</div></div>}
        </div>
      </div>
    </section>
  );
}

function Domain() {
  const D = 'www.yourbrand.com'; const [n, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN((x) => (x >= D.length + 10 ? 0 : x + 1)), 140); return () => clearInterval(t); }, []);
  return (
    <section className="lp-sec">
      <div className="lp-dom">
        <Reveal><span className="lp-tag">Your brand, your address</span><h2>Sell on <span className="lp-grad">your own domain.</span></h2><p className="lp-sub left">Connect a domain you own in two minutes. Customers shop at your address, and every link you share carries your brand — not ours.</p>
          <ul className="lp-checks"><li>Type your domain, add one DNS record</li><li>Your store opens on it automatically</li><li>Free to connect on the Pro plan</li></ul>
          <button className="lp-btn" onClick={() => open('register')}>Get started →</button></Reveal>
        <Reveal d={120}><div className="lp-url"><div className="lp-url-bar"><span>🔒</span><b>{D.slice(0, n)}</b><i /></div><div className="lp-url-page"><div className="lp-skel w1" /><div className="lp-skel w2" /><div className="lp-skgrid"><i /><i /><i /></div></div></div></Reveal>
      </div>
    </section>
  );
}

function How() {
  const [a, setA] = useState(0);
  return (
    <section className="lp-sec" id="how">
      <Reveal><span className="lp-tag">Simple process</span><h2>Live in under 10 minutes.</h2><p className="lp-sub">No technical skills. No setup fees. Just your hustle.</p></Reveal>
      <div className="lp-steps">{STEPS.map((s, i) => (
        <Reveal key={i} d={i * 90}><div className={'lp-step' + (i === a ? ' on' : '')} onMouseEnter={() => setA(i)} onClick={() => setA(i)}><div className="lp-n">0{i + 1}</div><h3>{s[0]}</h3><p>{s[1]}</p></div></Reveal>))}
      </div>
    </section>
  );
}

function Pricing() {
  const [yr, setYr] = useState(false);
  return (
    <section className="lp-sec tint" id="pricing">
      <Reveal><span className="lp-tag">Simple pricing</span><h2>Pay once, grow forever.</h2><p className="lp-sub">No hidden fees. No transaction percentages. Cancel anytime.</p>
        <div className="lp-toggle"><button className={!yr ? 'on' : ''} onClick={() => setYr(false)}>Monthly</button><button className={yr ? 'on' : ''} onClick={() => setYr(true)}>Yearly <em>save 20%</em></button></div></Reveal>
      <div className="lp-plans">{PLANS.map((p, i) => (
        <Reveal key={p.id} d={i * 90}><div className={'lp-plan' + (p.hot ? ' hot' : '')}>
          {p.hot && <div className="lp-hotb">Most popular</div>}
          <h3>{p.name}</h3>
          <div className="lp-price"><sup>₦</sup><span key={yr}>{(yr ? Math.round(p.price * 0.8) : p.price).toLocaleString('en-NG')}</span></div>
          <small>{yr ? 'per month · billed yearly' : p.note}</small>
          <ul>{p.feats.map((f) => <li key={f[0]} className={f[1] ? '' : 'no'}><i>{f[1] ? '✓' : '✕'}</i>{f[0]}</li>)}</ul>
          <button className={'lp-btn full' + (p.hot ? '' : ' ghost dk')} onClick={() => open('register')}>{p.cta}</button>
        </div></Reveal>))}
      </div>
      <p className="lp-note">✅ All plans include a 14-day free trial · No card required · Cancel anytime</p>
    </section>
  );
}

function Reviews() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % REVIEWS.length), 5500); return () => clearInterval(t); }, []);
  const r = REVIEWS[i];
  return (
    <section className="lp-sec">
      <Reveal><span className="lp-tag">Real customers</span><h2>Nigerian businesses already thriving.</h2></Reveal>
      <div className="lp-rev"><div className="lp-rcard" key={i}><div className="lp-stars">★★★★★</div><p>{r[0]}</p><div className="lp-who"><span>{r[1][0]}</span><div><b>{r[1]}</b><small>{r[2]}</small></div></div></div>
        <div className="lp-dots">{REVIEWS.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={'Review ' + (k + 1)} />)}</div></div>
    </section>
  );
}

function Faq() {
  const [o, setO] = useState(0);
  return (
    <section className="lp-sec narrow" id="faq">
      <Reveal><span className="lp-tag">Questions</span><h2>Quick answers.</h2></Reveal>
      <div className="lp-faq">{FAQ.map((f, i) => (
        <div key={i} className={'lp-q' + (o === i ? ' on' : '')}><button onClick={() => setO(o === i ? -1 : i)}>{f[0]}<i>+</i></button><div className="lp-a"><p>{f[1]}</p></div></div>))}
      </div>
    </section>
  );
}

function Final() {
  return (
    <section className="lp-final"><div className="lp-orb o1" /><Reveal><h2>Your shop deserves better than WhatsApp screenshots.</h2><p>Start your free 14-day trial. Be live today.</p><button className="lp-btn lg" onClick={() => open('register')}>🚀 Create my store free</button></Reveal></section>
  );
}
function Footer() {
  return (
    <footer className="lp-foot"><div className="lp-foot-in"><div><a className="lp-logo light" href="#top"><span className="lp-logo-mark">Q</span>QuickCart</a><p>Nigeria’s smart commerce platform — store, POS, inventory and accounting in one.</p></div>
      <div className="lp-fcols"><div><h4>Product</h4><a href="#features">Features</a><a href="#demo">See it live</a><a href="#pricing">Pricing</a></div><div><h4>Account</h4><a onClick={() => open('login')}>Log in</a><a onClick={() => open('register')}>Start free trial</a><a onClick={() => open('staff')}>Staff login</a></div></div></div>
      <div className="lp-foot-b">© {new Date().getFullYear()} QuickCart Nigeria. All rights reserved.</div></footer>
  );
}

function App() {
  return <><Nav /><Hero /><Features /><Demo /><Domain /><How /><Pricing /><Reviews /><Faq /><Final /><Footer /></>;
}
createRoot(document.getElementById('lp-root')).render(<App />);
