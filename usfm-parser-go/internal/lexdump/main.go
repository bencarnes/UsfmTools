// Command lexdump writes normalized token streams for every .usfm file in a
// directory, for differential testing against the TS lexer. Temporary tool;
// see todo.md ("Port the lexer").
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/usfm-tools/usfm-parser-go/lexer"
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
		tokens := lexer.Tokenize(string(data))
		var b strings.Builder
		for _, t := range tokens {
			var attrs any
			if t.Attributes != nil {
				pairs := make([][2]string, 0, len(t.Attributes))
				for k, v := range t.Attributes {
					pairs = append(pairs, [2]string{k, v})
				}
				sort.Slice(pairs, func(i, j int) bool { return pairs[i][0] < pairs[j][0] })
				attrs = pairs
			}
			nested, end := 0, 0
			if t.IsNested {
				nested = 1
			}
			if t.IsEnd {
				end = 1
			}
			line, err := json.Marshal([]any{
				t.Type, t.Value,
				t.Position.Line, t.Position.Column, t.Position.Offset,
				nested, end, attrs,
			})
			if err != nil {
				panic(err)
			}
			b.Write(line)
			b.WriteByte('\n')
		}
		if err := os.WriteFile(filepath.Join(outDir, e.Name()+".jsonl"), []byte(b.String()), 0o644); err != nil {
			panic(err)
		}
	}
	fmt.Println("done")
}
