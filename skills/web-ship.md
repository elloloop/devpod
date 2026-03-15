# Web App — Full Ship Pipeline

Run the complete web app pipeline for a GitHub issue. Every step updates the issue.

## Arguments

$ARGUMENTS should be a GitHub issue number.
If not provided, read from `.claude/issue`. If that doesn't exist, ask.

## Pipeline

Execute in order, stop on failure:

### 1. Setup
- `gh issue view <number>` — read the issue body AND all comments
- **Read the context chain** from the issue body to understand the full feature scope
- **Read the contract** — look for a "Contract Ready" comment on this issue. This contains the proto definition, the TypeScript client types path, and what RPCs are available. If no contract comment exists, check `gen/ts/` directory in the repo. If neither exists, STOP and tell the user to run `/contract` first.
- Check out or create the issue branch (branch from main so you have the generated code)
- Save issue number to `.claude/issue`

### 2. Understand what to build
- From the contract comment, identify:
  - Which generated TypeScript client types to import (from `gen/ts/`)
  - Which RPCs to call from the UI
  - What the request/response shapes look like
- From the context chain, understand the UX/UI requirements

### 3. Local dev (same as `/web-dev`)
- `npm install`
- `npm run lint`
- `npm run build`
- `npx playwright test`
- Comment on issue
- **Stop if failed** — offer to fix

### 4. Principal engineer review (same as `/review`)
- Read every file you wrote or changed
- Check: security, error handling, performance, correctness, design, tests, naming, scope
- Fix any issues found
- Comment on issue with review results
- **Stop if unfixable issues** — escalate

### 5. Docker E2E (same as `/web-docker`)
- Only if `docker-compose.yml` exists
- `docker compose build && up -d`
- Playwright against container
- `docker compose down -v`
- Comment on issue
- **Stop if failed** — offer to fix

### 6. Create PR (same as `/pr`)
- Push branch
- Create PR with `Closes #<number>`
- Note which RPCs/client types are consumed in the PR description
- Comment on issue with PR link

### 7. Deploy staging (same as `/web-deploy`)
- Only if deploy config exists
- Deploy, smoke test
- Comment on issue

### 8. Final summary

```
gh issue comment <number> --body "### ✅ Web Ship Complete

**Contract**: \`<ServiceName>\`
**RPCs consumed**: <list>

| Step | Status |
|---|---|
| Lint | ✅ |
| Build | ✅ |
| Playwright | ✅ X passed |
| Docker E2E | ✅ / ⏭️ Skipped |
| PR | ✅ #<pr> |
| Staging | ✅ <url> / ⏭️ Skipped |

Ready for review."
```

Also update the parent issue:
```
gh issue comment <parent> --body "### Update: [Web] #<number>
Status: ✅ Complete — PR #<pr> ready for review
RPCs consumed: <list>"
```

## Scope rules — CRITICAL

You may ONLY create/modify files inside your feature directory (`features/<name>/` or `app/(features)/<name>/`). You may ONLY import from `core/`, `lib/core/`, `lib/components/`, and `gen/ts/`.

If you discover you need something that doesn't exist:
- A proto RPC or client type that's not generated → **STOP. Run `/blocked`.**
- A shared component in core that doesn't exist → **STOP. Run `/blocked`.**
- Data or state from another feature → **STOP. Run `/blocked`.**

NEVER create workarounds or mock APIs. NEVER modify files outside your feature. NEVER import from another feature.

## Other rules
- The contract defines the API surface. Import generated types from `gen/ts/` — never hand-write types the proto defines.
- The context chain tells you what the user experience should be.
- Stop on any failure, offer to fix
- Each step updates issue independently
- Never merge PR automatically
- Never deploy to production
