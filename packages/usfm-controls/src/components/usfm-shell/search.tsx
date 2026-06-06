import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { sourceOffsetToLineColumn } from "./line-offsets.js";
import type { UsfmShellFileEntry } from "./host.js";

export interface SearchMatch {
  readonly fileId: string;
  readonly fileName: string;
  readonly line: number; // 0-based
  readonly column: number; // 0-based
  readonly from: number; // source offset (file)
  readonly to: number; // source offset (file)
  readonly snippet: string;
}

export interface FileSearchProps {
  readonly files: readonly UsfmShellFileEntry[];
  readonly readFile: (fileId: string) => Promise<string | null>;
  readonly onSelectResult: (m: SearchMatch) => void;
  readonly loadingFiles: boolean;
}

interface SearchState {
  readonly query: string;
  readonly matchCase: boolean;
  readonly wholeWord: boolean;
  readonly regex: boolean;
}

function buildRegex(state: SearchState): RegExp | null {
  if (!state.query) return null;
  try {
    const body = state.regex ? state.query : escapeRegExp(state.query);
    const wrapped = state.wholeWord ? `\\b(?:${body})\\b` : body;
    const flags = state.matchCase ? "g" : "gi";
    return new RegExp(wrapped, flags);
  } catch {
    return null;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSnippet(content: string, from: number, to: number): string {
  const lineStart = content.lastIndexOf("\n", from - 1) + 1;
  const lineEndRaw = content.indexOf("\n", to);
  const lineEnd = lineEndRaw < 0 ? content.length : lineEndRaw;
  const lineText = content.slice(lineStart, lineEnd);
  return lineText.length > 200 ? lineText.slice(0, 200) + "…" : lineText;
}

export function FileSearch({ files, readFile, onSelectResult, loadingFiles }: FileSearchProps) {
  const [state, setState] = useState<SearchState>({ query: "", matchCase: false, wholeWord: false, regex: false });
  const [results, setResults] = useState<readonly SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const headingId = useId();

  const update = useCallback(<K extends keyof SearchState>(key: K, value: SearchState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const compiled = useMemo(() => buildRegex(state), [state]);

  const runSearch = useCallback(async () => {
    if (!state.query) {
      setResults([]);
      setInvalid(false);
      return;
    }
    if (!compiled) {
      setInvalid(true);
      setResults([]);
      return;
    }
    setInvalid(false);
    setSearching(true);
    const found: SearchMatch[] = [];
    try {
      for (const entry of files) {
        const content = await readFile(entry.id);
        if (content == null) continue;
        // RegExp instances carry lastIndex state; clone per file.
        const re = new RegExp(compiled.source, compiled.flags);
        let m: RegExpExecArray | null;
        while ((m = re.exec(content))) {
          const from = m.index;
          const to = from + (m[0]?.length ?? 0);
          const { line, column } = sourceOffsetToLineColumn(content, from);
          found.push({
            fileId: entry.id,
            fileName: entry.name,
            line,
            column,
            from,
            to,
            snippet: buildSnippet(content, from, to),
          });
          if (m[0] === "") re.lastIndex++; // guard against zero-width matches
          if (found.length >= 500) break;
        }
        if (found.length >= 500) break;
      }
      setResults(found);
    } finally {
      setSearching(false);
    }
  }, [state.query, compiled, files, readFile]);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="usfm-shell-file-search">
      <div
        id={headingId}
        className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        Search in folder
      </div>
      <form
        className="flex flex-col gap-1 border-b border-gray-200 px-3 py-2 dark:border-gray-700"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <input
          type="text"
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="Search…"
          value={state.query}
          onChange={(e) => update("query", e.target.value)}
          aria-label="Search query"
        />
        <div className="flex gap-1 text-xs">
          <ToggleButton label="Match case" pressed={state.matchCase} onClick={() => update("matchCase", !state.matchCase)}>
            Aa
          </ToggleButton>
          <ToggleButton label="Match whole word" pressed={state.wholeWord} onClick={() => update("wholeWord", !state.wholeWord)}>
            ab
          </ToggleButton>
          <ToggleButton label="Use regular expression" pressed={state.regex} onClick={() => update("regex", !state.regex)}>
            .*
          </ToggleButton>
          <button
            type="submit"
            className="ml-auto rounded border border-gray-300 bg-white px-2 py-0.5 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            disabled={!state.query || searching || loadingFiles}
          >
            Search
          </button>
        </div>
        {invalid ? <div className="text-xs text-red-600 dark:text-red-400">Invalid regular expression</div> : null}
      </form>
      <div className="min-h-0 flex-1 overflow-auto">
        {searching ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Searching…</div>
        ) : results.length === 0 ? (
          state.query && !invalid ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No results</div>
          ) : null
        ) : (
          <ul className="py-1">
            {results.map((r, i) => (
              <li key={`${r.fileId}:${r.from}:${i}`}>
                <button
                  type="button"
                  className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => onSelectResult(r)}
                  data-testid={`usfm-shell-search-result-${i}`}
                >
                  <div className="truncate font-medium text-gray-800 dark:text-gray-200">
                    {r.fileName}{" "}
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      {r.line + 1}:{r.column + 1}
                    </span>
                  </div>
                  <div className="truncate font-mono text-xs text-gray-600 dark:text-gray-400">{r.snippet}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ToggleButton({
  label,
  pressed,
  onClick,
  children,
}: {
  readonly label: string;
  readonly pressed: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded border px-1.5 py-0.5 font-mono ${
        pressed
          ? "border-blue-500 bg-blue-100 text-blue-900 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
