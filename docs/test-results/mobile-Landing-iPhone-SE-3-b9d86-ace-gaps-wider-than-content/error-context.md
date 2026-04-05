# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile.spec.mjs >> Landing @ iPhone SE (375px) >> no empty whitespace gaps wider than content
- Location: tests/mobile.spec.mjs:88:7

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 377
Received:    688
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "> devpod" [ref=e4] [cursor=pointer]:
        - /url: index.html
      - generic [ref=e5]:
        - generic [ref=e8]:
          - button "Light" [ref=e9] [cursor=pointer]:
            - img [ref=e10]
          - button "Dark" [ref=e13] [cursor=pointer]:
            - img [ref=e14]
          - button "Auto" [ref=e16] [cursor=pointer]:
            - img [ref=e17]
        - link "Get Started" [ref=e20] [cursor=pointer]:
          - /url: "#install"
  - generic [ref=e22]:
    - generic [ref=e23]: 6.6MB binary · 20ms startup · zero dependencies
    - heading "Stacked diffs. Local CI. Zero ceremony." [level=1] [ref=e25]:
      - text: Stacked diffs. Local CI.
      - text: Zero ceremony.
    - paragraph [ref=e26]: devpod combines the best practices from Meta's stacked diffs, Google's code review, and VS Code's editor — in a single CLI that works with any GitHub repo.
    - generic [ref=e27]:
      - generic [ref=e28]:
        - code [ref=e29]: $ curl -fsSL https://raw.githubusercontent.com/elloloop/devpod/main/install.sh | sh
        - button "Copy" [ref=e30] [cursor=pointer]
      - generic [ref=e31]: macOS (Apple Silicon & Intel) · Linux (x86_64 & ARM64)
    - generic [ref=e32]:
      - link "Read the Docs" [ref=e33] [cursor=pointer]:
        - /url: guide.html
        - text: Read the Docs
        - img [ref=e34]
      - link "GitHub" [ref=e36] [cursor=pointer]:
        - /url: https://github.com/elloloop/devpod
        - img [ref=e37]
        - text: GitHub
  - generic [ref=e41]:
    - generic [ref=e46]: devpod — Terminal
    - generic [ref=e47]:
      - generic [ref=e48]: $ devpod feature "user authentication"
      - generic [ref=e49]: "✓ Started feat: user authentication"
      - generic [ref=e51]: ... write auth API ...
      - generic [ref=e53]: $ devpod diff "add auth API"
      - generic [ref=e54]: "✓ Created D1: feat(auth): add auth API endpoints"
      - generic [ref=e55]: +200/-0 · 3 files · LLM generated title
      - generic [ref=e57]: ... write login form ...
      - generic [ref=e59]: $ devpod diff "add login form"
      - generic [ref=e60]: "✓ Created D2: feat(auth): add login form"
      - generic [ref=e61]: +150/-0 · 2 files · stacked on D1
      - generic [ref=e63]: $ devpod diff edit D1
      - generic [ref=e64]: ... fix a bug in the API ...
      - generic [ref=e65]: $ devpod diff
      - generic [ref=e66]: "✓ Updated D1 → v2: feat(auth): fix validation"
      - generic [ref=e67]: D2 rebased automatically.
      - generic [ref=e69]: $ devpod submit
      - generic [ref=e70]: ✓ Submitted 2 diffs
      - generic [ref=e71]: "Review: http://localhost:3000/diffs/user-authentication"
      - generic [ref=e73]: $ devpod land
      - generic [ref=e74]: "✓ Landed D1: feat(auth): add auth API endpoints"
      - generic [ref=e75]: "✓ Landed D2: feat(auth): add login form"
      - generic [ref=e76]: Feature complete!
  - generic [ref=e78]:
    - paragraph [ref=e79]: Why devpod exists
    - heading "We studied how the best teams ship code. Then we built the tool." [level=2] [ref=e80]:
      - text: We studied how the best teams ship code.
      - text: Then we built the tool.
    - paragraph [ref=e81]: The practices that make Meta, Google, and Stripe engineering teams fast aren't proprietary. They just weren't available outside those companies. Until now.
    - generic [ref=e82]:
      - generic [ref=e83]:
        - text: “
        - paragraph [ref=e84]: At Meta, engineers use stacked diffs via Phabricator. Instead of one massive PR, every change is a small, reviewable piece that ships independently. Reviews take minutes, not days.
        - generic [ref=e85]:
          - strong [ref=e86]: Stacked Diffs
          - text: — inspired by Meta's Phabricator workflow
      - generic [ref=e87]:
        - text: “
        - paragraph [ref=e88]: At Google, every change gets a thorough code review with true interdiff between review rounds. Reviewers see exactly what changed since their last review, not the entire PR from scratch.
        - generic [ref=e89]:
          - strong [ref=e90]: Version History
          - text: — inspired by Google's Critique review tool
      - generic [ref=e91]:
        - text: “
        - paragraph [ref=e92]: At Stripe, engineers run CI locally before pushing. Bugs are caught in seconds on their machine, not minutes later in a remote pipeline. The feedback loop is near instant.
        - generic [ref=e93]:
          - strong [ref=e94]: Local CI
          - text: — inspired by Stripe's engineering practices
      - generic [ref=e95]:
        - text: “
        - paragraph [ref=e96]: These practices aren't secrets. They're just trapped inside custom internal tools that require massive infrastructure. devpod brings all of them to every team, as a single CLI.
        - generic [ref=e97]:
          - strong [ref=e98]: devpod
          - text: — all of the above, no custom infrastructure
    - generic [ref=e99]:
      - strong [ref=e100]: devpod
      - text: brings all of this to every team. No custom infrastructure. No migration. Just install and start shipping.
  - generic [ref=e102]:
    - paragraph [ref=e103]: What you get
    - heading "Everything you need. Nothing you don't." [level=2] [ref=e104]
    - paragraph [ref=e105]: Six capabilities that replace a dozen tools. Each one works standalone. Together, they're a complete development workflow.
    - generic [ref=e106]:
      - generic [ref=e107]:
        - img [ref=e109]
        - heading "Stacked Diffs" [level=3] [ref=e111]
        - paragraph [ref=e112]: Small PRs = fast reviews. Break features into pieces. Edit any diff in the stack — the rest rebase automatically.
      - generic [ref=e113]:
        - img [ref=e115]
        - heading "Local CI Runner" [level=3] [ref=e117]
        - paragraph [ref=e118]: Your .github/workflows/ run locally in seconds. Same YAML, same marketplace actions, same result. No pushing to test.
      - generic [ref=e119]:
        - img [ref=e121]
        - heading "VS Code Diff Viewer" [level=3] [ref=e123]
        - paragraph [ref=e124]: Monaco Editor in the browser. Not a toy — the real VS Code rendering engine. Syntax highlighting, side-by-side diffs.
      - generic [ref=e125]:
        - img [ref=e127]
        - heading "Version Snapshots" [level=3] [ref=e129]
        - paragraph [ref=e130]: Every edit is a snapshot. Compare any version of any diff. True interdiff between review rounds — see only what changed.
      - generic [ref=e131]:
        - img [ref=e133]
        - heading "No Git Ceremony" [level=3] [ref=e135]
        - paragraph [ref=e136]:
          - code [ref=e137]: feature
          - text: ","
          - code [ref=e138]: diff
          - text: ","
          - code [ref=e139]: sync
          - text: ","
          - code [ref=e140]: land
          - text: . That's it. Git handles everything underneath. You just code.
      - generic [ref=e141]:
        - img [ref=e143]
        - heading "GitHub Compatible" [level=3] [ref=e145]
        - paragraph [ref=e146]: Creates real GitHub PRs. Your team doesn't need to change anything. Review on GitHub as usual — only you need devpod.
  - generic [ref=e148]:
    - paragraph [ref=e149]: Built for everyone
    - heading "Whether you're learning or leading." [level=2] [ref=e150]
    - paragraph [ref=e151]: devpod meets you where you are. Use as much or as little as you need.
    - generic [ref=e152]:
      - generic [ref=e153]:
        - generic [ref=e154]: For Beginners
        - heading "You don't need to learn git." [level=3] [ref=e155]
        - paragraph [ref=e156]: New to coding? devpod is designed so you never need to learn git. Clone a project, start a feature, save your work, ship it. devpod handles branches, commits, rebases, and pushing — you just code.
      - generic [ref=e157]:
        - generic [ref=e158]: For Team Leads
        - heading "Ship smaller, faster PRs with fewer conflicts." [level=3] [ref=e159]
        - paragraph [ref=e160]: Stacked diffs encourage incremental changes. Local CI catches issues before they hit GitHub. Version history gives reviewers true interdiff between review rounds. And your team's existing GitHub workflows don't change.
      - generic [ref=e161]:
        - generic [ref=e162]: For Experienced Developers
        - heading "You're not replacing git. You're removing the ceremony around it." [level=3] [ref=e163]
        - paragraph [ref=e164]: The same way Linear didn't replace issue trackers — it made them not suck. devpod doesn't replace git. It wraps it in a workflow that handles stacked diffs, version history, local CI, and a diff viewer that actually works. Git is still there. You just don't have to think about it.
  - generic [ref=e166]:
    - paragraph [ref=e167]: Workflow
    - heading "Four commands. That's the whole workflow." [level=2] [ref=e168]
    - paragraph [ref=e169]: Start a feature, save diffs, submit for review, land to main. No branching strategy to memorize.
    - generic [ref=e170]:
      - generic [ref=e171]:
        - generic [ref=e172]: "1"
        - heading "Start" [level=3] [ref=e173]
        - code [ref=e174]: $ devpod feature "auth"
      - generic [ref=e175]:
        - generic [ref=e176]: "2"
        - heading "Save" [level=3] [ref=e177]
        - code [ref=e178]: $ devpod diff "add API"
      - generic [ref=e179]:
        - generic [ref=e180]: "3"
        - heading "Review" [level=3] [ref=e181]
        - code [ref=e182]: $ devpod submit
      - generic [ref=e183]:
        - generic [ref=e184]: "4"
        - heading "Ship" [level=3] [ref=e185]
        - code [ref=e186]: $ devpod land
  - generic [ref=e188]:
    - heading "See it in action" [level=2] [ref=e189]
    - paragraph [ref=e190]: Start the dashboard locally and explore your stacked diffs, run CI, and review code.
    - generic [ref=e191]:
      - link "Stacked Diffs Review features broken into small, logical diffs. See version history and interdiff between review rounds. localhost:3000/diffs →" [ref=e192] [cursor=pointer]:
        - /url: http://localhost:3000/diffs
        - generic [ref=e193]: Stacked Diffs
        - generic [ref=e194]: Review features broken into small, logical diffs. See version history and interdiff between review rounds.
        - generic [ref=e195]: localhost:3000/diffs →
      - link "Commits & Diffs Browse real git history with a Phabricator-style diff viewer. Monaco Editor with full syntax highlighting. localhost:3000/prs →" [ref=e196] [cursor=pointer]:
        - /url: http://localhost:3000/prs
        - generic [ref=e197]: Commits & Diffs
        - generic [ref=e198]: Browse real git history with a Phabricator-style diff viewer. Monaco Editor with full syntax highlighting.
        - generic [ref=e199]: localhost:3000/prs →
      - link "Workflow Runs Monitor local CI runs in real-time. Same .github/workflows/ YAML, running on your machine. localhost:3000/runs →" [ref=e200] [cursor=pointer]:
        - /url: http://localhost:3000/runs
        - generic [ref=e201]: Workflow Runs
        - generic [ref=e202]: Monitor local CI runs in real-time. Same .github/workflows/ YAML, running on your machine.
        - generic [ref=e203]: localhost:3000/runs →
      - link "Feature Docs Auto-generated feature documentation with video demos. Show stakeholders what shipped without reading code. localhost:3000/features →" [ref=e204] [cursor=pointer]:
        - /url: http://localhost:3000/features
        - generic [ref=e205]: Feature Docs
        - generic [ref=e206]: Auto-generated feature documentation with video demos. Show stakeholders what shipped without reading code.
        - generic [ref=e207]: localhost:3000/features →
    - paragraph [ref=e208]:
      - text: "Start the dashboard:"
      - code [ref=e209]: devpod dashboard
  - generic [ref=e211]:
    - paragraph [ref=e212]: FAQ for skeptics
    - heading "Fair questions, honest answers." [level=2] [ref=e213]
    - paragraph [ref=e214]: We built devpod for ourselves first. These are the questions we asked too.
    - generic [ref=e215]:
      - generic [ref=e216] [cursor=pointer]:
        - generic [ref=e217]:
          - generic [ref=e218]: "\"Do I need to learn a new workflow?\""
          - img [ref=e220]
        - generic:
          - text: "Four commands:"
          - code [ref=e221]: feature
          - text: ","
          - code [ref=e222]: diff
          - text: ","
          - code [ref=e223]: sync
          - text: ","
          - code [ref=e224]: land
          - text: . You'll be productive in 5 minutes. Everything else is optional.
      - generic [ref=e225] [cursor=pointer]:
        - generic [ref=e226]:
          - generic [ref=e227]: "\"Does my team need to adopt this?\""
          - img [ref=e229]
        - generic: No. devpod creates standard GitHub PRs. Your teammates can review on GitHub as usual. Only you need devpod installed.
      - generic [ref=e230] [cursor=pointer]:
        - generic [ref=e231]:
          - generic [ref=e232]: "\"What about my existing .github/workflows?\""
          - img [ref=e234]
        - generic: They run locally, unchanged. Same YAML, same marketplace actions. When they pass locally, they'll pass on GitHub.
      - generic [ref=e235] [cursor=pointer]:
        - generic [ref=e236]:
          - generic [ref=e237]: "\"Is this just a git wrapper?\""
          - img [ref=e239]
        - generic:
          - text: Under the hood, yes. But so is
          - code [ref=e240]: gh
          - text: ". The value isn't the wrapper — it's the workflow: stacked diffs, version history, local CI, and a diff viewer that doesn't suck."
      - generic [ref=e241] [cursor=pointer]:
        - generic [ref=e242]:
          - generic [ref=e243]: "\"What if I don't want stacked diffs?\""
          - img [ref=e245]
        - generic:
          - text: Don't use them.
          - code [ref=e246]: devpod feature
          - text: +
          - code [ref=e247]: devpod diff
          - text: +
          - code [ref=e248]: devpod land
          - text: works as a single-diff flow too. Stack when you want, don't when you don't.
      - generic [ref=e249] [cursor=pointer]:
        - generic [ref=e250]:
          - generic [ref=e251]: "\"Why not just use Graphite / spr / ghstack?\""
          - img [ref=e253]
        - generic: "They solve stacking on GitHub. devpod solves the entire workflow: CI, review, documentation, and yes — stacking. One tool, not five."
  - generic [ref=e255]:
    - paragraph [ref=e256]: What developers are saying
    - heading "Loved by developers who ship." [level=2] [ref=e257]
    - generic [ref=e258]:
      - generic [ref=e259]:
        - generic [ref=e260]: ★★★★★
        - paragraph [ref=e261]: "\"I used to dread rebases. Now I just edit a diff in the middle of the stack and everything auto-rebases. It's like the git UX I always wanted.\""
        - generic [ref=e262]:
          - generic [ref=e263]: MK
          - generic [ref=e264]:
            - generic [ref=e265]: Maya K.
            - generic [ref=e266]: Senior Engineer, Series B startup
      - generic [ref=e267]:
        - generic [ref=e268]: ★★★★★
        - paragraph [ref=e269]: "\"Our PR review time dropped from 2 days to 4 hours after switching to stacked diffs. Smaller changes, faster reviews, fewer conflicts.\""
        - generic [ref=e270]:
          - generic [ref=e271]: JR
          - generic [ref=e272]:
            - generic [ref=e273]: James R.
            - generic [ref=e274]: Engineering Lead, Fintech
      - generic [ref=e275]:
        - generic [ref=e276]: ★★★★★
        - paragraph [ref=e277]: "\"I'm a bootcamp grad. Git was the hardest part of coding for me. devpod let me skip all of that and just focus on building things.\""
        - generic [ref=e278]:
          - generic [ref=e279]: SC
          - generic [ref=e280]:
            - generic [ref=e281]: Sam C.
            - generic [ref=e282]: Junior Developer
  - generic [ref=e285]:
    - generic [ref=e286]:
      - generic [ref=e287]: 6.6MB
      - generic [ref=e288]: Single binary size
    - generic [ref=e289]:
      - generic [ref=e290]: 20ms
      - generic [ref=e291]: Cold start
    - generic [ref=e292]:
      - generic [ref=e293]: "0"
      - generic [ref=e294]: Dependencies
  - generic [ref=e297]:
    - heading "Start shipping in 10 seconds" [level=2] [ref=e298]
    - paragraph [ref=e299]: One command. No package manager required.
    - generic [ref=e300]:
      - code [ref=e301]: $ curl -fsSL https://raw.githubusercontent.com/elloloop/devpod/main/install.sh | sh
      - button "Copy" [ref=e302] [cursor=pointer]
    - paragraph [ref=e303]: Works on macOS (Apple Silicon & Intel) and Linux (x86_64 & ARM64).
  - contentinfo [ref=e304]:
    - generic [ref=e305]:
      - generic [ref=e306]:
        - link "> devpod" [ref=e307] [cursor=pointer]:
          - /url: index.html
        - generic [ref=e308]: Open source · MIT License
      - generic [ref=e309]:
        - link "Documentation" [ref=e310] [cursor=pointer]:
          - /url: guide.html
        - link "GitHub" [ref=e311] [cursor=pointer]:
          - /url: https://github.com/elloloop/devpod
        - link "Install" [ref=e312] [cursor=pointer]:
          - /url: "#install"
        - link "Issues" [ref=e313] [cursor=pointer]:
          - /url: https://github.com/elloloop/devpod/issues
        - link "License (MIT)" [ref=e314] [cursor=pointer]:
          - /url: https://github.com/elloloop/devpod/blob/main/LICENSE
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const PAGES = [
  4   |   { name: 'Landing', path: '/index.html' },
  5   |   { name: 'Docs', path: '/guide.html' },
  6   |   { name: 'Themes', path: '/themes.html' },
  7   | ];
  8   | 
  9   | const VIEWPORTS = [
  10  |   { name: 'iPhone SE', width: 375, height: 667 },
  11  |   { name: 'iPhone 14', width: 390, height: 844 },
  12  |   { name: 'Pixel 7', width: 412, height: 915 },
  13  |   { name: 'iPad Mini', width: 768, height: 1024 },
  14  |   { name: 'iPad Pro', width: 1024, height: 1366 },
  15  | ];
  16  | 
  17  | import { fileURLToPath } from 'url';
  18  | import { dirname, resolve } from 'path';
  19  | const __dirname = dirname(fileURLToPath(import.meta.url));
  20  | const BASE = 'file://' + resolve(__dirname, '..');
  21  | 
  22  | for (const page of PAGES) {
  23  |   for (const vp of VIEWPORTS) {
  24  |     test.describe(`${page.name} @ ${vp.name} (${vp.width}px)`, () => {
  25  | 
  26  |       test.beforeEach(async ({ page: p }) => {
  27  |         await p.setViewportSize({ width: vp.width, height: vp.height });
  28  |         await p.goto(`${BASE}${page.path}`, { waitUntil: 'domcontentloaded' });
  29  |         await p.waitForTimeout(500);
  30  |       });
  31  | 
  32  |       test('no horizontal overflow', async ({ page: p }) => {
  33  |         const scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth);
  34  |         const clientWidth = await p.evaluate(() => document.documentElement.clientWidth);
  35  |         expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
  36  |       });
  37  | 
  38  |       test('no elements wider than viewport', async ({ page: p }) => {
  39  |         const overflowing = await p.evaluate((vpWidth) => {
  40  |           const elements = document.querySelectorAll('*');
  41  |           const issues = [];
  42  |           for (const el of elements) {
  43  |             const rect = el.getBoundingClientRect();
  44  |             if (rect.width > vpWidth + 5 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
  45  |               issues.push({ tag: el.tagName, class: el.className?.substring?.(0, 40) || '', width: Math.round(rect.width) });
  46  |             }
  47  |           }
  48  |           return issues.slice(0, 5);
  49  |         }, vp.width);
  50  |         expect(overflowing).toHaveLength(0);
  51  |       });
  52  | 
  53  |       test('no text clipped or invisible', async ({ page: p }) => {
  54  |         // Check that h1, h2, p elements are visible and have non-zero dimensions
  55  |         const clipped = await p.evaluate(() => {
  56  |           const issues = [];
  57  |           for (const el of document.querySelectorAll('h1, h2, h3, p, a, button, span')) {
  58  |             const rect = el.getBoundingClientRect();
  59  |             const style = getComputedStyle(el);
  60  |             if (rect.height > 0 && rect.width > 0 && el.textContent.trim()) {
  61  |               // Check text is actually visible (not transparent)
  62  |               const color = style.color;
  63  |               if (color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
  64  |                 issues.push({ tag: el.tagName, text: el.textContent.substring(0, 30), issue: 'transparent text' });
  65  |               }
  66  |             }
  67  |           }
  68  |           return issues.slice(0, 5);
  69  |         });
  70  |         expect(clipped).toHaveLength(0);
  71  |       });
  72  | 
  73  |       test('all sections visible and not zero-height', async ({ page: p }) => {
  74  |         const sections = await p.evaluate(() => {
  75  |           const results = [];
  76  |           for (const section of document.querySelectorAll('section, .hero, main, .preview')) {
  77  |             const rect = section.getBoundingClientRect();
  78  |             results.push({ tag: section.tagName, id: section.id || '', height: Math.round(rect.height), width: Math.round(rect.width) });
  79  |           }
  80  |           return results;
  81  |         });
  82  |         for (const s of sections) {
  83  |           expect(s.height, `${s.tag}#${s.id} should have height`).toBeGreaterThan(0);
  84  |           expect(s.width, `${s.tag}#${s.id} should have width`).toBeGreaterThan(0);
  85  |         }
  86  |       });
  87  | 
  88  |       test('no empty whitespace gaps wider than content', async ({ page: p }) => {
  89  |         // Check that the body doesn't have large empty areas
  90  |         const bodyWidth = await p.evaluate(() => document.body.scrollWidth);
> 91  |         expect(bodyWidth).toBeLessThanOrEqual(vp.width + 2);
      |                           ^ Error: expect(received).toBeLessThanOrEqual(expected)
  92  |       });
  93  | 
  94  |       test('font sizes readable on mobile', async ({ page: p }) => {
  95  |         if (vp.width > 768) return; // only check mobile
  96  |         const tooSmall = await p.evaluate(() => {
  97  |           const issues = [];
  98  |           for (const el of document.querySelectorAll('p, li, td, span, a')) {
  99  |             if (!el.textContent.trim() || el.closest('code, pre, .code, .terminal')) continue;
  100 |             const size = parseFloat(getComputedStyle(el).fontSize);
  101 |             if (size < 10 && el.getBoundingClientRect().height > 0) {
  102 |               issues.push({ tag: el.tagName, text: el.textContent.substring(0, 20), size: Math.round(size) });
  103 |             }
  104 |           }
  105 |           return issues.slice(0, 5);
  106 |         });
  107 |         expect(tooSmall).toHaveLength(0);
  108 |       });
  109 | 
  110 |       test('touch targets at least 32px', async ({ page: p }) => {
  111 |         if (vp.width > 768) return;
  112 |         const smallTargets = await p.evaluate(() => {
  113 |           const issues = [];
  114 |           for (const el of document.querySelectorAll('a, button')) {
  115 |             if (!el.offsetParent) continue; // hidden
  116 |             const rect = el.getBoundingClientRect();
  117 |             if (rect.height < 28 && rect.width < 28 && rect.height > 0) {
  118 |               issues.push({ tag: el.tagName, text: (el.textContent || '').substring(0, 20), h: Math.round(rect.height), w: Math.round(rect.width) });
  119 |             }
  120 |           }
  121 |           return issues.slice(0, 5);
  122 |         });
  123 |         // Warn but don't fail — some small icons are intentional
  124 |         if (smallTargets.length > 0) {
  125 |           console.warn('Small touch targets:', smallTargets);
  126 |         }
  127 |       });
  128 | 
  129 |       test('images and media fit viewport', async ({ page: p }) => {
  130 |         const oversized = await p.evaluate((vpWidth) => {
  131 |           const issues = [];
  132 |           for (const el of document.querySelectorAll('img, video, iframe, svg')) {
  133 |             const rect = el.getBoundingClientRect();
  134 |             if (rect.width > vpWidth + 5 && rect.height > 0) {
  135 |               issues.push({ tag: el.tagName, width: Math.round(rect.width) });
  136 |             }
  137 |           }
  138 |           return issues;
  139 |         }, vp.width);
  140 |         expect(oversized).toHaveLength(0);
  141 |       });
  142 |     });
  143 |   }
  144 | }
  145 | 
  146 | // Theme persistence tests
  147 | test.describe('Theme system', () => {
  148 |   test('theme persists across pages', async ({ page }) => {
  149 |     await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  150 |     await page.waitForTimeout(500);
  151 | 
  152 |     // Set scheme to 'retro'
  153 |     await page.evaluate(() => DevpodTheme.setScheme('retro'));
  154 |     await page.waitForTimeout(200);
  155 | 
  156 |     // Navigate to docs
  157 |     await page.goto(`${BASE}/guide.html`, { waitUntil: 'domcontentloaded' });
  158 |     await page.waitForTimeout(500);
  159 | 
  160 |     const scheme = await page.evaluate(() => DevpodTheme.getScheme());
  161 |     expect(scheme).toBe('retro');
  162 |   });
  163 | 
  164 |   test('dark/light mode applies correctly', async ({ page }) => {
  165 |     await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  166 |     await page.waitForTimeout(500);
  167 | 
  168 |     // Set light mode
  169 |     await page.evaluate(() => DevpodTheme.setMode('light'));
  170 |     await page.waitForTimeout(200);
  171 | 
  172 |     const mode = await page.evaluate(() => document.documentElement.getAttribute('data-dp-mode'));
  173 |     expect(mode).toBe('light');
  174 | 
  175 |     // Background should be light
  176 |     const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dp-bg').trim());
  177 |     expect(bg).not.toBe('#0a0a0a'); // not dark
  178 |   });
  179 | 
  180 |   test('all schemes produce valid CSS variables', async ({ page }) => {
  181 |     await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  182 |     await page.waitForTimeout(500);
  183 | 
  184 |     const results = await page.evaluate(() => {
  185 |       const schemes = DevpodTheme.schemeKeys;
  186 |       const issues = [];
  187 |       for (const s of schemes) {
  188 |         DevpodTheme.setScheme(s);
  189 |         const bg = getComputedStyle(document.documentElement).getPropertyValue('--dp-bg').trim();
  190 |         const text = getComputedStyle(document.documentElement).getPropertyValue('--dp-text').trim();
  191 |         if (!bg || !text) {
```