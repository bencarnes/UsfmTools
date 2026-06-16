import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import { createLanguageClient } from "../../language-service/service.js";
import type { Diagnostic } from "../../language-service/protocol.js";
import { UsfmWorkspace } from "../usfm-workspace/UsfmWorkspace.js";
import { dropTargetAtPoint } from "../usfm-workspace/drop-target.js";
import {
  buildWorkspaceModelFromInitialTabs,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceOpenSettingsTab,
  workspaceRequestTabSelection,
  workspaceSetGridLayout,
  SETTINGS_TAB_ID,
  workspaceSetTabValue,
  workspaceSetTabDirty,
  workspaceMarkTabSaved,
  workspaceListDirtyEditorTabs,
  type UsfmWorkspaceModel,
  type WorkspaceGridDimension,
} from "../usfm-workspace/workspace-model.js";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog.js";
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
import type { UsfmFilePickerGroups } from "@usfm-tools/model";
import type { UsfmShellFileEntry, UsfmShellHost, UsfmShellRecentFolder } from "./host.js";
import { buildUsfmFilePickerCatalog, EMPTY_FILE_CATALOG } from "./file-catalog.js";

export interface UsfmShellProps {
  readonly host: UsfmShellHost;
  /** Initial expanded state for the left sidebar. Default `true`. */
  readonly defaultSidebarExpanded?: boolean;
  /** Initial expanded state for the bottom bar. Default `true`. */
  readonly defaultBottomExpanded?: boolean;
  readonly className?: string;
}

export interface UsfmShellHandle {
  /** Returns false when the user cancels; true when all dirty tabs were saved or discarded. */
  confirmExit(): Promise<boolean>;
  hasUnsavedChanges(): boolean;
}

type UnsavedCloseChoice = "save" | "discard" | "cancel";

type PendingTabClose = {
  readonly kind: "tab";
  readonly groupId: string;
  readonly tabId: string;
};

type PendingAppClose = {
  readonly kind: "app";
  readonly remainingTabIds: readonly string[];
};

type PendingClose = PendingTabClose | PendingAppClose;

type SidebarTab = "files" | "search";
type BottomTab = "errors";

const VALIDATE_DEBOUNCE_MS = 300;

/** Pixels the pointer must travel before a file-row press is treated as a drag rather than a click. */
const FILE_DRAG_THRESHOLD_PX = 5;

export const UsfmShell = forwardRef<UsfmShellHandle, UsfmShellProps>(function UsfmShell(
  {
    host,
    defaultSidebarExpanded = true,
    defaultBottomExpanded = true,
    className,
  },
  ref,
) {
  const [model, setModel] = useState<UsfmWorkspaceModel>(() => buildWorkspaceModelFromInitialTabs([]));
  const [fileEntries, setFileEntries] = useState<readonly UsfmShellFileEntry[]>([]);
  const [fileCatalog, setFileCatalog] = useState<UsfmFilePickerGroups>(EMPTY_FILE_CATALOG);
  const [filesLoading, setFilesLoading] = useState(true);
  const [folderRevision, setFolderRevision] = useState(0);
  const [recentFolders, setRecentFolders] = useState<readonly UsfmShellRecentFolder[]>([]);
  const [folderLabel, setFolderLabel] = useState(host.label);
  const [folderPath, setFolderPath] = useState(host.folderPath);

  const [sidebarExpanded, setSidebarExpanded] = useState(defaultSidebarExpanded);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [bottomExpanded, setBottomExpanded] = useState(defaultBottomExpanded);
  const [bottomTab, setBottomTab] = useState<BottomTab>("errors");

  // The active tab page is the active tab of the active tab group. Tracking the group (rather than a
  // bare tab id) lets newly opened files land in the group the user last interacted with, and keeps
  // a stable target when the active tab is closed.
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<readonly Diagnostic[]>([]);
  const [validating, setValidating] = useState(false);

  const clientRef = useRef(createLanguageClient());
  const validateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validateGenerationRef = useRef(0);
  const documentReadersRef = useRef(new Map<string, () => string>());
  const diagnosticsByTabRef = useRef(new Map<string, readonly Diagnostic[]>());
  const activeTabIdRef = useRef<string | null>(null);
  const activeGroupIdRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  activeGroupIdRef.current = activeGroupId;

  const activeGroup = activeGroupId ? model.slots.find((s) => s.id === activeGroupId) ?? null : null;
  const activeTabId = activeGroup?.activeTabId ?? null;
  const activeTab = activeTabId ? model.tabsById[activeTabId] ?? null : null;
  // The errors panel only follows USFM editor tabs; the settings pane has no diagnostics.
  const activeEditorTab = activeTab && activeTab.kind !== "settings" ? activeTab : null;
  const activeFileName = activeEditorTab?.fileName ?? null;
  activeTabIdRef.current = activeTabId;

  const [closePrompt, setClosePrompt] = useState<{
    readonly fileName: string;
    readonly pending: PendingClose;
  } | null>(null);
  const closeChoiceRef = useRef<((choice: UnsavedCloseChoice) => void) | null>(null);

  const askUnsavedClose = useCallback((fileName: string, pending: PendingClose) => {
    return new Promise<UnsavedCloseChoice>((resolve) => {
      closeChoiceRef.current = resolve;
      setClosePrompt({ fileName, pending });
    });
  }, []);

  const finishClosePrompt = useCallback((choice: UnsavedCloseChoice) => {
    closeChoiceRef.current?.(choice);
    closeChoiceRef.current = null;
    setClosePrompt(null);
  }, []);

  const saveTabById = useCallback(
    async (tabId: string, valueOverride?: string) => {
      const tab = modelRef.current.tabsById[tabId];
      if (!tab || tab.kind === "settings") return;
      const body = valueOverride ?? tab.value;
      if (host.writeFile) {
        await host.writeFile(tabId, body);
      }
      setModel((p) => workspaceMarkTabSaved(workspaceSetTabValue(p, tabId, body), tabId));
    },
    [host],
  );

  const closeTabNow = useCallback((groupId: string, tabId: string) => {
    setModel((p) => workspaceCloseTab(p, groupId, tabId));
  }, []);

  const handleSaveTab = useCallback(
    (tabId: string, value: string) => {
      void saveTabById(tabId, value);
    },
    [saveTabById],
  );

  const handleMarkTabDirty = useCallback((tabId: string) => {
    setModel((p) => workspaceSetTabDirty(p, tabId));
  }, []);

  const handleCloseTab = useCallback(
    (groupId: string, tabId: string) => {
      const tab = modelRef.current.tabsById[tabId];
      if (!tab || tab.kind === "settings" || !tab.dirty) {
        closeTabNow(groupId, tabId);
        return;
      }
      void (async () => {
        const choice = await askUnsavedClose(tab.fileName, { kind: "tab", groupId, tabId });
        if (choice === "cancel") return;
        if (choice === "save") await saveTabById(tabId);
        closeTabNow(groupId, tabId);
      })();
    },
    [askUnsavedClose, closeTabNow, saveTabById],
  );

  const confirmExit = useCallback(async (): Promise<boolean> => {
    let remaining = workspaceListDirtyEditorTabs(modelRef.current).map((tab) => tab.id);
    while (remaining.length > 0) {
      const tabId = remaining[0]!;
      const tab = modelRef.current.tabsById[tabId];
      if (!tab) {
        remaining = remaining.slice(1);
        continue;
      }
      const choice = await askUnsavedClose(tab.fileName, { kind: "app", remainingTabIds: remaining });
      if (choice === "cancel") return false;
      if (choice === "save") await saveTabById(tabId);
      remaining = remaining.slice(1);
    }
    return true;
  }, [askUnsavedClose, saveTabById]);

  useImperativeHandle(
    ref,
    () => ({
      confirmExit,
      hasUnsavedChanges: () => workspaceListDirtyEditorTabs(modelRef.current).length > 0,
    }),
    [confirmExit],
  );

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (workspaceListDirtyEditorTabs(modelRef.current).length === 0) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Load file list and build sidebar picker groups (reads each file once; bodies are not cached).
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
        setFileEntries(list);
        const catalog = await buildUsfmFilePickerCatalog(list, host);
        if (!cancelled) setFileCatalog(catalog);
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

  // Keep the active tab group pointing at a real slot; default to the first slot.
  useEffect(() => {
    if (activeGroupId && model.slots.some((s) => s.id === activeGroupId)) return;
    setActiveGroupId(model.slots[0]?.id ?? null);
  }, [model, activeGroupId]);

  const scheduleValidation = useCallback((tabId: string) => {
    const tab = modelRef.current.tabsById[tabId];
    if (!tab || tab.kind === "settings") return;

    if (validateDebounceRef.current) clearTimeout(validateDebounceRef.current);
    const showLoading = !diagnosticsByTabRef.current.has(tabId);
    if (showLoading) setValidating(true);
    validateDebounceRef.current = setTimeout(() => {
      validateDebounceRef.current = null;
      const gen = ++validateGenerationRef.current;
      const readDocument = documentReadersRef.current.get(tabId);
      const content = readDocument?.() ?? tab.value;
      void clientRef.current.validate(content).then((diags) => {
        if (gen !== validateGenerationRef.current) return;
        diagnosticsByTabRef.current.set(tabId, diags);
        if (activeTabIdRef.current === tabId) {
          setDiagnostics(diags);
        }
        setValidating(false);
      });
    }, VALIDATE_DEBOUNCE_MS);
  }, []);

  const handleEditorDocumentChange = useCallback((tabId: string) => {
    if (tabId === activeTabIdRef.current) scheduleValidation(tabId);
  }, [scheduleValidation]);

  const handleRegisterDocumentReader = useCallback((tabId: string, reader: () => string) => {
    documentReadersRef.current.set(tabId, reader);
    return () => documentReadersRef.current.delete(tabId);
  }, []);

  const getDiagnosticsForTab = useCallback((tabId: string): readonly Diagnostic[] => {
    if (tabId === activeTabId) return diagnostics;
    return diagnosticsByTabRef.current.get(tabId) ?? [];
  }, [activeTabId, diagnostics]);

  // Validate when the active editor tab changes.
  useEffect(() => {
    if (!activeTabId) {
      validateGenerationRef.current++;
      setDiagnostics([]);
      setValidating(false);
      return;
    }
    const tab = modelRef.current.tabsById[activeTabId];
    if (!tab || tab.kind === "settings") {
      validateGenerationRef.current++;
      setDiagnostics([]);
      setValidating(false);
      return;
    }
    setDiagnostics(diagnosticsByTabRef.current.get(activeTabId) ?? []);
    scheduleValidation(activeTabId);
    return () => {
      if (validateDebounceRef.current) {
        clearTimeout(validateDebounceRef.current);
        validateDebounceRef.current = null;
      }
    };
  }, [activeTabId, scheduleValidation]);

  // ---- workspace callbacks ----

  const handleActivateTab = useCallback((groupId: string, tabId: string) => {
    setModel((p) => workspaceActivateTab(p, groupId, tabId));
    setActiveGroupId(groupId);
  }, []);

  // Pressing anywhere inside a tab group makes it the active tab page (errors panel + open target).
  const handleActivateGroup = useCallback((groupId: string) => {
    setActiveGroupId(groupId);
  }, []);

  const handleUpdateTabValue = useCallback((tabId: string, value: string) => {
    setModel((p) => workspaceSetTabValue(p, tabId, value));
  }, []);

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

  const handleChangeGridLayout = useCallback(
    (rows: WorkspaceGridDimension, cols: WorkspaceGridDimension) =>
      setModel((p) => workspaceSetGridLayout(p, rows, cols)),
    [],
  );

  const handleOpenSettings = useCallback(() => {
    const targetGroupId = activeGroupIdRef.current ?? modelRef.current.slots[0]?.id;
    // Settings is a singleton: if it already lives in another group, that group becomes active.
    const existing = modelRef.current.slots.find((s) => s.tabIds.includes(SETTINGS_TAB_ID));
    setModel((p) => workspaceOpenSettingsTab(p, { groupId: targetGroupId }));
    setActiveGroupId(existing?.id ?? targetGroupId ?? null);
  }, []);

  // ---- file open / focus ----

  const openFile = useCallback(
    async (
      entry: UsfmShellFileEntry,
      opts?: {
        readonly selection?: { from: number; to: number };
        /** Open into this specific tab group (e.g. a drag-drop target) instead of the active group. */
        readonly targetGroupId?: string;
      },
    ) => {
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
        setActiveGroupId(groupHoldingTab);
        return;
      }

      const usfm = await host.readFile(entry.id);
      if (usfm == null) return;
      // Prefer an explicit drop target; otherwise open into the active tab group, falling back to
      // the first slot when neither is valid.
      const requestedGroupId =
        opts?.targetGroupId && model.slots.some((s) => s.id === opts.targetGroupId)
          ? opts.targetGroupId
          : null;
      const targetGroupId =
        requestedGroupId ??
        (activeGroupId && model.slots.some((s) => s.id === activeGroupId) ? activeGroupId : null) ??
        model.slots[0]?.id;
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
      setActiveGroupId(targetGroupId);
    },
    [host, model.slots, activeGroupId],
  );

  // ---- drag a file from the sidebar into a tab group ----
  // Pointer-based to match the workspace's tab drag (see UsfmWorkspace for why not HTML5 DnD). The
  // workspace exposes its groups as DOM drop targets; we hit-test them with dropTargetAtPoint and
  // open the file into the group under the pointer on release.
  const fileDragRef = useRef<
    { entry: UsfmShellFileEntry; startX: number; startY: number; started: boolean } | null
  >(null);
  const fileGhostRef = useRef<HTMLDivElement>(null);
  const justDraggedFileRef = useRef(false);
  const [fileDropTargetGroupId, setFileDropTargetGroupId] = useState<string | null>(null);

  const beginFileDrag = useCallback(
    (e: ReactPointerEvent, entry: UsfmShellFileEntry) => {
      if (e.button !== 0) return;
      justDraggedFileRef.current = false;
      fileDragRef.current = { entry, startX: e.clientX, startY: e.clientY, started: false };

      const onMove = (ev: PointerEvent) => {
        const d = fileDragRef.current;
        if (!d) return;
        if (!d.started) {
          if (Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < FILE_DRAG_THRESHOLD_PX) return;
          d.started = true;
          const g = fileGhostRef.current;
          if (g) {
            g.textContent = d.entry.name;
            g.classList.remove("hidden");
          }
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }
        const g = fileGhostRef.current;
        if (g) g.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`;
        setFileDropTargetGroupId(dropTargetAtPoint(ev.clientX, ev.clientY)?.groupId ?? null);
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", cleanup);
        fileGhostRef.current?.classList.add("hidden");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        fileDragRef.current = null;
        setFileDropTargetGroupId(null);
      };

      const onUp = (ev: PointerEvent) => {
        const d = fileDragRef.current;
        const started = d?.started ?? false;
        const draggedEntry = d?.entry;
        cleanup();
        if (started && draggedEntry) {
          justDraggedFileRef.current = true;
          const target = dropTargetAtPoint(ev.clientX, ev.clientY);
          if (target) void openFile(draggedEntry, { targetGroupId: target.groupId });
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", cleanup);
    },
    [openFile],
  );

  const consumeFileDragEnd = useCallback(() => {
    const v = justDraggedFileRef.current;
    justDraggedFileRef.current = false;
    return v;
  }, []);

  // ---- search ----

  const onSelectSearchResult = useCallback(
    (m: SearchMatch) => {
      const entry = fileEntries.find((f) => f.id === m.fileId);
      if (entry) void openFile(entry, { selection: { from: m.from, to: m.to } });
    },
    [fileEntries, openFile],
  );

  // ---- errors ----

  const onSelectDiagnostic = useCallback(
    (d: Diagnostic) => {
      if (!activeTabId) return;
      const readDocument = documentReadersRef.current.get(activeTabId);
      const content = readDocument?.() ?? modelRef.current.tabsById[activeTabId]?.value ?? "";
      const offset = lineColumnToSourceOffset(content, d.range.start.line, d.range.start.column);
      setModel((p) => workspaceRequestTabSelection(p, activeTabId, offset, offset));
    },
    [activeTabId],
  );

  const activeFileIdForBrowser =
    activeTab && fileEntries.some((f) => f.id === activeTab.id) ? activeTab.id : null;

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
      {/* Floating label that follows the pointer while dragging a file from the sidebar. */}
      <div
        ref={fileGhostRef}
        className="pointer-events-none fixed left-0 top-0 z-50 hidden max-w-[11rem] truncate rounded border border-gray-400 bg-white px-2 py-1 text-sm shadow-lg dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100"
        aria-hidden
      />
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
                fileEntries={fileEntries}
                catalog={fileCatalog}
                activeFileId={activeFileIdForBrowser}
                onOpenFile={(entry) => void openFile(entry)}
                onFileDragStart={beginFileDrag}
                consumeFileDragEnd={consumeFileDragEnd}
                loading={filesLoading}
                folderLabel={folderLabel}
                folderPath={folderPath}
                recentFolders={recentFolders}
                onOpenFolder={handleOpenFolder}
                onPickFolder={handlePickFolder}
              />
            ) : (
              <FileSearch
                files={fileEntries}
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
            onActivateGroup={handleActivateGroup}
            onUpdateTabValue={handleUpdateTabValue}
            onMarkTabDirty={handleMarkTabDirty}
            onSaveTab={handleSaveTab}
            getDiagnosticsForTab={getDiagnosticsForTab}
            onEditorDocumentChange={handleEditorDocumentChange}
            onRegisterDocumentReader={handleRegisterDocumentReader}
            onCloseTab={handleCloseTab}
            onReorderTabInGroup={handleReorderTabInGroup}
            onMoveTabToGroup={handleMoveTabToGroup}
            onChangeGridLayout={handleChangeGridLayout}
            externalDropTargetGroupId={fileDropTargetGroupId}
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
                  activeFileName={activeFileName}
                  diagnostics={diagnostics}
                  onSelectDiagnostic={onSelectDiagnostic}
                  loading={validating && diagnostics.length === 0}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
      {closePrompt ? (
        <UnsavedChangesDialog
          fileName={closePrompt.fileName}
          onCancel={() => finishClosePrompt("cancel")}
          onDiscard={() => finishClosePrompt("discard")}
          onSave={() => {
            const pending = closePrompt.pending;
            void (async () => {
              if (pending.kind === "tab") {
                await saveTabById(pending.tabId);
              } else {
                const tabId = pending.remainingTabIds[0];
                if (tabId) await saveTabById(tabId);
              }
              finishClosePrompt("save");
            })();
          }}
        />
      ) : null}
      </div>
    </SettingsProvider>
  );
});

UsfmShell.displayName = "UsfmShell";
