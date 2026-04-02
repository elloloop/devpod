package commands

import (
	"fmt"
	"os"
	"testing"

	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// parseDiffPosition tests
// ---------------------------------------------------------------------------

func TestParseDiffPosition_Valid(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"D1", 1},
		{"D2", 2},
		{"D10", 10},
		{"d1", 1},
		{"d99", 99},
	}

	for _, tt := range tests {
		pos, ok := parseDiffPosition(tt.input)
		if !ok {
			t.Errorf("parseDiffPosition(%q) returned false", tt.input)
		}
		if pos != tt.expected {
			t.Errorf("parseDiffPosition(%q) = %d, want %d", tt.input, pos, tt.expected)
		}
	}
}

func TestParseDiffPosition_Invalid(t *testing.T) {
	tests := []string{
		"",
		"D",
		"D0",
		"X1",
		"DD1",
		"1D",
		"hello",
		"D-1",
	}

	for _, input := range tests {
		pos, ok := parseDiffPosition(input)
		// D0 is technically parseable but position 0 is invalid
		if input == "D0" {
			if ok && pos == 0 {
				continue // expected: parsed but position 0
			}
		}
		if ok && pos != 0 {
			t.Errorf("parseDiffPosition(%q) should return false or 0, got %d", input, pos)
		}
	}
}

// ---------------------------------------------------------------------------
// Diff creation tests
// ---------------------------------------------------------------------------

func TestDiffCreate_FirstDiff(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "diff test", "feature")

	diff := addDiff(t, dir, feature, 1, "app.go", "package main", "feat(diff-test): add main package")

	if diff.Position != 1 {
		t.Errorf("expected position 1, got %d", diff.Position)
	}
	if diff.ID != "D1" {
		t.Errorf("expected ID D1, got %s", diff.ID)
	}
	if diff.Version != 1 {
		t.Errorf("expected version 1, got %d", diff.Version)
	}
	if diff.Status != "draft" {
		t.Errorf("expected status draft, got %s", diff.Status)
	}
}

func TestDiffCreate_SecondDiff(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "stack test", "feature")

	addDiff(t, dir, feature, 1, "app.go", "package main", "D1: first")
	diff2 := addDiff(t, dir, feature, 2, "handler.go", "package handler", "D2: second")

	if diff2.Position != 2 {
		t.Errorf("expected position 2, got %d", diff2.Position)
	}
	if diff2.ID != "D2" {
		t.Errorf("expected ID D2, got %s", diff2.ID)
	}
}

func TestDiffCreate_ThirdDiff(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "triple stack", "feature")

	addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")
	diff3 := addDiff(t, dir, feature, 3, "c.go", "c", "D3")

	if diff3.Position != 3 {
		t.Errorf("expected position 3, got %d", diff3.Position)
	}
	if len(feature.Diffs) != 3 {
		t.Errorf("expected 3 diffs, got %d", len(feature.Diffs))
	}
}

func TestDiffCreate_TrailersInCommit(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "trailer test", "feature")

	addDiff(t, dir, feature, 1, "file.go", "content", "test commit")

	// Read the commit message
	sha := headSHA(t, dir)
	msg, err := git.GetCommitMessage(sha, dir)
	if err != nil {
		t.Fatalf("get message: %v", err)
	}

	trailers := git.ParseTrailers(msg)
	if trailers.Diff != "D1" {
		t.Errorf("expected Diff: D1, got %s", trailers.Diff)
	}
	if trailers.Version != "1" {
		t.Errorf("expected Version: 1, got %s", trailers.Version)
	}
	if trailers.Feature != feature.Slug {
		t.Errorf("expected Feature: %s, got %s", feature.Slug, trailers.Feature)
	}
}

func TestDiffCreate_HasCorrectFiles(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "files test", "feature")

	diff := addDiff(t, dir, feature, 1, "src/main.go", "package main", "add main")

	if len(diff.Files) != 1 {
		t.Errorf("expected 1 file, got %d", len(diff.Files))
	}
	if diff.Files[0] != "src/main.go" {
		t.Errorf("expected src/main.go, got %s", diff.Files[0])
	}
}

func TestDiffCreate_MetadataPersisted(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "persist test", "feature")

	diff := addDiff(t, dir, feature, 1, "x.go", "x", "test diff")

	loaded, err := workspace.LoadDiff(diff.UUID, dir)
	if err != nil {
		t.Fatalf("load diff: %v", err)
	}
	if loaded.Title != "test diff" {
		t.Errorf("expected title 'test diff', got %s", loaded.Title)
	}
	if loaded.Feature != feature.Slug {
		t.Errorf("expected feature %s, got %s", feature.Slug, loaded.Feature)
	}
}

// ---------------------------------------------------------------------------
// Diff edit tests
// ---------------------------------------------------------------------------

func TestDiffEdit_SetsEditingState(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "edit test", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "v1", "D1: first")

	_ = workspace.SetEditingDiff(diff.UUID, dir)

	editing := workspace.GetEditingDiff(dir)
	if editing != diff.UUID {
		t.Errorf("expected editing %s, got %s", diff.UUID, editing)
	}
}

func TestDiffEdit_ClearEditingState(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "clear edit", "feature")

	_ = workspace.SetEditingDiff("some-uuid", dir)
	_ = workspace.SetEditingDiff("", dir)

	editing := workspace.GetEditingDiff(dir)
	if editing != "" {
		t.Errorf("expected empty editing, got %s", editing)
	}
}

func TestDiffEdit_TopDiff_NoReplayNeeded(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "top edit", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "v1", "D1: first")

	// Editing the top (only) diff: no stack above, no replay needed
	_ = workspace.SetEditingDiff(diff.UUID, dir)

	// Make changes and "amend"
	writeTestFile(t, dir, "a.go", "v2")
	mustExec(t, dir, "git", "add", "-A")
	mustExec(t, dir, "git", "commit", "--amend", "--no-edit")

	_ = workspace.SetEditingDiff("", dir)

	editing := workspace.GetEditingDiff(dir)
	if editing != "" {
		t.Error("editing should be cleared")
	}
}

func TestDiffEdit_OnlyDiff_NoReplayNeeded(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "only diff", "feature")
	addDiff(t, dir, feature, 1, "a.go", "v1", "D1: only")

	// Only one diff in the stack - editing should not require replay
	diffs := workspace.LoadDiffsForFeature(*feature, dir)
	var commitsAbove []string
	for _, d := range diffs {
		if d.Position > 1 {
			commitsAbove = append(commitsAbove, d.Commit)
		}
	}
	if len(commitsAbove) != 0 {
		t.Errorf("expected no commits above, got %d", len(commitsAbove))
	}
}

// ---------------------------------------------------------------------------
// Edit non-existent diff
// ---------------------------------------------------------------------------

func TestDiffEdit_NonExistentDiff(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "no diff", "feature")

	diff := workspace.GetDiffByPosition(*feature, 99, dir)
	if diff != nil {
		t.Error("expected nil for non-existent diff position")
	}
}

func TestDiffEdit_WrongDiffID(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "wrong id", "feature")
	addDiff(t, dir, feature, 1, "a.go", "v1", "D1")

	diff := workspace.GetDiffByPosition(*feature, 5, dir)
	if diff != nil {
		t.Error("expected nil for wrong diff position")
	}
}

// ---------------------------------------------------------------------------
// Diff version tracking
// ---------------------------------------------------------------------------

func TestDiffVersion_InitialVersion(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "version test", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "v1", "D1")

	if diff.Version != 1 {
		t.Errorf("expected version 1, got %d", diff.Version)
	}
}

func TestDiffVersion_TrackingMultiple(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "multi version", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "v1", "D1")

	// Add version records manually
	v1 := workspace.DiffVersion{Number: 1, SnapshotID: "S1", Action: "create"}
	_ = workspace.AddDiffVersion(feature, diff.UUID, v1, dir)

	v2 := workspace.DiffVersion{Number: 2, SnapshotID: "S2", Action: "update"}
	_ = workspace.AddDiffVersion(feature, diff.UUID, v2, dir)

	versions := workspace.GetDiffVersions(*feature, diff.UUID, dir)
	if len(versions) != 2 {
		t.Errorf("expected 2 versions, got %d", len(versions))
	}
}

func TestDiffVersion_Latest(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "latest version", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "v1", "D1")

	_ = workspace.AddDiffVersion(feature, diff.UUID, workspace.DiffVersion{Number: 1, SnapshotID: "S1", Action: "create"}, dir)
	_ = workspace.AddDiffVersion(feature, diff.UUID, workspace.DiffVersion{Number: 2, SnapshotID: "S4", Action: "update"}, dir)
	_ = workspace.AddDiffVersion(feature, diff.UUID, workspace.DiffVersion{Number: 3, SnapshotID: "S7", Action: "update"}, dir)

	latest := workspace.GetLatestDiffVersion(*feature, diff.UUID, dir)
	if latest == nil {
		t.Fatal("expected non-nil latest version")
	}
	if latest.Number != 3 {
		t.Errorf("expected version 3, got %d", latest.Number)
	}
	if latest.SnapshotID != "S7" {
		t.Errorf("expected S7, got %s", latest.SnapshotID)
	}
}

// ---------------------------------------------------------------------------
// Diff status transitions
// ---------------------------------------------------------------------------

func TestDiffStatus_DraftToSubmitted(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "status test", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "v1", "D1")

	diff.Status = "submitted"
	_ = workspace.SaveDiff(*diff, dir)

	loaded, _ := workspace.LoadDiff(diff.UUID, dir)
	if loaded.Status != "submitted" {
		t.Errorf("expected submitted, got %s", loaded.Status)
	}
}

func TestDiffStatus_SubmittedToApproved(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "approve test", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "v1", "D1")

	diff.Status = "approved"
	_ = workspace.SaveDiff(*diff, dir)

	loaded, _ := workspace.LoadDiff(diff.UUID, dir)
	if loaded.Status != "approved" {
		t.Errorf("expected approved, got %s", loaded.Status)
	}
}

// ---------------------------------------------------------------------------
// GetNextDiffPosition
// ---------------------------------------------------------------------------

func TestGetNextDiffPosition_EmptyFeature(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "empty pos", "feature")

	pos := workspace.GetNextDiffPosition(*feature, dir)
	if pos != 1 {
		t.Errorf("expected position 1, got %d", pos)
	}
}

func TestGetNextDiffPosition_AfterOneDiff(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "one pos", "feature")
	addDiff(t, dir, feature, 1, "a.go", "v1", "D1")

	pos := workspace.GetNextDiffPosition(*feature, dir)
	if pos != 2 {
		t.Errorf("expected position 2, got %d", pos)
	}
}

func TestGetNextDiffPosition_AfterThreeDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "three pos", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")
	addDiff(t, dir, feature, 3, "c.go", "c", "D3")

	pos := workspace.GetNextDiffPosition(*feature, dir)
	if pos != 4 {
		t.Errorf("expected position 4, got %d", pos)
	}
}

// ---------------------------------------------------------------------------
// sortDiffsByPosition tests
// ---------------------------------------------------------------------------

func TestSortDiffsByPosition(t *testing.T) {
	diffs := []workspace.DiffData{
		{Position: 3, Title: "third"},
		{Position: 1, Title: "first"},
		{Position: 2, Title: "second"},
	}

	sorted := sortDiffsByPosition(diffs)
	if sorted[0].Position != 1 {
		t.Errorf("expected first position 1, got %d", sorted[0].Position)
	}
	if sorted[1].Position != 2 {
		t.Errorf("expected second position 2, got %d", sorted[1].Position)
	}
	if sorted[2].Position != 3 {
		t.Errorf("expected third position 3, got %d", sorted[2].Position)
	}

	// Original should not be modified
	if diffs[0].Position != 3 {
		t.Error("original slice was modified")
	}
}

func TestSortDiffsByPosition_Empty(t *testing.T) {
	sorted := sortDiffsByPosition(nil)
	if len(sorted) != 0 {
		t.Errorf("expected empty, got %d", len(sorted))
	}
}

func TestSortDiffsByPosition_Single(t *testing.T) {
	diffs := []workspace.DiffData{{Position: 1, Title: "only"}}
	sorted := sortDiffsByPosition(diffs)
	if len(sorted) != 1 || sorted[0].Position != 1 {
		t.Error("single diff sort failed")
	}
}

// ---------------------------------------------------------------------------
// Diff preview (no state change)
// ---------------------------------------------------------------------------

func TestDiffPreview_NoChanges(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "preview test", "feature")

	// No uncommitted changes
	changes, _ := git.GetChangedFiles(dir)
	if len(changes) != 0 {
		t.Error("expected no changes")
	}
}

func TestDiffPreview_WithChanges(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "preview changes", "feature")

	writeTestFile(t, dir, "new.go", "package new")
	changes, _ := git.GetChangedFiles(dir)
	if len(changes) == 0 {
		t.Error("expected changes")
	}
}

// ---------------------------------------------------------------------------
// Title generation
// ---------------------------------------------------------------------------

func TestGenerateTitle_ExplicitMessage(t *testing.T) {
	result, err := generateTitle("", nil, "feature", "auth", "add login")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Title != "feat(auth): add login" {
		t.Errorf("expected 'feat(auth): add login', got %s", result.Title)
	}
}

func TestGenerateTitle_FallbackFromFiles(t *testing.T) {
	result, err := generateTitle("", []string{"src/auth/login.go", "src/auth/session.go"}, "feature", "auth", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Title == "" {
		t.Error("expected non-empty fallback title")
	}
}

// ---------------------------------------------------------------------------
// Stack string
// ---------------------------------------------------------------------------

func TestGetStackString_EmptyFeature(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "stack str empty", "feature")

	stack := workspace.GetStackString(*feature, dir)
	if stack != "" {
		t.Errorf("expected empty stack string, got %s", stack)
	}
}

func TestGetStackString_WithDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "stack str", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")

	stack := workspace.GetStackString(*feature, dir)
	if stack == "" {
		t.Error("expected non-empty stack string")
	}
}

// ---------------------------------------------------------------------------
// Snapshot ID generation
// ---------------------------------------------------------------------------

func TestGetNextSnapshotID_Initial(t *testing.T) {
	feature := workspace.FeatureData{SnapshotCount: 0}
	id := workspace.GetNextSnapshotID(feature)
	if id != "S1" {
		t.Errorf("expected S1, got %s", id)
	}
}

func TestGetNextSnapshotID_AfterSome(t *testing.T) {
	feature := workspace.FeatureData{SnapshotCount: 5}
	id := workspace.GetNextSnapshotID(feature)
	if id != "S6" {
		t.Errorf("expected S6, got %s", id)
	}
}

// ---------------------------------------------------------------------------
// resolveSnapshotSpec
// ---------------------------------------------------------------------------

func TestResolveSnapshotSpec_DiffOnly(t *testing.T) {
	dir := setupTestRepo(t)
	oldDir, _ := os.Getwd()
	_ = os.Chdir(dir)
	defer func() { _ = os.Chdir(oldDir) }()

	feature := createFeature(t, dir, "resolve test", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	// Without versions branch, should fall back to commit SHA
	sha, err := resolveSnapshotSpec(feature, feature.VersionsBranch, "D1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if sha != diff.Commit {
		t.Errorf("expected commit SHA %s, got %s", diff.Commit, sha)
	}
}

func TestResolveSnapshotSpec_InvalidFormat(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "bad spec", "feature")

	_, err := resolveSnapshotSpec(feature, feature.VersionsBranch, "D1:vXYZ")
	if err == nil {
		t.Error("expected error for invalid version")
	}
}

func TestResolveSnapshotSpec_RawSHA(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "raw sha", "feature")

	sha, err := resolveSnapshotSpec(feature, feature.VersionsBranch, "abc123")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if sha != "abc123" {
		t.Errorf("expected abc123, got %s", sha)
	}
}

// ---------------------------------------------------------------------------
// Undo entry management
// ---------------------------------------------------------------------------

func TestUndoEntry_SaveAndLoad(t *testing.T) {
	dir := setupTestRepo(t)

	entry := workspace.UndoEntry{
		Action:      "diff-create",
		Timestamp:   "2024-01-01T00:00:00Z",
		RefBefore:   "abc123",
		Description: "Create D1",
		Data:        map[string]interface{}{"uuid": "test-uuid"},
	}
	_ = workspace.SaveUndoEntry(entry, dir)

	last := workspace.GetLastUndoEntry(dir)
	if last == nil {
		t.Fatal("expected undo entry")
	}
	if last.Action != "diff-create" {
		t.Errorf("expected diff-create, got %s", last.Action)
	}
	if last.Description != "Create D1" {
		t.Errorf("expected 'Create D1', got %s", last.Description)
	}
}

func TestUndoEntry_RemoveLast(t *testing.T) {
	dir := setupTestRepo(t)

	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:    "first",
		Timestamp: "2024-01-01T00:00:00Z",
	}, dir)
	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:    "second",
		Timestamp: "2024-01-01T00:00:01Z",
	}, dir)

	_ = workspace.RemoveLastUndoEntry(dir)

	last := workspace.GetLastUndoEntry(dir)
	if last == nil {
		t.Fatal("expected remaining undo entry")
	}
	if last.Action != "first" {
		t.Errorf("expected 'first', got %s", last.Action)
	}
}

func TestUndoEntry_ListOrder(t *testing.T) {
	dir := setupTestRepo(t)

	for i := 0; i < 5; i++ {
		_ = workspace.SaveUndoEntry(workspace.UndoEntry{
			Action:    fmt.Sprintf("action-%d", i),
			Timestamp: fmt.Sprintf("2024-01-01T00:00:%02dZ", i),
		}, dir)
	}

	entries := workspace.ListUndoEntries(dir)
	if len(entries) != 5 {
		t.Errorf("expected 5 entries, got %d", len(entries))
	}

	// Should be in chronological order
	for i := 0; i < len(entries)-1; i++ {
		if entries[i].Timestamp >= entries[i+1].Timestamp {
			t.Error("entries should be in chronological order")
		}
	}
}

// ---------------------------------------------------------------------------
// Diff not on feature branch
// ---------------------------------------------------------------------------

func TestDiffNotOnFeatureBranch(t *testing.T) {
	dir := setupTestRepo(t)
	// On main branch, no feature
	feature := workspace.GetCurrentFeature(dir)
	if feature != nil {
		t.Error("expected nil feature on main")
	}
}

// ---------------------------------------------------------------------------
// Feature with no diffs
// ---------------------------------------------------------------------------

func TestFeatureWithNoDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "empty feature", "feature")

	diffs := workspace.LoadDiffsForFeature(*feature, dir)
	if len(diffs) != 0 {
		t.Errorf("expected 0 diffs, got %d", len(diffs))
	}
}

// ---------------------------------------------------------------------------
// Multiple features
// ---------------------------------------------------------------------------

func TestMultipleFeatures(t *testing.T) {
	dir := setupTestRepo(t)

	createFeature(t, dir, "feature one", "feature")
	mustExec(t, dir, "git", "checkout", "main")
	createFeature(t, dir, "feature two", "fix")
	mustExec(t, dir, "git", "checkout", "main")
	createFeature(t, dir, "feature three", "docs")

	features := workspace.ListFeatures(dir)
	if len(features) != 3 {
		t.Errorf("expected 3 features, got %d", len(features))
	}
}

// ---------------------------------------------------------------------------
// Edge case: empty diff (no changes)
// ---------------------------------------------------------------------------

func TestEmptyDiff_NoChanges(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "no changes", "feature")

	// No changes made since creating the branch
	clean := git.IsClean(dir)
	if !clean {
		t.Error("expected clean working tree")
	}
}

// Suppress unused import warnings for test helpers
func init() {
	_ = os.Chdir
	_ = fmt.Sprintf
}
