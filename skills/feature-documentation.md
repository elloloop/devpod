# Feature Documentation — Generate and Publish to Featuredocs

Generate visual feature documentation — video demos, screenshots, and structured markdown — then publish to the [featuredocs](https://github.com/elloloop/featuredocs) platform. Stakeholders view the result at the featuredocs web UI without touching code.

## Arguments

$ARGUMENTS: `"<feature title>" [--prs 101,102,103] [--product <name>] [--version <semver>] [--scenario path/to/scenario.yml]`

Examples:
- `/feature-documentation "User authentication flow" --prs 101,102,103 --product streammind --version 0.3.0`
- `/feature-documentation "Checkout redesign" --prs 88 --product nesta`
- `/feature-documentation "Dark mode support" --scenario scenarios/dark-mode.yml`

If `--product` is not provided, infer from the repo name. If `--version` is not provided, use the latest version from `docs/features.json` or default to `0.1.0`.

## Steps

### 1. Gather context

Read PR descriptions, diffs, and related issues to understand the feature.

```bash
for PR in <pr-numbers>; do
  gh pr view $PR
  gh pr diff $PR --name-only
done
```

If no `--prs` provided, detect from current issue:
```bash
ISSUE=$(cat .claude/issue 2>/dev/null)
if [ -n "$ISSUE" ]; then
  gh pr list --search "closes #$ISSUE" --json number,title,state
fi
```

From the diffs, identify:
- **App type**: web, android, ios (from file extensions and directory structure)
- **Changed UI components**: routes, pages, screens
- **User-facing behavior**: what the user sees and does

### 2. Ensure featuredocs is available

Check if the `featuredocs` CLI is installed. If not, clone and set it up:

```bash
# Check if featuredocs CLI exists
if ! command -v featuredocs &>/dev/null; then
  # Check if the repo is cloned locally
  FEATUREDOCS_DIR="${FEATUREDOCS_DIR:-$HOME/projects/featuredocs}"
  if [ ! -d "$FEATUREDOCS_DIR" ]; then
    echo "Cloning featuredocs..."
    git clone https://github.com/elloloop/featuredocs.git "$FEATUREDOCS_DIR"
  fi
  # Install CLI deps
  cd "$FEATUREDOCS_DIR/cli" && npm install
  # Make CLI available
  alias featuredocs="npx tsx $FEATUREDOCS_DIR/cli/bin/featuredocs.ts"
fi
```

### 3. Initialize featuredocs structure (if needed)

If this is the first feature doc for this product, scaffold the docs directory:

```bash
PRODUCT="${PRODUCT:-$(basename $(gh repo view --json name -q '.name'))}"
VERSION="${VERSION:-0.1.0}"
SLUG=$(echo "<feature-title>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')

# Check if docs/ structure exists in the project
if [ ! -f "docs/product.json" ]; then
  mkdir -p docs/en

  cat > docs/product.json << PRODUCT_EOF
{
  "name": "$PRODUCT",
  "tagline": "",
  "defaultLocale": "en",
  "locales": ["en"],
  "defaultVersion": "$VERSION",
  "versions": ["$VERSION"]
}
PRODUCT_EOF

  cat > docs/features.json << FEATURES_EOF
{
  "version": "$VERSION",
  "status": "draft",
  "features": []
}
FEATURES_EOF
fi
```

### 4. Record demo video

Generate a Playwright scenario from the PR diffs, then record.

**Analyze diffs to build scenario:**
1. Identify changed UI routes/components from the diff
2. Determine the entry URL for the feature
3. Script the key user interaction (navigate → interact → verify)

Write the scenario:
```bash
WORK_DIR=$(mktemp -d)
cat > "$WORK_DIR/scenario.yml" << 'SCENARIO_EOF'
name: "Feature Demo - <title>"
steps:
  - action: navigate
    url: "http://localhost:3000/<path-to-feature>"
    wait: 2000
    screenshot: "01-initial"
  - action: click
    selector: "[data-testid='key-element']"
    wait: 1000
    screenshot: "02-interaction"
  - action: wait
    duration: 1000
    screenshot: "03-result"
SCENARIO_EOF
```

**Record with Playwright:**

```bash
# Use the devpod video capture action or record directly
mkdir -p "$WORK_DIR/videos" "$WORK_DIR/screenshots"

# Check if local runner is available for video-capture action
RUNNER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4800/health 2>/dev/null || echo "000")

if [ "$RUNNER_STATUS" = "200" ]; then
  # Use the actions runner
  RUN_ID=$(curl -s -X POST http://localhost:4800/api/runs \
    -H "Content-Type: application/json" \
    -d "{
      \"workflow\": \"video-capture\",
      \"inputs\": {
        \"scenario\": \"$WORK_DIR/scenario.yml\",
        \"output_dir\": \"$WORK_DIR\",
        \"platform\": \"web\"
      }
    }" | jq -r '.id')

  # Wait for completion
  while true; do
    STATUS=$(curl -s "http://localhost:4800/api/runs/$RUN_ID" | jq -r '.status')
    case "$STATUS" in
      "completed") break ;;
      "failed") echo "Video capture failed"; break ;;
      *) sleep 3 ;;
    esac
  done
else
  # Direct Playwright recording fallback
  node -e "
  const { chromium } = require('playwright');
  (async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      colorScheme: 'dark',
      recordVideo: { dir: '$WORK_DIR/videos/', size: { width: 1280, height: 720 } }
    });
    const page = await ctx.newPage();
    // Execute scenario steps here
    await page.goto('<feature-url>', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '$WORK_DIR/screenshots/01-initial.png' });
    // ... more steps from scenario
    await page.close();
    await ctx.close();
    await browser.close();
  })();
  "
fi
```

**Graceful degradation:**
- If Playwright not available → skip video, create text-only docs
- If runner not running → fall back to direct Playwright
- If app not running → skip video, note in docs

### 5. Add feature to featuredocs

Register the feature in `features.json` and write the markdown:

```bash
# Add feature entry via CLI or manually
featuredocs add "$SLUG" --title "<Feature Title>"

# Or manually update features.json
python3 -c "
import json
with open('docs/features.json', 'r+') as f:
    data = json.load(f)
    if not any(feat['slug'] == '$SLUG' for feat in data['features']):
        data['features'].append({
            'slug': '$SLUG',
            'title': {'en': '<Feature Title>'},
            'summary': {'en': '<2-3 sentence summary from PR analysis>'},
            'device': 'desktop',
            'orientation': 'landscape',
            'video': 'demo_${SLUG}.mp4'
        })
        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()
"
```

Write the feature markdown with embedded video:

```bash
cat > "docs/en/${SLUG}.md" << 'MD_EOF'
# <Feature Title>

<2-3 sentence summary derived from PR descriptions and code changes>

## Overview

<What this feature does and why it matters, written for non-technical stakeholders>

::video[videos/demo_<slug>.mp4]

## How It Works

<Step-by-step description of the user experience>

1. <First step>
2. <Second step>
3. <Result>

## What Changed

<Technical bullet points grouped by area — for developers who want detail>

- **Frontend**: <changes>
- **Backend**: <changes>
- **Infrastructure**: <changes>

## Related Pull Requests

| PR | Title | Status |
|----|-------|--------|
| #<number> | <title> | <status> |
MD_EOF
```

**Content rules:**
- Write for stakeholders first — lead with the user impact, not the technical details
- Use `::video[path]` syntax for embedded videos (featuredocs renders these as interactive players)
- Summary should be factual, derived from actual PR changes
- Keep markdown clean — featuredocs renders it with goldmark

### 6. Copy video to docs

```bash
# Move recorded video to the standard location
VIDEO_FILE=$(ls "$WORK_DIR/videos/"*.webm "$WORK_DIR/videos/"*.mp4 2>/dev/null | head -1)
if [ -n "$VIDEO_FILE" ]; then
  # Convert to mp4 if needed (featuredocs expects mp4)
  if [[ "$VIDEO_FILE" == *.webm ]]; then
    if command -v ffmpeg &>/dev/null; then
      ffmpeg -i "$VIDEO_FILE" -c:v libx264 -crf 23 -preset fast "docs/videos/demo_${SLUG}.mp4" -y 2>/dev/null
    else
      cp "$VIDEO_FILE" "docs/videos/demo_${SLUG}.webm"
      # Update features.json video field to .webm
    fi
  else
    cp "$VIDEO_FILE" "docs/videos/demo_${SLUG}.mp4"
  fi
  echo "Video ready: docs/videos/demo_${SLUG}.mp4"
fi

# Copy screenshots
for img in "$WORK_DIR/screenshots/"*.png; do
  [ -f "$img" ] && cp "$img" "docs/screenshots/"
done
```

### 7. Publish to featuredocs

```bash
featuredocs publish \
  --product "$PRODUCT" \
  --version "$VERSION" \
  --videos-dir docs/videos \
  --live
```

This uploads videos to R2, copies content to the featuredocs content directory, and marks the version as published. The featuredocs web UI will show the new feature immediately.

### 8. Update tracking

```bash
# Get the featuredocs URL
FEATUREDOCS_URL="${FEATUREDOCS_URL:-https://featuredocs.elloloop.com}"
FEATURE_URL="${FEATUREDOCS_URL}/${PRODUCT}/en/${SLUG}/${VERSION}"

# Comment on PRs
for PR in <pr-numbers>; do
  gh pr comment $PR --body "### Feature Documentation

Published to featuredocs: ${FEATURE_URL}

View the feature demo video and documentation at the link above."
done

# Comment on issue
ISSUE=$(cat .claude/issue 2>/dev/null)
if [ -n "$ISSUE" ]; then
  gh issue comment $ISSUE --body "### Feature Documentation

Published: ${FEATURE_URL}

Includes: video demo, screenshots, and stakeholder-facing documentation."
fi
```

### 9. Report

```
## Feature Documentation Published

**Feature**: <title>
**Product**: <product> v<version>
**URL**: <featuredocs-url>/<product>/en/<slug>/<version>

### Artifacts
- Video: ✅ / ⏭️ Skipped / ❌ Failed
- Screenshots: <count> captured
- Markdown: ✅ Published to featuredocs

### Pull Requests
| PR | Title | Status |
|----|-------|--------|
| #101 | ... | Open |

**View**: Open the featuredocs URL above to see the published documentation.
```

## Important

- The target output format is **featuredocs** (product.json, features.json, locale markdown with `::video[]` syntax), NOT the devpod `docs/features/` format
- Videos should be mp4 (featuredocs standard). Convert webm to mp4 via ffmpeg if needed.
- Use `::video[videos/filename.mp4]` in markdown — this is featuredocs' custom syntax for embedded video players
- Write documentation for **stakeholders**, not developers. Lead with user impact.
- Never block on video capture failure — always publish at least text-only documentation
- If `featuredocs` CLI is not available, write the files manually in the correct format
- The `--live` flag on publish marks the version as published (visible). Without it, the version is draft.
- Keep the generated summary factual and derived from actual code changes — do not embellish
- Do not hardcode PR data — always read live from GitHub via `gh`
