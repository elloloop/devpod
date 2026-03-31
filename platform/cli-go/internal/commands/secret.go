package commands

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/briandowns/spinner"
	"github.com/elloloop/devpod/platform/cli-go/internal/api"
	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

type secretEntry struct {
	Name   string `json:"name"`
	Source string `json:"source"`
}

type backendEntry struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Detail string `json:"detail"`
}

func newSecretCmd() *cobra.Command {
	secretCmd := &cobra.Command{
		Use:   "secret",
		Short: "Manage secrets",
	}

	// secret set <name> [value]
	setCmd := &cobra.Command{
		Use:   "set <name> [value]",
		Short: "Set a secret value",
		Args:  cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]

			if len(args) > 1 {
				// Value provided on command line
				value := args[1]
				if err := api.Put("/api/secrets/"+name, map[string]string{"value": value}, nil); err != nil {
					return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
				}
				fmt.Printf("%s Secret %s set\n", format.SuccessMsg("\u2713"), name)
				return nil
			}

			// Check if stdin has data (piped)
			stdinInfo, _ := os.Stdin.Stat()
			if stdinInfo.Mode()&os.ModeCharDevice == 0 {
				// Piped input
				scanner := bufio.NewScanner(os.Stdin)
				var lines []string
				for scanner.Scan() {
					lines = append(lines, scanner.Text())
				}
				stdinValue := strings.TrimSpace(strings.Join(lines, "\n"))
				if stdinValue != "" {
					if err := api.Put("/api/secrets/"+name, map[string]string{"value": stdinValue}, nil); err != nil {
						return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
					}
					fmt.Printf("%s Secret %s set\n", format.SuccessMsg("\u2713"), name)
					return nil
				}
			}

			// Interactive prompt with hidden input
			fmt.Printf("Enter value for %s: ", name)
			password, err := term.ReadPassword(int(os.Stdin.Fd()))
			fmt.Println()
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg("Failed to read input"))
			}

			secretValue := strings.TrimSpace(string(password))
			if secretValue == "" {
				return fmt.Errorf("%s", format.ErrorMsg("No value provided"))
			}

			if err := api.Put("/api/secrets/"+name, map[string]string{"value": secretValue}, nil); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}
			fmt.Printf("%s Secret %s set\n", format.SuccessMsg("\u2713"), name)
			return nil
		},
	}

	// secret list
	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List secret names",
		RunE: func(cmd *cobra.Command, args []string) error {
			var data []secretEntry
			if err := api.Get("/api/secrets", &data); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			if len(data) == 0 {
				fmt.Println(format.DimText("No secrets configured."))
				return nil
			}

			for _, s := range data {
				if s.Source != "" {
					fmt.Printf("%s  %s\n", s.Name, format.DimText(fmt.Sprintf("(%s)", s.Source)))
				} else {
					fmt.Println(s.Name)
				}
			}
			return nil
		},
	}

	// secret delete <name>
	deleteCmd := &cobra.Command{
		Use:   "delete <name>",
		Short: "Delete a secret",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]
			if err := api.Delete("/api/secrets/" + name); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}
			fmt.Printf("%s Secret %s deleted\n", format.SuccessMsg("\u2713"), name)
			return nil
		},
	}

	// secret import <file>
	importCmd := &cobra.Command{
		Use:   "import <file>",
		Short: "Import secrets from a .env file",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			file := args[0]

			if _, err := os.Stat(file); os.IsNotExist(err) {
				return fmt.Errorf("%s", format.ErrorMsg(fmt.Sprintf("File not found: %s", file)))
			}

			content, err := os.ReadFile(file)
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			lines := strings.Split(string(content), "\n")
			count := 0

			s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
			s.Suffix = " Importing secrets..."
			s.Start()

			for _, line := range lines {
				trimmed := strings.TrimSpace(line)
				if trimmed == "" || strings.HasPrefix(trimmed, "#") {
					continue
				}

				eqIdx := strings.Index(trimmed, "=")
				if eqIdx == -1 {
					continue
				}

				key := strings.TrimSpace(trimmed[:eqIdx])
				val := strings.TrimSpace(trimmed[eqIdx+1:])

				// Strip surrounding quotes
				if len(val) >= 2 {
					if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
						val = val[1 : len(val)-1]
					}
				}

				if key != "" {
					_ = api.Put("/api/secrets/"+key, map[string]string{"value": val}, nil)
					count++
				}
			}

			s.Stop()
			plural := "s"
			if count == 1 {
				plural = ""
			}
			fmt.Printf("%s Imported %d secret%s from %s\n", format.SuccessMsg("\u2713"), count, plural, file)
			return nil
		},
	}

	// secret sync
	syncCmd := &cobra.Command{
		Use:   "sync",
		Short: "Sync secrets from cloud backends",
		RunE: func(cmd *cobra.Command, args []string) error {
			s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
			s.Suffix = " Syncing secrets from backends..."
			s.Start()

			var result struct {
				Synced int `json:"synced"`
			}
			err := api.Post("/api/secrets/sync", nil, &result)
			s.Stop()
			if err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}
			plural := "s"
			if result.Synced == 1 {
				plural = ""
			}
			fmt.Printf("%s Synced %d secret%s from backends\n", format.SuccessMsg("\u2713"), result.Synced, plural)
			return nil
		},
	}

	// secret status
	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Show backend status",
		RunE: func(cmd *cobra.Command, args []string) error {
			var data []backendEntry
			if err := api.Get("/api/secrets/backends", &data); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}

			if len(data) == 0 {
				fmt.Println(format.DimText("No backends configured."))
				return nil
			}

			var rows [][]string
			for _, b := range data {
				icon := format.StatusIcon(b.Status)
				detail := ""
				if b.Detail != "" {
					detail = format.DimText(fmt.Sprintf(" (%s)", b.Detail))
				}
				rows = append(rows, []string{b.Name, fmt.Sprintf("%s %s%s", icon, b.Status, detail)})
			}

			fmt.Println(format.Table([]string{"Backend", "Status"}, rows))
			return nil
		},
	}

	secretCmd.AddCommand(setCmd)
	secretCmd.AddCommand(listCmd)
	secretCmd.AddCommand(deleteCmd)
	secretCmd.AddCommand(importCmd)
	secretCmd.AddCommand(syncCmd)
	secretCmd.AddCommand(statusCmd)

	return secretCmd
}
