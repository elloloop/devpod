# Flutter — Deploy

Deploy Flutter app to staging / test channels. Update GitHub issue.

## Arguments

$ARGUMENTS specifies target. Default: detect from config.
- `/flutter-deploy web` → deploy web build to hosting
- `/flutter-deploy android` → upload to Play Console internal track
- `/flutter-deploy ios` → upload to TestFlight
- `/flutter-deploy firebase` → deploy web to Firebase Hosting

## Steps

### 1. Build first

Ensure release build exists for the target. If not, build it.

### 2. Deploy based on target

**Web → Vercel/Firebase/Netlify:**
```bash
# Firebase
firebase deploy --only hosting

# Vercel
cd build/web && vercel deploy

# Netlify
netlify deploy --dir=build/web --prod
```

**Android → Play Console (internal track):**
```bash
# Using fastlane if configured
cd android && fastlane internal

# Or direct upload
# Advise user to upload build/app/outputs/bundle/release/app-release.aab manually
```

**iOS → TestFlight:**
```bash
# Using fastlane if configured
cd ios && fastlane beta

# Otherwise advise user to use Xcode
```

If no deployment platform is configured, ask the user.

### 3. Verify

- **Web**: curl the deployment URL
- **Mobile**: confirm upload succeeded from command output

### 4. Update GitHub issue

```
gh issue comment <number> --body "### 🚀 Flutter — Deployment

**Target**: <target>
**URL/Channel**: <url or channel name>
**Status**: ✅ Deployed / ❌ Failed

_Deployed at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

### 5. Report

Show deployment details. If web, show URL. If mobile, show where to find the build.
