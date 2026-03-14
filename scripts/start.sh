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
    echo "[devpod] Additional SSH keys installed from AUTHORIZED_KEYS"
fi

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

echo "[devpod] Container ready. Waiting for connections."

# Keep container alive
wait
