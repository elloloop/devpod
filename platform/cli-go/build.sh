#!/bin/bash
set -e

VERSION=${1:-"dev"}
LDFLAGS="-s -w -X github.com/elloloop/devpod/platform/cli-go/internal/commands.Version=${VERSION}"

echo "Building devpod v${VERSION}..."

# Current platform
go build -ldflags="$LDFLAGS" -o devpod ./cmd/devpod/
echo "Built: devpod ($(du -h devpod | cut -f1))"

# Cross-compile all platforms
if [ "$2" = "--all" ]; then
  for GOOS in darwin linux; do
    for GOARCH in amd64 arm64; do
      echo "Building ${GOOS}/${GOARCH}..."
      GOOS=$GOOS GOARCH=$GOARCH CGO_ENABLED=0 go build -ldflags="$LDFLAGS" -o "devpod-${GOOS}-${GOARCH}" ./cmd/devpod/
    done
  done
  echo "All platforms built"
fi
