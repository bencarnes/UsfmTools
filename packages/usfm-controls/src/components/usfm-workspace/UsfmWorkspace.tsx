import { useCallback, useRef, useState, type DragEvent } from "react";
import { UsfmPane } from "../usfm-pane/UsfmPane.js";
import type {
  UsfmWorkspaceEditorGroupState,
  UsfmWorkspaceProps,
  UsfmWorkspaceTabState,
} from "./workspace-model.js";

const TAB_DRAG_MIME = "application/vnd.usfmtools.workspace-tab+json";

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
  const visibleSlots = slots.slice(0, gridRows * gridCols);

  const onDropTabFromOtherGroup = useCallback(
    (targetGroupId: string, tabId: string, fromGroupId: string, insertIndex: number) => {
      if (fromGroupId === targetGroupId) return;
      onMoveTabToGroup({ tabId, fromGroupId, toGroupId: targetGroupId, insertIndex });
    },
    [onMoveTabToGroup],
  );

  return (
    <div
      className={`grid min-h-[320px] min-w-0 flex-1 gap-0.5 bg-gray-200 ${className ?? ""}`}
      data-testid="usfm-workspace"
      style={{
        gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
        gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
      }}
    >
      {visibleSlots.map((group) => (
        <EditorGroupPanel
          key={group.id}
          group={group}
          tabsById={tabsById}
          onActivateTab={onActivateTab}
          onCloseTab={onCloseTab}
          onUpdateValue={onUpdateTabValue}
          onMoveTabWithinGroup={onReorderTabInGroup}
          onDropTabFromOtherGroup={onDropTabFromOtherGroup}
        />
      ))}
    </div>
  );
}
