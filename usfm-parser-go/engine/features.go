package engine

import (
	"strings"
	"unicode/utf8"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/internal/jsstr"
	"github.com/usfm-tools/usfm-parser-go/lexer"
	"github.com/usfm-tools/usfm-parser-go/preview"
)

// This file implements the engine's feature requests, tailored to USFM
// editing (no go-to-definition and friends): pull diagnostics, semantic
// token classification for the viewport, marker/book-code completions, and
// the chapter structure used by the outline and preview. Classification and
// completions are ports of usfm-controls/src/language-service/classifier.ts
// and completions.ts.

// TokenKind classifies a source span for syntax highlighting. Values match
// the TS language-service TokenType enum (protocol.ts).
type TokenKind string

const (
	KindMarker         TokenKind = "marker"
	KindEndMarker      TokenKind = "endMarker"
	KindAttribute      TokenKind = "attribute"
	KindAttributeValue TokenKind = "attributeValue"
	KindVerseNumber    TokenKind = "verseNumber"
	KindChapterNumber  TokenKind = "chapterNumber"
)

// ClassifiedToken is one highlighted span.
type ClassifiedToken struct {
	Range usfm.Range `json:"range"`
	Type  TokenKind  `json:"type"`
}

// CompletionItem mirrors the TS language-service CompletionItem.
type CompletionItem struct {
	Label      string `json:"label"`
	Detail     string `json:"detail,omitempty"`
	InsertText string `json:"insertText"`
}

// ChapterInfo is one \c marker in a book.
type ChapterInfo struct {
	Number   string        `json:"number"`
	Position usfm.Position `json:"position"`
}

// BookInfo is the outline of one \id book: where it starts and its chapters
// in document order. It serves the chapter navigator and preview scroll
// sync (replaces usfm-model's firstBookFromUsfm + listChapterMarkersInBook).
type BookInfo struct {
	Code        string        `json:"code"`
	Description string        `json:"description,omitempty"`
	Position    usfm.Position `json:"position"`
	Chapters    []ChapterInfo `json:"chapters"`
}

// Diagnostics returns the problems for a document from its most recent
// analysis, along with the analyzed version (which may lag the document
// version briefly while re-analysis is in flight; a push via OnAnalysis
// follows). Push and pull can be mixed freely.
func (e *Engine) Diagnostics(id string) ([]usfm.Diagnostic, int, error) {
	a, err := e.analysisFor(id)
	if err != nil {
		return nil, 0, err
	}
	return a.Diagnostics, a.Version, nil
}

// Structure returns the book/chapter outline for a document from its most
// recent analysis, along with the analyzed version.
func (e *Engine) Structure(id string) ([]BookInfo, int, error) {
	a, err := e.analysisFor(id)
	if err != nil {
		return nil, 0, err
	}
	books := []BookInfo{}
	for _, child := range a.Result.Document.Children {
		if child.Type != usfm.NodeBook || child.Position == nil {
			continue
		}
		book := BookInfo{
			Code:        child.Code,
			Description: child.Description,
			Position:    *child.Position,
			Chapters:    []ChapterInfo{},
		}
		for _, c := range child.Children {
			if c.Type == usfm.NodeChapter && c.Position != nil {
				book.Chapters = append(book.Chapters, ChapterInfo{Number: c.Number, Position: *c.Position})
			}
		}
		books = append(books, book)
	}
	return books, a.Version, nil
}

// analysisFor returns the latest analysis for a document, computing one
// synchronously only when none exists yet (i.e. immediately after Open,
// before the initial background analysis lands).
func (e *Engine) analysisFor(id string) (Analysis, error) {
	snap, err := e.store.Snapshot(id)
	if err != nil {
		return Analysis{}, err
	}
	if a, ok := e.LatestAnalysis(id); ok {
		return a, nil
	}
	a := e.analyze(snap)
	e.mu.Lock()
	if st := e.docs[id]; st != nil && (st.latest == nil || st.latest.Version < a.Version) {
		st.latest = &a
	}
	e.mu.Unlock()
	return a, nil
}

// RenderPreview renders the engine's current copy of a document as
// publication-style preview HTML (see the preview package), along with the
// rendered document version.
func (e *Engine) RenderPreview(id string, opts preview.Options) (string, int, error) {
	snap, err := e.store.Snapshot(id)
	if err != nil {
		return "", 0, err
	}
	return preview.Render(snap.Text, opts), snap.Version, nil
}

// Classify classifies the whole document for syntax highlighting.
func (e *Engine) Classify(id string) ([]ClassifiedToken, int, error) {
	snap, err := e.store.Snapshot(id)
	if err != nil {
		return nil, 0, err
	}
	return classifyContent(snap.Text), snap.Version, nil
}

// ClassifyRange classifies the slice between the UTF-16 offsets from and to
// (e.g. the editor viewport). The slice is widened to the start of the line
// containing from, so verse/chapter numbers on that line stay correct.
func (e *Engine) ClassifyRange(id string, from, to int) ([]ClassifiedToken, int, error) {
	snap, err := e.store.Snapshot(id)
	if err != nil {
		return nil, 0, err
	}
	return classifyRange(snap.Text, from, to), snap.Version, nil
}

// classifyRange is the port of classifyTokensInRange: classify the slice
// from the line boundary before from, then rebase positions into document
// coordinates.
func classifyRange(content string, from, to int) []ClassifiedToken {
	if from < 0 {
		from = 0
	}
	if to < from {
		to = from
	}

	// One forward walk resolves the UTF-16 offsets to bytes and finds the
	// start of the line containing from.
	base := usfm.Position{} // line start before from
	byteOff, off16, line := 0, 0, 0
	for byteOff < len(content) && off16 < from {
		r, size := utf8.DecodeRuneInString(content[byteOff:])
		byteOff += size
		off16 += jsstr.RuneLen16(r)
		if r == '\n' {
			line++
			base = usfm.Position{Line: line, Offset: off16, Byte: byteOff}
		}
	}
	toByte := byteOff
	for toByte < len(content) && off16 < to {
		r, size := utf8.DecodeRuneInString(content[toByte:])
		toByte += size
		off16 += jsstr.RuneLen16(r)
	}
	if base.Byte >= toByte {
		return []ClassifiedToken{}
	}

	tokens := classifyContent(content[base.Byte:toByte])
	for i := range tokens {
		rebase(&tokens[i].Range.Start, base)
		rebase(&tokens[i].Range.End, base)
	}
	return tokens
}

// rebase shifts a slice-relative position into document coordinates. The
// slice starts at a line boundary, so columns carry over unchanged.
func rebase(p *usfm.Position, base usfm.Position) {
	p.Line += base.Line
	p.Offset += base.Offset
	p.Byte += base.Byte
}

// classifyContent is the port of classifyTokens: lex the content and emit
// one highlight span per interesting token. All spans are single-line.
func classifyContent(content string) []ClassifiedToken {
	tokens := lexer.Tokenize(content)
	out := []ClassifiedToken{}

	for i, token := range tokens {
		var kind TokenKind
		var length int // UTF-16 code units

		switch token.Type {
		case lexer.Marker:
			kind = KindMarker
			length = 1 + len(token.Value) // backslash + name (ASCII)
			if token.IsNested {
				length++
			}
		case lexer.EndMarker:
			kind = KindEndMarker
			length = 1 + len(token.Value) + 1 // backslash + name + '*'
			if token.IsNested {
				length++
			}
		case lexer.Attribute:
			if token.Attributes != nil {
				kind = KindAttribute
			} else {
				kind = KindAttributeValue
			}
			length = jsstr.Len16(token.Value)
			if length == 0 {
				length = 1
			}
		case lexer.Text:
			// Verse/chapter numbers: the first field of the text right
			// after a \v or \c marker
			if i == 0 || tokens[i-1].Type != lexer.Marker {
				continue
			}
			var numKind TokenKind
			switch tokens[i-1].Value {
			case "v":
				numKind = KindVerseNumber
			case "c":
				numKind = KindChapterNumber
			default:
				continue
			}
			trimmed := jsstr.TrimStart(token.Value)
			if trimmed == "" {
				continue
			}
			num, _ := jsstr.SplitFirstField(trimmed)
			leading16 := jsstr.Len16(token.Value) - jsstr.Len16(trimmed)
			leadingBytes := len(token.Value) - len(trimmed)
			start := token.Position
			start.Column += leading16
			start.Offset += leading16
			start.Byte += leadingBytes
			out = append(out, ClassifiedToken{
				Range: usfm.Range{Start: start, End: spanEnd(content, start, jsstr.Len16(num))},
				Type:  numKind,
			})
			continue
		default:
			continue
		}

		out = append(out, ClassifiedToken{
			Range: usfm.Range{Start: token.Position, End: spanEnd(content, token.Position, length)},
			Type:  kind,
		})
	}

	return out
}

// spanEnd is the end position of a single-line span of len16 UTF-16 code
// units. Column and Offset are plain arithmetic (matching the TS
// classifier's column math); Byte comes from walking the source.
func spanEnd(content string, start usfm.Position, len16 int) usfm.Position {
	byteOff, units := start.Byte, 0
	for byteOff < len(content) && units < len16 {
		r, size := utf8.DecodeRuneInString(content[byteOff:])
		byteOff += size
		units += jsstr.RuneLen16(r)
	}
	return usfm.Position{
		Line:   start.Line,
		Column: start.Column + len16,
		Offset: start.Offset + len16,
		Byte:   byteOff,
	}
}

// Completions returns completion items for the given cursor position
// (0-based line, UTF-16 column): USFM markers while typing "\..." and book
// codes while typing the argument of \id.
func (e *Engine) Completions(id string, line, column int) ([]CompletionItem, error) {
	snap, err := e.store.Snapshot(id)
	if err != nil {
		return nil, err
	}
	return completionsAt(snap.Text, line, column), nil
}

func completionsAt(content string, line, column int) []CompletionItem {
	lines := strings.Split(content, "\n")
	if line < 0 || line >= len(lines) {
		return []CompletionItem{}
	}
	before := prefix16(lines[line], column)

	if partial, ok := markerPrefix(before); ok {
		items := []CompletionItem{}
		for _, m := range markerCompletions {
			if strings.HasPrefix(m.Label, partial) {
				items = append(items, m)
			}
		}
		return items
	}
	if partial, ok := bookCodePrefix(before); ok {
		items := []CompletionItem{}
		for _, b := range bookCodeCompletions {
			if strings.HasPrefix(b.Label, strings.ToUpper(partial)) {
				items = append(items, b)
			}
		}
		return items
	}
	return []CompletionItem{}
}

// prefix16 returns the prefix of s that is column UTF-16 code units long
// (clamped to the string).
func prefix16(s string, column int) string {
	byteOff, off16 := 0, 0
	for byteOff < len(s) && off16 < column {
		r, size := utf8.DecodeRuneInString(s[byteOff:])
		byteOff += size
		off16 += jsstr.RuneLen16(r)
	}
	return s[:byteOff]
}

// markerPrefix mirrors the TS /\\(\+?[a-zA-Z0-9-]*)$/ check: the partial
// marker being typed at the end of the text, including the backslash.
func markerPrefix(before string) (string, bool) {
	i := len(before)
	for i > 0 {
		c := before[i-1]
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' {
			i--
			continue
		}
		break
	}
	if i > 0 && before[i-1] == '+' {
		i--
	}
	if i > 0 && before[i-1] == '\\' {
		return before[i-1:], true
	}
	return "", false
}

// bookCodePrefix reports the partial book code when the cursor is in the
// argument of \id (e.g. `\id G`); a Go-side addition beyond completions.ts.
func bookCodePrefix(before string) (string, bool) {
	trimmed := jsstr.TrimStart(before)
	if !strings.HasPrefix(trimmed, "\\id") {
		return "", false
	}
	rest := trimmed[len("\\id"):]
	if rest == "" || jsstr.TrimStart(rest) == rest {
		return "", false // no whitespace after \id yet
	}
	partial := jsstr.TrimStart(rest)
	if strings.ContainsFunc(partial, jsstr.IsSpace) {
		return "", false // code already complete, cursor is in the description
	}
	return partial, true
}
