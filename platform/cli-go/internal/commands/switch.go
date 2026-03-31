package commands

import (
	"fmt"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func newSwitchCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "switch <query>",
		Short: "Switch to a different feature",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			query := args[0]
			features := workspace.ListFeatures()
			q := strings.ToLower(query)

			// Find matching features by partial name or slug
			var matches []workspace.FeatureData
			for _, f := range features {
				if strings.Contains(strings.ToLower(f.Name), q) || strings.Contains(f.Slug, q) {
					matches = append(matches, f)
				}
			}

			if len(matches) == 0 {
				fmt.Printf("%s\n", format.ErrorMsg(fmt.Sprintf("No feature matching \"%s\" found.", query)))
				if len(features) > 0 {
					fmt.Println()
					fmt.Println("Available features:")
					for _, f := range features {
						fmt.Printf("  \u2022 %s\n", f.Name)
					}
				}
				return fmt.Errorf("no feature found")
			}

			if len(matches) > 1 {
				fmt.Printf("%s\n", format.WarnMsg(fmt.Sprintf("Multiple features match \"%s\":", query)))
				for _, f := range matches {
					fmt.Printf("  \u2022 %s (%s)\n", f.Name, format.FeatureTypePrefix(string(f.Type)))
				}
				fmt.Println()
				fmt.Println("Be more specific to select one.")
				return fmt.Errorf("ambiguous match")
			}

			target := matches[0]

			// Auto-save uncommitted changes on current feature
			autoSaveChanges()

			// Switch to the feature branch
			if err := git.SwitchBranch(target.Branch); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			// Show context for the new feature
			diffs := workspace.LoadDiffsForFeature(target)

			fmt.Printf("%s Switched to: %s\n", format.SuccessMsg("\u2713"), target.Name)

			if len(diffs) > 0 {
				sorted := sortDiffsByPosition(diffs)
				var stackParts []string
				for _, d := range sorted {
					stackParts = append(stackParts, fmt.Sprintf("%s %s", format.DiffLabel(d.Position), format.DiffStatusIcon(string(d.Status))))
				}
				fmt.Println(format.DimText(fmt.Sprintf("  Stack: %s", strings.Join(stackParts, " \u2192 "))))
			}

			fmt.Println(format.NextStepHint("switch"))
			return nil
		},
	}
}
