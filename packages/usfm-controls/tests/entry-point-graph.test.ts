import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

interface InfoDependency {
  code?: { specifier: string };
  isDynamic?: boolean;
}
interface InfoModule {
  specifier: string;
  dependencies?: InfoDependency[];
}
interface InfoGraph {
  roots: string[];
  modules: InfoModule[];
  redirects: Record<string, string>;
}

async function moduleGraph(entry: string): Promise<InfoGraph> {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["info", "--json", "--unstable-sloppy-imports", entry],
    cwd: new URL("..", import.meta.url),
    stdout: "piped",
    stderr: "null",
  }).output();
  if (!output.success) throw new Error(`deno info failed for ${entry}`);
  return JSON.parse(new TextDecoder().decode(output.stdout));
}

/** Modules loaded at runtime by importing the root, optionally following `import()`. */
function reachable(graph: InfoGraph, { followDynamic }: { followDynamic: boolean }): string[] {
  const byName = new Map(graph.modules.map((m) => [m.specifier, m]));
  const resolve = (s: string) => graph.redirects[s] ?? s;
  const seen = new Set<string>();
  const stack = graph.roots.map(resolve);
  while (stack.length) {
    const name = stack.pop()!;
    if (seen.has(name)) continue;
    seen.add(name);
    for (const dep of byName.get(name)?.dependencies ?? []) {
      // Type-only imports have no `code` edge and are erased at runtime.
      if (!dep.code || (dep.isDynamic && !followDynamic)) continue;
      stack.push(resolve(dep.code.specifier));
    }
  }
  return [...seen];
}

const isTsParser = (specifier: string) => specifier.includes("/packages/usfm-parser/");

describe("package entry point graph", () => {
  // Apps that inject an engine-backed language client (bible-edit) must not
  // bundle the reference TS parser: the main entry may only reach it through
  // the lazily imported local fallback client.
  it("main entry reaches the TS parser only via dynamic import", async () => {
    const graph = await moduleGraph("src/index.ts");
    expect(reachable(graph, { followDynamic: false }).filter(isTsParser)).toEqual([]);
    // Sanity: the lazy fallback does pull it in, so the walk above is meaningful.
    expect(reachable(graph, { followDynamic: true }).some(isTsParser)).toBe(true);
  });

  it("local entry provides the parser-backed API statically", async () => {
    const graph = await moduleGraph("src/local.ts");
    expect(reachable(graph, { followDynamic: false }).some(isTsParser)).toBe(true);
  });
});
