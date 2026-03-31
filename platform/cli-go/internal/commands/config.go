package commands

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/elloloop/devpod/platform/cli-go/internal/format"
	"github.com/elloloop/devpod/platform/cli-go/internal/workspace"
	"github.com/spf13/cobra"
)

func parseConfigValue(raw string) interface{} {
	switch raw {
	case "true", "on", "yes":
		return true
	case "false", "off", "no":
		return false
	case "null":
		return nil
	}
	if num, err := strconv.ParseFloat(raw, 64); err == nil && strings.TrimSpace(raw) != "" {
		// Return as int if it's a whole number
		if num == float64(int(num)) {
			return int(num)
		}
		return num
	}
	return raw
}

func printConfig(cfg workspace.Config) {
	fmt.Println("Configuration")
	fmt.Println()
	fmt.Printf("  %s  %s\n", format.DimText("defaultBranch"), cfg.DefaultBranch)
	fmt.Println()
	fmt.Printf("  %s    %v\n", format.DimText("llm.enabled"), cfg.LLM.Enabled)
	fmt.Printf("  %s   %s\n", format.DimText("llm.provider"), cfg.LLM.Provider)
	if cfg.LLM.URL != "" {
		fmt.Printf("  %s        %s\n", format.DimText("llm.url"), cfg.LLM.URL)
	}
	if cfg.LLM.Model != "" {
		fmt.Printf("  %s      %s\n", format.DimText("llm.model"), cfg.LLM.Model)
	}
	if cfg.LLM.APIKey != "" {
		fmt.Printf("  %s     %s\n", format.DimText("llm.apiKey"), "********")
	}
	fmt.Println()
	fmt.Printf("  %s     %v\n", format.DimText("ci.autoRun"), cfg.CI.AutoRun)
	fmt.Printf("  %s        %v\n", format.DimText("aliases"), cfg.Aliases)
}

func newConfigCmd() *cobra.Command {
	configCmd := &cobra.Command{
		Use:   "config",
		Short: "View or update configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := workspace.LoadConfig()
			printConfig(cfg)
			return nil
		},
	}

	// config set <key> <value>
	setCmd := &cobra.Command{
		Use:   "set <key> <value>",
		Short: "Set a configuration value",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]
			value := args[1]

			cfg := workspace.LoadConfig()

			// Handle special shortcuts
			if key == "llm" && (value == "off" || value == "false") {
				cfg.LLM.Enabled = false
				if err := workspace.SaveConfig(cfg); err != nil {
					return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
				}
				fmt.Printf("%s LLM disabled\n", format.SuccessMsg("\u2713"))
				return nil
			}
			if key == "llm" && (value == "on" || value == "true") {
				cfg.LLM.Enabled = true
				if err := workspace.SaveConfig(cfg); err != nil {
					return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
				}
				fmt.Printf("%s LLM enabled\n", format.SuccessMsg("\u2713"))
				return nil
			}
			if key == "ci.auto" {
				key = "ci.autoRun"
			}

			parsed := parseConfigValue(value)

			// Set nested value
			switch key {
			case "defaultBranch":
				cfg.DefaultBranch = fmt.Sprintf("%v", parsed)
			case "llm.enabled":
				cfg.LLM.Enabled = parsed == true
			case "llm.provider":
				cfg.LLM.Provider = fmt.Sprintf("%v", parsed)
			case "llm.url":
				cfg.LLM.URL = fmt.Sprintf("%v", parsed)
			case "llm.model":
				cfg.LLM.Model = fmt.Sprintf("%v", parsed)
			case "llm.apiKey":
				cfg.LLM.APIKey = fmt.Sprintf("%v", parsed)
			case "ci.autoRun":
				cfg.CI.AutoRun = parsed == true
			case "aliases":
				cfg.Aliases = parsed == true
			default:
				return fmt.Errorf("%s", format.ErrorMsg(fmt.Sprintf("Unknown config key: %s", key)))
			}

			if err := workspace.SaveConfig(cfg); err != nil {
				return fmt.Errorf("%s", format.ErrorMsg(err.Error()))
			}
			fmt.Printf("%s Set %s = %v\n", format.SuccessMsg("\u2713"), key, parsed)
			return nil
		},
	}

	// config get <key>
	getCmd := &cobra.Command{
		Use:   "get <key>",
		Short: "Get a configuration value",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]
			cfg := workspace.LoadConfig()

			var val interface{}
			switch key {
			case "defaultBranch":
				val = cfg.DefaultBranch
			case "llm.enabled":
				val = cfg.LLM.Enabled
			case "llm.provider":
				val = cfg.LLM.Provider
			case "llm.url":
				val = cfg.LLM.URL
			case "llm.model":
				val = cfg.LLM.Model
			case "llm.apiKey":
				val = cfg.LLM.APIKey
			case "ci.autoRun":
				val = cfg.CI.AutoRun
			case "aliases":
				val = cfg.Aliases
			default:
				fmt.Println(format.DimText(fmt.Sprintf("%s is not set", key)))
				return nil
			}

			fmt.Println(val)
			return nil
		},
	}

	configCmd.AddCommand(setCmd)
	configCmd.AddCommand(getCmd)

	return configCmd
}
