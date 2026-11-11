/* QuickCart POS extension — loaded after the POS inline script.
   1) Barcode scanning (USB/Bluetooth scanners + phone camera) with instant price display
   2) Multi-bank terminals (Paystack, Moniepoint, OPay + any bank via webhook) that auto-complete the sale
   3) Settings UI, receipt printing */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var OWNER = function () { return (window.QCDB && QCDB.owner && QCDB.owner()) || 'admin'; };
  var NSB = function () { return getNS(); };
  var L = localStorage;
  function jparse(s, d) { try { return JSON.parse(s); } catch (e) { return d; } }
  function prodImg(p) { return (p && (p.image || (p.images && p.images[0]) || p.img)) || ''; }
  window.prodImg = prodImg;

  /* ══════════════════ BARCODE ══════════════════ */
  var BC = { idx: {}, mode: L.getItem('qc_scan_mode') || 'add', sound: L.getItem('qc_scan_sound') !== '0', buf: '', last: 0, fast: true, ctx: null };

  function variants(c) {
    c = String(c || '').trim().replace(/\s+/g, '').toLowerCase(); if (!c) return [];
    var out = [c], d = c.replace(/\D/g, '');
    if (d && d === c) { var t = d.replace(/^0+/, ''); if (t && t !== c) out.push(t); if (d.length === 12) out.push('0' + d); if (d.length === 13 && d[0] === '0') out.push(d.slice(1)); }
    return out;
  }
  window.indexBarcodes = function () {
    BC.idx = {};
    (window._prods || []).forEach(function (p) {
      var codes = [p.barcode, p.sku, p.code].concat(Array.isArray(p.barcodes) ? p.barcodes : []);
      codes.forEach(function (c) { variants(c).forEach(function (v) { if (!BC.idx[v]) BC.idx[v] = p._k; }); });
    });
  };
  function findByCode(code) { var vs = variants(code); for (var i = 0; i < vs.length; i++) { if (BC.idx[vs[i]]) return (window._prods || []).find(function (p) { return p._k === BC.idx[vs[i]]; }); } return null; }
  window.findByCode = findByCode;

  function beep(ok) {
    if (!BC.sound) return;
    try { BC.ctx = BC.ctx || new (window.AudioContext || window.webkitAudioContext)(); var o = BC.ctx.createOscillator(), g = BC.ctx.createGain(); o.type = 'sine'; o.frequency.value = ok ? 1040 : 220; g.gain.value = .08; o.connect(g); g.connect(BC.ctx.destination); o.start(); o.stop(BC.ctx.currentTime + (ok ? .09 : .28)); } catch (e) {}
  }
  var flashT;
  function flash(p, code, extra) {
    var el = $('scan-flash'); if (!el) { el = document.createElement('div'); el.id = 'scan-flash'; el.className = 'scan-flash'; document.body.appendChild(el); }
    if (p) {
      var q = Number(p.quantity) || 0, img = prodImg(p);
      el.className = 'scan-flash on';
      el.innerHTML = '<div class="sf-img">' + (img ? '<img src="' + esc(img) + '" alt="">' : '📦') + '</div><div><div class="sf-n">' + esc(p.name || '') + '</div><div class="sf-p">' + fm(p.price) + '</div><div class="sf-s">' + (extra || (q > 0 ? q + ' in stock' : 'Out of stock')) + '</div></div>';
    } else {
      el.className = 'scan-flash on bad';
      el.innerHTML = '<div class="sf-img">❓</div><div><div class="sf-n">No product with barcode</div><div class="sf-p">' + esc(code) + '</div><div class="sf-s">Add it in Dashboard → Products</div></div>';
    }
    clearTimeout(flashT); flashT = setTimeout(function () { el.classList.remove('on'); }, p ? 2800 : 3500);
  }
  window.handleScan = function (code) {
    code = String(code || '').trim(); if (code.length < 2) return false;
    var p = findByCode(code);
    if (!p) { beep(false); flash(null, code); return false; }
    beep(true);
    if (BC.mode === 'add') {
      var q = Number(p.quantity) || 0;
      if (p.inStock === false || q <= 0) { flash(p, code, '⚠ Out of stock — not added'); return true; }
      addItem(p._k); flash(p, code, '✓ Added to sale · ' + q + ' in stock');
    } else flash(p, code, 'Price check · ' + (Number(p.quantity) || 0) + ' in stock');
    return true;
  };
  window.setScanMode = function (m) { BC.mode = m; L.setItem('qc_scan_mode', m); refreshScanMode(); pToast(m === 'add' ? 'Scan adds items to the sale' : 'Price-check mode — scans only show the price', 'ok'); };
  function refreshScanMode() { ['add', 'check'].forEach(function (m) { var b = $('sm-' + m); if (b) b.classList.toggle('on', BC.mode === m); }); }
  window.refreshScanMode = refreshScanMode;

  // Hardware scanners behave like a very fast keyboard that ends with Enter.
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var blocked = ['pay-modal', 'recov', 'sumov', 'co-modal'].some(function (id) { var el = $(id); return el && el.classList.contains('open'); }) || ($('pos-settings-modal') && $('pos-settings-modal').style.display === 'flex') || ($('stock-modal') && $('stock-modal').style.display === 'flex');
    if (blocked) return;
    var now = Date.now();
    if (e.key === 'Enter') {
      if (BC.buf.length >= 4 && BC.fast) {
        var code = BC.buf; BC.buf = '';
        var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { t.value = ''; if (t.id === 'srch') doSearch(''); }
        e.preventDefault(); e.stopPropagation(); handleScan(code); return;
      }
      var s = $('srch'); if (e.target === s && s.value.trim()) { var pf = findByCode(s.value); if (pf) { e.preventDefault(); handleScan(s.value); s.value = ''; doSearch(''); } }
      BC.buf = ''; return;
    }
    if (e.key.length === 1) {
      if (now - BC.last > 60) { BC.buf = ''; BC.fast = true; }
      BC.buf += e.key; BC.last = now;
    }
  }, true);

  // Camera scanner
  var CAM = { stream: null, timer: null, det: null, zx: null, lastCode: '', lastAt: 0 };
  window.openScanner = async function () {
    var m = $('scan-modal');
    if (!m) { m = document.createElement('div'); m.id = 'scan-modal'; m.style.cssText = 'position:fixed;inset:0;z-index:9400;display:none;align-items:center;justify-content:center;'; document.body.appendChild(m); }
    m.innerHTML = '<div class="scan-box"><div style="padding:16px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--b);"><div><div style="font-size:16px;font-weight:800;letter-spacing:-.02em;">📷 Scan barcode</div><div style="font-size:11px;color:var(--t3);margin-top:2px;">Point the camera at a product barcode</div></div><button onclick="closeScanner()" style="border:1.5px solid var(--b2);background:var(--s);padding:7px 14px;font-weight:800;font-size:12px;color:var(--t);">Done</button></div>'
      + '<div class="scan-view"><video id="scan-video" playsinline muted></video><i></i></div>'
      + '<div style="padding:14px 18px;"><div class="scan-mode" style="width:max-content;margin-bottom:10px;"><button id="sm-add" onclick="setScanMode(\'add\')">➕ Add to sale</button><button id="sm-check" onclick="setScanMode(\'check\')">🏷 Price check</button></div>'
      + '<div id="scan-msg" style="font-size:12px;color:var(--t2);">Starting camera…</div>'
      + '<div style="display:flex;gap:6px;margin-top:10px;"><input id="scan-manual" placeholder="Or type the barcode and press Enter" style="flex:1;padding:10px 12px;font-size:13px;" onkeydown="if(event.key===\'Enter\'){handleScan(this.value);this.value=\'\';}"></div></div></div>';
    m.style.display = 'flex'; refreshScanMode();
    try {
      CAM.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      var v = $('scan-video'); v.srcObject = CAM.stream; await v.play();
      if ('BarcodeDetector' in window) {
        var fmts = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code', 'data_matrix']; try { var sup = await BarcodeDetector.getSupportedFormats(); fmts = fmts.filter(function (f) { return sup.indexOf(f) > -1; }); } catch (e) {}
        CAM.det = new BarcodeDetector({ formats: fmts });
        $('scan-msg').textContent = 'Scanning… hold the barcode steady inside the box';
        CAM.timer = setInterval(async function () { try { var r = await CAM.det.detect(v); if (r && r[0]) camHit(r[0].rawValue); } catch (e) {} }, 220);
      } else { await loadZX(); startZX(v); }
    } catch (e) { $('scan-msg').innerHTML = '⚠️ Camera unavailable (' + esc(e.message || e.name) + '). Allow camera access in the browser, or type the barcode below. A USB/Bluetooth scanner works without the camera.'; }
  };
  function camHit(code) { var n = Date.now(); if (code === CAM.lastCode && n - CAM.lastAt < 1800) return; CAM.lastCode = code; CAM.lastAt = n; var ok = handleScan(code); var mm = $('scan-msg'); if (mm) mm.textContent = (ok ? '✓ ' : '✗ ') + code; }
  function loadZX() { return new Promise(function (res, rej) { if (window.ZXing) return res(); var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'; s.onload = res; s.onerror = function () { rej(new Error('Scanner library could not load')); }; document.head.appendChild(s); }); }
  function startZX(v) {
    $('scan-msg').textContent = 'Scanning… hold the barcode steady inside the box';
    var reader = new ZXing.BrowserMultiFormatReader(); CAM.zx = reader;
    CAM.timer = setInterval(async function () { try { var r = await reader.decodeFromVideoElement(v); if (r) camHit(r.getText()); } catch (e) {} }, 300);
  }
  window.closeScanner = function () {
    clearInterval(CAM.timer); CAM.timer = null;
    if (CAM.zx) { try { CAM.zx.reset(); } catch (e) {} CAM.zx = null; }
    if (CAM.stream) { CAM.stream.getTracks().forEach(function (t) { t.stop(); }); CAM.stream = null; }
    var m = $('scan-modal'); if (m) m.style.display = 'none';
  };

  /* ══════════════════ TERMINALS ══════════════════ */
  var PNAME = { paystack: 'Paystack Terminal', moniepoint: 'Moniepoint', opay: 'OPay', generic: 'Bank alert' };
  var PICON = { paystack: '🔷', moniepoint: '🟠', opay: '🟢', generic: '🏦' };
  var TERM = { loaded: false, p: {}, envKey: false, noEnc: false };
  function apiTerm(action, payload) { return termApi(action, Object.assign({ owner: OWNER() }, payload || {})); }

  window.loadTerminals = async function () {
    try {
      var r = await apiTerm('config'); TERM.p = r.providers || {}; TERM.envKey = !!(r.providers && r.providers.paystackEnvKey); TERM.noEnc = !!(r.providers && r.providers.noEncKey); TERM.loaded = true;
      // keep the legacy single-terminal field working
      if (TERM.p.paystack && TERM.p.paystack.cfg && TERM.p.paystack.cfg.terminalId) POS_CFG.terminalId = TERM.p.paystack.cfg.terminalId;
    } catch (e) { TERM.loaded = false; }
    return TERM;
  };
  function tinfo(id) {
    var d = TERM.p[id] || { cfg: {}, secretsSet: {} }, c = d.cfg || {}, s = d.secretsSet || {}, push = false, listen = false;
    if (id === 'paystack') { push = !!(c.terminalId && (s.secretKey || TERM.envKey)); listen = push; }
    if (id === 'moniepoint') { push = !!(c.serial && s.clientId && s.clientSecret); listen = push || !!s.webhookSecret; }
    if (id === 'opay') { push = !!(c.serial && c.headMerchantId && c.merchantId && s.privateKey && s.opayPublicKey && s.clientAuthKey); listen = push; }
    return { id: id, cfg: c, sec: s, enabled: !!c.enabled, push: push, listen: listen, name: c.label || PNAME[id], serial: c.serial || c.terminalId || '' };
  }
  function enabledTerms() { return ['paystack', 'moniepoint', 'opay'].map(tinfo).filter(function (t) { return t.enabled && (t.push || t.listen); }); }
  function genericOn() { var g = TERM.p.generic; return !!(g && g.cfg && g.cfg.enabled); }

  /* ── payment inbox (bank confirmations pushed by /api/webhook) ── */
  async function fetchInbox() {
    try { var r = await fetch(NSB() + '/payment_inbox.json?orderBy=%22%24key%22&limitToLast=40'); if (!r.ok) return []; var o = await r.json(); return o ? Object.keys(o).map(function (k) { return Object.assign({ _key: k }, o[k]); }) : []; } catch (e) { return []; }
  }
  function serialsOk(e) {
    if (!e.terminal) return true;
    var t = TERM.p[e.provider]; if (!t || !t.cfg || !t.cfg.serial) return true;
    return String(e.terminal).toLowerCase() === String(t.cfg.serial).toLowerCase();
  }
  function matchInbox(list, total, since) {
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      if (!e.success || e.claimedBy) continue;
      if (Math.round(Number(e.amount) * 100) !== Math.round(Number(total) * 100)) continue; // EXACT amount only
      if ((Number(e.at) || 0) < since - 120000) continue;
      if (!serialsOk(e)) continue;
      return e;
    }
    return null;
  }
  // claim with a conditional write so two cashiers/devices can never use one payment twice
  async function claimInbox(key, ref) {
    var url = NSB() + '/payment_inbox/' + encodeURIComponent(key) + '.json';
    var g = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' } }); var etag = g.headers.get('ETag'); var cur = await g.json();
    if (!cur || cur.claimedBy) return false;
    cur.claimedBy = ref; cur.claimedAt = new Date().toISOString();
    var h = { 'Content-Type': 'application/json' }; if (etag) h['if-match'] = etag;
    var p = await fetch(url, { method: 'PUT', headers: h, body: JSON.stringify(cur) });
    return p.ok;
  }

  function stepsBox(total, how) { return '<div class="payhint">' + how + '</div>'; }
  function waitUI(total, providerLabel, how) {
    return payHead(total) + stepsBox(total, how)
      + '<div class="paywait"><div class="vp-dot"></div><span id="trm-txt">Starting…</span></div>'
      + '<div class="progress-bar"><div class="progress-fill" id="trm-prog" style="width:6%"></div></div>'
      + '<div style="display:flex;gap:8px;margin-top:16px;"><button onclick="cardTermCancel(' + total + ')" style="flex:1;' + PMG + '">✕ Cancel</button></div>'
      + '<div style="text-align:center;margin-top:12px;"><a href="#" onclick="manualFallback(' + total + ');return false;" style="font-size:11px;color:var(--t3);text-decoration:underline;">Customer already paid but nothing happened? Record it manually</a></div>';
  }
  window.manualFallback = function (total) { stopTermPoll(); cardExternal(total); };

  /* method: 'card' | 'transfer'; providerId: terminal to push to (or null = just listen) */
  window.startTerminalPay = async function (providerId, total, method, skipPush) {
    stopTermPoll(); var sid = ++_termSession, since = Date.now(), t = providerId ? tinfo(providerId) : null;
    var ref = newRef('POS-' + (providerId ? providerId.slice(0, 3).toUpperCase() : 'WAIT')), email = (typeof cardEmail === 'function' ? cardEmail() : '') || '';
    var label = t ? t.name : 'bank';
    var willPush = !!(t && t.push && !skipPush);
    showPayModal((PICON[providerId] || '💳') + ' ' + (t ? t.name : 'Waiting for payment'), method === 'transfer' ? 'Customer pays by transfer' : 'Customer pays by card');
    var how = willPush ? 'The amount <b>' + fm(total) + '</b> is being sent to terminal <b>' + esc(t.serial) + '</b>. Customer taps / inserts the card' + (method === 'transfer' ? ' or chooses transfer' : '') + ' on the terminal.'
      : 'Type exactly <b>' + fm(total) + '</b> on the terminal' + (t ? ' (' + esc(t.name) + ')' : '') + ' and take the payment. The sale completes automatically the moment the bank confirms <b>exactly ' + fm(total) + '</b>.';
    setBody(waitUI(total, label, how));
    var handle = null;
    if (willPush) {
      try { var r = await apiTerm('push', { provider: providerId, amount: total, reference: ref, method: method, email: email, description: 'POS sale ' + ref }); if (sid !== _termSession) return; handle = r.handle || null; setTxt('Sent to terminal — waiting for customer…'); }
      catch (e) { if (sid !== _termSession) return; pushFailed(total, providerId, method, e); return; }
    } else setTxt('Listening for your bank’s confirmation…');
    var n = 0, max = 150, busy = false;
    _termPoll = setInterval(async function () {
      if (busy) return; busy = true; n++;
      try {
        if (sid !== _termSession) return;
        var win = null, via = '';
        if (handle) {
          var s = await apiTerm('status', { provider: providerId, reference: ref, amount: total, handle: handle });
          if (sid !== _termSession) return;
          if (s.paid) { win = { provider: providerId, amount: s.amount || total, channel: s.method || '', ref: ref }; via = 'push'; }
          else if (s.declined) { stopTermPoll(); cardError(total, 'The terminal reported the payment was declined or cancelled. Nothing was charged to the sale.'); return; }
          else if (s.mismatch) { stopTermPoll(); cardError(total, s.error || 'Amount collected does not match the sale total.'); return; }
          else setTxt(s.delivered ? 'Terminal ready — waiting for customer to pay…' : 'Waiting for the terminal to receive the amount…');
        }
        if (!win) {
          var m = matchInbox(await fetchInbox(), total, since);
          if (m && await claimInbox(m._key, ref)) { win = { provider: m.provider, amount: m.amount, channel: m.channel, ref: m.ref, inboxKey: m._key }; via = 'webhook'; }
        }
        if (win) {
          stopTermPoll(); setTxt('✅ Payment confirmed'); beep(true);
          closePayModal();
          await finalizeOrder(buildOrder(method === 'transfer' ? 'transfer' : 'card', {
            ref: ref, cardVia: (win.provider || providerId || 'bank') + '-terminal', terminal: PNAME[win.provider || providerId] || 'Bank', terminalSerial: t ? t.serial : '',
            bankRef: win.ref || '', actualChannel: win.channel || '', confirmedBy: via, verified: true, autoConfirmed: true, inboxKey: win.inboxKey || '', customerEmail: email, confirmedAt: new Date().toISOString()
          }));
          return;
        }
        var pr = $('trm-prog'); if (pr) pr.style.width = Math.min(95, 8 + n / max * 87) + '%';
      } catch (e) { /* transient — keep polling */ }
      finally { busy = false; }
      if (n >= max) { stopTermPoll(); cardError(total, 'No confirmation received after 6 minutes. If the customer already paid, check the terminal receipt / your bank app before charging again, then use “Record it manually”.'); }
    }, 2400);
  };
  function setTxt(t) { var e = $('trm-txt'); if (e) e.textContent = t; }
  function pushFailed(total, pid, method, e) {
    var t = tinfo(pid), listen = t.listen;
    setBody('<div style="text-align:center;padding:6px 0 12px;"><div style="font-size:36px;">⚠️</div><p style="font-size:13px;color:var(--rd);margin:8px 0;line-height:1.6;">' + esc(e.message || 'Could not reach the terminal') + '</p></div>'
      + (listen ? '<button class="optbtn live" onclick="startTerminalPay(\'' + pid + '\',' + total + ',\'' + method + '\',true)"><b>Type the amount on the terminal instead</b><small>We’ll still complete the sale automatically when the bank confirms exactly ' + fm(total) + '.</small></button>' : '')
      + '<div style="display:flex;gap:8px;">' + backBtn('← Other options', 'openCardModal(' + total + ')') + backBtn('Close', 'closePayModal()') + '</div>');
  }
  window.cardTermCancel = function (total) { stopTermPoll(); pToast('Cancelled — also cancel on the terminal screen', 'err'); openCardModal(total); };

  /* ── Card chooser ── */
  window.openCardModal = function (total) {
    stopTermPoll();
    showPayModal('💳 Card Payment', 'Choose how the customer will pay by card');
    var terms = enabledTerms(), h = payHead(total)
      + '<label style="' + PML + '">Customer email for receipt (optional)</label><input id="card-email" type="email" placeholder="customer@email.com" style="' + PMI + 'margin-bottom:12px;">';
    if (!terms.length) h += '<div class="payhint">No payment terminal is linked yet. Open <b>⚙ Settings → Payment terminals</b> to link Paystack, Moniepoint or OPay so card sales complete automatically.</div>';
    terms.forEach(function (t) {
      if (t.push) h += '<button class="optbtn live" onclick="startTerminalPay(\'' + t.id + '\',' + total + ',\'card\')"><b>' + PICON[t.id] + ' ' + esc(t.name) + ' — send to terminal</b><small>Pushes ' + fm(total) + ' to terminal ' + esc(t.serial) + '. Sale completes automatically once the card is approved.</small></button>';
      h += '<button class="optbtn" onclick="startTerminalPay(\'' + t.id + '\',' + total + ',\'card\',true)"><b>' + PICON[t.id] + ' ' + esc(t.name) + ' — I’ll type the amount on the machine</b><small>Enter exactly ' + fm(total) + ' on the terminal. We detect the approval and finish the sale for you.</small></button>';
    });
    h += '<button class="optbtn" onclick="cardExternal(' + total + ')"><b>🧾 Other card machine (manual)</b><small>Any bank POS — charge ' + fm(total) + ', then record the approval code.</small></button>'
      + '<button class="optbtn" onclick="cardOnline(' + total + ')"><b>🌐 Online card checkout</b><small>Customer types card details on Paystack’s secure page.</small></button>'
      + '<div style="display:flex;gap:8px;margin-top:4px;">' + backBtn('Cancel', 'closePayModal()') + '</div>';
    setBody(h);
  };

  /* ── Transfer ── */
  window.initTransferPayment = function (total) {
    stopTermPoll(); var terms = enabledTerms().filter(function (t) { return t.listen; });
    fetch(NSB() + '/settings/bank_account.json').then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (a) {
      a = a || {}; var bank = a.bank || a.bankName || '', acct = a.account || a.accountNumber || '', nm = a.name || a.accountName || L.getItem('qc_biz_name') || 'Your Business';
      var auto = terms.length > 0 || genericOn();
      showPayModal('🏦 Bank Transfer', auto ? 'Confirms automatically when the money lands' : 'Customer sends the exact amount');
      var h = '';
      if (acct) h += '<div class="transfer-info"><div class="acct-bank">' + esc(bank || 'Bank not set') + '</div><div class="acct-num">' + esc(acct) + '</div><div class="acct-name">' + esc(nm) + '</div><div class="acct-amount">' + fm(total) + '</div></div>';
      else h += payHead(total) + '<div class="payhint">No bank account saved. Add one in <b>⚙ Settings → Bank & transfer</b>, or use a terminal below to show a transfer account on the machine.</div>';
      terms.forEach(function (t) {
        if (t.id === 'moniepoint' && t.push) h += '<button class="optbtn live" onclick="startTerminalPay(\'moniepoint\',' + total + ',\'transfer\')"><b>🟠 Show transfer account on Moniepoint terminal</b><small>Customer scans / transfers on the terminal screen. Auto-confirmed.</small></button>';
        if (t.id === 'paystack' && t.push) h += '<button class="optbtn live" onclick="startTerminalPay(\'paystack\',' + total + ',\'transfer\')"><b>🔷 Send to Paystack terminal</b><small>Customer chooses “Bank transfer” on the terminal. Auto-confirmed.</small></button>';
        if (t.id === 'opay' && t.push) h += '<button class="optbtn live" onclick="startTerminalPay(\'opay\',' + total + ',\'transfer\')"><b>🟢 Send to OPay terminal</b><small>Customer pays on the terminal. Auto-confirmed.</small></button>';
      });
      if (auto) h += '<button class="optbtn live" onclick="listenTransfer(' + total + ')"><b>⚡ I’ve given the customer the account — wait for payment</b><small>We watch for a credit of exactly ' + fm(total) + ' and finish the sale instantly.</small></button>';
      var ref = newRef('POS-TRF');
      h += '<div style="background:rgba(245,200,66,.12);border:1px solid rgba(245,200,66,.35);border-radius:14px;padding:10px 12px;margin:6px 0 12px;font-size:11px;color:var(--t2);"><strong>Reference:</strong> ' + esc(ref) + '<br><small>Ask the customer to use this as the narration</small></div>'
        + '<details style="margin-bottom:12px;"><summary style="font-size:12px;font-weight:700;color:var(--t2);cursor:pointer;">Confirm manually (no bank auto-detect)</summary>'
        + '<div style="margin-top:10px;"><label style="' + PML + '">Sender name / session ID (optional)</label><input id="trf-note" type="text" placeholder="e.g. Chinedu O. / 2301…" style="' + PMI + 'margin-bottom:8px;"><p style="font-size:11px;color:var(--t3);margin-bottom:8px;">Only press confirm after the credit alert shows in your bank app.</p>'
        + '<button onclick="confirmTransfer(\'' + ref + '\',' + total + ')" style="width:100%;background:var(--gr);' + PMB + '">✓ Confirm Received</button></div></details>'
        + '<div style="display:flex;gap:8px;">' + backBtn('Cancel', 'closePayModal()') + '</div>';
      setBody(h);
    });
  };
  window.listenTransfer = function (total) { startTerminalPay(null, total, 'transfer', true); };

  /* receipt description */
  window.payDescOf = function (o) {
    if (o.payMethod === 'cash') return 'Cash';
    if (o.payMethod === 'card') { var v = o.autoConfirmed ? (o.terminal || 'Terminal') : (o.cardVia === 'external-pos' ? (o.terminal || 'POS') + (o.approvalCode ? ' · ' + o.approvalCode : '') : o.cardVia === 'paystack-terminal' ? 'Paystack POS' : 'Paystack'); return 'Card (' + v + ')'; }
    if (o.payMethod === 'transfer') return 'Bank Transfer' + (o.autoConfirmed && o.terminal ? ' (' + o.terminal + ')' : '');
    if (o.payMethod === 'split') return 'Cash ' + fm(o.cashPaid) + ' + ' + (o.otherMethod === 'transfer' ? 'Transfer ' : 'Card ') + fm(o.cardPaid);
    return o.payMethod;
  };

  /* ══════════════════ SETTINGS ══════════════════ */
  var RC = { header: '', address: '', phone: '', footer: 'Thank you for shopping with us!', paper: '80', autoPrint: true, logo: '', vatNote: '' };
  window.RCPT = RC;
  async function loadReceiptCfg() { try { var r = await fetch(NSB() + '/settings/receipt.json'); var d = await r.json(); if (d && typeof d === 'object') Object.assign(RC, d); } catch (e) {} applyPaper(); }
  function applyPaper() {
    var w = RC.paper === '58' ? '58mm' : RC.paper === 'a4' ? '190mm' : '80mm';
    document.documentElement.style.setProperty('--paper', w);
    var st = $('page-size-style'); if (!st) { st = document.createElement('style'); st.id = 'page-size-style'; document.head.appendChild(st); }
    st.textContent = '@media print{@page{size:' + (RC.paper === 'a4' ? 'A4' : w + ' auto') + ';margin:0}}';
  }
  window.loadReceiptCfg = loadReceiptCfg;

  var WEBHOOK = function (p) { return location.origin + '/api/webhook?p=' + p + '&o=' + encodeURIComponent(OWNER()); };
  function fld(id, label, val, o) {
    o = o || {}; var set = o.isSet ? '<span class="set">✓ saved</span>' : '';
    var input = o.area ? '<textarea id="' + id + '" placeholder="' + esc(o.ph || '') + '" spellcheck="false" autocomplete="off">' + esc(val || '') + '</textarea>' : '<input id="' + id + '" type="' + (o.secret ? 'password' : 'text') + '" autocomplete="off" value="' + esc(val || '') + '" placeholder="' + esc(o.isSet ? '•••••••• (leave blank to keep)' : (o.ph || '')) + '">';
    return '<div class="tf"><label>' + label + set + '</label>' + input + (o.help ? '<div class="help">' + o.help + '</div>' : '') + '</div>';
  }
  function urlRow(url) { return '<div class="tf"><label>Your webhook URL</label><div class="urlrow"><input readonly value="' + esc(url) + '" onclick="this.select()"><button onclick="copyTxt(this,\'' + esc(url) + '\')">Copy</button></div></div>'; }
  window.copyTxt = function (b, t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); }).catch(function () { prompt('Copy this:', t); }); };

  function termCard(id) {
    var t = tinfo(id), c = t.cfg, s = t.sec, body = '', sub = '', status = t.push ? 'READY' : (t.listen ? 'LISTEN ONLY' : 'NOT SET UP');
    if (id === 'paystack') {
      sub = 'Card, transfer, USSD & QR on a Paystack terminal';
      body = '<div class="tsteps"><b>Where to find these</b><br>1. Paystack Dashboard → <b>Settings → API Keys & Webhooks</b> → copy your <b>Live Secret Key</b> (sk_live_…).<br>2. Dashboard → <b>Terminals</b> → your terminal’s <b>ID</b>.<br>3. Optional (auto-detect when you type the amount on the machine): set the Live Webhook URL below. <b>Paystack allows only one webhook URL per account</b>, so skip this if something else already uses it — pushing from the POS works without it.</div>'
        + fld('tm-paystack-terminalId', 'Terminal ID', c.terminalId, { ph: 'e.g. 7895939016' })
        + fld('tm-paystack-secretKey', 'Secret key', '', { secret: true, ph: 'sk_live_…', isSet: s.secretKey || TERM.envKey, help: TERM.envKey && !s.secretKey ? 'Using the platform-wide PAYSTACK_SECRET_KEY. Save your own key here to use your own Paystack account.' : 'Stored encrypted on the server. It is never shown again.' })
        + urlRow(WEBHOOK('paystack'));
    }
    if (id === 'moniepoint') {
      sub = 'Push amount to terminal · card & POS transfer · auto-confirm';
      body = '<div class="tsteps"><b>Setup (Moniepoint business account)</b><br>1. <b>Settings → ERP Integration</b> → choose your ERP → <b>Create client</b>. Copy the <b>Client ID</b> and <b>Client Secret</b> (the secret is shown only once).<br>2. <b>POS terminal configuration → POS Terminal features</b> → switch on <b>ERP integration</b> (terminal app 1.7.2 or higher).<br>3. <b>Terminal serial</b>: printed on the back of the terminal (like P260…) or in the Moniepoint app.<br>4. Optional — auto-detect when you type the amount on the terminal: <b>Settings → POS App Developers → Webhooks</b> → add the URL below, tick Purchase / Transfer / Collection events, and paste the secret it generates (terminal app 1.11.0+).<br>Support: pos-integrations@moniepoint.com</div>'
        + fld('tm-moniepoint-serial', 'Terminal serial number', c.serial, { ph: 'P260…' })
        + fld('tm-moniepoint-clientId', 'Client ID', '', { secret: true, ph: 'from ERP Integration', isSet: s.clientId })
        + fld('tm-moniepoint-clientSecret', 'Client Secret', '', { secret: true, ph: 'from ERP Integration', isSet: s.clientSecret })
        + fld('tm-moniepoint-webhookSecret', 'Webhook secret (optional)', '', { secret: true, ph: 'from Webhooks page', isSet: s.webhookSecret })
        + urlRow(WEBHOOK('moniepoint'))
        + '<div class="tf"><label>Amount unit sent to the terminal</label><select id="tm-moniepoint-amountUnit"><option value="naira"' + (c.amountUnit !== 'kobo' ? ' selected' : '') + '>Naira (default)</option><option value="kobo"' + (c.amountUnit === 'kobo' ? ' selected' : '') + '>Kobo</option></select><div class="help">Do a ₦50 test sale first. If the terminal shows ₦0.50 or ₦5,000, switch this.</div></div>';
    }
    if (id === 'opay') {
      sub = 'OPay POS API — RSA-signed requests';
      body = '<div class="tsteps"><b>Setup (OPay Business dashboard, Super Admin)</b><br>1. <b>Developer Tools</b> → copy <b>Business ID</b>, <b>Branch ID</b> and your <b>Client Auth Key</b>.<br>2. Create an RSA key pair (<code>openssl genrsa -out private.pem 2048</code> then <code>openssl rsa -in private.pem -pubout -out public.pem</code>). Upload <b>public.pem</b> to OPay; paste <b>private.pem</b> below. Also paste <b>OPay’s public key</b> from the dashboard.<br>3. <b>Terminal SN</b> = the POS serial number. Ask OPay for your <b>subSceneEnum</b> value (their docs say to contact them) and that the POS API is enabled for your account.<br>4. Developer Tools → <b>“POS & Others”</b> → paste the webhook URL below.</div>'
        + fld('tm-opay-headMerchantId', 'Business ID (headMerchantId)', c.headMerchantId) + fld('tm-opay-merchantId', 'Branch ID (merchantId)', c.merchantId)
        + fld('tm-opay-serial', 'Terminal SN', c.serial) + fld('tm-opay-subScene', 'subSceneEnum (from OPay)', c.subScene, { ph: 'e.g. CASH_API' })
        + fld('tm-opay-clientAuthKey', 'Client Auth Key', '', { secret: true, isSet: s.clientAuthKey })
        + fld('tm-opay-privateKey', 'Your private key (PEM)', '', { area: true, ph: '-----BEGIN PRIVATE KEY-----…', isSet: s.privateKey })
        + fld('tm-opay-opayPublicKey', 'OPay public key (PEM)', '', { area: true, ph: '-----BEGIN PUBLIC KEY-----…', isSet: s.opayPublicKey })
        + urlRow(WEBHOOK('opay'));
    }
    return '<div class="tcard' + (c.enabled ? ' on' : '') + '" id="tc-' + id + '"><div class="tcard-hd" onclick="this.parentNode.classList.toggle(\'open\')"><div style="font-size:24px">' + PICON[id] + '</div><div><b>' + PNAME[id] + '</b><small>' + sub + '</small></div><span class="badge' + (t.push ? ' ok' : '') + '">' + status + '</span></div>'
      + '<div class="tcard-bd"><div class="tf" style="display:flex;align-items:center;gap:10px;"><label style="margin:0;flex:1;">Enable on this POS</label><input type="checkbox" id="tm-' + id + '-enabled" ' + (c.enabled ? 'checked' : '') + ' style="width:22px;height:22px;"></div>'
      + fld('tm-' + id + '-label', 'Nickname (optional)', c.label, { ph: PNAME[id] }) + body
      + '<div class="tact"><button class="btn-test" onclick="testTerm(\'' + id + '\')">Test</button><button class="btn-save" onclick="saveTerm(\'' + id + '\')">Save ' + PNAME[id] + '</button></div></div></div>';
  }
  function genericCard() {
    var g = TERM.p.generic || { cfg: {}, secretsSet: {} }, on = !!(g.cfg && g.cfg.enabled);
    return '<div class="tcard' + (on ? ' on' : '') + '" id="tc-generic"><div class="tcard-hd" onclick="this.parentNode.classList.toggle(\'open\')"><div style="font-size:24px">🏦</div><div><b>Any other bank (PalmPay, Kuda, GTBank…)</b><small>Auto-confirm transfers from any bank-alert webhook</small></div><span class="badge' + (on ? ' ok' : '') + '">' + (on ? 'ACTIVE' : 'OFF') + '</span></div>'
      + '<div class="tcard-bd"><div class="tsteps"><b>How this works</b><br>PalmPay, Kuda and most banks do <b>not</b> publish an API to push amounts to their terminals. What <i>does</i> work is a credit-alert webhook: anything that can send an HTTP POST when money arrives (your bank’s business API, Monnify / Paystack virtual accounts, Zapier, Make, n8n, an alert-forwarding app…) can notify the POS.<br>Send a POST to the URL below with header <code>x-qc-secret: &lt;your secret&gt;</code> and JSON <code>{"amount": 5000, "reference": "optional", "status": "success"}</code>. Sales complete when the amount matches exactly.</div>'
      + urlRow(WEBHOOK('generic'))
      + '<div class="tf"><label>Secret' + (g.secretsSet && g.secretsSet.webhookSecret ? '<span class="set">✓ set</span>' : '') + '</label><div class="urlrow"><input id="tm-generic-token" readonly placeholder="Press Generate — shown only once"><button onclick="genToken()">Generate</button></div><div class="help">Generating a new secret replaces the old one.</div></div></div></div>';
  }
  window.genToken = async function () {
    try { var r = await apiTerm('newGenericToken'); $('tm-generic-token').value = r.token; $('tm-generic-token').select(); pToast('Secret generated — copy it now', 'ok'); await loadTerminals(); }
    catch (e) { pToast('❌ ' + e.message, 'err'); }
  };
  function readTerm(id) {
    var g = function (f) { var e = $('tm-' + id + '-' + f); return e ? (e.type === 'checkbox' ? e.checked : e.value) : undefined; };
    var pubF = { paystack: ['terminalId', 'label'], moniepoint: ['serial', 'label', 'amountUnit'], opay: ['serial', 'label', 'headMerchantId', 'merchantId', 'subScene'] }[id], secF = { paystack: ['secretKey'], moniepoint: ['clientId', 'clientSecret', 'webhookSecret'], opay: ['privateKey', 'opayPublicKey', 'clientAuthKey'] }[id];
    var cfg = { enabled: !!g('enabled') }, secrets = {}; pubF.forEach(function (f) { cfg[f] = g(f); }); secF.forEach(function (f) { secrets[f] = g(f); });
    return { cfg: cfg, secrets: secrets };
  }
  window.saveTerm = async function (id) {
    var d = readTerm(id);
    try { await apiTerm('save', { provider: id, cfg: d.cfg, secrets: d.secrets }); pToast('✅ ' + PNAME[id] + ' saved', 'ok'); await loadTerminals(); renderTerminals(id); }
    catch (e) { pToast('❌ ' + e.message, 'err'); }
  };
  window.testTerm = async function (id) {
    try { await saveTermQuiet(id); var r = await apiTerm('test', { provider: id }); pToast((r.ok ? '✅ ' : '⚠️ ') + (r.message || r.error || (r.ok ? 'OK' : 'Failed')), r.ok ? 'ok' : 'err'); }
    catch (e) { pToast('❌ ' + e.message, 'err'); }
  };
  async function saveTermQuiet(id) { var d = readTerm(id); await apiTerm('save', { provider: id, cfg: d.cfg, secrets: d.secrets }); await loadTerminals(); }
  function renderTerminals(openId) {
    var box = $('terminals-box'); if (!box) return;
    var warn = TERM.noEnc ? '<div class="payhint"><b>One-time server setup needed:</b> add an environment variable <code>QC_ENC_KEY</code> (any long random text) in Vercel → Settings → Environment Variables, then redeploy. It encrypts your bank keys. Until then keys cannot be saved.</div>' : '';
    box.innerHTML = warn + ['paystack', 'moniepoint', 'opay'].map(termCard).join('') + genericCard();
    if (openId) { var el = $('tc-' + openId); if (el) el.classList.add('open'); }
  }

  window.setTab = function (t) {
    ['pay', 'bank', 'receipt', 'scan'].forEach(function (k) { var p = $('st-' + k), b = $('stb-' + k); if (p) p.style.display = k === t ? 'block' : 'none'; if (b) b.classList.toggle('on', k === t); });
  };
  window.openPosSettings = async function () {
    if (window.qcCanPosSettings && !window.qcCanPosSettings()) { alert('Only the store owner or an Admin can change POS settings.'); return; }
    $('pos-settings-modal').style.display = 'flex'; setTab('pay');
    $('terminals-box').innerHTML = '<div style="padding:24px;text-align:center;color:var(--t3);">Loading…</div>';
    await loadTerminals(); renderTerminals();
    try {
      var ns = NSB();
      var res = await Promise.all([fetch(ns + '/settings/paystack_key.json').then(function (r) { return r.json(); }).catch(function () { return null; }), fetch(ns + '/settings/bank_account.json').then(function (r) { return r.json(); }).catch(function () { return null; }), fetch(ns + '/settings/local_providers.json').then(function (r) { return r.json(); }).catch(function () { return null; })]);
      if (res[0] && typeof res[0] === 'string') $('ps-ps-key').value = res[0];
      try { var lk = await fetch(ns + '/settings/paystack_locked.json').then(function (r) { return r.json(); }); var kf = $('ps-ps-key'); if (lk === true && kf) { kf.disabled = true; kf.title = 'Locked. Change it in Admin > Settings.'; } } catch (e) {}
      var b = res[1]; if (b) { $('ps-bank-name').value = b.bank || b.bankName || ''; $('ps-bank-acct').value = b.account || b.accountNumber || ''; $('ps-bank-aname').value = b.name || b.accountName || ''; }
      renderLocalProvidersForm(res[2] || {});
    } catch (e) {}
    await loadReceiptCfg();
    $('rc-address').value = RC.address || ''; $('rc-phone').value = RC.phone || ''; $('rc-header').value = RC.header || ''; $('rc-footer').value = RC.footer || ''; $('rc-paper').value = RC.paper || '80'; $('rc-auto').checked = !!RC.autoPrint; $('rc-vat').value = RC.vatNote || '';
    $('rc-logo-prev').innerHTML = RC.logo ? '<img src="' + RC.logo + '" style="max-height:48px;filter:grayscale(1)">' : '<span style="color:var(--t3);font-size:11px;">No logo</span>';
    $('sc-sound').checked = BC.sound; $('sc-mode').value = BC.mode;
  };
  window.savePosSettings = async function () {
    if (window.qcCanPosSettings && !window.qcCanPosSettings()) { alert('Only the store owner or an Admin can change POS settings.'); return; }
    var ns = NSB(), H = { 'Content-Type': 'application/json' };
    var bank = { bank: $('ps-bank-name').value.trim(), account: $('ps-bank-acct').value.trim(), name: $('ps-bank-aname').value.trim() }, lp = {};
    bank.bankName = bank.bank; bank.accountNumber = bank.account; bank.accountName = bank.name;
    LOCAL_PROVIDERS_LIST.forEach(function (k) { var btn = $('lp-toggle-' + k); lp[k] = { enabled: !!btn && btn.textContent.trim() === 'ON', account: ($('lp-acct-' + k) || {}).value || '', name: ($('lp-name-' + k) || {}).value || '' }; });
    RC.address = $('rc-address').value.trim(); RC.phone = $('rc-phone').value.trim(); RC.header = $('rc-header').value.trim(); RC.footer = $('rc-footer').value.trim(); RC.paper = $('rc-paper').value; RC.autoPrint = $('rc-auto').checked; RC.vatNote = $('rc-vat').value.trim();
    BC.sound = $('sc-sound').checked; BC.mode = $('sc-mode').value; L.setItem('qc_scan_sound', BC.sound ? '1' : '0'); L.setItem('qc_scan_mode', BC.mode);
    var psKey = $('ps-ps-key').value.trim();
    try {
      var saves = [fetch(ns + '/settings/bank_account.json', { method: 'PUT', headers: H, body: JSON.stringify(bank) }), fetch(ns + '/settings/local_providers.json', { method: 'PUT', headers: H, body: JSON.stringify(lp) }), fetch(ns + '/settings/receipt.json', { method: 'PUT', headers: H, body: JSON.stringify(RC) })];
      if (psKey && !$('ps-ps-key').disabled) saves.push(fetch(ns + '/settings/paystack_key.json', { method: 'PUT', headers: H, body: JSON.stringify(psKey) }));
      var rs = await Promise.all(saves); if (rs.some(function (r) { return !r.ok; })) throw new Error('save');
      if (psKey) PAYSTACK_PUB_KEY = psKey;
      applyPaper(); refreshScanMode(); pToast('✅ Settings saved', 'ok'); $('pos-settings-modal').style.display = 'none'; loadLocalPayProviders();
    } catch (e) { pToast('Failed to save settings', 'err'); }
  };
  window.pickLogo = function (inp) {
    var f = inp.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function (e) { var im = new Image(); im.onload = function () { var w = Math.min(320, im.width), h = Math.round(im.height * w / im.width), c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h); RC.logo = c.toDataURL('image/png'); $('rc-logo-prev').innerHTML = '<img src="' + RC.logo + '" style="max-height:48px;filter:grayscale(1)">'; }; im.src = e.target.result; };
    rd.readAsDataURL(f); inp.value = '';
  };
  window.clearLogo = function () { RC.logo = ''; $('rc-logo-prev').innerHTML = '<span style="color:var(--t3);font-size:11px;">No logo</span>'; };
  window.testTerminal = function () { testTerm('paystack'); };

  /* ══════════════════ RECEIPT ══════════════════ */
  window.showReceipt = function (o) {
    var biz = L.getItem('qc_biz_name') || 'QuickCart Store', now = new Date(o.createdAt || Date.now());
    var sub = o.items.reduce(function (s, i) { return s + i.price * i.qty; }, 0), qtyN = o.items.reduce(function (s, i) { return s + i.qty; }, 0);
    var h = (RC.logo ? '<img class="r-logoimg" src="' + RC.logo + '" alt="">' : '') + '<div class="r-logo">' + esc(biz) + '</div>'
      + (RC.address ? '<div class="r-sub" style="margin-bottom:2px;">' + esc(RC.address) + '</div>' : '') + (RC.phone ? '<div class="r-sub" style="margin-bottom:2px;">Tel: ' + esc(RC.phone) + '</div>' : '') + (RC.header ? '<div class="r-sub" style="margin-bottom:2px;">' + esc(RC.header) + '</div>' : '')
      + '<div class="r-div"></div><div style="font-size:10px;color:#444;line-height:1.6;">Receipt: <b>' + esc(o.ref) + '</b><br>Date: ' + now.toLocaleString('en-NG') + '<br>Cashier: ' + esc(o.cashier || '') + '</div><div class="r-div"></div>'
      + o.items.map(function (it) { return '<div class="r-item"><span class="n">' + esc(it.name) + '<br><small style="color:#666">' + it.qty + ' × ' + fm(it.price) + '</small></span><span>' + fm(it.price * it.qty) + '</span></div>'; }).join('')
      + '<div class="r-div"></div><div class="r-totals">'
      + '<div class="r-trow" style="font-weight:400;font-size:11px;color:#444;"><span>Items (' + qtyN + ')</span><span>' + fm(sub) + '</span></div>'
      + (o.discount ? '<div class="r-trow" style="font-weight:400;font-size:11px;color:#444;"><span>Discount</span><span>−' + fm(o.discount) + '</span></div>' : '')
      + '<div class="r-trow" style="font-size:15px;"><span>TOTAL</span><span>' + fm(o.total) + '</span></div>'
      + '<div class="r-trow" style="font-weight:400;font-size:11px;color:#444;"><span>Paid by</span><span>' + esc(payDescOf(o)) + '</span></div>'
      + (o.tendered && o.payMethod === 'cash' ? '<div class="r-trow" style="font-weight:400;font-size:11px;color:#444;"><span>Tendered</span><span>' + fm(o.tendered) + '</span></div>' : '')
      + (o.change > 0 ? '<div class="r-trow"><span>CHANGE</span><span>' + fm(o.change) + '</span></div>' : '')
      + (o.autoConfirmed ? '<div class="r-trow" style="font-weight:400;font-size:10px;color:#444;"><span>Bank confirmed</span><span>✓ ' + esc(o.bankRef || o.terminal || '') + '</span></div>' : '')
      + (o.approvalCode ? '<div class="r-trow" style="font-weight:400;font-size:10px;color:#444;"><span>Approval code</span><span>' + esc(o.approvalCode) + '</span></div>' : '')
      + '</div>' + (RC.vatNote ? '<div class="r-sub" style="margin-top:8px;">' + esc(RC.vatNote) + '</div>' : '')
      + '<div class="r-thank">' + esc(RC.footer || 'Thank you!') + '<br><small style="font-size:9px;font-weight:400;color:#888;">Powered by QuickCart POS</small></div>';
    $('recin').innerHTML = h; $('recov').classList.add('open'); applyPaper();
    var pb = document.querySelector('.r-print'); if (pb) pb.onclick = function () { window.print(); };
    if (RC.autoPrint && !o._noPrint) setTimeout(function () { window.print(); }, 450);
  };

  /* ══════════════════ boot ══════════════════ */
  window.addEventListener('DOMContentLoaded', function () {
    refreshScanMode(); loadTerminals(); loadReceiptCfg();
  });
})();
