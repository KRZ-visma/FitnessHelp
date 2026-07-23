# Agent instructions — FitnessHelp

## Project

Browser-only trainingsprogramma: onderdelen met timer (sets/duur/rust) of sets & keer (alleen weergave), countdown of handmatig “Set klaar”, opgeslagen in localStorage.
Live via GitHub Pages vanaf `main` (root). Geen backend, geen build-step.

## Stack (houd zo)

- Vanilla HTML / CSS / JS — géén framework, bundler of TypeScript tenzij expliciet gevraagd
- Native ES-modules (`type="module"`) — géén bundler
- Storage-key: `fitnesshelp-workouts-v1` (niet breken zonder migratie; legacy single-timer workouts samenvoegen tot één programma `{ name: "Mijn training", items[] }`)
- UI-taal: Nederlands

## Bestanden (per domein)

Raak bij een feature **alleen** de relevante module(s). Dat voorkomt merge-conflicten op één groot `app.js`.

| Domein | JS | CSS | Tests |
| --- | --- | --- | --- |
| Opslag / favoriet / migratie | `js/storage.js` | — | `tests/home.spec.js`, `tests/form.spec.js` |
| Formulier / onderdelen | `js/form.js` | `styles/form.css` | `tests/form.spec.js` |
| Timer-sessie | `js/timer.js` | `styles/timer.css` | `tests/timer.spec.js` |
| Home / beheer-shell | `js/shell.js` | `styles/layout.css` | `tests/home.spec.js` |
| Import / export | `js/transfer.js` | `styles/saved.css` | `tests/transfer.spec.js` |
| Geluid | `js/audio.js` | — | `tests/audio.spec.js` |
| PWA | `sw.js`, `manifest.webmanifest` | — | `tests/pwa.spec.js` |
| Wire-up / DOM-refs | `js/main.js`, `js/dom.js`, `js/hooks.js` | — | — |
| Tokens / knoppen | `js/constants.js`, `js/util.js` | `styles/base.css` | — |

Entry: `index.html` → `js/main.js`. `styles.css` importeert alleen de CSS-modules.

## Design

- Behoud bestaand visueel systeem (Archivo + Figtree, sfeer via `.atmosphere`, merk eerst)
- Geen generieke AI-look (paarse gradients, cream+terracotta, broadsheet)
- Timer-flow en setup-flow gescheiden houden; geen dashboard-achtige clutter
- Mobiel eerst: grote touch targets, bruikbaar op iPhone (toetsenbord/autofill/input modes)

## Werkwijze

1. Kleine, gerichte diffs — alleen wat de taak vraagt; **één feature = bij voorkeur één domein-module**
2. Wijzigingen aan timer/formulier/localStorage → Playwright-tests in `tests/` updaten of uitbreiden (juiste `*.spec.js`)
3. Voor PR: `npm ci && npx playwright install chromium && npm test`
4. Geen secrets, analytics of externe APIs toevoegen zonder vraag
5. Commits/PR’s kort en duidelijk; UI-copy altijd Nederlands
6. Bij PWA-assetwijzigingen: `CACHE_NAME` in `sw.js` bump + precache-lijst bijwerken
7. Start/rebase PR’s vanaf recente `main` vóór merge; parallelle PRs die hetzelfde domein raken serialiseren

## Niet doen

- Dependencies of een bundler toevoegen “voor later”
- Alles weer terugzetten in één `app.js`
- localStorage-schema stilzwijgend wijzigen
- Hero/layout omgooien bij een bugfix of kleine feature
