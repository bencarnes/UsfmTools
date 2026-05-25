import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { UsfmPane } from "../usfm-pane/UsfmPane.js";
import type { UsfmWorkspaceEditorGroupState, UsfmWorkspaceProps, UsfmWorkspaceTabState } from "./workspace-model.js";

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
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 1) {
      setScrollState({ left: false, right: false });
      return;
    }
    setScrollState({
      left: el.scrollLeft > 2,
      right: el.scrollLeft < max - 2,
    });
  }, []);

  useLayoutEffect(() => {
    updateScrollHints();
  }, [tabIds, updateScrollHints]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") {
      updateScrollHints();
      return;
    }
    const ro = new ResizeObserver(() => updateScrollHints());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollHints]);

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 120, behavior: "smooth" });
    window.requestAnimationFrame(updateScrollHints);
  };

  const onDragStartTab = (e: DragEvent, tabId: string) => {
    e.dataTransfer.setData(TAB_DRAG_MIME, JSON.stringify({ tabId, fromGroupId: groupId }));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOverStrip = (e: DragEvent) => {
    if (!parseTabDrag(e.dataTransfer)) return;
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
      <button
        type="button"
        className="shrink-0 border-0 bg-gray-100 px-1 text-gray-700 hover:bg-gray-200 disabled:opacity-30"
        aria-label="Scroll tabs left"
        disabled={!scrollState.left}
        onClick={() => scrollByDir(-1)}
      >
        ◀
      </button>
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 flex-nowrap gap-0.5 overflow-x-auto overflow-y-hidden"
        onScroll={updateScrollHints}
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
      <button
        type="button"
        className="shrink-0 border-0 bg-gray-100 px-1 text-gray-700 hover:bg-gray-200 disabled:opacity-30"
        aria-label="Scroll tabs right"
        disabled={!scrollState.right}
        onClick={() => scrollByDir(1)}
      >
        ▶
      </button>
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
  readonly edge: "before" | "after";
  readonly targetGroupIndex: number;
  readonly onSplitDrop: (tabId: string, fromGroupId: string, insertGroupIndex: number) => void;
}

function SplitDropZone({ edge, targetGroupIndex, onSplitDrop }: SplitDropZoneProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={`relative shrink-0 ${hover ? "w-2 bg-blue-200/80" : "w-1 bg-transparent hover:bg-blue-100"}`}
      onDragEnter={(e) => {
        if (parseTabDrag(e.dataTransfer)) setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDragOver={(e) => {
        if (!parseTabDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setHover(true);
      }}
      onDrop={(e) => {
        const p = parseTabDrag(e.dataTransfer);
        setHover(false);
        if (!p) return;
        e.preventDefault();
        const insertGroupIndex = edge === "before" ? targetGroupIndex : targetGroupIndex + 1;
        onSplitDrop(p.tabId, p.fromGroupId, insertGroupIndex);
      }}
      title="Drag tab here for a new editor group"
      aria-label="New editor group drop zone"
    />
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

  return (
    <div className="flex min-h-0 min-w-[12rem] flex-1 flex-col border-r border-gray-300">
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
          className="flex shrink-0 items-center gap-2 border-l border-gray-200 bg-gray-50 px-2"
        />
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

export function UsfmWorkspace({
  groups,
  tabsById,
  onActivateTab,
  onUpdateTabValue,
  onCloseTab,
  onReorderTabInGroup,
  onMoveTabToGroup,
  onSplitTabToNewGroup,
  className,
}: UsfmWorkspaceProps) {
  const onDropTabFromOtherGroup = useCallback(
    (targetGroupId: string, tabId: string, fromGroupId: string, insertIndex: number) => {
      if (fromGroupId === targetGroupId) return;
      onMoveTabToGroup({ tabId, fromGroupId, toGroupId: targetGroupId, insertIndex });
    },
    [onMoveTabToGroup],
  );

  const onSplitDrop = useCallback(
    (tabId: string, fromGroupId: string, insertGroupIndex: number) => {
      onSplitTabToNewGroup({ tabId, fromGroupId, insertGroupIndex });
    },
    [onSplitTabToNewGroup],
  );

  return (
    <div
      className={`flex min-h-[320px] min-w-0 flex-1 flex-col bg-gray-200 ${className ?? ""}`}
      data-testid="usfm-workspace"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-row">
        <SplitDropZone edge="before" targetGroupIndex={0} onSplitDrop={onSplitDrop} />
        {groups.map((g, idx) => (
          <div key={g.id} className="flex min-h-0 min-w-0 flex-1 flex-row">
            <EditorGroupPanel
              group={g}
              tabsById={tabsById}
              onActivateTab={onActivateTab}
              onCloseTab={onCloseTab}
              onUpdateValue={onUpdateTabValue}
              onMoveTabWithinGroup={onReorderTabInGroup}
              onDropTabFromOtherGroup={onDropTabFromOtherGroup}
            />
            <SplitDropZone edge="after" targetGroupIndex={idx} onSplitDrop={onSplitDrop} />
          </div>
        ))}
      </div>
    </div>
  );
}
