// Package lexer tokenizes USFM source text into a stream of tokens.
//
// The lexer recognizes:
//   - markers: \marker, \+marker (nested), \marker* (end)
//   - text content between markers
//   - attributes: |key="value" or |default text
//   - optional breaks: //
//   - newlines
//
// Port of packages/usfm-parser/src/lexer.ts. It scans bytes (every character
// significant to USFM syntax is ASCII) while tracking rune-aware positions so
// non-ASCII text gets correct UTF-16 offsets. One intentional deviation: when
// the attribute reader rewinds after failing to match key="value", it
// restores the full position state, where the TS lexer only rewinds the
// scan index and approximates the column (positions of tokens after a
// default-attribute value could drift in TS).
package lexer

import (
	"strings"
	"unicode/utf8"

	usfm "github.com/usfm-tools/usfm-parser-go"
)

// TokenType identifies the kind of a token. The values match the TS
// TokenType enum (types.ts).
type TokenType string

const (
	Marker    TokenType = "marker"
	Text      TokenType = "text"
	Attribute TokenType = "attribute"
	OptBreak  TokenType = "optbreak"
	EndMarker TokenType = "end_marker"
	Newline   TokenType = "newline"
)

// Token is a single token from the lexer.
type Token struct {
	Type     TokenType     `json:"type"`
	Value    string        `json:"value"`
	Position usfm.Position `json:"position"`
	// IsNested reports whether this is a nested ('+' prefixed) marker.
	IsNested bool `json:"isNested,omitempty"`
	// IsEnd reports whether this is a closing marker (ends with '*').
	IsEnd bool `json:"isEnd,omitempty"`
	// Attributes holds parsed key="value" attributes if present.
	Attributes map[string]string `json:"attributes,omitempty"`
}

// Tokenize converts USFM source text into a token stream.
func Tokenize(source string) []Token {
	l := &lexer{src: source}
	for l.pos < len(l.src) {
		switch {
		case l.src[l.pos] == '\\':
			l.readMarker()
		case l.src[l.pos] == '|':
			l.readAttributes()
		case l.src[l.pos] == '/' && l.peek(1) == '/':
			l.readOptBreak()
		case l.src[l.pos] == '\n' || l.src[l.pos] == '\r':
			l.readNewline()
		default:
			l.readText()
		}
	}
	return l.tokens
}

type lexer struct {
	src    string
	pos    int // byte offset into src
	off16  int // UTF-16 code-unit offset
	line   int
	col    int // UTF-16 code-unit column
	tokens []Token
}

// position captures the current position (all counters, so it can also serve
// as a rewind snapshot).
func (l *lexer) position() usfm.Position {
	return usfm.Position{Line: l.line, Column: l.col, Offset: l.off16, Byte: l.pos}
}

func (l *lexer) rewind(p usfm.Position) {
	l.line, l.col, l.off16, l.pos = p.Line, p.Column, p.Offset, p.Byte
}

// peek returns the byte `ahead` bytes past the current position, or 0 at the
// end of input. Byte comparisons against ASCII are safe in UTF-8: continuation
// bytes are always >= 0x80.
func (l *lexer) peek(ahead int) byte {
	if l.pos+ahead >= len(l.src) {
		return 0
	}
	return l.src[l.pos+ahead]
}

func utf16Len(r rune) int {
	if r > 0xFFFF {
		return 2
	}
	return 1
}

// advance moves past one rune, updating line/column/offset counters.
func (l *lexer) advance() {
	if l.pos >= len(l.src) {
		return
	}
	r, size := utf8.DecodeRuneInString(l.src[l.pos:])
	if r == '\n' {
		l.line++
		l.col = 0
	} else {
		l.col += utf16Len(r)
	}
	l.pos += size
	l.off16 += utf16Len(r)
}

func isMarkerChar(b byte) bool {
	return b >= 'a' && b <= 'z' || b >= 'A' && b <= 'Z' ||
		b >= '0' && b <= '9' || b == '_' || b == '-'
}

func (l *lexer) readMarker() {
	position := l.position()
	l.advance() // skip backslash

	if l.pos >= len(l.src) {
		// Bare backslash at end of input — treat as text
		l.appendText("\\", position)
		return
	}

	// Check for escaped characters: \\, \|, \~, \newline
	switch b := l.src[l.pos]; b {
	case '\\', '|', '~':
		// Escaped special character — treat as text
		l.advance()
		l.appendText(string(b), position)
		return
	case '\n', '\r':
		// Escaped newline — treat as soft line break
		l.readNewline()
		return
	}

	isNested := false
	if l.src[l.pos] == '+' {
		isNested = true
		l.advance()
	}

	// Read marker name
	start := l.pos
	for l.pos < len(l.src) && isMarkerChar(l.src[l.pos]) {
		l.advance()
	}
	marker := l.src[start:l.pos]

	if marker == "" {
		// Backslash with no following marker name — treat as text
		l.appendText("\\", position)
		return
	}

	// Check for end marker
	isEnd := false
	if l.pos < len(l.src) && l.src[l.pos] == '*' {
		isEnd = true
		l.advance()
	}

	typ := Marker
	if isEnd {
		typ = EndMarker
	}
	l.tokens = append(l.tokens, Token{
		Type:     typ,
		Value:    marker,
		Position: position,
		IsNested: isNested,
		IsEnd:    isEnd,
	})
}

func (l *lexer) readAttributes() {
	position := l.position()
	l.advance() // skip pipe

	attributes := map[string]string{}
	defaultValue := ""

	l.skipSpaces()

	hasKeyValue := false
	for l.pos < len(l.src) {
		// Attempt key="value"
		keyStart := l.position()
		start := l.pos
		for l.pos < len(l.src) && isMarkerChar(l.src[l.pos]) {
			l.advance()
		}
		key := l.src[start:l.pos]

		l.skipSpaces()

		if key != "" && l.pos < len(l.src) && l.src[l.pos] == '=' {
			l.advance() // skip =
			l.skipSpaces()

			if l.pos < len(l.src) && l.src[l.pos] == '"' {
				l.advance() // skip opening quote
				var value strings.Builder
				for l.pos < len(l.src) && l.src[l.pos] != '"' {
					if l.src[l.pos] == '\\' && l.peek(1) == '"' {
						l.advance() // skip escaping backslash
					}
					_, size := utf8.DecodeRuneInString(l.src[l.pos:])
					value.WriteString(l.src[l.pos : l.pos+size])
					l.advance()
				}
				if l.pos < len(l.src) && l.src[l.pos] == '"' {
					l.advance() // skip closing quote
				}
				attributes[key] = value.String()
				hasKeyValue = true
				l.skipSpaces()
				continue
			}
		}

		// Not a key="value" pair — rewind and read as default attribute text,
		// unless key=value pairs were already found
		l.rewind(keyStart)
		if !hasKeyValue {
			defaultValue = l.readUntilMarkerEnd()
		}
		break
	}

	if hasKeyValue {
		l.tokens = append(l.tokens, Token{
			Type:       Attribute,
			Value:      "",
			Position:   position,
			Attributes: attributes,
		})
	} else if defaultValue != "" {
		l.tokens = append(l.tokens, Token{
			Type:     Attribute,
			Value:    defaultValue,
			Position: position,
		})
	}
}

func (l *lexer) readUntilMarkerEnd() string {
	start := l.pos
	for l.pos < len(l.src) {
		b := l.src[l.pos]
		if b == '\\' || b == '\n' || b == '\r' {
			break
		}
		l.advance()
	}
	return l.src[start:l.pos]
}

func (l *lexer) readOptBreak() {
	position := l.position()
	l.advance() // skip first /
	l.advance() // skip second /
	l.tokens = append(l.tokens, Token{
		Type:     OptBreak,
		Value:    "//",
		Position: position,
	})
}

func (l *lexer) readNewline() {
	position := l.position()
	if l.src[l.pos] == '\r' {
		l.advance()
	}
	if l.pos < len(l.src) && l.src[l.pos] == '\n' {
		l.advance()
	}
	l.tokens = append(l.tokens, Token{
		Type:     Newline,
		Value:    "\n",
		Position: position,
	})
}

func (l *lexer) readText() {
	position := l.position()
	start := l.pos

	for l.pos < len(l.src) {
		b := l.src[l.pos]
		if b == '\\' || b == '|' || b == '\n' || b == '\r' {
			break
		}
		if b == '/' && l.peek(1) == '/' {
			break
		}
		l.advance()
	}

	if l.pos > start {
		l.appendText(l.src[start:l.pos], position)
	}
}

// appendText adds a text token, merging with the previous token when it is
// also text (e.g. around escaped characters).
func (l *lexer) appendText(text string, position usfm.Position) {
	if n := len(l.tokens); n > 0 && l.tokens[n-1].Type == Text {
		l.tokens[n-1].Value += text
		return
	}
	l.tokens = append(l.tokens, Token{
		Type:     Text,
		Value:    text,
		Position: position,
	})
}

func (l *lexer) skipSpaces() {
	for l.pos < len(l.src) && (l.src[l.pos] == ' ' || l.src[l.pos] == '\t') {
		l.advance()
	}
}
