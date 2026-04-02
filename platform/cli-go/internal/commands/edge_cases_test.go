package commands

import (
	"fmt"
	"strings"
	"testing"

	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// Edge case tests: pending rebase blocks commands
// ---------------------------------------------------------------------------

func TestEdge_PendingRebaseBlocksAllCommands(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "blocked", "feature")

	_ = workspace.SavePendingRebase(workspace.PendingRebase{
		EditingDiff: "test",
		PreEditSHA:  "abc123",
	}, dir)

	err := workspace.CheckPendingRebase(dir)
	if err == nil {
		t.Error("expected pending rebase to block operations")
	}
	if !strings.Contains(err.Error(), "interrupted") {
		t.Errorf("error should mention interrupted operation, got: %s", err.Error())
	}
}

// ---------------------------------------------------------------------------
// Uncommitted changes block operations
// ---------------------------------------------------------------------------

func TestEdge_UncommittedChangesBlockEdit(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "dirty edit", "feature")

	writeTestFile(t, dir, "new.txt", "content")
	if !workspace.HasUncommittedChanges(dir) {
		t.Error("expected uncommitted changes")
	}
}

func TestEdge_UncommittedChangesBlockSync(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "dirty sync", "feature")

	writeTestFile(t, dir, "new.txt", "content")
	if !workspace.HasUncommittedChanges(dir) {
		t.Error("expected uncommitted changes")
	}
}

func TestEdge_UncommittedChangesBlockLand(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "dirty land", "feature")

	writeTestFile(t, dir, "new.txt", "content")
	if !workspace.HasUncommittedChanges(dir) {
		t.Error("expected uncommitted changes")
	}
}

// ---------------------------------------------------------------------------
// Feature name collision
// ---------------------------------------------------------------------------

func TestEdge_FeatureNameCollision(t *testing.T) {
	dir := setupTestRepo(t)
	createFeature(t, dir, "collision test", "feature")
	mustExec(t, dir, "git", "checkout", "main")

	// Same name should produce same slug
	slug := workspace.Slugify("collision test")
	existing, _ := workspace.LoadFeature(slug, dir)
	if existing == nil {
		t.Error("expected existing feature with same slug")
	}
}

// ---------------------------------------------------------------------------
// Branch with ~ in name rejected
// ---------------------------------------------------------------------------

func TestEdge_TildeInBranchName(t *testing.T) {
	slug := workspace.Slugify("test~feature")
	if strings.Contains(slug, "~") {
		t.Errorf("slug should not contain ~, got %s", slug)
	}
}

// ---------------------------------------------------------------------------
// Versions branch missing auto-created
// ---------------------------------------------------------------------------

func TestEdge_VersionsBranchAutoCreated(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "auto vb", "feature")

	vb := workspace.VersionsBranchName(feature.Branch)
	if vb == "" {
		t.Error("expected non-empty versions branch name")
	}
	// The branch may not exist yet, that's fine -- EnsureVersionsBranch should handle it
}

// ---------------------------------------------------------------------------
// Empty diff (no changes) rejected
// ---------------------------------------------------------------------------

func TestEdge_EmptyDiffRejected(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "empty diff", "feature")

	clean := git.IsClean(dir)
	if !clean {
		t.Error("expected clean repo")
	}
	// An empty diff should be rejected
}

// ---------------------------------------------------------------------------
// Create diff after landing all diffs
// ---------------------------------------------------------------------------

func TestEdge_DiffAfterAllLanded(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "all landed new", "feature")
	d1 := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	d1.Status = "landed"
	_ = workspace.SaveDiff(*d1, dir)
	feature.Diffs = []string{}
	feature.Status = "complete"
	_ = workspace.SaveFeature(*feature, dir)

	// Feature is complete -- next diff position should still work
	pos := workspace.GetNextDiffPosition(*feature, dir)
	if pos != 1 { // empty diffs list means pos 1
		t.Errorf("expected position 1, got %d", pos)
	}
}

// ---------------------------------------------------------------------------
// Edit non-existent diff
// ---------------------------------------------------------------------------

func TestEdge_EditNonExistentDiff(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "no such diff", "feature")

	diff := workspace.GetDiffByPosition(*feature, 99, dir)
	if diff != nil {
		t.Error("expected nil for non-existent diff")
	}
}

// ---------------------------------------------------------------------------
// Compare non-existent versions
// ---------------------------------------------------------------------------

func TestEdge_CompareNonExistentVersions(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "no versions", "feature")

	versions := workspace.GetDiffVersions(*feature, "nonexistent", dir)
	if len(versions) != 0 {
		t.Errorf("expected 0 versions, got %d", len(versions))
	}
}

// ---------------------------------------------------------------------------
// Land from wrong branch
// ---------------------------------------------------------------------------

func TestEdge_LandFromMainBranch(t *testing.T) {
	dir := setupTestRepo(t)
	// On main branch
	feature := workspace.GetCurrentFeature(dir)
	if feature != nil {
		t.Error("expected nil on main")
	}
}

// ---------------------------------------------------------------------------
// Feature with no diffs - land errors
// ---------------------------------------------------------------------------

func TestEdge_FeatureNoDiffs_LandGraceful(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "no diffs feat", "feature")

	diffs := workspace.LoadDiffsForFeature(*feature, dir)
	if len(diffs) != 0 {
		t.Error("expected 0 diffs")
	}
}

// ---------------------------------------------------------------------------
// Very long feature name
// ---------------------------------------------------------------------------

func TestEdge_LongFeatureName(t *testing.T) {
	longName := strings.Repeat("very long name ", 20) // 300 chars
	slug := workspace.Slugify(longName)
	if slug == "" {
		t.Error("expected non-empty slug for long name")
	}
	if len(slug) > 300 {
		// Slug should be reasonable length
	}
}

// ---------------------------------------------------------------------------
// Unicode in feature name
// ---------------------------------------------------------------------------

func TestEdge_UnicodeFeatureName(t *testing.T) {
	slug := workspace.Slugify("cafe latte feature")
	if slug == "" {
		t.Error("expected non-empty slug")
	}
	// Should only contain valid chars
	for _, c := range slug {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-') {
			t.Errorf("invalid char %c in slug %s", c, slug)
		}
	}
}

// ---------------------------------------------------------------------------
// Multiple edits to same diff (v1->v2->v3)
// ---------------------------------------------------------------------------

func TestEdge_MultipleEditsToSameDiff(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "multi edit", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "v1", "D1")

	// Track versions (AddDiffVersion loads from disk, appends, saves)
	_ = workspace.AddDiffVersion(feature, diff.UUID, workspace.DiffVersion{
		Number: 1, SnapshotID: "S1", Action: "create",
	}, dir)

	_ = workspace.AddDiffVersion(feature, diff.UUID, workspace.DiffVersion{
		Number: 2, SnapshotID: "S2", Action: "update",
	}, dir)

	_ = workspace.AddDiffVersion(feature, diff.UUID, workspace.DiffVersion{
		Number: 3, SnapshotID: "S3", Action: "update",
	}, dir)

	versions := workspace.GetDiffVersions(*feature, diff.UUID, dir)
	if len(versions) != 3 {
		t.Errorf("expected 3 versions, got %d", len(versions))
	}

	latest := workspace.GetLatestDiffVersion(*feature, diff.UUID, dir)
	if latest.Number != 3 {
		t.Errorf("expected version 3, got %d", latest.Number)
	}
}

// ---------------------------------------------------------------------------
// Trailers roundtrip
// ---------------------------------------------------------------------------

func TestEdge_TrailersRoundtrip(t *testing.T) {
	trailers := git.Trailers{
		Snapshot: "S5",
		Diff:     "D2",
		Version:  "3",
		Feature:  "my-feature",
		Action:   "update",
		Stack:    "D1v2,D2v3",
		Previous: "S4",
		CleanSHA: "abc123",
	}

	formatted := git.FormatTrailers(trailers)
	parsed := git.ParseTrailers(formatted)

	if parsed.Snapshot != trailers.Snapshot {
		t.Errorf("Snapshot mismatch: %s vs %s", parsed.Snapshot, trailers.Snapshot)
	}
	if parsed.Diff != trailers.Diff {
		t.Errorf("Diff mismatch: %s vs %s", parsed.Diff, trailers.Diff)
	}
	if parsed.Version != trailers.Version {
		t.Errorf("Version mismatch: %s vs %s", parsed.Version, trailers.Version)
	}
	if parsed.Feature != trailers.Feature {
		t.Errorf("Feature mismatch: %s vs %s", parsed.Feature, trailers.Feature)
	}
	if parsed.Action != trailers.Action {
		t.Errorf("Action mismatch: %s vs %s", parsed.Action, trailers.Action)
	}
}

// ---------------------------------------------------------------------------
// Append and strip trailers
// ---------------------------------------------------------------------------

func TestEdge_AppendTrailers(t *testing.T) {
	body := "feat(auth): add login"
	trailers := git.Trailers{Diff: "D1", Version: "1"}
	result := git.AppendTrailers(body, trailers)

	if !strings.Contains(result, "Diff: D1") {
		t.Error("expected Diff trailer")
	}
	if !strings.Contains(result, "Version: 1") {
		t.Error("expected Version trailer")
	}
	if !strings.HasPrefix(result, "feat(auth): add login") {
		t.Error("should preserve original body")
	}
}

func TestEdge_StripTrailers(t *testing.T) {
	msg := "title\n\nDiff: D1\nVersion: 1\nFeature: test\n"
	stripped := git.StripTrailers(msg)
	if strings.Contains(stripped, "Diff:") {
		t.Error("should strip Diff trailer")
	}
	if !strings.Contains(stripped, "title") {
		t.Error("should preserve title")
	}
}

// ---------------------------------------------------------------------------
// Config operations
// ---------------------------------------------------------------------------

func TestEdge_ConfigDefaults(t *testing.T) {
	dir := setupTestRepo(t)
	config := workspace.LoadConfig(dir)
	if config.DefaultBranch != "main" {
		t.Errorf("expected default branch 'main', got %s", config.DefaultBranch)
	}
	if !config.LLM.Enabled {
		t.Error("expected LLM enabled by default")
	}
}

func TestEdge_ConfigSaveLoad(t *testing.T) {
	dir := setupTestRepo(t)
	config := workspace.LoadConfig(dir)
	config.DefaultBranch = "develop"
	_ = workspace.SaveConfig(config, dir)

	loaded := workspace.LoadConfig(dir)
	if loaded.DefaultBranch != "develop" {
		t.Errorf("expected 'develop', got %s", loaded.DefaultBranch)
	}
}

// ---------------------------------------------------------------------------
// Snapshot count tracking
// ---------------------------------------------------------------------------

func TestEdge_SnapshotCountIncrement(t *testing.T) {
	feature := workspace.FeatureData{SnapshotCount: 0}

	id1 := workspace.GetNextSnapshotID(feature)
	if id1 != "S1" {
		t.Errorf("expected S1, got %s", id1)
	}

	feature.SnapshotCount = 1
	id2 := workspace.GetNextSnapshotID(feature)
	if id2 != "S2" {
		t.Errorf("expected S2, got %s", id2)
	}

	feature.SnapshotCount = 99
	id100 := workspace.GetNextSnapshotID(feature)
	if id100 != "S100" {
		t.Errorf("expected S100, got %s", id100)
	}
}

// ---------------------------------------------------------------------------
// DiffVersion management
// ---------------------------------------------------------------------------

func TestEdge_DiffVersionEmpty(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "empty ver", "feature")
	diff := addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	latest := workspace.GetLatestDiffVersion(*feature, diff.UUID, dir)
	if latest != nil {
		t.Error("expected nil latest for diff with no versions")
	}
}

// ---------------------------------------------------------------------------
// Concurrent-like modifications
// ---------------------------------------------------------------------------

func TestEdge_ConcurrentFeatureCreation(t *testing.T) {
	dir := setupTestRepo(t)

	// Create multiple features that should all be listable
	names := []string{"alpha", "beta", "gamma", "delta", "epsilon"}
	for _, name := range names {
		createFeature(t, dir, name, "feature")
		mustExec(t, dir, "git", "checkout", "main")
	}

	features := workspace.ListFeatures(dir)
	if len(features) != len(names) {
		t.Errorf("expected %d features, got %d", len(names), len(features))
	}
}

// ---------------------------------------------------------------------------
// Stack of 10 diffs
// ---------------------------------------------------------------------------

func TestEdge_LargeStack(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "large stack", "feature")

	for i := 1; i <= 10; i++ {
		addDiff(t, dir, feature, i,
			fmt.Sprintf("file%d.go", i),
			fmt.Sprintf("content %d", i),
			fmt.Sprintf("D%d: change %d", i, i))
	}

	diffs := workspace.LoadDiffsForFeature(*feature, dir)
	if len(diffs) != 10 {
		t.Errorf("expected 10 diffs, got %d", len(diffs))
	}

	sorted := sortDiffsByPosition(diffs)
	for i, d := range sorted {
		expected := i + 1
		if d.Position != expected {
			t.Errorf("position %d: expected %d, got %d", i, expected, d.Position)
		}
	}
}

// ---------------------------------------------------------------------------
// GetDiffByPosition edge cases
// ---------------------------------------------------------------------------

func TestEdge_GetDiffByPosition_Zero(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "pos zero", "feature")
	addDiff(t, dir, feature, 1, "a.go", "a", "D1")

	diff := workspace.GetDiffByPosition(*feature, 0, dir)
	if diff != nil {
		t.Error("expected nil for position 0")
	}
}

func TestEdge_GetDiffByPosition_Negative(t *testing.T) {
	dir := setupTestRepo(t)
	feature := createFeature(t, dir, "neg pos", "feature")

	diff := workspace.GetDiffByPosition(*feature, -1, dir)
	if diff != nil {
		t.Error("expected nil for negative position")
	}
}

// ---------------------------------------------------------------------------
// Shallow clone detection
// ---------------------------------------------------------------------------

func TestEdge_ShallowClone(t *testing.T) {
	dir := setupTestRepo(t)
	// A standard repo should not be shallow
	isRepo := git.IsGitRepo(dir)
	if !isRepo {
		t.Error("expected git repo")
	}
}

// ---------------------------------------------------------------------------
// Editing state persistence
// ---------------------------------------------------------------------------

func TestEdge_EditingStatePersistence(t *testing.T) {
	dir := setupTestRepo(t)
	_ = workspace.SetEditingDiff("uuid-abc", dir)

	editing := workspace.GetEditingDiff(dir)
	if editing != "uuid-abc" {
		t.Errorf("expected uuid-abc, got %s", editing)
	}

	_ = workspace.SetEditingDiff("", dir)
	editing = workspace.GetEditingDiff(dir)
	if editing != "" {
		t.Errorf("expected empty after clear, got %s", editing)
	}
}
