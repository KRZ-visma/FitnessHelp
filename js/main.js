import {
  addSegmentBtn,
  addExerciseBtn,
  doneSetBtn,
  exportBtn,
  form,
  homeStartBtn,
  importBtn,
  importFile,
  manageBtn,
  manageDoneBtn,
  manageTabExercises,
  manageTabPrograms,
  pauseBtn,
  programNameInput,
  programRestInput,
  programSwitchInput,
  skipBtn,
  stopBtn,
} from "./dom.js";
import { APP_VERSION } from "./constants.js";
import {
  addExerciseToForm,
  bindDigits,
  fillForm,
  guardSafariAutofill,
  readForm,
  resetDraft,
  showExercisePicker,
} from "./form.js";
import { hooks } from "./hooks.js";
import {
  closeManage,
  nextOpenProgram,
  openManage,
  renderApp,
  setManageTab,
  setManaging,
} from "./shell.js";
import { loadPrograms, savePrograms, syncDayOrder } from "./storage.js";
import {
  completeRepsSet,
  onVisibilityResume,
  skipCurrent,
  startSession,
  stopTraining,
  togglePause,
} from "./timer.js";
import { exportPrograms, importProgramsFromFile } from "./transfer.js";
import { renderExercises, showExerciseModal } from "./exercises-ui.js";
import { migrateToExerciseLibrary } from "./migration.js";

migrateToExerciseLibrary();

hooks.renderApp = renderApp;
hooks.fillForm = fillForm;
hooks.startSession = startSession;
hooks.renderExercises = renderExercises;
hooks.addExerciseToForm = addExerciseToForm;

addSegmentBtn.addEventListener("click", () => {
  showExercisePicker(() => {
    setManageTab("exercises");
    window.alert("Maak eerst een oefening aan onder Oefeningen.");
  });
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
    programs.push(program);
  }
  savePrograms(programs);
  syncDayOrder(programs);
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

manageTabPrograms?.addEventListener("click", () => {
  setManageTab("programs");
});

manageTabExercises?.addEventListener("click", () => {
  setManageTab("exercises");
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

addExerciseBtn.addEventListener("click", () => {
  showExerciseModal();
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
