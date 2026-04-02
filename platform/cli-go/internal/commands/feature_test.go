package commands

import (
	"os"
	"strings"
	"testing"

	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// Feature creation tests
// ---------------------------------------------------------------------------

func TestStartWork_CreatesFeatureBranch(t *testing.T) {
	dir := setupTestRepo(t)
	_ = os.Chdir(dir)

	feature := createFeature(t, dir, "login page", "feature")

	if currentBranch(t, dir) != feature.Branch {
		t.Errorf("expected branch %s, got %s", feature.Branch, currentBranch(t, dir))
	}
}

func TestStartWork_CreatesMetadata(t *testing.T) {
	dir := setupTestRepo(t)
	_ = os.Chdir(dir)

	feature := createFeature(t, dir, "auth flow", "feature")

	loaded := loadFeatureFromDisk(t, dir, feature.Slug)
	if loaded.Name != "auth flow" {
		t.Errorf("expected name 'auth flow', got %s", loaded.Name)
	}
	if loaded.Type != "feature" {
		t.Errorf("expected type 'feature', got %s", loaded.Type)
	}
	if loaded.Status != "active" {
		t.Errorf("expected status 'active', got %s", loaded.Status)
	}
	if loaded.Branch != "feature/auth-flow" {
		t.Errorf("expected branch 'feature/auth-flow', got %s", loaded.Branch)
	}
}

func TestStartWork_FixPrefix(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "null pointer", "fix")
	if feature.Branch != "fix/null-pointer" {
		t.Errorf("expected branch fix/null-pointer, got %s", feature.Branch)
	}
}

func TestStartWork_DocsPrefix(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "api reference", "docs")
	if feature.Branch != "docs/api-reference" {
		t.Errorf("expected branch docs/api-reference, got %s", feature.Branch)
	}
}

func TestStartWork_ChorePrefix(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "update deps", "chore")
	if feature.Branch != "chore/update-deps" {
		t.Errorf("expected branch chore/update-deps, got %s", feature.Branch)
	}
}

func TestStartWork_UnknownPrefix(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "something", "unknown")
	if feature.Branch != "feature/something" {
		t.Errorf("expected branch feature/something, got %s", feature.Branch)
	}
}

func TestStartWork_EmptyDiffsList(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "test", "feature")
	if len(feature.Diffs) != 0 {
		t.Errorf("expected empty diffs, got %d", len(feature.Diffs))
	}
}

func TestStartWork_VersionsBranchName(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "vb test", "feature")
	expected := "feature/vb-test--versions"
	if feature.VersionsBranch != expected {
		t.Errorf("expected versions branch %s, got %s", expected, feature.VersionsBranch)
	}
}

func TestStartWork_SnapshotCountZero(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "snap test", "feature")
	if feature.SnapshotCount != 0 {
		t.Errorf("expected snapshot count 0, got %d", feature.SnapshotCount)
	}
}

func TestStartWork_SlugFromName(t *testing.T) {
	tests := []struct {
		name string
		slug string
	}{
		{"Hello World", "hello-world"},
		{"UPPER CASE", "upper-case"},
		{"special!@#$%chars", "specialchars"},
		{"  extra   spaces  ", "extra-spaces"},
		{"already-slugified", "already-slugified"},
		{"numbers 123 test", "numbers-123-test"},
	}

	for _, tt := range tests {
		slug := workspace.Slugify(tt.name)
		if slug != tt.slug {
			t.Errorf("Slugify(%q) = %q, want %q", tt.name, slug, tt.slug)
		}
	}
}

func TestStartWork_SlugTruncation(t *testing.T) {
	longName := "this is a very long feature name that exceeds normal length expectations for a branch name and should be handled gracefully"
	slug := workspace.Slugify(longName)
	if slug == "" {
		t.Error("expected non-empty slug")
	}
}

func TestStartWork_UnicodeInName(t *testing.T) {
	slug := workspace.Slugify("cafe latte")
	if slug == "" {
		t.Error("expected non-empty slug for unicode name")
	}
	// Should not contain non-alphanumeric chars
	for _, c := range slug {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-') {
			t.Errorf("unexpected character %c in slug %s", c, slug)
		}
	}
}

func TestStartWork_DuplicateFeature(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "unique name", "feature")

	// Switch back to main and try to create another feature with same slug
	mustExec(t, dir, "git", "checkout", "main")

	// Creating a feature with the same slug should detect the existing one
	slug := workspace.Slugify("unique name")
	existing, _ := workspace.LoadFeature(slug, dir)
	if existing == nil {
		t.Error("expected to find existing feature")
	}
}

func TestPendingRebase_SaveAndLoad(t *testing.T) {
	dir := setupTestRepo(t)

	pr := workspace.PendingRebase{
		EditingDiff:    "uuid-123",
		PreEditSHA:     "abc123",
		RemainingPicks: []string{"sha1", "sha2"},
		CompletedPicks: []string{},
	}

	if err := workspace.SavePendingRebase(pr, dir); err != nil {
		t.Fatalf("save: %v", err)
	}

	if !workspace.HasPendingRebase(dir) {
		t.Error("expected pending rebase")
	}

	loaded := workspace.LoadPendingRebase(dir)
	if loaded == nil {
		t.Fatal("expected loaded pending rebase")
	}
	if loaded.EditingDiff != "uuid-123" {
		t.Errorf("expected uuid-123, got %s", loaded.EditingDiff)
	}
	if len(loaded.RemainingPicks) != 2 {
		t.Errorf("expected 2 remaining picks, got %d", len(loaded.RemainingPicks))
	}

	_ = workspace.ClearPendingRebase(dir)
	if workspace.HasPendingRebase(dir) {
		t.Error("expected no pending rebase after clear")
	}
}

func TestCheckPendingRebase_NoPending(t *testing.T) {
	dir := setupTestRepo(t)
	err := workspace.CheckPendingRebase(dir)
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}

func TestCheckPendingRebase_HasPending(t *testing.T) {
	dir := setupTestRepo(t)
	_ = workspace.SavePendingRebase(workspace.PendingRebase{
		EditingDiff: "test",
		PreEditSHA:  "abc",
	}, dir)

	err := workspace.CheckPendingRebase(dir)
	if err == nil {
		t.Error("expected error for pending rebase")
	}
}

func TestHasUncommittedChanges_CleanRepo(t *testing.T) {
	dir := setupTestRepo(t)
	if workspace.HasUncommittedChanges(dir) {
		t.Error("expected no uncommitted changes in clean repo")
	}
}

func TestHasUncommittedChanges_DirtyRepo(t *testing.T) {
	dir := setupTestRepo(t)
	writeTestFile(t, dir, "new_file.txt", "content")
	if !workspace.HasUncommittedChanges(dir) {
		t.Error("expected uncommitted changes")
	}
}

func TestValidateOnFeatureBranch_OnMain(t *testing.T) {
	dir := setupTestRepo(t)
	_ = os.Chdir(dir)
	_, err := workspace.ValidateOnFeatureBranch(dir)
	if err == nil {
		t.Error("expected error when on main branch")
	}
}

func TestValidateOnFeatureBranch_OnFeature(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "validate test", "feature")
	_ = os.Chdir(dir)

	f, err := workspace.ValidateOnFeatureBranch(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.Name != "validate test" {
		t.Errorf("expected 'validate test', got %s", f.Name)
	}
}

func TestTildeInBranchName_Rejected(t *testing.T) {
	// The ~ character should not appear in branch names
	name := "test~feature"
	slug := workspace.Slugify(name)
	// Slugify should strip the ~ character
	if strings.Contains(slug, "~") {
		t.Errorf("slug should not contain ~, got %s", slug)
	}
}

func TestVersionsBranchName(t *testing.T) {
	tests := []struct {
		branch   string
		expected string
	}{
		{"feature/foo", "feature/foo--versions"},
		{"fix/bar", "fix/bar--versions"},
		{"main", "main--versions"},
	}

	for _, tt := range tests {
		got := workspace.VersionsBranchName(tt.branch)
		if got != tt.expected {
			t.Errorf("VersionsBranchName(%q) = %q, want %q", tt.branch, got, tt.expected)
		}
	}
}
