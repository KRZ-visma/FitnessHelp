(() => {
  const STORAGE_KEY = "fitnesshelp-workouts-v1";

  const form = document.getElementById("workout-form");
  const nameInput = document.getElementById("name");
  const setsInput = document.getElementById("sets");
  const durationInput = document.getElementById("duration");
  const restInput = document.getElementById("rest");
  const saveBtn = document.getElementById("save-btn");

  const setupEl = document.getElementById("setup");
  const timerEl = document.getElementById("timer");
  const timerName = document.getElementById("timer-name");
  const timerPhase = document.getElementById("timer-phase");
  const timerClock = document.getElementById("timer-clock");
  const timerBar = document.getElementById("timer-bar");
  const timerMeta = document.getElementById("timer-meta");
  const pauseBtn = document.getElementById("pause-btn");
  const skipBtn = document.getElementById("skip-btn");
  const stopBtn = document.getElementById("stop-btn");

  const savedEmpty = document.getElementById("saved-empty");
  const savedList = document.getElementById("saved-list");

  /** @typedef {{ id: string, name: string, sets: number, duration: number, rest: number }} Workout */

  /** @type {{ workout: Workout, setIndex: number, isRest: boolean, remaining: number, total: number, paused: boolean, raf: number|null, lastTs: number|null } | null} */
  let session = null;

  function loadWorkouts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /** @param {Workout[]} workouts */
  function saveWorkouts(workouts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  }

  function uid() {
    return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function readForm() {
    const name = nameInput.value.trim();
    const sets = Number(setsInput.value);
    const duration = Number(durationInput.value);
    const rest = Number(restInput.value);

    if (!name) {
      nameInput.focus();
      return null;
    }
    if (!Number.isFinite(sets) || sets < 1) {
      setsInput.focus();
      return null;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      durationInput.focus();
      return null;
    }
    if (!Number.isFinite(rest) || rest < 0) {
      restInput.focus();
      return null;
    }

    return {
      id: uid(),
      name,
      sets: Math.min(99, Math.floor(sets)),
      duration: Math.min(3600, Math.floor(duration)),
      rest: Math.min(600, Math.floor(rest)),
    };
  }

  /** @param {Workout} workout */
  function fillForm(workout) {
    nameInput.value = workout.name;
    setsInput.value = String(workout.sets);
    durationInput.value = String(workout.duration);
    restInput.value = String(workout.rest);
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.ceil(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function beep(kind = "tick") {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = kind === "done" ? 660 : kind === "rest" ? 440 : 520;
      gain.gain.value = 0.04;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => ctx.close(), 300);
    } catch {
      // Audio optional
    }
  }

  function renderSaved() {
    const workouts = loadWorkouts();
    savedList.innerHTML = "";
    savedEmpty.hidden = workouts.length > 0;

    workouts.forEach((workout) => {
      const li = document.createElement("li");
      li.className = "saved-item";

      const info = document.createElement("div");
      info.className = "saved-info";
      info.innerHTML = `<strong>${escapeHtml(workout.name)}</strong><span>${workout.sets} sets · ${workout.duration}s · rust ${workout.rest}s</span>`;

      const actions = document.createElement("div");
      actions.className = "saved-actions";

      const start = document.createElement("button");
      start.type = "button";
      start.className = "btn btn-primary";
      start.textContent = "Start";
      start.addEventListener("click", () => {
        fillForm(workout);
        startSession(workout);
      });

      const load = document.createElement("button");
      load.type = "button";
      load.className = "btn btn-ghost";
      load.textContent = "Laden";
      load.addEventListener("click", () => {
        fillForm(workout);
        nameInput.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-danger";
      remove.textContent = "Verwijder";
      remove.addEventListener("click", () => {
        const next = loadWorkouts().filter((w) => w.id !== workout.id);
        saveWorkouts(next);
        renderSaved();
      });

      actions.append(start, load, remove);
      li.append(info, actions);
      savedList.append(li);
    });
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  /** @param {Workout} workout */
  function startSession(workout) {
    stopTick();
    session = {
      workout: { ...workout },
      setIndex: 1,
      isRest: false,
      remaining: workout.duration,
      total: workout.duration,
      paused: false,
      raf: null,
      lastTs: null,
    };

    document.body.classList.add("is-running");
    setupEl.hidden = true;
    timerEl.hidden = false;
    pauseBtn.textContent = "Pauze";
    skipBtn.hidden = false;
    pauseBtn.hidden = false;
    updateTimerUI();
    startTick();
  }

  function endSession(finished) {
    stopTick();
    if (finished && session) {
      session.isRest = false;
      session.remaining = 0;
      session.total = 1;
      timerEl.dataset.phase = "done";
      timerPhase.textContent = "Klaar";
      timerClock.textContent = "0:00";
      timerBar.style.transform = "scaleX(0)";
      timerMeta.textContent = `${session.workout.sets} sets afgerond`;
      pauseBtn.hidden = true;
      skipBtn.hidden = true;
      beep("done");
      return;
    }

    session = null;
    document.body.classList.remove("is-running");
    timerEl.hidden = true;
    setupEl.hidden = false;
    timerEl.dataset.phase = "";
  }

  function updateTimerUI() {
    if (!session) return;
    const { workout, setIndex, isRest, remaining, total } = session;
    timerName.textContent = workout.name;
    timerEl.dataset.phase = isRest ? "rest" : "work";
    timerPhase.textContent = isRest
      ? `Rust · na set ${setIndex}`
      : `Set ${setIndex} van ${workout.sets}`;
    timerClock.textContent = formatTime(remaining);
    const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    timerBar.style.transform = `scaleX(${ratio})`;
    timerMeta.textContent = isRest
      ? `Volgende: set ${setIndex + 1}`
      : `Duur ${workout.duration}s · rust ${workout.rest}s`;
  }

  function advancePhase() {
    if (!session) return;
    const { workout } = session;

    if (!session.isRest) {
      if (session.setIndex >= workout.sets) {
        endSession(true);
        return;
      }
      if (workout.rest > 0) {
        session.isRest = true;
        session.remaining = workout.rest;
        session.total = workout.rest;
        beep("rest");
        updateTimerUI();
        return;
      }
      session.setIndex += 1;
      session.remaining = workout.duration;
      session.total = workout.duration;
      beep("tick");
      updateTimerUI();
      return;
    }

    session.isRest = false;
    session.setIndex += 1;
    session.remaining = workout.duration;
    session.total = workout.duration;
    beep("tick");
    updateTimerUI();
  }

  function tick(ts) {
    if (!session || session.paused) return;
    if (session.lastTs == null) session.lastTs = ts;
    const delta = (ts - session.lastTs) / 1000;
    session.lastTs = ts;
    session.remaining -= delta;

    if (session.remaining <= 0) {
      session.remaining = 0;
      updateTimerUI();
      advancePhase();
      if (session && !session.paused && timerEl.dataset.phase !== "done") {
        session.lastTs = performance.now();
        session.raf = requestAnimationFrame(tick);
      }
      return;
    }

    updateTimerUI();
    session.raf = requestAnimationFrame(tick);
  }

  function startTick() {
    if (!session) return;
    session.paused = false;
    session.lastTs = null;
    session.raf = requestAnimationFrame(tick);
  }

  function stopTick() {
    if (session?.raf != null) cancelAnimationFrame(session.raf);
    if (session) {
      session.raf = null;
      session.lastTs = null;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const workout = readForm();
    if (!workout) return;
    startSession(workout);
  });

  saveBtn.addEventListener("click", () => {
    const workout = readForm();
    if (!workout) return;
    const workouts = loadWorkouts();
    const existingIndex = workouts.findIndex(
      (w) => w.name.toLowerCase() === workout.name.toLowerCase()
    );
    if (existingIndex >= 0) {
      workout.id = workouts[existingIndex].id;
      workouts[existingIndex] = workout;
    } else {
      workouts.unshift(workout);
    }
    saveWorkouts(workouts);
    renderSaved();
  });

  pauseBtn.addEventListener("click", () => {
    if (!session || timerEl.dataset.phase === "done") return;
    if (session.paused) {
      pauseBtn.textContent = "Pauze";
      startTick();
    } else {
      session.paused = true;
      stopTick();
      pauseBtn.textContent = "Hervat";
    }
  });

  skipBtn.addEventListener("click", () => {
    if (!session || timerEl.dataset.phase === "done") return;
    session.remaining = 0;
    updateTimerUI();
    advancePhase();
    if (session && !session.paused && timerEl.dataset.phase !== "done") {
      session.lastTs = null;
      if (!session.raf) session.raf = requestAnimationFrame(tick);
    }
  });

  stopBtn.addEventListener("click", () => {
    endSession(false);
  });

  renderSaved();
})();
