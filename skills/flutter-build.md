# Flutter — Build Artifacts

Build release artifacts for the Flutter project. Update GitHub issue.

## Arguments

$ARGUMENTS specifies the target. Default is all available.
- `/flutter-build` → build all configured platforms
- `/flutter-build apk`
- `/flutter-build ios`
- `/flutter-build web`
- `/flutter-build appbundle`

## Steps

### 1. Determine targets

If argument provided, build that target. Otherwise detect from `pubspec.yaml` and platform directories:
- `android/` exists → build APK
- `ios/` exists → build iOS (no codesign)
- `web/` exists → build web
- `linux/` exists → build linux

### 2. Build each target

**APK:**
```bash
flutter build apk --release
```

**App Bundle:**
```bash
flutter build appbundle --release
```

**iOS:**
```bash
flutter build ios --release --no-codesign
```

**Web:**
```bash
flutter build web --release
```

Capture build output, note file sizes and output paths.

### 3. Update GitHub issue

```
gh issue comment <number> --body "### 📦 Flutter — Build Results

| Target | Status | Size | Output |
|---|---|---|---|
| APK | ✅ / ❌ | X MB | \`build/app/outputs/flutter-apk/app-release.apk\` |
| Web | ✅ / ❌ | X MB | \`build/web/\` |
| iOS | ✅ / ❌ | — | \`build/ios/\` |

_Built at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 4. Report

Show build results and artifact paths. Suggest `/pr` to create a pull request.
