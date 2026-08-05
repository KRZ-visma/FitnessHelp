export function uid() {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/** Toont resterende tijd als geheel aantal seconden (zoals ingevuld in het formulier). */
export function formatSeconds(totalSeconds) {
  return String(Math.max(0, Math.ceil(totalSeconds)));
}

export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Compact prullenbak-icoon voor icoonknoppen (currentColor). */
export function createTrashIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "1.15em");
  svg.setAttribute("height", "1.15em");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute(
    "d",
    "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
  );
  svg.append(path);
  return svg;
}
