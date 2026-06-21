/// <reference types="vite/client" />
/**
 * Build configuration — different values per mode (development / production).
 * Vite injects VITE_* env vars at build time:
 * - `vite build --mode development` → loads .env.development
 * - `vite build --mode production` → loads .env.production
 * - `vite build` (default) → loads .env.production
 *
 * All VITE_* vars are PUBLIC (exposed to client bundle).
 * Secrets must NEVER have VITE_ prefix.
 */

export type AppMode = 'development' | 'production';

export interface AppConfig {
  mode: AppMode;
  appName: string;
  apiBase: string;
  enableDebug: boolean;
  enableAnalytics: boolean;
  buildId: string;
  isDev: boolean;
  isProd: boolean;
}

// ponytail: import.meta.env.MODE comes from Vite — 'production' | 'development' | 'test'
const mode = (import.meta.env.VITE_APP_MODE || import.meta.env.MODE) as AppMode;

export const config: AppConfig = {
  mode,
  appName: import.meta.env.VITE_APP_NAME || 'FlashMind',
  apiBase: import.meta.env.VITE_API_BASE || '/api',
  enableDebug: import.meta.env.VITE_ENABLE_DEBUG === 'true',
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  buildId: import.meta.env.VITE_BUILD_ID || 'unknown',
  isDev: mode === 'development',
  isProd: mode === 'production',
};

// ponytail: conditional logger — only logs in development, silent in production
export const logger = {
  log: (...args: unknown[]) => { if (config.enableDebug) console.log('[FlashMind]', ...args); },
  warn: (...args: unknown[]) => { if (config.enableDebug) console.warn('[FlashMind]', ...args); },
  error: (...args: unknown[]) => console.error('[FlashMind]', ...args), // errors always logged
};

// ponytail: document title update — shows mode + build in dev only
if (config.isDev) {
  document.title = `${config.appName} [DEV]`;
}
