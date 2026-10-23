# Regenpausen

Stand: 8. Oktober 2026 · Karte „Regen in den nächsten 4 Stunden" der Bento-Startseite, beide Designs.

## Ziel

Die Karte beantwortet zusätzlich die Frage „Reicht die nächste trockene Phase für N Minuten
draußen?". Die gewünschte Dauer wählt der Nutzer (15, 30, 60 Minuten). Die passende trockene
Phase wird im Balkendiagramm grün markiert und als Satz mit ungefähren Zeiten genannt, damit
keine minutengenaue Sicherheit suggeriert wird.

## Nicht Teil dieser Stufe

- Ein längerer Blick als die 4 Stunden der Karte (16 Intervalle à 15 Minuten).
- Eigene Dauern außer 15, 30, 60 Minuten.
- Die klassische Seite `klassisch.html`.

## Bewertung

Datenbasis ist `nowcastSummary(fc)`: `vals` (mm je 15 Minuten), `times` (Intervallanfänge).
Trocken ist ein Intervall unter 0,1 mm, dieselbe Grenze wie für „Regen ab". Zusammenhängende
trockene Intervalle bilden eine Phase. Gesucht wird die **erste** Phase mit mindestens
`Dauer / 15` Intervallen. Reicht eine Phase bis zum Ende der 16 Intervalle, ist sie „offen":
ihr Ende ist unbekannt.

`pauseInfo(nc, minutes)` → `{ s, e, open, text }` oder `{ none: true, text }`.

| Lage | Satz |
|---|---|
| Phase beginnt jetzt (s = 0) | „Jetzt trocken bis ca. 14:45, rund 30 Minuten." |
| Phase beginnt jetzt und ist offen | „Jetzt trocken, mindestens bis 18:15." |
| Phase später | „Nächste trockene Phase: ca. 16:15 bis 17:30, rund 1 h 15 min." |
| Phase später und offen | „Nächste trockene Phase: ab ca. 16:15, mindestens bis 18:15." |
| keine | „In den nächsten 4 Stunden keine trockene Phase von 30 Minuten, längstens rund 15 Minuten ab ca. 15:30." bzw. ohne Nachsatz, wenn kein Intervall trocken ist |

Dauer: unter 60 Minuten „rund N Minuten", volle Stunden „rund 1 Stunde" / „rund 2 Stunden",
sonst „rund 1 h 15 min". Zeiten sind Intervallgrenzen, das „ca." steht davor.

## Darstellung

- Unter der Achse der Karte ein Block `div.pause`: Zeile mit Beschriftung „Trockene Phase für"
  und drei Chips `<button class="pchip" data-min="15|30|60">` (die gewählte trägt `on`), darunter
  der Satz in `div.ptext`.
- Balken der gewählten Phase tragen `p` (grün, Mindesthöhe 8 px, damit auch Null-Balken
  sichtbar sind). Das letzte Intervall einer geschlossenen Phase und das erste Intervall einer
  später beginnenden Phase tragen zusätzlich `pe` (halb transparent): weiche Ränder statt
  scharfer Kanten. Beginnt die Phase jetzt, ist der Anfang hart; endet sie offen, ist das Ende hart.
- Chip-Tipp aktualisiert Balkenklassen, Chips und Satz ohne Neurendern der Balken (deren
  Aufbau-Animation bleibt ungestört). Wahl in `localStorage` `wetter:pause`, Standard 30.
- Die Karte bleibt nur sichtbar, wenn Regen in den 4 Stunden erwartet wird (wie bisher).

## Funktionen (`design.js`)

```
pauseMinutes            Modul-Variable (15 | 30 | 60), loadPause() aus dem Speicher
dryRuns(vals)           → [{ s, e }] trockene Phasen
pauseInfo(nc, minutes)  → siehe oben
pauseClasses(info, i)   → "" | " p" | " p pe" für Balken i
dNowcast(fc)            rendert Balken mit Klassen, Block und Satz; merkt nc in lastNc
setPause(minutes)       → speichern, updatePause()
updatePause()           → Klassen auf .nc-bars i, Chips, Satz
initPause()             → Klick-Delegation auf #nowcastCard
```

## Tests (`tests/smoke-design.js`, Mock: Jetzt 14:15, Regen 14:45 bis 16:15)

- Standard 30 min: Satz „Jetzt trocken bis ca. 14:45, rund 30 Minuten.", Balken 0 `class="z p"`,
  Balken 1 `class="z p pe"`, Chip 30 `on`, Block vorhanden.
- `setPause(60)`: Satz „Nächste trockene Phase: ab ca. 16:15, mindestens bis 18:15.",
  Speicher `wetter:pause === "60"`.
- `pauseInfo` direkt: geschlossene spätere Phase → „ca. … bis …, rund …"; alles nass → Satz ohne
  Nachsatz; nur kurze Lücken → Nachsatz „längstens rund 15 Minuten ab ca. …".
- Shell-Check: Versions-Query `20261008r`.

Sichtprüfung: Simulator beide Designs (grüne Markierung, weicher Rand, Chip-Wechsel), Browser-
Fenster Konsole ohne Fehler.
