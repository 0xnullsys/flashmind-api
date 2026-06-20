import React, { useState } from 'react';
import { t } from '../lib/id';
import { getAdminStats, getAdminUsers, getAdminGuests, getAdminFlashcards } from '../lib/api';
import { ApiError } from '../lib/api';
import type { AdminStatsData } from '../lib/api';

export default function Admin() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('fm_admin_key') || '');
  const [savedKey, setSavedKey] = useState(() => localStorage.getItem('fm_admin_key') || '');
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveKey = () => {
    localStorage.setItem('fm_admin_key', apiKey);
    setSavedKey(apiKey);
    setStats(null);
  };

  const handleClearKey = () => {
    localStorage.removeItem('fm_admin_key');
    setApiKey('');
    setSavedKey('');
    setStats(null);
  };

  const loadStats = async () => {
    if (!savedKey) {
      setError('Masukkan kunci API terlebih dahulu');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await getAdminStats(savedKey);
      setStats(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('error.network'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>{t('admin.title')}</h1>
        <a href="/" className="btn btn-outline">
          Kembali
        </a>
      </header>

      <div className="admin-key-section">
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t('admin.keyPlaceholder')}
          className="admin-key-input"
        />
        <button className="btn btn-primary" onClick={handleSaveKey}>
          {t('admin.saveKey')}
        </button>
        {savedKey && (
          <button className="btn btn-outline" onClick={handleClearKey}>
            {t('admin.clearKey')}
          </button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {savedKey && (
        <div className="admin-actions">
          <button className="btn btn-primary" onClick={loadStats} disabled={loading}>
            {loading ? t('ai.loading') : t('admin.stats')}
          </button>
        </div>
      )}

      {stats && (
        <div className="admin-stats">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>{t('admin.totalUsers')}</h3>
              <p className="stat-number">{stats.stats.totalUsers}</p>
            </div>
            <div className="stat-card">
              <h3>{t('admin.totalGuests')}</h3>
              <p className="stat-number">{stats.stats.totalGuests}</p>
            </div>
            <div className="stat-card">
              <h3>{t('admin.totalCards')}</h3>
              <p className="stat-number">{stats.stats.totalCards}</p>
            </div>
          </div>

          {stats.latestTraces.length > 0 && (
            <div className="admin-traces">
              <h3>{t('admin.latestTraces')}</h3>
              <div className="traces-list">
                {stats.latestTraces.map((trace, i) => (
                  <div key={i} className="trace-item">
                    <span className="trace-event">{trace.acara}</span>
                    <span className="trace-route">{trace.rute}</span>
                    <span className="trace-table">{trace.tabel}</span>
                    <span className="trace-time">
                      {new Date(trace.pada).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}