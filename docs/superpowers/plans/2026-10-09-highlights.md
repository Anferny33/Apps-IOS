# Highlights der nächsten Tage – Umsetzungsplan

> Umsetzung direkt in der Sitzung, Tests zuerst. Spezifikation:
> `docs/superpowers/specs/2026-10-09-highlights-design.md`.

**Ziel:** Feld „Nächste Tage“ mit bis zu drei regelbasierten Highlights der nächsten sieben Tage.

**Aufbau:** `dayHighlights(fc)` sammelt Kandidaten aus den Tageswerten, `pickHighlights` wählt drei,
`highlightsHtml`/`renderHighlights` bauen das Feld, `jumpToDay` springt in die Tagesliste.

---

### Aufgabe 1: Tests (`tests/smoke-design.js`)

- [ ] Kandidaten und Auswahl am Mock; Frost-, Sturm-, Schnee-, Nebel-, Hitze-, Sonnen-Fälle mit
      angepassten Tageswerten; Zeitraum-Beschriftung; leerer Zustand; Markup; Tipp auf Tag 7.
- [ ] Bestehenden Check der aufklappbaren Zeilen an `data-day` anpassen.
- [ ] `npm test` läuft rot.

### Aufgabe 2: Darstellung (`design.js`)

- [ ] `HL_PRIO`, `dayHighlights`, `pickHighlights`, `hlLabel`, `highlightsHtml`, `renderHighlights`, `jumpToDay`.
- [ ] `renderDays`: `data-day` an jeder Zeile. `renderAllDesign` ruft `renderHighlights`.
- [ ] Klick-Delegation für `.hl-row`.

### Aufgabe 3: Markup und Stil (`index.html`, `modern.css`)

- [ ] Feld `#highlightsField` mit `#highlights` nach dem Rausgehen-Feld.
- [ ] `.hl-row`, `.hl-day`, `.hl-txt`, `.hl-none`, `.drow.flash` mit Aufleuchten, Nacht.

### Aufgabe 4: Version, Doku, Prüfung

- [ ] Versions-Query `20261009j`; README; `docs/verbesserungen.md`.
- [ ] `npm test` grün; Browser 390 px (Feld, Tipp springt zum Tag, Nacht); Simulator.
