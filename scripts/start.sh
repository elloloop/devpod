#!/bin/bash
set -e

# ── SSH Key Setup ──────────────────────────────────────────────
if [ -n "$PUBLIC_KEY" ]; then
    echo "$PUBLIC_KEY" > /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    echo "[devpod] SSH public key installed from PUBLIC_KEY"
fi

if [ -n "$AUTHORIZED_KEYS" ]; then
    echo "$AUTHORIZED_KEYS" >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    echo "[devpod] SSH public key installed from AUTHORIZED_KEYS"
fi

# ── Persist API Keys / Env Vars for SSH Sessions ───────────────
# Any env var set on the container is available to the entrypoint,
# but NOT to SSH sessions by default. Write them to a file that
# .bashrc/.zshrc sources on login.
env_file="/etc/devpod.env"
: > "$env_file"

for var in ANTHROPIC_API_KEY OPENAI_API_KEY HF_TOKEN GITHUB_TOKEN \
           WANDB_API_KEY RUNPOD_API_KEY HUGGING_FACE_HUB_TOKEN; do
    if [ -n "${!var}" ]; then
        echo "${var}=${!var}" >> "$env_file"
        echo "[devpod] $var forwarded to SSH sessions"
    fi
done

chmod 600 "$env_file"

# ── Git Config ─────────────────────────────────────────────────
if [ -n "$GIT_USER_NAME" ]; then
    git config --global user.name "$GIT_USER_NAME"
fi
if [ -n "$GIT_USER_EMAIL" ]; then
    git config --global user.email "$GIT_USER_EMAIL"
fi

# ── GitHub CLI Auth ────────────────────────────────────────────
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null && \
        echo "[devpod] GitHub CLI authenticated" || true
fi

# ── Custom Startup Script ─────────────────────────────────────
if [ -n "$STARTUP_SCRIPT" ]; then
    echo "[devpod] Running startup script..."
    bash -c "$STARTUP_SCRIPT"
fi

# ── Start SSH ─────────────────────────────────────────────────
echo "[devpod] Starting SSH server on port 22..."
/usr/sbin/sshd -D &

echo "[devpod] Container ready."

# Keep container alive
wait
