import { EXPORT_APP, EXPORT_VERSION } from "./constants.js";
import { transferStatus } from "./dom.js";
import { loadExercises, normalizeExercise, saveExercises } from "./exercises.js";
import { hooks } from "./hooks.js";
import { convertInlineItemsToRefs } from "./migration.js";
import { setManaging } from "./shell.js";
import {
  defaultRestFromItems,
  legacyWorkoutToItem,
  loadPrograms,
  normalizeProgram,
  saveDayOrder,
  savePrograms,
  syncDayOrder,
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

/** @param {unknown} data @returns {import('./exercises.js').Exercise[]} */
export function extractImportExercises(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const obj = /** @type {Record<string, unknown>} */ (data);
  if (!Array.isArray(obj.exercises)) return [];
  return obj.exercises.map(normalizeExercise).filter(Boolean);
}

/** @param {unknown} data @returns {string[] | null} */
export function extractImportDayOrder(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const obj = /** @type {Record<string, unknown>} */ (data);
  if (!Array.isArray(obj.programIds)) return null;
  return obj.programIds.filter((id) => typeof id === "string");
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
      times: 1,
      setOrder: "consecutive",
      active: true,
      items: /** @type {import('./constants.js').Program['items']} */ (migratedItems),
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

    next.push({ ...program, items: [...program.items] });
  });

  return next;
}

/**
 * @param {import('./exercises.js').Exercise[]} existing
 * @param {import('./exercises.js').Exercise[]} incoming
 * @returns {import('./exercises.js').Exercise[]}
 */
export function mergeExercises(existing, incoming) {
  const next = [...existing];
  incoming.forEach((exercise) => {
    const byId = next.findIndex((ex) => ex.id === exercise.id);
    if (byId >= 0) {
      next[byId] = exercise;
      return;
    }
    const byName = next.findIndex(
      (ex) => ex.name.toLowerCase() === exercise.name.toLowerCase()
    );
    if (byName >= 0) {
      next[byName] = { ...exercise, id: next[byName].id };
      return;
    }
    next.push(exercise);
  });
  return next;
}

export function exportPrograms() {
  const programs = loadPrograms();
  const exercises = loadExercises();
  if (!programs.length && !exercises.length) {
    setTransferStatus("Niets om te exporteren.", "error");
    return;
  }

  const programIds = syncDayOrder(programs);
  const payload = {
    version: EXPORT_VERSION,
    app: EXPORT_APP,
    exportedAt: new Date().toISOString(),
    programIds,
    exercises,
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

      const incomingExercises = extractImportExercises(data);
      if (incomingExercises.length) {
        saveExercises(mergeExercises(loadExercises(), incomingExercises));
      }

      let incoming = programsFromEntries(entries);
      if (!incoming.length && !incomingExercises.length) {
        setTransferStatus("Geen geldige programma’s gevonden in het bestand.", "error");
        return;
      }

      if (incoming.length) {
        incoming = convertInlineItemsToRefs(incoming);
        const merged = mergePrograms(loadPrograms(), incoming);
        savePrograms(merged);

        const importedOrder = extractImportDayOrder(data);
        if (importedOrder) {
          const idSet = new Set(merged.map((p) => p.id));
          const order = importedOrder.filter((id) => idSet.has(id));
          merged.forEach((p) => {
            if (!order.includes(p.id)) order.push(p.id);
          });
          saveDayOrder(order);
        }
      }

      // Blijf in beheer (ook na import vanuit de lege startstaat).
      setManaging(true);
      hooks.renderApp();

      const count = incoming.length;
      setTransferStatus(
        count === 0
          ? "Oefeningen geïmporteerd."
          : count === 1
            ? "1 programma geïmporteerd."
            : `${count} programma’s geïmporteerd.`
      );
    } catch {
      setTransferStatus("Ongeldig JSON-bestand.", "error");
    }
  };
  reader.readAsText(file);
}
