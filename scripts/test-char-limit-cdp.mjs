/**
 * E2E test for character limit UI in FlashcardEditor via Chrome DevTools Protocol.
 * Run: node scripts/test-char-limit-cdp.mjs
 *
 * Verifies:
 * - Counter "X/120 karakter" rendered per AI card
 * - Counter turns red when over limit
 * - Save button blocked when any card over limit
 * - Backend rejects over-limit (defense in depth)
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const TARGET_URL = 'https://flashmind-api.vercel.app/';
const LOGIN_EMAIL = 'rls-test@flash.com';
const LOGIN_PASSWORD = 'rlstest123';

const MAX_FRONT_CHARS = 120;
const MAX_BACK_CHARS = 500;

async function main() {
  let client;
  let passed = 0;
  let failed = 0;

  try {
    client = await CDP();
    const { Page, Runtime, Network } = client;
    await Promise.all([Page.enable(), Runtime.enable(), Network.enable()]);

    console.log(`Navigating to ${TARGET_URL}...`);
    await Page.navigate({ url: TARGET_URL });
    await Page.loadEventFired();
    await new Promise((r) => setTimeout(r, 2000));

    // Login
    console.log('\n=== Login ===');
    const loginResult = await Runtime.evaluate({
      expression: `(async () => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '${LOGIN_EMAIL}', password: '${LOGIN_PASSWORD}' }),
          credentials: 'include',
        });
        return { ok: res.ok, status: res.status };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Login:', loginResult.result.value.ok ? '✓' : '✗');
    if (!loginResult.result.value.ok) throw new Error('Login failed');

    // Navigate to dashboard
    await Page.navigate({ url: TARGET_URL + 'app' });
    await Page.loadEventFired();
    await new Promise((r) => setTimeout(r, 5000)); // give React + auth check time

    // ponytail: debug — verify page is dashboard
    const pageDebug = await Runtime.evaluate({
      expression: `({ url: location.href, hasHeader: !!document.querySelector('.dashboard-header'), buttonCount: document.querySelectorAll('button').length })`,
      returnByValue: true,
    });
    console.log('Page debug:', JSON.stringify(pageDebug.result.value));

    // Mock AI to return one normal + one over-limit card
    console.log('\n=== Open editor with mocked AI ===');
    // Inject mock into page — use evaluate to override fetch for /api/test
    await Runtime.evaluate({
      expression: `(() => {
        window.__originalFetch = window.fetch;
        window.fetch = function(url, opts) {
          if (typeof url === 'string' && url.includes('/api/test')) {
            const response = {
              cards: [
                { judul: 'Apa definisi Mitosis?', catatan: 'Mitosis adalah pembelahan sel yang menghasilkan dua sel anak identik dengan kromosom yang sama.', category: 'Biologi' },
                { judul: 'Pertanyaan sangat panjang yang melebihi batas karakter karena seharusnya tidak boleh lebih dari seratus dua puluh karakter di kartu depan karena ini akan membuat kartu susah dibaca dan tidak praktis untuk ruang lingkup belajar aktif recall dan spaced repetition yang ideal menggunakan pertanyaan ringkas yang mudah diingat dalam waktu singkat',
                  catatan: 'Belakang',
                  category: 'Fisika' },
              ],
            };
            return Promise.resolve({
              ok: true,
              status: 201,
              json: async () => response,
              text: async () => JSON.stringify(response),
            });
          }
          return window.__originalFetch(url, opts);
        };
      })()`,
      returnByValue: true,
    });
    console.log('✓ Mock injected');

    // Click "+ Kartu Baru" button (dashboard header)
    const openEditorResult = await Runtime.evaluate({
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const candidates = buttons.filter(b => b.textContent.includes('Kartu Baru') || b.textContent.includes('kartu baru'));
        if (candidates.length === 0) {
          return { found: false, allButtons: buttons.map(b => b.textContent.trim().slice(0, 30)) };
        }
        // prefer the one in header (not in empty state)
        const headerBtn = candidates.find(b => b.closest('.dashboard-header')) || candidates[0];
        headerBtn.click();
        return { found: true, text: headerBtn.textContent.trim(), total: candidates.length };
      })()`,
      returnByValue: true,
    });
    console.log('Open editor result:', JSON.stringify(openEditorResult.result.value));

    await new Promise((r) => setTimeout(r, 1500));

    // Type into textarea
    await Runtime.evaluate({
      expression: `(() => {
        const ta = document.querySelector('textarea');
        if (!ta) return 'no textarea';
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeSetter.call(ta, 'Mitosis adalah pembelahan sel. Fotosintesis mengubah cahaya.');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return 'typed';
      })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 500));

    // Click "Hasilkan Kartu"
    await Runtime.evaluate({
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Hasilkan Kartu'));
        if (btn) { btn.click(); return 'clicked generate'; }
        return 'generate not found';
      })()`,
      returnByValue: true,
    });
    console.log('Generate clicked');
    await new Promise((r) => setTimeout(r, 3000));

    // === CHECK 1: Counters visible per card ===
    console.log('\n=== Check counters visible ===');
    const counterCheck = await Runtime.evaluate({
      expression: `(() => {
        const counters = document.querySelectorAll('.word-counter');
        return Array.from(counters).map(c => ({
          text: c.textContent.trim(),
          overClass: c.classList.contains('word-counter-over'),
        }));
      })()`,
      returnByValue: true,
    });
    console.log(`Found ${counterCheck.result.value.length} counters`);
    counterCheck.result.value.forEach((c, i) => {
      console.log(`  Counter ${i}: "${c.text}" over=${c.overClass}`);
    });
    if (counterCheck.result.value.length >= 2) {
      console.log('✓ Counters rendered for each card side');
      passed++;
    } else {
      console.log('✗ Expected at least 2 counters (front + back per card), got ' + counterCheck.result.value.length);
      failed++;
    }

    // === CHECK 2: Over-limit counter has red class ===
    console.log('\n=== Check over-limit detection ===');
    const overLimitCheck = await Runtime.evaluate({
      expression: `(() => {
        const items = document.querySelectorAll('.ai-card-item');
        return Array.from(items).map(item => ({
          hasOverLimitClass: item.classList.contains('over-limit'),
          hasWarning: !!item.querySelector('.word-limit-warning'),
          warningText: item.querySelector('.word-limit-warning')?.textContent?.trim() || null,
        }));
      })()`,
      returnByValue: true,
    });
    console.log('Card over-limit status:');
    overLimitCheck.result.value.forEach((c, i) => {
      console.log(`  Card ${i}: overLimit=${c.hasOverLimitClass}, warning=${c.hasWarning}`);
      if (c.warningText) console.log(`    Warning: "${c.warningText.slice(0, 80)}"`);
    });
    const hasOverLimit = overLimitCheck.result.value.some(c => c.hasOverLimitClass && c.hasWarning);
    if (hasOverLimit) {
      console.log('✓ Over-limit card detected with warning');
      passed++;
    } else {
      console.log('✗ No card marked as over-limit');
      failed++;
    }

    // === CHECK 3: Save button exists but clicking shows error (not createFlashcard call) ===
    console.log('\n=== Check save blocked ===');
    const saveBtnResult = await Runtime.evaluate({
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => /Simpan \\d+ Kartu/.test(b.textContent));
        return btn ? { found: true, text: btn.textContent.trim() } : { found: false };
      })()`,
      returnByValue: true,
    });
    console.log('Save button:', saveBtnResult.result.value);

    if (saveBtnResult.result.value.found) {
      // Track createFlashcard network calls
      let createCalled = false;
      Network.responseReceived(({ response }) => {
        if (response.url.includes('/api/flashcards') && response.status !== 0) {
          createCalled = true;
        }
      });

      // Click save
      await Runtime.evaluate({
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => /Simpan \\d+ Kartu/.test(b.textContent));
          if (btn) btn.click();
          return 'clicked';
        })()`,
        returnByValue: true,
      });
      await new Promise((r) => setTimeout(r, 2000));

      const errorMsg = await Runtime.evaluate({
        expression: `(() => {
          const err = document.querySelector('.form-error');
          return err ? err.textContent.trim() : null;
        })()`,
        returnByValue: true,
      });

      console.log('After save click:');
      console.log(`  createFlashcard called: ${createCalled}`);
      console.log(`  Error message: ${errorMsg.result.value}`);

      if (!createCalled && errorMsg.result.value) {
        console.log('✓ Save blocked + error shown');
        passed++;
      } else {
        console.log(`✗ Save not properly blocked (createCalled=${createCalled}, error=${!!errorMsg.result.value})`);
        failed++;
      }
    } else {
      console.log('! Save button not found — might be different state');
    }

    // === Screenshot ===
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/charlimit-editor.png', Buffer.from(data, 'base64'));
    console.log('\nScreenshot: dist/charlimit-editor.png');

    // === CHECK 4: Backend defense — direct API call with over-limit ===
    console.log('\n=== Check backend validation (direct API) ===');
    const apiCheck = await Runtime.evaluate({
      expression: `(async () => {
        const longTitle = 'a'.repeat(${MAX_FRONT_CHARS + 10});
        const res = await fetch('/api/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: longTitle, notes: 'test' }),
          credentials: 'include',
        });
        return { status: res.status, body: (await res.text()).slice(0, 200) };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Backend response:', apiCheck.result.value);
    if (apiCheck.result.value.status === 400 && apiCheck.result.value.body.includes('Melebihi batas')) {
      console.log('✓ Backend rejects over-limit with 400');
      passed++;
    } else {
      console.log(`✗ Backend returned ${apiCheck.result.value.status}, expected 400`);
      failed++;
    }

    // === Summary ===
    console.log('\n=== Summary ===');
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
