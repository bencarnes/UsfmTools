package preview

import (
	"regexp"
	"strings"

	"github.com/usfm-tools/usfm-parser-go/parser"
)

// Render parses a USFM source string and renders it as publication-style
// HTML using a fixed default markup, exactly like the TS renderPreviewHtml.
// Parse errors (if any) are surfaced as a banner before the document. CSS
// hooks (class names like usfm-line, usfm-v, usfm-chapter, usfm-nd, …) are
// the only customization surface — style them in the application stylesheet.
func Render(source string, opts Options) string {
	result := parser.Parse(source)
	doc := BuildPreview(result.Document, opts)

	var books strings.Builder
	for _, book := range doc.Books {
		renderBook(&books, book)
	}
	idAttr := ""
	if len(doc.Books) > 0 && doc.Books[0].Code != "" {
		idAttr = ` data-usfm-id="` + escapeText(doc.Books[0].Code) + `"`
	}
	body := `<article class="usfm-document"` + idAttr + `>` + books.String() + `</article>`
	if len(result.Errors) == 0 {
		return body
	}
	parts := make([]string, len(result.Errors))
	for i, e := range result.Errors {
		parts[i] = "<span>" + escapeText(e.Message) + "</span>"
	}
	return `<aside class="usfm-preview-errors" role="status">` + strings.Join(parts, " ") + `</aside>` + body
}

var htmlEscaper = strings.NewReplacer(
	"&", "&amp;",
	"<", "&lt;",
	">", "&gt;",
	`"`, "&quot;",
	"'", "&#39;",
)

func escapeText(s string) string {
	return htmlEscaper.Replace(s)
}

var markerClassStripRe = regexp.MustCompile(`[^a-zA-Z0-9_-]`)

func markerClass(marker string) string {
	return "usfm-" + markerClassStripRe.ReplaceAllString(marker, "")
}

func renderBook(b *strings.Builder, book Book) {
	desc := ""
	if book.Description != "" {
		desc = `<p class="usfm-book-desc">` + escapeText(book.Description) + `</p>`
	}
	preamble := ""
	if len(book.PreambleBlocks) > 0 {
		var pb strings.Builder
		for _, block := range book.PreambleBlocks {
			renderBlock(&pb, block)
		}
		preamble = `<div class="usfm-preamble">` + pb.String() + `</div>`
	}
	b.WriteString(`<section class="usfm-book" data-code="` + escapeText(book.Code) +
		`"><header class="usfm-book-hd"><h1 class="usfm-book-code">` + escapeText(book.Code) +
		`</h1>` + desc + `</header>` + preamble)
	for _, ch := range book.Chapters {
		renderChapter(b, ch)
	}
	b.WriteString(`</section>`)
}

func renderChapter(b *strings.Builder, ch Chapter) {
	b.WriteString(`<section class="usfm-chapter" data-chapter="` + escapeText(ch.Number) +
		`"><h2 class="usfm-chapter-num">Chapter ` + escapeText(ch.Number) +
		`</h2><div class="usfm-chapter-body">`)
	for _, block := range ch.Blocks {
		renderBlock(b, block)
	}
	b.WriteString(`</div></section>`)
}

func renderBlock(b *strings.Builder, block Block) {
	switch block.Kind {
	case BlockHeading:
		b.WriteString(`<h3 class="usfm-heading ` + markerClass(block.Marker) + `">`)
		renderSegments(b, block.Segments)
		b.WriteString(`</h3>`)
	case BlockLine:
		flowClass := "usfm-line--prose"
		if block.Flow == FlowPoetry {
			flowClass = "usfm-line--poetry"
		}
		b.WriteString(`<p class="usfm-line ` + markerClass(block.Marker) + ` ` + flowClass + `">`)
		renderSegments(b, block.Segments)
		b.WriteString(`</p>`)
	case BlockBlank:
		b.WriteString(`<div class="usfm-blank" aria-hidden="true"></div>`)
	case BlockTable:
		b.WriteString(`<table class="usfm-table"><tbody>`)
		for _, row := range block.Rows {
			b.WriteString(`<tr class="usfm-tr">`)
			for _, c := range row.Cells {
				b.WriteString(`<td class="usfm-tc ` + markerClass(c.Marker) + `">`)
				renderSegments(b, c.Segments)
				b.WriteString(`</td>`)
			}
			b.WriteString(`</tr>`)
		}
		b.WriteString(`</tbody></table>`)
	case BlockUnsupported:
		m := ""
		if block.Marker != "" {
			m = " marker-" + markerClass(block.Marker)
		}
		b.WriteString(`<!-- unsupported:` + escapeText(block.Reason) + m + ` -->`)
	}
}

func renderSegments(b *strings.Builder, segments []Segment) {
	for _, s := range segments {
		switch s.Kind {
		case SegVerse:
			b.WriteString(`<sup class="usfm-v" data-verse="` + escapeText(s.Number) + `">` +
				escapeText(s.Number) + `</sup>`)
		case SegText:
			b.WriteString(`<span class="usfm-txt">` + escapeText(s.Text) + `</span>`)
		case SegStyled:
			b.WriteString(`<span class="usfm-char ` + markerClass(s.Marker) + `">`)
			renderSegments(b, s.Children)
			b.WriteString(`</span>`)
		case SegNote:
			b.WriteString(`<span class="usfm-note ` + markerClass(s.Marker) + `" data-caller="` +
				escapeText(s.Caller) + `"><span class="usfm-note-caller">` + escapeText(s.Caller) +
				`</span><span class="usfm-note-body">`)
			renderSegments(b, s.Children)
			b.WriteString(`</span></span>`)
		case SegRef:
			b.WriteString(`<span class="usfm-ref">`)
			renderSegments(b, s.Children)
			b.WriteString(`</span>`)
		}
	}
}
