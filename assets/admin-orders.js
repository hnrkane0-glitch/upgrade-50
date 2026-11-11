/* QuickCart admin — Orders upgrade. Loaded after admin.html's script; overrides renderOrds/filterOrds/exportOrdersCSV.
   Click any order → detail drawer with the standard fulfilment workflow:
   Pending → Approve payment → Processing → Shipped → Delivered · Decline / Cancel (restocks) · Refund · Notes · Contact · Print */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var money = function (n) { return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG'); };
  var H = { 'Content-Type': 'application/json' };
  var NS = function () { return getUserNS(); };
  var who = function () { return localStorage.getItem('qc_full_name') || localStorage.getItem('qc_logged_user') || 'admin'; };

  var ST = {
    pending:    { l: 'Awaiting payment', c: '#b45309', bg: 'rgba(245,158,11,.15)' },
    paid:       { l: 'Paid',             c: '#0a9d6b', bg: 'rgba(10,157,107,.13)' },
    processing: { l: 'Processing',       c: '#2563eb', bg: 'rgba(37,99,235,.12)' },
    shipped:    { l: 'Shipped',          c: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
    delivered:  { l: 'Delivered',        c: '#047857', bg: 'rgba(4,120,87,.14)' },
    cancelled:  { l: 'Cancelled',        c: '#6b7280', bg: 'rgba(107,114,128,.14)' },
    declined:   { l: 'Declined',         c: '#d6336c', bg: 'rgba(214,51,108,.12)' },
    refunded:   { l: 'Refunded',         c: '#6b7280', bg: 'rgba(107,114,128,.14)' }
  };
  var statusOf = function (o) { var s = String(o.status || 'paid').toLowerCase(); if (s === 'completed' || s === 'complete') return 'delivered'; return ST[s] ? s : 'paid'; };
  var isPOS = function (o) { return o.source === 'pos'; };
  var created = function (o) { return o.createdAt || o.date || ''; };
  var custName = function (o) { return o.customerName || (o.customer && o.customer.name) || (isPOS(o) ? 'Walk-in customer' : '—'); };
  var custPhone = function (o) { return o.phone || (o.customer && o.customer.phone) || ''; };
  var custEmail = function (o) { return o.email || (o.customer && o.customer.email) || o.customerEmail || ''; };
  var custAddr = function (o) { return o.address || (o.customer && o.customer.address) || ''; };
  var qtyOf = function (i) { return Number(i.qty != null ? i.qty : i.q) || 0; };
  var badge = function (s) { var x = ST[s] || ST.paid; return '<span style="background:' + x.bg + ';color:' + x.c + ';font-size:10px;font-weight:800;padding:4px 10px;border-radius:99px;letter-spacing:.03em;white-space:nowrap">' + x.l.toUpperCase() + '</span>'; };
  var payLabel = function (o) { var m = o.payMethod || o.method || ''; return ({ card: 'Card', transfer: 'Bank transfer', cash: 'Cash', whatsapp: 'WhatsApp order', split: 'Split', pod: 'Pay on delivery' })[m] || m || '—'; };

  var S = { status: 'all', source: 'all', range: 'all', page: 1, size: 40, sel: {}, open: null };

  var css = document.createElement('style');
  css.textContent = '.ok-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.ok{background:#fff;border:1px solid var(--border);border-radius:16px;padding:14px 16px}.ok b{display:block;font-size:22px;font-weight:800;letter-spacing:-.03em}.ok span{font-size:11px;color:var(--ink3);font-weight:600}'
    + '.chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 10px}.chip{border:1.5px solid var(--border);background:#fff;border-radius:99px;padding:6px 13px;font-size:11px;font-weight:700;cursor:pointer;color:var(--ink3)}.chip.on{background:var(--ink,#14121a);color:#fff;border-color:var(--ink,#14121a)}.chip i{font-style:normal;opacity:.6;margin-left:4px}'
    + '.of-bar{display:flex;gap:8px;flex-wrap:wrap;padding:0 16px 12px;align-items:center}.of-bar select{padding:8px 11px;border:1px solid var(--border);border-radius:10px;font-size:12px;background:#fff}'
    + '#ord-tb tr.orow{cursor:pointer;transition:.12s}#ord-tb tr.orow:hover{background:rgba(23,23,23,.05)}'
    + '#od-bg{position:fixed;inset:0;background:rgba(20,18,26,.45);backdrop-filter:blur(3px);z-index:8000;display:none}#od-bg.on{display:block}'
    + '#od{position:fixed;top:0;right:0;bottom:0;width:560px;max-width:100%;background:#fff;z-index:8001;transform:translateX(105%);transition:.28s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;box-shadow:-20px 0 60px rgba(20,18,26,.25)}#od.on{transform:none}'
    + '.od-hd{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:10px}.od-bd{flex:1;overflow:auto;padding:16px 20px 24px}.od-ft{padding:14px 20px;border-top:1px solid var(--border);background:#faf7f2;display:flex;gap:8px;flex-wrap:wrap}'
    + '.od-sec{margin-bottom:18px}.od-sec h4{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin:0 0 8px}'
    + '.od-card{border:1px solid var(--border);border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.7}'
    + '.od-it{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px}.od-it:last-child{border:none}.od-it img,.od-it .ph{width:42px;height:42px;border-radius:10px;object-fit:cover;background:var(--grey1);display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '.tl{position:relative;padding-left:20px}.tl:before{content:"";position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:var(--border)}.tl div{position:relative;margin-bottom:12px;font-size:12px}.tl div:before{content:"";position:absolute;left:-19px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--accent);border:2px solid #fff;box-shadow:0 0 0 1px var(--accent)}.tl small{display:block;color:var(--ink3);font-size:11px}'
    + '.abtn{border:none;border-radius:99px;padding:10px 16px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}.abtn.go{background:linear-gradient(135deg,#171717,#333);color:#fff}.abtn.ok2{background:#0a9d6b;color:#fff}.abtn.no{background:rgba(214,51,108,.1);color:#d6336c}.abtn.gr{background:#efe9e1;color:#14121a}'
    + '@media(max-width:700px){.ok-row{grid-template-columns:1fr 1fr}#od{width:100%}}';
  document.head.appendChild(css);

  /* ── data helpers ── */
  var inRange = function (o) { if (S.range === 'all') return true; var d = new Date(created(o)); if (isNaN(d)) return false; var now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (S.range === 'today') return d >= start; var days = S.range === '7d' ? 7 : 30; return d >= new Date(start.getTime() - (days - 1) * 864e5); };
  function visible(data) {
    var q = (($('osearch') || {}).value || '').toLowerCase().trim();
    return Object.keys(data || {}).filter(function (k) {
      var o = data[k], s = statusOf(o);
      if (S.status !== 'all') { if (S.status === 'closed') { if (s !== 'cancelled' && s !== 'declined') return false; } else if (s !== S.status) return false; }
      if (S.source !== 'all' && (S.source === 'pos') !== isPOS(o)) return false;
      if (!inRange(o)) return false;
      if (q && ((o.ref || k) + ' ' + custName(o) + ' ' + custPhone(o) + ' ' + custEmail(o) + ' ' + (o.bankRef || '') + ' ' + (o.items || []).map(function (i) { return i.name; }).join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return new Date(created(data[b])) - new Date(created(data[a])); });
  }

  /* ── page shell (built once) ── */
  function shell() {
    var p = $('p-orders'); if (!p || $('ord-kpis')) return;
    p.innerHTML = '<div class="ptitle">Orders</div><div class="psub">Click any order to approve, decline, ship, refund or contact the customer. Online and POS sales in one place.</div>'
      + '<div class="ok-row" id="ord-kpis"></div>'
      + '<div class="box"><div class="box-hd"><h3>All orders (<span id="ord-count">0</span>)</h3><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><input class="sinput" id="osearch" placeholder="Search ref, name, phone, item…" oninput="filterOrds()" type="text"><button class="btn btn-grey btn-sm" onclick="exportOrdersCSV()">⬇ Export CSV</button></div></div>'
      + '<div class="chips" id="ord-chips"></div>'
      + '<div class="of-bar"><select onchange="ordSet(\'source\',this.value)"><option value="all">All sources</option><option value="online">🌐 Online store</option><option value="pos">🏪 POS</option></select><select onchange="ordSet(\'range\',this.value)"><option value="all">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select>'
      + '<span id="ord-bulk" style="display:none;gap:6px;margin-left:auto"><button class="abtn gr" onclick="ordBulk(\'processing\')">Mark processing</button><button class="abtn gr" onclick="ordBulk(\'shipped\')">Mark shipped</button><button class="abtn ok2" onclick="ordBulk(\'delivered\')">Mark delivered</button></span></div>'
      + '<div style="overflow-x:auto"><table><thead><tr><th style="width:34px"><input type="checkbox" onchange="ordSelAll(this)"></th><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead><tbody id="ord-tb"></tbody></table></div><div id="ord-pg" class="pg-bar" style="display:flex;justify-content:space-between;padding:12px 16px;font-size:12px;color:var(--ink3)"></div></div>';
    var bg = document.createElement('div'); bg.id = 'od-bg'; bg.onclick = closeOrder; document.body.appendChild(bg);
    var d = document.createElement('div'); d.id = 'od'; document.body.appendChild(d);
  }
  window.ordSet = function (k, v) { S[k] = v; S.page = 1; renderOrds(orders); };
  window.ordSelAll = function (cb) { var ks = visible(orders).slice((S.page - 1) * S.size, S.page * S.size); ks.forEach(function (k) { if (cb.checked) S.sel[k] = 1; else delete S.sel[k]; }); renderOrds(orders); };
  window.ordTick = function (k, cb, ev) { ev.stopPropagation(); if (cb.checked) S.sel[k] = 1; else delete S.sel[k]; var n = Object.keys(S.sel).length; $('ord-bulk').style.display = n ? 'flex' : 'none'; };

  window.renderOrds = function (data) {
    shell(); data = data || orders; var all = Object.keys(data), cnt = { all: all.length, closed: 0 };
    all.forEach(function (k) { var s = statusOf(data[k]); cnt[s] = (cnt[s] || 0) + 1; if (s === 'cancelled' || s === 'declined') cnt.closed++; });
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var rev = all.filter(function (k) { var o = data[k], s = statusOf(o); return new Date(created(o)) >= today && s !== 'cancelled' && s !== 'declined' && s !== 'refunded' && s !== 'pending'; }).reduce(function (t, k) { return t + (Number(data[k].total) || 0); }, 0);
    $('ord-kpis').innerHTML = '<div class="ok"><b style="color:#b45309">' + (cnt.pending || 0) + '</b><span>Awaiting payment / approval</span></div><div class="ok"><b style="color:#2563eb">' + ((cnt.paid || 0) + (cnt.processing || 0)) + '</b><span>To fulfil (paid &amp; processing)</span></div><div class="ok"><b style="color:#7c3aed">' + (cnt.shipped || 0) + '</b><span>On the way</span></div><div class="ok"><b>' + money(rev) + '</b><span>Revenue today</span></div>';
    var chips = [['all', 'All'], ['pending', 'Awaiting payment'], ['paid', 'Paid'], ['processing', 'Processing'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['closed', 'Cancelled / declined'], ['refunded', 'Refunded']];
    $('ord-chips').innerHTML = chips.map(function (c) { return '<button class="chip' + (S.status === c[0] ? ' on' : '') + '" onclick="ordSet(\'status\',\'' + c[0] + '\')">' + c[1] + '<i>' + (cnt[c[0]] || 0) + '</i></button>'; }).join('');
    var keys = visible(data), pages = Math.max(1, Math.ceil(keys.length / S.size)); if (S.page > pages) S.page = pages; var slice = keys.slice((S.page - 1) * S.size, S.page * S.size);
    $('ord-count').textContent = keys.length;
    $('ord-tb').innerHTML = !slice.length ? '<tr class="empty-row"><td colspan="8">' + (all.length ? 'No orders match these filters' : 'No orders yet') + '</td></tr>' : slice.map(function (k) {
      var o = data[k], s = statusOf(o), d = created(o), n = (o.items || []).reduce(function (t, i) { return t + qtyOf(i); }, 0);
      return '<tr class="orow" onclick="openOrder(\'' + k + '\')"><td onclick="event.stopPropagation()"><input type="checkbox" ' + (S.sel[k] ? 'checked' : '') + ' onchange="ordTick(\'' + k + '\',this,event)"></td>'
        + '<td><div style="font-family:\'DM Mono\',monospace;font-size:11px;font-weight:700">' + esc((o.ref || k).slice(0, 18)) + '</div><div style="font-size:10px;color:var(--ink4)">' + (isPOS(o) ? '🏪 POS' : '🌐 Online') + '</div></td>'
        + '<td><div style="font-weight:600;font-size:12px">' + esc(custName(o)) + '</div><div style="font-size:10px;color:var(--ink3)">' + esc(custPhone(o)) + '</div></td><td>' + n + '</td>'
        + '<td style="font-weight:800;font-family:\'DM Mono\',monospace">' + money(o.total) + '</td><td style="font-size:11px;color:var(--ink3)">' + esc(payLabel(o)) + (o.autoConfirmed ? ' <span title="Confirmed automatically by the bank" style="color:#0a9d6b">✓ auto</span>' : '') + '</td><td>' + badge(s) + '</td>'
        + '<td style="font-size:11px;color:var(--ink3);white-space:nowrap">' + (d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) + '<br>' + new Date(d).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : '—') + '</td></tr>';
    }).join('');
    $('ord-pg').innerHTML = '<span>' + keys.length + ' order' + (keys.length === 1 ? '' : 's') + '</span><span><button class="btn btn-grey btn-sm" ' + (S.page <= 1 ? 'disabled' : '') + ' onclick="ordPg(-1)">‹ Prev</button> Page ' + S.page + '/' + pages + ' <button class="btn btn-grey btn-sm" ' + (S.page >= pages ? 'disabled' : '') + ' onclick="ordPg(1)">Next ›</button></span>';
    $('ord-bulk').style.display = Object.keys(S.sel).length ? 'flex' : 'none';
  };
  window.ordPg = function (d) { S.page += d; renderOrds(orders); };
  window.filterOrds = function () { S.page = 1; renderOrds(orders); };

  /* ── workflow ── */
  function actions(o) {
    var s = statusOf(o), a = [];
    if (isPOS(o)) { if (s === 'paid' || s === 'delivered') a.push(['refund', 'Refund / void sale', 'no']); return a; }
    if (s === 'pending') { a.push(['approve', '✓ Approve payment', 'ok2'], ['decline', 'Decline', 'no']); }
    if (s === 'paid') { a.push(['processing', 'Start processing', 'go'], ['shipped', 'Mark shipped', 'gr'], ['cancel', 'Cancel order', 'no']); }
    if (s === 'processing') { a.push(['shipped', 'Mark shipped', 'go'], ['delivered', 'Mark delivered', 'gr'], ['cancel', 'Cancel order', 'no']); }
    if (s === 'shipped') { a.push(['delivered', '✓ Mark delivered', 'ok2']); }
    if (s === 'paid' || s === 'processing' || s === 'shipped' || s === 'delivered') a.push(['refund', 'Refund', 'no']);
    return a;
  }
  async function restock(o) {
    if (o.stockRestored) return 0; var n = 0;
    for (var i = 0; i < (o.items || []).length; i++) {
      var it = o.items[i], k = it.k || it.id, q = qtyOf(it); if (!k || !q || !prods[k]) continue;
      if (!isPOS(o) && !it.stockTracked) continue; // online items the store never decremented
      try { var r = await fetch(DB + '/' + encodeURIComponent(k) + '/quantity.json', { method: 'PUT', headers: H, body: JSON.stringify({ '.sv': { increment: q } }) }); if (r.ok) { prods[k].quantity = (Number(prods[k].quantity) || 0) + q; n += q; } } catch (e) {}
    }
    return n;
  }
  async function commit(k, patch, hist) {
    var o = orders[k]; var h = Array.isArray(o.history) ? o.history.slice() : [{ s: statusOf(o), at: created(o) || new Date().toISOString(), by: isPOS(o) ? (o.cashier || 'POS') : 'customer', note: 'Order placed' }];
    if (hist) h.push(Object.assign({ at: new Date().toISOString(), by: who() }, hist)); patch.history = h; patch.updatedAt = new Date().toISOString();
    var r = await fetch(ORDERS_DB + '/' + encodeURIComponent(k) + '.json', { method: 'PATCH', headers: H, body: JSON.stringify(patch) });
    if (!r.ok) throw new Error('Could not save (' + r.status + ')'); Object.assign(o, patch);
  }
  window.orderAct = async function (k, act) {
    var o = orders[k]; if (!o) return; var note = '', patch = {}, hist = {}, msg = '';
    try {
      if (act === 'approve') { if (!confirm('Confirm you have received ' + money(o.total) + ' from ' + custName(o) + '?')) return; patch.status = 'paid'; patch.paidAt = new Date().toISOString(); hist = { s: 'paid', note: 'Payment approved' }; msg = 'Payment approved'; }
      if (act === 'processing') { patch.status = 'processing'; hist = { s: 'processing', note: 'Being prepared' }; msg = 'Marked as processing'; }
      if (act === 'shipped') { var c = prompt('Courier / rider and tracking number (optional):', o.courier || ''); if (c === null) return; patch.status = 'shipped'; patch.courier = c; patch.shippedAt = new Date().toISOString(); hist = { s: 'shipped', note: c ? 'Shipped via ' + c : 'Shipped' }; msg = 'Marked as shipped'; }
      if (act === 'delivered') { patch.status = 'delivered'; patch.deliveredAt = new Date().toISOString(); hist = { s: 'delivered', note: 'Delivered to customer' }; msg = 'Marked as delivered'; }
      if (act === 'decline' || act === 'cancel') {
        var reason = prompt((act === 'decline' ? 'Decline' : 'Cancel') + ' this order — reason (shown in history' + (custPhone(o) ? ', and used in the WhatsApp message' : '') + '):', ''); if (reason === null) return;
        var paidCard = (o.method === 'card' || o.payMethod === 'card') && statusOf(o) !== 'pending';
        if (paidCard && !confirm('This customer already PAID by card. Cancelling does not send money back — refund them from your Paystack dashboard. Continue?')) return;
        var n = await restock(o); patch.status = act === 'decline' ? 'declined' : 'cancelled'; patch.cancelReason = reason; patch.stockRestored = true; hist = { s: patch.status, note: (reason || 'No reason given') + (n ? ' · ' + n + ' item(s) returned to stock' : '') }; msg = (act === 'decline' ? 'Order declined' : 'Order cancelled') + (n ? ' · stock restored' : '');
      }
      if (act === 'refund') {
        var amt = prompt('Refund amount (₦). Full amount is ' + money(o.total) + ':', o.total); if (amt === null) return; amt = Number(String(amt).replace(/[^\d.]/g, '')); if (!(amt > 0) || amt > Number(o.total) + 0.01) { toast('⚠️ Enter an amount between 1 and ' + o.total); return; }
        var why = prompt('Reason for refund:', '') || ''; var back = confirm('Return the items to stock?\n\nOK = yes, put them back on the shelf\nCancel = no (damaged / not returned)');
        var n2 = back ? await restock(o) : 0; patch.status = 'refunded'; patch.refund = { amount: amt, reason: why, at: new Date().toISOString(), by: who(), restocked: !!back }; if (back) patch.stockRestored = true;
        hist = { s: 'refunded', note: money(amt) + ' refunded' + (why ? ' — ' + why : '') + (n2 ? ' · ' + n2 + ' returned to stock' : '') + ((o.method === 'card' || o.payMethod === 'card') ? ' (send the money back from Paystack / your terminal)' : '') }; msg = 'Refund recorded';
      }
      await commit(k, patch, hist); toast('✅ ' + msg); renderOrds(orders); if (S.open === k) openOrder(k);
    } catch (e) { toast('❌ ' + e.message); }
  };
  window.orderNote = async function (k) {
    var t = ($('od-note') || {}).value || ''; if (!t.trim()) return; try { await commit(k, {}, { s: 'note', note: t.trim() }); toast('Note added'); openOrder(k); } catch (e) { toast('❌ ' + e.message); }
  };
  window.ordBulk = async function (status) {
    var ks = Object.keys(S.sel).filter(function (k) { return orders[k] && !isPOS(orders[k]); }); if (!ks.length) { toast('Select online orders first'); return; }
    if (!confirm('Mark ' + ks.length + ' order(s) as ' + status + '?')) return; var done = 0;
    for (var i = 0; i < ks.length; i++) { var o = orders[ks[i]], s = statusOf(o); if (s === 'cancelled' || s === 'declined' || s === 'refunded' || s === 'pending') continue; try { var p = { status: status }; p[status + 'At'] = new Date().toISOString(); await commit(ks[i], p, { s: status, note: 'Bulk update' }); done++; } catch (e) {} }
    S.sel = {}; toast('✅ ' + done + ' order(s) updated'); renderOrds(orders);
  };

  /* ── drawer ── */
  function waNum(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('234') === 0) return d; if (d[0] === '0') return '234' + d.slice(1); return d; }
  function waMsg(o) {
    var n = custName(o).split(' ')[0], r = o.ref || '', s = statusOf(o);
    var m = { pending: 'we have received your order ' + r + ' and are waiting for payment confirmation.', paid: 'your payment for order ' + r + ' is confirmed. We are getting it ready.', processing: 'your order ' + r + ' is being prepared.', shipped: 'your order ' + r + ' is on its way' + (o.courier ? ' (' + o.courier + ')' : '') + '.', delivered: 'your order ' + r + ' has been delivered. Thank you for shopping with us!', declined: 'we are sorry, we could not complete order ' + r + (o.cancelReason ? ' (' + o.cancelReason + ')' : '') + '.', cancelled: 'your order ' + r + ' was cancelled' + (o.cancelReason ? ' (' + o.cancelReason + ')' : '') + '.', refunded: 'your refund for order ' + r + ' has been processed.' }[s] || 'an update on order ' + r + '.';
    return 'Hello ' + n + ', ' + m;
  }
  window.openOrder = function (k) {
    var o = orders[k]; if (!o) return; S.open = k; shell(); var s = statusOf(o), d = created(o);
    var hist = (Array.isArray(o.history) && o.history.length ? o.history : [{ s: s, at: d, by: isPOS(o) ? (o.cashier || 'POS') : 'customer', note: 'Order placed' }]).slice().reverse();
    var items = (o.items || []).map(function (i) { return '<div class="od-it">' + (i.image ? '<img src="' + esc(i.image) + '" alt="">' : '<div class="ph">📦</div>') + '<div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(i.name) + (i.size ? ' <span style="color:var(--ink3);font-weight:500">(' + esc(i.size) + ')</span>' : '') + '</div><div style="font-size:11px;color:var(--ink3)">' + qtyOf(i) + ' × ' + money(i.price) + (i.sku ? ' · ' + esc(i.sku) : '') + '</div></div><b>' + money(qtyOf(i) * (Number(i.price) || 0)) + '</b></div>'; }).join('');
    var ph = custPhone(o), em = custEmail(o), acts = actions(o);
    $('od').innerHTML = '<div class="od-hd"><div><div style="font-family:\'DM Mono\',monospace;font-size:13px;font-weight:800">' + esc(o.ref || k) + '</div><div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + badge(s) + '<span style="font-size:11px;color:var(--ink3)">' + (isPOS(o) ? '🏪 POS · ' + esc(o.cashier || '') : '🌐 Online store') + ' · ' + (d ? new Date(d).toLocaleString('en-NG') : '') + '</span></div></div><button class="btn btn-grey btn-sm" onclick="closeOrder()">✕</button></div>'
      + '<div class="od-bd">'
      + (isPOS(o) && !ph && !custAddr(o) ? '' : '<div class="od-sec"><h4>Customer</h4><div class="od-card"><b>' + esc(custName(o)) + '</b>' + (ph ? '<br>📞 ' + esc(ph) : '') + (em ? '<br>✉️ ' + esc(em) : '') + (custAddr(o) ? '<br>📍 ' + esc(custAddr(o)) : '') + '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">' + (ph ? '<a class="abtn ok2" style="text-decoration:none" target="_blank" href="https://wa.me/' + waNum(ph) + '?text=' + encodeURIComponent(waMsg(o)) + '">💬 WhatsApp update</a><a class="abtn gr" style="text-decoration:none" href="tel:' + esc(ph) + '">Call</a>' : '') + (em ? '<a class="abtn gr" style="text-decoration:none" href="mailto:' + esc(em) + '?subject=' + encodeURIComponent('Your order ' + (o.ref || '')) + '&body=' + encodeURIComponent(waMsg(o)) + '">Email</a>' : '') + '</div></div></div>')
      + '<div class="od-sec"><h4>Items</h4><div class="od-card" style="padding:4px 14px">' + (items || '<div style="padding:10px;color:var(--ink3)">No items recorded</div>') + '</div></div>'
      + '<div class="od-sec"><h4>Payment</h4><div class="od-card">' + (o.subtotal && o.subtotal !== o.total ? 'Subtotal: ' + money(o.subtotal) + '<br>' : '') + (o.discount ? 'Discount: −' + money(o.discount) + '<br>' : '') + '<b style="font-size:16px">Total: ' + money(o.total) + '</b><br>Method: ' + esc(payLabel(o)) + (o.terminal ? ' · ' + esc(o.terminal) : '') + (o.bankRef ? '<br>Bank ref: <span style="font-family:\'DM Mono\',monospace;font-size:11px">' + esc(o.bankRef) + '</span>' : '') + (o.approvalCode ? '<br>Approval code: ' + esc(o.approvalCode) : '') + (o.autoConfirmed ? '<br><span style="color:#0a9d6b;font-weight:700">✓ Confirmed automatically by the bank</span>' : '') + (o.refund ? '<br><span style="color:#d6336c;font-weight:700">Refunded ' + money(o.refund.amount) + '</span>' : '') + (o.courier ? '<br>Courier: ' + esc(o.courier) : '') + (o.cancelReason ? '<br>Reason: ' + esc(o.cancelReason) : '') + '</div></div>'
      + '<div class="od-sec"><h4>Timeline</h4><div class="tl">' + hist.map(function (h) { return '<div><b>' + esc((ST[h.s] && ST[h.s].l) || (h.s === 'note' ? 'Note' : h.s || '')) + '</b>' + (h.note ? ' — ' + esc(h.note) : '') + '<small>' + (h.at ? new Date(h.at).toLocaleString('en-NG') : '') + ' · ' + esc(h.by || '') + '</small></div>'; }).join('') + '</div></div>'
      + '<div class="od-sec"><h4>Internal note</h4><div style="display:flex;gap:6px"><input id="od-note" placeholder="Visible to your team only…" style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:12px;font-size:13px"><button class="abtn gr" onclick="orderNote(\'' + k + '\')">Add</button></div></div></div>'
      + '<div class="od-ft">' + acts.map(function (a) { return '<button class="abtn ' + a[2] + '" onclick="orderAct(\'' + k + '\',\'' + a[0] + '\')">' + a[1] + '</button>'; }).join('') + '<button class="abtn gr" style="margin-left:auto" onclick="printOrder(\'' + k + '\')">🖨 Print</button></div>';
    $('od-bg').classList.add('on'); $('od').classList.add('on');
  };
  window.closeOrder = function () { S.open = null; var a = $('od'), b = $('od-bg'); if (a) a.classList.remove('on'); if (b) b.classList.remove('on'); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOrder(); });

  window.printOrder = function (k) {
    var o = orders[k]; if (!o) return; var biz = localStorage.getItem('qc_biz_name') || 'Your Store', w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print'); return; }
    var rows = (o.items || []).map(function (i) { return '<tr><td>' + esc(i.name) + (i.size ? ' (' + esc(i.size) + ')' : '') + '</td><td style="text-align:center">' + qtyOf(i) + '</td><td style="text-align:right">' + money(i.price) + '</td><td style="text-align:right">' + money(qtyOf(i) * i.price) + '</td></tr>'; }).join('');
    w.document.write('<!doctype html><title>Invoice ' + esc(o.ref || k) + '</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:30px auto;color:#14121a;font-size:13px}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{background:#f6f2ec;font-size:11px;text-transform:uppercase}.r{text-align:right}.tot{font-size:16px;font-weight:800}</style><h1>' + esc(biz) + '</h1><div style="color:#666">Invoice / Packing slip</div><hr><div style="display:flex;justify-content:space-between"><div><b>Bill to</b><br>' + esc(custName(o)) + '<br>' + esc(custPhone(o)) + '<br>' + esc(custAddr(o)) + '</div><div class="r"><b>' + esc(o.ref || k) + '</b><br>' + (created(o) ? new Date(created(o)).toLocaleString('en-NG') : '') + '<br>Status: ' + esc((ST[statusOf(o)] || {}).l) + '<br>Payment: ' + esc(payLabel(o)) + '</div></div><table><tr><th>Item</th><th style="text-align:center">Qty</th><th class="r">Price</th><th class="r">Total</th></tr>' + rows + '</table><div class="r">' + (o.discount ? 'Discount: −' + money(o.discount) + '<br>' : '') + '<span class="tot">Total: ' + money(o.total) + '</span></div><script>setTimeout(function(){print()},300)<\/script>'); w.document.close();
  };

  var csv = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  window.exportOrdersCSV = function () {
    var ks = visible(orders); if (!ks.length) { toast('No orders to export'); return; }
    var rows = [['Ref', 'Date', 'Source', 'Status', 'Customer', 'Phone', 'Email', 'Address', 'Items', 'Total', 'Payment', 'Bank ref', 'Courier', 'Refund']].concat(ks.map(function (k) { var o = orders[k]; return [o.ref || k, created(o), isPOS(o) ? 'POS' : 'Online', statusOf(o), custName(o), custPhone(o), custEmail(o), custAddr(o), (o.items || []).map(function (i) { return qtyOf(i) + 'x ' + i.name; }).join('; '), o.total, payLabel(o), o.bankRef || '', o.courier || '', o.refund ? o.refund.amount : '']; }));
    var b = new Blob(['\uFEFF' + rows.map(function (r) { return r.map(csv).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'orders-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); toast('✅ Exported ' + ks.length + ' orders');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell); else shell();
})();
