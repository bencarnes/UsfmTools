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

export type WorkspaceGridDimension = 1 | 2;

export interface UsfmWorkspaceInitialTab {
  readonly id?: string;
  readonly fileName: string;
  readonly value: string;
  readonly dirty?: boolean;
  /** Slot index in row-major order (0 = top-left). Defaults to 0. */
  readonly groupIndex?: number;
}

export interface UsfmWorkspaceModel {
  readonly gridRows: WorkspaceGridDimension;
  readonly gridCols: WorkspaceGridDimension;
  /** Row-major tab groups for the current grid (length = gridRows × gridCols). Empty slots have `tabIds: []`. */
  readonly slots: readonly UsfmWorkspaceEditorGroupState[];
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
}

export interface UsfmWorkspaceProps {
  readonly gridRows: WorkspaceGridDimension;
  readonly gridCols: WorkspaceGridDimension;
  readonly slots: readonly UsfmWorkspaceEditorGroupState[];
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
  readonly className?: string;
}

function cloneGroup(g: UsfmWorkspaceEditorGroupState): { id: string; tabIds: string[]; activeTabId: string | null } {
  return { id: g.id, tabIds: [...g.tabIds], activeTabId: g.activeTabId };
}

function asModel(
  gridRows: WorkspaceGridDimension,
  gridCols: WorkspaceGridDimension,
  slots: Array<{ id: string; tabIds: string[]; activeTabId: string | null }>,
  tabsById: Record<string, UsfmWorkspaceTabState>,
): UsfmWorkspaceModel {
  return { gridRows, gridCols, slots, tabsById };
}

function slotCount(rows: WorkspaceGridDimension, cols: WorkspaceGridDimension): number {
  return rows * cols;
}

function clampGridDimension(n: number): WorkspaceGridDimension {
  return n >= 2 ? 2 : 1;
}

function inferGridSize(slotCountNeeded: number): { rows: WorkspaceGridDimension; cols: WorkspaceGridDimension } {
  if (slotCountNeeded <= 1) return { rows: 1, cols: 1 };
  if (slotCountNeeded === 2) return { rows: 1, cols: 2 };
  return { rows: 2, cols: 2 };
}

function findSlotIndex(slots: readonly UsfmWorkspaceEditorGroupState[], groupId: string): number {
  return slots.findIndex((s) => s.id === groupId);
}

function pruneTabs(
  slots: Array<{ id: string; tabIds: string[]; activeTabId: string | null }>,
  tabsById: Record<string, UsfmWorkspaceTabState>,
): Record<string, UsfmWorkspaceTabState> {
  const used = new Set<string>();
  for (const s of slots) for (const t of s.tabIds) used.add(t);
  const next = { ...tabsById };
  for (const k of Object.keys(next)) {
    if (!used.has(k)) delete next[k];
  }
  return next;
}

function newEmptyGroup(): { id: string; tabIds: string[]; activeTabId: string | null } {
  return { id: newWorkspaceId("group"), tabIds: [], activeTabId: null };
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

/** All tab groups in row-major slot order (includes empty slots). */
export function workspaceFlattenGroups(model: UsfmWorkspaceModel): UsfmWorkspaceEditorGroupState[] {
  return [...model.slots];
}

/** Non-empty groups only. */
export function workspaceFlattenNonEmptyGroups(model: UsfmWorkspaceModel): UsfmWorkspaceEditorGroupState[] {
  return model.slots.filter((s) => s.tabIds.length > 0);
}

/** Build initial model from Storybook-style tab descriptors (`groupIndex` = row-major slot). */
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
  const neededSlots = sortedKeys.length > 0 ? Math.max(...sortedKeys) + 1 : 1;
  const { rows, cols } = inferGridSize(neededSlots);
  const count = slotCount(rows, cols);

  const slots = Array.from({ length: count }, () => newEmptyGroup());
  for (const gk of sortedKeys) {
    const ids = groupBuckets.get(gk)!;
    if (gk >= 0 && gk < slots.length) {
      slots[gk] = {
        id: newWorkspaceId("group"),
        tabIds: ids,
        activeTabId: ids[0] ?? null,
      };
    }
  }

  if (sortedKeys.length === 0) {
    return asModel(1, 1, [newEmptyGroup()], tabsById);
  }

  return asModel(rows, cols, slots, tabsById);
}

/**
 * Resize the tab-group grid (max 2×2). Clicking layout cell (r, c) uses rows = r+1, cols = c+1.
 * Tabs from removed slots are redistributed into remaining slots; no tabs are created or destroyed.
 */
export function workspaceSetGridLayout(
  model: UsfmWorkspaceModel,
  rows: WorkspaceGridDimension,
  cols: WorkspaceGridDimension,
): UsfmWorkspaceModel {
  const newRows = clampGridDimension(rows);
  const newCols = clampGridDimension(cols);
  const newCount = slotCount(newRows, newCols);
  const oldCount = slotCount(model.gridRows, model.gridCols);

  const oldSlots = model.slots.map(cloneGroup);
  const nextSlots: Array<{ id: string; tabIds: string[]; activeTabId: string | null }> = [];

  for (let i = 0; i < newCount; i++) {
    if (i < oldCount && i < oldSlots.length) {
      nextSlots.push(cloneGroup(oldSlots[i]!));
    } else {
      nextSlots.push(newEmptyGroup());
    }
  }

  const orphaned: string[] = [];
  for (let i = newCount; i < oldCount; i++) {
    const s = oldSlots[i];
    if (s) orphaned.push(...s.tabIds);
  }

  for (const tabId of orphaned) {
    let target = 0;
    for (let j = 1; j < nextSlots.length; j++) {
      if (nextSlots[j]!.tabIds.length < nextSlots[target]!.tabIds.length) target = j;
    }
    const slot = nextSlots[target]!;
    const nextIds = [...slot.tabIds, tabId];
    nextSlots[target] = { ...slot, tabIds: nextIds, activeTabId: slot.activeTabId ?? tabId };
  }

  return asModel(newRows, newCols, nextSlots, { ...model.tabsById });
}

export function workspaceActivateTab(model: UsfmWorkspaceModel, groupId: string, tabId: string): UsfmWorkspaceModel {
  const slots = model.slots.map((s) => (s.id === groupId ? { ...cloneGroup(s), activeTabId: tabId } : cloneGroup(s)));
  return asModel(model.gridRows, model.gridCols, slots, { ...model.tabsById });
}

export function workspaceSetTabValue(model: UsfmWorkspaceModel, tabId: string, value: string): UsfmWorkspaceModel {
  const cur = model.tabsById[tabId];
  if (!cur || cur.value === value) return model;
  return asModel(
    model.gridRows,
    model.gridCols,
    model.slots.map(cloneGroup),
    { ...model.tabsById, [tabId]: { ...cur, value } },
  );
}

export function workspaceCloseTab(model: UsfmWorkspaceModel, groupId: string, tabId: string): UsfmWorkspaceModel {
  const si = findSlotIndex(model.slots, groupId);
  if (si < 0) return model;
  const g = model.slots[si]!;
  const nextIds = removeTabFromGroup(g.tabIds, tabId);
  let nextActive = g.activeTabId;
  if (nextActive === tabId) nextActive = nextIds[0] ?? null;

  const slots = model.slots.map((s, i) =>
    i === si ? { ...cloneGroup(s), tabIds: nextIds, activeTabId: nextActive } : cloneGroup(s),
  );
  const tabsById = pruneTabs(slots, { ...model.tabsById });
  return asModel(model.gridRows, model.gridCols, slots, tabsById);
}

export function workspaceReorderTabInGroup(
  model: UsfmWorkspaceModel,
  groupId: string,
  tabId: string,
  toIndex: number,
): UsfmWorkspaceModel {
  const slots = model.slots.map((s) =>
    s.id === groupId ? { ...cloneGroup(s), tabIds: insertTabAt(s.tabIds, tabId, toIndex) } : cloneGroup(s),
  );
  return asModel(model.gridRows, model.gridCols, slots, { ...model.tabsById });
}

export function workspaceMoveTabToGroup(
  model: UsfmWorkspaceModel,
  detail: { readonly tabId: string; readonly fromGroupId: string; readonly toGroupId: string; readonly insertIndex: number },
): UsfmWorkspaceModel {
  const { tabId, fromGroupId, toGroupId, insertIndex } = detail;
  if (fromGroupId === toGroupId) return model;

  const fromI = findSlotIndex(model.slots, fromGroupId);
  const toI = findSlotIndex(model.slots, toGroupId);
  if (fromI < 0 || toI < 0) return model;

  const fromG = model.slots[fromI]!;
  const toG = model.slots[toI]!;
  const fromNextIds = removeTabFromGroup(fromG.tabIds, tabId);
  let fromActive = fromG.activeTabId;
  if (fromActive === tabId) fromActive = fromNextIds[0] ?? null;

  const toNextIds = insertTabAt(toG.tabIds, tabId, insertIndex);

  const slots = model.slots.map((s) => {
    if (s.id === fromGroupId) return { ...cloneGroup(s), tabIds: fromNextIds, activeTabId: fromActive };
    if (s.id === toGroupId) return { ...cloneGroup(s), tabIds: toNextIds, activeTabId: tabId };
    return cloneGroup(s);
  });

  const tabsById = pruneTabs(slots, { ...model.tabsById });
  return asModel(model.gridRows, model.gridCols, slots, tabsById);
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
  const si = findSlotIndex(model.slots, options.groupId);
  if (si < 0) return model;

  const slots = model.slots.map((s, i) => {
    if (i !== si) return cloneGroup(s);
    if (s.tabIds.includes(id)) return cloneGroup(s);
    return {
      ...cloneGroup(s),
      tabIds: [...s.tabIds, id],
      activeTabId: activate ? id : s.activeTabId,
    };
  });
  return asModel(model.gridRows, model.gridCols, slots, { ...model.tabsById, [id]: tab });
}
