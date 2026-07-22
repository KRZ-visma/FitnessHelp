(() => {
  const STORAGE_KEY = "fitnesshelp-workouts-v1";

  const form = document.getElementById("workout-form");
  const programNameInput = document.getElementById("program-name");
  const segmentsEl = document.getElementById("segments");
  const addSegmentBtn = document.getElementById("add-segment-btn");
  const saveBtn = document.getElementById("save-btn");

  const setupEl = document.getElementById("setup");
  const timerEl = document.getElementById("timer");
  const timerProgram = document.getElementById("timer-program");
  const timerName = document.getElementById("timer-name");
  const timerPhase = document.getElementById("timer-phase");
  const timerClock = document.getElementById("timer-clock");
  const timerProgress = document.getElementById("timer-progress");
  const timerBar = document.getElementById("timer-bar");
  const timerMeta = document.getElementById("timer-meta");
  const doneSetBtn = document.getElementById("done-set-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const skipBtn = document.getElementById("skip-btn");
  const stopBtn = document.getElementById("stop-btn");

  const savedEmpty = document.getElementById("saved-empty");
  const savedList = document.getElementById("saved-list");

  /**
   * @typedef {{ type: 'timer', name: string, sets: number, duration: number, rest: number }} TimerItem
   * @typedef {{ type: 'reps', name: string, sets: number, reps: number }} RepsItem
   * @typedef {TimerItem | RepsItem} ProgramItem
   * @typedef {{ id: string, name: string, items: ProgramItem[] }} Program
   */

  /** @type {{ program: Program, itemIndex: number, setIndex: number, isRest: boolean, remaining: number, total: number, paused: boolean, raf: number|null, lastTs: number|null } | null} */
  let session = null;

  /** @type {{ type: 'timer'|'reps', name: string, sets: string, duration: string, rest: string, reps: string }[]} */
  let draftItems = [];

  function loadPrograms() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];

      const hasLegacy = data.some(
        (entry) => entry && typeof entry === "object" && !Array.isArray(/** @type {Record<string, unknown>} */ (entry).items)
      );
      if (!hasLegacy) {
        return data.map(normalizeProgram).filter(Boolean);
      }

      // Legacy workouts ({ name, sets, duration, rest }) → één programma met alle oefeningen als onderdelen
      /** @type {ProgramItem[]} */
      const migratedItems = [];
      /** @type {Program[]} */
      const modernPrograms = [];
      let migratedId = "";

      data.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const obj = /** @type {Record<string, unknown>} */ (entry);
        if (Array.isArray(obj.items)) {
          const program = normalizeProgram(entry);
          if (program) modernPrograms.push(program);
          return;
        }
        const item = legacyWorkoutToItem(entry);
        if (!item) return;
        migratedItems.push(item);
        if (!migratedId && typeof obj.id === "string") migratedId = obj.id;
      });

      /** @type {Program[]} */
      const programs = [...modernPrograms];
      if (migratedItems.length) {
        programs.unshift({
          id: migratedId || uid(),
          name: "Mijn training",
          items: migratedItems,
        });
      }

      savePrograms(programs);
      return programs;
    } catch {
      return [];
    }
  }

  /** @param {Program[]} programs */
  function savePrograms(programs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
  }

  /** @param {unknown} raw @returns {TimerItem | null} */
  function legacyWorkoutToItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const obj = /** @type {Record<string, unknown>} */ (raw);
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    if (!name) return null;
    const sets = Number(obj.sets);
    const duration = Number(obj.duration);
    const rest = Number(obj.rest);
    if (!Number.isFinite(sets) || sets < 1) return null;
    if (!Number.isFinite(duration) || duration < 1) return null;
    if (!Number.isFinite(rest) || rest < 0) return null;
    return {
      type: "timer",
      name,
      sets: clampInt(sets, 1, 99),
      duration: clampInt(duration, 1, 3600),
      rest: clampInt(rest, 0, 600),
    };
  }

  /** @param {unknown} raw @returns {Program | null} */
  function normalizeProgram(raw) {
    if (!raw || typeof raw !== "object") return null;
    const obj = /** @type {Record<string, unknown>} */ (raw);
    const id = typeof obj.id === "string" ? obj.id : uid();
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    if (!name || !Array.isArray(obj.items)) return null;

    const items = obj.items.map(normalizeItem).filter(Boolean);
    if (!items.length) return null;
    return { id, name, items: /** @type {ProgramItem[]} */ (items) };
  }

  /** @param {unknown} raw @returns {ProgramItem | null} */
  function normalizeItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const obj = /** @type {Record<string, unknown>} */ (raw);
    const itemName = typeof obj.name === "string" ? obj.name.trim() : "";
    if (!itemName) return null;
    const sets = Number(obj.sets);
    if (!Number.isFinite(sets) || sets < 1) return null;

    if (obj.type === "reps") {
      const reps = Number(obj.reps);
      if (!Number.isFinite(reps) || reps < 1) return null;
      return {
        type: "reps",
        name: itemName,
        sets: clampInt(sets, 1, 99),
        reps: clampInt(reps, 1, 999),
      };
    }

    const duration = Number(obj.duration);
    const rest = Number(obj.rest);
    if (!Number.isFinite(duration) || duration < 1) return null;
    if (!Number.isFinite(rest) || rest < 0) return null;
    return {
      type: "timer",
      name: itemName,
      sets: clampInt(sets, 1, 99),
      duration: clampInt(duration, 1, 3600),
      rest: clampInt(rest, 0, 600),
    };
  }

  function uid() {
    return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function clampInt(value, min, max) {
    return Math.min(max, Math.max(min, Math.floor(value)));
  }

  function defaultDraftItem(type = "timer") {
    if (type === "reps") {
      return { type: "reps", name: "", sets: "3", duration: "45", rest: "15", reps: "10" };
    }
    return { type: "timer", name: "", sets: "3", duration: "45", rest: "15", reps: "10" };
  }

  function resetDraft() {
    draftItems = [defaultDraftItem("timer")];
    programNameInput.value = "";
    renderSegments();
  }

  function bindDigits(input) {
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "");
      if (input.value !== digits) input.value = digits;
    });
  }

  function renderSegments() {
    segmentsEl.innerHTML = "";
    draftItems.forEach((item, index) => {
      const article = document.createElement("article");
      article.className = "segment";
      article.dataset.index = String(index);
      article.dataset.type = item.type;

      const head = document.createElement("div");
      head.className = "segment-head";

      const label = document.createElement("p");
      label.className = "segment-label";
      label.textContent = `Onderdeel ${index + 1}`;

      const typeSelect = document.createElement("select");
      typeSelect.className = "segment-type";
      typeSelect.setAttribute("aria-label", `Type onderdeel ${index + 1}`);
      typeSelect.innerHTML = `
        <option value="timer"${item.type === "timer" ? " selected" : ""}>Timer</option>
        <option value="reps"${item.type === "reps" ? " selected" : ""}>Sets &amp; keer</option>
      `;
      typeSelect.addEventListener("change", () => {
        draftItems[index].type = /** @type {'timer'|'reps'} */ (typeSelect.value);
        renderSegments();
      });

      head.append(label, typeSelect);

      const nameField = document.createElement("label");
      nameField.className = "field";
      nameField.innerHTML = `<span>Oefening</span>`;
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "segment-name";
      nameInput.placeholder = "bijv. Push-ups";
      nameInput.maxLength = 60;
      nameInput.autocomplete = "off";
      nameInput.spellcheck = false;
      nameInput.setAttribute("autocorrect", "off");
      nameInput.setAttribute("autocapitalize", "words");
      nameInput.required = true;
      nameInput.value = item.name;
      nameInput.addEventListener("input", () => {
        draftItems[index].name = nameInput.value;
      });
      nameField.append(nameInput);

      const row = document.createElement("div");
      row.className = "field-row";

      const setsField = makeNumberField("Aantal sets", "segment-sets", item.sets, (value) => {
        draftItems[index].sets = value;
      });
      row.append(setsField);

      if (item.type === "timer") {
        row.append(
          makeNumberField("Duur per set (sec)", "segment-duration", item.duration, (value) => {
            draftItems[index].duration = value;
          }),
          makeNumberField("Rust tussen sets (sec)", "segment-rest", item.rest, (value) => {
            draftItems[index].rest = value;
          })
        );
      } else {
        row.append(
          makeNumberField("Keer per set", "segment-reps", item.reps, (value) => {
            draftItems[index].reps = value;
          })
        );
      }

      const foot = document.createElement("div");
      foot.className = "segment-foot";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-danger";
      removeBtn.textContent = "Verwijder";
      removeBtn.disabled = draftItems.length <= 1;
      removeBtn.addEventListener("click", () => {
        if (draftItems.length <= 1) return;
        draftItems.splice(index, 1);
        renderSegments();
      });
      foot.append(removeBtn);

      article.append(head, nameField, row, foot);
      segmentsEl.append(article);
    });
  }

  function makeNumberField(labelText, className, value, onChange) {
    const field = document.createElement("label");
    field.className = "field";
    const span = document.createElement("span");
    span.textContent = labelText;
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.pattern = "[0-9]*";
    input.className = className;
    input.autocomplete = "off";
    input.required = true;
    input.value = value;
    bindDigits(input);
    input.addEventListener("input", () => onChange(input.value));
    field.append(span, input);
    return field;
  }

  /** @returns {Program | null} */
  function readForm() {
    const name = programNameInput.value.trim();
    if (!name) {
      programNameInput.focus();
      return null;
    }

    /** @type {ProgramItem[]} */
    const items = [];
    for (let i = 0; i < draftItems.length; i += 1) {
      const draft = draftItems[i];
      const itemName = draft.name.trim();
      const sets = Number(draft.sets);
      if (!itemName) {
        const input = segmentsEl.querySelector(`[data-index="${i}"] .segment-name`);
        if (input instanceof HTMLInputElement) input.focus();
        return null;
      }
      if (!Number.isFinite(sets) || sets < 1) {
        const input = segmentsEl.querySelector(`[data-index="${i}"] .segment-sets`);
        if (input instanceof HTMLInputElement) input.focus();
        return null;
      }

      if (draft.type === "reps") {
        const reps = Number(draft.reps);
        if (!Number.isFinite(reps) || reps < 1) {
          const input = segmentsEl.querySelector(`[data-index="${i}"] .segment-reps`);
          if (input instanceof HTMLInputElement) input.focus();
          return null;
        }
        items.push({
          type: "reps",
          name: itemName,
          sets: clampInt(sets, 1, 99),
          reps: clampInt(reps, 1, 999),
        });
      } else {
        const duration = Number(draft.duration);
        const rest = Number(draft.rest);
        if (!Number.isFinite(duration) || duration < 1) {
          const input = segmentsEl.querySelector(`[data-index="${i}"] .segment-duration`);
          if (input instanceof HTMLInputElement) input.focus();
          return null;
        }
        if (!Number.isFinite(rest) || rest < 0) {
          const input = segmentsEl.querySelector(`[data-index="${i}"] .segment-rest`);
          if (input instanceof HTMLInputElement) input.focus();
          return null;
        }
        items.push({
          type: "timer",
          name: itemName,
          sets: clampInt(sets, 1, 99),
          duration: clampInt(duration, 1, 3600),
          rest: clampInt(rest, 0, 600),
        });
      }
    }

    if (!items.length) return null;
    return { id: uid(), name, items };
  }

  /** @param {Program} program */
  function fillForm(program) {
    programNameInput.value = program.name;
    draftItems = program.items.map((item) => {
      if (item.type === "reps") {
        return {
          type: "reps",
          name: item.name,
          sets: String(item.sets),
          duration: "45",
          rest: "15",
          reps: String(item.reps),
        };
      }
      return {
        type: "timer",
        name: item.name,
        sets: String(item.sets),
        duration: String(item.duration),
        rest: String(item.rest),
        reps: "10",
      };
    });
    if (!draftItems.length) draftItems = [defaultDraftItem("timer")];
    renderSegments();
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
    const programs = loadPrograms();
    savedList.innerHTML = "";
    savedEmpty.hidden = programs.length > 0;

    programs.forEach((program) => {
      const li = document.createElement("li");
      li.className = "saved-item";

      const info = document.createElement("div");
      info.className = "saved-info";
      const parts = program.items
        .map((item) => `${escapeHtml(item.name)} (${item.type === "reps" ? "sets & keer" : "timer"})`)
        .join(" · ");
      info.innerHTML = `<strong>${escapeHtml(program.name)}</strong><span>${program.items.length === 1 ? "1 onderdeel" : `${program.items.length} onderdelen`} · ${parts}</span>`;

      const actions = document.createElement("div");
      actions.className = "saved-actions";

      const start = document.createElement("button");
      start.type = "button";
      start.className = "btn btn-primary";
      start.textContent = "Start";
      start.addEventListener("click", () => {
        fillForm(program);
        startSession(program);
      });

      const load = document.createElement("button");
      load.type = "button";
      load.className = "btn btn-ghost";
      load.textContent = "Laden";
      load.addEventListener("click", () => {
        fillForm(program);
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

  function currentItem() {
    return session?.program.items[session.itemIndex] ?? null;
  }

  /** @param {Program} program */
  function startSession(program) {
    stopTick();
    session = {
      program: {
        id: program.id,
        name: program.name,
        items: program.items.map((item) => ({ ...item })),
      },
      itemIndex: 0,
      setIndex: 1,
      isRest: false,
      remaining: 0,
      total: 1,
      paused: false,
      raf: null,
      lastTs: null,
    };

    document.body.classList.add("is-running");
    setupEl.hidden = true;
    timerEl.hidden = false;
    pauseBtn.textContent = "Pauze";
    skipBtn.hidden = false;
    beginCurrentItem(false);
  }

  function beginCurrentItem(playSound) {
    if (!session) return;
    const item = currentItem();
    if (!item) {
      endSession(true);
      return;
    }

    session.setIndex = 1;
    session.isRest = false;
    session.paused = false;
    pauseBtn.textContent = "Pauze";

    if (item.type === "timer") {
      session.remaining = item.duration;
      session.total = item.duration;
      doneSetBtn.hidden = true;
      pauseBtn.hidden = false;
      timerProgress.hidden = false;
      if (playSound) beep("tick");
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
    if (playSound) beep("tick");
    updateTimerUI();
  }

  function endSession(finished) {
    stopTick();
    if (finished && session) {
      session.isRest = false;
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
      beep("done");
      return;
    }

    session = null;
    document.body.classList.remove("is-running");
    timerEl.hidden = true;
    setupEl.hidden = false;
    timerEl.dataset.phase = "";
    timerEl.dataset.mode = "";
  }

  function updateTimerUI() {
    if (!session) return;
    const item = currentItem();
    if (!item) return;

    const { setIndex, isRest, remaining, total, itemIndex, program } = session;
    timerProgram.textContent =
      program.items.length > 1
        ? `${program.name} · ${itemIndex + 1}/${program.items.length}`
        : program.name;
    timerName.textContent = item.name;

    if (item.type === "reps") {
      timerEl.dataset.mode = "reps";
      timerEl.dataset.phase = "work";
      timerPhase.textContent = `Set ${setIndex} van ${item.sets}`;
      timerClock.textContent = `${item.reps}×`;
      timerClock.classList.add("is-reps");
      timerBar.style.transform = "scaleX(1)";
      timerMeta.textContent = `${item.sets} sets · ${item.reps} keer`;
      return;
    }

    timerEl.dataset.mode = "timer";
    timerClock.classList.remove("is-reps");
    timerEl.dataset.phase = isRest ? "rest" : "work";
    timerPhase.textContent = isRest
      ? `Rust · na set ${setIndex}`
      : `Set ${setIndex} van ${item.sets}`;
    timerClock.textContent = formatTime(remaining);
    const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    timerBar.style.transform = `scaleX(${ratio})`;
    timerMeta.textContent = isRest
      ? `Volgende: set ${setIndex + 1}`
      : `Duur ${item.duration}s · rust ${item.rest}s`;
  }

  function advanceToNextItem() {
    if (!session) return;
    if (session.itemIndex >= session.program.items.length - 1) {
      endSession(true);
      return;
    }
    session.itemIndex += 1;
    beginCurrentItem(true);
  }

  function advancePhase() {
    if (!session) return;
    const item = currentItem();
    if (!item) return;

    if (item.type === "reps") {
      if (session.setIndex >= item.sets) {
        advanceToNextItem();
        return;
      }
      session.setIndex += 1;
      beep("tick");
      updateTimerUI();
      return;
    }

    if (!session.isRest) {
      if (session.setIndex >= item.sets) {
        advanceToNextItem();
        return;
      }
      if (item.rest > 0) {
        session.isRest = true;
        session.remaining = item.rest;
        session.total = item.rest;
        beep("rest");
        updateTimerUI();
        return;
      }
      session.setIndex += 1;
      session.remaining = item.duration;
      session.total = item.duration;
      beep("tick");
      updateTimerUI();
      return;
    }

    session.isRest = false;
    session.setIndex += 1;
    session.remaining = item.duration;
    session.total = item.duration;
    beep("tick");
    updateTimerUI();
  }

  function tick(ts) {
    if (!session || session.paused) return;
    const item = currentItem();
    if (!item || item.type !== "timer") return;

    if (session.lastTs == null) session.lastTs = ts;
    const delta = (ts - session.lastTs) / 1000;
    session.lastTs = ts;
    session.remaining -= delta;

    if (session.remaining <= 0) {
      session.remaining = 0;
      updateTimerUI();
      advancePhase();
      if (
        session &&
        !session.paused &&
        timerEl.dataset.phase !== "done" &&
        currentItem()?.type === "timer"
      ) {
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
    const item = currentItem();
    if (!item || item.type !== "timer") return;
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

  addSegmentBtn.addEventListener("click", () => {
    draftItems.push(defaultDraftItem("timer"));
    renderSegments();
    const last = segmentsEl.querySelector(".segment:last-child .segment-name");
    if (last instanceof HTMLInputElement) last.focus();
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
    renderSaved();
  });

  doneSetBtn.addEventListener("click", () => {
    if (!session || timerEl.dataset.phase === "done") return;
    const item = currentItem();
    if (!item || item.type !== "reps") return;
    advancePhase();
  });

  pauseBtn.addEventListener("click", () => {
    if (!session || timerEl.dataset.phase === "done") return;
    const item = currentItem();
    if (!item || item.type !== "timer") return;
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
    const item = currentItem();
    if (!item) return;

    if (item.type === "reps") {
      advancePhase();
      return;
    }

    session.remaining = 0;
    updateTimerUI();
    advancePhase();
    if (
      session &&
      !session.paused &&
      timerEl.dataset.phase !== "done" &&
      currentItem()?.type === "timer"
    ) {
      session.lastTs = null;
      if (!session.raf) session.raf = requestAnimationFrame(tick);
    }
  });

  stopBtn.addEventListener("click", () => {
    endSession(false);
  });

  resetDraft();
  renderSaved();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Service worker optioneel (bijv. file://)
      });
    });
  }
})();
