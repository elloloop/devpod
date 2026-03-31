package commands

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/spf13/cobra"
)

func newDashboardCmd() *cobra.Command {
	var port string

	cmd := &cobra.Command{
		Use:   "dashboard",
		Short: "Start the web dashboard",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Find the web dashboard relative to CLI location
			execPath, _ := os.Executable()
			cliDir := filepath.Dir(filepath.Dir(execPath))
			platformDir := filepath.Dir(cliDir)
			webDir := filepath.Join(platformDir, "web")

			if _, err := os.Stat(webDir); os.IsNotExist(err) {
				fmt.Printf("%s\n", format.ErrorMsg(fmt.Sprintf("Dashboard not found at %s", webDir)))
				fmt.Println(format.DimText("Expected the web dashboard at platform/web/"))
				return fmt.Errorf("dashboard not found")
			}

			fmt.Printf("Starting dashboard on port %s...\n", port)

			child := exec.Command("npm", "run", "dev", "--", "--port", port)
			child.Dir = webDir
			child.Stdout = os.Stdout
			child.Stderr = os.Stderr
			child.Stdin = os.Stdin
			child.Env = append(os.Environ(), "PORT="+port)

			if err := child.Start(); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(fmt.Sprintf("Failed to start dashboard: %s", err.Error())))
			}

			// Handle SIGINT/SIGTERM to cleanly shut down child
			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

			doneCh := make(chan error, 1)
			go func() {
				doneCh <- child.Wait()
			}()

			select {
			case <-sigCh:
				_ = child.Process.Signal(syscall.SIGTERM)
				return nil
			case err := <-doneCh:
				if err != nil {
					if exitErr, ok := err.(*exec.ExitError); ok {
						os.Exit(exitErr.ExitCode())
					}
					return err
				}
				return nil
			}
		},
	}

	cmd.Flags().StringVarP(&port, "port", "p", "3000", "Port number")

	return cmd
}
