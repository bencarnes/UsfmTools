// src/lexer.ts
var Lexer = class {
  source;
  pos = 0;
  line = 0;
  col = 0;
  tokens = [];
  constructor(source) {
    this.source = source;
  }
  tokenize() {
    this.tokens = [];
    this.pos = 0;
    this.line = 0;
    this.col = 0;
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === "\\") {
        this.readMarker();
      } else if (ch === "|") {
        this.readAttributes();
      } else if (ch === "/" && this.peek(1) === "/") {
        this.readOptBreak();
      } else if (ch === "\n" || ch === "\r") {
        this.readNewline();
      } else {
        this.readText();
      }
    }
    return this.tokens;
  }
  currentPosition() {
    return { line: this.line, column: this.col, offset: this.pos };
  }
  peek(ahead = 0) {
    return this.source[this.pos + ahead];
  }
  advance(count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.pos < this.source.length) {
        if (this.source[this.pos] === "\n") {
          this.line++;
          this.col = 0;
        } else {
          this.col++;
        }
        this.pos++;
      }
    }
  }
  readMarker() {
    const position = this.currentPosition();
    this.advance();
    const ch = this.source[this.pos];
    if (ch === "\\" || ch === "|" || ch === "~") {
      const text = ch;
      this.advance();
      this.appendText(text, position);
      return;
    }
    if (ch === "\n" || ch === "\r") {
      this.readNewline();
      return;
    }
    let isNested = false;
    if (this.source[this.pos] === "+") {
      isNested = true;
      this.advance();
    }
    let marker = "";
    while (this.pos < this.source.length && /[a-zA-Z_0-9-]/.test(this.source[this.pos])) {
      marker += this.source[this.pos];
      this.advance();
    }
    if (marker === "") {
      this.appendText("\\", position);
      return;
    }
    let isEnd = false;
    if (this.pos < this.source.length && this.source[this.pos] === "*") {
      isEnd = true;
      this.advance();
    }
    const token = {
      type: isEnd ? "end_marker" /* EndMarker */ : "marker" /* Marker */,
      value: marker,
      position,
      isNested,
      isEnd
    };
    this.tokens.push(token);
  }
  readAttributes() {
    const position = this.currentPosition();
    this.advance();
    const attributes = {};
    let defaultValue = "";
    this.skipSpaces();
    let hasKeyValue = false;
    while (this.pos < this.source.length) {
      const keyStart = this.pos;
      let key = "";
      while (this.pos < this.source.length && /[a-zA-Z_0-9-]/.test(this.source[this.pos])) {
        key += this.source[this.pos];
        this.advance();
      }
      this.skipSpaces();
      if (key && this.source[this.pos] === "=") {
        this.advance();
        this.skipSpaces();
        if (this.source[this.pos] === '"') {
          this.advance();
          let value = "";
          while (this.pos < this.source.length && this.source[this.pos] !== '"') {
            if (this.source[this.pos] === "\\" && this.peek(1) === '"') {
              this.advance();
            }
            value += this.source[this.pos];
            this.advance();
          }
          if (this.source[this.pos] === '"') {
            this.advance();
          }
          attributes[key] = value;
          hasKeyValue = true;
          this.skipSpaces();
          continue;
        }
      }
      if (!hasKeyValue) {
        this.pos = keyStart;
        this.col = position.column + 1;
        this.line = position.line;
        this.pos = keyStart;
        defaultValue = this.readUntilMarkerEnd();
        break;
      } else {
        this.pos = keyStart;
        break;
      }
    }
    if (hasKeyValue) {
      this.tokens.push({
        type: "attribute" /* Attribute */,
        value: "",
        position,
        attributes
      });
    } else if (defaultValue) {
      this.tokens.push({
        type: "attribute" /* Attribute */,
        value: defaultValue,
        position
      });
    }
  }
  readUntilMarkerEnd() {
    let text = "";
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === "\\") break;
      if (ch === "\n" || ch === "\r") break;
      text += ch;
      this.advance();
    }
    return text;
  }
  readOptBreak() {
    const position = this.currentPosition();
    this.advance();
    this.advance();
    this.tokens.push({
      type: "optbreak" /* OptBreak */,
      value: "//",
      position
    });
  }
  readNewline() {
    const position = this.currentPosition();
    if (this.source[this.pos] === "\r") {
      this.advance();
    }
    if (this.pos < this.source.length && this.source[this.pos] === "\n") {
      this.advance();
    }
    this.tokens.push({
      type: "newline" /* Newline */,
      value: "\n",
      position
    });
  }
  readText() {
    const position = this.currentPosition();
    let text = "";
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === "\\") break;
      if (ch === "|") break;
      if (ch === "\n" || ch === "\r") break;
      if (ch === "/" && this.peek(1) === "/") break;
      text += ch;
      this.advance();
    }
    if (text) {
      this.appendText(text, position);
    }
  }
  appendText(text, position) {
    const last = this.tokens[this.tokens.length - 1];
    if (last && last.type === "text" /* Text */) {
      last.value += text;
    } else {
      this.tokens.push({
        type: "text" /* Text */,
        value: text,
        position
      });
    }
  }
  skipSpaces() {
    while (this.pos < this.source.length && (this.source[this.pos] === " " || this.source[this.pos] === "	")) {
      this.advance();
    }
  }
};

// src/grammar.ts
var MARKER_CATEGORIES = {};
var categoryDefinitions = {
  attribute: "cp vp usfm ca va cat vid",
  header: "ide h1 h2 h3 h toc1 toc2 toc3 toca1 toca2 toca3",
  title: "mt1 mt2 mt3 mt4 mt",
  introduction: "imt1 imt2 imt3 imt4 imte1 imte2 imte imt ib ie iex ili1 ili2 ili imi imq im io1 io2 io3 io4 iot io ipc ipi ipq ipr ip iq1 iq2 iq3 iq is1 is2 is ilit",
  introchar: "ior iqt",
  sectionpara: "restore ms1 ms2 ms3 ms mr mte1 mte2 mte r s1 s2 s3 s4 sr sp sd1 sd2 sd3 sd4 sd s cl cd",
  versepara: "cls nb pc pi1 pi2 pi3 pi po pr pmo pmc pmr pm ph1 ph2 ph3 ph p q1 q2 q3 q4 qc qr qm1 qm2 qm3 qm qd q b d mi1 mi2 mi3 mi4 mi m",
  char: "qac qs add addpn bk dc efm fm fv k nd ndx ord png pn pro qt rq sig sls tl wg wh wa wj jmp no it bdit bd em sc sup w rb pl ta",
  footnote: "fe f efe ef",
  footnotechar: "fr ft fk fqa fq fl fw fdc fp",
  crossreference: "ex x",
  crossreferencechar: "xt xop xo xta xk xq xot xnt xdc",
  list: "lh li1 li2 li3 li4 lim1 lim2 lim3 lim4 lim li lf",
  listchar: "litl lik liv1 liv2 liv3 liv4 liv5 liv",
  cell: "th1 th2 th3 th4 th5 th6 th7 th8 th9 th10 th11 th12 tc1 tc2 tc3 tc4 tc5 tc6 tc7 tc8 tc9 tc10 tc11 tc12 tcr1 tcr2 tcr3 tcr4 tcr5 tcr6 tcr7 tcr8 tcr9 tcc1 tcc2 tcc3 tcc4 tcc5 tcc6 tcc7 tcc8 tcc9 tcc10 tcc11 tcc12 thc1 thc2 thc3 thc4 thc5 thc6 thc7 thc8 thc9 thc10 thc11 tch12 thr1 thr2 thr3 thr4 thr5 thr6 thr7 thr8 thr9 thr10 thr11 thr12",
  milestone: "ts-s ts-e ts t-s t-e qt1-s qt1-e qt2-s qt2-e qt3-s qt3-e qt4-s qt4-e qt5-s qt5-e qt-s qt-e wj-s wj-e",
  otherpara: "sts lit pb p1 p2 qa k1 k2 rem",
  internal: "id c periph v fig esb esbe ref tr"
};
for (const [category, markers] of Object.entries(categoryDefinitions)) {
  for (const marker of markers.split(/\s+/).filter(Boolean)) {
    MARKER_CATEGORIES[marker] = category;
  }
}
var PARA_CATEGORIES = /* @__PURE__ */ new Set([
  "header",
  "title",
  "introduction",
  "sectionpara",
  "versepara",
  "list",
  "otherpara"
]);
var CHAR_CATEGORIES = /* @__PURE__ */ new Set([
  "char",
  "introchar",
  "listchar",
  "footnotechar",
  "crossreferencechar"
]);
var NOTE_CATEGORIES = /* @__PURE__ */ new Set([
  "footnote",
  "crossreference"
]);
function getMarkerCategory(marker) {
  return MARKER_CATEGORIES[marker] ?? "unknown";
}
function isParaMarker(marker) {
  const cat = getMarkerCategory(marker);
  return PARA_CATEGORIES.has(cat);
}
function isCharMarker(marker) {
  const cat = getMarkerCategory(marker);
  return CHAR_CATEGORIES.has(cat);
}
function isNoteMarker(marker) {
  const cat = getMarkerCategory(marker);
  return NOTE_CATEGORIES.has(cat);
}
function isCellMarker(marker) {
  return getMarkerCategory(marker) === "cell";
}
function isMilestoneMarker(marker) {
  return getMarkerCategory(marker) === "milestone";
}

// src/parser.ts
var Parser = class {
  tokens = [];
  pos = 0;
  errors = [];
  options;
  constructor(options = {}) {
    this.options = options;
  }
  /**
   * Parse USFM text and return a structured document.
   */
  parse(input) {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
    this.pos = 0;
    this.errors = [];
    const document = this.parseDocument();
    return {
      document,
      errors: this.errors
    };
  }
  parseDocument() {
    const doc = {
      type: "document",
      children: []
    };
    while (this.pos < this.tokens.length) {
      const node = this.parseTopLevel();
      if (node) {
        doc.children.push(node);
      }
    }
    return doc;
  }
  parseTopLevel() {
    const token = this.current();
    if (!token) return null;
    if (token.type === "marker" /* Marker */) {
      const marker = token.value;
      if (marker === "id") {
        return this.parseId();
      }
      if (marker === "c") {
        return this.parseChapter();
      }
      if (marker === "v") {
        return this.parseVerse();
      }
      if (isParaMarker(marker)) {
        return this.parseParagraph();
      }
      if (isCharMarker(marker)) {
        return this.parseChar();
      }
      if (isNoteMarker(marker)) {
        return this.parseNote();
      }
      if (isCellMarker(marker)) {
        return this.parseCell();
      }
      if (isMilestoneMarker(marker)) {
        return this.parseMilestone();
      }
      if (marker === "tr") {
        return this.parseTableRow();
      }
      if (marker === "fig") {
        return this.parseFigure();
      }
      if (marker === "esb") {
        return this.parseSidebar();
      }
      const cat = getMarkerCategory(marker);
      if (cat === "header" || cat === "attribute" || cat === "internal") {
        return this.parseHeaderOrMisc();
      }
      return this.parseUnknown();
    }
    if (token.type === "end_marker" /* EndMarker */) {
      this.advance();
      return null;
    }
    if (token.type === "text" /* Text */ || token.type === "newline" /* Newline */) {
      return this.parseTextRun();
    }
    this.advance();
    return null;
  }
  parseId() {
    const token = this.current();
    const position = token.position;
    this.advance();
    let code = "";
    let description;
    const textToken = this.current();
    if (textToken && (textToken.type === "text" /* Text */ || textToken.type === "newline" /* Newline */)) {
      const text = this.consumeTextLine();
      const parts = text.trimStart().split(/\s+/);
      code = parts[0] ?? "";
      if (parts.length > 1) {
        description = parts.slice(1).join(" ").trim();
      }
    }
    const node = {
      type: "book",
      marker: "id",
      code,
      position,
      children: []
    };
    if (description) {
      node.description = description;
    }
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "marker" /* Marker */ && cur.value === "id") break;
      const child = this.parseTopLevel();
      if (child) {
        node.children.push(child);
      }
    }
    return node;
  }
  parseChapter() {
    const token = this.current();
    const position = token.position;
    this.advance();
    let number = "";
    const textToken = this.current();
    if (textToken && textToken.type === "text" /* Text */) {
      const text = textToken.value.trimStart();
      const parts = text.split(/\s+/);
      number = parts[0] ?? "";
      this.advance();
    }
    this.skipNewlines();
    const node = {
      type: "chapter",
      marker: "c",
      number,
      position,
      children: []
    };
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "marker" /* Marker */ && (cur.value === "c" || cur.value === "id")) break;
      const child = this.parseTopLevel();
      if (child) {
        node.children.push(child);
      }
    }
    return node;
  }
  parseVerse() {
    const token = this.current();
    const position = token.position;
    this.advance();
    let number = "";
    const textToken = this.current();
    if (textToken && textToken.type === "text" /* Text */) {
      const text = textToken.value.trimStart();
      const match = text.match(/^(\S+)\s*(.*)/);
      if (match) {
        number = match[1];
        const remaining = match[2];
        if (remaining) {
          this.tokens[this.pos] = {
            ...textToken,
            value: remaining
          };
        } else {
          this.advance();
        }
      } else {
        this.advance();
      }
    }
    const node = {
      type: "verse",
      marker: "v",
      number,
      position,
      children: []
    };
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "marker" /* Marker */) {
        if (cur.value === "v" || cur.value === "c" || cur.value === "id") break;
        if (isParaMarker(cur.value)) break;
      }
      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }
    return node;
  }
  parseParagraph() {
    const token = this.current();
    const position = token.position;
    const marker = token.value;
    this.advance();
    const node = {
      type: "paragraph",
      marker,
      position,
      children: []
    };
    this.skipNewlines();
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "marker" /* Marker */) {
        if (isParaMarker(cur.value)) break;
        if (cur.value === "c" || cur.value === "id") break;
        if (cur.value === "tr") break;
        if (cur.value === "esb" || cur.value === "esbe") break;
      }
      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }
    return node;
  }
  parseChar() {
    const token = this.current();
    const position = token.position;
    const marker = token.value;
    this.advance();
    const node = {
      type: "char",
      marker,
      position,
      children: []
    };
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "end_marker" /* EndMarker */ && cur.value === marker) {
        this.advance();
        break;
      }
      if (cur.type === "marker" /* Marker */) {
        if (isParaMarker(cur.value) || cur.value === "c" || cur.value === "id") break;
      }
      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }
    return node;
  }
  parseNote() {
    const token = this.current();
    const position = token.position;
    const marker = token.value;
    this.advance();
    let caller = "";
    const textToken = this.current();
    if (textToken && textToken.type === "text" /* Text */) {
      const text = textToken.value.trimStart();
      const parts = text.split(/\s+/);
      caller = parts[0] ?? "";
      const remaining = parts.slice(1).join(" ");
      if (remaining) {
        this.tokens[this.pos] = { ...textToken, value: remaining };
      } else {
        this.advance();
      }
    }
    const node = {
      type: "note",
      marker,
      caller,
      position,
      children: []
    };
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "end_marker" /* EndMarker */ && cur.value === marker) {
        this.advance();
        break;
      }
      if (cur.type === "marker" /* Marker */) {
        if (isParaMarker(cur.value) || cur.value === "c" || cur.value === "id") break;
      }
      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }
    return node;
  }
  parseTableRow() {
    const token = this.current();
    const position = token.position;
    this.advance();
    const node = {
      type: "row",
      marker: "tr",
      position,
      children: []
    };
    this.skipNewlines();
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "marker" /* Marker */) {
        if (cur.value === "tr") break;
        if (isCellMarker(cur.value)) {
          node.children.push(this.parseCell());
          continue;
        }
        if (isParaMarker(cur.value) || cur.value === "c" || cur.value === "id") break;
      }
      if (cur.type === "newline" /* Newline */) {
        this.advance();
        continue;
      }
      this.advance();
    }
    return node;
  }
  parseCell() {
    const token = this.current();
    const position = token.position;
    const marker = token.value;
    this.advance();
    const node = {
      type: "cell",
      marker,
      position,
      children: []
    };
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "marker" /* Marker */) {
        if (isCellMarker(cur.value) || cur.value === "tr") break;
        if (isParaMarker(cur.value) || cur.value === "c" || cur.value === "id") break;
      }
      if (cur.type === "newline" /* Newline */) {
        this.advance();
        break;
      }
      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }
    return node;
  }
  parseMilestone() {
    const token = this.current();
    const position = token.position;
    const marker = token.value;
    this.advance();
    const node = {
      type: "milestone",
      marker,
      position
    };
    const next = this.current();
    if (next && next.type === "attribute" /* Attribute */) {
      node.attributes = next.attributes ?? { default: next.value };
      this.advance();
    }
    const end = this.current();
    if (end && end.type === "end_marker" /* EndMarker */ && end.value === marker) {
      this.advance();
    }
    return node;
  }
  parseFigure() {
    const token = this.current();
    const position = token.position;
    this.advance();
    const node = {
      type: "figure",
      marker: "fig",
      position,
      attributes: {}
    };
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "end_marker" /* EndMarker */ && cur.value === "fig") {
        this.advance();
        break;
      }
      if (cur.type === "attribute" /* Attribute */) {
        if (cur.attributes) {
          node.attributes = { ...node.attributes, ...cur.attributes };
        } else if (cur.value) {
          node.attributes["default"] = cur.value;
        }
        this.advance();
        continue;
      }
      if (cur.type === "text" /* Text */) {
        if (!node.attributes["caption"]) {
          node.attributes["caption"] = cur.value.trim();
        }
      }
      this.advance();
    }
    return node;
  }
  parseSidebar() {
    const token = this.current();
    const position = token.position;
    this.advance();
    const node = {
      type: "sidebar",
      marker: "esb",
      position,
      children: []
    };
    this.skipNewlines();
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "marker" /* Marker */ && cur.value === "esbe") {
        this.advance();
        break;
      }
      const child = this.parseTopLevel();
      if (child) {
        node.children.push(child);
      }
    }
    return node;
  }
  parseHeaderOrMisc() {
    const token = this.current();
    const position = token.position;
    const marker = token.value;
    this.advance();
    const node = {
      type: "paragraph",
      marker,
      position,
      children: []
    };
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "newline" /* Newline */) {
        this.advance();
        break;
      }
      if (cur.type === "marker" /* Marker */ || cur.type === "end_marker" /* EndMarker */) break;
      if (cur.type === "text" /* Text */) {
        const textNode = {
          type: "text",
          text: cur.value,
          position: cur.position
        };
        node.children.push(textNode);
      }
      this.advance();
    }
    return node;
  }
  parseUnknown() {
    const token = this.current();
    const position = token.position;
    const marker = token.value;
    this.advance();
    this.addError(`Unknown marker '\\${marker}'`, position);
    const node = {
      type: "unknown",
      marker,
      position
    };
    return node;
  }
  parseInlineContent() {
    const cur = this.current();
    if (!cur) return null;
    if (cur.type === "text" /* Text */) {
      return this.parseTextRun();
    }
    if (cur.type === "newline" /* Newline */) {
      this.advance();
      const node = {
        type: "text",
        text: " ",
        position: cur.position
      };
      return node;
    }
    if (cur.type === "marker" /* Marker */) {
      const marker = cur.value;
      if (marker === "v") {
        return this.parseVerse();
      }
      const cat = getMarkerCategory(marker);
      if (cat === "footnotechar" || cat === "crossreferencechar") {
        return this.parseNoteChar(cat);
      }
      if (isCharMarker(marker)) {
        return this.parseChar();
      }
      if (isNoteMarker(marker)) {
        return this.parseNote();
      }
      if (isMilestoneMarker(marker)) {
        return this.parseMilestone();
      }
      if (cat === "attribute") {
        return this.parseInlineAttribute();
      }
      return this.parseUnknown();
    }
    if (cur.type === "end_marker" /* EndMarker */) {
      this.advance();
      return null;
    }
    if (cur.type === "optbreak" /* OptBreak */) {
      this.advance();
      const node = {
        type: "optbreak",
        position: cur.position
      };
      return node;
    }
    if (cur.type === "attribute" /* Attribute */) {
      this.advance();
      return null;
    }
    this.advance();
    return null;
  }
  parseNoteChar(_category) {
    const token = this.current();
    const position = token.position;
    const marker = token.value;
    this.advance();
    const node = {
      type: "char",
      marker,
      position,
      children: []
    };
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "end_marker" /* EndMarker */ && cur.value === marker) {
        this.advance();
        break;
      }
      if (cur.type === "marker" /* Marker */) {
        const cat = getMarkerCategory(cur.value);
        if (cat === "footnotechar" || cat === "crossreferencechar") {
          break;
        }
        if (isNoteMarker(cur.value)) break;
        if (isParaMarker(cur.value)) break;
      }
      if (cur.type === "end_marker" /* EndMarker */) {
        break;
      }
      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }
    return node;
  }
  parseInlineAttribute() {
    const token = this.current();
    const position = token.position;
    const marker = token.value;
    this.advance();
    const node = {
      type: "char",
      marker,
      position,
      children: []
    };
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "end_marker" /* EndMarker */ && cur.value === marker) {
        this.advance();
        break;
      }
      if (cur.type === "marker" /* Marker */) break;
      if (cur.type === "newline" /* Newline */) break;
      if (cur.type === "text" /* Text */) {
        node.children.push({
          type: "text",
          text: cur.value,
          position: cur.position
        });
      }
      this.advance();
    }
    return node;
  }
  parseTextRun() {
    const token = this.current();
    let text = token.value;
    const position = token.position;
    this.advance();
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "text" /* Text */) {
        text += cur.value;
        this.advance();
      } else {
        break;
      }
    }
    return {
      type: "text",
      text,
      position
    };
  }
  consumeTextLine() {
    let text = "";
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === "text" /* Text */) {
        text += cur.value;
        this.advance();
      } else if (cur.type === "newline" /* Newline */) {
        this.advance();
        break;
      } else {
        break;
      }
    }
    return text;
  }
  current() {
    return this.tokens[this.pos];
  }
  advance() {
    this.pos++;
  }
  skipNewlines() {
    while (this.pos < this.tokens.length && this.tokens[this.pos].type === "newline" /* Newline */) {
      this.pos++;
    }
  }
  addError(message, position) {
    const error = { message, position };
    this.errors.push(error);
    if (this.options.strict) {
      throw new Error(`Parse error at ${position?.line}:${position?.column}: ${message}`);
    }
  }
};

// src/index.ts
function parse(input, options) {
  const parser = new Parser(options);
  return parser.parse(input);
}
export {
  Lexer,
  Parser,
  getMarkerCategory,
  isCellMarker,
  isCharMarker,
  isMilestoneMarker,
  isNoteMarker,
  isParaMarker,
  parse
};
//# sourceMappingURL=index.js.map