# Flutter — Build and Test Locally

Analyze, build, and run tests for a Flutter project. Update GitHub issue with results.

## Steps

### 0. Check for contract

If `.claude/issue` exists, read the issue and its comments. Look for a "Contract Ready" comment — this tells you what RPCs are available and where the Dart client types live (`gen/dart/`). Use these generated types to call the backend — never hand-write types the proto defines.

### 1. Get dependencies

```bash
flutter pub get
```

### 2. Code generation (if needed)

If `build.yaml` exists or `build_runner` is in dev_dependencies:
```bash
dart run build_runner build --delete-conflicting-outputs
```

### 3. Analyze

```bash
flutter analyze
```

Capture output. Don't fail on info-level, only errors and warnings.

### 4. Run unit & widget tests

```bash
flutter test --reporter expanded
```

Capture pass/fail counts from output.

### 5. Run integration tests (if available)

If `integration_test/` directory exists:
```bash
flutter test integration_test --reporter expanded
```

On CI/headless, these may need a virtual display. If they fail due to no device, note it and move on.

### 6. Update GitHub issue

Read issue number from `.claude/issue`. If it exists:

```
gh issue comment <number> --body "### 📱 Flutter — Local Dev Results

**Analyze**: ✅ No issues / ⚠️ X warnings / ❌ X errors
**Unit/Widget tests**: ✅ X passed / ❌ X failed, Y passed
**Integration tests**: ✅ X passed / ⏭️ Skipped (no device) / ❌ Failed

<details>
<summary>Test output</summary>

\`\`\`
<last 50 lines>
\`\`\`
</details>

_Run at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 7. Report

Summarize. If passed, suggest `/flutter-build` or `/pr`. If failed, offer to fix.
