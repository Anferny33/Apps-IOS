/* Datenschicht der Wetter-App: API-Aufrufe, Helfer, Cache und Standortspeicher.
 * Genutzt von index.html (design.js); die Darstellung liegt dort.
 *
 * Datenquellen (alle ohne API-Schlüssel):
 *   Open-Meteo Forecast      – Aktuell, 15-min-Nowcast, 48 h, 14 Tage, Sonne/Wind/UV
 *   Open-Meteo Ensemble      – ICON-D2-EPS (20 Läufe) für die Regenwahrscheinlichkeit
 *   Open-Meteo Multi-Modell  – Niederschlagsvergleich mehrerer Wettermodelle
 *   Open-Meteo Air Quality   – Europäischer Luftqualitätsindex, Feinstaub, Pollen
 *   Open-Meteo Geocoding     – Ortssuche (Fallback ohne GPS)
 *   BigDataCloud             – Ortsname zur GPS-Position
 */
"use strict";

/* ------------------------------------------------------------------ *
 * Konstanten
 * ------------------------------------------------------------------ */

const CACHE_PREFIX = "wetter:";
const POS_KEY = CACHE_PREFIX + "pos";

const MODELS = [
    { id: "icon_d2",                   name: "ICON-D2",   sub: "DWD · 2,2 km" },
    { id: "icon_eu",                   name: "ICON-EU",   sub: "DWD · 7 km" },
    { id: "ecmwf_ifs025",              name: "ECMWF IFS", sub: "0,25°" },
    { id: "meteofrance_arpege_europe", name: "ARPEGE",    sub: "Météo-France · 11 km" },
    { id: "ukmo_seamless",             name: "UKMO",      sub: "Met Office" },
    { id: "gfs_seamless",              name: "GFS",       sub: "NOAA" }
];

/* Validierte Chartfarben (dunkle Fläche #12233f) */
const WMO = {
    0:["☀️","klar"],1:["🌤️","überwiegend klar"],2:["⛅","wolkig"],3:["☁️","bedeckt"],
    45:["🌫️","Nebel"],48:["🌫️","gefrierender Nebel"],
    51:["🌦️","leichter Nieselregen"],53:["🌦️","Nieselregen"],55:["🌧️","starker Nieselregen"],
    56:["🌧️","gefrierender Niesel"],57:["🌧️","gefrierender Niesel"],
    61:["🌦️","leichter Regen"],63:["🌧️","Regen"],65:["🌧️","starker Regen"],
    66:["🌧️","gefrierender Regen"],67:["🌧️","gefrierender Regen"],
    71:["🌨️","leichter Schneefall"],73:["🌨️","Schneefall"],75:["❄️","starker Schneefall"],77:["❄️","Schneegriesel"],
    80:["🌦️","leichte Schauer"],81:["🌧️","Schauer"],82:["⛈️","kräftige Schauer"],
    85:["🌨️","Schneeschauer"],86:["🌨️","starke Schneeschauer"],
    95:["⛈️","Gewitter"],96:["⛈️","Gewitter mit Hagel"],99:["⛈️","schweres Gewitter mit Hagel"]
};

function wmo(code) { return WMO[code] || ["🌥️", "–"]; }

const POLLEN = [
    { key: "birch_pollen",   name: "Birke",     thr: [10, 50, 100] },
    { key: "grass_pollen",   name: "Gräser",    thr: [5, 20, 50] },
    { key: "alder_pollen",   name: "Erle",      thr: [10, 50, 100] },
    { key: "mugwort_pollen", name: "Beifuß",    thr: [3, 10, 30] },
    { key: "ragweed_pollen", name: "Ambrosia",  thr: [3, 10, 30] },
    { key: "olive_pollen",   name: "Olive",     thr: [10, 50, 100] }
];

/* ------------------------------------------------------------------ *
 * API-Aufrufe
 * ------------------------------------------------------------------ */

function buildUrl(base, params) {
    return base + "?" + new URLSearchParams(params).toString();
}

async function getJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.reason || "API-Fehler");
    return data;
}

/* Der Vortag kommt mit (past_days) und wird in splitPastDay als fc.past abgetrennt,
   damit Tag 0 und Stunde 0 überall „heute“ bleiben. */
function fetchForecast(loc) {
    return getJson(buildUrl("https://api.open-meteo.com/v1/forecast", {
        latitude: loc.lat,
        longitude: loc.lon,
        timezone: "auto",
        forecast_days: 14,
        past_days: 1,
        current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,cloud_cover,is_day",
        minutely_15: "precipitation",
        hourly: "temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,cloud_cover,cloud_cover_low,cloud_cover_high,visibility,dew_point_2m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset,daylight_duration,sunshine_duration"
    })).then(splitPastDay);
}

/* Alles vor dem heutigen Datum (Ortszeit aus current.time) wandert aus hourly, minutely_15 und
   daily nach fc.past; die drei Blöcke beginnen danach wieder mit heute. Grenze ist das Datum,
   nicht eine Anzahl Werte: Tage mit Zeitumstellung haben 23 oder 25 Stunden. Antworten ohne
   Vortag (alte gespeicherte Daten) bleiben unverändert und bekommen kein past. */
function splitPastDay(fc) {
    if (!fc || !fc.current || typeof fc.current.time !== "string") return fc;
    const today = fc.current.time.slice(0, 10);
    const cut = function (block) {
        if (!block || !Array.isArray(block.time)) return null;
        const n = firstIndexFrom(block.time, today);
        if (n <= 0) return null;
        const past = {};
        Object.keys(block).forEach(function (k) {
            if (!Array.isArray(block[k])) return;
            past[k] = block[k].slice(0, n);
            block[k] = block[k].slice(n);
        });
        return past;
    };
    const past = { hourly: cut(fc.hourly), minutely_15: cut(fc.minutely_15), daily: cut(fc.daily) };
    if (past.hourly || past.minutely_15 || past.daily) fc.past = past;
    return fc;
}

/* Metadaten des ICON-D2-Laufs (Open-Meteo): Zeitpunkt des letzten Laufs und seiner Verfügbarkeit,
   Laufabstand; alles in Sekunden. Nur für das Herkunftsblatt, ein Fehler blendet dort die Zeile aus. */
function fetchModelMeta() {
    return getJson("https://api.open-meteo.com/data/dwd_icon_d2/static/meta.json").then(function (m) {
        return { run: m.last_run_initialisation_time, available: m.last_run_availability_time, interval: m.update_interval_seconds };
    });
}

/* ICON-D2-EPS: 20 Ensemble-Läufe. Daraus wird die Regenwahrscheinlichkeit
   direkt ausgezählt – das ist ehrlicher als ein einzelner Modelllauf. */
function fetchEnsemble(loc) {
    return getJson(buildUrl("https://ensemble-api.open-meteo.com/v1/ensemble", {
        latitude: loc.lat,
        longitude: loc.lon,
        timezone: "auto",
        forecast_days: 2,
        models: "icon_d2_eps",
        hourly: "precipitation"
    }));
}

function fetchModels(loc) {
    return getJson(buildUrl("https://api.open-meteo.com/v1/forecast", {
        latitude: loc.lat,
        longitude: loc.lon,
        timezone: "auto",
        forecast_days: 3,
        models: MODELS.map(function (m) { return m.id; }).join(","),
        daily: "precipitation_sum,temperature_2m_max",
        hourly: "precipitation"
    }));
}

function fetchAir(loc) {
    const pollen = POLLEN.map(function (p) { return p.key; }).join(",");
    return getJson(buildUrl("https://air-quality-api.open-meteo.com/v1/air-quality", {
        latitude: loc.lat,
        longitude: loc.lon,
        timezone: "auto",
        forecast_days: 1,
        current: "european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone," + pollen,
        hourly: pollen
    }));
}

/* Amtliche Wetterwarnungen des DWD für einen Punkt (GeoServer WFS, CC BY 4.0).
   Liefert die aktiven Warnungen der Gemeinde, höchste Stufe zuerst. */
const WARN_LEVELS = { Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 };

function fetchWarnings(loc) {
    const url = buildUrl("https://maps.dwd.de/geoserver/dwd/ows", {
        service: "WFS", version: "2.0.0", request: "GetFeature",
        typeName: "dwd:Warnungen_Gemeinden", outputFormat: "application/json",
        /* WFS 2.0 mit EPSG:4326: Achsenreihenfolge im Filter ist Breite, Länge */
        CQL_FILTER: "INTERSECTS(THE_GEOM,POINT(" + loc.lat + " " + loc.lon + "))"
    });
    return getJson(url).then(function (data) { return normalizeWarnings(data); });
}

function normalizeWarnings(data, now) {
    const feats = data && Array.isArray(data.features) ? data.features : [];
    const t = now ? new Date(now).getTime() : Date.now();
    const seen = {};
    const out = [];
    feats.forEach(function (f) {
        const p = f.properties || {};
        if (p.MSGTYPE === "Cancel" || p.STATUS === "Test") return;
        if (p.EXPIRES && new Date(p.EXPIRES).getTime() < t) return;
        const key = p.IDENTIFIER || (p.EVENT + "|" + p.ONSET);
        if (seen[key]) return;
        seen[key] = true;
        out.push({
            id: p.IDENTIFIER || null,
            level: WARN_LEVELS[p.SEVERITY] || 1,
            severity: p.SEVERITY || "Minor",
            event: p.EVENT || "",
            headline: p.HEADLINE || p.EVENT || "Amtliche Warnung",
            description: p.DESCRIPTION || "",
            instruction: p.INSTRUCTION || "",
            onset: p.ONSET || null,
            expires: p.EXPIRES || null,
            area: p.NAME || "",
            upcoming: !!(p.ONSET && new Date(p.ONSET).getTime() > t)
        });
    });
    out.sort(function (a, b) { return b.level - a.level || String(a.onset || "").localeCompare(String(b.onset || "")); });
    return out;
}

/* Meldungen des Bevölkerungsschutzes (NINA / warnung.bund.de) über den eigenen
   Cloudflare-Worker in proxy/, der die fehlenden CORS-Header ergänzt und den
   Kreis zum Punkt ermittelt. Leer gelassen = Funktion aus. */
const NINA_PROXY = (typeof window !== "undefined" && window.NINA_PROXY) || "https://wetter-nina-proxy.anferny-wetter.workers.dev";

function fetchNina(loc) {
    if (!NINA_PROXY) return Promise.resolve([]);
    return getJson(NINA_PROXY + "/nina?lat=" + loc.lat + "&lon=" + loc.lon).then(function (data) { return normalizeNina(data); });
}

function normalizeNina(data) {
    const list = data && Array.isArray(data.warnings) ? data.warnings : [];
    return list.filter(function (w) {
        /* DWD-Warnungen kommen direkt vom DWD (mit Gemeindegenauigkeit), nicht doppelt über NINA */
        return w && w.provider !== "DWD" && w.msgType !== "Cancel";
    }).map(function (w) {
        return {
            id: w.id || null,
            source: "nina",
            provider: w.provider || "",
            providerLabel: w.providerLabel || "Amtliche Meldung",
            level: Math.max(1, Math.min(4, parseInt(w.level, 10) || 1)),
            severity: w.severity || "Minor",
            event: w.event || "",
            headline: w.headline || "Amtliche Meldung",
            description: w.description || "",
            instruction: w.instruction || "",
            sent: w.sent || null,
            onset: w.onset || null,
            expires: w.expires || null,
            area: w.area || "",
            upcoming: false
        };
    });
}

/* Ortsname – für Browser-Clients gedacht, ohne Schlüssel */
async function fetchPlace(lat, lon) {
    try {
        const d = await getJson(buildUrl("https://api.bigdatacloud.net/data/reverse-geocode-client", {
            latitude: lat, longitude: lon, localityLanguage: "de"
        }));
        const parts = [d.city || d.locality, d.principalSubdivision || d.countryName]
            .filter(function (x) { return x; });
        return parts.length ? parts.join(", ") : null;
    } catch (e) { return null; }
}

async function searchPlaces(query) {
    const d = await getJson(buildUrl("https://geocoding-api.open-meteo.com/v1/search", {
        name: query, count: 6, language: "de", format: "json"
    }));
    return (d.results || []).map(function (r) {
        return {
            name: r.name + (r.admin1 ? ", " + r.admin1 : "") + (r.country ? " · " + r.country : ""),
            lat: r.latitude, lon: r.longitude
        };
    });
}

/* ------------------------------------------------------------------ *
 * Hilfsfunktionen
 * ------------------------------------------------------------------ */

/* Open-Meteo liefert Zeitstempel bereits in Ortszeit ("2026-09-25T14:00").
   Deshalb wird bewusst mit Strings gearbeitet – keine Zeitzonenfallen. */
/* Beginn eines 15-Minuten-Intervalls: Open-Meteo stempelt jeden Wert mit dem
   Intervall-ENDE (der Wert um 15:00 beschreibt 14:45–15:00). */
function intervalStart(t) {
    if (!t || t.length < 16) return t;
    const d = new Date(t.slice(0, 10) + "T" + t.slice(11, 16) + ":00");
    if (isNaN(d.getTime())) return t;
    d.setMinutes(d.getMinutes() - 15);
    const p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}

/* Die 16 Intervalle der nächsten vier Stunden: alle, die NACH der aktuellen Zeit enden.
   Liefert Index des ersten davon oder -1. */
function nowcastStartIndex(times, currentTime) {
    const now = String(currentTime || "").slice(0, 16);
    let i = firstIndexFrom(times, now);
    if (i < 0) return -1;
    if (String(times[i]).slice(0, 16) === now) i++;
    return i < times.length ? i : -1;
}

function firstIndexFrom(times, from) {
    for (let i = 0; i < times.length; i++) {
        if (times[i] >= from) return i;
    }
    return -1;
}

function hhmm(t) { return t ? t.slice(11, 16) : "–"; }
function dayOf(t) { return t.slice(0, 10); }

function fmtMm(v) {
    if (v === null || v === undefined || isNaN(v)) return "–";
    if (v < 0.05) return "0";
    return (v < 10 ? v.toFixed(1) : Math.round(v).toString()).replace(".", ",");
}

function fmtNum(v, digits) {
    if (typeof v !== "number" || isNaN(v)) return "–";
    return v.toFixed(digits || 0).replace(".", ",");
}

function fmtDuration(sec) {
    if (typeof sec !== "number" || isNaN(sec)) return "–";
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h + " h " + (m < 10 ? "0" : "") + m + " min";
}

function weekday(dateStr) {
    const names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const p = dateStr.split("-");
    const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return names[d.getUTCDay()];
}

function compass(deg) {
    if (typeof deg !== "number" || isNaN(deg)) return "–";
    const names = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
    return names[Math.round(deg / 45) % 8];
}

function quantile(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function distanceKm(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * r / 2) * Math.sin((lat2 - lat1) * r / 2) +
              Math.cos(lat1 * r) * Math.cos(lat2 * r) *
              Math.sin((lon2 - lon1) * r / 2) * Math.sin((lon2 - lon1) * r / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNum(v) { return typeof v === "number" && !isNaN(v); }

/* Status-Stufen: immer Farbe + Symbol + Wort, nie Farbe allein */
function uvLevel(uv) {
    if (!isNum(uv)) return null;
    if (uv < 3) return { word: "niedrig", st: "good", ico: "🟢" };
    if (uv < 6) return { word: "mittel", st: "warning", ico: "🟡" };
    if (uv < 8) return { word: "hoch", st: "serious", ico: "🟠" };
    if (uv < 11) return { word: "sehr hoch", st: "critical", ico: "🔴" };
    return { word: "extrem", st: "critical", ico: "🟣" };
}

function aqiLevel(aqi) {
    if (!isNum(aqi)) return null;
    if (aqi <= 20) return { word: "gut", st: "good", ico: "🟢" };
    if (aqi <= 40) return { word: "mäßig", st: "good", ico: "🟢" };
    if (aqi <= 60) return { word: "mittel", st: "warning", ico: "🟡" };
    if (aqi <= 80) return { word: "schlecht", st: "serious", ico: "🟠" };
    if (aqi <= 100) return { word: "sehr schlecht", st: "critical", ico: "🔴" };
    return { word: "extrem schlecht", st: "critical", ico: "🟣" };
}

function pollenLevel(v, thr) {
    if (!isNum(v)) return null;
    if (v < 1) return { word: "keine", st: "none", ico: "⚪" };
    if (v < thr[0]) return { word: "gering", st: "good", ico: "🟢" };
    if (v < thr[1]) return { word: "mäßig", st: "warning", ico: "🟡" };
    if (v < thr[2]) return { word: "hoch", st: "serious", ico: "🟠" };
    return { word: "sehr hoch", st: "critical", ico: "🔴" };
}

/* Alle Ensemble-Mitglieder einer Stunde einsammeln ("precipitation",
   "precipitation_member01", …). */
function ensembleSeries(hourly) {
    if (!hourly) return [];
    return Object.keys(hourly).filter(function (k) {
        return k === "precipitation" || k.indexOf("precipitation_member") === 0;
    }).map(function (k) { return hourly[k]; }).filter(Array.isArray);
}

function ensembleStats(members, idx) {
    const vals = [];
    for (let i = 0; i < members.length; i++) {
        const v = members[i][idx];
        if (isNum(v)) vals.push(v);
    }
    if (vals.length < 3) return null;
    const wet = vals.filter(function (v) { return v >= 0.1; }).length;
    vals.sort(function (a, b) { return a - b; });
    return {
        n: vals.length,
        wet: wet,
        prob: Math.round(wet / vals.length * 100),
        median: quantile(vals, 0.5),
        max: vals[vals.length - 1],
        p90: quantile(vals, 0.9)
    };
}

/* Fenster der nächsten n Stunden ab der aktuellen Stunde: Indizes in fc.hourly */
function hourlyWindow(fc, hours) {
    const h = fc.hourly;
    const start = Math.max(0, firstIndexFrom(h.time, fc.current.time.slice(0, 13)));
    const end = Math.min(start + hours, h.time.length);
    return { start: start, end: end, slice: function (arr) { return (arr || []).slice(start, end); } };
}

/* ------------------------------------------------------------------ *
 * Laden, Cache, Standort
 * ------------------------------------------------------------------ */

function locId(lat, lon) { return "loc:" + lat.toFixed(2) + "," + lon.toFixed(2); }

function saveCache(loc, payload) {
    try {
        localStorage.setItem(CACHE_PREFIX + loc.id, JSON.stringify({
            savedAt: new Date().toISOString(), payload: payload
        }));
    } catch (e) { /* Speicher voll oder privater Modus – nicht kritisch */ }
}

function loadCache(loc) {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + loc.id);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function savePos(pos) {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch (e) {}
}

function loadPos() {
    try {
        const raw = localStorage.getItem(POS_KEY);
        const p = raw ? JSON.parse(raw) : null;
        return p && isNum(p.lat) && isNum(p.lon) ? p : null;
    } catch (e) { return null; }
}

/* Aktiver Ort (gewählt per Suche oder „Mein Standort“), getrennt vom zuletzt ermittelten GPS-Ort:
   eine Ortssuche überschreibt den GPS-Ort nicht, und Startseite wie Radar zeigen denselben Ort. */
const ACTIVE_KEY = CACHE_PREFIX + "active";

function saveActiveLoc(loc) {
    if (!loc || !isNum(loc.lat) || !isNum(loc.lon)) return;
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify({ lat: loc.lat, lon: loc.lon, name: loc.name || "", source: loc.source === "search" ? "search" : "gps" })); } catch (e) {}
}

function loadActiveLoc() {
    try {
        const raw = localStorage.getItem(ACTIVE_KEY);
        const p = raw ? JSON.parse(raw) : null;
        if (!p || !isNum(p.lat) || !isNum(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return null;
        return { lat: p.lat, lon: p.lon, name: typeof p.name === "string" ? p.name : "", source: p.source === "search" ? "search" : "gps" };
    } catch (e) { return null; }
}

/* Zuletzt gewählte Suchorte (höchstens drei, neuester zuerst): nur Name und Koordinaten, getrennt vom
   aktiven Ort und vom GPS-Ort. Gleiche Koordinaten (auf 0,01° gerundet) gelten als derselbe Ort. */
const RECENT_KEY = CACHE_PREFIX + "recent";
const RECENT_MAX = 3;

function loadRecentPlaces() {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) return [];
        return arr.filter(function (p) {
            return p && typeof p.name === "string" && p.name && isNum(p.lat) && isNum(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
        }).map(function (p) { return { name: p.name, lat: p.lat, lon: p.lon }; }).slice(0, RECENT_MAX);
    } catch (e) { return []; }
}

function saveRecentPlace(loc) {
    if (!loc || !isNum(loc.lat) || !isNum(loc.lon) || !loc.name) return [];
    const id = locId(loc.lat, loc.lon);
    const rest = loadRecentPlaces().filter(function (p) { return locId(p.lat, p.lon) !== id; });
    const list = [{ name: loc.name, lat: loc.lat, lon: loc.lon }].concat(rest).slice(0, RECENT_MAX);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) {}
    return list;
}
