package commands

import "github.com/spf13/cobra"

func NewRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:     "devpod",
		Short:   "Developer workflow CLI",
		Version: "2.0.0",
	}

	// Workflow commands
	root.AddCommand(newCloneCmd())
	root.AddCommand(newFeatureCmd())
	root.AddCommand(newFixCmd())
	root.AddCommand(newDocsCmd())
	root.AddCommand(newChoreCmd())
	root.AddCommand(newStartCmd())
	root.AddCommand(newDiffCmd())
	root.AddCommand(newSyncCmd())
	root.AddCommand(newSwitchCmd())
	root.AddCommand(newSubmitCmd())
	root.AddCommand(newLandCmd())
	root.AddCommand(newFeaturesCmd())
	root.AddCommand(newDiffsCmd())
	root.AddCommand(newContextCmd())
	root.AddCommand(newStatusCmd())
	root.AddCommand(newLogCmd())
	root.AddCommand(newUndoCmd())
	root.AddCommand(newSplitCmd())
	root.AddCommand(newConfigCmd())

	// Runner commands
	root.AddCommand(newRunnerCmd())
	root.AddCommand(newRunCmd())
	root.AddCommand(newRunsCmd())
	root.AddCommand(newWorkflowsCmd())
	root.AddCommand(newSecretCmd())
	root.AddCommand(newDashboardCmd())

	return root
}
