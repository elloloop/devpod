package commands

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/briandowns/spinner"
	"github.com/elloloop/devpod/platform/cli-go/internal/api"
	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/spf13/cobra"
)

type runResponse struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Sandbox *struct {
		Type string `json:"type"`
		Path string `json:"path"`
	} `json:"sandbox"`
}

func newRunCmd() *cobra.Command {
	var inputPairs []string
	var noSandbox bool
	var noWait bool

	cmd := &cobra.Command{
		Use:   "run <workflow>",
		Short: "Trigger a workflow and stream output",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			workflow := args[0]

			inputs := make(map[string]string)
			for _, pair := range inputPairs {
				eqIdx := strings.Index(pair, "=")
				if eqIdx == -1 {
					return fmt.Errorf("%s", format.ErrorMsg(fmt.Sprintf("Invalid input format: %s (expected key=value)", pair)))
				}
				inputs[pair[:eqIdx]] = pair[eqIdx+1:]
			}

			fmt.Printf("\u25b6 Triggering workflow: %s\n", workflow)

			body := map[string]interface{}{
				"workflow": workflow,
				"sandbox":  !noSandbox,
			}
			if len(inputs) > 0 {
				body["inputs"] = inputs
			}

			var run runResponse
			if err := api.Post("/api/runs", body, &run); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			if run.Sandbox != nil {
				fmt.Println(format.DimText(fmt.Sprintf("  Sandbox: %s at %s", run.Sandbox.Type, run.Sandbox.Path)))
			}
			fmt.Println()

			if noWait {
				fmt.Printf("Run ID: %s\n", run.ID)
				return nil
			}

			// Stream events for this run
			return streamRunEvents(run.ID)
		},
	}

	cmd.Flags().StringArrayVarP(&inputPairs, "input", "i", nil, "Input key=value pairs")
	cmd.Flags().BoolVar(&noSandbox, "no-sandbox", false, "Disable sandboxing")
	cmd.Flags().BoolVar(&noWait, "no-wait", false, "Fire and forget, just print run ID")

	return cmd
}

func streamRunEvents(runID string) error {
	startTime := time.Now()
	jobSpinners := make(map[string]*spinner.Spinner)
	jobStartTimes := make(map[string]time.Time)
	done := make(chan bool, 1)

	err := api.StreamEvents("/api/events", func(eventType string, data []byte) {
		var event struct {
			RunID    string  `json:"runId"`
			JobID    string  `json:"jobId"`
			JobName  string  `json:"jobName"`
			StepName string  `json:"stepName"`
			Status   string  `json:"status"`
			Log      string  `json:"log"`
			Duration float64 `json:"duration"`
			Error    string  `json:"error"`
		}
		_ = json.Unmarshal(data, &event)

		if event.RunID != runID {
			return
		}

		jobKey := event.JobID
		if jobKey == "" {
			jobKey = event.JobName
		}
		if jobKey == "" {
			jobKey = "unknown"
		}

		switch eventType {
		case "job.queued":
			s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
			s.Suffix = fmt.Sprintf(" Job: %s (queued)", event.JobName)
			s.Start()
			jobSpinners[jobKey] = s
			jobStartTimes[jobKey] = time.Now()

		case "job.started", "job.in_progress":
			if s, ok := jobSpinners[jobKey]; ok {
				s.Suffix = fmt.Sprintf(" Job: %s (in_progress)", event.JobName)
			} else {
				s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
				s.Suffix = fmt.Sprintf(" Job: %s (in_progress)", event.JobName)
				s.Start()
				jobSpinners[jobKey] = s
				if _, ok := jobStartTimes[jobKey]; !ok {
					jobStartTimes[jobKey] = time.Now()
				}
			}

		case "step.log":
			if s, ok := jobSpinners[jobKey]; ok {
				s.Stop()
			}
			if event.Log != "" {
				for _, line := range strings.Split(event.Log, "\n") {
					fmt.Printf("  \u25b8 %s\n", line)
				}
			}
			if s, ok := jobSpinners[jobKey]; ok {
				s.Start()
			}

		case "step.completed":
			if s, ok := jobSpinners[jobKey]; ok {
				s.Stop()
			}
			stepStatus := event.Status
			if stepStatus == "" {
				stepStatus = "success"
			}
			icon := format.StatusIcon(stepStatus)
			stepName := event.StepName
			if stepName == "" {
				stepName = "Step"
			}
			fmt.Printf("  %s %s\n", icon, stepName)
			if s, ok := jobSpinners[jobKey]; ok {
				s.Start()
			}

		case "job.completed":
			if s, ok := jobSpinners[jobKey]; ok {
				s.Stop()
			}
			status := event.Status
			if status == "" {
				status = "success"
			}
			icon := format.StatusIcon(status)
			jobName := event.JobName
			if jobName == "" {
				jobName = jobKey
			}
			var durStr string
			if startT, ok := jobStartTimes[jobKey]; ok {
				durStr = fmt.Sprintf(" \u2014 %s", time.Since(startT).Round(time.Second))
			}
			fmt.Printf("%s Job: %s (%s)%s\n", icon, jobName, status, format.DimText(durStr))
			fmt.Println()
			delete(jobSpinners, jobKey)

		case "run.completed":
			for _, s := range jobSpinners {
				s.Stop()
			}
			totalDur := time.Since(startTime).Round(time.Second)
			status := event.Status
			if status == "" {
				status = "success"
			}
			icon := format.StatusIcon(status)
			fmt.Printf("%s Run completed: %s %s\n", icon, status,
				format.DimText(fmt.Sprintf("(%s total)", totalDur)))
			done <- true
		}
	})

	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	select {
	case <-done:
		return nil
	case <-time.After(30 * time.Minute):
		for _, s := range jobSpinners {
			s.Stop()
		}
		fmt.Println(format.WarnMsg("Run timed out waiting for events"))
		return nil
	}
}
