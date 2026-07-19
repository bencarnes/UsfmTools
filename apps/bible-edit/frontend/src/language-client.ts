import type {
  AnalysisEvent,
  CompletionItem,
  DiagnosticsResult,
  DocumentChange,
  PreviewResult,
  StructureResult,
  TokensResult,
  UsfmLanguageClient,
} from "@usfm-tools/controls";
import {
  ApplyChanges,
  ClassifyDocument,
  ClassifyRange,
  CloseDocument,
  GetCompletions,
  GetDiagnostics,
  GetStructure,
  OpenDocument,
  RenderPreviewDocument,
  RenderPreviewText,
} from "../wailsjs/go/main/UsfmService.js";
import { EventsOff, EventsOn } from "../wailsjs/runtime/runtime.js";
import type { engine } from "../wailsjs/go/models";

/** Wails event name pushed by the Go engine (UsfmService in app Go code). */
const ANALYSIS_EVENT = "usfm:analysis";

/**
 * {@link UsfmLanguageClient} backed by the Go USFM engine through the Wails
 * bindings. Document copies, parsing, and analysis all live in the Go
 * process; this adapter forwards lifecycle calls and feature pulls, and
 * fans pushed analyses out to subscribers.
 *
 * The generated binding types differ from the protocol only nominally
 * (enum-typed fields arrive as plain numbers/strings), so responses are
 * cast rather than copied.
 */
export function createWailsLanguageClient(): UsfmLanguageClient {
  const listeners = new Set<(event: AnalysisEvent) => void>();
  let subscribed = false;

  return {
    openDocument(id: string, version: number, text: string): Promise<void> {
      return OpenDocument(id, version, text);
    },

    applyChanges(id: string, version: number, changes: DocumentChange[]): Promise<void> {
      // DocumentChange is structurally an engine.Change; Wails serializes
      // plain objects the same way.
      return ApplyChanges(id, version, changes as engine.Change[]);
    },

    closeDocument(id: string): Promise<void> {
      return CloseDocument(id);
    },

    async getDiagnostics(id: string): Promise<DiagnosticsResult> {
      return (await GetDiagnostics(id)) as unknown as DiagnosticsResult;
    },

    async getStructure(id: string): Promise<StructureResult> {
      return (await GetStructure(id)) as unknown as StructureResult;
    },

    async classifyDocument(id: string): Promise<TokensResult> {
      return (await ClassifyDocument(id)) as unknown as TokensResult;
    },

    async classifyRange(id: string, from: number, to: number): Promise<TokensResult> {
      return (await ClassifyRange(id, from, to)) as unknown as TokensResult;
    },

    async getCompletions(id: string, line: number, column: number): Promise<CompletionItem[]> {
      return (await GetCompletions(id, line, column)) ?? [];
    },

    async renderPreviewDocument(
      id: string,
      options?: { versePerLine?: boolean },
    ): Promise<PreviewResult> {
      return await RenderPreviewDocument(id, options?.versePerLine ?? false);
    },

    renderPreview(text: string, options?: { versePerLine?: boolean }): Promise<string> {
      return RenderPreviewText(text, options?.versePerLine ?? false);
    },

    onAnalysis(listener: (event: AnalysisEvent) => void): () => void {
      listeners.add(listener);
      if (!subscribed) {
        subscribed = true;
        EventsOn(ANALYSIS_EVENT, (event: AnalysisEvent) => {
          for (const l of [...listeners]) l(event);
        });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && subscribed) {
          subscribed = false;
          EventsOff(ANALYSIS_EVENT);
        }
      };
    },
  };
}
