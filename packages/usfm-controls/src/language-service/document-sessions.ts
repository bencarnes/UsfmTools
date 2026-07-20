import { changesFromChangeSet, DocumentSync, type ChangeSetLike } from "./document-sync.js";
import type { DocumentChange, UsfmLanguageClient } from "./protocol.js";

/** A live editor buffer participating in a shared document session. */
export interface SessionViewPort {
  /** Current full text of this view's buffer. */
  getText(): string;
  /**
   * Apply changes made in a sibling view of the same document. The batch
   * follows the {@link DocumentChange} convention (offsets into the
   * pre-batch document, ascending, non-overlapping). Implementations must
   * not report these changes back through `applyLocalChanges`.
   */
  applyChanges(changes: DocumentChange[]): void;
}

/** One view's handle on a shared document session. */
export interface DocumentSessionMembership {
  /** Language-client document id shared by every view of this key. */
  readonly documentId: string;
  /** Version of the last update forwarded to the client (monotonic). */
  readonly version: number;
  /**
   * Authoritative document text at join time when other views were already
   * attached — the joining view must replace its buffer with it (the copy it
   * was created from, e.g. the workspace model, may lag the live sibling
   * buffer). `null` when this view is the first: its own text seeds the
   * session.
   */
  readonly initialText: string | null;
  /**
   * Forward changes made locally in this view: to the client once, and to
   * each sibling view synchronously.
   */
  applyLocalChanges(changes: ChangeSetLike | DocumentChange[]): void;
  /** Feature request ordered after all edits forwarded so far (any view). */
  request<T>(task: () => Promise<T>): Promise<T>;
  /** Detach this view. The last view leaving closes the client document. */
  leave(): void;
}

/**
 * Shares one language-client document per document key among all editor
 * views showing that document (e.g. the same file open in two workspace tab
 * groups). Compared with one document per editor view, the document is
 * parsed once per edit instead of once per view, each edit crosses the
 * client boundary once, and sibling views converge synchronously instead of
 * through debounced state echoes.
 */
export interface DocumentSessionManager {
  /**
   * Join (creating if needed) the shared document for `key`. The manager
   * must have been created for the same {@link UsfmLanguageClient} the
   * caller uses for feature requests.
   */
  join(key: string, view: SessionViewPort): DocumentSessionMembership;
}

interface Session {
  readonly documentId: string;
  readonly sync: DocumentSync;
  readonly views: SessionViewPort[];
}

export function createDocumentSessionManager(
  client: UsfmLanguageClient,
): DocumentSessionManager {
  const sessions = new Map<string, Session>();

  return {
    join(key, view) {
      let session = sessions.get(key);
      let initialText: string | null = null;
      if (session) {
        // The first attached view's buffer is the authoritative text.
        initialText = session.views[0]?.getText() ?? null;
        session.views.push(view);
      } else {
        const documentId = `usfm-doc-${crypto.randomUUID()}`;
        const views: SessionViewPort[] = [view];
        const created: Session = {
          documentId,
          views,
          sync: new DocumentSync({
            client,
            id: documentId,
            getText: () => views[0]?.getText() ?? "",
          }),
        };
        session = created;
        sessions.set(key, created);
        created.sync.open();
      }

      const s = session;
      let left = false;
      return {
        documentId: s.documentId,
        get version() {
          return s.sync.version;
        },
        initialText,
        applyLocalChanges(changes) {
          if (left) return;
          const batch = Array.isArray(changes) ? changes : changesFromChangeSet(changes);
          if (batch.length === 0) return;
          s.sync.applyChanges(batch);
          for (const sibling of s.views) {
            if (sibling !== view) sibling.applyChanges(batch);
          }
        },
        request(task) {
          if (left) return Promise.reject(new Error(`view left document: ${s.documentId}`));
          return s.sync.request(task);
        },
        leave() {
          if (left) return;
          left = true;
          const i = s.views.indexOf(view);
          if (i >= 0) s.views.splice(i, 1);
          if (s.views.length === 0) {
            s.sync.close();
            sessions.delete(key);
          }
        },
      };
    },
  };
}
