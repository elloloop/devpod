# Architect — Design and Plan a Full Application

Talk to the user to understand what they want to build, design the architecture, decompose it into a dependency tree of issues, and create everything needed so each issue can be worked independently (even by separate agents in parallel).

This skill is the entry point for building an entire app from a single description.

## Core Architectural Principle: Append-Only

The entire system is designed so that **adding a feature = adding a directory**. Nothing existing is ever modified.

- **Proto contracts** are append-only — new services are new `.proto` files
- **Backend modules** are append-only — each module is a directory under `modules/` that self-registers via `init()` / decorator / `inventory`
- **Web features** are append-only — each feature is a directory under `features/` auto-discovered by the shell
- **Flutter features** are append-only — same pattern
- **Core is frozen** — the shell, registry, event bus, router are set up once in scaffold and never modified by feature agents

This structurally guarantees that parallel agents cannot conflict — they literally work in different directories and never edit the same files. Inter-module communication is through the event bus (backend) or navigation/shared providers (frontend), never direct imports.

## Phase 1: Gather Requirements

Have a conversation with the user. Ask focused questions to understand:

### What are we building?
- What does the app do? (one-sentence summary)
- Who uses it? (end users, admins, other services)
- What are the core features? (list them out, prioritize)

### What components are needed?
For each feature, identify:
- Does it need a **backend API**? (what data, what operations)
- Does it need a **web frontend**? (what pages, what interactions)
- Does it need a **mobile app** (Flutter)? (which platforms)
- Does it need **background workers**? (what jobs, what triggers)
- Does it need **external integrations**? (third-party APIs, databases, queues)

### What's the tech stack?
- Backend language preference? (Go / Python / Rust — default: Go)
- Web framework? (Next.js / Astro / Vite — default: Next.js)
- Database? (Postgres, SQLite, etc.)
- Deployment target? (Vercel, Fly.io, RunPod, etc.)

### What's the scope?
- Is this an MVP or a full product?
- What's the first milestone? (smallest useful version)

**Keep asking until you have enough to design the full architecture. Don't start creating issues until the user confirms the plan.**

## Phase 2: Design the Architecture

Based on requirements, design:

### Services
List every service (backend, worker, etc.) with:
- Name and purpose
- Language
- Key responsibilities
- Data it owns

### Contracts (Proto Services)
For each API boundary, define:
- Service name
- Key RPCs (just names and descriptions, not full proto yet)
- Which components produce (implement) and consume (call) each service

### Frontends
List every frontend with:
- Framework
- Key pages/screens
- Which contracts it consumes

### Dependency Graph
Draw the dependency tree. Rules:
1. **Proto contracts have NO dependencies** (they're pure definitions)
2. **Backend services depend on their contract** (implement the server)
3. **Frontends depend on their contract** (consume the client)
4. **Backend services may depend on OTHER contracts** (if they call other services)
5. **Nothing depends on a frontend** (frontends are always leaves)

Example dependency graph:
```
Root: Build a payments app
├── Contract: UserService          ← no deps, can start immediately
│   ├── Backend: user-service      ← depends on UserService contract
│   └── Web: user pages            ← depends on UserService contract
├── Contract: PaymentService       ← no deps, can start immediately
│   ├── Backend: payment-service   ← depends on PaymentService contract + UserService contract
│   └── Web: payment pages         ← depends on PaymentService contract
└── Worker: payment-processor      ← depends on PaymentService contract
```

### Execution Order
From the dependency graph, determine:
- **Wave 0**: Scaffold — set up frozen core (backend core/, web core/, flutter core/), buf config, docker-compose, CI. This wave uses `/backend-init`, `/web-init`, `/flutter-init`. Once merged, core is FROZEN.
- **Wave 1**: All contracts — each is a new `.proto` file, can be done in parallel
- **Wave 2**: All modules/features that only depend on contracts — each is a new directory under `modules/` or `features/`, can be done in parallel
- **Wave 3**: Modules that depend on events from other modules (rare — most work is Wave 2)

### Conflict Analysis
With the append-only architecture, conflicts are structurally impossible:
- Each contract is its own `.proto` file — different files
- Each backend module is its own directory under `modules/` — different directories
- Each web feature is its own directory under `features/` — different directories
- Each flutter feature is its own directory under `lib/features/` — different directories
- Core is frozen — no agent modifies it
- The ONLY append point is the module/feature registry (one line per feature) — handle by making these sequential or using convention-based auto-discovery that needs no registration file
- Shared config (docker-compose, buf.yaml) is set up in Wave 0 scaffold and frozen

**Present this plan to the user and get confirmation before proceeding.**

## Phase 3: Create the Issue Tree

Once the user confirms:

### 1. Create the root issue

```bash
gh issue create --title "<App name> — <one-line description>" --body "$(cat <<'EOF'
## Overview
<what the app does, who it's for>

## Architecture
<services, frontends, contracts — from Phase 2>

## Dependency Graph
<the tree from Phase 2>

## Execution Order
<waves from Phase 2>

## Progress
_Updated automatically as sub-issues complete._
EOF
)" --assignee @me --label epic
```

Save to `.claude/issue`.

### 2. Create scaffold issue (if needed)

If there are shared configs (docker-compose, CI, monorepo structure), create a scaffold issue first:

```bash
gh issue create --title "[Scaffold] <App name> — project structure" --body "$(cat <<'EOF'
## Context Chain

### Root: #<root> — <root-title>
<full root description>

---

## Task: Set Up Project Structure

Set up the shared project scaffolding that all components need:
- [ ] Repository structure (monorepo layout if needed)
- [ ] `buf.yaml` and `buf.gen.yaml` for proto management
- [ ] `docker-compose.yml` with all service stubs
- [ ] Shared CI workflow
- [ ] `.gitignore`, `Makefile`, etc.

This MUST be completed and merged before any other work begins.

Parent: #<root>
EOF
)" --assignee @me
```

### 3. Create contract issues

For each contract identified in Phase 2. These depend only on the scaffold (if any):

```bash
gh issue create --title "[Contract] <ServiceName>" --body "$(cat <<'EOF'
## Context Chain

### Root: #<root> — <root-title>
<full root description>

---

## Task: Define <ServiceName> Proto Contract

<what this service does, extracted from requirements>

### RPCs to define
<list of RPCs with descriptions — from Phase 2 design>

### Messages to define
<key entities and their fields — from Phase 2 design>

### Consumers
<which components will use this contract — but NOT their issue numbers>

### Acceptance criteria
- [ ] Proto service and messages defined
- [ ] `buf lint` passes
- [ ] Code generated for all target languages
- [ ] Committed and merged to main

### How to start
Run `/contract <ServiceName>`

Depends on: #<scaffold-issue> (if exists)
Parent: #<root>
EOF
)" --assignee @me
```

### 4. Create component issues

For each backend service, frontend, and worker. Each carries full context but NO sibling knowledge:

```bash
gh issue create --title "[<Component>] <name>" --body "$(cat <<'EOF'
## Context Chain

### Root: #<root> — <root-title>
<full root description>

---

## Task: Implement <component name>

<what this component does, extracted from requirements>

### Requirements
<only the requirements relevant to THIS component>

### Contract dependency
This component implements/consumes the `<ServiceName>` contract.
Wait for the contract to be defined and merged before starting.
Once merged, the generated types will be in `gen/<language>/<service>/`.

### Technical details
- Language/framework: <from Phase 2>
- Key functionality: <specific to this component>
- Port: <assigned port>
- Directory: <assigned directory>

### Acceptance criteria
- [ ] Implements all required RPCs / consumes all required client types
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Docker tested
- [ ] PR created and merged

### How to start
1. Make sure contract is merged (check `gen/` directory)
2. Run `/<type>-ship <this-issue-number>`

Depends on: #<contract-issue-for-this-component>
Parent: #<root>
EOF
)" --assignee @me
```

**CRITICAL**: Component issues reference their contract dependency by issue number (since the contract is a direct dependency, not a sibling). But they do NOT reference other component issues.

### 5. Update root issue with tracking table

After all issues are created:

```bash
gh issue comment <root> --body "### 📋 Issue Tree Created

## Wave 0: Scaffold
| Issue | Status |
|---|---|
| #<scaffold> [Scaffold] | 🔲 Not started |

## Wave 1: Contracts (parallel)
| Issue | Status |
|---|---|
| #<contract-1> [Contract] UserService | 🔲 Not started |
| #<contract-2> [Contract] PaymentService | 🔲 Not started |

## Wave 2: Components (parallel after their contract merges)
| Issue | Depends on | Status |
|---|---|---|
| #<backend-1> [Backend] user-service | #<contract-1> | 🔲 Blocked |
| #<backend-2> [Backend] payment-service | #<contract-2> | 🔲 Blocked |
| #<web> [Web] frontend | #<contract-1>, #<contract-2> | 🔲 Blocked |
| #<flutter> [Flutter] mobile | #<contract-1>, #<contract-2> | 🔲 Blocked |

## Wave 3: Workers (after backends)
| Issue | Depends on | Status |
|---|---|---|
| #<worker> [Worker] payment-processor | #<backend-2> | 🔲 Blocked |

---

### Execution instructions

1. Start with **Wave 0** (scaffold) — merge to main
2. Work all **Wave 1** contracts in parallel — merge each to main
3. Work all **Wave 2** components in parallel — each rebases on main before PR
4. Work **Wave 3** after dependencies are merged

Each issue is self-contained. Run the appropriate \`/ship\` command on any issue to execute it.

_Architecture planned by Claude Code_"
```

## Phase 4: Report

Tell the user:
1. The full issue tree with links
2. What to work on first (scaffold → contracts → components)
3. That each issue can be worked in a separate Claude Code session
4. That parallel issues won't conflict because they work in different directories against shared contracts

## Rebase Rule

Remind the user (and embed in issue descriptions): **Every branch must rebase on main before creating a PR.** This is non-negotiable because:
- Contract merges to main first
- Component branches need the generated code from main
- If two components are worked in parallel, rebasing ensures they pick up each other's merged changes
- This prevents ALL merge conflicts

## Important
- NEVER create issues until the user confirms the architecture
- NEVER skip the requirements conversation — ask until you understand
- NEVER create circular dependencies
- Every issue must be completable by an agent reading ONLY that issue
- The root issue is the ONLY place with full visibility into all sub-issues
- Contracts are ALWAYS worked before components
- Parallel components MUST work in different directories
- If a potential file conflict is detected, make those issues sequential
