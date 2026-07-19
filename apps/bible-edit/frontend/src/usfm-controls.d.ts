declare module "@usfm-tools/controls" {
  import type { ComponentType, ReactNode, Ref } from "react";

  export type UiTheme = "light" | "dark" | "system";

  export interface ApplicationSettings {
    readonly theme: UiTheme;
  }

  export interface UsfmShellFileEntry {
    readonly id: string;
    readonly name: string;
  }

  export interface UsfmShellRecentFolder {
    readonly path: string;
    readonly label: string;
  }

  export interface UsfmShellHost {
    readonly label: string;
    readonly folderPath: string;
    listRecentFolders(): Promise<readonly UsfmShellRecentFolder[]>;
    openFolder(path: string): Promise<void>;
    pickFolder(): Promise<void>;
    listFiles(): Promise<readonly UsfmShellFileEntry[]>;
    readFile(fileId: string): Promise<string | null>;
    readFilePickerHeader?(fileId: string): Promise<string | null>;
    writeFile?(fileId: string, content: string): Promise<void>;
    loadSettings(): Promise<ApplicationSettings | null>;
    saveSettings(settings: ApplicationSettings): Promise<void>;
  }

  export interface UsfmShellHandle {
    confirmExit(): Promise<boolean>;
    hasUnsavedChanges(): boolean;
  }

  export interface UsfmShellProps {
    readonly host: UsfmShellHost;
    readonly languageClient?: UsfmLanguageClient;
    readonly defaultSidebarExpanded?: boolean;
    readonly defaultBottomExpanded?: boolean;
    readonly className?: string;
    readonly ref?: Ref<UsfmShellHandle>;
  }

  export const UsfmShell: ComponentType<UsfmShellProps>;

  // --- USFM language client (language-service/protocol.ts) ---

  export interface Position {
    line: number;
    column: number;
    offset?: number;
    byte?: number;
  }

  export interface Range {
    start: Position;
    end: Position;
  }

  export enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Info = 3,
    Hint = 4,
  }

  export interface Diagnostic {
    range: Range;
    message: string;
    severity: DiagnosticSeverity;
    code?: string;
  }

  export interface CompletionItem {
    label: string;
    detail?: string;
    insertText: string;
  }

  export enum TokenType {
    Marker = "marker",
    EndMarker = "endMarker",
    Text = "text",
    Attribute = "attribute",
    AttributeValue = "attributeValue",
    VerseNumber = "verseNumber",
    ChapterNumber = "chapterNumber",
    Caller = "caller",
  }

  export interface TokenClassification {
    range: Range;
    type: TokenType;
  }

  export interface DocumentChange {
    from: number;
    to: number;
    text: string;
  }

  export interface DiagnosticsResult {
    version: number;
    diagnostics: Diagnostic[];
  }

  export interface TokensResult {
    version: number;
    tokens: TokenClassification[];
  }

  export interface ChapterInfo {
    number: string;
    position: Position;
  }

  export interface BookInfo {
    code: string;
    description?: string;
    position: Position;
    chapters: ChapterInfo[];
  }

  export interface StructureResult {
    version: number;
    books: BookInfo[];
  }

  export type AnalysisEvent = { id: string } & DiagnosticsResult;

  export interface PreviewOptions {
    versePerLine?: boolean;
  }

  export interface PreviewResult {
    version: number;
    html: string;
  }

  export interface UsfmLanguageClient {
    openDocument(id: string, version: number, text: string): Promise<void>;
    applyChanges(id: string, version: number, changes: DocumentChange[]): Promise<void>;
    closeDocument(id: string): Promise<void>;
    getDiagnostics(id: string): Promise<DiagnosticsResult>;
    getStructure(id: string): Promise<StructureResult>;
    classifyDocument(id: string): Promise<TokensResult>;
    classifyRange(id: string, from: number, to: number): Promise<TokensResult>;
    getCompletions(id: string, line: number, column: number): Promise<CompletionItem[]>;
    renderPreviewDocument(id: string, options?: PreviewOptions): Promise<PreviewResult>;
    renderPreview(text: string, options?: PreviewOptions): Promise<string>;
    onAnalysis(listener: (event: AnalysisEvent) => void): () => void;
  }

  export type ResolvedTheme = "light" | "dark";

  export interface SystemThemeSource {
    get(): ResolvedTheme;
    subscribe(listener: (theme: ResolvedTheme) => void): () => void;
  }

  export function setSystemThemeSource(source: SystemThemeSource): void;
}

declare module "@usfm-tools/controls/styles.css";
