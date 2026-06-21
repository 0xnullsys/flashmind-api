import CDP from 'chrome-remote-interface';
import fs from 'fs';
const client = await CDP();
const { Page, Runtime, Emulation } = client;
await Page.enable();
await Runtime.enable();
await Emulation.setDeviceMetricsOverride({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await Page.navigate({ url: 'https://flashmind-api.vercel.app/' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 2000));

const login = await Runtime.evaluate({ expression: `(async () => { const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'rls-test@flash.com',password:'rlstest123'}), credentials:'include'}); return r.ok; })()`, awaitPromise: true, returnByValue: true });
console.log('login:', login.result.value);

await Page.navigate({ url: 'https://flashmind-api.vercel.app/app' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 5000));

const state = await Runtime.evaluate({
  expression: `({ url: location.href, cards: document.querySelectorAll('.flashcard').length, sections: document.querySelectorAll('.category-section').length, main: !!document.querySelector('.dashboard-main'), sidebar: !!document.querySelector('.dashboard-sidebar'), h3: document.querySelectorAll('h3').length, html: document.body.innerHTML.length, bodyText: document.body.innerText.slice(0, 200) })`,
  returnByValue: true,
});
console.log(JSON.stringify(state.result.value, null, 2));

const {data} = await Page.captureScreenshot({ format: 'png' });
fs.writeFileSync('E:/FTP/Capstone/flashmind/dist/debug.png', Buffer.from(data, 'base64'));
console.log('screenshot saved');
await client.close();
