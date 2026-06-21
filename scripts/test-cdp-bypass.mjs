import CDP from 'chrome-remote-interface';
const client = await CDP();
const { Page, Network, Runtime } = client;
await Page.enable();
await Network.enable();
await Network.setCacheDisabled({ cacheDisabled: true });

// Try setting the bypass as a query string in URL (Vercel accepts ?x-vercel-protection-bypass=TOKEN)
const URL = `https://flashmind-48v0bx7m4-alif-fakhrurrozy-6516s-projects.vercel.app/?x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''}`;
await Page.navigate({ url: URL });
await Page.loadEventFired();
await new Promise(r => setTimeout(r, 3000));
const status = await Runtime.evaluate({ expression: 'document.title', returnByValue: true });
console.log('Title:', status.result.value);
const hasAuth = await Runtime.evaluate({ expression: 'document.title.includes("Authentication")', returnByValue: true });
console.log('Auth wall:', hasAuth.result.value);
await client.close();
