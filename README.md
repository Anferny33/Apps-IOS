# Wetter-App

Statische Web-App für das Wetter am aktuellen Standort – ohne Build-Schritt,
ohne API-Schlüssel. Läuft als Homescreen-App auf dem iPhone und wird über
GitHub Pages ausgeliefert: <https://anferny33.github.io/Apps-IOS/>

## Seiten

| Datei | Inhalt |
|---|---|
| `index.html` + `design.css` + `design.js` | Startseite (Design-Variante): Hero, Stundenleiste mit Temperaturkurve, 14 Tage, Instrumente, Ortssuche |
| `klassisch.html` + `wetter.css` | Klassische Ansicht mit allen Karten (Nowcast, Ensemble, Trend, Luftqualität, Modellvergleich) |
| `wetter-core.js` | Gemeinsame Datenschicht: Open-Meteo (Forecast, Ensemble, Modelle, Luftqualität, Geocoding), Cache, Standortlogik |
| `radar.html` | Regenradar (DWD RADOLAN RV über WMS, mit 2-h-Prognose) auf Leaflet |
| `box-breathing.html` | Atemübung (eigenständig) |
| `design.html`, `lignano-*.html` | Nur Weiterleitungen für alte Homescreen-Icons |

Datenquellen: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0), [DWD Geodienste](https://www.dwd.de/DE/leistungen/geodienste/geodienste.html) (CC BY 4.0), BigDataCloud (Ortsname), CARTO/OpenStreetMap (Karte).

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

Vier Suiten laufen ohne Abhängigkeiten in Node (Rendering gegen nachgebaute
API-Antworten, Standort- und Suchfluss, Offline-Verhalten, Radar-Zeitachse).

```bash
npm run preview      # baut tests/iphone-preview.html: die App im iPhone-Rahmen
```

## Veröffentlichen

GitHub Pages liefert den Branch `claude/lignano-weather-webapp-e346s0` aus.
Jeder Push dorthin ist nach etwa einer Minute live; die Homescreen-App dann
einmal beenden und neu öffnen.
