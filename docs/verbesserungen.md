# Verbesserungen – Checkliste

Stand: 9. Oktober 2026. Quelle: UI/UX-Durchsicht vom 8. Oktober (17 Ideen) plus Beobachtungen
und neue Ideen aus der Arbeit. Nach jeder Änderung wird die Liste nachgezogen und im Bericht ausgegeben.

## Erledigt

- [x] Nachtpalette (6) – `dd3a361`
- [x] Tageszeit-Kacheln (7): UV morgen, Sicht statt Pollen – `dd3a361`; Nebelrisiko und Sichtverlauf – `fa34f4b`
- [x] Offline-Hülle per Service Worker (14) – `e331959`
- [x] Tag-Nacht-Schalter statt Palettenknopf – `e331959`
- [x] Ansicht nach Frage (2) – `a38e87a`
- [x] Rausgehen-Zeile mit vier Feldern und Piktogrammen – `1a5e19c`, `95768e4`
- [x] Schirm-Schwelle: Rat in drei Stufen nach Menge, Intensität und Risiko – `e11cd5b`
- [x] Vergleich mit gestern (8) als vierter Hero-Chip – `e11cd5b`
- [x] Woher kommt das? (1): Herkunftsblatt aus Aktualitätszeile und Instrument-Feldern – `99a5e13`
- [x] Highlights der nächsten Tage (9): Feld „Nächste Tage“ mit bis zu drei Regel-Highlights – `dbd3723`

## Offen, aus den Claude-Prinzipien

- [ ] Eigenes Dashboard (3): Kacheln ausblenden und umsortieren, Reihenfolge gespeichert. Mittel.
- [ ] Tagesfilm (4): zehn Sekunden Animation aus den Tageswerten, morgens als Begrüßung, teilbar als Video. Groß. Entscheidung 09.10.2026: bleibt offen, wenn, dann vollständig mit Videoaufnahme; Bedingung: kostenlos, alles auf dem Gerät, keine API oder Dienste.
- [ ] Bewegungssystem (5): feste Dauer- und Easing-Stufen, kürzere Startchoreografie (heute gut zwei Sekunden), Neustart nur bei Datenänderung. Mittel.

## Offen, aus anderen Apps

- [ ] Reise-Ort (10): Ort mit Datum und Countdown, wechselt in die Vorhersage, sobald die Tage im Fenster liegen. Mittel.
- [ ] Verlaufssicht (11): aufklappbares 48-Stunden-Meteogramm mit Temperatur, Regen, Wolkenband und Wind auf einer Achse. Mittel.
- [ ] Regen-Alarm per Push (12): über den Cloudflare-Worker alle 15 Minuten prüfen, Web-Push an die installierte App. Groß.
- [ ] Radar ohne Seitenwechsel (13): Radar als Feld oder Blatt in der Startseite, Blitzortung als Ebene. Groß.

## Offen, Grundlagen

- [x] Zugänglichkeit (15), in fünf Stufen.
  - [x] Stufe 1: Schrift folgt der Systemgröße (rem, Dynamic Type, Deckel 1,6-fach, große Zahlen begrenzt) – `6c47c99`
  - [x] Stufe 2: Stundenspalten als Schaltflächen mit Satz je Stunde, Pfeiltasten, Zeitreise per Tastatur – 09.10.2026
  - [x] Stufe 3: Textalternative je Diagramm (Regenbalken, Böen, Regen- und Sichtverlauf, Sonnenbogen, Modellkurven, Tageszeilen) – 09.10.2026
  - [x] Stufe 4: Kontrast der Nebentexte auf getönten Flächen, nachts in dunklen Feldern, windig-Grün, Warnwort; Checks rechnen aus den Token – 09.10.2026
  - [x] Stufe 5: Live-Region für Laden, Fehler, Ansichtswechsel, Zeitreise, Nachtmodus – 09.10.2026
- [ ] Zwei Spalten ab 760 px (16) für iPad und Mac; bisher kein Breakpoint, Seite bleibt bei 640 px einspaltig. Mittel.
- [ ] Einstellungen (17): Einheiten, Rausgehen-Schwellen, Bewegung, Standardansicht. Mittel.

## Neu aufgenommen

- [ ] Füllungen im Stundenstreifen (Regen, Böen, Sonne) liegen unter 3:1 zum Grund; die Zahl trägt die Information, eine kräftigere Füllung wäre eine Designfrage. Klein.
- [ ] VoiceOver-Durchlauf auf einem echten iPhone; der Simulator hat kein VoiceOver. Klein.
- [ ] Text in SVG-Grafiken (Kompass, Sonnenbogen, Modellkurven) folgt der Systemschrift noch nicht; braucht eine eigene Skalierung der Grafiken. Klein.
- [x] Vortagswerte im Feld „Woher kommt das?“ als Modellwerte kennzeichnen – mit Punkt 1 erledigt
- [ ] Läufe der Vergleichsmodelle (ICON-EU, ECMWF, GFS, UKMO) im Herkunftsblatt nennen; Open-Meteo hat Metadaten je Modell, nur die des Ensembles sind veraltet. Klein.
- [ ] Highlights im Herkunftsblatt erklären (Regeln und Schwellen), passt zu „Woher kommt das?“. Klein.
