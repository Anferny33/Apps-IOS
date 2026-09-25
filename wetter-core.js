/* Kern der Wetter-App für den aktuellen Standort.
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
const COLOR = {
    temp: "#b8821a", feels: "#3d94e0",
    wind: "#27a07a", gust: "#8f7fd6",
    rain: "#3d94e0",
    good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b"
};

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

const $ = function (id) { return document.getElementById(id); };

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

function fetchForecast(loc) {
    return getJson(buildUrl("https://api.open-meteo.com/v1/forecast", {
        latitude: loc.lat,
        longitude: loc.lon,
        timezone: "auto",
        forecast_days: 14,
        current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,cloud_cover,is_day",
        minutely_15: "precipitation",
        hourly: "temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset,daylight_duration,sunshine_duration"
    }));
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
        daily: "precipitation_sum"
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
function firstIndexFrom(times, from) {
    for (let i = 0; i < times.length; i++) {
        if (times[i] >= from) return i;
    }
    return -1;
}

function hhmm(t) { return t ? t.slice(11, 16) : "–"; }
function dayOf(t) { return t.slice(0, 10); }
function ddmm(dateStr) { return dateStr.slice(8, 10) + "." + dateStr.slice(5, 7) + "."; }

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
        prob: Math.round(wet / vals.length * 100),
        median: quantile(vals, 0.5),
        max: vals[vals.length - 1],
        p90: quantile(vals, 0.9)
    };
}

/* ------------------------------------------------------------------ *
 * Generisches Liniendiagramm (Zeitreihe, 1–2 Serien, Fadenkreuz-Tooltip)
 * ------------------------------------------------------------------ */

function lineChart(box, cfg) {
    const times = cfg.times, n = times.length;
    const series = cfg.series.filter(function (s) { return s.values && s.values.some(isNum); });
    if (n < 2 || !series.length) {
        box.innerHTML = '<div class="note">Zu wenige Daten für den Verlauf.</div>';
        return;
    }

    /* viewBox 420 breit: auf Handybreite skaliert das auf ~0,8, Schrift bleibt lesbar */
    const W = 420, H = 170;
    const padL = 30, padR = 10, padT = 22, padB = 20;
    const iw = W - padL - padR, ih = H - padT - padB;
    const NS = ' vector-effect="non-scaling-stroke"';

    const all = [];
    series.forEach(function (s) { s.values.forEach(function (v) { if (isNum(v)) all.push(v); }); });
    let lo = cfg.zeroBase ? 0 : Math.floor(Math.min.apply(null, all)) - 1;
    let hi = Math.ceil(Math.max.apply(null, all)) + 1;
    const minSpan = cfg.minSpan || 6;
    if (hi - lo < minSpan) {
        if (cfg.zeroBase) hi = lo + minSpan;
        else { const mid = (hi + lo) / 2; lo = Math.floor(mid - minSpan / 2); hi = Math.ceil(mid + minSpan / 2); }
    }

    const x = function (i) { return padL + i / (n - 1) * iw; };
    const y = function (v) { return padT + (hi - v) / (hi - lo) * ih; };

    /* Nacht-Schattierung: zusammenhängende Bereiche mit is_day == 0 */
    let night = "";
    if (cfg.isDay) {
        let runStart = -1;
        for (let i = 0; i <= n; i++) {
            const isNight = i < n && cfg.isDay[i] === 0;
            if (isNight && runStart < 0) runStart = i;
            if (!isNight && runStart >= 0) {
                night += '<rect x="' + x(runStart).toFixed(1) + '" y="' + padT + '" width="' +
                         (x(i - 1) - x(runStart) + iw / (n - 1)).toFixed(1) + '" height="' + ih +
                         '" fill="rgba(0,0,0,0.28)" rx="3"/>';
                runStart = -1;
            }
        }
    }

    /* Gitter: glatte Zahlen, Hairlines */
    let grid = "";
    const span = hi - lo;
    const step = span > 40 ? 20 : (span > 20 ? 10 : (span > 12 ? 5 : 2));
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
        grid += '<line x1="' + padL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y(v).toFixed(1) +
                '" stroke="rgba(255,255,255,0.09)" stroke-width="1"' + NS + '/>' +
                '<text x="' + (padL - 5) + '" y="' + (y(v) + 3.5).toFixed(1) +
                '" text-anchor="end" font-size="10" fill="#7f95b4">' + v + cfg.unit + '</text>';
    }

    /* X-Achse: "jetzt", dann Zeiten an vollen 6-h- (bzw. 3-h-) Stunden,
       Tageswechsel um 0 Uhr mit Wochentag + Hairline. Labels dicht an
       "jetzt" werden ausgelassen, damit nichts kollidiert. */
    let xa = "";
    const every = n > 30 ? 6 : 3;
    const gap = Math.ceil(2 * every / 3);
    for (let i = 0; i < n; i++) {
        const hour = parseInt(times[i].slice(11, 13), 10);
        const newDay = i > 0 && dayOf(times[i]) !== dayOf(times[i - 1]);
        if (newDay) {
            xa += '<line x1="' + x(i).toFixed(1) + '" y1="' + padT + '" x2="' + x(i).toFixed(1) + '" y2="' + (padT + ih) +
                  '" stroke="rgba(255,255,255,0.13)" stroke-width="1"' + NS + '/>';
        }
        let label = null;
        if (i === 0) label = "jetzt";
        else if (i >= gap && hour === 0) label = weekday(dayOf(times[i]));
        else if (i >= gap && hour % every === 0) label = hhmm(times[i]);
        if (label) {
            xa += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10"' +
                  (hour === 0 && i > 0 ? ' font-weight="600" fill="#9fb3d1"' : ' fill="#7f95b4"') + '>' + label + '</text>';
        }
    }

    function pathOf(vals) {
        let d = "";
        for (let i = 0; i < n; i++) {
            if (!isNum(vals[i])) continue;
            d += (d ? " L" : "M") + x(i).toFixed(1) + " " + y(vals[i]).toFixed(1);
        }
        return d;
    }

    const main = series[0];
    const mainPath = pathOf(main.values);
    const area = mainPath + " L" + x(n - 1).toFixed(1) + " " + (padT + ih) + " L" + padL + " " + (padT + ih) + " Z";

    let paths = '<path d="' + area + '" fill="' + main.color + '" fill-opacity="0.10"/>';
    for (let s = series.length - 1; s >= 0; s--) {
        const ser = series[s];
        paths += '<path d="' + pathOf(ser.values) + '" fill="none" stroke="' + ser.color +
                 '" stroke-width="2"' + (ser.dashed ? ' stroke-dasharray="5 4"' : '') +
                 ' stroke-linecap="round" stroke-linejoin="round"' + NS + '/>';
    }

    /* Direkte Beschriftung nur an Extremen der Hauptserie */
    let iMax = -1, iMin = -1;
    main.values.forEach(function (v, i) {
        if (!isNum(v)) return;
        if (iMax < 0 || v > main.values[iMax]) iMax = i;
        if (iMin < 0 || v < main.values[iMin]) iMin = i;
    });
    function extremum(i, above) {
        const v = main.values[i];
        const ty = above ? Math.max(padT + 9, y(v) - 8) : Math.min(padT + ih - 3, y(v) + 15);
        const anchor = i < 3 ? "start" : (i > n - 4 ? "end" : "middle");
        return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5" fill="' + main.color + '" stroke="#12233f" stroke-width="2"/>' +
               '<text x="' + x(i).toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="' + anchor +
               '" font-size="11" font-weight="600" fill="#eaf1fb">' + Math.round(v) + cfg.unit + '</text>';
    }
    let marks = iMax >= 0 ? extremum(iMax, true) : "";
    if (!cfg.zeroBase && iMin >= 0 && iMin !== iMax) marks += extremum(iMin, false);

    box.innerHTML =
        '<div class="chart-wrap">' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (cfg.aria || "Verlauf") + '">' +
            night + grid + xa + paths + marks +
            '<line class="chart-cursor" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + ih) + '" stroke="rgba(255,255,255,0.35)" stroke-width="1"' + NS + ' style="display:none"/>' +
        '</svg>' +
        '<div class="chart-tip"></div>' +
        '</div>' +
        '<div class="chart-legend">' +
            series.map(function (s) {
                return '<span><i style="border-top-color:' + s.color + (s.dashed ? ';border-top-style:dashed' : '') + '"></i>' + s.label + '</span>';
            }).join("") +
        '</div>';

    /* Hover/Touch: Fadenkreuz + Tooltip */
    const wrapEl = box.querySelector(".chart-wrap");
    const svg = wrapEl.querySelector("svg");
    const cursor = wrapEl.querySelector(".chart-cursor");
    const tip = wrapEl.querySelector(".chart-tip");

    function onMove(ev) {
        const rect = svg.getBoundingClientRect();
        const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
        const rel = (px / rect.width * W - padL) / iw;
        const i = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
        cursor.setAttribute("x1", x(i)); cursor.setAttribute("x2", x(i));
        cursor.style.display = "";
        tip.style.display = "block";
        tip.style.left = (x(i) / W * rect.width) + "px";
        tip.innerHTML = weekday(dayOf(times[i])) + " " + hhmm(times[i]) + " Uhr<br>" +
            series.map(function (s, k) {
                const v = s.values[i];
                return (k === 0 ? "<b>" : "") + (isNum(v) ? Math.round(v) + cfg.unit : "–") + (k === 0 ? "</b>" : "") +
                       " " + s.label;
            }).join(" · ");
        if (ev.touches) ev.preventDefault();
    }
    function onLeave() { cursor.style.display = "none"; tip.style.display = "none"; }

    svg.addEventListener("mousemove", onMove);
    svg.addEventListener("mouseleave", onLeave);
    svg.addEventListener("touchstart", onMove, { passive: false });
    svg.addEventListener("touchmove", onMove, { passive: false });
    svg.addEventListener("touchend", onLeave);
}

/* ------------------------------------------------------------------ *
 * Rendering der Karten
 * ------------------------------------------------------------------ */

function renderNow(fc) {
    const c = fc.current;
    const icon = wmo(c.weather_code);
    $("now").classList.remove("skeleton");
    $("now").innerHTML =
        '<div class="now">' +
            '<div class="now-icon">' + icon[0] + '</div>' +
            '<div>' +
                '<div class="now-temp">' + Math.round(c.temperature_2m) + '°</div>' +
                '<div class="now-desc">' + icon[1] + ' · gefühlt ' + Math.round(c.apparent_temperature) + '°</div>' +
            '</div>' +
        '</div>' +
        '<div class="now-meta">' +
            '<span class="chip">Niederschlag jetzt <b>' + fmtMm(c.precipitation) + ' mm/h</b></span>' +
            '<span class="chip">Wind <b>' + Math.round(c.wind_speed_10m) + ' km/h</b> aus <b>' + compass(c.wind_direction_10m) + '</b></span>' +
            '<span class="chip">Böen <b>' + Math.round(c.wind_gusts_10m) + ' km/h</b></span>' +
            '<span class="chip">Luftfeuchte <b>' + Math.round(c.relative_humidity_2m) + ' %</b></span>' +
            '<span class="chip">Luftdruck <b>' + fmtNum(c.pressure_msl, 0) + ' hPa</b></span>' +
            '<span class="chip">Bewölkung <b>' + fmtNum(c.cloud_cover, 0) + ' %</b></span>' +
        '</div>';
}

function renderNowcast(fc) {
    const box = $("nowcast");
    box.classList.remove("skeleton");

    const m = fc.minutely_15;
    if (!m || !m.time || !m.precipitation) {
        box.innerHTML = '<div class="nowcast-lead">Für diesen Ort liegt keine 15-Minuten-Auflösung vor.</div>';
        return;
    }

    const start = firstIndexFrom(m.time, fc.current.time.slice(0, 16));
    if (start < 0) {
        box.innerHTML = '<div class="nowcast-lead">Keine aktuellen Nowcast-Daten verfügbar.</div>';
        return;
    }

    const times = m.time.slice(start, start + 16);
    const vals = m.precipitation.slice(start, start + 16).map(function (v) { return isNum(v) ? v : 0; });

    const total = vals.reduce(function (a, b) { return a + b; }, 0);
    const firstWet = vals.findIndex(function (v) { return v >= 0.1; });

    let lead, cls;
    if (firstWet < 0) {
        lead = "Kein Niederschlag in den nächsten 4 Stunden.";
        cls = "dry";
    } else if (firstWet === 0) {
        lead = "Es regnet gerade – in den nächsten 4 Stunden zusammen etwa " + fmtMm(total) + " mm.";
        cls = "wet";
    } else {
        lead = "Regen ab ca. " + hhmm(times[firstWet]) + " Uhr (in " + (firstWet * 15) +
               " Minuten), insgesamt etwa " + fmtMm(total) + " mm.";
        cls = "wet";
    }

    const peak = Math.max.apply(null, vals.concat([0.5]));
    let bars = "", axis = "";
    for (let i = 0; i < vals.length; i++) {
        const h = vals[i] > 0 ? Math.max(6, Math.round(vals[i] / peak * 100)) : 0;
        bars += '<div class="mini-col" title="' + hhmm(times[i]) + ' · ' + fmtMm(vals[i]) + ' mm">' +
                    '<div class="mini-bar' + (vals[i] > 0 ? '' : ' empty') + '" style="height:' + (h || 3) + '%"></div>' +
                '</div>';
        axis += '<span>' + (i % 4 === 0 ? hhmm(times[i]) : '') + '</span>';
    }

    box.innerHTML =
        '<div class="nowcast-lead ' + cls + '">' + lead + '</div>' +
        '<div class="mini-bars">' + bars + '</div>' +
        '<div class="mini-axis">' + axis + '</div>';
}

function hourlyWindow(fc, hours) {
    const h = fc.hourly;
    const start = Math.max(0, firstIndexFrom(h.time, fc.current.time.slice(0, 13)));
    const end = Math.min(start + hours, h.time.length);
    return { start: start, end: end, slice: function (arr) { return (arr || []).slice(start, end); } };
}

function renderTempChart(fc) {
    const box = $("tempchart");
    if (!box) return;
    box.classList.remove("skeleton");
    const w = hourlyWindow(fc, 48);
    lineChart(box, {
        times: w.slice(fc.hourly.time),
        isDay: w.slice(fc.hourly.is_day),
        unit: "°",
        aria: "Temperaturverlauf der nächsten 48 Stunden",
        series: [
            { values: w.slice(fc.hourly.temperature_2m), color: COLOR.temp, label: "Temperatur" },
            { values: w.slice(fc.hourly.apparent_temperature), color: COLOR.feels, dashed: true, label: "gefühlt" }
        ]
    });
}

function renderSun(fc) {
    const box = $("sun");
    if (!box) return;
    box.classList.remove("skeleton");

    const c = fc.current, d = fc.daily, h = fc.hourly;
    const w = hourlyWindow(fc, 24);
    const uvNow = h.uv_index ? h.uv_index[w.start] : null;
    const uvMax = d.uv_index_max ? d.uv_index_max[0] : null;
    const lvNow = uvLevel(uvNow), lvMax = uvLevel(uvMax);

    const stat = function (k, v, sub) {
        return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div>' +
               (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
    };

    box.innerHTML =
        '<div class="stats">' +
            stat("Sonnenaufgang", "🌅 " + hhmm(d.sunrise && d.sunrise[0]), null) +
            stat("Sonnenuntergang", "🌇 " + hhmm(d.sunset && d.sunset[0]), null) +
            stat("Tageslänge", fmtDuration(d.daylight_duration && d.daylight_duration[0]),
                 isNum(d.sunshine_duration && d.sunshine_duration[0]) ? "davon Sonne " + fmtDuration(d.sunshine_duration[0]) : null) +
            stat("UV-Index jetzt", isNum(uvNow) ? fmtNum(uvNow, 1) + (lvNow ? ' <span class="st ' + lvNow.st + '">' + lvNow.ico + ' ' + lvNow.word + '</span>' : '') : "–",
                 isNum(uvMax) ? "Tagesmaximum " + fmtNum(uvMax, 1) + (lvMax ? " (" + lvMax.word + ")" : "") : null) +
            stat("Wind jetzt", Math.round(c.wind_speed_10m) + ' km/h <span class="dir" style="transform:rotate(' + (isNum(c.wind_direction_10m) ? c.wind_direction_10m : 0) + 'deg)">↓</span> ' + compass(c.wind_direction_10m),
                 "Böen bis " + Math.round(c.wind_gusts_10m) + " km/h") +
            stat("Wind heute max.", (isNum(d.wind_speed_10m_max && d.wind_speed_10m_max[0]) ? Math.round(d.wind_speed_10m_max[0]) : "–") + " km/h",
                 "Böen bis " + (isNum(d.wind_gusts_10m_max && d.wind_gusts_10m_max[0]) ? Math.round(d.wind_gusts_10m_max[0]) : "–") +
                 " km/h · vorwiegend aus " + compass(d.wind_direction_10m_dominant && d.wind_direction_10m_dominant[0])) +
        '</div>' +
        '<div class="sub-h">Windverlauf · nächste 24 Stunden</div>' +
        '<div id="windchart"></div>';

    lineChart($("windchart"), {
        times: w.slice(h.time),
        isDay: w.slice(h.is_day),
        unit: "",
        zeroBase: true,
        minSpan: 20,
        aria: "Windverlauf der nächsten 24 Stunden in km/h",
        series: [
            { values: w.slice(h.wind_speed_10m), color: COLOR.wind, label: "Wind km/h" },
            { values: w.slice(h.wind_gusts_10m), color: COLOR.gust, dashed: true, label: "Böen km/h" }
        ]
    });
}

function renderHourly(fc, ens) {
    const box = $("hourly");
    box.classList.remove("skeleton");

    const h = fc.hourly;
    const w = hourlyWindow(fc, 48);

    const members = ens ? ensembleSeries(ens.hourly) : [];
    const ensIndex = {};
    if (ens && ens.hourly && ens.hourly.time) {
        ens.hourly.time.forEach(function (t, i) { ensIndex[t] = i; });
    }

    const probs = h.precipitation_probability || [];
    const rain = h.precipitation || [];

    let usedEnsemble = false;
    let cols = "";
    let prevDay = null;

    for (let i = w.start; i < w.end; i++) {
        const t = h.time[i];
        const stats = members.length && ensIndex[t] !== undefined
            ? ensembleStats(members, ensIndex[t]) : null;
        if (stats) usedEnsemble = true;

        const prob = stats ? stats.prob : (isNum(probs[i]) ? probs[i] : 0);
        const mm = stats && stats.median !== null && stats.median > 0
                   ? Math.max(stats.median, rain[i] || 0)
                   : (rain[i] || 0);

        const d = dayOf(t);
        const isNewDay = prevDay !== null && d !== prevDay;
        prevDay = d;

        const night = h.is_day && h.is_day[i] === 0;
        const icon = wmo(h.weather_code[i]);
        const temp = isNum(h.temperature_2m && h.temperature_2m[i]) ? Math.round(h.temperature_2m[i]) + "°" : "–";

        cols +=
            '<div class="hour' + (night ? ' night' : '') + (isNewDay ? ' newday' : '') + '">' +
                '<div class="hour-time">' + (isNewDay ? weekday(d) : hhmm(t)) + '</div>' +
                '<div class="hour-temp">' + temp + '</div>' +
                '<div class="hour-prob">' + Math.round(prob) + '%</div>' +
                '<div class="hour-track"><div class="hour-fill" style="height:' +
                    Math.max(2, Math.min(100, prob)) + '%"></div></div>' +
                '<div class="hour-mm">' + (mm >= 0.1 ? fmtMm(mm) : '') + '</div>' +
                '<div class="hour-icon">' + icon[0] + '</div>' +
            '</div>';
    }

    box.innerHTML = '<div class="scroller">' + cols + '</div>';
    $("hourlyNote").textContent = usedEnsemble
        ? "Wahrscheinlichkeit aus dem ICON-D2-Ensemble ausgezählt: Anteil der Läufe mit mindestens 0,1 mm in der Stunde. mm-Wert = Median der Läufe. Nach Ende des Ensembles (ca. 48 h) greift das Einzelmodell."
        : "Wahrscheinlichkeit aus dem Standardmodell. Das ICON-D2-Ensemble deckt diesen Ort nicht ab oder war nicht erreichbar.";
}

function renderDaily(fc) {
    const box = $("daily");
    box.classList.remove("skeleton");

    const d = fc.daily;
    const days = Math.min(7, d.time.length);
    const maxSum = Math.max.apply(null, d.precipitation_sum.slice(0, days).map(function (v) { return v || 0; }).concat([5]));

    const tLo = Math.min.apply(null, d.temperature_2m_min.slice(0, days));
    const tHi = Math.max.apply(null, d.temperature_2m_max.slice(0, days));
    const tSpan = Math.max(1, tHi - tLo);

    let rows = "";
    for (let i = 0; i < days; i++) {
        const icon = wmo(d.weather_code[i]);
        const sum = d.precipitation_sum[i] || 0;
        const prob = d.precipitation_probability_max[i];
        const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i];
        const left = (lo - tLo) / tSpan * 100;
        const width = Math.max(4, (hi - lo) / tSpan * 100);
        rows +=
            '<div class="day">' +
                '<div class="day-name">' + (i === 0 ? "Heute" : weekday(d.time[i])) + '</div>' +
                '<div class="day-icon">' + icon[0] + '</div>' +
                '<div class="day-prob">' + (isNum(prob) ? prob + "%" : "–") + '</div>' +
                '<div class="day-bar-wrap"><div class="day-bar" style="width:' +
                    Math.min(100, Math.round(sum / maxSum * 100)) + '%"></div></div>' +
                '<div class="day-mm">' + fmtMm(sum) + ' mm</div>' +
                '<div class="day-range">' +
                    '<span class="lo">' + Math.round(lo) + '°</span>' +
                    '<span class="track"><span class="fill" style="left:' + left.toFixed(0) + '%;width:' + width.toFixed(0) + '%"></span></span>' +
                    '<span class="hi">' + Math.round(hi) + '°</span>' +
                '</div>' +
            '</div>';
    }
    box.innerHTML = rows;
}

/* 14-Tage-Trend: zwei Panels mit je eigener Achse (Temperaturspanne, Niederschlag) */
function renderTrend(fc) {
    const box = $("trend");
    if (!box) return;
    box.classList.remove("skeleton");

    const d = fc.daily;
    const n = d.time.length;
    if (n < 8) { box.innerHTML = '<div class="note">Für diesen Ort liegt keine 14-Tage-Vorhersage vor.</div>'; return; }

    const W = 420, H = 250;
    const padL = 32, padR = 8;
    const topT = 18, topH = 112;               /* Panel Temperatur */
    const botT = topT + topH + 30, botH = 58;  /* Panel Niederschlag */
    const iw = W - padL - padR;
    const slot = iw / n;
    const barW = Math.min(20, slot * 0.6);
    const cx = function (i) { return padL + slot * (i + 0.5); };

    const tmin = d.temperature_2m_min, tmax = d.temperature_2m_max;
    let lo = Math.floor(Math.min.apply(null, tmin.filter(isNum))) - 1;
    let hi = Math.ceil(Math.max.apply(null, tmax.filter(isNum))) + 1;
    if (hi - lo < 8) { const mid = (hi + lo) / 2; lo = Math.floor(mid - 4); hi = Math.ceil(mid + 4); }
    const ty = function (v) { return topT + (hi - v) / (hi - lo) * topH; };

    const sums = d.precipitation_sum.map(function (v) { return isNum(v) ? v : 0; });
    const pMax = Math.max(2, Math.ceil(Math.max.apply(null, sums)));
    const py = function (v) { return botT + botH - v / pMax * botH; };

    let svg = "";

    /* Temperatur-Gitter */
    const step = (hi - lo) > 24 ? 10 : 5;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
        svg += '<line x1="' + padL + '" y1="' + ty(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ty(v).toFixed(1) + '" stroke="rgba(255,255,255,0.09)"/>' +
               '<text x="' + (padL - 6) + '" y="' + (ty(v) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="#7f95b4">' + v + '°</text>';
    }
    /* Niederschlag-Gitter: Nulllinie + Maximum */
    svg += '<line x1="' + padL + '" y1="' + py(0).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + py(0).toFixed(1) + '" stroke="rgba(255,255,255,0.13)"/>' +
           '<text x="' + (padL - 6) + '" y="' + (py(0) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="#7f95b4">0</text>' +
           '<line x1="' + padL + '" y1="' + py(pMax).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + py(pMax).toFixed(1) + '" stroke="rgba(255,255,255,0.09)"/>' +
           '<text x="' + (padL - 6) + '" y="' + (py(pMax) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="#7f95b4">' + pMax + '</text>';

    /* Wochenenden leicht hervorheben, Achsenbeschriftung */
    let iMaxT = 0, iMinT = 0, iMaxP = 0;
    for (let i = 0; i < n; i++) {
        const wd = weekday(d.time[i]);
        if (wd === "Sa" || wd === "So") {
            svg += '<rect x="' + (padL + slot * i).toFixed(1) + '" y="' + topT + '" width="' + slot.toFixed(1) + '" height="' + (botT + botH - topT) + '" fill="rgba(255,255,255,0.03)"/>';
        }
        svg += '<text x="' + cx(i).toFixed(1) + '" y="' + (H - 16) + '" text-anchor="middle" font-size="10" font-weight="' + (i === 0 ? 600 : 400) + '" fill="' + (i === 0 ? "#eaf1fb" : "#9fb3d1") + '">' + (i === 0 ? "Heute" : wd) + '</text>' +
               '<text x="' + cx(i).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" font-size="9" fill="#6f86a8">' + ddmm(d.time[i]).slice(0, 5) + '</text>';
        if (isNum(tmax[i]) && tmax[i] > tmax[iMaxT]) iMaxT = i;
        if (isNum(tmin[i]) && tmin[i] < tmin[iMinT]) iMinT = i;
        if (sums[i] > sums[iMaxP]) iMaxP = i;
    }

    /* Temperaturspannen als Balken min→max, Niederschlag als Säulen */
    for (let i = 0; i < n; i++) {
        if (isNum(tmin[i]) && isNum(tmax[i])) {
            const y1 = ty(tmax[i]), y2 = ty(tmin[i]);
            svg += '<rect class="hit" data-i="' + i + '" x="' + (cx(i) - barW / 2).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(4, y2 - y1).toFixed(1) + '" rx="4" fill="' + COLOR.temp + '" fill-opacity="0.85"/>';
        }
        if (sums[i] > 0) {
            svg += '<rect class="hit" data-i="' + i + '" x="' + (cx(i) - barW / 2).toFixed(1) + '" y="' + py(sums[i]).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + (py(0) - py(sums[i])).toFixed(1) + '" rx="4" fill="' + COLOR.rain + '" fill-opacity="0.85"/>';
        }
    }

    /* Direkte Beschriftung: wärmster/kältester Tag, nassester Tag */
    svg += '<text x="' + cx(iMaxT).toFixed(1) + '" y="' + (ty(tmax[iMaxT]) - 6).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#eaf1fb">' + Math.round(tmax[iMaxT]) + '°</text>' +
           '<text x="' + cx(iMinT).toFixed(1) + '" y="' + (ty(tmin[iMinT]) + 14).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#eaf1fb">' + Math.round(tmin[iMinT]) + '°</text>';
    if (sums[iMaxP] > 0) {
        svg += '<text x="' + cx(iMaxP).toFixed(1) + '" y="' + (py(sums[iMaxP]) - 5).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#eaf1fb">' + fmtMm(sums[iMaxP]) + '</text>';
    }

    /* Panel-Titel */
    svg += '<text x="' + padL + '" y="10" font-size="10" fill="#9fb3d1">Temperatur min–max</text>' +
           '<text x="' + padL + '" y="' + (botT - 9) + '" font-size="10" fill="#9fb3d1">Niederschlag mm</text>';

    box.innerHTML =
        '<div class="chart-wrap">' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="14-Tage-Trend: Temperaturspanne und Niederschlag je Tag">' + svg + '</svg>' +
        '<div class="chart-tip"></div>' +
        '</div>' +
        '<div class="chart-legend">' +
            '<span><i class="box" style="background:' + COLOR.temp + '"></i>Temperaturspanne</span>' +
            '<span><i class="box" style="background:' + COLOR.rain + '"></i>Niederschlag</span>' +
        '</div>';

    /* Tooltip je Tag */
    const wrapEl = box.querySelector(".chart-wrap");
    const svgEl = wrapEl.querySelector("svg");
    const tip = wrapEl.querySelector(".chart-tip");
    function show(ev) {
        const rect = svgEl.getBoundingClientRect();
        const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
        const i = Math.max(0, Math.min(n - 1, Math.floor((px / rect.width * W - padL) / slot)));
        const icon = wmo(d.weather_code[i]);
        tip.style.display = "block";
        tip.style.left = (cx(i) / W * rect.width) + "px";
        tip.innerHTML = (i === 0 ? "Heute" : weekday(d.time[i])) + " " + ddmm(d.time[i]) + " " + icon[0] + "<br>" +
            "<b>" + Math.round(tmax[i]) + "° / " + Math.round(tmin[i]) + "°</b> · " + fmtMm(sums[i]) + " mm" +
            (isNum(d.precipitation_probability_max[i]) ? " · " + d.precipitation_probability_max[i] + " %" : "");
        if (ev.touches) ev.preventDefault();
    }
    function hide() { tip.style.display = "none"; }
    svgEl.addEventListener("mousemove", show);
    svgEl.addEventListener("mouseleave", hide);
    svgEl.addEventListener("touchstart", show, { passive: false });
    svgEl.addEventListener("touchmove", show, { passive: false });
    svgEl.addEventListener("touchend", hide);
}

function renderModels(md, fc, ens) {
    const box = $("models");
    box.classList.remove("skeleton");

    if (!md || !md.daily) {
        box.innerHTML = '<div class="note">Modellvergleich derzeit nicht verfügbar.</div>';
        return;
    }

    const days = md.daily.time || [];
    const labels = [];
    for (let i = 0; i < Math.min(3, days.length); i++) {
        labels.push(i === 0 ? "Heute" : (i === 1 ? "Morgen" : weekday(days[i])));
    }

    let rows = "";
    MODELS.forEach(function (m) {
        const series = md.daily["precipitation_sum_" + m.id];
        if (!Array.isArray(series)) return;
        let cells = "";
        let any = false;
        for (let i = 0; i < labels.length; i++) {
            const v = series[i];
            if (isNum(v)) {
                any = true;
                cells += '<td class="val' + (v < 0.05 ? ' zero' : '') + '">' + fmtMm(v) + '</td>';
            } else {
                cells += '<td class="val zero">–</td>';
            }
        }
        if (!any) return;
        rows += '<tr><td class="model">' + m.name + '<small>' + m.sub + '</small></td>' + cells + '</tr>';
    });

    if (!rows) {
        box.innerHTML = '<div class="note">Modellvergleich derzeit nicht verfügbar.</div>';
        return;
    }

    let html =
        '<table><thead><tr><th>Modell</th>' +
        labels.map(function (l) { return '<th>' + l + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows + '</tbody></table>';

    if (ens && ens.hourly && ens.hourly.time) {
        const members = ensembleSeries(ens.hourly);
        const start = firstIndexFrom(ens.hourly.time, fc.current.time.slice(0, 13));
        if (members.length >= 3 && start >= 0) {
            const end = Math.min(start + 24, ens.hourly.time.length);
            const sums = members.map(function (s) {
                let t = 0;
                for (let i = start; i < end; i++) if (isNum(s[i])) t += s[i];
                return t;
            }).sort(function (a, b) { return a - b; });

            const wet = sums.filter(function (v) { return v >= 0.1; }).length;
            html +=
                '<div class="note" style="margin-top:16px">Bandbreite der nächsten 24 Stunden ' +
                    '(' + sums.length + ' ICON-D2-Ensemble-Läufe):</div>' +
                '<div class="spread">' +
                    '<div><div class="k">trockenste</div><div class="v">' + fmtMm(sums[0]) + ' mm</div></div>' +
                    '<div><div class="k">Median</div><div class="v">' + fmtMm(quantile(sums, 0.5)) + ' mm</div></div>' +
                    '<div><div class="k">nasseste</div><div class="v">' + fmtMm(sums[sums.length - 1]) + ' mm</div></div>' +
                    '<div><div class="k">Läufe mit Regen</div><div class="v">' +
                        Math.round(wet / sums.length * 100) + ' %</div></div>' +
                '</div>';
        }
    }

    box.innerHTML = html;
}

function renderAir(air) {
    const box = $("air");
    if (!box) return;
    box.classList.remove("skeleton");

    if (!air || !air.current) {
        box.innerHTML = '<div class="note">Luftqualitätsdaten sind für diesen Ort derzeit nicht verfügbar.</div>';
        return;
    }

    const c = air.current;
    const lv = aqiLevel(c.european_aqi);
    let html = '';

    if (lv) {
        html +=
            '<div class="aqi">' +
                '<div class="aqi-val">' + Math.round(c.european_aqi) + '</div>' +
                '<div>' +
                    '<div class="aqi-word"><span class="st ' + lv.st + '">' + lv.ico + ' ' + lv.word + '</span></div>' +
                    '<div class="aqi-sub">Europäischer Luftqualitätsindex (0–100+)</div>' +
                '</div>' +
            '</div>';
    } else {
        html += '<div class="note">Kein Luftqualitätsindex verfügbar.</div>';
    }

    html +=
        '<div class="now-meta">' +
            '<span class="chip">Feinstaub PM2,5 <b>' + fmtNum(c.pm2_5, 0) + ' µg/m³</b></span>' +
            '<span class="chip">PM10 <b>' + fmtNum(c.pm10, 0) + ' µg/m³</b></span>' +
            '<span class="chip">Ozon <b>' + fmtNum(c.ozone, 0) + ' µg/m³</b></span>' +
            '<span class="chip">Stickstoffdioxid <b>' + fmtNum(c.nitrogen_dioxide, 0) + ' µg/m³</b></span>' +
        '</div>';

    /* Pollen: aktueller Wert + Tagesmaximum je Art */
    const anyPollen = POLLEN.some(function (p) { return isNum(c[p.key]); });
    html += '<div class="sub-h">Pollenflug</div>';
    if (!anyPollen) {
        html += '<div class="note">Pollendaten sind nur für Europa verfügbar.</div>';
    } else {
        const hourly = air.hourly || {};
        html += '<div class="pollen">';
        POLLEN.forEach(function (p) {
            const v = c[p.key];
            const lvp = pollenLevel(v, p.thr);
            if (!lvp) return;
            const series = (hourly[p.key] || []).filter(isNum);
            const dayMax = series.length ? Math.max.apply(null, series) : null;
            const pct = Math.min(100, Math.round(v / p.thr[2] * 100));
            html +=
                '<div class="pollen-row">' +
                    '<div class="pollen-name">' + p.name + '</div>' +
                    '<div class="pollen-bar"><div class="pollen-fill st-bg ' + lvp.st + '" style="width:' + pct + '%"></div></div>' +
                    '<div class="pollen-val"><span class="st ' + lvp.st + '">' + lvp.ico + ' ' + lvp.word + '</span>' +
                        '<small>' + fmtNum(v, 0) + (isNum(dayMax) && dayMax > v ? ' · max. ' + fmtNum(dayMax, 0) : '') + ' /m³</small></div>' +
                '</div>';
        });
        html += '</div>';
    }

    box.innerHTML = html;
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

function renderAll(payload) {
    renderNow(payload.fc);
    renderNowcast(payload.fc);
    renderTempChart(payload.fc);
    renderSun(payload.fc);
    renderHourly(payload.fc, payload.ens);
    renderDaily(payload.fc);
    renderTrend(payload.fc);
    renderModels(payload.md, payload.fc, payload.ens);
    renderAir(payload.air);
}

function setUpdated(iso) {
    const d = new Date(iso);
    $("updated").textContent = "Stand: " + d.toLocaleString("de-DE", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    }) + " Uhr";
}

function initWeatherApp() {
    let currentLoc = null;      /* { id, name, lat, lon, source: "gps" | "search" } */
    let loading = false;

    function subline(loc) {
        /* Koordinaten als nicht umbrechender Block – auf schmalen Screens
           wandern sie geschlossen in die zweite Zeile */
        $("subline").innerHTML = '<span>' + (loc.source === "search" ? "🔍 " : "📍 ") + loc.name + '</span> ' +
            '<span class="nowrap">· ' + loc.lat.toFixed(2).replace(".", ",") + '°&nbsp;N, ' +
            loc.lon.toFixed(2).replace(".", ",") + '°&nbsp;O</span>';
        const gps = $("gpsBtn");
        if (gps) gps.classList.toggle("hidden", loc.source !== "search");
    }

    async function load() {
        if (loading || !currentLoc) return;
        loading = true;

        const btn = $("reload");
        btn.classList.add("spin");
        $("error").classList.add("hidden");
        $("stale").classList.add("hidden");
        subline(currentLoc);

        const results = await Promise.allSettled([
            fetchForecast(currentLoc),
            fetchEnsemble(currentLoc),
            fetchModels(currentLoc),
            fetchAir(currentLoc)
        ]);
        const val = function (i) { return results[i].status === "fulfilled" ? results[i].value : null; };
        const fc = val(0);

        if (fc) {
            const payload = { fc: fc, ens: val(1), md: val(2), air: val(3) };
            renderAll(payload);
            saveCache(currentLoc, payload);
            setUpdated(new Date().toISOString());
        } else {
            const cached = loadCache(currentLoc);
            if (cached) {
                renderAll(cached.payload);
                setUpdated(cached.savedAt);
                $("stale").textContent = "Keine Verbindung – angezeigt werden die zuletzt gespeicherten Daten.";
                $("stale").classList.remove("hidden");
            } else {
                $("error").textContent = "Die Wetterdaten konnten nicht geladen werden (" +
                    (results[0].reason && results[0].reason.message ? results[0].reason.message : "Netzwerkfehler") +
                    "). Bitte Verbindung prüfen und erneut laden.";
                $("error").classList.remove("hidden");
            }
        }

        btn.classList.remove("spin");
        loading = false;
    }

    /* ---------- GPS ---------- */

    function geoError(message, withRetry) {
        const el = $("error");
        el.innerHTML = message +
            (withRetry ? '<button class="locbtn" id="geoRetry">📍 Standort erneut abfragen</button>' : '') +
            '<button class="locbtn" id="geoSearch">🔍 Stattdessen einen Ort suchen</button>';
        el.classList.remove("hidden");
        const retry = $("geoRetry");
        if (retry) retry.addEventListener("click", locate);
        $("geoSearch").addEventListener("click", function () {
            const inp = $("placeSearch");
            if (inp) inp.focus();
        });
    }

    function useGps(lat, lon) {
        const cachedPos = loadPos();
        const known = cachedPos && distanceKm(lat, lon, cachedPos.lat, cachedPos.lon) < 2 ? cachedPos.name : null;
        currentLoc = { id: locId(lat, lon), name: known || "Dein Standort", lat: lat, lon: lon, source: "gps" };
        savePos({ lat: lat, lon: lon, name: currentLoc.name });
        if (!known) {
            fetchPlace(lat, lon).then(function (p) {
                if (!p || !currentLoc || currentLoc.source !== "gps") return;
                currentLoc.name = p;
                subline(currentLoc);
                savePos({ lat: lat, lon: lon, name: p });
            });
        }
        load();
    }

    function locate() {
        if (!("geolocation" in navigator)) {
            geoError("Dein Browser unterstützt keine Standortabfrage. ", false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            function (pos) {
                $("error").classList.add("hidden");
                useGps(pos.coords.latitude, pos.coords.longitude);
            },
            function (err) {
                if (currentLoc) return;   /* Cache-Position läuft schon – still bleiben */
                if (err.code === 1) {
                    geoError("Der Standortzugriff wurde abgelehnt. Erlauben kannst du ihn in den iPhone-Einstellungen unter Datenschutz → Ortungsdienste → Safari. ", false);
                } else {
                    geoError("Der Standort konnte nicht ermittelt werden (" + (err.message || "Fehler") + "). ", true);
                }
            },
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 }
        );
    }

    /* ---------- Ortssuche ---------- */

    function initSearch() {
        const inp = $("placeSearch"), list = $("placeResults");
        if (!inp || !list) return;
        let timer = null, seq = 0;

        function hide() { list.classList.add("hidden"); list.innerHTML = ""; }

        function pick(r) {
            currentLoc = { id: locId(r.lat, r.lon), name: r.name, lat: r.lat, lon: r.lon, source: "search" };
            inp.value = "";
            hide();
            inp.blur();
            load();
        }

        inp.addEventListener("input", function () {
            const q = inp.value.trim();
            clearTimeout(timer);
            if (q.length < 2) { hide(); return; }
            timer = setTimeout(async function () {
                const my = ++seq;
                let results = [];
                try { results = await searchPlaces(q); } catch (e) { results = []; }
                if (my !== seq) return;
                if (!results.length) {
                    list.innerHTML = '<div class="place-none">Kein Ort gefunden.</div>';
                } else {
                    list.innerHTML = results.map(function (r, i) {
                        return '<button type="button" class="place" data-i="' + i + '">' + r.name + '</button>';
                    }).join("");
                    list.querySelectorAll(".place").forEach(function (b) {
                        b.addEventListener("click", function () { pick(results[+b.getAttribute("data-i")]); });
                    });
                }
                list.classList.remove("hidden");
            }, 350);
        });

        inp.addEventListener("keydown", function (ev) {
            if (ev.key === "Escape") { inp.value = ""; hide(); inp.blur(); }
        });

        const gps = $("gpsBtn");
        if (gps) gps.addEventListener("click", function () {
            currentLoc = null;
            hide();
            const cached = loadPos();
            if (cached) {
                currentLoc = { id: locId(cached.lat, cached.lon), name: cached.name || "Dein Standort", lat: cached.lat, lon: cached.lon, source: "gps" };
                load();
            }
            locate();
        });
    }

    /* ---------- Start ---------- */

    $("reload").addEventListener("click", function () {
        if (!currentLoc) locate(); else load();
    });

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) return;
        if (!currentLoc || currentLoc.source === "gps") locate(); else load();
    });

    initSearch();

    /* Letzte bekannte Position sofort rendern, parallel neu orten –
       beim Öffnen gilt immer der aktuelle Standort. */
    const cached = loadPos();
    if (cached) {
        currentLoc = { id: locId(cached.lat, cached.lon), name: cached.name || "Dein Standort", lat: cached.lat, lon: cached.lon, source: "gps" };
        load();
    }
    locate();
}

if (typeof window !== "undefined") {
    window.initWeatherApp = initWeatherApp;
    window.WETTER = { POS_KEY: POS_KEY, CACHE_PREFIX: CACHE_PREFIX };
}
