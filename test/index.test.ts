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
