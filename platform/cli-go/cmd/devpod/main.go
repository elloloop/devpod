package main

import (
	"os"

	"github.com/elloloop/devpod/platform/cli-go/internal/commands"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
)

func init() {
	// Clean up stale devpod worktrees on startup (best-effort).
	git.CleanupStaleWorktrees()
}

func main() {
	if err := commands.NewRootCmd().Execute(); err != nil {
		os.Exit(1)
	}
}
