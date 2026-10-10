# Nachtpalette und Tageszeit-Kacheln – Spezifikation

Stand: 8. Oktober 2026. Betrifft die Startseite (`index.html`, `design.js`, `modern.css`) und den Rahmen der Radarseite (`radar.html`, `radar.js`). Das klassische Glas-Design (`design.css`) bleibt unverändert.

## Ziel

Nachts soll die App nicht in hellem Lavendel leuchten, und die Kacheln sollen zeigen, was zur Tageszeit und Jahreszeit zählt. Beides folgt dem Himmel am gewählten Ort, nicht der Geräteeinstellung.

## Nachtzustand

- **Definition.** Nacht ist, wenn die Sonne am gewählten Ort tiefer als −8° steht: vom Ende der abendlichen blauen Stunde bis zum Beginn der morgendlichen. Die Grenzen kommen aus den vorhandenen Lichtzeiten (`lightTimes`, verankert an den Open-Meteo-Auf- und Untergangszeiten). Fehlen sie, etwa im hohen Norden, entscheidet die reine Sonnenstandsrechnung: gibt es einen Tag, aber keine volle Nacht, bleibt es hell; Polarnacht zählt als Nacht.
- **Zeitbasis.** Die echte Uhrzeit in der Zeitzone des Ortes (`utc_offset_seconds`), nicht die Zeit der Vorhersage und nicht die angetippte Stunde der Zeitreise. Die Zeitreise verändert die Palette nie.
- **Prüfung.** Beim Rendern, einmal pro Minute über den vorhandenen Minutentakt der Aktualitätszeile und beim Sichtbarwerden der Seite. Ein Wechsel bei geöffneter App blendet weich über (knapp eine Sekunde), danach gelten die neuen Farben ohne dauerhafte Transitionen.
- **Merken.** Der letzte Zustand liegt unter `wetter:night` im Speicher. Ein Inline-Skript im Kopf beider Seiten setzt die Klasse `night` auf `<html>`, bevor etwas gezeichnet wird, damit die Seite beim Start nachts nicht erst hell aufblitzt.
- **Radar.** Die Radarseite rechnet den Zustand selbst aus dem aktiven Ort (`wetter:active`, sonst `wetter:pos`) mit der gemeinsamen Sonnenrechnung, beim Start und einmal pro Minute. Rahmen, Zeitachse, Legende und Knöpfe folgen der Palette, die Karte bleibt hell.
- **Statusleiste.** Die Farbe der Statusleiste (`theme-color`) folgt: nachts Grund der Nachtpalette, tags wie bisher.

## Nachtpalette

Die Palette überschreibt nur die Farbtoken unter `html.night`. Dafür bekommen die hellen Flächen eigene Token, damit „weiß“ als Textfarbe auf dunklen Feldern weiß bleibt:

| Token | Tag | Nacht | Verwendung |
|---|---|---|---|
| `--ground` | #ECEAF4 | #14121F | Seitengrund |
| `--card` | #FFFFFF | #221F33 | weiße Felder, Kacheln, Suchdialog, Knöpfe |
| `--soft` | #ECEAF4 | #2E2A45 | Chips, Stundenspalten, Platzhalter in Diagrammen |
| `--line` | #ECEAF4 | #3A3553 | Trennlinien, Griff des Suchdialogs |
| `--ink` / `--ink-2` | #1E1B2E / #6B6685 | #F1EFF8 / #A9A3C4 | Schrift, Ringe, Chevrons |
| `--uv`, `--wind`, `--rain`, `--lilac` | Pastell | #5A3A2E, #27392B, #34496E, #3A2F57 | die vier farbigen Kacheln |
| `--wet` / `--rain-ink` | #DCE9F9 / #3A4A6B | #243048 / #BFD6F6 | nasse Stundenspalten und deren Schrift |
| `--dark` / `--dark-muted` | #1E1B2E / #B9B4D6 | #2A2740 / #8E88AE | dunkle Felder, Tab-Leiste, Ortsknopf |
| `--good-bg` | #E4F1E8 | #243A2C | Fenster im Feld Rausgehen |

Der Hero behält seine Wetterfarbe. Nachts werden die Theme-Farben abgedunkelt, damit der Hero sich vom Grund abhebt, aber nicht blendet: klare und bewölkte Nacht #34437F, Regen und Gewitter #3C5283, bedeckt und Nebel #3D3952, Schnee #4A5570, Tag-Themes (falls die Daten „Tag“ sagen, die Uhr aber Nacht) #5C4F24. Chips im Hero werden halbtransparent hell.

Einzelne Bauteile brauchen eigene Nachtregeln, weil sie feste Farben tragen: Warnfelder behalten dunkle Schrift auf ihren Signalfarben, Skelett-Platzhalter werden hell-transparent, Achsen und Spuren der Instrumente (Sonnenbogen, Druckzeiger, Böenbalken, Regenverlauf, Modellkurven) hell-transparent, Lichtleiste und Lichtphasen-Farben heller, der goldene und blaue Verlauf im Sonnenfeld dunkel, Schatten kräftiger. Die Wortfarben der Luftqualität (gut, mäßig, …) wandern aus Inline-Stilen in Klassen `wc-<stufe>` mit Tag- und Nachtwerten.

Kontrast: Schrift mindestens 4,5:1 auf ihrer Fläche (Nebentext #A9A3C4 auf #221F33 ≈ 6,5:1).

## Tageszeit-Kacheln

- **UV nachts.** Sobald Nacht ist, zeigt die UV-Kachel „UV morgen“: Höchstwert von morgen (`daily.uv_index_max[1]`) mit Stufenwort und Balken, Untertitel „Höchstwert gegen HH Uhr“ aus dem Stundenmaximum von morgen. Als Symbol steht die aktuelle Mondphase (berechnet, synodischer Monat ab Neumond 6.1.2000 18:14 UTC), mit Phasenname und Beleuchtung als Beschriftung für Vorlesehilfen. Tags bleibt die Kachel wie bisher.
- **Sicht statt Pollen.** Gibt es keine nennenswerten Pollen (keine Chips) oder keine Luftdaten, zeigt der Platz die Kachel „Sicht“: Sichtweite der aktuellen Stunde (`hourly.visibility`, in km oder m) mit Wort (Nebel unter 1 km, diesig unter 4 km, mäßig unter 10 km, sonst klar). Untertitel: die nächste Stunde innerhalb von 24 h mit Sicht unter 1 km („Nebel möglich morgen gegen 5 Uhr“), sonst Taupunkt (`hourly.dew_point_2m`) mit Nebelneigung bei weniger als 2° Abstand zur Temperatur, sonst „kein Nebel in Sicht“. Die Open-Meteo-Anfrage bekommt die beiden Stundenfelder dazu, Modelle und Quellen bleiben gleich.
- **Wechselregel.** Die Kacheln wechseln nach echter Zeit zusammen mit der Palette. Beim Wechsel werden die Detailkacheln neu gebaut, die Zähler werden auf die neuen Werte gesetzt statt neu zu laufen, die beiden getauschten Kacheln blenden ein, die übrigen stehen still. Ein offenes Instrument-Feld bleibt offen.

## Nicht Teil dieser Stufe

Dunkle Radarkarte, Systemdunkelmodus als Schalter, Einstellungen.

## Tests

- Nachtfenster aus den Mock-Daten (Sonnenuntergang 19:05, Aufgang 07:12 in München): 14:15 Tag, 19:30 Tag, 20:00 Nacht, 06:00 Nacht, 06:45 Tag.
- Ohne Lichtzeiten: reine Sonnenrechnung, Polartag hell, Polarnacht dunkel.
- Mondphase: Vollmond 26.9.2026, Neumond 10.10.2026, Phasennamen.
- Wechsel bei geöffneter App: Klasse `night`, „UV morgen“ mit Höchstwert 4,6 gegen 12 Uhr und Mondsymbol, Zähler ohne Neustart, offenes Feld bleibt offen, Rückwechsel am Morgen.
- Sicht-Kachel bei fehlenden Pollen: 24 km klar, „Nebel möglich morgen gegen 5 Uhr“; mit Pollen bleibt die Pollen-Kachel.
- Radar: Nachtklasse aus Ort und Uhrzeit, Rückfall ohne Ort.
- Stylesheet: Nachtblock mit allen Token, Fade-Regeln; Startseite und Radar laden die Sonnenrechnung.
