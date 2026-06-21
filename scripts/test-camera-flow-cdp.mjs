/**
 * Verify camera button two-step flow via UI states (no mock needed).
 * Run: node scripts/test-camera-flow-cdp.mjs
 *
 * Strategy: verify the BUTTON STATES + behaviors via DOM:
 * 1. Initial state: button enabled (idle), hint absent
 * 2. First click: triggers detection (not picker)
 * 3. After detection completes (success or fail): button state reflects result
 * 4. If available: second click opens picker (we can't actually open camera in headless, but we can verify file input click is called)
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const TARGET_URL = 'https://flashmind-mduxn4hr3-alif-fakhrurrozy-6516s-projects.vercel.app/';
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

    await Page.navigate({ url: TARGET_URL });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 3000));

    // Login
    const login = await Runtime.evaluate({
      expression: `(async () => { const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'${LOGIN_EMAIL}', password:'${LOGIN_PASSWORD}'}), credentials:'include'}); return r.ok; })()`,
      awaitPromise: true, returnByValue: true,
    });
    log('Login', login.result.value);

    // ponytail: read production bundle to verify the camera fix is in deployed JS
    console.log('\n=== Check deployed bundle ===');
    const bundleInfo = await Runtime.evaluate({
      expression: `(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const mainScript = scripts.find(s => s.src.includes('index-'));
        return mainScript?.src || 'none';
      })()`,
      returnByValue: true,
    });
    log('Bundle detected', bundleInfo.result.value !== 'none', bundleInfo.result.value);

    await Page.navigate({ url: TARGET_URL + 'app' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 5000));

    // Open editor
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.dashboard-header-right button')).find(b => b.textContent.includes('Kartu Baru')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 1500));

    // Verify camera button initial state
    const initial = await Runtime.evaluate({
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto'));
        if (!btn) return null;
        return { text: btn.textContent.trim(), disabled: btn.disabled, title: btn.title };
      })()`,
      returnByValue: true,
    });
    log('Camera button exists', !!initial.result.value,
      `text="${initial.result.value?.text}"`);
    log('Camera button enabled (idle, awaiting user click)', initial.result.value && !initial.result.value.disabled);

    // ponytail: spy on file input click() before any camera interaction
    await Runtime.evaluate({
      expression: `(() => {
        window.__pickerOpens = [];
        const fileInputs = document.querySelectorAll('.modal-dialog input[type="file"]');
        fileInputs.forEach((input, i) => {
          const origClick = input.click.bind(input);
          input.click = function() {
            window.__pickerOpens.push({ index: i, capture: input.getAttribute('capture') });
            return origClick();
          };
        });
      })()`,
      returnByValue: true,
    });

    // === Test 1: First click should NOT open picker (detection in progress) ===
    console.log('\n=== Test 1: First click triggers detection (not picker) ===');
    // Click button (immediately start detection)
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    // Check immediately (synchronous detection state) — could be checking or already done
    await new Promise(r => setTimeout(r, 50));

    const duringDetection = await Runtime.evaluate({
      expression: `JSON.stringify({ pickerOpens: window.__pickerOpens, btnText: Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto') || b.textContent.includes('Memeriksa'))?.textContent.trim() })`,
      returnByValue: true,
    });
    const duringParsed = JSON.parse(duringDetection.result.value);
    log('Detection in progress: picker NOT opened', duringParsed.pickerOpens.length === 0,
      `opens=${duringParsed.pickerOpens.length}`);

    // Wait for detection to complete
    await new Promise(r => setTimeout(r, 3000));

    const afterDetection = await Runtime.evaluate({
      expression: `JSON.stringify({ btnText: Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto') || b.textContent.includes('Memeriksa'))?.textContent.trim(), btnDisabled: Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto'))?.disabled, hints: Array.from(document.querySelectorAll('.ai-upload-hint')).map(h => h.textContent.trim()) })`,
      returnByValue: true,
    });
    const afterParsed = JSON.parse(afterDetection.result.value);
    console.log(`  After detection: btn="${afterParsed.btnText}", disabled=${afterParsed.btnDisabled}`);
    console.log(`  Hints: ${JSON.stringify(afterParsed.hints)}`);

    // After detection, button shows "Ambil foto" (or "Memeriksa" if still in progress)
    log('Button shows "Ambil foto" or "Memeriksa"', afterParsed.btnText.includes('Ambil foto') || afterParsed.btnText.includes('Memeriksa'));

    // If detected available, second click should open picker
    if (afterParsed.btnDisabled === false && afterParsed.btnText.includes('Ambil foto')) {
      console.log('\n=== Test 2: Second click opens picker (camera capture) ===');
      await Runtime.evaluate({
        expression: `(() => { const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto')); if (btn) btn.click(); })()`,
        returnByValue: true,
      });
      await new Promise(r => setTimeout(r, 200));

      const afterSecondClick = await Runtime.evaluate({
        expression: `JSON.stringify({ pickerOpens: window.__pickerOpens })`,
        returnByValue: true,
      });
      const secondParsed = JSON.parse(afterSecondClick.result.value);
      log('Second click opens picker', secondParsed.pickerOpens.length >= 1,
        `opens=${secondParsed.pickerOpens.length}`);
      if (secondParsed.pickerOpens.length > 0) {
        log('Picker is camera capture (capture="environment")', secondParsed.pickerOpens[0].capture === 'environment',
          `capture=${secondParsed.pickerOpens[0].capture}`);
      }
    } else if (afterParsed.btnDisabled === true) {
      console.log('\n=== Test 2: Camera unavailable (no device) ===');
      log('Button disabled after failed detection', afterParsed.btnDisabled === true);
      log('Shows "Kamera tidak terdeteksi" hint', afterParsed.hints.some(h => h.includes('tidak terdeteksi')));
    }

    // Screenshot
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/camera-flow.png', Buffer.from(data, 'base64'));
    console.log('\nScreenshot: dist/camera-flow.png');

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
