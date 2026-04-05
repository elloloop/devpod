# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile.spec.mjs >> Docs @ Pixel 7 (412px) >> no elements wider than viewport
- Location: tests/mobile.spec.mjs:38:7

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 5
Received array:  [{"class": "cmd", "tag": "SPAN", "width": 583}, {"class": "output", "tag": "SPAN", "width": 439}, {"class": "comment", "tag": "SPAN", "width": 454}, {"class": "output", "tag": "SPAN", "width": 432}, {"class": "cmd", "tag": "SPAN", "width": 583}]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - button "Toggle menu" [ref=e5] [cursor=pointer]:
          - img [ref=e6]
        - link "> devpod" [ref=e7] [cursor=pointer]:
          - /url: index.html
      - generic [ref=e8]:
        - list [ref=e9]:
          - listitem [ref=e10]:
            - link "Home" [ref=e11] [cursor=pointer]:
              - /url: index.html
          - listitem [ref=e12]:
            - link "GitHub" [ref=e13] [cursor=pointer]:
              - /url: https://github.com/elloloop/devpod
        - generic [ref=e15]:
          - generic [ref=e16]:
            - button "Light" [ref=e17] [cursor=pointer]:
              - img [ref=e18]
            - button "Dark" [ref=e21] [cursor=pointer]:
              - img [ref=e22]
            - button "Auto" [ref=e24] [cursor=pointer]:
              - img [ref=e25]
          - button "Default" [ref=e29] [cursor=pointer]:
            - generic [ref=e31]: Default
            - img [ref=e32]
  - generic [ref=e34]:
    - complementary [ref=e35]:
      - generic [ref=e36]:
        - generic [ref=e37]: Getting Started
        - link "Overview" [ref=e38] [cursor=pointer]:
          - /url: "#getting-started"
        - link "Install" [ref=e39] [cursor=pointer]:
          - /url: "#install"
        - link "Clone a Repo" [ref=e40] [cursor=pointer]:
          - /url: "#clone-a-repo"
        - link "First Feature" [ref=e41] [cursor=pointer]:
          - /url: "#first-feature"
        - link "First Diff" [ref=e42] [cursor=pointer]:
          - /url: "#first-diff"
        - link "Submit for Review" [ref=e43] [cursor=pointer]:
          - /url: "#submit-for-review"
        - link "Land (Ship It)" [ref=e44] [cursor=pointer]:
          - /url: "#land"
      - generic [ref=e45]:
        - generic [ref=e46]: Core Concepts
        - link "Overview" [ref=e47] [cursor=pointer]:
          - /url: "#core-concepts"
        - link "Features" [ref=e48] [cursor=pointer]:
          - /url: "#features-concept"
        - link "Diffs" [ref=e49] [cursor=pointer]:
          - /url: "#diffs-concept"
        - link "Sync" [ref=e50] [cursor=pointer]:
          - /url: "#sync-concept"
        - link "Submit" [ref=e51] [cursor=pointer]:
          - /url: "#submit-concept"
        - link "Land" [ref=e52] [cursor=pointer]:
          - /url: "#land-concept"
        - link "Versions Branch" [ref=e53] [cursor=pointer]:
          - /url: "#versions-branch"
      - generic [ref=e54]:
        - generic [ref=e55]: Commands
        - link "Reference" [ref=e56] [cursor=pointer]:
          - /url: "#commands"
        - link "clone" [ref=e57] [cursor=pointer]:
          - /url: "#cmd-clone"
        - link "feature / fix / docs / chore" [ref=e58] [cursor=pointer]:
          - /url: "#cmd-feature"
        - link "diff" [ref=e59] [cursor=pointer]:
          - /url: "#cmd-diff"
        - link "sync" [ref=e60] [cursor=pointer]:
          - /url: "#cmd-sync"
        - link "switch" [ref=e61] [cursor=pointer]:
          - /url: "#cmd-switch"
        - link "submit" [ref=e62] [cursor=pointer]:
          - /url: "#cmd-submit"
        - link "land" [ref=e63] [cursor=pointer]:
          - /url: "#cmd-land"
        - link "features" [ref=e64] [cursor=pointer]:
          - /url: "#cmd-features"
        - link "diffs" [ref=e65] [cursor=pointer]:
          - /url: "#cmd-diffs"
        - link "context" [ref=e66] [cursor=pointer]:
          - /url: "#cmd-context"
        - link "status" [ref=e67] [cursor=pointer]:
          - /url: "#cmd-status"
        - link "log" [ref=e68] [cursor=pointer]:
          - /url: "#cmd-log"
        - link "undo" [ref=e69] [cursor=pointer]:
          - /url: "#cmd-undo"
        - link "split" [ref=e70] [cursor=pointer]:
          - /url: "#cmd-split"
        - link "config" [ref=e71] [cursor=pointer]:
          - /url: "#cmd-config"
        - link "runner" [ref=e72] [cursor=pointer]:
          - /url: "#cmd-runner"
        - link "run" [ref=e73] [cursor=pointer]:
          - /url: "#cmd-run"
        - link "runs" [ref=e74] [cursor=pointer]:
          - /url: "#cmd-runs"
        - link "workflows" [ref=e75] [cursor=pointer]:
          - /url: "#cmd-workflows"
        - link "secret" [ref=e76] [cursor=pointer]:
          - /url: "#cmd-secret"
        - link "dashboard" [ref=e77] [cursor=pointer]:
          - /url: "#cmd-dashboard"
      - generic [ref=e78]:
        - generic [ref=e79]: Workflows
        - link "Overview" [ref=e80] [cursor=pointer]:
          - /url: "#workflows"
        - link "Solo Developer" [ref=e81] [cursor=pointer]:
          - /url: "#wf-solo"
        - link "Team Workflow" [ref=e82] [cursor=pointer]:
          - /url: "#wf-team"
        - link "Open Source" [ref=e83] [cursor=pointer]:
          - /url: "#wf-oss"
        - link "Stacking Diffs" [ref=e84] [cursor=pointer]:
          - /url: "#wf-stacking"
        - link "Editing a Stack" [ref=e85] [cursor=pointer]:
          - /url: "#wf-editing-stack"
        - link "Resolving Conflicts" [ref=e86] [cursor=pointer]:
          - /url: "#wf-conflicts"
        - link "Working Offline" [ref=e87] [cursor=pointer]:
          - /url: "#wf-offline"
      - generic [ref=e88]:
        - generic [ref=e89]: Dashboard
        - link "Overview" [ref=e90] [cursor=pointer]:
          - /url: "#dashboard"
        - link "Reviewing Diffs" [ref=e91] [cursor=pointer]:
          - /url: "#dashboard-diffs"
        - link "Version History" [ref=e92] [cursor=pointer]:
          - /url: "#dashboard-versions"
        - link "Keyboard Shortcuts" [ref=e93] [cursor=pointer]:
          - /url: "#dashboard-shortcuts"
      - generic [ref=e94]:
        - generic [ref=e95]: Local CI
        - link "Overview" [ref=e96] [cursor=pointer]:
          - /url: "#local-ci"
        - link "Starting the Runner" [ref=e97] [cursor=pointer]:
          - /url: "#ci-runner"
        - link "Running Workflows" [ref=e98] [cursor=pointer]:
          - /url: "#ci-running"
        - link "Secrets" [ref=e99] [cursor=pointer]:
          - /url: "#ci-secrets"
      - generic [ref=e100]:
        - generic [ref=e101]: Configuration
        - link "Overview" [ref=e102] [cursor=pointer]:
          - /url: "#configuration"
        - link "LLM Setup" [ref=e103] [cursor=pointer]:
          - /url: "#config-llm"
        - link "CI Auto-Run" [ref=e104] [cursor=pointer]:
          - /url: "#config-ci"
        - link "Default Branch" [ref=e105] [cursor=pointer]:
          - /url: "#config-branch"
      - generic [ref=e106]:
        - generic [ref=e107]: For AI Agents
        - link "Agent Instructions" [ref=e108] [cursor=pointer]:
          - /url: "#ai-agents"
      - generic [ref=e109]:
        - generic [ref=e110]: Troubleshooting
        - link "Common Issues" [ref=e111] [cursor=pointer]:
          - /url: "#troubleshooting"
    - main [ref=e112]:
      - generic [ref=e113]:
        - heading "devpod Documentation" [level=1] [ref=e114]
        - paragraph [ref=e115]: The complete guide to devpod — stacked diffs, local CI, version history, and a diff viewer powered by VS Code. Everything you need to ship code faster.
        - 'heading "Getting Started #" [level=2] [ref=e116]':
          - text: Getting Started
          - link "#" [ref=e117] [cursor=pointer]:
            - /url: "#getting-started"
        - paragraph [ref=e118]: devpod is a developer workflow CLI. It wraps git with a simple set of commands built around stacked diffs, local CI, and version history. You can be productive in under 5 minutes.
        - 'heading "Install #" [level=3] [ref=e119]':
          - text: Install
          - link "#" [ref=e120] [cursor=pointer]:
            - /url: "#install"
        - paragraph [ref=e121]: Install devpod with a single command. No package manager required.
        - generic [ref=e122]:
          - generic [ref=e123]:
            - generic [ref=e124]: Terminal
            - button "Copy" [ref=e125] [cursor=pointer]
          - generic [ref=e126]: $ curl -fsSL https://raw.githubusercontent.com/elloloop/devpod/main/install.sh | sh
        - paragraph [ref=e127]: "Supported platforms: macOS (Apple Silicon and Intel) and Linux (x86_64 and ARM64). The binary is 6.6MB with zero dependencies."
        - paragraph [ref=e128]: "Verify the installation:"
        - generic [ref=e129]:
          - generic [ref=e130]:
            - generic [ref=e131]: Terminal
            - button "Copy" [ref=e132] [cursor=pointer]
          - generic [ref=e133]: $ devpod --version devpod version 0.x.x
        - 'heading "Clone a Repo #" [level=3] [ref=e134]':
          - text: Clone a Repo
          - link "#" [ref=e135] [cursor=pointer]:
            - /url: "#clone-a-repo"
        - paragraph [ref=e136]: Clone any GitHub repository. devpod sets up the repo with its own metadata so it can track features, diffs, and versions.
        - generic [ref=e137]:
          - generic [ref=e138]:
            - generic [ref=e139]: Terminal
            - button "Copy" [ref=e140] [cursor=pointer]
          - generic [ref=e141]: $ devpod clone myorg/myrepo Cloning into 'myrepo'... ✓ Repository ready
        - generic [ref=e142]:
          - generic [ref=e143]: Tip
          - paragraph [ref=e144]: You can also use devpod in an existing git repository. Just navigate to the repo and run any devpod command — it will initialize automatically.
        - 'heading "Create Your First Feature #" [level=3] [ref=e145]':
          - text: Create Your First Feature
          - link "#" [ref=e146] [cursor=pointer]:
            - /url: "#first-feature"
        - paragraph [ref=e147]: A feature is a unit of work. It maps to a git branch underneath, but you don't need to think about branches.
        - generic [ref=e148]:
          - generic [ref=e149]:
            - generic [ref=e150]: Terminal
            - button "Copy" [ref=e151] [cursor=pointer]
          - generic [ref=e152]: "$ devpod feature \"add user authentication\" ✓ Started feat: add user authentication"
        - paragraph [ref=e153]: Now make some code changes. Edit files as you normally would.
        - 'heading "Save Your First Diff #" [level=3] [ref=e154]':
          - text: Save Your First Diff
          - link "#" [ref=e155] [cursor=pointer]:
            - /url: "#first-diff"
        - paragraph [ref=e156]: A diff is a snapshot of your changes. Think of it as a commit + PR combined. devpod stages all your changes and creates a diff.
        - generic [ref=e157]:
          - generic [ref=e158]:
            - generic [ref=e159]: Terminal
            - button "Copy" [ref=e160] [cursor=pointer]
          - generic [ref=e161]: "$ devpod diff \"add auth API endpoints\" ✓ Created D1: feat(auth): add auth API endpoints +200/-0 · 3 files"
        - paragraph [ref=e162]:
          - text: If you omit the message, devpod uses an LLM to generate a title from your changes (if configured). You can also just run
          - code [ref=e163]: devpod diff
          - text: with no arguments.
        - 'heading "Submit for Review #" [level=3] [ref=e164]':
          - text: Submit for Review
          - link "#" [ref=e165] [cursor=pointer]:
            - /url: "#submit-for-review"
        - paragraph [ref=e166]: Submit pushes your diffs to GitHub as pull requests and opens the local dashboard for review.
        - generic [ref=e167]:
          - generic [ref=e168]:
            - generic [ref=e169]: Terminal
            - button "Copy" [ref=e170] [cursor=pointer]
          - generic [ref=e171]: "$ devpod submit ✓ Submitted 1 diff Review: http://localhost:3000/diffs/add-user-authentication"
        - 'heading "Land (Ship It) #" [level=3] [ref=e172]':
          - text: Land (Ship It)
          - link "#" [ref=e173] [cursor=pointer]:
            - /url: "#land"
        - paragraph [ref=e174]: Land merges your approved diffs to the main branch.
        - generic [ref=e175]:
          - generic [ref=e176]:
            - generic [ref=e177]: Terminal
            - button "Copy" [ref=e178] [cursor=pointer]
          - generic [ref=e179]: "$ devpod land ✓ Landed D1: feat(auth): add auth API endpoints Feature complete!"
        - paragraph [ref=e180]:
          - text: "That's the entire basic workflow:"
          - code [ref=e181]: feature
          - text: →
          - code [ref=e182]: diff
          - text: →
          - code [ref=e183]: submit
          - text: →
          - code [ref=e184]: land
          - text: .
        - 'heading "Core Concepts #" [level=2] [ref=e185]':
          - text: Core Concepts
          - link "#" [ref=e186] [cursor=pointer]:
            - /url: "#core-concepts"
        - 'heading "Features #" [level=3] [ref=e187]':
          - text: Features
          - link "#" [ref=e188] [cursor=pointer]:
            - /url: "#features-concept"
        - paragraph [ref=e189]:
          - text: A
          - strong [ref=e190]: feature
          - text: is a unit of work — a bug fix, a new feature, a refactor, a documentation update. Under the hood, it maps to a git branch, but devpod manages the branch for you.
        - paragraph [ref=e191]: "Create features with different prefixes depending on the type of work:"
        - generic [ref=e192]:
          - generic [ref=e193]:
            - generic [ref=e194]: Terminal
            - button "Copy" [ref=e195] [cursor=pointer]
          - generic [ref=e196]: "$ devpod feature \"add search\" # feat/add-search $ devpod fix \"login timeout\" # fix/login-timeout $ devpod docs \"update API reference\" # docs/update-api-reference $ devpod chore \"upgrade dependencies\"# chore/upgrade-dependencies"
        - paragraph [ref=e197]:
          - text: You can have multiple features in progress. Use
          - code [ref=e198]: devpod features
          - text: to list them and
          - code [ref=e199]: devpod switch
          - text: to move between them.
        - 'heading "Diffs #" [level=3] [ref=e200]':
          - text: Diffs
          - link "#" [ref=e201] [cursor=pointer]:
            - /url: "#diffs-concept"
        - paragraph [ref=e202]:
          - text: A
          - strong [ref=e203]: diff
          - text: is a reviewable unit of change within a feature. One feature can have multiple diffs, forming a
          - strong [ref=e204]: stack
          - text: . Each diff becomes its own GitHub PR.
        - list [ref=e205]:
          - listitem [ref=e206]:
            - strong [ref=e207]: D1, D2, D3...
            - text: — diffs are numbered sequentially within a feature
          - listitem [ref=e208]:
            - strong [ref=e209]: Stacking
            - text: — each subsequent diff builds on the previous one
          - listitem [ref=e210]:
            - strong [ref=e211]: Versioning
            - text: — every time you update a diff, a new version (v1, v2, v3...) is saved
          - listitem [ref=e212]:
            - strong [ref=e213]: Auto-rebase
            - text: — when you edit a diff in the middle of a stack, all subsequent diffs rebase automatically
        - 'heading "Sync #" [level=3] [ref=e214]':
          - text: Sync
          - link "#" [ref=e215] [cursor=pointer]:
            - /url: "#sync-concept"
        - paragraph [ref=e216]:
          - strong [ref=e217]: Sync
          - text: pulls the latest changes from the main branch and rebases your diffs on top. Run it regularly to stay up to date and avoid conflicts.
        - generic [ref=e218]:
          - generic [ref=e219]:
            - generic [ref=e220]: Terminal
            - button "Copy" [ref=e221] [cursor=pointer]
          - generic [ref=e222]: $ devpod sync ✓ Synced with latest code
        - generic [ref=e223]:
          - generic [ref=e224]: Important
          - paragraph [ref=e225]:
            - text: Always run
            - code [ref=e226]: devpod diff
            - text: to save your changes before
            - code [ref=e227]: devpod sync
            - text: . Sync rebases your work and needs a clean working directory.
        - 'heading "Submit #" [level=3] [ref=e228]':
          - text: Submit
          - link "#" [ref=e229] [cursor=pointer]:
            - /url: "#submit-concept"
        - paragraph [ref=e230]:
          - strong [ref=e231]: Submit
          - text: pushes your diffs to GitHub as pull requests and opens the devpod dashboard for review. Each diff in the stack becomes a separate PR, linked together.
        - 'heading "Land #" [level=3] [ref=e232]':
          - text: Land
          - link "#" [ref=e233] [cursor=pointer]:
            - /url: "#land-concept"
        - paragraph [ref=e234]:
          - strong [ref=e235]: Land
          - text: merges your diffs to the main branch. Diffs are landed in order (D1 first, then D2, etc.). Each diff is squash-merged into a clean commit.
        - 'heading "The Versions Branch #" [level=3] [ref=e236]':
          - text: The Versions Branch
          - link "#" [ref=e237] [cursor=pointer]:
            - /url: "#versions-branch"
        - paragraph [ref=e238]:
          - text: devpod stores version history in a special
          - code [ref=e239]: devpod/versions
          - text: "branch. Every time you create or update a diff, the full state is saved as a version. This enables:"
        - list [ref=e240]:
          - listitem [ref=e241]:
            - strong [ref=e242]: True interdiff
            - text: — reviewers can see what changed between v1 and v2 of a diff, not just the full diff
          - listitem [ref=e243]:
            - strong [ref=e244]: History browsing
            - text: — you can go back to any version of any diff
          - listitem [ref=e245]:
            - strong [ref=e246]: Audit trail
            - text: — every change is recorded, nothing is lost
        - 'heading "Commands Reference #" [level=2] [ref=e247]':
          - text: Commands Reference
          - link "#" [ref=e248] [cursor=pointer]:
            - /url: "#commands"
        - paragraph [ref=e249]: Complete reference for every devpod command. All commands should be run from within a devpod-managed repository.
        - 'heading "devpod clone #" [level=3] [ref=e250]':
          - text: devpod clone
          - link "#" [ref=e251] [cursor=pointer]:
            - /url: "#cmd-clone"
        - paragraph [ref=e252]: Clone a GitHub repository and initialize devpod tracking.
        - generic [ref=e253]:
          - generic [ref=e254]:
            - generic [ref=e255]: Terminal
            - button "Copy" [ref=e256] [cursor=pointer]
          - generic [ref=e257]: $ devpod clone myorg/myrepo $ devpod clone https://github.com/myorg/myrepo.git
        - 'heading "devpod feature / fix / docs / chore / start #" [level=3] [ref=e258]':
          - text: devpod feature / fix / docs / chore / start
          - link "#" [ref=e259] [cursor=pointer]:
            - /url: "#cmd-feature"
        - paragraph [ref=e260]: Start a new unit of work. Each variant sets a conventional commit prefix.
        - generic [ref=e261]:
          - generic [ref=e262]:
            - generic [ref=e263]: Terminal
            - button "Copy" [ref=e264] [cursor=pointer]
          - generic [ref=e265]: "$ devpod feature \"add user search\" # prefix: feat $ devpod fix \"null pointer in auth\" # prefix: fix $ devpod docs \"add API examples\" # prefix: docs $ devpod chore \"update CI config\" # prefix: chore $ devpod start \"custom-prefix\" \"desc\" # custom prefix"
        - 'heading "devpod diff #" [level=3] [ref=e266]':
          - text: devpod diff
          - link "#" [ref=e267] [cursor=pointer]:
            - /url: "#cmd-diff"
        - paragraph [ref=e268]: Create or update a diff. This is the primary command you'll use — it stages all changes and creates a versioned snapshot.
        - generic [ref=e269]:
          - generic [ref=e270]:
            - generic [ref=e271]: Usage
            - button "Copy" [ref=e272] [cursor=pointer]
          - generic [ref=e273]: "# Create a new diff with a message $ devpod diff \"add login API\" # Create a diff with auto-generated title (requires LLM config) $ devpod diff # Edit an existing diff (switch to it for editing) $ devpod diff edit D1 # After editing, save changes (creates a new version) $ devpod diff # Continue after resolving conflicts $ devpod diff --continue # Abort an in-progress operation $ devpod diff --abort # Preview what would be included in the diff $ devpod diff --preview # View version history of a diff $ devpod diff versions D1 # Compare two versions of a diff $ devpod diff compare D1:v1 D1:v2 # Check diff status (CI results, review status) $ devpod diff check"
        - 'heading "devpod sync #" [level=3] [ref=e274]':
          - text: devpod sync
          - link "#" [ref=e275] [cursor=pointer]:
            - /url: "#cmd-sync"
        - paragraph [ref=e276]: Pull latest changes from the main branch and rebase your diffs on top.
        - generic [ref=e277]:
          - generic [ref=e278]:
            - generic [ref=e279]: Terminal
            - button "Copy" [ref=e280] [cursor=pointer]
          - generic [ref=e281]: "$ devpod sync # Continue after resolving conflicts $ devpod sync --continue # Abort a sync in progress $ devpod sync --abort"
        - 'heading "devpod switch #" [level=3] [ref=e282]':
          - text: devpod switch
          - link "#" [ref=e283] [cursor=pointer]:
            - /url: "#cmd-switch"
        - paragraph [ref=e284]: Switch between features. Shows an interactive picker if no argument is given.
        - generic [ref=e285]:
          - generic [ref=e286]:
            - generic [ref=e287]: Terminal
            - button "Copy" [ref=e288] [cursor=pointer]
          - generic [ref=e289]: "$ devpod switch # interactive picker $ devpod switch feat/add-search # switch directly"
        - 'heading "devpod submit #" [level=3] [ref=e290]':
          - text: devpod submit
          - link "#" [ref=e291] [cursor=pointer]:
            - /url: "#cmd-submit"
        - paragraph [ref=e292]: Push diffs to GitHub as PRs and open the dashboard.
        - generic [ref=e293]:
          - generic [ref=e294]:
            - generic [ref=e295]: Terminal
            - button "Copy" [ref=e296] [cursor=pointer]
          - generic [ref=e297]: "$ devpod submit # Preview what would be submitted without pushing $ devpod submit --preview"
        - 'heading "devpod land #" [level=3] [ref=e298]':
          - text: devpod land
          - link "#" [ref=e299] [cursor=pointer]:
            - /url: "#cmd-land"
        - paragraph [ref=e300]: Merge approved diffs to the main branch.
        - generic [ref=e301]:
          - generic [ref=e302]:
            - generic [ref=e303]: Terminal
            - button "Copy" [ref=e304] [cursor=pointer]
          - generic [ref=e305]: "$ devpod land # Force land without approval checks $ devpod land --force"
        - 'heading "devpod features #" [level=3] [ref=e306]':
          - text: devpod features
          - link "#" [ref=e307] [cursor=pointer]:
            - /url: "#cmd-features"
        - paragraph [ref=e308]: List all features in progress.
        - generic [ref=e309]:
          - generic [ref=e310]:
            - generic [ref=e311]: Terminal
            - button "Copy" [ref=e312] [cursor=pointer]
          - generic [ref=e313]: $ devpod features * feat/add-search (2 diffs, current) fix/login-timeout (1 diff) docs/api-reference (0 diffs)
        - 'heading "devpod diffs #" [level=3] [ref=e314]':
          - text: devpod diffs
          - link "#" [ref=e315] [cursor=pointer]:
            - /url: "#cmd-diffs"
        - paragraph [ref=e316]: List all diffs in the current feature.
        - generic [ref=e317]:
          - generic [ref=e318]:
            - generic [ref=e319]: Terminal
            - button "Copy" [ref=e320] [cursor=pointer]
          - generic [ref=e321]: "$ devpod diffs D1 feat(auth): add API endpoints v2 +200/-10 3 files D2 feat(auth): add login form v1 +150/-0 2 files"
        - 'heading "devpod context #" [level=3] [ref=e322]':
          - text: devpod context
          - link "#" [ref=e323] [cursor=pointer]:
            - /url: "#cmd-context"
        - paragraph [ref=e324]: "Show current context: which feature you're on, which diff, and the state of things."
        - generic [ref=e325]:
          - generic [ref=e326]:
            - generic [ref=e327]: Terminal
            - button "Copy" [ref=e328] [cursor=pointer]
          - generic [ref=e329]: "$ devpod context Feature: feat/add-search Diff: D2 (latest) Branch: feat/add-search Base: main Diffs: 2 (D1 submitted, D2 in progress)"
        - 'heading "devpod status #" [level=3] [ref=e330]':
          - text: devpod status
          - link "#" [ref=e331] [cursor=pointer]:
            - /url: "#cmd-status"
        - paragraph [ref=e332]: Show uncommitted changes in the working directory.
        - generic [ref=e333]:
          - generic [ref=e334]:
            - generic [ref=e335]: Terminal
            - button "Copy" [ref=e336] [cursor=pointer]
          - generic [ref=e337]: "$ devpod status Modified: src/auth/api.go Added: src/auth/middleware.go 2 files changed"
        - 'heading "devpod log #" [level=3] [ref=e338]':
          - text: devpod log
          - link "#" [ref=e339] [cursor=pointer]:
            - /url: "#cmd-log"
        - paragraph [ref=e340]: Show the history of diffs and versions for the current feature.
        - generic [ref=e341]:
          - generic [ref=e342]:
            - generic [ref=e343]: Terminal
            - button "Copy" [ref=e344] [cursor=pointer]
          - generic [ref=e345]: $ devpod log
        - 'heading "devpod undo #" [level=3] [ref=e346]':
          - text: devpod undo
          - link "#" [ref=e347] [cursor=pointer]:
            - /url: "#cmd-undo"
        - paragraph [ref=e348]: Undo the last operation. Keeps a history you can browse.
        - generic [ref=e349]:
          - generic [ref=e350]:
            - generic [ref=e351]: Terminal
            - button "Copy" [ref=e352] [cursor=pointer]
          - generic [ref=e353]: "$ devpod undo # undo last operation $ devpod undo --list # show undo history"
        - 'heading "devpod split #" [level=3] [ref=e354]':
          - text: devpod split
          - link "#" [ref=e355] [cursor=pointer]:
            - /url: "#cmd-split"
        - paragraph [ref=e356]: Split a diff into multiple smaller diffs. Useful when a diff grows too large.
        - generic [ref=e357]:
          - generic [ref=e358]:
            - generic [ref=e359]: Terminal
            - button "Copy" [ref=e360] [cursor=pointer]
          - generic [ref=e361]: $ devpod split
        - 'heading "devpod config #" [level=3] [ref=e362]':
          - text: devpod config
          - link "#" [ref=e363] [cursor=pointer]:
            - /url: "#cmd-config"
        - paragraph [ref=e364]: Get and set configuration values.
        - generic [ref=e365]:
          - generic [ref=e366]:
            - generic [ref=e367]: Terminal
            - button "Copy" [ref=e368] [cursor=pointer]
          - generic [ref=e369]: $ devpod config set llm.provider anthropic $ devpod config set llm.api_key sk-ant-... $ devpod config get llm.provider $ devpod config set ci.auto_run true $ devpod config set default_branch main
        - 'heading "devpod runner #" [level=3] [ref=e370]':
          - text: devpod runner
          - link "#" [ref=e371] [cursor=pointer]:
            - /url: "#cmd-runner"
        - paragraph [ref=e372]: Manage the local CI runner daemon.
        - generic [ref=e373]:
          - generic [ref=e374]:
            - generic [ref=e375]: Terminal
            - button "Copy" [ref=e376] [cursor=pointer]
          - generic [ref=e377]: "$ devpod runner start # start the daemon $ devpod runner stop # stop the daemon $ devpod runner status # check if running"
        - 'heading "devpod run #" [level=3] [ref=e378]':
          - text: devpod run
          - link "#" [ref=e379] [cursor=pointer]:
            - /url: "#cmd-run"
        - paragraph [ref=e380]: Run a specific workflow locally.
        - generic [ref=e381]:
          - generic [ref=e382]:
            - generic [ref=e383]: Terminal
            - button "Copy" [ref=e384] [cursor=pointer]
          - generic [ref=e385]: "$ devpod run ci.yml # run a specific workflow $ devpod run ci.yml --job test # run a specific job"
        - 'heading "devpod runs #" [level=3] [ref=e386]':
          - text: devpod runs
          - link "#" [ref=e387] [cursor=pointer]:
            - /url: "#cmd-runs"
        - paragraph [ref=e388]: List recent CI runs.
        - generic [ref=e389]:
          - generic [ref=e390]:
            - generic [ref=e391]: Terminal
            - button "Copy" [ref=e392] [cursor=pointer]
          - generic [ref=e393]: $ devpod runs
        - 'heading "devpod workflows #" [level=3] [ref=e394]':
          - text: devpod workflows
          - link "#" [ref=e395] [cursor=pointer]:
            - /url: "#cmd-workflows"
        - paragraph [ref=e396]: List available GitHub Actions workflows in the repository.
        - generic [ref=e397]:
          - generic [ref=e398]:
            - generic [ref=e399]: Terminal
            - button "Copy" [ref=e400] [cursor=pointer]
          - generic [ref=e401]: $ devpod workflows ci.yml CI Pipeline deploy.yml Deploy to Production lint.yml Lint and Format
        - 'heading "devpod secret #" [level=3] [ref=e402]':
          - text: devpod secret
          - link "#" [ref=e403] [cursor=pointer]:
            - /url: "#cmd-secret"
        - paragraph [ref=e404]: Manage secrets for local CI runs. Secrets are stored encrypted on your machine.
        - generic [ref=e405]:
          - generic [ref=e406]:
            - generic [ref=e407]: Terminal
            - button "Copy" [ref=e408] [cursor=pointer]
          - generic [ref=e409]: "$ devpod secret set NPM_TOKEN # prompts for value $ devpod secret list # list secret names $ devpod secret delete NPM_TOKEN # delete a secret $ devpod secret import .env # import from .env file $ devpod secret sync # sync from GitHub secrets $ devpod secret status # show which secrets are set"
        - 'heading "devpod dashboard #" [level=3] [ref=e410]':
          - text: devpod dashboard
          - link "#" [ref=e411] [cursor=pointer]:
            - /url: "#cmd-dashboard"
        - paragraph [ref=e412]: Open the web dashboard for reviewing diffs, viewing CI results, and browsing version history.
        - generic [ref=e413]:
          - generic [ref=e414]:
            - generic [ref=e415]: Terminal
            - button "Copy" [ref=e416] [cursor=pointer]
          - generic [ref=e417]: "$ devpod dashboard Dashboard: http://localhost:3000"
        - 'heading "Workflows #" [level=2] [ref=e418]':
          - text: Workflows
          - link "#" [ref=e419] [cursor=pointer]:
            - /url: "#workflows"
        - paragraph [ref=e420]: Common workflows for different scenarios. These show how devpod commands compose together in real-world usage.
        - 'heading "Solo Developer Workflow #" [level=3] [ref=e421]':
          - text: Solo Developer Workflow
          - link "#" [ref=e422] [cursor=pointer]:
            - /url: "#wf-solo"
        - paragraph [ref=e423]: "When you're working alone on a project:"
        - generic [ref=e424]:
          - generic [ref=e425]:
            - generic [ref=e426]: Solo Workflow
            - button "Copy" [ref=e427] [cursor=pointer]
          - generic [ref=e428]: "$ devpod clone myorg/myrepo $ cd myrepo $ devpod feature \"add search\" # make changes... $ devpod diff \"add search backend\" # make more changes... $ devpod diff \"add search UI\" # ready to ship $ devpod submit $ devpod land"
        - 'heading "Team Workflow #" [level=3] [ref=e429]':
          - text: Team Workflow
          - link "#" [ref=e430] [cursor=pointer]:
            - /url: "#wf-team"
        - paragraph [ref=e431]: When working with a team. Your teammates don't need devpod — they review on GitHub as usual.
        - generic [ref=e432]:
          - generic [ref=e433]:
            - generic [ref=e434]: Team Workflow
            - button "Copy" [ref=e435] [cursor=pointer]
          - generic [ref=e436]: "$ devpod feature \"add payment processing\" # first piece: the API $ devpod diff \"add payment API\" # second piece: the webhook handler $ devpod diff \"add webhook handler\" # submit both for review (creates 2 linked PRs) $ devpod submit # teammate reviews on GitHub, requests changes to D1 $ devpod diff edit D1 # make changes... $ devpod diff # re-submit (D2 auto-rebases) $ devpod submit # after approval $ devpod land"
        - 'heading "Open Source Contributor Workflow #" [level=3] [ref=e437]':
          - text: Open Source Contributor Workflow
          - link "#" [ref=e438] [cursor=pointer]:
            - /url: "#wf-oss"
        - paragraph [ref=e439]: "Contributing to an open source project you don't own:"
        - generic [ref=e440]:
          - generic [ref=e441]:
            - generic [ref=e442]: Open Source Workflow
            - button "Copy" [ref=e443] [cursor=pointer]
          - generic [ref=e444]: "$ devpod clone someorg/cool-project $ cd cool-project $ devpod fix \"handle edge case in parser\" # make the fix $ devpod diff \"fix off-by-one in token parser\" # submit creates a PR from your fork $ devpod submit"
        - 'heading "Stacking Multiple Diffs #" [level=3] [ref=e445]':
          - text: Stacking Multiple Diffs
          - link "#" [ref=e446] [cursor=pointer]:
            - /url: "#wf-stacking"
        - paragraph [ref=e447]: "The real power of devpod. Break a large feature into small, reviewable pieces:"
        - generic [ref=e448]:
          - generic [ref=e449]:
            - generic [ref=e450]: Stacking Example
            - button "Copy" [ref=e451] [cursor=pointer]
          - generic [ref=e452]: "$ devpod feature \"user profiles\" # D1: database schema $ devpod diff \"add user profile schema\" # D2: API endpoints (builds on D1) $ devpod diff \"add profile API endpoints\" # D3: frontend (builds on D2) $ devpod diff \"add profile page UI\" # Submit all 3 as linked PRs $ devpod submit # Reviewer can approve D1 independently # Land D1 first, D2 and D3 auto-rebase $ devpod land"
        - 'heading "Editing a Diff in the Middle of a Stack #" [level=3] [ref=e453]':
          - text: Editing a Diff in the Middle of a Stack
          - link "#" [ref=e454] [cursor=pointer]:
            - /url: "#wf-editing-stack"
        - paragraph [ref=e455]: "One of devpod's killer features. Edit any diff in the stack, and subsequent diffs rebase automatically:"
        - generic [ref=e456]:
          - generic [ref=e457]:
            - generic [ref=e458]: Editing a Stack
            - button "Copy" [ref=e459] [cursor=pointer]
          - generic [ref=e460]: "# You have D1, D2, D3. Reviewer wants changes to D1. $ devpod diff edit D1 # make changes to D1... $ devpod diff ✓ Updated D1 → v2 D2 rebased automatically. D3 rebased automatically."
        - 'heading "Resolving Conflicts #" [level=3] [ref=e461]':
          - text: Resolving Conflicts
          - link "#" [ref=e462] [cursor=pointer]:
            - /url: "#wf-conflicts"
        - paragraph [ref=e463]:
          - text: Conflicts can happen during
          - code [ref=e464]: devpod sync
          - text: "or when editing a diff in a stack. devpod guides you through resolution:"
        - generic [ref=e465]:
          - generic [ref=e466]:
            - generic [ref=e467]: Conflict Resolution
            - button "Copy" [ref=e468] [cursor=pointer]
          - generic [ref=e469]: "$ devpod sync Conflict in src/auth/api.go # Edit the file, remove conflict markers # (<<<<<<<, =======, >>>>>>>) $ devpod sync --continue ✓ Synced successfully # Or abort if you want to start over: $ devpod sync --abort"
        - 'heading "Working Offline #" [level=3] [ref=e470]':
          - text: Working Offline
          - link "#" [ref=e471] [cursor=pointer]:
            - /url: "#wf-offline"
        - paragraph [ref=e472]:
          - text: devpod works fully offline. You can create features, save diffs, edit stacks, and run local CI without a network connection. Just
          - code [ref=e473]: devpod submit
          - text: when you're back online.
        - generic [ref=e474]:
          - generic [ref=e475]:
            - generic [ref=e476]: Offline Workflow
            - button "Copy" [ref=e477] [cursor=pointer]
          - generic [ref=e478]: "# All of these work offline: $ devpod feature \"offline work\" $ devpod diff \"add feature\" $ devpod diff edit D1 $ devpod diff $ devpod diffs $ devpod context $ devpod run ci.yml # When back online: $ devpod sync $ devpod submit"
        - 'heading "The Dashboard #" [level=2] [ref=e479]':
          - text: The Dashboard
          - link "#" [ref=e480] [cursor=pointer]:
            - /url: "#dashboard"
        - paragraph [ref=e481]: devpod includes a web-based dashboard for reviewing diffs. It uses the Monaco Editor (the same engine as VS Code) for syntax-highlighted, side-by-side diff viewing.
        - 'heading "Reviewing Diffs #" [level=3] [ref=e482]':
          - text: Reviewing Diffs
          - link "#" [ref=e483] [cursor=pointer]:
            - /url: "#dashboard-diffs"
        - paragraph [ref=e484]: "Open the dashboard after submitting:"
        - generic [ref=e485]:
          - generic [ref=e486]:
            - generic [ref=e487]: Terminal
            - button "Copy" [ref=e488] [cursor=pointer]
          - generic [ref=e489]: "$ devpod dashboard Dashboard: http://localhost:3000"
        - paragraph [ref=e490]: "The dashboard shows:"
        - list [ref=e491]:
          - listitem [ref=e492]: All diffs in the current feature, with their stack order
          - listitem [ref=e493]: File changes for each diff with syntax highlighting
          - listitem [ref=e494]: Side-by-side or unified diff view
          - listitem [ref=e495]: CI run results
          - listitem [ref=e496]: Version history for each diff
        - 'heading "Version History #" [level=3] [ref=e497]':
          - text: Version History
          - link "#" [ref=e498] [cursor=pointer]:
            - /url: "#dashboard-versions"
        - paragraph [ref=e499]: Every time you update a diff, a new version is saved. The dashboard lets you compare any two versions — true interdiff. This is especially valuable for reviewers who want to see "what changed since my last review?" instead of re-reading the entire diff.
        - 'heading "Keyboard Shortcuts #" [level=3] [ref=e500]':
          - text: Keyboard Shortcuts
          - link "#" [ref=e501] [cursor=pointer]:
            - /url: "#dashboard-shortcuts"
        - table [ref=e502]:
          - rowgroup [ref=e503]:
            - row "Shortcut Action" [ref=e504]:
              - columnheader "Shortcut" [ref=e505]
              - columnheader "Action" [ref=e506]
          - rowgroup [ref=e507]:
            - row "j / k Navigate between files" [ref=e508]:
              - cell "j / k" [ref=e509]:
                - code [ref=e510]: j
                - text: /
                - code [ref=e511]: k
              - cell "Navigate between files" [ref=e512]
            - row "n / p Next / previous diff in stack" [ref=e513]:
              - cell "n / p" [ref=e514]:
                - code [ref=e515]: "n"
                - text: /
                - code [ref=e516]: p
              - cell "Next / previous diff in stack" [ref=e517]
            - row "s Toggle side-by-side / unified" [ref=e518]:
              - cell "s" [ref=e519]:
                - code [ref=e520]: s
              - cell "Toggle side-by-side / unified" [ref=e521]
            - row "v Open version picker" [ref=e522]:
              - cell "v" [ref=e523]:
                - code [ref=e524]: v
              - cell "Open version picker" [ref=e525]
            - row "t Toggle theme (dark / light / system)" [ref=e526]:
              - cell "t" [ref=e527]:
                - code [ref=e528]: t
              - cell "Toggle theme (dark / light / system)" [ref=e529]
            - row "? Show keyboard shortcuts" [ref=e530]:
              - cell "?" [ref=e531]:
                - code [ref=e532]: "?"
              - cell "Show keyboard shortcuts" [ref=e533]
        - 'heading "Local CI Runner #" [level=2] [ref=e534]':
          - text: Local CI Runner
          - link "#" [ref=e535] [cursor=pointer]:
            - /url: "#local-ci"
        - paragraph [ref=e536]: devpod can run your GitHub Actions workflows locally. Same YAML files, same marketplace actions. Catch bugs in seconds on your machine instead of waiting for GitHub's CI.
        - 'heading "Starting the Runner #" [level=3] [ref=e537]':
          - text: Starting the Runner
          - link "#" [ref=e538] [cursor=pointer]:
            - /url: "#ci-runner"
        - paragraph [ref=e539]: The runner is a background daemon that watches for changes and runs workflows automatically (if configured).
        - generic [ref=e540]:
          - generic [ref=e541]:
            - generic [ref=e542]: Terminal
            - button "Copy" [ref=e543] [cursor=pointer]
          - generic [ref=e544]: "$ devpod runner start ✓ Runner started (PID 12345) $ devpod runner status Runner: running (PID 12345) $ devpod runner stop ✓ Runner stopped"
        - 'heading "Running Workflows #" [level=3] [ref=e545]':
          - text: Running Workflows
          - link "#" [ref=e546] [cursor=pointer]:
            - /url: "#ci-running"
        - paragraph [ref=e547]: Run workflows manually or let the runner trigger them automatically on each diff.
        - generic [ref=e548]:
          - generic [ref=e549]:
            - generic [ref=e550]: Terminal
            - button "Copy" [ref=e551] [cursor=pointer]
          - generic [ref=e552]: "# List available workflows $ devpod workflows # Run a specific workflow $ devpod run ci.yml # Run a specific job within a workflow $ devpod run ci.yml --job test # View recent runs $ devpod runs # Enable auto-run (runs CI on every diff) $ devpod config set ci.auto_run true"
        - 'heading "Secrets Management #" [level=3] [ref=e553]':
          - text: Secrets Management
          - link "#" [ref=e554] [cursor=pointer]:
            - /url: "#ci-secrets"
        - paragraph [ref=e555]: Your workflows likely need secrets (API keys, tokens). devpod stores these encrypted on your machine.
        - generic [ref=e556]:
          - generic [ref=e557]:
            - generic [ref=e558]: Terminal
            - button "Copy" [ref=e559] [cursor=pointer]
          - generic [ref=e560]: "# Set a secret (prompts for value) $ devpod secret set NPM_TOKEN # Import secrets from a .env file $ devpod secret import .env # Sync from GitHub repository secrets $ devpod secret sync # List configured secrets $ devpod secret list NPM_TOKEN (set) GITHUB_TOKEN (set) AWS_ACCESS_KEY (not set) # Check status of all required secrets $ devpod secret status"
        - generic [ref=e561]:
          - generic [ref=e562]: How it works
          - paragraph [ref=e563]:
            - text: devpod reads your
            - code [ref=e564]: .github/workflows/*.yml
            - text: files, parses the workflow definitions, and executes them locally using Docker containers (when available) or direct process execution. Marketplace actions are fetched and cached locally.
        - 'heading "Configuration #" [level=2] [ref=e565]':
          - text: Configuration
          - link "#" [ref=e566] [cursor=pointer]:
            - /url: "#configuration"
        - paragraph [ref=e567]:
          - text: devpod configuration is stored per-repository. Use
          - code [ref=e568]: devpod config
          - text: to manage it.
        - 'heading "LLM Setup #" [level=3] [ref=e569]':
          - text: LLM Setup
          - link "#" [ref=e570] [cursor=pointer]:
            - /url: "#config-llm"
        - paragraph [ref=e571]: "devpod can use an LLM to auto-generate diff titles from your code changes. Supported providers:"
        - table [ref=e572]:
          - rowgroup [ref=e573]:
            - row "Provider Configuration" [ref=e574]:
              - columnheader "Provider" [ref=e575]
              - columnheader "Configuration" [ref=e576]
          - rowgroup [ref=e577]:
            - row "Anthropic devpod config set llm.provider anthropic devpod config set llm.api_key sk-ant-..." [ref=e578]:
              - cell "Anthropic" [ref=e579]:
                - strong [ref=e580]: Anthropic
              - cell "devpod config set llm.provider anthropic devpod config set llm.api_key sk-ant-..." [ref=e581]:
                - code [ref=e582]: devpod config set llm.provider anthropic
                - code [ref=e583]: devpod config set llm.api_key sk-ant-...
            - row "OpenAI devpod config set llm.provider openai devpod config set llm.api_key sk-..." [ref=e584]:
              - cell "OpenAI" [ref=e585]:
                - strong [ref=e586]: OpenAI
              - cell "devpod config set llm.provider openai devpod config set llm.api_key sk-..." [ref=e587]:
                - code [ref=e588]: devpod config set llm.provider openai
                - code [ref=e589]: devpod config set llm.api_key sk-...
            - row "Ollama (local) devpod config set llm.provider ollama devpod config set llm.model codellama" [ref=e590]:
              - cell "Ollama (local)" [ref=e591]:
                - strong [ref=e592]: Ollama
                - text: (local)
              - cell "devpod config set llm.provider ollama devpod config set llm.model codellama" [ref=e593]:
                - code [ref=e594]: devpod config set llm.provider ollama
                - code [ref=e595]: devpod config set llm.model codellama
            - row "Custom devpod config set llm.provider custom devpod config set llm.endpoint https://..." [ref=e596]:
              - cell "Custom" [ref=e597]:
                - strong [ref=e598]: Custom
              - cell "devpod config set llm.provider custom devpod config set llm.endpoint https://..." [ref=e599]:
                - code [ref=e600]: devpod config set llm.provider custom
                - code [ref=e601]: devpod config set llm.endpoint https://...
        - 'heading "CI Auto-Run #" [level=3] [ref=e602]':
          - text: CI Auto-Run
          - link "#" [ref=e603] [cursor=pointer]:
            - /url: "#config-ci"
        - paragraph [ref=e604]: "Enable automatic CI runs whenever you create or update a diff:"
        - generic [ref=e605]:
          - generic [ref=e606]:
            - generic [ref=e607]: Terminal
            - button "Copy" [ref=e608] [cursor=pointer]
          - generic [ref=e609]: $ devpod config set ci.auto_run true
        - 'heading "Default Branch #" [level=3] [ref=e610]':
          - text: Default Branch
          - link "#" [ref=e611] [cursor=pointer]:
            - /url: "#config-branch"
        - paragraph [ref=e612]:
          - text: Set the default branch if your repo uses something other than
          - code [ref=e613]: main
          - text: ":"
        - generic [ref=e614]:
          - generic [ref=e615]:
            - generic [ref=e616]: Terminal
            - button "Copy" [ref=e617] [cursor=pointer]
          - generic [ref=e618]: $ devpod config set default_branch develop
        - 'heading "For AI Agents #" [level=2] [ref=e619]':
          - text: For AI Agents
          - link "#" [ref=e620] [cursor=pointer]:
            - /url: "#ai-agents"
        - generic [ref=e621]:
          - generic [ref=e622]: Agent Instructions
          - paragraph [ref=e623]: This section is designed to be read by AI coding agents (Claude, GPT, Copilot, etc.) to enable them to use devpod on behalf of a developer.
        - heading "Quick Start for Agents" [level=3] [ref=e624]
        - generic [ref=e625]:
          - generic [ref=e626]:
            - generic [ref=e627]: Agent Protocol
            - button "Copy" [ref=e628] [cursor=pointer]
          - generic [ref=e629]: "# 1. Check if devpod is installed $ devpod --version # 2. If not installed: $ curl -fsSL https://raw.githubusercontent.com/elloloop/devpod/main/install.sh | sh # 3. Navigate to the repository $ cd /path/to/repo # 4. Start a feature $ devpod feature \"description of work\" # 5. Make code changes # 6. Create a diff $ devpod diff \"what you did\" # 7. If more changes needed, repeat steps 5-6 # (this creates stacked diffs: D1, D2, D3...) # 8. Submit for review $ devpod submit # 9. After approval $ devpod land"
        - heading "Key Rules for Agents" [level=3] [ref=e630]
        - list [ref=e631]:
          - listitem [ref=e632]:
            - strong [ref=e633]:
              - text: Always
              - code [ref=e634]: devpod diff
              - text: before
              - code [ref=e635]: devpod sync
            - text: — save changes first, then sync. Sync requires a clean working directory.
          - listitem [ref=e636]:
            - strong [ref=e637]: One logical change per diff
            - text: — keep diffs small and focused. If you're making multiple unrelated changes, use separate diffs.
          - listitem [ref=e638]:
            - strong [ref=e639]: Use conventional commit style for diff messages
            - text: — e.g., "add user validation", "fix timeout in auth handler", "update API docs".
          - listitem [ref=e640]:
            - strong [ref=e641]:
              - text: Check
              - code [ref=e642]: devpod context
              - text: if unsure where you are
            - text: — it shows the current feature, diff, and state.
          - listitem [ref=e643]:
            - strong [ref=e644]:
              - text: Check
              - code [ref=e645]: devpod status
              - text: to see uncommitted changes
            - text: — this tells you if there are changes that need to be saved as a diff.
          - listitem [ref=e646]:
            - strong [ref=e647]:
              - text: Use
              - code [ref=e648]: devpod diff --preview
            - text: to see what would be included before creating a diff.
          - listitem [ref=e649]:
            - strong [ref=e650]: If an operation fails
            - text: ", check if you need"
            - code [ref=e651]: "--continue"
            - text: or
            - code [ref=e652]: "--abort"
            - text: to resolve an interrupted operation.
        - heading "Agent Decision Tree" [level=3] [ref=e653]
        - generic [ref=e654]:
          - generic [ref=e655]:
            - generic [ref=e656]: Decision Logic
            - button "Copy" [ref=e657] [cursor=pointer]
          - generic [ref=e658]: "# Starting work? devpod feature \"description\" → make changes → devpod diff \"message\" # More changes to add? make changes → devpod diff \"message\" # creates D2, D3, etc. # Need to edit a previous diff? devpod diff edit D1 → make changes → devpod diff # Need latest code from main? devpod diff → devpod sync # always save first! # Ready for review? devpod submit # Ready to merge? devpod land # Conflict during sync? edit files → devpod sync --continue # Interrupted operation? devpod diff --continue OR devpod diff --abort # Not sure what state you are in? devpod context devpod status"
        - 'heading "Troubleshooting #" [level=2] [ref=e659]':
          - text: Troubleshooting
          - link "#" [ref=e660] [cursor=pointer]:
            - /url: "#troubleshooting"
        - paragraph [ref=e661]: Common issues and how to fix them.
        - heading "\"You have unsaved changes\"" [level=4] [ref=e662]
        - paragraph [ref=e663]:
          - text: You have modified files that aren't saved as a diff yet. Run
          - code [ref=e664]: devpod diff
          - text: to save them before proceeding.
        - generic [ref=e665]:
          - generic [ref=e666]:
            - generic [ref=e667]: Fix
            - button "Copy" [ref=e668] [cursor=pointer]
          - generic [ref=e669]: $ devpod diff
        - heading "\"A previous operation was interrupted\"" [level=4] [ref=e670]
        - paragraph [ref=e671]: A rebase, sync, or diff edit was interrupted. You need to either continue or abort.
        - generic [ref=e672]:
          - generic [ref=e673]:
            - generic [ref=e674]: Fix
            - button "Copy" [ref=e675] [cursor=pointer]
          - generic [ref=e676]: "$ devpod diff --continue # finish the operation # or $ devpod diff --abort # discard and start over"
        - heading "\"Not on a feature branch\"" [level=4] [ref=e677]
        - paragraph [ref=e678]: You're on the main branch or a branch devpod doesn't recognize. Start a new feature first.
        - generic [ref=e679]:
          - generic [ref=e680]:
            - generic [ref=e681]: Fix
            - button "Copy" [ref=e682] [cursor=pointer]
          - generic [ref=e683]: $ devpod feature "my work"
        - heading "Conflicts during sync" [level=4] [ref=e684]
        - paragraph [ref=e685]:
          - text: Your changes conflict with updates from the main branch. Edit the conflicting files, remove the conflict markers (
          - code [ref=e686]: <<<<<<<
          - text: ","
          - code [ref=e687]: =======
          - text: ","
          - code [ref=e688]: ">>>>>>>"
          - text: ), then continue.
        - generic [ref=e689]:
          - generic [ref=e690]:
            - generic [ref=e691]: Fix
            - button "Copy" [ref=e692] [cursor=pointer]
          - generic [ref=e693]: "# 1. Edit the conflicting files # 2. Remove conflict markers # 3. Continue: $ devpod sync --continue"
        - heading "Dashboard not loading" [level=4] [ref=e694]
        - paragraph [ref=e695]: Make sure the runner is started and the dashboard command has been run.
        - generic [ref=e696]:
          - generic [ref=e697]:
            - generic [ref=e698]: Fix
            - button "Copy" [ref=e699] [cursor=pointer]
          - generic [ref=e700]: $ devpod runner start $ devpod dashboard
        - heading "Need to undo something" [level=4] [ref=e701]
        - paragraph [ref=e702]: devpod tracks operations so you can undo them.
        - generic [ref=e703]:
          - generic [ref=e704]:
            - generic [ref=e705]: Fix
            - button "Copy" [ref=e706] [cursor=pointer]
          - generic [ref=e707]: "$ devpod undo --list # see what can be undone $ devpod undo # undo last operation"
        - separator [ref=e708]
        - paragraph [ref=e709]:
          - text: devpod is open source ·
          - link "GitHub" [ref=e710] [cursor=pointer]:
            - /url: https://github.com/elloloop/devpod
          - text: ·
          - link "MIT License" [ref=e711] [cursor=pointer]:
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
> 50  |         expect(overflowing).toHaveLength(0);
      |                             ^ Error: expect(received).toHaveLength(expected)
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
```