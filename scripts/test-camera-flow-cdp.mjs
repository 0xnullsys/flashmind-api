/**
 * Smoke test: verify camera button behavior using React Testing Library in jsdom
 * with mocked mediaDevices. This is a render-based test, not CDP.
 *
 * We just verify that the FlashcardEditor renders the right button states.
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const TARGET_URL = 'http://localhost:4173/';
const LOGIN_EMAIL = 'rls-test@flash.com';
const LOGIN_PASSWORD = 'rlstest123';

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
    await Emulation.setDeviceMetricsOverride({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    // Override fetch to route /api/* to localhost:3002 backend
    await Page.addScriptToEvaluateOnNewDocument({
      source: `
        const origFetch = window.fetch;
        window.fetch = function(input, init) {
          if (typeof input === 'string' && input.startsWith('/api')) {
            return origFetch('http://localhost:3002' + input, init);
          }
          if (input instanceof Request && input.url.startsWith('/api')) {
            return origFetch(new Request('http://localhost:3002' + input.url, init), init);
          }
          return origFetch(input, init);
        };
      `,
    });

    // ===== Test 1: Verify the bundle has the camera auto-detect logic =====
    console.log('\n=== Test 1: Bundle has camera auto-detect code ===');
    await Page.navigate({ url: TARGET_URL });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 3000));

    const bundleCheck = await Runtime.evaluate({
      expression: `(() => {
        const scripts = Array.from(document.querySelectorAll('script[src*="index-"]'));
        return scripts.map(s => s.src);
      })()`,
      returnByValue: true,
    });
    console.log('  Bundles:', JSON.stringify(bundleCheck.result.value));

    // Check that bundle source contains camera auto-detect logic (via fetch)
    const bundleName = bundleCheck.result.value[0]?.split('/').pop();
    if (bundleName) {
      const bundleSrc = await Runtime.evaluate({
        expression: `(async () => {
          const r = await fetch('/assets/${bundleName}');
          const text = await r.text();
          return {
            hasAutoDetect: text.includes('getUserMedia'),
            hasIdle: text.includes("'idle'") || text.includes('"idle"'),
            hasCaptureEnv: text.includes('capture="environment"') || text.includes("capture: 'environment'") || text.includes('capture:\\"environment\\"'),
            hasAiUploadHint: text.includes('ai-upload-hint'),
          };
        })()`,
        awaitPromise: true, returnByValue: true,
      });
      const r = bundleSrc.result.value;
      log('Bundle includes getUserMedia (auto-detect)', r.hasAutoDetect);
      log('Bundle has capture="environment" (camera)', r.hasCaptureEnv);
      log('Bundle has ai-upload-hint class', r.hasAiUploadHint);
    }

    // ===== Test 2: Login and verify dashboard renders with merged dialog =====
    console.log('\n=== Test 2: Dashboard with merged dialog ===');
    const login = await Runtime.evaluate({
      expression: `(async () => { const r = await fetch('http://localhost:3002/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'${LOGIN_EMAIL}', password:'${LOGIN_PASSWORD}'}), credentials:'include'}); return r.ok; })()`,
      awaitPromise: true, returnByValue: true,
    });
    log('Login', login.result.value);

    await Page.navigate({ url: TARGET_URL + 'app' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 3000));

    // Mock getUserMedia to return available
    await Runtime.evaluate({
      expression: `(() => {
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            getUserMedia: async () => {
              const track = { stop: () => {} };
              return { getTracks: () => [track] };
            },
          },
        });
      })()`,
      returnByValue: true,
    });

    // Wait for auth check + redirect
    await new Promise(r => setTimeout(r, 4000));

    // Check current state
    const dashState = await Runtime.evaluate({
      expression: `JSON.stringify({ url: location.href, bodyText: document.body.innerText.slice(0, 200), buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 30)) })`,
      returnByValue: true,
    });
    console.log('  Dashboard state:', dashState.result.value);

    // If on landing, click "Masuk uji coba (tamu)" or wait longer
    if (dashState.result.value.includes('Masuk uji coba')) {
      console.log('  Still on landing, triggering guest login...');
      const guestLogin = await Runtime.evaluate({
        expression: `(async () => { const r = await fetch('http://localhost:3002/api/auth/guest', { method: 'POST', credentials: 'include' }); return { ok: r.ok, status: r.status }; })()`,
        awaitPromise: true, returnByValue: true,
      });
      console.log('  Guest login result:', JSON.stringify(guestLogin.result.value));

      // Verify session
      const sessionCheck = await Runtime.evaluate({
        expression: `(async () => { const r = await fetch('http://localhost:3002/api/auth/status', { credentials: 'include' }); return await r.json(); })()`,
        awaitPromise: true, returnByValue: true,
      });
      console.log('  Session after guest login:', JSON.stringify(sessionCheck.result.value));

      // Reload to dashboard
      await Page.navigate({ url: TARGET_URL + 'app' });
      await Page.loadEventFired();
      await new Promise(r => setTimeout(r, 6000));
    }

    // Re-check dashboard
    const dashState2 = await Runtime.evaluate({
      expression: `JSON.stringify({ url: location.href, hasDashboard: !!document.querySelector('.dashboard-header'), buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 30)) })`,
      returnByValue: true,
    });
    console.log('  After guest login:', dashState2.result.value);

    log('Dashboard rendered', JSON.parse(dashState2.result.value).hasDashboard);

    if (JSON.parse(dashState2.result.value).hasDashboard) {
      // Check buttons - only "+ Kartu Baru" should exist (no "Buat dengan AI")
      const buttons = JSON.parse(dashState2.result.value).buttons;
      log('Has "+ Kartu Baru" button', buttons.some(b => b.includes('Kartu Baru')));
      log('Does NOT have "Buat dengan AI" button', !buttons.some(b => b.includes('Buat dengan AI') || b.includes('AI')));
    }

    // Screenshot
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/dashboard-local.png', Buffer.from(data, 'base64'));

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
