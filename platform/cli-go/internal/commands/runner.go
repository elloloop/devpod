package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"

	"github.com/elloloop/devpod/platform/cli-go/internal/api"
	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/spf13/cobra"
)

func pidDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local", "share", "devpod")
}

func pidFile() string {
	return filepath.Join(pidDir(), "runner.pid")
}

func ensurePidDir() {
	_ = os.MkdirAll(pidDir(), 0o755)
}

func readPid() int {
	data, err := os.ReadFile(pidFile())
	if err != nil {
		return 0
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return 0
	}

	// Check if process is alive
	process, err := os.FindProcess(pid)
	if err != nil {
		_ = os.Remove(pidFile())
		return 0
	}

	// On Unix, FindProcess always succeeds. Check with signal 0.
	if runtime.GOOS != "windows" {
		if err := process.Signal(syscall.Signal(0)); err != nil {
			_ = os.Remove(pidFile())
			return 0
		}
	}

	return pid
}

func newRunnerCmd() *cobra.Command {
	runnerCmd := &cobra.Command{
		Use:   "runner",
		Short: "Manage the local runner",
	}

	// runner start
	var workspacePath string
	var port string

	startCmd := &cobra.Command{
		Use:   "start",
		Short: "Start the runner",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Check if already running
			existingPid := readPid()
			if existingPid != 0 {
				if api.Ping() {
					fmt.Printf("Runner is already running %s\n", format.DimText(fmt.Sprintf("(PID %d)", existingPid)))
					return nil
				}
			}

			fmt.Printf("Starting runner on port %s for %s...\n", port, workspacePath)

			// Find the runner entry point relative to CLI location
			execPath, _ := os.Executable()
			cliDir := filepath.Dir(filepath.Dir(execPath))
			platformDir := filepath.Dir(cliDir)
			runnerDir := filepath.Join(platformDir, "runner")
			runnerEntry := filepath.Join(runnerDir, "src", "index.ts")

			var runnerCmdName string
			var runnerArgs []string

			if _, err := os.Stat(runnerEntry); err == nil {
				runnerCmdName = "npx"
				runnerArgs = []string{"tsx", runnerEntry}
			} else {
				runnerCmdName = "devpod-runner"
				runnerArgs = []string{}
			}

			child := exec.Command(runnerCmdName, runnerArgs...)
			child.Env = append(os.Environ(),
				"PORT="+port,
				"WORKSPACE="+workspacePath,
			)
			child.Dir = workspacePath
			child.Stdout = nil
			child.Stderr = nil
			child.Stdin = nil

			if err := child.Start(); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg("Failed to start runner"))
			}

			if child.Process != nil {
				ensurePidDir()
				_ = os.WriteFile(pidFile(), []byte(strconv.Itoa(child.Process.Pid)), 0o644)
				// Detach the child
				_ = child.Process.Release()

				fmt.Printf("%s Runner started %s\n", format.SuccessMsg("\u2713"),
					format.DimText(fmt.Sprintf("(PID %d)", child.Process.Pid)))
				fmt.Println(format.DimText(fmt.Sprintf("  http://localhost:%s", port)))
			} else {
				return fmt.Errorf("%s", format.ErrorMsg("Failed to start runner"))
			}

			return nil
		},
	}

	cwd, _ := os.Getwd()
	startCmd.Flags().StringVarP(&workspacePath, "workspace", "w", cwd, "Workspace path")
	startCmd.Flags().StringVarP(&port, "port", "p", "4800", "Port number")

	// runner stop
	stopCmd := &cobra.Command{
		Use:   "stop",
		Short: "Stop the runner",
		RunE: func(cmd *cobra.Command, args []string) error {
			pid := readPid()
			if pid == 0 {
				fmt.Println(format.DimText("Runner is not running (no PID file found)"))
				return nil
			}

			process, err := os.FindProcess(pid)
			if err != nil {
				fmt.Println(format.DimText("Runner process not found, cleaning up PID file"))
				_ = os.Remove(pidFile())
				return nil
			}

			if err := process.Signal(syscall.SIGTERM); err != nil {
				fmt.Println(format.DimText("Runner process not found, cleaning up PID file"))
				_ = os.Remove(pidFile())
				return nil
			}

			_ = os.Remove(pidFile())
			fmt.Printf("%s Runner stopped %s\n", format.SuccessMsg("\u2713"),
				format.DimText(fmt.Sprintf("(PID %d)", pid)))
			return nil
		},
	}

	// runner status
	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Check runner status",
		RunE: func(cmd *cobra.Command, args []string) error {
			isUp := api.Ping()
			pid := readPid()

			if isUp {
				pidStr := ""
				if pid != 0 {
					pidStr = format.DimText(fmt.Sprintf(" (PID %d)", pid))
				}
				fmt.Printf("%s Runner is running%s\n", format.SuccessMsg("\u2713"), pidStr)
			} else {
				fmt.Printf("%s Runner is not running\n", format.ErrorMsg("\u2717"))
				fmt.Println(format.DimText("  Start with: devpod runner start"))
			}
			return nil
		},
	}

	runnerCmd.AddCommand(startCmd)
	runnerCmd.AddCommand(stopCmd)
	runnerCmd.AddCommand(statusCmd)

	return runnerCmd
}
