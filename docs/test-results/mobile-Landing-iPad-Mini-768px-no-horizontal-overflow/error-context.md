# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile.spec.mjs >> Landing @ iPad Mini (768px) >> no horizontal overflow
- Location: tests/mobile.spec.mjs:32:7

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 770
Received:    884
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "> devpod" [ref=e4] [cursor=pointer]:
        - /url: index.html
      - generic [ref=e5]:
        - generic [ref=e7]:
          - generic [ref=e8]:
            - button "Light" [ref=e9] [cursor=pointer]:
              - img [ref=e10]
            - button "Dark" [ref=e13] [cursor=pointer]:
              - img [ref=e14]
            - button "Auto" [ref=e16] [cursor=pointer]:
              - img [ref=e17]
          - button "Default" [ref=e21] [cursor=pointer]:
            - generic [ref=e23]: Default
            - img [ref=e24]
        - link "Get Started" [ref=e26] [cursor=pointer]:
          - /url: "#install"
  - generic [ref=e28]:
    - generic [ref=e29]: 6.6MB binary · 20ms startup · zero dependencies
    - heading "Stacked diffs. Local CI. Zero ceremony." [level=1] [ref=e31]:
      - text: Stacked diffs. Local CI.
      - text: Zero ceremony.
    - paragraph [ref=e32]: devpod combines the best practices from Meta's stacked diffs, Google's code review, and VS Code's editor — in a single CLI that works with any GitHub repo.
    - generic [ref=e33]:
      - generic [ref=e34]:
        - code [ref=e35]: $ curl -fsSL https://raw.githubusercontent.com/elloloop/devpod/main/install.sh | sh
        - button "Copy" [ref=e36] [cursor=pointer]
      - generic [ref=e37]: macOS (Apple Silicon & Intel) · Linux (x86_64 & ARM64)
    - generic [ref=e38]:
      - link "Read the Docs" [ref=e39] [cursor=pointer]:
        - /url: guide.html
        - text: Read the Docs
        - img [ref=e40]
      - link "GitHub" [ref=e42] [cursor=pointer]:
        - /url: https://github.com/elloloop/devpod
        - img [ref=e43]
        - text: GitHub
  - generic [ref=e47]:
    - generic [ref=e52]: devpod — Terminal
    - generic [ref=e53]:
      - generic [ref=e54]: $ devpod feature "user authentication"
      - generic [ref=e55]: "✓ Started feat: user authentication"
      - generic [ref=e57]: ... write auth API ...
      - generic [ref=e59]: $ devpod diff "add auth API"
      - generic [ref=e60]: "✓ Created D1: feat(auth): add auth API endpoints"
      - generic [ref=e61]: +200/-0 · 3 files · LLM generated title
      - generic [ref=e63]: ... write login form ...
      - generic [ref=e65]: $ devpod diff "add login form"
      - generic [ref=e66]: "✓ Created D2: feat(auth): add login form"
      - generic [ref=e67]: +150/-0 · 2 files · stacked on D1
      - generic [ref=e69]: $ devpod diff edit D1
      - generic [ref=e70]: ... fix a bug in the API ...
      - generic [ref=e71]: $ devpod diff
      - generic [ref=e72]: "✓ Updated D1 → v2: feat(auth): fix validation"
      - generic [ref=e73]: D2 rebased automatically.
      - generic [ref=e75]: $ devpod submit
      - generic [ref=e76]: ✓ Submitted 2 diffs
      - generic [ref=e77]: "Review: http://localhost:3000/diffs/user-authentication"
      - generic [ref=e79]: $ devpod land
      - generic [ref=e80]: "✓ Landed D1: feat(auth): add auth API endpoints"
      - generic [ref=e81]: "✓ Landed D2: feat(auth): add login form"
      - generic [ref=e82]: Feature complete!
  - generic [ref=e84]:
    - paragraph [ref=e85]: Why devpod exists
    - heading "We studied how the best teams ship code. Then we built the tool." [level=2] [ref=e86]:
      - text: We studied how the best teams ship code.
      - text: Then we built the tool.
    - paragraph [ref=e87]: The practices that make Meta, Google, and Stripe engineering teams fast aren't proprietary. They just weren't available outside those companies. Until now.
    - generic [ref=e88]:
      - generic [ref=e89]:
        - text: “
        - paragraph [ref=e90]: At Meta, engineers use stacked diffs via Phabricator. Instead of one massive PR, every change is a small, reviewable piece that ships independently. Reviews take minutes, not days.
        - generic [ref=e91]:
          - strong [ref=e92]: Stacked Diffs
          - text: — inspired by Meta's Phabricator workflow
      - generic [ref=e93]:
        - text: “
        - paragraph [ref=e94]: At Google, every change gets a thorough code review with true interdiff between review rounds. Reviewers see exactly what changed since their last review, not the entire PR from scratch.
        - generic [ref=e95]:
          - strong [ref=e96]: Version History
          - text: — inspired by Google's Critique review tool
      - generic [ref=e97]:
        - text: “
        - paragraph [ref=e98]: At Stripe, engineers run CI locally before pushing. Bugs are caught in seconds on their machine, not minutes later in a remote pipeline. The feedback loop is near instant.
        - generic [ref=e99]:
          - strong [ref=e100]: Local CI
          - text: — inspired by Stripe's engineering practices
      - generic [ref=e101]:
        - text: “
        - paragraph [ref=e102]: These practices aren't secrets. They're just trapped inside custom internal tools that require massive infrastructure. devpod brings all of them to every team, as a single CLI.
        - generic [ref=e103]:
          - strong [ref=e104]: devpod
          - text: — all of the above, no custom infrastructure
    - generic [ref=e105]:
      - strong [ref=e106]: devpod
      - text: brings all of this to every team. No custom infrastructure. No migration. Just install and start shipping.
  - generic [ref=e108]:
    - paragraph [ref=e109]: What you get
    - heading "Everything you need. Nothing you don't." [level=2] [ref=e110]
    - paragraph [ref=e111]: Six capabilities that replace a dozen tools. Each one works standalone. Together, they're a complete development workflow.
    - generic [ref=e112]:
      - generic [ref=e113]:
        - img [ref=e115]
        - heading "Stacked Diffs" [level=3] [ref=e117]
        - paragraph [ref=e118]: Small PRs = fast reviews. Break features into pieces. Edit any diff in the stack — the rest rebase automatically.
      - generic [ref=e119]:
        - img [ref=e121]
        - heading "Local CI Runner" [level=3] [ref=e123]
        - paragraph [ref=e124]: Your .github/workflows/ run locally in seconds. Same YAML, same marketplace actions, same result. No pushing to test.
      - generic [ref=e125]:
        - img [ref=e127]
        - heading "VS Code Diff Viewer" [level=3] [ref=e129]
        - paragraph [ref=e130]: Monaco Editor in the browser. Not a toy — the real VS Code rendering engine. Syntax highlighting, side-by-side diffs.
      - generic [ref=e131]:
        - img [ref=e133]
        - heading "Version Snapshots" [level=3] [ref=e135]
        - paragraph [ref=e136]: Every edit is a snapshot. Compare any version of any diff. True interdiff between review rounds — see only what changed.
      - generic [ref=e137]:
        - img [ref=e139]
        - heading "No Git Ceremony" [level=3] [ref=e141]
        - paragraph [ref=e142]:
          - code [ref=e143]: feature
          - text: ","
          - code [ref=e144]: diff
          - text: ","
          - code [ref=e145]: sync
          - text: ","
          - code [ref=e146]: land
          - text: . That's it. Git handles everything underneath. You just code.
      - generic [ref=e147]:
        - img [ref=e149]
        - heading "GitHub Compatible" [level=3] [ref=e151]
        - paragraph [ref=e152]: Creates real GitHub PRs. Your team doesn't need to change anything. Review on GitHub as usual — only you need devpod.
  - generic [ref=e154]:
    - paragraph [ref=e155]: Built for everyone
    - heading "Whether you're learning or leading." [level=2] [ref=e156]
    - paragraph [ref=e157]: devpod meets you where you are. Use as much or as little as you need.
    - generic [ref=e158]:
      - generic [ref=e159]:
        - generic [ref=e160]: For Beginners
        - heading "You don't need to learn git." [level=3] [ref=e161]
        - paragraph [ref=e162]: New to coding? devpod is designed so you never need to learn git. Clone a project, start a feature, save your work, ship it. devpod handles branches, commits, rebases, and pushing — you just code.
      - generic [ref=e163]:
        - generic [ref=e164]: For Team Leads
        - heading "Ship smaller, faster PRs with fewer conflicts." [level=3] [ref=e165]
        - paragraph [ref=e166]: Stacked diffs encourage incremental changes. Local CI catches issues before they hit GitHub. Version history gives reviewers true interdiff between review rounds. And your team's existing GitHub workflows don't change.
      - generic [ref=e167]:
        - generic [ref=e168]: For Experienced Developers
        - heading "You're not replacing git. You're removing the ceremony around it." [level=3] [ref=e169]
        - paragraph [ref=e170]: The same way Linear didn't replace issue trackers — it made them not suck. devpod doesn't replace git. It wraps it in a workflow that handles stacked diffs, version history, local CI, and a diff viewer that actually works. Git is still there. You just don't have to think about it.
  - generic [ref=e172]:
    - paragraph [ref=e173]: Workflow
    - heading "Four commands. That's the whole workflow." [level=2] [ref=e174]
    - paragraph [ref=e175]: Start a feature, save diffs, submit for review, land to main. No branching strategy to memorize.
    - generic [ref=e176]:
      - generic [ref=e177]:
        - generic [ref=e178]: "1"
        - heading "Start" [level=3] [ref=e179]
        - code [ref=e180]: $ devpod feature "auth"
      - generic [ref=e181]:
        - generic [ref=e182]: "2"
        - heading "Save" [level=3] [ref=e183]
        - code [ref=e184]: $ devpod diff "add API"
      - generic [ref=e185]:
        - generic [ref=e186]: "3"
        - heading "Review" [level=3] [ref=e187]
        - code [ref=e188]: $ devpod submit
      - generic [ref=e189]:
        - generic [ref=e190]: "4"
        - heading "Ship" [level=3] [ref=e191]
        - code [ref=e192]: $ devpod land
  - generic [ref=e194]:
    - heading "See it in action" [level=2] [ref=e195]
    - paragraph [ref=e196]: Start the dashboard locally and explore your stacked diffs, run CI, and review code.
    - generic [ref=e197]:
      - link "Stacked Diffs Review features broken into small, logical diffs. See version history and interdiff between review rounds. localhost:3000/diffs →" [ref=e198] [cursor=pointer]:
        - /url: http://localhost:3000/diffs
        - generic [ref=e199]: Stacked Diffs
        - generic [ref=e200]: Review features broken into small, logical diffs. See version history and interdiff between review rounds.
        - generic [ref=e201]: localhost:3000/diffs →
      - link "Commits & Diffs Browse real git history with a Phabricator-style diff viewer. Monaco Editor with full syntax highlighting. localhost:3000/prs →" [ref=e202] [cursor=pointer]:
        - /url: http://localhost:3000/prs
        - generic [ref=e203]: Commits & Diffs
        - generic [ref=e204]: Browse real git history with a Phabricator-style diff viewer. Monaco Editor with full syntax highlighting.
        - generic [ref=e205]: localhost:3000/prs →
      - link "Workflow Runs Monitor local CI runs in real-time. Same .github/workflows/ YAML, running on your machine. localhost:3000/runs →" [ref=e206] [cursor=pointer]:
        - /url: http://localhost:3000/runs
        - generic [ref=e207]: Workflow Runs
        - generic [ref=e208]: Monitor local CI runs in real-time. Same .github/workflows/ YAML, running on your machine.
        - generic [ref=e209]: localhost:3000/runs →
      - link "Feature Docs Auto-generated feature documentation with video demos. Show stakeholders what shipped without reading code. localhost:3000/features →" [ref=e210] [cursor=pointer]:
        - /url: http://localhost:3000/features
        - generic [ref=e211]: Feature Docs
        - generic [ref=e212]: Auto-generated feature documentation with video demos. Show stakeholders what shipped without reading code.
        - generic [ref=e213]: localhost:3000/features →
    - paragraph [ref=e214]:
      - text: "Start the dashboard:"
      - code [ref=e215]: devpod dashboard
  - generic [ref=e217]:
    - paragraph [ref=e218]: FAQ for skeptics
    - heading "Fair questions, honest answers." [level=2] [ref=e219]
    - paragraph [ref=e220]: We built devpod for ourselves first. These are the questions we asked too.
    - generic [ref=e221]:
      - generic [ref=e222] [cursor=pointer]:
        - generic [ref=e223]:
          - generic [ref=e224]: "\"Do I need to learn a new workflow?\""
          - img [ref=e226]
        - generic:
          - text: "Four commands:"
          - code [ref=e227]: feature
          - text: ","
          - code [ref=e228]: diff
          - text: ","
          - code [ref=e229]: sync
          - text: ","
          - code [ref=e230]: land
          - text: . You'll be productive in 5 minutes. Everything else is optional.
      - generic [ref=e231] [cursor=pointer]:
        - generic [ref=e232]:
          - generic [ref=e233]: "\"Does my team need to adopt this?\""
          - img [ref=e235]
        - generic: No. devpod creates standard GitHub PRs. Your teammates can review on GitHub as usual. Only you need devpod installed.
      - generic [ref=e236] [cursor=pointer]:
        - generic [ref=e237]:
          - generic [ref=e238]: "\"What about my existing .github/workflows?\""
          - img [ref=e240]
        - generic: They run locally, unchanged. Same YAML, same marketplace actions. When they pass locally, they'll pass on GitHub.
      - generic [ref=e241] [cursor=pointer]:
        - generic [ref=e242]:
          - generic [ref=e243]: "\"Is this just a git wrapper?\""
          - img [ref=e245]
        - generic:
          - text: Under the hood, yes. But so is
          - code [ref=e246]: gh
          - text: ". The value isn't the wrapper — it's the workflow: stacked diffs, version history, local CI, and a diff viewer that doesn't suck."
      - generic [ref=e247] [cursor=pointer]:
        - generic [ref=e248]:
          - generic [ref=e249]: "\"What if I don't want stacked diffs?\""
          - img [ref=e251]
        - generic:
          - text: Don't use them.
          - code [ref=e252]: devpod feature
          - text: +
          - code [ref=e253]: devpod diff
          - text: +
          - code [ref=e254]: devpod land
          - text: works as a single-diff flow too. Stack when you want, don't when you don't.
      - generic [ref=e255] [cursor=pointer]:
        - generic [ref=e256]:
          - generic [ref=e257]: "\"Why not just use Graphite / spr / ghstack?\""
          - img [ref=e259]
        - generic: "They solve stacking on GitHub. devpod solves the entire workflow: CI, review, documentation, and yes — stacking. One tool, not five."
  - generic [ref=e261]:
    - paragraph [ref=e262]: What developers are saying
    - heading "Loved by developers who ship." [level=2] [ref=e263]
    - generic [ref=e264]:
      - generic [ref=e265]:
        - generic [ref=e266]: ★★★★★
        - paragraph [ref=e267]: "\"I used to dread rebases. Now I just edit a diff in the middle of the stack and everything auto-rebases. It's like the git UX I always wanted.\""
        - generic [ref=e268]:
          - generic [ref=e269]: MK
          - generic [ref=e270]:
            - generic [ref=e271]: Maya K.
            - generic [ref=e272]: Senior Engineer, Series B startup
      - generic [ref=e273]:
        - generic [ref=e274]: ★★★★★
        - paragraph [ref=e275]: "\"Our PR review time dropped from 2 days to 4 hours after switching to stacked diffs. Smaller changes, faster reviews, fewer conflicts.\""
        - generic [ref=e276]:
          - generic [ref=e277]: JR
          - generic [ref=e278]:
            - generic [ref=e279]: James R.
            - generic [ref=e280]: Engineering Lead, Fintech
      - generic [ref=e281]:
        - generic [ref=e282]: ★★★★★
        - paragraph [ref=e283]: "\"I'm a bootcamp grad. Git was the hardest part of coding for me. devpod let me skip all of that and just focus on building things.\""
        - generic [ref=e284]:
          - generic [ref=e285]: SC
          - generic [ref=e286]:
            - generic [ref=e287]: Sam C.
            - generic [ref=e288]: Junior Developer
  - generic [ref=e291]:
    - generic [ref=e292]:
      - generic [ref=e293]: 6.6MB
      - generic [ref=e294]: Single binary size
    - generic [ref=e295]:
      - generic [ref=e296]: 20ms
      - generic [ref=e297]: Cold start
    - generic [ref=e298]:
      - generic [ref=e299]: "0"
      - generic [ref=e300]: Dependencies
  - generic [ref=e303]:
    - heading "Start shipping in 10 seconds" [level=2] [ref=e304]
    - paragraph [ref=e305]: One command. No package manager required.
    - generic [ref=e306]:
      - code [ref=e307]: $ curl -fsSL https://raw.githubusercontent.com/elloloop/devpod/main/install.sh | sh
      - button "Copy" [ref=e308] [cursor=pointer]
    - paragraph [ref=e309]: Works on macOS (Apple Silicon & Intel) and Linux (x86_64 & ARM64).
  - contentinfo [ref=e310]:
    - generic [ref=e311]:
      - generic [ref=e312]:
        - link "> devpod" [ref=e313] [cursor=pointer]:
          - /url: index.html
        - generic [ref=e314]: Open source · MIT License
      - generic [ref=e315]:
        - link "Documentation" [ref=e316] [cursor=pointer]:
          - /url: guide.html
        - link "GitHub" [ref=e317] [cursor=pointer]:
          - /url: https://github.com/elloloop/devpod
        - link "Install" [ref=e318] [cursor=pointer]:
          - /url: "#install"
        - link "Issues" [ref=e319] [cursor=pointer]:
          - /url: https://github.com/elloloop/devpod/issues
        - link "License (MIT)" [ref=e320] [cursor=pointer]:
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
> 35  |         expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
      |                             ^ Error: expect(received).toBeLessThanOrEqual(expected)
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
  91  |         expect(bodyWidth).toBeLessThanOrEqual(vp.width + 2);
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
```