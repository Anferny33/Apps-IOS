# Schirm-Schwelle und Vergleich mit gestern – Umsetzungsplan

> Umsetzung direkt in der Sitzung, Tests zuerst. Spezifikation:
> `docs/superpowers/specs/2026-10-09-schirm-gestern-design.md`.

**Ziel:** Abgestufter Regen-Rat im Hinweisfeld und ein Hero-Chip mit dem Temperaturvergleich zu gestern.

**Aufbau:** Datenschicht (`wetter-core.js`) holt den Vortag mit und trennt ihn als `fc.past` ab;
Darstellung (`design.js`) rechnet Rat und Vergleich daraus. Keine CSS-Änderung nötig.

---

### Aufgabe 1: Tests schreiben (`tests/smoke-design.js`)

- [ ] `splitPastDay`: Vortag mit 24 Stunden, 96 Viertelstunden, einem Tag; danach beginnen alle
      Blöcke mit heute, `past` hält den Rest. Vortag mit 23 Stunden. Ohne Vortag kein `past`.
- [ ] `yesterdayText`: 2° wärmer, 3° kälter, „Wie gestern“, Interpolation 23:30 über Mitternacht, ohne Vortag `null`.
- [ ] Hero: Chip „2° wärmer als gestern“ im Jetzt-Zustand, nicht in der Vorschau. Abfrage-URL mit `past_days=1`.
- [ ] `umbrellaAdvice`: Stufen 0/1/2, Vorsicht bei Risiko unter 30 %, Symbole; Rendern im Hinweisfeld
      (Tropfen-Symbol, ruhiger Schirm, animierter Schirm).
- [ ] `npm test` läuft rot an den neuen Checks.

### Aufgabe 2: Datenschicht (`wetter-core.js`)

- [ ] `fetchForecast`: `past_days: 1`, Ergebnis durch `splitPastDay`.
- [ ] `splitPastDay(fc)`: Grenze `fc.current.time.slice(0, 10)`, `firstIndexFrom` je Block, Arrays teilen.

### Aufgabe 3: Darstellung (`design.js`)

- [ ] `prevDay`, `yesterdayTemp(fc)`, `yesterdayText(fc)`; `nowFacts` liefert `yday`; `heroChipsHtml` hängt den Chip an (Verzögerung 0,74 s).
- [ ] `nowcastProb(fc, data)`, `umbrellaAdvice(nc, fc, data)`; `renderHero` nutzt Text und Symbol daraus.

### Aufgabe 4: Version, Doku, Prüfung

- [ ] Versions-Query `20261009h` in `index.html`, `radar.html`, `sw.js`, beiden Tests.
- [ ] README und `docs/verbesserungen.md` nachziehen.
- [ ] `npm test` grün; Browser-Fenster (390 px, Tag und Nacht) und Simulator: Chip im Hero, Hinweisfeld.
