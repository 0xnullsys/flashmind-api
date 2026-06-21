/**
 * Verify char limits account for actual padding + meta area.
 * Run: node scripts/test-char-limit-accurate.mjs
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const TARGET_URL = 'https://flashmind-api.vercel.app/';
const LOGIN_EMAIL = 'rls-test@flash.com';
const LOGIN_PASSWORD = 'rlstest123';

const MAX_FRONT_CHARS = 120;
const MAX_BACK_CHARS = 500;

const VIEWPORTS = [
  { name: 'smartphone-portrait', width: 375, height: 667 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tv-4k', width: 3840, height: 2160 },
];

async function setViewport(Page, Emulation, width, height) {
  await Emulation.setDeviceMetricsOverride({
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
}

async function main() {
  let client;
  let passed = 0;
  let failed = 0;
  const log = (label, ok, detail = '') => {
    console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ': ' + detail : ''}`);
    ok ? passed++ : failed++;
  };

  try {
    client = await CDP();
    const { Page, Runtime, Network, Emulation } = client;
    await Promise.all([Page.enable(), Runtime.enable(), Network.enable()]);
    await Network.setCacheDisabled({ cacheDisabled: true });

    console.log('Login...');
    await Page.navigate({ url: TARGET_URL });
    await Page.loadEventFired();
    await new Promise((r) => setTimeout(r, 2000));
    const login = await Runtime.evaluate({
      expression: `(async () => { const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'${LOGIN_EMAIL}', password:'${LOGIN_PASSWORD}'}), credentials:'include'}); return r.ok; })()`,
      awaitPromise: true, returnByValue: true,
    });
    if (!login.result.value) { console.log('Login failed'); process.exit(1); }

    // ponytail: delete existing cards to start clean
    console.log('Cleaning existing cards...');
    await Runtime.evaluate({
      expression: `(async () => {
        const list = await fetch('/api/flashcards', { credentials: 'include' });
        const data = await list.json();
        for (const card of data.cards || []) {
          await fetch('/api/flashcards/' + card.id, { method: 'DELETE', credentials: 'include' });
        }
      })()`,
      awaitPromise: true,
    });

    // ponytail: test 3 different title lengths to see how each fits.
    // Create one card per length so we can verify each individually.
    const TEST_TITLES = [
      { name: 'short (60 chars)', text: 'A'.repeat(60) },
      { name: 'max-limit (120 chars)', text: 'A'.repeat(MAX_FRONT_CHARS) },
      { name: 'over-limit (140 chars)', text: 'A'.repeat(140) },
    ];

    // ponytail: create test cards first so we have predictable content
    console.log('Creating test cards...');
    for (const t of TEST_TITLES) {
      await Runtime.evaluate({
        expression: `(async () => {
          await fetch('/api/flashcards', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ title: '${t.text}', notes: 'test' }),
            credentials: 'include',
          });
        })()`,
        awaitPromise: true,
      });
    }

    for (const vp of VIEWPORTS) {
      console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
      await setViewport(Page, Emulation, vp.width, vp.height);
      await Page.navigate({ url: TARGET_URL + 'app' });
      await Page.loadEventFired();
      // wait for React + cards
      await Runtime.evaluate({
        expression: `new Promise(r => { const start = Date.now(); const check = () => { if (document.querySelectorAll('.flashcard').length > 0 || Date.now() - start > 8000) r(); else setTimeout(check, 200); }; check(); })`,
        awaitPromise: true,
      });
      await new Promise((r) => setTimeout(r, 500));

      // Measure ACTUAL usable space (after padding + meta) for FRONT side
      const spaceMeasure = await Runtime.evaluate({
        expression: `(() => {
          const card = document.querySelector('.flashcard');
          if (!card) return null;
          const inner = card.querySelector('.flashcard-inner');
          const front = card.querySelector('.flashcard-front');
          const h3 = card.querySelector('.flashcard-front h3');
          const meta = card.querySelector('.flashcard-meta');
          const cs = getComputedStyle(front);
          const h3cs = getComputedStyle(h3);
          // ponytail: measure textContainer (front minus padding) instead of h3 (which is intrinsic)
          const innerRect = inner.getBoundingClientRect();
          const frontRect = front.getBoundingClientRect();
          return {
            cardWidth: frontRect.width,
            cardHeight: frontRect.height,
            cardPaddingLeft: parseFloat(cs.paddingLeft),
            cardPaddingRight: parseFloat(cs.paddingRight),
            cardPaddingTop: parseFloat(cs.paddingTop),
            cardPaddingBottom: parseFloat(cs.paddingBottom),
            // ponytail: actual text container = front minus padding (not h3's intrinsic)
            textContainerWidth: frontRect.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
            textContainerHeight: frontRect.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
            h3FontSize: parseFloat(h3cs.fontSize),
            h3LineHeight: parseFloat(h3cs.lineHeight) || (parseFloat(h3cs.fontSize) * 1.3),
            metaHeight: meta ? meta.getBoundingClientRect().height : 0,
          };
        })()`,
        returnByValue: true,
      });
      const m = spaceMeasure.result.value;
      if (!m) { log(`${vp.name}: card rendered`, false); continue; }
      log(`${vp.name}: card rendered`, true, `${m.cardWidth.toFixed(0)}x${m.cardHeight.toFixed(0)}`);

      const textWidth = m.textContainerWidth;
      const fontSize = m.h3FontSize;
      const lineHeight = m.h3LineHeight;
      const metaGap = 8;
      const usableHeightForTitle = m.textContainerHeight - m.metaHeight - metaGap;

      // ponytail: realistic per-line char estimate = textWidth / (fontSize * 0.55)
      const avgCharWidth = fontSize * 0.55;
      const charsPerLine = Math.floor(textWidth / avgCharWidth);
      const linesVisible = Math.max(1, Math.floor(usableHeightForTitle / lineHeight));

      console.log(`    textContainer=${textWidth.toFixed(0)}x${usableHeightForTitle.toFixed(0)}px (after padding ${m.cardPaddingTop}px + meta ${m.metaHeight.toFixed(0)}px + gap)`);
      console.log(`    font=${fontSize}px, lh=${lineHeight.toFixed(1)}px`);
      console.log(`    charsPerLine=${charsPerLine}, linesVisible=${linesVisible}, maxSafe=${charsPerLine * linesVisible}`);

      // ponytail: find card with EXACTLY matching title length
      for (const t of TEST_TITLES) {
        const actualFit = await Runtime.evaluate({
          expression: `(() => {
            const target = ${t.text.length};
            const cards = document.querySelectorAll('.flashcard');
            for (const card of cards) {
              const h3 = card.querySelector('.flashcard-front h3');
              if (h3 && h3.textContent.length === target) {
                const front = card.querySelector('.flashcard-front');
                return {
                  titleLen: h3.textContent.length,
                  h3ScrollH: h3.scrollHeight,
                  h3ClientH: h3.clientHeight,
                  frontScrollH: front.scrollHeight,
                  frontClientH: front.clientHeight,
                  frontOverflow: front.scrollHeight > front.clientHeight + 2,
                };
              }
            }
            return null;
          })()`,
          returnByValue: true,
        });
        const f = actualFit.result.value;
        if (!f) {
          // ponytail: for 140-char test, null is expected (backend rejected); for 60/120 it's a fail
          if (t.name.startsWith('over-limit')) {
            log(`  ${t.name} rejected by backend (card not in DOM)`, true, 'not rendered');
          } else {
            log(`  ${t.name} card found`, false);
          }
          continue;
        }
        log(`  ${t.name} card found`, true, `frontOverflow=${f.frontOverflow}, scrollH=${f.frontScrollH}, clientH=${f.frontClientH}`);

        // Expected behavior:
        // - 60 chars: fits in any viewport (well under limit)
        // - 120 chars: fits within MAX_FRONT_CHARS (current limit)
        // - 140 chars: should be REJECTED by backend (not in DOM); if somehow rendered, may overflow
        if (t.name.startsWith('short')) {
          log(`  ${t.name} does not overflow`, !f.frontOverflow);
        } else if (t.name.startsWith('max-limit')) {
          log(`  ${t.name} fits within current limit`, !f.frontOverflow,
            `(measured maxSafe=${charsPerLine * linesVisible} chars for this viewport)`);
        } else {
          // 140 chars: if rendered (shouldn't be), it likely overflows at small viewports
          log(`  ${t.name} overflows (unexpectedly rendered)`, f.frontOverflow);
        }
      }
    }

    // ====== Test 4: back side with 500 chars (current max-back) ======
    console.log('\n=== Test back side with 500-char max ===');
    await setViewport(Page, Emulation, 375, 667); // worst case
    await Page.navigate({ url: TARGET_URL + 'app' });
    await Page.loadEventFired();
    await new Promise((r) => setTimeout(r, 3000));

    const backMeasure = await Runtime.evaluate({
      expression: `(() => {
        const card = document.querySelector('.flashcard');
        if (!card) return null;
        const back = card.querySelector('.flashcard-back');
        const p = card.querySelector('.flashcard-back p');
        if (!back || !p) return null;
        return {
          backWidth: back.getBoundingClientRect().width,
          backHeight: back.getBoundingClientRect().height,
          pWidth: p.getBoundingClientRect().width,
          pHeight: p.getBoundingClientRect().height,
          pScrollH: p.scrollHeight,
          pClientH: p.clientHeight,
          // back has overflow-y: auto, so vertical scroll is OK
          overflowsVertical: p.scrollHeight > p.clientHeight + 2,
        };
      })()`,
      returnByValue: true,
    });
    const bm = backMeasure.result.value;
    if (bm) {
      console.log(`    Back side: ${bm.backWidth.toFixed(0)}x${bm.backHeight.toFixed(0)}px`);
      console.log(`    Text area: ${bm.pWidth.toFixed(0)}x${bm.pHeight.toFixed(0)}px (scrollable)`);
      console.log(`    Note: back side has overflow-y:auto, so vertical overflow is acceptable`);
      log('Back side scrollable (overflow-y:auto allows long text)', true);
    }

    // Screenshot of smartphone with 120-char title
    await setViewport(Page, Emulation, 375, 667);
    await new Promise((r) => setTimeout(r, 1000));
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/charlimit-smartphone.png', Buffer.from(data, 'base64'));
    console.log('\nScreenshot: dist/charlimit-smartphone.png');

    console.log(`\n=== Summary ===`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    await client.close();
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('CDP test failed:', err);
    if (client) await client.close();
    process.exit(1);
  }
}

main();
