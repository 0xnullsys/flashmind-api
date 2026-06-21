import CDP from 'chrome-remote-interface';
const client = await CDP();
const { Page, Runtime, Network, Emulation } = client;
await Page.enable();
await Runtime.enable();
await Network.enable();
await Network.setExtraHTTPHeaders({ headers: { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '' } });
await Emulation.setDeviceMetricsOverride({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

await Page.navigate({ url: 'https://flashmind-48v0bx7m4-alif-fakhrurrozy-6516s-projects.vercel.app/' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 3000));

await Runtime.evaluate({ expression: `(async () => { await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'rls-test@flash.com',password:'rlstest123'}), credentials:'include'}); })()`, awaitPromise: true });

await Page.navigate({ url: 'https://flashmind-48v0bx7m4-alif-fakhrurrozy-6516s-projects.vercel.app/app' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 5000));

await Runtime.evaluate({ expression: `(() => { const btn = Array.from(document.querySelectorAll('.dashboard-header-right button')).find(b => b.textContent.includes('Kartu Baru')); if (btn) btn.click(); })()`, returnByValue: true });
await new Promise(r => setTimeout(r, 2000));

// Inspect file inputs
const fileInputs = await Runtime.evaluate({
  expression: `(() => {
    const inputs = document.querySelectorAll('.modal-dialog input[type="file"]');
    return Array.from(inputs).map((input, i) => ({
      index: i,
      accept: input.accept,
      capture: input.getAttribute('capture'),
      captureProp: input.capture,
      multiple: input.multiple,
    }));
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(fileInputs.result.value, null, 2));

await client.close();
