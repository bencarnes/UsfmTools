package usfm

// Range is a span of source text between two positions.
type Range struct {
	Start Position `json:"start"`
	End   Position `json:"end"`
}

// DiagnosticSeverity mirrors the TS language-service enum
// (usfm-controls/src/language-service/protocol.ts) and LSP severity values.
type DiagnosticSeverity int

const (
	SeverityError   DiagnosticSeverity = 1
	SeverityWarning DiagnosticSeverity = 2
	SeverityInfo    DiagnosticSeverity = 3
	SeverityHint    DiagnosticSeverity = 4
)

// Diagnostic codes identify the kind of problem independently of the
// human-readable message. The TS parser has no codes; they are a Go-side
// addition so editor features can react to specific problems.
const (
	CodeUnknownMarker       = "unknown-marker"
	CodeUnexpectedEndMarker = "unexpected-end-marker"
	CodeUnattachedAttribute = "unattached-attribute"
)

// Diagnostic is an editor-facing problem report with a source range.
type Diagnostic struct {
	Range    Range              `json:"range"`
	Message  string             `json:"message"`
	Severity DiagnosticSeverity `json:"severity"`
	Code     string             `json:"code,omitempty"`
}
