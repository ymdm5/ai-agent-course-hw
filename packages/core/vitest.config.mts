import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Resolved relative to this file (not process.cwd()) so it works whether Nx
// runs vitest from the workspace root or from this project's own directory.
loadEnv({ path: resolve(__dirname, '../../.env') });

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/core',
  test: {
    name: '@ledgerbase/core',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
