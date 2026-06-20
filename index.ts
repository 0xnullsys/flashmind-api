export const config = {
  api: {
    bodyParser: false,
  },
};

import express from 'express';
import app from './server/app';

// Debug log to see what URL Vercel passes
export default function handler(req: any, res: any) {
  console.log('[index.ts] method=' + req.method + ' url=' + req.url);
  return app(req, res);
}