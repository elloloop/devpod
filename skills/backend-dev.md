# Backend — Build and Test Locally

Build, lint, and test a backend service. Update GitHub issue with results.

## Steps

### 0. Check for contract

If `.claude/issue` exists, read the issue and its comments. Look for a "Contract Ready" comment — this tells you what proto service and RPCs exist and where the generated code lives. Use this to understand what the backend should implement.

If `proto/` or `gen/` directories exist in the repo, the project uses proto contracts. Make sure the implementation uses generated types from `gen/` — never hand-write types the proto defines.

### 1. Detect language and tooling

| File | Language | Build | Test | Lint |
|---|---|---|---|---|
| `go.mod` | Go | `go build ./...` | `go test ./... -v` | `golangci-lint run` (if installed) |
| `Cargo.toml` | Rust | `cargo build` | `cargo test` | `cargo clippy` |
| `pyproject.toml` | Python | `uv sync` or `pip install -e .` | `pytest -v` | `ruff check .` (if installed) |

Also check for `Makefile` / `justfile` — prefer `make build`, `make test`, `make lint` if targets exist.

### 2. Install / sync dependencies

- Go: `go mod download`
- Rust: `cargo fetch`
- Python: `uv sync` or `pip install -e ".[dev]"`

### 3. Lint

Run the language linter. Don't fail on warnings.
- Go: `golangci-lint run` or `go vet ./...`
- Rust: `cargo clippy -- -W warnings`
- Python: `ruff check .` or `flake8`

### 4. Build

Run the build command. If it fails, try to fix and retry once.

### 5. Run tests

Run the test suite with verbose output. Capture pass/fail counts.

For Go, also check test coverage:
```bash
go test ./... -coverprofile=coverage.out -v
go tool cover -func=coverage.out | tail -1
```

### 6. Update GitHub issue

Read issue number from `.claude/issue`. If it exists:

```
gh issue comment <number> --body "### ⚙️ Backend — Local Dev Results

**Language**: Go / Python / Rust
**Lint**: ✅ Passed / ⚠️ Warnings / ❌ Failed
**Build**: ✅ Passed / ❌ Failed
**Tests**: ✅ X passed / ❌ X failed, Y passed
**Coverage**: X% (if available)

<details>
<summary>Test output</summary>

\`\`\`
<last 50 lines>
\`\`\`
</details>

_Run at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 7. Report

Summarize. If passed, suggest `/backend-docker`. If failed, offer to fix.
