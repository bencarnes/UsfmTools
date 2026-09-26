// Type-check and test the active Deno workspace packages in dependency order,
// then vet and test the Go module (usfm-parser-go).
// Cross-platform (Windows, macOS, Linux). Run from anywhere: `deno task build`

import { dirname, fromFileUrl, join } from "@std/path";

const ROOT = dirname(fromFileUrl(import.meta.url));

async function runTask(rel: string, task: string): Promise<void> {
  console.log("");
  console.log(`==> [${rel}] deno task ${task}`);
  const { code } = await new Deno.Command(Deno.execPath(), {
    args: ["task", task],
    cwd: join(ROOT, rel),
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (code !== 0) {
    console.error(`\nError: [${rel}] deno task ${task} failed (exit code ${code}).`);
    Deno.exit(code);
  }
}

async function runGo(args: string[]): Promise<void> {
  const rel = "usfm-parser-go";
  console.log("");
  console.log(`==> [${rel}] go ${args.join(" ")}`);
  let code: number;
  try {
    ({ code } = await new Deno.Command("go", {
      args,
      cwd: join(ROOT, rel),
      stdout: "inherit",
      stderr: "inherit",
    }).output());
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.error("\nError: go is not installed or not on PATH (needed for usfm-parser-go).");
      Deno.exit(1);
    }
    throw e;
  }
  if (code !== 0) {
    console.error(`\nError: [${rel}] go ${args.join(" ")} failed (exit code ${code}).`);
    Deno.exit(code);
  }
}

async function removeDir(path: string): Promise<void> {
  try {
    await Deno.remove(path, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
}

console.log("UsfmTools — check and test Deno workspace packages (under packages/)");

// Ladle (optional dev tooling) may create a workspace node_modules/ directory.
// Remove it so Deno resolves npm: imports from its cache without invoking npm.
await removeDir(join(ROOT, "node_modules"));
for await (const entry of Deno.readDir(join(ROOT, "packages"))) {
  if (entry.isDirectory) {
    await removeDir(join(ROOT, "packages", entry.name, "node_modules"));
  }
}

// packages/usfm-parser is reference-only (superseded by usfm-parser-go) and is
// not checked or tested here; it stays a workspace member only so remaining
// imports in usfm-model/usfm-controls resolve until they switch to the Go
// engine. Its integration tests (usfm-parser-integration-tests) are skipped
// for the same reason; the Berean corpus tests are being ported to Go.
await runTask("packages/usfm-model", "check");
await runTask("packages/usfm-controls", "check");
await runTask("packages/usfm-model", "test");
await runTask("packages/usfm-controls", "test");

await runGo(["vet", "./..."]);
await runGo(["test", "./..."]);

console.log("");
console.log(
  "Done. Packages export TypeScript source via deno.json exports. Run tasks from individual packages/ paths as needed.",
);
