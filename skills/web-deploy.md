# Web App — Deploy to Staging

Deploy the web app to staging and run smoke tests. Update GitHub issue.

## Steps

### 1. Detect deployment platform

| Config | Platform | Command |
|---|---|---|
| `vercel.json` or Vercel in package.json | Vercel | `vercel deploy --prebuilt` |
| `netlify.toml` | Netlify | `netlify deploy --build` |
| `fly.toml` | Fly.io | `fly deploy` |
| `Dockerfile` + no platform config | Ask user | — |

If no config found, ask the user.

### 2. Build and deploy

Run the platform-specific deploy command. Capture the deployment URL from the output.

For Vercel preview deploys:
```bash
vercel deploy 2>&1 | tail -1  # URL is in the output
```

### 3. Wait for deployment

Poll the deployment URL until it responds (timeout 3 minutes):
```bash
until curl -sf <url> > /dev/null; do sleep 5; done
```

### 4. Smoke tests

Run Playwright smoke tests against the staging URL:
```bash
BASE_URL=<staging-url> npx playwright test --grep @smoke
```

If no `@smoke` tagged tests, do basic checks:
- `curl -f <url>` — page loads
- Check response contains expected content (title, meta tags)
- Check no 500 errors on key pages

### 5. Update GitHub issue

```
gh issue comment <number> --body "### 🚀 Web — Staging Deployment

**URL**: <staging-url>
**Status**: ✅ Live / ❌ Failed
**Smoke tests**: ✅ Passed / ❌ Failed

_Deployed at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 6. Report

Show staging URL and test results. If passed, PR is ready for review.
