import CDP from 'chrome-remote-interface';
const client = await CDP();
const { Page, Runtime, Network, Emulation } = client;
await Page.enable();
await Runtime.enable();
await Network.enable();
await Network.setCacheDisabled({ cacheDisabled: true });
await Emulation.setDeviceMetricsOverride({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

await Page.navigate({ url: 'http://localhost:3000/' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 2000));

await Runtime.evaluate({ expression: `(async () => { await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'rls-test@flash.com',password:'rlstest123'}), credentials:'include'}); })()`, awaitPromise: true });

await Page.navigate({ url: 'http://localhost:3000/app' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 5000));

const state = await Runtime.evaluate({
  expression: `JSON.stringify({ url: location.href, buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 30)), cards: document.querySelectorAll('.flashcard').length, dashboardHeader: !!document.querySelector('.dashboard-header') })`,
  returnByValue: true,
});
console.log('Dashboard state:', state.result.value);

// Try click
await Runtime.evaluate({ expression: `(() => { const btn = Array.from(document.querySelectorAll('.dashboard-header-right button')).find(b => b.textContent.includes('Kartu Baru')); if (btn) btn.click(); else console.log('not found'); })()`, returnByValue: true });
await new Promise(r => setTimeout(r, 2000));

const modalState = await Runtime.evaluate({
  expression: `JSON.stringify({ modal: !!document.querySelector('.modal-dialog'), modalWide: !!document.querySelector('.modal-dialog.modal-wide'), allModalDialogs: document.querySelectorAll('.modal-dialog').length, btns: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 25)) })`,
  returnByValue: true,
});
console.log('After click:', modalState.result.value);

await client.close();
