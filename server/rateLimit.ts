import { Request, Response, NextFunction } from 'express';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

const RATE_LIMITS: Record<string, { maxTokens: number; refillRate: number; refillInterval: number }> = {
  default: { maxTokens: 100, refillRate: 100, refillInterval: 60_000 },
  guest: { maxTokens: 5, refillRate: 5, refillInterval: 60_000 }, // ponytail: tight cap, dedupe handles reuse
  test: { maxTokens: 20, refillRate: 20, refillInterval: 60_000 },
  upload: { maxTokens: 60, refillRate: 60, refillInterval: 60_000 },
};

export function rateLimit(limitKey: string = 'default') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${limitKey}:${ip}`;
    const config = RATE_LIMITS[limitKey] || RATE_LIMITS.default;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: config.maxTokens, lastRefill: now };
      buckets.set(key, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    if (elapsed >= config.refillInterval) {
      bucket.tokens = Math.min(config.maxTokens, bucket.tokens + config.refillRate);
      bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) {
      res.status(429).json({ error: 'Terlalu banyak permintaan' });
      return;
    }

    bucket.tokens--;
    next();
  };
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > 300_000) {
      buckets.delete(key);
    }
  }
}, 300_000);