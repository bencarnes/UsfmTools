import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { UsfmPane } from "../usfm-pane/UsfmPane.js";
import { TabListDropdown } from "./tab-list-dropdown.js";
import type {
  UsfmWorkspaceEditorGroupState,
  UsfmWorkspaceProps,
  UsfmWorkspaceTabState,
} from "./workspace-model.js";

const TAB_DRAG_MIME = "application/vnd.usfmtools.workspace-tab+json";

/** Minimum share of width for adjacent tab groups while dragging a column split. */
const MIN_COL_FRAC = 0.12;
/** Minimum share of height for adjacent rows while dragging a row split. */
const MIN_ROW_FRAC = 0.12;

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

function isTabDragTransfer(dt: DataTransfer): boolean {
  if (parseTabDrag(dt)) return true;
  for (let i = 0; i < dt.types.length; i++) {
    if (dt.types[i] === TAB_DRAG_MIME) return true;
  }
  return false;
}

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
    <div className="relative z-10 flex w-1.5 shrink-0 flex-col bg-gray-200">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize tab groups"
        tabIndex={0}
        className="min-h-0 flex-1 cursor-col-resize border-l border-gray-300 hover:bg-gray-400"
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
    <div className="relative z-10 flex h-1.5 shrink-0 flex-row bg-gray-200">
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize tab group rows"
        tabIndex={0}
        className="min-w-0 flex-1 cursor-ns-resize border-t border-gray-300 hover:bg-gray-400"
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
    <>
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-nowrap gap-0.5 overflow-x-auto overflow-y-hidden"
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
      <TabListDropdown
        tabIds={tabIds}
        activeTabId={activeTabId}
        tabsById={tabsById}
        onActivate={onActivate}
      />
    </>
  );
}

interface EmptySlotDropTargetProps {
  readonly groupId: string;
  readonly onDropTab: (tabId: string, fromGroupId: string) => void;
}

function EmptySlotDropTarget({ groupId, onDropTab }: EmptySlotDropTargetProps) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col items-center justify-center border border-dashed text-sm ${
        hover ? "border-blue-400 bg-blue-50/60 text-blue-800" : "border-gray-300 bg-gray-50/80 text-gray-500"
      }`}
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
        if (!p || p.fromGroupId === groupId) return;
        e.preventDefault();
        onDropTab(p.tabId, p.fromGroupId);
      }}
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
  readonly onCloseTab: (groupId: string, tabId: string) => void;
  readonly onUpdateValue: (tabId: string, value: string) => void;
  readonly onMoveTabWithinGroup: (groupId: string, tabId: string, toIndex: number) => void;
  readonly onDropTabFromOtherGroup: (
    targetGroupId: string,
    tabId: string,
    fromGroupId: string,
    insertIndex: number,
  ) => void;
}

function EditorGroupPanel({
  group,
  tabsById,
  onActivateTab,
  onCloseTab,
  onUpdateValue,
  onMoveTabWithinGroup,
  onDropTabFromOtherGroup,
}: EditorGroupPanelProps) {
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const isEmpty = group.tabIds.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-gray-300 bg-white">
        <EmptySlotDropTarget
          groupId={group.id}
          onDropTab={(tabId, fromGroupId) => onDropTabFromOtherGroup(group.id, tabId, fromGroupId, 0)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-gray-300 bg-white">
      <div className="relative z-20 flex min-h-[2.25rem] shrink-0 items-stretch border-b border-gray-300 bg-gray-50">
        <div className="flex min-w-0 items-stretch overflow-hidden">
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
        </div>
        <div
          ref={setToolbarEl}
          className="flex min-w-0 flex-1 items-center gap-1 border-l border-gray-200 bg-gray-50 px-1.5"
        />
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

interface WorkspaceGridRowProps {
  readonly rowIndex: number;
  readonly gridCols: number;
  readonly rowSlots: readonly UsfmWorkspaceEditorGroupState[];
  readonly columnFractions: readonly number[];
  readonly setColumnFractions: Dispatch<SetStateAction<number[][]>>;
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivateTab: UsfmWorkspaceProps["onActivateTab"];
  readonly onCloseTab: UsfmWorkspaceProps["onCloseTab"];
  readonly onUpdateTabValue: UsfmWorkspaceProps["onUpdateTabValue"];
  readonly onReorderTabInGroup: UsfmWorkspaceProps["onReorderTabInGroup"];
  readonly onDropTabFromOtherGroup: (
    targetGroupId: string,
    tabId: string,
    fromGroupId: string,
    insertIndex: number,
  ) => void;
}

function WorkspaceGridRow({
  rowIndex,
  gridCols,
  rowSlots,
  columnFractions,
  setColumnFractions,
  tabsById,
  onActivateTab,
  onCloseTab,
  onUpdateTabValue,
  onReorderTabInGroup,
  onDropTabFromOtherGroup,
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
              onCloseTab={onCloseTab}
              onUpdateValue={onUpdateTabValue}
              onMoveTabWithinGroup={onReorderTabInGroup}
              onDropTabFromOtherGroup={onDropTabFromOtherGroup}
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
  onUpdateTabValue,
  onCloseTab,
  onReorderTabInGroup,
  onMoveTabToGroup,
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

  const onDropTabFromOtherGroup = useCallback(
    (targetGroupId: string, tabId: string, fromGroupId: string, insertIndex: number) => {
      if (fromGroupId === targetGroupId) return;
      onMoveTabToGroup({ tabId, fromGroupId, toGroupId: targetGroupId, insertIndex });
    },
    [onMoveTabToGroup],
  );

  return (
    <div
      ref={layoutRef}
      className={`flex min-h-[320px] min-w-0 flex-1 flex-col bg-gray-200 ${className ?? ""}`}
      data-testid="usfm-workspace"
    >
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
                gridCols={gridCols}
                rowSlots={rowSlots}
                columnFractions={colFracs}
                setColumnFractions={setColFractions}
                tabsById={tabsById}
                onActivateTab={onActivateTab}
                onCloseTab={onCloseTab}
                onUpdateTabValue={onUpdateTabValue}
                onReorderTabInGroup={onReorderTabInGroup}
                onDropTabFromOtherGroup={onDropTabFromOtherGroup}
              />
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
