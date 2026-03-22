# Feature Documentation — Generate Visual Feature Docs with Video Evidence

Generate visual feature documentation — screenshots, video demos, and a structured markdown file — after PRs are created. The output is displayed on the local web dashboard. Run this manually or as part of the `/feature` pipeline.

## Arguments

$ARGUMENTS: `"<feature title>" [--prs 101,102,103] [--scenario path/to/scenario.yml]`

Examples:
- `/feature-documentation "User authentication flow" --prs 101,102,103`
- `/feature-documentation "Checkout redesign" --prs 88`
- `/feature-documentation "Dark mode support" --scenario scenarios/dark-mode.yml`

If no arguments provided, ask the user for the feature title and relevant PR numbers.

## Steps

### 1. Gather context

Read PR descriptions, diffs, and related issues to understand the feature.

```bash
# If --prs provided, read each PR
for PR in <pr-numbers>; do
  gh pr view $PR
  gh pr diff $PR --name-only
done
```

If no `--prs` provided, attempt to detect them:
```bash
# Check .claude/issue for current issue number
ISSUE=$(cat .claude/issue 2>/dev/null)
if [ -n "$ISSUE" ]; then
  gh pr list --search "closes #$ISSUE" --json number,title,state
fi
```

From the PR diffs, identify:
- **App type**: web, android, ios (look at file extensions and directory structure)
- **Changed UI components**: routes, pages, screens, components
- **User-facing behavior**: what the user sees and does

### 2. Generate slug and output directory

```bash
SLUG=$(echo "<feature-title>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
DATE=$(date +%Y-%m-%d)
DOC_DIR="docs/features/${DATE}-${SLUG}"
mkdir -p "${DOC_DIR}/screenshots"
```

### 3. Generate scenario (if not provided)

If `--scenario` was provided, read and validate it. Otherwise, auto-generate one.

Analyze the PR diffs to determine:
1. **Changed files** — identify UI components, routes, pages
2. **Entry point** — what URL or screen shows this feature
3. **Key interactions** — buttons, forms, state changes visible in the diff

Generate a scenario YAML:

```yaml
name: "Feature Demo - <title>"
app_type: "web"  # or android, ios
steps:
  - action: navigate
    url: "http://localhost:3000/<path-to-feature>"
    wait: 2000
    screenshot: "01-initial-state"
  - action: click
    selector: "[data-testid='key-element']"
    wait: 1000
    screenshot: "02-interaction"
  - action: wait
    duration: 1000
    screenshot: "03-result"
```

Write the scenario to the doc directory:
```bash
cat > "${DOC_DIR}/scenario.yml" << 'SCENARIO_EOF'
<generated scenario YAML>
SCENARIO_EOF
```

**Scenario generation rules:**
- Prefer `data-testid` selectors over CSS classes
- Include a `navigate` step first to reach the feature
- Add a screenshot step after each meaningful state change
- Keep scenarios under 10 steps — focus on the happy path
- If no UI changes are detected in the diffs (e.g., backend-only changes), skip video capture entirely and create text-only documentation

### 4. Trigger video capture

Check if the actions runner is available:

```bash
RUNNER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4800/api/health 2>/dev/null || echo "000")
```

If the runner is available (status 200), trigger the video-capture workflow:

```bash
RUN_ID=$(curl -s -X POST http://localhost:4800/api/runs \
  -H "Content-Type: application/json" \
  -d "{
    \"workflow\": \"video-capture\",
    \"inputs\": {
      \"scenario\": \"${DOC_DIR}/scenario.yml\",
      \"output_dir\": \"${DOC_DIR}\",
      \"video_file\": \"demo.mp4\",
      \"screenshot_dir\": \"screenshots\"
    }
  }" | jq -r '.id')

echo "Run started: $RUN_ID"
```

Poll for completion:

```bash
while true; do
  STATUS=$(curl -s http://localhost:4800/api/runs/${RUN_ID} | jq -r '.status')
  case "$STATUS" in
    "completed") echo "Video capture complete"; break ;;
    "failed") echo "Video capture failed"; break ;;
    *) sleep 5 ;;
  esac
done
```

Collect artifacts:

```bash
# Verify artifacts exist
ls -la "${DOC_DIR}/demo.mp4" 2>/dev/null
ls -la "${DOC_DIR}/screenshots/"*.png 2>/dev/null
```

**Graceful degradation:**
- If runner is not running (status 000 or non-200) → skip video capture, create text-only docs
- If video capture fails → create docs without video, note the failure in `feature.md`
- If artifacts are missing → list what was captured and what was not

### 5. Generate feature documentation

Build the screenshot list from what actually exists:

```bash
SCREENSHOTS=""
for img in "${DOC_DIR}/screenshots/"*.png; do
  [ -f "$img" ] && SCREENSHOTS="${SCREENSHOTS}\n  - \"./screenshots/$(basename $img)\""
done
```

Build the PR table from gathered context:

```bash
PR_TABLE=""
for PR in <pr-numbers>; do
  TITLE=$(gh pr view $PR --json title -q '.title')
  STATE=$(gh pr view $PR --json state -q '.state')
  REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
  PR_TABLE="${PR_TABLE}\n| #${PR} | ${TITLE} | ${STATE} |"
done
```

Write `feature.md`:

```bash
cat > "${DOC_DIR}/feature.md" << 'DOC_EOF'
---
title: "<Feature Title>"
slug: "<feature-slug>"
date: "<YYYY-MM-DD>"
status: "review"
prs:
  - number: <pr-number>
    title: "<PR title>"
    repo: "<owner/repo>"
    status: "<open|merged|closed>"
video: "./demo.mp4"
screenshots:
  - "./screenshots/01-initial-state.png"
  - "./screenshots/02-interaction.png"
  - "./screenshots/03-result.png"
---

## Summary

<Auto-generated 2-3 sentence summary of what this feature does, derived from PR descriptions and diffs>

## What Changed

<Bullet points of key changes across all PRs>

## Demo

Video: [Watch demo](./demo.mp4)

### Screenshots

| Step | Screenshot |
|------|-----------|
| Initial state | ![](./screenshots/01-initial-state.png) |
| User interaction | ![](./screenshots/02-interaction.png) |
| Result | ![](./screenshots/03-result.png) |

## Pull Requests

| PR | Title | Status |
|----|-------|--------|
| #101 | PR title here | Open |
DOC_EOF
```

**Frontmatter rules:**
- `status` is always `"review"` when first generated
- `video` field is omitted if video capture was skipped or failed
- `screenshots` list only includes files that actually exist on disk
- `prs` list is built from the actual PR data, not hardcoded

**Content rules:**
- Summary is 2-3 sentences derived from reading the PR descriptions and diffs
- "What Changed" is a bullet list of key changes, grouped by area (backend, frontend, etc.)
- Screenshot table only includes rows for screenshots that exist
- If video was not captured, replace the Demo section with a note explaining why

### 6. Update tracking

Comment on related issues and PRs with a link to the feature documentation:

```bash
# Comment on each PR
for PR in <pr-numbers>; do
  gh pr comment $PR --body "### Feature Documentation

Documentation generated: \`${DOC_DIR}/feature.md\`
Dashboard: http://localhost:3000/features/${SLUG}

View the feature demo and screenshots in the documentation directory."
done

# Comment on the issue if one exists
ISSUE=$(cat .claude/issue 2>/dev/null)
if [ -n "$ISSUE" ]; then
  gh issue comment $ISSUE --body "### Feature Documentation

Documentation generated: \`${DOC_DIR}/feature.md\`
Dashboard: http://localhost:3000/features/${SLUG}

Includes: <video | screenshots | text-only> documentation."
fi
```

### 7. Report

Output a summary:

```
## Feature Documentation Generated

**Feature**: <title>
**Directory**: <DOC_DIR>/
**Dashboard**: http://localhost:3000/features/<slug>

### Artifacts
- feature.md: ✅
- demo.mp4: ✅ / ⏭️ Skipped (runner unavailable) / ❌ Failed
- Screenshots: <count> captured

### Pull Requests
| PR | Title | Status |
|----|-------|--------|
| #101 | ... | Open |

**Next steps:**
- Review the documentation at the dashboard URL
- Update status from "review" to "published" when approved
- Run `/bugfix-evidence` for any related bug fixes
```

## Platform-Specific Scenarios

### Web (Playwright-based)

Scenario steps use standard web selectors:
- `navigate` with URL
- `click`, `type`, `select` with CSS selectors (prefer `data-testid`)
- `wait` for animations or async loads
- `screenshot` after each significant step

### Android

Scenario steps use Android UI Automator selectors:
- `launch` with package name
- `tap` with resource ID or text
- `scroll` with direction
- `screenshot` after each significant step

### iOS

Scenario steps use XCUITest selectors:
- `launch` with bundle ID
- `tap` with accessibility identifier or label
- `swipe` with direction
- `screenshot` after each significant step

## Bugfix Evidence Variant

For simpler bug fix documentation, use `/bugfix-evidence` instead. It captures before/after screenshots without video, producing a minimal evidence document showing the bug and the fix side by side.

## Important

- The feature doc directory structure must match `docs/features/YYYY-MM-DD-{slug}/` exactly — the Next.js dashboard parses this path
- Frontmatter in `feature.md` must be valid YAML — the dashboard uses gray-matter to parse it
- Never block on video capture failure — always produce at least a text-only doc
- Screenshots must be numbered with zero-padded two-digit prefixes (`01-`, `02-`, etc.) for correct ordering
- Scenario YAML is always written to the doc directory even if provided via `--scenario` (copy it in)
- The `status` field in frontmatter controls dashboard visibility: `"review"` (default), `"published"`, `"archived"`
- Do not hardcode PR data — always read it live from GitHub via `gh`
- If no UI changes are detected across all PRs, create text-only documentation and note "No UI changes" in the summary
- Keep the generated summary factual and derived from the actual code changes — do not embellish
