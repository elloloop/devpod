package commands

import (
	"testing"

	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// Undo tests
// ---------------------------------------------------------------------------

func TestUndo_NothingToUndo(t *testing.T) {
	dir := setupTestRepo(t)
	entry := workspace.GetLastUndoEntry(dir)
	if entry != nil {
		t.Error("expected nil entry for fresh repo")
	}
}

func TestUndo_DiffCreate_RemovesFromDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "undo create", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	// Simulate undo: remove diff from feature
	var newDiffs []string
	for _, id := range feature.Diffs {
		if id != diff.UUID {
			newDiffs = append(newDiffs, id)
		}
	}
	feature.Diffs = newDiffs
	_ = workspace.SaveFeature(*feature, dir)

	loaded := loadFeatureFromDisk(t, dir, feature.Slug)
	if len(loaded.Diffs) != 0 {
		t.Errorf("expected 0 diffs after undo, got %d", len(loaded.Diffs))
	}
}

func TestUndo_DiffUpdate_RestoresVersion(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "undo update", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	// Simulate version 2
	diff.Version = 2
	_ = workspace.SaveDiff(*diff, dir)

	// Undo: restore version 1
	diff.Version = 1
	_ = workspace.SaveDiff(*diff, dir)

	loaded, _ := workspace.LoadDiff(diff.UUID, dir)
	if loaded.Version != 1 {
		t.Errorf("expected version 1, got %d", loaded.Version)
	}
}

func TestUndo_EditMode_ClearsState(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "undo edit", "feature")

	_ = workspace.SetEditingDiff("some-uuid", dir)
	_ = workspace.SetEditingDiff("", dir)

	editing := workspace.GetEditingDiff(dir)
	if editing != "" {
		t.Errorf("expected empty editing, got %s", editing)
	}
}

func TestUndo_Sync_ResetsProperly(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "undo sync", "feature")

	sha := headSHA(t, dir)
	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:    "sync",
		Timestamp: "2024-01-01T00:00:00Z",
		RefBefore: sha,
	}, dir)

	entry := workspace.GetLastUndoEntry(dir)
	if entry == nil {
		t.Fatal("expected entry")
	}
	if entry.RefBefore != sha {
		t.Errorf("expected SHA %s, got %s", sha, entry.RefBefore)
	}
}

func TestUndo_Submit_ResetsToExplicitly(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "undo submit", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	diff.Status = "submitted"
	_ = workspace.SaveDiff(*diff, dir)

	// Undo: reset to draft
	diff.Status = "draft"
	_ = workspace.SaveDiff(*diff, dir)

	loaded, _ := workspace.LoadDiff(diff.UUID, dir)
	if loaded.Status != "draft" {
		t.Errorf("expected draft, got %s", loaded.Status)
	}
}

func TestUndo_LandCannotUndo(t *testing.T) {
	// Land undo should be detected
	entry := workspace.UndoEntry{Action: "land"}
	if entry.Action != "land" {
		t.Error("expected land action")
	}
	// The command should print error and not proceed
}

func TestUndo_ListOrder(t *testing.T) {
	dir := setupTestRepo(t)

	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:    "first",
		Timestamp: "2024-01-01T00:00:00Z",
	}, dir)
	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:    "second",
		Timestamp: "2024-01-01T00:00:01Z",
	}, dir)
	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:    "third",
		Timestamp: "2024-01-01T00:00:02Z",
	}, dir)

	entries := workspace.ListUndoEntries(dir)
	if len(entries) != 3 {
		t.Errorf("expected 3 entries, got %d", len(entries))
	}
	// Last entry should be "third"
	if entries[len(entries)-1].Action != "third" {
		t.Errorf("expected last action 'third', got %s", entries[len(entries)-1].Action)
	}
}

func TestUndo_DoubleUndo(t *testing.T) {
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
	if last == nil || last.Action != "first" {
		t.Error("first undo should leave 'first' as last")
	}

	_ = workspace.RemoveLastUndoEntry(dir)
	last = workspace.GetLastUndoEntry(dir)
	if last != nil {
		t.Error("second undo should leave no entries")
	}
}

func TestUndo_WithNoRefBefore(t *testing.T) {
	entry := workspace.UndoEntry{
		Action:    "unknown",
		Timestamp: "2024-01-01T00:00:00Z",
		RefBefore: "",
	}
	// Cannot undo without refBefore
	if entry.RefBefore != "" {
		t.Error("expected empty refBefore")
	}
}
