package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// DefaultRunnerURL is the default address for the local runner.
const DefaultRunnerURL = "http://localhost:4800"

const requestTimeout = 5 * time.Second

// ApiError represents a non-2xx response from the runner.
type ApiError struct {
	Status     int
	StatusText string
	Body       string
}

func (e *ApiError) Error() string {
	return fmt.Sprintf("API error %d %s: %s", e.Status, e.StatusText, e.Body)
}

// ConnectionError represents a failure to connect to the runner.
type ConnectionError struct {
	URL   string
	Cause error
}

func (e *ConnectionError) Error() string {
	return fmt.Sprintf("Cannot connect to runner at %s. Is it running? Try: devpod start", e.URL)
}

func (e *ConnectionError) Unwrap() error {
	return e.Cause
}

// GetRunnerURL returns the runner URL from the environment or the default.
func GetRunnerURL() string {
	if url := os.Getenv("DEVPOD_RUNNER_URL"); url != "" {
		return url
	}
	return DefaultRunnerURL
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

func doRequest(method, path string, body interface{}, result interface{}) error {
	baseURL := GetRunnerURL()
	url := baseURL + path

	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(data)
	}

	ctx, cancel := context.WithTimeout(context.Background(), requestTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return &ConnectionError{URL: baseURL, Cause: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		text, _ := io.ReadAll(resp.Body)
		return &ApiError{
			Status:     resp.StatusCode,
			StatusText: resp.Status,
			Body:       string(text),
		}
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if len(respBody) == 0 || result == nil {
		return nil
	}

	return json.Unmarshal(respBody, result)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Get performs a GET request and decodes the result.
func Get(path string, result interface{}) error {
	return doRequest(http.MethodGet, path, nil, result)
}

// Post performs a POST request with a JSON body and decodes the result.
func Post(path string, body interface{}, result interface{}) error {
	return doRequest(http.MethodPost, path, body, result)
}

// Put performs a PUT request with a JSON body and decodes the result.
func Put(path string, body interface{}, result interface{}) error {
	return doRequest(http.MethodPut, path, body, result)
}

// Delete performs a DELETE request.
func Delete(path string) error {
	return doRequest(http.MethodDelete, path, nil, nil)
}

// Ping checks if the runner is reachable.
func Ping() bool {
	err := Get("/api/health", nil)
	return err == nil
}

// ---------------------------------------------------------------------------
// SSE streaming
// ---------------------------------------------------------------------------

// StreamEvents connects to an SSE endpoint and calls onEvent for each event.
// It blocks until the stream ends or an error occurs.
func StreamEvents(path string, onEvent func(eventType string, data []byte)) error {
	baseURL := GetRunnerURL()
	url := baseURL + path

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return &ConnectionError{URL: baseURL, Cause: err}
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	currentEvent := "message"

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "event:") {
			currentEvent = strings.TrimSpace(line[6:])
		} else if strings.HasPrefix(line, "data:") {
			raw := strings.TrimSpace(line[5:])
			onEvent(currentEvent, []byte(raw))
			currentEvent = "message"
		}
		// Empty lines mark end of event blocks; handled inline above
	}

	return scanner.Err()
}
