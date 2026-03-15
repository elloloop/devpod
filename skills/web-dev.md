# Web App — Build and Test Locally

Build, lint, and run Playwright tests for a web app. Update GitHub issue with results.

## Steps

### 0. Check for contract

If `.claude/issue` exists, read the issue and its comments. Look for a "Contract Ready" comment — this tells you what RPCs are available and where the TypeScript client types live (`gen/ts/`). Use these generated types to call the backend — never hand-write types the proto defines.

### 1. Install dependencies

```bash
npm install
```

### 2. Lint

Run ESLint or the project's configured linter:
```bash
npm run lint
```
Don't fail on warnings, only errors. If `lint` script doesn't exist, skip.

### 3. Build

```bash
npm run build
```
If it fails, try to fix and retry once.

### 4. Run Playwright tests

```bash
npx playwright install --with-deps chromium
npx playwright test
```

Capture the output, including pass/fail counts and any error messages.

If Playwright is not set up, fall back to `npm test`.

### 5. Update GitHub issue

Read issue number from `.claude/issue`. If it exists:

```
gh issue comment <number> --body "### 🌐 Web — Local Dev Results

**Lint**: ✅ Passed / ⚠️ Warnings / ❌ Failed
**Build**: ✅ Passed / ❌ Failed
**Playwright**: ✅ X passed / ❌ X failed, Y passed

<details>
<summary>Test output</summary>

\`\`\`
<last 50 lines of test output>
\`\`\`
</details>

_Run at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 6. Report

Summarize results. If all passed, suggest `/web-docker` next. If failed, offer to fix.
