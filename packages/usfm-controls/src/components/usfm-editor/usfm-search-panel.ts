import elt from "crelt";
import {
  search,
  SearchQuery,
  setSearchQuery,
  getSearchQuery,
  findNext,
  findPrevious,
  replaceAll,
  closeSearchPanel,
  searchKeymap,
  openSearchPanel,
} from "@codemirror/search";
import {
  EditorView,
  KeyBinding,
  Panel,
  ViewUpdate,
  runScopeHandlers,
} from "@codemirror/view";
import { EditorState, StateEffect, StateField, Extension, EditorSelection } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  iconMatchCase,
  iconMatchWholeWord,
  iconRegex,
  iconChevronDown,
  iconChevronRight,
  iconFindNext,
  iconFindPrevious,
  iconClose,
  iconReplaceOne,
  iconReplaceAll,
} from "./search-mode-icons.js";

/** Whether the replace row is visible in the custom search panel. */
export const setReplacePanelVisible = StateEffect.define<boolean>();

const replacePanelVisibleField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setReplacePanelVisible)) return effect.value;
    }
    return value;
  },
});

export function getReplacePanelVisible(state: EditorState): boolean {
  return state.field(replacePanelVisibleField, false) ?? false;
}

function openSearchWithReplace(view: EditorView, replaceVisible: boolean): boolean {
  view.dispatch({ effects: setReplacePanelVisible.of(replaceVisible) });
  return openSearchPanel(view);
}

/** Open find-only panel (Ctrl+F). */
export const openFindPanel: (view: EditorView) => boolean = (view) =>
  openSearchWithReplace(view, false);

/** Open find-and-replace panel (Ctrl+H). */
export const openFindReplacePanel: (view: EditorView) => boolean = (view) =>
  openSearchWithReplace(view, true);

/** Replace the current or next match, then select the following match (VS Code behavior). */
export function replaceAndAdvance(view: EditorView, spec: SearchQuery): boolean {
  if (view.state.readOnly || !spec.valid) return false;
  const query = spec.create();
  const { from, to } = view.state.selection.main;
  let match = query.nextMatch(view.state, from, to);
  if (!match) {
    match = query.nextMatch(view.state, from, from);
  }
  if (!match) return false;

  const replacement = view.state.toText(query.getReplacement(match));
  view.dispatch({
    changes: { from: match.from, to: match.to, insert: replacement },
    userEvent: "input.replace",
  });

  const after = match.from + replacement.length;
  const next = query.nextMatch(view.state, after, after);
  if (next) {
    view.dispatch({
      selection: EditorSelection.single(next.from, next.to),
      effects: EditorView.scrollIntoView(next.from),
      userEvent: "select.search",
    });
  }
  return true;
}

type SearchOption = "caseSensitive" | "regexp" | "wholeWord";

function iconButton(
  pressed: boolean,
  label: string,
  icon: SVGSVGElement,
  onclick: () => void,
  extraClass = "",
): HTMLButtonElement {
  return elt(
    "button",
    {
      type: "button",
      class: `usfm-search-btn usfm-search-mode-btn${pressed ? " usfm-search-mode-btn--on" : ""} ${extraClass}`.trim(),
      "aria-label": label,
      title: label,
      "aria-pressed": pressed ? "true" : "false",
      onclick,
    },
    [icon],
  ) as HTMLButtonElement;
}

function actionButton(label: string, icon: SVGSVGElement, onclick: () => void): HTMLButtonElement {
  return elt(
    "button",
    {
      type: "button",
      class: "usfm-search-btn usfm-search-action-btn",
      "aria-label": label,
      title: label,
      onclick,
    },
    [icon],
  ) as HTMLButtonElement;
}

class UsfmSearchPanel implements Panel {
  searchField: HTMLInputElement;
  replaceField: HTMLInputElement;
  replaceRow: HTMLElement;
  expandBtn: HTMLButtonElement;
  rowsEl: HTMLElement;
  dom: HTMLElement;
  query: SearchQuery;
  private replaceVisible: boolean;
  private caseBtn: HTMLButtonElement;
  private wordBtn: HTMLButtonElement;
  private regexBtn: HTMLButtonElement;

  constructor(readonly view: EditorView) {
    this.query = getSearchQuery(view.state);
    this.replaceVisible = getReplacePanelVisible(view.state);
    this.commit = this.commit.bind(this);
    this.toggleReplaceVisible = this.toggleReplaceVisible.bind(this);

    this.searchField = elt("input", {
      value: this.query.search,
      placeholder: "Find",
      "aria-label": "Find",
      class: "usfm-search-field",
      name: "search",
      form: "",
      "main-field": "true",
      oninput: this.commit,
      onchange: this.commit,
    }) as HTMLInputElement;

    this.replaceField = elt("input", {
      value: this.query.replace,
      placeholder: "Replace",
      "aria-label": "Replace",
      class: "usfm-search-field",
      name: "replace",
      form: "",
      oninput: this.commit,
      onchange: this.commit,
    }) as HTMLInputElement;

    this.caseBtn = iconButton(
      this.query.caseSensitive,
      "Match Case",
      iconMatchCase(),
      () => this.toggleOption("caseSensitive"),
    );
    this.wordBtn = iconButton(
      this.query.wholeWord,
      "Match Whole Word",
      iconMatchWholeWord(),
      () => this.toggleOption("wholeWord"),
    );
    this.regexBtn = iconButton(
      this.query.regexp,
      "Use Regular Expression",
      iconRegex(),
      () => this.toggleOption("regexp"),
    );

    const findInputWrap = elt("div", { class: "usfm-search-input-wrap" }, [
      this.searchField,
      elt("div", { class: "usfm-search-inline-modes" }, [this.caseBtn, this.wordBtn, this.regexBtn]),
    ]);

    const findRow = elt("div", { class: "usfm-search-find-row" }, [
      findInputWrap,
      elt("div", { class: "usfm-search-nav" }, [
        actionButton("Previous Match", iconFindPrevious(), () => findPrevious(this.view)),
        actionButton("Next Match", iconFindNext(), () => findNext(this.view)),
        actionButton("Close", iconClose(), () => closeSearchPanel(this.view)),
      ]),
    ]);

    const replaceInputWrap = elt("div", { class: "usfm-search-input-wrap" }, [this.replaceField]);

    const replaceActions = view.state.readOnly
      ? []
      : [
          actionButton("Replace", iconReplaceOne(), () => this.replaceOne()),
          actionButton("Replace All", iconReplaceAll(), () => {
            this.commit();
            replaceAll(this.view);
          }),
        ];

    this.replaceRow = elt("div", { class: "usfm-search-replace-row" }, [
      replaceInputWrap,
      elt("div", { class: "usfm-search-replace-actions" }, replaceActions),
    ]);

    this.expandBtn = actionButton(
      "Toggle Replace",
      this.replaceVisible ? iconChevronDown() : iconChevronRight(),
      this.toggleReplaceVisible,
    );
    this.expandBtn.classList.add("usfm-search-expand-btn");

    this.rowsEl = elt("div", { class: "usfm-search-rows" }, [findRow]);

    this.dom = elt(
      "div",
      {
        onkeydown: (e: KeyboardEvent) => this.keydown(e),
        class: "cm-search usfm-search-panel",
      },
      [elt("div", { class: "usfm-search-layout" }, [this.expandBtn, this.rowsEl])],
    );
    this.syncReplaceRow();
    this.syncExpandIcon();
  }

  private currentQuery(): SearchQuery {
    return new SearchQuery({
      search: this.searchField.value,
      replace: this.replaceField.value,
      caseSensitive: this.query.caseSensitive,
      regexp: this.query.regexp,
      wholeWord: this.query.wholeWord,
    });
  }

  private replaceOne() {
    this.commit();
    replaceAndAdvance(this.view, this.currentQuery());
  }

  private toggleOption(option: SearchOption) {
    const next = new SearchQuery({
      search: this.searchField.value,
      replace: this.replaceField.value,
      caseSensitive:
        option === "caseSensitive" ? !this.query.caseSensitive : this.query.caseSensitive,
      regexp: option === "regexp" ? !this.query.regexp : this.query.regexp,
      wholeWord: option === "wholeWord" ? !this.query.wholeWord : this.query.wholeWord,
    });
    if (!next.eq(this.query)) {
      this.query = next;
      this.view.dispatch({ effects: setSearchQuery.of(next) });
    }
    this.refreshModeButtons();
  }

  private refreshModeButtons() {
    const flags: [HTMLButtonElement, boolean][] = [
      [this.caseBtn, this.query.caseSensitive],
      [this.wordBtn, this.query.wholeWord],
      [this.regexBtn, this.query.regexp],
    ];
    for (const [btn, on] of flags) {
      btn.classList.toggle("usfm-search-mode-btn--on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  private syncExpandIcon() {
    while (this.expandBtn.firstChild) this.expandBtn.removeChild(this.expandBtn.firstChild);
    this.expandBtn.appendChild(
      this.replaceVisible ? iconChevronDown() : iconChevronRight(),
    );
  }

  private toggleReplaceVisible() {
    this.replaceVisible = !this.replaceVisible;
    this.view.dispatch({ effects: setReplacePanelVisible.of(this.replaceVisible) });
    this.syncReplaceRow();
    this.syncExpandIcon();
  }

  private syncReplaceRow() {
    const hasRow = this.rowsEl.contains(this.replaceRow);
    if (this.replaceVisible && !hasRow) {
      this.rowsEl.appendChild(this.replaceRow);
    } else if (!this.replaceVisible && hasRow) {
      this.replaceRow.remove();
    }
    this.dom.classList.toggle("usfm-search-panel--replace-open", this.replaceVisible);
  }

  commit() {
    const query = this.currentQuery();
    if (!query.eq(this.query)) {
      this.query = query;
      this.view.dispatch({ effects: setSearchQuery.of(query) });
    }
  }

  keydown(e: KeyboardEvent) {
    if (runScopeHandlers(this.view, e, "search-panel")) {
      e.preventDefault();
    } else if (e.key === "Enter" && e.target === this.searchField) {
      e.preventDefault();
      (e.shiftKey ? findPrevious : findNext)(this.view);
    } else if (e.key === "Enter" && e.target === this.replaceField) {
      e.preventDefault();
      this.replaceOne();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSearchPanel(this.view);
    }
  }

  update(update: ViewUpdate) {
    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.setQuery(effect.value);
        }
        if (effect.is(setReplacePanelVisible)) {
          this.replaceVisible = effect.value;
          this.syncReplaceRow();
          this.syncExpandIcon();
        }
      }
    }
  }

  setQuery(query: SearchQuery) {
    this.query = query;
    this.searchField.value = query.search;
    this.replaceField.value = query.replace;
    this.refreshModeButtons();
  }

  mount() {
    this.searchField.select();
  }

  get pos() {
    return 10000;
  }

  get top() {
    return true;
  }
}

const usfmSearchTheme = EditorView.baseTheme({
  ".cm-editor": {
    position: "relative",
  },
  ".cm-panels-top": {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    pointerEvents: "none",
  },
  ".cm-panels-top .cm-panel": {
    pointerEvents: "auto",
  },
  ".cm-search.usfm-search-panel": {
    padding: 0,
    margin: "4px 6px 0 auto",
    width: "max-content",
    maxWidth: "min(460px, calc(100% - 12px))",
    marginLeft: "auto",
    backgroundColor: "var(--usfm-search-panel-bg, #1e293b)",
    color: "var(--usfm-search-panel-fg, #e2e8f0)",
    border: "1px solid var(--usfm-search-panel-border, #334155)",
    borderRadius: "4px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
    fontSize: "13px",
  },
  ".usfm-search-layout": {
    display: "flex",
    alignItems: "stretch",
    gap: 0,
  },
  ".usfm-search-expand-btn": {
    flexShrink: 0,
    width: "28px",
    minHeight: "28px",
    borderRight: "1px solid var(--usfm-search-panel-border, #334155)",
    borderRadius: "4px 0 0 4px",
    alignSelf: "stretch",
  },
  ".usfm-search-panel--replace-open .usfm-search-expand-btn": {
    alignSelf: "stretch",
  },
  ".usfm-search-rows": {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minWidth: 0,
    padding: "2px 4px 2px 0",
  },
  ".usfm-search-find-row, .usfm-search-replace-row": {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    padding: "2px 0",
  },
  ".usfm-search-replace-row[hidden]": {
    display: "none",
  },
  ".usfm-search-input-wrap": {
    position: "relative",
    flex: "1 1 200px",
    minWidth: "180px",
    display: "flex",
    alignItems: "center",
  },
  ".usfm-search-field": {
    width: "100%",
    boxSizing: "border-box",
    height: "26px",
    padding: "0 72px 0 8px",
    margin: 0,
    border: "1px solid var(--usfm-search-field-border, #475569)",
    borderRadius: "2px",
    backgroundColor: "var(--usfm-search-field-bg, #0f172a)",
    color: "inherit",
    font: "inherit",
    outline: "none",
  },
  ".usfm-search-field:focus": {
    borderColor: "var(--usfm-search-field-focus, #3b82f6)",
  },
  ".usfm-search-replace-row .usfm-search-field": {
    paddingRight: "8px",
  },
  ".usfm-search-inline-modes": {
    position: "absolute",
    right: "2px",
    top: "50%",
    transform: "translateY(-50%)",
    display: "inline-flex",
    alignItems: "center",
    gap: "1px",
  },
  ".usfm-search-nav, .usfm-search-replace-actions": {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    gap: "1px",
  },
  ".usfm-search-btn": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    padding: 0,
    margin: 0,
    border: "none",
    borderRadius: "3px",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  },
  ".usfm-search-btn:hover": {
    backgroundColor: "var(--usfm-search-btn-hover, rgba(255, 255, 255, 0.1))",
  },
  ".usfm-search-mode-btn--on": {
    backgroundColor: "var(--usfm-search-btn-active, rgba(59, 130, 246, 0.35))",
    color: "#93c5fd",
  },
  ".usfm-search-inline-modes .usfm-search-mode-btn": {
    width: "22px",
    height: "22px",
  },
  ".usfm-search-icon": {
    display: "block",
  },
});

const defaultSearchKeymap = searchKeymap.filter((b) => b.key !== "Mod-f");

export const usfmSearchKeymap: readonly KeyBinding[] = [
  { key: "Mod-f", run: openFindPanel, scope: "editor search-panel" },
  { key: "Mod-h", run: openFindReplacePanel, scope: "editor search-panel" },
  ...defaultSearchKeymap,
];

/** CodeMirror search extension with USFM-styled upper-right panel. */
export const usfmSearchExtensions: Extension = [
  replacePanelVisibleField,
  search({
    top: true,
    createPanel: (view) => new UsfmSearchPanel(view),
  }),
  usfmSearchTheme,
  keymap.of(usfmSearchKeymap),
];
