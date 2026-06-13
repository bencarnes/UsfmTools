package files

import (
	"fmt"
	"os"
	"path/filepath"
)

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

func (s *Service) Write(path string, content []byte) error {
	if !AllowedForWrite(path) {
		return fmt.Errorf("%w: %s", ErrAccessDenied, path)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, content, 0o644)
}
