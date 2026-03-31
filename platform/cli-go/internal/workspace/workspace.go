package workspace

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

func getRoot(cwd ...string) string {
	root, err := git.GetRepoRoot(cwd...)
	if err != nil {
		return "."
	}
	return root
}

func devpodDir(cwd ...string) string {
	return filepath.Join(getRoot(cwd...), ".devpod")
}

func configFilePath(cwd ...string) string {
	return filepath.Join(devpodDir(cwd...), "config.json")
}

func featuresDir(cwd ...string) string {
	return filepath.Join(devpodDir(cwd...), "features")
}

func diffsDir(cwd ...string) string {
	return filepath.Join(devpodDir(cwd...), "diffs")
}

func undoDir(cwd ...string) string {
	return filepath.Join(devpodDir(cwd...), "undo")
}

func editingFilePath(cwd ...string) string {
	return filepath.Join(devpodDir(cwd...), ".editing")
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

// EnsureDevpodDir creates the .devpod/ structure if missing and adds it
// to .git/info/exclude so it is never committed.
func EnsureDevpodDir(cwd ...string) error {
	root := getRoot(cwd...)
	dp := filepath.Join(root, ".devpod")

	if err := os.MkdirAll(filepath.Join(dp, "features"), 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(dp, "diffs"), 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(dp, "undo"), 0o755); err != nil {
		return err
	}

	// Add .devpod/ to .git/info/exclude (not .gitignore)
	excludePath := filepath.Join(root, ".git", "info", "exclude")
	excludeParent := filepath.Dir(excludePath)
	_ = os.MkdirAll(excludeParent, 0o755)

	existing := ""
	data, err := os.ReadFile(excludePath)
	if err == nil {
		existing = string(data)
	}
	if !strings.Contains(existing, ".devpod/") {
		_ = os.WriteFile(excludePath, []byte(existing+"\n.devpod/\n"), 0o644)
	}

	return nil
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

var defaultConfig = Config{
	DefaultBranch: "main",
	LLM:           LLMConfig{Enabled: true, Provider: "auto"},
	CI:            CIConfig{AutoRun: true},
	Aliases:       true,
}

// LoadConfig reads .devpod/config.json, merging with defaults.
func LoadConfig(cwd ...string) Config {
	data, err := os.ReadFile(configFilePath(cwd...))
	if err != nil {
		cfg := defaultConfig
		return cfg
	}

	var parsed Config
	if err := json.Unmarshal(data, &parsed); err != nil {
		cfg := defaultConfig
		return cfg
	}

	// Merge with defaults
	result := defaultConfig
	if parsed.DefaultBranch != "" {
		result.DefaultBranch = parsed.DefaultBranch
	}
	result.Aliases = parsed.Aliases

	// Merge LLM
	if parsed.LLM.Provider != "" {
		result.LLM.Provider = parsed.LLM.Provider
	}
	result.LLM.Enabled = parsed.LLM.Enabled
	if parsed.LLM.URL != "" {
		result.LLM.URL = parsed.LLM.URL
	}
	if parsed.LLM.Model != "" {
		result.LLM.Model = parsed.LLM.Model
	}
	if parsed.LLM.APIKey != "" {
		result.LLM.APIKey = parsed.LLM.APIKey
	}

	// Merge CI
	result.CI.AutoRun = parsed.CI.AutoRun

	return result
}

// SaveConfig writes .devpod/config.json.
func SaveConfig(config Config, cwd ...string) error {
	if err := EnsureDevpodDir(cwd...); err != nil {
		return err
	}
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configFilePath(cwd...), append(data, '\n'), 0o644)
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

// Slugify converts a name to a URL-safe slug.
func Slugify(name string) string {
	s := strings.ToLower(name)
	nonAlnum := regexp.MustCompile(`[^a-z0-9\s-]`)
	s = nonAlnum.ReplaceAllString(s, "")
	spaces := regexp.MustCompile(`\s+`)
	s = spaces.ReplaceAllString(s, "-")
	dashes := regexp.MustCompile(`-+`)
	s = dashes.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

// LoadFeature reads a feature file by slug.
func LoadFeature(slug string, cwd ...string) (*FeatureData, error) {
	filePath := filepath.Join(featuresDir(cwd...), slug+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	var feature FeatureData
	if err := json.Unmarshal(data, &feature); err != nil {
		return nil, err
	}
	return &feature, nil
}

// SaveFeature writes a feature file.
func SaveFeature(feature FeatureData, cwd ...string) error {
	if err := EnsureDevpodDir(cwd...); err != nil {
		return err
	}
	data, err := json.MarshalIndent(feature, "", "  ")
	if err != nil {
		return err
	}
	filePath := filepath.Join(featuresDir(cwd...), feature.Slug+".json")
	return os.WriteFile(filePath, append(data, '\n'), 0o644)
}

// ListFeatures returns all features in the workspace.
func ListFeatures(cwd ...string) []FeatureData {
	dir := featuresDir(cwd...)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	var features []FeatureData
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		var f FeatureData
		if err := json.Unmarshal(data, &f); err != nil {
			continue
		}
		features = append(features, f)
	}
	return features
}

// GetCurrentFeature returns the feature for the current branch, or nil.
func GetCurrentFeature(cwd ...string) *FeatureData {
	branch, err := git.GetCurrentBranch(cwd...)
	if err != nil {
		return nil
	}
	features := ListFeatures(cwd...)
	for i := range features {
		if features[i].Branch == branch {
			return &features[i]
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Diffs
// ---------------------------------------------------------------------------

// GenerateDiffUUID returns a new random UUID for a diff.
func GenerateDiffUUID() string {
	return uuid.New().String()
}

// LoadDiff reads a diff file by UUID.
func LoadDiff(id string, cwd ...string) (*DiffData, error) {
	filePath := filepath.Join(diffsDir(cwd...), id+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	var diff DiffData
	if err := json.Unmarshal(data, &diff); err != nil {
		return nil, err
	}
	return &diff, nil
}

// SaveDiff writes a diff file.
func SaveDiff(diff DiffData, cwd ...string) error {
	if err := EnsureDevpodDir(cwd...); err != nil {
		return err
	}
	data, err := json.MarshalIndent(diff, "", "  ")
	if err != nil {
		return err
	}
	filePath := filepath.Join(diffsDir(cwd...), diff.UUID+".json")
	return os.WriteFile(filePath, append(data, '\n'), 0o644)
}

// LoadDiffsForFeature loads all diffs referenced by a feature in order.
func LoadDiffsForFeature(feature FeatureData, cwd ...string) []DiffData {
	var diffs []DiffData
	for _, id := range feature.Diffs {
		d, err := LoadDiff(id, cwd...)
		if err == nil && d != nil {
			diffs = append(diffs, *d)
		}
	}
	return diffs
}

// GetNextDiffPosition returns the next position number for a new diff.
func GetNextDiffPosition(feature FeatureData, cwd ...string) int {
	diffs := LoadDiffsForFeature(feature, cwd...)
	if len(diffs) == 0 {
		return 1
	}
	maxPos := 0
	for _, d := range diffs {
		if d.Position > maxPos {
			maxPos = d.Position
		}
	}
	return maxPos + 1
}

// GetDiffByPosition finds a diff by its position in the feature stack.
func GetDiffByPosition(feature FeatureData, position int, cwd ...string) *DiffData {
	diffs := LoadDiffsForFeature(feature, cwd...)
	for i := range diffs {
		if diffs[i].Position == position {
			return &diffs[i]
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Trailer-based diff discovery (primary source of truth)
// ---------------------------------------------------------------------------

// LoadDiffsFromTrailers reconstructs the diff stack by scanning commit
// message trailers on the current branch. This is the primary source of
// truth — JSON files in .devpod/diffs/ are just a local cache.
func LoadDiffsFromTrailers(feature FeatureData, cwd ...string) []DiffData {
	base := git.GetDefaultBranch(cwd...)
	commits, err := git.FindDiffCommits(feature.Branch, base, cwd...)
	if err != nil || len(commits) == 0 {
		// Fall back to JSON files
		return LoadDiffsForFeature(feature, cwd...)
	}

	var diffs []DiffData
	for i, c := range commits {
		// Try loading cached JSON for extra metadata (CI, status, etc.)
		cached := findCachedDiffByCommit(c.SHA, feature, cwd...)

		diff := DiffData{
			UUID:     diffUUIDFromTrailers(c, cached),
			Feature:  feature.Slug,
			Commit:   c.SHA,
			Position: i + 1,
			Title:    c.Title,
			Type:     ChangeType(c.Trailers.Type),
			Version:  parseVersion(c.Trailers.Version),
			Created:  "", // populated from cache if available
			Updated:  "",
		}

		// Merge cached metadata (status, CI, files, etc.)
		if cached != nil {
			diff.UUID = cached.UUID
			diff.Description = cached.Description
			diff.Files = cached.Files
			diff.Additions = cached.Additions
			diff.Deletions = cached.Deletions
			diff.Status = cached.Status
			diff.CI = cached.CI
			diff.GitHubPR = cached.GitHubPR
			diff.Created = cached.Created
			diff.Updated = cached.Updated
		} else {
			diff.UUID = GenerateDiffUUID()
			diff.Status = Draft
			diff.Description = ""
		}

		diffs = append(diffs, diff)
	}
	return diffs
}

// SyncTrailersToJSON writes all trailer-discovered diffs to JSON cache files
// and updates the feature's diffs list. Call after any operation that changes
// the commit stack (diff, sync, edit, land).
func SyncTrailersToJSON(feature *FeatureData, cwd ...string) error {
	diffs := LoadDiffsFromTrailers(*feature, cwd...)
	feature.Diffs = make([]string, len(diffs))
	for i, d := range diffs {
		feature.Diffs[i] = d.UUID
		if err := SaveDiff(d, cwd...); err != nil {
			return err
		}
	}
	return SaveFeature(*feature, cwd...)
}

func findCachedDiffByCommit(sha string, feature FeatureData, cwd ...string) *DiffData {
	for _, id := range feature.Diffs {
		d, err := LoadDiff(id, cwd...)
		if err == nil && d != nil && d.Commit == sha {
			return d
		}
	}
	return nil
}

func diffUUIDFromTrailers(c git.DiffCommit, cached *DiffData) string {
	if cached != nil {
		return cached.UUID
	}
	return GenerateDiffUUID()
}

func parseVersion(s string) int {
	if s == "" {
		return 1
	}
	v := 1
	for _, c := range s {
		if c >= '0' && c <= '9' {
			v = v*10 + int(c-'0') - v // simplified: just parse the number
		}
	}
	// Simple atoi
	n := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		}
	}
	if n > 0 {
		return n
	}
	return 1
}

// ---------------------------------------------------------------------------
// Editing state
// ---------------------------------------------------------------------------

// SetEditingDiff sets or clears the currently-editing diff UUID.
// Pass an empty string to clear.
func SetEditingDiff(id string, cwd ...string) error {
	if err := EnsureDevpodDir(cwd...); err != nil {
		return err
	}
	fp := editingFilePath(cwd...)
	if id == "" {
		_ = os.Remove(fp)
		return nil
	}
	return os.WriteFile(fp, []byte(id), 0o644)
}

// GetEditingDiff returns the UUID of the currently-editing diff, or "".
func GetEditingDiff(cwd ...string) string {
	data, err := os.ReadFile(editingFilePath(cwd...))
	if err != nil {
		return ""
	}
	s := strings.TrimSpace(string(data))
	return s
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

// SaveUndoEntry saves an undo entry to disk.
func SaveUndoEntry(entry UndoEntry, cwd ...string) error {
	if err := EnsureDevpodDir(cwd...); err != nil {
		return err
	}
	dir := undoDir(cwd...)
	_ = os.MkdirAll(dir, 0o755)

	filename := strings.NewReplacer(":", "-", ".", "-").Replace(entry.Timestamp) + ".json"
	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, filename), append(data, '\n'), 0o644)
}

// ListUndoEntries returns all undo entries in chronological order.
func ListUndoEntries(cwd ...string) []UndoEntry {
	dir := undoDir(cwd...)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			files = append(files, entry.Name())
		}
	}
	sort.Strings(files)

	var undoEntries []UndoEntry
	for _, f := range files {
		data, err := os.ReadFile(filepath.Join(dir, f))
		if err != nil {
			continue
		}
		var e UndoEntry
		if err := json.Unmarshal(data, &e); err != nil {
			continue
		}
		undoEntries = append(undoEntries, e)
	}
	return undoEntries
}

// GetLastUndoEntry returns the most recent undo entry, or nil.
func GetLastUndoEntry(cwd ...string) *UndoEntry {
	entries := ListUndoEntries(cwd...)
	if len(entries) == 0 {
		return nil
	}
	return &entries[len(entries)-1]
}

// RemoveLastUndoEntry removes the most recent undo entry.
func RemoveLastUndoEntry(cwd ...string) error {
	dir := undoDir(cwd...)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil // non-fatal
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			files = append(files, entry.Name())
		}
	}
	if len(files) == 0 {
		return nil
	}
	sort.Strings(files)
	_ = os.Remove(filepath.Join(dir, files[len(files)-1]))
	return nil
}
