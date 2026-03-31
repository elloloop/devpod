package commands

import (
	"fmt"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/api"
	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/spf13/cobra"
)

type workflowEntry struct {
	Name        string   `json:"name"`
	File        string   `json:"file"`
	Triggers    []string `json:"triggers"`
	Jobs        []string `json:"jobs"`
	Description string   `json:"description"`
}

func newWorkflowsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "workflows",
		Short: "List available workflows",
		RunE: func(cmd *cobra.Command, args []string) error {
			var data []workflowEntry
			if err := api.Get("/api/workflows", &data); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			if len(data) == 0 {
				fmt.Println(format.DimText("No workflows found."))
				return nil
			}

			var rows [][]string
			for _, wf := range data {
				triggers := "\u2014"
				if len(wf.Triggers) > 0 {
					triggers = strings.Join(wf.Triggers, ", ")
				}
				jobs := "\u2014"
				if len(wf.Jobs) > 0 {
					jobs = strings.Join(wf.Jobs, ", ")
				}
				rows = append(rows, []string{
					wf.Name,
					format.DimText(wf.File),
					triggers,
					jobs,
				})
			}

			fmt.Println(format.Table([]string{"Name", "File", "Triggers", "Jobs"}, rows))
			return nil
		},
	}
}
