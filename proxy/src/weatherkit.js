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
