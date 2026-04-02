package rebase

import (
	"fmt"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/git"
)

// ReplayOptions holds parameters for replaying a stack.
type ReplayOptions struct {
	EditedDiffSHA string   // the amended commit
	CommitsAbove  []string // SHAs to replay (in order, oldest first)
	Cwd           string
}

// ConflictError represents a cherry-pick conflict during replay.
type ConflictError struct {
	File          string
	DiffID        string
	ConflictFiles []string
	Message       string // plain language
}

func (e *ConflictError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	if len(e.ConflictFiles) > 0 {
		return fmt.Sprintf("Conflicting changes in %s while replaying %s.\n\n  Open the files with conflict markers (<<<, ===, >>>), resolve them, then:\n    devpod diff --continue\n  Or to cancel:\n    devpod diff --abort",
			strings.Join(e.ConflictFiles, ", "), e.DiffID)
	}
	return "Conflicting changes detected during replay."
}

// ReplayStack replays commits above the edited diff onto the new version.
// Returns an error with conflict details if cherry-pick fails.
func ReplayStack(opts ReplayOptions) error {
	cwd := opts.Cwd
	if len(opts.CommitsAbove) == 0 {
		return nil // nothing to replay
	}

	for i, sha := range opts.CommitsAbove {
		err := git.CherryPick(sha, cwd)
		if err != nil {
			// Check for conflicts
			conflictFiles := git.GetConflictFiles(cwd)
			if len(conflictFiles) > 0 {
				// Determine which diff this was
				trailers, _ := git.GetCommitTrailers(sha, cwd)
				diffID := trailers.Diff
				if diffID == "" {
					diffID = fmt.Sprintf("commit %d of %d", i+1, len(opts.CommitsAbove))
				}

				return &ConflictError{
					File:          conflictFiles[0],
					DiffID:        diffID,
					ConflictFiles: conflictFiles,
					Message: fmt.Sprintf("Conflicting changes in %s while replaying %s.\n\n  Open the files with conflict markers (<<<, ===, >>>), resolve them, then:\n    devpod diff --continue\n  Or to cancel:\n    devpod diff --abort",
						strings.Join(conflictFiles, ", "), diffID),
				}
			}
			return fmt.Errorf("could not replay changes: %w", err)
		}
	}

	return nil
}

// ContinueReplay resumes after user resolves conflicts.
func ContinueReplay(cwd ...string) error {
	c := ""
	if len(cwd) > 0 {
		c = cwd[0]
	}

	// Stage all changes (user should have resolved conflicts)
	err := git.StageAll(c)
	if err != nil {
		return fmt.Errorf("could not stage resolved files: %w", err)
	}

	// Check if there are still conflicts
	if git.HasConflicts(c) {
		conflictFiles := git.GetConflictFiles(c)
		return &ConflictError{
			ConflictFiles: conflictFiles,
			Message:       fmt.Sprintf("Still have conflicts in: %s\n\n  Resolve the remaining conflicts and try again.", strings.Join(conflictFiles, ", ")),
		}
	}

	// Continue the cherry-pick
	err = git.CherryPickContinue(c)
	if err != nil {
		return fmt.Errorf("could not continue: %w", err)
	}

	return nil
}

// AbortReplay restores the pre-edit state.
func AbortReplay(preEditSHA string, cwd ...string) error {
	c := ""
	if len(cwd) > 0 {
		c = cwd[0]
	}

	// Try to abort any in-progress cherry-pick
	_ = git.CherryPickAbort(c)

	// Hard reset to the pre-edit state
	_, err := git.Run(fmt.Sprintf("reset --hard %s", preEditSHA), c)
	if err != nil {
		return fmt.Errorf("could not restore to previous state: %w", err)
	}

	return nil
}

// IsConflictError checks if an error is a ConflictError.
func IsConflictError(err error) bool {
	_, ok := err.(*ConflictError)
	return ok
}
