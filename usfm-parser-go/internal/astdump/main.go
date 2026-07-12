// Command astdump writes normalized ASTs for every .usfm file in a
// directory, for differential testing against the TS parser (same
// normalization as the scratchpad dump-ast-ts.ts script).
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	usfm "github.com/usfm-tools/usfm-parser-go"
	"github.com/usfm-tools/usfm-parser-go/parser"
)

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func normPos(p *usfm.Position) any {
	if p == nil {
		return nil
	}
	return []int{p.Line, p.Column, p.Offset}
}

func normAttrs(attrs map[string]string) any {
	if attrs == nil {
		return nil
	}
	pairs := make([][2]string, 0, len(attrs))
	for k, v := range attrs {
		pairs = append(pairs, [2]string{k, v})
	}
	sort.Slice(pairs, func(i, j int) bool { return pairs[i][0] < pairs[j][0] })
	return pairs
}

func normNode(n *usfm.Node) []any {
	var children any
	if n.Children != nil {
		list := make([]any, len(n.Children))
		for i, c := range n.Children {
			list[i] = normNode(c)
		}
		children = list
	}
	return []any{
		n.Type,
		nullable(n.Marker),
		nullable(n.Code),
		nullable(n.Description),
		nullable(n.Number),
		nullable(n.Caller),
		nullable(n.Text),
		normPos(n.Position),
		normAttrs(n.Attributes),
		children,
	}
}

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
		result := parser.Parse(string(data))
		errs := make([]any, len(result.Errors))
		for i, pe := range result.Errors {
			errs[i] = []any{pe.Message, normPos(pe.Position)}
		}
		out := map[string]any{"ast": normNode(result.Document), "errors": errs}
		text, err := json.MarshalIndent(out, "", " ")
		if err != nil {
			panic(err)
		}
		if err := os.WriteFile(filepath.Join(outDir, e.Name()+".json"), append(text, '\n'), 0o644); err != nil {
			panic(err)
		}
	}
	fmt.Println("done")
}
