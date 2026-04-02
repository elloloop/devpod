package commands

import (
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/briandowns/spinner"
	"github.com/elloloop/devpod/platform/cli-go/internal/api"
	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/llm"
	"github.com/elloloop/devpod/platform/cli-go/internal/rebase"
	"github.com/elloloop/devpod/platform/cli-go/internal/snapshot"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

var diffPositionRegex = regexp.MustCompile(`^[Dd](\d+)$`)

func parseDiffPosition(label string) (int, bool) {
	matches := diffPositionRegex.FindStringSubmatch(label)
	if matches == nil {
		return 0, false
	}
	pos, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0, false
	}
	return pos, true
}

func generateTitle(diffContent string, files []string, changeType workspace.ChangeType, scope string, explicitMessage string) (llm.Result, error) {
	if explicitMessage != "" {
		prefix := format.FeatureTypePrefix(string(changeType))
		return llm.Result{
			Title:       fmt.Sprintf("%s(%s): %s", prefix, scope, explicitMessage),
			Description: "",
		}, nil
	}

	if llm.IsAvailable() {
		result, err := llm.GenerateDiffMessage(diffContent, string(changeType), scope)
		if err == nil {
			return result, nil
		}
	}

	return llm.GenerateFallbackMessage(files, string(changeType), scope), nil
}

// takeSnapshot is a helper that takes a snapshot on the versions branch and updates metadata.
func takeSnapshot(feature *workspace.FeatureData, diffID string, action string, message string) (string, error) {
	// Ensure versions branch exists
	if err := workspace.EnsureVersionsBranch(*feature); err != nil {
		return "", err
	}

	snapshotID := workspace.GetNextSnapshotID(*feature)
	cleanSHA, _ := git.GetHeadSHA()

	diff := workspace.GetDiffByPosition(*feature, parseDiffNum(diffID))
	version := 1
	previousSnapshotID := ""
	if diff != nil {
		version = diff.Version
		latestVer := workspace.GetLatestDiffVersion(*feature, diff.UUID)
		if latestVer != nil {
			previousSnapshotID = latestVer.SnapshotID
		}
	}

	trailers := git.Trailers{
		Snapshot: snapshotID,
		Diff:     diffID,
		Version:  strconv.Itoa(version),
		Feature:  feature.Slug,
		Action:   action,
		Stack:    workspace.GetStackString(*feature),
		Previous: previousSnapshotID,
		CleanSHA: cleanSHA,
	}

	vb := feature.VersionsBranch
	if vb == "" {
		vb = workspace.VersionsBranchName(feature.Branch)
	}

	sha, err := snapshot.Take(snapshot.TakeOptions{
		CleanBranch:    feature.Branch,
		VersionsBranch: vb,
		Message:        message,
		Trailers:       trailers,
	})
	if err != nil {
		return "", err
	}

	// Update feature snapshot count
	feature.SnapshotCount++

	// Add version record to diff if applicable
	if diff != nil {
		dv := workspace.DiffVersion{
			Number:      version,
			SnapshotID:  snapshotID,
			SnapshotSHA: sha,
			CleanSHA:    cleanSHA,
			Message:     message,
			Action:      action,
			Timestamp:   time.Now().UTC().Format(time.RFC3339),
		}
		_ = workspace.AddDiffVersion(feature, diff.UUID, dv)
	}

	_ = workspace.SaveFeature(*feature)
	return sha, nil
}

func parseDiffNum(label string) int {
	pos, ok := parseDiffPosition(label)
	if ok {
		return pos
	}
	return 0
}

func newDiffCmd() *cobra.Command {
	var preview bool
	var continueReplay bool
	var abortReplay bool

	diffCmd := &cobra.Command{
		Use:   "diff [message]",
		Short: "Create or update a diff (unit of change)",
		Long: `Create a new diff from uncommitted changes, or update an existing
diff when in edit mode.

Each diff gets a version on the versions branch, so you can always
compare any two versions later with: devpod diff compare D1:v1 D1:v2`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Handle --continue
			if continueReplay {
				return handleDiffContinue()
			}

			// Handle --abort
			if abortReplay {
				return handleDiffAbort()
			}

			// Check for pending rebase
			if err := workspace.CheckPendingRebase(); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			var message string
			if len(args) > 0 {
				message = args[0]
			}

			feature, err := workspace.ValidateOnFeatureBranch()
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			changes, err := git.GetChangedFiles()
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}
			editingUUID := workspace.GetEditingDiff()

			// Preview mode
			if preview {
				return handleDiffPreview(feature, changes, message)
			}

			// Check if in edit mode (updating a previously created diff)
			if editingUUID != "" {
				return handleDiffUpdate(feature, editingUUID, changes, message)
			}

			// Creating a new diff
			if len(changes) == 0 {
				fmt.Println(format.DimText("No changes to save."))
				fmt.Println(format.DimText("  Make some changes, then run: devpod diff"))
				return nil
			}

			return handleDiffCreate(feature, changes, message)
		},
	}

	diffCmd.Flags().BoolVar(&preview, "preview", false, "Preview what would be diffed without committing")
	diffCmd.Flags().BoolVar(&continueReplay, "continue", false, "Continue after resolving conflicts")
	diffCmd.Flags().BoolVar(&abortReplay, "abort", false, "Abort edit/replay in progress")

	// diff edit <label>
	editCmd := &cobra.Command{
		Use:   "edit <label>",
		Short: "Enter edit mode for a specific diff (e.g. D1)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return handleDiffEdit(args[0])
		},
	}

	// diff versions <label>
	versionsCmd := &cobra.Command{
		Use:   "versions <label>",
		Short: "Show version history for a diff (e.g. D1)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return handleDiffVersions(args[0])
		},
	}

	// diff compare <spec1> <spec2>
	compareCmd := &cobra.Command{
		Use:   "compare <spec1> <spec2>",
		Short: "Compare two diff versions (e.g. D1:v1 D1:v2, or D1 D2)",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			return handleDiffCompare(args[0], args[1])
		},
	}

	// diff check [label]
	checkCmd := &cobra.Command{
		Use:   "check [label]",
		Short: "Run CI checks for a diff",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return handleDiffCheck(args)
		},
	}

	diffCmd.AddCommand(editCmd)
	diffCmd.AddCommand(versionsCmd)
	diffCmd.AddCommand(compareCmd)
	diffCmd.AddCommand(checkCmd)

	return diffCmd
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

func handleDiffCreate(feature *workspace.FeatureData, changes []git.ChangedFile, message string) error {
	diffContent, _ := git.GetDiff()
	stats, _ := git.GetDiffStats()
	changedFiles := make([]string, len(changes))
	for i, c := range changes {
		changedFiles[i] = c.Path
	}
	scope := feature.Slug

	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
	s.Suffix = " Generating diff message..."
	s.Start()

	result, _ := generateTitle(diffContent, changedFiles, feature.Type, scope, message)
	s.Stop()

	// Save undo entry
	headBefore, _ := git.GetHeadSHA()
	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:      "diff-create",
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		RefBefore:   headBefore,
		Description: fmt.Sprintf("Create diff: %s", result.Title),
		Data:        map[string]interface{}{},
	})

	// Stage and commit with trailers
	_ = git.StageAll()
	position := workspace.GetNextDiffPosition(*feature)
	diffID := fmt.Sprintf("D%d", position)

	trailers := git.Trailers{
		Diff:    diffID,
		Version: "1",
		Feature: feature.Slug,
		Type:    string(feature.Type),
	}
	commitMsg := git.AppendTrailers(result.Title, trailers)

	commitSHA, err := git.Commit(commitMsg)
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	// Create diff metadata
	uuid := workspace.GenerateDiffUUID()
	newDiff := workspace.DiffData{
		ID:          diffID,
		UUID:        uuid,
		Feature:     feature.Slug,
		Commit:      commitSHA,
		Position:    position,
		Title:       result.Title,
		Description: result.Description,
		Type:        feature.Type,
		Files:       changedFiles,
		Additions:   stats.Additions,
		Deletions:   stats.Deletions,
		Version:     1,
		Status:      "draft",
		CI:          "",
		GitHubPR:    0,
		Created:     time.Now().UTC().Format(time.RFC3339),
		Updated:     time.Now().UTC().Format(time.RFC3339),
	}

	_ = workspace.SaveDiff(newDiff)

	// Add to feature's diffs list
	feature.Diffs = append(feature.Diffs, uuid)
	_ = workspace.SaveFeature(*feature)

	// Take snapshot on versions branch
	s = spinner.New(spinner.CharSets[14], 100*time.Millisecond)
	s.Suffix = " Saving snapshot..."
	s.Start()
	_, snapErr := takeSnapshot(feature, diffID, "create", fmt.Sprintf("Create %s: %s", diffID, result.Title))
	s.Stop()
	if snapErr != nil {
		fmt.Println(format.DimText(fmt.Sprintf("  Note: snapshot failed (%s). Diff is saved locally.", snapErr.Error())))
	}

	// Print result
	filesWord := "files"
	if stats.Files == 1 {
		filesWord = "file"
	}
	fmt.Printf("%s Created %s: %s\n", format.SuccessMsg("\u2713"), format.DiffLabel(position), result.Title)
	fmt.Println(format.DimText(fmt.Sprintf("  %d %s (+%d -%d)", stats.Files, filesWord, stats.Additions, stats.Deletions)))

	// Print stack
	printStack(feature)
	fmt.Println(format.NextStepHint("diff-create"))
	return nil
}

func handleDiffUpdate(feature *workspace.FeatureData, editingUUID string, changes []git.ChangedFile, message string) error {
	editDiff, err := workspace.LoadDiff(editingUUID)
	if err != nil || editDiff == nil {
		fmt.Println(format.ErrorMsg("No diff is being edited."))
		return fmt.Errorf("no diff being edited")
	}

	if len(changes) == 0 {
		fmt.Println(format.ErrorMsg("No changes to save."))
		fmt.Println(format.DimText(fmt.Sprintf("  You are editing %s. Make changes, then run: devpod diff", format.DiffLabel(editDiff.Position))))
		return fmt.Errorf("no changes")
	}

	changedFiles := make([]string, len(changes))
	for i, c := range changes {
		changedFiles[i] = c.Path
	}

	// Save undo entry
	headBefore, _ := git.GetHeadSHA()
	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:      "diff-update",
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		RefBefore:   headBefore,
		Description: fmt.Sprintf("Update %s", format.DiffLabel(editDiff.Position)),
		Data:        map[string]interface{}{"uuid": editingUUID, "previousCommit": editDiff.Commit},
	})

	// Stage all and amend the commit
	_ = git.StageAll()

	// Update trailers with incremented version
	newVersion := editDiff.Version + 1
	diffID := fmt.Sprintf("D%d", editDiff.Position)
	trailers := git.Trailers{
		Diff:    diffID,
		Version: strconv.Itoa(newVersion),
		Feature: feature.Slug,
		Type:    string(feature.Type),
	}

	// Get the original title, update with new trailers
	title := editDiff.Title
	if message != "" {
		prefix := format.FeatureTypePrefix(string(feature.Type))
		title = fmt.Sprintf("%s(%s): %s", prefix, feature.Slug, message)
	}
	commitMsg := git.AppendTrailers(title, trailers)
	newSHA, err := git.Amend(commitMsg)
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	// Update diff metadata
	editDiff.Commit = newSHA
	editDiff.Version = newVersion
	editDiff.Status = "draft"
	editDiff.Updated = time.Now().UTC().Format(time.RFC3339)
	if len(changedFiles) > 0 {
		editDiff.Files = changedFiles
	}

	newStats, _ := git.GetDiffStats()
	editDiff.Additions = newStats.Additions
	editDiff.Deletions = newStats.Deletions
	_ = workspace.SaveDiff(*editDiff)

	// Replay commits above this diff
	diffs := workspace.LoadDiffsForFeature(*feature)
	var commitsAbove []string
	for _, d := range sortDiffsByPosition(diffs) {
		if d.Position > editDiff.Position && d.Commit != "" {
			commitsAbove = append(commitsAbove, d.Commit)
		}
	}

	if len(commitsAbove) > 0 {
		s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Suffix = " Replaying stack..."
		s.Start()

		err := rebase.ReplayStack(rebase.ReplayOptions{
			EditedDiffSHA: newSHA,
			CommitsAbove:  commitsAbove,
		})
		s.Stop()

		if err != nil {
			if rebase.IsConflictError(err) {
				// Save pending rebase state so user can --continue/--abort
				_ = workspace.SavePendingRebase(workspace.PendingRebase{
					EditingDiff:    editingUUID,
					PreEditSHA:     headBefore,
					RemainingPicks: commitsAbove,
					CompletedPicks: nil,
				})
				// Clear editing state (we're now in conflict resolution mode)
				_ = workspace.SetEditingDiff("")
				fmt.Println(format.ErrorMsg(err.Error()))
				return fmt.Errorf("conflicts during replay")
			}
			return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
		}

		// Update commit SHAs for replayed diffs
		updateDiffSHAs(feature)
	}

	// Clear editing state
	_ = workspace.SetEditingDiff("")

	// Take snapshot on versions branch
	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
	s.Suffix = " Saving snapshot..."
	s.Start()
	_, snapErr := takeSnapshot(feature, diffID, "update", fmt.Sprintf("Update %s v%d: %s", diffID, newVersion, title))
	s.Stop()
	if snapErr != nil {
		fmt.Println(format.DimText(fmt.Sprintf("  Note: snapshot failed (%s)", snapErr.Error())))
	}

	fmt.Printf("%s Updated %s -> v%d: %s\n", format.SuccessMsg("\u2713"), format.DiffLabel(editDiff.Position), newVersion, title)
	printStack(feature)
	fmt.Println(format.NextStepHint("diff-update"))
	return nil
}

func handleDiffEdit(label string) error {
	// Check uncommitted changes
	if workspace.HasUncommittedChanges() {
		return fmt.Errorf("%s\n\n  Save your changes first with: devpod diff",
			format.ErrorMsg("You have unsaved changes."))
	}

	// Check pending rebase
	if err := workspace.CheckPendingRebase(); err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	feature, err := workspace.ValidateOnFeatureBranch()
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	position, ok := parseDiffPosition(label)
	if !ok {
		return fmt.Errorf("%s\n\n  Use format D1, D2, etc.",
			format.ErrorMsg(fmt.Sprintf("Invalid diff label: %s.", label)))
	}

	targetDiff := workspace.GetDiffByPosition(*feature, position)
	if targetDiff == nil {
		return fmt.Errorf("%s\n\n  Run: devpod diffs (to see available diffs)",
			format.ErrorMsg(fmt.Sprintf("%s not found.", format.DiffLabel(position))))
	}

	// Save undo entry with current HEAD
	headBefore, _ := git.GetHeadSHA()
	_ = workspace.SaveUndoEntry(workspace.UndoEntry{
		Action:      "diff-edit",
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		RefBefore:   headBefore,
		Description: fmt.Sprintf("Edit %s", format.DiffLabel(position)),
		Data: map[string]interface{}{
			"uuid":          targetDiff.UUID,
			"featureBranch": feature.Branch,
		},
	})

	// Set editing state
	_ = workspace.SetEditingDiff(targetDiff.UUID)

	// Check if there are diffs above this one
	diffs := workspace.LoadDiffsForFeature(*feature)
	hasAbove := false
	for _, d := range diffs {
		if d.Position > position {
			hasAbove = true
			break
		}
	}

	// Hard reset to the diff's commit so user sees that state
	if hasAbove {
		resetCmd := exec.Command("git", "reset", "--hard", targetDiff.Commit)
		_ = resetCmd.Run()
	}

	fmt.Printf("%s Editing %s: %s\n", format.SuccessMsg("\u2713"), format.DiffLabel(position), targetDiff.Title)
	fmt.Println(format.DimText("  Make your changes, then run: devpod diff"))
	return nil
}

func handleDiffContinue() error {
	pr := workspace.LoadPendingRebase()
	if pr == nil {
		fmt.Println(format.DimText("Nothing to continue. No interrupted operation found."))
		return nil
	}

	// Stage resolved files and continue
	err := rebase.ContinueReplay()
	if err != nil {
		if rebase.IsConflictError(err) {
			fmt.Println(format.ErrorMsg(err.Error()))
			return fmt.Errorf("conflicts remain")
		}
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	// Continue replaying remaining picks
	if len(pr.RemainingPicks) > 1 {
		remaining := pr.RemainingPicks[1:]
		err := rebase.ReplayStack(rebase.ReplayOptions{
			CommitsAbove: remaining,
		})
		if err != nil {
			if rebase.IsConflictError(err) {
				pr.RemainingPicks = remaining
				pr.CompletedPicks = append(pr.CompletedPicks, pr.RemainingPicks[0])
				_ = workspace.SavePendingRebase(*pr)
				fmt.Println(format.ErrorMsg(err.Error()))
				return fmt.Errorf("conflicts during replay")
			}
			return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
		}
	}

	// All done -- take snapshot and clear state
	feature, _ := workspace.ValidateOnFeatureBranch()
	if feature != nil {
		updateDiffSHAs(feature)

		// Take snapshot
		editDiff, _ := workspace.LoadDiff(pr.EditingDiff)
		diffID := "D?"
		if editDiff != nil {
			diffID = fmt.Sprintf("D%d", editDiff.Position)
		}
		_, _ = takeSnapshot(feature, diffID, "update", fmt.Sprintf("Continue: updated %s", diffID))
	}

	_ = workspace.ClearPendingRebase()
	_ = workspace.SetEditingDiff("")

	fmt.Printf("%s Replay complete. Stack restored.\n", format.SuccessMsg("\u2713"))
	if feature != nil {
		printStack(feature)
	}
	return nil
}

func handleDiffAbort() error {
	pr := workspace.LoadPendingRebase()
	if pr == nil {
		// Also check editing state
		editingUUID := workspace.GetEditingDiff()
		if editingUUID != "" {
			// Abort edit mode -- restore from undo
			entry := workspace.GetLastUndoEntry()
			if entry != nil && entry.Action == "diff-edit" && entry.RefBefore != "" {
				resetCmd := exec.Command("git", "reset", "--hard", entry.RefBefore)
				_ = resetCmd.Run()
				_ = workspace.SetEditingDiff("")
				fmt.Printf("%s Edit aborted. Stack restored.\n", format.SuccessMsg("\u2713"))
				return nil
			}
		}
		fmt.Println(format.DimText("Nothing to abort. No interrupted operation found."))
		return nil
	}

	// Abort the replay
	err := rebase.AbortReplay(pr.PreEditSHA)
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	_ = workspace.ClearPendingRebase()
	_ = workspace.SetEditingDiff("")

	fmt.Printf("%s Edit aborted. Stack restored.\n", format.SuccessMsg("\u2713"))
	return nil
}

func handleDiffPreview(feature *workspace.FeatureData, changes []git.ChangedFile, message string) error {
	if len(changes) == 0 {
		fmt.Println(format.DimText("No changes to preview."))
		return nil
	}

	diffContent, _ := git.GetDiff()
	stats, _ := git.GetDiffStats()
	changedFiles := make([]string, len(changes))
	for i, c := range changes {
		changedFiles[i] = c.Path
	}
	scope := feature.Slug

	result, _ := generateTitle(diffContent, changedFiles, feature.Type, scope, message)

	fmt.Println("Preview (nothing committed):")
	fmt.Printf("  Title: %s\n", result.Title)
	if result.Description != "" {
		fmt.Printf("  Description: %s\n", result.Description)
	}
	fmt.Printf("  Files: %d (+%d -%d)\n", stats.Files, stats.Additions, stats.Deletions)
	for _, change := range changes {
		var statusLabel string
		switch change.Status {
		case "added":
			statusLabel = "added"
		case "deleted":
			statusLabel = "deleted"
		default:
			statusLabel = "modified"
		}
		fmt.Printf("    %s  %s\n", statusLabel, change.Path)
	}
	return nil
}

func handleDiffVersions(label string) error {
	feature, err := workspace.ValidateOnFeatureBranch()
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	position, ok := parseDiffPosition(label)
	if !ok {
		return fmt.Errorf("%s\n\n  Use format D1, D2, etc.",
			format.ErrorMsg(fmt.Sprintf("Invalid diff label: %s.", label)))
	}

	diff := workspace.GetDiffByPosition(*feature, position)
	if diff == nil {
		return fmt.Errorf("%s", format.ErrorMsg(fmt.Sprintf("%s not found.", format.DiffLabel(position))))
	}

	versions := diff.Versions
	if len(versions) == 0 {
		// Try reading from the versions branch
		vb := feature.VersionsBranch
		if vb == "" {
			vb = workspace.VersionsBranchName(feature.Branch)
		}
		snapshots, _ := snapshot.ListSnapshots(vb)
		diffID := fmt.Sprintf("D%d", position)
		for _, snap := range snapshots {
			if snap.Diff == diffID {
				versions = append(versions, workspace.DiffVersion{
					Number:      snap.Version,
					SnapshotID:  snap.ID,
					SnapshotSHA: snap.SHA,
					Message:     snap.Message,
					Action:      snap.Action,
					Timestamp:   snap.Date,
				})
			}
		}
	}

	if len(versions) == 0 {
		fmt.Printf("%s has no version history yet.\n", format.DiffLabel(position))
		return nil
	}

	fmt.Printf("%s: %s\n\n", format.DiffLabel(position), diff.Title)

	var rows [][]string
	for _, v := range versions {
		ts := v.Timestamp
		if ts != "" {
			ts = format.RelativeTime(ts)
		}
		rows = append(rows, []string{
			fmt.Sprintf("v%d", v.Number),
			v.SnapshotID,
			v.Action,
			v.Message,
			ts,
		})
	}

	fmt.Println(format.Table([]string{"Version", "Snapshot", "Action", "Message", "When"}, rows))
	return nil
}

func handleDiffCompare(spec1, spec2 string) error {
	feature, err := workspace.ValidateOnFeatureBranch()
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	vb := feature.VersionsBranch
	if vb == "" {
		vb = workspace.VersionsBranchName(feature.Branch)
	}

	sha1, err := resolveSnapshotSpec(feature, vb, spec1)
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	sha2, err := resolveSnapshotSpec(feature, vb, spec2)
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	diff, err := snapshot.Compare(sha1, sha2)
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	if diff == "" {
		fmt.Println(format.DimText("No differences between the two versions."))
		return nil
	}

	fmt.Printf("Comparing %s .. %s\n\n", spec1, spec2)
	fmt.Println(diff)
	return nil
}

// resolveSnapshotSpec parses "D1:v2" or "D1" into a snapshot SHA.
func resolveSnapshotSpec(feature *workspace.FeatureData, versionsBranch, spec string) (string, error) {
	// Try D1:v2 format
	if strings.Contains(spec, ":") {
		parts := strings.SplitN(spec, ":", 2)
		diffLabel := parts[0]
		versionLabel := parts[1]

		position, ok := parseDiffPosition(diffLabel)
		if !ok {
			return "", fmt.Errorf("invalid diff label: %s", diffLabel)
		}

		vStr := strings.TrimPrefix(strings.ToLower(versionLabel), "v")
		version, err := strconv.Atoi(vStr)
		if err != nil {
			return "", fmt.Errorf("invalid version: %s", versionLabel)
		}

		diffID := fmt.Sprintf("D%d", position)
		snapshots, err := snapshot.ListSnapshots(versionsBranch)
		if err != nil {
			return "", fmt.Errorf("could not read versions branch: %s", err.Error())
		}

		for _, s := range snapshots {
			if s.Diff == diffID && s.Version == version {
				return s.SHA, nil
			}
		}
		return "", fmt.Errorf("snapshot for %s v%d not found", diffID, version)
	}

	// Try D1 format (latest version)
	position, ok := parseDiffPosition(spec)
	if ok {
		diff := workspace.GetDiffByPosition(*feature, position)
		if diff == nil {
			return "", fmt.Errorf("%s not found", spec)
		}
		// Get the latest snapshot for this diff
		if len(diff.Versions) > 0 {
			return diff.Versions[len(diff.Versions)-1].SnapshotSHA, nil
		}
		// Fall back to commit SHA
		return diff.Commit, nil
	}

	// Try raw SHA
	return spec, nil
}

func handleDiffCheck(args []string) error {
	feature, err := workspace.ValidateOnFeatureBranch()
	if err != nil {
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	diffs := workspace.LoadDiffsForFeature(*feature)
	if len(diffs) == 0 {
		fmt.Println(format.DimText("No diffs to check."))
		return nil
	}

	var targetDiff workspace.DiffData
	if len(args) > 0 {
		label := args[0]
		position, ok := parseDiffPosition(label)
		if !ok {
			return fmt.Errorf("%s\n\n  Use format D1, D2, etc.",
				format.ErrorMsg(fmt.Sprintf("Invalid diff label: %s.", label)))
		}
		found := workspace.GetDiffByPosition(*feature, position)
		if found == nil {
			return fmt.Errorf("%s", format.ErrorMsg(fmt.Sprintf("%s not found.", format.DiffLabel(position))))
		}
		targetDiff = *found
	} else {
		sorted := sortDiffsByPosition(diffs)
		targetDiff = sorted[len(sorted)-1]
	}

	// Check if runner is available
	if !api.Ping() {
		return fmt.Errorf("%s\n\n  Start the runner with: devpod runner start",
			format.ErrorMsg("Runner is not available."))
	}

	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
	s.Suffix = fmt.Sprintf(" Running checks for %s...", format.DiffLabel(targetDiff.Position))
	s.Start()

	var runResult struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	err = api.Post("/api/runs", map[string]interface{}{
		"workflow": "pull_request",
		"ref":      feature.Branch,
		"inputs":   map[string]string{"diff": targetDiff.UUID},
	}, &runResult)
	if err != nil {
		s.Stop()
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	s.Suffix = fmt.Sprintf(" Checks running (%s)...", runResult.ID)

	done := make(chan bool, 1)

	err = api.StreamEvents("/api/events", func(eventType string, data []byte) {
		switch eventType {
		case "step.log":
			// Log output during checks
		case "run.completed":
			s.Stop()
			status := runResult.Status
			if status == "" {
				status = "success"
			}
			passed := status == "success"
			if passed {
				targetDiff.CI = "passed"
			} else {
				targetDiff.CI = "failed"
			}
			_ = workspace.SaveDiff(targetDiff)

			if passed {
				fmt.Printf("%s %s checks passed\n", format.SuccessMsg("\u2713"), format.DiffLabel(targetDiff.Position))
			} else {
				fmt.Printf("%s %s checks failed\n", format.ErrorMsg("\u2717"), format.DiffLabel(targetDiff.Position))
			}
			done <- true
		}
	})
	if err != nil {
		s.Stop()
		return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
	}

	select {
	case <-done:
	case <-time.After(30 * time.Minute):
		s.Stop()
		fmt.Println(format.WarnMsg("Check timed out."))
		targetDiff.CI = "failed"
		_ = workspace.SaveDiff(targetDiff)
	}

	return nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func printStack(feature *workspace.FeatureData) {
	diffs := workspace.LoadDiffsForFeature(*feature)
	if len(diffs) == 0 {
		return
	}
	sorted := sortDiffsByPosition(diffs)
	var stackParts []string
	for _, d := range sorted {
		vLabel := ""
		if d.Version > 1 {
			vLabel = fmt.Sprintf(" v%d", d.Version)
		}
		stackParts = append(stackParts, fmt.Sprintf("%s%s %s", format.DiffLabel(d.Position), vLabel, format.DiffStatusIcon(string(d.Status))))
	}
	fmt.Println(format.DimText(fmt.Sprintf("  Stack: %s", strings.Join(stackParts, " \u2192 "))))
}
