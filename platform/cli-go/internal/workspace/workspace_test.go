package workspace

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/git"
)

func initTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	mustRun(t, dir, "git", "init")
	mustRun(t, dir, "git", "config", "user.email", "test@test.com")
	mustRun(t, dir, "git", "config", "user.name", "Test")
	writeFile(t, dir, "README.md", "# test repo")
	mustRun(t, dir, "git", "add", "-A")
	mustRun(t, dir, "git", "commit", "-m", "initial commit")
	return dir
}

func mustRun(t *testing.T, dir string, name string, args ...string) string {
	t.Helper()
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("command %s %v failed: %v\n%s", name, args, err, string(out))
	}
	return strings.TrimSpace(string(out))
}

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	fullPath := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(fullPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Slugify
// ---------------------------------------------------------------------------

func TestSlugify_Basic(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Add Login Flow", "add-login-flow"},
		{"fix bug", "fix-bug"},
		{"UPPER CASE", "upper-case"},
		{"already-slug", "already-slug"},
		{"  extra  spaces  ", "extra-spaces"},
		{"special!@#chars", "specialchars"},
		{"multiple---dashes", "multiple-dashes"},
		{"-leading-trailing-", "leading-trailing"},
		{"", ""},
	}

	for _, tt := range tests {
		result := Slugify(tt.input)
		if result != tt.expected {
			t.Errorf("Slugify(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestSlugify_Unicode(t *testing.T) {
	// Unicode chars should be stripped
	result := Slugify("hello world")
	if result != "hello-world" {
		t.Errorf("got %q", result)
	}
}

func TestSlugify_Numbers(t *testing.T) {
	result := Slugify("version 2 update")
	if result != "version-2-update" {
		t.Errorf("got %q", result)
	}
}

func TestSlugify_OnlySpecialChars(t *testing.T) {
	result := Slugify("!@#$%")
	if result != "" {
		t.Errorf("expected empty, got %q", result)
	}
}

func TestSlugify_Duplicates(t *testing.T) {
	s1 := Slugify("Add Login")
	s2 := Slugify("Add Login")
	if s1 != s2 {
		t.Error("same input should produce same slug")
	}
}

// ---------------------------------------------------------------------------
// EnsureDevpodDir
// ---------------------------------------------------------------------------

func TestEnsureDevpodDir(t *testing.T) {
	dir := initTestRepo(t)
	err := EnsureDevpodDir(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Check directories exist
	for _, subdir := range []string{"features", "diffs", "undo"} {
		path := filepath.Join(dir, ".devpod", subdir)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Errorf("expected directory %s to exist", subdir)
		}
	}

	// Check .git/info/exclude contains .devpod/
	excludePath := filepath.Join(dir, ".git", "info", "exclude")
	data, err := os.ReadFile(excludePath)
	if err != nil {
		t.Fatalf("could not read exclude file: %v", err)
	}
	if !strings.Contains(string(data), ".devpod/") {
		t.Error(".devpod/ not in .git/info/exclude")
	}
}

func TestEnsureDevpodDir_Idempotent(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)
	err := EnsureDevpodDir(dir)
	if err != nil {
		t.Fatalf("second call should succeed: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

func TestLoadConfig_Default(t *testing.T) {
	dir := initTestRepo(t)
	cfg := LoadConfig(dir)
	if cfg.DefaultBranch != "main" {
		t.Errorf("default branch: %s", cfg.DefaultBranch)
	}
	if !cfg.LLM.Enabled {
		t.Error("LLM should be enabled by default")
	}
	if cfg.LLM.Provider != "auto" {
		t.Errorf("provider: %s", cfg.LLM.Provider)
	}
}

func TestSaveConfig_LoadConfig(t *testing.T) {
	dir := initTestRepo(t)
	cfg := Config{
		DefaultBranch: "develop",
		LLM:           LLMConfig{Enabled: false, Provider: "openai"},
		CI:            CIConfig{AutoRun: false},
		Aliases:       false,
	}
	err := SaveConfig(cfg, dir)
	if err != nil {
		t.Fatalf("save error: %v", err)
	}

	loaded := LoadConfig(dir)
	if loaded.DefaultBranch != "develop" {
		t.Errorf("DefaultBranch: %s", loaded.DefaultBranch)
	}
	if loaded.LLM.Enabled {
		t.Error("LLM should be disabled")
	}
	if loaded.LLM.Provider != "openai" {
		t.Errorf("Provider: %s", loaded.LLM.Provider)
	}
	if loaded.CI.AutoRun {
		t.Error("AutoRun should be false")
	}
}

func TestLoadConfig_InvalidJSON(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)
	// Write invalid JSON
	_ = os.WriteFile(filepath.Join(dir, ".devpod", "config.json"), []byte("not json"), 0o644)
	cfg := LoadConfig(dir)
	// Should fall back to defaults
	if cfg.DefaultBranch != "main" {
		t.Error("should fall back to defaults for invalid JSON")
	}
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

func TestSaveFeature_LoadFeature(t *testing.T) {
	dir := initTestRepo(t)
	feature := FeatureData{
		Name:    "Test Feature",
		Type:    Feature,
		Slug:    "test-feature",
		Branch:  "feature/test-feature",
		Created: time.Now().UTC().Format(time.RFC3339),
		Diffs:   []string{},
		Status:  Active,
	}
	err := SaveFeature(feature, dir)
	if err != nil {
		t.Fatalf("save error: %v", err)
	}

	loaded, err := LoadFeature("test-feature", dir)
	if err != nil {
		t.Fatalf("load error: %v", err)
	}
	if loaded.Name != "Test Feature" {
		t.Errorf("Name: %s", loaded.Name)
	}
	if loaded.Branch != "feature/test-feature" {
		t.Errorf("Branch: %s", loaded.Branch)
	}
}

func TestLoadFeature_NotFound(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)
	_, err := LoadFeature("nonexistent", dir)
	if err == nil {
		t.Error("expected error for nonexistent feature")
	}
}

func TestListFeatures(t *testing.T) {
	dir := initTestRepo(t)
	// Save two features
	_ = SaveFeature(FeatureData{
		Name: "Feature 1", Slug: "feature-1", Branch: "feature/feature-1", Status: Active,
	}, dir)
	_ = SaveFeature(FeatureData{
		Name: "Feature 2", Slug: "feature-2", Branch: "feature/feature-2", Status: Active,
	}, dir)

	features := ListFeatures(dir)
	if len(features) != 2 {
		t.Errorf("expected 2 features, got %d", len(features))
	}
}

func TestListFeatures_Empty(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)
	features := ListFeatures(dir)
	if len(features) != 0 {
		t.Errorf("expected 0 features, got %d", len(features))
	}
}

func TestGetCurrentFeature(t *testing.T) {
	dir := initTestRepo(t)
	// Get the actual default branch name (may be main or master)
	defaultBranch := mustRun(t, dir, "git", "rev-parse", "--abbrev-ref", "HEAD")

	_ = SaveFeature(FeatureData{
		Name: "Test", Slug: "test", Branch: defaultBranch, Status: Active,
	}, dir)

	feature := GetCurrentFeature(dir)
	if feature == nil {
		t.Fatal("expected current feature")
	}
	if feature.Name != "Test" {
		t.Errorf("Name: %s", feature.Name)
	}
}

func TestGetCurrentFeature_NoMatch(t *testing.T) {
	dir := initTestRepo(t)
	_ = SaveFeature(FeatureData{
		Name: "Other", Slug: "other", Branch: "feature/other", Status: Active,
	}, dir)

	feature := GetCurrentFeature(dir)
	if feature != nil {
		t.Error("should return nil when no feature matches current branch")
	}
}

func TestFeatureData_VersionsBranch(t *testing.T) {
	feature := FeatureData{
		Name:           "Test",
		Branch:         "feature/test",
		VersionsBranch: "feature/test--versions",
	}
	if feature.VersionsBranch != "feature/test--versions" {
		t.Errorf("VersionsBranch: %s", feature.VersionsBranch)
	}
}

func TestFeatureData_SnapshotCount(t *testing.T) {
	feature := FeatureData{
		Name:          "Test",
		SnapshotCount: 5,
	}
	if feature.SnapshotCount != 5 {
		t.Errorf("SnapshotCount: %d", feature.SnapshotCount)
	}
}

// ---------------------------------------------------------------------------
// Versions branch naming
// ---------------------------------------------------------------------------

func TestVersionsBranchName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"feature/foo", "feature/foo--versions"},
		{"fix/bar", "fix/bar--versions"},
		{"main", "main--versions"},
	}
	for _, tt := range tests {
		result := VersionsBranchName(tt.input)
		if result != tt.expected {
			t.Errorf("VersionsBranchName(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

// ---------------------------------------------------------------------------
// Snapshot ID generation
// ---------------------------------------------------------------------------

func TestGetNextSnapshotID(t *testing.T) {
	feature := FeatureData{SnapshotCount: 0}
	id := GetNextSnapshotID(feature)
	if id != "S1" {
		t.Errorf("expected S1, got %s", id)
	}

	feature.SnapshotCount = 5
	id = GetNextSnapshotID(feature)
	if id != "S6" {
		t.Errorf("expected S6, got %s", id)
	}
}

// ---------------------------------------------------------------------------
// Diffs
// ---------------------------------------------------------------------------

func TestSaveDiff_LoadDiff(t *testing.T) {
	dir := initTestRepo(t)
	diff := DiffData{
		ID:      "D1",
		UUID:    "test-uuid-123",
		Feature: "test",
		Title:   "Test Diff",
		Version: 1,
		Status:  Draft,
	}
	err := SaveDiff(diff, dir)
	if err != nil {
		t.Fatalf("save error: %v", err)
	}

	loaded, err := LoadDiff("test-uuid-123", dir)
	if err != nil {
		t.Fatalf("load error: %v", err)
	}
	if loaded.ID != "D1" {
		t.Errorf("ID: %s", loaded.ID)
	}
	if loaded.Title != "Test Diff" {
		t.Errorf("Title: %s", loaded.Title)
	}
}

func TestLoadDiff_NotFound(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)
	_, err := LoadDiff("nonexistent", dir)
	if err == nil {
		t.Error("expected error for nonexistent diff")
	}
}

func TestLoadDiffsForFeature(t *testing.T) {
	dir := initTestRepo(t)

	_ = SaveDiff(DiffData{UUID: "uuid1", ID: "D1", Feature: "test", Position: 1}, dir)
	_ = SaveDiff(DiffData{UUID: "uuid2", ID: "D2", Feature: "test", Position: 2}, dir)

	feature := FeatureData{Diffs: []string{"uuid1", "uuid2"}}
	diffs := LoadDiffsForFeature(feature, dir)
	if len(diffs) != 2 {
		t.Errorf("expected 2 diffs, got %d", len(diffs))
	}
}

func TestLoadDiffsForFeature_MissingDiff(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)

	_ = SaveDiff(DiffData{UUID: "uuid1", ID: "D1"}, dir)

	feature := FeatureData{Diffs: []string{"uuid1", "nonexistent"}}
	diffs := LoadDiffsForFeature(feature, dir)
	if len(diffs) != 1 {
		t.Errorf("expected 1 diff (missing one skipped), got %d", len(diffs))
	}
}

func TestGetNextDiffPosition(t *testing.T) {
	dir := initTestRepo(t)

	_ = SaveDiff(DiffData{UUID: "uuid1", Position: 1}, dir)
	_ = SaveDiff(DiffData{UUID: "uuid2", Position: 3}, dir)

	feature := FeatureData{Diffs: []string{"uuid1", "uuid2"}}
	pos := GetNextDiffPosition(feature, dir)
	if pos != 4 {
		t.Errorf("expected 4, got %d", pos)
	}
}

func TestGetNextDiffPosition_Empty(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)

	feature := FeatureData{Diffs: []string{}}
	pos := GetNextDiffPosition(feature, dir)
	if pos != 1 {
		t.Errorf("expected 1, got %d", pos)
	}
}

func TestGetDiffByPosition(t *testing.T) {
	dir := initTestRepo(t)

	_ = SaveDiff(DiffData{UUID: "uuid1", ID: "D1", Position: 1, Title: "First"}, dir)
	_ = SaveDiff(DiffData{UUID: "uuid2", ID: "D2", Position: 2, Title: "Second"}, dir)

	feature := FeatureData{Diffs: []string{"uuid1", "uuid2"}}

	d := GetDiffByPosition(feature, 2, dir)
	if d == nil {
		t.Fatal("expected to find diff at position 2")
	}
	if d.Title != "Second" {
		t.Errorf("Title: %s", d.Title)
	}

	d = GetDiffByPosition(feature, 99, dir)
	if d != nil {
		t.Error("should return nil for non-existent position")
	}
}

func TestGetDiffByID(t *testing.T) {
	dir := initTestRepo(t)

	_ = SaveDiff(DiffData{UUID: "uuid1", ID: "D1", Title: "First"}, dir)
	_ = SaveDiff(DiffData{UUID: "uuid2", ID: "D2", Title: "Second"}, dir)

	feature := FeatureData{Diffs: []string{"uuid1", "uuid2"}}

	d := GetDiffByID(feature, "D2", dir)
	if d == nil {
		t.Fatal("expected to find D2")
	}
	if d.Title != "Second" {
		t.Errorf("Title: %s", d.Title)
	}
}

// ---------------------------------------------------------------------------
// Diff versions
// ---------------------------------------------------------------------------

func TestDiffVersion_Fields(t *testing.T) {
	v := DiffVersion{
		Number:      2,
		SnapshotID:  "S4",
		SnapshotSHA: "abc123",
		CleanSHA:    "def456",
		Message:     "update auth module",
		Action:      "update",
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}
	if v.Number != 2 || v.SnapshotID != "S4" {
		t.Error("field values incorrect")
	}
}

func TestAddDiffVersion(t *testing.T) {
	dir := initTestRepo(t)
	_ = SaveDiff(DiffData{UUID: "uuid1", ID: "D1", Version: 1}, dir)

	feature := FeatureData{Diffs: []string{"uuid1"}}
	version := DiffVersion{
		Number:     2,
		SnapshotID: "S2",
		Action:     "update",
	}

	err := AddDiffVersion(&feature, "uuid1", version, dir)
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	loaded, _ := LoadDiff("uuid1", dir)
	if loaded.Version != 2 {
		t.Errorf("Version: %d", loaded.Version)
	}
	if len(loaded.Versions) != 1 {
		t.Fatalf("Versions count: %d", len(loaded.Versions))
	}
	if loaded.Versions[0].SnapshotID != "S2" {
		t.Errorf("SnapshotID: %s", loaded.Versions[0].SnapshotID)
	}
}

func TestGetDiffVersions(t *testing.T) {
	dir := initTestRepo(t)
	_ = SaveDiff(DiffData{
		UUID: "uuid1", ID: "D1",
		Versions: []DiffVersion{
			{Number: 1, Action: "create"},
			{Number: 2, Action: "update"},
		},
	}, dir)

	feature := FeatureData{Diffs: []string{"uuid1"}}
	versions := GetDiffVersions(feature, "uuid1", dir)
	if len(versions) != 2 {
		t.Errorf("expected 2 versions, got %d", len(versions))
	}
}

func TestGetLatestDiffVersion(t *testing.T) {
	dir := initTestRepo(t)
	_ = SaveDiff(DiffData{
		UUID: "uuid1", ID: "D1",
		Versions: []DiffVersion{
			{Number: 1, Action: "create"},
			{Number: 3, Action: "update"},
			{Number: 2, Action: "update"},
		},
	}, dir)

	feature := FeatureData{Diffs: []string{"uuid1"}}
	latest := GetLatestDiffVersion(feature, "uuid1", dir)
	if latest == nil {
		t.Fatal("expected latest version")
	}
	if latest.Number != 3 {
		t.Errorf("expected version 3, got %d", latest.Number)
	}
}

func TestGetLatestDiffVersion_Empty(t *testing.T) {
	dir := initTestRepo(t)
	_ = SaveDiff(DiffData{UUID: "uuid1", ID: "D1"}, dir)

	feature := FeatureData{Diffs: []string{"uuid1"}}
	latest := GetLatestDiffVersion(feature, "uuid1", dir)
	if latest != nil {
		t.Error("should return nil for no versions")
	}
}

// ---------------------------------------------------------------------------
// Stack string
// ---------------------------------------------------------------------------

func TestGetStackString(t *testing.T) {
	dir := initTestRepo(t)
	_ = SaveDiff(DiffData{UUID: "uuid1", ID: "D1", Version: 2}, dir)
	_ = SaveDiff(DiffData{UUID: "uuid2", ID: "D2", Version: 1}, dir)
	_ = SaveDiff(DiffData{UUID: "uuid3", ID: "D3", Version: 1}, dir)

	feature := FeatureData{Diffs: []string{"uuid1", "uuid2", "uuid3"}}
	stack := GetStackString(feature, dir)
	if stack != "D1v2,D2v1,D3v1" {
		t.Errorf("expected D1v2,D2v1,D3v1, got %s", stack)
	}
}

func TestGetStackString_Empty(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)
	feature := FeatureData{Diffs: []string{}}
	stack := GetStackString(feature, dir)
	if stack != "" {
		t.Errorf("expected empty, got %q", stack)
	}
}

// ---------------------------------------------------------------------------
// Pending rebase
// ---------------------------------------------------------------------------

func TestSavePendingRebase_LoadPendingRebase(t *testing.T) {
	dir := initTestRepo(t)

	pr := PendingRebase{
		EditingDiff:    "D2",
		PreEditSHA:     "abc123",
		RemainingPicks: []string{"sha1", "sha2"},
		CompletedPicks: []string{"sha0"},
	}
	err := SavePendingRebase(pr, dir)
	if err != nil {
		t.Fatalf("save error: %v", err)
	}

	loaded := LoadPendingRebase(dir)
	if loaded == nil {
		t.Fatal("expected non-nil pending rebase")
	}
	if loaded.EditingDiff != "D2" {
		t.Errorf("EditingDiff: %s", loaded.EditingDiff)
	}
	if len(loaded.RemainingPicks) != 2 {
		t.Errorf("RemainingPicks: %d", len(loaded.RemainingPicks))
	}
	if len(loaded.CompletedPicks) != 1 {
		t.Errorf("CompletedPicks: %d", len(loaded.CompletedPicks))
	}
}

func TestLoadPendingRebase_None(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)
	loaded := LoadPendingRebase(dir)
	if loaded != nil {
		t.Error("should return nil when no pending rebase")
	}
}

func TestHasPendingRebase(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)

	if HasPendingRebase(dir) {
		t.Error("should return false when no pending rebase")
	}

	_ = SavePendingRebase(PendingRebase{EditingDiff: "D1"}, dir)
	if !HasPendingRebase(dir) {
		t.Error("should return true after saving pending rebase")
	}
}

func TestClearPendingRebase(t *testing.T) {
	dir := initTestRepo(t)
	_ = SavePendingRebase(PendingRebase{EditingDiff: "D1"}, dir)

	err := ClearPendingRebase(dir)
	if err != nil {
		t.Fatalf("clear error: %v", err)
	}

	if HasPendingRebase(dir) {
		t.Error("should return false after clearing")
	}
}

func TestCheckPendingRebase_None(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)
	err := CheckPendingRebase(dir)
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}

func TestCheckPendingRebase_Exists(t *testing.T) {
	dir := initTestRepo(t)
	_ = SavePendingRebase(PendingRebase{EditingDiff: "D1"}, dir)

	err := CheckPendingRebase(dir)
	if err == nil {
		t.Error("expected error when pending rebase exists")
	}
	if !strings.Contains(err.Error(), "previous operation was interrupted") {
		t.Errorf("error should mention interrupted operation, got: %v", err)
	}
	if !strings.Contains(err.Error(), "--continue") {
		t.Error("error should suggest --continue")
	}
	if !strings.Contains(err.Error(), "--abort") {
		t.Error("error should suggest --abort")
	}
}

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------

func TestHasUncommittedChanges(t *testing.T) {
	dir := initTestRepo(t)
	if HasUncommittedChanges(dir) {
		t.Error("should not have uncommitted changes")
	}

	writeFile(t, dir, "dirty.txt", "changes")
	if !HasUncommittedChanges(dir) {
		t.Error("should have uncommitted changes")
	}
}

func TestValidateCleanBranchState(t *testing.T) {
	dir := initTestRepo(t)
	feature := FeatureData{Branch: "main"}

	err := ValidateCleanBranchState(feature, dir)
	if err != nil {
		t.Errorf("clean repo should pass: %v", err)
	}

	writeFile(t, dir, "dirty.txt", "changes")
	err = ValidateCleanBranchState(feature, dir)
	if err == nil {
		t.Error("dirty repo should fail")
	}
	if !strings.Contains(err.Error(), "unsaved changes") {
		t.Errorf("error message should mention unsaved changes: %v", err)
	}
}

func TestEnsureCleanOrAutoSave(t *testing.T) {
	dir := initTestRepo(t)

	err := EnsureCleanOrAutoSave(dir)
	if err != nil {
		t.Errorf("clean repo should pass: %v", err)
	}

	writeFile(t, dir, "dirty.txt", "changes")
	err = EnsureCleanOrAutoSave(dir)
	if err == nil {
		t.Error("dirty repo should fail")
	}
	if !strings.Contains(err.Error(), "devpod diff") {
		t.Error("error should suggest running devpod diff")
	}
}

func TestDetectBranchMismatch(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch := mustRun(t, dir, "git", "rev-parse", "--abbrev-ref", "HEAD")

	feature := FeatureData{Branch: defaultBranch}
	mismatch, currentBranch := DetectBranchMismatch(feature, dir)
	if mismatch {
		t.Error("should not detect mismatch when on correct branch")
	}
	if currentBranch != defaultBranch {
		t.Errorf("currentBranch: %s", currentBranch)
	}

	feature.Branch = "feature/other"
	mismatch, _ = DetectBranchMismatch(feature, dir)
	if !mismatch {
		t.Error("should detect mismatch when on wrong branch")
	}
}

func TestValidateOnFeatureBranch_NoFeature(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)

	_, err := ValidateOnFeatureBranch(dir)
	if err == nil {
		t.Error("expected error when not on feature branch")
	}
	if !strings.Contains(err.Error(), "Not on a feature branch") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestValidateOnFeatureBranch_OnFeature(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch := mustRun(t, dir, "git", "rev-parse", "--abbrev-ref", "HEAD")

	_ = SaveFeature(FeatureData{
		Name:   "Test",
		Slug:   "test",
		Branch: defaultBranch,
		Status: Active,
	}, dir)

	feature, err := ValidateOnFeatureBranch(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if feature.Name != "Test" {
		t.Errorf("Name: %s", feature.Name)
	}
}

// ---------------------------------------------------------------------------
// Editing state
// ---------------------------------------------------------------------------

func TestSetEditingDiff_GetEditingDiff(t *testing.T) {
	dir := initTestRepo(t)

	if GetEditingDiff(dir) != "" {
		t.Error("should be empty initially")
	}

	_ = SetEditingDiff("uuid-123", dir)
	if GetEditingDiff(dir) != "uuid-123" {
		t.Errorf("got: %s", GetEditingDiff(dir))
	}

	_ = SetEditingDiff("", dir)
	if GetEditingDiff(dir) != "" {
		t.Error("should be empty after clearing")
	}
}

// ---------------------------------------------------------------------------
// Undo entries
// ---------------------------------------------------------------------------

func TestSaveUndoEntry_ListUndoEntries(t *testing.T) {
	dir := initTestRepo(t)

	entry1 := UndoEntry{
		Action:      "diff-create",
		Timestamp:   "2024-01-01T00:00:00Z",
		RefBefore:   "abc",
		Description: "Create D1",
	}
	entry2 := UndoEntry{
		Action:      "sync",
		Timestamp:   "2024-01-01T01:00:00Z",
		RefBefore:   "def",
		Description: "Sync",
	}

	_ = SaveUndoEntry(entry1, dir)
	_ = SaveUndoEntry(entry2, dir)

	entries := ListUndoEntries(dir)
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
}

func TestGetLastUndoEntry(t *testing.T) {
	dir := initTestRepo(t)

	_ = SaveUndoEntry(UndoEntry{
		Action:    "first",
		Timestamp: "2024-01-01T00:00:00Z",
	}, dir)
	_ = SaveUndoEntry(UndoEntry{
		Action:    "second",
		Timestamp: "2024-01-01T01:00:00Z",
	}, dir)

	entry := GetLastUndoEntry(dir)
	if entry == nil {
		t.Fatal("expected non-nil entry")
	}
	if entry.Action != "second" {
		t.Errorf("Action: %s", entry.Action)
	}
}

func TestGetLastUndoEntry_Empty(t *testing.T) {
	dir := initTestRepo(t)
	_ = EnsureDevpodDir(dir)

	entry := GetLastUndoEntry(dir)
	if entry != nil {
		t.Error("should return nil for empty undo history")
	}
}

func TestRemoveLastUndoEntry(t *testing.T) {
	dir := initTestRepo(t)

	_ = SaveUndoEntry(UndoEntry{
		Action:    "first",
		Timestamp: "2024-01-01T00:00:00Z",
	}, dir)
	_ = SaveUndoEntry(UndoEntry{
		Action:    "second",
		Timestamp: "2024-01-01T01:00:00Z",
	}, dir)

	_ = RemoveLastUndoEntry(dir)
	entries := ListUndoEntries(dir)
	if len(entries) != 1 {
		t.Errorf("expected 1 entry after removal, got %d", len(entries))
	}
	if entries[0].Action != "first" {
		t.Errorf("remaining entry should be 'first', got %s", entries[0].Action)
	}
}

// ---------------------------------------------------------------------------
// parseVersion
// ---------------------------------------------------------------------------

func TestParseVersion(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"", 1},
		{"1", 1},
		{"2", 2},
		{"10", 10},
		{"abc", 1},
		{"v3", 3},
	}
	for _, tt := range tests {
		result := parseVersion(tt.input)
		if result != tt.expected {
			t.Errorf("parseVersion(%q) = %d, want %d", tt.input, result, tt.expected)
		}
	}
}

// ---------------------------------------------------------------------------
// PendingRebase JSON
// ---------------------------------------------------------------------------

func TestPendingRebase_JSON(t *testing.T) {
	pr := PendingRebase{
		EditingDiff:     "D2",
		PreEditSHA:      "abc123",
		RemainingPicks:  []string{"sha1", "sha2"},
		CompletedPicks:  []string{"sha0"},
		PreEditSnapshot: "def456",
	}
	data, err := json.Marshal(pr)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var loaded PendingRebase
	err = json.Unmarshal(data, &loaded)
	if err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if loaded.EditingDiff != "D2" {
		t.Errorf("EditingDiff: %s", loaded.EditingDiff)
	}
	if loaded.PreEditSnapshot != "def456" {
		t.Errorf("PreEditSnapshot: %s", loaded.PreEditSnapshot)
	}
}

// ---------------------------------------------------------------------------
// Multiple features in same repo
// ---------------------------------------------------------------------------

func TestMultipleFeaturesInSameRepo(t *testing.T) {
	dir := initTestRepo(t)

	features := []FeatureData{
		{Name: "Auth", Slug: "auth", Branch: "feature/auth", Status: Active},
		{Name: "API", Slug: "api", Branch: "feature/api", Status: Active},
		{Name: "UI", Slug: "ui", Branch: "feature/ui", Status: Active},
	}

	for _, f := range features {
		err := SaveFeature(f, dir)
		if err != nil {
			t.Fatalf("save %s: %v", f.Name, err)
		}
	}

	loaded := ListFeatures(dir)
	if len(loaded) != 3 {
		t.Errorf("expected 3 features, got %d", len(loaded))
	}

	// Load each individually
	for _, f := range features {
		l, err := LoadFeature(f.Slug, dir)
		if err != nil {
			t.Errorf("load %s: %v", f.Slug, err)
		}
		if l.Name != f.Name {
			t.Errorf("Name mismatch: %s vs %s", l.Name, f.Name)
		}
	}
}

// ---------------------------------------------------------------------------
// EnsureVersionsBranch
// ---------------------------------------------------------------------------

func TestEnsureVersionsBranch_Creates(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch := mustRun(t, dir, "git", "rev-parse", "--abbrev-ref", "HEAD")

	mustRun(t, dir, "git", "checkout", "-b", "feature/vtest")

	feature := FeatureData{Branch: "feature/vtest"}
	err := EnsureVersionsBranch(feature, dir)
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	_ = defaultBranch
	// Check that the versions branch exists
	output := mustRun(t, dir, "git", "branch", "--list", "feature/vtest--versions")
	if !strings.Contains(output, "feature/vtest--versions") {
		t.Error("versions branch should exist")
	}
}

func TestEnsureVersionsBranch_AlreadyExists(t *testing.T) {
	dir := initTestRepo(t)
	mustRun(t, dir, "git", "checkout", "-b", "feature/vtest2")

	feature := FeatureData{Branch: "feature/vtest2"}

	// Create it
	err := EnsureVersionsBranch(feature, dir)
	if err != nil {
		t.Fatalf("first call error: %v", err)
	}

	// Call again (should be no-op)
	err = EnsureVersionsBranch(feature, dir)
	if err != nil {
		t.Fatalf("second call error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// BuildSnapshotMessage
// ---------------------------------------------------------------------------

func TestBuildSnapshotMessage(t *testing.T) {
	trailers := git.Trailers{
		Snapshot: "S1",
		Diff:     "D1",
		Action:   "create",
	}
	msg := BuildSnapshotMessage("test snapshot", trailers)
	if !strings.Contains(msg, "test snapshot") {
		t.Error("should contain title")
	}
	if !strings.Contains(msg, "Snapshot: S1") {
		t.Error("should contain Snapshot trailer")
	}
}
