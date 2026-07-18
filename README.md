# LeadTrackr Widget

Lightweight leadgeneratie-widget voor klantwebsites. Eén script-tag, rechtsonder op de site, drie contactkanalen — **bericht sturen**, **direct bellen** en **WhatsApp** — en elke lead gaat mét volledige attributie (channel flow, gclid/wbraid, fbc/fbp, GA4 client-id) naar LeadTrackr via hetzelfde contract als de officiële [GTM-tag](https://github.com/leadtrackr/gtm-leadtrackr-tag).

- **Geen dependencies** — één IIFE-bundle van ±11 KB gzip
- **Shadow DOM** — geen CSS-conflicten met de klantsite, geen iframe
- **GTM-tag-compatibel** — zelfde `lt_channelflow`-cookie, zelfde `createLead`-payload; widget en GTM-tag kunnen naast elkaar draaien
- **Marketer-ready dataLayer-events** — inclusief `user_provided_data` in Google Enhanced Conversions-schema

## Installatie

```html
<script>
window.ltWidgetConfig = {
  companyName: "Voorbeeld B.V.",
  agentName: "Nick",
  agentPhoto: "https://voorbeeld.nl/nick.jpg",
  greeting: "Goedemiddag 👋 Waar kunnen we je mee helpen?",
  phone: "+31 20 123 4567",
  whatsapp: "+31612345678"
};
</script>
<script src="https://cdn.jsdelivr.net/gh/leadtrackr/leadtrackr-widget@1/dist/lt-widget.min.js"
        data-project-id="JOUW_PROJECT_ID" async></script>
```

`data-project-id` is het LeadTrackr project-ID (zelfde als in de GTM-tag). Ook via GTM te installeren als Custom HTML-tag.

## Configuratie

Alle opties op `window.ltWidgetConfig` (vóór het script-tag zetten):

| Optie | Default | Uitleg |
|---|---|---|
| `companyName` | `""` | Bedrijfsnaam in header en teaser |
| `agentName` | `""` | Naam van de medewerker |
| `agentPhoto` | `""` | URL van ronde profielfoto (launcher + panel); leeg = initiaal-fallback |
| `greeting` | NL-default | Begroeting in teaser, panel en WhatsApp-chat |
| `phone` | `null` | Telefoonnummer voor het bel-kanaal; `null` verbergt het kanaal |
| `whatsapp` | `null` | WhatsApp-nummer (wa.me-doel); `null` verbergt het kanaal |
| `channels` | `["message","call","whatsapp"]` | Volgorde = weergavevolgorde; subset mogelijk |
| `position` | `"right"` | `"right"` of `"left"` |
| `offset` | `{ bottom: 20, side: 20 }` | Afstand tot de hoek in px |
| `teaser` | `true` | Teaser-bubbel; dismiss onthouden per sessie |
| `defaultCountry` | `"NL"` | Startland van de landcode-kiezer (WhatsApp-flow) |
| `theme` | LeadTrackr-kleuren | Alle kleuren + radius overridebaar, zie hieronder |
| `formNames` | `Widget — Bericht` / `Widget — WhatsApp` | `formData.formName` per kanaal |
| `texts` | NL-defaults | Elke UI-string overridebaar per key |
| `endpoint` | LeadTrackr createLead | Alleen voor testen overriden |

### Theme

```js
theme: {
  primary: "#52B483", primaryHover: "#3E8762", primaryTint: "#EDF8F2",
  launcherBorder: "#52B483", headerBg: "#FFFFFF", headerText: "#020A24",
  panelBg: "#FFFFFF", text: "#1F2937", textMuted: "#6B7280",
  border: "#E5E7EB", error: "#FF6A6A", radius: 16
}
```

## dataLayer-events

| Event | Moment |
|---|---|
| `leadtrackr_widget_open` | panel geopend |
| `leadtrackr_widget_channel_click` | kanaal gekozen (`channel`) |
| `leadtrackr_widget_call_click` | telefoonlink aangeklikt (`phone_number` = bedrijfsnummer) |
| `leadtrackr_widget_lead_submitted` | lead geaccepteerd door endpoint |

De lead-push bevat bewust PII in Google's Enhanced Conversions-schema — direct bruikbaar voor GA4 EC, Google Ads EC en Meta Advanced Matching:

```js
{
  event: "leadtrackr_widget_lead_submitted",
  leadtrackr: {
    channel: "message", form_name: "Widget — Bericht",
    project_id: "…", widget_version: "1.0.0",
    attribution: { source: "google", medium: "cpc", campaign: "…", gclid: "…", wbraid: "", fbclid: "", ga_client_id: "…" }
  },
  user_provided_data: {
    email: "jan@bedrijf.nl",
    phone_number: "+31612345678",
    address: [{ first_name: "Jan", last_name: "Jansen" }]
  }
}
```

## Payload-contract

POST naar `https://app.leadtrackr.io/api/leads/createLead` met exact de GTM-tag-structuur: `projectId`, `formData` (`formName`, `uniqueEventId`, vrije `formFields` incl. `message`, `page_url`, `page_title`), `userData` (`firstName`/`lastName`/`email`/`phone`, E.164), `channelFlow` (uit de gedeelde `lt_channelflow`-cookie, 395 dagen) en `attributionData` (`gclid`, `wbraid`, `fbc`, `fbp`, `cid`) — inclusief alle cookie-fallbacks van de GTM-tag. Bij de WhatsApp-flow wordt de lead **eerst** opgeslagen en opent daarna pas `wa.me`.

Spam-bescherming client-side: honeypot-veld + minimale invultijd (2 s). Bellen doet geen `createLead`-POST (alleen dataLayer); de daadwerkelijke call vangt LeadTrackr-calltracking af.

## Development

```bash
npm install
npm run dev     # build-watch + demo op http://localhost:4173 (POST /mock-lead logt leads)
npm test        # vitest (happy-dom)
npm run build   # dist/lt-widget.min.js + gzip-size
```

## Release

1. `npm version minor` (of `patch`)
2. `npm run build` en commit `dist/`
3. `git tag v1.x.y && git push --tags`

Klanten laden `@1` — jsDelivr pakt automatisch de nieuwste `v1.x`-tag op (cache tot 12 uur; sneller via [jsDelivr purge](https://www.jsdelivr.com/tools/purge)). De GitHub Action verifieert bij elke tag dat de gecommitte `dist/` overeenkomt met de broncode.
