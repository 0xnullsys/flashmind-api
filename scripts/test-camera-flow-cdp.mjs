/**
 * Verify camera button flow: click → detect → enable → click again → open picker.
 * Run: node scripts/test-camera-flow-cdp.mjs
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const TARGET_URL = 'https://flashmind-api.vercel.app/';
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

    // Mock getUserMedia to test both available and unavailable paths
    await Runtime.evaluate({
      expression: `(() => {
        // ponytail: stub mediaDevices for testing
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            getUserMedia: async () => {
              throw new DOMException('Permission denied', 'NotAllowedError');
            },
          },
        });
      })()`,
      returnByValue: true,
    });

    await Page.navigate({ url: TARGET_URL });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 3000));

    // Login
    const login = await Runtime.evaluate({
      expression: `(async () => { const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'${LOGIN_EMAIL}', password:'${LOGIN_PASSWORD}'}), credentials:'include'}); return r.ok; })()`,
      awaitPromise: true, returnByValue: true,
    });
    log('Login', login.result.value);

    await Page.navigate({ url: TARGET_URL + 'app' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 5000));

    // Open editor
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.dashboard-header-right button')).find(b => b.textContent.includes('Kartu Baru')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 1500));

    // Find camera button
    const initialCheck = await Runtime.evaluate({
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto') || b.textContent.includes('Kamera'));
        if (!btn) return null;
        return { text: btn.textContent.trim(), disabled: btn.disabled, title: btn.title };
      })()`,
      returnByValue: true,
    });
    log('Camera button exists', !!initialCheck.result.value,
      `text="${initialCheck.result.value?.text}"`);
    log('Camera button NOT disabled initially', initialCheck.result.value && !initialCheck.result.value.disabled,
      `disabled=${initialCheck.result.value?.disabled}`);

    // === Test 1: First click triggers detection (not picker) ===
    console.log('\n=== Test 1: First click triggers detection ===');
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 500));

    const detectingCheck = await Runtime.evaluate({
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto') || b.textContent.includes('Memeriksa') || b.textContent.includes('Kamera'));
        const hints = Array.from(document.querySelectorAll('.ai-upload-hint')).map(h => h.textContent.trim());
        return { btnText: btn?.textContent.trim(), btnDisabled: btn?.disabled, hints };
      })()`,
      returnByValue: true,
    });
    console.log(`  After click 1: btn="${detectingCheck.result.value.btnText}", disabled=${detectingCheck.result.value.btnDisabled}`);
    console.log(`  Hints: ${JSON.stringify(detectingCheck.result.value.hints)}`);

    // Wait for detection to complete (mocked getUserMedia rejects → 'unavailable')
    await new Promise(r => setTimeout(r, 2000));

    const finalCheck = await Runtime.evaluate({
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto') || b.textContent.includes('Kamera') || b.textContent.includes('Memeriksa'));
        const hints = Array.from(document.querySelectorAll('.ai-upload-hint')).map(h => h.textContent.trim());
        return { btnText: btn?.textContent.trim(), btnDisabled: btn?.disabled, hints };
      })()`,
      returnByValue: true,
    });
    console.log(`  After detection: btn="${finalCheck.result.value.btnText}", disabled=${finalCheck.result.value.btnDisabled}`);
    console.log(`  Hints: ${JSON.stringify(finalCheck.result.value.hints)}`);

    log('After failed detection: button disabled', finalCheck.result.value.btnDisabled === true);
    log('Shows "Kamera tidak terdeteksi" hint', finalCheck.result.value.hints.some(h => h.includes('tidak terdeteksi')));

    // === Test 2: Reset, mock getUserMedia success, verify "available" state ===
    console.log('\n=== Test 2: Available camera flow ===');
    // Close + reopen to reset state
    await Runtime.evaluate({
      expression: `(() => { const close = document.querySelector('.modal-close'); if (close) close.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 500));

    // Override mock to success
    await Runtime.evaluate({
      expression: `(() => {
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            getUserMedia: async () => {
              // ponytail: return fake stream with track.stop() method
              const track = { stop: () => {} };
              return { getTracks: () => [track] };
            },
          },
        });
      })()`,
      returnByValue: true,
    });

    // Reopen editor
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.dashboard-header-right button')).find(b => b.textContent.includes('Kartu Baru')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 1500));

    // Override mock AFTER modal opened (mock must persist for detection)
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

    // ponytail: spy on file input click — track whether picker opens
    await Runtime.evaluate({
      expression: `(() => {
        window.__pickerClicks = [];
        const fileInputs = document.querySelectorAll('.modal-dialog input[type="file"]');
        fileInputs.forEach((input, i) => {
          const origClick = input.click.bind(input);
          input.click = function() {
            window.__pickerClicks.push({ index: i, accept: input.accept, capture: input.capture });
            return origClick();
          };
        });
      })()`,
      returnByValue: true,
    });

    // Click camera button first time — should detect, NOT open picker
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 100));

    const afterFirstClick = await Runtime.evaluate({
      expression: `JSON.stringify({ pickerClicks: window.__pickerClicks, btnText: Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto') || b.textContent.includes('Memeriksa'))?.textContent.trim() })`,
      returnByValue: true,
    });
    const afterFirstParsed = JSON.parse(afterFirstClick.result.value);
    console.log(`  After click 1 (during detection): ${JSON.stringify(afterFirstParsed)}`);
    log('First click does NOT open picker (camera-status="checking")', afterFirstParsed.pickerClicks.length === 0,
      `clicks=${afterFirstParsed.pickerClicks.length}`);

    // Wait for detection to finish
    await new Promise(r => setTimeout(r, 1500));

    const afterDetection = await Runtime.evaluate({
      expression: `JSON.stringify({ btnText: Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto') || b.textContent.includes('Memeriksa'))?.textContent.trim(), btnDisabled: Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto'))?.disabled, hints: Array.from(document.querySelectorAll('.ai-upload-hint')).map(h => h.textContent.trim()) })`,
      returnByValue: true,
    });
    const afterDetectParsed = JSON.parse(afterDetection.result.value);
    console.log(`  After detection: ${JSON.stringify(afterDetectParsed)}`);
    log('After successful detection: button shows "Ambil foto"', afterDetectParsed.btnText.includes('Ambil foto'));
    log('After successful detection: button NOT disabled', afterDetectParsed.btnDisabled === false);
    log('Shows "Kamera siap" hint', afterDetectParsed.hints.some(h => h.includes('siap')));

    // Click second time — should open picker (capture="environment" input)
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 200));

    const afterSecondClick = await Runtime.evaluate({
      expression: `JSON.stringify({ pickerClicks: window.__pickerClicks })`,
      returnByValue: true,
    });
    const afterSecondParsed = JSON.parse(afterSecondClick.result.value);
    log('Second click opens picker (capture="environment")', afterSecondParsed.pickerClicks.length >= 1,
      `clicks=${JSON.stringify(afterSecondParsed.pickerClicks)}`);
    if (afterSecondParsed.pickerClicks.length > 0) {
      const click = afterSecondParsed.pickerClicks[0];
      log('Picker is camera capture (capture="environment")', click.capture === 'environment',
        `capture=${click.capture}`);
    }

    // Screenshot
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/camera-flow.png', Buffer.from(data, 'base64'));

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
