# FlashMind — AI agent rules
# Read by Pi Agent for this project only.

## Repository layout

- Two branches: `main` (production) and `dev` (active work).
- Test/debug scripts (`scripts/test-*.mjs`, `scripts/debug-*.mjs`) live on `dev` only.
- `.env` is gitignored; secrets live in `.env` (local) or Vercel project env (deployed).
- `hf-space-source/` is gitignored; user manually syncs to HF Space.
- `cloudflare-worker/` is the edge proxy for HF Space.

## Code conventions

- TypeScript strict; React 18; Vite build.
- Style: Tailwind-like utility CSS in `src/styles.css`, no CSS-in-JS.
- Tests: Vitest, 48+ passing. Run `npm test` to verify.
- No emojis in code, comments, commit messages, or UI strings. Use text labels.

## Workflow

- Always check `git status` and `git log --oneline -5` before major changes.
- Prefer cherry-pick over merge when bringing dev work to main.
- Use `git push origin +<branch>` only after explicit user confirmation (force push).
- Never commit `.env` or hardcoded secrets. If you find one, scrub via `git-filter-repo`.

## Deploy

- Vercel auto-deploys on push:
  - `dev` branch -> preview deployment
  - `main` branch -> production
- Vercel preview URLs require SSO login OR `x-vercel-protection-bypass` header.
- Vercel env vars for production secrets are configured in dashboard, not in `.env`.

## Pi Agent rules

- Never use emojis in any output.
- No filler ("Sure!", "Let me explain"). Lead with the result.
- Use code blocks for commands, paths, identifiers.
- Verify with `npx tsc --noEmit && npm test` after TS changes.
- Force push requires explicit user confirmation.
