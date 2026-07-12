package lexer

import (
	"strings"
	"testing"

	usfm "github.com/usfm-tools/usfm-parser-go"
)

// Ported from packages/usfm-parser/tests/lexer.test.ts, plus Go-specific
// position tests at the bottom (the TS lexer has no byte/UTF-16 distinction).

func markerValues(tokens []Token) []string {
	var out []string
	for _, t := range tokens {
		if t.Type == Marker {
			out = append(out, t.Value)
		}
	}
	return out
}

func findToken(tokens []Token, typ TokenType) *Token {
	for i := range tokens {
		if tokens[i].Type == typ {
			return &tokens[i]
		}
	}
	return nil
}

func joinedText(tokens []Token) string {
	var b strings.Builder
	for _, t := range tokens {
		if t.Type == Text {
			b.WriteString(t.Value)
		}
	}
	return b.String()
}

func TestSimpleMarker(t *testing.T) {
	tokens := Tokenize(`\id GEN`)
	if len(tokens) != 2 {
		t.Fatalf("got %d tokens, want 2: %+v", len(tokens), tokens)
	}
	if tokens[0].Type != Marker || tokens[0].Value != "id" || tokens[0].IsNested || tokens[0].IsEnd {
		t.Errorf("token 0 = %+v, want marker \"id\"", tokens[0])
	}
	if tokens[1].Type != Text || tokens[1].Value != " GEN" {
		t.Errorf("token 1 = %+v, want text \" GEN\"", tokens[1])
	}
}

func TestTextBetweenMarkers(t *testing.T) {
	tokens := Tokenize(`\p Some text here`)
	if len(tokens) != 2 {
		t.Fatalf("got %d tokens, want 2: %+v", len(tokens), tokens)
	}
	if tokens[0].Type != Marker || tokens[0].Value != "p" {
		t.Errorf("token 0 = %+v, want marker \"p\"", tokens[0])
	}
	if tokens[1].Type != Text || tokens[1].Value != " Some text here" {
		t.Errorf("token 1 = %+v, want text \" Some text here\"", tokens[1])
	}
}

func TestNestedMarkers(t *testing.T) {
	tokens := Tokenize(`\+nd Lord\+nd*`)
	if tokens[0].Type != Marker || tokens[0].Value != "nd" || !tokens[0].IsNested || tokens[0].IsEnd {
		t.Errorf("token 0 = %+v, want nested marker \"nd\"", tokens[0])
	}
	if tokens[1].Type != Text || tokens[1].Value != " Lord" {
		t.Errorf("token 1 = %+v, want text \" Lord\"", tokens[1])
	}
	if tokens[2].Type != EndMarker || tokens[2].Value != "nd" || !tokens[2].IsNested || !tokens[2].IsEnd {
		t.Errorf("token 2 = %+v, want nested end marker \"nd\"", tokens[2])
	}
}

func TestEndMarkers(t *testing.T) {
	tokens := Tokenize(`\bk Genesis\bk*`)
	if tokens[0].Type != Marker || tokens[0].Value != "bk" || tokens[0].IsEnd {
		t.Errorf("token 0 = %+v, want marker \"bk\"", tokens[0])
	}
	if tokens[1].Type != Text || tokens[1].Value != " Genesis" {
		t.Errorf("token 1 = %+v, want text \" Genesis\"", tokens[1])
	}
	if tokens[2].Type != EndMarker || tokens[2].Value != "bk" || !tokens[2].IsEnd {
		t.Errorf("token 2 = %+v, want end marker \"bk\"", tokens[2])
	}
}

func TestNewlines(t *testing.T) {
	tokens := Tokenize("\\p Text\n\\v 1 Verse")
	if len(tokens) != 5 {
		t.Fatalf("got %d tokens, want 5: %+v", len(tokens), tokens)
	}
	if tokens[2].Type != Newline || tokens[2].Value != "\n" {
		t.Errorf("token 2 = %+v, want newline", tokens[2])
	}
}

func TestCRLFLineEndings(t *testing.T) {
	tokens := Tokenize("\\p Text\r\n\\v 1")
	if findToken(tokens, Newline) == nil {
		t.Errorf("no newline token in %+v", tokens)
	}
}

func TestEscapedBackslash(t *testing.T) {
	tokens := Tokenize(`\p text \\ more`)
	if got := joinedText(tokens); !strings.Contains(got, `\`) {
		t.Errorf("joined text %q does not contain a backslash", got)
	}
}

func TestEscapedPipe(t *testing.T) {
	tokens := Tokenize(`\p text \| more`)
	if got := joinedText(tokens); !strings.Contains(got, "|") {
		t.Errorf("joined text %q does not contain a pipe", got)
	}
}

func TestKeyValueAttributes(t *testing.T) {
	tokens := Tokenize(`\w grace|lemma="grace" strong="G5485"\w*`)
	attr := findToken(tokens, Attribute)
	if attr == nil {
		t.Fatalf("no attribute token in %+v", tokens)
	}
	if len(attr.Attributes) != 2 || attr.Attributes["lemma"] != "grace" || attr.Attributes["strong"] != "G5485" {
		t.Errorf("attributes = %v, want lemma=grace strong=G5485", attr.Attributes)
	}
}

func TestDefaultAttributeText(t *testing.T) {
	tokens := Tokenize(`\w grace|grace\w*`)
	attr := findToken(tokens, Attribute)
	if attr == nil {
		t.Fatalf("no attribute token in %+v", tokens)
	}
	if attr.Value != "grace" {
		t.Errorf("attribute value = %q, want \"grace\"", attr.Value)
	}
}

func TestOptBreak(t *testing.T) {
	tokens := Tokenize(`\p text // more text`)
	ob := findToken(tokens, OptBreak)
	if ob == nil {
		t.Fatalf("no optbreak token in %+v", tokens)
	}
	if ob.Value != "//" {
		t.Errorf("optbreak value = %q, want \"//\"", ob.Value)
	}
}

func TestSingleSlashIsNotOptBreak(t *testing.T) {
	tokens := Tokenize(`\p text / more text`)
	if ob := findToken(tokens, OptBreak); ob != nil {
		t.Errorf("unexpected optbreak token: %+v", ob)
	}
}

func TestPositionTracking(t *testing.T) {
	tokens := Tokenize("\\id GEN\n\\c 1")
	want := usfm.Position{Line: 0, Column: 0, Offset: 0, Byte: 0}
	if tokens[0].Position != want {
		t.Errorf("token 0 position = %+v, want %+v", tokens[0].Position, want)
	}
	var cToken *Token
	for i := range tokens {
		if tokens[i].Type == Marker && tokens[i].Value == "c" {
			cToken = &tokens[i]
		}
	}
	if cToken == nil {
		t.Fatalf("no \\c marker token in %+v", tokens)
	}
	if cToken.Position.Line != 1 {
		t.Errorf("\\c marker line = %d, want 1", cToken.Position.Line)
	}
}

func TestFullVerseWithFootnote(t *testing.T) {
	tokens := Tokenize(`\v 1 In the beginning\f + \fr 1:1 \ft Some note\f* God created`)
	var markers []string
	for _, tok := range tokens {
		switch tok.Type {
		case Marker:
			markers = append(markers, tok.Value)
		case EndMarker:
			markers = append(markers, tok.Value+"*")
		}
	}
	for _, want := range []string{"v", "f", "fr", "ft", "f*"} {
		found := false
		for _, m := range markers {
			if m == want {
				found = true
			}
		}
		if !found {
			t.Errorf("markers %v missing %q", markers, want)
		}
	}
}

func TestConsecutiveMarkers(t *testing.T) {
	tokens := Tokenize("\\c 1\n\\s Section Title\n\\p\n\\v 1 Text")
	got := markerValues(tokens)
	want := []string{"c", "s", "p", "v"}
	if len(got) != len(want) {
		t.Fatalf("markers = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("markers = %v, want %v", got, want)
		}
	}
}

// Go-specific: byte vs UTF-16 offsets for non-ASCII text.

func TestUTF16Positions(t *testing.T) {
	// "¡Hola" — '¡' is 2 bytes in UTF-8 but 1 UTF-16 code unit.
	tokens := Tokenize("\\p ¡Hola\n\\v 1 𝕊") // '𝕊' is 4 bytes, 2 UTF-16 units
	if len(tokens) != 5 {
		t.Fatalf("got %d tokens, want 5: %+v", len(tokens), tokens)
	}
	newline := tokens[2]
	// Text " ¡Hola" is 6 UTF-16 units / 7 bytes; marker \p is 2 more.
	if want := (usfm.Position{Line: 0, Column: 8, Offset: 8, Byte: 9}); newline.Position != want {
		t.Errorf("newline position = %+v, want %+v", newline.Position, want)
	}
	v := tokens[3]
	if want := (usfm.Position{Line: 1, Column: 0, Offset: 9, Byte: 10}); v.Position != want {
		t.Errorf("\\v position = %+v, want %+v", v.Position, want)
	}
}

func TestSupplementaryPlaneColumn(t *testing.T) {
	// After '𝕊' (2 UTF-16 units), the marker column must advance by 2.
	tokens := Tokenize(`\p 𝕊\nd x\nd*`)
	nd := findToken(tokens, Marker)
	for i := range tokens {
		if tokens[i].Type == Marker && tokens[i].Value == "nd" {
			nd = &tokens[i]
		}
	}
	if nd == nil || nd.Value != "nd" {
		t.Fatalf("no \\nd marker in %+v", tokens)
	}
	// `\p 𝕊` is 3 ASCII chars + 2 units for 𝕊 = column 5 (bytes: 3 + 4 = 7).
	if want := (usfm.Position{Line: 0, Column: 5, Offset: 5, Byte: 7}); nd.Position != want {
		t.Errorf("\\nd position = %+v, want %+v", nd.Position, want)
	}
}

func TestBareBackslashAtEOF(t *testing.T) {
	tokens := Tokenize(`\p text \`)
	if got := joinedText(tokens); !strings.HasSuffix(got, `\`) {
		t.Errorf("joined text %q should end with the bare backslash", got)
	}
}

func TestEscapedQuoteInAttributeValue(t *testing.T) {
	tokens := Tokenize(`\w x|key="a\"b"\w*`)
	attr := findToken(tokens, Attribute)
	if attr == nil {
		t.Fatalf("no attribute token in %+v", tokens)
	}
	if attr.Attributes["key"] != `a"b` {
		t.Errorf("key = %q, want %q", attr.Attributes["key"], `a"b`)
	}
}
