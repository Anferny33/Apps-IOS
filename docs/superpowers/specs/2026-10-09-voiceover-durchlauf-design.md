# VoiceOver-Durchlauf – Befund und Korrekturen

Stand: 9. Oktober 2026. Der Simulator hat kein VoiceOver und iPhone-Synchronisierung ist in der EU
gesperrt. Ersatz: ein XCUITest (`tests/ax-dump/`) liest den Bedienungshilfen-Baum von Safari im
Simulator aus, also Rollen, Beschriftungen, Werte und Reihenfolge, genau das, womit VoiceOver
arbeitet. Geprüft wurden die Startseite (alle Abschnitte), Einstellungen, Herkunftsblatt,
aufgeklappter Verlauf, aufgeklappte Wind-Kachel, weitere Tage und das Radar-Blatt.

## In Ordnung

Kopfzeile, Hero und Chips, Hinweisfeld, Ansichten, Stundenspalten mit Satz je Stunde, Rausgehen,
Highlights als Sprungknöpfe, Kacheln mit Überschrift Ebene 3 und Disclosure-Knopf samt Zustand,
Diagrammsätze, 14 Tage als ein Satz je Zeile, Modellvergleich-Sätze, Fußzeile mit Links,
Tab-Leiste, Einstellungen (Überschriften, Chip-Gruppen mit Druckzustand, Pfeilknöpfe mit
Feldnamen), Herkunftsblatt (Überschriften und Absätze), Radar-Knöpfe und Zeitmarke.

## Befunde und Korrekturen

1. Geschlossene Blätter (Ort suchen, Regenradar, Einstellungen, Woher kommt das?) standen mit
   allen Knöpfen im Baum, Vorleser lasen sie am Seitenende. Korrektur: `visibility: hidden` im
   geschlossenen Zustand, beim Öffnen sofort sichtbar, beim Schließen erst nach dem Hinausgleiten.
2. Zugeklappte Detailfelder (Wind, Regen, Sonne, Sicht, Verlauf) und die weiteren sieben Tage
   waren lesbar, obwohl unsichtbar. Korrektur wie 1 an `.tpanel` und `.more-wrap`.
3. Modell-Chips waren vier lose Texte („ICON-D2“, „0,2“, „/“, „8,8“) und per Tastatur nicht
   erreichbar, obwohl antippbar. Korrektur: Schaltflächen mit Satz („ICON-D2: heute 0,2 mm,
   morgen 8,8 mm“) und Druckzustand.
4. Tab-Leiste ohne aktuellen Bereich. Korrektur: `aria-current="page"` am aktiven Link.
5. Sichtbar-Schalter in „Startseite anpassen“ hießen nur „Sichtbar“. Korrektur: „Hinweis sichtbar“.
6. Knopf „Weitere 7 Tage“ ohne Zustand. Korrektur: `aria-expanded`.
7. Live-Region stand mitten in der Lesereihenfolge (nach den Hero-Chips). Korrektur: ans Seitenende.
8. Fußzeile: Mittelpunkte als eigene Elemente. Korrektur: `aria-hidden`.
9. Radar: Marker „Map marker“ (englisch, als Knopf), „Toggle attribution“, Kartenfläche „Map“;
   Zeitregler nannte nur die Positionsnummer; Farbskala las sich als Zahlenreihe. Korrektur:
   deutsche `locale` der Kartenbibliothek, Marker als Bild „Gewählter Ort: …“, `aria-valuetext`
   mit Zeit und Art, ein Satz für die Farbskala, Balken und Skala stumm.
10. Beim Prüfen fiel auf, dass der Simulator im Radar-Blatt die alte Radarseite aus dem HTTP-Cache
    zeigte. Korrektur: das Blatt lädt `radar.html?embed=1&v=<Version>` (Version aus der eigenen
    Skript-URL), und der Service Worker holt die Hülle beim Installieren mit `cache: "reload"`.

## Offen

- Ansichten-Chips als Tab-Leiste (role tablist/tab, „1 von 5“) statt Druckknöpfe; Designfrage.
- Tageszeilen sprechen als „Bild“ (role img); Alternative role text prüfen.
- Mittelpunkt-Trenner in Kacheltexten: auf dem Gerät hören, ob VoiceOver sie vorliest.
- Stundenstreifen: 48 Schaltflächen am Stück; Sprungmarke oder Zusammenfassung, falls es stört.
- Gegencheck mit echtem VoiceOver (Wischen, Rotor), wenn es passt.
