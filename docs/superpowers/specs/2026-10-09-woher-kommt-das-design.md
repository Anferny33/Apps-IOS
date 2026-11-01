# Woher kommt das? – Spezifikation

Stand: 9. Oktober 2026. Betrifft `index.html`, `design.js`, `wetter-core.js`, `modern.css`, `tests/`.
Eine neue Abfrage (Metadaten des ICON-D2-Laufs).

## Ziel

Jede gezeigte Zahl ist einen Tipp entfernt erklärbar: Quelle, Modell, Gitterpunkt, Rechenweg und
Stand. Vorbild ist das Prinzip von Claude Dashboards, bei dem jedes Diagramm seine Abfrage und den
Zeitpunkt der letzten Aktualisierung zeigt. Viele Werte der App sind abgeleitet (Regenrisiko aus
Ensemble-Läufen, gefühlte Temperatur, Nebelrisiko, Vergleich mit gestern) und sollen nicht wie
Messungen wirken.

## Zugang

- Die Aktualitätszeile unter dem Hero bekommt rechts einen Textknopf „Woher?“. Er ist nur sichtbar,
  wenn Daten geladen sind, und öffnet das Blatt oben.
- Jedes aufgeklappte Instrument-Feld (Wind, Regen, Sonne, Sicht) endet mit der Zeile
  „Woher kommt das?“. Sie öffnet das Blatt beim passenden Abschnitt.
- Keine i-Knöpfe an Kacheln, kein langes Drücken.

## Das Blatt

Ein Bottom-Sheet wie die Ortssuche (`#src`, eigener Hintergrund `#srcBg`, Körperklasse `src-open`,
damit die beiden Blätter unabhängig sind). Kopf mit Titel „Woher kommt das?“ und Knopf „Schließen“,
darunter ein scrollbarer Körper mit zehn Abschnitten. Escape und Tipp auf den Hintergrund schließen;
der Fokus geht zurück auf den auslösenden Knopf. Beim Öffnen aus einem Feld wird zum Abschnitt
gescrollt und dieser hervorgehoben.

Abschnitte, jeweils Überschrift und ein bis drei Sätze, mit lebenden Werten:

1. **Ort und Gitterpunkt.** Gewählter Ort mit Koordinaten. Modellpunkt der Vorhersage mit
   Koordinaten, Entfernung zum Ort und Höhe (aus der Antwort). Punkt für Luft und Pollen mit
   Entfernung, Raster etwa 11 km.
2. **Modelle und Stand.** Bestes Modell je Ort, in Mitteleuropa DWD ICON (D2 bis 48 h, danach EU
   und global); Nowcast aus den 15-Minuten-Werten. ICON-D2-Lauf mit Zeitpunkt und Verfügbarkeit aus
   den Metadaten, Laufabstand. Ensemble und Modellvergleich. Ladezeitpunkt wie in der Aktualitätszeile.
3. **Temperatur.** Gefühlt nach Open-Meteo. Hoch und Tief aus den Tageswerten. Vergleich mit gestern
   als Modellwert zur selben Uhrzeit, gemittelt, keine Messung; mit den beiden Zahlen.
4. **Regen.** Regenrisiko als Anteil der Ensemble-Läufe mit mindestens 0,1 mm, jetzt „15 von 21
   Läufen, also 71 %“; ohne Ensemble der Modellwert. Regenrat mit den Schwellen. Trockene Phasen
   und blaue Felder.
5. **Wind.** Wind und Böen in 10 m, Pfeilrichtung, Schwellen für windig und volle Spalte.
6. **Sonne und Licht.** Zeiten von Open-Meteo, goldene Stunde 4° unter bis 6° über dem Horizont,
   blaue Stunde 8° bis 4° darunter, Nachtpalette unter 8°, UV aus dem Modell, Mondphase berechnet.
7. **Sicht und Nebel.** Punktesystem des Nebelrisikos und die aktuellen Zahlen: Taupunktabstand,
   Wind, Bewölkung, Risiko.
8. **Rausgehen.** Je Aktivität die Schwellen aus der Tabelle: gefühlte Temperatur, Regenrisiko,
   Wind, Böen, Licht, Mindestdauer.
9. **Luft und Pollen.** CAMS Europa über Open-Meteo, europäische Skala, Sicht außerhalb der Saison.
10. **Warnungen und Radar.** DWD-Warnungen der Gemeinde, NINA, Radar DWD RADOLAN RV, Karte basemap.de.

Fehlt eine Quelle (keine Metadaten, keine Luftdaten, alter Cache ohne Ort), fällt nur der betroffene
Satz weg; das Blatt bleibt vollständig.

## Daten

- `fetchModelMeta()` lädt `https://api.open-meteo.com/data/dwd_icon_d2/static/meta.json` und
  liefert `{ run, available, interval }` in Sekunden. Die Abfrage läuft mit den anderen; ein
  Fehler blendet nur die Lauf-Zeile aus. Die Ensemble-Metadaten sind veraltet und werden nicht genutzt.
- Das Nutzlast-Objekt bekommt `meta` und `loc` (Name und Koordinaten des gewählten Orts), damit
  Cache und Blatt dieselben Angaben haben.
- `ensembleStats` liefert zusätzlich `wet` (Anzahl nasser Läufe).

## Tests

- Metadaten-URL in der Abfragefolge; Aktualitätszeile mit sichtbarem „Woher?“; drei Felder mit
  „Woher kommt das?“.
- Blatt öffnet beim Abschnitt Wind; Ort, Modellpunkt mit Entfernung und Höhe; Lauf-Zeile in
  Ortszeit; Regenrisiko „15 von 21 Läufen, also 71 %“; Nebelrisiko mit aktuellen Zahlen; Vergleich
  mit gestern als Modellwert; Rausgehen-Schwellen; zehn Abschnitte; Schließen.
- Ohne Metadaten, Luftdaten, Ort und Ensemble bleibt das Blatt vollständig.
- Klick auf „Woher kommt das?“ im Sicht-Feld öffnet beim Abschnitt Sicht.

Versions-Query auf `20261009i`.
