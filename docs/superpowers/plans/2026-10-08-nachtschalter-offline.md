# Tag/Nacht-Schalter und Offline-Hülle – Umsetzungsplan

> Umsetzung direkt in der Sitzung, Tests zuerst. Spezifikation: `docs/superpowers/specs/2026-10-08-nachtschalter-offline-design.md`.

### Task 1: Tests
- [ ] `tests/smoke-design.js`: Umschalter-Checks durch Schalter-Checks ersetzen (Tipp, Rücktipp, Verfall beim automatischen Wechsel, Symbol/`aria-pressed`), Shell-Checks ohne `design.css`, `designVeil`, `designLink`, mit `modeBtn` und `sw.js`-Registrierung, Versions-Query `20261009b` (Startseite 4, Radar 3 Links).
- [ ] `tests/smoke-radar.js`: Design-Wechsel-Check durch Schalter-Check ersetzen; Speicher-Stub bekommt `removeItem`.
- [ ] Neu `tests/smoke-sw.js` mit Sandbox für `self`, `caches`, `fetch`; `package.json` nimmt die Suite auf.

### Task 2: Schalter und Rückbau
- [ ] `sonne.js`: `readNightMode`, `writeNightMode`, `clearNightMode`, `resolveNight(auto)`, Symbole und `paintModeButton`.
- [ ] `design.js`: `applyDesign`, `initDesignToggle`, `initParticles` entfernen; `lastAuto`, `settleNight`, `setNightManual`, `initModeToggle`; `applyNight` zeichnet den Knopf; `updateThemeColor` ohne klassisch.
- [ ] `radar.js`: klassische Palette, `applyDesign`, `currentDesign`, `design` entfernen; `radarNight` nutzt `resolveNight`, `radarToggleMode`, Knopf-Bindung.
- [ ] Seiten: klassische Links, Inline-Skripte, `data-design`, Himmel, Schleier, Fußzeilen-Link raus; Knopf `modeBtn`; `modern.css` ohne `.sky`/`.design-veil`; `design.css` löschen; Werkzeuge und README anpassen.

### Task 3: Offline-Hülle
- [ ] `sw.js` mit Versionskonstante, Hüllenliste, Install/Activate/Fetch wie in der Spezifikation.
- [ ] Registrierung am Ende beider Seiten.

### Task 4: Prüfung
- [ ] `npm test` grün (drei Suiten).
- [ ] Browser: Knopf schaltet mit Fade, Zustand überlebt Neuladen, Automatik greift nach Sonnenwechsel; Service Worker registriert, Hülle im Cache; Server stoppen, neu laden: Seite erscheint mit gespeicherten Daten; Server wieder starten.
- [ ] Simulator: Schalter auf Start- und Radarseite.
