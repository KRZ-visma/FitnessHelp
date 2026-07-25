import { loadExercises } from "./exercises.js";
import { loadPrograms } from "./storage.js";
import { resolveExercise } from "./migration.js";

const HISTORY_KEY = "fitnesshelp-history-v1";
const HISTORY_DAYS = 90;

/**
 * @typedef {{
 *   date: string,
 *   programIds: string[]
 * }} DayRecord
 */

/**
 * @param {string} dateStr YYYY-MM-DD
 * @returns {Date}
 */
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @returns {string} YYYY-MM-DD
 */
export function todayDate() {
  return formatDate(new Date());
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} days
 * @returns {string} YYYY-MM-DD
 */
function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * @returns {DayRecord[]}
 */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const date = typeof entry.date === "string" ? entry.date : "";
        const programIds = Array.isArray(entry.programIds)
          ? entry.programIds.filter((id) => typeof id === "string")
          : [];
        if (!date) return null;
        return { date, programIds };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {DayRecord[]} history
 */
export function saveHistory(history) {
  try {
    const cutoff = addDays(todayDate(), -HISTORY_DAYS);
    const filtered = history.filter((entry) => entry.date >= cutoff);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

/**
 * @param {string} programId
 */
export function recordProgramInHistory(programId) {
  const today = todayDate();
  const history = loadHistory();
  let dayRecord = history.find((entry) => entry.date === today);
  if (!dayRecord) {
    dayRecord = { date: today, programIds: [] };
    history.push(dayRecord);
  }
  if (!dayRecord.programIds.includes(programId)) {
    dayRecord.programIds.push(programId);
  }
  saveHistory(history);
}

/**
 * @param {number} days
 * @returns {DayRecord[]}
 */
export function getRecentHistory(days) {
  const cutoff = addDays(todayDate(), -days + 1);
  const history = loadHistory();
  return history.filter((entry) => entry.date >= cutoff);
}

/**
 * @param {number} days
 * @returns {number}
 */
export function getWorkoutCount(days) {
  return getRecentHistory(days).length;
}

/**
 * @param {string} programId
 * @param {number} [days]
 * @returns {number}
 */
export function getProgramCompletionCount(programId, days) {
  const history = days ? getRecentHistory(days) : loadHistory();
  return history.filter((entry) => entry.programIds.includes(programId)).length;
}

/**
 * @param {string} programId
 * @returns {string | null} YYYY-MM-DD or null
 */
export function getProgramLastDone(programId) {
  const history = loadHistory();
  const matching = history.filter((entry) => entry.programIds.includes(programId));
  if (!matching.length) return null;
  matching.sort((a, b) => b.date.localeCompare(a.date));
  return matching[0].date;
}

/**
 * @param {number} days
 * @returns {string[]} Array of dates YYYY-MM-DD
 */
export function getDateRange(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dates.push(addDays(todayDate(), -i));
  }
  return dates;
}

/**
 * @param {number} days
 * @returns {Map<string, boolean>} date -> hasWorkout
 */
export function getActivityMap(days) {
  const history = getRecentHistory(days);
  const map = new Map();
  const dates = getDateRange(days);
  dates.forEach((date) => {
    map.set(date, history.some((entry) => entry.date === date));
  });
  return map;
}

/**
 * @param {string} programId
 * @param {number} days
 * @returns {Map<string, boolean>} date -> wasDone
 */
export function getProgramActivityMap(programId, days) {
  const history = getRecentHistory(days);
  const map = new Map();
  const dates = getDateRange(days);
  dates.forEach((date) => {
    map.set(
      date,
      history.some((entry) => entry.date === date && entry.programIds.includes(programId))
    );
  });
  return map;
}

/**
 * @returns {{ name: string, sets: number, programId: string }[]}
 */
export function getExerciseStats() {
  const programs = loadPrograms();
  const exercises = loadExercises();
  const exerciseMap = new Map(exercises.map((ex) => [ex.id, ex]));

  /** @type {Map<string, { name: string, sets: number, programIds: Set<string> }>} */
  const stats = new Map();

  programs.forEach((program) => {
    const resolvedItems = program.items
      .map((item) => resolveExercise(item, program.rest))
      .filter(Boolean);

    resolvedItems.forEach((item) => {
      const key = item.name.toLowerCase();
      const existing = stats.get(key);
      if (existing) {
        existing.sets += item.sets;
        existing.programIds.add(program.id);
      } else {
        stats.set(key, {
          name: item.name,
          sets: item.sets,
          programIds: new Set([program.id]),
        });
      }
    });
  });

  const history = loadHistory();
  const result = [];

  stats.forEach(({ name, sets, programIds }) => {
    const usageCount = history.filter((entry) =>
      entry.programIds.some((id) => programIds.has(id))
    ).length;
    result.push({ name, sets: sets * usageCount, programId: "" });
  });

  result.sort((a, b) => b.sets - a.sets);
  return result.slice(0, 10);
}

/**
 * @param {number} days
 * @returns {{ programId: string, name: string, count: number }[]}
 */
export function getTopPrograms(days) {
  const programs = loadPrograms();
  const programMap = new Map(programs.map((p) => [p.id, p]));
  const history = getRecentHistory(days);

  /** @type {Map<string, number>} */
  const counts = new Map();

  history.forEach((entry) => {
    entry.programIds.forEach((id) => {
      counts.set(id, (counts.get(id) || 0) + 1);
    });
  });

  const result = [];
  counts.forEach((count, programId) => {
    const program = programMap.get(programId);
    if (program) {
      result.push({ programId, name: program.name, count });
    }
  });

  result.sort((a, b) => b.count - a.count);
  return result;
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string}
 */
export function formatRelativeDate(dateStr) {
  const today = todayDate();
  if (dateStr === today) return "vandaag";
  const yesterday = addDays(today, -1);
  if (dateStr === yesterday) return "gisteren";

  const date = parseDate(dateStr);
  const todayDate = parseDate(today);
  const diffTime = todayDate.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 7) return `${diffDays} dagen geleden`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week geleden" : `${weeks} weken geleden`;
  }
  const months = Math.floor(diffDays / 30);
  return months === 1 ? "1 maand geleden" : `${months} maanden geleden`;
}
