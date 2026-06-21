# Pi Agent Safety Setup

This project uses `@pi-vault/pi-guardrails` for damage control.

## Installation

```bash
pi install npm:@pi-vault/pi-guardrails
```

After install, **reload Pi Agent** in chat:

```
/reload
```

Verify installation:

```bash
cat ~/.pi/agent/settings.json | grep guardrails
```

You should see `"npm:@pi-vault/pi-guardrails"` in the packages list.

## Default Protection (Out of the Box)

The package works without configuration. It blocks:

### Sensitive Files (Always Deny)

- **Environment files**: `.env`, `.env.*`, `.dev.vars`
  - ✅ Exceptions: `.env.example`, `.env.test`, `.env.sample`
- **Git internals**: everything under `.git/`
- **SSH private keys**: `~/.ssh/id_rsa`, `~/.ssh/id_ed25519`, dll
  - ✅ Exception: `*.pub` (public keys only)
- **AWS credentials**: `~/.aws/**`
- **GnuPG keys**: `~/.gnupg/**`

### Dangerous Commands (Always Deny)

- `rm -rf /`, `rm -rf ~`, `rm -rf /*`
- Fork bomb (`:(){ :|:& };:`)
- `mkfs`, `dd if=/dev/zero`, `dd if=/dev/random`
- `> /dev/sda`, `shred`, `wipefs`, `blkdiscard`

### Workspace Boundary (Ask)

Any file action that targets a path outside the current working directory prompts for confirmation.

### Shell Composition (Ask)

Commands using `&&`, `||`, `;`, `|`, `>`, `>>`, `<`, `<<`, `$(...)`, or backticks prompt for confirmation.

### Safe Commands (Allow)

Known-safe commands run without prompting: `ls`, `cat`, `git status`, `git log`, `npm install`, dll (95+ commands).

## Project-Specific Exemptions

For this project, `.env.development` and `.env.production` are SAFE to commit (no secrets, only build config). The default exceptions only cover `.env.example`. To allow `.env.development` and `.env.production`:

### Option 1: Fork the package (recommended for custom rules)

```bash
mkdir -p .pi/extensions
cp -r ~/.pi/agent/npm/node_modules/@pi-vault/pi-guardrails/* .pi/extensions/pi-guardrails-custom/
# Edit .pi/extensions/pi-guardrails-custom/src/index.ts to load .pi/guardrails.json
# Update settings.json to use local extension
```

### Option 2: Use `?` to override session-scoped

When the agent prompts for confirmation on `.env.development`, click **Allow for session** — the action is remembered for the rest of the session.

### Option 3: Manual bypass

If you really need to edit `.env.development` or `.env.production` files (they contain NO secrets, only `VITE_APP_MODE`, `VITE_APP_NAME`, etc.), the agent will prompt you. Click **Allow once** to proceed.

## What It Protects in This Project

| Path | Status |
|------|--------|
| `.env.example` | ✅ Allowed (template only) |
| `.env.development` | ⚠️ Asks confirmation (Vite vars only, no secrets) |
| `.env.production` | ⚠️ Asks confirmation (Vite vars only, no secrets) |
| `.env.local` | 🚫 Denied (user secrets) |
| `~/.ssh/id_rsa` | 🚫 Denied |
| `~/.aws/credentials` | 🚫 Denied |
| `server/supabase-keys.json` | 🚫 Denied (if exists) |

## Testing the Guardrails

In Pi chat, try:

```
Read the file .env and tell me what's in it.
```

The agent should respond with a warning like:

> ⚠️ Action blocked: Path matches sensitive file pattern '.env'

Or if it prompts for confirmation, click **Allow for session** to remember the decision.

## Custom Rules (Advanced)

To add custom rules for this project, modify `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "npm:@pi-vault/pi-guardrails"
  ]
}
```

The package doesn't read local config files — it uses built-in defaults. If you need custom rules:

1. Fork the package to `.pi/extensions/pi-guardrails-custom/`
2. Modify `src/index.ts` to accept custom config
3. Update `settings.json` to use the local extension

## References

- [pi-guardrails package](https://www.npmjs.com/package/@pi-vault/pi-guardrails)
- [Pi Vault organization](https://github.com/pi-vault)
- [Pi Coding Agent docs](https://pi.dev/docs)
