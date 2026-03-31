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

			// Current diff
			if len(diffs) > 0 {
				sorted := sortDiffsByPosition(diffs)
				var currentDiff workspace.DiffData
				if editingDiff != nil {
					currentDiff = *editingDiff
				} else {
					currentDiff = sorted[len(sorted)-1]
				}

				fmt.Printf("Diff:    %s of %d \u2014 \"%s\"  [%s]\n",
					format.DiffLabel(currentDiff.Position),
					len(diffs),
					currentDiff.Title,
					string(currentDiff.Status))

				if editingDiff != nil {
					fmt.Printf("         (editing %s)\n", format.DiffLabel(editingDiff.Position))
				}

				// Stack visualization
				var stackParts []string
				for _, d := range sorted {
					stackParts = append(stackParts, fmt.Sprintf("%s %s %s",
						format.DiffLabel(d.Position),
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
				fmt.Println("Changed since last diff:")
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
