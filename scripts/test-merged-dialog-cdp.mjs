/**
 * Verify "Buat dengan AI" button is removed; only "+ Kartu Baru" exists.
 * Run: node scripts/test-merged-dialog-cdp.mjs
 */
import CDP from 'chrome-remote-interface';

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

    await Page.navigate({ url: TARGET_URL });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 3000));

    // Login
    const login = await Runtime.evaluate({
      expression: `(async () => { const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'${LOGIN_EMAIL}', password:'${LOGIN_PASSWORD}'}), credentials:'include'}); return r.ok; })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    log('Login', login.result.value);

    await Page.navigate({ url: TARGET_URL + 'app' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 5000));

    // Check all buttons in dashboard header
    const buttonsCheck = await Runtime.evaluate({
      expression: `(() => {
        const header = document.querySelector('.dashboard-header-right');
        if (!header) return { found: false };
        const buttons = Array.from(header.querySelectorAll('button'));
        return {
          found: true,
          count: buttons.length,
          labels: buttons.map(b => b.textContent.trim()),
        };
      })()`,
      returnByValue: true,
    });
    log('Dashboard header rendered', buttonsCheck.result.value.found);
    console.log(`  Buttons: ${JSON.stringify(buttonsCheck.result.value.labels)}`);

    const labels = buttonsCheck.result.value.labels;
    log('Has "+ Kartu Baru" button', labels.some(l => l.includes('Kartu Baru')));
    log('Does NOT have "Buat dengan AI" button', !labels.some(l => l.includes('Buat dengan AI') || l.includes('AI')));
    log('Has "Keluar" button', labels.some(l => l.includes('Keluar')));

    // Click "+ Kartu Baru" → verify modal opens with AI flow
    await Runtime.evaluate({
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('.dashboard-header-right button')).find(b => b.textContent.includes('Kartu Baru'));
        if (btn) btn.click();
      })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 1500));

    const modalCheck = await Runtime.evaluate({
      expression: `(() => {
        const modal = document.querySelector('.modal-dialog');
        if (!modal) return { open: false };
        return {
          open: true,
          header: modal.querySelector('h2')?.textContent || '',
          hasTextarea: !!modal.querySelector('textarea'),
          hasFileInput: !!modal.querySelector('input[type="file"]'),
          hasGenerateBtn: Array.from(modal.querySelectorAll('button')).some(b => b.textContent.includes('Hasilkan Kartu')),
        };
      })()`,
      returnByValue: true,
    });
    log('Modal opens on click', modalCheck.result.value.open);
    if (modalCheck.result.value.open) {
      log('Header shows "+ Kartu Baru"', modalCheck.result.value.header.includes('Kartu Baru'),
        `header="${modalCheck.result.value.header}"`);
      log('Has textarea for notes', modalCheck.result.value.hasTextarea);
      log('Has file input for upload', modalCheck.result.value.hasFileInput);
      log('Has "Hasilkan Kartu" button (AI flow)', modalCheck.result.value.hasGenerateBtn);
    }

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
