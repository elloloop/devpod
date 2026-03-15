# Feature — Design and Plan a Feature in an Existing App

Talk to the user to understand the feature, figure out which existing contracts/modules/features need changes vs what's new, create the issue tree, and set up work so each piece can be built independently.

Unlike `/architect` (which starts from zero), this skill works within an existing codebase with existing contracts, modules, and features already in place.

## Phase 1: Understand the Feature

Have a conversation with the user:

- What does this feature do? (one-sentence summary)
- Who is it for? (end users, admins, internal)
- What's the user journey? (step by step, what happens)

## Phase 2: Audit the Existing Codebase

Before designing anything, understand what already exists:

### Scan contracts
```bash
ls proto/*.proto
```
For each proto, note the services and RPCs already defined.

### Scan backend modules
```bash
ls modules/ # or src/modules/ depending on language
```
Note what modules exist and what events they publish (check `events.go`, `events.py`, etc.)

### Scan web features
```bash
ls -d src/app/\(features\)/*/ 2>/dev/null || ls -d features/*/ 2>/dev/null
```

### Scan flutter features
```bash
ls -d lib/features/*/ 2>/dev/null
```

### Check generated code
```bash
ls gen/
```

Build a map of what exists:
- Existing proto services and their RPCs
- Existing backend modules and their events
- Existing frontend features
- Existing shared components in core

## Phase 3: Design the Feature

For the new feature, determine:

### What's new vs what's changed

Categorize every piece of work:

| Category | Example | How it's handled |
|---|---|---|
| **New contract** | New `PaymentService` proto | New proto file, new issue |
| **Contract extension** | Add `GetInvoicePDF` RPC to existing `InvoiceService` | Update existing proto, new issue |
| **New backend module** | New `modules/payment/` | New directory, new issue |
| **Existing module change** | Add event subscriber to `modules/invoice/` | Change within existing module, new issue |
| **New web feature** | New `features/checkout/` | New directory, new issue |
| **Existing feature change** | Add button to existing `features/invoice/` page | Change within existing feature, new issue |
| **New flutter feature** | New `lib/features/checkout/` | New directory, new issue |
| **Existing feature change** | Add screen to `lib/features/invoice/` | Change within existing feature, new issue |

### Dependency analysis

1. **Contract changes come first** — always
2. **New modules/features** depend on their contract
3. **Changes to existing modules** depend on any new contract they need
4. **Frontend changes** depend on backend contract being available
5. **Changes to the SAME module/feature** must be sequential (same directory)
6. **Changes to DIFFERENT modules/features** can be parallel

### Conflict check

- Two issues touching the SAME module/feature directory → make sequential
- Two issues touching DIFFERENT directories → safe to parallel
- Any issue touching `core/` → STOP, this violates the frozen core rule. If core changes are truly needed, create a separate scaffold-update issue that goes first.

**Present the plan to the user before creating issues.**

## Phase 4: Create the Issue Tree

### 1. Create the feature root issue

```bash
gh issue create --title "<feature title>" --body "$(cat <<'EOF'
## Feature

<what it does, who it's for, user journey>

## Existing codebase context

### Contracts in place
<list existing protos and relevant RPCs>

### Modules in place
<list existing backend modules relevant to this feature>

### Features in place
<list existing frontend features relevant to this feature>

## Changes needed

### Contracts
<new protos and extensions to existing protos>

### Backend
<new modules and changes to existing modules>

### Frontend
<new features and changes to existing features>

## Dependency graph
<the tree>

## Execution order
<waves>
EOF
)" --assignee @me --label feature
```

### 2. Create sub-issues

For each piece of work, create a sub-issue with:
- **Full context chain** from root to this issue
- **Existing codebase context** — what already exists that this issue touches
- **Exact scope** — which files/directories this issue may modify
- **Contract spec** — if contract exists, include the relevant RPCs and messages
- **No sibling knowledge** — no info about parallel issues

For **contract extension** issues:
```
## Task: Extend <ServiceName> contract

### Existing RPCs (DO NOT modify these)
<list existing RPCs — agent must not touch these>

### New RPCs to add
<list new RPCs with descriptions>

### New messages to add
<list new messages>

IMPORTANT: Only ADD new RPCs and messages. Never modify or remove existing ones.
```

For **existing module/feature change** issues:
```
## Task: Update <module/feature name>

### Current state
<what this module/feature currently does — read from codebase>

### Changes needed
<specific changes to make>

### Files you may modify
<explicit list of files within this module/feature directory>

### Files you must NOT modify
<everything outside this directory>
```

For **new module/feature** issues:
Same as before — create directory, self-register, implement against contract.

### 3. Update root issue with tracking table

Same wave-based tracking as `/architect`, but include which items are "new" vs "change to existing".

```
## Wave 1: Contract changes
| Issue | Type | Status |
|---|---|---|
| #X [Contract] Extend InvoiceService | extension | 🔲 |
| #Y [Contract] New PaymentService | new | 🔲 |

## Wave 2: Implementation (parallel where safe)
| Issue | Type | Directory | Depends on | Status |
|---|---|---|---|---|
| #A [Backend] payment module | new | modules/payment/ | #Y | 🔲 |
| #B [Backend] update invoice module | change | modules/invoice/ | #X | 🔲 |
| #C [Web] checkout feature | new | features/checkout/ | #Y | 🔲 |
| #D [Web] update invoice feature | change | features/invoice/ | #X | 🔲 |
```

### 4. Propagate contract specs

Same as `/contract` — after contract issues are worked, propagate the specs to dependent component issues.

## Phase 5: Report

Tell the user:
- The full issue tree with dependencies
- What's new vs what's changing
- Which items can be parallelized
- Where to start

## Important

- NEVER propose changes to `core/` — it's frozen. If truly needed, flag it explicitly.
- For contract extensions: ONLY add, never modify existing RPCs (breaking change)
- For existing module/feature changes: scope the issue to ONLY the files in that directory
- Two issues on the SAME directory = sequential. Two issues on DIFFERENT directories = parallel.
- Always include what already exists in sub-issue context so agents don't recreate things
- Run `buf breaking --against '.git#branch=main'` before merging any contract changes
