/** @type {string[]} */
const recentBeeps = [];
/** @type {AudioContext | null} */
let audioCtx = null;

/** Zet iOS-audiosessie op media-playback zodat tonen ook bij stil-schakelaar klinken. */
export function enableWorkoutAudio() {
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
export function beep(kind = "tick") {
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
