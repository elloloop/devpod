# devpod

Two container images for RunPod — a lightweight base for general dev work, and a GPU image with PyTorch + vLLM for running open-source LLMs (Qwen, Llama, etc.). Your local agent SSHes in and uses them as remote machines.

## Images

| Image | Tag | Use case |
|---|---|---|
| `ghcr.io/elloloop/devpod:base` | `base` / `latest` | General dev — no CUDA, small image |
| `ghcr.io/elloloop/devpod:gpu` | `gpu` | LLM inference — CUDA 12.4, PyTorch, vLLM |

## Quick start

Deploy on RunPod with the appropriate image tag and set `PUBLIC_KEY` to your SSH public key.

```bash
# Add to SSH config
./scripts/connect.sh <pod-ip> <port> --setup

# SSH in
ssh devpod
```

## GPU image — running models

```bash
# Download a model
huggingface-cli download Qwen/Qwen2.5-72B-Instruct-AWQ --local-dir /models/qwen-72b

# Serve with vLLM
vllm serve Qwen/Qwen2.5-72B-Instruct-AWQ --host 0.0.0.0 --port 8000

# Or use transformers directly
python3 -c "
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained('Qwen/Qwen2.5-7B-Instruct', device_map='auto')
tokenizer = AutoTokenizer.from_pretrained('Qwen/Qwen2.5-7B-Instruct')
print(tokenizer.decode(model.generate(**tokenizer('Hello', return_tensors='pt').to('cuda'), max_new_tokens=50)[0]))
"
```

### Supported models

Works out of the box with vLLM:
- **Qwen** — Qwen2.5 (7B, 14B, 32B, 72B), AWQ/GPTQ quantized variants
- **Llama** — Llama 3.x (8B, 70B)
- **Any HuggingFace model** supported by vLLM or transformers

Quantization libraries included (bitsandbytes, AutoGPTQ, AutoAWQ) for running larger models on fewer GPUs.

Mount `/models` as a volume to persist downloaded models across pod restarts.

## GPU image — what's installed

| Category | Packages |
|---|---|
| **PyTorch** | torch, torchvision, torchaudio (CUDA 12.4) |
| **Inference** | vLLM, transformers, accelerate, flash-attn |
| **Quantization** | bitsandbytes, auto-gptq, autoawq |
| **Tokenizers** | sentencepiece, tiktoken, tokenizers |
| **Tools** | Same dev tools as base image |

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

## Building locally

```bash
# Base image
docker build -f base.Dockerfile -t devpod:base .

# GPU image
docker build -f gpu.Dockerfile -t devpod:gpu .
```
