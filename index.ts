export const config = {
  api: {
    bodyParser: false,
  },
};

import express from 'express';
import * as appModule from './server/app';

const app: any = (appModule as any).default ?? appModule;
console.log('[index.ts] module loaded, app type:', typeof app);

export default async function handler(req: any, res: any) {
  try {
    return await new Promise<void>((resolve) => {
      app(req, res, (err: any) => {
        if (err) {
          console.error('[handler] express err:', err?.message);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Express', message: String(err?.message ?? err) });
          }
        }
        resolve();
      });
    });
  } catch (err: any) {
    console.error('[handler] error:', err?.message, err?.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal', message: String(err?.message ?? err), stack: String(err?.stack ?? '').slice(0, 1500) });
    }
  }
}