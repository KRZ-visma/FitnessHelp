import { EXERCISES_KEY } from "./constants.js";
import { clampInt, uid } from "./util.js";

/**
 * @typedef {{ id: string, name: string, type: 'timer'|'reps', sets: number, duration?: number, reps?: number }} Exercise
 */

/**
 * @param {unknown} raw
 * @returns {Exercise | null}
 */
export function normalizeExercise(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const id = typeof obj.id === "string" ? obj.id : uid();
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;

  const sets = Number(obj.sets);
  if (!Number.isFinite(sets) || sets < 1) return null;

  if (obj.type === "reps") {
    const reps = Number(obj.reps);
    if (!Number.isFinite(reps) || reps < 1) return null;
    return {
      id,
      type: "reps",
      name,
      sets: clampInt(sets, 1, 99),
      reps: clampInt(reps, 1, 999),
    };
  }

  const duration = Number(obj.duration);
  if (!Number.isFinite(duration) || duration < 1) return null;
  return {
    id,
    type: "timer",
    name,
    sets: clampInt(sets, 1, 99),
    duration: clampInt(duration, 1, 3600),
  };
}

/** @returns {Exercise[]} */
export function loadExercises() {
  try {
    const raw = localStorage.getItem(EXERCISES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(normalizeExercise).filter(Boolean);
  } catch {
    return [];
  }
}

/** @param {Exercise[]} exercises */
export function saveExercises(exercises) {
  try {
    localStorage.setItem(EXERCISES_KEY, JSON.stringify(exercises));
  } catch {
    // ignore
  }
}

/** @param {Exercise} exercise */
export function addExercise(exercise) {
  const exercises = loadExercises();
  exercises.unshift(exercise);
  saveExercises(exercises);
}

/** @param {string} id */
export function removeExercise(id) {
  const exercises = loadExercises().filter((ex) => ex.id !== id);
  saveExercises(exercises);
}

/** @param {Exercise} exercise */
export function updateExercise(exercise) {
  const exercises = loadExercises();
  const index = exercises.findIndex((ex) => ex.id === exercise.id);
  if (index >= 0) {
    exercises[index] = exercise;
    saveExercises(exercises);
  }
}
