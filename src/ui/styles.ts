import type { LeadBotConfig } from '../config';

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(f, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function buildStyles(cfg: LeadBotConfig): string {
  const t = cfg.theme;
  const side = cfg.position;
  const align = side === 'left' ? 'flex-start' : 'flex-end';
  return `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
#ltb-container { font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.4; color: var(--tx); }
button { background: none; border: none; cursor: pointer; font: inherit; color: inherit; }
a { text-decoration: none; color: inherit; }
img { display: block; }
input, textarea, select { font: inherit; color: var(--tx); }
::placeholder { color: #9CA3AF; opacity: 1; }

#ltb-container {
  --p: ${t.primary}; --p-rgb: ${hexToRgb(t.primary)}; --ph: ${t.primaryHover};
  --tint: ${t.primaryTint}; --lb: ${t.launcherBorder};
  --hb: ${t.headerBg}; --ht: ${t.headerText}; --bg: ${t.panelBg};
  --tx: ${t.text}; --mut: ${t.textMuted}; --bd: ${t.border};
  --err: ${t.error}; --r: ${t.radius}px;
}

@keyframes ltb-pulse { 0% { box-shadow: 0 0 0 0 rgba(var(--p-rgb), .45); } 70% { box-shadow: 0 0 0 14px rgba(var(--p-rgb), 0); } 100% { box-shadow: 0 0 0 0 rgba(var(--p-rgb), 0); } }
@keyframes ltb-pop { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
@keyframes ltb-fade-up { 0% { transform: translateY(8px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
@keyframes ltb-fade { 0% { opacity: 0; } 100% { opacity: 1; } }

.ltb-root {
  position: fixed; z-index: 2147483000;
  bottom: ${cfg.offset.bottom}px; ${side}: ${cfg.offset.side}px;
  display: flex; flex-direction: column; align-items: ${align}; gap: 14px;
}

/* ── Launcher + teaser ── */
.ltb-teaser { position: relative; max-width: 280px; background: #fff; border: 1px solid var(--bd); border-radius: 14px 14px 4px 14px; padding: 14px 38px 14px 16px; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06); animation: ltb-fade-up .4s ease-out both; }
.ltb-root.ltb-left .ltb-teaser { border-radius: 14px 14px 14px 4px; }
.ltb-teaser-name { font-weight: 700; font-size: 13.5px; color: var(--ht); margin-bottom: 3px; }
.ltb-teaser-name span { font-weight: 400; color: var(--mut); }
.ltb-teaser-text { font-size: 14px; line-height: 1.5; }
.ltb-teaser-close { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 999px; color: #9CA3AF; display: flex; align-items: center; justify-content: center; transition: all .2s ease-out; }
.ltb-teaser-close:hover { background: #F3F4F6; color: var(--tx); }
.ltb-launcher { width: 62px; height: 62px; border-radius: 999px; border: 3px solid var(--lb); padding: 0; background: #fff; position: relative; box-shadow: 0 4px 12px rgba(var(--p-rgb), .35); animation: ltb-pulse 2.6s ease-out infinite; transition: transform .2s ease-out; }
.ltb-launcher:hover { transform: translateY(-1px); }
.ltb-launcher:focus-visible { outline: 2px solid var(--ht); outline-offset: 3px; }
.ltb-launcher img { width: 100%; height: 100%; border-radius: 999px; object-fit: cover; }
.ltb-launcher-fallback { width: 100%; height: 100%; border-radius: 999px; background: var(--tint); color: var(--ph); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22px; }
.ltb-launcher-badge { position: absolute; right: -2px; bottom: -2px; width: 22px; height: 22px; border-radius: 999px; background: var(--p); border: 2px solid #fff; display: flex; align-items: center; justify-content: center; color: #fff; }

/* ── Panel shell ── */
.ltb-overlay { display: none; }
.ltb-panel { width: 360px; max-width: calc(100vw - 24px); max-height: calc(100vh - 40px); overflow-y: auto; background: var(--bg); border-radius: var(--r); box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 16px 40px rgba(2,10,36,.16); animation: ltb-fade-up .25s ease-out both; }
.ltb-view { animation: ltb-fade-up .28s ease-out both; }
.ltb-handle { display: none; }
.ltb-close { position: absolute; top: 14px; right: 14px; width: 30px; height: 30px; border-radius: 999px; color: #9CA3AF; display: flex; align-items: center; justify-content: center; transition: all .2s ease-out; }
.ltb-close:hover { background: #F3F4F6; color: var(--tx); }
.ltb-close:focus-visible, .ltb-back:focus-visible, .ltb-teaser-close:focus-visible { outline: 2px solid var(--p); outline-offset: 2px; }

/* Header met agent */
.ltb-head { padding: 22px 20px 6px; position: relative; background: var(--hb); }
.ltb-header { display: flex; align-items: center; gap: 13px; margin-bottom: 16px; padding-right: 30px; }
.ltb-avatar { position: relative; flex-shrink: 0; }
.ltb-avatar img, .ltb-avatar-fallback { width: 56px; height: 56px; border-radius: 999px; object-fit: cover; }
.ltb-avatar-fallback { background: var(--tint); color: var(--ph); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; }
.ltb-avatar-dot { position: absolute; right: 1px; bottom: 1px; width: 12px; height: 12px; border-radius: 999px; background: var(--p); border: 2px solid #fff; animation: ltb-pulse 2.6s ease-out infinite; }
.ltb-header-name { font-weight: 700; font-size: 16px; line-height: 1.3; color: var(--ht); }
.ltb-header-name span { font-weight: 400; color: var(--mut); }
.ltb-header-status { font-weight: 600; font-size: 12.5px; color: var(--ph); margin-top: 1px; }
.ltb-greeting { background: #F3F4F6; border-radius: 4px 14px 14px 14px; padding: 12px 16px; margin-left: 8px; font-size: 14.5px; line-height: 1.5; }

/* Kanaal-knoppen */
.ltb-channels { padding: 18px 20px 6px; display: flex; flex-direction: column; gap: 10px; }
.ltb-channel { display: flex; align-items: center; gap: 13px; min-height: 58px; padding: 8px 14px; border: 1px solid var(--bd); border-radius: 12px; background: var(--bg); transition: border-color .2s ease-out, background .2s ease-out, transform .2s ease-out; width: 100%; text-align: left; }
.ltb-channel:hover { border-color: var(--p); background: var(--tint); transform: translateY(-1px); }
.ltb-channel:focus-visible { outline: 2px solid var(--p); outline-offset: 2px; }
.ltb-channel-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--tint); color: var(--ph); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ltb-channel-body { min-width: 0; flex: 1; }
.ltb-channel-title { display: block; font-weight: 700; font-size: 15px; color: var(--ht); }
.ltb-channel-sub { display: block; font-size: 13px; color: var(--mut); margin-top: 1px; }
.ltb-channel-chevron { color: #9CA3AF; flex-shrink: 0; display: flex; }

/* Branding footer */
.ltb-brand { display: flex; justify-content: center; align-items: center; padding: 10px 16px 14px; font-size: 11px; color: #9CA3AF; background: var(--bg); }
.ltb-brand a { font-weight: 700; color: var(--mut); transition: color .2s ease-out; }
.ltb-brand a:hover { color: var(--ph); }

/* ── Formulier-view ── */
.ltb-viewhead { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid #F3F4F6; background: var(--hb); }
.ltb-back { width: 32px; height: 32px; border-radius: 8px; color: var(--mut); display: flex; align-items: center; justify-content: center; transition: all .2s ease-out; margin-left: -6px; }
.ltb-back:hover { background: #F3F4F6; color: var(--ht); }
.ltb-viewhead img { width: 30px; height: 30px; border-radius: 999px; object-fit: cover; }
.ltb-viewhead .ltb-avatar-fallback { width: 30px; height: 30px; font-size: 13px; }
.ltb-viewhead-title { font-weight: 700; font-size: 15px; color: var(--ht); }
.ltb-form { padding: 20px; display: flex; flex-direction: column; gap: 14px; position: relative; }
.ltb-field label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 6px; color: var(--ht); }
.ltb-input, .ltb-textarea { width: 100%; border: 1.5px solid var(--bd); border-radius: 8px; font-size: 15px; background: #fff; outline: none; transition: border-color .2s ease-out, box-shadow .2s ease-out; }
.ltb-input { height: 46px; padding: 0 14px; }
.ltb-textarea { padding: 11px 14px; line-height: 1.5; resize: none; }
.ltb-input:focus, .ltb-textarea:focus { border-color: var(--p); box-shadow: 0 0 0 3px rgba(var(--p-rgb), .15); }
.ltb-field.ltb-invalid .ltb-input, .ltb-field.ltb-invalid .ltb-textarea { border-color: var(--err); background: #FFF7F7; box-shadow: 0 0 0 3px rgba(255,106,106,.12); }
.ltb-error { margin-top: 6px; font-weight: 600; font-size: 12.5px; color: #C23B3B; display: flex; align-items: center; gap: 5px; }
.ltb-submit { width: 100%; height: 48px; border-radius: 8px; background: var(--p); color: #fff; font-weight: 700; font-size: 15px; transition: all .2s ease-out; margin-top: 2px; }
.ltb-submit:hover { background: var(--ph); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--p-rgb), .3); }
.ltb-submit:active { transform: translateY(0); box-shadow: none; }
.ltb-submit:focus-visible { outline: 2px solid var(--ht); outline-offset: 2px; }
.ltb-submit[disabled] { opacity: .7; pointer-events: none; }
.ltb-sendfail { background: #FFF7F7; border-left: 3px solid var(--err); color: #C23B3B; font-size: 13px; font-weight: 600; padding: 10px 12px; border-radius: 6px; }
.ltb-hp { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }

/* ── WhatsApp-view ── */
.ltb-wa-head { display: flex; align-items: center; gap: 11px; padding: 13px 16px; background: #075E54; }
.ltb-wa-head .ltb-back { color: rgba(255,255,255,.85); margin-left: -4px; }
.ltb-wa-head .ltb-back:hover { background: rgba(255,255,255,.12); color: #fff; }
.ltb-wa-head img { width: 38px; height: 38px; border-radius: 999px; object-fit: cover; flex-shrink: 0; }
.ltb-wa-head .ltb-avatar-fallback { width: 38px; height: 38px; font-size: 15px; }
.ltb-wa-head-name { font-weight: 700; font-size: 14.5px; line-height: 1.25; color: #fff; }
.ltb-wa-head-status { font-size: 11.5px; color: rgba(255,255,255,.75); }
.ltb-wa-head-icon { margin-left: auto; color: rgba(255,255,255,.85); display: flex; }
.ltb-wa-chat { background: #ECE5DD; padding: 16px 14px; display: flex; flex-direction: column; gap: 11px; min-height: 140px; }
.ltb-wa-bubble { align-self: flex-start; max-width: 84%; background: #fff; border-radius: 0 10px 10px 10px; padding: 9px 13px; box-shadow: 0 1px 1px rgba(0,0,0,.08); font-size: 14px; line-height: 1.5; }
.ltb-wa-bubble.ltb-wa-sent { align-self: flex-end; background: #DCF8C6; border-radius: 10px 0 10px 10px; animation: ltb-fade-up .4s ease-out both; }
.ltb-wa-meta { margin-top: 3px; font-size: 10.5px; color: #9CA3AF; text-align: right; display: flex; justify-content: flex-end; align-items: center; gap: 3px; }
.ltb-wa-inputbar { display: flex; gap: 8px; align-items: center; padding: 10px 12px; background: #F0F2F5; }
.ltb-wa-input { flex: 1; min-width: 0; height: 44px; border: none; border-radius: 999px; padding: 0 16px; background: #fff; font-size: 14.5px; outline: none; transition: box-shadow .2s ease-out; }
.ltb-wa-input:focus { box-shadow: 0 0 0 2px #25D366; }
.ltb-wa-send { width: 44px; height: 44px; border-radius: 999px; background: #25D366; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .2s ease-out; }
.ltb-wa-send:hover { background: #1EBE5A; transform: translateY(-1px); }
.ltb-wa-send:focus-visible { outline: 2px solid #075E54; outline-offset: 2px; }
.ltb-wa-send[disabled] { opacity: .7; pointer-events: none; }
.ltb-wa-phonewrap { flex: 1; min-width: 0; display: flex; align-items: center; height: 44px; background: #fff; border-radius: 999px; transition: box-shadow .2s ease-out; }
.ltb-wa-phonewrap:focus-within { box-shadow: 0 0 0 2px #25D366; }
.ltb-wa-cc { position: relative; display: flex; align-items: center; gap: 5px; height: 100%; padding: 0 10px 0 14px; font-weight: 600; font-size: 14.5px; flex-shrink: 0; color: var(--tx); border-radius: 999px 0 0 999px; cursor: pointer; transition: background .2s ease-out; }
.ltb-wa-cc:hover { background: #F7F8FA; }
.ltb-wa-cc-label { white-space: nowrap; }
.ltb-wa-cc-select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; appearance: none; -webkit-appearance: none; border: none; }
.ltb-wa-cc-divider { width: 1px; height: 22px; background: var(--bd); flex-shrink: 0; }
.ltb-wa-phone { flex: 1; min-width: 0; height: 100%; border: none; padding: 0 14px 0 10px; background: transparent; font-size: 14.5px; outline: none; border-radius: 0 999px 999px 0; }
.ltb-wa-error { padding: 8px 14px 12px; background: #F0F2F5; }
.ltb-wa-error .ltb-error { margin-top: 0; }

/* ── Succes-view ── */
.ltb-success { padding: 44px 32px 30px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 7px; }
.ltb-success-avatar { position: relative; margin-bottom: 12px; animation: ltb-pop .5s ease-out both; }
.ltb-success-avatar img, .ltb-success-avatar .ltb-avatar-fallback { width: 68px; height: 68px; border-radius: 999px; object-fit: cover; font-size: 24px; }
.ltb-success-badge { position: absolute; right: -4px; bottom: -4px; width: 26px; height: 26px; border-radius: 999px; background: var(--p); border: 2.5px solid #fff; display: flex; align-items: center; justify-content: center; color: #fff; }
.ltb-success-title { font-weight: 700; font-size: 18px; color: var(--ht); }
.ltb-success-body { font-size: 14px; line-height: 1.6; color: #4B5563; max-width: 260px; }
.ltb-success-back { margin-top: 14px; font-weight: 700; font-size: 14px; color: var(--ph); display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 8px; transition: color .2s ease-out; }
.ltb-success-back:hover { color: var(--p); }

/* ── Mobiel: bottom sheet ── */
@media (max-width: 480px) {
  .ltb-overlay { display: block; position: fixed; inset: 0; background: rgba(2,10,36,.35); animation: ltb-fade .25s ease-out both; }
  .ltb-panel { position: fixed; left: 0; right: 0; bottom: 0; width: 100%; max-width: 100%; max-height: 88vh; border-radius: 20px 20px 0 0; box-shadow: 0 -8px 30px rgba(2,10,36,.18); padding-bottom: env(safe-area-inset-bottom, 0px); }
  .ltb-handle { display: flex; justify-content: center; padding: 8px 0 0; background: var(--hb); }
  .ltb-handle span { width: 36px; height: 4px; border-radius: 999px; background: var(--bd); }
  .ltb-wa-head { border-radius: 20px 20px 0 0; }
  .ltb-wa-head .ltb-handle { background: transparent; }
}

@media (prefers-reduced-motion: reduce) {
  .ltb-launcher, .ltb-avatar-dot { animation: none; }
  .ltb-panel, .ltb-view, .ltb-teaser, .ltb-wa-sent, .ltb-success-avatar, .ltb-overlay { animation: none; }
}
`;
}
