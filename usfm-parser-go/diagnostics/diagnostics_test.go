package diagnostics

import (
	"testing"

	usfm "github.com/usfm-tools/usfm-parser-go"
)

// Behavior ported from usfm-controls/src/language-service/diagnostics.ts
// (covered there via tests/language-service.test.ts).

func TestValidUsfmHasNoDiagnostics(t *testing.T) {
	diags := Compute("\\id GEN\n\\c 1\n\\p\n\\v 1 In the beginning.")
	if diags == nil {
		t.Fatal("diagnostics = nil, want empty slice")
	}
	if len(diags) != 0 {
		t.Errorf("diagnostics = %+v, want none", diags)
	}
}

func TestUnknownMarkerDiagnostic(t *testing.T) {
	// \zzz sits at line 1, column 0; the line is longer than 10 columns
	diags := Compute("\\id GEN\n\\zzz more than ten characters")
	if len(diags) != 1 {
		t.Fatalf("diagnostics = %+v, want 1", diags)
	}
	d := diags[0]
	if d.Severity != usfm.SeverityError {
		t.Errorf("severity = %d, want %d", d.Severity, usfm.SeverityError)
	}
	if d.Code != usfm.CodeUnknownMarker {
		t.Errorf("code = %q, want %q", d.Code, usfm.CodeUnknownMarker)
	}
	if d.Message != `Unknown marker '\zzz'` {
		t.Errorf("message = %q", d.Message)
	}
	wantStart := usfm.Position{Line: 1, Column: 0, Offset: 8, Byte: 8}
	if d.Range.Start != wantStart {
		t.Errorf("start = %+v, want %+v", d.Range.Start, wantStart)
	}
	wantEnd := usfm.Position{Line: 1, Column: 10, Offset: 18, Byte: 18}
	if d.Range.End != wantEnd {
		t.Errorf("end = %+v, want %+v", d.Range.End, wantEnd)
	}
}

func TestRangeClampedToLineLength(t *testing.T) {
	// Line 1 is "\zzz abc" — 8 columns, so the end clamps to 8
	diags := Compute("\\id GEN\n\\zzz abc\n\\p text")
	if len(diags) != 1 {
		t.Fatalf("diagnostics = %+v, want 1", diags)
	}
	end := diags[0].Range.End
	want := usfm.Position{Line: 1, Column: 8, Offset: 16, Byte: 16}
	if end != want {
		t.Errorf("end = %+v, want %+v", end, want)
	}
}

func TestCRLFLineIncludesCarriageReturn(t *testing.T) {
	// Lines split on '\n' only, so line 1 is "\zzz abc\r" — 9 columns,
	// matching the TS content.split("\n") behavior
	diags := Compute("\\id GEN\r\n\\zzz abc\r\n\\p text")
	if len(diags) != 1 {
		t.Fatalf("diagnostics = %+v, want 1", diags)
	}
	end := diags[0].Range.End
	want := usfm.Position{Line: 1, Column: 9, Offset: 18, Byte: 18}
	if end != want {
		t.Errorf("end = %+v, want %+v", end, want)
	}
}

func TestUTF16Columns(t *testing.T) {
	// Line 1: "\zzz ¡Hola𝕊xyz" — "\zzz " (5 units) + "¡Hola" (5 units) puts
	// column 10 just before '𝕊'; '¡' is 2 bytes, so byte offsets diverge
	diags := Compute("\\id GEN\n\\zzz ¡Hola𝕊xyz")
	if len(diags) != 1 {
		t.Fatalf("diagnostics = %+v, want 1", diags)
	}
	end := diags[0].Range.End
	want := usfm.Position{Line: 1, Column: 10, Offset: 18, Byte: 19}
	if end != want {
		t.Errorf("end = %+v, want %+v", end, want)
	}
}

func TestUnexpectedEndMarkerCode(t *testing.T) {
	diags := Compute("\\id GEN\n\\nd*")
	if len(diags) != 1 {
		t.Fatalf("diagnostics = %+v, want 1", diags)
	}
	if diags[0].Code != usfm.CodeUnexpectedEndMarker {
		t.Errorf("code = %q, want %q", diags[0].Code, usfm.CodeUnexpectedEndMarker)
	}
}

func TestFromParseResultEdgeCases(t *testing.T) {
	content := "\\id GEN\n\\p 𝕊𝕊𝕊𝕊𝕊𝕊"
	result := usfm.ParseResult{
		Document: &usfm.Node{Type: usfm.NodeDocument},
		Errors: []usfm.ParseError{
			// No position: TS falls back to line 0, column 0
			{Message: "no position"},
			// Column+10 lands mid-surrogate-pair on line 1: Column/Offset
			// keep the exact code-unit value, Byte rounds up to the next
			// rune boundary
			{Message: "mid pair", Position: &usfm.Position{Line: 1, Column: 2, Offset: 10, Byte: 10}},
			// Line beyond the content: treated as an empty line
			{Message: "bad line", Position: &usfm.Position{Line: 99, Column: 5}},
		},
	}
	diags := FromParseResult(content, result)
	if len(diags) != 3 {
		t.Fatalf("diagnostics = %+v, want 3", diags)
	}

	if want := (usfm.Position{Line: 0, Column: 7, Offset: 7, Byte: 7}); diags[0].Range.End != want {
		t.Errorf("no-position end = %+v, want %+v", diags[0].Range.End, want)
	}

	// Line 1 is "\p 𝕊𝕊𝕊𝕊𝕊𝕊" (3 + 6×2 = 15 units); end column 12 falls inside
	// the fifth '𝕊' (units 11–12), whose bytes end at 3 + 5×4 = 23
	if want := (usfm.Position{Line: 1, Column: 12, Offset: 20, Byte: 8 + 23}); diags[1].Range.End != want {
		t.Errorf("mid-pair end = %+v, want %+v", diags[1].Range.End, want)
	}

	if want := (usfm.Position{Line: 99}); diags[2].Range.End != want {
		t.Errorf("bad-line end = %+v, want %+v", diags[2].Range.End, want)
	}
}
