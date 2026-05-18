export { UsfmEditor } from "./components/usfm-editor/index.js";
export type { UsfmEditorProps } from "./components/usfm-editor/index.js";
export {
  UsfmLanguageService,
  createLanguageClient,
  DiagnosticSeverity,
  TokenType,
} from "./language-service/index.js";
export type {
  RequestMessage,
  ResponseMessage,
  Position,
  Range,
  Diagnostic,
  CompletionItem,
  TokenClassification,
} from "./language-service/index.js";
