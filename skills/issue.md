# Create GitHub Issue and Set Up Workspace

Start a new unit of work. Create a GitHub issue (or sub-issue), set up a branch, and prepare the workspace. Sub-issues carry the full context chain from root to themselves.

## Arguments

$ARGUMENTS: `<title> [-- <description>] [--parent <issue#>]`

Examples:
- `/issue Add user authentication -- Implement OAuth2 with Google and GitHub`
- `/issue Implement auth API --parent 42`

If no arguments provided, ask the user.

## Steps

### 1. Parse arguments

- Title: everything before `--`
- Description: everything between `--` and `--parent` (if present)
- Parent: issue number after `--parent` (if present)

### 2. Build context chain (if sub-issue)

If `--parent` is specified, walk the parent chain to build full context:

```bash
gh issue view <parent>
```

Check the parent's body for `Parent: #<number>`. If found, read that issue too. Repeat until root.

Build the context block:
```
## Context Chain

### Root: #<root> — <root-title>
<root description>

### Parent: #<parent> — <parent-title>
<parent description>
```

### 3. Create the issue

**Top-level issue:**
```bash
gh issue create --title "<title>" --body "<description>" --assignee @me
```

**Sub-issue (with parent):**
```bash
gh issue create --title "<title>" --body "$(cat <<'EOF'
## Context Chain

<full context from root to parent>

---

## Task

<description>

## Required Test Deliverables

Every sub-issue MUST include regression tests as part of the deliverable. Code without tests will be rejected by `/review`.

### Minimum test requirements:
- [ ] **Unit tests** for every new public function/method/handler
- [ ] **Integration tests** for any new gRPC endpoint, DB query, or API route
- [ ] **Behavior tests** for user-facing logic (test WHAT not HOW)
- [ ] **E2E/Playwright tests** if the issue adds or modifies a user-visible feature (web/Flutter)

### Test verification:
- The PR must include test files proportional to source files (at least 1 test file per 2 source files)
- Tests must import and exercise the actual module being built — stubs/empty tests are a rejection
- All tests must pass: the agent must run the test suite and include the exit code in the PR description

> ⚠️ If you cannot write a meaningful test (e.g., pure config, proto-only changes), explain why in the PR description. This is the ONLY acceptable exception.

Parent: #<parent>
EOF
)" --assignee @me
```

The sub-issue body includes the FULL context chain but NO information about sibling issues.

### 4. Update parent (if sub-issue)

```bash
gh issue comment <parent> --body "Sub-issue created: #<new-number> — <title>"
```

### 5. Create branch

```bash
git checkout main && git pull && git checkout -b <number>-<slugified-title>
```

### 6. Post progress comment

```
gh issue comment <number> --body "## Progress

- [x] Issue created
- [x] Branch \`<branch-name>\` created
- [ ] Contract defined
- [ ] Development
- [ ] Regression tests written (unit + integration)
- [ ] Test existence verified (source:test file ratio)
- [ ] All tests passing (exit code 0)
- [ ] Docker tested
- [ ] PR created
- [ ] Deployed to staging
- [ ] Staging verified

---
_Tracking automated by Claude Code_"
```

### 7. Save state

Write `.claude/issue` with the issue number.

### 8. Report

Show issue URL and branch name. Suggest next steps:
- `/split backend web` if this needs multiple components
- `/contract` to define the proto contract
- `/web-dev`, `/backend-dev`, `/flutter-dev` to start building
