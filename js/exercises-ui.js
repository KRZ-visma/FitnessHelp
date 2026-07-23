import {
  exercisesEmpty,
  exercisesList,
} from "./dom.js";
import {
  addExercise,
  loadExercises,
  removeExercise,
  updateExercise,
} from "./exercises.js";
import { hooks } from "./hooks.js";
import { loadPrograms, savePrograms } from "./storage.js";
import { clampInt, uid } from "./util.js";

export function renderExercises() {
  const exercises = loadExercises();
  exercisesList.innerHTML = "";
  exercisesEmpty.hidden = exercises.length > 0;

  exercises.forEach((exercise) => {
    const li = document.createElement("li");
    li.className = "exercise-item";

    const info = document.createElement("div");
    info.className = "exercise-info";

    const name = document.createElement("p");
    name.className = "exercise-name";
    name.textContent = exercise.name;

    const meta = document.createElement("p");
    meta.className = "exercise-meta";
    if (exercise.type === "timer") {
      meta.textContent = `Timer · ${exercise.sets} sets · ${exercise.duration} sec`;
    } else {
      meta.textContent = `Sets & keer · ${exercise.sets} sets · ${exercise.reps} keer`;
    }

    info.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "exercise-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn-ghost";
    edit.textContent = "Bewerk";
    edit.addEventListener("click", () => {
      showExerciseModal(exercise);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-danger";
    remove.textContent = "Verwijder";
    remove.addEventListener("click", () => {
      const used = loadPrograms().some((program) =>
        program.items.some(
          (item) => "exerciseId" in item && item.exerciseId === exercise.id
        )
      );
      if (used) {
        const ok = window.confirm(
          `"${exercise.name}" zit in een of meer programma’s. Verwijderen haalt de oefening daar ook weg. Doorgaan?`
        );
        if (!ok) return;
      }
      removeExercise(exercise.id);
      stripExerciseFromPrograms(exercise.id);
      hooks.renderApp();
    });

    actions.append(edit, remove);
    li.append(info, actions);
    exercisesList.append(li);
  });
}

/** @param {string} exerciseId */
function stripExerciseFromPrograms(exerciseId) {
  const programs = loadPrograms().map((program) => ({
    ...program,
    items: program.items.filter(
      (item) => !("exerciseId" in item) || item.exerciseId !== exerciseId
    ),
  }));
  savePrograms(programs);
}

export function showExerciseModal(exercise = null) {
  const isEdit = exercise !== null;
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "modal-title");

  const content = document.createElement("div");
  content.className = "modal-content";

  const title = document.createElement("h2");
  title.id = "modal-title";
  title.className = "modal-title";
  title.textContent = isEdit ? "Oefening bewerken" : "Nieuwe oefening";

  const form = document.createElement("form");
  form.className = "exercise-form";

  const nameField = createField(
    "Naam oefening",
    "text",
    exercise?.name || "",
    "bijv. Push-ups"
  );
  const nameInput = nameField.querySelector("input");

  const typeField = document.createElement("label");
  typeField.className = "field";
  typeField.innerHTML = `<span>Type</span>`;
  const typeSelect = document.createElement("select");
  typeSelect.className = "segment-type";
  typeSelect.innerHTML = `
    <option value="timer"${!exercise || exercise.type === "timer" ? " selected" : ""}>Timer</option>
    <option value="reps"${exercise?.type === "reps" ? " selected" : ""}>Sets & keer</option>
  `;
  typeField.append(typeSelect);

  const setsField = createField(
    "Aantal sets",
    "text",
    String(exercise?.sets || 3),
    "3"
  );
  const setsInput = setsField.querySelector("input");
  setsInput.inputMode = "numeric";
  setsInput.pattern = "[0-9]*";

  const durationField = createField(
    "Duur per set (sec)",
    "text",
    String(exercise?.duration || 45),
    "45"
  );
  const durationInput = durationField.querySelector("input");
  durationInput.inputMode = "numeric";
  durationInput.pattern = "[0-9]*";

  const repsField = createField(
    "Keer per set",
    "text",
    String(exercise?.reps || 10),
    "10"
  );
  const repsInput = repsField.querySelector("input");
  repsInput.inputMode = "numeric";
  repsInput.pattern = "[0-9]*";

  const row = document.createElement("div");
  row.className = "field-row";

  function updateFields() {
    row.innerHTML = "";
    row.append(setsField);
    if (typeSelect.value === "timer") {
      row.append(durationField);
    } else {
      row.append(repsField);
    }
  }

  typeSelect.addEventListener("change", updateFields);
  updateFields();

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const save = document.createElement("button");
  save.type = "submit";
  save.className = "btn btn-primary";
  save.textContent = isEdit ? "Opslaan" : "Toevoegen";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-ghost";
  cancel.textContent = "Annuleren";
  cancel.addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  actions.append(save, cancel);

  form.append(nameField, typeField, row, actions);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const sets = Number(setsInput.value);
    if (!name || !Number.isFinite(sets) || sets < 1) return;

    /** @type {import('./exercises.js').Exercise} */
    const exerciseData = {
      id: exercise?.id || uid(),
      name,
      type: /** @type {'timer'|'reps'} */ (typeSelect.value),
      sets: clampInt(sets, 1, 99),
    };

    if (typeSelect.value === "timer") {
      const duration = Number(durationInput.value);
      if (!Number.isFinite(duration) || duration < 1) return;
      exerciseData.duration = clampInt(duration, 1, 3600);
    } else {
      const reps = Number(repsInput.value);
      if (!Number.isFinite(reps) || reps < 1) return;
      exerciseData.reps = clampInt(reps, 1, 999);
    }

    if (isEdit) {
      updateExercise(exerciseData);
    } else {
      addExercise(exerciseData);
    }

    hooks.renderApp();
    document.body.removeChild(modal);
  });

  content.append(title, form);
  modal.append(content);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  document.body.append(modal);
  nameInput.focus();
}

function createField(label, type, value, placeholder) {
  const field = document.createElement("label");
  field.className = "field";
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.required = true;
  field.append(span, input);
  return field;
}
