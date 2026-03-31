package commands

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func sortDiffsByPosition(diffs []workspace.DiffData) []workspace.DiffData {
	sorted := make([]workspace.DiffData, len(diffs))
	copy(sorted, diffs)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Position < sorted[j].Position
	})
	return sorted
}

func updateDiffSHAs(feature *workspace.FeatureData) {
	if feature == nil {
		return
	}

	config := workspace.LoadConfig()
	diffs := sortDiffsByPosition(workspace.LoadDiffsForFeature(*feature))

	if len(diffs) == 0 {
		return
	}

	// Get the commits between default branch and HEAD
	commits, err := git.GetCommitsBetween("origin/"+config.DefaultBranch, "HEAD")
	if err != nil {
		return
	}

	// Reverse commits so oldest is first (maps to D1)
	orderedCommits := make([]git.LogEntry, len(commits))
	for i, c := range commits {
		orderedCommits[len(commits)-1-i] = c
	}

	// Map commits to diffs by position order
	for i := 0; i < len(diffs) && i < len(orderedCommits); i++ {
		diffs[i].Commit = orderedCommits[i].SHA
		diffs[i].Updated = time.Now().UTC().Format(time.RFC3339)
		_ = workspace.SaveDiff(diffs[i])
	}
}

func newSyncCmd() *cobra.Command {
	var continueSync bool
	var abortSync bool

	cmd := &cobra.Command{
		Use:   "sync",
		Short: "Sync your work with the latest code",
		RunE: func(cmd *cobra.Command, args []string) error {
			if abortSync {
				if err := git.RebaseAbort(); err != nil {
					return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
				}
				fmt.Printf("%s Sync aborted. You are back where you started.\n", format.SuccessMsg("\u2713"))
				return nil
			}

			if continueSync {
				result := git.RebaseContinue()
				if !result.Success && len(result.Conflicts) > 0 {
					fmt.Println(format.ErrorMsg("Still have conflicts:"))
					for _, file := range result.Conflicts {
						fmt.Printf("  %s\n", format.ConflictMessage(file))
					}
					fmt.Println()
					fmt.Println(format.DimText("Fix the conflicts, then run: devpod sync --continue"))
					return fmt.Errorf("conflicts remain")
				}

				feature := workspace.GetCurrentFeature()
				if feature != nil {
					_ = git.PushForce(feature.Branch)
					updateDiffSHAs(feature)
				}

				fmt.Printf("%s Synced \u2014 your work is on top of the latest code.\n", format.SuccessMsg("\u2713"))
				fmt.Println(format.NextStepHint("sync"))
				return nil
			}

			// Normal sync
			feature := workspace.GetCurrentFeature()
			if feature == nil {
				fmt.Println(format.ErrorMsg("No active feature."))
				fmt.Println(format.DimText("Start one with: devpod feature \"name\""))
				return fmt.Errorf("no active feature")
			}

			// Save undo entry
			headBefore, _ := git.GetHeadSHA()
			_ = workspace.SaveUndoEntry(workspace.UndoEntry{
				Action:      "sync",
				Timestamp:   time.Now().UTC().Format(time.RFC3339),
				RefBefore:   headBefore,
				Description: "Sync with latest code",
				Data:        map[string]interface{}{"branch": feature.Branch},
			})

			// Auto-save uncommitted changes
			autoSaveChanges()

			// Fetch and rebase
			config := workspace.LoadConfig()
			_ = git.FetchMain()

			result := git.RebaseOnto("origin/" + config.DefaultBranch)

			if !result.Success && len(result.Conflicts) > 0 {
				fmt.Println(format.ErrorMsg("Conflicts found:"))
				for _, file := range result.Conflicts {
					fmt.Printf("  %s\n", format.ConflictMessage(file))
				}
				fmt.Println()
				fmt.Println(format.DimText("Fix the conflicts, then run: devpod sync --continue"))
				return fmt.Errorf("conflicts found")
			}

			// Push and update metadata
			_ = git.PushForce(feature.Branch)
			updateDiffSHAs(feature)

			// Show result
			diffs := workspace.LoadDiffsForFeature(*feature)
			fmt.Printf("%s Synced \u2014 your work is on top of the latest code.\n", format.SuccessMsg("\u2713"))

			if len(diffs) > 0 {
				sorted := sortDiffsByPosition(diffs)
				var stackParts []string
				for _, d := range sorted {
					stackParts = append(stackParts, fmt.Sprintf("%s %s", format.DiffLabel(d.Position), format.DiffStatusIcon(string(d.Status))))
				}
				fmt.Println(format.DimText(fmt.Sprintf("  Stack: %s", strings.Join(stackParts, " \u2192 "))))
			}

			fmt.Println(format.NextStepHint("sync"))
			return nil
		},
	}

	cmd.Flags().BoolVar(&continueSync, "continue", false, "Continue after resolving conflicts")
	cmd.Flags().BoolVar(&abortSync, "abort", false, "Abort sync in progress")

	return cmd
}
