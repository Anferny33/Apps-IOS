# Woher kommt das? – Umsetzungsplan

> Umsetzung direkt in der Sitzung, Tests zuerst. Spezifikation:
> `docs/superpowers/specs/2026-10-09-woher-kommt-das-design.md`.

**Ziel:** Ein Herkunftsblatt mit Quelle, Modell, Gitterpunkt, Rechenwegen und Stand, erreichbar aus der
Aktualitätszeile und aus jedem Instrument-Feld.

**Aufbau:** Datenschicht holt die ICON-D2-Metadaten mit; `renderAllDesign` merkt sich `meta` und `loc`;
`sourceSheetHtml` baut die zehn Abschnitte aus den vorhandenen Daten; ein zweites Bottom-Sheet im Markup.

---

### Aufgabe 1: Tests (`tests/smoke-design.js`, `tests/harness.js`)

- [ ] Harness: `meta.json` in `okFetch` auf `data.meta`; Mock-Vorhersage mit `elevation: 520`.
- [ ] Testdaten `meta` (Lauf 25.09.2026 09:00 UTC, verfügbar 10:20 UTC, alle 3 Stunden).
- [ ] Checks laut Spezifikation; bestehende Aktualitäts-Checks auf `freshTxt`; Zählung der Schaltflächen im Detailbereich auf 6.
- [ ] `npm test` läuft rot.

### Aufgabe 2: Datenschicht (`wetter-core.js`)

- [ ] `fetchModelMeta()`; `ensembleStats` mit `wet`.

### Aufgabe 3: Markup und Stil (`index.html`, `modern.css`)

- [ ] `#fresh` mit `#freshTxt` und Knopf `#freshSrc`; Blatt `#srcBg`/`#src` mit Kopf und `#srcBody`.
- [ ] Sheet-Regeln auf `#sheet`/`#sheetBg` einschränken; Regeln für `src-open`, `.src-link`, `.src-sec`, `.tp-src`, Nacht.

### Aufgabe 4: Darstellung (`design.js`)

- [ ] `updateFreshness` schreibt in `freshTxt`, blendet `freshSrc` ein und aus.
- [ ] `lastMeta`, `lastLoc`; `load()` mit `fetchModelMeta()` und `loc` in der Nutzlast.
- [ ] `sourceSheetHtml`, `openSource`, `closeSource`, `initSource`; Klick-Delegation für `.tp-src`; `tilePanelHtml` mit Schlusszeile.

### Aufgabe 5: Version, Doku, Prüfung

- [ ] Versions-Query `20261009i`; README; `docs/verbesserungen.md`.
- [ ] `npm test` grün; Browser 390 px (Blatt aus Zeile und aus Feld, Nacht); Simulator.
