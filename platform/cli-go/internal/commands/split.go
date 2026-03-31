package commands

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/llm"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

type splitGroup struct {
	title string
	files []string
}

func askConfirmation(prompt string) bool {
	fmt.Print(prompt)
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		answer := strings.TrimSpace(strings.ToLower(scanner.Text()))
		return answer == "" || answer == "y" || answer == "yes"
	}
	return false
}

func splitWithLLM(diffContent string, files []string, changeType workspace.ChangeType, scope string) []splitGroup {
	// Group files by directory/module heuristic
	groups := make(map[string][]string)
	var groupOrder []string

	for _, file := range files {
		parts := strings.Split(file, "/")
		var key string
		if len(parts) <= 1 {
			key = "root"
		} else if len(parts) <= 2 {
			key = parts[0]
		} else {
			key = parts[0] + "/" + parts[1]
		}

		if _, exists := groups[key]; !exists {
			groupOrder = append(groupOrder, key)
		}
		groups[key] = append(groups[key], file)
	}

	var result []splitGroup
	for _, area := range groupOrder {
		areaFiles := groups[area]
		var title string

		if llm.IsAvailable() {
			msg, err := llm.GenerateDiffMessage(diffContent, string(changeType), scope)
			if err == nil {
				title = msg.Title
			} else {
				msg := llm.GenerateFallbackMessage(areaFiles, string(changeType), scope)
				title = msg.Title
			}
		} else {
			prefix := format.FeatureTypePrefix(string(changeType))
			title = fmt.Sprintf("%s(%s): update %s", prefix, scope, area)
		}

		result = append(result, splitGroup{title: title, files: areaFiles})
	}

	return result
}

func newSplitCmd() *cobra.Command {
	var preview bool

	cmd := &cobra.Command{
		Use:   "split",
		Short: "Split current changes into multiple diffs",
		RunE: func(cmd *cobra.Command, args []string) error {
			if !llm.IsAvailable() {
				fmt.Println(format.ErrorMsg("Split requires an LLM. Configure with: devpod config set llm.provider anthropic"))
				return fmt.Errorf("LLM not available")
			}

			feature := workspace.GetCurrentFeature()
			if feature == nil {
				fmt.Println(format.ErrorMsg("No active feature."))
				fmt.Println(format.DimText("Start one with: devpod feature \"name\""))
				return fmt.Errorf("no active feature")
			}

			changes, _ := git.GetChangedFiles()
			if len(changes) == 0 {
				fmt.Println(format.DimText("No changes to split."))
				return nil
			}

			diffContent, _ := git.GetDiff()
			changedFiles := make([]string, len(changes))
			for i, c := range changes {
				changedFiles[i] = c.Path
			}
			scope := feature.Slug

			fmt.Println(format.DimText(fmt.Sprintf("Analyzing %d changed files...", len(changedFiles))))

			groups := splitWithLLM(diffContent, changedFiles, feature.Type, scope)

			if len(groups) <= 1 {
				fmt.Println(format.DimText("All changes belong in a single diff. Use \"devpod diff\" instead."))
				return nil
			}

			// Show proposed split
			nextPos := workspace.GetNextDiffPosition(*feature)
			fmt.Println()
			fmt.Printf("Suggested split (%d diffs):\n", len(groups))
			for i, group := range groups {
				label := format.DiffLabel(nextPos + i)
				fileList := strings.Join(group.files, ", ")
				fmt.Printf("  %s: %s \u2014 %s\n", label, group.title, format.DimText(fileList))
			}

			if preview {
				return nil
			}

			fmt.Println()
			if !askConfirmation("Apply? [Y/n] ") {
				fmt.Println(format.DimText("Cancelled."))
				return nil
			}

			// Save undo entry
			headBefore, _ := git.GetHeadSHA()
			_ = workspace.SaveUndoEntry(workspace.UndoEntry{
				Action:      "split",
				Timestamp:   time.Now().UTC().Format(time.RFC3339),
				RefBefore:   headBefore,
				Description: fmt.Sprintf("Split into %d diffs", len(groups)),
				Data:        map[string]interface{}{"count": len(groups)},
			})

			// Apply each group
			for i, group := range groups {
				position := nextPos + i

				// Stage only this group's files
				for _, file := range group.files {
					addCmd := exec.Command("git", "add", file)
					if err := addCmd.Run(); err != nil {
						addCmd2 := exec.Command("git", "add", "-A", file)
						_ = addCmd2.Run()
					}
				}

				// Commit
				commitSHA, _ := git.Commit(group.title)

				// Get stats for this commit
				stats, _ := git.GetDiffStats()

				// Create diff metadata
				uuid := workspace.GenerateDiffUUID()
				newDiff := workspace.DiffData{
					UUID:        uuid,
					Feature:     feature.Slug,
					Commit:      commitSHA,
					Position:    position,
					Title:       group.title,
					Description: "",
					Type:        feature.Type,
					Files:       group.files,
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
				feature.Diffs = append(feature.Diffs, uuid)

				fmt.Printf("  %s %s: %s\n", format.SuccessMsg("\u2713"), format.DiffLabel(position), group.title)
			}

			_ = workspace.SaveFeature(*feature)

			fmt.Println()
			fmt.Printf("%s Split into %d diffs\n", format.SuccessMsg("\u2713"), len(groups))
			fmt.Println(format.NextStepHint("split"))
			return nil
		},
	}

	cmd.Flags().BoolVar(&preview, "preview", false, "Preview the split without applying")

	return cmd
}
