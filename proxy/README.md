# NINA-Proxy (Cloudflare Worker)

Kleiner Worker, der die Warn-API des Bundes (warnung.bund.de) für die Web-App
erreichbar macht. Die API sendet keine CORS-Header, deshalb geht der Aufruf
über diesen Worker; er cacht Antworten zwei Minuten, bereinigt das HTML
der Meldungen und lässt zurückgezogene (Cancel) und abgelaufene Meldungen weg.

```
GET https://wetter-nina-proxy.<konto>.workers.dev/nina?lat=48.137&lon=11.575
GET https://wetter-nina-proxy.<konto>.workers.dev/nina/091620000000
```

Die App ruft die erste Form mit den Koordinaten des Orts auf. Der Worker ermittelt daraus
den Kreis über den WFS des BKG (`vg250:vg250_krs`, Verwaltungsgebiete 1:250 000) und cacht die
Zuordnung einen Tag. Die zweite Form nimmt den 12-stelligen Amtlichen Regionalschlüssel des
Kreises direkt entgegen. Außerhalb Deutschlands (47 bis 56 N, 5 bis 16 O) kommt eine leere Liste.

## Werkzeuge und Geheimnisse

Alles läuft über `npx wrangler` (Cloudflare-CLI; nicht in package.json deklariert, npx lädt es bei
Bedarf). Geheimnisse liegen im Konto (`npx wrangler secret put <NAME>`) und für `npx wrangler dev`
lokal in `proxy/.dev.vars`, einer Datei mit einer Zeile je Wert, die nicht im Git liegt (.gitignore):

```
VAPID_PRIVATE_KEY=<privater VAPID-Schlüssel, base64url>
FEEDBACK_TOKEN=<beliebiges langes Geheimnis für das Lesen der Rückmeldungen>
```

`proxy/feedback.sh` liest `FEEDBACK_TOKEN` aus dieser Datei. Öffentliche Werte (VAPID_PUBLIC_KEY,
VAPID_SUBJECT, KV-IDs) stehen in `wrangler.toml`.

## Deployen

Einmalig anmelden, danach reicht `deploy`:

```bash
cd proxy
npx wrangler login
npx wrangler deploy
```

Die URL aus der Ausgabe gehört in `wetter-core.js` (`NINA_PROXY`).
Lokal testen mit `npx wrangler dev` (läuft auf http://localhost:8787).

Erlaubte Aufrufer stehen in `ALLOWED_ORIGINS` in `src/worker.js`: Anfragen mit einem anderen
Origin-Header bekommen 403, Anfragen ohne Origin (curl, `feedback.sh`) gehen durch. Die Routen
`/nina`, `/push/*` und `POST /feedback` sind bewusst ohne Anmeldung erreichbar, die App hat kein
Geheimnis; stattdessen begrenzt der Worker subscribe, test und feedback je IP-Adresse, nimmt nur
Push-Endpunkte bekannter Dienste (Apple, Google, Mozilla, Microsoft) an und deckelt die Größe.

## Regen-Alarm (Web Push)

Der Worker nimmt Push-Abonnements der App entgegen und prüft alle 15 Minuten die
15-Minuten-Vorhersage von Open-Meteo je Abonnement. Beginnt in der nächsten Stunde Regen
(mindestens 0,1 mm in einer Viertelstunde, jetzt trocken), schickt er eine Nachricht; danach
gilt eine Sperrfrist von drei Stunden. Verschlüsselung und VAPID stehen in `src/webpush.js`,
ohne Bibliothek, mit WebCrypto. Kostenlos im freien Tarif (Cron, KV, wenige Anfragen).

```
POST /push/subscribe     { subscription, lat, lon, name }   Abonnement anlegen oder aktualisieren
POST /push/unsubscribe   { endpoint }                        Abonnement löschen
POST /push/test          { endpoint }                        Probenachricht sofort senden (alle fünf Minuten)
```

Probenachricht: in der App unter Einstellungen, Regen-Alarm, „Probenachricht senden“. Die App
schickt ihren Endpunkt, der Worker verschlüsselt eine Testmeldung und liefert sie über den
Push-Dienst aus; innerhalb weniger Sekunden erscheint sie als Mitteilung.

Einrichten (einmalig):

```bash
cd proxy
npx wrangler kv namespace create SUBS          # ID in wrangler.toml eintragen
npx wrangler secret put VAPID_PRIVATE_KEY      # Wert aus .dev.vars (nicht committen)
npx wrangler deploy
```

Der öffentliche VAPID-Schlüssel steht in `wrangler.toml` und in `wetter-core.js`
(`PUSH_PUBLIC_KEY`); beide müssen zusammenpassen, und `VAPID_SUBJECT` (mailto-Adresse des
Betreibers) muss gesetzt sein, sonst verweigert der Worker den Versand mit einer Fehlermeldung.
Ein neues Schlüsselpaar erzeugt Node mit WebCrypto, ohne Zusatzpaket:

```bash
node -e '
const { subtle } = require("crypto").webcrypto;
const b64 = b => Buffer.from(b).toString("base64url");
subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]).then(async k => {
  console.log("VAPID_PUBLIC_KEY=" + b64(await subtle.exportKey("raw", k.publicKey)));
  console.log("VAPID_PRIVATE_KEY=" + (await subtle.exportKey("jwk", k.privateKey)).d);
});'
```

Die erste Zeile gehört in `wrangler.toml` und `wetter-core.js`, die zweite in `.dev.vars` und per
`npx wrangler secret put VAPID_PRIVATE_KEY` ins Konto. Nach einem Schlüsselwechsel müssen alle
Nutzer den Regen-Alarm aus- und wieder einschalten.

Prüfen: `node tests/smoke-push.js` läuft Verschlüsselung, VAPID, Alarmregel und Routen
mit einem KV-Stub durch, ohne Netz.

## Rückmeldungen der Tester

Die App schickt Rückmeldungen (Fehler, Idee, Lob) an `POST /feedback`: Text, Art, optionales Kürzel,
eine zufällige Installations-Kennung und Gerätedaten (Version, Browserkennung, Breite, Schriftfaktor,
Homescreen-App, Ansicht, letzter Fehlertext). Kein Ort, keine IP-Adresse. Ablage im KV-Namespace
`FEEDBACK`, Verfall nach 90 Tagen, je Kennung höchstens fünf Einträge pro Stunde.

Lesen und Markieren nur mit dem Geheimnis `FEEDBACK_TOKEN` (`npx wrangler secret put FEEDBACK_TOKEN`,
lokal in `.dev.vars`): `GET /feedback` liefert ungelesene Einträge (`?all=1` alle),
`POST /feedback/ack` mit `{ "ids": [...] }` markiert sie als gelesen. Bequem per `proxy/feedback.sh`,
`proxy/feedback.sh all` und `proxy/feedback.sh ack <id> …`. Frisch gesendete Einträge erscheinen in der
Liste erst nach bis zu einer Minute (KV-Speicher ist erst dann überall sichtbar).
