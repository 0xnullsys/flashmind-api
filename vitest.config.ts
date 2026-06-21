import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // ponytail: jsdom for React component tests; node env stays for server tests
    environmentMatchGlobs: [
      ['server/**', 'node'],
      ['**/*.test.ts', 'node'],
      ['**/*.test.tsx', 'jsdom'],
    ],
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
