# Zugänglichkeit – Umsetzungsplan

> Umsetzung direkt in der Sitzung, Tests zuerst, eine Stufe je Commit. Spezifikation:
> `docs/superpowers/specs/2026-10-09-zugaenglichkeit-design.md`.

### Stufe 1: Schrift folgt der Systemgröße (`modern.css`, `index.html`, `radar.html`, Tests)

- [x] Tests: Grundregel und WebKit-Zweig, nur SVG-Text in Pixeln, Deckel großer Zahlen, Zeilenhöhen
      ohne Pixel, Mindesthöhen, Textspalten in rem, Radarseite ohne Pixel, Kopfskript mit Deckel.
- [x] Stylesheet: Grundregel, Umrechnung aller Schriftgrößen, `min(rem, vw)` für große Zahlen,
      Zeilenhöhen, Mindesthöhen, Textspalten; Kacheltitel umbrechen, Wort neben dem Wert.
- [x] Radarseite umrechnen, Kopfskript mit Deckel auf beiden Seiten.
- [x] Prüfung: Browser bei 22 px und 27,2 px ohne Überlauf, Simulator mit XXX-Large.
- [x] Versions-Query `20261009k`, README, Checkliste.

### Stufe 2: Stundenspalten (`design.js`, `modern.css`, Tests)

- [ ] Spalten als `<button>` mit `aria-label`, Pfeiltasten im Streifen, Fokusring, Zeitreise per Tastatur.

### Stufe 3: Textalternative je Diagramm (`design.js`, Tests)

- [ ] Beschreibender Satz je Grafik als `aria-label` oder verborgener Text, Grafiken `aria-hidden`.

### Stufe 4: Kontrast (`modern.css`, Tests)

- [ ] Kontrast der getönten Flächen messen, Token nachziehen, Checks auf die Werte.

### Stufe 5: Rückmeldungen (`index.html`, `design.js`, Tests)

- [ ] Live-Region, Ansagen bei Laden, Aktualisieren, Fehler, Ansichtswechsel.
