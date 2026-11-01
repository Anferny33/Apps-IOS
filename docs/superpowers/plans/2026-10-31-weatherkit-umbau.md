# WeatherKit-Umbau – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Vorhersage von Goldstunde kommt aus WeatherKit statt aus Open-Meteo; die App und der Worker rufen danach keine Open-Meteo-Adresse mehr auf.

**Architecture:** Der Cloudflare Worker bekommt eine Route `/wk`, die mit einem ES256-Token bei WeatherKit anfragt, die Zone des Orts mit `tz-lookup` bestimmt, zehn Minuten je Gitterpunkt cacht und die Antwort als `{timezone, data}` durchreicht. In `wetter-core.js` übersetzt ein Adapter `wkToForecast(wk, tz)` die Antwort in genau die Struktur, die `design.js` heute von Open-Meteo bekommt (Ortszeit-Strings, Prozentwerte, WMO-Codes), so dass die Darstellung fast unverändert bleibt. Modellvergleich, Luftqualität und Pollen entfallen, Sonnenscheindauer und Regenstunden werden durch echte Werte ersetzt oder weggelassen.

**Tech Stack:** Vanilla JS ohne Build (App), Cloudflare Worker (ESM, gebündelt mit wrangler), WebCrypto (ES256), npm-Paket `tz-lookup`, Node-Smoke-Tests (`node tests/run.js`).

**Spec:** `docs/superpowers/specs/2026-10-30-weatherkit-umbau-design.md`. Entscheidungen aus der Spec gelten; Abweichungen stehen unten unter „Festlegungen des Plans“.

---

## Regeln für diese Umsetzung

- Vor Beginn `git fetch` und `git rebase origin/claude/lignano-weather-webapp-e346s0`.
- **Kein Commit, Push oder Deploy ohne Zuruf des Users.** Jede Aufgabe endet mit einem Commit-Vorschlag (Nachricht steht im Schritt); ausgeführt wird er erst, wenn der User „committe“ sagt. Bis dahin bleiben die Änderungen im Arbeitsbaum, die nächste Aufgabe baut darauf auf.
- Beispielort überall: Regensburg (49,01° N, 12,10° O). Kein Lignano-, Italien- oder Adria-Bezug in Code, Tests, Texten.
- Tests laufen mit `npm test` aus dem Repo-Wurzelverzeichnis (`~/Projekte/Apps-IOS`); eine einzelne Suite mit `node tests/<datei>.js`. Grün heißt: jede Suite endet mit „Alle Checks bestanden.“ und der Runner mit „Alle Suiten bestanden.“
- Gelöscht wird nichts endgültig; Dateien in den Papierkorb (`mv … ~/.Trash/`).
- Nach dem Umbau der App-Dateien (`design.js`, `wetter-core.js`, `modern.css`, `index.html`) die Versions-Query erhöhen (Task 14), nicht zwischendurch.

## Festlegungen des Plans (Abweichungen oder Präzisierungen zur Spec)

1. **Drossel für `/wk` über das Rate-Limiting-Binding von Cloudflare** (`[[unsafe.bindings]] type = "ratelimit"`, 20 Anfragen je Minute und IP), nicht über `rateLimited` in KV. Grund: KV erlaubt im freien Tarif nur 1 000 Schreibzugriffe am Tag; `rateLimited` schreibt bei jeder Anfrage, `/wk` wird aber bei jedem Start der App aufgerufen. Fehlt das Binding (alter `wrangler dev`), gibt es keine Drossel und eine Konsolenwarnung.
2. **Nowcast-Adapter als Kopie:** `wkMinutely15` steht einmal in `wetter-core.js` (App, klassisches Skript) und einmal in `proxy/src/weatherkit.js` (Worker, ESM). `tests/smoke-adapter.js` prüft beide gegen dieselbe Fixture (Spec: „Dem Umsetzer überlassen“).
3. **Regen-Alarm nennt den Beginn der Viertelstunde**, nicht ihr Ende: `rainAlert` zieht vom Zeitstempel 15 Minuten ab (wie `intervalStart` in der App). Die alte Beschriftung mit dem Intervall-Ende war eine Ungenauigkeit, die durch den Adapter sichtbar würde.
4. **Testdaten bleiben in Open-Meteo-Form:** `mockForecast()` im Harness bleibt die erwartete Adapter-Ausgabe; neu ist `toWeatherKit(fc)`, das daraus die WeatherKit-Form baut. Der `fetch`-Stub antwortet auf `/wk?` mit `{timezone, data: toWeatherKit(fc)}`. Ein Rundlauf-Test (`wkToForecast(toWeatherKit(mock)) ≙ mock`) ersetzt die Umstellung von 1 450 Testzeilen. Der Mock ändert sich minimal: Code 61 wird 63 (WeatherKit kennt keinen „leichten Regen“), `elevation`, `sunshine_duration` und `precipitation_hours` entfallen, `cloud_cover_day` und `wk` kommen hinzu.
5. **Ansicht „Licht“ in der Tagesliste** zeigt statt Sonnenstunden die Tageslichtdauer („11,9 h“, Balken = Anteil am 24-Stunden-Tag); der Hinweis heißt „UV · Tageslicht“. Der Satz zur Licht-Ansicht beginnt mit „Tageslicht 11 h 53 min“ statt „6 h Sonne heute“.
6. **Highlight „Sonnigster Tag“:** Text „Sonnig, 20 % Wolken“ (Bewölkung am Tag).
7. **Apple-Fehler:** der Worker antwortet mit Status 502 und `{error: true, reason: "WeatherKit HTTP 401"}`; `getJson` in `wetter-core.js` liest bei `!res.ok` den Grund aus dem JSON, damit das Banner ihn zeigt.
8. **Testzeit im Worker:** `env.__now` (Millisekunden) überschreibt `Date.now()` in der `/wk`-Route, wie `env.__fetch` den Netzaufruf.
9. **`tests/fixtures/weatherkit-<JJJJ-MM-TT>.json`** heißt nach dem Tag, an dem sie geholt wird; `smoke-adapter.js` nimmt die eine Datei, die auf das Muster passt.
10. **Attribution:** der Worker normalisiert Apples Antwort zu `{name, onLight, onDark}` (`onLight` = Logo für helle Flächen = Apples `logoDark@2x`, `onDark` = `logoLight@2x`; am echten Bild prüfen, Task 5). Die App holt sie einmal je Sitzung und speichert sie in der Nutzlast mit.

## Dateien

| Datei | Änderung |
|---|---|
| `proxy/package.json`, `proxy/package-lock.json` (neu) | Abhängigkeit `tz-lookup` |
| `proxy/src/weatherkit.js` (neu) | Zeit-Helfer, Token, Abfragefenster, `fetchWeatherKit`, `fetchAttribution`, `wkMinutely15`-Kopie, `gridKey` |
| `proxy/src/worker.js` | Routen `/wk`, `/wk/attribution`; Origin-Pflicht und Drossel für `/wk`; `checkRain` auf WeatherKit; `rainAlert` Beginn statt Ende |
| `proxy/wrangler.toml` | `WEATHERKIT_SERVICE_ID`, Rate-Limiting-Binding |
| `proxy/README.md` | Einrichtung WeatherKit, `/wk`, Cron-Hinweis |
| `wetter-core.js` | `WORKER_URL`, Adapter (`WK_CONDITION`, `wkCode`, `wkLocal`, `wkOffsetSeconds`, `wkMinutely15`, `wkToForecast`), `fetchForecast` auf `/wk`, `fetchAttribution`; weg: `MODELS`, `META_MODELS`, `POLLEN`, `fetchModelMeta`, `fetchEnsemble`, `fetchModels`, `fetchAir`, `aqiLevel`, `pollenLevel`; `saveCache`/`loadCache` mit `source` |
| `design.js` | `load()` mit drei Fetches plus Attribution; Modellvergleich, Luft, Pollen raus; Sonnenschein/Regenstunden raus; Herkunftsblatt; Fußzeile; Tagesliste-Knopf; `WORKER_URL` für Push und Rückmeldung |
| `index.html` | Feld Modellvergleich raus, Fußzeile mit Apple-Weather-Link |
| `modern.css` | `.wk-logo`-Regeln |
| `tests/harness.js` | `toWeatherKit`, `okFetch` mit `/wk?` und `/wk/attribution`, `IDS` ohne models, Mock-Anpassungen |
| `tests/smoke-adapter.js` (neu), `tests/run.js` | fünfte Suite |
| `tests/smoke-design.js`, `tests/smoke-push.js`, `tests/smoke-sw.js` | Umstellung |
| `tests/render-design.html`, `tests/build-design-render.js` | Modellvergleich raus |
| `tests/fixtures/weatherkit-<Datum>.json` (neu) | echte Antwort für Regensburg |
| `sw.js`, `manifest.webmanifest`, `index.html`, `radar.html`, `docs/stand.md` | Versions-Query |
| `README.md`, `docs/stand.md`, `docs/verbesserungen.md`, `docs/veroeffentlichung.md` | Doku |

---

### Task 0: Vorbereitung

- [ ] **Schritt 1: Branch aktualisieren**

```bash
cd ~/Projekte/Apps-IOS && git fetch -q && git rebase origin/claude/lignano-weather-webapp-e346s0 && git status -sb | head -2
```

Erwartet: `## claude/lignano-weather-webapp-e346s0...origin/claude/lignano-weather-webapp-e346s0`, keine Konflikte.

- [ ] **Schritt 2: Ausgangslage grün**

```bash
cd ~/Projekte/Apps-IOS && npm test 2>&1 | tail -8
```

Erwartet: vier Suiten `ok`, „Alle Suiten bestanden.“

- [ ] **Schritt 3: Entwicklerkonto-Werte vorhanden?** Prüfen, ob `proxy/.dev.vars` die Zeilen `WEATHERKIT_PRIVATE_KEY`, `WEATHERKIT_KEY_ID`, `WEATHERKIT_TEAM_ID` enthält:

```bash
grep -c "^WEATHERKIT_" ~/Projekte/Apps-IOS/proxy/.dev.vars 2>/dev/null || echo 0
```

Erwartet `3`. Steht dort `0`, Tasks 1 bis 4 trotzdem bauen (sie laufen mit einem Testschlüssel); vor Task 5 den User um die Werte bitten (Anleitung in Task 5, Schritt 1) und dort warten.

---

### Task 1: Worker-Modul `weatherkit.js` – Zeit-Helfer, Abfragefenster, Nowcast

**Files:**
- Modify: `proxy/package.json`
- Create: `proxy/src/weatherkit.js`
- Test: `tests/smoke-push.js` (neuer Block vor „// Push-Routen mit KV-Stub“)

- [x] **Schritt 1: `tz-lookup` installieren**

```bash
cd ~/Projekte/Apps-IOS/proxy && npm install tz-lookup@6 && cat package.json && ls package-lock.json
```

Erwartet: `package.json` enthält `"dependencies": { "tz-lookup": "^6.1.25" }` (Version kann abweichen), `package-lock.json` existiert, `node_modules/` liegt in `.gitignore` (schon vorhanden).

- [x] **Schritt 2: Fehlschlagende Tests schreiben**

In `tests/smoke-push.js` direkt vor der Zeile `// Push-Routen mit KV-Stub; …` einfügen:

```js
  // WeatherKit-Modul: Zonen-Helfer, Abfragefenster, Nowcast aus Minuten und Stunden
  const wk = await import(pathToFileURL(path.join(__dirname, '..', 'proxy', 'src', 'weatherkit.js')).href);
  check('WeatherKit: Ortszeit-String aus UTC, Zeitumstellung 26.10.2025 (03:00 → 02:00) und 29.03.2026 (02:00 → 03:00)',
    wk.localString(Date.parse('2026-09-25T12:15:00Z'), 'Europe/Berlin') === '2026-09-25T14:15' && wk.localString(Date.parse('2025-10-26T00:30:00Z'), 'Europe/Berlin') === '2025-10-26T02:30' && wk.localString(Date.parse('2025-10-26T01:30:00Z'), 'Europe/Berlin') === '2025-10-26T02:30' && wk.localString(Date.parse('2026-03-29T01:30:00Z'), 'Europe/Berlin') === '2026-03-29T03:30' && wk.localString(Date.parse('2026-01-05T00:00:00Z'), 'Europe/Berlin') === '2026-01-05T01:00',
    [wk.localString(Date.parse('2025-10-26T00:30:00Z'), 'Europe/Berlin'), wk.localString(Date.parse('2026-03-29T01:30:00Z'), 'Europe/Berlin')].join(' | '));
  check('WeatherKit: Zonenversatz in Sekunden (Sommer 7200, Winter 3600, Kolkata 19800) und Mitternacht als UTC-Zeitpunkt',
    wk.zoneOffsetMs(Date.parse('2026-09-25T12:15:00Z'), 'Europe/Berlin') === 7200000 && wk.zoneOffsetMs(Date.parse('2026-01-05T12:00:00Z'), 'Europe/Berlin') === 3600000 && wk.zoneOffsetMs(Date.parse('2026-01-05T12:00:00Z'), 'Asia/Kolkata') === 19800000 && wk.localMidnightUtc('2026-09-25', 'Europe/Berlin') === Date.parse('2026-09-24T22:00:00Z') && wk.localMidnightUtc('2026-01-05', 'Europe/Berlin') === Date.parse('2026-01-04T23:00:00Z') && wk.localMidnightUtc('2026-03-29', 'Europe/Berlin') === Date.parse('2026-03-28T23:00:00Z'),
    [wk.zoneOffsetMs(Date.parse('2026-01-05T12:00:00Z'), 'Asia/Kolkata'), new Date(wk.localMidnightUtc('2026-09-25', 'Europe/Berlin')).toISOString()].join(' | '));
  const q = wk.weatherKitQuery('Europe/Berlin', Date.parse('2026-09-25T12:15:00Z'));
  check('WeatherKit: Abfragefenster Stunden ab Vortag 00:00 Ortszeit für 120 h, Tage ab heute für 10 Tage, vier Datensätze, Zone',
    q.get('dataSets') === 'currentWeather,forecastHourly,forecastDaily,forecastNextHour' && q.get('timezone') === 'Europe/Berlin' && q.get('hourlyStart') === '2026-09-23T22:00:00Z' && q.get('hourlyEnd') === '2026-09-28T22:00:00Z' && q.get('dailyStart') === '2026-09-24T22:00:00Z' && q.get('dailyEnd') === '2026-10-04T22:00:00Z', q.toString());
  check('WeatherKit: Gitterpunkt auf zwei Nachkommastellen, Zone aus den Koordinaten (Regensburg)', wk.gridKey(49.0134, 12.1016) === '49.01,12.10' && wk.timezoneOf(49.01, 12.10) === 'Europe/Berlin' && wk.timezoneOf(40.71, -74.01) === 'America/New_York', wk.timezoneOf(49.01, 12.10));
  /* Nowcast: jetzt 14:20 Ortszeit (12:20Z), Minuten ab jetzt mit 1,2 mm/h von 14:45 bis 15:20, Stunde 15 mit 0,8 mm, Stunde 16 mit 0,4 mm */
  const nowWk = Date.parse('2026-09-25T12:20:00Z');
  const minutesFrom = (startMs, rainFrom, rainTo, mmh) => Array.from({ length: 60 }, (_, k) => { const t = startMs + k * 60000; return { startTime: new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z'), precipitationIntensity: t >= rainFrom && t < rainTo ? mmh : 0, precipitationChance: t >= rainFrom && t < rainTo ? 0.8 : 0 }; });
  const hoursFrom = (startMs, amounts) => amounts.map((mm, i) => ({ forecastStart: new Date(startMs + i * 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z'), precipitationAmount: mm }));
  const wkSample = { currentWeather: { asOf: '2026-09-25T12:20:00Z' }, forecastNextHour: { minutes: minutesFrom(nowWk, Date.parse('2026-09-25T12:45:00Z'), Date.parse('2026-09-25T13:20:00Z'), 1.2) }, forecastHourly: { hours: hoursFrom(Date.parse('2026-09-25T10:00:00Z'), [0, 0, 0, 0.8, 0.4, 0, 0, 0, 0]) } };
  const nc16 = wk.wkMinutely15(wkSample, 'Europe/Berlin', nowWk);
  check('WeatherKit: 16 Viertelstunden ab der laufenden, Zeitstempel = Intervall-Ende in Ortszeit, erste vier aus Minuten, Rest aus Stundenvierteln',
    nc16.time.length === 16 && nc16.time[0] === '2026-09-25T14:30' && nc16.time[15] === '2026-09-25T18:15' && nc16.precipitation.join(',') === '0,0,0.3,0.3,0.2,0.2,0.2,0.1,0.1,0.1,0.1,0,0,0,0,0' && nc16.source.slice(0, 5).join(',') === 'min,min,min,min,hour', nc16.precipitation.join(',') + ' | ' + nc16.source.join(','));
  const nc16b = wk.wkMinutely15({ currentWeather: wkSample.currentWeather, forecastHourly: wkSample.forecastHourly }, 'Europe/Berlin', nowWk);
  check('WeatherKit: ohne Minutenvorhersage kommen alle 16 aus den Stunden; ohne Stunden bleibt der Wert null', nc16b.precipitation.slice(0, 6).join(',') === '0,0,0,0.2,0.2,0.2' && nc16b.source.every(s => s === 'hour') && wk.wkMinutely15({ currentWeather: wkSample.currentWeather }, 'Europe/Berlin', nowWk).precipitation.every(v => v === null), nc16b.precipitation.join(','));
  const partial = wk.wkMinutely15({ currentWeather: wkSample.currentWeather, forecastNextHour: { minutes: minutesFrom(nowWk, nowWk, nowWk + 10 * 60000, 1.2) } }, 'Europe/Berlin', nowWk);
  check('WeatherKit: angebrochene erste Viertelstunde wird aus den vorhandenen Minuten anteilig aufgefüllt (10 Minuten mit 1,2 mm/h → 0,3 mm für 15 Minuten)', partial.precipitation[0] === 0.3 && partial.precipitation[1] === 0, partial.precipitation.slice(0, 3).join(','));
```

- [x] **Schritt 3: Tests laufen lassen, Fehlschlag sehen**

```bash
cd ~/Projekte/Apps-IOS && node tests/smoke-push.js 2>&1 | tail -3
```

Erwartet: Abbruch mit `Cannot find module …weatherkit.js` (Exit-Code 1).

- [x] **Schritt 4: Modul anlegen**

`proxy/src/weatherkit.js`:

```js
import tzlookup from "tz-lookup";
import { b64url } from "./webpush.js";

/* WeatherKit für den Worker: Zone aus den Koordinaten, Zeit-Helfer, signiertes Token,
 * Abfragefenster, Abruf mit Zehn-Minuten-Cache je Gitterpunkt, Attribution und die
 * Nowcast-Übersetzung (Kopie von wkMinutely15 in wetter-core.js; smoke-adapter.js prüft
 * beide gegen dieselbe Fixture). */

const te = new TextEncoder();
export const WK_BASE = "https://weatherkit.apple.com/api/v1/weather/de/";
export const WK_ATTRIBUTION = "https://weatherkit.apple.com/attribution/de";
export const WK_CACHE_S = 600;           /* Antworten je Gitterpunkt zehn Minuten */
export const WK_ATTR_CACHE_S = 86400;    /* Attribution einen Tag */
export const TOKEN_TTL_S = 3600, TOKEN_REUSE_S = 3000;   /* Token 60 Minuten gültig, 50 Minuten wiederverwendet */

function isNum(v) { return typeof v === "number" && isFinite(v); }

/* Zone eines Punkts (IANA-Name) */
export function timezoneOf(lat, lon) { return tzlookup(lat, lon); }

/* Gitterpunkt auf zwei Nachkommastellen (etwa 1 km): Cache-Schlüssel und Anfrage an Apple */
export function gridKey(lat, lon) { return lat.toFixed(2) + "," + lon.toFixed(2); }
export function gridRound(v) { return Math.round(v * 100) / 100; }

/* UTC-Zeitpunkt → Ortszeit-String "JJJJ-MM-TTTHH:MM" in der Zone (sv-SE liefert ISO-Reihenfolge) */
const fmtCache = {};
export function localString(ms, tz) {
    let f = fmtCache[tz];
    if (!f) f = fmtCache[tz] = new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return f.format(new Date(ms)).replace(" ", "T").slice(0, 16);
}

/* Versatz der Zone zum Zeitpunkt ms in Millisekunden (auf Minuten gerundet) */
export function zoneOffsetMs(ms, tz) {
    const minute = Math.floor(ms / 60000) * 60000;
    return Date.parse(localString(minute, tz) + ":00Z") - minute;
}

/* 00:00 Ortszeit eines Datums als UTC-Zeitpunkt; zwei Näherungen reichen auch am Umstellungstag */
export function localMidnightUtc(dateStr, tz) {
    const naive = Date.parse(dateStr + "T00:00:00Z");
    let guess = naive;
    for (let i = 0; i < 2; i++) guess = naive - zoneOffsetMs(guess, tz);
    return guess;
}

function isoZ(ms) { return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z"); }

/* Abfragefenster: Stunden ab dem Vortag 00:00 Ortszeit für 120 Stunden (hourlyWindow in design.js
   zählt ab jetzt und braucht 48 Spalten zu jeder Uhrzeit), Tage ab heute für zehn Tage. */
export function weatherKitQuery(tz, nowMs) {
    const today = localString(nowMs, tz).slice(0, 10);
    const todayUtc = localMidnightUtc(today, tz);
    const yesterday = localString(todayUtc - 43200000, tz).slice(0, 10);
    const hourlyStart = localMidnightUtc(yesterday, tz);
    return new URLSearchParams({
        dataSets: "currentWeather,forecastHourly,forecastDaily,forecastNextHour",
        timezone: tz,
        hourlyStart: isoZ(hourlyStart), hourlyEnd: isoZ(hourlyStart + 120 * 3600000),
        dailyStart: isoZ(todayUtc), dailyEnd: isoZ(todayUtc + 10 * 86400000)
    });
}

/* 16 Viertelstunden ab der laufenden: die ersten vier aus Apples Minutenvorhersage (Intensität
   mm/h je Minute geteilt durch 60, eine angebrochene Viertelstunde anteilig hochgerechnet), die
   übrigen aus den Stundenmengen geviertelt. Zeitstempel = Intervall-ENDE in Ortszeit, wie die
   App sie erwartet; source je Intervall "min", "hour" oder null. */
export function wkMinutely15(wk, tz, anchorMs) {
    const Q = 900000;
    const q0 = Math.floor(anchorMs / Q) * Q;
    const mins = wk && wk.forecastNextHour && Array.isArray(wk.forecastNextHour.minutes) ? wk.forecastNextHour.minutes : [];
    const hours = wk && wk.forecastHourly && Array.isArray(wk.forecastHourly.hours) ? wk.forecastHourly.hours : [];
    const hourMs = hours.map(function (x) { return Date.parse(x.forecastStart); });
    const minMs = mins.map(function (m) { return Date.parse(m.startTime); });
    const fromHours = function (qs) {
        for (let i = 0; i < hourMs.length; i++) {
            if (qs >= hourMs[i] && qs < hourMs[i] + 3600000) return isNum(hours[i].precipitationAmount) ? hours[i].precipitationAmount / 4 : null;
        }
        return null;
    };
    const out = { time: [], precipitation: [], source: [] };
    for (let i = 0; i < 16; i++) {
        const qs = q0 + i * Q, qe = qs + Q;
        let v = null, src = "hour";
        if (i < 4 && mins.length) {
            let sum = 0, n = 0;
            for (let k = 0; k < mins.length; k++) {
                if (minMs[k] >= qs && minMs[k] < qe && isNum(mins[k].precipitationIntensity)) { sum += mins[k].precipitationIntensity / 60; n++; }
            }
            if (n > 0) { v = sum * 15 / n; src = "min"; }
        }
        if (v === null) v = fromHours(qs);
        out.time.push(localString(qe, tz));
        out.precipitation.push(v === null ? null : Math.round(v * 100) / 100);
        out.source.push(v === null ? null : src);
    }
    return out;
}
```

- [x] **Schritt 5: Tests laufen lassen**

```bash
cd ~/Projekte/Apps-IOS && node tests/smoke-push.js 2>&1 | grep -E "WeatherKit|bestanden|fehlgeschlagen"
```

Erwartet: sieben Zeilen `ok   WeatherKit: …`, am Ende „Alle Checks bestanden.“

- [ ] **Schritt 6: Commit-Vorschlag** (nur auf Zuruf): `git add proxy/package.json proxy/package-lock.json proxy/src/weatherkit.js tests/smoke-push.js && git commit -m "Worker: WeatherKit-Helfer für Zone, Abfragefenster und Nowcast"`

---

### Task 2: Token, Abruf mit Cache, Attribution

**Files:**
- Modify: `proxy/src/weatherkit.js`
- Test: `tests/smoke-push.js` (hinter dem Block aus Task 1)

- [x] **Schritt 1: Fehlschlagende Tests schreiben**

Hinter dem Block aus Task 1 einfügen:

```js
  // Token (ES256 mit .p8 im PKCS#8-Format) und Abruf mit Cache; Testschlüssel wird zur Laufzeit erzeugt, nie eingecheckt
  const wkKeys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const p8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', wkKeys.privateKey)).toString('base64');
  const wkEnv = { WEATHERKIT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\n' + p8.replace(/(.{64})/g, '$1\n') + '\n-----END PRIVATE KEY-----\n', WEATHERKIT_KEY_ID: 'ABC123DEF4', WEATHERKIT_TEAM_ID: 'TEAM123456', WEATHERKIT_SERVICE_ID: 'de.example.goldstunde.weatherkit' };
  wk.resetTokenCache();
  const tok1 = await wk.signWeatherKitJwt(wkEnv, nowWk);
  const [th, tc, ts] = tok1.split('.');
  const jwtHeader = JSON.parse(td.decode(wp.fromB64url(th))), jwtClaims = JSON.parse(td.decode(wp.fromB64url(tc)));
  const jwtOk = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, wkKeys.publicKey, wp.fromB64url(ts), te.encode(th + '.' + tc));
  check('WeatherKit: Token mit kid, id = Team.Service, iss, sub, iat/exp (60 min) und gültiger ES256-Signatur; PEM-Kopfzeilen und Umbrüche stören nicht',
    jwtOk && jwtHeader.alg === 'ES256' && jwtHeader.kid === 'ABC123DEF4' && jwtHeader.id === 'TEAM123456.de.example.goldstunde.weatherkit' && jwtClaims.iss === 'TEAM123456' && jwtClaims.sub === 'de.example.goldstunde.weatherkit' && jwtClaims.iat === Math.floor(nowWk / 1000) && jwtClaims.exp === jwtClaims.iat + 3600, JSON.stringify([jwtHeader, jwtClaims]));
  const tok2 = await wk.signWeatherKitJwt(wkEnv, nowWk + 49 * 60000), tok3 = await wk.signWeatherKitJwt(wkEnv, nowWk + 51 * 60000);
  check('WeatherKit: Token wird 50 Minuten wiederverwendet, danach neu signiert', tok2 === tok1 && tok3 !== tok1, [tok2 === tok1, tok3 !== tok1].join(','));
  let wkErr = null;
  try { await wk.signWeatherKitJwt({ WEATHERKIT_KEY_ID: 'x' }, nowWk); } catch (e) { wkErr = e.message; }
  check('WeatherKit: ohne die vier Werte eine Fehlermeldung mit den Namen', /WEATHERKIT_PRIVATE_KEY/.test(wkErr) && /WEATHERKIT_TEAM_ID/.test(wkErr), wkErr);
  /* Cache-Stub wie caches.default: Request-URL als Schlüssel, Antworten geklont */
  const cacheStore = new Map();
  const cacheStub = { match: async r => { const hit = cacheStore.get(typeof r === 'string' ? r : r.url); return hit ? hit.clone() : undefined; }, put: async (r, res) => { cacheStore.set(typeof r === 'string' ? r : r.url, res.clone()); } };
  globalThis.caches = { default: cacheStub };
  const appleCalls = [];
  const appleFetch = async (url, init) => { appleCalls.push({ url: String(url), init }); return { ok: true, status: 200, json: async () => ({ currentWeather: { asOf: '2026-09-25T12:20:00Z' } }) }; };
  wk.resetTokenCache();
  const wr1 = await wk.fetchWeatherKit(wkEnv, 49.0134, 12.1016, { fetch: appleFetch, now: nowWk });
  const wr2 = await wk.fetchWeatherKit(wkEnv, 49.0101, 12.0990, { fetch: appleFetch, now: nowWk });
  const wr3 = await wk.fetchWeatherKit(wkEnv, 48.137, 11.575, { fetch: appleFetch, now: nowWk });
  check('WeatherKit: Abruf mit Bearer-Token, gerundeten Koordinaten, Zone und Fenster; derselbe Gitterpunkt kommt aus dem Cache, ein anderer Punkt nutzt dasselbe Token (Signatur ist zufällig, daher Header und Claims vergleichen)',
    wr1.ok && wr1.timezone === 'Europe/Berlin' && wr1.data.currentWeather.asOf === '2026-09-25T12:20:00Z' && wr2.ok && wr3.ok && appleCalls.length === 2 && appleCalls[0].url.startsWith('https://weatherkit.apple.com/api/v1/weather/de/49.01/12.1?') && appleCalls[0].url.includes('timezone=Europe%2FBerlin') && appleCalls[0].url.includes('hourlyStart=2026-09-23T22%3A00%3A00Z') && appleCalls[0].init.headers.Authorization.startsWith('Bearer ' + th + '.' + tc + '.') && appleCalls[1].init.headers.Authorization === appleCalls[0].init.headers.Authorization, appleCalls.map(c => c.url).join(' | '));
  const failFetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const wr4 = await wk.fetchWeatherKit(wkEnv, 52.52, 13.405, { fetch: failFetch, now: nowWk });
  const wr5 = await wk.fetchWeatherKit(wkEnv, 52.52, 13.405, { fetch: appleFetch, now: nowWk });
  check('WeatherKit: Apple-Fehler kommt mit Status und Grund zurück und wird nicht gecacht', wr4.ok === false && wr4.status === 401 && wr4.reason === 'WeatherKit HTTP 401' && wr5.ok === true && appleCalls.length === 3, JSON.stringify(wr4) + ' ' + appleCalls.length);
  const attrFetch = async (url) => { appleCalls.push({ url: String(url) }); return { ok: true, status: 200, json: async () => ({ serviceName: 'Apple Weather', 'logoDark@1x': 'https://weatherkit.apple.com/assets/branding/dark@1x.png', 'logoDark@2x': 'https://weatherkit.apple.com/assets/branding/dark@2x.png', 'logoLight@2x': 'https://weatherkit.apple.com/assets/branding/light@2x.png' }) }; };
  const at1 = await wk.fetchAttribution(wkEnv, { fetch: attrFetch });
  const at2 = await wk.fetchAttribution(wkEnv, { fetch: attrFetch });
  check('WeatherKit: Attribution normalisiert (Name, Logo für helle und dunkle Flächen) und einen Tag gecacht', at1.ok && at1.name === 'Apple Weather' && at1.onLight === 'https://weatherkit.apple.com/assets/branding/dark@2x.png' && at1.onDark === 'https://weatherkit.apple.com/assets/branding/light@2x.png' && at2.onLight === at1.onLight && appleCalls.filter(c => c.url.includes('/attribution/')).length === 1, JSON.stringify(at1));
  delete globalThis.caches;
```

- [x] **Schritt 2: Fehlschlag sehen**

```bash
cd ~/Projekte/Apps-IOS && node tests/smoke-push.js 2>&1 | tail -3
```

Erwartet: `TypeError: wk.resetTokenCache is not a function`.

- [x] **Schritt 3: Token, Abruf und Attribution anhängen**

Ans Ende von `proxy/src/weatherkit.js`:

```js
/* ---- Token ---- */
let tokenCache = null;   /* { value, exp } je Isolate */
export function resetTokenCache() { tokenCache = null; }

const REQUIRED = ["WEATHERKIT_PRIVATE_KEY", "WEATHERKIT_KEY_ID", "WEATHERKIT_TEAM_ID", "WEATHERKIT_SERVICE_ID"];

/* .p8-Inhalt (PEM mit oder ohne Kopfzeilen, Umbrüche egal) → DER-Bytes */
function pemToDer(pem) {
    const body = String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
    const bin = atob(body);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/* JWT ES256: Header {alg, kid, id: Team.Service}, Claims {iss, iat, exp, sub}; 50 Minuten wiederverwendet */
export async function signWeatherKitJwt(env, nowMs) {
    const missing = REQUIRED.filter(function (k) { return !env || !env[k]; });
    if (missing.length) throw new Error("WeatherKit nicht konfiguriert, es fehlt: " + missing.join(", "));
    const now = Math.floor((nowMs || Date.now()) / 1000);
    if (tokenCache && tokenCache.exp - now > TOKEN_TTL_S - TOKEN_REUSE_S) return tokenCache.value;
    const key = await crypto.subtle.importKey("pkcs8", pemToDer(env.WEATHERKIT_PRIVATE_KEY), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const header = b64url(te.encode(JSON.stringify({ alg: "ES256", kid: env.WEATHERKIT_KEY_ID, id: env.WEATHERKIT_TEAM_ID + "." + env.WEATHERKIT_SERVICE_ID })));
    const claims = b64url(te.encode(JSON.stringify({ iss: env.WEATHERKIT_TEAM_ID, iat: now, exp: now + TOKEN_TTL_S, sub: env.WEATHERKIT_SERVICE_ID })));
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(header + "." + claims)));
    tokenCache = { value: header + "." + claims + "." + b64url(sig), exp: now + TOKEN_TTL_S };
    return tokenCache.value;
}

/* ---- Abruf ---- */
function cacheOf() { return typeof caches !== "undefined" && caches.default ? caches.default : null; }

async function cached(key) {
    const cache = cacheOf();
    if (!cache) return null;
    const hit = await cache.match(key);
    return hit ? hit.json() : null;
}

function store(key, body, maxAge, ctx) {
    const cache = cacheOf();
    if (!cache) return Promise.resolve();
    const put = cache.put(key, new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=" + maxAge } }));
    if (ctx && ctx.waitUntil) { ctx.waitUntil(put); return Promise.resolve(); }
    return put;
}

/* WeatherKit-Antwort für einen Punkt: { ok, status, timezone, data } oder { ok: false, status, reason }.
   opts.fetch / opts.now für Tests, opts.ctx für waitUntil im Request-Pfad. Fehler werden nicht gecacht. */
export async function fetchWeatherKit(env, lat, lon, opts) {
    opts = opts || {};
    const f = opts.fetch || env.__fetch || fetch, now = opts.now || Date.now();
    const glat = gridRound(lat), glon = gridRound(lon);
    const tz = timezoneOf(glat, glon);
    const key = new Request("https://wk.cache.local/" + gridKey(glat, glon) + "/" + tz, { method: "GET" });
    const hit = await cached(key);
    if (hit) return hit;
    let token;
    try { token = await signWeatherKitJwt(env, now); } catch (e) { return { ok: false, status: 500, reason: e.message }; }
    const url = WK_BASE + glat + "/" + glon + "?" + weatherKitQuery(tz, now).toString();
    let res;
    try { res = await f(url, { headers: { Authorization: "Bearer " + token } }); } catch (e) { return { ok: false, status: 502, reason: "WeatherKit nicht erreichbar: " + (e && e.message ? e.message : String(e)) }; }
    if (!res.ok) return { ok: false, status: res.status, reason: "WeatherKit HTTP " + res.status };
    const out = { ok: true, status: 200, timezone: tz, data: await res.json() };
    await store(key, out, WK_CACHE_S, opts.ctx);
    return out;
}

/* Attribution (Logo und Name), einen Tag gecacht. onLight = Logo für helle Flächen (Apples logoDark),
   onDark = Logo für dunkle Flächen (logoLight). */
export async function fetchAttribution(env, opts) {
    opts = opts || {};
    const f = opts.fetch || env.__fetch || fetch;
    const key = new Request("https://wk.cache.local/attribution/de", { method: "GET" });
    const hit = await cached(key);
    if (hit) return hit;
    let res;
    try { res = await f(WK_ATTRIBUTION); } catch (e) { return { ok: false, status: 502, reason: "Attribution nicht erreichbar" }; }
    if (!res.ok) return { ok: false, status: res.status, reason: "Attribution HTTP " + res.status };
    const j = await res.json();
    const out = { ok: true, name: j.serviceName || "Apple Weather", onLight: j["logoDark@2x"] || j["logoDark@1x"] || null, onDark: j["logoLight@2x"] || j["logoLight@1x"] || null };
    await store(key, out, WK_ATTR_CACHE_S, opts.ctx);
    return out;
}
```

- [x] **Schritt 4: Tests laufen lassen**

```bash
cd ~/Projekte/Apps-IOS && node tests/smoke-push.js 2>&1 | grep -E "WeatherKit|bestanden|fehlgeschlagen"
```

Erwartet: alle `WeatherKit:`-Zeilen `ok`, „Alle Checks bestanden.“

- [ ] **Schritt 5: Commit-Vorschlag**: `git add proxy/src/weatherkit.js tests/smoke-push.js && git commit -m "Worker: WeatherKit-Token, Abruf mit Cache und Attribution"`

---

### Task 3: Routen `/wk` und `/wk/attribution` im Worker

**Files:**
- Modify: `proxy/src/worker.js` (Kopfkommentar, Import, `fetch`-Handler), `proxy/wrangler.toml`
- Test: `tests/smoke-push.js` (Block „// WeatherKit-Route“ vor „// Prüf-Lauf“)

- [ ] **Schritt 1: Fehlschlagende Tests schreiben**

Vor der Zeile `// Prüf-Lauf: Regen in 30 Minuten …` einfügen:

```js
  // WeatherKit-Route: Origin-Pflicht, Prüfung der Koordinaten, Drossel über das Binding, Durchreichen, Attribution
  globalThis.caches = { default: cacheStub };
  cacheStore.clear();
  const wkRouteCalls = [];
  Object.assign(env, wkEnv, { __now: nowWk, __fetch: async (url, init) => { wkRouteCalls.push(String(url)); return String(url).includes('/attribution/') ? attrFetch(url) : appleFetch(url, init); } });
  const w0 = await worker.default.fetch(new Request(BASE + '/wk?lat=49.0134&lon=12.1016'), env, ctx);
  const w1 = await worker.default.fetch(req('/wk?lat=49.0134&lon=12.1016', undefined, 'GET', { Origin: 'https://fremd.example' }), env, ctx);
  const w2 = await worker.default.fetch(req('/wk?lat=49.0134&lon=12.1016', undefined, 'GET'), env, ctx);
  const wj2 = await w2.json();
  check('Route /wk: ohne Origin 403 (anders als /nina), fremder Origin 403, erlaubter Origin bekommt {timezone, data} mit CORS', w0.status === 403 && w1.status === 403 && w2.status === 200 && wj2.timezone === 'Europe/Berlin' && wj2.data.currentWeather.asOf === '2026-09-25T12:20:00Z' && w2.headers.get('Access-Control-Allow-Origin') === 'https://anferny33.github.io' && wkRouteCalls.length === 1 && wkRouteCalls[0].startsWith('https://weatherkit.apple.com/api/v1/weather/de/49.01/12.1?'), w0.status + ' ' + w1.status + ' ' + w2.status + ' ' + JSON.stringify(wj2).slice(0, 80));
  const w3 = await worker.default.fetch(req('/wk?lat=91&lon=12', undefined, 'GET'), env, ctx);
  const w4 = await worker.default.fetch(req('/wk?lat=49.0134&lon=12.1016', undefined, 'POST'), env, ctx);
  const w5 = await worker.default.fetch(req('/wk?lat=49.0134&lon=12.1016', undefined, 'GET'), env, ctx);
  check('Route /wk: Koordinaten außerhalb 400, POST 405, zweiter Aufruf desselben Punkts aus dem Cache', w3.status === 400 && w4.status === 405 && w5.status === 200 && wkRouteCalls.length === 1, w3.status + ' ' + w4.status + ' ' + wkRouteCalls.length);
  env.__fetch = failFetch;
  const w6 = await worker.default.fetch(req('/wk?lat=52.52&lon=13.405', undefined, 'GET'), env, ctx);
  const wj6 = await w6.json();
  check('Route /wk: Apple-Fehler als 502 mit {error: true, reason}', w6.status === 502 && wj6.error === true && wj6.reason === 'WeatherKit HTTP 401', w6.status + ' ' + JSON.stringify(wj6));
  env.__fetch = async (url, init) => { wkRouteCalls.push(String(url)); return String(url).includes('/attribution/') ? attrFetch(url) : appleFetch(url, init); };
  env.WK_LIMIT = { limit: async () => ({ success: false }) };
  const w7 = await worker.default.fetch(req('/wk?lat=49.0134&lon=12.1016', undefined, 'GET'), env, ctx);
  check('Route /wk: Drossel über das Rate-Limiting-Binding, 429', w7.status === 429, w7.status);
  delete env.WK_LIMIT;
  const w8 = await worker.default.fetch(req('/wk/attribution', undefined, 'GET'), env, ctx);
  const wj8 = await w8.json();
  check('Route /wk/attribution: normalisierte Attribution mit CORS', w8.status === 200 && wj8.name === 'Apple Weather' && wj8.onLight.endsWith('dark@2x.png') && wj8.onDark.endsWith('light@2x.png'), JSON.stringify(wj8));
  const w9 = await worker.default.fetch(new Request(BASE + '/wk/attribution'), env, ctx);
  check('Route /wk/attribution: ebenfalls nur mit Origin', w9.status === 403, w9.status);
  delete env.__now; delete env.__fetch; delete globalThis.caches;
  REQUIRED_WK.forEach(k => { delete env[k]; });
```

Und vor `const kv = new Map();` (Beginn der Push-Routen-Tests) die Hilfsliste anlegen:

```js
  const REQUIRED_WK = ['WEATHERKIT_PRIVATE_KEY', 'WEATHERKIT_KEY_ID', 'WEATHERKIT_TEAM_ID', 'WEATHERKIT_SERVICE_ID'];
```

- [ ] **Schritt 2: Fehlschlag sehen**

```bash
cd ~/Projekte/Apps-IOS && node tests/smoke-push.js 2>&1 | grep -E "FAIL|bestanden|fehlgeschlagen"
```

Erwartet: `FAIL Route /wk: …` (404 statt 403/200) und am Ende „… Check(s) fehlgeschlagen.“

- [ ] **Schritt 3: Routen einbauen**

In `proxy/src/worker.js`:

1. Nach `import { sendWebPush } from "./webpush.js";` einfügen:

```js
import { fetchWeatherKit, fetchAttribution, wkMinutely15, zoneOffsetMs } from "./weatherkit.js";
```

2. Im Kopfkommentar nach der Zeile `*   GET /health … Lebenszeichen` ergänzen:

```
 *   GET /wk?lat=49.01&lon=12.10        WeatherKit-Vorhersage für einen Punkt als { timezone, data }; nur mit
 *                                     erlaubtem Origin-Header (ohne Origin 403), Drossel je IP über das
 *                                     Rate-Limiting-Binding WK_LIMIT, zehn Minuten Cache je Gitterpunkt
 *   GET /wk/attribution               Apple-Weather-Logo und Name (einen Tag gecacht)
```

3. Im `fetch`-Handler direkt nach der Zeile `if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });`:

```js
        if (url.pathname === "/wk" || url.pathname === "/wk/attribution") return wkRoute(url, request, env, ctx, origin, cors);
```

4. Vor `function corsHeaders(origin) {` die Route:

```js
/* WeatherKit-Routen. Strenger als /nina: ohne Origin-Header (curl, Skripte) 403, weil der
   500 000er-Topf für die App da ist. Drossel je IP über das Rate-Limiting-Binding (KV wäre im freien
   Tarif auf 1 000 Schreibzugriffe am Tag begrenzt). env.__now und env.__fetch nur für Tests. */
let wkLimitWarned = false;
async function wkLimited(env, request) {
    if (!env.WK_LIMIT || typeof env.WK_LIMIT.limit !== "function") {
        if (!wkLimitWarned) { wkLimitWarned = true; console.warn("WK_LIMIT-Binding fehlt, /wk läuft ohne Drossel"); }
        return false;
    }
    const r = await env.WK_LIMIT.limit({ key: clientIp(request) });
    return !(r && r.success);
}

async function wkRoute(url, request, env, ctx, origin, cors) {
    if (!origin) return json({ error: "Origin fehlt" }, 403, cors);
    if (request.method !== "GET") return json({ error: "Nur GET" }, 405, cors);
    if (await wkLimited(env, request)) return json({ error: "Zu viele Anfragen, bitte später erneut" }, 429, cors);
    const now = typeof env.__now === "number" ? env.__now : Date.now();
    if (url.pathname === "/wk/attribution") {
        const a = await fetchAttribution(env, { ctx: ctx });
        return a.ok ? json({ name: a.name, onLight: a.onLight, onDark: a.onDark }, 200, cors) : json({ error: true, reason: a.reason }, 502, cors);
    }
    const lat = parseFloat(url.searchParams.get("lat")), lon = parseFloat(url.searchParams.get("lon"));
    if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return json({ error: "lat (-90..90) und lon (-180..180) erwartet" }, 400, cors);
    const r = await fetchWeatherKit(env, lat, lon, { ctx: ctx, now: now });
    if (!r.ok) return json({ error: true, reason: r.reason }, 502, cors);
    return json({ timezone: r.timezone, data: r.data }, 200, Object.assign({ "Cache-Control": "public, max-age=600" }, cors));
}
```

5. In `proxy/wrangler.toml` unter `[vars]` ergänzen und den Kommentar erweitern:

```toml
WEATHERKIT_SERVICE_ID = "<Service-ID aus dem Entwicklerkonto, z. B. de.beispiel.goldstunde.weatherkit>"
# WEATHERKIT_PRIVATE_KEY, WEATHERKIT_KEY_ID, WEATHERKIT_TEAM_ID als Geheimnisse (siehe README, Abschnitt WeatherKit)

# Drossel für /wk je IP-Adresse: 20 Anfragen je Minute (Rate-Limiting-Binding, kein KV-Schreibzugriff)
[[unsafe.bindings]]
name = "WK_LIMIT"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 20, period = 60 }
```

Den Platzhalter in `WEATHERKIT_SERVICE_ID` erst in Task 5 durch den echten Wert ersetzen.

- [ ] **Schritt 4: Tests laufen lassen**

```bash
cd ~/Projekte/Apps-IOS && node tests/smoke-push.js 2>&1 | grep -E "Route|FAIL|bestanden|fehlgeschlagen"
```

Erwartet: sechs `ok   Route …`, „Alle Checks bestanden.“ Dazu `npm test` komplett grün.

- [ ] **Schritt 5: Commit-Vorschlag**: `git add proxy/src/worker.js proxy/wrangler.toml tests/smoke-push.js && git commit -m "Worker: Route /wk mit Origin-Pflicht, Drossel und Attribution"`

---

### Task 4: README des Workers

**Files:**
- Modify: `proxy/README.md`

- [ ] **Schritt 1: Abschnitt „WeatherKit“ einfügen** (vor „## Regen-Alarm (Web Push)“):

```markdown
## WeatherKit (Vorhersage)

Die Vorhersage der App kommt über `GET /wk?lat=49.01&lon=12.10` von Apple WeatherKit. Der Worker
bestimmt die Zone des Orts (`tz-lookup`), fragt Stunden ab dem Vortag für 120 Stunden und Tage ab heute
für zehn Tage ab, cacht je Gitterpunkt (zwei Nachkommastellen, etwa 1 km) zehn Minuten und antwortet
mit `{ "timezone": "Europe/Berlin", "data": <WeatherKit-Antwort unverändert> }`. `GET /wk/attribution`
liefert Logo und Namen für die Pflichtnennung. Beide Routen verlangen einen erlaubten Origin-Header;
`curl` braucht deshalb `-H "Origin: http://localhost:8000"`. Je IP sind 20 Anfragen je Minute erlaubt
(Rate-Limiting-Binding `WK_LIMIT` in `wrangler.toml`).

Vier Werte aus dem Apple Developer Program (developer.apple.com, Certificates, Identifiers & Profiles):

1. **Team-ID**: oben rechts unter dem Kontonamen, zehn Zeichen.
2. **Service-ID**: Identifiers, Plus, „Services IDs“, Kennung in umgekehrter Domain-Schreibweise
   (z. B. `de.beispiel.goldstunde.weatherkit`); nach dem Anlegen WeatherKit ankreuzen. Steht in
   `wrangler.toml` als `WEATHERKIT_SERVICE_ID`.
3. **Key-ID und .p8-Datei**: Keys, Plus, Name vergeben, WeatherKit ankreuzen, Continue, Register,
   Download. Die Datei `AuthKey_<KEY-ID>.p8` gibt es nur einmal zum Herunterladen; sicher ablegen,
   nie ins Repo.

Geheimnisse setzen (Wert ohne Zeilenumbruch, deshalb `printf '%s'`):

```bash
cd proxy
printf '%s' "$(cat ~/Pfad/AuthKey_ABC123DEF4.p8)" | npx wrangler secret put WEATHERKIT_PRIVATE_KEY
printf '%s' "ABC123DEF4" | npx wrangler secret put WEATHERKIT_KEY_ID
printf '%s' "TEAM123456" | npx wrangler secret put WEATHERKIT_TEAM_ID
```

Lokal dieselben drei Werte in `proxy/.dev.vars` (der Schlüssel in einer Zeile, Kopfzeilen dürfen
bleiben, Umbrüche durch `\n` oder ganz weglassen). Das Token (ES256, 60 Minuten) signiert der Worker
selbst und verwendet es 50 Minuten wieder. In der Mitgliedschaft sind 500 000 Abrufe im Monat
enthalten; der Verbrauch steht unter developer.apple.com, Services, WeatherKit.

Fixture für die Tests holen (echte Antwort für Regensburg, `wrangler dev` läuft auf 8787):

```bash
curl -s -H "Origin: http://localhost:8000" "http://localhost:8787/wk?lat=49.01&lon=12.10" > ../tests/fixtures/weatherkit-$(date +%F).json
```
```

- [ ] **Schritt 2: Vorhandene Sätze anpassen**

- Im Abschnitt „Werkzeuge und Geheimnisse“ den `.dev.vars`-Block um die drei WeatherKit-Zeilen ergänzen:

```
WEATHERKIT_PRIVATE_KEY=<Inhalt der .p8-Datei, eine Zeile>
WEATHERKIT_KEY_ID=<Key-ID>
WEATHERKIT_TEAM_ID=<Team-ID>
```

- Im Abschnitt „Deployen“ den Satz „Die URL aus der Ausgabe gehört in `wetter-core.js` (`NINA_PROXY`).“ ändern zu „… in `wetter-core.js` (`WORKER_URL`).“
- Im Absatz über `ALLOWED_ORIGINS` den Satz „Anfragen ohne Origin (curl, `feedback.sh`) gehen durch.“ ergänzen: „… gehen durch; Ausnahme sind `/wk` und `/wk/attribution`, die ohne Origin 403 liefern.“

- [ ] **Schritt 3: Commit-Vorschlag**: `git add proxy/README.md && git commit -m "Worker-README: WeatherKit einrichten"`

---

### Task 5: Lokaler Lauf gegen Apple, Fixture, Deploy auf Zuruf

**Voraussetzung:** die drei Geheimnisse in `proxy/.dev.vars` und die Service-ID in `wrangler.toml`. Fehlen sie, den User mit der Anleitung aus Task 4 bitten und hier warten; nichts erfinden.

**Files:**
- Create: `tests/fixtures/weatherkit-<JJJJ-MM-TT>.json`
- Modify: `proxy/wrangler.toml` (echte Service-ID)

- [ ] **Schritt 1: Werte eintragen**: Service-ID in `wrangler.toml`; `.dev.vars` prüfen:

```bash
cd ~/Projekte/Apps-IOS/proxy && grep -c "^WEATHERKIT_" .dev.vars && grep WEATHERKIT_SERVICE_ID wrangler.toml
```

Erwartet: `3` und die echte Service-ID (kein `<…>`).

- [ ] **Schritt 2: Worker lokal starten** (eigenes Terminal-Tab, bleibt offen):

```bash
cd ~/Projekte/Apps-IOS/proxy && npx wrangler dev
```

Erwartet: „Ready on http://localhost:8787“. Eine Warnung zu `unsafe.bindings` ist in Ordnung, solange der Start gelingt; bricht `wrangler dev` wegen des Bindings ab, den Block `[[unsafe.bindings]]` vorübergehend auskommentieren (dann läuft `/wk` lokal ohne Drossel) und das im Bericht nennen.

- [ ] **Schritt 3: Echte Antwort holen und prüfen**

```bash
cd ~/Projekte/Apps-IOS && mkdir -p tests/fixtures && curl -s -H "Origin: http://localhost:8000" "http://localhost:8787/wk?lat=49.01&lon=12.10" -o tests/fixtures/weatherkit-$(date +%F).json && node -e '
const f = require("fs").readdirSync("tests/fixtures").filter(n => /^weatherkit-\d{4}-\d{2}-\d{2}\.json$/.test(n));
const j = JSON.parse(require("fs").readFileSync("tests/fixtures/" + f[0], "utf8"));
const d = j.data || {};
console.log(f[0], j.timezone, "hours", d.forecastHourly && d.forecastHourly.hours.length, "days", d.forecastDaily && d.forecastDaily.days.length, "minutes", d.forecastNextHour ? d.forecastNextHour.minutes.length : "keine");
console.log("Tagesfelder:", Object.keys(d.forecastDaily.days[0]).join(","));
console.log("asOf", d.currentWeather.asOf, "readTime", d.currentWeather.metadata.readTime, "expireTime", d.currentWeather.metadata.expireTime);'
```

Erwartet: `timezone Europe/Berlin`, `hours 120`, `days 10` (liefert Apple 11 Tage, weil `dailyEnd` einschließlich zählt, in `weatherKitQuery` `dailyEnd` um eine Sekunde kürzen: `isoZ(todayUtc + 10 * 86400000 - 1000)`, und den Test in Task 1 anpassen), `minutes 60` (oder „keine“, wenn Apple gerade keine Minutenvorhersage liefert; dann später noch einmal holen, die Fixture soll Minuten enthalten). In „Tagesfelder“ nachsehen, ob `windSpeedMax` und `windGustSpeedMax` vorkommen; das Ergebnis in Task 7, Schritt 4 (`wkDaily`) berücksichtigen (der Code kennt beide Wege).

Bei 502 mit `reason: "WeatherKit HTTP 401"`: Key-ID, Team-ID, Service-ID und WeatherKit-Haken an Schlüssel und Service-ID prüfen; bei `WeatherKit HTTP 403` fehlt der Haken an der Service-ID.

- [ ] **Schritt 4: Attribution ansehen**

```bash
curl -s -H "Origin: http://localhost:8000" "http://localhost:8787/wk/attribution"
```

Beide Bild-Adressen im Browser öffnen: `onLight` muss das dunkle Logo (für helle Flächen) sein, `onDark` das helle. Stimmt es umgekehrt, in `fetchAttribution` (`proxy/src/weatherkit.js`) die beiden Zuordnungen tauschen und den Test in Task 2 anpassen.

- [ ] **Schritt 5: Deploy nur auf Zuruf.** Dem User melden: Worker läuft lokal gegen Apple, Fixture liegt vor; Vorschlag: `cd proxy && npx wrangler secret put …` (drei Werte, Befehle aus Task 4) und `npx wrangler deploy`. Ohne Deploy kann die App auf dem iPhone noch nicht auf `/wk` zugreifen; lokal auf dem Mac geht es über `window.WORKER_URL = "http://localhost:8787"` (Task 8, Schritt 6).

- [ ] **Schritt 6: Commit-Vorschlag**: `git add proxy/wrangler.toml tests/fixtures/ && git commit -m "WeatherKit: Service-ID und echte Antwort als Test-Fixture"`

---

### Task 6: Harness – `toWeatherKit`, Mock-Anpassungen, Adapter-Suite anlegen

**Files:**
- Modify: `tests/harness.js`, `tests/run.js`
- Create: `tests/smoke-adapter.js`

- [ ] **Schritt 1: Mock anpassen** in `mockForecast()` (`tests/harness.js`):

- Zeile `latitude: 48.137, longitude: 11.575, elevation: 520, utc_offset_seconds: 7200, timezone: 'Europe/Berlin',` → `latitude: 48.137, longitude: 11.575, elevation: null, utc_offset_seconds: 7200, timezone: 'Europe/Berlin', wk: { readTime: '2026-09-25T12:10:00Z', expireTime: '2026-09-25T12:20:00Z' },`
- `weather_code: hTimes.map((_, i) => (i % 7 === 0 ? 61 : 2)),` → `63` statt `61`.
- `weather_code: days.map((_, i) => [2,61,80,95,3,1,0][i % 7]),` → `[2,63,80,95,3,1,0]`.
- Zeile `precipitation_hours: …` löschen.
- Zeile `sunshine_duration: days.map(() => 21600)` löschen (und das Komma der Zeile davor anpassen).
- Hinter `daylight_duration: days.map(() => 42780),` einfügen: `cloud_cover_day: days.map((_, i) => [55, 85, 70, 90, 95, 35, 32][i % 7])` (kein Tag unter 30 %, damit der Mock keinen „Sonnigster Tag“-Kandidaten hat).

- [ ] **Schritt 2: `toWeatherKit` einbauen** (nach `mockGeocode()`):

```js
// Open-Meteo-förmige Mockdaten in die WeatherKit-Form bringen: Gegenstück zu wkToForecast in wetter-core.js.
// Ortszeit (Europe/Berlin, process.env.TZ) → UTC, Prozent → Anteile 0..1, WMO → conditionCode, is_day → daylight,
// 15-Minuten-Werte (Intervall-Ende) → Minuten ab asOf für 60 Minuten mit Intensität in mm/h.
const WMO_TO_WK = { 0: 'Clear', 1: 'MostlyClear', 2: 'PartlyCloudy', 3: 'Cloudy', 45: 'Foggy', 48: 'Foggy', 53: 'Drizzle', 56: 'FreezingDrizzle', 63: 'Rain', 65: 'HeavyRain', 66: 'FreezingRain', 71: 'Flurries', 73: 'Snow', 75: 'HeavySnow', 80: 'SunShowers', 82: 'TropicalStorm', 85: 'SunFlurries', 95: 'Thunderstorms', 96: 'Hail' };
const utcIso = local => new Date(local.length === 16 ? local + ':00' : local).toISOString().replace(/\.\d{3}Z$/, 'Z');
const localKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const frac = v => (typeof v === 'number' ? v / 100 : null);
const cond = code => WMO_TO_WK[code] || 'PartlyCloudy';
function toWeatherKit(fc) {
  const c = fc.current, h = fc.hourly, d = fc.daily, m = fc.minutely_15;
  const asOf = utcIso(c.time);
  const wk = {
    currentWeather: {
      metadata: { latitude: fc.latitude, longitude: fc.longitude, readTime: fc.wk ? fc.wk.readTime : asOf, expireTime: fc.wk ? fc.wk.expireTime : asOf },
      asOf, temperature: c.temperature_2m, temperatureApparent: c.apparent_temperature, humidity: frac(c.relative_humidity_2m), precipitationIntensity: c.precipitation,
      conditionCode: cond(c.weather_code), windSpeed: c.wind_speed_10m, windGust: c.wind_gusts_10m, windDirection: c.wind_direction_10m, pressure: c.pressure_msl, cloudCover: frac(c.cloud_cover), daylight: c.is_day === 1
    },
    forecastHourly: { hours: h.time.map((t, i) => ({
      forecastStart: utcIso(t), temperature: h.temperature_2m[i], temperatureApparent: h.apparent_temperature[i], precipitationAmount: h.precipitation[i], precipitationChance: frac(h.precipitation_probability[i]),
      conditionCode: cond(h.weather_code[i]), daylight: h.is_day[i] === 1, windSpeed: h.wind_speed_10m[i], windGust: h.wind_gusts_10m[i], windDirection: h.wind_direction_10m[i], uvIndex: h.uv_index[i],
      cloudCover: frac(h.cloud_cover[i]), cloudCoverLowAltPct: frac(h.cloud_cover_low[i]), cloudCoverHighAltPct: frac(h.cloud_cover_high[i]), visibility: h.visibility ? h.visibility[i] : null, temperatureDewPoint: h.dew_point_2m ? h.dew_point_2m[i] : null
    })) },
    forecastDaily: { days: d.time.map((t, i) => ({
      forecastStart: utcIso(t + 'T00:00'), conditionCode: cond(d.weather_code[i]), temperatureMax: d.temperature_2m_max[i], temperatureMin: d.temperature_2m_min[i], precipitationAmount: d.precipitation_sum[i], precipitationChance: frac(d.precipitation_probability_max[i]),
      maxUvIndex: d.uv_index_max[i], sunrise: utcIso(d.sunrise[i]), sunset: utcIso(d.sunset[i]), windSpeedMax: d.wind_speed_10m_max[i], windGustSpeedMax: d.wind_gusts_10m_max[i],
      daytimeForecast: { cloudCover: frac(d.cloud_cover_day ? d.cloud_cover_day[i] : null), windDirection: d.wind_direction_10m_dominant[i], windSpeed: d.wind_speed_10m_max[i] }
    })) }
  };
  if (m && Array.isArray(m.time)) {
    const start = Date.parse(asOf), minutes = [];
    for (let k = 0; k < 60; k++) {
      const ms = start + k * 60000;
      const endKey = localKey(new Date(Math.floor(ms / 900000) * 900000 + 900000));
      const idx = m.time.indexOf(endKey);
      const v = idx >= 0 && typeof m.precipitation[idx] === 'number' ? m.precipitation[idx] : 0;
      minutes.push({ startTime: utcIso(new Date(ms).toISOString()), precipitationIntensity: v * 4, precipitationChance: v > 0 ? 0.8 : 0 });
    }
    wk.forecastNextHour = { forecastStart: asOf, forecastEnd: utcIso(new Date(start + 3600000).toISOString()), minutes, summary: [] };
  }
  return wk;
}
```

Im `module.exports` am Dateiende `toWeatherKit` ergänzen.

- [ ] **Schritt 3: `okFetch` umstellen**

```js
function okFetch(data) {
  return async (url) => {
    let body;
    if (url.includes('bigdatacloud')) body = data.place || {};
    else if (url.includes('geocoding-api')) body = data.geo || { results: [] };
    else if (url.includes('maps.dwd.de')) body = data.warn;
    else if (url.includes('/nina?')) body = data.nina;
    else if (url.includes('/wk/attribution')) body = data.attr === undefined ? { name: 'Apple Weather', onLight: 'https://weatherkit.apple.com/assets/branding/dark@2x.png', onDark: 'https://weatherkit.apple.com/assets/branding/light@2x.png' } : data.attr;
    else if (url.includes('/wk?')) body = data.fc ? { timezone: 'Europe/Berlin', data: toWeatherKit(data.fc) } : null;
    else throw new Error('unbekannte Adresse im Test: ' + url);
    if (body === undefined || body === null) throw new Error('not available');
    return { ok: true, json: async () => body };
  };
}
```

Und `const IDS = ['hourly', 'models', 'updated'];` → `const IDS = ['hourly', 'updated'];`.

In `makeSandbox` die Globals um `Intl` ergänzen: `const sb = { console, URLSearchParams, Date, Math, Object, Array, JSON, Intl, …` (der Adapter braucht `Intl.DateTimeFormat`; `design.js` fängt fehlendes Intl bisher per try/catch ab und formatiert mit Intl jetzt in der Gerätezone Europe/Berlin, die der Harness setzt). Danach `node tests/smoke-design.js` laufen lassen: bleibt ein Check wegen anderer Datums-Schreibweise rot, die Erwartung auf die Intl-Schreibweise (de-DE) anpassen. `mockEnsemble`, `mockModels`, `mockAir` bleiben vorerst (Task 9 und 10 räumen sie weg).

- [ ] **Schritt 4: Suite anlegen** `tests/smoke-adapter.js`:

```js
// Adapter WeatherKit → Open-Meteo-Form: Rundlauf gegen den Mock (toWeatherKit ist das Gegenstück),
// Nowcast-Aufbau, Zeitumstellung, WMO-Zuordnung, Vortag, dazu die echte Antwort aus tests/fixtures
// (geholt über den Worker, Task 5) und der Vergleich mit der Worker-Kopie von wkMinutely15.
const H = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

function same(a, b, tol) {
  tol = tol || 1e-9;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i], tol));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return ka.join() === kb.join() && ka.every(k => same(a[k], b[k], tol)); }
  return a === b;
}
function diff(a, b, prefix) {
  prefix = prefix || '';
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    const keys = [...new Set(Object.keys(a).concat(Object.keys(b)))];
    for (const k of keys) { const d = diff(a[k], b[k], prefix + k + '.'); if (d) return d; }
    return '';
  }
  return same(a, b) ? '' : prefix + ' ' + JSON.stringify(a).slice(0, 80) + ' ≠ ' + JSON.stringify(b).slice(0, 80);
}

(async () => {
  const sb = H.makeSandbox();
  const mock = H.mockForecast();
  const out = sb.wkToForecast(H.toWeatherKit(mock), 'Europe/Berlin');

  // Rundlauf: alles außer minutely_15 (das nur 16 Intervalle hat) muss dem Mock gleichen
  const expect = JSON.parse(JSON.stringify(mock)); delete expect.minutely_15;
  const got = JSON.parse(JSON.stringify(out)); delete got.minutely_15;
  H.check('Rundlauf: wkToForecast(toWeatherKit(mock)) liefert den Mock (ohne minutely_15) zurück', same(got, expect), diff(got, expect));
  H.check('Rundlauf: Nowcast 16 Intervalle ab 14:30 (Intervall-Ende), Regen 14:45 bis 15:15 aus den Minuten, Rest aus den Stunden', out.minutely_15.time.length === 16 && out.minutely_15.time[0] === '2026-09-25T14:30' && out.minutely_15.time[15] === '2026-09-25T18:15' && out.minutely_15.precipitation.join(',') === '0,0,0.4,0.4,0,0,0,0,0,0,0,0,0,0,0,0' && out.minutely_15.source.join(',') === 'min,min,min,min,hour,hour,hour,hour,hour,hour,hour,hour,hour,hour,hour,hour', out.minutely_15.precipitation.join(',') + ' | ' + out.minutely_15.source.join(','));

  // WMO-Zuordnung: jeder Code der Tabelle, Breezy nach Bewölkung, Unbekanntes mit einmaliger Warnung
  const codes = Object.keys(vm.runInContext('WK_CONDITION', sb));   /* top-level const: nur per runInContext erreichbar */
  H.check('WMO: jeder bekannte conditionCode landet in der WMO-Tabelle', codes.length >= 28 && codes.every(c => sb.wmo(sb.wkCode(c, 0.5))[1] !== '–') && sb.wkCode('Clear') === 0 && sb.wkCode('Rain') === 63 && sb.wkCode('Thunderstorms') === 95 && sb.wkCode('Hail') === 96 && sb.wkCode('Sleet') === 66 && sb.wkCode('SunShowers') === 80, codes.join(','));
  const warned = [];
  sb.console = Object.assign({}, console, { warn: m => warned.push(m) });
  H.check('WMO: Breezy/Windy/Hot/Frigid nach Bewölkung (1, 2, 3), Unbekanntes 2 mit einer Warnung je Sitzung', sb.wkCode('Breezy', 0.1) === 1 && sb.wkCode('Windy', 0.5) === 2 && sb.wkCode('Hot', 0.9) === 3 && sb.wkCode('Frigid', null) === 2 && sb.wkCode('Neu42', 0) === 2 && sb.wkCode('Neu42', 0) === 2 && warned.length === 1 && /Neu42/.test(warned[0]), warned.join(' | '));
  sb.console = console;

  // Zeitstrings: Zeitumstellung 26.10.2025 (25-Stunden-Tag) und 29.03.2026 (23-Stunden-Tag), Versatz
  H.check('Zeit: wkLocal am Umstellungstag, Versatz zum Zeitpunkt (Sommer 7200, Winter 3600)', sb.wkLocal('2025-10-26T00:30:00Z', 'Europe/Berlin') === '2025-10-26T02:30' && sb.wkLocal('2025-10-26T01:30:00Z', 'Europe/Berlin') === '2025-10-26T02:30' && sb.wkLocal('2026-03-29T01:30:00Z', 'Europe/Berlin') === '2026-03-29T03:30' && sb.wkLocal('2026-01-05T00:00:00Z', 'Europe/Berlin') === '2026-01-05T01:00' && sb.wkOffsetSeconds('2026-09-25T12:15:23Z', 'Europe/Berlin') === 7200 && sb.wkOffsetSeconds('2026-01-05T12:00:00Z', 'Europe/Berlin') === 3600 && sb.wkLocal('kaputt', 'Europe/Berlin') === null, [sb.wkLocal('2025-10-26T01:30:00Z', 'Europe/Berlin'), sb.wkOffsetSeconds('2026-09-25T12:15:23Z', 'Europe/Berlin')].join(' | '));
  const dst = H.mockForecast();
  dst.current.time = '2025-10-26T14:15'; dst.utc_offset_seconds = 3600;
  const dstHours = []; for (let ms = Date.parse('2025-10-24T22:00:00Z'); ms < Date.parse('2025-10-27T23:00:00Z'); ms += 3600000) dstHours.push(sb.wkLocal(new Date(ms).toISOString(), 'Europe/Berlin'));
  Object.keys(dst.hourly).forEach(k => { dst.hourly[k] = k === 'time' ? dstHours : dstHours.map((_, i) => dst.hourly[k][i % 24]); });
  /* Tage wie vom Worker angefragt: ab heute; der Vortag kommt nur aus den Stunden */
  dst.daily.time = ['2025-10-26', '2025-10-27']; Object.keys(dst.daily).forEach(k => { if (k !== 'time') dst.daily[k] = dst.daily[k].slice(0, 2); });
  dst.daily.sunrise = dst.daily.time.map(t => t + 'T07:12'); dst.daily.sunset = dst.daily.time.map(t => t + 'T17:05'); dst.daily.daylight_duration = dst.daily.time.map(() => 35580);
  dst.minutely_15 = null;
  const dstOut = sb.splitPastDay(sb.wkToForecast(H.toWeatherKit(dst), 'Europe/Berlin'));
  H.check('Zeitumstellung: 25-Stunden-Tag bleibt per Datum zusammen, Vortag abgetrennt, past.daily aus den Stundenwerten', dstOut.hourly.time[0] === '2025-10-26T00:00' && dstOut.hourly.time.filter(t => t.startsWith('2025-10-26')).length === 25 && dstOut.hourly.time.filter(t => t === '2025-10-26T02:00').length === 2 && dstOut.past.hourly.time.length === 24 && dstOut.past.daily.time.length === 1 && dstOut.past.daily.time[0] === '2025-10-25' && typeof dstOut.past.daily.temperature_2m_min[0] === 'number' && dstOut.past.daily.temperature_2m_min[0] <= dstOut.past.daily.temperature_2m_max[0] && dstOut.daily.time[0] === '2025-10-26' && dstOut.daily.time.length === 2 && dstOut.utc_offset_seconds === 3600, JSON.stringify([dstOut.hourly.time.slice(0, 4), dstOut.past && dstOut.past.daily]));

  // Fehlende Teile
  let err = null; try { sb.wkToForecast({ currentWeather: {} }, 'Europe/Berlin'); } catch (e) { err = e.message; }
  const noMin = sb.wkToForecast(Object.assign({}, H.toWeatherKit(mock), { forecastNextHour: undefined }), 'Europe/Berlin');
  H.check('Fehlende Teile: ohne Stunden oder Tage „Vorhersage unvollständig“, ohne Minutenvorhersage alle 16 aus den Stunden', err === 'Vorhersage unvollständig' && noMin.minutely_15.source.every(s => s === 'hour') && noMin.minutely_15.precipitation.slice(0, 5).join(',') === '0.3,0.3,0.3,0.3,0', err + ' | ' + noMin.minutely_15.precipitation.join(','));   /* Stunde 14 hat 1,2 mm → 0,3 je Viertel */
  H.check('Felder: daylight → is_day 1/0, Anteile → Prozent, daylight_duration aus Auf- und Untergang, cloud_cover_day aus daytimeForecast, kein sunshine_duration und precipitation_hours', out.current.is_day === 1 && out.hourly.is_day[0] === 0 && out.hourly.is_day[12] === 1 && out.current.relative_humidity_2m === 71 && out.hourly.precipitation_probability[1] === 7 && out.daily.daylight_duration[0] === 42780 && out.daily.cloud_cover_day[1] === 85 && !('sunshine_duration' in out.daily) && !('precipitation_hours' in out.daily) && out.elevation === null && out.wk.readTime === '2026-09-25T12:10:00Z', JSON.stringify([out.current.is_day, out.hourly.is_day.slice(0, 13), out.daily.cloud_cover_day]));

  // Echte Antwort aus dem Worker (Task 5): Struktur, Längen, Wertebereiche, Codes
  const fixtures = fs.readdirSync(path.join(__dirname, 'fixtures')).filter(n => /^weatherkit-\d{4}-\d{2}-\d{2}\.json$/.test(n));
  H.check('Fixture: genau eine echte WeatherKit-Antwort unter tests/fixtures/weatherkit-<Datum>.json (Task 5)', fixtures.length === 1, fixtures.join(','));
  if (fixtures.length === 1) {
    const real = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', fixtures[0]), 'utf8'));
    const rf = sb.splitPastDay(sb.wkToForecast(real.data, real.timezone));
    const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
    const today = rf.current.time.slice(0, 10);
    H.check('Fixture: Zone, Ortszeit-Strings, Stunden ab heute 00:00 mit mindestens 96 Werten, Vortag mit 23 bis 25 Stunden und einem Tageswert', rf.timezone === real.timezone && TS.test(rf.current.time) && rf.hourly.time.every(t => TS.test(t)) && rf.hourly.time[0] === today + 'T00:00' && rf.hourly.time.length >= 96 && rf.past && rf.past.hourly.time.length >= 23 && rf.past.hourly.time.length <= 25 && rf.past.daily.time.length === 1 && rf.past.daily.time[0] < today && typeof rf.past.daily.temperature_2m_min[0] === 'number', JSON.stringify([rf.hourly.time[0], rf.hourly.time.length, rf.past && rf.past.hourly.time.length, rf.past && rf.past.daily]));
    H.check('Fixture: zehn Tage ab heute mit Datum, Auf- und Untergang, Tageslicht, Bewölkung am Tag, Windmaxima', rf.daily.time.length === 10 && rf.daily.time[0] === today && rf.daily.time.every(t => DATE.test(t)) && rf.daily.sunrise.every(t => TS.test(t)) && rf.daily.daylight_duration.every(v => v > 0 && v < 86400) && rf.daily.cloud_cover_day.every(v => v === null || (v >= 0 && v <= 100)) && rf.daily.wind_gusts_10m_max.every(v => typeof v === 'number') && rf.daily.wind_speed_10m_max.every(v => typeof v === 'number'), JSON.stringify([rf.daily.time, rf.daily.wind_gusts_10m_max]));
    H.check('Fixture: Prozentwerte 0..100, is_day 0/1, Wettercodes in der WMO-Tabelle, Sicht in Metern, Nowcast 16 Werte mit Intervall-Ende nach jetzt', rf.hourly.precipitation_probability.every(v => v === null || (v >= 0 && v <= 100)) && rf.hourly.cloud_cover.every(v => v === null || (v >= 0 && v <= 100)) && rf.hourly.is_day.every(v => v === 0 || v === 1) && rf.hourly.weather_code.concat(rf.daily.weather_code, [rf.current.weather_code]).every(c => sb.wmo(c)[1] !== '–') && rf.hourly.visibility.some(v => v > 1000) && rf.minutely_15.time.length === 16 && rf.minutely_15.time[0] > rf.current.time && rf.minutely_15.precipitation.filter(v => typeof v === 'number').length >= 12, JSON.stringify([rf.current.weather_code, rf.minutely_15.time[0], rf.current.time]));
    // Worker-Kopie des Nowcast-Aufbaus gegen die App-Fassung
    const wkmod = await import(pathToFileURL(path.join(__dirname, '..', 'proxy', 'src', 'weatherkit.js')).href);
    const anchor = Date.parse(real.data.currentWeather.asOf);
    const fromWorker = wkmod.wkMinutely15(real.data, real.timezone, anchor), fromApp = sb.wkMinutely15(real.data, real.timezone, anchor);
    H.check('Nowcast: Worker-Kopie und App-Fassung von wkMinutely15 liefern an der Fixture dasselbe', same(fromWorker, fromApp), diff(fromWorker, fromApp));
    const fromWorkerMock = wkmod.wkMinutely15(H.toWeatherKit(mock), 'Europe/Berlin', Date.parse('2026-09-25T12:15:00Z'));
    H.check('Nowcast: Worker-Kopie auch am Mock gleich', same(fromWorkerMock, out.minutely_15), diff(fromWorkerMock, out.minutely_15));
  }

  H.finish();
})().catch(e => { console.error(e); process.exit(1); });
```

In `tests/run.js` die Suite eintragen: nach `{ file: 'smoke-design.js', env: { DUMP: '1' } },` die Zeile `{ file: 'smoke-adapter.js' },`.

- [ ] **Schritt 5: Fehlschlag sehen**

```bash
cd ~/Projekte/Apps-IOS && node tests/smoke-adapter.js 2>&1 | tail -3
```

Erwartet: `TypeError: sb.wkToForecast is not a function`.

- [ ] **Schritt 6: Commit-Vorschlag** (zusammen mit Task 7).

---

### Task 7: Adapter in `wetter-core.js`

**Files:**
- Modify: `wetter-core.js`

- [ ] **Schritt 1: Kopfkommentar** der Datei ersetzen:

```js
/* Datenschicht der Wetter-App: API-Aufrufe, Adapter, Helfer, Cache und Standortspeicher.
 * Genutzt von index.html (design.js); die Darstellung liegt dort.
 *
 * Datenquellen (kein Schlüssel in der App):
 *   Apple WeatherKit         – Vorhersage (aktuell, Minuten, Stunden, Tage) über den eigenen Worker (/wk);
 *                              wkToForecast übersetzt die Antwort in die hier erwartete Struktur
 *   DWD GeoServer            – amtliche Warnungen der Gemeinde
 *   NINA (über den Worker)   – Meldungen des Bevölkerungsschutzes
 *   Open-Meteo Geocoding     – Ortssuche (wird in Teil 2 durch Apple Maps ersetzt)
 *   BigDataCloud             – Ortsname zur GPS-Position (ebenfalls Teil 2)
 */
```

- [ ] **Schritt 2: Tabellen** – `MODELS` und `POLLEN` samt Kommentaren löschen; den Kommentar `/* WMO-Wettercodes von Open-Meteo: Symbol und deutscher Text je Code */` ersetzen durch `/* WMO-Wettercodes: Symbol und deutscher Text je Code; Apples conditionCode wird in wkCode darauf abgebildet */`.

- [ ] **Schritt 3: Adapter einfügen** (direkt nach `function wmo(code) …`):

```js
/* ------------------------------------------------------------------ *
 * Adapter WeatherKit → Struktur der Darstellung
 * ------------------------------------------------------------------ */

/* Apples conditionCode → WMO. Breezy, Windy, Hot, Frigid tragen keine Wolkenaussage und werden
   nach der Bewölkung eingeordnet. Unbekannte Codes werden 2 (wolkig) mit einer Warnung je Sitzung. */
const WK_CONDITION = {
    Clear: 0, MostlyClear: 1, PartlyCloudy: 2, MostlyCloudy: 2, Cloudy: 3,
    Foggy: 45, Haze: 45, Smoky: 45, BlowingDust: 45,
    Drizzle: 53, FreezingDrizzle: 56, Rain: 63, HeavyRain: 65, FreezingRain: 66, Sleet: 66, WintryMix: 66,
    Flurries: 71, Snow: 73, HeavySnow: 75, BlowingSnow: 75, Blizzard: 75, Hail: 96,
    IsolatedThunderstorms: 95, ScatteredThunderstorms: 95, Thunderstorms: 95, StrongStorms: 95,
    SunShowers: 80, SunFlurries: 85, TropicalStorm: 82, Hurricane: 82
};
const WK_BY_CLOUDS = { Breezy: true, Windy: true, Hot: true, Frigid: true };
const wkWarned = {};

function wkCode(cond, cloud) {
    if (WK_CONDITION[cond] !== undefined) return WK_CONDITION[cond];
    if (WK_BY_CLOUDS[cond]) return !isNum(cloud) ? 2 : (cloud < 0.3 ? 1 : (cloud < 0.7 ? 2 : 3));
    if (cond && !wkWarned[cond]) { wkWarned[cond] = true; console.warn("Unbekannter WeatherKit-Code: " + cond); }
    return 2;
}

/* UTC-Zeit (ISO mit Z) → Ortszeit-String "JJJJ-MM-TTTHH:MM" der Zone; null bei unlesbarer Zeit */
const wkFmt = {};
function wkLocal(iso, tz) {
    if (typeof iso !== "string") return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    let f = wkFmt[tz];
    if (!f) f = wkFmt[tz] = new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return f.format(d).replace(" ", "T").slice(0, 16);
}

/* Versatz der Zone zum Zeitpunkt iso in Sekunden (auf Minuten gerundet) */
function wkOffsetSeconds(iso, tz) {
    const ms = Date.parse(iso);
    if (isNaN(ms)) return 0;
    const minute = Math.floor(ms / 60000) * 60000;
    return Math.round((Date.parse(wkLocal(new Date(minute).toISOString(), tz) + ":00Z") - minute) / 1000);
}

function wkNum(v) { return isNum(v) ? v : null; }
function wkPct(v) { return isNum(v) ? Math.round(v * 100) : null; }
function wkFlag(v) { return v === true ? 1 : (v === false ? 0 : null); }

/* 16 Viertelstunden ab der laufenden: die ersten vier aus Apples Minutenvorhersage (Intensität
   mm/h je Minute geteilt durch 60, eine angebrochene Viertelstunde anteilig hochgerechnet), die
   übrigen aus den Stundenmengen geviertelt. Zeitstempel = Intervall-ENDE in Ortszeit (intervalStart
   rechnet zurück); source je Intervall "min", "hour" oder null. Kopie in proxy/src/weatherkit.js. */
function wkMinutely15(wk, tz, anchorMs) {
    const Q = 900000;
    const q0 = Math.floor(anchorMs / Q) * Q;
    const mins = wk && wk.forecastNextHour && Array.isArray(wk.forecastNextHour.minutes) ? wk.forecastNextHour.minutes : [];
    const hours = wk && wk.forecastHourly && Array.isArray(wk.forecastHourly.hours) ? wk.forecastHourly.hours : [];
    const hourMs = hours.map(function (x) { return Date.parse(x.forecastStart); });
    const minMs = mins.map(function (m) { return Date.parse(m.startTime); });
    const fromHours = function (qs) {
        for (let i = 0; i < hourMs.length; i++) {
            if (qs >= hourMs[i] && qs < hourMs[i] + 3600000) return isNum(hours[i].precipitationAmount) ? hours[i].precipitationAmount / 4 : null;
        }
        return null;
    };
    const out = { time: [], precipitation: [], source: [] };
    for (let i = 0; i < 16; i++) {
        const qs = q0 + i * Q, qe = qs + Q;
        let v = null, src = "hour";
        if (i < 4 && mins.length) {
            let sum = 0, n = 0;
            for (let k = 0; k < mins.length; k++) {
                if (minMs[k] >= qs && minMs[k] < qe && isNum(mins[k].precipitationIntensity)) { sum += mins[k].precipitationIntensity / 60; n++; }
            }
            if (n > 0) { v = sum * 15 / n; src = "min"; }
        }
        if (v === null) v = fromHours(qs);
        out.time.push(wkLocal(new Date(qe).toISOString(), tz));
        out.precipitation.push(v === null ? null : Math.round(v * 100) / 100);
        out.source.push(v === null ? null : src);
    }
    return out;
}

function wkHourly(hours, tz) {
    const h = { time: [], temperature_2m: [], apparent_temperature: [], precipitation: [], precipitation_probability: [], weather_code: [], is_day: [], wind_speed_10m: [], wind_gusts_10m: [], wind_direction_10m: [], uv_index: [], cloud_cover: [], cloud_cover_low: [], cloud_cover_high: [], visibility: [], dew_point_2m: [] };
    hours.forEach(function (x) {
        h.time.push(wkLocal(x.forecastStart, tz));
        h.temperature_2m.push(wkNum(x.temperature));
        h.apparent_temperature.push(wkNum(x.temperatureApparent));
        h.precipitation.push(wkNum(x.precipitationAmount));
        h.precipitation_probability.push(wkPct(x.precipitationChance));
        h.weather_code.push(wkCode(x.conditionCode, x.cloudCover));
        h.is_day.push(wkFlag(x.daylight));
        h.wind_speed_10m.push(wkNum(x.windSpeed));
        h.wind_gusts_10m.push(wkNum(x.windGust));
        h.wind_direction_10m.push(wkNum(x.windDirection));
        h.uv_index.push(wkNum(x.uvIndex));
        h.cloud_cover.push(wkPct(x.cloudCover));
        h.cloud_cover_low.push(wkPct(x.cloudCoverLowAltPct));
        h.cloud_cover_high.push(wkPct(x.cloudCoverHighAltPct));
        h.visibility.push(wkNum(x.visibility));
        h.dew_point_2m.push(wkNum(x.temperatureDewPoint));
    });
    return h;
}

/* Tageswerte. Windmaxima aus windSpeedMax/windGustSpeedMax, sonst aus den Stundenwerten des Tages
   (Richtung = Richtung der stärksten Böe), sonst daytimeForecast. cloud_cover_day ersetzt die
   Sonnenscheindauer als Grundlage für „Sonnigster Tag“. */
function wkDaily(days, hourly, tz) {
    const d = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_sum: [], precipitation_probability_max: [], wind_speed_10m_max: [], wind_gusts_10m_max: [], wind_direction_10m_dominant: [], uv_index_max: [], sunrise: [], sunset: [], daylight_duration: [], cloud_cover_day: [] };
    const byDate = {};
    hourly.time.forEach(function (t, i) { const k = t ? t.slice(0, 10) : ""; (byDate[k] = byDate[k] || []).push(i); });
    days.forEach(function (x) {
        const date = (wkLocal(x.forecastStart, tz) || "").slice(0, 10);
        const dp = x.daytimeForecast || {};
        const idx = byDate[date] || [];
        let wmax = wkNum(x.windSpeedMax), gmax = wkNum(x.windGustSpeedMax), dir = wkNum(dp.windDirection);
        if (wmax === null && idx.length) { const v = idx.map(function (i) { return hourly.wind_speed_10m[i]; }).filter(isNum); if (v.length) wmax = Math.max.apply(null, v); }
        if (gmax === null && idx.length) {
            let best = -1;
            idx.forEach(function (i) { if (isNum(hourly.wind_gusts_10m[i]) && (best < 0 || hourly.wind_gusts_10m[i] > hourly.wind_gusts_10m[best])) best = i; });
            if (best >= 0) { gmax = hourly.wind_gusts_10m[best]; if (dir === null) dir = wkNum(hourly.wind_direction_10m[best]); }
        }
        if (wmax === null) wmax = wkNum(dp.windSpeed);
        const riseMs = Date.parse(x.sunrise), setMs = Date.parse(x.sunset);
        d.time.push(date);
        d.weather_code.push(wkCode(x.conditionCode, dp.cloudCover));
        d.temperature_2m_max.push(wkNum(x.temperatureMax));
        d.temperature_2m_min.push(wkNum(x.temperatureMin));
        d.precipitation_sum.push(wkNum(x.precipitationAmount));
        d.precipitation_probability_max.push(wkPct(x.precipitationChance));
        d.wind_speed_10m_max.push(wmax);
        d.wind_gusts_10m_max.push(gmax);
        d.wind_direction_10m_dominant.push(dir);
        d.uv_index_max.push(wkNum(x.maxUvIndex));
        d.sunrise.push(wkLocal(x.sunrise, tz));
        d.sunset.push(wkLocal(x.sunset, tz));
        d.daylight_duration.push(!isNaN(riseMs) && !isNaN(setMs) ? Math.round((setMs - riseMs) / 1000) : null);
        d.cloud_cover_day.push(wkPct(dp.cloudCover));
    });
    return d;
}

/* Vortag der Tageswerte aus den Stunden vor heute (Minimum, Maximum, Regensumme) als erste Zeile
   vor die Tage setzen; splitPastDay trennt sie danach als fc.past.daily ab (Frost-Highlight). */
function wkPastDaily(daily, hourly, today) {
    const idx = [];
    hourly.time.forEach(function (t, i) { if (t && t.slice(0, 10) < today) idx.push(i); });
    if (!idx.length) return;
    const vals = function (arr) { return idx.map(function (i) { return arr[i]; }).filter(isNum); };
    const temps = vals(hourly.temperature_2m), rain = vals(hourly.precipitation);
    const row = {
        time: hourly.time[idx[idx.length - 1]].slice(0, 10),
        temperature_2m_min: temps.length ? Math.min.apply(null, temps) : null,
        temperature_2m_max: temps.length ? Math.max.apply(null, temps) : null,
        precipitation_sum: rain.length ? Math.round(rain.reduce(function (a, b) { return a + b; }, 0) * 100) / 100 : null
    };
    Object.keys(daily).forEach(function (k) { daily[k].unshift(row[k] !== undefined ? row[k] : null); });
}

/* WeatherKit-Antwort → dieselben Schlüssel wie früher von Open-Meteo. Wirft „Vorhersage
   unvollständig“ ohne Stunden oder Tage; fehlende Minutenvorhersage ist erlaubt. */
function wkToForecast(wk, tz) {
    if (!wk || !wk.currentWeather || !wk.forecastHourly || !Array.isArray(wk.forecastHourly.hours) || !wk.forecastDaily || !Array.isArray(wk.forecastDaily.days)) throw new Error("Vorhersage unvollständig");
    const cw = wk.currentWeather, meta = cw.metadata || {};
    const asOf = typeof cw.asOf === "string" ? cw.asOf : new Date(coreNow()).toISOString();
    const hourly = wkHourly(wk.forecastHourly.hours, tz);
    const daily = wkDaily(wk.forecastDaily.days, hourly, tz);
    const nowLocal = wkLocal(asOf, tz);
    wkPastDaily(daily, hourly, nowLocal.slice(0, 10));
    return {
        latitude: wkNum(meta.latitude), longitude: wkNum(meta.longitude), elevation: null,
        timezone: tz, utc_offset_seconds: wkOffsetSeconds(asOf, tz),
        wk: { readTime: typeof meta.readTime === "string" ? meta.readTime : null, expireTime: typeof meta.expireTime === "string" ? meta.expireTime : null },
        current: {
            time: nowLocal, temperature_2m: wkNum(cw.temperature), apparent_temperature: wkNum(cw.temperatureApparent),
            relative_humidity_2m: wkPct(cw.humidity), precipitation: wkNum(cw.precipitationIntensity),
            weather_code: wkCode(cw.conditionCode, cw.cloudCover), wind_speed_10m: wkNum(cw.windSpeed), wind_gusts_10m: wkNum(cw.windGust),
            wind_direction_10m: wkNum(cw.windDirection), pressure_msl: wkNum(cw.pressure), cloud_cover: wkPct(cw.cloudCover), is_day: wkFlag(cw.daylight)
        },
        minutely_15: wkMinutely15(wk, tz, Date.parse(asOf)),
        hourly: hourly,
        daily: daily
    };
}
```

`coreNow` steht weiter unten in der Datei; Funktionsdeklarationen werden gehoben, das ist in Ordnung.

- [ ] **Schritt 4: Adapter-Suite laufen lassen**

```bash
cd ~/Projekte/Apps-IOS && node tests/smoke-adapter.js 2>&1 | grep -E "ok |FAIL|bestanden|fehlgeschlagen"
```

Erwartet: alle Checks `ok` (auch die Fixture-Checks, sobald Task 5 erledigt ist). Scheitert der Rundlauf, zeigt der FAIL-Text den ersten abweichenden Schlüssel. Hat die echte Fixture keine `windSpeedMax`-Felder (Task 5, Schritt 3), greift der Stundenweg; die Fixture-Checks verlangen nur Zahlen.

- [ ] **Schritt 5: Commit-Vorschlag**: `git add wetter-core.js tests/harness.js tests/run.js tests/smoke-adapter.js && git commit -m "Adapter: WeatherKit-Antwort in die Struktur der Darstellung übersetzen"`

---

### Task 8: `fetchForecast` auf `/wk`, Attribution, Cache-Kennung, alte Aufrufe entfernen

**Files:**
- Modify: `wetter-core.js`, `design.js` (`load()`, `renderAllDesign`, `WORKER_URL`-Nutzung), `tests/smoke-design.js`, `tests/smoke-push.js`, `tests/smoke-sw.js`

- [ ] **Schritt 1: Tests anpassen (fehlschlagend)**

`tests/smoke-design.js`:
- Alle Vorkommen `u.includes('api.open-meteo.com/v1/forecast') && !u.includes('models=')` → `u.includes('/wk?')`; alle `u.includes('api.open-meteo.com/v1/forecast') && u.includes('latitude=52.52') && !u.includes('models=')` → `u.includes('/wk?lat=52.52')`; `u.includes('latitude=48.137')` → `u.includes('lat=48.137')`; `u.includes('latitude=53.55')` → `u.includes('lat=53.55')` (auch in `failHH`); `u.includes('latitude=45.69')` (Zeile ~1086) → `u.includes('lat=45.69')`.
- Zeile ~225 `H.check('Vortag: Abfrage holt past_days=1', …)` ersetzen durch:
  `H.check('Vortag: Abfrage läuft über den Worker (/wk mit lat und lon)', sb._fetchLog.some(u => /\/wk\?lat=48\.137&lon=11\.575$/.test(u)), sb._fetchLog.filter(u => u.includes('/wk')).join(' | '));`
- Zeilen ~264–265 (`metaDirs`/`metaFetches` und der Check „Herkunft: Abfrage holt die Metadaten …“) löschen.
- Offline-Cache (Zeilen ~663–665 und ~791): in den beiden gespeicherten Objekten `{ savedAt: …, payload }` → `{ savedAt: …, source: 'wk', payload }`. Hinter dem Check „Offline: Cache gerendert + Hinweis“ ergänzen:
  ```js
  const sb5b = boot({ storage: { 'wetter:pos': JSON.stringify({ lat: 48.137, lon: 11.575, name: 'München' }), [LOC_KEY]: JSON.stringify({ savedAt: '2026-10-08T06:00:00.000Z', payload }) }, geolocation: denied });
  await wait(300);
  H.check('Offline: gespeicherte Daten ohne Kennung source=wk (alte Open-Meteo-Nutzlast) werden nicht mehr ausgeliefert', !G(sb5b,'hero').innerHTML.includes('17°') && G(sb5b,'banner').innerHTML.includes('konnten nicht geladen'), G(sb5b,'banner').innerHTML);
  ```
- Nach dem Check „Stand-Zeile“ (Zeile ~501) ergänzen:
  ```js
  H.check('Attribution: einmal je Sitzung geholt, Nutzlast trägt attr, Fußzeile zeigt beide Logos mit Link', sb._fetchLog.filter(u => u.endsWith('/wk/attribution')).length === 1 && G(sb,'wkAttr').innerHTML.includes('<img class="wk-logo wk-day" src="https://weatherkit.apple.com/assets/branding/dark@2x.png" alt="Apple Weather">') && G(sb,'wkAttr').innerHTML.includes('class="wk-logo wk-night" src="https://weatherkit.apple.com/assets/branding/light@2x.png"') && JSON.parse(sb._store[LOC_KEY_MUC]).payload.attr.onDark.endsWith('light@2x.png') && JSON.parse(sb._store[LOC_KEY_MUC]).source === 'wk', G(sb,'wkAttr').innerHTML);
  G(sb,'refresh').trigger('click'); await wait(300);
  H.check('Attribution: beim Aktualisieren kein zweiter Abruf', sb._fetchLog.filter(u => u.endsWith('/wk/attribution')).length === 1, sb._fetchLog.filter(u => u.includes('/wk')).length);
  ```
  und oben bei den Konstanten (nach `const G = …`) `const LOC_KEY_MUC = 'wetter:loc:' + (48.137).toFixed(2) + ',' + (11.575).toFixed(2);`.
- Im `data`-Objekt am Dateianfang bleiben `ens`, `md`, `air`, `meta` vorerst stehen (Tasks 9/10 räumen sie weg); `okFetch` ignoriert sie bereits.

`tests/smoke-sw.js` Zeile ~111: `A.req('https://api.open-meteo.com/v1/forecast?latitude=48')` → `A.req('https://wetter-nina-proxy.anferny-wetter.workers.dev/wk?lat=48&lon=11')`.

`tests/smoke-push.js`:
- Regex `/const NINA_PROXY = [^\n]*"(https:\/\/[^"]+)"/` → `/const WORKER_URL = [^\n]*"(https:\/\/[^"]+)"/`; die Check-Texte „Worker-Host: NINA_PROXY zeigt …“ → „Worker-Host: WORKER_URL zeigt …“.
- Check „Datenschicht: window.NINA_PROXY = "" schaltet NINA aus …“ erweitern: Bedingung zusätzlich `&& vm.runInContext('WORKER_URL', off) === proxyUrl`, Text „…; WORKER_URL bleibt davon unberührt“.
- Die beiden Zeilen `const models = vm.runInContext('MODELS', sb), …` und den Check „Datenschicht: zu jedem Modell in MODELS …“ löschen.

- [ ] **Schritt 2: Fehlschlag sehen**: `npm test 2>&1 | grep -E "FAIL" | head` zeigt die geänderten Checks rot.

- [ ] **Schritt 3: `wetter-core.js` umbauen**

- `getJson`:
  ```js
  async function getJson(url) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
          let reason = null;
          try { const j = await res.json(); reason = j && (j.reason || j.error); } catch (e) { reason = null; }
          throw new Error(typeof reason === "string" ? reason : "HTTP " + res.status);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.reason || "API-Fehler");
      return data;
  }
  ```
- `fetchForecast` ersetzen (Kommentar davor anpassen):
  ```js
  /* Vorhersage über den Worker (/wk); der Adapter liefert die gewohnte Struktur, splitPastDay trennt
     den Vortag als fc.past ab, damit Tag 0 und Stunde 0 überall „heute“ bleiben. */
  function fetchForecast(loc) {
      return getJson(WORKER_URL + "/wk?lat=" + loc.lat + "&lon=" + loc.lon).then(function (j) {
          if (!j || !j.data || typeof j.timezone !== "string") throw new Error("Vorhersage unvollständig");
          return splitPastDay(wkToForecast(j.data, j.timezone));
      });
  }

  /* Pflichtnennung von Apple Weather: Logo und Name, einmal je Sitzung über den Worker */
  let attributionCache = null;
  function fetchAttribution() {
      if (attributionCache) return Promise.resolve(attributionCache);
      return getJson(WORKER_URL + "/wk/attribution").then(function (a) {
          if (a && typeof a.onLight === "string" && typeof a.onDark === "string") attributionCache = { name: a.name || "Apple Weather", onLight: a.onLight, onDark: a.onDark };
          return attributionCache;
      });
  }
  ```
- `META_MODELS`, `fetchModelMeta`, `fetchEnsemble`, `fetchModels`, `fetchAir` samt Kommentaren löschen; `aqiLevel` und `pollenLevel` löschen.
- `NINA_PROXY`-Block ersetzen:
  ```js
  /* Eigener Cloudflare-Worker (proxy/): Vorhersage (/wk), NINA (/nina), Regen-Alarm (/push/*), Rückmeldung
     (/feedback). window.WORKER_URL überschreibt die Adresse (lokaler Worker in Tests und Vorschau).
     window.NINA_PROXY gilt nur für NINA: die leere Zeichenkette schaltet NINA aus, sonst WORKER_URL. */
  const WORKER_URL = (typeof window !== "undefined" && typeof window.WORKER_URL === "string") ? window.WORKER_URL : "https://wetter-nina-proxy.anferny-wetter.workers.dev";
  const NINA_PROXY = (typeof window !== "undefined" && typeof window.NINA_PROXY === "string") ? window.NINA_PROXY : WORKER_URL;
  ```
- `saveCache`/`loadCache`:
  ```js
  function saveCache(loc, payload) {
      try {
          localStorage.setItem(CACHE_PREFIX + loc.id, JSON.stringify({ savedAt: new Date().toISOString(), source: "wk", payload: payload }));
      } catch (e) { /* Speicher voll oder privater Modus – nicht kritisch */ }
  }

  /* Nur Einträge aus WeatherKit (source "wk"); ältere Open-Meteo-Stände werden nicht mehr ausgeliefert */
  function loadCache(loc) {
      try {
          const raw = localStorage.getItem(CACHE_PREFIX + loc.id);
          const c = raw ? JSON.parse(raw) : null;
          return c && c.source === "wk" ? c : null;
      } catch (e) { return null; }
  }
  ```
- `ensembleSeries`/`ensembleStats` bleiben (Entscheidung 4 der Spec).

- [ ] **Schritt 4: `design.js` umbauen**

- `load()`: die `Promise.allSettled`-Liste → `fetchForecast(loc), fetchWarnings(loc), fetchNina(loc), fetchAttribution()`; die Nutzlast → `{ fc: fc, ens: null, md: null, air: null, meta: null, warn: val(1), nina: val(2), attr: val(3) || lastAttr, loc: { name: loc.name || "", lat: loc.lat, lon: loc.lon } }`.
- Neben `let lastMeta = null, lastLoc = null, …` ein `lastAttr = null` anlegen; in `renderAllDesign` nach `lastLoc = payload.loc || null;` die Zeile `lastAttr = payload.attr || lastAttr; renderAttribution(lastAttr);`.
- Neue Funktionen (vor `renderAllDesign`):
  ```js
  /* Pflichtnennung Apple Weather in Fußzeile und Herkunftsblatt: Logo für helle Flächen, nachts das für dunkle */
  function attributionHtml(attr) {
      if (!attr || !attr.onLight || !attr.onDark) return "Apple Weather";
      return '<img class="wk-logo wk-day" src="' + escHtml(attr.onLight) + '" alt="' + escHtml(attr.name || "Apple Weather") + '"><img class="wk-logo wk-night" src="' + escHtml(attr.onDark) + '" alt="" aria-hidden="true">';
  }
  function renderAttribution(attr) { const a = D("wkAttr"); if (a) a.innerHTML = attributionHtml(attr); }
  ```
- Die drei Aufrufe `fetch(NINA_PROXY + …)` (Push-Routen und `/feedback`) → `fetch(WORKER_URL + …)`.

- [ ] **Schritt 5: `index.html` Fußzeile und `modern.css`**

Zeile mit `<a href="https://open-meteo.com/" rel="noopener">Open-Meteo</a>` → `<a href="https://weatherkit.apple.com/legal-attribution.html" rel="noopener" id="wkAttr">Apple Weather</a>`; `CC BY 4.0` bleibt (gilt für DWD und NINA).

`modern.css`, im Fußzeilen-Abschnitt ergänzen:

```css
.wk-logo { height: 1.1em; vertical-align: -0.2em; }
.wk-logo.wk-night { display: none; }
html.night .wk-logo.wk-day { display: none; }
html.night .wk-logo.wk-night { display: inline; }
```

- [ ] **Schritt 6: Tests grün**: `npm test` (alle fünf Suiten). Sichtprüfung im Browser (Worker lokal, App lokal): in `index.html` vorübergehend `<script>window.WORKER_URL = "http://localhost:8787";</script>` vor `wetter-core.js` einfügen, `npm start`, `http://localhost:8000` öffnen: Hero, Stundenstreifen (48 Spalten), Tagesliste (10 Zeilen), Nowcast-Karte, Rausgehen, Verlauf, Tagesfilm, Zeitreise, Chip „… als gestern“. Konsole ohne Fehler. Die Zeile danach wieder entfernen (`git diff index.html` zeigt nur die Fußzeile). **Sichtprüfung mit dem User** laut Spec: Screenshot zeigen, Freigabe abwarten.

- [ ] **Schritt 7: Commit-Vorschlag**: `git add wetter-core.js design.js index.html modern.css tests/ && git commit -m "App: Vorhersage über den Worker aus WeatherKit, Attribution, Cache-Kennung"`

---

### Task 9: Modellvergleich entfernen

**Files:**
- Modify: `design.js`, `index.html`, `tests/harness.js`, `tests/smoke-design.js`, `tests/render-design.html`, `tests/build-design-render.js`

- [ ] **Schritt 1: Tests anpassen** (`tests/smoke-design.js`)
- Im `data`-Objekt `ens: H.mockEnsemble(fc), md: H.mockModels(),` und `meta: {…}` entfernen (das Objekt bleibt mit `fc, air, geo, warn, nina, place`).
- Zeile ~34 `E('models').style.height = '120px';` entfernen.
- Block „Modellunsicherheit“ (Zeilen ~83–107, von `const ms = sb.modelSums(data.md);` bis zum Ende des Checks „Modelle: Hervorhebung wechselt auf GFS …“) löschen.
- Zeile ~364 Check „Diagramme: Modellkurven mit verborgenem Satz“ löschen; ~494 „Modelle: beide Werte zählbar“ und ~499 „Modelle gerendert“ löschen; ~500 `['hourly','days','models']` → `['hourly','days']`.
- ~1031 im DUMP-Objekt `, models: G(sb,'models').innerHTML` entfernen.
- ~1221–1222 die beiden VoiceOver-Checks zu Modell-Chips löschen (`mm` wird dort nicht mehr definiert).
- ~1434 `wantIds` ohne `'models'`, Check-Text „… genau die sechs stabilen Wrapper …“, `gateIO.targets.length === 6`.
- Neu nach dem Check „Tage: Spannen auf gemeinsamer Skala“: `H.check('Modellvergleich: kein Feld, keine Funktionen mehr', !('dModels' in sb) && !('modelSums' in sb) && !('tempSpanText' in sb) && !/id="models"/.test(fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8')), Object.keys(sb).filter(k => /model/i.test(k)).join(','));`

- [ ] **Schritt 2: Fehlschlag sehen**: `node tests/smoke-design.js 2>&1 | grep FAIL`.

- [ ] **Schritt 3: Code entfernen**
- `index.html`: das Feld `<div class="field white a-up" style="animation-delay:1.14s"> <h2>Modellvergleich …</h2> <div id="models" …></div> </div>` löschen.
- `design.js`: `LOOP_GATE_IDS` ohne `"models"`; in `clearRendered` die Liste `["hourly", "days", "details", "models"]` → ohne models; `dModels(payload.md, payload.fc, payload.ens);` und `startCounters(D("models"));` in `renderAllDesign` löschen; die Funktionen `modelDays`, `cumulative` (nur wenn sonst ungenutzt, mit `grep -n "cumulative(" design.js` prüfen), `modelSums`, `ensembleBand`, `agreementText`, `tempSpanText`, `modelMaxTemps`, `modelChartSvg`, `modelChipLabel`, `markModelChips`, `highlightModel`, `dModels`, `modelListText` samt Variable `hlModel` und ihren Klick-Handlern (`grep -n "hlModel\|\.mchip\|highlightModel" design.js`) löschen. `ensembleBand` darf weg, weil nichts anderes es nutzt (`grep -n ensembleBand design.js` muss danach leer sein).
- `tests/harness.js`: `mockEnsemble` und `mockModels` löschen und aus `module.exports` nehmen.
- `tests/build-design-render.js`: `'models'` aus der `forEach`-Liste. `tests/render-design.html`: das Feld „Modellvergleich“ (`<div class="field white a-up" style="animation-delay:1.9s"> … <div id="models">…</div></div>`) löschen.
- `modern.css`: Regeln `.mchips`, `.mchip`, `.agree`, `.ml`, `.band`, `.tspan` bleiben vorerst stehen (die Farbschema-Checks in smoke-design.js lesen `.mchip.hl .k`-Regeln aus dem Stylesheet); Aufräumen in Teil 4 der Spec.

- [ ] **Schritt 4: Tests grün**: `npm test`.

- [ ] **Schritt 5: Commit-Vorschlag**: `git add -A design.js index.html tests/ && git commit -m "Modellvergleich entfernt: ohne kommerziell nutzbare Quelle"`

---

### Task 10: Luftqualität und Pollen abschalten, Sicht mit fester ID

**Files:**
- Modify: `design.js`, `tests/harness.js`, `tests/smoke-design.js`

- [ ] **Schritt 1: Tests anpassen**
- `data`: `air: H.mockAir(),` entfernen.
- ~490 „Details: 8 Kacheln (6 + Luft + Pollen)“ → „Details: 7 Kacheln (6 + Sicht)“ mit `=== 7`; ~493 Check-Text „(UV, Wind, Regen, Feuchte, Druck, Sicht)“, Bedingung bleibt `=== 6`; ~497 und ~498 (Luftqualität, Pollen-Chips) löschen.
- Block „Sicht statt Pollen“ (~851–876): `airNoPollen` und `sbV`-Boot ersetzen durch `const sbV = boot({ fetchImpl: H.okFetch(data), geolocation: granted });`, Check ~857 mit `=== 7` Kacheln und Text „Sicht: der siebte Platz zeigt die Sichtweite …“; ~863 → `detV.includes('data-tile="sicht" data-name="sicht"')` und Text „Sicht: Kachel trägt zum Ausblenden den Namen sicht“; `tileStub('pollen', 'sicht')` → `tileStub('sicht', 'sicht')`; `sbV.setSetting('hidden', ['pollen'])` → `['sicht']`, Check-Text „Ausblenden „Sicht“ versteckt …“; die Checks ~874 „Sicht: mit Pollen kein Sicht-Feld“ und ~876 „mit Pollen bleibt die Pollen-Kachel“ löschen. Neu: `H.check('Sicht: alte Einstellung hidden=pollen blendet nichts mehr aus', (() => { sbV.setSetting('hidden', ['pollen']); const r = !sichtT.classList.contains('user-hidden'); sbV.setSetting('hidden', []); return r; })());`
- ~1035 Liste `['uv', 'wind', 'rain', 'sun', 'humidity', 'pressure', 'sicht']`.
- Herkunft: Check ~271 ohne `/Luft und Pollen: …/` (die Bedingung endet nach dem Modellpunkt-Teil; Modellpunkt-Text wird in Task 12 geändert).

- [ ] **Schritt 2: Code**
- `design.js` `renderDetails(fc, opts)` (Parameter `air` streichen, Aufrufe in `renderAllDesign` und beim Einheitenwechsel (`renderDetails(lastData.fc, lastAir, { swap: true })`) anpassen): den Block von `if (air && air.current) {` bis `} else if (vi) { html += sichtTile(); }` ersetzen durch `if (vi) html += sichtTile();`. Den Kommentar „Sichtweite: nimmt den Platz der Pollen ein …“ → „Sichtweite mit Nebelrisiko“.
- `TILE_SLUGS`: `"Luftqualität": "air", "Pollen": "pollen", "Sicht": "pollen"` → `"Sicht": "sicht"`. `LAYOUT_TILES`: `{ id: "air", … }, { id: "pollen", name: "Pollen oder Sicht" }` → `{ id: "sicht", name: "Sicht" }`.
- `lastAir` und alle Stellen, die es setzen oder übergeben, entfernen (`grep -n lastAir design.js`).
- `tests/harness.js`: `mockAir` löschen und aus den Exporten nehmen.

- [ ] **Schritt 3: Tests grün**: `npm test`.

- [ ] **Schritt 4: Commit-Vorschlag**: `git add design.js tests/ && git commit -m "Luftqualität und Pollen abgeschaltet, Sicht-Kachel mit fester ID"`

---

### Task 11: Sonnenscheindauer und Regenstunden aus der Darstellung, neues Highlight

**Files:**
- Modify: `design.js`, `tests/smoke-design.js`

- [ ] **Schritt 1: Tests anpassen**
- Highlights ~314: `d.sunshine_duration[5] = 30000` → `d.cloud_cover_day[5] = 20`; ~317 `kindAt('sonne').text === 'Sonnig, 20 % Wolken'`.
- ~318 ersetzen: `H.check('Highlights: Sonnigster Tag nur bei Code 0 oder 1 und höchstens 30 % Wolken, der Tag mit den wenigsten gewinnt', !sb.dayHighlights(hlOf(d => { d.cloud_cover_day[5] = 31; })).some(c => c.kind === 'sonne') && !sb.dayHighlights(hlOf(d => { d.cloud_cover_day[2] = 5; })).some(c => c.kind === 'sonne') && sb.dayHighlights(hlOf(d => { d.cloud_cover_day[5] = 20; d.cloud_cover_day[6] = 10; })).filter(c => c.kind === 'sonne')[0].day === 6, JSON.stringify(sb.dayHighlights(hlOf(d => { d.cloud_cover_day[5] = 20; d.cloud_cover_day[6] = 10; })).filter(c => c.kind === 'sonne')));`
- ~320 `fCalm`: `d.sunshine_duration[i] = 21600;` → `d.cloud_cover_day[i] = 60;`.
- ~915: Zeile der Tagesliste → `'<div class="pp">UV 5</div><div class="lo"></div><div class="bar"><i style="left:0.0%;width:49.5%;animation:none"></i></div><div class="hi">11,9 h</div>'`, `viewAnswer` → `'Tageslicht 11 h 53 min, UV mittel jetzt, goldene Stunde ab 18:24.'`, `daysHint` → `'UV · Tageslicht'`.
- ~932 → `'Sonnenaufgang 07:12, UV mittel.'`; ~936 beide → `'Sonnenaufgang 07:12, UV mittel.'` bzw. `'Sonnenaufgang 13:00, UV mittel.'`.
- Neu nach „Details: Sonnen-Kachel …“: `H.check('Details: keine Sonnenschein- und Regenstunden-Angaben mehr', !det.includes('Sonnenschein') && !/\d+&nbsp;h/.test(det.slice(det.indexOf('class="tile rain"'), det.indexOf('class="tile sun"'))) && !det.includes('Regenstunde'), det.match(/Regen[\s\S]{0,200}/));`
- Herkunft ~280 (Abschnitt Nächste Tage): den Regeltext in der Erwartung anpassen, sobald Task 12 den Satz ändert (siehe dort).

- [ ] **Schritt 2: Code in `design.js`**
- `answerLight`: `sunH` löschen; Nacht-Rückgabe → `"Sonnenaufgang " + hhmm(…) + (lv ? ", UV " + lv.word : "") + "."`; Tag-Rückgabe beginnt mit `(d.daylight_duration && isNum(d.daylight_duration[0]) ? "Tageslicht " + fmtDuration(d.daylight_duration[0]) : "Tag")`. Kommentar über der Funktion: „Licht: Tageslicht, UV-Maximum …“.
- `daysHint`: `light: "UV · Sonnenstunden"` → `light: "UV · Tageslicht"`.
- `renderDays`, Zweig `view === "light"`: `sun` entfernen; `bWidth = isNum(dlen) ? Math.max(0, Math.min(100, dlen / 86400 * 100)) : 0; hiTxt = isNum(dlen) ? (dlen / 3600).toFixed(1).replace(".", ",") + ' h' : '–';`.
- `renderDays`, Zweig `view === "rain"`: `ph` entfernen, `loTxt = ''`.
- `rainPanelHtml`: `hours` entfernen, Satz `'Heute ' + fmtMm(today) + ' mm'` ohne Regenstunden.
- `renderDetails`, Regen-Kachel: den Teil `(isNum(d.precipitation_hours && …) ? ' · ' + … + '&nbsp;h' : '') +` entfernen.
- `sunPanelHtml`: `sun0` löschen, `fact('Sonnenschein', fmtDuration(sun0))` entfernen.
- `dayHighlights`, Block „Sonnigster Tag“ ersetzen:
  ```js
  /* Sonnigster Tag: Wettercode 0 oder 1 und höchstens 30 % Wolken am Tag; der Tag mit den wenigsten Wolken gewinnt */
  let sunny = null;
  for (let i = 1; i <= last; i++) {
      const cc = at(d.cloud_cover_day, i), code = at(d.weather_code, i);
      if (cc !== null && cc <= 30 && (code === 0 || code === 1) && (!sunny || cc < sunny.cc)) sunny = { i: i, cc: cc };
  }
  if (sunny) add(sunny.i, "sonne", HL_PRIO.sonne, "Sonnig, " + Math.round(sunny.cc) + " % Wolken");
  ```
- Danach `grep -n "sunshine_duration\|precipitation_hours" design.js wetter-core.js` muss leer sein.

- [ ] **Schritt 3: Tests grün**: `npm test`.

- [ ] **Schritt 4: Commit-Vorschlag**: `git add design.js tests/smoke-design.js && git commit -m "Anzeigen ohne Sonnenscheindauer und Regenstunden; Sonnigster Tag nach Bewölkung"`

---

### Task 12: Herkunftsblatt, Tagesliste-Knopf, Texte

**Files:**
- Modify: `design.js`, `tests/smoke-design.js`

- [ ] **Schritt 1: Tests anpassen**
- ~271: `srcHtml.includes('Modellpunkt der Vorhersage: 48,14° N, 11,57° O, 0,0 km entfernt.')` (ohne Höhe), Text „Herkunft: Ort und Modellpunkt mit Entfernung“.
- ~274 und ~277 (ICON-D2-Lauf, Läufe der Vergleichsmodelle, Modellvergleich nennt …) löschen. Neu an der Stelle:
  ```js
  const readTxt = sb.stampAt(Date.parse('2026-09-25T12:10:00Z'), H.TEST_NOW, 'Europe/Berlin'), expTxt = sb.stampAt(Date.parse('2026-09-25T12:20:00Z'), H.TEST_NOW, 'Europe/Berlin');
  H.check('Herkunft: Abschnitt Apple Weather mit Logo, Stand und nächster Aktualisierung in Ortszeit', srcHtml.includes('<section class="src-sec" id="src-apple"><h3>Vorhersage</h3><p><img class="wk-logo wk-day"') && srcHtml.includes('Vorhersage: Apple Weather, Stand ' + readTxt + ', nächste Aktualisierung erwartet ' + expTxt + '.') && srcHtml.includes('Nowcast: die ersten vier Viertelstunden minutengenau aus Apples Minutenvorhersage, die zwölf folgenden aus den Stundenwerten geviertelt.'), srcHtml.slice(srcHtml.indexOf('src-apple'), srcHtml.indexOf('src-apple') + 400));
  ```
- ~280: in der Erwartung des Highlights-Satzes `sonnigster Tag ab 7 Stunden und 70 % des Tageslichts` → `sonnigster Tag bei klarem Himmel und höchstens 30 % Wolken am Tag`.
- ~284: `=== 10`, Liste `['ort','apple','temp','regen','wind','sonne','sicht','rausgehen','highlights','warn']`, `<h3>` zehn, Text „zehn Abschnitte“.
- ~286 (Regenrisiko als Anteil der Läufe) → `H.check('Herkunft: Regenrisiko als Modellwert von WeatherKit', srcHtml.includes('Regenrisiko je Stunde: Regenwahrscheinlichkeit von WeatherKit (precipitationChance)'), …)`.
- ~288 `srcBare`: Aufruf `sb.sourceSheetHtml(sb.prepareData(clone(), null), null, null, false, H.TEST_NOW, null)`; Bedingung: `!srcBare.includes('Gewählter Ort') && srcBare.includes('Modellpunkt der Vorhersage: 48,14° N, 11,57° O.') && srcBare.includes('<p>Apple Weather</p>') && (srcBare.match(/<section/g) || []).length === 10`, Text „Herkunft: ohne Ort und Attribution bleibt das Blatt vollständig“.
- ~484: `(dd.match(/ more"/g) || []).length === 7 && dd.includes('Weitere 7 Tage')` bleibt für den 14-Tage-Mock gültig; ergänzen: `H.check('Tage: Knopftext aus der Datenlänge (10 Tage → Weitere 3 Tage)', (() => { const f10 = clone(); Object.keys(f10.daily).forEach(k => { f10.daily[k] = f10.daily[k].slice(0, 10); }); sb.renderDays(f10, { quiet: true }); const ok = G(sb,'days').innerHTML.includes('Weitere 3 Tage') && (G(sb,'days').innerHTML.match(/ more"/g) || []).length === 3; sb.renderDays(fc); return ok; })());`

- [ ] **Schritt 2: Code in `design.js`**
- `sourceSheetHtml(data, loc, loadedIso, cached, now, attr)`; Aufruf in `openSource`: `sourceSheetHtml(lastData, lastLoc, loadedAt, loadedCached, nowMs(), lastAttr)`.
- `ort`: Höhe weg (`[fmtCoord(…), distTo(…)].filter(Boolean).join(", ")`), Luft-Zeile weg.
- `mod` → `apple`:
  ```js
  const w = fc.wk || {};
  const apple = [
      attributionHtml(attr),
      "Vorhersage: Apple Weather" + (w.readTime ? ", Stand " + stampAt(Date.parse(w.readTime), now, tz) : "") + (w.expireTime ? ", nächste Aktualisierung erwartet " + stampAt(Date.parse(w.expireTime), now, tz) : "") + ".",
      "Nowcast: die ersten vier Viertelstunden minutengenau aus Apples Minutenvorhersage, die zwölf folgenden aus den Stundenwerten geviertelt.",
      loadedIso ? freshnessText(loadedIso, cached, now, tz) + "." : null
  ];
  ```
  Die Zeile `const y = yesterdayTemp(fc);` bleibt; `temp[0]`: „Gefühlt: gefühlte Temperatur von WeatherKit …“.
- `regen`: `st`-Berechnung entfernen; erster Satz `"Regenrisiko je Stunde: Regenwahrscheinlichkeit von WeatherKit (precipitationChance)."`; dritter Satz: „Trockene Phasen und Regenverlauf: Viertelstunden aus Minuten- und Stundenvorhersage. Blaue Felder ab 25 % Risiko.“
- `sonne[0]`: „Auf- und Untergang von WeatherKit. …“.
- `hl[0]`: Teil „sonnigster Tag ab 7 Stunden und 70 % des Tageslichts“ → „sonnigster Tag bei klarem Himmel und höchstens 30 % Wolken am Tag“.
- `luft` löschen; `return`: `srcSection("src-apple", "Vorhersage", apple)` statt `src-modelle`, `src-luft` raus.
- `renderDays`: Knopftext nutzt bereits `n - SHOWN`; prüfen, dass nichts „7“ hart codiert (`grep -n "Weitere 7" design.js index.html` leer).
- Hinweistexte mit „4 Stunden“ bleiben.

- [ ] **Schritt 3: Tests grün**: `npm test`. Sichtprüfung Tag und Nacht (Nachtschalter): Herkunftsblatt über „Woher?“, Fußzeile, Logo-Wechsel. **Sichtprüfung mit dem User** (zweite laut Spec).

- [ ] **Schritt 4: Commit-Vorschlag**: `git add design.js tests/smoke-design.js && git commit -m "Herkunftsblatt und Fußzeile auf Apple Weather"`

---

### Task 13: Regen-Alarm im Worker auf WeatherKit

**Files:**
- Modify: `proxy/src/worker.js`, `tests/smoke-push.js`

- [ ] **Schritt 1: Tests anpassen** (`tests/smoke-push.js`)
- Alarmregel: `a1.at === '14:45'` → `'14:30'` (Beginn der Viertelstunde), Text „Alarmregel: Regen ab der dritten Viertelstunde (Beginn genannt), Menge der folgenden Stunde“.
- Alle `lat: 45.69, lon: 13.12, name: 'Lignano'` in den Subscribe-Aufrufen → `lat: 49.0134, lon: 12.1016, name: 'Regensburg'`; `stored.lat === 45.69` → `49.0134`; `stored.name === 'Lignano'` → `'Regensburg'`; im `payload`-Text oben `'Lignano: gegen 16:30 Uhr …'` → `'Regensburg: gegen 16:30 Uhr …'`.
- Prüf-Lauf: `fakeFetch` ersetzen:
  ```js
  const apple = [];
  const fakeFetch = async (url, init) => {
    if (String(url).includes('weatherkit.apple.com')) { apple.push(String(url)); return { ok: true, status: 200, json: async () => ({ currentWeather: { asOf: new Date(utcNow).toISOString() }, forecastNextHour: { minutes: minutesFrom(utcNow, utcNow + 25 * 60000, utcNow + 60 * 60000, 1.2) }, forecastHourly: { hours: hoursFrom(Math.floor(utcNow / 3600000) * 3600000, [0, 0.8, 0.4, 0, 0, 0]) } }) }; }
    sent.push({ url: String(url), init });
    return { status: push410 ? 410 : 201 };
  };
  ```
  mit `let push410 = false;` davor (Ortszeit 14:20, Regen ab 14:45 bis 15:20, Stunde 15 mit 0,8 mm; Erwartung der Regel: Beginn 14:45, 1,0 mm). `Object.assign(env, wkEnv)` vor dem ersten `checkRain`, nach dem Block wieder entfernen (`REQUIRED_WK.forEach(k => delete env[k])`).
- Gruppierung: vor `res1` ein zweites Abonnement am selben Gitterpunkt anlegen: `sub2` mit eigenem Schlüsselpaar (ECDH P-256 wie `ua`, `auth` 16 Zufallsbytes) und Endpunkt `https://web.push.apple.com/QAbc456`, per `req('/push/subscribe', { subscription: sub2, lat: 49.0101, lon: 12.0990, name: 'Regensburg Ost' })`. Erwartungen: nach `res1` `apple.length === 1 && res1.sent === 2 && sent.length === 2` (Text „Worker: Prüf-Lauf holt je gerundetem Gitterpunkt eine WeatherKit-Antwort und sendet an beide Abonnements genau eine Nachricht“); nach `res2` `res2.sent === 0 && sent.length === 2`; vor `res3` `push410 = true;`, danach `res3.sent === 0 && res3.removed === 2 && sent.length === 4 && subs().length === 0`.
- Ohne `VAPID_SUBJECT`: der Stub-Fetch liefert `{ ok: true, json: async () => ({}) }`; Erwartung bleibt `sentNo.length === 0`.

- [ ] **Schritt 2: Fehlschlag sehen**: `node tests/smoke-push.js 2>&1 | grep FAIL`.

- [ ] **Schritt 3: Code**
- `rainAlert`: `at` aus dem Beginn: `const start = new Date(Date.parse(m15.time[i] + "Z") - 900000).toISOString().slice(11, 16); return { at: start, mm: … };` Kommentar: „Liefert Beginn der Viertelstunde (Zeitstempel = Intervall-Ende minus 15 Minuten) und Menge der Stunde ab Beginn.“
- `checkRain`: den `try`-Block ersetzen:
  ```js
          const point = gridKey(sub.lat, sub.lon);
          let wk = byPoint.get(point);
          if (!wk) { wk = await fetchWeatherKit(env, sub.lat, sub.lon, { fetch: f, now: now }); byPoint.set(point, wk); }
          if (!wk.ok) { out.errors++; continue; }
          const wallNow = now + zoneOffsetMs(now, wk.timezone);
          const alert = rainAlert(wkMinutely15(wk.data, wk.timezone, now), wallNow);
  ```
  mit `const byPoint = new Map();   /* ein Apple-Aufruf je gerundetem Gitterpunkt und Lauf */` vor der Schleife; `gridKey` in den Import aus `./weatherkit.js` aufnehmen. Kopfkommentar der Cron-Zeile: „Regen-Alarm: WeatherKit je Gitterpunkt prüfen …“.
- `proxy/README.md`, Abschnitt Regen-Alarm: „15-Minuten-Vorhersage von Open-Meteo je Abonnement“ → „Minuten- und Stundenvorhersage von WeatherKit je gerundetem Gitterpunkt (ein Apple-Aufruf je Punkt und Lauf, rund 2 900 im Monat je Punkt). Übersteigt die Zahl der Punkte 100, den Cron in `wrangler.toml` auf `*/30` stellen.“
- `grep -rn "open-meteo" proxy/ --exclude-dir=node_modules` muss leer sein.

- [ ] **Schritt 4: Tests grün**: `npm test`. Dann (nach Deploy auf Zuruf) Probenachricht auf dem iPhone: Einstellungen, Regen-Alarm, „Probenachricht senden“.

- [ ] **Schritt 5: Commit-Vorschlag**: `git add proxy/ tests/smoke-push.js && git commit -m "Regen-Alarm prüft WeatherKit je Gitterpunkt"`

---

### Task 14: Version, Doku, Abschluss

**Files:**
- Modify: `index.html`, `radar.html`, `manifest.webmanifest`, `sw.js`, `docs/stand.md`, `README.md`, `docs/verbesserungen.md`, `docs/veroeffentlichung.md`

- [ ] **Schritt 1: Versions-Query** (Datum des Tages, Buchstabe a; bei einem zweiten Bump am selben Tag b):

```bash
cd ~/Projekte/Apps-IOS && OLD=$(grep -o 'modern\.css?v=[0-9a-z]*' index.html | head -1 | cut -d= -f2) && NEW=$(date +%Y%m%d)a && echo "$OLD -> $NEW" && grep -rl "$OLD" index.html radar.html manifest.webmanifest sw.js docs/stand.md | xargs sed -i '' "s/$OLD/$NEW/g" && grep -rn "$OLD" --include="*.html" --include="*.js" --include="*.webmanifest" --include="*.md" . | grep -v node_modules | grep -v docs/superpowers
```

Erwartet: die letzte Zeile leer (kein alter Wert mehr); `node tests/smoke-design.js | grep "Versions-Query"` → `ok`.

- [ ] **Schritt 2: `docs/stand.md`**
- Tabelle in Abschnitt 3: die sechs Open-Meteo-Zeilen ersetzen durch
  `| Apple WeatherKit (über den Worker) | wetter-nina-proxy…workers.dev/wk | aktuell, 60 Minuten, Stunden ab Vortag für 120 h, 10 Tage; Adapter wkToForecast |` und `| Open-Meteo Geocoding | geocoding-api.open-meteo.com/v1/search | Ortssuche (Ersatz in Teil 2) |`; Worker-Zeile: `/wk, /wk/attribution, /nina, /push/*, /feedback`.
- Absatz „Ablauf“: „load() startet vier Fetches parallel per Promise.allSettled (Vorhersage, DWD, NINA, Attribution); nur die Vorhersage ist Pflicht. fetchForecast ruft /wk, wkToForecast übersetzt die WeatherKit-Antwort in die bisherige Struktur, splitPastDay trennt den Vortag … Die Nutzlast {fc, ens: null, md: null, air: null, meta: null, warn, nina, attr, loc} … gespeichert mit source "wk".“
- Zeile 69: „Tagesliste mit 7 plus 3 Zeilen“ und den Halbsatz „und ein Modellvergleich aus sechs Modellen mit Ensemble-Band“ streichen. Zeile 71: „Luftfeuchte, Luftdruck und Sicht mit Nebelrisiko“; „Blatt mit zehn Abschnitten; der Abschnitt Vorhersage nennt Apple Weather mit Stand und Logo“.
- Zeile 162: „Open-Meteo-Tarif oder Worker-Cache“ → „(erledigt: Vorhersage über WeatherKit im Worker)“; Zeile 188 streichen.
- Oben einen Absatz „Umbau vom <Datum>: Vorhersage von Open-Meteo auf WeatherKit (Spec docs/superpowers/specs/2026-10-30-weatherkit-umbau-design.md, Plan docs/superpowers/plans/2026-10-31-weatherkit-umbau.md); Modellvergleich, Luftqualität und Pollen entfallen.“

- [ ] **Schritt 3: `README.md`**: Zeile 11: „14 Tage“ → „10 Tage“, „Modellvergleich,“ streichen, den Satz „Modellvergleich: Summenkurven …“ streichen, „verankert an den Open-Meteo-Zeiten“ → „an den WeatherKit-Zeiten“, „(`past_days`)“ → „(Stunden ab dem Vortag)“, „ICON-D2-Lauf aus den Open-Meteo-Metadaten“ → „Stand der WeatherKit-Antwort“, „Quellen für Luft, Pollen, Warnungen und Radar“ → „Quellen für Warnungen und Radar“, „Modellkurven“ in der Schrift- und Vorleserliste streichen. Zeile 17: „Datenschicht der Startseite: WeatherKit über den Worker (Adapter wkToForecast), Open-Meteo Geocoding (bis Teil 2), DWD- und NINA-Warnungen, Cache, …“. Zeile 22: „[Open-Meteo](…) (CC BY 4.0)“ → „Apple Weather (WeatherKit über den eigenen Worker; Nennung mit Logo und Link), Open-Meteo Geocoding für die Ortssuche (bis Teil 2)“.

- [ ] **Schritt 4: Checklisten**
- `docs/verbesserungen.md`, Abschnitt „Neu aufgenommen“, anhängen:
  `- [x] WeatherKit-Umbau (<Datum>): Vorhersage über den Worker aus WeatherKit, Open-Meteo nur noch für die Ortssuche (Teil 2 offen). Entfallen: Modellvergleich (keine kommerziell nutzbare Mehrmodell-Quelle), Luftqualität und Pollen (Open-Meteo-Lizenz; Rückkehr für Deutschland aus UBA und DWD als Teil 3 möglich, Entscheidung des Users offen). Spec docs/superpowers/specs/2026-10-30-weatherkit-umbau-design.md.`
  `- [ ] Teil 2: Ortssuche und Ortsname über Apple Maps Server API (Worker /geo, /place); bis dahin Open-Meteo Geocoding und BigDataCloud.`
  `- [ ] Teil 4: Ensemble-Code (ensembleSeries, ensembleStats, members/ensIndex in prepareData) und die Modell-CSS-Regeln entfernen.`
- `docs/veroeffentlichung.md`: Phase 0 Punkt „Nutzung im Blick behalten: Open-Meteo …“ → `- [x] Datenquelle lizenzfest: Vorhersage aus WeatherKit über den Worker (<Datum>); Open-Meteo nur noch für die Ortssuche bis Teil 2.`; Phase 1 „Datenquellen für den Store-Betrieb“ → `[x] … Entscheidung 30.10.2026: WeatherKit.`; Phase 4 ersten Punkt → `[x] WeatherKit statt Open-Meteo, Schlüssel nur im Worker (<Datum>).`; „Nennungen prüfen: Open-Meteo, …“ → „Apple Weather (Logo und Link, erledigt), DWD …“; in Zeile 29 (Datenschutz) „Wetterabfragen an Open-Meteo“ → „Wetterabfragen an den eigenen Worker (WeatherKit), Open-Meteo (Ortssuche)“; Zeile 48 „Externe Links (Open-Meteo, DWD, …)“ → „(Apple Weather, DWD, …)“; Zeile 80 „Daten von Open-Meteo und DWD“ → „von Apple WeatherKit und DWD“; Zeile 88 „gegebenenfalls Open-Meteo-Tarif“ streichen.

- [ ] **Schritt 5: Schlussprüfung**

```bash
cd ~/Projekte/Apps-IOS && grep -rn "open-meteo\|Open-Meteo" --include="*.js" --include="*.html" --include="*.md" --include="*.toml" . | grep -v node_modules | grep -v "docs/superpowers" | grep -v "lignano-" | grep -vi "geocoding\|Ortssuche\|Teil 2"
```

Erwartet: keine Treffer außer in `docs/namen-recherche.md` und Historie-Absätzen in `docs/stand.md`/`docs/verbesserungen.md`. Dann `npm test` (fünf Suiten grün), Pages-Prüfung nach dem Push per `curl -s https://anferny33.github.io/Apps-IOS/ | grep -o 'v=[0-9a-z]*' | head -1`.

- [ ] **Schritt 6: Commit-Vorschlag**: `git add -A && git commit -m "WeatherKit-Umbau: Version, Doku, Checklisten"`. Nach dem Push den User erinnern: Homescreen-App einmal beenden und neu öffnen; gespeicherte Offline-Daten werden einmalig verworfen.

---

## Selbstprüfung gegen die Spec

- Bauteil 1 (Worker `/wk`, Token, Cache, Origin, Drossel, Attribution, Regen-Alarm, README): Tasks 1–5, 13, 4.
- Bauteil 2 (Adapter, `WORKER_URL`, Entfernen der alten Aufrufe, Cache-Kennung): Tasks 6–8.
- Bauteil 3 (Modellvergleich, Luft/Pollen, Herkunftsblatt, Fußzeile, Tagesliste, Sonnenschein, Version): Tasks 9–12, 14.
- Bauteil 4 (Tests, Fixture, neue Suite, smoke-push-Prüfungen): Tasks 1–3, 5, 6, 8, 13.
- Bauteil 5 (Doku): Tasks 4, 14.
- Sichtprüfungen mit dem User nach Task 8 und Task 12; Deploy nach Task 5 auf Zuruf; Probenachricht nach Task 13.
- Offen für den User bleiben: Entscheidung zur Pages-Web-App nach dem Store-Start (nur `ALLOWED_ORIGINS`) und ob Teil 3 (Luft/Pollen für Deutschland) kommt.
