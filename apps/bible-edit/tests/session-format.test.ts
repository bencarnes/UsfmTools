import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  EMPTY_SESSION,
  parseSessionJson,
  serializeSession,
} from "../src/session-format.ts";

describe("session-format", () => {
  it("round-trips a session with a folder path", () => {
    const session = { usfmFolder: "/data/bibles/bsb/usfm" };
    expect(parseSessionJson(serializeSession(session))).toEqual(session);
  });

  it("returns null when usfmFolder is missing or invalid", () => {
    expect(parseSessionJson("{}")).toEqual(EMPTY_SESSION);
    expect(parseSessionJson('{"usfmFolder": 42}')).toEqual(EMPTY_SESSION);
    expect(parseSessionJson('{"usfmFolder": null}')).toEqual(EMPTY_SESSION);
  });

  it("serializes with indentation", () => {
    const json = serializeSession({ usfmFolder: "/tmp/usfm" });
    expect(json).toContain('\n  "usfmFolder": "/tmp/usfm"');
  });
});
