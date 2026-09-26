package grammar

import (
	"strings"
	"testing"
)

// Ported from packages/usfm-parser/tests/grammar.test.ts.

func TestCategory(t *testing.T) {
	tests := []struct {
		marker string
		want   MarkerCategory
	}{
		// header markers
		{"h", Header},
		{"toc1", Header},
		{"toc2", Header},
		{"ide", Header},
		// title markers
		{"mt1", Title},
		{"mt", Title},
		// paragraph markers
		{"p", VersePara},
		{"q1", VersePara},
		{"m", VersePara},
		{"pi1", VersePara},
		// section markers
		{"s1", SectionPara},
		{"s", SectionPara},
		{"r", SectionPara},
		{"mr", SectionPara},
		// character markers
		{"nd", Char},
		{"wj", Char},
		{"bk", Char},
		{"w", Char},
		// footnote markers
		{"f", Footnote},
		{"fe", Footnote},
		{"fr", FootnoteChar},
		{"ft", FootnoteChar},
		// cross-reference markers
		{"x", CrossReference},
		{"xo", CrossReferenceChar},
		{"xt", CrossReferenceChar},
		// cell markers
		{"th1", Cell},
		{"tc1", Cell},
		{"tcr1", Cell},
		// milestone markers
		{"qt-s", Milestone},
		{"qt-e", Milestone},
		{"ts-s", Milestone},
		// unrecognized markers
		{"zzz", Unknown},
		{"notamarker", Unknown},
	}
	for _, tt := range tests {
		if got := Category(tt.marker); got != tt.want {
			t.Errorf("Category(%q) = %q, want %q", tt.marker, got, tt.want)
		}
	}
}

func TestIsParaMarker(t *testing.T) {
	for _, marker := range []string{"p", "q1", "s1", "mt1", "h", "ip", "li1"} {
		if !IsParaMarker(marker) {
			t.Errorf("IsParaMarker(%q) = false, want true", marker)
		}
	}
	for _, marker := range []string{"nd", "f", "v", "c"} {
		if IsParaMarker(marker) {
			t.Errorf("IsParaMarker(%q) = true, want false", marker)
		}
	}
}

func TestIsCharMarker(t *testing.T) {
	for _, marker := range []string{"nd", "wj", "bk", "fr", "xt"} {
		if !IsCharMarker(marker) {
			t.Errorf("IsCharMarker(%q) = false, want true", marker)
		}
	}
	for _, marker := range []string{"p", "c", "v"} {
		if IsCharMarker(marker) {
			t.Errorf("IsCharMarker(%q) = true, want false", marker)
		}
	}
}

func TestIsNoteMarker(t *testing.T) {
	for _, marker := range []string{"f", "fe", "x", "ex"} {
		if !IsNoteMarker(marker) {
			t.Errorf("IsNoteMarker(%q) = false, want true", marker)
		}
	}
	for _, marker := range []string{"fr", "p"} {
		if IsNoteMarker(marker) {
			t.Errorf("IsNoteMarker(%q) = true, want false", marker)
		}
	}
}

func TestIsCellMarker(t *testing.T) {
	for _, marker := range []string{"th1", "tc1", "tc2", "tcr1"} {
		if !IsCellMarker(marker) {
			t.Errorf("IsCellMarker(%q) = false, want true", marker)
		}
	}
	for _, marker := range []string{"tr", "p"} {
		if IsCellMarker(marker) {
			t.Errorf("IsCellMarker(%q) = true, want false", marker)
		}
	}
}

func TestIsMilestoneMarker(t *testing.T) {
	for _, marker := range []string{"qt-s", "qt-e", "ts-s"} {
		if !IsMilestoneMarker(marker) {
			t.Errorf("IsMilestoneMarker(%q) = false, want true", marker)
		}
	}
	for _, marker := range []string{"p", "nd"} {
		if IsMilestoneMarker(marker) {
			t.Errorf("IsMilestoneMarker(%q) = true, want false", marker)
		}
	}
}

func TestDefaultAttribute(t *testing.T) {
	tests := []struct {
		marker string
		want   string
	}{
		{"w", "lemma"},
		{"jmp", "href"},
		{"rb", "gloss"},
		{"qt-s", "who"},
		{"fig", "alt"},
		{"ref", "loc"},
	}
	for _, tt := range tests {
		got, ok := DefaultAttribute(tt.marker)
		if !ok || got != tt.want {
			t.Errorf("DefaultAttribute(%q) = %q, %v; want %q, true", tt.marker, got, ok, tt.want)
		}
	}
	if got, ok := DefaultAttribute("p"); ok {
		t.Errorf("DefaultAttribute(\"p\") = %q, true; want ok=false", got)
	}
}

// TestNoMarkerInMultipleCategories guards the port: in the TS source the
// category table is an object keyed by marker, so a marker cannot belong to
// two categories; the Go table is keyed by category, which could silently
// let a duplicated marker's category depend on map iteration order.
func TestNoMarkerInMultipleCategories(t *testing.T) {
	seen := map[string]MarkerCategory{}
	for category, markers := range categoryDefinitions {
		for _, marker := range strings.Fields(markers) {
			if prev, dup := seen[marker]; dup && prev != category {
				t.Errorf("marker %q defined in both %q and %q", marker, prev, category)
			}
			seen[marker] = category
		}
	}
}
