# Flutter — Full Ship Pipeline

Run the complete Flutter pipeline for a GitHub issue. Every step updates the issue.

## Arguments

$ARGUMENTS should be a GitHub issue number.
If not provided, read from `.claude/issue`. If that doesn't exist, ask.

## Pipeline

Execute in order, stop on failure:

### 1. Setup
- `gh issue view <number>` — read the issue body AND all comments
- **Read the context chain** from the issue body to understand the full feature scope
- **Read the contract** — look for a "Contract Ready" comment on this issue. This contains the proto definition, the Dart client types path, and what RPCs are available. If no contract comment exists, check `gen/dart/` directory in the repo. If neither exists, STOP and tell the user to run `/contract` first.
- Check out or create the issue branch (branch from main so you have the generated code)
- Save issue number to `.claude/issue`

### 2. Understand what to build
- From the contract comment, identify:
  - Which generated Dart client types to import (from `gen/dart/`)
  - Which RPCs to call from the app
  - What the request/response shapes look like
- From the context chain, understand the UX/UI requirements

### 3. Dependencies & codegen
- `flutter pub get`
- Run build_runner if needed

### 4. Analyze (same as `/flutter-dev`)
- `flutter analyze`
- Comment on issue
- **Stop if errors** — offer to fix

### 5. Tests (same as `/flutter-dev`)
- `flutter test`
- Integration tests if available
- Comment on issue
- **Stop if failed** — offer to fix

### 6. Principal engineer review (same as `/review`)
- Read every file you wrote or changed
- Check: security, error handling, performance, correctness, design, tests, naming, scope
- Fix any issues found
- Comment on issue with review results
- **Stop if unfixable issues** — escalate

### 7. Build (same as `/flutter-build`)
- Build release for available platforms
- Comment on issue with sizes
- **Stop if failed**

### 8. Create PR (same as `/pr`)
- Push branch
- Create PR with `Closes #<number>`
- Note which RPCs/client types are consumed
- Comment on issue

### 9. Deploy (same as `/flutter-deploy`)
- Only if deploy config exists
- Deploy web build or upload mobile build
- Comment on issue

### 10. Final summary

```
gh issue comment <number> --body "### ✅ Flutter Ship Complete

**Contract**: \`<ServiceName>\`
**RPCs consumed**: <list>

| Step | Status |
|---|---|
| Analyze | ✅ |
| Unit/Widget tests | ✅ X passed |
| Integration tests | ✅ / ⏭️ Skipped |
| Build APK | ✅ X MB / ⏭️ N/A |
| Build Web | ✅ / ⏭️ N/A |
| PR | ✅ #<pr> |
| Deploy | ✅ / ⏭️ Skipped |

Ready for review."
```

Also update the parent issue:
```
gh issue comment <parent> --body "### Update: [Flutter] #<number>
Status: ✅ Complete — PR #<pr> ready for review
RPCs consumed: <list>"
```

## Scope rules — CRITICAL

You may ONLY create/modify files inside your feature directory (`lib/features/<name>/`). You may ONLY import from `lib/core/` and `gen/dart/`.

If you discover you need something that doesn't exist:
- A proto RPC or client type that's not generated → **STOP. Run `/blocked`.**
- A shared widget in core that doesn't exist → **STOP. Run `/blocked`.**
- Data or state from another feature → **STOP. Run `/blocked`.**

NEVER create workarounds or mock services. NEVER modify files outside your feature. NEVER import from another feature.

## Other rules
- The contract defines the API surface. Import generated types from `gen/dart/` — never hand-write types the proto defines.
- The context chain tells you what the user experience should be.
- Stop on any failure, offer to fix
- Never merge PR automatically
