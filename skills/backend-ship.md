# Backend — Full Ship Pipeline

Run the complete backend pipeline for a GitHub issue. Every step updates the issue.

## Arguments

$ARGUMENTS should be a GitHub issue number.
If not provided, read from `.claude/issue`. If that doesn't exist, ask.

## Pipeline

Execute in order, stop on failure:

### 1. Setup
- `gh issue view <number>` — read the issue body AND all comments
- **Read the context chain** from the issue body to understand the full feature scope
- **Read the contract** — look for a "Contract Ready" comment on this issue. This contains the proto definition, RPCs, messages, and the path to generated code. If no contract comment exists, check `proto/` directory in the repo. If neither exists, STOP and tell the user to run `/contract` first.
- Check out or create the issue branch (branch from main so you have the generated code)
- Save issue number to `.claude/issue`

### 2. Understand what to implement
- From the contract comment, identify:
  - Which service interface to implement (from generated Go/Python/Rust stubs)
  - Which RPCs need handlers
  - What the request/response messages look like
- From the context chain, understand the business logic each RPC should perform

### 3. Local dev (same as `/backend-dev`)
- Install/sync dependencies
- Lint
- Build
- Run tests
- Comment on issue
- **Stop if failed** — offer to fix

### 4. Principal engineer review (same as `/review`)
- Read every file you wrote or changed
- Check: security, error handling, performance, correctness, design, tests, naming, scope
- Fix any issues found
- Comment on issue with review results
- **Stop if unfixable issues** — escalate

### 5. Docker integration (same as `/backend-docker`)
- Only if `docker-compose.yml` exists
- Build, start, integration test, tear down
- Comment on issue
- **Stop if failed** — offer to fix

### 6. Create PR (same as `/pr`)
- Push branch
- Create PR with `Closes #<number>`
- Include which RPCs were implemented in the PR description
- Comment on issue with PR link

### 7. Deploy staging (same as `/backend-deploy`)
- Only if deploy config exists
- Deploy, smoke test
- Comment on issue

### 8. Final summary

```
gh issue comment <number> --body "### ✅ Backend Ship Complete

**Contract**: \`<ServiceName>\`
**RPCs implemented**: <list>

| Step | Status |
|---|---|
| Lint | ✅ |
| Build | ✅ |
| Tests | ✅ X passed |
| Coverage | X% |
| Docker integration | ✅ / ⏭️ Skipped |
| PR | ✅ #<pr> |
| Staging | ✅ <url> / ⏭️ Skipped |

Ready for review."
```

Also update the parent issue (from `Parent: #<number>` in the issue body):
```
gh issue comment <parent> --body "### Update: [Backend] #<number>
Status: ✅ Complete — PR #<pr> ready for review
RPCs implemented: <list>"
```

## Scope rules — CRITICAL

You may ONLY create/modify files inside your module directory (`modules/<name>/`). You may ONLY import from `core/` and `gen/`.

If you discover you need something that doesn't exist:
- A proto RPC that's not defined → **STOP. Run `/blocked`.**
- An event from another module that's not published → **STOP. Run `/blocked`.**
- A utility in core that doesn't exist → **STOP. Run `/blocked`.**
- Data from another module → **STOP. Run `/blocked`.**

NEVER create workarounds, mocks, or stubs for missing dependencies. NEVER modify files outside your module. NEVER import from another module.

## Other rules
- The contract (proto) defines WHAT to build. The context chain defines WHY and the business logic.
- Always implement against generated types — never hand-write types the proto defines
- Stop on any failure, offer to fix
- Each step updates issue independently
- Never merge PR automatically
- Never deploy to production
