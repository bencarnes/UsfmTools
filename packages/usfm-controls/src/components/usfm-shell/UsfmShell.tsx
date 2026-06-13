import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createLanguageClient } from "../../language-service/service.js";
import type { Diagnostic } from "../../language-service/protocol.js";
import { UsfmWorkspace } from "../usfm-workspace/UsfmWorkspace.js";
import {
  buildWorkspaceModelFromInitialTabs,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceOpenSettingsTab,
  workspaceRequestTabSelection,
  SETTINGS_TAB_ID,
  workspaceSetTabValue,
  type UsfmWorkspaceModel,
} from "../usfm-workspace/workspace-model.js";
import { SettingsProvider } from "../settings-pane/settings-context.js";
import { FileBrowser } from "./file-browser.js";
import { FileSearch, type SearchMatch } from "./search.js";
import { ErrorsPanel } from "./errors-panel.js";
import {
  BugIcon,
  CollapseDownIcon,
  CollapseLeftIcon,
  DocIcon,
  ExpandRightIcon,
  ExpandUpIcon,
  GearIcon,
  SearchIcon,
} from "./shell-icons.js";
import { lineColumnToSourceOffset } from "./line-offsets.js";
import type { UsfmFilePickerFileInput } from "@usfm-tools/model";
import type { UsfmShellFileEntry, UsfmShellHost, UsfmShellRecentFolder } from "./host.js";

export interface UsfmShellProps {
  readonly host: UsfmShellHost;
  /** Initial expanded state for the left sidebar. Default `true`. */
  readonly defaultSidebarExpanded?: boolean;
  /** Initial expanded state for the bottom bar. Default `true`. */
  readonly defaultBottomExpanded?: boolean;
  readonly className?: string;
}

type SidebarTab = "files" | "search";
type BottomTab = "errors";

const VALIDATE_DEBOUNCE_MS = 250;

export function UsfmShell({
  host,
  defaultSidebarExpanded = true,
  defaultBottomExpanded = true,
  className,
}: UsfmShellProps) {
  const [model, setModel] = useState<UsfmWorkspaceModel>(() => buildWorkspaceModelFromInitialTabs([]));
  const [files, setFiles] = useState<readonly UsfmFilePickerFileInput[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [folderRevision, setFolderRevision] = useState(0);
  const [recentFolders, setRecentFolders] = useState<readonly UsfmShellRecentFolder[]>([]);
  const [folderLabel, setFolderLabel] = useState(host.label);
  const [folderPath, setFolderPath] = useState(host.folderPath);

  const [sidebarExpanded, setSidebarExpanded] = useState(defaultSidebarExpanded);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [bottomExpanded, setBottomExpanded] = useState(defaultBottomExpanded);
  const [bottomTab, setBottomTab] = useState<BottomTab>("errors");

  const [focusedTabId, setFocusedTabId] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<readonly Diagnostic[]>([]);
  const [validating, setValidating] = useState(false);

  const clientRef = useRef(createLanguageClient());
  const validateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load file list and USFM bodies from host (picker grouping needs \\id from each file).
  useEffect(() => {
    let cancelled = false;
    setFilesLoading(true);
    setFolderLabel(host.label);
    setFolderPath(host.folderPath);
    void host.listRecentFolders().then((recent) => {
      if (!cancelled) setRecentFolders(recent);
    });
    host
      .listFiles()
      .then(async (list) => {
        if (cancelled) return;
        const withUsfm = await Promise.all(
          list.map(async (entry) => ({
            id: entry.id,
            name: entry.name,
            usfm: (await host.readFile(entry.id)) ?? "",
          })),
        );
        if (!cancelled) setFiles(withUsfm);
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [host, folderRevision]);

  const refreshFolder = useCallback(() => {
    setFolderRevision((v) => v + 1);
  }, []);

  const handleOpenFolder = useCallback(
    (path: string) => {
      void host.openFolder(path).then(refreshFolder);
    },
    [host, refreshFolder],
  );

  const handlePickFolder = useCallback(() => {
    void host.pickFolder().then(refreshFolder);
  }, [host, refreshFolder]);

  // Track first active tab as the focused tab when the workspace is non-empty.
  useEffect(() => {
    if (focusedTabId && model.tabsById[focusedTabId]) return;
    for (const slot of model.slots) {
      if (slot.activeTabId) {
        setFocusedTabId(slot.activeTabId);
        return;
      }
    }
    setFocusedTabId(null);
  }, [model, focusedTabId]);

  const focusedTab = focusedTabId ? model.tabsById[focusedTabId] ?? null : null;
  const focusedValue = focusedTab?.value ?? "";
  const focusedFileName = focusedTab?.fileName ?? null;

  // Re-validate when the focused tab's content (or identity) changes.
  useEffect(() => {
    // Only editor tabs carry USFM to validate; settings (and other non-editor panes) have none.
    if (!focusedTab || focusedTab.kind === "settings") {
      setDiagnostics([]);
      return;
    }
    if (validateDebounceRef.current) clearTimeout(validateDebounceRef.current);
    setValidating(true);
    const tabId = focusedTab.id;
    const content = focusedTab.value;
    validateDebounceRef.current = setTimeout(() => {
      validateDebounceRef.current = null;
      void clientRef.current.validate(content).then((diags) => {
        // Drop late results from a stale tab.
        if (tabId !== focusedTab.id) return;
        setDiagnostics(diags);
        setValidating(false);
      });
    }, VALIDATE_DEBOUNCE_MS);
    return () => {
      if (validateDebounceRef.current) {
        clearTimeout(validateDebounceRef.current);
        validateDebounceRef.current = null;
      }
    };
  }, [focusedTab]);

  // ---- workspace callbacks ----

  const handleActivateTab = useCallback((groupId: string, tabId: string) => {
    setModel((p) => workspaceActivateTab(p, groupId, tabId));
    setFocusedTabId(tabId);
  }, []);

  const handleUpdateTabValue = useCallback((tabId: string, value: string) => {
    setModel((p) => workspaceSetTabValue(p, tabId, value));
  }, []);

  const handleCloseTab = useCallback(
    (groupId: string, tabId: string) => {
      setModel((p) => workspaceCloseTab(p, groupId, tabId));
      if (focusedTabId === tabId) setFocusedTabId(null);
    },
    [focusedTabId],
  );

  const handleReorderTabInGroup = useCallback(
    (groupId: string, tabId: string, toIndex: number) =>
      setModel((p) => workspaceReorderTabInGroup(p, groupId, tabId, toIndex)),
    [],
  );

  const handleMoveTabToGroup = useCallback(
    (detail: { tabId: string; fromGroupId: string; toGroupId: string; insertIndex: number }) =>
      setModel((p) => workspaceMoveTabToGroup(p, detail)),
    [],
  );

  const handleOpenSettings = useCallback(() => {
    setModel((p) => workspaceOpenSettingsTab(p));
    setFocusedTabId(SETTINGS_TAB_ID);
  }, []);

  // ---- file open / focus ----

  const shellFileEntries = useMemo<readonly UsfmShellFileEntry[]>(
    () => files.map((f) => ({ id: f.id, name: f.name })),
    [files],
  );

  const openFile = useCallback(
    async (entry: UsfmFilePickerFileInput, opts?: { readonly selection?: { from: number; to: number } }) => {
      const existingTabId = entry.id;

      // If a tab with the file id already exists, focus it.
      let groupHoldingTab: string | null = null;
      for (const slot of model.slots) {
        if (slot.tabIds.includes(existingTabId)) {
          groupHoldingTab = slot.id;
          break;
        }
      }
      if (groupHoldingTab) {
        setModel((p) => {
          let next = workspaceActivateTab(p, groupHoldingTab!, existingTabId);
          if (opts?.selection) {
            next = workspaceRequestTabSelection(next, existingTabId, opts.selection.from, opts.selection.to);
          }
          return next;
        });
        setFocusedTabId(existingTabId);
        return;
      }

      const usfm = entry.usfm || (await host.readFile(entry.id));
      if (usfm == null) return;
      const targetGroupId = model.slots[0]?.id;
      if (!targetGroupId) return;

      setModel((p) => {
        let next = workspaceAppendTab(p, {
          groupId: targetGroupId,
          tab: { id: existingTabId, fileName: entry.name, value: usfm },
        });
        if (opts?.selection) {
          next = workspaceRequestTabSelection(next, existingTabId, opts.selection.from, opts.selection.to);
        }
        return next;
      });
      setFocusedTabId(existingTabId);
    },
    [host, model.slots],
  );

  // ---- search ----

  const onSelectSearchResult = useCallback(
    (m: SearchMatch) => {
      const full = files.find((f) => f.id === m.fileId);
      if (full) void openFile(full, { selection: { from: m.from, to: m.to } });
    },
    [files, openFile],
  );

  // ---- errors ----

  const onSelectDiagnostic = useCallback(
    (d: Diagnostic) => {
      if (!focusedTabId) return;
      const offset = lineColumnToSourceOffset(focusedValue, d.range.start.line, d.range.start.column);
      setModel((p) => workspaceRequestTabSelection(p, focusedTabId, offset, offset));
    },
    [focusedTabId, focusedValue],
  );

  const activeFileIdForBrowser = focusedTab && files.some((f) => f.id === focusedTab.id) ? focusedTab.id : null;

  const sidebarTabs = useMemo<readonly { id: SidebarTab; label: string; Icon: (p: { label?: string }) => ReactElement }[]>(
    () => [
      { id: "files", label: "Files", Icon: DocIcon },
      { id: "search", label: "Search", Icon: SearchIcon },
    ],
    [],
  );

  const bottomTabs = useMemo<readonly { id: BottomTab; label: string; Icon: (p: { label?: string }) => ReactElement }[]>(
    () => [{ id: "errors", label: "Errors", Icon: BugIcon }],
    [],
  );

  return (
    <SettingsProvider host={host}>
      <div
        data-testid="usfm-shell"
        className={`flex h-full min-h-0 min-w-0 flex-row bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 ${className ?? ""}`}
      >
      {/* Left sidebar — vertical tab rail + (when expanded) tab panel, spanning full height */}
      <aside
        className="flex min-h-0 shrink-0 flex-row border-r border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800"
        data-testid="usfm-shell-sidebar"
        aria-expanded={sidebarExpanded}
      >
        <div
          role="tablist"
          aria-orientation="vertical"
          className="flex w-10 shrink-0 flex-col items-stretch border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        >
          {sidebarTabs.map(({ id, label, Icon }) => {
            const selected = sidebarTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={label}
                title={label}
                onClick={() => {
                  if (!sidebarExpanded) setSidebarExpanded(true);
                  setSidebarTab(id);
                }}
                className={`flex h-10 items-center justify-center border-l-2 ${
                  selected && sidebarExpanded
                    ? "border-blue-600 bg-white text-gray-900 dark:border-blue-400 dark:bg-gray-900 dark:text-gray-100"
                    : "border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
                data-testid={`usfm-shell-sidebar-tab-${id}`}
              >
                <Icon />
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            type="button"
            className="flex h-10 items-center justify-center text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Settings"
            title="Settings"
            onClick={handleOpenSettings}
            data-testid="usfm-shell-sidebar-settings"
          >
            <GearIcon />
          </button>
          <button
            type="button"
            className="flex h-10 items-center justify-center text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-pressed={!sidebarExpanded}
            title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setSidebarExpanded((v) => !v)}
            data-testid="usfm-shell-sidebar-toggle"
          >
            {sidebarExpanded ? <CollapseLeftIcon /> : <ExpandRightIcon />}
          </button>
        </div>
        {sidebarExpanded ? (
          <div className="flex min-h-0 w-64 flex-col bg-white dark:bg-gray-900" data-testid="usfm-shell-sidebar-panel">
            {sidebarTab === "files" ? (
              <FileBrowser
                files={files}
                activeFileId={activeFileIdForBrowser}
                onOpenFile={(entry) => void openFile(entry)}
                loading={filesLoading}
                folderLabel={folderLabel}
                folderPath={folderPath}
                recentFolders={recentFolders}
                onOpenFolder={handleOpenFolder}
                onPickFolder={handlePickFolder}
              />
            ) : (
              <FileSearch
                files={shellFileEntries}
                readFile={(id) => host.readFile(id)}
                onSelectResult={onSelectSearchResult}
                loadingFiles={filesLoading}
              />
            )}
          </div>
        ) : null}
      </aside>

      {/* Right column — workspace stacked above the bottom bar (bottom bar does not span under sidebar) */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-gray-900" data-testid="usfm-shell-workspace-host">
          <UsfmWorkspace
            gridRows={model.gridRows}
            gridCols={model.gridCols}
            slots={model.slots}
            tabsById={model.tabsById}
            onActivateTab={handleActivateTab}
            onUpdateTabValue={handleUpdateTabValue}
            onCloseTab={handleCloseTab}
            onReorderTabInGroup={handleReorderTabInGroup}
            onMoveTabToGroup={handleMoveTabToGroup}
            className="min-h-0 flex-1"
          />
        </main>

        <section
          className="flex shrink-0 flex-col border-t border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800"
          data-testid="usfm-shell-bottom-bar"
          aria-expanded={bottomExpanded}
        >
          <div
            role="tablist"
            aria-orientation="horizontal"
            className="flex h-8 shrink-0 items-stretch border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
          >
            {bottomTabs.map(({ id, label, Icon }) => {
              const selected = bottomTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={label}
                  title={label}
                  onClick={() => {
                    if (!bottomExpanded) setBottomExpanded(true);
                    setBottomTab(id);
                  }}
                  className={`flex w-10 items-center justify-center border-t-2 ${
                    selected && bottomExpanded
                      ? "border-blue-600 bg-white text-gray-900 dark:border-blue-400 dark:bg-gray-900 dark:text-gray-100"
                      : "border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                  data-testid={`usfm-shell-bottom-tab-${id}`}
                >
                  <Icon />
                  {id === "errors" && diagnostics.length > 0 ? (
                    <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                      {diagnostics.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
            <div className="flex-1" />
            <button
              type="button"
              className="flex w-10 items-center justify-center text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label={bottomExpanded ? "Collapse bottom bar" : "Expand bottom bar"}
              aria-pressed={!bottomExpanded}
              title={bottomExpanded ? "Collapse bottom bar" : "Expand bottom bar"}
              onClick={() => setBottomExpanded((v) => !v)}
              data-testid="usfm-shell-bottom-toggle"
            >
              {bottomExpanded ? <CollapseDownIcon /> : <ExpandUpIcon />}
            </button>
          </div>
          {bottomExpanded ? (
            <div
              className="flex h-48 min-h-0 flex-col bg-white dark:bg-gray-900"
              data-testid="usfm-shell-bottom-panel"
            >
              {bottomTab === "errors" ? (
                <ErrorsPanel
                  activeFileName={focusedFileName}
                  diagnostics={diagnostics}
                  onSelectDiagnostic={onSelectDiagnostic}
                  loading={validating}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
      </div>
    </SettingsProvider>
  );
}
