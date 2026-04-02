package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// setupTestRepo creates a temp repo with main branch + initial commit.
func setupTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	mustExec(t, dir, "git", "init")
	mustExec(t, dir, "git", "config", "user.email", "test@devpod.test")
	mustExec(t, dir, "git", "config", "user.name", "Test User")
	mustExec(t, dir, "git", "checkout", "-b", "main")
	writeTestFile(t, dir, "README.md", "# test project")
	mustExec(t, dir, "git", "add", "-A")
	mustExec(t, dir, "git", "commit", "-m", "initial commit")

	// Set up .devpod directory
	_ = workspace.EnsureDevpodDir(dir)

	return dir
}

// setupTestRepoWithRemote creates a repo with a bare remote for push/pull testing.
func setupTestRepoWithRemote(t *testing.T) (string, string) {
	t.Helper()
	bareDir := t.TempDir()
	mustExec(t, bareDir, "git", "init", "--bare")

	workDir := t.TempDir()
	mustExec(t, workDir, "git", "clone", bareDir, ".")
	mustExec(t, workDir, "git", "config", "user.email", "test@devpod.test")
	mustExec(t, workDir, "git", "config", "user.name", "Test User")
	mustExec(t, workDir, "git", "checkout", "-b", "main")
	writeTestFile(t, workDir, "README.md", "# test project")
	mustExec(t, workDir, "git", "add", "-A")
	mustExec(t, workDir, "git", "commit", "-m", "initial commit")
	mustExec(t, workDir, "git", "push", "-u", "origin", "main")

	_ = workspace.EnsureDevpodDir(workDir)
	return workDir, bareDir
}

// commitFile creates a file and commits it, returning the SHA.
func commitFile(t *testing.T, dir, path, content, message string) string {
	t.Helper()
	writeTestFile(t, dir, path, content)
	mustExec(t, dir, "git", "add", "-A")
	sha := mustExec(t, dir, "git", "commit", "-m", message)
	headSHA := mustExec(t, dir, "git", "rev-parse", "HEAD")
	_ = sha
	return strings.TrimSpace(headSHA)
}

// createFeature sets up a feature branch with metadata.
func createFeature(t *testing.T, dir, name string, changeType workspace.ChangeType) *workspace.FeatureData {
	t.Helper()
	slug := workspace.Slugify(name)
	prefix := string(changeType)
	if changeType == "unknown" {
		prefix = "feature"
	}
	branch := prefix + "/" + slug
	vb := workspace.VersionsBranchName(branch)

	mustExec(t, dir, "git", "checkout", "-b", branch, "main")

	feature := workspace.FeatureData{
		Name:           name,
		Type:           changeType,
		Slug:           slug,
		Branch:         branch,
		VersionsBranch: vb,
		Created:        time.Now().UTC().Format(time.RFC3339),
		Diffs:          []string{},
		Status:         "active",
		SnapshotCount:  0,
	}

	if err := workspace.SaveFeature(feature, dir); err != nil {
		t.Fatalf("save feature: %v", err)
	}

	return &feature
}

// addDiff creates a diff by writing a file, staging, and committing with trailers.
func addDiff(t *testing.T, dir string, feature *workspace.FeatureData, position int, fileName, content, title string) *workspace.DiffData {
	t.Helper()
	writeTestFile(t, dir, fileName, content)
	mustExec(t, dir, "git", "add", "-A")

	diffID := formatDiffID(position)
	trailers := git.Trailers{
		Diff:    diffID,
		Version: "1",
		Feature: feature.Slug,
		Type:    string(feature.Type),
	}
	commitMsg := git.AppendTrailers(title, trailers)
	sha := mustExec(t, dir, "git", "commit", "-m", commitMsg)
	_ = sha
	headSHA := strings.TrimSpace(mustExec(t, dir, "git", "rev-parse", "HEAD"))

	uuid := workspace.GenerateDiffUUID()
	diff := workspace.DiffData{
		ID:       diffID,
		UUID:     uuid,
		Feature:  feature.Slug,
		Commit:   headSHA,
		Position: position,
		Title:    title,
		Type:     feature.Type,
		Files:    []string{fileName},
		Version:  1,
		Status:   "draft",
		Created:  time.Now().UTC().Format(time.RFC3339),
		Updated:  time.Now().UTC().Format(time.RFC3339),
	}
	_ = workspace.SaveDiff(diff, dir)
	feature.Diffs = append(feature.Diffs, uuid)
	_ = workspace.SaveFeature(*feature, dir)

	return &diff
}

func formatDiffID(pos int) string {
	return fmt.Sprintf("D%d", pos)
}

func mustExec(t *testing.T, dir string, name string, args ...string) string {
	t.Helper()
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("command %s %v failed: %v\n%s", name, args, err, string(out))
	}
	return strings.TrimSpace(string(out))
}

func writeTestFile(t *testing.T, dir, name, content string) {
	t.Helper()
	fullPath := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(fullPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func readTestFile(t *testing.T, dir, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return string(data)
}

func currentBranch(t *testing.T, dir string) string {
	t.Helper()
	return strings.TrimSpace(mustExec(t, dir, "git", "rev-parse", "--abbrev-ref", "HEAD"))
}

func headSHA(t *testing.T, dir string) string {
	t.Helper()
	return strings.TrimSpace(mustExec(t, dir, "git", "rev-parse", "HEAD"))
}

func isClean(t *testing.T, dir string) bool {
	t.Helper()
	out := mustExec(t, dir, "git", "status", "--porcelain")
	return strings.TrimSpace(out) == ""
}

func branchExists(t *testing.T, dir, name string) bool {
	t.Helper()
	cmd := exec.Command("git", "rev-parse", "--verify", name)
	cmd.Dir = dir
	return cmd.Run() == nil
}

func commitCount(t *testing.T, dir, base, head string) int {
	t.Helper()
	out := mustExec(t, dir, "git", "rev-list", "--count", base+".."+head)
	n := 0
	for _, c := range strings.TrimSpace(out) {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		}
	}
	return n
}

func loadFeatureFromDisk(t *testing.T, dir, slug string) *workspace.FeatureData {
	t.Helper()
	f, err := workspace.LoadFeature(slug, dir)
	if err != nil {
		t.Fatalf("load feature %s: %v", slug, err)
	}
	return f
}

func init() {
	// Ensure formatDiffID works for positions 1-9
	_ = formatDiffID(1)
}
