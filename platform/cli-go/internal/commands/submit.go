package commands

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/api"
	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func execQuiet(name string, args ...string) string {
	out, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func newSubmitCmd() *cobra.Command {
	var preview bool

	cmd := &cobra.Command{
		Use:   "submit",
		Short: "Submit diffs for review",
		RunE: func(cmd *cobra.Command, args []string) error {
			feature := workspace.GetCurrentFeature()
			if feature == nil {
				fmt.Println(format.ErrorMsg("No active feature."))
				fmt.Println(format.DimText("Start one with: devpod feature \"name\""))
				return fmt.Errorf("no active feature")
			}

			diffs := workspace.LoadDiffsForFeature(*feature)
			var draftDiffs []workspace.DiffData
			for _, d := range diffs {
				if d.Status == "draft" {
					draftDiffs = append(draftDiffs, d)
				}
			}

			if len(draftDiffs) == 0 {
				fmt.Println(format.DimText("All diffs already submitted."))
				return nil
			}

			// Preview mode
			if preview {
				fmt.Println("Would submit:")
				for _, d := range draftDiffs {
					fmt.Printf("  %s %s (+%d -%d)\n",
						format.DiffLabel(d.Position), d.Title, d.Additions, d.Deletions)
				}
				fmt.Println()
				plural := "s"
				if len(draftDiffs) == 1 {
					plural = ""
				}
				fmt.Println(format.DimText(fmt.Sprintf("Run without --preview to submit %d diff%s.", len(draftDiffs), plural)))
				return nil
			}

			// Save undo entry
			headBefore, _ := git.GetHeadSHA()
			diffUUIDs := make([]string, len(draftDiffs))
			for i, d := range draftDiffs {
				diffUUIDs[i] = d.UUID
			}
			plural := "s"
			if len(draftDiffs) == 1 {
				plural = ""
			}
			_ = workspace.SaveUndoEntry(workspace.UndoEntry{
				Action:      "submit",
				Timestamp:   time.Now().UTC().Format(time.RFC3339),
				RefBefore:   headBefore,
				Description: fmt.Sprintf("Submit %d diff%s", len(draftDiffs), plural),
				Data: map[string]interface{}{
					"featureSlug": feature.Slug,
					"diffs":       diffUUIDs,
				},
			})

			// Push the feature branch
			_ = git.PushForce(feature.Branch)

			config := workspace.LoadConfig()

			// Create GitHub PR if none exists
			var prURL string
			existingPR := false
			for _, d := range diffs {
				if d.GitHubPR != 0 {
					existingPR = true
					break
				}
			}

			if !existingPR {
				prefix := format.FeatureTypePrefix(string(feature.Type))
				prTitle := fmt.Sprintf("%s(%s): %s", prefix, feature.Slug, feature.Name)

				var diffListParts []string
				for _, d := range diffs {
					diffListParts = append(diffListParts, fmt.Sprintf("- %s: %s", format.DiffLabel(d.Position), d.Title))
				}
				body := "## Diffs\n\n" + strings.Join(diffListParts, "\n")

				prTitleJSON, _ := json.Marshal(prTitle)
				bodyJSON, _ := json.Marshal(body)

				result := execQuiet("gh", "pr", "create",
					"--base", config.DefaultBranch,
					"--title", string(prTitleJSON),
					"--body", string(bodyJSON))
				if result != "" {
					prURL = result
				}

				// Get PR number
				prNumStr := execQuiet("gh", "pr", "view", "--json", "number", "--jq", ".number")
				if prNumStr != "" {
					prNum, err := strconv.Atoi(prNumStr)
					if err == nil {
						for i := range diffs {
							diffs[i].GitHubPR = prNum
							_ = workspace.SaveDiff(diffs[i])
						}
					}
				}
			}

			// Update draft diffs to submitted
			for i := range draftDiffs {
				draftDiffs[i].Status = "submitted"
				draftDiffs[i].Updated = time.Now().UTC().Format(time.RFC3339)
				_ = workspace.SaveDiff(draftDiffs[i])
			}

			// Update feature status
			feature.Status = "submitted"
			_ = workspace.SaveFeature(*feature)

			// Trigger CI if auto-run enabled
			if config.CI.AutoRun {
				if api.Ping() {
					for i := range draftDiffs {
						var runResult interface{}
						err := api.Post("/api/runs", map[string]interface{}{
							"workflow": "pull_request",
							"ref":      feature.Branch,
							"inputs":   map[string]string{"diff": draftDiffs[i].UUID},
						}, &runResult)
						if err == nil {
							draftDiffs[i].CI = "pending"
							_ = workspace.SaveDiff(draftDiffs[i])
						}
					}
				}
			}

			// Print summary
			fmt.Printf("%s Submitted %d diff%s\n", format.SuccessMsg("\u2713"), len(draftDiffs), plural)

			// Local dashboard first — this is the primary review surface
			dashURL := fmt.Sprintf("http://localhost:3000/diffs/%s", feature.Slug)
			fmt.Printf("  Review:  %s\n", format.SuccessMsg(dashURL))

			if prURL != "" {
				fmt.Printf("  GitHub:  %s\n", format.DimText(prURL))
			}

			// Show stack
			allDiffs := workspace.LoadDiffsForFeature(*feature)
			sorted := sortDiffsByPosition(allDiffs)
			var stackParts []string
			for _, d := range sorted {
				stackParts = append(stackParts, fmt.Sprintf("%s %s", format.DiffLabel(d.Position), format.DiffStatusIcon(string(d.Status))))
			}
			fmt.Println(format.DimText(fmt.Sprintf("  Stack: %s", strings.Join(stackParts, " \u2192 "))))

			fmt.Println(format.NextStepHint("submit"))
			return nil
		},
	}

	cmd.Flags().BoolVar(&preview, "preview", false, "Show what would be submitted without doing it")

	return cmd
}
