import { TAGLINE_EMPTY } from "./constants.js";
import {
  homeEl,
  homeMeta,
  homeName,
  manageEl,
  manageHeader,
  programNameInput,
  savedEmpty,
  savedList,
  taglineEl,
} from "./dom.js";
import { fillForm } from "./form.js";
import { hooks } from "./hooks.js";
import {
  loadFavoriteId,
  loadPrograms,
  programSummary,
  resolveFavorite,
  saveFavoriteId,
  savePrograms,
  setFavorite,
} from "./storage.js";
import { escapeHtml } from "./util.js";

/** Beheer blijft open tot de gebruiker klaar is of opnieuw start vanuit home. */
let managing = false;

export function isManaging() {
  return managing;
}

export function setManaging(value) {
  managing = Boolean(value);
}

export function renderSaved() {
  const programs = loadPrograms();
  const favorite = resolveFavorite(programs);
  const favoriteId = favorite?.id ?? null;
  savedList.innerHTML = "";
  savedEmpty.hidden = programs.length > 0;

  programs.forEach((program) => {
    const li = document.createElement("li");
    li.className = "saved-item";
    if (program.id === favoriteId) li.classList.add("is-favorite");

    const info = document.createElement("div");
    info.className = "saved-info";
    const parts = program.items
      .map((item) => `${escapeHtml(item.name)} (${item.type === "reps" ? "sets & keer" : "timer"})`)
      .join(" · ");
    const favoriteBadge =
      program.id === favoriteId ? `<span class="saved-favorite-badge">Favoriet</span>` : "";
    info.innerHTML = `<strong>${escapeHtml(program.name)}</strong>${favoriteBadge}<span>${program.items.length === 1 ? "1 onderdeel" : `${program.items.length} onderdelen`} · ${parts}</span>`;

    const actions = document.createElement("div");
    actions.className = "saved-actions";

    const start = document.createElement("button");
    start.type = "button";
    start.className = "btn btn-primary";
    start.textContent = "Start";
    start.addEventListener("click", () => {
      hooks.fillForm(program);
      hooks.startSession(program);
    });

    const load = document.createElement("button");
    load.type = "button";
    load.className = "btn btn-ghost";
    load.textContent = "Laden";
    load.addEventListener("click", () => {
      hooks.fillForm(program);
      programNameInput.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-danger";
    remove.textContent = "Verwijder";
    remove.addEventListener("click", () => {
      const next = loadPrograms().filter((p) => p.id !== program.id);
      savePrograms(next);
      if (loadFavoriteId() === program.id) {
        saveFavoriteId(next[0]?.id ?? null);
      }
      hooks.renderApp();
    });

    actions.append(start, load);

    if (program.id !== favoriteId) {
      const favoriteBtn = document.createElement("button");
      favoriteBtn.type = "button";
      favoriteBtn.className = "btn btn-ghost";
      favoriteBtn.textContent = "Maak favoriet";
      favoriteBtn.addEventListener("click", () => {
        setFavorite(program.id);
      });
      actions.append(favoriteBtn);
    }

    actions.append(remove);
    li.append(info, actions);
    savedList.append(li);
  });
}

export function renderHome() {
  const programs = loadPrograms();
  const favorite = resolveFavorite(programs);

  if (!favorite) {
    homeEl.hidden = true;
    homeName.textContent = "";
    homeMeta.textContent = "";
    if (taglineEl) {
      taglineEl.hidden = false;
      taglineEl.textContent = TAGLINE_EMPTY;
    }
    return null;
  }

  homeEl.hidden = false;
  homeName.textContent = favorite.name;
  homeMeta.textContent = programSummary(favorite);
  if (taglineEl) taglineEl.hidden = true;
  return favorite;
}

/**
 * Toont home als er een favoriet is en beheer niet open staat;
 * beheer is altijd zichtbaar als er nog niets is.
 */
export function updateShell() {
  const programs = loadPrograms();
  const hasPrograms = programs.length > 0;
  const showManage = !hasPrograms || managing;

  if (!hasPrograms) managing = false;

  document.body.classList.toggle("has-programs", hasPrograms);
  document.body.classList.toggle("is-managing", showManage && hasPrograms);

  manageEl.hidden = !showManage;
  manageHeader.hidden = !hasPrograms;
  homeEl.hidden = !hasPrograms || showManage;
}

export function openManage() {
  managing = true;
  const favorite = resolveFavorite(loadPrograms());
  if (favorite) fillForm(favorite);
  hooks.renderApp();
  programNameInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function closeManage() {
  managing = false;
  hooks.renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function renderApp() {
  renderHome();
  renderSaved();
  updateShell();
}
