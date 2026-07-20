package engine

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/usfm-tools/usfm-parser-go/internal/jsstr"
)

// Differential check on a real corpus book (non-ASCII quotes/dashes/Hebrew):
// classifying a viewport-style range (line-boundary from/to, as the editor
// sends) must yield exactly the whole-document classification restricted to
// that range, with identical positions. Guards the range walk + rebase
// against UTF-16/byte drift.
func TestClassifyRangeMatchesFullClassifyOnPsalms(t *testing.T) {
	path := filepath.Join("..", "..", "bibles", "bsb", "usfm", "PSA.usfm")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("corpus file not available: %v", err)
	}
	content := string(data)

	// UTF-16 offsets of each line start, and line ends (before the newline).
	lineStarts := []int{0}
	off16 := 0
	for _, r := range content {
		off16 += jsstr.RuneLen16(r)
		if r == '\n' {
			lineStarts = append(lineStarts, off16)
		}
	}
	total16 := off16

	e := New(Options{})
	defer e.Shutdown()
	if err := e.Open("psa", 1, content); err != nil {
		t.Fatal(err)
	}
	whole, _, err := e.Classify("psa")
	if err != nil {
		t.Fatal(err)
	}

	// ~40-line windows starting at every 100th line, covering the whole book.
	for i := 0; i < len(lineStarts); i += 100 {
		from := lineStarts[i]
		endLine := i + 40
		to := total16
		if endLine < len(lineStarts) {
			to = lineStarts[endLine] - 1 // end of previous line
		}
		ranged, _, err := e.ClassifyRange("psa", from, to)
		if err != nil {
			t.Fatalf("ClassifyRange(%d,%d) = %v", from, to, err)
		}

		var expected []ClassifiedToken
		for _, tok := range whole {
			if tok.Range.Start.Offset >= from && tok.Range.Start.Offset < to {
				expected = append(expected, tok)
			}
		}
		var got []ClassifiedToken
		for _, tok := range ranged {
			if tok.Range.Start.Offset >= from && tok.Range.Start.Offset < to {
				got = append(got, tok)
			}
		}

		if len(got) != len(expected) {
			t.Errorf("range [%d,%d): got %d tokens, want %d", from, to, len(got), len(expected))
			continue
		}
		for j := range expected {
			if got[j] != expected[j] {
				t.Errorf("range [%d,%d) token %d:\n got  %+v\n want %+v",
					from, to, j, got[j], expected[j])
				if strings.Count(content[:expected[j].Range.Start.Byte], "\n") > 0 {
					// keep output short; first mismatch is enough per window
				}
				break
			}
		}
	}
}
