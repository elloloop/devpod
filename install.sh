#!/bin/sh
set -e

REPO="elloloop/devpod"
INSTALL_DIR="${DEVPOD_INSTALL_DIR:-$HOME/.local/bin}"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

case "$OS" in
  darwin|linux) ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

# Get latest release
VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
if [ -z "$VERSION" ]; then
  echo "Could not determine latest version"
  exit 1
fi

FILENAME="devpod-${OS}-${ARCH}"
URL="https://github.com/$REPO/releases/download/v${VERSION}/${FILENAME}"

echo "Installing devpod v${VERSION} (${OS}/${ARCH})..."

# Download
mkdir -p "$INSTALL_DIR"
curl -fsSL "$URL" -o "$INSTALL_DIR/devpod"
chmod +x "$INSTALL_DIR/devpod"

# Verify
if ! "$INSTALL_DIR/devpod" --version >/dev/null 2>&1; then
  echo "Installation failed — binary not working"
  exit 1
fi

echo ""
echo "devpod v${VERSION} installed to $INSTALL_DIR/devpod"
echo ""

# Check PATH
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo "Add to your PATH:"
    echo ""
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    echo ""
    echo "Add that line to ~/.zshrc or ~/.bashrc to make it permanent."
    echo ""
    ;;
esac

echo "Get started:"
echo ""
echo "  devpod clone <repo>"
echo "  devpod feature \"my feature\""
echo "  devpod diff"
echo ""
