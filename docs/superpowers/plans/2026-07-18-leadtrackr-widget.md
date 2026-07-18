# LeadTrackr Widget MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the LeadTrackr lead-generation widget (design 2A) as a single dependency-free IIFE bundle that posts leads to `app.leadtrackr.io/api/leads/createLead` with GTM-tag-compatible attribution.

**Architecture:** Vanilla TypeScript compiled by esbuild into one minified IIFE (`dist/lt-widget.min.js`). UI renders inside a Shadow DOM root with theme colors as CSS custom properties. Logic modules (cookies, channelflow, attribution, validate, config, payload, datalayer, transport) are pure and unit-tested with vitest/happy-dom; the UI layer (`src/ui/`) is a small state machine over HTML-string views, integration-tested through the shadow root.

**Tech Stack:** TypeScript 5, esbuild (build), vitest + happy-dom (tests). Zero runtime dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-leadtrackr-widget-design.md` (rev. 3). Visual source of truth: `design/LeadTrackr Widget.dc.html`, **option 2A only**.
- Zero runtime dependencies; bundle target ≤ 15 KB gzip; IIFE; esbuild target `es2019`.
- GTM-tag parity is a hard requirement: cookie `lt_channelflow` (max-age `395*86400`, raw JSON value, path `/`, broadest domain), channel classification order UTM → organic (google.com, bing.com, yahoo.com, duckduckgo.com, baidu.com) → referral → direct/none, click-ID fallbacks (`_gcl_aw`/`_gcl_gb` `split('.')[2]`, `_fbc` reconstruction, `_fbp`, `_ga` → cid).
- Endpoint default: `https://app.leadtrackr.io/api/leads/createLead`; payload top-level keys exactly `projectId`, `formData`, `userData`, `channelFlow` (omit when empty), `attributionData`.
- dataLayer events: `leadtrackr_widget_open`, `leadtrackr_widget_channel_click`, `leadtrackr_widget_call_click`, `leadtrackr_widget_lead_submitted` (the last one includes `user_provided_data` in Google EC schema — PII intended).
- Channels: `message` (naam/e-mail/bericht), `call` (`tel:` + dataLayer only, no POST), `whatsapp` (compose → phone with country picker → POST lead → open `wa.me`).
- All default UI copy in Dutch, overridable via `texts` config; all colors overridable via `theme` config.
- Phone numbers normalized to E.164 before payload/dataLayer. Name split: first word → `firstName`, rest → `lastName`.
- Commit after every green test run. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

```
leadtrackr-widget/
  package.json  tsconfig.json  vitest.config.ts  build.mjs  .gitignore
  src/
    types.ts        # shared interfaces (Channel, LeadPayload, …)
    cookies.ts      # getCookie/setCookie (broadest-domain, raw values)
    channelflow.ts  # lt_channelflow port of the GTM tag
    attribution.ts  # gclid/wbraid/fbc/fbp/cid port of the GTM tag
    validate.ts     # COUNTRIES, normalizePhone (E.164), isValidEmail
    config.ts       # WidgetConfig + NL defaults + theme defaults + resolveConfig
    payload.ts      # splitName + buildLeadPayload
    datalayer.ts    # the four leadtrackr_widget_* pushes
    transport.ts    # sendLead POST
    index.ts        # entry: script-tag config, idle boot, channelflow update, mount
    ui/
      icons.ts      # inline SVG strings from design 2A
      styles.ts     # buildStyles(cfg): full CSS (design 2A) with CSS custom props
      views.ts      # esc() + HTML-string templates per state
      widget.ts     # mountWidget(cfg): shadow root, state machine, delegation
  test/             # vitest specs, one file per module
  demo/index.html   # fake client site  ·  demo/avatar.png
  dist/             # committed build output (jsDelivr serves this)
  .github/workflows/release.yml
  README.md
```

---

### Task 1: Scaffold + build pipeline + demo shell

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `build.mjs`, `.gitignore`, `src/index.ts` (stub), `src/types.ts`, `demo/index.html` (shell), `demo/avatar.png` (copy of `design/uploads/avatar.png`)

**Interfaces:**
- Produces: `npm run build` → `dist/lt-widget.min.js`; `npm run dev` → watch + http://localhost:4173 serving `demo/` with `POST /mock-lead`; `npm test` runs vitest. Global constant `LT_WIDGET_VERSION` (esbuild define + vitest define `"test"`). Types in `src/types.ts` used by every later task.

- [ ] **Step 1: Write config files**

`package.json`:

```json
{
  "name": "leadtrackr-widget",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "dev": "node build.mjs --watch",
    "test": "vitest run"
  },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "happy-dom": "^15.11.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2019",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "test"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { LT_WIDGET_VERSION: '"test"' },
  test: { environment: 'happy-dom', globals: true },
});
```

`.gitignore`:

```
node_modules/
```

`build.mjs`:

```js
import esbuild from 'esbuild';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const version = JSON.parse(readFileSync('./package.json', 'utf8')).version;
const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  outfile: 'dist/lt-widget.min.js',
  define: { LT_WIDGET_VERSION: JSON.stringify(version) },
  legalComments: 'none',
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/mock-lead') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        console.log('[mock-lead]', body);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end('{"ok":true}');
      });
      return;
    }
    const path = req.url === '/' ? '/demo/index.html' : req.url.split('?')[0];
    const file = join(process.cwd(), path);
    if (existsSync(file) && !file.includes('..')) {
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  }).listen(4173, () => console.log('dev server: http://localhost:4173'));
} else {
  await esbuild.build(options);
  const out = readFileSync(options.outfile);
  console.log(`${options.outfile}: ${out.length} bytes, ${gzipSync(out).length} bytes gzip`);
}
```

- [ ] **Step 2: Write `src/types.ts`**

```ts
export interface Channel {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  term?: string;
}

export interface ChannelFlowEntry {
  timestamp: number;
  channel: Channel;
}

export interface AttributionData {
  fbc: string;
  fbp: string;
  gclid: string;
  wbraid: string;
  cid: string;
}

export interface LeadUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export interface LeadPayload {
  projectId: string;
  formData: {
    formName: string;
    uniqueEventId: string;
    formFields: Record<string, string>;
  };
  userData: LeadUserData;
  channelFlow?: ChannelFlowEntry[];
  attributionData: AttributionData;
}

export type ChannelId = 'message' | 'call' | 'whatsapp';
```

- [ ] **Step 3: Write stub `src/index.ts`**

```ts
declare const LT_WIDGET_VERSION: string;

console.log('[LeadTrackr Widget] ' + LT_WIDGET_VERSION);
```

- [ ] **Step 4: Write `demo/index.html` shell**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demo — Klantsite met LeadTrackr Widget</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; color: #1F2937; background: #fff; }
  header { padding: 16px 32px; border-bottom: 1px solid #E5E7EB; font-weight: 700; }
  main { max-width: 720px; margin: 48px auto; padding: 0 24px; }
  a { color: #3E8762; }
  pre { background: #F3F4F6; padding: 12px; border-radius: 8px; font-size: 12px; overflow: auto; max-height: 240px; }
</style>
</head>
<body>
<header>Voorbeeld B.V.</header>
<main>
  <h1>Fake klantsite</h1>
  <p>Testlinks (herladen met attributie):</p>
  <ul>
    <li><a href="/?utm_source=google&utm_medium=cpc&utm_campaign=zomer&gclid=TESTGCLID123">Google Ads klik</a></li>
    <li><a href="/?utm_source=facebook&utm_medium=paid_social&fbclid=TESTFBCLID456">Meta klik</a></li>
    <li><a href="/">Direct</a></li>
  </ul>
  <h2>dataLayer</h2>
  <pre id="dl-log">(nog leeg)</pre>
</main>
<script>
  window.dataLayer = window.dataLayer || [];
  const origPush = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = function (entry) {
    document.getElementById('dl-log').textContent =
      JSON.stringify(window.dataLayer.concat([entry]), null, 2);
    return origPush(entry);
  };
  window.ltWidgetConfig = {
    companyName: 'Voorbeeld B.V.',
    agentName: 'Nick',
    agentPhoto: '/demo/avatar.png',
    greeting: 'Goedemiddag 👋 Waar kunnen we je mee helpen?',
    phone: '+31 20 123 4567',
    whatsapp: '+31612345678',
    endpoint: '/mock-lead'
  };
</script>
<script src="/dist/lt-widget.min.js" data-project-id="demo-project" async></script>
</body>
</html>
```

- [ ] **Step 5: Copy avatar, install, build, verify**

```bash
cp design/uploads/avatar.png demo/avatar.png
npm install
npm run build
```

Expected: `dist/lt-widget.min.js: <n> bytes, <m> bytes gzip` printed, file exists.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold build pipeline, demo shell, shared types"
```

---

### Task 2: `src/cookies.ts`

**Files:**
- Create: `src/cookies.ts`
- Test: `test/cookies.test.ts`

**Interfaces:**
- Produces: `getCookie(name: string): string | null`, `setCookie(name: string, value: string, maxAgeSeconds: number): void`. Values are stored **raw** (no URI encoding — GTM parity). `setCookie` sets `path=/` and the broadest domain that sticks (probe cookie), `secure` on https.

- [ ] **Step 1: Write the failing test** — `test/cookies.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { getCookie, setCookie } from '../src/cookies';

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('cookies', () => {
  beforeEach(clearCookies);

  it('returns null for a missing cookie', () => {
    expect(getCookie('nope')).toBeNull();
  });

  it('reads back what it writes, raw (no URI encoding)', () => {
    const json = '[{"timestamp":1,"channel":{"source":"direct","medium":"none"}}]';
    setCookie('lt_channelflow', json, 3600);
    expect(getCookie('lt_channelflow')).toBe(json);
  });

  it('finds the right cookie among several', () => {
    setCookie('a', '1', 3600);
    setCookie('ab', '2', 3600);
    expect(getCookie('a')).toBe('1');
    expect(getCookie('ab')).toBe('2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cookies.test.ts`
Expected: FAIL — cannot resolve `../src/cookies`.

- [ ] **Step 3: Write `src/cookies.ts`**

```ts
let cachedDomain: string | null | undefined;

export function getCookie(name: string): string | null {
  const prefix = name + '=';
  for (const part of document.cookie.split('; ')) {
    if (part.indexOf(prefix) === 0) return part.slice(prefix.length);
  }
  return null;
}

// GTM's domain:'auto' — highest domain a cookie sticks on, so subdomains share it.
function cookieDomain(): string | null {
  if (cachedDomain !== undefined) return cachedDomain;
  const parts = location.hostname.split('.');
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts.slice(i).join('.');
    document.cookie = 'ltw_probe=1;path=/;domain=' + candidate;
    if (getCookie('ltw_probe')) {
      document.cookie = 'ltw_probe=;path=/;domain=' + candidate + ';max-age=0';
      cachedDomain = candidate;
      return candidate;
    }
  }
  cachedDomain = null;
  return null;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  const domain = cookieDomain();
  document.cookie =
    name + '=' + value + ';path=/;max-age=' + maxAgeSeconds +
    (domain ? ';domain=' + domain : '') +
    (location.protocol === 'https:' ? ';secure' : '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/cookies.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cookies.ts test/cookies.test.ts && git commit -m "feat: cookie helpers with GTM-style broadest-domain writes"
```

---

### Task 3: `src/channelflow.ts`

**Files:**
- Create: `src/channelflow.ts`
- Test: `test/channelflow.test.ts`

**Interfaces:**
- Consumes: `getCookie`/`setCookie` from Task 2; `Channel`, `ChannelFlowEntry` from `src/types.ts`.
- Produces: `CHANNEL_FLOW_COOKIE = 'lt_channelflow'`; `classifyChannel(search: string, referrerHost: string, currentHost: string): Channel`; `readChannelFlow(): ChannelFlowEntry[]`; `updateChannelFlow(search: string, referrerHost: string, currentHost: string, now: number): void`; `updateChannelFlowFromPage(): void`.

- [ ] **Step 1: Write the failing test** — `test/channelflow.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHANNEL_FLOW_COOKIE,
  classifyChannel,
  readChannelFlow,
  updateChannelFlow,
} from '../src/channelflow';

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('classifyChannel (GTM-tag parity)', () => {
  it('returns full UTM object (all five keys) when any UTM is set', () => {
    expect(classifyChannel('?utm_source=google&utm_medium=cpc', '', 'klant.nl')).toEqual({
      source: 'google', medium: 'cpc', campaign: '', content: '', term: '',
    });
  });

  it('classifies known search engines as organic with bare domain as source', () => {
    expect(classifyChannel('', 'www.google.com', 'klant.nl')).toEqual({
      source: 'google', medium: 'organic',
    });
    expect(classifyChannel('', 'duckduckgo.com', 'klant.nl')).toEqual({
      source: 'duckduckgo', medium: 'organic',
    });
  });

  it('classifies an external referrer as referral with full host as source', () => {
    expect(classifyChannel('', 'blog.example.com', 'klant.nl')).toEqual({
      source: 'blog.example.com', medium: 'referral',
    });
  });

  it('classifies same-host referrer and empty referrer as direct/none', () => {
    expect(classifyChannel('', 'klant.nl', 'klant.nl')).toEqual({ source: 'direct', medium: 'none' });
    expect(classifyChannel('', '', 'klant.nl')).toEqual({ source: 'direct', medium: 'none' });
  });

  it('UTM wins over referrer', () => {
    expect(classifyChannel('?utm_source=nb&utm_medium=email', 'www.google.com', 'klant.nl').medium).toBe('email');
  });
});

describe('updateChannelFlow / readChannelFlow', () => {
  beforeEach(clearCookies);

  it('appends first entry and reads it back', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    expect(readChannelFlow()).toEqual([
      { timestamp: 1000, channel: { source: 'google', medium: 'cpc', campaign: '', content: '', term: '' } },
    ]);
  });

  it('keeps last channel on a later pageview without new UTMs (no re-classification)', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    updateChannelFlow('', 'www.google.com', 'klant.nl', 2000); // would be organic if reclassified
    const flow = readChannelFlow();
    expect(flow).toHaveLength(1);
    expect(flow[0].channel.medium).toBe('cpc');
  });

  it('appends a new entry when new UTM params differ', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    updateChannelFlow('?utm_source=nieuwsbrief&utm_medium=email', '', 'klant.nl', 2000);
    const flow = readChannelFlow();
    expect(flow).toHaveLength(2);
    expect(flow[1]).toEqual({
      timestamp: 2000,
      channel: { source: 'nieuwsbrief', medium: 'email', campaign: '', content: '', term: '' },
    });
  });

  it('does not append a duplicate of the same channel', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 2000);
    expect(readChannelFlow()).toHaveLength(1);
  });

  it('recovers from a corrupt cookie', () => {
    document.cookie = CHANNEL_FLOW_COOKIE + '=[broken json;path=/';
    expect(readChannelFlow()).toEqual([]);
    updateChannelFlow('', '', 'klant.nl', 1000);
    expect(readChannelFlow()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/channelflow.test.ts`
Expected: FAIL — cannot resolve `../src/channelflow`.

- [ ] **Step 3: Write `src/channelflow.ts`**

```ts
import { getCookie, setCookie } from './cookies';
import type { Channel, ChannelFlowEntry } from './types';

export const CHANNEL_FLOW_COOKIE = 'lt_channelflow';
const MAX_AGE_SECONDS = 395 * 86400;
const ORGANIC_ENGINES = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com'];
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function domainFromHost(host: string): string {
  const parts = host.split('.');
  return parts.length >= 2 ? parts[parts.length - 2] : host;
}

export function classifyChannel(search: string, referrerHost: string, currentHost: string): Channel {
  const p = new URLSearchParams(search);
  const utm: Channel = {
    source: p.get('utm_source') || '',
    medium: p.get('utm_medium') || '',
    campaign: p.get('utm_campaign') || '',
    content: p.get('utm_content') || '',
    term: p.get('utm_term') || '',
  };
  if (utm.source || utm.medium || utm.campaign || utm.content || utm.term) return utm;
  if (referrerHost) {
    for (const engine of ORGANIC_ENGINES) {
      if (referrerHost.indexOf(engine) > -1) {
        return { source: domainFromHost(referrerHost) || '(not set)', medium: 'organic' };
      }
    }
    if (currentHost && referrerHost !== currentHost) {
      return { source: referrerHost || '(not set)', medium: 'referral' };
    }
  }
  return { source: 'direct', medium: 'none' };
}

export function readChannelFlow(): ChannelFlowEntry[] {
  const raw = getCookie(CHANNEL_FLOW_COOKIE);
  if (!raw || raw.charAt(0) !== '[') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function updateChannelFlow(search: string, referrerHost: string, currentHost: string, now: number): void {
  const flow = readChannelFlow();
  const p = new URLSearchParams(search);
  const hasNewUtm = UTM_KEYS.some((k) => p.get(k));
  const last = flow[flow.length - 1];
  const channel = last && !hasNewUtm ? last.channel : classifyChannel(search, referrerHost, currentHost);
  if (!last || JSON.stringify(last.channel) !== JSON.stringify(channel)) {
    flow.push({ timestamp: now, channel });
  }
  setCookie(CHANNEL_FLOW_COOKIE, JSON.stringify(flow), MAX_AGE_SECONDS);
}

export function updateChannelFlowFromPage(): void {
  let referrerHost = '';
  try {
    if (document.referrer) referrerHost = new URL(document.referrer).host;
  } catch {
    /* invalid referrer */
  }
  updateChannelFlow(location.search, referrerHost, location.host, Date.now());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/channelflow.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/channelflow.ts test/channelflow.test.ts && git commit -m "feat: lt_channelflow port of the GTM tag (classification + journey cookie)"
```

---

### Task 4: `src/attribution.ts`

**Files:**
- Create: `src/attribution.ts`
- Test: `test/attribution.test.ts`

**Interfaces:**
- Consumes: `getCookie` (Task 2), `AttributionData` (types).
- Produces: `collectAttribution(search: string, hostname: string, now: number): AttributionData`; `collectAttributionFromPage(): AttributionData`.

- [ ] **Step 1: Write the failing test** — `test/attribution.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { collectAttribution } from '../src/attribution';

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('collectAttribution (GTM-tag parity)', () => {
  beforeEach(clearCookies);

  it('takes gclid and wbraid from the URL first', () => {
    const a = collectAttribution('?gclid=URLGCLID&wbraid=URLWBRAID', 'klant.nl', 1000);
    expect(a.gclid).toBe('URLGCLID');
    expect(a.wbraid).toBe('URLWBRAID');
  });

  it('falls back to _gcl_aw / _gcl_gb cookies (third dot-segment)', () => {
    document.cookie = '_gcl_aw=GCL.1719000000.COOKIEGCLID;path=/';
    document.cookie = '_gcl_gb=GCL.1719000000.COOKIEWBRAID;path=/';
    const a = collectAttribution('', 'klant.nl', 1000);
    expect(a.gclid).toBe('COOKIEGCLID');
    expect(a.wbraid).toBe('COOKIEWBRAID');
  });

  it('uses the _fbc cookie as-is when it matches the fbclid', () => {
    document.cookie = '_fbc=fb.1.111.MATCHING;path=/';
    const a = collectAttribution('?fbclid=MATCHING', 'klant.nl', 5000);
    expect(a.fbc).toBe('fb.1.111.MATCHING');
  });

  it('constructs fbc from fbclid when the cookie is missing or stale', () => {
    expect(collectAttribution('?fbclid=NEWID', 'www.klant.nl', 5000).fbc).toBe('fb.2.5000.NEWID');
    document.cookie = '_fbc=fb.1.111.OLDID;path=/';
    expect(collectAttribution('?fbclid=NEWID', 'klant.nl', 6000).fbc).toBe('fb.1.6000.NEWID');
  });

  it('parses the GA4 client id from the _ga cookie', () => {
    document.cookie = '_ga=GA1.1.1234567890.1719000000;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).cid).toBe('1234567890.1719000000');
  });

  it('degrades to empty strings when nothing is present', () => {
    expect(collectAttribution('', 'klant.nl', 1000)).toEqual({
      fbc: '', fbp: '', gclid: '', wbraid: '', cid: '',
    });
  });

  it('passes _fbp through untouched', () => {
    document.cookie = '_fbp=fb.1.1719000000.987654321;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).fbp).toBe('fb.1.1719000000.987654321');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/attribution.test.ts`
Expected: FAIL — cannot resolve `../src/attribution`.

- [ ] **Step 3: Write `src/attribution.ts`**

```ts
import { getCookie } from './cookies';
import type { AttributionData } from './types';

// GTM parity: parts.length-1 for subdomains, else 1.
function subDomainIndex(hostname: string): number {
  const parts = hostname.split('.');
  return parts.length > 2 ? parts.length - 1 : 1;
}

export function collectAttribution(search: string, hostname: string, now: number): AttributionData {
  const p = new URLSearchParams(search);

  let gclid = p.get('gclid') || '';
  if (!gclid) {
    const c = getCookie('_gcl_aw');
    gclid = c ? c.split('.')[2] || '' : '';
  }

  let wbraid = p.get('wbraid') || '';
  if (!wbraid) {
    const c = getCookie('_gcl_gb');
    wbraid = c ? c.split('.')[2] || '' : '';
  }

  let fbc = getCookie('_fbc') || '';
  const fbclid = p.get('fbclid');
  if (fbclid) {
    const current = fbc.split('.').pop();
    if (!fbc || current !== fbclid) {
      fbc = 'fb.' + subDomainIndex(hostname) + '.' + now + '.' + encodeURIComponent(fbclid);
    }
  }

  const fbp = getCookie('_fbp') || '';

  let cid = '';
  const ga = getCookie('_ga');
  if (ga) {
    const parts = ga.split('.');
    if (parts.length >= 4) cid = parts[2] + '.' + parts[3];
  }

  return { fbc, fbp, gclid, wbraid, cid };
}

export function collectAttributionFromPage(): AttributionData {
  return collectAttribution(location.search, location.hostname, Date.now());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/attribution.test.ts`
Expected: PASS (7 tests). Note the stale-fbc test expects `fb.1.6000.NEWID` on host `klant.nl` (2 parts → index 1) and `fb.2.5000.NEWID` on `www.klant.nl` (3 parts → index 2).

- [ ] **Step 5: Commit**

```bash
git add src/attribution.ts test/attribution.test.ts && git commit -m "feat: click-ID attribution port (gclid/wbraid/fbc/fbp/cid)"
```

---

### Task 5: `src/validate.ts`

**Files:**
- Create: `src/validate.ts`
- Test: `test/validate.test.ts`

**Interfaces:**
- Produces: `interface Country { code: string; name: string; dial: string; flag: string }`; `COUNTRIES: Country[]` (NL first); `normalizePhone(raw: string, dial: string): string | null` (E.164 or null); `isValidEmail(value: string): boolean`.

- [ ] **Step 1: Write the failing test** — `test/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COUNTRIES, isValidEmail, normalizePhone } from '../src/validate';

describe('normalizePhone', () => {
  it('converts NL national formats to E.164', () => {
    expect(normalizePhone('06 12345678', '+31')).toBe('+31612345678');
    expect(normalizePhone('020-123 4567', '+31')).toBe('+31201234567');
  });

  it('keeps international formats and converts 00-prefix', () => {
    expect(normalizePhone('+32 470 12 34 56', '+31')).toBe('+32470123456');
    expect(normalizePhone('0032470123456', '+31')).toBe('+32470123456');
  });

  it('uses the given dial code for bare numbers', () => {
    expect(normalizePhone('470123456', '+32')).toBe('+32470123456');
  });

  it('rejects garbage and too-short numbers', () => {
    expect(normalizePhone('06 12', '+31')).toBeNull();
    expect(normalizePhone('abc', '+31')).toBeNull();
    expect(normalizePhone('', '+31')).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('accepts normal addresses and rejects malformed ones', () => {
    expect(isValidEmail('jan@bedrijf.nl')).toBe(true);
    expect(isValidEmail('jan@bedrijf')).toBe(false);
    expect(isValidEmail('jan @bedrijf.nl')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('COUNTRIES', () => {
  it('starts with NL and contains dial codes', () => {
    expect(COUNTRIES[0].code).toBe('NL');
    expect(COUNTRIES[0].dial).toBe('+31');
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/validate.test.ts`
Expected: FAIL — cannot resolve `../src/validate`.

- [ ] **Step 3: Write `src/validate.ts`**

```ts
export interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'NL', name: 'Nederland', dial: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'België', dial: '+32', flag: '🇧🇪' },
  { code: 'DE', name: 'Deutschland', dial: '+49', flag: '🇩🇪' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'ES', name: 'España', dial: '+34', flag: '🇪🇸' },
  { code: 'IT', name: 'Italia', dial: '+39', flag: '🇮🇹' },
  { code: 'AT', name: 'Österreich', dial: '+43', flag: '🇦🇹' },
  { code: 'CH', name: 'Schweiz', dial: '+41', flag: '🇨🇭' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
];

export function normalizePhone(raw: string, dial: string): string | null {
  let v = raw.replace(/[\s\-().]/g, '');
  if (!v) return null;
  if (v.slice(0, 2) === '00') v = '+' + v.slice(2);
  if (v.charAt(0) !== '+') v = dial + v.replace(/^0/, '');
  return /^\+[1-9]\d{7,14}$/.test(v) ? v : null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/validate.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/validate.ts test/validate.test.ts && git commit -m "feat: phone E.164 normalization, email validation, country list"
```

---

### Task 6: `src/config.ts`

**Files:**
- Create: `src/config.ts`
- Test: `test/config.test.ts`

**Interfaces:**
- Consumes: `ChannelId` (types).
- Produces: `WidgetTheme` (keys: `primary`, `primaryHover`, `primaryTint`, `launcherBorder`, `headerBg`, `headerText`, `panelBg`, `text`, `textMuted`, `border`, `error`, `radius: number`); `WidgetTexts` (all NL strings, see code); `WidgetConfig`; `DEFAULT_ENDPOINT`; `resolveConfig(projectId: string, user?: Partial<WidgetConfig>): WidgetConfig`. Channels without required data are dropped (`call` needs `phone`, `whatsapp` needs `whatsapp`).

- [ ] **Step 1: Write the failing test** — `test/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_ENDPOINT, resolveConfig } from '../src/config';

describe('resolveConfig', () => {
  it('applies defaults with only a projectId', () => {
    const cfg = resolveConfig('p1', undefined);
    expect(cfg.projectId).toBe('p1');
    expect(cfg.endpoint).toBe(DEFAULT_ENDPOINT);
    expect(cfg.position).toBe('right');
    expect(cfg.theme.primary).toBe('#52B483');
    expect(cfg.texts.submit).toBe('Verstuur bericht');
    expect(cfg.channels).toEqual(['message']); // call/whatsapp dropped without numbers
  });

  it('keeps call and whatsapp channels when numbers are configured', () => {
    const cfg = resolveConfig('p1', { phone: '+31 20 123 4567', whatsapp: '+31612345678' });
    expect(cfg.channels).toEqual(['message', 'call', 'whatsapp']);
  });

  it('respects channel order and subset from config', () => {
    const cfg = resolveConfig('p1', { phone: '+3120', channels: ['call', 'message'] });
    expect(cfg.channels).toEqual(['call', 'message']);
  });

  it('merges partial theme and texts over defaults', () => {
    const cfg = resolveConfig('p1', {
      theme: { primary: '#FF0000' } as never,
      texts: { submit: 'Send' } as never,
    });
    expect(cfg.theme.primary).toBe('#FF0000');
    expect(cfg.theme.primaryHover).toBe('#3E8762');
    expect(cfg.texts.submit).toBe('Send');
    expect(cfg.texts.nameLabel).toBe('Naam');
  });

  it('keeps formNames overridable per channel', () => {
    const cfg = resolveConfig('p1', { formNames: { message: 'Custom' } as never });
    expect(cfg.formNames.message).toBe('Custom');
    expect(cfg.formNames.whatsapp).toBe('Widget — WhatsApp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/config.test.ts`
Expected: FAIL — cannot resolve `../src/config`.

- [ ] **Step 3: Write `src/config.ts`**

```ts
import type { ChannelId } from './types';

export interface WidgetTheme {
  primary: string;
  primaryHover: string;
  primaryTint: string;
  launcherBorder: string;
  headerBg: string;
  headerText: string;
  panelBg: string;
  text: string;
  textMuted: string;
  border: string;
  error: string;
  radius: number;
}

export interface WidgetTexts {
  from: string;
  online: string;
  launcherLabel: string;
  close: string;
  back: string;
  msgTitle: string;
  msgSub: string;
  callTitle: string;
  waTitle: string;
  waSub: string;
  waPlaceholder: string;
  waPhoneQuestion: string;
  waPhonePlaceholder: string;
  waSearchPlaceholder: string;
  formTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  submit: string;
  successTitle: string;
  successBody: string;
  successBack: string;
  errorRequired: string;
  errorEmail: string;
  errorPhone: string;
  errorSend: string;
}

export interface WidgetConfig {
  projectId: string;
  companyName: string;
  agentName: string;
  agentPhoto: string;
  greeting: string;
  phone: string | null;
  whatsapp: string | null;
  channels: ChannelId[];
  position: 'right' | 'left';
  offset: { bottom: number; side: number };
  teaser: boolean;
  defaultCountry: string;
  theme: WidgetTheme;
  formNames: Record<'message' | 'whatsapp', string>;
  texts: WidgetTexts;
  endpoint: string;
}

export const DEFAULT_ENDPOINT = 'https://app.leadtrackr.io/api/leads/createLead';

const DEFAULT_THEME: WidgetTheme = {
  primary: '#52B483',
  primaryHover: '#3E8762',
  primaryTint: '#EDF8F2',
  launcherBorder: '#52B483',
  headerBg: '#FFFFFF',
  headerText: '#020A24',
  panelBg: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  error: '#FF6A6A',
  radius: 16,
};

const DEFAULT_TEXTS: WidgetTexts = {
  from: 'van',
  online: 'Online — we reageren direct',
  launcherLabel: 'Neem contact op',
  close: 'Sluiten',
  back: 'Terug',
  msgTitle: 'Stuur een bericht',
  msgSub: 'We reageren zo snel mogelijk',
  callTitle: 'Bel ons direct',
  waTitle: 'WhatsApp',
  waSub: 'Chat direct met ons',
  waPlaceholder: 'Typ je bericht…',
  waPhoneQuestion: 'Top! Op welk nummer kunnen we je bereiken als het gesprek wegvalt?',
  waPhonePlaceholder: '6 12345678',
  waSearchPlaceholder: 'Zoek land…',
  formTitle: 'Stuur een bericht',
  nameLabel: 'Naam',
  namePlaceholder: 'Je naam',
  emailLabel: 'E-mailadres',
  emailPlaceholder: 'naam@bedrijf.nl',
  messageLabel: 'Bericht',
  messagePlaceholder: 'Waar kunnen we je mee helpen?',
  submit: 'Verstuur bericht',
  successTitle: 'Verzonden!',
  successBody: 'We nemen zo snel mogelijk contact met je op.',
  successBack: 'Terug naar start',
  errorRequired: 'Dit veld is verplicht',
  errorEmail: 'Vul een geldig e-mailadres in',
  errorPhone: 'Vul een geldig telefoonnummer in',
  errorSend: 'Versturen mislukt. Probeer het opnieuw.',
};

export function resolveConfig(projectId: string, user: Partial<WidgetConfig> | undefined): WidgetConfig {
  const u = user || {};
  const requested: ChannelId[] = u.channels && u.channels.length ? u.channels : ['message', 'call', 'whatsapp'];
  const channels = requested.filter((c) => {
    if (c === 'call') return Boolean(u.phone);
    if (c === 'whatsapp') return Boolean(u.whatsapp);
    return c === 'message';
  });
  return {
    projectId,
    companyName: u.companyName || '',
    agentName: u.agentName || '',
    agentPhoto: u.agentPhoto || '',
    greeting: u.greeting || 'Goedendag 👋 Waar kunnen we je mee helpen?',
    phone: u.phone || null,
    whatsapp: u.whatsapp || null,
    channels,
    position: u.position === 'left' ? 'left' : 'right',
    offset: { bottom: u.offset?.bottom ?? 20, side: u.offset?.side ?? 20 },
    teaser: u.teaser !== false,
    defaultCountry: u.defaultCountry || 'NL',
    theme: { ...DEFAULT_THEME, ...(u.theme || {}) },
    formNames: { message: 'Widget — Bericht', whatsapp: 'Widget — WhatsApp', ...(u.formNames || {}) },
    texts: { ...DEFAULT_TEXTS, ...(u.texts || {}) },
    endpoint: u.endpoint || DEFAULT_ENDPOINT,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config.ts test/config.test.ts && git commit -m "feat: config resolution with NL text and LeadTrackr theme defaults"
```

---

### Task 7: `src/payload.ts`

**Files:**
- Create: `src/payload.ts`
- Test: `test/payload.test.ts`

**Interfaces:**
- Consumes: `readChannelFlow` (Task 3), `collectAttributionFromPage` (Task 4), `WidgetConfig` (Task 6), types.
- Produces: `splitName(full: string): { firstName?: string; lastName?: string }`; `interface LeadFields { name?: string; email?: string; phone?: string; message?: string }`; `buildLeadPayload(cfg: WidgetConfig, channel: 'message' | 'whatsapp', fields: LeadFields): LeadPayload`.

- [ ] **Step 1: Write the failing test** — `test/payload.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { buildLeadPayload, splitName } from '../src/payload';
import { resolveConfig } from '../src/config';
import { updateChannelFlow } from '../src/channelflow';

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('splitName', () => {
  it('splits on the first space', () => {
    expect(splitName('Jan van Jansen')).toEqual({ firstName: 'Jan', lastName: 'van Jansen' });
  });
  it('puts single words in firstName', () => {
    expect(splitName('Jan')).toEqual({ firstName: 'Jan' });
  });
  it('returns empty object for blank input', () => {
    expect(splitName('  ')).toEqual({});
  });
});

describe('buildLeadPayload', () => {
  beforeEach(clearCookies);
  const cfg = resolveConfig('proj-1', { whatsapp: '+31612345678' });

  it('builds the GTM-contract payload for a message lead', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    const p = buildLeadPayload(cfg, 'message', {
      name: 'Jan Jansen',
      email: 'jan@bedrijf.nl',
      message: 'Hallo!',
    });
    expect(Object.keys(p).sort()).toEqual(['attributionData', 'channelFlow', 'formData', 'projectId', 'userData']);
    expect(p.projectId).toBe('proj-1');
    expect(p.formData.formName).toBe('Widget — Bericht');
    expect(p.formData.uniqueEventId).toMatch(/^ltw-\d+-[a-z0-9]+$/);
    expect(p.formData.formFields.message).toBe('Hallo!');
    expect(typeof p.formData.formFields.page_url).toBe('string');
    expect(p.userData).toEqual({ firstName: 'Jan', lastName: 'Jansen', email: 'jan@bedrijf.nl' });
    expect(p.channelFlow).toHaveLength(1);
    expect(p.attributionData).toEqual({ fbc: '', fbp: '', gclid: '', wbraid: '', cid: '' });
  });

  it('omits channelFlow when the cookie is empty and includes phone for whatsapp leads', () => {
    const p = buildLeadPayload(cfg, 'whatsapp', { phone: '+31612345678', message: 'Vraagje' });
    expect(p.channelFlow).toBeUndefined();
    expect(p.formData.formName).toBe('Widget — WhatsApp');
    expect(p.userData).toEqual({ phone: '+31612345678' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/payload.test.ts`
Expected: FAIL — cannot resolve `../src/payload`.

- [ ] **Step 3: Write `src/payload.ts`**

```ts
import { collectAttributionFromPage } from './attribution';
import { readChannelFlow } from './channelflow';
import type { WidgetConfig } from './config';
import type { LeadPayload, LeadUserData } from './types';

export function splitName(full: string): { firstName?: string; lastName?: string } {
  const trimmed = full.trim();
  if (!trimmed) return {};
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1) };
}

export interface LeadFields {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export function buildLeadPayload(
  cfg: WidgetConfig,
  channel: 'message' | 'whatsapp',
  fields: LeadFields,
): LeadPayload {
  const userData: LeadUserData = { ...splitName(fields.name || '') };
  if (fields.email) userData.email = fields.email;
  if (fields.phone) userData.phone = fields.phone;

  const formFields: Record<string, string> = {};
  if (fields.message) formFields.message = fields.message;
  formFields.page_url = location.href;
  formFields.page_title = document.title;

  const payload: LeadPayload = {
    projectId: cfg.projectId,
    formData: {
      formName: cfg.formNames[channel],
      uniqueEventId: 'ltw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      formFields,
    },
    userData,
    attributionData: collectAttributionFromPage(),
  };
  const flow = readChannelFlow();
  if (flow.length) payload.channelFlow = flow;
  return payload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/payload.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/payload.ts test/payload.test.ts && git commit -m "feat: lead payload assembly on the GTM createLead contract"
```

---

### Task 8: `src/datalayer.ts`

**Files:**
- Create: `src/datalayer.ts`
- Test: `test/datalayer.test.ts`

**Interfaces:**
- Consumes: `readChannelFlow`, `collectAttributionFromPage`, `splitName`, `WidgetConfig`, `ChannelId`; global `LT_WIDGET_VERSION`.
- Produces: `pushOpen(cfg)`, `pushChannelClick(cfg, channel: ChannelId)`, `pushCallClick(cfg)`, `pushLeadSubmitted(cfg, channel: 'message' | 'whatsapp', fields: { name?: string; email?: string; phone?: string })`. All create `window.dataLayer` if absent.

- [ ] **Step 1: Write the failing test** — `test/datalayer.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { pushCallClick, pushChannelClick, pushLeadSubmitted, pushOpen } from '../src/datalayer';
import { resolveConfig } from '../src/config';
import { updateChannelFlow } from '../src/channelflow';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('datalayer', () => {
  const cfg = resolveConfig('proj-1', { phone: '+31201234567' });

  beforeEach(() => {
    clearCookies();
    window.dataLayer = undefined;
  });

  it('creates dataLayer and pushes the open event', () => {
    pushOpen(cfg);
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer![0]).toMatchObject({
      event: 'leadtrackr_widget_open',
      leadtrackr: { project_id: 'proj-1', widget_version: 'test' },
    });
  });

  it('pushes channel_click and call_click', () => {
    pushChannelClick(cfg, 'whatsapp');
    pushCallClick(cfg);
    expect(window.dataLayer![0]).toMatchObject({
      event: 'leadtrackr_widget_channel_click',
      leadtrackr: { channel: 'whatsapp' },
    });
    expect(window.dataLayer![1]).toMatchObject({
      event: 'leadtrackr_widget_call_click',
      leadtrackr: { channel: 'call', phone_number: '+31201234567' },
    });
  });

  it('pushes lead_submitted with user_provided_data in Google EC schema and an attribution snapshot', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc&utm_campaign=zomer', '', 'klant.nl', 1000);
    pushLeadSubmitted(cfg, 'message', {
      name: 'Jan Jansen',
      email: 'jan@bedrijf.nl',
      phone: '+31612345678',
    });
    const e = window.dataLayer![0] as Record<string, never>;
    expect(e.event).toBe('leadtrackr_widget_lead_submitted');
    expect(e.user_provided_data).toEqual({
      email: 'jan@bedrijf.nl',
      phone_number: '+31612345678',
      address: [{ first_name: 'Jan', last_name: 'Jansen' }],
    });
    expect(e.leadtrackr).toMatchObject({
      channel: 'message',
      form_name: 'Widget — Bericht',
      attribution: { source: 'google', medium: 'cpc', campaign: 'zomer' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/datalayer.test.ts`
Expected: FAIL — cannot resolve `../src/datalayer`.

- [ ] **Step 3: Write `src/datalayer.ts`**

```ts
import { collectAttributionFromPage } from './attribution';
import { readChannelFlow } from './channelflow';
import type { WidgetConfig } from './config';
import { splitName } from './payload';
import type { ChannelId } from './types';

declare const LT_WIDGET_VERSION: string;

function push(data: Record<string, unknown>): void {
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  (w.dataLayer = w.dataLayer || []).push(data);
}

function base(cfg: WidgetConfig): Record<string, unknown> {
  return { project_id: cfg.projectId, widget_version: LT_WIDGET_VERSION };
}

function attributionSnapshot(): Record<string, string> {
  const flow = readChannelFlow();
  const channel = flow.length ? flow[flow.length - 1].channel : { source: '', medium: '' };
  const attr = collectAttributionFromPage();
  return {
    source: channel.source || '',
    medium: channel.medium || '',
    campaign: (channel as { campaign?: string }).campaign || '',
    gclid: attr.gclid,
    wbraid: attr.wbraid,
    fbclid: new URLSearchParams(location.search).get('fbclid') || '',
    ga_client_id: attr.cid,
  };
}

export function pushOpen(cfg: WidgetConfig): void {
  push({ event: 'leadtrackr_widget_open', leadtrackr: base(cfg) });
}

export function pushChannelClick(cfg: WidgetConfig, channel: ChannelId): void {
  push({ event: 'leadtrackr_widget_channel_click', leadtrackr: { ...base(cfg), channel } });
}

export function pushCallClick(cfg: WidgetConfig): void {
  push({
    event: 'leadtrackr_widget_call_click',
    leadtrackr: { ...base(cfg), channel: 'call', phone_number: cfg.phone },
  });
}

export function pushLeadSubmitted(
  cfg: WidgetConfig,
  channel: 'message' | 'whatsapp',
  fields: { name?: string; email?: string; phone?: string },
): void {
  const upd: Record<string, unknown> = {};
  if (fields.email) upd.email = fields.email;
  if (fields.phone) upd.phone_number = fields.phone;
  const { firstName, lastName } = splitName(fields.name || '');
  if (firstName || lastName) upd.address = [{ first_name: firstName || '', last_name: lastName || '' }];
  push({
    event: 'leadtrackr_widget_lead_submitted',
    leadtrackr: {
      ...base(cfg),
      channel,
      form_name: cfg.formNames[channel],
      attribution: attributionSnapshot(),
    },
    user_provided_data: upd,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/datalayer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/datalayer.ts test/datalayer.test.ts && git commit -m "feat: marketer-grade dataLayer events with Google EC user_provided_data"
```

---

### Task 9: `src/transport.ts`

**Files:**
- Create: `src/transport.ts`
- Test: `test/transport.test.ts`

**Interfaces:**
- Consumes: `LeadPayload` (types).
- Produces: `sendLead(payload: LeadPayload, endpoint: string): Promise<boolean>` — `true` on HTTP ok, `false` on non-ok or network error; never throws.

- [ ] **Step 1: Write the failing test** — `test/transport.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendLead } from '../src/transport';
import type { LeadPayload } from '../src/types';

const payload: LeadPayload = {
  projectId: 'p',
  formData: { formName: 'f', uniqueEventId: 'id', formFields: {} },
  userData: { email: 'a@b.nl' },
  attributionData: { fbc: '', fbp: '', gclid: '', wbraid: '', cid: '' },
};

afterEach(() => vi.unstubAllGlobals());

describe('sendLead', () => {
  it('POSTs JSON and resolves true on ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendLead(payload, 'https://x/lead')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://x/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });

  it('resolves false on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 }));
    await expect(sendLead(payload, 'https://x/lead')).resolves.toBe(false);
  });

  it('resolves false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(sendLead(payload, 'https://x/lead')).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/transport.test.ts`
Expected: FAIL — cannot resolve `../src/transport`.

- [ ] **Step 3: Write `src/transport.ts`**

```ts
import type { LeadPayload } from './types';

export async function sendLead(payload: LeadPayload, endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/transport.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/transport.ts test/transport.test.ts && git commit -m "feat: createLead transport"
```

---

### Task 10: UI foundation — icons, styles, views, mount, open/close/teaser

**Files:**
- Create: `src/ui/icons.ts`, `src/ui/styles.ts`, `src/ui/views.ts`, `src/ui/widget.ts`
- Test: `test/widget.test.ts`

**Interfaces:**
- Consumes: `WidgetConfig` (Task 6), `pushOpen`/`pushChannelClick`/`pushCallClick` (Task 8), `COUNTRIES` (Task 5).
- Produces: `mountWidget(cfg: WidgetConfig): void` — appends `<div id="lt-widget-host">` with open shadow root. Views navigate via `data-action` attributes handled by one delegated click listener. This task delivers: launcher + teaser (dismiss persists in `sessionStorage.ltw_teaser_dismissed`), channel panel with the channels from `cfg.channels`, call link (`tel:` + `pushCallClick`), Escape/× close, focus on close button after open, Cairo `<link id="ltw-cairo">` injected into `document.head` on first open. Message/WhatsApp views are wired in Tasks 11–12 but their templates are created here.

The full content of the four UI files is the implementation of design 2A; it is written once here and refined in Tasks 11–12 only where those tasks say so.

- [ ] **Step 1: Write the failing test** — `test/widget.test.ts` (this file grows in Tasks 11–12):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { mountWidget } from '../src/ui/widget';
import { resolveConfig } from '../src/config';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function freshMount(user: Parameters<typeof resolveConfig>[1] = {}) {
  document.getElementById('lt-widget-host')?.remove();
  document.getElementById('ltw-cairo')?.remove();
  sessionStorage.clear();
  window.dataLayer = [];
  const cfg = resolveConfig('proj-1', {
    companyName: 'Voorbeeld B.V.',
    agentName: 'Nick',
    agentPhoto: 'avatar.png',
    phone: '+31 20 123 4567',
    whatsapp: '+31612345678',
    endpoint: 'https://mock/lead',
    ...user,
  });
  mountWidget(cfg);
  const root = document.getElementById('lt-widget-host')!.shadowRoot!;
  return { cfg, root };
}

export const q = (root: ShadowRoot, sel: string) => root.querySelector(sel) as HTMLElement | null;
export const click = (root: ShadowRoot, action: string) =>
  q(root, `[data-action="${action}"]`)!.click();

describe('mount + launcher + panel', () => {
  beforeEach(() => {
    document.getElementById('lt-widget-host')?.remove();
  });

  it('mounts a shadow root with launcher and teaser', () => {
    const { root } = freshMount();
    expect(q(root, '[data-action="open"]')).toBeTruthy();
    expect(q(root, '.ltw-teaser')!.textContent).toContain('Nick');
  });

  it('hides the teaser after dismiss and remembers it in sessionStorage', () => {
    const { root } = freshMount();
    click(root, 'teaser-close');
    expect(q(root, '.ltw-teaser')).toBeNull();
    expect(sessionStorage.getItem('ltw_teaser_dismissed')).toBe('1');
  });

  it('opens the panel, pushes leadtrackr_widget_open, injects Cairo once', () => {
    const { root } = freshMount();
    click(root, 'open');
    expect(q(root, '.ltw-panel')).toBeTruthy();
    expect(window.dataLayer![0]).toMatchObject({ event: 'leadtrackr_widget_open' });
    expect(document.getElementById('ltw-cairo')).toBeTruthy();
    click(root, 'close');
    click(root, 'open');
    expect(document.querySelectorAll('#ltw-cairo')).toHaveLength(1);
  });

  it('shows the three channel buttons with agent header', () => {
    const { root } = freshMount();
    click(root, 'open');
    expect(q(root, '[data-action="channel-message"]')).toBeTruthy();
    expect(q(root, '[data-action="channel-call"]')!.getAttribute('href')).toBe('tel:+31201234567');
    expect(q(root, '[data-action="channel-whatsapp"]')).toBeTruthy();
    expect(q(root, '.ltw-header')!.textContent).toContain('Nick');
  });

  it('omits channels without configured numbers', () => {
    const { root } = freshMount({ whatsapp: null });
    click(root, 'open');
    expect(q(root, '[data-action="channel-whatsapp"]')).toBeNull();
  });

  it('call click pushes call_click with the business number', () => {
    const { root } = freshMount();
    click(root, 'open');
    q(root, '[data-action="channel-call"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const events = window.dataLayer!.map((e) => e.event);
    expect(events).toContain('leadtrackr_widget_call_click');
  });

  it('closes on Escape', () => {
    const { root } = freshMount();
    click(root, 'open');
    root.getElementById('ltw-container')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(q(root, '.ltw-panel')).toBeNull();
    expect(q(root, '[data-action="open"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/widget.test.ts`
Expected: FAIL — cannot resolve `../src/ui/widget`.

- [ ] **Step 3: Write `src/ui/icons.ts`**

```ts
// Stroke icons follow the design (Feather-style, stroke-width 1.8–2).
const S = (w: number, paths: string, sw = 2): string =>
  `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  chat: (w = 20) => S(w, '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>', 1.8),
  phone: (w = 20) =>
    S(w, '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>', 1.8),
  whatsapp: (w = 20) =>
    `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"></path></svg>`,
  chevronRight: (w = 18) => S(w, '<polyline points="9 18 15 12 9 6"></polyline>'),
  chevronDown: (w = 12) => S(w, '<polyline points="6 9 12 15 18 9"></polyline>'),
  close: (w = 15) => S(w, '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'),
  back: (w = 18) => S(w, '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>'),
  send: (w = 19) => S(w, '<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>'),
  check: (w = 13, sw = 3) => S(w, '<polyline points="20 6 9 17 4 12"></polyline>', sw),
  doubleCheck: (w = 14) =>
    `<svg width="${w}" height="${Math.round(w * 0.7)}" viewBox="0 0 18 12" fill="none" stroke="#53BDEB" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 6 4.5 9.5 11 3"></polyline><polyline points="7 6 10.5 9.5 17 3"></polyline></svg>`,
  errorInfo: (w = 13) =>
    S(w, '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'),
};
```

- [ ] **Step 4: Write `src/ui/styles.ts`** — the complete design-2A stylesheet:

```ts
import type { WidgetConfig } from '../config';

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(f, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function buildStyles(cfg: WidgetConfig): string {
  const t = cfg.theme;
  const side = cfg.position;
  const align = side === 'left' ? 'flex-start' : 'flex-end';
  return `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
#ltw-container { font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.4; color: var(--tx); }
button { background: none; border: none; cursor: pointer; font: inherit; color: inherit; }
a { text-decoration: none; color: inherit; }
img { display: block; }
input, textarea { font: inherit; color: var(--tx); }

#ltw-container {
  --p: ${t.primary}; --p-rgb: ${hexToRgb(t.primary)}; --ph: ${t.primaryHover};
  --tint: ${t.primaryTint}; --lb: ${t.launcherBorder};
  --hb: ${t.headerBg}; --ht: ${t.headerText}; --bg: ${t.panelBg};
  --tx: ${t.text}; --mut: ${t.textMuted}; --bd: ${t.border};
  --err: ${t.error}; --r: ${t.radius}px;
}

@keyframes ltw-pulse { 0% { box-shadow: 0 0 0 0 rgba(var(--p-rgb), .45); } 70% { box-shadow: 0 0 0 14px rgba(var(--p-rgb), 0); } 100% { box-shadow: 0 0 0 0 rgba(var(--p-rgb), 0); } }
@keyframes ltw-pop { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
@keyframes ltw-fade-up { 0% { transform: translateY(8px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }

.ltw-root {
  position: fixed; z-index: 2147483000;
  bottom: ${cfg.offset.bottom}px; ${side}: ${cfg.offset.side}px;
  display: flex; flex-direction: column; align-items: ${align}; gap: 14px;
}

/* ── Launcher + teaser (design 2A card 1) ── */
.ltw-teaser { position: relative; max-width: 260px; background: #fff; border: 1px solid var(--bd); border-radius: 14px 14px 4px 14px; padding: 13px 36px 13px 16px; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06); animation: ltw-fade-up .4s ease-out both; }
.ltw-root.ltw-left .ltw-teaser { border-radius: 14px 14px 14px 4px; }
.ltw-teaser-name { font-weight: 700; font-size: 13.5px; color: var(--ht); margin-bottom: 3px; }
.ltw-teaser-name span { font-weight: 400; color: var(--mut); }
.ltw-teaser-text { font-size: 14px; line-height: 1.5; }
.ltw-teaser-close { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 999px; color: #9CA3AF; display: flex; align-items: center; justify-content: center; transition: all .2s ease-out; }
.ltw-teaser-close:hover { background: #F3F4F6; color: var(--tx); }
.ltw-launcher { width: 62px; height: 62px; border-radius: 999px; border: 3px solid var(--lb); padding: 0; background: #fff; position: relative; box-shadow: 0 4px 12px rgba(var(--p-rgb), .35); animation: ltw-pulse 2.6s ease-out infinite; transition: transform .2s ease-out; }
.ltw-launcher:hover { transform: translateY(-1px); }
.ltw-launcher:focus-visible { outline: 2px solid var(--ht); outline-offset: 3px; }
.ltw-launcher img { width: 100%; height: 100%; border-radius: 999px; object-fit: cover; }
.ltw-launcher-fallback { width: 100%; height: 100%; border-radius: 999px; background: var(--tint); color: var(--ph); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22px; }
.ltw-launcher-badge { position: absolute; right: -2px; bottom: -2px; width: 22px; height: 22px; border-radius: 999px; background: var(--p); border: 2px solid #fff; display: flex; align-items: center; justify-content: center; color: #fff; }

/* ── Panel shell (design 2A cards 2–5) ── */
.ltw-overlay { display: none; }
.ltw-panel { width: 340px; max-width: calc(100vw - 24px); background: var(--bg); border-radius: var(--r); box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 12px 32px rgba(0,0,0,.12); overflow: hidden; animation: ltw-fade-up .25s ease-out both; }
.ltw-handle { display: none; }
.ltw-close { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; border-radius: 999px; color: #9CA3AF; display: flex; align-items: center; justify-content: center; transition: all .2s ease-out; }
.ltw-close:hover { background: #F3F4F6; color: var(--tx); }
.ltw-close:focus-visible, .ltw-back:focus-visible, .ltw-teaser-close:focus-visible { outline: 2px solid var(--p); outline-offset: 2px; }

/* Header met agent (card 2) */
.ltw-head { padding: 20px 18px 4px; position: relative; background: var(--hb); }
.ltw-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.ltw-avatar { position: relative; flex-shrink: 0; }
.ltw-avatar img, .ltw-avatar-fallback { width: 56px; height: 56px; border-radius: 999px; object-fit: cover; }
.ltw-avatar-fallback { background: var(--tint); color: var(--ph); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; }
.ltw-avatar-dot { position: absolute; right: 1px; bottom: 1px; width: 12px; height: 12px; border-radius: 999px; background: var(--p); border: 2px solid #fff; animation: ltw-pulse 2.6s ease-out infinite; }
.ltw-header-name { font-weight: 700; font-size: 16px; line-height: 1.3; color: var(--ht); }
.ltw-header-name span { font-weight: 400; color: var(--mut); }
.ltw-header-status { font-weight: 600; font-size: 12.5px; color: var(--ph); }
.ltw-greeting { background: #F3F4F6; border-radius: 4px 14px 14px 14px; padding: 12px 16px; margin-left: 8px; font-size: 14.5px; line-height: 1.5; }

/* Kanaal-knoppen */
.ltw-channels { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.ltw-channel { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 14px; border: 1px solid var(--bd); border-radius: 12px; background: var(--bg); transition: all .2s ease-out; width: 100%; text-align: left; }
.ltw-channel:hover { border-color: var(--p); background: var(--tint); }
.ltw-channel:focus-visible { outline: 2px solid var(--p); outline-offset: 2px; }
.ltw-channel-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--tint); color: var(--ph); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ltw-channel-body { min-width: 0; flex: 1; }
.ltw-channel-title { display: block; font-weight: 700; font-size: 15px; color: var(--ht); }
.ltw-channel-sub { display: block; font-size: 13px; color: var(--mut); }
.ltw-channel-chevron { color: #9CA3AF; flex-shrink: 0; display: flex; }

/* Branding footer */
.ltw-brand { display: flex; justify-content: center; align-items: center; padding: 2px 16px 12px; font-size: 11px; color: #9CA3AF; background: var(--bg); }
.ltw-brand a { font-weight: 700; color: var(--mut); transition: color .2s ease-out; }
.ltw-brand a:hover { color: var(--ph); }

/* ── Formulier-view (card 4) ── */
.ltw-viewhead { display: flex; align-items: center; gap: 8px; padding: 12px 18px; border-bottom: 1px solid #F3F4F6; background: var(--hb); }
.ltw-back { width: 32px; height: 32px; border-radius: 8px; color: var(--mut); display: flex; align-items: center; justify-content: center; transition: all .2s ease-out; }
.ltw-back:hover { background: #F3F4F6; color: var(--ht); }
.ltw-viewhead img { width: 30px; height: 30px; border-radius: 999px; object-fit: cover; }
.ltw-viewhead-title { font-weight: 700; font-size: 15px; color: var(--ht); }
.ltw-form { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.ltw-field label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 6px; }
.ltw-input, .ltw-textarea { width: 100%; border: 1.5px solid var(--bd); border-radius: 8px; font-size: 15px; background: #fff; outline: none; transition: border-color .2s ease-out; }
.ltw-input { height: 46px; padding: 0 14px; }
.ltw-textarea { padding: 11px 14px; line-height: 1.5; resize: none; }
.ltw-input:focus, .ltw-textarea:focus { border-color: var(--p); box-shadow: 0 0 0 1px var(--p); }
.ltw-field.ltw-invalid .ltw-input, .ltw-field.ltw-invalid .ltw-textarea { border-color: var(--err); background: #FFF7F7; box-shadow: 0 0 0 1px var(--err); }
.ltw-error { margin-top: 6px; font-weight: 600; font-size: 12.5px; color: #C23B3B; display: flex; align-items: center; gap: 5px; }
.ltw-submit { width: 100%; height: 48px; border-radius: 8px; background: var(--p); color: #fff; font-weight: 700; font-size: 15px; transition: all .2s ease-out; }
.ltw-submit:hover { background: var(--ph); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--p-rgb), .3); }
.ltw-submit:focus-visible { outline: 2px solid var(--ht); outline-offset: 2px; }
.ltw-submit[disabled] { opacity: .7; pointer-events: none; }
.ltw-sendfail { background: #FFF7F7; border-left: 3px solid var(--err); color: #C23B3B; font-size: 13px; font-weight: 600; padding: 8px 12px; border-radius: 4px; }
.ltw-hp { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }

/* ── WhatsApp-view (card 3) ── */
.ltw-wa-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #075E54; }
.ltw-wa-head .ltw-back { color: rgba(255,255,255,.85); }
.ltw-wa-head .ltw-back:hover { background: rgba(255,255,255,.12); color: #fff; }
.ltw-wa-head img { width: 38px; height: 38px; border-radius: 999px; object-fit: cover; flex-shrink: 0; }
.ltw-wa-head-name { font-weight: 700; font-size: 14.5px; line-height: 1.25; color: #fff; }
.ltw-wa-head-status { font-size: 11.5px; color: rgba(255,255,255,.75); }
.ltw-wa-head-icon { margin-left: auto; color: rgba(255,255,255,.85); display: flex; }
.ltw-wa-chat { background: #ECE5DD; padding: 14px; display: flex; flex-direction: column; gap: 10px; min-height: 120px; }
.ltw-wa-bubble { align-self: flex-start; max-width: 84%; background: #fff; border-radius: 0 10px 10px 10px; padding: 8px 12px; box-shadow: 0 1px 1px rgba(0,0,0,.08); font-size: 14px; line-height: 1.5; }
.ltw-wa-bubble.ltw-wa-sent { align-self: flex-end; background: #DCF8C6; border-radius: 10px 0 10px 10px; animation: ltw-fade-up .4s ease-out both; }
.ltw-wa-meta { margin-top: 2px; font-size: 10.5px; color: #9CA3AF; text-align: right; display: flex; justify-content: flex-end; align-items: center; gap: 3px; }
.ltw-wa-inputbar { display: flex; gap: 8px; align-items: center; padding: 10px; background: #F0F2F5; position: relative; }
.ltw-wa-input { flex: 1; min-width: 0; height: 44px; border: none; border-radius: 999px; padding: 0 16px; background: #fff; font-size: 14.5px; outline: none; }
.ltw-wa-input:focus { box-shadow: 0 0 0 2px #25D366; }
.ltw-wa-send { width: 44px; height: 44px; border-radius: 999px; background: #25D366; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .2s ease-out; }
.ltw-wa-send:hover { background: #1EBE5A; transform: translateY(-1px); }
.ltw-wa-send:focus-visible { outline: 2px solid #075E54; outline-offset: 2px; }
.ltw-wa-phonewrap { flex: 1; min-width: 0; display: flex; align-items: center; height: 44px; background: #fff; border-radius: 999px; overflow: hidden; }
.ltw-wa-cc { display: flex; align-items: center; gap: 5px; height: 100%; padding: 0 10px 0 14px; font-weight: 600; font-size: 14.5px; flex-shrink: 0; }
.ltw-wa-cc:hover { background: #F7F8FA; }
.ltw-wa-cc-divider { width: 1px; height: 22px; background: var(--bd); flex-shrink: 0; }
.ltw-wa-phone { flex: 1; min-width: 0; height: 100%; border: none; padding: 0 14px 0 10px; background: transparent; font-size: 14.5px; outline: none; }
.ltw-wa-picker { position: absolute; bottom: 60px; left: 10px; right: 10px; background: #fff; border-radius: 12px; box-shadow: 0 8px 24px rgba(2,10,36,.18); overflow: hidden; }
.ltw-wa-search { width: 100%; height: 38px; padding: 0 12px; border: none; border-bottom: 1px solid #F3F4F6; font-size: 13px; outline: none; background: #fff; }
.ltw-wa-list { display: flex; flex-direction: column; padding: 4px 0; max-height: 160px; overflow-y: auto; }
.ltw-wa-country { display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 13px; text-align: left; }
.ltw-wa-country:hover { background: #F7F8FA; }
.ltw-wa-country.ltw-selected { background: #F0F2F5; font-weight: 600; }
.ltw-wa-country .ltw-wa-country-name { flex: 1; }
.ltw-wa-country .ltw-wa-country-dial { color: var(--mut); }
.ltw-wa-error { padding: 0 12px 10px; background: #F0F2F5; }

/* ── Succes-view (card 5) ── */
.ltw-success { padding: 38px 28px 26px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; }
.ltw-success-avatar { position: relative; margin-bottom: 10px; animation: ltw-pop .5s ease-out both; }
.ltw-success-avatar img, .ltw-success-avatar .ltw-avatar-fallback { width: 68px; height: 68px; border-radius: 999px; object-fit: cover; }
.ltw-success-badge { position: absolute; right: -4px; bottom: -4px; width: 26px; height: 26px; border-radius: 999px; background: var(--p); border: 2.5px solid #fff; display: flex; align-items: center; justify-content: center; color: #fff; }
.ltw-success-title { font-weight: 700; font-size: 18px; color: var(--ht); }
.ltw-success-body { font-size: 14px; line-height: 1.55; color: #4B5563; }
.ltw-success-back { margin-top: 12px; font-weight: 700; font-size: 14px; color: var(--ph); display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 8px; }
.ltw-success-back:hover { color: var(--p); }

/* ── Mobiel: bottom sheet (card 6) ── */
@media (max-width: 480px) {
  .ltw-overlay { display: block; position: fixed; inset: 0; background: rgba(2,10,36,.35); }
  .ltw-panel { position: fixed; left: 0; right: 0; bottom: 0; width: 100%; max-width: 100%; border-radius: 20px 20px 0 0; box-shadow: 0 -8px 30px rgba(2,10,36,.18); }
  .ltw-handle { display: flex; justify-content: center; padding: 8px 0 0; background: var(--hb); }
  .ltw-handle span { width: 36px; height: 4px; border-radius: 999px; background: var(--bd); }
}
`;
}
```

- [ ] **Step 5: Write `src/ui/views.ts`** — all templates (message/WhatsApp templates included now, wired in Tasks 11–12):

```ts
import type { WidgetConfig } from '../config';
import type { Country } from '../validate';
import { COUNTRIES } from '../validate';
import { icons } from './icons';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function avatar(cfg: WidgetConfig, cls: string): string {
  if (cfg.agentPhoto) return `<img src="${esc(cfg.agentPhoto)}" alt="">`;
  const initial = esc((cfg.agentName || cfg.companyName || 'L').charAt(0).toUpperCase());
  return `<div class="${cls}">${initial}</div>`;
}

function agentLine(cfg: WidgetConfig): string {
  const company = cfg.companyName
    ? ` <span>${esc(cfg.texts.from)} ${esc(cfg.companyName)}</span>`
    : '';
  return `${esc(cfg.agentName || cfg.companyName)}${company}`;
}

export function brandFooter(): string {
  return `<div class="ltw-brand"><span>Better leads start with&nbsp;</span><a href="https://leadtrackr.io" target="_blank" rel="noopener">LeadTrackr.io</a><span>&nbsp;🚀</span></div>`;
}

export function launcherView(cfg: WidgetConfig, showTeaser: boolean): string {
  const teaser = showTeaser
    ? `<div class="ltw-teaser">
         <p class="ltw-teaser-name">${agentLine(cfg)}</p>
         <p class="ltw-teaser-text">${esc(cfg.greeting)}</p>
         <button class="ltw-teaser-close" data-action="teaser-close" aria-label="${esc(cfg.texts.close)}">${icons.close(14)}</button>
       </div>`
    : '';
  return `${teaser}
    <button class="ltw-launcher" data-action="open" aria-label="${esc(cfg.texts.launcherLabel)}" aria-expanded="false">
      ${avatar(cfg, 'ltw-launcher-fallback')}
      <span class="ltw-launcher-badge">${icons.chat(11)}</span>
    </button>`;
}

function channelButton(action: string, icon: string, title: string, sub: string, href?: string): string {
  const tag = href ? 'a' : 'button';
  const hrefAttr = href ? ` href="${esc(href)}"` : ' type="button"';
  return `<${tag} class="ltw-channel" data-action="${action}"${hrefAttr}>
    <span class="ltw-channel-icon">${icon}</span>
    <span class="ltw-channel-body">
      <span class="ltw-channel-title">${esc(title)}</span>
      <span class="ltw-channel-sub">${esc(sub)}</span>
    </span>
    <span class="ltw-channel-chevron">${icons.chevronRight(18)}</span>
  </${tag}>`;
}

export function panelView(cfg: WidgetConfig): string {
  const t = cfg.texts;
  const buttons = cfg.channels
    .map((c) => {
      if (c === 'message') return channelButton('channel-message', icons.chat(20), t.msgTitle, t.msgSub);
      if (c === 'call')
        return channelButton('channel-call', icons.phone(20), t.callTitle, cfg.phone || '', 'tel:' + (cfg.phone || '').replace(/[\s-]/g, ''));
      return channelButton('channel-whatsapp', icons.whatsapp(20), t.waTitle, t.waSub);
    })
    .join('');
  return `
  <div class="ltw-handle"><span></span></div>
  <div class="ltw-head">
    <button class="ltw-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(15)}</button>
    <div class="ltw-header">
      <div class="ltw-avatar">${avatar(cfg, 'ltw-avatar-fallback')}<span class="ltw-avatar-dot"></span></div>
      <div>
        <p class="ltw-header-name">${agentLine(cfg)}</p>
        <p class="ltw-header-status">${esc(t.online)}</p>
      </div>
    </div>
    <div class="ltw-greeting">${esc(cfg.greeting)}</div>
  </div>
  <div class="ltw-channels">${buttons}</div>
  ${brandFooter()}`;
}

export interface FormState {
  values: { name: string; email: string; message: string };
  errors: Record<string, string>;
  sending: boolean;
  sendFailed: boolean;
}

function field(
  id: string,
  label: string,
  control: string,
  error: string | undefined,
  cfg: WidgetConfig,
): string {
  return `<div class="ltw-field${error ? ' ltw-invalid' : ''}">
    <label for="${id}">${esc(label)}</label>
    ${control}
    ${error ? `<p class="ltw-error" role="alert">${icons.errorInfo(13)} ${esc(error)}</p>` : ''}
  </div>`;
}

export function messageView(cfg: WidgetConfig, s: FormState): string {
  const t = cfg.texts;
  return `
  <div class="ltw-handle"><span></span></div>
  <div class="ltw-viewhead">
    <button class="ltw-back" data-action="back" aria-label="${esc(t.back)}">${icons.back(18)}</button>
    ${avatar(cfg, 'ltw-avatar-fallback')}
    <p class="ltw-viewhead-title">${esc(t.formTitle)}</p>
  </div>
  <form class="ltw-form" data-form="message" novalidate>
    ${s.sendFailed ? `<div class="ltw-sendfail" role="alert">${esc(t.errorSend)}</div>` : ''}
    ${field('ltw-name', t.nameLabel, `<input class="ltw-input" id="ltw-name" name="name" type="text" placeholder="${esc(t.namePlaceholder)}" value="${esc(s.values.name)}">`, s.errors.name, cfg)}
    ${field('ltw-email', t.emailLabel, `<input class="ltw-input" id="ltw-email" name="email" type="email" placeholder="${esc(t.emailPlaceholder)}" value="${esc(s.values.email)}">`, s.errors.email, cfg)}
    ${field('ltw-message', t.messageLabel, `<textarea class="ltw-textarea" id="ltw-message" name="message" rows="3" placeholder="${esc(t.messagePlaceholder)}">${esc(s.values.message)}</textarea>`, s.errors.message, cfg)}
    <div class="ltw-hp" aria-hidden="true"><input name="ltw_website" type="text" tabindex="-1" autocomplete="off"></div>
    <button class="ltw-submit" type="submit"${s.sending ? ' disabled' : ''}>${esc(s.sending ? '…' : t.submit)}</button>
  </form>
  ${brandFooter()}`;
}

export interface WaState {
  step: 'compose' | 'phone';
  message: string;
  phone: string;
  country: Country;
  pickerOpen: boolean;
  search: string;
  error: string | null;
  sending: boolean;
}

export function whatsappView(cfg: WidgetConfig, s: WaState): string {
  const t = cfg.texts;
  const sent =
    s.step === 'phone'
      ? `<div class="ltw-wa-bubble ltw-wa-sent">${esc(s.message)}<p class="ltw-wa-meta">${icons.doubleCheck(14)}</p></div>
         <div class="ltw-wa-bubble">${esc(t.waPhoneQuestion)}</div>`
      : '';
  const countries = COUNTRIES.filter(
    (c) =>
      !s.search ||
      c.name.toLowerCase().includes(s.search.toLowerCase()) ||
      c.dial.includes(s.search),
  )
    .map(
      (c) => `<button type="button" class="ltw-wa-country${c.code === s.country.code ? ' ltw-selected' : ''}" data-action="wa-country" data-country="${c.code}">
        ${c.flag} <span class="ltw-wa-country-name">${esc(c.name)}</span> <span class="ltw-wa-country-dial">${c.dial}</span>
        ${c.code === s.country.code ? `<span style="color:#25D366;display:flex">${icons.check(13, 2.4)}</span>` : ''}
      </button>`,
    )
    .join('');
  const inputBar =
    s.step === 'compose'
      ? `<div class="ltw-wa-inputbar">
          <input class="ltw-wa-input" data-wa="message" aria-label="${esc(t.waPlaceholder)}" placeholder="${esc(t.waPlaceholder)}" value="${esc(s.message)}">
          <button type="button" class="ltw-wa-send" data-action="wa-send" aria-label="${esc(t.waTitle)}">${icons.send(19)}</button>
        </div>`
      : `${s.pickerOpen
          ? `<div class="ltw-wa-picker">
              <input class="ltw-wa-search" data-wa="search" placeholder="${esc(t.waSearchPlaceholder)}" value="${esc(s.search)}">
              <div class="ltw-wa-list">${countries}</div>
            </div>`
          : ''}
        <div class="ltw-wa-inputbar">
          <div class="ltw-wa-phonewrap">
            <button type="button" class="ltw-wa-cc" data-action="wa-cc-toggle" aria-label="Landcode">${s.country.flag} ${s.country.dial} ${icons.chevronDown(12)}</button>
            <span class="ltw-wa-cc-divider"></span>
            <input class="ltw-wa-phone" data-wa="phone" type="tel" aria-label="${esc(t.waPhonePlaceholder)}" placeholder="${esc(t.waPhonePlaceholder)}" value="${esc(s.phone)}">
          </div>
          <button type="button" class="ltw-wa-send" data-action="wa-phone-send" aria-label="${esc(t.waTitle)}"${s.sending ? ' disabled' : ''}>${icons.send(19)}</button>
        </div>
        ${s.error ? `<div class="ltw-wa-error"><p class="ltw-error" role="alert">${icons.errorInfo(13)} ${esc(s.error)}</p></div>` : ''}`;
  return `
  <div class="ltw-handle"><span></span></div>
  <div class="ltw-wa-head">
    <button class="ltw-back" data-action="back" aria-label="${esc(t.back)}">${icons.back(18)}</button>
    ${avatar(cfg, 'ltw-avatar-fallback')}
    <div>
      <p class="ltw-wa-head-name">${esc(cfg.agentName || cfg.companyName)}</p>
      <p class="ltw-wa-head-status">${esc(t.online)}</p>
    </div>
    <span class="ltw-wa-head-icon">${icons.whatsapp(22)}</span>
  </div>
  <div class="ltw-wa-chat">
    <div class="ltw-wa-bubble">${esc(cfg.greeting)}</div>
    ${sent}
  </div>
  ${inputBar}`;
}

export function successView(cfg: WidgetConfig): string {
  const t = cfg.texts;
  return `
  <div class="ltw-handle"><span></span></div>
  <div style="position:relative">
    <button class="ltw-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(15)}</button>
    <div class="ltw-success">
      <div class="ltw-success-avatar">
        ${avatar(cfg, 'ltw-avatar-fallback')}
        <span class="ltw-success-badge">${icons.check(13)}</span>
      </div>
      <p class="ltw-success-title">${esc(t.successTitle)}</p>
      <p class="ltw-success-body">${esc(t.successBody)}</p>
      <button class="ltw-success-back" data-action="back">${icons.back(15)} ${esc(t.successBack)}</button>
    </div>
  </div>
  ${brandFooter()}`;
}
```

- [ ] **Step 6: Write `src/ui/widget.ts`** — mount, state machine, delegation (message/WhatsApp handlers land in Tasks 11–12; this task wires launcher/panel/call/close):

```ts
import type { WidgetConfig } from '../config';
import { pushCallClick, pushChannelClick, pushLeadSubmitted, pushOpen } from '../datalayer';
import { buildLeadPayload } from '../payload';
import { sendLead } from '../transport';
import { COUNTRIES } from '../validate';
import { isValidEmail, normalizePhone } from '../validate';
import { buildStyles } from './styles';
import type { FormState, WaState } from './views';
import { launcherView, messageView, panelView, successView, whatsappView } from './views';

type View = 'closed' | 'panel' | 'message' | 'whatsapp' | 'success';

const TEASER_KEY = 'ltw_teaser_dismissed';
const MIN_OPEN_MS = 2000;

export function mountWidget(cfg: WidgetConfig): void {
  if (document.getElementById('lt-widget-host')) return;

  const host = document.createElement('div');
  host.id = 'lt-widget-host';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = buildStyles(cfg);
  const container = document.createElement('div');
  container.id = 'ltw-container';
  shadow.append(style, container);
  document.body.appendChild(host);

  let view: View = 'closed';
  let openedAt = 0;
  let fontInjected = false;

  const form: FormState = {
    values: { name: '', email: '', message: '' },
    errors: {},
    sending: false,
    sendFailed: false,
  };
  const wa: WaState = {
    step: 'compose',
    message: '',
    phone: '',
    country: COUNTRIES.find((c) => c.code === cfg.defaultCountry) || COUNTRIES[0],
    pickerOpen: false,
    search: '',
    error: null,
    sending: false,
  };

  function teaserVisible(): boolean {
    try {
      return cfg.teaser && sessionStorage.getItem(TEASER_KEY) !== '1';
    } catch {
      return cfg.teaser;
    }
  }

  function injectFont(): void {
    if (fontInjected || document.getElementById('ltw-cairo')) return;
    fontInjected = true;
    const link = document.createElement('link');
    link.id = 'ltw-cairo';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }

  function render(): void {
    const sideClass = cfg.position === 'left' ? ' ltw-left' : '';
    if (view === 'closed') {
      container.innerHTML = `<div class="ltw-root${sideClass}">${launcherView(cfg, teaserVisible())}</div>`;
      return;
    }
    const inner =
      view === 'panel'
        ? panelView(cfg)
        : view === 'message'
          ? messageView(cfg, form)
          : view === 'whatsapp'
            ? whatsappView(cfg, wa)
            : successView(cfg);
    container.innerHTML = `<div class="ltw-root${sideClass}"><div class="ltw-overlay" data-action="close"></div><div class="ltw-panel" role="dialog" aria-modal="true">${inner}</div></div>`;
    const closeBtn = container.querySelector<HTMLElement>('[data-action="close"], [data-action="back"]');
    if (closeBtn && closeBtn.classList.contains('ltw-overlay') === false) closeBtn.focus();
  }

  function open(): void {
    view = 'panel';
    openedAt = Date.now();
    injectFont();
    pushOpen(cfg);
    render();
  }

  function close(): void {
    view = 'closed';
    render();
    container.querySelector<HTMLElement>('[data-action="open"]')?.focus();
  }

  function readFormInputs(): void {
    form.values.name = (container.querySelector<HTMLInputElement>('[name="name"]')?.value || '').trim();
    form.values.email = (container.querySelector<HTMLInputElement>('[name="email"]')?.value || '').trim();
    form.values.message = (container.querySelector<HTMLTextAreaElement>('[name="message"]')?.value || '').trim();
  }

  async function submitMessage(): Promise<void> {
    readFormInputs();
    const t = cfg.texts;
    form.errors = {};
    if (!form.values.name) form.errors.name = t.errorRequired;
    if (!form.values.email) form.errors.email = t.errorRequired;
    else if (!isValidEmail(form.values.email)) form.errors.email = t.errorEmail;
    if (!form.values.message) form.errors.message = t.errorRequired;
    if (Object.keys(form.errors).length) {
      form.sendFailed = false;
      render();
      return;
    }
    const honeypot = container.querySelector<HTMLInputElement>('[name="ltw_website"]')?.value;
    if (honeypot || Date.now() - openedAt < MIN_OPEN_MS) {
      view = 'success';
      render();
      return;
    }
    form.sending = true;
    form.sendFailed = false;
    render();
    const ok = await sendLead(buildLeadPayload(cfg, 'message', form.values), cfg.endpoint);
    form.sending = false;
    if (ok) {
      pushLeadSubmitted(cfg, 'message', { name: form.values.name, email: form.values.email });
      form.values = { name: '', email: '', message: '' };
      view = 'success';
    } else {
      form.sendFailed = true;
    }
    render();
  }

  function readWaInputs(): void {
    const msg = container.querySelector<HTMLInputElement>('[data-wa="message"]');
    if (msg) wa.message = msg.value.trim();
    const phone = container.querySelector<HTMLInputElement>('[data-wa="phone"]');
    if (phone) wa.phone = phone.value.trim();
  }

  function openWhatsApp(text: string): void {
    const number = (cfg.whatsapp || '').replace(/\D/g, '');
    window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  async function submitWhatsApp(): Promise<void> {
    readWaInputs();
    const normalized = normalizePhone(wa.phone, wa.country.dial);
    if (!normalized) {
      wa.error = cfg.texts.errorPhone;
      render();
      return;
    }
    wa.error = null;
    if (Date.now() - openedAt < MIN_OPEN_MS) {
      view = 'success';
      render();
      return;
    }
    wa.sending = true;
    render();
    const ok = await sendLead(
      buildLeadPayload(cfg, 'whatsapp', { phone: normalized, message: wa.message }),
      cfg.endpoint,
    );
    wa.sending = false;
    if (ok) {
      pushLeadSubmitted(cfg, 'whatsapp', { phone: normalized });
      openWhatsApp(wa.message);
      wa.step = 'compose';
      wa.message = '';
      wa.phone = '';
      view = 'success';
      render();
    } else {
      wa.error = cfg.texts.errorSend;
      render();
    }
  }

  container.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action')!;
    switch (action) {
      case 'open':
        open();
        break;
      case 'close':
        close();
        break;
      case 'teaser-close':
        try {
          sessionStorage.setItem(TEASER_KEY, '1');
        } catch {
          /* ignore */
        }
        render();
        break;
      case 'back':
        view = 'panel';
        wa.error = null;
        form.errors = {};
        form.sendFailed = false;
        render();
        break;
      case 'channel-message':
        pushChannelClick(cfg, 'message');
        view = 'message';
        render();
        break;
      case 'channel-call':
        pushChannelClick(cfg, 'call');
        pushCallClick(cfg);
        break; // native tel: navigation continues
      case 'channel-whatsapp':
        pushChannelClick(cfg, 'whatsapp');
        view = 'whatsapp';
        wa.step = 'compose';
        render();
        break;
      case 'wa-send':
        readWaInputs();
        if (wa.message) {
          wa.step = 'phone';
          render();
          container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
        }
        break;
      case 'wa-phone-send':
        void submitWhatsApp();
        break;
      case 'wa-cc-toggle':
        readWaInputs();
        wa.pickerOpen = !wa.pickerOpen;
        wa.search = '';
        render();
        break;
      case 'wa-country': {
        const code = target.getAttribute('data-country');
        const country = COUNTRIES.find((c) => c.code === code);
        if (country) wa.country = country;
        wa.pickerOpen = false;
        render();
        container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
        break;
      }
    }
  });

  container.addEventListener('submit', (e) => {
    e.preventDefault();
    if ((e.target as HTMLElement).getAttribute('data-form') === 'message') void submitMessage();
  });

  container.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.getAttribute('data-wa') === 'search') {
      wa.search = el.value;
      const needle = wa.search.toLowerCase();
      container.querySelectorAll<HTMLElement>('.ltw-wa-country').forEach((btn) => {
        btn.style.display = btn.textContent!.toLowerCase().includes(needle) ? '' : 'none';
      });
    }
  });

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view !== 'closed') {
      close();
      return;
    }
    if (e.key === 'Tab' && view !== 'closed') {
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>('button, a[href], input, textarea'),
      ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = shadow.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  container.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    if (e.key === 'Enter' && el.getAttribute('data-wa') === 'message') {
      e.preventDefault();
      container.querySelector<HTMLElement>('[data-action="wa-send"]')?.click();
    }
    if (e.key === 'Enter' && el.getAttribute('data-wa') === 'phone') {
      e.preventDefault();
      container.querySelector<HTMLElement>('[data-action="wa-phone-send"]')?.click();
    }
  });

  render();
}
```

- [ ] **Step 7: Run the Task 10 tests**

Run: `npx vitest run test/widget.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Run the whole suite + build**

Run: `npx vitest run && npm run build`
Expected: all green; gzip size printed (must be ≤ 15000 bytes).

- [ ] **Step 9: Commit**

```bash
git add src/ui test/widget.test.ts && git commit -m "feat: shadow-DOM UI — launcher, teaser, channel panel, call channel (design 2A)"
```

---

### Task 11: Message-form flow tests (validation, honeypot, submit, retry)

**Files:**
- Modify: `test/widget.test.ts` (append a describe block)
- The implementation already landed in Task 10 (`submitMessage` in `src/ui/widget.ts`); this task proves it and fixes whatever fails.

**Interfaces:**
- Consumes: `freshMount`, `q`, `click` helpers from Task 10's test file.

- [ ] **Step 1: Append the failing tests** to `test/widget.test.ts`:

```ts
import { vi } from 'vitest';

describe('message form flow', () => {
  const openForm = (user = {}) => {
    const m = freshMount(user);
    click(m.root, 'open');
    click(m.root, 'channel-message');
    return m;
  };
  const fill = (root: ShadowRoot, name: string, value: string) => {
    const el = root.querySelector(`[name="${name}"]`) as HTMLInputElement;
    el.value = value;
  };
  const submit = (root: ShadowRoot) =>
    root.querySelector('[data-form="message"]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows validation errors and keeps values', async () => {
    const { root } = openForm();
    fill(root, 'email', 'nietgeldig');
    fill(root, 'message', 'Hoi');
    submit(root);
    await Promise.resolve();
    expect(q(root, '.ltw-field.ltw-invalid')).toBeTruthy();
    expect(root.querySelectorAll('.ltw-error')).toHaveLength(2); // name required + email invalid
    expect((root.querySelector('[name="message"]') as HTMLTextAreaElement).value).toBe('Hoi');
  });

  it('sends the lead, pushes lead_submitted and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { root } = openForm();
    vi.setSystemTime(1_000_000 + 5000); // past the 2s bot check
    fill(root, 'name', 'Jan Jansen');
    fill(root, 'email', 'jan@bedrijf.nl');
    fill(root, 'message', 'Ik heb een vraag');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltw-success')).toBeTruthy());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.projectId).toBe('proj-1');
    expect(body.userData).toEqual({ firstName: 'Jan', lastName: 'Jansen', email: 'jan@bedrijf.nl' });
    expect(body.formData.formFields.message).toBe('Ik heb een vraag');
    const events = window.dataLayer!.map((e) => e.event);
    expect(events).toContain('leadtrackr_widget_lead_submitted');
  });

  it('drops the lead silently when the honeypot is filled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { root } = openForm();
    vi.setSystemTime(1_000_000 + 5000);
    fill(root, 'name', 'Bot');
    fill(root, 'email', 'bot@spam.nl');
    fill(root, 'message', 'spam');
    fill(root, 'ltw_website', 'https://spam.example');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltw-success')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops the lead silently when submitted within 2s of opening', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { root } = openForm();
    fill(root, 'name', 'Snel');
    fill(root, 'email', 'snel@bot.nl');
    fill(root, 'message', 'x');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltw-success')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a retry banner when the endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { root } = openForm();
    vi.setSystemTime(1_000_000 + 5000);
    fill(root, 'name', 'Jan');
    fill(root, 'email', 'jan@bedrijf.nl');
    fill(root, 'message', 'Hoi');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltw-sendfail')).toBeTruthy());
    expect(window.dataLayer!.map((e) => e.event)).not.toContain('leadtrackr_widget_lead_submitted');
  });
});
```

- [ ] **Step 2: Run and fix until green**

Run: `npx vitest run test/widget.test.ts`
Expected: PASS. If a test fails, fix `src/ui/widget.ts` (not the test) unless the test contradicts the spec.

- [ ] **Step 3: Commit**

```bash
git add test/widget.test.ts src/ui && git commit -m "test: message-form flow — validation, honeypot, time-check, retry"
```

---

### Task 12: WhatsApp flow tests (compose → phone → lead → wa.me)

**Files:**
- Modify: `test/widget.test.ts` (append a describe block)
- Implementation landed in Task 10 (`submitWhatsApp`); this task proves it.

- [ ] **Step 1: Append the failing tests** to `test/widget.test.ts`:

```ts
describe('whatsapp flow', () => {
  const openWa = () => {
    const m = freshMount();
    click(m.root, 'open');
    click(m.root, 'channel-whatsapp');
    return m;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the WhatsApp compose view with greeting', () => {
    const { root } = openWa();
    expect(q(root, '.ltw-wa-chat')!.textContent).toContain('Waar kunnen we je mee helpen?');
    expect(q(root, '[data-wa="message"]')).toBeTruthy();
  });

  it('moves to the phone step after typing and sending a message', () => {
    const { root } = openWa();
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Wat kost het?';
    click(root, 'wa-send');
    expect(q(root, '.ltw-wa-sent')!.textContent).toContain('Wat kost het?');
    expect(q(root, '[data-wa="phone"]')).toBeTruthy();
  });

  it('switches country via the picker', () => {
    const { root } = openWa();
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    click(root, 'wa-send');
    click(root, 'wa-cc-toggle');
    (root.querySelector('[data-country="BE"]') as HTMLElement).click();
    expect(q(root, '.ltw-wa-cc')!.textContent).toContain('+32');
  });

  it('rejects an invalid phone number with an inline error', () => {
    const { root } = openWa();
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    click(root, 'wa-send');
    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12';
    click(root, 'wa-phone-send');
    expect(q(root, '.ltw-wa-error')!.textContent).toContain('geldig telefoonnummer');
  });

  it('POSTs the lead first, then opens wa.me with the typed message, then shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const { root } = openWa();
    vi.setSystemTime(1_000_000 + 5000);
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Wat kost het?';
    click(root, 'wa-send');
    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12345678';
    click(root, 'wa-phone-send');
    await vi.waitFor(() => expect(q(root, '.ltw-success')).toBeTruthy());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.formData.formName).toBe('Widget — WhatsApp');
    expect(body.userData.phone).toBe('+31612345678');
    expect(body.formData.formFields.message).toBe('Wat kost het?');
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/31612345678?text=' + encodeURIComponent('Wat kost het?'),
      '_blank',
      'noopener',
    );
    const lead = window.dataLayer!.find((e) => e.event === 'leadtrackr_widget_lead_submitted') as never;
    expect(lead).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run and fix until green**

Run: `npx vitest run test/widget.test.ts`
Expected: PASS (all widget tests).

- [ ] **Step 3: Commit**

```bash
git add test/widget.test.ts src/ui && git commit -m "test: whatsapp flow — compose, country picker, lead-before-wa.me"
```

---

### Task 13: Entry point + boot + full-suite verification

**Files:**
- Modify: `src/index.ts` (replace the stub)
- Test: `test/index.test.ts`

**Interfaces:**
- Consumes: `resolveConfig`, `updateChannelFlowFromPage`, `mountWidget`.
- Produces: self-executing entry. Reads `data-project-id` from its own `<script>` (fallback `window.ltWidgetConfig.projectId`), warns and aborts without one, guards double-load via `window.__ltWidgetLoaded`, boots on idle after DOM ready: first `updateChannelFlowFromPage()`, then `mountWidget(...)`.

- [ ] **Step 1: Write the failing test** — `test/index.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('boot()', () => {
  beforeEach(() => {
    vi.resetModules();
    document.getElementById('lt-widget-host')?.remove();
    (window as never as Record<string, unknown>).__ltWidgetLoaded = undefined;
    (window as never as Record<string, unknown>).ltWidgetConfig = undefined;
    for (const part of document.cookie.split('; ')) {
      const name = part.split('=')[0];
      if (name) document.cookie = name + '=;max-age=0;path=/';
    }
  });

  it('warns and does not mount without a projectId', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { boot } = await import('../src/index');
    boot(null);
    expect(warn).toHaveBeenCalled();
    expect(document.getElementById('lt-widget-host')).toBeNull();
    warn.mockRestore();
  });

  it('mounts the widget and writes the channelflow cookie with a projectId', async () => {
    const { boot } = await import('../src/index');
    boot('proj-x');
    expect(document.getElementById('lt-widget-host')).toBeTruthy();
    expect(document.cookie).toContain('lt_channelflow=');
  });

  it('does not mount twice', async () => {
    const { boot } = await import('../src/index');
    boot('proj-x');
    boot('proj-x');
    expect(document.querySelectorAll('#lt-widget-host')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/index.test.ts`
Expected: FAIL — `boot` is not exported.

- [ ] **Step 3: Replace `src/index.ts`**

```ts
import { resolveConfig, type WidgetConfig } from './config';
import { updateChannelFlowFromPage } from './channelflow';
import { mountWidget } from './ui/widget';

declare global {
  interface Window {
    ltWidgetConfig?: Partial<WidgetConfig>;
    __ltWidgetLoaded?: boolean;
  }
}

export function boot(projectId: string | null): void {
  if (!projectId) {
    console.warn('[LeadTrackr Widget] data-project-id ontbreekt — widget niet geladen.');
    return;
  }
  if (window.__ltWidgetLoaded) return;
  window.__ltWidgetLoaded = true;
  updateChannelFlowFromPage();
  mountWidget(resolveConfig(projectId, window.ltWidgetConfig));
}

const script = document.currentScript as HTMLScriptElement | null;
if (script) {
  const projectId =
    script.getAttribute('data-project-id') || window.ltWidgetConfig?.projectId || null;
  const start = () => boot(projectId);
  const idle = () =>
    'requestIdleCallback' in window
      ? (window as unknown as { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(start, { timeout: 2000 })
      : setTimeout(start, 200);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', idle);
  } else {
    idle();
  }
}
```

(The `if (script)` guard means importing the module in tests does not auto-boot — `document.currentScript` is null there.)

- [ ] **Step 4: Run the full suite, typecheck, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests green, no type errors, gzip ≤ 15000 bytes.

- [ ] **Step 5: Manual demo verification**

Run: `npm run dev`, open `http://localhost:4173/?utm_source=google&utm_medium=cpc&gclid=TESTGCLID123`.
Checklist: teaser + pulserende launcher rechtsonder → open → panel met Nick/avatar/3 kanalen → bericht-flow met validatiefout → succes; WhatsApp-flow compose → telefoon met landcode → mock-lead gelogd in terminal → wa.me opent; dataLayer-log op de pagina toont alle vier events; `document.cookie` bevat `lt_channelflow` met google/cpc.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts test/index.test.ts && git commit -m "feat: entry boot — script-tag config, idle init, double-load guard"
```

---

### Task 14: README, release workflow, final verification

**Files:**
- Create: `README.md`, `.github/workflows/release.yml`
- Modify: none

- [ ] **Step 1: Write `.github/workflows/release.yml`**

```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Committed dist must match the build
        run: git diff --exit-code dist/
```

- [ ] **Step 2: Write `README.md`** covering: what the widget is, the install snippet (jsDelivr `@1` URL + `data-project-id`), the full `window.ltWidgetConfig` reference (all keys + defaults), the four dataLayer events with the lead-push example, the payload contract note (GTM-tag parity), release flow (`npm version minor` → `npm run build` → commit dist → `git tag vX.Y.Z` → push met tag), and local dev (`npm run dev`).

- [ ] **Step 3: Final verification**

Run: `npx vitest run && npm run build && git status --short`
Expected: all green; working tree only shows intended files.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: README + release verification workflow"
```

---

## Self-Review Notes

- Spec §2/§7 (endpoint, contract keys, channel-specific fields) → Tasks 7, 9, 11, 12. Spec §6 (channelflow + click-IDs, GTM parity) → Tasks 3–4. Spec §5 (config/theme/texts) → Task 6 + styles in Task 10. Spec §8 (dataLayer + PII) → Task 8 + assertions in 11/12. Spec §4 (design 2A states incl. error state from 1A, mobile sheet, a11y) → Task 10. Spec §9 (perf: idle boot, lazy font, size budget) → Tasks 10/13. Spec §3 (jsDelivr/dist/tags) → Task 14. Spec §11 parity test tegen de GTM-tag: gedekt op logica-niveau (Tasks 3–4 porten exact dezelfde regels met parity-asserties); een browser-side-by-side fixture is handoff-werk.
- Type consistency checked: `WaState`/`FormState` shared between views and widget; `boot(projectId)` exported for tests; helpers `freshMount`/`q`/`click` exported from the widget test file and reused in Tasks 11–12 (same file, appended blocks).
