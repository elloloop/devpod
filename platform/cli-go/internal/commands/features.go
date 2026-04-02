package commands

import (
	"fmt"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func newFeaturesCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "features",
		Short: "List all features",
		RunE: func(cmd *cobra.Command, args []string) error {
			features := workspace.ListFeatures()

			if len(features) == 0 {
				fmt.Println(format.DimText("No features yet."))
				fmt.Println(format.DimText("Start one with: devpod feature \"name\""))
				return nil
			}

			currentBranch, _ := git.GetCurrentBranch()

			for _, feature := range features {
				isCurrent := feature.Branch == currentBranch
				var markerStr string
				if isCurrent {
					markerStr = "\u25cf"
				} else if feature.Status == "complete" {
					markerStr = "\u2713"
				} else {
					markerStr = "\u25cb"
				}

				diffs := workspace.LoadDiffsForFeature(feature)
				prefix := format.FeatureTypePrefix(string(feature.Type))

				var diffSummary string
				if feature.Status == "complete" {
					diffSummary = "landed"
				} else if len(diffs) == 0 {
					diffSummary = "no diffs"
				} else {
					sorted := sortDiffsByPosition(diffs)
					var parts []string
					for _, d := range sorted {
						vLabel := ""
						if d.Version > 1 {
							vLabel = fmt.Sprintf(" v%d", d.Version)
						}
						parts = append(parts, fmt.Sprintf("%s%s %s", format.DiffLabel(d.Position), vLabel, format.DiffStatusIcon(string(d.Status))))
					}
					label := "diffs"
					if len(diffs) == 1 {
						label = "diff"
					}
					diffSummary = fmt.Sprintf("%d %s (%s)", len(diffs), label, strings.Join(parts, ", "))
				}

				// Show versions branch info
				vbInfo := ""
				if feature.VersionsBranch != "" && feature.SnapshotCount > 0 {
					snapLabel := "snapshots"
					if feature.SnapshotCount == 1 {
						snapLabel = "snapshot"
					}
					vbInfo = fmt.Sprintf("  %d %s", feature.SnapshotCount, snapLabel)
				}

				timeStr := format.RelativeTime(feature.Created)
				nameDisplay := feature.Name

				fmt.Printf("  %s %s    %s   %s%s   %s\n",
					markerStr, nameDisplay,
					format.DimText(prefix), diffSummary,
					format.DimText(vbInfo),
					format.DimText(timeStr))
			}

			fmt.Println()
			fmt.Println(format.DimText("\u25cf = current"))
			return nil
		},
	}
}

func newDiffsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "diffs",
		Short: "List diffs for the current feature",
		RunE: func(cmd *cobra.Command, args []string) error {
			feature, err := workspace.ValidateOnFeatureBranch()
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			diffs := workspace.LoadDiffsForFeature(*feature)

			if len(diffs) == 0 {
				fmt.Println(format.DimText("No diffs yet."))
				fmt.Println(format.DimText("Create one with: devpod diff"))
				return nil
			}

			plural := "s"
			if len(diffs) == 1 {
				plural = ""
			}
			fmt.Printf("%s -- %d diff%s\n", feature.Name, len(diffs), plural)
			fmt.Println()

			sorted := sortDiffsByPosition(diffs)
			for _, d := range sorted {
				icon := format.DiffStatusIcon(string(d.Status))
				label := format.DiffLabel(d.Position)
				vLabel := ""
				if d.Version > 1 {
					vLabel = fmt.Sprintf(" v%d", d.Version)
				}
				stats := fmt.Sprintf("+%d -%d", d.Additions, d.Deletions)

				var ciLabel string
				switch d.CI {
				case "passed":
					ciLabel = "CI passed"
				case "failed":
					ciLabel = "CI failed"
				case "pending":
					ciLabel = "CI running"
				default:
					ciLabel = ""
				}

				fmt.Printf("  %s %s%s  %s  %s  %s\n", icon, label, vLabel, d.Title, stats, ciLabel)

				if len(d.Files) > 0 {
					var fileList string
					if len(d.Files) <= 3 {
						fileList = strings.Join(d.Files, ", ")
					} else {
						fileList = fmt.Sprintf("%s +%d more", strings.Join(d.Files[:3], ", "), len(d.Files)-3)
					}
					fmt.Printf("         %s\n", format.DimText(fileList))
				}
			}
			return nil
		},
	}
}
