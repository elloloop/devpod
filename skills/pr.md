# Create Pull Request

Create a pull request linking the GitHub issue (or sub-issue), with test results and a clear description. Update the issue and parent issue with progress.

## Steps

### 1. Get context

- Read issue number from `.claude/issue`
- `gh issue view <number>` — get title, body, check if it references a parent issue
- Get the current branch name
- `git log main..HEAD --oneline` — all commits
- `git diff main...HEAD --stat` — changed files
- Check if branch is pushed

### 2. Detect parent issue

Look in the issue body for `Parent: #<number>`. If found, this is a sub-issue and we'll update the parent too.

### 3. Rebase on main

Always rebase before creating a PR. This ensures the branch has the latest contracts and avoids conflicts with other parallel work:

```bash
git fetch origin
git rebase origin/main
```

If there are conflicts, resolve them (prefer the incoming main changes for generated files in `gen/`). If conflicts are non-trivial, stop and ask the user.

After rebase, re-run the build and tests to make sure everything still works:
- Quick build check (don't need full test suite, just `build`)
- If build fails after rebase, fix before proceeding

### 4. Push branch

```bash
git push -u origin <branch-name> --force-with-lease
```

Use `--force-with-lease` (safe force push) since we rebased.

### 5. Create PR

Analyze ALL commits and draft a clear PR:

```bash
gh pr create --title "<concise title under 70 chars>" --body "$(cat <<'EOF'
## Summary

<2-4 bullet points describing the changes and why>

## Changes

<list of key files/areas changed>

## Contract

<if proto changes are included, list the RPCs affected>

## Test results

- **Lint**: ✅ / ❌ / Not run
- **Build**: ✅ / ❌ / Not run
- **Tests**: ✅ / ❌ / Not run
- **Docker E2E**: ✅ / ❌ / Not run

## Test plan

- [ ] <specific things to verify>

Closes #<issue-number>
EOF
)"
```

Fill in actual test results from this session. Include the Contract section only if proto files were changed.

### 6. Update the issue

```
gh issue comment <number> --body "### 📋 PR Created

PR: #<pr-number> — <pr-title>
Branch: \`<branch-name>\`
Changed files: <count>"
```

### 7. Update parent issue (if sub-issue)

If a parent issue was detected:
```
gh issue comment <parent-number> --body "### Update: #<number> (<component>)

PR created: #<pr-number>
Status: ready for review"
```

### 8. Report

Show PR URL. Suggest `/web-deploy`, `/backend-deploy`, or `/flutter-deploy` as next step depending on the project type.

## Important
- Always include `Closes #<issue-number>` in PR body
- Don't include AI attribution
- If this is a contract-only PR, note that dependent components can start after merge
- Review the diff before creating
