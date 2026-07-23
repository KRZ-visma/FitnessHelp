import { EXPORT_APP, EXPORT_VERSION } from "./constants.js";
import { transferStatus } from "./dom.js";
import { hooks } from "./hooks.js";
import {
  defaultRestFromItems,
  legacyWorkoutToItem,
  loadPrograms,
  normalizeProgram,
  resolveFavorite,
  savePrograms,
} from "./storage.js";
import { uid } from "./util.js";

/** @param {string} message @param {'ok'|'error'} [tone] */
export function setTransferStatus(message, tone = "ok") {
  transferStatus.hidden = !message;
  transferStatus.textContent = message;
  if (tone === "error") {
    transferStatus.dataset.tone = "error";
  } else {
    delete transferStatus.dataset.tone;
  }
}

/** @param {unknown} data @returns {unknown[] | null} */
export function extractImportEntries(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = /** @type {Record<string, unknown>} */ (data);
    if (Array.isArray(obj.programs)) return obj.programs;
  }
  return null;
}

/** @param {unknown[]} entries @returns {import('./constants.js').Program[]} */
export function programsFromEntries(entries) {
  const hasLegacy = entries.some(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !Array.isArray(/** @type {Record<string, unknown>} */ (entry).items)
  );

  if (!hasLegacy) {
    return entries.map(normalizeProgram).filter(Boolean);
  }

  /** @type {import('./constants.js').ProgramItem[]} */
  const migratedItems = [];
  /** @type {import('./constants.js').Program[]} */
  const modernPrograms = [];
  let migratedId = "";

  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const obj = /** @type {Record<string, unknown>} */ (entry);
    if (Array.isArray(obj.items)) {
      const program = normalizeProgram(entry);
      if (program) modernPrograms.push(program);
      return;
    }
    const item = legacyWorkoutToItem(entry);
    if (!item) return;
    migratedItems.push(item);
    if (!migratedId && typeof obj.id === "string") migratedId = obj.id;
  });

  /** @type {import('./constants.js').Program[]} */
  const programs = [...modernPrograms];
  if (migratedItems.length) {
    programs.unshift({
      id: migratedId || uid(),
      name: "Mijn training",
      rest: defaultRestFromItems(migratedItems),
      switch: 15,
      items: migratedItems,
    });
  }
  return programs;
}

/**
 * @param {import('./constants.js').Program[]} existing
 * @param {import('./constants.js').Program[]} incoming
 * @returns {import('./constants.js').Program[]}
 */
export function mergePrograms(existing, incoming) {
  const next = existing.map((program) => ({ ...program, items: [...program.items] }));

  incoming.forEach((program) => {
    const byId = next.findIndex((p) => p.id === program.id);
    if (byId >= 0) {
      next[byId] = { ...program, items: [...program.items] };
      return;
    }

    const byName = next.findIndex(
      (p) => p.name.toLowerCase() === program.name.toLowerCase()
    );
    if (byName >= 0) {
      next[byName] = {
        ...program,
        id: next[byName].id,
        items: [...program.items],
      };
      return;
    }

    next.unshift({ ...program, items: [...program.items] });
  });

  return next;
}

export function exportPrograms() {
  const programs = loadPrograms();
  if (!programs.length) {
    setTransferStatus("Niets om te exporteren.", "error");
    return;
  }

  const payload = {
    version: EXPORT_VERSION,
    app: EXPORT_APP,
    exportedAt: new Date().toISOString(),
    programs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fitnesshelp-programmas-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  const count = programs.length;
  setTransferStatus(
    count === 1 ? "1 programma geëxporteerd." : `${count} programma’s geëxporteerd.`
  );
}

/** @param {File} file */
export function importProgramsFromFile(file) {
  const reader = new FileReader();
  reader.onerror = () => {
    setTransferStatus("Bestand kon niet worden gelezen.", "error");
  };
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const data = JSON.parse(text);
      const entries = extractImportEntries(data);
      if (!entries) {
        setTransferStatus("Ongeldig bestand: verwacht een JSON-lijst of exportbestand.", "error");
        return;
      }

      const incoming = programsFromEntries(entries);
      if (!incoming.length) {
        setTransferStatus("Geen geldige programma’s gevonden in het bestand.", "error");
        return;
      }

      const merged = mergePrograms(loadPrograms(), incoming);
      savePrograms(merged);
      resolveFavorite(merged);
      hooks.renderApp();

      const count = incoming.length;
      setTransferStatus(
        count === 1
          ? "1 programma geïmporteerd."
          : `${count} programma’s geïmporteerd.`
      );
    } catch {
      setTransferStatus("Ongeldig JSON-bestand.", "error");
    }
  };
  reader.readAsText(file);
}
