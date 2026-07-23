import { DAY_PROGRESS_KEY, FAVORITE_KEY, STORAGE_KEY } from "./constants.js";
import { hooks } from "./hooks.js";
import { clampInt, uid } from "./util.js";
import { resolveExercise } from "./migration.js";

/** @returns {string} */
export function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @returns {{ date: string, done: string[] }}
 */
export function loadDayProgress() {
  try {
    const raw = localStorage.getItem(DAY_PROGRESS_KEY);
    if (!raw) return { date: todayKey(), done: [] };
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { date: todayKey(), done: [] };
    const date = typeof data.date === "string" ? data.date : todayKey();
    const done = Array.isArray(data.done)
      ? data.done.filter((id) => typeof id === "string")
      : [];
    if (date !== todayKey()) {
      const fresh = { date: todayKey(), done: [] };
      saveDayProgress(fresh);
      return fresh;
    }
    return { date, done };
  } catch {
    return { date: todayKey(), done: [] };
  }
}

/** @param {{ date: string, done: string[] }} progress */
export function saveDayProgress(progress) {
  try {
    localStorage.setItem(DAY_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

/** @param {string} programId @returns {boolean} */
export function isProgramDoneToday(programId) {
  return loadDayProgress().done.includes(programId);
}

/** @param {string} programId @param {boolean} done */
export function setProgramDoneToday(programId, done) {
  const progress = loadDayProgress();
  const set = new Set(progress.done);
  if (done) set.add(programId);
  else set.delete(programId);
  saveDayProgress({ date: todayKey(), done: [...set] });
  hooks.renderApp();
}

/** @param {string} programId */
export function markProgramDoneToday(programId) {
  if (!programId) return;
  const progress = loadDayProgress();
  if (progress.done.includes(programId)) return;
  saveDayProgress({ date: todayKey(), done: [...progress.done, programId] });
}

/**
 * @param {unknown} raw
 * @returns {import('./constants.js').TimerItem | null}
 */
export function legacyWorkoutToItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;
  const sets = Number(obj.sets);
  const duration = Number(obj.duration);
  const rest = Number(obj.rest);
  if (!Number.isFinite(sets) || sets < 1) return null;
  if (!Number.isFinite(duration) || duration < 1) return null;
  if (!Number.isFinite(rest) || rest < 0) return null;
  return {
    type: "timer",
    name,
    sets: clampInt(sets, 1, 99),
    duration: clampInt(duration, 1, 3600),
    rest: clampInt(rest, 0, 600),
  };
}

/**
 * @param {unknown} raw
 * @returns {import('./constants.js').ProgramItem | null}
 */
export function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const itemName = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!itemName) return null;
  const sets = Number(obj.sets);
  if (!Number.isFinite(sets) || sets < 1) return null;

  if (obj.type === "reps") {
    const reps = Number(obj.reps);
    if (!Number.isFinite(reps) || reps < 1) return null;
    return {
      type: "reps",
      name: itemName,
      sets: clampInt(sets, 1, 99),
      reps: clampInt(reps, 1, 999),
    };
  }

  const duration = Number(obj.duration);
  const rest = Number(obj.rest);
  if (!Number.isFinite(duration) || duration < 1) return null;
  if (!Number.isFinite(rest) || rest < 0) return null;
  return {
    type: "timer",
    name: itemName,
    sets: clampInt(sets, 1, 99),
    duration: clampInt(duration, 1, 3600),
    rest: clampInt(rest, 0, 600),
  };
}

/** @param {import('./constants.js').ProgramItem[]} items @returns {number} */
export function defaultRestFromItems(items) {
  const timer = items.find((item) => item.type === "timer");
  return timer ? timer.rest : 15;
}

/**
 * @param {unknown} raw
 * @returns {import('./constants.js').Program | null}
 */
export function normalizeProgram(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const id = typeof obj.id === "string" ? obj.id : uid();
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name || !Array.isArray(obj.items)) return null;

  const items = obj.items.map(normalizeItem).filter(Boolean);
  if (!items.length) return null;

  let rest = Number(obj.rest);
  if (!Number.isFinite(rest) || rest < 0) {
    rest = defaultRestFromItems(/** @type {import('./constants.js').ProgramItem[]} */ (items));
  }

  let switchSec = Number(obj.switch);
  if (!Number.isFinite(switchSec) || switchSec < 0) {
    switchSec = 15;
  }

  return {
    id,
    name,
    rest: clampInt(rest, 0, 600),
    switch: clampInt(switchSec, 0, 600),
    items: /** @type {import('./constants.js').ProgramItem[]} */ (items),
  };
}

/** @returns {import('./constants.js').Program[]} */
export function loadPrograms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    const hasLegacy = data.some(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        !Array.isArray(/** @type {Record<string, unknown>} */ (entry).items)
    );
    if (!hasLegacy) {
      return data.map(normalizeProgram).filter(Boolean);
    }

    /** @type {import('./constants.js').ProgramItem[]} */
    const migratedItems = [];
    /** @type {import('./constants.js').Program[]} */
    const modernPrograms = [];
    let migratedId = "";

    data.forEach((entry) => {
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

    savePrograms(programs);
    return programs;
  } catch {
    return [];
  }
}

/** @param {import('./constants.js').Program[]} programs */
export function savePrograms(programs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
}

/** @returns {string | null} */
export function loadFavoriteId() {
  try {
    const id = localStorage.getItem(FAVORITE_KEY);
    return id && typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** @param {string | null} id */
export function saveFavoriteId(id) {
  try {
    if (!id) {
      localStorage.removeItem(FAVORITE_KEY);
      return;
    }
    localStorage.setItem(FAVORITE_KEY, id);
  } catch {
    // ignore
  }
}

/**
 * @param {import('./constants.js').Program[]} programs
 * @returns {import('./constants.js').Program | null}
 */
export function resolveFavorite(programs) {
  if (!programs.length) {
    saveFavoriteId(null);
    return null;
  }
  const favoriteId = loadFavoriteId();
  const match = favoriteId ? programs.find((p) => p.id === favoriteId) : null;
  if (match) return match;
  saveFavoriteId(programs[0].id);
  return programs[0];
}

/** @param {string} id */
export function setFavorite(id) {
  const programs = loadPrograms();
  if (!programs.some((p) => p.id === id)) return;
  saveFavoriteId(id);
  hooks.renderApp();
}

/**
 * Programma’s voor vandaag: favoriet eerst, daarna de rest.
 * @param {import('./constants.js').Program[]} programs
 * @returns {import('./constants.js').Program[]}
 */
export function dayPrograms(programs) {
  if (!programs.length) return [];
  const favorite = resolveFavorite(programs);
  if (!favorite) return [...programs];
  const rest = programs.filter((p) => p.id !== favorite.id);
  return [favorite, ...rest];
}

/**
 * @param {import('./constants.js').Program} program
 * @returns {string}
 */
export function programSummary(program) {
  const parts = program.items
    .map((item) => {
      const resolved = resolveExercise(item, program.rest);
      if (!resolved) return null;
      return resolved.type === "reps" ? `${resolved.name} (sets & keer)` : `${resolved.name} (timer)`;
    })
    .filter(Boolean);
  const count =
    program.items.length === 1 ? "1 onderdeel" : `${program.items.length} onderdelen`;
  return `${count} · ${parts.join(" · ")}`;
}
