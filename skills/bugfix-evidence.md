# Bugfix Evidence — Before/After Screenshot Documentation

Capture before/after evidence for a bug fix. Generates a minimal documentation file with side-by-side screenshots showing the bug and the fix. No video — just screenshots and a structured markdown file for the web dashboard.

## Arguments

$ARGUMENTS: `"<bug description>" [--pr <number>] [--issue <number>] [--before <path>] [--after <path>]`

Examples:
- `/bugfix-evidence "Login button unresponsive on mobile" --pr 205`
- `/bugfix-evidence "Invoice total miscalculated" --pr 210 --issue 198`
- `/bugfix-evidence "Dark mode text invisible" --before screenshots/before.png --after screenshots/after.png`

If no arguments provided, ask the user for the bug description and PR number.

## Steps

### 1. Gather context

Read the PR and issue to understand the bug and the fix.

```bash
# Read PR if provided
if [ -n "$PR" ]; then
  gh pr view $PR
  gh pr diff $PR --name-only
fi

# Read issue if provided
if [ -n "$ISSUE" ]; then
  gh issue view $ISSUE
fi
```

If neither `--pr` nor `--issue` is provided, check `.claude/issue`:
```bash
ISSUE=$(cat .claude/issue 2>/dev/null)
if [ -n "$ISSUE" ]; then
  gh issue view $ISSUE
  gh pr list --search "closes #$ISSUE" --json number,title,state
fi
```

From the context, identify:
- **What was broken**: the user-visible bug
- **What was fixed**: the code change that resolved it
- **Where to see it**: the URL/screen where the bug was visible

### 2. Generate slug and output directory

```bash
SLUG=$(echo "<bug-description>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
DATE=$(date +%Y-%m-%d)
DOC_DIR="docs/features/${DATE}-fix-${SLUG}"
mkdir -p "${DOC_DIR}/screenshots"
```

Note the `fix-` prefix in the slug — this distinguishes bugfix evidence from feature documentation in the dashboard.

### 3. Capture before screenshot

If `--before` was provided, copy it:
```bash
cp "<before-path>" "${DOC_DIR}/screenshots/01-before.png"
```

If not provided, attempt to capture it from the base branch. Check if the actions runner is available:

```bash
RUNNER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4800/api/health 2>/dev/null || echo "000")
```

If available, capture a screenshot from the current main branch state:

```bash
RUN_ID=$(curl -s -X POST http://localhost:4800/api/runs \
  -H "Content-Type: application/json" \
  -d "{
    \"workflow\": \"screenshot\",
    \"inputs\": {
      \"url\": \"<url-where-bug-is-visible>\",
      \"branch\": \"main\",
      \"output\": \"${DOC_DIR}/screenshots/01-before.png\",
      \"wait\": 2000
    }
  }" | jq -r '.id')

# Poll for completion
while true; do
  STATUS=$(curl -s http://localhost:4800/api/runs/${RUN_ID} | jq -r '.status')
  case "$STATUS" in
    "completed") echo "Before screenshot captured"; break ;;
    "failed") echo "Before screenshot failed"; break ;;
    *) sleep 3 ;;
  esac
done
```

If the runner is unavailable or capture fails, continue without the before screenshot and note this in the document.

### 4. Capture after screenshot

If `--after` was provided, copy it:
```bash
cp "<after-path>" "${DOC_DIR}/screenshots/02-after.png"
```

If not provided and the runner is available, capture from the PR branch:

```bash
# Get the PR branch name
BRANCH=$(gh pr view $PR --json headRefName -q '.headRefName')

RUN_ID=$(curl -s -X POST http://localhost:4800/api/runs \
  -H "Content-Type: application/json" \
  -d "{
    \"workflow\": \"screenshot\",
    \"inputs\": {
      \"url\": \"<url-where-bug-is-visible>\",
      \"branch\": \"${BRANCH}\",
      \"output\": \"${DOC_DIR}/screenshots/02-after.png\",
      \"wait\": 2000
    }
  }" | jq -r '.id')

# Poll for completion
while true; do
  STATUS=$(curl -s http://localhost:4800/api/runs/${RUN_ID} | jq -r '.status')
  case "$STATUS" in
    "completed") echo "After screenshot captured"; break ;;
    "failed") echo "After screenshot failed"; break ;;
    *) sleep 3 ;;
  esac
done
```

### 5. Generate evidence document

Write `feature.md` (same filename as feature docs for dashboard compatibility):

```bash
cat > "${DOC_DIR}/feature.md" << 'DOC_EOF'
---
title: "Fix: <Bug Description>"
slug: "fix-<bug-slug>"
date: "<YYYY-MM-DD>"
status: "review"
type: "bugfix"
prs:
  - number: <pr-number>
    title: "<PR title>"
    repo: "<owner/repo>"
    status: "<open|merged|closed>"
issue: <issue-number>
screenshots:
  - "./screenshots/01-before.png"
  - "./screenshots/02-after.png"
---

## Bug

<1-2 sentence description of what was broken, from the user's perspective>

## Fix

<1-2 sentence description of what was changed to fix it, from the code perspective>

## Evidence

| Before | After |
|--------|-------|
| ![Before](./screenshots/01-before.png) | ![After](./screenshots/02-after.png) |

## What Changed

<Bullet list of files changed and why, derived from PR diff>

## Pull Request

| PR | Title | Status |
|----|-------|--------|
| #<number> | <title> | <status> |
DOC_EOF
```

**Frontmatter rules:**
- `type` is always `"bugfix"` — this tells the dashboard to render the side-by-side layout
- `title` always starts with `"Fix: "` prefix
- `slug` always starts with `"fix-"` prefix
- `issue` field is included only if an issue number was provided or detected
- `screenshots` list only includes files that actually exist on disk

**Content rules:**
- "Bug" section describes the symptom from the user's perspective
- "Fix" section describes the code change, not the symptom
- Evidence table shows before/after side by side
- If only one screenshot was captured, show it alone with a note about the missing one
- If no screenshots were captured, replace the Evidence section with a text description

### 6. Update tracking

Comment on the PR and issue:

```bash
# Comment on the PR
if [ -n "$PR" ]; then
  gh pr comment $PR --body "### Bugfix Evidence

Evidence documented: \`${DOC_DIR}/feature.md\`
Dashboard: http://localhost:3000/features/fix-${SLUG}

Before/after screenshots captured for this fix."
fi

# Comment on the issue
if [ -n "$ISSUE" ]; then
  gh issue comment $ISSUE --body "### Bugfix Evidence

Evidence documented: \`${DOC_DIR}/feature.md\`
Dashboard: http://localhost:3000/features/fix-${SLUG}"
fi
```

### 7. Report

Output a summary:

```
## Bugfix Evidence Generated

**Bug**: <description>
**Directory**: <DOC_DIR>/
**Dashboard**: http://localhost:3000/features/fix-<slug>

### Artifacts
- feature.md: ✅
- Before screenshot: ✅ / ❌ Not captured
- After screenshot: ✅ / ❌ Not captured

### Pull Request
| PR | Title | Status |
|----|-------|--------|
| #205 | ... | Open |
```

## Important

- The doc directory uses the same `docs/features/` path as feature documentation — the dashboard renders both
- The `fix-` prefix in the slug is required for the dashboard to apply the side-by-side bugfix layout
- The `type: "bugfix"` frontmatter field is required — without it the dashboard renders the feature layout instead
- Always attempt to capture both before and after screenshots — but never block if either fails
- Before screenshots come from the `main` branch state; after screenshots come from the PR branch
- If screenshots are provided via `--before` and `--after`, use those directly without triggering the runner
- Keep the "Bug" description focused on what the user experienced, not on the code
- Keep the "Fix" description focused on the code change, not on the symptom
- File naming is strict: `01-before.png` and `02-after.png` — the dashboard parses these names
- Do not hardcode PR or issue data — always read it live from GitHub via `gh`
- If no PR is provided and none can be detected, create the evidence doc without the PR table and note this in the report
