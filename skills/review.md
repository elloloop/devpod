# Review — Principal Engineer Self-Review

Review all code written in this session as if you are a principal software engineer deciding whether to approve it. This is a blocking gate — if issues are found, they must be fixed before proceeding.

Run this automatically after writing code, or manually via `/review`.

## Steps

### 1. Identify all changes

```bash
git diff --name-only HEAD  # unstaged
git diff --cached --name-only  # staged
git diff main...HEAD --name-only  # all changes on this branch
```

### 2. Read every changed file

Read each file fully. For each file, evaluate against ALL the criteria below.

---

## SOLID Principles

### Single Responsibility
- [ ] Each class/struct/module has one reason to change
- [ ] Functions do one thing — if you need "and" to describe it, split it
- [ ] Files aren't kitchen sinks — related code is grouped, unrelated code is separated

### Open/Closed
- [ ] Existing code is extended, not modified (especially core/)
- [ ] New behavior is added through new types/implementations, not if/else chains
- [ ] Plugin points exist where variability is expected

### Liskov Substitution
- [ ] Subtypes/implementations are interchangeable with their base/interface
- [ ] Interface implementations don't throw "not implemented" for expected methods
- [ ] No type-checking switches (if type == X) — use polymorphism

### Interface Segregation
- [ ] Interfaces are small and focused — no god interfaces
- [ ] Consumers depend only on methods they use
- [ ] No unused dependencies or imports

### Dependency Inversion
- [ ] High-level modules don't import low-level modules — both depend on abstractions
- [ ] Dependencies are injected, not hardcoded (constructor/function params, not global state)
- [ ] External services (DB, API, filesystem) are behind interfaces for testability

---

## DRY (Don't Repeat Yourself)

- [ ] No duplicated logic — if the same logic appears in 2+ places, extract it
- [ ] No copy-pasted code blocks with minor variations
- [ ] Constants and config values defined once, not scattered
- [ ] BUT: don't over-abstract. Three similar lines is better than a premature abstraction. DRY applies to logic, not to code that happens to look similar but serves different purposes.

---

## Readability & Maintainability

- [ ] Code reads like prose — a new engineer can understand it without explanation
- [ ] Functions are short (under ~30 lines) — if longer, can it be split?
- [ ] Nesting depth is shallow (max 3 levels) — early returns over nested ifs
- [ ] No clever tricks — straightforward code over "elegant" code
- [ ] Comments explain WHY, not WHAT (the code shows what, comments show why)
- [ ] No abbreviations that require context (use `invoice` not `inv`, `user` not `usr`)
- [ ] Consistent style with the rest of the codebase
- [ ] No dead code, commented-out code, or TODO comments without issue references

---

## Security

- [ ] No SQL injection (parameterized queries only)
- [ ] No command injection (no shell exec with user input)
- [ ] No XSS (output is escaped/sanitized)
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] No unsafe deserialization
- [ ] Auth/authz checks present where needed
- [ ] Input validation at system boundaries (HTTP handlers, gRPC handlers)

## Error Handling

- [ ] Errors are handled, not silently swallowed
- [ ] Error messages include context (what was being done, what went wrong)
- [ ] Resources are cleaned up on error (connections, files, locks) — defer/finally/context managers
- [ ] Panics/crashes can't be triggered by bad input
- [ ] Errors from external systems (DB, network, filesystem) are wrapped with context

## Performance

- [ ] No N+1 query patterns
- [ ] No unbounded loops or recursion
- [ ] Lists/queries are paginated
- [ ] No loading entire tables/collections into memory
- [ ] No unnecessary allocations in hot paths
- [ ] Database queries use indexes (no full table scans on large tables)

## Correctness

- [ ] No race conditions (shared state is synchronized)
- [ ] No off-by-one errors
- [ ] Null/nil/undefined cases handled
- [ ] Edge cases: empty lists, zero values, max values, unicode, very long strings
- [ ] Timeouts on ALL external calls (HTTP, DB, gRPC)
- [ ] Idempotency where expected (retries don't cause duplicates)

---

## Test Coverage

All four levels of testing must be present where applicable:

### Unit Tests
- [ ] Every public function/method has unit tests
- [ ] Pure logic is tested in isolation (no DB, no network, no filesystem)
- [ ] Edge cases covered: empty input, nil/null, boundary values, error paths
- [ ] Each test tests ONE thing — test name describes the scenario
- [ ] Tests are fast (milliseconds, not seconds)

### Behavior Tests
- [ ] Key user-facing behaviors have behavior tests
- [ ] Tests describe WHAT the system does, not HOW it does it
- [ ] Tests survive refactoring — they don't break when implementation changes
- [ ] Named clearly: "should return 404 when invoice not found", not "test_get_invoice_2"

### Integration Tests
- [ ] Module interactions with real dependencies are tested (real DB, real gRPC calls)
- [ ] Database queries are tested against a real database (not mocked)
- [ ] API contracts are verified (request/response shapes match proto)
- [ ] Error scenarios with dependencies are tested (DB down, timeout, invalid response)

### End-to-End Tests
- [ ] Critical user journeys are covered (create → read → update → delete)
- [ ] For web: Playwright tests that navigate and interact like a real user
- [ ] For API: full request lifecycle tested through the actual server
- [ ] For Flutter: integration tests that launch the app and interact with UI
- [ ] Smoke tests tagged with `@smoke` for staging verification

### Test Quality
- [ ] Tests are deterministic — no flaky timing, no random data without seeds
- [ ] Tests clean up after themselves (no leftover DB records, files, etc.)
- [ ] Test helpers/fixtures exist for common setup — no copy-pasted setup code
- [ ] Assertions are specific ("status should be 404" not "status should not be 200")
- [ ] No testing implementation details (don't assert on internal state, mock call counts, etc.)

---

## Scope

- [ ] Only files within the assigned module/feature directory were modified
- [ ] Only imports from core/ and gen/ — no cross-module imports
- [ ] Generated code in gen/ was not hand-edited
- [ ] No modifications to frozen core/ files

---

### 3. Fix issues found

For each issue found:
1. Fix it immediately
2. Note what was found and fixed

### 4. Report

Output a summary:

```
## Principal Engineer Review

**Files reviewed**: <count>

### Issues found and fixed
- <file:line> — <what was wrong> → <how it was fixed>

### Checklist
- SOLID: ✅
- DRY: ✅
- Readability: ✅
- Security: ✅
- Error handling: ✅
- Performance: ✅
- Correctness: ✅
- Unit tests: ✅
- Behavior tests: ✅
- Integration tests: ✅
- E2E tests: ✅
- Scope: ✅

**Verdict**: ✅ Approved / ❌ Issues remain
```

If running as part of a ship pipeline, comment the review on the GitHub issue.

## Important
- This is NOT optional. Every piece of code must pass this review before commit.
- Be genuinely critical. A real principal engineer would reject sloppy code.
- Don't rubber-stamp — actually read every line.
- If something is borderline, fix it. The cost of fixing now is low.
- Missing test coverage is a rejection. Tests are not optional.
