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

func newLandCmd() *cobra.Command {
	var force bool

	cmd := &cobra.Command{
		Use:   "land [label]",
		Short: "Land the lowest approved diff onto the main codebase",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			feature := workspace.GetCurrentFeature()
			if feature == nil {
				fmt.Println(format.ErrorMsg("No active feature."))
				fmt.Println(format.DimText("Start one with: devpod feature \"name\""))
				return fmt.Errorf("no active feature")
			}

			diffs := sortDiffsByPosition(workspace.LoadDiffsForFeature(*feature))

			if len(diffs) == 0 {
				fmt.Println(format.DimText("No diffs to land."))
				return nil
			}

			// Find unlanded diffs
			var unlandedDiffs []workspace.DiffData
			for _, d := range diffs {
				if d.Status != "landed" {
					unlandedDiffs = append(unlandedDiffs, d)
				}
			}

			var targetDiff workspace.DiffData

			if len(args) > 0 {
				label := args[0]
				position, ok := parseDiffPosition(label)
				if !ok {
					msg := fmt.Sprintf("Invalid diff label: %s. Use format D1, D2, etc.", label)
					fmt.Println(format.ErrorMsg(msg))
					return fmt.Errorf("%s", msg)
				}

				var found *workspace.DiffData
				for i, d := range diffs {
					if d.Position == position {
						found = &diffs[i]
						break
					}
				}
				if found == nil {
					msg := fmt.Sprintf("%s not found.", format.DiffLabel(position))
					fmt.Println(format.ErrorMsg(msg))
					return fmt.Errorf("%s", msg)
				}

				// Must be the bottom (lowest position) un-landed diff
				if len(unlandedDiffs) > 0 && found.Position != unlandedDiffs[0].Position {
					msg := fmt.Sprintf("%s is not the lowest diff. Land %s first.",
						format.DiffLabel(position), format.DiffLabel(unlandedDiffs[0].Position))
					fmt.Println(format.ErrorMsg(msg))
					return fmt.Errorf("%s", msg)
				}

				targetDiff = *found
			} else {
				if len(unlandedDiffs) == 0 {
					fmt.Println(format.DimText("All diffs already landed."))
					return nil
				}
				targetDiff = unlandedDiffs[0]
			}

			// Check status
			if !force {
				if targetDiff.Status != "approved" && targetDiff.CI != "passed" {
					fmt.Println(format.WarnMsg(fmt.Sprintf(
						"%s has not been approved and CI has not passed.",
						format.DiffLabel(targetDiff.Position))))
					fmt.Println(format.DimText("Use --force to land anyway."))
					return fmt.Errorf("not approved")
				}
			}

			// Save undo entry
			headBefore, _ := git.GetHeadSHA()
			_ = workspace.SaveUndoEntry(workspace.UndoEntry{
				Action:      "land",
				Timestamp:   time.Now().UTC().Format(time.RFC3339),
				RefBefore:   headBefore,
				Description: fmt.Sprintf("Land %s: %s", format.DiffLabel(targetDiff.Position), targetDiff.Title),
				Data: map[string]interface{}{
					"uuid":        targetDiff.UUID,
					"featureSlug": feature.Slug,
				},
			})

			config := workspace.LoadConfig()
			featureBranch := feature.Branch

			// Switch to main, pull latest
			_ = git.SwitchBranch(config.DefaultBranch)
			_ = git.FetchMain()
			_ = git.RebaseOnto("origin/" + config.DefaultBranch)

			// Cherry-pick squash the diff's commit
			_ = git.CherryPickSquash(targetDiff.Commit)
			_, _ = git.Commit(targetDiff.Title)

			// Push to main
			_ = git.PushForce(config.DefaultBranch)

			// Switch back to feature branch
			_ = git.SwitchBranch(featureBranch)

			// Rebase remaining diffs onto main
			var remainingDiffs []workspace.DiffData
			for _, d := range unlandedDiffs {
				if d.Position != targetDiff.Position {
					remainingDiffs = append(remainingDiffs, d)
				}
			}

			if len(remainingDiffs) > 0 {
				_ = git.RebaseOnto("origin/" + config.DefaultBranch)

				// Update commit SHAs for remaining diffs
				commits, _ := git.GetCommitsBetween("origin/"+config.DefaultBranch, "HEAD")
				orderedCommits := make([]git.LogEntry, len(commits))
				for i, c := range commits {
					orderedCommits[len(commits)-1-i] = c
				}
				sortedRemaining := sortDiffsByPosition(remainingDiffs)
				for i := 0; i < len(sortedRemaining) && i < len(orderedCommits); i++ {
					sortedRemaining[i].Commit = orderedCommits[i].SHA
					_ = workspace.SaveDiff(sortedRemaining[i])
				}
			}

			// Update landed diff
			targetDiff.Status = "landed"
			targetDiff.Updated = time.Now().UTC().Format(time.RFC3339)
			_ = workspace.SaveDiff(targetDiff)

			// Remove from feature's diffs list
			var newDiffs []string
			for _, id := range feature.Diffs {
				if id != targetDiff.UUID {
					newDiffs = append(newDiffs, id)
				}
			}
			feature.Diffs = newDiffs
			if len(feature.Diffs) == 0 {
				feature.Status = "complete"
			}
			_ = workspace.SaveFeature(*feature)

			// Result
			fmt.Printf("%s Landed %s: %s\n", format.SuccessMsg("\u2713"), format.DiffLabel(targetDiff.Position), targetDiff.Title)
			fmt.Printf("  History: http://localhost:3000/diffs/%s\n", format.DimText(feature.Slug))

			if len(feature.Diffs) == 0 {
				fmt.Println(format.DimText("  Feature complete! All diffs landed."))
				fmt.Println(format.DimText("  You can start a new feature with: devpod feature \"name\""))
			} else {
				remainingLoaded := workspace.LoadDiffsForFeature(*feature)
				sorted := sortDiffsByPosition(remainingLoaded)
				var stackParts []string
				for _, d := range sorted {
					stackParts = append(stackParts, fmt.Sprintf("%s %s", format.DiffLabel(d.Position), format.DiffStatusIcon(string(d.Status))))
				}
				fmt.Println(format.DimText(fmt.Sprintf("  Remaining: %s", strings.Join(stackParts, " \u2192 "))))
			}

			fmt.Println(format.NextStepHint("land"))
			return nil
		},
	}

	cmd.Flags().BoolVar(&force, "force", false, "Skip approval/CI checks")

	return cmd
}
