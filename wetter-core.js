/* Gemeinsamer Kern der Wetter-App.
 *
 * Zwei Modi über initWeatherApp(config):
 *   { mode: "geo" }    – Startseite: Vorhersage für den aktuellen GPS-Standort
 *   { mode: "sites" }  – Unterseite: feste Standortliste (Lignano) mit Dropdown
 *
 * Datenquellen: Open-Meteo (Forecast, ICON-D2-Ensemble, Multi-Modell),
 * Ortsname per BigDataCloud-Reverse-Geocoding (nur im geo-Modus).
 */
"use strict";

/* ------------------------------------------------------------------ *
 * Konstanten
 * ------------------------------------------------------------------ */

const SITES = [
    { id: "sabbiadoro",   name: "Camping Sabbiadoro",              lat: 45.6957, lon: 13.1291 },
    { id: "pinomare",     name: "Camping Pino Mare (Riviera)",     lat: 45.6640, lon: 13.1005 },
    { id: "villaggio",    name: "Villaggio Turistico Int. (Riviera)", lat: 45.6683, lon: 13.1114 },
    { id: "pineta",       name: "Lignano Pineta (Strand)",         lat: 45.6733, lon: 13.1183 },
    { id: "sabbiadoro_strand", name: "Lignano Sabbiadoro (Strand)", lat: 45.6822, lon: 13.1444 }
];
const CAMP = SITES[0];

const MODELS = [
    { id: "icon_d2",                    name: "ICON-D2",   sub: "DWD · 2,2 km" },
    { id: "italia_meteo_arpae_icon_2i", name: "ICON-2I",   sub: "ARPAE Italien · 2,2 km" },
    { id: "icon_eu",                    name: "ICON-EU",   sub: "DWD · 7 km" },
    { id: "ecmwf_ifs025",               name: "ECMWF IFS", sub: "0,25°" },
    { id: "meteofrance_arpege_europe",  name: "ARPEGE",    sub: "Météo-France · 11 km" },
    { id: "gfs_seamless",               name: "GFS",       sub: "NOAA" }
];

const CACHE_PREFIX = "lignano-wetter:";
const GEO_POS_KEY = CACHE_PREFIX + "geopos";

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
        forecast_days: 7,
        current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day",
        minutely_15: "precipitation",
        hourly: "temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,is_day",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,precipitation_hours,wind_gusts_10m_max"
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

/* ------------------------------------------------------------------ *
 * Hilfsfunktionen
 * ------------------------------------------------------------------ */

/* Open-Meteo liefert Zeitstempel bereits in Ortszeit ("2026-08-17T14:00").
   Deshalb wird hier bewusst mit Strings gearbeitet – kein Umrechnen,
   keine Zeitzonenfallen auf dem Gerät des Nutzers. */
function firstIndexFrom(times, from) {
    for (let i = 0; i < times.length; i++) {
        if (times[i] >= from) return i;
    }
    return -1;
}

function hhmm(t) { return t.slice(11, 16); }
function dayOf(t) { return t.slice(0, 10); }

function fmtMm(v) {
    if (v === null || v === undefined || isNaN(v)) return "–";
    if (v < 0.05) return "0";
    return (v < 10 ? v.toFixed(1) : Math.round(v).toString()).replace(".", ",");
}

function weekday(dateStr) {
    const names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const p = dateStr.split("-");
    const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return names[d.getUTCDay()];
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
        if (typeof v === "number" && !isNaN(v)) vals.push(v);
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
 * Rendering
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
            '<span class="chip">Luftfeuchte <b>' + Math.round(c.relative_humidity_2m) + ' %</b></span>' +
            '<span class="chip">Wind <b>' + Math.round(c.wind_speed_10m) + ' km/h</b></span>' +
            '<span class="chip">Böen <b>' + Math.round(c.wind_gusts_10m) + ' km/h</b></span>' +
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
    const vals = m.precipitation.slice(start, start + 16).map(function (v) {
        return typeof v === "number" && !isNaN(v) ? v : 0;
    });

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

/* ---------- Temperaturverlauf 48 h (SVG-Liniendiagramm) ---------- */

function renderTempChart(fc) {
    const box = $("tempchart");
    if (!box) return;
    box.classList.remove("skeleton");

    const h = fc.hourly;
    const start = Math.max(0, firstIndexFrom(h.time, fc.current.time.slice(0, 13)));
    const end = Math.min(start + 48, h.time.length);
    const times = h.time.slice(start, end);
    const temps = h.temperature_2m.slice(start, end);
    const feels = (h.apparent_temperature || []).slice(start, end);
    const isDay = (h.is_day || []).slice(start, end);
    const n = times.length;
    if (n < 2) { box.innerHTML = '<div class="note">Zu wenige Daten für den Verlauf.</div>'; return; }

    const W = 640, H = 210;
    const padL = 34, padR = 12, padT = 26, padB = 24;
    const iw = W - padL - padR, ih = H - padT - padB;

    const all = temps.concat(feels).filter(function (v) { return typeof v === "number" && !isNaN(v); });
    let lo = Math.floor(Math.min.apply(null, all)) - 1;
    let hi = Math.ceil(Math.max.apply(null, all)) + 1;
    if (hi - lo < 6) { const mid = (hi + lo) / 2; lo = Math.floor(mid - 3); hi = Math.ceil(mid + 3); }

    const x = function (i) { return padL + i / (n - 1) * iw; };
    const y = function (v) { return padT + (hi - v) / (hi - lo) * ih; };

    /* Nacht-Schattierung: zusammenhängende Bereiche mit is_day == 0 */
    let night = "";
    let runStart = -1;
    for (let i = 0; i <= n; i++) {
        const isNight = i < n && isDay[i] === 0;
        if (isNight && runStart < 0) runStart = i;
        if (!isNight && runStart >= 0) {
            night += '<rect x="' + x(runStart).toFixed(1) + '" y="' + padT + '" width="' +
                     (x(i - 1) - x(runStart) + iw / (n - 1)).toFixed(1) + '" height="' + ih +
                     '" fill="rgba(0,0,0,0.28)" rx="3"/>';
            runStart = -1;
        }
    }

    /* Gitter: 3–4 glatte Gradzahlen, Hairlines */
    let grid = "", gely = [];
    const step = (hi - lo) > 12 ? 5 : 2;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) gely.push(v);
    gely.forEach(function (v) {
        grid += '<line x1="' + padL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y(v).toFixed(1) +
                '" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>' +
                '<text x="' + (padL - 6) + '" y="' + (y(v) + 3.5).toFixed(1) +
                '" text-anchor="end" font-size="10" fill="#7f95b4">' + v + '°</text>';
    });

    /* X-Achse: alle 6 h eine Zeit, Tageswechsel mit Wochentag + Hairline */
    let xa = "";
    for (let i = 0; i < n; i++) {
        const newDay = i > 0 && dayOf(times[i]) !== dayOf(times[i - 1]);
        if (newDay) {
            xa += '<line x1="' + x(i).toFixed(1) + '" y1="' + padT + '" x2="' + x(i).toFixed(1) + '" y2="' + (padT + ih) +
                  '" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>' +
                  '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" font-weight="600" fill="#9fb3d1">' +
                  weekday(dayOf(times[i])) + '</text>';
        } else if (i % 6 === 0) {
            xa += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#7f95b4">' +
                  (i === 0 ? "jetzt" : hhmm(times[i])) + '</text>';
        }
    }

    function pathOf(vals) {
        let d = "";
        for (let i = 0; i < n; i++) {
            const v = vals[i];
            if (typeof v !== "number" || isNaN(v)) continue;
            d += (d ? " L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
        }
        return d;
    }

    const tempPath = pathOf(temps);
    const feelsPath = feels.length ? pathOf(feels) : "";
    const area = tempPath
        ? tempPath + " L" + x(n - 1).toFixed(1) + " " + (padT + ih) + " L" + padL + " " + (padT + ih) + " Z"
        : "";

    /* Direkte Beschriftung nur an Extremen: Maximum und Minimum */
    let iMax = 0, iMin = 0;
    temps.forEach(function (v, i) {
        if (v > temps[iMax]) iMax = i;
        if (v < temps[iMin]) iMin = i;
    });
    function extremum(i, above) {
        const ty = above ? Math.max(padT + 10, y(temps[i]) - 9) : Math.min(padT + ih - 4, y(temps[i]) + 16);
        const anchor = i < 3 ? "start" : (i > n - 4 ? "end" : "middle");
        return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(temps[i]).toFixed(1) + '" r="4" fill="#b8821a" stroke="#12233f" stroke-width="2"/>' +
               '<text x="' + x(i).toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="' + anchor +
               '" font-size="11" font-weight="600" fill="#eaf1fb">' + Math.round(temps[i]) + '°</text>';
    }

    box.innerHTML =
        '<div class="tchart-wrap">' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Temperaturverlauf der nächsten 48 Stunden">' +
            night + grid + xa +
            (area ? '<path d="' + area + '" fill="rgba(184,130,26,0.10)"/>' : '') +
            (feelsPath ? '<path d="' + feelsPath + '" fill="none" stroke="#3d94e0" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round"/>' : '') +
            '<path d="' + tempPath + '" fill="none" stroke="#b8821a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            extremum(iMax, true) + (iMin !== iMax ? extremum(iMin, false) : '') +
            '<line id="tcCursor" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + ih) + '" stroke="rgba(255,255,255,0.35)" stroke-width="1" style="display:none"/>' +
        '</svg>' +
        '<div class="tchart-tip" id="tcTip"></div>' +
        '</div>' +
        '<div class="tchart-legend">' +
            '<span><i></i>Temperatur</span>' +
            (feelsPath ? '<span class="feels"><i></i>gefühlt</span>' : '') +
        '</div>';

    /* Hover/Touch: Fadenkreuz + Tooltip */
    const wrapEl = box.querySelector(".tchart-wrap");
    const svg = wrapEl.querySelector("svg");
    const cursor = wrapEl.querySelector("#tcCursor");
    const tip = wrapEl.querySelector("#tcTip");

    function onMove(ev) {
        const rect = svg.getBoundingClientRect();
        const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
        const rel = (px / rect.width * W - padL) / iw;
        const i = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
        cursor.setAttribute("x1", x(i)); cursor.setAttribute("x2", x(i));
        cursor.style.display = "";
        tip.style.display = "block";
        tip.style.left = (x(i) / W * rect.width) + "px";
        tip.style.top = "0px";
        tip.innerHTML = weekday(dayOf(times[i])) + " " + hhmm(times[i]) + " Uhr<br><b>" +
            Math.round(temps[i]) + "°</b>" +
            (typeof feels[i] === "number" ? " · gefühlt " + Math.round(feels[i]) + "°" : "");
        if (ev.touches) ev.preventDefault();
    }
    function onLeave() { cursor.style.display = "none"; tip.style.display = "none"; }

    svg.addEventListener("mousemove", onMove);
    svg.addEventListener("mouseleave", onLeave);
    svg.addEventListener("touchstart", onMove, { passive: false });
    svg.addEventListener("touchmove", onMove, { passive: false });
    svg.addEventListener("touchend", onLeave);
}

function renderHourly(fc, ens) {
    const box = $("hourly");
    box.classList.remove("skeleton");

    const h = fc.hourly;
    const start = firstIndexFrom(h.time, fc.current.time.slice(0, 13));
    const from = start < 0 ? 0 : start;
    const end = Math.min(from + 48, h.time.length);

    /* Ensemble-Zeitachse auf die Stunden der Hauptprognose abbilden */
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

    for (let i = from; i < end; i++) {
        const t = h.time[i];
        const stats = members.length && ensIndex[t] !== undefined
            ? ensembleStats(members, ensIndex[t]) : null;
        if (stats) usedEnsemble = true;

        const prob = stats ? stats.prob
                   : (typeof probs[i] === "number" ? probs[i] : 0);
        const mm = stats && stats.median !== null && stats.median > 0
                   ? Math.max(stats.median, rain[i] || 0)
                   : (rain[i] || 0);

        const d = dayOf(t);
        const isNewDay = prevDay !== null && d !== prevDay;
        prevDay = d;

        const night = h.is_day && h.is_day[i] === 0;
        const icon = wmo(h.weather_code[i]);
        const temp = h.temperature_2m && typeof h.temperature_2m[i] === "number"
                   ? Math.round(h.temperature_2m[i]) + "°" : "–";

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
    const maxSum = Math.max.apply(null, d.precipitation_sum.map(function (v) { return v || 0; }).concat([5]));

    /* Gemeinsame Temperaturskala über alle Tage für die Range-Balken */
    const tLo = Math.min.apply(null, d.temperature_2m_min);
    const tHi = Math.max.apply(null, d.temperature_2m_max);
    const tSpan = Math.max(1, tHi - tLo);

    let rows = "";
    for (let i = 0; i < d.time.length; i++) {
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
                '<div class="day-prob">' + (typeof prob === "number" ? prob + "%" : "–") + '</div>' +
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
            if (typeof v === "number" && !isNaN(v)) {
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

    /* Bandbreite der nächsten 24 h aus dem Ensemble */
    if (ens && ens.hourly && ens.hourly.time) {
        const members = ensembleSeries(ens.hourly);
        const start = firstIndexFrom(ens.hourly.time, fc.current.time.slice(0, 13));
        if (members.length >= 3 && start >= 0) {
            const end = Math.min(start + 24, ens.hourly.time.length);
            const sums = members.map(function (s) {
                let t = 0;
                for (let i = start; i < end; i++) {
                    const v = s[i];
                    if (typeof v === "number" && !isNaN(v)) t += v;
                }
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

/* ------------------------------------------------------------------ *
 * Laden, Cache, Steuerung
 * ------------------------------------------------------------------ */

function cacheKey(loc) { return CACHE_PREFIX + loc.id; }

function saveCache(loc, payload) {
    try {
        localStorage.setItem(cacheKey(loc), JSON.stringify({
            savedAt: new Date().toISOString(),
            payload: payload
        }));
    } catch (e) { /* Speicher voll oder privater Modus – nicht kritisch */ }
}

function loadCache(loc) {
    try {
        const raw = localStorage.getItem(cacheKey(loc));
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function savePos(pos) {
    try { localStorage.setItem(GEO_POS_KEY, JSON.stringify(pos)); } catch (e) {}
}

function loadPos() {
    try {
        const raw = localStorage.getItem(GEO_POS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function renderAll(payload) {
    renderNow(payload.fc);
    renderNowcast(payload.fc);
    renderTempChart(payload.fc);
    renderHourly(payload.fc, payload.ens);
    renderDaily(payload.fc);
    renderModels(payload.md, payload.fc, payload.ens);
}

function setUpdated(iso) {
    const d = new Date(iso);
    $("updated").textContent = "Stand: " + d.toLocaleString("de-DE", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    }) + " Uhr";
}

function initWeatherApp(config) {
    const mode = config && config.mode === "geo" ? "geo" : "sites";
    let currentLoc = null;
    let loading = false;

    function subline(loc) {
        let s = loc.name + " · " + loc.lat.toFixed(3) + "° N, " + loc.lon.toFixed(3) + "° O";
        if (mode === "geo") {
            const km = distanceKm(loc.lat, loc.lon, CAMP.lat, CAMP.lon);
            s += km < 2 ? " · am Campingplatz" : " · ≈ " + Math.round(km) + " km bis Lignano";
        }
        $("subline").textContent = s;
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
            fetchModels(currentLoc)
        ]);

        const fc  = results[0].status === "fulfilled" ? results[0].value : null;
        const ens = results[1].status === "fulfilled" ? results[1].value : null;
        const md  = results[2].status === "fulfilled" ? results[2].value : null;

        if (fc) {
            const payload = { fc: fc, ens: ens, md: md };
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

    /* ---------- Modus: feste Standorte (Lignano) ---------- */

    function initSites() {
        const sel = $("site");
        sel.innerHTML = SITES.map(function (s) {
            return '<option value="' + s.id + '">' + s.name + '</option>';
        }).join("");

        const saved = localStorage.getItem(CACHE_PREFIX + "site");
        if (saved && SITES.some(function (s) { return s.id === saved; })) sel.value = saved;

        function pick() {
            currentLoc = SITES.filter(function (s) { return s.id === sel.value; })[0] || SITES[0];
        }

        sel.addEventListener("change", function () {
            try { localStorage.setItem(CACHE_PREFIX + "site", sel.value); } catch (e) {}
            pick();
            load();
        });

        pick();
        load();
    }

    /* ---------- Modus: aktueller Standort ---------- */

    function geoError(message, withRetry) {
        const el = $("error");
        el.innerHTML = message +
            (withRetry ? '<button class="locbtn" id="geoRetry">📍 Standort erneut abfragen</button>' : '') +
            '<a class="locbtn" href="lignano-wetter.html">⛺ Stattdessen Wetter für Lignano öffnen</a>';
        el.classList.remove("hidden");
        const retry = $("geoRetry");
        if (retry) retry.addEventListener("click", locate);
    }

    async function useLocation(lat, lon) {
        const cachedPos = loadPos();
        let name = cachedPos && distanceKm(lat, lon, cachedPos.lat, cachedPos.lon) < 2
            ? cachedPos.name : null;
        currentLoc = { id: "geo", name: name || "Dein Standort", lat: lat, lon: lon };
        subline(currentLoc);
        if (!name) {
            fetchPlace(lat, lon).then(function (p) {
                if (p) {
                    currentLoc.name = p;
                    subline(currentLoc);
                    savePos({ lat: lat, lon: lon, name: p });
                }
            });
            savePos({ lat: lat, lon: lon, name: currentLoc.name });
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
                useLocation(pos.coords.latitude, pos.coords.longitude);
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

    function initGeo() {
        /* Letzte bekannte Position sofort rendern, parallel neu orten */
        const cached = loadPos();
        if (cached) {
            currentLoc = { id: "geo", name: cached.name || "Dein Standort", lat: cached.lat, lon: cached.lon };
            load();
        }
        locate();
    }

    /* ---------- gemeinsam ---------- */

    $("reload").addEventListener("click", function () {
        if (mode === "geo" && !currentLoc) locate(); else load();
    });

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) return;
        if (mode === "geo") locate(); else load();
    });

    if (mode === "geo") initGeo(); else initSites();
}

/* Für die Seiten (und den Test-Harness) global verfügbar machen */
if (typeof window !== "undefined") {
    window.initWeatherApp = initWeatherApp;
    window.WETTER = { SITES: SITES, CAMP: CAMP, GEO_POS_KEY: GEO_POS_KEY };
}
