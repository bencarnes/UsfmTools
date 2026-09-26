// Build BibleEdit (Wails desktop app).
// Cross-platform (Windows, macOS, Linux). Run from the repository root with
// `deno task build:bible-edit`, or from here with `deno run -A build.ts`.

import { DELIMITER, dirname, fromFileUrl, join } from "@std/path";

const ROOT = dirname(fromFileUrl(import.meta.url));
const isWindows = Deno.build.os === "windows";

// Make `go install`-ed tools (wails) reachable even if Go's bin dir isn't on PATH.
const home = Deno.env.get(isWindows ? "USERPROFILE" : "HOME") ?? "";
const goBins = [Deno.env.get("GOBIN"), home && join(home, "go", "bin")].filter(
  (p): p is string => !!p,
);
Deno.env.set("PATH", [...goBins, Deno.env.get("PATH") ?? ""].join(DELIMITER));

async function run(cmd: string, args: string[], cwd = ROOT): Promise<void> {
  console.log(`> ${cmd} ${args.join(" ")}`);
  let code: number;
  try {
    // npm is a .cmd shim on Windows, which must be named explicitly.
    const exe = isWindows && cmd === "npm" ? "npm.cmd" : cmd;
    ({ code } = await new Deno.Command(exe, {
      args,
      cwd,
      stdout: "inherit",
      stderr: "inherit",
    }).output());
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.error(`\nError: '${cmd}' is not installed or not on PATH.`);
      Deno.exit(1);
    }
    throw e;
  }
  if (code !== 0) {
    console.error(`\nError: '${cmd} ${args.join(" ")}' failed (exit code ${code}).`);
    Deno.exit(code);
  }
}

async function hasPkgConfig(pkg: string): Promise<boolean> {
  try {
    const { code } = await new Deno.Command("pkg-config", {
      args: ["--exists", pkg],
      stdout: "null",
      stderr: "null",
    }).output();
    return code === 0;
  } catch {
    return false;
  }
}

const frontend = join(ROOT, "frontend");

console.log("==> frontend npm install");
await run("npm", ["install"], frontend);

console.log("\n==> frontend production bundle");
await run("npm", ["run", "build"], frontend);

// Ubuntu 24.04+ only ships WebKitGTK 4.1, which Wails needs a build tag for.
const tags: string[] = [];
if (
  Deno.build.os === "linux" && !(await hasPkgConfig("webkit2gtk-4.0")) &&
  (await hasPkgConfig("webkit2gtk-4.1"))
) {
  tags.push("-tags", "webkit2_41");
  console.log("==> using Go build tag webkit2_41 (WebKitGTK 4.1)");
}

// -s: the frontend was already built above.
console.log("\n==> wails build");
await run("wails", ["build", "-s", ...tags]);

const binary = { windows: "BibleEdit.exe", darwin: "BibleEdit.app" }[Deno.build.os as string] ??
  "BibleEdit";
console.log(`\nBuilt: ${join(ROOT, "build", "bin", binary)}`);
