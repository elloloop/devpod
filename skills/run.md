# Run — Execute Issues in Parallel

Automatically execute a wave of issues in parallel using sub-agents in isolated worktrees. Each agent works on one issue independently. The append-only architecture guarantees zero conflicts.

## Arguments

$ARGUMENTS: root issue number, or `next` to auto-detect the next wave.
- `/run 100` → read issue #100's tracking table, execute the next unblocked wave
- `/run 100 wave 2` → execute specifically wave 2

## Steps

### 1. Read the root issue

```bash
gh issue view <number> --comments
```

Parse the tracking table from the root issue comments. Identify:
- All sub-issues and their status
- Which wave each belongs to
- Dependencies between issues
- Which issues are already completed (have PRs merged)

### 2. Determine the next wave

Find the next wave where:
- All dependencies (previous waves) are completed and merged to main
- Issues in this wave are not yet started or in progress

If a wave is partially complete (some issues done, some not), only run the remaining ones.

### 3. Verify prerequisites

Before running a wave:
- Check that all dependency issues have merged PRs: `gh pr list --state merged --search "closes #<dep-issue>"`
- Pull latest main: `git checkout main && git pull`
- Verify generated code exists if this wave depends on contracts: `ls gen/`

If prerequisites aren't met, tell the user what's still pending and stop.

### 4. Launch parallel agents

For each issue in the wave, launch a sub-agent using the Agent tool with `isolation: "worktree"`. Each agent gets:
- Its own isolated copy of the repo (git worktree)
- The full issue context
- Instructions to run the appropriate ship command

**Determine the right ship command** from the issue title prefix:
- `[Contract]` → run `/contract` workflow (define proto, generate, commit)
- `[Backend]` → run `/backend-ship <issue-number>` workflow
- `[Web]` → run `/web-ship <issue-number>` workflow
- `[Flutter]` → run `/flutter-ship <issue-number>` workflow
- `[Scaffold]` → run the appropriate `/init` commands

**Agent prompt template:**

For each issue, spawn an agent with this prompt:
```
You are working on GitHub issue #<number>.

Read the issue first:
  gh issue view <number>

Read ALL comments on the issue (they contain the contract spec and context):
  gh issue view <number> --comments

The issue contains:
- A context chain explaining the full feature
- A contract spec (if applicable) with RPCs and generated code paths
- Acceptance criteria
- Scope rules — you may ONLY modify files in your module/feature directory

Based on the issue title:
- [Contract] → Define the proto contract. Create/update proto files, run buf lint, buf generate, commit, create PR.
- [Backend] → Implement the backend module. Create the module directory under modules/, implement against generated types in gen/, write tests, run them, create PR.
- [Web] → Implement the web feature. Create the feature directory under app/(features)/ or features/, implement against generated types in gen/ts/, write Playwright tests, run them, create PR.
- [Flutter] → Implement the Flutter feature. Create the feature directory under lib/features/, implement against generated types in gen/dart/, write tests, run them, create PR.
- [Scaffold] → Set up project structure using the init commands.

CRITICAL SCOPE RULES:
- ONLY create/modify files inside your module/feature directory
- ONLY import from core/ and gen/
- NEVER modify core/ files
- NEVER import from other modules/features
- If you need something that doesn't exist, STOP and comment on the issue explaining what you need. Do NOT create workarounds.

After implementation, BEFORE committing:

SELF-REVIEW — Read through ALL the code you wrote and ask yourself:
"Would a principal software engineer approve this?"

CODE QUALITY REQUIREMENTS:
- SOLID: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- DRY: No duplicated logic. But don't over-abstract — three similar lines beats a premature abstraction.
- Readable: Code reads like prose. Short functions. Shallow nesting. No clever tricks.
- Maintainable: Clear naming. No dead code. Comments explain WHY not WHAT.

Check for:
- Security: injection, auth bypass, secrets in code, unsafe deserialization
- Error handling: are errors handled or silently swallowed? Are edge cases covered?
- Performance: N+1 queries, unbounded loops, missing pagination, loading too much into memory
- Correctness: race conditions, off-by-one, null/nil handling, missing validation at boundaries, idempotency
- Design: is the code simple and direct? Any unnecessary abstraction? Any god functions?
- Naming: are names clear and accurate? Would a new engineer understand this without explanation?

TEST COVERAGE (all four levels required):
- Unit tests: every public function, edge cases, fast, isolated
- Behavior tests: test WHAT not HOW, survive refactoring
- Integration tests: real DB, real gRPC, real dependencies
- E2E tests: critical user journeys, Playwright for web, integration_test for Flutter

If you find issues, FIX THEM before proceeding. Comment on the issue with what you found and fixed.

Then:
1. Run tests and make sure they pass
2. Verify test existence — this is a HARD GATE:
   a. Count new source files vs new test files: `git diff main...HEAD --name-only`
   b. If you wrote source files but ZERO test files → STOP. Write tests before proceeding.
   c. Verify every new public function/endpoint/handler has a corresponding test
   d. Run `git diff main...HEAD --name-only | grep -E '_test\.|test_|\.test\.|\.spec\.'` — if empty, you are not done
3. Re-run tests after writing any missing tests
4. Commit your changes
5. Rebase on origin/main
6. Push your branch
7. Create a PR with "Closes #<number>" in the body
8. Comment on the issue with results including the self-review AND the test verification output:
   - Number of source files changed
   - Number of test files changed
   - Test suite exit code
   - List of test files added

Also comment on the parent issue #<parent-number>:
  gh issue comment <parent-number> --body "### Update: #<number> (<component>)
  Status: ✅ Complete — PR #<pr> ready for review"
```

Launch ALL agents in the wave simultaneously using the Agent tool with `isolation: "worktree"`. Run them in the background so they execute in parallel.

### 5. Wait for agents and verify test coverage

As agents complete, collect their results:
- Did they succeed or fail?
- What PRs were created?
- Were there any blockers?

For each completed agent, verify test coverage on its branch:

```bash
# For each PR branch created by an agent:
git fetch origin <branch>
SOURCE_COUNT=$(git diff main..origin/<branch> --name-only | grep -v '_test\.\|test_\|\.test\.\|\.spec\.\|__tests__\|/tests/\|/test/\|gen/\|\.config\.\|\.json$\|\.yaml$\|\.yml$\|\.md$\|\.mod$\|\.sum$\|\.lock$\|\.toml$' | wc -l)
TEST_COUNT=$(git diff main..origin/<branch> --name-only | grep -E '_test\.|test_|\.test\.|\.spec\.|__tests__|/tests/|/test/' | wc -l)

echo "Agent #<number>: $SOURCE_COUNT source files, $TEST_COUNT test files"
```

**If any agent has source files > 0 and test files == 0:**
- Mark that agent as ❌ FAILED in the wave report
- Comment on the agent's issue: "Missing test coverage — source files were changed but no tests were added. This blocks merge."
- Do NOT mark the agent's issue as complete

### 6. Update root issue

After all agents in the wave complete:

```
gh issue comment <root> --body "### 🏁 Wave <N> Complete

| Issue | Component | Status | PR | Test Coverage |
|---|---|---|---|---|
| #<issue-1> | <type> | ✅ / ❌ | #<pr> | <src>/<test> files |
| #<issue-2> | <type> | ✅ / ❌ | #<pr> | <src>/<test> files |
| #<issue-3> | <type> | ✅ / ❌ | #<pr> | <src>/<test> files |

**Next**: <what to do next — merge PRs, run next wave, resolve blockers>

_Wave executed at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 7. Report

Tell the user:
- Which agents succeeded/failed
- Links to all PRs created
- If any agents hit blockers (called `/blocked`)
- What the next wave is and whether it can be run

If all succeeded, suggest:
- Review and merge the PRs
- Then run `/run <root> wave <N+1>` for the next wave

## Execution model

```
/run 100

Wave 0: [Scaffold] → 1 agent, sets up core
  ↓ merge to main

/run 100

Wave 1: [Contract] UserService, [Contract] PaymentService → 2 agents in parallel
  ↓ merge all to main

/run 100

Wave 2: [Backend] user, [Backend] payment, [Web] frontend → 3 agents in parallel
  ↓ merge all to main

Done.
```

## Important
- ALWAYS verify previous wave is merged before running next wave
- Each agent runs in an isolated worktree — they literally cannot see each other's changes
- If an agent fails, the others continue — failures are reported at the end
- Contract waves should be merged before component waves (components need gen/ code)
- Never auto-merge PRs — the user reviews first, then runs the next wave
