package workspace

// ChangeType classifies the kind of code change.
type ChangeType string

const (
	Feature ChangeType = "feature"
	Fix     ChangeType = "fix"
	Docs    ChangeType = "docs"
	Chore   ChangeType = "chore"
	Unknown ChangeType = "unknown"
)

// DiffStatus tracks the review lifecycle of a diff.
type DiffStatus string

const (
	Draft     DiffStatus = "draft"
	Submitted DiffStatus = "submitted"
	Approved  DiffStatus = "approved"
	Landed    DiffStatus = "landed"
)

// FeatureStatus tracks the lifecycle of a feature.
type FeatureStatus string

const (
	Active           FeatureStatus = "active"
	FeatureSubmitted FeatureStatus = "submitted"
	Complete         FeatureStatus = "complete"
)

// FeatureData holds metadata for a feature branch.
type FeatureData struct {
	Name           string        `json:"name"`
	Type           ChangeType    `json:"type"`
	Slug           string        `json:"slug"`
	Branch         string        `json:"branch"`
	VersionsBranch string        `json:"versionsBranch"`
	Created        string        `json:"created"`
	Diffs          []string      `json:"diffs"`
	Status         FeatureStatus `json:"status"`
	SnapshotCount  int           `json:"snapshotCount"`
}

// DiffData holds metadata for a single diff in the stack.
type DiffData struct {
	ID          string        `json:"id"`
	UUID        string        `json:"uuid"`
	Feature     string        `json:"feature"`
	Commit      string        `json:"commit"`
	Position    int           `json:"position"`
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Type        ChangeType    `json:"type"`
	Files       []string      `json:"files"`
	Additions   int           `json:"additions"`
	Deletions   int           `json:"deletions"`
	Version     int           `json:"version"`
	Status      DiffStatus    `json:"status"`
	CI          string        `json:"ci"`
	GitHubPR    int           `json:"githubPr"`
	Versions    []DiffVersion `json:"versions"`
	Created     string        `json:"created"`
	Updated     string        `json:"updated"`
}

// DiffVersion represents a single version of a diff on the versions branch.
type DiffVersion struct {
	Number      int    `json:"number"`
	SnapshotID  string `json:"snapshotId"`
	SnapshotSHA string `json:"snapshotSha"`
	CleanSHA    string `json:"cleanSha"`
	Message     string `json:"message"`
	Action      string `json:"action"`
	Timestamp   string `json:"timestamp"`
}

// UndoEntry stores information needed to reverse an action.
type UndoEntry struct {
	Action      string                 `json:"action"`
	Timestamp   string                 `json:"timestamp"`
	RefBefore   string                 `json:"refBefore"`
	Description string                 `json:"description"`
	Data        map[string]interface{} `json:"data"`
}

// PendingRebase tracks state when a replay is in progress (for --continue/--abort).
type PendingRebase struct {
	EditingDiff     string   `json:"editingDiff"`
	PreEditSHA      string   `json:"preEditSha"`
	RemainingPicks  []string `json:"remainingPicks"`
	CompletedPicks  []string `json:"completedPicks"`
	PreEditSnapshot string   `json:"preEditSnapshot"`
}

// Config holds the devpod workspace configuration.
type Config struct {
	DefaultBranch string    `json:"defaultBranch"`
	LLM           LLMConfig `json:"llm"`
	CI            CIConfig  `json:"ci"`
	Aliases       bool      `json:"aliases"`
}

// LLMConfig holds LLM provider settings.
type LLMConfig struct {
	Enabled  bool   `json:"enabled"`
	Provider string `json:"provider"`
	URL      string `json:"url,omitempty"`
	Model    string `json:"model,omitempty"`
	APIKey   string `json:"apiKey,omitempty"`
}

// CIConfig holds CI settings.
type CIConfig struct {
	AutoRun bool `json:"autoRun"`
}
