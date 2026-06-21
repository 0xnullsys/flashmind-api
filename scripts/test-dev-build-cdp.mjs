/**
 * CDP test for build variant (dev banner visible on preview).
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const PREVIEW_URL = 'https://flashmind-ay2iyrhs1-alif-fakhrurrozy-6516s-projects.vercel.app';
const BYPASS_TOKEN = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';

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
    await Emulation.setDeviceMetricsOverride({ width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

    await Page.navigate({ url: PREVIEW_URL });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 3000));

    // Verify dev banner
    const bannerCheck = await Runtime.evaluate({
      expression: `(() => {
        const banner = document.querySelector('.dev-banner');
        if (!banner) return null;
        const rect = banner.getBoundingClientRect();
        return {
          visible: rect.height > 0,
          height: rect.height,
          top: rect.top,
          text: banner.textContent.trim(),
          hasModeLabel: banner.textContent.includes('DEVELOPMENT') || banner.textContent.includes('PRODUCTION'),
          bgColor: window.getComputedStyle(banner).background,
        };
      })()`,
      returnByValue: true,
    });
    log('Dev banner rendered', !!bannerCheck.result.value, JSON.stringify(bannerCheck.result.value));

    if (bannerCheck.result.value) {
      log('Dev banner has mode label', bannerCheck.result.value.hasModeLabel);
      log('Dev banner is at top of viewport', bannerCheck.result.value.top === 0,
        `top=${bannerCheck.result.value.top}px`);
      log('Dev banner has orange/dark background (visible)', bannerCheck.result.value.bgColor.includes('gradient'),
        `bg=${bannerCheck.result.value.bgColor.slice(0, 50)}`);
    }

    // Verify document title has [DEV]
    const titleCheck = await Runtime.evaluate({
      expression: 'document.title',
      returnByValue: true,
    });
    log('Document title has [DEV] suffix', titleCheck.result.value.includes('[DEV]'),
      `title="${titleCheck.result.value}"`);

    // Screenshot
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/dev-build.png', Buffer.from(data, 'base64'));
    console.log('\nScreenshot: dist/dev-build.png');

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
