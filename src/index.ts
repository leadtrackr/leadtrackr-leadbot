import { resolveConfig, type LeadBotConfig } from './config';
import { updateChannelFlowFromPage } from './channelflow';
import { mountLeadBot } from './ui/leadbot';

declare global {
  interface Window {
    ltLeadBotConfig?: Partial<LeadBotConfig>;
    __ltLeadBotLoaded?: boolean;
  }
}

export function boot(projectId: string | null): void {
  if (!projectId) {
    console.warn('[LeadTrackr LeadBot] data-project-id ontbreekt — LeadBot niet geladen.');
    return;
  }
  if (window.__ltLeadBotLoaded) return;
  window.__ltLeadBotLoaded = true;
  updateChannelFlowFromPage();
  mountLeadBot(resolveConfig(projectId, window.ltLeadBotConfig));
}

// document.currentScript is null when imported in tests — no auto-boot there.
const script = document.currentScript as HTMLScriptElement | null;
if (script) {
  const projectId =
    script.getAttribute('data-project-id') || window.ltLeadBotConfig?.projectId || null;
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
