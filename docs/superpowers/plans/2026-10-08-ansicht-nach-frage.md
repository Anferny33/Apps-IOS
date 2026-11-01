# Ansicht nach Frage – Umsetzungsplan

> Umsetzung direkt in der Sitzung, Tests zuerst. Spezifikation: `docs/superpowers/specs/2026-10-08-ansicht-nach-frage-design.md`.

### Task 1: Tests
- [ ] `tests/smoke-design.js`: Chips (5, Überblick gedrückt), `setView` je Ansicht mit Prüfung von Spaltenwerten, Füllklassen, Zeilen, Kopfzeile, Notiz und Antwortsatz; Rückkehr zum Überblick; gespeicherte Ansicht beim Start; Grenzfälle der Sätze über Varianten der Mock-Daten; Shell-Checks für `views`, `viewAnswer`, `hourlyNote`, `daysHint` und Nacht-Token.

### Task 2: Zustand und Chips
- [ ] `design.js`: `VIEWS`, `view`, `loadView`/`saveView`, `renderViews()` in `#views`, `setView(id)` (merken, Chips, Streifen und Liste leise neu bauen, Satz, Notiz, Kopfzeile, Ring erneut markieren, Rausgehen-Spur erneut färben, Überblendklasse).
- [ ] `index.html`: Chip-Zeile, `#viewAnswer` im Stundenfeld, `#hourlyNote`, `#daysHint`.

### Task 3: Streifen und Liste
- [ ] `dHourly(fc, ens, opts)`: Spaltenbauer je Ansicht (`hourColumn`), Pfeilsymbol, Füllungen, Tönungsklassen, `opts.quiet` ohne Einblendung.
- [ ] `renderDays(fc, opts)`: Zeilenbauer je Ansicht, Feldklasse `v-<ansicht>`, Kopfzeile, `opts.quiet`.

### Task 4: Antwortsätze
- [ ] `answerRain`, `answerWind`, `answerWarm`, `answerLight`, `viewAnswer(view)`, `viewNote(view)`.

### Task 5: Stylesheet
- [ ] `modern.css`: `.views`/`.view-chip`, `.answer`, Pfeil, `wfill`, `windy`, `tc1…tc5`, `lfill`, `dark`, Balkenfarben je Feldklasse, Überblendung `.swap`, Nacht-Token.

### Task 6: Prüfung
- [ ] `npm test` grün; Browser 390 px: alle fünf Ansichten tags und nachts, Zeitreise mit Ring in einer anderen Ansicht, Neuladen behält die Ansicht; Simulator: Chips und Streifen.
