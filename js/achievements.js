import { loadHistory, todayDate, getWorkoutCount } from "./statistics.js";
import { loadPrograms } from "./storage.js";

const ACHIEVEMENTS_KEY = "fitnesshelp-achievements-v1";

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   icon: string,
 *   category: 'milestone' | 'streak' | 'dedication' | 'champion',
 *   unlocked: boolean,
 *   unlockedDate?: string
 * }} Achievement
 */

/**
 * Alle mogelijke badges met unlock-condities.
 */
const BADGE_DEFINITIONS = [
  {
    id: "first-workout",
    title: "Eerste stap",
    description: "Eerste training voltooid",
    icon: "🎯",
    category: "milestone",
    check: () => getWorkoutCount(999) >= 1,
  },
  {
    id: "workout-5",
    title: "Vaste gast",
    description: "5 trainingen voltooid",
    icon: "💪",
    category: "milestone",
    check: () => getWorkoutCount(999) >= 5,
  },
  {
    id: "workout-10",
    title: "Doorzetter",
    description: "10 trainingen voltooid",
    icon: "🔥",
    category: "milestone",
    check: () => getWorkoutCount(999) >= 10,
  },
  {
    id: "workout-25",
    title: "Toegewijd",
    description: "25 trainingen voltooid",
    icon: "⭐",
    category: "dedication",
    check: () => getWorkoutCount(999) >= 25,
  },
  {
    id: "workout-50",
    title: "Held",
    description: "50 trainingen voltooid",
    icon: "🏆",
    category: "dedication",
    check: () => getWorkoutCount(999) >= 50,
  },
  {
    id: "workout-100",
    title: "Legende",
    description: "100 trainingen voltooid",
    icon: "👑",
    category: "champion",
    check: () => getWorkoutCount(999) >= 100,
  },
  {
    id: "streak-3",
    title: "Op dreef",
    description: "3 dagen achter elkaar getraind",
    icon: "📅",
    category: "streak",
    check: () => checkStreak(3),
  },
  {
    id: "streak-7",
    title: "Week-warrior",
    description: "7 dagen achter elkaar getraind",
    icon: "🔗",
    category: "streak",
    check: () => checkStreak(7),
  },
  {
    id: "streak-14",
    title: "Twee weken sterk",
    description: "14 dagen achter elkaar getraind",
    icon: "💎",
    category: "streak",
    check: () => checkStreak(14),
  },
  {
    id: "streak-30",
    title: "Maand-meester",
    description: "30 dagen achter elkaar getraind",
    icon: "🌟",
    category: "champion",
    check: () => checkStreak(30),
  },
  {
    id: "week-warrior",
    title: "Week compleet",
    description: "Alle 7 dagen in één week getraind",
    icon: "📆",
    category: "dedication",
    check: () => checkFullWeek(),
  },
  {
    id: "morning-hero",
    title: "Ochtendmens",
    description: "5 trainingen voor 09:00 gestart",
    icon: "🌅",
    category: "dedication",
    check: () => false,
  },
];

/**
 * @param {number} days
 * @returns {boolean}
 */
function checkStreak(days) {
  const history = loadHistory();
  if (!history.length) return false;

  const today = todayDate();
  const historyMap = new Map(history.map((entry) => [entry.date, entry]));

  for (let i = 0; i < days; i += 1) {
    const date = addDays(today, -i);
    if (!historyMap.has(date)) return false;
  }

  return true;
}

/**
 * @returns {boolean}
 */
function checkFullWeek() {
  const history = loadHistory();
  if (history.length < 7) return false;

  const today = todayDate();
  const historyMap = new Map(history.map((entry) => [entry.date, entry]));

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(today, -i);
    if (!historyMap.has(date)) return false;
  }

  return true;
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} days
 * @returns {string} YYYY-MM-DD
 */
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * @returns {Map<string, { unlockedDate: string }>}
 */
function loadUnlockedAchievements() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return new Map();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return new Map();
    }
    const map = new Map();
    for (const [id, value] of Object.entries(data)) {
      if (
        value &&
        typeof value === "object" &&
        typeof value.unlockedDate === "string"
      ) {
        map.set(id, { unlockedDate: value.unlockedDate });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * @param {Map<string, { unlockedDate: string }>} unlocked
 */
function saveUnlockedAchievements(unlocked) {
  try {
    const obj = {};
    unlocked.forEach((value, id) => {
      obj[id] = value;
    });
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

/**
 * Controleert alle badges en unlockt nieuwe.
 * @returns {Achievement[]} Nieuw ontgrendelde badges
 */
export function checkAndUnlockAchievements() {
  const unlocked = loadUnlockedAchievements();
  const newlyUnlocked = [];
  const today = todayDate();

  BADGE_DEFINITIONS.forEach((def) => {
    if (unlocked.has(def.id)) return;
    if (def.check()) {
      unlocked.set(def.id, { unlockedDate: today });
      newlyUnlocked.push({
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        unlocked: true,
        unlockedDate: today,
      });
    }
  });

  if (newlyUnlocked.length) {
    saveUnlockedAchievements(unlocked);
  }

  return newlyUnlocked;
}

/**
 * @returns {Achievement[]}
 */
export function getAllAchievements() {
  const unlocked = loadUnlockedAchievements();

  return BADGE_DEFINITIONS.map((def) => {
    const unlockedData = unlocked.get(def.id);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      category: def.category,
      unlocked: !!unlockedData,
      unlockedDate: unlockedData?.unlockedDate,
    };
  });
}

/**
 * @returns {{ total: number, unlocked: number, percentage: number }}
 */
export function getAchievementStats() {
  const achievements = getAllAchievements();
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const total = achievements.length;
  const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  return { total, unlocked, percentage };
}
