#!/bin/bash
# Install Claude Code skills globally.
# Run: ./skills/install.sh

set -e

SKILLS_DIR="$HOME/.claude/commands"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$SKILLS_DIR"

count=0
for f in "$SCRIPT_DIR"/*.md; do
  name="$(basename "$f")"
  cp "$f" "$SKILLS_DIR/$name"
  count=$((count + 1))
done

echo "Installed $count skills to $SKILLS_DIR"
echo ""
echo "Available skills:"
for f in "$SKILLS_DIR"/*.md; do
  name="$(basename "$f" .md)"
  echo "  /$name"
done
