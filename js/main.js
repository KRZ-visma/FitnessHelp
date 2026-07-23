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
  programNameInput,
  programRestInput,
  programSwitchInput,
  skipBtn,
  stopBtn,
} from "./dom.js";
import { APP_VERSION } from "./constants.js";
import { addDraftItem, bindDigits, fillForm, guardSafariAutofill, readForm, resetDraft } from "./form.js";
import { hooks } from "./hooks.js";
import { closeManage, nextOpenProgram, openManage, renderApp, setManaging } from "./shell.js";
import {
  loadFavoriteId,
  loadPrograms,
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

function saveCurrentProgram() {
  const program = readForm();
  if (!program) return null;
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
  // Na opslaan terug naar home: dagprogramma centraal, beheer op de achtergrond
  setManaging(false);
  renderApp();
  return program;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCurrentProgram();
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
  const next = nextOpenProgram();
  if (!next) return;
  fillForm(next);
  startSession(next);
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
bindDigits(programRestInput);
bindDigits(programSwitchInput);
if (programNameInput instanceof HTMLInputElement) {
  guardSafariAutofill(programNameInput, "fh-program");
}
renderApp();

const appVersionEl = document.getElementById("app-version");
if (appVersionEl) {
  appVersionEl.textContent = `v${APP_VERSION}`;
}

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
