# Wetter-App

Statische Web-App für das Wetter am aktuellen Standort – ohne Build-Schritt,
ohne API-Schlüssel. Läuft als Homescreen-App auf dem iPhone und wird über
GitHub Pages ausgeliefert: <https://anferny33.github.io/Apps-IOS/>

## Seiten

| Datei | Inhalt |
|---|---|
| `index.html` + `design.js` | Startseite: Hero, Stundenfelder, Kacheln, 14 Tage, Modellvergleich, Ortssuche. Zeitreise: ein Tipp auf eine Stunde zeigt deren Wetter im Hero („Morgen, 17 Uhr"), „Jetzt" stellt das aktuelle Wetter wieder her. Vom Ring aus lässt sich mit dem Finger durch die Stunden ziehen. Rausgehen: Zeitfenster für Spaziergang, Radfahren, Joggen und Draußen sitzen als Vorschlag aus festen Schwellen, mit grüner Spur unter den Stunden. Modellvergleich: Summenkurven je Modell für heute und morgen, Band des ICON-D2-Ensembles, Satz zur Übereinstimmung (einig / weitgehend einig / uneinig) und Spanne der Tageshöchstwerte für morgen. Regenpausen: die Nowcast-Karte nennt die nächste trockene Phase für 15, 30 oder 60 Minuten und markiert sie grün, mit ungefähren Zeiten. Kacheln Wind, Regen und Sonne klappen per Tipp ein Instrument-Feld unter ihrer Reihe auf: Kompass mit Böenverlauf, 24-Stunden-Regenverlauf, Tageslichtbogen mit Lichtzeiten. Abendmodus im Sonnenfeld: goldene und blaue Stunde aus dem Sonnenstand (verankert an den Open-Meteo-Zeiten), Lichtleiste des Abends, Bewölkung zum Untergang, Färbung während der Phase. Nachtpalette: sobald die Sonne am Ort tiefer als −8° steht, wechseln Grund, Felder und Kacheln auf dunkle Farben (weich überblendet, Statusleiste folgt); nachts zeigt die UV-Kachel den Höchstwert von morgen mit Mondphase, und ohne nennenswerte Pollen zeigt ihr Platz die Sichtweite mit Nebelhinweis. Der Schalter oben rechts erzwingt Tag oder Nacht bis zum nächsten Sonnenwechsel. Ansicht nach Frage: die Chips Überblick, Regen, Wind, Wärme und Licht über den Stunden färben Stundenstreifen und Tagesliste um und beantworten die Frage für die nächsten 24 Stunden in einem Satz; die Wahl bleibt gespeichert |
| `modern.css` | Bento-Design mit Tag- und Nachtpalette: flache Farbfelder, Hero-Feld in Wetterfarbe, Schrift Sora. Animationen: Sonne/Wolke fahren je nach Wetterlage ein, Bereiche blenden gestaffelt ein, Kacheln mit Mikroanimationen (Wind, Regen, Sonnenbogen, Tropfen, Druckzeiger) |
| `proxy/` | Cloudflare Worker für die NINA-Meldungen (kein CORS bei warnung.bund.de): ermittelt den Kreis zum Punkt über den BKG-Dienst, liefert bereinigte Meldungen mit CORS-Freigabe. Läuft unter `https://wetter-nina-proxy.anferny-wetter.workers.dev`, Adresse steht in `wetter-core.js` (`NINA_PROXY`) |
| `icons/`, `manifest.webmanifest` | App-Icon im Bento-Design (`icon.svg` ist die Quelle, die PNGs sind daraus gerendert) und Web-Manifest für den Homescreen |
| `sonne.js` | Sonnen- und Mondrechnung für Startseite und Radar: Auf- und Untergang für beliebige Sonnenhöhen, Nachtentscheidung (Sonne tiefer als −8°, Polarfälle), Mondphase, Handwahl des Tag/Nacht-Schalters |
| `sw.js` | Offline-Hülle: Service Worker hält Seiten, Stylesheet, Skripte und Icons vor (Netz zuerst, sonst Cache; Schriften und Kartenbibliothek aus dem Cache), Datenquellen laufen unverändert über das Netz. Versionskonstante wie die Versions-Query der Seiten |
| `wetter-core.js` | Datenschicht der Startseite: Open-Meteo (Forecast, Ensemble, Modelle, Luftqualität, Geocoding), DWD- und NINA-Warnungen, Cache, Standort- und Suchortspeicher |
| `radar.html` + `radar.js` | Regenradar: MapLibre GL JS mit eigener Vektorkarte (OpenFreeMap, OpenMapTiles-Schema, ohne Schlüssel) und DWD RADOLAN RV über WMS. Zeitachse und Grenze Beobachtung/Prognose aus den Produktmetadaten; je Zeitpunkt ein Bild des Ausschnitts mit Rand, begrenzter Cache, zwei Bildebenen mit Überblendung, Pause im Hintergrund und beim Verschieben der Zeitachse |
| `box-breathing.html` | Atemübung (eigenständig) |
| `design.html`, `lignano-*.html` | Nur Weiterleitungen für alte Homescreen-Icons |

Datenquellen: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0), [OpenFreeMap](https://openfreemap.org/) (Vektorkarte, Daten © OpenStreetMap-Mitwirkende, ODbL), [DWD Geodienste](https://www.dwd.de/DE/leistungen/geodienste/geodienste.html) (CC BY 4.0: Radar und amtliche Wetterwarnungen per WFS `dwd:Warnungen_Gemeinden`, nur für Deutschland), [NINA / warnung.bund.de](https://nina.api.bund.dev/) (Katastrophenschutz, Hochwasser, Polizei; über den eigenen Worker in `proxy/`, siehe dort), BigDataCloud (Ortsname), CARTO/OpenStreetMap (Karte).

## Lokal arbeiten (Mac)

```bash
git clone https://github.com/Anferny33/Apps-IOS.git
cd Apps-IOS
git checkout claude/lignano-weather-webapp-e346s0
npm start            # lokaler Server auf http://localhost:8000
```

Dann im Browser `http://localhost:8000/` öffnen. Für die Standortabfrage ist
`localhost` ein sicherer Kontext, GPS funktioniert also auch ohne HTTPS.

### iPhone-Simulator (Xcode)

1. Xcode öffnen → Menü *Xcode → Open Developer Tool → Simulator*.
2. Im Simulator Safari starten und `http://localhost:8000/` aufrufen
   (der Simulator teilt sich das Netzwerk mit dem Mac).
3. Standort vorgeben: *Features → Location → Custom Location…*
   (oder *Apple* für einen festen Testort).
4. Als Homescreen-App testen: Teilen → *Zum Home-Bildschirm*.

Nach jeder Änderung an den Dateien reicht ein Neuladen in Safari.

### Echtes iPhone im gleichen WLAN

`http://<IP-des-Macs>:8000/` funktioniert, allerdings erlaubt iOS die
Standortabfrage nur über HTTPS oder `localhost`. Für einen Test mit echtem
GPS daher den veröffentlichten Stand auf GitHub Pages verwenden oder im
Browser-Konsolenfenster `window.PREVIEW_LOC = {lat, lon, name}` setzen.

## Tests

```bash
npm test
```

Zwei Suiten laufen ohne Abhängigkeiten in Node: die Startseite (Rendering gegen
nachgebaute API-Antworten, Standort- und Suchfluss, Offline-Verhalten, Aktualität)
und das Radar (Zeitachse, Legende, Bildabruf).

```bash
npm run preview      # baut tests/iphone-preview.html: die App im iPhone-Rahmen
```

Antippen einer Kachel oder eines Feldes startet dessen Animationen neu; Dauerläufer
(Wind, Regen, Sonnenstrahlen) laufen weiter. Nach einer Änderung an `icons/icon.svg`
die PNGs mit `node tests/build-icons.js` neu rendern (braucht Playwright mit Chromium).

```bash
```

## Veröffentlichen

GitHub Pages liefert den Branch `claude/lignano-weather-webapp-e346s0` aus.
Jeder Push dorthin ist nach etwa einer Minute live; die Homescreen-App dann
einmal beenden und neu öffnen.
