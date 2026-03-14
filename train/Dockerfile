FROM nvidia/cuda:12.8.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV SHELL=/bin/bash

# Core system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-server \
    mosh \
    tmux \
    screen \
    vim \
    neovim \
    git \
    git-lfs \
    curl \
    wget \
    htop \
    rsync \
    unzip \
    zip \
    jq \
    less \
    tree \
    file \
    build-essential \
    cmake \
    pkg-config \
    ca-certificates \
    gnupg \
    locales \
    sudo \
    lsof \
    net-tools \
    iproute2 \
    dnsutils \
    iputils-ping \
    socat \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    ripgrep \
    fd-find \
    fzf \
    bat \
    zsh \
    ninja-build \
    && rm -rf /var/lib/apt/lists/*

# Set locale
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Node.js LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Symlink fd and bat
RUN ln -sf /usr/bin/fdfind /usr/local/bin/fd && \
    ln -sf /usr/bin/batcat /usr/local/bin/bat

# ── uv (fast Python package manager) ──────────────────────────
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# ── autoresearch ───────────────────────────────────────────────
RUN git clone https://github.com/karpathy/autoresearch.git /workspace/autoresearch
WORKDIR /workspace/autoresearch
RUN uv sync

# ── General training libraries ─────────────────────────────────
RUN pip3 install --no-cache-dir \
    transformers \
    accelerate \
    safetensors \
    huggingface-hub[cli] \
    tokenizers \
    sentencepiece \
    tiktoken \
    datasets \
    wandb \
    tensorboard

# ── SSH Setup ──────────────────────────────────────────────────
RUN mkdir -p /var/run/sshd /root/.ssh && \
    chmod 700 /root/.ssh && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#AllowAgentForwarding yes/AllowAgentForwarding yes/' /etc/ssh/sshd_config && \
    sed -i 's/#AllowTcpForwarding yes/AllowTcpForwarding yes/' /etc/ssh/sshd_config && \
    echo "AcceptEnv LANG LC_*" >> /etc/ssh/sshd_config && \
    echo "ClientAliveInterval 60" >> /etc/ssh/sshd_config && \
    echo "ClientAliveCountMax 0" >> /etc/ssh/sshd_config

RUN echo 'PATH="/root/.local/bin:/usr/local/cuda/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"' > /etc/environment && \
    echo 'LANG="en_US.UTF-8"' >> /etc/environment

RUN ssh-keygen -A

RUN mkdir -p /models
ENV HF_HOME=/models
WORKDIR /workspace

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 22
CMD ["/start.sh"]
