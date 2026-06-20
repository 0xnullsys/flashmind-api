import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../lib/id';
import { useAuth } from '../lib/auth';
import AuthDialog from '../components/AuthDialog';

const SCROLLIFY_CDN = 'https://cdn.jsdelivr.net/npm/jquery-scrollify@1.0.21/jquery.scrollify.min.js';

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
      { threshold: 0.18 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export default function Landing() {
  const [authOpen, setAuthOpen] = useState(false);
  const { createGuest, role, loading } = useAuth();
  const navigate = useNavigate();
  const [demoFlipped, setDemoFlipped] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    setHeroLoaded(true);

    let cancelled = false;

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-src="${src}"]`);
        if (existing) {
          if ((existing as any)._loaded) return resolve();
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('script error')));
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.dataset.src = src;
        s.onload = () => {
          (s as any)._loaded = true;
          resolve();
        };
        s.onerror = () => reject(new Error('script error'));
        document.head.appendChild(s);
      });
    };

    const init = async () => {
      if (cancelled) return;

      const w = window as any;
      if (!w.jQuery) {
        console.warn('[Scrollify] jQuery not loaded.');
        document.body.classList.remove('scrollify-active');
        return;
      }
      if (!w.jQuery.scrollify) {
        try {
          await loadScript(SCROLLIFY_CDN);
        } catch (err) {
          console.warn('[Scrollify] plugin script failed to load.', err);
          document.body.classList.remove('scrollify-active');
          return;
        }
      }
      const jq = w.jQuery;
      if (!jq.scrollify) {
        console.warn('[Scrollify] $.scrollify still undefined after script load.');
        document.body.classList.remove('scrollify-active');
        return;
      }

      try {
        document.body.classList.add('scrollify-active');
        const sections = document.querySelectorAll('section.fm-section').length;
        console.log(`[Scrollify] init with ${sections} sections`);

        jq.scrollify({
          section: 'section.fm-section',
          sectionName: false,
          interstitialSection: '',
          standardScrollElements: '.normal-scroll-item',
          easing: 'easeOutExpo',
          scrollSpeed: 1500,
          offset: 0,
          scrollbars: false,
          setHeights: true,
          overflowScroll: false,
          updateHash: false,
          touchScroll: true,
          keyboard: true,
          arrowKeys: true,
          before: (i: number) => console.log(`[Scrollify] before index=${i}`),
          after: (i: number) => console.log(`[Scrollify] after index=${i}`),
          afterResize: () => jq.scrollify?.update?.(),
          afterRender: () => jq.scrollify?.update?.(),
        });

        console.log('[Scrollify] active');

        requestAnimationFrame(() => {
          if (cancelled) return;
          jq.scrollify?.update?.();
          setTimeout(() => !cancelled && jq.scrollify?.update?.(), 300);
        });
      } catch (err) {
        console.error('[Scrollify] init failed:', err);
        document.body.classList.remove('scrollify-active');
      }
    };

    init();

    return () => {
      cancelled = true;
      try {
        const jq = (window as any).$;
        if (jq?.scrollify?.destroy) {
          jq.scrollify.destroy();
        }
      } catch {
        /* ignore */
      }
      document.body.classList.remove('scrollify-active');
    };
  }, []);

  const section2Reveal = useScrollReveal();
  const section3Reveal = useScrollReveal();
  const section4Reveal = useScrollReveal();
  const section5Reveal = useScrollReveal();
  const section6Reveal = useScrollReveal();
  const section7Reveal = useScrollReveal();

  const handleGuestTry = async () => {
    try {
      // ponytail: skip API hit when already authenticated — cookie carries the session
      if (role === 'guest' || role === 'user') {
        navigate('/app');
        return;
      }
      if (loading) return; // wait for session check to complete
      await createGuest();
      navigate('/app');
    } catch (err) {
      console.error('Guest session failed:', err);
    }
  };

  return (
    <div className="landing">
      {/* 1. Hero — intro with brand */}
      <section className={`fm-section hero ${heroLoaded ? 'hero-loaded' : ''}`}>
        <div className="hero-inner">
          <span className="hero-eyebrow">{t('hero.socialProof')}</span>
          <h1 className="hero-title">{t('appName')}</h1>
          <p className="hero-tagline">{t('tagline')}</p>

          <p className="hero-scroll-hint hero-scroll-hint--float">
            {t('hero.scrollHint')}
          </p>

          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={() => setAuthOpen(true)}>
              {t('hero.ctaRegister')}
            </button>
            <button className="btn btn-ghost btn-lg" onClick={handleGuestTry}>
              {t('hero.ctaGuest')}
            </button>
          </div>
        </div>
      </section>

      {/* 2. Normal scroll item — problem statement */}
      <section
        className="fm-section section-normal"
        ref={section2Reveal.ref as React.Ref<HTMLDivElement>}
      >
        <div className={`normal-inner ${section2Reveal.visible ? 'visible' : ''}`}>
          <h2 className="normal-title">{t('hero.problemTitle')}</h2>
          <p className="normal-body">{t('hero.problemBody')}</p>
        </div>
      </section>

      {/* 3. Solution */}
      <section
        className="fm-section section-normal section-normal--alt"
        ref={section3Reveal.ref as React.Ref<HTMLDivElement>}
      >
        <div className={`normal-inner ${section3Reveal.visible ? 'visible' : ''}`}>
          <h2 className="normal-title">{t('hero.solutionTitle')}</h2>
          <p className="normal-body">{t('hero.solutionBody')}</p>
        </div>
      </section>

      {/* 4. Demo — interactive flip */}
      <section
        className={`fm-section section-demo ${demoFlipped ? 'demo-flipped' : ''}`}
        ref={section4Reveal.ref as React.Ref<HTMLDivElement>}
      >
        <div className={`demo-inner ${section4Reveal.visible ? 'visible' : ''}`}>
          <h2 className="normal-title">{t('hero.demoTitle')}</h2>

          <button
            type="button"
            className="demo-card-wrapper"
            onClick={() => setDemoFlipped(!demoFlipped)}
            aria-label="Klik untuk membalik kartu"
          >
            <div className="demo-card-inner">
              <div className="demo-card-face demo-card-front">
                <span className="demo-label">Pertanyaan</span>
                <h3>Apa itu Active Recall?</h3>
              </div>
              <div className="demo-card-face demo-card-back">
                <span className="demo-label">Jawaban</span>
                <p>
                  Teknik belajar dengan mengingat informasi secara aktif dari memori,
                  tanpa melihat catatan. Terbukti meningkatkan retensi hingga 50%.
                </p>
              </div>
            </div>
          </button>

          <p className="demo-hint">{t('hero.demoBody')}</p>
        </div>
      </section>

      {/* 5. Proof */}
      <section
        className="fm-section section-normal"
        ref={section5Reveal.ref as React.Ref<HTMLDivElement>}
      >
        <div className={`normal-inner ${section5Reveal.visible ? 'visible' : ''}`}>
          <h2 className="normal-title">{t('hero.proofTitle')}</h2>
          <p className="normal-body">{t('hero.proofBody')}</p>
        </div>
      </section>

      {/* 6. Benefits */}
      <section
        className="fm-section section-normal section-normal--alt"
        ref={section6Reveal.ref as React.Ref<HTMLDivElement>}
      >
        <div className={`normal-inner ${normalVisible(section6Reveal.visible)}`}>
          <h2 className="normal-title">{t('hero.benefitTitle')}</h2>
          <div className="benefits-list">
            <div className="benefit-row">
              <span className="benefit-mark">01</span>
              <div>
                <h3>{t('hero.benefitFast')}</h3>
                <p>{t('hero.benefitFastBody')}</p>
              </div>
            </div>
            <div className="benefit-row">
              <span className="benefit-mark">02</span>
              <div>
                <h3>{t('hero.benefitSmart')}</h3>
                <p>{t('hero.benefitSmartBody')}</p>
              </div>
            </div>
            <div className="benefit-row">
              <span className="benefit-mark">03</span>
              <div>
                <h3>{t('hero.benefitYours')}</h3>
                <p>{t('hero.benefitYoursBody')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Final CTA */}
      <section
        className="fm-section section-cta"
        ref={section7Reveal.ref as React.Ref<HTMLDivElement>}
      >
        <div className={`normal-inner ${section7Reveal.visible ? 'visible' : ''}`}>
          <h2 className="normal-title">{t('hero.finalTitle')}</h2>
          <p className="normal-body">{t('hero.finalBody')}</p>

          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={() => setAuthOpen(true)}>
              {t('hero.ctaRegister')}
            </button>
            <button className="btn btn-ghost btn-lg" onClick={handleGuestTry}>
              {t('hero.ctaLogin')}
            </button>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>{t('footer.credit')}</p>
      </footer>

      <AuthDialog isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function normalVisible(v: boolean) {
  return v ? 'visible' : '';
}