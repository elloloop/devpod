package git

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

// ---------------------------------------------------------------------------
// Error translation — convert git jargon into plain language
// ---------------------------------------------------------------------------

var errorTranslations = []struct {
	pattern     *regexp.Regexp
	replacement string
}{
	{regexp.MustCompile(`(?i)fatal: not a git repository.*`), "Not inside a project directory."},
	{regexp.MustCompile(`(?i)fatal: ambiguous argument '([^']+)'`), `Could not find reference "$1".`},
	{regexp.MustCompile(`(?i)error: pathspec '([^']+)' did not match`), `File or branch "$1" does not exist.`},
	{regexp.MustCompile(`(?i)error: Your local changes to the following files would be overwritten`), "You have unsaved changes that would be lost."},
	{regexp.MustCompile(`CONFLICT \(content\): Merge conflict in (.+)`), "Conflicting changes in $1."},
	{regexp.MustCompile(`(?i)error: could not apply .+`), "Could not apply the changes — there are conflicting edits."},
	{regexp.MustCompile(`(?i)fatal: refusing to merge unrelated histories`), "These branches have no common history."},
	{regexp.MustCompile(`(?i)fatal: '([^']+)' does not appear to be a git repository`), `Could not connect to remote "$1".`},
	{regexp.MustCompile(`(?i)fatal: Couldn't find remote ref`), "The remote branch does not exist."},
	{regexp.MustCompile(`(?i)fatal: The current branch .+ has no upstream branch`), "This branch has not been pushed yet."},
	{regexp.MustCompile(`(?i)error: failed to push some refs`), "Could not push — the remote has newer changes."},
	{regexp.MustCompile(`(?i)fatal: bad object`), "Could not find that commit."},
	{regexp.MustCompile(`(?i)Already on '([^']+)'`), `Already on branch "$1".`},
	{regexp.MustCompile(`(?i)HEAD detached at`), "Not on any branch."},
	{regexp.MustCompile(`(?i)nothing to commit, working tree clean`), "No changes to save."},
}

var jargonReplacements = []struct {
	pattern     *regexp.Regexp
	replacement string
}{
	{regexp.MustCompile(`\bHEAD\b`), "current commit"},
	{regexp.MustCompile(`(?i)\bstaging area\b`), "staged changes"},
	{regexp.MustCompile(`(?i)\bworking tree\b`), "project directory"},
	{regexp.MustCompile(`\bindex\b(?:\s)`), "staged changes "},
}

func translateError(message string) string {
	result := message
	for _, t := range errorTranslations {
		result = t.pattern.ReplaceAllString(result, t.replacement)
	}
	for _, t := range jargonReplacements {
		result = t.pattern.ReplaceAllString(result, t.replacement)
	}
	return result
}

// resolveCwd returns the working directory from the variadic cwd argument.
func resolveCwd(cwd ...string) string {
	if len(cwd) > 0 && cwd[0] != "" {
		return cwd[0]
	}
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	return dir
}

// ---------------------------------------------------------------------------
// Core executor
// ---------------------------------------------------------------------------

// Run executes a git command and returns stdout. Translates errors to plain language.
func Run(args string, cwd ...string) (string, error) {
	dir := resolveCwd(cwd...)
	cmd := exec.Command("git", strings.Fields(args)...)
	cmd.Dir = dir

	out, err := cmd.Output()
	if err != nil {
		var stderr string
		if exitErr, ok := err.(*exec.ExitError); ok {
			stderr = strings.TrimSpace(string(exitErr.Stderr))
		}
		if stderr == "" {
			stderr = err.Error()
		}
		return "", fmt.Errorf("%s", translateError(stderr))
	}
	return strings.TrimSpace(string(out)), nil
}

// runRaw executes a git command using shell to preserve quoting.
func runRaw(rawCmd string, cwd ...string) (string, error) {
	dir := resolveCwd(cwd...)
	cmd := exec.Command("sh", "-c", "git "+rawCmd)
	cmd.Dir = dir

	out, err := cmd.Output()
	if err != nil {
		var stderr string
		if exitErr, ok := err.(*exec.ExitError); ok {
			stderr = strings.TrimSpace(string(exitErr.Stderr))
		}
		if stderr == "" {
			stderr = err.Error()
		}
		return "", fmt.Errorf("%s", translateError(stderr))
	}
	return strings.TrimSpace(string(out)), nil
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

// Clone clones a repository.
func Clone(url, dir string) error {
	_, err := Run(fmt.Sprintf("clone %s %s", url, dir))
	return err
}

// GetCurrentBranch returns the current branch name.
func GetCurrentBranch(cwd ...string) (string, error) {
	return Run("rev-parse --abbrev-ref HEAD", cwd...)
}

// GetDefaultBranch detects the default branch (main or master).
func GetDefaultBranch(cwd ...string) string {
	// Try to read from remote origin HEAD
	output, err := Run("remote show origin", cwd...)
	if err == nil {
		re := regexp.MustCompile(`HEAD branch:\s*(\S+)`)
		match := re.FindStringSubmatch(output)
		if match != nil {
			return match[1]
		}
	}
	// Check if main exists locally
	_, err = Run("rev-parse --verify main", cwd...)
	if err == nil {
		return "main"
	}
	return "master"
}

// IsClean returns true if working tree is clean.
func IsClean(cwd ...string) bool {
	output, err := Run("status --porcelain", cwd...)
	if err != nil {
		return false
	}
	return len(output) == 0
}

// GetRepoRoot returns the repo root directory.
func GetRepoRoot(cwd ...string) (string, error) {
	return Run("rev-parse --show-toplevel", cwd...)
}

// GetRemoteURL returns the origin remote URL.
func GetRemoteURL(cwd ...string) (string, error) {
	return Run("remote get-url origin", cwd...)
}

// GetRepoName returns "owner/repo" from remote.
func GetRepoName(cwd ...string) (string, error) {
	url, err := GetRemoteURL(cwd...)
	if err != nil {
		return "", err
	}
	// Handle SSH: git@github.com:owner/repo.git
	sshRe := regexp.MustCompile(`:([^/]+/[^/]+?)(?:\.git)?$`)
	if match := sshRe.FindStringSubmatch(url); match != nil {
		return match[1], nil
	}
	// Handle HTTPS: https://github.com/owner/repo.git
	httpsRe := regexp.MustCompile(`/([^/]+/[^/]+?)(?:\.git)?$`)
	if match := httpsRe.FindStringSubmatch(url); match != nil {
		return match[1], nil
	}
	return url, nil
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

// CreateBranch creates and switches to a new branch from the given base.
func CreateBranch(name, from string, cwd ...string) error {
	_, err := Run(fmt.Sprintf("checkout -b %s %s", name, from), cwd...)
	return err
}

// SwitchBranch switches to a branch.
func SwitchBranch(name string, cwd ...string) error {
	_, err := Run(fmt.Sprintf("checkout %s", name), cwd...)
	return err
}

// DeleteBranch deletes a branch.
func DeleteBranch(name string, cwd ...string) error {
	_, err := Run(fmt.Sprintf("branch -D %s", name), cwd...)
	return err
}

// BranchExists checks if a branch exists.
func BranchExists(name string, cwd ...string) bool {
	_, err := Run(fmt.Sprintf("rev-parse --verify %s", name), cwd...)
	return err == nil
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

// ChangedFile represents a file change.
type ChangedFile struct {
	Path   string
	Status string // "added", "modified", "deleted"
}

// GetChangedFiles returns uncommitted file changes.
func GetChangedFiles(cwd ...string) ([]ChangedFile, error) {
	output, err := Run("status --porcelain", cwd...)
	if err != nil {
		return nil, err
	}
	if output == "" {
		return nil, nil
	}

	var files []ChangedFile
	for _, line := range strings.Split(output, "\n") {
		if line == "" {
			continue
		}
		code := strings.TrimSpace(line[:2])
		filePath := strings.TrimSpace(line[3:])
		var status string
		switch code {
		case "A", "??":
			status = "added"
		case "D":
			status = "deleted"
		default:
			status = "modified"
		}
		files = append(files, ChangedFile{Path: filePath, Status: status})
	}
	return files, nil
}

// GetDiff returns the unified diff of uncommitted changes (staged + unstaged).
func GetDiff(cwd ...string) (string, error) {
	var parts []string
	staged, _ := Run("diff --cached", cwd...)
	if staged != "" {
		parts = append(parts, staged)
	}
	unstaged, _ := Run("diff", cwd...)
	if unstaged != "" {
		parts = append(parts, unstaged)
	}
	return strings.Join(parts, "\n"), nil
}

// DiffStats holds diff statistics.
type DiffStats struct {
	Additions int
	Deletions int
	Files     int
}

// GetDiffStats returns additions/deletions/files counts.
func GetDiffStats(cwd ...string) (DiffStats, error) {
	diff, err := GetDiff(cwd...)
	if err != nil {
		return DiffStats{}, err
	}
	if diff == "" {
		return DiffStats{}, nil
	}

	additions := 0
	deletions := 0
	filesSet := make(map[string]struct{})

	for _, line := range strings.Split(diff, "\n") {
		if strings.HasPrefix(line, "+++ b/") {
			filesSet[line[6:]] = struct{}{}
		} else if strings.HasPrefix(line, "+") && !strings.HasPrefix(line, "+++") {
			additions++
		} else if strings.HasPrefix(line, "-") && !strings.HasPrefix(line, "---") {
			deletions++
		}
	}

	return DiffStats{
		Additions: additions,
		Deletions: deletions,
		Files:     len(filesSet),
	}, nil
}

// StageAll stages all changes.
func StageAll(cwd ...string) error {
	_, err := Run("add -A", cwd...)
	return err
}

// Commit creates a commit and returns the SHA.
func Commit(message string, cwd ...string) (string, error) {
	_, err := runRaw(fmt.Sprintf("commit -m %q", message), cwd...)
	if err != nil {
		return "", err
	}
	return GetHeadSHA(cwd...)
}

// Amend amends HEAD commit, returns new SHA.
func Amend(message string, cwd ...string) (string, error) {
	if message != "" {
		_, err := runRaw(fmt.Sprintf("commit --amend -m %q", message), cwd...)
		if err != nil {
			return "", err
		}
	} else {
		_, err := Run("commit --amend --no-edit", cwd...)
		if err != nil {
			return "", err
		}
	}
	return GetHeadSHA(cwd...)
}

// GetCommitMessage returns commit message for a SHA.
func GetCommitMessage(sha string, cwd ...string) (string, error) {
	return Run(fmt.Sprintf("log -1 --format=%%B %s", sha), cwd...)
}

// GetCommitDiff returns diff for a commit.
func GetCommitDiff(sha string, cwd ...string) (string, error) {
	return Run(fmt.Sprintf("show %s --format=", sha), cwd...)
}

// ---------------------------------------------------------------------------
// Sync / Rebase
// ---------------------------------------------------------------------------

// FetchMain fetches latest from origin default branch.
func FetchMain(cwd ...string) error {
	defaultBranch := GetDefaultBranch(cwd...)
	_, err := Run(fmt.Sprintf("fetch origin %s", defaultBranch), cwd...)
	return err
}

// RebaseResult holds rebase outcome.
type RebaseResult struct {
	Success   bool
	Conflicts []string
}

// RebaseOnto rebases current branch onto target.
func RebaseOnto(branch string, cwd ...string) RebaseResult {
	_, err := Run(fmt.Sprintf("rebase %s", branch), cwd...)
	if err != nil {
		conflicts := extractConflictFiles(cwd...)
		return RebaseResult{Success: false, Conflicts: conflicts}
	}
	return RebaseResult{Success: true}
}

// RebaseContinue continues a rebase.
func RebaseContinue(cwd ...string) RebaseResult {
	_, err := Run("-c core.editor=true rebase --continue", cwd...)
	if err != nil {
		conflicts := extractConflictFiles(cwd...)
		return RebaseResult{Success: false, Conflicts: conflicts}
	}
	return RebaseResult{Success: true}
}

// RebaseAbort aborts a rebase.
func RebaseAbort(cwd ...string) error {
	_, err := Run("rebase --abort", cwd...)
	return err
}

// PushForce force-pushes with lease.
func PushForce(branch string, cwd ...string) error {
	_, err := Run(fmt.Sprintf("push --force-with-lease origin %s", branch), cwd...)
	return err
}

// CherryPickSquash cherry-picks a commit as squash (no commit).
func CherryPickSquash(sha string, cwd ...string) error {
	_, err := Run(fmt.Sprintf("cherry-pick --no-commit %s", sha), cwd...)
	return err
}

func extractConflictFiles(cwd ...string) []string {
	output, err := Run("diff --name-only --diff-filter=U", cwd...)
	if err != nil {
		return nil
	}
	var files []string
	for _, line := range strings.Split(output, "\n") {
		if line != "" {
			files = append(files, line)
		}
	}
	return files
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

const logSep = "---DEVPOD_SEP---"

// LogEntry represents a log entry.
type LogEntry struct {
	SHA      string
	ShortSHA string
	Message  string
	Date     string
}

// GetLog returns log entries for a branch since a given date.
func GetLog(branch, since string, cwd ...string) ([]LogEntry, error) {
	output, err := runRaw(
		fmt.Sprintf(`log %s --since="%s" --format=%%H%s%%h%s%%s%s%%ci`, branch, since, logSep, logSep, logSep),
		cwd...,
	)
	if err != nil || output == "" {
		return nil, nil
	}

	var entries []LogEntry
	for _, line := range strings.Split(output, "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, logSep, 4)
		entry := LogEntry{}
		if len(parts) > 0 {
			entry.SHA = parts[0]
		}
		if len(parts) > 1 {
			entry.ShortSHA = parts[1]
		}
		if len(parts) > 2 {
			entry.Message = parts[2]
		}
		if len(parts) > 3 {
			entry.Date = parts[3]
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// GetCommitsBetween returns commits between base and head.
func GetCommitsBetween(base, head string, cwd ...string) ([]LogEntry, error) {
	output, err := runRaw(
		fmt.Sprintf("log %s..%s --format=%%H%s%%h%s%%s", base, head, logSep, logSep),
		cwd...,
	)
	if err != nil || output == "" {
		return nil, nil
	}

	var entries []LogEntry
	for _, line := range strings.Split(output, "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, logSep, 3)
		entry := LogEntry{}
		if len(parts) > 0 {
			entry.SHA = parts[0]
		}
		if len(parts) > 1 {
			entry.ShortSHA = parts[1]
		}
		if len(parts) > 2 {
			entry.Message = parts[2]
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// GetHeadSHA returns HEAD's SHA.
func GetHeadSHA(cwd ...string) (string, error) {
	return Run("rev-parse HEAD", cwd...)
}

// GetReflogEntry returns the SHA from the reflog at position n.
func GetReflogEntry(n int, cwd ...string) (string, error) {
	return runRaw(fmt.Sprintf("reflog show HEAD@{%d} --format=%%H", n), cwd...)
}

// ---------------------------------------------------------------------------
// Worktree
// ---------------------------------------------------------------------------

// IsInsideWorktree returns true if cwd is inside a git work tree.
func IsInsideWorktree(cwd ...string) bool {
	result, err := Run("rev-parse --is-inside-work-tree", cwd...)
	return err == nil && result == "true"
}

// IsGitRepo returns true if the directory is a git repository.
func IsGitRepo(cwd ...string) bool {
	_, err := GetRepoRoot(cwd...)
	return err == nil
}

// ---------------------------------------------------------------------------
// Commit message trailers — metadata stored in commit messages
// ---------------------------------------------------------------------------

// Trailers represents key-value metadata in a commit message.
type Trailers struct {
	Diff    string // "D1", "D2", etc.
	Feature string // feature slug
	Type    string // "feature", "fix", "docs", "chore"
	Version string // diff version number
}

// ParseTrailers extracts devpod trailers from a commit message.
func ParseTrailers(message string) Trailers {
	var t Trailers
	for _, line := range strings.Split(message, "\n") {
		line = strings.TrimSpace(line)
		if k, v, ok := parseTrailerLine(line); ok {
			switch k {
			case "Diff":
				t.Diff = v
			case "Feature":
				t.Feature = v
			case "Type":
				t.Type = v
			case "Version":
				t.Version = v
			}
		}
	}
	return t
}

// GetCommitTrailers parses trailers from a specific commit.
func GetCommitTrailers(sha string, cwd ...string) (Trailers, error) {
	msg, err := GetCommitMessage(sha, cwd...)
	if err != nil {
		return Trailers{}, err
	}
	return ParseTrailers(msg), nil
}

// FormatTrailers returns trailer lines to append to a commit message.
func FormatTrailers(t Trailers) string {
	var lines []string
	if t.Diff != "" {
		lines = append(lines, "Diff: "+t.Diff)
	}
	if t.Feature != "" {
		lines = append(lines, "Feature: "+t.Feature)
	}
	if t.Type != "" {
		lines = append(lines, "Type: "+t.Type)
	}
	if t.Version != "" {
		lines = append(lines, "Version: "+t.Version)
	}
	if len(lines) == 0 {
		return ""
	}
	return "\n" + strings.Join(lines, "\n")
}

// AppendTrailers adds trailers to a commit message body.
// If trailers already exist, they are replaced.
func AppendTrailers(body string, t Trailers) string {
	// Remove existing trailers
	cleaned := StripTrailers(body)
	trailerBlock := FormatTrailers(t)
	if trailerBlock == "" {
		return cleaned
	}
	return strings.TrimRight(cleaned, "\n") + "\n" + trailerBlock + "\n"
}

// StripTrailers removes devpod trailer lines from a commit message.
func StripTrailers(message string) string {
	var lines []string
	for _, line := range strings.Split(message, "\n") {
		trimmed := strings.TrimSpace(line)
		if k, _, ok := parseTrailerLine(trimmed); ok {
			switch k {
			case "Diff", "Feature", "Type", "Version":
				continue // skip devpod trailers
			}
		}
		lines = append(lines, line)
	}
	return strings.TrimRight(strings.Join(lines, "\n"), "\n\t ")
}

// FindDiffCommits scans the log for commits with Diff trailers on a branch.
// Returns commits in stack order (D1 first).
func FindDiffCommits(branch string, base string, cwd ...string) ([]DiffCommit, error) {
	commits, err := GetCommitsBetween(base, branch, cwd...)
	if err != nil {
		return nil, err
	}
	var diffs []DiffCommit
	for _, c := range commits {
		msg, err := GetCommitMessage(c.SHA, cwd...)
		if err != nil {
			continue
		}
		trailers := ParseTrailers(msg)
		if trailers.Diff != "" {
			diffs = append(diffs, DiffCommit{
				SHA:      c.SHA,
				ShortSHA: c.ShortSHA,
				Title:    firstLine(msg),
				Trailers: trailers,
			})
		}
	}
	// Reverse so D1 is first (commits are newest-first from git log)
	for i, j := 0, len(diffs)-1; i < j; i, j = i+1, j-1 {
		diffs[i], diffs[j] = diffs[j], diffs[i]
	}
	return diffs, nil
}

// DiffCommit is a commit that has devpod diff trailers.
type DiffCommit struct {
	SHA      string
	ShortSHA string
	Title    string
	Trailers Trailers
}

func parseTrailerLine(line string) (key, value string, ok bool) {
	idx := strings.Index(line, ": ")
	if idx <= 0 {
		return "", "", false
	}
	k := line[:idx]
	// Only alphanumeric keys (no spaces, no special chars)
	for _, c := range k {
		if !((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
			return "", "", false
		}
	}
	return k, strings.TrimSpace(line[idx+2:]), true
}

func firstLine(s string) string {
	if i := strings.Index(s, "\n"); i >= 0 {
		return s[:i]
	}
	return s
}
