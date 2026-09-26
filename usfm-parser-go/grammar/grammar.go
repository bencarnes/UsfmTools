// Package grammar defines the USFM marker grammar: the mapping of markers to
// their categories, category groupings (paragraph, character, note), and
// default attribute names.
//
// Port of packages/usfm-parser/src/grammar.ts; the marker lists are kept in
// the same category → space-separated-markers form so the two files stay easy
// to diff while the TS parser remains in the repo for reference.
package grammar

import "strings"

// MarkerCategory classifies a USFM marker.
type MarkerCategory string

const (
	Identification     MarkerCategory = "identification"
	Header             MarkerCategory = "header"
	Title              MarkerCategory = "title"
	Introduction       MarkerCategory = "introduction"
	IntroChar          MarkerCategory = "introchar"
	SectionPara        MarkerCategory = "sectionpara"
	VersePara          MarkerCategory = "versepara"
	Char               MarkerCategory = "char"
	Footnote           MarkerCategory = "footnote"
	FootnoteChar       MarkerCategory = "footnotechar"
	CrossReference     MarkerCategory = "crossreference"
	CrossReferenceChar MarkerCategory = "crossreferencechar"
	List               MarkerCategory = "list"
	ListChar           MarkerCategory = "listchar"
	Cell               MarkerCategory = "cell"
	Milestone          MarkerCategory = "milestone"
	Attribute          MarkerCategory = "attribute"
	OtherPara          MarkerCategory = "otherpara"
	Internal           MarkerCategory = "internal"
	Unknown            MarkerCategory = "unknown"
)

// categoryDefinitions lists the markers belonging to each category, derived
// from the USFM grammar spec.
var categoryDefinitions = map[MarkerCategory]string{
	Attribute: "cp vp usfm ca va cat vid",
	Header:    "ide h1 h2 h3 h toc1 toc2 toc3 toca1 toca2 toca3",
	Title:     "mt1 mt2 mt3 mt4 mt",
	Introduction: "imt1 imt2 imt3 imt4 imte1 imte2 imte imt ib ie iex ili1 ili2 ili " +
		"imi imq im io1 io2 io3 io4 iot io ipc ipi ipq ipr ip iq1 iq2 iq3 iq is1 is2 is ilit",
	IntroChar: "ior iqt",
	SectionPara: "restore ms1 ms2 ms3 ms mr mte1 mte2 mte r s1 s2 s3 s4 sr sp " +
		"sd1 sd2 sd3 sd4 sd s cl cd",
	VersePara: "cls nb pc pi1 pi2 pi3 pi po pr pmo pmc pmr pm ph1 ph2 ph3 ph p " +
		"q1 q2 q3 q4 qc qr qm1 qm2 qm3 qm qd q b d mi1 mi2 mi3 mi4 mi m",
	Char: "qac qs add addpn bk dc efm fm fv k nd ndx ord png pn pro qt rq sig sls tl " +
		"wg wh wa wj jmp no it bdit bd em sc sup w rb pl ta",
	Footnote:           "fe f efe ef",
	FootnoteChar:       "fr ft fk fqa fq fl fw fdc fp",
	CrossReference:     "ex x",
	CrossReferenceChar: "xt xop xo xta xk xq xot xnt xdc",
	List:               "lh li1 li2 li3 li4 lim1 lim2 lim3 lim4 lim li lf",
	ListChar:           "litl lik liv1 liv2 liv3 liv4 liv5 liv",
	Cell: "th1 th2 th3 th4 th5 th6 th7 th8 th9 th10 th11 th12 " +
		"tc1 tc2 tc3 tc4 tc5 tc6 tc7 tc8 tc9 tc10 tc11 tc12 " +
		"tcr1 tcr2 tcr3 tcr4 tcr5 tcr6 tcr7 tcr8 tcr9 " +
		"tcc1 tcc2 tcc3 tcc4 tcc5 tcc6 tcc7 tcc8 tcc9 tcc10 tcc11 tcc12 " +
		"thc1 thc2 thc3 thc4 thc5 thc6 thc7 thc8 thc9 thc10 thc11 tch12 " +
		"thr1 thr2 thr3 thr4 thr5 thr6 thr7 thr8 thr9 thr10 thr11 thr12",
	Milestone: "ts-s ts-e ts t-s t-e qt1-s qt1-e qt2-s qt2-e qt3-s qt3-e " +
		"qt4-s qt4-e qt5-s qt5-e qt-s qt-e wj-s wj-e",
	OtherPara: "sts lit pb p1 p2 qa k1 k2 rem",
	Internal:  "id c periph v fig esb esbe ref tr",
}

// markerCategories maps each marker to its category.
var markerCategories = func() map[string]MarkerCategory {
	m := make(map[string]MarkerCategory)
	for category, markers := range categoryDefinitions {
		for _, marker := range strings.Fields(markers) {
			m[marker] = category
		}
	}
	return m
}()

// paraCategories are paragraph-type categories that are implicitly closed by
// another paragraph.
var paraCategories = map[MarkerCategory]bool{
	Header:       true,
	Title:        true,
	Introduction: true,
	SectionPara:  true,
	VersePara:    true,
	List:         true,
	OtherPara:    true,
}

// charCategories are character-level categories.
var charCategories = map[MarkerCategory]bool{
	Char:               true,
	IntroChar:          true,
	ListChar:           true,
	FootnoteChar:       true,
	CrossReferenceChar: true,
}

// noteCategories are note (footnote/crossref) categories.
var noteCategories = map[MarkerCategory]bool{
	Footnote:       true,
	CrossReference: true,
}

// defaultAttributes maps markers to their default attribute name.
var defaultAttributes = map[string]string{
	"jmp":   "href",
	"k":     "key",
	"qt-s":  "who",
	"qt1-s": "who",
	"qt2-s": "who",
	"qt3-s": "who",
	"qt4-s": "who",
	"qt5-s": "who",
	"rb":    "gloss",
	"t-s":   "sid",
	"ts-s":  "sid",
	"w":     "lemma",
	"ref":   "loc",
	"xt":    "href",
	"vid":   "ref",
	"tl":    "lang",
	"wl":    "lang",
	"fig":   "alt",
}

// Category returns the category of a marker, or Unknown if unrecognized.
func Category(marker string) MarkerCategory {
	if c, ok := markerCategories[marker]; ok {
		return c
	}
	return Unknown
}

// DefaultAttribute returns the default attribute name for a marker (e.g.
// "lemma" for \w) and whether the marker has one.
func DefaultAttribute(marker string) (string, bool) {
	name, ok := defaultAttributes[marker]
	return name, ok
}

// IsPara reports whether the category is a paragraph-type category.
func (c MarkerCategory) IsPara() bool { return paraCategories[c] }

// IsChar reports whether the category is a character-level category.
func (c MarkerCategory) IsChar() bool { return charCategories[c] }

// IsNote reports whether the category is a note (footnote/crossref) category.
func (c MarkerCategory) IsNote() bool { return noteCategories[c] }

// IsParaMarker reports whether the marker is a paragraph-level element.
func IsParaMarker(marker string) bool { return Category(marker).IsPara() }

// IsCharMarker reports whether the marker is a character-level element.
func IsCharMarker(marker string) bool { return Category(marker).IsChar() }

// IsNoteMarker reports whether the marker is a note (footnote/crossref).
func IsNoteMarker(marker string) bool { return Category(marker).IsNote() }

// IsCellMarker reports whether the marker is a table cell marker.
func IsCellMarker(marker string) bool { return Category(marker) == Cell }

// IsMilestoneMarker reports whether the marker is a milestone marker.
func IsMilestoneMarker(marker string) bool { return Category(marker) == Milestone }
