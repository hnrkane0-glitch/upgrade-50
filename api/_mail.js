// QuickCart — tiny transactional-email helper (no dependencies).
// Supports Resend (recommended) or Brevo. Set ONE of these in Vercel → Settings → Environment Variables:
//   RESEND_API_KEY   (re_...)       https://resend.com  → API Keys
//   BREVO_API_KEY    (xkeysib-...)  https://brevo.com   → SMTP & API → API Keys
//   MAIL_FROM        e.g.  QuickCart <no-reply@yourdomain.com>   (the domain must be verified at the provider)
//   APP_URL          e.g.  https://quickcart.ng                  (the address used inside reset links)
function parseFrom(from) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from || '');
  return m ? { name: m[1].replace(/^"|"$/g, '') || 'QuickCart', email: m[2] } : { name: 'QuickCart', email: (from || '').trim() };
}
function configured() {
  return !!((process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) && process.env.MAIL_FROM);
}
async function sendMail({ to, subject, html, text }) {
  const from = process.env.MAIL_FROM;
  if (!configured()) { const e = new Error('Email is not configured'); e.code = 'mail_not_configured'; throw e; }
  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || ('Resend error ' + r.status)); e.code = 'mail_failed'; e.detail = j; throw e; }
    return j;
  }
  const f = parseFrom(from);
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: f, to: [{ email: to }], subject, htmlContent: html, textContent: text })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || ('Brevo error ' + r.status)); e.code = 'mail_failed'; e.detail = j; throw e; }
  return j;
}
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Branded (orange + navy) email shell
function shell(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f6f8fd;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#0a1f44">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fd;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(10,31,68,.12)">
<tr><td style="background:#0a1f44;padding:26px 32px"><span style="font-size:24px;font-weight:800;letter-spacing:-.03em;color:#fff">Quick<span style="color:#ff5a1f">Cart</span></span></td></tr>
<tr><td style="padding:34px 32px 30px"><h1 style="margin:0 0 14px;font-size:24px;letter-spacing:-.03em;color:#0a1f44">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:18px 32px 26px;border-top:1px solid #e3e9f5;font-size:12px;color:#7a88a8">Sent by QuickCart · Nigeria's smart commerce platform</td></tr>
</table></td></tr></table></body></html>`;
}
module.exports = { sendMail, configured, shell, esc };
