// Package diagnostics converts parse errors into editor-facing diagnostics
// with source ranges.
//
// Port of usfm-controls/src/language-service/diagnostics.ts: every parse
// error becomes an error-severity diagnostic whose range runs from the error
// position to 10 columns further, clamped to the end of the line (columns in
// UTF-16 code units; for CRLF files the line text includes the trailing
// '\r', as in the TS implementation). The Go version additionally carries
// the parser's diagnostic code.
package diagnostics

import (
	"strings"
	"unicode/utf8"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/parser"
)

// rangeLength is how far a diagnostic extends past the error position when
// the line is long enough (matches the TS implementation).
const rangeLength = 10

// Compute parses the content and returns diagnostics for its parse errors
// (the equivalent of the TS getDiagnostics). To reuse an existing parse, use
// FromParseResult.
func Compute(content string) []usfm.Diagnostic {
	return FromParseResult(content, parser.Parse(content))
}

// FromParseResult converts the parse errors in result to diagnostics.
// content must be the exact source text that produced result.
func FromParseResult(content string, result usfm.ParseResult) []usfm.Diagnostic {
	diags := make([]usfm.Diagnostic, 0, len(result.Errors))
	if len(result.Errors) == 0 {
		return diags
	}
	lines := indexLines(content)
	for _, e := range result.Errors {
		start := usfm.Position{}
		if e.Position != nil {
			start = *e.Position
		}
		diags = append(diags, usfm.Diagnostic{
			Range:    usfm.Range{Start: start, End: lines.endPosition(start)},
			Message:  e.Message,
			Severity: usfm.SeverityError,
			Code:     e.Code,
		})
	}
	return diags
}

// lineIndex records where each line starts, so column arithmetic can be
// translated back to absolute offsets.
type lineIndex struct {
	content string
	// starts holds one entry per line: the byte and UTF-16 offsets of the
	// line's first character. Lines are split on '\n' only.
	starts []lineStart
}

type lineStart struct {
	byte  int
	off16 int
}

func indexLines(content string) *lineIndex {
	idx := &lineIndex{content: content, starts: []lineStart{{0, 0}}}
	off16 := 0
	for i, size := 0, 0; i < len(content); i += size {
		var r rune
		r, size = utf8.DecodeRuneInString(content[i:])
		off16 += utf16Len(r)
		if r == '\n' {
			idx.starts = append(idx.starts, lineStart{i + size, off16})
		}
	}
	return idx
}

// endPosition computes the diagnostic end for an error at start: the column
// rangeLength further, clamped to the line's length in UTF-16 code units.
// Offset and Byte are derived from the resulting column so the range is
// directly usable for editor decorations.
func (idx *lineIndex) endPosition(start usfm.Position) usfm.Position {
	if start.Line < 0 || start.Line >= len(idx.starts) {
		// Out-of-range line: the TS code treats the line text as "" and
		// clamps the column to 0
		return usfm.Position{Line: start.Line}
	}
	ls := idx.starts[start.Line]
	lineText := idx.content[ls.byte:]
	if nl := strings.IndexByte(lineText, '\n'); nl >= 0 {
		lineText = lineText[:nl]
	}

	endCol := start.Column + rangeLength
	// Walk the line to find the byte/UTF-16 offsets of endCol, clamping to
	// the line length. If endCol lands inside a surrogate pair, Byte rounds
	// up to the next rune boundary while Column/Offset keep the exact
	// code-unit value (matching JS string indexing).
	col := 0
	byteOff := 0
	for byteOff < len(lineText) && col < endCol {
		r, size := utf8.DecodeRuneInString(lineText[byteOff:])
		col += utf16Len(r)
		byteOff += size
	}
	if col < endCol {
		endCol = col // clamped to line end
	}
	return usfm.Position{
		Line:   start.Line,
		Column: endCol,
		Offset: ls.off16 + endCol,
		Byte:   ls.byte + byteOff,
	}
}

func utf16Len(r rune) int {
	if r > 0xFFFF {
		return 2
	}
	return 1
}
