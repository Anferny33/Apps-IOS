"use strict";

/* Regenradar: MapLibre GL JS mit eigener Vektorkarte (OpenFreeMap, OpenMapTiles-Schema)
   und dem DWD-Radar (WMS, Layer dwd:Niederschlagsradar = RADOLAN RV: Beobachtung + Nowcast).

   Zeitachse und Grenze Beobachtung/Prognose kommen aus den Produktmetadaten (Capabilities:
   Dimension "time" und Standardwert der Dimension REFERENCE_TIME = jüngster Lauf).

   Wiedergabe: je Zeitpunkt ein einzelnes WMS-Bild für den sichtbaren Ausschnitt, als Blob
   geladen und in einem begrenzten Cache gehalten. Auf der Karte liegen nur zwei Bildebenen
   (A/B), zwischen denen überblendet wird. Ein Zeitpunkt erscheint erst, wenn sein Bild
   vollständig da ist; aktuelle und nachfolgende Bilder werden zuerst geladen. */

const WMS_URL = "https://maps.dwd.de/geoserver/dwd/wms";
const WMS_LAYER = "dwd:Niederschlagsradar";
const CAPS_URL = "https://maps.dwd.de/geoserver/dwd/Niederschlagsradar/ows?service=WMS&version=1.3.0&request=GetCapabilities";
const LEGEND_URL = WMS_URL + "?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&transparent=true&layer=" + WMS_LAYER + "&legend_options=fontColor:0x1E1B2E;fontSize:9;layout:horizontal";
/* Stildefinition des Layers: die tatsächlich dargestellten Klassen (Farbe, Intervall in mm/h) */
const STYLE_URL = WMS_URL + "?service=WMS&version=1.1.1&request=GetStyles&layers=" + WMS_LAYER;
/* OpenFreeMap: freie Vektorkacheln ohne Schlüssel (Daten © OpenStreetMap-Mitwirkende, ODbL) */
const TILE_JSON = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

const PAST_OFFSETS = [-50, -40, -30, -20, -10, 0];        /* Minuten relativ zur letzten Beobachtung */
const FUTURE_OFFSETS = [15, 30, 45, 60, 75, 90, 105, 120];
const RADAR_OPACITY = 0.72;
const PLAY_MS = 700;           /* Abstand zwischen zwei Bildern bei der Wiedergabe */
const FADE_MS = 280;           /* Überblendung A/B */
const CACHE_MAX = 36;          /* Bilder im Cache (Zeitpunkt × Ausschnitt) */
const MAX_PARALLEL = 2;        /* gleichzeitige Bildabrufe */
const RETRY_MS = 20000;        /* fehlgeschlagene Bilder erst nach 20 s erneut versuchen */
const REFRESH_MS = 5 * 60 * 1000;
const REFRESH_MIN_AGE = 60 * 1000;   /* Rückkehr aus dem Hintergrund: nicht öfter als jede Minute neu laden */
const DEFAULT_CENTER = [10.45, 51.16];   /* lon, lat */
const LABEL_LAYER = "place-city";        /* Radar liegt unter den Ortsnamen */
const BLANK_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const COVER_MSG = "Außerhalb der Radarabdeckung. Das DWD-Radar deckt Deutschland und die nähere Umgebung ab; hier gibt es keine Radardaten, das heißt nicht, dass es trocken ist.";

const $ = function (id) { return document.getElementById(id); };
function isNum(v) { return typeof v === "number" && !isNaN(v); }

/* ------------------------------------------------------------------ *
 * Kartenstil: ruhige Vektorkarte in den Farben der App
 * ------------------------------------------------------------------ */

function palette() {
    return { land: "#EEF1EA", green: "#DDE8D3", park: "#D3E3C8", urban: "#E6E3EC", water: "#D4E4F7", waterLine: "#C6DAF2",
             road: "#D2CDDD", roadMinor: "#E0DCE8", border: "#B9B4C8",
             text: "#1E1B2E", textMuted: "#6B6685", halo: "rgba(255,255,255,0.9)", waterText: "#3A4A6B" };
}

function buildStyle() {
    const p = palette();
    const nameDe = ["coalesce", ["get", "name:de"], ["get", "name"]];
    const poly = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
    const line = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
    return {
        version: 8,
        glyphs: GLYPHS,
        sources: { omt: { type: "vector", url: TILE_JSON, attribution: "© <a href=\"https://openmaptiles.org/\">OpenMapTiles</a> © <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>-Mitwirkende" } },
        layers: [
            { id: "bg", type: "background", paint: { "background-color": p.land } },
            { id: "landcover", type: "fill", source: "omt", "source-layer": "landcover",
              filter: ["all", poly, ["match", ["get", "class"], ["wood", "grass", "farmland", "wetland"], true, false]],
              paint: { "fill-color": p.green, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.45, 12, 0.7] } },
            { id: "park", type: "fill", source: "omt", "source-layer": "park", filter: poly, minzoom: 8,
              paint: { "fill-color": p.park, "fill-opacity": 0.5 } },
            { id: "urban", type: "fill", source: "omt", "source-layer": "landuse", minzoom: 7,
              filter: ["all", poly, ["match", ["get", "class"], ["residential", "suburb", "neighbourhood", "commercial", "industrial", "retail"], true, false]],
              paint: { "fill-color": p.urban, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.3, 12, 0.7] } },
            { id: "water", type: "fill", source: "omt", "source-layer": "water",
              filter: ["all", poly, ["!=", ["get", "brunnel"], "tunnel"]],
              paint: { "fill-color": p.water } },
            { id: "waterway", type: "line", source: "omt", "source-layer": "waterway", minzoom: 7,
              filter: ["all", line, ["match", ["get", "class"], ["river", "canal"], true, false]],
              paint: { "line-color": p.waterLine, "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 12, 2.2] } },
            /* Nur die wichtigen Straßen, feinere erst beim Hineinzoomen */
            { id: "road-major", type: "line", source: "omt", "source-layer": "transportation", minzoom: 7,
              filter: ["all", line, ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false], ["!=", ["get", "brunnel"], "tunnel"]],
              paint: { "line-color": p.road, "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 10, 1.3, 13, 2.6] } },
            { id: "road-minor", type: "line", source: "omt", "source-layer": "transportation", minzoom: 10,
              filter: ["all", line, ["match", ["get", "class"], ["secondary", "tertiary"], true, false], ["!=", ["get", "brunnel"], "tunnel"]],
              paint: { "line-color": p.roadMinor, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 13, 1.4] } },
            { id: "boundary-4", type: "line", source: "omt", "source-layer": "boundary", minzoom: 6,
              filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
              paint: { "line-color": p.border, "line-width": 0.8, "line-dasharray": [3, 2] } },
            { id: "boundary-2", type: "line", source: "omt", "source-layer": "boundary",
              filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
              paint: { "line-color": p.border, "line-width": 1.4 } },
            /* ---- hier liegt das Radar (vor LABEL_LAYER eingefügt) ---- */
            { id: "water-name", type: "symbol", source: "omt", "source-layer": "water_name", minzoom: 8,
              filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
              layout: { "text-field": nameDe, "text-font": ["Noto Sans Italic"], "text-size": 11 },
              paint: { "text-color": p.waterText, "text-halo-color": p.halo, "text-halo-width": 1 } },
            { id: LABEL_LAYER, type: "symbol", source: "omt", "source-layer": "place", filter: ["==", ["get", "class"], "city"],
              layout: { "text-field": nameDe, "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 8, 14, 12, 17], "text-padding": 6, "text-max-width": 8 },
              paint: { "text-color": p.text, "text-halo-color": p.halo, "text-halo-width": 1.5 } },
            { id: "place-town", type: "symbol", source: "omt", "source-layer": "place", minzoom: 7, filter: ["==", ["get", "class"], "town"],
              layout: { "text-field": nameDe, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 12, 14], "text-padding": 4, "text-max-width": 8 },
              paint: { "text-color": p.text, "text-halo-color": p.halo, "text-halo-width": 1.3 } },
            { id: "place-village", type: "symbol", source: "omt", "source-layer": "place", minzoom: 10, filter: ["==", ["get", "class"], "village"],
              layout: { "text-field": nameDe, "text-font": ["Noto Sans Regular"], "text-size": 11, "text-padding": 4 },
              paint: { "text-color": p.textMuted, "text-halo-color": p.halo, "text-halo-width": 1.2 } },
            { id: "place-country", type: "symbol", source: "omt", "source-layer": "place", maxzoom: 7, filter: ["==", ["get", "class"], "country"],
              layout: { "text-field": nameDe, "text-font": ["Noto Sans Bold"], "text-size": 12, "text-transform": "uppercase", "text-letter-spacing": 0.15 },
              paint: { "text-color": p.textMuted, "text-halo-color": p.halo, "text-halo-width": 1.2 } }
        ]
    };
}

/* ------------------------------------------------------------------ *
 * Zeitachse aus den Capabilities
 * ------------------------------------------------------------------ */

function parsePeriodMs(p) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(p);
    if (!m) return null;
    return ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000;
}

/* "a/b/PT5M" oder "a,b,c" (auch gemischt) -> sortierte Liste von Millisekunden */
function expandTimes(text) {
    const out = [];
    String(text || "").split(",").forEach(function (item) {
        item = item.trim();
        if (!item) return;
        const parts = item.split("/");
        if (parts.length === 3) {
            const start = Date.parse(parts[0]), end = Date.parse(parts[1]), step = parsePeriodMs(parts[2]);
            if (isNaN(start) || isNaN(end) || !step) return;
            for (let t = start, n = 0; t <= end && n < 5000; t += step, n++) out.push(t);
        } else {
            const t = Date.parse(parts[0]);
            if (!isNaN(t)) out.push(t);
        }
    });
    return out.sort(function (a, b) { return a - b; });
}

/* Zeitpunkte, jüngster Lauf (REFERENCE_TIME) und geografische Abdeckung des Layers */
function metaFromCapabilities(xml) {
    const t = /<Dimension[^>]*name="time"[^>]*>([^<]*)<\/Dimension>/i.exec(xml)
           || /<Extent[^>]*name="time"[^>]*>([^<]*)<\/Extent>/i.exec(xml);
    const r = /<Dimension[^>]*name="REFERENCE_TIME"[^>]*default="([^"]+)"/i.exec(xml);
    const refTime = r ? Date.parse(r[1]) : NaN;
    const b = /<EX_GeographicBoundingBox>([\s\S]*?)<\/EX_GeographicBoundingBox>/i.exec(xml);
    let bbox = null;
    if (b) {
        const num = function (tag) { const m = new RegExp("<" + tag + ">([^<]+)</" + tag + ">").exec(b[1]); return m ? parseFloat(m[1]) : NaN; };
        const w = num("westBoundLongitude"), e = num("eastBoundLongitude"), s = num("southBoundLatitude"), n = num("northBoundLatitude");
        if ([w, e, s, n].every(isNum)) bbox = [w, s, e, n];
    }
    return { times: t ? expandTimes(t[1]) : [], refTime: isNaN(refTime) ? null : refTime, bbox: bbox };
}

function nearest(times, target, tolMs) {
    let best = null;
    for (let i = 0; i < times.length; i++) {
        if (best === null || Math.abs(times[i] - target) < Math.abs(best - target)) best = times[i];
    }
    return best !== null && Math.abs(best - target) <= tolMs ? best : null;
}

/* Frames um die letzte Beobachtung: davor im 10-min-, danach im 15-min-Raster.
   Die letzte Beobachtung ist der jüngste Lauf (REFERENCE_TIME), sofern er in der Zeitachse
   liegt; sonst der jüngste Zeitpunkt <= jetzt. Alles danach ist Prognose. */
function pickFrames(times, nowMs, refMs) {
    if (!times.length) return [];
    let latest = null;
    if (isNum(refMs) && times.indexOf(refMs) >= 0 && refMs <= nowMs + 10 * 60000) latest = refMs;
    if (latest === null) {
        const past = times.filter(function (t) { return t <= nowMs; });
        if (!past.length) return [];
        latest = past[past.length - 1];
    }
    const chosen = [];
    PAST_OFFSETS.forEach(function (o) {
        const t = nearest(times, latest + o * 60000, 4 * 60000);
        if (t !== null && t <= latest && chosen.indexOf(t) < 0) chosen.push(t);
    });
    FUTURE_OFFSETS.forEach(function (o) {
        const t = nearest(times, latest + o * 60000, 6 * 60000);
        if (t !== null && t > latest && chosen.indexOf(t) < 0) chosen.push(t);
    });
    chosen.sort(function (a, b) { return a - b; });
    return chosen.map(function (t) { return { time: t, isForecast: t > latest }; });
}

/* ------------------------------------------------------------------ *
 * Ausschnitt, Bild-URLs, Cache und Ladewarteschlange
 * ------------------------------------------------------------------ */

const EARTH_R = 6378137;                      /* Web-Mercator-Kugelradius (EPSG:3857) */
function toMerc(lon, lat) {
    const la = Math.max(-85.05, Math.min(85.05, lat));
    return [lon * Math.PI / 180 * EARTH_R, Math.log(Math.tan((90 + la) * Math.PI / 360)) * EARTH_R];
}

const VIEW_PAD = 0.25;        /* Rand um den Ausschnitt je Seite, damit kleine Verschiebungen kein Nachladen brauchen */
const ZOOM_TOL = 0.5;         /* bis zu dieser Zoomdifferenz bleibt das geladene Bild in Gebrauch */

/* Sichtbarer Ausschnitt (ohne Rand) */
function viewportOf(m) {
    const b = m.getBounds();
    const c = m.getCanvas();
    return { lonlat: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: m.getZoom ? m.getZoom() : 0,
             cw: c.clientWidth || 512, ch: c.clientHeight || 512 };
}

/* Ausschnitt mit Rand als WMS-Bbox (EPSG:3857) samt Bildgröße und Eckpunkten für die Bildquelle */
function paddedView(vp) {
    const l = vp.lonlat;
    const dx = (l[2] - l[0]) * VIEW_PAD, dy = (l[3] - l[1]) * VIEW_PAD;
    const w = l[0] - dx, s = Math.max(-85, l[1] - dy), e = l[2] + dx, n = Math.min(85, l[3] + dy);
    /* Das Radarraster ist 1 km grob: 1,5-fache Dichte reicht und halbiert die Ladezeit gegenüber 2 */
    const dpr = Math.min(1.5, (typeof devicePixelRatio === "number" && devicePixelRatio > 0) ? devicePixelRatio : 1);
    const scale = dpr * (1 + 2 * VIEW_PAD);
    const width = Math.min(2048, Math.max(64, Math.round(vp.cw * scale)));
    const height = Math.min(2048, Math.max(64, Math.round(vp.ch * scale)));
    const sw = toMerc(w, s), ne = toMerc(e, n);
    return {
        lonlat: [w, s, e, n], zoom: vp.zoom,
        bbox: [sw[0], sw[1], ne[0], ne[1]],
        width: width, height: height,
        coords: [[w, n], [e, n], [e, s], [w, s]],
        key: [w, s, e, n].map(function (v) { return v.toFixed(4); }).join(",") + "|" + width + "x" + height
    };
}

function viewOf(m) { return paddedView(viewportOf(m)); }

function insideView(vp, view) {
    const a = vp.lonlat, b = view.lonlat;
    return a[0] >= b[0] && a[2] <= b[2] && a[1] >= b[1] && a[3] <= b[3] && Math.abs(vp.zoom - view.zoom) < ZOOM_TOL;
}

let loadedView = null;        /* Ausschnitt (mit Rand), für den die Bilder gerade geladen sind */

/* Geladenen Ausschnitt weiterverwenden, solange der sichtbare Bereich darin liegt; sonst neuen Rand-Ausschnitt */
function viewFor(m) {
    const vp = viewportOf(m);
    if (loadedView && insideView(vp, loadedView)) return loadedView;
    return paddedView(vp);
}

function getMapUrl(timeMs, view) {
    const p = { service: "WMS", version: "1.3.0", request: "GetMap", layers: WMS_LAYER, styles: "", format: "image/png",
                transparent: "true", crs: "EPSG:3857", bbox: view.bbox.map(function (v) { return v.toFixed(2); }).join(","),
                width: view.width, height: view.height };
    if (timeMs !== null) p.time = new Date(timeMs).toISOString();
    return WMS_URL + "?" + Object.keys(p).map(function (k) { return k + "=" + encodeURIComponent(p[k]); }).join("&");
}

/* Ohne Zeitachse (time null, „aktuell“) trägt der Schlüssel die Abrufzeit (frame.at): jedes Aktualisieren
   holt das Bild neu, statt das veraltete aus dem Cache zu zeigen; überholte Einträge räumt der LRU-Cache */
function frameKey(frame, view) { return (frame.time === null ? "now@" + frame.at : String(frame.time)) + "|" + view.key; }
function timeOfKey(key) { return key.split("|")[0]; }

const cache = new Map();       /* key -> { url, at } */
const pending = new Map();     /* key -> Promise */
const failed = new Map();      /* key -> Zeitstempel */
const queue = [];              /* { key, src, prio, resolve, reject } */
let active = 0, tick = 0;
let inUse = [];                /* Blob-URLs, die gerade auf einer Ebene liegen (nie verwerfen) */

function revoke(url) {
    try { if (url && url.indexOf("blob:") === 0 && typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(url); } catch (e) { /* egal */ }
}

function cacheGet(key) {
    const e = cache.get(key);
    if (!e) return null;
    e.at = ++tick;
    return e.url;
}

function cachePut(key, url) {
    cache.set(key, { url: url, at: ++tick });
    while (cache.size > CACHE_MAX) {
        let oldest = null;
        cache.forEach(function (v, k) { if (inUse.indexOf(v.url) < 0 && (oldest === null || v.at < cache.get(oldest).at)) oldest = k; });
        if (oldest === null) break;
        revoke(cache.get(oldest).url);
        cache.delete(oldest);
    }
}

function cacheSize() { return cache.size; }

async function fetchBlob(src) {
    const res = await fetch(src);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const ct = res.headers && res.headers.get ? (res.headers.get("content-type") || "") : "image/png";
    if (ct.indexOf("image/") !== 0) throw new Error("Kein Bild: " + ct);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

function pump() {
    while (active < MAX_PARALLEL && queue.length) {
        queue.sort(function (a, b) { return a.prio - b.prio; });
        const job = queue.shift();
        active++;
        fetchBlob(job.src).then(function (url) {
            failed.delete(job.key);
            cachePut(job.key, url);
            job.resolve(url);
        }, function (err) {
            failed.set(job.key, Date.now());
            job.reject(err);
        }).then(function () {
            active--;
            pending.delete(job.key);
            pump();
        });
    }
}

/* Bild für key laden; prio 0 = sofort nötig, höhere Werte später. Mehrfachanfragen teilen sich eine Ladung. */
function loadImage(key, src, prio) {
    const hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    if (pending.has(key)) {
        const q = queue.filter(function (x) { return x.key === key; })[0];
        if (q && prio < q.prio) q.prio = prio;
        return pending.get(key);
    }
    const p = new Promise(function (resolve, reject) { queue.push({ key: key, src: src, prio: prio, resolve: resolve, reject: reject }); });
    pending.set(key, p);
    pump();
    return p;
}

/* Wartende Abrufe für andere Ausschnitte verwerfen (laufende enden von selbst) */
function pruneQueue(viewKey) {
    for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].key.indexOf("|" + viewKey) < 0) {
            const job = queue.splice(i, 1)[0];
            pending.delete(job.key);
            job.reject(new Error("stale"));
        }
    }
}

/* ------------------------------------------------------------------ *
 * Zustand und Anzeige
 * ------------------------------------------------------------------ */

let map = null;
let frames = [];               /* { time (ms|null), isForecast } */
let current = 0;
let playing = false;
let playTimer = null;
let showToken = 0;
let shownLayer = "radar-a", stagingLayer = "radar-b", shownKey = null;
let refreshing = null;
let lastRefreshAt = 0;
let meta = { bbox: null };
let marker = null;
let moveTimer = null;
let wasPlaying = false;
let radarVisible = true;

/* Aktiver Ort der Wetter-App (Suche oder „Mein Standort“), sonst der zuletzt ermittelte GPS-Ort */
function lastKnownPos() {
    const read = function (key) {
        try {
            const raw = localStorage.getItem(key);
            const p = raw ? JSON.parse(raw) : null;
            return p && isNum(p.lat) && isNum(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 ? p : null;
        } catch (e) { return null; }
    };
    return read("wetter:active") || read("wetter:pos");
}

function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/* Uhrzeiten laufen in Gerätezeit: der aktive Ort liegt nur als Koordinaten vor (wetter:active trägt keine
   Zeitzone). Das Radargebiet liegt in MEZ/MESZ; zeigt die Gerätezone eine andere Uhrzeit, nennt das Badge
   die Zone dazu („ GMT-4“), damit die Zeit nicht als Ortszeit gelesen wird. Sonst leer. */
const RADAR_ZONE = "Europe/Berlin";
function zoneHint(ms) {
    try {
        const d = new Date(ms);
        if (fmtTime(ms) === d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: RADAR_ZONE })) return "";
        const z = new Intl.DateTimeFormat("de-DE", { timeZoneName: "short" }).formatToParts(d).filter(function (p) { return p.type === "timeZoneName"; })[0];
        return " " + (z ? z.value : "Gerätezeit");
    } catch (e) { return ""; }
}

function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function setMsg(text) { const el = $("mapMsg"); if (!el) return; el.textContent = text; el.classList.remove("hidden"); }
function hideMsg() { const el = $("mapMsg"); if (el) el.classList.add("hidden"); }
function setStatus(text) { const el = $("status"); if (!el) return; el.textContent = text; el.classList.toggle("hidden", !text); }
function setLoading(on) { const b = $("badge"); if (b && b.classList) b.classList.toggle("loading", !!on); }

function lastPastIndex() {
    for (let i = frames.length - 1; i >= 0; i--) if (!frames[i].isForecast) return i;
    return frames.length - 1;
}

function updateBadge(f) {
    const stamp = f.time === null ? "aktuell" : fmtTime(f.time) + " Uhr" + zoneHint(f.time);
    setText("frameTime", stamp);
    const pill = $("framePill");
    if (pill) {
        pill.textContent = f.isForecast ? "Prognose" : "Beobachtung";
        pill.className = "pill" + (f.isForecast ? " fc" : "");
    }
    /* Vorleser hören den Zeitpunkt statt der Positionsnummer des Reglers */
    const sl = $("slider");
    if (sl && sl.setAttribute) sl.setAttribute("aria-valuetext", stamp + ", " + (f.isForecast ? "Prognose" : "Beobachtung"));
    const badge = $("badge");
    if (badge && badge.classList && typeof badge.offsetWidth === "number") {
        badge.classList.remove("tick");
        void badge.offsetWidth;
        badge.classList.add("tick");
    }
}

function updateSlider() {
    const s = $("slider");
    if (!s) return;
    s.max = Math.max(0, frames.length - 1);
    s.value = current;
}

/* Zeitachse: Marker an der Grenze Beobachtung/Prognose. Position = Slider-Index der jüngsten
   Beobachtung (Daumen 26 px breit), keine gleichmäßigen Zeitabstände unterstellt. */
const THUMB_PX = 26;
function markerPos(lp, count) {
    const pct = count > 1 ? lp / (count - 1) : 0;
    return "calc(" + (THUMB_PX / 2) + "px + " + pct.toFixed(4) + " * (100% - " + THUMB_PX + "px))";
}

function setSliderTrack(pos) {
    const sl = $("slider");
    if (!sl || !sl.style) return;
    sl.style.background = pos ? "linear-gradient(90deg, var(--tl-obs) 0, var(--tl-obs) " + pos + ", var(--tl-fc) " + pos + ", var(--tl-fc) 100%)" : "";
}

function updateTicks() {
    const axis = $("tlAxis"), mark = $("tlMark");
    if (!frames.length || frames[0].time === null) { if (axis && axis.classList) axis.classList.add("hidden"); setSliderTrack(null); return; }
    if (axis && axis.classList) axis.classList.remove("hidden");
    const lp = lastPastIndex(), pct = frames.length > 1 ? lp / (frames.length - 1) : 0;
    const pos = markerPos(lp, frames.length);
    const stamp = fmtTime(frames[lp].time);
    if (mark) {
        if (mark.style) mark.style.left = pos;
        setText("tlMarkTime", stamp);
        /* Die Marke bleibt knapp (sie steht zwischen den Beschriftungen); den Zonen-Zusatz trägt sichtbar das Badge, hier hört ihn der Vorleser */
        if (mark.setAttribute) mark.setAttribute("aria-label", "Zur jüngsten Beobachtung springen, " + stamp + " Uhr" + zoneHint(frames[lp].time));
    }
    const obs = $("tlObs"), fc = $("tlFc");
    if (obs && obs.classList) obs.classList.toggle("hidden", pct < 0.22);
    if (fc && fc.classList) fc.classList.toggle("hidden", lp >= frames.length - 1 || pct > 0.78);
    setSliderTrack(pos);
}

/* ---------- Legende aus der Stildefinition ---------- */

function parseStyleClasses(xml) {
    const out = { classes: [], nodata: null };
    const re = /<(?:sld:)?ColorMapEntry\s+([^>]*)\/?>/g;
    let m;
    while ((m = re.exec(String(xml || ""))) !== null) {
        const attr = function (name) { const r = new RegExp(name + '="([^"]*)"').exec(m[1]); return r ? r[1].replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&") : null; };
        const color = attr("color"), label = attr("label") || "", opacity = attr("opacity"), quantity = parseFloat(attr("quantity"));
        if (!color) continue;
        if (/keine daten/i.test(label)) { out.nodata = { color: color, opacity: opacity !== null ? parseFloat(opacity) : 0.3 }; continue; }
        if ((opacity !== null && parseFloat(opacity) === 0) || !isNum(quantity) || quantity <= 0) continue;
        const num = /(\d+(?:\.\d+)?)/.exec(label);
        out.classes.push({ color: color, label: label.trim(), low: num ? parseFloat(num[1]) : null, open: /^>=|^≥/.test(label.trim()) });
    }
    return out;
}

function fmtDe(v) { return isNum(v) ? String(v).replace(".", ",") : "–"; }

function legendHtml(lc) {
    const bar = lc.classes.map(function (c) { return '<i style="background:' + c.color + '" title="' + c.label + ' mm/h"></i>'; }).join("");
    const ticks = lc.classes.map(function (c, i) { return '<span' + (i % 2 ? ' class="alt"' : '') + '>' + (c.open ? "≥" : "") + fmtDe(c.low) + '</span>'; }).join("");
    const list = lc.classes.map(function (c) {
        const txt = c.open ? "ab " + fmtDe(c.low) + " mm/h" : c.label.replace(/^\[\s*([\d.]+)\s*-\s*([\d.]+)\s*\)$/, function (_, a, b) { return fmtDe(parseFloat(a)) + " bis " + fmtDe(parseFloat(b)) + " mm/h"; });
        return '<li><i style="background:' + c.color + '"></i>' + txt + '</li>';
    }).join("");
    const first = lc.classes[0], last = lc.classes[lc.classes.length - 1];
    const alt = "Farbskala: Regen ab " + fmtDe(first.low) + (last.open ? " bis über " : " bis ") + fmtDe(last.low) + " mm/h" +
        (lc.nodata ? ", grau heißt keine Radardaten" : "") + ". Alle Stufen stehen unter „Alle Stufen“.";
    return '<span class="vh">' + alt + '</span><div class="lg-row" aria-hidden="true"><span class="lg-unit">mm/h</span><div class="lg-bar">' + bar + '</div>' +
        (lc.nodata ? '<span class="lg-nodata"><i style="background:' + lc.nodata.color + '"></i>keine Daten</span>' : '') + '</div>' +
        '<div class="lg-ticks" aria-hidden="true">' + ticks + '</div>' +
        '<details class="lg-more"><summary>Alle Stufen</summary><ul>' + list +
        (lc.nodata ? '<li><i style="background:' + lc.nodata.color + ';opacity:.5"></i>keine Radardaten (grau)</li>' : '') +
        '</ul><p>Klassen aus der Stildefinition des DWD-Dienstes, Niederschlag in mm/h.</p></details>';
}

/* Legende laden: zuerst der Stil des Dienstes, sonst das DWD-Legendenbild, sonst ein Hinweis statt einer erfundenen Skala */
async function loadLegend() {
    const box = $("legend");
    if (!box) return;
    try {
        const res = await fetch(STYLE_URL);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const lc = parseStyleClasses(await res.text());
        if (lc.classes.length >= 3) { box.innerHTML = legendHtml(lc); return; }
        throw new Error("Stil ohne Klassen");
    } catch (e) {
        box.innerHTML = '<div class="lg-row"><span class="lg-unit">mm/h</span><img alt="Farbskala Niederschlagsintensität des DWD" src="' + LEGEND_URL + '"></div>';
        const img = box.querySelector ? box.querySelector("img") : null;
        if (img && img.addEventListener) img.addEventListener("error", function () { box.innerHTML = '<span class="lg-note">Legende derzeit nicht verfügbar.</span>'; });
    }
}

function coverageOk(view) {
    const b = meta.bbox;
    if (!b) return true;
    const v = view.lonlat;
    return !(v[2] < b[0] || v[0] > b[2] || v[3] < b[1] || v[1] > b[3]);
}

function setRadarVisible(on) {
    radarVisible = on;
    if (!map || !map.getLayer) return;
    if (!on) {
        if (map.getLayer(shownLayer)) map.setPaintProperty(shownLayer, "raster-opacity", 0);
        if (map.getLayer(stagingLayer)) map.setPaintProperty(stagingLayer, "raster-opacity", 0);
        shownKey = null;
        loadedView = null;
    }
}

/* Auf "sourcedata" der Bildquelle warten, mit Zeitgrenze (Blob-URLs laden praktisch sofort) */
function whenSourceLoaded(id) {
    return new Promise(function (resolve) {
        let done = false;
        const finish = function () { if (!done) { done = true; resolve(); } };
        if (!map || typeof map.on !== "function") { finish(); return; }
        const h = function (e) { if (e && e.sourceId === id && e.isSourceLoaded) { if (map.off) map.off("sourcedata", h); finish(); } };
        map.on("sourcedata", h);
        setTimeout(function () { if (map.off) map.off("sourcedata", h); finish(); }, 400);
    });
}

/* Fertig geladenes Bild in die freie Ebene legen und überblenden, dann Rollen tauschen */
function swapTo(url, coords, key) {
    const src = map.getSource(stagingLayer);
    if (!src || !src.updateImage) return Promise.resolve();
    src.updateImage({ url: url, coordinates: coords });
    return whenSourceLoaded(stagingLayer).then(function () {
        const prev = map.getSource(shownLayer);
        map.setPaintProperty(stagingLayer, "raster-opacity", RADAR_OPACITY);
        map.setPaintProperty(shownLayer, "raster-opacity", 0);
        const t = shownLayer; shownLayer = stagingLayer; stagingLayer = t;
        shownKey = key;
        inUse = [url, prev && prev._radarUrl ? prev._radarUrl : null].filter(Boolean);
        src._radarUrl = url;
    });
}

/* Zeitpunkt anzeigen: Bild für den aktuellen Ausschnitt holen (Priorität 0), erst dann
   überblenden und Beschriftung setzen; währenddessen bleibt das alte Bild stehen. */
function showFrame(i) {
    if (!frames.length || !map) return Promise.resolve();
    current = Math.max(0, Math.min(i, frames.length - 1));
    const f = frames[current];
    updateSlider();
    if (!coverageOk(viewportOf(map))) { setMsg(COVER_MSG); setRadarVisible(false); updateBadge(f); return Promise.resolve(); }
    if (!radarVisible) { radarVisible = true; hideMsg(); }
    const view = viewFor(map);
    const key = frameKey(f, view);
    if (key === shownKey) { updateBadge(f); prefetchAround(current, view); return Promise.resolve(); }
    const token = ++showToken;
    setLoading(true);
    return loadImage(key, getMapUrl(f.time, view), 0).then(function (url) {
        if (token !== showToken) return;
        return swapTo(url, view.coords, key).then(function () {
            if (token !== showToken) return;
            loadedView = view;
            setLoading(false);
            setStatus("");
            hideMsg();
            updateBadge(f);
            prefetchAround(current, view);
        });
    }, function (err) {
        if (token !== showToken) return;
        setLoading(false);
        if (String(err && err.message) !== "stale") setStatus("Radarbild konnte nicht geladen werden");
    });
}

/* Folgende Zeitpunkte zuerst (Abspielrichtung), danach die davor; fehlgeschlagene erst nach Wartezeit erneut */
function prefetchAround(i, view) {
    const order = [];
    for (let d = 1; d < frames.length; d++) if (i + d < frames.length) order.push(i + d);
    for (let j = 0; j < i; j++) order.push(j);
    order.forEach(function (idx, n) {
        const f = frames[idx], key = frameKey(f, view);
        if (cacheGet(key) || pending.has(key)) return;
        if (failed.has(key) && Date.now() - failed.get(key) < RETRY_MS) return;
        loadImage(key, getMapUrl(f.time, view), 1 + n).catch(function () { /* später erneut */ });
    });
}

function setPlaying(on) {
    playing = !!on;
    const pb = $("play");
    if (pb) {
        pb.textContent = playing ? "❚❚" : "▶";
        if (pb.setAttribute) pb.setAttribute("aria-label", playing ? "Pause" : "Abspielen");
        if (pb.classList && typeof pb.offsetWidth === "number") { pb.classList.remove("pop"); void pb.offsetWidth; pb.classList.add("pop"); }
    }
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    if (playing && frames.length > 1) scheduleTick();
}

/* Nächstes Bild erst nach dem fertigen Anzeigen des vorigen planen: nichts wird übersprungen */
function scheduleTick() {
    playTimer = setTimeout(function () {
        if (!playing) return;
        showFrame(current >= frames.length - 1 ? 0 : current + 1).then(function () { if (playing) scheduleTick(); });
    }, PLAY_MS);
}

/* ------------------------------------------------------------------ *
 * Aktualisieren
 * ------------------------------------------------------------------ */

function refresh(keepPosition, opts) {
    if (refreshing) return refreshing;
    if (opts && opts.minAge && Date.now() - lastRefreshAt < opts.minAge) return Promise.resolve();
    lastRefreshAt = Date.now();
    refreshing = doRefresh(keepPosition).catch(function () { /* Fehler sind im Status gemeldet */ }).then(function () { refreshing = null; });
    return refreshing;
}

async function doRefresh(keepPosition) {
    let xml = null;
    try {
        const res = await fetch(CAPS_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        xml = await res.text();
    } catch (e) { xml = null; }

    if (xml === null) {
        if (frames.length && frames[0].time !== null) { setStatus("Zeitachse nicht aktualisiert, alte Bilder bleiben"); return; }
        /* Ohne Zeitachse: aktuelles Radarbild ohne Zeitraffer */
        frames = [{ time: null, isForecast: false, at: Date.now() }];
        current = 0;
        updateSlider(); updateTicks();
        setText("note", "Zeitachse des DWD-Dienstes nicht abrufbar; es wird das aktuelle Radarbild ohne Zeitraffer gezeigt.");
        setPlaying(false);
        hideMsg();
        await showFrame(0);
        return;
    }

    const m = metaFromCapabilities(xml);
    if (m.bbox) meta.bbox = m.bbox;
    const picked = pickFrames(m.times, Date.now(), m.refTime);
    if (!picked.length) {
        frames = [{ time: null, isForecast: false, at: Date.now() }];
        current = 0;
        updateSlider(); updateTicks();
        setText("note", "Keine Zeitpunkte in den Produktmetadaten; es wird das aktuelle Radarbild ohne Zeitraffer gezeigt.");
        setPlaying(false);
        hideMsg();
        await showFrame(0);
        return;
    }

    const rel = keepPosition && frames.length && frames[0].time !== null ? current - lastPastIndex() : 0;
    /* Bilder behalten, deren Zeitpunkt weiter in der Zeitachse liegt; den Rest freigeben, auch
       „aktuell“-Bilder (now@…) aus einem Rückfall ohne Zeitachse, die sind mit der Zeitachse überholt */
    const keepTimes = {};
    picked.forEach(function (p) { keepTimes[String(p.time)] = true; });
    Array.from(cache.keys()).forEach(function (k) {
        if (!keepTimes[timeOfKey(k)]) { const e = cache.get(k); cache.delete(k); if (inUse.indexOf(e.url) < 0) revoke(e.url); }
    });
    frames = picked;
    updateTicks();
    hideMsg();
    await showFrame(lastPastIndex() + rel);
}

/* ------------------------------------------------------------------ *
 * Karte
 * ------------------------------------------------------------------ */

function ensureRadarLayers() {
    if (!map || !map.getSource) return;
    const view = viewFor(map);
    ["radar-a", "radar-b"].forEach(function (id) {
        if (!map.getSource(id)) map.addSource(id, { type: "image", url: BLANK_PNG, coordinates: view.coords });
        if (!map.getLayer(id)) {
            map.addLayer({ id: id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-fade-duration": 0 } }, map.getLayer(LABEL_LAYER) ? LABEL_LAYER : undefined);
            map.setPaintProperty(id, "raster-opacity-transition", { duration: FADE_MS, delay: 0 });
        }
    });
    shownKey = null;
    if (frames.length) showFrame(current);
}

function makeMarker(pos) {
    if (!pos || !maplibregl.Marker) return null;
    const el = document.createElement ? document.createElement("div") : null;
    if (!el) return null;
    el.className = "site-pin";
    el.title = pos.name || "Dein Standort";
    const m = new maplibregl.Marker({ element: el }).setLngLat([pos.lon, pos.lat]).addTo(map);
    /* Nach dem Anlegen setzen: MapLibre beschriftet Marker sonst englisch und als Knopf */
    if (el.setAttribute) { el.setAttribute("role", "img"); el.setAttribute("aria-label", pos.name ? "Gewählter Ort: " + pos.name : "Dein Standort"); }
    return m;
}

function recenter() {
    if (!map) return;
    const pos = lastKnownPos();
    const center = pos ? [pos.lon, pos.lat] : DEFAULT_CENTER;
    map.easeTo({ center: center, zoom: Math.max(pos ? 7 : 6, map.getZoom ? map.getZoom() : 6), duration: 600 });
}

function onViewChanged() {
    if (moveTimer) clearTimeout(moveTimer);
    moveTimer = setTimeout(function () {
        moveTimer = null;
        if (!map) return;
        pruneQueue(viewFor(map).key);
        showFrame(current);
    }, 150);
}

/* ------------------------------------------------------------------ *
 * Design-Umschalter (gleiche Logik wie in der App) + Kartenstil
 * ------------------------------------------------------------------ */

function moveTabInk() {
    const nav = document.querySelector ? document.querySelector(".tabs nav") : null;
    if (!nav || !nav.querySelector) return;
    const ink = nav.querySelector(".tab-ink"), on = nav.querySelector("a.on");
    if (!ink || !on || typeof on.offsetLeft !== "number" || !on.offsetWidth) return;
    ink.style.left = on.offsetLeft + "px";
    ink.style.width = on.offsetWidth + "px";
    nav.classList.add("ink-ready");
}

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

function bind(id, ev, fn) { const el = $(id); if (el && el.addEventListener) el.addEventListener(ev, fn); }

/* Innerer Zustand für Tests (let-Variablen sind im Sandbox-Kontext sonst nicht erreichbar) */
function radarState() {
    return { map: map, frames: frames, current: current, playing: playing, shownLayer: shownLayer, stagingLayer: stagingLayer, cacheSize: cache.size, queued: queue.length, active: active, loadedView: loadedView };
}

/* Im Radar-Blatt der Startseite (?embed=1) gibt die Startseite ihren Nachtzustand mit (night=1 Nacht,
   night=0 Tag): eine Zeitbasis für beide (Ortszeit, an Open-Meteo verankert), eine Handwahl ist dort
   schon eingerechnet. Liefert true/false, ohne Parameter oder außerhalb des Blatts null. */
function embedNight() {
    try {
        const q = typeof location !== "undefined" && location && typeof location.search === "string" ? location.search : "";
        if (!/[?&]embed=1(&|$)/.test(q)) return null;
        const m = /[?&]night=([01])(&|$)/.exec(q);
        return m ? m[1] === "1" : null;
    } catch (e) { return null; }
}

/* Nachtpalette wie auf der Startseite: im Blatt deren Zustand (embedNight), sonst der Sonnenstand am
   aktiven Ort (−8°) nach Gerätezeit und Gerätezone (wetter:active trägt keine Zeitzone), beim Start
   und jede Minute. Liefert true/false, ohne Ort null. nowMs nur für Tests. */
let radarAuto = null, radarFadeTimer = null;
function radarNight(nowMs) {
    let on = embedNight();
    if (on === null) {
        const pos = lastKnownPos();
        if (!pos || typeof nightByClock !== "function") return null;
        const now = new Date(isNum(nowMs) ? nowMs : Date.now());
        const dateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
        radarAuto = nightByClock(pos.lat, pos.lon, dateStr, -now.getTimezoneOffset() * 60, now.getHours() * 60 + now.getMinutes());
        on = resolveNight(radarAuto);
    }
    const root = document.documentElement && document.documentElement.classList ? document.documentElement : null;
    if (root) {
        if (root.classList.contains("night") !== on) {
            root.classList.add("fade");
            clearTimeout(radarFadeTimer);
            radarFadeTimer = setTimeout(function () { root.classList.remove("fade"); }, 1000);
        }
        root.classList.toggle("night", on);
    }
    try { localStorage.setItem("wetter:night", on ? "1" : "0"); } catch (e) {}
    paintModeButton($("modeBtn"), on);
    updateThemeColor();
    return on;
}

/* Tipp auf den Schalter: Handwahl bis zum nächsten automatischen Wechsel, dann neu auflösen */
function radarToggleMode() {
    const root = document.documentElement && document.documentElement.classList ? document.documentElement : null;
    const on = !(root && root.classList.contains("night"));
    writeNightMode(on ? "night" : "day", radarAuto === null ? !on : radarAuto);
    radarNight();
}

/* Statusleiste je Farbschema und Nacht wie auf der Startseite (Bento wie der Grund, Nil Nile Blue bzw. Deep Indigo);
   die Klasse scheme-nil setzt radar.html vor dem Stylesheet aus wetter:settings. Liefert die Farbe zurück. */
function updateThemeColor() {
    const root = document.documentElement && document.documentElement.classList ? document.documentElement : null;
    const night = !!(root && root.classList.contains("night")), nil = !!(root && root.classList.contains("scheme-nil"));
    const color = nil ? (night ? "#051230" : "#bce4e5") : (night ? "#14121F" : "#ECEAF4");
    const metaEl = document.querySelector ? document.querySelector('meta[name="theme-color"]') : null;
    if (metaEl) metaEl.setAttribute("content", color);
    return color;
}

function initRadar() {
    if (typeof maplibregl === "undefined") {
        setMsg("Die Kartenbibliothek konnte nicht geladen werden. Bitte Verbindung prüfen und Seite neu laden.");
        return;
    }
    radarNight();
    const pos = lastKnownPos();
    map = new maplibregl.Map({
        container: "map",
        style: buildStyle(),
        center: pos ? [pos.lon, pos.lat] : DEFAULT_CENTER,
        zoom: pos ? 7 : 6,
        minZoom: 4, maxZoom: 12,
        attributionControl: { compact: true, customAttribution: "Radar: DWD, RADOLAN RV, CC BY 4.0" },
        /* Beschriftungen der Kartenbibliothek für Vorleser auf Deutsch */
        locale: { "Map.Title": "Kartenfläche", "Marker.Title": "Gewählter Ort", "AttributionControl.ToggleAttribution": "Quellenangaben ein- oder ausblenden", "AttributionControl.MapFeedback": "Rückmeldung zur Karte", "NavigationControl.ZoomIn": "Hineinzoomen", "NavigationControl.ZoomOut": "Herauszoomen", "NavigationControl.ResetBearing": "Norden nach oben" },
        dragRotate: false, pitchWithRotate: false, touchPitch: false
    });
    if (map.touchZoomRotate && map.touchZoomRotate.disableRotation) map.touchZoomRotate.disableRotation();
    if (map.keyboard && map.keyboard.disableRotation) map.keyboard.disableRotation();

    map.on("style.load", ensureRadarLayers);
    map.on("moveend", onViewChanged);
    map.on("error", function (e) {
        /* Kachel- oder Stilfehler der Grundkarte: nicht fatal, aber sichtbar machen */
        if (e && e.error && /style|tile|source|font|glyph/i.test(String(e.error.message || e.error))) setStatus("Teile der Karte konnten nicht geladen werden");
    });
    map.once("load", function () {
        /* Kompakte Quellenangabe startet eingeklappt (sie steht auch im Hinweistext), das i-Symbol öffnet sie */
        if (document.querySelectorAll) {
            Array.prototype.slice.call(document.querySelectorAll(".maplibregl-ctrl-attrib.maplibregl-compact-show")).forEach(function (el) { el.classList.remove("maplibregl-compact-show"); });
        }
        marker = makeMarker(pos);
        refresh(false).then(function () { if (frames.length > 1) setPlaying(true); });
    });

    bind("play", "click", function () { setPlaying(!playing); });
    bind("slider", "input", function () { setPlaying(false); showFrame(parseInt(this.value, 10) || 0); });
    bind("refresh", "click", function () { refresh(true); });
    bind("recenter", "click", recenter);
    bind("zoomIn", "click", function () { if (map.zoomIn) map.zoomIn({ duration: 300 }); });
    bind("zoomOut", "click", function () { if (map.zoomOut) map.zoomOut({ duration: 300 }); });
    bind("modeBtn", "click", radarToggleMode);
    bind("tlMark", "click", function () { setPlaying(false); showFrame(lastPastIndex()); });
    loadLegend();

    moveTabInk();
    if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", moveTabInk);

    /* Alle 5 Minuten frische Metadaten; im Hintergrund pausieren, bei Rückkehr aktualisieren */
    setInterval(function () { if (!document.hidden) refresh(true); }, REFRESH_MS);
    setInterval(function () { if (!document.hidden) radarNight(); }, 60000);
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) { wasPlaying = playing; setPlaying(false); return; }
        radarNight();
        refresh(true, { minAge: REFRESH_MIN_AGE }).then(function () { if (wasPlaying) setPlaying(true); });
    });
}

initRadar();
