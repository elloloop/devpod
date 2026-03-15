# Web App — Docker Compose E2E Test

Build with Docker Compose, run the app, test it live with Playwright, tear down. Update GitHub issue.

## Steps

### 1. Build

```bash
docker compose build --no-cache
```

### 2. Start

```bash
docker compose up -d
```

Wait for health check to pass. If no health check, poll `http://localhost:3000` until it responds (timeout 60s).

### 3. Run Playwright against the running container

```bash
npx playwright test --base-url http://localhost:3000
```

If Playwright is not set up, do basic smoke tests:
```bash
curl -f http://localhost:3000
curl -f -o /dev/null -w "%{http_code}" http://localhost:3000
```

### 4. Capture logs

```bash
docker compose logs --tail=30
```

### 5. Tear down

```bash
docker compose down -v
```
Always run this, even if tests fail.

### 6. Update GitHub issue

Read issue number from `.claude/issue`. If it exists:

```
gh issue comment <number> --body "### 🐳 Web — Docker E2E Results

**Docker build**: ✅ / ❌
**App healthy**: ✅ / ❌
**Playwright E2E**: ✅ X passed / ❌ X failed

<details>
<summary>Container logs</summary>

\`\`\`
<logs>
\`\`\`
</details>

_Run at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 7. Report

If passed, suggest `/pr`. If failed, show errors and offer to fix.
