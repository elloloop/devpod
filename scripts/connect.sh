#!/bin/bash
# Helper script to connect to a RunPod devpod instance.
#
# Usage:
#   ./connect.sh <host> <port>
#   ./connect.sh <host> <port> --claude   # launch Claude Code on the remote
#
# Examples:
#   ./connect.sh 194.68.x.x 22055
#   ./connect.sh 194.68.x.x 22055 --claude

set -e

HOST="${1:?Usage: connect.sh <host> <port> [--claude]}"
PORT="${2:?Usage: connect.sh <host> <port> [--claude]}"
MODE="${3:-}"

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ServerAliveInterval=60"

if [ "$MODE" = "--claude" ]; then
    echo "Launching Claude Code on remote ${HOST}:${PORT}..."
    # Forward ANTHROPIC_API_KEY and start claude in the remote
    ssh $SSH_OPTS -p "$PORT" \
        -o SendEnv="ANTHROPIC_API_KEY" \
        -t root@"$HOST" \
        "cd /workspace && claude"
else
    echo "Connecting to ${HOST}:${PORT}..."
    ssh $SSH_OPTS -p "$PORT" \
        -o SendEnv="ANTHROPIC_API_KEY" \
        -A root@"$HOST"
fi
