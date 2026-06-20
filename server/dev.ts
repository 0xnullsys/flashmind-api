// Single-port dev server: Express is primary, Vite is middleware on port 5173
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

import express from 'express';
import { createServer as createViteServer } from 'vite';

async function main() {
  const app = express();

  // Inline Vite config (no config file → no temp-file reload loop)
  const vite = await createViteServer({
    configFile: false,
    root: process.cwd(),
    server: {
      middlewareMode: true,
      hmr: false,
      watch: {
        ignored: ['**/vite.config.ts.timestamp-*'],
      },
    },
    appType: 'spa',
    plugins: [(await import('@vitejs/plugin-react')).default()],
  });

  // API routes come from Express app (no /api prefix; mount point adds it)
  const apiApp = (await import('./app.js')).default;

  app.use('/api', apiApp);
  app.use(vite.middlewares);

  const PORT = parseInt(process.env.PORT || '5173', 10);
  app.listen(PORT, () => {
    console.log(`FlashMind dev server on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[main]', err);
  process.exit(1);
});