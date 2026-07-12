package engine

import (
	"errors"
	"fmt"
	"sync"
	"testing"
)

func mustOpen(t *testing.T, s *DocumentStore, id string, version int, text string) {
	t.Helper()
	if err := s.Open(id, version, text); err != nil {
		t.Fatalf("Open(%q) = %v", id, err)
	}
}

func TestOpenSnapshotClose(t *testing.T) {
	s := NewDocumentStore()
	mustOpen(t, s, "GEN.usfm", 1, "\\id GEN")

	snap, err := s.Snapshot("GEN.usfm")
	if err != nil {
		t.Fatalf("Snapshot = %v", err)
	}
	if snap.ID != "GEN.usfm" || snap.Version != 1 || snap.Text != "\\id GEN" {
		t.Errorf("snapshot = %+v", snap)
	}

	if err := s.Close("GEN.usfm"); err != nil {
		t.Fatalf("Close = %v", err)
	}
	if _, err := s.Snapshot("GEN.usfm"); !errors.Is(err, ErrNotOpen) {
		t.Errorf("Snapshot after close = %v, want ErrNotOpen", err)
	}
}

func TestOpenTwiceFails(t *testing.T) {
	s := NewDocumentStore()
	mustOpen(t, s, "a", 1, "x")
	if err := s.Open("a", 2, "y"); !errors.Is(err, ErrAlreadyOpen) {
		t.Errorf("second Open = %v, want ErrAlreadyOpen", err)
	}
	if snap, _ := s.Snapshot("a"); snap.Text != "x" || snap.Version != 1 {
		t.Errorf("document changed by failed Open: %+v", snap)
	}
}

func TestCloseNotOpenFails(t *testing.T) {
	s := NewDocumentStore()
	if err := s.Close("nope"); !errors.Is(err, ErrNotOpen) {
		t.Errorf("Close = %v, want ErrNotOpen", err)
	}
}

func TestApplySingleEdits(t *testing.T) {
	tests := []struct {
		name   string
		text   string
		change Change
		want   string
	}{
		{"insert", "hello world", Change{From: 5, To: 5, Text: ","}, "hello, world"},
		{"delete", "hello world", Change{From: 5, To: 11, Text: ""}, "hello"},
		{"replace", "hello world", Change{From: 6, To: 11, Text: "USFM"}, "hello USFM"},
		{"prepend", "world", Change{From: 0, To: 0, Text: "hello "}, "hello world"},
		{"append", "hello", Change{From: 5, To: 5, Text: " world"}, "hello world"},
		{"replace all", "old", Change{From: 0, To: 3, Text: "new"}, "new"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := NewDocumentStore()
			mustOpen(t, s, "d", 1, tt.text)
			snap, err := s.ApplyChanges("d", 2, []Change{tt.change})
			if err != nil {
				t.Fatalf("ApplyChanges = %v", err)
			}
			if snap.Text != tt.want || snap.Version != 2 {
				t.Errorf("snapshot = %+v, want text %q version 2", snap, tt.want)
			}
		})
	}
}

func TestApplyBatchUsesOriginalOffsets(t *testing.T) {
	// Both ranges address the original document (CodeMirror iterChanges
	// convention): replacing "aaa" and "ccc" of "aaa bbb ccc" in one batch
	s := NewDocumentStore()
	mustOpen(t, s, "d", 1, "aaa bbb ccc")
	snap, err := s.ApplyChanges("d", 2, []Change{
		{From: 0, To: 3, Text: "AAAAA"},
		{From: 8, To: 11, Text: "C"},
	})
	if err != nil {
		t.Fatalf("ApplyChanges = %v", err)
	}
	if snap.Text != "AAAAA bbb C" {
		t.Errorf("text = %q, want %q", snap.Text, "AAAAA bbb C")
	}
}

func TestApplyEmptyBatchBumpsVersion(t *testing.T) {
	s := NewDocumentStore()
	mustOpen(t, s, "d", 1, "text")
	snap, err := s.ApplyChanges("d", 5, nil)
	if err != nil {
		t.Fatalf("ApplyChanges = %v", err)
	}
	if snap.Version != 5 || snap.Text != "text" {
		t.Errorf("snapshot = %+v", snap)
	}
}

func TestStaleAndEqualVersionsRejected(t *testing.T) {
	s := NewDocumentStore()
	mustOpen(t, s, "d", 5, "text")
	for _, v := range []int{4, 5} {
		if _, err := s.ApplyChanges("d", v, []Change{{From: 0, To: 0, Text: "x"}}); !errors.Is(err, ErrStaleVersion) {
			t.Errorf("ApplyChanges(version=%d) = %v, want ErrStaleVersion", v, err)
		}
	}
	if snap, _ := s.Snapshot("d"); snap.Text != "text" || snap.Version != 5 {
		t.Errorf("document changed by rejected edit: %+v", snap)
	}
}

func TestApplyToClosedDocument(t *testing.T) {
	s := NewDocumentStore()
	if _, err := s.ApplyChanges("nope", 1, nil); !errors.Is(err, ErrNotOpen) {
		t.Errorf("ApplyChanges = %v, want ErrNotOpen", err)
	}
}

func TestInvalidEditsRejectedAndAtomic(t *testing.T) {
	tests := []struct {
		name    string
		changes []Change
	}{
		{"negative from", []Change{{From: -1, To: 0}}},
		{"to before from", []Change{{From: 3, To: 1}}},
		{"past end", []Change{{From: 0, To: 99}}},
		{"unsorted", []Change{{From: 5, To: 6}, {From: 0, To: 1}}},
		{"overlapping", []Change{{From: 0, To: 4}, {From: 2, To: 6}}},
		{"second range past end", []Change{{From: 0, To: 1, Text: "ok"}, {From: 8, To: 99}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := NewDocumentStore()
			mustOpen(t, s, "d", 1, "abcdefgh")
			if _, err := s.ApplyChanges("d", 2, tt.changes); !errors.Is(err, ErrInvalidEdit) {
				t.Fatalf("ApplyChanges = %v, want ErrInvalidEdit", err)
			}
			snap, _ := s.Snapshot("d")
			if snap.Text != "abcdefgh" || snap.Version != 1 {
				t.Errorf("document changed by rejected edit: %+v", snap)
			}
		})
	}
}

func TestUTF16Offsets(t *testing.T) {
	// "¡Hola 𝕊!" — UTF-16 units: ¡(1) H o l a(4) space(1) 𝕊(2) !(1) = 9
	s := NewDocumentStore()
	mustOpen(t, s, "d", 1, "¡Hola 𝕊!")

	// Replace "𝕊" (units 6–8) with "mundo"
	snap, err := s.ApplyChanges("d", 2, []Change{{From: 6, To: 8, Text: "mundo"}})
	if err != nil {
		t.Fatalf("ApplyChanges = %v", err)
	}
	if snap.Text != "¡Hola mundo!" {
		t.Errorf("text = %q, want %q", snap.Text, "¡Hola mundo!")
	}

	// Insert at the very end (unit 12 of "¡Hola mundo!")
	snap, err = s.ApplyChanges("d", 3, []Change{{From: 12, To: 12, Text: " :)"}})
	if err != nil {
		t.Fatalf("ApplyChanges = %v", err)
	}
	if snap.Text != "¡Hola mundo! :)" {
		t.Errorf("text = %q", snap.Text)
	}
}

func TestSurrogateSplitRejected(t *testing.T) {
	s := NewDocumentStore()
	mustOpen(t, s, "d", 1, "a𝕊b") // 𝕊 spans units 1–3
	if _, err := s.ApplyChanges("d", 2, []Change{{From: 2, To: 2, Text: "x"}}); !errors.Is(err, ErrInvalidEdit) {
		t.Errorf("ApplyChanges = %v, want ErrInvalidEdit (mid surrogate pair)", err)
	}
}

func TestConcurrentAccess(t *testing.T) {
	// Exercises the mutex under -race; sequential edits per document keep
	// versions valid while snapshots race against them
	s := NewDocumentStore()
	var wg sync.WaitGroup
	for d := 0; d < 4; d++ {
		id := fmt.Sprintf("doc-%d", d)
		mustOpen(t, s, id, 0, "start ")
		wg.Add(2)
		go func() {
			defer wg.Done()
			for v := 1; v <= 50; v++ {
				if _, err := s.ApplyChanges(id, v, []Change{{From: 0, To: 0, Text: "x"}}); err != nil {
					t.Errorf("ApplyChanges(%s, %d) = %v", id, v, err)
					return
				}
			}
		}()
		go func() {
			defer wg.Done()
			for i := 0; i < 50; i++ {
				if _, err := s.Snapshot(id); err != nil {
					t.Errorf("Snapshot(%s) = %v", id, err)
					return
				}
			}
		}()
	}
	wg.Wait()
	for d := 0; d < 4; d++ {
		snap, err := s.Snapshot(fmt.Sprintf("doc-%d", d))
		if err != nil || snap.Version != 50 || len(snap.Text) != len("start ")+50 {
			t.Errorf("final snapshot = %+v, %v", snap, err)
		}
	}
}
