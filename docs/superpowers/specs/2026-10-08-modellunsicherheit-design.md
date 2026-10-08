# Modellunsicherheit sichtbar machen

Stand: 8. Oktober 2026 · Feld „Modellvergleich" der Bento-Startseite, beide Designs.

## Ziel

Der Modellvergleich zeigt nicht nur Tagessummen, sondern als Summenkurven je Modell, wo sich
die Regenprognosen treffen und wo sie auseinanderlaufen. Darüber steht ein verständlicher Satz
über die Übereinstimmung der Modelle. Vorgaben: Kurven und Chips auf derselben Zeitbasis
„heute / morgen"; das Ensemble-Band zunächst nur am ICON-D2; Wortwahl „einig / weitgehend
einig / uneinig", nie als Trefferwahrscheinlichkeit formuliert.

## Nicht Teil dieser Stufe

- Temperaturspanne der Modelle, weitere Größen als Regen.
- Ensemble-Bänder anderer Modelle (nur ICON-D2-EPS ist geladen).
- Die klassische Seite `klassisch.html` bleibt unverändert (nutzt weiter die Tagessummen).

## Daten

`fetchModels` fragt zusätzlich `hourly: "precipitation"` ab (die Tagessummen bleiben für die
klassische Seite). Die Antwort enthält je Modell `hourly.precipitation_<id>` über drei Tage ab
0 Uhr heute. Die Bento-Seite rechnet **alles aus den Stundenwerten**: Chip-Werte heute und
morgen sind die Summen der Stunden des jeweiligen Datums, die Kurven die laufenden Summen.
So entsprechen die Endpunkte der Kurven exakt den Chips. Fehlen die Stundenwerte, bleibt die
bisherige Darstellung aus den Tagessummen ohne Kurven.

Das ICON-D2-Ensemble (20 Läufe plus Hauptlauf, zwei Tage ab 0 Uhr heute) liefert je Lauf die
laufende Tagessumme; das Band ist je Stunde das 10- bis 90-Prozent-Quantil dieser Summen.

## Darstellung im Feld

Reihenfolge: Satz zur Übereinstimmung, Kurvenbild, Chips, Ensemble-Zeile.

**Kurvenbild** (inline SVG, `viewBox 0 0 320 96`, gleichmäßig skaliert): zwei Tafeln „Heute"
(x 10 bis 150) und „Morgen" (x 170 bis 310), Grundlinie y 80, Oberkante y 14, gemeinsame
y-Skala für beide Tafeln (Maximum aller Tagessummen und des Bandes, mindestens 1 mm).
Je Modell und Tafel ein Pfad `class="ml m-<id>"` mit 25 Punkten (0 Uhr bis 24 Uhr),
`pathLength="1"`. Das hervorgehobene Modell trägt `hl`, Standard ICON-D2. Das Band liegt als
Polygon `class="band"` hinter den Linien der jeweiligen Tafel und ist nur sichtbar, solange
ICON-D2 hervorgehoben ist. In der Tafel „Heute" markiert eine gestrichelte Senkrechte `now`
die aktuelle Stunde. Tafelbeschriftung oben links, Endwert des hervorgehobenen Modells rechts
am Linienende („4,3 mm"). Linien anderer Modelle dünn und grau, das hervorgehobene Modell
kräftig in Tintenfarbe; klassisches Design: Linien halbtransparent weiß, hervorgehoben weiß,
Band hellblau.

**Chips** wie heute (Name, heute / morgen), zusätzlich `data-model="<id>"`; der hervorgehobene
Chip trägt `hl`. Tipp auf einen Chip hebt dessen Linie hervor (Klassenwechsel, kein
Neurendern); der Tipp startet nicht den Animations-Neustart des Feldes.

**Satz zur Übereinstimmung** für morgen (immer) und für heute (nur vor 12 Uhr), aus den
Tagessummen der Modelle, Regen ab 0,5 mm:

| Lage | Text |
|---|---|
| kein Modell nass | „Für morgen sind sich die Modelle einig: trocken." |
| alle nass, Spanne ≤ max(2 mm, halber Median) | „Für morgen sind sich die Modelle einig: Regen, um M mm." |
| alle nass, Spanne größer | „Für morgen sind sich die Modelle weitgehend einig: Regen, aber die Menge schwankt zwischen A und B mm." |
| mindestens drei Viertel nass oder trocken | „Für morgen sind sich die Modelle weitgehend einig: N von M rechnen mit Regen." |
| sonst | „Für morgen sind sich die Modelle uneinig: N von M rechnen mit Regen." |

Weniger als zwei Modelle: kein Satz.

**Ensemble-Zeile**: „ICON-D2-Ensemble, morgen: A bis B mm, Median M mm · N von K Läufen mit
Regen." Zählwerte statt Prozent, damit nichts wie eine Trefferwahrscheinlichkeit wirkt.

**Bewegung**: Linien zeichnen sich beim Laden in 1,6 s (Strichversatz über `pathLength`),
gestaffelt je Modell; Band blendet in 1,2 s ein; Tipp aufs Feld startet beides neu
(`restartAnimations`). Bewegung reduziert: sofort da.

## Funktionen (`design.js`)

```
modelDays(md)                  → { dates: [heute, morgen], hourIdx: { date: [indizes] } } aus md.hourly.time
modelSums(md)                  → [{ id, name, sub, today, tomorrow, cum: { today: [25], tomorrow: [25] } }]
ensembleBand(ens, date)        → { lo: [25], hi: [25], sums: [je Lauf] } oder null
agreementText(dayWord, sums)   → Satz oder ""
modelChartSvg(models, band, nowHour, hl) → SVG-Markup
highlightModel(id)             → Klassen hl auf Pfaden und Chips, Band ein/aus
dModels(md, fc, ens)           → Feld rendern (nutzt die Funktionen oben)
```

Der Klick-Delegat in `initReplay` behandelt `.mchip` vor dem Feld-Neustart.

## Tests (`tests/smoke-design.js`, Mock: Jetzt = 25.09. 14:15)

`mockModels()` bekommt `hourly` passend zu den Tagessummen: heute 0, morgen 2+i mm in den
Stunden 12 bis 15, übermorgen 9+2i mm in den Stunden 8 bis 17 (i = Modellindex 0..4, ARPEGE
fehlt). Erwartungen:

- Chips: fünf Modelle, Werte „0 / 2,0" bis „0 / 6,0", ICON-D2 mit `hl`, `data-model`.
- SVG: zehn Pfade `ml` (fünf je Tafel), `m-icon_d2 hl`, zwei `band`-Polygone, ein `now`.
- Satz morgen: „Für morgen sind sich die Modelle weitgehend einig: Regen, aber die Menge
  schwankt zwischen 2,0 und 6,0 mm." (Spanne 4 mm > max(2, 2)).
- Satz heute entfällt (14:15 ist nach 12 Uhr).
- Ensemble-Zeile enthält „morgen" und „14 von 21 Läufen mit Regen".
- `agreementText` direkt: alle trocken → „einig: trocken."; 3 von 6 nass → „uneinig".
- `highlightModel('gfs_seamless')` läuft ohne Fehler (Harness ohne Treffer).
- Shell-Check: Versions-Query `20261008p`.

Sichtprüfung: Simulator beide Designs (Kurven, Band, Chip-Tipp wechselt die Hervorhebung,
Feld-Tipp zeichnet neu), Browser-Fenster Konsole ohne Fehler.
