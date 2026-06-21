/**
 * E2E test for Flashcard wordwrap via Chrome DevTools Protocol.
 * Run: node scripts/test-wordwrap-cdp.mjs
 * Requires Chrome --remote-debugging-port=9222 + valid user login.
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const TARGET_URL = 'https://flashmind-api.vercel.app/';
const LOGIN_EMAIL = 'rls-test@flash.com';
const LOGIN_PASSWORD = 'rlstest123';

// Long text edge cases
const LONG_TITLE_NO_SPACE = 'PertanyaanSangatPanjangTanpaSpasiYangHarusDiWrapOtomatisOlehBrowserDenganBenarDanTidakOverflowKeluarContainerKartu';
const LONG_TITLE_WITH_SPACE = 'Fotosintesis adalah proses metabolisme yang dilakukan oleh tumbuhan hijau dan beberapa bakteri untuk mengubah energi cahaya menjadi energi kimia';
const LONG_NOTES = 'Fotosintesis terjadi di kloroplas daun, khususnya pada membran tilakoid. Proses ini memerlukan air (H2O), karbon dioksida (CO2) dari udara, dan cahaya matahari sebagai sumber energi. Reaksi keseluruhan dapat dituliskan sebagai: 6CO2 + 6H2O + cahaya → C6H12O6 + 6O2. Oksigen yang dihasilkan adalah副产品 dari pemecahan molekul air dan dilepaskan ke atmosfer.';

async function main() {
  let client;
  try {
    client = await CDP();
    const { Page, Runtime, Network } = client;
    await Promise.all([Page.enable(), Runtime.enable(), Network.enable()]);

    console.log(`Navigating to ${TARGET_URL}...`);
    await Page.navigate({ url: TARGET_URL });
    await Page.loadEventFired();
    await new Promise((r) => setTimeout(r, 2500));

    // Step 1: Login via API call in browser context (avoids dealing with auth dialog UI)
    console.log('\n=== Login ===');
    const loginResult = await Runtime.evaluate({
      expression: `(async () => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '${LOGIN_EMAIL}', password: '${LOGIN_PASSWORD}' }),
          credentials: 'include',
        });
        return { status: res.status, ok: res.ok, body: await res.text() };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Login status:', loginResult.result.value.status, loginResult.result.value.ok ? '✓' : '✗');
    if (!loginResult.result.value.ok) {
      console.log('Body:', loginResult.result.value.body.slice(0, 200));
      throw new Error('Login failed');
    }

    // Step 2: Create test cards via API (1 with long no-space title, 1 with normal)
    console.log('\n=== Create test cards ===');
    const createResult = await Runtime.evaluate({
      expression: `(async () => {
        const cards = [
          { title: ${JSON.stringify(LONG_TITLE_NO_SPACE)}, notes: ${JSON.stringify(LONG_NOTES)}, source: 'manual', category: 'Biologi' },
          { title: ${JSON.stringify(LONG_TITLE_WITH_SPACE)}, notes: 'Belakang kartu juga panjang. '.repeat(20), source: 'manual', category: 'Fisika' },
        ];
        const results = [];
        for (const card of cards) {
          try {
            const res = await fetch('/api/flashcards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(card),
              credentials: 'include',
            });
            const text = await res.text();
            results.push({ status: res.status, body: text.slice(0, 150) });
          } catch (err) {
            results.push({ status: 0, body: 'EXCEPTION: ' + err.message });
          }
        }
        return results;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Created cards:', createResult.result.value.length);
    createResult.result.value.forEach((r, i) => {
      console.log(`  Card ${i + 1}: status=${r.status}`);
      if (r.status >= 400) console.log(`    Error: ${r.body}`);
    });

    // Step 3: Navigate to /app
    console.log('\n=== Navigate to dashboard ===');
    await Page.navigate({ url: TARGET_URL + 'app' });
    await Page.loadEventFired();
    await new Promise((r) => setTimeout(r, 3000));

    // Step 4: Find the test cards and verify wordwrap
    console.log('\n=== Wordwrap checks ===');

    // Check: every flashcard h3 must have overflow-wrap or word-break CSS applied
    const cssCheck = await Runtime.evaluate({
      expression: `(() => {
        const cards = document.querySelectorAll('.flashcard');
        const results = [];
        cards.forEach((card, i) => {
          const h3 = card.querySelector('.flashcard-front h3');
          const p = card.querySelector('.flashcard-back p');
          if (!h3 || !p) return;
          const h3Style = window.getComputedStyle(h3);
          const pStyle = window.getComputedStyle(p);
          results.push({
            index: i,
            h3: {
              wordBreak: h3Style.wordBreak,
              overflowWrap: h3Style.overflowWrap,
              whiteSpace: h3Style.whiteSpace,
              scrollWidth: h3.scrollWidth,
              clientWidth: h3.clientWidth,
              overflowing: h3.scrollWidth > h3.clientWidth,
              text: h3.textContent.slice(0, 40),
            },
            p: {
              wordBreak: pStyle.wordBreak,
              overflowWrap: pStyle.overflowWrap,
              whiteSpace: pStyle.whiteSpace,
              scrollWidth: p.scrollWidth,
              clientWidth: p.clientWidth,
              overflowing: p.scrollWidth > p.clientWidth,
              text: p.textContent.slice(0, 40),
            },
          });
        });
        return results;
      })()`,
      returnByValue: true,
    });
    console.log('Found', cssCheck.result.value.length, 'flashcard elements');
    cssCheck.result.value.forEach((c) => {
      console.log(`\n  Card ${c.index}:`);
      console.log(`    h3 wordBreak=${c.h3.wordBreak}, overflowWrap=${c.h3.overflowWrap}, whiteSpace=${c.h3.whiteSpace}`);
      console.log(`    h3 scrollWidth=${c.h3.scrollWidth}, clientWidth=${c.h3.clientWidth}, overflow=${c.h3.overflowing}`);
      console.log(`    h3 text="${c.h3.text}${c.h3.text.length >= 40 ? '...' : ''}"`);
      console.log(`    p wordBreak=${c.p.wordBreak}, overflowWrap=${c.p.overflowWrap}, whiteSpace=${c.p.whiteSpace}`);
      console.log(`    p scrollWidth=${c.p.scrollWidth}, clientWidth=${c.p.clientWidth}, overflow=${c.p.overflowing}`);
      console.log(`    p text="${c.p.text}${c.p.text.length >= 40 ? '...' : ''}"`);
    });

    // Assertions
    console.log('\n=== Assertions ===');
    let passed = 0;
    let failed = 0;
    for (const c of cssCheck.result.value) {
      // h3 must have word-break: break-word OR overflow-wrap: anywhere/break-word
      const h3WrapOk = c.h3.wordBreak === 'break-word' || c.h3.overflowWrap === 'anywhere' || c.h3.overflowWrap === 'break-word';
      if (h3WrapOk) { console.log(`✓ Card ${c.index} h3 has wordwrap CSS`); passed++; }
      else { console.log(`✗ Card ${c.index} h3 missing wordwrap CSS (wordBreak=${c.h3.wordBreak}, overflowWrap=${c.h3.overflowWrap})`); failed++; }

      const pWrapOk = c.p.wordBreak === 'break-word' || c.p.overflowWrap === 'anywhere' || c.p.overflowWrap === 'break-word';
      if (pWrapOk) { console.log(`✓ Card ${c.index} p has wordwrap CSS`); passed++; }
      else { console.log(`✗ Card ${c.index} p missing wordwrap CSS`); failed++; }

      // Visual: should NOT overflow (because wordwrap applied)
      if (!c.h3.overflowing) { console.log(`✓ Card ${c.index} h3 does not overflow`); passed++; }
      else { console.log(`✗ Card ${c.index} h3 still overflows (scrollWidth=${c.h3.scrollWidth} > clientWidth=${c.h3.clientWidth})`); failed++; }
    }

    // Step 5: Screenshot
    console.log('\n=== Screenshot (front view) ===');
    const { data: frontData } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/wordwrap-front.png', Buffer.from(frontData, 'base64'));
    console.log('Saved: wordwrap-front.png');

    // Step 6: Click first card to flip + screenshot back
    console.log('\n=== Flip first card ===');
    await Runtime.evaluate({
      expression: `document.querySelectorAll('.flashcard')[0]?.click()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 1500));
    const { data: backData } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/wordwrap-back.png', Buffer.from(backData, 'base64'));
    console.log('Saved: wordwrap-back.png');

    console.log(`\n=== Summary ===`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total checks: ${passed + failed}`);

    await client.close();
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('CDP test failed:', err);
    if (client) await client.close();
    process.exit(1);
  }
}

main();
