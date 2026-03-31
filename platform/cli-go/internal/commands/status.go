package commands

import (
	"fmt"

	"github.com/elloloop/devpod/platform/cli-go/internal/api"
	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

type statusResponse struct {
	Runner struct {
		Status string `json:"status"`
		URL    string `json:"url"`
	} `json:"runner"`
	Workspace  string `json:"workspace"`
	Workflows  *int   `json:"workflows"`
	Secrets    *int   `json:"secrets"`
	Backends   []struct {
		Name   string `json:"name"`
		Status string `json:"status"`
	} `json:"backends"`
	RecentRuns []struct {
		Workflow  string `json:"workflow"`
		Status    string `json:"status"`
		StartedAt string `json:"startedAt"`
	} `json:"recentRuns"`
}

func newStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show current status including changed files",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Show feature/diff context first
			feature := workspace.GetCurrentFeature()
			if feature != nil {
				diffs := workspace.LoadDiffsForFeature(*feature)
				editingUUID := workspace.GetEditingDiff()

				fmt.Printf("Feature: %s (%s)\n", feature.Name, format.FeatureTypePrefix(string(feature.Type)))

				if len(diffs) > 0 {
					sorted := sortDiffsByPosition(diffs)
					var stackParts []string
					for _, d := range sorted {
						stackParts = append(stackParts, fmt.Sprintf("%s %s", format.DiffLabel(d.Position), format.DiffStatusIcon(string(d.Status))))
					}
					fmt.Printf("Stack:   %s\n", joinArrow(stackParts))
				}

				if editingUUID != "" {
					editDiff, _ := workspace.LoadDiff(editingUUID)
					if editDiff != nil {
						fmt.Printf("  Editing %s: %s\n", format.DiffLabel(editDiff.Position), editDiff.Title)
					}
				}

				fmt.Println()
			}

			// Show changed files
			changes, err := git.GetChangedFiles()
			if err == nil {
				if len(changes) > 0 {
					fmt.Println("Changed files:")
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
					fmt.Println()
				} else if feature != nil {
					fmt.Println(format.DimText("No uncommitted changes."))
					fmt.Println()
				}
			}

			// Show runner status
			isUp := api.Ping()

			if !isUp {
				fmt.Printf("Runner: \u2717 Not running\n")
				fmt.Println(format.DimText("  Start the runner with: devpod runner start"))
				return nil
			}

			var data statusResponse
			err = api.Get("/api/status", &data)
			if err != nil {
				fmt.Printf("Runner: \u2713 Running\n")
				fmt.Println(format.DimText(fmt.Sprintf("  Could not fetch full status: %v", err)))
				return nil
			}

			runnerURL := data.Runner.URL
			fmt.Printf("Runner: \u2713 Running at %s\n", runnerURL)

			if data.Workspace != "" {
				fmt.Printf("Workspace: %s\n", data.Workspace)
			}
			if data.Workflows != nil {
				fmt.Printf("Workflows: %d available\n", *data.Workflows)
			}
			if data.Secrets != nil {
				fmt.Printf("Secrets: %d configured\n", *data.Secrets)
			}

			if len(data.Backends) > 0 {
				var parts []string
				for _, b := range data.Backends {
					icon := "\u2717"
					if b.Status == "connected" || b.Status == "active" {
						icon = "\u2713"
					}
					parts = append(parts, fmt.Sprintf("%s %s", b.Name, icon))
				}
				fmt.Printf("Backends: %s\n", joinComma(parts))
			}

			if len(data.RecentRuns) > 0 {
				fmt.Println()
				fmt.Println("Recent runs:")
				for _, run := range data.RecentRuns {
					icon := format.StatusIcon(run.Status)
					when := ""
					if run.StartedAt != "" {
						when = fmt.Sprintf(" \u2014 %s", format.RelativeTime(run.StartedAt))
					}
					fmt.Printf("  %s %s%s\n", icon, run.Workflow, when)
				}
			}

			return nil
		},
	}
}

func joinArrow(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += " \u2192 "
		}
		result += p
	}
	return result
}

func joinComma(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += ", "
		}
		result += p
	}
	return result
}
