/* Design-Variante der Wetter-App.
 * Nutzt die Datenschicht aus wetter-core.js (fetch*, Helfer, Cache, Ensemble)
 * und rendert eine eigene, auf Lesbarkeit und Atmosphäre ausgelegte Oberfläche.
 */
"use strict";

const D = function (id) { return document.getElementById(id); };

/* ------------------------------------------------------------------ *
 * Wetter → Theme & Icon
 * ------------------------------------------------------------------ */

function themeFor(code, isDay) {
    const day = isDay !== 0;
    if (code === 0 || code === 1) return day ? "clear-day" : "clear-night";
    if (code === 2) return day ? "partly-day" : "partly-night";
    if (code === 3) return "cloudy";
    if (code === 45 || code === 48) return "fog";
    if (code >= 71 && code <= 77 || code === 85 || code === 86) return "snow";
    if (code >= 95) return "storm";
    if (code >= 51 && code <= 82) return "rain";
    return day ? "partly-day" : "partly-night";
}

const ICO = {
    sun: '<circle cx="12" cy="12" r="4" fill="#ffd27a" stroke="none"/><path stroke="#ffd27a" d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4"/>',
    moon: '<path fill="#f1e3a8" stroke="none" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    cloud: '<path d="M7 17h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.1 10.6 3.3 3.3 0 0 0 7 17z"/>',
    cloudHi: '<path d="M7 15h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.1 8.6 3.3 3.3 0 0 0 7 15z"/>',
    sunSmall: '<g transform="translate(13.5 5.5) scale(0.42)"><circle cx="0" cy="0" r="4" fill="#ffd27a" stroke="none"/><path stroke="#ffd27a" d="M0-9v2M0 7v2M-9 0h2M7 0h2M-6.4-6.4l1.4 1.4M5-5l1.4-1.4M-6.4 6.4l1.4-1.4M5 5l1.4 1.4"/></g>',
    moonSmall: '<path fill="#f1e3a8" stroke="none" d="M20.5 7.3a3.6 3.6 0 0 1-4.8-4.8 3.6 3.6 0 1 0 4.8 4.8z"/>',
    rain: '<path stroke="#8fd0ff" d="M9 18.5v2.5M13 18.5v2.5M17 18.5v2.5"/>',
    drizzle: '<path stroke="#8fd0ff" d="M9 18.5v1M13 18.5v1M17 18.5v1"/>',
    snow: '<g fill="#fff" stroke="none"><circle cx="9" cy="19.5" r="1.1"/><circle cx="13" cy="19.5" r="1.1"/><circle cx="17" cy="19.5" r="1.1"/></g>',
    fog: '<path d="M5 19h14M7 22h10"/>',
    bolt: '<path fill="#ffd27a" stroke="none" d="M12.5 15h3l-4.5 7 1-5h-3l4.5-7z"/>'
};

function svgIcon(code, isDay, cls) {
    const day = isDay !== 0;
    let body;
    if (code === 0 || code === 1) body = day ? ICO.sun : ICO.moon;
    else if (code === 2) body = (day ? ICO.sunSmall : ICO.moonSmall) + ICO.cloud;
    else if (code === 3) body = ICO.cloud;
    else if (code === 45 || code === 48) body = ICO.cloudHi + ICO.fog;
    else if (code >= 51 && code <= 57) body = ICO.cloudHi + ICO.drizzle;
    else if (code >= 61 && code <= 67 || code === 81 || code === 82) body = ICO.cloudHi + ICO.rain;
    else if (code === 80) body = (day ? ICO.sunSmall : ICO.moonSmall) + ICO.cloudHi + ICO.rain;
    else if (code >= 71 && code <= 77 || code === 85 || code === 86) body = ICO.cloudHi + ICO.snow;
    else if (code >= 95) body = ICO.cloudHi + ICO.bolt;
    else body = ICO.cloud;
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
}

const UI = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
    umbrella: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v7a2 2 0 0 0 4 0"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
    radar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v9l6-6"/></svg>',
    wind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3M3 14h14a3 3 0 1 1-3 3M3 11h6"/></svg>',
    sunUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 18h16M6 14a6 6 0 0 1 12 0M12 3v3M4.9 7.9l1.4 1.4M19.1 7.9l-1.4 1.4"/></svg>',
    drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>'
};

const STATUS = { good: "#4fd17a", warning: "#ffcb47", serious: "#ff9a62", critical: "#ff6b6b", none: "rgba(255,255,255,0.4)" };

/* ------------------------------------------------------------------ *
 * Helfer
 * ------------------------------------------------------------------ */

function minutesOf(t) { return t ? parseInt(t.slice(11, 13), 10) * 60 + parseInt(t.slice(14, 16), 10) : null; }

function nowcastSummary(fc) {
    const m = fc.minutely_15;
    if (!m || !m.time || !m.precipitation) return null;
    const start = firstIndexFrom(m.time, fc.current.time.slice(0, 16));
    if (start < 0) return null;
    const times = m.time.slice(start, start + 16);
    const vals = m.precipitation.slice(start, start + 16).map(function (v) { return isNum(v) ? v : 0; });
    const total = vals.reduce(function (a, b) { return a + b; }, 0);
    const firstWet = vals.findIndex(function (v) { return v >= 0.1; });
    let text, wet = firstWet >= 0;
    if (!wet) text = "Kein Regen in den nächsten 4 Stunden";
    else if (firstWet === 0) text = "Es regnet gerade · ca. " + fmtMm(total) + " mm in 4 h";
    else text = "Regen ab ca. " + hhmm(times[firstWet]) + " Uhr · ca. " + fmtMm(total) + " mm";
    return { text: text, wet: wet, vals: vals, times: times };
}

function setTheme(name) {
    const b = document.body;
    Array.prototype.slice.call(b.classList).forEach(function (c) { if (c.indexOf("theme-") === 0) b.classList.remove(c); });
    b.classList.add("theme-" + name);
}

function unskel(el) { el.classList.remove("skel"); }

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function renderHero(fc) {
    const c = fc.current, d = fc.daily;
    const code = c.weather_code, day = c.is_day;
    setTheme(themeFor(code, day));

    const nc = nowcastSummary(fc);
    const hi = d && isNum(d.temperature_2m_max[0]) ? Math.round(d.temperature_2m_max[0]) : null;
    const lo = d && isNum(d.temperature_2m_min[0]) ? Math.round(d.temperature_2m_min[0]) : null;

    const hero = D("hero");
    hero.innerHTML =
        svgIcon(code, day, "big-icon fade-in") +
        '<div class="temp fade-in">' + Math.round(c.temperature_2m) + '°</div>' +
        '<div class="cond fade-in">' + wmo(code)[1] + ' · gefühlt ' + Math.round(c.apparent_temperature) + '°</div>' +
        (hi !== null ? '<div class="range fade-in">H <b>' + hi + '°</b> · T <b>' + lo + '°</b></div>' : '') +
        (nc ? '<div class="insight fade-in">' + (nc.wet ? UI.umbrella : UI.check) + '<span>' + nc.text + '</span></div>' : '');
}

function dHourly(fc, ens) {
    const box = D("hourly");
    unskel(box);
    const h = fc.hourly;
    const w = hourlyWindow(fc, 48);
    const n = w.end - w.start;
    if (n < 2) { box.innerHTML = '<div class="note">Keine Stundendaten.</div>'; return; }

    const members = ens ? ensembleSeries(ens.hourly) : [];
    const ensIndex = {};
    if (ens && ens.hourly && ens.hourly.time) ens.hourly.time.forEach(function (t, i) { ensIndex[t] = i; });

    const COL = 58, CH = 92, padT = 20, padB = 12;
    const temps = w.slice(h.temperature_2m);
    const valid = temps.filter(isNum);
    const tLo = Math.min.apply(null, valid), tHi = Math.max.apply(null, valid);
    const span = Math.max(4, tHi - tLo);
    const x = function (i) { return i * COL + COL / 2; };
    const y = function (v) { return padT + (tHi - v) / span * (CH - padT - padB); };

    let path = "", pts = "", labels = "", cols = "", prevDay = null;
    for (let i = 0; i < n; i++) {
        const gi = w.start + i;
        const t = h.time[gi];
        const v = temps[i];
        if (isNum(v)) {
            path += (path ? " L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
            pts += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3" fill="var(--accent)" stroke="var(--bg1)" stroke-width="2"/>';
            labels += '<text x="' + x(i).toFixed(1) + '" y="' + (y(v) - 9).toFixed(1) + '" text-anchor="middle" font-size="13" font-weight="600" fill="#fff">' + Math.round(v) + '°</text>';
        }
        const stats = members.length && ensIndex[t] !== undefined ? ensembleStats(members, ensIndex[t]) : null;
        const prob = stats ? stats.prob : (isNum(h.precipitation_probability[gi]) ? h.precipitation_probability[gi] : 0);
        const mm = stats && stats.median > 0 ? Math.max(stats.median, h.precipitation[gi] || 0) : (h.precipitation[gi] || 0);
        const dd = dayOf(t);
        const newDay = prevDay !== null && dd !== prevDay;
        prevDay = dd;
        cols +=
            '<div class="hcol' + (newDay ? ' newday' : '') + '">' +
                '<div class="t">' + (i === 0 ? "Jetzt" : (newDay ? weekday(dd) : hhmm(t))) + '</div>' +
                svgIcon(h.weather_code[gi], h.is_day ? h.is_day[gi] : 1, "ic") +
                '<div class="gap"></div>' +
                '<div class="p">' + (prob >= 10 ? Math.round(prob) + '%' : '') + '</div>' +
                '<div class="mm">' + (mm >= 0.1 ? fmtMm(mm) + ' mm' : '') + '</div>' +
            '</div>';
    }
    const W = n * COL;
    const area = path + " L" + x(n - 1).toFixed(1) + " " + CH + " L" + x(0).toFixed(1) + " " + CH + " Z";
    box.innerHTML =
        '<div class="strip"><div class="strip-inner" style="width:' + W + 'px">' +
            '<svg class="curve" width="' + W + '" height="' + CH + '" viewBox="0 0 ' + W + ' ' + CH + '" aria-hidden="true">' +
                '<path d="' + area + '" fill="var(--accent)" fill-opacity="0.07"/>' +
                '<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
                pts + labels +
            '</svg>' + cols +
        '</div></div>';
}

function dNowcast(fc) {
    const box = D("nowcast"), card = D("nowcastCard");
    const nc = nowcastSummary(fc);
    if (!nc || !nc.wet) { card.classList.add("hidden"); return; }
    card.classList.remove("hidden");
    const peak = Math.max.apply(null, nc.vals.concat([0.4]));
    box.innerHTML =
        '<div class="nc-lead">' + nc.text + '</div>' +
        '<div class="nc-bars">' + nc.vals.map(function (v) {
            return '<i class="' + (v > 0 ? '' : 'z') + '" style="height:' + (v > 0 ? Math.max(8, Math.round(v / peak * 100)) : 4) + '%"></i>';
        }).join('') + '</div>' +
        '<div class="nc-axis">' + nc.times.map(function (t, i) { return '<span>' + (i % 4 === 0 ? hhmm(t) : '') + '</span>'; }).join('') + '</div>';
}

function renderDays(fc) {
    const box = D("days");
    unskel(box);
    const d = fc.daily, n = d.time.length;
    const tLo = Math.min.apply(null, d.temperature_2m_min.filter(isNum));
    const tHi = Math.max.apply(null, d.temperature_2m_max.filter(isNum));
    const span = Math.max(1, tHi - tLo);
    const cur = fc.current.temperature_2m;
    let rows = "";
    for (let i = 0; i < n; i++) {
        const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i];
        const prob = d.precipitation_probability_max[i];
        const left = (lo - tLo) / span * 100, width = Math.max(3, (hi - lo) / span * 100);
        rows +=
            '<div class="drow">' +
                '<div class="n">' + (i === 0 ? "Heute" : weekday(d.time[i])) + '</div>' +
                svgIcon(d.weather_code[i], 1, "ic") +
                '<div class="pp">' + (isNum(prob) && prob >= 10 ? prob + '%' : '') + '</div>' +
                '<div class="lo">' + Math.round(lo) + '°</div>' +
                '<div class="bar"><i style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%"></i>' +
                    (i === 0 && isNum(cur) ? '<b style="left:' + Math.max(0, Math.min(100, (cur - tLo) / span * 100)).toFixed(1) + '%"></b>' : '') +
                '</div>' +
                '<div class="hi">' + Math.round(hi) + '°</div>' +
            '</div>';
    }
    box.innerHTML = rows;
}

/* ---- Instrumente ---- */

function arcPoint(cx, cy, r, frac) {
    const a = Math.PI - frac * Math.PI;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

function arcPath(cx, cy, r, f0, f1) {
    const p0 = arcPoint(cx, cy, r, f0), p1 = arcPoint(cx, cy, r, f1);
    return 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 0 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
}

function uvGauge(uv) {
    const segs = [[0, 3, "good"], [3, 6, "warning"], [6, 8, "serious"], [8, 11, "critical"]];
    let s = '<svg class="gauge" viewBox="0 0 100 58" aria-hidden="true">';
    segs.forEach(function (sg) {
        s += '<path d="' + arcPath(50, 52, 40, sg[0] / 11, Math.min(sg[1], 11) / 11 - 0.012) + '" fill="none" stroke="' + STATUS[sg[2]] + '" stroke-width="7" stroke-linecap="round" opacity="0.85"/>';
    });
    if (isNum(uv)) {
        const p = arcPoint(50, 52, 40, Math.min(uv, 11) / 11);
        s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="6" fill="#fff" stroke="var(--bg1)" stroke-width="2.5"/>';
    }
    return s + '</svg>';
}

function windDial(dir, speed) {
    const to = isNum(dir) ? (dir + 180) % 360 : 0;
    return '<svg class="gauge" viewBox="0 0 100 100" aria-hidden="true">' +
        '<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>' +
        '<g font-size="9" fill="rgba(255,255,255,0.7)" text-anchor="middle" font-weight="600">' +
            '<text x="50" y="14">N</text><text x="89" y="53">O</text><text x="50" y="92">S</text><text x="11" y="53">W</text></g>' +
        /* Pfeil nur im äußeren Ring, Mitte bleibt frei für die Zahl */
        '<g transform="rotate(' + to + ' 50 50)">' +
            '<path d="M50 13l6 11h-4v8h-4v-8h-4z" fill="#fff"/>' +
            '<path d="M48 68v10h4V68z" fill="rgba(255,255,255,0.35)"/>' +
        '</g>' +
        '<circle cx="50" cy="50" r="17" fill="rgba(0,0,0,0.28)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>' +
        '<text x="50" y="53" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">' + (isNum(speed) ? Math.round(speed) : '–') + '</text>' +
        '<text x="50" y="62" text-anchor="middle" font-size="6.5" fill="rgba(255,255,255,0.7)">km/h</text>' +
        '</svg>';
}

function sunArc(sunrise, sunset, now) {
    const r = minutesOf(sunrise), s = minutesOf(sunset), n = minutesOf(now);
    let f = null;
    if (r !== null && s !== null && n !== null && s > r) f = (n - r) / (s - r);
    const daytime = f !== null && f >= 0 && f <= 1;
    let svg = '<svg class="gauge" viewBox="0 0 100 56" aria-hidden="true">' +
        '<path d="' + arcPath(50, 50, 38, 0, 1) + '" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-dasharray="3 4"/>' +
        '<path d="M6 50h88" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>';
    if (daytime) {
        svg += '<path d="' + arcPath(50, 50, 38, 0, Math.max(0.01, f)) + '" fill="none" stroke="#ffd27a" stroke-width="2.5" stroke-linecap="round"/>';
        const p = arcPoint(50, 50, 38, f);
        svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="6" fill="#ffd27a" stroke="var(--bg1)" stroke-width="2"/>';
    }
    return svg + '</svg>';
}

function aqiMeter(aqi) {
    const segs = ["good", "good", "warning", "serious", "critical"];
    let s = '<svg class="gauge" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">';
    segs.forEach(function (st, i) {
        s += '<rect x="' + (i * 20 + 0.6) + '" y="4" width="18.8" height="6" rx="3" fill="' + STATUS[st] + '" opacity="0.85"/>';
    });
    if (isNum(aqi)) {
        const xpos = Math.max(2, Math.min(98, aqi));
        s += '<circle cx="' + xpos + '" cy="7" r="5" fill="#fff" stroke="var(--bg1)" stroke-width="2"/>';
    }
    return s + '</svg>';
}

function tile(cls, title, ico, body, sub) {
    return '<div class="tile ' + (cls || '') + '"><h3>' + ico + title + '</h3>' + body + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
}

function renderDetails(fc, air) {
    const box = D("details");
    unskel(box);
    const c = fc.current, d = fc.daily, h = fc.hourly;
    const w = hourlyWindow(fc, 24);
    const uvNow = h.uv_index ? h.uv_index[w.start] : null;
    const uvMax = d.uv_index_max ? d.uv_index_max[0] : null;
    const lv = uvLevel(uvNow);
    let html = "";

    html += tile("", "UV-Index", UI.sunUp,
        '<div class="big">' + (isNum(uvNow) ? fmtNum(uvNow, 1) : '–') + (lv ? ' <small class="word" style="color:' + STATUS[lv.st] + '">' + lv.word + '</small>' : '') + '</div>' + uvGauge(uvNow),
        isNum(uvMax) ? 'Maximum heute ' + fmtNum(uvMax, 1) : null);

    html += tile("", "Wind", UI.wind,
        windDial(c.wind_direction_10m, c.wind_speed_10m),
        'aus ' + compass(c.wind_direction_10m) + ' · Böen ' + Math.round(c.wind_gusts_10m) + ' km/h');

    html += tile("", "Sonne", UI.sunUp,
        sunArc(d.sunrise && d.sunrise[0], d.sunset && d.sunset[0], c.time) +
        '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600"><span>↑ ' + hhmm(d.sunrise && d.sunrise[0]) + '</span><span>↓ ' + hhmm(d.sunset && d.sunset[0]) + '</span></div>',
        'Tageslänge ' + fmtDuration(d.daylight_duration && d.daylight_duration[0]));

    html += tile("", "Niederschlag", UI.drop,
        '<div class="big">' + fmtMm(d.precipitation_sum[0]) + '<small>mm heute</small></div>',
        (isNum(d.precipitation_probability_max[0]) ? 'Risiko ' + d.precipitation_probability_max[0] + ' %' : '') +
        (isNum(d.precipitation_hours && d.precipitation_hours[0]) && d.precipitation_hours[0] > 0 ? ' · ' + Math.round(d.precipitation_hours[0]) + ' h mit Regen' : '') +
        '<br>Morgen ' + fmtMm(d.precipitation_sum[1]) + ' mm · ' + (isNum(d.precipitation_probability_max[1]) ? d.precipitation_probability_max[1] + ' %' : '–'));

    html += tile("", "Luftfeuchte", UI.drop,
        '<div class="big">' + Math.round(c.relative_humidity_2m) + '<small>%</small></div>',
        'Bewölkung ' + fmtNum(c.cloud_cover, 0) + ' %');

    html += tile("", "Luftdruck", UI.gauge,
        '<div class="big">' + fmtNum(c.pressure_msl, 0) + '<small>hPa</small></div>',
        isNum(c.pressure_msl) ? (c.pressure_msl >= 1020 ? 'Hochdruck' : (c.pressure_msl <= 1005 ? 'Tiefdruck' : 'normal')) : null);

    if (air && air.current) {
        const a = air.current, al = aqiLevel(a.european_aqi);
        html += tile("wide", "Luftqualität", UI.leaf,
            '<div style="display:flex;align-items:baseline;gap:10px"><div class="big">' + (isNum(a.european_aqi) ? Math.round(a.european_aqi) : '–') + '</div>' +
            (al ? '<span class="word" style="color:' + STATUS[al.st] + '">' + al.ico + ' ' + al.word + '</span>' : '') + '</div>' + aqiMeter(a.european_aqi),
            'PM2,5 ' + fmtNum(a.pm2_5, 0) + ' · PM10 ' + fmtNum(a.pm10, 0) + ' · O₃ ' + fmtNum(a.ozone, 0) + ' · NO₂ ' + fmtNum(a.nitrogen_dioxide, 0) + ' µg/m³');

        const chips = POLLEN.map(function (p) {
            const lvp = pollenLevel(a[p.key], p.thr);
            return lvp && lvp.st !== "none" ? '<span class="pchip"><i class="st-' + lvp.st + '"></i>' + p.name + ' · ' + lvp.word + '</span>' : '';
        }).join('');
        const anyPollen = POLLEN.some(function (p) { return isNum(a[p.key]); });
        html += tile("wide", "Pollen", UI.leaf,
            '<div class="pollen-chips">' + (chips || '<span class="pchip"><i class="st-none"></i>' + (anyPollen ? 'Zurzeit kein nennenswerter Pollenflug' : 'Pollendaten nur in Europa') + '</span>') + '</div>', null);
    }

    box.innerHTML = html;
}

function renderAllDesign(payload) {
    renderHero(payload.fc);
    dHourly(payload.fc, payload.ens);
    dNowcast(payload.fc);
    renderDays(payload.fc);
    renderDetails(payload.fc, payload.air);
    renderModels(payload.md, payload.fc, payload.ens);
    D("models").classList.remove("skel");
}

/* ------------------------------------------------------------------ *
 * App-Steuerung: Standort, Suche, Tabs
 * ------------------------------------------------------------------ */

function initDesignApp() {
    let currentLoc = null;
    let loading = false;

    function setLocLabel(loc) {
        D("locName").textContent = (loc.source === "search" ? "🔍 " : "") + loc.name;
        D("gps").classList.toggle("hidden", loc.source !== "search");
    }

    function setUpdatedLabel(iso) {
        const dt = new Date(iso);
        D("updated").textContent = "Stand " + dt.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + " Uhr";
    }

    async function load() {
        if (loading || !currentLoc) return;
        loading = true;
        D("refresh").classList.add("spin");
        D("banner").classList.add("hidden");
        setLocLabel(currentLoc);

        const results = await Promise.allSettled([
            fetchForecast(currentLoc), fetchEnsemble(currentLoc), fetchModels(currentLoc), fetchAir(currentLoc)
        ]);
        const val = function (i) { return results[i].status === "fulfilled" ? results[i].value : null; };
        const fc = val(0);

        if (fc) {
            const payload = { fc: fc, ens: val(1), md: val(2), air: val(3) };
            renderAllDesign(payload);
            saveCache(currentLoc, payload);
            setUpdatedLabel(new Date().toISOString());
        } else {
            const cached = loadCache(currentLoc);
            if (cached) {
                renderAllDesign(cached.payload);
                setUpdatedLabel(cached.savedAt);
                showBanner("Keine Verbindung – du siehst die zuletzt gespeicherten Daten.", false);
            } else {
                showBanner("Die Wetterdaten konnten nicht geladen werden (" +
                    (results[0].reason && results[0].reason.message ? results[0].reason.message : "Netzwerkfehler") + ").", true, "Erneut versuchen", load);
            }
        }
        D("refresh").classList.remove("spin");
        loading = false;
    }

    function showBanner(text, isError, btnLabel, btnFn) {
        const b = D("banner");
        b.className = "banner" + (isError ? " err" : "");
        b.innerHTML = text + (btnLabel ? '<button type="button" id="bannerBtn">' + btnLabel + '</button>' : '');
        if (btnLabel) D("bannerBtn").addEventListener("click", btnFn);
    }

    /* ---- GPS ---- */

    function useGps(lat, lon) {
        const cachedPos = loadPos();
        const known = cachedPos && distanceKm(lat, lon, cachedPos.lat, cachedPos.lon) < 2 ? cachedPos.name : null;
        currentLoc = { id: locId(lat, lon), name: known || "Dein Standort", lat: lat, lon: lon, source: "gps" };
        savePos({ lat: lat, lon: lon, name: currentLoc.name });
        if (!known) {
            fetchPlace(lat, lon).then(function (p) {
                if (!p || !currentLoc || currentLoc.source !== "gps") return;
                currentLoc.name = p;
                setLocLabel(currentLoc);
                savePos({ lat: lat, lon: lon, name: p });
            });
        }
        load();
    }

    function locate() {
        if (window.PREVIEW_LOC) return;   /* Vorschau-Modus: fester Standort, keine Ortung */
        if (!("geolocation" in navigator)) {
            showBanner("Dein Browser unterstützt keine Standortabfrage.", true, "Ort suchen", openSheet);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            function (pos) { D("banner").classList.add("hidden"); useGps(pos.coords.latitude, pos.coords.longitude); },
            function (err) {
                if (currentLoc) return;
                showBanner(err.code === 1
                    ? "Standortzugriff abgelehnt – erlauben unter Einstellungen → Datenschutz → Ortungsdienste → Safari, oder einen Ort suchen."
                    : "Standort konnte nicht ermittelt werden (" + (err.message || "Fehler") + ").", true, "Ort suchen", openSheet);
            },
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 }
        );
    }

    /* ---- Ortssuche (Bottom-Sheet) ---- */

    function openSheet() {
        document.body.classList.add("sheet-open");
        setTimeout(function () { D("q").focus(); }, 300);
    }
    function closeSheet() {
        document.body.classList.remove("sheet-open");
        D("q").value = "";
        D("res").innerHTML = "";
    }

    function initSearch() {
        let timer = null, seq = 0;
        D("locBtn").addEventListener("click", openSheet);
        D("sheetBg").addEventListener("click", closeSheet);
        D("q").addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeSheet(); });
        D("q").addEventListener("input", function () {
            const q = D("q").value.trim();
            clearTimeout(timer);
            if (q.length < 2) { D("res").innerHTML = ""; return; }
            timer = setTimeout(async function () {
                const my = ++seq;
                let results = [];
                try { results = await searchPlaces(q); } catch (e) { results = []; }
                if (my !== seq) return;
                const res = D("res");
                if (!results.length) { res.innerHTML = '<div class="place-none">Kein Ort gefunden.</div>'; return; }
                res.innerHTML = results.map(function (r, i) {
                    return '<button type="button" class="place" data-i="' + i + '">' + r.name + '</button>';
                }).join("");
                res.querySelectorAll(".place").forEach(function (b) {
                    b.addEventListener("click", function () {
                        const r = results[+b.getAttribute("data-i")];
                        currentLoc = { id: locId(r.lat, r.lon), name: r.name, lat: r.lat, lon: r.lon, source: "search" };
                        closeSheet();
                        load();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    });
                });
            }, 350);
        });
        D("gps").addEventListener("click", function () {
            closeSheet();
            currentLoc = null;
            const cached = loadPos();
            if (cached) {
                currentLoc = { id: locId(cached.lat, cached.lon), name: cached.name || "Dein Standort", lat: cached.lat, lon: cached.lon, source: "gps" };
                load();
            }
            locate();
        });
    }

    /* ---- Tabs mit Scrollspy ---- */

    function initTabs() {
        const links = Array.prototype.slice.call(document.querySelectorAll(".tabs a[data-target]"));
        if (typeof IntersectionObserver === "undefined" || !links.length) return;
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                links.forEach(function (l) { l.classList.toggle("on", l.getAttribute("data-target") === e.target.id); });
            });
        }, { rootMargin: "-40% 0px -50% 0px" });
        links.forEach(function (l) {
            const sec = D(l.getAttribute("data-target"));
            if (sec) io.observe(sec);
        });
    }

    /* ---- Hintergrund-Partikel ---- */

    function initParticles() {
        const p = D("precip");
        if (!p) return;
        let s = "";
        for (let i = 0; i < 36; i++) {
            s += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;animation-delay:-' + (Math.random() * 6).toFixed(2) + 's;animation-duration:' + (2.2 + Math.random() * 2.5).toFixed(2) + 's;opacity:' + (0.4 + Math.random() * 0.6).toFixed(2) + '"></i>';
        }
        p.innerHTML = s;
    }

    /* ---- Start ---- */

    D("refresh").addEventListener("click", function () { if (!currentLoc) locate(); else load(); });
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) return;
        if (!currentLoc || currentLoc.source === "gps") locate(); else load();
    });

    initSearch();
    initTabs();
    initParticles();

    const cached = window.PREVIEW_LOC || loadPos();
    if (cached) {
        currentLoc = { id: locId(cached.lat, cached.lon), name: cached.name || "Dein Standort", lat: cached.lat, lon: cached.lon, source: "gps" };
        load();
    }
    locate();
}

if (typeof window !== "undefined") window.initDesignApp = initDesignApp;
