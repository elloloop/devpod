package commands

import (
	"fmt"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func autoSaveChanges(cwd ...string) {
	if !git.IsClean(cwd...) {
		_ = git.StageAll(cwd...)
		_, _ = git.Commit("WIP: auto-save before switching context", cwd...)
	}
}

func startWork(name string, changeType workspace.ChangeType) error {
	// Auto-save uncommitted changes on current feature
	autoSaveChanges()

	config := workspace.LoadConfig()
	slug := workspace.Slugify(name)
	prefix := string(changeType)
	if changeType == "unknown" {
		prefix = "feature"
	}
	branch := prefix + "/" + slug

	// Fetch latest and create branch
	_ = git.FetchMain()
	if err := git.CreateBranch(branch, config.DefaultBranch); err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	// Create feature data
	feature := workspace.FeatureData{
		Name:    name,
		Type:    changeType,
		Slug:    slug,
		Branch:  branch,
		Created: time.Now().UTC().Format(time.RFC3339),
		Diffs:   []string{},
		Status:  "active",
	}

	if err := workspace.EnsureDevpodDir(); err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}
	if err := workspace.SaveFeature(feature); err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	fmt.Printf("%s Started %s: %s\n", format.SuccessMsg("\u2713"), format.FeatureTypePrefix(string(changeType)), name)
	fmt.Println(format.NextStepHint("feature"))
	return nil
}

func newFeatureCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "feature <name>",
		Short: "Start a new feature",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return startWork(args[0], "feature")
		},
	}
}

func newFixCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "fix <name>",
		Short: "Start a bug fix",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return startWork(args[0], "fix")
		},
	}
}

func newDocsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "docs <name>",
		Short: "Start a documentation change",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return startWork(args[0], "docs")
		},
	}
}

func newChoreCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "chore <name>",
		Short: "Start a chore (tooling, deps, config)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return startWork(args[0], "chore")
		},
	}
}

func newStartCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "start <name>",
		Short: "Start working on something (type detected later)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return startWork(args[0], "unknown")
		},
	}
}
