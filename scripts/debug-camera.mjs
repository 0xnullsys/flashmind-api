import CDP from 'chrome-remote-interface';
const client = await CDP();
const { Page, Runtime, Emulation } = client;
await Page.enable();
await Runtime.enable();
await Emulation.setDeviceMetricsOverride({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

await Page.navigate({ url: 'https://flashmind-api.vercel.app/' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 2000));
await Runtime.evaluate({ expression: `(async () => { await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'rls-test@flash.com',password:'rlstest123'}), credentials:'include'}); })()`, awaitPromise: true });
await Page.navigate({ url: 'https://flashmind-api.vercel.app/app' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 5000));

// Test getUserMedia in this context (real Chrome has no camera)
const probe = await Runtime.evaluate({
  expression: `(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const tracks = stream.getTracks();
      tracks.forEach(t => t.stop());
      return { ok: true, trackCount: tracks.length };
    } catch (err) {
      return { ok: false, error: err.message, name: err.name };
    }
  })()`,
  awaitPromise: true, returnByValue: true,
});
console.log('getUserMedia probe:', JSON.stringify(probe.result.value));

// Now mock + test
const mockTest = await Runtime.evaluate({
  expression: `(async () => {
    try {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            const track = { stop: () => console.log('stopped') };
            return { getTracks: () => [track] };
          },
        },
      });
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const tracks = stream.getTracks();
      tracks.forEach(t => t.stop());
      return { ok: true, trackCount: tracks.length, mockWorks: true };
    } catch (err) {
      return { ok: false, error: err.message, name: err.name };
    }
  })()`,
  awaitPromise: true, returnByValue: true,
});
console.log('Mocked getUserMedia:', JSON.stringify(mockTest.result.value));

await client.close();
