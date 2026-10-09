# NINA-Proxy (Cloudflare Worker)

Kleiner Worker, der die Warn-API des Bundes (warnung.bund.de) für die Web-App
erreichbar macht. Die API sendet keine CORS-Header, deshalb geht der Aufruf
über diesen Worker; er cacht Antworten zwei Minuten und bereinigt das HTML
der Meldungen.

```
GET https://wetter-nina-proxy.<konto>.workers.dev/nina/091620000000
```

Der Pfad enthält den 12-stelligen Amtlichen Regionalschlüssel des Kreises.
Die App ermittelt ihn aus den GPS-Koordinaten über den DWD-Kreislayer
(`dwd:Warngebiete_Kreise`, WARNCELLID → Kreisschlüssel).

## Deployen

Einmalig anmelden, danach reicht `deploy`:

```bash
cd proxy
npx wrangler login
npx wrangler deploy
```

Die URL aus der Ausgabe gehört in `wetter-core.js` (`NINA_PROXY`).
Lokal testen mit `npx wrangler dev` (läuft auf http://localhost:8787).

Erlaubte Aufrufer stehen in `ALLOWED_ORIGINS` in `src/worker.js`.

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
(`PUSH_PUBLIC_KEY`); beide müssen zusammenpassen. Ein neues Schlüsselpaar erzeugt
`node -e` mit WebCrypto (siehe Spezifikation `docs/superpowers/specs/2026-10-09-restliste-design.md`).

Prüfen: `node tests/smoke-push.js` läuft Verschlüsselung, VAPID, Alarmregel und Routen
mit einem KV-Stub durch, ohne Netz.
