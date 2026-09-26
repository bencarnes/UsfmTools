// Package parser parses USFM text into a document AST.
//
// Port of packages/usfm-parser/src/parser.ts, method for method, including
// its error recovery; the two are kept byte-identical. Parsing is
// error-tolerant: it always produces a document and collects errors, unless
// the strict variant is used.
//
// Whitespace splitting matches JavaScript semantics (Unicode whitespace plus
// U+FEFF) rather than Go's strings.Fields, so documents with a BOM or exotic
// spaces parse identically to the TS parser.
package parser

import (
	"fmt"
	"strings"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/grammar"
	"github.com/usfm-tools/usfm-parser-go/internal/jsstr"
	"github.com/usfm-tools/usfm-parser-go/lexer"
)

// Parse parses USFM text, collecting errors instead of failing (never
// panics on malformed input).
func Parse(input string) usfm.ParseResult {
	result, _ := parse(input, false)
	return result
}

// ParseStrict parses USFM text and stops at the first parse error, returning
// it along with the partial result (the TS parser throws in strict mode).
func ParseStrict(input string) (usfm.ParseResult, error) {
	return parse(input, true)
}

type abort struct{ err error }

func parse(input string, strict bool) (result usfm.ParseResult, err error) {
	p := &parser{
		tokens: lexer.Tokenize(input),
		errors: []usfm.ParseError{},
		strict: strict,
		doc:    &usfm.Node{Type: usfm.NodeDocument, Children: []*usfm.Node{}},
	}
	if strict {
		defer func() {
			if r := recover(); r != nil {
				a, ok := r.(abort)
				if !ok {
					panic(r)
				}
				err = a.err
				result = usfm.ParseResult{Document: p.doc, Errors: p.errors}
			}
		}()
	}

	for p.pos < len(p.tokens) {
		if node := p.parseTopLevel(); node != nil {
			p.doc.Children = append(p.doc.Children, node)
		}
	}

	return usfm.ParseResult{Document: p.doc, Errors: p.errors}, nil
}

type parser struct {
	tokens []lexer.Token
	pos    int
	errors []usfm.ParseError
	strict bool
	doc    *usfm.Node

	// Allocation slabs: nodes, their positions, and children slices are
	// carved from chunks instead of allocated one by one (an AST is built
	// and dropped as a whole, so per-node lifetimes don't matter).
	nodes     []usfm.Node
	positions []usfm.Position
	childSlab []*usfm.Node
	// stack collects the children of the nodes being built; each parent
	// records its base, pushes children, and collects them on completion.
	stack []*usfm.Node
}

// slabSize is the chunk length for the allocation slabs.
const slabSize = 1024

func (p *parser) newNode(n usfm.Node) *usfm.Node {
	if len(p.nodes) == cap(p.nodes) {
		p.nodes = make([]usfm.Node, 0, slabSize)
	}
	p.nodes = append(p.nodes, n)
	return &p.nodes[len(p.nodes)-1]
}

func (p *parser) newPosition(pos usfm.Position) *usfm.Position {
	if len(p.positions) == cap(p.positions) {
		p.positions = make([]usfm.Position, 0, slabSize)
	}
	p.positions = append(p.positions, pos)
	return &p.positions[len(p.positions)-1]
}

// collect pops the children pushed since base into an exactly sized,
// non-nil slice. Its capacity is clipped so appending to it (e.g. by AST
// consumers) copies instead of overwriting a neighbor in the slab.
func (p *parser) collect(base int) []*usfm.Node {
	n := len(p.stack) - base
	if p.childSlab == nil || n > cap(p.childSlab)-len(p.childSlab) {
		p.childSlab = make([]*usfm.Node, 0, max(slabSize, n))
	}
	start := len(p.childSlab)
	p.childSlab = append(p.childSlab, p.stack[base:]...)
	clear(p.stack[base:])
	p.stack = p.stack[:base]
	return p.childSlab[start:len(p.childSlab):len(p.childSlab)]
}

func (p *parser) parseTopLevel() *usfm.Node {
	token := p.current()
	if token == nil {
		return nil
	}

	if token.Type == lexer.Marker {
		marker := token.Value

		switch {
		case marker == "id":
			return p.parseId()
		case marker == "c":
			return p.parseChapter()
		case marker == "v":
			return p.parseVerse()
		case grammar.IsParaMarker(marker):
			return p.parseParagraph()
		case grammar.IsCharMarker(marker):
			return p.parseChar()
		case grammar.IsNoteMarker(marker):
			return p.parseNote()
		case grammar.IsCellMarker(marker):
			return p.parseCell()
		case grammar.IsMilestoneMarker(marker):
			return p.parseMilestone()
		case marker == "tr":
			return p.parseTableRow()
		case marker == "fig":
			return p.parseFigure()
		case marker == "esb":
			return p.parseSidebar()
		}

		// Header/attribute markers that appear at book level
		cat := grammar.Category(marker)
		if cat == grammar.Header || cat == grammar.Attribute || cat == grammar.Internal {
			return p.parseHeaderOrMisc()
		}

		// Unknown marker — advance and produce an unknown node
		return p.parseUnknown()
	}

	if token.Type == lexer.EndMarker {
		p.addError(
			usfm.CodeUnexpectedEndMarker,
			fmt.Sprintf("Unexpected end marker '\\%s*' with no matching opening marker", token.Value),
			token.Position,
		)
		p.advance()
		return nil
	}

	if token.Type == lexer.Text || token.Type == lexer.Newline {
		return p.parseTextRun()
	}

	// Skip other token types at the top level
	p.advance()
	return nil
}

func (p *parser) parseId() *usfm.Node {
	position := p.current().Position
	p.advance() // skip \id marker

	code := ""
	description := ""

	// The text following \id is: CODE optional-description
	if t := p.current(); t != nil && (t.Type == lexer.Text || t.Type == lexer.Newline) {
		text := p.consumeTextLine()
		fields := jsstr.Fields(jsstr.TrimStart(text))
		if len(fields) > 0 {
			code = fields[0]
		}
		if len(fields) > 1 {
			description = jsstr.Trim(strings.Join(fields[1:], " "))
		}
	}

	node := p.newNode(usfm.Node{
		Type:        usfm.NodeBook,
		Marker:      "id",
		Code:        code,
		Description: description,
		Position:    p.newPosition(position),
	})
	base := len(p.stack)

	// Parse remaining book-level content (headers, etc.) until next \id or end
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.Marker && cur.Value == "id" {
			break
		}
		if child := p.parseTopLevel(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseChapter() *usfm.Node {
	position := p.current().Position
	p.advance() // skip \c

	number := ""
	if t := p.current(); t != nil && t.Type == lexer.Text {
		var remaining string
		number, remaining = jsstr.SplitFirstField(jsstr.TrimStart(t.Value))
		if remaining != "" {
			// \c takes only a number: report the extra text but keep it as
			// chapter content rather than dropping it
			p.addError(
				usfm.CodeChapterText,
				fmt.Sprintf("Unexpected text after chapter number '\\c %s'", number),
				position,
			)
			p.tokens[p.pos].Value = remaining
		} else {
			p.advance()
		}
	}

	// Skip newline after chapter number
	p.skipNewlines()

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeChapter,
		Marker:   "c",
		Number:   number,
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	// Consume chapter-level content
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.Marker && (cur.Value == "c" || cur.Value == "id") {
			break
		}
		if child := p.parseTopLevel(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseVerse() *usfm.Node {
	position := p.current().Position
	p.advance() // skip \v

	number := ""
	if t := p.current(); t != nil && t.Type == lexer.Text {
		text := jsstr.TrimStart(t.Value)
		if text != "" {
			var remaining string
			number, remaining = jsstr.SplitFirstField(text)
			if remaining != "" {
				// Keep the rest of the text in place for the enclosing node
				// (position stays at the token start, matching the TS parser)
				p.tokens[p.pos].Value = remaining
			} else {
				p.advance()
			}
		} else {
			p.advance()
		}
	}

	return p.newNode(usfm.Node{
		Type:     usfm.NodeVerse,
		Marker:   "v",
		Number:   number,
		Position: p.newPosition(position),
	})
}

func (p *parser) parseParagraph() *usfm.Node {
	token := p.current()
	position := token.Position
	marker := token.Value
	p.advance()

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeParagraph,
		Marker:   marker,
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	// Skip leading newlines
	p.skipNewlines()

	// Consume paragraph content until next paragraph-level marker, chapter, etc.
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.Marker {
			if grammar.IsParaMarker(cur.Value) ||
				cur.Value == "c" || cur.Value == "id" || cur.Value == "tr" ||
				cur.Value == "esb" || cur.Value == "esbe" {
				break
			}
		}
		if child := p.parseInlineContent(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseChar() *usfm.Node {
	token := p.current()
	position := token.Position
	marker := token.Value
	p.advance()

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeChar,
		Marker:   marker,
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	// Consume content until the closing marker.
	// Verse milestones (\v) are allowed inside char spans per the USFM spec,
	// so we do NOT break on \v — it becomes a child milestone node.
	for p.pos < len(p.tokens) {
		cur := p.current()

		if cur.Type == lexer.EndMarker && cur.Value == marker {
			p.advance()
			break
		}

		// Capture attributes on the char node
		if cur.Type == lexer.Attribute {
			p.applyAttributes(node, cur)
			p.advance()
			continue
		}

		// Break on paragraph markers, chapters, or book id — these are
		// structural boundaries
		if cur.Type == lexer.Marker &&
			(grammar.IsParaMarker(cur.Value) || cur.Value == "c" || cur.Value == "id") {
			break
		}

		if child := p.parseInlineContent(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseRef() *usfm.Node {
	position := p.current().Position
	p.advance() // skip \ref

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeRef,
		Marker:   "ref",
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	for p.pos < len(p.tokens) {
		cur := p.current()

		if cur.Type == lexer.EndMarker && cur.Value == "ref" {
			p.advance()
			break
		}

		if cur.Type == lexer.Attribute {
			if node.Attributes == nil {
				node.Attributes = map[string]string{}
			}
			if len(cur.Attributes) > 0 {
				for k, v := range cur.Attributes {
					node.Attributes[k] = v
				}
			} else if cur.Value != "" {
				defaultKey, ok := grammar.DefaultAttribute("ref")
				if !ok {
					defaultKey = "default"
				}
				node.Attributes[defaultKey] = cur.Value
			}
			p.advance()
			continue
		}

		if cur.Type == lexer.Marker &&
			(grammar.IsParaMarker(cur.Value) || cur.Value == "c" || cur.Value == "id") {
			break
		}

		if child := p.parseInlineContent(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseNote() *usfm.Node {
	token := p.current()
	position := token.Position
	marker := token.Value
	p.advance()

	caller := ""

	// First text token after note marker is the caller (e.g. "+", "-", "a");
	// the rest of the token is note text, kept verbatim
	if t := p.current(); t != nil && t.Type == lexer.Text {
		var remaining string
		caller, remaining = jsstr.SplitFirstField(jsstr.TrimStart(t.Value))
		if remaining != "" {
			p.tokens[p.pos].Value = remaining
		} else {
			p.advance()
		}
	}

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeNote,
		Marker:   marker,
		Caller:   caller,
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	// Consume note content until end marker
	for p.pos < len(p.tokens) {
		cur := p.current()

		if cur.Type == lexer.EndMarker && cur.Value == marker {
			p.advance()
			break
		}

		// Break on structural markers
		if cur.Type == lexer.Marker &&
			(grammar.IsParaMarker(cur.Value) || cur.Value == "c" || cur.Value == "id") {
			break
		}

		if child := p.parseInlineContent(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseTableRow() *usfm.Node {
	position := p.current().Position
	p.advance() // skip \tr

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeRow,
		Marker:   "tr",
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	// Skip newlines after \tr
	p.skipNewlines()

	// Consume cells until next row or non-table marker
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.Marker {
			if cur.Value == "tr" {
				break
			}
			if grammar.IsCellMarker(cur.Value) {
				p.stack = append(p.stack, p.parseCell())
				continue
			}
			if grammar.IsParaMarker(cur.Value) || cur.Value == "c" || cur.Value == "id" {
				break
			}
		}

		if cur.Type == lexer.Newline {
			p.advance()
			continue
		}

		// Preserve non-cell inline content (text, char markers, etc.)
		if child := p.parseInlineContent(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseCell() *usfm.Node {
	token := p.current()
	position := token.Position
	marker := token.Value
	p.advance()

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeCell,
		Marker:   marker,
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	// Consume cell content until next cell, row, or structure marker
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.Marker {
			if grammar.IsCellMarker(cur.Value) || cur.Value == "tr" ||
				grammar.IsParaMarker(cur.Value) || cur.Value == "c" || cur.Value == "id" {
				break
			}
		}
		if cur.Type == lexer.Newline {
			p.advance()
			break
		}

		if child := p.parseInlineContent(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseMilestone() *usfm.Node {
	token := p.current()
	position := token.Position
	marker := token.Value
	p.advance()

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeMilestone,
		Marker:   marker,
		Position: p.newPosition(position),
	})

	// Consume attributes if present
	if next := p.current(); next != nil && next.Type == lexer.Attribute {
		if next.Attributes != nil {
			node.Attributes = next.Attributes
		} else {
			node.Attributes = map[string]string{"default": next.Value}
		}
		p.advance()
	}

	// Skip trailing end marker if present (\marker*)
	if end := p.current(); end != nil && end.Type == lexer.EndMarker && end.Value == marker {
		p.advance()
	}

	return node
}

func (p *parser) parseFigure() *usfm.Node {
	position := p.current().Position
	p.advance() // skip \fig

	node := p.newNode(usfm.Node{
		Type:       usfm.NodeFigure,
		Marker:     "fig",
		Position:   p.newPosition(position),
		Attributes: map[string]string{},
	})

	// Consume text and attributes until \fig*, or until a structural marker
	// if it is unclosed (so a half-typed \fig doesn't swallow the book)
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.EndMarker && cur.Value == "fig" {
			p.advance()
			break
		}
		if cur.Type == lexer.Marker &&
			(grammar.IsParaMarker(cur.Value) || cur.Value == "c" || cur.Value == "id") {
			break
		}
		if cur.Type == lexer.Attribute {
			if cur.Attributes != nil {
				for k, v := range cur.Attributes {
					node.Attributes[k] = v
				}
			} else if cur.Value != "" {
				node.Attributes["default"] = cur.Value
			}
			p.advance()
			continue
		}
		if cur.Type == lexer.Text {
			// Figure description text stored as caption attribute
			if node.Attributes["caption"] == "" {
				node.Attributes["caption"] = jsstr.Trim(cur.Value)
			}
		}
		p.advance()
	}

	return node
}

func (p *parser) parseSidebar() *usfm.Node {
	position := p.current().Position
	p.advance() // skip \esb

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeSidebar,
		Marker:   "esb",
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	p.skipNewlines()

	// Consume until \esbe
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.Marker && cur.Value == "esbe" {
			p.advance()
			break
		}
		if child := p.parseTopLevel(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseHeaderOrMisc() *usfm.Node {
	token := p.current()
	position := token.Position
	marker := token.Value
	p.advance()

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeParagraph,
		Marker:   marker,
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	// Consume content on this line (text, char styles, attributes, etc.)
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.Newline {
			p.advance()
			break
		}
		// A new paragraph-level or structural marker ends this header line
		if cur.Type == lexer.Marker &&
			(grammar.IsParaMarker(cur.Value) || cur.Value == "c" || cur.Value == "id") {
			break
		}

		if child := p.parseInlineContent(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseUnknown() *usfm.Node {
	token := p.current()
	position := token.Position
	marker := token.Value
	p.advance()

	p.addError(usfm.CodeUnknownMarker, fmt.Sprintf("Unknown marker '\\%s'", marker), position)

	return p.newNode(usfm.Node{
		Type:     usfm.NodeUnknown,
		Marker:   marker,
		Position: p.newPosition(position),
	})
}

func (p *parser) parseInlineContent() *usfm.Node {
	cur := p.current()
	if cur == nil {
		return nil
	}

	switch cur.Type {
	case lexer.Text:
		return p.parseTextRun()

	case lexer.Newline:
		// Convert newlines in inline content to space text nodes
		p.advance()
		pos := cur.Position
		return p.newNode(usfm.Node{Type: usfm.NodeText, Text: " ", Position: p.newPosition(pos)})

	case lexer.Marker:
		marker := cur.Value
		if marker == "v" {
			return p.parseVerse()
		}

		cat := grammar.Category(marker)

		// \ref is classified as "internal" but behaves as a paired char-like
		// element in inline context (e.g. \ref John 1:1|JHN 1:1\ref*)
		if marker == "ref" {
			return p.parseRef()
		}

		// \fig is character-level in USFM 3, normally inside a paragraph
		if marker == "fig" {
			return p.parseFigure()
		}

		// Handle footnote/crossref char markers before general char markers,
		// since they have implicit closure semantics
		if cat == grammar.FootnoteChar || cat == grammar.CrossReferenceChar {
			return p.parseNoteChar()
		}
		if grammar.IsCharMarker(marker) {
			return p.parseChar()
		}
		if grammar.IsNoteMarker(marker) {
			return p.parseNote()
		}
		if grammar.IsMilestoneMarker(marker) {
			return p.parseMilestone()
		}

		// Handle attribute markers that appear inline (like \ca, \va, \vp)
		if cat == grammar.Attribute {
			return p.parseInlineAttribute()
		}

		// Unknown inline marker
		return p.parseUnknown()

	case lexer.EndMarker:
		p.addError(
			usfm.CodeUnexpectedEndMarker,
			fmt.Sprintf("Unexpected end marker '\\%s*' with no matching opening marker", cur.Value),
			cur.Position,
		)
		p.advance()
		return nil

	case lexer.OptBreak:
		p.advance()
		pos := cur.Position
		return p.newNode(usfm.Node{Type: usfm.NodeOptBreak, Position: p.newPosition(pos)})

	case lexer.Attribute:
		// Attribute token not consumed by a char/note-char node — skip but warn
		p.addError(usfm.CodeUnattachedAttribute, "Attribute data not attached to any marker", cur.Position)
		p.advance()
		return nil
	}

	p.advance()
	return nil
}

func (p *parser) parseNoteChar() *usfm.Node {
	token := p.current()
	position := token.Position
	marker := token.Value
	p.advance()

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeChar,
		Marker:   marker,
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	// Consume until end marker or next note-char or note end
	for p.pos < len(p.tokens) {
		cur := p.current()

		if cur.Type == lexer.EndMarker && cur.Value == marker {
			p.advance()
			break
		}
		// Implicitly closed by next footnotechar/crossreferencechar
		if cur.Type == lexer.Marker {
			cat := grammar.Category(cur.Value)
			if cat == grammar.FootnoteChar || cat == grammar.CrossReferenceChar ||
				grammar.IsNoteMarker(cur.Value) || grammar.IsParaMarker(cur.Value) {
				break
			}
		}
		if cur.Type == lexer.EndMarker {
			// End of parent note — don't consume
			break
		}

		// Capture attributes on the note-char node
		if cur.Type == lexer.Attribute {
			p.applyAttributes(node, cur)
			p.advance()
			continue
		}

		if child := p.parseInlineContent(); child != nil {
			p.stack = append(p.stack, child)
		}
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseInlineAttribute() *usfm.Node {
	token := p.current()
	position := token.Position
	marker := token.Value
	p.advance()

	node := p.newNode(usfm.Node{
		Type:     usfm.NodeChar,
		Marker:   marker,
		Position: p.newPosition(position),
	})
	base := len(p.stack)

	// Consume content until end marker
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.EndMarker && cur.Value == marker {
			p.advance()
			break
		}
		if cur.Type == lexer.Marker || cur.Type == lexer.Newline {
			break
		}

		if cur.Type == lexer.Text {
			pos := cur.Position
			p.stack = append(p.stack, p.newNode(usfm.Node{
				Type:     usfm.NodeText,
				Text:     cur.Value,
				Position: p.newPosition(pos),
			}))
		}
		p.advance()
	}

	node.Children = p.collect(base)
	return node
}

func (p *parser) parseTextRun() *usfm.Node {
	token := p.current()
	text := token.Value
	position := token.Position
	p.advance()

	// Merge consecutive text tokens
	for p.pos < len(p.tokens) && p.tokens[p.pos].Type == lexer.Text {
		text += p.tokens[p.pos].Value
		p.advance()
	}

	return p.newNode(usfm.Node{Type: usfm.NodeText, Text: text, Position: p.newPosition(position)})
}

func (p *parser) consumeTextLine() string {
	text := ""
	for p.pos < len(p.tokens) {
		cur := p.current()
		if cur.Type == lexer.Text {
			text += cur.Value
			p.advance()
		} else if cur.Type == lexer.Newline {
			p.advance()
			break
		} else {
			break
		}
	}
	return text
}

func (p *parser) current() *lexer.Token {
	if p.pos >= len(p.tokens) {
		return nil
	}
	return &p.tokens[p.pos]
}

func (p *parser) advance() {
	p.pos++
}

func (p *parser) skipNewlines() {
	for p.pos < len(p.tokens) && p.tokens[p.pos].Type == lexer.Newline {
		p.pos++
	}
}

// applyAttributes applies an Attribute token to a node. Handles both
// key-value attributes and positional (default) attributes using the
// grammar's default attribute names.
func (p *parser) applyAttributes(node *usfm.Node, token *lexer.Token) {
	if node.Attributes == nil {
		node.Attributes = map[string]string{}
	}

	if len(token.Attributes) > 0 {
		for k, v := range token.Attributes {
			node.Attributes[k] = v
		}
	} else if token.Value != "" {
		if defaultKey, ok := grammar.DefaultAttribute(node.Marker); ok {
			node.Attributes[defaultKey] = token.Value
		} else {
			node.Attributes["default"] = token.Value
		}
	}
}

func (p *parser) addError(code, message string, position usfm.Position) {
	p.errors = append(p.errors, usfm.ParseError{Message: message, Position: p.newPosition(position), Code: code})
	if p.strict {
		panic(abort{fmt.Errorf("parse error at %d:%d: %s", position.Line, position.Column, message)})
	}
}
