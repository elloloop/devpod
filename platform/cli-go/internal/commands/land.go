package commands

import (
	"fmt"
	"strings"
	"time"

	"github.com/briandowns/spinner"
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
		Long: `Squash-merges the bottom diff from your stack onto main.

Diffs must be landed in order (D1 first, then D2, etc.).
After landing, remaining diffs are rebased and a snapshot is taken.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Check for pending rebase
			if err := workspace.CheckPendingRebase(); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			// Check for uncommitted changes
			if workspace.HasUncommittedChanges() {
				return fmt.Errorf("%s\n\n  Save your changes first with: devpod diff",
					format.ErrorMsg("You have unsaved changes."))
			}

			feature, err := workspace.ValidateOnFeatureBranch()
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			diffs := sortDiffsByPosition(workspace.LoadDiffsForFeature(*feature))

			if len(diffs) == 0 {
				fmt.Println(format.DimText("No diffs to land."))
				return nil
			}

			// Check if all diffs are landed (feature complete)
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
					return fmt.Errorf("%s\n\n  Use format D1, D2, etc.",
						format.ErrorMsg(fmt.Sprintf("Invalid diff label: %s.", label)))
				}

				var found *workspace.DiffData
				for i, d := range diffs {
					if d.Position == position {
						found = &diffs[i]
						break
					}
				}
				if found == nil {
					return fmt.Errorf("%s",
						format.ErrorMsg(fmt.Sprintf("%s not found.", format.DiffLabel(position))))
				}

				// Must be the bottom (lowest position) un-landed diff
				if len(unlandedDiffs) > 0 && found.Position != unlandedDiffs[0].Position {
					return fmt.Errorf("%s\n\n  Land %s first.",
						format.ErrorMsg(fmt.Sprintf("%s is not the lowest un-landed diff.", format.DiffLabel(position))),
						format.DiffLabel(unlandedDiffs[0].Position))
				}

				targetDiff = *found
			} else {
				if len(unlandedDiffs) == 0 {
					fmt.Println(format.DimText("All diffs already landed."))
					fmt.Println(format.DimText("  Start a new feature with: devpod feature \"name\""))
					return nil
				}
				targetDiff = unlandedDiffs[0]
			}

			// Check status
			if !force {
				if targetDiff.Status != "approved" && targetDiff.CI != "passed" {
					return fmt.Errorf("%s\n\n  Use --force to land anyway.",
						format.WarnMsg(fmt.Sprintf(
							"%s has not been approved and CI has not passed.",
							format.DiffLabel(targetDiff.Position))))
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

			s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
			s.Suffix = fmt.Sprintf(" Landing %s...", format.DiffLabel(targetDiff.Position))
			s.Start()

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

			s.Stop()

			// Update landed diff
			targetDiff.Status = "landed"
			targetDiff.Updated = time.Now().UTC().Format(time.RFC3339)
			_ = workspace.SaveDiff(targetDiff)

			// Remove from feature's diffs list (keep ID stable)
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

			// Take snapshot with action: land
			diffID := fmt.Sprintf("D%d", targetDiff.Position)
			_, snapErr := takeSnapshot(feature, diffID, "land", fmt.Sprintf("Land %s: %s", diffID, targetDiff.Title))
			if snapErr != nil {
				fmt.Println(format.DimText(fmt.Sprintf("  Note: snapshot failed (%s)", snapErr.Error())))
			}

			// Result
			fmt.Printf("%s Landed %s: %s\n", format.SuccessMsg("\u2713"), format.DiffLabel(targetDiff.Position), targetDiff.Title)

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
