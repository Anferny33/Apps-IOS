# Stand der Wetter-App

Bestandsaufnahme zum Repo /home/user/Apps-IOS, Branch claude/lignano-weather-webapp-e346s0, HEAD 402a367 vom 9. Oktober 2026. Grundlage sind die Befunde der dreizehn Leser und die Prüfung; strittige Stellen wurden im Code nachgelesen.

Bereinigung vom 10. Oktober 2026: Die Befunde aus Abschnitt 12 wurden in fünf Paketen (Daten und Worker, Startseite, Styles und Hülle, Radar, Dokumentation) und einer Nachbesserung im Arbeitsbaum behoben, nichts davon ist committet (26 geänderte Dateien, neu tests/run.js und docs/superpowers/README.md). Begonnen wurde mit den Tests: feste Gerätezone und Testzeit im Harness, Runner statt &&-Kette, Versions-Query zentral, danach die Befunde je Paket. npm test ist mit TZ=UTC und TZ=Europe/Berlin grün (424, 49, 21 und 43 Checks), dazu lief ein Browser-Check mit Playwright. Abschnitt 12 führt, was behoben ist und was mit Begründung offen bleibt; Zeilenangaben beziehen sich auf den Arbeitsbaum nach der Bereinigung.

## 1 Zweck und Rahmen

Die App ist eine statische Wetter-Web-App auf Deutsch ohne Build-Schritt und ohne API-Schlüssel im Client. Zielgerät ist das iPhone als Homescreen-App: index.html setzt die iOS-Metas, manifest.webmanifest startet ./index.html im Standalone-Modus mit Farbe #ECEAF4. Das Manifest trägt id, lang, description und drei Icons mit Versions-Query; purpose fehlt weiterhin. Im Browser läuft die App ebenso, ab 760 px mit zwei Spalten.

Ausgeliefert wird über GitHub Pages unter https://anferny33.github.io/Apps-IOS/. Laut README (Z. 5, 103) liefert Pages den Feature-Branch aus; ein .github-Verzeichnis gibt es nicht. Der Standard-Branch auf GitHub ist claude/box-breathing-webapp-x40s4 mit einem einzigen Commit; Pull Request 1 führt den Feature-Branch dagegen und ist offen. Das README hält beides seit dem 10. Oktober fest.

Das einzige Backend ist der Cloudflare Worker wetter-nina-proxy für NINA-Meldungen, Regen-Alarm per Web Push und den Rückkanal für Tester.

## 2 Dateien und Architektur

| Datei | Zeilen | Rolle |
|---|---|---|
| index.html | 216 | Startseite, Markup-Gerüst, sechs Dialoge, Tab-Leiste |
| design.js | 4200 | Darstellung, Einstellungen, Push, Tagesfilm, Rückmeldung |
| wetter-core.js | 571 | Datenschicht: API-Aufrufe, Normalisierung, localStorage |
| sonne.js | 93 | Sonnenstand, Mondphase, Tag/Nacht-Handwahl |
| modern.css | 875 | Einziges Stylesheet, Tag- und Nachtpalette, Animationen |
| sw.js | 100 | Service Worker: Offline-Hülle, Push-Anzeige |
| radar.html, radar.js | 261, 877 | Radarseite, MapLibre, DWD-WMS |
| manifest.webmanifest | 17 | Homescreen-Installation |
| proxy/src/worker.js, webpush.js | 542, 85 | Worker-Routen, Alarmregel, Cron, Web Push |
| proxy/wrangler.toml, feedback.sh | 25, 20 | Worker-Konfiguration, Rückmeldungen lesen |
| tests/*.js | 2387 | Harness, Runner, vier Smoke-Suiten, drei Build-Skripte |
| box-breathing.html | 749 | Eigenständige Atemübung ohne Bezug zur App |
| design.html, lignano-*.html | 23 bis 24 | Weiterleitungen für alte Homescreen-Icons |

index.html lädt sonne.js, wetter-core.js und design.js als klassische Skripte in dieser Reihenfolge und ruft inline initDesignApp() (Z. 209 bis 212). Alle Funktionen sind global, es gibt keine Module. Die sechs Blätter stehen dauerhaft mit role=dialog im DOM, geschlossen per visibility verborgen.

Versionierung: Stylesheet, Skripte und Icon-Links tragen ?v=20261010a (index.html 6 Stellen, radar.html 4 Stellen; erhöht mit dem Farbschema Nil, davor 20261009q), das Manifest führt seine drei Icons mit derselben Query. sw.js führt dieselbe Zeichenkette als SW_VERSION (Z. 6) für den Cache-Namen wetter-shell-20261010a und hängt sie an alle Hüllen-Dateien einschließlich der vier Icons; nur das Push-Symbol (Z. 84 bis 85) bleibt ohne Query. design.js liest ASSET_VERSION aus der eigenen Skript-URL (Z. 1298 bis 1302); ohne ?v= bleibt sie leer. Ein Versionswechsel wird von Hand in vier Dateien nachgezogen (index.html, radar.html, sw.js, manifest.webmanifest). Die Tests lesen die Referenz aus index.html (harness.js assetVersion) und melden jede Abweichung an elf Verweisen beider Seiten plus SW_VERSION, auch ein vergessenes ?v=.

Service Worker: Beim Installieren holt er die Hülle (Seiten, Manifest, Stylesheet, Skripte und vier Icons, alle mit Query) mit cache:"reload" und übernimmt sofort. Eigene Dateien laufen Netz-zuerst mit Cache-Rückfall ohne Zeitlimit; Navigationen fallen offline auf index.html bzw. radar.html. fonts.googleapis.com, fonts.gstatic.com und unpkg.com laufen Cache-zuerst mit Hintergrunderneuerung im selben Cache (Z. 17 und 73). Es gibt keinen message-Kanal und keinen Update-Hinweis; die Registrierung verschluckt Fehler (index.html Z. 214, radar.html Z. 259).

## 3 Datenquellen und Datenfluss

| Quelle | Endpunkt | Zweck |
|---|---|---|
| Open-Meteo Forecast | api.open-meteo.com/v1/forecast | 14 Tage plus Vortag, current, minutely_15, hourly, daily |
| Open-Meteo Multi-Modell | dito mit models= | Sechs Modelle, 3 Tage |
| Open-Meteo Ensemble | ensemble-api.open-meteo.com/v1/ensemble | ICON-D2-EPS, 2 Tage |
| Open-Meteo Air Quality | air-quality-api.open-meteo.com/v1/air-quality | AQI, PM, Ozon, Pollen |
| Open-Meteo Metadaten | api.open-meteo.com/data/<dir>/static/meta.json | Laufzeiten von sechs Modellen, ARPEGE unter meteofrance_arpege_europe |
| Open-Meteo Geocoding | geocoding-api.open-meteo.com/v1/search | Ortssuche |
| BigDataCloud | api.bigdatacloud.net/data/reverse-geocode-client | Ortsname zur GPS-Position |
| DWD GeoServer WFS | maps.dwd.de/geoserver/dwd/ows | Warnungen der Gemeinde |
| DWD GeoServer WMS | maps.dwd.de/geoserver/dwd/wms | GetMap RADOLAN RV, GetLegendGraphic, GetStyles |
| DWD Capabilities | maps.dwd.de/geoserver/dwd/Niederschlagsradar/ows | Zeitachse, REFERENCE_TIME, Bbox (radar.js Z. 16) |
| Eigener Worker | wetter-nina-proxy.anferny-wetter.workers.dev | /nina, /push/*, /feedback |
| OpenFreeMap | tiles.openfreemap.org | Vektorkacheln und Glyphen der Radarkarte |
| Google Fonts, unpkg | fonts.googleapis.com, fonts.gstatic.com, unpkg.com | Schrift Sora, MapLibre 5.24.0 |

Ablauf: initDesignApp wählt den Startort in dieser Reihenfolge: Reise-Automatik, gespeicherter Suchort (wetter:active mit source search), PREVIEW_LOC oder gespeicherte GPS-Position, sonst Geolocation. load() startet sieben Fetches parallel per Promise.allSettled; nur der Forecast ist Pflicht. splitPastDay trennt den Vortag per Datum als fc.past ab. Die Nutzlast {fc, ens, md, air, warn, nina, meta, loc} geht an renderAllDesign und wird danach unter wetter:loc:<lat>,<lon> gespeichert. Zeitbasis der Datenschicht ist coreNow() (window.TEST_NOW oder Date.now()), wie nowMs() in design.js.

Cache und Offline: getJson nutzt fetch mit cache "no-store" und ohne Timeout. Scheitert der Forecast, zeigt die App den Datencache des Orts ohne Altersgrenze mit Banner „Keine Verbindung …“ und der Zeile „Stand … · gespeicherte Daten“.

Außerhalb Deutschlands: Der DWD-Layer kennt nur deutsche Gemeinden, der Worker reicht Koordinaten außerhalb 47 bis 56 N und 5 bis 16 O nicht weiter (worker.js Z. 125). Ein Ort wie Lignano bekommt keine Warnungen, ohne Hinweis in der App.

## 4 Startseite: Funktionen aus Nutzersicht

Hero und Zeitreise: Wochentag mit Uhrzeit, Wettertext, große Temperatur mit Ebenen-Icon und Chips „Hoch“, „Tief“, „Gefühlt“ sowie „2° wärmer als gestern“; fehlende Werte lassen den Chip weg. Nebel hat eine eigene Lage mit drei Nebellinien unter den Wolken. Ein Tipp auf eine Stundenspalte baut das Hero auf diese Stunde um („Morgen, 17 Uhr“, Knopf „Jetzt“); Ziehen vom markierten Griff und Pfeiltasten funktionieren ebenfalls. Ist das Hero aus dem Bild, erscheint oben die Leiste „Vorschau · …“.

Hinweis und Regenrat: Nowcast-Satz aus den 15-Minuten-Werten, darunter ein dreistufiger Schirm-Rat, unter 30 % Risiko vorsichtiger. Ohne Regen erscheint die Regenaussicht. Fehlen die 15-Minuten-Werte, bleibt das ganze Feld verborgen.

Weitere Felder: Fünf Ansicht-Chips (Überblick, Regen, Wind, Wärme, Licht) färben Stundenstreifen und Tagesliste um und beantworten die Frage für 24 Stunden in einem Satz. 48 Stundenspalten mit blauer Füllung ab 25 % Regenrisiko, dazu „Verlauf 48 h“ als Meteogramm. Rausgehen zeigt für vier Aktivitäten bis zu drei passende Fenster in 48 Stunden mit grüner Spur unter den Stunden. Die Regenpausen-Karte erscheint nur bei Regen im Nowcast und nennt die nächste trockene Phase für 15, 30 oder 60 Minuten. Dazu bis zu drei Highlights der nächsten sieben Tage, Tagesliste mit 7 plus 7 Zeilen und ein Modellvergleich aus sechs Modellen mit Ensemble-Band.

Kacheln: UV-Index (nachts „UV morgen“ mit Mondphase), Wind, Regen, Sonne, Luftfeuchte, Luftdruck, Luftqualität und Pollen oder ersatzweise Sicht mit Nebelrisiko. Wind, Regen, Sonne und Sicht klappen ein Feld auf, jedes endet mit „Woher kommt das?“. Dieser Knopf und „Woher?“ in der Aktualitätszeile öffnen ein Blatt mit elf Abschnitten; der Herkunftstext zählt die sechs Modelle aus MODELS auf.

Warnungen: DWD und NINA werden nach Stufe gemischt und als aufklappbare Felder in vier Farben gezeigt. Bei DWD fallen Cancel, Test und abgelaufene Meldungen weg, NINA-Dubletten des DWD ebenso. Bei NINA filtert der Worker Cancel und Abgelaufenes (expires als ISO/UTC normalisiert); normalizeNina und mergeWarnings filtern Abgelaufenes als zweite Sicherung, ohne expires bleibt die Meldung. „bis …“ kommt aus demselben Feld.

Einstellungen: Einheiten, Startansicht, Bewegung, Farbschema (Bento als Standard oder Nil nach Sanzo Wada, wirkt sofort mit Überblendung, Statusleiste folgt), Rausgehen-Toleranzen, „Startseite“ (Felder sortieren und ausblenden), Reise (Ziel, Zeitraum, Countdown, täglicher Wechsel in die Reisevorhersage), Regen-Alarm (Abschnitt 6), Tagesfilm, Rückmeldung. Intern bleibt alles in °C und km/h. Die Aktualitätszeile und #updated zeigen die Zeit des Ortes, bei fremder Zone mit Zusatz „Ortszeit“.

Tagesfilm: Zehn Sekunden Animation auf 1080×1920. Er startet beim ersten erfolgreichen Laden des Tages, auch abends; maybeAutoFilm prüft keine Tageszeit, „Morgens als Begrüßung“ ist nur die Beschriftung. filmShown wird erst gesetzt, wenn openFilm() wirklich läuft. Bei „Reduziert“, prefers-reduced-motion und PREVIEW_LOC entfällt er. „Als Video teilen“ nimmt per MediaRecorder auf (MP4 vor WebM).

Feedback: Blatt „Rückmeldung“ mit Art (Fehler, Idee, Lob), Text und Kürzel. POST an den Worker mit Version, User-Agent, Breite, Schriftfaktor, Standalone, Ansicht und letztem Fehlertext, ohne Ort; die Fußnote nennt das. 5xx und fehlende Antwort landen in der Warteschlange (max. 10), 4xx außer 429 werden als Fehler gezeigt und nicht eingereiht.

Nacht und Tag: Die Nachtpalette schaltet, sobald die Sonne am Ort tiefer als −8° steht. Der Knopf oben rechts erzwingt Tag oder Nacht bis zum nächsten automatischen Wechsel; ohne JS bleibt er leer. Ein offenes Radar-Blatt lädt beim Wechsel von Nacht oder Farbschema mit dem neuen Zustand neu. Die Statusleiste (theme-color) setzt schon das Inline-Skript in index.html und radar.html aus Nachtwert und Schema, design.js und radar.js nur noch bei Wechseln.

## 5 Regenradar

radar.html ist eine eigene Seite und wird zugleich als Blatt über der Startseite in einem iframe mit ?embed=1&night=0|1 geladen; der Embed-Modus blendet Kopfzeile und Tab-Leiste aus und übernimmt den Nachtzustand aus dem Parameter, es gibt keine postMessage-Kommunikation. Das Farbschema liest radar.html wie index.html vor dem Stylesheet aus wetter:settings (Klasse scheme-nil, theme-color), als Blatt und als Vollbildseite; applyScheme lädt ein geladenes Blatt beim Wechsel neu wie applyNight. Die Zeitachse unter dem Regler hat eigene Nil-Töne (--tl-obs, --tl-fc nachts Slate Color). radar.html bindet das gemeinsame Manifest ein und trägt den App-Titel „Wetter“, der Seitentitel bleibt „Regenradar“; ein von dort angelegtes Homescreen-Icon startet auf index.html. Die Grundkarte ist ein eigener MapLibre-Stil auf OpenFreeMap-Kacheln, Zoom 4 bis 12; der WMS-Layer dwd:Niederschlagsradar liegt mit Deckkraft 0,72 unter den Ortsnamen.

Zeitachse: GetCapabilities wird per Regex gelesen, erste Dimension time ohne Layerbezug. REFERENCE_TIME gilt als jüngste Beobachtung, wenn der Wert in der Zeitliste steht und höchstens jetzt plus 10 Minuten liegt, sonst der jüngste Zeitpunkt vor jetzt. Davor bis zu sechs Zeitpunkte im 10-Minuten-Raster, danach bis zu acht Prognosen im 15-Minuten-Raster bis +120 min. Je Zeitpunkt lädt radar.js ein GetMap-Bild (EPSG:3857, 25 % Rand) als Blob. Der Maßstab ist min(1,5, devicePixelRatio) mal 1,5, also bis zu 2,25-fache CSS-Pixel, Bildgröße 64 bis 2048 px. LRU-Cache mit 36 Einträgen, zwei Abrufe parallel. Ohne Zeitachse trägt der Rückfall-Frame die Abrufzeit (Schlüssel now@<Abrufzeit>|<Ausschnitt>), jedes Aktualisieren holt das Bild neu. Zwei Bildebenen blenden in 280 ms über; whenSourceLoaded löst spätestens nach 400 ms auch ohne sourcedata aus.

Bedienung: Play/Pause (700 ms je Bild, Autostart), Schieberegler mit Marker an der Grenze Beobachtung/Prognose, „Zum Ort“, „Radar aktualisieren“. Alle 5 Minuten werden die Metadaten neu geholt, im Hintergrund pausiert die Wiedergabe, nach Rückkehr wird frühestens nach 60 s aktualisiert. Die Legende kommt aus der SLD-Stildefinition, mit Rückfall auf das DWD-Legendenbild mit fester dunkler Schrift. Im Querformat sind „Alle Stufen“ und der Hinweistext ausgeblendet, als Absicht kommentiert (radar.html Z. 175 bis 178). Badge und Marker zeigen Gerätezeit; weicht die Gerätezone von MEZ/MESZ ab, hängt zoneHint() das Zonenkürzel an Badge, Regler und Marken-Label. Als eigenständige Seite rechnet die Nachtpalette mit nightByClock aus Gerätezeit und Gerätezone, weil wetter:active keine Zeitzone trägt.

## 6 Infrastruktur

Cloudflare Worker wetter-nina-proxy (compatibility_date 2026-10-01, workers_dev):

| Route | Zweck |
|---|---|
| GET /health | Lebenszeichen |
| GET /nina?lat&lon | Bereich 47 bis 56 N, 5 bis 16 O, sonst 200 mit note „außerhalb Deutschlands“; Kreis per BKG-WFS; Dashboard plus höchstens 12 Details; Cancel und abgelaufene Meldungen filtern, expires als ISO/UTC, HTML bereinigen, sortieren |
| GET /nina/<ARS> | Dasselbe für einen Kreis direkt |
| POST /push/subscribe, /push/unsubscribe | Abonnement in KV SUBS anlegen oder löschen; Endpunkt nur per https auf einen bekannten Push-Dienst, Körper höchstens 4096 Zeichen (413), subscribe höchstens 120 je IP und Stunde (429) |
| POST /push/test | Probenachricht, höchstens alle fünf Minuten je Abonnement und 10 je IP und Stunde; ohne vollständige VAPID-Konfiguration 500 |
| POST /feedback | Rückmeldung in KV FEEDBACK, 90 Tage, max. 5 je Stunde und Kennung sowie 20 je IP |
| GET /feedback, POST /feedback/ack | Lesen (alle KV-Seiten per Cursor) und bestätigen, nur mit Bearer FEEDBACK_TOKEN |

Secrets sind VAPID_PRIVATE_KEY und FEEDBACK_TOKEN (wrangler secret put, lokal proxy/.dev.vars; die Datei fehlt im Checkout, proxy/README.md beschreibt Aufbau und Erzeugung). VAPID_PUBLIC_KEY, VAPID_SUBJECT und die KV-IDs stehen in wrangler.toml; fehlt eines von Schlüsselpaar oder Subject, antwortet /push/test mit 500 und der Cron sendet nichts (console.error), einen Fallback gibt es nicht mehr. Der Cron */15 ruft checkRain, das die Abonnements seriell abarbeitet. ALLOWED_ORIGINS sind anferny33.github.io, localhost:8000 und 127.0.0.1:8000 (Z. 43 bis 47). Anfragen mit fremdem Origin-Header bekommen 403 (Z. 94), auch Preflights; ohne Origin (curl, feedback.sh) geht es durch, das steht im Kopfkommentar. /nina, /push/* und POST /feedback sind bewusst öffentlich; Schutz sind Endpunkt-Prüfung, Größenbegrenzung und Zähler je IP in KV (rate:sub:<ip>, rate:test:<ip>, fbrate:ip:<ip>, Fenster eine Stunde). Nur die Feedback-Leseroute ist per Token geschützt. proxy/feedback.sh liest und bestätigt Rückmeldungen mit dem Token aus .dev.vars, die URL ist per FEEDBACK_URL überschreibbar.

Push-Kette: enablePush prüft zuerst, ob ein Ort geladen ist, fragt dann die Berechtigung an, wartet bis 6 s auf navigator.serviceWorker.ready und abonniert mit PUSH_PUBLIC_KEY; eine vorgemerkte Abmeldung desselben Endpunkts wird dabei verworfen. Der Worker speichert unter sub:<SHA-256-Hash des Endpunkts> mit auf drei Dezimalen gerundeten Koordinaten. rainAlert löst aus, wenn jetzt unter 0,1 mm fällt und in den nächsten vier Viertelstunden mindestens 0,1 mm beginnt. sendWebPush verschlüsselt nach RFC 8291 und signiert per VAPID ES256. sw.js zeigt „Regen ab HH:MM Uhr“ mit tag regen-alarm, ohne JSON-Nutzlast „Regen in Sicht“; ein Tipp fokussiert die offene App, ohne zu data.url zu navigieren, oder öffnet sie. Antworten 404/410 löschen das Abonnement, nach Erfolg gilt drei Stunden Sperrfrist. disablePush merkt sich eine fehlgeschlagene Worker-Abmeldung in settings.pushUnsub, syncPush holt sie beim nächsten Laden nach, sofern das Abonnement nicht wieder aktiv ist. syncPush meldet einen Ortswechsel ab 0,01° nach und schluckt Fehler bis auf 429 (console.warn). „Probenachricht senden“ erscheint nur bei Push-Unterstützung und aktivem Alarm. Ob Secrets gesetzt sind und der aktuelle worker.js deployt ist, zeigt nur das Cloudflare-Konto; die Härtung vom 10. Oktober ist noch nicht deployt.

Deployment: Push auf den Branch, Pages nach etwa einer Minute live; Worker per npx wrangler deploy, wrangler ist bewusst nicht deklariert (README und proxy/README.md).

## 7 Gespeicherter Zustand

| Schlüssel | Ort | Zweck |
|---|---|---|
| wetter:loc:<lat>,<lon> | localStorage | Datencache je Ort {savedAt, payload}, zwei Dezimalen (wetter:loc:48.14,11.58), keine Altersgrenze, keine Bereinigung |
| wetter:pos, wetter:active | localStorage | Letzter GPS-Ort; aktiver Ort mit lat, lon, name und source search oder gps, ohne Zeitzone, vom Radar mitgelesen |
| wetter:settings | localStorage | temp, wind, motion, scheme (bento oder nil, vor dem ersten Zeichnen gelesen), startView, rainTol, feelAdj, hidden, order, dayfilm, push, pushLoc, pushUnsub, trip, tripSwitched, filmShown |
| wetter:recent | localStorage | Bis zu drei Suchorte |
| wetter:night | localStorage | „1“/„0“, vor dem ersten Zeichnen gelesen, minütlich geprüft, nur bei Änderung geschrieben |
| wetter:nightmode | localStorage | Handwahl {force, auto}, verfällt beim automatischen Wechsel |
| wetter:view, wetter:activity, wetter:pause | localStorage | Ansicht, Aktivität, Pausendauer |
| wetter:feedback | localStorage | Kennung (16 Zeichen), Name, Warteschlange |
| PushManager-Abonnement | Browser | Eigener Zustand neben settings.push |
| wetter-shell-20261010a | Cache Storage | Hülle plus alle erfolgreich geladenen Same-Origin-GETs plus Schrift- und unpkg-Antworten |
| sub:<hash>, rate:sub:<ip>, rate:test:<ip> | KV SUBS | Push-Abonnement mit Ort, lastSent, lastTest; Zähler je IP für eine Stunde |
| fb:<ms>-<rand>, fbrate:<id>, fbrate:ip:<ip> | KV FEEDBACK | Rückmeldungen und Rate-Limit je Kennung und je IP |
| caches.default | Worker | NINA je Kreis 120 s (Fehler 20 s), Kreis unter https://kreis.cache.local/<lat>,<lon> 1 Tag |
| window.PREVIEW_LOC, TEST_NOW, NINA_PROXY | global | Vorschau-Ort, Testzeit, Worker-Adresse überschreiben (leere Zeichenkette schaltet NINA aus) |
| window.__lastFilm, self.SW_INFO | global | Testhaken für Film und Service Worker |

## 8 Design und Bewegung

modern.css definiert die Tagespalette als Tokens auf :root (--ground #ECEAF4, --ink #1E1B2E, --sun #F6D35B und weitere), dazu fünf Tönungsstufen tc1 bis tc5 für die Wärme-Ansicht. Die Hero-Farbe --hero wechselt über Theme-Klassen am body. html.night definiert alle Tokens neu und dunkelt die Hero-Farben ab; html.fade blendet 0,9 s über (Nacht- und Schemawechsel). Der Akzent für aktiven Tab, Jetzt-Knopf der Vorschauleiste und Kreis im Hinweisfeld läuft über --accent und --accent-ink am body (im Bento-Schema die Hero-Farbe und --ink). Das Schema Nil nach Sanzo Wada (Kombinationen 330 und 294) setzt unter html.scheme-nil dieselben Tokens neu (Grund #bce4e5 Nile Blue, Schrift #051230 Deep Indigo, Nebentext #34454c, Karten weiß, Akzent #099197 Green Blue, fünf eigene Wärme-Tönungen), die Hero-Farben je Theme-Klasse unter html.scheme-nil .theme-*, Nacht-Themes dunkel mit heller Schrift, und unter html.scheme-nil.night die Nachtpalette (Grund #051230, Karten #12354e, dunkles Feld #34454c, Hero #064f6e für alle Lagen); alle Textpaare erreichen 4,5:1, geprüft in smoke-design.js (89 Paare aus den Token und den Hero-Regeln des Stylesheets, darunter Nebentext auf lfill/wfill und die nachts invertierten Jetzt-Spalte und Modell-Chip), Bedienelemente und Balken 3:1. Nachbesserung: der markierte Modell-Chip nachts hat eine dunkle Beschriftung wie die Jetzt-Spalte (Bento #5A5478, Nil #34454c; vorher 1,9:1 bzw. 1,4:1), der Jetzt-Knopf im dunklen Nil-Hero (Nacht-Themes am Tag) ist Nile Blue auf Vandar Poel's Blue (6,5:1 statt 2,1:1), der trockene Temperaturbalken im dunklen 14-Tage-Feld nutzt über --fair-bar nachts und im Schema Nil die Sonnenfarbe statt der Hero-Farbe (Bento nachts 7,9:1 statt 1,4:1, Nil 11,3:1 am Tag und 6,1:1 nachts statt 1,1:1; der Token hat var(--hero) als Rückfall, damit die Ansicht-Regeln der Tagesliste weiter greifen). html.fade blendet auch Tab-Pille, Hinweiskreis, Jetzt-Knopf der Vorschauleiste, Vorschauleiste, Blatt (geschlossen und offen, die offene Sichtbarkeitsregel mit ID-Gewicht bekommt dafür ein Pendant mit html.fade) sowie Knöpfe im Blatt (.set-btn, .set-vis) über; die Einstellungs-Chips bleiben bei 0,3 s als Tipp-Rückmeldung. Schrift ist Sora von Google Fonts, Grundgröße 17 px, auf Touch-WebKit Dynamic Type, gedeckelt bei 27,2 px. SVG-Texte stehen in rem (Z. 304, 333 bis 334, 530 bis 531). Es gibt kein prefers-color-scheme (bewusst, Abschnitt 12) und keine Druckregel.

Bewegung: eine Kurve --ease und drei Dauern (0,3 s, 0,55 s, 0,9 s). Die Startchoreografie staffelt Einblendungen über inline animation-delay und die Intro-Uhr in design.js (INTRO_SCALE 0,6). Das Hero-Icon hat Ebenen (Sonne, Mond, Wolken, Tropfen, Flocken, Blitz, Sterne, Nebellinien), Kacheln haben Mikroanimationen. Bei Warnfeldern wackelt das DWD-Icon auf allen Stufen (svg.wobble), NINA-Icons senden Wellen (svg.wave), nur der Rand-Puls ist auf Stufe 3 und 4 beschränkt (Z. 162 bis 171). prefers-reduced-motion und „Reduziert“ schalten alle Animationen und Transitions ab.

Barrierefreiheit: focus-visible-Ringe, .vh-Texte für Diagramme, Stundenspalten als Schaltflächen mit Satz je Stunde, Live-Region #live, aria-current in der Tab-Leiste, Grau --ink-2 auf getönten Flächen für 4,5:1.

## 9 Tests und Werkzeuge

npm test startet tests/run.js. Der Runner führt die vier Node-Skripte ohne Abhängigkeiten nacheinander aus, läuft nach einer roten Suite weiter, fasst am Ende je Suite ok und FAIL zusammen und endet mit Exit-Code 1, sobald eine Suite fehlschlägt. tests/harness.js setzt process.env.TZ auf Europe/Berlin, bevor das erste Date entsteht, und stellt TEST_NOW (25.09.2026, 14:15 Ortszeit), check/finish, die Mocks und assetVersion() für alle Suiten bereit. Der Produktionscode läuft per vm.runInContext in Sandboxen mit DOM-, Storage-, Fetch- und Geolocation-Stubs; smoke-push.js importiert den Worker als ES-Modul mit Node-WebCrypto.

| Suite | Checks | Abdeckung |
|---|---|---|
| smoke-design.js | 434 | Startseite komplett inklusive Einstellungen, Farbschema Nil (Klasse und Statusleiste in beiden Seiten, Kontrast der Token und Hero-Regeln, Nachtregeln, Fade, Radar-Blatt beim Schemawechsel), Zugänglichkeit, Push-Ablauf mit Stubs, Tagesfilm, Rückmeldung, Vorschauleiste, Warnungen mit fester Zeit, Versions-Query beider Seiten |
| smoke-radar.js | 52 | Frames, Ladereihenfolge, Überblendung, Cache, Rückfall ohne Zeitachse, Abdeckung, Legende, Nachtschalter und Embed-Parameter, Statusleiste je Schema und Schema-Skript in radar.html, Zonenzusatz, sonne.js an Polen |
| smoke-sw.js | 21 | Hülle mit Icon-Query, Versionierung beider Seiten, Manifest, Cache-Strategie, Push-Anzeige |
| smoke-push.js | 43 | Verschlüsselung, VAPID, Alarmregel, Push- und Feedback-Routen mit Begrenzungen, Origin-Sperre, NINA-Route mit gestubbtem fetch, Datenschicht (normalizeNina, NINA_PROXY, SETTINGS_DEFAULTS) |

Lücken: Kein Browser in der Suite, also kein Layout, keine CSS-Wirkung, keine Animationen, kein echter IntersectionObserver (nur ein Stub in boot()), kein echter Service-Worker-Lebenszyklus, kein GPS, kein Canvas, keine echte Karte. Der Browser-Check vom 10. Oktober (Playwright mit Chromium, 39 Prüfpunkte, Screenshots Tag und Nacht) war ein Einzellauf und ist kein Teil von npm test. Die Route /nina wird nur mit gestubbtem fetch geprüft; das Netz war im Container gesperrt. Viele Checks sind Regex-Prüfungen auf Quelltext. Synchronisiert wird über 79 feste Waits von 300 bis 1100 ms; das steht im Kopf von harness.js als bewusste Einschränkung (bei Flattern Waits erhöhen, nicht Checks lockern).

Werkzeuge: npm run preview baut tests/iphone-preview.html mit der echten App im iPhone-Rahmen (Links nur noch auf index und radar umgeschrieben), build-design-render.js setzt den Test-Dump in index.html ein, build-icons.js rendert die Icons per Playwright (bewusst nicht deklariert, Hinweis im Kopf und im README), tests/ax-dump gibt per XCUITest den Bedienungshilfen-Baum von Safari im Simulator aus.

Testlauf: Am 10. Oktober nach der Bereinigung lief npm test in diesem Container mit TZ=UTC und mit TZ=Europe/Berlin jeweils grün, die Logs sind byteidentisch: 424, 49, 21 und 43 Checks, zusammen 537, Exit-Code 0, rund 31 s. npm run preview schreibt tests/iphone-preview.html (365 KB). Negativtests der Nachbesserung: ohne die Korrektur an enablePush, am syncPush-Schutz oder mit Date.now() in normalizeWarnings werden 1, 1 bzw. 5 Checks rot. Nach der Nachbesserung zum Farbschema Nil (Radar, Modell-Chip, Statusleiste beim Start, Fade, Versions-Query 20261010a) lief npm test mit TZ=UTC grün: 434, 52, 21 und 43 Checks, zusammen 550; npm run preview schreibt die Vorschau neu.

## 10 Dokumentation und Planung

README.md beschreibt Seiten, Datenquellen (OpenFreeMap statt CARTO), lokale Arbeit, Tests (Runner und Tabelle der vier Suiten), Werkzeuge (Playwright und wrangler bewusst nicht deklariert, package.json-Version ohne Bedeutung) und Veröffentlichung (Standard-Branch, PR 1, Radar-Icon startet auf index.html). docs/verbesserungen.md ist die Checkliste der 17 Ideen aus der UI/UX-Durchsicht vom 8. Oktober, alle mit Commit-Beleg abgehakt; die Durchsicht selbst liegt nicht als Datei vor. docs/veroeffentlichung.md ist die App-Store-Checkliste in acht Phasen und nennt OpenFreeMap als Empfänger. Unter docs/superpowers liegen 17 Specs und 15 Pläne vom 8. und 9. Oktober, dazu seit dem 10. Oktober eine README mit Lesehinweisen und einer Tabelle der Themen mit den umsetzenden Commits.

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

Insgesamt 96 Commits bis 402a367, keine Tags; 50f1e2d hat dieses Dokument ergänzt. Autoren: Anferny Nash (51), Michael Knodt (39), Claude (6). short-url-qr und bayern-forest sind unabhängige Mini-Projekte auf demselben Wurzel-Commit. PR 1 ist offen, mergeable_state clean. Die Bereinigung vom 10. Oktober liegt in den Commits 12cd4e6 (Tests), acdd802 (Datenschicht und Worker), 14300f6 (Startseite), 77466d1 (Styles und Hülle), 5a5c916 (Radar) und 777a7b3 (Dokumentation).

## 12 Auffälligkeiten und offene Punkte

Stand nach der Bereinigung vom 10. Oktober 2026. Die Befunde der Bestandsaufnahme stehen unter „Behoben“ mit ihrer Korrektur und unter „Weiterhin offen“ mit dem Grund, warum sie bleiben. Die Änderungen liegen in sechs Commits von 12cd4e6 bis 777a7b3 auf dem Branch.

### Behoben am 10. Oktober

Daten und Worker:

- Abgelaufene NINA-Meldungen: isoTime() im Worker normalisiert expires aus info[].expires, expiresDate, payload.data.expires oder detail.expires nach ISO/UTC; loadNina filtert Abgelaufenes neben Cancel. normalizeNina und mergeWarnings filtern als zweite Sicherung, „bis …“ kommt weiter aus expires.
- NINA_PROXY: window.NINA_PROXY gilt, sobald es eine Zeichenkette ist, auch die leere; nur undefined oder null fällt auf die feste Adresse zurück.
- Kommentar über der WMO-Tabelle lautet „WMO-Wettercodes von Open-Meteo: Symbol und deutscher Text je Code“.
- SETTINGS_DEFAULTS kennt pushLoc, trip, tripSwitched, filmShown und das neue pushUnsub (nur https-Zeichenketten), mit Kommentar zu den Formen.
- META_MODELS hat ARPEGE unter meteofrance_arpege_europe; jedes Modell aus MODELS hat ein Verzeichnis. Der Herkunftstext zählt die Modelle per modelListText() aus MODELS auf.
- Push-Routen bleiben bewusst öffentlich (Kopfkommentar), sind aber gehärtet: knownPushEndpoint() verlangt https, höchstens 2048 Zeichen und einen bekannten Push-Dienst, p256dh und auth sind gedeckelt, readJson() begrenzt den Körper auf 4096 Zeichen (413), rateLimited() zählt je IP in KV SUBS (subscribe 120, test 10 je Stunde).
- Feedback: zusätzlich 20 je IP und Stunde. listAll() läuft KV-Listen per Cursor über alle Seiten, in feedbackList und checkRain. Der Fallback mailto:wetter@example.org ist weg; vapidConfigured() verlangt Schlüsselpaar und VAPID_SUBJECT, sonst 500 bzw. kein Versand mit console.error.
- CORS: fremder Origin-Header bekommt 403, auch bei OPTIONS; ohne Origin weiter erlaubt.
- Kopfkommentar von worker.js listet die drei Feedback-Routen und die Zugriffsregeln.
- proxy/README.md: Kreis per BKG-WFS (vg250:vg250_krs), neuer Abschnitt „Werkzeuge und Geheimnisse“ mit .dev.vars, npx wrangler und einem geprüften node-Einzeiler für das VAPID-Schlüsselpaar statt des Verweises auf einen nicht vorhandenen Befehl.

Startseite:

- heroChipsHtml setzt Hoch, Tief und Gefühlt nur mit isNum; fehlende Werte lassen den Chip weg.
- Nebel (Code 45 und 48) hat die eigene Hero-Lage „nebel“ mit der Ebene fog aus drei Linien; modern.css hat Grund-, Nacht- und Animationsregeln (fogIn) dafür.
- Ohne IntersectionObserver gilt das Hero als sichtbar (heroVisible = true).
- Die gewählte Stunde überlebt renderAllDesign auch an der Startstunde eines Fensters (gi >= w.start).
- tc3: Token Tag #F0EEDC und Nacht #3A3B36 plus Regel für .hcol.tc3; tempClass hatte die Stufe schon.
- Die Sicht-Kachel trägt data-name="pollen" (TILE_SLUGS vor opts.key); „Pollen oder Sicht“ ausblenden versteckt Kachel und Feld.
- applyLayout fügt sortierbare Felder in die Lücken zwischen den festen Feldern (Hero, Warnungen, Reise) ein statt ans Ende.
- sichtPanelHtml: der Nebelsatz spannt über alle Blöcke mit hohem Risiko.
- dropIcon vergibt eindeutige Masken-IDs (dropclip<n>).
- answerLight entscheidet nachts über den Sonnenaufgang des Tages der aktuellen Stunde.
- fmtWarnTime, openSource, updateFreshness, load(), feedbackMeta, renderTrip, tripAutoSwitch, choosePlace und maybeAutoFilm rechnen mit nowMs(); Date.now() bleibt nur für verstrichene Zeit (Intro, Zähler, Ziehen, Film). Ein Quelltext-Check schließt new Date() ohne Argument aus.
- Push: enablePush prüft den Ort vor Berechtigung und Abonnement und räumt eine Vormerkung desselben Endpunkts; „Probenachricht senden“ nur bei pushSupported() und aktivem Alarm; disablePush merkt eine fehlgeschlagene Worker-Abmeldung in settings.pushUnsub, syncPush holt sie nach (nicht, wenn das Abonnement wieder aktiv ist) und meldet 429 per console.warn.
- Tagesfilm: der Zähler rechnet Math.round(Number(tmp(sc.temp)) * tl.count), bei °F also ab 0; maybeAutoFilm setzt filmShown erst nach erfolgreichem openFilm().
- applyNight schreibt wetter:night nur bei Änderung. Ein Listener für visibilitychange (initFreshness entfällt); ein GPS-Ort ortet beim Sichtbarwerden nur, wenn die letzte Ortung älter als GPS_MAX_AGE (10 Minuten) ist. #gps setzt currentLoc nicht mehr auf null, locate(always) zeigt den Fehler-Banner auch bei bestehendem Ort.
- sendFeedback: 4xx außer 429 als Fehler mit Status (Text bleibt), 5xx eingereiht mit Hinweis, ohne Antwort „Kein Netz“. Beim Flush verworfene Einträge werden gezählt, angesagt und beim nächsten Öffnen gezeigt. Fußnote nennt „Gerät und Browser (User-Agent)“.
- #updated zeigt per updatedText(iso, tz) „Stand 25.09., 14:15 Uhr“ in der Zeitzone des Ortes, mit Zusatz „Ortszeit“ bei fremder Zone wie #freshTxt.
- Herkunftstext nennt ARPEGE, die Kartenangabe lautet „OpenFreeMap (OpenMapTiles-Schema, Daten OpenStreetMap)“.
- radarEmbedUrl() hängt night=1 bzw. night=0 an; applyNight setzt bei einem Wechsel den src eines geladenen #radarFrame neu.
- Tote Pfade: elf UI-Icons (pin, refresh, clock, cal, grid, radar, wind, sunUp, gauge, leaf, layers), Variable worst und die leere Überschrift „Hintergrund-Partikel“ entfernt; ein Quelltext-Check sichert das.

Radar:

- Rückfall ohne Zeitachse: der Frame trägt die Abrufzeit, frameKey ergibt now@<Abrufzeit>|<Ausschnitt>, jedes Aktualisieren holt das Bild neu; kehrt die Zeitachse zurück, räumt doRefresh die „aktuell“-Bilder aus dem Cache.
- Nacht im Embed-Modus: embedNight() liest den Parameter night aus der URL, radarNight() nutzt ihn direkt und rechnet nur ohne Parameter selbst; eine Handwahl der Startseite bleibt so erhalten.
- sonne.js nightByClock: ohne −8°-Bogen entscheidet die Mittagshöhe 90° − |φ − δ| < −8° (Polarnacht). Der alte Vorzeichentest meldete jenseits 86,4° Breite „dunkel“, wenn die Sonne den ganzen Tag im Dämmerungsband blieb.
- lg-ready entfernt (kam nur in radar.js vor).
- radar.html bindet das gemeinsame Manifest ein, apple-mobile-web-app-title ist „Wetter“, der Icon-Link trägt die Versions-Query der Seiten (damals 20261009q).
- Badge, Regler und Marke tragen bei fremder Gerätezone den Zonenzusatz aus zoneHint() (Vergleich mit Europe/Berlin); in MEZ/MESZ ändert sich nichts.
- Querformat: das Ausblenden von „Alle Stufen“ und Hinweistext ist im Stylesheet als Absicht kommentiert.

Styles und Hülle:

- .pchip-Regeln nach Container getrennt (.pchips .pchip für Regenpausen, .pollen-chips .pchip für Pollen), die Nachtregel entsprechend angehoben.
- Kommentar zum Sonnenaufgang lautet „starten nach 0,9 s und laufen synchron 0,9 s (--d-slow)“; .umb-shaft braucht keine Regel, der Strich kommt vom svg-Element, als Kommentar festgehalten.
- Entfernt: id hourlyHint (index.html), .a-right, .a-pulse, .linkbtn (modern.css). cssModern (build-design-render.js) und fresh (smoke-design.js) bleiben, sie werden gebraucht.
- Icon-Links in index.html und radar.html tragen die Versions-Query der Seiten (damals 20261009q), sw.js führt alle vier Icons mit Query, das Manifest hat id, lang, description und icon.svg (sizes any) mit derselben Query; smoke-sw.js erzwingt das.
- Alt-Seiten (design.html, lignano-*.html) tragen theme-color #ECEAF4.
- Fußzeile nennt „Warnungen: DWD, NINA“ und „Karte: OpenFreeMap, © OpenStreetMap-Mitwirkende“.
- build-phone-preview.js schreibt keinen Link auf box-breathing.html mehr um; package.json hat ein engines-Feld (node >= 18) und test = node tests/run.js.

Dokumentation:

- README: Datenquellen mit OpenFreeMap statt CARTO, SVG-Text in rem, proxy/ mit drei Aufgaben, Abschnitt Tests nach package.json und tests/run.js mit Tabelle der vier Suiten, Abschnitt Werkzeuge (Playwright und wrangler bewusst nicht deklariert, package.json-Version ohne Bedeutung), Hinweis zu Standard-Branch und PR 1, Hinweis, dass ein Radar-Homescreen-Icon auf index.html startet.
- docs/veroeffentlichung.md nennt OpenFreeMap statt basemap.de; docs/verbesserungen.md Z. 26 sagt „in Betrieb“ mit Datum.
- docs/superpowers/README.md neu: Specs und Pläne sind datierte Entwurfsdokumente; das klassische Design wurde am 8. Oktober entfernt (0d696b1, e331959); Kästchen bilden den Stand nicht ab; maschinenspezifische Werte; „ohne Commit“ gegen 3b77f9c; Tabelle der 17 Themen mit den umsetzenden Commits.

Tests (Lücken aus Abschnitt 9):

- Versions-Query zentral in harness.js (assetVersion, ASSET_RE mit Icon-Links); der Check erwartet elf Verweise beider Seiten plus SW_VERSION.
- Warnungen, Reise und Aktualität rechnen mit TEST_NOW: wetter-core.js hat coreNow() als Vorgabe für normalizeWarnings und normalizeNina, mockWarnings(now) fällt auf TEST_NOW zurück.
- Trivialer Check ersetzt (highlightModel wird geprüft), capsB entfernt, check/finish nur noch im Harness, Worker-Host gegen wrangler.toml und README geprüft, Version gegen beide Seiten. Die Herkunfts-Checks verlangen sechs Modelle inklusive ARPEGE. Der Listener-Stub führt Listen, ein doppelter visibilitychange-Listener fällt auf.
- Testlauf: process.env.TZ im Harness, Runner statt &&-Kette; alle vier Suiten laufen in jeder Zeitzone.

### Weiterhin offen

- Commit 9abd6a4 hat proxy/.wrangler/ mit wrangler-account.json in die Historie gebracht; c44bbca hat die Dateien entfernt, .gitignore schließt .wrangler/ aus. Der Inhalt verschwindet nur durch Umschreiben der Historie (filter-repo oder Rebase plus Force-Push), das außerhalb der Bereinigung liegt. Dazu empfiehlt sich, das Wrangler-Login zu rotieren.
- scrubActive() bleibt: tests/smoke-design.js nutzt die Funktion fünfmal als einzigen Zugang zum Zieh-Zustand der Sandbox, der Quelltext-Check verlangt sie.
- Aufklappstaffelung nth-child 2 bis 7 (modern.css Z. 181 bis 186) ist korrekt: die sieben aufklappenden Zeilen 8 bis 14 liegen allein in .more-inner, nth-child(1) startet ohne Verzögerung. Kein Fehler.
- Sichtbarkeitsregel offener Blätter (modern.css Z. 467) zählt die IDs weiter auf, weil design.js je Blatt eine eigene body-Klasse setzt (sheet-open, radar-open, settings-open, src-open, fb-open); eine Sammelregel müsste dieselbe Zuordnung treffen oder alle Blätter zugleich sichtbar schalten, und smoke-design.js prüft den Wortlaut.
- Kein prefers-color-scheme: bewusst, die Nachtpalette folgt dem Sonnenstand am Ort und dem Schalter oben rechts; eine Systemvorgabe würde damit kollidieren.
- Push-Symbol in sw.js (Z. 84 bis 85) bleibt ohne Versions-Query; smoke-sw.js erwartet den Pfad, und Push-Nachrichten kommen nur online an.
- Querformat des Radars blendet „Alle Stufen“ und den Hinweistext weiter aus (radar.html Z. 175 bis 178): Absicht aus 4deb929, ein aufgeklapptes details mit 16 Zeilen würde bei höchstens 520 px Höhe die Karte verdrängen.
- Die eigenständige Radarseite rechnet die Nacht weiter mit Gerätezeit und Gerätezone, Badge und Marker zeigen Gerätezeit: wetter:active trägt keine Zeitzone (saveActiveLoc schreibt nur lat, lon, name, source). Sobald wetter-core.js die Zone ablegt oder design.js tz an die Embed-URL hängt, kann radar.js das aufgreifen.
- sonne.js: Tage mit −0,833°-Bogen ohne −8°-Bogen gelten weiter als hell, das ist korrekt, weil die Sonne dann −8° nie erreicht; die 365-Tage-Näherung bleibt.
- Ein von radar.html angelegtes Homescreen-Icon startet mit dem gemeinsamen Manifest auf index.html; bewusst so (README), ein eigenes Manifest wäre eine zweite Hülle mit eigenen Tests.
- Feste Waits in den Tests (79 Stellen, 300 bis 1100 ms) bleiben; ein Ladezähler plus Polling wäre ein Umbau an über 60 Stellen und ersetzt die Waits für Klick-Sperren und Animationen nicht (Kopf von harness.js).
- package.json bleibt bei version 1.0.0: die Versions-Query der Seiten ist die Version der App, das Feld hat keine Bedeutung (README, Werkzeuge). Es gibt weiter keine Abhängigkeiten; Playwright und wrangler sind bewusst undeklariert.
- box-breathing.html bleibt unverlinkt, nicht in Hülle und Manifest; es ist ein eigenständiges Mini-Projekt und keine Seite der App.
- Die Route /nina wird nur mit gestubbtem fetch geprüft, das Netz war im Container gesperrt; die Feldnamen für expires stammen aus der bekannten api31-Struktur, der Worker ist deshalb gegen vier Stellen tolerant. Das ARPEGE-Verzeichnis meteofrance_arpege_europe folgt dem Muster der übrigen Datensatznamen und ist nicht live geprüft; fetchModelMeta blendet einen fehlschlagenden Eintrag nur aus.
- Rate-Limit je IP für /push/subscribe trifft hinter Carrier-NAT geteilte Adressen; die Grenze wurde von 30 auf 120 je Stunde angehoben und syncPush macht 429 per console.warn sichtbar, ein feinerer Schutz fehlt.
- Specs und Pläne unter docs/superpowers bleiben unverändert (Spec zugaenglichkeit Z. 28 „bleibt in Pixeln“, „beide Designs“, offene Kästchen, maschinenspezifische Werte, „ohne Commit“); sie sind datierte Entwurfsdokumente, die neue README dort ordnet das ein.
- PR-1-Beschreibung nennt design.css, Leaflet und proxy/worker.js, nichts davon existiert mehr; der Text gehört dem Nutzer und wurde nicht angefasst.
- Versionsreihe mit Lücken (20261008w, 20261009e, 20261009o): nur festgestellt, die Query ist ein Cache-Buster und muss nicht lückenlos sein.
- Phasen 1 bis 7 der App-Store-Checkliste sind offen; die größten Lücken sind Datenschutzerklärung, lokale Schrift und Kartenbibliothek, Capacitor-Hülle und APNs.
