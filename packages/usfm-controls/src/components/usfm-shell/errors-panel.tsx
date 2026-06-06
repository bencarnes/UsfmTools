import type { Diagnostic } from "../../language-service/protocol.js";

export interface ErrorsPanelProps {
  readonly activeFileName: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly onSelectDiagnostic: (d: Diagnostic) => void;
  readonly loading: boolean;
}

export function ErrorsPanel({ activeFileName, diagnostics, onSelectDiagnostic, loading }: ErrorsPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="usfm-shell-errors-panel">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-1 text-xs uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        {activeFileName ? `Errors — ${activeFileName}` : "Errors"}
        {diagnostics.length > 0 ? (
          <span
            className="ml-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
            data-testid="usfm-shell-errors-count"
          >
            {diagnostics.length}
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Checking…</div>
        ) : !activeFileName ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No file open</div>
        ) : diagnostics.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No errors</div>
        ) : (
          <ul className="py-1">
            {diagnostics.map((d, i) => (
              <li key={`${d.range.start.line}:${d.range.start.column}:${i}`}>
                <button
                  type="button"
                  className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => onSelectDiagnostic(d)}
                  data-testid={`usfm-shell-error-${i}`}
                >
                  <span className="mr-2 inline-block min-w-[3.5rem] font-mono text-xs text-gray-500 dark:text-gray-400">
                    {d.range.start.line + 1}:{d.range.start.column + 1}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">{d.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
