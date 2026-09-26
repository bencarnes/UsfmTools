// Command classdump writes normalized classification streams for every
// .usfm file in a directory, for differential testing against the TS
// classifier (line/column fields only — the TS side has no offset/byte).
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/usfm-tools/usfm-parser-go/engine"
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
	e := engine.New(engine.Options{})
	defer e.Shutdown()
	for _, ent := range entries {
		if !strings.HasSuffix(ent.Name(), ".usfm") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(srcDir, ent.Name()))
		if err != nil {
			panic(err)
		}
		if err := e.Open(ent.Name(), 1, string(data)); err != nil {
			panic(err)
		}
		tokens, _, err := e.Classify(ent.Name())
		if err != nil {
			panic(err)
		}
		var b strings.Builder
		for _, t := range tokens {
			line, _ := json.Marshal([]any{
				t.Type,
				t.Range.Start.Line, t.Range.Start.Column,
				t.Range.End.Line, t.Range.End.Column,
			})
			b.Write(line)
			b.WriteByte('\n')
		}
		if err := os.WriteFile(filepath.Join(outDir, ent.Name()+".jsonl"), []byte(b.String()), 0o644); err != nil {
			panic(err)
		}
		if err := e.Close(ent.Name()); err != nil {
			panic(err)
		}
	}
	fmt.Println("done")
}
