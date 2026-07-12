// Package usfm is a parser and editing engine for USFM (Unified Standard
// Format Markers) scripture text.
//
// The module is organized as:
//
//   - the root package (this one): shared types (positions, AST nodes,
//     parse results)
//   - grammar: marker categories, nesting groups, default attributes
//   - lexer: tokenizer with byte + UTF-16 position tracking
//   - parser: error-tolerant USFM parser producing the AST
//   - diagnostics: converts parse errors to editor diagnostics with ranges
//   - preview: publication view model and preview HTML renderer
//   - engine: stateful LSP-like engine — document sync, async analysis with
//     versioned results, and feature requests (diagnostics, classification,
//     completions, structure, preview)
//   - cmd/usfm: standalone CLI tool
//
// It is consumed as a library by the bible-edit Wails app and usable as a
// standalone CLI.
package usfm
