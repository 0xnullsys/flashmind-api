export const config = {
  api: {
    bodyParser: false,
  },
};

import express from 'express';
import * as appModule from './server/app.js';

const app: any = (appModule as any).default ?? appModule;

export default async function handler(req: any, res: any) {
  try {
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
      res.status(500).json({ error: 'Internal', message: String(err?.message ?? err) });
    }
  }
}