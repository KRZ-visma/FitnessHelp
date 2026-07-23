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
| Opslag / favoriet / migratie | `js/storage.js` | — | `tests/home.spec.js`, `tests/transfer.spec.js` |
| Formulier / onderdelen / rust+wissel | `js/form.js` | `styles/form.css` | `tests/form.spec.js` |
| Timer-sessie (prep/rust/wissel) | `js/timer.js` | `styles/timer.css` | `tests/timer.spec.js` |
| Home / beheer-shell / footer-versie | `js/shell.js`, `js/constants.js` (`APP_VERSION`) | `styles/layout.css` | `tests/home.spec.js`, `tests/form.spec.js` |
| Import / export | `js/transfer.js` | `styles/saved.css` | `tests/transfer.spec.js` |
| Geluid | `js/audio.js` | — | `tests/audio.spec.js` |
| PWA | `sw.js`, `manifest.webmanifest` | — | `tests/pwa.spec.js` |
| Wire-up / DOM-refs | `js/main.js`, `js/dom.js`, `js/hooks.js` | — | — |
| Tokens / knoppen | `js/util.js` | `styles/base.css` | — |

Entry: `index.html` → `js/main.js`. `styles.css` importeert alleen de CSS-modules.

## Design

- Behoud bestaand visueel systeem (Archivo + Figtree, sfeer via `.atmosphere`, merk eerst)
- Geen generieke AI-look (paarse gradients, cream+terracotta, broadsheet)
- Timer-flow en setup-flow gescheiden houden; geen dashboard-achtige clutter
- **Primair doelapparaat: iPhone 16 Pro (Safari)** — mobiel eerst; grote touch targets; toetsenbord/autofill/input modes; safe areas (Dynamic Island, home indicator); geluid ook met stille schakelaar

## Werkwijze

1. Kleine, gerichte diffs — alleen wat de taak vraagt; **één feature = bij voorkeur één domein-module**
2. Wijzigingen aan timer/formulier/localStorage → Playwright-tests in `tests/` updaten of uitbreiden (juiste `*.spec.js`)
3. Voor PR: `npm ci && npx playwright install chromium && npm test` moet **slagen**. De GitHub Action **Playwright** op de PR is verplicht groen vóór merge; bij falen eerst fixen en opnieuw pushen
4. UI-, formulier-, timer- of PWA-wijzigingen: verifieer op **iPhone 16 Pro**-formaat (viewport ≈ 393×852, DPR 3) — layout, touch, Safari-toetsenbord/autofill, safe areas; gebruik waar mogelijk browser-/device-emulatie of handmatige check, en leg in de PR kort vast dat dit is nagelopen
5. Geen secrets, analytics of externe APIs toevoegen zonder vraag
6. Commits/PR’s kort en duidelijk; UI-copy altijd Nederlands
7. Bij user-facing wijzigingen (UI, timer, formulier, opslag-gedrag, PWA): bump `APP_VERSION` in `js/constants.js` (semver: patch = fix, minor = feature). Niet bumpen bij docs-/test-/AGENTS-only. Raak `EXPORT_VERSION` / `STORAGE_KEY` niet aan tenzij het schema echt wijzigt
8. Bij PWA-assetwijzigingen: `CACHE_NAME` in `sw.js` bump + precache-lijst bijwerken
9. Start/rebase PR’s vanaf recente `main` vóór merge; parallelle PRs die hetzelfde domein raken serialiseren
10. Zet de pull request op **ready for review** (niet als draft laten staan) zodra de wijziging klaar is voor review — en wacht tot de Playwright-check groen is

## Niet doen

- Dependencies of een bundler toevoegen “voor later”
- Alles weer terugzetten in één `app.js`
- localStorage-schema stilzwijgend wijzigen
- Hero/layout omgooien bij een bugfix of kleine feature
- Mergen terwijl de Playwright-check faalt of nog loopt
