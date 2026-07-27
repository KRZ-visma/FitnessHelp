import { DAY_ORDER_KEY, DAY_PROGRESS_KEY, FAVORITE_KEY, STORAGE_KEY } from "./constants.js";
import { hooks } from "./hooks.js";
import { clampInt, uid } from "./util.js";

/** @returns {string} */
export function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @returns {{ date: string, done: string[], counts: Record<string, number> }}
 */
export function loadDayProgress() {
  try {
    const raw = localStorage.getItem(DAY_PROGRESS_KEY);
    if (!raw) return { date: todayKey(), done: [], counts: {} };
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { date: todayKey(), done: [], counts: {} };
    const date = typeof data.date === "string" ? data.date : todayKey();
    const done = Array.isArray(data.done)
      ? data.done.filter((id) => typeof id === "string")
      : [];
    /** @type {Record<string, number>} */
    const counts = {};
    if (data.counts && typeof data.counts === "object" && !Array.isArray(data.counts)) {
      for (const [id, value] of Object.entries(data.counts)) {
        const n = Number(value);
        if (typeof id === "string" && Number.isFinite(n) && n > 0) {
          counts[id] = Math.floor(n);
        }
      }
    }
    if (date !== todayKey()) {
      const fresh = { date: todayKey(), done: [], counts: {} };
      saveDayProgress(fresh);
      return fresh;
    }
    return { date, done, counts };
  } catch {
    return { date: todayKey(), done: [], counts: {} };
  }
}

/** @param {{ date: string, done: string[], counts?: Record<string, number> }} progress */
export function saveDayProgress(progress) {
  try {
    localStorage.setItem(
      DAY_PROGRESS_KEY,
      JSON.stringify({
        date: progress.date,
        done: progress.done,
        counts: progress.counts ?? {},
      })
    );
  } catch {
    // ignore
  }
}

/** @param {string} programId @returns {boolean} */
export function isProgramDoneToday(programId) {
  return loadDayProgress().done.includes(programId);
}

/**
 * Aantal keer dat dit programma vandaag al is afgerond (aparte starts).
 * @param {string} programId
 * @returns {number}
 */
export function getProgramCompletionsToday(programId) {
  if (!programId) return 0;
  const progress = loadDayProgress();
  if (progress.done.includes(programId)) {
    const counted = progress.counts[programId] ?? 0;
    return Math.max(1, counted);
  }
  return progress.counts[programId] ?? 0;
}

/**
 * Registreert één aparte afronding (na starten én voltooien van een sessie).
 * Afgevinkt vanaf count >= times; extra sessies daarna blijven meetellen.
 * @param {string} programId
 * @param {number} [times=1]
 */
export function recordProgramCompletion(programId, times = 1) {
  if (!programId) return;
  const progress = loadDayProgress();

  const target = Math.max(1, Number(times) || 1);
  const counts = { ...progress.counts };
  const next = (counts[programId] ?? 0) + 1;
  counts[programId] = next;

  const done = new Set(progress.done);
  if (next >= target) done.add(programId);

  saveDayProgress({ date: todayKey(), done: [...done], counts });
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

/**
 * Accepteert bibliotheek-refs en legacy inline items (voor migratie/import).
 * @param {unknown} raw
 * @returns {import('./constants.js').ProgramExerciseRef | import('./constants.js').ProgramItem | null}
 */
export function normalizeProgramItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  if (typeof obj.exerciseId === "string" && obj.exerciseId.trim()) {
    return { exerciseId: obj.exerciseId.trim() };
  }
  return normalizeItem(raw);
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

  const items = obj.items.map(normalizeProgramItem).filter(Boolean);

  let rest = Number(obj.rest);
  if (!Number.isFinite(rest) || rest < 0) {
    const inline = /** @type {import('./constants.js').ProgramItem[]} */ (
      items.filter((item) => "type" in item)
    );
    rest = inline.length ? defaultRestFromItems(inline) : 15;
  }

  let switchSec = Number(obj.switch);
  if (!Number.isFinite(switchSec) || switchSec < 0) {
    switchSec = 15;
  }

  let times = Number(obj.times);
  if (!Number.isFinite(times) || times < 1) {
    times = 1;
  }

  /** @type {import('./constants.js').SetOrder} */
  const setOrder = obj.setOrder === "rounds" ? "rounds" : "consecutive";

  return {
    id,
    name,
    rest: clampInt(rest, 0, 600),
    switch: clampInt(switchSec, 0, 600),
    times: clampInt(times, 1, 99),
    setOrder,
    items: /** @type {import('./constants.js').Program['items']} */ (items),
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
        times: 1,
        setOrder: "consecutive",
        items: /** @type {import('./constants.js').Program['items']} */ (migratedItems),
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
  syncDayOrder(programs);
}

/** @returns {string | null} */
function loadFavoriteId() {
  try {
    const id = localStorage.getItem(FAVORITE_KEY);
    return id && typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

function clearFavorite() {
  try {
    localStorage.removeItem(FAVORITE_KEY);
  } catch {
    // ignore
  }
}

/** @returns {string[] | null} */
function loadDayOrderRaw() {
  try {
    const raw = localStorage.getItem(DAY_ORDER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    return data.filter((id) => typeof id === "string");
  } catch {
    return null;
  }
}

/** @param {string[]} ids */
export function saveDayOrder(ids) {
  try {
    localStorage.setItem(DAY_ORDER_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

/**
 * Houdt dagvolgorde synchroon met opgeslagen programma’s.
 * Migreert eenmalig favoriet → vooraan in de lijst.
 * @param {import('./constants.js').Program[]} programs
 * @returns {string[]}
 */
export function syncDayOrder(programs) {
  const ids = programs.map((p) => p.id);
  const idSet = new Set(ids);
  let order = loadDayOrderRaw();

  if (!order) {
    const favoriteId = loadFavoriteId();
    order = [...ids];
    if (favoriteId && idSet.has(favoriteId)) {
      order = [favoriteId, ...order.filter((id) => id !== favoriteId)];
    }
    clearFavorite();
  } else {
    order = order.filter((id) => idSet.has(id));
    ids.forEach((id) => {
      if (!order.includes(id)) order.push(id);
    });
  }

  saveDayOrder(order);
  return order;
}

/**
 * Programma’s in oefendag-volgorde.
 * @param {import('./constants.js').Program[]} programs
 * @returns {import('./constants.js').Program[]}
 */
export function dayPrograms(programs) {
  if (!programs.length) return [];
  const order = syncDayOrder(programs);
  const byId = new Map(programs.map((p) => [p.id, p]));
  return order.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * @param {string} programId
 * @param {-1|1} delta
 */
export function moveProgramInDay(programId, delta) {
  const programs = loadPrograms();
  const order = syncDayOrder(programs);
  const index = order.indexOf(programId);
  if (index < 0) return;
  const target = index + delta;
  if (target < 0 || target >= order.length) return;
  const next = [...order];
  const [id] = next.splice(index, 1);
  next.splice(target, 0, id);
  saveDayOrder(next);
  hooks.renderApp();
}
