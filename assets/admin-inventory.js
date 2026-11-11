/* QuickCart admin — Inventory tracker (overrides loadInventory & friends from admin.html).
   • Working search / category / status filters, sorting, pagination
   • Stock value at cost & retail, days-of-cover from real sales, slow movers, expiry alerts
   • Receive stock (goods-received note, multi-line, scan-friendly, optional cost update)
   • Adjust stock with a reason (damaged, expired, lost, found…)
   • Full movement ledger: every change recorded; sales & returns derived from orders
   • Reorder suggestions grouped by supplier (print / copy / receive) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var money = function (n) { return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG'); };
  var H = { 'Content-Type': 'application/json' };
  var who = function () { return localStorage.getItem('qc_full_name') || localStorage.getItem('qc_logged_user') || 'admin'; };
  var SDB = function () { return getSettingsDB(); };
  var DAY = 864e5;

  var INV = { tab: 'stock', q: '', cat: '', st: '', sort: 'name', page: 1, size: 50, sales: {}, saleRows: [], ledger: [], mv: { type: '', range: '30', q: '' }, loaded: 0 };
  var REASONS = [['correction', 'Stock correction'], ['damaged', 'Damaged'], ['expired', 'Expired'], ['lost', 'Lost / stolen'], ['found', 'Found'], ['sample', 'Sample / promo'], ['own-use', 'Own use'], ['supplier-return', 'Returned to supplier'], ['customer-return', 'Customer return'], ['opening', 'Opening stock']];
  var TYPE_L = { sale: 'Sale', return: 'Return (restock)', receive: 'Goods received', adjust: 'Adjustment', count: 'Stock count', damaged: 'Damaged', expired: 'Expired', lost: 'Lost / stolen', found: 'Found', correction: 'Correction' };

  var css = document.createElement('style');
  css.textContent = '.iv-tabs{display:flex;gap:6px;margin:0 0 14px;flex-wrap:wrap}.iv-tabs button{border:1.5px solid var(--border);background:#fff;border-radius:99px;padding:8px 16px;font-size:12px;font-weight:800;color:var(--ink3);cursor:pointer;font-family:inherit}.iv-tabs button.on{background:var(--ink,#14121a);color:#fff;border-color:var(--ink,#14121a)}'
    + '.iv-k{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px}.iv-k div{background:#fff;border:1px solid var(--border);border-radius:16px;padding:13px 15px}.iv-k b{display:block;font-size:19px;font-weight:800;letter-spacing:-.03em;margin-top:2px}.iv-k span{font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em}'
    + '.iv-bar{display:flex;gap:8px;flex-wrap:wrap;padding:0 16px 12px;align-items:center}.iv-bar input,.iv-bar select{padding:8px 11px;border:1px solid var(--border);border-radius:10px;font-size:12px;background:#fff}.iv-bar input{min-width:200px}'
    + '.iv-th{width:36px;height:36px;border-radius:9px;object-fit:cover;background:var(--grey1);display:flex;align-items:center;justify-content:center}.iv-mini{border:none;background:var(--grey1);border-radius:8px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit}.iv-mini.pri{background:var(--accent);color:#fff}'
    + '#iv-bg{position:fixed;inset:0;background:rgba(20,18,26,.55);backdrop-filter:blur(6px);z-index:9000;display:none;align-items:center;justify-content:center;padding:14px}#iv-bg.on{display:flex}#iv-box{background:#fff;border-radius:22px;width:780px;max-width:100%;max-height:94vh;overflow:auto;box-shadow:0 30px 80px rgba(20,18,26,.3)}'
    + '.iv-hd{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start}.iv-hd h3{margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em}.iv-bd{padding:18px 22px}'
    + '.iv-f{display:grid;grid-template-columns:1fr 1fr;gap:10px}.iv-f label{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);display:block;margin-bottom:4px}.iv-f input,.iv-f select,.iv-f textarea{width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit}'
    + '.iv-lines input{padding:6px 8px;border:1px solid var(--border);border-radius:8px;font-size:12px;width:84px}.iv-sugg{position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.15);z-index:5;max-height:240px;overflow:auto}.iv-sugg div{padding:9px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border)}.iv-sugg div:hover{background:rgba(23,23,23,.07)}'
    + '@media(max-width:900px){.iv-k{grid-template-columns:repeat(2,1fr)}.iv-f{grid-template-columns:1fr}}';
  document.head.appendChild(css);

  /* ── data ── */
  async function loadSales(force) {
    if (!force && Date.now() - INV.loaded < 60000) return;
    var ord = {}, led = {};
    try { ord = await (await fetch(ORDERS_DB + '.json')).json() || {}; } catch (e) {}
    try { led = await (await fetch(SDB() + '/stock_movements.json?orderBy=%22%24key%22&limitToLast=1500')).json() || {}; } catch (e) {}
    var now = Date.now(), sales = {}, rows = [];
    Object.keys(ord).forEach(function (ok) {
      var o = ord[ok], st = String(o.status || 'paid').toLowerCase(), at = Date.parse(o.createdAt || o.date || '') || 0, pos = o.source === 'pos';
      (o.items || []).forEach(function (i) {
        var k = i.k || i.id, q = Number(i.qty != null ? i.qty : i.q) || 0; if (!k || !q) return; if (!pos && !i.stockTracked) return;
        var s = sales[k] = sales[k] || { d30: 0, d90: 0, all: 0, last: 0 };
        rows.push({ type: 'sale', at: at, iso: o.createdAt || '', productKey: k, product: i.name, change: -q, ref: o.ref || ok, by: pos ? (o.cashier || 'POS') : 'online store', src: pos ? 'POS' : 'Online' });
        var gone = st === 'cancelled' || st === 'declined' || (st === 'refunded' && o.stockRestored);
        if (o.stockRestored) rows.push({ type: 'return', at: Date.parse(o.updatedAt || '') || at, iso: o.updatedAt || '', productKey: k, product: i.name, change: +q, ref: o.ref || ok, by: (o.history && o.history.length ? (o.history[o.history.length - 1].by || '') : ''), src: 'Order ' + st });
        if (gone) return;
        s.all += q; if (now - at <= 30 * DAY) s.d30 += q; if (now - at <= 90 * DAY) s.d90 += q; if (at > s.last) s.last = at;
      });
    });
    INV.sales = sales; INV.saleRows = rows;
    INV.ledger = Object.keys(led).map(function (id) { var m = led[id]; return Object.assign({}, m, { _id: id, at: Date.parse(m.at || '') || 0, iso: m.at }); });
    INV.loaded = Date.now();
  }
  window.invSales = function () { return INV.sales; };
  var vel = function (k) { var s = INV.sales[k]; return s ? s.d30 / 30 : 0; };
  var rpOf = function (p) { return p.reorderPoint != null && p.reorderPoint !== '' ? Number(p.reorderPoint) : 5; };
  function stateOf(p, k) {
    var q = Number(p.quantity) || 0, s = INV.sales[k] || { d30: 0 };
    if (p.inStock === 'service') return 'na';
    if (q <= 0) return 'out'; if (q <= rpOf(p)) return 'low';
    if (s.d30 === 0 && q > 0 && (!p.createdAt || Date.now() - Date.parse(p.createdAt) > 30 * DAY)) return 'slow'; return 'ok';
  }
  var BADGE = { out: ['Out of stock', 'out'], low: ['Low', 'low'], ok: ['OK', 'ok'], slow: ['No sales 30d', 'na'], na: ['n/a', 'na'] };
  var expDays = function (p) { if (!p.expiry) return null; var t = Date.parse(p.expiry); return isNaN(t) ? null : Math.floor((t - Date.now()) / DAY); };

  /* ── incr + ledger ── */
  async function incr(k, d) {
    var r = await fetch(DB + '/' + encodeURIComponent(k) + '/quantity.json', { method: 'PUT', headers: H, body: JSON.stringify({ '.sv': { increment: d } }) }); if (!r.ok) throw new Error('Stock update refused (' + r.status + ')');
    var q = Number(await (await fetch(DB + '/' + encodeURIComponent(k) + '/quantity.json')).json()) || 0, p = prods[k] || {};
    if (typeof p.inStock === 'boolean' || p.inStock === undefined) { fetch(DB + '/' + encodeURIComponent(k) + '/inStock.json', { method: 'PUT', headers: H, body: JSON.stringify(q > 0) }).catch(function () {}); }
    if (prods[k]) { prods[k].quantity = q; if (typeof prods[k].inStock === 'boolean') prods[k].inStock = q > 0; } return q;
  }
  var seq = 0;
  function log(e) { var at = new Date().toISOString(), id = Date.now() + '_' + (seq++) + '_' + Math.random().toString(36).slice(2, 5); e = Object.assign({ at: at, by: who() }, e); INV.ledger.push(Object.assign({ _id: id, at: Date.parse(at) }, e)); return fetch(SDB() + '/stock_movements/' + id + '.json', { method: 'PUT', headers: H, body: JSON.stringify(e) }).catch(function () {}); }
  window.invLog = log; window.invIncr = incr;

  /* ── page shell ── */
  function shell() {
    var p = $('p-inventory'); if (!p) return; if ($('iv-root')) return;
    p.innerHTML = '<div class="ptitle">Inventory</div><div class="psub">Live stock levels, receiving, adjustments and a full movement history for POS and online store.</div><div id="iv-root"></div>';
    var bg = document.createElement('div'); bg.id = 'iv-bg'; bg.innerHTML = '<div id="iv-box"></div>'; bg.onclick = function (e) { if (e.target === bg) ivClose(); }; document.body.appendChild(bg);
  }
  window.ivClose = function () { $('iv-bg').classList.remove('on'); };
  window.ivTab = function (t) { INV.tab = t; INV.page = 1; ivRender(); };
  window.ivSet = function (k, v) { INV[k] = v; INV.page = 1; ivRender(true); };

  window.loadInventory = async function () {
    shell(); if (!$('iv-root')) return;
    if (!Object.keys(prods || {}).length) { try { await loadProds(); } catch (e) {} }
    $('iv-root').innerHTML = '<div style="padding:30px;text-align:center;color:var(--ink3)">Loading inventory…</div>';
    await loadSales(true); ivRender();
  };
  window.filterInventory = function () { ivRender(true); };

  function ivRender(keepFocus) {
    var root = $('iv-root'); if (!root) return; var keys = Object.keys(prods || {}), units = 0, vc = 0, vr = 0, low = 0, out = 0, exp = 0;
    keys.forEach(function (k) { var p = prods[k], q = Math.max(0, Number(p.quantity) || 0), s = stateOf(p, k); units += q; vc += q * (Number(p.cost) || 0); vr += q * (Number(p.price) || 0); if (s === 'low') low++; if (s === 'out') out++; var d = expDays(p); if (d !== null && d <= 30 && q > 0) exp++; });
    var tabs = [['stock', '📦 Stock levels'], ['reorder', '🛒 Reorder (' + (low + out) + ')'], ['moves', '🧾 Movement history']];
    var h = '<div class="iv-k"><div><span>Products</span><b>' + keys.length + '</b></div><div><span>Units on hand</span><b>' + units.toLocaleString() + '</b></div><div><span>Value at cost</span><b>' + money(vc) + '</b></div><div><span>Value at retail</span><b>' + money(vr) + '</b><small style="color:#0a9d6b;font-weight:700">+' + money(vr - vc) + ' potential</small></div><div><span>Low / Out</span><b style="color:#d6336c">' + low + ' / ' + out + '</b></div><div><span>Expiring ≤30d</span><b style="color:' + (exp ? '#b45309' : 'inherit') + '">' + exp + '</b></div></div>'
      + '<div class="iv-tabs">' + tabs.map(function (t) { return '<button class="' + (INV.tab === t[0] ? 'on' : '') + '" onclick="ivTab(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '<span style="margin-left:auto;display:flex;gap:6px"><button class="btn btn-orange btn-sm" onclick="ivReceive()">＋ Receive stock</button><button class="btn btn-grey btn-sm" onclick="exportInventoryCSV()">⬇ Valuation CSV</button></span></div>';
    h += INV.tab === 'stock' ? stockTab(keys) : INV.tab === 'reorder' ? reorderTab(keys) : movesTab();
    var f = document.activeElement && document.activeElement.id; root.innerHTML = h;
    if (keepFocus && f && $(f)) { var el = $(f); el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
  }

  /* ── tab: stock ── */
  function stockTab(keys) {
    var q = INV.q.toLowerCase().trim(), cats = {}; keys.forEach(function (k) { cats[prods[k].category || 'Uncategorised'] = 1; });
    var list = keys.filter(function (k) {
      var p = prods[k]; if (INV.cat && (p.category || 'Uncategorised') !== INV.cat) return false;
      var s = stateOf(p, k); if (INV.st === 'attention') { if (s !== 'low' && s !== 'out') return false; } else if (INV.st === 'expiring') { var d = expDays(p); if (d === null || d > 30) return false; } else if (INV.st && s !== INV.st) return false;
      if (q && ((p.name || '') + ' ' + (p.sku || '') + ' ' + (p.barcode || '') + ' ' + (p.brand || '') + ' ' + (p.supplier || '')).toLowerCase().indexOf(q) < 0) return false; return true;
    });
    list.sort(function (a, b) { var A = prods[a], B = prods[b]; if (INV.sort === 'qty') return (Number(A.quantity) || 0) - (Number(B.quantity) || 0); if (INV.sort === 'value') return (Number(B.quantity) * (Number(B.cost) || Number(B.price)) || 0) - (Number(A.quantity) * (Number(A.cost) || Number(A.price)) || 0); if (INV.sort === 'cover') return cover(a) - cover(b); return (A.name || '').localeCompare(B.name || ''); });
    var pages = Math.max(1, Math.ceil(list.length / INV.size)); if (INV.page > pages) INV.page = pages; var sl = list.slice((INV.page - 1) * INV.size, INV.page * INV.size);
    var opt = function (v, l, cur) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + l + '</option>'; };
    return '<div class="box"><div class="box-hd"><h3>Stock levels (' + list.length + ')</h3></div><div class="iv-bar"><input id="iv-q" placeholder="Search name, SKU, barcode, supplier…" value="' + esc(INV.q) + '" oninput="ivSet(\'q\',this.value)">'
      + '<select onchange="ivSet(\'cat\',this.value)"><option value="">All categories</option>' + Object.keys(cats).sort().map(function (c) { return opt(esc(c), esc(c), INV.cat); }).join('') + '</select>'
      + '<select onchange="ivSet(\'st\',this.value)">' + opt('', 'Any status', INV.st) + opt('attention', '⚠ Needs attention (low + out)', INV.st) + opt('low', 'Low stock', INV.st) + opt('out', 'Out of stock', INV.st) + opt('slow', 'No sales in 30 days', INV.st) + opt('expiring', 'Expiring ≤ 30 days', INV.st) + opt('ok', 'Healthy', INV.st) + '</select>'
      + '<select onchange="ivSet(\'sort\',this.value)">' + opt('name', 'Sort: Name', INV.sort) + opt('qty', 'Sort: Lowest stock', INV.sort) + opt('cover', 'Sort: Least days of cover', INV.sort) + opt('value', 'Sort: Highest value', INV.sort) + '</select></div>'
      + '<div style="overflow-x:auto"><table><thead><tr><th>Product</th><th>SKU / Barcode</th><th>Cost</th><th>Price</th><th style="text-align:center">On hand</th><th style="text-align:center">Reorder at</th><th>Value</th><th>Sold 30d</th><th>Cover</th><th>Status</th><th></th></tr></thead><tbody>'
      + (sl.length ? sl.map(function (k) {
        var p = prods[k], qn = Number(p.quantity) || 0, s = stateOf(p, k), b = BADGE[s], sd = (INV.sales[k] || {}).d30 || 0, cv = cover(k), ed = expDays(p);
        return '<tr><td style="min-width:180px"><div style="display:flex;gap:9px;align-items:center">' + (p.image ? '<img class="iv-th" src="' + esc(p.image) + '" loading="lazy">' : '<div class="iv-th">📦</div>') + '<div><b style="font-size:12px">' + esc(p.name) + '</b><div style="font-size:10px;color:var(--ink3)">' + esc(p.category || '') + (ed !== null && ed <= 30 ? ' · <span style="color:#b45309;font-weight:700">' + (ed < 0 ? 'EXPIRED' : 'exp ' + ed + 'd') + '</span>' : '') + '</div></div></div></td>'
          + '<td style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--ink3)">' + esc(p.sku || '—') + '<br>' + esc(p.barcode || '') + '</td><td style="font-size:11px">' + (p.cost ? money(p.cost) : '<span style="color:var(--ink4)">—</span>') + '</td><td style="font-size:11px">' + money(p.price) + '</td>'
          + '<td style="text-align:center;font-weight:800;font-size:14px">' + qn + '</td><td style="text-align:center;color:var(--ink3)">' + rpOf(p) + '</td><td style="font-size:11px">' + money(qn * (Number(p.cost) || Number(p.price) || 0)) + '</td><td style="font-size:11px">' + sd + '</td><td style="font-size:11px">' + (cv === Infinity ? '—' : Math.round(cv) + 'd') + '</td><td><span class="stk ' + b[1] + '">' + b[0] + '</span></td>'
          + '<td style="white-space:nowrap"><button class="iv-mini pri" onclick="ivReceive(\'' + k + '\')">＋ Receive</button> <button class="iv-mini" onclick="ivAdjust(\'' + k + '\')">Adjust</button> <button class="iv-mini" onclick="ivHistory(\'' + k + '\')">History</button></td></tr>';
      }).join('') : '<tr class="empty-row"><td colspan="11">' + (keys.length ? 'No products match' : 'No products yet — add or import some first') + '</td></tr>')
      + '</tbody></table></div><div class="pg-bar" style="display:flex;justify-content:space-between;padding:12px 16px;font-size:12px;color:var(--ink3)"><span>' + list.length + ' products</span><span><button class="btn btn-grey btn-sm" ' + (INV.page <= 1 ? 'disabled' : '') + ' onclick="INV_pg(-1)">‹</button> Page ' + INV.page + '/' + pages + ' <button class="btn btn-grey btn-sm" ' + (INV.page >= pages ? 'disabled' : '') + ' onclick="INV_pg(1)">›</button></span></div></div>';
  }
  window.INV_pg = function (d) { INV.page += d; ivRender(); };
  function cover(k) { var v = vel(k), q = Number(prods[k].quantity) || 0; return v > 0 ? q / v : Infinity; }

  /* ── tab: reorder ── */
  function suggestion(k) { var p = prods[k], q = Number(p.quantity) || 0, v = vel(k), target = Math.max(rpOf(p) * 2, Math.ceil(v * 21)); return Math.max(0, Math.ceil(target - q)); }
  function reorderTab(keys) {
    var need = keys.filter(function (k) { var s = stateOf(prods[k], k); return s === 'low' || s === 'out' || (cover(k) < 7 && (Number(prods[k].quantity) || 0) > 0); });
    var groups = {}; need.forEach(function (k) { var s = prods[k].supplier || 'No supplier set'; (groups[s] = groups[s] || []).push(k); });
    var total = 0; need.forEach(function (k) { total += suggestion(k) * (Number(prods[k].cost) || 0); });
    if (!need.length) return '<div class="box" style="padding:40px;text-align:center;color:var(--ink3)"><div style="font-size:40px">✅</div><b>Nothing needs reordering</b><div style="font-size:12px;margin-top:4px">Everything is above its reorder point and has more than a week of cover.</div></div>';
    return '<div class="box"><div class="box-hd"><h3>Suggested reorder — ' + need.length + ' products · est. ' + money(total) + '</h3><span><button class="btn btn-grey btn-sm" onclick="ivCopyReorder()">📋 Copy for WhatsApp</button> <button class="btn btn-grey btn-sm" onclick="ivPrintReorder()">🖨 Print</button></span></div><div style="padding:0 16px 14px;font-size:11px;color:var(--ink3)">Suggested quantity brings each product to the larger of 2× its reorder point or 3 weeks of sales (based on the last 30 days).</div>'
      + Object.keys(groups).sort().map(function (g) { return '<div style="padding:0 16px"><div style="font-size:12px;font-weight:800;margin:10px 0 6px">🏭 ' + esc(g) + '</div><table><thead><tr><th>Product</th><th>On hand</th><th>Sold 30d</th><th>Suggest order</th><th>Est. cost</th><th></th></tr></thead><tbody>' + groups[g].map(function (k) { var p = prods[k], sg = suggestion(k); return '<tr><td><b style="font-size:12px">' + esc(p.name) + '</b></td><td>' + (Number(p.quantity) || 0) + '</td><td>' + (((INV.sales[k] || {}).d30) || 0) + '</td><td style="font-weight:800">' + sg + '</td><td>' + (p.cost ? money(sg * p.cost) : '—') + '</td><td><button class="iv-mini pri" onclick="ivReceive(\'' + k + '\',' + sg + ')">Receive</button></td></tr>'; }).join('') + '</tbody></table></div>'; }).join('') + '<div style="height:12px"></div></div>';
  }
  function reorderText() {
    var keys = Object.keys(prods).filter(function (k) { var s = stateOf(prods[k], k); return s === 'low' || s === 'out' || (cover(k) < 7 && (Number(prods[k].quantity) || 0) > 0); }), g = {};
    keys.forEach(function (k) { var s = prods[k].supplier || 'Supplier'; (g[s] = g[s] || []).push(k); });
    return { g: g, text: Object.keys(g).map(function (s) { return '*' + s + '*\n' + g[s].map(function (k) { return '• ' + prods[k].name + ' — ' + suggestion(k) + (prods[k].unit && prods[k].unit !== 'piece' ? ' ' + prods[k].unit : ''); }).join('\n'); }).join('\n\n') };
  }
  window.ivCopyReorder = function () { var t = 'Order request — ' + (localStorage.getItem('qc_biz_name') || '') + '\n\n' + reorderText().text; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('📋 Copied — paste into WhatsApp'); }).catch(function () { prompt('Copy:', t); }); };
  window.ivPrintReorder = function () { var r = reorderText(), w = window.open('', '_blank'); if (!w) return; w.document.write('<!doctype html><title>Reorder list</title><body style="font-family:Arial;max-width:700px;margin:30px auto"><h2>Purchase list · ' + new Date().toLocaleDateString('en-NG') + '</h2>' + Object.keys(r.g).map(function (s) { return '<h3>' + esc(s) + '</h3><table style="width:100%;border-collapse:collapse">' + r.g[s].map(function (k) { return '<tr><td style="padding:6px;border-bottom:1px solid #ddd">' + esc(prods[k].name) + '</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right"><b>' + suggestion(k) + '</b></td></tr>'; }).join('') + '</table>'; }).join('') + '<script>setTimeout(print,300)<\/script>'); w.document.close(); };

  /* ── tab: movements ── */
  function movesTab() {
    var cut = INV.mv.range === 'all' ? 0 : Date.now() - Number(INV.mv.range) * DAY, q = (INV.mv.q || '').toLowerCase();
    var all = INV.saleRows.concat(INV.ledger).filter(function (m) { return m.at >= cut && (!INV.mv.type || m.type === INV.mv.type || (INV.mv.type === 'adjust' && ['adjust', 'damaged', 'expired', 'lost', 'found', 'correction'].indexOf(m.type) > -1)) && (!q || ((m.product || '') + ' ' + (m.ref || '') + ' ' + (m.by || '')).toLowerCase().indexOf(q) > -1); }).sort(function (a, b) { return b.at - a.at; });
    INV._mv = all; var sl = all.slice(0, 300), o = function (v, l) { return '<option value="' + v + '"' + (INV.mv.type === v ? ' selected' : '') + '>' + l + '</option>'; }, r = function (v, l) { return '<option value="' + v + '"' + (INV.mv.range === v ? ' selected' : '') + '>' + l + '</option>'; };
    return '<div class="box"><div class="box-hd"><h3>Movement history (' + all.length + ')</h3><button class="btn btn-grey btn-sm" onclick="ivExportMoves()">⬇ Export</button></div><div class="iv-bar"><input id="iv-mq" placeholder="Search product, ref, person…" value="' + esc(INV.mv.q) + '" oninput="INV.mv.q=this.value;ivRender(true)"><select onchange="INV.mv.type=this.value;ivRender()">' + o('', 'All movements') + o('sale', 'Sales') + o('return', 'Returns') + o('receive', 'Goods received') + o('adjust', 'Adjustments') + o('count', 'Stock counts') + '</select><select onchange="INV.mv.range=this.value;ivRender()">' + r('7', 'Last 7 days') + r('30', 'Last 30 days') + r('90', 'Last 90 days') + r('all', 'All time') + '</select></div>'
      + '<div style="overflow-x:auto"><table><thead><tr><th>When</th><th>Product</th><th>Type</th><th style="text-align:center">Change</th><th style="text-align:center">Balance</th><th>Ref / reason</th><th>By</th></tr></thead><tbody>'
      + (sl.length ? sl.map(function (m) { var ch = Number(m.change) || 0, rs = m.reason ? (REASONS.filter(function (x) { return x[0] === m.reason; })[0] || [0, m.reason])[1] : ''; return '<tr><td style="font-size:11px;white-space:nowrap">' + (m.at ? new Date(m.at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') + '</td><td style="font-size:12px;font-weight:600">' + esc(m.product || '') + '</td><td style="font-size:11px">' + esc(TYPE_L[m.type] || m.type) + '</td><td style="text-align:center;font-weight:800;color:' + (ch < 0 ? '#d6336c' : '#0a9d6b') + '">' + (ch > 0 ? '+' : '') + ch + '</td><td style="text-align:center;font-size:11px;color:var(--ink3)">' + (m.after != null ? m.after : '—') + '</td><td style="font-size:11px;color:var(--ink3)">' + esc(m.ref || '') + (rs ? ' ' + esc(rs) : '') + (m.supplier ? ' · ' + esc(m.supplier) : '') + (m.note ? ' — ' + esc(m.note) : '') + '</td><td style="font-size:11px">' + esc(m.by || '') + '</td></tr>'; }).join('') : '<tr class="empty-row"><td colspan="7">No movements in this period</td></tr>') + '</tbody></table></div>' + (all.length > 300 ? '<div style="padding:10px 16px;font-size:11px;color:var(--ink3)">Showing latest 300 — export for the full list.</div>' : '') + '</div>';
  }
  window.INV = INV; window.ivRender = ivRender; // used by inline handlers
  window.ivExportMoves = function () { var rows = [['When', 'Product', 'Type', 'Change', 'Balance after', 'Ref', 'Reason', 'Supplier', 'Note', 'By']].concat((INV._mv || []).map(function (m) { return [m.at ? new Date(m.at).toISOString() : '', m.product, TYPE_L[m.type] || m.type, m.change, m.after != null ? m.after : '', m.ref || '', m.reason || '', m.supplier || '', m.note || '', m.by || '']; })); dlCsv('stock-movements-' + new Date().toISOString().slice(0, 10) + '.csv', rows); };
  function dlCsv(name, rows) { var t = rows.map(function (r) { return r.map(function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n'); var b = new Blob(['\uFEFF' + t], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); }
  window.exportInventoryCSV = function () { var keys = Object.keys(prods || {}); if (!keys.length) { toast('No data'); return; } dlCsv('inventory-valuation-' + new Date().toISOString().slice(0, 10) + '.csv', [['Name', 'SKU', 'Barcode', 'Category', 'Supplier', 'Cost', 'Price', 'On hand', 'Reorder point', 'Value at cost', 'Value at retail', 'Sold 30d', 'Status']].concat(keys.map(function (k) { var p = prods[k], q = Number(p.quantity) || 0; return [p.name, p.sku || '', p.barcode || '', p.category || '', p.supplier || '', p.cost || 0, p.price || 0, q, rpOf(p), q * (p.cost || 0), q * (p.price || 0), ((INV.sales[k] || {}).d30) || 0, BADGE[stateOf(p, k)][0]]; }))); };

  /* ── modals ── */
  function box(html) { shell(); $('iv-box').innerHTML = html; $('iv-bg').classList.add('on'); }
  window.openInvEdit = function (k) { ivAdjust(k); };
  window.ivHistory = async function (k) {
    await loadSales(); var p = prods[k] || {}, rows = INV.saleRows.concat(INV.ledger).filter(function (m) { return m.productKey === k; }).sort(function (a, b) { return b.at - a.at; }).slice(0, 100);
    box('<div class="iv-hd"><div><h3>' + esc(p.name) + '</h3><div style="font-size:12px;color:var(--ink3);margin-top:3px">On hand: <b>' + (Number(p.quantity) || 0) + '</b> · sold last 30d: ' + (((INV.sales[k] || {}).d30) || 0) + '</div></div><button class="btn btn-grey btn-sm" onclick="ivClose()">✕</button></div><div class="iv-bd"><table><thead><tr><th>When</th><th>Type</th><th>Change</th><th>Ref / reason</th><th>By</th></tr></thead><tbody>' + (rows.length ? rows.map(function (m) { var ch = Number(m.change) || 0; return '<tr><td style="font-size:11px">' + new Date(m.at).toLocaleString('en-NG') + '</td><td style="font-size:11px">' + esc(TYPE_L[m.type] || m.type) + '</td><td style="font-weight:800;color:' + (ch < 0 ? '#d6336c' : '#0a9d6b') + '">' + (ch > 0 ? '+' : '') + ch + '</td><td style="font-size:11px;color:var(--ink3)">' + esc(m.ref || m.reason || '') + (m.note ? ' — ' + esc(m.note) : '') + '</td><td style="font-size:11px">' + esc(m.by || '') + '</td></tr>'; }).join('') : '<tr class="empty-row"><td colspan="5">No recorded movements yet</td></tr>') + '</tbody></table></div>');
  };
  window.ivAdjust = function (k) {
    var p = prods[k]; if (!p) return;
    box('<div class="iv-hd"><div><h3>Adjust stock</h3><div style="font-size:12px;color:var(--ink3);margin-top:3px">' + esc(p.name) + ' — currently <b>' + (Number(p.quantity) || 0) + '</b></div></div><button class="btn btn-grey btn-sm" onclick="ivClose()">✕</button></div><div class="iv-bd"><div class="iv-f">'
      + '<div><label>Action</label><select id="ad-mode" onchange="ivAdPreview()"><option value="set">Set stock to…</option><option value="add">Add…</option><option value="remove">Remove…</option></select></div><div><label>Quantity</label><input type="number" id="ad-qty" min="0" value="' + (Number(p.quantity) || 0) + '" oninput="ivAdPreview()"></div>'
      + '<div><label>Reason</label><select id="ad-reason">' + REASONS.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('') + '</select></div><div><label>Reorder point</label><input type="number" id="ad-rp" min="0" value="' + rpOf(p) + '"></div>'
      + '<div style="grid-column:1/-1"><label>Note</label><input id="ad-note" placeholder="e.g. 2 cartons water-damaged in store room"></div></div><div id="ad-prev" style="margin:12px 0;font-size:13px;font-weight:700"></div><div style="display:flex;gap:8px"><button class="btn btn-orange" onclick="ivAdSave(\'' + k + '\')">💾 Save adjustment</button><button class="btn btn-grey" onclick="ivClose()">Cancel</button></div></div>'); INV._ad = k; ivAdPreview();
  };
  function adTarget() { var p = prods[INV._ad], cur = Number(p.quantity) || 0, v = Math.max(0, Number($('ad-qty').value) || 0), m = $('ad-mode').value; return m === 'set' ? v : m === 'add' ? cur + v : Math.max(0, cur - v); }
  window.ivAdPreview = function () { var p = prods[INV._ad]; if (!p || !$('ad-prev')) return; var cur = Number(p.quantity) || 0, t = adTarget(), d = t - cur; $('ad-prev').innerHTML = cur + ' → <span style="color:' + (d < 0 ? '#d6336c' : d > 0 ? '#0a9d6b' : 'inherit') + '">' + t + '</span> (' + (d > 0 ? '+' : '') + d + ' · ' + money(Math.abs(d) * (Number(p.cost) || Number(p.price) || 0)) + ')'; };
  window.ivAdSave = async function (k) {
    var p = prods[k], cur = Number(p.quantity) || 0, t = adTarget(), d = t - cur, rp = Math.max(0, Number($('ad-rp').value) || 0);
    try {
      var after = cur; if (d !== 0) { after = await incr(k, d); await log({ type: $('ad-reason').value === 'damaged' || $('ad-reason').value === 'expired' || $('ad-reason').value === 'lost' || $('ad-reason').value === 'found' ? $('ad-reason').value : 'adjust', productKey: k, product: p.name, before: cur, after: after, change: d, reason: $('ad-reason').value, note: $('ad-note').value.trim(), ref: 'Manual adjustment' }); }
      if (rp !== rpOf(p)) { await fetch(DB + '/' + encodeURIComponent(k) + '/reorderPoint.json', { method: 'PUT', headers: H, body: JSON.stringify(rp) }); prods[k].reorderPoint = rp; }
      ivClose(); toast('✅ Stock updated' + (d ? ' (' + (d > 0 ? '+' : '') + d + ')' : '')); ivRender();
    } catch (e) { toast('❌ ' + e.message); }
  };
  window.saveInventoryUpdate = function () {};

  /* Receive stock (goods received note) */
  var RC = { lines: [] };
  window.ivReceive = function (k, qty) {
    RC.lines = []; if (k && prods[k]) RC.lines.push({ k: k, qty: qty || 1, cost: Number(prods[k].cost) || 0, expiry: prods[k].expiry || '' });
    box('<div class="iv-hd"><div><h3>Receive stock</h3><div style="font-size:12px;color:var(--ink3);margin-top:3px">Record goods coming in — scan or search each product</div></div><button class="btn btn-grey btn-sm" onclick="ivClose()">✕</button></div><div class="iv-bd"><div class="iv-f"><div><label>Supplier</label><input id="rc-sup" list="rc-suplist" placeholder="e.g. Dangote Distributors" value="' + esc(k && prods[k] ? prods[k].supplier || '' : '') + '"><datalist id="rc-suplist">' + supplierList() + '</datalist></div><div><label>Invoice / waybill no.</label><input id="rc-ref" placeholder="optional"></div></div>'
      + '<div style="position:relative;margin:14px 0 8px"><input id="rc-find" autocomplete="off" placeholder="📷 Scan barcode or type product name / SKU…" style="width:100%;padding:11px 14px;border:1.5px solid var(--accent);border-radius:12px;font-size:13px" oninput="ivRcFind(this.value)" onkeydown="if(event.key===\'Enter\'){ivRcEnter(this.value);event.preventDefault()}"><div id="rc-sugg" class="iv-sugg" style="display:none"></div></div><div id="rc-lines" class="iv-lines"></div>'
      + '<label style="display:flex;gap:7px;align-items:center;font-size:12px;margin:12px 0;font-weight:600"><input type="checkbox" id="rc-upcost" checked> Update product cost price when it differs</label><div style="display:flex;gap:8px"><button class="btn btn-orange" onclick="ivRcSave()">✅ Add to stock</button><button class="btn btn-grey" onclick="ivClose()">Cancel</button></div></div>'); rcRender(); setTimeout(function () { var f = $('rc-find'); if (f) f.focus(); }, 60);
  };
  function supplierList() { var s = {}; Object.keys(prods).forEach(function (k) { if (prods[k].supplier) s[prods[k].supplier] = 1; }); return Object.keys(s).map(function (x) { return '<option value="' + esc(x) + '">'; }).join(''); }
  function search(q) { q = String(q || '').toLowerCase().trim(); if (!q) return []; return Object.keys(prods).filter(function (k) { var p = prods[k]; return ((p.name || '') + ' ' + (p.sku || '') + ' ' + (p.barcode || '')).toLowerCase().indexOf(q) > -1; }).slice(0, 8); }
  window.ivRcFind = function (v) { var r = search(v), s = $('rc-sugg'); if (!r.length || String(v).length < 2) { s.style.display = 'none'; return; } s.style.display = 'block'; s.innerHTML = r.map(function (k) { return '<div onclick="ivRcAdd(\'' + k + '\')"><b>' + esc(prods[k].name) + '</b> <span style="color:var(--ink3)">· ' + esc(prods[k].sku || prods[k].barcode || '') + ' · stock ' + (Number(prods[k].quantity) || 0) + '</span></div>'; }).join(''); };
  window.ivRcEnter = function (v) { v = String(v).trim().toLowerCase(); var ex = Object.keys(prods).filter(function (k) { return String(prods[k].barcode || '').toLowerCase() === v || String(prods[k].sku || '').toLowerCase() === v; }); var hit = ex.length ? ex[0] : (search(v).length === 1 ? search(v)[0] : null); if (hit) ivRcAdd(hit); else toast(search(v).length > 1 ? 'Several matches — pick one below' : '❌ No product matches "' + v + '"'); };
  window.ivRcAdd = function (k) { var l = RC.lines.filter(function (x) { return x.k === k; })[0]; if (l) l.qty++; else RC.lines.push({ k: k, qty: 1, cost: Number(prods[k].cost) || 0, expiry: prods[k].expiry || '' }); var f = $('rc-find'); f.value = ''; $('rc-sugg').style.display = 'none'; rcRender(); f.focus(); };
  window.ivRcSet = function (i, f, v) { RC.lines[i][f] = f === 'expiry' ? v : Math.max(0, Number(v) || 0); rcTotal(); };
  window.ivRcDel = function (i) { RC.lines.splice(i, 1); rcRender(); };
  function rcTotal() { var t = RC.lines.reduce(function (s, l) { return s + l.qty * l.cost; }, 0), u = RC.lines.reduce(function (s, l) { return s + l.qty; }, 0), e = $('rc-total'); if (e) e.textContent = u + ' units · ' + money(t); }
  function rcRender() { $('rc-lines').innerHTML = RC.lines.length ? '<table><thead><tr><th>Product</th><th>Qty</th><th>Unit cost ₦</th><th>Expiry</th><th></th></tr></thead><tbody>' + RC.lines.map(function (l, i) { var p = prods[l.k]; return '<tr><td style="font-size:12px;font-weight:600">' + esc(p.name) + '<div style="font-size:10px;color:var(--ink3)">now ' + (Number(p.quantity) || 0) + '</div></td><td><input type="number" min="1" value="' + l.qty + '" oninput="ivRcSet(' + i + ',\'qty\',this.value)"></td><td><input type="number" min="0" value="' + l.cost + '" oninput="ivRcSet(' + i + ',\'cost\',this.value)"></td><td><input type="date" style="width:130px" value="' + esc(l.expiry || '') + '" onchange="ivRcSet(' + i + ',\'expiry\',this.value)"></td><td><button class="iv-mini" onclick="ivRcDel(' + i + ')">✕</button></td></tr>'; }).join('') + '</tbody></table><div id="rc-total" style="text-align:right;font-weight:800;margin-top:8px"></div>' : '<div style="padding:18px;text-align:center;color:var(--ink3);font-size:12px;border:1.5px dashed var(--border);border-radius:14px">No products yet — scan a barcode or search above</div>'; rcTotal(); }
  window.ivRcSave = async function () {
    if (!RC.lines.length) { toast('Add at least one product'); return; } var sup = $('rc-sup').value.trim(), ref = $('rc-ref').value.trim(), up = $('rc-upcost').checked, n = 0;
    try {
      for (var i = 0; i < RC.lines.length; i++) {
        var l = RC.lines[i], p = prods[l.k]; if (!l.qty) continue; var before = Number(p.quantity) || 0, after = await incr(l.k, l.qty), patch = {};
        if (up && l.cost && l.cost !== Number(p.cost)) patch.cost = l.cost; if (sup) patch.supplier = sup; if (l.expiry) patch.expiry = l.expiry; patch.lastReceivedAt = new Date().toISOString();
        await fetch(DB + '/' + encodeURIComponent(l.k) + '.json', { method: 'PATCH', headers: H, body: JSON.stringify(patch) }); Object.assign(prods[l.k], patch);
        await log({ type: 'receive', productKey: l.k, product: p.name, before: before, after: after, change: l.qty, ref: ref || 'Goods received', supplier: sup, cost: l.cost }); n += l.qty;
      }
      ivClose(); toast('✅ ' + n + ' units added to stock'); ivRender();
    } catch (e) { toast('❌ ' + e.message + ' — some lines may already be saved; check History'); }
  };

  window.loadSalesForStock = loadSales;
})();
