# LeadBot — nummervraag uitschakelbaar + vrijstelling betaalcheck

**Datum:** 2026-08-04
**Versie:** 1.7.0

## Aanleiding

De WhatsApp-flow vraagt altijd om een telefoonnummer voordat de bezoeker naar
WhatsApp wordt doorgestuurd. Dat levert een identificeerbare lead op, maar kost
doorstroom: elke extra stap is een afhaakmoment, en bij een klant die vooral op
volume stuurt weegt die ruil anders uit. Er moet een manier komen om die stap
over te slaan zonder de lead-registratie helemaal op te geven.

Daarnaast moet één specifieke klant de LeadBot kunnen gebruiken zonder betaald
abonnement, terwijl de betaalcheck voor alle andere klanten gewoon blijft
werken.

## Twee opties, één patroon

Beide features zijn booleans in `LeadBotConfig` die standaard aan staan en
alleen door een letterlijke `false` uitgezet worden — hetzelfde patroon als
`launcher`, `branding` en `teaser`:

```ts
whatsappPhoneQuestion: u.whatsappPhoneQuestion !== false,
subscriptionCheck: u.subscriptionCheck !== false,
```

`undefined`, `0`, `"false"` en elke andere waarde laten de optie dus aan staan.
Dat is bewust: uitzetten moet een expliciete daad zijn, geen typefout.

---

## Feature 1 — `whatsappPhoneQuestion`

Gedocumenteerd. Geldt voor beide WhatsApp-flows: het kanaal in het paneel én de
interceptor-modal. Eén knop, consistent gedrag.

### Gedrag

Met de optie uit wordt de flow `bericht → nummer → lead → WhatsApp` ingekort tot
`bericht → lead → WhatsApp`. De bezoeker typt een bericht, drukt op verzenden,
en gaat direct door naar WhatsApp. De lead gaat wél naar LeadTrackr — met
bericht, pagina-context en volledige attributie, alleen zonder telefoonnummer in
`userData`.

De guard op een niet-leeg bericht blijft staan. Een lead zonder nummer én zonder
bericht bevat niets bruikbaars.

### Paneel (`src/ui/leadbot.ts`)

De `wa-send`-actie zet nu `wa.step = 'phone'`. Met de optie uit roept diezelfde
actie direct `submitWhatsApp()` aan.

In `submitWhatsApp()` wordt bij optie-uit de `normalizePhone`-validatie en de
bijbehorende `errorPhone`-melding overgeslagen, en bouwt de payload alleen
`{ message }`. De rest van de functie blijft ongewijzigd: de bot-check op
`MIN_OPEN_MS`, de blokkade-afhandeling, `pushConversion('whatsapp', {})` zonder
`phone`, `openWhatsApp(wa.message)` en de successView.

### Interceptor (`src/ui/interceptor.ts`)

Zelfde ingreep: `wa-send` roept `submit()` aan in plaats van naar
`view = 'phone'` te gaan. `submit()` slaat de nummer-validatie over en POST
zonder `phone`. `s.phoneE164` blijft `null`, waardoor de
"nummer verstuurd"-bubbel vanzelf niet verschijnt. Daarna gewoon `finish()`:
wa.me opent, spinner, success met de "opnieuw openen"-knop als popup-vangnet.

Het doelnummer blijft uit de aangeklikte link komen, met de bestaande fallback
op het geconfigureerde `whatsapp`-nummer.

### Views (`src/ui/views.ts`)

Eén aanpassing in `waChat`: het antwoord-blok (typing-indicator plus de
`waPhoneQuestion`-bubbel) wordt alleen nog gerenderd als `question` gevuld is.
Beide flows geven `''` mee als de optie uit staat.

Dit is nodig omdat de interceptor in de `opening`- en `success`-staat het
verzonden bericht toont (`showSent: s.view !== 'compose'`). Zonder deze
wijziging zou de bot daar alsnog vragen om een nummer dat nooit gevraagd is.

Er komt geen nieuwe view bij.

---

## Feature 2 — `subscriptionCheck`

**Ongedocumenteerd.** Niet opnemen in de README. Wel een duidelijke comment in
`src/config.ts`, in lijn met hoe `branding` daar al beschreven staat.

### Gedrag

Beide flows blokkeren nu bij een 404 (project niet gevonden) of 403 (abonnement
inactief): de flow stopt met `errorBlocked` en er volgt geen handoff. Met
`subscriptionCheck: false` vervalt die blokkade en loopt de flow door alsof de
POST geslaagd is — conversie-event én WhatsApp-handoff gaan gewoon door.

404 en 403 vervallen samen. Ze zitten in hetzelfde blok, en voor een klant
zonder abonnement is 404 een even waarschijnlijke API-respons als 403; ze los
uit elkaar trekken levert een halve vrijstelling op die alsnog kan blokkeren.

De `console.warn` blijft in beide gevallen staan. Ook bij een vrijgestelde klant
wil je in de console kunnen zien wat de API zei.

### Bekende beperking

Dit is obscurity, geen beveiliging. De key wordt gelezen van een object dat de
klant zelf aanlevert, dus de letterlijke string overleeft minificatie en is
vindbaar in het publieke bundel. Intrekken vereist bovendien een aanpassing op
de site van de klant.

De structurele oplossing is een project-vlag server-side in LeadTrackr, zodat
`createLead` voor dat project nooit 403 of 404 geeft. Dan staat er niets in de
klant-HTML en is de vrijstelling per direct intrekbaar. Dit spec kiest bewust
voor de client-side variant omdat die vandaag te leveren is; de server-side
route blijft de aanbevolen vervanging.

---

## Tests

`test/config.test.ts` — voor beide keys: default `true`, letterlijke `false` zet
uit, andere waarden (`undefined`, `0`, `"false"`) laten aan staan.

`test/leadbot.test.ts` en `test/interceptor-ui.test.ts` — met
`whatsappPhoneQuestion: false`: één klik op verzenden levert een payload met
`formFields.message` en zónder `userData.phone`, pusht het conversie-event,
opent `wa.me`, en toont geen nummervraag-bubbel in de chat. Een leeg bericht
verstuurt niets.

Voor `subscriptionCheck`: een 403-respons blokkeert bij de default en blokkeert
niet met `false` — in dat geval gaan conversie-event en handoff gewoon door.
Idem voor 404.

## Documentatie

README: `whatsappPhoneQuestion` opnemen in de WhatsApp-flow-sectie, met een
regel over de afweging — meer doorstroom, maar een lead zonder telefoonnummer.
`subscriptionCheck` komt er niet in.

Versie naar 1.7.0 in `package.json`; de README-snippet installeert op `@1` en
hoeft niet aangepast te worden.
