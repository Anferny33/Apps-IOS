# Tagesfilm teilen in zwei Tipps, Endlosanimationen nur im Bild – Befund und Umsetzung

Stand: 11. Oktober 2026. Auslöser: Tester-Rückmeldung von E.K. („Der ‚Als Video teilen‘-Button
funktioniert nicht“) und die Beobachtung, dass der Seitenprozess im Simulator dauerhaft 30 bis
100 % CPU hielt. Diagnose über drei unabhängige Blickwinkel mit Skeptiker-Runde, Umsetzung mit
Tests zuerst, Gegenprüfung durch fünf Reviewer.

## Befund Tagesfilm

Das Teilen lief in `rec.onstop`, also gut zehn Sekunden nach dem Tipp. iOS verlangt für
`navigator.share` eine frische Nutzergeste (transiente Aktivierung, etwa fünf Sekunden) und weist
den Aufruf danach mit `NotAllowedError` ab; der Fehler wurde mit einem leeren `catch` verschluckt,
Status und Knopf waren vorher schon zurückgesetzt. Beim Entwickler ging es nur, weil er während
der Aufnahme den Schirm berührt hatte. Kein Unterschied der iOS-Version.

## Umsetzung Tagesfilm

- Zwei Tipps: „Video aufnehmen“ nimmt zehn Sekunden auf (`recordFilm`, `stopFilmRecording`,
  `finishFilmRecording`, Wachhund `FILM_STOP_GRACE` für ausbleibendes `onstop`); danach heißt der
  Knopf „Video teilen“ und ruft `navigator.share` synchron im Tipp auf (`shareFilmFile`).
- Zustände `blocked`, `idle`, `recording`, `ready`, `sharing` mit Knopftext, Sperre und Status.
  Kann das Gerät nicht aufnehmen, steht der Grund im Status (`filmRecordBlocker`).
- Fehler sichtbar: `filmShareError` übersetzt `NotAllowedError`, `InvalidStateError`,
  `NotSupportedError` und andere; ein weggewischtes Blatt (`AbortError`) ist kein Fehler. Der
  letzte Fehlertext wandert über `lastErrorText` in die Rückmeldung.
- Homescreen-App ohne Teilen-Blatt: Hinweis statt stillem Download; Browser-Tab lädt herunter.
- `closeFilm` räumt Aufnahme, Spuren, Timer und Datei auf; ein spätes `onstop` läuft ins Leere.
- Status als Pille, damit er die Abschlusszeile des Films nicht überlagert.

Aus der Gegenprüfung (fünf Reviewer, drei Skeptiker je Befund, neun bestätigt): kein `requestData()`
vor `stop()` und keine Zeitscheibe mehr, weil WebKit sonst das Schlusssegment verschluckt;
`start()` im `try`, `onerror` am Rekorder, Spuren werden auch bei Fehlern gestoppt; `openFilm` über
einem offenen Film (Begrüßung nach Rückkehr in den Vordergrund) setzt nichts zurück; eigene Zustände
„Video herunterladen“ (Browser-Tab ohne Teilen-Blatt) und gesperrtes „Video teilen“ mit Hinweis
(Homescreen-App); der Fokus wandert beim Sperren des Knopfs auf „Schließen“; Stücke eines alten
Rekorders werden verworfen; ein spät aufgelöstes Teilen nach dem Schließen ändert nichts mehr.
Der Rekorder-Stub der Tests liefert Daten und `onstop` asynchron wie iOS.

## Befund Animationen

Dreizehn Endlosschleifen (Sonnenstrahlen, Tropfen, Windlinien, Sterne, Schirm, Nebel, Puls am
Warnfeld, Schimmer der Platzhalter, Drehung beim Aktualisieren) liefen auch außerhalb des Bilds
und unter dem Tagesfilm weiter; der Simulator rendert sie per Software.

## Umsetzung Animationen

- Jede `infinite`-Regel bekommt `animation-play-state: var(--loop-play, running)` hinter der
  Kurzschreibweise; das Warnfeld `running, var(--loop-play, running)`, damit die Einblendung läuft.
- `.offscreen, html.bg, html.film-open { --loop-play: paused; }`. Ein IntersectionObserver
  (`initLoopGate`, Schwelle 0) setzt `offscreen` an die sieben stabilen Wrapper `#hero`,
  `#warnings`, `#insight`, `#details`, `#hourly`, `#days`, `#models`; `setBackground` setzt
  `html.bg` bei verborgener Seite; `openFilm`/`closeFilm` schalten `html.film-open`.
- `restartAnimations`, `html.reduce` und `prefers-reduced-motion` bleiben unberührt.

## Prüfung

- 24 neue Checks (Film 18, Animationen 6), alle Suiten grün.
- Simulator: Aufnahme, „Video teilen“, Teilen-Blatt mit dem MP4, Wegwischen ohne Fehlertext. Nach dem
  Umbau auf Aufnahme ohne Zeitscheibe: zwei ins Fotoalbum gesicherte Dateien, per AVFoundation gelesen,
  je 10,3 s, 29,5 fps, 1080 × 1920, 0,66 MB; das Ende fehlt nicht. CPU des Seitenprozesses: Seite oben 17 bis 31 %, Kacheln mit Loops im Bild etwa 32 %,
  Bereich ohne Loops 0 % (vorher dort 30 bis 100 %).
- Offen: Gerätecheck auf dem echten iPhone (nach der Aufnahme länger als fünf Sekunden warten,
  dann „Video teilen“ tippen) und Rückmeldung an E.K.
