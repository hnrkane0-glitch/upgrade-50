/* QuickCart admin — Products page upgrade (loaded after admin.html's own script; overrides its product functions).
   Fixes: images/barcode/SKU/cost/description/unit/VAT/reorder were never saved.
   Adds: image compression, barcode generate/scan/preview/labels, smart import wizard, richer list. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var NS = function () { return getUserNS(); };
  var money = function (n) { return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG'); };
  var H = { 'Content-Type': 'application/json' };
  function lazy(src, test) { return new Promise(function (res, rej) { if (test()) return res(); var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src.split('/').pop() + ' — check your internet')); }; document.head.appendChild(s); }); }
  var loadBarcodeLib = function () { return lazy('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js', function () { return window.JsBarcode; }); };
  var loadSheetJS = function () { return lazy('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', function () { return window.XLSX; }); };

  var css = document.createElement('style');
  css.textContent = '.pimg-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:6px}.pimg{aspect-ratio:1;border:1px solid var(--border);border-radius:12px;overflow:hidden;position:relative;background:var(--grey1)}.pimg img{width:100%;height:100%;object-fit:cover}.pimg .x{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.72);color:#fff;border:none;width:22px;height:22px;border-radius:50%;font-size:13px;cursor:pointer;line-height:1}.pimg .main{position:absolute;left:4px;bottom:4px;background:var(--accent);color:#fff;font-size:9px;font-weight:800;padding:2px 7px;border-radius:99px}.pimg .mk{position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.6);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px;border:none;cursor:pointer}'
    + '.bc-row{display:flex;gap:6px}.bc-row input{flex:1}.bc-row button{white-space:nowrap}#bc-prev{margin-top:6px;max-height:70px}'
    + '.stk{font-size:10px;font-weight:800;padding:3px 9px;border-radius:99px;display:inline-block}.stk.ok{background:rgba(10,157,107,.12);color:#0a9d6b}.stk.low{background:rgba(245,158,11,.16);color:#b45309}.stk.out{background:rgba(214,51,108,.12);color:#d6336c}.stk.na{background:var(--grey1);color:var(--ink3)}'
    + '.pf-bar{display:flex;gap:8px;flex-wrap:wrap;padding:0 16px 12px}.pf-bar select,.pf-bar input{padding:8px 11px;border:1px solid var(--border);border-radius:10px;font-size:12px;background:#fff}'
    + '.pg-bar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;font-size:12px;color:var(--ink3)}'
    + '#imp-bg{position:fixed;inset:0;background:rgba(20,18,26,.55);backdrop-filter:blur(6px);z-index:9000;display:none;align-items:center;justify-content:center;padding:14px}#imp-bg.on{display:flex}'
    + '#imp-box{background:#fff;border-radius:22px;width:860px;max-width:100%;max-height:94vh;overflow:auto;box-shadow:0 30px 80px rgba(20,18,26,.3)}'
    + '.imp-hd{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}.imp-hd h3{font-size:18px;font-weight:800;letter-spacing:-.02em;margin:0}.imp-bd{padding:20px 22px}'
    + '.drop{border:2px dashed var(--border);border-radius:18px;padding:34px 20px;text-align:center;cursor:pointer;transition:.2s;background:var(--grey1)}.drop:hover,.drop.over{border-color:var(--accent);background:rgba(23,23,23,.05)}.drop b{display:block;font-size:15px;margin:6px 0 4px}.drop small{color:var(--ink3);font-size:12px}'
    + '.fmt-badge{display:inline-block;background:rgba(10,157,107,.12);color:#0a9d6b;font-weight:800;font-size:11px;padding:4px 12px;border-radius:99px}'
    + '.map-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.map-grid label{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);display:block;margin-bottom:4px}.map-grid select{width:100%;padding:8px;border:1px solid var(--border);border-radius:10px;font-size:12px}.map-grid .auto select{border-color:rgba(10,157,107,.5);background:rgba(10,157,107,.05)}'
    + '.imp-tbl{width:100%;border-collapse:collapse;font-size:11px}.imp-tbl th,.imp-tbl td{padding:7px 9px;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}.imp-tbl th{background:var(--grey1);font-size:10px;text-transform:uppercase;letter-spacing:.05em}'
    + '.imp-issues{max-height:110px;overflow:auto;font-size:11px;background:#fff8f0;border:1px solid #fde1c8;border-radius:12px;padding:10px 12px;margin:10px 0;line-height:1.7}'
    + '.imp-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.imp-opts select,.imp-opts input{width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:10px;font-size:12px}.imp-opts label{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);display:block;margin-bottom:4px}'
    + '@media(max-width:700px){.pimg-grid{grid-template-columns:repeat(3,1fr)}.map-grid,.imp-opts{grid-template-columns:1fr 1fr}}';
  document.head.appendChild(css);

  /* ══════════ IMAGES ══════════ */
  var IMG = []; // ordered list of data-URLs / http URLs, first = main
  function compress(file, maxW, q) {
    return new Promise(function (res, rej) {
      var rd = new FileReader();
      rd.onerror = function () { rej(new Error('Could not read image')); };
      rd.onload = function (e) { var im = new Image(); im.onerror = function () { rej(new Error('Not a valid image: ' + file.name)); }; im.onload = function () { res(scale(im, maxW, q)); }; im.src = e.target.result; };
      rd.readAsDataURL(file);
    });
  }
  function scale(im, maxW, q) {
    var r = Math.min(1, maxW / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * r)), h = Math.max(1, Math.round(im.height * r)), c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h); return c.toDataURL('image/jpeg', q);
  }
  function thumbOf(src, maxW, q) { return new Promise(function (res) { if (!/^data:/.test(src)) return res(src); var im = new Image(); im.onload = function () { res(scale(im, maxW, q)); }; im.onerror = function () { res(src); }; im.src = src; }); }
  function renderImgs() {
    var g = $('img-preview-grid'); if (!g) return; g.className = 'pimg-grid';
    g.innerHTML = IMG.map(function (u, i) { return '<div class="pimg"><img src="' + esc(u) + '" alt="">' + '<button class="x" onclick="removeProductImage(' + i + ')">×</button>' + (i === 0 ? '<span class="main">MAIN</span>' : '<button class="mk" onclick="makeMainImage(' + i + ')">Make main</button>') + '</div>'; }).join('')
      + (IMG.length < 5 ? '<div id="img-upload-btn" onclick="document.getElementById(\'f-img-file\').click()" style="aspect-ratio:1;border:2px dashed var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:var(--grey1);flex-direction:column;gap:4px"><span style="font-size:24px">📷</span><span style="font-size:10px;font-weight:600;color:var(--ink3)">Add image</span></div>' : '');
  }
  window.handleProductImages = async function (input) {
    var files = Array.from(input.files || []).slice(0, 5 - IMG.length); input.value = '';
    for (var i = 0; i < files.length; i++) { try { IMG.push(await compress(files[i], 900, 0.82)); } catch (e) { toast('⚠️ ' + e.message); } }
    var u = $('f-img'); if (u) u.value = ''; renderImgs();
  };
  window.removeProductImage = function (i) { IMG.splice(i, 1); renderImgs(); };
  window.makeMainImage = function (i) { var x = IMG.splice(i, 1)[0]; IMG.unshift(x); renderImgs(); };

  /* ══════════ BARCODE ══════════ */
  function ean13(prefix) { var d = (prefix || '200') + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'); d = d.slice(0, 12); var s = 0; for (var i = 0; i < 12; i++) s += Number(d[i]) * (i % 2 ? 3 : 1); return d + ((10 - s % 10) % 10); }
  function taken(code, selfKey) { code = String(code || '').trim(); return code && Object.keys(prods).some(function (k) { return k !== selfKey && String(prods[k].barcode || '').trim() === code; }); }
  window.genBarcode = function () { var self = $('f-eid').value, c, n = 0; do { c = ean13('200'); n++; } while (taken(c, self) && n < 50); $('f-barcode').value = c; previewBarcode(); toast('Barcode generated — print the label from the list'); };
  window.previewBarcode = async function () {
    var v = ($('f-barcode').value || '').trim(), svg = $('bc-prev'); if (!svg) return; if (!v) { svg.innerHTML = ''; return; }
    try { await loadBarcodeLib(); var fmt = /^\d{13}$/.test(v) ? 'EAN13' : /^\d{8}$/.test(v) ? 'EAN8' : /^\d{12}$/.test(v) ? 'UPC' : 'CODE128'; try { JsBarcode(svg, v, { format: fmt, height: 44, fontSize: 12, margin: 0, width: 1.6 }); } catch (e) { JsBarcode(svg, v, { format: 'CODE128', height: 44, fontSize: 12, margin: 0, width: 1.6 }); } } catch (e) { svg.innerHTML = ''; }
  };
  var CAM = {};
  window.scanBarcodeInto = async function (targetId) {
    var m = $('adm-scan'); if (!m) { m = document.createElement('div'); m.id = 'adm-scan'; m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9500;display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px'; document.body.appendChild(m); }
    m.innerHTML = '<video id="adm-scan-v" playsinline muted style="width:min(480px,92vw);border-radius:16px;background:#000"></video><div id="adm-scan-m" style="color:#fff;font-size:13px">Starting camera…</div><button onclick="closeAdmScan()" style="padding:10px 22px;border-radius:99px;border:none;font-weight:800">Cancel</button>'; m.style.display = 'flex';
    try {
      CAM.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }); var v = $('adm-scan-v'); v.srcObject = CAM.stream; await v.play();
      var hit = function (code) { $(targetId).value = code; closeAdmScan(); if (targetId === 'f-barcode') previewBarcode(); toast('✓ Scanned ' + code); };
      if ('BarcodeDetector' in window) { var d = new BarcodeDetector(); CAM.t = setInterval(async function () { try { var r = await d.detect(v); if (r[0]) hit(r[0].rawValue); } catch (e) {} }, 220); $('adm-scan-m').textContent = 'Hold the barcode in view'; }
      else { await lazy('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', function () { return window.ZXing; }); var rd = new ZXing.BrowserMultiFormatReader(); CAM.zx = rd; CAM.t = setInterval(async function () { try { var r = await rd.decodeFromVideoElement(v); if (r) hit(r.getText()); } catch (e) {} }, 300); $('adm-scan-m').textContent = 'Hold the barcode in view'; }
    } catch (e) { $('adm-scan-m').textContent = 'Camera unavailable: ' + (e.message || e.name) + '. A USB scanner works by clicking the barcode box and scanning.'; }
  };
  window.closeAdmScan = function () { clearInterval(CAM.t); if (CAM.zx) { try { CAM.zx.reset(); } catch (e) {} CAM.zx = null; } if (CAM.stream) { CAM.stream.getTracks().forEach(function (t) { t.stop(); }); CAM.stream = null; } var m = $('adm-scan'); if (m) m.style.display = 'none'; };

  window.printLabels = async function (keys) {
    keys = keys && keys.length ? keys : Array.from(selectedIds);
    if (!keys.length) { toast('Tick the products you want labels for'); return; }
    var qty = Number(prompt('How many labels per product?', '1')) || 0; if (!qty) return;
    try { await loadBarcodeLib(); } catch (e) { toast('❌ ' + e.message); return; }
    var cells = [];
    keys.forEach(function (k) {
      var p = prods[k]; if (!p) return; var code = String(p.barcode || p.sku || '').trim(); if (!code) return;
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); var f = /^\d{13}$/.test(code) ? 'EAN13' : /^\d{8}$/.test(code) ? 'EAN8' : /^\d{12}$/.test(code) ? 'UPC' : 'CODE128';
      try { JsBarcode(svg, code, { format: f, height: 36, fontSize: 11, margin: 0, width: 1.5 }); } catch (e) { try { JsBarcode(svg, code, { format: 'CODE128', height: 36, fontSize: 11, margin: 0, width: 1.5 }); } catch (e2) { return; } }
      for (var i = 0; i < qty; i++) cells.push('<div class="l"><div class="n">' + esc((p.name || '').slice(0, 34)) + '</div>' + svg.outerHTML + '<div class="p">' + money(p.price) + '</div></div>');
    });
    if (!cells.length) { toast('None of the selected products has a barcode or SKU'); return; }
    var w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print labels'); return; }
    w.document.write('<!doctype html><title>Labels</title><style>body{margin:0;font-family:Arial,sans-serif}.wrap{display:flex;flex-wrap:wrap}.l{width:50mm;height:30mm;box-sizing:border-box;padding:2mm;text-align:center;border:1px dashed #ccc;overflow:hidden;page-break-inside:avoid}.n{font-size:8pt;font-weight:700;line-height:1.1;height:9mm;overflow:hidden}.l svg{max-width:100%;height:12mm}.p{font-size:11pt;font-weight:800}@media print{.l{border:none}}</style><div class="wrap">' + cells.join('') + '</div><script>setTimeout(function(){print()},400)<\/script>'); w.document.close();
  };

  /* ══════════ SAVE / EDIT ══════════ */
  var V = function (id) { var e = $(id); return e ? e.value : ''; };
  var SELF_FIELDS = ['f-name', 'f-brand', 'f-sku', 'f-price', 'f-cost', 'f-orig', 'f-qty', 'f-reorder', 'f-barcode', 'f-desc', 'f-url', 'f-img', 'f-eid'];
  window.saveDeal = async function () {
    var name = V('f-name').trim(), brand = V('f-brand').trim(), cat = V('f-cat'), price = Number(V('f-price')), eid = V('f-eid'), store = V('f-store') || 'My Store';
    if (!name || !cat || !(price >= 0) || V('f-price') === '') { toast('⚠️ Fill Name, Category and Selling Price'); return; }
    var barcode = V('f-barcode').trim(), sku = V('f-sku').trim();
    if (barcode && taken(barcode, eid)) { toast('⚠️ Another product already uses barcode ' + barcode); $('f-barcode').focus(); return; }
    var btn = document.querySelector('#p-deals .acts .btn-orange'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      var url = V('f-url').trim(), inRaw = V('f-instock') || 'true', qty = Math.max(0, Math.round(Number(V('f-qty')) || 0));
      var id = eid || (NS_slug(name) + '-' + Math.random().toString(36).slice(2, 6));
      var list = IMG.slice(), main = list[0] || V('f-img').trim() || '';
      if (/^\[multiple/.test(main)) main = '';
      var thumb = main ? await thumbOf(main, 520, 0.74) : '';
      var prev = eid ? (prods[eid] || {}) : {};
      var rec = Object.assign({}, prev, {
        name: name, brand: brand, category: cat, subcategory: V('f-sub') || '', price: price, originalPrice: Number(V('f-orig')) || null, cost: Number(V('f-cost')) || 0,
        store: store, storeUrl: (typeof applyAffiliateTag === 'function' ? applyAffiliateTag(url, store) : url) || url, quantity: qty,
        inStock: inRaw === 'true' ? true : inRaw === 'reserve' ? 'reserve' : inRaw === 'service' ? 'service' : false,
        image: thumb, hasGallery: list.filter(function (u) { return /^data:/.test(u); }).length > 1 || undefined, tag: V('f-tag'), sponsored: V('f-sponsored') === '1' || undefined,
        sku: sku, barcode: barcode, description: V('f-desc').trim(), unit: V('f-unit') || 'piece', reorderPoint: Number(V('f-reorder')) || 0, vat: Number(V('f-vat')) || 0, priceLevel: V('f-pricelevel') || '',
        lastUpdated: new Date().toISOString()
      });
      if (!eid) rec.createdAt = rec.lastUpdated;
      Object.keys(rec).forEach(function (k) { if (rec[k] === undefined) delete rec[k]; });
      var r = await fetch(DB + '/' + id + '.json', { method: 'PUT', headers: H, body: JSON.stringify(rec) });
      if (!r.ok) throw new Error('Database refused the save (' + r.status + ')');
      // extra photos live in their own node so the product list stays fast
      var gal = list.filter(function (u) { return /^data:/.test(u); });
      if (gal.length > 1 || (eid && prev.hasGallery)) { await fetch(NS() + '/product_gallery/' + id + '.json', { method: gal.length > 1 ? 'PUT' : 'DELETE', headers: H, body: gal.length > 1 ? JSON.stringify(list) : undefined }); }
      prods[id] = rec; toast(eid ? '✅ Product updated — live in POS & Store' : '✅ Product added — live in POS & Store'); clearForm(); loadProds();
    } catch (e) { toast('❌ ' + (e.message || 'Save failed. Check connection.')); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '💾 Save Product → Sync to POS & Store'; } }
  };
  function NS_slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'; }
  window.clearForm = function () {
    SELF_FIELDS.forEach(function (i) { var e = $(i); if (e) e.value = ''; });
    ['f-cat', 'f-tag', 'f-pricelevel', 'f-sponsored'].forEach(function (i) { var e = $(i); if (e) e.value = ''; });
    if ($('f-store')) $('f-store').value = 'My Store'; if ($('f-instock')) $('f-instock').value = 'true'; if ($('f-unit')) $('f-unit').value = 'piece'; if ($('f-vat')) $('f-vat').value = '0';
    if (window.qcFillSubs) window.qcFillSubs('', '');
    IMG = []; renderImgs(); previewBarcode(); $('ftitle').textContent = 'Add New Product';
  };
  window.editProd = async function (k) {
    var p = prods[k]; if (!p) return;
    var set = function (id, v) { var e = $(id); if (e) e.value = v == null ? '' : v; };
    set('f-name', p.name); set('f-brand', p.brand); set('f-sku', p.sku); set('f-price', p.price); set('f-cost', p.cost || ''); set('f-orig', p.originalPrice || ''); set('f-qty', p.quantity != null ? p.quantity : ''); set('f-reorder', p.reorderPoint || ''); set('f-barcode', p.barcode); set('f-desc', p.description);
    set('f-url', p.storeUrl); set('f-store', p.store || 'My Store'); set('f-tag', p.tag); set('f-sponsored', p.sponsored ? '1' : ''); set('f-unit', p.unit || 'piece'); set('f-vat', p.vat || 0); set('f-pricelevel', p.priceLevel); set('f-eid', k);
    var cs = $('f-cat'); if (cs && p.category && !Array.from(cs.options).some(function (o) { return o.value === p.category; })) { cs.add(new Option(p.category, p.category)); } set('f-cat', p.category); if (window.qcFillSubs) window.qcFillSubs(p.category, p.subcategory);
    set('f-instock', p.inStock === true ? 'true' : p.inStock === 'reserve' ? 'reserve' : p.inStock === 'service' ? 'service' : 'affiliate');
    IMG = p.image ? [p.image] : []; set('f-img', /^https?:/.test(p.image || '') ? p.image : ''); renderImgs(); previewBarcode();
    if (p.hasGallery) { try { var g = await (await fetch(NS() + '/product_gallery/' + k + '.json')).json(); if (Array.isArray(g) && g.length) { IMG = g; renderImgs(); } } catch (e) {} }
    $('ftitle').textContent = 'Edit: ' + p.name; $('p-deals').scrollIntoView({ behavior: 'smooth' }); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('Editing: ' + p.name);
  };
  window.delProd = async function (k) {
    if (!confirm('Delete "' + (prods[k] && prods[k].name) + '"?')) return;
    await fetch(DB + '/' + k + '.json', { method: 'DELETE' }); await fetch(NS() + '/product_gallery/' + k + '.json', { method: 'DELETE' }).catch(function () {}); toast('Deleted'); loadProds();
  };

  /* ══════════ LIST ══════════ */
  var PG = { page: 1, size: 50, cat: '', stock: '', sort: 'new' };
  function stockState(p) { var q = Number(p.quantity) || 0, rp = Number(p.reorderPoint) || 0; if (p.inStock === 'service' || p.inStock === false && !q && p.storeUrl) return ['na', 'n/a']; if (q <= 0) return ['out', 'Out']; if (rp && q <= rp) return ['low', 'Low · ' + q]; return ['ok', q + '']; }
  window.renderProds = function (data) {
    var all = Object.keys(data || {}), q = (V('psearch') || '').toLowerCase().trim();
    var keys = all.filter(function (k) {
      var p = data[k]; if (PG.cat && p.category !== PG.cat) return false;
      var st = stockState(p)[0]; if (PG.stock && PG.stock !== st) return false;
      if (q && ((p.name || '') + ' ' + (p.brand || '') + ' ' + (p.category || '') + ' ' + (p.sku || '') + ' ' + (p.barcode || '')).toLowerCase().indexOf(q) < 0) return false; return true;
    });
    keys.sort(function (a, b) { var A = data[a], B = data[b]; if (PG.sort === 'name') return (A.name || '').localeCompare(B.name || ''); if (PG.sort === 'stock') return (Number(A.quantity) || 0) - (Number(B.quantity) || 0); if (PG.sort === 'price') return (Number(B.price) || 0) - (Number(A.price) || 0); return String(B.lastUpdated || '').localeCompare(String(A.lastUpdated || '')); });
    $('pcnt').textContent = all.length; updateSelCount();
    var pages = Math.max(1, Math.ceil(keys.length / PG.size)); if (PG.page > pages) PG.page = pages; var slice = keys.slice((PG.page - 1) * PG.size, PG.page * PG.size);
    // filter bar (built once)
    if (!$('pf-bar')) { var bar = document.createElement('div'); bar.id = 'pf-bar'; bar.className = 'pf-bar'; var tc = document.querySelector('#p-deals .tbl-controls'); tc.parentNode.insertBefore(bar, tc); }
    var cats = {}; all.forEach(function (k) { cats[data[k].category || 'Uncategorised'] = 1; });
    $('pf-bar').innerHTML = '<select onchange="PGset(\'cat\',this.value)"><option value="">All categories</option>' + Object.keys(cats).sort().map(function (c) { return '<option ' + (PG.cat === c ? 'selected' : '') + ' value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') + '</select>'
      + '<select onchange="PGset(\'stock\',this.value)"><option value="">Any stock</option><option value="ok"' + (PG.stock === 'ok' ? ' selected' : '') + '>In stock</option><option value="low"' + (PG.stock === 'low' ? ' selected' : '') + '>Low stock</option><option value="out"' + (PG.stock === 'out' ? ' selected' : '') + '>Out of stock</option></select>'
      + '<select onchange="PGset(\'sort\',this.value)"><option value="new">Newest</option><option value="name"' + (PG.sort === 'name' ? ' selected' : '') + '>Name A–Z</option><option value="stock"' + (PG.sort === 'stock' ? ' selected' : '') + '>Lowest stock</option><option value="price"' + (PG.sort === 'price' ? ' selected' : '') + '>Highest price</option></select>'
      + '<button class="btn btn-grey btn-sm" onclick="printLabels()">🏷 Print barcode labels</button>';
    var th = document.querySelector('#p-deals table thead tr'); if (th) th.innerHTML = '<th style="width:36px"></th><th>Img</th><th>Product</th><th>SKU / Barcode</th><th>Category</th><th>Price</th><th>Margin</th><th>Stock</th><th>Actions</th>';
    $('prod-tb').innerHTML = !slice.length ? '<tr class="empty-row"><td colspan="9">' + (all.length ? 'No products match your filters' : 'No products yet — add one above or import your list.') + '</td></tr>' :
      slice.map(function (k) {
        var p = data[k], base = Number(p.price) || 0, cost = Number(p.cost) || 0, mg = cost && base ? Math.round((base - cost) / base * 100) : null, st = stockState(p);
        return '<tr id="row_' + k + '" class="' + (selectedIds.has(k) ? 'selected' : '') + '"><td style="width:36px;text-align:center"><input type="checkbox" class="row-chk" data-id="' + k + '" ' + (selectedIds.has(k) ? 'checked' : '') + ' onchange="toggleRow(this)"></td>'
          + '<td>' + (p.image ? '<img class="td-img" src="' + esc(p.image) + '" loading="lazy" onerror="this.style.display=\'none\'">' : CE(p.category)) + '</td>'
          + '<td><strong style="font-size:12px">' + esc(p.name) + '</strong>' + (p.tag ? '<span class="bdg" style="background:var(--grey1);color:#555;margin-left:5px">' + esc(p.tag) + '</span>' : '') + '<div style="font-size:10px;color:var(--ink3)">' + esc(p.brand || '') + '</div></td>'
          + '<td style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--ink3)">' + esc(p.sku || '—') + '<br>' + esc(p.barcode || '') + '</td><td style="font-size:11px;color:var(--ink3)">' + esc(p.category || '—') + '</td>'
          + '<td style="font-weight:700;font-family:\'DM Mono\',monospace;font-size:11px">' + money(base) + (p.originalPrice > base ? '<br><s style="color:var(--ink4);font-weight:400">' + money(p.originalPrice) + '</s>' : '') + '</td>'
          + '<td style="font-size:11px;font-weight:700;color:' + (mg == null ? 'var(--ink4)' : mg < 10 ? '#d6336c' : '#0a9d6b') + '">' + (mg == null ? '—' : mg + '%') + '</td>'
          + '<td><span class="stk ' + st[0] + '">' + st[1] + '</span></td>'
          + '<td style="display:flex;gap:4px"><button class="btn btn-grey btn-sm" onclick="editProd(\'' + k + '\')">Edit</button><button class="btn btn-red btn-sm" onclick="delProd(\'' + k + '\')">Del</button></td></tr>';
      }).join('');
    var pb = $('pg-bar'); if (!pb) { pb = document.createElement('div'); pb.id = 'pg-bar'; pb.className = 'pg-bar'; $('prod-tb').closest('.box').appendChild(pb); }
    pb.innerHTML = '<span>' + keys.length + ' product' + (keys.length === 1 ? '' : 's') + (keys.length !== all.length ? ' (filtered)' : '') + '</span><span><button class="btn btn-grey btn-sm" ' + (PG.page <= 1 ? 'disabled' : '') + ' onclick="PGgo(-1)">‹ Prev</button> &nbsp;Page ' + PG.page + ' of ' + pages + '&nbsp; <button class="btn btn-grey btn-sm" ' + (PG.page >= pages ? 'disabled' : '') + ' onclick="PGgo(1)">Next ›</button></span>';
  };
  window.PGset = function (k, v) { PG[k] = v; PG.page = 1; renderProds(prods); };
  window.PGgo = function (d) { PG.page += d; renderProds(prods); };
  window.filterProds = function () { PG.page = 1; renderProds(prods); };

  /* ══════════ IMPORT WIZARD ══════════ */
  var IM = { a: null, map: null, fileName: '' };
  function modal() {
    var bg = $('imp-bg'); if (bg) return bg; bg = document.createElement('div'); bg.id = 'imp-bg'; bg.onclick = function (e) { if (e.target === bg) closeImport(); }; bg.innerHTML = '<div id="imp-box"></div>'; document.body.appendChild(bg); return bg;
  }
  window.openImport = function (prefillText) {
    modal().classList.add('on'); IM.a = null;
    $('imp-box').innerHTML = '<div class="imp-hd"><div><h3>📥 Import products</h3><div style="font-size:12px;color:var(--ink3);margin-top:3px">Drop your existing list in <b>any format</b> — we detect it and arrange the columns for you.</div></div><button class="btn btn-grey btn-sm" onclick="closeImport()">✕</button></div>'
      + '<div class="imp-bd"><div class="drop" id="imp-drop" onclick="document.getElementById(\'imp-file\').click()"><div style="font-size:34px">📄</div><b>Drop a file here or click to choose</b><small>CSV · Excel (.xlsx/.xls) · JSON · TSV · text — from Excel, Google Sheets, another POS, Shopify, anything</small></div>'
      + '<input type="file" id="imp-file" accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.xlsm,.ods" style="display:none" onchange="impFile(this.files[0])">'
      + '<div style="text-align:center;margin:14px 0;font-size:11px;color:var(--ink4);font-weight:700;letter-spacing:.1em">OR PASTE</div>'
      + '<textarea id="imp-paste" rows="5" placeholder="Paste rows copied from Excel / Google Sheets, CSV text, or JSON…" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:14px;font-family:\'DM Mono\',monospace;font-size:11px">' + esc(prefillText || '') + '</textarea>'
      + '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-orange" onclick="impPaste()">Detect &amp; preview →</button><button class="btn btn-grey" onclick="downloadProductTemplate()">⬇ Download sample template</button></div></div>';
    var d = $('imp-drop');
    ['dragover', 'dragenter'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.remove('over'); }); });
    d.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) impFile(f); });
  };
  window.closeImport = function () { var b = $('imp-bg'); if (b) b.classList.remove('on'); };
  window.importProductsFile = function (input) { var f = input.files && input.files[0]; input.value = ''; openImport(); if (f) impFile(f); };
  window.openBulkPasteModal = function () { openImport(); };
  window.impPaste = function () { var t = $('imp-paste').value; if (!t.trim()) { toast('Paste something first'); return; } IM.fileName = 'pasted data'; analyse({ text: t }); };
  window.impFile = async function (f) {
    if (!f) return; IM.fileName = f.name; var ext = (f.name.split('.').pop() || '').toLowerCase();
    try {
      if (/^(xlsx|xls|xlsm|ods)$/.test(ext)) {
        $('imp-box').querySelector('.imp-bd').insertAdjacentHTML('afterbegin', '<div style="font-size:12px;color:var(--ink3);margin-bottom:8px">Reading spreadsheet…</div>');
        await loadSheetJS(); var wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), best = null, bn = -1;
        wb.SheetNames.forEach(function (n) { var rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); var c = rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); }).length; if (c > bn) { bn = c; best = rows; } });
        analyse({ rows: (best || []).map(function (r) { return r.map(function (x) { return typeof x === 'number' ? (Number.isInteger(x) ? String(x) : String(x)) : String(x == null ? '' : x); }); }), format: 'Excel (' + ext.toUpperCase() + ')' });
      } else analyse({ text: await f.text() });
    } catch (e) { toast('❌ Could not read file: ' + e.message); }
  };
  function analyse(input) {
    var a = QCImport.analyse(input); if (a.error) { toast('⚠️ ' + a.error); return; }
    IM.a = a; IM.map = Object.assign({}, a.map); renderPreview();
  }
  function renderPreview() {
    var a = IM.a, built = QCImport.build(a, IM.map, { defaultCategory: ($('imp-defcat') || {}).value || '' }), P = built.products;
    var opts = function (sel) { return '<option value="">— not in file —</option>' + a.headers.map(function (h, i) { return '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + esc(h || 'Column ' + (i + 1)) + '</option>'; }).join(''); };
    var existing = Object.keys(prods).length;
    var upd = 0; P.forEach(function (p) { if (QCImport.matchExisting(p, prods)) upd++; });
    $('imp-box').innerHTML = '<div class="imp-hd"><div><h3>📥 Review import</h3><div style="font-size:12px;color:var(--ink3);margin-top:4px"><span class="fmt-badge">' + esc(a.format) + '</span> &nbsp;' + esc(IM.fileName) + ' · ' + a.total + ' rows · ' + (a.hasHeader ? 'header row found' : 'no header — columns guessed from the data') + '</div></div><button class="btn btn-grey btn-sm" onclick="closeImport()">✕</button></div>'
      + '<div class="imp-bd">' + (a.warn ? '<div class="imp-issues">⚠️ ' + esc(a.warn) + '</div>' : '')
      + '<div style="font-size:12px;font-weight:800;margin-bottom:2px">Column mapping <span style="font-weight:500;color:var(--ink3)">— green = detected automatically, change if wrong</span></div><div class="map-grid">'
      + QCImport.FIELDS.map(function (f) { var sel = IM.map[f] != null ? IM.map[f] : null; return '<div class="' + (sel != null ? 'auto' : '') + '"><label>' + QCImport.LABELS[f] + (f === 'name' ? ' *' : '') + '</label><select onchange="impMap(\'' + f + '\',this.value)">' + opts(sel) + '</select></div>'; }).join('') + '</div>'
      + '<div style="font-size:12px;font-weight:800;margin:14px 0 6px">Preview (first 6 of ' + P.length + ' products)</div><div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px"><table class="imp-tbl"><thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Cost</th><th>Qty</th><th>SKU</th><th>Barcode</th></tr></thead><tbody>'
      + P.slice(0, 6).map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.category) + '</td><td>' + money(p.price) + '</td><td>' + (p.cost ? money(p.cost) : '—') + '</td><td>' + p.quantity + '</td><td>' + esc(p.sku || '—') + '</td><td>' + esc(p.barcode || '—') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      + (built.issues.length ? '<div class="imp-issues"><b>' + built.issues.length + ' note' + (built.issues.length > 1 ? 's' : '') + ':</b><br>' + built.issues.slice(0, 40).map(function (i) { return 'Row ' + i.row + ': ' + esc(i.msg); }).join('<br>') + '</div>' : '')
      + '<div class="imp-opts"><div><label>If the product already exists (' + upd + ' match)</label><select id="imp-dup"><option value="update">Update it (match barcode → SKU → name)</option><option value="skip">Skip it</option><option value="new">Create a duplicate anyway</option></select></div>'
      + '<div><label>Stock quantity</label><select id="imp-qtymode"><option value="set">Set stock to the quantity in file</option><option value="add">Add file quantity to current stock</option><option value="keep">Keep current stock (don’t touch)</option></select></div>'
      + '<div><label>Default category (when missing)</label><input id="imp-defcat" value="' + esc(($('imp-defcat') || {}).value || '') + '" placeholder="e.g. General" onchange="renderImpPreview()"></div><div><label>Sell on</label><select id="imp-store"><option value="My Store">My Store (POS + online)</option></select></div></div>'
      + '<div id="imp-prog" style="display:none;margin-bottom:10px"><div style="height:8px;background:var(--grey1);border-radius:99px;overflow:hidden"><div id="imp-bar" style="height:100%;width:0;background:linear-gradient(90deg,var(--accent),#333);transition:.2s"></div></div><div id="imp-ptxt" style="font-size:11px;color:var(--ink3);margin-top:5px"></div></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-orange" id="imp-go" onclick="runImport()"' + (P.length ? '' : ' disabled') + '>Import ' + P.length + ' product' + (P.length === 1 ? '' : 's') + '</button><button class="btn btn-grey" onclick="openImport()">← Back</button></div>'
      + '<p style="font-size:11px;color:var(--ink3);margin-top:12px">You can edit any product afterwards to add images, descriptions and more.</p></div>';
  }
  window.renderImpPreview = renderPreview;
  window.impMap = function (f, v) { if (v === '') delete IM.map[f]; else { var n = Number(v); Object.keys(IM.map).forEach(function (k) { if (IM.map[k] === n && k !== f) delete IM.map[k]; }); IM.map[f] = n; } var dc = ($('imp-defcat') || {}).value; renderPreview(); if ($('imp-defcat')) $('imp-defcat').value = dc || ''; };
  window.runImport = async function () {
    var dup = V('imp-dup') || 'update', qm = V('imp-qtymode') || 'set', built = QCImport.build(IM.a, IM.map, { defaultCategory: V('imp-defcat') });
    var P = built.products; if (!P.length) return; $('imp-go').disabled = true; $('imp-prog').style.display = 'block';
    var takenIds = {}; Object.keys(prods).forEach(function (k) { takenIds[k] = 1; });
    var writes = {}, added = 0, updated = 0, skipped = 0, now = new Date().toISOString();
    P.forEach(function (p) {
      var row = Object.assign({}, p); delete row._row; row.store = V('imp-store') || 'My Store'; row.inStock = true; row.lastUpdated = now;
      var ex = dup === 'new' ? null : QCImport.matchExisting(p, Object.assign({}, prods, writes));
      if (ex) {
        if (dup === 'skip') { skipped++; return; }
        var old = writes[ex] || prods[ex] || {}, rec = Object.assign({}, old);
        Object.keys(row).forEach(function (k) { if (row[k] !== '' && row[k] != null && !(k === 'price' && !row[k])) rec[k] = row[k]; });
        if (qm === 'keep') rec.quantity = old.quantity || 0; else if (qm === 'add') rec.quantity = (Number(old.quantity) || 0) + (Number(p.quantity) || 0);
        if (old.image && !row.image) rec.image = old.image; writes[ex] = rec; updated++;
      } else { row.createdAt = now; if (qm === 'keep') row.quantity = 0; writes[QCImport.newId(p, takenIds)] = row; added++; }
    });
    var ids = Object.keys(writes), CH = 80, done = 0;
    try {
      for (var i = 0; i < ids.length; i += CH) {
        var chunk = {}; ids.slice(i, i + CH).forEach(function (k) { chunk[k] = writes[k]; });
        var r = await fetch(DB + '.json', { method: 'PATCH', headers: H, body: JSON.stringify(chunk) }); if (!r.ok) throw new Error('Database refused a batch (' + r.status + ')');
        done += Object.keys(chunk).length; $('imp-bar').style.width = Math.round(done / ids.length * 100) + '%'; $('imp-ptxt').textContent = done + ' / ' + ids.length + ' saved…';
      }
      Object.assign(prods, writes);
      $('imp-box').innerHTML = '<div class="imp-hd"><h3>✅ Import complete</h3><button class="btn btn-grey btn-sm" onclick="closeImport()">✕</button></div><div class="imp-bd" style="text-align:center;padding:36px"><div style="font-size:46px">🎉</div><div style="font-size:22px;font-weight:800;margin:8px 0">' + added + ' added · ' + updated + ' updated' + (skipped ? ' · ' + skipped + ' skipped' : '') + '</div><div style="font-size:13px;color:var(--ink3);margin-bottom:18px">They’re live in the POS and online store now. Scan-ready wherever a barcode was provided.</div><button class="btn btn-orange" onclick="closeImport()">Done</button></div>';
      loadProds();
    } catch (e) { toast('❌ ' + e.message); $('imp-go').disabled = false; $('imp-ptxt').textContent = 'Stopped after ' + done + ' products: ' + e.message; }
  };

  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  var COLS = ['name', 'brand', 'category', 'price', 'originalPrice', 'cost', 'quantity', 'sku', 'barcode', 'unit', 'reorderPoint', 'vat', 'description', 'image', 'supplier', 'tag'];
  function dl(name, text, type) { var b = new Blob(['\uFEFF' + text], { type: type || 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); }
  window.exportProductsCSV = function () { var keys = Object.keys(prods || {}); if (!keys.length) { toast('No products to export'); return; } dl('products-' + new Date().toISOString().slice(0, 10) + '.csv', [COLS.join(',')].concat(keys.map(function (k) { return COLS.map(function (c) { var v = prods[k][c]; if (c === 'image' && /^data:/.test(v || '')) v = ''; return csvCell(v); }).join(','); })).join('\r\n')); toast('✅ Exported ' + keys.length + ' products'); };
  window.downloadProductTemplate = function () { dl('products-template.csv', [COLS.join(','), 'Golden Penny Spaghetti 500g,Golden Penny,Groceries,1250,1400,980,48,GP-SP-500,6001234567890,pack,10,0,Quality spaghetti,,Dangote,', 'Peak Milk Tin 400g,Peak,Dairy,3400,,2900,12,PK-400,6009876543210,piece,5,7.5,Full cream milk powder,,FrieslandCampina,NEW'].join('\r\n')); };

  /* ══════════ page wiring ══════════ */
  function wire() {
    // import toolbar → one smart button
    var imp = $('import-products-file'); if (imp) { var bar = imp.parentNode; bar.innerHTML = '<button class="btn btn-orange btn-sm" onclick="openImport()">📥 Import products (any format)</button><button class="btn btn-grey btn-sm" onclick="downloadProductTemplate()">⬇ Sample template</button><button class="btn btn-grey btn-sm" onclick="exportProductsCSV()">⬆ Export all</button>'; var sub = bar.previousElementSibling; if (sub) sub.innerHTML = '<div style="font-family:\'Syne\',sans-serif;font-size:14px;font-weight:800;color:#fff;margin-bottom:3px">📥 Bring your existing product list</div><div style="font-size:11px;color:rgba(255,255,255,.55)">CSV, Excel, JSON or paste from a sheet — columns are detected and arranged automatically. Update existing products by barcode / SKU / name.</div>'; }
    // barcode field → generate / scan / preview
    var bc = $('f-barcode'); if (bc && !$('bc-prev')) { var w = bc.parentNode; bc.outerHTML = '<div class="bc-row"><input id="f-barcode" placeholder="Scan or type barcode" oninput="previewBarcode()" autocomplete="off"><button class="btn btn-grey btn-sm" type="button" onclick="genBarcode()">⚡ Generate</button><button class="btn btn-grey btn-sm" type="button" onclick="scanBarcodeInto(\'f-barcode\')">📷</button></div><svg id="bc-prev"></svg><p class="hint">This barcode is what the POS scanner matches. Leave blank if none.</p>'; var lb = w.querySelector('label'); if (lb) lb.textContent = 'Barcode (POS scan code)'; }
    var sk = $('f-sku'); if (sk) sk.placeholder = 'SKU-001 (also scannable)';
    // keep import file input working for any old callers
    var fi = $('f-img-file'); if (fi) fi.setAttribute('onchange', 'handleProductImages(this)');
    // categories: allow adding new
    var cat = $('f-cat'); if (cat && !Array.from(cat.options).some(function (o) { return o.value === '__new'; })) { cat.add(new Option('➕ Add new category…', '__new')); cat.addEventListener('change', function () { if (cat.value === '__new') { var n = (prompt('New category name:') || '').trim(); if (n) { cat.add(new Option(n, n), cat.options.length - 1); cat.value = n; } else cat.value = ''; } }); }
    // categories created in Store Builder become selectable here too
    fetch(NS() + '/settings/store_design/categories.json').then(function (r) { return r.json(); }).then(function (cs) { if (!Array.isArray(cs) || !cat) return; cs.forEach(function (c) { if (c && c.name && !Array.from(cat.options).some(function (o) { return o.value === c.name; })) cat.add(new Option(c.name, c.name), cat.options.length - 1); }); }).catch(function () {});
    // subcategories (created in the Page Editor / Store Builder) — optional second dropdown under Category
    (function () {
      if (!cat || $('f-sub')) return;
      var wrap = cat.closest('.ff') || cat.parentNode, box = document.createElement('div');
      box.className = 'ff'; box.id = 'f-sub-wrap'; box.style.display = 'none';
      box.innerHTML = '<label>Subcategory (optional)</label><select id="f-sub"><option value="">— None —</option></select>';
      wrap.parentNode.insertBefore(box, wrap.nextSibling);
      var SUBS = {};
      window.qcFillSubs = function (c, sel) {
        var sb = $('f-sub'), list = SUBS[c] || [];
        sb.innerHTML = '<option value="">— None —</option>' + list.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
        if (sel && list.indexOf(sel) < 0) sb.add(new Option(sel, sel));
        sb.value = sel || ''; box.style.display = (list.length || sel) ? '' : 'none';
      };
      cat.addEventListener('change', function () { window.qcFillSubs(cat.value, ''); });
      fetch(NS() + '/settings/store_design/categories.json').then(function (r) { return r.json(); }).then(function (cs) {
        if (!Array.isArray(cs)) return;
        cs.forEach(function (c) { if (c && c.name && Array.isArray(c.subs)) SUBS[c.name] = c.subs.filter(Boolean); });
        window.qcFillSubs(cat.value, '');
      }).catch(function () {});
    })();
    // show the "My Store" default and clean title
    var t = $('ftitle'); if (t && /Deal/.test(t.textContent)) t.textContent = 'Add New Product';
    var h3 = document.querySelector('#p-deals .box-hd h3'); if (h3) h3.firstChild.textContent = 'All Products (';
    var sp = $('psearch'); if (sp) sp.placeholder = 'Search name, SKU or barcode…';
    renderImgs(); if (typeof prods === 'object' && Object.keys(prods).length) renderProds(prods);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  // USB scanner convenience: scanning into the barcode box shouldn't submit/jump
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'f-barcode') { e.preventDefault(); previewBarcode(); var n = $('f-name'); if (n && !n.value) n.focus(); } });
})();
