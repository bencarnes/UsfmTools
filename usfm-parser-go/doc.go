// Package usfm is a parser and editing engine for USFM (Unified Standard
// Format Markers) scripture text.
//
// The module is organized as:
//
//   - the root package (this one): shared types used across the module
//   - grammar: marker categories, nesting groups, default attributes
//   - further subpackages (lexer, parser, engine): added as the port from
//     packages/usfm-parser progresses
//   - cmd/usfm: standalone CLI tool
//
// It is consumed as a library by the bible-edit Wails app and usable as a
// standalone CLI.
package usfm
