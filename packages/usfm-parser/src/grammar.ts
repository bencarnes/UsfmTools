import type { MarkerCategory } from "./types.js";

/**
 * Mapping of markers to their categories, derived from the USFM grammar spec.
 */
const MARKER_CATEGORIES: Record<string, MarkerCategory> = {};

const categoryDefinitions: Record<string, string> = {
  attribute:
    "cp vp usfm ca va cat vid",
  header:
    "ide h1 h2 h3 h toc1 toc2 toc3 toca1 toca2 toca3",
  title:
    "mt1 mt2 mt3 mt4 mt",
  introduction:
    "imt1 imt2 imt3 imt4 imte1 imte2 imte imt ib ie iex ili1 ili2 ili imi imq im io1 io2 io3 io4 iot io ipc ipi ipq ipr ip iq1 iq2 iq3 iq is1 is2 is ilit",
  introchar:
    "ior iqt",
  sectionpara:
    "restore ms1 ms2 ms3 ms mr mte1 mte2 mte r s1 s2 s3 s4 sr sp sd1 sd2 sd3 sd4 sd s cl cd",
  versepara:
    "cls nb pc pi1 pi2 pi3 pi po pr pmo pmc pmr pm ph1 ph2 ph3 ph p q1 q2 q3 q4 qc qr qm1 qm2 qm3 qm qd q b d mi1 mi2 mi3 mi4 mi m",
  char:
    "qac qs add addpn bk dc efm fm fv k nd ndx ord png pn pro qt rq sig sls tl wg wh wa wj jmp no it bdit bd em sc sup w rb pl ta",
  footnote:
    "fe f efe ef",
  footnotechar:
    "fr ft fk fqa fq fl fw fdc fp",
  crossreference:
    "ex x",
  crossreferencechar:
    "xt xop xo xta xk xq xot xnt xdc",
  list:
    "lh li1 li2 li3 li4 lim1 lim2 lim3 lim4 lim li lf",
  listchar:
    "litl lik liv1 liv2 liv3 liv4 liv5 liv",
  cell:
    "th1 th2 th3 th4 th5 th6 th7 th8 th9 th10 th11 th12 tc1 tc2 tc3 tc4 tc5 tc6 tc7 tc8 tc9 tc10 tc11 tc12 tcr1 tcr2 tcr3 tcr4 tcr5 tcr6 tcr7 tcr8 tcr9 tcc1 tcc2 tcc3 tcc4 tcc5 tcc6 tcc7 tcc8 tcc9 tcc10 tcc11 tcc12 thc1 thc2 thc3 thc4 thc5 thc6 thc7 thc8 thc9 thc10 thc11 tch12 thr1 thr2 thr3 thr4 thr5 thr6 thr7 thr8 thr9 thr10 thr11 thr12",
  milestone:
    "ts-s ts-e ts t-s t-e qt1-s qt1-e qt2-s qt2-e qt3-s qt3-e qt4-s qt4-e qt5-s qt5-e qt-s qt-e wj-s wj-e",
  otherpara:
    "sts lit pb p1 p2 qa k1 k2 rem",
  internal:
    "id c periph v fig esb esbe ref tr",
};

for (const [category, markers] of Object.entries(categoryDefinitions)) {
  for (const marker of markers.split(/\s+/).filter(Boolean)) {
    MARKER_CATEGORIES[marker] = category as MarkerCategory;
  }
}

/** Paragraph-type categories that are implicitly closed by another paragraph */
export const PARA_CATEGORIES = new Set<string>([
  "header",
  "title",
  "introduction",
  "sectionpara",
  "versepara",
  "list",
  "otherpara",
]);

/** Character-level categories */
export const CHAR_CATEGORIES = new Set<string>([
  "char",
  "introchar",
  "listchar",
  "footnotechar",
  "crossreferencechar",
]);

/** Note categories */
export const NOTE_CATEGORIES = new Set<string>([
  "footnote",
  "crossreference",
]);

/** Default attribute names for specific markers */
export const DEFAULT_ATTRIBUTES: Record<string, string> = {
  jmp: "href",
  k: "key",
  "qt-s": "who",
  "qt1-s": "who",
  "qt2-s": "who",
  "qt3-s": "who",
  "qt4-s": "who",
  "qt5-s": "who",
  rb: "gloss",
  "t-s": "sid",
  "ts-s": "sid",
  w: "lemma",
  ref: "loc",
  xt: "href",
  vid: "ref",
  tl: "lang",
  wl: "lang",
  fig: "alt",
};

/**
 * Get the category of a marker.
 */
export function getMarkerCategory(marker: string): MarkerCategory {
  return MARKER_CATEGORIES[marker] ?? "unknown";
}

/**
 * Check if a marker represents a paragraph-level element.
 */
export function isParaMarker(marker: string): boolean {
  const cat = getMarkerCategory(marker);
  return PARA_CATEGORIES.has(cat);
}

/**
 * Check if a marker represents a character-level element.
 */
export function isCharMarker(marker: string): boolean {
  const cat = getMarkerCategory(marker);
  return CHAR_CATEGORIES.has(cat);
}

/**
 * Check if a marker represents a note (footnote/crossref).
 */
export function isNoteMarker(marker: string): boolean {
  const cat = getMarkerCategory(marker);
  return NOTE_CATEGORIES.has(cat);
}

/**
 * Check if a marker is a cell marker (table).
 */
export function isCellMarker(marker: string): boolean {
  return getMarkerCategory(marker) === "cell";
}

/**
 * Check if a marker is a milestone marker.
 */
export function isMilestoneMarker(marker: string): boolean {
  return getMarkerCategory(marker) === "milestone";
}
