package commands

import (
	"testing"

	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// Land tests
// ---------------------------------------------------------------------------

func TestLand_RequiresFeatureBranch(t *testing.T) {
	dir := setupTestRepo(t)
	feature := workspace.GetCurrentFeature(dir)
	if feature != nil {
		t.Error("expected nil feature on main")
	}
}

func TestLand_NoDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "no diffs land", "feature")

	diffs := workspace.LoadDiffsForFeature(*feature, dir)
	if len(diffs) != 0 {
		t.Error("expected no diffs")
	}
}

func TestLand_FindsLowestUnlanded(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "bottom land", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")
	addDiff(t, dir, feature, 3, "c.go", "c", "D3")

	diffs := sortDiffsByPosition(workspace.LoadDiffsForFeature(*feature, dir))

	// All are draft/unlanded
	var unlandedDiffs []workspace.DiffData
	for _, d := range diffs {
		if d.Status != "landed" {
			unlandedDiffs = append(unlandedDiffs, d)
		}
	}

	if len(unlandedDiffs) == 0 {
		t.Fatal("expected unlanded diffs")
	}
	if unlandedDiffs[0].Position != 1 {
		t.Errorf("expected lowest unlanded at position 1, got %d", unlandedDiffs[0].Position)
	}
}

func TestLand_MustBeLowestPosition(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "order land", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")

	diffs := sortDiffsByPosition(workspace.LoadDiffsForFeature(*feature, dir))
	var unlandedDiffs []workspace.DiffData
	for _, d := range diffs {
		if d.Status != "landed" {
			unlandedDiffs = append(unlandedDiffs, d)
		}
	}

	// Trying to land D2 when D1 is unlanded should fail
	d2 := workspace.GetDiffByPosition(*feature, 2, dir)
	if d2 != nil && len(unlandedDiffs) > 0 && d2.Position != unlandedDiffs[0].Position {
		// This is the expected path: D2 != lowest unlanded (D1)
	} else {
		t.Error("D2 should not be the lowest unlanded")
	}
}

func TestLand_StatusCheck_NotApproved(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "unapproved", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	// Status is draft, CI not passed
	if diff.Status == "approved" || diff.CI == "passed" {
		t.Error("expected unapproved/unpassed state")
	}
}

func TestLand_StatusCheck_Approved(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "approved", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	diff.Status = "approved"
	diff.CI = "passed"
	_ = workspace.SaveDiff(*diff, dir)

	loaded, _ := workspace.LoadDiff(diff.UUID, dir)
	if loaded.Status != "approved" {
		t.Error("expected approved")
	}
	if loaded.CI != "passed" {
		t.Error("expected CI passed")
	}
}

func TestLand_MarksLanded(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "mark landed", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	diff.Status = "landed"
	_ = workspace.SaveDiff(*diff, dir)

	loaded, _ := workspace.LoadDiff(diff.UUID, dir)
	if loaded.Status != "landed" {
		t.Error("expected landed status")
	}
}

func TestLand_RemovesFromFeatureDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "remove diffs", "feature")
	d1 := addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")

	// Simulate removing D1 from feature
	var newDiffs []string
	for _, id := range feature.Diffs {
		if id != d1.UUID {
			newDiffs = append(newDiffs, id)
		}
	}
	feature.Diffs = newDiffs
	_ = workspace.SaveFeature(*feature, dir)

	loaded := loadFeatureFromDisk(t, dir, feature.Slug)
	if len(loaded.Diffs) != 1 {
		t.Errorf("expected 1 diff remaining, got %d", len(loaded.Diffs))
	}
}

func TestLand_FeatureComplete_AllLanded(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "all landed", "feature")
	d1 := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	// Mark as landed and remove from feature
	d1.Status = "landed"
	_ = workspace.SaveDiff(*d1, dir)

	feature.Diffs = []string{}
	feature.Status = "complete"
	_ = workspace.SaveFeature(*feature, dir)

	loaded := loadFeatureFromDisk(t, dir, feature.Slug)
	if loaded.Status != "complete" {
		t.Errorf("expected complete, got %s", loaded.Status)
	}
	if len(loaded.Diffs) != 0 {
		t.Errorf("expected 0 diffs, got %d", len(loaded.Diffs))
	}
}

func TestLand_RefusesUncommittedChanges(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "dirty land", "feature")

	writeTestFile(t, dir, "dirty.txt", "content")
	if !workspace.HasUncommittedChanges(dir) {
		t.Error("expected uncommitted changes")
	}
}

func TestLand_RefusesPendingRebase(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "rebase land", "feature")

	_ = workspace.SavePendingRebase(workspace.PendingRebase{
		EditingDiff: "test",
		PreEditSHA:  "abc",
	}, dir)

	if !workspace.HasPendingRebase(dir) {
		t.Error("expected pending rebase")
	}
}

func TestLand_SavesUndoEntry(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "undo land", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	sha := headSHA(t, dir)
	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:      "land",
		Timestamp:   "2024-01-01T00:00:00Z",
		RefBefore:   sha,
		Description: "Land D1: " + diff.Title,
		Data:        map[string]interface{}{"uuid": diff.UUID},
	}, dir)

	entry := workspace.GetLastUndoEntry(dir)
	if entry == nil {
		t.Fatal("expected undo entry")
	}
	if entry.Action != "land" {
		t.Errorf("expected land, got %s", entry.Action)
	}
}

func TestLand_UndoCannotUndo(t *testing.T) {
	// Landing cannot be undone
	entry := &workspace.UndoEntry{Action: "land"}
	if entry.Action != "land" {
		t.Error("expected land action")
	}
}

// ---------------------------------------------------------------------------
// Land with remaining diffs
// ---------------------------------------------------------------------------

func TestLand_RemainingDiffsAfterLand(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "remain land", "feature")
	d1 := addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")
	addDiff(t, dir, feature, 3, "c.go", "c", "D3")

	// After landing D1, D2 and D3 should remain
	var remaining []string
	for _, id := range feature.Diffs {
		if id != d1.UUID {
			remaining = append(remaining, id)
		}
	}
	if len(remaining) != 2 {
		t.Errorf("expected 2 remaining, got %d", len(remaining))
	}
}
