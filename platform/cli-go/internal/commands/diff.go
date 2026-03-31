package commands

import (
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/briandowns/spinner"
	"github.com/elloloop/devpod/platform/cli-go/internal/api"
	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/llm"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

var diffPositionRegex = regexp.MustCompile(`^[Dd](\d+)$`)

func parseDiffPosition(label string) (int, bool) {
	matches := diffPositionRegex.FindStringSubmatch(label)
	if matches == nil {
		return 0, false
	}
	pos, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0, false
	}
	return pos, true
}

func generateTitle(diffContent string, files []string, changeType workspace.ChangeType, scope string, explicitMessage string) (llm.Result, error) {
	if explicitMessage != "" {
		prefix := format.FeatureTypePrefix(string(changeType))
		return llm.Result{
			Title:       fmt.Sprintf("%s(%s): %s", prefix, scope, explicitMessage),
			Description: "",
		}, nil
	}

	if llm.IsAvailable() {
		result, err := llm.GenerateDiffMessage(diffContent, string(changeType), scope)
		if err == nil {
			return result, nil
		}
	}

	return llm.GenerateFallbackMessage(files, string(changeType), scope), nil
}

func newDiffCmd() *cobra.Command {
	var preview bool
	var update bool

	diffCmd := &cobra.Command{
		Use:   "diff [message]",
		Short: "Create or update a diff (unit of change)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			var message string
			if len(args) > 0 {
				message = args[0]
			}

			feature := workspace.GetCurrentFeature()
			if feature == nil {
				fmt.Println(format.ErrorMsg("No active feature."))
				fmt.Println(format.DimText("Start one with: devpod feature \"name\""))
				return fmt.Errorf("no active feature")
			}

			changes, err := git.GetChangedFiles()
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}
			editingUUID := workspace.GetEditingDiff()

			if len(changes) == 0 && editingUUID == "" && !update {
				fmt.Println(format.DimText("No changes to diff."))
				return nil
			}

			diffContent, _ := git.GetDiff()
			stats, _ := git.GetDiffStats()
			changedFiles := make([]string, len(changes))
			for i, c := range changes {
				changedFiles[i] = c.Path
			}
			scope := feature.Slug

			// Preview mode
			if preview {
				result, _ := generateTitle(diffContent, changedFiles, feature.Type, scope, message)
				fmt.Println("Preview:")
				fmt.Printf("  Title: %s\n", result.Title)
				if result.Description != "" {
					fmt.Printf("  Description: %s\n", result.Description)
				}
				fmt.Printf("  Files: %d (+%d -%d)\n", stats.Files, stats.Additions, stats.Deletions)
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
					fmt.Printf("    %s  %s\n", statusLabel, change.Path)
				}
				return nil
			}

			// Editing mode: update existing diff
			if editingUUID != "" || update {
				uuid := editingUUID
				editDiff, err := workspace.LoadDiff(uuid)
				if err != nil || editDiff == nil {
					fmt.Println(format.ErrorMsg("No diff is being edited."))
					return fmt.Errorf("no diff being edited")
				}

				// Save undo entry
				headBefore, _ := git.GetHeadSHA()
				_ = workspace.SaveUndoEntry(workspace.UndoEntry{
					Action:      "diff-update",
					Timestamp:   time.Now().UTC().Format(time.RFC3339),
					RefBefore:   headBefore,
					Description: fmt.Sprintf("Update %s", format.DiffLabel(editDiff.Position)),
					Data:        map[string]interface{}{"uuid": uuid, "previousCommit": editDiff.Commit},
				})

				// Stage and amend
				_ = git.StageAll()
				newSHA, err := git.Amend("")
				if err != nil {
					return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
				}

				// Update diff metadata
				editDiff.Commit = newSHA
				editDiff.Version += 1
				editDiff.Status = "draft"
				editDiff.Updated = time.Now().UTC().Format(time.RFC3339)
				if len(changedFiles) > 0 {
					editDiff.Files = changedFiles
				}

				newStats, _ := git.GetDiffStats()
				editDiff.Additions = newStats.Additions
				editDiff.Deletions = newStats.Deletions

				_ = workspace.SaveDiff(*editDiff)

				// Replay commits above this diff
				diffs := workspace.LoadDiffsForFeature(*feature)
				for _, above := range sortDiffsByPosition(diffs) {
					if above.Position > editDiff.Position {
						_ = git.CherryPickSquash(above.Commit)
						newCommitSHA, _ := git.GetHeadSHA()
						above.Commit = newCommitSHA
						_ = workspace.SaveDiff(above)
					}
				}

				// Clear editing state
				_ = workspace.SetEditingDiff("")

				fmt.Printf("%s Updated %s: %s\n", format.SuccessMsg("\u2713"), format.DiffLabel(editDiff.Position), editDiff.Title)

				// Print stack summary
				allDiffs := workspace.LoadDiffsForFeature(*feature)
				if len(allDiffs) > 0 {
					var stackParts []string
					for _, d := range sortDiffsByPosition(allDiffs) {
						stackParts = append(stackParts, fmt.Sprintf("%s %s", format.DiffLabel(d.Position), format.DiffStatusIcon(string(d.Status))))
					}
					fmt.Println(format.DimText(fmt.Sprintf("  Stack: %s", strings.Join(stackParts, " \u2192 "))))
				}

				fmt.Println(format.NextStepHint("diff-update"))
				return nil
			}

			// New diff creation
			s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
			s.Suffix = " Generating diff message..."
			s.Start()

			result, _ := generateTitle(diffContent, changedFiles, feature.Type, scope, message)
			s.Stop()

			// Save undo entry
			headBefore, _ := git.GetHeadSHA()
			_ = workspace.SaveUndoEntry(workspace.UndoEntry{
				Action:      "diff-create",
				Timestamp:   time.Now().UTC().Format(time.RFC3339),
				RefBefore:   headBefore,
				Description: fmt.Sprintf("Create diff: %s", result.Title),
				Data:        map[string]interface{}{},
			})

			// Stage and commit
			_ = git.StageAll()
			commitSHA, err := git.Commit(result.Title)
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			// Create diff metadata
			position := workspace.GetNextDiffPosition(*feature)
			uuid := workspace.GenerateDiffUUID()

			newDiff := workspace.DiffData{
				UUID:        uuid,
				Feature:     feature.Slug,
				Commit:      commitSHA,
				Position:    position,
				Title:       result.Title,
				Description: result.Description,
				Type:        feature.Type,
				Files:       changedFiles,
				Additions:   stats.Additions,
				Deletions:   stats.Deletions,
				Version:     1,
				Status:      "draft",
				CI:          "",
				GitHubPR:    0,
				Created:     time.Now().UTC().Format(time.RFC3339),
				Updated:     time.Now().UTC().Format(time.RFC3339),
			}

			_ = workspace.SaveDiff(newDiff)

			// Add to feature's diffs list
			feature.Diffs = append(feature.Diffs, uuid)
			_ = workspace.SaveFeature(*feature)

			filesWord := "files"
			if stats.Files == 1 {
				filesWord = "file"
			}
			fmt.Printf("%s Created %s: %s\n", format.SuccessMsg("\u2713"), format.DiffLabel(position), result.Title)
			fmt.Println(format.DimText(fmt.Sprintf("  %d %s (+%d -%d)", stats.Files, filesWord, stats.Additions, stats.Deletions)))
			fmt.Println(format.NextStepHint("diff-create"))
			return nil
		},
	}

	diffCmd.Flags().BoolVar(&preview, "preview", false, "Preview what would be in the diff without creating it")
	diffCmd.Flags().BoolVar(&update, "update", false, "Explicitly update the diff being edited")

	// diff edit <label>
	editCmd := &cobra.Command{
		Use:   "edit <label>",
		Short: "Enter edit mode for a specific diff",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			label := args[0]

			feature := workspace.GetCurrentFeature()
			if feature == nil {
				fmt.Println(format.ErrorMsg("No active feature."))
				return fmt.Errorf("no active feature")
			}

			position, ok := parseDiffPosition(label)
			if !ok {
				msg := fmt.Sprintf("Invalid diff label: %s. Use format D1, D2, etc.", label)
				fmt.Println(format.ErrorMsg(msg))
				return fmt.Errorf("%s", msg)
			}

			targetDiff := workspace.GetDiffByPosition(*feature, position)
			if targetDiff == nil {
				msg := fmt.Sprintf("%s not found.", format.DiffLabel(position))
				fmt.Println(format.ErrorMsg(msg))
				return fmt.Errorf("%s", msg)
			}

			// Save undo entry with current HEAD
			headBefore, _ := git.GetHeadSHA()
			_ = workspace.SaveUndoEntry(workspace.UndoEntry{
				Action:      "diff-edit",
				Timestamp:   time.Now().UTC().Format(time.RFC3339),
				RefBefore:   headBefore,
				Description: fmt.Sprintf("Edit %s", format.DiffLabel(position)),
				Data: map[string]interface{}{
					"uuid":          targetDiff.UUID,
					"featureBranch": feature.Branch,
				},
			})

			// Set editing state
			_ = workspace.SetEditingDiff(targetDiff.UUID)

			// Hard reset to the diff's commit so user sees that state
			diffs := workspace.LoadDiffsForFeature(*feature)
			hasAbove := false
			for _, d := range diffs {
				if d.Position > position {
					hasAbove = true
					break
				}
			}

			if hasAbove {
				resetCmd := exec.Command("git", "reset", "--hard", targetDiff.Commit)
				_ = resetCmd.Run()
			}

			fmt.Printf("%s Editing %s: %s\n", format.SuccessMsg("\u2713"), format.DiffLabel(position), targetDiff.Title)
			fmt.Println(format.DimText("  Make your changes, then run: devpod diff"))
			return nil
		},
	}

	// diff check [label]
	checkCmd := &cobra.Command{
		Use:   "check [label]",
		Short: "Run CI checks for a diff",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			feature := workspace.GetCurrentFeature()
			if feature == nil {
				fmt.Println(format.ErrorMsg("No active feature."))
				return fmt.Errorf("no active feature")
			}

			diffs := workspace.LoadDiffsForFeature(*feature)
			if len(diffs) == 0 {
				fmt.Println(format.DimText("No diffs to check."))
				return nil
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
				found := workspace.GetDiffByPosition(*feature, position)
				if found == nil {
					msg := fmt.Sprintf("%s not found.", format.DiffLabel(position))
					fmt.Println(format.ErrorMsg(msg))
					return fmt.Errorf("%s", msg)
				}
				targetDiff = *found
			} else {
				sorted := sortDiffsByPosition(diffs)
				targetDiff = sorted[len(sorted)-1]
			}

			// Check if runner is available
			if !api.Ping() {
				fmt.Println(format.ErrorMsg("Runner is not available. Start it with: devpod runner start"))
				return fmt.Errorf("runner not available")
			}

			s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
			s.Suffix = fmt.Sprintf(" Running checks for %s...", format.DiffLabel(targetDiff.Position))
			s.Start()

			var runResult struct {
				ID     string `json:"id"`
				Status string `json:"status"`
			}
			err := api.Post("/api/runs", map[string]interface{}{
				"workflow": "pull_request",
				"ref":      feature.Branch,
				"inputs":   map[string]string{"diff": targetDiff.UUID},
			}, &runResult)
			if err != nil {
				s.Stop()
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			s.Suffix = fmt.Sprintf(" Checks running (%s)...", runResult.ID)

			done := make(chan bool, 1)

			err = api.StreamEvents("/api/events", func(eventType string, data []byte) {
				switch eventType {
				case "step.log":
					// Log output during checks
				case "run.completed":
					s.Stop()
					status := runResult.Status
					if status == "" {
						status = "success"
					}
					passed := status == "success"
					if passed {
						targetDiff.CI = "passed"
					} else {
						targetDiff.CI = "failed"
					}
					_ = workspace.SaveDiff(targetDiff)

					if passed {
						fmt.Printf("%s %s checks passed\n", format.SuccessMsg("\u2713"), format.DiffLabel(targetDiff.Position))
					} else {
						fmt.Printf("%s %s checks failed\n", format.ErrorMsg("\u2717"), format.DiffLabel(targetDiff.Position))
					}
					done <- true
				}
			})
			if err != nil {
				s.Stop()
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			select {
			case <-done:
			case <-time.After(30 * time.Minute):
				s.Stop()
				fmt.Println(format.WarnMsg("Check timed out."))
				targetDiff.CI = "failed"
				_ = workspace.SaveDiff(targetDiff)
			}

			return nil
		},
	}

	diffCmd.AddCommand(editCmd)
	diffCmd.AddCommand(checkCmd)

	return diffCmd
}
