# FitnessHelp

Simpele browser-tool om sets en duur (in seconden) te plannen, met een countdown-timer.

## Functies

- Oefening, aantal sets, duur per set, rust tussen sets
- Timer met pauze, overslaan en stop
- Opgeslagen oefeningen in **localStorage** (blijft in jouw browser)
- Installeerbaar als **PWA** (manifest + service worker; offline basisassets)

## Lokaal openen

Open `index.html` in je browser, of start een simpele server:

```bash
python3 -m http.server 8080
```

Ga naar `http://localhost:8080`.

## GitHub Pages

In de repo: **Settings → Pages → Source: Deploy from a branch**, kies `main` en `/ (root)`.

Live: https://krz-visma.github.io/FitnessHelp/

## Tests

Playwright-tests draaien lokaal en via GitHub Actions op elke push/PR:

```bash
npm install
npx playwright install chromium
npm test
```
