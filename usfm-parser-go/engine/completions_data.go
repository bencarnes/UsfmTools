package engine

// markerCompletions is the port of MARKER_COMPLETIONS in
// usfm-controls/src/language-service/completions.ts.
var markerCompletions = []CompletionItem{
	// Identification & headers
	{Label: `\id`, Detail: "Book identification", InsertText: `\id `},
	{Label: `\h`, Detail: "Running header", InsertText: `\h `},
	{Label: `\toc1`, Detail: "Long table of contents", InsertText: `\toc1 `},
	{Label: `\toc2`, Detail: "Short table of contents", InsertText: `\toc2 `},
	{Label: `\toc3`, Detail: "Book abbreviation", InsertText: `\toc3 `},
	{Label: `\mt1`, Detail: "Main title level 1", InsertText: `\mt1 `},
	{Label: `\mt2`, Detail: "Main title level 2", InsertText: `\mt2 `},

	// Structure
	{Label: `\c`, Detail: "Chapter", InsertText: `\c `},
	{Label: `\v`, Detail: "Verse", InsertText: `\v `},

	// Paragraphs
	{Label: `\p`, Detail: "Paragraph", InsertText: `\p `},
	{Label: `\m`, Detail: "Paragraph continuation (no indent)", InsertText: `\m `},
	{Label: `\pi1`, Detail: "Indented paragraph level 1", InsertText: `\pi1 `},
	{Label: `\nb`, Detail: "No-break paragraph", InsertText: `\nb `},
	{Label: `\pmo`, Detail: "Embedded text opening", InsertText: `\pmo `},
	{Label: `\pc`, Detail: "Centered paragraph", InsertText: `\pc `},

	// Poetry
	{Label: `\q1`, Detail: "Poetry indent level 1", InsertText: `\q1 `},
	{Label: `\q2`, Detail: "Poetry indent level 2", InsertText: `\q2 `},
	{Label: `\q3`, Detail: "Poetry indent level 3", InsertText: `\q3 `},
	{Label: `\qr`, Detail: "Poetry right-aligned", InsertText: `\qr `},
	{Label: `\qc`, Detail: "Poetry centered", InsertText: `\qc `},
	{Label: `\b`, Detail: "Poetry stanza break", InsertText: `\b`},

	// Section headings
	{Label: `\s1`, Detail: "Section heading level 1", InsertText: `\s1 `},
	{Label: `\s2`, Detail: "Section heading level 2", InsertText: `\s2 `},
	{Label: `\r`, Detail: "Parallel reference", InsertText: `\r `},
	{Label: `\d`, Detail: "Descriptive title (Psalms)", InsertText: `\d `},
	{Label: `\sp`, Detail: "Speaker identification", InsertText: `\sp `},

	// Character styles
	{Label: `\nd`, Detail: "Name of deity", InsertText: `\nd `},
	{Label: `\wj`, Detail: "Words of Jesus", InsertText: `\wj `},
	{Label: `\bk`, Detail: "Book name", InsertText: `\bk `},
	{Label: `\it`, Detail: "Italic", InsertText: `\it `},
	{Label: `\bd`, Detail: "Bold", InsertText: `\bd `},
	{Label: `\sc`, Detail: "Small caps", InsertText: `\sc `},
	{Label: `\w`, Detail: "Wordlist/glossary entry", InsertText: `\w `},
	{Label: `\add`, Detail: "Translator addition", InsertText: `\add `},
	{Label: `\pn`, Detail: "Proper name", InsertText: `\pn `},
	{Label: `\qt`, Detail: "OT quotation in NT", InsertText: `\qt `},

	// Notes
	{Label: `\f`, Detail: "Footnote", InsertText: `\f + `},
	{Label: `\fe`, Detail: "Endnote", InsertText: `\fe + `},
	{Label: `\x`, Detail: "Cross reference", InsertText: `\x - `},
	{Label: `\fr`, Detail: "Footnote origin reference", InsertText: `\fr `},
	{Label: `\ft`, Detail: "Footnote text", InsertText: `\ft `},
	{Label: `\fq`, Detail: "Footnote quotation", InsertText: `\fq `},
	{Label: `\fqa`, Detail: "Footnote alternate rendering", InsertText: `\fqa `},
	{Label: `\xo`, Detail: "Cross-ref origin", InsertText: `\xo `},
	{Label: `\xt`, Detail: "Cross-ref target", InsertText: `\xt `},

	// References
	{Label: `\ref`, Detail: "Reference link", InsertText: `\ref `},

	// Tables
	{Label: `\tr`, Detail: "Table row", InsertText: `\tr `},
	{Label: `\th1`, Detail: "Table header cell 1", InsertText: `\th1 `},
	{Label: `\tc1`, Detail: "Table cell 1", InsertText: `\tc1 `},

	// Lists
	{Label: `\li1`, Detail: "List item level 1", InsertText: `\li1 `},
	{Label: `\li2`, Detail: "List item level 2", InsertText: `\li2 `},

	// Introduction
	{Label: `\imt1`, Detail: "Intro major title", InsertText: `\imt1 `},
	{Label: `\ip`, Detail: "Intro paragraph", InsertText: `\ip `},
	{Label: `\is1`, Detail: "Intro section heading", InsertText: `\is1 `},
}

// bookCodeCompletions lists the 66 canonical Paratext/USFM book codes,
// offered while typing the argument of \id.
var bookCodeCompletions = []CompletionItem{
	{Label: "GEN", Detail: "Genesis", InsertText: "GEN "},
	{Label: "EXO", Detail: "Exodus", InsertText: "EXO "},
	{Label: "LEV", Detail: "Leviticus", InsertText: "LEV "},
	{Label: "NUM", Detail: "Numbers", InsertText: "NUM "},
	{Label: "DEU", Detail: "Deuteronomy", InsertText: "DEU "},
	{Label: "JOS", Detail: "Joshua", InsertText: "JOS "},
	{Label: "JDG", Detail: "Judges", InsertText: "JDG "},
	{Label: "RUT", Detail: "Ruth", InsertText: "RUT "},
	{Label: "1SA", Detail: "1 Samuel", InsertText: "1SA "},
	{Label: "2SA", Detail: "2 Samuel", InsertText: "2SA "},
	{Label: "1KI", Detail: "1 Kings", InsertText: "1KI "},
	{Label: "2KI", Detail: "2 Kings", InsertText: "2KI "},
	{Label: "1CH", Detail: "1 Chronicles", InsertText: "1CH "},
	{Label: "2CH", Detail: "2 Chronicles", InsertText: "2CH "},
	{Label: "EZR", Detail: "Ezra", InsertText: "EZR "},
	{Label: "NEH", Detail: "Nehemiah", InsertText: "NEH "},
	{Label: "EST", Detail: "Esther", InsertText: "EST "},
	{Label: "JOB", Detail: "Job", InsertText: "JOB "},
	{Label: "PSA", Detail: "Psalms", InsertText: "PSA "},
	{Label: "PRO", Detail: "Proverbs", InsertText: "PRO "},
	{Label: "ECC", Detail: "Ecclesiastes", InsertText: "ECC "},
	{Label: "SNG", Detail: "Song of Songs", InsertText: "SNG "},
	{Label: "ISA", Detail: "Isaiah", InsertText: "ISA "},
	{Label: "JER", Detail: "Jeremiah", InsertText: "JER "},
	{Label: "LAM", Detail: "Lamentations", InsertText: "LAM "},
	{Label: "EZK", Detail: "Ezekiel", InsertText: "EZK "},
	{Label: "DAN", Detail: "Daniel", InsertText: "DAN "},
	{Label: "HOS", Detail: "Hosea", InsertText: "HOS "},
	{Label: "JOL", Detail: "Joel", InsertText: "JOL "},
	{Label: "AMO", Detail: "Amos", InsertText: "AMO "},
	{Label: "OBA", Detail: "Obadiah", InsertText: "OBA "},
	{Label: "JON", Detail: "Jonah", InsertText: "JON "},
	{Label: "MIC", Detail: "Micah", InsertText: "MIC "},
	{Label: "NAM", Detail: "Nahum", InsertText: "NAM "},
	{Label: "HAB", Detail: "Habakkuk", InsertText: "HAB "},
	{Label: "ZEP", Detail: "Zephaniah", InsertText: "ZEP "},
	{Label: "HAG", Detail: "Haggai", InsertText: "HAG "},
	{Label: "ZEC", Detail: "Zechariah", InsertText: "ZEC "},
	{Label: "MAL", Detail: "Malachi", InsertText: "MAL "},
	{Label: "MAT", Detail: "Matthew", InsertText: "MAT "},
	{Label: "MRK", Detail: "Mark", InsertText: "MRK "},
	{Label: "LUK", Detail: "Luke", InsertText: "LUK "},
	{Label: "JHN", Detail: "John", InsertText: "JHN "},
	{Label: "ACT", Detail: "Acts", InsertText: "ACT "},
	{Label: "ROM", Detail: "Romans", InsertText: "ROM "},
	{Label: "1CO", Detail: "1 Corinthians", InsertText: "1CO "},
	{Label: "2CO", Detail: "2 Corinthians", InsertText: "2CO "},
	{Label: "GAL", Detail: "Galatians", InsertText: "GAL "},
	{Label: "EPH", Detail: "Ephesians", InsertText: "EPH "},
	{Label: "PHP", Detail: "Philippians", InsertText: "PHP "},
	{Label: "COL", Detail: "Colossians", InsertText: "COL "},
	{Label: "1TH", Detail: "1 Thessalonians", InsertText: "1TH "},
	{Label: "2TH", Detail: "2 Thessalonians", InsertText: "2TH "},
	{Label: "1TI", Detail: "1 Timothy", InsertText: "1TI "},
	{Label: "2TI", Detail: "2 Timothy", InsertText: "2TI "},
	{Label: "TIT", Detail: "Titus", InsertText: "TIT "},
	{Label: "PHM", Detail: "Philemon", InsertText: "PHM "},
	{Label: "HEB", Detail: "Hebrews", InsertText: "HEB "},
	{Label: "JAS", Detail: "James", InsertText: "JAS "},
	{Label: "1PE", Detail: "1 Peter", InsertText: "1PE "},
	{Label: "2PE", Detail: "2 Peter", InsertText: "2PE "},
	{Label: "1JN", Detail: "1 John", InsertText: "1JN "},
	{Label: "2JN", Detail: "2 John", InsertText: "2JN "},
	{Label: "3JN", Detail: "3 John", InsertText: "3JN "},
	{Label: "JUD", Detail: "Jude", InsertText: "JUD "},
	{Label: "REV", Detail: "Revelation", InsertText: "REV "},
}
