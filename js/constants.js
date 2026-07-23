export const STORAGE_KEY = "fitnesshelp-workouts-v1";
export const FAVORITE_KEY = "fitnesshelp-favorite-v1";
/** Voortgang van vandaag: afgevinkte programma-ids (reset per kalenderdag). */
export const DAY_PROGRESS_KEY = "fitnesshelp-day-progress-v1";
/** Herbruikbare oefeningen bibliotheek. */
export const EXERCISES_KEY = "fitnesshelp-exercises-v1";

export const PREP_SECONDS = 5;

export const EXPORT_APP = "fitnesshelp";
export const EXPORT_VERSION = 1;
/** Zichtbare app-versie (footer). Bump bij release / PWA-cache-wijziging. */
export const APP_VERSION = "1.5.0";
export const TAGLINE_EMPTY = "Dagprogramma bouwen. Timer of sets & keer. Lokaal bewaard.";

/**
 * @typedef {{ type: 'timer', name: string, sets: number, duration: number, rest: number }} TimerItem
 * @typedef {{ type: 'reps', name: string, sets: number, reps: number }} RepsItem
 * @typedef {TimerItem | RepsItem} ProgramItem
 * @typedef {{ id: string, name: string, rest: number, switch: number, items: ProgramItem[] }} Program
 */
