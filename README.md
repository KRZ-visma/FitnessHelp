# FitnessHelp

Simpele browser-tool om een trainingsprogramma samen te stellen: onderdelen met countdown-timer of alleen sets & keer.

## Functies

- Programma met meerdere onderdelen
- **Algemene rust** tussen sets (voor timer én sets & keer)
- **Wisseltijd** tussen oefeningen
- Onderdeeltype **Timer**: sets en duur per set
- Onderdeeltype **Sets & keer**: alleen weergave van sets en herhalingen (geen aftellen)
- Training met pauze/overslaan (timer) of “Set klaar” (sets & keer)
- Opgeslagen programma’s in **localStorage** (blijft in jouw browser)
- Oude opgeslagen oefeningen worden automatisch samengevoegd tot één programma (“Mijn training”)
- **Exporteren / importeren** van programma’s als JSON-bestand
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
