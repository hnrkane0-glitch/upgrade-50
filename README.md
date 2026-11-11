# QuickCart — deploy guide

1. Upload this whole folder to Vercel (or `vercel --prod`). No build step.
2. **Card terminal (one-time):** Vercel → Project → Settings → Environment Variables →
   add `PAYSTACK_SECRET_KEY` = your `sk_live_…` key, then redeploy.
3. In the POS → ⚙ Settings, paste your **Paystack Terminal ID** and press **Test**.
   Also fill in the bank-transfer account and any OPay/Kuda/Moniepoint/PalmPay accounts.
4. POS card options: Paystack terminal (amount is pushed to the device), external card machine
   (record the approval code), or online Paystack checkout.

Notes
- Customers visiting `…/store?store=<owner>` see only the shop — no login/admin/subscribe/editor links.
- Staff never see the Page Editor (hidden in the dashboard, blocked in the router and in page-editor.html).
- Stock is deducted with Firebase atomic increments, so POS and online sales can't overwrite each other.
- Stock Count: start (all/one category, optional blind count) → scan/type quantities → Finalize applies only the differences.

## Custom domains (new)
Owners connect their own domain in the dashboard → **🌐 Domain & Store Link**. Their customer link
(`/store?store=<owner>`) is shown there and on the Dashboard; once a custom domain is connected, that domain becomes the shared link.

One-time setup so domains attach automatically (otherwise you must add each domain in Vercel yourself):
- Vercel → Account → Tokens → create a token → add env var `VERCEL_API_TOKEN`
- Add `VERCEL_PROJECT_ID` (Project → Settings → General). Add `VERCEL_TEAM_ID` only if the project is under a team. Redeploy.

How it works: the domain is saved in Firebase (`/domains/<domain>` → owner). When someone opens the site on a
non-QuickCart hostname, `index.html` looks that host up and loads the matching owner's store.
Owners add an **A record `@ → 76.76.21.21`** (root domain) or a **CNAME → `cname.vercel-dns.com`** (www/subdomain) at their registrar.
Platform hostnames are listed in `isPlatformHost()` in index.html — change `quickcart.ng` there if your main domain differs.

## New in this version
- **Owner stores** (`/store?store=<owner>` or their custom domain) now use `shop.html`, a React storefront with the owner's business name,
  their own products only (empty until they add some), cart, checkout (card via the owner's Paystack key, bank transfer, WhatsApp order),
  stock deduction and orders saved to the owner's own database. `store.html` remains the platform's own deal site (`/store` with no owner).
- **Router bug fixed:** `index.html` used to rewrite the URL to `/store` before reading `?store=`, so every owner link opened the base store.
- **Page editor** now edits `shop.html`.
- **UI:** `landing.html` (React), the admin dashboard home (React) and an admin theme (`assets/admin-theme.css`).
- **React sources** are in `_src/` (`cd _src && npm i && npm run build`). The built files in `assets/` are already included — no build step on Vercel.

---

## v17 — POS terminals, products, orders, inventory, stock count, Store Builder

### One-time server setup (required for bank terminals)
Add in **Vercel → Settings → Environment Variables**, then redeploy:

| Variable | Required | Purpose |
|---|---|---|
| `QC_ENC_KEY` | **Yes** | Any long random string (32+ chars). Encrypts every owner's bank keys (AES-256-GCM) before they are stored. Bank secrets are write-only: the browser can never read them back. **Do not change it later** or saved keys become unreadable. |
| `PAYSTACK_SECRET_KEY` | Optional | Platform-wide fallback; owners can save their own key in POS Settings instead. |

`npm install` runs automatically on Vercel (adds `node-forge`, used for OPay's RSA).

### Payment terminals (POS → ⚙ Settings → Payment terminals)
| Bank | What the owner enters | Push amount to terminal | Auto-detect when cashier types the amount |
|---|---|---|---|
| **Paystack Terminal** | Secret key, Terminal ID | ✅ | ✅ via webhook (Paystack allows only one webhook URL per account) |
| **Moniepoint** | ERP Integration Client ID + Secret, terminal serial, (webhook secret) | ✅ card & POS-transfer | ✅ via signed webhook |
| **OPay** | Business ID, Branch ID, Client Auth Key, your RSA private key, OPay public key, terminal SN, subSceneEnum | ✅ | ✅ via RSA-signed webhook |
| **Any other bank** (PalmPay, Kuda…) | – | ❌ (no public API) | ✅ via generic credit-alert webhook (`x-qc-secret` header + `{"amount":5000}`) |

Webhook URL for each bank (shown ready to copy in Settings): `https://YOUR-SITE/api/webhook?p=<provider>&o=<owner>`

**How a sale auto-completes:** POS creates a pending payment → the bank (push status poll *or* webhook) reports a successful payment of the **exact amount** → the payment is atomically *claimed* (so one transfer can never pay two sales) → sale is marked paid, stock deducted, receipt auto-printed. A payment older than the sale, for a different amount, or from a different terminal serial is ignored.

### Barcode scanning
USB/Bluetooth scanners work with no setup (they type fast then press Enter). Camera scanning via 📷 (Chrome/Android use the built-in detector; others load a small decoder). Products match on Barcode, SKU or name. Modes: **Add** (adds to sale and flashes the price) or **Price check**.

### Products
Fixed: images, barcode, SKU, cost, description, unit, VAT and reorder point were never saved. Images are compressed in the browser (list thumbnail on the product, extra photos in `product_gallery/<id>`). New: EAN-13 generator, barcode preview, label printing, duplicate-barcode guard, and a smart **Import** (CSV / Excel / JSON / TSV / pasted rows — columns detected automatically, update-by-barcode/SKU/name).

### Orders
Click any order → Approve payment, Decline, Processing → Shipped → Delivered, Cancel, Refund (full/partial), notes, timeline, WhatsApp/call/email, print invoice. Declining/cancelling/refunding **restocks** items (once only).

### Inventory & Stock Count
Inventory: working filters, stock value, days-of-cover, slow movers, expiry, **Receive stock** (GRN), adjustments with reasons, reorder suggestions, full movement ledger. Stock Count: count types (full/category/high-value/low/stale/spot-check), blind mode, camera/USB scanning, count sheets, reasons, recount, approval above a threshold, accuracy %. **Fixed:** sales made while counting were previously deducted twice.

### Store Builder (`/store-builder`, Dashboard → Store → Store Builder)
Logo, theme/fonts, banner slider, announcement bar, unlimited categories (with pictures), 14 section types (text, image, image+text, banner, featured products, gallery, reviews, FAQ, video, contact, CTA, spacer…), menu, footer & socials, SEO, live preview (click a block to edit), undo/redo, publish. Saved at `settings/store_design`. Rebuild the storefront after editing `_src`: `cd _src && npm i && npm run build`.

### Known limits
* The Firebase database rules are still fully open (as before). Bank secrets are encrypted, but anyone who knows an owner's username could call the terminal API for that owner. Add authentication/rules before handling real volume.
* Bank adapters follow each provider's published docs but could only be tested against simulated responses. **Do a ₦50 test sale per terminal first.** Moniepoint: if the terminal shows the wrong amount, flip "Amount unit" (naira/kobo). OPay: confirm the `subSceneEnum` value with OPay.
* Receipts print through the browser; use Chrome `--kiosk-printing` for silent one-tap thermal printing.

## Online card payments with Moniepoint (Monnify) and OPay (v18.3)
Stores without Paystack can take card payments through their own **Moniepoint/Monnify** or **OPay merchant** account.
Customers are sent to the provider's secure page, pay by card, and come back; the server then confirms the payment
with the provider before the order is marked paid and stock is deducted.

Setup (one time, on Vercel): add env var `QC_ENC_KEY` (any long random text, 16+ chars) and redeploy.
(Optional) `QC_ADMIN_PASSWORD` lets the platform "admin" account save its own keys.

Per store owner: Admin → Settings → **Moniepoint & OPay card payments** → paste keys → Save, then tick the provider in
**Checkout Options** and save.
- Moniepoint: API Key, Secret Key, Contract Code (monnify.com → Developers). Live base `api.monnify.com`, test `sandbox.monnify.com`.
- OPay: Merchant ID, Public Key, Secret Key (OPay merchant dashboard → Settings → API Keys). Live `liveapi.opaycheckout.com`, test `testapi.opaycheckout.com`.

Files: `api/checkout.js` (server), storefront in `assets/shop.js` / `_src/src/shop.jsx`, router passes `?qc_pay=` through `index.html`.
Known limits: payment is confirmed when the customer returns to the store (no webhook yet) — an order whose customer
closes the tab after paying stays "awaiting_payment" until it is re-checked. Monnify may ask for your server IP to be whitelisted
(Vercel has no fixed IP by default).

## Free QuickCart address (`name.quickcart.com`)
Owners open Admin → **🌐 Domain & Store Link** → **Use QuickCart Domain**, type a name and press the button. Their store is then served at
`name.quickcart.com` (3–30 letters/numbers/hyphens; reserved names like www, app, api, admin are blocked; names are first-come, unique).
It becomes their share link unless a custom domain is connected (custom domain wins).
Stored at `/domains/<name,quickcart,com>` (same lookup `index.html` already uses for custom domains) and `/qc_sub_by_owner/<owner>`.

One-time setup: add `quickcart.com` **and** `*.quickcart.com` to the Vercel project and point wildcard DNS at Vercel
(wildcard domains need Vercel nameservers, or an `A * → 76.76.21.21` record). The base domain is `QC_BASE_DOMAIN` in admin.html and `isPlatformHost()` in index.html.

## Growth Advisor (replaces the AI Scraper)
The AI Scraper, AI Auto-Listing and the `api/scrape.js` / `api/ai-listing.js` endpoints are removed (no `ANTHROPIC_API_KEY` needed any more).
**Admin → Growth Advisor** reads the owner's own orders and stock and turns them into actions. Nothing leaves the browser, no API key:
- **Restock radar:** sales speed per product vs. stock, days until it runs out, suggested order quantity (supplier lead time + cover goal are adjustable), cost estimate, CSV and a copy-ready supplier message.
- **Pricing fixes:** selling products below your target margin (or below cost) with a suggested shop-friendly price and the extra monthly profit. One click applies it.
- **Dead stock:** products with no sales for 60+ days, cash tied up, suggested clearance price. One click starts the sale (old price shown crossed out).
- **What pays the bills:** A/B/C ranking of products by revenue. **When customers buy:** day/hour heatmap.
- **Customers:** repeat rate, top customers and a WhatsApp win-back list with a ready message.
Files: `assets/admin-advisor.js` (logic), panel `p-advisor` in `admin.html`, styles in `assets/admin-theme.css`.
Costs must be set on products (Cost Price) for profit and pricing advice. Counted orders exclude cancelled, declined, refunded and unpaid ones.
**Bulk Import** (Admin → Bulk Import) keeps the JSON import and the admin-only "Seed Fresh Deals".

## New design (Geist)
The whole UI now follows Vercel's Geist design language with GitHub-style controls: Geist Sans/Mono (Google Fonts), white/gray ramp with 1px borders,
6px controls / 8-12px cards, black primary buttons, blue focus ring, sentence-case labels and stroke SVG icons instead of emoji.
- `assets/admin-theme.css` (admin), `assets/pos-theme.css` (POS), `assets/geist-landing.css` (landing), `assets/geist-pages.css` (platform store, payment, store builder, page editor, submit)
- `assets/geist-icons.js` swaps emoji for SVG icons everywhere (also for text added later) and fills `<i data-ico="name">`.
- Owner storefronts (`shop.html`, `assets/shop.*`) are intentionally unchanged: they use each owner's own Store Builder branding.
- `_src/src/landing.jsx` content was updated to match; the landing bundle `assets/landing.js` was patched directly (rebuild with `cd _src && npm i && npm run build` if you edit the source).


---
## v46 — Orange & Navy rebrand, React POS, real password-reset emails

**Password reset (now actually sends email).** The old flow only opened a `mailto:` link. Now:
`landing.html` -> `POST /api/forgot-password` -> email with one-time link -> `/reset-password` page -> `POST /api/reset-password`.
Links expire in 1 hour, work once, tokens are stored hashed, 60s resend cooldown, unknown emails get the same answer.
**You must set the env vars in `.env.example`** (a Resend or Brevo key + a verified sender domain) or the form will say email isn't set up.
Tip: with Resend you can only send to your own address until your domain is verified.

**New files:** `assets/qc-brand.css` (tokens, fonts, animated icons), `qc-fx.js` (ripple, magnetic buttons, flow bar),
`pos-react.css` + `pos.js` (React POS; source `_src/src/pos.jsx`, build with `cd _src && node build.mjs pos`),
`landing-brand.css`, `admin-brand.css`, `shop-brand.css`, `reset-password.html`, `api/forgot-password.js`, `api/reset-password.js`, `api/_mail.js`.
Fonts: Bricolage Grotesque (headings), Plus Jakarta Sans (text), JetBrains Mono (numbers).

---
## v47 — POS checkout redesign, solid POS Settings, owner account on the new storefront
- **POS right panel:** shows only the sale items (full-height, scrolls on its own) + totals + one **Checkout** button.
- **Checkout screen** (`#co-modal` in `pos.html`): order summary, discount, then Cash / Card / Transfer / Split and any enabled OPay/Kuda/Moniepoint/PalmPay accounts. "Pay ₦X with …" continues into the existing payment flows.
- **POS Settings:** solid card on a dark scrim; tabs, fields, terminal cards and switches are now styled (previously unstyled and transparent). Styles are in `assets/pos-react.css` (v47 section).
- **Owner (`admin`) account now uses the new storefront** (`shop.html`) like every other store: `index.html` routes `/store` to `shop.html` (bare `/store` = `?store=admin`), dashboard "view store" links use `/store?store=admin`. `store.html` is no longer served.
