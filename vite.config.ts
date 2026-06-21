import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // ponytail: production build drops source maps for smaller bundle
    sourcemap: mode === 'development',
  },
  define: {
    // ponytail: expose build mode to runtime for debugging
    __BUILD_MODE__: JSON.stringify(mode),
  },
}));
