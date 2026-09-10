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

**Niet:** de kanalenlijst vervangen of wijzigen; de formulier-, WhatsApp- en succesviews wijzigen;
nieuwe dataLayer-events; nieuwe veldtypes (`checkbox`, `number`, `date` uit de demo — zie Open punten).

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

Kanaalresolutie (onbruikbare definities vallen weg); richtext (opmaak én dat `<script>` geëscapet
blijft); de thread-flow per stap (vraag → gebruikersbubbel → typen → antwoord → vervolgchips);
de infokaart in beide modi; `channel_click` met het juiste id per kanaalsoort en géén conversie op
een link; de differentiële test hierboven; en een test dat een config zonder `conversational`
byte-identiek rendert als v1.11.0.

## Open punten

1. **Veldtypes.** De demo gebruikt `checkbox`, `number` en `date` in het offerteformulier; het
   product kent alleen `text`, `email`, `tel` en `textarea`. Voorstel: `aantal` en `leverdatum`
   worden tekstvelden en de twee opties gaan naar de placeholder van het berichtveld. Wil Lester de
   types écht, dan is dat een aparte uitbreiding van `forms.ts` en hoort die niet in deze release.
2. **Naamgeving `faqs`.** Map met één ingang bij Van Delft, maar een map houdt "id = kanaal-id"
   overeind en laat een tweede FAQ toe zonder API-breuk.

## Release

Eén release na afronding, inclusief README, een PR op `leadtrackr/docs` met changelog-entry, en na de
tag het `@1`-bereik purgen. Van Delft gaat daarna live met `conversational: true` in zijn tag.
