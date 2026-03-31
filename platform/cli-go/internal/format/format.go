package format

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/fatih/color"
)

// StatusIcon returns a colored icon for the given status string.
func StatusIcon(status string) string {
	switch status {
	case "success", "completed", "connected", "active":
		return color.GreenString("\u2713") // check mark
	case "failure", "failed", "error":
		return color.RedString("\u2717") // cross
	case "cancelled", "canceled", "skipped":
		return color.HiBlackString("\u2298") // circled dash
	case "queued", "pending", "waiting":
		return color.YellowString("\u23f3") // hourglass
	case "in_progress", "running":
		return color.BlueString("\u25b6") // play
	default:
		return color.HiBlackString("\u2022") // bullet
	}
}

// DiffLabel returns the display label for a diff position (e.g. "D1").
func DiffLabel(position int) string {
	return fmt.Sprintf("D%d", position)
}

// DiffStatusIcon returns an icon for a diff review status.
func DiffStatusIcon(status string) string {
	switch status {
	case "draft":
		return "\u25cb" // ○
	case "submitted":
		return "\u25d1" // ◑
	case "approved":
		return "\u2713" // ✓
	case "landed":
		return "\u25cf" // ●
	default:
		return "\u2022" // •
	}
}

// FeatureTypePrefix returns the conventional commit prefix for a change type.
func FeatureTypePrefix(t string) string {
	switch t {
	case "feature":
		return "feat"
	case "fix":
		return "fix"
	case "docs":
		return "docs"
	case "chore":
		return "chore"
	default:
		return "feat"
	}
}

// RelativeTime converts an ISO timestamp string to a human-readable relative time.
func RelativeTime(t string) string {
	parsed, err := time.Parse(time.RFC3339, t)
	if err != nil {
		// Try other common formats
		parsed, err = time.Parse("2006-01-02T15:04:05Z", t)
		if err != nil {
			parsed, err = time.Parse("2006-01-02 15:04:05 -0700", t)
			if err != nil {
				return t
			}
		}
	}

	diff := time.Since(parsed)
	seconds := int(math.Floor(diff.Seconds()))
	minutes := int(math.Floor(diff.Minutes()))
	hours := int(math.Floor(diff.Hours()))
	days := int(math.Floor(float64(hours) / 24))

	if seconds < 5 {
		return "just now"
	}
	if seconds < 60 {
		return fmt.Sprintf("%d seconds ago", seconds)
	}
	if minutes == 1 {
		return "1 minute ago"
	}
	if minutes < 60 {
		return fmt.Sprintf("%d minutes ago", minutes)
	}
	if hours == 1 {
		return "1 hour ago"
	}
	if hours < 24 {
		return fmt.Sprintf("%d hours ago", hours)
	}
	if days == 1 {
		return "1 day ago"
	}
	return fmt.Sprintf("%d days ago", days)
}

// Duration formats a millisecond count as a human-readable duration.
func Duration(ms int64) string {
	if ms < 1000 {
		return fmt.Sprintf("%dms", ms)
	}
	sec := float64(ms) / 1000.0
	if sec < 60 {
		return fmt.Sprintf("%.1fs", sec)
	}
	min := int(math.Floor(sec / 60))
	remainSec := math.Mod(sec, 60)
	if min < 60 {
		return fmt.Sprintf("%dm %.0fs", min, remainSec)
	}
	hr := min / 60
	remainMin := min % 60
	return fmt.Sprintf("%dh %dm", hr, remainMin)
}

// ansiStripRe matches ANSI escape codes for width calculation.
var ansiStripRe = regexp.MustCompile(`\x1b\[[0-9;]*m`)

// stripAnsi removes ANSI escape codes from a string.
func stripAnsi(s string) string {
	return ansiStripRe.ReplaceAllString(s, "")
}

// Table renders an aligned table. If headers is non-nil, a separator line
// is drawn after the first row.
func Table(headers []string, rows [][]string) string {
	var allRows [][]string
	if headers != nil {
		allRows = append(allRows, headers)
	}
	allRows = append(allRows, rows...)

	if len(allRows) == 0 {
		return ""
	}

	// Determine column count
	colCount := 0
	for _, row := range allRows {
		if len(row) > colCount {
			colCount = len(row)
		}
	}

	// Calculate column widths
	colWidths := make([]int, colCount)
	for c := 0; c < colCount; c++ {
		for _, row := range allRows {
			cell := ""
			if c < len(row) {
				cell = row[c]
			}
			stripped := stripAnsi(cell)
			if len(stripped) > colWidths[c] {
				colWidths[c] = len(stripped)
			}
		}
	}

	// Render rows
	var lines []string
	for i, row := range allRows {
		var cells []string
		for c := 0; c < colCount; c++ {
			cell := ""
			if c < len(row) {
				cell = row[c]
			}
			stripped := stripAnsi(cell)
			padding := colWidths[c] - len(stripped)
			if padding < 0 {
				padding = 0
			}
			cells = append(cells, cell+strings.Repeat(" ", padding))
		}
		lines = append(lines, strings.Join(cells, "  "))

		// Separator after headers
		if i == 0 && headers != nil {
			var sep []string
			for _, w := range colWidths {
				sep = append(sep, strings.Repeat("\u2500", w))
			}
			lines = append(lines, color.HiBlackString(strings.Join(sep, "  ")))
		}
	}

	return strings.Join(lines, "\n")
}

// Indent prepends each line of text with the given number of two-space indents.
func Indent(text string, spaces int) string {
	prefix := strings.Repeat("  ", spaces)
	var lines []string
	for _, line := range strings.Split(text, "\n") {
		lines = append(lines, prefix+line)
	}
	return strings.Join(lines, "\n")
}

// ConflictMessage returns a plain-language message about a conflict in a file.
func ConflictMessage(file string) string {
	bold := color.New(color.Bold).SprintFunc()
	cyan := color.CyanString(file)
	return strings.Join([]string{
		fmt.Sprintf("The file %s has conflicting changes.", bold(file)),
		"",
		"To resolve:",
		fmt.Sprintf("  1. Open %s and look for conflict markers (<<<, ===, >>>)", cyan),
		"  2. Keep the version you want and delete the markers",
		"  3. Save the file",
	}, "\n")
}

// NextStepHint returns a suggestion after a command completes.
func NextStepHint(action string) string {
	dim := color.HiBlackString
	switch action {
	case "diff":
		return dim("Run \"devpod submit\" to create a pull request, or \"devpod diff\" to add another change.")
	case "sync":
		return dim("Your branch is up to date. Run \"devpod diff\" to continue working.")
	case "edit":
		return dim("Run \"devpod submit\" to update the pull request with your edits.")
	case "submit":
		return dim("Waiting for review. Run \"devpod land\" after approval to merge.")
	case "land":
		return dim("Change landed. Run \"devpod sync\" to start fresh.")
	default:
		return ""
	}
}

// ErrorMsg returns a red error message.
func ErrorMsg(msg string) string {
	return color.RedString("Error: %s", msg)
}

// SuccessMsg returns a green success message.
func SuccessMsg(msg string) string {
	return color.GreenString(msg)
}

// WarnMsg returns a yellow warning message.
func WarnMsg(msg string) string {
	return color.YellowString(msg)
}

// DimText returns dim/gray text.
func DimText(msg string) string {
	return color.HiBlackString(msg)
}
