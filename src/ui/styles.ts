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
.ltw-viewhead .ltw-avatar-fallback { width: 30px; height: 30px; font-size: 13px; }
.ltw-viewhead-title { font-weight: 700; font-size: 15px; color: var(--ht); }
.ltw-form { padding: 18px; display: flex; flex-direction: column; gap: 12px; position: relative; }
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
.ltw-wa-head .ltw-avatar-fallback { width: 38px; height: 38px; font-size: 15px; }
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
.ltw-wa-send[disabled] { opacity: .7; pointer-events: none; }
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
.ltw-wa-error .ltw-error { margin-top: 0; }

/* ── Succes-view (card 5) ── */
.ltw-success { padding: 38px 28px 26px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; }
.ltw-success-avatar { position: relative; margin-bottom: 10px; animation: ltw-pop .5s ease-out both; }
.ltw-success-avatar img, .ltw-success-avatar .ltw-avatar-fallback { width: 68px; height: 68px; border-radius: 999px; object-fit: cover; font-size: 24px; }
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
