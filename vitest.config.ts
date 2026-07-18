import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { LT_WIDGET_VERSION: '"test"' },
  test: { environment: 'happy-dom', globals: true },
});
