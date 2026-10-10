# Stand der Wetter-App

Bestandsaufnahme zum Repo /home/user/Apps-IOS, Branch claude/lignano-weather-webapp-e346s0, HEAD 402a367 vom 9. Oktober 2026. Grundlage sind die Befunde der dreizehn Leser und die Prüfung; strittige Stellen wurden im Code nachgelesen.

## 1 Zweck und Rahmen

Die App ist eine statische Wetter-Web-App auf Deutsch ohne Build-Schritt und ohne API-Schlüssel im Client. Zielgerät ist das iPhone als Homescreen-App: index.html setzt die iOS-Metas, manifest.webmanifest startet ./index.html im Standalone-Modus mit Farbe #ECEAF4. Das Manifest hat weder id, description, lang noch purpose. Im Browser läuft die App ebenso, ab 760 px mit zwei Spalten.

Ausgeliefert wird über GitHub Pages unter https://anferny33.github.io/Apps-IOS/. Laut README (Z. 5, 96) liefert Pages den Feature-Branch aus; ein .github-Verzeichnis gibt es nicht. Der Standard-Branch auf GitHub ist claude/box-breathing-webapp-x40s4 mit einem einzigen Commit; Pull Request 1 führt den Feature-Branch dagegen und ist offen.

Das einzige Backend ist der Cloudflare Worker wetter-nina-proxy für NINA-Meldungen, Regen-Alarm per Web Push und den Rückkanal für Tester.

## 2 Dateien und Architektur

| Datei | Zeilen | Rolle |
|---|---|---|
| index.html | 214 | Startseite, Markup-Gerüst, sechs Dialoge, Tab-Leiste |
| design.js | 4113 | Darstellung, Einstellungen, Push, Tagesfilm, Rückmeldung |
| wetter-core.js | 557 | Datenschicht: API-Aufrufe, Normalisierung, localStorage |
| sonne.js | 93 | Sonnenstand, Mondphase, Tag/Nacht-Handwahl |
| modern.css | 870 | Einziges Stylesheet, Tag- und Nachtpalette, Animationen |
| sw.js | 98 | Service Worker: Offline-Hülle, Push-Anzeige |
| radar.html, radar.js | 256, 844 | Radarseite, MapLibre, DWD-WMS |
| manifest.webmanifest | 13 | Homescreen-Installation |
| proxy/src/worker.js, webpush.js | 454, 85 | Worker-Routen, Alarmregel, Cron, Web Push |
| proxy/wrangler.toml, feedback.sh | 25, 20 | Worker-Konfiguration, Rückmeldungen lesen |
| tests/*.js | 1911 | Harness, vier Smoke-Suiten, drei Build-Skripte |
| box-breathing.html | 749 | Eigenständige Atemübung ohne Bezug zur App |
| design.html, lignano-*.html | 23 bis 24 | Weiterleitungen für alte Homescreen-Icons |

index.html lädt sonne.js, wetter-core.js und design.js als klassische Skripte in dieser Reihenfolge und ruft inline initDesignApp() (Z. 207 bis 210). Alle Funktionen sind global, es gibt keine Module. Die sechs Blätter stehen dauerhaft mit role=dialog im DOM, geschlossen per visibility verborgen.

Versionierung: Stylesheet und Skripte tragen ?v=20261009q (index.html 4 Stellen, radar.html 3 Stellen). sw.js führt dieselbe Zeichenkette als SW_VERSION (Z. 6) für den Cache-Namen wetter-shell-20261009q. design.js liest ASSET_VERSION aus der eigenen Skript-URL (Z. 1298 bis 1302); ohne ?v= bleibt sie leer. Die Icon-Links tragen abweichend ?v=20261008d. Ein Versionswechsel wird von Hand an acht Stellen plus Tests nachgezogen.

Service Worker: Beim Installieren holt er die Hülle (Seiten, Manifest, Stylesheet, Skripte mit Query, vier Icons) mit cache:"reload" und übernimmt sofort. Eigene Dateien laufen Netz-zuerst mit Cache-Rückfall ohne Zeitlimit; Navigationen fallen offline auf index.html bzw. radar.html. fonts.googleapis.com, fonts.gstatic.com und unpkg.com laufen Cache-zuerst mit Hintergrunderneuerung im selben Cache (Z. 55 bis 58). Es gibt keinen message-Kanal und keinen Update-Hinweis; die Registrierung verschluckt Fehler (index.html Z. 212, radar.html Z. 254).

## 3 Datenquellen und Datenfluss

| Quelle | Endpunkt | Zweck |
|---|---|---|
| Open-Meteo Forecast | api.open-meteo.com/v1/forecast | 14 Tage plus Vortag, current, minutely_15, hourly, daily |
| Open-Meteo Multi-Modell | dito mit models= | Sechs Modelle, 3 Tage |
| Open-Meteo Ensemble | ensemble-api.open-meteo.com/v1/ensemble | ICON-D2-EPS, 2 Tage |
| Open-Meteo Air Quality | air-quality-api.open-meteo.com/v1/air-quality | AQI, PM, Ozon, Pollen |
| Open-Meteo Metadaten | api.open-meteo.com/data/<dir>/static/meta.json | Laufzeiten von fünf Modellen |
| Open-Meteo Geocoding | geocoding-api.open-meteo.com/v1/search | Ortssuche |
| BigDataCloud | api.bigdatacloud.net/data/reverse-geocode-client | Ortsname zur GPS-Position |
| DWD GeoServer WFS | maps.dwd.de/geoserver/dwd/ows | Warnungen der Gemeinde |
| DWD GeoServer WMS | maps.dwd.de/geoserver/dwd/wms | GetMap RADOLAN RV, GetLegendGraphic, GetStyles |
| DWD Capabilities | maps.dwd.de/geoserver/dwd/Niederschlagsradar/ows | Zeitachse, REFERENCE_TIME, Bbox (radar.js Z. 16) |
| Eigener Worker | wetter-nina-proxy.anferny-wetter.workers.dev | /nina, /push/*, /feedback |
| OpenFreeMap | tiles.openfreemap.org | Vektorkacheln und Glyphen der Radarkarte |
| Google Fonts, unpkg | fonts.googleapis.com, fonts.gstatic.com, unpkg.com | Schrift Sora, MapLibre 5.24.0 |

Ablauf: initDesignApp wählt den Startort in dieser Reihenfolge: Reise-Automatik, gespeicherter Suchort (wetter:active mit source search), PREVIEW_LOC oder gespeicherte GPS-Position, sonst Geolocation. load() startet sieben Fetches parallel per Promise.allSettled; nur der Forecast ist Pflicht. splitPastDay trennt den Vortag per Datum als fc.past ab. Die Nutzlast {fc, ens, md, air, warn, nina, meta, loc} geht an renderAllDesign und wird danach unter wetter:loc:<lat>,<lon> gespeichert.

Cache und Offline: getJson nutzt fetch mit cache "no-store" und ohne Timeout. Scheitert der Forecast, zeigt die App den Datencache des Orts ohne Altersgrenze mit Banner „Keine Verbindung …“ und der Zeile „Stand … · gespeicherte Daten“.

Außerhalb Deutschlands: Der DWD-Layer kennt nur deutsche Gemeinden, der Worker reicht Koordinaten außerhalb 47 bis 56 N und 5 bis 16 O nicht weiter (worker.js Z. 98 bis 101). Ein Ort wie Lignano bekommt keine Warnungen, ohne Hinweis in der App.

## 4 Startseite: Funktionen aus Nutzersicht

Hero und Zeitreise: Wochentag mit Uhrzeit, Wettertext, große Temperatur mit Ebenen-Icon und Chips „Hoch“, „Tief“, „Gefühlt“ sowie „2° wärmer als gestern“. Ein Tipp auf eine Stundenspalte baut das Hero auf diese Stunde um („Morgen, 17 Uhr“, Knopf „Jetzt“); Ziehen vom markierten Griff und Pfeiltasten funktionieren ebenfalls. Ist das Hero aus dem Bild, erscheint oben die Leiste „Vorschau · …“.

Hinweis und Regenrat: Nowcast-Satz aus den 15-Minuten-Werten, darunter ein dreistufiger Schirm-Rat, unter 30 % Risiko vorsichtiger. Ohne Regen erscheint die Regenaussicht. Fehlen die 15-Minuten-Werte, bleibt das ganze Feld verborgen (Z. 953).

Weitere Felder: Fünf Ansicht-Chips (Überblick, Regen, Wind, Wärme, Licht) färben Stundenstreifen und Tagesliste um und beantworten die Frage für 24 Stunden in einem Satz. 48 Stundenspalten mit blauer Füllung ab 25 % Regenrisiko, dazu „Verlauf 48 h“ als Meteogramm. Rausgehen zeigt für vier Aktivitäten bis zu drei passende Fenster in 48 Stunden mit grüner Spur unter den Stunden. Die Regenpausen-Karte erscheint nur bei Regen im Nowcast und nennt die nächste trockene Phase für 15, 30 oder 60 Minuten. Dazu bis zu drei Highlights der nächsten sieben Tage, Tagesliste mit 7 plus 7 Zeilen und ein Modellvergleich aus sechs Modellen mit Ensemble-Band.

Kacheln: UV-Index (nachts „UV morgen“ mit Mondphase), Wind, Regen, Sonne, Luftfeuchte, Luftdruck, Luftqualität und Pollen oder ersatzweise Sicht mit Nebelrisiko. Wind, Regen, Sonne und Sicht klappen ein Feld auf, jedes endet mit „Woher kommt das?“. Dieser Knopf und „Woher?“ in der Aktualitätszeile öffnen ein Blatt mit elf Abschnitten.

Warnungen: DWD und NINA werden nach Stufe gemischt und als aufklappbare Felder in vier Farben gezeigt. Bei DWD fallen Cancel, Test und abgelaufene Meldungen weg, NINA-Dubletten des DWD ebenso. Bei NINA fällt nur Cancel weg; einen Ablauf prüfen weder Worker noch normalizeNina.

Einstellungen: Einheiten, Startansicht, Bewegung, Rausgehen-Toleranzen, „Startseite“ (Felder sortieren und ausblenden), Reise (Ziel, Zeitraum, Countdown, täglicher Wechsel in die Reisevorhersage), Regen-Alarm (Abschnitt 6), Tagesfilm, Rückmeldung. Intern bleibt alles in °C und km/h.

Tagesfilm: Zehn Sekunden Animation auf 1080×1920. Er startet beim ersten erfolgreichen Laden des Tages, auch abends; maybeAutoFilm (Z. 3113 bis 3121) prüft keine Tageszeit, „Morgens als Begrüßung“ ist nur die Beschriftung. Bei „Reduziert“, prefers-reduced-motion und PREVIEW_LOC entfällt er. „Als Video teilen“ nimmt per MediaRecorder auf (MP4 vor WebM).

Feedback: Blatt „Rückmeldung“ mit Art (Fehler, Idee, Lob), Text und Kürzel. POST an den Worker mit Version, User-Agent, Breite, Schriftfaktor, Standalone, Ansicht und letztem Fehlertext, ohne Ort; ohne Netz Warteschlange (max. 10).

Nacht und Tag: Die Nachtpalette schaltet, sobald die Sonne am Ort tiefer als −8° steht. Der Knopf oben rechts erzwingt Tag oder Nacht bis zum nächsten automatischen Wechsel; ohne JS bleibt er leer.

## 5 Regenradar

radar.html ist eine eigene Seite und wird zugleich als Blatt über der Startseite in einem iframe mit ?embed=1 geladen; der Embed-Modus blendet nur Kopfzeile und Tab-Leiste aus, es gibt keine postMessage-Kommunikation. radar.html bindet kein Manifest ein, trägt aber den Titel „Regenradar“ (Z. 8); ein altes Radar-Icon landet so als eigenständige Homescreen-App ohne Manifest. Die Grundkarte ist ein eigener MapLibre-Stil auf OpenFreeMap-Kacheln, Zoom 4 bis 12; der WMS-Layer dwd:Niederschlagsradar liegt mit Deckkraft 0,72 unter den Ortsnamen.

Zeitachse: GetCapabilities wird per Regex gelesen, erste Dimension time ohne Layerbezug (Z. 142 bis 150). REFERENCE_TIME gilt als jüngste Beobachtung, wenn der Wert in der Zeitliste steht und höchstens jetzt plus 10 Minuten liegt, sonst der jüngste Zeitpunkt vor jetzt (Z. 169 bis 175). Davor bis zu sechs Zeitpunkte im 10-Minuten-Raster, danach bis zu acht Prognosen im 15-Minuten-Raster bis +120 min. Je Zeitpunkt lädt radar.js ein GetMap-Bild (EPSG:3857, 25 % Rand) als Blob. Der Maßstab ist min(1,5, devicePixelRatio) mal 1,5, also bis zu 2,25-fache CSS-Pixel, Bildgröße 64 bis 2048 px (Z. 216 bis 219). LRU-Cache mit 36 Einträgen, zwei Abrufe parallel. Zwei Bildebenen blenden in 280 ms über; whenSourceLoaded löst spätestens nach 400 ms auch ohne sourcedata aus (Z. 527).

Bedienung: Play/Pause (700 ms je Bild, Autostart), Schieberegler mit Marker an der Grenze Beobachtung/Prognose, „Zum Ort“, „Radar aktualisieren“. Alle 5 Minuten werden die Metadaten neu geholt, im Hintergrund pausiert die Wiedergabe, nach Rückkehr wird frühestens nach 60 s aktualisiert. Die Legende kommt aus der SLD-Stildefinition, mit Rückfall auf das DWD-Legendenbild mit fester dunkler Schrift. Im Querformat sind „Alle Stufen“ und der Hinweistext ausgeblendet (radar.html Z. 171 bis 172). Badge und Marker zeigen Gerätezeit; die Nachtpalette rechnet allein mit nightByClock aus Gerätezeit und Gerätezeitzone, ohne die Open-Meteo-Verankerung der Startseite.

## 6 Infrastruktur

Cloudflare Worker wetter-nina-proxy (compatibility_date 2026-10-01, workers_dev):

| Route | Zweck |
|---|---|
| GET /health | Lebenszeichen |
| GET /nina?lat&lon | Bereich 47 bis 56 N, 5 bis 16 O, sonst 200 mit note „außerhalb Deutschlands“; Kreis per BKG-WFS; Dashboard plus höchstens 12 Details; Cancel filtern, HTML bereinigen, sortieren; keine Ablaufprüfung |
| GET /nina/<ARS> | Dasselbe für einen Kreis direkt |
| POST /push/subscribe, /push/unsubscribe | Abonnement in KV SUBS anlegen oder löschen |
| POST /push/test | Probenachricht, höchstens alle fünf Minuten |
| POST /feedback | Rückmeldung in KV FEEDBACK, 90 Tage, max. 5 je Stunde und Kennung |
| GET /feedback, POST /feedback/ack | Lesen und bestätigen, nur mit Bearer FEEDBACK_TOKEN |

Secrets sind VAPID_PRIVATE_KEY und FEEDBACK_TOKEN (wrangler secret put, lokal proxy/.dev.vars; die Datei fehlt im Checkout). VAPID_PUBLIC_KEY, VAPID_SUBJECT und die KV-IDs stehen in wrangler.toml. Der Cron */15 ruft checkRain, das die Abonnements seriell abarbeitet. ALLOWED_ORIGINS sind anferny33.github.io, localhost:8000 und 127.0.0.1:8000 (Z. 32 bis 36). CORS ist keine Zugriffskontrolle: Bei fremdem Origin wird Allow-Origin auf github.io gesetzt, die Anfrage aber verarbeitet (Z. 139); curl geht immer durch. Nur die Feedback-Leseroute ist per Token geschützt. proxy/feedback.sh liest und bestätigt Rückmeldungen mit dem Token aus .dev.vars, die URL ist per FEEDBACK_URL überschreibbar.

Push-Kette: enablePush fragt die Berechtigung an, wartet bis 6 s auf navigator.serviceWorker.ready, abonniert mit PUSH_PUBLIC_KEY und prüft erst danach, ob ein Ort geladen ist (Z. 2861 bis 2864). Der Worker speichert unter sub:<SHA-256-Hash des Endpunkts> mit auf drei Dezimalen gerundeten Koordinaten. rainAlert löst aus, wenn jetzt unter 0,1 mm fällt und in den nächsten vier Viertelstunden mindestens 0,1 mm beginnt. sendWebPush verschlüsselt nach RFC 8291 und signiert per VAPID ES256. sw.js zeigt „Regen ab HH:MM Uhr“ mit tag regen-alarm, ohne JSON-Nutzlast „Regen in Sicht“; ein Tipp fokussiert die offene App, ohne zu data.url zu navigieren, oder öffnet sie. Antworten 404/410 löschen das Abonnement, nach Erfolg gilt drei Stunden Sperrfrist. syncPush meldet einen Ortswechsel ab 0,01° nach und schluckt Fehler, ebenso disablePush. Ob Secrets gesetzt sind und der aktuelle worker.js deployt ist, zeigt nur das Cloudflare-Konto.

Deployment: Push auf den Branch, Pages nach etwa einer Minute live; Worker per npx wrangler deploy, wrangler ist nicht deklariert.

## 7 Gespeicherter Zustand

| Schlüssel | Ort | Zweck |
|---|---|---|
| wetter:loc:<lat>,<lon> | localStorage | Datencache je Ort {savedAt, payload}, zwei Dezimalen (wetter:loc:48.14,11.58), keine Altersgrenze, keine Bereinigung |
| wetter:pos, wetter:active | localStorage | Letzter GPS-Ort; aktiver Ort mit source search oder gps, vom Radar mitgelesen |
| wetter:settings | localStorage | temp, wind, motion, startView, rainTol, feelAdj, hidden, order, dayfilm, push, pushLoc, trip, tripSwitched, filmShown |
| wetter:recent | localStorage | Bis zu drei Suchorte |
| wetter:night | localStorage | „1“/„0“, vor dem ersten Zeichnen gelesen, minütlich neu geschrieben |
| wetter:nightmode | localStorage | Handwahl {force, auto}, verfällt beim automatischen Wechsel |
| wetter:view, wetter:activity, wetter:pause | localStorage | Ansicht, Aktivität, Pausendauer |
| wetter:feedback | localStorage | Kennung (16 Zeichen), Name, Warteschlange |
| PushManager-Abonnement | Browser | Eigener Zustand neben settings.push |
| wetter-shell-20261009q | Cache Storage | Hülle plus alle erfolgreich geladenen Same-Origin-GETs plus Schrift- und unpkg-Antworten |
| sub:<hash> | KV SUBS | Push-Abonnement mit Ort, lastSent, lastTest |
| fb:<ms>-<rand>, fbrate:<id> | KV FEEDBACK | Rückmeldungen und Rate-Limit |
| caches.default | Worker | NINA je Kreis 120 s (Fehler 20 s), Kreis unter https://kreis.cache.local/<lat>,<lon> 1 Tag |
| window.PREVIEW_LOC, TEST_NOW, NINA_PROXY | global | Vorschau-Ort, Testzeit, Worker-Adresse überschreiben |
| window.__lastFilm, self.SW_INFO | global | Testhaken für Film und Service Worker |

## 8 Design und Bewegung

modern.css definiert die Tagespalette als Tokens auf :root (--ground #ECEAF4, --ink #1E1B2E, --sun #F6D35B und weitere). Die Hero-Farbe --hero wechselt über Theme-Klassen am body. html.night definiert alle Tokens neu und dunkelt die Hero-Farben ab; html.fade blendet 0,9 s über. Schrift ist Sora von Google Fonts, Grundgröße 17 px, auf Touch-WebKit Dynamic Type, gedeckelt bei 27,2 px. SVG-Texte stehen in rem (Z. 304, 333 bis 334). Es gibt kein prefers-color-scheme und keine Druckregel.

Bewegung: eine Kurve --ease und drei Dauern (0,3 s, 0,55 s, 0,9 s). Die Startchoreografie staffelt Einblendungen über inline animation-delay und die Intro-Uhr in design.js (INTRO_SCALE 0,6). Das Hero-Icon hat Ebenen (Sonne, Mond, Wolken, Tropfen, Flocken, Blitz, Sterne), Kacheln haben Mikroanimationen. Bei Warnfeldern wackelt das DWD-Icon auf allen Stufen (svg.wobble), NINA-Icons senden Wellen (svg.wave), nur der Rand-Puls ist auf Stufe 3 und 4 beschränkt (Z. 163 bis 172). prefers-reduced-motion und „Reduziert“ schalten alle Animationen und Transitions ab.

Barrierefreiheit: focus-visible-Ringe, .vh-Texte für Diagramme, Stundenspalten als Schaltflächen mit Satz je Stunde, Live-Region #live, aria-current in der Tab-Leiste, Grau --ink-2 auf getönten Flächen für 4,5:1.

## 9 Tests und Werkzeuge

npm test kettet vier Node-Skripte ohne Abhängigkeiten. Der Produktionscode läuft per vm.runInContext in Sandboxen mit DOM-, Storage-, Fetch- und Geolocation-Stubs; smoke-push.js importiert den Worker als ES-Modul mit Node-WebCrypto.

| Suite | Checks | Abdeckung |
|---|---|---|
| smoke-design.js | 376 | Startseite komplett inklusive Einstellungen, Zugänglichkeit, Push-UI, Tagesfilm, Rückmeldung |
| smoke-radar.js | 41 | Frames, Ladereihenfolge, Überblendung, Cache, Abdeckung, Legende, Nachtschalter |
| smoke-sw.js | 19 | Hülle, Versionierung, Cache-Strategie, Push-Anzeige |
| smoke-push.js | 28 | Verschlüsselung, VAPID, Alarmregel, Push- und Feedback-Routen |

Lücken: Kein Browser, also kein Layout, keine CSS-Wirkung, keine Animationen, kein IntersectionObserver, kein echter Service-Worker-Lebenszyklus, kein GPS, kein Canvas, keine echte Karte. Die Route /nina wird nur mit gemockter Antwort geprüft. Viele Checks sind Regex-Prüfungen auf Quelltext; die Versions-Query ist in smoke-design.js Z. 799 hart kodiert. Trotz TEST_NOW hängen Warnungen (harness.js Z. 165), Reise und Aktualität an Date.now(). Synchronisiert wird über feste Waits von 300 bis 1100 ms. Einzelne Checks sind trivial (Z. 90 prüft true), capsB in smoke-radar.js Z. 17 ist toter Code, check/finish ist dreifach kopiert. Der echte Worker-Host wird nirgends geprüft, nur der VAPID-Schlüssel; smoke-sw.js prüft die Version nur gegen index.html.

Werkzeuge: npm run preview baut tests/iphone-preview.html mit der echten App im iPhone-Rahmen, build-design-render.js setzt den Test-Dump in index.html ein, build-icons.js rendert die Icons per Playwright (nirgends deklariert), tests/ax-dump gibt per XCUITest den Bedienungshilfen-Baum von Safari im Simulator aus.

Testlauf: In diesem Container (Zeitzone UTC) endete npm test nach der ersten Suite mit 372 ok und 4 FAIL, alle an der Aktualitätszeile (smoke-design.js Z. 656 bis 659): design.js Z. 3475 hängt „ Ortszeit“ an, sobald die Gerätezone von Europe/Berlin abweicht. Die drei anderen Suiten liefen wegen && nicht. Mit TZ=Europe/Berlin bestanden alle 464 Checks.

## 10 Dokumentation und Planung

README.md beschreibt Seiten, Datenquellen, lokale Arbeit, Tests und Veröffentlichung. docs/verbesserungen.md ist die Checkliste der 17 Ideen aus der UI/UX-Durchsicht vom 8. Oktober, alle mit Commit-Beleg abgehakt; die Durchsicht selbst liegt nicht als Datei vor. docs/veroeffentlichung.md ist die App-Store-Checkliste in acht Phasen. Unter docs/superpowers liegen 17 Specs und 15 Pläne vom 8. und 9. Oktober.

Offen laut verbesserungen.md: Ansichten-Chips als Tab-Leiste, Tageszeilen role img oder text, Mittelpunkt-Trenner, Stundenstreifen mit 48 Schaltflächen, Gegencheck mit echtem VoiceOver, tägliche Sichtung der Rückmeldungen; aus dem Restliste-Plan zudem Füllungen im Stundenstreifen (vom Nutzer als „bleiben“ entschieden) und VoiceOver auf dem Gerät.

Veröffentlichung: Bis auf den Rückkanal ist alles offen. Im Repo fehlen lokale Schrift, lokales MapLibre, Datenschutzerklärung, Capacitor-Hülle, APNs-Weg im Worker, PrivacyInfo.xcprivacy, Open-Meteo-Tarif oder Worker-Cache. Entscheidungen zu Name, Bundle-ID, Zielgeräten und Preis stehen aus.

## 11 Historie

| Phase | Datum | Commits | Inhalt |
|---|---|---|---|
| Box Breathing | 2026-01-17 | 1 | Wurzel-Commit aller Branches, Autor Claude |
| Lignano-Regenvorhersage | 2026-08-17 | 5 | Campingplatz-Seiten, RainViewer-Radar |
| Startseite mit Standortwetter | 2026-08-24/25 | 2 | wetter-core.js entsteht |
| Vollständige Wetter-App | 2026-09-25 | 2 | Lignano-Seiten werden Weiterleitungen |
| Temperaturspanne | 2026-10-07 | 1 | |
| Großer Sprint | 2026-10-08 | 69 | Bento-Design, Versions-Query, Worker, Zeitreise, Rausgehen, Modelle, Regenpausen, Kacheln, MapLibre-Radar, Nachtpalette, Offline-Hülle; klassisches Design entfernt |
| Abschluss | 2026-10-09 | 16 | Ansicht nach Frage, Nebelrisiko, Schirm/Gestern, Woher, Nächste Tage, Zugänglichkeit, Restliste, Push-Test, Checklisten, VoiceOver, Rückkanal |

Insgesamt 96 Commits, keine Tags. Autoren: Anferny Nash (51), Michael Knodt (39), Claude (6). Lokaler Stand und origin sind identisch; short-url-qr und bayern-forest sind unabhängige Mini-Projekte auf demselben Wurzel-Commit. PR 1 ist offen, mergeable_state clean, 95 Commits, 74 Dateien.

## 12 Auffälligkeiten und offene Punkte

Daten und Worker:

- Abgelaufene NINA-Meldungen werden nirgends gefiltert: Worker nur Cancel (Z. 189 bis 190), normalizeNina ohne expires (wetter-core.js Z. 229 bis 253), renderWarnings zeigt sie mit „bis …“ (design.js Z. 2475).
- wetter-core.js Z. 216 bis 219 „Leer gelassen = Funktion aus“, tatsächlich fällt NINA_PROXY per || auf die feste URL zurück; Z. 30 „Validierte Chartfarben“ steht über der WMO-Tabelle; SETTINGS_DEFAULTS (Z. 484) listet trip, tripSwitched, filmShown und pushLoc nicht.
- MODELS hat sechs Modelle inklusive ARPEGE (Z. 21 bis 28), META_MODELS fünf (Z. 114 bis 120); der Herkunftstext (design.js Z. 2604) nennt ARPEGE nicht.
- Worker: Push-Routen unauthentifiziert, Kenntnis des Endpunkts genügt (Z. 254, 281); Feedback-Rate-Limit über die Client-Kennung umgehbar (Z. 405); feedbackList ohne Cursor; VAPID_SUBJECT-Fallback mailto:wetter@example.org. Commit 9abd6a4 hat proxy/.wrangler/ mit wrangler-account.json committet, c44bbca hat es entfernt, der Inhalt bleibt in der Historie.

Startseite:

- heroChipsHtml prüft „Tief“ und „Gefühlt“ nicht mit isNum, tmp(null) ergibt „0°“ (Z. 463 bis 467). Nebel ergibt im Hero die Lage „bewoelkt“ (Z. 62 bis 71). Ohne IntersectionObserver bleibt heroVisible false (Z. 3999). Die gewählte Stunde wird nur bei w.start < gi < w.end wiederhergestellt (Z. 3440).
- Wärme-Ansicht ohne Tönung für 8 bis 16 °C: tempClass liefert tc3 (Z. 1147), modern.css kennt nur tc1, tc2, tc4, tc5 (Z. 27, 792, 849).
- Ausblenden „Pollen oder Sicht“ trifft die Sicht-Kachel nicht: sichtTile setzt key sicht (Z. 2167), LAYOUT_TILES kennt nur pollen (Z. 2720). applyLayout hängt sortierbare Felder ans Ende von #sec-today (Z. 2739); das Reise-Feld rutscht nach oben.
- sichtPanelHtml Z. 2078: Operatorvorrang, der Nebelsatz beschreibt nur den ersten Block. dropIcon nutzt die feste SVG-ID dropclip. answerLight wählt nachts den Tag nur nach Uhrzeit. fmtWarnTime nutzt new Date() statt nowMs (Z. 2446).
- Push: ohne Ort bleibt nach enablePush ein verwaistes Abonnement; pushSettingsHtml zeigt „Probenachricht senden“ auch ohne Push-Unterstützung (Z. 2931 bis 2935); ein fehlgeschlagenes Unsubscribe lässt den KV-Eintrag stehen.
- Tagesfilm-Zähler rechnet tmp(sc.temp * tl.count) (Z. 3046), bei °F beginnt die Zahl bei 32°. maybeAutoFilm setzt filmShown vor openFilm.
- applyNight schreibt wetter:night im Minutentakt (Z. 3618). Zwei visibilitychange-Listener (Z. 3524, 4070 bis 4073); bei GPS-Ort ortet jedes Sichtbarwerden neu. Nach #gps-Klick und Ortungsfehler ohne gespeicherte Position bleibt die Seite ohne Ort.
- sendFeedback reiht jede Antwort außer ok/429/400 als „Kein Netz“ ein, flushFeedbackQueue verwirft 400 still (Z. 3293 bis 3311). Die Rückmeldung schickt den User-Agent, die Fußnote nennt nur „Gerät“. #updated zeigt Gerätezeit, #freshTxt Ortszeit.

Radar und Hülle:

- Rückfall ohne Zeitachse: Schlüssel „now|…“ (radar.js Z. 254) wird von refresh nicht bereinigt (Z. 665), showFrame lädt bei gleichem Schlüssel nicht neu (Z. 558); das „aktuell“-Bild veraltet bei gleichem Ausschnitt.
- Zwei Zeitbasen für die Nacht: Startseite in Ortszeit mit Open-Meteo-Verankerung (design.js Z. 3596 bis 3603), Radar in Gerätezeit (radar.js Z. 751 bis 753). sonne.js rechnet mit Näherungen (365-Tage-Jahr); Tage mit −0,833°-Bogen ohne −8°-Bogen gelten pauschal als hell (Z. 42).
- Icon-Links ?v=20261008d (index.html Z. 10 bis 11, radar.html Z. 10), im SW-Shell ohne Query (sw.js Z. 12); Offline-Treffer nur nach Online-Laden. icon.svg liegt im Shell, nicht im Manifest. Alt-Seiten tragen alte theme-colors.

Styles und tote Pfade:

- Doppelte .pchip-Regel: modern.css Z. 372 (Pollen) überschreibt Z. 257 (Regenpausen-Knöpfe). Aufklappstaffelung der 14 Tage nur für nth-child 2 bis 7 (Z. 182 bis 187). Die Sichtbarkeitsregel offener Blätter zählt die IDs explizit auf (Z. 467). .umb-shaft hat keine Regel. Kommentar Z. 712 „synchron über 2,4 s“ passt nicht zu 0,9 s plus 0,9 s.
- Nicht referenziert: id cssModern, fresh, hourlyHint; elf UI-Icons (design.js Z. 357 bis 375); scrubActive; Variable worst; .a-pulse, .a-right, .linkbtn; lg-ready (radar.js Z. 492); leere Überschrift „Hintergrund-Partikel“ (design.js Z. 4065).
- box-breathing.html ist nirgends verlinkt, nicht im Shell, nicht im Manifest; build-phone-preview.js Z. 30 schreibt dennoch einen Link darauf um. Playwright und wrangler sind nirgends deklariert; package.json hat keine Abhängigkeiten, kein engines-Feld und bleibt bei 1.0.0.

Dokumentation:

- Drei Kartenquellen: README Z. 22 „CARTO“, radar.js Z. 21 OpenFreeMap, Herkunftsblatt design.js Z. 2639 „basemap.de“. Fußzeile index.html Z. 119 nennt OpenFreeMap und NINA nicht.
- README Z. 11 und Spec zugaenglichkeit Z. 28 sagen „Text in SVG-Grafiken bleibt in Pixeln“; Spec restliste und der Code haben rem. README Z. 13 beschreibt proxy/ nur als NINA-Proxy; Z. 56 „vier Suiten“ gegen Z. 68 „Zwei Suiten“; Z. 80 bis 81 leerer Codeblock.
- proxy/README.md Z. 12 bis 14 behauptet, die App ermittle den Kreis über dwd:Warngebiete_Kreise; tatsächlich löst der Worker ihn per BKG-WFS. Z. 59 bis 60 verweist auf einen node-e-Befehl, der in der Restliste-Spec nicht steht. Der Kopfkommentar von worker.js (Z. 11 bis 20) listet /feedback nicht.
- verbesserungen.md Z. 26 „Deployment steht aus“ gegen Z. 64 „in Betrieb“; Spec und Plan restliste sagen „ohne Commit“, obwohl 3b77f9c committet wurde.
- Specs und Pläne vom 8. Oktober nennen „beide Designs“, design.css und klassisch.html; beides existiert nicht mehr (e331959, 0d696b1). PR-1-Beschreibung nennt design.css, Leaflet und proxy/worker.js. Zwölf von 15 Plänen haben alle Kästchen offen, einzelne enthalten maschinenspezifische Werte (Pfad, Simulator-UDID, macOS-sed). Versionsreihe mit Lücken (20261008w, 20261009e, 20261009o).
- Phasen 1 bis 7 der App-Store-Checkliste sind offen; die größten Lücken sind Datenschutzerklärung, lokale Schrift und Kartenbibliothek, Capacitor-Hülle und APNs.
