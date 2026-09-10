# LeadBot: gespreksmodus, infokaarten en FAQ

Datum: 2026-09-10 · Status: ter review · Aanleiding: Van Delft Chocolates & Bakery

## Waarom

Van Delft heeft een voorstel goedgekeurd waarin de LeadBot een **gesprek** is: een begroeting van
Ronald, zeven keuzes als chips, en achter elke keuze een formulier, een WhatsApp-flow, een
infokaart met knop of een FAQ. De LeadBot van vandaag is een **kanalenlijst**: een paneel met
knoppen. Drie van de zeven keuzes (Winkels, Vacatures, Veelgestelde vragen) bestaan niet als
kanaalsoort, en de vorm wijkt af van wat de klant zag.

De demo in het voorstel is geen mockup maar een werkende implementatie: 455 regels code met alle
views, en 153 regels CSS waarvan de themavariabelen 1-op-1 gelijk zijn aan `src/ui/styles.ts`
(`--p`, `--p-rgb`, `--ph`, `--tint`, `--lb`, `--hb`, `--ht`, `--bg`, `--tx`, `--mut`, `--bd`,
`--err`, `--r`). Van de 68 bot-CSS-klassen in de demo bestaan er 53 al in de repo. **Dit is een
port van een bestaande, klant-goedgekeurde implementatie, geen nieuw ontwerp.**

## Scope

**Wel:** een gespreksmodus naast de kanalenlijst, een `links`-kanaalsoort (infokaart met knop), een
`faqs`-kanaalsoort (vragen met antwoorden en doorloop), en een tekst-opmaaklaagje.

**Ook:** drie veldtypes erbij — `checkbox`, `number` en `date` — zodat het offerteformulier uit het
voorstel één op één te bouwen is. Zie Veldtypes.

**Niet:** de kanalenlijst vervangen of wijzigen; de WhatsApp- en succesviews wijzigen; nieuwe
dataLayer-events.

## Uitgangspunt: twee ingangen, één set views

In de demo zitten formulieren en de WhatsApp-flow **niet in de thread**. Het zijn lagen óver de
thread (`layer()` + `viewHead()`), elk met een eigen kop en terugknop. Daardoor blijft alles achter
een kanaal in beide modi identiek en is er maar één set formulierlogica, één WhatsApp-flow en één
succesview.

```
conversational: false (default)      conversational: true
┌ kanalenlijst ┐                     ┌ thread ┐
│ WhatsApp   ▸ │                     │ ● begroeting        │
│ Offerte    ▸ │                     │ (chip) (chip) (chip)│
│ Winkels    ▸ │ ──┐             ┌── │ ● antwoord + knop   │
│ FAQ        ▸ │   │             │   └─────────────────────┘
└──────────────┘   │             │
                   ▼             ▼
        ┌──────────────────────────────────┐
        │ formView · whatsappView ·        │  ← ongewijzigd, in beide modi
        │ successView   (als laag/view)    │
        └──────────────────────────────────┘
```

De thread is géén append-only DOM zoals in de demo, maar een view met state
(`messages`, `chips`, `typing`, `settled`) die net als de rest uit state rendert. De WhatsApp-view
heeft daar al een precedent voor met `entered`, dat voorkomt dat de typ-animatie bij elke render
opnieuw speelt.

Dezelfde thread-component dient beide modi: in lijstmodus is hij de view achter een `faqs`-kanaal,
in gespreksmodus is hij bovendien de ingang. Er ontstaat dus geen tweede UI-taal.

## Config-API

```js
conversational: true,                  // default false — bestaande klanten veranderen niet

channels: ['whatsapp','offerte','winkels','bestelling','faq','vacatures','wederverkoper'],

links: {
  winkels: {
    title: 'Winkels', sub: 'Vind een winkel bij jou in de buurt', icon: 'info',
    message: '**Van Delft Pepernotenwinkels**\n\nVind een winkel bij jou in de buurt.',
    button: { label: 'Zoek een winkel', url: '/winkels' }
  }
},

faqs: {
  faq: {
    title: 'Veelgestelde vragen', sub: 'Direct antwoord', icon: 'help',
    intro: 'Waar kan ik je mee helpen?',
    questions: [
      { q: 'Wat zijn jullie openingstijden?', a: '…', button: { label: 'Winkelpagina', url: '/winkels' } }
    ],
    followUp: ['whatsapp', 'phone', 'contact_form']
  }
}
```

`links` en `faqs` volgen exact de regels van `forms`: het id staat in `channels` én in de map, dat id
is wat in `channel` in de dataLayer belandt, en een onbruikbare definitie (link zonder `url`, faq
zonder vragen) levert geen knop op in plaats van een lege view. Beide zijn ook per taal te
overschrijven via `byLanguage` (v1.11.0), met dezelfde samenvoegregels.

## Gedrag per kanaalsoort

| Kanaal | Lijstmodus | Gespreksmodus |
|---|---|---|
| `forms` | formulierview (nu) | formulier als laag over de thread |
| `phone` | kanaalknop met `tel:` (nu) | telefoonkaart in de thread |
| `whatsapp` | WhatsApp-view (nu) | WhatsApp-flow als laag |
| `links` | kanaalknop die direct naar de URL linkt | bot-bubbel met de tekst plus een knop |
| `faqs` | opent de thread-view | vragen als chips in het lopende gesprek |

Na een afgeronde tak volgt één rustige chip ("Iets anders bekijken"), niet het hele menu opnieuw —
een expliciete keuze uit de demo, omdat het anders te druk werd. WhatsApp staat als uitgelichte chip
bovenaan (`featured`), afsluitchips zijn `quiet`. Onder een FAQ-antwoord komen "Nog een vraag" en
"Iets anders bekijken"; onder de vragenlijst staat "Ik heb een andere vraag" met doorloop naar de
kanalen uit `followUp`.

## Veldtypes

`forms.ts` kent nu `text`, `email`, `tel` en `textarea`. Daar komen `checkbox`, `number` en `date`
bij. De harde randvoorwaarde is `formFields: Record<string, string>` in het payload-contract: alles
wat een veld oplevert moet een string worden, want de GTM-tag schrijft hetzelfde formaat.

**`checkbox`** — met `options` een keuzegroep, zonder `options` één vinkje.

```js
{ key: 'opties', label: 'Optioneel', type: 'checkbox', options: [
    { value: 'boodschap', label: 'Met persoonlijke boodschap' },
    { value: 'multi-adres', label: 'Verzending naar meerdere adressen' }
]}
{ key: 'nieuwsbrief', label: 'Houd mij op de hoogte', type: 'checkbox' }
```

Een optie is `{ value, label }`, of een kale string als die twee gelijk zijn. In LeadTrackr komen de
**values**, gescheiden door `", "` — dus `"boodschap, multi-adres"`. Een enkel vinkje levert zijn
`value` op als het aan staat en ontbreekt als het uit staat; zonder `value` is dat `"true"`.
`required` betekent: minstens één aangevinkt.

Die scheiding tussen `value` en `label` is er om dezelfde reden als bij kanaal-id's. Zou de Duitse
taallaag de opties vervangen door Duitse teksten, dan sloeg een Duitse lead
`"Mit persönlicher Botschaft"` op en een Nederlandse `"Met persoonlijke boodschap"` — voor dezelfde
keuze, en dan is er niet meer overheen te rapporteren. Nu vertaalt de laag alleen `label` en blijft
de opgeslagen waarde gelijk. In `overlay.ts` komt daarvoor één regel bij: **opties voegen samen op
`value`**, precies zoals velden samenvoegen op `key`. Additief, dus geen breuk met v1.11.0.

**`number`** — `<input type="number" inputmode="numeric">`, met optionele `min` en `max`. Die twee
gaan mee omdat een aantal zonder ondergrens onzin toelaat (`-5` producten) en het drie regels
validatie is. Ongeldige invoer geeft `errorNumber`, buiten bereik `errorRange`.

**`date`** — `<input type="date">`. De browser toont de datum in de notatie van de bezoeker, maar de
waarde die naar LeadTrackr gaat is altijd ISO (`YYYY-MM-DD`), zodat een datum uit een Duitse en een
Nederlandse lead hetzelfde formaat heeft. Geen `min`/`max` in deze release: die wil je in de praktijk
relatief ("niet in het verleden") en dat vraagt een begrip dat ik hier niet ga verzinnen.

Alle drie krijgen dezelfde behandeling als de bestaande types: leeg en optioneel betekent dat het
veld helemaal niet in de payload komt, niet als lege string. Raakt `forms.ts` (types + normalisatie),
`views.ts` (renderen), `leadbot.ts` (uitlezen — een keuzegroep leest meerdere inputs in plaats van
één `.value`), `validate.ts` en `i18n.ts` (nieuwe foutteksten in drie talen).

Met deze drie types wordt het offerteformulier van Van Delft wat het voorstel liet zien: `aantal` als
number met `min: 1`, `leverdatum` als date, en `opties` als keuzegroep — geen tekstvelden met een
uitleg in de placeholder meer.

## dataLayer

Ongewijzigd. Drie events, plat, alleen `event`, `channel` en `user_data`. Een `links`- of
`faqs`-kanaal geeft `leadtrackr_leadbot_channel_click` met zijn eigen id. **Geen event op de
uitgaande klik** en geen event per geopende vraag — expliciet zo besloten, om het contract dicht te
houden. Een `links`-kanaal levert nooit een lead of conversie op.

## Tekstopmaak

Berichten en FAQ-antwoorden komen uit de config en worden geëscapet zoals overal, waarna een
minimale opmaak volgt in `src/ui/richtext.ts`: `**vet**` wordt `<strong>` en een lege regel wordt een
alinea. Rauwe HTML uit de config wordt niet gerenderd: de bot escapet vandaag álles, de repo is
source-available, en één ongeëscapete route erin is een regressie voor elke klant. De vier
Van Delft-antwoorden passen volledig binnen deze subset.

## Toegankelijkheid en beweging

Chips zijn echte `<button>`s in de focusvolgorde; de bestaande focus-trap en Escape-afhandeling
gelden ook in de thread. Nieuwe bot-berichten worden aangekondigd via een live region. De
typ-vertraging is een vaste constante en wordt overgeslagen bij `prefers-reduced-motion` — geen
config-knop.

## Terugwaartse compatibiliteit

`conversational` is default `false` en `links`/`faqs` zijn additief, dus een bestaande config rendert
ongewijzigd. Dit wordt afgedwongen met een differentiële test tegen de vorige versie, dezelfde opzet
als bij v1.11.0: de live configs van YesWeTrack en Leaseland plus een config die elke optie raakt,
over meerdere talen, moeten identiek resolven en renderen.

## Bestanden

Nieuw: `src/channels.ts` (kanaalresolutie), `src/links.ts` + `src/faq.ts` (normalisatie),
`src/ui/thread.ts` (rendering), `src/ui/threadflow.ts` (gesprekslogica), `src/ui/richtext.ts`.
Gewijzigd: `src/config.ts`, `src/types.ts`, `src/ui/views.ts` (linkkanaal in de lijst),
`src/ui/leadbot.ts` (view-union en routering), `src/ui/icons.ts` (`info`, `help`),
`src/ui/styles.ts` (15 componenten uit de demo), `src/i18n.ts` (nieuwe keys, drie talen).

De gesprekslogica komt bewust niet in `leadbot.ts`: dat bestand staat op 381 regels en doet al het
routeren, formulier-inlezen, WhatsApp-verzenden en toetsafhandeling. Het blijft de schil die de view
kiest.

## Tests

Per nieuw veldtype: renderen, uitlezen, valideren en wat er in `formFields` belandt — inclusief een
keuzegroep die op `value` samenvoegt met een taallaag, en een datum die ISO blijft. Verder:
kanaalresolutie (onbruikbare definities vallen weg); richtext (opmaak én dat `<script>` geëscapet
blijft); de thread-flow per stap (vraag → gebruikersbubbel → typen → antwoord → vervolgchips);
de infokaart in beide modi; `channel_click` met het juiste id per kanaalsoort en géén conversie op
een link; de differentiële test hierboven; en een test dat een config zonder `conversational`
byte-identiek rendert als v1.11.0.

## Open punten

1. **Naamgeving `faqs`.** Map met één ingang bij Van Delft, maar een map houdt "id = kanaal-id"
   overeind en laat een tweede FAQ toe zonder API-breuk.
2. **`min`/`max` op `date`.** Bewust niet in deze release, zie Veldtypes.

## Release

Eén release na afronding, inclusief README, een PR op `leadtrackr/docs` met changelog-entry, en na de
tag het `@1`-bereik purgen. Van Delft gaat daarna live met `conversational: true` in zijn tag.
