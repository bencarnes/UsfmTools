package main

import (
	"context"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/engine"
	"github.com/usfm-tools/usfm-parser-go/preview"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// AnalysisEventName is the Wails event carrying fresh analysis results
// (diagnostics) pushed from the engine to the frontend.
const AnalysisEventName = "usfm:analysis"

// AnalysisEvent is the payload of AnalysisEventName. The AST stays on the Go
// side; only editor-facing results cross the bridge.
type AnalysisEvent struct {
	ID          string            `json:"id"`
	Version     int               `json:"version"`
	Diagnostics []usfm.Diagnostic `json:"diagnostics"`
}

// DiagnosticsResult is a pulled diagnostics response. Version is the
// analyzed document version, which may briefly lag the editor's version
// while re-analysis is in flight (a push follows when it lands).
type DiagnosticsResult struct {
	Version     int               `json:"version"`
	Diagnostics []usfm.Diagnostic `json:"diagnostics"`
}

// TokensResult is a syntax-classification response for a document or range.
type TokensResult struct {
	Version int                      `json:"version"`
	Tokens  []engine.ClassifiedToken `json:"tokens"`
}

// StructureResult is the book/chapter outline of a document.
type StructureResult struct {
	Version int               `json:"version"`
	Books   []engine.BookInfo `json:"books"`
}

// PreviewResult is rendered preview HTML for a document as of Version.
type PreviewResult struct {
	Version int    `json:"version"`
	Html    string `json:"html"`
}

// UsfmService exposes the Go USFM engine to the frontend as Wails bound
// methods. The frontend keeps each open editor document in sync via
// OpenDocument / ApplyChanges / CloseDocument (LSP-style, with versions) and
// pulls features on demand; analyses run asynchronously in the engine and
// are pushed as AnalysisEventName events.
type UsfmService struct {
	engine *engine.Engine
	// emit publishes a Wails event; a seam so tests can capture pushes.
	emit func(name string, payload AnalysisEvent)
}

// NewUsfmService creates the service. startup must run before any bound
// method is called (Wails guarantees this: bound calls arrive only after
// OnStartup returns).
func NewUsfmService() *UsfmService {
	return &UsfmService{}
}

func (s *UsfmService) startup(ctx context.Context) {
	s.init(func(name string, payload AnalysisEvent) {
		runtime.EventsEmit(ctx, name, payload)
	})
}

// init creates the engine with the given event publisher (split from startup
// so tests can capture pushes without a Wails runtime context).
func (s *UsfmService) init(emit func(name string, payload AnalysisEvent)) {
	s.emit = emit
	// No debounce: the engine already coalesces rapid edits by always
	// analyzing the latest snapshot, so results arrive as fast as parsing
	// allows without a timer adding latency.
	s.engine = engine.New(engine.Options{
		OnAnalysis: func(a engine.Analysis) {
			s.emit(AnalysisEventName, AnalysisEvent{
				ID:          a.ID,
				Version:     a.Version,
				Diagnostics: a.Diagnostics,
			})
		},
	})
}

func (s *UsfmService) shutdown() {
	if s.engine != nil {
		s.engine.Shutdown()
	}
}

// OpenDocument registers a document with the engine and schedules its
// initial analysis. id is any stable identifier chosen by the frontend
// (e.g. the file path).
func (s *UsfmService) OpenDocument(id string, version int, text string) error {
	return s.engine.Open(id, version, text)
}

// ApplyChanges forwards an editor edit batch. Changes use UTF-16 offsets
// into the pre-batch document (CodeMirror iterChanges convention); version
// must be greater than the document's current version.
func (s *UsfmService) ApplyChanges(id string, version int, changes []engine.Change) error {
	return s.engine.ApplyChanges(id, version, changes)
}

// CloseDocument forgets a document. No further analyses are pushed for it.
func (s *UsfmService) CloseDocument(id string) error {
	return s.engine.Close(id)
}

// GetDiagnostics pulls the latest diagnostics for a document.
func (s *UsfmService) GetDiagnostics(id string) (DiagnosticsResult, error) {
	diags, version, err := s.engine.Diagnostics(id)
	if err != nil {
		return DiagnosticsResult{}, err
	}
	return DiagnosticsResult{Version: version, Diagnostics: diags}, nil
}

// GetStructure pulls the book/chapter outline for a document.
func (s *UsfmService) GetStructure(id string) (StructureResult, error) {
	books, version, err := s.engine.Structure(id)
	if err != nil {
		return StructureResult{}, err
	}
	return StructureResult{Version: version, Books: books}, nil
}

// ClassifyDocument returns syntax-highlight tokens for the whole document.
func (s *UsfmService) ClassifyDocument(id string) (TokensResult, error) {
	tokens, version, err := s.engine.Classify(id)
	if err != nil {
		return TokensResult{}, err
	}
	return TokensResult{Version: version, Tokens: tokens}, nil
}

// ClassifyRange returns syntax-highlight tokens for the slice between the
// UTF-16 offsets from and to (e.g. the editor viewport).
func (s *UsfmService) ClassifyRange(id string, from, to int) (TokensResult, error) {
	tokens, version, err := s.engine.ClassifyRange(id, from, to)
	if err != nil {
		return TokensResult{}, err
	}
	return TokensResult{Version: version, Tokens: tokens}, nil
}

// GetCompletions returns completion items at the given cursor position
// (0-based line, UTF-16 column): markers while typing "\..." and book codes
// in the argument of \id.
func (s *UsfmService) GetCompletions(id string, line, column int) ([]engine.CompletionItem, error) {
	return s.engine.Completions(id, line, column)
}

// RenderPreviewDocument renders the engine's synced copy of an open document
// as publication-style preview HTML. Preferred over RenderPreviewText when an
// editor document is mounted: the request ships only the id, not the text.
func (s *UsfmService) RenderPreviewDocument(id string, versePerLine bool) (PreviewResult, error) {
	html, version, err := s.engine.RenderPreview(id, preview.Options{VersePerLine: versePerLine})
	if err != nil {
		return PreviewResult{}, err
	}
	return PreviewResult{Version: version, Html: html}, nil
}

// RenderPreviewText renders a USFM string as publication-style preview HTML.
// Stateless fallback for tabs whose editor (and therefore engine document) is
// not mounted, e.g. in preview-only view mode.
func (s *UsfmService) RenderPreviewText(text string, versePerLine bool) string {
	return preview.Render(text, preview.Options{VersePerLine: versePerLine})
}
