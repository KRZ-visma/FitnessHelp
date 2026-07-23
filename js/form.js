import {
  programNameInput,
  programRestInput,
  programSwitchInput,
  segmentsEl,
} from "./dom.js";
import { loadExercises } from "./exercises.js";
import { resolveExercise } from "./migration.js";
import { clampInt, uid } from "./util.js";

/** @type {{ exerciseId: string, name: string, exerciseType: 'timer'|'reps', sets: number, duration?: number, reps?: number }[]} */
let draftItems = [];

/**
 * Safari negeert autocomplete="off" en kiest dan zelf contact-/adresvelden.
 * Custom fh-* tokens voorkomen die heuristiek.
 * @param {HTMLInputElement} input
 * @param {string} token
 */
export function guardSafariAutofill(input, token) {
  input.autocomplete = token;
  input.setAttribute("autocorrect", "off");
  input.spellcheck = false;
}

export function resetDraft() {
  draftItems = [];
  programNameInput.value = "";
  programRestInput.value = "15";
  programSwitchInput.value = "15";
  renderSegments();
}

/**
 * @param {import('./exercises.js').Exercise} exercise
 */
export function addExerciseToForm(exercise) {
  draftItems.push({
    exerciseId: exercise.id,
    name: exercise.name,
    exerciseType: exercise.type,
    sets: exercise.sets,
    duration: exercise.type === "timer" ? exercise.duration : undefined,
    reps: exercise.type === "reps" ? exercise.reps : undefined,
  });
  renderSegments();
}

export function bindDigits(input) {
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "");
    if (input.value !== digits) input.value = digits;
  });
}

export function renderSegments() {
  segmentsEl.innerHTML = "";

  if (!draftItems.length) {
    const empty = document.createElement("p");
    empty.className = "segments-empty";
    empty.id = "segments-empty";
    empty.textContent =
      "Nog geen oefeningen. Voeg er toe uit de bibliotheek.";
    segmentsEl.append(empty);
    return;
  }

  draftItems.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "segment segment-ref";
    article.dataset.index = String(index);
    article.dataset.type = "ref";

    const head = document.createElement("div");
    head.className = "segment-head";

    const label = document.createElement("p");
    label.className = "segment-label";
    label.textContent = `Oefening ${index + 1}`;

    const typeBadge = document.createElement("span");
    typeBadge.className = "segment-type-badge";
    typeBadge.textContent = item.exerciseType === "reps" ? "Sets & keer" : "Timer";

    head.append(label, typeBadge);

    const nameEl = document.createElement("p");
    nameEl.className = "segment-name";
    nameEl.textContent = item.name;

    const meta = document.createElement("p");
    meta.className = "segment-meta";
    if (item.exerciseType === "timer") {
      meta.textContent = `${item.sets} sets · ${item.duration} sec`;
    } else {
      meta.textContent = `${item.sets} sets · ${item.reps} keer`;
    }

    const foot = document.createElement("div");
    foot.className = "segment-foot";

    const order = document.createElement("div");
    order.className = "segment-order";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "btn btn-ghost segment-move-up";
    upBtn.textContent = "Omhoog";
    upBtn.setAttribute("aria-label", `Oefening ${index + 1} omhoog`);
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => moveSegment(index, -1));

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "btn btn-ghost segment-move-down";
    downBtn.textContent = "Omlaag";
    downBtn.setAttribute("aria-label", `Oefening ${index + 1} omlaag`);
    downBtn.disabled = index >= draftItems.length - 1;
    downBtn.addEventListener("click", () => moveSegment(index, 1));

    order.append(upBtn, downBtn);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-danger";
    removeBtn.textContent = "Verwijder";
    removeBtn.addEventListener("click", () => {
      draftItems.splice(index, 1);
      renderSegments();
    });

    foot.append(order, removeBtn);
    article.append(head, nameEl, meta, foot);
    segmentsEl.append(article);
  });
}

/** @param {number} index @param {-1|1} delta */
function moveSegment(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= draftItems.length) return;
  const [item] = draftItems.splice(index, 1);
  draftItems.splice(target, 0, item);
  renderSegments();
}

/**
 * Toont een kiezer om oefeningen uit de bibliotheek toe te voegen.
 * @param {() => void} [onEmptyLibrary]
 */
export function showExercisePicker(onEmptyLibrary) {
  const exercises = loadExercises();
  if (!exercises.length) {
    if (onEmptyLibrary) onEmptyLibrary();
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "picker-title");

  const content = document.createElement("div");
  content.className = "modal-content";

  const title = document.createElement("h2");
  title.id = "picker-title";
  title.className = "modal-title";
  title.textContent = "Oefening toevoegen";

  const list = document.createElement("ul");
  list.className = "picker-list";
  list.setAttribute("aria-label", "Oefeningen");

  exercises.forEach((exercise) => {
    const li = document.createElement("li");
    li.className = "picker-item";

    const info = document.createElement("div");
    info.className = "picker-info";
    const name = document.createElement("p");
    name.className = "picker-name";
    name.textContent = exercise.name;
    const meta = document.createElement("p");
    meta.className = "picker-meta";
    meta.textContent =
      exercise.type === "timer"
        ? `Timer · ${exercise.sets} sets · ${exercise.duration} sec`
        : `Sets & keer · ${exercise.sets} sets · ${exercise.reps} keer`;
    info.append(name, meta);

    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-primary";
    add.textContent = "Toevoegen";
    add.addEventListener("click", () => {
      addExerciseToForm(exercise);
      document.body.removeChild(modal);
    });

    li.append(info, add);
    list.append(li);
  });

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-ghost";
  cancel.textContent = "Annuleren";
  cancel.addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  content.append(title, list, cancel);
  modal.append(content);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) document.body.removeChild(modal);
  });
  document.body.append(modal);
}

/** @returns {import('./constants.js').Program | null} */
export function readForm() {
  const name = programNameInput.value.trim();
  if (!name) {
    programNameInput.focus();
    return null;
  }

  const rest = Number(programRestInput.value);
  const switchSec = Number(programSwitchInput.value);
  if (!Number.isFinite(rest) || rest < 0) {
    programRestInput.focus();
    return null;
  }
  if (!Number.isFinite(switchSec) || switchSec < 0) {
    programSwitchInput.focus();
    return null;
  }
  const programRest = clampInt(rest, 0, 600);
  const programSwitch = clampInt(switchSec, 0, 600);

  const items = draftItems
    .filter((draft) => draft.exerciseId)
    .map((draft) => ({ exerciseId: draft.exerciseId }));

  return { id: uid(), name, rest: programRest, switch: programSwitch, items };
}

/** @param {import('./constants.js').Program} program */
export function fillForm(program) {
  programNameInput.value = program.name;
  programRestInput.value = String(program.rest ?? 15);
  programSwitchInput.value = String(program.switch ?? 15);
  draftItems = program.items
    .map((item) => {
      if (!("exerciseId" in item)) return null;
      const resolved = resolveExercise(item, program.rest);
      if (!resolved) return null;
      return {
        exerciseId: item.exerciseId,
        name: resolved.name,
        exerciseType: resolved.type,
        sets: resolved.sets,
        duration: resolved.type === "timer" ? resolved.duration : undefined,
        reps: resolved.type === "reps" ? resolved.reps : undefined,
      };
    })
    .filter(Boolean);
  renderSegments();
}
