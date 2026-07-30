import { loadPrograms } from "./storage.js";
import { resolveExercise } from "./migration.js";
import {
  getWorkoutCount,
  getProgramCompletionCount,
  getProgramLastDone,
  getActivityMap,
  getProgramActivityMap,
  getTopPrograms,
  todayDate,
  formatRelativeDate,
} from "./statistics.js";
import { hooks } from "./hooks.js";
import { renderAchievements } from "./achievements-ui.js";
import { checkAndUnlockAchievements } from "./achievements.js";

/**
 * @param {HTMLElement} container
 */
export function renderStatisticsOverview(container) {
  checkAndUnlockAchievements();
  
  const programs = loadPrograms();
  const today30 = getWorkoutCount(30);
  const activityMap7 = getActivityMap(7);
  const topPrograms = getTopPrograms(90);

  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "statistics-header";
  header.innerHTML = `
    <h1 class="statistics-title">Statistieken</h1>
    <button type="button" class="btn btn-ghost" id="statistics-close-btn">Sluiten</button>
  `;
  container.appendChild(header);

  const overview = document.createElement("div");
  overview.className = "statistics-overview";

  const section30 = document.createElement("section");
  section30.className = "statistics-section";
  section30.innerHTML = `
    <h2 class="statistics-section-title">Afgelopen 30 dagen</h2>
    <p class="statistics-big-number">${today30} <span class="statistics-unit">trainingen</span></p>
  `;
  overview.appendChild(section30);

  const section7 = document.createElement("section");
  section7.className = "statistics-section";
  section7.innerHTML = `<h2 class="statistics-section-title">Deze week</h2>`;
  const weekGrid = document.createElement("div");
  weekGrid.className = "statistics-week-grid";
  const dayLabels = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
  const dates = Array.from(activityMap7.keys()).slice(-7);
  dates.forEach((date, i) => {
    const dayEl = document.createElement("div");
    dayEl.className = "statistics-week-day";
    if (activityMap7.get(date)) {
      dayEl.classList.add("is-active");
    }
    dayEl.innerHTML = `
      <span class="statistics-week-day-label">${dayLabels[i]}</span>
      <span class="statistics-week-day-dot" aria-label="${activityMap7.get(date) ? "Getraind" : "Niet getraind"}"></span>
    `;
    weekGrid.appendChild(dayEl);
  });
  section7.appendChild(weekGrid);
  overview.appendChild(section7);

  renderAchievements(overview);

  if (topPrograms.length) {
    const sectionPrograms = document.createElement("section");
    sectionPrograms.className = "statistics-section";
    sectionPrograms.innerHTML = `<h2 class="statistics-section-title">Programma's (90 dagen)</h2>`;
    const programList = document.createElement("ul");
    programList.className = "statistics-program-list";
    topPrograms.forEach((item) => {
      const li = document.createElement("li");
      li.className = "statistics-program-item";
      li.innerHTML = `
        <button type="button" class="statistics-program-link" data-program-id="${item.programId}">
          <span class="statistics-program-name">${item.name}</span>
          <span class="statistics-program-count">${item.count}×</span>
        </button>
      `;
      programList.appendChild(li);
    });
    sectionPrograms.appendChild(programList);
    overview.appendChild(sectionPrograms);
  }

  container.appendChild(overview);

  const closeBtn = container.querySelector("#statistics-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      hooks.closeStatistics();
    });
  }

  const programLinks = container.querySelectorAll(".statistics-program-link");
  programLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const btn = /** @type {HTMLButtonElement} */ (e.currentTarget);
      const programId = btn.dataset.programId;
      if (programId) {
        renderProgramDetail(container, programId);
      }
    });
  });
}

/**
 * @param {HTMLElement} container
 * @param {string} programId
 */
export function renderProgramDetail(container, programId) {
  const programs = loadPrograms();
  const program = programs.find((p) => p.id === programId);
  if (!program) {
    renderStatisticsOverview(container);
    return;
  }

  const count = getProgramCompletionCount(programId);
  const lastDone = getProgramLastDone(programId);
  const activityMap = getProgramActivityMap(programId, 30);
  const resolvedItems = program.items
    .map((item) => resolveExercise(item, program.rest))
    .filter(Boolean);

  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "statistics-header";
  header.innerHTML = `
    <button type="button" class="btn btn-ghost" id="statistics-back-btn">← Terug</button>
  `;
  container.appendChild(header);

  const detail = document.createElement("div");
  detail.className = "statistics-detail";

  const titleSection = document.createElement("section");
  titleSection.className = "statistics-section";
  titleSection.innerHTML = `<h1 class="statistics-program-title">${program.name}</h1>`;
  detail.appendChild(titleSection);

  const statsSection = document.createElement("section");
  statsSection.className = "statistics-section";
  statsSection.innerHTML = `
    <h2 class="statistics-section-title">Statistieken</h2>
    <dl class="statistics-stats-list">
      <div class="statistics-stats-item">
        <dt>Voltooid</dt>
        <dd>${count} keer</dd>
      </div>
      ${
        lastDone
          ? `
      <div class="statistics-stats-item">
        <dt>Laatst gedaan</dt>
        <dd>${formatRelativeDate(lastDone)}</dd>
      </div>
      `
          : ""
      }
      <div class="statistics-stats-item">
        <dt>Onderdelen</dt>
        <dd>${resolvedItems.length} oefeningen</dd>
      </div>
    </dl>
  `;
  detail.appendChild(statsSection);

  const activitySection = document.createElement("section");
  activitySection.className = "statistics-section";
  activitySection.innerHTML = `<h2 class="statistics-section-title">Activiteit (30 dagen)</h2>`;
  const activityGrid = document.createElement("div");
  activityGrid.className = "statistics-activity-grid";
  const dates = Array.from(activityMap.keys());
  dates.forEach((date) => {
    const dayEl = document.createElement("div");
    dayEl.className = "statistics-activity-day";
    if (activityMap.get(date)) {
      dayEl.classList.add("is-active");
    }
    dayEl.setAttribute("aria-label", date);
    activityGrid.appendChild(dayEl);
  });
  activitySection.appendChild(activityGrid);
  detail.appendChild(activitySection);

  if (resolvedItems.length) {
    const exercisesSection = document.createElement("section");
    exercisesSection.className = "statistics-section";
    exercisesSection.innerHTML = `<h2 class="statistics-section-title">Oefeningen</h2>`;
    const exerciseList = document.createElement("ul");
    exerciseList.className = "statistics-exercise-list";
    resolvedItems.forEach((item) => {
      const li = document.createElement("li");
      li.className = "statistics-exercise-item";
      let detail = "";
      if (item.type === "reps") {
        detail = `${item.sets} sets × ${item.reps} keer`;
      } else {
        detail = `${item.sets} sets × ${item.duration}s`;
      }
      li.innerHTML = `
        <span class="statistics-exercise-name">${item.name}</span>
        <span class="statistics-exercise-detail">${detail}</span>
      `;
      exerciseList.appendChild(li);
    });
    exercisesSection.appendChild(exerciseList);
    detail.appendChild(exercisesSection);
  }

  container.appendChild(detail);

  const backBtn = container.querySelector("#statistics-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      renderStatisticsOverview(container);
    });
  }
}
