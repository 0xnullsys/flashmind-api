export const config = {
  api: {
    bodyParser: false,
  },
};

import express from 'express';

let appPromise: Promise<any> | null = null;

async function loadApp() {
  const mod = await import('./server/app.js');
  return (mod as any).default ?? mod;
}

export default async function handler(req: any, res: any) {
  try {
    if (!appPromise) appPromise = loadApp();
    const app = await appPromise;
    return await new Promise<void>((resolve) => {
      app(req, res, (err: any) => {
        if (err) {
          if (!res.headersSent) {
            res.status(500).json({ error: 'Express', message: String(err?.message ?? err) });
          }
        }
        resolve();
      });
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal', message: String(err?.message ?? err), stack: String(err?.stack ?? '').slice(0, 2000) });
    }
  }
}