package format

import (
	"strings"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// StatusIcon
// ---------------------------------------------------------------------------

func TestStatusIcon_AllStatuses(t *testing.T) {
	statuses := []string{
		"success", "completed", "connected", "active",
		"failure", "failed", "error",
		"cancelled", "canceled", "skipped",
		"queued", "pending", "waiting",
		"in_progress", "running",
		"unknown",
	}
	for _, s := range statuses {
		icon := StatusIcon(s)
		if icon == "" {
			t.Errorf("StatusIcon(%q) returned empty string", s)
		}
	}
}

func TestStatusIcon_Default(t *testing.T) {
	icon := StatusIcon("something-random")
	if icon == "" {
		t.Error("default icon should not be empty")
	}
}

// ---------------------------------------------------------------------------
// DiffLabel
// ---------------------------------------------------------------------------

func TestDiffLabel(t *testing.T) {
	tests := []struct {
		pos      int
		expected string
	}{
		{1, "D1"},
		{2, "D2"},
		{10, "D10"},
		{0, "D0"},
	}
	for _, tt := range tests {
		result := DiffLabel(tt.pos)
		if result != tt.expected {
			t.Errorf("DiffLabel(%d) = %q, want %q", tt.pos, result, tt.expected)
		}
	}
}

// ---------------------------------------------------------------------------
// DiffStatusIcon
// ---------------------------------------------------------------------------

func TestDiffStatusIcon_AllStatuses(t *testing.T) {
	statuses := []string{"draft", "submitted", "approved", "landed", "unknown"}
	for _, s := range statuses {
		icon := DiffStatusIcon(s)
		if icon == "" {
			t.Errorf("DiffStatusIcon(%q) returned empty", s)
		}
	}
}

// ---------------------------------------------------------------------------
// FeatureTypePrefix
// ---------------------------------------------------------------------------

func TestFeatureTypePrefix(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"feature", "feat"},
		{"fix", "fix"},
		{"docs", "docs"},
		{"chore", "chore"},
		{"unknown", "feat"},
		{"", "feat"},
	}
	for _, tt := range tests {
		result := FeatureTypePrefix(tt.input)
		if result != tt.expected {
			t.Errorf("FeatureTypePrefix(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

// ---------------------------------------------------------------------------
// RelativeTime
// ---------------------------------------------------------------------------

func TestRelativeTime_JustNow(t *testing.T) {
	now := time.Now().UTC().Format(time.RFC3339)
	result := RelativeTime(now)
	if result != "just now" && !strings.Contains(result, "seconds ago") {
		t.Errorf("expected 'just now' or seconds ago, got %q", result)
	}
}

func TestRelativeTime_MinutesAgo(t *testing.T) {
	past := time.Now().UTC().Add(-5 * time.Minute).Format(time.RFC3339)
	result := RelativeTime(past)
	if !strings.Contains(result, "minute") {
		t.Errorf("expected minutes ago, got %q", result)
	}
}

func TestRelativeTime_HoursAgo(t *testing.T) {
	past := time.Now().UTC().Add(-3 * time.Hour).Format(time.RFC3339)
	result := RelativeTime(past)
	if !strings.Contains(result, "hour") {
		t.Errorf("expected hours ago, got %q", result)
	}
}

func TestRelativeTime_DaysAgo(t *testing.T) {
	past := time.Now().UTC().Add(-48 * time.Hour).Format(time.RFC3339)
	result := RelativeTime(past)
	if !strings.Contains(result, "day") {
		t.Errorf("expected days ago, got %q", result)
	}
}

func TestRelativeTime_OneMinute(t *testing.T) {
	past := time.Now().UTC().Add(-70 * time.Second).Format(time.RFC3339)
	result := RelativeTime(past)
	if !strings.Contains(result, "1 minute") {
		t.Errorf("expected '1 minute ago', got %q", result)
	}
}

func TestRelativeTime_OneHour(t *testing.T) {
	past := time.Now().UTC().Add(-65 * time.Minute).Format(time.RFC3339)
	result := RelativeTime(past)
	if !strings.Contains(result, "1 hour") {
		t.Errorf("expected '1 hour ago', got %q", result)
	}
}

func TestRelativeTime_OneDay(t *testing.T) {
	past := time.Now().UTC().Add(-25 * time.Hour).Format(time.RFC3339)
	result := RelativeTime(past)
	if !strings.Contains(result, "1 day") {
		t.Errorf("expected '1 day ago', got %q", result)
	}
}

func TestRelativeTime_InvalidFormat(t *testing.T) {
	result := RelativeTime("not a date")
	if result != "not a date" {
		t.Errorf("should return original string for invalid format, got %q", result)
	}
}

func TestRelativeTime_AlternateFormat(t *testing.T) {
	past := time.Now().UTC().Add(-2 * time.Hour).Format("2006-01-02 15:04:05 -0700")
	result := RelativeTime(past)
	if !strings.Contains(result, "hour") {
		t.Errorf("should parse alternate format, got %q", result)
	}
}

func TestRelativeTime_EmptyString(t *testing.T) {
	result := RelativeTime("")
	if result != "" {
		t.Errorf("empty string should return empty, got %q", result)
	}
}

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

func TestDuration(t *testing.T) {
	tests := []struct {
		ms       int64
		expected string
	}{
		{500, "500ms"},
		{1000, "1.0s"},
		{5500, "5.5s"},
		{60000, "1m 0s"},
		{90000, "1m 30s"},
		{3600000, "1h 0m"},
		{7200000, "2h 0m"},
	}
	for _, tt := range tests {
		result := Duration(tt.ms)
		if result != tt.expected {
			t.Errorf("Duration(%d) = %q, want %q", tt.ms, result, tt.expected)
		}
	}
}

func TestDuration_Zero(t *testing.T) {
	result := Duration(0)
	if result != "0ms" {
		t.Errorf("Duration(0) = %q, want '0ms'", result)
	}
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

func TestTable_Basic(t *testing.T) {
	headers := []string{"Name", "Value"}
	rows := [][]string{
		{"key1", "val1"},
		{"key2", "val2"},
	}
	result := Table(headers, rows)
	if result == "" {
		t.Error("table should not be empty")
	}
	if !strings.Contains(result, "Name") {
		t.Error("should contain header")
	}
	if !strings.Contains(result, "key1") {
		t.Error("should contain row data")
	}
}

func TestTable_NoHeaders(t *testing.T) {
	rows := [][]string{
		{"a", "b"},
		{"c", "d"},
	}
	result := Table(nil, rows)
	if result == "" {
		t.Error("table without headers should still work")
	}
	if !strings.Contains(result, "a") {
		t.Error("should contain data")
	}
}

func TestTable_Empty(t *testing.T) {
	result := Table(nil, nil)
	if result != "" {
		t.Errorf("empty table should return empty string, got %q", result)
	}
}

func TestTable_UnevenColumns(t *testing.T) {
	rows := [][]string{
		{"a", "b", "c"},
		{"d"},
		{"e", "f"},
	}
	result := Table(nil, rows)
	// Should not panic
	if result == "" {
		t.Error("should handle uneven columns")
	}
}

func TestTable_Alignment(t *testing.T) {
	headers := []string{"Short", "Longer Header"}
	rows := [][]string{
		{"x", "y"},
		{"longer value", "z"},
	}
	result := Table(headers, rows)
	lines := strings.Split(result, "\n")
	if len(lines) < 3 {
		t.Fatalf("expected at least 3 lines (header + separator + row), got %d", len(lines))
	}
}

func TestTable_SingleColumn(t *testing.T) {
	headers := []string{"Items"}
	rows := [][]string{{"one"}, {"two"}, {"three"}}
	result := Table(headers, rows)
	if !strings.Contains(result, "one") {
		t.Error("should contain data")
	}
}

// ---------------------------------------------------------------------------
// Indent
// ---------------------------------------------------------------------------

func TestIndent_Basic(t *testing.T) {
	result := Indent("line1\nline2", 1)
	lines := strings.Split(result, "\n")
	for _, line := range lines {
		if !strings.HasPrefix(line, "  ") {
			t.Errorf("line should be indented: %q", line)
		}
	}
}

func TestIndent_Zero(t *testing.T) {
	result := Indent("text", 0)
	if result != "text" {
		t.Errorf("zero indent should not change text, got %q", result)
	}
}

func TestIndent_Multiple(t *testing.T) {
	result := Indent("text", 3)
	if !strings.HasPrefix(result, "      ") {
		t.Error("3 indents = 6 spaces")
	}
}

func TestIndent_EmptyString(t *testing.T) {
	result := Indent("", 2)
	if result != "    " {
		t.Errorf("got %q", result)
	}
}

// ---------------------------------------------------------------------------
// ConflictMessage
// ---------------------------------------------------------------------------

func TestConflictMessage(t *testing.T) {
	msg := ConflictMessage("main.go")
	if !strings.Contains(msg, "main.go") {
		t.Error("should mention the file")
	}
	if !strings.Contains(msg, "conflict") {
		t.Error("should mention conflict")
	}
	if !strings.Contains(msg, "<<<") {
		t.Error("should mention conflict markers")
	}
}

func TestConflictMessage_SpecialPath(t *testing.T) {
	msg := ConflictMessage("src/deeply/nested/file.ts")
	if !strings.Contains(msg, "src/deeply/nested/file.ts") {
		t.Error("should contain full path")
	}
}

// ---------------------------------------------------------------------------
// NextStepHint
// ---------------------------------------------------------------------------

func TestNextStepHint_AllActions(t *testing.T) {
	actions := []string{"diff", "sync", "edit", "submit", "land"}
	for _, action := range actions {
		hint := NextStepHint(action)
		if hint == "" {
			t.Errorf("NextStepHint(%q) returned empty", action)
		}
	}
}

func TestNextStepHint_Unknown(t *testing.T) {
	hint := NextStepHint("unknown-action")
	if hint != "" {
		t.Errorf("unknown action should return empty, got %q", hint)
	}
}

// ---------------------------------------------------------------------------
// ErrorMsg / SuccessMsg / WarnMsg / DimText
// ---------------------------------------------------------------------------

func TestErrorMsg(t *testing.T) {
	msg := ErrorMsg("something went wrong")
	if msg == "" {
		t.Error("should not be empty")
	}
}

func TestSuccessMsg(t *testing.T) {
	msg := SuccessMsg("all good")
	if msg == "" {
		t.Error("should not be empty")
	}
}

func TestWarnMsg(t *testing.T) {
	msg := WarnMsg("be careful")
	if msg == "" {
		t.Error("should not be empty")
	}
}

func TestDimText(t *testing.T) {
	msg := DimText("hint text")
	if msg == "" {
		t.Error("should not be empty")
	}
}

// ---------------------------------------------------------------------------
// stripAnsi
// ---------------------------------------------------------------------------

func TestStripAnsi(t *testing.T) {
	// Plain text should be unchanged
	result := stripAnsi("hello world")
	if result != "hello world" {
		t.Errorf("got %q", result)
	}

	// ANSI codes should be stripped
	result = stripAnsi("\x1b[31mred text\x1b[0m")
	if result != "red text" {
		t.Errorf("got %q", result)
	}
}

func TestStripAnsi_Empty(t *testing.T) {
	result := stripAnsi("")
	if result != "" {
		t.Errorf("got %q", result)
	}
}

func TestStripAnsi_OnlyCodes(t *testing.T) {
	result := stripAnsi("\x1b[31m\x1b[0m")
	if result != "" {
		t.Errorf("got %q", result)
	}
}

// ---------------------------------------------------------------------------
// Unicode / special chars
// ---------------------------------------------------------------------------

func TestDiffLabel_LargeNumbers(t *testing.T) {
	result := DiffLabel(999)
	if result != "D999" {
		t.Errorf("got %q", result)
	}
}

func TestTable_UnicodeContent(t *testing.T) {
	rows := [][]string{
		{"hello", "world"},
	}
	result := Table(nil, rows)
	if !strings.Contains(result, "hello") {
		t.Error("should handle unicode content")
	}
}

func TestTable_VeryLongStrings(t *testing.T) {
	long := strings.Repeat("a", 200)
	rows := [][]string{
		{long, "short"},
		{"short", long},
	}
	result := Table(nil, rows)
	if result == "" {
		t.Error("should handle long strings")
	}
}
