# Specs und Pläne: Hinweise zum Lesen

Die Dateien unter `specs/` und `plans/` sind datierte Entwurfsdokumente. Sie beschreiben den
Stand ihres Datums und wurden danach nicht nachgeführt; was heute gilt, steht im Code, in der
Git-Historie und in `docs/stand.md`. Beim Lesen bitte beachten:

- Specs und Pläne vom 8. Oktober nennen „beide Designs“, `design.css` und `klassisch.html`.
  Das klassische Glas-Design und `klassisch.html` wurden noch am 8. Oktober 2026 entfernt
  (`0d696b1` entfernt `klassisch.html`, `e331959` entfernt `design.css`); seitdem gibt es nur
  `modern.css` mit Tag- und Nachtpalette.
- Die Kästchen in den Plänen bilden nicht den Umsetzungsstand ab. Zwölf der 15 Pläne haben alle
  Kästchen offen, obwohl ihr Thema umgesetzt ist; nur `restliste`, `rueckkanal` und
  `zugaenglichkeit` wurden nachgeführt. Maßgeblich sind die Commits in der Tabelle unten.
- Maschinenspezifische Werte gelten nur für den Rechner des Autors: der Pfad `~/Projekte/Apps-IOS`,
  die Simulator-UDID und `sed -i ''` (macOS-Form) in den Zeitreise-Plänen, `xcrun simctl … <udid>`
  in der Zugänglichkeits-Spec.
- Die Restliste-Spec und ihr Plan sagen „ohne Commit“; der Durchgang wurde später doch als
  `3b77f9c` committet.

## Übersicht

Dateinamen ohne das Datumspräfix: die Spec liegt unter `specs/<Datum>-<Name>.md`, der Plan unter
`plans/<Datum>-<Name>.md`. Reihenfolge nach Entstehung in der Historie.

| Datum | Thema | Spec | Plan | Umgesetzt in |
|---|---|---|---|---|
| 8. Okt. | Zeitreise, Stufe 1: Stunde antippen, Hero zeigt die Stunde | `zeitreise-design` | `zeitreise` | `6c131a2`, `341aded`, `3f08430`, `0ccc4ef` |
| 8. Okt. | Zeitreise, Stufe 2: Ziehen vom Griff durch die Stunden | `zeitreise-stufe2-design` | `zeitreise-stufe2` | `3299b1f`, `b38c4f7` |
| 8. Okt. | Rausgehen: Aktivitätsfenster | `rausgehen-design` | `rausgehen` | `dd5f6d6`, `fa2b66d`, `2fa41b2`; Zeile mit vier Feldern später `1a5e19c`, `95768e4` |
| 8. Okt. | Modellunsicherheit: Summenkurven, Ensemble-Band, Spanne | `modellunsicherheit-design` | `modellunsicherheit` | `8b78cac`, `bc10c8d`, `471f68e`, `f62a2b6` |
| 8. Okt. | Regenpausen in der Nowcast-Karte | `regenpausen-design` | `regenpausen` | `0889465`, `abbe30a` |
| 8. Okt. | Kacheln, die sich zu Instrumenten entfalten | `kacheln-design` | `kacheln` | `8e5b615`, `5dc372f`, `b55ccc0` |
| 8. Okt. | Abendmodus: goldene und blaue Stunde | `abendmodus-design` | – | `4ab5aa3` |
| 8. Okt. | Nachtpalette und Tageszeit-Kacheln | `nachtpalette-design` | `nachtpalette` | `dd3a361`; Nebelrisiko und Sichtverlauf später `fa34f4b` |
| 8. Okt. | Tag/Nacht-Schalter und Offline-Hülle | `nachtschalter-offline-design` | `nachtschalter-offline` | `e331959` |
| 8. Okt. (Datei), committet 9. Okt. | Ansicht nach Frage: Chips Überblick, Regen, Wind, Wärme, Licht | `ansicht-nach-frage-design` | `ansicht-nach-frage` | `a38e87a` |
| 9. Okt. | Schirm-Schwelle und Vergleich mit gestern | `schirm-gestern-design` | `schirm-gestern` | `e11cd5b` |
| 9. Okt. | Woher kommt das? Herkunftsblatt | `woher-kommt-das-design` | `woher-kommt-das` | `99a5e13` |
| 9. Okt. | Highlights der nächsten Tage | `highlights-design` | `highlights` | `dbd3723` |
| 9. Okt. | Zugänglichkeit in fünf Stufen | `zugaenglichkeit-design` | `zugaenglichkeit` | `6c47c99` (Stufe 1), `e38e0c5` (Stufen 2 bis 5) |
| 9. Okt. | Restliste: Einstellungen, Dashboard, Reise, Verlauf, Radar-Blatt, Regen-Alarm, Tagesfilm, Bewegung, zwei Spalten | `restliste-design` | `restliste` | `3b77f9c`; Probenachricht `61261d1` |
| 9. Okt. | VoiceOver-Durchlauf: Befund und Korrekturen | `voiceover-durchlauf-design` | – | `0e7bf6e` |
| 9. Okt. | Rückkanal für Tester | `rueckkanal-design` | `rueckkanal` | `402a367` |
