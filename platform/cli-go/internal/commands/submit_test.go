package commands

import (
	"testing"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// Submit tests
// ---------------------------------------------------------------------------

func TestSubmit_RequiresFeatureBranch(t *testing.T) {
	dir := setupTestRepo(t)
	feature := workspace.GetCurrentFeature(dir)
	if feature != nil {
		t.Error("expected nil feature on main")
	}
}

func TestSubmit_AllAlreadySubmitted(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "all submitted", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	diff.Status = "submitted"
	_ = workspace.SaveDiff(*diff, dir)

	diffs := workspace.LoadDiffsForFeature(*feature, dir)
	var draftDiffs []workspace.DiffData
	for _, d := range diffs {
		if d.Status == "draft" {
			draftDiffs = append(draftDiffs, d)
		}
	}
	if len(draftDiffs) != 0 {
		t.Errorf("expected no draft diffs, got %d", len(draftDiffs))
	}
}

func TestSubmit_FindsDraftDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "find drafts", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")

	diffs := workspace.LoadDiffsForFeature(*feature, dir)
	var draftDiffs []workspace.DiffData
	for _, d := range diffs {
		if d.Status == "draft" {
			draftDiffs = append(draftDiffs, d)
		}
	}
	if len(draftDiffs) != 2 {
		t.Errorf("expected 2 draft diffs, got %d", len(draftDiffs))
	}
}

func TestSubmit_UpdatesStatusToSubmitted(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "status update", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	diff.Status = "submitted"
	diff.Updated = time.Now().UTC().Format(time.RFC3339)
	_ = workspace.SaveDiff(*diff, dir)

	loaded, _ := workspace.LoadDiff(diff.UUID, dir)
	if loaded.Status != "submitted" {
		t.Errorf("expected submitted, got %s", loaded.Status)
	}
}

func TestSubmit_UpdatesFeatureStatus(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "feature status", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	feature.Status = "submitted"
	_ = workspace.SaveFeature(*feature, dir)

	loaded := loadFeatureFromDisk(t, dir, feature.Slug)
	if loaded.Status != "submitted" {
		t.Errorf("expected submitted, got %s", loaded.Status)
	}
}

func TestSubmit_SavesUndoEntry(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "undo submit", "feature")

	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:      "submit",
		Timestamp:   "2024-01-01T00:00:00Z",
		Description: "Submit 1 diff",
		Data:        map[string]interface{}{"diffs": []string{"uuid-1"}},
	}, dir)

	entry := workspace.GetLastUndoEntry(dir)
	if entry == nil {
		t.Fatal("expected undo entry")
	}
	if entry.Action != "submit" {
		t.Errorf("expected submit, got %s", entry.Action)
	}
}

func TestSubmit_RefusesPendingRebase(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "pending submit", "feature")

	_ = workspace.SavePendingRebase(workspace.PendingRebase{
		EditingDiff: "test",
		PreEditSHA:  "abc",
	}, dir)

	err := workspace.CheckPendingRebase(dir)
	if err == nil {
		t.Error("expected error for pending rebase")
	}
}

func TestSubmit_VersionsBranchName(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "vb submit", "feature")

	vb := feature.VersionsBranch
	expected := "feature/vb-submit--versions"
	if vb != expected {
		t.Errorf("expected %s, got %s", expected, vb)
	}
}

func TestSubmit_MixedStatusDiffs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "mixed status", "feature")
	d1 := addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")

	// D1 already submitted, D2 is draft
	d1.Status = "submitted"
	_ = workspace.SaveDiff(*d1, dir)

	diffs := workspace.LoadDiffsForFeature(*feature, dir)
	var draftDiffs []workspace.DiffData
	for _, d := range diffs {
		if d.Status == "draft" {
			draftDiffs = append(draftDiffs, d)
		}
	}
	if len(draftDiffs) != 1 {
		t.Errorf("expected 1 draft diff, got %d", len(draftDiffs))
	}
}
