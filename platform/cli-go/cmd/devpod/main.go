package main

import (
	"os"

	"github.com/elloloop/devpod/platform/cli-go/internal/commands"
)

func main() {
	if err := commands.NewRootCmd().Execute(); err != nil {
		os.Exit(1)
	}
}
