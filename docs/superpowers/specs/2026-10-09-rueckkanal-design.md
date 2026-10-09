# Rückkanal für Tester – Spezifikation

Stand: 9. Oktober 2026. Entscheidungen des Users vom selben Tag, alle elf Vorschläge angenommen.

## Ziel

Testerinnen und Tester schicken Fehler, Ideen und Lob aus der App an den eigenen Cloudflare-Worker,
ohne Konto und ohne Dienst. Claude holt die Einträge auf Zuruf, bewertet sie und trägt Vorschläge in
`docs/verbesserungen.md` ein; umgesetzt wird nach Freigabe je Punkt.

## App

- Einstieg: Link „Rückmeldung“ in der Fußzeile und Abschnitt „Rückmeldung“ in den Einstellungen,
  beide öffnen dasselbe Blatt (`#fb`, Klasse `fb-open`, über den Einstellungen).
- Felder: drei Chips „Fehler, Idee, Lob“ (Idee vorgewählt), Textfeld (Pflicht, mindestens drei
  Zeichen, höchstens 2.000), Name oder Kürzel (optional, höchstens 40 Zeichen, wird gemerkt).
- Mitgeschickt: Versions-Query, Browserkennung (gekürzt), Bildschirmbreite, Schriftfaktor,
  Homescreen-App ja/nein, aktuelle Ansicht, letzter Fehlertext der App, Zeitstempel. Kein Ort,
  keine Koordinaten.
- Installations-Kennung: 16 Zeichen, zufällig, in `wetter:feedback` neben Name und Warteschlange.
- Antworten des Workers: 200 „Danke, angekommen.“, 429 „Höchstens fünf Rückmeldungen pro Stunde,
  bitte später noch einmal.“ (Text bleibt stehen), Netzfehler: Eintrag in die Warteschlange,
  „Kein Netz. Die Rückmeldung ist gespeichert und wird beim nächsten Start gesendet.“ Beim Start
  wird die Warteschlange nachgeschickt.
- Hinweis im Blatt: was mitgeschickt wird, Ablage beim Cloudflare-Worker, Löschung nach 90 Tagen.
- Screenshots: nicht vorgesehen.

## Worker

- `POST /feedback` (CORS wie die Push-Routen): Prüfung und Kürzung der Felder, unbekannte Art wird
  „idee“, Metadaten nur aus der Liste erlaubter Schlüssel. Je Kennung höchstens fünf Einträge pro
  Stunde (`fbrate:<Kennung>`, Zähler mit Ablauf 3.600 s), sonst 429. Ablage unter
  `fb:<Millisekunden, 13-stellig>-<Zufall>` mit `expirationTtl` 90 Tage, Felder `id`, `at`,
  `kind`, `text`, `name`, `install` (erste acht Zeichen der Kennung), `meta`, `read`, `exp`.
- `GET /feedback` mit `Authorization: Bearer <FEEDBACK_TOKEN>`: ungelesene Einträge in Zeitfolge,
  `?all=1` alle. Ohne oder mit falschem Geheimnis 401.
- `POST /feedback/ack` mit Geheimnis und `{ ids: [...] }`: setzt `read`, behält die Restfrist.
- KV-Namespace `FEEDBACK` (Binding), Geheimnis `FEEDBACK_TOKEN` (Worker-Secret, lokal in
  `proxy/.dev.vars`). Helfer `proxy/feedback.sh` für Lesen und Markieren per curl.

## Ablauf

Auf Zuruf („hol die Rückmeldungen“) liest Claude die ungelesenen Einträge, schreibt je Eintrag
Einschätzung und Vorschlag in den Abschnitt „Rückmeldungen aus der Testrunde“ der Checkliste und
markiert sie als gelesen. Eine tägliche geplante Aufgabe folgt, sobald mehrere Tester aktiv sind.
