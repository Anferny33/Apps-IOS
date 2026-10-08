# Abendmodus: Licht und Himmel

Stand: 8. Oktober 2026 · Sonnenfeld (aufgeklappte Kachel Sonne) und Kachel Sonne, beide Designs.

## Ziel

Das aufgeklappte Sonnenfeld zeigt die Lichtzeiten des Tages: goldene Stunde und blaue Stunde
am Abend als farbige Lichtleiste mit Uhrzeiten, dieselben Phasen für den Morgen als Zeile,
dazu die erwartete Bewölkung zum Sonnenuntergang mit einer kurzen Einordnung. Liegt die
aktuelle Zeit in einer Lichtphase, nennt das Feld sie mit Restdauer und färbt sich passend
(„Abendmodus"). Die Kachel Sonne nennt die nächste goldene Stunde.

## Nicht Teil dieser Stufe

- Lichtton des Heros nach Sonnenhöhe (Zeitreise), Benachrichtigungen, Foto-Tipps.
- Mondphasen.

## Lichtzeiten

Sonnenstand nach der klassischen Sonnenaufgangsgleichung (Deklination und Zeitgleichung aus
dem Tag im Jahr, Stundenwinkel aus Breite, Deklination und Zielhöhe). Schwellen:

| Phase | Sonnenhöhe |
|---|---|
| Goldene Stunde | +6° bis −4° (über den Auf- bzw. Untergang hinweg) |
| Blaue Stunde | −4° bis −8° |
| Nacht | unter −8° |

Die Formel liegt wenige Minuten neben den Zeiten von Open-Meteo. Damit nichts widersprüchlich
wirkt, werden die Morgenzeiten um die Differenz zwischen Formel- und Open-Meteo-Aufgang
verschoben, die Abendzeiten um die Differenz beim Untergang. Breite, Länge und Zeitzonenversatz
kommen aus der Vorhersage-Antwort (`latitude`, `longitude`, `utc_offset_seconds`). Gibt es für
eine Schwelle keine Lösung (Polartag oder -nacht), entfällt die Phase.

`lightTimes(fc, dayIndex)` → `{ morning: { blueStart, goldenStart, sunrise, goldenEnd },
evening: { goldenStart, sunset, goldenEnd, blueEnd } }` als Minuten seit Mitternacht (lokal)
oder `null`. `lightPhase(times, nowMin)` → `{ phase: "day"|"golden"|"blue"|"night",
until, text }`, Text zum Beispiel „Jetzt goldene Stunde · noch 23 min", „Goldene Stunde ab
17:52", „Blaue Stunde bis 19:17", nachts „Nacht · goldene Stunde morgen ab 07:35".

## Bewölkung zum Sonnenuntergang

Die Stundenabfrage lädt zusätzlich `cloud_cover`, `cloud_cover_low`, `cloud_cover_high`. Zum
Untergang wird zwischen den beiden umliegenden Stunden interpoliert. Einordnung in dieser
Reihenfolge: tief ≥ 60 % → „tiefe Wolken, Untergang wahrscheinlich verdeckt"; gesamt ≤ 20 % →
„klar, wenig Farbe"; hoch ≥ 30 % und tief < 40 % → „hohe Wolken, gute Chance auf Farbe"; sonst
„wechselnd bewölkt". Satz: „Zum Untergang N % Wolken, tief T %: <Einordnung>." Fehlen die
Werte, entfällt der Satz.

## Darstellung

- **Lichtleiste** (Block `light` im Sonnenfeld, nach den Fakten): ein Balken von einer Stunde
  vor Beginn der goldenen Stunde bis zum Ende der blauen Stunde plus 20 Minuten, Segmente Tag
  (hell), goldene Stunde (Goldverlauf), blaue Stunde (Blauverlauf), Nacht (dunkel), Breiten
  proportional zur Zeit. Darunter die Uhrzeiten von Beginn der goldenen Stunde, Untergang und
  Ende der blauen Stunde. Ein Punkt markiert „jetzt", wenn es im Bereich liegt.
- **Phasenzeile** über der Leiste: der Text aus `lightPhase`.
- **Morgenzeile** darunter: „Morgens blaue Stunde ab 06:40, goldene Stunde bis 08:05."
- **Bewölkungszeile** darunter.
- **Abendmodus**: das Feld trägt `gold` bzw. `blue`, solange die Phase läuft: warmer bzw.
  blauer Verlauf im Hintergrund, Übergang 0,8 s. Beide Designs.
- **Kachel Sonne**: die zweite Zeile wird zu „Aufgang 07:22 · goldene Stunde ab 17:52"
  (nach dem Untergang: „… · morgen ab 07:35"); die Tageslänge steht weiter im Feld.

## Tests (`tests/smoke-design.js`, Mock München 25.09.2026, 14:15, Aufgang 07:12, Untergang 19:05)

- `lightTimes` abends: goldene Stunde 18:24 bis 19:24, blaue Stunde bis 19:44; morgens: blaue
  Stunde ab 06:33, goldene Stunde 06:53 bis 07:53 (verankerte Werte).
- `lightPhase` um 14:15 → „Goldene Stunde ab 18:24"; um 18:40 → „Jetzt goldene Stunde · noch
  44 min"; um 19:30 → „Jetzt blaue Stunde · noch 14 min"; um 21:00 → nachts mit „morgen ab 06:53".
- Bewölkungssatz aus den Mock-Werten; Einordnung für konstruierte Werte (tief 70 → verdeckt,
  gesamt 10 → klar, hoch 40/tief 10 → Farbe).
- Sonnenfeld enthält Leiste mit vier Segmenten, Zeiten, Morgenzeile, Bewölkungszeile; Kachel
  Sonne nennt „goldene Stunde ab 18:24".
- Shell-Check: Versions-Query `20261008u`.
