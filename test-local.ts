// Local test runner for api/index.ts — simulates Vercel serverless function locally
import 'dotenv/config';
import { createServer } from 'http';

const app = (await import('./api/[...slug].js')).default;

const server = createServer((req, res) => {
  try {
    app(req, res, (err) => {
      if (err) {
        console.error('[handler] error:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: String(err?.message ?? err) }));
        }
      }
    });
  } catch (err) {
    console.error('[handler] thrown:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
  }
});

const PORT = parseInt(process.env.PORT || '3001', 10);
server.listen(PORT, () => {
  console.log(`Test server on http://localhost:${PORT}`);
});