import { loadExercises, saveExercises } from "./exercises.js";
import { loadPrograms, savePrograms } from "./storage.js";
import { uid } from "./util.js";

const MIGRATION_FLAG = "fitnesshelp-migration-v2-done";

/**
 * Migreert bestaande inline oefeningen naar de bibliotheek en
 * vervangt ze door referenties in programma's.
 */
export function migrateToExerciseLibrary() {
  if (localStorage.getItem(MIGRATION_FLAG)) {
    return;
  }

  const programs = loadPrograms();
  const exercises = loadExercises();
  
  /** @type {Map<string, string>} hashcode -> exerciseId */
  const exerciseMap = new Map();
  
  exercises.forEach((ex) => {
    const hash = exerciseHash(ex);
    exerciseMap.set(hash, ex.id);
  });

  const newExercises = [...exercises];
  const updatedPrograms = programs.map((program) => {
    const newItems = program.items.map((item) => {
      if ("exerciseId" in item) {
        return item;
      }

      const hash = exerciseHash(item);
      let exerciseId = exerciseMap.get(hash);

      if (!exerciseId) {
        exerciseId = uid();
        const exercise = {
          id: exerciseId,
          name: item.name,
          type: item.type,
          sets: item.sets,
        };

        if (item.type === "timer") {
          exercise.duration = item.duration;
        } else {
          exercise.reps = item.reps;
        }

        newExercises.push(exercise);
        exerciseMap.set(hash, exerciseId);
      }

      return { exerciseId };
    });

    return { ...program, items: newItems };
  });

  saveExercises(newExercises);
  savePrograms(updatedPrograms);
  localStorage.setItem(MIGRATION_FLAG, "1");
}

/**
 * @param {any} item
 * @returns {string}
 */
function exerciseHash(item) {
  if (item.type === "timer") {
    return `timer:${item.name}:${item.sets}:${item.duration}`;
  }
  return `reps:${item.name}:${item.sets}:${item.reps}`;
}

/**
 * Resolve een programma item naar zijn volledige oefening data.
 * @param {import('./constants.js').ProgramItem | import('./constants.js').ProgramExerciseRef} item
 * @param {number} defaultRest
 * @returns {import('./constants.js').ProgramItem | null}
 */
export function resolveExercise(item, defaultRest = 15) {
  if ("exerciseId" in item) {
    const exercises = loadExercises();
    const exercise = exercises.find((ex) => ex.id === item.exerciseId);
    if (!exercise) return null;

    if (exercise.type === "timer") {
      return {
        type: "timer",
        name: exercise.name,
        sets: exercise.sets,
        duration: exercise.duration,
        rest: defaultRest,
      };
    }

    return {
      type: "reps",
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
    };
  }

  return item;
}
