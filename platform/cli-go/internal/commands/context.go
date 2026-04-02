package commands

import (
	"fmt"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func newContextCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "context",
		Short: "Show current position in the workflow",
		RunE: func(cmd *cobra.Command, args []string) error {
			feature := workspace.GetCurrentFeature()

			if feature == nil {
				fmt.Println(format.DimText("No active feature."))
				fmt.Println(format.DimText("Start one with: devpod feature \"name\""))
				return nil
			}

			diffs := workspace.LoadDiffsForFeature(*feature)
			editingUUID := workspace.GetEditingDiff()
			var editingDiff *workspace.DiffData
			if editingUUID != "" {
				editingDiff, _ = workspace.LoadDiff(editingUUID)
			}

			// Feature header
			fmt.Printf("Feature: %s (%s)\n", feature.Name, format.FeatureTypePrefix(string(feature.Type)))
			fmt.Printf("Branch:  %s\n", feature.Branch)

			// Versions branch info
			vb := feature.VersionsBranch
			if vb == "" {
				vb = workspace.VersionsBranchName(feature.Branch)
			}
			if git.BranchExists(vb) {
				snapLabel := "snapshots"
				if feature.SnapshotCount == 1 {
					snapLabel = "snapshot"
				}
				fmt.Printf("Versions: %s (%d %s)\n", vb, feature.SnapshotCount, snapLabel)
			}

			// Editing state
			if editingDiff != nil {
				fmt.Printf("Editing: %s: %s\n", format.DiffLabel(editingDiff.Position), editingDiff.Title)
				fmt.Println(format.DimText("  Make changes, then: devpod diff"))
			}

			// Pending rebase
			if workspace.HasPendingRebase() {
				pr := workspace.LoadPendingRebase()
				if pr != nil {
					fmt.Println()
					fmt.Println(format.WarnMsg("Interrupted operation in progress."))
					fmt.Printf("  Editing: %s\n", pr.EditingDiff)
					fmt.Printf("  Remaining picks: %d\n", len(pr.RemainingPicks))
					fmt.Println(format.DimText("  Resolve conflicts, then: devpod diff --continue"))
					fmt.Println(format.DimText("  Or cancel: devpod diff --abort"))
				}
			}

			// Current diff / stack
			if len(diffs) > 0 {
				sorted := sortDiffsByPosition(diffs)
				var currentDiff workspace.DiffData
				if editingDiff != nil {
					currentDiff = *editingDiff
				} else {
					currentDiff = sorted[len(sorted)-1]
				}

				fmt.Printf("Diff:    %s of %d -- \"%s\"  [%s]\n",
					format.DiffLabel(currentDiff.Position),
					len(diffs),
					currentDiff.Title,
					string(currentDiff.Status))

				if currentDiff.Version > 1 {
					fmt.Printf("         (version %d)\n", currentDiff.Version)
				}

				// Stack visualization
				var stackParts []string
				for _, d := range sorted {
					vLabel := ""
					if d.Version > 1 {
						vLabel = fmt.Sprintf(" v%d", d.Version)
					}
					stackParts = append(stackParts, fmt.Sprintf("%s%s %s %s",
						format.DiffLabel(d.Position),
						vLabel,
						format.DiffStatusIcon(string(d.Status)),
						string(d.Status)))
				}
				fmt.Printf("Stack:   %s\n", strings.Join(stackParts, " \u2192 "))
			} else {
				fmt.Println(format.DimText("No diffs yet."))
			}

			// Changed files since last diff
			changes, _ := git.GetChangedFiles()
			if len(changes) > 0 {
				fmt.Println()
				fmt.Printf("Changed since last diff (%d files):\n", len(changes))
				for _, change := range changes {
					var statusLabel string
					switch change.Status {
					case "added":
						statusLabel = "added"
					case "deleted":
						statusLabel = "deleted"
					default:
						statusLabel = "modified"
					}
					fmt.Printf("  %s  %s\n", statusLabel, change.Path)
				}
			}

			return nil
		},
	}
}
