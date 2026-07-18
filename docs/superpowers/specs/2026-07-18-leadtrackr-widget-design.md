# LeadTrackr Website Widget — Design Spec (MVP)

**Date:** 2026-07-18 (rev. 3)
**Status:** Routes approved: A1 (vanilla TS + Shadow DOM), C1 (inline config), distribution via GitHub + jsDelivr. Lead delivery: **direct to the existing public LeadTrackr endpoint** (replaces the earlier Cloudflare Worker plan). **Visual design delivered: option 2A "Persoonlijk — medewerker centraal"** from the Claude design project (`design/LeadTrackr Widget.dc.html`, options 1A/1B are rejected alternatives kept at 55% opacity). Build approved.
**Owner:** Lester (YesWeTrack / LeadTrackr). MVP built standalone; later handed off to the LeadTrackr dev to integrate as a native lead source in app.leadtrackr.io.

## 1. Goal

A lightweight lead-generation widget (functionally inspired by Futy.io, visually 100% LeadTrackr) that clients install with one script tag. It sits bottom-right, offers three contact channels — **message form, direct call, WhatsApp** (per design 2A; the earlier callback channel was dropped in the design phase) — and sends every lead, enriched with attribution data, to LeadTrackr using the **same payload contract and endpoint as the official LeadTrackr GTM tag** (`gtm-leadtrackr-tag`).

Explicit non-goals (MVP): chat/bot conversations, video, appointment booking, A/B testing, hosted config UI, multi-language beyond NL defaults, callback-request channel.

## 2. Architecture

```
client website
  <script src="https://cdn.jsdelivr.net/gh/leadtrackr/leadtrackr-widget@1/dist/lt-widget.min.js"
          data-project-id="PROJECT_ID" async></script>
        │
        ▼
  single IIFE bundle (~10–15 KB gzip, no dependencies)
        ├── UI layer: Shadow DOM root, launcher → panel → channel views
        ├── attribution module: ported 1:1 from the GTM tag
        │     (lt_channelflow cookie + click-ID capture, see §6)
        ├── dataLayer module: marketer-grade ltw events incl. PII (§8)
        └── transport: POST → https://app.leadtrackr.io/api/leads/createLead
```

- **No middleware.** The endpoint is public and token-free (auth = `projectId`), identical to how the GTM tag delivers leads. CORS is already permissive server-side (the GTM SDK does the same cross-origin `fetch` with `Content-Type: application/json` from any client site).
- **Shadow DOM** (`mode: 'open'`) gives iframe-grade CSS isolation both ways without an iframe; `tel:` links, dataLayer and cookies work natively because the widget lives in the page DOM.
- **Compatibility by construction:** the widget reuses the exact cookie (`lt_channelflow`) and payload shape of the GTM tag. A site running both the widget and the GTM tag shares one journey history with no conflicts (the append logic is duplicate-safe).

## 3. Distribution & versioning (jsDelivr)

- Public GitHub repo under the existing **`leadtrackr` org** (the GTM tag already ships from `cdn.jsdelivr.net/gh/leadtrackr/gtm-leadtrackr-tag@main/…`), e.g. `leadtrackr/leadtrackr-widget`.
- `dist/lt-widget.min.js` is committed on release and tagged (`v1.0.0`, `v1.1.0`, …). A GitHub Action builds and tags to prevent stale-dist mistakes.
- Client embed pins the **major** version: `…/leadtrackr-widget@1/dist/lt-widget.min.js`. jsDelivr resolves `@1` to the latest `v1.x` tag; updates propagate automatically (cache up to 12 h; can be forced via jsDelivr's purge tool). Tag-pinning beats the GTM tag's current `@main` approach (branch refs cache 12 h with no rollback control).
- **Known trade-off, accepted for MVP:** the embed URL clients install is semi-permanent. A later move to `widget.leadtrackr.io` requires installed snippets to change. Mitigation: keep the MVP install base small; production migration is part of the dev handoff.

## 4. Widget UI — design 2A "Persoonlijk" (source of truth: `design/LeadTrackr Widget.dc.html`)

The design centers a real employee ("agent"): photo, name, company, online status, personal greeting. States:

1. **Launcher** — 62 px round button: agent photo, 3 px `#52B483` border, white bg, green chat-bubble badge bottom-right, `lt-pulse` glow. Dismissible teaser bubble above it (white card, radius `14 14 4 14`): agent name + "van {company}", greeting, close ×.
2. **Channel panel** (340 px, radius 16, shadow `0 1px 2px rgba(0,0,0,.04), 0 12px 32px rgba(0,0,0,.12)`) — header: 56 px avatar with pulsing online dot, "**{agent}** van {company}", green "Online" status; greeting in a gray `#F3F4F6` speech bubble (radius `4 14 14 14`). Then up to three channel buttons (min-height 56 px, 40 px icon tile `#EDF8F2`/`#3E8762`, title 700 15px `#020A24`, subtitle 13px `#6B7280`, chevron; hover: green border + `#EDF8F2` bg):
   - **Stuur een bericht** → message form
   - **Bel ons direct** → `tel:` (subtitle shows the phone number)
   - **WhatsApp** → WhatsApp compose flow
   Footer on every card: "Better leads start with **LeadTrackr.io** 🚀" (11px, gray).
3. **WhatsApp compose** — WhatsApp-authentic look (header `#075E54` with back button + avatar + name/online, chat bg `#ECE5DD`, agent bubbles white, visitor bubble `#DCF8C6`, input bar `#F0F2F5`, send button `#25D366`). Flow: greeting bubble → visitor types message in rounded input → send: message appears as sent bubble (with double blue check), agent bubble asks for phone number → phone input with country-code picker (🇳🇱 +31 default; searchable dropdown 🇧🇪🇩🇪🇬🇧) → send: **lead is stored in LeadTrackr first**, then `wa.me/<number>?text=<typed message>` opens.
4. **Message form** — header with back button + small avatar + title; fields: Naam, E-mailadres, Bericht (46 px inputs, 1.5 px `#E5E7EB` border, radius 8, focus `#52B483` border + 1 px ring); submit: 48 px full-width `#52B483`, hover `#3E8762` + lift + green shadow.
5. **Error state** (pattern from design 1A card 3): invalid field gets `#FF6A6A` border + ring, `#FFF7F7` bg, error line in `#C23B3B` 600 12.5px with info icon (e.g. "Vul een geldig telefoonnummer in").
6. **Success** — agent photo (68 px) with green check badge, `lt-pop` animation; title 700 18px, body 14px `#4B5563`, green back link.
7. **Mobile** — bottom sheet (radius `20 20 0 0`, drag handle, page dimmed `rgba(2,10,36,.35)`), channel buttons 52 px, same content.

Animations from the design: `lt-pulse` (green glow ring), `lt-pop` (success badge), `lt-fade-up` (teaser/bubbles).

Accessibility: 44 px touch targets, visible focus states (`outline: 2px solid` navy/green per design), WCAG AA contrast, `aria-expanded`/`aria-label` on launcher, Escape closes panel, focus trap inside open panel.

Font strategy: system font stack by default; Cairo woff2 subset lazy-loaded **on first open** (never on page load), applied inside the shadow root only.

## 5. Configuration (inline, C1)

Auto-init from the script tag (`data-project-id`) plus optional global before script load:

```html
<script>
window.ltWidgetConfig = {
  companyName: "Voorbeeld B.V.",
  agentName: "Nick",                            // employee shown in the widget
  agentPhoto: "https://example.com/nick.jpg",   // round photo, launcher + panel
  greeting: "Goedemiddag 👋 Waar kunnen we je mee helpen?",
  phone: "+31 20 123 4567",                     // for the call channel
  whatsapp: "+31612345678",                     // wa.me target; null = channel hidden
  channels: ["message", "call", "whatsapp"],    // order = display order
  position: "right",                            // "right" | "left"
  offset: { bottom: 20, side: 20 },             // px
  teaser: true,                                 // teaser bubble (agent + greeting); false = off
  defaultCountry: "NL",                         // country-code picker default (WhatsApp flow)

  // Theme — every color overridable; defaults = LeadTrackr brand
  theme: {
    primary: "#52B483",        // buttons, icons, accents
    primaryHover: "#3E8762",
    launcherBg: "#52B483",
    launcherIcon: "#FFFFFF",
    headerBg: "#FFFFFF",       // or e.g. "#020A24" for dark header
    headerText: "#020A24",
    panelBg: "#FFFFFF",
    text: "#1F2937",
    textMuted: "#4B5563",
    border: "#E5E7EB",
    error: "#FF6A6A",
    radius: 12                  // px, panel/card rounding
  },

  formNames: {                                  // formData.formName per channel
    message: "Widget — Bericht",
    whatsapp: "Widget — WhatsApp"
  },
  texts: { /* per-key overrides of all NL default strings */ },
  endpoint: null                                 // override for testing only
};
</script>
<script src="https://cdn.jsdelivr.net/gh/leadtrackr/leadtrackr-widget@1/dist/lt-widget.min.js"
        data-project-id="PROJECT_ID" async></script>
```

Theme values are applied as CSS custom properties on the shadow root, so a client (or later the LeadTrackr config UI) can restyle the widget without touching CSS. The config schema is the contract: hosted config per project (C2, post-MVP) serves this exact JSON shape.

## 6. Attribution module — ported from the GTM tag

Source of truth: `gtm-leadtrackr-tag/template.tpl`. The widget re-implements this logic 1:1 in plain JS (no GTM sandbox), so data is identical whether a lead arrives via widget or GTM tag.

**6a. Channel flow (every pageview, on widget boot):**

- Cookie `lt_channelflow`, max-age **395 days**, `path=/`, domain auto — same cookie as the GTM tag.
- Determine current channel:
  1. Any UTM param present (`utm_source/medium/campaign/content/term`) → use UTMs.
  2. Else referrer host matches known search engines (google, bing, yahoo, duckduckgo, baidu) → `{ source: <engine domain>, medium: "organic" }`.
  3. Else external referrer → `{ source: <referrer host>, medium: "referral" }`.
  4. Else → `{ source: "direct", medium: "none" }`.
- If the cookie already has entries and the URL carries **no new** UTM params → keep the last channel (no re-classification mid-session).
- Append `{ timestamp, channel }` only if different from the last entry (JSON-compare), then rewrite the cookie.

**6b. Click IDs & identifiers (at lead submit):**

| Field | Logic (identical to GTM tag) |
|---|---|
| `gclid` | URL param → fallback: `_gcl_aw` cookie, `split('.')[2]` |
| `wbraid` | URL param → fallback: `_gcl_gb` cookie, `split('.')[2]` |
| `fbc` | `_fbc` cookie; if `fbclid` in URL and cookie missing/stale → construct `fb.<subdomainIndex>.<timestamp>.<encodedFbclid>` |
| `fbp` | `_fbp` cookie as-is |
| `cid` | GA4 client ID — widget equivalent of `readAnalyticsStorage`: parse `_ga` cookie (`GA1.1.A.B` → `A.B`) |

Cookies unavailable/blocked → fields degrade to `''`, exactly like the GTM tag; the lead still sends (validation requires userData **or** attributionData to be non-empty, and widget leads always carry userData).

## 7. Lead payload & endpoint — same contract as the GTM tag

`POST https://app.leadtrackr.io/api/leads/createLead` — `Content-Type: application/json`, no token:

```json
{
  "projectId": "PROJECT_ID",
  "formData": {
    "formName": "Widget — Bericht",
    "uniqueEventId": "<generated per submit, dedup-safe>",
    "formFields": {
      "message": "…",
      "page_url": "https://klant.nl/dienst",
      "page_title": "Dienst — Klant B.V."
    }
  },
  "userData": {
    "firstName": "Jan",
    "lastName": "Jansen",
    "phone": "+31612345678",
    "email": "jan@bedrijf.nl"
  },
  "channelFlow": [
    { "timestamp": 1752840000000, "channel": { "source": "google", "medium": "cpc", "campaign": "…", "content": "", "term": "" } }
  ],
  "attributionData": {
    "fbc": "fb.1.1752840000000.AbCd…",
    "fbp": "fb.1.1752830000000.1234567890",
    "gclid": "Cj0KCQ…",
    "wbraid": "",
    "cid": "1234567890.1719000000"
  }
}
```

Notes:

- **Only contract-known top-level keys** (`projectId`, `formData`, `userData`, `channelFlow`, `attributionData`). Extra context (message, page URL/title) travels inside `formData.formFields`, which the contract defines as free-form key/value.
- **Per channel:** *message* → `userData` name + email, `formFields.message` (no phone field in the design). *whatsapp* → `userData.phone` (visitor's number from the country-code flow), `formFields.message` = typed WhatsApp text; the lead POST completes **before** `wa.me` opens (design note: "lead is dan al opgeslagen"). *call* → no `createLead` POST in MVP, dataLayer event + `tel:` only.
- The single "Naam" input is split into `firstName` (first word) / `lastName` (rest); only-one-word names go entirely into `firstName`.
- Phone numbers are normalized to **E.164** (`06…` → `+316…`) before payload and dataLayer — required for Enhanced Conversions matching anyway.
- `uniqueEventId`: generated per submission (`ltw-<timestamp>-<random>`), mirrors the tag's dedup option.
- Spam protection is client-side only for MVP: hidden honeypot field (if filled → widget silently drops, no request) plus a minimum time-to-submit check (< 2 s after open → drop). Server-side protection is inherently LeadTrackr's domain — the endpoint has the same public exposure via the GTM tag today.
- Success UI shows as soon as the endpoint responds OK; on failure the widget shows a retry state and pushes no lead event.

## 8. dataLayer events — marketer-grade, PII included by design

Purpose: clients' marketers must be able to build Enhanced Conversions (Google Ads/GA4) and Meta Advanced Matching straight from these pushes, without custom JS. PII is therefore **deliberately included**, in Google's `user_provided_data` schema — the same shape the LeadTrackr GTM tag accepts as input, and the same shape GTM's built-in "User-Provided Data" variable reads. Consent responsibility sits with the site owner, identical to any form-submit tracking.

| Event | When |
|---|---|
| `leadtrackr_widget_open` | panel opened |
| `leadtrackr_widget_channel_click` | channel chosen (`channel` param) |
| `leadtrackr_widget_call_click` | tel: link clicked (`phone_number` = business number) |
| `leadtrackr_widget_lead_submitted` | endpoint accepted the lead |

The lead push:

```js
window.dataLayer.push({
  event: "leadtrackr_widget_lead_submitted",
  leadtrackr: {
    channel: "message",                        // message | whatsapp
    form_name: "Widget — Bericht",
    project_id: "PROJECT_ID",
    widget_version: "1.0.0",
    attribution: {                             // current-touch snapshot
      source: "google", medium: "cpc", campaign: "zomer-actie",
      gclid: "Cj0KCQ…", wbraid: "", fbclid: "",
      ga_client_id: "1234567890.1719000000"
    }
  },
  user_provided_data: {                        // Google EC schema — plug-and-play
    email: "jan@bedrijf.nl",
    phone_number: "+31612345678",
    address: [{ first_name: "Jan", last_name: "Jansen" }]
  }
});
```

Marketer workflows this enables out of the box: GTM trigger on `leadtrackr_widget_lead_submitted` → GA4 event with user-provided data (Enhanced Conversions), Google Ads conversion with EC, Meta pixel Lead with Advanced Matching, and even feeding the LeadTrackr GTM tag itself (`user_provided_data` maps 1:1 to its User-Provided Data Object input). `dataLayer` is created if absent, events also fire when GTM isn't installed.

## 9. Performance budget

- Bundle ≤ 15 KB gzip, single file, zero dependencies; loads `async`, initializes on `requestIdleCallback` (fallback `DOMContentLoaded + setTimeout`).
- No layout shift: widget is `position: fixed`, injected after page content.
- No font/network requests on page load beyond the script itself; Cairo + first-open only.
- Target Lighthouse impact: ~0 on LCP/CLS, TBT < 10 ms.

## 10. Repo layout

```
leadtrackr-widget/
  src/            # widget TypeScript (ui/, attribution.ts, channelflow.ts,
                  #   datalayer.ts, transport.ts, config.ts)
  dist/           # committed release build (jsDelivr serves this)
  demo/           # local test page that fakes a client site (incl. UTM/gclid links)
  docs/superpowers/specs/
```

Build: esbuild → IIFE, minified, `LT_WIDGET_VERSION` injected. `npm run dev` serves `demo/` with live rebuild.

## 11. Testing

- Unit (vitest): channel classification rules (UTM/organic/referral/direct), channel-flow append/dedup logic, click-ID fallback chains (`_gcl_aw`, `_fbc` construction, `_ga` parsing), name splitting, E.164 normalization, payload assembly.
- **Parity test:** fixture pages where both the GTM tag and the widget run; assert both produce byte-identical `lt_channelflow` cookies and equivalent payloads.
- Integration: demo page + mocked endpoint; assert dataLayer pushes (incl. `user_provided_data` shape) and POST payloads per channel.
- Manual matrix: cookies blocked (Safari ITP/private mode), mobile bottom sheet, CSS-hostile host page (aggressive `* { }` resets), site with GTM absent (dataLayer still created).

## 12. Phasing

1. **Fase 0** — ✅ UI design delivered: option 2A (`design/LeadTrackr Widget.dc.html`).
2. **Fase 1** — widget UI: Shadow DOM, all 2A states incl. WhatsApp flow, config incl. theme.
3. **Fase 2** — attribution port (channel flow + click IDs) + dataLayer events + parity test against the GTM tag.
4. **Fase 3** — transport to `createLead`, honeypot/time-check, retry state.
5. **Fase 4** — release pipeline (build → tag → jsDelivr), install docs (direct + via GTM), first test site.
6. **Handoff** — dev integrates as native LeadTrackr lead source: hosted config per project (C2), widget management UI, optional `widget.leadtrackr.io`.

## 13. Open points

- Confirm with the LeadTrackr dev that `createLead` ignores unknown `formFields` keys gracefully (expected — free-form contract) and whether a lead ID is returned (nice-to-have for the dataLayer push).
- Repo name under the `leadtrackr` GitHub org (`leadtrackr-widget` proposed).
- Whether a *call* click should also create a LeadTrackr lead (MVP: no — dataLayer + `tel:` only; LeadTrackr call tracking covers the actual call).
