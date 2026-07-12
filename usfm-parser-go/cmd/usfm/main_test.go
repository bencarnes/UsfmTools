package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	usfm "github.com/usfm-tools/usfm-parser-go"
)

const goodUsfm = "\\id GEN\n\\c 1\n\\p\n\\v 1 In the beginning\n"
const badUsfm = "\\id GEN\n\\zzz what is this\n"

// runCLI invokes run with captured output.
func runCLI(t *testing.T, args []string, stdin string) (exit int, stdout, stderr string) {
	t.Helper()
	var out, errBuf strings.Builder
	exit = run(args, strings.NewReader(stdin), &out, &errBuf)
	return exit, out.String(), errBuf.String()
}

func writeFile(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestNoArgsShowsUsage(t *testing.T) {
	exit, _, stderr := runCLI(t, nil, "")
	if exit != 2 {
		t.Errorf("exit = %d, want 2", exit)
	}
	if !strings.Contains(stderr, "Usage:") {
		t.Errorf("stderr missing usage: %q", stderr)
	}
}

func TestUnknownCommand(t *testing.T) {
	exit, _, stderr := runCLI(t, []string{"frobnicate"}, "")
	if exit != 2 {
		t.Errorf("exit = %d, want 2", exit)
	}
	if !strings.Contains(stderr, `unknown command "frobnicate"`) {
		t.Errorf("stderr = %q", stderr)
	}
}

func TestHelp(t *testing.T) {
	exit, stdout, _ := runCLI(t, []string{"help"}, "")
	if exit != 0 {
		t.Errorf("exit = %d, want 0", exit)
	}
	if !strings.Contains(stdout, "Usage:") {
		t.Errorf("stdout missing usage: %q", stdout)
	}
}

func TestCheckCleanFile(t *testing.T) {
	path := writeFile(t, t.TempDir(), "gen.usfm", goodUsfm)
	exit, stdout, stderr := runCLI(t, []string{"check", path}, "")
	if exit != 0 {
		t.Errorf("exit = %d, want 0; stderr: %s", exit, stderr)
	}
	if stdout != "" {
		t.Errorf("stdout = %q, want empty", stdout)
	}
	if stderr != "" {
		t.Errorf("stderr = %q, want empty", stderr)
	}
}

func TestCheckFileWithErrors(t *testing.T) {
	path := writeFile(t, t.TempDir(), "bad.usfm", badUsfm)
	exit, stdout, stderr := runCLI(t, []string{"check", path}, "")
	if exit != 1 {
		t.Errorf("exit = %d, want 1", exit)
	}
	// \zzz is at line 1 (0-based), column 0 → printed as 2:1.
	want := path + `:2:1: error: Unknown marker '\zzz' [unknown-marker]`
	if !strings.Contains(stdout, want) {
		t.Errorf("stdout = %q, want it to contain %q", stdout, want)
	}
	if !strings.Contains(stderr, "1 problem(s) in 1 of 1 file(s)") {
		t.Errorf("stderr = %q", stderr)
	}
}

func TestCheckDirectoryWalksUsfmFilesOnly(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "good.usfm", goodUsfm)
	writeFile(t, dir, "bad.usfm", badUsfm)
	// Same bad content in a non-.usfm file must be ignored.
	writeFile(t, dir, "notes.txt", badUsfm)
	sub := filepath.Join(dir, "sub")
	if err := os.Mkdir(sub, 0o755); err != nil {
		t.Fatal(err)
	}
	writeFile(t, sub, "also-bad.USFM", badUsfm)

	exit, stdout, stderr := runCLI(t, []string{"check", dir}, "")
	if exit != 1 {
		t.Errorf("exit = %d, want 1", exit)
	}
	if strings.Contains(stdout, "notes.txt") {
		t.Errorf("stdout mentions non-usfm file: %q", stdout)
	}
	if !strings.Contains(stdout, filepath.Join(dir, "bad.usfm")) {
		t.Errorf("stdout missing bad.usfm: %q", stdout)
	}
	if !strings.Contains(stdout, filepath.Join(sub, "also-bad.USFM")) {
		t.Errorf("stdout missing sub/also-bad.USFM: %q", stdout)
	}
	if !strings.Contains(stderr, "2 problem(s) in 2 of 3 file(s)") {
		t.Errorf("stderr = %q", stderr)
	}
}

func TestCheckStdin(t *testing.T) {
	exit, stdout, _ := runCLI(t, []string{"check", "-"}, badUsfm)
	if exit != 1 {
		t.Errorf("exit = %d, want 1", exit)
	}
	if !strings.Contains(stdout, "<stdin>:2:1: error:") {
		t.Errorf("stdout = %q", stdout)
	}
}

func TestCheckMissingPath(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "nope.usfm")
	exit, _, stderr := runCLI(t, []string{"check", missing}, "")
	if exit != 2 {
		t.Errorf("exit = %d, want 2", exit)
	}
	if !strings.Contains(stderr, "usfm check:") {
		t.Errorf("stderr = %q", stderr)
	}
}

func TestCheckMissingPathDoesNotStopOtherPaths(t *testing.T) {
	dir := t.TempDir()
	bad := writeFile(t, dir, "bad.usfm", badUsfm)
	missing := filepath.Join(dir, "nope.usfm")
	exit, stdout, _ := runCLI(t, []string{"check", missing, bad}, "")
	// I/O failure wins over diagnostics for the exit code, but the good
	// path is still checked and reported.
	if exit != 2 {
		t.Errorf("exit = %d, want 2", exit)
	}
	if !strings.Contains(stdout, "bad.usfm:2:1:") {
		t.Errorf("stdout = %q", stdout)
	}
}

func TestParseOutputsJSON(t *testing.T) {
	path := writeFile(t, t.TempDir(), "gen.usfm", goodUsfm)
	exit, stdout, stderr := runCLI(t, []string{"parse", path}, "")
	if exit != 0 {
		t.Fatalf("exit = %d, want 0; stderr: %s", exit, stderr)
	}
	var result usfm.ParseResult
	if err := json.Unmarshal([]byte(stdout), &result); err != nil {
		t.Fatalf("output is not valid JSON: %v\n%s", err, stdout)
	}
	if result.Document == nil || result.Document.Type != usfm.NodeDocument {
		t.Errorf("unexpected document: %+v", result.Document)
	}
	if len(result.Errors) != 0 {
		t.Errorf("errors = %+v, want none", result.Errors)
	}
	if len(result.Document.Children) == 0 ||
		result.Document.Children[0].Type != usfm.NodeBook ||
		result.Document.Children[0].Code != "GEN" {
		t.Errorf("unexpected AST root children: %+v", result.Document.Children)
	}
}

func TestParseWithErrorsStillExitsZero(t *testing.T) {
	path := writeFile(t, t.TempDir(), "bad.usfm", badUsfm)
	exit, stdout, _ := runCLI(t, []string{"parse", path}, "")
	if exit != 0 {
		t.Errorf("exit = %d, want 0", exit)
	}
	var result usfm.ParseResult
	if err := json.Unmarshal([]byte(stdout), &result); err != nil {
		t.Fatalf("output is not valid JSON: %v", err)
	}
	if len(result.Errors) != 1 {
		t.Errorf("errors = %+v, want exactly one", result.Errors)
	}
}

func TestParseCompact(t *testing.T) {
	path := writeFile(t, t.TempDir(), "gen.usfm", goodUsfm)
	exit, stdout, _ := runCLI(t, []string{"parse", "-compact", path}, "")
	if exit != 0 {
		t.Fatalf("exit = %d, want 0", exit)
	}
	if n := strings.Count(strings.TrimRight(stdout, "\n"), "\n"); n != 0 {
		t.Errorf("compact output spans %d extra lines", n)
	}
}

func TestParseStdin(t *testing.T) {
	exit, stdout, _ := runCLI(t, []string{"parse", "-"}, goodUsfm)
	if exit != 0 {
		t.Fatalf("exit = %d, want 0", exit)
	}
	if !strings.Contains(stdout, `"type": "document"`) {
		t.Errorf("stdout = %q", stdout)
	}
}

func TestParseWrongArgCount(t *testing.T) {
	exit, _, stderr := runCLI(t, []string{"parse"}, "")
	if exit != 2 {
		t.Errorf("exit = %d, want 2", exit)
	}
	if !strings.Contains(stderr, "usage: usfm parse") {
		t.Errorf("stderr = %q", stderr)
	}
}
