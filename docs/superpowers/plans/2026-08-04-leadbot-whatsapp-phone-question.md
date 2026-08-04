# LeadBot nummervraag + betaalcheck-vrijstelling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Twee config-booleans toevoegen aan de LeadBot: `whatsappPhoneQuestion` (gedocumenteerd) slaat de nummervraag in beide WhatsApp-flows over, `subscriptionCheck` (ongedocumenteerd) laat de flow doorlopen bij een 403/404 van de lead-API.

**Architecture:** Beide opties zijn booleans in `LeadBotConfig` die standaard `true` zijn en alleen door een letterlijke `false` uitgezet worden — hetzelfde patroon als de bestaande `launcher`, `branding` en `teaser`. De WhatsApp-flow bestaat twee keer (paneel-kanaal in `src/ui/leadbot.ts`, interceptor-modal in `src/ui/interceptor.ts`) en deelt zijn rendering via `waChat`/`waInputBar` in `src/ui/views.ts`. Beide flows krijgen dezelfde ingreep: de `wa-send`-actie verstuurt direct in plaats van naar de nummerstap te gaan, en de blokkade op 403/404 wordt achter `cfg.subscriptionCheck` gezet.

**Tech Stack:** TypeScript, esbuild (IIFE-bundle), vitest + happy-dom. Geen runtime-dependencies.

## Global Constraints

- Nieuwe config-booleans resolven altijd als `u.<key> !== false` — `undefined`, `0` en `"false"` laten de optie aan staan.
- `subscriptionCheck` komt **niet** in de README. Wel een comment in `src/config.ts`, in lijn met hoe `branding` daar al beschreven staat.
- `subscriptionCheck: false` laat 404 én 403 samen vervallen, niet één van beide.
- De `console.warn` bij een geblokkeerde lead blijft in beide gevallen staan, ook als de blokkade zelf vervalt.
- Een leeg bericht verstuurt nooit een lead — de bestaande guard op `wa.message` / `s.message` blijft staan.
- Testcommando: `npx vitest run <bestand>` vanuit de repo-root. Volledige suite: `npm test`.
- Commit-berichten in het Nederlands, in de stijl van de bestaande history (`feat:`, `fix:`, `docs:`).

---

### Task 1: Config-opties

**Files:**
- Modify: `src/config.ts:24-53` (interface `LeadBotConfig`), `src/config.ts:93-123` (return van `resolveConfig`)
- Test: `test/config.test.ts`

**Interfaces:**
- Consumes: niets
- Produces: `cfg.whatsappPhoneQuestion: boolean` en `cfg.subscriptionCheck: boolean` op het `LeadBotConfig`-object dat `resolveConfig(projectId, user)` teruggeeft. Taken 2 t/m 4 lezen deze twee velden.

- [ ] **Step 1: Write the failing tests**

Voeg onderaan het bestaande `describe('resolveConfig', ...)`-blok in `test/config.test.ts` toe:

```ts
  it('keeps the WhatsApp phone question on unless it is explicitly false', () => {
    expect(resolveConfig('p1', undefined).whatsappPhoneQuestion).toBe(true);
    expect(resolveConfig('p1', {}).whatsappPhoneQuestion).toBe(true);
    expect(resolveConfig('p1', { whatsappPhoneQuestion: false }).whatsappPhoneQuestion).toBe(false);
    // Alleen een letterlijke false telt: een typefout mag de vraag niet stilletjes uitzetten
    const typo = resolveConfig('p1', { whatsappPhoneQuestion: 'false' as unknown as boolean });
    expect(typo.whatsappPhoneQuestion).toBe(true);
    const zero = resolveConfig('p1', { whatsappPhoneQuestion: 0 as unknown as boolean });
    expect(zero.whatsappPhoneQuestion).toBe(true);
  });

  it('keeps the subscription check on unless it is explicitly false', () => {
    expect(resolveConfig('p1', undefined).subscriptionCheck).toBe(true);
    expect(resolveConfig('p1', {}).subscriptionCheck).toBe(true);
    expect(resolveConfig('p1', { subscriptionCheck: false }).subscriptionCheck).toBe(false);
    const typo = resolveConfig('p1', { subscriptionCheck: 'false' as unknown as boolean });
    expect(typo.subscriptionCheck).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/config.test.ts`
Expected: FAIL — TypeScript kent `whatsappPhoneQuestion` en `subscriptionCheck` nog niet op `LeadBotConfig`, en de waarden zijn `undefined`.

- [ ] **Step 3: Add the fields to the interface**

In `src/config.ts`, direct ná de bestaande `whatsappInterceptor`-declaratie in `interface LeadBotConfig`:

```ts
  // false slaat de nummervraag in beide WhatsApp-flows over: de bezoeker gaat
  // na zijn bericht direct door naar WhatsApp en de lead gaat zonder
  // telefoonnummer naar LeadTrackr (bericht en attributie blijven behouden).
  whatsappPhoneQuestion: boolean;
  // Ongedocumenteerd: false laat de flow doorlopen bij een 403 (abonnement
  // inactief) of 404 (project niet gevonden) van de lead-API. Alleen voor
  // klanten met een expliciete vrijstelling — niet in de README zetten.
  subscriptionCheck: boolean;
```

- [ ] **Step 4: Resolve the fields**

In `src/config.ts`, in het return-object van `resolveConfig`, direct ná de regel `whatsappInterceptor: u.whatsappInterceptor === true,`:

```ts
    whatsappPhoneQuestion: u.whatsappPhoneQuestion !== false,
    subscriptionCheck: u.subscriptionCheck !== false,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/config.test.ts`
Expected: PASS — alle tests, inclusief de bestaande.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts test/config.test.ts
git commit -m "feat: config-opties whatsappPhoneQuestion en subscriptionCheck"
```

---

### Task 2: Paneel-flow zonder nummervraag

**Files:**
- Modify: `src/ui/views.ts:148-163` (`waChat`), `src/ui/views.ts:213-226` (`whatsappView`), `src/ui/views.ts:242-289` (`interceptorView`)
- Modify: `src/ui/leadbot.ts:154-197` (`submitWhatsApp`), `src/ui/leadbot.ts:243-252` (case `wa-send`)
- Test: `test/leadbot.test.ts`

**Interfaces:**
- Consumes: `cfg.whatsappPhoneQuestion` uit Task 1.
- Produces: `waChat` rendert het antwoord-blok (typing-indicator + vraag-bubbel) alleen nog als `question` een niet-lege string is. Beide callers geven `cfg.whatsappPhoneQuestion ? t.waPhoneQuestion : ''` mee. Task 3 leunt op dit gedrag voor de interceptor-modal.

- [ ] **Step 1: Write the failing tests**

Voeg toe binnen `describe('whatsapp flow', ...)` in `test/leadbot.test.ts`, ná de bestaande test `POSTs the lead first, opens wa.me, ...`:

```ts
  it('skips the phone step and POSTs without a number when the question is off', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const m = freshMount({ whatsappPhoneQuestion: false });
    click(m.root, 'open');
    click(m.root, 'channel-whatsapp');
    vi.setSystemTime(1_000_000 + 5000);
    (q(m.root, '[data-wa="message"]') as HTMLInputElement).value = 'Wat kost het?';
    click(m.root, 'wa-send');
    await vi.waitFor(() => expect(q(m.root, '.ltb-success')).toBeTruthy());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.formData.formName).toBe('LeadBot — WhatsApp');
    expect(body.formData.formFields.message).toBe('Wat kost het?');
    expect(body.userData.phone).toBeUndefined();
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/31612345678?text=' + encodeURIComponent('Wat kost het?'),
      '_blank',
      'noopener',
    );
    expect(window.dataLayer).toContainEqual({
      event: 'leadtrackr_leadbot_conversion',
      channel: 'whatsapp',
      user_data: {},
    });
  });

  it('never shows the phone question or input when the question is off', () => {
    const m = freshMount({ whatsappPhoneQuestion: false });
    click(m.root, 'open');
    click(m.root, 'channel-whatsapp');
    expect(q(m.root, '.ltb-wa-chat')!.textContent).not.toContain('Op welk telefoonnummer');
    expect(q(m.root, '[data-wa="phone"]')).toBeNull();
  });

  it('sends nothing on an empty message when the question is off', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const m = freshMount({ whatsappPhoneQuestion: false });
    click(m.root, 'open');
    click(m.root, 'channel-whatsapp');
    vi.setSystemTime(1_000_000 + 5000);
    click(m.root, 'wa-send');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs once when send is clicked twice in a row', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('open', vi.fn());
    const m = freshMount({ whatsappPhoneQuestion: false });
    click(m.root, 'open');
    click(m.root, 'channel-whatsapp');
    vi.setSystemTime(1_000_000 + 5000);
    (q(m.root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    click(m.root, 'wa-send');
    click(m.root, 'wa-send');
    await vi.waitFor(() => expect(q(m.root, '.ltb-success')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/leadbot.test.ts`
Expected: FAIL — de eerste test loopt vast omdat `.ltb-success` nooit verschijnt (de flow blijft in de nummerstap hangen).

- [ ] **Step 3: Make the question bubble conditional in `waChat`**

Vervang in `src/ui/views.ts` het `const sent = ...`-blok in `waChat` door:

```ts
  // Zonder question (nummervraag uit) blijft alleen de verzonden bubbel staan:
  // de bot vraagt dan niets meer en de bezoeker gaat direct door naar WhatsApp.
  const reply = o.question
    ? `<div class="ltb-wa-reply">
           <div class="ltb-wa-bubble ltb-wa-typing" aria-hidden="true"><span></span><span></span><span></span></div>
           <div class="ltb-wa-bubble ltb-wa-question">${esc(o.question)}</div>
         </div>`
    : '';
  const sent = o.showSent
    ? `<div class="ltb-wa-bubble ltb-wa-sent">${esc(o.message)}<p class="ltb-wa-meta"><span class="ltb-wa-ticks"><span class="ltb-wa-tick-one">${icons.check(12, 2.2)}</span><span class="ltb-wa-tick-two">${icons.doubleCheck(14)}</span></span></p></div>
         ${reply}`
    : '';
```

- [ ] **Step 4: Pass an empty question from both views**

In `whatsappView` in `src/ui/views.ts`, vervang de `waChat`-aanroep door:

```ts
  ${waChat({ greeting: cfg.greeting, message: s.message, showSent: s.step === 'phone', question: cfg.whatsappPhoneQuestion ? t.waPhoneQuestion : '', isStatic: s.entered })}
```

In `interceptorView` in `src/ui/views.ts`, vervang de regel `question: t.waPhoneQuestion,` door:

```ts
    question: cfg.whatsappPhoneQuestion ? t.waPhoneQuestion : '',
```

- [ ] **Step 5: Submit directly from the compose step**

Vervang in `src/ui/leadbot.ts` de hele `case 'wa-send':` door:

```ts
      case 'wa-send':
        readWaInputs();
        if (!wa.message) break;
        // Zonder nummervraag is dit meteen de verzendknop
        if (!cfg.whatsappPhoneQuestion) {
          void submitWhatsApp();
          break;
        }
        wa.step = 'phone';
        wa.entered = false;
        render();
        wa.entered = true; // volgende renders spelen de sequence niet opnieuw
        container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
        break;
```

- [ ] **Step 6: Skip the phone validation in `submitWhatsApp`**

Vervang in `src/ui/leadbot.ts` de eerste regels van `submitWhatsApp` (t/m `wa.error = null;`) door:

```ts
  async function submitWhatsApp(): Promise<void> {
    // De compose-knop heeft geen disabled-state; zonder deze guard levert
    // dubbelklikken twee POSTs op.
    if (wa.sending) return;
    readWaInputs();
    // Met de nummervraag uit gaat de lead zonder telefoonnummer de deur uit;
    // bericht, pagina-context en attributie blijven wel behouden.
    const normalized = cfg.whatsappPhoneQuestion ? normalizePhone(wa.phone, wa.country.dial) : null;
    if (cfg.whatsappPhoneQuestion && !normalized) {
      wa.error = cfg.texts.errorPhone;
      render();
      return;
    }
    wa.error = null;
```

- [ ] **Step 7: Drop the phone from payload and conversion**

Vervang in `src/ui/leadbot.ts` in dezelfde functie de `sendLead`-aanroep door:

```ts
    const res = await sendLead(
      buildLeadPayload(cfg, 'whatsapp', { phone: normalized || undefined, message: wa.message }),
      cfg.endpoint,
    );
```

en de `pushConversion`-regel door:

```ts
    pushConversion('whatsapp', normalized ? { phone: normalized } : {});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run test/leadbot.test.ts`
Expected: PASS — de vier nieuwe tests plus alle bestaande WhatsApp-tests (de standaard-flow met nummervraag moet ongewijzigd blijven werken).

- [ ] **Step 9: Commit**

```bash
git add src/ui/views.ts src/ui/leadbot.ts test/leadbot.test.ts
git commit -m "feat: whatsappPhoneQuestion slaat de nummerstap over in het paneel"
```

---

### Task 3: Interceptor zonder nummervraag

**Files:**
- Modify: `src/ui/interceptor.ts:118-152` (`submit`), `src/ui/interceptor.ts:184-193` (case `wa-send`)
- Test: `test/interceptor-ui.test.ts`

**Interfaces:**
- Consumes: `cfg.whatsappPhoneQuestion` uit Task 1; het conditionele antwoord-blok in `waChat` uit Task 2.
- Produces: niets voor latere taken.

- [ ] **Step 1: Write the failing tests**

Voeg toe in `test/interceptor-ui.test.ts`, binnen hetzelfde `describe`-blok als de test `runs message → phone → POST → conversion → handoff with the link number`:

```ts
  it('goes straight to the handoff without a number when the question is off', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const { root } = freshMount({ whatsappPhoneQuestion: false });
    clickLink(addLink('https://wa.me/31698765432'));
    vi.setSystemTime(1_000_000 + 5000);
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Wat kost het?';
    q(root, '[data-action="wa-send"]')!.click();
    await vi.waitFor(() => expect(q(root, '.ltb-wi-handoff')).toBeTruthy());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.formData.formName).toBe('LeadBot — WhatsApp Interceptor');
    expect(body.formData.formFields.message).toBe('Wat kost het?');
    expect(body.userData.phone).toBeUndefined();
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/31698765432?text=' + encodeURIComponent('Wat kost het?'),
      '_blank',
      'noopener',
    );
    expect(window.dataLayer).toContainEqual({
      event: 'leadtrackr_leadbot_conversion',
      channel: 'whatsapp',
      user_data: {},
    });
    // Het verzonden bericht blijft zichtbaar, maar er is nooit om een nummer gevraagd
    expect(q(root, '.ltb-wa-sent')!.textContent).toContain('Wat kost het?');
    expect(q(root, '.ltb-wa-chat')!.textContent).not.toContain('Op welk telefoonnummer');
    expect(q(root, '.ltb-wa-question')).toBeNull();
  });

  it('POSTs once when send is clicked twice with the question off', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('open', vi.fn());
    const { root } = freshMount({ whatsappPhoneQuestion: false });
    clickLink(addLink('https://wa.me/31698765432'));
    vi.setSystemTime(1_000_000 + 5000);
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    q(root, '[data-action="wa-send"]')!.click();
    q(root, '[data-action="wa-send"]')!.click();
    await vi.waitFor(() => expect(q(root, '.ltb-wi-handoff')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/interceptor-ui.test.ts`
Expected: FAIL — `.ltb-wi-handoff` verschijnt niet; de modal blijft in de nummerstap staan.

- [ ] **Step 3: Submit directly from the compose step**

Vervang in `src/ui/interceptor.ts` de hele `case 'wa-send':` door:

```ts
      case 'wa-send':
        readInputs();
        if (!s.message) break;
        // Zonder nummervraag is dit meteen de verzendknop
        if (!cfg.whatsappPhoneQuestion) {
          void submit();
          break;
        }
        s.view = 'phone';
        s.entered = false;
        render();
        s.entered = true; // volgende renders spelen de sequence niet opnieuw
        container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
        break;
```

- [ ] **Step 4: Skip the phone validation in `submit`**

Vervang in `src/ui/interceptor.ts` de eerste regels van `submit` (t/m `s.phoneE164 = normalized;`) door:

```ts
  async function submit(): Promise<void> {
    // De compose-knop heeft geen disabled-state; zonder deze guard levert
    // dubbelklikken twee POSTs op.
    if (s.sending) return;
    readInputs();
    // Met de nummervraag uit gaat de lead zonder telefoonnummer de deur uit;
    // s.phoneE164 blijft null, dus de "nummer verstuurd"-bubbel blijft weg.
    const normalized = cfg.whatsappPhoneQuestion ? normalizePhone(s.phone, s.country.dial) : null;
    if (cfg.whatsappPhoneQuestion && !normalized) {
      s.error = cfg.texts.errorPhone;
      render();
      return;
    }
    s.error = null;
    s.phoneE164 = normalized;
```

- [ ] **Step 5: Drop the phone from payload and conversion**

Vervang in `src/ui/interceptor.ts` in dezelfde functie de `sendLead`-aanroep door:

```ts
    const res = await sendLead(
      buildLeadPayload(cfg, 'whatsapp', { phone: normalized || undefined, message: s.message }, 'whatsapp_interceptor'),
      cfg.endpoint,
    );
```

en de `pushConversion`-regel door:

```ts
    pushConversion('whatsapp', normalized ? { phone: normalized } : {});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/interceptor-ui.test.ts`
Expected: PASS — de twee nieuwe tests plus alle bestaande interceptor-tests.

- [ ] **Step 7: Commit**

```bash
git add src/ui/interceptor.ts test/interceptor-ui.test.ts
git commit -m "feat: whatsappPhoneQuestion slaat de nummerstap over in de interceptor"
```

---

### Task 4: Vrijstelling betaalcheck

**Files:**
- Modify: `src/ui/leadbot.ts` (blokkade-blok in `submitWhatsApp`), `src/ui/interceptor.ts` (blokkade-blok in `submit`)
- Test: `test/leadbot.test.ts`, `test/interceptor-ui.test.ts`

**Interfaces:**
- Consumes: `cfg.subscriptionCheck` uit Task 1.
- Produces: niets voor latere taken.

- [ ] **Step 1: Write the failing tests**

Voeg toe in `test/interceptor-ui.test.ts`, direct ná de bestaande test `blocks the handoff on 403 (inactive subscription), like 404`:

```ts
  it('lets the handoff through on 403 and 404 when subscriptionCheck is off', async () => {
    for (const status of [403, 404]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
      const openSpy = vi.fn();
      vi.stubGlobal('open', openSpy);
      const { root } = freshMount({ subscriptionCheck: false });
      clickLink(addLink('https://wa.me/31698765432'));
      vi.setSystemTime(1_000_000 + 5000);
      (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
      q(root, '[data-action="wa-send"]')!.click();
      (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12345678';
      q(root, '[data-action="wa-phone-send"]')!.click();
      await vi.waitFor(() => expect(q(root, '.ltb-wi-handoff')).toBeTruthy());
      expect(q(root, '.ltb-wa-error')).toBeNull();
      expect(openSpy).toHaveBeenCalled();
      expect(window.dataLayer!.map((x) => x.event)).toContain('leadtrackr_leadbot_conversion');
    }
  });
```

Voeg toe in `test/leadbot.test.ts`, binnen `describe('whatsapp flow', ...)`:

```ts
  it('blocks the WhatsApp handoff on 403 by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const { root } = openWa();
    vi.setSystemTime(1_000_000 + 5000);
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    click(root, 'wa-send');
    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12345678';
    click(root, 'wa-phone-send');
    await vi.waitFor(() => expect(q(root, '.ltb-wa-error')).toBeTruthy());
    expect(openSpy).not.toHaveBeenCalled();
    expect(window.dataLayer!.map((e) => e.event)).not.toContain('leadtrackr_leadbot_conversion');
  });

  it('lets the WhatsApp handoff through on 403 when subscriptionCheck is off', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const m = freshMount({ subscriptionCheck: false });
    click(m.root, 'open');
    click(m.root, 'channel-whatsapp');
    vi.setSystemTime(1_000_000 + 5000);
    (q(m.root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    click(m.root, 'wa-send');
    (q(m.root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12345678';
    click(m.root, 'wa-phone-send');
    await vi.waitFor(() => expect(q(m.root, '.ltb-success')).toBeTruthy());
    expect(openSpy).toHaveBeenCalled();
    expect(window.dataLayer!.map((e) => e.event)).toContain('leadtrackr_leadbot_conversion');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/leadbot.test.ts test/interceptor-ui.test.ts`
Expected: FAIL op de twee `subscriptionCheck: false`-tests — de flow blokkeert nog steeds. De `blocks ... by default`-test slaagt al (dat is bestaand gedrag dat we vastleggen).

- [ ] **Step 3: Gate the block in the panel flow**

Vervang in `src/ui/leadbot.ts` in `submitWhatsApp` het volledige blokkade-blok (van `if (res.status === 404 || res.status === 403) {` tot en met de bijbehorende sluitende accolade) door:

```ts
    if (res.status === 404 || res.status === 403) {
      // De warn blijft altijd staan, ook bij een vrijgestelde klant: in de
      // console moet zichtbaar zijn wat de API zei.
      console.warn(
        '[LeadTrackr LeadBot] Lead geblokkeerd: ' +
          (res.status === 403 ? 'abonnement inactief (403)' : 'project niet gevonden (404)'),
      );
      if (cfg.subscriptionCheck) {
        wa.error = cfg.texts.errorBlocked;
        render();
        return;
      }
    }
```

- [ ] **Step 4: Gate the block in the interceptor**

Vervang in `src/ui/interceptor.ts` in `submit` het volledige blokkade-blok (van `if (res.status === 404 || res.status === 403) {` tot en met de bijbehorende sluitende accolade) door:

```ts
    if (res.status === 404 || res.status === 403) {
      // De warn blijft altijd staan, ook bij een vrijgestelde klant: in de
      // console moet zichtbaar zijn wat de API zei.
      console.warn(
        '[LeadTrackr LeadBot] Lead geblokkeerd: ' +
          (res.status === 403 ? 'abonnement inactief (403)' : 'project niet gevonden (404)'),
      );
      if (cfg.subscriptionCheck) {
        s.error = cfg.texts.errorBlocked;
        render();
        return;
      }
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/leadbot.test.ts test/interceptor-ui.test.ts`
Expected: PASS — inclusief de bestaande 403/404-blokkadetests, die het standaardgedrag bewaken.

- [ ] **Step 6: Commit**

```bash
git add src/ui/leadbot.ts src/ui/interceptor.ts test/leadbot.test.ts test/interceptor-ui.test.ts
git commit -m "feat: subscriptionCheck laat de flow door bij 403/404 voor vrijgestelde klanten"
```

---

### Task 5: Documentatie, versie en build

**Files:**
- Modify: `README.md` (sectie `## WhatsApp-flow`), `package.json:3`
- Test: volledige suite + build

**Interfaces:**
- Consumes: alles uit Tasks 1 t/m 4.
- Produces: `dist/lt-leadbot.min.js` op versie 1.7.0.

- [ ] **Step 1: Document `whatsappPhoneQuestion` in the README**

Voeg in `README.md` onder de sectie `## WhatsApp-flow`, ná de bestaande alinea, toe:

```markdown
- `whatsappPhoneQuestion: false` slaat de nummervraag over: de bezoeker gaat na zijn bericht direct door naar WhatsApp. De lead gaat nog steeds naar LeadTrackr — met bericht, pagina-context en attributie, alleen zonder telefoonnummer. Geldt voor zowel het WhatsApp-kanaal in het paneel als de interceptor. Afweging: meer doorstroom, maar een lead die je niet zelf kunt terugbellen.
```

`subscriptionCheck` komt hier bewust **niet** in.

- [ ] **Step 2: Bump the version**

Zet in `package.json` de `version` van `1.6.2` naar `1.7.0`.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — alle testbestanden, geen enkele failure.

- [ ] **Step 4: Build and check the bundle**

Run: `npm run build`
Expected: `dist/lt-leadbot.min.js` wordt geschreven; de banner in de output vermeldt `v1.7.0` en de regel toont de byte- en gzip-grootte.

Controleer daarna dat de nieuwe keys daadwerkelijk in het bundel staan (ze worden van een user-object gelezen, dus de strings overleven minificatie):

Run: `grep -c "whatsappPhoneQuestion" dist/lt-leadbot.min.js`
Expected: minstens `1`.

- [ ] **Step 5: Commit**

```bash
git add README.md package.json dist/lt-leadbot.min.js
git commit -m "docs: whatsappPhoneQuestion in de README + versie 1.7.0"
```
