# devpod

Three container images for RunPod. Your local agent SSHes in and uses them as remote machines.

## Images

| Tag | Image | Purpose |
|---|---|---|
| `base` / `latest` | `ghcr.io/elloloop/devpod:base` | General dev — no CUDA, lightweight |
| `inference` | `ghcr.io/elloloop/devpod:inference` | Run LLMs — CUDA 12.4, PyTorch, vLLM, quantization |
| `train` | `ghcr.io/elloloop/devpod:train` | Train models — CUDA 12.8, PyTorch 2.9, [autoresearch](https://github.com/karpathy/autoresearch) pre-installed |

## Quick start

Deploy on RunPod with the appropriate image tag. Set `PUBLIC_KEY` to your SSH public key.

```bash
./connect.sh <pod-ip> <port> --setup
ssh devpod
```

## Inference image

Serve Qwen, Llama, and other open-source LLMs.

```bash
# Download and serve a model
vllm serve Qwen/Qwen2.5-72B-Instruct-AWQ --host 0.0.0.0 --port 8000

# Or use transformers directly
python3 -c "
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained('Qwen/Qwen2.5-7B-Instruct', device_map='auto')
tokenizer = AutoTokenizer.from_pretrained('Qwen/Qwen2.5-7B-Instruct')
print(tokenizer.decode(model.generate(**tokenizer('Hello', return_tensors='pt').to('cuda'), max_new_tokens=50)[0]))
"
```

**Included:** PyTorch (CUDA 12.4), vLLM, transformers, accelerate, flash-attn, bitsandbytes, AutoGPTQ, AutoAWQ, sentencepiece, tiktoken.

Mount `/models` to persist downloaded models across restarts.

## Train image

Autonomous LLM training research with [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

```bash
cd /workspace/autoresearch

# One-time data prep (~2 min)
uv run prepare.py

# Run a single training experiment (~5 min)
uv run train.py

# Or let an agent run autonomous experiments — point Claude at program.md
```

**Included:** CUDA 12.8, PyTorch 2.9.1, uv, autoresearch (pre-cloned + deps installed), transformers, datasets, wandb, tensorboard.

## All images include

| Category | Tools |
|---|---|
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
| `PUBLIC_KEY` | SSH public key (RunPod standard) |
| `AUTHORIZED_KEYS` | Additional SSH keys |
| `GITHUB_TOKEN` | Authenticates `gh` CLI |
| `GIT_USER_NAME` | Git author name |
| `GIT_USER_EMAIL` | Git author email |
| `HF_TOKEN` | Hugging Face token (for gated models) |
| `STARTUP_SCRIPT` | Commands to run on container start |

## Repository structure

```
base/           # General dev image (no CUDA)
inference/      # LLM inference image (CUDA + vLLM)
train/          # Training image (CUDA + autoresearch)
connect.sh      # SSH helper script
```

Each folder has its own Dockerfile, start.sh, and GitHub Actions workflow. Workflows only trigger when files in the corresponding folder change.

## Building locally

```bash
docker build -t devpod:base base/
docker build -t devpod:inference inference/
docker build -t devpod:train train/
```
