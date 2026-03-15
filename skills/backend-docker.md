# Backend — Docker Compose Integration Test

Build with Docker Compose, start services, run integration tests, tear down. Update GitHub issue.

## Steps

### 1. Find compose file

Look for `docker-compose.yml`, `docker-compose.yaml`, or `compose.yml`. If none, tell user and suggest `/backend-init`.

### 2. Build

```bash
docker compose build --no-cache
```

### 3. Start

```bash
docker compose up -d
```

Wait for services to be healthy (poll health endpoint, timeout 60s).

### 4. Integration tests

Detect service type and run appropriate tests:

**REST API:**
```bash
# Health check
curl -f http://localhost:8080/health

# Run API tests if they exist
# Go: go test ./... -tags=integration -v
# Python: pytest tests/ -m integration -v
# Rust: cargo test --test integration
```

If no integration-tagged tests, do smoke tests:
- `GET /health` → 200
- `GET /` → 200
- Check response bodies are valid JSON

**gRPC:**
```bash
# If grpcurl is available
grpcurl -plaintext localhost:50051 grpc.health.v1.Health/Check
grpcurl -plaintext localhost:50051 list
```

**Worker:**
```bash
# Check process is running
docker compose ps
# Check logs for startup success
docker compose logs --tail=20 | grep -i "started\|ready\|listening"
# Hit health endpoint
curl -f http://localhost:8080/health
```

### 5. Capture logs

```bash
docker compose logs --tail=30
```

### 6. Tear down

```bash
docker compose down -v
```
Always run, even on failure.

### 7. Update GitHub issue

```
gh issue comment <number> --body "### 🐳 Backend — Docker Integration Results

**Docker build**: ✅ / ❌
**Services healthy**: ✅ / ❌
**Integration tests**: ✅ Passed / ❌ Failed

<details>
<summary>Container logs</summary>

\`\`\`
<logs>
\`\`\`
</details>

_Run at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 8. Report

If passed, suggest `/pr`. If failed, show errors.
