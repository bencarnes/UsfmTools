/** Small inline SVG icons for search mode toggles (DOM nodes for CodeMirror panels). */

function svgIcon(pathD: string, viewBox = "0 0 18 18"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "usfm-search-mode-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.35");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  return svg;
}

/** Match case — capital A beside lowercase a. */
export function iconMatchCase(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "usfm-search-mode-icon");
  const a1 = document.createElementNS("http://www.w3.org/2000/svg", "text");
  a1.setAttribute("x", "2");
  a1.setAttribute("y", "13");
  a1.setAttribute("font-size", "11");
  a1.setAttribute("font-weight", "700");
  a1.setAttribute("fill", "currentColor");
  a1.textContent = "A";
  const a2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
  a2.setAttribute("x", "9");
  a2.setAttribute("y", "13");
  a2.setAttribute("font-size", "11");
  a2.setAttribute("fill", "currentColor");
  a2.textContent = "a";
  svg.append(a1, a2);
  return svg;
}

/** Regular expression — dot and asterisk. */
export function iconRegex(): SVGSVGElement {
  return svgIcon("M4 9h2.2c1.2 0 2-.8 2-2s-.8-2-2-2H4M12 5v8M15.5 9c0 2.2-1.5 4-3.5 4");
}

/** Exact match — equals sign between vertical bars. */
export function iconExactMatch(): SVGSVGElement {
  return svgIcon("M5 5.5v7M13 5.5v7M7.5 9h3");
}

/** Replace mode — swap / exchange arrows. */
export function iconReplaceToggle(): SVGSVGElement {
  return svgIcon("M4 6.5h7M9.5 4 12 6.5 9.5 9M14 11.5H7M8.5 9 6 11.5 8.5 14");
}

/** Next match — down chevron. */
export function iconFindNext(): SVGSVGElement {
  return svgIcon("M5 7l4 4 4-4");
}

/** Previous match — up chevron. */
export function iconFindPrevious(): SVGSVGElement {
  return svgIcon("M5 11l4-4 4 4");
}

/** Close panel. */
export function iconClose(): SVGSVGElement {
  return svgIcon("M5 5l8 8M13 5l-8 8");
}
