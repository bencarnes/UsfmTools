package engine

import (
	"sync"
	"time"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/diagnostics"
	"github.com/usfm-tools/usfm-parser-go/parser"
)

// Analysis is the result of analyzing one version of a document.
type Analysis struct {
	ID          string            `json:"id"`
	Version     int               `json:"version"`
	Result      usfm.ParseResult  `json:"result"`
	Diagnostics []usfm.Diagnostic `json:"diagnostics"`
}

// Options configures an Engine.
type Options struct {
	// Debounce delays analysis after an edit; further edits within the
	// window restart the wait. Zero analyzes as soon as the worker is free
	// (rapid edits are still coalesced: the worker always analyzes the
	// latest snapshot, skipping intermediate versions).
	Debounce time.Duration
	// OnAnalysis, if set, is called whenever a fresh analysis completes.
	// It runs on the document's worker goroutine, so it must not block for
	// long and must be safe to call concurrently for different documents.
	// Versions are monotonically increasing per document; stale results
	// are dropped by the engine and never delivered.
	OnAnalysis func(Analysis)
}

// Engine is the asynchronous USFM analysis engine. Documents are kept in
// sync via Open / ApplyChanges / Close; each open document has a worker
// goroutine that re-analyzes it after changes and reports through
// Options.OnAnalysis. All methods are safe for concurrent use.
type Engine struct {
	store      *DocumentStore
	debounce   time.Duration
	onAnalysis func(Analysis)
	// analyze is the analysis function; a test seam, overridden only in
	// engine tests
	analyze func(Snapshot) Analysis

	mu   sync.Mutex
	docs map[string]*docState
}

type docState struct {
	dirty  chan struct{} // capacity 1: pending-work signal, coalesces edits
	stop   chan struct{}
	latest *Analysis // most recent delivered analysis
}

// New creates an engine. Call Shutdown when done to stop the workers.
func New(opts Options) *Engine {
	return &Engine{
		store:      NewDocumentStore(),
		debounce:   opts.Debounce,
		onAnalysis: opts.OnAnalysis,
		analyze:    analyzeSnapshot,
		docs:       map[string]*docState{},
	}
}

func analyzeSnapshot(snap Snapshot) Analysis {
	result := parser.Parse(snap.Text)
	return Analysis{
		ID:          snap.ID,
		Version:     snap.Version,
		Result:      result,
		Diagnostics: diagnostics.FromParseResult(snap.Text, result),
	}
}

// Open registers a document and schedules its initial analysis.
func (e *Engine) Open(id string, version int, text string) error {
	if err := e.store.Open(id, version, text); err != nil {
		return err
	}
	st := &docState{
		dirty: make(chan struct{}, 1),
		stop:  make(chan struct{}),
	}
	e.mu.Lock()
	e.docs[id] = st
	e.mu.Unlock()
	go e.worker(id, st)
	signal(st.dirty)
	return nil
}

// ApplyChanges applies an edit batch (see DocumentStore.ApplyChanges for
// the change convention) and schedules re-analysis.
func (e *Engine) ApplyChanges(id string, version int, changes []Change) error {
	if _, err := e.store.ApplyChanges(id, version, changes); err != nil {
		return err
	}
	e.mu.Lock()
	st := e.docs[id]
	e.mu.Unlock()
	if st != nil {
		signal(st.dirty)
	}
	return nil
}

// Close forgets a document and stops its worker. No further analyses are
// delivered for it.
func (e *Engine) Close(id string) error {
	if err := e.store.Close(id); err != nil {
		return err
	}
	e.mu.Lock()
	st := e.docs[id]
	delete(e.docs, id)
	e.mu.Unlock()
	if st != nil {
		close(st.stop)
	}
	return nil
}

// Shutdown closes all documents and stops all workers.
func (e *Engine) Shutdown() {
	e.mu.Lock()
	docs := e.docs
	e.docs = map[string]*docState{}
	e.mu.Unlock()
	for id, st := range docs {
		close(st.stop)
		_ = e.store.Close(id)
	}
}

// Snapshot returns the engine's current copy of an open document.
func (e *Engine) Snapshot(id string) (Snapshot, error) {
	return e.store.Snapshot(id)
}

// LatestAnalysis returns the most recent analysis delivered for a document,
// if any. It may lag the document version while re-analysis is in flight.
func (e *Engine) LatestAnalysis(id string) (Analysis, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	st := e.docs[id]
	if st == nil || st.latest == nil {
		return Analysis{}, false
	}
	return *st.latest, true
}

// signal marks a document dirty without blocking (the capacity-1 channel
// already carries a pending signal if the send would block).
func signal(dirty chan struct{}) {
	select {
	case dirty <- struct{}{}:
	default:
	}
}

// worker is the per-document analysis loop: wait for a dirty signal
// (optionally letting a debounce window absorb further edits), analyze the
// latest snapshot, and deliver the result unless it is stale by then.
func (e *Engine) worker(id string, st *docState) {
	for {
		select {
		case <-st.stop:
			return
		case <-st.dirty:
		}

		if e.debounce > 0 && !e.debounceWait(st) {
			return
		}

		snap, err := e.store.Snapshot(id)
		if err != nil {
			// Document closed while the signal was pending; stop is
			// closed or about to be
			continue
		}
		if latest, ok := e.LatestAnalysis(id); ok && latest.Version >= snap.Version {
			continue
		}

		analysis := e.analyze(snap)

		if e.deliver(id, st, analysis) && e.onAnalysis != nil {
			e.onAnalysis(analysis)
		}
	}
}

// debounceWait absorbs dirty signals until the document has been quiet for
// the debounce window. Returns false when the worker should exit.
func (e *Engine) debounceWait(st *docState) bool {
	timer := time.NewTimer(e.debounce)
	defer timer.Stop()
	for {
		select {
		case <-st.stop:
			return false
		case <-st.dirty:
			if !timer.Stop() {
				<-timer.C
			}
			timer.Reset(e.debounce)
		case <-timer.C:
			return true
		}
	}
}

// deliver records the analysis as latest unless the document was closed or
// a newer analysis already landed. Reports whether it was recorded.
func (e *Engine) deliver(id string, st *docState, analysis Analysis) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.docs[id] != st {
		return false // closed (and possibly reopened) while analyzing
	}
	if st.latest != nil && st.latest.Version >= analysis.Version {
		return false
	}
	st.latest = &analysis
	return true
}
