export const config = {};

import express from 'express';
import app from './server/app';

export default function handler(req: any, res: any) {
  return app(req, res);
}