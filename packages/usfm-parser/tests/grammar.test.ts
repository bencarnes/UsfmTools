import { describe, it, expect } from "vitest";
import {
  getMarkerCategory,
  isParaMarker,
  isCharMarker,
  isNoteMarker,
  isCellMarker,
  isMilestoneMarker,
} from "../src/grammar.js";

describe("Grammar", () => {
  describe("getMarkerCategory", () => {
    it("should identify header markers", () => {
      expect(getMarkerCategory("h")).toBe("header");
      expect(getMarkerCategory("toc1")).toBe("header");
      expect(getMarkerCategory("toc2")).toBe("header");
      expect(getMarkerCategory("ide")).toBe("header");
    });

    it("should identify title markers", () => {
      expect(getMarkerCategory("mt1")).toBe("title");
      expect(getMarkerCategory("mt")).toBe("title");
    });

    it("should identify paragraph markers", () => {
      expect(getMarkerCategory("p")).toBe("versepara");
      expect(getMarkerCategory("q1")).toBe("versepara");
      expect(getMarkerCategory("m")).toBe("versepara");
      expect(getMarkerCategory("pi1")).toBe("versepara");
    });

    it("should identify section markers", () => {
      expect(getMarkerCategory("s1")).toBe("sectionpara");
      expect(getMarkerCategory("s")).toBe("sectionpara");
      expect(getMarkerCategory("r")).toBe("sectionpara");
      expect(getMarkerCategory("mr")).toBe("sectionpara");
    });

    it("should identify character markers", () => {
      expect(getMarkerCategory("nd")).toBe("char");
      expect(getMarkerCategory("wj")).toBe("char");
      expect(getMarkerCategory("bk")).toBe("char");
      expect(getMarkerCategory("w")).toBe("char");
    });

    it("should identify footnote markers", () => {
      expect(getMarkerCategory("f")).toBe("footnote");
      expect(getMarkerCategory("fe")).toBe("footnote");
      expect(getMarkerCategory("fr")).toBe("footnotechar");
      expect(getMarkerCategory("ft")).toBe("footnotechar");
    });

    it("should identify cross-reference markers", () => {
      expect(getMarkerCategory("x")).toBe("crossreference");
      expect(getMarkerCategory("xo")).toBe("crossreferencechar");
      expect(getMarkerCategory("xt")).toBe("crossreferencechar");
    });

    it("should identify cell markers", () => {
      expect(getMarkerCategory("th1")).toBe("cell");
      expect(getMarkerCategory("tc1")).toBe("cell");
      expect(getMarkerCategory("tcr1")).toBe("cell");
    });

    it("should identify milestone markers", () => {
      expect(getMarkerCategory("qt-s")).toBe("milestone");
      expect(getMarkerCategory("qt-e")).toBe("milestone");
      expect(getMarkerCategory("ts-s")).toBe("milestone");
    });

    it("should return unknown for unrecognized markers", () => {
      expect(getMarkerCategory("zzz")).toBe("unknown");
      expect(getMarkerCategory("notamarker")).toBe("unknown");
    });
  });

  describe("isParaMarker", () => {
    it("should return true for paragraph-type markers", () => {
      expect(isParaMarker("p")).toBe(true);
      expect(isParaMarker("q1")).toBe(true);
      expect(isParaMarker("s1")).toBe(true);
      expect(isParaMarker("mt1")).toBe(true);
      expect(isParaMarker("h")).toBe(true);
      expect(isParaMarker("ip")).toBe(true);
      expect(isParaMarker("li1")).toBe(true);
    });

    it("should return false for non-paragraph markers", () => {
      expect(isParaMarker("nd")).toBe(false);
      expect(isParaMarker("f")).toBe(false);
      expect(isParaMarker("v")).toBe(false);
      expect(isParaMarker("c")).toBe(false);
    });
  });

  describe("isCharMarker", () => {
    it("should return true for character markers", () => {
      expect(isCharMarker("nd")).toBe(true);
      expect(isCharMarker("wj")).toBe(true);
      expect(isCharMarker("bk")).toBe(true);
      expect(isCharMarker("fr")).toBe(true);
      expect(isCharMarker("xt")).toBe(true);
    });

    it("should return false for non-character markers", () => {
      expect(isCharMarker("p")).toBe(false);
      expect(isCharMarker("c")).toBe(false);
      expect(isCharMarker("v")).toBe(false);
    });
  });

  describe("isNoteMarker", () => {
    it("should return true for note markers", () => {
      expect(isNoteMarker("f")).toBe(true);
      expect(isNoteMarker("fe")).toBe(true);
      expect(isNoteMarker("x")).toBe(true);
      expect(isNoteMarker("ex")).toBe(true);
    });

    it("should return false for non-note markers", () => {
      expect(isNoteMarker("fr")).toBe(false);
      expect(isNoteMarker("p")).toBe(false);
    });
  });

  describe("isCellMarker", () => {
    it("should return true for cell markers", () => {
      expect(isCellMarker("th1")).toBe(true);
      expect(isCellMarker("tc1")).toBe(true);
      expect(isCellMarker("tc2")).toBe(true);
      expect(isCellMarker("tcr1")).toBe(true);
    });

    it("should return false for non-cell markers", () => {
      expect(isCellMarker("tr")).toBe(false);
      expect(isCellMarker("p")).toBe(false);
    });
  });

  describe("isMilestoneMarker", () => {
    it("should return true for milestone markers", () => {
      expect(isMilestoneMarker("qt-s")).toBe(true);
      expect(isMilestoneMarker("qt-e")).toBe(true);
      expect(isMilestoneMarker("ts-s")).toBe(true);
    });

    it("should return false for non-milestone markers", () => {
      expect(isMilestoneMarker("p")).toBe(false);
      expect(isMilestoneMarker("nd")).toBe(false);
    });
  });
});
