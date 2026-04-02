package commands

import (
	"fmt"
	"math"
	"os/exec"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func newUndoCmd() *cobra.Command {
	var list bool

	cmd := &cobra.Command{
		Use:   "undo",
		Short: "Undo the last action",
		Long: `Reverses the most recent devpod operation.

Each undo creates a new snapshot on the versions branch with
Action: undo, so you never lose history.

Note: landing cannot be undone because changes have already been
pushed to main.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if list {
				entries := workspace.ListUndoEntries()
				if len(entries) == 0 {
					fmt.Println(format.DimText("Nothing to undo."))
					return nil
				}

				fmt.Println("Undo history (newest first):")
				fmt.Println()

				for i := len(entries) - 1; i >= 0; i-- {
					entry := entries[i]
					timeStr := format.RelativeTime(entry.Timestamp)
					marker := "\u2022"
					if i == len(entries)-1 {
						marker = "\u25b6"
					}
					fmt.Printf("  %s %s  %s\n", marker, entry.Description, format.DimText(timeStr))
				}

				fmt.Println()
				fmt.Println(format.DimText("Run \"devpod undo\" to undo the latest action."))
				return nil
			}

			entry := workspace.GetLastUndoEntry()
			if entry == nil {
				fmt.Println(format.DimText("Nothing to undo."))
				return nil
			}

			feature := workspace.GetCurrentFeature()

			switch entry.Action {
			case "diff-create":
				// Undo diff creation: reverse the commit, take undo snapshot
				gitCmd := exec.Command("git", "reset", "HEAD~1")
				_ = gitCmd.Run()

				// Find and remove the diff from metadata
				if uuid, ok := entry.Data["uuid"].(string); ok {
					if featureSlug, ok := entry.Data["featureSlug"].(string); ok {
						f, err := workspace.LoadFeature(featureSlug)
						if err == nil && f != nil {
							var newDiffs []string
							for _, id := range f.Diffs {
								if id != uuid {
									newDiffs = append(newDiffs, id)
								}
							}
							f.Diffs = newDiffs
							_ = workspace.SaveFeature(*f)
						}
					}
				}

				// Take undo snapshot
				if feature != nil {
					_, _ = takeSnapshot(feature, "", "undo", fmt.Sprintf("Undo: %s", entry.Description))
				}

				_ = workspace.RemoveLastUndoEntry()
				fmt.Printf("%s Undone: %s\n", format.SuccessMsg("\u2713"), entry.Description)
				fmt.Println(format.DimText("  Your changes are preserved as uncommitted files."))

			case "diff-update":
				// Undo diff update: hard reset to refBefore
				gitCmd := exec.Command("git", "reset", "--hard", entry.RefBefore)
				_ = gitCmd.Run()

				if uuid, ok := entry.Data["uuid"].(string); ok {
					if previousCommit, ok := entry.Data["previousCommit"].(string); ok {
						diff, err := workspace.LoadDiff(uuid)
						if err == nil && diff != nil {
							diff.Commit = previousCommit
							diff.Version = int(math.Max(1, float64(diff.Version-1)))
							_ = workspace.SaveDiff(*diff)
						}
					}
				}

				// Take undo snapshot
				if feature != nil {
					_, _ = takeSnapshot(feature, "", "undo", fmt.Sprintf("Undo: %s", entry.Description))
				}

				_ = workspace.RemoveLastUndoEntry()
				fmt.Printf("%s Undone: %s\n", format.SuccessMsg("\u2713"), entry.Description)

			case "diff-edit":
				// Undo entering edit mode: hard reset to refBefore, clear editing state
				gitCmd := exec.Command("git", "reset", "--hard", entry.RefBefore)
				_ = gitCmd.Run()

				_ = workspace.SetEditingDiff("")
				_ = workspace.RemoveLastUndoEntry()
				fmt.Printf("%s Undone: %s\n", format.SuccessMsg("\u2713"), entry.Description)

			case "sync":
				// Undo sync: hard reset to refBefore
				gitCmd := exec.Command("git", "reset", "--hard", entry.RefBefore)
				_ = gitCmd.Run()

				// Take undo snapshot
				if feature != nil {
					_, _ = takeSnapshot(feature, "", "undo", fmt.Sprintf("Undo: %s", entry.Description))
				}

				_ = workspace.RemoveLastUndoEntry()
				fmt.Printf("%s Undone: %s\n", format.SuccessMsg("\u2713"), entry.Description)
				fmt.Println(format.DimText("  Branch reset to pre-sync state."))

			case "submit":
				// Undo submit: reset diff statuses to draft
				if diffs, ok := entry.Data["diffs"].([]interface{}); ok {
					for _, uuidRaw := range diffs {
						if uuid, ok := uuidRaw.(string); ok {
							diff, err := workspace.LoadDiff(uuid)
							if err == nil && diff != nil {
								diff.Status = "draft"
								_ = workspace.SaveDiff(*diff)
							}
						}
					}
				}

				_ = workspace.RemoveLastUndoEntry()
				fmt.Printf("%s Undone: %s\n", format.SuccessMsg("\u2713"), entry.Description)
				fmt.Println(format.DimText("  Diff statuses reset to draft."))

			case "land":
				fmt.Println(format.ErrorMsg("Cannot undo a land -- changes have already been pushed to the main codebase."))
				fmt.Println(format.DimText("If needed, revert the change manually on main."))

			default:
				// Generic undo via hard reset
				if entry.RefBefore != "" {
					gitCmd := exec.Command("git", "reset", "--hard", entry.RefBefore)
					_ = gitCmd.Run()

					// Take undo snapshot
					if feature != nil {
						_, _ = takeSnapshot(feature, "", "undo", fmt.Sprintf("Undo: %s", entry.Description))
					}

					_ = workspace.RemoveLastUndoEntry()
					fmt.Printf("%s Undone: %s\n", format.SuccessMsg("\u2713"), entry.Description)
				} else {
					fmt.Println(format.ErrorMsg(fmt.Sprintf("Cannot undo action \"%s\" -- no restore point saved.", entry.Action)))
				}
			}

			return nil
		},
	}

	cmd.Flags().BoolVar(&list, "list", false, "Show what can be undone")

	return cmd
}

// undoTakeSnapshot is called from undo to record the undo action on the versions branch.
func undoTakeSnapshot(feature *workspace.FeatureData, description string) {
	if feature == nil {
		return
	}
	headSHA, _ := git.GetHeadSHA()
	snapshotID := workspace.GetNextSnapshotID(*feature)

	trailers := git.Trailers{
		Snapshot: snapshotID,
		Action:   "undo",
		Feature:  feature.Slug,
		CleanSHA: headSHA,
		Stack:    workspace.GetStackString(*feature),
	}

	vb := feature.VersionsBranch
	if vb == "" {
		vb = workspace.VersionsBranchName(feature.Branch)
	}

	// Only take snapshot if versions branch exists
	if !git.BranchExists(vb) {
		return
	}

	_, _ = git.SnapshotToVersionsBranch(feature.Branch, vb,
		fmt.Sprintf("Undo: %s%s\n", description, git.FormatTrailers(trailers)))

	feature.SnapshotCount++
	_ = workspace.SaveFeature(*feature)

	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:      "undo-snapshot",
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		RefBefore:   headSHA,
		Description: description,
		Data:        map[string]interface{}{"snapshotId": snapshotID},
	})
}
