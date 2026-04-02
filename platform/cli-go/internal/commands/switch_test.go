package commands

import (
	"strings"
	"testing"

	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
)

// ---------------------------------------------------------------------------
// Switch tests
// ---------------------------------------------------------------------------

func TestSwitch_FindsExactMatch(t *testing.T) {
	dir := setupTestRepo(t)
	createFeature(t, dir, "login page", "feature")
	mustExec(t, dir, "git", "checkout", "main")
	createFeature(t, dir, "signup flow", "feature")

	features := workspace.ListFeatures(dir)
	q := strings.ToLower("login")

	var matches []workspace.FeatureData
	for _, f := range features {
		if strings.Contains(strings.ToLower(f.Name), q) || strings.Contains(f.Slug, q) {
			matches = append(matches, f)
		}
	}

	if len(matches) != 1 {
		t.Errorf("expected 1 match, got %d", len(matches))
	}
	if matches[0].Name != "login page" {
		t.Errorf("expected 'login page', got %s", matches[0].Name)
	}
}

func TestSwitch_PartialMatch(t *testing.T) {
	dir := setupTestRepo(t)
	createFeature(t, dir, "authentication system", "feature")
	mustExec(t, dir, "git", "checkout", "main")

	features := workspace.ListFeatures(dir)
	q := strings.ToLower("auth")

	var matches []workspace.FeatureData
	for _, f := range features {
		if strings.Contains(strings.ToLower(f.Name), q) || strings.Contains(f.Slug, q) {
			matches = append(matches, f)
		}
	}

	if len(matches) != 1 {
		t.Errorf("expected 1 match, got %d", len(matches))
	}
}

func TestSwitch_MultipleMatches(t *testing.T) {
	dir := setupTestRepo(t)
	createFeature(t, dir, "auth login", "feature")
	mustExec(t, dir, "git", "checkout", "main")
	createFeature(t, dir, "auth signup", "feature")
	mustExec(t, dir, "git", "checkout", "main")

	features := workspace.ListFeatures(dir)
	q := strings.ToLower("auth")

	var matches []workspace.FeatureData
	for _, f := range features {
		if strings.Contains(strings.ToLower(f.Name), q) || strings.Contains(f.Slug, q) {
			matches = append(matches, f)
		}
	}

	if len(matches) != 2 {
		t.Errorf("expected 2 matches, got %d", len(matches))
	}
}

func TestSwitch_NoMatch(t *testing.T) {
	dir := setupTestRepo(t)
	createFeature(t, dir, "login page", "feature")
	mustExec(t, dir, "git", "checkout", "main")

	features := workspace.ListFeatures(dir)
	q := strings.ToLower("nonexistent")

	var matches []workspace.FeatureData
	for _, f := range features {
		if strings.Contains(strings.ToLower(f.Name), q) || strings.Contains(f.Slug, q) {
			matches = append(matches, f)
		}
	}

	if len(matches) != 0 {
		t.Errorf("expected 0 matches, got %d", len(matches))
	}
}

func TestSwitch_MatchBySlug(t *testing.T) {
	dir := setupTestRepo(t)
	createFeature(t, dir, "Login Page System", "feature")
	mustExec(t, dir, "git", "checkout", "main")

	features := workspace.ListFeatures(dir)
	q := "login-page" // slug format

	var matches []workspace.FeatureData
	for _, f := range features {
		if strings.Contains(strings.ToLower(f.Name), strings.ToLower(q)) || strings.Contains(f.Slug, q) {
			matches = append(matches, f)
		}
	}

	if len(matches) != 1 {
		t.Errorf("expected 1 match by slug, got %d", len(matches))
	}
}

func TestSwitch_RefusesUncommittedChanges(t *testing.T) {
	dir := setupTestRepo(t)
	createFeature(t, dir, "switch from", "feature")
	writeTestFile(t, dir, "dirty.txt", "content")

	if !workspace.HasUncommittedChanges(dir) {
		t.Error("expected uncommitted changes")
	}
}

func TestSwitch_RefusesPendingRebase(t *testing.T) {
	dir := setupTestRepo(t)
	_ = createFeature(t, dir, "switch pending", "feature")

	_ = workspace.SavePendingRebase(workspace.PendingRebase{
		EditingDiff: "test",
		PreEditSHA:  "abc",
	}, dir)

	if !workspace.HasPendingRebase(dir) {
		t.Error("expected pending rebase")
	}
}

func TestSwitch_CaseInsensitiveMatch(t *testing.T) {
	dir := setupTestRepo(t)
	createFeature(t, dir, "Login Page", "feature")
	mustExec(t, dir, "git", "checkout", "main")

	features := workspace.ListFeatures(dir)
	q := strings.ToLower("LOGIN")

	var matches []workspace.FeatureData
	for _, f := range features {
		if strings.Contains(strings.ToLower(f.Name), q) || strings.Contains(f.Slug, q) {
			matches = append(matches, f)
		}
	}

	if len(matches) != 1 {
		t.Errorf("expected 1 case-insensitive match, got %d", len(matches))
	}
}
