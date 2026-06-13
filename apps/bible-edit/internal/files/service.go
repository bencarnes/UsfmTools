package files

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var chapterLinePattern = regexp.MustCompile(`^\s*\\c(\s|$)`)

// Service performs allowlisted file reads and writes.
type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) Read(path string) ([]byte, error) {
	if !AllowedForRead(path) {
		return nil, fmt.Errorf("%w: %s", ErrAccessDenied, path)
	}
	return os.ReadFile(path)
}

// ReadPickerHeader reads a USFM file line by line until the first \c chapter marker,
// returning only the pre-chapter metadata used to index the file in the sidebar picker.
func (s *Service) ReadPickerHeader(path string) (string, error) {
	if !AllowedForRead(path) {
		return "", fmt.Errorf("%w: %s", ErrAccessDenied, path)
	}

	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lines := make([]string, 0, 16)
	nonEmpty := false

	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) != "" {
			nonEmpty = true
		}
		if chapterLinePattern.MatchString(line) {
			break
		}
		lines = append(lines, line)
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}

	if !nonEmpty {
		return "", nil
	}

	header := strings.Join(lines, "\n")
	if strings.TrimSpace(header) == "" {
		return "\\p\n", nil
	}
	return header, nil
}

func (s *Service) Write(path string, content []byte) error {
	if !AllowedForWrite(path) {
		return fmt.Errorf("%w: %s", ErrAccessDenied, path)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, content, 0o644)
}
