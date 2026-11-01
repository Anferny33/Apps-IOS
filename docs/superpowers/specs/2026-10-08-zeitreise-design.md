# Zeitreise, Stufe 1: Stunde antippen, Hero verwandelt sich

Stand: 8. Oktober 2026 · Bento-Startseite (`index.html`, `design.js`, `modern.css`, `design.css`)

## Ziel

Ein Tipp auf eine Stunde in der Leiste „Nächste Stunden" zeigt das Wetter dieser Stunde im
Hero-Feld: Farbe, Icon, Temperatur, Beschreibung und drei Kennzahlen. Die Vorschau ist
unmissverständlich als Prognose beschriftet („Morgen, 17 Uhr") und lässt sich jederzeit mit
„Jetzt" beenden. Wischen scrollt die Leiste weiterhin wie gewohnt.

## Nicht Teil dieser Stufe

- Ziehen über die Stunden (Scrubbing). Kommt als Stufe 2 nach einem Test auf dem iPhone.
- Kacheln, Hinweisfeld und Tagesliste folgen der Stunde nicht.
- Dämmerungston nach Sonnenhöhe, Bewölkung pro Stunde.
- Automatische Rückkehr zu „Jetzt" nach einer Wartezeit.
- Die klassische Seite `klassisch.html` bleibt unverändert.

## Verhalten

1. **Auswählen.** Tipp auf eine Spalte der Stundenleiste wählt diese Stunde. Die Spalte wird
   markiert, das Hero zeigt die Stunde. Tipp auf eine andere Spalte wechselt die Auswahl.
   Tipp auf die bereits gewählte Spalte ändert nichts.
2. **Zurück zu Jetzt.** Zwei Wege, beide gleichwertig: der Knopf „Jetzt" im Hero (nur in der
   Vorschau sichtbar) und die Spalte „Jetzt" ganz links in der Leiste. Danach zeigt das Hero
   wieder das aktuelle Wetter mit den Chips Hoch, Tief, Gefühlt.
3. **Wischen scrollt.** Keine Modusumschaltung, keine Änderung an `touch-action` oder am
   Scrollverhalten der Leiste.
4. **Tipps auf Spalten starten keine Animationen neu.** Der vorhandene Tipp-Neustart
   (`restartAnimations`) gilt weiter für Tipps auf den Rest des Stundenfelds und alle anderen
   Felder. Ein Tipp aufs Hero startet dessen Animationen neu und zählt die Temperatur auf den
   gerade angezeigten Wert hoch, auch in der Vorschau.
5. **Jedes Neurendern beendet die Vorschau**: Aktualisieren-Knopf, Standortwechsel, Rückkehr in
   die App (löst heute schon `load()` aus), neue Daten. Begründung: neue Daten verschieben
   „Jetzt", eine alte Auswahl wäre dann irreführend.
6. **Nur das Hero folgt.** Die Grundfarbe der Seite (`--hero`) wird über die Body-Klasse
   `theme-*` gesetzt und färbt auch Tab-Pille und Hinweis-Icon. Das bleibt so; die Seite
   stimmt sich auf die Vorschau ein, genau wie heute auf einen Wetterwechsel.

## Hero in der Vorschau

Die Markup-Struktur des Heros bleibt identisch (`.meta`, `.main` mit `.temp` und Icon,
`.chips`), damit kein bestehendes CSS angepasst werden muss. In der Vorschau wird das Hero
**in place** aktualisiert, nicht per `innerHTML` neu aufgebaut, damit laufende Icon-Schleifen
und der Text-Knoten der Temperatur erhalten bleiben.

| Element | Jetzt (wie heute) | Vorschau |
|---|---|---|
| Meta links | „Donnerstag, 17:05" | „Heute, 20 Uhr" / „Morgen, 17 Uhr" / „Samstag, 9 Uhr" |
| Meta rechts | Beschreibung aktueller Wettercode | Beschreibung Wettercode der Stunde (`wmo(code)[1]`), daneben der Knopf „Jetzt" |
| Temperatur | `current.temperature_2m` | `hourly.temperature_2m[i]` |
| Icon | `heroIcon(current.weather_code, current.is_day)` | `heroIcon(hourly.weather_code[i], hourly.is_day[i])` |
| Chips | Hoch, Tief, Gefühlt | „Gefühlt 14°", „Regen 60 %", „Wind 23 km/h" (kompakter: 12 px, gleiche Zeilenhöhe) |
| Theme | `themeFor(current)` | `themeFor(hourly[i])` |

Regeln:

- Tageswort: Datum der Stunde gleich Datum von `current.time` → „Heute"; Folgetag → „Morgen";
  sonst langer Wochentag (`longWeekday`). Stunde ohne führende Null, „9 Uhr" statt „09 Uhr".
- Regenwahrscheinlichkeit: dieselbe Rechnung wie in der Leiste (Ensemble-Anteil, sonst
  `precipitation_probability`, sonst 0). Leiste und Hero zeigen immer dieselbe Zahl.
- Fehlt ein Wert (`null`), entfällt der betreffende Chip; die Temperatur zeigt „–" ohne
  Gleiten.
- Der Knopf „Jetzt" ist ein echtes `<button>` mit `id="heroNow"`, optisch ein dunkler Chip
  (`--dark` Hintergrund, weiße Schrift) **in der Meta-Zeile rechts neben der Beschreibung**.
  Bei der Sichtprüfung zeigte sich: als vierter Chip in der Chip-Reihe bricht die Reihe auf
  dem iPhone um, das Hero wird höher und die Stundenleiste rutscht unter dem Finger weg.
  Deshalb sitzt er in der Meta-Zeile (`min-height: 24px`, Knopf 24 px hoch), die Chip-Reihe
  bleibt einzeilig: in der Vorschau 12 px Schrift bei gleicher Zeilenhöhe, auf schmalen
  Geräten wischbar statt umbrechend. Das Hero ist so in beiden Zuständen gleich hoch.
  Im klassischen Design steht der Knopf unter der Beschriftung (`order: -1` in der
  `column-reverse`-Meta).

## Markierung in der Leiste

- Jede Spalte außer „Jetzt" trägt `data-i="<globaler Stundenindex>"`. Die Spalte „Jetzt"
  trägt kein `data-i`.
- Die gewählte Spalte bekommt die Klasse `sel`: 2-px-Ring (`box-shadow: inset 0 0 0 2px
  var(--ink)`), Stundenbeschriftung fett. Im klassischen Design ist der Ring weiß. Die Klasse
  liegt auf dem bestehenden Element, der Scrollstand bleibt erhalten, die Markierung bleibt
  beim Scrollen sichtbar.
- Die Spalte „Jetzt" behält ihr dunkles Aussehen und erhält nie `sel`.

## Bewegung

- **Temperatur gleitet** in 0,5 s vom gerade angezeigten Wert zum Zielwert (Ease-out). Die
  Funktion liest die sichtbare Zahl aus dem Text-Knoten, bricht ein laufendes
  `requestAnimationFrame` desselben Elements ab und startet neu. Schnelle Tipps setzen nur das
  Ziel neu; die Anzeige fällt nie auf 0 und liegt nie mehr als 0,5 s hinter dem Finger.
  Ist die sichtbare Zahl nicht lesbar, wird der Zielwert direkt gesetzt.
- **Hintergrund**: der vorhandene Übergang `transition: background 0.8s` bleibt. Ein neues
  Ziel mitten im Übergang wird vom Browser ab der aktuellen Farbe weitergefahren.
- **Icon**: Wechsel nur, wenn sich `heroKind(code, isDay)` ändert. Dann wird das SVG ersetzt,
  das neue blendet in 0,2 s ein (Klasse `swap-in`). Bleibt die Art gleich, wird das SVG nicht
  angefasst.
- **Meta und Chips**: Inhalt wird ersetzt und blendet in 0,25 s ein (Klasse `flip`, Neustart
  über Reflow). Keine gestaffelten Einblend-Verzögerungen in der Vorschau.
- **Bewegung reduziert** (`prefers-reduced-motion: reduce`): der globale CSS-Block schaltet
  Übergänge und Animationen ab; das Gleiten prüft `matchMedia` wie `countUpEl` und setzt den
  Wert direkt.

## Zustand und Datenfluss

```
Tipp auf .hcol[data-i]  ──►  selectHour(i)  ──►  previewIdx = i
                                               ├─ Markierung: .sel von alter auf neue Spalte
                                               └─ updateHero(hourFacts(i))
Tipp auf .hcol.now / #heroNow ──► clearHour() ──► previewIdx = null
                                               ├─ .sel entfernen
                                               └─ updateHero(nowFacts())
load() → renderAllDesign() → renderHero()    ──► previewIdx = null, Hero und Leiste neu
```

- `previewIdx` (Modul-Variable in `design.js`): `null` = Jetzt, sonst globaler Stundenindex.
- `hourFacts(payload, i)` liefert `{ label, desc, temp, code, isDay, apparent, prob, wind }`
  für eine Stunde; `nowFacts(payload)` dasselbe für den aktuellen Zustand plus Hoch/Tief.
  Die Leiste nutzt `hourFacts` für ihre Wahrscheinlichkeit, damit es nur eine Rechnung gibt.
- `updateHero(facts)` aktualisiert Meta, Temperatur (gleitend), Icon (nur bei Artwechsel),
  Chips und Theme in place. `renderHero` baut beim Laden wie heute das vollständige Markup
  und bleibt Einstieg für den ersten Aufbau.
- `lastTemp` wird in der Vorschau auf die Stundentemperatur gesetzt, damit der Tipp-Neustart
  aufs Hero auf den richtigen Wert zählt.
- Die zuletzt geladenen Daten (`fc`, `ens`) müssen für `selectHour` greifbar sein; sie werden
  nach `renderAllDesign` in einer Modul-Variablen gehalten.

## Tipp-Erkennung

Erweiterung des vorhandenen Klick-Delegaten auf `document.body`:

1. Trifft der Tipp `#heroNow` → `clearHour()`, fertig.
2. Trifft der Tipp eine `.hcol` mit `data-i` → `selectHour(+data-i)`, fertig
   (kein `restartAnimations`).
3. Trifft der Tipp eine `.hcol` ohne `data-i` (Spalte „Jetzt") → `clearHour()`, fertig.
4. Sonst wie heute (Feld-Neustart, Zähler).

## Fehlerfälle

- Ungültiger Index (außerhalb `hourly.time`, keine Daten geladen): `selectHour` tut nichts.
- Ensemble fehlt: Wahrscheinlichkeit aus `precipitation_probability`, wie in der Leiste.
- `is_day` fehlt: Tag annehmen (wie in der Leiste).
- Harness ohne `querySelector`-Treffer oder ohne `requestAnimationFrame`: Markierung und
  Gleiten steigen still aus, der Inhalt wird trotzdem korrekt gesetzt.

## Tests (`tests/smoke-design.js`, Harness)

Der Harness kennt keine Klick-Delegation; die Tests rufen die Funktionen direkt auf.

- Nach dem Rendern mit Mock-Daten: `selectHour(i)` für eine Stunde von morgen → Hero enthält
  „Morgen, " und „ Uhr", `id="heroNow"`, einen Chip „Regen NN %", keinen Chip „Hoch ".
  Die Body-Klasse entspricht `themeFor` der Stunde.
- `selectHour` für eine Stunde von heute → „Heute, ".
- `clearHour()` → Hero enthält wieder „Hoch " und „Tief ", kein `id="heroNow"`;
  Body-Klasse entspricht dem aktuellen Wetter.
- `selectHour(-1)` und `selectHour(99999)` ändern nichts.
- Erneutes `renderAllDesign(payload)` während einer Vorschau → `previewIdx === null`, Hero
  zeigt Jetzt.
- Leiste: Spalten außer der ersten tragen `data-i`, die erste nicht.
- Shell-Check: `index.html` enthält die neue Versions-Query.

Sichtprüfung im Simulator (iPhone 17 Pro) in beiden Designs: Markierung sichtbar auf weißer,
blauer und dunkler Spalte; Temperatur gleitet ohne Nullsprung bei schnellen Tipps;
Icon-Schleifen laufen bei gleichbleibender Wetterart weiter; „Jetzt" stellt das Hero wieder
her; Scrollen der Leiste unverändert.

## Auslieferung

- Beide Stylesheets (`modern.css`, `design.css`) erhalten `.hcol.sel`, `.hero-field .now-btn`,
  `.swap-in`, `.flip`.
- Versions-Query in `index.html`, `radar.html`, `klassisch.html` auf `?v=20261008m`.
- README: Absatz zur Zeitreise in der Beschreibung der Bento-Startseite.
- Vor Beginn `git pull`; ein Commit je Schritt; Push auf `claude/lignano-weather-webapp-e346s0`;
  danach Prüfung auf GitHub Pages per `curl` auf die neue Versions-Query.
