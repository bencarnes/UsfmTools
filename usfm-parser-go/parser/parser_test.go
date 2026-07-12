package parser

import (
	"strings"
	"testing"

	usfm "github.com/usfm-tools/usfm-parser-go"
)

// Ported from packages/usfm-parser/tests/parser.test.ts.

func findChild(parent *usfm.Node, typ usfm.NodeType) *usfm.Node {
	for _, c := range parent.Children {
		if c.Type == typ {
			return c
		}
	}
	return nil
}

func findChildMarker(parent *usfm.Node, typ usfm.NodeType, marker string) *usfm.Node {
	for _, c := range parent.Children {
		if c.Type == typ && c.Marker == marker {
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

// childrenAfterVerse collects sibling nodes after the given verse milestone
// until the next verse or end.
func childrenAfterVerse(parent *usfm.Node, verseNumber string) []*usfm.Node {
	collecting := false
	var result []*usfm.Node
	for _, child := range parent.Children {
		if child.Type == usfm.NodeVerse {
			if child.Number == verseNumber {
				collecting = true
				continue
			} else if collecting {
				break
			}
		}
		if collecting {
			result = append(result, child)
		}
	}
	return result
}

// mustPath fails the test unless the book → chapter → paragraph chain exists.
func mustChapterPara(t *testing.T, result usfm.ParseResult) (book, chapter, para *usfm.Node) {
	t.Helper()
	if len(result.Document.Children) == 0 {
		t.Fatal("document has no children")
	}
	book = result.Document.Children[0]
	chapter = findChild(book, usfm.NodeChapter)
	if chapter == nil {
		t.Fatal("no chapter node")
	}
	para = findChild(chapter, usfm.NodeParagraph)
	if para == nil {
		t.Fatal("no paragraph node")
	}
	return
}

func TestEmptyDocument(t *testing.T) {
	result := Parse("")
	if result.Document.Type != usfm.NodeDocument {
		t.Errorf("document type = %q", result.Document.Type)
	}
	if len(result.Document.Children) != 0 {
		t.Errorf("children = %d, want 0", len(result.Document.Children))
	}
	if len(result.Errors) != 0 {
		t.Errorf("errors = %v, want none", result.Errors)
	}
}

func TestMinimalFile(t *testing.T) {
	input := "\\id GEN Genesis\n\\c 1\n\\p\n\\v 1 In the beginning God created the heavens and the earth."
	result := Parse(input)
	if result.Document.Type != usfm.NodeDocument {
		t.Errorf("document type = %q", result.Document.Type)
	}
	if len(result.Errors) != 0 {
		t.Errorf("errors = %v, want none", result.Errors)
	}
}

func TestIdWithBookCode(t *testing.T) {
	result := Parse(`\id GEN`)
	book := result.Document.Children[0]
	if book.Type != usfm.NodeBook || book.Code != "GEN" {
		t.Errorf("book = %+v, want book GEN", book)
	}
}

func TestIdWithDescription(t *testing.T) {
	result := Parse(`\id GEN Genesis - English Standard Version`)
	book := result.Document.Children[0]
	if book.Code != "GEN" {
		t.Errorf("code = %q, want GEN", book.Code)
	}
	if book.Description != "Genesis - English Standard Version" {
		t.Errorf("description = %q", book.Description)
	}
}

func TestHeadersWithinBook(t *testing.T) {
	input := "\\id GEN\n\\h Genesis\n\\toc1 Genesis\n\\toc2 Gen\n\\mt1 Genesis"
	result := Parse(input)
	book := result.Document.Children[0]
	if len(book.Children) == 0 {
		t.Fatal("book has no children")
	}
	var markers []string
	for _, h := range filterChildren(book, usfm.NodeParagraph) {
		markers = append(markers, h.Marker)
	}
	joined := strings.Join(markers, ",")
	for _, want := range []string{"h", "toc1", "mt1"} {
		if !strings.Contains(","+joined+",", ","+want+",") {
			t.Errorf("header markers %v missing %q", markers, want)
		}
	}
}

func TestChapterMarker(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Text")
	book := result.Document.Children[0]
	chapter := findChild(book, usfm.NodeChapter)
	if chapter == nil || chapter.Number != "1" {
		t.Errorf("chapter = %+v, want number 1", chapter)
	}
}

func TestMultipleChapters(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Chapter 1 text.\n\\c 2\n\\p\n\\v 1 Chapter 2 text.")
	book := result.Document.Children[0]
	chapters := filterChildren(book, usfm.NodeChapter)
	if len(chapters) != 2 {
		t.Fatalf("chapters = %d, want 2", len(chapters))
	}
	if chapters[0].Number != "1" || chapters[1].Number != "2" {
		t.Errorf("chapter numbers = %q, %q", chapters[0].Number, chapters[1].Number)
	}
}

func TestVerseMilestone(t *testing.T) {
	input := "\\id GEN\n\\c 1\n\\p\n\\v 1 In the beginning God created the heavens and the earth."
	result := Parse(input)
	_, _, para := mustChapterPara(t, result)
	verse := findChild(para, usfm.NodeVerse)
	if verse == nil || verse.Number != "1" {
		t.Fatalf("verse = %+v, want number 1", verse)
	}
	if verse.Children != nil {
		t.Errorf("verse has children; want milestone (no children)")
	}
	var text strings.Builder
	for _, c := range childrenAfterVerse(para, "1") {
		if c.Type == usfm.NodeText {
			text.WriteString(c.Text)
		}
	}
	if !strings.Contains(text.String(), "In the beginning") {
		t.Errorf("text after verse = %q", text.String())
	}
}

func TestVerseRange(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1-2 Combined verse text.")
	_, _, para := mustChapterPara(t, result)
	verse := findChild(para, usfm.NodeVerse)
	if verse == nil || verse.Number != "1-2" {
		t.Errorf("verse = %+v, want number 1-2", verse)
	}
}

func TestSiblingVerses(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 First verse.\n\\v 2 Second verse.")
	_, _, para := mustChapterPara(t, result)
	verses := filterChildren(para, usfm.NodeVerse)
	if len(verses) != 2 {
		t.Fatalf("verses = %d, want 2", len(verses))
	}
	if verses[0].Number != "1" || verses[1].Number != "2" {
		t.Errorf("verse numbers = %q, %q", verses[0].Number, verses[1].Number)
	}
}

func TestParagraphMarker(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Paragraph text.")
	_, _, para := mustChapterPara(t, result)
	if para.Marker != "p" {
		t.Errorf("paragraph marker = %q, want p", para.Marker)
	}
}

func TestPoetryMarkers(t *testing.T) {
	result := Parse("\\id PSA\n\\c 1\n\\q1\n\\v 1 Blessed is the man\n\\q2 who walks not in the counsel of the wicked.")
	book := result.Document.Children[0]
	chapter := findChild(book, usfm.NodeChapter)
	var markers []string
	for _, p := range filterChildren(chapter, usfm.NodeParagraph) {
		markers = append(markers, p.Marker)
	}
	joined := "," + strings.Join(markers, ",") + ","
	if !strings.Contains(joined, ",q1,") || !strings.Contains(joined, ",q2,") {
		t.Errorf("paragraph markers = %v, want q1 and q2", markers)
	}
}

func TestSectionHeading(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\s1 The Creation\n\\p\n\\v 1 In the beginning.")
	book := result.Document.Children[0]
	chapter := findChild(book, usfm.NodeChapter)
	if findChildMarker(chapter, usfm.NodeParagraph, "s1") == nil {
		t.Error("no s1 section heading paragraph")
	}
}

func TestInlineCharMarker(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 The \\nd Lord\\nd* spoke.")
	_, _, para := mustChapterPara(t, result)
	charNode := findChild(para, usfm.NodeChar)
	if charNode == nil || charNode.Marker != "nd" {
		t.Fatalf("char node = %+v, want nd", charNode)
	}
	text := findChild(charNode, usfm.NodeText)
	if text == nil || !strings.Contains(text.Text, "Lord") {
		t.Errorf("char text = %+v, want to contain Lord", text)
	}
}

func TestKeyValueAttributes(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 \\w grace|lemma=\"grace\" strong=\"G5485\"\\w*")
	_, _, para := mustChapterPara(t, result)
	w := findChildMarker(para, usfm.NodeChar, "w")
	if w == nil || w.Attributes == nil {
		t.Fatalf("w node = %+v, want attributes", w)
	}
	if w.Attributes["lemma"] != "grace" || w.Attributes["strong"] != "G5485" {
		t.Errorf("attributes = %v", w.Attributes)
	}
}

func TestPositionalDefaultAttribute(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 \\w grace|grace\\w*")
	_, _, para := mustChapterPara(t, result)
	w := findChildMarker(para, usfm.NodeChar, "w")
	if w == nil || w.Attributes["lemma"] != "grace" {
		t.Errorf("w node = %+v, want lemma=grace", w)
	}
}

func TestDefaultAttributePerMarker(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 \\rb 漢字|ルビ\\rb*")
	_, _, para := mustChapterPara(t, result)
	rb := findChildMarker(para, usfm.NodeChar, "rb")
	if rb == nil || rb.Attributes["gloss"] != "ルビ" {
		t.Errorf("rb node = %+v, want gloss=ルビ", rb)
	}
}

func TestDefaultKeyFallback(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 \\nd Lord|some value\\nd*")
	_, _, para := mustChapterPara(t, result)
	nd := findChildMarker(para, usfm.NodeChar, "nd")
	if nd == nil || nd.Attributes["default"] != "some value" {
		t.Errorf("nd node = %+v, want default=some value", nd)
	}
}

func TestNestedCharMarkers(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 \\wj words of \\+nd Jesus\\+nd*\\wj*")
	_, _, para := mustChapterPara(t, result)
	wj := findChildMarker(para, usfm.NodeChar, "wj")
	if wj == nil {
		t.Fatal("no wj node")
	}
	if findChildMarker(wj, usfm.NodeChar, "nd") == nil {
		t.Error("no nested nd node inside wj")
	}
}

func TestCharSpanAcrossVerses(t *testing.T) {
	input := "\\id GEN\n\\c 1\n\\p\n\\v 1 Jesus said, \\wj \"I am the First and the Last,\n\\v 2 the Living One.\"\\wj*"
	result := Parse(input)
	if len(result.Errors) != 0 {
		t.Fatalf("errors = %v, want none", result.Errors)
	}
	_, _, para := mustChapterPara(t, result)
	wj := findChildMarker(para, usfm.NodeChar, "wj")
	if wj == nil {
		t.Fatal("no wj node")
	}
	inner := findChild(wj, usfm.NodeVerse)
	if inner == nil || inner.Number != "2" {
		t.Errorf("inner verse = %+v, want number 2", inner)
	}
}

func TestBasicFootnote(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Text\\f + \\fr 1:1 \\ft A footnote.\\f* more text.")
	_, _, para := mustChapterPara(t, result)
	footnote := findChild(para, usfm.NodeNote)
	if footnote == nil || footnote.Marker != "f" || footnote.Caller != "+" {
		t.Fatalf("footnote = %+v, want marker f caller +", footnote)
	}
	if findChildMarker(footnote, usfm.NodeChar, "fr") == nil {
		t.Error("no fr node in footnote")
	}
	if findChildMarker(footnote, usfm.NodeChar, "ft") == nil {
		t.Error("no ft node in footnote")
	}
}

func TestCrossReference(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Text\\x - \\xo 1:1 \\xt Gen 2:4\\x* more.")
	_, _, para := mustChapterPara(t, result)
	xref := findChild(para, usfm.NodeNote)
	if xref == nil || xref.Marker != "x" || xref.Caller != "-" {
		t.Errorf("xref = %+v, want marker x caller -", xref)
	}
}

func TestTableRowsAndCells(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\tr \\th1 Name \\th2 Age\n\\tr \\tc1 Adam \\tc2 930")
	book := result.Document.Children[0]
	chapter := findChild(book, usfm.NodeChapter)
	rows := filterChildren(chapter, usfm.NodeRow)
	if len(rows) != 2 {
		t.Fatalf("rows = %d, want 2", len(rows))
	}
	cells := filterChildren(rows[0], usfm.NodeCell)
	if len(cells) != 2 {
		t.Fatalf("header cells = %d, want 2", len(cells))
	}
	if cells[0].Marker != "th1" || cells[1].Marker != "th2" {
		t.Errorf("cell markers = %q, %q", cells[0].Marker, cells[1].Marker)
	}
}

func TestMilestones(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 \\qt-s |who=\"God\"\\*In the beginning.\\qt-e\\*")
	_, _, para := mustChapterPara(t, result)
	milestones := filterChildren(para, usfm.NodeMilestone)
	if len(milestones) < 1 {
		t.Errorf("milestones = %d, want >= 1", len(milestones))
	}
}

func TestIntroductionParagraphs(t *testing.T) {
	result := Parse("\\id GEN\n\\imt1 Introduction to Genesis\n\\ip This is the first book of the Bible.")
	book := result.Document.Children[0]
	var markers []string
	for _, p := range filterChildren(book, usfm.NodeParagraph) {
		markers = append(markers, p.Marker)
	}
	joined := "," + strings.Join(markers, ",") + ","
	if !strings.Contains(joined, ",imt1,") || !strings.Contains(joined, ",ip,") {
		t.Errorf("markers = %v, want imt1 and ip", markers)
	}
}

func TestTableRowInlineContent(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\tr some text \\tc1 Cell content")
	book := result.Document.Children[0]
	chapter := findChild(book, usfm.NodeChapter)
	row := findChild(chapter, usfm.NodeRow)
	if row == nil {
		t.Fatal("no row node")
	}
	var text strings.Builder
	for _, c := range filterChildren(row, usfm.NodeText) {
		text.WriteString(c.Text)
	}
	if !strings.Contains(text.String(), "some text") {
		t.Errorf("row text = %q, want to contain \"some text\"", text.String())
	}
}

func TestHeaderInlineContent(t *testing.T) {
	result := Parse("\\id GEN\n\\h The Book of \\bk Genesis\\bk*")
	book := result.Document.Children[0]
	header := findChildMarker(book, usfm.NodeParagraph, "h")
	if header == nil {
		t.Fatal("no h paragraph")
	}
	charNode := findChild(header, usfm.NodeChar)
	if charNode == nil || charNode.Marker != "bk" {
		t.Fatalf("char node = %+v, want bk", charNode)
	}
	text := findChild(charNode, usfm.NodeText)
	if text == nil || !strings.Contains(text.Text, "Genesis") {
		t.Errorf("char text = %+v, want to contain Genesis", text)
	}
}

func TestInlineRefMarkers(t *testing.T) {
	input := "\\id GEN\n\\c 1\n\\s1 The Creation\n\\r (\\ref John 1:1–5|JHN 1:1-5\\ref*; \\ref Hebrews 11:1–3|HEB 11:1-3\\ref*)"
	result := Parse(input)
	if len(result.Errors) != 0 {
		t.Fatalf("errors = %v, want none", result.Errors)
	}
	book := result.Document.Children[0]
	chapter := findChild(book, usfm.NodeChapter)
	rPara := findChildMarker(chapter, usfm.NodeParagraph, "r")
	if rPara == nil {
		t.Fatal("no r paragraph")
	}
	refs := filterChildren(rPara, usfm.NodeRef)
	if len(refs) != 2 {
		t.Fatalf("refs = %d, want 2", len(refs))
	}
	if refs[0].Marker != "ref" || refs[0].Attributes["loc"] != "JHN 1:1-5" {
		t.Errorf("ref 0 = %+v, want loc=JHN 1:1-5", refs[0])
	}
	if refs[1].Attributes["loc"] != "HEB 11:1-3" {
		t.Errorf("ref 1 = %+v, want loc=HEB 11:1-3", refs[1])
	}
}

func TestRefInsideFootnote(t *testing.T) {
	input := "\\id GEN\n\\c 1\n\\p\n\\v 1 Text\\f + \\fr 1:1 \\ft See \\ref Matthew 1:1|MAT 1:1\\ref*\\f*"
	result := Parse(input)
	if len(result.Errors) != 0 {
		t.Fatalf("errors = %v, want none", result.Errors)
	}
	book := result.Document.Children[0]
	chapter := findChild(book, usfm.NodeChapter)

	var walk func(nodes []*usfm.Node) *usfm.Node
	walk = func(nodes []*usfm.Node) *usfm.Node {
		for _, c := range nodes {
			if c.Type == usfm.NodeRef {
				return c
			}
			if found := walk(c.Children); found != nil {
				return found
			}
		}
		return nil
	}
	ref := walk(chapter.Children)
	if ref == nil || ref.Attributes["loc"] != "MAT 1:1" {
		t.Errorf("ref = %+v, want loc=MAT 1:1", ref)
	}
}

func TestUnknownMarkerErrors(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 \\zzz Unknown marker.")
	if len(result.Errors) == 0 {
		t.Fatal("no errors collected")
	}
	if !strings.Contains(result.Errors[0].Message, "Unknown marker") {
		t.Errorf("error = %q", result.Errors[0].Message)
	}
}

func TestStrictMode(t *testing.T) {
	_, err := ParseStrict("\\id GEN\n\\c 1\n\\p\n\\v 1 \\zzz Unknown marker.")
	if err == nil {
		t.Fatal("ParseStrict returned no error")
	}
	if !strings.Contains(err.Error(), "Unknown marker") {
		t.Errorf("error = %q", err.Error())
	}
}

func TestStrayEndMarkerTopLevel(t *testing.T) {
	result := Parse("\\id GEN\n\\nd*")
	found := false
	for _, e := range result.Errors {
		if strings.Contains(e.Message, "Unexpected end marker") && strings.Contains(e.Message, `\nd*`) {
			found = true
		}
	}
	if !found {
		t.Errorf("errors = %v, want unexpected end marker for \\nd*", result.Errors)
	}
}

func TestStrayEndMarkerInline(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Text \\bk* orphaned end marker.")
	found := false
	for _, e := range result.Errors {
		if strings.Contains(e.Message, "Unexpected end marker") && strings.Contains(e.Message, `\bk*`) {
			found = true
		}
	}
	if !found {
		t.Errorf("errors = %v, want unexpected end marker for \\bk*", result.Errors)
	}
}

func TestRealisticFile(t *testing.T) {
	input := `\id GEN English Standard Version
\h Genesis
\toc1 The First Book of Moses (Genesis)
\toc2 Genesis
\toc3 Gen
\mt1 Genesis
\c 1
\s1 The Creation of the World
\p
\v 1 In the beginning, God created the heavens and the earth.
\v 2 The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters.
\p
\v 3 And God said, \wj "Let there be light,"\wj* and there was light.
\v 4 And God saw that the light was good. And God separated the light from the darkness.
\v 5 God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.
\c 2
\s1 The Seventh Day, God Rests
\p
\v 1 Thus the heavens and the earth were finished, and all the host of them.
\v 2 And on the seventh day God finished his work that he had done, and he rested on the seventh day from all his work that he had done.`

	result := Parse(input)
	if len(result.Errors) != 0 {
		t.Fatalf("errors = %v, want none", result.Errors)
	}
	book := result.Document.Children[0]
	if book.Type != usfm.NodeBook || book.Code != "GEN" {
		t.Fatalf("book = %+v, want GEN", book)
	}
	chapters := filterChildren(book, usfm.NodeChapter)
	if len(chapters) != 2 || chapters[0].Number != "1" || chapters[1].Number != "2" {
		t.Fatalf("chapters = %+v, want 1 and 2", chapters)
	}
	if len(filterChildren(chapters[0], usfm.NodeParagraph)) == 0 {
		t.Error("chapter 1 has no paragraphs")
	}
	if findChildMarker(chapters[0], usfm.NodeParagraph, "s1") == nil {
		t.Error("chapter 1 has no s1 section heading")
	}
}

func TestPsalmPoetry(t *testing.T) {
	input := `\id PSA
\h Psalms
\mt1 Psalms
\c 1
\d A Psalm of David.
\q1
\v 1 Blessed is the man
\q2 who walks not in the counsel of the wicked,
\q1 nor stands in the way of sinners,
\q2 nor sits in the seat of scoffers;
\q1
\v 2 but his delight is in the law of the \nd Lord\nd*,
\q2 and on his law he meditates day and night.`

	result := Parse(input)
	if len(result.Errors) != 0 {
		t.Fatalf("errors = %v, want none", result.Errors)
	}
	book := result.Document.Children[0]
	if book.Code != "PSA" {
		t.Errorf("code = %q, want PSA", book.Code)
	}
	chapter := findChild(book, usfm.NodeChapter)
	if chapter == nil || chapter.Number != "1" {
		t.Fatalf("chapter = %+v, want number 1", chapter)
	}
	poetry := 0
	for _, p := range filterChildren(chapter, usfm.NodeParagraph) {
		if strings.HasPrefix(p.Marker, "q") {
			poetry++
		}
	}
	if poetry == 0 {
		t.Error("no poetry (q*) paragraphs found")
	}
}

// TestNoteTextKeepsTrailingSpace pins a TS-parser quirk found by the corpus
// differential test: splitting the note caller off with split(/\s+/) yields a
// trailing empty field for trailing whitespace, so the rejoined note text
// keeps a trailing space.
func TestNoteTextKeepsTrailingSpace(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Text\\f + note text \\f*")
	_, _, para := mustChapterPara(t, result)
	note := findChild(para, usfm.NodeNote)
	if note == nil {
		t.Fatal("no note node")
	}
	text := findChild(note, usfm.NodeText)
	if text == nil || text.Text != "note text " {
		t.Errorf("note text = %+v, want \"note text \" (trailing space)", text)
	}
}

func TestConvenienceParse(t *testing.T) {
	result := Parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Hello world.")
	if result.Document.Type != usfm.NodeDocument || len(result.Document.Children) == 0 {
		t.Errorf("document = %+v", result.Document)
	}
}
