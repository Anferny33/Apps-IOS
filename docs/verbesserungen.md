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
- [x] Regen-Alarm per Push (12): Code fertig; Worker am selben Tag mit KV-Namespace und Schlüssel deployt und unter `wetter-nina-proxy.anferny-wetter.workers.dev` in Betrieb (siehe unten, 09.10.2026)
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
- [x] Rückkanal für Tester (09.10.2026): Blatt „Rückmeldung“ in Fußzeile und Einstellungen, Worker-Routen mit KV `FEEDBACK`, `proxy/feedback.sh`; Spezifikation `docs/superpowers/specs/2026-10-09-rueckkanal-design.md`
- [ ] Tägliche geplante Aufgabe, die neue Rückmeldungen sichtet, sobald mehrere Tester aktiv sind. Klein.
- [x] Dauer-Animationen (11.10.2026): Endlosschleifen halten außerhalb des Bilds, bei verborgener Seite und unter dem Tagesfilm an (`--loop-play`, IntersectionObserver); im Simulator fällt der Seitenprozess im Bereich ohne Loops von 30 bis 100 % auf 0 % CPU. Auf dem Gerät Akku gelegentlich gegenprüfen.
- [ ] Namensrecherche (11.10.2026) liegt in `docs/namen-recherche.md`; Entscheidung des Users steht aus (Phase 1 der Veröffentlichungs-Checkliste).

## Rückmeldungen aus der Testrunde

Einträge aus `proxy/feedback.sh`, je mit Einschätzung und Vorschlag; Umsetzung nach Freigabe je Punkt.

- [x] 09.10.2026, Idee (iPhone, Homescreen-App, Version q): „Mehr Farbschemata nach dem Buch ‚A Dictionary of Color Combinations‘ (Sanzo Wada)“. Umgesetzt in der Cloud-Session als Einstellung „Farbschema“ mit Nil (`09bfbf8`), Ocker (`e797f5a`) und Zitrone (`c9dc385`), live seit `20261011d`. Einschätzung: machbar ohne Dienst; die 348 Kombinationen des Buchs liegen als freie Daten vor, Farben selbst sind nicht geschützt. Vorschlag: Einstellung „Farbschema“ mit Standard plus drei bis fünf Wada-Kombinationen, je auf die Token (Grund, Karte, Tinte, Hero, Dunkel, Regen, Windig) abgebildet, Nachtvariante abgeleitet, Kontrast-Checks aus den Tests sichern die Lesbarkeit. Mittel. Wartet auf Freigabe.
- [x] 09.10.2026, Fehler (mündlich): Eingabefenster auf dem iPhone, Tastatur erschien beim Tippen nicht bzw. verdeckte Textfeld und Knöpfe. Ursache: Autofokus per Skript außerhalb der Tipp-Geste, festes Blatt hinter der Tastatur. Behoben in `20261009r`.
- [x] 10.10.2026, Fehler (E.K., iPhone, Homescreen-App, Version q): „Der ‚Als Video teilen‘-Button funktioniert nicht.“ Ursache: Teilen lief zehn Sekunden nach dem Tipp außerhalb der Nutzergeste, iOS lehnte es ab, der Fehler wurde verschluckt. Behoben in `20261011e`: erst „Video aufnehmen“, dann „Video teilen“ im eigenen Tipp, Fehler sichtbar; siehe `docs/superpowers/specs/2026-10-11-tagesfilm-teilen-loops-design.md`. Gerätecheck auf dem echten iPhone am 23.10.2026 bestanden, Teilen funktioniert. Offen: Rückmeldung an E.K.
- [x] Regen-Alarm in Betrieb genommen (09.10.2026): KV-Namespace SUBS, Geheimnis VAPID_PRIVATE_KEY, Worker deployt mit Cron */15 und Testroute `/push/test`
- [x] Regen-Alarm auf dem iPhone geprüft: Probenachricht angekommen (09.10.2026); der erste Schlüssel-Upload hatte einen Zeilenumbruch, der Worker schneidet das jetzt selbst ab
- [x] Tagesfilm samt Aufnahme auf dem echten iPhone geprüft (09.10.2026)
- [x] Vortagswerte im Feld „Woher kommt das?“ als Modellwerte kennzeichnen – mit Punkt 1 erledigt
