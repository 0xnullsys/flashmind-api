/**
 * E2E test for card editing via Chrome DevTools Protocol.
 * Run: node scripts/test-edit-card-cdp.mjs
 *
 * Verifies:
 * - Edit button (✎) appears on card hover
 * - Click edit opens modal with pre-filled title/notes/category
 * - Save updates the card (verified via API)
 * - Over-limit warning blocks save
 * - Responsive: card title fits within max height at smartphone width
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const TARGET_URL = 'https://flashmind-api.vercel.app/';
const LOGIN_EMAIL = 'rls-test@flash.com';
const LOGIN_PASSWORD = 'rlstest123';

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
    // ponytail: disable cache so we always get fresh bundle (avoid Vercel stale asset serving)
    await Network.setCacheDisabled({ cacheDisabled: true });

    // Test 1: Responsive char fit across viewports
    console.log('\n=== Test 1: Responsive char fit ===');
    await setViewport(Page, Emulation, 375, 667); // start at smartphone
    console.log('Navigating...');
    await Page.navigate({ url: TARGET_URL });
    await Page.loadEventFired();
    await new Promise((r) => setTimeout(r, 2000));

    // Login
    const loginResult = await Runtime.evaluate({
      expression: `(async () => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '${LOGIN_EMAIL}', password: '${LOGIN_PASSWORD}' }),
          credentials: 'include',
        });
        return res.ok;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    log('Login', loginResult.result.value);

    // Create a card with MAX title (120 chars) via API
    const maxTitle = 'A'.repeat(120);
    const createResult = await Runtime.evaluate({
      expression: `(async () => {
        const res = await fetch('/api/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '${maxTitle}', notes: 'Test notes' }),
          credentials: 'include',
        });
        return await res.json();
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const cardId = createResult.result.value.card?.id;
    log('Create max-char card', !!cardId, cardId || createResult.result.value.error);

    for (const vp of VIEWPORTS) {
      console.log(`\n  --- ${vp.name} (${vp.width}x${vp.height}) ---`);
      await setViewport(Page, Emulation, vp.width, vp.height);
      await Page.navigate({ url: TARGET_URL + 'app' });
      await Page.loadEventFired();
      // ponytail: wait for React to mount + cards to render (auth check + fetch)
      await Runtime.evaluate({
        expression: `new Promise(r => {
          const start = Date.now();
          const check = () => {
            const cards = document.querySelectorAll('.flashcard').length;
            if (cards > 0 || Date.now() - start > 8000) r(cards);
            else setTimeout(check, 200);
          };
          check();
        })`,
        awaitPromise: true,
      });
      await new Promise((r) => setTimeout(r, 1000));

      // Find the max-title card and check if its h3 overflows the flashcard container
      const fitCheck = await Runtime.evaluate({
        expression: `(() => {
          const cards = document.querySelectorAll('.flashcard');
          let maxCard = null;
          let maxLen = 0;
          cards.forEach(c => {
            const h3 = c.querySelector('.flashcard-front h3');
            if (h3 && h3.textContent.length > maxLen) {
              maxLen = h3.textContent.length;
              maxCard = c;
            }
          });
          if (!maxCard) return { found: false };
          const h3 = maxCard.querySelector('.flashcard-front h3');
          const front = maxCard.querySelector('.flashcard-front');
          const cardEl = maxCard;
          return {
            found: true,
            titleLen: h3.textContent.length,
            h3ScrollH: h3.scrollHeight,
            h3ClientH: h3.clientHeight,
            h3Overflow: h3.scrollHeight > h3.clientHeight + 2, // 2px tolerance
            frontScrollH: front.scrollHeight,
            frontClientH: front.clientHeight,
            cardHeight: cardEl.offsetHeight,
            cardWidth: cardEl.offsetWidth,
          };
        })()`,
        returnByValue: true,
      });
      const r = fitCheck.result.value;
      log(`    ${vp.name}: card found`, r.found, r.found ? `${r.cardWidth}x${r.cardHeight}` : 'none');
      if (r.found) {
        log(`    ${vp.name}: h3 title fits (${r.titleLen} chars)`, !r.h3Overflow,
          `scrollH=${r.h3ScrollH} clientH=${r.h3ClientH}`);
      }
    }

    // Test 2: Edit modal flow
    console.log('\n=== Test 2: Edit modal flow ===');
    await setViewport(Page, Emulation, 1440, 900);
    await Page.navigate({ url: TARGET_URL + 'app' });
    await Page.loadEventFired();
    await new Promise((r) => setTimeout(r, 3000));

    // Hover the first card to reveal edit button
    const editBtnExists = await Runtime.evaluate({
      expression: `(() => {
        const card = document.querySelector('.flashcard');
        if (!card) return { found: false };
        // ponytail: simulate hover via dispatching mouseenter + CSS :hover doesn't activate without real mouse.
        // Instead, just check that edit button exists in DOM (always rendered, hidden until hover).
        const editBtn = card.querySelector('.flashcard-edit');
        return { found: !!editBtn, btnText: editBtn?.textContent };
      })()`,
      returnByValue: true,
    });
    log('Edit button in DOM', editBtnExists.result.value.found, `text="${editBtnExists.result.value.btnText}"`);

    // Click edit on first card
    await Runtime.evaluate({
      expression: `(() => {
        const btn = document.querySelector('.flashcard .flashcard-edit');
        if (btn) btn.click();
      })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Check modal opened with pre-filled values
    const modalCheck = await Runtime.evaluate({
      expression: `(() => {
        const modal = document.querySelector('.modal-dialog');
        if (!modal) return { open: false };
        // ponytail: scope queries to the modal to avoid hitting other inputs
        const textareas = modal.querySelectorAll('textarea');
        const inputs = modal.querySelectorAll('input[type="text"]');
        return {
          open: true,
          textareaCount: textareas.length,
          inputCount: inputs.length,
          titles: Array.from(textareas).map(t => t.value),
          categories: Array.from(inputs).map(i => i.value),
        };
      })()`,
      returnByValue: true,
    });
    log('Edit modal opened', modalCheck.result.value.open);
    if (modalCheck.result.value.open) {
      log('Has 2 textareas (depan + belakang)', modalCheck.result.value.textareaCount === 2);
      log('Has 1 input (kategori)', modalCheck.result.value.inputCount === 1);
      const hasContent = modalCheck.result.value.titles.some(t => t.length > 0);
      log('At least one textarea has content', hasContent, `titles=${JSON.stringify(modalCheck.result.value.titles.map(t => t.slice(0, 30)))}`);
    }

    // Screenshot edit modal
    const { data: editScreenshot } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/edit-modal.png', Buffer.from(editScreenshot, 'base64'));

    // Modify first textarea (depan/title) — keep under 120 chars
    const newTitle = 'EDIT_CDP_' + Math.random().toString(36).slice(2, 8).toUpperCase();
    await Runtime.evaluate({
      expression: `(() => {
        const ta = document.querySelector('.modal-dialog textarea');
        if (!ta) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, '${newTitle}');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 500));

    // Track PATCH request (URL like /api/flashcards/<uuid>)
    let patchResponse = null;
    Network.responseReceived(({ response }) => {
      if (response.url.includes('/api/flashcards/') && /\/api\/flashcards\/[a-f0-9-]+/.test(response.url)) {
        patchResponse = { status: response.status, url: response.url };
      }
    });

    // Click save
    await Runtime.evaluate({
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('.modal-dialog button[type="submit"]')).find(b => b.textContent.includes('Simpan'));
        if (btn) btn.click();
      })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 2000));

    log('PATCH /api/flashcards/:id called', !!patchResponse,
      patchResponse ? `status=${patchResponse.status}` : 'no request');
    log('PATCH returned 200', patchResponse?.status === 200);

    // Verify via API
    const verifyResult = await Runtime.evaluate({
      expression: `(async () => {
        const res = await fetch('/api/flashcards', { credentials: 'include' });
        const data = await res.json();
        return data.cards.find(c => c.title === '${newTitle}') || null;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    log('Edit persisted in DB', !!verifyResult.result.value,
      verifyResult.result.value ? `title="${verifyResult.result.value.title.slice(0, 40)}..."` : 'not found');

    // Test 3: Over-limit blocks edit save
    console.log('\n=== Test 3: Over-limit blocks edit save ===');
    // Re-open edit on same card
    await Runtime.evaluate({
      expression: `(() => {
        const btn = document.querySelector('.flashcard .flashcard-edit');
        if (btn) btn.click();
      })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Set title to over-limit
    const longTitle = 'B'.repeat(130);
    await Runtime.evaluate({
      expression: `(() => {
        const ta = document.querySelector('.modal-dialog textarea[placeholder*="Pertanyaan"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, '${longTitle}');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 500));

    // Counter should be red
    const counterCheck = await Runtime.evaluate({
      expression: `(() => {
        const counter = document.querySelector('.modal-dialog .word-counter.word-counter-over');
        return counter ? counter.textContent : null;
      })()`,
      returnByValue: true,
    });
    log('Counter shows over-limit (red)', !!counterCheck.result.value, counterCheck.result.value);

    // Submit button should be disabled
    const submitCheck = await Runtime.evaluate({
      expression: `(() => {
        const btn = document.querySelector('.modal-dialog button[type="submit"]');
        return btn ? btn.disabled : null;
      })()`,
      returnByValue: true,
    });
    log('Submit button disabled when over-limit', submitCheck.result.value === true);

    // Screenshot
    const { data: overEditScreenshot } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/edit-overlimit.png', Buffer.from(overEditScreenshot, 'base64'));

    // === Summary ===
    console.log('\n=== Summary ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`\nScreenshots:`);
    console.log(`  - dist/edit-modal.png`);
    console.log(`  - dist/edit-overlimit.png`);

    await client.close();
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('CDP test failed:', err);
    if (client) await client.close();
    process.exit(1);
  }
}

main();
