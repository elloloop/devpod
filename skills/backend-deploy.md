# Backend — Deploy to Staging

Deploy backend service to staging and run smoke tests. Update GitHub issue.

## Steps

### 1. Detect deployment method

| Config | Platform | Command |
|---|---|---|
| `fly.toml` | Fly.io | `fly deploy` |
| `railway.toml` | Railway | `railway up` |
| `render.yaml` | Render | auto-deploys from branch push |
| `app.yaml` | GCP App Engine | `gcloud app deploy --no-promote` |
| k8s manifests in `k8s/` or `deploy/` | Kubernetes | `kubectl apply -n staging` |
| `docker-compose.staging.yml` | Docker on remote | `docker compose -f ... up -d` on remote host via SSH |
| GitHub Actions deploy workflow | GH Actions | `gh workflow run deploy.yml -f environment=staging` |

If nothing found, ask the user.

### 2. Deploy

Run the appropriate deploy command. Capture endpoint URL.

### 3. Wait for deployment

Poll the health endpoint until it responds (timeout 5 minutes):
```bash
until curl -sf <url>/health > /dev/null; do sleep 5; done
```

### 4. Smoke tests

**REST API:**
```bash
curl -f <url>/health
curl -sf <url>/ | jq .
```

**gRPC:**
```bash
grpcurl <host>:443 grpc.health.v1.Health/Check
```

**Worker:**
- Check deployment logs for successful startup
- Hit health endpoint

### 5. Update GitHub issue

```
gh issue comment <number> --body "### 🚀 Backend — Staging Deployment

**URL**: <staging-url>
**Health**: ✅ / ❌
**Smoke tests**: ✅ Passed / ❌ Failed

_Deployed at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 6. Report

Show staging URL. If passed, PR is ready for review.

## Important
- Never deploy to production
- If credentials needed, ask user
- Don't log secrets
