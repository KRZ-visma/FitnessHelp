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
import { recordProgramCompletion } from "./storage.js";
import { recordProgramInHistory } from "./statistics.js";
import { resolveExercise } from "./migration.js";
import { formatTime } from "./util.js";

/**
 * @typedef {{ itemIndex: number, setIndex: number }} ScheduleEntry
 */

/**
 * @type {{
 *   program: import('./constants.js').Program & { items: import('./constants.js').ProgramItem[] },
 *   schedule: ScheduleEntry[],
 *   scheduleIndex: number,
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

/**
 * Bouwt de volgorde van sets voor één programma-start.
 * @param {import('./constants.js').ProgramItem[]} items
 * @param {import('./constants.js').SetOrder} setOrder
 * @returns {ScheduleEntry[]}
 */
export function buildSetSchedule(items, setOrder) {
  /** @type {ScheduleEntry[]} */
  const schedule = [];
  if (!items.length) return schedule;

  if (setOrder === "rounds") {
    const maxSets = Math.max(...items.map((item) => item.sets));
    for (let setIndex = 1; setIndex <= maxSets; setIndex += 1) {
      items.forEach((item, itemIndex) => {
        if (setIndex <= item.sets) {
          schedule.push({ itemIndex, setIndex });
        }
      });
    }
    return schedule;
  }

  items.forEach((item, itemIndex) => {
    for (let setIndex = 1; setIndex <= item.sets; setIndex += 1) {
      schedule.push({ itemIndex, setIndex });
    }
  });
  return schedule;
}

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

/** @returns {ScheduleEntry | null} */
function currentScheduleEntry() {
  if (!session) return null;
  return session.schedule[session.scheduleIndex] ?? null;
}

/** @returns {ScheduleEntry | null} */
function nextScheduleEntry() {
  if (!session) return null;
  return session.schedule[session.scheduleIndex + 1] ?? null;
}

/**
 * @param {number} index
 */
function goToScheduleIndex(index) {
  if (!session) return;
  const entry = session.schedule[index];
  if (!entry) return;
  session.scheduleIndex = index;
  session.itemIndex = entry.itemIndex;
  session.setIndex = entry.setIndex;
}

/** @param {import('./constants.js').Program} program */
function programTitle(program, itemIndex) {
  const parts = [program.name];
  if (program.items.length > 1) {
    parts.push(`${itemIndex + 1}/${program.items.length}`);
  }
  return parts.join(" · ");
}

/** @param {import('./constants.js').Program} program */
export function startSession(program) {
  enableWorkoutAudio();
  stopTick();

  const resolvedItems = program.items
    .map((item) => resolveExercise(item, program.rest))
    .filter(Boolean);

  if (!resolvedItems.length) return;

  const times = Math.max(1, Number(program.times) || 1);
  /** @type {import('./constants.js').SetOrder} */
  const setOrder = program.setOrder === "rounds" ? "rounds" : "consecutive";
  const schedule = buildSetSchedule(resolvedItems, setOrder);
  if (!schedule.length) return;

  const first = schedule[0];

  session = {
    program: {
      id: program.id,
      name: program.name,
      rest: program.rest,
      switch: program.switch,
      times,
      setOrder,
      items: resolvedItems,
    },
    schedule,
    scheduleIndex: 0,
    itemIndex: first.itemIndex,
    setIndex: first.setIndex,
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
  beginPrep();
}

function beginPrep() {
  if (!session) return;
  const item = currentItem();
  if (!item) {
    endSession(true);
    return;
  }

  const prepTime = session.program.switch;
  if (prepTime === 0) {
    startWorkAfterPrep();
    return;
  }

  session.isRest = false;
  session.isPrep = true;
  session.isSwitch = false;
  session.paused = false;
  session.remaining = prepTime;
  session.total = prepTime;
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
    // Voorkom dubbele afronding als een naijle tick nog binnenkomt.
    if (timerEl.dataset.phase === "done") return;
    const times = Math.max(1, Number(session.program.times) || 1);
    recordProgramCompletion(session.program.id, times);
    recordProgramInHistory(session.program.id);
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
  if (!session || timerEl.dataset.phase === "done") return;
  const { setIndex, isRest, isPrep, isSwitch, remaining, total, itemIndex, program } = session;

  if (isSwitch) {
    const nextEntry = nextScheduleEntry();
    if (!nextEntry) return;
    const next = program.items[nextEntry.itemIndex];
    if (!next) return;
    timerProgram.textContent = programTitle(program, nextEntry.itemIndex);
    timerName.textContent = next.name;
    timerEl.dataset.mode = "timer";
    timerEl.dataset.phase = "switch";
    timerClock.classList.remove("is-reps");
    timerPhase.textContent = "Wisselen";
    timerClock.textContent = formatTime(remaining);
    const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    timerBar.style.transform = `scaleX(${ratio})`;
    timerMeta.textContent = `Volgende: ${next.name} · set ${nextEntry.setIndex}`;
    return;
  }

  const item = currentItem();
  if (!item) return;

  timerProgram.textContent = programTitle(program, itemIndex);
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
        ? `Daarna: set ${setIndex} · ${item.reps}×`
        : `Daarna: set ${setIndex} · ${item.duration}s`;
    return;
  }

  if (isRest) {
    const next = nextScheduleEntry();
    timerEl.dataset.mode = item.type === "reps" ? "reps" : "timer";
    timerEl.dataset.phase = "rest";
    timerClock.classList.remove("is-reps");
    timerPhase.textContent = `Rust · na set ${setIndex}`;
    timerClock.textContent = formatTime(remaining);
    const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    timerBar.style.transform = `scaleX(${ratio})`;
    timerMeta.textContent = next
      ? `Volgende: set ${next.setIndex}`
      : `Volgende: set ${setIndex + 1}`;
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
  const next = nextScheduleEntry();
  if (!next) {
    endSession(true);
    return;
  }
  goToScheduleIndex(session.scheduleIndex + 1);
  session.isRest = false;
  session.isPrep = false;
  startWorkAfterPrep();
}

function enterExerciseSwitch() {
  if (!session) return;
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
  goToScheduleIndex(session.scheduleIndex + 1);
  beginPrep();
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
  goToScheduleIndex(session.scheduleIndex + 1);
  const item = currentItem();
  if (!item) return;

  session.isRest = false;
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

function startNextWorkWithoutGap() {
  if (!session) return;
  goToScheduleIndex(session.scheduleIndex + 1);
  const item = currentItem();
  if (!item) return;

  beep("tick");

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

export function advancePhase() {
  if (!session || timerEl.dataset.phase === "done") return;
  const item = currentItem();
  if (!item) return;

  if (session.isRest) {
    leaveRestPhase();
    return;
  }

  const next = nextScheduleEntry();
  if (!next) {
    endSession(true);
    return;
  }

  const current = currentScheduleEntry();
  if (!current) return;

  if (next.itemIndex === current.itemIndex) {
    if (session.program.rest > 0) {
      enterRestPhase();
      return;
    }
    startNextWorkWithoutGap();
    return;
  }

  enterExerciseSwitch();
}

export function sessionNeedsTick() {
  if (!session || timerEl.dataset.phase === "done") return false;
  if (session.isPrep || session.isSwitch || session.isRest) return true;
  const item = currentItem();
  return item?.type === "timer";
}

function tick(ts) {
  if (!session || session.paused || timerEl.dataset.phase === "done") return;
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
