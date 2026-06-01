/** VS Code–style inline SVG icons for the find/replace panel. */

const NS = "http://www.w3.org/2000/svg";

function svgRoot(viewBox = "0 0 16 16"): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "usfm-search-icon");
  return svg;
}

function textIcon(content: string, opts?: { weight?: string; size?: string }): SVGSVGElement {
  const svg = svgRoot();
  const t = document.createElementNS(NS, "text");
  t.setAttribute("x", "1");
  t.setAttribute("y", "12");
  t.setAttribute("font-size", opts?.size ?? "11");
  t.setAttribute("font-family", "system-ui, sans-serif");
  t.setAttribute("fill", "currentColor");
  if (opts?.weight) t.setAttribute("font-weight", opts.weight);
  t.textContent = content;
  svg.appendChild(t);
  return svg;
}

/** Match case — "Aa". */
export function iconMatchCase(): SVGSVGElement {
  const svg = svgRoot();
  const a = document.createElementNS(NS, "text");
  a.setAttribute("x", "1");
  a.setAttribute("y", "12");
  a.setAttribute("font-size", "11");
  a.setAttribute("font-weight", "600");
  a.setAttribute("font-family", "system-ui, sans-serif");
  a.setAttribute("fill", "currentColor");
  a.textContent = "A";
  const b = document.createElementNS(NS, "text");
  b.setAttribute("x", "8");
  b.setAttribute("y", "12");
  b.setAttribute("font-size", "11");
  b.setAttribute("font-family", "system-ui, sans-serif");
  b.setAttribute("fill", "currentColor");
  b.textContent = "a";
  svg.append(a, b);
  return svg;
}

/** Match whole word — "ab" with underline bracket. */
export function iconMatchWholeWord(): SVGSVGElement {
  const svg = svgRoot();
  const ab = document.createElementNS(NS, "text");
  ab.setAttribute("x", "2");
  ab.setAttribute("y", "10");
  ab.setAttribute("font-size", "10");
  ab.setAttribute("font-family", "ui-monospace, monospace");
  ab.setAttribute("fill", "currentColor");
  ab.textContent = "ab";
  const bracket = document.createElementNS(NS, "path");
  bracket.setAttribute("fill", "none");
  bracket.setAttribute("stroke", "currentColor");
  bracket.setAttribute("stroke-width", "1.2");
  bracket.setAttribute("d", "M2 12.5h8");
  svg.append(ab, bracket);
  return svg;
}

/** Use regular expression — ".*". */
export function iconRegex(): SVGSVGElement {
  return textIcon(".*", { size: "11" });
}

/** Expand replace section — chevron down. */
export function iconChevronDown(): SVGSVGElement {
  const svg = svgRoot();
  const p = document.createElementNS(NS, "path");
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.5");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  p.setAttribute("d", "M4 6l4 4 4-4");
  svg.appendChild(p);
  return svg;
}

/** Collapse replace section — chevron right. */
export function iconChevronRight(): SVGSVGElement {
  const svg = svgRoot();
  const p = document.createElementNS(NS, "path");
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.5");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  p.setAttribute("d", "M6 4l4 4-4 4");
  svg.appendChild(p);
  return svg;
}

/** Previous match. */
export function iconFindPrevious(): SVGSVGElement {
  const svg = svgRoot();
  const p = document.createElementNS(NS, "path");
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.5");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  p.setAttribute("d", "M8 4.5L4.5 8 8 11.5M11.5 4.5 8 8 11.5 11.5");
  svg.appendChild(p);
  return svg;
}

/** Next match. */
export function iconFindNext(): SVGSVGElement {
  const svg = svgRoot();
  const p = document.createElementNS(NS, "path");
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.5");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  p.setAttribute("d", "M8 4.5l3.5 3.5L8 11.5M4.5 4.5 8 8 4.5 11.5");
  svg.appendChild(p);
  return svg;
}

/** Close panel. */
export function iconClose(): SVGSVGElement {
  const svg = svgRoot();
  const p = document.createElementNS(NS, "path");
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.5");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("d", "M4.5 4.5l7 7M11.5 4.5l-7 7");
  svg.appendChild(p);
  return svg;
}

/** Replace one — stacked boxes with down arrow (VS Code style). */
export function iconReplaceOne(): SVGSVGElement {
  const svg = svgRoot();
  const r1 = document.createElementNS(NS, "rect");
  r1.setAttribute("x", "3");
  r1.setAttribute("y", "2");
  r1.setAttribute("width", "7");
  r1.setAttribute("height", "4");
  r1.setAttribute("rx", "0.5");
  r1.setAttribute("fill", "none");
  r1.setAttribute("stroke", "currentColor");
  r1.setAttribute("stroke-width", "1");
  const r2 = document.createElementNS(NS, "rect");
  r2.setAttribute("x", "5");
  r2.setAttribute("y", "9");
  r2.setAttribute("width", "7");
  r2.setAttribute("height", "4");
  r2.setAttribute("rx", "0.5");
  r2.setAttribute("fill", "none");
  r2.setAttribute("stroke", "currentColor");
  r2.setAttribute("stroke-width", "1");
  const arrow = document.createElementNS(NS, "path");
  arrow.setAttribute("fill", "none");
  arrow.setAttribute("stroke", "currentColor");
  arrow.setAttribute("stroke-width", "1.2");
  arrow.setAttribute("stroke-linecap", "round");
  arrow.setAttribute("d", "M8 6.5v2.5");
  svg.append(r1, r2, arrow);
  return svg;
}

/** Replace all — wider stacked boxes. */
export function iconReplaceAll(): SVGSVGElement {
  const svg = svgRoot();
  const r1 = document.createElementNS(NS, "rect");
  r1.setAttribute("x", "1");
  r1.setAttribute("y", "2");
  r1.setAttribute("width", "9");
  r1.setAttribute("height", "4");
  r1.setAttribute("rx", "0.5");
  r1.setAttribute("fill", "none");
  r1.setAttribute("stroke", "currentColor");
  r1.setAttribute("stroke-width", "1");
  const r2 = document.createElementNS(NS, "rect");
  r2.setAttribute("x", "4");
  r2.setAttribute("y", "9");
  r2.setAttribute("width", "9");
  r2.setAttribute("height", "4");
  r2.setAttribute("rx", "0.5");
  r2.setAttribute("fill", "none");
  r2.setAttribute("stroke", "currentColor");
  r2.setAttribute("stroke-width", "1");
  const arrow = document.createElementNS(NS, "path");
  arrow.setAttribute("fill", "none");
  arrow.setAttribute("stroke", "currentColor");
  arrow.setAttribute("stroke-width", "1.2");
  arrow.setAttribute("stroke-linecap", "round");
  arrow.setAttribute("d", "M8 6.5v2.5");
  svg.append(r1, r2, arrow);
  return svg;
}
