// Command usfm is a standalone CLI for the USFM parser.
//
// Subcommands are added as the parser port progresses (see todo.md at the
// repository root); `check` (parse files and report diagnostics) is planned
// first.
package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "usfm: unknown command %q\n\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `usfm — USFM parser tools

Usage:
  usfm <command> [arguments]

Commands:
  help    show this help

More commands (check, parse) arrive as the parser port progresses.
`)
}
