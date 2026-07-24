import { beep, enableWorkoutAudio } from "./audio.js";
import { PREP_SECONDS } from "./constants.js";
import {
  doneSetBtn,
  homeEl,
  manageEl,
  pauseBtn,
  setupEl,
  skipBtn,
  timerBar,
  timerClock,
  timerEl,
  timerMeta,
  timerName,
  timerPhase,
  timerProgram,
  timerProgress,
} from "./dom.js";
import { hooks } from "./hooks.js";
import { markProgramDoneToday } from "./storage.js";
import { resolveExercise } from "./migration.js";
import { formatTime } from "./util.js";

/**
 * @type {{
 *   program: import('./constants.js').Program,
 *   itemIndex: number,
 *   setIndex: number,
 *   isRest: boolean,
 *   isPrep: boolean,
 *   isSwitch: boolean,
 *   remaining: number,
 *   total: number,
 *   paused: boolean,
 *   raf: number|null,
 *   lastTs: number|null
 * } | null}
 */
let session = null;

/** @type {WakeLockSentinel | null} */
let wakeLock = null;

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || !navigator.wakeLock) return;
  try {
    if (wakeLock) return;
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    // ignore
  }
  wakeLock = null;
}

function currentItem() {
  return session?.program.items[session.itemIndex] ?? null;
}

/** @param {import('./constants.js').Program} program */
export function startSession(program) {
  enableWorkoutAudio();
  stopTick();
  
  const resolvedItems = program.items
    .map((item) => resolveExercise(item, program.rest))
    .filter(Boolean);

  if (!resolvedItems.length) return;

  session = {
    program: {
      id: program.id,
      name: program.name,
      rest: program.rest,
      switch: program.switch,
      items: resolvedItems,
    },
    itemIndex: 0,
    setIndex: 1,
    isRest: false,
    isPrep: true,
    isSwitch: false,
    remaining: 0,
    total: 1,
    paused: false,
    raf: null,
    lastTs: null,
  };

  document.body.classList.add("is-running");
  homeEl.hidden = true;
  manageEl.hidden = true;
  setupEl.hidden = true;
  timerEl.hidden = false;
  pauseBtn.textContent = "Pauze";
  skipBtn.hidden = false;
  requestWakeLock();
  beginCurrentItem();
}

function beginCurrentItem() {
  if (!session) return;
  const item = currentItem();
  if (!item) {
    endSession(true);
    return;
  }

  session.setIndex = 1;
  session.isRest = false;
  session.isPrep = true;
  session.isSwitch = false;
  session.paused = false;
  session.remaining = PREP_SECONDS;
  session.total = PREP_SECONDS;
  pauseBtn.textContent = "Pauze";
  doneSetBtn.hidden = true;
  pauseBtn.hidden = false;
  timerProgress.hidden = false;
  updateTimerUI();
  startTick();
}

export function startWorkAfterPrep() {
  if (!session) return;
  const item = currentItem();
  if (!item) {
    endSession(true);
    return;
  }

  session.isPrep = false;
  session.paused = false;
  pauseBtn.textContent = "Pauze";
  beep("start");

  if (item.type === "timer") {
    session.remaining = item.duration;
    session.total = item.duration;
    doneSetBtn.hidden = true;
    pauseBtn.hidden = false;
    timerProgress.hidden = false;
    updateTimerUI();
    startTick();
    return;
  }

  stopTick();
  session.remaining = 0;
  session.total = 1;
  doneSetBtn.hidden = false;
  pauseBtn.hidden = true;
  timerProgress.hidden = true;
  updateTimerUI();
}

export function endSession(finished) {
  stopTick();
  if (finished && session) {
    markProgramDoneToday(session.program.id);
    session.isRest = false;
    session.isPrep = false;
    session.isSwitch = false;
    session.remaining = 0;
    session.total = 1;
    timerEl.dataset.phase = "done";
    timerEl.dataset.mode = "done";
    timerProgram.textContent = session.program.name;
    timerPhase.textContent = "Klaar";
    timerClock.textContent = "0:00";
    timerClock.classList.remove("is-reps");
    timerBar.style.transform = "scaleX(0)";
    timerProgress.hidden = false;
    timerMeta.textContent = `${session.program.items.length} onderdelen afgerond`;
    pauseBtn.hidden = true;
    skipBtn.hidden = true;
    doneSetBtn.hidden = true;
    releaseWakeLock();
    beep("done");
    return;
  }

  session = null;
  releaseWakeLock();
  document.body.classList.remove("is-running");
  timerEl.hidden = true;
  setupEl.hidden = false;
  timerEl.dataset.phase = "";
  timerEl.dataset.mode = "";
  hooks.renderApp();
}

function updateTimerUI() {
  if (!session) return;
  const { setIndex, isRest, isPrep, isSwitch, remaining, total, itemIndex, program } = session;

  if (isSwitch) {
    const next = program.items[itemIndex + 1];
    if (!next) return;
    timerProgram.textContent =
      program.items.length > 1
        ? `${program.name} · ${itemIndex + 2}/${program.items.length}`
        : program.name;
    timerName.textContent = next.name;
    timerEl.dataset.mode = "timer";
    timerEl.dataset.phase = "switch";
    timerClock.classList.remove("is-reps");
    timerPhase.textContent = "Wisselen";
    timerClock.textContent = formatTime(remaining);
    const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    timerBar.style.transform = `scaleX(${ratio})`;
    timerMeta.textContent = "Volgende oefening · daarna starten";
    return;
  }

  const item = currentItem();
  if (!item) return;

  timerProgram.textContent =
    program.items.length > 1
      ? `${program.name} · ${itemIndex + 1}/${program.items.length}`
      : program.name;
  timerName.textContent = item.name;

  if (isPrep) {
    timerEl.dataset.mode = item.type === "reps" ? "reps-prep" : "timer";
    timerEl.dataset.phase = "prep";
    timerClock.classList.remove("is-reps");
    timerPhase.textContent = "Klaar maken";
    timerClock.textContent = formatTime(remaining);
    const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    timerBar.style.transform = `scaleX(${ratio})`;
    timerMeta.textContent =
      item.type === "reps"
        ? `Daarna: set 1 · ${item.reps}×`
        : `Daarna: set 1 · ${item.duration}s`;
    return;
  }

  if (isRest) {
    timerEl.dataset.mode = item.type === "reps" ? "reps" : "timer";
    timerEl.dataset.phase = "rest";
    timerClock.classList.remove("is-reps");
    timerPhase.textContent = `Rust · na set ${setIndex}`;
    timerClock.textContent = formatTime(remaining);
    const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    timerBar.style.transform = `scaleX(${ratio})`;
    timerMeta.textContent = `Volgende: set ${setIndex + 1}`;
    return;
  }

  if (item.type === "reps") {
    timerEl.dataset.mode = "reps";
    timerEl.dataset.phase = "work";
    timerPhase.textContent = `Set ${setIndex} van ${item.sets}`;
    timerClock.textContent = `${item.reps}×`;
    timerClock.classList.add("is-reps");
    timerBar.style.transform = "scaleX(1)";
    timerMeta.textContent =
      program.rest > 0
        ? `${item.sets} sets · ${item.reps} keer · rust ${program.rest}s`
        : `${item.sets} sets · ${item.reps} keer`;
    return;
  }

  timerEl.dataset.mode = "timer";
  timerClock.classList.remove("is-reps");
  timerEl.dataset.phase = "work";
  timerPhase.textContent = `Set ${setIndex} van ${item.sets}`;
  timerClock.textContent = formatTime(remaining);
  const workRatio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  timerBar.style.transform = `scaleX(${workRatio})`;
  timerMeta.textContent =
    program.rest > 0
      ? `Duur ${item.duration}s · rust ${program.rest}s`
      : `Duur ${item.duration}s`;
}

function finishSwitch() {
  if (!session) return;
  session.isSwitch = false;
  session.itemIndex += 1;
  session.setIndex = 1;
  session.isRest = false;
  session.isPrep = false;
  startWorkAfterPrep();
}

function advanceToNextItem() {
  if (!session) return;
  if (session.itemIndex >= session.program.items.length - 1) {
    endSession(true);
    return;
  }
  beep("stop");
  const switchSec = session.program.switch;
  if (switchSec > 0) {
    session.isSwitch = true;
    session.isRest = false;
    session.isPrep = false;
    session.paused = false;
    session.remaining = switchSec;
    session.total = switchSec;
    doneSetBtn.hidden = true;
    pauseBtn.hidden = false;
    pauseBtn.textContent = "Pauze";
    timerProgress.hidden = false;
    updateTimerUI();
    startTick();
    return;
  }
  session.itemIndex += 1;
  beginCurrentItem();
}

function enterRestPhase() {
  if (!session) return;
  const rest = session.program.rest;
  session.isRest = true;
  session.isPrep = false;
  session.isSwitch = false;
  session.remaining = rest;
  session.total = rest;
  doneSetBtn.hidden = true;
  pauseBtn.hidden = false;
  pauseBtn.textContent = "Pauze";
  timerProgress.hidden = false;
  beep("rest");
  updateTimerUI();
  startTick();
}

function leaveRestPhase() {
  if (!session) return;
  const item = currentItem();
  if (!item) return;

  session.isRest = false;
  session.setIndex += 1;
  beep("tick");

  if (item.type === "timer") {
    session.remaining = item.duration;
    session.total = item.duration;
    doneSetBtn.hidden = true;
    pauseBtn.hidden = false;
    timerProgress.hidden = false;
    updateTimerUI();
    return;
  }

  stopTick();
  session.remaining = 0;
  session.total = 1;
  doneSetBtn.hidden = false;
  pauseBtn.hidden = true;
  timerProgress.hidden = true;
  updateTimerUI();
}

export function advancePhase() {
  if (!session) return;
  const item = currentItem();
  if (!item) return;

  if (session.isRest) {
    leaveRestPhase();
    return;
  }

  if (item.type === "reps") {
    if (session.setIndex >= item.sets) {
      advanceToNextItem();
      return;
    }
    if (session.program.rest > 0) {
      enterRestPhase();
      return;
    }
    session.setIndex += 1;
    beep("tick");
    updateTimerUI();
    return;
  }

  if (session.setIndex >= item.sets) {
    advanceToNextItem();
    return;
  }
  if (session.program.rest > 0) {
    enterRestPhase();
    return;
  }
  session.setIndex += 1;
  session.remaining = item.duration;
  session.total = item.duration;
  beep("tick");
  updateTimerUI();
}

export function sessionNeedsTick() {
  if (!session) return false;
  if (session.isPrep || session.isSwitch || session.isRest) return true;
  const item = currentItem();
  return item?.type === "timer";
}

function tick(ts) {
  if (!session || session.paused) return;
  if (!sessionNeedsTick()) return;

  if (session.lastTs == null) session.lastTs = ts;
  const delta = (ts - session.lastTs) / 1000;
  session.lastTs = ts;
  session.remaining -= delta;

  if (session.remaining <= 0) {
    session.remaining = 0;
    updateTimerUI();
    if (session.isPrep) {
      startWorkAfterPrep();
      return;
    }
    if (session.isSwitch) {
      finishSwitch();
      if (session && !session.paused && sessionNeedsTick() && timerEl.dataset.phase !== "done") {
        session.lastTs = performance.now();
        session.raf = requestAnimationFrame(tick);
      }
      return;
    }
    advancePhase();
    if (session && !session.paused && sessionNeedsTick() && timerEl.dataset.phase !== "done") {
      session.lastTs = performance.now();
      session.raf = requestAnimationFrame(tick);
    }
    return;
  }

  updateTimerUI();
  session.raf = requestAnimationFrame(tick);
}

export function startTick() {
  if (!session) return;
  if (!sessionNeedsTick()) return;
  session.paused = false;
  session.lastTs = null;
  session.raf = requestAnimationFrame(tick);
}

export function stopTick() {
  if (session?.raf != null) cancelAnimationFrame(session.raf);
  if (session) {
    session.raf = null;
    session.lastTs = null;
  }
}

export function getSession() {
  return session;
}

export function onVisibilityResume() {
  if (!session || timerEl.dataset.phase === "done") return;
  enableWorkoutAudio();
  requestWakeLock();
}

export function togglePause() {
  if (!session || timerEl.dataset.phase === "done") return;
  if (!sessionNeedsTick()) return;
  if (session.paused) {
    pauseBtn.textContent = "Pauze";
    startTick();
  } else {
    session.paused = true;
    stopTick();
    pauseBtn.textContent = "Hervat";
  }
}

export function skipCurrent() {
  if (!session || timerEl.dataset.phase === "done") return;

  if (session.isPrep) {
    startWorkAfterPrep();
    return;
  }

  if (session.isSwitch) {
    finishSwitch();
    return;
  }

  const item = currentItem();
  if (!item) return;

  if (item.type === "reps" && !session.isRest) {
    advancePhase();
    return;
  }

  session.remaining = 0;
  updateTimerUI();
  advancePhase();
  if (session && !session.paused && sessionNeedsTick() && timerEl.dataset.phase !== "done") {
    session.lastTs = null;
    if (!session.raf) session.raf = requestAnimationFrame(tick);
  }
}

export function completeRepsSet() {
  if (!session || timerEl.dataset.phase === "done") return;
  const item = currentItem();
  if (!item || item.type !== "reps") return;
  advancePhase();
}

export function stopTraining() {
  if (session && timerEl.dataset.phase !== "done") beep("stop");
  endSession(false);
}
