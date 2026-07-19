# LeadTrackr LeadBot

Lightweight leadgeneratie-bot voor klantwebsites. Eén script-tag, rechtsonder op de site, drie contactkanalen — **contactformulier**, **bellen** en **WhatsApp** — en elke lead gaat mét volledige attributie (channel flow, gclid/wbraid, fbc/fbp, GA4 client-id) naar LeadTrackr via hetzelfde contract als de officiële [GTM-tag](https://github.com/leadtrackr/gtm-leadtrackr-tag).

- **Geen dependencies** — één IIFE-bundle van ±13 KB gzip
- **Shadow DOM** — geen CSS-conflicten met de klantsite, geen iframe
- **GTM-tag-compatibel** — zelfde `lt_channelflow`-cookie, zelfde `createLead`-payload; LeadBot en GTM-tag kunnen naast elkaar draaien
- **Meertalig** — taal volgt automatisch het `lang`-attribuut van de pagina (`nl`/`en`, fallback `en`); alle teksten komen uit taalbestanden en zijn per key overridebaar
- **Persoonlijke stem** — met een `agentName` spreekt de LeadBot in de ik-vorm ("Waar kan ik je mee helpen?"); zonder agent in de wij-vorm
- **Native typografie** — neemt standaard het lettertype van de website over (`theme.font: "inherit"`); geen externe font-requests
- **Volledige landenlijst** — telefoonlandcodes via de native systeem-selector (220+ landen, namen gelokaliseerd via `Intl.DisplayNames`)

## Installatie

```html
<script>
window.ltLeadBotConfig = {
  companyName: "Voorbeeld B.V.",
  agentName: "Nick",
  agentPhoto: "https://voorbeeld.nl/nick.jpg",
  phone: "+31 20 123 4567",
  whatsapp: "+31612345678"
};
</script>
<script src="https://cdn.jsdelivr.net/gh/leadtrackr/leadtrackr-leadbot@1/dist/lt-leadbot.min.js"
        data-project-id="JOUW_PROJECT_ID" async></script>
```

`data-project-id` is het LeadTrackr project-ID (zelfde als in de GTM-tag). Ook via GTM te installeren als Custom HTML-tag.

## Configuratie

Alle opties op `window.ltLeadBotConfig` (vóór het script-tag zetten):

| Optie | Default | Uitleg |
|---|---|---|
| `companyName` | `""` | Bedrijfsnaam in header en teaser |
| `agentName` | `""` | Naam van de medewerker |
| `agentPhoto` | `""` | URL van ronde profielfoto (launcher + panel); leeg = initiaal-fallback |
| `greeting` | per taal | Begroeting in teaser, panel en WhatsApp-chat |
| `phone` | `null` | Telefoonnummer voor het bel-kanaal; `null` verbergt het kanaal |
| `whatsapp` | `null` | WhatsApp-nummer (wa.me-doel); `null` verbergt het kanaal |
| `channels` | `["contact_form","phone","whatsapp"]` | Volgorde = weergavevolgorde; subset mogelijk |
| `position` | `"right"` | `"right"` of `"left"` |
| `offset` | `{ bottom: 20, side: 20 }` | Afstand tot de hoek in px |
| `teaser` | `true` | Teaser-bubbel; dismiss onthouden per sessie |
| `defaultCountry` | `"NL"` | Startland van de landcode-selector (WhatsApp-flow) |
| `callTracking` | `false` | `true` = telefoonnummer komt uit de LeadTrackr call-tracking cookie (dynamic number insertion); zie hieronder |
| `language` | auto | Forceer `"nl"` of `"en"`; default = `lang`-attribuut van de pagina, fallback `en` |
| `responseTimeText` | per taal | Bijv. `"Gemiddelde responstijd: binnen 15 minuten"` — per project aanpasbaar |
| `theme` | LeadTrackr-kleuren | Alle kleuren + radius overridebaar, zie hieronder |
| `formNames` | `LeadBot — Contact form` / `LeadBot — WhatsApp` | `formData.formName` per kanaal |
| `texts` | taalbestand | Elke UI-string overridebaar per key |
| `endpoint` | LeadTrackr createLead | Alleen voor testen overriden |

### Theme

```js
theme: {
  font: "inherit",           // site-font overnemen; of eigen stack: "Cairo, sans-serif"
  primary: "#52B483", primaryHover: "#3E8762", primaryTint: "#EDF8F2",
  launcherBorder: "#52B483", headerBg: "#FFFFFF", headerText: "#020A24",
  panelBg: "#FFFFFF", text: "#1F2937", textMuted: "#6B7280",
  border: "#E5E7EB", error: "#FF6A6A", radius: 16
}
```

## dataLayer-events

Drie events, altijd plat — alleen `event`, `channel` en `user_data`:

```js
// LeadBot geopend
window.dataLayer.push({ event: "leadtrackr_leadbot_open" });

// Kanaal geselecteerd (contact_form | phone | whatsapp)
window.dataLayer.push({ event: "leadtrackr_leadbot_channel_click", channel: "whatsapp" });

// Conversie — user_data afhankelijk van het kanaal
window.dataLayer.push({
  event: "leadtrackr_leadbot_conversion",
  channel: "whatsapp",
  user_data: { phone_number: "+31612345678" }
});
window.dataLayer.push({
  event: "leadtrackr_leadbot_conversion",
  channel: "contact_form",
  user_data: {
    email_address: "example@email.com",
    first_name: "Lester",
    last_name: "Visser"
  }
});
```

Kanaalnamen zijn overal identiek (config, code en dataLayer). Een klik op het bel-kanaal geeft een `channel_click` met `channel: "phone"` plus een conversie-event met lege `user_data` — **behalve** wanneer `callTracking: true` aan staat: dan meet call tracking het daadwerkelijke gesprek en wordt de klik-conversie onderdrukt om dubbeltelling te voorkomen.

## Call tracking (dynamic number insertion)

Omdat de LeadBot in een Shadow DOM zit, kan het reguliere call-tracking-script het nummer daar niet vervangen. Zet daarom `callTracking: true` — de LeadBot leest het dynamische nummer dan zelf uit de call-tracking-cookie (naam `yeswetrack_<account>_<timestamp>`, veld `swap_numbers`) en gebruikt het voor de weergave én de `tel:`-link. Het nummer wordt bij elke weergave opnieuw gelezen, dus ook als de cookie pas ná pageload wordt gezet klopt hij zodra de bezoeker het panel opent.

- Fallback: geen (geldige, niet-verlopen) cookie → het geconfigureerde `phone`-nummer; is dat er ook niet, dan verdwijnt het bel-kanaal.
- Meerdere swap-groepen: `callTracking: { swapGroup: 1 }`; afwijkende cookieprefix: `callTracking: { prefix: "andereprefix_" }`.

## WhatsApp-flow

Bezoeker typt een bericht → vult het telefoonnummer in waarmee die het WhatsApp-gesprek wil starten (native landcode-selector) → de lead wordt opgeslagen in LeadTrackr → WhatsApp opent in een nieuw tabblad met het bericht vooraf ingevuld. De bevestiging zegt expliciet dat het gesprek in WhatsApp nog verstuurd moet worden.

## Payload-contract

POST naar `https://app.leadtrackr.io/api/leads/createLead` met exact de GTM-tag-structuur: `projectId`, `formData` (`formName`, `uniqueEventId`, vrije `formFields` incl. `message`, `page_url`, `page_title`), `userData` (`firstName`/`lastName`/`email`/`phone`, E.164), `channelFlow` (uit de gedeelde `lt_channelflow`-cookie, 395 dagen) en `attributionData` (`gclid`, `wbraid`, `fbc`, `fbp`, `cid`) — inclusief alle cookie-fallbacks van de GTM-tag. Bij WhatsApp wordt de lead **eerst** opgeslagen en opent daarna pas `wa.me`.

Spam-bescherming client-side: honeypot-veld + minimale invultijd (2 s).

## Development

```bash
npm install
npm run dev     # build-watch + demo op http://localhost:4173 (POST /mock-lead logt leads)
npm test        # vitest (happy-dom)
npm run build   # dist/lt-leadbot.min.js + gzip-size
```

Demo-parameters: `?projectId=<LeadTrackr project-ID>` stuurt leads naar het echte endpoint, `?lang=en` test de Engelse versie, UTM/gclid/fbclid-parameters testen attributie.

## Release

1. `npm version minor` (of `patch`)
2. `npm run build` en commit `dist/`
3. `git tag v1.x.y && git push --tags`

Klanten laden `@1` — jsDelivr pakt automatisch de nieuwste `v1.x`-tag op (cache tot 12 uur; sneller via [jsDelivr purge](https://www.jsdelivr.com/tools/purge)). De GitHub Action verifieert bij elke tag dat de gecommitte `dist/` overeenkomt met de broncode.
