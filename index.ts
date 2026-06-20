export const config = {};

import express from 'express';
import app from './server/app';

export default function handler(req: any, res: any) {
  // Express app is a (req, res, next) function; supply a no-op next so it works as a Vercel handler.
  return (app as any)(req, res, () => {});
}