package files

import (
	"errors"
	"path/filepath"
	"strings"
)

// SessionFileName is the exact basename allowed for the application session file.
const SessionFileName = "BibleEdit_Session.json"

// ErrAccessDenied is returned when a path is not an allowed USFM file or session file.
var ErrAccessDenied = errors.New("access denied: path is not an allowed USFM file or session file")

// IsUsfmPath reports whether path has a .usfm or .sfm extension (case-insensitive).
func IsUsfmPath(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".usfm" || ext == ".sfm"
}

// IsSessionPath reports whether path's basename is the session file.
func IsSessionPath(path string) bool {
	return filepath.Base(path) == SessionFileName
}

// AllowedForRead reports whether the Go file service may read path.
func AllowedForRead(path string) bool {
	return IsUsfmPath(path) || IsSessionPath(path)
}

// AllowedForWrite reports whether the Go file service may write path.
func AllowedForWrite(path string) bool {
	return IsUsfmPath(path) || IsSessionPath(path)
}
