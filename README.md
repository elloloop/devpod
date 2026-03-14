# devpod

RunPod-ready container image with SSH access and dev tools, published to GitHub Container Registry.

## Usage

Pull the image:

```bash
docker pull ghcr.io/elloloop/devpod:latest
```

On RunPod, use `ghcr.io/elloloop/devpod:latest` as the container image. Set your `PUBLIC_KEY` environment variable to your SSH public key.

Then SSH in:

```bash
ssh root@<pod-ip> -p <port>
```

## What's included

- **Base**: NVIDIA CUDA 12.4.1 (Ubuntu 22.04)
- **SSH**: OpenSSH server with key-based auth
- **Dev tools**: tmux, vim, neovim, git, curl, wget, htop, jq, build-essential
- **Python**: python3, pip, venv

## Environment variables

| Variable | Description |
|---|---|
| `PUBLIC_KEY` | SSH public key for root login (RunPod standard) |
| `AUTHORIZED_KEYS` | Additional SSH keys |
| `STARTUP_SCRIPT` | Shell commands to run on container start |

## Building locally

```bash
docker build -t devpod .
docker run -d -p 2222:22 -e PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)" devpod
ssh root@localhost -p 2222
```
