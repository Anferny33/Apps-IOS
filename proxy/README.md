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
