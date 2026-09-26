import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  createDocumentSessionManager,
  type SessionViewPort,
} from "../src/language-service/document-sessions.js";
import { applyChangesToText } from "../src/language-service/local-client.js";
import type { DocumentChange, UsfmLanguageClient } from "../src/language-service/protocol.js";

interface Call {
  method: string;
  id?: string;
  version?: number;
  text?: string;
  changes?: DocumentChange[];
}

function recordingClient() {
  const calls: Call[] = [];
  const client: UsfmLanguageClient = {
    openDocument(id, version, text) {
      calls.push({ method: "open", id, version, text });
      return Promise.resolve();
    },
    applyChanges(id, version, changes) {
      calls.push({ method: "apply", id, version, changes });
      return Promise.resolve();
    },
    closeDocument(id) {
      calls.push({ method: "close", id });
      return Promise.resolve();
    },
    getDiagnostics: () => Promise.resolve({ version: 0, diagnostics: [] }),
    getStructure: () => Promise.resolve({ version: 0, books: [] }),
    classifyDocument: () => Promise.resolve({ version: 0, tokens: [] }),
    classifyRange: () => Promise.resolve({ version: 0, tokens: [] }),
    getCompletions: () => Promise.resolve([]),
    renderPreviewDocument: () => Promise.resolve({ version: 0, html: "" }),
    renderPreview: () => Promise.resolve(""),
    onAnalysis: () => () => {},
  };
  return { client, calls };
}

/** Test viewport backed by a plain string buffer. */
function textView(initial: string) {
  const state = { text: initial, received: [] as DocumentChange[][] };
  const view: SessionViewPort = {
    getText: () => state.text,
    applyChanges(changes) {
      state.received.push(changes);
      state.text = applyChangesToText(state.text, changes);
    },
  };
  return { view, state };
}

/** Let queued client calls drain. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("createDocumentSessionManager", () => {
  it("opens one client document shared by all views of a key", async () => {
    const { client, calls } = recordingClient();
    const manager = createDocumentSessionManager(client);
    const a = textView("\\id GEN one");
    const b = textView("stale copy");

    const ma = manager.join("file-1", a.view);
    const mb = manager.join("file-1", b.view);
    await settle();

    expect(mb.documentId).toBe(ma.documentId);
    expect(calls.filter((c) => c.method === "open")).toHaveLength(1);
    expect(calls[0]!.text).toBe("\\id GEN one");
    // Late joiner is told the authoritative text (from the first view).
    expect(ma.initialText).toBeNull();
    expect(mb.initialText).toBe("\\id GEN one");
  });

  it("forwards local edits once to the client and to each sibling", async () => {
    const { client, calls } = recordingClient();
    const manager = createDocumentSessionManager(client);
    const a = textView("hello world");
    const b = textView("hello world");
    const ma = manager.join("f", a.view);
    manager.join("f", b.view);
    await settle();

    const edit: DocumentChange[] = [{ from: 5, to: 5, text: " brave" }];
    a.state.text = "hello brave world";
    ma.applyLocalChanges(edit);
    await settle();

    const applies = calls.filter((c) => c.method === "apply");
    expect(applies).toHaveLength(1);
    expect(applies[0]!.changes).toEqual(edit);
    // The sibling got the batch; the originating view did not.
    expect(b.state.received).toEqual([edit]);
    expect(b.state.text).toBe("hello brave world");
    expect(a.state.received).toEqual([]);
  });

  it("closes the client document when the last view leaves", async () => {
    const { client, calls } = recordingClient();
    const manager = createDocumentSessionManager(client);
    const a = textView("x");
    const b = textView("x");
    const ma = manager.join("f", a.view);
    const mb = manager.join("f", b.view);

    ma.leave();
    await settle();
    expect(calls.filter((c) => c.method === "close")).toHaveLength(0);

    mb.leave();
    await settle();
    expect(calls.filter((c) => c.method === "close")).toHaveLength(1);

    // Rejoining creates a fresh document.
    const mc = manager.join("f", textView("y").view);
    await settle();
    expect(mc.initialText).toBeNull();
    expect(calls.filter((c) => c.method === "open")).toHaveLength(2);
    expect(calls.at(-1)!.text).toBe("y");
  });

  it("ignores forwards from a view that already left", async () => {
    const { client, calls } = recordingClient();
    const manager = createDocumentSessionManager(client);
    const a = textView("x");
    const b = textView("x");
    const ma = manager.join("f", a.view);
    manager.join("f", b.view);
    ma.leave();
    ma.applyLocalChanges([{ from: 0, to: 0, text: "y" }]);
    await settle();
    expect(calls.filter((c) => c.method === "apply")).toHaveLength(0);
    expect(b.state.received).toEqual([]);
    await expect(ma.request(() => Promise.resolve(1))).rejects.toThrow("left");
  });

  it("keeps versions monotonic across views", async () => {
    const { client, calls } = recordingClient();
    const manager = createDocumentSessionManager(client);
    const a = textView("x");
    const b = textView("x");
    const ma = manager.join("f", a.view);
    const mb = manager.join("f", b.view);
    a.state.text = "xa";
    ma.applyLocalChanges([{ from: 1, to: 1, text: "a" }]);
    b.state.text = "xab";
    mb.applyLocalChanges([{ from: 2, to: 2, text: "b" }]);
    await settle();
    const versions = calls
      .filter((c) => c.method === "open" || c.method === "apply")
      .map((c) => c.version);
    expect(versions).toEqual([1, 2, 3]);
    expect(ma.version).toBe(3);
    expect(mb.version).toBe(3);
  });
});
