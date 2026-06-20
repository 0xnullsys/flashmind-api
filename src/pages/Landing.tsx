import React, { useState } from 'react';
import { t } from '../lib/id';
import { useAuth } from '../lib/auth';
import AuthDialog from '../components/AuthDialog';

export default function Landing() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { role, createGuest } = useAuth();
  const [demoFlipped, setDemoFlipped] = useState(false);

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleGuestTry = async () => {
    await createGuest();
    window.location.href = '/app';
  };

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">{t('appName')}</h1>
          <p className="hero-tagline">{t('tagline')}</p>

          <div className="hero-cta">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => handleOpenAuth('login')}
            >
              {t('hero.ctaLogin')}
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => handleOpenAuth('register')}
            >
              {t('hero.ctaRegister')}
            </button>
          </div>

          <div className="hero-guest">
            <button className="btn-link" onClick={handleGuestTry}>
              {t('hero.noteDifferent')}
            </button>
          </div>

          <p className="hero-scroll-hint">{t('hero.scrollHint')}</p>
        </div>

        {/* Demo flip card */}
        <div className="hero-demo">
          <div
            className={`demo-card ${demoFlipped ? 'flipped' : ''}`}
            onClick={() => setDemoFlipped(!demoFlipped)}
          >
            <div className="demo-card-inner">
              <div className="demo-card-front">
                <h3>React Hooks</h3>
              </div>
              <div className="demo-card-back">
                <p>Fungsi yang memungkinkan Anda menggunakan state dan fitur React lainnya tanpa menulis kelas.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it helps */}
      <section className="section">
        <div className="section-content">
          <h2>{t('hero.howItHelps')}</h2>
          <p>{t('hero.howItHelpsBody')}</p>
        </div>
      </section>

      {/* Research */}
      <section className="section section-alt">
        <div className="section-content">
          <h2>{t('hero.research')}</h2>
          <div className="research-cards">
            <div className="research-item">
              <h3>Aktif Recall</h3>
              <p>Mengingat informasi secara aktif memperkuat jalur saraf dan meningkatkan retensi jangka panjang.</p>
            </div>
            <div className="research-item">
              <h3>Spaced Repetition</h3>
              <p>Meninjau materi pada interval yang semakin meningkat mengoptimalkan memori jangka panjang.</p>
            </div>
            <div className="research-item">
              <h3>Metode Kartu Belajar</h3>
              <p>Studi menunjukkan bahwa kartu belajar adalah salah satu alat belajar paling efektif yang tersedia.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section cta-final">
        <div className="section-content">
          <h2>{t('hero.ctaDontWait')}</h2>
          <div className="hero-cta">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => handleOpenAuth('register')}
            >
              {t('hero.ctaRegister')}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>{t('footer.credit')}</p>
      </footer>

      <AuthDialog
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
      />
    </div>
  );
}