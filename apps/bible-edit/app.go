package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/usfm-tools/bible-edit/internal/files"
	"github.com/usfm-tools/bible-edit/internal/session"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileEntry is a USFM file in the current folder.
type FileEntry struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// HostInfo is the shell host folder metadata exposed to the frontend.
type HostInfo struct {
	Label      string `json:"label"`
	FolderPath string `json:"folderPath"`
}

// App is the Wails application backend.
type App struct {
	ctx         context.Context
	files       *files.Service
	sessionPath string
	data        session.Data
	allowQuit   bool
}

// NewApp creates the application backend.
func NewApp() *App {
	return &App{
		files: files.NewService(),
		data: session.Data{
			RecentFolders: []session.RecentFolder{},
		},
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.sessionPath = defaultSessionPath()
	a.loadSession()
}

func defaultSessionPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return filepath.Join(os.TempDir(), files.SessionFileName)
	}
	return filepath.Join(configDir, "BibleEdit", files.SessionFileName)
}

func (a *App) loadSession() {
	raw, err := a.files.Read(a.sessionPath)
	if err != nil {
		return
	}
	var data session.Data
	if err := json.Unmarshal(raw, &data); err != nil {
		return
	}
	a.data = data
	if a.data.RecentFolders == nil {
		a.data.RecentFolders = []session.RecentFolder{}
	}
}

func (a *App) persistSession() error {
	raw, err := json.MarshalIndent(a.data, "", "  ")
	if err != nil {
		return err
	}
	return a.files.Write(a.sessionPath, raw)
}

func folderLabel(path string) string {
	if path == "" {
		return "No folder open"
	}
	return filepath.Base(path)
}

func (a *App) rememberFolder(path string) {
	if path == "" {
		return
	}
	entry := session.RecentFolder{Path: path, Label: folderLabel(path)}
	next := []session.RecentFolder{entry}
	for _, recent := range a.data.RecentFolders {
		if recent.Path == path {
			continue
		}
		next = append(next, recent)
	}
	a.data.RecentFolders = next
}

// GetHostInfo returns the current folder metadata for the shell host.
func (a *App) GetHostInfo() HostInfo {
	return HostInfo{
		Label:      folderLabel(a.data.CurrentFolder),
		FolderPath: a.data.CurrentFolder,
	}
}

// ListRecentFolders returns recently opened folders, most recent first.
func (a *App) ListRecentFolders() []session.RecentFolder {
	return a.data.RecentFolders
}

// OpenFolder switches to a folder by absolute path.
func (a *App) OpenFolder(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("not a directory: %s", path)
	}
	a.data.CurrentFolder = path
	a.rememberFolder(path)
	return a.persistSession()
}

// PickFolder prompts the user to choose a folder.
func (a *App) PickFolder() error {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open USFM folder",
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil
	}
	return a.OpenFolder(path)
}

// ListUsfmFiles lists *.usfm and *.sfm files in folderPath.
func (a *App) ListUsfmFiles(folderPath string) ([]FileEntry, error) {
	if folderPath == "" {
		return []FileEntry{}, nil
	}
	entries, err := os.ReadDir(folderPath)
	if err != nil {
		return nil, err
	}
	out := make([]FileEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))
		if ext != ".usfm" && ext != ".sfm" {
			continue
		}
		fullPath := filepath.Join(folderPath, name)
		out = append(out, FileEntry{ID: fullPath, Name: name})
	}
	return out, nil
}

// ReadFile reads an allowlisted USFM or session file.
func (a *App) ReadFile(path string) (string, error) {
	raw, err := a.files.Read(path)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

// ReadFilePickerHeader reads only the pre-chapter metadata used to index a file in the sidebar.
func (a *App) ReadFilePickerHeader(path string) (string, error) {
	return a.files.ReadPickerHeader(path)
}

// WriteFile writes an allowlisted USFM or session file.
func (a *App) WriteFile(path string, content string) error {
	return a.files.Write(path, []byte(content))
}

// LoadSettings returns persisted application settings, or nil for defaults.
func (a *App) LoadSettings() *session.ApplicationSettings {
	if a.data.Settings == nil {
		return nil
	}
	settings := *a.data.Settings
	return &settings
}

// SaveSettings persists application settings in the session file.
func (a *App) SaveSettings(settings session.ApplicationSettings) error {
	copy := settings
	a.data.Settings = &copy
	return a.persistSession()
}

// AllowQuitAndExit bypasses the close guard and quits the application.
func (a *App) AllowQuitAndExit() {
	a.allowQuit = true
	runtime.Quit(a.ctx)
}

// BeforeClose is invoked when the user attempts to close the window.
func (a *App) BeforeClose(ctx context.Context) bool {
	if a.allowQuit {
		return false
	}
	runtime.EventsEmit(ctx, "window:close-requested")
	return true
}

// SessionPath returns the absolute path of the session file (for debugging).
func (a *App) SessionPath() string {
	return a.sessionPath
}
