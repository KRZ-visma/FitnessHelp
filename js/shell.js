import { TAGLINE_EMPTY } from "./constants.js";
import {
  dayList,
  homeEl,
  homeMeta,
  homeName,
  manageEl,
  manageHeader,
  managePanelExercises,
  managePanelPrograms,
  manageTabExercises,
  manageTabPrograms,
  programNameInput,
  savedEmpty,
  savedList,
  setupEl,
  taglineEl,
} from "./dom.js";
import { resetDraft } from "./form.js";
import { hooks } from "./hooks.js";
import {
  dayPrograms,
  isProgramDoneToday,
  loadPrograms,
  moveProgramInDay,
  savePrograms,
  setProgramDoneToday,
  syncDayOrder,
} from "./storage.js";
import { resolveExercise } from "./migration.js";
import { createTrashIcon } from "./util.js";

/** Beheer blijft open tot de gebruiker klaar is of opnieuw start vanuit home. */
let managing = false;
/** Programmaformulier open (nieuw of bewerken). */
let editing = false;
/** @type {'programs'|'exercises'} */
let manageTab = "programs";

export function isManaging() {
  return managing;
}

export function setManaging(value) {
  managing = Boolean(value);
}

export function isEditingProgram() {
  return editing;
}

export function setEditingProgram(value) {
  editing = Boolean(value);
}

/** @param {'programs'|'exercises'} tab */
export function setManageTab(tab) {
  manageTab = tab === "exercises" ? "exercises" : "programs";
  updateManageTabs();
}

export function getManageTab() {
  return manageTab;
}

function updateManageTabs() {
  const isPrograms = manageTab === "programs";
  if (manageTabPrograms) {
    manageTabPrograms.setAttribute("aria-selected", isPrograms ? "true" : "false");
    manageTabPrograms.classList.toggle("is-active", isPrograms);
  }
  if (manageTabExercises) {
    manageTabExercises.setAttribute("aria-selected", isPrograms ? "false" : "true");
    manageTabExercises.classList.toggle("is-active", !isPrograms);
  }
  if (managePanelPrograms) managePanelPrograms.hidden = !isPrograms;
  if (managePanelExercises) managePanelExercises.hidden = isPrograms;
}

function updateSetupVisibility() {
  const hasPrograms = loadPrograms().length > 0;
  const showSetup = editing || !hasPrograms;
  if (!hasPrograms) editing = true;
  if (setupEl) setupEl.hidden = !showSetup;
}

/**
 * Opent het programmaformulier voor een nieuw of bestaand programma.
 * @param {import('./constants.js').Program | null} [program]
 */
export function openProgramEditor(program = null) {
  managing = true;
  editing = true;
  manageTab = "programs";
  if (program) {
    hooks.fillForm(program);
  } else {
    resetDraft();
  }
  hooks.renderApp();
  programNameInput.focus();
  setupEl?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderSaved() {
  const programs = loadPrograms();
  const order = syncDayOrder(programs);
  const byId = new Map(programs.map((p) => [p.id, p]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);

  savedList.innerHTML = "";
  savedEmpty.hidden = ordered.length > 0;

  ordered.forEach((program, index) => {
    const li = document.createElement("li");
    li.className = "saved-item";

    const names = program.items
      .map((item) => {
        const resolved = resolveExercise(item, program.rest);
        return resolved ? resolved.name : null;
      })
      .filter(Boolean);

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "saved-open";
    openBtn.setAttribute("aria-label", `${program.name} openen`);

    const nameEl = document.createElement("strong");
    nameEl.className = "saved-name";
    nameEl.textContent = program.name;
    openBtn.append(nameEl);

    if (names.length) {
      const list = document.createElement("ul");
      list.className = "saved-exercises";
      names.forEach((name) => {
        const ex = document.createElement("li");
        ex.textContent = name;
        list.append(ex);
      });
      openBtn.append(list);
    }

    openBtn.addEventListener("click", () => {
      openProgramEditor(program);
    });

    const actions = document.createElement("div");
    actions.className = "saved-actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "btn btn-ghost btn-icon saved-move-up";
    upBtn.textContent = "↑";
    upBtn.setAttribute("aria-label", `${program.name} omhoog`);
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => moveProgramInDay(program.id, -1));

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "btn btn-ghost btn-icon saved-move-down";
    downBtn.textContent = "↓";
    downBtn.setAttribute("aria-label", `${program.name} omlaag`);
    downBtn.disabled = index >= ordered.length - 1;
    downBtn.addEventListener("click", () => moveProgramInDay(program.id, 1));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-danger btn-icon";
    remove.setAttribute("aria-label", `${program.name} verwijderen`);
    remove.append(createTrashIcon());
    remove.addEventListener("click", () => {
      const next = loadPrograms().filter((p) => p.id !== program.id);
      savePrograms(next);
      hooks.renderApp();
    });

    actions.append(upBtn, downBtn, remove);
    li.append(openBtn, actions);
    savedList.append(li);
  });
}

/**
 * Eerste programma van vandaag dat nog niet is afgevinkt.
 * @returns {import('./constants.js').Program | null}
 */
export function nextOpenProgram() {
  const programs = dayPrograms(loadPrograms());
  return programs.find((p) => !isProgramDoneToday(p.id)) ?? null;
}

/**
 * @param {import('./constants.js').Program} program
 * @returns {HTMLUListElement}
 */
function buildExerciseList(program) {
  const list = document.createElement("ul");
  list.className = "day-exercises";
  list.setAttribute("aria-label", `Oefeningen in ${program.name}`);

  program.items.forEach((item) => {
    const resolved = resolveExercise(item, program.rest);
    if (!resolved) return;
    const li = document.createElement("li");
    li.textContent = resolved.name;
    list.append(li);
  });

  return list;
}

export function renderHome() {
  const programs = dayPrograms(loadPrograms());

  if (!programs.length) {
    homeEl.hidden = true;
    homeName.textContent = "Vandaag";
    homeMeta.textContent = "";
    if (dayList) dayList.innerHTML = "";
    if (taglineEl) {
      taglineEl.hidden = false;
      taglineEl.textContent = TAGLINE_EMPTY;
    }
    return null;
  }

  homeEl.hidden = false;
  homeName.textContent = "Vandaag";

  const doneCount = programs.filter((p) => isProgramDoneToday(p.id)).length;
  const total = programs.length;
  homeMeta.textContent =
    doneCount === 0
      ? total === 1
        ? "1 programma"
        : `${total} programma’s`
      : doneCount === total
        ? "Alles afgevinkt"
        : `${doneCount} van ${total} klaar`;

  if (taglineEl) taglineEl.hidden = true;

  if (dayList) {
    dayList.innerHTML = "";
    programs.forEach((program) => {
      const done = isProgramDoneToday(program.id);
      const li = document.createElement("li");
      li.className = "day-item";
      if (done) li.classList.add("is-done");

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "day-check";
      check.checked = done;
      check.id = `day-check-${program.id}`;
      check.setAttribute("aria-label", `${program.name} afvinken`);
      check.addEventListener("change", () => {
        setProgramDoneToday(program.id, check.checked);
      });

      const body = document.createElement("div");
      body.className = "day-body";

      const label = document.createElement("label");
      label.className = "day-name";
      label.htmlFor = check.id;
      const times = Math.max(1, Number(program.times) || 1);
      label.textContent = times > 1 ? `${program.name} · ${times}×` : program.name;

      body.append(label, buildExerciseList(program));

      const start = document.createElement("button");
      start.type = "button";
      start.className = "btn btn-primary day-start";
      start.textContent = "Start";
      start.hidden = done;
      start.addEventListener("click", () => {
        hooks.fillForm(program);
        hooks.startSession(program);
      });

      li.append(check, body);
      if (!done) li.append(start);
      dayList.append(li);
    });
  }

  return nextOpenProgram();
}

/**
 * Toont home als er programma’s zijn en beheer niet open staat;
 * beheer is altijd zichtbaar als er nog niets is.
 */
export function updateShell() {
  const programs = loadPrograms();
  const hasPrograms = programs.length > 0;
  const showManage = !hasPrograms || managing;

  if (!hasPrograms) {
    managing = false;
    editing = true;
  }

  document.body.classList.toggle("has-programs", hasPrograms);
  document.body.classList.toggle("is-managing", showManage && hasPrograms);

  manageEl.hidden = !showManage;
  manageHeader.hidden = !hasPrograms;
  homeEl.hidden = !hasPrograms || showManage;
  updateManageTabs();
  updateSetupVisibility();
}

export function openManage() {
  managing = true;
  editing = false;
  manageTab = "programs";
  resetDraft();
  hooks.renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function closeManage() {
  managing = false;
  editing = false;
  resetDraft();
  hooks.renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function renderApp() {
  renderHome();
  hooks.renderExercises?.();
  renderSaved();
  updateShell();
}
