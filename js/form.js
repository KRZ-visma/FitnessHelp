import {
  programNameInput,
  programRestInput,
  programSwitchInput,
  segmentsEl,
} from "./dom.js";
import { clampInt, uid } from "./util.js";

/** @type {{ type: 'timer'|'reps', name: string, sets: string, duration: string, reps: string }[]} */
let draftItems = [];

/**
 * Safari negeert autocomplete="off" en kiest dan zelf contact-/adresvelden.
 * Custom fh-* tokens voorkomen die heuristiek.
 * @param {HTMLInputElement} input
 * @param {string} token
 */
export function guardSafariAutofill(input, token) {
  input.autocomplete = token;
  input.setAttribute("autocorrect", "off");
  input.spellcheck = false;
}

export function defaultDraftItem(type = "timer") {
  if (type === "reps") {
    return { type: "reps", name: "", sets: "3", duration: "45", reps: "10" };
  }
  return { type: "timer", name: "", sets: "3", duration: "45", reps: "10" };
}

export function resetDraft() {
  draftItems = [defaultDraftItem("timer")];
  programNameInput.value = "";
  programRestInput.value = "15";
  programSwitchInput.value = "15";
  renderSegments();
}

export function addDraftItem(type = "timer") {
  draftItems.push(defaultDraftItem(type));
  renderSegments();
  const last = segmentsEl.querySelector(".segment:last-child .segment-name");
  if (last instanceof HTMLInputElement) last.focus();
}

export function bindDigits(input) {
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "");
    if (input.value !== digits) input.value = digits;
  });
}

export function renderSegments() {
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
    nameInput.name = `fh-exercise-${index}`;
    nameInput.placeholder = "bijv. Push-ups";
    nameInput.maxLength = 60;
    nameInput.setAttribute("autocapitalize", "words");
    nameInput.setAttribute("enterkeyhint", "done");
    nameInput.required = true;
    nameInput.value = item.name;
    guardSafariAutofill(nameInput, "fh-exercise");
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

    const order = document.createElement("div");
    order.className = "segment-order";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "btn btn-ghost segment-move-up";
    upBtn.textContent = "Omhoog";
    upBtn.setAttribute("aria-label", `Onderdeel ${index + 1} omhoog`);
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => moveSegment(index, -1));

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "btn btn-ghost segment-move-down";
    downBtn.textContent = "Omlaag";
    downBtn.setAttribute("aria-label", `Onderdeel ${index + 1} omlaag`);
    downBtn.disabled = index >= draftItems.length - 1;
    downBtn.addEventListener("click", () => moveSegment(index, 1));

    order.append(upBtn, downBtn);

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
    foot.append(order, removeBtn);

    if (draftItems.length > 1) {
      article.append(head, nameField, row, foot);
    } else {
      article.append(head, nameField, row);
    }
    segmentsEl.append(article);
  });
}

/** @param {number} index @param {-1|1} delta */
function moveSegment(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= draftItems.length) return;
  const [item] = draftItems.splice(index, 1);
  draftItems.splice(target, 0, item);
  renderSegments();
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
  input.autocomplete = `fh-${className}`;
  input.required = true;
  input.value = value;
  bindDigits(input);
  input.addEventListener("input", () => onChange(input.value));
  field.append(span, input);
  return field;
}

/** @returns {import('./constants.js').Program | null} */
export function readForm() {
  const name = programNameInput.value.trim();
  if (!name) {
    programNameInput.focus();
    return null;
  }

  const rest = Number(programRestInput.value);
  const switchSec = Number(programSwitchInput.value);
  if (!Number.isFinite(rest) || rest < 0) {
    programRestInput.focus();
    return null;
  }
  if (!Number.isFinite(switchSec) || switchSec < 0) {
    programSwitchInput.focus();
    return null;
  }
  const programRest = clampInt(rest, 0, 600);
  const programSwitch = clampInt(switchSec, 0, 600);

  /** @type {import('./constants.js').ProgramItem[]} */
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
      if (!Number.isFinite(duration) || duration < 1) {
        const input = segmentsEl.querySelector(`[data-index="${i}"] .segment-duration`);
        if (input instanceof HTMLInputElement) input.focus();
        return null;
      }
      items.push({
        type: "timer",
        name: itemName,
        sets: clampInt(sets, 1, 99),
        duration: clampInt(duration, 1, 3600),
        // Bewaar rest per timer-item voor oudere exports / compatibiliteit.
        rest: programRest,
      });
    }
  }

  if (!items.length) return null;
  return { id: uid(), name, rest: programRest, switch: programSwitch, items };
}

/** @param {import('./constants.js').Program} program */
export function fillForm(program) {
  programNameInput.value = program.name;
  programRestInput.value = String(program.rest ?? 15);
  programSwitchInput.value = String(program.switch ?? 15);
  draftItems = program.items.map((item) => {
    if (item.type === "reps") {
      return {
        type: "reps",
        name: item.name,
        sets: String(item.sets),
        duration: "45",
        reps: String(item.reps),
      };
    }
    return {
      type: "timer",
      name: item.name,
      sets: String(item.sets),
      duration: String(item.duration),
      reps: "10",
    };
  });
  if (!draftItems.length) draftItems = [defaultDraftItem("timer")];
  renderSegments();
}
