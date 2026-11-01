# Highlights der nächsten Tage – Spezifikation

Stand: 9. Oktober 2026. Betrifft `index.html`, `design.js`, `modern.css`, `tests/`. Keine neuen Datenfelder.

## Ziel

Ein schlankes Feld „Nächste Tage“ auf der Heute-Seite nennt in höchstens drei Zeilen, was in den
nächsten sieben Tagen auffällt: Temperatursprung, erster Frost, Sturm, nasser Tag, Trockenphase,
sonnigster Tag, Schnee, Gewitter, Nebel, Hitze. Regelbasiert aus den Tageswerten der Vorhersage,
nach Vorbild des Highlights-Felds in Apple Wetter.

## Regeln

Zeitraum: Tag 1 bis Tag 7 der Tageswerte (morgen bis in sieben Tagen). Heute bleibt außen vor,
das decken Hinweisfeld und Ansichten ab. Jede Regel liefert Kandidaten mit Tag, Art, Priorität und Text.

| Art | Bedingung | Text | Priorität |
|---|---|---|---|
| Sturmböen | Böen ab 75 km/h | Sturmböen bis 80 km/h | 9 |
| Schnee | Tages-Wettercode 71, 73, 75, 77, 85, 86 | Schnee | 8 |
| Erster Frost | erster Tag mit Tiefstwert bis 0°, nur wenn heute und gestern (Vortag, falls vorhanden) frostfrei | Erster Frost, morgens -1° | 8 |
| Gewitter | Wettercode ab 95 | Gewitter möglich | 7 |
| Hitze | Höchstwert ab 30° | Hitze, 32° | 7 |
| Stürmisch | Böen ab 60 km/h | Stürmisch, Böen bis 70 km/h | 6 |
| Nass | Tagessumme ab 10 mm; Risiko ab 70 % wird genannt | Nass, rund 14 mm bei 90 % Risiko | 6 |
| Temperatursprung | gerundeter Höchstwert ändert sich zum Vortag um 5° oder mehr; nur der größte Sprung | 6° kühler, 11° statt 17° | 5 |
| Nebel | Wettercode 45 oder 48 | Nebel | 4 |
| Trockenphase | mindestens drei Tage am Stück unter 0,5 mm und unter 30 % Risiko; die längste | Trocken (Zeitraum als Beschriftung) | 3 |
| Sonnigster Tag | ab 7 Stunden Sonne und ab 70 % des Tageslichts; der sonnigste | Sonnig, 8 Stunden Sonne | 3 |

Auswahl: pro Tag nur der Kandidat mit der höchsten Priorität (die Trockenphase ist ein Zeitraum und
zählt getrennt). Dann die drei mit der höchsten Priorität, bei Gleichstand der frühere Tag; die
Anzeige ist nach Tagen sortiert. Ohne Kandidaten steht ein ruhiger Satz: „Die nächsten sieben Tage
ohne Auffälligkeiten.“

## Darstellung

Feld „Nächste Tage“ im Heute-Abschnitt nach dem Rausgehen-Feld, vor der Regenkarte, mit dem Hinweis
„7 Tage“ rechts. Jede Zeile ist eine Schaltfläche: links der kurze Wochentag fett (Zeitraum „Di–Fr“),
rechts der Satz; `aria-label` nennt den langen Wochentag, etwa „Dienstag: 6° kühler, 11° statt 17°“.
Ein Tipp springt zur 14-Tage-Liste, klappt bei Bedarf die weiteren Tage auf, rollt die Zeile des
Tags in die Mitte und lässt sie kurz aufleuchten. Die Zeilen der Tagesliste tragen dafür `data-day`.
Nachtpalette über die vorhandenen Token.

## Tests

- Mock: Kandidaten Sprung (Tag 1), Nass (Tag 2 und 3), Gewitter (Tag 3), Trockenphase (Tag 4 bis 7);
  Auswahl ergibt Sprung, Nass, Gewitter in dieser Reihenfolge.
- Frost nur beim ersten Tag; kein Frost-Highlight, wenn heute oder gestern schon Frost war.
- Sturm in zwei Stufen; Schnee, Nebel, Hitze; sonnigster Tag; Zeitraum-Beschriftung; leerer Zustand.
- Markup der Zeilen mit `data-day` und `aria-label`; Tipp auf Tag 7 klappt die Liste auf.
- Shell: Feld in `index.html`, Stile im Stylesheet.

Versions-Query auf `20261009j`.
