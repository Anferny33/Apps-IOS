# Ansicht nach Frage – Spezifikation

Stand: 8. Oktober 2026. Betrifft `index.html`, `design.js`, `modern.css`. Keine neuen Datenfelder.

## Ziel

Eine Frage wählt die Darstellung: Regnet es, wie windig, wie warm, wie viel Licht. Stundenstreifen und Tagesliste zeigen dann den passenden Wert mit passender Färbung, und ein Satz beantwortet die Frage für die nächsten 24 Stunden. Der Überblick bleibt der heutige Zustand.

## Bedienung

- Chip-Zeile unter dem Hinweisfeld, über „Nächste Stunden“: Überblick, Regen, Wind, Wärme, Licht. Waagerecht scrollbar, Chips wie bei Rausgehen, der aktive Chip trägt `aria-pressed`.
- Die Wahl liegt unter `wetter:view` im Speicher und gilt beim nächsten Start weiter. Unbekannte Werte fallen auf Überblick zurück.
- Ein Wechsel blendet Streifen und Liste kurz über; Spalten und Zeilen laufen keine Einblendung, Zähler sind nicht betroffen. Hero, Zeitreise samt Ring, Rausgehen-Spur, Nowcast-Karte, Kacheln und Modellvergleich bleiben unverändert; eine gewählte Stunde bleibt markiert.

## Stundenstreifen je Ansicht

Jede Spalte behält Zeit und Aufbau; die Jetzt-Spalte zeigt dieselben Werte wie die übrigen.

| Ansicht | Wert | Zeile darunter | Färbung |
|---|---|---|---|
| Überblick | Temperatur | Regenrisiko % | blaue Füllung ab 25 % (wie heute) |
| Regen | Regenrisiko % | Menge „1,2 mm“ ab 0,05 mm | blaue Füllung ab 25 % |
| Wind | Wind km/h | „Böen 36“ | grüne Füllung nach Böen (60 km/h = voll), Richtungspfeil statt Wettersymbol, Text grün ab 20 km/h |
| Wärme | Temperatur | „gef. 17°“ | Spaltentönung nach Temperatur: bis 0° Eis, bis 8° kühl, bis 16° mild, bis 24° warm, darüber heiß |
| Licht | „UV 4“, nachts „–“ | Bewölkung „45 %“ | gelbe Füllung nach Sonnenanteil (100 % minus Bewölkung), Nachtstunden gedämpft |

Die Notiz unter dem Streifen erklärt je Ansicht die Färbung.

## Tagesliste je Ansicht

Aufbau der Zeile bleibt (Tag, Symbol, erster Wert, linker Wert, Balken, rechter Wert); die Kopfzeile nennt die Spalten.

| Ansicht | Symbol | erster Wert | links | Balken | rechts | Kopf |
|---|---|---|---|---|---|---|
| Überblick, Wärme | Wetter | Risiko % | Tief | Spanne wie heute | Hoch | Tief · Hoch |
| Regen | Wetter | Risiko % | Stunden „3 h“ | Menge gegen das Maximum der 14 Tage | mm | Risiko · Stunden · mm |
| Wind | Pfeil (vorherrschend) | Himmelsrichtung | Wind | Böen gegen das Maximum | Böen | Wind · Böen km/h |
| Licht | Wetter | „UV 5“ | – | Sonnenstunden gegen Tageslänge | „6 h“ | UV · Sonnenstunden |

## Antwortsatz

Regelbasiert aus den nächsten 24 Stunden ab der aktuellen Stunde; „heute/morgen“ über die Tagesworte.

- Regen: nass = Risiko ab 25 % oder Menge ab 0,1 mm. Jetzt nass: „Regen bis 15 Uhr, dann trocken“ plus „, ab 18 Uhr wieder Regen“ falls später erneut nass; durchgehend nass: „Regen die nächsten 24 Stunden, etwa X mm.“ Jetzt trocken: „Trocken bis 17 Uhr, dann Regen bis 21 Uhr, etwa 2 mm“ beziehungsweise „bis zu 60 % Risiko“, wenn kaum Menge; nichts: „Kein Regen in den nächsten 24 Stunden.“
- Wind: Höchstböe mit Richtung und Stunde: „Böen bis 45 km/h aus SW gegen 15 Uhr“, in der aktuellen Stunde „Jetzt Böen bis …“; Nachsatz aus den letzten zwölf Stunden des Fensters: unter 20 km/h „später ruhig“, unter 70 % der Höchstböe „später weniger“. Höchstböe unter 20: „Kaum Wind in den nächsten 24 Stunden.“
- Wärme: „Höchstens 20° morgen um 11 Uhr, gefühlt 19°, nachts bis 4°“; liegt das Maximum in der aktuellen Stunde: „Jetzt am wärmsten mit 18°, gefühlt 17°, …“; liegt das Minimum nicht nachts (20 bis 6 Uhr): „tiefstens 9° morgen um 8 Uhr“.
- Licht: am Tag „6 h Sonne heute, UV mittel jetzt“ beziehungsweise „um 13 Uhr“, plus goldene Stunde aus dem Sonnenfeld; nachts „Sonnenaufgang 07:12, morgen 6 h Sonne, UV mittel“.

## Nachtpalette

Eigene Token für Windfüllung, Wärmetönungen, Sonnenfüllung und Nachtspalten, damit Schrift und Füllungen auch nachts lesbar bleiben.

## Tests

Chips und Standard, Wechsel je Ansicht mit Spalten, Zeilen, Kopfzeile, Notiz und Satz; Rückkehr zum Überblick liefert das heutige Markup; gespeicherte Ansicht beim Start; Satzregeln an den Mock-Daten und an Grenzfällen (kein Regen, Regen durchgehend, kaum Wind, Nacht); Stylesheet mit Nacht-Token.
