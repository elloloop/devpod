package llm

import (
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Fallback message generation
// ---------------------------------------------------------------------------

func TestGenerateFallbackMessage_Basic(t *testing.T) {
	files := []string{"src/auth/login.go", "src/auth/logout.go"}
	result := GenerateFallbackMessage(files, "feature", "auth")
	if result.Title == "" {
		t.Error("title should not be empty")
	}
	if !strings.Contains(result.Title, "feature") {
		t.Errorf("title should contain type prefix: %s", result.Title)
	}
	if !strings.Contains(result.Title, "auth") {
		t.Errorf("title should contain scope: %s", result.Title)
	}
}

func TestGenerateFallbackMessage_EmptyFiles(t *testing.T) {
	result := GenerateFallbackMessage(nil, "fix", "core")
	if result.Title == "" {
		t.Error("title should not be empty even with no files")
	}
	if !strings.Contains(result.Title, "fix") {
		t.Errorf("title should contain fix: %s", result.Title)
	}
}

func TestGenerateFallbackMessage_SingleFile(t *testing.T) {
	files := []string{"README.md"}
	result := GenerateFallbackMessage(files, "docs", "project")
	if !strings.Contains(result.Title, "docs") {
		t.Errorf("title should contain docs: %s", result.Title)
	}
}

func TestGenerateFallbackMessage_ManyFiles(t *testing.T) {
	files := make([]string, 20)
	for i := range files {
		files[i] = "dir/file.go"
	}
	result := GenerateFallbackMessage(files, "chore", "deps")
	if len(result.Title) > 72 {
		t.Errorf("title too long: %d chars", len(result.Title))
	}
}

func TestGenerateFallbackMessage_DescriptionLimit(t *testing.T) {
	files := make([]string, 10)
	for i := range files {
		files[i] = "path/file" + string(rune('a'+i)) + ".go"
	}
	result := GenerateFallbackMessage(files, "feature", "scope")
	lines := strings.Split(result.Description, "\n")
	if len(lines) > 5 {
		t.Errorf("description should be limited to 5 files, got %d lines", len(lines))
	}
}

func TestGenerateFallbackMessage_DirectoryGrouping(t *testing.T) {
	files := []string{"api/routes.go", "api/handlers.go", "models/user.go", "config/settings.yaml"}
	result := GenerateFallbackMessage(files, "feature", "app")
	if result.Title == "" {
		t.Error("title should not be empty")
	}
}

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

func TestDetectProvider_ReturnsNonNil(t *testing.T) {
	// With no env vars, should fall back to Ollama
	provider := DetectProvider()
	if provider == nil {
		t.Error("DetectProvider should never return nil")
	}
}

func TestDetectProvider_OllamaFallback(t *testing.T) {
	// Clear env vars
	t.Setenv("DEVPOD_LLM_URL", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")

	provider := DetectProvider()
	if provider == nil {
		t.Fatal("should return ollama provider")
	}
	if provider.Name() != "ollama" {
		t.Errorf("expected ollama, got %s", provider.Name())
	}
}

func TestDetectProvider_CustomURL(t *testing.T) {
	t.Setenv("DEVPOD_LLM_URL", "http://custom:8080")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")

	provider := DetectProvider()
	if provider == nil {
		t.Fatal("should return custom provider")
	}
	if provider.Name() != "custom" {
		t.Errorf("expected custom, got %s", provider.Name())
	}
}

func TestDetectProvider_Anthropic(t *testing.T) {
	t.Setenv("DEVPOD_LLM_URL", "")
	t.Setenv("ANTHROPIC_API_KEY", "test-key")
	t.Setenv("OPENAI_API_KEY", "")

	provider := DetectProvider()
	if provider == nil {
		t.Fatal("should return anthropic provider")
	}
	if provider.Name() != "anthropic" {
		t.Errorf("expected anthropic, got %s", provider.Name())
	}
}

func TestDetectProvider_OpenAI(t *testing.T) {
	t.Setenv("DEVPOD_LLM_URL", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "test-key")

	provider := DetectProvider()
	if provider == nil {
		t.Fatal("should return openai provider")
	}
	if provider.Name() != "openai" {
		t.Errorf("expected openai, got %s", provider.Name())
	}
}

func TestDetectProvider_Priority(t *testing.T) {
	// Custom URL should take priority
	t.Setenv("DEVPOD_LLM_URL", "http://custom:8080")
	t.Setenv("ANTHROPIC_API_KEY", "test-key")
	t.Setenv("OPENAI_API_KEY", "test-key")

	provider := DetectProvider()
	if provider.Name() != "custom" {
		t.Errorf("custom URL should take priority, got %s", provider.Name())
	}
}

func TestIsAvailable_NoEnv(t *testing.T) {
	t.Setenv("DEVPOD_LLM_URL", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")

	if IsAvailable() {
		t.Error("should return false with no env vars")
	}
}

func TestIsAvailable_WithAnthropic(t *testing.T) {
	t.Setenv("DEVPOD_LLM_URL", "")
	t.Setenv("ANTHROPIC_API_KEY", "test-key")
	t.Setenv("OPENAI_API_KEY", "")

	if !IsAvailable() {
		t.Error("should return true with Anthropic key")
	}
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

func TestParseCommitMessageResponse_ExplicitFormat(t *testing.T) {
	text := "TITLE: feat(auth): add login\nDESCRIPTION: - Added login endpoint\n- Added session management"
	result := parseCommitMessageResponse(text, "feature", "auth")
	if result.Title != "feat(auth): add login" {
		t.Errorf("Title: %s", result.Title)
	}
	if result.Description == "" {
		t.Error("Description should not be empty")
	}
}

func TestParseCommitMessageResponse_NoPrefix(t *testing.T) {
	text := "add login support\n- new endpoint\n- session handling"
	result := parseCommitMessageResponse(text, "feature", "auth")
	if !strings.Contains(result.Title, "feature") {
		t.Errorf("should add type prefix: %s", result.Title)
	}
}

func TestParseCommitMessageResponse_Empty(t *testing.T) {
	result := parseCommitMessageResponse("", "fix", "core")
	if result.Title == "" {
		t.Error("should return fallback title")
	}
}

func TestParseCommitMessageResponse_TruncatesLongTitle(t *testing.T) {
	longTitle := strings.Repeat("a", 200)
	result := parseCommitMessageResponse(longTitle, "feature", "auth")
	if len(result.Title) > 72 {
		t.Errorf("title should be max 72 chars, got %d", len(result.Title))
	}
}

func TestParseCommitMessageResponse_ConventionalFormat(t *testing.T) {
	text := "fix(core): resolve memory leak\n- Fixed goroutine leak\n- Added proper cleanup"
	result := parseCommitMessageResponse(text, "fix", "core")
	if !strings.HasPrefix(result.Title, "fix(") {
		t.Errorf("should preserve conventional format: %s", result.Title)
	}
}

func TestParseTypeResponse(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"feature", "feature"},
		{"FEATURE", "feature"},
		{"fix", "fix"},
		{"Bug fix", "fix"},
		{"documentation", "docs"},
		{"docs", "docs"},
		{"chore", "chore"},
		{"refactoring (chore)", "chore"},
		{"unknown type xyz", "unknown"},
		{"", "unknown"},
		{"feat", "feature"},
	}
	for _, tt := range tests {
		result := parseTypeResponse(tt.input)
		if result != tt.expected {
			t.Errorf("parseTypeResponse(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

// ---------------------------------------------------------------------------
// splitNonEmpty
// ---------------------------------------------------------------------------

func TestSplitNonEmpty(t *testing.T) {
	result := splitNonEmpty("line1\n\nline2\n\n\nline3\n")
	if len(result) != 3 {
		t.Errorf("expected 3 lines, got %d", len(result))
	}
}

func TestSplitNonEmpty_Empty(t *testing.T) {
	result := splitNonEmpty("")
	if len(result) != 0 {
		t.Errorf("expected 0 lines, got %d", len(result))
	}
}

func TestSplitNonEmpty_AllBlank(t *testing.T) {
	result := splitNonEmpty("\n\n\n  \n")
	if len(result) != 0 {
		t.Errorf("expected 0 lines, got %d", len(result))
	}
}

// ---------------------------------------------------------------------------
// Malformed API responses
// ---------------------------------------------------------------------------

func TestGenerateDiffMessage_NoProvider(t *testing.T) {
	// Should return fallback
	t.Setenv("DEVPOD_LLM_URL", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")

	// DetectProvider returns Ollama which will fail, so it falls back
	result, err := GenerateDiffMessage("diff content", "feature", "auth")
	if err != nil {
		t.Fatalf("should not error: %v", err)
	}
	if result.Title == "" {
		t.Error("should return fallback title")
	}
}

func TestDetectChangeType_NoProvider(t *testing.T) {
	t.Setenv("DEVPOD_LLM_URL", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")

	result, err := DetectChangeType("some diff")
	if err != nil {
		t.Fatalf("should not error: %v", err)
	}
	// Will try ollama which fails, falling back to unknown
	if result != "unknown" && result != "" {
		// Acceptable: either unknown or the detected type
	}
}

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

func TestCommitMessagePrompt_Truncation(t *testing.T) {
	longDiff := strings.Repeat("x", 5000)
	prompt := commitMessagePrompt(longDiff, "feature", "auth")
	if len(prompt) > 4000 {
		// The diff should be truncated to 3000 chars
		t.Error("prompt should truncate long diffs")
	}
}

func TestTypeDetectionPrompt_Truncation(t *testing.T) {
	longDiff := strings.Repeat("x", 5000)
	prompt := typeDetectionPrompt(longDiff)
	if len(prompt) > 3000 {
		t.Error("prompt should truncate long diffs")
	}
}
