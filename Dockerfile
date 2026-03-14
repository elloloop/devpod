FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

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
    ripgrep \
    fd-find \
    fzf \
    bat \
    zsh \
    stow \
    && rm -rf /var/lib/apt/lists/*

# Set locale
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Node.js LTS via nodesource
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

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Symlink fd (Ubuntu packages it as fdfind)
RUN ln -sf /usr/bin/fdfind /usr/local/bin/fd && \
    ln -sf /usr/bin/batcat /usr/local/bin/bat

# SSH setup — agent-friendly config
RUN mkdir -p /var/run/sshd /root/.ssh && \
    chmod 700 /root/.ssh && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#AllowAgentForwarding yes/AllowAgentForwarding yes/' /etc/ssh/sshd_config && \
    sed -i 's/#AllowTcpForwarding yes/AllowTcpForwarding yes/' /etc/ssh/sshd_config && \
    # Accept all env vars agents might need
    echo "AcceptEnv LANG LC_* ANTHROPIC_API_KEY OPENAI_API_KEY HF_TOKEN GITHUB_TOKEN" >> /etc/ssh/sshd_config && \
    # Long idle timeout for agent sessions
    echo "ClientAliveInterval 60" >> /etc/ssh/sshd_config && \
    echo "ClientAliveCountMax 720" >> /etc/ssh/sshd_config

# Generate SSH host keys
RUN ssh-keygen -A

# Shell config for root
RUN echo 'export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"' >> /root/.bashrc && \
    echo '[ -f /etc/devpod.env ] && set -a && source /etc/devpod.env && set +a' >> /root/.bashrc && \
    echo '[ -f /etc/devpod.env ] && set -a && source /etc/devpod.env && set +a' >> /root/.zshrc

# Workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 22

CMD ["/start.sh"]
