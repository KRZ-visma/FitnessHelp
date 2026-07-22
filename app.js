(() => {
  const STORAGE_KEY = "fitnesshelp-workouts-v1";
  const FAVORITE_KEY = "fitnesshelp-favorite-v1";

  const PREP_SECONDS = 5;

  const form = document.getElementById("workout-form");
  const programNameInput = document.getElementById("program-name");
  const programNameSuggestions = document.getElementById("program-name-suggestions");
  const segmentsEl = document.getElementById("segments");
  const addSegmentBtn = document.getElementById("add-segment-btn");
  const saveBtn = document.getElementById("save-btn");

  const taglineEl = document.getElementById("tagline");
  const homeEl = document.getElementById("home");
  const homeName = document.getElementById("home-title");
  const homeMeta = document.getElementById("home-meta");
  const homeStartBtn = document.getElementById("home-start-btn");
  const manageBtn = document.getElementById("manage-btn");
  const manageEl = document.getElementById("manage");
  const manageHeader = document.getElementById("manage-header");
  const manageDoneBtn = document.getElementById("manage-done-btn");

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
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  const transferStatus = document.getElementById("transfer-status");

  const EXPORT_APP = "fitnesshelp";
  const EXPORT_VERSION = 1;
  const TAGLINE_EMPTY = "Programma bouwen. Timer of sets & keer. Lokaal bewaard.";
  const TAGLINE_READY = "Één favoriet. Start en train. Lokaal bewaard.";

  /**
   * @typedef {{ type: 'timer', name: string, sets: number, duration: number, rest: number }} TimerItem
   * @typedef {{ type: 'reps', name: string, sets: number, reps: number }} RepsItem
   * @typedef {TimerItem | RepsItem} ProgramItem
   * @typedef {{ id: string, name: string, items: ProgramItem[] }} Program
   */

  /** @type {{ program: Program, itemIndex: number, setIndex: number, isRest: boolean, isPrep: boolean, remaining: number, total: number, paused: boolean, raf: number|null, lastTs: number|null } | null} */
  let session = null;

  /** @type {WakeLockSentinel | null} */
  let wakeLock = null;

  /** @type {{ type: 'timer'|'reps', name: string, sets: string, duration: string, rest: string, reps: string }[]} */
  let draftItems = [];

  /** Beheer blijft open tot de gebruiker klaar is of opnieuw start vanuit home. */
  let managing = false;

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

  /** @returns {string | null} */
  function loadFavoriteId() {
    try {
      const id = localStorage.getItem(FAVORITE_KEY);
      return id && typeof id === "string" ? id : null;
    } catch {
      return null;
    }
  }

  /** @param {string | null} id */
  function saveFavoriteId(id) {
    try {
      if (!id) {
        localStorage.removeItem(FAVORITE_KEY);
        return;
      }
      localStorage.setItem(FAVORITE_KEY, id);
    } catch {
      // ignore
    }
  }

  /**
   * @param {Program[]} programs
   * @returns {Program | null}
   */
  function resolveFavorite(programs) {
    if (!programs.length) {
      saveFavoriteId(null);
      return null;
    }
    const favoriteId = loadFavoriteId();
    const match = favoriteId ? programs.find((p) => p.id === favoriteId) : null;
    if (match) return match;
    saveFavoriteId(programs[0].id);
    return programs[0];
  }

  /** @param {string} id */
  function setFavorite(id) {
    const programs = loadPrograms();
    if (!programs.some((p) => p.id === id)) return;
    saveFavoriteId(id);
    renderApp();
  }

  /**
   * @param {Program} program
   * @returns {string}
   */
  function programSummary(program) {
    const parts = program.items.map((item) =>
      item.type === "reps" ? `${item.name} (sets & keer)` : `${item.name} (timer)`
    );
    const count =
      program.items.length === 1 ? "1 onderdeel" : `${program.items.length} onderdelen`;
    return `${count} · ${parts.join(" · ")}`;
  }

  /** @param {string} message @param {'ok'|'error'} [tone] */
  function setTransferStatus(message, tone = "ok") {
    transferStatus.hidden = !message;
    transferStatus.textContent = message;
    if (tone === "error") {
      transferStatus.dataset.tone = "error";
    } else {
      delete transferStatus.dataset.tone;
    }
  }

  /** @param {unknown} data @returns {unknown[] | null} */
  function extractImportEntries(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      const obj = /** @type {Record<string, unknown>} */ (data);
      if (Array.isArray(obj.programs)) return obj.programs;
    }
    return null;
  }

  /** @param {unknown[]} entries @returns {Program[]} */
  function programsFromEntries(entries) {
    const hasLegacy = entries.some(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        !Array.isArray(/** @type {Record<string, unknown>} */ (entry).items)
    );

    if (!hasLegacy) {
      return entries.map(normalizeProgram).filter(Boolean);
    }

    /** @type {ProgramItem[]} */
    const migratedItems = [];
    /** @type {Program[]} */
    const modernPrograms = [];
    let migratedId = "";

    entries.forEach((entry) => {
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
    return programs;
  }

  /**
   * @param {Program[]} existing
   * @param {Program[]} incoming
   * @returns {Program[]}
   */
  function mergePrograms(existing, incoming) {
    const next = existing.map((program) => ({ ...program, items: [...program.items] }));

    incoming.forEach((program) => {
      const byId = next.findIndex((p) => p.id === program.id);
      if (byId >= 0) {
        next[byId] = { ...program, items: [...program.items] };
        return;
      }

      const byName = next.findIndex(
        (p) => p.name.toLowerCase() === program.name.toLowerCase()
      );
      if (byName >= 0) {
        next[byName] = {
          ...program,
          id: next[byName].id,
          items: [...program.items],
        };
        return;
      }

      next.unshift({ ...program, items: [...program.items] });
    });

    return next;
  }

  function exportPrograms() {
    const programs = loadPrograms();
    if (!programs.length) {
      setTransferStatus("Niets om te exporteren.", "error");
      return;
    }

    const payload = {
      version: EXPORT_VERSION,
      app: EXPORT_APP,
      exportedAt: new Date().toISOString(),
      programs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fitnesshelp-programmas-${stamp}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    const count = programs.length;
    setTransferStatus(
      count === 1 ? "1 programma geëxporteerd." : `${count} programma’s geëxporteerd.`
    );
  }

  /** @param {File} file */
  function importProgramsFromFile(file) {
    const reader = new FileReader();
    reader.onerror = () => {
      setTransferStatus("Bestand kon niet worden gelezen.", "error");
    };
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const data = JSON.parse(text);
        const entries = extractImportEntries(data);
        if (!entries) {
          setTransferStatus("Ongeldig bestand: verwacht een JSON-lijst of exportbestand.", "error");
          return;
        }

        const incoming = programsFromEntries(entries);
        if (!incoming.length) {
          setTransferStatus("Geen geldige programma’s gevonden in het bestand.", "error");
          return;
        }

        const merged = mergePrograms(loadPrograms(), incoming);
        savePrograms(merged);
        resolveFavorite(merged);
        renderApp();

        const count = incoming.length;
        setTransferStatus(
          count === 1
            ? "1 programma geïmporteerd."
            : `${count} programma’s geïmporteerd.`
        );
      } catch {
        setTransferStatus("Ongeldig JSON-bestand.", "error");
      }
    };
    reader.readAsText(file);
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

  /** @type {string[]} */
  const recentBeeps = [];
  /** @type {AudioContext | null} */
  let audioCtx = null;

  /** Zet iOS-audiosessie op media-playback zodat tonen ook bij stil-schakelaar klinken. */
  function enableWorkoutAudio() {
    try {
      const session = /** @type {{ type?: string } | undefined} */ (navigator.audioSession);
      if (session && typeof session.type === "string") {
        session.type = "playback";
      }
    } catch {
      // AudioSession optioneel (Safari)
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtx || audioCtx.state === "closed") {
        audioCtx = new AudioCtx();
      }
      if (audioCtx.state === "suspended") {
        void audioCtx.resume();
      }
    } catch {
      // Audio optional
    }
  }

  /** @param {'start'|'stop'|'tick'|'rest'|'done'} [kind] */
  function beep(kind = "tick") {
    recentBeeps.push(kind);
    if (recentBeeps.length > 40) recentBeeps.shift();
    try {
      enableWorkoutAudio();
      if (!audioCtx) return;
      const ctx = audioCtx;
      const now = ctx.currentTime;

      /** @param {number} freq @param {number} startAt @param {number} duration @param {number} [volume] */
      const playTone = (freq, startAt, duration, volume = 0.06) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        osc.start(startAt);
        osc.stop(startAt + duration + 0.02);
      };

      if (kind === "start") {
        playTone(523, now, 0.11);
        playTone(784, now + 0.11, 0.14);
        return;
      }
      if (kind === "stop") {
        playTone(698, now, 0.11);
        playTone(349, now + 0.11, 0.16);
        return;
      }
      if (kind === "done") {
        playTone(523, now, 0.09);
        playTone(659, now + 0.09, 0.09);
        playTone(784, now + 0.18, 0.16);
        return;
      }
      if (kind === "rest") {
        playTone(440, now, 0.16, 0.045);
        return;
      }
      playTone(520, now, 0.12, 0.04);
    } catch {
      // Audio optional
    }
  }

  // Test-hook: recente geluidssignalen (start/stop/tick/…)
  Object.defineProperty(window, "__fitnessHelpBeeps", {
    configurable: true,
    get() {
      return recentBeeps;
    },
  });
  Object.defineProperty(window, "__fitnessHelpAudioSessionType", {
    configurable: true,
    get() {
      try {
        const session = /** @type {{ type?: string } | undefined} */ (navigator.audioSession);
        return session?.type ?? null;
      } catch {
        return null;
      }
    },
  });
  function updateProgramSuggestions(programs = loadPrograms()) {
    if (!(programNameSuggestions instanceof HTMLDataListElement)) return;
    programNameSuggestions.innerHTML = "";
    const seen = new Set();
    programs.forEach((program) => {
      const name = program.name.trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const option = document.createElement("option");
      option.value = name;
      programNameSuggestions.append(option);
    });
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

  function renderSaved() {
    const programs = loadPrograms();
    const favorite = resolveFavorite(programs);
    const favoriteId = favorite?.id ?? null;
    savedList.innerHTML = "";
    savedEmpty.hidden = programs.length > 0;
    updateProgramSuggestions(programs);

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

      const favoriteBtn = document.createElement("button");
      favoriteBtn.type = "button";
      favoriteBtn.className = "btn btn-ghost";
      favoriteBtn.textContent = program.id === favoriteId ? "Favoriet" : "Maak favoriet";
      favoriteBtn.disabled = program.id === favoriteId;
      favoriteBtn.addEventListener("click", () => {
        setFavorite(program.id);
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
        renderApp();
      });

      actions.append(start, load, favoriteBtn, remove);
      li.append(info, actions);
      savedList.append(li);
    });
  }

  function renderHome() {
    const programs = loadPrograms();
    const favorite = resolveFavorite(programs);

    if (!favorite) {
      homeEl.hidden = true;
      homeName.textContent = "";
      homeMeta.textContent = "";
      if (taglineEl) taglineEl.textContent = TAGLINE_EMPTY;
      return null;
    }

    homeEl.hidden = false;
    homeName.textContent = favorite.name;
    homeMeta.textContent = programSummary(favorite);
    if (taglineEl) taglineEl.textContent = TAGLINE_READY;
    return favorite;
  }

  /**
   * Toont home als er een favoriet is en beheer niet open staat;
   * beheer is altijd zichtbaar als er nog niets is.
   */
  function updateShell() {
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

  function openManage() {
    managing = true;
    const favorite = resolveFavorite(loadPrograms());
    if (favorite) fillForm(favorite);
    renderApp();
    programNameInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeManage() {
    managing = false;
    renderApp();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderApp() {
    renderHome();
    renderSaved();
    updateShell();
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
    enableWorkoutAudio();
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
      isPrep: true,
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

  function startWorkAfterPrep() {
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

  function endSession(finished) {
    stopTick();
    if (finished && session) {
      session.isRest = false;
      session.isPrep = false;
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
    renderApp();
  }

  function updateTimerUI() {
    if (!session) return;
    const item = currentItem();
    if (!item) return;

    const { setIndex, isRest, isPrep, remaining, total, itemIndex, program } = session;
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
    beep("stop");
    session.itemIndex += 1;
    beginCurrentItem();
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
    if (!item) return;
    if (!session.isPrep && item.type !== "timer") return;

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
      advancePhase();
      if (
        session &&
        !session.paused &&
        !session.isPrep &&
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
    if (!item) return;
    if (!session.isPrep && item.type !== "timer") return;
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
    if (!loadFavoriteId() || !programs.some((p) => p.id === loadFavoriteId())) {
      saveFavoriteId(program.id);
    }
    // Na opslaan terug naar home: favoriet centraal, beheer op de achtergrond
    managing = false;
    renderApp();
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
    if (!item) return;
    if (!session.isPrep && item.type !== "timer") return;
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

    if (session.isPrep) {
      startWorkAfterPrep();
      return;
    }

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
      !session.isPrep &&
      timerEl.dataset.phase !== "done" &&
      currentItem()?.type === "timer"
    ) {
      session.lastTs = null;
      if (!session.raf) session.raf = requestAnimationFrame(tick);
    }
  });

  stopBtn.addEventListener("click", () => {
    if (session && timerEl.dataset.phase !== "done") beep("stop");
    endSession(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!session || timerEl.dataset.phase === "done") return;
    enableWorkoutAudio();
    requestWakeLock();
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
})();
