package preview

import (
	"regexp"
	"strings"
	"testing"

	"github.com/usfm-tools/usfm-parser-go/parser"
)

const multiVerse = "\\id GEN\n\\c 1\n\\p\n\\v 1 A. \\v 2 B."

// --- ports of usfm-model/tests/publication-preview.test.ts ---

func buildFrom(t *testing.T, source string, opts Options) *Document {
	t.Helper()
	return BuildPreview(parser.Parse(source).Document, opts)
}

func lineBlocks(blocks []Block) []Block {
	out := []Block{}
	for _, b := range blocks {
		if b.Kind == BlockLine {
			out = append(out, b)
		}
	}
	return out
}

func TestBuildPreviewChapterAndVerse(t *testing.T) {
	preview := buildFrom(t, "\\id GEN Test\n\\c 1\n\\p\n\\v 1 Hello world.", Options{})
	if len(preview.Books) != 1 {
		t.Fatalf("books = %d, want 1", len(preview.Books))
	}
	book := preview.Books[0]
	if book.Code != "GEN" {
		t.Errorf("code = %q, want GEN", book.Code)
	}
	if len(book.Chapters) != 1 {
		t.Fatalf("chapters = %d, want 1", len(book.Chapters))
	}
	ch := book.Chapters[0]
	if ch.Number != "1" {
		t.Errorf("chapter number = %q, want 1", ch.Number)
	}
	lines := lineBlocks(ch.Blocks)
	if len(lines) == 0 {
		t.Fatal("no line block")
	}
	var hasVerse, hasHello bool
	for _, s := range lines[0].Segments {
		if s.Kind == SegVerse && s.Number == "1" {
			hasVerse = true
		}
		if s.Kind == SegText && strings.Contains(s.Text, "Hello") {
			hasHello = true
		}
	}
	if !hasVerse || !hasHello {
		t.Errorf("segments = %+v, want verse 1 and Hello text", lines[0].Segments)
	}
}

func TestBuildPreviewPoetryFlow(t *testing.T) {
	preview := buildFrom(t, "\\id PSA\n\\c 1\n\\q1 \\v 1 Line one\n\\q2 second.", Options{})
	for _, b := range preview.Books[0].Chapters[0].Blocks {
		if b.Kind == BlockLine && b.Marker == "q1" {
			if b.Flow != FlowPoetry {
				t.Errorf("flow = %q, want poetry", b.Flow)
			}
			return
		}
	}
	t.Fatal("no q1 line block found")
}

func TestBuildPreviewHeadingBlocks(t *testing.T) {
	preview := buildFrom(t, "\\id GEN\n\\c 1\n\\s1 The Beginning\n\\p\n\\v 1 Text.", Options{})
	for _, b := range preview.Books[0].Chapters[0].Blocks {
		if b.Kind == BlockHeading {
			if b.Marker != "s1" {
				t.Errorf("marker = %q, want s1", b.Marker)
			}
			var ok bool
			for _, s := range b.Segments {
				if s.Kind == SegText && strings.Contains(s.Text, "Beginning") {
					ok = true
				}
			}
			if !ok {
				t.Errorf("segments = %+v, want Beginning text", b.Segments)
			}
			return
		}
	}
	t.Fatal("no heading block found")
}

func TestBuildPreviewVersePerLine(t *testing.T) {
	source := "\\id GEN\n\\c 1\n\\p\n\\v 1 First. \\v 2 Second."
	merged := buildFrom(t, source, Options{})
	if n := len(lineBlocks(merged.Books[0].Chapters[0].Blocks)); n != 1 {
		t.Fatalf("merged lines = %d, want 1", n)
	}
	split := buildFrom(t, source, Options{VersePerLine: true})
	lines := lineBlocks(split.Books[0].Chapters[0].Blocks)
	if len(lines) != 2 {
		t.Fatalf("split lines = %d, want 2", len(lines))
	}
	for i, want := range []string{"1", "2"} {
		var ok bool
		for _, s := range lines[i].Segments {
			if s.Kind == SegVerse && s.Number == want {
				ok = true
			}
		}
		if !ok {
			t.Errorf("line %d missing verse %s: %+v", i, want, lines[i].Segments)
		}
	}
}

// --- ports of usfm-model/tests/render-preview-html.test.ts ---

func TestRenderEscapesUserText(t *testing.T) {
	html := Render("\\id GEN\n\\c 1\n\\p\n\\v 1 <evil>", Options{})
	if !strings.Contains(html, "&lt;evil&gt;") || strings.Contains(html, "<evil>") {
		t.Errorf("html = %q", html)
	}
}

func TestRenderMarkerClasses(t *testing.T) {
	html := Render("\\id GEN\n\\c 1\n\\p\n\\v 1 \\nd Lord\\nd* here.", Options{})
	if !strings.Contains(html, "usfm-nd") || !strings.Contains(html, "Lord") {
		t.Errorf("html = %q", html)
	}
}

func TestRenderVerseSup(t *testing.T) {
	html := Render("\\id GEN\n\\c 1\n\\p\n\\v 1 Hi", Options{})
	if !strings.Contains(html, `<sup class="usfm-v" data-verse="1">1</sup>`) {
		t.Errorf("html = %q", html)
	}
}

var lineRe = regexp.MustCompile(`class="usfm-line usfm-p`)

func TestRenderMultiVerseParagraph(t *testing.T) {
	if n := len(lineRe.FindAllString(Render(multiVerse, Options{}), -1)); n != 1 {
		t.Errorf("lines = %d, want 1", n)
	}
	if n := len(lineRe.FindAllString(Render(multiVerse, Options{VersePerLine: true}), -1)); n != 2 {
		t.Errorf("versePerLine lines = %d, want 2", n)
	}
	if Render(multiVerse, Options{}) == Render(multiVerse, Options{VersePerLine: true}) {
		t.Error("versePerLine should change the HTML")
	}
}

func TestRenderErrorBanner(t *testing.T) {
	html := Render("\\id GEN\n\\c 1\n\\p\n\\v 1 \\zzz bad", Options{})
	aside := strings.Index(html, `<aside class="usfm-preview-errors"`)
	article := strings.Index(html, `<article class="usfm-document"`)
	if aside < 0 || article < 0 || aside > article {
		t.Errorf("banner not before document: aside=%d article=%d", aside, article)
	}
}

func TestRenderEscapesErrorMessages(t *testing.T) {
	html := Render("\\id GEN\n\\c 1\n\\p\n\\v 1 \\<inj> bad", Options{})
	if regexp.MustCompile(`<aside[^>]*>.*<inj>`).MatchString(html) {
		t.Errorf("unescaped error message: %q", html)
	}
}
