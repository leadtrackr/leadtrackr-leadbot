# LeadTrackr LeadBot

Lightweight leadgeneratie-bot voor klantwebsites. Eén script-tag, rechtsonder op de site, contactkanalen naar keuze — **bellen**, **WhatsApp** en zoveel **formulieren** als je wilt — en elke lead gaat mét volledige attributie (channel flow, gclid/wbraid, fbc/fbp, GA4 client-id) naar LeadTrackr via hetzelfde contract als de officiële [GTM-tag](https://github.com/leadtrackr/gtm-leadtrackr-tag).

- **Geen dependencies** — één IIFE-bundle van ±20 KB gzip
- **Formulieren uit de config** — velden en kanalen stel je samen op de site zelf (bijv. een GTM Custom HTML-tag), zonder repo-wijziging
- **Lijst of gesprek** — standaard een kanalenlijst; met `conversational: true` opent de launcher een gesprek met keuzechips, infokaarten en een FAQ
- **Shadow DOM** — geen CSS-conflicten met de klantsite, geen iframe
- **GTM-tag-compatibel** — zelfde `lt_channelflow`-cookie, zelfde `createLead`-payload; LeadBot en GTM-tag kunnen naast elkaar draaien
- **Meertalig** — taal volgt automatisch het `lang`-attribuut van de pagina (`nl`/`en`/`de`, fallback `en`); alle teksten komen uit taalbestanden en zijn per key overridebaar, en met `byLanguage` serveert één tag meerdere talen
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
| `channels` | `["contact_form","phone","whatsapp"]` | Volgorde = weergavevolgorde; elk id dat geen `phone`/`whatsapp` is moet in `forms` staan |
| `forms` | ingebouwd `contact_form` | Eigen formulieren met eigen velden, zie hieronder |
| `links` | `{}` | Infokaarten: een bericht met een knop naar een pagina, zie hieronder |
| `faqs` | `{}` | Veelgestelde vragen met doorloop naar andere kanalen, zie hieronder |
| `conversational` | `false` | `true` opent een gesprek in plaats van een kanalenlijst |
| `byLanguage` | `{}` | Per taal een laag over de basisconfig, zie hieronder |
| `launcher` | `true` | `false` verbergt de LeadBot-launcher volledig (bijv. voor interceptor-only) |
| `whatsappInterceptor` | `false` | `true` onderschept kliks op bestaande wa.me-/WhatsApp-links en opent de LeadBot-modal; zie hieronder |
| `position` | `"right"` | `"right"` of `"left"` |
| `offset` | `{ bottom: 20, side: 20 }` | Afstand tot de hoek in px |
| `teaser` | `true` | Teaser-bubbel; dismiss onthouden per sessie |
| `defaultCountry` | auto | Startland van de landcode-selector; default = land uit de browser-locale (bijv. `nl-BE` → BE), fallback `NL`. Geen IP-geolocatie |
| `callTracking` | `false` | `true` = telefoonnummer komt uit de LeadTrackr call-tracking cookie (dynamic number insertion); zie hieronder |
| `language` | auto | Forceer `"nl"`, `"en"` of `"de"`; default = `lang`-attribuut van de pagina, fallback `en` |
| `responseTimeText` | per taal | Bijv. `"Gemiddelde responstijd: binnen 15 minuten"` — per project aanpasbaar |
| `theme` | LeadTrackr-kleuren | Alle kleuren + radius overridebaar, zie hieronder |
| `formNames` | `LeadBot — Contact form` / `LeadBot — WhatsApp` | `formData.formName` per kanaal |
| `texts` | taalbestand | Elke UI-string overridebaar per key |
| `endpoint` | LeadTrackr createLead | Alleen voor testen overriden |

### Formulieren

Elk formulier is een eigen kanaal met een eigen id. Dat id staat in `channels` (bepaalt of en waar de knop staat) en in `forms` (bepaalt wat erachter zit). Zonder `forms` blijft `contact_form` precies wat het altijd was: naam, e-mailadres en bericht.

```js
channels: ['callback', 'contact_form', 'phone', 'whatsapp'],
forms: {
  callback: {
    title: 'Bel mij terug',                  // knop in het paneel
    sub: 'Ik bel je zo snel mogelijk terug', // regel eronder
    icon: 'phone',                           // chat | phone | mail | whatsapp
    formName: 'LeadBot — Terugbelverzoek',   // formData.formName in LeadTrackr
    successTitle: 'Yes, gelukt!',
    successBody: 'We bellen je zo snel mogelijk terug.',
    fields: [
      { key: 'name', required: true },
      { key: 'company', label: 'Bedrijfsnaam', required: true },
      { key: 'phone', required: true },
      { key: 'message', placeholder: 'Waar gaat je vraag over?' }
    ]
  }
}
```

Een veld is `{ key, label, type, required, placeholder }`; alleen `key` is verplicht. Keys mogen letters, cijfers, `_` en `-` bevatten — een veld met een andere key wordt overgeslagen. Velden zonder `required: true` zijn optioneel en krijgen dat er zichtbaar bij.

Types: `text` (default), `email`, `tel`, `textarea`, `number`, `date` en `checkbox`.

- **`tel`** krijgt dezelfde native landcode-selector als de WhatsApp-flow en levert een E.164-nummer op.
- **`email`** wordt gevalideerd.
- **`number`** neemt optioneel `min` en `max`; een waarde daarbuiten wordt geweigerd.
- **`date`** is een native datumkiezer. De bezoeker ziet zijn eigen notatie, maar wat naar LeadTrackr gaat is altijd ISO (`YYYY-MM-DD`), zodat een datum uit elke taal hetzelfde formaat heeft.
- **`checkbox`** is met `options` een keuzegroep en zonder `options` één vinkje.

```js
{ key: 'aantal', label: 'Aantal', type: 'number', min: 1, max: 5000, required: true },
{ key: 'leverdatum', label: 'Gewenste leverdatum', type: 'date' },
{ key: 'opties', label: 'Optioneel', type: 'checkbox', options: [
    { value: 'boodschap', label: 'Met persoonlijke boodschap' },
    { value: 'multi-adres', label: 'Verzending naar meerdere adressen' }
]},
{ key: 'nieuwsbrief', label: 'Houd mij op de hoogte', type: 'checkbox' }
```

Een optie is `{ value, label }`, of een kale string als die twee gelijk zijn. In LeadTrackr komen de **values**, gescheiden door `", "` — dus `"boodschap, multi-adres"`. Een enkel vinkje levert zijn value op als het aan staat en ontbreekt als het uit staat; zonder eigen value is dat `"true"`. `required` betekent: minstens één aangevinkt.

Dat onderscheid tussen `value` en `label` bestaat om dezelfde reden als bij kanaal-id's. Zou een taallaag de opties vervangen door vertaalde teksten, dan sloeg een Duitse lead een andere waarde op dan een Nederlandse voor dezelfde keuze, en dan valt er niet meer overheen te rapporteren. Nu vertaalt de laag alleen `label`.

**Gereserveerde keys.** `name`, `email`, `phone` en `message` hebben een vaste betekenis: die gaan naar `userData` (LeadTrackr) en `user_data` (Enhanced Conversions). Elke andere key gaat als vrij veld mee in `formFields`. Voor die vier hoef je verder niets in te vullen — label, type en placeholder komen uit het taalbestand:

```js
fields: [{ key: 'name' }, { key: 'email' }, { key: 'message' }]  // = het ingebouwde formulier
```

Alles wat je weglaat valt terug op de taal van de pagina, dus `{ title, fields }` is genoeg. Wil je het ingebouwde formulier aanpassen, zet dan `contact_form` in `forms` — dan wint die definitie. Een formulier zonder bruikbaar veld krijgt geen knop.

### Meertalige sites

Serveert een site meerdere talen, dan hoeft de config niet per taal gedupliceerd te worden. `byLanguage` legt
een laag over de basis heen, en de LeadBot pakt de laag van de taal die hij op de pagina detecteert — dus
gewoon het `lang`-attribuut, er is geen extra schakelaar in GTM voor nodig.

```js
window.ltLeadBotConfig = {
  greeting: 'Goedendag 👋 Waar kan ik je mee helpen?',
  channels: ['offerte', 'phone'],
  forms: {
    offerte: {
      title: 'Offerte aanvragen',
      formName: 'LeadBot — Offerteaanvraag',
      fields: [
        { key: 'name', required: true },
        { key: 'aantal', label: 'Aantal producten', required: true }
      ]
    }
  },
  byLanguage: {
    de: {
      greeting: 'Guten Tag 👋 Wie kann ich Ihnen helfen?',
      forms: {
        offerte: {
          title: 'Angebot anfordern',
          formName: 'LeadBot — Angebotsanfrage',
          fields: [{ key: 'aantal', label: 'Anzahl Produkte' }]
        }
      }
    }
  }
};
```

Alles wat je bovenin mag zetten, mag ook in een taallaag — ook een land-eigen `phone` of `whatsapp`. Twee
uitzonderingen: `language` (dat bepaalt juist welke laag gekozen wordt) en een tweede `byLanguage` eronder.

Wat de laag níet geeft, komt uit de basis:

- **Losse teksten** (`texts`, `formNames`, `theme`, `offset`) worden per sleutel samengevoegd — je vertaalt
  alleen de regels die je wilt vertalen.
- **Formulieren, infokaarten en FAQ's** worden per id samengevoegd; eigenschappen die de laag weglaat
  (`submit`, `icon`, `button.url`, …) blijven uit de basis staan.
- **Keuze-opties** voegen samen op `value`, zodat een laag alleen het label vertaalt en de opgeslagen
  waarde in elke taal gelijk blijft.
- **Velden** volgen de basis in volgorde, type en `required`; de laag hoeft alleen `label` en `placeholder`
  te geven. Een key die de basis niet heeft, komt erachteraan — zo vraagt één land een extra veld zonder dat
  je een tweede formulier nodig hebt.

**Kanaal-id's blijven bewust gelijk over talen.** Het id is wat in `channel` in de dataLayer belandt, dus met
dezelfde id's blijft één GA4-rapportage over alle talen kloppen. Wil je per taal apart kunnen rapporteren,
gebruik dan een eigen `formName` per taal — die staat in LeadTrackr bij de lead.

Zit een taal niet in de bot (alleen `nl`, `en` en `de` zijn ingebouwd), dan valt de UI terug op Engels. Een
`byLanguage`-laag voor die taal wordt dan niet toegepast: de laag hoort bij de gedetecteerde taal, en die is
in dat geval `en`.

### Infokaarten

Niet elke keuze hoeft een lead op te leveren. Een `links`-kanaal is een doorverwijzing: in de
kanalenlijst een knop die meteen naar de pagina gaat, in een gesprek een bericht met een knop eronder.

```js
channels: ['winkels', 'contact_form'],
links: {
  winkels: {
    title: 'Winkels',
    sub: 'Vind een winkel bij jou in de buurt',
    icon: 'info',
    message: '**Onze winkels**\n\nWist je dat je **gratis** kunt proeven?',
    button: { label: 'Zoek een winkel', url: '/winkels' }
  }
}
```

Een infokaart levert `leadtrackr_leadbot_channel_click` met zijn eigen id, en nooit een lead of een
conversie. Zonder `button.url` verschijnt het kanaal niet — dan liever geen knop dan een dode knop.

### Veelgestelde vragen

Een `faqs`-kanaal beantwoordt vragen in het gesprek en biedt daarna een doorloop naar de kanalen waar
wél een lead uit komt.

```js
channels: ['faq', 'whatsapp', 'contact_form'],
faqs: {
  faq: {
    title: 'Veelgestelde vragen',
    sub: 'Direct antwoord op de meeste vragen',
    icon: 'help',
    intro: 'Waar kan ik je mee helpen?',
    questions: [
      { q: 'Wat zijn jullie openingstijden?',
        a: 'Die vind je op onze **winkelpagina**.',
        button: { label: 'Winkelpagina', url: '/winkels' } },
      { q: 'Wat is de levertijd?', a: 'Voor 23:00 besteld, morgen in huis.' }
    ],
    followUp: ['whatsapp', 'phone', 'contact_form']
  }
}
```

De bezoeker kiest een vraag, die verschijnt als zijn eigen bericht, en na een korte typ-indicator
volgt het antwoord — met de knop erbij als de vraag er een heeft. Een beantwoorde vraag verdwijnt uit
de keuzes; wat overblijft staat er nog, met de doorloopkanalen eronder en één rustige afsluiter.

Een doorloopkanaal hoeft **niet** in `channels` te staan: bellen is een prima vervolg op een antwoord
zonder dat het een menukeuze is. Alleen kanalen die helemaal niet bestaan vallen weg.

### Gespreksmodus

Met `conversational: true` opent de launcher meteen een gesprek: de begroeting als bericht en elk
kanaal uit `channels` als keuzechip, met WhatsApp uitgelicht. Formulieren en de WhatsApp-flow openen
daar bovenop met een terugknop die in hetzelfde gesprek uitkomt — het gesprek blijft staan zoals het
was.

```js
window.ltLeadBotConfig = {
  conversational: true,
  greeting: 'Goedendag 👋 Waar kan ik je mee helpen?',
  channels: ['whatsapp', 'offerte', 'winkels', 'faq'],
  // forms, links en faqs zoals hierboven
};
```

De config is in beide modi dezelfde; alleen de presentatie verschilt. Zet je `conversational` weer
uit, dan staat de kanalenlijst er weer, met exact dezelfde kanalen.


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

// Kanaal geselecteerd (phone | whatsapp | id van een formulier)
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

Kanaalnamen zijn overal identiek (config, code en dataLayer) — het id dat je een formulier in `forms`, `links` of `faqs` geeft, is precies het id dat in `channel` terechtkomt. Een infokaart en een FAQ geven alleen een `channel_click`; die leveren geen lead en dus geen conversie op. Zo kun je in GTM apart op een terugbelverzoek triggeren. Een klik op het bel-kanaal geeft een `channel_click` met `channel: "phone"` plus een conversie-event met lege `user_data` — **behalve** wanneer `callTracking: true` aan staat: dan meet call tracking het daadwerkelijke gesprek en wordt de klik-conversie onderdrukt om dubbeltelling te voorkomen.

## Call tracking (dynamic number insertion)

Omdat de LeadBot in een Shadow DOM zit, kan het reguliere call-tracking-script het nummer daar niet vervangen. Zet daarom `callTracking: true` — de LeadBot leest het dynamische nummer dan zelf uit de call-tracking-cookie (naam `yeswetrack_<account>_<timestamp>`, veld `swap_numbers`) en gebruikt het voor de weergave én de `tel:`-link. Het nummer wordt bij elke weergave opnieuw gelezen, dus ook als de cookie pas ná pageload wordt gezet klopt hij zodra de bezoeker het panel opent.

- Fallback: geen (geldige, niet-verlopen) cookie → het geconfigureerde `phone`-nummer; is dat er ook niet, dan verdwijnt het bel-kanaal.
- Meerdere swap-groepen: `callTracking: { swapGroup: 1 }`; afwijkende cookieprefix: `callTracking: { prefix: "andereprefix_" }`.

## WhatsApp-flow

Bezoeker typt een bericht → vult het telefoonnummer in waarmee die het WhatsApp-gesprek wil starten (native landcode-selector) → de lead wordt opgeslagen in LeadTrackr → WhatsApp opent in een nieuw tabblad met het bericht vooraf ingevuld. De bevestiging zegt expliciet dat het gesprek in WhatsApp nog verstuurd moet worden.

- `whatsappPhoneQuestion: false` slaat de nummervraag over: de bezoeker gaat na zijn bericht direct door naar WhatsApp. De lead gaat nog steeds naar LeadTrackr — met bericht, pagina-context en attributie, alleen zonder telefoonnummer. Geldt voor zowel het WhatsApp-kanaal in het paneel als de interceptor. Afweging: meer doorstroom, maar een lead die je niet zelf kunt terugbellen.

## WhatsApp Interceptor

Met `whatsappInterceptor: true` onderschept de LeadBot kliks op de bestaande WhatsApp-links van de site (`wa.me/<nummer>`, `api.whatsapp.com/send`, `web.whatsapp.com/send`, `whatsapp://send`) en opent in plaats daarvan een modal (desktop: gecentreerd; mobiel: bottom sheet) met dezelfde WhatsApp-leadflow: bericht → telefoonnummer → lead naar LeadTrackr → daarna pas door naar WhatsApp.

- Het **doelnummer komt uit de aangeklikte link** (per link kan dat dus verschillen); een `?text=`-prefill wordt in het berichtveld gezet. Links zonder nummer vallen terug op het geconfigureerde `whatsapp`-nummer; is dat er ook niet, dan blijft de link gewoon werken.
- Groeps- en shortcode-links (`chat.whatsapp.com`, `wa.me/message/…`) worden bewust niet onderschept.
- Leads krijgen `formName` `LeadBot — WhatsApp Interceptor` (overridebaar via `formNames.whatsapp_interceptor`); dataLayer-events gebruiken gewoon channel `whatsapp`.
- Combineer met `launcher: false` voor interceptor-only (geen bolletje rechtsonder). Sluiten van de modal stuurt de bezoeker níet alsnog door naar WhatsApp; na een geslaagde submit toont de modal een "WhatsApp opnieuw openen"-knop als popup-vangnet.

```js
window.ltLeadBotConfig = {
  launcher: false,            // alleen de interceptor, geen launcher
  whatsappInterceptor: true,
  agentName: "Ruben",
  agentPhoto: "https://…/ruben.jpg",
};
```

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
