# Zeitreise, Stufe 2: Ziehen vom Griff

Stand: 8. Oktober 2026 · baut auf `2026-10-08-zeitreise-design.md` (Stufe 1) auf.

## Ziel

Nach dem Tipp aus Stufe 1 trägt die gewählte Stunde den Ring. Dieser Ring ist der Griff:
Beginnt ein Fingerweg auf der markierten Spalte und geht waagerecht, folgt die Auswahl dem
Finger Stunde für Stunde, Ring und Hero wandern mit. Beginnt der Fingerweg auf einer anderen
Spalte, scrollt die Leiste wie gewohnt. Kein Timer, keine Wartezeit.

## Nicht Teil dieser Stufe

- Halten und ziehen von beliebigen Spalten (Vorschlag B/C).
- Kacheln oder Hinweisfeld folgen der Stunde nicht.
- Haptisches Feedback.

## Verhalten

1. **Griff.** Nur die Spalte mit Klasse `sel` startet ein Ziehen. Touch oder Maus beginnt dort.
2. **Richtungssperre beim ersten Bewegungsereignis.** Ist die senkrechte Bewegung größer als
   die waagerechte und mindestens 3 px, wird die Geste freigegeben: kein Ziehen, die Seite
   scrollt nativ. Sonst beginnt das Ziehen und das Bewegungsereignis wird abgefangen
   (`preventDefault`, Listener `passive: false`), damit die Leiste nicht scrollt. Die
   Entscheidung fällt beim ersten Ereignis, weil iOS spätere Abbrüche ignoriert.
   Zusätzlich trägt die Griff-Spalte `touch-action: pan-y`: iOS beginnt von dort aus nie ein
   waagerechtes Scrollen, senkrechtes bleibt erlaubt.
3. **Während des Ziehens.** Die Spalte unter dem Finger (`elementFromPoint`) wird gewählt,
   wenn sie sich ändert: Ring wandert, Hero folgt. Liegt der Finger auf der Spalte „Jetzt",
   endet die Vorschau (`clearHour`), das Ziehen bleibt aktiv, weiter nach rechts wählt wieder.
   Innerhalb von 36 px vom linken oder rechten Rand der Leiste rollt die Leiste in diese
   Richtung weiter (6 px je Bild), die Spalte unter dem Finger wird dabei fortlaufend neu
   bestimmt.
4. **Loslassen** (`touchend`, `touchcancel`, `mouseup`) beendet das Ziehen. Die Auswahl bleibt
   wie in Stufe 1. Das Hero blendet Meta-Zeile und Chips einmal kurz über (Settle).
5. **Bewegung während des Ziehens** bleibt leicht: Temperatur gleitet (0,5 s), Icon wechselt bei
   anderer Wetterart, Meta und Chips tauschen den Text ohne Überblendung. Die Überblendung
   kommt erst beim Loslassen.
6. **Sichtbarkeit.** Während des Ziehens trägt die Leiste `scrubbing`; die Griff-Spalte hebt
   sich leicht (`translateY(-2px) scale(1.04)`, weicher Schatten). Desktop: `cursor: grab` auf
   dem Griff, `grabbing` während des Ziehens. Text in der Leiste ist nicht markierbar
   (`user-select: none`, `-webkit-touch-callout: none`).
7. **Tipps nach dem Ziehen.** Nach einem Touch-Ziehen feuert iOS keinen Klick. Nach einem
   Maus-Ziehen ignoriert der Klick-Delegat Klicks innerhalb von 300 ms, damit kein
   Animations-Neustart des Stundenfelds ausgelöst wird.
8. **Bewegung reduziert**: kein Anheben, sonst alles gleich.

## Zustand und Funktionen (`design.js`)

```
scrub = { pending, active, x0, y0, lastX, lastY, raf, endedAt }

scrubStart(x, y, col)  → true, wenn col die Klasse sel trägt (pending = true), sonst false
scrubMove(x, y)        → "release" (senkrecht, Geste frei), "scrub" (aktiv, Ereignis abfangen), "idle"
scrubEnd()             → active/pending = false, Leiste ohne scrubbing, settleHero()
columnAt(x, y)         → .hcol unter dem Punkt (document.elementFromPoint), sonst null
applyScrubColumn(col)  → data-i → selectHour(i, quiet) · ohne data-i → clearHour(quiet)
edgeScroll()           → requestAnimationFrame-Schleife für den Rand
settleHero()           → flip auf Meta und Chips
```

`selectHour(gi, quiet)`, `clearHour(quiet)` und `updateHero(f, quiet)` bekommen den Parameter
`quiet`: ohne Überblendung. Ereignisse werden in `initScrub()` (innerhalb `initDesignApp`) am
Container `#hourly` gebunden (Delegation, weil die Leiste bei jedem Rendern neu entsteht):
`touchstart`, `touchmove` (`passive: false`), `touchend`, `touchcancel`, `mousedown`; `mousemove`
und `mouseup` am `window`.

## Fehlerfälle

- `elementFromPoint` fehlt (Harness) → `columnAt` liefert `null`, Ziehen ändert nichts.
- Leiste ohne `getBoundingClientRect().right` oder ohne `requestAnimationFrame` → kein
  Randrollen.
- Ziehen beginnt, Daten werden währenddessen neu gerendert (Aktualisieren): `selectHour`
  prüft `lastData`, die alte Spalte ist weg, nächstes Ereignis findet neue Spalten; `scrubEnd`
  räumt auf.

## Tests (`tests/smoke-design.js`)

Der Harness kennt keine Touch-Ereignisse; die Tests prüfen die Zustandsmaschine direkt und
ersetzen `columnAt` durch einen Stub (`sb.columnAt = …`).

- `scrubStart` auf einer Spalte ohne `sel` → `false`; mit `sel` → `true`.
- Erster Zug waagerecht (dx 4, dy 2) → `"scrub"`, `scrubActive()` true, Hero zeigt die Stunde
  des Stubs; zweiter Zug auf eine andere Stunde → Hero wechselt; `scrubEnd()` → inaktiv,
  Auswahl bleibt.
- Erster Zug senkrecht (dx 1, dy 30) → `"release"`, nicht aktiv, Hero unverändert.
- Zug auf „Jetzt" (Stub ohne `data-i`) → Hero zeigt Hoch/Tief; weiter auf eine Stunde → wieder
  Vorschau.
- Shell-Check: Versions-Query `20261008n`.

Sichtprüfung im Simulator: Tipp auf Stunde, dann vom Ring aus waagerecht ziehen → Ring und
Hero folgen, Leiste scrollt nicht; vom Ring senkrecht ziehen → Seite scrollt; Ziehen bis an
den rechten Rand → Leiste rollt weiter; von einer anderen Spalte aus wischen → Leiste scrollt
wie gewohnt; Loslassen → Auswahl bleibt, kurze Überblendung. Browser-Fenster: Maus-Ziehen,
Konsole ohne Fehler.

## Auslieferung

Beide Stylesheets, Versions-Query `?v=20261008n`, README-Satz ergänzen, Push, Pages-Prüfung.
