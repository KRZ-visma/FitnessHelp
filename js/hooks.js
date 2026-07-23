/**
 * Late-bound callbacks so modules kunnen samenwerken zonder circulaire imports.
 * main.js vult deze na het laden van alle modules.
 */
export const hooks = {
  /** @type {() => void} */
  renderApp: () => {},
  /** @param {import('./constants.js').Program} program */
  fillForm: (_program) => {},
  /** @param {import('./constants.js').Program} program */
  startSession: (_program) => {},
};
