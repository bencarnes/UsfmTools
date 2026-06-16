import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { UsfmPane } from "../usfm-pane/UsfmPane.js";
import { SettingsPane } from "../settings-pane/SettingsPane.js";
import { TabGroupLayoutSelector } from "../tab-group-layout-selector/TabGroupLayoutSelector.js";
import { TabListDropdown } from "./tab-list-dropdown.js";
import { dropTargetAtPoint } from "./drop-target.js";
import type { Diagnostic } from "../../language-service/protocol.js";
import type {
  UsfmWorkspaceEditorGroupState,
  UsfmWorkspaceProps,
  UsfmWorkspaceTabState,
  WorkspaceGridDimension,
} from "./workspace-model.js";

/** Minimum share of width for adjacent tab groups while dragging a column split. */
const MIN_COL_FRAC = 0.12;
/** Minimum share of height for adjacent rows while dragging a row split. */
const MIN_ROW_FRAC = 0.12;

/** Pixels the pointer must travel before a tab press is treated as a drag rather than a click. */
const TAB_DRAG_THRESHOLD_PX = 5;

/**
 * Tab dragging is implemented with pointer events instead of the HTML5 Drag-and-Drop API.
 * The HTML5 API's drop-target events (`dragenter`/`dragover`/`drop`) are unreliable in some
 * webviews — notably WebKitGTK, which backs Wails on Linux — where a drag visibly starts but no
 * target ever accepts it (the cursor stays "not allowed"). Pointer events behave consistently
 * across WebView2, WKWebView, and WebKitGTK, the same way the split resizers already work.
 */
interface ActiveTabDrag {
  readonly tabId: string;
  readonly fromGroupId: string;
  readonly fileName: string;
  /** Group currently under the pointer, or null when the pointer is outside any drop zone. */
  readonly overGroupId: string | null;
}

interface TabDragContextValue {
  /** The in-progress drag once it passes the movement threshold, otherwise null. */
  readonly active: ActiveTabDrag | null;
  /** Begin tracking a potential drag from a tab press. */
  readonly beginDrag: (
    e: ReactPointerEvent,
    detail: { readonly tabId: string; readonly fromGroupId: string; readonly fileName: string },
  ) => void;
  /** Returns (and clears) whether the last pointer interaction ended a drag, to suppress the click. */
  readonly consumeDragEnd: () => boolean;
}

const TabDragContext = createContext<TabDragContextValue | null>(null);

interface ColumnResizableGapProps {
  readonly boundaryIndex: number;
  readonly layoutRef: RefObject<HTMLDivElement | null>;
  readonly fractions: readonly number[];
  readonly setFractions: Dispatch<SetStateAction<number[]>>;
}

function ColumnResizableGap({ boundaryIndex, layoutRef, fractions, setFractions }: ColumnResizableGapProps) {
  const dragRef = useRef<{ startX: number; startFrac: number[] } | null>(null);

  const onResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (!layoutRef.current) return;
    const startX = e.clientX;
    const startFrac = [...fractions];
    dragRef.current = { startX, startFrac };

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const widthNow = layoutRef.current?.getBoundingClientRect().width || 1;
      const t = (ev.clientX - drag.startX) / widthNow;
      const i = boundaryIndex;
      const pairSum = drag.startFrac[i]! + drag.startFrac[i + 1]!;
      let na = drag.startFrac[i]! + t;
      na = Math.max(MIN_COL_FRAC, Math.min(pairSum - MIN_COL_FRAC, na));
      const nb = pairSum - na;
      setFractions((prev) => {
        const next = [...prev];
        next[i] = na;
        next[i + 1] = nb;
        return next;
      });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="relative z-10 flex w-1.5 shrink-0 flex-col bg-gray-200 dark:bg-gray-700">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize tab groups"
        tabIndex={0}
        className="min-h-0 flex-1 cursor-col-resize border-l border-gray-300 hover:bg-gray-400 dark:border-gray-600 dark:hover:bg-gray-500"
        onMouseDown={onResizeMouseDown}
      />
    </div>
  );
}

interface RowResizableGapProps {
  readonly boundaryIndex: number;
  readonly layoutRef: RefObject<HTMLDivElement | null>;
  readonly fractions: readonly number[];
  readonly setFractions: Dispatch<SetStateAction<number[]>>;
}

function RowResizableGap({ boundaryIndex, layoutRef, fractions, setFractions }: RowResizableGapProps) {
  const dragRef = useRef<{ startY: number; startFrac: number[] } | null>(null);

  const onResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (!layoutRef.current) return;
    const startY = e.clientY;
    const startFrac = [...fractions];
    dragRef.current = { startY, startFrac };

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const heightNow = layoutRef.current?.getBoundingClientRect().height || 1;
      const t = (ev.clientY - drag.startY) / heightNow;
      const i = boundaryIndex;
      const pairSum = drag.startFrac[i]! + drag.startFrac[i + 1]!;
      let na = drag.startFrac[i]! + t;
      na = Math.max(MIN_ROW_FRAC, Math.min(pairSum - MIN_ROW_FRAC, na));
      const nb = pairSum - na;
      setFractions((prev) => {
        const next = [...prev];
        next[i] = na;
        next[i + 1] = nb;
        return next;
      });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="relative z-10 flex h-1.5 shrink-0 flex-row bg-gray-200 dark:bg-gray-700">
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize tab group rows"
        tabIndex={0}
        className="min-w-0 flex-1 cursor-ns-resize border-t border-gray-300 hover:bg-gray-400 dark:border-gray-600 dark:hover:bg-gray-500"
        onMouseDown={onResizeMouseDown}
      />
    </div>
  );
}

interface TabStripProps {
  readonly groupId: string;
  readonly tabIds: readonly string[];
  readonly activeTabId: string | null;
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivate: (tabId: string) => void;
  readonly onClose: (tabId: string) => void;
}

function TabStrip({
  groupId,
  tabIds,
  activeTabId,
  tabsById,
  onActivate,
  onClose,
}: TabStripProps) {
  const drag = useContext(TabDragContext);
  const isDropTarget = drag?.active != null && drag.active.overGroupId === groupId;

  return (
    <div className="flex min-w-0 flex-1 items-stretch">
      <div
        className={`flex min-w-0 flex-1 flex-nowrap gap-0.5 overflow-x-auto overflow-y-hidden ${
          isDropTarget ? "bg-blue-50/70 dark:bg-blue-950/40" : ""
        }`}
        data-workspace-strip={groupId}
      >
        {tabIds.map((tid) => {
          const tab = tabsById[tid];
          if (!tab) return null;
          const active = tid === activeTabId;
          return (
            <div
              key={tid}
              className={`flex min-w-0 max-w-[11rem] shrink-0 items-center rounded-t border border-b-0 px-1 text-sm ${
                active
                  ? "border-gray-400 bg-white dark:border-gray-500 dark:bg-gray-900"
                  : "border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
              data-workspace-tab-id={tid}
            >
              <button
                type="button"
                onPointerDown={(ev) =>
                  drag?.beginDrag(ev, { tabId: tid, fromGroupId: groupId, fileName: tab.fileName })
                }
                className={`min-w-0 flex-1 cursor-grab truncate px-1 py-1.5 text-left ${tab.dirty ? "italic" : ""}`}
                onClick={() => {
                  if (drag?.consumeDragEnd()) return;
                  onActivate(tid);
                }}
                aria-selected={active}
                role="tab"
                title={tab.dirty ? `${tab.fileName} (unsaved)` : tab.fileName}
              >
                {tab.fileName}
              </button>
              <button
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label={tab.dirty ? "Close tab (unsaved changes)" : "Close tab"}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onClose(tid);
                }}
              >
                {tab.dirty ? (
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full border-2 border-gray-600 dark:border-gray-400"
                    title="Unsaved changes"
                  />
                ) : (
                  <span aria-hidden>×</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <TabListDropdown
        tabIds={tabIds}
        activeTabId={activeTabId}
        tabsById={tabsById}
        onActivate={onActivate}
      />
    </div>
  );
}

interface EmptySlotDropTargetProps {
  readonly groupId: string;
}

function EmptySlotDropTarget({ groupId }: EmptySlotDropTargetProps) {
  const drag = useContext(TabDragContext);
  const hover = drag?.active != null && drag.active.overGroupId === groupId;

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col items-center justify-center border border-dashed text-sm ${
        hover
          ? "border-blue-400 bg-blue-50/60 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200"
          : "border-gray-300 bg-gray-50/80 text-gray-500 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-400"
      }`}
      data-workspace-empty-slot={groupId}
      data-testid={`workspace-empty-slot-${groupId}`}
      aria-label="Empty tab group — drop a tab here"
    >
      Drop a tab here
    </div>
  );
}

interface EditorGroupPanelProps {
  readonly group: UsfmWorkspaceEditorGroupState;
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivateTab: (groupId: string, tabId: string) => void;
  readonly onActivateGroup?: (groupId: string) => void;
  readonly onCloseTab: (groupId: string, tabId: string) => void;
  readonly onUpdateValue: (tabId: string, value: string) => void;
  readonly onMarkTabDirty?: (tabId: string) => void;
  readonly onSaveValue?: (tabId: string, value: string) => void;
  readonly getDiagnosticsForTab?: (tabId: string) => readonly Diagnostic[];
  readonly onEditorDocumentChange?: (tabId: string) => void;
  readonly onRegisterDocumentReader?: (tabId: string, reader: () => string) => () => void;
  readonly gridRows: WorkspaceGridDimension;
  readonly gridCols: WorkspaceGridDimension;
  readonly onChangeGridLayout?: (rows: WorkspaceGridDimension, cols: WorkspaceGridDimension) => void;
}

function EditorGroupPanel({
  group,
  tabsById,
  onActivateTab,
  onActivateGroup,
  onCloseTab,
  onUpdateValue,
  onMarkTabDirty,
  onSaveValue,
  getDiagnosticsForTab,
  onEditorDocumentChange,
  onRegisterDocumentReader,
  gridRows,
  gridCols,
  onChangeGridLayout,
}: EditorGroupPanelProps) {
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const isEmpty = group.tabIds.length === 0;

  // Pressing anywhere inside a group (tab strip, pane body, toolbar) makes it the active tab page.
  const handleActivateGroup = onActivateGroup ? () => onActivateGroup(group.id) : undefined;

  if (isEmpty) {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
        onPointerDown={handleActivateGroup}
      >
        <EmptySlotDropTarget groupId={group.id} />
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
      onPointerDown={handleActivateGroup}
    >
      <div className="relative z-20 flex min-h-[2.25rem] shrink-0 items-stretch overflow-visible border-b border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
        <TabStrip
          groupId={group.id}
          tabIds={group.tabIds}
          activeTabId={group.activeTabId}
          tabsById={tabsById}
          onActivate={(tabId) => onActivateTab(group.id, tabId)}
          onClose={(tabId) => onCloseTab(group.id, tabId)}
        />
        <div
          ref={setToolbarEl}
          className="flex shrink-0 items-center justify-end gap-1 border-l border-gray-200 bg-gray-50 px-1.5 dark:border-gray-700 dark:bg-gray-800"
        />
        {onChangeGridLayout ? (
          <div className="flex shrink-0 items-center border-l border-gray-200 bg-gray-50 px-1.5 dark:border-gray-700 dark:bg-gray-800">
            <TabGroupLayoutSelector gridRows={gridRows} gridCols={gridCols} onChange={onChangeGridLayout} />
          </div>
        ) : null}
      </div>
      <div className="relative z-0 grid min-h-0 flex-1 grid-cols-1 grid-rows-1 overflow-hidden">
        {group.tabIds.map((tid) => {
          const tab = tabsById[tid];
          if (!tab) return null;
          const active = tid === group.activeTabId;
          return (
            <div
              key={tid}
              className={
                active
                  ? "col-start-1 row-start-1 z-10 flex min-h-0 min-w-0 flex-col"
                  : "col-start-1 row-start-1 z-0 flex min-h-0 min-w-0 flex-col invisible pointer-events-none"
              }
              aria-hidden={!active}
            >
              {tab.kind === "settings" ? (
                <SettingsPane className="min-h-0 flex-1" />
              ) : (
                <UsfmPane
                  value={tab.value}
                  onChange={(v) => onUpdateValue(tid, v)}
                  onDirty={onMarkTabDirty ? () => onMarkTabDirty(tid) : undefined}
                  onSave={onSaveValue ? (content) => onSaveValue(tid, content) : undefined}
                  diagnostics={getDiagnosticsForTab?.(tid)}
                  onValidationDocumentChange={
                    onEditorDocumentChange ? () => onEditorDocumentChange(tid) : undefined
                  }
                  onRegisterDocumentReader={
                    onRegisterDocumentReader
                      ? (reader) => onRegisterDocumentReader(tid, reader)
                      : undefined
                  }
                  dirty={tab.dirty}
                  toolbarMount={toolbarEl}
                  toolbarActive={active}
                  selectionRequest={tab.selectionRequest}
                  className="min-h-0 flex-1 rounded-none border-0"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WorkspaceGridRowProps {
  readonly rowIndex: number;
  readonly gridRows: WorkspaceGridDimension;
  readonly gridCols: WorkspaceGridDimension;
  readonly rowSlots: readonly UsfmWorkspaceEditorGroupState[];
  readonly columnFractions: readonly number[];
  readonly setColumnFractions: Dispatch<SetStateAction<number[][]>>;
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivateTab: UsfmWorkspaceProps["onActivateTab"];
  readonly onActivateGroup?: UsfmWorkspaceProps["onActivateGroup"];
  readonly onCloseTab: UsfmWorkspaceProps["onCloseTab"];
  readonly onUpdateTabValue: UsfmWorkspaceProps["onUpdateTabValue"];
  readonly onMarkTabDirty?: UsfmWorkspaceProps["onMarkTabDirty"];
  readonly onSaveTab?: UsfmWorkspaceProps["onSaveTab"];
  readonly getDiagnosticsForTab?: UsfmWorkspaceProps["getDiagnosticsForTab"];
  readonly onEditorDocumentChange?: UsfmWorkspaceProps["onEditorDocumentChange"];
  readonly onRegisterDocumentReader?: UsfmWorkspaceProps["onRegisterDocumentReader"];
  readonly onChangeGridLayout?: UsfmWorkspaceProps["onChangeGridLayout"];
}

function WorkspaceGridRow({
  rowIndex,
  gridRows,
  gridCols,
  rowSlots,
  columnFractions,
  setColumnFractions,
  tabsById,
  onActivateTab,
  onActivateGroup,
  onCloseTab,
  onUpdateTabValue,
  onMarkTabDirty,
  onSaveTab,
  getDiagnosticsForTab,
  onEditorDocumentChange,
  onRegisterDocumentReader,
  onChangeGridLayout,
}: WorkspaceGridRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const setFractionsForRow = useCallback(
    (action: SetStateAction<number[]>) => {
      setColumnFractions((prev) => {
        const next = prev.map((row) => [...row]);
        while (next.length <= rowIndex) next.push([1]);
        const cur = next[rowIndex] ?? [1];
        next[rowIndex] = typeof action === "function" ? action([...cur]) : action;
        return next;
      });
    },
    [rowIndex, setColumnFractions],
  );

  return (
    <div ref={rowRef} className="flex min-h-0 min-w-0 flex-1 flex-row">
      {rowSlots.map((group, colIndex) => (
        <Fragment key={group.id}>
          {colIndex > 0 ? (
            <ColumnResizableGap
              boundaryIndex={colIndex - 1}
              layoutRef={rowRef}
              fractions={columnFractions}
              setFractions={setFractionsForRow}
            />
          ) : null}
          <div
            className="flex min-h-0 min-w-0 flex-col"
            style={{
              flexGrow: columnFractions[colIndex] ?? 1,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: gridCols > 1 ? "min(10rem, 22%)" : undefined,
            }}
          >
            <EditorGroupPanel
              group={group}
              tabsById={tabsById}
              onActivateTab={onActivateTab}
              onActivateGroup={onActivateGroup}
              onCloseTab={onCloseTab}
              onUpdateValue={onUpdateTabValue}
              onMarkTabDirty={onMarkTabDirty}
              onSaveValue={onSaveTab}
              getDiagnosticsForTab={getDiagnosticsForTab}
              onEditorDocumentChange={onEditorDocumentChange}
              onRegisterDocumentReader={onRegisterDocumentReader}
              gridRows={gridRows}
              gridCols={gridCols}
              onChangeGridLayout={onChangeGridLayout}
            />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function UsfmWorkspace({
  gridRows,
  gridCols,
  slots,
  tabsById,
  onActivateTab,
  onActivateGroup,
  onUpdateTabValue,
  onMarkTabDirty,
  onSaveTab,
  getDiagnosticsForTab,
  onEditorDocumentChange,
  onRegisterDocumentReader,
  onCloseTab,
  onReorderTabInGroup,
  onMoveTabToGroup,
  onChangeGridLayout,
  externalDropTargetGroupId,
  className,
}: UsfmWorkspaceProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const visibleSlots = slots.slice(0, gridRows * gridCols);

  const [rowFractions, setRowFractions] = useState<number[]>(() =>
    gridRows > 0 ? Array.from({ length: gridRows }, () => 1 / gridRows) : [1],
  );

  const [colFractions, setColFractions] = useState<number[][]>(() =>
    Array.from({ length: gridRows }, () =>
      gridCols > 0 ? Array.from({ length: gridCols }, () => 1 / gridCols) : [1],
    ),
  );

  useEffect(() => {
    setRowFractions((prev) => {
      if (prev.length === gridRows) return prev;
      return gridRows > 0 ? Array.from({ length: gridRows }, () => 1 / gridRows) : [1];
    });
  }, [gridRows]);

  useEffect(() => {
    setColFractions((prev) =>
      Array.from({ length: gridRows }, (_, ri) => {
        const n = gridCols;
        const old = prev[ri];
        if (old && old.length === n) return old;
        return n > 0 ? Array.from({ length: n }, () => 1 / n) : [1];
      }),
    );
  }, [gridRows, gridCols]);

  // ---- pointer-based tab drag controller (see ActiveTabDrag above for why not HTML5 DnD) ----
  const [activeDrag, setActiveDrag] = useState<ActiveTabDrag | null>(null);
  const dragRef = useRef<
    | {
        tabId: string;
        fromGroupId: string;
        fileName: string;
        startX: number;
        startY: number;
        started: boolean;
        overGroupId: string | null;
      }
    | null
  >(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const justDraggedRef = useRef(false);

  const performDrop = useCallback(
    (tabId: string, fromGroupId: string, clientX: number, clientY: number) => {
      const target = dropTargetAtPoint(clientX, clientY);
      if (!target) return;
      if (target.groupId === fromGroupId) {
        onReorderTabInGroup(fromGroupId, tabId, target.insertIndex);
      } else {
        onMoveTabToGroup({ tabId, fromGroupId, toGroupId: target.groupId, insertIndex: target.insertIndex });
      }
    },
    [onReorderTabInGroup, onMoveTabToGroup],
  );

  const beginDrag = useCallback<TabDragContextValue["beginDrag"]>(
    (e, detail) => {
      if (e.button !== 0) return;
      justDraggedRef.current = false;
      dragRef.current = { ...detail, startX: e.clientX, startY: e.clientY, started: false, overGroupId: null };

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        if (!d.started) {
          if (Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < TAB_DRAG_THRESHOLD_PX) return;
          d.started = true;
          const g = ghostRef.current;
          if (g) {
            g.textContent = d.fileName;
            g.classList.remove("hidden");
          }
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
          setActiveDrag({ tabId: d.tabId, fromGroupId: d.fromGroupId, fileName: d.fileName, overGroupId: null });
        }
        const g = ghostRef.current;
        if (g) g.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`;
        const overGroupId = dropTargetAtPoint(ev.clientX, ev.clientY)?.groupId ?? null;
        if (overGroupId !== d.overGroupId) {
          d.overGroupId = overGroupId;
          setActiveDrag((prev) => (prev ? { ...prev, overGroupId } : prev));
        }
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", cleanup);
        ghostRef.current?.classList.add("hidden");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        dragRef.current = null;
        setActiveDrag(null);
      };

      const onUp = (ev: PointerEvent) => {
        const d = dragRef.current;
        const started = d?.started ?? false;
        const tabId = d?.tabId;
        const fromGroupId = d?.fromGroupId;
        cleanup();
        if (started && tabId && fromGroupId) {
          justDraggedRef.current = true;
          performDrop(tabId, fromGroupId, ev.clientX, ev.clientY);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", cleanup);
    },
    [performDrop],
  );

  // A file being dragged from the shell sidebar isn't tracked by this component's tab-drag
  // controller, but the hovered group should still light up. Synthesize a drag-active value from
  // the externally supplied group id so {@link TabStrip} / {@link EmptySlotDropTarget} highlight it.
  const externalDrag = useMemo<ActiveTabDrag | null>(
    () =>
      externalDropTargetGroupId != null
        ? { tabId: "", fromGroupId: "", fileName: "", overGroupId: externalDropTargetGroupId }
        : null,
    [externalDropTargetGroupId],
  );

  const dragContextValue = useMemo<TabDragContextValue>(
    () => ({
      active: activeDrag ?? externalDrag,
      beginDrag,
      consumeDragEnd: () => {
        const v = justDraggedRef.current;
        justDraggedRef.current = false;
        return v;
      },
    }),
    [activeDrag, externalDrag, beginDrag],
  );

  return (
    <TabDragContext.Provider value={dragContextValue}>
    <div
      ref={layoutRef}
      className={`flex min-h-[320px] min-w-0 flex-1 flex-col bg-gray-200 dark:bg-gray-950 ${className ?? ""}`}
      data-testid="usfm-workspace"
    >
      <div
        ref={ghostRef}
        className="pointer-events-none fixed left-0 top-0 z-50 hidden max-w-[11rem] truncate rounded border border-gray-400 bg-white px-2 py-1 text-sm shadow-lg dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100"
        aria-hidden
      />
      {Array.from({ length: gridRows }, (_, rowIndex) => {
        const rowSlots = visibleSlots.slice(rowIndex * gridCols, rowIndex * gridCols + gridCols);
        const colFracs = colFractions[rowIndex] ?? Array.from({ length: gridCols }, () => 1 / gridCols);
        return (
          <Fragment key={rowIndex}>
            {rowIndex > 0 ? (
              <RowResizableGap
                boundaryIndex={rowIndex - 1}
                layoutRef={layoutRef}
                fractions={rowFractions}
                setFractions={setRowFractions}
              />
            ) : null}
            <div
              className="flex min-h-0 min-w-0 flex-col"
              style={{
                flexGrow: rowFractions[rowIndex] ?? 1,
                flexShrink: 1,
                flexBasis: 0,
                minHeight: gridRows > 1 ? "min(8rem, 22%)" : undefined,
              }}
            >
              <WorkspaceGridRow
                rowIndex={rowIndex}
                gridRows={gridRows}
                gridCols={gridCols}
                rowSlots={rowSlots}
                columnFractions={colFracs}
                setColumnFractions={setColFractions}
                tabsById={tabsById}
                onActivateTab={onActivateTab}
                onActivateGroup={onActivateGroup}
                onCloseTab={onCloseTab}
                onUpdateTabValue={onUpdateTabValue}
                onMarkTabDirty={onMarkTabDirty}
                onSaveTab={onSaveTab}
                getDiagnosticsForTab={getDiagnosticsForTab}
                onEditorDocumentChange={onEditorDocumentChange}
                onRegisterDocumentReader={onRegisterDocumentReader}
                onChangeGridLayout={onChangeGridLayout}
              />
            </div>
          </Fragment>
        );
      })}
    </div>
    </TabDragContext.Provider>
  );
}
