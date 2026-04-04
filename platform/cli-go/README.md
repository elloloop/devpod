# devpod

Developer workflow CLI — stacked diffs, local CI, no git knowledge required.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/elloloop/devpod/main/install.sh | sh
```

## Quick Start

```sh
devpod clone myorg/myrepo        # Get a project
devpod feature "user auth"       # Start working
# ... write code ...
devpod diff                      # Save a logical change
# ... write more code ...
devpod diff                      # Save another (stacked)
devpod submit                    # Send for review
devpod land                      # Ship to main
```

## Commands

| Command | What it does |
|---|---|
| `devpod clone <repo>` | Clone and set up |
| `devpod feature/fix/docs/chore <name>` | Start work |
| `devpod diff [message]` | Create a stacked diff |
| `devpod diff edit D1` | Edit a previous diff |
| `devpod sync` | Rebase onto latest main |
| `devpod switch <name>` | Switch features |
| `devpod submit` | Submit for review |
| `devpod land` | Squash-merge to main |
| `devpod features` | List features |
| `devpod diffs` | Show diff stack |
| `devpod context` | Where am I? |
| `devpod undo` | Undo last action |
| `devpod runner start` | Start local CI runner |
| `devpod dashboard` | Start web dashboard |

## Requirements

- Git
- `gh` CLI (for GitHub integration)
