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

// document.currentScript is null when imported in tests — no auto-boot there.
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
