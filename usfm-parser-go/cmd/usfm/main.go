// Command usfm is a standalone CLI for the USFM parser.
//
// Usage:
//
//	usfm check [path ...]
//	usfm parse [-compact] <file>
//
// check parses each path — a .usfm file, a directory (walked recursively for
// .usfm files), or "-" for stdin — and prints diagnostics in compiler style
// (file:line:col: severity: message [code], 1-based lines and columns,
// columns in UTF-16 code units). It exits 1 if any error diagnostics were
// found, 2 on usage or I/O problems, 0 otherwise.
//
// parse parses one file (or "-" for stdin) and prints the parse result — the
// AST plus any errors — as JSON on stdout. It always exits 0 when parsing
// ran, even for input with errors (use check to gate on errors).
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/diagnostics"
	"github.com/usfm-tools/usfm-parser-go/parser"
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr))
}

func run(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		usage(stderr)
		return 2
	}
	switch args[0] {
	case "check":
		return runCheck(args[1:], stdin, stdout, stderr)
	case "parse":
		return runParse(args[1:], stdin, stdout, stderr)
	case "help", "-h", "--help":
		usage(stdout)
		return 0
	default:
		fmt.Fprintf(stderr, "usfm: unknown command %q\n\n", args[0])
		usage(stderr)
		return 2
	}
}

func usage(w io.Writer) {
	fmt.Fprint(w, `usfm — USFM parser tools

Usage:
  usfm <command> [arguments]

Commands:
  check [path ...]        parse USFM files and report diagnostics
                          (paths are .usfm files, directories walked
                          recursively for .usfm files, or "-" for stdin;
                          default "."); exit 1 if errors were found
  parse [-compact] <file> parse one file ("-" for stdin) and print the
                          AST and errors as JSON
  help                    show this help
`)
}

func runCheck(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	flags := flag.NewFlagSet("check", flag.ContinueOnError)
	flags.SetOutput(stderr)
	flags.Usage = func() { fmt.Fprintln(stderr, "usage: usfm check [path ...]") }
	if err := flags.Parse(args); err != nil {
		return 2
	}
	paths := flags.Args()
	if len(paths) == 0 {
		paths = []string{"."}
	}

	exit := 0
	problems := 0
	filesWithProblems := 0
	filesChecked := 0
	checkFile := func(name, content string) {
		filesChecked++
		diags := diagnostics.Compute(content)
		if len(diags) == 0 {
			return
		}
		filesWithProblems++
		for _, d := range diags {
			problems++
			fmt.Fprintf(stdout, "%s:%d:%d: %s: %s", name,
				d.Range.Start.Line+1, d.Range.Start.Column+1,
				severityLabel(d.Severity), d.Message)
			if d.Code != "" {
				fmt.Fprintf(stdout, " [%s]", d.Code)
			}
			fmt.Fprintln(stdout)
			if d.Severity == usfm.SeverityError && exit < 1 {
				exit = 1
			}
		}
	}
	fail := func(err error) {
		fmt.Fprintf(stderr, "usfm check: %v\n", err)
		exit = 2
	}

	for _, path := range paths {
		if path == "-" {
			data, err := io.ReadAll(stdin)
			if err != nil {
				fail(err)
				continue
			}
			checkFile("<stdin>", string(data))
			continue
		}
		info, err := os.Stat(path)
		if err != nil {
			fail(err)
			continue
		}
		if !info.IsDir() {
			data, err := os.ReadFile(path)
			if err != nil {
				fail(err)
				continue
			}
			checkFile(path, string(data))
			continue
		}
		err = filepath.WalkDir(path, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() || !strings.EqualFold(filepath.Ext(p), ".usfm") {
				return nil
			}
			data, err := os.ReadFile(p)
			if err != nil {
				return err
			}
			checkFile(p, string(data))
			return nil
		})
		if err != nil {
			fail(err)
		}
	}

	if problems > 0 {
		fmt.Fprintf(stderr, "usfm check: %d problem(s) in %d of %d file(s)\n",
			problems, filesWithProblems, filesChecked)
	}
	return exit
}

func severityLabel(s usfm.DiagnosticSeverity) string {
	switch s {
	case usfm.SeverityWarning:
		return "warning"
	case usfm.SeverityInfo:
		return "info"
	case usfm.SeverityHint:
		return "hint"
	default:
		return "error"
	}
}

func runParse(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	flags := flag.NewFlagSet("parse", flag.ContinueOnError)
	flags.SetOutput(stderr)
	compact := flags.Bool("compact", false, "print single-line JSON instead of indented")
	flags.Usage = func() {
		fmt.Fprintln(stderr, "usage: usfm parse [-compact] <file>")
		flags.PrintDefaults()
	}
	if err := flags.Parse(args); err != nil {
		return 2
	}
	if flags.NArg() != 1 {
		flags.Usage()
		return 2
	}

	path := flags.Arg(0)
	var data []byte
	var err error
	if path == "-" {
		data, err = io.ReadAll(stdin)
	} else {
		data, err = os.ReadFile(path)
	}
	if err != nil {
		fmt.Fprintf(stderr, "usfm parse: %v\n", err)
		return 2
	}

	result := parser.Parse(string(data))
	enc := json.NewEncoder(stdout)
	if !*compact {
		enc.SetIndent("", "  ")
	}
	if err := enc.Encode(result); err != nil {
		fmt.Fprintf(stderr, "usfm parse: %v\n", err)
		return 2
	}
	return 0
}
