package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/git"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func newCloneCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "clone <repo>",
		Short: "Clone a repository and set up devpod",
		Long: `Clone a repository and initialize the devpod workspace.

Each feature you create will have two branches:
  feature/<slug>           Your working branch (clean commits)
  feature/<slug>--versions  Append-only history of every save`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			repo := args[0]

			// Resolve repo URL
			url := repo
			if !strings.Contains(repo, "://") && !strings.HasPrefix(repo, "git@") {
				url = "https://github.com/" + repo + ".git"
			}

			// Derive directory name from URL
			repoName := url
			repoName = strings.TrimSuffix(repoName, ".git")
			parts := strings.Split(repoName, "/")
			repoName = parts[len(parts)-1]
			if repoName == "" {
				repoName = "repo"
			}

			fmt.Printf("Cloning %s...\n", repo)

			if err := git.Clone(url, repoName); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			// Initialize .devpod workspace inside the cloned repo
			cwd, _ := os.Getwd()
			fullPath := filepath.Join(cwd, repoName)
			if err := workspace.EnsureDevpodDir(fullPath); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			// Add .devpod/ to .git/info/exclude
			excludePath := filepath.Join(fullPath, ".git", "info", "exclude")
			excludeDir := filepath.Dir(excludePath)
			_ = os.MkdirAll(excludeDir, 0o755)
			existing, _ := os.ReadFile(excludePath)
			if !strings.Contains(string(existing), ".devpod/") {
				content := strings.TrimRight(string(existing), "\n") + "\n.devpod/\n"
				_ = os.WriteFile(excludePath, []byte(content), 0o644)
			}

			fmt.Printf("%s Cloned to %s\n", format.SuccessMsg("\u2713"), repoName)
			fmt.Printf("  cd %s\n", repoName)
			fmt.Println(format.NextStepHint("clone"))
			return nil
		},
	}
}
