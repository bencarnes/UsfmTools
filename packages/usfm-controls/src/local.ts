/**
 * @usfm-tools/controls/local
 *
 * In-process TypeScript implementations backed by the reference TS parser
 * (`@usfm-tools/parser`): the local language client and service, the
 * publication preview renderer, and the parse-based book picker.
 *
 * Kept out of the main entry point so applications that inject an
 * engine-backed {@link UsfmLanguageClient} (bible-edit) don't bundle the TS
 * parser. Components that need a fallback client load this implementation
 * lazily (see `createDeferredLocalLanguageClient`).
 */

export type { UsfmLanguageClient } from "./language-service/protocol.js";
export {
  applyChangesToText,
  createLocalLanguageClient,
} from "./language-service/local-client.js";
export type { LocalLanguageClientOptions } from "./language-service/local-client.js";
export { UsfmLanguageService, createLanguageClient } from "./language-service/service.js";

export { UsfmBookPicker } from "./components/usfm-book-picker/index.js";
export type {
  UsfmBookPickerProps,
  UsfmBookPickerSelectDetail,
} from "./components/usfm-book-picker/index.js";

export {
  renderPreviewHtml,
  ViewModels,
  PublicationViewModel,
  buildUsfmBookPickerGroups,
} from "@usfm-tools/model";
export type { RenderPreviewOptions } from "@usfm-tools/model";
