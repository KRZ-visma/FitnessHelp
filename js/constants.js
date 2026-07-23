export const STORAGE_KEY = "fitnesshelp-workouts-v1";
export const FAVORITE_KEY = "fitnesshelp-favorite-v1";

export const PREP_SECONDS = 5;

export const EXPORT_APP = "fitnesshelp";
export const EXPORT_VERSION = 1;
export const TAGLINE_EMPTY = "Programma bouwen. Timer of sets & keer. Lokaal bewaard.";

/**
 * @typedef {{ type: 'timer', name: string, sets: number, duration: number, rest: number }} TimerItem
 * @typedef {{ type: 'reps', name: string, sets: number, reps: number }} RepsItem
 * @typedef {TimerItem | RepsItem} ProgramItem
 * @typedef {{ id: string, name: string, items: ProgramItem[] }} Program
 */
