import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { buildUsfmFilePickerGroups } from "@usfm-tools/model";
import { buildUsfmFilePickerCatalog, EMPTY_FILE_CATALOG } from "../src/components/usfm-shell/file-catalog.js";
import type { UsfmShellHost } from "../src/components/usfm-shell/host.js";

describe("buildUsfmFilePickerCatalog", () => {
  it("returns empty groups for an empty folder", async () => {
    const host = {
      async readFile() {
        return "unused";
      },
    };
    const catalog = await buildUsfmFilePickerCatalog([], host);
    expect(catalog).toEqual(EMPTY_FILE_CATALOG);
  });

  it("indexes files without retaining full USFM bodies in the catalog", async () => {
    const full = "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n\\v 1 Hello.";
    const host = {
      async readFile() {
        return full;
      },
    };
    const catalog = await buildUsfmFilePickerCatalog([{ id: "f://a", name: "GEN.usfm" }], host);
    const fromFiles = buildUsfmFilePickerGroups([
      { id: "f://a", name: "GEN.usfm", usfm: full },
    ]);
    expect(catalog).toEqual(fromFiles);
    expect(JSON.stringify(catalog)).not.toContain("Hello.");
  });

  it("prefers readFilePickerHeader when the host provides it", async () => {
    let readFileCalls = 0;
    const host = {
      async readFile() {
        readFileCalls++;
        return "\\id GEN\n\\c 1\n\\p\n\\v 1 Should not be indexed.";
      },
      async readFilePickerHeader() {
        return "\\id GEN\n\\toc3 Gen";
      },
    };
    const catalog = await buildUsfmFilePickerCatalog([{ id: "f://a", name: "GEN.usfm" }], host);
    expect(readFileCalls).toBe(0);
    expect(catalog.oldTestament[0]?.code).toBe("GEN");
    expect(JSON.stringify(catalog)).not.toContain("Should not");
  });
});
