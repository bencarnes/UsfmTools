package main

import (
	"strings"
	"sync"
	"testing"
	"time"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/engine"
)

// eventLog captures pushed analysis events for assertions.
type eventLog struct {
	mu     sync.Mutex
	events []AnalysisEvent
}

func (l *eventLog) emit(name string, payload AnalysisEvent) {
	if name != AnalysisEventName {
		panic("unexpected event name " + name)
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.events = append(l.events, payload)
}

// waitFor polls until cond returns true or the deadline passes.
func (l *eventLog) waitFor(t *testing.T, cond func([]AnalysisEvent) bool) []AnalysisEvent {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for {
		l.mu.Lock()
		events := append([]AnalysisEvent(nil), l.events...)
		l.mu.Unlock()
		if cond(events) {
			return events
		}
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for events; got %+v", events)
		}
		time.Sleep(2 * time.Millisecond)
	}
}

func newTestService(t *testing.T) (*UsfmService, *eventLog) {
	t.Helper()
	log := &eventLog{}
	s := NewUsfmService()
	s.init(log.emit)
	t.Cleanup(s.shutdown)
	return s, log
}

func TestOpenPushesAnalysis(t *testing.T) {
	s, log := newTestService(t)
	if err := s.OpenDocument("doc", 1, "\\id GEN\n\\zzz bad\n"); err != nil {
		t.Fatal(err)
	}
	events := log.waitFor(t, func(evs []AnalysisEvent) bool { return len(evs) >= 1 })
	ev := events[0]
	if ev.ID != "doc" || ev.Version != 1 {
		t.Errorf("event = %+v, want id doc version 1", ev)
	}
	if len(ev.Diagnostics) != 1 || !strings.Contains(ev.Diagnostics[0].Message, `\zzz`) {
		t.Errorf("diagnostics = %+v", ev.Diagnostics)
	}
}

func TestApplyChangesPushesFreshDiagnostics(t *testing.T) {
	s, log := newTestService(t)
	if err := s.OpenDocument("doc", 1, "\\id GEN\n\\p hello\n"); err != nil {
		t.Fatal(err)
	}
	log.waitFor(t, func(evs []AnalysisEvent) bool { return len(evs) >= 1 })

	// Replace "\p" (offset 8..10) with the unknown marker "\zzz".
	err := s.ApplyChanges("doc", 2, []engine.Change{{From: 8, To: 10, Text: "\\zzz"}})
	if err != nil {
		t.Fatal(err)
	}
	events := log.waitFor(t, func(evs []AnalysisEvent) bool {
		return len(evs) > 0 && evs[len(evs)-1].Version == 2
	})
	last := events[len(events)-1]
	if len(last.Diagnostics) != 1 {
		t.Errorf("diagnostics = %+v, want one unknown-marker error", last.Diagnostics)
	}
}

func TestApplyChangesRejectsStaleVersion(t *testing.T) {
	s, _ := newTestService(t)
	if err := s.OpenDocument("doc", 5, "\\id GEN\n"); err != nil {
		t.Fatal(err)
	}
	if err := s.ApplyChanges("doc", 5, nil); err == nil {
		t.Error("want stale-version error for version 5 -> 5")
	}
}

func TestCloseStopsPushes(t *testing.T) {
	s, log := newTestService(t)
	if err := s.OpenDocument("doc", 1, "\\id GEN\n"); err != nil {
		t.Fatal(err)
	}
	log.waitFor(t, func(evs []AnalysisEvent) bool { return len(evs) >= 1 })
	if err := s.CloseDocument("doc"); err != nil {
		t.Fatal(err)
	}
	if err := s.ApplyChanges("doc", 2, nil); err == nil {
		t.Error("want not-open error after close")
	}
	if _, err := s.GetDiagnostics("doc"); err == nil {
		t.Error("want not-open error from GetDiagnostics after close")
	}
}

func TestGetDiagnosticsPull(t *testing.T) {
	s, _ := newTestService(t)
	if err := s.OpenDocument("doc", 3, "\\id GEN\n\\zzz bad\n"); err != nil {
		t.Fatal(err)
	}
	res, err := s.GetDiagnostics("doc")
	if err != nil {
		t.Fatal(err)
	}
	if res.Version != 3 {
		t.Errorf("version = %d, want 3", res.Version)
	}
	if len(res.Diagnostics) != 1 || res.Diagnostics[0].Code != usfm.CodeUnknownMarker {
		t.Errorf("diagnostics = %+v", res.Diagnostics)
	}
}

func TestGetStructure(t *testing.T) {
	s, _ := newTestService(t)
	text := "\\id GEN Genesis\n\\c 1\n\\p\n\\v 1 In the beginning\n\\c 2\n\\p\n\\v 1 Thus\n"
	if err := s.OpenDocument("doc", 1, text); err != nil {
		t.Fatal(err)
	}
	res, err := s.GetStructure("doc")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Books) != 1 || res.Books[0].Code != "GEN" {
		t.Fatalf("books = %+v", res.Books)
	}
	chapters := res.Books[0].Chapters
	if len(chapters) != 2 || chapters[0].Number != "1" || chapters[1].Number != "2" {
		t.Errorf("chapters = %+v", chapters)
	}
}

func TestClassifyRange(t *testing.T) {
	s, _ := newTestService(t)
	if err := s.OpenDocument("doc", 1, "\\id GEN\n\\c 1\n\\p\n\\v 1 word\n"); err != nil {
		t.Fatal(err)
	}
	whole, err := s.ClassifyDocument("doc")
	if err != nil {
		t.Fatal(err)
	}
	if len(whole.Tokens) == 0 {
		t.Fatal("no tokens for whole document")
	}
	// The range covering only the first line classifies just \id.
	part, err := s.ClassifyRange("doc", 0, 7)
	if err != nil {
		t.Fatal(err)
	}
	if len(part.Tokens) != 1 || part.Tokens[0].Type != engine.KindMarker {
		t.Errorf("tokens = %+v, want a single marker token", part.Tokens)
	}
}

func TestGetCompletions(t *testing.T) {
	s, _ := newTestService(t)
	if err := s.OpenDocument("doc", 1, "\\id GEN\n\\v"); err != nil {
		t.Fatal(err)
	}
	items, err := s.GetCompletions("doc", 1, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) == 0 {
		t.Fatal("no completions for \\v prefix")
	}
	for _, item := range items {
		if !strings.HasPrefix(item.Label, "\\v") {
			t.Errorf("completion %q does not match prefix \\v", item.Label)
		}
	}
}

func TestRenderPreviewText(t *testing.T) {
	s, _ := newTestService(t)
	html := s.RenderPreviewText("\\id GEN\n\\c 1\n\\p\n\\v 1 A. \\v 2 B.", false)
	if !strings.Contains(html, `<article class="usfm-document" data-usfm-id="GEN">`) {
		t.Errorf("html = %q", html)
	}
	if html == s.RenderPreviewText("\\id GEN\n\\c 1\n\\p\n\\v 1 A. \\v 2 B.", true) {
		t.Error("versePerLine should change the HTML")
	}
}
