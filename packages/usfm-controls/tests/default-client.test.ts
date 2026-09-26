import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { createDeferredLocalLanguageClient } from "../src/language-service/default-client.js";
import type { AnalysisEvent } from "../src/language-service/protocol.js";

const BAD = "\\id GEN\n\\zzz what\n";

describe("createDeferredLocalLanguageClient", () => {
  it("delivers calls made before the client loads in call order", async () => {
    const c = createDeferredLocalLanguageClient({ analysisDebounceMs: 0 });
    // All issued synchronously, before the dynamic import can resolve.
    const opened = c.openDocument("doc", 1, "\\id GEN\n");
    const applied = c.applyChanges("doc", 2, [{ from: 8, to: 8, text: "\\zzz what\n" }]);
    const diagnostics = c.getDiagnostics("doc");
    await opened;
    await applied;
    const result = await diagnostics;
    expect(result.version).toBe(2);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    await c.closeDocument("doc");
  });

  it("pushes analyses to listeners subscribed before load", async () => {
    const c = createDeferredLocalLanguageClient({ analysisDebounceMs: 0 });
    const event = new Promise<AnalysisEvent>((resolve) => {
      const unsubscribe = c.onAnalysis((e) => {
        unsubscribe();
        resolve(e);
      });
    });
    await c.openDocument("doc", 1, BAD);
    expect((await event).id).toBe("doc");
    await c.closeDocument("doc");
  });

  it("never calls listeners unsubscribed before load", async () => {
    const c = createDeferredLocalLanguageClient({ analysisDebounceMs: 0 });
    const received: AnalysisEvent[] = [];
    c.onAnalysis((e) => received.push(e))();
    const delivered = new Promise<void>((resolve) => {
      c.onAnalysis(() => resolve());
    });
    await c.openDocument("doc", 1, BAD);
    await delivered;
    expect(received).toEqual([]);
    await c.closeDocument("doc");
  });
});
