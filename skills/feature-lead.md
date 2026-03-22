# Feature Lead — Orchestrate Parallel Feature Development

Top-level orchestrator for feature development. Takes a feature description and coordinates the full lifecycle: decomposition into components, parallel agent execution across frontend/backend/infra, CI, video capture, documentation, and tracking. A developer runs `/feature-lead "description"` and everything else happens automatically.

## Arguments

$ARGUMENTS: feature description in natural language.

Examples:
- `/feature-lead "Add user authentication with OAuth"`
- `/feature-lead "Real-time collaboration on training configs"`
- `/feature-lead "GPU usage dashboard with cost breakdown"`

If no arguments provided, ask the user to describe the feature.

## Phase 1: Analyze and Decompose the Feature

### 1. Determine the repo context

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
```

### 2. Scan the existing codebase

Understand what already exists before designing anything:

```bash
# Contracts
ls proto/*.proto 2>/dev/null

# Backend modules
ls modules/ 2>/dev/null || ls src/modules/ 2>/dev/null

# Web features
ls -d src/app/\(features\)/*/ 2>/dev/null || ls -d features/*/ 2>/dev/null

# Infra / platform
ls platform/ 2>/dev/null
ls -d .github/workflows/*.yml 2>/dev/null

# Generated code
ls gen/ 2>/dev/null
```

### 3. Decompose the feature

Break the feature into components. For each, determine:

| Field | Description |
|---|---|
| **Component** | Short name (e.g., `auth-api`, `login-ui`, `oauth-config`) |
| **Layer** | `backend`, `frontend`, `infra`, `contract`, `worker` |
| **Directory** | Where the code will live (must be isolated — different directory per component) |
| **Dependencies** | Which other components must finish first |
| **Ship command** | Which `/ship` skill to use (`/backend-ship`, `/web-ship`, etc.) |

### 4. Build the dependency graph

Determine execution waves based on dependencies:

```
Feature: "Add user authentication with OAuth"

Wave 1 (parallel — no dependencies):
  - [Backend] Auth API endpoints       → modules/auth/
  - [Infra] OAuth provider config      → platform/auth/

Wave 2 (depends on Wave 1):
  - [Frontend] Login/signup UI         → features/auth/
```

Rules:
- Contracts always go in the earliest wave
- Backend and infra with no cross-dependencies can be parallel
- Frontend typically depends on backend contracts being available
- Two components touching the SAME directory must be sequential
- Two components touching DIFFERENT directories can be parallel

### 5. Generate the feature slug and date

```bash
FEATURE_DATE=$(date +%Y-%m-%d)
FEATURE_SLUG=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | head -c 60)
FEATURE_DIR="docs/features/${FEATURE_DATE}-${FEATURE_SLUG}"
```

## Phase 2: Create Feature Tracking Issue

### 1. Create the root feature issue

```bash
FEATURE_ISSUE=$(gh issue create \
  --title "Feature: $ARGUMENTS" \
  --body "$(cat <<'ISSUE_EOF'
## Feature

<one-paragraph description of the feature, who it's for, and why it matters>

## Components

| # | Component | Layer | Directory | Depends on | Ship command |
|---|---|---|---|---|---|
| 1 | <name> | backend | <dir> | — | /backend-ship |
| 2 | <name> | infra | <dir> | — | — |
| 3 | <name> | frontend | <dir> | #1 | /web-ship |

## Dependency Graph

```
Wave 1 (parallel): #1 (backend) + #2 (infra)
Wave 2 (depends on wave 1): #3 (frontend)
```

## Acceptance Criteria

- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Feature Documentation

Path: `<FEATURE_DIR>/feature.md`

## Progress

_Updated automatically as sub-issues complete._
ISSUE_EOF
)" --assignee @me --label feature | grep -o '[0-9]*$')
```

Save to `.claude/issue`:
```bash
echo "$FEATURE_ISSUE" > .claude/issue
```

## Phase 3: Create Sub-Issues

For each component identified in Phase 1, create a sub-issue. Each sub-issue carries the full context chain but has NO knowledge of sibling issues.

### For each component:

```bash
SUB_ISSUE=$(gh issue create \
  --title "[<Layer>] <component-name>" \
  --body "$(cat <<'SUB_EOF'
## Context Chain

### Feature: #<FEATURE_ISSUE> — <feature-title>
<full feature description from the root issue>

---

## Task: Implement <component-name>

<what this component does, extracted from the feature description>

### Requirements
<only the requirements relevant to THIS component>

### Directory scope
This component lives in `<directory>/`. You may ONLY create/modify files inside this directory.

### Contract dependency
<if applicable: which proto contract to implement against, where generated types live>
<if no contract: "No contract dependency — this is a standalone component.">

### Acceptance criteria
- [ ] <component-specific criterion 1>
- [ ] <component-specific criterion 2>
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] PR created

### How to start
1. Run `/<layer>-ship <this-issue-number>` for the full pipeline

Parent: #<FEATURE_ISSUE>
SUB_EOF
)" --assignee @me | grep -o '[0-9]*$')
```

After creating each sub-issue, comment on the feature issue:

```bash
gh issue comment $FEATURE_ISSUE --body "Sub-issue created: #$SUB_ISSUE — [<Layer>] <component-name>"
```

### Update feature issue with tracking table

After ALL sub-issues are created:

```bash
gh issue comment $FEATURE_ISSUE --body "$(cat <<'TABLE_EOF'
### Feature Decomposition Complete

## Wave 1 (parallel)
| Issue | Component | Layer | Status |
|---|---|---|---|
| #<sub-1> | <name> | backend | Not started |
| #<sub-2> | <name> | infra | Not started |

## Wave 2 (depends on wave 1)
| Issue | Component | Layer | Depends on | Status |
|---|---|---|---|---|
| #<sub-3> | <name> | frontend | #<sub-1> | Blocked |

---

### Execution plan
Each wave runs in parallel using sub-agents in isolated worktrees.
Wave 2 starts only after all Wave 1 PRs are merged to main.
TABLE_EOF
)"
```

## Phase 4: Execute Waves

Execute each wave sequentially. Within a wave, all issues run in parallel.

### For each wave:

#### 1. Verify prerequisites

If this is not Wave 1, check that all dependency issues have merged PRs:

```bash
for DEP_ISSUE in <dependency-issue-numbers>; do
  gh pr list --state merged --search "closes #$DEP_ISSUE" | head -1
done
git checkout main && git pull
```

If any dependency is not merged, STOP and report which are still pending.

#### 2. Launch parallel agents

For each issue in the wave, launch a sub-agent using the Agent tool with `isolation: "worktree"`. Each agent gets its own isolated copy of the repo.

**Determine the ship command** from the issue title prefix:
- `[Backend]` → `/backend-ship <issue-number>`
- `[Frontend]` or `[Web]` → `/web-ship <issue-number>`
- `[Infra]` → execute infra-specific steps (no ship skill — build config, write terraform/compose, test, PR)
- `[Contract]` → `/contract` workflow
- `[Worker]` → `/backend-ship <issue-number>` (workers follow backend pipeline)

**Agent prompt template:**

For each issue, spawn an agent with this prompt:
```
You are working on GitHub issue #<number>.

Read the issue first:
  gh issue view <number>
  gh issue view <number> --comments

The issue contains a context chain explaining the full feature and your specific task.

Based on the issue title prefix:
- [Backend] → Run /backend-ship <number>
- [Web] / [Frontend] → Run /web-ship <number>
- [Infra] → Implement the infrastructure component. Create/modify files ONLY in the specified directory. Write tests. Create a PR with "Closes #<number>".
- [Contract] → Run /contract to define the proto, then create PR.

SCOPE RULES:
- ONLY create/modify files inside your assigned directory
- ONLY import from core/ and gen/
- NEVER modify core/ files
- NEVER import from other modules/features

After implementation:
1. Self-review: read every file you changed. Fix security, error handling, performance, correctness issues.
2. Verify tests exist: git diff main...HEAD --name-only | grep -E '_test\.|\.test\.|\.spec\.'
   If source files > 0 and test files == 0 → STOP and write tests.
3. Run all tests — they must pass.
4. Rebase on origin/main.
5. Push branch and create PR with "Closes #<number>" in the body.
6. Comment on parent issue #<FEATURE_ISSUE>:
   gh issue comment <FEATURE_ISSUE> --body "### Update: #<number> (<component>)
   Status: Complete — PR #<pr> ready for review"
```

Launch ALL agents in the wave simultaneously using the Agent tool with `isolation: "worktree"`.

#### 3. Collect results

As agents complete, collect:
- Did they succeed or fail?
- What PRs were created?
- Were there any blockers?

For each completed agent, verify test coverage:

```bash
git fetch origin <branch>
SOURCE_COUNT=$(git diff main..origin/<branch> --name-only | grep -v '_test\.\|test_\|\.test\.\|\.spec\.\|__tests__\|/tests/\|/test/\|gen/\|\.config\.\|\.json$\|\.yaml$\|\.yml$\|\.md$\|\.mod$\|\.sum$\|\.lock$\|\.toml$' | wc -l)
TEST_COUNT=$(git diff main..origin/<branch> --name-only | grep -E '_test\.|test_|\.test\.|\.spec\.|__tests__|/tests/|/test/' | wc -l)
echo "Agent #<number>: $SOURCE_COUNT source files, $TEST_COUNT test files"
```

**If any agent has source files > 0 and test files == 0:**
- Mark that agent as FAILED in the wave report
- Comment on the agent's issue: "Missing test coverage — source files were changed but no tests were added. This blocks merge."
- Do NOT mark the agent's issue as complete

#### 4. Update feature issue

After all agents in the wave complete:

```bash
gh issue comment $FEATURE_ISSUE --body "$(cat <<'WAVE_EOF'
### Wave <N> Complete

| Issue | Component | Layer | Status | PR | Test Coverage |
|---|---|---|---|---|---|
| #<issue-1> | <name> | <layer> | <pass/fail> | #<pr> | <src>/<test> files |
| #<issue-2> | <name> | <layer> | <pass/fail> | #<pr> | <src>/<test> files |

**Next**: <merge PRs and proceed to wave N+1, or resolve failures>
WAVE_EOF
)"
```

#### 5. If more waves remain

After the user merges wave N PRs, proceed to wave N+1. Repeat from step 1 of this phase.

If the user has not merged yet, prompt them:
```
Wave <N> PRs are ready for review:
- #<pr-1>: [Backend] <name>
- #<pr-2>: [Infra] <name>

Merge these PRs, then I'll proceed with Wave <N+1>.
```

## Phase 5: Trigger Local CI

After all waves are complete and PRs are created, trigger CI via the local runner:

### 1. Trigger workflow runs

```bash
# For each PR branch, trigger CI
for BRANCH in <pr-branches>; do
  RUN_ID=$(curl -s -X POST http://localhost:4800/api/runs \
    -H "Content-Type: application/json" \
    -d "{\"workflow\": \".github/workflows/base.yml\", \"ref\": \"$BRANCH\"}" \
    | jq -r '.id')
  echo "Triggered run $RUN_ID for $BRANCH"
done
```

### 2. Poll for completion

```bash
STATUS=$(curl -s http://localhost:4800/api/runs/$RUN_ID | jq -r '.status')
CONCLUSION=$(curl -s http://localhost:4800/api/runs/$RUN_ID | jq -r '.conclusion')
```

Poll until status is `completed`. If conclusion is `failure`, report which jobs failed but continue — CI failure does not block documentation.

## Phase 6: Generate Feature Video

Trigger the video-capture action to record a demo of the feature working end-to-end.

### 1. Create a video capture scenario

Write a scenario file for the video-capture action based on the feature's acceptance criteria:

```bash
mkdir -p /tmp/feature-video
cat > /tmp/feature-video/scenario.json <<'SCENARIO_EOF'
{
  "name": "<feature-slug>-demo",
  "description": "Demo of <feature title>",
  "platform": "web",
  "quality": "high",
  "steps": [
    {"action": "navigate", "url": "<app-url>"},
    {"action": "screenshot", "name": "landing"},
    <additional steps based on acceptance criteria>,
    {"action": "screenshot", "name": "result"}
  ]
}
SCENARIO_EOF
```

### 2. Trigger video capture via local runner

```bash
VIDEO_RUN_ID=$(curl -s -X POST http://localhost:4800/api/runs \
  -H "Content-Type: application/json" \
  -d "{\"workflow\": \".github/workflows/video-capture.yml\", \"ref\": \"main\", \"inputs\": {\"scenario\": \"$(cat /tmp/feature-video/scenario.json | jq -c .)\", \"feature_slug\": \"$FEATURE_SLUG\"}}" \
  | jq -r '.id')
```

### 3. Poll for video completion

```bash
VIDEO_STATUS=$(curl -s http://localhost:4800/api/runs/$VIDEO_RUN_ID | jq -r '.status')
```

Poll until complete. If video capture fails, log the failure and continue without video — documentation is still created.

### 4. Collect artifacts

```bash
# List artifacts from the video capture run
curl -s http://localhost:4800/api/runs/$VIDEO_RUN_ID/artifacts | jq -r '.[] | .path'
```

Copy artifacts to the feature documentation directory if available.

## Phase 7: Create Feature Documentation

Create the feature documentation directory and files regardless of whether video capture succeeded.

### 1. Create directory structure

```bash
mkdir -p "$FEATURE_DIR/screenshots"
```

### 2. Write feature.md

```bash
cat > "$FEATURE_DIR/feature.md" <<'DOC_EOF'
---
title: "<Feature Title>"
slug: "<feature-slug>"
date: "<FEATURE_DATE>"
status: "review"
prs:
  - number: <pr-1-number>
    title: "[<Layer>] <component-name>"
    repo: "<REPO>"
    status: "open"
  - number: <pr-2-number>
    title: "[<Layer>] <component-name>"
    repo: "<REPO>"
    status: "open"
video: "./demo.mp4"
screenshots:
  - "./screenshots/<name-1>.png"
  - "./screenshots/<name-2>.png"
---

## Description
<Feature description from the developer's input — expanded with implementation details>

## Components

### <Layer> — <Component Name> (#<issue>)
<Summary of what this component does and the key changes>

### <Layer> — <Component Name> (#<issue>)
<Summary of what this component does and the key changes>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>
DOC_EOF
```

Populate the frontmatter `prs` list from the actual PRs created during execution. Populate the `components` sections by reading each PR's diff summary. Set `video` and `screenshots` fields only if artifacts were successfully collected — omit them if video capture failed.

### 3. Copy video and screenshots

If video capture produced artifacts:

```bash
cp /tmp/feature-video/demo.mp4 "$FEATURE_DIR/demo.mp4" 2>/dev/null
cp /tmp/feature-video/screenshots/*.png "$FEATURE_DIR/screenshots/" 2>/dev/null
```

If artifacts are not available, omit the `video` and `screenshots` fields from the frontmatter.

### 4. Commit documentation

```bash
git checkout main && git pull
git checkout -b "docs/${FEATURE_SLUG}"
git add "$FEATURE_DIR/"
git commit -m "Add feature documentation for ${FEATURE_SLUG}"
git push -u origin "docs/${FEATURE_SLUG}"
gh pr create \
  --title "Docs: $ARGUMENTS" \
  --body "$(cat <<'PR_EOF'
## Feature Documentation

Adds documentation for the feature: **<feature title>**

### Contents
- `feature.md` — feature spec, PR links, status
- `demo.mp4` — feature demo video (if captured)
- `screenshots/` — key screenshots (if captured)

### Related PRs
- #<pr-1>
- #<pr-2>

Closes #<FEATURE_ISSUE>
PR_EOF
)"
```

## Phase 8: Update Tracking

### 1. Comment on feature issue with final results

```bash
gh issue comment $FEATURE_ISSUE --body "$(cat <<'FINAL_EOF'
### Feature Complete

## Summary
| Component | Issue | PR | Status |
|---|---|---|---|
| <name> | #<sub-1> | #<pr-1> | <status> |
| <name> | #<sub-2> | #<pr-2> | <status> |
| <name> | #<sub-3> | #<pr-3> | <status> |

## CI
| Branch | Run | Conclusion |
|---|---|---|
| <branch-1> | <run-id> | <conclusion> |
| <branch-2> | <run-id> | <conclusion> |

## Video
<path to demo.mp4, or "Video capture failed — documentation created without video">

## Documentation
Path: `<FEATURE_DIR>/feature.md`
PR: #<docs-pr>

## Next steps
- [ ] Review and merge component PRs
- [ ] Review and merge documentation PR
- [ ] Verify feature end-to-end in staging
- [ ] Update feature status from "review" to "shipped"
FINAL_EOF
)"
```

### 2. Print summary to the developer

Report:
1. Feature issue link
2. All sub-issues with their PR links
3. CI run results
4. Video capture status
5. Feature documentation path
6. What to do next (review PRs, merge, verify)

## Error Handling

### Sub-issue agent failure
If an agent fails during a wave:
- Log the failure and the agent's error output
- Comment on the failed sub-issue with the error
- Comment on the feature issue marking the component as failed
- Continue executing other agents in the wave — do NOT abort the entire wave
- At wave completion, report which succeeded and which failed
- Offer to retry failed agents: "Agent for #<issue> failed. Run `/run <FEATURE_ISSUE>` to retry."

### CI failure
If CI fails for a PR:
- Report which jobs/steps failed
- Comment on the PR and the feature issue
- Continue with documentation — CI failure does not block docs

### Video capture failure
If video capture fails:
- Log the error
- Create feature documentation WITHOUT the `video` and `screenshots` fields
- Comment on the feature issue: "Video capture failed: <reason>. Documentation created without video."
- Suggest manual video recording as a follow-up

### Documentation failure
If documentation creation fails:
- Report the error
- The feature PRs and issues still stand — documentation is supplementary
- Suggest running the documentation step manually

### Partial feature completion
If some waves succeed but a later wave fails:
- All completed PRs remain open for review
- Feature issue tracking table reflects partial completion
- Developer can fix the failed component and re-run: `/run <FEATURE_ISSUE>`

## Important

- This skill is the ENTRY POINT — the developer provides a description and everything else is automated
- NEVER skip the decomposition step — always break features into isolated components
- NEVER create sub-issues that touch the same directory — if two components share a directory, make them sequential or merge them into one issue
- Every sub-issue must be completable by an agent reading ONLY that issue (full context chain, no sibling knowledge)
- Always create feature documentation even if some steps fail — partial docs are better than none
- Never auto-merge PRs — the developer reviews first
- Never deploy to production — stop at staging
- The feature issue is the ONLY place with full visibility into all sub-issues and their status
- Use the existing skill ecosystem: `/issue` for issues, `/run` for parallel execution, `/review` for code review, `/*-ship` for pipelines
- Rebase on main between waves — every branch must rebase before creating a PR
