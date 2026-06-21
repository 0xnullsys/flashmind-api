# FlashMind

AI-powered flashcard learning platform. Convert notes into structured Q/A flashcards.

> Looking for the full documentation, architecture, and development guide? Switch to the `dev` branch.

## Quick Start

Requires **Node.js 20+**.

```bash
# 1. Clone
git clone https://github.com/0xnullsys/flashmind-api.git
cd flashmind-api

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env with your values (Supabase URL/key, Cloudinary, HF Space token, etc.)
# See .env.example for all available variables and their purpose.

# 4. Run dev server (frontend + API with hot reload)
npm run dev
```

For a production build (frontend bundle only — backend is Vercel serverless):

```bash
npm run build:prod   # outputs to dist/
```

## Deployment

This repo deploys to Vercel. The frontend is built from `index.html` + `src/`,
and the API runs as a single serverless function from `index.ts`. Push to
`main` and Vercel will build and deploy automatically if connected.

## Local-only files

The `dev` branch contains extra files (test scripts, debug helpers, test
fixtures) that are intentionally excluded from `main`.

## What you need in `.env`

The minimum to boot:

| Var | What |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `SESSION_SECRET` | Random 32+ char string for cookie signing |

For full functionality (AI cards, image uploads), see comments in `.env.example`.

## Branches

- **`main`** — production-ready code. What you cloned.
- **`dev`** — active development, including test scripts, fixtures, and detailed docs.

## License

[MIT](./LICENSE) © 2026 0xnullsys@github
