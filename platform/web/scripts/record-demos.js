const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VIEWPORT = { width: 1440, height: 900 };
const OUTPUT_DIR = '/Users/arun/projects/devpod/docs/demos';
const BASE_URL = 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Smooth scroll by `dy` pixels over `durationMs`. */
async function smoothScroll(page, dy, durationMs = 1200) {
  await page.evaluate(
    ({ dy, dur }) => window.scrollBy({ top: dy, behavior: 'smooth' }),
    { dy, dur: durationMs }
  );
  await page.waitForTimeout(durationMs);
}

/** Move mouse to element center (hover). */
async function hoverElement(page, selector, opts = {}) {
  const el = await page.waitForSelector(selector, { timeout: 5000, ...opts });
  if (!el) return;
  const box = await el.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
  await page.waitForTimeout(600);
}

/** Click an element, optionally hovering first. */
async function hoverAndClick(page, selector, opts = {}) {
  await hoverElement(page, selector, opts);
  await page.click(selector);
}

/** Wait for data to finish loading (no skeleton pulses). */
async function waitForContent(page, ms = 2000) {
  // First wait for network, then a fixed pause for animations
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch (_) {
    // ignore timeout — page may have long-polling
  }
  await page.waitForTimeout(ms);
}

// ---------------------------------------------------------------------------
// Record wrapper
// ---------------------------------------------------------------------------

async function recordVideo(name, scenario) {
  console.log(`\nRecording: ${name} ...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: 'dark',
    recordVideo: {
      dir: OUTPUT_DIR,
      size: VIEWPORT,
    },
  });

  const page = await context.newPage();

  try {
    await scenario(page);
  } catch (err) {
    console.error(`  Error in ${name}:`, err.message);
  } finally {
    // Close page + context to finalize the video
    const video = page.video();
    await page.close();
    await context.close();

    // Rename the auto-generated video file
    if (video) {
      const srcPath = await video.path();
      const targetPath = path.join(OUTPUT_DIR, `${name}.webm`);
      if (fs.existsSync(srcPath)) {
        fs.renameSync(srcPath, targetPath);
        const size = fs.statSync(targetPath).size;
        console.log(`  Saved: ${targetPath} (${(size / 1024).toFixed(1)} KB)`);
      }
    }

    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function stackedDiffsOverview(page) {
  await page.goto(`${BASE_URL}/diffs`, { waitUntil: 'networkidle' });
  await waitForContent(page, 2000);

  // Hover over the first feature row (improve-dashboard)
  const rows = await page.$$('table tbody tr');
  if (rows.length > 0) {
    const box = await rows[0].boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
      await page.waitForTimeout(1000);
    }
  }

  // Hover over additional rows if present
  for (let i = 1; i < Math.min(rows.length, 4); i++) {
    const box = await rows[i].boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await page.waitForTimeout(500);
    }
  }

  // Slowly scroll if content is long
  await smoothScroll(page, 200, 800);
  await page.waitForTimeout(500);

  // Click on the "improve dashboard" feature link
  const featureLink = await page.$('a[href*="/diffs/improve-dashboard"]');
  if (featureLink) {
    const box = await featureLink.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await page.waitForTimeout(500);
    }
    await featureLink.click();
    await waitForContent(page, 2000);
  }

  await page.waitForTimeout(1500);
}

async function featureDiffStack(page) {
  await page.goto(`${BASE_URL}/diffs/improve-dashboard`, { waitUntil: 'networkidle' });
  await waitForContent(page, 2000);

  // Hover over each diff row (D1, D2, D3)
  const diffRows = await page.$$('table tbody tr');
  for (let i = 0; i < Math.min(diffRows.length, 3); i++) {
    const box = await diffRows[i].boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await page.waitForTimeout(1200);
    }
  }

  // Click D1 to enter diff review
  const d1Link = await page.$('a[href*="/diffs/improve-dashboard/1"]');
  if (d1Link) {
    const box = await d1Link.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await page.waitForTimeout(400);
    }
    await d1Link.click();
    await waitForContent(page, 2000);
  }

  await page.waitForTimeout(1500);
}

async function diffReviewCode(page) {
  await page.goto(`${BASE_URL}/diffs/improve-dashboard/1`, { waitUntil: 'networkidle' });
  await waitForContent(page, 3000);

  // Show the compact header (top bar area)
  await page.mouse.move(720, 18, { steps: 10 });
  await page.waitForTimeout(1500);

  // Show the stack navigation bar (D1 -> D2 -> D3) — second row, ~48px from top
  await page.mouse.move(200, 48, { steps: 10 });
  await page.waitForTimeout(1500);

  // Show the file list area — hover over file tree
  await page.mouse.move(400, 80, { steps: 10 });
  await page.waitForTimeout(1000);

  // Click the file tree expand if collapsed
  const fileToggle = await page.$('button:has-text("files changed")');
  if (fileToggle) {
    await fileToggle.click();
    await page.waitForTimeout(800);
  }

  // Slowly scroll through the diff code
  await smoothScroll(page, 300, 1500);
  await page.waitForTimeout(1000);
  await smoothScroll(page, 300, 1500);
  await page.waitForTimeout(1000);

  // Hover over some diff lines to show hover state
  const diffLines = await page.$$('.diff-line, [class*="diff"] tr, pre code span');
  for (let i = 0; i < Math.min(diffLines.length, 3); i++) {
    const box = await diffLines[i].boundingBox();
    if (box && box.y > 60 && box.y < 800) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await page.waitForTimeout(800);
    }
  }

  // Scroll to show more content / review panel area at bottom
  await smoothScroll(page, 400, 1500);
  await page.waitForTimeout(2000);

  // Scroll back up to show the header once more
  await smoothScroll(page, -600, 1200);
  await page.waitForTimeout(1500);
}

async function navigateDiffs(page) {
  await page.goto(`${BASE_URL}/diffs/improve-dashboard/1`, { waitUntil: 'networkidle' });
  await waitForContent(page, 2000);

  // Click D2 in the stack nav breadcrumb
  const d2Link = await page.$('a[href="/diffs/improve-dashboard/2"]');
  if (d2Link) {
    const box = await d2Link.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await page.waitForTimeout(500);
    }
    await d2Link.click();
    await waitForContent(page, 2000);
  }

  // Show D2's diff — slowly scroll
  await smoothScroll(page, 250, 1000);
  await page.waitForTimeout(1500);

  // Click D3 in the breadcrumb
  const d3Link = await page.$('a[href="/diffs/improve-dashboard/3"]');
  if (d3Link) {
    const box = await d3Link.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await page.waitForTimeout(500);
    }
    await d3Link.click();
    await waitForContent(page, 2000);
  }

  // Show D3's diff
  await smoothScroll(page, 250, 1000);
  await page.waitForTimeout(2000);
}

async function fullTour(page) {
  // 1. Start at dashboard
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await waitForContent(page, 2000);

  // 2. Click "Diffs" in sidebar
  await hoverAndClick(page, 'a[href="/diffs"]');
  await waitForContent(page, 2000);

  // 3. Click on the improve-dashboard feature
  const featureLink = await page.$('a[href*="/diffs/improve-dashboard"]');
  if (featureLink) {
    const box = await featureLink.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await page.waitForTimeout(400);
    }
    await featureLink.click();
    await waitForContent(page, 2000);
  }

  // 4. Click D1
  const d1Link = await page.$('a[href*="/diffs/improve-dashboard/1"]');
  if (d1Link) {
    const box = await d1Link.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await page.waitForTimeout(400);
    }
    await d1Link.click();
    await waitForContent(page, 3000);
  }

  // Scroll through D1's diff
  await smoothScroll(page, 400, 1500);
  await page.waitForTimeout(1000);

  // 5. Click D2 in breadcrumb
  const d2NavLink = await page.$('a[href="/diffs/improve-dashboard/2"]');
  if (d2NavLink) {
    await d2NavLink.click();
    await waitForContent(page, 3000);
  }

  // Scroll through D2's diff
  await smoothScroll(page, 300, 1200);
  await page.waitForTimeout(1000);

  // 6. Go back to feature detail (click the back link in the header)
  const backLink = await page.$('a[href*="/diffs/improve-dashboard"]:not([href*="/1"]):not([href*="/2"]):not([href*="/3"])');
  if (backLink) {
    await backLink.click();
    await waitForContent(page, 2000);
  } else {
    await page.goBack();
    await waitForContent(page, 2000);
  }

  // Note: diff review pages hide the sidebar, so after going back to feature detail,
  // the sidebar should reappear. If we're still on diff review, navigate directly.
  const currentUrl = page.url();
  if (currentUrl.includes('/diffs/improve-dashboard/')) {
    // Still on a diff review page — navigate directly
    await page.goto(`${BASE_URL}/features`, { waitUntil: 'networkidle' });
    await waitForContent(page, 2000);
  } else {
    // 7. Click "Features" in sidebar
    const featuresLink = await page.$('a[href="/features"]');
    if (featuresLink) {
      await hoverAndClick(page, 'a[href="/features"]');
      await waitForContent(page, 2000);
    } else {
      await page.goto(`${BASE_URL}/features`, { waitUntil: 'networkidle' });
      await waitForContent(page, 2000);
    }
  }

  await page.waitForTimeout(1500);

  // 8. Click "Commits" in sidebar
  const commitsLink = await page.$('a[href="/prs"]');
  if (commitsLink) {
    await hoverAndClick(page, 'a[href="/prs"]');
  } else {
    await page.goto(`${BASE_URL}/prs`, { waitUntil: 'networkidle' });
  }
  await waitForContent(page, 2000);

  // Show commits table — scroll slowly
  await smoothScroll(page, 200, 800);
  await page.waitForTimeout(2000);
}

async function dashboardHome(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await waitForContent(page, 3000);

  // Slowly scroll to show stats, activity, features
  await smoothScroll(page, 200, 1000);
  await page.waitForTimeout(1000);
  await smoothScroll(page, 200, 1000);
  await page.waitForTimeout(1500);
}

async function commitsDiffView(page) {
  await page.goto(`${BASE_URL}/prs`, { waitUntil: 'networkidle' });
  await waitForContent(page, 2000);

  // Click on the first commit that has a meaningful diff
  const commitLinks = await page.$$('table tbody tr td:nth-child(2) a');
  if (commitLinks.length > 0) {
    const firstCommit = commitLinks[0];
    const box = await firstCommit.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await page.waitForTimeout(500);
    }
    await firstCommit.click();
    await waitForContent(page, 3000);
  }

  // Show the Phabricator-style diff viewer — scroll through
  await smoothScroll(page, 300, 1200);
  await page.waitForTimeout(1000);
  await smoothScroll(page, 300, 1200);
  await page.waitForTimeout(1000);
  await smoothScroll(page, 300, 1200);
  await page.waitForTimeout(1000);

  // Scroll back to top to show file tree navigation
  await smoothScroll(page, -600, 1200);
  await page.waitForTimeout(2000);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('DevPod Demo Recorder');
  console.log('====================');
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Viewport: ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  // Verify the dashboard is reachable
  try {
    const resp = await fetch(`${BASE_URL}/api/health`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    console.log('Dashboard is running.\n');
  } catch (err) {
    console.error(`Cannot reach ${BASE_URL} — is the dashboard running?\n  ${err.message}`);
    process.exit(1);
  }

  const scenarios = [
    ['stacked-diffs-overview', stackedDiffsOverview],
    ['feature-diff-stack', featureDiffStack],
    ['diff-review-code', diffReviewCode],
    ['navigate-diffs', navigateDiffs],
    ['full-tour', fullTour],
    ['dashboard-home', dashboardHome],
    ['commits-diff-view', commitsDiffView],
  ];

  for (const [name, fn] of scenarios) {
    await recordVideo(name, fn);
  }

  // Summary
  console.log('\n========================================');
  console.log('All demos recorded! Summary:\n');

  let allGood = true;
  for (const [name] of scenarios) {
    const filePath = path.join(OUTPUT_DIR, `${name}.webm`);
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      const sizeKB = (size / 1024).toFixed(1);
      const ok = size > 100 * 1024 ? 'OK' : 'SMALL';
      if (ok === 'SMALL') allGood = false;
      console.log(`  ${ok.padEnd(6)} ${name}.webm  (${sizeKB} KB)`);
    } else {
      allGood = false;
      console.log(`  MISS  ${name}.webm  (not found)`);
    }
  }

  console.log(allGood ? '\nAll videos look good!' : '\nSome videos may be too small — check them manually.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
