import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'jquery-scrollify';
import { t } from '../lib/id';
import { useAuth } from '../lib/auth';
import AuthDialog from '../components/AuthDialog';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export default function Landing() {
  const [authOpen, setAuthOpen] = useState(false);
  const { createGuest } = useAuth();
  const [demoFlipped, setDemoFlipped] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    setHeroLoaded(true);

    const initScrollify = () => {
      try {
        const jq = (window as any).$;
        if (jq && jq.scrollify) {
          jq.scrollify({
            section: 'section',
            sectionName: false,
            interstitialSection: '',
            easing: 'easeOutExpo',
            scrollSpeed: 1100,
            offset: 0,
            scrollbars: true,
            setHeights: true,
            overflowScroll: true,
            updateHash: false,
            touchScroll: true,
            before: function (index: number) {
              // optional: logic before scroll
            },
            after: function (index: number) {
              // optional: logic after scroll
            },
            afterResize: function () {
              // optional: refresh after resize
            },
            afterRender: function () {
              // optional
            },
          });
        }
      } catch (err) {
        // ignore if jquery-scrollify is unavailable
      }
    };

    initScrollify();

    return () => {
      try {
        const jq = (window as any).$;
        if (jq && jq.scrollify) {
          jq.scrollify.destroy();
        }
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  const heroReveal = useScrollReveal();
  const demoReveal = useScrollReveal();
  const howItHelpsReveal = useScrollReveal();
  const researchReveal = useScrollReveal();
  const ctaReveal = useScrollReveal();

  const handleGuestTry = async () => {
    await createGuest();
    window.location.href = '/app';
  };

  return (
    <div className="landing">
      {/* Hero */}
      <section className={`hero ${heroLoaded ? 'hero-loaded' : ''}`}>
        <div className="hero-content animate-fade-in-up">
          <h1 className="hero-title">{t('appName')}</h1>
          <p className="hero-tagline">{t('tagline')}</p>

          <div className="hero-cta">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleGuestTry}
            >
              {t('hero.ctaLogin')}
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => setAuthOpen(true)}
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
        <div className={`hero-demo animate-fade-in-up animate-delay-300 ${demoFlipped ? 'demo-flipped' : ''}`}>
          <div className="demo-card-wrapper" onClick={() => setDemoFlipped(!demoFlipped)}>
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
      <section className="section" ref={howItHelpsReveal.ref as React.Ref<HTMLDivElement>}>
        <div className={`section-content ${howItHelpsReveal.visible ? 'animate-slide-up visible' : ''}`}>
          <h2>{t('hero.howItHelps')}</h2>
          <p>{t('hero.howItHelpsBody')}</p>
        </div>
      </section>

      {/* Research */}
      <section className="section section-alt" ref={researchReveal.ref as React.Ref<HTMLDivElement>}>
        <div className={`section-content ${researchReveal.visible ? 'animate-slide-up visible' : ''}`}>
          <h2>{t('hero.research')}</h2>
          <div className="research-cards">
            <div className="research-item animate-slide-up-stagger" style={{ transitionDelay: '0ms' }}>
              <h3>Aktif Recall</h3>
              <p>Mengingat informasi secara aktif memperkuat jalur saraf dan meningkatkan retensi jangka panjang.</p>
            </div>
            <div className="research-item animate-slide-up-stagger" style={{ transitionDelay: '150ms' }}>
              <h3>Spaced Repetition</h3>
              <p>Meninjau materi pada interval yang semakin meningkat mengoptimalkan memori jangka panjang.</p>
            </div>
            <div className="research-item animate-slide-up-stagger" style={{ transitionDelay: '300ms' }}>
              <h3>Metode Kartu Belajar</h3>
              <p>Studi menunjukkan bahwa kartu belajar adalah salah satu alat belajar paling efektif yang tersedia.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section cta-final" ref={ctaReveal.ref as React.Ref<HTMLDivElement>}>
        <div className={`section-content ${ctaReveal.visible ? 'animate-slide-up visible' : ''}`}>
          <h2>{t('hero.ctaDontWait')}</h2>
          <div className="hero-cta">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setAuthOpen(true)}
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