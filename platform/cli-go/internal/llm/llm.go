package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

const llmTimeout = 5 * time.Second

// Result holds a generated commit title and description.
type Result struct {
	Title       string
	Description string
}

// Provider is the interface for LLM backends.
type Provider interface {
	Name() string
	Generate(prompt string) (string, error)
}

// ---------------------------------------------------------------------------
// Provider detection (in order)
// 1. DEVPOD_LLM_URL (custom OpenAI-compatible endpoint)
// 2. ANTHROPIC_API_KEY
// 3. OPENAI_API_KEY
// 4. Ollama at localhost:11434
// 5. nil (fallback)
// ---------------------------------------------------------------------------

// DetectProvider finds the best available LLM provider.
func DetectProvider() Provider {
	// 1. Custom endpoint
	if url := os.Getenv("DEVPOD_LLM_URL"); url != "" {
		key := os.Getenv("DEVPOD_LLM_KEY")
		model := os.Getenv("DEVPOD_LLM_MODEL")
		if model == "" {
			model = "default"
		}
		return newOpenAIProvider("custom", url, key, model)
	}

	// 2. Anthropic
	if key := os.Getenv("ANTHROPIC_API_KEY"); key != "" {
		model := os.Getenv("DEVPOD_LLM_MODEL")
		if model == "" {
			model = "claude-sonnet-4-20250514"
		}
		return newAnthropicProvider(key, model)
	}

	// 3. OpenAI
	if key := os.Getenv("OPENAI_API_KEY"); key != "" {
		model := os.Getenv("DEVPOD_LLM_MODEL")
		if model == "" {
			model = "gpt-4o-mini"
		}
		return newOpenAIProvider("openai", "https://api.openai.com", key, model)
	}

	// 4. Ollama — optimistic; if down, calls fail within timeout
	model := os.Getenv("DEVPOD_LLM_MODEL")
	if model == "" {
		model = "llama3.2"
	}
	return newOpenAIProvider("ollama", "http://localhost:11434", "", model)
}

// IsAvailable checks if any LLM provider is configured via environment.
// Ollama availability requires a network check, so it is excluded here.
func IsAvailable() bool {
	return os.Getenv("DEVPOD_LLM_URL") != "" ||
		os.Getenv("ANTHROPIC_API_KEY") != "" ||
		os.Getenv("OPENAI_API_KEY") != ""
}

// ---------------------------------------------------------------------------
// Anthropic provider
// ---------------------------------------------------------------------------

type anthropicProvider struct {
	apiKey string
	model  string
}

func newAnthropicProvider(apiKey, model string) Provider {
	return &anthropicProvider{apiKey: apiKey, model: model}
}

func (p *anthropicProvider) Name() string { return "anthropic" }

func (p *anthropicProvider) Generate(prompt string) (string, error) {
	body := map[string]interface{}{
		"model":      p.model,
		"max_tokens": 300,
		"messages":   []map[string]string{{"role": "user", "content": prompt}},
	}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), llmTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}
	if len(result.Content) > 0 {
		return result.Content[0].Text, nil
	}
	return "", nil
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (also used for Ollama and custom endpoints)
// ---------------------------------------------------------------------------

type openAIProvider struct {
	name    string
	baseURL string
	apiKey  string
	model   string
}

func newOpenAIProvider(name, baseURL, apiKey, model string) Provider {
	return &openAIProvider{name: name, baseURL: baseURL, apiKey: apiKey, model: model}
}

func (p *openAIProvider) Name() string { return p.name }

func (p *openAIProvider) Generate(prompt string) (string, error) {
	url := strings.TrimRight(p.baseURL, "/") + "/v1/chat/completions"

	body := map[string]interface{}{
		"model": p.model,
		"messages": []map[string]string{
			{"role": "system", "content": "You generate concise commit messages."},
			{"role": "user", "content": prompt},
		},
		"max_tokens":  300,
		"temperature": 0.3,
	}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), llmTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}
	if len(result.Choices) > 0 {
		return result.Choices[0].Message.Content, nil
	}
	return "", nil
}

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

func commitMessagePrompt(diff, changeType, scope string) string {
	truncated := diff
	if len(truncated) > 3000 {
		truncated = truncated[:3000]
	}
	return fmt.Sprintf(`Generate a conventional commit message for this diff.

Type: %s
Scope: %s

Format:
- Title: type(scope): description (max 72 chars, lowercase)
- Description: 2-3 bullet points starting with "- "

Rules:
- Be specific about what was added/changed/removed
- No AI attribution
- No generic messages like "update files"

Diff:
%s`, changeType, scope, truncated)
}

func typeDetectionPrompt(diff string) string {
	truncated := diff
	if len(truncated) > 2000 {
		truncated = truncated[:2000]
	}
	return fmt.Sprintf(`Classify this code change as one of: feature, fix, docs, chore

- feature: new functionality or capability
- fix: bug fix or error correction
- docs: documentation changes only
- chore: tooling, dependencies, config, refactoring

Respond with ONLY the type word, nothing else.

Diff:
%s`, truncated)
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

func parseCommitMessageResponse(text, changeType, scope string) Result {
	lines := splitNonEmpty(strings.TrimSpace(text))
	if len(lines) == 0 {
		return Result{Title: fmt.Sprintf("%s(%s): update files", changeType, scope)}
	}

	// Look for explicit TITLE:/DESCRIPTION: format
	titleRe := regexp.MustCompile(`(?i)TITLE:\s*(.+)`)
	descRe := regexp.MustCompile(`(?is)DESCRIPTION:\s*(.*)`)

	if match := titleRe.FindStringSubmatch(text); match != nil {
		title := strings.TrimSpace(match[1])
		if len(title) > 72 {
			title = title[:72]
		}
		desc := ""
		if dmatch := descRe.FindStringSubmatch(text); dmatch != nil {
			desc = strings.TrimSpace(dmatch[1])
		}
		return Result{Title: title, Description: desc}
	}

	// Otherwise take first line as title, rest as description
	title := strings.TrimSpace(lines[0])
	conventionalRe := regexp.MustCompile(`^\w+\(`)
	if !conventionalRe.MatchString(title) {
		title = fmt.Sprintf("%s(%s): %s", changeType, scope, title)
	}
	if len(title) > 72 {
		title = title[:72]
	}

	var descLines []string
	for _, l := range lines[1:] {
		if strings.HasPrefix(l, "- ") {
			descLines = append(descLines, l)
		}
	}
	return Result{Title: title, Description: strings.Join(descLines, "\n")}
}

func parseTypeResponse(text string) string {
	cleaned := strings.ToLower(strings.TrimSpace(text))
	if strings.Contains(cleaned, "fix") {
		return "fix"
	}
	if strings.Contains(cleaned, "docs") || strings.Contains(cleaned, "documentation") {
		return "docs"
	}
	if strings.Contains(cleaned, "chore") {
		return "chore"
	}
	if strings.Contains(cleaned, "feature") || strings.Contains(cleaned, "feat") {
		return "feature"
	}
	return "unknown"
}

func splitNonEmpty(s string) []string {
	var result []string
	for _, line := range strings.Split(s, "\n") {
		if strings.TrimSpace(line) != "" {
			result = append(result, line)
		}
	}
	return result
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

// GenerateDiffMessage uses LLM to create a conventional commit message.
func GenerateDiffMessage(diff, changeType, scope string) (Result, error) {
	provider := DetectProvider()
	if provider == nil {
		return Result{Title: fmt.Sprintf("%s(%s): update files", changeType, scope)}, nil
	}

	prompt := commitMessagePrompt(diff, changeType, scope)
	text, err := provider.Generate(prompt)
	if err != nil || text == "" {
		return Result{Title: fmt.Sprintf("%s(%s): update files", changeType, scope)}, nil
	}
	return parseCommitMessageResponse(text, changeType, scope), nil
}

// DetectChangeType uses LLM to classify the change.
func DetectChangeType(diff string) (string, error) {
	provider := DetectProvider()
	if provider == nil {
		return "unknown", nil
	}

	prompt := typeDetectionPrompt(diff)
	text, err := provider.Generate(prompt)
	if err != nil || text == "" {
		return "unknown", nil
	}
	return parseTypeResponse(text), nil
}

// GenerateFallbackMessage creates a message from file names (no LLM).
func GenerateFallbackMessage(files []string, changeType, scope string) Result {
	if len(files) == 0 {
		return Result{Title: fmt.Sprintf("%s(%s): update files", changeType, scope)}
	}

	areas := make(map[string]struct{})
	var areaOrder []string
	for _, f := range files {
		parts := strings.Split(f, "/")
		var area string
		if len(parts) > 1 {
			area = parts[len(parts)-2]
		} else {
			area = f
		}
		if _, exists := areas[area]; !exists {
			areas[area] = struct{}{}
			areaOrder = append(areaOrder, area)
		}
	}

	if len(areaOrder) > 3 {
		areaOrder = areaOrder[:3]
	}
	areaStr := strings.Join(areaOrder, ", ")

	title := fmt.Sprintf("%s(%s): update %s", changeType, scope, areaStr)
	if len(title) > 72 {
		title = title[:72]
	}

	descFiles := files
	if len(descFiles) > 5 {
		descFiles = descFiles[:5]
	}
	var descLines []string
	for _, f := range descFiles {
		descLines = append(descLines, "- "+f)
	}

	return Result{Title: title, Description: strings.Join(descLines, "\n")}
}
