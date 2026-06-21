import CDP from 'chrome-remote-interface';
import fs from 'fs';
const client = await CDP();
const { Page, Runtime, Network, Emulation } = client;
await Page.enable();
await Runtime.enable();
await Network.enable();
await Emulation.setDeviceMetricsOverride({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await Network.setCacheDisabled({ cacheDisabled: true });

const consoleMsgs = [];
const errors = [];
Runtime.consoleAPICalled(({ type, args }) => {
  consoleMsgs.push(`[${type}] ${args.map(a => a.value || a.description || '').join(' ')}`);
});
Runtime.exceptionThrown(({ exceptionDetails }) => {
  errors.push(exceptionDetails.exception?.description || JSON.stringify(exceptionDetails));
});

await Page.navigate({ url: 'https://flashmind-api.vercel.app/?nocache=' + Date.now() });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 3000));

const loginRes = await Runtime.evaluate({
  expression: `(async () => { const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'rls-test@flash.com',password:'rlstest123'}), credentials:'include'}); return r.ok; })()`,
  awaitPromise: true,
  returnByValue: true,
});
console.log('Login:', loginRes.result.value);

await Page.navigate({ url: 'https://flashmind-api.vercel.app/app?nocache=' + Date.now() });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 8000));

const bundle = await Runtime.evaluate({ expression: `Array.from(document.querySelectorAll('script[src*="index-"]')).map(s => s.src)`, returnByValue: true });
console.log('Bundles loaded:', bundle.result.value);

const state = await Runtime.evaluate({
  expression: `({ url: location.href, html: document.body.innerHTML.length, root: !!document.getElementById('root'), rootContent: document.getElementById('root')?.innerHTML?.length || 0 })`,
  returnByValue: true,
});
console.log('State:', JSON.stringify(state.result.value));

console.log('\n=== Console ===');
consoleMsgs.forEach(m => console.log(' ', m));
console.log('\n=== Errors ===');
errors.forEach(e => console.log(' ', e));

const {data} = await Page.captureScreenshot({ format: 'png' });
fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/debug.png', Buffer.from(data, 'base64'));

await client.close();
