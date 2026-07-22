# Agent instructions — FitnessHelp

## Project

Browser-only trainingsprogramma: onderdelen met timer (sets/duur/rust) of sets & keer (alleen weergave), countdown of handmatig “Set klaar”, opgeslagen in localStorage.
Live via GitHub Pages vanaf `main` (root). Geen backend, geen build-step.

## Stack (houd zo)

- Vanilla HTML / CSS / JS — géén framework, bundler of TypeScript tenzij expliciet gevraagd
- Bestanden: `index.html`, `app.js`, `styles.css`
- Storage-key: `fitnesshelp-workouts-v1` (niet breken zonder migratie; legacy single-timer workouts normaliseren naar `{ name, items[] }`)
- UI-taal: Nederlands

## Design

- Behoud bestaand visueel systeem (Archivo + Figtree, sfeer via `.atmosphere`, merk eerst)
- Geen generieke AI-look (paarse gradients, cream+terracotta, broadsheet)
- Timer-flow en setup-flow gescheiden houden; geen dashboard-achtige clutter
- Mobiel eerst: grote touch targets, bruikbaar op iPhone (toetsenbord/autofill/input modes)

## Werkwijze

1. Kleine, gerichte diffs — alleen wat de taak vraagt
2. Wijzigingen aan timer/formulier/localStorage → Playwright-tests in `tests/` updaten of uitbreiden
3. Voor PR: `npm ci && npx playwright install chromium && npm test`
4. Geen secrets, analytics of externe APIs toevoegen zonder vraag
5. Commits/PR’s kort en duidelijk; UI-copy altijd Nederlands

## Niet doen

- Dependencies toevoegen “voor later”
- localStorage-schema stilzwijgend wijzigen
- Hero/layout omgooien bij een bugfix of kleine feature
