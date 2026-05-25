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
  readonly id?: string;
  readonly fileName: string;
  readonly value: string;
  readonly dirty?: boolean;
  readonly groupIndex?: number;
}

export interface UsfmWorkspaceModel {
  readonly groups: readonly UsfmWorkspaceEditorGroupState[];
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
}

export interface UsfmWorkspaceProps {
  readonly groups: readonly UsfmWorkspaceEditorGroupState[];
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivateTab: (groupId: string, tabId: string) => void;
  readonly onUpdateTabValue: (tabId: string, value: string) => void;
  readonly onCloseTab: (groupId: string, tabId: string) => void;
  readonly onReorderTabInGroup: (groupId: string, tabId: string, toIndex: number) => void;
  readonly onMoveTabToGroup: (detail: {
    readonly tabId: string;
    readonly fromGroupId: string;
    readonly toGroupId: string;
    readonly insertIndex: number;
  }) => void;
  readonly onSplitTabToNewGroup: (detail: {
    readonly tabId: string;
    readonly fromGroupId: string;
    readonly insertGroupIndex: number;
  }) => void;
  readonly className?: string;
}

function cloneGroup(g: UsfmWorkspaceEditorGroupState): { id: string; tabIds: string[]; activeTabId: string | null } {
  return { id: g.id, tabIds: [...g.tabIds], activeTabId: g.activeTabId };
}

function asModel(groups: Array<{ id: string; tabIds: string[]; activeTabId: string | null }>, tabsById: Record<string, UsfmWorkspaceTabState>): UsfmWorkspaceModel {
  return { groups, tabsById };
}

/** Stable id for groups and tabs (crypto when available). */
export function newWorkspaceId(prefix: string): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return `${prefix}-${c.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
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

function pruneTabs(
  groups: Array<{ id: string; tabIds: string[]; activeTabId: string | null }>,
  tabsById: Record<string, UsfmWorkspaceTabState>,
): Record<string, UsfmWorkspaceTabState> {
  const used = new Set<string>();
  for (const g of groups) for (const t of g.tabIds) used.add(t);
  const next = { ...tabsById };
  for (const k of Object.keys(next)) {
    if (!used.has(k)) delete next[k];
  }
  return next;
}

/** Build initial `{ groups, tabsById }` from Storybook-style tab descriptors (grouped by `groupIndex`). */
export function buildWorkspaceModelFromInitialTabs(
  initialTabs: readonly UsfmWorkspaceInitialTab[],
): UsfmWorkspaceModel {
  const tabsById: Record<string, UsfmWorkspaceTabState> = {};
  const groupBuckets = new Map<number, string[]>();

  for (const t of initialTabs) {
    const id = t.id ?? newWorkspaceId("tab");
    const gi = t.groupIndex ?? 0;
    tabsById[id] = { id, fileName: t.fileName, value: t.value, dirty: t.dirty ?? false };
    if (!groupBuckets.has(gi)) groupBuckets.set(gi, []);
    groupBuckets.get(gi)!.push(id);
  }

  const sortedKeys = [...groupBuckets.keys()].sort((a, b) => a - b);
  const groups = sortedKeys.map((gk) => {
    const ids = groupBuckets.get(gk)!;
    return {
      id: newWorkspaceId("group"),
      tabIds: ids,
      activeTabId: ids[0] ?? null,
    };
  });

  if (groups.length === 0) {
    const id = newWorkspaceId("tab");
    tabsById[id] = { id, fileName: "Untitled.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 ", dirty: false };
    return asModel([{ id: newWorkspaceId("group"), tabIds: [id], activeTabId: id }], tabsById);
  }

  return asModel(groups, tabsById);
}

export function workspaceActivateTab(model: UsfmWorkspaceModel, groupId: string, tabId: string): UsfmWorkspaceModel {
  const groups = model.groups.map((g) => (g.id === groupId ? { ...cloneGroup(g), activeTabId: tabId } : cloneGroup(g)));
  return asModel(groups, { ...model.tabsById });
}

export function workspaceSetTabValue(model: UsfmWorkspaceModel, tabId: string, value: string): UsfmWorkspaceModel {
  const cur = model.tabsById[tabId];
  if (!cur || cur.value === value) return model;
  return asModel(
    model.groups.map(cloneGroup),
    { ...model.tabsById, [tabId]: { ...cur, value } },
  );
}

export function workspaceCloseTab(model: UsfmWorkspaceModel, groupId: string, tabId: string): UsfmWorkspaceModel {
  const gi = model.groups.findIndex((g) => g.id === groupId);
  if (gi < 0) return model;
  const g = model.groups[gi]!;
  const nextIds = removeTabFromGroup(g.tabIds, tabId);
  let nextActive = g.activeTabId;
  if (nextActive === tabId) nextActive = nextIds[0] ?? null;

  let groups = model.groups.map((gr, idx) =>
    idx === gi ? { ...cloneGroup(gr), tabIds: nextIds, activeTabId: nextActive } : cloneGroup(gr),
  );

  if (nextIds.length === 0 && groups.length > 1) {
    groups = groups.filter((_, idx) => idx !== gi);
  } else if (nextIds.length === 0 && groups.length === 1) {
    const id = newWorkspaceId("tab");
    const blank: UsfmWorkspaceTabState = {
      id,
      fileName: "Untitled.usfm",
      value: "\\id GEN\n\\c 1\n\\p\n\\v 1 ",
      dirty: false,
    };
    groups = [{ ...groups[0]!, tabIds: [id], activeTabId: id }];
    const tabsById = pruneTabs(groups, { ...model.tabsById, [id]: blank });
    return asModel(groups, tabsById);
  }

  const tabsById = pruneTabs(groups, { ...model.tabsById });
  return asModel(groups, tabsById);
}

export function workspaceReorderTabInGroup(
  model: UsfmWorkspaceModel,
  groupId: string,
  tabId: string,
  toIndex: number,
): UsfmWorkspaceModel {
  const groups = model.groups.map((g) =>
    g.id === groupId ? { ...cloneGroup(g), tabIds: insertTabAt(g.tabIds, tabId, toIndex) } : cloneGroup(g),
  );
  return asModel(groups, { ...model.tabsById });
}

export function workspaceMoveTabToGroup(
  model: UsfmWorkspaceModel,
  detail: { readonly tabId: string; readonly fromGroupId: string; readonly toGroupId: string; readonly insertIndex: number },
): UsfmWorkspaceModel {
  const { tabId, fromGroupId, toGroupId, insertIndex } = detail;
  if (fromGroupId === toGroupId) return model;

  const fromI = model.groups.findIndex((g) => g.id === fromGroupId);
  const toI = model.groups.findIndex((g) => g.id === toGroupId);
  if (fromI < 0 || toI < 0) return model;

  const fromG = model.groups[fromI]!;
  const toG = model.groups[toI]!;
  const fromNextIds = removeTabFromGroup(fromG.tabIds, tabId);
  let fromActive = fromG.activeTabId;
  if (fromActive === tabId) fromActive = fromNextIds[0] ?? null;

  const toNextIds = insertTabAt(toG.tabIds, tabId, insertIndex);

  let groups = model.groups.map((g, idx) => {
    if (idx === fromI) return { ...cloneGroup(g), tabIds: fromNextIds, activeTabId: fromActive };
    if (idx === toI) return { ...cloneGroup(g), tabIds: toNextIds, activeTabId: tabId };
    return cloneGroup(g);
  });

  groups = groups.filter((gr) => gr.tabIds.length > 0);
  const tabsById = pruneTabs(groups, { ...model.tabsById });
  return asModel(groups, tabsById);
}

export function workspaceSplitTabToNewGroup(
  model: UsfmWorkspaceModel,
  detail: { readonly tabId: string; readonly fromGroupId: string; readonly insertGroupIndex: number },
): UsfmWorkspaceModel {
  const { tabId, fromGroupId, insertGroupIndex } = detail;
  const fromI = model.groups.findIndex((g) => g.id === fromGroupId);
  if (fromI < 0) return model;
  const fromG = model.groups[fromI]!;
  if (!fromG.tabIds.includes(tabId)) return model;

  const fromNextIds = removeTabFromGroup(fromG.tabIds, tabId);
  let fromActive = fromG.activeTabId;
  if (fromActive === tabId) fromActive = fromNextIds[0] ?? null;

  let groups = model.groups.map((g, idx) =>
    idx === fromI ? { ...cloneGroup(g), tabIds: fromNextIds, activeTabId: fromActive } : cloneGroup(g),
  );

  groups = groups.filter((gr) => gr.tabIds.length > 0);

  const newGroup = {
    id: newWorkspaceId("group"),
    tabIds: [tabId],
    activeTabId: tabId,
  };

  const clamped = Math.max(0, Math.min(insertGroupIndex, groups.length));
  groups = [...groups.slice(0, clamped), newGroup, ...groups.slice(clamped)];

  const tabsById = pruneTabs(groups, { ...model.tabsById });
  return asModel(groups, tabsById);
}

/**
 * Append a new tab to a group (for example after opening a file). By default the new tab becomes active.
 */
export function workspaceAppendTab(
  model: UsfmWorkspaceModel,
  options: {
    readonly groupId: string;
    readonly tab: { readonly id?: string; readonly fileName: string; readonly value: string; readonly dirty?: boolean };
    readonly activate?: boolean;
  },
): UsfmWorkspaceModel {
  const id = options.tab.id ?? newWorkspaceId("tab");
  const tab: UsfmWorkspaceTabState = {
    id,
    fileName: options.tab.fileName,
    value: options.tab.value,
    dirty: options.tab.dirty ?? false,
  };
  const activate = options.activate !== false;
  const groups = model.groups.map((g) => {
    if (g.id !== options.groupId) return cloneGroup(g);
    if (g.tabIds.includes(id)) return cloneGroup(g);
    return {
      ...cloneGroup(g),
      tabIds: [...g.tabIds, id],
      activeTabId: activate ? id : g.activeTabId,
    };
  });
  return asModel(groups, { ...model.tabsById, [id]: tab });
}
