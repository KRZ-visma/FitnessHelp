import {
  addSegmentBtn,
  doneSetBtn,
  exportBtn,
  form,
  homeStartBtn,
  importBtn,
  importFile,
  manageBtn,
  manageDoneBtn,
  pauseBtn,
  saveBtn,
  skipBtn,
  stopBtn,
} from "./dom.js";
import { addDraftItem, fillForm, readForm, resetDraft } from "./form.js";
import { hooks } from "./hooks.js";
import { closeManage, openManage, renderApp, setManaging } from "./shell.js";
import {
  loadFavoriteId,
  loadPrograms,
  resolveFavorite,
  saveFavoriteId,
  savePrograms,
} from "./storage.js";
import {
  completeRepsSet,
  onVisibilityResume,
  skipCurrent,
  startSession,
  stopTraining,
  togglePause,
} from "./timer.js";
import { exportPrograms, importProgramsFromFile } from "./transfer.js";

hooks.renderApp = renderApp;
hooks.fillForm = fillForm;
hooks.startSession = startSession;

addSegmentBtn.addEventListener("click", () => {
  addDraftItem("timer");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const program = readForm();
  if (!program) return;
  startSession(program);
});

saveBtn.addEventListener("click", () => {
  const program = readForm();
  if (!program) return;
  const programs = loadPrograms();
  const existingIndex = programs.findIndex(
    (p) => p.name.toLowerCase() === program.name.toLowerCase()
  );
  if (existingIndex >= 0) {
    program.id = programs[existingIndex].id;
    programs[existingIndex] = program;
  } else {
    programs.unshift(program);
  }
  savePrograms(programs);
  if (!loadFavoriteId() || !programs.some((p) => p.id === loadFavoriteId())) {
    saveFavoriteId(program.id);
  }
  // Na opslaan terug naar home: favoriet centraal, beheer op de achtergrond
  setManaging(false);
  renderApp();
});

doneSetBtn.addEventListener("click", () => {
  completeRepsSet();
});

pauseBtn.addEventListener("click", () => {
  togglePause();
});

skipBtn.addEventListener("click", () => {
  skipCurrent();
});

stopBtn.addEventListener("click", () => {
  stopTraining();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  onVisibilityResume();
});

homeStartBtn.addEventListener("click", () => {
  const favorite = resolveFavorite(loadPrograms());
  if (!favorite) return;
  fillForm(favorite);
  startSession(favorite);
});

manageBtn.addEventListener("click", () => {
  openManage();
});

manageDoneBtn.addEventListener("click", () => {
  closeManage();
});

exportBtn.addEventListener("click", () => {
  exportPrograms();
});

importBtn.addEventListener("click", () => {
  importFile.value = "";
  importFile.click();
});

importFile.addEventListener("change", () => {
  const file = importFile.files && importFile.files[0];
  if (!file) return;
  importProgramsFromFile(file);
});

resetDraft();
renderApp();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch(() => {
        // Service worker optioneel (bijv. file://)
      });
  });
}
