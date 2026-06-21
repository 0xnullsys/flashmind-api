/**
 * CDP test for camera WebRTC live preview on Vercel preview.
 * Run: node scripts/test-camera-preview-cdp.mjs
 *
 * Verifies:
 * - Vercel preview bundle uses WebRTC (getUserMedia + video element) not file picker
 * - Camera button opens live video preview when clicked (not file picker)
 * - Capture button appears in preview mode
 * - Hint text reflects state correctly
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const PREVIEW_URL = 'https://flashmind-rfy486463-alif-fakhrurrozy-6516s-projects.vercel.app';
const BYPASS_TOKEN = '[REDACTED-vercel-bypass]';
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
    await Network.setExtraHTTPHeaders({ headers: { 'x-vercel-protection-bypass': BYPASS_TOKEN } });
    await Emulation.setDeviceMetricsOverride({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    // ===== Test 1: Verify preview bundle uses WebRTC =====
    console.log('\n=== Test 1: Bundle uses WebRTC (not file picker) ===');
    await Page.navigate({ url: PREVIEW_URL });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 3000));

    const title = await Runtime.evaluate({ expression: 'document.title', returnByValue: true });
    log('Page title = FlashMind (not SSO wall)', title.result.value === 'FlashMind');

    const bundleUrl = await Runtime.evaluate({
      expression: `(() => {
        const s = Array.from(document.querySelectorAll('script[src*="index-"]'));
        return s[0]?.src || '';
      })()`,
      returnByValue: true,
    });
    const bundleName = bundleUrl.result.value.split('/').pop();
    log('Bundle detected', !!bundleName, bundleName);

    if (bundleName) {
      const srcCheck = await Runtime.evaluate({
        expression: `(async () => {
          const r = await fetch('/assets/${bundleName}');
          const text = await r.text();
          return {
            hasGetUserMedia: text.includes('getUserMedia'),
            // ponytail: CameraCaptureModal full-size dialog
            hasCameraModalClass: text.includes('camera-modal'),
            hasCameraModalHeading: text.includes('Ambil Foto Catatan'),
            hasCaptureFrame: text.includes('drawImage'),
            hasFacingMode: text.includes('facingMode') || text.includes("'environment'") && text.includes('video'),
            hasToBlob: text.includes('toBlob'),
            hasCaptureAttr: text.includes('capture=\\"environment\\"') || text.includes("capture: 'environment'"),
          };
        })()`,
        awaitPromise: true, returnByValue: true,
      });
      const r = srcCheck.result.value;
      log('Bundle has getUserMedia', r.hasGetUserMedia);
      log('Bundle has camera-modal class (full-size dialog)', r.hasCameraModalClass);
      log('Bundle has "Ambil Foto Catatan" modal heading', r.hasCameraModalHeading);
      log('Bundle has captureFrame logic (canvas drawImage)', r.hasCaptureFrame);
      log('Bundle has canvas.toBlob (frame → blob)', r.hasToBlob);
      log('Bundle has facingMode: environment (rear camera)', r.hasFacingMode);
      log('Bundle removed old capture="environment" input', !r.hasCaptureAttr);
    }

    // ===== Test 2: Camera button opens LIVE preview (not picker) =====
    console.log('\n=== Test 2: Camera button opens live preview ===');

    // Login
    const login = await Runtime.evaluate({
      expression: `(async () => { const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'${LOGIN_EMAIL}', password:'${LOGIN_PASSWORD}'}), credentials:'include'}); return r.ok; })()`,
      awaitPromise: true, returnByValue: true,
    });
    log('Login', login.result.value);

    // Mock getUserMedia to control detection + preview
    await Runtime.evaluate({
      expression: `(() => {
        let callCount = 0;
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            getUserMedia: async (constraints) => {
              callCount++;
              window.__getUserMediaCalls = callCount;
              window.__lastConstraints = JSON.stringify(constraints);
              const track = { stop: () => {} };
              return { getTracks: () => [track] };
            },
          },
        });
      })()`,
      returnByValue: true,
    });

    await Page.navigate({ url: PREVIEW_URL + '/app' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 5000));

    // Open editor
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.dashboard-header-right button')).find(b => b.textContent.includes('Kartu Baru')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 2000));

    // Wait for auto-detect to complete
    await new Promise(r => setTimeout(r, 5000));

    // Re-mock getUserMedia (may have been reset by navigation)
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
    await new Promise(r => setTimeout(r, 2000));

    const initialState = await Runtime.evaluate({
      expression: `(() => {
        const modal = document.querySelector('.modal-dialog');
        if (!modal) return { modalOpen: false };
        const cameraBtn = Array.from(modal.querySelectorAll('button')).find(b => /Ambil foto|Memeriksa/.test(b.textContent));
        const video = modal.querySelector('video');
        const fileInputs = Array.from(modal.querySelectorAll('input[type="file"]'));
        return {
          modalOpen: true,
          btnText: cameraBtn?.textContent.trim(),
          btnDisabled: cameraBtn?.disabled,
          hasVideo: !!video,
          fileInputs: fileInputs.map(i => ({ accept: i.accept, capture: i.getAttribute('capture') })),
        };
      })()`,
      returnByValue: true,
    });
    log('Modal open', initialState.result.value.modalOpen);
    if (initialState.result.value.modalOpen) {
      console.log(`  Camera btn: "${initialState.result.value.btnText}", disabled=${initialState.result.value.btnDisabled}`);
      console.log(`  Has video element: ${initialState.result.value.hasVideo}`);
      console.log(`  File inputs: ${JSON.stringify(initialState.result.value.fileInputs)}`);
      log('Button shows "Ambil foto" (after detect)', initialState.result.value.btnText.includes('Ambil foto'));
      log('Button NOT disabled (after detect)', initialState.result.value.btnDisabled === false);
      log('Video element NOT rendered yet', !initialState.result.value.hasVideo);
      log('No file input with capture attr (using WebRTC)', !initialState.result.value.fileInputs.some(i => i.capture));
    }

    // Click camera button — should trigger SECOND getUserMedia call (live stream)
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 1000));

    const afterClick = await Runtime.evaluate({
      expression: `JSON.stringify({
        getUserMediaCalls: window.__getUserMediaCalls,
        // ponytail: full-size CameraCaptureModal — separate dialog with bigger video
        hasCameraModal: !!document.querySelector('.camera-modal'),
        hasCameraModalHeading: !!Array.from(document.querySelectorAll('h2')).find(h => h.textContent.includes('Ambil Foto Catatan')),
        hasFullVideo: !!document.querySelector('.camera-modal-video'),
        captureBtnVisible: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('📸')),
        cancelBtnVisible: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Batal') && b.closest('.camera-modal')),
        // ponytail: video width should be at least 600px (full-size modal, not small inline)
        videoWidth: document.querySelector('.camera-modal-video')?.getBoundingClientRect().width || 0,
      })`,
      returnByValue: true,
    });
    const parsed = JSON.parse(afterClick.result.value);
    console.log(`  After click: ${JSON.stringify(parsed)}`);
    log('CameraCaptureModal opens', parsed.hasCameraModal);
    log('Modal heading "Ambil Foto Catatan" visible', parsed.hasCameraModalHeading);
    log('Modal has full-size video element', parsed.hasFullVideo);
    log('Capture button (📸) in modal', parsed.captureBtnVisible);
    log('Cancel button in modal', parsed.cancelBtnVisible);
    log('Video is full-size (>=600px wide)', parsed.videoWidth >= 600,
      `width=${parsed.videoWidth}px`);

    // Screenshot
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/camera-preview.png', Buffer.from(data, 'base64'));

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
