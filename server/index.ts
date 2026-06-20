process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});

import app from './app.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const server = app.listen(PORT, () => {
  console.log(`FlashMind server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('[server error]', err);
});