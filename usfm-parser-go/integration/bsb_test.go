// Package integration runs the Berean Standard Bible corpus tests against
// the Go parser. Port of packages/usfm-parser-integration-tests/tests/bsb.test.ts.
package integration

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/parser"
)

const bsbDir = "../../bibles/bsb/usfm"

func allUsfmFiles(t *testing.T) []string {
	t.Helper()
	entries, err := os.ReadDir(bsbDir)
	if err != nil {
		t.Skipf("BSB corpus not available: %v", err)
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".usfm") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	return files
}

func loadUsfm(t *testing.T, filename string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(bsbDir, filename))
	if err != nil {
		t.Fatalf("read %s: %v", filename, err)
	}
	return string(data)
}

func parseBook(t *testing.T, filename string) usfm.ParseResult {
	t.Helper()
	result := parser.Parse(loadUsfm(t, filename))
	if len(result.Document.Children) == 0 {
		t.Fatalf("%s: document has no children", filename)
	}
	return result
}

func findChild(parent *usfm.Node, typ usfm.NodeType) *usfm.Node {
	for _, c := range parent.Children {
		if c.Type == typ {
			return c
		}
	}
	return nil
}

func filterChildren(parent *usfm.Node, typ usfm.NodeType) []*usfm.Node {
	var out []*usfm.Node
	for _, c := range parent.Children {
		if c.Type == typ {
			out = append(out, c)
		}
	}
	return out
}

func collectText(nodes []*usfm.Node) string {
	var b strings.Builder
	for _, c := range nodes {
		if c.Type == usfm.NodeText {
			b.WriteString(c.Text)
		}
	}
	return b.String()
}

// collectAfterVerse collects sibling nodes that follow a verse milestone:
// it walks the parent's child containers looking for the verse, returning
// siblings until the next verse or end of that container.
func collectAfterVerse(parent *usfm.Node, verseNumber string) []*usfm.Node {
	for _, child := range parent.Children {
		if child.Children == nil {
			continue
		}
		collecting := false
		var result []*usfm.Node
		for _, node := range child.Children {
			if node.Type == usfm.NodeVerse {
				if node.Number == verseNumber {
					collecting = true
					continue
				} else if collecting {
					return result
				}
			}
			if collecting {
				result = append(result, node)
			}
		}
		if collecting {
			return result
		}
	}
	return nil
}

func walk(nodes []*usfm.Node, visit func(*usfm.Node)) {
	for _, n := range nodes {
		visit(n)
		walk(n.Children, visit)
	}
}

// --- 1. All 66 books parse ---

func TestAllBooksPresent(t *testing.T) {
	files := allUsfmFiles(t)
	if len(files) != 66 {
		t.Errorf("found %d USFM files, want 66", len(files))
	}
}

func TestParseAllBooks(t *testing.T) {
	// A panic anywhere in Parse fails the test — the Go analogue of the TS
	// "does not throw in non-strict mode" assertion
	for _, file := range allUsfmFiles(t) {
		parser.Parse(loadUsfm(t, file))
	}
}

// --- 2. Performance ---

func TestParseEntireBibleUnder30Seconds(t *testing.T) {
	files := allUsfmFiles(t)
	contents := make([]string, len(files))
	for i, file := range files {
		contents[i] = loadUsfm(t, file)
	}
	start := time.Now()
	for _, content := range contents {
		parser.Parse(content)
	}
	if elapsed := time.Since(start); elapsed > 30*time.Second {
		t.Errorf("parsing the BSB took %v, want under 30s", elapsed)
	}
}

// --- 3. Sampled structural assertions ---

func TestGenesis(t *testing.T) {
	allUsfmFiles(t) // skip when corpus is missing
	result := parseBook(t, "GEN.usfm")
	book := result.Document.Children[0]
	if book.Type != usfm.NodeBook || book.Code != "GEN" {
		t.Fatalf("book = %v %q, want book GEN", book.Type, book.Code)
	}

	chapters := filterChildren(book, usfm.NodeChapter)
	if len(chapters) != 50 {
		t.Fatalf("chapters = %d, want 50", len(chapters))
	}
	if chapters[0].Number != "1" || chapters[49].Number != "50" {
		t.Errorf("chapter numbers = %q..%q, want 1..50", chapters[0].Number, chapters[49].Number)
	}

	ch1 := chapters[0]
	afterV1 := collectAfterVerse(ch1, "1")
	if len(afterV1) == 0 {
		t.Fatal("no nodes after verse 1")
	}
	if text := collectText(afterV1); !strings.Contains(text, "In the beginning God created") {
		t.Errorf("Gen 1:1 text = %q", text)
	}

	var s1 *usfm.Node
	for _, p := range filterChildren(ch1, usfm.NodeParagraph) {
		if p.Marker == "s1" {
			s1 = p
			break
		}
	}
	if s1 == nil {
		t.Fatal("no s1 section heading in chapter 1")
	}
	if text := collectText(s1.Children); !strings.Contains(text, "The Creation") {
		t.Errorf("s1 text = %q, want to contain \"The Creation\"", text)
	}
}

func TestPsalms(t *testing.T) {
	allUsfmFiles(t)
	result := parseBook(t, "PSA.usfm")
	book := result.Document.Children[0]
	if book.Code != "PSA" {
		t.Fatalf("code = %q, want PSA", book.Code)
	}
	chapters := filterChildren(book, usfm.NodeChapter)
	if len(chapters) != 150 {
		t.Fatalf("chapters = %d, want 150", len(chapters))
	}

	ch1 := chapters[0]
	markers := map[string]bool{}
	for _, p := range filterChildren(ch1, usfm.NodeParagraph) {
		if strings.HasPrefix(p.Marker, "q") {
			markers[p.Marker] = true
		}
	}
	if len(markers) == 0 || !markers["q1"] || !markers["q2"] {
		t.Errorf("poetry markers = %v, want q1 and q2", markers)
	}

	afterV1 := collectAfterVerse(ch1, "1")
	if len(afterV1) == 0 {
		t.Fatal("no nodes after verse 1")
	}
	if text := collectText(afterV1); !strings.Contains(text, "Blessed is the man") {
		t.Errorf("Psalm 1:1 text = %q", text)
	}
}

func TestMatthew(t *testing.T) {
	allUsfmFiles(t)
	result := parseBook(t, "MAT.usfm")
	book := result.Document.Children[0]
	if book.Code != "MAT" {
		t.Fatalf("code = %q, want MAT", book.Code)
	}
	if chapters := filterChildren(book, usfm.NodeChapter); len(chapters) != 28 {
		t.Fatalf("chapters = %d, want 28", len(chapters))
	}

	var header *usfm.Node
	for _, p := range filterChildren(book, usfm.NodeParagraph) {
		if p.Marker == "h" {
			header = p
			break
		}
	}
	if header == nil {
		t.Fatal("no \\h header paragraph")
	}
	if text := collectText(header.Children); !strings.Contains(text, "Matthew") {
		t.Errorf("header text = %q, want to contain Matthew", text)
	}

	ch1 := findChild(book, usfm.NodeChapter)
	var notes []*usfm.Node
	walk(ch1.Children, func(n *usfm.Node) {
		if n.Type == usfm.NodeNote {
			notes = append(notes, n)
		}
	})
	if len(notes) == 0 {
		t.Fatal("no footnotes in Matthew 1")
	}
	if notes[0].Marker != "f" || notes[0].Caller != "+" {
		t.Errorf("first note = marker %q caller %q, want f +", notes[0].Marker, notes[0].Caller)
	}
}

func TestRevelation(t *testing.T) {
	allUsfmFiles(t)
	result := parseBook(t, "REV.usfm")
	book := result.Document.Children[0]
	if book.Code != "REV" {
		t.Fatalf("code = %q, want REV", book.Code)
	}
	if chapters := filterChildren(book, usfm.NodeChapter); len(chapters) != 22 {
		t.Fatalf("chapters = %d, want 22", len(chapters))
	}

	ch1 := findChild(book, usfm.NodeChapter)
	wjCount := 0
	walk(ch1.Children, func(n *usfm.Node) {
		if n.Type == usfm.NodeChar && n.Marker == "wj" {
			wjCount++
		}
	})
	if wjCount == 0 {
		t.Error("no \\wj char nodes in Revelation 1")
	}
}

// BenchmarkParsePsalms measures single-book parse latency on the largest
// book — the number that matters for editor responsiveness (the TS parser
// was ~16ms here; see the perf notes in todo.md).
func BenchmarkParsePsalms(b *testing.B) {
	data, err := os.ReadFile(filepath.Join(bsbDir, "PSA.usfm"))
	if err != nil {
		b.Skipf("BSB corpus not available: %v", err)
	}
	content := string(data)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		parser.Parse(content)
	}
}

// --- 4. Error characterization ---

func TestAllBooksParseWithZeroErrors(t *testing.T) {
	total := 0
	for _, file := range allUsfmFiles(t) {
		result := parser.Parse(loadUsfm(t, file))
		total += len(result.Errors)
		for i, e := range result.Errors {
			if i >= 3 {
				break
			}
			t.Logf("%s: %s", file, e.Message)
		}
	}
	if total != 0 {
		t.Errorf("total errors across corpus = %d, want 0", total)
	}
}
