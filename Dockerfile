FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV SHELL=/bin/bash

# Core system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-server \
    tmux \
    vim \
    neovim \
    git \
    curl \
    wget \
    htop \
    rsync \
    unzip \
    zip \
    jq \
    less \
    build-essential \
    ca-certificates \
    locales \
    sudo \
    lsof \
    net-tools \
    iproute2 \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set locale
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# SSH setup
RUN mkdir -p /var/run/sshd /root/.ssh && \
    chmod 700 /root/.ssh && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    echo "AcceptEnv LANG LC_*" >> /etc/ssh/sshd_config

# Generate SSH host keys
RUN ssh-keygen -A

# Workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 22

CMD ["/start.sh"]
