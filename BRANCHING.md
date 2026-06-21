# Branching & Deploy Strategy

## Branch → Vercel Environment

| Branch pattern | Vercel env | URL example | Auto-deploy |
|----------------|------------|-------------|-------------|
| `main` | Production | `https://flashmind-api.vercel.app` | ✓ on push |
| `dev` | Preview (persistent) | `https://flashmind-api-git-dev-<team>.vercel.app` | ✓ on push |
| `feat/*` | Preview (ephemeral) | `https://flashmind-git-feat-xxx-<team>.vercel.app` | ✓ on push |
| `fix/*` | Preview (ephemeral) | `https://flashmind-git-fix-yyy-<team>.vercel.app` | ✓ on push |
| PR from any branch | Preview (PR-specific) | comment on PR | ✓ on PR open/update |

## Workflow

```bash
# 1. Create feature branch from dev (not main)
git checkout dev
git pull origin dev
git checkout -b feat/my-feature

# 2. Develop + commit
git add -A
git commit -m "feat: ..."

# 3. Push branch → Vercel auto-creates preview URL
git push origin feat/my-feature

# 4. Test on preview URL (e.g. https://flashmind-git-feat-my-feature-...vercel.app)

# 5. Open PR to dev branch → CI/CD runs + comment preview URL
#    gh pr create --base dev --head feat/my-feature

# 6. After PR approval + merge to dev:
git checkout dev
git pull origin dev

# 7. Promote dev to main for production release:
#    Via PR (recommended): gh pr create --base main --head dev --title "Release v1.x"
#    Or directly (for solo dev): git checkout main && git merge dev && git push origin main
```

## Environment Variables

Each Vercel environment (Production, Preview) can have different env vars.

- **Production** (main branch): real Supabase, real Cloudinary
- **Preview** (dev/feat branches): can use **separate Supabase project** + **test Cloudinary account** to avoid polluting production data

### Setup Preview env (optional, recommended)

```bash
# Create test Supabase project → get URL + service_role key
# Create Cloudinary test account → get cloud_name + api_key + api_secret

# Set Preview env in Vercel:
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
vercel env add CLOUDINARY_CLOUD_NAME preview
vercel env add CLOUDINARY_API_KEY preview
vercel env add CLOUDINARY_API_SECRET preview
```

## Database Migrations

Run `server/schema.sql` in Supabase SQL Editor **once** (idempotent, safe to re-run).
Schema is the same for production + preview — just point to different Supabase projects via env vars.

## Local dev

`npm run dev` runs both frontend (Vite :5173) + backend (tsx watch server/dev.ts) concurrently.
Uses `.env` for local secrets — never commit.
