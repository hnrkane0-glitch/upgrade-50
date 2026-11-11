import React, { useState, useEffect, useRef } from 'react';

/* ───────── design model (saved at <store>/settings/store_design) ───────── */
export const DEFAULT_DESIGN = {
  v: 1,
  brand: { logo: '', logoHeight: 38, showName: true, name: '' },
  theme: { accent: '#ff4d00', accent2: '#ff7a45', bg: '#fbf8f4', text: '#14121a', radius: 20, font: 'Plus Jakarta Sans', buttons: 'pill', header: 'light' },
  announcement: { on: false, text: '', link: '', bg: '#14121a', color: '#ffffff' },
  nav: { links: [] },
  banners: [], bannerSpeed: 5,
  hero: { eyebrow: '✨ Welcome', title: '', subtitle: '', cta1: 'Shop now ↓', cta1Link: '#products', cta2: '', cta2Link: '', showTrust: true },
  categories: [],
  products: { title: 'Our products', showSearch: true, showSort: true },
  layout: [{ id: 'hero', type: 'hero' }, { id: 'products', type: 'products' }, { id: 'about', type: 'about' }],
  about: { title: '', text: '', image: '' },
  footer: { text: 'Thanks for shopping with us.', links: [], socials: {}, address: '', hours: '', email: '', phone: '' },
  seo: { title: '', description: '' },
};
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function mergeDesign(saved) {
  const d = JSON.parse(JSON.stringify(DEFAULT_DESIGN));
  if (!isObj(saved)) return d;
  for (const k of Object.keys(saved)) { if (isObj(d[k]) && isObj(saved[k])) d[k] = { ...d[k], ...saved[k] }; else if (saved[k] !== undefined) d[k] = saved[k]; }
  if (!Array.isArray(d.layout) || !d.layout.length) d.layout = JSON.parse(JSON.stringify(DEFAULT_DESIGN.layout));
  ['hero', 'products'].forEach((id) => { if (!d.layout.some((s) => s.id === id)) d.layout.unshift({ id, type: id }); }); // required blocks can be hidden but never lost
  return d;
}
export const FONTS = ['Plus Jakarta Sans', 'Inter', 'Poppins', 'DM Sans', 'Montserrat', 'Playfair Display', 'Lora', 'Nunito', 'Raleway', 'Space Grotesk'];

/* ───────── safety helpers (everything the owner types is rendered as text, never as HTML) ───────── */
export function safeUrl(u) {
  u = String(u || '').trim(); if (!u) return '';
  if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u)) return u;
  if (/^wa\.me\//i.test(u) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u;
  return '';
}
export const safeImg = (u) => { u = String(u || '').trim(); return /^(https?:\/\/|\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i.test(u) ? u : ''; };
const ext = (u) => /^https?:/i.test(u) ? { target: '_blank', rel: 'noreferrer noopener' } : {};
export function embedUrl(u) {
  u = String(u || '').trim(); let m;
  if ((m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/i))) return 'https://www.youtube-nocookie.com/embed/' + m[1];
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i))) return 'https://player.vimeo.com/video/' + m[1];
  return '';
}
/* tiny safe formatter: blank line = paragraph, **bold**, [label](url) */
export function Rich({ text }) {
  const paras = String(text || '').split(/\n{2,}/).filter((p) => p.trim());
  const inline = (s, key) => {
    const out = []; const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g; let last = 0, m, i = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      if (m[1]) out.push(<b key={key + '-' + i++}>{m[1]}</b>);
      else { const h = safeUrl(m[3]); out.push(h ? <a key={key + '-' + i++} href={h} {...ext(h)} className="lnk">{m[2]}</a> : m[2]); }
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push(s.slice(last)); return out;
  };
  return <>{paras.map((p, i) => <p key={i}>{p.split('\n').map((line, j, a) => <React.Fragment key={j}>{inline(line, i + '-' + j)}{j < a.length - 1 && <br />}</React.Fragment>)}</p>)}</>;
}
const Btn = ({ label, link, kind }) => { const h = safeUrl(link); return label ? <a className={kind === 'alt' ? 'btn-alt' : 'btn-main'} href={h || '#'} {...ext(h)}>{label}</a> : null; };

/* ───────── announcement bar ───────── */
export function Announcement({ a }) {
  if (!a || !a.on || !a.text) return null; const h = safeUrl(a.link);
  const inner = <span>{a.text}</span>;
  return <div className="ann" style={{ background: a.bg || '#14121a', color: a.color || '#fff' }}>{h ? <a href={h} {...ext(h)}>{inner}</a> : inner}</div>;
}

/* ───────── banner slider ───────── */
export function BannerSlider({ banners, speed }) {
  const list = (banners || []).filter((b) => safeImg(b.image) || b.title); const [i, setI] = useState(0); const t = useRef();
  useEffect(() => { setI(0); }, [list.length]);
  useEffect(() => { if (list.length < 2) return; t.current = setInterval(() => setI((x) => (x + 1) % list.length), Math.max(2, Number(speed) || 5) * 1000); return () => clearInterval(t.current); }, [list.length, speed]);
  if (!list.length) return null;
  const go = (n) => { clearInterval(t.current); setI((n + list.length) % list.length); };
  return (
    <section className="bn" aria-roledescription="carousel">
      <div className="bn-track" style={{ transform: 'translateX(-' + i * 100 + '%)' }}>
        {list.map((b, k) => {
          const img = safeImg(b.image), al = b.align || 'left', ov = b.overlay == null ? 0.35 : Number(b.overlay);
          return (
            <div className={'bn-slide al-' + al} key={b.id || k} style={img ? { backgroundImage: 'url("' + img.replace(/"/g, '%22') + '")' } : { background: 'linear-gradient(135deg,var(--accent),var(--accent2))' }}>
              {img && <div className="bn-ov" style={{ background: 'rgba(0,0,0,' + ov + ')' }} />}
              <div className="bn-in" style={{ color: b.textColor || '#fff' }}>
                {b.title && <h2>{b.title}</h2>}{b.subtitle && <p>{b.subtitle}</p>}
                {b.cta && <Btn label={b.cta} link={b.link || '#products'} />}
              </div>
            </div>
          );
        })}
      </div>
      {list.length > 1 && <>
        <button className="bn-arrow l" onClick={() => go(i - 1)} aria-label="Previous">‹</button><button className="bn-arrow r" onClick={() => go(i + 1)} aria-label="Next">›</button>
        <div className="bn-dots">{list.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => go(k)} aria-label={'Slide ' + (k + 1)} />)}</div>
      </>}
    </section>
  );
}

/* ───────── category tiles ───────── */
export function CategoryTiles({ s, cats, products, onPick }) {
  const list = cats.filter((c) => c !== 'All');
  const count = (c) => { const o = cats.find((x) => (x.name || x) === c); const subs = o && o.meta && Array.isArray(o.meta.subs) ? o.meta.subs : []; return products.filter((p) => p.category === c || subs.includes(p.category)).length; };
  if (!list.length) return null;
  return (
    <section className="blk sec">
      {s.heading !== '' && <div className="sec-h"><h2>{s.heading || 'Shop by category'}</h2></div>}
      <div className="cat-grid" style={{ '--cols': Number(s.columns) || 4 }}>
        {list.map((c) => {
          const m = c.meta || {}; const name = c.name || c; const img = safeImg(m.image);
          return <button key={name} className="cat-tile" onClick={() => onPick(name)} style={img ? { backgroundImage: 'url("' + img.replace(/"/g, '%22') + '")' } : undefined}>
            {!img && <span className="cat-emoji">{m.emoji || '🛍️'}</span>}<span className="cat-name">{name}</span>{Array.isArray(m.subs) && m.subs.filter(Boolean).length > 0 && <span className="cat-subs">{m.subs.filter(Boolean).slice(0, 4).join(' · ')}</span>}<span className="cat-n">{count(name)} item{count(name) === 1 ? '' : 's'}</span></button>;
        })}
      </div>
    </section>
  );
}

/* ───────── custom sections ───────── */
const bgCls = (b) => (b === 'soft' ? ' bg-soft' : b === 'dark' ? ' bg-dark' : b === 'accent' ? ' bg-accent' : '');
function Faq({ items }) { const [o, setO] = useState(-1); return <div className="faq">{(items || []).filter((x) => x.q).map((x, i) => <div key={i} className={'faq-i' + (o === i ? ' open' : '')}><button onClick={() => setO(o === i ? -1 : i)}><span>{x.q}</span><i>{o === i ? '−' : '+'}</i></button>{o === i && <div className="faq-a"><Rich text={x.a} /></div>}</div>)}</div>; }

export function Section({ s, products, onAdd, onOpen, wish, onWish, Card, cats, onPick }) {
  const T = s.type;
  if (T === 'spacer') return <div style={{ height: Math.max(4, Math.min(200, Number(s.height) || 40)) }} />;
  if (T === 'divider') return <div className="blk sec"><hr className="dv" /></div>;
  if (T === 'text') return <section className={'blk sec txt al-' + (s.align || 'left') + bgCls(s.bg)}><div className="blk-in">{s.heading && <h2>{s.heading}</h2>}<div className="rich"><Rich text={s.text} /></div></div></section>;
  if (T === 'image') { const img = safeImg(s.image), h = safeUrl(s.link); if (!img) return null; const el = <img src={img} alt={s.alt || ''} loading="lazy" />; return <section className={'blk img-blk' + (s.fullWidth ? ' full' : ' sec')}>{h ? <a href={h} {...ext(h)}>{el}</a> : el}</section>; }
  if (T === 'imagetext') { const img = safeImg(s.image); return <section className={'blk sec split' + (s.imageSide === 'right' ? ' rev' : '') + bgCls(s.bg)}><div className="blk-in sp-in">{img && <div className="sp-img"><img src={img} alt={s.heading || ''} loading="lazy" /></div>}<div className="sp-tx">{s.heading && <h2>{s.heading}</h2>}<div className="rich"><Rich text={s.text} /></div><Btn label={s.cta} link={s.link} /></div></div></section>; }
  if (T === 'banner') { const img = safeImg(s.image); const ov = s.overlay == null ? 0.35 : Number(s.overlay); return <section className={'blk bn-one al-' + (s.align || 'center') + ' ' + (s.height || 'md')} style={img ? { backgroundImage: 'url("' + img.replace(/"/g, '%22') + '")' } : { background: 'linear-gradient(135deg,var(--accent),var(--accent2))' }}>{img && <div className="bn-ov" style={{ background: 'rgba(0,0,0,' + ov + ')' }} />}<div className="bn-in" style={{ color: s.textColor || '#fff' }}>{s.heading && <h2>{s.heading}</h2>}{s.text && <p>{s.text}</p>}<Btn label={s.cta} link={s.link} /></div></section>; }
  if (T === 'cta') return <section className={'blk sec cta al-center' + bgCls(s.bg || 'accent')}><div className="blk-in">{s.heading && <h2>{s.heading}</h2>}{s.text && <div className="rich"><Rich text={s.text} /></div>}<Btn label={s.button} link={s.link} /></div></section>;
  if (T === 'gallery') { const imgs = (s.images || []).map(safeImg).filter(Boolean); if (!imgs.length) return null; return <section className="blk sec">{s.heading && <div className="sec-h"><h2>{s.heading}</h2></div>}<div className="gal" style={{ '--cols': Number(s.columns) || 3 }}>{imgs.map((u, i) => <img key={i} src={u} alt="" loading="lazy" />)}</div></section>; }
  if (T === 'testimonials') return <section className={'blk sec' + bgCls(s.bg)}><div className="blk-in">{s.heading && <div className="sec-h"><h2>{s.heading}</h2></div>}<div className="tst">{(s.items || []).filter((x) => x.text).map((x, i) => <figure key={i}><blockquote>“{x.text}”</blockquote><figcaption><b>{x.name}</b>{x.role && <span> · {x.role}</span>}</figcaption></figure>)}</div></div></section>;
  if (T === 'faq') return <section className="blk sec"><div className="blk-in narrow">{s.heading && <div className="sec-h"><h2>{s.heading}</h2></div>}<Faq items={s.items} /></div></section>;
  if (T === 'video') { const u = embedUrl(s.url); if (!u) return null; return <section className="blk sec"><div className="blk-in narrow">{s.heading && <div className="sec-h"><h2>{s.heading}</h2></div>}<div className="vid"><iframe src={u} title={s.heading || 'Video'} loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div></div></section>; }
  if (T === 'contact') return <section className={'blk sec' + bgCls(s.bg)}><div className="blk-in narrow">{s.heading && <div className="sec-h"><h2>{s.heading}</h2></div>}<div className="ctc">{s.text && <div className="rich"><Rich text={s.text} /></div>}{s.address && <div>📍 {s.address}</div>}{s.hours && <div>🕒 {s.hours}</div>}{s.phone && <div>📞 <a href={'tel:' + s.phone}>{s.phone}</a></div>}{s.email && <div>✉️ <a href={'mailto:' + s.email}>{s.email}</a></div>}</div></div></section>;
  if (T === 'categories') return <CategoryTiles s={s} cats={cats} products={products} onPick={onPick} />;
  if (T === 'featured') {
    let l = products.slice();
    if (s.source === 'category' && s.value) l = l.filter((p) => p.category === s.value);
    else if (s.source === 'tag' && s.value) l = l.filter((p) => String(p.tag || '').toLowerCase() === String(s.value).toLowerCase());
    else if (s.source === 'sale') l = l.filter((p) => p.originalPrice && p.originalPrice > p.price);
    l = l.slice(0, Math.max(1, Math.min(24, Number(s.count) || 4))); if (!l.length) return null;
    return <section className="blk sec"><div className="sec-h"><h2>{s.heading || 'Featured'}</h2></div><div className="grid">{l.map((p, i) => <Card key={p.id} p={p} idx={i} onAdd={onAdd} onOpen={onOpen} wished={wish.includes(p.id)} onWish={onWish} />)}</div></section>;
  }
  return null;
}

/* ───────── theme → css variables / font ───────── */
export function applyTheme(d) {
  const t = d.theme || {}, r = document.documentElement.style;
  const set = (k, v) => { if (v) r.setProperty(k, v); };
  set('--accent', t.accent); set('--accent2', t.accent2 || t.accent); set('--bg', t.bg); set('--text', t.text); set('--black', t.text);
  r.setProperty('--r', (Number(t.radius) >= 0 ? Number(t.radius) : 20) + 'px');
  r.setProperty('--btn-r', t.buttons === 'square' ? '4px' : t.buttons === 'rounded' ? '12px' : '999px');
  const f = FONTS.includes(t.font) ? t.font : 'Plus Jakarta Sans';
  if (f !== 'Plus Jakarta Sans') {
    let l = document.getElementById('qc-font'); if (!l) { l = document.createElement('link'); l.id = 'qc-font'; l.rel = 'stylesheet'; document.head.appendChild(l); }
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;500;600;700;800&display=swap';
  }
  document.body.style.fontFamily = "'" + f + "',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  document.body.dataset.header = t.header || 'light';
  const s = d.seo || {}; if (s.title) document.title = s.title;
  if (s.description) { let m = document.querySelector('meta[name=description]'); if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); } m.content = s.description; }
  const logo = safeImg(d.brand && d.brand.logo); if (logo) { let ic = document.querySelector('link[rel=icon]'); if (!ic) { ic = document.createElement('link'); ic.rel = 'icon'; document.head.appendChild(ic); } ic.href = logo; }
}
