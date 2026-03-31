package commands

import (
	"fmt"
	"math"
	"os/exec"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func newUndoCmd() *cobra.Command {
	var list bool

	cmd := &cobra.Command{
		Use:   "undo",
		Short: "Undo the last action",
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

			switch entry.Action {
			case "diff-create":
				// Undo diff creation: reset HEAD~1 + remove diff metadata
				gitCmd := exec.Command("git", "reset", "HEAD~1")
				_ = gitCmd.Run()

				// Find and remove the diff from metadata
				if uuid, ok := entry.Data["uuid"].(string); ok {
					if featureSlug, ok := entry.Data["featureSlug"].(string); ok {
						feature, err := workspace.LoadFeature(featureSlug)
						if err == nil && feature != nil {
							var newDiffs []string
							for _, id := range feature.Diffs {
								if id != uuid {
									newDiffs = append(newDiffs, id)
								}
							}
							feature.Diffs = newDiffs
							_ = workspace.SaveFeature(*feature)
						}
					}
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

				_ = workspace.RemoveLastUndoEntry()
				fmt.Printf("%s Undone: %s\n", format.SuccessMsg("\u2713"), entry.Description)

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
				fmt.Println(format.ErrorMsg("Cannot undo a land \u2014 changes have already been pushed to the main codebase."))
				fmt.Println(format.DimText("If needed, revert the change manually."))

			default:
				// Generic undo via hard reset
				if entry.RefBefore != "" {
					gitCmd := exec.Command("git", "reset", "--hard", entry.RefBefore)
					_ = gitCmd.Run()
					_ = workspace.RemoveLastUndoEntry()
					fmt.Printf("%s Undone: %s\n", format.SuccessMsg("\u2713"), entry.Description)
				} else {
					fmt.Println(format.ErrorMsg(fmt.Sprintf("Cannot undo action \"%s\" \u2014 no restore point saved.", entry.Action)))
				}
			}

			return nil
		},
	}

	cmd.Flags().BoolVar(&list, "list", false, "Show what can be undone")

	return cmd
}
