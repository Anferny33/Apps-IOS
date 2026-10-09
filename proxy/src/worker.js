import { sendWebPush } from "./webpush.js";

/* NINA-Proxy und Regen-Alarm für die Wetter-App (Cloudflare Worker).
 *
 * Die Warn-API des Bundes (warnung.bund.de, Bundesamt für Bevölkerungsschutz)
 * liefert Katastrophen-, Hochwasser- und Polizeimeldungen, sendet aber keine
 * CORS-Header. Dieser Worker holt die Meldungen eines Landkreises, hängt die
 * Detailtexte an, bereinigt das HTML und liefert eine kompakte Liste mit
 * CORS-Freigabe für die Web-App aus.
 *
 *   GET /nina?lat=48.137&lon=11.575   Meldungen für einen Punkt: der Kreis wird über
 *                                     den BKG-Dienst (Verwaltungsgebiete 1:250 000,
 *                                     dl-de/by-2-0) ermittelt
 *   GET /nina/<ARS>                   ARS = 12-stelliger Amtlicher Regionalschlüssel
 *                                     des Kreises (Stellen 6–12 Nullen), z. B. 091620000000
 *   GET /health                       Lebenszeichen
 *   POST /push/subscribe              Push-Abonnement mit Ort anlegen oder aktualisieren (KV SUBS)
 *   POST /push/unsubscribe            Push-Abonnement löschen
 *   POST /push/test                   Probenachricht an ein Abonnement (höchstens alle fünf Minuten)
 *   Cron alle 15 Minuten              Regen-Alarm: Vorhersage je Abonnement prüfen, Nachricht senden
 *
 * Meldungen werden 2 Minuten, die Kreiszuordnung eines Punkts 1 Tag am Edge gecacht.
 */

const UPSTREAM = "https://warnung.bund.de/api31";
const BKG_WFS = "https://sgx.geodatenzentrum.de/wfs_vg250";
const CACHE_SECONDS = 120;
const KREIS_CACHE_SECONDS = 86400;
const MAX_DETAILS = 12;

/* Erlaubte Aufrufer: die veröffentlichte App und lokale Entwicklung */
const ALLOWED_ORIGINS = [
    "https://anferny33.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
];

const LEVELS = { Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 };

const PROVIDER_LABEL = {
    MOWAS: "Katastrophenschutz",
    KATWARN: "Katwarn",
    BIWAPP: "Biwapp",
    LHP: "Hochwasser",
    POLICE: "Polizei",
    DWD: "Deutscher Wetterdienst"
};

const PUSH_PREFIX = "sub:";
const PUSH_QUIET_MS = 3 * 3600000;          /* Sperrfrist zwischen zwei Nachrichten je Abonnement */
const PUSH_HORIZON = 4;                     /* Viertelstunden nach der aktuellen: Regen innerhalb einer Stunde */
const PUSH_TEST_GAP_MS = 5 * 60000;         /* Abstand zwischen zwei Probenachrichten je Abonnement */

/* Rückmeldungen der Tester (KV-Namespace FEEDBACK) */
const FB_PREFIX = "fb:";
const FB_RATE_PREFIX = "fbrate:";
const FB_TTL_S = 90 * 86400;                /* Einträge verfallen nach 90 Tagen */
const FB_RATE_MAX = 5, FB_RATE_WINDOW_S = 3600;  /* je Kennung höchstens fünf pro Stunde */
const FB_TEXT_MIN = 3, FB_TEXT_MAX = 2000;
const FB_KINDS = ["fehler", "idee", "lob"];
const FB_META = { version: 20, ua: 200, view: 20, lastError: 300, ts: 40 };  /* erlaubte Textfelder mit Höchstlänge */

export default {
    async scheduled(event, env, ctx) { ctx.waitUntil(checkRain(env)); },
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const cors = corsHeaders(request.headers.get("Origin"));

        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
        if (url.pathname === "/push/subscribe" || url.pathname === "/push/unsubscribe") {
            if (request.method !== "POST") return json({ error: "Nur POST" }, 405, cors);
            return pushRoute(url.pathname, request, env, cors);
        }
        if (url.pathname === "/push/test") {
            if (request.method !== "POST") return json({ error: "Nur POST" }, 405, cors);
            return pushTest(request, env, cors);
        }
        if (url.pathname === "/feedback") {
            if (request.method === "POST") return feedbackPost(request, env, cors);
            if (request.method === "GET") return feedbackList(request, url, env, cors);
            return json({ error: "Nur GET oder POST" }, 405, cors);
        }
        if (url.pathname === "/feedback/ack") {
            if (request.method !== "POST") return json({ error: "Nur POST" }, 405, cors);
            return feedbackAck(request, env, cors);
        }
        if (request.method !== "GET") return json({ error: "Nur GET" }, 405, cors);

        if (url.pathname === "/health") return json({ ok: true, time: new Date().toISOString() }, 200, cors);

        const cache = caches.default;
        let ars = null, kreis = null;

        const m = url.pathname.match(/^\/nina\/(\d{12})$/);
        if (m) {
            ars = m[1];
        } else if (url.pathname === "/nina") {
            const lat = parseFloat(url.searchParams.get("lat")), lon = parseFloat(url.searchParams.get("lon"));
            if (!isFinite(lat) || !isFinite(lon) || lat < 47 || lat > 56 || lon < 5 || lon > 16) {
                return json({ ars: null, kreis: null, warnings: [], note: "außerhalb Deutschlands" }, 200, cors);
            }
            try {
                kreis = await resolveKreis(lat, lon, cache, ctx);
            } catch (e) {
                return json({ error: "Kreiszuordnung fehlgeschlagen: " + (e && e.message ? e.message : String(e)) }, 502, cors);
            }
            if (!kreis) return json({ ars: null, kreis: null, warnings: [], note: "kein Kreis gefunden" }, 200, cors);
            ars = kreis.ars;
        } else {
            return json({ error: "Pfad: /nina?lat=..&lon=.. oder /nina/<12-stelliger Regionalschlüssel>" }, 404, cors);
        }

        const cacheKey = new Request(url.origin + "/nina/" + ars, { method: "GET" });
        let res = await cache.match(cacheKey);
        if (!res) {
            let body, status = 200;
            try {
                body = await loadNina(ars);
            } catch (e) {
                body = { error: "NINA nicht erreichbar: " + (e && e.message ? e.message : String(e)) };
                status = 502;
            }
            res = json(body, status, { "Cache-Control": "public, max-age=" + (status === 200 ? CACHE_SECONDS : 20) });
            ctx.waitUntil(cache.put(cacheKey, res.clone()));
        }
        if (kreis) {
            /* Kreisname mitliefern, ohne den per ARS gecachten Antwortkörper zu verändern */
            const body = await res.clone().json();
            body.kreis = kreis.name;
            res = json(body, res.status, { "Cache-Control": res.headers.get("Cache-Control") || "" });
        }
        const headers = new Headers(res.headers);
        Object.keys(cors).forEach(function (k) { headers.set(k, cors[k]); });
        return new Response(res.body, { status: res.status, headers: headers });
    }
};

function corsHeaders(origin) {
    const allowed = origin && ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : ALLOWED_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
    };
}

function json(data, status, extra) {
    const headers = Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extra || {});
    return new Response(JSON.stringify(data), { status: status || 200, headers: headers });
}

async function getJson(path) {
    const res = await fetch(UPSTREAM + path, { headers: { "Accept": "application/json", "User-Agent": "wetter-app-nina-proxy" } });
    if (!res.ok) throw new Error("HTTP " + res.status + " bei " + path);
    return res.json();
}

/* Punkt → Kreis (ARS, Name) über den BKG-WFS; die Zuordnung ändert sich praktisch nie */
async function resolveKreis(lat, lon, cache, ctx) {
    const key = new Request("https://kreis.cache.local/" + lat.toFixed(3) + "," + lon.toFixed(3), { method: "GET" });
    const hit = await cache.match(key);
    if (hit) return hit.json();
    const params = new URLSearchParams({
        service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: "vg250:vg250_krs",
        outputFormat: "application/json", propertyName: "ars,gen,bez",
        /* EWKT mit SRID: Längengrad zuerst */
        CQL_FILTER: "INTERSECTS(geom,SRID=4326;POINT(" + lon + " " + lat + "))"
    });
    const res = await fetch(BKG_WFS + "?" + params.toString(), { headers: { "User-Agent": "wetter-app-nina-proxy" } });
    if (!res.ok) throw new Error("BKG HTTP " + res.status);
    const data = await res.json();
    const f = data && Array.isArray(data.features) && data.features[0];
    const p = f && f.properties;
    const result = p && p.ars ? { ars: String(p.ars).padEnd(12, "0"), name: (p.bez ? p.bez + " " : "") + (p.gen || "") } : null;
    ctx.waitUntil(cache.put(key, json(result, 200, { "Cache-Control": "public, max-age=" + KREIS_CACHE_SECONDS })));
    return result;
}

/* Dashboard des Kreises holen und jede Meldung um ihre Details ergänzen */
async function loadNina(ars) {
    const list = await getJson("/dashboard/" + ars + ".json");
    const items = Array.isArray(list) ? list : [];
    const picked = items.slice(0, MAX_DETAILS);
    const details = await Promise.all(picked.map(function (it) {
        return getJson("/warnings/" + encodeURIComponent(it.id) + ".json").catch(function () { return null; });
    }));
    const warnings = picked.map(function (it, i) { return normalize(it, details[i]); })
        .filter(function (w) { return w && w.msgType !== "Cancel"; });
    warnings.sort(function (a, b) { return b.level - a.level || String(b.sent).localeCompare(String(a.sent)); });
    return { ars: ars, fetchedAt: new Date().toISOString(), source: "warnung.bund.de", warnings: warnings };
}

function normalize(item, detail) {
    const data = item && item.payload && item.payload.data ? item.payload.data : {};
    const info = detail && Array.isArray(detail.info) ? (detail.info.find(function (i) { return i.language === "de-DE" || i.language === "de"; }) || detail.info[0]) : null;
    const provider = String(data.provider || "").toUpperCase();
    const severity = (info && info.severity) || data.severity || "Minor";
    const title = (item.i18nTitle && item.i18nTitle.de) || data.headline || (info && info.headline) || "Amtliche Meldung";
    const areas = info && Array.isArray(info.area) ? info.area.map(function (a) { return a.areaDesc; }).filter(Boolean) : [];
    return {
        id: item.id,
        provider: provider,
        providerLabel: PROVIDER_LABEL[provider] || provider || "Amtliche Meldung",
        level: LEVELS[severity] || 1,
        severity: severity,
        msgType: data.msgType || (detail && detail.msgType) || "Alert",
        event: info && info.event ? info.event : "",
        headline: cleanText(title),
        description: cleanText(info && info.description),
        instruction: cleanText(info && info.instruction),
        sent: item.sent || (detail && detail.sent) || null,
        onset: info && info.onset ? info.onset : null,
        expires: info && info.expires ? info.expires : null,
        web: info && info.web ? info.web : null,
        area: areas.join(", ")
    };
}

/* HTML-Fragmente aus NINA in Klartext mit Zeilenumbrüchen wandeln */
function cleanText(s) {
    if (!s) return "";
    return String(s)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/* ------------------------------------------------------------------ *
 * Regen-Alarm: Abonnements in KV, Prüfung per Cron, Web Push ohne Bibliothek
 * ------------------------------------------------------------------ */

async function subId(endpoint) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
    return PUSH_PREFIX + Array.from(new Uint8Array(digest)).slice(0, 16).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

function validSubscription(sub) {
    return sub && typeof sub.endpoint === "string" && /^https:\/\//.test(sub.endpoint) && sub.keys &&
        typeof sub.keys.p256dh === "string" && sub.keys.p256dh.length > 80 && typeof sub.keys.auth === "string" && sub.keys.auth.length > 10;
}

async function pushRoute(pathname, request, env, cors) {
    if (!env.SUBS) return json({ error: "Kein KV-Speicher gebunden" }, 500, cors);
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "JSON erwartet" }, 400, cors); }
    if (pathname === "/push/unsubscribe") {
        if (!body || typeof body.endpoint !== "string") return json({ error: "endpoint fehlt" }, 400, cors);
        await env.SUBS.delete(await subId(body.endpoint));
        return json({ ok: true }, 200, cors);
    }
    const sub = body && body.subscription, lat = Number(body && body.lat), lon = Number(body && body.lon);
    if (!validSubscription(sub) || !isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ error: "Abonnement oder Ort ungültig" }, 400, cors);
    const id = await subId(sub.endpoint);
    let prev = null;
    try { prev = JSON.parse(await env.SUBS.get(id)); } catch (e) { prev = null; }
    const entry = {
        endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000,
        name: typeof body.name === "string" ? body.name.slice(0, 80) : "",
        since: prev && prev.since ? prev.since : new Date().toISOString(),
        lastSent: prev && prev.lastSent ? prev.lastSent : 0
    };
    await env.SUBS.put(id, JSON.stringify(entry));
    return json({ ok: true }, 200, cors);
}

/* Probenachricht: zeigt, dass Abonnement, Schlüssel und Zustellung zusammenpassen. Der Aufrufer
   nennt seinen Endpunkt (nur die App kennt ihn); je Abonnement höchstens alle fünf Minuten. */
async function pushTest(request, env, cors) {
    if (!env.SUBS) return json({ error: "Kein KV-Speicher gebunden" }, 500, cors);
    if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return json({ error: "VAPID-Schlüssel fehlen im Worker" }, 500, cors);
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "JSON erwartet" }, 400, cors); }
    if (!body || typeof body.endpoint !== "string") return json({ error: "endpoint fehlt" }, 400, cors);
    const id = await subId(body.endpoint);
    let sub = null;
    try { sub = JSON.parse(await env.SUBS.get(id)); } catch (e) { sub = null; }
    if (!sub) return json({ error: "Abonnement unbekannt. Bitte den Regen-Alarm aus- und wieder einschalten." }, 404, cors);
    const now = Date.now();
    if (sub.lastTest && now - sub.lastTest < PUSH_TEST_GAP_MS) return json({ error: "Bitte kurz warten, die letzte Probenachricht ist keine fünf Minuten her." }, 429, cors);
    const payload = JSON.stringify({
        title: "Probenachricht",
        body: (sub.name ? sub.name + ": " : "") + "Der Regen-Alarm ist eingerichtet. So sieht eine Warnung aus.",
        url: "./"
    });
    let status;
    try {
        status = await sendWebPush({ endpoint: sub.endpoint, keys: sub.keys }, payload, {
            publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || "mailto:wetter@example.org", ttl: 600, fetch: env.__fetch
        });
    } catch (e) { return json({ error: "Versand fehlgeschlagen: " + (e && e.message ? e.message : String(e)) }, 502, cors); }
    if (status === 404 || status === 410) {
        await env.SUBS.delete(id);
        return json({ error: "Der Push-Dienst kennt das Abonnement nicht mehr. Bitte den Regen-Alarm aus- und wieder einschalten." }, 410, cors);
    }
    sub.lastTest = now;
    await env.SUBS.put(id, JSON.stringify(sub));
    const ok = status >= 200 && status < 300;
    return json(ok ? { ok: true, status: status } : { error: "Der Push-Dienst hat abgelehnt (HTTP " + status + ")." }, ok ? 200 : 502, cors);
}

/* Regel: jetzt trocken, in den nächsten vier Viertelstunden beginnt Regen (mindestens 0,1 mm).
   Liefert Beginn (Uhrzeit) und Menge der Stunde ab Beginn, sonst null. */
export function rainAlert(m15, wallNowMs) {
    if (!m15 || !Array.isArray(m15.time) || !Array.isArray(m15.precipitation)) return null;
    const vals = m15.precipitation.map(function (v) { return typeof v === "number" && isFinite(v) ? v : 0; });
    /* Zeiten sind Ortszeit ohne Zone; sie werden wie UTC gelesen und mit der Ortszeit „jetzt“ (ebenso gelesen) verglichen */
    let cur = -1;
    for (let i = 0; i < m15.time.length; i++) if (Date.parse(m15.time[i] + "Z") <= wallNowMs) cur = i;
    if (cur < 0) cur = 0;
    if (vals[cur] >= 0.1) return null;
    for (let i = cur + 1; i <= cur + PUSH_HORIZON && i < vals.length; i++) {
        if (vals[i] >= 0.1) {
            let mm = 0;
            for (let j = i; j < i + 4 && j < vals.length; j++) mm += vals[j];
            return { at: m15.time[i].slice(11, 16), mm: (Math.round(mm * 10) / 10).toFixed(1).replace(".", ",") };
        }
    }
    return null;
}

/* Alle Abonnements prüfen; deps.fetch und deps.now für Tests austauschbar */
export async function checkRain(env, deps) {
    const f = (deps && deps.fetch) || fetch, now = (deps && deps.now) || Date.now();
    const out = { checked: 0, sent: 0, removed: 0, errors: 0 };
    if (!env.SUBS || !env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return out;
    const list = await env.SUBS.list({ prefix: PUSH_PREFIX });
    for (const key of list.keys) {
        let sub;
        try { sub = JSON.parse(await env.SUBS.get(key.name)); } catch (e) { sub = null; }
        if (!sub) continue;
        out.checked++;
        if (now - (sub.lastSent || 0) < PUSH_QUIET_MS) continue;
        try {
            const res = await f("https://api.open-meteo.com/v1/forecast?latitude=" + sub.lat + "&longitude=" + sub.lon + "&minutely_15=precipitation&forecast_minutely_15=8&timezone=auto");
            if (!res.ok) { out.errors++; continue; }
            const data = await res.json();
            /* Ortszeit „jetzt“ aus dem UTC-Versatz der Antwort, gelesen wie die Zeitstempel der Vorhersage */
            const wallNow = now + (typeof data.utc_offset_seconds === "number" ? data.utc_offset_seconds * 1000 : 0);
            const alert = rainAlert(data.minutely_15, wallNow);
            if (!alert) continue;
            const place = sub.name ? sub.name : "Dein Ort";
            const payload = JSON.stringify({
                title: "Regen ab " + alert.at + " Uhr",
                body: place + ": gegen " + alert.at + " Uhr fängt es an zu regnen, etwa " + alert.mm + " mm in der nächsten Stunde.",
                url: "./"
            });
            const status = await sendWebPush({ endpoint: sub.endpoint, keys: sub.keys }, payload, {
                publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || "mailto:wetter@example.org", ttl: 3600, fetch: f
            });
            if (status === 404 || status === 410) { await env.SUBS.delete(key.name); out.removed++; continue; }
            if (status >= 200 && status < 300) {
                out.sent++;
                sub.lastSent = now;
                await env.SUBS.put(key.name, JSON.stringify(sub));
            } else out.errors++;
        } catch (e) { out.errors++; }
    }
    return out;
}


/* ------------------------------------------------------------------ *
 * Rückmeldungen der Tester: Ablage im KV-Namespace FEEDBACK, Lesen und Markieren nur mit
 * dem Geheimnis FEEDBACK_TOKEN (Authorization: Bearer …). Kein Ort, keine IP-Adresse.
 * ------------------------------------------------------------------ */
function clip(v, n) { return typeof v === "string" ? v.trim().slice(0, n) : ""; }

/* Eingabe prüfen und kürzen; null, wenn Text oder Kennung fehlen */
export function cleanFeedback(body, nowMs) {
    if (!body || typeof body !== "object") return null;
    const text = clip(body.text, FB_TEXT_MAX);
    const install = typeof body.id === "string" && /^[a-z0-9]{8,40}$/.test(body.id) ? body.id : "";
    if (text.length < FB_TEXT_MIN || !install) return null;
    const m = body.meta && typeof body.meta === "object" ? body.meta : {};
    const meta = {};
    Object.keys(FB_META).forEach(function (k) { if (typeof m[k] === "string") meta[k] = clip(m[k], FB_META[k]); });
    if (typeof m.width === "number" && isFinite(m.width)) meta.width = Math.max(0, Math.min(10000, Math.round(m.width)));
    if (typeof m.font === "number" && isFinite(m.font)) meta.font = Math.max(0.5, Math.min(3, Math.round(m.font * 100) / 100));
    if (typeof m.standalone === "boolean") meta.standalone = m.standalone;
    const ms = nowMs || Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    return {
        id: FB_PREFIX + String(ms).padStart(13, "0") + "-" + rand,
        at: new Date(ms).toISOString(),
        kind: FB_KINDS.indexOf(body.kind) >= 0 ? body.kind : "idee",
        text: text, name: clip(body.name, 40), install: install.slice(0, 8),
        meta: meta, read: false, exp: Math.floor(ms / 1000) + FB_TTL_S
    };
}

async function feedbackPost(request, env, cors) {
    if (!env.FEEDBACK) return json({ error: "Kein KV-Speicher gebunden" }, 500, cors);
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "JSON erwartet" }, 400, cors); }
    const entry = cleanFeedback(body);
    if (!entry) return json({ error: "Text (mindestens 3 Zeichen) oder Kennung fehlt" }, 400, cors);
    const rateKey = FB_RATE_PREFIX + body.id;
    let rate = null;
    try { rate = JSON.parse(await env.FEEDBACK.get(rateKey)); } catch (e) { rate = null; }
    const now = Date.now();
    if (!rate || !rate.since || now - rate.since > FB_RATE_WINDOW_S * 1000) rate = { n: 0, since: now };
    if (rate.n >= FB_RATE_MAX) return json({ error: "Höchstens " + FB_RATE_MAX + " Rückmeldungen pro Stunde" }, 429, cors);
    rate.n++;
    await env.FEEDBACK.put(rateKey, JSON.stringify(rate), { expirationTtl: FB_RATE_WINDOW_S });
    await env.FEEDBACK.put(entry.id, JSON.stringify(entry), { expirationTtl: FB_TTL_S });
    return json({ ok: true, id: entry.id }, 200, cors);
}

function feedbackAuthorized(request, env) {
    const h = request.headers.get("Authorization") || "";
    const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
    return !!env.FEEDBACK_TOKEN && token.length > 0 && token === String(env.FEEDBACK_TOKEN).trim();
}

async function feedbackList(request, url, env, cors) {
    if (!env.FEEDBACK) return json({ error: "Kein KV-Speicher gebunden" }, 500, cors);
    if (!feedbackAuthorized(request, env)) return json({ error: "Nicht erlaubt" }, 401, cors);
    const all = url.searchParams.get("all") === "1";
    const list = await env.FEEDBACK.list({ prefix: FB_PREFIX });
    const items = [];
    for (const key of list.keys) {
        let e = null;
        try { e = JSON.parse(await env.FEEDBACK.get(key.name)); } catch (err) { e = null; }
        if (e && (all || !e.read)) items.push(e);
    }
    return json({ count: items.length, items: items }, 200, cors);
}

async function feedbackAck(request, env, cors) {
    if (!env.FEEDBACK) return json({ error: "Kein KV-Speicher gebunden" }, 500, cors);
    if (!feedbackAuthorized(request, env)) return json({ error: "Nicht erlaubt" }, 401, cors);
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "JSON erwartet" }, 400, cors); }
    const ids = body && Array.isArray(body.ids) ? body.ids.filter(function (x) { return typeof x === "string" && x.startsWith(FB_PREFIX); }) : [];
    const nowS = Math.floor(Date.now() / 1000);
    let acked = 0;
    for (const id of ids) {
        let e = null;
        try { e = JSON.parse(await env.FEEDBACK.get(id)); } catch (err) { e = null; }
        if (!e) continue;
        e.read = true;
        await env.FEEDBACK.put(id, JSON.stringify(e), { expirationTtl: Math.max(60, (e.exp || nowS + FB_TTL_S) - nowS) });
        acked++;
    }
    return json({ ok: true, acked: acked }, 200, cors);
}
