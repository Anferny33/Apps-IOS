# Tag/Nacht-Schalter und Offline-Hülle – Spezifikation

Stand: 8. Oktober 2026. Betrifft `index.html`, `radar.html`, `design.js`, `radar.js`, `sonne.js`, `modern.css`, neu `sw.js`.

## Tag/Nacht-Schalter statt Design-Umschalter

- Der Paletten-Knopf oben rechts, der auf das klassische Glas-Design schaltete, wird zum Tag/Nacht-Schalter. Das klassische Design fällt damit vollständig weg: `design.css`, die Umschaltlogik, der Fußzeilen-Link „Design wechseln“, der Design-Schleier, der Himmel mit Lichtflecken und Partikeln, die Kartenpalette des Radars für das Glas-Design.
- Der Knopf zeigt den aktuellen Zustand als Symbol (Sonne am Tag, Mond in der Nacht) und ist ein Schalter mit `aria-pressed` und der Beschriftung „Nachtmodus“. Ein Tipp wechselt die Palette sofort mit dem vorhandenen Überblenden, auf beiden Seiten gleich.
- Die Handwahl gilt, bis der Sonnenstand am Ort das nächste Mal wechselt. Dann greift wieder die Automatik. Gespeichert wird unter `wetter:nightmode` die Wahl und der automatische Zustand zum Zeitpunkt des Tippens; weicht der automatische Zustand später davon ab, wird die Handwahl verworfen.
- Nachts gewählter Tagmodus und tags gewählter Nachtmodus wechseln die Kacheln genauso wie die Automatik (UV morgen, Zähler ohne Neustart, offenes Feld bleibt offen).

## Offline-Hülle

- Ein Service Worker `sw.js` hält die Hülle der App vor: Startseite, Radarseite, Manifest, Stylesheet, Skripte mit ihrer Versions-Query, Icons. Seine Versionskonstante entspricht der Versions-Query der Seiten und wird mit ihr erhöht; alte Caches werden beim Aktivieren gelöscht, der neue Worker übernimmt sofort.
- Eigene Dateien: Netz zuerst, bei Erfolg in den Cache, bei Fehler aus dem Cache. Seitenaufrufe ohne Treffer fallen auf die gespeicherte Startseite beziehungsweise Radarseite zurück.
- Schriften (Google Fonts) und die Kartenbibliothek (unpkg): aus dem Cache, im Hintergrund erneuert.
- Wetterdaten, Warnungen, Ortssuche, Radarbilder und Kartenkacheln laufen unverändert über das Netz; die App hat dafür ihren eigenen Datencache mit Zeitstempel.
- Ohne Netz startet die Homescreen-App damit mit dem gespeicherten Datenstand und der bestehenden Kennzeichnung („Stand … · gespeicherte Daten“, Banner).

## Tests

- Schalter: Tipp setzt Nacht samt Kacheln und Speicher, zweiter Tipp Tag; Handwahl fällt beim nächsten automatischen Wechsel; Knopf zeigt Symbol und Zustand; Radar schaltet ebenso.
- Kein Rest des klassischen Designs in Seiten, Stylesheet, Skripten und Tests.
- Service Worker: Hülle wird beim Installieren vorgehalten, Version stimmt mit den Seiten überein, alte Caches verschwinden, Netz-zuerst mit Cache-Rückfall, Navigations-Rückfall, Durchreichen der Datenquellen, Cache-zuerst für Schriften, keine Behandlung anderer Methoden.
