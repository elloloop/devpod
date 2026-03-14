# devpod

RunPod-ready container that works as a remote extension of your local machine. SSH in, run Claude Code, or let any AI agent operate on it directly.

Published to `ghcr.io/elloloop/devpod:latest`.

## Quick start

On RunPod (or any container platform), set:

- **Image**: `ghcr.io/elloloop/devpod:latest`
- **Environment variables**:
  - `PUBLIC_KEY` — your SSH public key
  - `ANTHROPIC_API_KEY` — for Claude Code
  - `GITHUB_TOKEN` — for gh CLI and git operations

Then connect:

```bash
ssh root@<pod-ip> -p <port>

# or launch Claude Code directly on the remote
./scripts/connect.sh <pod-ip> <port> --claude
```

## What's included

| Category | Tools |
|---|---|
| **Base** | NVIDIA CUDA 12.4.1, Ubuntu 22.04 |
| **AI/Agent** | Claude Code CLI, Node.js 22 |
| **Editor** | vim, neovim |
| **Shell** | bash, zsh, tmux, screen |
| **Search** | ripgrep, fd, fzf, bat |
| **Git** | git, git-lfs, GitHub CLI |
| **Network** | curl, wget, mosh, socat, rsync |
| **Build** | build-essential, cmake, python3, pip |
| **System** | htop, lsof, jq, tree |

## Agent usage

The container is designed so Claude Code (or any SSH-capable agent) can use it as a remote machine:

1. **API keys are forwarded** — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, etc. set at container start are available in every SSH session
2. **SSH agent forwarding** is enabled — your local SSH keys work on the remote
3. **Long session timeouts** — 12-hour idle timeout so agent sessions don't drop
4. **All the tools agents need** — git, ripgrep, fd, jq, build tools, Node.js, Python

### Use with Claude Code SSH

```bash
# From your local machine, run Claude Code against the remote
claude --ssh root@<pod-ip>:<port>
```

### Use programmatically

```bash
# Run a command on the remote
ssh -p <port> root@<pod-ip> "cd /workspace && git clone <repo> && claude -p 'fix the failing tests'"
```

## Environment variables

| Variable | Description |
|---|---|
| `PUBLIC_KEY` | SSH public key for root login (RunPod standard) |
| `AUTHORIZED_KEYS` | Additional SSH keys |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude Code |
| `OPENAI_API_KEY` | OpenAI API key |
| `GITHUB_TOKEN` | GitHub token (also authenticates `gh` CLI) |
| `HF_TOKEN` | Hugging Face token |
| `GIT_USER_NAME` | Git commit author name |
| `GIT_USER_EMAIL` | Git commit author email |
| `STARTUP_SCRIPT` | Shell commands to run on container start |

## Building locally

```bash
docker build -t devpod .
docker run -d -p 2222:22 \
  -e PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)" \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  devpod
ssh root@localhost -p 2222
```
