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

// Click + Kartu Baru
await Runtime.evaluate({ expression: `(() => { const btn = Array.from(document.querySelectorAll('.dashboard-header-right button')).find(b => b.textContent.includes('Kartu Baru')); if (btn) btn.click(); })()`, returnByValue: true });
await new Promise(r => setTimeout(r, 1500));

const {data} = await Page.captureScreenshot({ format: 'png' });
await import('fs').then(fs => fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/merged-dialog.png', Buffer.from(data, 'base64')));
console.log('saved');
await client.close();
