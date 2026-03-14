# devpod

RunPod-ready container that acts as a remote extension of your local machine. Your local Claude Code (or any agent) can SSH in and execute commands — build, train, compile — on remote GPU hardware.

Published to `ghcr.io/elloloop/devpod:latest`.

## Quick start

1. Deploy on RunPod with image `ghcr.io/elloloop/devpod:latest`
2. Set env var `PUBLIC_KEY` to your SSH public key
3. Connect:

```bash
# Direct SSH
ssh -p <port> root@<pod-ip>

# Or add to SSH config for easy access
./scripts/connect.sh <pod-ip> <port> --setup
ssh devpod
```

## Using with Claude Code

Once you can `ssh devpod`, your local Claude Code can run commands on the remote machine via its Bash tool:

```bash
ssh devpod "nvidia-smi"
ssh devpod "cd /workspace && git clone <repo>"
ssh devpod "cd /workspace/project && python train.py"
```

The container has everything an agent needs to operate: git, ripgrep, fd, jq, python, node, build tools, and CUDA — so commands just work without setup.

## What's included

| Category | Tools |
|---|---|
| **Base** | NVIDIA CUDA 12.4.1, Ubuntu 22.04 |
| **Editor** | vim, neovim |
| **Shell** | bash, zsh, tmux, screen |
| **Search** | ripgrep, fd, fzf, bat |
| **Git** | git, git-lfs, GitHub CLI |
| **Network** | curl, wget, mosh, socat, rsync |
| **Build** | build-essential, cmake, python3, pip, Node.js 22 |
| **System** | htop, lsof, jq, tree |

## Environment variables

| Variable | Description |
|---|---|
| `PUBLIC_KEY` | SSH public key for root login (RunPod standard) |
| `AUTHORIZED_KEYS` | Additional SSH keys |
| `GITHUB_TOKEN` | Authenticates `gh` CLI on startup |
| `GIT_USER_NAME` | Git commit author name |
| `GIT_USER_EMAIL` | Git commit author email |
| `STARTUP_SCRIPT` | Shell commands to run on container start |

## Building locally

```bash
docker build -t devpod .
docker run -d -p 2222:22 -e PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)" devpod
ssh -p 2222 root@localhost
```
