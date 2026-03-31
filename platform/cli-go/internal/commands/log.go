package commands

import (
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

type logEvent struct {
	Timestamp string
	Message   string
}

func formatLogTime(dateStr string) string {
	t, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%02d:%02d", t.Hour(), t.Minute())
}

func formatDateHeader(dateStr string) string {
	t, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		return dateStr
	}
	now := time.Now()

	tDay := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	nDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	diffDays := int(nDay.Sub(tDay).Hours() / 24)

	if diffDays == 0 {
		return "Today"
	}
	if diffDays == 1 {
		return "Yesterday"
	}
	if diffDays < 7 {
		return fmt.Sprintf("%d days ago", diffDays)
	}
	return t.Format("Monday, Jan 2")
}

func getDateKey(dateStr string) string {
	t, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		return dateStr
	}
	return fmt.Sprintf("%d-%02d-%02d", t.Year(), t.Month(), t.Day())
}

func newLogCmd() *cobra.Command {
	var limit string

	cmd := &cobra.Command{
		Use:   "log",
		Short: "Show activity log",
		RunE: func(cmd *cobra.Command, args []string) error {
			maxEntries, _ := strconv.Atoi(limit)
			if maxEntries <= 0 {
				maxEntries = 20
			}

			var events []logEvent

			// Collect events from features
			features := workspace.ListFeatures()
			for _, feature := range features {
				events = append(events, logEvent{
					Timestamp: feature.Created,
					Message:   fmt.Sprintf("Started feature: %s", feature.Name),
				})

				// Collect from diffs
				diffs := workspace.LoadDiffsForFeature(feature)
				for _, d := range diffs {
					events = append(events, logEvent{
						Timestamp: d.Created,
						Message:   fmt.Sprintf("Created diff %s: %s", format.DiffLabel(d.Position), d.Title),
					})

					if d.Status == "landed" {
						events = append(events, logEvent{
							Timestamp: d.Updated,
							Message:   fmt.Sprintf("Landed: %s", d.Title),
						})
					} else if d.Status == "submitted" {
						events = append(events, logEvent{
							Timestamp: d.Updated,
							Message:   fmt.Sprintf("Submitted %s: %s", format.DiffLabel(d.Position), d.Title),
						})
					}
				}
			}

			// Collect from undo entries
			undoEntries := workspace.ListUndoEntries()
			for _, entry := range undoEntries {
				if entry.Action == "sync" {
					events = append(events, logEvent{
						Timestamp: entry.Timestamp,
						Message:   fmt.Sprintf("Synced: %s", entry.Description),
					})
				}
			}

			// Sort by timestamp descending
			sort.Slice(events, func(i, j int) bool {
				ti, _ := time.Parse(time.RFC3339, events[i].Timestamp)
				tj, _ := time.Parse(time.RFC3339, events[j].Timestamp)
				return ti.After(tj)
			})

			// Deduplicate and limit
			seen := make(map[string]bool)
			var uniqueEvents []logEvent
			for _, event := range events {
				key := event.Timestamp + ":" + event.Message
				if !seen[key] {
					seen[key] = true
					uniqueEvents = append(uniqueEvents, event)
				}
				if len(uniqueEvents) >= maxEntries {
					break
				}
			}

			if len(uniqueEvents) == 0 {
				fmt.Println(format.DimText("No activity yet."))
				return nil
			}

			// Group by day (preserve order)
			type dayGroup struct {
				Key    string
				Events []logEvent
			}
			var groups []dayGroup
			groupMap := make(map[string]int)

			for _, event := range uniqueEvents {
				key := getDateKey(event.Timestamp)
				if idx, ok := groupMap[key]; ok {
					groups[idx].Events = append(groups[idx].Events, event)
				} else {
					groupMap[key] = len(groups)
					groups = append(groups, dayGroup{Key: key, Events: []logEvent{event}})
				}
			}

			for _, group := range groups {
				header := formatDateHeader(group.Events[0].Timestamp)
				fmt.Println(header)

				for _, event := range group.Events {
					timeStr := formatLogTime(event.Timestamp)
					fmt.Printf("  %s  %s\n", format.DimText(timeStr), event.Message)
				}
				fmt.Println()
			}

			return nil
		},
	}

	cmd.Flags().StringVarP(&limit, "limit", "n", "20", "Number of entries to show")

	return cmd
}
