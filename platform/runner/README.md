# @devpod/runner

A local GitHub Actions-compatible workflow engine with a REST API. Parses your `.github/workflows/` YAML files and executes them on your machine --- no GitHub dependency required.

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start](#2-quick-start)
3. [Adopting in an Existing Project](#3-adopting-in-an-existing-project)
4. [REST API Reference](#4-rest-api-reference)
5. [Workflow Compatibility](#5-workflow-compatibility)
6. [Marketplace Actions](#6-marketplace-actions)
7. [Sandboxed Execution](#7-sandboxed-execution)
8. [Secrets Management](#8-secrets-management)
9. [Configuration](#9-configuration)
10. [Platform-Specific Guides](#10-platform-specific-guides)
11. [Architecture](#11-architecture)
12. [Integrating with the Web Dashboard](#12-integrating-with-the-web-dashboard)
13. [Extending the Runner](#13-extending-the-runner)
14. [Troubleshooting](#14-troubleshooting)
15. [API TypeScript Types](#15-api-typescript-types)

---

## 1. Overview

### What This Is

A standalone Node.js server that reads `.github/workflows/*.yml` files, evaluates GitHub Actions expressions, resolves marketplace actions, and executes workflows locally. It exposes a REST API and an SSE stream so a web dashboard (or any HTTP client) can trigger, monitor, and inspect workflow runs in real time.

### Key Differentiators

| Feature | GitHub Actions | act | @devpod/runner |
|---|---|---|---|
| REST API for triggering/monitoring | No | No | Yes |
| SSE real-time streaming | No | No | Yes |
| Sandboxed execution (worktree/CoW) | N/A (cloud) | No | Yes |
| Secrets management with encryption | Org-level | `.env` file | API + AES-256-GCM |
| Matrix strategy with fail-fast | Yes | Partial | Yes |
| Reusable workflows (local + remote) | Yes | No | Yes |
| Composite/Node/Docker actions | Yes | Docker only | Yes |
| Built-in shims for common actions | N/A | N/A | Yes |
| No Docker requirement for shell steps | No | No | Yes |

### When to Use This

- **Instead of GitHub Actions**: when you want fast iteration on CI workflows without pushing commits, or when you need local-only execution (airgapped, private, cost savings).
- **Instead of act**: when you need a REST API, SSE streaming, sandboxed execution, reusable workflow support, or Node.js action support without Docker.

---

## 2. Quick Start

### Prerequisites

- Node.js >= 18
- Git (for sandbox worktrees and action downloading)
- Docker (optional, only for Docker-based actions and services)

### Installation

```bash
cd platform/runner
npm install
```

### Start the Runner

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm run build && npm start
```

The runner starts on port 4800 by default and serves from the current working directory.

```
Local GitHub Actions runner started
  API:       http://localhost:4800/api
  Events:    http://localhost:4800/api/events
  Health:    http://localhost:4800/health
  Workspace: /path/to/your/project
```

### Point at a Different Project

```bash
RUNNER_WORKSPACE=/path/to/your/project npm run dev
```

### Trigger Your First Workflow

```bash
# List available workflows
curl http://localhost:4800/api/workflows

# Trigger a workflow by filename (without extension)
curl -X POST http://localhost:4800/api/runs \
  -H 'Content-Type: application/json' \
  -d '{"workflow": "ci"}'

# With inputs
curl -X POST http://localhost:4800/api/runs \
  -H 'Content-Type: application/json' \
  -d '{"workflow": "deploy", "inputs": {"environment": "staging"}}'
```

### View Results

```bash
# List all runs
curl http://localhost:4800/api/runs

# Get specific run
curl http://localhost:4800/api/runs/<run-id>

# Get full logs
curl http://localhost:4800/api/runs/<run-id>/logs
```

---

## 3. Adopting in an Existing Project

### Step 1: Point the Runner at Your Repo

```bash
RUNNER_WORKSPACE=/path/to/your/project npm run dev
```

The runner discovers all `.yml` and `.yaml` files under `.github/workflows/`.

### Step 2: Set Up Secrets

```bash
# Set individual secrets
curl -X PUT http://localhost:4800/api/secrets/NPM_TOKEN \
  -H 'Content-Type: application/json' \
  -d '{"value": "npm_abc123"}'

# Or import from a .env file
curl -X POST http://localhost:4800/api/secrets/import \
  -H 'Content-Type: application/json' \
  -d '{"content": "NPM_TOKEN=npm_abc123\nAWS_ACCESS_KEY_ID=AKIA..."}'
```

### Step 3: Run Your First Workflow

```bash
curl -X POST http://localhost:4800/api/runs \
  -H 'Content-Type: application/json' \
  -d '{"workflow": "ci"}'
```

### What Works Out of the Box

- `run:` steps (bash, sh, python, pwsh)
- `uses: actions/checkout@v4` (shimmed to a no-op; your workspace is already available)
- `uses: actions/upload-artifact@v4` / `download-artifact` (copies to `.artifacts/` directory)
- `uses: actions/cache@v4` (filesystem-based cache at `~/.local/share/local-runner/cache/`)
- Setup actions: `setup-python`, `setup-java`, `setup-ruby`, `setup-go`, `setup-dotnet`, `setup-gradle`, `setup-xcode`, `flutter-action` (shimmed to use system-installed tools)
- Matrix strategies with `include`, `exclude`, `fail-fast`, `max-parallel`
- Job dependencies via `needs:`
- Conditional execution via `if:`
- Reusable workflows (local and remote)
- Composite, Node.js, and Docker actions from the marketplace
- Workflow-level, job-level, and step-level `env:`
- `GITHUB_OUTPUT`, `GITHUB_ENV`, `GITHUB_PATH` file protocols
- `::set-output`, `::error`, `::warning`, `::group`, `::add-mask` workflow commands

### What Might Need Adjustment

| Issue | Solution |
|---|---|
| `runs-on: ubuntu-latest` | Ignored. Steps run on your local OS. Make sure tools are installed. |
| Actions that call GitHub's artifact/cache service directly | Use the shimmed `actions/upload-artifact` and `actions/cache` instead. |
| `GITHUB_TOKEN` for API calls | Set `GITHUB_TOKEN` in your environment or via the secrets API. |
| Marketplace actions from private repos | Set `GITHUB_TOKEN` or `GH_TOKEN` env var. |
| `services:` block | Requires Docker installed locally. Uses `docker compose` under the hood. |
| `concurrency` groups | Not supported. Runs execute independently. |
| `permissions` / OIDC | Not supported. Not applicable to local execution. |

---

## 4. REST API Reference

### `POST /api/runs` --- Trigger a Workflow Run

Starts a new asynchronous workflow execution and returns immediately.

**Request Body:**

```typescript
{
  workflow: string;              // Required. Filename (without extension), filename with extension, or workflow name.
  inputs?: Record<string, string>;  // Optional. workflow_dispatch inputs.
  sandbox?: {
    strategy?: 'worktree' | 'copy' | 'none';  // Optional. Default: auto-detect.
    ref?: string;                               // Optional. Git ref for worktree. Default: HEAD.
  };
}
```

**Response:** `201 Created`

```typescript
WorkflowRun  // See type definition in Section 15
```

**Example:**

```bash
curl -X POST http://localhost:4800/api/runs \
  -H 'Content-Type: application/json' \
  -d '{"workflow": "ci", "inputs": {"skip-tests": "false"}}'
```

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "workflow": "ci",
  "status": "queued",
  "jobs": [],
  "createdAt": "2026-03-22T10:00:00.000Z",
  "updatedAt": "2026-03-22T10:00:00.000Z",
  "trigger": {
    "event": "workflow_dispatch",
    "ref": "refs/heads/main",
    "sha": "abc123def456"
  },
  "inputs": {"skip-tests": "false"}
}
```

---

### `GET /api/runs` --- List Runs

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | `queued \| in_progress \| completed \| failed \| cancelled` | Filter by status |

**Response:** `200 OK` --- `WorkflowRun[]` sorted by creation time (newest first).

**Example:**

```bash
curl http://localhost:4800/api/runs
curl http://localhost:4800/api/runs?status=completed
```

---

### `GET /api/runs/:id` --- Get Run Detail

**Response:** `200 OK` --- `WorkflowRun` with full job and step details.

**Error:** `404` if run not found.

```bash
curl http://localhost:4800/api/runs/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

### `GET /api/runs/:id/logs` --- Get Full Logs

Returns the concatenated logs for all jobs and steps in the run.

**Response:** `200 OK` --- `text/plain`

```
=== Job: build (build) ===
--- Step 1: Checkout [success] ---
Workspace already available, no checkout needed
--- Step 2: Install dependencies [success] ---
npm ci
...
```

```bash
curl http://localhost:4800/api/runs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/logs
```

---

### `GET /api/runs/:id/artifacts` --- List Artifacts

**Response:** `200 OK` --- `Artifact[]`

```bash
curl http://localhost:4800/api/runs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/artifacts
```

```json
[
  {
    "id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
    "name": "coverage-report",
    "path": "/path/to/.artifacts/a1b2c3d4/coverage-report.html",
    "size": 42567,
    "mimeType": "text/html",
    "runId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
]
```

---

### `GET /api/runs/:id/artifacts/:name` --- Download Artifact

Streams the artifact file as a download.

**Response:** `200 OK` --- Binary file with `Content-Disposition: attachment` header.

**Error:** `404` if run or artifact not found.

```bash
curl -o report.html http://localhost:4800/api/runs/a1b2c3d4/artifacts/coverage-report
```

---

### `POST /api/runs/:id/cancel` --- Cancel a Running Workflow

Sends an abort signal to the running workflow. Only works on `queued` or `in_progress` runs.

**Response:** `200 OK`

```json
{"message": "Run cancelled"}
```

**Errors:** `404` if run not found. `409` if run is not in a cancellable state.

```bash
curl -X POST http://localhost:4800/api/runs/a1b2c3d4/cancel
```

---

### `GET /api/workflows` --- List Available Workflows

Returns metadata for all `.yml`/`.yaml` files in `.github/workflows/`.

**Response:** `200 OK` --- `WorkflowInfo[]`

```bash
curl http://localhost:4800/api/workflows
```

```json
[
  {
    "name": "CI",
    "fileName": "ci.yml",
    "filePath": "/path/to/.github/workflows/ci.yml",
    "triggers": ["push", "pull_request", "workflow_dispatch"],
    "jobs": [
      {"id": "test", "name": "Run Tests", "needs": []},
      {"id": "deploy", "name": "Deploy", "needs": ["test"]}
    ],
    "inputs": {
      "environment": {
        "description": "Target environment",
        "required": false,
        "default": "staging",
        "type": "choice",
        "options": ["staging", "production"]
      }
    }
  }
]
```

---

### `GET /api/workflows/:name` --- Get Workflow Detail

Returns parsed workflow info and the raw definition.

**Response:** `200 OK`

```typescript
{
  info: WorkflowInfo;
  definition: WorkflowFile;
}
```

```bash
curl http://localhost:4800/api/workflows/ci
```

---

### `GET /api/secrets` --- List Secret Names

Returns secret names only; values are never exposed.

**Response:** `200 OK` --- `string[]`

```bash
curl http://localhost:4800/api/secrets
```

```json
["GITHUB_TOKEN", "NPM_TOKEN", "AWS_ACCESS_KEY_ID"]
```

---

### `PUT /api/secrets/:name` --- Set a Secret

**Request Body:**

```typescript
{ value: string }
```

**Response:** `200 OK`

```json
{"message": "Secret 'NPM_TOKEN' saved"}
```

```bash
curl -X PUT http://localhost:4800/api/secrets/NPM_TOKEN \
  -H 'Content-Type: application/json' \
  -d '{"value": "npm_abc123"}'
```

---

### `DELETE /api/secrets/:name` --- Delete a Secret

**Response:** `200 OK`

```json
{"message": "Secret 'NPM_TOKEN' deleted"}
```

```bash
curl -X DELETE http://localhost:4800/api/secrets/NPM_TOKEN
```

---

### `POST /api/secrets/import` --- Import Secrets from `.env` Format

**Request Body:**

```typescript
{ content: string }  // .env-formatted string: KEY=VALUE lines, # comments, blank lines
```

**Response:** `200 OK`

```json
{"message": "Imported 3 secrets", "count": 3}
```

```bash
curl -X POST http://localhost:4800/api/secrets/import \
  -H 'Content-Type: application/json' \
  -d '{"content": "NPM_TOKEN=abc\n# comment\nAWS_KEY=xyz"}'
```

---

### `GET /api/events` --- SSE Real-Time Updates

Server-Sent Events stream for monitoring workflow execution in real time.

**Headers:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Types:**

| Event | Payload | Description |
|---|---|---|
| `ping` | `{}` | Initial connection and keepalive (every 30s) |
| `run.started` | `{runId, run}` | Workflow execution started |
| `run.completed` | `{runId, run}` | Workflow execution finished |
| `job.started` | `{runId, jobId, job}` | Job execution started |
| `job.completed` | `{runId, jobId, job}` | Job execution finished |
| `step.started` | `{runId, jobId, stepNumber, step}` | Step execution started |
| `step.completed` | `{runId, jobId, stepNumber, step}` | Step execution finished |
| `step.log` | `{runId, jobId, stepNumber, line}` | Live log line from a step |

**Example:**

```bash
curl -N http://localhost:4800/api/events
```

```
event: ping
data: {}

event: run.started
data: {"runId":"a1b2c3d4","run":{...}}

event: step.log
data: {"runId":"a1b2c3d4","jobId":"build","stepNumber":2,"line":"npm ci\n"}

event: job.completed
data: {"runId":"a1b2c3d4","jobId":"build","job":{"conclusion":"success",...}}
```

---

### `GET /health` --- Health Check

**Response:** `200 OK`

```json
{"status": "ok", "workspace": "/path/to/your/project"}
```

```bash
curl http://localhost:4800/health
```

---

## 5. Workflow Compatibility

### Triggers

| Trigger | Support | Notes |
|---|---|---|
| `workflow_dispatch` | Full | Inputs passed via API |
| `push` | Parsed | Triggered as `workflow_dispatch`; trigger metadata reflects current git state |
| `pull_request` | Parsed | Same as above |
| `workflow_call` | Full | Local and remote reusable workflows |
| `workflow_run` | Not supported | |
| `schedule` | Not supported | |
| `repository_dispatch` | Not supported | |

### Jobs

| Feature | Support | Notes |
|---|---|---|
| `needs:` | Full | Topological sort with cycle detection |
| `if:` | Full | Evaluated against expression context |
| `env:` | Full | Merged: workflow > job > step |
| `defaults.run.shell` | Full | `bash`, `sh`, `pwsh`, `python` |
| `defaults.run.working-directory` | Full | Relative to workspace |
| `strategy.matrix` | Full | Cartesian product, include, exclude |
| `strategy.fail-fast` | Full | Defaults to true (matches GitHub) |
| `strategy.max-parallel` | Full | Limits concurrent matrix instances |
| `outputs:` | Full | Expression-evaluated from step outputs |
| `services:` | Full | Via `docker compose` |
| `timeout-minutes` | Full | Default: 360 minutes (6 hours) |
| `uses:` (reusable workflow) | Full | Local (`./`) and remote (`org/repo@ref`) |
| `with:` (reusable workflow inputs) | Full | |
| `secrets: inherit` | Full | Passes all current secrets |

### Steps

| Feature | Support | Notes |
|---|---|---|
| `run:` | Full | Shell command execution |
| `uses:` | Full | Local, marketplace, and `docker://` actions |
| `with:` | Full | Inputs resolved with expression evaluation |
| `env:` | Full | Merged with workflow and job env |
| `if:` | Full | Supports all expression functions |
| `working-directory` | Full | Relative to workspace |
| `shell` | Full | `bash`, `sh`, `pwsh`, `python` |
| `continue-on-error` | Full | Step failure doesn't fail the job |
| `id` | Full | Referenced via `steps.<id>.outputs` |
| `timeout-minutes` | Full | Default: 60 minutes |

### Expressions

The `${{ }}` expression engine supports:

**Contexts:**

| Context | Available | Notes |
|---|---|---|
| `github.*` | Yes | `event_name`, `ref`, `sha`, `repository`, `workspace`, `actor`, `run_id`, `token` |
| `env.*` | Yes | Merged workflow + job + step env |
| `inputs.*` | Yes | From `workflow_dispatch` or `workflow_call` |
| `steps.<id>.outputs.*` | Yes | |
| `steps.<id>.outcome` | Yes | |
| `steps.<id>.conclusion` | Yes | |
| `needs.<job>.outputs.*` | Yes | |
| `needs.<job>.result` | Yes | |
| `jobs.<job>.outputs.*` | Yes | |
| `matrix.*` | Yes | |
| `secrets.*` | Yes | |
| `runner.os` | Yes | `macOS`, `Linux`, or `Windows` |
| `runner.arch` | Yes | |
| `runner.name` | Yes | Always `local-runner` |
| `runner.temp` | Yes | System temp directory |

**Operators:** `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `!`

**Functions:**

| Function | Support | Notes |
|---|---|---|
| `contains(search, item)` | Full | Case-insensitive |
| `startsWith(string, prefix)` | Full | Case-insensitive |
| `endsWith(string, suffix)` | Full | Case-insensitive |
| `format(string, ...)` | Full | `{0}`, `{1}` placeholders |
| `toJSON(value)` | Full | |
| `fromJSON(string)` | Full | |
| `join(array, separator)` | Full | |
| `success()` | Yes | Always true (default assumption) |
| `failure()` | Yes | Always false |
| `cancelled()` | Yes | Always false |
| `always()` | Yes | Always true |
| `hashFiles(pattern)` | Stub | Returns `'local-hash-placeholder'` |

### Matrix Strategies

Full support for:

```yaml
strategy:
  matrix:
    node: [18, 20, 22]
    os: [ubuntu-latest, macos-latest]
    include:
      - node: 18
        experimental: true
    exclude:
      - node: 22
        os: ubuntu-latest
  fail-fast: true     # Default: true. Cancel remaining on first failure.
  max-parallel: 2     # Limit concurrent matrix jobs.
```

The cartesian product is computed, excludes are removed, and includes are either merged into matching combinations or added as new ones.

### Reusable Workflows

```yaml
jobs:
  tests:
    uses: ./.github/workflows/shared-tests.yml
    with:
      environment: staging
    secrets: inherit

  external:
    uses: org/repo/.github/workflows/shared.yml@main
    with:
      param: value
    secrets:
      API_KEY: ${{ secrets.API_KEY }}
```

Local workflows (`./`) are resolved relative to the workspace. Remote workflows (`org/repo@ref`) are git-cloned and cached at `~/.local/share/local-runner/workflow-cache/`.

### Not Supported

- `concurrency` groups
- `permissions` / OIDC token
- `environment` deployments with protection rules
- `workflow_run` trigger
- `schedule` (cron) trigger

---

## 6. Marketplace Actions

### Resolution Flow

When a step has `uses: owner/repo@ref`, the runner:

1. Checks if a built-in shim exists for `owner/repo`. If so, generates a local composite action.
2. Checks the local cache at `~/.local/share/local-runner/actions-cache/owner/repo/ref/`.
3. If the cache is fresh (< TTL), uses it directly.
4. Otherwise, runs `git clone --depth 1 --branch ref` from GitHub.
5. Falls back to `git clone --no-checkout --filter=blob:none` + `git checkout ref` for SHA-based refs.
6. Removes `.git/` from the clone, writes a freshness marker, and returns the path.

Subpath actions (`owner/repo/subpath@ref`) are supported --- the runner clones the repo and returns the subpath within it.

### Cache Location and TTL

| Setting | Default | Env Var |
|---|---|---|
| Actions cache directory | `~/.local/share/local-runner/actions-cache/` | `RUNNER_ACTIONS_CACHE` |
| Cache TTL | 24 hours | `RUNNER_CACHE_TTL_MS` (milliseconds) |
| Skip cache entirely | Off | `RUNNER_NO_CACHE=1` |

### Built-in Shims

These actions are intercepted and replaced with local equivalents that work without GitHub's cloud services:

| Action | Shim Behavior |
|---|---|
| `actions/checkout` | No-op. Workspace is already available. Supports `ref` input for branch switching. |
| `actions/upload-artifact` | Copies files to `$WORKSPACE/.artifacts/<name>/` |
| `actions/download-artifact` | Copies files from `$WORKSPACE/.artifacts/<name>/` |
| `actions/cache` | Filesystem cache at `~/.local/share/local-runner/cache/`. Supports `key`, `restore-keys`, and prefix matching. |
| `actions/setup-python` | Detects system Python via pyenv or PATH. Outputs `python-version`, `python-path`. |
| `actions/setup-java` | Detects Java via `/usr/libexec/java_home`, SDKMAN, Homebrew, system paths, or `JAVA_HOME`. Sets `JAVA_HOME` and `PATH`. |
| `actions/setup-ruby` / `ruby/setup-ruby` | Detects Ruby via rbenv, rvm, or system. Optionally runs `bundle install`. |
| `actions/setup-go` | Detects Go via goenv, PATH, or Homebrew. Sets `GOPATH`. |
| `actions/setup-dotnet` | Detects .NET SDK on PATH or common locations. Disables telemetry. |
| `actions/setup-gradle` / `gradle/actions/setup-gradle` | Detects Gradle wrapper, PATH, Homebrew, or SDKMAN. Soft-fail (warns, doesn't error). |
| `actions/setup-xcode` / `maxim-lobanov/setup-xcode` | Uses `xcode-select`. Supports version selection from `/Applications/Xcode_*.app`. |
| `subosito/flutter-action` | Detects Flutter via PATH, common locations, or fvm. |

### Private Repos

Set `GITHUB_TOKEN` or `GH_TOKEN` in your environment. The runner injects it into clone URLs as `x-access-token`.

### Force Re-download

```bash
RUNNER_NO_CACHE=1 npm run dev
```

---

## 7. Sandboxed Execution

### What It Does

Each workflow run can execute in an isolated copy of your workspace. This prevents concurrent runs from interfering with each other and protects your working directory from modifications by CI steps.

### Strategies

| Strategy | Speed | Disk Usage | Mechanism |
|---|---|---|---|
| `worktree` | Instant | Minimal (shared `.git` objects) | `git worktree add --detach` |
| `copy-on-write` | Near-instant (macOS APFS only) | Minimal until modified | `cp -c -R` |
| `copy` | Proportional to repo size | Full copy | `rsync -a` with exclusions, fallback to `cp -R` |
| `none` | N/A | N/A | Runs directly in workspace |

### Auto-Detection Logic (`strategy: 'auto'`)

1. If workspace is a git repo, try **worktree**.
2. On macOS, try **copy-on-write** via APFS `cp -c`.
3. Fall back to **regular copy** via rsync (excludes `.git`, `node_modules`, `.next`, `build`, `dist`, `.gradle`, `Pods`, `.dart_tool`, `.pub-cache`).

### Controlling the Strategy

Via the API:

```bash
# Use worktree
curl -X POST http://localhost:4800/api/runs \
  -H 'Content-Type: application/json' \
  -d '{"workflow": "ci", "sandbox": {"strategy": "worktree"}}'

# Disable sandboxing (run in-place)
curl -X POST http://localhost:4800/api/runs \
  -H 'Content-Type: application/json' \
  -d '{"workflow": "ci", "sandbox": {"strategy": "none"}}'

# Worktree from a specific ref
curl -X POST http://localhost:4800/api/runs \
  -H 'Content-Type: application/json' \
  -d '{"workflow": "ci", "sandbox": {"strategy": "worktree", "ref": "feature-branch"}}'
```

### Sandbox Location

Default: `/tmp/runner-sandboxes/<run-id>/`

Override: `RUNNER_SANDBOX_DIR=/path/to/sandboxes`

### Cleanup

- Sandboxes are cleaned up automatically after each run completes (even on failure).
- On startup, stale sandboxes older than 1 hour are removed.
- Orphaned git worktrees are pruned automatically.

---

## 8. Secrets Management

### Storage Location

`~/.local/share/local-runner/secrets/<hash>.json`

Each workspace gets its own secrets file. The hash is a truncated SHA-256 of the workspace path.

### Per-Workspace Isolation

Secrets are scoped to the workspace path. Running the runner on `/project-a` and `/project-b` uses different secrets files.

### Setting Secrets via API

```bash
curl -X PUT http://localhost:4800/api/secrets/MY_SECRET \
  -H 'Content-Type: application/json' \
  -d '{"value": "super-secret-value"}'
```

### Importing from .env Files

```bash
# From a string
curl -X POST http://localhost:4800/api/secrets/import \
  -H 'Content-Type: application/json' \
  -d '{"content": "DB_PASSWORD=hunter2\nAPI_KEY=abc123"}'

# From a file (via shell)
curl -X POST http://localhost:4800/api/secrets/import \
  -H 'Content-Type: application/json' \
  -d "{\"content\": $(jq -Rs . < .env)}"
```

The parser supports `KEY=VALUE` lines, `# comments`, blank lines, and quoted values (`"value"` or `'value'`).

### Encryption

Set `RUNNER_SECRETS_KEY` to enable AES-256-GCM encryption at rest:

```bash
RUNNER_SECRETS_KEY=my-master-password npm run dev
```

- Key derivation: PBKDF2 with SHA-512, 100,000 iterations
- Cipher: AES-256-GCM with random 12-byte IV
- Files are written with mode `0o600`
- Without `RUNNER_SECRETS_KEY`, secrets are stored as plaintext JSON

### Log Masking

All secret values are automatically masked in step logs. Any occurrence of a secret value in stdout/stderr is replaced with `***`. This applies to both shell steps and action outputs.

### GITHUB_TOKEN Auto-Inclusion

If `GITHUB_TOKEN` is set in the environment but not in the secrets store, it's automatically included. This makes it available via `${{ secrets.GITHUB_TOKEN }}` without manual configuration.

---

## 9. Configuration

All configuration is via environment variables. There are no config files.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4800` | HTTP server port |
| `RUNNER_WORKSPACE` | `process.cwd()` | Path to the project containing `.github/workflows/` |
| `RUNNER_SECRETS_KEY` | _(none)_ | Master password for encrypting secrets at rest. If unset, secrets are stored as plaintext JSON. |
| `RUNNER_NO_CACHE` | `0` | Set to `1` to skip the action cache and re-download every time |
| `RUNNER_CACHE_TTL_MS` | `86400000` (24h) | Maximum age of cached actions in milliseconds |
| `RUNNER_ACTIONS_CACHE` | `~/.local/share/local-runner/actions-cache/` | Directory for cached marketplace actions |
| `RUNNER_SANDBOX_DIR` | `/tmp/runner-sandboxes` | Base directory for sandbox workspaces |
| `RUNNER_WORKFLOW_CACHE` | `~/.local/share/local-runner/workflow-cache/` | Directory for cached remote reusable workflows |
| `GITHUB_TOKEN` / `GH_TOKEN` | _(none)_ | Token for downloading private actions/workflows and populating `secrets.GITHUB_TOKEN` |

---

## 10. Platform-Specific Guides

### Web Development (Node.js / Next.js)

```yaml
name: CI
on: [push, workflow_dispatch]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next/
```

**Notes:**
- `actions/setup-node` is not shimmed --- it downloads from GitHub and runs natively (it's a Node.js action). If you prefer to skip it, ensure `node` is on your PATH.
- `npm ci` / `yarn install` work identically to CI.
- The `cache: 'npm'` input on `setup-node` relies on `@actions/cache` internally. If caching fails, the action continues.

### Backend (Python / FastAPI)

```yaml
name: Test
on: [push, workflow_dispatch]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: pytest --junitxml=report.xml
      - uses: actions/upload-artifact@v4
        with:
          name: test-report
          path: report.xml
```

**Notes:**
- The `setup-python` shim detects Python via pyenv first, then falls back to `python3` on PATH.
- If you need a specific version, install it via pyenv or your package manager before running the workflow.

### iOS Development

```yaml
name: iOS CI
on: [push, workflow_dispatch]

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '15.4'
      - uses: actions/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true
      - run: bundle exec fastlane test
      - run: |
          xcodebuild test \
            -scheme MyApp \
            -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.5' \
            -resultBundlePath TestResults.xcresult
      - uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: TestResults.xcresult
```

**Notes:**
- The `setup-xcode` shim uses `xcode-select -s` to switch versions. It searches `/Applications/Xcode_<version>*.app`.
- The `setup-ruby` shim runs `bundle install` automatically when `bundler-cache: true` is set and a `Gemfile` exists.
- Simulator testing works natively on macOS.

### Android Development

```yaml
name: Android CI
on: [push, workflow_dispatch]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - uses: gradle/actions/setup-gradle@v3
      - run: ./gradlew assembleDebug
      - run: ./gradlew test
      - uses: actions/upload-artifact@v4
        with:
          name: apk
          path: app/build/outputs/apk/debug/*.apk
```

**Notes:**
- The `setup-java` shim checks `/usr/libexec/java_home` (macOS), SDKMAN, Homebrew, `/Library/Java/JavaVirtualMachines/`, `JAVA_HOME`, and `java` on PATH.
- The `setup-gradle` shim prefers the local `./gradlew` wrapper (recommended for reproducibility). It's a soft-fail shim --- missing Gradle only warns.
- `gradle/actions/setup-gradle` is aliased to `actions/setup-gradle`.
- For emulator testing, install Android SDK and emulator tools separately.

### Flutter Development

```yaml
name: Flutter CI
on: [push, workflow_dispatch]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          channel: stable
      - run: flutter pub get
      - run: flutter test
      - run: flutter build apk --debug
```

**Notes:**
- The `flutter-action` shim detects Flutter via PATH, common install locations (`~/flutter/`, `/opt/homebrew/`), or fvm (Flutter Version Management).
- Channel switching is skipped in the local shim. Use fvm for version management.
- Dart analytics are disabled automatically.

---

## 11. Architecture

### Module Diagram

```
src/
  index.ts              Entry point: starts Express server, initializes stores
  server.ts             REST API routes and SSE endpoint
  types.ts              All TypeScript type definitions

  engine/
    executor.ts         WorkflowExecutor: orchestrates full run lifecycle
    scheduler.ts        JobScheduler: dependency resolution, parallelism, fail-fast
    parser.ts           YAML parsing and workflow discovery
    expression.ts       ${{ }} expression evaluator with all functions
    context.ts          Builds ExpressionContext and GITHUB_* env vars
    job-runner.ts       Single job execution (steps, services, timeout)
    step-runner.ts      Single step execution (shell, uses, composite)
    matrix.ts           Matrix strategy expansion (cartesian, include/exclude)
    sandbox.ts          Isolated workspace creation (worktree, CoW, copy)
    reusable.ts         Reusable workflow resolution (local + remote)

  actions/
    resolver.ts         Marketplace action download, caching, and shim dispatch
    loader.ts           action.yml parsing
    composite.ts        Composite action input resolution and output mapping
    node-runner.ts      Node.js action execution (pre, main, post scripts)
    docker-runner.ts    Docker action execution (build, pull, run)
    commands.ts         Workflow command parser (::set-output, ::error, etc.)
    shim-framework.ts   Declarative shim definition compiler (ShimDefinition -> YAML)
    shim-definitions.ts All language/tool setup shim definitions

  artifacts/
    store.ts            In-memory artifact metadata + filesystem storage

  secrets/
    store.ts            Per-workspace secrets with optional AES-256-GCM encryption
```

### Execution Flow

```
POST /api/runs {workflow: "ci"}
  |
  v
WorkflowExecutor.triggerRun()
  |-- findWorkflow()         # Discover and parse .github/workflows/ci.yml
  |-- Get git ref/sha        # For trigger context
  |-- Create WorkflowRun     # queued
  |-- Return immediately     # 201 Created
  |
  v (async)
WorkflowExecutor.executeRun()
  |-- createSandbox()        # Isolated workspace (worktree/copy/none)
  |-- topologicalSort()      # Resolve job dependency order
  |-- prepareSchedulableJobs()  # Expand matrix strategies
  |
  v
JobScheduler.run()           # Scheduling loop
  |-- For each ready job:
  |     |-- Check needs: dependencies met?
  |     |-- Check fail-fast: matrix sibling failed?
  |     |-- Check max-parallel: concurrency limit?
  |     |-- Launch via onLaunchJob()
  |
  v
runJob()                     # Single job
  |-- evaluateCondition()    # Job-level if:
  |-- startServices()        # docker compose up (if services defined)
  |-- For each step:
  |     |-- buildExpressionContext()
  |     |-- evaluateCondition()  # Step-level if:
  |     |-- runStep()
  |     |     |-- Shell step:  spawn bash/sh/pwsh/python
  |     |     |-- Uses step:   resolveActionPath() -> loadAction()
  |     |     |     |-- Composite: recursively run sub-steps
  |     |     |     |-- Node.js:  spawn node with @actions/core env
  |     |     |     |-- Docker:   docker build/pull + docker run
  |     |     |-- Parse GITHUB_OUTPUT, GITHUB_ENV, GITHUB_PATH
  |     |     |-- Parse workflow commands (::set-output, ::error, etc.)
  |     |-- Accumulate outputs, env updates, path additions
  |-- Resolve job outputs
  |-- Cleanup services
  |
  v
sandbox.cleanup()            # Remove sandbox directory / worktree
emit('run.completed')        # SSE event
```

### How Expressions Are Evaluated

1. The template string is scanned for `${{ ... }}` patterns.
2. Each expression is parsed recursively: logical operators (`&&`, `||`, `!`) > comparison operators (`==`, `!=`, `<`, `>`) > function calls > dotted property access > literals.
3. Dotted access (`github.sha`, `steps.build.outputs.result`) walks the `ExpressionContext` object.
4. `if:` conditions that aren't wrapped in `${{ }}` are auto-wrapped.

### How Actions Are Resolved

1. Local actions (`./path`) resolve relative to workspace.
2. `docker://image` references are passed to the Docker runner.
3. Marketplace references (`owner/repo@ref`) hit the shim table first, then the cache, then git clone.
4. The action's `action.yml` is parsed to determine the action type (`composite`, `node12`/`node16`/`node20`, `docker`).

### How Secrets Are Injected

Secrets flow through the `ExpressionContext`:
- `${{ secrets.NAME }}` resolves via `ctx.secrets[NAME]`.
- All secret values are collected into `secretValues[]` and used by `maskSecrets()` to replace occurrences in log output with `***`.
- `GITHUB_TOKEN` is auto-included from the environment if not explicitly set.

---

## 12. Integrating with the Web Dashboard

The runner is designed to power a Next.js web dashboard. Here's how they connect.

### Connection Model

The dashboard makes HTTP requests to the runner's REST API and maintains a persistent SSE connection for real-time updates.

### SSE Integration

```typescript
const events = new EventSource('http://localhost:4800/api/events');

events.addEventListener('run.started', (e) => {
  const { runId, run } = JSON.parse(e.data);
  // Update UI: new run started
});

events.addEventListener('step.log', (e) => {
  const { runId, jobId, stepNumber, line } = JSON.parse(e.data);
  // Append log line to terminal view
});

events.addEventListener('job.completed', (e) => {
  const { runId, jobId, job } = JSON.parse(e.data);
  // Update job status badge
});

events.addEventListener('run.completed', (e) => {
  const { runId, run } = JSON.parse(e.data);
  // Update run status, show conclusion
});
```

### API Endpoints the Dashboard Consumes

| Dashboard View | Endpoints Used |
|---|---|
| Workflow list | `GET /api/workflows` |
| Workflow detail / trigger form | `GET /api/workflows/:name`, `POST /api/runs` |
| Run list | `GET /api/runs` |
| Run detail | `GET /api/runs/:id` |
| Live logs | `GET /api/events` (SSE `step.log` events) |
| Full logs | `GET /api/runs/:id/logs` |
| Artifacts | `GET /api/runs/:id/artifacts`, `GET /api/runs/:id/artifacts/:name` |
| Secrets management | `GET /api/secrets`, `PUT /api/secrets/:name`, `DELETE /api/secrets/:name` |
| Health indicator | `GET /health` |

### CORS

CORS is enabled by default (`cors()` middleware), so the dashboard can run on a different port (e.g., `localhost:3000`).

---

## 13. Extending the Runner

### Adding a New Action Shim

Shims are defined in two places depending on complexity:

**For language/tool setup shims** (declarative), add to `src/actions/shim-definitions.ts`:

```typescript
'owner/action-name': {
  name: 'My Tool (local shim)',
  description: 'Local runner shim for my-tool',
  inputs: {
    'version': { description: 'Tool version', default: '' },
  },
  outputs: {
    'version': { description: 'Installed version' },
  },
  detect: [
    {
      name: 'PATH',
      detect: [
        'if command -v my-tool &>/dev/null; then',
        '  TOOL_FOUND="path"',
        'fi',
      ].join('\n'),
    },
  ],
  setup: [
    'MY_VER=$(my-tool --version)',
    'echo "version=$MY_VER" >> $GITHUB_OUTPUT',
  ].join('\n'),
  notFoundMessage: 'my-tool not found. Install with: brew install my-tool',
},
```

Then register it in `src/actions/resolver.ts`:

```typescript
'owner/action-name': langShim('owner/action-name'),
```

**For custom logic shims** (checkout, cache, artifacts), add directly to `BUILTIN_SHIMS` in `resolver.ts` with inline YAML.

### Adding a New API Endpoint

Add a new route in `src/server.ts`:

```typescript
router.get('/my-endpoint', (req: Request, res: Response) => {
  // Access executor, workspacePath, secretsStore from closure
  res.json({ data: 'hello' });
});
```

### Adding a New Expression Function

Add a case to `evaluateFunction()` in `src/engine/expression.ts`:

```typescript
case 'myfunction': {
  const arg = String(args[0] ?? '');
  return arg.toUpperCase();
}
```

The function name is matched case-insensitively.

---

## 14. Troubleshooting

### "No such remote 'origin'" Warning

**Cause:** The workspace is not a git repo, or has no remote named `origin`. The runner tries to extract the repository name from `git remote get-url origin`.

**Impact:** None. The runner falls back to using `path.basename(workspacePath)` as the repository name and uses default values for `ref` and `sha`.

**Fix:** Not required. This is an informational warning.

### Marketplace Action Download Failures

**Symptom:** `Failed to download action owner/repo@ref`

**Causes and fixes:**
- **Private repository:** Set `GITHUB_TOKEN` or `GH_TOKEN` in your environment.
- **Invalid ref:** Verify the tag/branch/SHA exists on GitHub.
- **Network issues:** Check connectivity. The runner has a 2-minute timeout on git clone operations.
- **Stale cache:** Set `RUNNER_NO_CACHE=1` to force re-download.

### Sandbox Creation Failures

**Symptom:** `Sandbox creation failed, running in-place`

**Causes and fixes:**
- **Dirty git state for worktree:** Git worktrees can fail if there are conflicting worktrees. Run `git worktree prune` in your workspace.
- **Disk full:** Sandbox copies require available disk space. Clean up `/tmp/runner-sandboxes/`.
- **Permissions:** Ensure the runner has write access to `RUNNER_SANDBOX_DIR`.

**Impact:** The workflow runs in-place (no isolation). This is a fallback, not a hard failure.

### Secret Not Resolving

**Symptom:** `${{ secrets.MY_SECRET }}` evaluates to empty string.

**Causes and fixes:**
- **Secret not set:** Use `GET /api/secrets` to verify the secret exists.
- **Encrypted file without key:** If secrets were saved with `RUNNER_SECRETS_KEY` and you start the runner without it, secrets can't be decrypted. Set the same key.
- **Wrong workspace:** Secrets are scoped by workspace path. Ensure you're running from the same directory.

### Step Fails with "command not found"

**Cause:** The tool is not installed on your machine. Unlike GitHub Actions runners, which have a wide set of pre-installed tools, your local machine may lack specific tools.

**Fix:** Install the missing tool. The setup shims will detect it on the next run.

### Job Timeout

**Cause:** Job exceeded its `timeout-minutes` (default: 360 minutes). Step timeout default is 60 minutes.

**Fix:** Increase `timeout-minutes` in your workflow YAML, or debug why the step is hanging.

### Node.js Action Fails with "entry point not found"

**Cause:** The action's `dist/` directory may be missing from the git clone (common with `.gitignore`-heavy repos).

**Fix:** The runner uses `--depth 1` clones. If the action requires a build step, it won't work. Use a published tag that includes built files, or switch to a shimmed action.

---

## 15. API TypeScript Types

### WorkflowRun

```typescript
type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
type Conclusion = 'success' | 'failure' | 'cancelled' | 'skipped';

interface WorkflowRun {
  id: string;
  workflow: string;
  status: RunStatus;
  conclusion?: Conclusion;
  jobs: Job[];
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
  trigger: {
    event: string;            // e.g., 'workflow_dispatch'
    ref: string;              // e.g., 'refs/heads/main'
    sha: string;              // 40-char commit SHA
  };
  inputs?: Record<string, string>;
  env?: Record<string, string>;
  sandbox?: {
    path: string;
    strategy: string;
  };
}
```

### Job

```typescript
interface Job {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: Conclusion;
  steps: Step[];
  startedAt?: string;         // ISO 8601
  completedAt?: string;       // ISO 8601
  outputs: Record<string, string>;
}
```

### Step

```typescript
interface Step {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: Conclusion;
  log: string;
  outputs: Record<string, string>;
  number: number;
}
```

### Artifact

```typescript
interface Artifact {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  runId: string;
}
```

### WorkflowInfo

```typescript
interface WorkflowInfo {
  name: string;
  fileName: string;
  filePath: string;
  triggers: string[];
  jobs: { id: string; name: string; needs: string[] }[];
  inputs?: Record<string, WorkflowInput>;
}

interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}
```

### SSE Events

```typescript
type SSEEventType =
  | 'run.started'
  | 'run.completed'
  | 'job.started'
  | 'job.completed'
  | 'step.started'
  | 'step.completed'
  | 'step.log';

interface SSEEvent {
  type: SSEEventType;
  runId: string;
  jobId?: string;
  stepNumber?: number;
  data: unknown;
}
```

**Event payloads by type:**

```typescript
// run.started, run.completed
{ runId: string; run: WorkflowRun }

// job.started, job.completed
{ runId: string; jobId: string; job: Job }

// step.started, step.completed
{ runId: string; jobId: string; stepNumber: number; step: Step }

// step.log
{ runId: string; jobId: string; stepNumber: number; line: string }
```

### Request Types

```typescript
// POST /api/runs
interface TriggerRunRequest {
  workflow: string;
  inputs?: Record<string, string>;
  sandbox?: {
    strategy?: 'worktree' | 'copy' | 'none';
    ref?: string;
  };
}

// PUT /api/secrets/:name
interface SetSecretRequest {
  value: string;
}

// POST /api/secrets/import
interface ImportSecretsRequest {
  content: string;
}
```
