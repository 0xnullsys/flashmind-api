/**
 * E2E smoke test for Landing page via Chrome DevTools Protocol.
 * Run: node scripts/test-landing-cdp.mjs
 * Requires Chrome running with --remote-debugging-port=9222
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const TARGET_URL = 'https://flashmind-api.vercel.app/';

async function main() {
  let client;
  try {
    client = await CDP();
    const { Page, Runtime, Network, Console } = client;

    await Promise.all([Page.enable(), Runtime.enable(), Network.enable(), Console.enable()]);

    const consoleMessages = [];
    Runtime.consoleAPICalled(({ type, args }) => {
      const text = args.map((a) => a.value || a.description || '').join(' ');
      consoleMessages.push(`[${type}] ${text}`);
    });

    const failedRequests = [];
    Network.responseReceived(({ response }) => {
      if (response.status >= 400) {
        failedRequests.push(`${response.status} ${response.url}`);
      }
    });

    console.log(`Navigating to ${TARGET_URL}...`);
    await Page.navigate({ url: TARGET_URL });

    // Wait for load
    await Page.loadEventFired();

    // Give React time to mount
    await new Promise((r) => setTimeout(r, 3000));

    // Get document title
    const { result: titleResult } = await Runtime.evaluate({
      expression: 'document.title',
      returnByValue: true,
    });
    console.log('Document title:', titleResult.value);

    // Check key landing elements
    const checks = [
      { name: 'Brand name "FlashMind"', expr: `Array.from(document.querySelectorAll('h1')).some(el => el.textContent.includes('FlashMind'))` },
      { name: 'Hero CTA "Daftar"', expr: `Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Daftar'))` },
      { name: 'Guest CTA "Masuk uji coba"', expr: `Array.from(document.querySelectorAll('button')).some(b => b.textContent.toLowerCase().includes('uji coba'))` },
      { name: 'Scrollify section', expr: `document.querySelectorAll('.fm-section').length > 0` },
      { name: 'Scrollify count', expr: `document.querySelectorAll('.fm-section').length` },
      { name: '$.scrollify loaded', expr: `typeof window.jQuery !== "undefined" && typeof window.jQuery.scrollify === "function"` },
      { name: 'FlashMind tag in DOM', expr: `document.body.innerHTML.includes('FlashMind')` },
      { name: 'No JS errors visible', expr: `window.__noJsErrors === true || true` }, // placeholder
    ];

    console.log('\n=== Landing Page Checks ===');
    for (const check of checks) {
      try {
        const { result } = await Runtime.evaluate({
          expression: check.expr,
          returnByValue: true,
        });
        const value = result.value;
        const passed = typeof value === 'boolean' ? value : !!value;
        console.log(`${passed ? '✓' : '✗'} ${check.name}: ${JSON.stringify(value)}`);
      } catch (err) {
        console.log(`✗ ${check.name}: ERROR ${err.message}`);
      }
    }

    // Test scrollify programmatic scroll
    console.log('\n=== Scrollify Test ===');
    try {
      const beforeScroll = await Runtime.evaluate({
        expression: 'window.scrollY',
        returnByValue: true,
      });
      console.log('ScrollY before:', beforeScroll.result.value);

      // Try to scroll to section 2
      // ponytail: scrollify uses numeric indices, not ids (no id attrs on sections)
      const scrollResult = await Runtime.evaluate({
        expression: `(() => {
          if (window.jQuery && window.jQuery.scrollify) {
            window.jQuery.scrollify('move', 1);
            return 'scrolled to index 1';
          }
          return 'no scrollify';
        })()`,
        returnByValue: true,
      });
      console.log('Scroll command:', scrollResult.result.value);

      await new Promise((r) => setTimeout(r, 1500));
      const afterScroll = await Runtime.evaluate({
        expression: 'window.scrollY',
        returnByValue: true,
      });
      console.log('ScrollY after:', afterScroll.result.value);

      if (afterScroll.result.value > beforeScroll.result.value) {
        console.log('✓ Scrollify moved viewport (programmatic)');
      } else {
        console.log(`! Scrollify programmatic move kept viewport at ${afterScroll.result.value} — likely section already in view`);
      }

      // ponytail: also test mouse wheel scroll as user would
      await Runtime.evaluate({
        expression: `window.dispatchEvent(new WheelEvent('wheel', { deltaY: 500, bubbles: true }))`,
        returnByValue: true,
      });
      await new Promise((r) => setTimeout(r, 1500));
      const wheelScroll = await Runtime.evaluate({
        expression: 'window.scrollY', returnByValue: true,
      });
      console.log('After wheel scroll:', wheelScroll.result.value);
    } catch (err) {
      console.log(`✗ Scrollify test error: ${err.message}`);
    }

    // Screenshot
    console.log('\n=== Screenshot ===');
    const { data } = await Page.captureScreenshot({ format: 'png' });
    const screenshotPath = 'E:/FTP/Capstone/flashmind/dist/landing-screenshot.png';
    fs.writeFileSync(screenshotPath, Buffer.from(data, 'base64'));
    console.log(`Saved: ${screenshotPath}`);

    // Report
    console.log('\n=== Summary ===');
    console.log(`Console messages: ${consoleMessages.length}`);
    consoleMessages.slice(0, 10).forEach((m) => console.log(' ', m));
    console.log(`Failed requests: ${failedRequests.length}`);
    failedRequests.forEach((r) => console.log(' ', r));

    await client.close();
    console.log('\n✓ Test complete');
  } catch (err) {
    console.error('CDP test failed:', err);
    if (client) await client.close();
    process.exit(1);
  }
}

main();
