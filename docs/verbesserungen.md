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

## Erledigt am 9. Oktober 2026 (eigenständiger Durchgang, Commit `3b77f9c`)

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

- [x] Füllungen im Stundenstreifen: Entscheidung des Users am 09.10.2026, sie bleiben wie sie sind; die Zahl trägt die Information.
- [x] VoiceOver-Durchlauf (09.10.2026) ohne Gerät: Bedienungshilfen-Baum per XCUITest aus dem Simulator (`tests/ax-dump/run.sh`); neun Befunde korrigiert, siehe `docs/superpowers/specs/2026-10-09-voiceover-durchlauf-design.md`
- [ ] Ansichten-Chips als Tab-Leiste (role tablist/tab, „1 von 5“) statt Druckknöpfe. Klein, Designfrage.
- [ ] Tageszeilen sprechen als „Bild“ (role img); Alternative role text prüfen. Klein.
- [ ] Mittelpunkt-Trenner („·“) in Kacheltexten: auf dem echten iPhone hören, ob VoiceOver sie vorliest. Prüfpunkt.
- [ ] Stundenstreifen: 48 Schaltflächen am Stück; Sprungmarke oder Zusammenfassung, falls es beim Wischen stört. Klein.
- [ ] Gegencheck mit echtem VoiceOver (Wischen, Rotor) auf dem iPhone, wenn es passt. Klein.
- [x] Regen-Alarm in Betrieb genommen (09.10.2026): KV-Namespace SUBS, Geheimnis VAPID_PRIVATE_KEY, Worker deployt mit Cron */15 und Testroute `/push/test`
- [x] Regen-Alarm auf dem iPhone geprüft: Probenachricht angekommen (09.10.2026); der erste Schlüssel-Upload hatte einen Zeilenumbruch, der Worker schneidet das jetzt selbst ab
- [x] Tagesfilm samt Aufnahme auf dem echten iPhone geprüft (09.10.2026)
- [x] Vortagswerte im Feld „Woher kommt das?“ als Modellwerte kennzeichnen – mit Punkt 1 erledigt
