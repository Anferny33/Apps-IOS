# Vorhersage von Open-Meteo auf WeatherKit umstellen – Design

Stand: 30. Oktober 2026. Status: Entwurf nach Prüflesung durch einen Umsetzer-Agenten (neun
Punkte eingearbeitet), wartet auf Freigabe. Noch nicht committet.

## Warum

Goldstunde soll als bezahlte App (Einmalkauf, Richtwert 2,99 €) in den App Store. Die
Vorhersage kommt heute vom kostenlosen Zugang von Open-Meteo, und der ist laut deren
Nutzungsbedingungen nur für nicht-kommerzielle Nutzung erlaubt („Websites or apps that have
subscriptions or display advertisements“ und „Commercial products“ gelten als kommerziell; nur
freiwillige Spenden bleiben zulässig). Das kommerzielle Abo von Open-Meteo kostet mehr, als die
App einbringen soll. WeatherKit ist in der Mitgliedschaft im Apple Developer Program enthalten
(500 000 Abrufe im Monat), ausdrücklich für verkaufte Apps gedacht und verlangt nur eine
Quellenangabe.

Das Ziel des Users: Lern- und Spaßprojekt, das die Jahresgebühr von 99 € wieder einspielt. Die
App ist eine allgemeine Wetter-App für beliebige Orte, Kernzielgruppe deutschsprachige Nutzer.

## Ziele

- Jede Vorhersage- und Nowcast-Zahl in der App stammt aus einer Quelle, deren Lizenz den Verkauf
  der App erlaubt. Nach dem Umbau ruft weder die App noch der Worker eine Open-Meteo-Adresse auf.
- Die Darstellung (`design.js`, 4 460 Zeilen) bleibt so weit wie möglich unverändert. Dafür
  liefert ein Adapter die WeatherKit-Antwort in genau der Form, die `design.js` heute von
  Open-Meteo bekommt (Feldnamen, Ortszeit-Strings, WMO-Codes).
- Der geheime WeatherKit-Schlüssel bleibt im Worker. Die App enthält kein Geheimnis.
- Alle vier Testsuiten laufen weiter grün; die Open-Meteo-Fixtures werden durch
  WeatherKit-Fixtures ersetzt, nicht ergänzt.

## Nicht-Ziele

- Die Capacitor-Hülle, Push über APNs und alles andere aus Phase 3 der Veröffentlichungs-
  Checkliste (`docs/veroeffentlichung.md`). Das bleibt ein eigenes Paket.
- Apples Wetterwarnungen (`weatherAlerts`). Deutschland ist über DWD und NINA abgedeckt;
  Apples Warnungen für Deutschland stammen ebenfalls vom DWD und würden doppelt erscheinen.
  Kann später als Ergänzung für das Ausland kommen.
- Ein Ersatz für den Modellvergleich. Es gibt keine kostenlose, kommerziell nutzbare Quelle, die
  sechs Modelle für beliebige Orte liefert. Die Kachel entfällt.
- Radar (`radar.html`, `radar.js`): nutzt DWD und OpenFreeMap, bleibt unverändert.

## Anti-Ziele

Was den Umbau scheitern ließe, auch wenn er technisch läuft:

- Eine Vorhersage, die anders aussieht als vorher (andere Icons, anderes Hero, fehlende Chips),
  weil Felder nicht sauber übersetzt wurden. Der Adapter ist fertig, wenn die bestehenden
  Smoke-Tests mit einer WeatherKit-Fixture dieselben Ergebnisse liefern wie heute.
- Ein Worker, der WeatherKit-Daten an jeden ausliefert, der die Adresse kennt. Der Worker
  antwortet nur erlaubten Origins; der 500 000er-Topf ist für die App da.
- Erfundene Werte. Was WeatherKit nicht liefert (Sonnenscheindauer, Regenstunden), wird nicht
  geschätzt, sondern weggelassen und die betroffene Anzeige angepasst.
- Verstöße gegen Apples Attributionspflicht (Logo plus Link).

## Randbedingungen

- WeatherKit REST: `GET https://weatherkit.apple.com/api/v1/weather/de/{lat}/{lon}` mit
  `dataSets=currentWeather,forecastHourly,forecastDaily,forecastNextHour`, `timezone=<IANA>`,
  `hourlyStart`/`hourlyEnd`, `dailyStart`/`dailyEnd` (ISO 8601, UTC; Vergangenheit erlaubt).
  Antwort in metrischen Einheiten (°C, km/h, mm, hPa, Sicht in m), Zeiten in UTC mit `Z`.
  Stündlich bis 240 Stunden, täglich 10 Tage, Minutenvorhersage 60 Minuten (nicht überall;
  die Antwort lässt `forecastNextHour` dann weg).
- Token: JWT ES256, Header `{alg, kid: <Key-ID>, id: <Team-ID>.<Service-ID>}`, Claims
  `{iss: <Team-ID>, sub: <Service-ID>, iat, exp}`. Signiert mit dem .p8-Schlüssel aus dem
  Entwicklerkonto (WeatherKit-Haken auf Schlüssel und Service-ID). `Authorization: Bearer`.
- Attribution: `GET https://weatherkit.apple.com/attribution/de` liefert Logo-Adressen und den
  Namen. Pflicht laut Apple: Apple-Wetter-Logo und Link anzeigen, wo die Daten erscheinen.
- Der Worker (`proxy/`, Cloudflare, freier Tarif: 100 000 Anfragen am Tag) hat bereits
  ES256-Signatur mit WebCrypto (`webpush.js`), KV-Speicher, Origin-Prüfung (`ALLOWED_ORIGINS`)
  und einen 15-Minuten-Cron.
- `design.js` arbeitet durchgehend mit Ortszeit-Strings (`"2026-10-30T14:00"`), nie mit
  Date-Objekten in UTC. `splitPastDay` trennt den Vortag per Datum ab. Zeitstempel der
  15-Minuten-Werte markieren das Intervall-ENDE (`intervalStart` rechnet zurück).
- Sieben Fetches laufen in `load()` parallel per `Promise.allSettled`; nur der Forecast ist
  Pflicht, alle anderen Teile sind heute schon optional (`null` blendet aus).
- Versionsschema `2026MMDDx` an 11 Stellen plus `manifest.webmanifest`, `sw.js` und
  `docs/stand.md`; Tests lesen die Version aus `index.html`.
- Kein Commit, Push oder Deploy ohne Zuruf des Users. Vor Beginn `git fetch` und rebase.

## Entscheidungen

Vom User getroffen (Gespräch vom 30.10.2026):

- WeatherKit wird die einzige Vorhersagequelle. Open-Meteo fällt komplett weg.
- Die App wird ein Einmalkauf ohne Abo; Preis später festgelegt.
- Kein Lignano- oder Italien-Bezug in Beispielen, Texten oder Länderabwägungen.

Meine Festlegungen (vom User noch nicht einzeln bestätigt, zur Prüfung beim Lesen):

1. **Adapter statt Umbau der Darstellung.** `wetter-core.js` bekommt `wkToForecast(wk, tz)`,
   das eine WeatherKit-Antwort in die heutige `fc`-Struktur übersetzt. `design.js` ändert sich
   nur dort, wo eine Anzeige ohne Datenquelle bleibt.
2. **Nowcast bleibt vier Stunden.** `minutely_15` wird aus zwei Teilen gebaut: die ersten vier
   Viertelstunden aus Apples Minutenvorhersage (Summe von `precipitationIntensity`/60 je Minute),
   die zwölf folgenden aus den Stundenwerten (`precipitationAmount` gleichmäßig auf vier
   Viertelstunden verteilt). Liegt keine Minutenvorhersage vor, kommen alle 16 aus den Stunden.
   Das Herkunftsblatt sagt, welche Viertelstunden minutengenau sind. Damit bleiben Hinweis,
   Schirm-Rat, Regenpausen 15/30/60 und der Regen-Alarm unverändert in ihrer Logik.
3. **Tagesliste 7 + 3 statt 7 + 7.** `DAYS_SHOWN` bleibt 7, der Knopf heißt „Weitere 3 Tage“ und
   nimmt die Zahl aus den Daten. Highlights (Tag 1 bis 7) bleiben.
4. **Regenwahrscheinlichkeit** kommt aus `precipitationChance` (Stunde und Tag). Der Ensemble-Pfad
   (`members`, `ensIndex`, `ensembleStats`, `ensembleBand`) bleibt im Code und bekommt einfach
   kein `ens` mehr; `hourProb`/`probAt` fallen damit auf den Modellwert zurück, wie heute schon
   bei fehlendem Ensemble. Später kann der Ensemble-Code entfernt werden (eigener Aufräumschritt).
5. **Modellvergleich-Kachel entfällt** samt `fetchModels`, `fetchModelMeta`, `dModels`,
   `modelSums`, `modelDays`, `modelMaxTemps`, `tempSpanText` und dem Abschnitt `src-modelle` im
   Herkunftsblatt. Die Einstellung „Startseite anpassen“ verliert den Eintrag; gespeicherte
   Reihenfolgen mit der alten ID werden still ignoriert (`layoutOrder` filtert unbekannte IDs
   bereits).
6. **Luftqualität und Pollen** werden in diesem Umbau abgeschaltet (Kachel „Luftqualität“ weg,
   „Pollen oder Sicht“ zeigt immer Sicht). Open-Meteo Air Quality unterliegt derselben Lizenz.
   Ein späterer, eigener Teil kann beides für Deutschland aus offenen Quellen zurückbringen
   (Umweltbundesamt Luftdaten-API, Datenlizenz Deutschland Namensnennung 2.0; DWD
   Pollenflug-Gefahrenindex `s31fg.json`, regional). Siehe „Spätere Teile“.
7. **Ortssuche und Ortsname** gehen auf Apple Maps Server API um (Teil 2, eigener Schritt nach
   dem Forecast). Open-Meteo Geocoding fällt unter dieselbe Lizenz; BigDataCloud wird mit
   abgelöst, damit nur eine Lizenzfrage bleibt. Bis Teil 2 fertig ist, laufen beide alten
   Aufrufe weiter (Suche und Rückwärtssuche sind keine Vorhersagedaten; der Umbau der
   Vorhersage wartet nicht darauf).
8. **Worker-Cache**: Antworten je Koordinate, gerundet auf zwei Nachkommastellen (etwa 1 km),
   zehn Minuten im Cache (Cloudflare Cache API, nicht KV). Das Token wird im Worker 50 Minuten
   wiederverwendet (Laufzeit 60 Minuten).
8a. **Zeitzone bestimmt der Worker**, nicht die App. Open-Meteo lieferte mit `timezone=auto` die
   Zone des Orts; davon hängen Tagesgrenzen, Sonnenzeiten, Nachtpalette und der Zusatz
   „Ortszeit“ bei Reiseorten ab. Der Worker nutzt das npm-Paket `tz-lookup` (Koordinate →
   IANA-Zone, etwa 70 KB, wird von wrangler gebündelt) und gibt die Zone in der Antwort mit.
   Die App schickt keine Zone. Damit funktionieren Suchorte und Reiseorte in fremden Zonen ab
   Teil 1 richtig.
9. **Zugang zum Worker**: `/wk` ist strenger als `/nina` und `/push/*`. Anfragen ohne
   Origin-Header (curl, Skripte) bekommen 403, nicht nur fremde Origins; dazu die bestehende
   Drossel `rateLimited` je IP (60 Anfragen in 10 Minuten). Erlaubt bleiben GitHub Pages,
   localhost und später `capacitor://localhost`. Die Fixture für die Tests wird deshalb mit
   `curl -H "Origin: http://localhost:8000"` gegen `npx wrangler dev` geholt. Die kostenlose
   Web-App auf GitHub Pages bleibt damit vorerst die Testumgebung für die Freundesrunde. Was
   mit ihr nach dem Store-Start passiert, ist eine offene Entscheidung des Users (siehe unten)
   und ändert an diesem Umbau nichts.
10. **Keine Sonnenscheindauer, keine Regenstunden mehr.** Beide Werte liefert WeatherKit nicht.
    Sonne-Kachel und Tageszeilen zeigen die Tageslichtdauer bzw. die Regenmenge, nie einen
    geschätzten Ersatz. Das Highlight „Sonnigster Tag“ (heute: Sonnenschein ≥ 7 h und ≥ 70 %
    des Tageslichts) bekommt eine neue Regel auf einem echten Wert: Bewölkung am Tag
    (`daily.cloud_cover_day`) höchstens 30 % und Tages-Wettercode 0 oder 1; der Tag mit der
    geringsten Bewölkung gewinnt. Der Herkunftstext zu den Highlights wird entsprechend
    geändert.

## Bauteile

### 1. Worker: Route `/wk`

Datei `proxy/src/worker.js`, neues Modul `proxy/src/weatherkit.js`.

- `GET /wk?lat=<lat>&lon=<lon>` → WeatherKit-Antwort als JSON, unverändert
  durchgereicht, mit CORS für erlaubte Origins. Validierung: lat −90..90, lon −180..180. Fehler von Apple werden
  mit Status und Grund als `{error: true, reason}` durchgereicht (die App zeigt den Grund im
  Banner wie heute bei Open-Meteo-Fehlern).
- Anfrage an Apple: `dataSets=currentWeather,forecastHourly,forecastDaily,forecastNextHour`,
  `timezone=<tz>` (aus `tz-lookup`), `hourlyStart` = Beginn des Vortags in Ortszeit (als UTC),
  `hourlyEnd` = `hourlyStart + 120 h`. Begründung: `hourlyWindow(fc, 48)` in `design.js` zählt
  ab *jetzt*, nicht ab Mitternacht; die Tests verlangen 48 Spalten. Vortag plus 120 Stunden
  deckt jetzt + 48 h zu jeder Uhrzeit und liefert für die ersten drei Vorhersagetage
  Stundenwerte für Wind-Maxima. `dailyStart` = heute (Ortszeit), `dailyEnd` = heute + 10 Tage:
  WeatherKit liefert höchstens zehn Tage, und ein Vortag in `forecastDaily` würde die
  Tagesliste auf 7 + 2 verkürzen. Der Vortag der Tageswerte (`fc.past.daily`, heute nur für das
  Frost-Highlight gebraucht) wird im Adapter aus den Stundenwerten des Vortags gebildet
  (`temperature_2m_min`, `temperature_2m_max`, `precipitation_sum`). Der Worker rechnet Vortag
  und heutiges Datum aus der Zone.
- Antwortform: `{timezone: "<IANA>", data: <WeatherKit-JSON unverändert>}`.
- Token: `signWeatherKitJwt(env)` mit `crypto.subtle.importKey("pkcs8", …)` aus
  `WEATHERKIT_PRIVATE_KEY` (PEM-Inhalt ohne Kopfzeilen, base64), `WEATHERKIT_KEY_ID`,
  `WEATHERKIT_TEAM_ID`, `WEATHERKIT_SERVICE_ID`. Die ersten drei als Geheimnisse
  (`wrangler secret put`, lokal `.dev.vars`; Wert mit `printf '%s'`, siehe Falle in
  `wetter-app-projekt`), die Service-ID in `wrangler.toml` `[vars]`. Token-Cache im Modul-Scope
  mit Ablauf.
- Cache: Schlüssel `wk:<lat2>:<lon2>:<tz>`, `Cache-Control: max-age=600`; bei Apple-Fehler kein
  Cache.
- Regen-Alarm (`checkRain`): statt Open-Meteo denselben internen Pfad `fetchWeatherKit(lat, lon)`
  (ohne HTTP-Umweg, aber über denselben Zehn-Minuten-Cache und denselben Schlüssel mit zwei
  Nachkommastellen). Abonnements werden je gerundetem Gitterpunkt zusammengefasst: ein
  Apple-Aufruf je Punkt und Lauf. Rechnung: 96 Läufe am Tag, also rund 2 900 Aufrufe im Monat je
  Punkt; bei 50 Punkten etwa 145 000 von 500 000. Überschreitet die Zahl der Punkte 100, stellt
  der Umsetzer den Cron auf 30 Minuten um (Hinweis in `proxy/README.md`). `rainAlert` bekommt
  wie heute ein `minutely_15`-Objekt mit Intervall-ENDE als Zeitstempel, das der Adapter (als
  gemeinsames Modul `proxy/src/adapter.js` oder per Kopie der Funktion, siehe „Dem Umsetzer
  überlassen“) aus `forecastNextHour` plus den folgenden Stundenwerten baut. Die Zeitzone kommt
  aus `tz-lookup` (Entscheidung 8a); das Feld `tz` im Abonnement entfällt.
- README in `proxy/` um `/wk`, die vier Werte aus dem Entwicklerkonto und die Schritte dort
  (Service-ID anlegen, WeatherKit aktivieren, Schlüssel erzeugen und .p8 herunterladen, Team-ID
  ablesen) ergänzen.

### 2. Adapter in `wetter-core.js`

`fetchForecast(loc)` ruft `WORKER_URL + "/wk?lat=…&lon=…"` und gibt
`splitPastDay(wkToForecast(json.data, json.timezone))` zurück. Die Konstante `NINA_PROXY` wird
zu `WORKER_URL` umbenannt; `window.NINA_PROXY = ""` schaltet weiterhin nur NINA ab, nicht die
Vorhersage (Test in `smoke-push.js` bleibt gültig), ein neues `window.WORKER_URL` überschreibt
die Adresse für Tests.

`wkToForecast(wk, tz)` liefert ein Objekt mit denselben Schlüsseln wie die bisherige
Open-Meteo-Antwort:

| Ziel (heutige Struktur) | Quelle in WeatherKit | Hinweis |
|---|---|---|
| `latitude`, `longitude`, `elevation` | `currentWeather.metadata.latitude/longitude` | `elevation` entfällt (null); Herkunftsblatt lässt die Höhe weg |
| `timezone`, `utc_offset_seconds` | `tz`, Versatz zum Zeitpunkt `asOf` per `Intl` | Versatz kann über die Daten hinweg wechseln (Zeitumstellung): `utc_offset_seconds` ist der Versatz jetzt; alle Zeitstrings werden einzeln umgerechnet |
| `current.time` | `currentWeather.asOf` → Ortszeit `YYYY-MM-DDTHH:MM` | |
| `current.temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`, `pressure_msl`, `cloud_cover`, `is_day` | `temperature`, `temperatureApparent`, `humidity`·100, `windSpeed`, `windGust`, `windDirection`, `pressure`, `cloudCover`·100, `daylight` → 1/0 | Anteile 0..1 werden Prozent 0..100; `daylight` (Boolean) wird 1 oder 0, weil `design.js` auf `=== 1` prüft |
| `current.precipitation`, `current.weather_code` | `precipitationIntensity` (mm/h) bleibt als `precipitation` der laufenden Stunde; `conditionCode` → WMO | |
| `hourly.time` | `forecastHourly.hours[].forecastStart` → Ortszeit | Zeitumstellungstage haben 23 oder 25 Einträge, wie heute |
| `hourly.temperature_2m`, `apparent_temperature`, `precipitation`, `precipitation_probability`, `weather_code`, `is_day`, `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`, `uv_index`, `cloud_cover`, `cloud_cover_low`, `cloud_cover_high`, `visibility`, `dew_point_2m` | `temperature`, `temperatureApparent`, `precipitationAmount`, `precipitationChance`·100, `conditionCode`→WMO, `daylight`→1/0, `windSpeed`, `windGust`, `windDirection`, `uvIndex`, `cloudCover`·100, `cloudCoverLowAltPct`·100, `cloudCoverHighAltPct`·100, `visibility`, `temperatureDewPoint` | |
| `minutely_15.time`, `.precipitation` | siehe Entscheidung 2; Zeitstempel = Intervall-ENDE | 16 Werte ab der laufenden Viertelstunde |
| `daily.time` | `forecastDaily.days[].forecastStart` → Datum | |
| `daily.weather_code`, `temperature_2m_max/min`, `precipitation_sum`, `precipitation_probability_max`, `uv_index_max`, `sunrise`, `sunset` | `conditionCode`, `temperatureMax/Min`, `precipitationAmount`, `precipitationChance`·100, `maxUvIndex`, `sunrise`, `sunset` → Ortszeit | |
| `daily.wind_speed_10m_max`, `wind_gusts_10m_max`, `wind_direction_10m_dominant` | aus `forecastDaily.days[].windSpeedMax`, `windGustSpeedMax` sofern vorhanden, sonst aus den Stundenwerten des Tages (Maximum, Richtung des Maximums); für Tage ohne Stundenwerte (ab Tag 4) `daytimeForecast.windSpeed/windDirection` | Umsetzer prüft am echten Antwortbeispiel, welche Felder Apple aktuell liefert |
| `daily.daylight_duration` | `sunset − sunrise` in Sekunden | |
| `daily.cloud_cover_day` (neu) | `daytimeForecast.cloudCover`·100 | Bewölkung am Tag in Prozent; ersetzt die Sonnenscheindauer als Grundlage für „Sonnigster Tag“ |
| `daily.sunshine_duration`, `precipitation_hours` | entfallen (Schlüssel fehlt) | Anzeigen prüfen `Array.isArray` und lassen den Wert weg |

Weitere Regeln:

- **WMO-Zuordnung** `WK_CONDITION` (Tabelle in `wetter-core.js`): Clear→0, MostlyClear→1,
  PartlyCloudy→2, MostlyCloudy→2, Cloudy→3, Foggy→45, Haze/Smoky→45, Drizzle→53,
  FreezingDrizzle→56, Rain→63, HeavyRain→65, FreezingRain→66, Sleet/WintryMix→66,
  Flurries→71, Snow→73, HeavySnow→75, BlowingSnow→75, Blizzard→75, Hail→96,
  IsolatedThunderstorms/ScatteredThunderstorms→95, Thunderstorms/StrongStorms→95,
  SunShowers→80, SunFlurries→85, TropicalStorm/Hurricane→82, Breezy/Windy→ je nach `cloudCover`
  (unter 0,3 → 1, unter 0,7 → 2, sonst 3), Hot/Frigid→ dito, BlowingDust→45. Unbekannter Code
  → 2 mit Konsolenwarnung einmal je Sitzung. `wmo()` bleibt die einzige Stelle für Symbol und
  Text; nichts in `design.js` sieht Apples Namen.
- **Zeitumrechnung** `wkLocal(iso, tz)` über `Intl.DateTimeFormat("sv-SE", {timeZone: tz, …})`
  (liefert `YYYY-MM-DD HH:MM`), getestet mit Zeitumstellungsdaten (26.10.2025 und 29.03.2026).
- **Fehlende Teile**: Fehlt `forecastNextHour`, gilt Entscheidung 2. Fehlt `forecastDaily` oder
  `forecastHourly`, wirft `fetchForecast` einen Fehler („Vorhersage unvollständig“), die App
  fällt auf den Cache zurück wie heute bei Netzfehlern.
- `fetchEnsemble`, `fetchModels`, `fetchModelMeta`, `fetchAir` und `MODELS`, `META_MODELS`,
  `POLLEN` werden entfernt; `load()` in `design.js` ruft nur noch Forecast, Warnungen, NINA.
  Die Nutzlast behält die Schlüssel `ens`, `md`, `air`, `meta` mit `null`, damit gespeicherte
  Caches und `renderAllDesign` ohne Sonderfälle weiterlaufen.
- **Cache-Verträglichkeit**: Gespeicherte Open-Meteo-Nutzlasten (`wetter:loc:*`) tragen keine
  Kennung. `saveCache` schreibt ab jetzt `source: "wk"`; `loadCache` liefert Einträge ohne
  diese Kennung nicht mehr aus (einmaliger Datenverlust des Offline-Standes, kein Fehler).

### 3. Darstellung (`design.js`, `index.html`, `modern.css`)

- Modellvergleich: Feld und Funktionen entfernen (Entscheidung 5). `LAYOUT_FIELDS` und
  `LAYOUT_TILES` verlieren die Einträge `models`, `air`, `pollen`; die Kachel „Sicht“ bekommt
  ihre feste ID.
- Herkunftsblatt `sourceSheetHtml`: Abschnitt `src-open` wird zu `src-apple` („Vorhersage: Apple
  Weather, Stand <readTime>, nächste Aktualisierung erwartet <expireTime>“ aus
  `currentWeather.metadata`), Abschnitte `src-modelle`, `src-luft` entfallen, `src-regen`
  beschreibt die Zweiteilung des Nowcasts. Logo und Link aus der Attributions-API: der Worker
  reicht `/wk/attribution` durch (Cache ein Tag), die App zeigt das Logo (helles bzw. dunkles
  Bild je `html.night`) im Herkunftsblatt und in der Fußzeile.
- Fußzeile `index.html`: „Open-Meteo · CC BY 4.0“ wird zu Apple-Wetter-Logo mit Link; DWD, NINA,
  OpenFreeMap, Ortsname bleiben (Ortsname-Zeile ändert sich in Teil 2).
- Tagesliste: Knopftext aus `rows.length − DAYS_SHOWN`; Highlights unverändert bis auf die
  Regel „Sonnigster Tag“ (Entscheidung 10) und das Frost-Highlight, das `fc.past.daily` aus dem
  Adapter weiter bekommt.
- Sonne-Kachel und Tageszeilen: Sonnenscheindauer-Anzeigen entfallen; wo heute „x h Sonne“
  steht, zeigt die Kachel die Tageslichtdauer, die Tageszeile nichts.
- Hinweistexte, die „4 Stunden“ nennen, bleiben (Entscheidung 2).
- Versions-Query einmal erhöhen (Schema `2026MMDDx`), `sw.js`, `manifest.webmanifest`,
  `docs/stand.md` nachziehen.

### 4. Tests

- `tests/harness.js`: Fixture `wkFixture()` in WeatherKit-Form (UTC-Zeiten, Anteile 0..1,
  conditionCodes) ersetzt die Open-Meteo-Fixture; `fetch`-Stub antwortet auf `/wk`.
  `_fetchLog`-Prüfungen in `smoke-design.js` (12 Zeilen, 7 davon mit der Open-Meteo-Adresse) werden auf `/wk?` umgestellt;
  Prüfungen auf `past_days`, `forecast_days`, `models=` entfallen oder werden zu Prüfungen auf
  `hourlyStart`/`dailyStart` im Worker-Test.
- Neue Suite `tests/smoke-adapter.js`: `wkToForecast` gegen eine gespeicherte echte Antwort
  (`tests/fixtures/weatherkit-2026-10-30.json`, einmal mit `curl` über den Worker geholt und
  anonymisiert auf einen Beispielort, z. B. Regensburg); prüft Zeitstrings, Zeitumstellung,
  Prozentumrechnung, WMO-Zuordnung für jeden Code der Tabelle, Nowcast-Aufbau mit und ohne
  Minutenvorhersage, `splitPastDay` mit 23/25-Stunden-Tagen.
- `tests/smoke-push.js`: Stub für die WeatherKit-Antwort statt Open-Meteo; Prüfung, dass `/wk`
  fremde Origins und Anfragen ohne Origin mit 403 ablehnt (der bestehende Test „ohne Origin geht
  durch“ gilt weiter nur für `/nina`), die IP-Drossel greift, das Token gecacht wird (zweiter Aufruf signiert nicht neu;
  `env.__fetch`-Hook wie heute) und Apple-Fehler nicht gecacht werden.
- `tests/smoke-sw.js`: die Zeile mit `api.open-meteo.com` wird zu `/wk`.
- `tests/run.js` nimmt die neue Suite auf; `npm test` meldet fünfmal „Alle Checks bestanden“.

### 5. Doku

`docs/stand.md` (Datenquellen-Tabelle, Datenfluss), `README.md` (Datenquellen),
`proxy/README.md`, `docs/verbesserungen.md` (Modellvergleich und Luft/Pollen als „entfallen“
mit Grund), `docs/veroeffentlichung.md` (Punkt „Datenquellen lizenzfest“ abhaken).

## Reihenfolge

1. Worker `/wk` mit Token, Cache, Origin-Prüfung, lokalem Test (`npx wrangler dev`, echte
   Antwort für einen Beispielort speichern). Deploy erst auf Zuruf.
2. Adapter mit Fixture und eigener Suite; `fetchForecast` auf `/wk`. Ab hier läuft die App
   lokal mit WeatherKit; Sichtprüfung im Simulator (Hero, Stundenstreifen, Tagesliste,
   Nowcast-Karte, Rausgehen, Verlauf, Tagesfilm, Zeitreise, Vergleich mit gestern).
3. Aufräumen in der Darstellung (Modellvergleich, Luft/Pollen, Herkunftsblatt, Fußzeile,
   Attribution). Sichtprüfung Tag und Nacht.
4. Regen-Alarm im Worker umhängen; Probenachricht auf dem iPhone.
5. Doku, Version, Tests komplett, Checkliste.

Jeder Schritt ein Commit auf Zuruf; nach Schritt 2 und 3 je eine Sichtprüfung mit dem User.

## Spätere Teile (eigene Specs)

- **Teil 2: Ortssuche und Ortsname über Apple Maps Server API.** Worker-Routen `/geo?q=` und
  `/place?lat=&lon=`, Token-Tausch an `/v1/token` (Maps-Schlüssel, 30 Minuten gültig), Antwort
  auf die heutige Form `{name, lat, lon}`. Ersetzt Open-Meteo Geocoding und
  BigDataCloud. Kontingent 25 000 Dienstaufrufe am Tag, Suche wird im Worker auf eine Anfrage je
  Sekunde und Origin gedrosselt.
- **Teil 3: Luft und Pollen für Deutschland** aus Umweltbundesamt (nächste Station, Index 1 bis
  5, PM10, PM2,5, NO₂, O₃; Quellenangabe „Umweltbundesamt mit Daten der Messnetze der Länder und
  des Bundes“) und DWD-Pollenflug (`s31fg.json`, Zuordnung Koordinate → Teilregion braucht
  eine Geometrie, die der DWD nicht als Dienst anbietet; Lösung offen). Außerhalb Deutschlands
  bleibt die Kachel verborgen, wie die Warnungen.
- **Teil 4: Ensemble-Code entfernen**, sobald sicher ist, dass kein Ersatz kommt.

## Dem Umsetzer überlassen

- Ob der Adapter als ein Modul in App und Worker geteilt wird (Worker-Bundling über wrangler,
  App als klassisches Skript ohne Module) oder der Worker die Nowcast-Funktion kopiert. Die
  Kopie ist erlaubt, wenn der Test beide gegen dieselbe Fixture prüft.
- Rundung und Formatierung der Zeitstrings, Umgang mit `null` in Apples Arrays.
- Welche Wind-Tagesfelder Apple aktuell liefert; die Tabelle nennt beide Wege.
- Aufbau der Fixture und der Beispielort für Tests; ein Test-.p8-Schlüssel für `smoke-push.js`
  (zur Laufzeit erzeugt, nie eingecheckt).
- Ausrichtung der Minutenvorhersage auf Viertelstunden: Apples `minutes[]` beginnt zur
  aktuellen Minute, die erste Viertelstunde ist also angebrochen. `nowcastStartIndex` und
  `rainAlert` erwarten Intervall-Enden; der Adapter füllt die angebrochene erste Viertelstunde
  anteilig aus den vorhandenen Minuten auf.

## Offene Entscheidungen des Users

1. Was aus der kostenlosen Web-App auf GitHub Pages wird, sobald die Store-App Geld kostet:
   weiter frei (dann verkauft sich die Store-App schlechter und die Pages-Adresse zieht am
   WeatherKit-Kontingent), nur für Tester (Origin bleibt erlaubt, Adresse nicht verbreiten),
   oder abschalten. Ändert nichts am Umbau, nur an `ALLOWED_ORIGINS` später.
2. Ob Teil 3 (Luft und Pollen für Deutschland) überhaupt gewollt ist oder die Kacheln dauerhaft
   wegbleiben.

## Quellen

- Open-Meteo Nutzungsbedingungen und Preise: https://open-meteo.com/en/terms,
  https://open-meteo.com/en/pricing (gelesen 30.10.2026)
- WeatherKit REST API: https://developer.apple.com/documentation/weatherkitrestapi
- WeatherKit-Attribution: https://developer.apple.com/documentation/weatherkitrestapi/get-api-v1-attribution-_language_
- Apple Maps Server API: https://developer.apple.com/documentation/applemapsserverapi
- Umweltbundesamt Luftdaten-API: https://www.umweltbundesamt.de/daten/luft/luftdaten/doc
- DWD Pollenflug-Gefahrenindex: https://opendata.dwd.de/climate_environment/health/alerts/
