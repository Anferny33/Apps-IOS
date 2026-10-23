# Restliste – Spezifikation (eigenständig umgesetzt)

Stand: 9. Oktober 2026. Der User war nicht am Rechner; alle noch offenen Punkte der Checkliste
wurden in einem Durchgang umgesetzt, ohne Commit. Je Punkt die getroffenen Entscheidungen.

## 1. Herkunftsblatt: Läufe der Vergleichsmodelle, Highlights erklärt

- `fetchModelMeta` holt die Metadaten von fünf Modellen (ICON-D2, ICON-EU, ECMWF IFS, UKMO, GFS)
  parallel; fehlende Modelle fallen still weg. Das Blatt nennt die Läufe der Vergleichsmodelle in
  einem Satz, ICON-D2 behält seine Hauptzeile.
- Neuer Abschnitt „Nächste Tage“ mit den Regeln und Schwellen; das Feld „Nächste Tage“ endet mit
  „Woher kommt das?“ und springt dorthin.

## 2. Text in SVG-Grafiken folgt der Systemschrift

Kompass, Sonnenbogen und Modellkurven haben rem-Größen (auf die Grafikskalierung umgerechnet, damit
bei Standardgröße nichts anders aussieht). Sie wachsen mit „Größerer Text“ und zusätzlich mit der
Grafik.

## 3. Zwei Spalten ab 760 px

Heute- und Tage-Abschnitt laufen in zwei Spalten (Mehrspaltensatz, Felder bleiben ganz, Reihenfolge
wie am Telefon), die Kacheln in vier Spalten, Seitenbreite 1080 px. Blätter und Tab-Leiste behalten
ihre Breite. Umsortierte Felder (Startseite anpassen) werden im DOM umgehängt, damit die Reihenfolge
auch in den Spalten gilt.

## 4. Bewegungssystem

- Eine Kurve (`--ease`) und drei Dauerstufen (`--d-fast` 0,3 s für Wechsel, `--d-base` 0,55 s
  für Einblenden, `--d-slow` 0,9 s für Wachsen und Zeichnen) ersetzen 52 lose Angaben.
- Startchoreografie gestaucht: alle Verzögerungen laufen mit Faktor 0,6, das letzte Feld ist nach
  gut einer Sekunde da (vorher über zwei).
- Kein Neustart der Animationen beim Antippen von Kacheln und Feldern; Bewegung nur bei neuen
  Daten, beim Aufklappen und beim Einheitenwechsel (dann mit frischer Choreografie).
- Einstellung „Bewegung reduziert“ (Klasse `reduce` am Wurzelelement) wirkt wie die Systemeinstellung.

## 5. Einstellungen

Drittes Blatt, Zahnrad in der Kopfzeile (der Ortsknopf lässt drei Knöpfen Platz). Chip-Gruppen,
jede Wahl wird sofort gespeichert (`wetter:settings`) und angewandt:

- Einheiten: Temperatur °C/°F, Wind km/h, m/s, kn, Bft. Intern bleibt alles in °C und km/h, die
  Anzeige rechnet um (`tmp`, `tdiff`, `wnd`, `wunit`): Hero, Chips, Stunden, Tage, Kacheln, Felder,
  Antworten, Highlights, Sätze für Vorleser, Herkunftsblatt. Statische Regeltexte im Herkunftsblatt
  bleiben in °C und km/h.
- Beim Start: zuletzt gewählte Ansicht oder eine feste.
- Bewegung: wie das System oder reduziert.
- Rausgehen: Regen streng/normal/locker (±10 Punkte Risiko), Kälte empfindlich/normal/robust
  (±2° untere Wohlfühltemperatur). Wirkt auf Fenster und Herkunftsblatt.
- Startseite, Reise, Regen-Alarm, Tagesfilm: siehe unten.

## 6. Startseite anpassen

Felder der Heute-Seite (Hinweis, Ansichten, Nächste Stunden, Rausgehen, Nächste Tage, Regen in
4 Stunden) lassen sich mit Pfeilen umsortieren und ausblenden; Kacheln (UV, Wind, Regen, Sonne,
Luftfeuchte, Luftdruck, Luftqualität, Pollen oder Sicht) ausblenden. Reihenfolge und Liste liegen in
den Einstellungen, Ausblenden über die Klasse `user-hidden` (unabhängig vom datengetriebenen
`hidden`). Ein ausgeblendetes Instrument-Feld schließt sich mit seiner Kachel.

## 7. Reise-Ort

Reiseziel über die Ortssuche (Reise-Modus), Zeitraum per Datumsfeldern. Feld „Reise“ auf der
Heute-Seite: vorher „In 5 Tagen geht es los“ mit Knopf „Wetter in Lignano ansehen“, unterwegs
„noch 6 Tage“ mit „Zurück zu meinem Standort“. Läuft die Reise, wechselt die App beim ersten Start
des Tages in die Reisevorhersage (`tripSwitched`). Nach dem Ende verschwindet die Reise.

## 8. Verlaufssicht

„Verlauf 48 h“ im Kopf des Stundenfelds klappt ein Meteogramm auf: Wolkenband (Deckung als
Dichte), Temperaturlinie mit Höchst- und Tiefstwert, Windpfeile alle drei Stunden (Pfeil zeigt,
wohin es weht), Regenbalken, Stundenachse mit Tagesgrenzen. Beschreibender Satz für Vorleser.

## 9. Regenradar ohne Seitenwechsel

Der Radar-Tab öffnet ein Blatt mit der eingebetteten Radarseite (`radar.html?embed=1`, ohne
Kopfzeile und Tab-Leiste); Scrollposition und Zeitreise der Startseite bleiben. „Vollbild“ führt
weiter zur eigenen Seite. Blitzortung entfällt: es gibt keine freie amtliche Quelle, die ohne
Anbindung an einen Dienst nutzbar wäre.

## 10. Regen-Alarm per Push

- App: Abschnitt in den Einstellungen; auf dem iPhone nur als Homescreen-App möglich (Hinweis).
  Einschalten fragt die Erlaubnis ab, abonniert beim Service Worker mit dem öffentlichen
  VAPID-Schlüssel und meldet Abonnement und Ort an den Worker; Ortswechsel werden nachgezogen.
- Service Worker zeigt die Nachricht; ein Tipp holt die App nach vorn.
- Worker (`proxy/`): Routen `/push/subscribe` und `/push/unsubscribe` (KV `SUBS`), Cron alle
  15 Minuten: 15-Minuten-Vorhersage je Abonnement, Alarm bei Regen in der nächsten Stunde
  (mindestens 0,1 mm, jetzt trocken), Sperrfrist drei Stunden, verschwundene Abonnements werden
  gelöscht. Web Push (RFC 8291) und VAPID (RFC 8292) ohne Bibliothek mit WebCrypto.
- Schlüsselpaar erzeugt; öffentlicher Schlüssel in App und `wrangler.toml`, privater Schlüssel in
  `proxy/.dev.vars` (nicht im Git). Deployment und KV-Namespace stehen aus (Konto des Users).

## 11. Tagesfilm

Zehn Sekunden auf einer Zeichenfläche 1080 × 1920: Titel mit Ort und Datum, Sonnenbogen mit
Sonnenstand, Temperaturkurve des Tages, große Zahl zählt hoch, Regenbalken, Abschluss mit Hoch und
Tief und dem wichtigsten Highlight. Farben aus der aktuellen Palette. Begrüßung einmal am Tag beim
ersten Laden (nicht bei reduzierter Bewegung), „Jetzt abspielen“ in den Einstellungen. „Als Video
teilen“ nimmt den Film auf dem Gerät auf (Safari MP4, sonst WebM) und gibt ihn ans Teilen-Blatt,
ohne Dienste.

## Nicht umgesetzt

- Füllungen im Stundenstreifen kräftiger: ein Kontrast von 3:1 zum Grund verlangt dunkle Füllungen,
  auf denen die grünen und blauen Stundentexte ihren Kontrast verlieren. Bleibt eine Designfrage.
- VoiceOver-Durchlauf auf einem echten iPhone: nur mit Gerät möglich.
