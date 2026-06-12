import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  folderLabel,
  isFileInFolder,
  isUsfmFile,
  listUsfmEntries,
  usfmFileId,
} from "../src/usfm-utils.ts";

describe("usfm-utils", () => {
  describe("folderLabel", () => {
    it("returns the basename", () => {
      expect(folderLabel("/home/user/bibles/bsb/usfm")).toBe("usfm");
    });

    it("strips trailing slashes", () => {
      expect(folderLabel("/data/corpus/")).toBe("corpus");
    });

    it("returns the whole path when there is no slash", () => {
      expect(folderLabel("corpus")).toBe("corpus");
    });
  });

  describe("isUsfmFile", () => {
    it("accepts .usfm regardless of case", () => {
      expect(isUsfmFile("GEN.usfm")).toBe(true);
      expect(isUsfmFile("GEN.USFM")).toBe(true);
    });

    it("rejects other extensions", () => {
      expect(isUsfmFile("notes.txt")).toBe(false);
      expect(isUsfmFile("GEN.usfm.bak")).toBe(false);
    });
  });

  describe("usfmFileId", () => {
    it("joins folder and file name", () => {
      expect(usfmFileId("/tmp/usfm", "GEN.usfm")).toBe("/tmp/usfm/GEN.usfm");
    });
  });

  describe("isFileInFolder", () => {
    it("matches files in the folder", () => {
      expect(isFileInFolder("/tmp/usfm", "/tmp/usfm/GEN.usfm")).toBe(true);
    });

    it("rejects paths outside the folder", () => {
      expect(isFileInFolder("/tmp/usfm", "/tmp/other/GEN.usfm")).toBe(false);
      expect(isFileInFolder("/tmp/usfm", "/tmp/usfm-extra/GEN.usfm")).toBe(false);
    });
  });

  describe("listUsfmEntries", () => {
    it("returns only USFM files sorted by name", () => {
      expect(
        listUsfmEntries("/tmp/usfm", [
          { name: "EXO.usfm", isFile: true },
          { name: "notes.txt", isFile: true },
          { name: "GEN.usfm", isFile: true },
          { name: "subdir", isFile: false },
        ]),
      ).toEqual([
        { id: "/tmp/usfm/EXO.usfm", name: "EXO.usfm" },
        { id: "/tmp/usfm/GEN.usfm", name: "GEN.usfm" },
      ]);
    });
  });
});
