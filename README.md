# devpod

Infrastructure for AI-assisted development: container images for remote compute, and Claude Code skills for automated software delivery.

## Container Images

Three container images for RunPod. Your local agent SSHes in and uses them as remote machines.

| Tag | Image | Purpose |
|---|---|---|
| `base` / `latest` | `ghcr.io/elloloop/devpod:base` | General dev — no CUDA, lightweight |
| `inference` | `ghcr.io/elloloop/devpod:inference` | Run LLMs — CUDA 12.4, PyTorch, vLLM, quantization |
| `train` | `ghcr.io/elloloop/devpod:train` | Train models — CUDA 12.8, PyTorch 2.9, [autoresearch](https://github.com/karpathy/autoresearch) |

See [container docs](#container-details) below.

## Claude Code Skills

29 global skills that automate the entire software delivery lifecycle. Proto-first, append-only architecture that enables parallel agents with zero conflicts.

### Install

```bash
git clone https://github.com/elloloop/devpod.git
./devpod/skills/install.sh
```

This copies all skills to `~/.claude/commands/` — they're available globally in every Claude Code session.

### How to use

#### Build a new app from scratch

```bash
mkdir my-app && cd my-app && git init
gh repo create elloloop/my-app --public --source=. --push
```

Then in Claude Code:

```
/architect
```

Claude talks to you, understands what you want to build, designs the architecture, and creates a full issue tree on GitHub. Then:

```
/run 1                  # execute Wave 0 (scaffold) — sets up frozen core
                        # review PRs, merge

/run 1                  # execute Wave 1 (contracts) — defines protos in parallel
                        # review PRs, merge

/run 1                  # execute Wave 2 (components) — builds all modules/features in parallel
                        # review PRs, merge
```

Each `/run` spawns parallel agents in isolated worktrees. They can't conflict because the architecture is append-only (each module/feature is its own directory).

#### Add a feature to an existing app

```
/feature Add Stripe payments -- users can pay invoices via Stripe
```

Claude audits the existing codebase, figures out what's new vs what needs changes, and creates the issue tree. Then `/run` as above.

#### Step by step (manual control)

```
/issue Add user auth                    # create issue + branch
/init go-grpc                           # scaffold backend (frozen core + append-only modules)
/init nextjs                            # scaffold frontend (frozen core + append-only features)
/contract UserService                   # define proto contract, generate types
/backend-dev                            # build + test backend
/review                                 # principal engineer review
/backend-docker                         # docker compose E2E
/pr                                     # rebase on main, create PR
/backend-deploy                         # deploy to staging
```

Or let the ship command do it all:

```
/backend-ship 5                         # full pipeline for issue #5
/web-ship 7                             # full pipeline for issue #7
```

### Skill reference

#### Orchestration
| Skill | Purpose |
|---|---|
| `/architect` | Design a full app from a description, create issue tree |
| `/feature` | Design a feature in an existing app, create issue tree |
| `/issue` | Create GitHub issue + branch with full context chain |
| `/split` | Split issue into contract + component sub-issues |
| `/run` | Execute a wave of issues in parallel using sub-agents |

#### Contract-first development
| Skill | Purpose |
|---|---|
| `/contract` | Define proto contract, generate code, propagate to components |
| `/blocked` | Stop work, escalate missing dependency to parent issue |
| `/resolve` | Module director — triage blockers, create resolution issues |

#### Scaffolding (frozen core + append-only modules)
| Skill | Architecture |
|---|---|
| `/init nextjs` | Next.js App Router, file-system feature auto-discovery |
| `/init flutter` | GoRouter + Riverpod, feature registry |
| `/init fastapi` | FastAPI, directory-scanning module auto-discovery |
| `/init python-grpc` | grpcio, directory-scanning servicer auto-discovery |
| `/init go-grpc` | Go gRPC, `init()` self-registration |
| `/init rust-grpc` | Rust tonic, `inventory` crate compile-time registration |

#### Lifecycle
| | Web | Flutter | Backend |
|---|---|---|---|
| Build + test | `/web-dev` | `/flutter-dev` | `/backend-dev` |
| Docker E2E | `/web-docker` | `/flutter-build` | `/backend-docker` |
| Deploy | `/web-deploy` | `/flutter-deploy` | `/backend-deploy` |
| Full pipeline | `/web-ship` | `/flutter-ship` | `/backend-ship` |

#### Quality
| Skill | Purpose |
|---|---|
| `/review` | Principal engineer self-review (SOLID, DRY, security, 4 levels of tests) |
| `/pr` | Rebase on main, create PR, link issue, update parent |

### Architecture: why parallel agents can't conflict

```
backend/
  core/                 ← FROZEN after scaffold — agents never touch
  modules/
    invoice/            ← Agent A creates this entire directory
    payment/            ← Agent B creates this — different directory, zero conflict

web/
  core/                 ← FROZEN
  features/
    invoice/            ← Agent A works here
    payment/            ← Agent B works here — zero conflict
```

- **Core is frozen** — set up once in scaffold, never modified
- **Modules/features are append-only** — adding = creating a directory
- **Self-registration** — modules register themselves (Go `init()`, Python directory scan, Rust `inventory`)
- **Event bus** — inter-module communication without direct imports
- **Proto contracts** — single source of truth, generated types for all languages
- **Scope enforcement** — agents can only modify their own directory, must `/blocked` if they need something outside it

### Every step tracked on GitHub

Each skill comments progress on the GitHub issue:

```
Issue #50: Add payments
├── 📜 Contract Defined — PaymentService (3 RPCs)
├── ⚙️ Backend — Local Dev ✅ (12 tests passed)
├── ✅ Principal Engineer Review — approved
├── 🐳 Backend — Docker E2E ✅
├── 📋 PR Created — #51
├── 🚀 Staging — deployed, smoke tests ✅
└── ✅ Backend Ship Complete
```

---

## Container Details

### Quick start

Deploy on RunPod with the appropriate image tag. Set `PUBLIC_KEY` to your SSH public key.

```bash
./connect.sh <pod-ip> <port> --setup
ssh devpod
```

### Inference image

```bash
vllm serve Qwen/Qwen2.5-72B-Instruct-AWQ --host 0.0.0.0 --port 8000
```

Included: PyTorch (CUDA 12.4), vLLM, transformers, accelerate, bitsandbytes, AutoGPTQ, AutoAWQ, sentencepiece, tiktoken. Mount `/models` to persist downloads.

### Train image

```bash
cd /workspace/autoresearch
uv run prepare.py    # one-time data prep
uv run train.py      # run training experiment
```

Included: CUDA 12.8, PyTorch 2.9.1, uv, autoresearch, transformers, datasets, wandb, tensorboard.

### All images include

| Category | Tools |
|---|---|
| **Editor** | vim, neovim |
| **Shell** | bash, zsh, tmux, screen |
| **Search** | ripgrep, fd, fzf, bat |
| **Git** | git, git-lfs, GitHub CLI |
| **Network** | curl, wget, mosh, socat, rsync |
| **Build** | build-essential, cmake, python3, pip, Node.js 22 |
| **System** | htop, lsof, jq, tree |

### Environment variables

| Variable | Description |
|---|---|
| `PUBLIC_KEY` | SSH public key (RunPod standard) |
| `AUTHORIZED_KEYS` | Additional SSH keys |
| `GITHUB_TOKEN` | Authenticates `gh` CLI |
| `GIT_USER_NAME` | Git author name |
| `GIT_USER_EMAIL` | Git author email |
| `HF_TOKEN` | Hugging Face token (for gated models) |
| `STARTUP_SCRIPT` | Commands to run on container start |

### Repository structure

```
base/               # General dev container (no CUDA)
inference/          # LLM inference container (CUDA + vLLM)
train/              # Training container (CUDA + autoresearch)
skills/             # Claude Code skills (29 global slash commands)
connect.sh          # SSH helper script
```

### Building locally

```bash
docker build -t devpod:base base/
docker build -t devpod:inference inference/
docker build -t devpod:train train/
```
