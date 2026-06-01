import elt from "crelt";
import {
  search,
  SearchQuery,
  setSearchQuery,
  getSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
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
import { EditorState, StateEffect, StateField, Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  iconMatchCase,
  iconRegex,
  iconExactMatch,
  iconReplaceToggle,
  iconFindNext,
  iconFindPrevious,
  iconClose,
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

function modeButton(
  pressed: boolean,
  ariaLabel: string,
  icon: SVGSVGElement,
  onclick: () => void,
): HTMLButtonElement {
  return elt(
    "button",
    {
      type: "button",
      class: `usfm-search-mode-btn${pressed ? " usfm-search-mode-btn--on" : ""}`,
      "aria-label": ariaLabel,
      "aria-pressed": pressed ? "true" : "false",
      onclick,
    },
    [icon],
  ) as HTMLButtonElement;
}

function navButton(ariaLabel: string, icon: SVGSVGElement, onclick: () => void): HTMLButtonElement {
  return elt(
    "button",
    {
      type: "button",
      class: "usfm-search-nav-btn",
      "aria-label": ariaLabel,
      onclick,
    },
    [icon],
  ) as HTMLButtonElement;
}

class UsfmSearchPanel implements Panel {
  searchField: HTMLInputElement;
  replaceField: HTMLInputElement;
  replaceRow: HTMLElement;
  dom: HTMLElement;
  query: SearchQuery;
  private replaceVisible: boolean;

  constructor(readonly view: EditorView) {
    this.query = getSearchQuery(view.state);
    this.replaceVisible = getReplacePanelVisible(view.state);
    this.commit = this.commit.bind(this);
    this.toggleReplaceVisible = this.toggleReplaceVisible.bind(this);

    this.searchField = elt("input", {
      value: this.query.search,
      placeholder: "Find",
      "aria-label": "Find",
      class: "cm-textfield usfm-search-input",
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
      class: "cm-textfield usfm-search-input",
      name: "replace",
      form: "",
      oninput: this.commit,
      onchange: this.commit,
    }) as HTMLInputElement;

    const caseBtn = modeButton(
      this.query.caseSensitive,
      "Match case",
      iconMatchCase(),
      () => this.toggleOption("caseSensitive"),
    );
    const regexBtn = modeButton(
      this.query.regexp,
      "Regular expression",
      iconRegex(),
      () => this.toggleOption("regexp"),
    );
    const exactBtn = modeButton(
      this.query.literal,
      "Exact match",
      iconExactMatch(),
      () => this.toggleOption("literal"),
    );
    const replaceToggleBtn = modeButton(
      this.replaceVisible,
      this.replaceVisible ? "Hide replace" : "Show replace",
      iconReplaceToggle(),
      this.toggleReplaceVisible,
    );

    const findRow = elt("div", { class: "usfm-search-row" }, [
      this.searchField,
      elt("div", { class: "usfm-search-modes" }, [caseBtn, regexBtn, exactBtn, replaceToggleBtn]),
      navButton("Previous match", iconFindPrevious(), () => findPrevious(this.view)),
      navButton("Next match", iconFindNext(), () => findNext(this.view)),
      navButton("Close", iconClose(), () => closeSearchPanel(this.view)),
    ]);

    const replaceActions = view.state.readOnly
      ? []
      : [
          elt(
            "button",
            {
              type: "button",
              class: "cm-button usfm-search-action-btn",
              onclick: () => replaceNext(this.view),
            },
            ["Replace"],
          ),
          elt(
            "button",
            {
              type: "button",
              class: "cm-button usfm-search-action-btn",
              onclick: () => replaceAll(this.view),
            },
            ["All"],
          ),
        ];

    this.replaceRow = elt("div", { class: "usfm-search-row usfm-search-replace-row" }, [
      this.replaceField,
      ...replaceActions,
    ]);

    this.dom = elt(
      "div",
      {
        onkeydown: (e: KeyboardEvent) => this.keydown(e),
        class: "cm-search usfm-search-panel",
      },
      this.replaceVisible ? [findRow, this.replaceRow] : [findRow],
    );
    this.syncReplaceRow();
  }

  private toggleOption(option: "caseSensitive" | "regexp" | "literal") {
    const next = new SearchQuery({
      search: this.searchField.value,
      replace: this.replaceField.value,
      caseSensitive: option === "caseSensitive" ? !this.query.caseSensitive : this.query.caseSensitive,
      regexp: option === "regexp" ? !this.query.regexp : this.query.regexp,
      literal: option === "literal" ? !this.query.literal : this.query.literal,
    });
    if (!next.eq(this.query)) {
      this.query = next;
      this.view.dispatch({ effects: setSearchQuery.of(next) });
    }
    this.refreshModeButtons();
  }

  private refreshModeButtons() {
    const modes = this.dom.querySelector(".usfm-search-modes");
    if (!modes) return;
    const buttons = modes.querySelectorAll<HTMLButtonElement>(".usfm-search-mode-btn");
    const flags = [this.query.caseSensitive, this.query.regexp, this.query.literal, this.replaceVisible];
    buttons.forEach((btn, i) => {
      const on = flags[i] ?? false;
      btn.classList.toggle("usfm-search-mode-btn--on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (i === 3) {
        btn.setAttribute("aria-label", on ? "Hide replace" : "Show replace");
      }
    });
  }

  private toggleReplaceVisible() {
    this.replaceVisible = !this.replaceVisible;
    this.view.dispatch({ effects: setReplacePanelVisible.of(this.replaceVisible) });
    this.syncReplaceRow();
    this.refreshModeButtons();
  }

  private syncReplaceRow() {
    const hasRow = this.dom.contains(this.replaceRow);
    if (this.replaceVisible && !hasRow) {
      this.dom.appendChild(this.replaceRow);
    } else if (!this.replaceVisible && hasRow) {
      this.replaceRow.remove();
    }
  }

  commit() {
    const query = new SearchQuery({
      search: this.searchField.value,
      replace: this.replaceField.value,
      caseSensitive: this.query.caseSensitive,
      regexp: this.query.regexp,
      literal: this.query.literal,
    });
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
      replaceNext(this.view);
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
          this.refreshModeButtons();
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
  "&.cm-focused": {},
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
    padding: "6px 8px",
    margin: "6px 8px 0 auto",
    width: "max-content",
    maxWidth: "min(420px, calc(100% - 16px))",
    marginLeft: "auto",
    backgroundColor: "var(--usfm-search-panel-bg, #f8fafc)",
    border: "1px solid var(--usfm-search-panel-border, #cbd5e1)",
    borderRadius: "6px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.12)",
    fontSize: "13px",
  },
  ".usfm-search-row": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px",
  },
  ".usfm-search-replace-row": {
    marginTop: "4px",
  },
  ".usfm-search-input": {
    flex: "1 1 140px",
    minWidth: "120px",
    margin: 0,
  },
  ".usfm-search-modes": {
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
  },
  ".usfm-search-mode-btn, .usfm-search-nav-btn": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "26px",
    padding: 0,
    margin: 0,
    border: "1px solid transparent",
    borderRadius: "4px",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  },
  ".usfm-search-mode-btn:hover, .usfm-search-nav-btn:hover": {
    backgroundColor: "var(--usfm-search-btn-hover, rgba(15, 23, 42, 0.08))",
  },
  ".usfm-search-mode-btn--on": {
    backgroundColor: "var(--usfm-search-btn-active, #dbeafe)",
    borderColor: "var(--usfm-search-btn-active-border, #93c5fd)",
    color: "#1e40af",
  },
  ".usfm-search-action-btn": {
    fontSize: "12px",
    padding: "2px 8px",
    margin: 0,
  },
  ".usfm-search-mode-icon": {
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
