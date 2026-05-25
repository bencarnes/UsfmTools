import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { UsfmPane } from "../usfm-pane/UsfmPane.js";
import type {
  UsfmWorkspaceEditorGroupState,
  UsfmWorkspaceEditorRowState,
  UsfmWorkspaceProps,
  UsfmWorkspaceTabState,
} from "./workspace-model.js";

const TAB_DRAG_MIME = "application/vnd.usfmtools.workspace-tab+json";

/** Minimum share of total width for each editor group while dragging a split. */
const MIN_GROUP_FRAC = 0.1;
/** Minimum share of total height for each row while dragging a vertical split. */
const MIN_ROW_FRAC = 0.08;

function parseTabDrag(dt: DataTransfer): { tabId: string; fromGroupId: string } | null {
  const raw = dt.getData(TAB_DRAG_MIME);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { tabId?: string; fromGroupId?: string };
    if (typeof v.tabId === "string" && typeof v.fromGroupId === "string") {
      return { tabId: v.tabId, fromGroupId: v.fromGroupId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Whether the drag operation carries workspace tab payload. Chromium leaves
 * `getData(customMime)` empty during `dragover` / `dragenter`; `types` still lists the MIME.
 */
function isTabDragTransfer(dt: DataTransfer): boolean {
  if (parseTabDrag(dt)) return true;
  for (let i = 0; i < dt.types.length; i++) {
    if (dt.types[i] === TAB_DRAG_MIME) return true;
  }
  return false;
}

function IconSplitGroupRight() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden className="block">
      <rect x="1.25" y="1" width="15.5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <line x1="9" y1="2.25" x2="9" y2="11.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
    </svg>
  );
}

function IconSplitGroupBelow() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden className="block">
      <rect x="1.25" y="1" width="15.5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <line x1="2.25" y1="7" x2="15.75" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
    </svg>
  );
}

interface TabStripProps {
  readonly groupId: string;
  readonly tabIds: readonly string[];
  readonly activeTabId: string | null;
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivate: (tabId: string) => void;
  readonly onClose: (tabId: string) => void;
  readonly onMoveTabInGroup: (tabId: string, toIndex: number) => void;
  readonly onDropTabFromOtherGroup: (tabId: string, fromGroupId: string, insertIndex: number) => void;
}

function TabStrip({
  groupId,
  tabIds,
  activeTabId,
  tabsById,
  onActivate,
  onClose,
  onMoveTabInGroup,
  onDropTabFromOtherGroup,
}: TabStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const onDragStartTab = (e: DragEvent, tabId: string) => {
    e.dataTransfer.setData(TAB_DRAG_MIME, JSON.stringify({ tabId, fromGroupId: groupId }));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOverStrip = (e: DragEvent) => {
    if (!isTabDragTransfer(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const dropIndexFromPoint = (clientX: number): number => {
    const root = scrollRef.current;
    if (!root) return tabIds.length;
    const buttons = [...root.querySelectorAll<HTMLElement>("[data-workspace-tab-id]")];
    for (let i = 0; i < buttons.length; i++) {
      const r = buttons[i]!.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      if (clientX < mid) return i;
    }
    return tabIds.length;
  };

  const onDropStrip = (e: DragEvent) => {
    const payload = parseTabDrag(e.dataTransfer);
    if (!payload) return;
    e.preventDefault();
    const insertAt = dropIndexFromPoint(e.clientX);
    if (payload.fromGroupId === groupId) {
      onMoveTabInGroup(payload.tabId, insertAt);
    } else {
      onDropTabFromOtherGroup(payload.tabId, payload.fromGroupId, insertAt);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 flex-nowrap gap-0.5 overflow-x-auto overflow-y-hidden"
        onDragOver={onDragOverStrip}
        onDrop={onDropStrip}
      >
        {tabIds.map((tid) => {
          const tab = tabsById[tid];
          if (!tab) return null;
          const active = tid === activeTabId;
          return (
            <div
              key={tid}
              className={`flex min-w-0 max-w-[11rem] shrink-0 items-center rounded-t border border-b-0 px-1 text-sm ${
                active ? "border-gray-400 bg-white" : "border-transparent bg-gray-100 text-gray-700"
              }`}
              data-workspace-tab-id={tid}
              onDragOver={(e) => {
                if (!isTabDragTransfer(e.dataTransfer)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
            >
              <button
                type="button"
                draggable
                onDragStart={(ev) => onDragStartTab(ev, tid)}
                className="min-w-0 flex-1 truncate px-1 py-1.5 text-left"
                onClick={() => onActivate(tid)}
                aria-selected={active}
                role="tab"
              >
                {tab.fileName}
              </button>
              <button
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-gray-200"
                aria-label={tab.dirty ? "Close tab (unsaved changes)" : "Close tab"}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onClose(tid);
                }}
              >
                {tab.dirty ? (
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full border-2 border-gray-600"
                    title="Unsaved (stub)"
                  />
                ) : (
                  <span aria-hidden>×</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <label className="sr-only" htmlFor={`${groupId}-tab-select`}>
        Open tab
      </label>
      <select
        id={`${groupId}-tab-select`}
        className="ml-1 max-w-[10rem] shrink-0 rounded border border-gray-300 bg-white px-1 py-1 text-xs"
        value={activeTabId ?? ""}
        onChange={(ev) => {
          const v = ev.target.value;
          if (v) onActivate(v);
        }}
      >
        {tabIds.map((tid) => {
          const tab = tabsById[tid];
          if (!tab) return null;
          return (
            <option key={tid} value={tid}>
              {tab.fileName}
            </option>
          );
        })}
      </select>
    </div>
  );
}

interface SplitDropZoneProps {
  readonly rowId: string;
  /** Insert the new group before this group id; `null` means append at the end of the row. */
  readonly beforeGroupId: string | null;
  readonly onSplitDrop: (
    tabId: string,
    fromGroupId: string,
    targetRowId: string,
    beforeGroupId: string | null,
  ) => void;
}

function SplitDropZone({ rowId, beforeGroupId, onSplitDrop }: SplitDropZoneProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={`relative shrink-0 ${hover ? "w-2 bg-blue-200/80" : "w-1 bg-transparent hover:bg-blue-100"}`}
      onDragEnter={(e) => {
        if (isTabDragTransfer(e.dataTransfer)) setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDragOver={(e) => {
        if (!isTabDragTransfer(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setHover(true);
      }}
      onDrop={(e) => {
        const p = parseTabDrag(e.dataTransfer);
        setHover(false);
        if (!p) return;
        e.preventDefault();
        onSplitDrop(p.tabId, p.fromGroupId, rowId, beforeGroupId);
      }}
      title="Drag tab here for a new editor group"
      aria-label="New editor group drop zone"
    />
  );
}

interface InterGroupResizableGapProps {
  readonly boundaryIndex: number;
  readonly rowId: string;
  readonly beforeGroupId: string;
  readonly layoutRef: RefObject<HTMLDivElement | null>;
  readonly fractions: readonly number[];
  readonly setFractions: Dispatch<SetStateAction<number[]>>;
  readonly onSplitDrop: (
    tabId: string,
    fromGroupId: string,
    targetRowId: string,
    beforeGroupId: string | null,
  ) => void;
}

function InterGroupResizableGap({
  boundaryIndex,
  rowId,
  beforeGroupId,
  layoutRef,
  fractions,
  setFractions,
  onSplitDrop,
}: InterGroupResizableGapProps) {
  const [dropHover, setDropHover] = useState(false);
  const dragRef = useRef<{ startX: number; startFrac: number[] } | null>(null);

  const onResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const host = layoutRef.current;
    if (!host) return;
    const startX = e.clientX;
    const startFrac = [...fractions];
    dragRef.current = { startX, startFrac };

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const hostNow = layoutRef.current;
      const widthNow = hostNow?.getBoundingClientRect().width || 1;
      const t = (ev.clientX - drag.startX) / widthNow;
      const i = boundaryIndex;
      const pairSum = drag.startFrac[i]! + drag.startFrac[i + 1]!;
      let na = drag.startFrac[i]! + t;
      let nb = pairSum - na;
      na = Math.max(MIN_GROUP_FRAC, Math.min(pairSum - MIN_GROUP_FRAC, na));
      nb = pairSum - na;
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
    <div
      className={`relative z-10 flex shrink-0 flex-col ${dropHover ? "w-2 bg-blue-200/70" : "w-1.5 bg-gray-200"}`}
      onDragEnter={(e) => {
        if (isTabDragTransfer(e.dataTransfer)) setDropHover(true);
      }}
      onDragLeave={() => setDropHover(false)}
      onDragOver={(e) => {
        if (!isTabDragTransfer(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropHover(true);
      }}
      onDrop={(e) => {
        const p = parseTabDrag(e.dataTransfer);
        setDropHover(false);
        if (!p) return;
        e.preventDefault();
        onSplitDrop(p.tabId, p.fromGroupId, rowId, beforeGroupId);
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor groups"
        tabIndex={0}
        className="min-h-0 flex-1 cursor-col-resize border-l border-gray-300 hover:bg-gray-400"
        onMouseDown={onResizeMouseDown}
      />
    </div>
  );
}

interface InterRowResizableGapProps {
  readonly boundaryIndex: number;
  readonly layoutRef: RefObject<HTMLDivElement | null>;
  readonly rowFractions: readonly number[];
  readonly setRowFractions: Dispatch<SetStateAction<number[]>>;
}

function InterRowResizableGap({ boundaryIndex, layoutRef, rowFractions, setRowFractions }: InterRowResizableGapProps) {
  const dragRef = useRef<{ startY: number; startFrac: number[] } | null>(null);

  const onResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const host = layoutRef.current;
    if (!host) return;
    const startY = e.clientY;
    const startFrac = [...rowFractions];
    dragRef.current = { startY, startFrac };

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const heightNow = layoutRef.current?.getBoundingClientRect().height || 1;
      const t = (ev.clientY - drag.startY) / heightNow;
      const i = boundaryIndex;
      const pairSum = drag.startFrac[i]! + drag.startFrac[i + 1]!;
      let na = drag.startFrac[i]! + t;
      let nb = pairSum - na;
      na = Math.max(MIN_ROW_FRAC, Math.min(pairSum - MIN_ROW_FRAC, na));
      nb = pairSum - na;
      setRowFractions((prev) => {
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
    <div className="relative z-10 flex h-1.5 shrink-0 flex-row bg-gray-200">
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize editor rows"
        tabIndex={0}
        className="min-w-0 flex-1 cursor-ns-resize border-t border-gray-300 hover:bg-gray-400"
        onMouseDown={onResizeMouseDown}
      />
    </div>
  );
}

interface EditorGroupPanelProps {
  readonly group: UsfmWorkspaceEditorGroupState;
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivateTab: (groupId: string, tabId: string) => void;
  readonly onCloseTab: (groupId: string, tabId: string) => void;
  readonly onUpdateValue: (tabId: string, value: string) => void;
  readonly onMoveTabWithinGroup: (groupId: string, tabId: string, toIndex: number) => void;
  readonly onDropTabFromOtherGroup: (
    targetGroupId: string,
    tabId: string,
    fromGroupId: string,
    insertIndex: number,
  ) => void;
  readonly onSplitCurrentTabRight?: (groupId: string, tabId: string) => void;
  readonly onSplitCurrentTabBelow?: (groupId: string, tabId: string) => void;
}

function EditorGroupPanel({
  group,
  tabsById,
  onActivateTab,
  onCloseTab,
  onUpdateValue,
  onMoveTabWithinGroup,
  onDropTabFromOtherGroup,
  onSplitCurrentTabRight,
  onSplitCurrentTabBelow,
}: EditorGroupPanelProps) {
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const showSplitControls = Boolean(onSplitCurrentTabRight || onSplitCurrentTabBelow);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex min-h-[2.25rem] shrink-0 items-stretch border-b border-gray-300 bg-gray-50">
        <TabStrip
          groupId={group.id}
          tabIds={group.tabIds}
          activeTabId={group.activeTabId}
          tabsById={tabsById}
          onActivate={(tabId) => onActivateTab(group.id, tabId)}
          onClose={(tabId) => onCloseTab(group.id, tabId)}
          onMoveTabInGroup={(tabId, toIndex) => onMoveTabWithinGroup(group.id, tabId, toIndex)}
          onDropTabFromOtherGroup={(tabId, fromGroupId, insertIndex) =>
            onDropTabFromOtherGroup(group.id, tabId, fromGroupId, insertIndex)
          }
        />
        <div
          ref={setToolbarEl}
          className="flex shrink-0 items-center gap-1 border-l border-gray-200 bg-gray-50 px-1.5"
        >
          {showSplitControls ? (
            <>
              {onSplitCurrentTabRight ? (
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                  aria-label="Move tab to a new editor group on the right"
                  title="New editor group to the right"
                  disabled={!group.activeTabId}
                  onClick={() => {
                    const tid = group.activeTabId;
                    if (tid) onSplitCurrentTabRight(group.id, tid);
                  }}
                >
                  <IconSplitGroupRight />
                </button>
              ) : null}
              {onSplitCurrentTabBelow ? (
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                  aria-label="Move tab to a new editor group below"
                  title="New editor group below"
                  disabled={!group.activeTabId}
                  onClick={() => {
                    const tid = group.activeTabId;
                    if (tid) onSplitCurrentTabBelow(group.id, tid);
                  }}
                >
                  <IconSplitGroupBelow />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <div className="relative grid min-h-0 flex-1 grid-cols-1 grid-rows-1">
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
              <UsfmPane
                value={tab.value}
                onChange={(v) => onUpdateValue(tid, v)}
                toolbarMount={toolbarEl}
                toolbarActive={active}
                className="min-h-0 flex-1 rounded-none border-0"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WorkspaceRowProps {
  readonly row: UsfmWorkspaceEditorRowState;
  readonly rowIndex: number;
  readonly columnFractions: readonly number[];
  readonly setColumnFractions: Dispatch<SetStateAction<number[][]>>;
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivateTab: UsfmWorkspaceProps["onActivateTab"];
  readonly onCloseTab: UsfmWorkspaceProps["onCloseTab"];
  readonly onUpdateTabValue: UsfmWorkspaceProps["onUpdateTabValue"];
  readonly onReorderTabInGroup: UsfmWorkspaceProps["onReorderTabInGroup"];
  readonly onMoveTabToGroup: UsfmWorkspaceProps["onMoveTabToGroup"];
  readonly onSplitDrop: (
    tabId: string,
    fromGroupId: string,
    targetRowId: string,
    beforeGroupId: string | null,
  ) => void;
  readonly onSplitCurrentTabRight?: UsfmWorkspaceProps["onSplitCurrentTabRight"];
  readonly onSplitCurrentTabBelow?: UsfmWorkspaceProps["onSplitCurrentTabBelow"];
}

function WorkspaceRow({
  row,
  rowIndex,
  columnFractions,
  setColumnFractions,
  tabsById,
  onActivateTab,
  onCloseTab,
  onUpdateTabValue,
  onReorderTabInGroup,
  onMoveTabToGroup,
  onSplitDrop,
  onSplitCurrentTabRight,
  onSplitCurrentTabBelow,
}: WorkspaceRowProps) {
  const layoutRef = useRef<HTMLDivElement | null>(null);

  const setFractionsForRow = useCallback(
    (action: SetStateAction<number[]>) => {
      setColumnFractions((prev) => {
        const next = [...prev];
        const cur = next[rowIndex] ?? [];
        const resolved = typeof action === "function" ? action([...cur]) : action;
        next[rowIndex] = resolved;
        return next;
      });
    },
    [rowIndex, setColumnFractions],
  );

  const onDropTabFromOtherGroup = useCallback(
    (targetGroupId: string, tabId: string, fromGroupId: string, insertIndex: number) => {
      if (fromGroupId === targetGroupId) return;
      onMoveTabToGroup({ tabId, fromGroupId, toGroupId: targetGroupId, insertIndex });
    },
    [onMoveTabToGroup],
  );

  const firstG = row.groups[0];
  return (
    <div ref={layoutRef} className="flex min-h-0 min-w-0 flex-1 flex-row">
      {firstG ? <SplitDropZone rowId={row.id} beforeGroupId={firstG.id} onSplitDrop={onSplitDrop} /> : null}
      {row.groups.map((g, idx) => (
        <Fragment key={g.id}>
          <div
            className="flex min-h-0 min-w-[8rem] flex-col"
            style={{
              flexGrow: columnFractions[idx] ?? 1,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: "min(12rem, 22%)",
            }}
          >
            <EditorGroupPanel
              group={g}
              tabsById={tabsById}
              onActivateTab={onActivateTab}
              onCloseTab={onCloseTab}
              onUpdateValue={onUpdateTabValue}
              onMoveTabWithinGroup={onReorderTabInGroup}
              onDropTabFromOtherGroup={onDropTabFromOtherGroup}
              onSplitCurrentTabRight={onSplitCurrentTabRight}
              onSplitCurrentTabBelow={onSplitCurrentTabBelow}
            />
          </div>
          {idx < row.groups.length - 1 ? (
            <InterGroupResizableGap
              boundaryIndex={idx}
              rowId={row.id}
              beforeGroupId={row.groups[idx + 1]!.id}
              layoutRef={layoutRef}
              fractions={columnFractions}
              setFractions={setFractionsForRow}
              onSplitDrop={onSplitDrop}
            />
          ) : (
            <SplitDropZone rowId={row.id} beforeGroupId={null} onSplitDrop={onSplitDrop} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

export function UsfmWorkspace({
  rows,
  tabsById,
  onActivateTab,
  onUpdateTabValue,
  onCloseTab,
  onReorderTabInGroup,
  onMoveTabToGroup,
  onSplitTabToNewGroup,
  onSplitCurrentTabRight,
  onSplitCurrentTabBelow,
  className,
}: UsfmWorkspaceProps) {
  const colLayoutRef = useRef<HTMLDivElement>(null);
  const rowsKey = useMemo(() => rows.map((r) => r.groups.map((g) => g.id).join(",")).join("|"), [rows]);

  const [rowFractions, setRowFractions] = useState<number[]>(() =>
    rows.length > 0 ? rows.map(() => 1 / rows.length) : [1],
  );

  const [colFractions, setColFractions] = useState<number[][]>(() =>
    rows.map((r) => (r.groups.length > 0 ? r.groups.map(() => 1 / r.groups.length) : [1])),
  );

  useEffect(() => {
    setRowFractions((prev) => {
      if (prev.length === rows.length) return prev;
      const n = rows.length;
      return n > 0 ? Array.from({ length: n }, () => 1 / n) : [1];
    });
  }, [rows.length]);

  useEffect(() => {
    setColFractions((prev) =>
      rows.map((row, ri) => {
        const n = row.groups.length;
        const old = prev[ri];
        if (old && old.length === n) return old;
        return n > 0 ? Array.from({ length: n }, () => 1 / n) : [1];
      }),
    );
  }, [rowsKey]);

  const onSplitDrop = useCallback(
    (tabId: string, fromGroupId: string, targetRowId: string, beforeGroupId: string | null) => {
      onSplitTabToNewGroup({ tabId, fromGroupId, targetRowId, beforeGroupId });
    },
    [onSplitTabToNewGroup],
  );

  return (
    <div
      className={`flex min-h-[320px] min-w-0 flex-1 flex-col bg-gray-200 ${className ?? ""}`}
      data-testid="usfm-workspace"
    >
      <div ref={colLayoutRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
        {rows.map((row, ri) => (
          <Fragment key={row.id}>
            <div
              className="flex min-h-0 min-w-0 flex-col"
              style={{
                flexGrow: rowFractions[ri] ?? 1,
                flexShrink: 1,
                flexBasis: 0,
                minHeight: rows.length > 1 ? "min(10rem, 22%)" : undefined,
              }}
            >
              <WorkspaceRow
                row={row}
                rowIndex={ri}
                columnFractions={colFractions[ri] ?? [1]}
                setColumnFractions={setColFractions}
                tabsById={tabsById}
                onActivateTab={onActivateTab}
                onCloseTab={onCloseTab}
                onUpdateTabValue={onUpdateTabValue}
                onReorderTabInGroup={onReorderTabInGroup}
                onMoveTabToGroup={onMoveTabToGroup}
                onSplitDrop={onSplitDrop}
                onSplitCurrentTabRight={onSplitCurrentTabRight}
                onSplitCurrentTabBelow={onSplitCurrentTabBelow}
              />
            </div>
            {ri < rows.length - 1 ? (
              <InterRowResizableGap
                boundaryIndex={ri}
                layoutRef={colLayoutRef}
                rowFractions={rowFractions}
                setRowFractions={setRowFractions}
              />
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
