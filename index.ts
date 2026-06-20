export const config = {};

import express from 'express';
import app from './server/app';

export const config = {
  api: {
    bodyParser: false,
  },
};

import express from 'express';
import app from './server/app';

export default async function handler(req: any, res: any) {
  try {
    console.log('[handler] ' + req.method + ' ' + req.url);
    return new Promise<void>((resolve) => {
      (app as any)(req, res, (err: any) => {
        if (err) {
          console.error('[handler] express err:', err?.message, err?.stack);
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
      res.status(500).json({ error: 'Internal', message: String(err?.message ?? err) });
    }
  }
}