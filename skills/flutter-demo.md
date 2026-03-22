# Flutter Demo — Simulator Video Recordings

Generate polished video recordings from an iOS Simulator (or Android emulator) that demonstrate a Flutter feature to end users. Videos are saved locally and a summary is presented for user approval before attaching to the PR or publishing.

## Arguments

`$ARGUMENTS` — describe the feature and optionally specify the target platform. Examples:

- `"cycle tracking calendar view"` — records on iOS Simulator (default)
- `"receipt scanning camera flow ios"` — records on iOS Simulator
- `"receipt scanning camera flow android"` — records on Android emulator

If no arguments given, infer from the current branch, recent commits, or ask the user. Default platform is **ios**.

## Steps

### 1. Understand the feature — think like a product demo

Read `git diff main...HEAD`, `git log main..HEAD --oneline`, and the relevant source files to understand every user-facing behavior the feature introduces.

Identify the **app path** — the Flutter app directory containing `lib/main.dart` and `pubspec.yaml`. This is the working directory for all Flutter commands.

Build a **demo script** — a sequence of user actions that tells the story of the feature. This is NOT a test — it's a walkthrough designed to show value to an end user or stakeholder.

**Demo script principles:**
- **Start from a relatable state** — show the screen as the user would first see it (loaded, with real-looking content)
- **One feature per scene** — don't cram everything into one continuous recording. Break into numbered scenes, each showing one capability.
- **Pause on key moments** — add `Future.delayed(Duration(seconds: 2))` after important visual changes so the viewer can absorb what happened
- **Show cause and effect** — for every interaction, show the state before AND after clearly
- **Cover device variations** — if the feature behaves differently on tablet vs phone, capture them as separate scenes
- **Show edge cases** — if the feature has interesting edge behavior (e.g., "empty state transitions to loaded state"), demonstrate it explicitly

Write out the full demo script as a numbered list before coding. Example:

```
Scene 1: "Calendar loads with current month"
- App launches, splash finishes
- Calendar grid visible with today highlighted
- Wait 2s to show the default state

Scene 2: "Tap a date to log an entry"
- Tap on a date cell
- Bottom sheet slides up with entry form
- Fill in a field, tap save
- Sheet dismisses, date cell shows indicator dot

Scene 3: "Swipe between months"
- Swipe left to next month
- Wait 1s, swipe right back
- Previous entries still visible

Scene 4: "Empty state for future month"
- Swipe far ahead to a month with no data
- Empty state illustration visible
- "No entries yet" message shown
```

### 2. Get script approval

**Present the demo script to the user and ask for approval before recording.** This is a hard gate — do not proceed to recording until the user confirms the script.

Ask:
```
Here's the demo script for "<feature name>":

<numbered scenes>

Does this cover everything you want to show? Any scenes to add, remove, or reorder?
```

Wait for the user to approve, modify, or reject.

### 3. Create output directory

```bash
APP_PATH="<path-to-flutter-app>"
FEATURE_NAME=$(echo "$ARGUMENTS" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/-\(ios\|android\)$//' | head -c 40)
DEMO_DIR="${APP_PATH}/demo-recordings/${FEATURE_NAME}-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEMO_DIR"
```

Add `demo-recordings/` to the app's `.gitignore` if not already present:
```bash
grep -q 'demo-recordings/' "${APP_PATH}/.gitignore" 2>/dev/null || echo 'demo-recordings/' >> "${APP_PATH}/.gitignore"
```

### 4. Write the integration test

Create `${APP_PATH}/integration_test/_feature_demo_test.dart` — one `testWidgets()` per scene from the approved script.

**Test design principles:**

1. **Import the app's main entry point** — use `import 'package:<app_package>/main.dart' as app;` to launch the real app
2. **Wait generously between actions** — `Future.delayed(Duration(seconds: 2))` after visual changes. These are demo videos, not speed tests.
3. **Pause for screenshots** — at key moments, print a marker line (`print('DEMO_SCREENSHOT: scene-01-initial')`) so the recording script can take timed screenshots
4. **The test must always PASS** — wrap risky finders in `try/catch` so the recording continues even if a widget isn't found
5. **Use `pumpAndSettle()` liberally** — ensure animations complete before screenshots
6. **Separate concerns** — each scene is its own `testWidgets` block

Example structure:
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:<app_package>/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Feature demo', () {
    testWidgets('Scene 1: Calendar loads with current month', (tester) async {
      app.main();
      await tester.pumpAndSettle();
      // Wait for content to render
      await Future.delayed(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      // Screenshot: initial calendar view
      print('DEMO_SCREENSHOT: scene-01-calendar-loaded');
      await Future.delayed(const Duration(seconds: 2));
    });

    testWidgets('Scene 2: Tap a date to log an entry', (tester) async {
      app.main();
      await tester.pumpAndSettle();
      await Future.delayed(const Duration(seconds: 2));
      await tester.pumpAndSettle();

      // Screenshot: before interaction
      print('DEMO_SCREENSHOT: scene-02-01-before-tap');
      await Future.delayed(const Duration(seconds: 1));

      // Tap a date cell
      try {
        final dateCell = find.text('15');
        if (dateCell.evaluate().isNotEmpty) {
          await tester.tap(dateCell.first);
          await tester.pumpAndSettle();
          await Future.delayed(const Duration(seconds: 2));

          // Screenshot: after interaction
          print('DEMO_SCREENSHOT: scene-02-02-entry-form');
        }
      } catch (_) {
        // Continue recording even if interaction fails
      }

      await Future.delayed(const Duration(seconds: 2));
    });
  });
}
```

**Important:** The test file name MUST start with `_` (underscore prefix) to signal it is temporary and will be deleted after recording.

Ensure the `integration_test` package is in `dev_dependencies`:
```bash
cd "$APP_PATH"
grep -q 'integration_test:' pubspec.yaml || flutter pub add --dev integration_test --sdk=flutter
```

### 5. Launch simulator and record

#### iOS Simulator (default)

```bash
# Boot the simulator if not already running
BOOTED=$(xcrun simctl list devices booted --json | python3 -c "
import json, sys
data = json.load(sys.stdin)
devices = [d for devs in data['devices'].values() for d in devs if d['state'] == 'Booted']
print(devices[0]['udid'] if devices else '')
" 2>/dev/null)

if [ -z "$BOOTED" ]; then
  # Find a suitable iPhone simulator
  DEVICE_UDID=$(xcrun simctl list devices available --json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for runtime, devices in data['devices'].items():
    if 'iOS' in runtime:
        for d in devices:
            if 'iPhone' in d['name'] and d['isAvailable']:
                print(d['udid'])
                sys.exit()
" 2>/dev/null)
  xcrun simctl boot "$DEVICE_UDID"
  # Wait for boot to complete
  sleep 5
  open -a Simulator
  sleep 3
fi

# Start recording
xcrun simctl io booted recordVideo --codec h264 "${DEMO_DIR}/demo-recording.mov" &
RECORD_PID=$!
sleep 2  # Let recording stabilize

# Run the integration test
cd "$APP_PATH"
flutter test integration_test/_feature_demo_test.dart --no-pub 2>&1 | tee "${DEMO_DIR}/test-output.log" || true

# Stop recording
kill -INT $RECORD_PID
wait $RECORD_PID 2>/dev/null
```

#### Android Emulator (when `android` is specified)

```bash
# Check for running emulator
ADB_DEVICE=$(adb devices | grep -v "List" | grep "device$" | head -1 | awk '{print $1}')

if [ -z "$ADB_DEVICE" ]; then
  # List available AVDs and boot the first one
  AVD_NAME=$(emulator -list-avds | head -1)
  if [ -n "$AVD_NAME" ]; then
    emulator -avd "$AVD_NAME" -no-snapshot-load &
    sleep 15  # Wait for emulator boot
    adb wait-for-device
    sleep 5
  else
    echo "ERROR: No Android emulator available. Create one with 'avdmanager' or Android Studio."
    exit 1
  fi
fi

# Start recording (Android limits to 180 seconds per recording)
adb shell screenrecord /sdcard/demo-recording.mp4 &
RECORD_PID=$!
sleep 2

# Run the integration test
cd "$APP_PATH"
flutter test integration_test/_feature_demo_test.dart --no-pub 2>&1 | tee "${DEMO_DIR}/test-output.log" || true

# Stop recording
adb shell kill -2 $(adb shell pgrep screenrecord)
wait $RECORD_PID 2>/dev/null
sleep 2

# Pull recording
adb pull /sdcard/demo-recording.mp4 "${DEMO_DIR}/demo-recording.mp4"
adb shell rm /sdcard/demo-recording.mp4
```

### 6. Capture per-scene screenshots

After the test completes, parse `test-output.log` for `DEMO_SCREENSHOT:` markers and take screenshots at the appropriate moments. Alternatively, capture screenshots during a second, slower pass:

#### iOS Simulator
```bash
# Take screenshots by re-reading the test output for scene markers
# Or capture key frames manually:
cd "$APP_PATH"

# Re-run individual scenes and screenshot between them
SCENE_NUM=1
for SCENE in $(grep 'DEMO_SCREENSHOT:' "${DEMO_DIR}/test-output.log" | sed 's/.*DEMO_SCREENSHOT: //'); do
  xcrun simctl io booted screenshot "${DEMO_DIR}/${SCENE}.png" 2>/dev/null
  SCENE_NUM=$((SCENE_NUM + 1))
done

# If no markers found, take a single screenshot of current state
if [ $SCENE_NUM -eq 1 ]; then
  xcrun simctl io booted screenshot "${DEMO_DIR}/scene-01-final-state.png"
fi
```

#### Android Emulator
```bash
SCENE_NUM=1
for SCENE in $(grep 'DEMO_SCREENSHOT:' "${DEMO_DIR}/test-output.log" | sed 's/.*DEMO_SCREENSHOT: //'); do
  adb shell screencap -p /sdcard/screenshot.png
  adb pull /sdcard/screenshot.png "${DEMO_DIR}/${SCENE}.png"
  adb shell rm /sdcard/screenshot.png
  SCENE_NUM=$((SCENE_NUM + 1))
done

if [ $SCENE_NUM -eq 1 ]; then
  adb shell screencap -p /sdcard/screenshot.png
  adb pull /sdcard/screenshot.png "${DEMO_DIR}/scene-01-final-state.png"
  adb shell rm /sdcard/screenshot.png
fi
```

**Better approach — screenshot within the test itself:**

For more reliable per-scene screenshots, use the `IntegrationTestWidgetsFlutterBinding` to take screenshots from within the test:

```dart
final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

testWidgets('Scene 1: ...', (tester) async {
  app.main();
  await tester.pumpAndSettle();
  await Future.delayed(const Duration(seconds: 2));
  await tester.pumpAndSettle();

  // In-test screenshot (saved to device gallery/files)
  await binding.takeScreenshot('scene-01-initial');
});
```

Then pull the screenshots from the device after the test finishes. The in-test approach is preferred because it captures the exact frame at the right moment, rather than relying on timing from an external process.

### 7. Verify recording quality

Before presenting to the user:

- **Check video file size** — if the video is under 100KB, it captured nothing useful
- **Check screenshot content** — read key screenshots and verify they show real content, not blank/loading states
- **Check scene count** — verify the expected number of scenes were captured (check test output for pass/fail counts)
- **Check test output** — ensure all tests passed and no scenes were skipped

```bash
# Check video
VIDEO_FILE="${DEMO_DIR}/demo-recording.mov"  # or .mp4 for Android
VIDEO_SIZE=$(stat -f%z "$VIDEO_FILE" 2>/dev/null || echo 0)
if [ "$VIDEO_SIZE" -lt 100000 ]; then
  echo "WARNING: Video is only $(($VIDEO_SIZE / 1024))KB — likely captured nothing useful"
fi

# Count screenshots
SCREENSHOT_COUNT=$(ls -1 "${DEMO_DIR}"/*.png 2>/dev/null | wc -l)
echo "Captured ${SCREENSHOT_COUNT} screenshots"

# Check test results
PASS_COUNT=$(grep -c "All tests passed\|Test passed" "${DEMO_DIR}/test-output.log" 2>/dev/null || echo 0)
FAIL_COUNT=$(grep -c "FAILED\|test failed" "${DEMO_DIR}/test-output.log" 2>/dev/null || echo 0)
echo "Tests: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
```

If quality is poor (empty screens, missing interactions), diagnose and re-run. Common issues:
- App didn't launch → check `main.dart` import path in the test
- Widget not found → check finder keys, maybe the widget renders differently
- Video too short → increase `Future.delayed` durations between actions
- Simulator not booted → run `xcrun simctl boot` and wait longer
- Android recording hit 180s limit → split into shorter scenes or reduce wait times

### 8. Clean up temp test

```bash
rm -f "${APP_PATH}/integration_test/_feature_demo_test.dart"
```

### 9. Present results for approval

Show the user:
- The captured screenshots (read the PNG files for visual display)
- List of video files with paths and sizes
- The demo script that was executed

Ask for approval:
```
Here are the feature demo recordings:

<show key screenshots from each scene>

Videos saved locally:
<list of video/screenshot files with sizes>

Are you happy with these? Should I:
- Re-record any scenes?
- Add more scenes?
- Attach these to the PR?
```

**Wait for user approval before proceeding.** Do not attach to PR without confirmation.

### 10. Attach to PR (if approved)

If the user approves and a PR exists:

```bash
PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null)
```

If a PR exists, add a comment with the demo info:

```bash
gh pr comment "$PR_NUMBER" --body "$(cat <<EOF
### Feature Demo

**Platform:** iOS Simulator / Android Emulator
**Scenes recorded:** $(grep -c 'testWidgets' "${DEMO_DIR}/test-output.log" 2>/dev/null || echo "N/A")

**Video:**
- \`$(basename "${DEMO_DIR}")/demo-recording.mov\` ($(ls -lh "${DEMO_DIR}/demo-recording.mov" 2>/dev/null | awk '{print $5}' || echo "N/A"))

**Screenshots** — drag-drop to embed:
$(for f in "${DEMO_DIR}"/*.png; do echo "- \`$(basename "$f")\`"; done)

> Videos and screenshots are in \`demo-recordings/\` (gitignored). Ask the author for files.
EOF
)"
```

If no PR exists, tell the user the demos are ready and will be attached when a PR is created.

### 11. Report

Display:
- Path to demo-recordings directory
- Total number of scenes and files
- Video duration (if determinable)
- Whether demos were attached to a PR
- Suggest: "Share these videos with stakeholders or embed screenshots in the PR description"

## Platform-Specific Notes

### iOS Simulator
- Video format: `.mov` (H.264 codec)
- Screenshot format: `.png`
- Recording command: `xcrun simctl io booted recordVideo --codec h264`
- Screenshot command: `xcrun simctl io booted screenshot`
- Stop recording: `kill -INT $PID`
- Requires macOS with Xcode and Simulator installed
- Simulator.app opens automatically if not already visible

### Android Emulator
- Video format: `.mp4`
- Screenshot format: `.png`
- Recording command: `adb shell screenrecord /sdcard/<file>.mp4`
- Screenshot command: `adb shell screencap -p /sdcard/<file>.png`
- Stop recording: `adb shell kill -2 $(adb shell pgrep screenrecord)`
- **180-second recording limit** per `screenrecord` invocation — plan scenes accordingly
- Files must be pulled from device with `adb pull`
- Requires Android SDK with an AVD or connected device

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `No booted simulator` | Run `xcrun simctl boot <UDID>` or open Simulator.app |
| `flutter test` hangs | Check that `integration_test` is in `dev_dependencies` |
| Video is 0 bytes | Recording was stopped too quickly — add `sleep 2` before kill |
| Screenshots are blank | App hasn't rendered yet — increase initial `Future.delayed` |
| `adb: not found` | Set `ANDROID_HOME` and add `platform-tools` to `PATH` |
| Test fails with import error | Verify the `package:` import matches `pubspec.yaml` name |
| Simulator shows wrong device | Use `xcrun simctl list` and boot a specific UDID |
| Android recording cuts off | Hit 180s limit — split demo into shorter scene groups |

## Notes

- Demo test lives at `integration_test/_feature_demo_test.dart` (temporary, cleaned up after)
- iOS videos are `.mov` format, Android videos are `.mp4` format
- Output in `<app-path>/demo-recordings/` — gitignored
- Scene-per-testWidgets pattern ensures logical separation for easy re-recording
- **User approval is required twice**: once for the script (before recording), once for the output (before attaching to PR)
- Generous wait times (2-3s between actions) make videos watchable, not just proof-of-function
- The integration test is designed to always pass — interactions are wrapped in try/catch
- This skill works for any Flutter app, not just TinyKite — just point it at the app directory
