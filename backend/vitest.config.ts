import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [resolve(__dirname, 'src/test/setup.ts')],
    globals: true,
    root: resolve(__dirname, '..'),
    include: ['backend/src/**/*.{test,spec}.ts'],
    exclude: ['node_modules/**', 'dist/**', 'src/**'],
  },
});
