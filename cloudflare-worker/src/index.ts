// Cloudflare Worker proxy: Vercel → Cloudflare → HF Space
// Deploy: `wrangler deploy` di folder ini. Set secret `HF_TARGET` jika perlu override.
//
// Vercel akan panggil `https://your-worker.workers.dev/v1/cards`
// dengan multipart form-data, dan Worker forward ke HF Space.

export interface Env {
  HF_TARGET?: string; // optional override; default pakai URL Space
}

const DEFAULT_HF_SPACE = 'https://cfcc557d6y-flashmind-ai-services.hf.space';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, proxy: 'cf-worker' }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.pathname === '/v1/cards' && request.method === 'POST') {
      const target = (env.HF_TARGET || DEFAULT_HF_SPACE) + '/v1/cards';
      const formData = await request.formData();
      const res = await fetch(target, { method: 'POST', body: formData });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          'content-type': res.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  },
};