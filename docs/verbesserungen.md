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

## Erledigt am 9. Oktober 2026 (eigenständiger Durchgang, noch nicht committet)

- [x] Eigenes Dashboard (3): Startseite anpassen in den Einstellungen
- [x] Tagesfilm (4): Zeichenfläche, Begrüßung, Aufnahme und Teilen auf dem Gerät
- [x] Bewegungssystem (5): Kurve, drei Stufen, Startchoreografie ×0,6, kein Neustart beim Antippen
- [x] Reise-Ort (10)
- [x] Verlaufssicht (11): Meteogramm 48 h
- [x] Regen-Alarm per Push (12): Code fertig, Deployment und KV-Namespace stehen aus
- [x] Radar ohne Seitenwechsel (13): Blatt mit eingebetteter Radarseite; Blitzortung entfällt (keine freie Quelle ohne Dienst)
- [x] Zwei Spalten ab 760 px (16)
- [x] Einstellungen (17)
- [x] Läufe der Vergleichsmodelle im Herkunftsblatt
- [x] Highlights im Herkunftsblatt erklärt
- [x] Text in SVG-Grafiken folgt der Systemschrift

## Offen, aus den Claude-Prinzipien


## Offen, aus anderen Apps


- [x] Zugänglichkeit (15), in fünf Stufen.
  - [x] Stufe 1: Schrift folgt der Systemgröße (rem, Dynamic Type, Deckel 1,6-fach, große Zahlen begrenzt) – `6c47c99`
  - [x] Stufe 2: Stundenspalten als Schaltflächen mit Satz je Stunde, Pfeiltasten, Zeitreise per Tastatur – `e38e0c5`
  - [x] Stufe 3: Textalternative je Diagramm (Regenbalken, Böen, Regen- und Sichtverlauf, Sonnenbogen, Modellkurven, Tageszeilen) – `e38e0c5`
  - [x] Stufe 4: Kontrast der Nebentexte auf getönten Flächen, nachts in dunklen Feldern, windig-Grün, Warnwort; Checks rechnen aus den Token – `e38e0c5`
  - [x] Stufe 5: Live-Region für Laden, Fehler, Ansichtswechsel, Zeitreise, Nachtmodus – `e38e0c5`

## Neu aufgenommen

- [ ] Füllungen im Stundenstreifen (Regen, Böen, Sonne) liegen unter 3:1 zum Grund. Geprüft am 09.10.2026: 3:1 verlangt dunkle Füllungen, auf denen die farbigen Stundentexte ihren Kontrast verlieren. Bleibt eine Designfrage für den User.
- [ ] VoiceOver-Durchlauf auf einem echten iPhone; der Simulator hat kein VoiceOver. Klein.
- [ ] Regen-Alarm in Betrieb nehmen: KV-Namespace anlegen, privaten VAPID-Schlüssel als Geheimnis setzen, Worker deployen (`proxy/README.md`); erst dann lässt sich der Alarm auf dem iPhone end-to-end prüfen.
- [ ] Aufnahme des Tagesfilms auf dem echten iPhone als Homescreen-App prüfen (im Simulator-Safari geht das Teilen-Blatt nicht auf).
- [x] Vortagswerte im Feld „Woher kommt das?“ als Modellwerte kennzeichnen – mit Punkt 1 erledigt
