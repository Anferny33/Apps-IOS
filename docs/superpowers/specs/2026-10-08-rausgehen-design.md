# Rausgehen: Aktivitätsfenster

Stand: 8. Oktober 2026 · Bento-Startseite, beide Designs.

## Ziel

Ein Feld „Rausgehen" direkt unter „Nächste Stunden" schlägt passende Zeitfenster für eine
gewählte Aktivität vor: Spaziergang, Radfahren, Joggen, Draußen sitzen. Die Fenster erscheinen
als eigene schmale Spur unter den Stundenspalten und als zwei bis drei Sätze mit Begründung.
Die Bewertung ist ein Vorschlag aus festen Schwellen, keine Prognose.

## Nicht Teil dieser Stufe

- Eigene Schwellen je Nutzer, weitere Aktivitäten.
- Luftfeuchte als Kriterium (müsste erst stündlich geladen werden).
- Benachrichtigungen.

## Bewertung je Stunde

Zeitraum: die 48 Stunden der Leiste (`hourlyWindow(fc, 48)`). Datenquellen: gefühlte
Temperatur, Regenwahrscheinlichkeit (dieselbe Rechnung wie in der Leiste, `hourProb`),
Niederschlag, Wind, Böen, Wettercode, Tag/Nacht, UV, Sonnenuntergang des Tages.

| Aktivität | Mindestdauer | Gefühlt | Regen max | Wind / Böen max | Licht |
|---|---|---|---|---|---|
| Spaziergang | 1 h | 5 bis 28° | 30 % | Böen 45 | Tag oder bis 1 h nach Sonnenuntergang |
| Radfahren | 2 h | 8 bis 30° | 20 % | Wind 25, Böen 40 | nur Tag |
| Joggen | 1 h | 2 bis 24° | 40 % | Böen 50 | egal |
| Draußen sitzen | 2 h | ab 17° | 20 % | Wind 15, Böen 30 | egal |

Für alle: Niederschlag unter 0,2 mm und kein Gewitter (Wettercode ab 95). Eine Stunde fällt
mit genau einem Grund durch, in dieser Reihenfolge: `kalt`, `warm`, `nass`, `wind`, `dunkel`.
Fehlt die gefühlte Temperatur, zählt die Stunde als `data` und wird übersprungen.

## Fenster

Zusammenhängende passende Stunden bilden ein Fenster; es zählt ab der Mindestdauer. Gezeigt
werden die ersten drei Fenster in Zeitreihenfolge. Ein Fenster endet mit der letzten passenden
Stunde, angezeigt wird die volle Stunde danach („15 bis 21 Uhr" = Stunden 15 bis 20).

**Satz:** `<Tageswort> <Start> bis <Ende> Uhr · <Gefühlt>°, <Regen>, <Wind>[, UV hoch]`

- Tageswort wie in der Zeitreise: Heute, Morgen, sonst langer Wochentag. Reicht ein Fenster
  über Mitternacht, steht das Tageswort auch vor der Endstunde („Heute 22 bis Morgen 4 Uhr").
- Gefühlt: Mittel der Stunden, gerundet.
- Regen: höchste Wahrscheinlichkeit im Fenster; bis 10 % „kaum Regen", sonst „Regen bis N %".
- Wind: höchster Wind im Fenster; bis 12 km/h „windstill", bis 20 „wenig Wind", sonst
  „Wind bis N km/h".
- UV: höchster UV-Index ab 6 → „UV hoch".

**Kein Fenster:** „In den nächsten 48 Stunden passt keine Zeit." plus der häufigste Grund:
`nass` → „meist zu nass", `kalt` → „meist zu kalt", `warm` → „meist zu warm", `wind` →
„meist zu windig", `dunkel` → „nur bei Tageslicht".

## Darstellung

- **Feld** `#activityField` (`field white`, Überschrift „Rausgehen", rechts „Vorschlag") mit
  `#activity`: Chip-Reihe (vier `<button class="act-chip" data-act>`; die gewählte trägt `on`),
  darunter die Fenster als `<button class="act-win" data-i="<Startindex>">` mit `<b>Zeit</b>`
  und `<span>Fakten</span>`, darunter eine `note` (Hinweis oder Kein-Fenster-Text).
- **Spur** in der Leiste: in `.strip` nach `.strip-inner` ein `<div class="act-track">` mit
  einer Zelle `<i>` je Spalte (gleiche Breite und Abstand wie die Spalten; die erste Zelle ohne
  `data-i`, alle anderen mit dem Stundenindex). Zellen passender Stunden tragen `on`, die
  erste Zelle eines Fensters `first`, die letzte `last`, alle außer der letzten `cont`
  (Balken reicht über den Spaltenabstand bis zur nächsten Zelle). Farbe: Grün der
  Statusfarbe `good` (#2E7D4F) mit 0,9 Deckung, Höhe 4 px, Übergang 0,3 s.
- Die Spur wird ohne Neurendern der Leiste aktualisiert (Klassen auf den Zellen), damit
  Scrollstand und Animationen bleiben.
- **Wahl merken:** `localStorage` Schlüssel `wetter:activity`, Standard `walk`.
- **Tipp auf ein Fenster:** Zeitreise auf die Startstunde (`selectHour`), die Spalte wird in
  die Mitte der Leiste gescrollt (`scrollIntoView`, `inline: "center"`, `block: "nearest"`).
  Tipp auf eine Spur-Zelle wirkt wie ein Tipp auf die Spalte darüber.
- **Einblenden:** Feld wie die anderen (`a-up`), Fenster-Zeilen gestaffelt wie Modell-Chips.
- Beide Designs: Chips wie die Tab-Pille (Bento: `--dark` für `on`; klassisch: Glas).

## Zustand und Funktionen (`design.js`)

```
ACTIVITIES               Tabelle oben, Objekte { id, name, minH, feel, prob, wind?, gust?, light }
activityId               gewählte Aktivität (Modul-Variable), aus localStorage
hourFail(data, act, gi)  → null (passt) oder Grund-String
activityWindows(data, act) → { windows: [{ start, end, when, facts }], reason }
activityNote(reason)     → Text für den Kein-Fenster-Fall
setActivity(id)          → speichern, Feld neu rendern, Spur aktualisieren
dActivity()              → Feld rendern aus lastData + Spur aktualisieren (in renderAllDesign nach dHourly)
updateActTrack(windows)  → Klassen auf den Zellen
initActivity()           → Klick-Delegation auf #activity (Chips, Fenster)
```

## Fehlerfälle

- Keine Stundendaten → Feld versteckt (`hidden`).
- `localStorage` nicht verfügbar → Standard `walk`, keine Ausnahme.
- Harness: `querySelectorAll` leer → Spur-Update wirkt nicht, Markup trotzdem prüfbar.

## Tests (`tests/smoke-design.js`, Mock-Daten, Jetzt = 25.09. 14:15)

- Leiste enthält `<div class="act-track">` mit 48 Zellen, 47 davon mit `data-i`.
- Feld: vier Chips, `walk` aktiv; Fenster „Heute 15 bis 21 Uhr · 10°, kaum Regen, wenig Wind",
  „Morgen 7 bis 11 Uhr · 17°, …", „Morgen 12 bis 18 Uhr · 15°, …"; `data-i="15"` am ersten.
- `activityWindows` für `sit`: „Morgen 9 bis 11 Uhr · 18°, kaum Regen, wenig Wind" und
  „Sonntag 10 bis 13 Uhr · 19°, Regen bis 20 %, windstill".
- `activityWindows` für `run`: zweites Fenster „Heute 22 bis Morgen 4 Uhr · 4°, …".
- Unmögliche Aktivität (`feel: [40, 50]`) → keine Fenster, `reason === "kalt"`,
  `activityNote` enthält „meist zu kalt".
- `setActivity("sit")` → Chip `sit` aktiv, Liste zeigt „Morgen 9 bis 11 Uhr", Speicher
  `wetter:activity === "sit"`.
- Shell-Check: Versions-Query `20261008o`, `index.html` enthält `id="activityField"`.

Sichtprüfung: Simulator beide Designs (Spur unter den Spalten, Chips wechseln, Tipp auf
Fenster springt ins Hero und scrollt die Leiste), Browser-Fenster Konsole ohne Fehler.
