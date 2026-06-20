export const config = {
  api: {
    bodyParser: false,
  },
};

import app from '../server/app';

// Debug log to see what URL Vercel passes
export default function handler(req: any, res: any) {
  console.log('[api/index.ts] method=' + req.method + ' url=' + req.url);
  return app(req, res);
}