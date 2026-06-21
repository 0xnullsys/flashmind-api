import React from 'react';
import { config } from '../config';

/**
 * Dev mode banner — only renders when VITE_APP_MODE=development.
 * Visible at top of every page so developers can confirm they're on dev build.
 */
export default function DevBanner() {
  if (config.isProd) return null;

  return (
    <div className="dev-banner" role="status">
      <span className="dev-banner-icon">⚙️</span>
      <span className="dev-banner-text">
        <strong>{config.appName}</strong>
        <span className="dev-banner-mode">{config.mode.toUpperCase()}</span>
        <span className="dev-banner-build">build: {config.buildId}</span>
      </span>
    </div>
  );
}
