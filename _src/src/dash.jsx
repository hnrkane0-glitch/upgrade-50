import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const naira = (n) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');
const W = window;
const isStaff = () => { try { return W.QCDB && QCDB.isStaff(); } catch (e) { return false; } };
const owner = () => { try { return QCDB.owner() || ''; } catch (e) { return ''; } };
const jget = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const call = (fn, ...a) => { try { if (typeof W[fn] === 'function') return W[fn](...a); } catch (e) { console.warn(e); } };
const goTo = (n) => call('go', n, document.querySelector('.sb[onclick*="\'' + n + '\'"]'));

function useCount(target, ms = 900) {
  const [v, setV] = useState(0); const from = useRef(0);
  useEffect(() => {
    let raf, t0; const a = from.current;
    const step = (t) => { t0 = t0 || t; const p = Math.min(1, (t - t0) / ms); setV(a + (target - a) * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
function Stat({ icon, label, value, money, hint, tone }) {
  const v = useCount(value);
  return (
    <div className={'qh-stat ' + (tone || '')}>
      <div className="qh-stat-i">{icon}</div>
      <div className="qh-stat-l">{label}</div>
      <div className="qh-stat-v">{money ? naira(v) : Math.round(v).toLocaleString('en-NG')}</div>
      <div className="qh-stat-h">{hint}</div>
    </div>
  );
}
function Ring({ pct }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="url(#qg)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 42 42)" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }} />
      <defs><linearGradient id="qg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff8a3d" /><stop offset="1" stopColor="#ff4d00" /></linearGradient></defs>
      <text x="42" y="47" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="800">{Math.round(pct * 100)}%</text></svg>
  );
}
function Week({ orders }) {
  const days = useMemo(() => {
    const out = [], now = new Date(); now.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); out.push({ d, label: d.toLocaleDateString('en-NG', { weekday: 'short' }), total: 0 }); }
    Object.values(orders || {}).forEach((o) => {
      const dt = new Date(o.createdAt || o.date || 0); dt.setHours(0, 0, 0, 0);
      const slot = out.find((x) => x.d.getTime() === dt.getTime()); if (slot) slot.total += Number(o.total) || 0;
    });
    return out;
  }, [orders]);
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="qh-card">
      <div className="qh-card-h"><h3>Sales this week</h3><span>{naira(days.reduce((s, d) => s + d.total, 0))}</span></div>
      <div className="qh-bars">{days.map((d, i) => (
        <div key={i} className="qh-bar"><div className="qh-bar-t" title={naira(d.total)}><i style={{ height: Math.max(4, (d.total / max) * 100) + '%', animationDelay: i * 60 + 'ms' }} /></div><small>{d.label}</small></div>))}
      </div>
    </div>
  );
}

function Home() {
  const [, force] = useState(0);
  const [cfg, setCfg] = useState({ pay: false, edited: false });
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(() => !!localStorage.getItem('qc_shared_' + owner()));
  useEffect(() => {
    const f = () => force((x) => x + 1);
    W.addEventListener('qc:dash', f); W.addEventListener('qc:links', f);
    if (!W.QC_DASH) call('loadDash');
    (async () => {
      const ns = QCDB.base();
      const [pk, bank, po] = await Promise.all([jget(ns + '/settings/paystack_key.json'), jget(ns + '/settings/bank_account.json'), jget(ns + '/settings/page_overrides.json')]);
      setCfg({ pay: (typeof pk === 'string' && /^pk_/.test(pk) && owner() !== 'admin') || !!(bank && bank.accountNumber), edited: !!(po && ((po.items && po.items.length) || (po.vars && Object.keys(po.vars).length))) });
    })();
    return () => { W.removeEventListener('qc:dash', f); W.removeEventListener('qc:links', f); };
  }, []);

  const D = W.QC_DASH || { prods: {}, orders: {}, subs: {} };
  const user = localStorage.getItem('qc_logged_user') || '';
  const superAdmin = user === 'admin' && !isStaff();
  const staff = isStaff();
  const L = typeof W.getStoreLinks === 'function' ? W.getStoreLinks() : { primary: '', def: '', custom: '' };
  const dom = W.QC_DOMAIN;
  const orders = Object.values(D.orders || {});
  const revenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const nProd = Object.keys(D.prods || {}).length;
  const hr = new Date().getHours();
  const hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const name = localStorage.getItem('qc_biz_name') || user;

  const steps = [
    ['Add your first product', nProd > 0, () => goTo('deals'), 'Add product'],
    ['Set up how you get paid', cfg.pay, () => goTo('settings'), 'Set up'],
    ['Make the store yours', cfg.edited, () => call('openPageEditor'), 'Open editor'],
    ['Share your store link', shared, () => copy(), 'Copy link'],
    ['Connect your own domain', !!(dom && dom.status === 'connected'), () => goTo('domain'), 'Connect'],
    ['Get your first order', orders.length > 0, () => goTo('orders'), 'View orders'],
  ];
  const done = steps.filter((s) => s[1]).length;
  const next = steps.findIndex((s) => !s[1]);

  function copy() {
    const v = L.primary; if (!v) return;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).catch(() => { const t = document.createElement('textarea'); t.value = v; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); });
    setCopied(true); setTimeout(() => setCopied(false), 1800); markShared(); call('toast', '📋 Store link copied! Share it with your customers.');
  }
  function markShared() { try { localStorage.setItem('qc_shared_' + owner(), '1'); } catch (e) {} setShared(true); }
  const waText = encodeURIComponent('Shop with us 🛍️ ' + L.primary);

  return (
    <div className="qh">
      <div className="qh-hero">
        <div className="qh-hero-l">
          <div className="qh-hi">{hello} 👋</div>
          <h2>{name || 'Welcome back'}</h2>
          <p>{orders.length ? `You have ${orders.length} order${orders.length > 1 ? 's' : ''} and ${nProd} product${nProd !== 1 ? 's' : ''} live.` : nProd ? 'Your products are live. Share your link to get your first order.' : 'Let’s get your store ready — it only takes a few minutes.'}</p>
        </div>
        {!staff && (
          <div className="qh-link">
            <div className="qh-link-t">🔗 Your store link <span className={'qh-chip ' + (L.custom ? 'ok' : '')}>{L.custom ? '● Custom domain live' : 'QuickCart link'}</span></div>
            <div className="qh-link-box"><input readOnly value={L.primary} onClick={(e) => e.target.select()} /><button className={'qh-copy' + (copied ? ' done' : '')} onClick={copy}>{copied ? '✓ Copied' : '📋 Copy'}</button></div>
            <div className="qh-link-a">
              <a href={L.primary} target="_blank" rel="noreferrer">👁 Open store</a>
              <a href={'https://wa.me/?text=' + waText} target="_blank" rel="noreferrer" onClick={markShared}>💬 Share on WhatsApp</a>
              <button onClick={() => goTo('domain')}>{L.custom ? '🌐 Manage domain' : '🌐 Use my own domain'}</button>
            </div>
          </div>
        )}
      </div>

      <div className="qh-stats">
        <Stat icon="🛍️" label="Products" value={nProd} hint="Live in your store" />
        <Stat icon="💰" label="Revenue" value={revenue} money hint="All time" tone="g" />
        <Stat icon="📦" label="Orders" value={orders.length} hint="Total received" />
        {superAdmin ? <Stat icon="⭐" label="Subscribers" value={Object.keys(D.subs || {}).length} hint="Active" /> : <Stat icon="🧾" label="Avg. order" value={orders.length ? revenue / orders.length : 0} money hint="Per sale" />}
      </div>

      <div className="qh-two">
        <Week orders={D.orders} />
        {!staff && (
          <div className="qh-card qh-setup">
            <div className="qh-setup-h"><Ring pct={done / steps.length} /><div><h3>{done === steps.length ? 'You’re all set 🎉' : 'Get your store ready'}</h3><p>{done}/{steps.length} steps complete</p></div></div>
            <ul>{steps.map((s, i) => (
              <li key={i} className={(s[1] ? 'done ' : '') + (i === next ? 'next' : '')}><span className="qh-tick">{s[1] ? '✓' : i + 1}</span><b>{s[0]}</b>{!s[1] && <button onClick={s[2]}>{s[3]} →</button>}</li>))}
            </ul>
          </div>
        )}
      </div>

      <div className="qh-quick">{[
        ['➕', 'Add product', () => goTo('deals')], ['🧾', 'Open POS', () => call('openPOS')], ['📦', 'Orders', () => goTo('orders')],
        ['📊', 'Inventory', () => goTo('inventory')], ['🎨', 'Edit store', () => call('openPageEditor')], ['🌐', 'Domain', () => goTo('domain')],
      ].filter((q) => !(staff && (q[1] === 'Edit store'))).map((q) => <button key={q[1]} onClick={q[2]}><span>{q[0]}</span>{q[1]}</button>)}</div>
    </div>
  );
}

const host = document.getElementById('qc-home-root');
if (host) createRoot(host).render(<Home />);
