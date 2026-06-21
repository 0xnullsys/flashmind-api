/**
 * CDP test camera modal on mobile viewport (≤480px).
 * Verifies modal becomes full-screen, video is large, all elements visible.
 */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const PREVIEW_URL = 'https://flashmind-ivydiz2ht-alif-fakhrurrozy-6516s-projects.vercel.app';
const BYPASS_TOKEN = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
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

    // ponytail: iPhone 14 viewport (mobile)
    await Emulation.setDeviceMetricsOverride({
      width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
    });
    await Emulation.setUserAgentOverride({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });

    await Page.navigate({ url: PREVIEW_URL });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 3000));

    // Login
    const login = await Runtime.evaluate({
      expression: `(async () => { const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'${LOGIN_EMAIL}', password:'${LOGIN_PASSWORD}'}), credentials:'include'}); return r.ok; })()`,
      awaitPromise: true, returnByValue: true,
    });
    log('Login', login.result.value);

    // Mock getUserMedia
    await Runtime.evaluate({
      expression: `(() => {
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }) },
        });
      })()`,
      returnByValue: true,
    });

    await Page.navigate({ url: PREVIEW_URL + '/app' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 5000));

    // Re-mock (in case navigation reset it)
    await Runtime.evaluate({
      expression: `(() => {
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }) },
        });
      })()`,
      returnByValue: true,
    });

    // Open editor
    await Runtime.evaluate({
      expression: `(() => { const btn = Array.from(document.querySelectorAll('.dashboard-header-right button')).find(b => b.textContent.includes('Kartu Baru')); if (btn) btn.click(); })()`,
      returnByValue: true,
    });
    await new Promise(r => setTimeout(r, 3000));

    // Check camera button visible on mobile
    const cameraBtnCheck = await Runtime.evaluate({
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto') || b.textContent.includes('Memeriksa'));
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        return {
          text: btn.textContent.trim(),
          disabled: btn.disabled,
          visible: rect.width > 0 && rect.height > 0,
          rect: { width: rect.width, height: rect.height },
        };
      })()`,
      returnByValue: true,
    });
    log('Camera button visible on mobile', cameraBtnCheck.result.value?.visible, JSON.stringify(cameraBtnCheck.result.value));

    if (!cameraBtnCheck.result.value?.disabled) {
      // Scroll button into view + click (mobile viewport may need scroll)
      await Runtime.evaluate({
        expression: `(() => { const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto')); if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); } })()`,
        returnByValue: true,
      });
      await new Promise(r => setTimeout(r, 3000));

      // Verify click took effect
      const afterFirstClick = await Runtime.evaluate({
        expression: `(() => ({ hasModal: !!document.querySelector('.camera-modal'), hasEditorModal: !!document.querySelector('.modal-dialog:not(.camera-modal)') }))()`,
        returnByValue: true,
      });
      console.log(`  After first click: ${JSON.stringify(afterFirstClick.result.value)}`);

      // Retry if needed
      if (!afterFirstClick.result.value.hasModal) {
        await Runtime.evaluate({
          expression: `(() => { const btn = Array.from(document.querySelectorAll('.modal-dialog button')).find(b => b.textContent.includes('Ambil foto')); if (btn) btn.click(); })()`,
          returnByValue: true,
        });
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Measure camera modal
    const modalMeasure = await Runtime.evaluate({
      expression: `(() => {
        const modal = document.querySelector('.camera-modal');
        if (!modal) return null;
        const rect = modal.getBoundingClientRect();
        const video = modal.querySelector('.camera-modal-video');
        const videoRect = video ? video.getBoundingClientRect() : null;
        const heading = Array.from(modal.querySelectorAll('h2')).find(h => h.textContent.includes('Ambil Foto Catatan'));
        // ponytail: shutter button has no text/emoji — query by class
        const captureBtn = document.querySelector('.camera-capture-btn');
        const cancelBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Batal'));
        return {
          modal: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
          video: videoRect ? { width: videoRect.width, height: videoRect.height } : null,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          hasHeading: !!heading,
          headingText: heading?.textContent,
          hasCaptureBtn: !!captureBtn,
          captureBtnVisible: captureBtn ? (captureBtn.getBoundingClientRect().width > 0) : false,
          hasCancelBtn: !!cancelBtn,
        };
      })()`,
      returnByValue: true,
    });

    if (modalMeasure.result.value) {
      const m = modalMeasure.result.value;
      console.log(`  Viewport: ${m.viewport.width}x${m.viewport.height}`);
      console.log(`  Modal: ${m.modal.width}x${m.modal.height} at (${m.modal.left}, ${m.modal.top})`);
      console.log(`  Video: ${m.video ? `${m.video.width}x${m.video.height}` : 'none'}`);
      console.log(`  Heading: "${m.headingText}"`);
      console.log(`  Capture btn visible: ${m.captureBtnVisible}`);
      console.log(`  Cancel btn: ${m.hasCancelBtn}`);

      log('Camera modal opens on mobile', !!m.modal);
      log('Heading visible', m.hasHeading);
      log('Heading text correct', m.headingText?.includes('Ambil Foto Catatan'));

      // ponytail: on mobile (≤480px), modal should be nearly full-screen
      const modalWidthRatio = m.modal.width / m.viewport.width;
      const modalHeightRatio = m.modal.height / m.viewport.height;
      log('Modal width ≥95% of viewport (full-screen)', modalWidthRatio >= 0.95,
        `width=${m.modal.width}px (${(modalWidthRatio * 100).toFixed(1)}% of ${m.viewport.width}px)`);
      log('Modal height ≥85% of viewport (full-screen)', modalHeightRatio >= 0.85,
        `height=${m.modal.height}px (${(modalHeightRatio * 100).toFixed(1)}% of ${m.viewport.height}px)`);

      // ponytail: video should be wide enough to actually see what user is capturing
      log('Video is wide (≥300px on mobile)', m.video?.width >= 300, `width=${m.video?.width}px`);
      log('Video is tall (≥300px on mobile)', m.video?.height >= 300, `height=${m.video?.height}px`);

      // ponytail: capture button should be visible and tappable (≥44px height for touch targets)
      if (m.captureBtnVisible) {
        const captureRect = await Runtime.evaluate({
          expression: `(() => {
            // ponytail: shutter has no text/emoji — query by class
            const btn = document.querySelector('.camera-capture-btn');
            if (!btn) return null;
            const rect = btn.getBoundingClientRect();
            const cs = window.getComputedStyle(btn);
            return { width: rect.width, height: rect.height, borderRadius: cs.borderRadius };
          })()`,
          returnByValue: true,
        });
        const r = captureRect.result.value;
        log('Capture button tap-friendly (≥44px)', r.height >= 44, `height=${r.height}px`);
      }

      log('Camera button visible', m.captureBtnVisible);
      log('Cancel button present', m.hasCancelBtn);

      // ponytail: verify shutter button is large + circular (iOS Camera style)
      if (m.captureBtnVisible) {
        const captureStyle = await Runtime.evaluate({
          expression: `(() => {
            // ponytail: shutter has CSS-only icon (no text content); query by class
            const btn = document.querySelector('.camera-capture-btn');
            if (!btn) return null;
            const cs = window.getComputedStyle(btn);
            const rect = btn.getBoundingClientRect();
            return {
              borderRadius: cs.borderRadius,
              width: rect.width,
              height: rect.height,
              hasOnlyEmoji: btn.textContent.trim() === '',
            };
          })()`,
          returnByValue: true,
        });
        const s = captureStyle.result.value;
        if (s) {
          log('Shutter button is circular (border-radius ≥ 36px)', parseFloat(s.borderRadius) >= 36,
            `border-radius=${s.borderRadius}`);
          log('Shutter button large (≥64px)', s.width >= 64 && s.height >= 64,
            `${s.width}x${s.height}px`);
          log('Shutter button has no text/emoji', s.hasOnlyEmoji);
        }

        // ponytail: verify button position relative to viewport (bottom in portrait)
        const buttonPosition = await Runtime.evaluate({
          expression: `(() => {
            // ponytail: shutter has CSS-only icon (no text content); query by class
            const btn = document.querySelector('.camera-capture-btn');
            if (!btn) return null;
            const rect = btn.getBoundingClientRect();
            const vh = window.innerHeight;
            const distanceFromBottom = vh - rect.bottom;
            const shutterCenterX = rect.left + rect.width / 2;
            const viewportCenterX = window.innerWidth / 2;
            const distanceFromCenterX = Math.abs(shutterCenterX - viewportCenterX);
            return {
              distanceFromBottom,
              distanceFromCenterX,
              vh,
              vw: window.innerWidth,
              text: btn.textContent.trim(),
              hasInnerDot: !!window.getComputedStyle(btn, '::before').content,
            };
          })()`,
          returnByValue: true,
        });
        const pos = buttonPosition.result.value;
        if (pos) {
          log('Portrait: shutter near bottom (within 100px of bottom)', pos.distanceFromBottom < 100,
            `distanceFromBottom=${pos.distanceFromBottom.toFixed(0)}px`);
          log('Portrait: shutter horizontally centered (within 10px)', pos.distanceFromCenterX < 10,
            `off-center=${pos.distanceFromCenterX.toFixed(0)}px`);
          log('Portrait: shutter has no text/emoji content', pos.text === '',
            `text="${pos.text}"`);
          log('Portrait: shutter has CSS inner dot (::before)', pos.hasInnerDot && pos.hasInnerDot !== 'none',
            `::before content=${pos.hasInnerDot}`);
        }
      }
    } else {
      log('Camera modal opens on mobile', false);
    }

    // Screenshots: portrait + landscape
    const { data: portraitData } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/camera-mobile-portrait.png', Buffer.from(portraitData, 'base64'));
    console.log('\nPortrait screenshot: dist/camera-mobile-portrait.png');

    // Landscape test (rotate device)
    // ponytail: change dimensions + media feature emulation so @media (orientation: landscape) matches
    await Emulation.setDeviceMetricsOverride({
      width: 844, height: 390, deviceScaleFactor: 3, mobile: true,
    });
    // ponytail: clear feature overrides so device-pixel-ratio matches
    await Emulation.clearDeviceMetricsOverride();
    await Emulation.setDeviceMetricsOverride({
      width: 844, height: 390, deviceScaleFactor: 3, mobile: true,
    });
    await Page.setLifecycleEventsEnabled({ enabled: true });
    // Force layout reflow + media query re-evaluation
    await Runtime.evaluate({ expression: `window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('orientationchange'));`, returnByValue: true });
    await new Promise(r => setTimeout(r, 2500));

    // Debug: check orientation
    const orientDebug = await Runtime.evaluate({
      expression: `JSON.stringify({ w: window.innerWidth, h: window.innerHeight, portrait: window.matchMedia('(orientation: portrait)').matches, landscape: window.matchMedia('(orientation: landscape)').matches })`,
      returnByValue: true,
    });
    console.log(`  Orientation debug: ${orientDebug.result.value}`);

    const landscapeMeasure = await Runtime.evaluate({
      expression: `(() => {
        const modal = document.querySelector('.camera-modal');
        if (!modal) return null;
        const rect = modal.getBoundingClientRect();
        // ponytail: shutter button has no text/emoji — query by class
        const shutterBtn = document.querySelector('.camera-capture-btn');
        const shutterRect = shutterBtn ? shutterBtn.getBoundingClientRect() : null;
        return {
          modal: { width: rect.width, height: rect.height, left: rect.left },
          shutter: shutterRect ? { left: shutterRect.left, top: shutterRect.top, width: shutterRect.width, height: shutterRect.height } : null,
          vw: window.innerWidth, vh: window.innerHeight,
        };
      })()`,
      returnByValue: true,
    });
    if (landscapeMeasure.result.value) {
      const m = landscapeMeasure.result.value;
      console.log(`\n  Landscape: viewport=${m.vw}x${m.vh}, modal=${m.modal.width}x${m.modal.height}`);
      console.log(`  Shutter: ${m.shutter ? `at (${m.shutter.left.toFixed(0)}, ${m.shutter.top.toFixed(0)}) ${m.shutter.width}x${m.shutter.height}` : 'none'}`);

      // ponytail: landscape should have horizontal layout (modal is full width)
      log('Landscape: modal full-width', m.modal.width >= m.vw * 0.95,
        `width=${m.modal.width}/${m.vw}=${(m.modal.width / m.vw * 100).toFixed(0)}%`);

      // ponytail: shutter should be on the right side, not blocking video
      if (m.shutter) {
        const rightDistance = m.vw - m.shutter.left - m.shutter.width;
        const centerX = m.vw / 2;
        const shutterCenterX = m.shutter.left + m.shutter.width / 2;
        log('Landscape: shutter on right side (not center)', shutterCenterX > centerX,
          `centerX=${centerX.toFixed(0)}px, shutterCenterX=${shutterCenterX.toFixed(0)}px`);
        log('Landscape: shutter not at far edge (within 100px of right)', rightDistance < 100,
          `rightDistance=${rightDistance.toFixed(0)}px`);
        log('Landscape: shutter vertically centered', Math.abs(m.shutter.top + m.shutter.height / 2 - m.vh / 2) < 100,
          `vCenter=${m.vh / 2}, shutterVCenter=${(m.shutter.top + m.shutter.height / 2).toFixed(0)}`);
      }
    }

    const { data: landscapeData } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/camera-mobile-landscape.png', Buffer.from(landscapeData, 'base64'));
    console.log('Landscape screenshot: dist/camera-mobile-landscape.png');

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
