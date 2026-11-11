/* QuickCart admin — Stock Count upgrade (loaded after admin.html + admin-inventory.js).
   Keeps the existing draft/autosave/history storage, and replaces the start screen, grid, review and apply steps.
   KEY FIX: the old code applied (counted − snapshot) as an increment, so any sale made BEFORE a shelf was counted
   was deducted twice. Each line now carries its own count time; at apply we set
       final stock = counted + (every movement recorded after that line was counted)
   so sales/receipts during a count are never lost or double-counted. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var H = { 'Content-Type': 'application/json' };
  var money = function (n) { return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG'); };
  var sgn = function (n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); };
  var REASONS = [['', 'Unexplained'], ['miscount', 'Miscount / recounted'], ['theft', 'Theft / loss'], ['damaged', 'Damaged'], ['expired', 'Expired'], ['supplier', 'Supplier short/over delivery'], ['unrecorded-sale', 'Unrecorded sale'], ['found', 'Found / misplaced stock'], ['other', 'Other']];
  var TYPES = [['all', 'Full count — everything'], ['category', 'By category'], ['abc', 'High-value items (top 80% of stock value)'], ['low', 'Low & out-of-stock items'], ['stale', 'Not counted in 90 days (cycle count)'], ['sample', 'Random spot-check (10%)'], ['zero', 'Zero / negative stock check']];
  var unit = function (p) { return Number(p && p.cost) || Number(p && p.price) || 0; };

  var css = document.createElement('style');
  css.textContent = '.sc-opts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:100%;margin-top:12px}.sc-opts label{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);display:block;margin-bottom:4px}.sc-opts input,.sc-opts select{width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:10px;font-size:12px;font-family:inherit;background:#fff}'
    + '.rv-k{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}.rv-k div{background:var(--grey1);border-radius:14px;padding:11px 13px}.rv-k b{display:block;font-size:17px;font-weight:800;letter-spacing:-.02em}.rv-k span{font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em}'
    + '#cr-bg{position:fixed;inset:0;background:rgba(20,18,26,.55);backdrop-filter:blur(6px);z-index:9100;display:none;align-items:center;justify-content:center;padding:14px}#cr-bg.on{display:flex}#cr-box{background:#fff;border-radius:22px;width:980px;max-width:100%;max-height:94vh;overflow:auto;box-shadow:0 30px 80px rgba(20,18,26,.3)}'
    + '.cr-hd{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between}.cr-hd h3{margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em}.cr-bd{padding:18px 22px}.cr-ft{padding:14px 22px;border-top:1px solid var(--border);background:#faf7f2;display:flex;gap:8px;flex-wrap:wrap;align-items:center}'
    + '.cr-appr{background:#fff8f0;border:1.5px solid #fde1c8;border-radius:14px;padding:12px 14px;margin-top:12px;font-size:12px}.cr-appr input[type=text]{padding:8px 10px;border:1px solid var(--border);border-radius:9px;font-size:12px;margin-left:6px}'
    + '.sc-tag{font-size:9px;font-weight:800;padding:2px 7px;border-radius:99px;background:rgba(245,158,11,.16);color:#b45309;margin-left:5px}.sc-sel{padding:5px;border:1px solid var(--border);border-radius:8px;font-size:11px;max-width:150px}'
    + '@media(max-width:900px){.sc-opts{grid-template-columns:1fr 1fr}.rv-k{grid-template-columns:1fr 1fr}}';
  document.head.appendChild(css);

  /* ── start screen ── */
  function wireStart() {
    var row = $('sc-start-row'); if (!row || $('sc-type')) return;
    var left = row.firstElementChild, right = row.lastElementChild; right.innerHTML = '<button class="btn btn-orange" onclick="startCountSession()">▶ Start count</button>';
    left.querySelector('p').innerHTML = 'Choose what to count. Staff can scan or type quantities; sales made while you count are handled automatically.';
    row.insertAdjacentHTML('beforeend', '<div class="sc-opts"><div><label>Count name</label><input id="sc-name" placeholder="e.g. Month-end — main shelf"></div><div><label>Count type</label><select id="sc-type" onchange="scTypeChange()">' + TYPES.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select></div><div id="sc-scope-wrap"><label>Category</label><select id="sc-scope"><option value="">All categories</option></select></div><div><label>Approval needed above (₦)</label><input type="number" id="sc-thresh" min="0" value="' + (localStorage.getItem('qc_count_thresh') || 50000) + '"></div>'
      + '<div style="grid-column:1/-1;display:flex;gap:14px;align-items:center;flex-wrap:wrap"><label style="display:flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;font-size:12px;font-weight:600;margin:0"><input type="checkbox" id="sc-blind" style="width:auto"> Blind count (hide system quantity so staff count honestly)</label><button class="btn btn-grey btn-sm" onclick="scPrintSheet(true)">🖨 Print blank count sheet</button><button class="btn btn-grey btn-sm" onclick="scPrintSheet(false)">🖨 Sheet with system qty</button></div></div>');
    // the original start row had scope + blind in the right block; hide the category picker unless needed
    scTypeChange();
    // active-session toolbar: camera + undo + recount filter
    var scan = $('sc-scan'); if (scan && !$('sc-cam')) { scan.insertAdjacentHTML('afterend', '<button class="btn btn-grey btn-sm" id="sc-cam" onclick="scCam()">📷 Camera</button><button class="btn btn-grey btn-sm" onclick="scUndo()">↶ Undo scan</button><button class="btn btn-grey btn-sm" onclick="scPrintSheet(!_cs.blind,true)">🖨 Sheet</button>'); scan.placeholder = '📷 Scan barcode or type SKU/name, press Enter (+1 each)'; }
    var sh = $('sc-show'); if (sh && !Array.from(sh.options).some(function (o) { return o.value === 'recount'; })) sh.add(new Option('Needs recount', 'recount'));
    var hh = document.querySelector('#count-history-tbl'); if (hh) { var th = hh.closest('table').querySelector('thead tr'); if (th) th.innerHTML = '<th>Date</th><th>Name</th><th>Items</th><th>Accuracy</th><th>Variances</th><th>Value</th><th>By / approved</th><th>Status</th><th></th>'; }
  }
  window.scTypeChange = function () { var t = $('sc-type'), w = $('sc-scope-wrap'); if (w && t) { w.style.display = t.value === 'category' ? '' : 'none'; if (t.value === 'category') csFillCats(); } };

  function pickKeys(type, scope) {
    var keys = Object.keys(prods || {}), q = function (k) { return Math.max(0, Number(prods[k].quantity) || 0); };
    if (type === 'category') return keys.filter(function (k) { return !scope || prods[k].category === scope; });
    if (type === 'low') return keys.filter(function (k) { var n = Number(prods[k].quantity) || 0, rp = prods[k].reorderPoint != null && prods[k].reorderPoint !== '' ? Number(prods[k].reorderPoint) : 5; return n <= rp; });
    if (type === 'zero') return keys.filter(function (k) { return (Number(prods[k].quantity) || 0) <= 0; });
    if (type === 'stale') return keys.filter(function (k) { var t = Date.parse(prods[k].lastCountedAt || ''); return !t || Date.now() - t > 90 * 864e5; });
    if (type === 'sample') { var a = keys.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, Math.max(Math.min(20, a.length), Math.ceil(a.length * 0.1))); }
    if (type === 'abc') { var s = keys.map(function (k) { return [k, q(k) * unit(prods[k])]; }).sort(function (a, b) { return b[1] - a[1]; }), tot = s.reduce(function (t, x) { return t + x[1]; }, 0), run = 0, out = []; for (var n = 0; n < s.length; n++) { out.push(s[n][0]); run += s[n][1]; if (tot && run / tot >= 0.8 && out.length >= 10) break; } return out; }
    return keys;
  }

  window.startCountSession = async function () {
    if (!Object.keys(prods || {}).length) { try { await loadProds(); } catch (e) {} }
    var type = $('sc-type').value, scope = type === 'category' ? $('sc-scope').value : '', blind = $('sc-blind').checked, th = Math.max(0, Number($('sc-thresh').value) || 0);
    var keys = pickKeys(type, scope); if (!keys.length) { toast('Nothing to count for that selection'); return; }
    localStorage.setItem('qc_count_thresh', th); var rows = {};
    keys.forEach(function (k) { rows[k] = { sys: Number(prods[k].quantity) || 0, phys: null, note: '', at: 0, reason: '' }; });
    var now = Date.now(); _cs = { id: 'cnt_' + now, date: new Date(now).toISOString(), startedAt: now, name: ($('sc-name').value || '').trim(), type: type, scope: scope, blind: blind, thresh: th, rows: rows, by: csWho() };
    _csFilter = { q: '', cat: '', show: 'all' }; csOpen(); toast('Count started — ' + keys.length + ' items. Scan or type quantities.');
  };
  var _open = window.csOpen;
  window.csOpen = function () { if (_cs) { if (!_cs.startedAt) _cs.startedAt = Date.parse(_cs.date) || Date.now(); if (_cs.thresh == null) _cs.thresh = Number(localStorage.getItem('qc_count_thresh')) || 0; } _open(); var m = $('sc-session-mode'); if (m && _cs) m.textContent = '· ' + (_cs.name ? _cs.name + ' · ' : '') + ((TYPES.filter(function (t) { return t[0] === _cs.type; })[0] || [0, _cs.scope || 'All'])[1]).split(' — ')[0] + (_cs.blind ? ' · Blind' : ''); wireGrid(); csRender(); };
  function wireGrid() { var th = $('count-tbl') && $('count-tbl').closest('table').querySelector('thead tr'); if (th) th.innerHTML = '<th>Product</th><th>SKU / Barcode</th><th id="sc-th-sys"' + (_cs && _cs.blind ? ' style="display:none"' : '') + '>System</th><th>Counted</th><th>Variance</th><th>Value</th><th>Reason</th><th>Note</th>'; }

  /* ── grid ── */
  var rowVar = function (r) { return r.phys === null || r.phys === undefined ? null : r.phys - r.sys; };
  window.csRender = function () {
    if (!_cs) return; wireGrid(); var q = (_csFilter.q || '').toLowerCase(), html = '', shown = 0;
    Object.keys(_cs.rows).forEach(function (k) {
      var p = prods[k] || {}, r = _cs.rows[k], v = rowVar(r);
      if (_csFilter.cat && p.category !== _csFilter.cat) return; if (q && ((p.name || '') + ' ' + (p.sku || '') + ' ' + (p.barcode || '') + ' ' + (p.brand || '')).toLowerCase().indexOf(q) < 0) return;
      if (_csFilter.show === 'uncounted' && r.phys !== null) return; if (_csFilter.show === 'counted' && r.phys === null) return; if (_csFilter.show === 'var' && (v === null || v === 0)) return; if (_csFilter.show === 'recount' && !r.recount) return;
      if (++shown > 400) return;
      var vc = v === null ? 'var(--ink3)' : v === 0 ? 'var(--green)' : v > 0 ? '#171717' : 'var(--red)';
      html += '<tr data-k="' + esc(k) + '"><td><strong style="font-size:12px">' + esc(p.name || '—') + '</strong>' + (r.recount ? '<span class="sc-tag">RECOUNT' + (r.first != null ? ' · 1st: ' + r.first : '') + '</span>' : '') + '<div style="font-size:10px;color:var(--ink3)">' + esc(p.category || '') + '</div></td><td style="font-size:10px;color:var(--ink3);font-family:\'DM Mono\',monospace">' + esc(p.sku || '') + '<br>' + esc(p.barcode || '') + '</td>'
        + (_cs.blind ? '' : '<td style="font-weight:700">' + r.sys + '</td>') + '<td><input type="number" min="0" class="sc-in" value="' + (r.phys === null || r.phys === undefined ? '' : r.phys) + '" placeholder="—" onfocus="this.select()" oninput="csInput(this)" style="width:80px;border:1px solid var(--border);border-radius:8px;padding:6px;font-size:13px;text-align:center;font-weight:700;outline:none"></td>'
        + '<td class="sc-v" style="font-weight:800;color:' + vc + '">' + (v === null ? '—' : sgn(v)) + '</td><td class="sc-vv" style="font-size:11px;color:' + vc + '">' + (v ? money(Math.abs(v) * unit(p)) : '') + '</td>'
        + '<td>' + (v ? '<select class="sc-sel" onchange="scReason(this)">' + REASONS.map(function (x) { return '<option value="' + x[0] + '"' + (r.reason === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' : '') + '</td>'
        + '<td><input type="text" class="sc-nt" value="' + esc(r.note) + '" placeholder="note" oninput="csNote(this)" style="width:120px;border:1px solid var(--border);border-radius:8px;padding:6px;font-size:11px;outline:none"></td></tr>';
    });
    $('count-tbl').innerHTML = html || '<tr class="empty-row"><td colspan="8">Nothing matches this filter</td></tr>'; csStats();
  };
  window.csInput = function (el) {
    var k = csRowOf(el); if (!k || !_cs) return; var r = _cs.rows[k]; r.phys = el.value === '' ? null : Math.max(0, Math.floor(Number(el.value) || 0)); r.at = r.phys === null ? 0 : Date.now();
    var v = rowVar(r), tr = el.closest('tr'), prev = !!tr.querySelector('.sc-sel'); tr.querySelector('.sc-v').textContent = v === null ? '—' : sgn(v);
    var vc = v === null ? 'var(--ink3)' : v === 0 ? 'var(--green)' : v > 0 ? '#171717' : 'var(--red)'; tr.querySelector('.sc-v').style.color = vc; var vv = tr.querySelector('.sc-vv'); vv.textContent = v ? money(Math.abs(v) * unit(prods[k])) : ''; vv.style.color = vc;
    if (!!v !== prev) { var cells = tr.children; cells[6].innerHTML = v ? '<select class="sc-sel" onchange="scReason(this)">' + REASONS.map(function (x) { return '<option value="' + x[0] + '"' + (r.reason === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' : ''; }
    csStats(); csAutosave();
  };
  window.scReason = function (el) { var k = csRowOf(el); if (k && _cs) { _cs.rows[k].reason = el.value; csAutosave(); } };
  var scans = [];
  function codeHit(v) {
    v = String(v || '').trim().toLowerCase(); if (!v || !_cs) return null; var keys = Object.keys(_cs.rows);
    var ex = keys.filter(function (k) { var p = prods[k] || {}; return String(p.barcode || '').toLowerCase() === v || String(p.sku || '').toLowerCase() === v; }); if (ex.length) return ex;
    var nm = keys.filter(function (k) { return String((prods[k] || {}).name || '').toLowerCase() === v; }); if (nm.length) return nm;
    return keys.filter(function (k) { return String((prods[k] || {}).name || '').toLowerCase().indexOf(v) > -1; });
  }
  function bump(k) { var r = _cs.rows[k]; scans.push({ k: k, prev: r.phys, prevAt: r.at }); if (scans.length > 80) scans.shift(); r.phys = (r.phys === null || r.phys === undefined ? 0 : r.phys) + 1; r.at = Date.now(); }
  window.csQuick = function (v) {
    if (!_cs) return; var hit = codeHit(v); if (!hit || !hit.length) { toast('❌ No product in this count matches "' + String(v).trim() + '"'); return false; }
    if (hit.length > 1) { _csFilter.q = String(v).trim(); $('sc-search').value = _csFilter.q; csRender(); toast(hit.length + ' matches — type the count on the right row'); return false; }
    bump(hit[0]); if (_csFilter.q || _csFilter.show !== 'all' || _csFilter.cat) { _csFilter = { q: '', cat: '', show: 'all' }; $('sc-search').value = ''; $('sc-cat').value = ''; $('sc-show').value = 'all'; }
    csRender(); var tr = document.querySelector('#count-tbl tr[data-k="' + hit[0].replace(/"/g, '\\"') + '"]'); if (tr) { tr.style.background = '#fff3e0'; tr.scrollIntoView({ block: 'center' }); setTimeout(function () { tr.style.background = ''; }, 900); }
    toast('✓ ' + (prods[hit[0]].name || '') + ' → ' + _cs.rows[hit[0]].phys); csStats(); csAutosave(); return true;
  };
  window.scUndo = function () { var s = scans.pop(); if (!s || !_cs || !_cs.rows[s.k]) { toast('Nothing to undo'); return; } _cs.rows[s.k].phys = s.prev; _cs.rows[s.k].at = s.prevAt || 0; csRender(); csAutosave(); toast('↶ Undid last scan'); };
  window.csAcceptRest = function () { if (!_cs) return; var n = 0, t = Date.now(); Object.keys(_cs.rows).forEach(function (k) { var r = _cs.rows[k]; if (r.phys === null || r.phys === undefined) { r.phys = r.sys; r.at = t; n++; } }); csRender(); csAutosave(); toast('Accepted ' + n + ' uncounted items as matching'); };
  window.csTotals = function () { var t = { total: 0, counted: 0, variances: 0, over: 0, short: 0, value: 0 }; Object.keys(_cs.rows).forEach(function (k) { var r = _cs.rows[k]; t.total++; if (r.phys === null || r.phys === undefined) return; t.counted++; var d = r.phys - r.sys; if (d) { t.variances++; if (d > 0) t.over += d; else t.short += -d; t.value += d * unit(prods[k]); } }); return t; };

  /* camera */
  var CAM = {};
  window.scCam = async function () {
    var m = $('sc-cam-m'); if (!m) { m = document.createElement('div'); m.id = 'sc-cam-m'; m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px'; document.body.appendChild(m); }
    m.innerHTML = '<video id="sc-cam-v" playsinline muted style="width:min(480px,92vw);border-radius:16px;background:#000"></video><div id="sc-cam-t" style="color:#fff;font-size:13px;text-align:center">Starting camera…</div><button onclick="scCamClose()" style="padding:10px 24px;border-radius:99px;border:none;font-weight:800">Done</button>'; m.style.display = 'flex';
    try {
      CAM.s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }); var v = $('sc-cam-v'); v.srcObject = CAM.s; await v.play(); var last = '', lastAt = 0;
      var hit = function (c) { var n = Date.now(); if (c === last && n - lastAt < 1800) return; last = c; lastAt = n; var ok = csQuick(c); var t = $('sc-cam-t'); if (t) t.textContent = (ok ? '✓ ' : '✗ ') + c + (ok ? ' → ' + (_cs.rows[codeHit(c)[0]] || {}).phys : ''); };
      if ('BarcodeDetector' in window) { var d = new BarcodeDetector(); CAM.t = setInterval(async function () { try { var r = await d.detect(v); if (r[0]) hit(r[0].rawValue); } catch (e) {} }, 220); $('sc-cam-t').textContent = 'Scan each item — every scan adds 1'; }
      else { await new Promise(function (res, rej) { if (window.ZXing) return res(); var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); var rd = new ZXing.BrowserMultiFormatReader(); CAM.z = rd; CAM.t = setInterval(async function () { try { var r = await rd.decodeFromVideoElement(v); if (r) hit(r.getText()); } catch (e) {} }, 300); $('sc-cam-t').textContent = 'Scan each item — every scan adds 1'; }
    } catch (e) { $('sc-cam-t').textContent = 'Camera unavailable: ' + (e.message || e.name) + '. A USB scanner works in the scan box.'; }
  };
  window.scCamClose = function () { clearInterval(CAM.t); if (CAM.z) { try { CAM.z.reset(); } catch (e) {} CAM.z = null; } if (CAM.s) { CAM.s.getTracks().forEach(function (t) { t.stop(); }); CAM.s = null; } var m = $('sc-cam-m'); if (m) m.style.display = 'none'; };

  /* count sheet */
  window.scPrintSheet = function (blind, fromSession) {
    var keys, title;
    if (fromSession && _cs) { keys = Object.keys(_cs.rows); title = _cs.name || 'Stock count'; } else { var t = ($('sc-type') || {}).value || 'all'; keys = pickKeys(t, ($('sc-scope') || {}).value); title = (($('sc-name') || {}).value || 'Stock count sheet'); }
    if (!keys.length) { toast('Nothing to print'); return; }
    var by = {}; keys.forEach(function (k) { (by[prods[k].category || 'Uncategorised'] = by[prods[k].category || 'Uncategorised'] || []).push(k); });
    var w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print'); return; }
    w.document.write('<!doctype html><title>' + esc(title) + '</title><style>body{font-family:Arial,sans-serif;margin:18px;font-size:12px}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:6px 0 16px}td,th{border:1px solid #999;padding:6px 7px;text-align:left}th{background:#eee;font-size:10px;text-transform:uppercase}.box{width:90px}h3{margin:14px 0 2px;font-size:13px;background:#14121a;color:#fff;padding:5px 8px}.sig{margin-top:26px;display:flex;gap:40px}.sig div{border-top:1px solid #000;padding-top:4px;width:200px}</style><h2>' + esc(title) + '</h2><div>' + new Date().toLocaleDateString('en-NG', { dateStyle: 'long' }) + ' · ' + keys.length + ' items · ' + (blind ? 'Blind sheet' : 'With system quantities') + '</div>'
      + Object.keys(by).sort().map(function (c) { return '<h3>' + esc(c) + '</h3><table><tr><th>Product</th><th>SKU / Barcode</th>' + (blind ? '' : '<th>System</th>') + '<th class="box">Counted</th><th>Recount</th><th>Note</th></tr>' + by[c].sort(function (a, b) { return (prods[a].name || '').localeCompare(prods[b].name || ''); }).map(function (k) { var p = prods[k]; return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.sku || p.barcode || '') + '</td>' + (blind ? '' : '<td>' + (fromSession && _cs ? _cs.rows[k].sys : (Number(p.quantity) || 0)) + '</td>') + '<td></td><td></td><td></td></tr>'; }).join('') + '</table>'; }).join('')
      + '<div class="sig"><div>Counted by</div><div>Checked by</div><div>Date</div></div><script>setTimeout(function(){print()},400)<\/script>'); w.document.close();
  };

  /* ── review & apply ── */
  function movementsFor() { var I = window.INV || {}; return (I.saleRows || []).concat(I.ledger || []); }
  function analyse(mv) {
    var by = {}; mv.forEach(function (m) { if (m.productKey) (by[m.productKey] = by[m.productKey] || []).push(m); });
    var lines = [], t = { counted: 0, uncounted: 0, ok: 0, over: 0, short: 0, overV: 0, shortV: 0, adj: 0 };
    Object.keys(_cs.rows).forEach(function (k) {
      var r = _cs.rows[k], p = prods[k] || {}; if (r.phys === null || r.phys === undefined) { t.uncounted++; return; } t.counted++;
      var at = r.at || _cs.startedAt, ms = (by[k] || []).filter(function (m) { return m.ref !== _cs.id; });
      var between = ms.filter(function (m) { return m.at > _cs.startedAt && m.at <= at; }).reduce(function (s, m) { return s + (Number(m.change) || 0); }, 0);
      var after = ms.filter(function (m) { return m.at > at; }).reduce(function (s, m) { return s + (Number(m.change) || 0); }, 0);
      var expected = r.sys + between, variance = r.phys - expected, value = variance * unit(p);
      if (between) t.adj++;
      if (variance === 0) t.ok++; else if (variance > 0) { t.over += variance; t.overV += value; } else { t.short += -variance; t.shortV += -value; }
      lines.push({ key: k, name: p.name || '', sku: p.sku || p.barcode || '', sys: r.sys, expected: expected, phys: r.phys, diff: variance, value: value, soldDuring: between, after: after, reason: r.reason || '', note: r.note || '', recount: !!r.recount, at: at });
    });
    t.net = t.overV - t.shortV; t.accuracy = t.counted ? Math.round(t.ok / t.counted * 1000) / 10 : 100; return { lines: lines, t: t };
  }
  window.finalizeCount = async function () {
    if (!_cs) { toast('No active session'); return; } var t0 = csTotals(); if (!t0.counted) { toast('Count at least one item first'); return; }
    var bg = $('cr-bg'); if (!bg) { bg = document.createElement('div'); bg.id = 'cr-bg'; bg.innerHTML = '<div id="cr-box"></div>'; document.body.appendChild(bg); }
    $('cr-box').innerHTML = '<div class="cr-bd" style="padding:40px;text-align:center;color:var(--ink3)">Checking sales made while you were counting…</div>'; bg.classList.add('on');
    try { if (window.loadSalesForStock) await window.loadSalesForStock(true); } catch (e) {}
    renderReview();
  };
  var RV = null;
  function renderReview() {
    RV = analyse(movementsFor()); var t = RV.t, vl = RV.lines.filter(function (l) { return l.diff !== 0; }).sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    var big = vl.some(function (l) { return Math.abs(l.value) >= _cs.thresh; }), needApproval = _cs.thresh > 0 && (Math.abs(t.net) >= _cs.thresh || big);
    $('cr-box').innerHTML = '<div class="cr-hd"><div><h3>Review count — ' + esc(_cs.name || 'Stock count') + '</h3><div style="font-size:12px;color:var(--ink3);margin-top:3px">Nothing changes in your stock until you press Apply.' + (t.adj ? ' <b>' + t.adj + '</b> line(s) had sales/receipts while counting — already accounted for.' : '') + '</div></div><button class="btn btn-grey btn-sm" onclick="crClose()">✕</button></div><div class="cr-bd">'
      + '<div class="rv-k"><div><b>' + t.counted + '</b><span>Counted (' + t.uncounted + ' not)</span></div><div><b style="color:' + (t.accuracy >= 98 ? '#0a9d6b' : t.accuracy >= 90 ? '#b45309' : '#d6336c') + '">' + t.accuracy + '%</b><span>Accuracy (lines matching)</span></div><div><b style="color:#d6336c">−' + t.short + ' · ' + money(t.shortV) + '</b><span>Shortage</span></div><div><b style="color:#171717">+' + t.over + ' · ' + money(t.overV) + '</b><span>Overage</span></div><div><b style="color:' + (t.net < 0 ? '#d6336c' : '#0a9d6b') + '">' + (t.net < 0 ? '−' : '+') + money(Math.abs(t.net)) + '</b><span>Net value impact</span></div></div>'
      + (vl.length ? '<div style="overflow-x:auto"><table><thead><tr><th>Product</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Value</th><th>Reason</th><th></th></tr></thead><tbody>' + vl.map(function (l) { return '<tr><td style="font-size:12px"><b>' + esc(l.name) + '</b>' + (l.soldDuring ? '<div style="font-size:10px;color:var(--ink3)">sys ' + l.sys + ' · ' + sgn(l.soldDuring) + ' moved during count</div>' : '') + (Math.abs(l.value) >= _cs.thresh && _cs.thresh ? '<span class="sc-tag">HIGH VALUE</span>' : '') + '</td><td>' + l.expected + '</td><td style="font-weight:700">' + l.phys + '</td><td style="font-weight:800;color:' + (l.diff < 0 ? '#d6336c' : '#171717') + '">' + sgn(l.diff) + '</td><td style="font-size:11px">' + money(Math.abs(l.value)) + '</td><td><select class="sc-sel" onchange="crReason(\'' + l.key + '\',this.value)">' + REASONS.map(function (x) { return '<option value="' + x[0] + '"' + (l.reason === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></td><td><button class="btn btn-grey btn-sm" onclick="crRecount(\'' + l.key + '\')">Recount</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div style="padding:26px;text-align:center"><div style="font-size:38px">🎯</div><b>Every counted item matches. No adjustments needed.</b></div>')
      + (needApproval ? '<div class="cr-appr"><b>⚠ Approval required</b> — variance is above your ₦' + Number(_cs.thresh).toLocaleString() + ' limit.<br><label style="display:inline-flex;align-items:center;gap:6px;margin-top:8px"><input type="checkbox" id="cr-ok"> I have reviewed these variances and approve the adjustments.</label> <input type="text" id="cr-who" placeholder="Approver name" value="' + esc(csWho()) + '"></div>' : '')
      + '</div><div class="cr-ft"><button class="btn btn-grey" onclick="crClose()">← Back to counting</button>' + (vl.length ? '<button class="btn btn-grey" onclick="crRecountAll()">Recount all high-value variances</button>' : '') + '<span style="margin-left:auto"></span><button class="btn btn-orange" onclick="crApply(' + (needApproval ? 'true' : 'false') + ')">✅ Apply ' + vl.length + ' adjustment' + (vl.length === 1 ? '' : 's') + ' &amp; finish</button></div>';
  }
  window.crClose = function () { var b = $('cr-bg'); if (b) b.classList.remove('on'); };
  window.crReason = function (k, v) { if (_cs && _cs.rows[k]) { _cs.rows[k].reason = v; csAutosave(); } };
  window.crRecount = function (k) { var r = _cs.rows[k]; r.first = r.phys; r.phys = null; r.at = 0; r.recount = true; csRender(); csAutosave(); crClose(); $('sc-show').value = 'recount'; _csFilter.show = 'recount'; csRender(); toast('Sent back for recount — enter the new count'); };
  window.crRecountAll = function () { var n = 0; RV.lines.forEach(function (l) { if (l.diff && Math.abs(l.value) >= (_cs.thresh || 1)) { var r = _cs.rows[l.key]; r.first = r.phys; r.phys = null; r.at = 0; r.recount = true; n++; } }); if (!n) { toast('No high-value variances'); return; } crClose(); _csFilter.show = 'recount'; $('sc-show').value = 'recount'; csRender(); csAutosave(); toast(n + ' item(s) sent for recount'); };

  window.crApply = async function (needApproval) {
    var approver = ''; if (needApproval) { if (!$('cr-ok').checked || !($('cr-who').value || '').trim()) { toast('⚠️ Tick the approval box and enter the approver’s name'); return; } approver = $('cr-who').value.trim(); }
    var btn = document.querySelector('#cr-box .cr-ft .btn-orange'); if (btn) { btn.disabled = true; btn.textContent = 'Applying…'; }
    try { if (window.loadSalesForStock) await window.loadSalesForStock(true); } catch (e) {} // pick up any sale made since the review opened
    RV = analyse(movementsFor()); var sbase = getSettingsDB(), base = getDB(), ts = Date.now(), fail = 0, applied = 0, i = 0, stamp = {}, nowIso = new Date().toISOString();
    for (; i < RV.lines.length; i++) {
      var l = RV.lines[i]; stamp[l.key + '/lastCountedAt'] = nowIso; stamp[l.key + '/lastCountQty'] = l.phys;
      try {
        var live = Number(await (await fetch(base + '/' + encodeURIComponent(l.key) + '/quantity.json')).json()) || 0, truth = Math.max(0, l.phys + l.after), delta = truth - live; if (delta === 0) continue;
        var u = await fetch(base + '/' + encodeURIComponent(l.key) + '/quantity.json', { method: 'PUT', headers: H, body: JSON.stringify({ '.sv': { increment: delta } }) }); if (!u.ok) throw new Error('refused');
        var q = Number(await (await fetch(base + '/' + encodeURIComponent(l.key) + '/quantity.json')).json()) || 0, pr = prods[l.key] || {};
        if (typeof pr.inStock === 'boolean' || pr.inStock === undefined) fetch(base + '/' + encodeURIComponent(l.key) + '/inStock.json', { method: 'PUT', headers: H, body: JSON.stringify(q > 0) }).catch(function () {});
        if (prods[l.key]) prods[l.key].quantity = q; applied++;
        var entry = { type: 'count', ref: _cs.id, productKey: l.key, product: l.name, before: live, after: q, change: delta, reason: l.reason, note: l.note, countedQty: l.phys, expected: l.expected, by: csWho(), at: new Date().toISOString() };
        if (window.invLog) await window.invLog(entry); else fetch(sbase + '/stock_movements/' + ts + '_' + i + '.json', { method: 'PUT', headers: H, body: JSON.stringify(entry) }).catch(function () {});
      } catch (e) { fail++; }
    }
    try { var keys = Object.keys(stamp), CH = 300; for (var c = 0; c < keys.length; c += CH) { var chunk = {}; keys.slice(c, c + CH).forEach(function (k) { chunk[k] = stamp[k]; }); await fetch(base + '.json', { method: 'PATCH', headers: H, body: JSON.stringify(chunk) }); } } catch (e) {}
    var t = RV.t, lines = RV.lines.filter(function (l) { return l.diff !== 0 || l.note || l.reason; }).map(function (l) { return { key: l.key, name: l.name, sku: l.sku, sys: l.expected, phys: l.phys, diff: l.diff, value: l.value, note: l.note, reason: l.reason, recount: l.recount }; });
    var hist = { id: _cs.id, name: _cs.name || '', type: _cs.type || 'all', date: _cs.date, finishedAt: new Date().toISOString(), scope: _cs.scope || '', blind: !!_cs.blind, items: t.counted, totalItems: Object.keys(_cs.rows).length, variances: lines.filter(function (l) { return l.diff; }).length, over: t.over, short: t.short, value: t.net, accuracy: t.accuracy, approvedBy: approver, updatedBy: csWho(), status: fail ? 'partial' : 'completed', lines: lines };
    try { await fetch(sbase + '/count_history/' + ts + '.json', { method: 'PUT', headers: H, body: JSON.stringify(hist) }); } catch (e) {}
    try { await fetch(sbase + '/count_draft.json', { method: 'DELETE' }); } catch (e) {}
    clearTimeout(_csDraftTimer); scans = []; crClose(); csClose(fail ? 'Partial' : 'Completed'); try { await loadProds(); } catch (e) {} if (window.loadSalesForStock) window.loadSalesForStock(true); loadCountHistory();
    toast(fail ? '⚠️ Finished with ' + fail + ' failed update(s) — review in history' : '✅ Count complete — ' + applied + ' stock adjustment' + (applied === 1 ? '' : 's') + ' applied · accuracy ' + t.accuracy + '%');
  };

  /* ── history ── */
  window.loadCountHistory = async function () {
    csFillCats(); csCheckDraft(); wireStart();
    try {
      var d = await (await fetch(getSettingsDB() + '/count_history.json')).json(); if (!d) return; _csHist = d;
      var entries = Object.keys(d).map(function (id) { return Object.assign({ _id: id }, d[id]); }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      $('sc-last').textContent = new Date(entries[0].date).toLocaleDateString('en-NG');
      $('count-history-tbl').innerHTML = entries.slice(0, 30).map(function (e) {
        var ok = e.status === 'completed', acc = e.accuracy != null ? e.accuracy + '%' : '—', ac = e.accuracy == null ? 'inherit' : e.accuracy >= 98 ? '#0a9d6b' : e.accuracy >= 90 ? '#b45309' : '#d6336c';
        return '<tr><td>' + new Date(e.date).toLocaleDateString('en-NG') + '</td><td style="font-size:12px">' + esc(e.name || e.scope || 'Full count') + '</td><td>' + (e.items || 0) + '</td><td style="font-weight:800;color:' + ac + '">' + acc + '</td><td style="color:' + (e.variances > 0 ? 'var(--red)' : 'var(--green)') + '">' + (e.variances || 0) + '</td><td>' + (e.value ? ((e.value < 0 ? '−' : '+') + money(Math.abs(e.value))) : '—') + '</td><td style="font-size:11px">' + esc(e.updatedBy || '—') + (e.approvedBy ? '<br><span style="color:#0a9d6b">✓ ' + esc(e.approvedBy) + '</span>' : '') + '</td><td><span class="bdg" style="background:var(--grey1);color:' + (ok ? 'var(--green)' : 'var(--red)') + '">' + esc(e.status || '') + '</span></td><td>' + (e.lines ? '<button class="btn btn-grey btn-sm" onclick="csShowHist(\'' + e._id + '\')">View</button>' : '') + '</td></tr>';
      }).join('');
    } catch (e) {}
  };
  window.csShowHist = function (id) {
    var e = _csHist[id]; if (!e) return; var box = $('sc-detail'), rl = function (v) { var x = REASONS.filter(function (r) { return r[0] === v; })[0]; return x ? x[1] : v || ''; };
    box.style.display = 'block';
    box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px"><strong style="font-size:13px">' + esc(e.name || 'Count') + ' — ' + new Date(e.date).toLocaleString('en-NG') + ' · ' + esc(e.scope || 'All categories') + (e.blind ? ' (blind)' : '') + (e.accuracy != null ? ' · accuracy ' + e.accuracy + '%' : '') + (e.approvedBy ? ' · approved by ' + esc(e.approvedBy) : '') + '</strong><span><button class="btn btn-grey btn-sm" onclick="csHistCSV(\'' + id + '\')">⬇ CSV</button> <button class="btn btn-grey btn-sm" onclick="document.getElementById(\'sc-detail\').style.display=\'none\'">Close</button></span></div>'
      + '<div style="overflow-x:auto"><table><thead><tr><th>Product</th><th>SKU</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Value</th><th>Reason</th><th>Note</th></tr></thead><tbody>' + ((e.lines || []).map(function (l) { return '<tr><td>' + esc(l.name) + (l.recount ? ' <span class="sc-tag">recounted</span>' : '') + '</td><td>' + esc(l.sku) + '</td><td>' + l.sys + '</td><td>' + l.phys + '</td><td style="font-weight:700;color:' + (l.diff < 0 ? 'var(--red)' : l.diff > 0 ? '#171717' : 'var(--green)') + '">' + (l.diff > 0 ? '+' : '') + l.diff + '</td><td>' + money(l.value) + '</td><td style="font-size:11px">' + esc(rl(l.reason)) + '</td><td>' + esc(l.note) + '</td></tr>'; }).join('') || '<tr class="empty-row"><td colspan="8">No variances — stock matched perfectly ✓</td></tr>') + '</tbody></table></div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  window.csHistCSV = function (id) { var e = _csHist[id]; if (!e) return; var rows = [['Product', 'SKU', 'Expected', 'Counted', 'Variance', 'Value', 'Reason', 'Note']]; (e.lines || []).forEach(function (l) { rows.push([l.name, l.sku, l.sys, l.phys, l.diff, l.value, l.reason || '', l.note]); }); csDownload('count-' + id + '.csv', csCSV(rows)); };
  window.exportCountCSV = function () { if (!_cs) return; var rows = [['Product', 'SKU', 'Barcode', 'Category', 'System', 'Counted', 'Variance', 'Value', 'Reason', 'Note']]; Object.keys(_cs.rows).forEach(function (k) { var p = prods[k] || {}, r = _cs.rows[k], d = rowVar(r); rows.push([p.name, p.sku || '', p.barcode || '', p.category || '', r.sys, r.phys === null || r.phys === undefined ? '' : r.phys, d === null ? '' : d, d === null ? '' : d * unit(p), r.reason || '', r.note]); }); csDownload('stock-count-' + Date.now() + '.csv', csCSV(rows)); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireStart); else wireStart();
})();
