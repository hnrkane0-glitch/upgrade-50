/* QuickCart Growth Advisor
 * Turns the store's own orders + stock into plain-English, one-click actions.
 * Pure browser code, reads only the logged-in owner's data (DB / ORDERS_DB), needs no API key.
 */
(function () {
  'use strict';
  var DAY = 864e5;
  var S = { days: 30, lead: 7, cover: 21, margin: 25, idle: 60, loaded: false, busy: false, prods: {}, orders: {}, chart: null, model: null };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var money = function (n) { return '\u20A6' + Math.round(n || 0).toLocaleString('en-NG'); };
  var num = function (n) { return Math.round(n || 0).toLocaleString('en-NG'); };
  var say = function (m) { if (typeof window.toast === 'function') window.toast(m); };
  var ts = function (o) { var d = o.createdAt || o.date || o.ts; var t = typeof d === 'number' ? d : Date.parse(d); return isNaN(t) ? 0 : t; };
  var qtyOf = function (i) { return Number(i.qty != null ? i.qty : i.q) || 0; };
  var isCounted = function (o) { return !/cancel|declin|refund|pending|awaiting|fail/.test(String(o.status || 'paid').toLowerCase()); };
  var custName = function (o) { return o.customerName || (o.customer && o.customer.name) || ''; };
  var custPhone = function (o) { return o.phone || (o.customer && o.customer.phone) || ''; };
  var custEmail = function (o) { return o.email || (o.customer && o.customer.email) || o.customerEmail || ''; };
  var pct = function (a, b) { return b > 0 ? (a - b) / b * 100 : (a > 0 ? 100 : 0); };

  // Round a price UP to a "shop-friendly" figure (e.g. 12,340 -> 12,500; 78,200 -> 78,500; 245,100 -> 249,000)
  function nicePrice(p) {
    if (p <= 0) return 0;
    var step = p < 1000 ? 50 : p < 10000 ? 100 : p < 100000 ? 500 : p < 1000000 ? 1000 : 5000;
    var up = Math.ceil(p / step) * step;
    return up;
  }
  function niceDown(p) {
    var step = p < 1000 ? 50 : p < 10000 ? 100 : p < 100000 ? 500 : p < 1000000 ? 1000 : 5000;
    return Math.max(step, Math.floor(p / step) * step);
  }

  /* ---------- data ---------- */
  async function fetchJSON(url) { try { var r = await fetch(url + '.json'); return (await r.json()) || {}; } catch (e) { return {}; } }

  async function load() {
    if (S.busy) return;
    S.busy = true;
    var body = $('adv-body');
    if (body && !S.loaded) body.innerHTML = '<div class="adv-skel"></div><div class="adv-skel"></div><div class="adv-skel"></div>';
    try {
      var res = await Promise.all([fetchJSON(window.DB), fetchJSON(window.ORDERS_DB)]);
      S.prods = res[0] && typeof res[0] === 'object' ? res[0] : {};
      S.orders = res[1] && typeof res[1] === 'object' ? res[1] : {};
      S.loaded = true;
    } catch (e) { /* keep old data */ }
    S.busy = false;
    render();
  }

  /* ---------- analysis ---------- */
  function analyse() {
    var now = Date.now(), win = S.days * DAY;
    var all = Object.keys(S.orders).map(function (k) { var o = S.orders[k]; return o && typeof o === 'object' ? Object.assign({ _k: k }, o) : null; })
      .filter(function (o) { return o && isCounted(o) && ts(o) > 0; });
    var cur = [], prev = [], d90 = [];
    all.forEach(function (o) {
      var t = ts(o), age = now - t;
      if (age <= win) cur.push(o); else if (age <= 2 * win) prev.push(o);
      if (age <= 90 * DAY) d90.push(o);
    });

    var sold = {};           // per product, inside the selected window
    var lastSale = {};       // per product, ever
    var profitKnown = 0, revKnown = 0, curRev = 0, curProfit = 0, curUnits = 0;

    function lineKey(it) { return it.k || it.id || it.pid || (it.name ? 'n:' + it.name : ''); }
    all.forEach(function (o) {
      (o.items || []).forEach(function (it) { var k = lineKey(it); if (k) lastSale[k] = Math.max(lastSale[k] || 0, ts(o)); });
    });
    cur.forEach(function (o) {
      var items = o.items || [], sum = 0;
      items.forEach(function (it) {
        var k = lineKey(it), q = qtyOf(it), price = Number(it.price != null ? it.price : it.p) || 0;
        if (!k || !q) return;
        var p = S.prods[k] || {};
        var cost = Number(it.cost != null ? it.cost : p.cost) || 0;
        var rev = price * q; sum += rev; curUnits += q;
        var r = sold[k] || (sold[k] = { k: k, name: it.name || p.name || k, units: 0, revenue: 0, profit: 0, costed: false });
        r.units += q; r.revenue += rev;
        if (cost > 0) { r.profit += (price - cost) * q; r.costed = true; profitKnown += (price - cost) * q; revKnown += rev; }
      });
      curRev += Number(o.total) || sum;
    });
    curProfit = profitKnown;
    var prevRev = prev.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);

    /* products */
    var rows = Object.keys(S.prods).map(function (k) {
      var p = S.prods[k]; if (!p || typeof p !== 'object') return null;
      var s = sold[k] || { units: 0, revenue: 0, profit: 0 };
      var stock = Math.max(0, Number(p.quantity) || 0), price = Number(p.price) || 0, cost = Number(p.cost) || 0;
      var vel = s.units / S.days, cover = vel > 0 ? stock / vel : Infinity;
      return { k: k, p: p, name: p.name || k, stock: stock, price: price, cost: cost, vel: vel, cover: cover, units: s.units, revenue: s.revenue, profit: s.profit,
        last: lastSale[k] || 0, reorder: Number(p.reorderPoint) || 0, created: ts(p) };
    }).filter(Boolean);

    /* restock radar */
    var restock = rows.filter(function (r) { return r.vel > 0 && r.cover <= S.lead * 2; }).map(function (r) {
      var need = Math.ceil(r.vel * (S.lead + S.cover) - r.stock);
      var level = r.stock === 0 ? 'out' : r.cover <= S.lead ? 'critical' : 'soon';
      return Object.assign({}, r, { need: Math.max(1, need), level: level, outOn: r.stock === 0 ? null : new Date(now + r.cover * DAY),
        spend: Math.max(1, need) * (r.cost || 0) });
    }).sort(function (a, b) { return a.cover - b.cover; });
    var restockSpend = restock.reduce(function (s, r) { return s + r.spend; }, 0);

    /* dead stock */
    var dead = rows.filter(function (r) {
      if (r.stock <= 0) return false;
      var quietFor = r.last ? now - r.last : Infinity;
      if (!r.last && r.created && now - r.created < S.idle * DAY) return false; // new product, give it time
      return quietFor > S.idle * DAY && r.units === 0;
    }).map(function (r) {
      var quiet = r.last ? Math.floor((now - r.last) / DAY) : null;
      var off = (quiet == null || quiet > 120) ? 25 : quiet > 90 ? 20 : 15;
      var np = niceDown(r.price * (1 - off / 100));
      if (r.cost > 0 && np < r.cost) np = nicePrice(r.cost * 1.02);
      return Object.assign({}, r, { quiet: quiet, off: off, newPrice: np, tied: r.stock * (r.cost || r.price), tiedLabel: r.cost ? 'at cost' : 'at retail' });
    }).sort(function (a, b) { return b.tied - a.tied; });
    var deadTied = dead.reduce(function (s, r) { return s + r.tied; }, 0);

    /* price fixes */
    var fixes = rows.filter(function (r) { return r.cost > 0 && r.price > 0 && r.units > 0; }).map(function (r) {
      var m = (r.price - r.cost) / r.price * 100;
      return Object.assign({}, r, { m: m });
    }).filter(function (r) { return r.m < S.margin; }).map(function (r) {
      var np = nicePrice(r.cost / (1 - S.margin / 100));
      if (np <= r.price) np = nicePrice(r.price * 1.02);
      var extra = (np - r.price) * r.vel * 30;
      return Object.assign({}, r, { newPrice: np, newM: (np - r.cost) / np * 100, extra: extra, below: r.price < r.cost });
    }).sort(function (a, b) { return b.extra - a.extra; });
    var fixGain = fixes.reduce(function (s, r) { return s + r.extra; }, 0);

    var noCost = rows.filter(function (r) { return !(r.cost > 0); });
    var noCostSellers = noCost.filter(function (r) { return r.units > 0; }).sort(function (a, b) { return b.revenue - a.revenue; });

    /* ABC */
    var ranked = rows.filter(function (r) { return r.revenue > 0; }).sort(function (a, b) { return b.revenue - a.revenue; });
    var tot = ranked.reduce(function (s, r) { return s + r.revenue; }, 0), run = 0, A = [], B = [], C = [];
    ranked.forEach(function (r) { var before = run / tot; run += r.revenue; (before < 0.8 ? A : before < 0.95 ? B : C).push(r); });

    /* sales rhythm (last 90 days) */
    var grid = []; for (var d = 0; d < 7; d++) { grid.push(new Array(24).fill(0)); }
    d90.forEach(function (o) { var dt = new Date(ts(o)); grid[dt.getDay()][dt.getHours()]++; });
    var best = { d: 0, h: 0, n: 0 }, maxCell = 0, dayTotals = new Array(7).fill(0);
    for (var a = 0; a < 7; a++) for (var h = 0; h < 24; h++) { var n = grid[a][h]; maxCell = Math.max(maxCell, n); dayTotals[a] += n; if (n > best.n) best = { d: a, h: h, n: n }; }
    var bestDay = dayTotals.indexOf(Math.max.apply(null, dayTotals));

    /* customers */
    var cmap = {};
    all.forEach(function (o) {
      var ph = String(custPhone(o)).replace(/\D/g, ''), em = String(custEmail(o)).toLowerCase().trim(), nm = custName(o).trim();
      var key = ph.length >= 9 ? 'p' + ph.slice(-9) : em ? 'e' + em : '';
      if (!key) return;
      var c = cmap[key] || (cmap[key] = { name: '', phone: '', email: '', orders: 0, spent: 0, last: 0, first: Infinity });
      if (nm && !c.name) c.name = nm; if (ph && !c.phone) c.phone = ph; if (em && !c.email) c.email = em;
      c.orders++; c.spent += Number(o.total) || 0; c.last = Math.max(c.last, ts(o)); c.first = Math.min(c.first, ts(o));
    });
    var customers = Object.keys(cmap).map(function (k) { return cmap[k]; });
    var repeat = customers.filter(function (c) { return c.orders >= 2; });
    var winback = customers.filter(function (c) { var q = now - c.last; return c.phone && q > 45 * DAY && q < 400 * DAY && (c.orders >= 2 || c.spent >= 20000); })
      .sort(function (a, b) { return b.spent - a.spent; });
    var vip = customers.slice().sort(function (a, b) { return b.spent - a.spent; }).slice(0, 5);

    /* daily revenue */
    var byDay = {}, labels = [], series = [];
    cur.forEach(function (o) { var k = new Date(ts(o)).toISOString().slice(0, 10); byDay[k] = (byDay[k] || 0) + (Number(o.total) || 0); });
    for (var i = S.days - 1; i >= 0; i--) { var dk = new Date(now - i * DAY).toISOString().slice(0, 10); labels.push(dk.slice(5)); series.push(byDay[dk] || 0); }

    return { now: now, curRev: curRev, prevRev: prevRev, curOrders: cur.length, prevOrders: prev.length, curUnits: curUnits,
      aov: cur.length ? curRev / cur.length : 0, prevAov: prev.length ? prevRev / prev.length : 0, profit: curProfit,
      profitCover: curRev > 0 ? revKnown / curRev * 100 : 0, margin: revKnown > 0 ? profitKnown / revKnown * 100 : 0,
      restock: restock, restockSpend: restockSpend, dead: dead, deadTied: deadTied, fixes: fixes, fixGain: fixGain,
      noCost: noCost, noCostSellers: noCostSellers, A: A, B: B, C: C, ranked: ranked, tot: tot,
      grid: grid, maxCell: maxCell, best: best, bestDay: bestDay, hasRhythm: d90.length >= 5,
      customers: customers, repeat: repeat, winback: winback, vip: vip, labels: labels, series: series,
      productCount: rows.length, orderCount: all.length };
  }

  /* ---------- rendering ---------- */
  var DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  var DS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var hr = function (h) { var x = h % 12 || 12; return x + (h < 12 ? 'am' : 'pm'); };
  function delta(a, b, invert) {
    if (!b && !a) return '<span class="adv-d flat">\u2013 no change</span>';
    var v = pct(a, b), up = v >= 0; if (invert) up = !up;
    return '<span class="adv-d ' + (Math.abs(v) < 0.5 ? 'flat' : up ? 'up' : 'down') + '">' + (v >= 0 ? '\u2191 ' : '\u2193 ') + Math.abs(Math.round(v)) + '% vs previous ' + S.days + 'd</span>';
  }
  function section(id, icon, title, sub, inner, right) {
    return '<section class="adv-sec" id="adv-s-' + id + '"><header class="adv-sh"><div><h3>' + icon + ' ' + title + '</h3><p>' + sub + '</p></div>' + (right || '') + '</header>' + inner + '</section>';
  }
  var empty = function (t) { return '<div class="adv-empty">' + t + '</div>'; };

  function render() {
    var body = $('adv-body'); if (!body) return;
    var m = analyse(); S.model = m;
    if (!m.productCount && !m.orderCount) {
      body.innerHTML = '<div class="adv-hero-empty"><h3>Nothing to analyse yet</h3><p>Add products and make a few sales (online or at the POS). The Advisor starts working as soon as orders come in.</p></div>';
      return;
    }
    var h = '';

    /* headline actions */
    var acts = [];
    if (m.restock.length) acts.push(['restock', 'danger', 'Restock ' + m.restock.length + ' item' + (m.restock.length > 1 ? 's' : '') + ' before they run out',
      m.restock.filter(function (r) { return r.level !== 'soon'; }).length + ' will sell out within your ' + S.lead + '-day supplier lead time' + (m.restockSpend ? ' \u00B7 about ' + money(m.restockSpend) + ' to reorder' : '')]);
    if (m.fixes.length) acts.push(['fixes', 'warn', 'Raise prices on ' + m.fixes.length + ' thin-margin item' + (m.fixes.length > 1 ? 's' : ''),
      'Reaching a ' + S.margin + '% margin could add about ' + money(m.fixGain) + ' a month at today\u2019s sales pace']);
    if (m.dead.length) acts.push(['dead', 'info', money(m.deadTied) + ' is sitting in stock nobody is buying',
      m.dead.length + ' product' + (m.dead.length > 1 ? 's' : '') + ' with no sales in ' + S.idle + '+ days \u00B7 run a clearance']);
    if (m.winback.length) acts.push(['people', 'good', m.winback.length + ' good customers have gone quiet',
      'Worth ' + money(m.winback.reduce(function (s, c) { return s + c.spent; }, 0)) + ' in past orders \u00B7 message them on WhatsApp']);
    if (m.noCostSellers.length) acts.push(['fixes', 'muted', m.noCostSellers.length + ' selling product' + (m.noCostSellers.length > 1 ? 's have' : ' has') + ' no cost price',
      'Add costs to unlock accurate profit and pricing advice']);
    if (!acts.length) acts.push(['kpi', 'good', 'Your store looks healthy', 'No urgent actions right now. Check back after more sales come in.']);
    h += '<div class="adv-acts">' + acts.map(function (a) {
      return '<button class="adv-act ' + a[1] + '" data-adv-go="' + a[0] + '"><span class="adv-dot"></span><span><b>' + a[2] + '</b><small>' + a[3] + '</small></span><i data-ico="arrow-right"></i></button>';
    }).join('') + '</div>';

    /* KPIs */
    h += '<div class="adv-kpis">'
      + kpi('Revenue', money(m.curRev), delta(m.curRev, m.prevRev))
      + kpi('Orders', num(m.curOrders), delta(m.curOrders, m.prevOrders))
      + kpi('Average order', money(m.aov), delta(m.aov, m.prevAov))
      + kpi('Estimated profit', m.profit ? money(m.profit) : '\u2014', m.profit ? '<span class="adv-d flat">' + Math.round(m.margin) + '% margin \u00B7 ' + Math.round(m.profitCover) + '% of sales have a cost</span>' : '<span class="adv-d flat">Add cost prices to see profit</span>')
      + '</div>';
    h += '<div class="adv-card adv-chart"><div class="adv-ch-h"><b>Daily revenue</b><span>last ' + S.days + ' days</span></div><div style="height:180px"><canvas id="adv-chart"></canvas></div></div>';

    /* restock */
    h += section('restock', '<i data-ico="package"></i>', 'Restock radar', 'Based on how fast each product actually sells. Suggested quantity covers your ' + S.lead + '-day lead time plus ' + S.cover + ' days of sales.',
      m.restock.length ? '<div class="adv-tw"><table class="adv-t"><thead><tr><th>Product</th><th class="r">In stock</th><th class="r">Sells / day</th><th>Runs out</th><th class="r">Order</th><th class="r">Est. cost</th></tr></thead><tbody>'
        + m.restock.slice(0, 25).map(function (r) {
          return '<tr><td><b>' + esc(r.name) + '</b></td><td class="r">' + num(r.stock) + '</td><td class="r">' + (r.vel < 1 ? r.vel.toFixed(2) : r.vel.toFixed(1)) + '</td><td>' + (r.level === 'out' ? '<span class="adv-pill red">Out of stock</span>' : '<span class="adv-pill ' + (r.level === 'critical' ? 'red' : 'amber') + '">' + (r.cover < 1 ? 'today' : 'in ' + Math.round(r.cover) + ' day' + (Math.round(r.cover) === 1 ? '' : 's')) + '</span>') + '</td><td class="r"><b>' + num(r.need) + '</b></td><td class="r">' + (r.cost ? money(r.spend) : '<span class="adv-mute">no cost</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        + '<div class="adv-foot"><button class="adv-btn" data-adv="csv">Download reorder list (CSV)</button><button class="adv-btn" data-adv="copy-order">Copy supplier message</button></div>'
      : empty('Nothing is about to run out. Every selling product has more than ' + (S.lead * 2) + ' days of stock.'));

    /* price fixes */
    h += section('fixes', '<i data-ico="tag"></i>', 'Pricing fixes', 'Products that sell but earn less than your ' + S.margin + '% target margin. Prices are rounded to figures customers like.',
      m.fixes.length ? '<div class="adv-tw"><table class="adv-t"><thead><tr><th>Product</th><th class="r">Price</th><th class="r">Cost</th><th class="r">Margin</th><th class="r">Suggested</th><th class="r">Extra / month</th><th></th></tr></thead><tbody>'
        + m.fixes.slice(0, 20).map(function (r) {
          return '<tr><td><b>' + esc(r.name) + '</b>' + (r.below ? ' <span class="adv-pill red">Below cost</span>' : '') + '</td><td class="r">' + money(r.price) + '</td><td class="r">' + money(r.cost) + '</td><td class="r"><span class="adv-pill ' + (r.m < 10 ? 'red' : 'amber') + '">' + Math.round(r.m) + '%</span></td><td class="r"><b>' + money(r.newPrice) + '</b> <span class="adv-mute">' + Math.round(r.newM) + '%</span></td><td class="r adv-good">+' + money(r.extra) + '</td><td class="r"><button class="adv-btn sm" data-adv="price" data-k="' + esc(r.k) + '" data-v="' + r.newPrice + '">Apply</button></td></tr>';
        }).join('') + '</tbody></table></div><div class="adv-note">Extra income assumes you keep selling the same quantity at the new price. Watch sales for a week after changing.</div>'
      : empty(m.noCost.length === m.productCount ? 'Add a cost price to your products and the Advisor will check your margins.' : 'All your selling products meet the ' + S.margin + '% margin target.'));

    /* dead stock */
    h += section('dead', '<i data-ico="archive"></i>', 'Dead stock', 'In stock, but no sales for ' + S.idle + '+ days. Clear it to free cash for items that sell.',
      m.dead.length ? '<div class="adv-tw"><table class="adv-t"><thead><tr><th>Product</th><th class="r">Units</th><th class="r">Cash tied up</th><th class="r">Idle</th><th class="r">Clearance price</th><th></th></tr></thead><tbody>'
        + m.dead.slice(0, 20).map(function (r) {
          return '<tr><td><b>' + esc(r.name) + '</b></td><td class="r">' + num(r.stock) + '</td><td class="r">' + money(r.tied) + ' <span class="adv-mute">' + r.tiedLabel + '</span></td><td class="r">' + (r.quiet == null ? 'never sold' : r.quiet + ' days') + '</td><td class="r"><b>' + money(r.newPrice) + '</b> <span class="adv-pill amber">\u2212' + r.off + '%</span></td><td class="r"><button class="adv-btn sm" data-adv="markdown" data-k="' + esc(r.k) + '" data-v="' + r.newPrice + '">Start sale</button></td></tr>';
        }).join('') + '</tbody></table></div>'
      : empty('No dead stock. Everything in your store has sold recently.'));

    /* ABC + rhythm */
    var pctA = m.ranked.length ? Math.round(m.A.length / m.ranked.length * 100) : 0;
    h += '<div class="adv-two">'
      + section('abc', '<i data-ico="chart"></i>', 'What really pays the bills', m.A.length ? m.A.length + ' product' + (m.A.length > 1 ? 's' : '') + ' (' + pctA + '% of your range) bring in 80% of sales.' : 'Sales by product',
        m.A.length ? '<div class="adv-bars">' + m.ranked.slice(0, 7).map(function (r) {
          var w = Math.max(3, r.revenue / m.ranked[0].revenue * 100);
          return '<div class="adv-bar-row"><span class="adv-bar-n">' + esc(r.name) + '</span><span class="adv-bar-t"><i style="width:' + w + '%"></i></span><span class="adv-bar-v">' + money(r.revenue) + '</span></div>';
        }).join('') + '</div><div class="adv-note">Never let these run out. They are your A-list: ' + m.A.length + ' A \u00B7 ' + m.B.length + ' B \u00B7 ' + m.C.length + ' C products.</div>' : empty('No sales in this period yet.'))
      + section('rhythm', '<i data-ico="clock"></i>', 'When customers buy', m.hasRhythm ? 'Busiest: <b>' + DAYS[m.bestDay] + '</b>, peaking around <b>' + hr(m.best.h) + '\u2013' + hr((m.best.h + 1) % 24) + '</b> (last 90 days).' : 'Needs a few more orders to find your pattern.',
        m.hasRhythm ? heat(m) + '<div class="adv-note">Post offers and send broadcasts about an hour before your peak time. Make sure staff are scheduled for it.</div>' : empty('Not enough orders yet.'))
      + '</div>';

    /* customers */
    var rr = m.customers.length ? Math.round(m.repeat.length / m.customers.length * 100) : 0;
    h += section('people', '<i data-ico="users"></i>', 'Customers', m.customers.length ? num(m.customers.length) + ' known customers \u00B7 ' + rr + '% have bought more than once.' : 'Customers appear here once orders include a phone number or email.',
      (m.winback.length ? '<div class="adv-sub">Win-back list <span class="adv-mute">\u00B7 good customers who have not ordered in 45+ days</span></div><div class="adv-tw"><table class="adv-t"><thead><tr><th>Customer</th><th class="r">Orders</th><th class="r">Spent</th><th class="r">Last order</th><th></th></tr></thead><tbody>'
        + m.winback.slice(0, 12).map(function (c, i) {
          return '<tr><td><b>' + esc(c.name || 'Customer') + '</b> <span class="adv-mute">' + esc(c.phone) + '</span></td><td class="r">' + c.orders + '</td><td class="r">' + money(c.spent) + '</td><td class="r">' + Math.floor((m.now - c.last) / DAY) + ' days ago</td><td class="r"><a class="adv-btn sm wa" target="_blank" rel="noopener" href="' + waLink(c) + '">WhatsApp</a></td></tr>';
        }).join('') + '</tbody></table></div>' : (m.customers.length ? empty('No lapsed customers. Everyone worth keeping has ordered recently.') : ''))
      + (m.vip.length ? '<div class="adv-sub" style="margin-top:18px">Top customers</div><div class="adv-vips">' + m.vip.map(function (c, i) {
        return '<div class="adv-vip"><span class="adv-rank">' + (i + 1) + '</span><div><b>' + esc(c.name || c.phone || c.email || 'Customer') + '</b><small>' + c.orders + ' order' + (c.orders > 1 ? 's' : '') + '</small></div><span>' + money(c.spent) + '</span></div>';
      }).join('') + '</div>' : ''));

    body.innerHTML = h;
    if (window.QCIcons) window.QCIcons.scan(body);
    drawChart(m);
  }

  function kpi(label, value, sub) { return '<div class="adv-kpi"><span>' + label + '</span><b>' + value + '</b>' + sub + '</div>'; }

  function heat(m) {
    var h = '<div class="adv-heat"><div class="adv-heat-hd"><span></span>';
    for (var x = 0; x < 24; x += 3) h += '<span>' + hr(x) + '</span>';
    h += '</div>';
    for (var d = 1; d <= 7; d++) {
      var di = d % 7;
      h += '<div class="adv-heat-row"><span>' + DS[di] + '</span><div class="adv-heat-cells">';
      for (var k = 0; k < 24; k++) {
        var n = m.grid[di][k], lv = n === 0 ? 0 : Math.max(1, Math.ceil(n / m.maxCell * 4));
        h += '<i class="l' + lv + '" title="' + DS[di] + ' ' + hr(k) + ': ' + n + ' order' + (n === 1 ? '' : 's') + '"></i>';
      }
      h += '</div></div>';
    }
    return h + '</div>';
  }

  function waLink(c) {
    var p = String(c.phone || '').replace(/\D/g, '');
    if (p.indexOf('234') !== 0) p = '234' + p.replace(/^0+/, '');
    var biz = (localStorage.getItem('qc_biz_name') || 'our store');
    var first = (c.name || '').split(' ')[0] || 'there';
    var msg = 'Hi ' + first + ', it\u2019s ' + biz + '. We\u2019ve missed you! Come see what\u2019s new in store \u2014 reply here and we\u2019ll set something aside for you.';
    return 'https://wa.me/' + p + '?text=' + encodeURIComponent(msg);
  }

  function drawChart(m) {
    var el = $('adv-chart'); if (!el || typeof window.Chart === 'undefined') return;
    try { if (S.chart) S.chart.destroy(); } catch (e) { }
    var cs = getComputedStyle(document.documentElement);
    var ink = (cs.getPropertyValue('--ink') || '#171717').trim(), line = (cs.getPropertyValue('--border') || '#ebebeb').trim();
    S.chart = new window.Chart(el.getContext('2d'), {
      type: 'bar',
      data: { labels: m.labels, datasets: [{ data: m.series, backgroundColor: ink, borderRadius: 2, maxBarThickness: 14 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + money(c.parsed.y); } } } },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } }, y: { grid: { color: line }, border: { display: false }, ticks: { maxTicksLimit: 4, font: { size: 10 }, callback: function (v) { return v >= 1000 ? Math.round(v / 1000) + 'k' : v; } } } } }
    });
  }

  /* ---------- actions ---------- */
  async function patch(k, data) {
    var r = await fetch(window.DB + '/' + encodeURIComponent(k) + '.json', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error('Database refused the change (' + r.status + ')');
    Object.assign(S.prods[k] = S.prods[k] || {}, data);
    if (window.prods && window.prods[k]) Object.assign(window.prods[k], data);
  }
  async function applyPrice(k, v) {
    var p = S.prods[k]; if (!p) return;
    if (!confirm('Change the price of "' + p.name + '" from ' + money(p.price) + ' to ' + money(v) + '?')) return;
    try { await patch(k, { price: v, lastUpdated: new Date().toISOString() }); say('Price updated to ' + money(v)); render(); }
    catch (e) { say('Could not update: ' + e.message); }
  }
  async function startSale(k, v) {
    var p = S.prods[k]; if (!p) return;
    if (!confirm('Put "' + p.name + '" on sale at ' + money(v) + ' (was ' + money(p.price) + ')? The old price will show crossed out.')) return;
    try { await patch(k, { price: v, originalPrice: Number(p.originalPrice) > Number(p.price) ? p.originalPrice : p.price, lastUpdated: new Date().toISOString() }); say('Sale started'); render(); }
    catch (e) { say('Could not update: ' + e.message); }
  }
  function download(name, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCSV() {
    var m = S.model; if (!m || !m.restock.length) return;
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var rows = [['Product', 'In stock', 'Sells per day', 'Days left', 'Order quantity', 'Unit cost', 'Est. cost']].concat(m.restock.map(function (r) {
      return [r.name, r.stock, r.vel.toFixed(2), r.cover === Infinity ? '' : r.cover.toFixed(1), r.need, r.cost || '', r.cost ? r.spend : ''];
    }));
    download('reorder-list-' + new Date().toISOString().slice(0, 10) + '.csv', rows.map(function (r) { return r.map(q).join(','); }).join('\n'));
  }
  function copyOrder() {
    var m = S.model; if (!m || !m.restock.length) return;
    var txt = 'Hello, I would like to restock:\n' + m.restock.slice(0, 30).map(function (r) { return '\u2022 ' + r.name + ' \u2013 ' + r.need + ' pcs'; }).join('\n') + '\nPlease confirm availability and price. Thank you.';
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { say('Supplier message copied'); }, function () { window.prompt('Copy this message:', txt); });
  }

  /* ---------- wiring ---------- */
  function bindControls() {
    var map = { 'adv-days': 'days', 'adv-lead': 'lead', 'adv-cover': 'cover', 'adv-margin': 'margin' };
    Object.keys(map).forEach(function (id) {
      var el = $(id); if (!el || el._bound) return; el._bound = true;
      el.value = S[map[id]];
      el.addEventListener('change', function () { var v = Number(el.value); if (!(v > 0)) { el.value = S[map[id]]; return; } S[map[id]] = Math.min(v, id === 'adv-margin' ? 90 : 365); if (S.loaded) render(); });
    });
    var rf = $('adv-refresh'); if (rf && !rf._bound) { rf._bound = true; rf.addEventListener('click', function () { load(); }); }
    var root = $('p-advisor');
    if (root && !root._bound) {
      root._bound = true;
      root.addEventListener('click', function (e) {
        var g = e.target.closest('[data-adv-go]');
        if (g) { var s = $('adv-s-' + g.getAttribute('data-adv-go')); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        var b = e.target.closest('[data-adv]'); if (!b) return;
        var a = b.getAttribute('data-adv'), k = b.getAttribute('data-k'), v = Number(b.getAttribute('data-v'));
        if (a === 'price') applyPrice(k, v); else if (a === 'markdown') startSale(k, v); else if (a === 'csv') exportCSV(); else if (a === 'copy-order') copyOrder();
      });
    }
  }

  window.advInit = function () { bindControls(); load(); };
  window.QCAdvisor = { reload: load, state: S };
})();
