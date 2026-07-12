// Package preview builds a publication-style reading layout from parsed
// USFM and renders it as HTML.
//
// Port of packages/usfm-model/src/view-models/publication-preview.ts and
// renderer/render-preview-html.ts; the block/segment model and the emitted
// markup (class names like usfm-line, usfm-v, usfm-chapter, …) are kept
// identical so the HTML is verified byte-for-byte against the TS renderer
// across the BSB corpus.
package preview

import (
	"regexp"
	"strings"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/grammar"
	"github.com/usfm-tools/usfm-parser-go/internal/jsstr"
)

// Options configures preview building/rendering.
type Options struct {
	// VersePerLine expands line blocks that contain multiple verse
	// milestones so each verse renders on its own preview line.
	VersePerLine bool `json:"versePerLine,omitempty"`
}

// Document is the publication-oriented view of a parsed USFM document.
type Document struct {
	Books []Book `json:"books"`
}

// Book is one \id book (or a preamble-only pseudo-book with an empty Code).
type Book struct {
	Code           string    `json:"code"`
	Description    string    `json:"description,omitempty"`
	PreambleBlocks []Block   `json:"preambleBlocks"`
	Chapters       []Chapter `json:"chapters"`
}

// Chapter is one \c chapter with its content blocks.
type Chapter struct {
	Number string  `json:"number"`
	Blocks []Block `json:"blocks"`
}

// BlockKind discriminates Block. The values match the TS PreviewBlock kinds.
type BlockKind string

const (
	BlockHeading     BlockKind = "heading"
	BlockLine        BlockKind = "line"
	BlockBlank       BlockKind = "blank"
	BlockTable       BlockKind = "table"
	BlockUnsupported BlockKind = "unsupported"
)

// LineFlow classifies a line block's layout.
type LineFlow string

const (
	FlowProse  LineFlow = "prose"
	FlowPoetry LineFlow = "poetry"
)

// Block is one preview block. Like the AST's Node, the TS union is modeled
// as a single flat struct with a Kind discriminator; kind-specific fields
// are zero-valued elsewhere.
type Block struct {
	Kind     BlockKind  `json:"kind"`
	Marker   string     `json:"marker,omitempty"`
	Flow     LineFlow   `json:"flow,omitempty"`     // line blocks
	Segments []Segment  `json:"segments,omitempty"` // heading and line blocks
	Rows     []TableRow `json:"rows,omitempty"`     // table blocks
	Reason   string     `json:"reason,omitempty"`   // unsupported blocks
}

// TableRow is one row of a table block.
type TableRow struct {
	Cells []TableCell `json:"cells"`
}

// TableCell is one cell of a table row.
type TableCell struct {
	Marker   string    `json:"marker"`
	Segments []Segment `json:"segments"`
}

// SegmentKind discriminates Segment. Values match the TS PublicationSegment.
type SegmentKind string

const (
	SegVerse  SegmentKind = "verse"
	SegText   SegmentKind = "text"
	SegStyled SegmentKind = "styled"
	SegNote   SegmentKind = "note"
	SegRef    SegmentKind = "ref"
)

// Segment is one inline piece of a block.
type Segment struct {
	Kind     SegmentKind `json:"kind"`
	Number   string      `json:"number,omitempty"` // verse
	Text     string      `json:"text,omitempty"`   // text
	Marker   string      `json:"marker,omitempty"` // styled, note
	Caller   string      `json:"caller,omitempty"` // note
	Children []Segment   `json:"children,omitempty"`
}

// BuildPreview builds the publication view model from a parsed document.
func BuildPreview(document *usfm.Node, opts Options) *Document {
	books := []Book{}
	for _, child := range document.Children {
		if child.Type == usfm.NodeBook {
			books = append(books, buildBook(child))
		} else {
			books = append(books, Book{
				Code:           "",
				PreambleBlocks: nodeToBlocks(child),
				Chapters:       []Chapter{},
			})
		}
	}
	doc := &Document{Books: books}
	if opts.VersePerLine {
		return applyVersePerLine(doc)
	}
	return doc
}

// applyVersePerLine expands every line block that contains more than one
// verse milestone into one line block per verse.
func applyVersePerLine(doc *Document) *Document {
	books := make([]Book, len(doc.Books))
	for i, book := range doc.Books {
		chapters := make([]Chapter, len(book.Chapters))
		for j, ch := range book.Chapters {
			chapters[j] = Chapter{Number: ch.Number, Blocks: expandLineBlocks(ch.Blocks)}
		}
		books[i] = Book{
			Code:           book.Code,
			Description:    book.Description,
			PreambleBlocks: expandLineBlocks(book.PreambleBlocks),
			Chapters:       chapters,
		}
	}
	return &Document{Books: books}
}

func expandLineBlocks(blocks []Block) []Block {
	out := []Block{}
	for _, b := range blocks {
		if b.Kind == BlockLine {
			out = append(out, splitLineByVerses(b)...)
		} else {
			out = append(out, b)
		}
	}
	return out
}

func splitLineByVerses(block Block) []Block {
	verseSeenInCurrent := false
	lines := [][]Segment{}
	buf := []Segment{}

	for _, s := range block.Segments {
		if s.Kind == SegVerse {
			if verseSeenInCurrent {
				lines = append(lines, buf)
				buf = []Segment{}
				verseSeenInCurrent = false
			}
			buf = append(buf, s)
			verseSeenInCurrent = true
		} else {
			buf = append(buf, s)
		}
	}
	if len(buf) > 0 {
		lines = append(lines, buf)
	}

	if len(lines) <= 1 {
		return []Block{block}
	}

	out := make([]Block, len(lines))
	for i, segments := range lines {
		out[i] = Block{Kind: BlockLine, Marker: block.Marker, Flow: block.Flow, Segments: segments}
	}
	return out
}

func buildBook(book *usfm.Node) Book {
	preambleBlocks := []Block{}
	chapters := []Chapter{}
	for _, child := range book.Children {
		if child.Type == usfm.NodeChapter {
			chapters = append(chapters, buildChapter(child))
		} else {
			preambleBlocks = append(preambleBlocks, nodeToBlocks(child)...)
		}
	}
	return Book{
		Code:           book.Code,
		Description:    book.Description,
		PreambleBlocks: preambleBlocks,
		Chapters:       chapters,
	}
}

func buildChapter(chapter *usfm.Node) Chapter {
	blocks := []Block{}
	for _, child := range chapter.Children {
		blocks = append(blocks, nodeToBlocks(child)...)
	}
	return Chapter{Number: chapter.Number, Blocks: blocks}
}

func nodeToBlocks(node *usfm.Node) []Block {
	switch node.Type {
	case usfm.NodeParagraph:
		return []Block{paragraphToBlock(node)}
	case usfm.NodeVerse:
		return []Block{orphanVerseLine(node)}
	case usfm.NodeRow:
		return []Block{rowToTableBlock(node)}
	case usfm.NodeText:
		if jsstr.Trim(node.Text) == "" {
			return []Block{}
		}
		return []Block{{
			Kind:     BlockLine,
			Marker:   "p",
			Flow:     FlowProse,
			Segments: []Segment{{Kind: SegText, Text: normalizeSpaces(node.Text)}},
		}}
	case usfm.NodeFigure:
		return []Block{figureBlock(node)}
	case usfm.NodeSidebar:
		return []Block{{Kind: BlockUnsupported, Reason: "sidebar", Marker: "esb"}}
	case usfm.NodeTable:
		return []Block{{Kind: BlockUnsupported, Reason: "table-wrapper", Marker: "table"}}
	case usfm.NodeUnknown:
		return []Block{{Kind: BlockUnsupported, Reason: "unknown-marker", Marker: node.Marker}}
	case usfm.NodeChar, usfm.NodeNote, usfm.NodeRef, usfm.NodeMilestone, usfm.NodeOptBreak:
		return []Block{}
	default:
		return []Block{{Kind: BlockUnsupported, Reason: "node:" + string(node.Type), Marker: node.Marker}}
	}
}

func figureBlock(fig *usfm.Node) Block {
	alt := fig.Attributes["alt"]
	text := "[Figure]"
	if alt != "" {
		text = "[Figure: " + normalizeSpaces(alt) + "]"
	}
	return Block{
		Kind:     BlockLine,
		Marker:   "fig",
		Flow:     FlowProse,
		Segments: []Segment{{Kind: SegText, Text: text}},
	}
}

func orphanVerseLine(v *usfm.Node) Block {
	return Block{
		Kind:     BlockLine,
		Marker:   "p",
		Flow:     FlowProse,
		Segments: []Segment{{Kind: SegVerse, Number: v.Number}},
	}
}

func rowToTableBlock(row *usfm.Node) Block {
	cells := []TableCell{}
	for _, cell := range row.Children {
		if cell.Type == usfm.NodeCell {
			cells = append(cells, TableCell{
				Marker:   cell.Marker,
				Segments: buildSegments(cell.Children),
			})
		}
	}
	return Block{Kind: BlockTable, Rows: []TableRow{{Cells: cells}}}
}

func paragraphToBlock(p *usfm.Node) Block {
	marker := p.Marker
	if marker == "b" {
		return Block{Kind: BlockBlank}
	}

	cat := grammar.Category(marker)
	if cat == grammar.Title || cat == grammar.SectionPara {
		return Block{Kind: BlockHeading, Marker: marker, Segments: buildSegments(p.Children)}
	}

	return Block{
		Kind:     BlockLine,
		Marker:   marker,
		Flow:     paragraphFlow(marker, cat),
		Segments: buildSegments(p.Children),
	}
}

var (
	poetryQRe  = regexp.MustCompile(`^q[1-9]?$`)
	poetryQmRe = regexp.MustCompile(`^qm[1-9]$`)
	poetryIqRe = regexp.MustCompile(`^iq[1-9]?$`)
	poetryLiRe = regexp.MustCompile(`^li[1-9]$`)
)

func paragraphFlow(marker string, cat grammar.MarkerCategory) LineFlow {
	if cat == grammar.Introduction || cat == grammar.VersePara {
		if poetryQRe.MatchString(marker) ||
			marker == "qc" || marker == "qr" || marker == "qm" ||
			poetryQmRe.MatchString(marker) ||
			poetryIqRe.MatchString(marker) ||
			marker == "li" ||
			poetryLiRe.MatchString(marker) {
			return FlowPoetry
		}
	}
	if cat == grammar.List {
		if strings.HasPrefix(marker, "li") {
			return FlowPoetry
		}
		return FlowProse
	}
	return FlowProse
}

func buildSegments(nodes []*usfm.Node) []Segment {
	out := []Segment{}
	for _, node := range nodes {
		piece, ok := nodeToSegment(node)
		if !ok {
			continue
		}
		if piece.Kind == SegText && len(out) > 0 && out[len(out)-1].Kind == SegText {
			prev := &out[len(out)-1]
			prev.Text = normalizeSpaces(prev.Text + piece.Text)
		} else {
			out = append(out, piece)
		}
	}
	return mergeAdjacentText(out)
}

func nodeToSegment(node *usfm.Node) (Segment, bool) {
	switch node.Type {
	case usfm.NodeText:
		t := normalizeSpaces(node.Text)
		if t == "" {
			return Segment{}, false
		}
		return Segment{Kind: SegText, Text: t}, true
	case usfm.NodeVerse:
		return Segment{Kind: SegVerse, Number: node.Number}, true
	case usfm.NodeChar:
		return Segment{Kind: SegStyled, Marker: node.Marker, Children: buildSegments(node.Children)}, true
	case usfm.NodeNote:
		return Segment{
			Kind:     SegNote,
			Marker:   node.Marker,
			Caller:   node.Caller,
			Children: buildSegments(node.Children),
		}, true
	case usfm.NodeRef:
		return Segment{Kind: SegRef, Children: buildSegments(node.Children)}, true
	case usfm.NodeParagraph:
		if grammar.IsParaMarker(node.Marker) {
			return Segment{Kind: SegText, Text: " " + inlineParagraphFallback(node) + " "}, true
		}
		return Segment{}, false
	case usfm.NodeOptBreak:
		return Segment{Kind: SegText, Text: " "}, true
	default:
		// milestone and anything else contribute nothing inline
		return Segment{}, false
	}
}

func inlineParagraphFallback(p *usfm.Node) string {
	var b strings.Builder
	for _, c := range p.Children {
		if c.Type == usfm.NodeText {
			b.WriteString(c.Text)
		}
	}
	return normalizeSpaces(b.String())
}

func mergeAdjacentText(segments []Segment) []Segment {
	merged := []Segment{}
	for _, seg := range segments {
		if seg.Kind == SegText && len(merged) > 0 && merged[len(merged)-1].Kind == SegText {
			prev := &merged[len(merged)-1]
			prev.Text = normalizeSpaces(prev.Text + seg.Text)
		} else if seg.Kind == SegStyled || seg.Kind == SegNote || seg.Kind == SegRef {
			seg.Children = mergeAdjacentText(seg.Children)
			merged = append(merged, seg)
		} else {
			merged = append(merged, seg)
		}
	}
	return merged
}

// normalizeSpaces mirrors the TS normalizeSpaces: collapse every run of
// whitespace (JavaScript \s semantics) to one space and trim the ends.
func normalizeSpaces(s string) string {
	return strings.Join(strings.FieldsFunc(s, jsstr.IsSpace), " ")
}
