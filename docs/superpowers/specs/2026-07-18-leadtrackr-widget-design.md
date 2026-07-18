# LeadTrackr Website Widget — Design Spec (MVP)

**Date:** 2026-07-18
**Status:** Approved routes: A1 (vanilla TS + Shadow DOM), B2 (Cloudflare Worker endpoint), C1 (inline config), distribution via GitHub + jsDelivr.
**Owner:** Lester (YesWeTrack / LeadTrackr). MVP built standalone; later handed off to the LeadTrackr dev to integrate as a native lead source in app.leadtrackr.io.

## 1. Goal

A lightweight lead-generation widget (functionally inspired by Futy.io, visually 100% LeadTrackr) that clients install with one script tag. It sits bottom-right, offers three contact channels, and sends every lead — enriched with attribution data — to LeadTrackr.

Explicit non-goals (MVP): WhatsApp channel, chat/bot conversations, video, appointment booking, A/B testing, hosted config UI, multi-language beyond NL defaults.

## 2. Architecture

```
client website
  <script src="https://cdn.jsdelivr.net/gh/<org>/leadtrackr-widget@1/dist/lt-widget.min.js"
          data-key="SITE_KEY" async></script>
        │
        ▼
  single IIFE bundle (~10–15 KB gzip, no dependencies)
        ├── UI layer: Shadow DOM root, launcher → panel → channel views
        ├── attribution module: URL params → localStorage (first/last touch)
        ├── dataLayer module: pushes ltw_* events
        └── transport: POST lead JSON → Cloudflare Worker
                                            │
                                            ▼
                              worker validates + forwards to
                              configurable webhook (env var).
                              Later: dev repoints it to the
                              app.leadtrackr.io lead-source API.
```

- **Shadow DOM** (`mode: 'open'`) gives iframe-grade CSS isolation both ways without an iframe; `tel:` links, dataLayer and attribution all work natively because the widget lives in the page DOM.
- **No framework, no dependencies.** One bundle, one optional lazy-loaded font file.

## 3. Distribution & versioning (jsDelivr)

- Public GitHub repo `leadtrackr-widget` (jsDelivr requires public repos — no secrets in this repo, ever; the Worker deploys separately via wrangler with env secrets).
- `dist/lt-widget.min.js` is committed on release and tagged (`v1.0.0`, `v1.1.0`, …). A GitHub Action builds and tags to prevent stale-dist mistakes.
- Client embed pins the **major** version: `.../leadtrackr-widget@1/dist/lt-widget.min.js`. jsDelivr resolves `@1` to the latest `v1.x` tag; updates propagate automatically (cache up to 12 h; can be forced via jsDelivr's purge tool). Exact-version pinning (`@1.2.0`) remains available per client if ever needed.
- **Known trade-off, accepted for MVP:** the embed URL clients install is semi-permanent. If we later move to `widget.leadtrackr.io` (own domain on Cloudflare, instant purge, no third-party CDN), installed snippets must be updated. Mitigation: keep the MVP install base small; the production migration is part of the dev handoff.

## 4. Widget UI

States (visual design produced separately via a Claude design session, based on LeadTrackr tokens: Cairo, `#52B483`, `#020A24`, 8/12/16 px radii, soft layered shadows):

1. **Launcher** — pill/round button bottom-right, subtle pulse; optional dismissible teaser bubble.
2. **Channel panel** (±340 px) — header (logo/avatar + title + subtitle), three channel buttons, "Powered by LeadTrackr" footer.
3. **Call** — shows phone number; tapping fires dataLayer event and opens `tel:`.
4. **Callback form** — name (optional) + phone (required), inline validation.
5. **Contact form** — name, email, phone, message.
6. **Success state** — checkmark, confirmation copy, back link.
7. **Mobile** — panel renders as full-width bottom sheet; launcher unchanged.

Accessibility: 44 px touch targets, visible focus states, WCAG AA contrast, `aria-expanded`/`aria-label` on launcher, Escape closes panel, focus trap inside open panel.

Font strategy: widget renders with system font stack by default; the Cairo woff2 subset is lazy-loaded **on first open** (never on page load) and applied inside the shadow root only.

## 5. Configuration (inline, C1)

Auto-init from the script tag (`data-key`) plus optional global before script load:

```html
<script>
window.ltWidgetConfig = {
  phone: "+31 20 123 4567",
  companyName: "Voorbeeld B.V.",
  logo: "https://example.com/logo.png",        // optional avatar/logo URL
  channels: ["call", "callback", "form"],       // order = display order
  color: "#52B483",                             // primary override
  position: "right",                            // "right" | "left"
  offset: { bottom: 20, side: 20 },             // px
  teaser: "Vragen? Wij helpen je direct.",      // null = no teaser
  texts: { /* per-key overrides of all NL default strings */ },
  endpoint: null                                 // override Worker URL (testing)
};
</script>
<script src="https://cdn.jsdelivr.net/gh/<org>/leadtrackr-widget@1/dist/lt-widget.min.js"
        data-key="SITE_KEY" async></script>
```

The config schema is the contract: when LeadTrackr later hosts config per site key (C2), the fetched JSON uses this exact shape — drop-in replacement, no widget changes.

## 6. Attribution module

Captured on every pageview, before any interaction:

- **Click IDs & UTM:** `gclid`, `fbclid`, plus `utm_source/medium/campaign/term/content` from the URL.
- **First touch:** stored in `localStorage["ltw_attr_first"]` only if absent (params + landing page + referrer + timestamp).
- **Last touch:** `localStorage["ltw_attr_last"]` overwritten whenever new campaign params (any UTM or click ID) appear.
- **Session:** landing page of current session in `sessionStorage`; current page URL and referrer read live at submit time.
- Retention: entries older than 90 days are ignored and overwritten.
- localStorage unavailable (Safari private mode etc.) → degrade silently to current-pageview data only.

## 7. Lead payload & Worker API

`POST {endpoint}/lead` — `Content-Type: application/json`:

```json
{
  "siteKey": "abc123",
  "channel": "callback",
  "fields": { "name": "", "phone": "", "email": "", "message": "" },
  "attribution": {
    "page": "https://klant.nl/dienst?x=1",
    "landingPage": "https://klant.nl/?gclid=…",
    "referrer": "https://www.google.com/",
    "utm": { "source": "", "medium": "", "campaign": "", "term": "", "content": "" },
    "gclid": "", "fbclid": "",
    "firstTouch": { "…": "same shape, plus timestamp" },
    "lastTouch": { "…": "same shape, plus timestamp" },
    "device": "mobile", "userAgent": "…", "timestamp": "2026-07-18T12:00:00Z"
  },
  "widgetVersion": "1.0.0",
  "website": ""
}
```

`website` is the honeypot field (hidden input; non-empty → Worker returns 200 but drops the lead).

Worker responsibilities (repo `worker/`, deployed with wrangler, not served via jsDelivr):

- CORS: allow POST from any origin (site-key validation is the gate for MVP); echo `Access-Control-Allow-Origin` from request origin.
- Validate: known `siteKey` (env-configured map for MVP), required field per channel (`phone` for callback; `email` or `phone` for form), honeypot empty, payload < 32 KB.
- Rate limit: simple per-IP limit via Cloudflare rate-limiting rules (no KV/DO complexity in MVP).
- Forward: POST the full payload to `LEAD_WEBHOOK_URL` (env). MVP destination = anything (n8n/Make/Slack/email); handoff = dev swaps this for the internal LeadTrackr lead-source endpoint, or replaces the Worker entirely — the payload contract is what survives.
- Respond `{ "ok": true }` fast; widget shows success as soon as the Worker accepts.

## 8. dataLayer events

Pushed to `window.dataLayer` (created if absent):

| Event | When | Params |
|---|---|---|
| `ltw_open` | panel opened | `widget_version` |
| `ltw_channel_click` | channel chosen | `channel` |
| `ltw_call_click` | tel: link clicked | `phone` |
| `ltw_lead_submitted` | Worker accepted lead | `channel` |

No PII in dataLayer events.

## 9. Performance budget

- Bundle ≤ 15 KB gzip, single file, zero dependencies; loads `async`, executes after `DOMContentLoaded` idle (`requestIdleCallback` with fallback).
- No layout shift: widget is `position: fixed`, injected after page content.
- No font/network requests on page load beyond the script itself; Cairo + first-open only.
- Target Lighthouse impact: ~0 on LCP/CLS, TBT < 10 ms.

## 10. Repo layout

```
leadtrackr-widget/
  src/            # widget TypeScript (ui/, attribution.ts, datalayer.ts, transport.ts, config.ts)
  worker/         # Cloudflare Worker (wrangler.toml, src/index.ts)
  dist/           # committed release build (jsDelivr serves this)
  demo/           # local test page that fakes a client site
  docs/superpowers/specs/
```

Build: esbuild → IIFE, minified, `LT_WIDGET_VERSION` injected. `npm run dev` serves `demo/` with live rebuild.

## 11. Testing

- Unit: attribution capture/persistence rules, config merge, payload assembly (vitest).
- Integration: demo page + mocked Worker; assert dataLayer pushes and POST payloads per channel.
- Manual matrix: Safari private mode (no localStorage), mobile bottom sheet, CSS-hostile host page (aggressive `* { }` resets) to prove Shadow DOM isolation.

## 12. Phasing

1. **Fase 0** — UI design via Claude design session (prompt delivered separately); Lester picks direction.
2. **Fase 1** — widget UI: Shadow DOM, all states, config, chosen design.
3. **Fase 2** — attribution + dataLayer.
4. **Fase 3** — Worker + transport + spam protection.
5. **Fase 4** — release pipeline (build → tag → jsDelivr), install docs (direct + via GTM), first test site.
6. **Handoff** — dev integrates as native LeadTrackr lead source: hosted config (C2), internal endpoint, `widget.leadtrackr.io`.

## 13. Open points

- GitHub org/account that will own the public repo (affects the jsDelivr URL clients install).
- Final visual direction (light vs. dark-accent) — decided after the Claude design session.
- MVP webhook destination for leads (n8n/Make/Slack/email) — any is fine, contract is fixed.
