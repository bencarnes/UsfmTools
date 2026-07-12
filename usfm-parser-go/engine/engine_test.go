package engine

import (
	"errors"
	"fmt"
	"testing"
	"time"

	usfm "github.com/usfm-tools/usfm-parser-go"
)

func waitAnalysis(t *testing.T, ch <-chan Analysis) Analysis {
	t.Helper()
	select {
	case a := <-ch:
		return a
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for analysis")
		return Analysis{}
	}
}

func expectQuiet(t *testing.T, ch <-chan Analysis, d time.Duration) {
	t.Helper()
	select {
	case a := <-ch:
		t.Fatalf("unexpected analysis delivered: id=%s version=%d", a.ID, a.Version)
	case <-time.After(d):
	}
}

func TestOpenDeliversInitialAnalysis(t *testing.T) {
	ch := make(chan Analysis, 16)
	e := New(Options{OnAnalysis: func(a Analysis) { ch <- a }})
	defer e.Shutdown()

	if err := e.Open("doc", 1, "\\id GEN\n\\zzz bad"); err != nil {
		t.Fatalf("Open = %v", err)
	}
	a := waitAnalysis(t, ch)
	if a.ID != "doc" || a.Version != 1 {
		t.Errorf("analysis = id %q version %d, want doc 1", a.ID, a.Version)
	}
	if len(a.Diagnostics) != 1 || a.Diagnostics[0].Code != usfm.CodeUnknownMarker {
		t.Errorf("diagnostics = %+v, want one unknown-marker", a.Diagnostics)
	}
	if a.Result.Document == nil || len(a.Result.Document.Children) == 0 {
		t.Errorf("analysis has no document AST")
	}

	got, ok := e.LatestAnalysis("doc")
	if !ok || got.Version != 1 {
		t.Errorf("LatestAnalysis = %+v, %v", got, ok)
	}
}

func TestEditTriggersReanalysis(t *testing.T) {
	ch := make(chan Analysis, 16)
	e := New(Options{OnAnalysis: func(a Analysis) { ch <- a }})
	defer e.Shutdown()

	if err := e.Open("doc", 1, "\\id GEN\n\\zzz bad"); err != nil {
		t.Fatalf("Open = %v", err)
	}
	waitAnalysis(t, ch)

	// Fix the bad marker: replace "zzz" (offsets 9–12) with "p"
	if err := e.ApplyChanges("doc", 2, []Change{{From: 9, To: 12, Text: "p"}}); err != nil {
		t.Fatalf("ApplyChanges = %v", err)
	}
	a := waitAnalysis(t, ch)
	if a.Version != 2 {
		t.Errorf("version = %d, want 2", a.Version)
	}
	if len(a.Diagnostics) != 0 {
		t.Errorf("diagnostics = %+v, want none after fix", a.Diagnostics)
	}
}

func TestRapidEditsAreCoalesced(t *testing.T) {
	gate := make(chan struct{})
	analyses := make(chan Analysis, 64)
	e := New(Options{OnAnalysis: func(a Analysis) { analyses <- a }})
	defer e.Shutdown()
	real := e.analyze
	e.analyze = func(s Snapshot) Analysis {
		<-gate // block until the test releases an analysis
		return real(s)
	}

	if err := e.Open("doc", 0, "\\id GEN"); err != nil {
		t.Fatalf("Open = %v", err)
	}
	// The worker is now blocked analyzing version 0. Pile up edits.
	for v := 1; v <= 20; v++ {
		if err := e.ApplyChanges("doc", v, []Change{{From: 0, To: 0, Text: "x"}}); err != nil {
			t.Fatalf("ApplyChanges(%d) = %v", v, err)
		}
	}
	// Release analyses until the final version lands. The 20 edits must
	// collapse into at most one more run (the latest snapshot), plus the
	// in-flight version-0 run.
	delivered := 0
	for {
		gate <- struct{}{}
		a := waitAnalysis(t, analyses)
		delivered++
		if a.Version == 20 {
			break
		}
		if delivered > 2 {
			t.Fatalf("analysis for version 20 not delivered after %d runs", delivered)
		}
	}
	if delivered > 2 {
		t.Errorf("delivered %d analyses for 21 versions, want at most 2", delivered)
	}
}

func TestDeliveredVersionsAreMonotonic(t *testing.T) {
	analyses := make(chan Analysis, 256)
	e := New(Options{OnAnalysis: func(a Analysis) { analyses <- a }})
	defer e.Shutdown()

	if err := e.Open("doc", 0, "\\id GEN\n\\p text"); err != nil {
		t.Fatalf("Open = %v", err)
	}
	for v := 1; v <= 100; v++ {
		if err := e.ApplyChanges("doc", v, []Change{{From: 0, To: 0, Text: "y"}}); err != nil {
			t.Fatalf("ApplyChanges(%d) = %v", v, err)
		}
	}
	last := -1
	for {
		a := waitAnalysis(t, analyses)
		if a.Version <= last {
			t.Fatalf("version %d delivered after %d", a.Version, last)
		}
		last = a.Version
		if last == 100 {
			break
		}
	}
}

func TestCloseStopsDeliveries(t *testing.T) {
	gate := make(chan struct{})
	analyses := make(chan Analysis, 16)
	e := New(Options{OnAnalysis: func(a Analysis) { analyses <- a }})
	defer e.Shutdown()
	real := e.analyze
	e.analyze = func(s Snapshot) Analysis {
		<-gate
		return real(s)
	}

	if err := e.Open("doc", 1, "\\id GEN"); err != nil {
		t.Fatalf("Open = %v", err)
	}
	// Close while the initial analysis is still blocked; its result must
	// be discarded, not delivered
	if err := e.Close("doc"); err != nil {
		t.Fatalf("Close = %v", err)
	}
	close(gate)
	expectQuiet(t, analyses, 200*time.Millisecond)

	if _, ok := e.LatestAnalysis("doc"); ok {
		t.Error("LatestAnalysis returned a result for a closed document")
	}
	if _, err := e.Snapshot("doc"); !errors.Is(err, ErrNotOpen) {
		t.Errorf("Snapshot = %v, want ErrNotOpen", err)
	}
}

func TestStoreErrorsPropagate(t *testing.T) {
	e := New(Options{})
	defer e.Shutdown()

	if err := e.ApplyChanges("nope", 1, nil); !errors.Is(err, ErrNotOpen) {
		t.Errorf("ApplyChanges = %v, want ErrNotOpen", err)
	}
	if err := e.Open("doc", 5, "x"); err != nil {
		t.Fatalf("Open = %v", err)
	}
	if err := e.Open("doc", 6, "y"); !errors.Is(err, ErrAlreadyOpen) {
		t.Errorf("second Open = %v, want ErrAlreadyOpen", err)
	}
	if err := e.ApplyChanges("doc", 5, nil); !errors.Is(err, ErrStaleVersion) {
		t.Errorf("ApplyChanges = %v, want ErrStaleVersion", err)
	}
	if err := e.Close("doc"); err != nil {
		t.Fatalf("Close = %v", err)
	}
	if err := e.Close("doc"); !errors.Is(err, ErrNotOpen) {
		t.Errorf("second Close = %v, want ErrNotOpen", err)
	}
}

func TestDebounceAbsorbsRapidEdits(t *testing.T) {
	analyses := make(chan Analysis, 64)
	e := New(Options{
		Debounce:   100 * time.Millisecond,
		OnAnalysis: func(a Analysis) { analyses <- a },
	})
	defer e.Shutdown()

	if err := e.Open("doc", 0, "\\id GEN"); err != nil {
		t.Fatalf("Open = %v", err)
	}
	// Edits spaced well inside the debounce window: the initial analysis
	// and all edits should collapse into a single run at the final version
	for v := 1; v <= 5; v++ {
		time.Sleep(10 * time.Millisecond)
		if err := e.ApplyChanges("doc", v, []Change{{From: 0, To: 0, Text: "x"}}); err != nil {
			t.Fatalf("ApplyChanges(%d) = %v", v, err)
		}
	}
	a := waitAnalysis(t, analyses)
	if a.Version != 5 {
		t.Errorf("first delivered version = %d, want 5 (debounced)", a.Version)
	}
	expectQuiet(t, analyses, 300*time.Millisecond)
}

func TestManyDocumentsIndependently(t *testing.T) {
	analyses := make(chan Analysis, 256)
	e := New(Options{OnAnalysis: func(a Analysis) { analyses <- a }})
	defer e.Shutdown()

	const docs = 8
	for d := 0; d < docs; d++ {
		id := fmt.Sprintf("doc-%d", d)
		if err := e.Open(id, 1, "\\id GEN\n\\p text"); err != nil {
			t.Fatalf("Open(%s) = %v", id, err)
		}
	}
	seen := map[string]bool{}
	for len(seen) < docs {
		a := waitAnalysis(t, analyses)
		seen[a.ID] = true
	}
}
