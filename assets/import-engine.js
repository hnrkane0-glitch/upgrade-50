/* QuickCart — product import engine.
   Give it text / an array of rows / a SheetJS workbook and it works out the format, finds the header row,
   maps the columns to product fields and cleans prices/quantities. No configuration needed.
   Works in the browser (window.QCImport) and in Node (module.exports) so it can be unit-tested. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.QCImport = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIELDS = ['name', 'brand', 'category', 'price', 'originalPrice', 'cost', 'quantity', 'sku', 'barcode', 'description', 'unit', 'reorderPoint', 'vat', 'image', 'supplier', 'expiry', 'tag', 'storeUrl'];
  var LABELS = { name: 'Product name', brand: 'Brand', category: 'Category', price: 'Selling price', originalPrice: 'Compare-at price', cost: 'Cost price', quantity: 'Quantity', sku: 'SKU / code', barcode: 'Barcode', description: 'Description', unit: 'Unit', reorderPoint: 'Reorder point', vat: 'VAT %', image: 'Image URL', supplier: 'Supplier', expiry: 'Expiry date', tag: 'Tag', storeUrl: 'Product URL' };

  // Ordered: more specific patterns first so "cost price" is not mistaken for "price".
  var RULES = [
    ['barcode', /barcode|upc|ean|gtin|scancode|posid|isbn|bar$/],
    ['sku', /^(sku|itemcode|productcode|stockcode|partno|partnumber|mpn|itemno|itemnumber|code|ref|reference|productid|stockno|plu)$/],
    ['cost', /cost|purchase|buying|buyprice|^cp$|landed|supplierprice|wholesale/],
    ['originalPrice', /original|compare|oldprice|regular|listprice|^was|mrp|rrp|beforediscount/],
    ['reorderPoint', /reorder|minstock|minimum|minqty|lowstock|safety|alertqty|alertlevel|minlevel/],
    ['quantity', /^(qty|quantity|stock|onhand|available|inventory|balance|instock|stocklevel|openingstock|currentstock|stockqty|qtyonhand|unitsinstock|stockonhand|count)$|qty|quantity|onhand/],
    ['price', /price|selling|saleprice|retail|^sp$|^rate$|srp|^amount$|^mrp$|^value$|^ngn$|naira/],
    ['vat', /^vat|^tax/],
    ['unit', /^unit$|uom|measure|^units$|packsize/],
    ['image', /image|img|photo|picture|thumbnail|pic$/],
    ['category', /categor|department|^group$|^type$|class|producttype|section|^cat$/],
    ['brand', /brand|manufacturer|^make$|^maker$/],
    ['supplier', /supplier|vendor|distributor/],
    ['expiry', /expir|expdate|bestbefore|^exp$/],
    ['tag', /^tag$|^tags$|^label$|badge/],
    ['storeUrl', /^url$|^link$|producturl|weblink/],
    ['name', /^(name|productname|itemname|item|product|title|producttitle|goods|article|productdescription|itemdescription|itemtitle|descriptionofgoods)$/],
    ['description', /desc|detail|about|notes|summary/]
  ];
  var norm = function (h) { return String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, ''); };

  /* ── CSV / delimited text ── */
  function detectDelimiter(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); }).slice(0, 25), best = ',', bestScore = -1;
    [',', '\t', ';', '|'].forEach(function (d) {
      var counts = lines.map(function (l) { var n = 0, q = false; for (var i = 0; i < l.length; i++) { var c = l[i]; if (c === '"') q = !q; else if (c === d && !q) n++; } return n; });
      var freq = {}; counts.forEach(function (c) { if (c > 0) freq[c] = (freq[c] || 0) + 1; });
      var modal = 0, mf = 0; Object.keys(freq).forEach(function (k) { if (freq[k] > mf || (freq[k] === mf && Number(k) > modal)) { mf = freq[k]; modal = Number(k); } });
      if (!modal) return;                                   // title rows with no delimiter are ignored
      var score = (mf / lines.length) * 10 + Math.min(modal, 8);  // how many lines agree on the column count
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }
  function parseDelimited(text, d) {
    var rows = [], row = [], cur = '', q = false, i = 0, n = text.length;
    for (; i < n; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === d) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(function (x) { return String(x).trim() !== ''; })) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some(function (x) { return String(x).trim() !== ''; })) rows.push(row);
    return rows.map(function (r) { return r.map(function (x) { return String(x).trim(); }); });
  }

  /* ── JSON in any common shape ── */
  function fromJSON(v) {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } }
    if (Array.isArray(v)) {
      if (!v.length) return [];
      if (Array.isArray(v[0])) return v; // array of arrays: first row = headers
      return v.filter(function (x) { return x && typeof x === 'object'; });
    }
    if (v && typeof v === 'object') {
      var keys = ['products', 'items', 'data', 'rows', 'records', 'results', 'inventory', 'stock'];
      for (var i = 0; i < keys.length; i++) if (v[keys[i]]) { var r = fromJSON(v[keys[i]]); if (r) return r; }
      var vals = Object.keys(v).map(function (k) { return v[k]; });
      if (vals.length && vals.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); })) return vals; // Firebase-style {id:{...}}
      if (v.name || v.price) return [v];
    }
    return null;
  }

  /* ── numbers ── */
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).trim(); if (!s) return 0;
    s = s.replace(/[^\d.,\-]/g, '');                                   // drop ₦ NGN N spaces text
    if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 (European)
    else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');                               // 12,5
    else s = s.replace(/,/g, '');                                                             // 1,234.50
    var n = parseFloat(s); return isFinite(n) ? n : 0;
  }
  var isNumLike = function (v) { return v !== '' && /^[\s₦NGN$£€]*-?\d[\d,.\s]*$/i.test(String(v)); };

  /* ── header detection + column mapping ── */
  function headerScore(row) { var s = 0; row.forEach(function (c) { var h = norm(c); if (!h) return; for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(h)) { s++; break; } }); return s; }
  function mapHeaders(headers) {
    var map = {}, used = {};
    RULES.forEach(function (rule) {
      var f = rule[0], re = rule[1];
      if (map[f] != null) return;
      for (var i = 0; i < headers.length; i++) { if (used[i]) continue; var h = norm(headers[i]); if (h && re.test(h)) { map[f] = i; used[i] = true; break; } }
    });
    // a lone "Description" column is the product name when no name column exists
    if (map.name == null && map.description != null) { map.name = map.description; delete map.description; }
    return map;
  }
  function inferHeaderless(rows) { // no header row: guess from the data itself
    var cols = rows[0].length, info = [], sample = rows.slice(0, 30);
    for (var c = 0; c < cols; c++) {
      var vals = sample.map(function (r) { return r[c]; }).filter(function (v) { return v !== '' && v != null; });
      var nums = vals.filter(isNumLike), digits = vals.filter(function (v) { return /^\d{8,14}$/.test(String(v).trim()); });
      info.push({ c: c, n: vals.length, numeric: vals.length && nums.length / vals.length > .85, barcode: vals.length && digits.length / vals.length > .85, avgLen: vals.reduce(function (s, v) { return s + String(v).length; }, 0) / (vals.length || 1), nums: nums.map(num) });
    }
    var map = {}, left = info.slice();
    var bc = left.filter(function (x) { return x.barcode; })[0]; if (bc) { map.barcode = bc.c; left = left.filter(function (x) { return x !== bc; }); }
    var txt = left.filter(function (x) { return !x.numeric; }).sort(function (a, b) { return b.avgLen - a.avgLen; });
    if (txt[0]) { map.name = txt[0].c; left = left.filter(function (x) { return x !== txt[0]; }); }
    if (txt[1]) { map.category = txt[1].c; left = left.filter(function (x) { return x !== txt[1]; }); }
    var nm = left.filter(function (x) { return x.numeric; });
    var ints = nm.filter(function (x) { return x.nums.every(function (v) { return v === Math.floor(v); }) && Math.max.apply(null, x.nums) < 100000 && Math.min.apply(null, x.nums) >= 0; });
    var price = nm.slice().sort(function (a, b) { return avg(b.nums) - avg(a.nums); })[0];
    if (price) { map.price = price.c; nm = nm.filter(function (x) { return x !== price; }); }
    if (nm[0]) map.quantity = nm[0].c;
    return map;
  }
  var avg = function (a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; };

  /* ── normalise a table (array of arrays) or array of objects into { headers, rows, map, ... } ── */
  function analyseTable(rows) {
    rows = rows.filter(function (r) { return r && r.some(function (x) { return String(x == null ? '' : x).trim() !== ''; }); });
    if (!rows.length) return { error: 'The file is empty.' };
    var best = -1, bi = 0; for (var i = 0; i < Math.min(rows.length, 12); i++) { var s = headerScore(rows[i]); if (s > best) { best = s; bi = i; } }
    var hasHeader = best >= 2 || (best >= 1 && rows[bi].length <= 3), headers, body, map;
    if (hasHeader) { headers = rows[bi].map(function (h) { return String(h).trim(); }); body = rows.slice(bi + 1); map = mapHeaders(headers); }
    else { body = rows; map = inferHeaderless(rows); headers = rows[0].map(function (_, i) { return 'Column ' + (i + 1); }); }
    return { headers: headers, body: body, map: map, hasHeader: hasHeader };
  }
  function analyseObjects(objs) {
    var headers = []; objs.forEach(function (o) { Object.keys(o).forEach(function (k) { if (headers.indexOf(k) < 0) headers.push(k); }); });
    var map = mapHeaders(headers);
    var body = objs.map(function (o) { return headers.map(function (h) { var v = o[h]; return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v); }); });
    return { headers: headers, body: body, map: map, hasHeader: true };
  }

  /* ── main entry ── input: {text} | {rows} | {json} ; returns analysis ── */
  function analyse(input) {
    var res, format = '';
    if (input.rows) { res = analyseTable(input.rows); format = input.format || 'spreadsheet'; }
    else {
      var text = String(input.text == null ? '' : input.text).replace(/^\uFEFF/, '').trim();
      if (!text) return { error: 'Nothing to import — the file is empty.' };
      var j = null;
      if (/^[\[{]/.test(text)) j = fromJSON(text);
      if (!j && /\n\s*\{/.test(text) && /^\{/.test(text)) { // NDJSON
        try { j = text.split(/\r?\n/).filter(Boolean).map(function (l) { return JSON.parse(l); }); } catch (e) { j = null; }
      }
      if (j) { format = 'JSON'; res = (j.length && Array.isArray(j[0])) ? analyseTable(j) : analyseObjects(j); }
      else {
        var d = detectDelimiter(text); format = { ',': 'CSV', '\t': 'Tab-separated (Excel paste)', ';': 'Semicolon CSV', '|': 'Pipe-separated' }[d];
        var rows = parseDelimited(text, d);
        if (rows.length > 1 && rows.every(function (r) { return r.length === 1; })) { format = 'One column list'; }
        res = analyseTable(rows);
      }
    }
    if (res.error) return res;
    res.format = format; res.total = res.body.length;
    if (res.map.name == null) res.warn = 'Could not find a product-name column — pick one below.';
    return res;
  }

  /* ── turn analysed rows into clean product objects ── */
  function build(analysis, map, opt) {
    opt = opt || {}; map = map || analysis.map; var out = [], issues = [];
    var seenBc = {}, seenName = {};
    analysis.body.forEach(function (r, idx) {
      var g = function (f) { var i = map[f]; if (i == null || i === '' || i < 0) return ''; var v = r[i]; return v == null ? '' : String(v).trim(); };
      var name = g('name'); if (!name) { if (r.some(function (x) { return String(x).trim(); })) issues.push({ row: idx + 1, msg: 'No product name — skipped' }); return; }
      var p = { name: name, brand: g('brand'), category: g('category') || opt.defaultCategory || 'Other', price: num(g('price')), quantity: Math.max(0, Math.round(num(g('quantity')))), sku: g('sku'), barcode: g('barcode').replace(/\.0+$/, '').replace(/\s+/g, ''), description: g('description'), unit: (g('unit') || 'piece').toLowerCase() };
      var oc = num(g('originalPrice')); if (oc) p.originalPrice = oc;
      var cs = num(g('cost')); if (cs) p.cost = cs;
      var rp = g('reorderPoint'); if (rp !== '') p.reorderPoint = Math.round(num(rp));
      var vt = g('vat'); if (vt !== '') p.vat = num(vt);
      var im = g('image').split(/[\s,|;]+/).filter(function (u) { return /^(https?:)?\/\//i.test(u) || /^data:image/.test(u); })[0]; if (im) p.image = im;
      ['supplier', 'expiry', 'tag', 'storeUrl'].forEach(function (f) { var v = g(f); if (v) p[f] = v; });
      if (p.barcode && /e\+/i.test(p.barcode)) { issues.push({ row: idx + 1, msg: 'Barcode "' + p.barcode + '" was turned into scientific notation by Excel — format the column as Text and re-export' }); p.barcode = ''; }
      if (!p.price) issues.push({ row: idx + 1, msg: '"' + name + '" has no selling price (imported as ₦0)', warn: true });
      if (p.barcode) { if (seenBc[p.barcode]) issues.push({ row: idx + 1, msg: 'Duplicate barcode ' + p.barcode + ' in file', warn: true }); seenBc[p.barcode] = 1; }
      p._row = idx + 1; out.push(p);
    });
    return { products: out, issues: issues };
  }

  /* ── work out which existing product an imported row refers to (for update-instead-of-duplicate) ── */
  function matchExisting(p, existing) {
    var bc = String(p.barcode || '').trim(), sku = String(p.sku || '').trim().toLowerCase(), nm = String(p.name || '').trim().toLowerCase(), keys = Object.keys(existing || {});
    if (bc) for (var i = 0; i < keys.length; i++) if (String(existing[keys[i]].barcode || '').trim() === bc) return keys[i];
    if (sku) for (var j = 0; j < keys.length; j++) if (String(existing[keys[j]].sku || '').trim().toLowerCase() === sku) return keys[j];
    for (var k = 0; k < keys.length; k++) if (String(existing[keys[k]].name || '').trim().toLowerCase() === nm) return keys[k];
    return null;
  }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item'; }
  function newId(p, taken) { var base = slug(p.name), id = base, n = 2; while (taken[id]) id = base + '-' + (n++); taken[id] = 1; return id; }

  return { FIELDS: FIELDS, LABELS: LABELS, analyse: analyse, build: build, num: num, matchExisting: matchExisting, newId: newId, detectDelimiter: detectDelimiter, parseDelimited: parseDelimited, mapHeaders: mapHeaders, slug: slug };
});
