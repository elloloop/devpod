# Resolve — Handle a Blocked Dependency

A feature agent has reported a missing dependency via `/blocked`. This skill acts as the **module director** — it figures out if the dependency already exists, creates the right issue to fulfill it, and sets up the dependency chain so blocked work can resume.

## Arguments

$ARGUMENTS: parent issue number (the issue where the block was reported).
Example: `/resolve 100`

## Steps

### 1. Read all blocker reports

Read the parent issue and its comments:
```bash
gh issue view <parent> --comments
```

Find all comments that contain "⚠️ Dependency needed". Collect:
- What's needed (proto RPC, event, utility, module)
- Which sub-issue reported it
- Why they need it

### 2. Deduplicate and analyze

Multiple sub-issues might need the same thing. Group blockers by what they need:

- Same proto RPC requested by two features? → one contract update
- Same event needed by two modules? → one module update to publish it
- Multiple core utilities needed? → one scaffold update

### 3. Check if it already exists

For each unique need:
```bash
# Search protos
grep -r "<keyword>" proto/

# Search generated code
grep -r "<keyword>" gen/

# Search core
grep -r "<keyword>" core/

# Search modules (maybe another module already publishes this event)
grep -r "<keyword>" modules/ features/
```

If found, comment on the blocked issue telling them where it is and unblock.

### 4. Determine the right resolution

| What's missing | Resolution |
|---|---|
| Proto RPC or message | Create a contract update issue |
| Event from another module | Create an issue for that module to publish the event |
| Core utility | Create a scaffold update issue |
| Entire new module | Create a new contract + module issue pair |
| Field on existing message | Create a contract update issue |

### 5. Create resolution issue(s)

For each unique dependency, create an issue with full context:

```bash
gh issue create --title "[<type>] <what's needed>" --body "$(cat <<'EOF'
## Context Chain

<walk up from parent to root, include full context>

---

## Task

<what needs to be created/updated>

### Requested by
- #<blocked-issue-1>: needs <X> because <reason>
- #<blocked-issue-2>: needs <X> because <reason>

### What to do
<specific instructions — e.g., add RPC to proto, add event publish to module, etc.>

### Acceptance criteria
- [ ] <thing> exists and is available
- [ ] Generated code updated (if proto change)
- [ ] Tests pass
- [ ] Merged to main

### After completion
The following issues will be unblocked:
- #<blocked-issue-1>
- #<blocked-issue-2>

Parent: #<parent>
EOF
)" --assignee @me
```

### 6. Update blocked issues

For each blocked sub-issue, add a comment:

```
gh issue comment <blocked-issue> --body "### 🔓 Dependency tracked

The missing dependency has been tracked as #<resolution-issue>.

**What**: <what's being created>
**Issue**: #<resolution-issue>
**Status**: 🔲 Not started

This issue remains blocked until #<resolution-issue> is merged to main. Once merged, rebase your branch on main and continue.

Depends on: #<resolution-issue>"
```

### 7. Update parent issue tracking table

Add the new resolution issue to the parent's tracking:

```
gh issue comment <parent> --body "### 📋 Dependency resolved

New issue created: #<resolution-issue> — <title>

**Blocks**: #<blocked-1>, #<blocked-2>
**Priority**: should be worked before blocked issues can continue

Updated execution order:
1. Complete #<resolution-issue> and merge
2. Blocked issues rebase on main and continue"
```

### 8. Report

Tell the user:
- What dependencies were identified
- What resolution issues were created
- What the new execution order is
- Which issues to work on next (the resolution issues)

## Important
- ALWAYS check if the dependency already exists before creating new issues
- Resolution issues get full context chain — they're independently workable
- Blocked issues must NOT continue until the resolution is merged to main
- If the same dependency is needed by multiple features, create ONE resolution issue
- The module director (this skill) is the ONLY entity that creates cross-cutting issues
