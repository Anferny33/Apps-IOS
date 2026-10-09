# Veröffentlichung im App Store – Checkliste

Stand: 9. Oktober 2026. Ziel: die Wetter-App als iOS-App im App Store veröffentlichen, davor
Freunde und Bekannte testen lassen. Die Phasen bauen aufeinander auf; innerhalb einer Phase ist
die Reihenfolge ein Vorschlag. Punkte mit „Entscheidung“ brauchen deine Wahl, bevor gebaut wird.

## Phase 0: Jetzt, Freunde und Bekannte testen lassen

Die App läuft als Homescreen-Web-App weiter, ohne Store, ohne Konto.

- [ ] Testanleitung als kurze Seite oder Nachricht: Link https://anferny33.github.io/Apps-IOS/, in Safari öffnen, Teilen, „Zum Home-Bildschirm“, von dort starten. Hinweis: Regen-Alarm und Tagesfilm-Teilen nur aus der Homescreen-App, iOS 16.4 oder neuer.
- [x] Rückkanal: Blatt „Rückmeldung“ in der App (Fußzeile und Einstellungen) an den eigenen Worker, Lesen mit `proxy/feedback.sh`. Entschieden am 9. Oktober 2026.
- [ ] Nutzung im Blick behalten: Open-Meteo erlaubt die kostenlose Nutzung nur nicht-kommerziell und bis 10.000 Aufrufe am Tag; jede Installation ruft die API direkt auf. Für eine Handvoll Tester reicht das.
- [ ] Rückmeldungen in `docs/verbesserungen.md` sammeln und abarbeiten.

## Phase 1: Entscheidungen vor dem Umbau

- [ ] Name der App: „Wetter“ ist generisch und kollidiert mit Apples eigener App (Entscheidung).
- [ ] Eigenes Symbol, das sich von Apples Wetter-Symbol klar unterscheidet; Ausgangspunkt ist `icons/icon.svg`.
- [ ] Bundle-ID in umgekehrter Domain-Schreibweise, etwa `de.<deinname>.<appname>` (Entscheidung).
- [ ] Zielgeräte: nur iPhone oder auch iPad; Mindestversion iOS 16.4 wegen Push (Entscheidung).
- [ ] Preis: kostenlos, ohne Käufe in der App (Entscheidung).
- [ ] Datenquellen für den Store-Betrieb: Open-Meteo-Tarif für die API oder eigener Zwischenspeicher im Worker mit Nutzungsgrenze (Entscheidung, siehe Phase 4).

## Phase 2: Konten und Formalien

- [ ] Apple Developer Program abschließen, 99 US-Dollar im Jahr, als Einzelperson (keine D-U-N-S-Nummer nötig). Apple-ID mit Zwei-Faktor-Anmeldung.
- [ ] App Store Connect: App anlegen mit Name, Bundle-ID, Sprache Deutsch, Kategorie Wetter.
- [ ] Datenschutzerklärung schreiben und unter einer festen Adresse veröffentlichen, zum Beispiel als Seite im selben GitHub-Pages-Repo. Inhalt: Standort (nur zur Vorhersage, lokal), Wetterabfragen an Open-Meteo, DWD, NINA-Proxy, BigDataCloud, basemap.de; Regen-Alarm speichert Push-Abonnement und gerundete Koordinaten beim Cloudflare-Worker; kein Tracking, keine Werbung.
- [ ] Support-Adresse: E-Mail oder Seite, wird im Store angezeigt.
- [ ] Impressum prüfen: für eine kostenlose private App ohne Geschäftszweck meist nicht nötig, Datenschutzerklärung aber immer. Im Zweifel kurz nachlesen oder fragen.
- [ ] Auftragsverarbeitung mit Cloudflare: Standardvertrag im Cloudflare-Konto akzeptieren; Koordinaten im Worker gröber runden (heute 100 m, für die Vorhersage reicht etwa 1 km).
- [ ] Export-Angabe: nur HTTPS, damit von der Verschlüsselungsmeldung ausgenommen; in App Store Connect so angeben.

## Phase 3: Native Hülle mit Capacitor

Die Web-Dateien liegen in der App, ein WKWebView zeigt sie an. Die Startseite bleibt gemeinsam für
Web-App und Store-App.

- [ ] Capacitor-Projekt im Repo anlegen (`npm init @capacitor/app`, iOS-Plattform hinzufügen), Web-Ordner auf die vorhandenen Dateien zeigen lassen.
- [ ] Xcode-Projekt: Bundle-ID, Anzeigename, Version und Build-Nummer, Ausrichtung Hochformat, Statusleiste hell und dunkel passend zur Nachtpalette.
- [ ] Standortabfrage: Begründungstext in `Info.plist` (`NSLocationWhenInUseUsageDescription`), zum Beispiel „Für die Vorhersage an deinem Standort“. Optional Capacitor-Geolocation-Plugin statt WKWebView-Abfrage für den sauberen Dialog.
- [ ] Datenschutz-Manifest `PrivacyInfo.xcprivacy` anlegen (Pflicht seit 2024): Standort, lokale Speicherung, keine Tracking-Domains.
- [ ] Schrift einbauen: Sora als Dateien in `fonts/` mit `@font-face` statt Laden von Google (Datenschutz, offline).
- [ ] Kartenbibliothek einbauen: MapLibre lokal statt vom CDN laden; `radar.html` und Service-Worker-Liste anpassen.
- [ ] Service Worker nur im Web registrieren (`http`/`https`), in der Hülle nicht nötig.
- [ ] Worker-CORS: `capacitor://localhost` zu den erlaubten Aufrufern in `proxy/src/worker.js` hinzufügen.
- [ ] Externe Links (Open-Meteo, DWD, Vollbild-Radar) in Safari öffnen statt im WebView; dafür das Browser-Plugin.
- [ ] Teilen des Tagesfilms: prüfen, ob `navigator.share` im WKWebView greift, sonst Share-Plugin mit Datei.
- [ ] Aufnahme des Tagesfilms im WKWebView prüfen (MediaRecorder); Rückfallweg Bild statt Video.
- [ ] Push neu bauen: Web Push läuft im WKWebView nicht. Capacitor-Push-Plugin holt das Gerätetoken, die App meldet es dem Worker (`{type: "apns", token, lat, lon}`), der Worker sendet an Apples Push-Dienst (HTTP/2, JWT mit `.p8`-Schlüssel). Der Web-Push-Weg bleibt für die Web-App bestehen. Nötig: APNs-Schlüssel aus dem Entwicklerkonto, Key-ID, Team-ID als Geheimnisse im Worker.
- [ ] Versionskopplung: die Versions-Query `?v=` der Web-Dateien mit der App-Version mitführen; jede Store-Version bringt die Web-Dateien gebündelt mit.
- [ ] Gummibandeffekt und Scrollen prüfen: Blätter, Streifen und Tabs sollen sich nativ anfühlen; Overscroll am Seitenrand abschalten.
- [ ] Symbolsatz und Startbild: App-Icon 1024 px, Startbild in Grundfarbe, aus `icons/icon.svg` abgeleitet.

## Phase 4: Datenquellen und Lizenzen

- [ ] Open-Meteo: für den Store entweder den API-Tarif mit Schlüssel (ab etwa 30 Euro im Monat) oder alle Wetterabfragen über den eigenen Worker mit Zwischenspeicher je Gitterpunkt und Ortszeit, damit viele Nutzer wenige Aufrufe erzeugen (Entscheidung aus Phase 1). Ein Schlüssel darf nie in der App liegen, nur im Worker.
- [ ] Nennungen prüfen: Open-Meteo, DWD (CC BY 4.0), NINA, BigDataCloud, basemap.de (dl-de/by-2-0) im Fuß und im Herkunftsblatt; eine Seite „Datenquellen und Lizenzen“ in der App.
- [ ] BigDataCloud: kostenloser Tarif mit Mengenbegrenzung; über den Worker mit Zwischenspeicher führen oder durch eine andere Ortsnamensuche ersetzen.
- [ ] DWD-Radar und Warnungen: offene Daten, aber bei hoher Nutzung über den Worker zwischenspeichern.
- [ ] Prüfen, ob die MapLibre-Lizenz (BSD) und die Schriftlizenz von Sora (SIL Open Font) in den Hinweisen stehen.

## Phase 5: Qualität vor der Einreichung

- [ ] Auf echten Geräten testen: ein älteres und ein aktuelles iPhone, bei iPad-Unterstützung ein iPad; Hoch- und Querformat.
- [ ] Zugänglichkeit: VoiceOver-Durchlauf (siehe `docs/verbesserungen.md`), „Größerer Text“, reduzierte Bewegung, Kontrastprüfung aus den Tests.
- [ ] Ohne Netz starten, mit schlechtem Netz laden, Ortsabfrage ablehnen, Push ablehnen: jede Situation zeigt eine Meldung und keinen leeren Bildschirm.
- [ ] Akku und Daten: kein Dauerpolling, Aktualisierung nur beim Öffnen und auf Wunsch.
- [ ] TestFlight: Build hochladen, interne Tester (bis 100, über App Store Connect) und externe Tester (mit kurzer Prüfung durch Apple) einladen; die Freundesrunde aus Phase 0 wechselt hierher.
- [ ] Rückmeldungen aus TestFlight einarbeiten, Versionsnummer hochzählen.

## Phase 6: Store-Eintrag

- [ ] Screenshots je Gerätegröße (6,7 Zoll und 6,1 Zoll, bei iPad zusätzlich 12,9 Zoll): Hero, Stunden mit Ansichten, Kacheln mit Feld, 14 Tage, Radar, Einstellungen; am besten Tag und Nacht.
- [ ] Beschreibung, Untertitel, Schlagwörter auf Deutsch; Hinweis auf die Datenquellen und darauf, dass der Regen-Alarm optional ist.
- [ ] Datenschutzangaben in App Store Connect: Standort (zur Funktion, nicht verknüpft, kein Tracking); Kontaktdaten keine; Nutzungsdaten keine.
- [ ] Altersfreigabe 4+, Kategorie Wetter, Preis kostenlos, Länder (Deutschland, Österreich, Schweiz, Italien wegen Lignano oder weltweit).
- [ ] Support-URL, Datenschutz-URL, optional Marketing-URL.
- [ ] Hinweise für die Prüfung: wie Standort und Regen-Alarm zu testen sind, dass die Daten von Open-Meteo und DWD stammen, dass die App offline mit gespeicherten Daten startet.

## Phase 7: Einreichung und danach

- [ ] In Xcode archivieren, hochladen, Build in App Store Connect auswählen, einreichen; Freigabe manuell, damit du den Zeitpunkt bestimmst.
- [ ] Typische Ablehnungsgründe vorab prüfen: 4.2 zu wenig Funktion (hier gering, die App ist mehr als eine Website), 5.1.1 Datenschutzangaben vollständig, 2.1 keine Abstürze, 2.3 Screenshots zeigen die echte App, 4.1 Name und Symbol nicht an Apple angelehnt.
- [ ] Nach der Freigabe: Store-Link an die Tester, Web-App bleibt parallel erreichbar.
- [ ] Aktualisierungen: jede Änderung an den Web-Dateien braucht einen neuen Build und eine neue Prüfung; kleine Textkorrekturen sammeln, Releases in Abständen planen.
- [ ] Kosten im Blick: 99 Dollar Apple im Jahr, gegebenenfalls Open-Meteo-Tarif, Cloudflare bleibt im freien Tarif.

## Was offen bleibt oder später entschieden wird

- [ ] Android: dieselbe Hülle läuft mit Capacitor auch dort; Google-Play-Konto einmalig 25 Dollar. Nicht Teil dieser Runde.
- [ ] Widgets und Live-Aktivitäten: nur nativ möglich, nicht als Webinhalt; eigenes Projekt, falls gewünscht.
