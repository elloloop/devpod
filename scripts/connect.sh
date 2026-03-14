#!/bin/bash
# Connect to a RunPod devpod instance and optionally add it to SSH config.
#
# Usage:
#   ./connect.sh <host> <port>            # SSH into the pod
#   ./connect.sh <host> <port> --setup    # Add to ~/.ssh/config as "devpod"
#
# After --setup, you can simply:
#   ssh devpod
#   scp file.txt devpod:/workspace/

set -e

HOST="${1:?Usage: connect.sh <host> <port> [--setup]}"
PORT="${2:?Usage: connect.sh <host> <port> [--setup]}"
MODE="${3:-}"

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ServerAliveInterval=60"

if [ "$MODE" = "--setup" ]; then
    # Remove existing devpod entry if present
    if grep -q "^Host devpod" ~/.ssh/config 2>/dev/null; then
        sed -i.bak '/^Host devpod$/,/^Host /{ /^Host devpod$/d; /^Host /!d; }' ~/.ssh/config
        echo "Removed existing devpod entry from ~/.ssh/config"
    fi

    cat >> ~/.ssh/config <<SSHEOF

Host devpod
    HostName $HOST
    Port $PORT
    User root
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    ServerAliveInterval 60
    ServerAliveCountMax 0
    ForwardAgent yes
SSHEOF

    echo "Added 'devpod' to ~/.ssh/config"
    echo ""
    echo "You can now use:"
    echo "  ssh devpod"
    echo "  scp file.txt devpod:/workspace/"
    echo "  rsync -avz ./project devpod:/workspace/"
else
    ssh $SSH_OPTS -A -p "$PORT" root@"$HOST"
fi
