import type { UsfmLanguageClient } from "./protocol.js";
import type { LocalLanguageClientOptions } from "./local-client.js";

/**
 * {@link UsfmLanguageClient} that loads the in-process TypeScript client
 * (`local-client.ts`, which pulls in the TS parser, preview renderer and
 * language service) on first use via a dynamic import.
 *
 * Components fall back to this when no client is injected. Keeping the
 * fallback behind `import()` lets bundlers split the TS parser into a chunk
 * that applications injecting an engine-backed client (bible-edit) never
 * load; stories, tests and standalone library use pay one module load on
 * first call.
 *
 * Every call is chained on the same load promise, so calls reach the
 * underlying client in the order they were made.
 */
export function createDeferredLocalLanguageClient(
  options?: LocalLanguageClientOptions,
): UsfmLanguageClient {
  let ready: Promise<UsfmLanguageClient> | null = null;
  const load = () =>
    (ready ??= import("./local-client.js").then((m) => m.createLocalLanguageClient(options)));

  return {
    openDocument: (id, version, text) =>
      load().then((c) => c.openDocument(id, version, text)),
    applyChanges: (id, version, changes) =>
      load().then((c) => c.applyChanges(id, version, changes)),
    closeDocument: (id) => load().then((c) => c.closeDocument(id)),
    getDiagnostics: (id) => load().then((c) => c.getDiagnostics(id)),
    getStructure: (id) => load().then((c) => c.getStructure(id)),
    classifyDocument: (id) => load().then((c) => c.classifyDocument(id)),
    classifyRange: (id, from, to) => load().then((c) => c.classifyRange(id, from, to)),
    getCompletions: (id, line, column) =>
      load().then((c) => c.getCompletions(id, line, column)),
    renderPreviewDocument: (id, opts) =>
      load().then((c) => c.renderPreviewDocument(id, opts)),
    renderPreview: (text, opts) => load().then((c) => c.renderPreview(text, opts)),
    onAnalysis(listener) {
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;
      load().then(
        (c) => {
          if (!cancelled) unsubscribe = c.onAnalysis(listener);
        },
        () => {}, // load failures surface through the request methods
      );
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },
  };
}

let shared: UsfmLanguageClient | null = null;

/**
 * Lazily created process-wide local client, used as the default when no
 * client is injected (component stories, tests, standalone library use).
 */
export function sharedLocalLanguageClient(): UsfmLanguageClient {
  shared ??= createDeferredLocalLanguageClient();
  return shared;
}
