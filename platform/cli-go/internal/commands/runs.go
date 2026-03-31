package commands

import (
	"fmt"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/api"
	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/spf13/cobra"
)

type runEntry struct {
	ID          string `json:"id"`
	Workflow    string `json:"workflow"`
	Status      string `json:"status"`
	Duration    int    `json:"duration"`
	StartedAt   string `json:"startedAt"`
	CompletedAt string `json:"completedAt"`
	Jobs        []jobEntry `json:"jobs"`
}

type jobEntry struct {
	ID       string      `json:"id"`
	Name     string      `json:"name"`
	Status   string      `json:"status"`
	Duration int         `json:"duration"`
	Steps    []stepEntry `json:"steps"`
}

type stepEntry struct {
	Name     string `json:"name"`
	Status   string `json:"status"`
	Duration int    `json:"duration"`
	Log      string `json:"log"`
}

func newRunsCmd() *cobra.Command {
	var statusFilter string
	var limit string

	runsCmd := &cobra.Command{
		Use:   "runs",
		Short: "List and inspect workflow runs",
		RunE: func(cmd *cobra.Command, args []string) error {
			params := ""
			var parts []string
			if statusFilter != "" {
				parts = append(parts, "status="+statusFilter)
			}
			parts = append(parts, "limit="+limit)
			params = strings.Join(parts, "&")

			var data []runEntry
			if err := api.Get("/api/runs?"+params, &data); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			if len(data) == 0 {
				fmt.Println(format.DimText("No runs found."))
				return nil
			}

			var rows [][]string
			for _, run := range data {
				icon := format.StatusIcon(run.Status)
				dur := "\u2014"
				if run.Duration > 0 {
					dur = fmt.Sprintf("%ds", run.Duration/1000)
				}
				started := "\u2014"
				if run.StartedAt != "" {
					started = format.RelativeTime(run.StartedAt)
				}
				idShort := run.ID
				if len(idShort) > 8 {
					idShort = idShort[:8]
				}
				rows = append(rows, []string{
					idShort,
					run.Workflow,
					fmt.Sprintf("%s %s", icon, run.Status),
					dur,
					started,
				})
			}

			fmt.Println(format.Table([]string{"ID", "Workflow", "Status", "Duration", "Started"}, rows))
			return nil
		},
	}

	runsCmd.Flags().StringVarP(&statusFilter, "status", "s", "", "Filter by status")
	runsCmd.Flags().StringVarP(&limit, "limit", "l", "10", "Limit number of results")

	// runs view <id>
	viewCmd := &cobra.Command{
		Use:   "view <id>",
		Short: "View details of a specific run",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]

			var run runEntry
			if err := api.Get("/api/runs/"+id, &run); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			icon := format.StatusIcon(run.Status)

			fmt.Printf("Run %s\n", run.ID)
			fmt.Printf("Workflow: %s\n", run.Workflow)
			fmt.Printf("Status:   %s %s\n", icon, run.Status)
			if run.Duration > 0 {
				fmt.Printf("Duration: %ds\n", run.Duration/1000)
			}
			if run.StartedAt != "" {
				fmt.Printf("Started:  %s\n", format.RelativeTime(run.StartedAt))
			}
			fmt.Println()

			if len(run.Jobs) > 0 {
				fmt.Println("Jobs:")
				for _, job := range run.Jobs {
					jobIcon := format.StatusIcon(job.Status)
					var jobDur string
					if job.Duration > 0 {
						jobDur = fmt.Sprintf(" \u2014 %ds", job.Duration/1000)
					}
					fmt.Printf("  %s %s (%s)%s\n", jobIcon, job.Name, job.Status, format.DimText(jobDur))

					for _, step := range job.Steps {
						stepIcon := format.StatusIcon(step.Status)
						fmt.Printf("    %s %s\n", stepIcon, step.Name)
					}
				}
			}

			return nil
		},
	}

	// runs logs <id>
	logsCmd := &cobra.Command{
		Use:   "logs <id>",
		Short: "Print full logs for a run",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]

			var run runEntry
			if err := api.Get("/api/runs/"+id, &run); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			if len(run.Jobs) > 0 {
				for _, job := range run.Jobs {
					fmt.Printf("\u2500\u2500 %s \u2500\u2500\n", job.Name)
					for _, step := range job.Steps {
						fmt.Printf("\u25b8 %s\n", step.Name)
						if step.Log != "" {
							fmt.Println(format.Indent(step.Log, 2))
						}
					}
					fmt.Println()
				}
			} else {
				// Fallback: fetch raw logs
				var logs string
				if err := api.Get("/api/runs/"+id+"/logs", &logs); err != nil {
					return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
				}
				fmt.Println(logs)
			}

			return nil
		},
	}

	runsCmd.AddCommand(viewCmd)
	runsCmd.AddCommand(logsCmd)

	return runsCmd
}
