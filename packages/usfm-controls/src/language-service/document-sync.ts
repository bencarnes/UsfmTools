import type { DocumentChange, UsfmLanguageClient } from "./protocol.js";

/**
 * The subset of CodeMirror's ChangeSet that document sync needs, typed
 * structurally so this layer stays free of CodeMirror dependencies.
 */
export interface ChangeSetLike {
  iterChanges(
    f: (
      fromA: number,
      toA: number,
      fromB: number,
      toB: number,
      inserted: { toString(): string },
    ) => void,
  ): void;
}

/**
 * Convert a CodeMirror ChangeSet to a protocol edit batch. iterChanges
 * reports pre-batch offsets sorted ascending, which is exactly the
 * DocumentChange convention, so this is a straight copy.
 */
export function changesFromChangeSet(changes: ChangeSetLike): DocumentChange[] {
  const out: DocumentChange[] = [];
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    out.push({ from: fromA, to: toA, text: inserted.toString() });
  });
  return out;
}

export interface DocumentSyncOptions {
  client: UsfmLanguageClient;
  /** Stable document identifier (e.g. the file path). */
  id: string;
  /**
   * Current full document text; used to open the client's copy and to
   * recover by reopening if an incremental update is rejected.
   */
  getText: () => string;
}

/**
 * Keeps one editor document in sync with a {@link UsfmLanguageClient}.
 *
 * The editor calls {@link open} once, {@link applyChanges} with each
 * CodeMirror change set, and {@link close} when done — all synchronous
 * fire-and-forget; the client calls run in order on an internal promise
 * chain and assign monotonically increasing versions. If an incremental
 * update is rejected (protocol drift, engine restart), the document is
 * reopened from the editor's current text so sync self-heals.
 */
export class DocumentSync {
  readonly id: string;
  #client: UsfmLanguageClient;
  #getText: () => string;
  #version = 0;
  #queue: Promise<void> = Promise.resolve();
  #closed = false;

  constructor(options: DocumentSyncOptions) {
    this.id = options.id;
    this.#client = options.client;
    this.#getText = options.getText;
  }

  /**
   * The version most recently assigned to the document. Results whose
   * version equals this are up to date with everything forwarded so far.
   */
  get version(): number {
    return this.#version;
  }

  /** Open the document in the client with the editor's current text. */
  open(): void {
    if (this.#closed) return;
    const version = ++this.#version;
    this.#enqueue(() => this.#client.openDocument(this.id, version, this.#getText()));
  }

  /** Forward one editor change set (or a prepared batch) to the client. */
  applyChanges(changes: ChangeSetLike | DocumentChange[]): void {
    if (this.#closed) return;
    const batch = Array.isArray(changes) ? changes : changesFromChangeSet(changes);
    if (batch.length === 0) return;
    const version = ++this.#version;
    this.#enqueue(async () => {
      try {
        await this.#client.applyChanges(this.id, version, batch);
      } catch (err) {
        console.warn(
          `usfm document sync: update v${version} rejected for ${this.id}; reopening`,
          err,
        );
        await this.#reopen();
      }
    });
  }

  /**
   * Run a feature request ordered after everything forwarded so far, so the
   * client has seen all preceding edits when the task runs. Rejects
   * immediately once the document is closed.
   */
  request<T>(task: () => Promise<T>): Promise<T> {
    if (this.#closed) {
      return Promise.reject(new Error(`document closed: ${this.id}`));
    }
    const result = this.#queue.then(task, task);
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Close the document in the client. Further calls are ignored. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#enqueue(() => this.#client.closeDocument(this.id));
  }

  /** Recover from a rejected update: close (best-effort) and reopen with
   * the editor's current text under a fresh, still-increasing version. */
  async #reopen(): Promise<void> {
    if (this.#closed) return;
    try {
      await this.#client.closeDocument(this.id);
    } catch {
      // Not open (e.g. engine restarted) — reopen below regardless.
    }
    if (this.#closed) return;
    const version = ++this.#version;
    try {
      await this.#client.openDocument(this.id, version, this.#getText());
    } catch (err) {
      // Client unavailable; the next applyChanges will retry via #reopen.
      // Until then the client's copy is out of sync (stale positions in
      // classifications/diagnostics), so make the failure visible.
      console.error(
        `usfm document sync: reopen failed for ${this.id}; language features may be stale`,
        err,
      );
    }
  }

  /** Run task after all previously queued tasks, keeping the chain alive
   * even when a task rejects. */
  #enqueue(task: () => Promise<void>): void {
    this.#queue = this.#queue.then(task, task);
  }
}
