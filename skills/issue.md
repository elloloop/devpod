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
- [ ] Tests passing
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
