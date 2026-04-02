package snapshot

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/git"
)

// commitAllowEmpty creates a commit in the given dir, allowing empty commits.
func commitAllowEmpty(message, dir string) (string, error) {
	cmd := exec.Command("git", "commit", "--allow-empty", "-m", message)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("commit failed: %s", strings.TrimSpace(string(out)))
	}
	return git.GetHeadSHA(dir)
}

// TakeOptions holds parameters for creating a snapshot.
type TakeOptions struct {
	CleanBranch    string
	VersionsBranch string
	Message        string
	Trailers       git.Trailers
	Cwd            string
}

// Take creates a snapshot of the clean branch's tree on the versions branch.
// Uses a git worktree to avoid disrupting the user's working tree.
// Returns the new snapshot commit SHA.
func Take(opts TakeOptions) (string, error) {
	cwd := opts.Cwd
	if cwd == "" {
		var err error
		cwd, err = os.Getwd()
		if err != nil {
			return "", fmt.Errorf("could not determine working directory: %w", err)
		}
	}

	// Build commit message with trailers
	message := opts.Message + git.FormatTrailers(opts.Trailers) + "\n"

	// Create temp dir for worktree
	tmpDir, err := os.MkdirTemp("", "devpod-snapshot-*")
	if err != nil {
		return "", fmt.Errorf("could not create temporary directory for snapshot: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Remove the temp dir so git worktree add can create it fresh
	os.Remove(tmpDir)

	// Check for stale worktree at this path
	git.CleanupStaleWorktrees(cwd)

	// Add worktree for the versions branch
	err = git.WorktreeAdd(tmpDir, opts.VersionsBranch, cwd)
	if err != nil {
		return "", fmt.Errorf("could not open versions branch for snapshot.\n\n  Ensure the versions branch exists, or run: devpod sync")
	}
	defer func() {
		_ = git.WorktreeRemove(tmpDir, cwd)
	}()

	// Nuclear clean: remove everything in the worktree except .git
	entries, err := os.ReadDir(tmpDir)
	if err != nil {
		return "", fmt.Errorf("could not read snapshot directory: %w", err)
	}
	for _, e := range entries {
		if e.Name() == ".git" {
			continue
		}
		os.RemoveAll(filepath.Join(tmpDir, e.Name()))
	}

	// Also clear the git index
	_, _ = git.Run("rm -rf .", tmpDir)

	// Copy full tree from clean branch
	_, err = git.Run(fmt.Sprintf("checkout %s -- .", opts.CleanBranch), tmpDir)
	if err != nil {
		return "", fmt.Errorf("could not copy files from working branch to snapshot.\n\n  Ensure your branch is in a good state.")
	}

	// Stage everything
	err = git.StageAll(tmpDir)
	if err != nil {
		return "", fmt.Errorf("could not stage snapshot files: %w", err)
	}

	// Always create a commit for the snapshot record (even if tree is identical).
	// Use --allow-empty so the operation is recorded with its trailers.
	sha, err := commitAllowEmpty(message, tmpDir)
	if err != nil {
		return "", fmt.Errorf("could not save snapshot: %w", err)
	}

	return sha, nil
}

// Compare returns a diff between two snapshots.
func Compare(sha1, sha2 string, cwd ...string) (string, error) {
	c := ""
	if len(cwd) > 0 {
		c = cwd[0]
	}
	return git.Run(fmt.Sprintf("diff %s..%s", sha1, sha2), c)
}

// CompareFiles returns a diff between two snapshots filtered to specific files.
func CompareFiles(sha1, sha2 string, files []string, cwd ...string) (string, error) {
	if len(files) == 0 {
		return Compare(sha1, sha2, cwd...)
	}
	c := ""
	if len(cwd) > 0 {
		c = cwd[0]
	}
	args := fmt.Sprintf("diff %s..%s -- %s", sha1, sha2, strings.Join(files, " "))
	return git.Run(args, c)
}

// Info holds parsed information about a snapshot on the versions branch.
type Info struct {
	SHA      string
	ID       string // S1, S2, etc.
	Diff     string // D1, D2, etc. (empty for sync)
	Version  int
	Action   string // create, update, sync, land, undo
	Stack    string // D1v2,D2v1,D3v1
	Previous string
	Message  string
	Date     string
}

// ListSnapshots parses the versions branch log for snapshot metadata.
func ListSnapshots(versionsBranch string, cwd ...string) ([]Info, error) {
	c := ""
	if len(cwd) > 0 {
		c = cwd[0]
	}

	if !git.BranchExists(versionsBranch, c) {
		return nil, fmt.Errorf("versions branch %s does not exist", versionsBranch)
	}

	// Use a delimiter that won't appear in normal commit data
	delim := "---SNAP_DELIM---"
	format := fmt.Sprintf("log %s --format=%%H%s%%s%s%%b%s%%ci", versionsBranch, delim, delim, delim)
	output, err := git.Run(format, c)
	if err != nil || output == "" {
		return nil, err
	}

	var snapshots []Info
	for _, line := range strings.Split(output, "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, delim, 4)
		if len(parts) < 2 {
			continue
		}
		sha := parts[0]
		subject := parts[1]
		body := ""
		date := ""
		if len(parts) > 2 {
			body = parts[2]
		}
		if len(parts) > 3 {
			date = parts[3]
		}

		// Parse trailers from subject + body
		trailers := git.ParseTrailers(subject + "\n" + body)

		version := 0
		if trailers.Version != "" {
			v, err := strconv.Atoi(trailers.Version)
			if err == nil {
				version = v
			}
		}

		info := Info{
			SHA:      sha,
			ID:       trailers.Snapshot,
			Diff:     trailers.Diff,
			Version:  version,
			Action:   trailers.Action,
			Stack:    trailers.Stack,
			Previous: trailers.Previous,
			Message:  subject,
			Date:     date,
		}
		snapshots = append(snapshots, info)
	}
	return snapshots, nil
}
