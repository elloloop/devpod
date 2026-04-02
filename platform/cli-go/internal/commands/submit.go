package commands

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/briandowns/spinner"
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
		Short: "Push diffs for review and create/update a GitHub PR",
		Long: `Pushes the clean branch and versions branch to origin, then
creates or updates a GitHub pull request.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Check for pending rebase
			if err := workspace.CheckPendingRebase(); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			feature, err := workspace.ValidateOnFeatureBranch()
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
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

			s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
			s.Suffix = " Pushing branches..."
			s.Start()

			// Push the clean branch
			_ = git.PushForce(feature.Branch)

			// Push the versions branch
			vb := feature.VersionsBranch
			if vb == "" {
				vb = workspace.VersionsBranchName(feature.Branch)
			}
			if git.BranchExists(vb) {
				_ = git.PushForce(vb)
			}
			s.Stop()

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
					vLabel := ""
					if d.Version > 1 {
						vLabel = fmt.Sprintf(" v%d", d.Version)
					}
					diffListParts = append(diffListParts, fmt.Sprintf("- %s%s: %s", format.DiffLabel(d.Position), vLabel, d.Title))
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

			if prURL != "" {
				fmt.Printf("  PR: %s\n", prURL)
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
