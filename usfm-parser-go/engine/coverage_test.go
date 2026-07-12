package engine

import (
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

// Additional engine coverage: staleness across close/reopen, analysis lag
// semantics, feature-request edge cases, and whole-engine concurrency.

// TestReopenDiscardsInFlightAnalysis pins the worker identity check: an
// analysis in flight when its document is closed must not be delivered or
// recorded for a NEW document opened under the same id.
func TestReopenDiscardsInFlightAnalysis(t *testing.T) {
	gate := make(chan struct{})
	analyses := make(chan Analysis, 16)
	e := New(Options{OnAnalysis: func(a Analysis) { analyses <- a }})
	defer e.Shutdown()
	real := e.analyze
	blocking := true
	e.analyze = func(s Snapshot) Analysis {
		if blocking {
			<-gate
		}
		return real(s)
	}

	// Old incarnation: version 9, analysis blocked
	if err := e.Open("doc", 9, "\\id GEN\n\\p old"); err != nil {
		t.Fatalf("Open = %v", err)
	}
	if err := e.Close("doc"); err != nil {
		t.Fatalf("Close = %v", err)
	}

	// New incarnation under the same id, with a LOWER version — if the old
	// in-flight result (version 9) leaked into the new state, it would mask
	// the new analysis (version 1) forever
	blocking = false
	if err := e.Open("doc", 1, "\\id EXO\n\\p new"); err != nil {
		t.Fatalf("reopen = %v", err)
	}
	a := waitAnalysis(t, analyses)
	if a.Version != 1 || a.Result.Document.Children[0].Code != "EXO" {
		t.Fatalf("first delivery after reopen = version %d code %q, want 1 EXO",
			a.Version, a.Result.Document.Children[0].Code)
	}

	// Release the old analysis; it must be dropped, not delivered
	close(gate)
	expectQuiet(t, analyses, 200*time.Millisecond)
	got, ok := e.LatestAnalysis("doc")
	if !ok || got.Version != 1 || got.Result.Document.Children[0].Code != "EXO" {
		t.Errorf("LatestAnalysis = %+v, %v; want the EXO analysis at version 1", got, ok)
	}
}

// TestPullLagsThenCatchesUp documents the pull semantics: while re-analysis
// is in flight the pull serves the previous version; after the push lands it
// serves the new one.
func TestPullLagsThenCatchesUp(t *testing.T) {
	gate := make(chan struct{}, 64)
	gate <- struct{}{} // let the initial analysis through
	analyses := make(chan Analysis, 16)
	e := New(Options{OnAnalysis: func(a Analysis) { analyses <- a }})
	defer e.Shutdown()
	real := e.analyze
	e.analyze = func(s Snapshot) Analysis {
		<-gate
		return real(s)
	}

	if err := e.Open("doc", 1, "\\id GEN\n\\p one"); err != nil {
		t.Fatalf("Open = %v", err)
	}
	waitAnalysis(t, analyses)

	// Edit; the re-analysis is blocked, so a pull lags at version 1
	if err := e.ApplyChanges("doc", 2, []Change{{From: 0, To: 0, Text: "x"}}); err != nil {
		t.Fatalf("ApplyChanges = %v", err)
	}
	if _, version, err := e.Diagnostics("doc"); err != nil || version != 1 {
		t.Errorf("Diagnostics while in flight = version %d, %v; want 1 (lag)", version, err)
	}

	// Unblock; after the push, pulls serve version 2
	gate <- struct{}{}
	a := waitAnalysis(t, analyses)
	if a.Version != 2 {
		t.Fatalf("pushed version = %d, want 2", a.Version)
	}
	if _, version, err := e.Diagnostics("doc"); err != nil || version != 2 {
		t.Errorf("Diagnostics after push = version %d, %v; want 2", version, err)
	}
}

func TestClassifyRangeClamping(t *testing.T) {
	content := "\\p\n\\v 1 Text"
	e := openDoc(t, content)
	tests := []struct {
		name     string
		from, to int
		empty    bool
	}{
		{"negative from", -5, len(content), false},
		// from past the end clamps to the last line (matching the TS
		// classifyTokensInRange), so its tokens are still returned
		{"from past end", len(content) + 10, len(content) + 20, false},
		// to < from clamps to = from; the line-start widening still
		// classifies the prefix of that line (matching TS max(from, to))
		{"to before from", 8, 2, false},
		{"empty at zero", 0, 0, true},
		{"to past end", 0, len(content) + 100, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tokens, _, err := e.ClassifyRange("doc", tt.from, tt.to)
			if err != nil {
				t.Fatalf("ClassifyRange = %v", err)
			}
			if tt.empty && len(tokens) != 0 {
				t.Errorf("tokens = %+v, want none", tokens)
			}
			if !tt.empty && len(tokens) == 0 {
				t.Error("tokens empty, want some")
			}
		})
	}
}

func TestCompletionsUTF16Column(t *testing.T) {
	// '𝕊' is 2 UTF-16 units (columns 3–4), so "\q" spans columns 6–7 and
	// the cursor right after it is at column 8
	e := openDoc(t, "\\p 𝕊 \\q")
	items, err := e.Completions("doc", 0, 8)
	if err != nil {
		t.Fatalf("Completions = %v", err)
	}
	if len(items) == 0 {
		t.Fatal("no completions after \\q with non-BMP text on the line")
	}
	for _, item := range items {
		if !strings.HasPrefix(item.Label, `\q`) {
			t.Errorf("item %q does not match prefix \\q", item.Label)
		}
	}
}

func TestStructureMultipleBooks(t *testing.T) {
	e := openDoc(t, "\\id GEN\n\\c 1\n\\p\n\\v 1 A.\n\\id EXO\n\\c 1\n\\p\n\\v 1 B.\n\\c 2\n\\p\n\\v 1 C.")
	books, _, err := e.Structure("doc")
	if err != nil {
		t.Fatalf("Structure = %v", err)
	}
	if len(books) != 2 {
		t.Fatalf("books = %d, want 2", len(books))
	}
	if books[0].Code != "GEN" || len(books[0].Chapters) != 1 {
		t.Errorf("book 0 = %+v", books[0])
	}
	if books[1].Code != "EXO" || len(books[1].Chapters) != 2 {
		t.Errorf("book 1 = %+v", books[1])
	}
}

// TestEngineConcurrentStress exercises the whole engine surface at once
// under the race detector: per-document editors racing against feature
// pulls and pushed analyses.
func TestEngineConcurrentStress(t *testing.T) {
	e := New(Options{OnAnalysis: func(Analysis) {}})
	defer e.Shutdown()

	const docs = 4
	const versions = 30
	var wg sync.WaitGroup
	for d := 0; d < docs; d++ {
		id := fmt.Sprintf("doc-%d", d)
		if err := e.Open(id, 0, "\\id GEN\n\\c 1\n\\p\n\\v 1 In the beginning."); err != nil {
			t.Fatalf("Open(%s) = %v", id, err)
		}
		wg.Add(2)
		go func() { // editor
			defer wg.Done()
			for v := 1; v <= versions; v++ {
				if err := e.ApplyChanges(id, v, []Change{{From: 8, To: 8, Text: "\\zzz "}}); err != nil {
					t.Errorf("ApplyChanges(%s, %d) = %v", id, v, err)
					return
				}
			}
		}()
		go func() { // reader pulling every feature
			defer wg.Done()
			for i := 0; i < versions; i++ {
				if _, _, err := e.Diagnostics(id); err != nil {
					t.Errorf("Diagnostics(%s) = %v", id, err)
					return
				}
				if _, _, err := e.ClassifyRange(id, 0, 40); err != nil {
					t.Errorf("ClassifyRange(%s) = %v", id, err)
					return
				}
				if _, err := e.Completions(id, 0, 1); err != nil {
					t.Errorf("Completions(%s) = %v", id, err)
					return
				}
				if _, _, err := e.Structure(id); err != nil {
					t.Errorf("Structure(%s) = %v", id, err)
					return
				}
			}
		}()
	}
	wg.Wait()

	for d := 0; d < docs; d++ {
		id := fmt.Sprintf("doc-%d", d)
		snap, err := e.Snapshot(id)
		if err != nil || snap.Version != versions {
			t.Errorf("final snapshot(%s) = %+v, %v", id, snap, err)
		}
		if err := e.Close(id); err != nil {
			t.Errorf("Close(%s) = %v", id, err)
		}
	}
}
