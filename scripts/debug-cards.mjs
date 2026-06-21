import CDP from 'chrome-remote-interface';
const client = await CDP();
const { Page, Runtime, Network } = client;
await Page.enable();
await Runtime.enable();
await Network.setCacheDisabled({ cacheDisabled: true });

await Page.navigate({ url: 'https://flashmind-api.vercel.app/' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 2000));

await Runtime.evaluate({ expression: `(async () => { await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'rls-test@flash.com',password:'rlstest123'}), credentials:'include'}); })()`, awaitPromise: true });

await Page.navigate({ url: 'https://flashmind-api.vercel.app/app' });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 5000));

const result = await Runtime.evaluate({
  expression: `(() => {
    const cards = document.querySelectorAll('.flashcard');
    const out = [];
    cards.forEach(card => {
      const h3 = card.querySelector('.flashcard-front h3');
      out.push({ len: h3?.textContent?.length, sample: h3?.textContent?.slice(0, 30) });
    });
    const target = 140;
    const found = out.find(c => c.len === target);
    return { totalCards: cards.length, cardInfo: out, foundFor140: found || null };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(result.result.value, null, 2));
await client.close();
