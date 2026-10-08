/* Startseite der Wetter-App.
 * Nutzt die Datenschicht aus wetter-core.js (fetch*, Helfer, Cache, Ensemble)
 * und rendert das Markup aus index.html. Das Aussehen liefern modern.css (Bento,
 * Standard) oder design.css (klassisch); der Umschalter unten in dieser Datei
 * wechselt zwischen beiden. Die Einblend-Animationen steuert das Stylesheet,
 * hier werden nur Klassen und Verzögerungen gesetzt.
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

/* Großes Hero-Icon aus Ebenen (Sterne, Sonne, Mond, Wolken, Regen, Schnee, Blitz).
   Welche Ebenen sichtbar sind und wie sie beim Öffnen hereinfahren, regelt das
   Stylesheet über die Klasse wx-<lage>; Farben kommen ebenfalls aus dem Stylesheet. */
function heroKind(code, isDay) {
    const day = isDay !== 0;
    if (code === 0 || code === 1) return day ? "sonnig" : "nacht";
    if (code === 2) return day ? "teils" : "teilsnacht";
    if (code === 3 || code === 45 || code === 48) return "bewoelkt";
    if (code >= 71 && code <= 77 || code === 85 || code === 86) return "schnee";
    if (code >= 95) return "gewitter";
    if (code >= 51 && code <= 82) return "regen";
    return day ? "teils" : "teilsnacht";
}

function heroIcon(code, isDay) {
    return '<svg class="big-icon wx wx-' + heroKind(code, isDay) + '" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<g class="stars"><circle cx="16" cy="18" r="2"/><circle cx="80" cy="14" r="1.6"/><circle cx="86" cy="42" r="2.2"/><circle cx="12" cy="50" r="1.6"/></g>' +
        '<g class="sun"><g class="rays"><path d="M34 10v7M34 55v7M8 36h7M53 36h7M15.6 17.6l5 5M47.4 49.4l5 5M15.6 54.4l5-5M47.4 22.6l5-5"/></g><circle cx="34" cy="36" r="13"/></g>' +
        '<g class="moon"><path d="M52 18a24 24 0 1 0 22 36a19 19 0 0 1-22-36z"/></g>' +
        '<g class="cloud2"><path d="M14 88h18a7 7 0 0 0 .5-14A10 10 0 0 0 13 70a6.5 6.5 0 0 0 1 18z"/></g>' +
        '<g class="cloud"><path d="M41 82h31a13.5 13.5 0 0 0 1-27A19.5 19.5 0 0 0 38 57a12.75 12.75 0 0 0 3 25z"/></g>' +
        '<g class="drops"><line x1="50" y1="86" x2="48" y2="92"/><line x1="61" y1="86" x2="59" y2="92"/><line x1="72" y1="86" x2="70" y2="92"/></g>' +
        '<g class="flakes"><circle cx="50" cy="88" r="2.6"/><circle cx="61" cy="88" r="2.6"/><circle cx="72" cy="88" r="2.6"/></g>' +
        '<g class="bolt"><path d="M62 70l-8 13h6l-3 11 10-15h-6l3-9z"/></g>' +
        '</svg>';
}

/* Einblend-Verzögerungen sind relativ zum ersten Rendern: wird kurz danach erneut
   gerendert (Standort-Update, Aktualisieren), läuft die Sequenz nahtlos weiter statt von
   vorn; nach ein paar Sekunden sind alle Verzögerungen null und neue Inhalte blenden
   nur noch kurz ein. */
let introStart = 0;
function introElapsed() {
    if (!introStart) introStart = Date.now();
    return (Date.now() - introStart) / 1000;
}
function dl(seconds) { return Math.max(0, seconds - introElapsed()).toFixed(2); }

/* Antippen einer Kachel oder eines Feldes startet dessen Einmal-Animationen neu
   (Einblenden, Sonne/Wolke, Bogen, Zeiger, Balken). Dauerläufer wie Windlinien,
   Regentropfen oder Sonnenstrahlen laufen ungestört weiter. */
function restartAnimations(root) {
    if (typeof getComputedStyle !== "function" || !root.querySelectorAll) return;
    const nodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*"))).filter(function (el) {
        const cs = getComputedStyle(el);
        if (!cs.animationName || cs.animationName === "none") return false;
        return !cs.animationIterationCount.split(",").some(function (v) { return v.trim() === "infinite"; });
    });
    nodes.forEach(function (el) {
        /* Staffelung vom ersten Laden nicht erneut abwarten; eine kurze Eigen-Staffelung (data-stagger) bleibt */
        if (el.style.animationDelay) el.style.animationDelay = (el.dataset && el.dataset.stagger) || "0s";
        el.style.animation = "none";
    });
    /* Ein Reflow zwischen Aus und Ein, sonst startet nichts neu; getBoundingClientRect
       wirkt auch für SVG-Teile (offsetWidth gibt es dort nicht). */
    void root.getBoundingClientRect();
    nodes.forEach(function (el) { el.style.animation = ""; });
}

let lastTemp = null;

/* Zuletzt dargestellte Daten samt Ensemble-Nachschlagetabelle; Grundlage für die
   Stundenvorschau (Zeitreise). previewIdx: gewählter Stundenindex oder null = Jetzt. */
let lastData = null;
let previewIdx = null;

function lastRendered() { return lastData; }

function prepareData(fc, ens) {
    const members = ens ? ensembleSeries(ens.hourly) : [];
    const ensIndex = {};
    if (ens && ens.hourly && ens.hourly.time) ens.hourly.time.forEach(function (t, i) { ensIndex[t] = i; });
    return { fc: fc, ens: ens, members: members, ensIndex: ensIndex };
}

/* Regenwahrscheinlichkeit einer Stunde: Ensemble-Anteil, sonst Modellwert, sonst 0.
   Leiste und Hero nutzen dieselbe Rechnung, damit beide dieselbe Zahl zeigen. */
function hourProb(data, gi) {
    const h = data.fc.hourly, t = h.time[gi];
    const stats = data.members.length && data.ensIndex[t] !== undefined ? ensembleStats(data.members, data.ensIndex[t]) : null;
    if (stats) return stats.prob;
    return h.precipitation_probability && isNum(h.precipitation_probability[gi]) ? h.precipitation_probability[gi] : 0;
}

function nextDay(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* Fakten einer Stunde für das Hero: Beschriftung „Morgen, 17 Uhr", Beschreibung, Werte. */
function hourFacts(data, gi) {
    if (!data || !data.fc || !data.fc.hourly) return null;
    const fc = data.fc, h = fc.hourly;
    if (!Array.isArray(h.time) || !isNum(gi) || gi < 0 || gi >= h.time.length) return null;
    const t = h.time[gi];
    const today = dayOf(fc.current.time), d = dayOf(t);
    const dayWord = d === today ? "Heute" : (d === nextDay(today) ? "Morgen" : longWeekday(t));
    return {
        now: false,
        label: dayWord + ", " + parseInt(t.slice(11, 13), 10) + " Uhr",
        desc: wmo(h.weather_code[gi])[1],
        temp: h.temperature_2m[gi],
        code: h.weather_code[gi],
        isDay: h.is_day ? h.is_day[gi] : 1,
        apparent: h.apparent_temperature ? h.apparent_temperature[gi] : null,
        prob: hourProb(data, gi),
        wind: h.wind_speed_10m ? h.wind_speed_10m[gi] : null
    };
}

/* Erster Textknoten eines Elements: so bleiben <small>/<span> neben der Zahl stehen */
function firstTextNode(el) {
    const kids = el.childNodes || [];
    for (let i = 0; i < kids.length; i++) if (kids[i].nodeType === 3) return kids[i];
    if (typeof document === "undefined" || !document.createTextNode) return null;
    const t = document.createTextNode("");
    el.insertBefore(t, el.firstChild);
    return t;
}

/* Zahl von 0 auf den Zielwert hochzählen (nur im Browser, nicht bei reduzierter Bewegung).
   opts: decimals (Nachkommastellen, deutsches Komma), suffix ("°"), delay/dur in ms. */
function countUpEl(el, target, opts) {
    opts = opts || {};
    if (!el || typeof requestAnimationFrame !== "function" || !isNum(target)) return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = firstTextNode(el);
    if (!node) return;
    const decimals = opts.decimals || 0, suffix = opts.suffix || "";
    const delay = isNum(opts.delay) ? opts.delay : 350, dur = opts.dur || 1000;
    const fmt = function (v) { return (decimals ? fmtNum(v, decimals) : String(Math.round(v))) + suffix; };
    const start = Date.now();
    stopGlide(el);
    node.nodeValue = fmt(0);
    function step() {
        let p = Math.min(1, (Date.now() - start - delay) / dur);
        if (p < 0) p = 0;
        const eased = 1 - Math.pow(1 - p, 3);
        node.nodeValue = fmt(target * eased);
        el._glide = p < 1 ? requestAnimationFrame(step) : null;
    }
    el._glide = requestAnimationFrame(step);
}

/* Laufendes Hochzählen oder Gleiten eines Elements abbrechen */
function stopGlide(el) {
    if (el && el._glide && typeof cancelAnimationFrame === "function") cancelAnimationFrame(el._glide);
    if (el) el._glide = null;
}

/* Zahl vom gerade sichtbaren Wert zum Ziel gleiten lassen (0,5 s, Ease-out). Schnelle
   Tipps setzen nur das Ziel neu; die Anzeige fällt nie auf 0. Ohne lesbaren Startwert,
   ohne requestAnimationFrame oder bei reduzierter Bewegung wird das Ziel direkt gesetzt. */
function glideTo(el, target, suffix) {
    if (!el || !isNum(target)) return;
    suffix = suffix || "";
    const node = firstTextNode(el);
    const set = function (v) { if (node) node.nodeValue = Math.round(v) + suffix; else el.textContent = Math.round(v) + suffix; };
    const from = node ? parseInt(node.nodeValue, 10) : NaN;
    stopGlide(el);
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof requestAnimationFrame !== "function" || isNaN(from) || from === target || reduced) { set(target); return; }
    const start = Date.now(), dur = 500;
    function step() {
        const p = Math.min(1, (Date.now() - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        set(from + (target - from) * eased);
        el._glide = p < 1 ? requestAnimationFrame(step) : null;
    }
    el._glide = requestAnimationFrame(step);
}

function countUp(el, target) { countUpEl(el, target, { suffix: "°" }); }

/* Alle Zahlen mit data-count unterhalb von root hochzählen, versetzt zur Kachel-Einblendung */
function startCounters(root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.slice.call(root.querySelectorAll("[data-count]")).forEach(function (el) {
        const holder = el.closest ? el.closest(".tile, .mchip") : null;
        const base = holder && holder.style && holder.style.animationDelay ? parseFloat(holder.style.animationDelay) * 1000 : 0;
        countUpEl(el, parseFloat(el.getAttribute("data-count")), {
            decimals: parseInt(el.getAttribute("data-decimals") || "0", 10),
            delay: (isNaN(base) ? 0 : base) + 350,
            dur: 1800
        });
    });
}

const UI = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
    umbrella: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v7a2 2 0 0 0 4 0"/></svg>',
    /* Schirm, der sich aufspannt, danach fällt leichter Regen darauf (Bewegung im Stylesheet) */
    umbrellaRain: '<svg class="umb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">' +
        '<g class="umb-drops"><line x1="6" y1="-3" x2="5.6" y2="-0.5"/><line x1="12" y1="-5" x2="11.6" y2="-2.5"/><line x1="18" y1="-3" x2="17.6" y2="-0.5"/></g>' +
        '<path class="umb-shaft" d="M12 12v7a2 2 0 0 0 4 0"/>' +
        '<path class="umb-canopy" d="M3 12a9 9 0 0 1 18 0z"/></svg>',
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
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r="0.6" fill="currentColor"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    megaphone: '<svg class="wave" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z"/><path class="w1" d="M16.5 8.5a5 5 0 0 1 0 7"/><path class="w2" d="M19.5 6a9 9 0 0 1 0 12"/></svg>'
};

/* Statusfarben für helle Flächen (Wort neben dem Wert) */
const STATUS = { good: "#2E7D4F", warning: "#B7791F", serious: "#C2410C", critical: "#B91C1C", none: "#6B6685" };

/* ------------------------------------------------------------------ *
 * Helfer
 * ------------------------------------------------------------------ */

function minutesOf(t) { return t ? parseInt(t.slice(11, 13), 10) * 60 + parseInt(t.slice(14, 16), 10) : null; }

function nowcastSummary(fc) {
    const m = fc.minutely_15;
    if (!m || !m.time || !m.precipitation) return null;
    /* Die 16 Intervalle, die nach jetzt enden; beschriftet mit ihrem Beginn */
    const start = nowcastStartIndex(m.time, fc.current.time);
    if (start < 0) return null;
    const times = m.time.slice(start, start + 16).map(intervalStart);
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

/* Skelett-Platzhalter aufheben: Klasse und die feste Inline-Höhe aus index.html entfernen,
   sonst läuft der gerenderte Inhalt über die Karte hinaus. */
function unskel(el) { el.classList.remove("skel"); el.style.height = ""; }

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function longWeekday(t) {
    if (!t) return "";
    const d = new Date(t.slice(0, 10) + "T12:00:00");
    return isNaN(d) ? "" : d.toLocaleDateString("de-DE", { weekday: "long" });
}

function isWetCode(code) {
    return code >= 51 && code <= 99;
}

/* Fakten des aktuellen Wetters in derselben Form wie hourFacts, plus Hoch/Tief */
function nowFacts(fc) {
    const c = fc.current, d = fc.daily;
    return {
        now: true,
        label: c.time ? longWeekday(c.time) + ", " + hhmm(c.time) : "",
        desc: wmo(c.weather_code)[1],
        temp: c.temperature_2m,
        code: c.weather_code,
        isDay: c.is_day,
        apparent: c.apparent_temperature,
        hi: d && isNum(d.temperature_2m_max[0]) ? Math.round(d.temperature_2m_max[0]) : null,
        lo: d && isNum(d.temperature_2m_min[0]) ? Math.round(d.temperature_2m_min[0]) : null
    };
}

/* In der Vorschau sitzt der Jetzt-Knopf in der Meta-Zeile, damit die Chip-Reihe einzeilig
   bleibt und das Hero in beiden Zuständen gleich hoch ist */
function heroMetaHtml(f) {
    return '<span>' + f.label + '</span><span>' + f.desc + '</span>' +
        (f.now ? '' : '<button type="button" class="now-btn" id="heroNow">Jetzt</button>');
}

/* intro: gestaffeltes Einblenden beim Laden; in der Vorschau (false) ohne Verzögerungen */
function heroChipsHtml(f, intro) {
    const chip = function (text, delay) {
        return intro ? '<span class="a-up" style="animation-delay:' + dl(delay) + 's">' + text + '</span>' : '<span>' + text + '</span>';
    };
    let out = "";
    if (f.now) {
        if (f.hi !== null) out += chip("Hoch " + f.hi + "°", 0.5) + chip("Tief " + f.lo + "°", 0.58);
        out += chip("Gefühlt " + Math.round(f.apparent) + "°", 0.66);
    } else {
        if (isNum(f.apparent)) out += chip("Gefühlt " + Math.round(f.apparent) + "°", 0);
        if (isNum(f.prob)) out += chip("Regen " + Math.round(f.prob) + " %", 0);
        if (isNum(f.wind)) out += chip("Wind " + Math.round(f.wind) + " km/h", 0);
    }
    return out;
}

function heroHtml(f, intro) {
    const metaOpen = intro ? '<div class="meta a-up" style="animation-delay:' + dl(0.4) + 's">' : '<div class="meta">';
    const tempCls = intro ? 'temp fade-in' : 'temp';
    return metaOpen + heroMetaHtml(f) + '</div>' +
        '<div class="main"><div class="' + tempCls + '">' + (isNum(f.temp) ? Math.round(f.temp) + '°' : '–°') + '</div>' + heroIcon(f.code, f.isDay) + '</div>' +
        '<div class="chips' + (f.now ? '' : ' preview') + '">' + heroChipsHtml(f, intro) + '</div>';
}

/* ---- Zeitreise: Stunde antippen, Hero folgt ---- */

/* Kurzes Einblenden eines Hero-Teils nach Inhaltswechsel; Neustart über Reflow */
function flip(el) {
    if (!el || !el.classList) return;
    el.classList.remove("flip");
    void el.offsetWidth;
    el.classList.add("flip");
}

/* Hero in place auf neue Fakten bringen: Meta und Chips tauschen, Temperatur gleitet,
   Icon nur bei Wechsel der Wetterart ersetzen (Schleifen laufen sonst weiter).
   Ohne echtes DOM (Harness: kein firstElementChild) wird das Hero komplett neu gebaut. */
function updateHero(f, quiet) {
    const hero = D("hero");
    if (!hero) return;
    setTheme(themeFor(f.code, f.isDay));
    lastTemp = isNum(f.temp) ? Math.round(f.temp) : null;
    const meta = hero.querySelector ? hero.querySelector(".meta") : null;
    if (!meta || !hero.firstElementChild) { hero.innerHTML = heroHtml(f, false); return; }

    meta.innerHTML = heroMetaHtml(f);
    if (!quiet) flip(meta);
    const chips = hero.querySelector(".chips");
    if (chips) { chips.innerHTML = heroChipsHtml(f, false); chips.classList.toggle("preview", !f.now); if (!quiet) flip(chips); }

    const temp = hero.querySelector(".temp");
    if (temp) { if (lastTemp !== null) glideTo(temp, lastTemp, "°"); else temp.textContent = "–°"; }

    const icon = hero.querySelector(".big-icon");
    const kind = heroKind(f.code, f.isDay);
    if (icon && icon.classList && !icon.classList.contains("wx-" + kind)) {
        const wrap = document.createElement("div");
        wrap.innerHTML = heroIcon(f.code, f.isDay);
        const fresh = wrap.firstElementChild;
        fresh.classList.add("swap-in");
        icon.parentNode.replaceChild(fresh, icon);
    }
}

/* Markierung in der Leiste: Klasse sel auf der gewählten Spalte, sonst nirgends */
function markHour(gi) {
    const box = D("hourly");
    if (!box || !box.querySelectorAll) return;
    Array.prototype.slice.call(box.querySelectorAll(".hcol.sel")).forEach(function (el) { el.classList.remove("sel"); });
    if (gi === null || !box.querySelector) return;
    const col = box.querySelector('.hcol[data-i="' + gi + '"]');
    if (col && col.classList) col.classList.add("sel");
}

function selectHour(gi, quiet) {
    const f = hourFacts(lastData, gi);
    if (!f || gi === previewIdx) return;
    previewIdx = gi;
    markHour(gi);
    updateHero(f, quiet);
}

function clearHour(quiet) {
    if (previewIdx === null || !lastData) return;
    previewIdx = null;
    markHour(null);
    updateHero(nowFacts(lastData.fc), quiet);
}

/* ---- Rausgehen: Aktivitätsfenster ---- */

const ACTIVITIES = [
    { id: "walk", name: "Spaziergang",    minH: 1, feel: [5, 28],  prob: 30, gust: 45,           light: "dusk" },
    { id: "bike", name: "Radfahren",      minH: 2, feel: [8, 30],  prob: 20, wind: 25, gust: 40, light: "day" },
    { id: "run",  name: "Joggen",         minH: 1, feel: [2, 24],  prob: 40, gust: 50,           light: "any" },
    { id: "sit",  name: "Draußen sitzen", minH: 2, feel: [17, 99], prob: 20, wind: 15, gust: 30, light: "any" }
];
const FAIL_WORDS = { nass: "meist zu nass", kalt: "meist zu kalt", warm: "meist zu warm", wind: "meist zu windig", dunkel: "nur bei Tageslicht" };

function activityById(id) {
    return ACTIVITIES.filter(function (a) { return a.id === id; })[0] || null;
}

function sunsetHour(fc, date) {
    const d = fc.daily;
    if (!d || !Array.isArray(d.time) || !Array.isArray(d.sunset)) return null;
    const i = d.time.indexOf(date);
    return i >= 0 && d.sunset[i] ? parseInt(d.sunset[i].slice(11, 13), 10) : null;
}

/* null = Stunde passt, sonst der erste verletzte Grund (kalt, warm, nass, wind, dunkel) */
function hourFail(data, act, gi) {
    const h = data.fc.hourly, t = h.time[gi];
    const feel = h.apparent_temperature ? h.apparent_temperature[gi] : null;
    if (!isNum(feel)) return "data";
    if (feel < act.feel[0]) return "kalt";
    if (feel > act.feel[1]) return "warm";
    const rain = h.precipitation ? h.precipitation[gi] : null, code = h.weather_code ? h.weather_code[gi] : 0;
    if (hourProb(data, gi) > act.prob || (isNum(rain) && rain >= 0.2) || code >= 95) return "nass";
    const wind = h.wind_speed_10m ? h.wind_speed_10m[gi] : null, gust = h.wind_gusts_10m ? h.wind_gusts_10m[gi] : null;
    if ((act.wind && isNum(wind) && wind > act.wind) || (act.gust && isNum(gust) && gust > act.gust)) return "wind";
    const day = h.is_day ? h.is_day[gi] : 1;
    if (act.light === "day" && day === 0) return "dunkel";
    if (act.light === "dusk" && day === 0) {
        /* Dämmerung: die Stunde des Sonnenuntergangs und die danach zählen noch */
        const ss = sunsetHour(data.fc, dayOf(t)), hr = parseInt(t.slice(11, 13), 10);
        if (ss === null || hr < ss || hr > ss + 1) return "dunkel";
    }
    return null;
}

function dayWordFor(fc, t) {
    const today = dayOf(fc.current.time), d = dayOf(t);
    return d === today ? "Heute" : (d === nextDay(today) ? "Morgen" : longWeekday(t));
}

function describeWindow(data, s, e) {
    const h = data.fc.hourly;
    let feel = 0, n = 0, prob = 0, wind = 0, uv = 0;
    for (let gi = s; gi <= e; gi++) {
        feel += h.apparent_temperature[gi]; n++;
        prob = Math.max(prob, hourProb(data, gi));
        if (h.wind_speed_10m && isNum(h.wind_speed_10m[gi])) wind = Math.max(wind, h.wind_speed_10m[gi]);
        if (h.uv_index && isNum(h.uv_index[gi])) uv = Math.max(uv, h.uv_index[gi]);
    }
    const ts = h.time[s], te = h.time[e];
    const endH = (parseInt(te.slice(11, 13), 10) + 1) % 24;
    const crosses = dayOf(ts) !== dayOf(te) && endH !== 0;
    const when = dayWordFor(data.fc, ts) + " " + parseInt(ts.slice(11, 13), 10) + " bis " + (crosses ? dayWordFor(data.fc, te) + " " : "") + endH + " Uhr";
    const facts = [
        Math.round(feel / n) + "°",
        prob <= 10 ? "kaum Regen" : "Regen bis " + Math.round(prob) + " %",
        wind <= 12 ? "windstill" : (wind <= 20 ? "wenig Wind" : "Wind bis " + Math.round(wind) + " km/h")
    ];
    if (uv >= 6) facts.push("UV hoch");
    return { start: s, end: e, when: when, facts: facts.join(", ") };
}

/* Fenster = zusammenhängende passende Stunden ab Mindestdauer, in Zeitfolge; reason = häufigster Grund */
function activityWindows(data, act) {
    const out = { windows: [], reason: null };
    if (!data || !data.fc || !data.fc.hourly || !data.fc.hourly.time) return out;
    const w = hourlyWindow(data.fc, 48);
    const fails = {};
    let run = null;
    const close = function () { if (run && run.e - run.s + 1 >= act.minH) out.windows.push(describeWindow(data, run.s, run.e)); run = null; };
    for (let gi = w.start; gi < w.end; gi++) {
        const r = hourFail(data, act, gi);
        if (r === null) { if (run) run.e = gi; else run = { s: gi, e: gi }; }
        else { if (r !== "data") fails[r] = (fails[r] || 0) + 1; close(); }
    }
    close();
    let best = null;
    Object.keys(fails).forEach(function (k) { if (best === null || fails[k] > fails[best]) best = k; });
    out.reason = out.windows.length ? null : best;
    return out;
}

function activityNote(reason) {
    return "In den nächsten 48 Stunden passt keine Zeit" + (reason && FAIL_WORDS[reason] ? ", " + FAIL_WORDS[reason] : "") + ".";
}

let activityId = "walk";

function loadActivity() {
    try {
        const v = localStorage.getItem("wetter:activity");
        if (v && activityById(v)) activityId = v;
    } catch (e) { /* kein Speicher */ }
}

/* Spur unter den Spalten: Klassen auf den Zellen setzen, ohne die Leiste neu zu rendern */
function updateActTrack(windows) {
    const box = D("hourly");
    if (!box || !box.querySelectorAll) return;
    const cells = Array.prototype.slice.call(box.querySelectorAll(".act-track i"));
    if (!cells.length) return;
    const inWin = {}, first = {}, last = {};
    windows.forEach(function (w) { for (let gi = w.start; gi <= w.end; gi++) inWin[gi] = true; first[w.start] = true; last[w.end] = true; });
    cells.forEach(function (c) {
        const i = c.getAttribute("data-i");
        const on = i !== null && inWin[i];
        c.className = on ? "on" + (first[i] ? " first" : "") + (last[i] ? " last" : " cont") : "";
    });
}

function dActivity() {
    const field = D("activityField"), box = D("activity");
    if (!field || !box) return;
    if (!lastData || !lastData.fc || !lastData.fc.hourly) { field.classList.add("hidden"); return; }
    field.classList.remove("hidden");
    const act = activityById(activityId) || ACTIVITIES[0];
    const res = activityWindows(lastData, act);
    const chips = ACTIVITIES.map(function (a) {
        return '<button type="button" class="act-chip' + (a.id === act.id ? ' on' : '') + '" data-act="' + a.id + '">' + a.name + '</button>';
    }).join('');
    const list = res.windows.slice(0, 3).map(function (w, i) {
        return '<button type="button" class="act-win" data-i="' + w.start + '" style="animation-delay:' + dl(1.1 + i * 0.08) + 's"><b>' + w.when + '</b><span>' + w.facts + '</span></button>';
    }).join('');
    box.innerHTML = '<div class="act-chips">' + chips + '</div>' +
        (list ? '<div class="act-list">' + list + '</div>' : '') +
        '<div class="note">' + (list ? 'Antippen zeigt die Stunde oben im Hero.' : activityNote(res.reason)) + '</div>';
    updateActTrack(res.windows);
}

function setActivity(id) {
    if (!activityById(id)) return;
    activityId = id;
    try { localStorage.setItem("wetter:activity", id); } catch (e) { /* kein Speicher */ }
    dActivity();
}

/* ---- Zeitreise Stufe 2: Ziehen vom Griff (markierte Spalte) ---- */

const scrub = { pending: false, active: false, x0: 0, y0: 0, lastX: 0, lastY: 0, raf: null, endedAt: 0 };
const SCRUB_EDGE = 36, SCRUB_STEP = 4, SCRUB_INSET = 24;

function scrubActive() { return scrub.active; }

function stripEl() {
    const box = D("hourly");
    return box && box.querySelector ? box.querySelector(".strip") : null;
}

/* Spalte unter einem Punkt; ohne elementFromPoint (Harness) null */
function columnAt(x, y) {
    if (!document.elementFromPoint) return null;
    const el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest(".hcol") : null;
}

/* Abtastpunkt ins Spalteninnere klemmen: am Leistenrand liegt der Finger im Innenabstand,
   wo elementFromPoint keine Spalte mehr trifft */
function sampleX(x) {
    const strip = stripEl();
    if (!strip || !strip.getBoundingClientRect) return x;
    const r = strip.getBoundingClientRect();
    if (isNum(r.left) && isNum(r.right) && r.right - r.left > 2 * SCRUB_INSET) return Math.min(Math.max(x, r.left + SCRUB_INSET), r.right - SCRUB_INSET);
    return x;
}

function applyScrubColumn(col) {
    if (!col || !col.getAttribute) return;
    const i = col.getAttribute("data-i");
    if (i === null) clearHour(true); else selectHour(parseInt(i, 10), true);
}

/* Beginn nur auf der markierten Spalte; die Richtung entscheidet das erste Bewegungsereignis */
function scrubStart(x, y, col) {
    if (!col || !col.classList || !col.classList.contains("sel")) return false;
    scrub.pending = true; scrub.active = false;
    scrub.x0 = x; scrub.y0 = y; scrub.lastX = x; scrub.lastY = y;
    return true;
}

/* "release": senkrecht, Geste frei · "scrub": aktiv, Ereignis abfangen · "idle": kein Ziehen */
function scrubMove(x, y) {
    if (scrub.pending) {
        const dx = Math.abs(x - scrub.x0), dy = Math.abs(y - scrub.y0);
        scrub.pending = false;
        if (dy > dx && dy >= 3) return "release";
        scrub.active = true;
        const strip = stripEl();
        if (strip && strip.classList) strip.classList.add("scrubbing");
        edgeScroll();
    }
    if (!scrub.active) return "idle";
    scrub.lastX = x; scrub.lastY = y;
    applyScrubColumn(columnAt(sampleX(x), y));
    return "scrub";
}

/* Nahe am Leistenrand rollt die Leiste weiter, die Spalte unter dem Finger wird neu bestimmt */
function edgeScroll() {
    if (!scrub.active || typeof requestAnimationFrame !== "function") return;
    const strip = stripEl();
    if (strip && strip.getBoundingClientRect) {
        const r = strip.getBoundingClientRect();
        let dx = 0;
        if (isNum(r.right) && scrub.lastX > r.right - SCRUB_EDGE) dx = SCRUB_STEP;
        else if (isNum(r.left) && scrub.lastX < r.left + SCRUB_EDGE) dx = -SCRUB_STEP;
        if (dx) { strip.scrollLeft += dx; applyScrubColumn(columnAt(sampleX(scrub.lastX), scrub.lastY)); }
    }
    scrub.raf = requestAnimationFrame(edgeScroll);
}

function settleHero() {
    const hero = D("hero");
    if (!hero || !hero.querySelector || !hero.firstElementChild) return;
    flip(hero.querySelector(".meta"));
    flip(hero.querySelector(".chips"));
}

function scrubEnd() {
    const was = scrub.active;
    scrub.pending = false; scrub.active = false;
    if (scrub.raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(scrub.raf);
    scrub.raf = null;
    const strip = stripEl();
    if (strip && strip.classList) strip.classList.remove("scrubbing");
    if (was) { scrub.endedAt = Date.now(); settleHero(); }
}

function renderHero(fc) {
    const d = fc.daily;
    const f = nowFacts(fc);
    setTheme(themeFor(f.code, f.isDay));

    const nc = nowcastSummary(fc);
    const hero = D("hero");
    unskel(hero);
    const first = introElapsed() < 0.3;
    lastTemp = isNum(f.temp) ? Math.round(f.temp) : null;
    hero.innerHTML = heroHtml(f, true);
    if (first && lastTemp !== null) countUp(hero.querySelector(".temp"), lastTemp);

    /* Hinweis-Feld: Nowcast als Satz, darunter eine Einordnung */
    const ins = D("insight");
    if (!nc) { ins.classList.add("hidden"); return; }
    const p0 = d && isNum(d.precipitation_probability_max[0]) ? d.precipitation_probability_max[0] : null;
    let sub;
    if (nc.wet) sub = "Schirm einpacken";
    else if (p0 !== null && p0 >= 30) sub = "Später am Tag " + p0 + " % Regenrisiko";
    else sub = "Heute bleibt es voraussichtlich trocken";
    ins.classList.remove("hidden");
    ins.innerHTML =
        '<div class="ico">' + (nc.wet ? UI.umbrellaRain : UI.check) + '</div>' +
        '<div class="txt"><b>' + nc.text + '</b><span>' + sub + '</span></div>';
}

function dHourly(fc, ens) {
    const box = D("hourly");
    unskel(box);
    const h = fc.hourly;
    const w = hourlyWindow(fc, 48);
    const n = w.end - w.start;
    if (n < 2) { box.innerHTML = '<div class="note">Keine Stundendaten.</div>'; return; }

    const data = lastData && lastData.fc === fc ? lastData : prepareData(fc, ens);

    let cols = "", cells = "", prevDay = null;
    for (let i = 0; i < n; i++) {
        const gi = w.start + i;
        /* Rausgehen-Spur: eine Zelle je Spalte, die Spalte „Jetzt" ohne Index */
        cells += i === 0 ? '<i></i>' : '<i data-i="' + gi + '"></i>';
        const t = h.time[gi];
        const v = h.temperature_2m[gi];
        const prob = hourProb(data, gi);
        const dd = dayOf(t);
        const newDay = prevDay !== null && dd !== prevDay;
        prevDay = dd;
        const wet = i !== 0 && prob >= 25;
        /* data-i: globaler Stundenindex für die Zeitreise; die Spalte „Jetzt" hat keins */
        cols +=
            '<div' + (i === 0 ? '' : ' data-i="' + gi + '"') + ' class="hcol' + (i === 0 ? ' now' : '') + (newDay ? ' newday' : '') + (wet ? ' wet' : '') + '" style="animation-delay:' + dl(0.9 + Math.min(i, 8) * 0.06) + 's">' +
                /* Regenstunden: das Blau steigt wie ein Wasserstand bis zur Wahrscheinlichkeit */
                (wet ? '<i class="fill" data-stagger="' + (Math.min(i, 8) * 0.06).toFixed(2) + 's" style="--p:' + Math.round(prob) + '%;animation-delay:' + dl(1.15 + Math.min(i, 8) * 0.06) + 's"></i>' : '') +
                '<div class="t">' + (i === 0 ? "Jetzt" : (newDay ? weekday(dd) : hhmm(t).slice(0, 2))) + '</div>' +
                svgIcon(h.weather_code[gi], h.is_day ? h.is_day[gi] : 1, "ic") +
                '<div class="v">' + (isNum(v) ? Math.round(v) + '°' : '–') + '</div>' +
                '<div class="p">' + Math.round(prob) + '%</div>' +
            '</div>';
    }
    box.innerHTML = '<div class="strip"><div class="strip-inner">' + cols + '</div><div class="act-track">' + cells + '</div></div>';
}

function dNowcast(fc) {
    const box = D("nowcast"), card = D("nowcastCard");
    const nc = nowcastSummary(fc);
    if (!nc || !nc.wet) { card.classList.add("hidden"); return; }
    card.classList.remove("hidden");
    const peak = Math.max.apply(null, nc.vals.concat([0.4]));
    box.innerHTML =
        '<div class="nc-lead">' + nc.text + '</div>' +
        /* Balken wachsen nacheinander von links nach rechts aus der Grundlinie; data-stagger
           hält die Staffelung auch beim Neustart per Antippen */
        '<div class="nc-bars">' + nc.vals.map(function (v, i) {
            const stagger = (i * 0.1).toFixed(2) + 's';
            return '<i class="' + (v > 0 ? '' : 'z') + '" data-stagger="' + stagger + '" style="height:' + (v > 0 ? Math.max(8, Math.round(v / peak * 100)) : 4) + '%;animation-delay:' + dl(1.0 + i * 0.1) + 's"></i>';
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
    const SHOWN = 7;
    let rows = "", moreRows = "";
    for (let i = 0; i < n; i++) {
        const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i];
        const prob = d.precipitation_probability_max[i];
        const code = d.weather_code[i];
        const left = (lo - tLo) / span * 100, width = Math.max(3, (hi - lo) / span * 100);
        const mood = isWetCode(code) || (isNum(prob) && prob >= 50) ? ' wet' : (code === 0 || code === 1 ? ' fair' : '');
        const more = i >= SHOWN;
        /* Weitere Tage blenden erst beim Aufklappen ein (Staffelung im Stylesheet), ihre Spannen wachsen dann */
        const delay = more ? null : dl(1.4 + Math.min(i, SHOWN) * 0.05);
        const row =
            '<div class="drow' + (i === 0 ? ' today' : '') + mood + (more ? ' more' : '') + '"' + (more ? '' : ' style="animation-delay:' + delay + 's"') + '>' +
                '<div class="n">' + (i === 0 ? "Heute" : weekday(d.time[i])) + '</div>' +
                svgIcon(code, 1, "ic") +
                '<div class="pp">' + (isNum(prob) ? Math.round(prob) + '%' : '') + '</div>' +
                '<div class="lo">' + Math.round(lo) + '°</div>' +
                '<div class="bar"><i style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%;animation-delay:' + (more ? '0.5' : (+delay + 0.2).toFixed(2)) + 's"></i>' +
                    (i === 0 && isNum(cur) ? '<b style="left:' + Math.max(0, Math.min(100, (cur - tLo) / span * 100)).toFixed(1) + '%"></b>' : '') +
                '</div>' +
                '<div class="hi">' + Math.round(hi) + '°</div>' +
            '</div>';
        if (more) moreRows += row; else rows += row;
    }
    if (moreRows) rows += '<div class="more-wrap"><div class="more-inner">' + moreRows + '</div></div>';
    if (n > SHOWN) {
        rows += '<button type="button" class="days-more" id="daysMore"><span id="daysMoreLabel">Weitere ' + (n - SHOWN) + ' Tage</span>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>';
    }
    box.innerHTML = rows;
    const btn = D("daysMore");
    if (btn && n > SHOWN) {
        btn.addEventListener("click", function () {
            const field = D("daysField");
            const open = field.classList.toggle("all");
            D("daysMoreLabel").textContent = open ? "Weniger anzeigen" : "Weitere " + (n - SHOWN) + " Tage";
        });
    }
}

/* ---- Kacheln ---- */

/* Kachel: Titelzeile mit optionalem Mini-Icon rechts, großer Wert, optionaler Zusatz (Skala), Untertitel.
   opts.delay staffelt das Einblenden, opts.icon / opts.extra sind kleine SVGs mit Mikroanimation. */
function tile(cls, title, big, sub, opts) {
    opts = opts || {};
    const count = isNum(opts.count) ? ' data-count="' + Number(opts.count.toFixed(opts.decimals || 0)) + '" data-decimals="' + (opts.decimals || 0) + '"' : '';
    return '<div class="tile ' + cls + '" style="animation-delay:' + dl(opts.delay || 0) + 's">' +
        '<h3>' + title + (opts.icon ? '<span class="t-ico">' + opts.icon + '</span>' : '') + '</h3>' +
        '<div class="big"' + count + '>' + big + '</div>' +
        (opts.extra || '') +
        (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
}

/* Mini-Icons für die Kacheln: Farben und Bewegung kommen aus dem Stylesheet */
/* Windlinien plus Richtungspfeil (zeigt, wohin der Wind weht; Drehung mit Überschwung im Stylesheet) */
function windMini(dirFrom) {
    const ang = isNum(dirFrom) ? Math.round((dirFrom + 180) % 360) : 0;
    return '<svg viewBox="0 0 64 24" width="58" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path class="windflow" d="M2 6h26a4 4 0 1 0-4-4"/><path class="windflow w2" d="M2 13h30a4 4 0 1 1-4 4"/><path class="windflow w3" d="M2 20h18"/>' +
        '<g class="wdir" style="--ang:' + ang + 'deg"><path d="M55 3v18M49 9l6-6 6 6"/></g></svg>';
}

const MINI = {
    rain: '<svg class="rain-ico" viewBox="0 0 40 28" width="36" height="26" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 12h20a6 6 0 0 0 .6-12A9 9 0 0 0 7 7a5 5 0 0 0 1 5z"/><line class="tiledrop" x1="12" y1="16" x2="11" y2="21"/><line class="tiledrop d2" x1="20" y1="16" x2="19" y2="21"/><line class="tiledrop d3" x1="28" y1="16" x2="27" y2="21"/></svg>'
};

/* Sonnenbogen: Anteil des Tages, der schon vorbei ist, als Bogen plus Sonnenpunkt */
/* Sonnenfarbe nach Höhe über dem Horizont: Morgen- und Abendrot am Rand, Gelb oben.
   p = Anteil des Tagbogens (0 Aufgang, 1 Untergang). */
function sunColor(p) {
    const elev = Math.sin(Math.PI * Math.max(0, Math.min(1, p)));
    const t = Math.pow(Math.max(0, Math.min(1, elev / 0.6)), 0.8);   /* gelb ab etwa einem Fünftel des Tagbogens */
    const red = [232, 121, 74], yellow = [246, 211, 91];
    return 'rgb(' + red.map(function (v, i) { return Math.round(v + (yellow[i] - v) * t); }).join(',') + ')';
}

/* Sonnenbogen: der Bogen zeichnet sich bis zum aktuellen Stand, die Sonne wandert von
   Anfang an mit (Drehung um den Bogenmittelpunkt) und färbt sich dabei vom Morgenrot
   ins Gelb. Die fünf Farbstützen gelten für diese Teilstrecke. */
function sunArc(c, d) {
    const now = minutesOf(c.time), rise = minutesOf(d.sunrise && d.sunrise[0]), set = minutesOf(d.sunset && d.sunset[0]);
    if (now === null || rise === null || set === null || set <= rise) return '';
    const p = Math.max(0, Math.min(1, (now - rise) / (set - rise)));
    const path = 'M8 54 A52 52 0 0 1 112 54';
    const stops = [0, 0.25, 0.5, 0.75, 1].map(function (k, i) { return '--c' + i + ':' + sunColor(p * k); }).join(';');
    return '<svg class="arc" viewBox="0 0 120 60" aria-hidden="true" style="--p:' + Math.round(p * 100) + ';--ang:' + Math.round(p * 180) + 'deg;' + stops + '">' +
        '<path class="track" d="' + path + '" fill="none" stroke-width="4" stroke-linecap="round"/>' +
        (p > 0 ? '<path class="done" pathLength="100" d="' + path + '" fill="none" stroke-width="4" stroke-linecap="round"/>' : '') +
        (p > 0 && p < 1 ? '<g class="sunpos"><circle class="dot" cx="8" cy="54" r="6" stroke-width="2.4"/></g>' : '') +
        '</svg>';
}

/* Tropfen, der sich bis zur Luftfeuchte füllt */
function dropIcon(humidity) {
    const y = isNum(humidity) ? 2 + (1 - Math.max(0, Math.min(100, humidity)) / 100) * 26 : 30;
    const shape = 'M12 2c5 7 9 12 9 17a9 9 0 0 1-18 0c0-5 4-10 9-17z';
    /* Die Maske liegt auf einer ruhenden Gruppe; nur das Rechteck darin steigt. Läge die
       Maske auf dem Rechteck selbst, würde sie mitwandern und das Wasser aus dem Tropfen laufen. */
    return '<svg class="drop-ico" viewBox="0 0 24 30" width="20" height="26" fill="none" stroke-width="2" stroke-linejoin="round" aria-hidden="true">' +
        '<clipPath id="dropclip"><path d="' + shape + '"/></clipPath>' +
        '<g clip-path="url(#dropclip)"><rect x="0" y="' + y.toFixed(1) + '" width="24" height="30" stroke="none"/></g>' +
        '<path d="' + shape + '"/></svg>';
}

/* Druckanzeige: Zeiger zwischen 980 und 1040 hPa */
function gaugeIcon(p) {
    const ang = isNum(p) ? Math.max(-90, Math.min(90, (p - 980) / 60 * 180 - 90)) : -90;
    return '<svg class="gauge-ico" viewBox="0 0 48 28" width="44" height="26" fill="none" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" style="--ang:' + ang.toFixed(0) + 'deg">' +
        '<path class="track" d="M4 26 A20 20 0 0 1 44 26"/><line class="needle" x1="24" y1="26" x2="24" y2="9"/></svg>';
}

function renderDetails(fc, air) {
    const box = D("details");
    unskel(box);
    const c = fc.current, d = fc.daily, h = fc.hourly;
    const w = hourlyWindow(fc, 24);
    const uvNow = h.uv_index ? h.uv_index[w.start] : null;
    const uvMax = d.uv_index_max ? d.uv_index_max[0] : null;
    const lv = uvLevel(uvNow);
    let html = "", k = 0;
    const next = function () { return 1.0 + (k++) * 0.07; };

    html += tile("uv", "UV-Index",
        (isNum(uvNow) ? fmtNum(uvNow, 1) : '–') + (lv ? '<span class="word">' + lv.word + '</span>' : ''),
        isNum(uvMax) ? 'Maximum heute ' + fmtNum(uvMax, 1) : null,
        { delay: next(), count: isNum(uvNow) ? uvNow : null, decimals: 1, extra: '<div class="meter"><i class="st-' + (lv ? lv.st : 'none') + '" style="width:' + (isNum(uvNow) ? Math.max(3, Math.min(100, uvNow / 11 * 100)).toFixed(0) : 0) + '%"></i></div>' });

    html += tile("wind", "Wind",
        (isNum(c.wind_speed_10m) ? Math.round(c.wind_speed_10m) : '–') + '<small>km/h</small>',
        'Aus ' + compass(c.wind_direction_10m) + ' · Böen ' + Math.round(c.wind_gusts_10m),
        { delay: next(), count: isNum(c.wind_speed_10m) ? Math.round(c.wind_speed_10m) : null, icon: windMini(c.wind_direction_10m) });

    html += tile("rain", "Regen",
        fmtMm(d.precipitation_sum[0]) + '<small>mm</small>',
        (isNum(d.precipitation_probability_max[0]) ? 'Risiko ' + d.precipitation_probability_max[0] + '&nbsp;%' : '') +
        (isNum(d.precipitation_hours && d.precipitation_hours[0]) && d.precipitation_hours[0] > 0 ? ' · ' + Math.round(d.precipitation_hours[0]) + '&nbsp;h' : '') +
        '<br>Morgen ' + fmtMm(d.precipitation_sum[1]) + '&nbsp;mm · ' + (isNum(d.precipitation_probability_max[1]) ? d.precipitation_probability_max[1] + '&nbsp;%' : '–'),
        { delay: next(), count: isNum(d.precipitation_sum[0]) ? d.precipitation_sum[0] : null, decimals: isNum(d.precipitation_sum[0]) && d.precipitation_sum[0] >= 0.05 && d.precipitation_sum[0] < 10 ? 1 : 0, icon: MINI.rain });

    html += tile("sun", "Sonne",
        hhmm(d.sunset && d.sunset[0]),
        'Aufgang ' + hhmm(d.sunrise && d.sunrise[0]) + ' · <span style="white-space:nowrap">' + fmtDuration(d.daylight_duration && d.daylight_duration[0]) + '</span>',
        { delay: next(), extra: sunArc(c, d) });

    html += tile("plain", "Luftfeuchte",
        Math.round(c.relative_humidity_2m) + '<small>%</small>',
        'Bewölkung ' + fmtNum(c.cloud_cover, 0) + '&nbsp;%',
        { delay: next(), count: isNum(c.relative_humidity_2m) ? Math.round(c.relative_humidity_2m) : null, icon: dropIcon(c.relative_humidity_2m) });

    html += tile("plain", "Luftdruck",
        fmtNum(c.pressure_msl, 0),
        'hPa · ' + (isNum(c.pressure_msl) ? (c.pressure_msl >= 1020 ? 'Hochdruck' : (c.pressure_msl <= 1005 ? 'Tiefdruck' : 'normal')) : '–'),
        { delay: next(), count: isNum(c.pressure_msl) ? Math.round(c.pressure_msl) : null, icon: gaugeIcon(c.pressure_msl) });

    if (air && air.current) {
        const a = air.current, al = aqiLevel(a.european_aqi);
        const xpos = isNum(a.european_aqi) ? Math.max(2, Math.min(100, a.european_aqi)) : 0;
        html += tile("plain", "Luftqualität",
            (isNum(a.european_aqi) ? Math.round(a.european_aqi) : '–') +
            (al ? '<span class="word" style="color:' + STATUS[al.st] + '">' + al.word + '</span>' : '') +
            '<div class="meter"><i class="st-' + (al ? al.st : 'none') + '" style="width:' + xpos + '%"></i></div>',
            'PM2,5 ' + fmtNum(a.pm2_5, 0) + ' · PM10 ' + fmtNum(a.pm10, 0) + ' · O₃ ' + fmtNum(a.ozone, 0) + ' µg/m³',
            { delay: next(), count: isNum(a.european_aqi) ? Math.round(a.european_aqi) : null });

        const chips = POLLEN.map(function (p) {
            const lvp = pollenLevel(a[p.key], p.thr);
            return lvp && lvp.st !== "none" ? '<span class="pchip"><i class="st-' + lvp.st + '"></i>' + p.name + ' · ' + lvp.word + '</span>' : '';
        }).join('');
        const anyPollen = POLLEN.some(function (p) { return isNum(a[p.key]); });
        html += tile("plain", "Pollen",
            '<div class="pollen-chips">' + (chips || '<span class="pchip"><i class="st-none"></i>' + (anyPollen ? 'Zurzeit kein nennenswerter Pollenflug' : 'Pollendaten nur in Europa') + '</span>') + '</div>', null,
            { delay: next() });
    }

    box.innerHTML = html;
}

/* ---- Modellvergleich als Chips ---- */

/* ---- Modellunsicherheit: Summen, Kurven, Band, Satz ---- */

/* Stundenindizes je Datum aus md.hourly.time */
function modelDays(md) {
    const out = { dates: [], hourIdx: {} };
    if (!md || !md.hourly || !Array.isArray(md.hourly.time)) return out;
    md.hourly.time.forEach(function (t, i) {
        const d = dayOf(t);
        if (!out.hourIdx[d]) { out.hourIdx[d] = []; out.dates.push(d); }
        out.hourIdx[d].push(i);
    });
    return out;
}

/* Laufende Summe über die Stunden eines Tages: 25 Punkte von 0 Uhr bis 24 Uhr */
function cumulative(values, idxs) {
    const out = [0];
    let s = 0;
    for (let h = 0; h < 24; h++) {
        const i = idxs[h];
        if (i !== undefined && isNum(values[i])) s += values[i];
        out.push(s);
    }
    return out;
}

/* Je Modell Tagessummen heute/morgen und Summenkurven, alles aus den Stundenwerten,
   damit die Endpunkte der Kurven exakt den Chips entsprechen */
function modelSums(md) {
    const days = modelDays(md);
    if (days.dates.length < 2) return [];
    const today = days.dates[0], tomorrow = days.dates[1];
    const out = [];
    MODELS.forEach(function (m) {
        const v = md.hourly["precipitation_" + m.id];
        if (!Array.isArray(v) || !days.hourIdx[today].some(function (i) { return isNum(v[i]); })) return;
        const ct = cumulative(v, days.hourIdx[today]), cm = cumulative(v, days.hourIdx[tomorrow]);
        out.push({ id: m.id, name: m.name, sub: m.sub, today: ct[24], tomorrow: cm[24], cum: { today: ct, tomorrow: cm } });
    });
    return out;
}

/* ICON-D2-Ensemble: je Lauf die laufende Tagessumme; Band = 10- bis 90-Prozent-Quantil je Stunde */
function ensembleBand(ens, date) {
    if (!ens || !ens.hourly || !Array.isArray(ens.hourly.time)) return null;
    const idxs = [];
    ens.hourly.time.forEach(function (t, i) { if (dayOf(t) === date) idxs.push(i); });
    if (idxs.length < 24) return null;
    const members = ensembleSeries(ens.hourly);
    if (members.length < 3) return null;
    const cums = members.map(function (s) { return cumulative(s, idxs); });
    const lo = [], hi = [];
    for (let h = 0; h <= 24; h++) {
        const col = cums.map(function (c) { return c[h]; }).sort(function (a, b) { return a - b; });
        lo.push(quantile(col, 0.1)); hi.push(quantile(col, 0.9));
    }
    return { lo: lo, hi: hi, sums: cums.map(function (c) { return c[24]; }).sort(function (a, b) { return a - b; }) };
}

/* Übereinstimmung der Modelle für einen Tag; Regen ab 0,5 mm. Nie als Wahrscheinlichkeit formuliert. */
function agreementText(dayWord, sums) {
    const v = sums.filter(isNum);
    const n = v.length;
    if (n < 2) return "";
    const wet = v.filter(function (x) { return x >= 0.5; }).length;
    const sorted = v.slice().sort(function (a, b) { return a - b; });
    const spread = sorted[n - 1] - sorted[0], median = quantile(sorted, 0.5);
    const lead = "Für " + dayWord + " sind sich die Modelle ";
    if (wet === 0) return lead + "einig: trocken.";
    if (wet === n) {
        if (spread <= Math.max(2, median / 2)) return lead + "einig: Regen, um " + fmtMm(median) + " mm.";
        return lead + "weitgehend einig: Regen, aber die Menge schwankt zwischen " + fmtMm(sorted[0]) + " und " + fmtMm(sorted[n - 1]) + " mm.";
    }
    const share = Math.max(wet, n - wet) / n;
    return lead + (share >= 0.75 ? "weitgehend einig: " : "uneinig: ") + wet + " von " + n + " rechnen mit Regen.";
}

let hlModel = "icon_d2";

function fmtPt(x, y) { return x.toFixed(1) + "," + y.toFixed(1); }

/* Kurvenbild: zwei Tafeln heute/morgen, gemeinsame y-Skala, Band nur am ICON-D2 */
function modelChartSvg(models, bands, nowHour, hl) {
    const panels = [{ key: "today", x0: 10, label: "Heute" }, { key: "tomorrow", x0: 170, label: "Morgen" }];
    const W = 140, Y0 = 80, Y1 = 14;
    let maxV = 1;
    models.forEach(function (m) { maxV = Math.max(maxV, m.today, m.tomorrow); });
    panels.forEach(function (p) { if (bands[p.key]) maxV = Math.max(maxV, bands[p.key].hi[24]); });
    const sx = function (p, h) { return p.x0 + h / 24 * W; };
    const sy = function (v) { return Y0 - v / maxV * (Y0 - Y1); };
    let out = '<svg class="mchart" viewBox="0 0 320 96" aria-hidden="true">';
    panels.forEach(function (p) {
        out += '<line class="base" x1="' + p.x0 + '" y1="' + Y0 + '" x2="' + (p.x0 + W) + '" y2="' + Y0 + '"/>';
        out += '<text class="lbl" x="' + p.x0 + '" y="9">' + p.label + '</text>';
        const b = bands[p.key];
        if (b) {
            let pts = "";
            for (let h = 0; h <= 24; h++) pts += fmtPt(sx(p, h), sy(b.hi[h])) + " ";
            for (let h = 24; h >= 0; h--) pts += fmtPt(sx(p, h), sy(b.lo[h])) + " ";
            out += '<polygon class="band' + (hl === "icon_d2" ? '' : ' off') + '" points="' + pts.trim() + '"/>';
        }
        if (p.key === "today" && isNum(nowHour)) {
            const x = sx(p, nowHour).toFixed(1);
            out += '<line class="now" x1="' + x + '" y1="' + Y1 + '" x2="' + x + '" y2="' + Y0 + '"/>';
        }
        models.forEach(function (m, i) {
            const c = m.cum[p.key];
            let d = "";
            for (let h = 0; h <= 24; h++) d += (h ? " L" : "M") + fmtPt(sx(p, h), sy(c[h]));
            out += '<path class="ml m-' + m.id + (m.id === hl ? ' hl' : '') + '" pathLength="1" d="' + d + '" style="animation-delay:' + dl(2.1 + i * 0.1) + 's"/>';
        });
        const hm = models.filter(function (m) { return m.id === hl; })[0];
        if (hm) out += '<text class="end" x="' + (p.x0 + W + 3) + '" y="' + (sy(hm[p.key]) + 3).toFixed(1) + '">' + fmtMm(hm[p.key]) + ' mm</text>';
    });
    return out + '</svg>';
}

/* Hervorhebung wechseln: Klassen auf Pfaden und Chips, Band nur bei ICON-D2 sichtbar.
   Die Endwert-Beschriftung gehört zum hervorgehobenen Modell und wird dafür neu gesetzt. */
function highlightModel(id) {
    hlModel = id;
    const box = D("models");
    if (!box || !box.querySelectorAll) return;
    Array.prototype.slice.call(box.querySelectorAll(".ml, .mchip")).forEach(function (el) {
        const mine = (el.classList && el.classList.contains("m-" + id)) || el.getAttribute("data-model") === id;
        el.classList.toggle("hl", !!mine);
    });
    Array.prototype.slice.call(box.querySelectorAll(".band")).forEach(function (el) { el.classList.toggle("off", id !== "icon_d2"); });
    const ends = Array.prototype.slice.call(box.querySelectorAll(".end"));
    const chip = box.querySelector ? box.querySelector('.mchip[data-model="' + id + '"]') : null;
    const vals = chip && chip.querySelectorAll ? Array.prototype.slice.call(chip.querySelectorAll("[data-count]")).map(function (e) { return parseFloat(e.getAttribute("data-count")); }) : [];
    ends.forEach(function (el, i) {
        const v = vals[i];
        if (!isNum(v)) { el.textContent = ""; return; }
        el.textContent = fmtMm(v) + " mm";
        const path = box.querySelector('.ml.m-' + id);
        if (path && el.setAttribute) {
            /* y-Position: Endpunkt des Pfads der jeweiligen Tafel */
            const paths = Array.prototype.slice.call(box.querySelectorAll('.ml.m-' + id));
            const d = paths[i] && paths[i].getAttribute ? paths[i].getAttribute("d") : "";
            const last = d ? d.slice(d.lastIndexOf("L") + 1).split(",") : null;
            if (last && last.length === 2) el.setAttribute("y", (parseFloat(last[1]) + 3).toFixed(1));
        }
    });
}

function dModels(md, fc, ens) {
    const box = D("models");
    unskel(box);
    const models = md ? modelSums(md) : [];
    if (!models.length) { box.innerHTML = '<div class="note">Modellvergleich derzeit nicht verfügbar.</div>'; return; }

    const days = modelDays(md);
    const nowHour = fc && fc.current && fc.current.time ? parseInt(fc.current.time.slice(11, 13), 10) + parseInt(fc.current.time.slice(14, 16), 10) / 60 : null;
    const hl = models.some(function (m) { return m.id === hlModel; }) ? hlModel : models[0].id;
    const bands = { today: ensembleBand(ens, days.dates[0]), tomorrow: ensembleBand(ens, days.dates[1]) };

    /* Satz zur Übereinstimmung: morgen immer, heute nur vormittags */
    let agree = agreementText("morgen", models.map(function (m) { return m.tomorrow; }));
    if (isNum(nowHour) && nowHour < 12) {
        const t = agreementText("heute", models.map(function (m) { return m.today; }));
        if (t) agree = t + " " + agree;
    }

    const num = function (v) { return isNum(v) ? '<span data-count="' + Number(v.toFixed(1)) + '" data-decimals="' + (v >= 0.05 && v < 10 ? 1 : 0) + '">' + fmtMm(v) + '</span>' : '–'; };
    const chips = models.map(function (m, i) {
        return '<div class="mchip' + (m.id === hl ? ' hl' : '') + '" data-model="' + m.id + '" style="animation-delay:' + dl(2.0 + i * 0.07) + 's"><span class="k">' + m.name + '</span><span class="v">' + num(m.today) + ' / ' + num(m.tomorrow) + '</span></div>';
    }).join('');

    /* Ensemble-Zeile mit Zählwerten, damit nichts wie eine Trefferwahrscheinlichkeit wirkt */
    let ensNote = "";
    const b = bands.tomorrow;
    if (b && b.sums.length >= 3) {
        const wet = b.sums.filter(function (v) { return v >= 0.1; }).length;
        ensNote = 'ICON-D2-Ensemble, morgen: ' + fmtMm(b.sums[0]) + ' bis ' + fmtMm(b.sums[b.sums.length - 1]) + ' mm, Median ' + fmtMm(quantile(b.sums, 0.5)) + ' mm · ' + wet + ' von ' + b.sums.length + ' Läufen mit Regen.';
    }

    box.innerHTML = (agree ? '<div class="agree">' + agree + '</div>' : '') +
        modelChartSvg(models, bands, nowHour, hl) +
        '<div class="mchips">' + chips + '</div>' +
        (ensNote ? '<div class="note">' + ensNote + '</div>' : '');
}

/* ---- Amtliche Warnungen (DWD) ---- */

const WARN_WORDS = { 1: "Wetterwarnung", 2: "Markante Wetterwarnung", 3: "Unwetterwarnung", 4: "Extreme Unwetterwarnung" };

function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
}

function fmtWarnTime(iso) {
    if (!iso) return "–";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "–";
    const hm = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (sameDay) return hm;
    /* Innerhalb einer Woche reicht der Wochentag, davor oder danach braucht es das Datum */
    const days = Math.abs(d.getTime() - now.getTime()) / 86400000;
    if (days < 6) return d.toLocaleDateString("de-DE", { weekday: "short" }) + " " + hm;
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + ", " + hm;
}

/* DWD-Wetterwarnungen und NINA-Meldungen in einem Feld: höchste Stufe zuerst,
   bei gleicher Stufe Bevölkerungsschutz vor Wetter. */
function mergeWarnings(dwd, nina) {
    const all = (dwd || []).map(function (w) { return Object.assign({ source: "dwd" }, w); }).concat(nina || []);
    all.sort(function (a, b) {
        return b.level - a.level || (a.source === b.source ? 0 : (a.source === "nina" ? -1 : 1));
    });
    return all;
}

function renderWarnings(dwd, nina) {
    const box = D("warnings");
    if (!box) return;
    const list = mergeWarnings(dwd, nina);
    if (!list.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = list.map(function (w, i) {
        const isNina = w.source === "nina";
        let meta;
        if (isNina) {
            meta = w.providerLabel + (w.sent ? ' · seit ' + fmtWarnTime(w.sent) : '') + (w.expires ? ' · bis ' + fmtWarnTime(w.expires) : '');
        } else {
            meta = WARN_WORDS[w.level] + ' · ' + (w.upcoming ? "ab " + fmtWarnTime(w.onset) + " " : "") + "bis " + fmtWarnTime(w.expires);
        }
        const text = String(w.description || "").trim();
        const src = isNina
            ? 'Quelle: ' + escHtml(w.providerLabel) + ' über NINA (warnung.bund.de)' + (w.area ? ' · ' + escHtml(w.area) : '')
            : 'Quelle: Deutscher Wetterdienst' + (w.area ? ' · ' + escHtml(w.area) : '');
        /* Felder gleiten nacheinander ein; das Dreieck wackelt einmal, das Megafon sendet Wellen */
        return '<details class="field warn lvl-' + w.level + (isNina ? ' nina' : '') + ' a-up" style="animation-delay:' + dl(0.55 + i * 0.08) + 's">' +
            '<summary>' +
                '<span class="ico">' + (isNina ? UI.megaphone : UI.alert.replace('<svg ', '<svg class="wobble" ')) + '</span>' +
                '<span class="txt"><b>' + escHtml(w.headline) + '</b><span>' + escHtml(meta) + '</span></span>' +
                '<span class="chev">' + UI.chevron + '</span>' +
            '</summary>' +
            '<div class="body">' +
                (text ? '<p>' + escHtml(text).replace(/\n/g, '<br>') + '</p>' : '') +
                (w.instruction ? '<p class="instr">' + escHtml(w.instruction).replace(/\n/g, '<br>') + '</p>' : '') +
                '<p class="src">' + src + '</p>' +
            '</div>' +
        '</details>';
    }).join('');
}

/* Inhalte des vorherigen Orts entfernen, wenn für den neuen keine Daten kommen:
   Kopfzeile und Daten müssen immer zum selben Ort gehören. */
function clearRendered() {
    lastTemp = null;
    lastData = null;
    previewIdx = null;
    const hero = D("hero");
    unskel(hero);
    hero.innerHTML = '<div class="meta"><span></span><span>Keine Daten</span></div><div class="main"><div class="temp">–°</div></div>';
    ["warnings", "insight", "nowcastCard", "activityField"].forEach(function (id) {
        const el = D(id);
        if (!el) return;
        el.classList.add("hidden");
        if (id !== "nowcastCard" && id !== "activityField") el.innerHTML = "";
    });
    ["hourly", "days", "details", "models"].forEach(function (id) {
        const el = D(id);
        if (!el) return;
        unskel(el);
        el.innerHTML = '<div class="note">Für diesen Ort liegen noch keine Daten vor.</div>';
    });
    const u = D("updated");
    if (u) u.textContent = "";
}

/* Gleitende Tab-Markierung: die Pille hinter dem aktiven Tab bekommt dessen Position und Breite,
   der Wechsel läuft dann als Übergang im Stylesheet. Ohne Layout-Werte (Tests) passiert nichts. */
function moveTabInk() {
    const nav = document.querySelector ? document.querySelector(".tabs nav") : null;
    if (!nav || !nav.querySelector) return;
    const ink = nav.querySelector(".tab-ink"), on = nav.querySelector("a.on");
    if (!ink || !on || typeof on.offsetLeft !== "number" || !on.offsetWidth) return;
    ink.style.left = on.offsetLeft + "px";
    ink.style.width = on.offsetWidth + "px";
    nav.classList.add("ink-ready");
}

function renderAllDesign(payload) {
    lastData = prepareData(payload.fc, payload.ens);
    previewIdx = null;
    renderHero(payload.fc);
    renderWarnings(payload.warn, payload.nina);
    dHourly(payload.fc, payload.ens);
    dActivity();
    dNowcast(payload.fc);
    renderDays(payload.fc);
    renderDetails(payload.fc, payload.air);
    dModels(payload.md, payload.fc, payload.ens);
    startCounters(D("details"));
    startCounters(D("models"));
    moveTabInk();
}

/* ------------------------------------------------------------------ *
 * App-Steuerung: Standort, Suche, Tabs
 * ------------------------------------------------------------------ */

function initDesignApp() {
    let currentLoc = null;
    let loading = false;
    let pending = false;   /* Ortswechsel während eines laufenden Ladens: danach erneut laden */

    function setLocLabel(loc) {
        D("locName").textContent = (loc.source === "search" ? "🔍 " : "") + loc.name;
        D("gps").classList.toggle("hidden", loc.source !== "search");
    }

    function setUpdatedLabel(iso) {
        const dt = new Date(iso);
        D("updated").textContent = "Stand " + dt.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + " Uhr";
    }

    async function load() {
        if (!currentLoc) return;
        if (loading) { pending = true; return; }
        loading = true;
        pending = false;
        const loc = currentLoc;
        D("refresh").classList.add("spin");
        D("banner").classList.add("hidden");
        setLocLabel(loc);

        const results = await Promise.allSettled([
            fetchForecast(loc), fetchEnsemble(loc), fetchModels(loc), fetchAir(loc), fetchWarnings(loc), fetchNina(loc)
        ]);
        /* Inzwischen ein anderer Ort (z. B. GPS nach gespeicherter Position)? Dann diese Antwort verwerfen. */
        if (currentLoc !== loc) { loading = false; return load(); }
        const val = function (i) { return results[i].status === "fulfilled" ? results[i].value : null; };
        const fc = val(0);

        if (fc) {
            const payload = { fc: fc, ens: val(1), md: val(2), air: val(3), warn: val(4), nina: val(5) };
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
                clearRendered();
                showBanner("Die Wetterdaten konnten nicht geladen werden (" +
                    (results[0].reason && results[0].reason.message ? results[0].reason.message : "Netzwerkfehler") + ").", true, "Erneut versuchen", load);
            }
        }
        D("refresh").classList.remove("spin");
        loading = false;
        if (pending) load();
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
                moveTabInk();
            });
        }, { rootMargin: "-40% 0px -50% 0px" });
        links.forEach(function (l) {
            const sec = D(l.getAttribute("data-target"));
            if (sec) io.observe(sec);
            /* Beim Antippen sofort markieren, die Pille gleitet dann vor dem Scrollen los */
            l.addEventListener("click", function () {
                links.forEach(function (x) { x.classList.toggle("on", x === l); });
                moveTabInk();
            });
        });
        if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", moveTabInk);
        moveTabInk();
    }

    /* ---- Design-Umschalter: modern.css (Bento) oder design.css (klassisch), Wahl bleibt gespeichert ---- */

    function applyDesign(name) {
        const modern = name !== "classic";
        const swap = function () {
            const m = D("cssModern"), c = D("cssClassic");
            if (m) m.disabled = !modern;
            if (c) c.disabled = modern;
            if (document.documentElement && document.documentElement.setAttribute) {
                document.documentElement.setAttribute("data-design", modern ? "modern" : "classic");
            }
            const meta = document.querySelector ? document.querySelector('meta[name="theme-color"]') : null;
            if (meta) meta.setAttribute("content", modern ? "#ECEAF4" : "#2a558c");
            try { localStorage.setItem("wetter:design", modern ? "modern" : "classic"); } catch (e) {}
            moveTabInk();
        };
        /* Kurz in die Grundfarbe des Zieldesigns überblenden statt hart umzuschalten */
        const veil = D("designVeil");
        const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!veil || !veil.classList || reduce || typeof requestAnimationFrame !== "function") { swap(); return; }
        veil.style.background = modern ? "#ECEAF4" : "#2a558c";
        veil.classList.add("on");
        setTimeout(function () {
            swap();
            requestAnimationFrame(function () { requestAnimationFrame(function () { veil.classList.remove("on"); }); });
        }, 520);
    }

    function initDesignToggle() {
        let current = "modern";
        try { current = localStorage.getItem("wetter:design") === "classic" ? "classic" : "modern"; } catch (e) {}
        function toggle() {
            current = current === "classic" ? "modern" : "classic";
            applyDesign(current);
        }
        ["designBtn", "designLink"].forEach(function (id) {
            const b = D(id);
            if (b) b.addEventListener("click", toggle);
        });
    }

    /* ---- Antippen: Animationen der Kachel neu starten ---- */

    function initReplay() {
        if (!document.body || !document.body.addEventListener) return;
        document.body.addEventListener("click", function (ev) {
            const t = ev.target;
            if (!t || !t.closest) return;
            if (scrub.endedAt && Date.now() - scrub.endedAt < 300) return;   /* Klick nach Maus-Ziehen */
            /* Zeitreise: Jetzt-Knopf im Hero, Spalte mit Stundenindex, Spalte „Jetzt" */
            if (t.closest("#heroNow")) { clearHour(); return; }
            const col = t.closest(".hcol, .act-track i");
            if (col) {
                const i = col.getAttribute("data-i");
                if (i === null) clearHour(); else selectHour(parseInt(i, 10));
                return;
            }
            const chip = t.closest(".mchip");
            if (chip && chip.getAttribute("data-model")) { highlightModel(chip.getAttribute("data-model")); return; }
            if (t.closest("a, button, input")) return;
            const box = t.closest(".tile, .field");
            if (!box) return;
            restartAnimations(box);
            if (box.id === "hero" && lastTemp !== null) countUp(box.querySelector(".temp"), lastTemp);
            else startCounters(box);
        });
    }

    /* Rausgehen: Chips wechseln die Aktivität, ein Fenster springt per Zeitreise auf seine Startstunde */
    function initActivity() {
        const box = D("activity");
        if (!box || !box.addEventListener) return;
        box.addEventListener("click", function (ev) {
            const t = ev.target;
            if (!t || !t.closest) return;
            const chip = t.closest(".act-chip");
            if (chip) { setActivity(chip.getAttribute("data-act")); return; }
            const win = t.closest(".act-win");
            if (!win) return;
            const gi = parseInt(win.getAttribute("data-i"), 10);
            selectHour(gi);
            /* Hero und Leiste gemeinsam ins Bild holen, dann die Spalte in die Leistenmitte */
            if (typeof window !== "undefined" && typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "smooth" });
            const hourly = D("hourly");
            const col = hourly && hourly.querySelector ? hourly.querySelector('.hcol[data-i="' + gi + '"]') : null;
            if (col && col.scrollIntoView) col.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
        });
    }

    /* Zeitreise Stufe 2: Ziehen vom Griff. Delegation am Container, die Leiste entsteht bei jedem Rendern neu. */
    function initScrub() {
        const box = D("hourly");
        if (!box || !box.addEventListener) return;
        const colOf = function (t) { return t && t.closest ? t.closest(".hcol") : null; };
        box.addEventListener("touchstart", function (ev) {
            const t = ev.touches && ev.touches[0];
            if (t) scrubStart(t.clientX, t.clientY, colOf(ev.target));
        }, { passive: true });
        box.addEventListener("touchmove", function (ev) {
            const t = ev.touches && ev.touches[0];
            if (!t) return;
            if (scrubMove(t.clientX, t.clientY) === "scrub") ev.preventDefault();
        }, { passive: false });
        box.addEventListener("touchend", scrubEnd);
        box.addEventListener("touchcancel", scrubEnd);
        box.addEventListener("mousedown", function (ev) {
            if (scrubStart(ev.clientX, ev.clientY, colOf(ev.target))) ev.preventDefault();
        });
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("mousemove", function (ev) { scrubMove(ev.clientX, ev.clientY); });
            window.addEventListener("mouseup", scrubEnd);
        }
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
    initDesignToggle();
    initReplay();
    loadActivity();
    initActivity();
    initScrub();

    const cached = window.PREVIEW_LOC || loadPos();
    if (cached) {
        currentLoc = { id: locId(cached.lat, cached.lon), name: cached.name || "Dein Standort", lat: cached.lat, lon: cached.lon, source: "gps" };
        load();
    }
    locate();
}

if (typeof window !== "undefined") window.initDesignApp = initDesignApp;
