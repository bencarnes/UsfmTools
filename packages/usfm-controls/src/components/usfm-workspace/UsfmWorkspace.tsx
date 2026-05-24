import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { UsfmPane } from "../usfm-pane/UsfmPane.js";

const TAB_DRAG_MIME = "application/vnd.usfmtools.workspace-tab+json";

export interface UsfmWorkspaceTabState {
  readonly id: string;
  readonly fileName: string;
  readonly value: string;
  /**
   * Stub for future save integration. When true, the tab close affordance uses a circle (dirty)
   * instead of an × (clean), similar to VS Code.
   */
  readonly dirty: boolean;
}

export interface UsfmWorkspaceEditorGroupState {
  readonly id: string;
  readonly tabIds: readonly string[];
  readonly activeTabId: string | null;
}

export interface UsfmWorkspaceInitialTab {
  /** Stable id for tests; generated when omitted. */
  readonly id?: string;
  readonly fileName: string;
  readonly value: string;
  readonly dirty?: boolean;
  /**
   * Tabs with the same index start in the same editor group. Groups are ordered by ascending
   * `groupIndex` (missing counts as `0`).
   */
  readonly groupIndex?: number;
}

export interface UsfmWorkspaceProps {
  readonly initialTabs: readonly UsfmWorkspaceInitialTab[];
  readonly className?: string;
}

function newId(prefix: string): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return `${prefix}-${c.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

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

function removeTabFromGroup(tabIds: readonly string[], tabId: string): string[] {
  return tabIds.filter((t) => t !== tabId);
}

function insertTabAt(tabIds: readonly string[], tabId: string, index: number): string[] {
  const filtered = tabIds.filter((t) => t !== tabId);
  const i = Math.max(0, Math.min(index, filtered.length));
  const next = [...filtered];
  next.splice(i, 0, tabId);
  return next;
}

function buildInitialWorkspace(initialTabs: readonly UsfmWorkspaceInitialTab[]): {
  groups: { id: string; tabIds: string[]; activeTabId: string | null }[];
  tabsById: Record<string, UsfmWorkspaceTabState>;
} {
  const tabsById: Record<string, UsfmWorkspaceTabState> = {};
  const groupBuckets = new Map<number, string[]>();

  for (const t of initialTabs) {
    const id = t.id ?? newId("tab");
    const gi = t.groupIndex ?? 0;
    tabsById[id] = { id, fileName: t.fileName, value: t.value, dirty: t.dirty ?? false };
    if (!groupBuckets.has(gi)) groupBuckets.set(gi, []);
    groupBuckets.get(gi)!.push(id);
  }

  const sortedKeys = [...groupBuckets.keys()].sort((a, b) => a - b);
  const groups = sortedKeys.map((gk) => {
    const ids = groupBuckets.get(gk)!;
    return {
      id: newId("group"),
      tabIds: ids,
      activeTabId: ids[0] ?? null,
    };
  });

  if (groups.length === 0) {
    const id = newId("tab");
    tabsById[id] = { id, fileName: "Untitled.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 ", dirty: false };
    return {
      groups: [{ id: newId("group"), tabIds: [id], activeTabId: id }],
      tabsById,
    };
  }

  return { groups, tabsById };
}

type Group = { id: string; tabIds: string[]; activeTabId: string | null };

type WorkspaceModel = { groups: Group[]; tabsById: Record<string, UsfmWorkspaceTabState> };

function pruneTabs(groups: Group[], tabsById: Record<string, UsfmWorkspaceTabState>) {
  const used = new Set<string>();
  for (const g of groups) for (const t of g.tabIds) used.add(t);
  const next = { ...tabsById };
  for (const k of Object.keys(next)) {
    if (!used.has(k)) delete next[k];
  }
  return next;
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
  readonly tabsById: Record<string, UsfmWorkspaceTabState>;
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

export function UsfmWorkspace({ initialTabs, className }: UsfmWorkspaceProps) {
  const built = useMemo(() => buildInitialWorkspace(initialTabs), [initialTabs]);
  const [model, setModel] = useState<WorkspaceModel>(() => built);

  const onActivateTab = useCallback((groupId: string, tabId: string) => {
    setModel((m) => ({
      ...m,
      groups: m.groups.map((g) => (g.id === groupId ? { ...g, activeTabId: tabId } : g)),
    }));
  }, []);

  const onUpdateValue = useCallback((tabId: string, value: string) => {
    setModel((m) => {
      const cur = m.tabsById[tabId];
      if (!cur || cur.value === value) return m;
      return {
        ...m,
        tabsById: { ...m.tabsById, [tabId]: { ...cur, value } },
      };
    });
  }, []);

  const onCloseTab = useCallback((groupId: string, tabId: string) => {
    setModel((m) => {
      const gi = m.groups.findIndex((g) => g.id === groupId);
      if (gi < 0) return m;
      const g = m.groups[gi]!;
      const nextIds = removeTabFromGroup(g.tabIds, tabId);
      let nextActive = g.activeTabId;
      if (nextActive === tabId) nextActive = nextIds[0] ?? null;

      let nextGroups = m.groups.map((gr, idx) =>
        idx === gi ? { ...gr, tabIds: nextIds, activeTabId: nextActive } : gr,
      );

      if (nextIds.length === 0 && nextGroups.length > 1) {
        nextGroups = nextGroups.filter((_, idx) => idx !== gi);
      } else if (nextIds.length === 0 && nextGroups.length === 1) {
        const id = newId("tab");
        const blank: UsfmWorkspaceTabState = {
          id,
          fileName: "Untitled.usfm",
          value: "\\id GEN\n\\c 1\n\\p\n\\v 1 ",
          dirty: false,
        };
        nextGroups = [{ ...nextGroups[0]!, tabIds: [id], activeTabId: id }];
        const tabsById = pruneTabs(nextGroups, { ...m.tabsById, [id]: blank });
        return { groups: nextGroups, tabsById };
      }

      const tabsById = pruneTabs(nextGroups, m.tabsById);
      return { groups: nextGroups, tabsById };
    });
  }, []);

  const onMoveTabWithinGroup = useCallback((groupId: string, tabId: string, toIndex: number) => {
    setModel((m) => ({
      ...m,
      groups: m.groups.map((g) =>
        g.id === groupId ? { ...g, tabIds: insertTabAt(g.tabIds, tabId, toIndex) } : g,
      ),
    }));
  }, []);

  const onDropTabFromOtherGroup = useCallback(
    (targetGroupId: string, tabId: string, fromGroupId: string, insertIndex: number) => {
      if (fromGroupId === targetGroupId) return;
      setModel((m) => {
        const fromI = m.groups.findIndex((g) => g.id === fromGroupId);
        const toI = m.groups.findIndex((g) => g.id === targetGroupId);
        if (fromI < 0 || toI < 0) return m;

        const fromG = m.groups[fromI]!;
        const toG = m.groups[toI]!;
        const fromNextIds = removeTabFromGroup(fromG.tabIds, tabId);
        let fromActive = fromG.activeTabId;
        if (fromActive === tabId) fromActive = fromNextIds[0] ?? null;

        const toNextIds = insertTabAt(toG.tabIds, tabId, insertIndex);

        let nextGroups = m.groups.map((g, idx) => {
          if (idx === fromI) return { ...g, tabIds: fromNextIds, activeTabId: fromActive };
          if (idx === toI) return { ...g, tabIds: toNextIds, activeTabId: tabId };
          return g;
        });

        nextGroups = nextGroups.filter((gr) => gr.tabIds.length > 0);
        const tabsById = pruneTabs(nextGroups, m.tabsById);
        return { groups: nextGroups, tabsById };
      });
    },
    [],
  );

  const onSplitDrop = useCallback((tabId: string, fromGroupId: string, insertGroupIndex: number) => {
    setModel((m) => {
      const fromI = m.groups.findIndex((g) => g.id === fromGroupId);
      if (fromI < 0) return m;
      const fromG = m.groups[fromI]!;
      if (!fromG.tabIds.includes(tabId)) return m;

      const fromNextIds = removeTabFromGroup(fromG.tabIds, tabId);
      let fromActive = fromG.activeTabId;
      if (fromActive === tabId) fromActive = fromNextIds[0] ?? null;

      let nextGroups = m.groups.map((g, idx) =>
        idx === fromI ? { ...g, tabIds: fromNextIds, activeTabId: fromActive } : g,
      );

      nextGroups = nextGroups.filter((gr) => gr.tabIds.length > 0);

      const newGroup: Group = {
        id: newId("group"),
        tabIds: [tabId],
        activeTabId: tabId,
      };

      const clamped = Math.max(0, Math.min(insertGroupIndex, nextGroups.length));
      nextGroups = [...nextGroups.slice(0, clamped), newGroup, ...nextGroups.slice(clamped)];

      const tabsById = pruneTabs(nextGroups, m.tabsById);
      return { groups: nextGroups, tabsById };
    });
  }, []);

  return (
    <div
      className={`flex min-h-[320px] min-w-0 flex-1 flex-col bg-gray-200 ${className ?? ""}`}
      data-testid="usfm-workspace"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-row">
        <SplitDropZone edge="before" targetGroupIndex={0} onSplitDrop={onSplitDrop} />
        {model.groups.map((g, idx) => (
          <div key={g.id} className="flex min-h-0 min-w-0 flex-1 flex-row">
            <EditorGroupPanel
              group={g}
              tabsById={model.tabsById}
              onActivateTab={onActivateTab}
              onCloseTab={onCloseTab}
              onUpdateValue={onUpdateValue}
              onMoveTabWithinGroup={onMoveTabWithinGroup}
              onDropTabFromOtherGroup={onDropTabFromOtherGroup}
            />
            <SplitDropZone edge="after" targetGroupIndex={idx} onSplitDrop={onSplitDrop} />
          </div>
        ))}
      </div>
    </div>
  );
}
