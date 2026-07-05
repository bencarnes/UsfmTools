/**
 * What a workspace tab renders. `editor` tabs hold USFM content edited in a {@link UsfmPane};
 * `settings` tabs render the {@link SettingsPane}. Defaults to `editor` when omitted.
 */
import type { Diagnostic } from "../../language-service/protocol.js";

export type UsfmWorkspaceTabKind = "editor" | "settings";

export interface UsfmWorkspaceTabState {
  readonly id: string;
  /**
   * Identifies the underlying document/buffer. The same file may be open as several tabs (one per
   * tab group); those tabs share a `fileId` and stay in sync via {@link workspaceSetTabValue} &
   * friends, which fan edits out to every tab with the same `fileId`. Tab `id` stays unique per
   * instance. For non-file tabs (e.g. settings) `fileId` equals the tab `id`.
   */
  readonly fileId: string;
  readonly fileName: string;
  readonly value: string;
  /** Pane kind for this tab. Omitted (or `editor`) renders a USFM editor pane. */
  readonly kind?: UsfmWorkspaceTabKind;
  /**
   * Last persisted content for this tab. Editor `value` edits update `dirty` until saved.
   */
  readonly savedValue: string;
  /**
   * When true, `value` differs from `savedValue` and the tab close affordance uses a circle
   * instead of an ×, similar to VS Code.
   */
  readonly dirty: boolean;
  /**
   * Optional one-shot request to position the caret / selection in this tab's editor.
   * Bump `nonce` to retrigger; the workspace forwards this to the underlying `UsfmPane`.
   */
  readonly selectionRequest?: UsfmTabSelectionRequest;
}

export interface UsfmTabSelectionRequest {
  readonly from: number;
  readonly to?: number;
  readonly nonce: number;
}

export interface UsfmWorkspaceEditorGroupState {
  readonly id: string;
  readonly tabIds: readonly string[];
  readonly activeTabId: string | null;
}

export type WorkspaceGridDimension = 1 | 2;

export interface UsfmWorkspaceInitialTab {
  readonly id?: string;
  /** Underlying document id; defaults to the tab `id`. Reuse across tabs to open one file twice. */
  readonly fileId?: string;
  readonly fileName: string;
  readonly value: string;
  /** Last saved body; defaults to `value`. */
  readonly savedValue?: string;
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
  /**
   * Fired when a tab group becomes the active tab page — either its tab header is clicked or the
   * pointer is pressed anywhere inside the group's pane. The shell uses this to decide which group
   * receives newly opened files and whose diagnostics the errors panel shows.
   */
  readonly onActivateGroup?: (groupId: string) => void;
  readonly onUpdateTabValue: (tabId: string, value: string) => void;
  readonly onMarkTabDirty?: (tabId: string) => void;
  readonly onSaveTab?: (tabId: string, value: string) => void;
  readonly onCloseTab: (groupId: string, tabId: string) => void;
  /**
   * Close every tab in the group except `keepTabId` (the "Close Others" context-menu action). When
   * omitted, the tab strip falls back to closing the other tabs one by one via {@link onCloseTab}.
   */
  readonly onCloseOtherTabs?: (groupId: string, keepTabId: string) => void;
  /**
   * Close every tab in the group (the "Close All" context-menu action). When omitted, the tab strip
   * falls back to closing each tab via {@link onCloseTab}.
   */
  readonly onCloseAllTabs?: (groupId: string) => void;
  readonly onReorderTabInGroup: (groupId: string, tabId: string, toIndex: number) => void;
  readonly onMoveTabToGroup: (detail: {
    readonly tabId: string;
    readonly fromGroupId: string;
    readonly toGroupId: string;
    readonly insertIndex: number;
  }) => void;
  /** Change the tab-group grid layout (max 2×2). When omitted, the layout selector is hidden. */
  readonly onChangeGridLayout?: (rows: WorkspaceGridDimension, cols: WorkspaceGridDimension) => void;
  /** Diagnostics for editor tabs (from unified shell validation). */
  readonly getDiagnosticsForTab?: (tabId: string) => readonly Diagnostic[];
  /** Fired when an editor tab's document changes (before workspace value sync). */
  readonly onEditorDocumentChange?: (tabId: string) => void;
  /** Register a reader for a tab's live editor buffer; return value unregisters. */
  readonly onRegisterDocumentReader?: (tabId: string, reader: () => string) => () => void;
  /**
   * Group id currently under an external drag (e.g. a file dragged from the shell sidebar), or null.
   * The workspace highlights this group's tab strip / empty slot to mirror in-workspace tab drags;
   * the external gesture itself is owned by the parent.
   */
  readonly externalDropTargetGroupId?: string | null;
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

/** Ids of every tab backed by the same document (one per group it is open in). */
function fileSiblingIds(tabsById: Record<string, UsfmWorkspaceTabState>, fileId: string): string[] {
  return Object.keys(tabsById).filter((id) => tabsById[id]?.fileId === fileId);
}

/** A tab in this slot showing `fileId` (other than `excludeTabId`), or undefined. */
function findTabInSlotByFile(
  slot: UsfmWorkspaceEditorGroupState,
  fileId: string,
  tabsById: Record<string, UsfmWorkspaceTabState>,
  excludeTabId?: string,
): string | undefined {
  return slot.tabIds.find((tid) => tid !== excludeTabId && tabsById[tid]?.fileId === fileId);
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
    const fileId = t.fileId ?? id;
    const gi = t.groupIndex ?? 0;
    const savedValue = t.savedValue ?? t.value;
    const dirty = t.dirty ?? t.value !== savedValue;
    tabsById[id] = { id, fileId, fileName: t.fileName, value: t.value, savedValue, dirty };
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
    const fileId = model.tabsById[tabId]?.fileId;
    // Merging groups can collide two instances of the same file into one group. Place the orphan in
    // the least-filled slot that does not already show its file; if every slot already shows it,
    // drop the duplicate tab (the file stays open in the surviving group).
    let target = -1;
    for (let j = 0; j < nextSlots.length; j++) {
      const slot = nextSlots[j]!;
      if (fileId != null && slot.tabIds.some((tid) => model.tabsById[tid]?.fileId === fileId)) continue;
      if (target < 0 || slot.tabIds.length < nextSlots[target]!.tabIds.length) target = j;
    }
    if (target < 0) continue;
    const slot = nextSlots[target]!;
    nextSlots[target] = { ...slot, tabIds: [...slot.tabIds, tabId], activeTabId: slot.activeTabId ?? tabId };
  }

  const tabsById = pruneTabs(nextSlots, { ...model.tabsById });
  return asModel(newRows, newCols, nextSlots, tabsById);
}

export function workspaceActivateTab(model: UsfmWorkspaceModel, groupId: string, tabId: string): UsfmWorkspaceModel {
  const slots = model.slots.map((s) => (s.id === groupId ? { ...cloneGroup(s), activeTabId: tabId } : cloneGroup(s)));
  return asModel(model.gridRows, model.gridCols, slots, { ...model.tabsById });
}

export function workspaceSetTabValue(model: UsfmWorkspaceModel, tabId: string, value: string): UsfmWorkspaceModel {
  const cur = model.tabsById[tabId];
  if (!cur || cur.value === value) return model;
  if (cur.kind === "settings") {
    return asModel(model.gridRows, model.gridCols, model.slots.map(cloneGroup), {
      ...model.tabsById,
      [tabId]: { ...cur, value, dirty: false },
    });
  }
  // The same file may be open in multiple groups; apply the edit (and resulting dirty state) to
  // every tab sharing this document so they behave as one in-memory buffer.
  const dirty = value !== cur.savedValue;
  const nextTabs = { ...model.tabsById };
  for (const id of fileSiblingIds(model.tabsById, cur.fileId)) {
    nextTabs[id] = { ...nextTabs[id]!, value, dirty };
  }
  return asModel(model.gridRows, model.gridCols, model.slots.map(cloneGroup), nextTabs);
}

/** Mark an editor tab (and every tab sharing its document) dirty without lifting the latest text. */
export function workspaceSetTabDirty(model: UsfmWorkspaceModel, tabId: string): UsfmWorkspaceModel {
  const cur = model.tabsById[tabId];
  if (!cur || cur.kind === "settings" || cur.dirty) return model;
  const nextTabs = { ...model.tabsById };
  for (const id of fileSiblingIds(model.tabsById, cur.fileId)) {
    nextTabs[id] = { ...nextTabs[id]!, dirty: true };
  }
  return asModel(model.gridRows, model.gridCols, model.slots.map(cloneGroup), nextTabs);
}

/** Mark a tab's current `value` as saved (clears `dirty`) for every tab sharing its document. */
export function workspaceMarkTabSaved(model: UsfmWorkspaceModel, tabId: string): UsfmWorkspaceModel {
  const cur = model.tabsById[tabId];
  if (!cur || cur.kind === "settings") return model;
  if (!cur.dirty && cur.savedValue === cur.value) return model;
  const nextTabs = { ...model.tabsById };
  for (const id of fileSiblingIds(model.tabsById, cur.fileId)) {
    const t = nextTabs[id]!;
    nextTabs[id] = { ...t, savedValue: t.value, dirty: false };
  }
  return asModel(model.gridRows, model.gridCols, model.slots.map(cloneGroup), nextTabs);
}

/** Editor tabs with unsaved changes (excludes the settings tab). */
export function workspaceListDirtyEditorTabs(model: UsfmWorkspaceModel): UsfmWorkspaceTabState[] {
  return Object.values(model.tabsById).filter((tab) => tab.kind !== "settings" && tab.dirty);
}

export function workspaceCloseTab(model: UsfmWorkspaceModel, groupId: string, tabId: string): UsfmWorkspaceModel {
  return workspaceCloseTabs(model, groupId, [tabId]);
}

/**
 * Close several tabs from one group at once (e.g. the "Close Others" / "Close All" tab context-menu
 * actions). Tabs not present in the group are ignored. If the active tab is among those closed, the
 * first surviving tab becomes active (or none, leaving an empty slot — no tab is created).
 */
export function workspaceCloseTabs(
  model: UsfmWorkspaceModel,
  groupId: string,
  tabIds: readonly string[],
): UsfmWorkspaceModel {
  const si = findSlotIndex(model.slots, groupId);
  if (si < 0) return model;
  const closing = new Set(tabIds);
  if (closing.size === 0) return model;
  const g = model.slots[si]!;
  const nextIds = g.tabIds.filter((t) => !closing.has(t));
  if (nextIds.length === g.tabIds.length) return model;
  let nextActive = g.activeTabId;
  if (nextActive != null && closing.has(nextActive)) nextActive = nextIds[0] ?? null;

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
  const fileId = model.tabsById[tabId]?.fileId;
  const fromNextIds = removeTabFromGroup(fromG.tabIds, tabId);
  let fromActive = fromG.activeTabId;
  if (fromActive === tabId) fromActive = fromNextIds[0] ?? null;

  // The destination already shows this file: keeping both would put the same file twice in one
  // group. Drop the dragged tab and focus the existing instance instead.
  const dupInTarget = fileId != null ? findTabInSlotByFile(toG, fileId, model.tabsById, tabId) : undefined;

  const slots = model.slots.map((s) => {
    if (s.id === fromGroupId) return { ...cloneGroup(s), tabIds: fromNextIds, activeTabId: fromActive };
    if (s.id === toGroupId) {
      if (dupInTarget) return { ...cloneGroup(s), activeTabId: dupInTarget };
      return { ...cloneGroup(s), tabIds: insertTabAt(s.tabIds, tabId, insertIndex), activeTabId: tabId };
    }
    return cloneGroup(s);
  });

  const tabsById = pruneTabs(slots, { ...model.tabsById });
  return asModel(model.gridRows, model.gridCols, slots, tabsById);
}

/**
 * Set a one-shot selection request on a tab. The workspace will forward this to the underlying
 * `UsfmPane` so the editor moves its caret / selection and scrolls it into view.
 */
export function workspaceRequestTabSelection(
  model: UsfmWorkspaceModel,
  tabId: string,
  from: number,
  to?: number,
): UsfmWorkspaceModel {
  const cur = model.tabsById[tabId];
  if (!cur) return model;
  const prevNonce = cur.selectionRequest?.nonce ?? 0;
  return asModel(
    model.gridRows,
    model.gridCols,
    model.slots.map(cloneGroup),
    {
      ...model.tabsById,
      [tabId]: {
        ...cur,
        selectionRequest: { from, to, nonce: prevNonce + 1 },
      },
    },
  );
}

/**
 * Append a new tab to a group (for example after opening a file). By default the new tab becomes active.
 */
export function workspaceAppendTab(
  model: UsfmWorkspaceModel,
  options: {
    readonly groupId: string;
    readonly tab: {
      readonly id?: string;
      /** Underlying document id; defaults to the tab `id`. */
      readonly fileId?: string;
      readonly fileName: string;
      readonly value: string;
      readonly dirty?: boolean;
      readonly savedValue?: string;
      readonly kind?: UsfmWorkspaceTabKind;
    };
    readonly activate?: boolean;
  },
): UsfmWorkspaceModel {
  const id = options.tab.id ?? newWorkspaceId("tab");
  const fileId = options.tab.fileId ?? id;
  const kind = options.tab.kind ?? "editor";
  const activate = options.activate !== false;
  const si = findSlotIndex(model.slots, options.groupId);
  if (si < 0) return model;

  // A file may appear at most once per group: if this group already shows the document, focus that
  // tab instead of opening a duplicate.
  const existing = findTabInSlotByFile(model.slots[si]!, fileId, model.tabsById);
  if (existing) {
    return activate ? workspaceActivateTab(model, options.groupId, existing) : model;
  }

  const savedValue = options.tab.savedValue ?? options.tab.value;
  const dirty =
    kind === "settings" ? false : (options.tab.dirty ?? options.tab.value !== savedValue);
  const tab: UsfmWorkspaceTabState = {
    id,
    fileId,
    fileName: options.tab.fileName,
    value: options.tab.value,
    kind,
    savedValue,
    dirty,
  };

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

/** Stable id for the singleton settings tab. */
export const SETTINGS_TAB_ID = "settings";

/** Find the group that currently holds the given tab, if any. */
function findGroupHoldingTab(model: UsfmWorkspaceModel, tabId: string): string | null {
  for (const slot of model.slots) {
    if (slot.tabIds.includes(tabId)) return slot.id;
  }
  return null;
}

/**
 * Open (or focus) the singleton settings tab. If a settings tab already exists it is activated in
 * place; otherwise a new one is appended to the first slot (or the given `groupId`).
 */
export function workspaceOpenSettingsTab(
  model: UsfmWorkspaceModel,
  options?: { readonly groupId?: string },
): UsfmWorkspaceModel {
  const existingGroup = findGroupHoldingTab(model, SETTINGS_TAB_ID);
  if (existingGroup) {
    return workspaceActivateTab(model, existingGroup, SETTINGS_TAB_ID);
  }
  const groupId = options?.groupId ?? model.slots[0]?.id;
  if (!groupId) return model;
  return workspaceAppendTab(model, {
    groupId,
    tab: {
      id: SETTINGS_TAB_ID,
      fileName: "Settings",
      value: "",
      savedValue: "",
      kind: "settings",
    },
  });
}
