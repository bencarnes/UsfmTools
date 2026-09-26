package usfm

// Position is a location in USFM source text.
//
// Offset and Column are measured in UTF-16 code units to match JavaScript
// string indexing (and therefore CodeMirror document positions), so values
// can cross the Wails bridge without conversion. Byte is the offset into the
// UTF-8 source for slicing on the Go side. The TS parser's Position
// (types.ts) has line/column/offset only; Byte is the Go-side addition.
type Position struct {
	// Line is the 0-based line number.
	Line int `json:"line"`
	// Column is the 0-based column within the line, in UTF-16 code units.
	Column int `json:"column"`
	// Offset is the 0-based offset from the start of the source, in UTF-16
	// code units.
	Offset int `json:"offset"`
	// Byte is the 0-based byte offset into the UTF-8 source.
	Byte int `json:"byte"`
}
