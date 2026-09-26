// Command previewdump renders preview HTML (plain and verse-per-line) for
// every .usfm file in a directory, for differential testing against the TS
// renderer (see the dump-preview-ts.ts scratchpad script).
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/usfm-tools/usfm-parser-go/preview"
)

func main() {
	srcDir, outDir := os.Args[1], os.Args[2]
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		panic(err)
	}
	entries, err := os.ReadDir(srcDir)
	if err != nil {
		panic(err)
	}
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".usfm") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(srcDir, e.Name()))
		if err != nil {
			panic(err)
		}
		source := string(data)
		plain := preview.Render(source, preview.Options{})
		perLine := preview.Render(source, preview.Options{VersePerLine: true})
		if err := os.WriteFile(filepath.Join(outDir, e.Name()+".html"), []byte(plain), 0o644); err != nil {
			panic(err)
		}
		if err := os.WriteFile(filepath.Join(outDir, e.Name()+".vpl.html"), []byte(perLine), 0o644); err != nil {
			panic(err)
		}
	}
	fmt.Println("done")
}
