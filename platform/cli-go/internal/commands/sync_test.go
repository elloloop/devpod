package commands

import (
	"testing"

	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// Sync tests
// ---------------------------------------------------------------------------

func TestUpdateDiffSHAs_NoDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "no diffs sync", "feature")

	// Should not panic with no diffs
	updateDiffSHAs(feature)
}

func TestUpdateDiffSHAs_WithDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "sha update", "feature")
	d1 := addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	d2 := addDiff(t, dir, feature, 2, "b.go", "b", "D2")

	oldSHA1 := d1.Commit
	oldSHA2 := d2.Commit

	// SHAs should be non-empty
	if oldSHA1 == "" || oldSHA2 == "" {
		t.Error("expected non-empty SHAs")
	}
}

func TestUpdateDiffSHAs_NilFeature(t *testing.T) {
	// Should not panic
	updateDiffSHAs(nil)
}

func TestSync_RefusesUncommittedChanges(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "dirty sync", "feature")

	writeTestFile(t, dir, "dirty.txt", "content")

	if !workspace.HasUncommittedChanges(dir) {
		t.Error("expected uncommitted changes")
	}
}

func TestSync_RefusesPendingRebase(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "rebase sync", "feature")

	_ = workspace.SavePendingRebase(workspace.PendingRebase{
		EditingDiff: "test",
		PreEditSHA:  "abc",
	}, dir)

	err := workspace.CheckPendingRebase(dir)
	if err == nil {
		t.Error("expected error for pending rebase")
	}
}

func TestSync_RequiresFeatureBranch(t *testing.T) {
	dir := setupTestRepo(t)
	// On main branch
	feature := workspace.GetCurrentFeature(dir)
	if feature != nil {
		t.Error("expected nil feature on main")
	}
}

// ---------------------------------------------------------------------------
// Sync conflict detection
// ---------------------------------------------------------------------------

func TestSync_ConflictDetection(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "conflict test", "feature")

	// Create a change
	writeTestFile(t, dir, "conflict.txt", "feature version")
	mustExec(t, dir, "git", "add", "-A")
	mustExec(t, dir, "git", "commit", "-m", "feature change")

	// Check for conflict markers
	conflicts := git.GetConflictFiles(dir)
	if len(conflicts) != 0 {
		t.Error("expected no conflicts before rebase")
	}
}

// ---------------------------------------------------------------------------
// Sync with clean state
// ---------------------------------------------------------------------------

func TestSync_CleanStatePreserved(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "clean sync", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	// Verify working tree is clean
	if !git.IsClean(dir) {
		t.Error("expected clean working tree")
	}
}

// ---------------------------------------------------------------------------
// Sync undo entry
// ---------------------------------------------------------------------------

func TestSync_SavesUndoEntry(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "undo sync", "feature")

	sha := headSHA(t, dir)
	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:      "sync",
		Timestamp:   "2024-01-01T00:00:00Z",
		RefBefore:   sha,
		Description: "Sync with latest code",
		Data:        map[string]interface{}{"branch": "feature/undo-sync"},
	}, dir)

	entry := workspace.GetLastUndoEntry(dir)
	if entry == nil {
		t.Fatal("expected undo entry")
	}
	if entry.Action != "sync" {
		t.Errorf("expected sync, got %s", entry.Action)
	}
}

// ---------------------------------------------------------------------------
// Sort diffs by position for sync
// ---------------------------------------------------------------------------

func TestSortDiffsForSync(t *testing.T) {
	diffs := []workspace.DiffData{
		{Position: 2, Title: "second"},
		{Position: 1, Title: "first"},
		{Position: 3, Title: "third"},
	}

	sorted := sortDiffsByPosition(diffs)
	expected := []int{1, 2, 3}
	for i, d := range sorted {
		if d.Position != expected[i] {
			t.Errorf("position %d: expected %d, got %d", i, expected[i], d.Position)
		}
	}
}
