package rebase

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

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

// createCommitReturningsha creates a file, stages, commits, and returns SHA.
func createCommit(t *testing.T, dir, filename, content, message string) string {
	t.Helper()
	writeFile(t, dir, filename, content)
	_ = git.StageAll(dir)
	sha, err := git.Commit(message, dir)
	if err != nil {
		t.Fatalf("commit failed: %v", err)
	}
	return sha
}

// ---------------------------------------------------------------------------
// ReplayStack
// ---------------------------------------------------------------------------

func TestReplayStack_Empty(t *testing.T) {
	dir := initTestRepo(t)
	err := ReplayStack(ReplayOptions{
		CommitsAbove: []string{},
		Cwd:          dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestReplayStack_SingleCommit(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	// Create a side branch with a commit
	_ = git.CreateBranch("side", defaultBranch, dir)
	sha := createCommit(t, dir, "side.txt", "side content", "side commit")

	// Switch back to default and replay
	_ = git.SwitchBranch(defaultBranch, dir)

	err := ReplayStack(ReplayOptions{
		CommitsAbove: []string{sha},
		Cwd:          dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify file exists
	if _, err := os.Stat(filepath.Join(dir, "side.txt")); os.IsNotExist(err) {
		t.Error("side.txt should exist after replay")
	}
}

func TestReplayStack_MultipleCommits(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	_ = git.CreateBranch("side", defaultBranch, dir)
	sha1 := createCommit(t, dir, "file1.txt", "1", "commit 1")
	sha2 := createCommit(t, dir, "file2.txt", "2", "commit 2")
	sha3 := createCommit(t, dir, "file3.txt", "3", "commit 3")

	_ = git.SwitchBranch(defaultBranch, dir)

	err := ReplayStack(ReplayOptions{
		CommitsAbove: []string{sha1, sha2, sha3},
		Cwd:          dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify all files exist
	for _, f := range []string{"file1.txt", "file2.txt", "file3.txt"} {
		if _, err := os.Stat(filepath.Join(dir, f)); os.IsNotExist(err) {
			t.Errorf("%s should exist after replay", f)
		}
	}
}

func TestReplayStack_ConflictInFirst(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	// Create conflicting content on default branch
	writeFile(t, dir, "conflict.txt", "line1\nline2\nline3\n")
	_ = git.StageAll(dir)
	_, _ = git.Commit("base content", dir)

	// Create side branch with different content
	_ = git.CreateBranch("side", defaultBranch, dir)
	writeFile(t, dir, "conflict.txt", "line1\nCHANGED_SIDE\nline3\n")
	_ = git.StageAll(dir)
	sha, _ := git.Commit("side change\n\nDiff: D2", dir)

	// Go back and change the same line on default
	_ = git.SwitchBranch(defaultBranch, dir)
	writeFile(t, dir, "conflict.txt", "line1\nCHANGED_MAIN\nline3\n")
	_ = git.StageAll(dir)
	_, _ = git.Commit("main change", dir)

	err := ReplayStack(ReplayOptions{
		CommitsAbove: []string{sha},
		Cwd:          dir,
	})
	if err == nil {
		t.Fatal("expected conflict error")
	}
	if !IsConflictError(err) {
		t.Fatalf("expected ConflictError, got: %T %v", err, err)
	}

	conflictErr := err.(*ConflictError)
	if len(conflictErr.ConflictFiles) == 0 {
		t.Error("expected conflict files to be listed")
	}
	if conflictErr.ConflictFiles[0] != "conflict.txt" {
		t.Errorf("expected conflict.txt, got %s", conflictErr.ConflictFiles[0])
	}
}

func TestReplayStack_ConflictInMiddle(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	// Set up base
	writeFile(t, dir, "conflict.txt", "original\n")
	_ = git.StageAll(dir)
	_, _ = git.Commit("base", dir)

	// Side branch with multiple commits
	_ = git.CreateBranch("side", defaultBranch, dir)
	sha1 := createCommit(t, dir, "ok1.txt", "ok1", "ok commit 1")

	writeFile(t, dir, "conflict.txt", "side changed\n")
	_ = git.StageAll(dir)
	sha2, _ := git.Commit("conflict commit\n\nDiff: D3", dir)

	sha3 := createCommit(t, dir, "ok2.txt", "ok2", "ok commit 3")

	// Change same file on default branch
	_ = git.SwitchBranch(defaultBranch, dir)
	writeFile(t, dir, "conflict.txt", "main changed\n")
	_ = git.StageAll(dir)
	_, _ = git.Commit("main conflict change", dir)

	err := ReplayStack(ReplayOptions{
		CommitsAbove: []string{sha1, sha2, sha3},
		Cwd:          dir,
	})
	if err == nil {
		t.Fatal("expected conflict error")
	}
	if !IsConflictError(err) {
		t.Fatalf("expected ConflictError, got: %T", err)
	}

	// Verify sha1 was applied
	if _, statErr := os.Stat(filepath.Join(dir, "ok1.txt")); os.IsNotExist(statErr) {
		t.Error("ok1.txt should exist (first commit applied)")
	}
}

func TestReplayStack_ConflictErrorMessage(t *testing.T) {
	err := &ConflictError{
		DiffID:        "D2",
		ConflictFiles: []string{"main.go", "config.yaml"},
		Message:       "",
	}
	// Should generate from fields when Message is empty
	errMsg := err.Error()
	if !strings.Contains(errMsg, "main.go") {
		t.Error("error should mention conflict file")
	}
	if !strings.Contains(errMsg, "D2") {
		t.Error("error should mention diff ID")
	}
	if !strings.Contains(errMsg, "--continue") {
		t.Error("error should suggest --continue")
	}
	if !strings.Contains(errMsg, "--abort") {
		t.Error("error should suggest --abort")
	}
}

func TestConflictError_CustomMessage(t *testing.T) {
	err := &ConflictError{
		Message: "Custom conflict message",
	}
	if err.Error() != "Custom conflict message" {
		t.Errorf("expected custom message, got: %s", err.Error())
	}
}

func TestConflictError_EmptyFields(t *testing.T) {
	err := &ConflictError{}
	msg := err.Error()
	if msg == "" {
		t.Error("error message should not be empty")
	}
	if !strings.Contains(msg, "Conflicting changes") {
		t.Errorf("default message should mention conflicts: %s", msg)
	}
}

func TestIsConflictError(t *testing.T) {
	var err error = &ConflictError{Message: "test"}
	if !IsConflictError(err) {
		t.Error("should recognize ConflictError")
	}

	err = nil
	if IsConflictError(err) {
		t.Error("nil should not be ConflictError")
	}
}

// ---------------------------------------------------------------------------
// AbortReplay
// ---------------------------------------------------------------------------

func TestAbortReplay(t *testing.T) {
	dir := initTestRepo(t)

	// Get current SHA
	headBefore, _ := git.GetHeadSHA(dir)

	// Make a change
	createCommit(t, dir, "change.txt", "content", "some change")
	headAfter, _ := git.GetHeadSHA(dir)
	if headBefore == headAfter {
		t.Fatal("head should have changed")
	}

	// Abort (reset to before)
	err := AbortReplay(headBefore, dir)
	if err != nil {
		t.Fatalf("abort error: %v", err)
	}

	headNow, _ := git.GetHeadSHA(dir)
	if headNow != headBefore {
		t.Error("HEAD should be restored to pre-edit state")
	}
}

func TestAbortReplay_InvalidSHA(t *testing.T) {
	dir := initTestRepo(t)
	err := AbortReplay("invalid-sha-000", dir)
	if err == nil {
		t.Error("expected error for invalid SHA")
	}
}

// ---------------------------------------------------------------------------
// ContinueReplay
// ---------------------------------------------------------------------------

func TestContinueReplay_AfterConflictResolution(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	// Set up a conflict scenario
	writeFile(t, dir, "conflict.txt", "line1\noriginal\nline3\n")
	_ = git.StageAll(dir)
	_, _ = git.Commit("base content", dir)

	// Create side branch with conflicting change
	_ = git.CreateBranch("side", defaultBranch, dir)
	writeFile(t, dir, "conflict.txt", "line1\nside-change\nline3\n")
	_ = git.StageAll(dir)
	sha, _ := git.Commit("side change", dir)

	// Go back and make a different change
	_ = git.SwitchBranch(defaultBranch, dir)
	writeFile(t, dir, "conflict.txt", "line1\nmain-change\nline3\n")
	_ = git.StageAll(dir)
	_, _ = git.Commit("main change", dir)

	// Try cherry-pick (will conflict)
	_ = git.CherryPick(sha, dir)

	// Simulate user resolving the conflict
	writeFile(t, dir, "conflict.txt", "line1\nresolved\nline3\n")

	// Continue
	err := ContinueReplay(dir)
	if err != nil {
		t.Fatalf("continue error: %v", err)
	}

	// Verify resolved content
	content, _ := os.ReadFile(filepath.Join(dir, "conflict.txt"))
	if !strings.Contains(string(content), "resolved") {
		t.Errorf("content should be resolved, got: %s", string(content))
	}
}

// ---------------------------------------------------------------------------
// Replay with many commits
// ---------------------------------------------------------------------------

func TestReplayStack_TenCommits(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	_ = git.CreateBranch("side", defaultBranch, dir)

	var shas []string
	for i := 0; i < 10; i++ {
		sha := createCommit(t, dir, filepath.Join("dir", strings.Repeat("a", i+1)+".txt"), "content", "commit")
		shas = append(shas, sha)
	}

	_ = git.SwitchBranch(defaultBranch, dir)

	err := ReplayStack(ReplayOptions{
		CommitsAbove: shas,
		Cwd:          dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify all 10 files
	for i := 0; i < 10; i++ {
		path := filepath.Join(dir, "dir", strings.Repeat("a", i+1)+".txt")
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Errorf("file %d should exist", i)
		}
	}
}

// ---------------------------------------------------------------------------
// Replay preserves commit messages
// ---------------------------------------------------------------------------

func TestReplayStack_PreservesMessages(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	_ = git.CreateBranch("side", defaultBranch, dir)
	sha := createCommit(t, dir, "msg-test.txt", "content", "specific commit message\n\nDiff: D1\nFeature: test")

	_ = git.SwitchBranch(defaultBranch, dir)

	err := ReplayStack(ReplayOptions{
		CommitsAbove: []string{sha},
		Cwd:          dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	headSHA, _ := git.GetHeadSHA(dir)
	msg, _ := git.GetCommitMessage(headSHA, dir)
	if !strings.Contains(msg, "specific commit message") {
		t.Errorf("commit message not preserved: %s", msg)
	}
}

// ---------------------------------------------------------------------------
// ReplayStack error with no conflicts (non-conflict failure)
// ---------------------------------------------------------------------------

func TestReplayStack_InvalidSHA(t *testing.T) {
	dir := initTestRepo(t)
	err := ReplayStack(ReplayOptions{
		CommitsAbove: []string{"0000000000000000000000000000000000000000"},
		Cwd:          dir,
	})
	if err == nil {
		t.Error("expected error for invalid SHA")
	}
}

// ---------------------------------------------------------------------------
// Integration: full edit-replay-abort cycle
// ---------------------------------------------------------------------------

func TestFullEditReplayAbortCycle(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	// Build a stack of 3 commits
	_ = git.CreateBranch("feature/cycle", defaultBranch, dir)
	sha1 := createCommit(t, dir, "d1.txt", "d1 original", "D1 commit\n\nDiff: D1")
	sha2 := createCommit(t, dir, "d2.txt", "d2 original", "D2 commit\n\nDiff: D2")
	sha3 := createCommit(t, dir, "d3.txt", "d3 original", "D3 commit\n\nDiff: D3")

	_ = sha1
	headBefore, _ := git.GetHeadSHA(dir)

	// Simulate editing D1: reset to D1's position, make changes
	mustRun(t, dir, "git", "reset", "--hard", sha1)
	writeFile(t, dir, "d1.txt", "d1 EDITED")
	_ = git.StageAll(dir)
	_, _ = git.Amend("D1 commit edited\n\nDiff: D1", dir)

	// Replay D2 and D3
	err := ReplayStack(ReplayOptions{
		CommitsAbove: []string{sha2, sha3},
		Cwd:          dir,
	})
	if err != nil {
		t.Fatalf("replay error: %v", err)
	}

	// Verify all files exist with correct content
	d1Content, _ := os.ReadFile(filepath.Join(dir, "d1.txt"))
	if string(d1Content) != "d1 EDITED" {
		t.Errorf("d1.txt should be edited, got: %s", string(d1Content))
	}

	for _, f := range []string{"d2.txt", "d3.txt"} {
		if _, err := os.Stat(filepath.Join(dir, f)); os.IsNotExist(err) {
			t.Errorf("%s should exist after replay", f)
		}
	}

	// Now abort to go back
	err = AbortReplay(headBefore, dir)
	if err != nil {
		t.Fatalf("abort error: %v", err)
	}

	headAfter, _ := git.GetHeadSHA(dir)
	if headAfter != headBefore {
		t.Error("abort should restore original HEAD")
	}
}
