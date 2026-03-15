# Blocked — Escalate a Missing Dependency

A feature agent has discovered it needs something that doesn't exist yet — a proto RPC, a shared utility, an event from another module, etc. This skill stops work, documents the blocker, and escalates it to the parent issue for resolution.

**RULE: Feature agents must NEVER create things outside their own module/feature directory. If something is missing, they call `/blocked`.**

## Arguments

$ARGUMENTS: description of what's needed.
Example: `/blocked Need a UserService.GetUser RPC to look up the invoice owner`

## Steps

### 1. Document the blocker

Identify exactly what's missing:
- **Missing proto RPC**: a service method that doesn't exist in the contract
- **Missing event**: an event from another module that should be published but isn't
- **Missing shared utility**: something needed in `core/` that doesn't exist
- **Missing data**: a field in an existing proto message that's not there
- **Missing module**: an entire module that needs to exist first

### 2. Check if it already exists

Before escalating, verify it's truly missing:
```bash
# Search for the thing in the codebase
grep -r "<keyword>" proto/ gen/ core/ modules/ features/
```

If it exists but the agent didn't know, report where it is and continue work.

### 3. If truly missing — STOP work and escalate

Comment on the current issue:

```
gh issue comment <current-issue> --body "### 🚫 Blocked

**Needs**: <what's missing>
**Why**: <why this feature needs it>
**Scope**: <proto change / new event / core utility / new module>

Work on this issue is paused until the dependency is resolved.

_Blocked at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 4. Escalate to parent issue

Read the parent issue number from the current issue body (`Parent: #<number>`).

```
gh issue comment <parent-issue> --body "### ⚠️ Dependency needed

**Reported by**: #<current-issue> (<component name>)
**Needs**: <what's missing>
**Why**: <why it's needed>
**Suggested scope**: <proto change / new event / core utility / new module>

This blocks progress on #<current-issue>. A new sub-issue should be created to resolve this dependency, and #<current-issue> should be made dependent on it."
```

### 5. Report to user

Tell the user:
- What's missing and why
- That work is paused on this issue
- The parent issue has been notified
- Suggest: `/resolve <parent-issue#>` to create the dependency and unblock

## What agents must NEVER do when blocked

- ❌ Create a proto RPC themselves (that's the contract owner's job)
- ❌ Add a field to another module's event (that's that module's job)
- ❌ Add utilities to `core/` (that's the scaffold owner's job)
- ❌ Import from another feature/module directly
- ❌ Create a workaround that duplicates logic
- ❌ Continue working with a mock/stub and "fix later"

## What agents SHOULD do

- ✅ Stop immediately
- ✅ Document exactly what they need and why
- ✅ Escalate to the parent issue
- ✅ Wait for the dependency to be resolved
