export const config = {
  api: {
    bodyParser: false,
  },
};

import express from 'express';
import * as appModule from './server/app.js';

const app: any = (appModule as any).default ?? appModule;
console.log('[index.ts] app loaded, type=' + typeof app);

export default async function handler(req: any, res: any) {
  console.log('[handler] ' + req.method + ' ' + req.url);
  try {
    return await new Promise<void>((resolve) => {
      app(req, res, (err: any) => {
        console.log('[handler] next called err=' + (err?.message ?? 'null'));
        if (err) {
          if (!res.headersSent) {
            res.status(500).json({ error: 'Express', message: String(err?.message ?? err) });
          }
        }
        resolve();
      });
    });
  } catch (err: any) {
    console.log('[handler] caught ' + err?.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal', message: String(err?.message ?? err) });
    }
  }
}