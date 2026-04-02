package commands

import (
	"fmt"
	"testing"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// Snapshot integration tests: full workflow scenarios
// ---------------------------------------------------------------------------

func TestIntegration_CreateThreeDiffsStack(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "full stack", "feature")

	d1 := addDiff(t, dir, feature, 1, "a.go", "package a", "feat(full-stack): add a")
	d2 := addDiff(t, dir, feature, 2, "b.go", "package b", "feat(full-stack): add b")
	d3 := addDiff(t, dir, feature, 3, "c.go", "package c", "feat(full-stack): add c")

	// Verify stack ordering
	diffs := sortDiffsByPosition(workspace.LoadDiffsForFeature(*feature, dir))
	if len(diffs) != 3 {
		t.Fatalf("expected 3 diffs, got %d", len(diffs))
	}
	if diffs[0].ID != d1.ID {
		t.Errorf("D1 mismatch: %s vs %s", diffs[0].ID, d1.ID)
	}
	if diffs[1].ID != d2.ID {
		t.Errorf("D2 mismatch: %s vs %s", diffs[1].ID, d2.ID)
	}
	if diffs[2].ID != d3.ID {
		t.Errorf("D3 mismatch: %s vs %s", diffs[2].ID, d3.ID)
	}
}

func TestIntegration_CommitsBetweenMainAndFeature(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "commits between", "feature")

	addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")

	// Count commits between main and HEAD
	count := commitCount(t, dir, "main", "HEAD")
	if count != 2 {
		t.Errorf("expected 2 commits between main and HEAD, got %d", count)
	}
}

func TestIntegration_FileOwnership(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "file ownership", "feature")

	d1 := addDiff(t, dir, feature, 1, "auth/login.go", "login", "feat: auth login")
	d2 := addDiff(t, dir, feature, 2, "api/handler.go", "handler", "feat: api handler")

	if d1.Files[0] != "auth/login.go" {
		t.Errorf("D1 file: expected auth/login.go, got %s", d1.Files[0])
	}
	if d2.Files[0] != "api/handler.go" {
		t.Errorf("D2 file: expected api/handler.go, got %s", d2.Files[0])
	}
}

func TestIntegration_CleanBranchState(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "clean state", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")

	// Working tree should be clean
	if !isClean(t, dir) {
		t.Error("expected clean working tree after committing diffs")
	}
}

func TestIntegration_AllDiffsHaveUUIDs(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "uuid check", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")
	addDiff(t, dir, feature, 2, "b.go", "b", "D2")
	addDiff(t, dir, feature, 3, "c.go", "c", "D3")

	for _, uuid := range feature.Diffs {
		if uuid == "" {
			t.Error("diff has empty UUID")
		}
		diff, err := workspace.LoadDiff(uuid, dir)
		if err != nil || diff == nil {
			t.Errorf("could not load diff %s", uuid)
		}
	}
}

func TestIntegration_DiffPositionsAreSequential(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "sequential", "feature")

	for i := 1; i <= 5; i++ {
		addDiff(t, dir, feature, i,
			fmt.Sprintf("file%d.go", i),
			fmt.Sprintf("content %d", i),
			fmt.Sprintf("D%d", i))
	}

	diffs := sortDiffsByPosition(workspace.LoadDiffsForFeature(*feature, dir))
	for i, d := range diffs {
		expected := i + 1
		if d.Position != expected {
			t.Errorf("diff %d: expected position %d, got %d", i, expected, d.Position)
		}
	}
}

func TestIntegration_TrailersOnAllCommits(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "all trailers", "feature")

	for i := 1; i <= 3; i++ {
		addDiff(t, dir, feature, i,
			fmt.Sprintf("file%d.go", i),
			fmt.Sprintf("content %d", i),
			fmt.Sprintf("D%d title", i))
	}

	// Verify trailers on each commit
	commits, err := git.GetCommitsBetween("main", "HEAD", dir)
	if err != nil {
		t.Fatalf("get commits: %v", err)
	}

	// Reverse to get oldest first
	for i, j := 0, len(commits)-1; i < j; i, j = i+1, j-1 {
		commits[i], commits[j] = commits[j], commits[i]
	}

	for i, c := range commits {
		msg, _ := git.GetCommitMessage(c.SHA, dir)
		trailers := git.ParseTrailers(msg)
		expectedDiff := fmt.Sprintf("D%d", i+1)
		if trailers.Diff != expectedDiff {
			t.Errorf("commit %d: expected Diff: %s, got %s", i, expectedDiff, trailers.Diff)
		}
		if trailers.Feature != feature.Slug {
			t.Errorf("commit %d: expected Feature: %s, got %s", i, feature.Slug, trailers.Feature)
		}
	}
}

func TestIntegration_VersionsBranchNameConsistency(t *testing.T) {
	branches := []string{
		"feature/auth",
		"fix/null-pointer",
		"docs/api-ref",
		"chore/deps",
	}

	for _, branch := range branches {
		vb := workspace.VersionsBranchName(branch)
		if vb != branch+"--versions" {
			t.Errorf("VersionsBranchName(%s) = %s, want %s--versions", branch, vb, branch)
		}
	}
}

func TestIntegration_FeatureMetadataComplete(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "complete metadata", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	loaded := loadFeatureFromDisk(t, dir, feature.Slug)

	if loaded.Name == "" {
		t.Error("name should not be empty")
	}
	if loaded.Type == "" {
		t.Error("type should not be empty")
	}
	if loaded.Slug == "" {
		t.Error("slug should not be empty")
	}
	if loaded.Branch == "" {
		t.Error("branch should not be empty")
	}
	if loaded.VersionsBranch == "" {
		t.Error("versions branch should not be empty")
	}
	if loaded.Created == "" {
		t.Error("created should not be empty")
	}
	if loaded.Status == "" {
		t.Error("status should not be empty")
	}
	if len(loaded.Diffs) != 1 {
		t.Errorf("expected 1 diff, got %d", len(loaded.Diffs))
	}
}

func TestIntegration_DiffMetadataComplete(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "diff metadata", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "content", "D1: test")

	if diff.ID == "" {
		t.Error("ID should not be empty")
	}
	if diff.UUID == "" {
		t.Error("UUID should not be empty")
	}
	if diff.Feature == "" {
		t.Error("Feature should not be empty")
	}
	if diff.Commit == "" {
		t.Error("Commit should not be empty")
	}
	if diff.Title == "" {
		t.Error("Title should not be empty")
	}
	if diff.Created == "" {
		t.Error("Created should not be empty")
	}
}

func TestIntegration_PendingRebaseFullCycle(t *testing.T) {
	dir := setupTestRepo(t)

	// Save
	pr := workspace.PendingRebase{
		EditingDiff:    "uuid-1",
		PreEditSHA:     "sha-pre",
		RemainingPicks: []string{"sha-a", "sha-b", "sha-c"},
		CompletedPicks: []string{},
	}
	_ = workspace.SavePendingRebase(pr, dir)

	// Verify exists
	if !workspace.HasPendingRebase(dir) {
		t.Fatal("expected pending rebase")
	}

	// Load and verify
	loaded := workspace.LoadPendingRebase(dir)
	if loaded.EditingDiff != "uuid-1" {
		t.Error("editing diff mismatch")
	}
	if len(loaded.RemainingPicks) != 3 {
		t.Errorf("expected 3 remaining, got %d", len(loaded.RemainingPicks))
	}

	// Simulate progress
	loaded.CompletedPicks = append(loaded.CompletedPicks, loaded.RemainingPicks[0])
	loaded.RemainingPicks = loaded.RemainingPicks[1:]
	_ = workspace.SavePendingRebase(*loaded, dir)

	reloaded := workspace.LoadPendingRebase(dir)
	if len(reloaded.RemainingPicks) != 2 {
		t.Errorf("expected 2 remaining, got %d", len(reloaded.RemainingPicks))
	}
	if len(reloaded.CompletedPicks) != 1 {
		t.Errorf("expected 1 completed, got %d", len(reloaded.CompletedPicks))
	}

	// Clear
	_ = workspace.ClearPendingRebase(dir)
	if workspace.HasPendingRebase(dir) {
		t.Error("expected no pending rebase after clear")
	}
}

func TestIntegration_UndoHistoryGrowth(t *testing.T) {
	dir := setupTestRepo(t)

	// Add multiple undo entries
	for i := 0; i < 10; i++ {
		_ = workspace.SaveUndoEntry(workspace.UndoEntry{
			Action:      fmt.Sprintf("action-%d", i),
			Timestamp:   time.Now().Add(time.Duration(i) * time.Second).UTC().Format(time.RFC3339),
			Description: fmt.Sprintf("Action %d", i),
		}, dir)
	}

	entries := workspace.ListUndoEntries(dir)
	if len(entries) != 10 {
		t.Errorf("expected 10 entries, got %d", len(entries))
	}

	// Last should be most recent
	last := workspace.GetLastUndoEntry(dir)
	if last.Action != "action-9" {
		t.Errorf("expected action-9, got %s", last.Action)
	}
}

func TestIntegration_FeatureListAfterCompletion(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "completed feature", "feature")

	feature.Status = "complete"
	_ = workspace.SaveFeature(*feature, dir)

	features := workspace.ListFeatures(dir)
	found := false
	for _, f := range features {
		if f.Slug == feature.Slug && f.Status == "complete" {
			found = true
		}
	}
	if !found {
		t.Error("completed feature should still be in list")
	}
}

func TestIntegration_DiffVersionsAreOrdered(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "ordered versions", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	for i := 1; i <= 5; i++ {
		_ = workspace.AddDiffVersion(feature, diff.UUID, workspace.DiffVersion{
			Number:     i,
			SnapshotID: fmt.Sprintf("S%d", i),
			Action:     "update",
		}, dir)
	}

	versions := workspace.GetDiffVersions(*feature, diff.UUID, dir)
	if len(versions) != 5 {
		t.Fatalf("expected 5 versions, got %d", len(versions))
	}

	for i, v := range versions {
		expected := i + 1
		if v.Number != expected {
			t.Errorf("version %d: expected number %d, got %d", i, expected, v.Number)
		}
	}
}
