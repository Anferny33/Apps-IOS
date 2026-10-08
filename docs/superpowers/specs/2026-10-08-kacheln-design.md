# Kacheln, die sich zu Instrumenten entfalten

Stand: 8. Oktober 2026 · Kacheln Wind, Regen, Sonne der Bento-Startseite, beide Designs.

## Ziel

Ein Tipp auf die Kachel Wind, Regen oder Sonne klappt direkt unter der Kachelreihe ein Feld in
voller Breite und in der Farbe der Kachel auf: Wind als Kompass mit Böenverlauf, Regen als
Verlauf der nächsten 24 Stunden, Sonne als Tageslichtbogen mit Lichtzeiten. Die Kachel bleibt
an ihrem Platz; das Raster verschiebt sich nicht (Entscheidung des Users gegen den Morph der
Kachel selbst).

## Nicht Teil dieser Stufe

- Instrumente für UV, Luftfeuchte, Luftdruck, Luftqualität, Pollen.
- Dämmerungs- oder Abendmodus (eigene Idee).
- Die klassische Seite `klassisch.html`.

## Verhalten

1. Tipp auf eine Kachel mit `data-tile` (wind, rain, sun) öffnet ihr Feld; Tipp auf dieselbe
   Kachel schließt es; Tipp auf eine andere wechselt. Höchstens ein Feld ist offen.
2. Der bisherige Animations-Neustart der Kachel bleibt beim Tipp erhalten. Ein Tipp auf das
   offene Feld spielt dessen Animationen erneut.
3. Jedes Neurendern (Aktualisieren, Ortswechsel) schließt alle Felder.
4. Die übrigen Kacheln verhalten sich wie bisher.

## Aufbau

Reihenfolge im Raster bleibt: UV, Wind | Regen, Sonne | Luftfeuchte, Luftdruck | Luftqualität,
Pollen. Nach der Kachel Wind folgt das Feld `tpanel tp-wind`, nach der Kachel Sonne die Felder
`tp-rain` und `tp-sun`. Jedes Feld: `<div class="tpanel tp-<key>" data-for="<key>"><div
class="tpanel-in"><div class="tpanel-body">…</div></div></div>`, `grid-column: 1 / -1`.

Geschlossen: `grid-template-rows: 0fr` und `margin-top: -12px` (gleicht den Rasterabstand aus,
damit das leere Feld keine Lücke hinterlässt). Offen: `1fr`, `margin-top: 0`, Übergang 0,6 s.
Die Kachel trägt `open`: leicht angehoben, Ring in Tintenfarbe (klassisch: weiß).

Inhalte tragen `tp-item` mit `data-stagger` und gestaffelter Einblendung; beim Öffnen und beim
Tipp aufs Feld laufen sie über `restartAnimations` erneut.

## Instrumente

**Wind** (`windPanelHtml(fc)`): Kompass (SVG 120×120, Ring, Striche alle 45°, N O S W), Nadel
in Richtung, in die der Wind weht (`(dir + 180) % 360`), schwingt mit Überschwung ein (`swing`).
Daneben Geschwindigkeit groß, „Böen N km/h", „aus SW". Darunter die nächsten 12 Stunden als
Doppelbalken Wind/Böen (Skala: höchste Böe), Beschriftung alle 3 Stunden, Satz „Böen bis N km/h
gegen HH Uhr" oder „Ruhig, Böen unter 20 km/h".

**Regen** (`rainPanelHtml(fc)`): 24 Balken (mm je Stunde ab jetzt, Skala mindestens 1 mm),
Null-Balken flach; darunter alle 3 Stunden die Stunde und die Regenwahrscheinlichkeit
(`hourProb`, dieselbe Rechnung wie die Leiste). Satz „Heute 4,2 mm in 3 Regenstunden · Morgen
0,5 mm" bzw. „Heute trocken · Morgen 0,5 mm".

**Sonne** (`sunPanelHtml(fc)`): großer Halbkreisbogen (SVG 320×160, Mittelpunkt 160/150,
Radius 140) mit Aufgangs- und Untergangszeit an den Enden, Bogen zeichnet sich bis zum
Sonnenstand (`--p` in Prozent, `pathLength=100`), Sonnenpunkt dreht vom linken Ende auf seine
Position (`--ang`, Drehpunkt 160/150). Nachts steht der Punkt am Ende und der Hinweis „Nacht".
Darunter drei Fakten: Tageslänge, Sonnenschein heute, Vergleich zu morgen („Morgen 3 min
kürzer", „länger", „gleich lang" bei unter 30 s Unterschied).

## Zustand und Funktionen (`design.js`)

```
openTile                     null | "wind" | "rain" | "sun"
tilePanelHtml(key, inner)    Hülle
windPanelHtml / rainPanelHtml / sunPanelHtml (fc)
toggleTile(key)              öffnet/schließt/wechselt; Klassen auf Kachel und Feld, Neustart der Feld-Animationen
openTileKey()                für Tests
```

Klick-Delegat: `.tile[data-tile]` → `toggleTile` + bisheriger Neustart; `.tpanel` → Neustart des Feldes.

## Tests (`tests/smoke-design.js`)

- Markup: drei Felder in richtiger Reihenfolge (Wind-Feld direkt nach der Wind-Kachel, Regen-
  und Sonnen-Feld nach der Sonnen-Kachel), Kacheln mit `data-tile`.
- Wind: Nadel `--ang:45deg` (Mock 225°), Satz „Böen bis 36 km/h gegen 14 Uhr", 12 Doppelbalken.
- Regen: 24 Balken, Satz „Heute trocken · Morgen 3,4 mm", Wahrscheinlichkeiten als „%".
- Sonne: `--p:59` (14:15 zwischen 07:12 und 19:05), „Tageslänge 11 h 53 min",
  „Sonnenschein 6 h 00 min", „Morgen gleich lang", Zeiten 07:12 und 19:05.
- `toggleTile`: wind → wind; wind → null; sun, dann rain → rain.
- Shell-Check: Versions-Query `20261008s`.

Sichtprüfung: Simulator beide Designs (Aufklappen, Wechsel, Schließen, Nadel, Balken, Bogen),
Browser-Fenster Konsole ohne Fehler.
