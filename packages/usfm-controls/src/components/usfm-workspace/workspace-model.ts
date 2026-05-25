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

/** One horizontal strip of editor groups (each group has its own tab strip). */
export interface UsfmWorkspaceEditorRowState {
  readonly id: string;
  readonly groups: readonly UsfmWorkspaceEditorGroupState[];
}

export interface UsfmWorkspaceInitialTab {
  readonly id?: string;
  readonly fileName: string;
  readonly value: string;
  readonly dirty?: boolean;
  readonly groupIndex?: number;
}

export interface UsfmWorkspaceModel {
  readonly rows: readonly UsfmWorkspaceEditorRowState[];
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
}

export interface UsfmWorkspaceProps {
  readonly rows: readonly UsfmWorkspaceEditorRowState[];
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
  /**
   * Move `tabId` out of `fromGroupId` into a new singleton group inserted in `targetRowId`
   * before `beforeGroupId`, or at the end of that row when `beforeGroupId` is null.
   */
  readonly onSplitTabToNewGroup: (detail: {
    readonly tabId: string;
    readonly fromGroupId: string;
    readonly targetRowId: string;
    readonly beforeGroupId: string | null;
  }) => void;
  /** Move the active tab into a new group to the right (same row). Omit to hide the toolbar control. */
  readonly onSplitCurrentTabRight?: (groupId: string, tabId: string) => void;
  /** Move the active tab into a new group on a new row below. Omit to hide the toolbar control. */
  readonly onSplitCurrentTabBelow?: (groupId: string, tabId: string) => void;
  readonly className?: string;
}

function cloneGroup(g: UsfmWorkspaceEditorGroupState): { id: string; tabIds: string[]; activeTabId: string | null } {
  return { id: g.id, tabIds: [...g.tabIds], activeTabId: g.activeTabId };
}

function cloneRow(r: UsfmWorkspaceEditorRowState): { id: string; groups: ReturnType<typeof cloneGroup>[] } {
  return { id: r.id, groups: r.groups.map(cloneGroup) };
}

function asModel(
  rows: Array<{ id: string; groups: Array<{ id: string; tabIds: string[]; activeTabId: string | null }> }>,
  tabsById: Record<string, UsfmWorkspaceTabState>,
): UsfmWorkspaceModel {
  return { rows, tabsById };
}

/** Row-major list of all editor groups (convenience for tests and tooling). */
export function workspaceFlattenGroups(model: UsfmWorkspaceModel): UsfmWorkspaceEditorGroupState[] {
  return model.rows.flatMap((r) => [...r.groups]);
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
  rows: Array<{ id: string; groups: Array<{ id: string; tabIds: string[]; activeTabId: string | null }> }>,
  tabsById: Record<string, UsfmWorkspaceTabState>,
): Record<string, UsfmWorkspaceTabState> {
  const used = new Set<string>();
  for (const row of rows) for (const g of row.groups) for (const t of g.tabIds) used.add(t);
  const next = { ...tabsById };
  for (const k of Object.keys(next)) {
    if (!used.has(k)) delete next[k];
  }
  return next;
}

function findGroupLocation(
  rows: readonly UsfmWorkspaceEditorRowState[],
  groupId: string,
): { row: number; col: number } | null {
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r]!.groups.findIndex((g) => g.id === groupId);
    if (c >= 0) return { row: r, col: c };
  }
  return null;
}

/** Remove tab from a group, drop empty groups and empty rows; returns mutable rows. */
function rowsAfterRemovingTab(
  rows: readonly UsfmWorkspaceEditorRowState[],
  fromGroupId: string,
  tabId: string,
): Array<{ id: string; groups: ReturnType<typeof cloneGroup>[] }> | null {
  const loc = findGroupLocation(rows, fromGroupId);
  if (!loc) return null;
  const fromG = rows[loc.row]!.groups[loc.col]!;
  if (!fromG.tabIds.includes(tabId)) return null;

  const fromNextIds = removeTabFromGroup(fromG.tabIds, tabId);
  let fromActive = fromG.activeTabId;
  if (fromActive === tabId) fromActive = fromNextIds[0] ?? null;

  let next = rows.map((row, ri) => {
    if (ri !== loc.row) return cloneRow(row);
    return {
      id: row.id,
      groups: row.groups.map((g, ci) =>
        ci === loc.col ? { ...cloneGroup(g), tabIds: fromNextIds, activeTabId: fromActive } : cloneGroup(g),
      ),
    };
  });
  next = next
    .map((row) => ({ id: row.id, groups: row.groups.filter((gr) => gr.tabIds.length > 0) }))
    .filter((row) => row.groups.length > 0);
  return next;
}

/** Build initial `{ rows, tabsById }` from Storybook-style tab descriptors (grouped by `groupIndex`). */
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
    return asModel(
      [{ id: newWorkspaceId("row"), groups: [{ id: newWorkspaceId("group"), tabIds: [id], activeTabId: id }] }],
      tabsById,
    );
  }

  return asModel([{ id: newWorkspaceId("row"), groups }], tabsById);
}

export function workspaceActivateTab(model: UsfmWorkspaceModel, groupId: string, tabId: string): UsfmWorkspaceModel {
  const rows = model.rows.map((row) => ({
    id: row.id,
    groups: row.groups.map((g) => (g.id === groupId ? { ...cloneGroup(g), activeTabId: tabId } : cloneGroup(g))),
  }));
  return asModel(rows, { ...model.tabsById });
}

export function workspaceSetTabValue(model: UsfmWorkspaceModel, tabId: string, value: string): UsfmWorkspaceModel {
  const cur = model.tabsById[tabId];
  if (!cur || cur.value === value) return model;
  return asModel(
    model.rows.map((row) => ({ id: row.id, groups: row.groups.map(cloneGroup) })),
    { ...model.tabsById, [tabId]: { ...cur, value } },
  );
}

export function workspaceCloseTab(model: UsfmWorkspaceModel, groupId: string, tabId: string): UsfmWorkspaceModel {
  const loc = findGroupLocation(model.rows, groupId);
  if (!loc) return model;
  const g = model.rows[loc.row]!.groups[loc.col]!;
  const nextIds = removeTabFromGroup(g.tabIds, tabId);
  let nextActive = g.activeTabId;
  if (nextActive === tabId) nextActive = nextIds[0] ?? null;

  let rows = model.rows.map((row, ri) => {
    if (ri !== loc.row) return cloneRow(row);
    return {
      id: row.id,
      groups: row.groups.map((gr, ci) =>
        ci === loc.col ? { ...cloneGroup(gr), tabIds: nextIds, activeTabId: nextActive } : cloneGroup(gr),
      ),
    };
  });

  const flatCount = rows.reduce((n, row) => n + row.groups.length, 0);
  if (nextIds.length === 0 && flatCount > 1) {
    rows = rows
      .map((row, ri) =>
        ri === loc.row ? { id: row.id, groups: row.groups.filter((_, ci) => ci !== loc.col) } : cloneRow(row),
      )
      .filter((row) => row.groups.length > 0);
  } else if (nextIds.length === 0 && flatCount === 1) {
    const id = newWorkspaceId("tab");
    const blank: UsfmWorkspaceTabState = {
      id,
      fileName: "Untitled.usfm",
      value: "\\id GEN\n\\c 1\n\\p\n\\v 1 ",
      dirty: false,
    };
    rows = [{ ...rows[0]!, groups: [{ id: newWorkspaceId("group"), tabIds: [id], activeTabId: id }] }];
    const tabsById = pruneTabs(rows, { ...model.tabsById, [id]: blank });
    return asModel(rows, tabsById);
  }

  const tabsById = pruneTabs(rows, { ...model.tabsById });
  return asModel(rows, tabsById);
}

export function workspaceReorderTabInGroup(
  model: UsfmWorkspaceModel,
  groupId: string,
  tabId: string,
  toIndex: number,
): UsfmWorkspaceModel {
  const rows = model.rows.map((row) => ({
    id: row.id,
    groups: row.groups.map((g) =>
      g.id === groupId ? { ...cloneGroup(g), tabIds: insertTabAt(g.tabIds, tabId, toIndex) } : cloneGroup(g),
    ),
  }));
  return asModel(rows, { ...model.tabsById });
}

export function workspaceMoveTabToGroup(
  model: UsfmWorkspaceModel,
  detail: { readonly tabId: string; readonly fromGroupId: string; readonly toGroupId: string; readonly insertIndex: number },
): UsfmWorkspaceModel {
  const { tabId, fromGroupId, toGroupId, insertIndex } = detail;
  if (fromGroupId === toGroupId) return model;

  const fromLoc = findGroupLocation(model.rows, fromGroupId);
  const toLoc = findGroupLocation(model.rows, toGroupId);
  if (!fromLoc || !toLoc) return model;

  const fromG = model.rows[fromLoc.row]!.groups[fromLoc.col]!;
  const toG = model.rows[toLoc.row]!.groups[toLoc.col]!;
  const fromNextIds = removeTabFromGroup(fromG.tabIds, tabId);
  let fromActive = fromG.activeTabId;
  if (fromActive === tabId) fromActive = fromNextIds[0] ?? null;

  const toNextIds = insertTabAt(toG.tabIds, tabId, insertIndex);

  let rows = model.rows.map((row) => ({
    id: row.id,
    groups: row.groups.map((g) => {
      if (g.id === fromGroupId) return { ...cloneGroup(g), tabIds: fromNextIds, activeTabId: fromActive };
      if (g.id === toGroupId) return { ...cloneGroup(g), tabIds: toNextIds, activeTabId: tabId };
      return cloneGroup(g);
    }),
  }));

  rows = rows
    .map((row) => ({ id: row.id, groups: row.groups.filter((gr) => gr.tabIds.length > 0) }))
    .filter((row) => row.groups.length > 0);
  const tabsById = pruneTabs(rows, { ...model.tabsById });
  return asModel(rows, tabsById);
}

/**
 * Remove `tabId` from `fromGroupId`, prune empty groups/rows, then insert a new singleton group
 * carrying that tab in `targetRowId` before `beforeGroupId`, or at the end of the row if `beforeGroupId` is null.
 */
export function workspaceSplitTabToNewGroup(
  model: UsfmWorkspaceModel,
  detail: { readonly tabId: string; readonly fromGroupId: string; readonly targetRowId: string; readonly beforeGroupId: string | null },
): UsfmWorkspaceModel {
  const { tabId, fromGroupId, targetRowId, beforeGroupId } = detail;
  const rows = rowsAfterRemovingTab(model.rows, fromGroupId, tabId);
  if (!rows) return model;

  const newGroup = {
    id: newWorkspaceId("group"),
    tabIds: [tabId],
    activeTabId: tabId,
  };

  const ti = rows.findIndex((r) => r.id === targetRowId);
  if (ti < 0) {
    const fallback = [...rows, { id: newWorkspaceId("row"), groups: [newGroup] }];
    return asModel(fallback, pruneTabs(fallback, { ...model.tabsById }));
  }

  const targetRow = rows[ti]!;
  let col = targetRow.groups.length;
  if (beforeGroupId !== null) {
    const bi = targetRow.groups.findIndex((g) => g.id === beforeGroupId);
    if (bi >= 0) col = bi;
  }
  col = Math.max(0, Math.min(col, targetRow.groups.length));

  const nextGroups = [...targetRow.groups.map(cloneGroup)];
  nextGroups.splice(col, 0, newGroup);
  const outRows = rows.map((row, ri) => (ri === ti ? { id: row.id, groups: nextGroups } : row));

  const tabsById = pruneTabs(outRows, { ...model.tabsById });
  return asModel(outRows, tabsById);
}

/** New singleton group immediately to the right of the tab’s current group (same row). */
export function workspaceSplitCurrentTabToNewGroupRight(
  model: UsfmWorkspaceModel,
  fromGroupId: string,
  tabId: string,
): UsfmWorkspaceModel {
  const loc = findGroupLocation(model.rows, fromGroupId);
  if (!loc) return model;
  const fromG = model.rows[loc.row]!.groups[loc.col]!;
  if (!fromG.tabIds.includes(tabId)) return model;

  const rowId = model.rows[loc.row]!.id;
  const rows = rowsAfterRemovingTab(model.rows, fromGroupId, tabId);
  if (!rows) return model;

  const newGroup = {
    id: newWorkspaceId("group"),
    tabIds: [tabId],
    activeTabId: tabId,
  };

  const ti = rows.findIndex((r) => r.id === rowId);
  if (ti < 0) {
    const tabsById = pruneTabs([{ id: newWorkspaceId("row"), groups: [newGroup] }], { ...model.tabsById });
    return asModel([{ id: newWorkspaceId("row"), groups: [newGroup] }], tabsById);
  }

  const row = rows[ti]!;
  const idx = row.groups.findIndex((g) => g.id === fromGroupId);
  const insertCol = idx >= 0 ? idx + 1 : Math.min(loc.col, row.groups.length);
  const nextGroups = [...row.groups.map(cloneGroup)];
  nextGroups.splice(Math.max(0, Math.min(insertCol, nextGroups.length)), 0, newGroup);
  const outRows = rows.map((r, ri) => (ri === ti ? { id: r.id, groups: nextGroups } : r));

  return asModel(outRows, pruneTabs(outRows, { ...model.tabsById }));
}

/** New row under the tab’s current row, containing only a new singleton group with that tab. */
export function workspaceSplitCurrentTabToNewGroupBelow(
  model: UsfmWorkspaceModel,
  fromGroupId: string,
  tabId: string,
): UsfmWorkspaceModel {
  const loc = findGroupLocation(model.rows, fromGroupId);
  if (!loc) return model;
  const fromG = model.rows[loc.row]!.groups[loc.col]!;
  if (!fromG.tabIds.includes(tabId)) return model;

  const rowId = model.rows[loc.row]!.id;
  const rows = rowsAfterRemovingTab(model.rows, fromGroupId, tabId);
  if (!rows) return model;

  const newGroup = {
    id: newWorkspaceId("group"),
    tabIds: [tabId],
    activeTabId: tabId,
  };
  const newRow = { id: newWorkspaceId("row"), groups: [newGroup] };

  const ri = rows.findIndex((r) => r.id === rowId);
  const insertIdx = ri >= 0 ? ri + 1 : Math.min(loc.row, rows.length);
  const clamped = Math.max(0, Math.min(insertIdx, rows.length));
  const outRows = [...rows.slice(0, clamped), newRow, ...rows.slice(clamped)];

  return asModel(outRows, pruneTabs(outRows, { ...model.tabsById }));
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
  const rows = model.rows.map((row) => ({
    id: row.id,
    groups: row.groups.map((g) => {
      if (g.id !== options.groupId) return cloneGroup(g);
      if (g.tabIds.includes(id)) return cloneGroup(g);
      return {
        ...cloneGroup(g),
        tabIds: [...g.tabIds, id],
        activeTabId: activate ? id : g.activeTabId,
      };
    }),
  }));
  return asModel(rows, { ...model.tabsById, [id]: tab });
}
