// Package engine is the stateful editing engine behind bible-edit's USFM
// support. Modeled on the LSP document lifecycle but simplified: the engine
// keeps its own copy of each open document, kept in sync by the editor via
// Open / ApplyChanges / Close with monotonically increasing versions.
package engine

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"unicode/utf8"
)

// Change is one text replacement. From and To are UTF-16 code-unit offsets
// (JavaScript string indices, as used by CodeMirror) into the document as it
// was before the whole batch was applied — the convention of CodeMirror's
// ChangeSet.iterChanges. A batch must be sorted ascending by From and its
// ranges must not overlap.
type Change struct {
	From int    `json:"from"`
	To   int    `json:"to"`
	Text string `json:"text"`
}

// Snapshot is an immutable view of an open document at a specific version.
type Snapshot struct {
	ID      string `json:"id"`
	Version int    `json:"version"`
	Text    string `json:"text"`
}

var (
	ErrNotOpen      = errors.New("document not open")
	ErrAlreadyOpen  = errors.New("document already open")
	ErrStaleVersion = errors.New("stale document version")
	ErrInvalidEdit  = errors.New("invalid edit")
)

// DocumentStore holds the engine's copies of open documents. It is safe for
// concurrent use.
type DocumentStore struct {
	mu   sync.RWMutex
	docs map[string]*Snapshot
}

func NewDocumentStore() *DocumentStore {
	return &DocumentStore{docs: map[string]*Snapshot{}}
}

// Open registers a document with its full text. Opening an already-open
// document is an error (close it first); use ApplyChanges for updates.
func (s *DocumentStore) Open(id string, version int, text string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.docs[id]; ok {
		return fmt.Errorf("%w: %s", ErrAlreadyOpen, id)
	}
	s.docs[id] = &Snapshot{ID: id, Version: version, Text: text}
	return nil
}

// Close forgets a document.
func (s *DocumentStore) Close(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.docs[id]; !ok {
		return fmt.Errorf("%w: %s", ErrNotOpen, id)
	}
	delete(s.docs, id)
	return nil
}

// Snapshot returns the current version and text of an open document.
func (s *DocumentStore) Snapshot(id string) (Snapshot, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	doc, ok := s.docs[id]
	if !ok {
		return Snapshot{}, fmt.Errorf("%w: %s", ErrNotOpen, id)
	}
	return *doc, nil
}

// ApplyChanges applies a batch of edits, moving the document to version.
// version must be greater than the document's current version; batches
// arriving out of order are rejected with ErrStaleVersion. On any error the
// document is left unchanged. An empty batch is a plain version bump.
// The updated snapshot is returned.
func (s *DocumentStore) ApplyChanges(id string, version int, changes []Change) (Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	doc, ok := s.docs[id]
	if !ok {
		return Snapshot{}, fmt.Errorf("%w: %s", ErrNotOpen, id)
	}
	if version <= doc.Version {
		return Snapshot{}, fmt.Errorf("%w: document %s is at version %d, got %d",
			ErrStaleVersion, id, doc.Version, version)
	}
	text, err := applyChanges(doc.Text, changes)
	if err != nil {
		return Snapshot{}, err
	}
	updated := &Snapshot{ID: id, Version: version, Text: text}
	s.docs[id] = updated
	return *updated, nil
}

// applyChanges rewrites text according to a batch of Changes whose offsets
// all address the original text, in one forward pass.
func applyChanges(text string, changes []Change) (string, error) {
	if len(changes) == 0 {
		return text, nil
	}
	if !sort.SliceIsSorted(changes, func(i, j int) bool { return changes[i].From < changes[j].From }) {
		return "", fmt.Errorf("%w: changes not sorted by position", ErrInvalidEdit)
	}

	var b strings.Builder
	cur := cursor{text: text}
	prevEnd := 0    // byte offset where the last copied region ended
	prevEnd16 := -1 // UTF-16 end of the previous change, for overlap checks
	for _, ch := range changes {
		if ch.From < 0 || ch.To < ch.From {
			return "", fmt.Errorf("%w: bad range [%d,%d)", ErrInvalidEdit, ch.From, ch.To)
		}
		if ch.From < prevEnd16 {
			return "", fmt.Errorf("%w: overlapping ranges", ErrInvalidEdit)
		}
		fromByte, err := cur.byteAt(ch.From)
		if err != nil {
			return "", err
		}
		toByte, err := cur.byteAt(ch.To)
		if err != nil {
			return "", err
		}
		b.WriteString(text[prevEnd:fromByte])
		b.WriteString(ch.Text)
		prevEnd = toByte
		prevEnd16 = ch.To
	}
	b.WriteString(text[prevEnd:])
	return b.String(), nil
}

// cursor converts ascending UTF-16 offsets to byte offsets in a single
// forward walk over the text.
type cursor struct {
	text  string
	byte  int
	off16 int
}

func (c *cursor) byteAt(off16 int) (int, error) {
	for c.off16 < off16 {
		if c.byte >= len(c.text) {
			return 0, fmt.Errorf("%w: offset %d past end of document (%d)",
				ErrInvalidEdit, off16, c.off16)
		}
		r, size := utf8.DecodeRuneInString(c.text[c.byte:])
		c.byte += size
		if r > 0xFFFF {
			c.off16 += 2
		} else {
			c.off16++
		}
	}
	if c.off16 != off16 {
		// Only possible by landing between the two code units of a
		// surrogate pair — not representable in UTF-8
		return 0, fmt.Errorf("%w: offset %d splits a surrogate pair", ErrInvalidEdit, off16)
	}
	return c.byte, nil
}
