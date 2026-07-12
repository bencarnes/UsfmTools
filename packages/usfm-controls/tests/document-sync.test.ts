import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { ChangeSet, Text } from "@codemirror/state";
import {
  changesFromChangeSet,
  DocumentSync,
} from "../src/language-service/document-sync.js";
import type {
  DocumentChange,
  UsfmLanguageClient,
} from "../src/language-service/protocol.js";

type Call =
  | { method: "open"; id: string; version: number; text: string }
  | { method: "apply"; id: string; version: number; changes: DocumentChange[] }
  | { method: "close"; id: string };

/**
 * Fake client recording calls; individual methods can be made to reject.
 * Like the Go engine, applyChanges rejects versions that are not greater
 * than the document's current version.
 */
function fakeClient() {
  const calls: Call[] = [];
  const failures = { open: 0, apply: 0, close: 0 };
  let docVersion = 0;
  const client: UsfmLanguageClient = {
    openDocument(id, version, text) {
      calls.push({ method: "open", id, version, text });
      if (failures.open > 0) {
        failures.open--;
        return Promise.reject(new Error("open failed"));
      }
      docVersion = version;
      return Promise.resolve();
    },
    applyChanges(id, version, changes) {
      calls.push({ method: "apply", id, version, changes });
      if (failures.apply > 0) {
        failures.apply--;
        return Promise.reject(new Error("apply failed"));
      }
      if (version <= docVersion) {
        return Promise.reject(new Error("stale version"));
      }
      docVersion = version;
      return Promise.resolve();
    },
    closeDocument(id) {
      calls.push({ method: "close", id });
      if (failures.close > 0) {
        failures.close--;
        return Promise.reject(new Error("close failed"));
      }
      return Promise.resolve();
    },
    getDiagnostics: () => Promise.resolve({ version: 0, diagnostics: [] }),
    getStructure: () => Promise.resolve({ version: 0, books: [] }),
    classifyDocument: () => Promise.resolve({ version: 0, tokens: [] }),
    classifyRange: () => Promise.resolve({ version: 0, tokens: [] }),
    getCompletions: () => Promise.resolve([]),
    onAnalysis: () => () => {},
  };
  return { client, calls, failures };
}

/** Let the sync's internal promise chain drain. */
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("changesFromChangeSet", () => {
  it("converts a ChangeSet to pre-batch offsets in ascending order", () => {
    const doc = Text.of(["\\id GEN", "\\p hello world"]);
    // Two simultaneous edits addressing the original document.
    const set = ChangeSet.of(
      [
        { from: 4, to: 7, insert: "EXO" },
        { from: 11, insert: "big " },
      ],
      doc.length,
    );
    expect(changesFromChangeSet(set)).toEqual([
      { from: 4, to: 7, text: "EXO" },
      { from: 11, to: 11, text: "big " },
    ]);
  });

  it("returns an empty batch for the empty ChangeSet", () => {
    expect(changesFromChangeSet(ChangeSet.of([], 10))).toEqual([]);
  });
});

describe("DocumentSync", () => {
  it("opens with version 1 and the current text", async () => {
    const { client, calls } = fakeClient();
    const sync = new DocumentSync({ client, id: "doc", getText: () => "\\id GEN" });
    sync.open();
    await settle();
    expect(calls).toEqual([{ method: "open", id: "doc", version: 1, text: "\\id GEN" }]);
    expect(sync.version).toBe(1);
  });

  it("forwards change batches with increasing versions in order", async () => {
    const { client, calls } = fakeClient();
    const sync = new DocumentSync({ client, id: "doc", getText: () => "x" });
    sync.open();
    sync.applyChanges([{ from: 0, to: 0, text: "a" }]);
    sync.applyChanges([{ from: 1, to: 1, text: "b" }]);
    await settle();
    expect(calls.map((c) => c.method)).toEqual(["open", "apply", "apply"]);
    expect(calls.map((c) => "version" in c ? c.version : -1)).toEqual([1, 2, 3]);
  });

  it("accepts a CodeMirror ChangeSet directly", async () => {
    const { client, calls } = fakeClient();
    const sync = new DocumentSync({ client, id: "doc", getText: () => "hello" });
    sync.open();
    sync.applyChanges(ChangeSet.of([{ from: 0, to: 5, insert: "bye" }], 5));
    await settle();
    expect(calls[1]).toEqual({
      method: "apply",
      id: "doc",
      version: 2,
      changes: [{ from: 0, to: 5, text: "bye" }],
    });
  });

  it("skips empty batches without burning a version", async () => {
    const { client, calls } = fakeClient();
    const sync = new DocumentSync({ client, id: "doc", getText: () => "x" });
    sync.open();
    sync.applyChanges([]);
    sync.applyChanges(ChangeSet.of([], 1));
    await settle();
    expect(calls).toHaveLength(1);
    expect(sync.version).toBe(1);
  });

  it("reopens with the current text when an update is rejected", async () => {
    const { client, calls, failures } = fakeClient();
    let text = "old";
    const sync = new DocumentSync({ client, id: "doc", getText: () => text });
    sync.open();
    await settle();
    failures.apply = 1;
    text = "new";
    sync.applyChanges([{ from: 0, to: 3, text: "new" }]);
    await settle();
    expect(calls.map((c) => c.method)).toEqual(["open", "apply", "close", "open"]);
    const reopen = calls[3];
    expect(reopen).toEqual({ method: "open", id: "doc", version: 3, text: "new" });
    expect(sync.version).toBe(3);
  });

  it("recovers even when the close during reopen fails", async () => {
    const { client, calls, failures } = fakeClient();
    const sync = new DocumentSync({ client, id: "doc", getText: () => "t" });
    sync.open();
    await settle();
    failures.apply = 1;
    failures.close = 1;
    sync.applyChanges([{ from: 0, to: 1, text: "u" }]);
    await settle();
    expect(calls.map((c) => c.method)).toEqual(["open", "apply", "close", "open"]);
  });

  it("converges when a reopen strands an already-queued update", async () => {
    const { client, calls, failures } = fakeClient();
    const sync = new DocumentSync({ client, id: "doc", getText: () => "t" });
    sync.open();
    await settle();
    failures.apply = 1;
    sync.applyChanges([{ from: 0, to: 0, text: "a" }]);
    sync.applyChanges([{ from: 0, to: 0, text: "b" }]);
    await settle();
    // apply(v2) fails -> reopen as v3 with the current text, which already
    // contains edit b. The queued apply(v3-assigned-before-reopen... ) is
    // now stale; applying it anyway would double-apply b, so the engine's
    // version gate rejects it and a second reopen converges.
    expect(calls.map((c) => c.method)).toEqual([
      "open", // v1
      "apply", // v2, injected failure
      "close",
      "open", // reopen v4 (v3 was burned by the queued apply)
      "apply", // v3, stale -> rejected by the version gate
      "close",
      "open", // reopen v5: back in sync
    ]);
    const last = calls[6];
    expect("version" in last && last.version).toBe(5);
    expect(sync.version).toBe(5);
  });

  it("closes once and ignores calls after close", async () => {
    const { client, calls } = fakeClient();
    const sync = new DocumentSync({ client, id: "doc", getText: () => "t" });
    sync.open();
    sync.close();
    sync.close();
    sync.applyChanges([{ from: 0, to: 0, text: "a" }]);
    sync.open();
    await settle();
    expect(calls.map((c) => c.method)).toEqual(["open", "close"]);
  });
});
