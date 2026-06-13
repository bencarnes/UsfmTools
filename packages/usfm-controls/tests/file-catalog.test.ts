import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { buildUsfmFilePickerGroups } from "@usfm-tools/model";
import { buildUsfmFilePickerCatalog, EMPTY_FILE_CATALOG } from "../src/components/usfm-shell/file-catalog.js";

describe("buildUsfmFilePickerCatalog", () => {
  it("returns empty groups for an empty folder", async () => {
    const catalog = await buildUsfmFilePickerCatalog([], async () => "unused");
    expect(catalog).toEqual(EMPTY_FILE_CATALOG);
  });

  it("indexes files without retaining full USFM bodies in the catalog", async () => {
    const catalog = await buildUsfmFilePickerCatalog(
      [{ id: "f://a", name: "GEN.usfm" }],
      async () => "\\id GEN\n\\c 1\n\\p\n\\v 1 Hello.",
    );
    const fromFiles = buildUsfmFilePickerGroups([
      { id: "f://a", name: "GEN.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 Hello." },
    ]);
    expect(catalog).toEqual(fromFiles);
    expect(JSON.stringify(catalog)).not.toContain("Hello.");
  });
});
