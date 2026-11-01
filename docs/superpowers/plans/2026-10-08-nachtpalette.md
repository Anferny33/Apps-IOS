# Nachtpalette und Tageszeit-Kacheln – Umsetzungsplan

> Umsetzung direkt in der Sitzung, Tests zuerst, Sichtprüfung im Browser-Fenster und im iPhone-Simulator. Spezifikation: `docs/superpowers/specs/2026-10-08-nachtpalette-design.md`.

**Ziel:** Die Startseite und der Radarrahmen folgen nachts einer dunklen Palette, die UV-Kachel wird nachts zu „UV morgen“ mit Mondphase, der Pollenplatz zeigt außerhalb der Saison die Sichtweite.

**Architektur:** Sonnen- und Mondrechnung wandern in eine kleine gemeinsame Datei `sonne.js`, die beide Seiten laden. `design.js` hält den Nachtzustand neben der Aktualität und baut die Detailkacheln bei einem Wechsel leise neu. Die Palette lebt vollständig in Farbtoken unter `html.night` in `modern.css`.

---

### Task 1: Tests zuerst

**Files:** `tests/harness.js`, `tests/smoke-design.js`, `tests/smoke-radar.js`

- [ ] `mockForecast`: `hourly.visibility` (24140 m, 400 m am 26.9. um 05:00 und 06:00) und `hourly.dew_point_2m` (Temperatur minus 3); Sandbox lädt zusätzlich `sonne.js` vor `wetter-core.js`.
- [ ] Design-Suite: Checks für `nightNowAt`, `nightByClock` (Polarfälle), `moonPhase`, Wechsel per `updateNight("2026-09-25T21:00")` samt Kacheln, Zählern und offenem Feld, Rückwechsel, Sicht-Kachel ohne Pollen, Stylesheet-Block, Inline-Skript und Script-Tag in `index.html` und `radar.html`, Versions-Query `20261009a`.
- [ ] Radar-Suite: Sandbox lädt `sonne.js`; `radarNight(ms)` liefert nachts die Klasse auf `documentElement`, tagsüber nicht, ohne Ort nichts.
- [ ] Suiten laufen und schlagen an den neuen Checks fehl.

### Task 2: Gemeinsame Sonnen- und Mondrechnung

**Files:** `sonne.js` (neu), `design.js`, `wetter-core.js`

- [ ] `solarTimes` aus `design.js` nach `sonne.js` verschieben; dazu `solarDecl(dateStr)`, `nightByClock(lat, lon, dateStr, offsetSec, nowMin)` (−8°, Rückfall über −0,833° und Deklinationsvorzeichen) und `moonPhase(date)` (Phase 0–1, Beleuchtung, Name).
- [ ] `fetchForecast`: `hourly` um `visibility,dew_point_2m` ergänzen.

### Task 3: Nachtzustand in design.js

**Files:** `design.js`

- [ ] `nightNowAt(fc, nowIso)` über `lightTimes` mit Rückfall `nightByClock`; `localNowIso(fc)`.
- [ ] Zustand `nightOn`, `lastAir`; `applyNight(on, fade)` setzt die Klasse auf `<html>` (Harness: `body`), merkt `wetter:night`, setzt `theme-color`, blendet mit Klasse `fade` für eine Sekunde; `updateNight(nowIso)` prüft und baut bei Wechsel `renderDetails(fc, lastAir, { swap: true })`, sät die Zähler (`seedCounters`) und öffnet das offene Feld erneut.
- [ ] `renderAllDesign` setzt den Zustand vor `renderDetails` ohne Fade; Minutentakt und `visibilitychange` rufen `updateNight`.
- [ ] `applyDesign` nutzt `updateThemeColor()`.

### Task 4: Tageszeit-Kacheln

**Files:** `design.js`

- [ ] `uvTomorrow(fc)`, `moonIcon(mp)` (Terminator-Ellipse), `visibilityInfo(fc)`, `fogIcon`.
- [ ] `renderDetails(fc, air, opts)`: nachts UV-morgen-Kachel, Sicht-Kachel statt Pollen ohne Chips oder ohne Luftdaten; `opts.swap` gibt den getauschten Kacheln die Klasse `swap`, allen anderen `animation: none`; Luftqualität-Wort mit Klasse `wc-<stufe>` statt Inline-Farbe.
- [ ] `tile()` unterstützt `opts.still` und `opts.swap`.

### Task 5: Stylesheet

**Files:** `modern.css`, `radar.html`

- [ ] Token `--card`, `--soft`, `--line`, `--wet`, `--good-bg` im `:root`; feste Farben in Feldern, Kacheln, Knöpfen, Suchdialog, Stundenspalten, Chips und Rausgehen-Fenstern durch Token ersetzen.
- [ ] Block `html.night` mit allen Token, Hero-Farben je Theme, Bauteil-Regeln (Warnfelder, Skelett, Spuren, Lichtleiste, Verläufe, Schatten), `wc-*`-Farben, Fade-Regeln, Mond- und Nebelsymbol, `.tile.swap`.
- [ ] Radarrahmen: `--card` statt `--white` für Knöpfe, Regler, Zeitpille; `--tl-fc`/`--tl-obs` nachts; Nachtregeln für Beobachtungs-/Prognosefarben.

### Task 6: Seiten und Radar

**Files:** `index.html`, `radar.html`, `radar.js`, `README.md`

- [ ] Inline-Skript im `<head>` beider Seiten: `wetter:night` → Klasse `night` auf `<html>`; `<script src="sonne.js">` vor den App-Skripten; Versions-Query `20261009a`.
- [ ] `radar.js`: `updateNight()` aus `lastKnownPos()` und `nightByClock`, beim Start, jede Minute, bei `visibilitychange`; `theme-color` folgt.
- [ ] README: Zeile zu `sonne.js`, Satz zur Nachtpalette und den Tageszeit-Kacheln.

### Task 7: Prüfung

- [ ] `npm test` grün.
- [ ] Browser-Fenster 390 px: Tagespalette unverändert; `updateNight("…T21:00")` erzwingt Nacht: Kontraste, Hero, Kacheln, Suchdialog, Zeitreise, aufgeklappte Felder; Rückwechsel; Radarseite nachts.
- [ ] Simulator abends (echte Nacht): Startseite und Radar, Statusleistenfarbe, kein Aufblitzen beim Start.
