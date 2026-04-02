package commands

import (
	"fmt"
	"strings"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func startWork(name string, changeType workspace.ChangeType) error {
	// Check for uncommitted changes -- refuse if dirty
	if workspace.HasUncommittedChanges() {
		return fmt.Errorf("%s\n\n  Save your changes first with: devpod diff\n  Or stash them with: git stash",
			format.ErrorMsg("You have unsaved changes."))
	}

	// Check for pending rebase -- refuse with instructions
	if err := workspace.CheckPendingRebase(); err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	config := workspace.LoadConfig()
	slug := workspace.Slugify(name)

	// Reject names containing ~ (reserved for versions branches)
	if strings.Contains(name, "~") {
		return fmt.Errorf("%s\n\n  The ~ character is reserved. Choose a different name.",
			format.ErrorMsg("Invalid feature name."))
	}

	// Check for duplicates
	existing, _ := workspace.LoadFeature(slug)
	if existing != nil {
		return fmt.Errorf("%s\n\n  A feature named \"%s\" already exists.\n  Pick a different name, or switch to it: devpod switch \"%s\"",
			format.ErrorMsg("Duplicate feature name."), name, name)
	}

	prefix := string(changeType)
	if changeType == "unknown" {
		prefix = "feature"
	}
	branch := prefix + "/" + slug
	versionsBranch := workspace.VersionsBranchName(branch)

	// Fetch latest and create branch from origin/main
	_ = git.FetchMain()
	if err := git.CreateBranch(branch, "origin/"+config.DefaultBranch); err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	// Create feature data
	feature := workspace.FeatureData{
		Name:           name,
		Type:           changeType,
		Slug:           slug,
		Branch:         branch,
		VersionsBranch: versionsBranch,
		Created:        time.Now().UTC().Format(time.RFC3339),
		Diffs:          []string{},
		Status:         "active",
		SnapshotCount:  0,
	}

	if err := workspace.EnsureDevpodDir(); err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	// Create the versions branch (orphan, seeded from current state)
	if err := workspace.EnsureVersionsBranch(feature); err != nil {
		// Non-fatal: versions branch creation may fail in edge cases
		fmt.Println(format.DimText("  Note: could not create versions branch. It will be created on first diff."))
	}

	if err := workspace.SaveFeature(feature); err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	fmt.Printf("%s Started %s: %s\n", format.SuccessMsg("\u2713"), format.FeatureTypePrefix(string(changeType)), name)
	fmt.Println(format.DimText(fmt.Sprintf("  Branch: %s", branch)))
	fmt.Println(format.DimText(fmt.Sprintf("  Versions: %s", versionsBranch)))
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
