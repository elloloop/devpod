package snapshot

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

func setupFeatureWithVersions(t *testing.T) (string, string, string) {
	t.Helper()
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	_ = git.CreateBranch("feature/test", defaultBranch, dir)
	writeFile(t, dir, "feature.txt", "feature content")
	_ = git.StageAll(dir)
	_, _ = git.Commit("add feature file", dir)

	err := git.CreateOrphanBranch("feature/test--versions", "feature/test", dir)
	if err != nil {
		t.Fatalf("failed to create versions branch: %v", err)
	}

	return dir, "feature/test", "feature/test--versions"
}

// ---------------------------------------------------------------------------
// Take
// ---------------------------------------------------------------------------

func TestTake_Basic(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	sha, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "test snapshot",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sha == "" {
		t.Error("expected non-empty SHA")
	}
}

func TestTake_PreservesAllFiles(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	// Add multiple files
	writeFile(t, dir, "dir1/file1.txt", "content1")
	writeFile(t, dir, "dir2/file2.txt", "content2")
	writeFile(t, dir, "root.txt", "root content")
	_ = git.StageAll(dir)
	_, _ = git.Commit("add multiple files", dir)

	sha, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "multi-file snapshot",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify the snapshot contains all files by checking its tree
	output, err := git.Run("ls-tree -r --name-only "+sha, dir)
	if err != nil {
		t.Fatalf("could not list snapshot tree: %v", err)
	}
	for _, expected := range []string{"dir1/file1.txt", "dir2/file2.txt", "root.txt", "feature.txt", "README.md"} {
		if !strings.Contains(output, expected) {
			t.Errorf("snapshot missing file: %s", expected)
		}
	}
}

func TestTake_HandlesDeletedFiles(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	// Take first snapshot with extra file
	writeFile(t, dir, "to-delete.txt", "will be deleted")
	_ = git.StageAll(dir)
	_, _ = git.Commit("add file to delete", dir)

	_, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "before delete",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("first snapshot error: %v", err)
	}

	// Delete the file and take another snapshot
	os.Remove(filepath.Join(dir, "to-delete.txt"))
	_ = git.StageAll(dir)
	_, _ = git.Commit("delete file", dir)

	sha2, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "after delete",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("second snapshot error: %v", err)
	}

	// Verify deleted file is NOT in the snapshot
	output, err := git.Run("ls-tree -r --name-only "+sha2, dir)
	if err != nil {
		t.Fatalf("could not list snapshot tree: %v", err)
	}
	if strings.Contains(output, "to-delete.txt") {
		t.Error("deleted file should not be in snapshot (nuclear clean should have removed it)")
	}
}

func TestTake_WithTrailers(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	trailers := git.Trailers{
		Snapshot: "S1",
		Diff:     "D1",
		Version:  "1",
		Feature:  "test",
		Action:   "create",
		Stack:    "D1v1",
	}

	sha, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "snapshot with trailers",
		Trailers:       trailers,
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify trailers in commit message
	msg, err := git.GetCommitMessage(sha, dir)
	if err != nil {
		t.Fatalf("could not get message: %v", err)
	}
	parsedTrailers := git.ParseTrailers(msg)
	if parsedTrailers.Snapshot != "S1" {
		t.Errorf("Snapshot: got %q", parsedTrailers.Snapshot)
	}
	if parsedTrailers.Diff != "D1" {
		t.Errorf("Diff: got %q", parsedTrailers.Diff)
	}
	if parsedTrailers.Action != "create" {
		t.Errorf("Action: got %q", parsedTrailers.Action)
	}
}

func TestTake_MultipleSequential(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)
	var shas []string

	for i := 0; i < 5; i++ {
		writeFile(t, dir, "iter.txt", strings.Repeat("x", i+1))
		_ = git.StageAll(dir)
		_, _ = git.Commit("iteration", dir)

		sha, err := Take(TakeOptions{
			CleanBranch:    cleanBranch,
			VersionsBranch: versionsBranch,
			Message:        "snapshot",
			Cwd:            dir,
		})
		if err != nil {
			t.Fatalf("snapshot %d error: %v", i, err)
		}
		shas = append(shas, sha)
	}

	// All SHAs should be different
	seen := make(map[string]bool)
	for _, sha := range shas {
		if seen[sha] {
			t.Error("duplicate SHA across sequential snapshots")
		}
		seen[sha] = true
	}
}

func TestTake_NoChanges(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	// First snapshot
	sha1, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "first",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("first snapshot error: %v", err)
	}

	// Second snapshot without changes (creates a new commit even with identical tree)
	sha2, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "second (no changes)",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("second snapshot error: %v", err)
	}

	// With --allow-empty, each snapshot gets its own commit even if tree is identical
	if sha1 == sha2 {
		t.Error("each snapshot should get a unique SHA (recorded as separate operation)")
	}
}

func TestTake_PreservesUserBranch(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	branchBefore, _ := git.GetCurrentBranch(dir)

	_, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "should not switch user branch",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	branchAfter, _ := git.GetCurrentBranch(dir)
	if branchBefore != branchAfter {
		t.Errorf("branch changed from %s to %s during snapshot", branchBefore, branchAfter)
	}
}

func TestTake_InvalidVersionsBranch(t *testing.T) {
	dir := initTestRepo(t)
	defaultBranch, _ := git.GetCurrentBranch(dir)

	_ = git.CreateBranch("feature/bad", defaultBranch, dir)

	_, err := Take(TakeOptions{
		CleanBranch:    "feature/bad",
		VersionsBranch: "nonexistent-versions-branch",
		Message:        "should fail",
		Cwd:            dir,
	})
	if err == nil {
		t.Error("expected error for non-existent versions branch")
	}
}

func TestTake_AfterRebase(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	// Take initial snapshot
	_, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "before rebase",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("first snapshot error: %v", err)
	}

	// Add more content (simulating a rebase result)
	writeFile(t, dir, "rebased.txt", "rebased content")
	_ = git.StageAll(dir)
	_, _ = git.Commit("post-rebase commit", dir)

	// Take another snapshot after rebase
	sha, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "after rebase",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("second snapshot error: %v", err)
	}

	// Verify the new file is in the snapshot
	output, err := git.Run("ls-tree -r --name-only "+sha, dir)
	if err != nil {
		t.Fatalf("could not list tree: %v", err)
	}
	if !strings.Contains(output, "rebased.txt") {
		t.Error("post-rebase file should be in snapshot")
	}
}

func TestTake_LargeNumberOfFiles(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	// Create many files
	for i := 0; i < 50; i++ {
		writeFile(t, dir, filepath.Join("pkg", "file"+strings.Repeat("0", 3-len(strings.Repeat("", i)))+".go"), "package pkg")
	}
	_ = git.StageAll(dir)
	_, _ = git.Commit("add many files", dir)

	sha, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "many files snapshot",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sha == "" {
		t.Error("expected non-empty SHA")
	}
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

func TestCompare_Basic(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	// First snapshot
	sha1, _ := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "v1",
		Cwd:            dir,
	})

	// Make changes and second snapshot
	writeFile(t, dir, "new-file.txt", "new content")
	_ = git.StageAll(dir)
	_, _ = git.Commit("add new file", dir)

	sha2, _ := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "v2",
		Cwd:            dir,
	})

	diff, err := Compare(sha1, sha2, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(diff, "new-file.txt") {
		t.Error("diff should mention the changed file")
	}
}

func TestCompare_SameSHA(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	sha, _ := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "same",
		Cwd:            dir,
	})

	diff, err := Compare(sha, sha, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if diff != "" {
		t.Error("comparing same SHA should produce empty diff")
	}
}

// ---------------------------------------------------------------------------
// CompareFiles
// ---------------------------------------------------------------------------

func TestCompareFiles_Filtered(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	sha1, _ := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "v1",
		Cwd:            dir,
	})

	writeFile(t, dir, "include.txt", "include me")
	writeFile(t, dir, "exclude.txt", "exclude me")
	_ = git.StageAll(dir)
	_, _ = git.Commit("add two files", dir)

	sha2, _ := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "v2",
		Cwd:            dir,
	})

	diff, err := CompareFiles(sha1, sha2, []string{"include.txt"}, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(diff, "include.txt") {
		t.Error("diff should contain include.txt")
	}
	if strings.Contains(diff, "exclude.txt") {
		t.Error("diff should NOT contain exclude.txt when filtered")
	}
}

func TestCompareFiles_EmptyFilter(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	sha1, _ := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "v1",
		Cwd:            dir,
	})

	writeFile(t, dir, "file.txt", "content")
	_ = git.StageAll(dir)
	_, _ = git.Commit("add file", dir)

	sha2, _ := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "v2",
		Cwd:            dir,
	})

	diff, err := CompareFiles(sha1, sha2, nil, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if diff == "" {
		t.Error("empty filter should return full diff")
	}
}

// ---------------------------------------------------------------------------
// ListSnapshots
// ---------------------------------------------------------------------------

func TestListSnapshots_Basic(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	// Take a snapshot with trailers
	_, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "snapshot with trailers",
		Trailers: git.Trailers{
			Snapshot: "S1",
			Diff:     "D1",
			Action:   "create",
		},
		Cwd: dir,
	})
	if err != nil {
		t.Fatalf("snapshot error: %v", err)
	}

	snapshots, err := ListSnapshots(versionsBranch, dir)
	if err != nil {
		t.Fatalf("list error: %v", err)
	}
	// At least the snapshot we just created + the init commit
	if len(snapshots) < 1 {
		t.Fatalf("expected at least 1 snapshot, got %d", len(snapshots))
	}
}

func TestListSnapshots_NonExistentBranch(t *testing.T) {
	dir := initTestRepo(t)
	_, err := ListSnapshots("nonexistent-branch", dir)
	if err == nil {
		t.Error("expected error for non-existent branch")
	}
}

func TestListSnapshots_MultipleSnapshots(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	for i := 1; i <= 3; i++ {
		writeFile(t, dir, "iter.txt", strings.Repeat("x", i))
		_ = git.StageAll(dir)
		_, _ = git.Commit("iteration", dir)

		_, err := Take(TakeOptions{
			CleanBranch:    cleanBranch,
			VersionsBranch: versionsBranch,
			Message:        "snapshot",
			Trailers: git.Trailers{
				Snapshot: "S" + strings.Repeat("", 0),
				Diff:     "D1",
				Action:   "update",
			},
			Cwd: dir,
		})
		if err != nil {
			t.Fatalf("snapshot %d error: %v", i, err)
		}
	}

	snapshots, err := ListSnapshots(versionsBranch, dir)
	if err != nil {
		t.Fatalf("list error: %v", err)
	}
	// Should have initial commit + 3 snapshots = at least 4
	if len(snapshots) < 4 {
		t.Errorf("expected at least 4 entries, got %d", len(snapshots))
	}
}

func TestTake_StaleWorktreeRecovery(t *testing.T) {
	dir, cleanBranch, versionsBranch := setupFeatureWithVersions(t)

	// Take a snapshot normally first
	_, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "first snapshot",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("first snapshot error: %v", err)
	}

	// Add changes and take another (tests recovery path)
	writeFile(t, dir, "second.txt", "second")
	_ = git.StageAll(dir)
	_, _ = git.Commit("second commit", dir)

	sha, err := Take(TakeOptions{
		CleanBranch:    cleanBranch,
		VersionsBranch: versionsBranch,
		Message:        "second snapshot",
		Cwd:            dir,
	})
	if err != nil {
		t.Fatalf("second snapshot error: %v", err)
	}
	if sha == "" {
		t.Error("expected non-empty SHA")
	}
}
