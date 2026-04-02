package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// initTestRepo creates a fresh git repo in a temp dir with an initial commit.
func initTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	mustRun(t, dir, "git", "init")
	mustRun(t, dir, "git", "config", "user.email", "test@test.com")
	mustRun(t, dir, "git", "config", "user.name", "Test")
	// Create initial commit
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
		t.Fatalf("command %s %v failed in %s: %v\n%s", name, args, dir, err, string(out))
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
// Core: Run
// ---------------------------------------------------------------------------

func TestRun_Success(t *testing.T) {
	dir := initTestRepo(t)
	out, err := Run("status", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out == "" {
		// empty is fine for a clean repo
	}
}

func TestRun_ErrorTranslation(t *testing.T) {
	dir := t.TempDir()
	// not a git repo
	_, err := Run("status", dir)
	if err == nil {
		t.Fatal("expected error for non-git dir")
	}
	if !strings.Contains(err.Error(), "Not inside a project directory") {
		t.Errorf("expected translated error, got: %v", err)
	}
}

func TestRun_NonExistentRef(t *testing.T) {
	dir := initTestRepo(t)
	_, err := Run("rev-parse --verify nonexistent-branch-12345", dir)
	if err == nil {
		t.Fatal("expected error for non-existent ref")
	}
}

// ---------------------------------------------------------------------------
// Branch operations
// ---------------------------------------------------------------------------

func TestGetCurrentBranch(t *testing.T) {
	dir := initTestRepo(t)
	branch, err := GetCurrentBranch(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should be main or master
	if branch != "main" && branch != "master" {
		t.Errorf("unexpected branch: %s", branch)
	}
}

func TestCreateBranch(t *testing.T) {
	dir := initTestRepo(t)
	err := CreateBranch("feature/test", "HEAD", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	branch, _ := GetCurrentBranch(dir)
	if branch != "feature/test" {
		t.Errorf("expected feature/test, got %s", branch)
	}
}

func TestSwitchBranch(t *testing.T) {
	dir := initTestRepo(t)
	_ = CreateBranch("feature/test", "HEAD", dir)
	// Switch back
	err := SwitchBranch("main", dir)
	if err != nil {
		// might be master
		err = SwitchBranch("master", dir)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
}

func TestDeleteBranch(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	_ = CreateBranch("feature/test", "HEAD", dir)
	_ = SwitchBranch(defaultBranch, dir)

	err := DeleteBranch("feature/test", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if BranchExists("feature/test", dir) {
		t.Error("branch should not exist after deletion")
	}
}

func TestBranchExists(t *testing.T) {
	dir := initTestRepo(t)
	if !BranchExists("HEAD", dir) {
		t.Error("HEAD should always exist")
	}
	if BranchExists("nonexistent-xyz", dir) {
		t.Error("nonexistent branch should not exist")
	}
}

func TestBranchExistsRemote_NoRemote(t *testing.T) {
	dir := initTestRepo(t)
	// No remote, should return false
	if BranchExistsRemote("main", dir) {
		t.Error("no remote configured, should return false")
	}
}

// ---------------------------------------------------------------------------
// IsClean / changes
// ---------------------------------------------------------------------------

func TestIsClean_Clean(t *testing.T) {
	dir := initTestRepo(t)
	if !IsClean(dir) {
		t.Error("repo should be clean after init")
	}
}

func TestIsClean_Dirty(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "dirty.txt", "changes")
	if IsClean(dir) {
		t.Error("repo should be dirty after adding file")
	}
}

func TestGetChangedFiles(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "new.txt", "content")
	files, err := GetChangedFiles(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("expected at least one changed file")
	}
	found := false
	for _, f := range files {
		if f.Path == "new.txt" && f.Status == "added" {
			found = true
		}
	}
	if !found {
		t.Error("expected new.txt to be listed as added")
	}
}

func TestGetChangedFiles_Empty(t *testing.T) {
	dir := initTestRepo(t)
	files, err := GetChangedFiles(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(files) != 0 {
		t.Errorf("expected 0 files, got %d", len(files))
	}
}

func TestGetChangedFiles_Modified(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "README.md", "modified content")
	files, err := GetChangedFiles(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("expected changed file")
	}
	if files[0].Status != "modified" {
		t.Errorf("expected modified, got %s", files[0].Status)
	}
}

func TestGetChangedFiles_Deleted(t *testing.T) {
	dir := initTestRepo(t)
	os.Remove(filepath.Join(dir, "README.md"))
	files, err := GetChangedFiles(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("expected changed file")
	}
	if files[0].Status != "deleted" {
		t.Errorf("expected deleted, got %s", files[0].Status)
	}
}

// ---------------------------------------------------------------------------
// Commit operations
// ---------------------------------------------------------------------------

func TestStageAll(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "file.txt", "content")
	err := StageAll(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCommit(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "file.txt", "content")
	_ = StageAll(dir)
	sha, err := Commit("test commit", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sha == "" {
		t.Error("expected non-empty SHA")
	}
	if len(sha) < 7 {
		t.Errorf("SHA too short: %s", sha)
	}
}

func TestCommit_NoChanges(t *testing.T) {
	dir := initTestRepo(t)
	_, err := Commit("empty commit", dir)
	if err == nil {
		t.Error("expected error when committing with no changes")
	}
}

func TestAmend(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "file.txt", "content")
	_ = StageAll(dir)
	sha1, _ := Commit("first message", dir)

	writeFile(t, dir, "file.txt", "updated content")
	_ = StageAll(dir)
	sha2, err := Amend("amended message", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sha1 == sha2 {
		t.Error("amended SHA should differ from original")
	}
	msg, _ := GetCommitMessage(sha2, dir)
	if !strings.Contains(msg, "amended message") {
		t.Errorf("expected amended message, got: %s", msg)
	}
}

func TestAmend_NoEdit(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "file.txt", "content")
	_ = StageAll(dir)
	_, _ = Commit("original message", dir)

	writeFile(t, dir, "file2.txt", "more content")
	_ = StageAll(dir)
	sha, err := Amend("", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	msg, _ := GetCommitMessage(sha, dir)
	if !strings.Contains(msg, "original message") {
		t.Errorf("expected original message preserved, got: %s", msg)
	}
}

func TestGetCommitMessage(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "file.txt", "content")
	_ = StageAll(dir)
	sha, _ := Commit("test message body", dir)
	msg, err := GetCommitMessage(sha, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(msg, "test message body") {
		t.Errorf("expected message to contain 'test message body', got: %s", msg)
	}
}

func TestGetHeadSHA(t *testing.T) {
	dir := initTestRepo(t)
	sha, err := GetHeadSHA(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sha == "" || len(sha) < 7 {
		t.Errorf("unexpected SHA: %s", sha)
	}
}

func TestGetCommitDiff(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "file.txt", "content")
	_ = StageAll(dir)
	sha, _ := Commit("add file", dir)
	diff, err := GetCommitDiff(sha, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(diff, "file.txt") {
		t.Error("expected diff to mention file.txt")
	}
}

// ---------------------------------------------------------------------------
// Diff / stats
// ---------------------------------------------------------------------------

func TestGetDiff(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "file.txt", "content")
	diff, err := GetDiff(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Untracked files don't show in diff
	_ = StageAll(dir)
	diff, err = GetDiff(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if diff == "" {
		t.Error("expected non-empty diff after staging")
	}
}

func TestGetDiffStats(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "file.txt", "line1\nline2\nline3\n")
	_ = StageAll(dir)
	stats, err := GetDiffStats(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stats.Files == 0 {
		t.Error("expected at least 1 file")
	}
	if stats.Additions == 0 {
		t.Error("expected additions > 0")
	}
}

func TestGetDiffStats_Empty(t *testing.T) {
	dir := initTestRepo(t)
	stats, err := GetDiffStats(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stats.Files != 0 || stats.Additions != 0 || stats.Deletions != 0 {
		t.Error("expected all zeros for clean repo")
	}
}

// ---------------------------------------------------------------------------
// Rebase operations
// ---------------------------------------------------------------------------

func TestRebaseOnto_NoConflict(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	// Create a feature branch
	_ = CreateBranch("feature/test", defaultBranch, dir)
	writeFile(t, dir, "feature.txt", "feature content")
	_ = StageAll(dir)
	_, _ = Commit("feature commit", dir)

	// Rebase onto default branch (no-op essentially)
	result := RebaseOnto(defaultBranch, dir)
	if !result.Success {
		t.Errorf("expected successful rebase, conflicts: %v", result.Conflicts)
	}
}

// ---------------------------------------------------------------------------
// Stash operations
// ---------------------------------------------------------------------------

func TestStashSave_Clean(t *testing.T) {
	dir := initTestRepo(t)
	created, err := StashSave("test stash", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if created {
		t.Error("should not create stash for clean repo")
	}
}

func TestStashSave_Dirty(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "dirty.txt", "content")
	_ = StageAll(dir)
	created, err := StashSave("test stash", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !created {
		t.Error("expected stash to be created")
	}
	if !IsClean(dir) {
		t.Error("repo should be clean after stash")
	}
}

func TestStashPop(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "dirty.txt", "content")
	_ = StageAll(dir)
	_, _ = StashSave("test stash", dir)

	err := StashPop(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if IsClean(dir) {
		t.Error("repo should be dirty after stash pop")
	}
}

func TestStashPop_Empty(t *testing.T) {
	dir := initTestRepo(t)
	err := StashPop(dir)
	if err == nil {
		t.Error("expected error when popping empty stash")
	}
}

// ---------------------------------------------------------------------------
// Cherry-pick operations
// ---------------------------------------------------------------------------

func TestCherryPick_Success(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	// Create a commit on a side branch
	_ = CreateBranch("side", defaultBranch, dir)
	writeFile(t, dir, "side.txt", "side content")
	_ = StageAll(dir)
	sha, _ := Commit("side commit", dir)

	// Switch back and cherry-pick
	_ = SwitchBranch(defaultBranch, dir)
	err := CherryPick(sha, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify file exists
	_, err = os.Stat(filepath.Join(dir, "side.txt"))
	if err != nil {
		t.Error("expected side.txt to exist after cherry-pick")
	}
}

func TestCherryPickNoCommit(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	_ = CreateBranch("side", defaultBranch, dir)
	writeFile(t, dir, "side.txt", "side content")
	_ = StageAll(dir)
	sha, _ := Commit("side commit", dir)

	_ = SwitchBranch(defaultBranch, dir)
	err := CherryPickNoCommit(sha, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// File should exist but repo should be dirty (no commit made)
	if IsClean(dir) {
		t.Error("repo should be dirty after cherry-pick --no-commit")
	}
}

func TestHasConflicts_None(t *testing.T) {
	dir := initTestRepo(t)
	if HasConflicts(dir) {
		t.Error("should not have conflicts in clean repo")
	}
}

// ---------------------------------------------------------------------------
// Worktree operations
// ---------------------------------------------------------------------------

func TestWorktreeAdd_Remove(t *testing.T) {
	dir := initTestRepo(t)
	wtDir := filepath.Join(t.TempDir(), "worktree")

	defaultBranch, _ := GetCurrentBranch(dir)
	_ = CreateBranch("wt-branch", defaultBranch, dir)
	_ = SwitchBranch(defaultBranch, dir)

	err := WorktreeAdd(wtDir, "wt-branch", dir)
	if err != nil {
		t.Fatalf("unexpected error adding worktree: %v", err)
	}

	// Verify worktree exists
	if _, err := os.Stat(wtDir); os.IsNotExist(err) {
		t.Error("worktree directory should exist")
	}

	// List should include it
	paths, err := WorktreeList(dir)
	if err != nil {
		t.Fatalf("unexpected error listing worktrees: %v", err)
	}
	// Resolve symlinks for comparison (macOS /private vs /var)
	realWtDir, _ := filepath.EvalSymlinks(wtDir)
	found := false
	for _, p := range paths {
		realP, _ := filepath.EvalSymlinks(p)
		if realP == realWtDir {
			found = true
		}
	}
	if !found {
		t.Errorf("worktree not found in list, paths: %v, expected: %s (real: %s)", paths, wtDir, realWtDir)
	}

	// Remove
	err = WorktreeRemove(wtDir, dir)
	if err != nil {
		t.Fatalf("unexpected error removing worktree: %v", err)
	}
}

func TestWorktreeList_MainOnly(t *testing.T) {
	dir := initTestRepo(t)
	paths, err := WorktreeList(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(paths) == 0 {
		t.Error("expected at least the main worktree")
	}
}

func TestCleanupStaleWorktrees(t *testing.T) {
	dir := initTestRepo(t)
	// Should not panic or error on a clean repo
	CleanupStaleWorktrees(dir)
}

func TestSnapshotToVersionsBranch(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	// Create feature branch with content
	_ = CreateBranch("feature/snap", defaultBranch, dir)
	writeFile(t, dir, "feature.txt", "feature content")
	_ = StageAll(dir)
	_, _ = Commit("add feature file", dir)

	// Create orphan versions branch
	_ = CreateOrphanBranch("feature/snap--versions", "feature/snap", dir)

	// Take a snapshot
	sha, err := SnapshotToVersionsBranch("feature/snap", "feature/snap--versions", "snapshot 1", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sha == "" {
		t.Error("expected non-empty SHA")
	}
}

func TestSnapshotToVersionsBranch_MultipleSnapshots(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	_ = CreateBranch("feature/multi", defaultBranch, dir)
	writeFile(t, dir, "file1.txt", "content1")
	_ = StageAll(dir)
	_, _ = Commit("add file1", dir)

	_ = CreateOrphanBranch("feature/multi--versions", "feature/multi", dir)

	sha1, err := SnapshotToVersionsBranch("feature/multi", "feature/multi--versions", "snapshot 1", dir)
	if err != nil {
		t.Fatalf("snapshot 1 error: %v", err)
	}

	// Make more changes on clean branch
	writeFile(t, dir, "file2.txt", "content2")
	_ = StageAll(dir)
	_, _ = Commit("add file2", dir)

	sha2, err := SnapshotToVersionsBranch("feature/multi", "feature/multi--versions", "snapshot 2", dir)
	if err != nil {
		t.Fatalf("snapshot 2 error: %v", err)
	}

	if sha1 == sha2 {
		t.Error("different snapshots should have different SHAs")
	}
}

// ---------------------------------------------------------------------------
// CreateOrphanBranch
// ---------------------------------------------------------------------------

func TestCreateOrphanBranch(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	err := CreateOrphanBranch("orphan-test", defaultBranch, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !BranchExists("orphan-test", dir) {
		t.Error("orphan branch should exist")
	}

	// We should still be on the original branch
	current, _ := GetCurrentBranch(dir)
	if current != defaultBranch {
		t.Errorf("expected to remain on %s, but on %s", defaultBranch, current)
	}
}

// ---------------------------------------------------------------------------
// Trailers
// ---------------------------------------------------------------------------

func TestParseTrailers_Full(t *testing.T) {
	msg := `feat(auth): add login

Snapshot: S3
Diff: D2
Version: 3
Feature: auth
Action: update
Stack: D1v2,D2v3
Previous: S2
CleanSHA: abc123
Reverts: def456
ParentVersion: ghi789
Type: feature`

	trailers := ParseTrailers(msg)
	if trailers.Snapshot != "S3" {
		t.Errorf("Snapshot: got %q", trailers.Snapshot)
	}
	if trailers.Diff != "D2" {
		t.Errorf("Diff: got %q", trailers.Diff)
	}
	if trailers.Version != "3" {
		t.Errorf("Version: got %q", trailers.Version)
	}
	if trailers.Feature != "auth" {
		t.Errorf("Feature: got %q", trailers.Feature)
	}
	if trailers.Action != "update" {
		t.Errorf("Action: got %q", trailers.Action)
	}
	if trailers.Stack != "D1v2,D2v3" {
		t.Errorf("Stack: got %q", trailers.Stack)
	}
	if trailers.Previous != "S2" {
		t.Errorf("Previous: got %q", trailers.Previous)
	}
	if trailers.CleanSHA != "abc123" {
		t.Errorf("CleanSHA: got %q", trailers.CleanSHA)
	}
	if trailers.Reverts != "def456" {
		t.Errorf("Reverts: got %q", trailers.Reverts)
	}
	if trailers.ParentVersion != "ghi789" {
		t.Errorf("ParentVersion: got %q", trailers.ParentVersion)
	}
	if trailers.Type != "feature" {
		t.Errorf("Type: got %q", trailers.Type)
	}
}

func TestParseTrailers_Empty(t *testing.T) {
	trailers := ParseTrailers("")
	if trailers.Diff != "" {
		t.Error("expected empty diff")
	}
}

func TestParseTrailers_Partial(t *testing.T) {
	msg := "title\n\nDiff: D1\nFeature: auth"
	trailers := ParseTrailers(msg)
	if trailers.Diff != "D1" {
		t.Errorf("Diff: got %q", trailers.Diff)
	}
	if trailers.Feature != "auth" {
		t.Errorf("Feature: got %q", trailers.Feature)
	}
	if trailers.Version != "" {
		t.Errorf("Version should be empty, got %q", trailers.Version)
	}
}

func TestParseTrailers_Malformed(t *testing.T) {
	msg := "title\n\nNot a trailer\n:no key\nBad Key: value\n"
	trailers := ParseTrailers(msg)
	if trailers.Diff != "" || trailers.Feature != "" {
		t.Error("expected no trailers parsed from malformed input")
	}
}

func TestParseTrailers_NoColonSpace(t *testing.T) {
	msg := "title\n\nDiff:D1\nFeature:auth"
	trailers := ParseTrailers(msg)
	if trailers.Diff != "" {
		t.Error("trailers without ': ' separator should not parse")
	}
}

func TestParseTrailers_SpecialCharsInValue(t *testing.T) {
	msg := "title\n\nDiff: D1\nStack: D1v2,D2v1,D3v1"
	trailers := ParseTrailers(msg)
	if trailers.Stack != "D1v2,D2v1,D3v1" {
		t.Errorf("Stack: got %q", trailers.Stack)
	}
}

func TestFormatTrailers_Full(t *testing.T) {
	trailers := Trailers{
		Snapshot: "S1",
		Diff:     "D1",
		Version:  "1",
		Feature:  "auth",
		Action:   "create",
		Stack:    "D1v1",
		Type:     "feature",
	}
	result := FormatTrailers(trailers)
	if !strings.Contains(result, "Snapshot: S1") {
		t.Error("missing Snapshot trailer")
	}
	if !strings.Contains(result, "Diff: D1") {
		t.Error("missing Diff trailer")
	}
	if !strings.Contains(result, "Action: create") {
		t.Error("missing Action trailer")
	}
}

func TestFormatTrailers_Empty(t *testing.T) {
	trailers := Trailers{}
	result := FormatTrailers(trailers)
	if result != "" {
		t.Errorf("expected empty string, got %q", result)
	}
}

func TestFormatTrailers_Partial(t *testing.T) {
	trailers := Trailers{Diff: "D1"}
	result := FormatTrailers(trailers)
	if !strings.Contains(result, "Diff: D1") {
		t.Error("missing Diff trailer")
	}
	if strings.Contains(result, "Feature:") {
		t.Error("should not contain empty Feature trailer")
	}
}

func TestStripTrailers(t *testing.T) {
	msg := "title\n\nDiff: D1\nFeature: auth\nVersion: 1\nSnapshot: S1\nAction: create\nStack: D1v1\nType: feature"
	stripped := StripTrailers(msg)
	if strings.Contains(stripped, "Diff:") {
		t.Error("Diff trailer not stripped")
	}
	if strings.Contains(stripped, "Snapshot:") {
		t.Error("Snapshot trailer not stripped")
	}
	if strings.Contains(stripped, "Action:") {
		t.Error("Action trailer not stripped")
	}
	if !strings.Contains(stripped, "title") {
		t.Error("title should be preserved")
	}
}

func TestStripTrailers_NoTrailers(t *testing.T) {
	msg := "just a title\n\nbody text"
	stripped := StripTrailers(msg)
	if !strings.Contains(stripped, "just a title") {
		t.Error("title should be preserved")
	}
	if !strings.Contains(stripped, "body text") {
		t.Error("body should be preserved")
	}
}

func TestAppendTrailers(t *testing.T) {
	body := "fix(auth): login issue"
	trailers := Trailers{Diff: "D1", Feature: "auth", Action: "create"}
	result := AppendTrailers(body, trailers)
	if !strings.Contains(result, "fix(auth): login issue") {
		t.Error("body should be preserved")
	}
	if !strings.Contains(result, "Diff: D1") {
		t.Error("Diff trailer should be present")
	}
}

func TestAppendTrailers_ReplacesExisting(t *testing.T) {
	body := "title\n\nDiff: D1\nVersion: 1"
	trailers := Trailers{Diff: "D2", Version: "2"}
	result := AppendTrailers(body, trailers)
	if strings.Contains(result, "Diff: D1") {
		t.Error("old Diff trailer should be replaced")
	}
	if !strings.Contains(result, "Diff: D2") {
		t.Error("new Diff trailer should be present")
	}
}

func TestGetCommitTrailers(t *testing.T) {
	dir := initTestRepo(t)
	writeFile(t, dir, "file.txt", "content")
	_ = StageAll(dir)
	msg := "test commit\n\nDiff: D1\nFeature: test\nAction: create"
	sha, _ := Commit(msg, dir)

	trailers, err := GetCommitTrailers(sha, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if trailers.Diff != "D1" {
		t.Errorf("Diff: got %q", trailers.Diff)
	}
	if trailers.Feature != "test" {
		t.Errorf("Feature: got %q", trailers.Feature)
	}
	if trailers.Action != "create" {
		t.Errorf("Action: got %q", trailers.Action)
	}
}

// ---------------------------------------------------------------------------
// FindDiffCommits
// ---------------------------------------------------------------------------

func TestFindDiffCommits_Basic(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	_ = CreateBranch("feature/find", defaultBranch, dir)

	writeFile(t, dir, "d1.txt", "d1")
	_ = StageAll(dir)
	_, _ = Commit("feat: first diff\n\nDiff: D1\nFeature: find\nVersion: 1", dir)

	writeFile(t, dir, "d2.txt", "d2")
	_ = StageAll(dir)
	_, _ = Commit("feat: second diff\n\nDiff: D2\nFeature: find\nVersion: 1", dir)

	diffs, err := FindDiffCommits("feature/find", defaultBranch, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(diffs) != 2 {
		t.Fatalf("expected 2 diffs, got %d", len(diffs))
	}
	if diffs[0].Trailers.Diff != "D1" {
		t.Errorf("first diff should be D1, got %s", diffs[0].Trailers.Diff)
	}
	if diffs[1].Trailers.Diff != "D2" {
		t.Errorf("second diff should be D2, got %s", diffs[1].Trailers.Diff)
	}
}

func TestFindDiffCommits_Empty(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	diffs, err := FindDiffCommits(defaultBranch, defaultBranch, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(diffs) != 0 {
		t.Errorf("expected 0 diffs, got %d", len(diffs))
	}
}

func TestFindDiffCommits_MixedCommits(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)

	_ = CreateBranch("feature/mixed", defaultBranch, dir)

	writeFile(t, dir, "d1.txt", "d1")
	_ = StageAll(dir)
	_, _ = Commit("feat: with trailers\n\nDiff: D1\nFeature: mixed", dir)

	writeFile(t, dir, "other.txt", "no trailers")
	_ = StageAll(dir)
	_, _ = Commit("no trailers here", dir)

	writeFile(t, dir, "d2.txt", "d2")
	_ = StageAll(dir)
	_, _ = Commit("feat: another diff\n\nDiff: D2\nFeature: mixed", dir)

	diffs, err := FindDiffCommits("feature/mixed", defaultBranch, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(diffs) != 2 {
		t.Fatalf("expected 2 diffs (skipping non-trailer commit), got %d", len(diffs))
	}
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

func TestGetCommitsBetween(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := GetCurrentBranch(dir)
	baseSHA, _ := GetHeadSHA(dir)

	_ = CreateBranch("feature/between", defaultBranch, dir)
	writeFile(t, dir, "file1.txt", "1")
	_ = StageAll(dir)
	_, _ = Commit("commit 1", dir)
	writeFile(t, dir, "file2.txt", "2")
	_ = StageAll(dir)
	_, _ = Commit("commit 2", dir)

	commits, err := GetCommitsBetween(baseSHA, "feature/between", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(commits) != 2 {
		t.Errorf("expected 2 commits, got %d", len(commits))
	}
}

func TestGetRefSHA(t *testing.T) {
	dir := initTestRepo(t)
	sha, err := GetRefSHA("HEAD", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	headSHA, _ := GetHeadSHA(dir)
	if sha != headSHA {
		t.Errorf("expected %s, got %s", headSHA, sha)
	}
}

// ---------------------------------------------------------------------------
// IsGitRepo / IsInsideWorktree
// ---------------------------------------------------------------------------

func TestIsGitRepo(t *testing.T) {
	dir := initTestRepo(t)
	if !IsGitRepo(dir) {
		t.Error("should be a git repo")
	}
}

func TestIsGitRepo_NotRepo(t *testing.T) {
	dir := t.TempDir()
	if IsGitRepo(dir) {
		t.Error("should not be a git repo")
	}
}

func TestIsInsideWorktree(t *testing.T) {
	dir := initTestRepo(t)
	if !IsInsideWorktree(dir) {
		t.Error("should be inside worktree")
	}
}

// ---------------------------------------------------------------------------
// Error translation
// ---------------------------------------------------------------------------

func TestTranslateError_NotAGitRepo(t *testing.T) {
	result := translateError("fatal: not a git repository (or any parent directory)")
	if !strings.Contains(result, "Not inside a project directory") {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_AmbiguousArgument(t *testing.T) {
	result := translateError("fatal: ambiguous argument 'foobar'")
	if !strings.Contains(result, `Could not find reference "foobar"`) {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_PathspecNotMatch(t *testing.T) {
	result := translateError("error: pathspec 'myfile.txt' did not match any file(s)")
	if !strings.Contains(result, `File or branch "myfile.txt" does not exist`) {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_LocalChangesOverwritten(t *testing.T) {
	result := translateError("error: Your local changes to the following files would be overwritten by checkout:")
	if !strings.Contains(result, "You have unsaved changes that would be lost") {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_Conflict(t *testing.T) {
	result := translateError("CONFLICT (content): Merge conflict in main.go")
	if !strings.Contains(result, "Conflicting changes in main.go") {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_FailedPush(t *testing.T) {
	result := translateError("error: failed to push some refs to 'origin'")
	if !strings.Contains(result, "Could not push") {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_NoUpstream(t *testing.T) {
	result := translateError("fatal: The current branch feature/test has no upstream branch")
	if !strings.Contains(result, "This branch has not been pushed yet") {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_BadObject(t *testing.T) {
	result := translateError("fatal: bad object abc123")
	if !strings.Contains(result, "Could not find that commit") {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_NothingToCommit(t *testing.T) {
	result := translateError("nothing to commit, working tree clean")
	if !strings.Contains(result, "No changes to save") {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_JargonHEAD(t *testing.T) {
	result := translateError("HEAD is now at abc123")
	if strings.Contains(result, "HEAD") {
		t.Errorf("HEAD should be replaced: %s", result)
	}
	if !strings.Contains(result, "current commit") {
		t.Errorf("should contain 'current commit': %s", result)
	}
}

func TestTranslateError_UnrelatedHistories(t *testing.T) {
	result := translateError("fatal: refusing to merge unrelated histories")
	if !strings.Contains(result, "no common history") {
		t.Errorf("unexpected translation: %s", result)
	}
}

func TestTranslateError_PassThrough(t *testing.T) {
	msg := "some unknown error message"
	result := translateError(msg)
	if result != msg {
		t.Errorf("unrecognized errors should pass through, got: %s", result)
	}
}

// ---------------------------------------------------------------------------
// parseTrailerLine
// ---------------------------------------------------------------------------

func TestParseTrailerLine_Valid(t *testing.T) {
	k, v, ok := parseTrailerLine("Diff: D1")
	if !ok {
		t.Fatal("expected ok")
	}
	if k != "Diff" || v != "D1" {
		t.Errorf("got k=%q v=%q", k, v)
	}
}

func TestParseTrailerLine_Invalid_NoColon(t *testing.T) {
	_, _, ok := parseTrailerLine("no colon here")
	if ok {
		t.Error("expected not ok")
	}
}

func TestParseTrailerLine_Invalid_ColonNoSpace(t *testing.T) {
	_, _, ok := parseTrailerLine("Diff:D1")
	if ok {
		t.Error("expected not ok for missing space after colon")
	}
}

func TestParseTrailerLine_Invalid_SpecialCharsInKey(t *testing.T) {
	_, _, ok := parseTrailerLine("Bad Key: value")
	if ok {
		t.Error("expected not ok for key with spaces")
	}
}

func TestParseTrailerLine_Empty(t *testing.T) {
	_, _, ok := parseTrailerLine("")
	if ok {
		t.Error("expected not ok for empty string")
	}
}

// ---------------------------------------------------------------------------
// firstLine
// ---------------------------------------------------------------------------

func TestFirstLine_MultiLine(t *testing.T) {
	result := firstLine("first\nsecond\nthird")
	if result != "first" {
		t.Errorf("got %q", result)
	}
}

func TestFirstLine_SingleLine(t *testing.T) {
	result := firstLine("only line")
	if result != "only line" {
		t.Errorf("got %q", result)
	}
}

func TestFirstLine_Empty(t *testing.T) {
	result := firstLine("")
	if result != "" {
		t.Errorf("got %q", result)
	}
}
