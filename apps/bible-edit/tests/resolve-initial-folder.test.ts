import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { resolveInitialFolderPath } from "../src/resolve-initial-folder.ts";

const SAMPLE = "./bibles/bsb/usfm";
const LIBRARY = "/home/user/.config/com.usfmtools.bible-edit/usfm";

describe("resolveInitialFolderPath", () => {
  it("prefers a persisted session folder when it still exists", () => {
    expect(
      resolveInitialFolderPath({
        sessionFolder: "/saved/corpus",
        sessionFolderExists: true,
        sampleCorpusExists: true,
        sampleCorpusPath: SAMPLE,
        appDataLibraryPath: LIBRARY,
      }),
    ).toBe("/saved/corpus");
  });

  it("falls back to the sample corpus when the session folder is missing", () => {
    expect(
      resolveInitialFolderPath({
        sessionFolder: "/gone/corpus",
        sessionFolderExists: false,
        sampleCorpusExists: true,
        sampleCorpusPath: SAMPLE,
        appDataLibraryPath: LIBRARY,
      }),
    ).toBe(SAMPLE);
  });

  it("falls back to the app-data library when no session or sample corpus exists", () => {
    expect(
      resolveInitialFolderPath({
        sessionFolder: null,
        sessionFolderExists: false,
        sampleCorpusExists: false,
        sampleCorpusPath: SAMPLE,
        appDataLibraryPath: LIBRARY,
      }),
    ).toBe(LIBRARY);
  });
});
