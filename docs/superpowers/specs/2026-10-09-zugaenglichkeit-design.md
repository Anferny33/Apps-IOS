# Zugänglichkeit – Spezifikation

Stand: 9. Oktober 2026. Fünf Stufen, je eine eigene Umsetzung und ein eigener Commit.

## Ziel

Die App funktioniert auch mit größerer Systemschrift, bei schwächerem Sehen, mit VoiceOver und mit
Tastatur. Befund vom 9. Oktober: alle Schriftgrößen in Pixeln, Stundenspalten nicht erreichbar,
Diagramme ohne Beschreibung, keine Ansagen; Kontraste der Haupttöne über 4,5:1, reduzierte Bewegung,
Sprache und Dialoge bereits in Ordnung.

## Stufe 1: Schrift folgt der Systemgröße (umgesetzt)

- Grundschrift 17 px am Wurzelelement, alle Schriftgrößen im Stylesheet relativ dazu in rem
  (Pixelwert geteilt durch 17, drei Nachkommastellen). Bei Standardgröße ändert sich nichts Sichtbares.
- Unter WebKit auf Touch-Geräten (`@supports (font: -apple-system-body)` und
  `(hover: none) and (pointer: coarse)`) übernimmt das Wurzelelement die Dynamic-Type-Größe des
  Systems; Safari auf dem Mac bleibt bei 17 px, weil seine Systemgröße 13 px wäre.
- Ein Kopfskript nach dem Stylesheet deckelt die Wurzelgröße beim 1,6-Fachen (27,2 px); darüber
  hält das Raster nicht mehr.
- Große Zahlen (Hero-Temperatur, Kachelwerte, Windwert) sind über `min(rem, vw)` an die
  Bildschirmbreite gebunden.
- Zeilenhöhen ohne Pixel; feste Höhen an Textzeilen (Tagesliste, Knöpfe, Ortsknopf,
  Vorschau-Knopf) werden Mindesthöhen; Textspalten der Tagesliste, Highlight-Zeilen,
  Stundenspalten und Rausgehen-Spur in rem.
- Kacheltitel dürfen Symbol und Chevron in eine zweite Zeile schieben; nur ein Wort, das allein
  nicht passt, bricht innen um. Das Wort neben einem Kachelwert darf unter die Zahl rutschen.
- Text in SVG-Grafiken (Kompass, Sonnenbogen, Modellkurven) bleibt in Pixeln und skaliert mit der
  Grafik, nicht mit der Systemschrift.
- Radarseite: Schriftgrößen ebenfalls in rem, gleicher Deckel.

Prüfung: Harness-Checks auf dem Stylesheet; Browser bei 390 px mit Wurzelgröße 22 px und 27,2 px
ohne waagerechten Überlauf; Simulator mit `xcrun simctl ui <udid> content_size extra-extra-extra-large`.

## Stufe 2: Stundenspalten per Tastatur und VoiceOver

Spalten werden Schaltflächen mit Satz je Stunde („9 Uhr, bewölkt, 9 Grad, Regenrisiko 0 %“),
Pfeiltasten wandern durch den Streifen, die Zeitreise bekommt damit einen Tastaturweg.

## Stufe 3: Textalternative je Diagramm

Regenbalken, Stundenstreifen, Sichtverlauf, Kompass, Sonnenbogen und Modellkurven erhalten je einen
beschreibenden Satz, möglichst aus den vorhandenen Sätzen der Felder.

## Stufe 4: Kontrast

Getönte Kacheln, Chips im Hero, gedämpftes Grau in dunklen Feldern bei Nacht und Balkenfarben
(3:1) prüfen und korrigieren.

## Stufe 5: Rückmeldungen

Live-Region für Laden, Aktualisieren, Fehler und Ansichtswechsel.
