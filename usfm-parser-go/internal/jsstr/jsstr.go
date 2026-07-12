// Package jsstr reproduces the JavaScript string semantics the TS parser
// relies on (Unicode whitespace incl. U+FEFF, UTF-16 code-unit lengths, the
// split(/\s+/) trailing-empty-field quirk), so ported code behaves
// identically to its TS counterpart.
package jsstr

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

// IsSpace matches JavaScript's \s / trim() whitespace: Unicode White_Space
// plus U+FEFF (which JS includes but Unicode does not).
func IsSpace(r rune) bool {
	return unicode.IsSpace(r) || r == '\uFEFF'
}

// TrimStart mirrors String.prototype.trimStart.
func TrimStart(s string) string {
	return strings.TrimLeftFunc(s, IsSpace)
}

// Trim mirrors String.prototype.trim.
func Trim(s string) string {
	return strings.TrimFunc(s, IsSpace)
}

// Fields mirrors str.split(/\s+/) on a string with no leading whitespace,
// including the empty final element JS produces for trailing whitespace —
// it is observable: rejoining note-caller fields keeps a trailing space.
func Fields(s string) []string {
	fields := strings.FieldsFunc(s, IsSpace)
	if last, _ := utf8.DecodeLastRuneInString(s); last != utf8.RuneError && IsSpace(last) {
		fields = append(fields, "")
	}
	return fields
}

// SplitFirstField mirrors /^(\S+)\s*(.*)/ on a string with no leading
// whitespace: the first whitespace-delimited field, and the rest with the
// separating whitespace removed.
func SplitFirstField(s string) (first, rest string) {
	end := len(s)
	for i, r := range s {
		if IsSpace(r) {
			end = i
			break
		}
	}
	return s[:end], TrimStart(s[end:])
}

// RuneLen16 is the UTF-16 code-unit width of a rune.
func RuneLen16(r rune) int {
	if r > 0xFFFF {
		return 2
	}
	return 1
}

// Len16 is the string's length in UTF-16 code units (JS str.length).
func Len16(s string) int {
	n := 0
	for _, r := range s {
		n += RuneLen16(r)
	}
	return n
}
