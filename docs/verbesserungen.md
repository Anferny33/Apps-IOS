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
- [x] Woher kommt das? (1): Herkunftsblatt aus Aktualitätszeile und Instrument-Feldern – 09.10.2026

## Offen, aus den Claude-Prinzipien

- [ ] Eigenes Dashboard (3): Kacheln ausblenden und umsortieren, Reihenfolge gespeichert. Mittel.
- [ ] Tagesfilm (4): zehn Sekunden Animation aus den Tageswerten, morgens als Begrüßung. Groß.
- [ ] Bewegungssystem (5): feste Dauer- und Easing-Stufen, kürzere Startchoreografie (heute gut zwei Sekunden), Neustart nur bei Datenänderung. Mittel.

## Offen, aus anderen Apps

- [ ] Highlights der nächsten Tage (9): ein Satz je auffälligem Ereignis (Temperatursturz, Böen, erster Frost). Mittel.
- [ ] Reise-Ort (10): Ort mit Datum und Countdown, wechselt in die Vorhersage, sobald die Tage im Fenster liegen. Mittel.
- [ ] Verlaufssicht (11): aufklappbares 48-Stunden-Meteogramm mit Temperatur, Regen, Wolkenband und Wind auf einer Achse. Mittel.
- [ ] Regen-Alarm per Push (12): über den Cloudflare-Worker alle 15 Minuten prüfen, Web-Push an die installierte App. Groß.
- [ ] Radar ohne Seitenwechsel (13): Radar als Feld oder Blatt in der Startseite, Blitzortung als Ebene. Groß.

## Offen, Grundlagen

- [ ] Zugänglichkeit (15): Schrift in rem mit Systemskalierung, Kontrastprüfung der Grautöne, Stundenspalten per Tastatur, Textalternative je Diagramm. Mittel.
- [ ] Zwei Spalten ab 760 px (16) für iPad und Mac; bisher kein Breakpoint, Seite bleibt bei 640 px einspaltig. Mittel.
- [ ] Einstellungen (17): Einheiten, Rausgehen-Schwellen, Bewegung, Standardansicht. Mittel.

## Neu aufgenommen

- [x] Vortagswerte im Feld „Woher kommt das?“ als Modellwerte kennzeichnen – mit Punkt 1 erledigt
- [ ] Läufe der Vergleichsmodelle (ICON-EU, ECMWF, GFS, UKMO) im Herkunftsblatt nennen; Open-Meteo hat Metadaten je Modell, nur die des Ensembles sind veraltet. Klein.
