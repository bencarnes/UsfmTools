package engine

import (
	"strings"
	"testing"

	usfm "github.com/usfm-tools/usfm-parser-go"
)

// Classification and completion behavior ported from
// usfm-controls/tests/language-service.test.ts, plus Go-side additions
// (book-code completions, structure, byte/offset assertions).

func openDoc(t *testing.T, text string) *Engine {
	t.Helper()
	e := New(Options{})
	t.Cleanup(e.Shutdown)
	if err := e.Open("doc", 1, text); err != nil {
		t.Fatalf("Open = %v", err)
	}
	return e
}

func kinds(tokens []ClassifiedToken, kind TokenKind) []ClassifiedToken {
	var out []ClassifiedToken
	for _, tok := range tokens {
		if tok.Type == kind {
			out = append(out, tok)
		}
	}
	return out
}

func TestClassifyMarkers(t *testing.T) {
	e := openDoc(t, "\\id GEN\n\\c 1\n\\p\n\\v 1 Text")
	tokens, version, err := e.Classify("doc")
	if err != nil {
		t.Fatalf("Classify = %v", err)
	}
	if version != 1 {
		t.Errorf("version = %d, want 1", version)
	}
	markers := kinds(tokens, KindMarker)
	if len(markers) != 4 {
		t.Fatalf("markers = %d, want 4", len(markers))
	}
	// \id spans columns 0–3 on line 0
	first := markers[0]
	if first.Range.Start != (usfm.Position{Line: 0, Column: 0, Offset: 0, Byte: 0}) ||
		first.Range.End != (usfm.Position{Line: 0, Column: 3, Offset: 3, Byte: 3}) {
		t.Errorf("\\id range = %+v", first.Range)
	}
}

func TestClassifyVerseAndChapterNumbers(t *testing.T) {
	e := openDoc(t, "\\p\n\\v 1 Text\n\\v 2 More\n\\c 3")
	tokens, _, err := e.Classify("doc")
	if err != nil {
		t.Fatalf("Classify = %v", err)
	}
	verseNums := kinds(tokens, KindVerseNumber)
	if len(verseNums) != 2 {
		t.Fatalf("verse numbers = %d, want 2", len(verseNums))
	}
	// "\v 1 Text": number "1" at line 1, columns 3–4
	if verseNums[0].Range.Start != (usfm.Position{Line: 1, Column: 3, Offset: 6, Byte: 6}) ||
		verseNums[0].Range.End != (usfm.Position{Line: 1, Column: 4, Offset: 7, Byte: 7}) {
		t.Errorf("verse 1 range = %+v", verseNums[0].Range)
	}
	chapterNums := kinds(tokens, KindChapterNumber)
	if len(chapterNums) != 1 {
		t.Fatalf("chapter numbers = %d, want 1", len(chapterNums))
	}
}

func TestClassifyEndAndNestedMarkers(t *testing.T) {
	e := openDoc(t, `\p \wj words \+nd Lord\+nd*\wj*`)
	tokens, _, err := e.Classify("doc")
	if err != nil {
		t.Fatalf("Classify = %v", err)
	}
	markers := kinds(tokens, KindMarker)
	ends := kinds(tokens, KindEndMarker)
	if len(markers) != 3 || len(ends) != 2 {
		t.Fatalf("markers = %d ends = %d, want 3 and 2", len(markers), len(ends))
	}
	// \+nd spans 4 columns (backslash, plus, n, d)
	nested := markers[2]
	if got := nested.Range.End.Column - nested.Range.Start.Column; got != 4 {
		t.Errorf("\\+nd width = %d, want 4", got)
	}
	// \+nd* spans 5 columns
	nestedEnd := ends[0]
	if got := nestedEnd.Range.End.Column - nestedEnd.Range.Start.Column; got != 5 {
		t.Errorf("\\+nd* width = %d, want 5", got)
	}
}

func TestClassifyAttributes(t *testing.T) {
	e := openDoc(t, "\\p \\w grace|lemma=\"grace\"\\w* \\w x|dflt\\w*")
	tokens, _, err := e.Classify("doc")
	if err != nil {
		t.Fatalf("Classify = %v", err)
	}
	if n := len(kinds(tokens, KindAttribute)); n != 1 {
		t.Errorf("key-value attribute tokens = %d, want 1", n)
	}
	vals := kinds(tokens, KindAttributeValue)
	if len(vals) != 1 {
		t.Fatalf("attribute-value tokens = %d, want 1", len(vals))
	}
	if got := vals[0].Range.End.Column - vals[0].Range.Start.Column; got != len("dflt") {
		t.Errorf("attribute value width = %d, want %d", got, len("dflt"))
	}
}

func TestClassifyRangeRebasesLines(t *testing.T) {
	content := "\\id GEN\n\\c 1\n\\p\n\\v 1 First\n\\v 2 Second\n\\c 2\n\\p\n\\v 1 Third"
	e := openDoc(t, content)

	from := strings.Index(content, "\\v 2") // ASCII content: byte == UTF-16 offset
	to := strings.Index(content, "\\c 2")
	tokens, _, err := e.ClassifyRange("doc", from, to)
	if err != nil {
		t.Fatalf("ClassifyRange = %v", err)
	}
	verseNums := kinds(tokens, KindVerseNumber)
	if len(verseNums) != 1 {
		t.Fatalf("verse numbers = %d, want 1", len(verseNums))
	}
	if verseNums[0].Range.Start.Line != 4 {
		t.Errorf("verse number line = %d, want 4", verseNums[0].Range.Start.Line)
	}
	if verseNums[0].Range.Start.Offset != from+3 {
		t.Errorf("verse number offset = %d, want %d", verseNums[0].Range.Start.Offset, from+3)
	}
}

func TestClassifyRangeMatchesFullClassify(t *testing.T) {
	content := "\\id GEN\n\\c 1\n\\p\n\\v 1 First ¡𝕊!\n\\v 2 Second\n\\c 2\n\\p\n\\v 1 Third"
	e := openDoc(t, content)

	full, _, err := e.Classify("doc")
	if err != nil {
		t.Fatalf("Classify = %v", err)
	}
	ranged, _, err := e.ClassifyRange("doc", 0, 1_000_000)
	if err != nil {
		t.Fatalf("ClassifyRange = %v", err)
	}
	if len(full) != len(ranged) {
		t.Fatalf("full = %d tokens, ranged = %d", len(full), len(ranged))
	}
	for i := range full {
		if full[i] != ranged[i] {
			t.Errorf("token %d differs: full %+v vs ranged %+v", i, full[i], ranged[i])
		}
	}
}

func TestClassifyRangeMidLineStart(t *testing.T) {
	// from points into the middle of the "\v 2" line: the slice must widen
	// to the line start so the verse number is still classified
	content := "\\p\n\\v 2 Some words here"
	e := openDoc(t, content)
	mid := strings.Index(content, "words")
	tokens, _, err := e.ClassifyRange("doc", mid, len(content))
	if err != nil {
		t.Fatalf("ClassifyRange = %v", err)
	}
	if n := len(kinds(tokens, KindVerseNumber)); n != 1 {
		t.Errorf("verse numbers = %d, want 1 (line-start widening)", n)
	}
}

func TestCompletionsAfterBackslash(t *testing.T) {
	e := openDoc(t, "\\id GEN\n\\c 1\n\\")
	items, err := e.Completions("doc", 2, 1)
	if err != nil {
		t.Fatalf("Completions = %v", err)
	}
	if len(items) == 0 {
		t.Error("no completions after backslash")
	}
}

func TestCompletionsFilterByPrefix(t *testing.T) {
	e := openDoc(t, "\\id GEN\n\\q")
	items, err := e.Completions("doc", 1, 2)
	if err != nil {
		t.Fatalf("Completions = %v", err)
	}
	if len(items) == 0 {
		t.Fatal("no completions for \\q")
	}
	for _, item := range items {
		if !strings.HasPrefix(item.Label, `\q`) {
			t.Errorf("item %q does not match prefix \\q", item.Label)
		}
	}
}

func TestCompletionsAwayFromMarker(t *testing.T) {
	e := openDoc(t, "\\id GEN\nsome text")
	items, err := e.Completions("doc", 1, 5)
	if err != nil {
		t.Fatalf("Completions = %v", err)
	}
	if len(items) != 0 {
		t.Errorf("items = %+v, want none", items)
	}
}

func TestCompletionsOutOfRangeLine(t *testing.T) {
	e := openDoc(t, "\\id GEN")
	items, err := e.Completions("doc", 9, 0)
	if err != nil {
		t.Fatalf("Completions = %v", err)
	}
	if len(items) != 0 {
		t.Errorf("items = %+v, want none", items)
	}
}

func TestBookCodeCompletions(t *testing.T) {
	tests := []struct {
		name   string
		text   string
		column int
		want   []string // exact labels, or nil for "all 66"
	}{
		{"all codes after id-space", "\\id ", 4, nil},
		{"prefix G", "\\id G", 5, []string{"GEN", "GAL"}},
		{"prefix 1C", "\\id 1C", 6, []string{"1CH", "1CO"}},
		{"lowercase prefix", "\\id gen", 7, []string{"GEN"}},
		{"cursor in description", "\\id GEN G", 9, []string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := openDoc(t, tt.text)
			items, err := e.Completions("doc", 0, tt.column)
			if err != nil {
				t.Fatalf("Completions = %v", err)
			}
			if tt.want == nil {
				if len(items) != 66 {
					t.Fatalf("items = %d, want all 66 book codes", len(items))
				}
				return
			}
			var labels []string
			for _, it := range items {
				labels = append(labels, it.Label)
			}
			if len(labels) != len(tt.want) {
				t.Fatalf("labels = %v, want %v", labels, tt.want)
			}
			for i := range tt.want {
				if labels[i] != tt.want[i] {
					t.Fatalf("labels = %v, want %v", labels, tt.want)
				}
			}
		})
	}
}

func TestDiagnosticsPull(t *testing.T) {
	e := openDoc(t, "\\id GEN\n\\zzz bad")
	// Pull immediately — works even before the background analysis lands
	diags, version, err := e.Diagnostics("doc")
	if err != nil {
		t.Fatalf("Diagnostics = %v", err)
	}
	if version != 1 {
		t.Errorf("version = %d, want 1", version)
	}
	if len(diags) != 1 || diags[0].Code != usfm.CodeUnknownMarker {
		t.Errorf("diagnostics = %+v, want one unknown-marker", diags)
	}
}

func TestStructure(t *testing.T) {
	e := openDoc(t, "\\id GEN Genesis - Test\n\\c 1\n\\p\n\\v 1 One.\n\\c 2\n\\p\n\\v 1 Two.")
	books, version, err := e.Structure("doc")
	if err != nil {
		t.Fatalf("Structure = %v", err)
	}
	if version != 1 {
		t.Errorf("version = %d, want 1", version)
	}
	if len(books) != 1 {
		t.Fatalf("books = %d, want 1", len(books))
	}
	b := books[0]
	if b.Code != "GEN" || b.Description != "Genesis - Test" || b.Position.Offset != 0 {
		t.Errorf("book = %+v", b)
	}
	if len(b.Chapters) != 2 {
		t.Fatalf("chapters = %d, want 2", len(b.Chapters))
	}
	if b.Chapters[0].Number != "1" || b.Chapters[1].Number != "2" {
		t.Errorf("chapter numbers = %q, %q", b.Chapters[0].Number, b.Chapters[1].Number)
	}
	// \c 2 sits right after "\id GEN Genesis - Test\n\c 1\n\p\n\v 1 One.\n"
	wantOffset := strings.Index("\\id GEN Genesis - Test\n\\c 1\n\\p\n\\v 1 One.\n\\c 2", "\\c 2")
	if b.Chapters[1].Position.Offset != wantOffset {
		t.Errorf("chapter 2 offset = %d, want %d", b.Chapters[1].Position.Offset, wantOffset)
	}
}

func TestFeaturesOnClosedDocument(t *testing.T) {
	e := New(Options{})
	defer e.Shutdown()
	if _, _, err := e.Classify("nope"); err == nil {
		t.Error("Classify on closed doc succeeded")
	}
	if _, err := e.Completions("nope", 0, 0); err == nil {
		t.Error("Completions on closed doc succeeded")
	}
	if _, _, err := e.Diagnostics("nope"); err == nil {
		t.Error("Diagnostics on closed doc succeeded")
	}
	if _, _, err := e.Structure("nope"); err == nil {
		t.Error("Structure on closed doc succeeded")
	}
}
