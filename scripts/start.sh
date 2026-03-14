#!/bin/bash
set -e

# Setup SSH public key from environment (RunPod sets PUBLIC_KEY)
if [ -n "$PUBLIC_KEY" ]; then
    echo "$PUBLIC_KEY" > /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    echo "SSH public key installed from PUBLIC_KEY env var"
fi

# Also support AUTHORIZED_KEYS env var
if [ -n "$AUTHORIZED_KEYS" ]; then
    echo "$AUTHORIZED_KEYS" >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    echo "SSH public key installed from AUTHORIZED_KEYS env var"
fi

# If a startup script is provided, run it
if [ -n "$STARTUP_SCRIPT" ]; then
    echo "Running startup script..."
    bash -c "$STARTUP_SCRIPT"
fi

# Start SSH daemon
echo "Starting SSH server..."
/usr/sbin/sshd -D &

echo "Container ready. SSH available on port 22."

# Keep container alive
wait
