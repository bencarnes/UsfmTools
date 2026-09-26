package usfm

// NodeType identifies the kind of an AST node. The values match the TS
// NodeType union (types.ts).
type NodeType string

const (
	NodeDocument  NodeType = "document"
	NodeBook      NodeType = "book"
	NodeChapter   NodeType = "chapter"
	NodeVerse     NodeType = "verse"
	NodeParagraph NodeType = "paragraph"
	NodeChar      NodeType = "char"
	NodeNote      NodeType = "note"
	NodeTable     NodeType = "table"
	NodeRow       NodeType = "row"
	NodeCell      NodeType = "cell"
	NodeMilestone NodeType = "milestone"
	NodeFigure    NodeType = "figure"
	NodeSidebar   NodeType = "sidebar"
	NodeOptBreak  NodeType = "optbreak"
	NodeText      NodeType = "text"
	NodeRef       NodeType = "ref"
	NodeUnknown   NodeType = "unknown"
)

// Node is a USFM AST node. The TS parser models this as an interface
// hierarchy (types.ts); here a single flat struct with a Type discriminator
// keeps traversal simple and serializes cleanly across the Wails bridge.
// Type-specific fields are zero-valued on nodes they don't apply to.
type Node struct {
	Type     NodeType  `json:"type"`
	Marker   string    `json:"marker,omitempty"`
	Position *Position `json:"position,omitempty"`
	// Attributes holds key="value" and positional (default) attributes for
	// char, ref, milestone, and figure nodes.
	Attributes map[string]string `json:"attributes,omitempty"`
	// Children is non-nil (possibly empty) exactly on parent node types
	// (document, book, chapter, paragraph, char, note, row, cell, sidebar,
	// ref); it is nil on leaf/milestone types (verse, milestone, figure,
	// optbreak, text, unknown).
	Children []*Node `json:"children,omitempty"`
	// Code is the book code (e.g. "GEN") on book nodes.
	Code string `json:"code,omitempty"`
	// Description is the optional text after the book code on book nodes.
	Description string `json:"description,omitempty"`
	// Number is the chapter or verse number (kept as source text, e.g. "1-2").
	Number string `json:"number,omitempty"`
	// Caller is the note caller (e.g. "+", "-", "a") on note nodes.
	Caller string `json:"caller,omitempty"`
	// Text is the content of text nodes.
	Text string `json:"text,omitempty"`
}

// ParseError is a parsing problem with optional position info. Code is one
// of the diagnostic code constants (diagnostic.go), identifying the kind of
// problem independently of the message text.
type ParseError struct {
	Message  string    `json:"message"`
	Position *Position `json:"position,omitempty"`
	Code     string    `json:"code,omitempty"`
}

// ParseResult is the outcome of parsing: the document tree plus any errors
// collected along the way (parsing is error-tolerant and always produces a
// document).
type ParseResult struct {
	Document *Node        `json:"document"`
	Errors   []ParseError `json:"errors"`
}
