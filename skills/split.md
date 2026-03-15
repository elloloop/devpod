# Split Issue into Sub-Issues

Take a parent issue and split it into contract + component sub-issues. Each sub-issue carries the full context chain from the root issue down to itself, but has NO knowledge of sibling issues. Components develop independently against the shared contract.

## Arguments

$ARGUMENTS: `<component1> [component2] ...`

Components: `contract`, `backend`, `web`, `flutter`, `worker`

Examples:
- `/split backend web` → creates: contract + backend + web
- `/split backend flutter` → creates: contract + backend + flutter
- `/split backend web flutter worker` → creates all

If no arguments, ask the user.

## Steps

### 1. Build the full context chain

Read the current issue from `.claude/issue`:
```bash
gh issue view <number>
```

Then walk UP the parent chain. Check the issue body for `Parent: #<number>`. If found, read that issue too, and repeat until there's no parent. This gives you the full hierarchy.

Build a context block from root to current:
```
## Context Chain

### Root: #<root-number> — <root-title>
<root description>

### Parent: #<parent-number> — <parent-title>
<parent description>

### This issue: #<current-number> — <current-title>
<current description>
```

### 2. Create contract sub-issue (always first)

The contract sub-issue gets the full context chain plus contract-specific instructions:

```bash
gh issue create \
  --title "[Contract] <current-title>" \
  --body "$(cat <<'EOF'
## Context Chain

### Root: #<root> — <root-title>
<root description>

### Feature: #<current> — <current-title>
<current description>

---

## Task: Define Proto Contract

Define the protobuf service contract for this feature. This contract is the single source of truth — all components will be built against generated code from this proto.

### Requirements
<extract relevant requirements from the context chain>

### Acceptance criteria
- [ ] Proto service and messages defined in `proto/`
- [ ] `buf lint` passes
- [ ] Code generated for all target languages
- [ ] Contract committed and pushed

### How to start
Run `/contract` to define the proto.

Parent: #<current>
EOF
)" \
  --assignee @me
```

### 3. Create component sub-issues

For each component, create a sub-issue with the full context chain + component-specific scope. **Do NOT include any information about other components or their issues.**

```bash
gh issue create \
  --title "[<Component>] <current-title>" \
  --body "$(cat <<'EOF'
## Context Chain

### Root: #<root> — <root-title>
<root description>

### Feature: #<current> — <current-title>
<current description>

---

## Task: Implement <Component>

Implement the <component> for this feature using the generated proto types.

### Requirements
<extract ONLY the requirements relevant to this component from the context chain>

### Contract
This component implements against the proto contract defined in `proto/`. Use the generated types in `gen/<language>/` — never hand-write types that the proto defines.

### Acceptance criteria
- [ ] Implements all relevant RPCs / uses all relevant client types
- [ ] Unit tests passing
- [ ] Integration / E2E tests passing
- [ ] Docker tested
- [ ] PR created

### How to start
1. Make sure the contract is generated: check `gen/` directory
2. Run `/<component>-init` if scaffolding is needed
3. Run `/<component>-ship <this-issue-number>` for the full pipeline

Parent: #<current>
EOF
)" \
  --assignee @me
```

### 4. Update parent issue (tracking only)

The parent issue tracks overall progress. This is the ONLY place where all sub-issues are visible together:

```
gh issue comment <current> --body "### 🔀 Split into sub-issues

| Component | Issue | Status |
|---|---|---|
| Contract | #<contract-issue> | 🔲 Not started |
| Backend | #<backend-issue> | 🔲 Not started |
| Web | #<web-issue> | 🔲 Not started |

**Order**: Contract first → then components in parallel.

Start with: switch to issue #<contract-issue> and run \`/contract\`"
```

### 5. Report

Show the breakdown to the user. Explain:
1. Start with the contract issue
2. Once contract is merged, components can be worked in any order
3. Each sub-issue is self-contained — an agent can pick up any one without context about siblings

## Important
- Every sub-issue MUST include the full context chain from root to itself
- Sub-issues MUST NOT reference or mention sibling issues
- Only the PARENT issue has visibility into all children (for tracking)
- Context chain ensures any agent can understand the full "why" without seeing the "what else"
- If the parent itself has a parent, walk the ENTIRE chain up to root
