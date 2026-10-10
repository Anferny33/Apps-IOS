/* Startseite der Wetter-App.
 * Nutzt die Datenschicht aus wetter-core.js (fetch*, Helfer, Cache, Ensemble)
 * und rendert das Markup aus index.html. Das Aussehen liefern modern.css (Bento,
 * Standard); der Tag/Nacht-Schalter oben rechts
 * wechselt zwischen beiden. Die Einblend-Animationen steuert das Stylesheet,
 * hier werden nur Klassen und Verzögerungen gesetzt.
 */
"use strict";

const D = function (id) { return document.getElementById(id); };
function setText(id, text) { const el = D(id); if (el) el.textContent = text; }

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

/* Großes Hero-Icon aus Ebenen (Sterne, Sonne, Mond, Wolken, Regen, Schnee, Blitz, Nebel).
   Welche Ebenen sichtbar sind und wie sie beim Öffnen hereinfahren, regelt das
   Stylesheet über die Klasse wx-<lage>; Farben kommen ebenfalls aus dem Stylesheet. */
function heroKind(code, isDay) {
    const day = isDay !== 0;
    if (code === 0 || code === 1) return day ? "sonnig" : "nacht";
    if (code === 2) return day ? "teils" : "teilsnacht";
    if (code === 3) return "bewoelkt";
    if (code === 45 || code === 48) return "nebel";
    if (code >= 71 && code <= 77 || code === 85 || code === 86) return "schnee";
    if (code >= 95) return "gewitter";
    if (code >= 51 && code <= 82) return "regen";
    return day ? "teils" : "teilsnacht";
}

function heroIcon(code, isDay) {
    const kind = heroKind(code, isDay);
    /* Nebellinien unter der Wolke gibt es nur in der Lage nebel (Klasse fog für das Stylesheet) */
    const fog = kind === "nebel" ? '<g class="fog"><line x1="30" y1="86" x2="78" y2="86"/><line x1="22" y1="91" x2="66" y2="91"/><line x1="36" y1="96" x2="84" y2="96"/></g>' : '';
    return '<svg class="big-icon wx wx-' + kind + '" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<g class="stars"><circle cx="16" cy="18" r="2"/><circle cx="80" cy="14" r="1.6"/><circle cx="86" cy="42" r="2.2"/><circle cx="12" cy="50" r="1.6"/></g>' +
        '<g class="sun"><g class="rays"><path d="M34 10v7M34 55v7M8 36h7M53 36h7M15.6 17.6l5 5M47.4 49.4l5 5M15.6 54.4l5-5M47.4 22.6l5-5"/></g><circle cx="34" cy="36" r="13"/></g>' +
        '<g class="moon"><path d="M52 18a24 24 0 1 0 22 36a19 19 0 0 1-22-36z"/></g>' +
        '<g class="cloud2"><path d="M14 88h18a7 7 0 0 0 .5-14A10 10 0 0 0 13 70a6.5 6.5 0 0 0 1 18z"/></g>' +
        '<g class="cloud"><path d="M41 82h31a13.5 13.5 0 0 0 1-27A19.5 19.5 0 0 0 38 57a12.75 12.75 0 0 0 3 25z"/></g>' +
        '<g class="drops"><line x1="50" y1="86" x2="48" y2="92"/><line x1="61" y1="86" x2="59" y2="92"/><line x1="72" y1="86" x2="70" y2="92"/></g>' +
        '<g class="flakes"><circle cx="50" cy="88" r="2.6"/><circle cx="61" cy="88" r="2.6"/><circle cx="72" cy="88" r="2.6"/></g>' +
        '<g class="bolt"><path d="M62 70l-8 13h6l-3 11 10-15h-6l3-9z"/></g>' +
        fog +
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
/* Startchoreografie: die geplanten Verzögerungen laufen gestaucht (INTRO_SCALE), das letzte Feld ist nach gut einer Sekunde da */
const INTRO_SCALE = 0.6;
function dl(seconds) { return Math.max(0, seconds * INTRO_SCALE - introElapsed()).toFixed(2); }

/* Einmal-Animationen eines Feldes neu starten (beim Aufklappen eines Instrument-Felds).
   Dauerläufer wie Windlinien,
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
let previewTime = null;        /* Zeitstempel der gewählten Stunde (Ortszeit), überlebt ein Neurendern am selben Ort */
let heroVisible = true;        /* Hero im Bild? Sonst zeigt die feste Vorschauleiste den Zeitbezug */

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

function nextDay(dateStr) { return shiftDay(dateStr, 1); }
function prevDay(dateStr) { return shiftDay(dateStr, -1); }
function shiftDay(dateStr, days) {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* Temperatur gestern zur selben Uhrzeit aus dem abgetrennten Vortag (Modelllauf, keine Messung),
   linear zwischen den beiden Nachbarstunden; die Stunde nach 23 Uhr ist 0 Uhr heute.
   Ohne Vortag oder ohne die Stunde (Lücke, Zeitumstellung) null. */
function yesterdayTemp(fc) {
    const p = fc.past && fc.past.hourly, c = fc.current;
    if (!p || !Array.isArray(p.time) || !Array.isArray(p.temperature_2m) || !c || typeof c.time !== "string") return null;
    const key = prevDay(dayOf(c.time)) + "T" + c.time.slice(11, 13) + ":00";
    const i = p.time.indexOf(key);
    if (i < 0 || !isNum(p.temperature_2m[i])) return null;
    const a = p.temperature_2m[i];
    const next = i + 1 < p.time.length ? p.temperature_2m[i + 1]
        : (fc.hourly && fc.hourly.temperature_2m ? fc.hourly.temperature_2m[0] : null);
    if (!isNum(next)) return a;
    return a + (next - a) * parseInt(c.time.slice(14, 16), 10) / 60;
}

/* „2° wärmer als gestern“, „3° kälter als gestern“, „Wie gestern“; null ohne Vergleichswert */
function yesterdayText(fc) {
    const y = yesterdayTemp(fc);
    if (y === null || !isNum(fc.current.temperature_2m)) return null;
    const d = parseInt(tdiff(fc.current.temperature_2m - y), 10);
    if (d === 0) return "Wie gestern";
    return Math.abs(d) + "° " + (d > 0 ? "wärmer" : "kälter") + " als gestern";
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

/* Satz je Stundenspalte für Vorleser: „Jetzt“ aus den aktuellen Werten, sonst aus den Stundenwerten */
function hourAlt(data, gi, nowIdx) {
    const fc = data.fc;
    const f = gi === null
        ? Object.assign(nowFacts(fc), { label: "Jetzt", prob: hourProb(data, nowIdx), wind: fc.current.wind_speed_10m })
        : hourFacts(data, gi);
    if (!f) return "";
    const parts = [f.desc];
    if (isNum(f.temp)) parts.push(tmp(f.temp) + " Grad");
    if (isNum(f.apparent)) parts.push("gefühlt " + tmp(f.apparent));
    if (isNum(f.prob)) parts.push("Regenrisiko " + Math.round(f.prob) + " %");
    if (isNum(f.wind)) parts.push("Wind " + wnd(f.wind) + " " + wunit());
    return f.label + ": " + parts.join(", ");
}

/* Pfeiltasten im Stundenstreifen: Zielindex, null für andere Tasten */
function hourKeyIndex(key, cur, n) {
    if (key === "Home") return 0;
    if (key === "End") return n - 1;
    if (key === "ArrowRight") return Math.min(n - 1, cur + 1);
    if (key === "ArrowLeft") return Math.max(0, cur - 1);
    return null;
}

/* Tastatur im Streifen: Pfeile wandern durch die Spalten und wählen die Stunde, Pos1 geht auf „Jetzt“ */
function initHourKeys() {
    const box = D("hourly");
    if (!box || !box.addEventListener) return;
    box.addEventListener("keydown", function (ev) {
        const cols = box.querySelectorAll ? Array.prototype.slice.call(box.querySelectorAll(".hcol")) : [];
        const curEl = ev.target && ev.target.closest ? ev.target.closest(".hcol") : null;
        const cur = cols.indexOf(curEl);
        if (cur < 0) return;
        const next = hourKeyIndex(ev.key, cur, cols.length);
        if (next === null) return;
        if (ev.preventDefault) ev.preventDefault();
        const col = cols[next];
        const i = col.getAttribute("data-i");
        if (i === null) clearHour(); else selectHour(parseInt(i, 10));
        cols.forEach(function (c) { c.setAttribute("tabindex", c === col ? "0" : "-1"); });
        if (col.focus) col.focus();
    });
}

/* Ansage für Vorleser (Live-Region in index.html) */
function announce(text) {
    const el = D("live");
    if (el) el.textContent = text;
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
function glideTo(el, target, suffix, decimals) {
    if (!el || !isNum(target)) return;
    suffix = suffix || "";
    const node = firstTextNode(el);
    const fmt = function (v) { return (decimals ? fmtNum(v, decimals) : String(Math.round(v))) + suffix; };
    const set = function (v) { if (node) node.nodeValue = fmt(v); else el.textContent = fmt(v); };
    const from = node ? parseFloat(String(node.nodeValue).replace(",", ".")) : NaN;
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

/* Zähler merken sich ihren zuletzt gezeigten Wert: beim ersten Rendern zählen sie hoch (Erstanimation),
   bei unverändertem Wert bleiben sie stehen, bei geändertem Wert gleiten sie vom alten zum neuen. */
let lastCounts = {};

function countMode(key, target) {
    const prev = lastCounts[key];
    lastCounts[key] = target;
    lastCountsPrev = isNum(prev) ? prev : null;
    if (!isNum(prev)) return "first";
    return prev === target ? "same" : "glide";
}

function counterKey(root, el, idx) {
    const holder = el.closest ? el.closest(".tile, .mchip") : null;
    const label = holder && holder.querySelector ? (holder.querySelector("h3, .k") || {}).textContent : "";
    return (root.id || "") + ":" + String(label || "").trim() + ":" + idx;
}

function startCounters(root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.slice.call(root.querySelectorAll("[data-count]")).forEach(function (el, idx) {
        const holder = el.closest ? el.closest(".tile, .mchip") : null;
        const base = holder && holder.style && holder.style.animationDelay ? parseFloat(holder.style.animationDelay) * 1000 : 0;
        const target = parseFloat(el.getAttribute("data-count"));
        const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
        const mode = countMode(counterKey(root, el, idx), target);
        if (mode === "same") return;
        if (mode === "glide") {
            /* Vom bisherigen Wert aus starten: der neue steht nach dem Rendern schon im Text */
            const node = firstTextNode(el);
            const prev = lastCountsPrev;
            if (node && isNum(prev)) node.nodeValue = (decimals ? fmtNum(prev, decimals) : String(Math.round(prev)));
            glideTo(el, target, "", decimals);
            return;
        }
        countUpEl(el, target, { decimals: decimals, delay: (isNaN(base) ? 0 : base) + 350, dur: 1800 });
    });
}
let lastCountsPrev = null;

/* Nur die Icons, die das Markup auch nutzt (Hinweis-Feld, Warnungen) */
const UI = {
    umbrella: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v7a2 2 0 0 0 4 0"/></svg>',
    /* Schirm, der sich aufspannt, danach fällt leichter Regen darauf (Bewegung im Stylesheet) */
    umbrellaRain: '<svg class="umb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">' +
        '<g class="umb-drops"><line x1="6" y1="-3" x2="5.6" y2="-0.5"/><line x1="12" y1="-5" x2="11.6" y2="-2.5"/><line x1="18" y1="-3" x2="17.6" y2="-0.5"/></g>' +
        '<path class="umb-shaft" d="M12 12v7a2 2 0 0 0 4 0"/>' +
        '<path class="umb-canopy" d="M3 12a9 9 0 0 1 18 0z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>',
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
    const raw = m.precipitation.slice(start, start + 16);
    /* Fehlende Werte dürfen nicht als „kein Regen“ gelten: unter 12 gültigen Intervallen keine Aussage */
    if (raw.filter(isNum).length < 12) return { text: "Kurzfristprognose nicht verfügbar", wet: false, unknown: true, vals: [], times: [] };
    const vals = raw.map(function (v) { return isNum(v) ? v : 0; });
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
        hi: d && isNum(d.temperature_2m_max[0]) ? d.temperature_2m_max[0] : null,
        lo: d && isNum(d.temperature_2m_min[0]) ? d.temperature_2m_min[0] : null,
        yday: yesterdayText(fc)
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
        /* Fehlende Werte bleiben weg; tmp(null) ergäbe sonst „0°“ */
        if (isNum(f.hi)) out += chip("Hoch " + tmp(f.hi) + "°", 0.5);
        if (isNum(f.lo)) out += chip("Tief " + tmp(f.lo) + "°", 0.58);
        if (isNum(f.apparent)) out += chip("Gefühlt " + tmp(f.apparent) + "°", 0.66);
        if (f.yday) out += chip(f.yday, 0.74);
    } else {
        if (isNum(f.apparent)) out += chip("Gefühlt " + tmp(f.apparent) + "°", 0);
        if (isNum(f.prob)) out += chip("Regen " + Math.round(f.prob) + " %", 0);
        if (isNum(f.wind)) out += chip("Wind " + wnd(f.wind) + " " + wunit(), 0);
    }
    return out;
}

function heroHtml(f, intro) {
    const metaOpen = intro ? '<div class="meta a-up" style="animation-delay:' + dl(0.4) + 's">' : '<div class="meta">';
    const tempCls = intro ? 'temp fade-in' : 'temp';
    return metaOpen + heroMetaHtml(f) + '</div>' +
        '<div class="main"><div class="' + tempCls + '">' + (isNum(f.temp) ? tmp(f.temp) + '°' : '–°') + '</div>' + heroIcon(f.code, f.isDay) + '</div>' +
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
    lastTemp = isNum(f.temp) ? parseInt(tmp(f.temp), 10) : null;
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
    Array.prototype.slice.call(box.querySelectorAll(".hcol.sel")).forEach(function (el) { el.classList.remove("sel"); if (el.setAttribute) el.setAttribute("aria-pressed", "false"); });
    const col = gi !== null && box.querySelector ? box.querySelector('.hcol[data-i="' + gi + '"]') : null;
    if (col && col.classList) { col.classList.add("sel"); if (col.setAttribute) col.setAttribute("aria-pressed", "true"); }
    /* Tastatur: genau eine Spalte liegt im Tab-Weg, die gewählte oder „Jetzt“ */
    Array.prototype.slice.call(box.querySelectorAll(".hcol")).forEach(function (c) {
        if (!c.setAttribute || !c.getAttribute) return;
        const mine = gi === null ? c.getAttribute("data-i") === null : c.getAttribute("data-i") === String(gi);
        c.setAttribute("tabindex", mine ? "0" : "-1");
    });
}

function selectHour(gi, quiet) {
    const f = hourFacts(lastData, gi);
    if (!f || gi === previewIdx) return;
    previewIdx = gi;
    previewTime = lastData.fc.hourly.time[gi];
    markHour(gi);
    updateHero(f, quiet);
    updatePreviewBar();
    announce("Vorschau " + f.label + ".");
}

function clearHour(quiet) {
    if (previewIdx === null || !lastData) return;
    previewIdx = null;
    previewTime = null;
    markHour(null);
    updateHero(nowFacts(lastData.fc), quiet);
    updatePreviewBar();
    announce("Zurück zum aktuellen Wetter.");
}

/* Feste Vorschauleiste: sichtbar, solange eine Stunde gewählt ist und der Hero nicht im Bild ist */
function updatePreviewBar() {
    const bar = D("previewBar");
    if (!bar || !bar.classList) return;
    const active = previewIdx !== null && lastData;
    if (active) {
        const f = hourFacts(lastData, previewIdx);
        setText("previewLabel", "Vorschau · " + (f ? f.label : ""));
    }
    bar.classList.toggle("hidden", !(active && !heroVisible));
}

/* Zurück zu Jetzt: Hero, Ring und Leiste wieder auf den aktuellen Zeitpunkt */
function backToNow() {
    clearHour();
    const strip = D("hourly") && D("hourly").querySelector ? D("hourly").querySelector(".strip") : null;
    if (strip && strip.scrollTo) strip.scrollTo({ left: 0, behavior: "smooth" });
}

/* ---- Rausgehen: Aktivitätsfenster ---- */

const ACTIVITIES = [
    { id: "walk", name: "Spaziergang",    short: "Spaziergang", minH: 1, feel: [5, 28],  prob: 30, gust: 45,           light: "dusk" },
    { id: "bike", name: "Radfahren",      short: "Radfahren",   minH: 2, feel: [8, 30],  prob: 20, wind: 25, gust: 40, light: "day" },
    { id: "run",  name: "Joggen",         short: "Joggen",      minH: 1, feel: [2, 24],  prob: 40, gust: 50,           light: "any" },
    { id: "sit",  name: "Draußen sitzen", short: "Sitzen",      minH: 2, feel: [17, 99], prob: 20, wind: 15, gust: 30, light: "any" }
];
/* Piktogramme vom User (Silhouetten, aus den Vorlagen nachgezeichnet): Spaziergang, Radfahren, Joggen, Bank mit Sonne */
const ACT_ICONS = {
    walk: '<svg class="act-ico" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M29 93.6C24.1 90.6 23.9 90.4 23.9 88.9C23.9 87.9 24.5 86.9 29.9 78.5C37 67.7 36.7 68.3 39.2 61.7C40.3 58.9 41.3 56.6 41.5 56.6C41.6 56.6 43 58.7 44.7 61.1L47.7 65.6L47.4 66.6C45.8 71.2 42.9 75.8 37.4 82.8C32.9 88.6 33.1 87.9 35 89.8C38.5 93.5 38.3 96 34.5 96C32.9 96 32.7 95.9 29 93.6ZM62.8 95C61.9 94.5 61.8 94.3 58.1 83.6C54.6 73 54.8 73.6 48.1 63.9C45.4 60.2 42.9 56.4 42.4 55.5C41.2 53.4 41.1 51.7 41.7 44.1C42.3 35.9 42.4 36.4 40.6 38.5C39.3 40 38.6 41.4 35.7 47.6C31.9 55.9 31.5 56.4 29.4 56.4C27.5 56.4 26.4 55.4 26.2 53.6C26 52.5 26.3 51.8 29.5 44.9L33 37.3L37.3 32C39.8 29.1 42.2 26 42.9 25.2C44.9 22.5 46.7 21.4 49.2 21.7C52.7 22 54.7 24.2 55.4 28.1C56 31.4 61.2 41.7 62.9 43C63.4 43.4 65.9 44.9 68.5 46.4C73.7 49.4 74.2 49.9 74.2 51.7C74.2 52.7 74.1 53.1 73.3 53.8C71.7 55.4 70.8 55.2 66.5 52.6C58.5 47.7 57.1 46.6 56 44.4C55.8 43.9 55.5 43.4 55.4 43.4C55.3 43.4 55.1 45.5 55 48L54.8 52.5L58.8 61.2C62.5 69.3 64.1 73.1 67.8 83.2L69.3 87.1L72 87.2C75.2 87.3 76.1 87.9 76.1 89.5C76.1 91 75.2 91.6 70 93.6C65.2 95.5 64.1 95.7 62.8 95ZM49.3 19.9C45.2 19.3 42.5 15.8 42.7 11.6C43 7.1 46.1 4.1 50.6 4.1C59.2 4 61.7 15.8 53.9 19.2C52.2 20 51 20.2 49.3 19.9Z"/></svg>',
    bike: '<svg class="act-ico" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M19.9 91.1C11.6 89.5 5.6 81.9 6.2 73.8C7 61.9 19.7 54.3 30.3 59.3L32.1 60.2L33.8 57.9C36.6 54.1 36.4 54.6 35.8 52.9L35.3 51.4L32.5 51.4L29.7 51.4L29 50.7C28.2 49.7 28.2 48.8 29.1 47.9C29.8 47.2 29.9 47.2 32.7 47.2L35.6 47.2L38.4 48.6C40 49.3 41.1 50.1 41.1 50.3C41.1 50.8 40.1 51.4 39.2 51.4C38.4 51.4 38.4 51.4 38.7 52.2C38.8 52.6 39 53 39.1 53.1C39.3 53.1 41.4 53.3 43.8 53.3C48.5 53.5 49.9 53.8 49.5 54.6C49.5 54.8 49.3 55.3 49.2 55.6L49.1 56.2L44.7 56.2C42.3 56.2 40.4 56.3 40.4 56.4C40.4 56.5 41.4 59.2 42.7 62.3C45 68.3 45 68.3 44.4 70.5C44.1 71.6 44.1 71.8 44.5 72.6C45.1 73.9 46.1 74.2 49.3 74.2C52.2 74.2 52.1 74.1 51.9 76C51.6 79.7 46.5 81 44 78.1C43.6 77.6 43.2 77.4 41.9 77.3L40.3 77.2L39.7 79.3C38.3 84.5 34.2 88.6 28.7 90.4C27.1 91 26.2 91.1 23.6 91.1C21.9 91.2 20.2 91.2 19.9 91.1ZM72.2 90.7C69.3 90 67.1 88.7 64.8 86.4C59.6 81.2 58.4 74 61.7 67.2C62.7 65.1 65.4 62 67.5 60.6L68.2 60.1L67.7 58.6L67.1 57.1L61.3 63C55 69.2 55.1 69.2 53.3 68.5C52.8 68.3 52.7 68.1 52.9 67.7C53 67.5 55.6 64.8 58.6 61.7L64 56.2L61.1 56.2L58.2 56.2L58.7 55C59 54.3 59.3 53.7 59.4 53.6C59.5 53.5 60.8 53.4 62.3 53.3C63.7 53.3 65 53.2 65.1 53.1C65.1 53.1 64.8 51.8 64.3 50.3C63.6 48.1 63.5 47.6 63.7 47.1C64.2 46.2 64.3 46.2 68.9 46.2C71.6 46.2 73.2 46.1 73.2 45.9C73.2 45.8 73 45.7 72.7 45.7C72.2 45.7 63.2 42.6 61.3 41.8C60.5 41.4 59.7 40.8 59.1 40.1C54.2 34.1 53.1 32.9 53 32.9C52.9 33 51.1 34.8 48.9 37L45.1 40.9L46.9 42.1C55.7 47.6 57.7 49 58.2 49.9C59.3 51.6 59.1 52.3 55.2 60.9C53.3 65.2 51.8 68.8 51.9 68.8C52 68.9 53 69.2 54.2 69.6C55.4 69.9 56.5 70.4 56.7 70.7C57.3 71.3 57.3 72.4 56.7 73C56.2 73.4 55.8 73.5 51.4 73.5C46.3 73.5 45.6 73.3 45.1 72.2C44.9 71.5 45.1 70.6 47.7 62.8C49.3 58 50.5 54 50.5 53.9C50.4 53.8 47 52 42.8 49.9C38.7 47.8 34.9 45.9 34.6 45.6C32.7 44.3 31.9 40.6 33.1 38.1C33.5 37.3 35.6 35 40.6 30.1C47.3 23.4 47.6 23.2 49 22.7C51.6 22 53.7 22.6 55.6 24.7C56.1 25.3 58.3 28.3 60.4 31.3L64.3 36.8L69.6 39.5C72.6 41 75.3 42.2 75.7 42.2C77.8 42.2 78 45.7 76 47.7C74.8 48.9 73.7 49.2 70 49.2L67 49.2L67.5 50.6C67.8 51.4 68.6 53.5 69.3 55.3C70.8 59 70.5 58.8 73.7 58.1C79.7 56.7 86.6 59.3 90.4 64.3C96 71.7 95 81.9 88 87.4C83.7 90.8 77.5 92.1 72.2 90.7ZM25.2 88C30 87.3 34 84.5 35.9 80.4C36.8 78.5 37.1 77 36.6 77C36.4 77 34.1 76.8 31.4 76.5L26.5 76L25.6 77C23.4 79.4 19.9 78 19.9 74.7C19.9 73.1 20.9 71.8 22.5 71.4C23.5 71.2 23.8 70.9 26 68C27.4 66.3 28.8 64.4 29.3 63.8L30.2 62.7L29.1 62.2C24.2 59.7 17.7 60.9 13.4 65.1C4 74.4 12 89.9 25.2 88ZM80.5 87.7C85.5 86.5 89.5 82.4 90.6 77.4C91.1 75.2 91.1 74.3 90.6 72.1C89.5 66.7 85.6 62.6 80.2 61.3C77.5 60.6 72.2 61.1 72.2 62C72.2 62.2 73.3 64.4 74.5 66.8C76.7 71.1 76.9 71.3 77.6 71.5C80 71.9 81.2 74.5 80 76.4C78.1 79.5 73.7 78.3 73.7 74.7C73.7 74.1 73.9 73.3 74.1 73.1C74.4 72.6 74.2 72.2 72 68C70.7 65.4 69.5 63.3 69.5 63.3C69.1 63.1 66.9 65 66 66.3C64 68.9 63.2 71.3 63.2 74.6C63.2 78.4 64.2 81.1 66.5 83.6C70 87.5 75 89 80.5 87.7ZM43.4 73.8C43.7 72.9 43.6 72.6 42 68.6C41.1 66.2 39.8 62.8 39.1 61C38.4 59.2 37.7 57.7 37.6 57.7C37.5 57.7 36.8 58.6 35.9 59.7L34.3 61.7L35.7 63.3C38 65.7 40.1 70.6 40.1 73.1C40.1 74.2 40.7 74.7 42 74.7C43 74.7 43.1 74.7 43.4 73.8ZM37.1 73.6C37.1 71.5 35.2 67.1 33.5 65.5C32.5 64.5 32.3 64.4 32.1 64.8C25.9 72.7 26 72.5 26.3 73.1C26.5 73.6 26.8 73.7 28.2 73.8C30.3 74 32 74.1 34.8 74.2C37.1 74.2 37.1 74.2 37.1 73.6ZM58.3 23.9C50.8 22.9 49.1 12.6 55.7 9C57.5 8 61.1 7.9 63 8.8C65.7 10.2 67.2 12.4 67.4 15.5C67.7 20.8 63.6 24.5 58.3 23.9Z"/></svg>',
    run: '<svg class="act-ico" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M70.8 95.2C69.5 94.4 69.2 93.7 66.1 82.4C63.6 73.3 63.2 71.9 62.5 71.2C61.5 70.1 57.8 67.7 51.1 63.7C43.8 59.5 42.7 58.5 41.4 55.9C40.1 52.9 40.1 52.7 47 36.8C47.9 34.7 48.6 32.9 48.6 32.8C48.5 32.8 46.4 33.2 44 33.7L39.5 34.7L36.9 39.2C32.2 47.4 32.3 47.2 30 47.2C27.9 47.2 26.3 45.2 26.8 43.3C27 42.1 33.8 30.6 34.7 29.5C35.6 28.6 36.1 28.4 45.6 25.7C52.4 23.7 54.9 23.7 58.5 25.5C61 26.7 62 28 65.5 34.3C69.2 41.2 69.6 41.9 69.9 41.9C70.2 41.9 75.8 38.5 79.6 36C80.9 35.1 81.5 34.9 82.5 34.9C85.7 34.9 87.7 38 86.3 40.9C85.7 42.2 85.3 42.4 77.2 46.7C72 49.5 71.2 49.8 69.7 49.9C66.3 50.1 65.3 49.3 62.2 44.1C60.9 42 59.8 40.3 59.7 40.4C59.7 40.4 59.2 41.7 58.7 43.1C58.3 44.6 57.1 47.4 56.1 49.5C55.1 51.5 54.3 53.4 54.2 53.8C54.1 54.3 54.5 54.7 58.2 57C64.7 61.2 68.7 64.1 69.8 65.5C70.6 66.6 71.1 68.1 73.4 76.6C74.9 82 76.2 86.4 76.2 86.5C76.2 86.5 78 86.9 80.1 87.3C85 88.4 85.5 88.7 85.5 90.4C85.5 91.9 84.6 92.4 79.2 94.1C73.6 95.8 72.2 96 70.8 95.2ZM13.3 79.1C12.3 78 12.4 76.7 13.9 72.1C16.2 65.4 16 65.5 27.3 66.9C30.9 67.4 33.9 67.7 34 67.6C34 67.6 35.4 64.9 37 61.7L39.9 55.8L41.1 57.7C42.2 59.3 43.8 60.8 46.2 62.3L46.9 62.8L44.8 66.9C41.3 74 39.9 75.7 37.3 76C36.4 76.1 23.7 74 21.7 73.5C21.4 73.4 20.7 74.1 19.3 76C18.3 77.5 17.1 79 16.7 79.3C15.7 80.1 14.1 80 13.3 79.1ZM61 24.1C55.4 22.3 52.8 16.2 55.4 10.9C58.3 5.2 65.7 4 70.2 8.5C72.3 10.6 73 12.4 72.8 15.5C72.7 18.3 71.9 19.9 69.9 21.8C68 23.6 66.5 24.2 63.9 24.3C62.7 24.3 61.4 24.3 61 24.1Z"/></svg>',
    sit: '<svg class="act-ico" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M30 95.7C29.6 95.5 28.8 94.1 28.8 93.5C28.8 93.2 29.1 92.7 29.5 92.2L30.3 91.3L30.3 82.9C30.3 75.4 30.3 74.4 30.8 73.5C31.8 71.6 34.7 70.9 37.1 72C39.2 73 39.3 73.4 39.3 83.1C39.3 90.4 39.3 91.5 39.7 91.9C40.9 92.8 40.8 95 39.6 95.6C39 95.9 30.7 96 30 95.7ZM44.9 95.2C44 94.4 44 92.7 44.8 92C45.4 91.5 45.4 91.1 45.4 83C45.4 73.9 45.5 73.2 47.1 72.2C48.2 71.4 51.1 71.3 52.3 72C54.3 73.1 54.4 73.5 54.4 83L54.4 91.4L55.1 92.1C56.1 93 56.1 94.3 55.1 95.2C54.4 95.9 54.3 95.9 50 95.9C45.7 95.9 45.5 95.9 44.9 95.2ZM12.6 94.8C11.8 94.2 11.6 93.2 11.6 86L11.6 78.8L10.2 78.8C9 78.8 8.7 78.6 8 77.9C7.1 76.7 7.1 75.5 8 74.5L8.7 73.8L19.1 73.8C28.4 73.8 29.4 73.9 29.3 74.3C29.2 74.5 29.1 75.6 29.1 76.7L29.1 78.7L22.8 78.8L16.4 78.9L16.4 86.4C16.3 95 16.3 95 14.1 95C13.5 95 12.8 94.9 12.6 94.8ZM71.2 94.5C70.8 94.1 70.7 93 70.6 86.4L70.5 78.9L63.1 78.8L55.6 78.7L55.6 76.7C55.6 75.6 55.5 74.5 55.4 74.3C55.2 73.9 56.3 73.8 66.7 73.8L78.3 73.8L79 74.5C80.7 76.2 79.4 78.8 76.8 78.8L75.3 78.8L75.3 86.3C75.3 93.5 75.3 93.9 74.8 94.5C74 95.2 71.9 95.3 71.2 94.5ZM40.4 76C40.3 74.5 40 73.5 39.6 72.8C39.3 72.2 39 71.3 39 70.7C39 69.6 38.3 68.8 35.7 66.8C34.9 66.3 34.3 65.7 34.2 65.5C34.2 65.4 34.4 63.6 34.7 61.5C35.2 58.6 35.2 57.7 35 57.4C34.4 56.9 34.2 57.5 33.5 61.7C32.8 66.1 32.8 66.1 35.2 67.9C37.4 69.5 37.8 70 37.8 70.5C37.8 70.8 37.7 70.9 37 70.7C35.5 70.3 32.7 70.5 31.6 71.1L30.5 71.8L29 69.8C26.6 67 26.6 66.3 28.4 59C29.6 53.9 30.1 52.7 31.6 51.4C33.4 49.8 34.8 49.6 43.3 49.7C51.1 49.8 51.4 49.9 53.3 51.7C54.6 52.8 54.8 53.4 56.1 58.8C58 66.8 58 66.9 55.5 70.1L54.1 71.7L53 71.1C51.9 70.5 49.6 70.3 47.6 70.7C46.5 70.9 46.5 70.9 46.9 70.2C47.1 69.8 47.7 69.1 48.3 68.8C50.2 67.6 51.5 66.2 51.5 65.4C51.5 64 50.4 57.7 50.1 57.4C49.3 56.7 49.2 57.8 49.7 61.6L50.3 65.5L49.5 66.4C49.1 66.8 48.2 67.5 47.6 67.9C46.3 68.7 45.6 69.8 45.6 71C45.5 71.5 45.3 72.4 45 72.9C44.6 73.6 44.4 74.8 44.3 76.1L44.1 78.2L42.3 78.2L40.5 78.2L40.4 76ZM9.6 68.4C8.7 67.2 8.8 64.7 9.7 63.8L10.5 63L18.3 63L26.2 63L26 64.9C25.9 66.2 25.9 67 26.3 67.8C26.6 68.4 26.8 69 26.8 69C26.8 69.1 23 69.2 18.5 69.2L10.2 69.2L9.6 68.4ZM58.1 68.2C58.5 67.5 58.6 66.6 58.6 65.2L58.5 63L67.5 63L76.5 63L77.2 63.8C78.3 64.8 78.3 67.6 77.3 68.5C76.6 69.1 76.5 69.2 67.1 69.2L57.6 69.2L58.1 68.2ZM10.3 60.9C9.2 60.4 8.8 59.2 9.1 57.1C9.4 54.9 9.3 54.9 19.4 54.9L28.2 54.9L28 55.7C27.4 58.5 26.8 60.8 26.6 61C26.3 61.5 11.4 61.4 10.3 60.9ZM57.8 61C57.5 60.1 56.4 55.5 56.4 55.2C56.4 55 59.7 54.9 66.5 54.9L76.5 54.9L77.2 55.6C78.2 56.6 78.3 59.4 77.4 60.5L76.9 61.2L67.4 61.2C59.8 61.3 57.9 61.3 57.8 61ZM38.8 47.9C31 44 33.7 32.4 42.3 32.4C45.8 32.4 48.2 33.9 49.7 36.9C51.4 40.2 50.8 43.7 48.2 46.3C45.5 49 42 49.5 38.8 47.9ZM75.1 38.4C74.1 38.1 73.9 37.3 73.9 34.8C73.9 32.6 74 32.1 74.5 31.6C75.2 30.9 75.9 30.9 76.7 31.5C77.3 31.9 77.4 32.2 77.4 34.8C77.4 37.5 77.3 37.7 76.7 38.2C76.1 38.6 75.8 38.7 75.1 38.4ZM63.3 33.8C62.3 32.8 62.7 31.7 64.5 29.8C66.4 28 67.5 27.6 68.5 28.7C69.4 29.7 69.1 30.5 67.1 32.4C65.2 34.4 64.2 34.7 63.3 33.8ZM84.1 32.6C82.2 30.7 81.8 29.6 82.9 28.6C83.9 27.7 84.7 28 86.6 30C88.6 31.9 88.9 32.9 87.9 33.8C86.9 34.7 86 34.4 84.1 32.6ZM73.3 28.9C67.8 26.9 66.3 20.6 70.4 16.5C74.1 12.8 80.3 13.7 82.5 18.4C83.4 20.3 83.5 23.1 82.6 24.8C81 28.2 76.6 30.1 73.3 28.9ZM87.3 23.5C85.9 23.3 85.5 22.9 85.5 21.7C85.5 20.3 86.2 20 89.1 20C91.4 20 91.9 20.1 92.3 20.5C92.9 21.2 92.9 22.4 92.3 23C91.7 23.6 89.1 23.8 87.3 23.5ZM59 23C58.4 22.3 58.3 21.5 58.9 20.6C59.6 19.7 64.5 19.7 65.5 20.6C66.2 21.3 66.2 22 65.6 22.8C65.2 23.4 64.9 23.5 62.3 23.5C59.9 23.5 59.4 23.4 59 23ZM64.4 13.5C62.3 11.5 62 10.3 63.2 9.4C64.3 8.6 64.8 8.9 66.8 10.7C68.9 12.8 69.2 13.5 68.5 14.6C67.7 16 66.4 15.6 64.4 13.5ZM82.7 14.6C82 13.5 82.4 12.8 84.5 10.7C86.6 8.7 87.4 8.5 88.4 9.7C89.3 10.8 89.2 11.1 87.1 13.3C84.9 15.6 83.6 16 82.7 14.6ZM74.5 11.3C74 10.8 73.9 10.3 73.9 7.9C73.9 4.9 74.3 4 75.7 4C77.1 4 77.5 5 77.5 7.9C77.5 10.2 77.4 10.7 77 11.2C76.3 12 75.2 12 74.5 11.3Z"/></svg>'
};
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
    const lim = actLimits(act);
    if (feel < lim.feelMin) return "kalt";
    if (feel > lim.feelMax) return "warm";
    const rain = h.precipitation ? h.precipitation[gi] : null, code = h.weather_code ? h.weather_code[gi] : 0;
    if (hourProb(data, gi) > lim.prob || (isNum(rain) && rain >= 0.2) || code >= 95) return "nass";
    const wind = h.wind_speed_10m ? h.wind_speed_10m[gi] : null, gust = h.wind_gusts_10m ? h.wind_gusts_10m[gi] : null;
    if ((lim.wind && isNum(wind) && wind > lim.wind) || (lim.gust && isNum(gust) && gust > lim.gust)) return "wind";
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
    /* Temperatur ist die gefühlte; Windstufen wie in den Schwellen (bis 12 / bis 20 km/h) */
    const facts = [
        "gefühlt " + tmp(feel / n) + "°",
        prob <= 10 ? "kaum Regen" : "Regen bis " + Math.round(prob) + " %",
        wind <= 12 ? "wenig Wind" : (wind <= 20 ? "leichter Wind" : "Wind bis " + wnd(wind) + " " + wunit())
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
    /* Eine Zeile mit vier gleich breiten Feldern: Symbol, Name, gleitende Pille hinter dem gewählten */
    const chips = '<span class="act-ink" aria-hidden="true"></span>' + ACTIVITIES.map(function (a) {
        const on = a.id === act.id;
        return '<button type="button" class="act-chip' + (on ? ' on' : '') + '" data-act="' + a.id + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
            (a.short !== a.name ? ' aria-label="' + a.name + '"' : '') + '>' + (ACT_ICONS[a.id] || '') + '<span class="act-lbl">' + a.short + '</span></button>';
    }).join('');
    const list = res.windows.slice(0, 3).map(function (w, i) {
        return '<button type="button" class="act-win" data-i="' + w.start + '" style="animation-delay:' + dl(1.1 + i * 0.08) + 's"><b>' + w.when + '</b><span>' + w.facts + '</span></button>';
    }).join('');
    box.innerHTML = '<div class="act-chips">' + chips + '</div>' +
        (list ? '<div class="act-list">' + list + '</div>' : '') +
        '<div class="note">' + (list ? 'Antippen zeigt die Stunde oben im Hero.' : activityNote(res.reason)) + '</div>';
    updateActTrack(res.windows);
    moveActInk();
}

/* Gleitende Pille hinter dem gewählten Feld: startet an der alten Position, läuft zur neuen (Übergang im Stylesheet) */
let actInkFrom = null;
function moveActInk() {
    const box = D("activity");
    if (!box || !box.querySelector) return;
    const bar = box.querySelector(".act-chips");
    const ink = bar && bar.querySelector ? bar.querySelector(".act-ink") : null;
    const on = bar && bar.querySelector ? bar.querySelector(".act-chip.on") : null;
    if (!bar || !ink || !on || !ink.style || typeof on.offsetLeft !== "number" || !on.offsetWidth) return;
    const target = { left: on.offsetLeft, width: on.offsetWidth };
    if (actInkFrom && (actInkFrom.left !== target.left || actInkFrom.width !== target.width)) {
        ink.style.transition = "none";
        ink.style.left = actInkFrom.left + "px";
        ink.style.width = actInkFrom.width + "px";
        void ink.offsetWidth;
        ink.style.transition = "";
    }
    ink.style.left = target.left + "px";
    ink.style.width = target.width + "px";
    actInkFrom = target;
    if (bar.classList) bar.classList.add("ink-ready");
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

/* ---- Regenaussicht: aus den Stundenwerten ab jetzt, nicht aus dem Tagesmaximum ---- */

/* Wahrscheinlichkeit einer Stunde oder null, wenn weder Ensemble noch Modellwert vorliegen */
function probAt(data, fc, i) {
    const h = fc.hourly, t = h.time[i];
    if (data && data.members && data.members.length && data.ensIndex && data.ensIndex[t] !== undefined) {
        const st = ensembleStats(data.members, data.ensIndex[t]);
        if (st) return st.prob;
    }
    return h.precipitation_probability && isNum(h.precipitation_probability[i]) ? h.precipitation_probability[i] : null;
}

function dayPartWord(hour) {
    if (hour >= 5 && hour <= 10) return "Vormittag";
    if (hour >= 11 && hour <= 13) return "Mittag";
    if (hour >= 14 && hour <= 17) return "Nachmittag";
    if (hour >= 18 && hour <= 22) return "Abend";
    return "Nacht";
}

/* Satz zur Regenaussicht ab jetzt + skipHours (nach dem Nowcast-Fenster), erst Rest des Tages, dann morgen.
   Wahrscheinlichkeit und Menge getrennt; ohne Daten keine Trockenheitsaussage. */
function rainOutlook(fc, data, skipHours) {
    const h = fc.hourly;
    if (!h || !Array.isArray(h.time) || !h.time.length) return null;
    const w = hourlyWindow(fc, 48);
    const from = Math.min(w.end, w.start + (skipHours || 0));
    const today = dayOf(fc.current.time), tomorrow = nextDay(today);
    const scan = function (date) {
        const r = { hours: 0, known: 0, max: null, maxIdx: -1, mm: 0 };
        for (let i = from; i < w.end; i++) {
            if (dayOf(h.time[i]) !== date) continue;
            r.hours++;
            const p = probAt(data, fc, i);
            if (p !== null) { r.known++; if (r.max === null || p > r.max) { r.max = p; r.maxIdx = i; } }
            if (h.precipitation && isNum(h.precipitation[i])) r.mm += h.precipitation[i];
        }
        return r;
    };
    const amount = function (r) { return r.mm >= 0.1 ? " · ca. " + fmtMm(r.mm) + " mm" : ""; };
    const a = scan(today), b = scan(tomorrow);
    if (a.known && a.max >= 30) {
        const hr = parseInt(h.time[a.maxIdx].slice(11, 13), 10);
        return { text: "Heute " + dayPartWord(hr) + " bis zu " + Math.round(a.max) + " % Regenrisiko" + amount(a), prob: a.max, unknown: false };
    }
    if (b.known && b.max >= 30) {
        const hr = parseInt(h.time[b.maxIdx].slice(11, 13), 10);
        const when = hr <= 4 ? "In der Nacht" : "Morgen " + dayPartWord(hr);
        return { text: when + " bis zu " + Math.round(b.max) + " % Regenrisiko" + amount(b), prob: b.max, unknown: false };
    }
    if (a.hours && !a.known) return { text: "Keine Regenprognose für die nächsten Stunden", prob: null, unknown: true };
    if (!a.hours && !b.known) return { text: "Keine Regenprognose verfügbar", prob: null, unknown: true };
    if (b.known) return { text: "Bis morgen Abend voraussichtlich trocken", prob: Math.max(a.max || 0, b.max || 0), unknown: false };
    return { text: "Heute voraussichtlich trocken", prob: a.max, unknown: false };
}

/* Höchstes Regenrisiko der Stunden im Nowcast-Fenster (aktuelle Stunde plus vier): Ensemble, sonst Modell */
function nowcastProb(fc, data) {
    const w = hourlyWindow(fc, 5);
    let max = null;
    for (let i = w.start; i < w.end; i++) {
        const p = probAt(data, fc, i);
        if (p !== null && (max === null || p > max)) max = p;
    }
    return max;
}

/* Rat zum Regen der nächsten 4 Stunden. Summe und stärkste Viertelstunde stufen ihn:
   0 Tropfen (unter 0,5 mm, keine Viertelstunde ab 0,3 mm), 1 leicht (unter 2 mm, keine ab 0,6 mm),
   2 Schirm. Liegt das Regenrisiko der Stunden bekannt unter 30 %, wird der Rat vorsichtiger. */
function umbrellaAdvice(nc, fc, data) {
    const total = nc.vals.reduce(function (a, b) { return a + b; }, 0);
    const peak = Math.max.apply(null, nc.vals.concat([0]));
    const level = (total < 0.5 && peak < 0.3) ? 0 : ((total < 2 && peak < 0.6) ? 1 : 2);
    const prob = nowcastProb(fc, data);
    const unsure = prob !== null && prob < 30;
    /* Der Nowcast selbst spricht für Regen; ein Ensemble-Risiko nahe null wird darum nicht als Zahl genannt */
    const risk = unsure ? ", Risiko " + (prob < 10 ? "unter 10" : Math.round(prob)) + " %" : "";
    const texts = unsure
        ? ["Vielleicht ein paar Tropfen" + risk, "Leichter Regen möglich" + risk, "Schirm zur Sicherheit" + risk]
        : ["Nur ein paar Tropfen, kein Schirm nötig", "Leichter Regen, eine Kapuze reicht", "Schirm einpacken"];
    return { level: level, text: texts[level], icon: level === 0 ? UI.drop : (level === 1 ? UI.umbrella : UI.umbrellaRain), prob: prob };
}

function renderHero(fc) {
    const d = fc.daily;
    const f = nowFacts(fc);
    setTheme(themeFor(f.code, f.isDay));

    const nc = nowcastSummary(fc);
    const hero = D("hero");
    unskel(hero);
    const first = introElapsed() < 0.3;
    const prevTemp = lastTemp;
    lastTemp = isNum(f.temp) ? parseInt(tmp(f.temp), 10) : null;
    hero.innerHTML = heroHtml(f, true);
    if (first && lastTemp !== null) countUp(hero.querySelector(".temp"), lastTemp);
    else if (lastTemp !== null && isNum(prevTemp) && prevTemp !== lastTemp) {
        const tn = firstTextNode(hero.querySelector(".temp"));
        if (tn) { tn.nodeValue = prevTemp + "°"; glideTo(hero.querySelector(".temp"), lastTemp, "°"); }
    }

    /* Hinweis-Feld: Nowcast als Satz, darunter eine Einordnung */
    const ins = D("insight");
    if (!nc) { ins.classList.add("hidden"); return; }
    /* Einordnung aus den Stundenwerten nach dem Nowcast-Fenster (bei fehlendem Nowcast ab jetzt) */
    let sub, ico;
    if (nc.wet) { const adv = umbrellaAdvice(nc, fc, lastData); sub = adv.text; ico = adv.icon; }
    else { const o = rainOutlook(fc, lastData, nc.unknown ? 0 : 4); sub = o ? o.text : ""; ico = nc.unknown ? UI.alert : UI.check; }
    ins.classList.remove("hidden");
    ins.innerHTML =
        '<div class="ico">' + ico + '</div>' +
        '<div class="txt"><b>' + nc.text + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>';
}

/* ------------------------------------------------------------------ *
 * Ansicht nach Frage: Überblick, Regen, Wind, Wärme, Licht. Die Wahl
 * färbt Stundenstreifen und Tagesliste um und beantwortet die Frage in
 * einem Satz. Hero, Zeitreise, Kacheln und Modellvergleich bleiben.
 * ------------------------------------------------------------------ */
const VIEWS = [
    { id: "overview", label: "Überblick" }, { id: "rain", label: "Regen" }, { id: "wind", label: "Wind" },
    { id: "warm", label: "Wärme" }, { id: "light", label: "Licht" }
];
let view = "overview";

function viewById(id) { return VIEWS.some(function (v) { return v.id === id; }) ? id : "overview"; }
function loadView() {
    try { view = viewById(localStorage.getItem("wetter:view")); } catch (e) { view = "overview"; }
    if (settings.startView !== "last") view = viewById(settings.startView);
}
function saveView() { try { localStorage.setItem("wetter:view", view); } catch (e) {} }
function currentView() { return view; }

function renderViews() {
    const box = D("views");
    if (!box) return;
    box.innerHTML = VIEWS.map(function (v) {
        const on = v.id === view;
        return '<button type="button" class="view-chip' + (on ? ' on' : '') + '" data-view="' + v.id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + v.label + '</button>';
    }).join("");
}

function initViews() {
    loadView();
    renderViews();
    const box = D("views");
    if (box && box.addEventListener) box.addEventListener("click", function (ev) {
        const b = ev && ev.target && ev.target.closest ? ev.target.closest(".view-chip") : null;
        if (b) setView(b.getAttribute("data-view"));
    });
}

/* Wechsel: merken, Chips, Streifen und Liste leise neu bauen, Satz und Notiz, Ring und Spur erneut setzen */
function setView(id) {
    const next = viewById(id);
    if (next === view) return;
    view = next;
    saveView();
    renderViews();
    announce("Ansicht " + VIEWS.filter(function (v) { return v.id === view; })[0].label + ".");
    if (!lastData || !lastData.fc) return;
    dHourly(lastData.fc, null, { quiet: true });
    renderDays(lastData.fc, { quiet: true });
    renderViewText();
    dActivity();
    if (previewIdx !== null) markHour(previewIdx);
    ["hourly", "days"].forEach(function (k) {
        const el = D(k);
        if (!el || !el.classList) return;
        el.classList.remove("swap");
        if (typeof el.offsetWidth === "number") void el.offsetWidth;
        el.classList.add("swap");
    });
}

function viewNote(v) {
    return { overview: "Blaue Felder: Regenrisiko ab 25 %", rain: "Blaue Felder: Regenrisiko ab 25 %, darunter die Menge",
             wind: "Grün: Wind ab 20 km/h, Füllung nach Böen, Pfeil zeigt, wohin es weht", warm: "Tönung nach Temperatur, darunter gefühlt",
             light: "Gelbe Füllung: Sonnenanteil, Wert: UV-Index, darunter Bewölkung" }[v] || "";
}
function daysHint(v) {
    return { rain: "Risiko · Stunden · mm", wind: "Wind · Böen " + wunit(), light: "UV · Sonnenstunden" }[v] || "Tief · Hoch";
}

function renderViewText() {
    const ans = D("viewAnswer");
    if (ans) {
        const txt = lastData ? viewAnswer(view, lastData) : "";
        ans.textContent = txt;
        if (ans.classList) ans.classList.toggle("hidden", !txt);
    }
    const note = D("hourlyNote");
    if (note) note.textContent = viewNote(view);
    const hint = D("daysHint");
    if (hint) hint.textContent = daysHint(view);
}

/* „15 Uhr“, „morgen 6 Uhr“, mit Präposition „morgen gegen 6 Uhr“ */
function whenHour(fc, t, prep) {
    const dw = dayWordFor(fc, t);
    const day = dw === "Heute" ? "" : (dw === "Morgen" ? "morgen " : dw + " ");
    return day + (prep ? prep + " " : "") + parseInt(t.slice(11, 13), 10) + " Uhr";
}

function viewAnswer(v, data) {
    if (v === "rain") return answerRain(data);
    if (v === "wind") return answerWind(data.fc);
    if (v === "warm") return answerWarm(data.fc);
    if (v === "light") return answerLight(data.fc);
    return "";
}

/* Regen: nass = Risiko ab 25 % oder Menge ab 0,1 mm, Fenster die nächsten 24 Stunden */
function answerRain(data) {
    const fc = data.fc, h = fc.hourly, w = hourlyWindow(fc, 24), s = w.start, e = Math.min(w.end, h.time.length);
    if (s < 0 || e - s < 2) return "";
    const wet = function (gi) { return hourProb(data, gi) >= 25 || (h.precipitation && isNum(h.precipitation[gi]) && h.precipitation[gi] >= 0.1); };
    const mmOf = function (a, b) { let mm = 0; for (let k = a; k < b; k++) mm += (h.precipitation && isNum(h.precipitation[k])) ? h.precipitation[k] : 0; return mm; };
    let gi = s;
    if (wet(s)) {
        while (gi < e && wet(gi)) gi++;
        if (gi >= e) return "Regen die nächsten 24 Stunden, etwa " + fmtMm(mmOf(s, e)) + " mm.";
        let again = gi;
        while (again < e && !wet(again)) again++;
        return "Regen bis " + whenHour(fc, h.time[gi]) + ", dann trocken" + (again < e ? ", ab " + whenHour(fc, h.time[again]) + " wieder Regen." : ".");
    }
    while (gi < e && !wet(gi)) gi++;
    if (gi >= e) return "Kein Regen in den nächsten 24 Stunden.";
    let end = gi, pmax = 0;
    while (end < e && wet(end)) { pmax = Math.max(pmax, hourProb(data, end)); end++; }
    const mm = mmOf(gi, end), endT = h.time[Math.min(end, h.time.length - 1)];
    return "Trocken bis " + whenHour(fc, h.time[gi]) + ", dann Regen bis " + whenHour(fc, endT) + (mm >= 0.1 ? ", etwa " + fmtMm(mm) + " mm." : ", bis zu " + Math.round(pmax) + " % Risiko.");
}

/* Wind: Höchstböe mit Richtung und Stunde, Nachsatz aus den letzten zwölf Stunden des Fensters */
function answerWind(fc) {
    const h = fc.hourly, w = hourlyWindow(fc, 24), s = w.start, e = Math.min(w.end, h.time.length);
    if (s < 0 || !h.wind_gusts_10m) return "";
    let gmax = -1, gi = s;
    for (let k = s; k < e; k++) if (isNum(h.wind_gusts_10m[k]) && h.wind_gusts_10m[k] > gmax) { gmax = h.wind_gusts_10m[k]; gi = k; }
    if (gmax < 20) return "Kaum Wind in den nächsten 24 Stunden.";
    let g2 = 0;
    for (let k = Math.max(s, e - 12); k < e; k++) g2 = Math.max(g2, isNum(h.wind_gusts_10m[k]) ? h.wind_gusts_10m[k] : 0);
    const tail = g2 < 20 ? ", später ruhig." : (g2 < 0.7 * gmax ? ", später weniger." : ".");
    const dir = h.wind_direction_10m && isNum(h.wind_direction_10m[gi]) ? " aus " + compass(h.wind_direction_10m[gi]) : "";
    const head = gi === s ? "Jetzt Böen bis " + wnd(gmax) + " " + wunit() + dir : "Böen bis " + wnd(gmax) + " " + wunit() + dir + " " + whenHour(fc, h.time[gi], "gegen");
    return head + tail;
}

/* Wärme: Höchstwert mit Stunde und gefühlt, Tiefstwert nachts oder zur Stunde */
function answerWarm(fc) {
    const h = fc.hourly, w = hourlyWindow(fc, 24), s = w.start, e = Math.min(w.end, h.time.length);
    if (s < 0) return "";
    let hi = -Infinity, hiI = s, lo = Infinity, loI = s;
    for (let k = s; k < e; k++) {
        const t = h.temperature_2m[k];
        if (!isNum(t)) continue;
        if (t > hi) { hi = t; hiI = k; }
        if (t < lo) { lo = t; loI = k; }
    }
    if (!isFinite(hi)) return "";
    const feel = h.apparent_temperature ? h.apparent_temperature[hiI] : null;
    const loHour = parseInt(h.time[loI].slice(11, 13), 10);
    const loPart = loHour >= 20 || loHour < 6 ? "nachts bis " + tmp(lo) + "°" : "tiefstens " + tmp(lo) + "° " + whenHour(fc, h.time[loI], "um");
    const head = hiI === s ? "Jetzt am wärmsten mit " + tmp(hi) + "°" : "Höchstens " + tmp(hi) + "° " + whenHour(fc, h.time[hiI], "um");
    return head + (isNum(feel) ? ", gefühlt " + tmp(feel) + "°" : "") + ", " + loPart + ".";
}

/* Licht: Sonnenstunden, UV-Maximum im Rest des Tages, goldene Stunde; nachts der nächste Aufgang */
function answerLight(fc) {
    const h = fc.hourly, d = fc.daily, w = hourlyWindow(fc, 24), s = w.start;
    if (s < 0 || !d) return "";
    const sunH = function (i) { return d.sunshine_duration && isNum(d.sunshine_duration[i]) ? Math.round(d.sunshine_duration[i] / 3600) : null; };
    const dayNow = h.is_day ? h.is_day[s] === 1 : true;
    if (!dayNow) {
        /* Nach Mitternacht und vor dem Aufgang zählt der heutige Tag, nach dem Untergang der nächste: Lichtzeiten statt fester Uhrzeit */
        const di = Math.max(0, d.time ? d.time.indexOf(dayOf(h.time[s])) : 0);
        const rise = minutesOf(d.sunrise && d.sunrise[di]);
        const idx = rise !== null && minutesOf(h.time[s]) < rise ? di : di + 1, dw = idx === di ? "heute" : "morgen";
        const lv = uvLevel(d.uv_index_max ? d.uv_index_max[idx] : null);
        return "Sonnenaufgang " + hhmm(d.sunrise && d.sunrise[idx]) + (sunH(idx) !== null ? ", " + dw + " " + sunH(idx) + " h Sonne" : "") + (lv ? ", UV " + lv.word : "") + ".";
    }
    const today = dayOf(h.time[s]);
    let uvMax = -1, uvI = s;
    for (let k = s; k < h.time.length && dayOf(h.time[k]) === today; k++) if (h.uv_index && isNum(h.uv_index[k]) && h.uv_index[k] > uvMax) { uvMax = h.uv_index[k]; uvI = k; }
    const lv = uvLevel(uvMax), golden = nextGoldenText(fc);
    return (sunH(0) !== null ? sunH(0) + " h Sonne heute" : "Tag") +
        (lv ? ", UV " + lv.word + (uvI === s ? " jetzt" : " um " + parseInt(h.time[uvI].slice(11, 13), 10) + " Uhr") : "") +
        (golden ? ", " + golden.charAt(0).toLowerCase() + golden.slice(1) : "") + ".";
}

/* Pfeil, der zeigt, wohin der Wind weht (Drehung um die Herkunftsrichtung) */
function arrowIcon(dirFrom, cls) {
    const ang = isNum(dirFrom) ? Math.round(dirFrom) : 0;
    return '<svg class="' + (cls || "ic") + ' arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="--ang:' + ang + 'deg" aria-hidden="true"><g><path d="M12 4v16M6 14l6 6 6-6"/></g></svg>';
}

/* Temperaturstufe für die Spaltentönung der Wärme-Ansicht */
function tempClass(t) {
    if (!isNum(t)) return "";
    return t <= 0 ? " tc1" : (t <= 8 ? " tc2" : (t <= 16 ? " tc3" : (t <= 24 ? " tc4" : " tc5")));
}

function dHourly(fc, ens, opts) {
    const quiet = !!(opts && opts.quiet);
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
        const wet = i !== 0 && prob >= 25 && (view === "overview" || view === "rain");
        const fillStyle = function (pct, lead) { return '--p:' + pct + '%;' + (quiet ? 'animation:none' : 'animation-delay:' + dl(lead + Math.min(i, 8) * 0.06) + 's'); };
        const icon = svgIcon(h.weather_code[gi], h.is_day ? h.is_day[gi] : 1, "ic");
        let cls = wet ? ' wet' : '', fill = '', ic = icon, val, sub;
        if (view === "wind") {
            const spd = h.wind_speed_10m ? h.wind_speed_10m[gi] : null, g = h.wind_gusts_10m ? h.wind_gusts_10m[gi] : null;
            if (isNum(spd) && spd >= 20) cls = ' windy';
            if (i !== 0 && isNum(g) && g > 0) fill = '<i class="fill wfill" style="' + fillStyle(Math.min(100, Math.round(g / 60 * 100)), 1.15) + '"></i>';
            ic = arrowIcon(h.wind_direction_10m ? h.wind_direction_10m[gi] : null);
            val = isNum(spd) ? wnd(spd) : '–';
            sub = isNum(g) ? 'Böen ' + wnd(g) : '&nbsp;';
        } else if (view === "warm") {
            const f = h.apparent_temperature ? h.apparent_temperature[gi] : null;
            cls = tempClass(v);
            val = isNum(v) ? tmp(v) + '°' : '–';
            sub = isNum(f) ? 'gef. ' + tmp(f) + '°' : '&nbsp;';
        } else if (view === "light") {
            const uv = h.uv_index ? h.uv_index[gi] : null, cc = h.cloud_cover ? h.cloud_cover[gi] : null, day = h.is_day ? h.is_day[gi] === 1 : true;
            const share = day && isNum(cc) ? Math.max(0, Math.min(100, Math.round(100 - cc))) : 0;
            if (!day) cls = ' dark';
            if (i !== 0 && share > 0) fill = '<i class="fill lfill" style="' + fillStyle(share, 1.15) + '"></i>';
            val = day && isNum(uv) ? 'UV ' + Math.round(uv) : '–';
            sub = isNum(cc) ? Math.round(cc) + ' %' : '&nbsp;';
        } else if (view === "rain") {
            const mm = h.precipitation ? h.precipitation[gi] : null;
            if (wet) fill = '<i class="fill" style="' + fillStyle(Math.round(prob), 1.15) + '"></i>';
            val = Math.round(prob) + '%';
            sub = isNum(mm) && mm >= 0.05 ? fmtMm(mm) + ' mm' : '&nbsp;';
        } else {
            /* Regenstunden: das Blau steigt wie ein Wasserstand bis zur Wahrscheinlichkeit */
            if (wet) fill = quiet ? '<i class="fill" style="' + fillStyle(Math.round(prob), 1.15) + '"></i>' :
                '<i class="fill" data-stagger="' + (Math.min(i, 8) * 0.06).toFixed(2) + 's" style="--p:' + Math.round(prob) + '%;animation-delay:' + dl(1.15 + Math.min(i, 8) * 0.06) + 's"></i>';
            val = isNum(v) ? tmp(v) + '°' : '–';
            sub = Math.round(prob) + '%';
        }
        /* data-i: globaler Stundenindex für die Zeitreise; die Spalte „Jetzt" hat keins */
        /* Schaltfläche mit Satz je Stunde; nur „Jetzt“ liegt im Tab-Weg, die Pfeiltasten wandern weiter */
        cols +=
            '<button type="button" aria-label="' + hourAlt(data, i === 0 ? null : gi, w.start) + '" tabindex="' + (i === 0 ? '0' : '-1') + '"' +
                (i === 0 ? '' : ' data-i="' + gi + '"') + ' class="hcol' + (i === 0 ? ' now' : '') + (newDay ? ' newday' : '') + cls + '" style="' + (quiet ? 'animation:none' : 'animation-delay:' + dl(0.9 + Math.min(i, 8) * 0.06) + 's') + '">' +
                fill +
                '<span class="t">' + (i === 0 ? "Jetzt" : (newDay ? weekday(dd) : hhmm(t).slice(0, 2))) + '</span>' +
                ic +
                '<span class="v">' + val + '</span>' +
                '<span class="p">' + sub + '</span>' +
            '</button>';
    }
    box.innerHTML = '<div class="strip"><div class="strip-inner">' + cols + '</div><div class="act-track" aria-hidden="true">' + cells + '</div></div>';
}

/* ------------------------------------------------------------------ *
 * Verlaufssicht: 48 Stunden als Meteogramm (Wolkenband, Temperaturlinie, Windpfeile, Regenbalken)
 * ------------------------------------------------------------------ */
let trendOpen = false;

function trendSvg(fc, data) {
    const h = fc.hourly, w = hourlyWindow(fc, 48), n = w.end - w.start;
    if (n < 2) return "";
    const W = 480, step = W / n;
    const temps = [], rain = [], cloud = [], spd = [], dir = [];
    for (let i = w.start; i < w.end; i++) {
        temps.push(isNum(h.temperature_2m[i]) ? h.temperature_2m[i] : null);
        rain.push(h.precipitation && isNum(h.precipitation[i]) ? h.precipitation[i] : 0);
        cloud.push(h.cloud_cover && isNum(h.cloud_cover[i]) ? h.cloud_cover[i] : null);
        spd.push(h.wind_speed_10m && isNum(h.wind_speed_10m[i]) ? h.wind_speed_10m[i] : null);
        dir.push(h.wind_direction_10m && isNum(h.wind_direction_10m[i]) ? h.wind_direction_10m[i] : null);
    }
    const tv = temps.filter(isNum);
    if (!tv.length) return "";
    const tmin = Math.min.apply(null, tv), tmax = Math.max.apply(null, tv), span = Math.max(1, tmax - tmin);
    const ty = function (t) { return 100 - (t - tmin) / span * 60; };
    const maxMm = Math.max(0.5, Math.max.apply(null, rain));
    let out = '';
    /* Wolkenband */
    cloud.forEach(function (c, i) { if (c !== null && c > 0) out += '<rect class="cloud" x="' + (i * step).toFixed(1) + '" y="4" width="' + step.toFixed(1) + '" height="12" opacity="' + (c / 100 * 0.6).toFixed(2) + '"/>'; });
    /* Tagesgrenzen und Stundenachse */
    let iMax = 0, iMin = 0;
    for (let i = 0; i < n; i++) {
        const t = h.time[w.start + i], hr = parseInt(t.slice(11, 13), 10), x = i * step;
        if (i > 0 && hr === 0) out += '<line class="day" x1="' + x.toFixed(1) + '" y1="2" x2="' + x.toFixed(1) + '" y2="134"/><text x="' + (x + 3).toFixed(1) + '" y="162">' + weekday(dayOf(t)) + '</text>';
        if (hr % 6 === 0) out += '<text x="' + (x + step / 2).toFixed(1) + '" y="150" text-anchor="middle">' + String(hr).padStart(2, '0') + '</text>';
        if (isNum(temps[i]) && temps[i] > temps[iMax]) iMax = i;
        if (isNum(temps[i]) && temps[i] < temps[iMin]) iMin = i;
    }
    /* Temperaturlinie mit Höchst- und Tiefstwert */
    const pts = temps.map(function (t, i) { return isNum(t) ? (i * step + step / 2).toFixed(1) + ',' + ty(t).toFixed(1) : null; }).filter(Boolean);
    out += '<polyline class="tline" points="' + pts.join(' ') + '"/>';
    [[iMax, -6, 'end-max'], [iMin, 14, 'end-min']].forEach(function (m) {
        const i = m[0], x = i * step + step / 2, y = ty(temps[i]);
        out += '<circle class="tdot" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3"/><text class="tl" x="' + x.toFixed(1) + '" y="' + (y + m[1]).toFixed(1) + '" text-anchor="middle">' + tmp(temps[i]) + '°</text>';
    });
    /* Windpfeile alle drei Stunden (Pfeil zeigt, wohin der Wind weht) */
    for (let i = 0; i < n; i += 3) {
        if (!isNum(spd[i])) continue;
        const x = i * step + step * 1.5, ang = isNum(dir[i]) ? Math.round((dir[i] + 180) % 360) : 0;
        out += '<path class="wa" transform="translate(' + x.toFixed(1) + ' 110) rotate(' + ang + ')" d="M0 -5 L4 4 L0 2 L-4 4 Z"/>';
    }
    /* Regenbalken */
    out += '<line class="base" x1="0" y1="134" x2="' + W + '" y2="134"/>';
    rain.forEach(function (v, i) { if (v > 0) { const hh = Math.max(2, Math.round(v / maxMm * 16)); out += '<rect class="rb" x="' + (i * step + 1).toFixed(1) + '" y="' + (134 - hh) + '" width="' + (step - 2).toFixed(1) + '" height="' + hh + '" rx="1"/>'; } });
    const totalMm = rain.reduce(function (a, b) { return a + b; }, 0);
    const cv = cloud.filter(isNum), cloudAvg = cv.length ? Math.round(cv.reduce(function (a, b) { return a + b; }, 0) / cv.length) : null;
    const sv = spd.filter(isNum), windMax = sv.length ? Math.max.apply(null, sv) : null;
    const alt = 'Verlauf der nächsten 48 Stunden: Temperatur zwischen ' + tmp(tmin) + ' und ' + tmp(tmax) + ' Grad, Regen insgesamt ' + fmtMm(totalMm) + ' mm' +
        (cloudAvg !== null ? ', Bewölkung im Mittel ' + cloudAvg + ' %' : '') + (windMax !== null ? ', Wind bis ' + wnd(windMax) + ' ' + wunit() : '') + '.';
    return '<svg class="trend" viewBox="0 0 ' + W + ' 166" aria-hidden="true">' + out + '</svg><div class="vh">' + alt + '</div>';
}

function renderTrend() {
    const body = D("trendBody");
    if (!body || !lastData || !trendOpen) return;
    body.innerHTML = trendSvg(lastData.fc, lastData);
}

function toggleTrend() {
    trendOpen = !trendOpen;
    const panel = D("trend"), btn = D("trendBtn");
    if (trendOpen) renderTrend();
    if (panel && panel.classList) panel.classList.toggle("open", trendOpen);
    if (btn && btn.setAttribute) btn.setAttribute("aria-expanded", trendOpen ? "true" : "false");
    announce(trendOpen ? "Verlauf geöffnet." : "Verlauf geschlossen.");
}

/* ---- Regenradar als Blatt: die Radarseite läuft eingebettet, der Rahmen lädt erst beim ersten Öffnen ---- */
/* Versions-Query der eigenen Skript-URL; das Radar-Blatt lädt die eingebettete Seite damit in derselben Version
   statt aus einem alten HTTP-Cache */
var ASSET_VERSION = (function () {
    const s = typeof document !== "undefined" ? document.currentScript : null;
    const m = s && s.src ? /[?&]v=(\w+)/.exec(s.src) : null;
    return m ? m[1] : "";
})();
/* night: aktueller Nachtzustand der Startseite, damit das eingebettete Radar dieselbe Palette zeigt */
function radarEmbedUrl() { return "radar.html?embed=1&night=" + (nightOn ? "1" : "0") + (ASSET_VERSION ? "&v=" + ASSET_VERSION : ""); }

function openRadar() {
    const sheet = D("radarSheet"), frame = D("radarFrame");
    if (!sheet) return;
    if (frame && frame.setAttribute && !(frame.getAttribute && frame.getAttribute("src"))) frame.setAttribute("src", radarEmbedUrl());
    document.body.classList.add("radar-open");
    if (D("radarTab")) D("radarTab").setAttribute("aria-expanded", "true");
    announce("Regenradar geöffnet.");
    setTimeout(function () { if (D("radarClose")) D("radarClose").focus(); }, 300);
}

function closeRadar() {
    document.body.classList.remove("radar-open");
    const tab = D("radarTab");
    if (tab) { tab.setAttribute("aria-expanded", "false"); if (tab.focus) tab.focus(); }
}

function initRadarSheet() {
    const tab = D("radarTab");
    if (tab && tab.addEventListener) tab.addEventListener("click", function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); openRadar(); });
    if (D("radarBg")) D("radarBg").addEventListener("click", closeRadar);
    if (D("radarClose")) D("radarClose").addEventListener("click", closeRadar);
    if (D("radarSheet")) D("radarSheet").addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeRadar(); });
}

/* ---- Regenpausen: trockene Phasen in den 16 Nowcast-Intervallen ---- */

function dryRuns(vals) {
    const runs = [];
    let run = null;
    vals.forEach(function (v, i) {
        if (v < 0.1) { if (run) run.e = i; else run = { s: i, e: i }; }
        else if (run) { runs.push(run); run = null; }
    });
    if (run) runs.push(run);
    return runs;
}

function addMinutes(t, min) {
    const d = new Date(t.slice(0, 10) + "T" + t.slice(11, 16) + ":00");
    if (isNaN(d.getTime())) return t;
    d.setMinutes(d.getMinutes() + min);
    const p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}

function fmtPause(slots) {
    const m = slots * 15;
    if (m < 60) return "rund " + m + " Minuten";
    if (m % 60 === 0) return "rund " + (m / 60) + (m === 60 ? " Stunde" : " Stunden");
    return "rund " + Math.floor(m / 60) + " h " + (m % 60) + " min";
}

/* Erste trockene Phase, die für die gewünschte Dauer reicht; Zeiten als „ca.", weil 15-Minuten-Raster.
   Reicht die Phase bis zum Ende der 4 Stunden, ist sie offen: ihr Ende ist unbekannt. */
function pauseInfo(nc, minutes) {
    const need = Math.max(1, Math.ceil(minutes / 15));
    const runs = dryRuns(nc.vals);
    const last = nc.vals.length - 1;
    const hit = runs.filter(function (r) { return r.e - r.s + 1 >= need; })[0];
    const endOf = function (r) { return hhmm(addMinutes(nc.times[r.e], 15)); };
    if (hit) {
        const open = hit.e === last, len = hit.e - hit.s + 1;
        let text;
        if (hit.s === 0) text = open ? "Jetzt trocken, mindestens bis " + endOf(hit) + "." : "Jetzt trocken bis ca. " + endOf(hit) + ", " + fmtPause(len) + ".";
        else text = open ? "Nächste trockene Phase: ab ca. " + hhmm(nc.times[hit.s]) + ", mindestens bis " + endOf(hit) + "." : "Nächste trockene Phase: ca. " + hhmm(nc.times[hit.s]) + " bis " + endOf(hit) + ", " + fmtPause(len) + ".";
        return { s: hit.s, e: hit.e, open: open, text: text };
    }
    let longest = null;
    runs.forEach(function (r) { if (!longest || r.e - r.s > longest.e - longest.s) longest = r; });
    let text = "In den nächsten 4 Stunden keine trockene Phase von " + minutes + " Minuten";
    if (longest) text += ", längstens " + fmtPause(longest.e - longest.s + 1) + " ab ca. " + hhmm(nc.times[longest.s]);
    return { none: true, text: text + "." };
}

/* Klassen für Balken i: p innerhalb der Phase, pe am weichen Rand */
function pauseClasses(info, i) {
    if (!info || info.none || i < info.s || i > info.e) return "";
    const edge = (i === info.s && info.s > 0) || (i === info.e && !info.open);
    return " p" + (edge ? " pe" : "");
}

let pauseMinutes = 30;
let lastNc = null;

function loadPause() {
    try {
        const v = parseInt(localStorage.getItem("wetter:pause"), 10);
        if (v === 15 || v === 30 || v === 60) pauseMinutes = v;
    } catch (e) { /* kein Speicher */ }
}

function pauseBlockHtml(info) {
    const chips = [15, 30, 60].map(function (m) {
        return '<button type="button" class="pchip' + (m === pauseMinutes ? ' on' : '') + '" data-min="' + m + '">' + m + ' min</button>';
    }).join('');
    return '<div class="pause"><div class="prow"><span class="pl">Trockene Phase für</span><div class="pchips">' + chips + '</div></div>' +
        '<div class="ptext">' + info.text + '</div></div>';
}

function dNowcast(fc) {
    const box = D("nowcast"), card = D("nowcastCard");
    const nc = nowcastSummary(fc);
    lastNc = nc;
    if (!nc || !nc.wet) { card.classList.add("hidden"); return; }
    card.classList.remove("hidden");
    const peak = Math.max.apply(null, nc.vals.concat([0.4]));
    const info = pauseInfo(nc, pauseMinutes);
    const peakI = nc.vals.indexOf(Math.max.apply(null, nc.vals));
    const total = nc.vals.reduce(function (a, b) { return a + b; }, 0);
    box.innerHTML =
        '<div class="nc-lead">' + nc.text + '</div>' +
        '<div class="vh">Regen je Viertelstunde der nächsten 4 Stunden: stärkste Viertelstunde um ' + hhmm(nc.times[peakI]) + ' Uhr mit ' + fmtMm(nc.vals[peakI]) + ' mm, insgesamt ' + fmtMm(total) + ' mm.</div>' +
        /* Balken wachsen nacheinander von links nach rechts aus der Grundlinie; data-stagger
           hält die Staffelung auch beim Neustart per Antippen. p/pe: trockene Phase (Regenpause). */
        '<div class="nc-bars" aria-hidden="true">' + nc.vals.map(function (v, i) {
            const stagger = (i * 0.1).toFixed(2) + 's';
            return '<i class="' + (v > 0 ? '' : 'z') + pauseClasses(info, i) + '" data-stagger="' + stagger + '" style="height:' + (v > 0 ? Math.max(8, Math.round(v / peak * 100)) : 4) + '%;animation-delay:' + dl(1.0 + i * 0.1) + 's"></i>';
        }).join('') + '</div>' +
        '<div class="nc-axis" aria-hidden="true">' + nc.times.map(function (t, i) { return '<span>' + (i % 4 === 0 ? hhmm(t) : '') + '</span>'; }).join('') + '</div>' +
        pauseBlockHtml(info);
}

/* Dauer wechseln: Balkenklassen, Chips und Satz ohne Neurendern der Balken */
function updatePause() {
    const box = D("nowcast");
    if (!box || !lastNc || !lastNc.wet) return;
    const info = pauseInfo(lastNc, pauseMinutes);
    if (!box.querySelectorAll || !box.firstElementChild) { 
        /* Harness ohne echtes DOM: Block komplett neu setzen */
        const html = box.innerHTML;
        const at = html.indexOf('<div class="pause">');
        box.innerHTML = (at >= 0 ? html.slice(0, at) : html) + pauseBlockHtml(info);
        return;
    }
    Array.prototype.slice.call(box.querySelectorAll(".nc-bars i")).forEach(function (el, i) {
        el.classList.remove("p"); el.classList.remove("pe");
        const c = pauseClasses(info, i);
        if (c.indexOf(" p") === 0) el.classList.add("p");
        if (c.indexOf("pe") > 0) el.classList.add("pe");
    });
    Array.prototype.slice.call(box.querySelectorAll(".pchip")).forEach(function (b) { b.classList.toggle("on", parseInt(b.getAttribute("data-min"), 10) === pauseMinutes); });
    const txt = box.querySelector(".ptext");
    if (txt) txt.textContent = info.text;
}

function setPause(minutes) {
    if (minutes !== 15 && minutes !== 30 && minutes !== 60) return;
    pauseMinutes = minutes;
    try { localStorage.setItem("wetter:pause", String(minutes)); } catch (e) { /* kein Speicher */ }
    updatePause();
}

/* ------------------------------------------------------------------ *
 * Nächste Tage: regelbasierte Highlights aus den Tageswerten (Tag 1 bis 7)
 * ------------------------------------------------------------------ */
const DAYS_SHOWN = 7;      /* sichtbare Zeilen der Tagesliste, der Rest klappt auf */
const HL_DAYS = 7;
const HL_PRIO = { sturm75: 9, schnee: 8, frost: 8, gewitter: 7, hitze: 7, sturm: 6, nass: 6, sprung: 5, nebel: 4, trocken: 3, sonne: 3 };
const SNOW_CODES = [71, 73, 75, 77, 85, 86];

/* Alle Kandidaten: { day, dayTo (Zeitraum), kind, prio, text }. Heute bleibt außen vor. */
function dayHighlights(fc) {
    const d = fc.daily;
    if (!d || !Array.isArray(d.time) || d.time.length < 2) return [];
    const last = Math.min(HL_DAYS, d.time.length - 1);
    const at = function (arr, i) { return arr && isNum(arr[i]) ? arr[i] : null; };
    const out = [];
    const add = function (day, kind, prio, text, dayTo) { out.push({ day: day, dayTo: dayTo || null, kind: kind, prio: prio, text: text }); };

    /* Größter Temperatursprung zum Vortag, mit gerundeten Höchstwerten gerechnet, damit der Satz stimmt */
    let best = null;
    for (let i = 1; i <= last; i++) {
        const a = at(d.temperature_2m_max, i - 1), b = at(d.temperature_2m_max, i);
        if (a === null || b === null) continue;
        const diff = Math.round(b) - Math.round(a);
        if (Math.abs(diff) >= 5 && (!best || Math.abs(diff) > Math.abs(best.diff))) best = { i: i, diff: diff, a: a, b: b };
    }
    if (best) add(best.i, "sprung", HL_PRIO.sprung, Math.abs(parseInt(tdiff(best.diff), 10)) + "° " + (best.diff > 0 ? "wärmer" : "kühler") + ", " + tmp(best.b) + "° statt " + tmp(best.a) + "°");

    /* Erster Frost: nur wenn heute und gestern (Vortag, falls geladen) frostfrei waren */
    const pm = fc.past && fc.past.daily && Array.isArray(fc.past.daily.temperature_2m_min) ? fc.past.daily.temperature_2m_min : null;
    const yMin = pm ? at(pm, pm.length - 1) : null, tMin = at(d.temperature_2m_min, 0);
    if (!(tMin !== null && tMin <= 0) && !(yMin !== null && yMin <= 0)) {
        for (let i = 1; i <= last; i++) {
            const m = at(d.temperature_2m_min, i);
            if (m !== null && m <= 0) { add(i, "frost", HL_PRIO.frost, "Erster Frost, morgens " + tmp(m) + "°"); break; }
        }
    }

    /* Je Tag: Sturm, Nass, Schnee, Gewitter, Nebel, Hitze */
    for (let i = 1; i <= last; i++) {
        const g = at(d.wind_gusts_10m_max, i), sum = at(d.precipitation_sum, i), prob = at(d.precipitation_probability_max, i);
        const code = at(d.weather_code, i), hi = at(d.temperature_2m_max, i);
        if (g !== null && g >= 75) add(i, "sturm", HL_PRIO.sturm75, "Sturmböen bis " + wnd(g) + " " + wunit());
        else if (g !== null && g >= 60) add(i, "sturm", HL_PRIO.sturm, "Stürmisch, Böen bis " + wnd(g) + " " + wunit());
        if (sum !== null && sum >= 10) add(i, "nass", HL_PRIO.nass, "Nass, rund " + Math.round(sum) + " mm" + (prob !== null && prob >= 70 ? " bei " + Math.round(prob) + " % Risiko" : ""));
        if (code !== null && SNOW_CODES.indexOf(code) >= 0) add(i, "schnee", HL_PRIO.schnee, "Schnee");
        if (code !== null && code >= 95) add(i, "gewitter", HL_PRIO.gewitter, "Gewitter möglich");
        if (code === 45 || code === 48) add(i, "nebel", HL_PRIO.nebel, "Nebel");
        if (hi !== null && hi >= 30) add(i, "hitze", HL_PRIO.hitze, "Hitze, " + tmp(hi) + "°");
    }

    /* Längste Trockenphase ab drei Tagen am Stück */
    let run = null, longest = null;
    for (let i = 1; i <= last + 1; i++) {
        const sum = i <= last ? at(d.precipitation_sum, i) : null, prob = i <= last ? at(d.precipitation_probability_max, i) : null;
        const dry = i <= last && sum !== null && sum < 0.5 && (prob === null || prob < 30);
        if (dry) { if (!run) run = { s: i, e: i }; else run.e = i; }
        else if (run) {
            if (run.e - run.s + 1 >= 3 && (!longest || run.e - run.s > longest.e - longest.s)) longest = run;
            run = null;
        }
    }
    if (longest) add(longest.s, "trocken", HL_PRIO.trocken, "Trocken", longest.e);

    /* Sonnigster Tag: ab 7 Stunden Sonne und 70 % des Tageslichts */
    let sunny = null;
    for (let i = 1; i <= last; i++) {
        const sun = at(d.sunshine_duration, i), day = at(d.daylight_duration, i);
        if (sun !== null && day !== null && day > 0 && sun >= 7 * 3600 && sun / day >= 0.7 && (!sunny || sun > sunny.sun)) sunny = { i: i, sun: sun };
    }
    if (sunny) add(sunny.i, "sonne", HL_PRIO.sonne, "Sonnig, " + Math.round(sunny.sun / 3600) + " Stunden Sonne");
    return out;
}

/* Satz je Tageszeile für Vorleser: Wetter, Risiko, Spanne, Menge, Böen */
function dayAlt(fc, i) {
    const d = fc.daily;
    const parts = [wmo(d.weather_code[i])[1]];
    if (d.precipitation_probability_max && isNum(d.precipitation_probability_max[i])) parts.push("Regenrisiko " + Math.round(d.precipitation_probability_max[i]) + " %");
    if (isNum(d.temperature_2m_min[i]) && isNum(d.temperature_2m_max[i])) parts.push(tmp(d.temperature_2m_min[i]) + " bis " + tmp(d.temperature_2m_max[i]) + " Grad");
    if (d.precipitation_sum && isNum(d.precipitation_sum[i]) && d.precipitation_sum[i] >= 0.1) parts.push(fmtMm(d.precipitation_sum[i]) + " mm");
    if (d.wind_gusts_10m_max && isNum(d.wind_gusts_10m_max[i])) parts.push("Böen bis " + wnd(d.wind_gusts_10m_max[i]) + " " + wunit());
    return (i === 0 ? "Heute" : longWeekday(d.time[i])) + ": " + parts.join(", ");
}

/* Pro Tag der wichtigste Kandidat (Zeiträume zählen getrennt), dann die wichtigsten max, nach Tagen sortiert */
function pickHighlights(list, max) {
    const byDay = {}, ranges = [];
    list.forEach(function (c) {
        if (c.dayTo) { ranges.push(c); return; }
        if (!byDay[c.day] || c.prio > byDay[c.day].prio) byDay[c.day] = c;
    });
    const all = Object.keys(byDay).map(function (k) { return byDay[k]; }).concat(ranges);
    all.sort(function (a, b) { return b.prio - a.prio || a.day - b.day; });
    return all.slice(0, max).sort(function (a, b) { return a.day - b.day; });
}

function hlLabel(fc, c) {
    const t = fc.daily.time;
    return c.dayTo ? weekday(t[c.day]) + "–" + weekday(t[c.dayTo]) : weekday(t[c.day]);
}

function highlightsHtml(fc) {
    const picked = pickHighlights(dayHighlights(fc), 3);
    if (!picked.length) return '<div class="hl-none">Die nächsten sieben Tage ohne Auffälligkeiten.</div>';
    const t = fc.daily.time;
    return picked.map(function (c) {
        const long = c.dayTo ? longWeekday(t[c.day]) + " bis " + longWeekday(t[c.dayTo]) : longWeekday(t[c.day]);
        return '<button type="button" class="hl-row" data-day="' + c.day + '" aria-label="' + long + ': ' + c.text + '">' +
            '<span class="hl-day">' + hlLabel(fc, c) + '</span><span class="hl-txt">' + c.text + '</span></button>';
    }).join('');
}

function renderHighlights(fc) {
    const box = D("highlights"), field = D("highlightsField");
    if (!box) return;
    box.innerHTML = highlightsHtml(fc) + '<button type="button" class="tp-src" data-src="highlights">Woher kommt das?</button>';
    if (field && field.classList) field.classList.remove("hidden");
}

/* Aus den Highlights zur Zeile des Tags in der Tagesliste: bei Bedarf aufklappen, in die Mitte rollen, aufleuchten */
function jumpToDay(i) {
    const field = D("daysField"), box = D("days");
    if (!field || !box || !isNum(i)) return;
    const unfold = i >= DAYS_SHOWN && field.classList && !field.classList.contains("all");
    if (unfold) {
        field.classList.add("all");
        if (D("daysMoreLabel")) D("daysMoreLabel").textContent = "Weniger anzeigen";
        if (D("daysMore")) D("daysMore").setAttribute("aria-expanded", "true");
    }
    const row = box.querySelector ? box.querySelector('.drow[data-day="' + i + '"]') : null;
    if (!row || !row.scrollIntoView) return;
    setTimeout(function () {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        if (row.classList) { row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash"); }
    }, unfold ? 350 : 0);
}

function renderDays(fc, opts) {
    const quiet = !!(opts && opts.quiet);
    const box = D("days");
    unskel(box);
    const d = fc.daily, n = d.time.length;
    const field = D("daysField");
    if (field && field.classList) { VIEWS.forEach(function (v) { field.classList.remove("v-" + v.id); }); field.classList.add("v-" + view); }
    const maxOf = function (arr) { return arr ? Math.max(1e-9, Math.max.apply(null, arr.filter(isNum))) : 1; };
    const maxSum = maxOf(d.precipitation_sum), maxGust = maxOf(d.wind_gusts_10m_max);
    const tLo = Math.min.apply(null, d.temperature_2m_min.filter(isNum));
    const tHi = Math.max.apply(null, d.temperature_2m_max.filter(isNum));
    const span = Math.max(1, tHi - tLo);
    const cur = fc.current.temperature_2m;
    const SHOWN = DAYS_SHOWN;
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
        /* Zeile je Ansicht: Symbol, erster Wert, links, Balken, rechts */
        let ic = svgIcon(code, 1, "ic"), first = isNum(prob) ? Math.round(prob) + '%' : '', loTxt = tmp(lo) + '°', hiTxt = tmp(hi) + '°';
        let bLeft = left, bWidth = width, dot = i === 0 && isNum(cur) ? '<b style="left:' + Math.max(0, Math.min(100, (cur - tLo) / span * 100)).toFixed(1) + '%"></b>' : '';
        if (view === "rain") {
            const sum = d.precipitation_sum[i], ph = d.precipitation_hours ? d.precipitation_hours[i] : null;
            loTxt = isNum(ph) && ph > 0 ? Math.round(ph) + ' h' : '';
            bLeft = 0; bWidth = isNum(sum) && sum > 0 ? Math.max(2, sum / maxSum * 100) : 0;
            hiTxt = fmtMm(sum); dot = '';
        } else if (view === "wind") {
            const wm = d.wind_speed_10m_max ? d.wind_speed_10m_max[i] : null, gm = d.wind_gusts_10m_max ? d.wind_gusts_10m_max[i] : null, dir = d.wind_direction_10m_dominant ? d.wind_direction_10m_dominant[i] : null;
            ic = arrowIcon(dir); first = compass(dir);
            loTxt = isNum(wm) ? wnd(wm) : '';
            bLeft = 0; bWidth = isNum(gm) && gm > 0 ? Math.max(2, gm / maxGust * 100) : 0;
            hiTxt = isNum(gm) ? wnd(gm) : '–'; dot = '';
        } else if (view === "light") {
            const uvm = d.uv_index_max ? d.uv_index_max[i] : null, sun = d.sunshine_duration ? d.sunshine_duration[i] : null, dlen = d.daylight_duration ? d.daylight_duration[i] : null;
            first = isNum(uvm) ? 'UV ' + Math.round(uvm) : '';
            loTxt = '';
            bLeft = 0; bWidth = isNum(sun) && isNum(dlen) && dlen > 0 ? Math.max(0, Math.min(100, sun / dlen * 100)) : 0;
            hiTxt = isNum(sun) ? Math.round(sun / 3600) + ' h' : '–'; dot = '';
        }
        const barAnim = quiet ? 'animation:none' : 'animation-delay:' + (more ? '0.5' : (+delay + 0.2).toFixed(2)) + 's';
        const row =
            '<div class="drow' + (i === 0 ? ' today' : '') + mood + (more ? ' more' : '') + '" data-day="' + i + '" role="img" aria-label="' + dayAlt(fc, i) + '"' + (quiet ? ' style="animation:none"' : (more ? '' : ' style="animation-delay:' + delay + 's"')) + '>' +
                '<div class="n">' + (i === 0 ? "Heute" : weekday(d.time[i])) + '</div>' +
                ic +
                '<div class="pp">' + first + '</div>' +
                '<div class="lo">' + loTxt + '</div>' +
                '<div class="bar"><i style="left:' + bLeft.toFixed(1) + '%;width:' + bWidth.toFixed(1) + '%;' + barAnim + '"></i>' + dot + '</div>' +
                '<div class="hi">' + hiTxt + '</div>' +
            '</div>';
        if (more) moreRows += row; else rows += row;
    }
    if (moreRows) rows += '<div class="more-wrap"><div class="more-inner">' + moreRows + '</div></div>';
    if (n > SHOWN) {
        rows += '<button type="button" class="days-more" id="daysMore" aria-expanded="false"><span id="daysMoreLabel">Weitere ' + (n - SHOWN) + ' Tage</span>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>';
    }
    box.innerHTML = rows;
    const btn = D("daysMore");
    if (btn && n > SHOWN) {
        btn.addEventListener("click", function () {
            const field = D("daysField");
            const open = field.classList.toggle("all");
            D("daysMoreLabel").textContent = open ? "Weniger anzeigen" : "Weitere " + (n - SHOWN) + " Tage";
            btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
    }
}

/* ---- Kacheln ---- */

/* Kachel: Titelzeile mit optionalem Mini-Icon rechts, großer Wert, optionaler Zusatz (Skala), Untertitel.
   opts.delay staffelt das Einblenden, opts.icon / opts.extra sind kleine SVGs mit Mikroanimation. */
const CHEVRON = '<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>';

/* Aufklappbare Kacheln: Chevron im Titel und eine unsichtbare Disclosure-Schaltfläche über der
   ganzen Kachel (große Trefferfläche, Tastatur, aria-expanded, aria-controls auf das Detailfeld). */
let tileCounts = null;   /* Zählerziele der zuletzt gebauten Kacheln, in Reihenfolge (für seedTileCounts) */

function tile(cls, title, big, sub, opts) {
    opts = opts || {};
    const count = isNum(opts.count) ? ' data-count="' + Number(opts.count.toFixed(opts.decimals || 0)) + '" data-decimals="' + (opts.decimals || 0) + '"' : '';
    /* data-name zum Ausblenden: der Platzname aus der Tabelle geht vor (Sicht teilt sich den Platz mit Pollen), sonst der Feldschlüssel */
    const key = (opts.key ? ' data-tile="' + opts.key + '"' : '') + ' data-name="' + (TILE_SLUGS[title] || opts.key || "") + '"';
    const toggle = opts.key ? '<button type="button" class="t-toggle" aria-expanded="false" aria-controls="tpanel-' + opts.key + '" aria-label="' + title + ': Details anzeigen"></button>' : '';
    if (isNum(opts.count) && tileCounts) tileCounts.push({ label: title, target: Number(opts.count.toFixed(opts.decimals || 0)) });
    /* still: beim leisen Neubau stehen unveränderte Kacheln; swap: die getauschte blendet ein */
    const style = opts.still ? 'animation:none' : 'animation-delay:' + dl(opts.delay || 0) + 's';
    return '<div class="tile ' + cls + (opts.swap ? ' swap' : '') + '"' + key + ' style="' + style + '">' +
        '<h3>' + title + (opts.icon ? '<span class="t-ico">' + opts.icon + '</span>' : '') + (opts.key ? CHEVRON : '') + '</h3>' +
        '<div class="big"' + count + '>' + big + '</div>' +
        (opts.extra || '') +
        (sub ? '<div class="sub">' + sub + '</div>' : '') + toggle + '</div>';
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

/* Tropfen, der sich bis zur Luftfeuchte füllt; jede Maske bekommt eine eigene ID, damit sich mehrere Tropfen auf einer Seite nicht stören */
let dropClipSeq = 0;
function dropIcon(humidity) {
    const y = isNum(humidity) ? 2 + (1 - Math.max(0, Math.min(100, humidity)) / 100) * 26 : 30;
    const shape = 'M12 2c5 7 9 12 9 17a9 9 0 0 1-18 0c0-5 4-10 9-17z';
    const clipId = "dropclip" + (++dropClipSeq);
    /* Die Maske liegt auf einer ruhenden Gruppe; nur das Rechteck darin steigt. Läge die
       Maske auf dem Rechteck selbst, würde sie mitwandern und das Wasser aus dem Tropfen laufen. */
    return '<svg class="drop-ico" viewBox="0 0 24 30" width="20" height="26" fill="none" stroke-width="2" stroke-linejoin="round" aria-hidden="true">' +
        '<clipPath id="' + clipId + '"><path d="' + shape + '"/></clipPath>' +
        '<g clip-path="url(#' + clipId + ')"><rect x="0" y="' + y.toFixed(1) + '" width="24" height="30" stroke="none"/></g>' +
        '<path d="' + shape + '"/></svg>';
}

/* Druckanzeige: Zeiger zwischen 980 und 1040 hPa */
function gaugeIcon(p) {
    const ang = isNum(p) ? Math.max(-90, Math.min(90, (p - 980) / 60 * 180 - 90)) : -90;
    return '<svg class="gauge-ico" viewBox="0 0 48 28" width="44" height="26" fill="none" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" style="--ang:' + ang.toFixed(0) + 'deg">' +
        '<path class="track" d="M4 26 A20 20 0 0 1 44 26"/><line class="needle" x1="24" y1="26" x2="24" y2="9"/></svg>';
}

/* ---- Kacheln entfalten: Instrument-Felder für Wind, Regen, Sonne ---- */

let openTile = null;
function openTileKey() { return openTile; }

/* Inhaltsblock eines Feldes mit gestaffelter Einblendung; data-stagger hält die Staffelung beim Neustart */
function tpItem(i, inner) {
    const d = (i * 0.08).toFixed(2) + 's';
    return '<div class="tp-item" data-stagger="' + d + '" style="animation-delay:' + d + '">' + inner + '</div>';
}

const TILE_NAMES = { wind: "Wind", rain: "Regen", sun: "Sonne", sicht: "Sicht" };
/* Name je Kachel für „Startseite anpassen“; Pollen und Sicht teilen sich einen Platz */
const TILE_SLUGS = { "UV-Index": "uv", "UV morgen": "uv", "Luftfeuchte": "humidity", "Luftdruck": "pressure", "Luftqualität": "air", "Pollen": "pollen", "Sicht": "pollen" };

function tilePanelHtml(key, inner, bodyClass) {
    return '<div class="tpanel tp-' + key + '" data-for="' + key + '" id="tpanel-' + key + '" role="region" aria-label="' + (TILE_NAMES[key] || key) + ' im Detail"><div class="tpanel-in"><div class="tpanel-body' + (bodyClass ? ' ' + bodyClass : '') + '">' + inner +
        '<button type="button" class="tp-src" data-src="' + key + '">Woher kommt das?</button></div></div></div>';
}

/* Wind: Kompass (Nadel zeigt, wohin der Wind weht) plus Böenverlauf der nächsten 12 Stunden */
function windPanelHtml(fc) {
    const c = fc.current, h = fc.hourly;
    const dir = c.wind_direction_10m;
    const ang = isNum(dir) ? Math.round((dir + 180) % 360) : 0;
    let ticks = "";
    for (let a = 0; a < 360; a += 45) {
        const major = a % 90 === 0, r1 = major ? 44 : 47, rad = a * Math.PI / 180;
        ticks += '<line' + (major ? ' class="major"' : '') + ' x1="' + (70 + r1 * Math.sin(rad)).toFixed(1) + '" y1="' + (70 - r1 * Math.cos(rad)).toFixed(1) + '" x2="' + (70 + 52 * Math.sin(rad)).toFixed(1) + '" y2="' + (70 - 52 * Math.cos(rad)).toFixed(1) + '"/>';
    }
    const letters = [["N", 70, 12], ["O", 128, 74], ["S", 70, 136], ["W", 12, 74]].map(function (l) {
        return '<text x="' + l[1] + '" y="' + l[2] + '" text-anchor="middle">' + l[0] + '</text>';
    }).join('');
    const compassSvg = '<svg class="compass" viewBox="0 0 140 140" aria-hidden="true">' +
        '<circle class="ring" cx="70" cy="70" r="52"/>' + ticks + letters +
        /* Nadelgruppe symmetrisch um 70/70, damit sie um die Mitte dreht (transform-box: fill-box) */
        '<g class="needle" style="--ang:' + ang + 'deg"><path class="tip" d="M70 24l7 26h-14z"/><path class="tail" d="M70 116l-5-20h10z"/><circle class="hub" cx="70" cy="70" r="4"/></g>' +
        '</svg>';

    const w = hourlyWindow(fc, 12);
    let maxG = 20, bars = "", labels = "", peak = null;
    for (let i = w.start; i < w.end; i++) { const g = h.wind_gusts_10m ? h.wind_gusts_10m[i] : null; if (isNum(g)) maxG = Math.max(maxG, g); }
    for (let i = w.start; i < w.end; i++) {
        const v = h.wind_speed_10m ? h.wind_speed_10m[i] : null, g = h.wind_gusts_10m ? h.wind_gusts_10m[i] : null;
        if (isNum(g) && (peak === null || g > peak.g)) peak = { g: g, t: h.time[i] };
        bars += '<span class="gh"><i class="w" style="height:' + (isNum(v) ? Math.max(3, Math.round(v / maxG * 100)) : 0) + '%"></i><i class="g" style="height:' + (isNum(g) ? Math.max(3, Math.round(g / maxG * 100)) : 0) + '%"></i></span>';
        labels += '<span>' + ((i - w.start) % 3 === 0 ? hhmm(h.time[i]).slice(0, 2) : '') + '</span>';
    }
    const sentence = peak && peak.g >= 20 ? 'Böen bis ' + wnd(peak.g) + ' ' + wunit() + ' gegen ' + parseInt(peak.t.slice(11, 13), 10) + ' Uhr' : 'Ruhig, Böen unter ' + wnd(20) + ' ' + wunit();
    return tpItem(0, '<div class="wind-wrap">' + compassSvg +
            '<div class="wind-now"><div class="big">' + (isNum(c.wind_speed_10m) ? wnd(c.wind_speed_10m) : '–') + '<small>' + wunit() + '</small></div>' +
            '<div class="sub">Böen ' + (isNum(c.wind_gusts_10m) ? wnd(c.wind_gusts_10m) : '–') + ' ' + wunit() + '<br>aus ' + compass(dir) + '</div></div></div>') +
        tpItem(1, '<div class="gusts" role="img" aria-label="Wind und Böen der nächsten 12 Stunden: ' + sentence + '.">' + bars + '</div><div class="gust-axis" aria-hidden="true">' + labels + '</div>') +
        tpItem(2, '<div class="tp-note">' + sentence + ' · hell Wind, dunkel Böen</div>');
}

/* Regen: die nächsten 24 Stunden als Balken, Wahrscheinlichkeit alle drei Stunden, Tagessummen */
function rainPanelHtml(fc) {
    const h = fc.hourly, d = fc.daily;
    const w = hourlyWindow(fc, 24);
    let maxV = 1, bars = "", labels = "", tot = 0, pk = null;
    for (let i = w.start; i < w.end; i++) if (h.precipitation && isNum(h.precipitation[i])) maxV = Math.max(maxV, h.precipitation[i]);
    for (let i = w.start; i < w.end; i++) {
        const v = h.precipitation && isNum(h.precipitation[i]) ? h.precipitation[i] : 0;
        tot += v;
        if (v > 0 && (!pk || v > pk.v)) pk = { v: v, t: h.time[i] };
        bars += '<i class="' + (v > 0 ? '' : 'z ') + 'rb" style="height:' + (v > 0 ? Math.max(6, Math.round(v / maxV * 100)) : 3) + '%"></i>';
        if ((i - w.start) % 3 === 0) {
            const prob = lastData ? hourProb(lastData, i) : (h.precipitation_probability && isNum(h.precipitation_probability[i]) ? h.precipitation_probability[i] : 0);
            labels += '<span><b>' + hhmm(h.time[i]).slice(0, 2) + '</b>' + Math.round(prob) + ' %</span>';
        }
    }
    const today = d && isNum(d.precipitation_sum[0]) ? d.precipitation_sum[0] : null;
    const hours = d && d.precipitation_hours && isNum(d.precipitation_hours[0]) ? Math.round(d.precipitation_hours[0]) : 0;
    const tomorrow = d && isNum(d.precipitation_sum[1]) ? d.precipitation_sum[1] : null;
    const sentence = (today === null ? 'Heute –' : (today < 0.05 ? 'Heute trocken' : 'Heute ' + fmtMm(today) + ' mm' + (hours > 0 ? ' in ' + hours + ' Regenstunde' + (hours === 1 ? '' : 'n') : ''))) +
        ' · Morgen ' + (tomorrow === null ? '–' : fmtMm(tomorrow) + ' mm');
    const alt = pk ? 'Regen der nächsten 24 Stunden: insgesamt ' + fmtMm(tot) + ' mm, am meisten um ' + parseInt(pk.t.slice(11, 13), 10) + ' Uhr mit ' + fmtMm(pk.v) + ' mm.' : 'Regen der nächsten 24 Stunden: trocken.';
    return tpItem(0, '<div class="rain24" role="img" aria-label="' + alt + '">' + bars + '</div><div class="rain-axis" aria-hidden="true">' + labels + '</div>') +
        tpItem(1, '<div class="tp-note">' + sentence + '</div>');
}

/* ---- Abendmodus: Lichtzeiten aus dem Sonnenstand, Bewölkung zum Untergang ---- */

/* solarTimes, nightByClock und moonPhase liegen in sonne.js (gemeinsam mit dem Radar) */

function fmtMin(min) {
    if (!isNum(min)) return "–";
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

/* Goldene und blaue Stunde für einen Tag der Vorhersage, verankert an den Open-Meteo-Zeiten */
function lightTimes(fc, dayIndex) {
    const d = fc.daily;
    if (!d || !d.time || !d.time[dayIndex] || !isNum(fc.latitude) || !isNum(fc.longitude)) return null;
    const date = d.time[dayIndex], off = isNum(fc.utc_offset_seconds) ? fc.utc_offset_seconds : 0;
    const rise = minutesOf(d.sunrise && d.sunrise[dayIndex]), set = minutesOf(d.sunset && d.sunset[dayIndex]);
    const base = solarTimes(fc.latitude, fc.longitude, date, off, -0.833);
    if (rise === null || set === null || !base) return null;
    const shiftM = rise - base.rise, shiftE = set - base.set;
    const g = solarTimes(fc.latitude, fc.longitude, date, off, 6), b4 = solarTimes(fc.latitude, fc.longitude, date, off, -4), b8 = solarTimes(fc.latitude, fc.longitude, date, off, -8);
    return {
        morning: { blueStart: b8 ? b8.rise + shiftM : null, goldenStart: b4 ? b4.rise + shiftM : null, sunrise: rise, goldenEnd: g ? g.rise + shiftM : null },
        evening: { goldenStart: g ? g.set + shiftE : null, sunset: set, goldenEnd: b4 ? b4.set + shiftE : null, blueEnd: b8 ? b8.set + shiftE : null }
    };
}

/* Aktuelle Lichtphase mit Text; nextDay = Lichtzeiten von morgen für den Hinweis in der Nacht */
function lightPhase(t, nowMin, nextDay) {
    if (!t) return { phase: "day", text: "" };
    const m = t.morning, e = t.evening;
    const left = function (until) { return "noch " + Math.max(1, Math.round(until - nowMin)) + " min"; };
    if (isNum(m.blueStart) && isNum(m.goldenStart) && nowMin >= m.blueStart && nowMin < m.goldenStart) return { phase: "blue", until: m.goldenStart, text: "Jetzt blaue Stunde · " + left(m.goldenStart) };
    if (isNum(m.goldenStart) && isNum(m.goldenEnd) && nowMin >= m.goldenStart && nowMin < m.goldenEnd) return { phase: "golden", until: m.goldenEnd, text: "Jetzt goldene Stunde · " + left(m.goldenEnd) };
    if (isNum(e.goldenStart) && isNum(e.goldenEnd) && nowMin >= e.goldenStart && nowMin < e.goldenEnd) return { phase: "golden", until: e.goldenEnd, text: "Jetzt goldene Stunde · " + left(e.goldenEnd) };
    if (isNum(e.goldenEnd) && isNum(e.blueEnd) && nowMin >= e.goldenEnd && nowMin < e.blueEnd) return { phase: "blue", until: e.blueEnd, text: "Jetzt blaue Stunde · " + left(e.blueEnd) };
    if (isNum(e.goldenStart) && nowMin < e.goldenStart && nowMin >= (isNum(m.goldenEnd) ? m.goldenEnd : 0)) return { phase: "day", until: e.goldenStart, text: "Goldene Stunde ab " + fmtMin(e.goldenStart) };
    const next = nextDay && nextDay.morning && isNum(nextDay.morning.goldenStart) ? nextDay.morning.goldenStart : (isNum(m.goldenStart) ? m.goldenStart : null);
    return { phase: "night", until: next, text: "Nacht" + (next !== null ? " · goldene Stunde morgen ab " + fmtMin(next) : "") };
}

/* Bewölkung zum Sonnenuntergang, zwischen den umliegenden Stunden interpoliert */
function sunsetClouds(fc, sunsetIso) {
    const h = fc.hourly;
    if (!h || !h.time || !h.cloud_cover || !sunsetIso) return null;
    const hourIso = sunsetIso.slice(0, 13) + ":00";
    const i = h.time.indexOf(hourIso);
    if (i < 0) return null;
    const frac = minutesOf(sunsetIso) % 60 / 60;
    const at = function (arr) {
        if (!arr || !isNum(arr[i])) return null;
        return isNum(arr[i + 1]) ? arr[i] + (arr[i + 1] - arr[i]) * frac : arr[i];
    };
    const total = at(h.cloud_cover), low = at(h.cloud_cover_low), high = at(h.cloud_cover_high);
    if (!isNum(total)) return null;
    let verdict;
    if (isNum(low) && low >= 60) verdict = "tiefe Wolken, Untergang wahrscheinlich verdeckt";
    else if (total <= 20) verdict = "klar, wenig Farbe";
    else if (isNum(high) && high >= 30 && (!isNum(low) || low < 40)) verdict = "hohe Wolken, gute Chance auf Farbe";
    else verdict = "wechselnd bewölkt";
    return { total: Math.round(total), low: isNum(low) ? Math.round(low) : null, high: isNum(high) ? Math.round(high) : null,
             text: "Zum Untergang " + Math.round(total) + " % Wolken" + (isNum(low) ? ", tief " + Math.round(low) + " %" : "") + ": " + verdict + "." };
}

/* Lichtleiste des Abends: Tag, goldene Stunde, blaue Stunde, Nacht mit Zeiten und Jetzt-Punkt */
function lightBarHtml(e, nowMin) {
    if (!e || !isNum(e.goldenStart) || !isNum(e.goldenEnd) || !isNum(e.blueEnd)) return "";
    const from = e.goldenStart - 60, to = e.blueEnd + 20, span = to - from;
    const w = function (a, b) { return ((b - a) / span * 100).toFixed(1) + "%"; };
    const segs = '<i class="seg day" style="width:' + w(from, e.goldenStart) + '"></i>' +
        '<i class="seg gold" style="width:' + w(e.goldenStart, e.goldenEnd) + '"></i>' +
        '<i class="seg blue" style="width:' + w(e.goldenEnd, e.blueEnd) + '"></i>' +
        '<i class="seg night" style="width:' + w(e.blueEnd, to) + '"></i>';
    const dot = isNum(nowMin) && nowMin >= from && nowMin <= to ? '<b class="now" style="left:' + ((nowMin - from) / span * 100).toFixed(1) + '%"></b>' : "";
    const mark = function (min, label) { return '<span style="left:' + ((min - from) / span * 100).toFixed(1) + '%">' + label + '</span>'; };
    return '<div class="light-bar">' + segs + dot + '</div>' +
        '<div class="light-axis">' + mark(e.goldenStart, fmtMin(e.goldenStart)) + mark(e.sunset, fmtMin(e.sunset)) + mark(e.blueEnd, fmtMin(e.blueEnd)) + '</div>';
}

/* Sonne: großer Halbkreisbogen mit Sonnenstand, Lichtzeiten und Vergleich zu morgen */
function sunPanelHtml(fc) {
    const c = fc.current, d = fc.daily;
    const rise = d && d.sunrise ? d.sunrise[0] : null, set = d && d.sunset ? d.sunset[0] : null;
    const now = minutesOf(c.time), r = minutesOf(rise), s = minutesOf(set);
    let p = 0, night = true;
    if (now !== null && r !== null && s !== null && s > r) { p = Math.max(0, Math.min(1, (now - r) / (s - r))); night = p <= 0 || p >= 1; }
    const path = 'M20 150 A140 140 0 0 1 300 150';
    const stops = [0, 0.25, 0.5, 0.75, 1].map(function (k, i) { return '--c' + i + ':' + sunColor(p * k); }).join(';');
    const svg = '<svg class="sunbig" viewBox="0 0 320 172" aria-hidden="true" style="--p:' + Math.round(p * 100) + ';--ang:' + Math.round(p * 180) + 'deg;' + stops + '">' +
        '<line class="horizon" x1="10" y1="150" x2="310" y2="150"/>' +
        '<path class="track" d="' + path + '" fill="none" stroke-width="4" stroke-linecap="round"/>' +
        (p > 0 ? '<path class="done" pathLength="100" d="' + path + '" fill="none" stroke-width="4" stroke-linecap="round"/>' : '') +
        '<g class="sunpos"><circle class="dot" cx="20" cy="150" r="9" stroke-width="2.4"/></g>' +
        '<text class="tl" x="20" y="168" text-anchor="middle">' + hhmm(rise) + '</text><text class="tl" x="300" y="168" text-anchor="middle">' + hhmm(set) + '</text>' +
        (night ? '<text class="tn" x="160" y="100" text-anchor="middle">Nacht</text>' : '') + '</svg>';
    const dl0 = d && d.daylight_duration ? d.daylight_duration[0] : null, dl1 = d && d.daylight_duration ? d.daylight_duration[1] : null;
    const sun0 = d && d.sunshine_duration ? d.sunshine_duration[0] : null;
    let cmp = '–';
    if (isNum(dl0) && isNum(dl1)) {
        const diff = dl1 - dl0;
        cmp = Math.abs(diff) < 30 ? 'Morgen gleich lang' : 'Morgen ' + Math.round(Math.abs(diff) / 60) + ' min ' + (diff > 0 ? 'länger' : 'kürzer');
    }
    const fact = function (k, v) { return '<div class="fact"><span>' + k + '</span>' + v + '</div>'; };
    /* Abendmodus: Lichtphase, Lichtleiste des Abends, Morgenzeile, Bewölkung zum Untergang */
    const lt = lightTimes(fc, 0), ltNext = lightTimes(fc, 1);
    const ph = lightPhase(lt, now, ltNext);
    let light = "";
    if (lt) {
        const m = lt.morning;
        light = '<div class="light">' +
            (ph.text ? '<div class="light-now ' + ph.phase + '">' + ph.text + '</div>' : '') +
            lightBarHtml(lt.evening, now) +
            (isNum(m.blueStart) && isNum(m.goldenEnd) ? '<div class="light-line">Morgens blaue Stunde ab ' + fmtMin(m.blueStart) + ', goldene Stunde ' + fmtMin(m.goldenStart) + ' bis ' + fmtMin(m.goldenEnd) + '.</div>' : '') +
            (function () { const cl = sunsetClouds(fc, set); return cl ? '<div class="light-line">' + cl.text + '</div>' : ''; })() +
            '</div>';
    }
    const alt = '<div class="vh">Tageslichtbogen: Aufgang ' + hhmm(rise) + ', Untergang ' + hhmm(set) + ', ' + Math.round(p * 100) + ' % des Tages vergangen.</div>';
    return tpItem(0, svg + alt) +
        tpItem(1, '<div class="facts">' + fact('Tageslänge', fmtDuration(dl0)) + fact('Sonnenschein', fmtDuration(sun0)) + fact('Vergleich', cmp) + '</div>') +
        (light ? tpItem(2, light) : '');
}

/* Klasse für das Sonnenfeld, solange eine Lichtphase läuft (Abendmodus) */
function lightPhaseClass(fc) {
    const ph = lightPhase(lightTimes(fc, 0), minutesOf(fc.current.time), lightTimes(fc, 1));
    return ph.phase === "golden" || ph.phase === "blue" ? ph.phase : "";
}

/* Nächste goldene Stunde als kurze Angabe für die Kachel Sonne */
function nextGoldenText(fc) {
    const lt = lightTimes(fc, 0);
    if (!lt) return "";
    const now = minutesOf(fc.current.time), e = lt.evening, m = lt.morning;
    if (isNum(m.goldenStart) && isNum(m.goldenEnd) && now < m.goldenEnd) return "Goldene Stunde " + (now >= m.goldenStart ? "bis " + fmtMin(m.goldenEnd) : "ab " + fmtMin(m.goldenStart));
    if (isNum(e.goldenStart) && isNum(e.goldenEnd) && now < e.goldenEnd) return "Goldene Stunde " + (now >= e.goldenStart ? "bis " + fmtMin(e.goldenEnd) : "ab " + fmtMin(e.goldenStart));
    const next = lightTimes(fc, 1);
    return next && isNum(next.morning.goldenStart) ? "Goldene Stunde morgen ab " + fmtMin(next.morning.goldenStart) : "";
}

function setTileState(key, open) {
    const box = D("details");
    if (!box || !box.querySelector) return;
    const tile = box.querySelector('.tile[data-tile="' + key + '"]'), panel = box.querySelector('.tpanel[data-for="' + key + '"]');
    if (tile && tile.classList) {
        tile.classList.toggle("open", open);
        const btn = tile.querySelector ? tile.querySelector(".t-toggle") : null;
        if (btn && btn.setAttribute) {
            btn.setAttribute("aria-expanded", open ? "true" : "false");
            btn.setAttribute("aria-label", (TILE_NAMES[key] || key) + ": Details " + (open ? "ausblenden" : "anzeigen"));
        }
    }
    if (panel && panel.classList) { panel.classList.toggle("open", open); if (open) restartAnimations(panel); }
}

/* Öffnen, schließen, wechseln; höchstens ein Feld ist offen */
function toggleTile(key) {
    if (openTile === key) { setTileState(key, false); openTile = null; return; }
    if (openTile) setTileState(openTile, false);
    openTile = key;
    setTileState(key, true);
}

/* UV-Balken der Kachel (Skala bis 11) */
function uvMeter(uv, lv) {
    return '<div class="meter"><i class="st-' + (lv ? lv.st : 'none') + '" style="width:' + (isNum(uv) ? Math.max(3, Math.min(100, uv / 11 * 100)).toFixed(0) : 0) + '%"></i></div>';
}

/* Höchstwert von morgen und die Stunde, in der er erreicht wird */
function uvTomorrow(fc) {
    const d = fc.daily, h = fc.hourly;
    const max = d && d.uv_index_max ? d.uv_index_max[1] : null;
    let hour = null, best = -1;
    if (h && h.uv_index && h.time && d && d.time && d.time[1]) {
        h.time.forEach(function (t, i) {
            if (t.slice(0, 10) === d.time[1] && isNum(h.uv_index[i]) && h.uv_index[i] > best) { best = h.uv_index[i]; hour = parseInt(t.slice(11, 13), 10); }
        });
    }
    return { max: isNum(max) ? max : null, hour: hour };
}

/* Mondsymbol: Scheibe plus beleuchtete Fläche aus Halbkreis und Terminator-Ellipse */
function moonIcon(mp) {
    const r = 9, cx = 12, cy = 12, k = Math.cos(2 * Math.PI * mp.phase);   /* 1 Neumond … −1 Vollmond */
    const waxing = mp.phase < 0.5, side = waxing ? 1 : 0, bulge = k < 0 ? side : 1 - side;
    const lit = 'M' + cx + ' ' + (cy - r) + ' A' + r + ' ' + r + ' 0 0 ' + side + ' ' + cx + ' ' + (cy + r) +
        ' A' + (Math.abs(k) * r).toFixed(2) + ' ' + r + ' 0 0 ' + bulge + ' ' + cx + ' ' + (cy - r) + 'Z';
    return '<svg class="moon-ico" viewBox="0 0 24 24" width="22" height="22" role="img" aria-label="' + mp.name + ', ' + Math.round(mp.illum * 100) + ' % beleuchtet">' +
        '<circle class="moon-dark" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/><path class="moon-lit" d="' + lit + '"/></svg>';
}

const FOG_ICON = '<svg class="fog-ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9h13"/><path class="f2" d="M3 14h18"/><path d="M6 19h12"/></svg>';

/* Nebelrisiko einer Stunde: Taupunktabstand, Wind und Bewölkung als Punkte; vorhergesagte Sicht unter 1 km
   ist immer „hoch“, unter 4 km mindestens „mittel“ */
function fogRisk(vis, spread, wind, cloud) {
    if (isNum(vis) && vis < 1000) return "hoch";
    let score = 0;
    if (isNum(spread)) score += spread <= 1.5 ? 2 : (spread <= 3 ? 1 : 0);
    if (isNum(wind)) score += wind <= 8 ? 1 : (wind > 20 ? -1 : 0);
    if (isNum(cloud)) score += cloud <= 30 ? 1 : (cloud >= 80 ? -1 : 0);
    let lvl = score >= 3 ? "hoch" : (score >= 2 ? "mittel" : "gering");
    if (isNum(vis) && vis < 4000 && lvl === "gering") lvl = "mittel";
    return lvl;
}
function fogRiskAt(fc, gi) {
    const h = fc.hourly;
    const t = h.temperature_2m ? h.temperature_2m[gi] : null, td = h.dew_point_2m ? h.dew_point_2m[gi] : null;
    return fogRisk(h.visibility ? h.visibility[gi] : null, isNum(t) && isNum(td) ? t - td : null, h.wind_speed_10m ? h.wind_speed_10m[gi] : null, h.cloud_cover ? h.cloud_cover[gi] : null);
}
/* Gründe für hohes Risiko in einer Stunde, als kurze Aufzählung */
function fogReasons(fc, gi) {
    const h = fc.hourly, out = [];
    const t = h.temperature_2m ? h.temperature_2m[gi] : null, td = h.dew_point_2m ? h.dew_point_2m[gi] : null;
    if (isNum(t) && isNum(td) && t - td <= 1.5) out.push("Taupunktabstand " + tdiff(t - td) + "°");
    if (h.wind_speed_10m && isNum(h.wind_speed_10m[gi]) && h.wind_speed_10m[gi] <= 8) out.push("kaum Wind");
    if (h.cloud_cover && isNum(h.cloud_cover[gi]) && h.cloud_cover[gi] <= 30) out.push("klarer Himmel");
    return out;
}

/* Sichtweite der aktuellen Stunde, Nebelrisiko jetzt und die nächste Stunde mit hohem Risiko in 24 h */
function visibilityInfo(fc) {
    const h = fc.hourly;
    if (!h || !h.visibility || !h.time) return null;
    const i = hourlyWindow(fc, 24).start, vis = h.visibility[i];
    if (!isNum(vis)) return null;
    const word = vis < 1000 ? "Nebel" : (vis < 4000 ? "diesig" : (vis < 10000 ? "mäßig" : "klar"));
    const risk = fogRiskAt(fc, i);
    let riskAt = null;
    for (let gi = i + 1; gi <= i + 24 && gi < h.time.length; gi++) {
        if (fogRiskAt(fc, gi) === "hoch") { riskAt = h.time[gi]; break; }
    }
    const td = h.dew_point_2m ? h.dew_point_2m[i] : null;
    const sub = risk !== "hoch" && riskAt ? "Nebelrisiko hoch " + whenHour(fc, riskAt, "gegen") : "Nebelrisiko " + risk + (isNum(td) ? " · Taupunkt " + Math.round(td) + "°" : "");
    const km = vis >= 1000, val = km ? vis / 1000 : Math.round(vis), dec = km && vis < 10000 ? 1 : 0;
    return { vis: vis, word: word, risk: risk, riskAt: riskAt, sub: sub, count: val, decimals: dec, big: (km ? fmtNum(val, dec) : String(val)) + '<small>' + (km ? 'km' : 'm') + '</small>' };
}

/* Instrument-Feld Sicht: Säulen der Sichtweite (bis 20 km) für 24 Stunden, Nebelstunden grau, Satz zum Risiko */
function sichtPanelHtml(fc) {
    const h = fc.hourly, w = hourlyWindow(fc, 24);
    let bars = "", labels = "", first = -1, last = -1;
    for (let i = w.start; i < w.end; i++) {
        const v = h.visibility && isNum(h.visibility[i]) ? h.visibility[i] : null;
        const cls = v !== null && v < 1000 ? "fog " : (v !== null && v < 4000 ? "haze " : "");
        bars += '<i class="' + cls + 'vb" style="height:' + (v === null ? 3 : Math.max(6, Math.round(Math.min(v, 20000) / 20000 * 100))) + '%"></i>';
        if ((i - w.start) % 3 === 0) labels += '<span><b>' + hhmm(h.time[i]).slice(0, 2) + '</b>' + (v === null ? '–' : (v >= 1000 ? Math.round(v / 1000) + ' km' : Math.round(v) + ' m')) + '</span>';
        /* Der Satz spannt von der ersten bis zur letzten Stunde mit hohem Risiko, auch über mehrere Blöcke */
        if (fogRiskAt(fc, i) === "hoch") { if (first < 0) first = i; last = i; }
    }
    let sentence;
    if (first < 0) {
        let minV = Infinity;
        for (let i = w.start; i < w.end; i++) if (h.visibility && isNum(h.visibility[i])) minV = Math.min(minV, h.visibility[i]);
        sentence = "Kein hohes Nebelrisiko in den nächsten 24 Stunden" + (isFinite(minV) ? ", Sicht mindestens " + (minV >= 1000 ? Math.round(minV / 1000) + " km" : Math.round(minV) + " m") : "") + ".";
    } else {
        const dw = dayWordFor(fc, h.time[first]);
        const day = dw === "Heute" ? "heute" : (dw === "Morgen" ? "morgen" : dw);
        const endH = (parseInt(h.time[last].slice(11, 13), 10) + 1) % 24;
        const why = fogReasons(fc, first);
        const visLow = h.visibility && isNum(h.visibility[first]) && h.visibility[first] < 1000;
        const parts = (visLow ? ["Sicht unter 1 km"] : []).concat(why);
        sentence = "Nebelrisiko hoch " + day + " von " + parseInt(h.time[first].slice(11, 13), 10) + " bis " + endH + " Uhr" + (parts.length ? ": " + parts.join(", ") : "") + ".";
    }
    return tpItem(0, '<div class="vis24" role="img" aria-label="Sichtverlauf der nächsten 24 Stunden: ' + sentence + '">' + bars + '</div><div class="rain-axis" aria-hidden="true">' + labels + '</div>') +
        tpItem(1, '<div class="tp-note">' + sentence + '</div>');
}

/* Zählerziele der frisch gebauten Kacheln als „schon gesehen“ eintragen: kein Neustart, kein Gleiten */
function seedTileCounts(root, counts) {
    (counts || []).forEach(function (c, idx) { lastCounts[(root && root.id ? root.id : "") + ":" + c.label + ":" + idx] = c.target; });
}

/* opts.swap: leiser Neubau beim Tag-Nacht-Wechsel (Kacheln stehen, die getauschte blendet ein, Zähler werden gesät) */
function renderDetails(fc, air, opts) {
    opts = opts || {};
    const box = D("details");
    unskel(box);
    const c = fc.current, d = fc.daily, h = fc.hourly;
    const w = hourlyWindow(fc, 24);
    const uvNow = h.uv_index ? h.uv_index[w.start] : null;
    const uvMax = d.uv_index_max ? d.uv_index_max[0] : null;
    const lv = uvLevel(uvNow);
    const still = !!opts.swap;
    let html = "", k = 0;
    const next = function () { return 1.0 + (k++) * 0.07; };
    tileCounts = [];

    if (nightOn) {
        /* Nachts zählt der nächste Tag: Höchstwert von morgen, Mondphase als Symbol */
        const ut = uvTomorrow(fc), lvt = uvLevel(ut.max), mp = moonPhase(new Date(nowMs()));
        html += tile("uv", "UV morgen",
            (isNum(ut.max) ? fmtNum(ut.max, 1) : '–') + (lvt ? '<span class="word">' + lvt.word + '</span>' : ''),
            isNum(ut.hour) ? 'Höchstwert gegen ' + ut.hour + ' Uhr' : (mp ? mp.name : null),
            { delay: next(), count: ut.max, decimals: 1, icon: mp ? moonIcon(mp) : '', swap: still, extra: uvMeter(ut.max, lvt) });
    } else {
        html += tile("uv", "UV-Index",
            (isNum(uvNow) ? fmtNum(uvNow, 1) : '–') + (lv ? '<span class="word">' + lv.word + '</span>' : ''),
            isNum(uvMax) ? 'Maximum heute ' + fmtNum(uvMax, 1) : null,
            { delay: next(), count: isNum(uvNow) ? uvNow : null, decimals: 1, swap: still, extra: uvMeter(uvNow, lv) });
    }

    html += tile("wind", "Wind",
        (isNum(c.wind_speed_10m) ? wnd(c.wind_speed_10m) : '–') + '<small>' + wunit() + '</small>',
        'Aus ' + compass(c.wind_direction_10m) + ' · Böen ' + Math.round(c.wind_gusts_10m),
        { delay: next(), count: isNum(c.wind_speed_10m) ? Math.round(c.wind_speed_10m) : null, icon: windMini(c.wind_direction_10m), key: "wind", still: still });
    /* Instrument-Feld der Reihe UV/Wind: klappt unter der Reihe auf, das Raster bleibt stehen */
    html += tilePanelHtml("wind", windPanelHtml(fc));

    html += tile("rain", "Regen",
        fmtMm(d.precipitation_sum[0]) + '<small>mm</small>',
        (isNum(d.precipitation_probability_max[0]) ? 'Risiko ' + d.precipitation_probability_max[0] + '&nbsp;%' : '') +
        (isNum(d.precipitation_hours && d.precipitation_hours[0]) && d.precipitation_hours[0] > 0 ? ' · ' + Math.round(d.precipitation_hours[0]) + '&nbsp;h' : '') +
        '<br>Morgen ' + fmtMm(d.precipitation_sum[1]) + '&nbsp;mm · ' + (isNum(d.precipitation_probability_max[1]) ? d.precipitation_probability_max[1] + '&nbsp;%' : '–'),
        { delay: next(), count: isNum(d.precipitation_sum[0]) ? d.precipitation_sum[0] : null, decimals: isNum(d.precipitation_sum[0]) && d.precipitation_sum[0] >= 0.05 && d.precipitation_sum[0] < 10 ? 1 : 0, icon: MINI.rain, key: "rain", still: still });

    const golden = nextGoldenText(fc);
    html += tile("sun", "Sonne",
        hhmm(d.sunset && d.sunset[0]),
        'Aufgang ' + hhmm(d.sunrise && d.sunrise[0]) + (golden ? '<br>' + golden : ' · <span style="white-space:nowrap">' + fmtDuration(d.daylight_duration && d.daylight_duration[0]) + '</span>'),
        { delay: next(), extra: sunArc(c, d), key: "sun", still: still });
    html += tilePanelHtml("rain", rainPanelHtml(fc)) + tilePanelHtml("sun", sunPanelHtml(fc), lightPhaseClass(fc));

    html += tile("plain", "Luftfeuchte",
        Math.round(c.relative_humidity_2m) + '<small>%</small>',
        'Bewölkung ' + fmtNum(c.cloud_cover, 0) + '&nbsp;%',
        { delay: next(), count: isNum(c.relative_humidity_2m) ? Math.round(c.relative_humidity_2m) : null, icon: dropIcon(c.relative_humidity_2m), still: still });

    html += tile("plain", "Luftdruck",
        fmtNum(c.pressure_msl, 0),
        'hPa · ' + (isNum(c.pressure_msl) ? (c.pressure_msl >= 1020 ? 'Hochdruck' : (c.pressure_msl <= 1005 ? 'Tiefdruck' : 'normal')) : '–'),
        { delay: next(), count: isNum(c.pressure_msl) ? Math.round(c.pressure_msl) : null, icon: gaugeIcon(c.pressure_msl), still: still });

    /* Sichtweite: nimmt den Platz der Pollen ein, wenn es keine nennenswerten gibt oder keine Luftdaten */
    const vi = visibilityInfo(fc);
    const sichtTile = function () {
        return tile("plain", "Sicht", vi.big + '<span class="word">' + vi.word + '</span>', vi.sub || null,
            { delay: next(), count: vi.count, decimals: vi.decimals, icon: FOG_ICON, key: "sicht", still: still }) +
            tilePanelHtml("sicht", sichtPanelHtml(fc));
    };

    if (air && air.current) {
        const a = air.current, al = aqiLevel(a.european_aqi);
        const xpos = isNum(a.european_aqi) ? Math.max(2, Math.min(100, a.european_aqi)) : 0;
        html += tile("plain", "Luftqualität",
            (isNum(a.european_aqi) ? Math.round(a.european_aqi) : '–') +
            (al ? '<span class="word wc-' + al.st + '">' + al.word + '</span>' : '') +
            '<div class="meter"><i class="st-' + (al ? al.st : 'none') + '" style="width:' + xpos + '%"></i></div>',
            'PM2,5 ' + fmtNum(a.pm2_5, 0) + ' · PM10 ' + fmtNum(a.pm10, 0) + ' · O₃ ' + fmtNum(a.ozone, 0) + ' µg/m³',
            { delay: next(), count: isNum(a.european_aqi) ? Math.round(a.european_aqi) : null, still: still });

        const chips = POLLEN.map(function (p) {
            const lvp = pollenLevel(a[p.key], p.thr);
            return lvp && lvp.st !== "none" ? '<span class="pchip"><i class="st-' + lvp.st + '"></i>' + p.name + ' · ' + lvp.word + '</span>' : '';
        }).join('');
        const anyPollen = POLLEN.some(function (p) { return isNum(a[p.key]); });
        if (chips || !vi) {
            html += tile("plain", "Pollen",
                '<div class="pollen-chips">' + (chips || '<span class="pchip"><i class="st-none"></i>' + (anyPollen ? 'Zurzeit kein nennenswerter Pollenflug' : 'Pollendaten nur in Europa') + '</span>') + '</div>', null,
                { delay: next(), still: still });
        } else {
            html += sichtTile();
        }
    } else if (vi) {
        html += sichtTile();
    }

    box.innerHTML = html;
    if (opts.swap) seedTileCounts(box, tileCounts);
    tileCounts = null;
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

/* Spanne der Tageshöchstwerte über die Modelle; wie beim Regen als Einigkeit formuliert */
function tempSpanText(dayWord, maxes) {
    const v = maxes.filter(isNum).map(function (x) { return Math.round(x); });
    if (v.length < 2) return "";
    const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
    if (hi - lo <= 1) {
        const sorted = v.slice().sort(function (a, b) { return a - b; });
        return "Höchstwert " + dayWord + " um " + tmp(quantile(sorted, 0.5)) + "°, da sind sich die Modelle einig.";
    }
    return "Höchstwert " + dayWord + " " + tmp(lo) + " bis " + tmp(hi) + "°, die Modelle liegen " + tdiff(hi - lo) + "° auseinander.";
}

/* Tageshöchstwerte je Modell aus den Tageswerten der Modellabfrage (Index 1 = morgen) */
function modelMaxTemps(md, dayIndex) {
    if (!md || !md.daily) return [];
    return MODELS.map(function (m) {
        const s = md.daily["temperature_2m_max_" + m.id];
        return Array.isArray(s) && isNum(s[dayIndex]) ? s[dayIndex] : null;
    });
}

let hlModel = "icon_d2";

function fmtPt(x, y) { return x.toFixed(1) + "," + y.toFixed(1); }

/* Kurvenbild: zwei Tafeln heute/morgen, gemeinsame y-Skala, Band nur am ICON-D2 */
function modelChartSvg(models, bands, nowHour, hl) {
    /* Breite 340: rechts von jeder Tafel bleibt Platz für die Endwert-Beschriftung */
    const panels = [{ key: "today", x0: 10, label: "Heute" }, { key: "tomorrow", x0: 180, label: "Morgen" }];
    const W = 125, Y0 = 80, Y1 = 14;
    let maxV = 1;
    models.forEach(function (m) { maxV = Math.max(maxV, m.today, m.tomorrow); });
    panels.forEach(function (p) { if (bands[p.key]) maxV = Math.max(maxV, bands[p.key].hi[24]); });
    const sx = function (p, h) { return p.x0 + h / 24 * W; };
    const sy = function (v) { return Y0 - v / maxV * (Y0 - Y1); };
    let out = '<svg class="mchart" viewBox="0 0 340 96" aria-hidden="true">';
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
/* Vorleser-Satz je Modell-Chip: ein Element statt vier loser Texte („ICON-D2: heute 0,2 mm, morgen 8,8 mm“) */
function modelChipLabel(m) {
    const f = function (v) { return isNum(v) ? fmtMm(v) + " mm" : "keine Angabe"; };
    return m.name + ": heute " + f(m.today) + ", morgen " + f(m.tomorrow);
}

/* Hervorhebung und Druckzustand der Chips gemeinsam setzen */
function markModelChips(chips, id) {
    chips.forEach(function (el) {
        const mine = el.getAttribute("data-model") === id;
        el.classList.toggle("hl", mine);
        el.setAttribute("aria-pressed", mine ? "true" : "false");
    });
}

function highlightModel(id) {
    hlModel = id;
    const box = D("models");
    if (!box || !box.querySelectorAll) return;
    Array.prototype.slice.call(box.querySelectorAll(".ml")).forEach(function (el) {
        el.classList.toggle("hl", !!(el.classList && el.classList.contains("m-" + id)));
    });
    markModelChips(Array.prototype.slice.call(box.querySelectorAll(".mchip")), id);
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
    const tspan = tempSpanText("morgen", modelMaxTemps(md, 1));
    if (tspan) agree += (agree ? " " : "") + '<span class="tspan">' + tspan + '</span>';

    const num = function (v) { return isNum(v) ? '<span data-count="' + Number(v.toFixed(1)) + '" data-decimals="' + (v >= 0.05 && v < 10 ? 1 : 0) + '">' + fmtMm(v) + '</span>' : '–'; };
    const chips = models.map(function (m, i) {
        return '<button type="button" class="mchip' + (m.id === hl ? ' hl' : '') + '" data-model="' + m.id + '" aria-pressed="' + (m.id === hl ? 'true' : 'false') + '" aria-label="' + modelChipLabel(m) + '" style="animation-delay:' + dl(2.0 + i * 0.07) + 's"><span class="k">' + m.name + '</span><span class="v">' + num(m.today) + ' / ' + num(m.tomorrow) + '</span></button>';
    }).join('');

    /* Ensemble-Zeile mit Zählwerten, damit nichts wie eine Trefferwahrscheinlichkeit wirkt */
    let ensNote = "";
    const b = bands.tomorrow;
    if (b && b.sums.length >= 3) {
        const wet = b.sums.filter(function (v) { return v >= 0.1; }).length;
        ensNote = 'ICON-D2-Ensemble, morgen: ' + fmtMm(b.sums[0]) + ' bis ' + fmtMm(b.sums[b.sums.length - 1]) + ' mm, Median ' + fmtMm(quantile(b.sums, 0.5)) + ' mm · ' + wet + ' von ' + b.sums.length + ' Läufen mit Regen.';
    }

    const span = function (arr) {
        const v = arr.filter(isNum);
        if (!v.length) return '–';
        const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
        return lo === hi ? fmtMm(lo) + ' mm' : fmtMm(lo) + ' bis ' + fmtMm(hi) + ' mm';
    };
    const alt = '<div class="vh">Regensummen je Modell als Kurven: heute ' + span(models.map(function (m) { return m.today; })) + ', morgen ' + span(models.map(function (m) { return m.tomorrow; })) + '.</div>';
    box.innerHTML = (agree ? '<div class="agree">' + agree + '</div>' : '') + alt +
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
    const now = new Date(nowMs());
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
    /* Abgelaufene NINA-Meldungen fallen weg (zweite Sicherung neben dem Worker); ohne expires bleibt die Meldung */
    const live = (nina || []).filter(function (w) {
        const t = w && w.expires ? Date.parse(w.expires) : NaN;
        return isNaN(t) || t >= nowMs();
    });
    const all = (dwd || []).map(function (w) { return Object.assign({ source: "dwd" }, w); }).concat(live);
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
    if (D("highlightsField") && D("highlightsField").classList) D("highlightsField").classList.add("hidden");
    lastTemp = null;
    lastCounts = {};
    lastData = null;
    previewIdx = null;
    previewTime = null;
    openTile = null;
    updatePreviewBar();
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
/* Aktiven Bereich in der Tab-Leiste markieren: Klasse für die Pille, aria-current für Vorleser */
function markTabs(links, active) {
    links.forEach(function (l) {
        const on = l === active;
        l.classList.toggle("on", on);
        if (on) l.setAttribute("aria-current", "page");
        else if (l.removeAttribute) l.removeAttribute("aria-current");
    });
}

function moveTabInk() {
    const nav = document.querySelector ? document.querySelector(".tabs nav") : null;
    if (!nav || !nav.querySelector) return;
    const ink = nav.querySelector(".tab-ink"), on = nav.querySelector("a.on");
    if (!ink || !on || typeof on.offsetLeft !== "number" || !on.offsetWidth) return;
    ink.style.left = on.offsetLeft + "px";
    ink.style.width = on.offsetWidth + "px";
    nav.classList.add("ink-ready");
}

let lastRenderedLoc = null;
/* ------------------------------------------------------------------ *
 * Woher kommt das? Quelle, Modell, Gitterpunkt, Rechenwege und Stand
 * ------------------------------------------------------------------ */

/* Welcher Abschnitt zu welchem Instrument-Feld gehört */
const SRC_SECTION = { wind: "src-wind", rain: "src-regen", sun: "src-sonne", sicht: "src-sicht", highlights: "src-highlights" };

function fmtCoord(lat, lon) {
    return fmtNum(Math.abs(lat), 2) + "° " + (lat >= 0 ? "N" : "S") + ", " + fmtNum(Math.abs(lon), 2) + "° " + (lon >= 0 ? "O" : "W");
}
function fmtKm(km) { return km < 10 ? fmtNum(km, 1) : String(Math.round(km)); }

function srcSection(id, title, items) {
    return '<section class="src-sec" id="' + id + '"><h3>' + title + '</h3>' +
        items.filter(Boolean).map(function (p) { return '<p>' + p + '</p>'; }).join('') + '</section>';
}

/* Namen der Vergleichsmodelle aus MODELS: „ICON-D2, ICON-EU, … und GFS“ */
function modelListText() {
    const names = MODELS.map(function (m) { return m.name; });
    return names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " und " + names[names.length - 1];
}

/* Schwellen einer Aktivität als Satz, direkt aus der Tabelle */
function activityRule(a) {
    const lim = actLimits(a);
    const parts = [
        "gefühlt " + (lim.feelMax >= 60 ? "ab " + tmp(lim.feelMin) + "°" : tmp(lim.feelMin) + " bis " + tmp(lim.feelMax) + "°"),
        "Regenrisiko unter " + lim.prob + " %",
        isNum(lim.wind) ? "Wind unter " + wnd(lim.wind) + " " + wunit() : null,
        "Böen unter " + wnd(lim.gust) + " " + wunit(),
        a.light === "dusk" ? "bis zur Dämmerung" : (a.light === "day" ? "bei Tageslicht" : "auch nachts"),
        "mindestens " + a.minH + (a.minH === 1 ? " Stunde" : " Stunden") + " am Stück"
    ];
    return a.name + ": " + parts.filter(Boolean).join(", ") + ".";
}

/* Das ganze Blatt aus den vorhandenen Daten; fehlende Quellen lassen nur ihren Satz weg */
function sourceSheetHtml(data, air, meta, loc, loadedIso, cached, now) {
    const fc = data.fc, c = fc.current, h = fc.hourly, tz = fc.timezone;
    const gi = hourlyWindow(fc, 1).start;
    const hasLoc = loc && isNum(loc.lat) && isNum(loc.lon);
    const distTo = function (lat, lon) { return hasLoc ? fmtKm(distanceKm(loc.lat, loc.lon, lat, lon)) + " km entfernt" : null; };

    const ort = [
        hasLoc ? "Gewählter Ort: " + (loc.name || "Standort") + " (" + fmtCoord(loc.lat, loc.lon) + ")." : null,
        isNum(fc.latitude) && isNum(fc.longitude)
            ? "Modellpunkt der Vorhersage: " + [fmtCoord(fc.latitude, fc.longitude), distTo(fc.latitude, fc.longitude), isNum(fc.elevation) ? Math.round(fc.elevation) + " m Höhe" : null].filter(Boolean).join(", ") +
              ". Das Modell rechnet für diesen Punkt, nicht für die Adresse."
            : null,
        air && isNum(air.latitude) && isNum(air.longitude) ? "Luft und Pollen: " + [hasLoc ? "Punkt " + distTo(air.latitude, air.longitude) : null, "Raster etwa 11 km"].filter(Boolean).join(", ") + "." : null
    ];
    const mod = [
        "Vorhersage: bestes Modell je Ort über Open-Meteo, in Mitteleuropa DWD ICON (D2 für die ersten 48 Stunden, danach ICON-EU und ICON global). Nowcast: 15-Minuten-Werte desselben Modells.",
        meta && isNum(meta.run)
            ? "ICON-D2-Lauf von " + stampAt(meta.run * 1000, now, tz) + (isNum(meta.available) ? ", verfügbar seit " + stampAt(meta.available * 1000, now, tz) : "") +
              ". Neuer Lauf alle " + Math.round((isNum(meta.interval) ? meta.interval : 10800) / 3600) + " Stunden."
            : null,
        "Regenrisiko: ICON-D2-Ensemble mit 20 Läufen. Modellvergleich: " + modelListText() + ", jeweils eigener Lauf.",
        meta && Array.isArray(meta.models) && meta.models.length > 1
            ? "Läufe der Vergleichsmodelle: " + meta.models.filter(function (m) { return m.id !== "icon_d2"; }).map(function (m) { return m.name + " " + stampAt(m.run * 1000, now, tz); }).join(", ") + "."
            : null,
        loadedIso ? freshnessText(loadedIso, cached, now, tz) + "." : null
    ];
    const y = yesterdayTemp(fc);
    const temp = [
        "Gefühlt: gefühlte Temperatur nach Open-Meteo aus Temperatur, Wind, Luftfeuchte und Sonnenstrahlung. Hoch und Tief: Tageswerte des Modells.",
        "Vergleich mit gestern: Modellwert von gestern zur selben Uhrzeit, zwischen den Nachbarstunden gemittelt, keine Messung." +
            (y !== null && isNum(c.temperature_2m) ? " Gestern " + tmp(y, 1) + "°, jetzt " + tmp(c.temperature_2m, 1) + "°." : "")
    ];
    const t = h.time[gi];
    const st = data.members && data.members.length && data.ensIndex && data.ensIndex[t] !== undefined ? ensembleStats(data.members, data.ensIndex[t]) : null;
    const regen = [
        "Regenrisiko je Stunde: Anteil der Ensemble-Läufe mit mindestens 0,1 mm" +
            (st ? ". Jetzt " + st.wet + " von " + st.n + " Läufen, also " + st.prob + " %." : "; ohne Ensemble der Modellwert."),
        "Regenrat: Summe und stärkste Viertelstunde der nächsten 4 Stunden. Unter 0,5 mm nur Tropfen, unter 2 mm leichter Regen, sonst Schirm. Liegt das Risiko der Stunden unter 30 %, wird der Rat vorsichtiger.",
        "Trockene Phasen und Regenverlauf: 15-Minuten-Werte des Modells. Blaue Felder ab 25 % Risiko."
    ];
    const wind = ["Wind und Böen in 10 m Höhe aus dem Modell, Stundenmittel und Spitze. Der Pfeil zeigt, wohin der Wind weht. Windig ab 20 km/h; Böen von 60 km/h füllen eine Spalte ganz."];
    const sonne = ["Auf- und Untergang von Open-Meteo. Goldene Stunde: Sonne zwischen 4° unter und 6° über dem Horizont, blaue Stunde zwischen 8° und 4° darunter, aus dem berechneten Sonnenstand. Nachtpalette, sobald die Sonne tiefer als 8° steht. UV-Index aus dem Modell, Mondphase berechnet."];
    const spread = h.temperature_2m && h.dew_point_2m && isNum(h.temperature_2m[gi]) && isNum(h.dew_point_2m[gi]) ? h.temperature_2m[gi] - h.dew_point_2m[gi] : null;
    const sicht = [
        "Sichtweite und Taupunkt aus dem Modell. Nebelrisiko: Punkte für Taupunktabstand bis 1,5° (zwei) oder bis 3° (einer), Wind bis 8 km/h, Bewölkung bis 30 %; Abzug bei Wind über 20 km/h oder Wolken ab 80 %. Drei Punkte hoch, zwei mittel, sonst gering. Sicht unter 1 km zählt immer als hoch, unter 4 km mindestens als mittel.",
        spread !== null && h.wind_speed_10m && isNum(h.wind_speed_10m[gi]) && h.cloud_cover && isNum(h.cloud_cover[gi])
            ? "Jetzt: Taupunktabstand " + tdiff(spread, 1) + "°, Wind " + wnd(h.wind_speed_10m[gi]) + " " + wunit() + ", Bewölkung " + Math.round(h.cloud_cover[gi]) + " %, Risiko " + fogRiskAt(fc, gi) + "."
            : null
    ];
    const raus = ["Vorschläge aus festen Schwellen je Stunde; die grüne Spur zeigt passende Stunden."].concat(ACTIVITIES.map(activityRule));
    const hl = [
        "Nächste Tage: Regeln auf den Tageswerten von morgen bis in sieben Tagen. Temperatursprung ab 5° zum Vortag, erster Frost ab 0° (nur wenn heute und gestern frostfrei), Sturm ab 60 km/h Böen und Sturmböen ab 75, nasser Tag ab 10 mm (Risiko ab 70 % genannt), Trockenphase ab drei Tagen unter 0,5 mm und 30 %, sonnigster Tag ab 7 Stunden und 70 % des Tageslichts, Schnee, Gewitter und Nebel aus dem Wettercode, Hitze ab 30°.",
        "Pro Tag zählt nur das Wichtigste, es erscheinen höchstens drei Zeilen nach Priorität, angezeigt nach Tagen."
    ];
    const luft = ["Luftqualität und Pollen: CAMS Europa (Copernicus) über Open-Meteo, Index nach der europäischen Skala. Außerhalb der Pollensaison zeigt die Kachel die Sicht."];
    const warn = ["Warnungen: amtliche Warnungen des DWD für die Gemeinde (GeoServer, CC BY 4.0) und Meldungen aus NINA. Radar: DWD RADOLAN RV, Beobachtung und kurze Vorhersage, Karte OpenFreeMap (OpenMapTiles-Schema, Daten OpenStreetMap)."];

    return srcSection("src-ort", "Ort und Gitterpunkt", ort) +
        srcSection("src-modelle", "Modelle und Stand", mod) +
        srcSection("src-temp", "Temperatur", temp) +
        srcSection("src-regen", "Regen", regen) +
        srcSection("src-wind", "Wind", wind) +
        srcSection("src-sonne", "Sonne und Licht", sonne) +
        srcSection("src-sicht", "Sicht und Nebel", sicht) +
        srcSection("src-rausgehen", "Rausgehen", raus) +
        srcSection("src-highlights", "Nächste Tage", hl) +
        srcSection("src-luft", "Luft und Pollen", luft) +
        srcSection("src-warn", "Warnungen und Radar", warn);
}

/* Blatt öffnen, wahlweise bei einem Abschnitt (Schlüssel eines Feldes oder Abschnitts-ID) */
function openSource(section, trigger) {
    if (!lastData || !D("src")) return;
    lastSrcTrigger = trigger || null;
    const id = section ? (SRC_SECTION[section] || section) : "";
    const body = D("srcBody");
    body.innerHTML = sourceSheetHtml(lastData, lastAir, lastMeta, lastLoc, loadedAt, loadedCached, nowMs());
    D("src").setAttribute("data-section", id);
    document.body.classList.add("src-open");
    if (D("freshSrc")) D("freshSrc").setAttribute("aria-expanded", "true");
    /* Zum Abschnitt springen und ihn hervorheben; ohne Layout (Harness) bleibt das Blatt oben */
    const sec = id && body.querySelector ? body.querySelector("#" + id) : null;
    if (sec && sec.classList) sec.classList.add("target");
    body.scrollTop = sec && typeof sec.offsetTop === "number" ? Math.max(0, sec.offsetTop - 6) : 0;
    setTimeout(function () { if (D("srcClose")) D("srcClose").focus(); }, 300);
}

function closeSource() {
    document.body.classList.remove("src-open");
    if (D("freshSrc")) D("freshSrc").setAttribute("aria-expanded", "false");
    const back = lastSrcTrigger && lastSrcTrigger.focus ? lastSrcTrigger : D("freshSrc");
    if (back && back.focus) back.focus();
    lastSrcTrigger = null;
}

/* ------------------------------------------------------------------ *
 * Einstellungen: Blatt mit Chip-Gruppen; jede Wahl wird sofort gespeichert und angewandt
 * ------------------------------------------------------------------ */
const SETTING_GROUPS = [
    { title: "Einheiten", rows: [
        { key: "temp", label: "Temperatur", opts: [["C", "°C"], ["F", "°F"]] },
        { key: "wind", label: "Wind", opts: [["kmh", "km/h"], ["ms", "m/s"], ["kn", "kn"], ["bft", "Bft"]] }
    ] },
    { title: "Beim Start", rows: [
        { key: "startView", label: "Ansicht", opts: [["last", "Zuletzt gewählte"], ["overview", "Überblick"], ["rain", "Regen"], ["wind", "Wind"], ["warm", "Wärme"], ["light", "Licht"]] }
    ] },
    { title: "Bewegung", rows: [
        { key: "motion", label: "Animationen", opts: [["system", "Wie das System"], ["reduce", "Reduziert"]] }
    ] },
    { title: "Farbschema", rows: [
        { key: "scheme", label: "Palette", opts: [["bento", "Bento (Standard)"], ["nil", "Nil (Sanzo Wada)"]], note: "Nil: nilblauer Grund, weiße Karten, Indigo-Schrift, Farben aus Sanzo Wadas Farbkombinationen; Tag und Nacht." }
    ] },
    { title: "Rausgehen", rows: [
        { key: "rainTol", label: "Regen", opts: [[-10, "Streng"], [0, "Normal"], [10, "Locker"]], note: "Verschiebt die Regenrisiko-Grenze um 10 Punkte." },
        { key: "feelAdj", label: "Kälte", opts: [[2, "Empfindlich"], [0, "Normal"], [-2, "Robust"]], note: "Verschiebt die untere Wohlfühltemperatur um 2°." }
    ] }
];
const NUMERIC_SETTINGS = ["rainTol", "feelAdj"];

function settingRowHtml(r) {
    return '<div class="set-row"><span class="set-lbl">' + r.label + '</span><div class="seg" role="group" aria-label="' + r.label + '">' +
        r.opts.map(function (o) {
            return '<button type="button" class="set-chip" data-key="' + r.key + '" data-val="' + o[0] + '" aria-pressed="' + (settings[r.key] === o[0] ? 'true' : 'false') + '">' + o[1] + '</button>';
        }).join('') + '</div>' + (r.note ? '<div class="set-note">' + r.note + '</div>' : '') + '</div>';
}

function settingsHtml() {
    return SETTING_GROUPS.map(function (g) {
        return '<section class="set-sec"><h3>' + g.title + '</h3>' + g.rows.map(settingRowHtml).join('') + '</section>';
    }).join('') + extraSettingsHtml();
}

/* ---- Startseite anpassen: Felder umsortieren und ausblenden, Kacheln ausblenden ---- */
const LAYOUT_FIELDS = [
    { id: "insight", name: "Hinweis" }, { id: "views", name: "Ansichten" }, { id: "hoursField", name: "Nächste Stunden" },
    { id: "activityField", name: "Rausgehen" }, { id: "highlightsField", name: "Nächste Tage" }, { id: "nowcastCard", name: "Regen in 4 Stunden" }
];
const LAYOUT_TILES = [
    { id: "uv", name: "UV-Index" }, { id: "wind", name: "Wind" }, { id: "rain", name: "Regen" }, { id: "sun", name: "Sonne" },
    { id: "humidity", name: "Luftfeuchte" }, { id: "pressure", name: "Luftdruck" }, { id: "air", name: "Luftqualität" }, { id: "pollen", name: "Pollen oder Sicht" }
];

/* Reihenfolge der Felder: gespeicherte zuerst (nur bekannte), fehlende in der Vorgabe dahinter */
function layoutOrder() {
    const known = LAYOUT_FIELDS.map(function (f) { return f.id; });
    const saved = settings.order.filter(function (id) { return known.indexOf(id) >= 0; });
    return saved.concat(known.filter(function (id) { return saved.indexOf(id) < 0; }));
}

function isHidden(id) { return settings.hidden.indexOf(id) >= 0; }

/* Reihenfolge und Sichtbarkeit anwenden: Felder im DOM umhängen (wirkt auch in der Zwei-Spalten-Ansicht), Kacheln per Klasse */
function applyLayout() {
    const sec = D("sec-today");
    const order = layoutOrder();
    /* Umhängen startet die Einblend-Animation der Felder neu; darum nur, wenn die Reihenfolge im DOM abweicht.
       Die sortierbaren Felder tauschen nur untereinander die Plätze: je Lücke zwischen festen Feldern (Hero, Warnungen,
       Reise) kommen so viele Felder aus der Reihenfolge, wie dort bisher standen; die festen Felder bleiben, wo sie sind. */
    if (sec && sec.insertBefore && sec.children) {
        const kids = Array.prototype.slice.call(sec.children);
        const current = kids.map(function (c) { return c.id; }).filter(function (id) { return order.indexOf(id) >= 0; });
        if (current.join(",") !== order.join(",")) {
            let used = 0, run = 0;
            const flush = function (before) {
                for (; run > 0; run--, used++) {
                    const el = D(order[used]);
                    if (!el || el.parentNode !== sec) continue;
                    if (before) sec.insertBefore(el, before); else sec.appendChild(el);
                }
            };
            kids.forEach(function (c) { if (order.indexOf(c.id) >= 0) run++; else flush(c); });
            flush(null);
        }
    }
    order.forEach(function (id) {
        const el = D(id);
        if (el && el.classList) el.classList.toggle("user-hidden", isHidden(id));
    });
    const tiles = document.querySelectorAll ? Array.prototype.slice.call(document.querySelectorAll(".tile[data-name]")) : [];
    tiles.forEach(function (t) {
        const name = t.getAttribute("data-name"), off = isHidden(name);
        t.classList.toggle("user-hidden", off);
        const key = t.getAttribute("data-tile");
        if (key && off && openTile === key) toggleTile(key);
        const panel = key ? D("tpanel-" + key) : null;
        if (panel && panel.classList) panel.classList.toggle("user-hidden", off);
    });
}

function moveField(id, dir) {
    const order = layoutOrder(), i = order.indexOf(id), j = i + (dir === "up" ? -1 : 1);
    if (i < 0 || j < 0 || j >= order.length) return;
    order.splice(i, 1); order.splice(j, 0, id);
    setSetting("order", order);
}

function toggleHidden(id) {
    const hidden = settings.hidden.slice();
    const i = hidden.indexOf(id);
    if (i >= 0) hidden.splice(i, 1); else hidden.push(id);
    setSetting("hidden", hidden);
}

function layoutItemHtml(item, movable) {
    const on = !isHidden(item.id);
    return '<div class="set-row set-item"><span class="set-lbl">' + item.name + '</span><div class="seg">' +
        (movable ? '<button type="button" class="set-mv" data-id="' + item.id + '" data-dir="up" aria-label="' + item.name + ' nach oben">↑</button><button type="button" class="set-mv" data-id="' + item.id + '" data-dir="down" aria-label="' + item.name + ' nach unten">↓</button>' : '') +
        '<button type="button" class="set-vis" data-id="' + item.id + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + item.name + ' sichtbar">' + (on ? 'Sichtbar' : 'Ausgeblendet') + '</button></div></div>';
}

/* ---- Reise: Ort mit Zeitraum, Countdown, Wechsel in die Vorhersage ---- */
function fmtDayShort(iso) { return iso.slice(8, 10) + "." + iso.slice(5, 7) + "."; }

function tripHtml(trip, today) {
    const st = tripState(trip, today);
    if (!st || st.phase === "after") return "";
    const here = lastLoc && isNum(lastLoc.lat) && Math.abs(lastLoc.lat - trip.lat) < 0.01 && Math.abs(lastLoc.lon - trip.lon) < 0.01;
    const line = st.phase === "before"
        ? (st.days === 1 ? "Morgen geht es los." : "In " + st.days + " Tagen geht es los.")
        : (st.days === 0 ? "Heute ist der letzte Tag." : "Du bist unterwegs, noch " + st.days + (st.days === 1 ? " Tag." : " Tage."));
    return '<div class="trip-head"><b>' + trip.name + '</b><span>' + fmtDayShort(trip.from) + ' bis ' + fmtDayShort(trip.to) + '</span></div>' +
        '<div class="trip-line">' + line + '</div>' +
        (here ? '<button type="button" class="trip-btn" data-trip="home">Zurück zu meinem Standort</button>'
              : '<button type="button" class="trip-btn" data-trip="go">Wetter in ' + trip.name + ' ansehen</button>');
}

function renderTrip() {
    const field = D("tripField"), box = D("trip");
    if (!field || !box) return;
    const html = settings.trip ? tripHtml(settings.trip, localDate(new Date(nowMs()))) : "";
    if (settings.trip && !html) { settings.trip = null; saveSettings(settings); }   /* Reise vorbei */
    box.innerHTML = html;
    if (field.classList) field.classList.toggle("hidden", !html);
}

function tripSettingsHtml() {
    const t = settings.trip;
    if (!t) return '<div class="set-row"><span class="set-lbl">Reiseziel mit Zeitraum, Countdown auf der Startseite, Wechsel in die Vorhersage dort, sobald die Reise läuft.</span></div>' +
        '<div class="set-row"><button type="button" class="set-btn" id="tripPick">Reiseziel wählen</button></div>';
    return '<div class="set-row"><span class="set-lbl">' + t.name + '</span><button type="button" class="set-btn" id="tripPick">Ort ändern</button></div>' +
        '<div class="set-row"><label class="set-lbl" for="tripFrom">Von</label><input type="date" class="trip-date" id="tripFrom" data-k="from" value="' + t.from + '"></div>' +
        '<div class="set-row"><label class="set-lbl" for="tripTo">Bis</label><input type="date" class="trip-date" id="tripTo" data-k="to" value="' + t.to + '"></div>' +
        '<div class="set-row"><button type="button" class="set-btn danger" id="tripDel">Reise löschen</button></div>';
}

/* Weitere Abschnitte: Startseite, Reise (Alarm und Tagesfilm hängen sich später an) */
function extraSettingsHtml() {
    return '<section class="set-sec"><h3>Startseite</h3><div class="set-note">Reihenfolge und Sichtbarkeit der Felder, Kacheln ein- oder ausblenden.</div>' +
        layoutOrder().map(function (id) { return layoutItemHtml(LAYOUT_FIELDS.filter(function (f) { return f.id === id; })[0], true); }).join('') +
        LAYOUT_TILES.map(function (t) { return layoutItemHtml(t, false); }).join('') + '</section>' +
        '<section class="set-sec"><h3>Reise</h3>' + tripSettingsHtml() + '</section>' + moreSettingsHtml();
}
/* ---- Regen-Alarm: Push-Abonnement beim Worker, Ort wandert mit ---- */
function pushSupported() {
    return typeof window !== "undefined" && typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
function pushStandalone() {
    try { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; } catch (e) { return false; }
}
function isIos() { return typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent || ""); }

function urlBase64ToUint8Array(b64) {
    const s = String(b64).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s + "===".slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function pushBody(sub, loc) { return { subscription: sub, lat: loc.lat, lon: loc.lon, name: loc.name || "" }; }

/* Warten mit Frist: ohne aktiven Service Worker löst „ready“ nie auf, dann soll eine Meldung kommen */
function withTimeout(promise, ms, what) {
    return new Promise(function (resolve, reject) {
        const t = setTimeout(function () { reject(new Error(what || "Zeitüberschreitung")); }, ms);
        promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
}
function swReady(ms) { return withTimeout(navigator.serviceWorker.ready, ms || 6000, "kein Service Worker"); }

async function pushPost(path, body) {
    const res = await fetch(NINA_PROXY + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
}

let pushBusy = false;
async function enablePush() {
    if (!pushSupported() || pushBusy) return false;
    pushBusy = true;
    try {
        /* Ohne Ort gibt es nichts zu melden: vor dem Abonnieren prüfen, sonst bliebe ein verwaistes Abonnement zurück */
        const loc = lastLoc && isNum(lastLoc.lat) ? lastLoc : null;
        if (!loc) { announce("Noch kein Ort geladen."); return false; }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { announce("Benachrichtigungen nicht erlaubt."); return false; }
        const reg = await swReady();
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY) });
        await pushPost("/push/subscribe", pushBody(sub.toJSON(), loc));
        /* Eine vorgemerkte Abmeldung für genau dieses Abonnement würde es beim nächsten Abgleich wieder löschen */
        if (settings.pushUnsub === sub.endpoint) settings.pushUnsub = null;
        settings.push = true; settings.pushLoc = { lat: loc.lat, lon: loc.lon };
        saveSettings(settings);
        announce("Regen-Alarm eingeschaltet.");
        return true;
    } catch (e) {
        announce("Regen-Alarm konnte nicht eingeschaltet werden" + (e && e.message === "kein Service Worker" ? ": kein Service Worker aktiv, bitte die App neu öffnen." : "."));
        return false;
    } finally { pushBusy = false; renderSettings(); }
}

async function disablePush() {
    if (pushBusy) return false;
    pushBusy = true;
    let retry = false;
    try {
        if (pushSupported()) {
            const reg = await swReady();
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                /* Erreicht die Abmeldung den Worker nicht, bleibt sein Eintrag stehen: Endpunkt vormerken, syncPush holt es nach */
                try { await pushPost("/push/unsubscribe", { endpoint: sub.endpoint }); settings.pushUnsub = null; }
                catch (e) { settings.pushUnsub = sub.endpoint; retry = true; }
                await sub.unsubscribe();
            }
        }
    } catch (e) {}
    settings.push = false; settings.pushLoc = null;
    saveSettings(settings);
    announce(retry ? "Regen-Alarm ausgeschaltet. Die Abmeldung beim Worker wird beim nächsten Laden wiederholt." : "Regen-Alarm ausgeschaltet.");
    pushBusy = false;
    renderSettings();
    return true;
}

/* Nach jedem Laden: offene Abmeldung nachholen; liegt der Ort woanders als beim Abonnieren, den Worker nachziehen */
async function syncPush() {
    if (settings.pushUnsub) {
        /* Gilt die Vormerkung dem aktiven Abonnement (Alarm wieder an, Browser-Abonnement blieb stehen), nur verwerfen */
        let active = false;
        if (settings.push && pushSupported()) {
            try { const cur = await (await swReady()).pushManager.getSubscription(); active = !!cur && cur.endpoint === settings.pushUnsub; } catch (e) {}
        }
        try { if (!active) await pushPost("/push/unsubscribe", { endpoint: settings.pushUnsub }); settings.pushUnsub = null; saveSettings(settings); } catch (e) {}
    }
    if (!settings.push || !pushSupported() || !lastLoc || !isNum(lastLoc.lat)) return;
    const pl = settings.pushLoc;
    if (pl && Math.abs(pl.lat - lastLoc.lat) < 0.01 && Math.abs(pl.lon - lastLoc.lon) < 0.01) return;
    try {
        const reg = await swReady();
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        await pushPost("/push/subscribe", pushBody(sub.toJSON(), lastLoc));
        settings.pushLoc = { lat: lastLoc.lat, lon: lastLoc.lon };
        saveSettings(settings);
    } catch (e) {
        /* Der Worker begrenzt Anmeldungen je IP; ein 429 bliebe sonst unsichtbar und käme bei jedem Laden wieder */
        if (e && e.message === "HTTP 429") console.warn("Regen-Alarm: Ort nicht nachgezogen, zu viele Anmeldungen von dieser Adresse (429).");
    }
}

/* Probenachricht: der Worker schickt sofort eine Testmeldung an dieses Abonnement */
let pushTestMsg = "";
async function testPush() {
    const say = function (t) { pushTestMsg = t; const el = D("pushTestMsg"); if (el) el.textContent = t; announce(t); };
    if (!settings.push) return false;
    if (!pushSupported()) { say("Hier nicht möglich, bitte in der Homescreen-App."); return false; }
    try {
        let reg;
        try { reg = await swReady(); } catch (e) { say("Kein Service Worker aktiv. Bitte die App schließen und neu öffnen."); return false; }
        const sub = await reg.pushManager.getSubscription();
        if (!sub) { say("Kein Abonnement gefunden. Bitte den Regen-Alarm aus- und wieder einschalten."); return false; }
        say("Probenachricht wird gesendet …");
        const res = await fetch(NINA_PROXY + "/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        let j = {};
        try { j = await res.json(); } catch (e) { j = {}; }
        say(res.ok ? "Probenachricht unterwegs, sie erscheint gleich als Mitteilung." : (j.error || "Versand fehlgeschlagen (HTTP " + res.status + ")."));
        return res.ok;
    } catch (e) { say("Versand fehlgeschlagen, keine Verbindung zum Worker."); return false; }
}

function pushSettingsHtml() {
    const note = '<div class="set-note">Prüft alle 15 Minuten die Vorhersage für deinen Ort und meldet Regen, der in der nächsten Stunde beginnt. Läuft über den eigenen Worker, kostenlos.</div>';
    /* Probenachricht nur, wo sie auch ankommen kann: Push unterstützt und Alarm an */
    const test = settings.push && pushSupported() ? '<div class="set-row"><button type="button" class="set-btn" id="pushTest">Probenachricht senden</button></div><div class="set-note" id="pushTestMsg">' + pushTestMsg + '</div>' : '';
    if (!pushSupported()) {
        const why = isIos() && !pushStandalone() ? "Auf dem iPhone geht das nur als Homescreen-App: Teilen, „Zum Home-Bildschirm“, dann hier einschalten." : "Dein Browser unterstützt keine Push-Nachrichten.";
        return '<div class="set-row"><span class="set-lbl">' + why + '</span></div>' + note;
    }
    return '<div class="set-row"><span class="set-lbl">Benachrichtigung</span><div class="seg" role="group" aria-label="Regen-Alarm">' +
        '<button type="button" class="set-chip" data-key="push" data-val="0" aria-pressed="' + (settings.push ? 'false' : 'true') + '">Aus</button>' +
        '<button type="button" class="set-chip" data-key="push" data-val="1" aria-pressed="' + (settings.push ? 'true' : 'false') + '">An</button></div></div>' + note + test;
}

function moreSettingsHtml() {
    return '<section class="set-sec"><h3>Regen-Alarm</h3>' + pushSettingsHtml() + '</section>' + filmSettingsHtml() + feedbackSettingsHtml();
}

function feedbackSettingsHtml() {
    return '<section class="set-sec"><h3>Rückmeldung</h3><div class="set-note">Fehler, Idee oder Lob an den Entwickler, ohne Konto. Mitgeschickt werden nur Version, Gerät und Browser, kein Ort.</div>' +
        '<div class="set-row"><button type="button" class="set-btn" id="fbOpen">Rückmeldung schreiben</button></div></section>';
}
/* ------------------------------------------------------------------ *
 * Tagesfilm: zehn Sekunden aus den Tageswerten, gezeichnet auf einer Zeichenfläche (1080 × 1920),
 * morgens als Begrüßung, auf Wunsch als Video aufgenommen und geteilt. Alles auf dem Gerät.
 * ------------------------------------------------------------------ */
const FILM_LEN = 10;
let filmRaf = null, filmStart = 0, filmScene0 = null, filmRecorder = null;

function fmtLongDate(iso) {
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
}

/* Daten des Films aus Vorhersage und Ort; reine Funktion, damit sie sich prüfen lässt */
function filmScene(fc, loc) {
    const d = fc.daily, h = fc.hourly, today = dayOf(fc.current.time);
    const idx = [];
    h.time.forEach(function (t, i) { if (dayOf(t) === today) idx.push(i); });
    const temps = idx.map(function (i) { return isNum(h.temperature_2m[i]) ? h.temperature_2m[i] : null; });
    const rain = idx.map(function (i) { return h.precipitation && isNum(h.precipitation[i]) ? h.precipitation[i] : 0; });
    const rainTotal = rain.reduce(function (a, b) { return a + b; }, 0);
    const hl = pickHighlights(dayHighlights(fc), 1)[0] || null;
    return {
        place: loc && loc.name ? loc.name : "",
        dateLabel: longWeekday(today) + ", " + fmtLongDate(today),
        temps: temps, rain: rain, rainTotal: rainTotal,
        rise: minutesOf(d && d.sunrise ? d.sunrise[0] : null), set: minutesOf(d && d.sunset ? d.sunset[0] : null), nowMin: minutesOf(fc.current.time),
        temp: fc.current.temperature_2m, desc: wmo(fc.current.weather_code)[1],
        hi: d && isNum(d.temperature_2m_max[0]) ? d.temperature_2m_max[0] : null, lo: d && isNum(d.temperature_2m_min[0]) ? d.temperature_2m_min[0] : null,
        riseLabel: d && d.sunrise ? hhmm(d.sunrise[0]) : "", setLabel: d && d.sunset ? hhmm(d.sunset[0]) : "",
        outro: hl ? hlLabel(fc, hl) + ": " + hl.text : "Schönen Tag!"
    };
}

/* Zeitplan: Anteile der Szenen zum Zeitpunkt t (Sekunden), weich beschleunigt */
function filmTimeline(t) {
    const e = function (a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); };
    const ease = function (x) { return 1 - Math.pow(1 - x, 3); };
    return { title: ease(e(0.2, 1.2)), arc: ease(e(1.0, 4.5)), temp: ease(e(3.0, 6.5)), count: ease(e(3.5, 6.0)), rain: ease(e(6.0, 8.0)), outro: ease(e(8.3, 9.3)), done: t >= FILM_LEN };
}

/* Farben des Films aus der aktuellen Palette (Hero-Farbe, Tinte, Karte) */
function filmColors() {
    const cs = typeof getComputedStyle === "function" && document.body ? getComputedStyle(document.body) : null;
    const v = function (name, fb) { const x = cs ? cs.getPropertyValue(name).trim() : ""; return x || fb; };
    return { hero: v("--hero", "#F6D35B"), ink: v("--ink", "#1E1B2E"), card: v("--card", "#FFFFFF"), ink2: v("--ink-2", "#6B6685"), rain: v("--rain-ink", "#3A4A6B"), soft: v("--soft", "#ECEAF4") };
}

/* Ein Bild zeichnen: 1080 × 1920, Szenen überlagern sich weich */
function filmFrame(ctx, sc, t, col) {
    const W = 1080, H = 1920, tl = filmTimeline(t);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = col.hero; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const font = function (px, w) { ctx.font = (w || 700) + " " + px + "px -apple-system, 'Sora', system-ui, sans-serif"; };
    /* Titel */
    ctx.globalAlpha = tl.title; ctx.fillStyle = col.ink;
    font(78); ctx.fillText(sc.place || "Wetter", W / 2, 220 - (1 - tl.title) * 20);
    font(44, 600); ctx.fillText(sc.dateLabel, W / 2, 300 - (1 - tl.title) * 20);
    /* Sonnenbogen */
    if (tl.arc > 0) {
        ctx.globalAlpha = Math.min(1, tl.arc * 2);
        const cx = 540, cy = 860, r = 330;
        ctx.lineWidth = 10; ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(30,27,46,0.18)";
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); ctx.stroke();
        let p = 0;
        if (isNum(sc.rise) && isNum(sc.set) && sc.set > sc.rise && isNum(sc.nowMin)) p = Math.max(0, Math.min(1, (sc.nowMin - sc.rise) / (sc.set - sc.rise)));
        const drawn = p * tl.arc;
        ctx.strokeStyle = col.ink;
        if (drawn > 0) { ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + drawn * Math.PI); ctx.stroke(); }
        const a = Math.PI + drawn * Math.PI, sx = cx + r * Math.cos(a), sy = cy + r * Math.sin(a);
        ctx.fillStyle = "#F6D35B"; ctx.strokeStyle = col.ink; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(sx, sy, 26, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col.ink; font(36, 600);
        ctx.fillText(sc.riseLabel, cx - r, cy + 60); ctx.fillText(sc.setLabel, cx + r, cy + 60);
    }
    /* Temperaturkurve des Tages */
    const tv = sc.temps.filter(isNum);
    if (tl.temp > 0 && tv.length > 1) {
        ctx.globalAlpha = 1;
        const x0 = 120, x1 = 960, y0 = 1010, y1 = 1230, n = sc.temps.length;
        const tmin = Math.min.apply(null, tv), tmax = Math.max.apply(null, tv), span = Math.max(1, tmax - tmin);
        const upto = Math.max(1, Math.round(n * tl.temp));
        ctx.strokeStyle = col.ink; ctx.lineWidth = 8; ctx.lineJoin = "round"; ctx.beginPath();
        let started = false;
        for (let i = 0; i < upto; i++) {
            if (!isNum(sc.temps[i])) continue;
            const x = x0 + (x1 - x0) * i / (n - 1), y = y1 - (sc.temps[i] - tmin) / span * (y1 - y0);
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = col.ink2; font(30, 600);
        ctx.fillText("0", x0, y1 + 40); ctx.fillText("12", (x0 + x1) / 2, y1 + 40); ctx.fillText("24 Uhr", x1, y1 + 40);
    }
    /* Große Zahl zählt von 0 auf den Wert der Zielskala hoch (erst umrechnen, dann anteilig), Beschreibung darunter */
    if (tl.count > 0 && isNum(sc.temp)) {
        ctx.globalAlpha = 1; ctx.fillStyle = col.ink;
        font(220); ctx.fillText(Math.round(Number(tmp(sc.temp)) * tl.count) + "°", W / 2, 1440);
        font(44, 600); ctx.fillText(sc.desc, W / 2, 1565);
    }
    /* Regenbalken */
    if (tl.rain > 0) {
        ctx.globalAlpha = tl.rain;
        const n = sc.rain.length, x0 = 120, x1 = 960, base = 1740, maxMm = Math.max(0.5, Math.max.apply(null, sc.rain));
        ctx.fillStyle = col.rain;
        for (let i = 0; i < n; i++) {
            const v = sc.rain[i]; if (!(v > 0)) continue;
            const bw = (x1 - x0) / n, x = x0 + bw * i + 2, hgt = Math.max(6, v / maxMm * 90 * tl.rain);
            ctx.fillRect(x, base - hgt, bw - 4, hgt);
        }
        ctx.fillStyle = col.ink; font(38, 600);
        ctx.fillText(sc.rainTotal >= 0.1 ? "Regen heute " + fmtMm(sc.rainTotal) + " mm" : "Heute trocken", W / 2, 1650);
    }
    /* Abschluss: Hoch und Tief, ein Satz */
    if (tl.outro > 0) {
        ctx.globalAlpha = tl.outro; ctx.fillStyle = col.ink; font(40, 600);
        const chips = (isNum(sc.hi) ? "Hoch " + tmp(sc.hi) + "°" : "") + (isNum(sc.lo) ? "   Tief " + tmp(sc.lo) + "°" : "");
        ctx.fillText(chips, W / 2, 1810);
        font(34, 600); ctx.fillStyle = col.ink2;
        ctx.fillText(sc.outro, W / 2, 1870);
    }
    ctx.globalAlpha = 1;
}

function filmCanvasCtx() {
    const c = D("filmCanvas");
    return c && c.getContext ? c.getContext("2d") : null;
}

function filmLoop() {
    const ctx = filmCanvasCtx();
    if (!ctx || !filmScene0) return;
    const t = (Date.now() - filmStart) / 1000;
    filmFrame(ctx, filmScene0, Math.min(t, FILM_LEN), filmColors());
    if (t < FILM_LEN + 0.5) filmRaf = requestAnimationFrame(filmLoop);
}

/* Film öffnen und abspielen; false, wenn keine Zeichenfläche da ist (Harness) oder keine Daten */
function openFilm() {
    const ctx = filmCanvasCtx(), box = D("film");
    if (!ctx || !box || !lastData) return false;
    filmScene0 = filmScene(lastData.fc, lastLoc);
    box.classList.remove("hidden");
    if (D("filmStatus")) D("filmStatus").textContent = "";
    if (D("filmShare")) D("filmShare").disabled = !filmCanRecord();
    filmStart = Date.now();
    if (filmRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(filmRaf);
    filmLoop();
    announce("Tagesfilm läuft.");
    setTimeout(function () { if (D("filmClose")) D("filmClose").focus(); }, 300);
    return true;
}

function closeFilm() {
    const box = D("film");
    if (box && box.classList) box.classList.add("hidden");
    if (filmRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(filmRaf);
    filmRaf = null;
    if (filmRecorder && filmRecorder.state === "recording") { try { filmRecorder.stop(); } catch (e) {} }
    filmRecorder = null;
    if (D("settingsBtn") && D("settingsBtn").focus) D("settingsBtn").focus();
}

/* Morgens als Begrüßung: einmal am Tag beim ersten Laden, nicht bei reduzierter Bewegung oder Vorschau */
function maybeAutoFilm() {
    const today = localDate(new Date(nowMs()));
    if (!settings.dayfilm || settings.filmShown === today) return false;
    if (settings.motion === "reduce" || (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return false;
    if (typeof window !== "undefined" && window.PREVIEW_LOC) return false;
    /* Der Tag gilt erst als gezeigt, wenn der Film wirklich läuft */
    if (!openFilm()) return false;
    settings.filmShown = today;
    saveSettings(settings);
    return true;
}

/* Aufnahme: Safari liefert MP4, andere WebM; null, wenn der Browser nicht aufnehmen kann */
function filmMime(isSupported) {
    const ok = isSupported || (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported ? function (m) { return MediaRecorder.isTypeSupported(m); } : null);
    if (!ok) return null;
    const list = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    for (let i = 0; i < list.length; i++) if (ok(list[i])) return list[i];
    return null;
}
function filmCanRecord() {
    const c = D("filmCanvas");
    return !!(c && c.captureStream && typeof MediaRecorder !== "undefined" && filmMime());
}

/* Film von vorn abspielen und dabei aufnehmen, dann teilen oder herunterladen */
function shareFilm() {
    const c = D("filmCanvas"), status = D("filmStatus");
    const mime = filmMime();
    if (!c || !c.captureStream || !mime || filmRecorder) return false;
    const stream = c.captureStream(30), chunks = [];
    let rec;
    try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 }); } catch (e) { if (status) status.textContent = "Aufnahme nicht möglich."; return false; }
    filmRecorder = rec;
    rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = function () {
        filmRecorder = null;
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        const ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
        const blob = new Blob(chunks, { type: mime.split(";")[0] });
        const file = typeof File === "function" ? new File([blob], "tagesfilm." + ext, { type: blob.type }) : null;
        if (status) status.textContent = "";
        if (D("filmShare")) D("filmShare").disabled = false;
        if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
            navigator.share({ files: [file], title: "Tagesfilm" }).catch(function () {});
        } else {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob); a.download = "tagesfilm." + ext;
            document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        }
        window.__lastFilm = { size: blob.size, type: blob.type };
    };
    if (D("filmShare")) D("filmShare").disabled = true;
    if (status) status.textContent = "Aufnahme läuft, zehn Sekunden …";
    filmStart = Date.now();
    if (filmRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(filmRaf);
    filmLoop();
    rec.start(250);
    setTimeout(function () { if (rec.state === "recording") rec.stop(); }, FILM_LEN * 1000 + 300);
    return true;
}

/* ------------------------------------------------------------------ *
 * Rückmeldung: Blatt mit Art, Text und Kürzel; geht an den eigenen Worker, ohne Konto.
 * Mitgeschickt werden Version, Gerät, Breite, Schriftfaktor, Homescreen-App, Ansicht und der
 * letzte Fehlertext, kein Ort. Ohne Netz wartet der Eintrag auf den nächsten Start.
 * ------------------------------------------------------------------ */
const FB_KEY = "wetter:feedback";
const FB_KINDS = [["fehler", "Fehler"], ["idee", "Idee"], ["lob", "Lob"]];
var lastErrorText = "";
let fbKind = "idee", fbTrigger = null, fbSending = false;

function randomId(n) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        const buf = new Uint8Array(n);
        crypto.getRandomValues(buf);
        for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length];
        return out;
    }
    for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

function fbEsc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

function loadFeedbackState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(FB_KEY)); } catch (e) { s = null; }
    if (!s || typeof s !== "object") s = {};
    if (typeof s.id !== "string" || !/^[a-z0-9]{16}$/.test(s.id)) s.id = randomId(16);
    if (typeof s.name !== "string") s.name = "";
    if (!Array.isArray(s.queue)) s.queue = [];
    return s;
}
function saveFeedbackState(s) { try { localStorage.setItem(FB_KEY, JSON.stringify(s)); } catch (e) { /* kein Speicher */ } }

function feedbackMeta() {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const win = typeof window !== "undefined" ? window : {};
    let font = 1;
    try {
        const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
        if (isFinite(px) && px > 0) font = Math.round(px / 17 * 100) / 100;
    } catch (e) { font = 1; }
    return {
        version: ASSET_VERSION || "", ua: String(nav.userAgent || "").slice(0, 200),
        width: typeof win.innerWidth === "number" ? win.innerWidth : 0, font: font,
        standalone: !!pushStandalone(), view: currentView(), lastError: lastErrorText.slice(0, 300),
        ts: new Date(nowMs()).toISOString()
    };
}

function feedbackHtml(state) {
    const chips = FB_KINDS.map(function (k) {
        return '<button type="button" class="set-chip fb-kind" data-kind="' + k[0] + '" aria-pressed="' + (k[0] === fbKind ? 'true' : 'false') + '">' + k[1] + '</button>';
    }).join('');
    const n = state.queue.length;
    const waiting = n ? '<div class="fb-msg">' + (n === 1 ? '1 Rückmeldung wartet auf Netz und wird' : n + ' Rückmeldungen warten auf Netz und werden') + ' beim nächsten Start gesendet.</div>' : '';
    const dropped = state.dropped ? '<div class="fb-msg">' + droppedText(state.dropped) + '</div>' : '';
    return '<div class="fb-form">' +
        '<div class="seg" role="group" aria-label="Art der Rückmeldung">' + chips + '</div>' +
        '<textarea id="fbText" maxlength="2000" rows="5" placeholder="Was ist dir aufgefallen?" aria-label="Rückmeldung"></textarea>' +
        '<input type="text" id="fbName" maxlength="40" placeholder="Name oder Kürzel (optional)" aria-label="Name oder Kürzel" autocomplete="off" value="' + fbEsc(state.name) + '">' +
        '<div class="fb-row"><button type="button" class="set-btn" id="fbSend">Senden</button><span class="fb-msg" id="fbMsg" role="status"></span></div>' + waiting + dropped +
        '<p class="fb-note">Mitgeschickt werden App-Version, Gerät und Browser (User-Agent), Bildschirmbreite, Schriftgröße, ob als Homescreen-App, die aktuelle Ansicht und der letzte Fehlertext. Kein Ort, keine Koordinaten. Die Nachricht liegt beim Cloudflare-Worker der App und wird nach 90 Tagen gelöscht.</p></div>';
}

/* Beim Nachschicken verworfene Einträge: angesagt und beim nächsten Öffnen des Blatts gezeigt */
function droppedText(n) {
    return (n === 1 ? '1 gespeicherte Rückmeldung hat der Worker abgelehnt, sie wurde' : n + ' gespeicherte Rückmeldungen hat der Worker abgelehnt, sie wurden') + ' verworfen.';
}

function openFeedback(trigger) {
    if (!D("fb") || !D("fbBody")) return;
    fbTrigger = trigger || null;
    const state = loadFeedbackState();
    D("fbBody").innerHTML = feedbackHtml(state);
    if (state.dropped) { state.dropped = 0; saveFeedbackState(state); }   /* Hinweis einmal gezeigt */
    document.body.classList.add("fb-open");
    if (D("fbLink")) D("fbLink").setAttribute("aria-expanded", "true");
    setTimeout(function () { if (D("fbText") && D("fbText").focus) D("fbText").focus(); }, 300);
}

function closeFeedback() {
    document.body.classList.remove("fb-open");
    if (D("fbLink")) D("fbLink").setAttribute("aria-expanded", "false");
    const back = fbTrigger && fbTrigger.focus ? fbTrigger : D("fbLink");
    if (back && back.focus) back.focus();
    fbTrigger = null;
}

function setFeedbackKind(kind) {
    fbKind = FB_KINDS.some(function (k) { return k[0] === kind; }) ? kind : "idee";
    const body = D("fbBody");
    if (body && body.querySelectorAll) Array.prototype.slice.call(body.querySelectorAll(".fb-kind")).forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-kind") === fbKind ? "true" : "false");
    });
}

function setFeedbackMsg(text) { if (D("fbMsg")) D("fbMsg").textContent = text; }

function postFeedback(entry) {
    return withTimeout(fetch(NINA_PROXY + "/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) }), 8000, "Zeitüberschreitung");
}

async function sendFeedback() {
    if (fbSending) return;
    const text = D("fbText") ? String(D("fbText").value || "").trim() : "";
    const name = D("fbName") ? String(D("fbName").value || "").trim().slice(0, 40) : "";
    if (text.length < 3) { setFeedbackMsg("Bitte ein paar Worte mehr."); return; }
    const state = loadFeedbackState();
    state.name = name;
    saveFeedbackState(state);
    const entry = { text: text.slice(0, 2000), kind: fbKind, name: name, id: state.id, meta: feedbackMeta() };
    fbSending = true;
    setFeedbackMsg("Wird gesendet …");
    let res = null;
    try { res = await postFeedback(entry); } catch (e) { res = null; }
    fbSending = false;
    if (res && res.status === 429) { setFeedbackMsg("Höchstens fünf Rückmeldungen pro Stunde, bitte später noch einmal."); return; }
    /* 4xx ist ein Fehler dieser Nachricht: zeigen, Text stehen lassen, nicht einreihen */
    if (res && res.status >= 400 && res.status < 500) { setFeedbackMsg("Der Worker hat die Rückmeldung abgelehnt (HTTP " + res.status + "), bitte den Text prüfen."); return; }
    if (res && res.ok) {
        if (D("fbText")) D("fbText").value = "";
        setFeedbackMsg("Danke, angekommen.");
        announce("Rückmeldung gesendet.");
        return;
    }
    /* Kein Netz, Worker nicht erreichbar oder Serverfehler: aufheben und später nachschicken */
    const st = loadFeedbackState();
    st.queue.push(entry);
    if (st.queue.length > 10) st.queue = st.queue.slice(-10);
    saveFeedbackState(st);
    if (D("fbText")) D("fbText").value = "";
    setFeedbackMsg(res ? "Der Worker antwortet gerade nicht. Die Rückmeldung ist gespeichert und wird später erneut gesendet." : "Kein Netz. Die Rückmeldung ist gespeichert und wird beim nächsten Start gesendet.");
    announce("Rückmeldung gespeichert.");
}

/* Wartende Einträge der Reihe nach schicken; beim ersten Fehlschlag bleibt der Rest liegen.
   Vom Worker abgelehnte Einträge (4xx außer 429) werden verworfen und sichtbar gemeldet. */
async function flushFeedbackQueue() {
    const state = loadFeedbackState();
    if (!state.queue.length || typeof fetch !== "function") return;
    const rest = state.queue.slice();
    let dropped = 0;
    while (rest.length) {
        let res = null;
        try { res = await postFeedback(rest[0]); } catch (e) { res = null; }
        if (res && res.ok) rest.shift();
        else if (res && res.status >= 400 && res.status < 500 && res.status !== 429) { rest.shift(); dropped++; }
        else break;
    }
    const st = loadFeedbackState();
    st.queue = rest;
    if (dropped) st.dropped = (st.dropped || 0) + dropped;
    saveFeedbackState(st);
    if (dropped) { announce(droppedText(dropped)); setFeedbackMsg(droppedText(dropped)); }
}

function initFeedback() {
    if (D("fbLink")) D("fbLink").addEventListener("click", function () { openFeedback(D("fbLink")); });
    if (D("fbBg")) D("fbBg").addEventListener("click", closeFeedback);
    if (D("fbClose")) D("fbClose").addEventListener("click", closeFeedback);
    if (D("fb")) D("fb").addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeFeedback(); });
    const body = D("fbBody");
    if (body && body.addEventListener) body.addEventListener("click", function (ev) {
        const q = function (sel) { return ev.target && ev.target.closest ? ev.target.closest(sel) : null; };
        const k = q(".fb-kind");
        if (k) { setFeedbackKind(k.getAttribute("data-kind")); return; }
        if (q("#fbSend")) sendFeedback();
    });
    flushFeedbackQueue().catch(function () {});
}

function initFilm() {
    if (D("filmClose")) D("filmClose").addEventListener("click", closeFilm);
    if (D("filmShare")) D("filmShare").addEventListener("click", shareFilm);
    if (D("film")) D("film").addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeFilm(); });
}

function filmSettingsHtml() {
    return '<section class="set-sec"><h3>Tagesfilm</h3>' +
        '<div class="set-row"><span class="set-lbl">Morgens als Begrüßung</span><div class="seg" role="group" aria-label="Tagesfilm"><button type="button" class="set-chip" data-key="dayfilm" data-val="0" aria-pressed="' + (settings.dayfilm ? 'false' : 'true') + '">Aus</button><button type="button" class="set-chip" data-key="dayfilm" data-val="1" aria-pressed="' + (settings.dayfilm ? 'true' : 'false') + '">An</button></div></div>' +
        '<div class="set-row"><button type="button" class="set-btn" id="filmPlay">Jetzt abspielen</button></div>' +
        '<div class="set-note">Zehn Sekunden aus den Tageswerten: Sonnenbogen, Temperaturkurve, Regen. Läuft einmal am Tag beim ersten Öffnen, nicht bei reduzierter Bewegung. Teilen nimmt den Film auf dem Gerät als Video auf.</div></section>';
}

function renderSettings() {
    const body = D("settingsBody");
    if (body) body.innerHTML = settingsHtml();
}

function openSettings() {
    if (!D("settings")) return;
    renderSettings();
    document.body.classList.add("settings-open");
    if (D("settingsBtn")) D("settingsBtn").setAttribute("aria-expanded", "true");
    setTimeout(function () { if (D("settingsClose")) D("settingsClose").focus(); }, 300);
}

function closeSettings() {
    document.body.classList.remove("settings-open");
    if (D("settingsBtn")) { D("settingsBtn").setAttribute("aria-expanded", "false"); D("settingsBtn").focus(); }
}

function initSettings() {
    if (D("settingsBtn")) D("settingsBtn").addEventListener("click", openSettings);
    if (D("settingsBg")) D("settingsBg").addEventListener("click", closeSettings);
    if (D("settingsClose")) D("settingsClose").addEventListener("click", closeSettings);
    if (D("settings")) D("settings").addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeSettings(); });
    const body = D("settingsBody");
    if (body && body.addEventListener) body.addEventListener("change", function (ev) {
        const inp = ev.target && ev.target.closest ? ev.target.closest(".trip-date") : null;
        if (!inp || !settings.trip) return;
        const k = inp.getAttribute("data-k"), v = inp.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
        const trip = Object.assign({}, settings.trip); trip[k] = v;
        if (trip.from > trip.to) { if (k === "from") trip.to = v; else trip.from = v; }
        setSetting("trip", trip);
        renderTrip();
    });
    if (body && body.addEventListener) body.addEventListener("click", function (ev) {
        const q = function (sel) { return ev.target && ev.target.closest ? ev.target.closest(sel) : null; };
        const mv = q(".set-mv");
        if (mv) { moveField(mv.getAttribute("data-id"), mv.getAttribute("data-dir")); applyLayout(); announce("Reihenfolge geändert."); return; }
        const vis = q(".set-vis");
        if (vis) { toggleHidden(vis.getAttribute("data-id")); applyLayout(); announce(isHidden(vis.getAttribute("data-id")) ? "Ausgeblendet." : "Eingeblendet."); return; }
        if (q("#tripDel")) { setSetting("trip", null); renderTrip(); announce("Reise gelöscht."); return; }
        if (q("#tripPick")) { closeSettings(); if (typeof window.openTripSearch === "function") window.openTripSearch(); return; }
        if (q("#filmPlay")) { closeSettings(); if (!openFilm()) announce("Tagesfilm hier nicht möglich."); return; }
        if (q("#fbOpen")) { closeSettings(); openFeedback(D("settingsBtn")); return; }
        if (q("#pushTest")) { testPush(); return; }
        const t = q(".set-chip");
        if (!t) return;
        const key = t.getAttribute("data-key");
        let val = t.getAttribute("data-val");
        if (key === "push") { if (val === "1") enablePush(); else disablePush(); return; }
        if (key === "dayfilm") { setSetting("dayfilm", val === "1"); announce(val === "1" ? "Tagesfilm morgens an." : "Tagesfilm morgens aus."); return; }
        if (NUMERIC_SETTINGS.indexOf(key) >= 0) val = parseInt(val, 10);
        if (settings[key] === val) return;
        setSetting(key, val);
        announce(key === "temp" || key === "wind" ? "Einheiten geändert." : "Einstellung gespeichert.");
    });
}

function renderAllDesign(payload) {
    const locKey = payload.fc ? String(payload.fc.latitude) + "," + String(payload.fc.longitude) : "";
    const sameLoc = locKey === lastRenderedLoc;
    if (!sameLoc) { lastCounts = {}; lastTemp = null; lastRenderedLoc = locKey; }
    /* Am selben Ort überleben die gewählte Stunde (per Zeitstempel) und das offene Detailfeld */
    const keepTime = sameLoc ? previewTime : null, keepTile = sameLoc ? openTile : null;
    lastData = prepareData(payload.fc, payload.ens);
    lastAir = payload.air || null;
    lastMeta = payload.meta || null;
    lastLoc = payload.loc || null;
    lastPayload = payload;
    renderTrip();
    renderTrend();
    syncPush();
    lastAuto = nightNowAt(payload.fc, localNowIso(payload.fc));
    applyNight(resolveNight(lastAuto));
    previewIdx = null;
    previewTime = null;
    openTile = null;
    renderHero(payload.fc);
    renderWarnings(payload.warn, payload.nina);
    dHourly(payload.fc, payload.ens);
    dActivity();
    dNowcast(payload.fc);
    renderDays(payload.fc);
    renderHighlights(payload.fc);
    renderViewText();
    renderDetails(payload.fc, payload.air);
    dModels(payload.md, payload.fc, payload.ens);
    applyLayout();
    startCounters(D("details"));
    startCounters(D("models"));
    moveTabInk();
    if (keepTime) {
        const h = payload.fc.hourly, gi = h && h.time ? h.time.indexOf(keepTime) : -1;
        const w = hourlyWindow(payload.fc, 48);
        if (gi >= w.start && gi < w.end) selectHour(gi, true);
    }
    if (keepTile) toggleTile(keepTile);
    updatePreviewBar();
}

/* ------------------------------------------------------------------ *
 * App-Steuerung: Standort, Suche, Tabs
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Aktualität: Zeitpunkt, zu dem die gezeigten Daten tatsächlich geladen wurden
 * (nicht der Modelllauf, kein Radarbild, kein erneutes Rendern). Aus dem Cache
 * wiederhergestellte Daten behalten ihren gespeicherten Zeitpunkt.
 * ------------------------------------------------------------------ */
let loadedAt = null, loadedCached = false, loadedLocId = null, loadedTz = null, freshTimer = null;

function validZone(tz) {
    if (typeof tz !== "string" || !tz) return null;
    try { new Intl.DateTimeFormat("de-DE", { timeZone: tz }); return tz; } catch (e) { return null; }
}

function deviceZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
}

/* „heute, 10:10 Uhr“, „gestern, 22:10 Uhr“, „05.10., 22:10 Uhr“ in der Zeitzone des Ortes */
function stampAt(t, now, tz) {
    const zone = validZone(tz);
    const fmt = function (opts, ms) {
        return new Intl.DateTimeFormat("de-DE", Object.assign(zone ? { timeZone: zone } : {}, opts)).format(new Date(ms));
    };
    const dayOf = function (ms) { return fmt({ year: "numeric", month: "2-digit", day: "2-digit" }, ms); };
    const d = dayOf(t), today = dayOf(now), yesterday = dayOf(now - 86400000);
    const day = d === today ? "heute" : (d === yesterday ? "gestern" : d.slice(0, 6));
    const local = zone && deviceZone() && deviceZone() !== zone ? " Ortszeit" : "";
    return day + ", " + fmt({ hour: "2-digit", minute: "2-digit" }, t) + " Uhr" + local;
}

function freshnessText(iso, cached, now, tz) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    const age = Math.max(0, now - t);
    if (!cached && age < 6 * 3600000) {
        const min = Math.floor(age / 60000);
        if (min < 1) return "Gerade eben aktualisiert";
        if (min < 60) return "Vor " + min + (min === 1 ? " Minute" : " Minuten") + " aktualisiert";
        const h = Math.floor(min / 60);
        return "Vor " + h + (h === 1 ? " Stunde" : " Stunden") + " aktualisiert";
    }
    return "Stand " + stampAt(t, now, tz) + (cached ? " · gespeicherte Daten" : "");
}

/* Stand-Zeile der Fußzeile: „Stand 25.09., 14:15 Uhr“ in der Zeitzone des Ortes, wie die Aktualitätszeile mit Zusatz „Ortszeit“ */
function updatedText(iso, tz) {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    const zone = validZone(tz);
    const fmt = new Intl.DateTimeFormat("de-DE", Object.assign(zone ? { timeZone: zone } : {}, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }));
    const local = zone && deviceZone() && deviceZone() !== zone ? " Ortszeit" : "";
    return "Stand " + fmt.format(new Date(t)) + " Uhr" + local;
}

function updateFreshness() {
    const el = D("freshTxt");
    if (!el) return;
    const txt = freshnessText(loadedAt, loadedCached, nowMs(), loadedTz);
    if (el.textContent !== txt) el.textContent = txt;
    const btn = D("freshSrc");
    if (btn && btn.classList) btn.classList.toggle("hidden", !loadedAt);
}

/* Relative Angabe einmal pro Minute nachführen, ohne Netz, nur bei sichtbarer Seite */
function scheduleFreshness() {
    if (freshTimer) { clearTimeout(freshTimer); freshTimer = null; }
    if (!loadedAt) return;
    freshTimer = setTimeout(function () {
        freshTimer = null;
        if (!document.hidden) { updateFreshness(); updateNight(); }
        scheduleFreshness();
    }, 60000);
}

function setLoaded(iso, cached, locIdValue, tz) {
    loadedAt = iso || null;
    loadedCached = !!cached;
    loadedLocId = iso ? (locIdValue || null) : null;
    loadedTz = tz || null;
    updateFreshness();
    scheduleFreshness();
}

/* ------------------------------------------------------------------ *
 * Nachtpalette: Klasse night auf <html>, sobald die Sonne am Ort tiefer
 * als −8° steht (Ende der blauen Stunde). Folgt der echten Uhrzeit am
 * Ort, nie der Zeitreise. Nachts zeigen die Kacheln UV von morgen.
 * ------------------------------------------------------------------ */
let nightOn = false, lastAir = null, nightFadeTimer = null;
let lastMeta = null, lastLoc = null, lastSrcTrigger = null;   /* Herkunftsblatt: Modelllauf, gewählter Ort, auslösender Knopf */
let settings = normalizeSettings({}), lastPayload = null;         /* Einstellungen; letzte Nutzlast für ein Neurendern nach Einheitenwechsel */

/* ---- Einheiten: intern °C und km/h, Anzeige nach Einstellung ---- */
function tmp(v, digits) {
    const x = settings.temp === "F" ? v * 9 / 5 + 32 : v;
    return digits ? fmtNum(x, digits) : String(Math.round(x));
}
/* Temperaturdifferenzen ohne Nullpunktverschiebung */
function tdiff(d, digits) {
    const x = settings.temp === "F" ? d * 9 / 5 : d;
    return digits ? fmtNum(x, digits) : String(Math.round(x));
}
function beaufort(kmh) {
    const b = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
    let i = 0;
    while (i < b.length && kmh >= b[i]) i++;
    return i;
}
function wnd(v) {
    const u = settings.wind;
    if (u === "ms") return String(Math.round(v / 3.6));
    if (u === "kn") return String(Math.round(v / 1.852));
    if (u === "bft") return String(beaufort(v));
    return String(Math.round(v));
}
function wunit() { return { kmh: "km/h", ms: "m/s", kn: "kn", bft: "Bft" }[settings.wind] || "km/h"; }

/* Rausgehen-Schwellen einer Aktivität mit den Toleranzen aus den Einstellungen */
function actLimits(a) {
    return {
        feelMin: a.feel[0] + settings.feelAdj, feelMax: a.feel[1],
        prob: a.prob + settings.rainTol, wind: a.wind, gust: a.gust
    };
}

function settingsValue(key) { return settings[key]; }

function applySettings() {
    const root = document.documentElement;
    if (root && root.classList) root.classList.toggle("reduce", settings.motion === "reduce");
    applyScheme(settings.scheme);
}

/* Eine Einstellung setzen: speichern, anwenden, Blatt und bei Einheiten die Seite neu zeichnen */
function setSetting(key, val) {
    settings[key] = val;
    settings = normalizeSettings(settings);
    saveSettings(settings);
    applySettings();
    /* Einheitenwechsel: ganze Seite neu, mit frischer Startchoreografie */
    if (["temp", "wind", "rainTol", "feelAdj"].indexOf(key) >= 0 && lastPayload) { introStart = null; renderAllDesign(lastPayload); }
    if (key === "order" || key === "hidden") applyLayout();
    renderSettings();
}

/* Echte Zeit; window.TEST_NOW ist der Haltepunkt der Tests */
function nowMs() { return typeof window !== "undefined" && isNum(window.TEST_NOW) ? window.TEST_NOW : Date.now(); }

function localNowIso(fc) {
    const off = isNum(fc.utc_offset_seconds) ? fc.utc_offset_seconds : 0;
    return new Date(nowMs() + off * 1000).toISOString().slice(0, 16);
}

/* Nacht am Ort zur Ortszeit nowIso: aus den Lichtzeiten (an Open-Meteo verankert), sonst reine Sonnenrechnung */
function nightNowAt(fc, nowIso) {
    const date = String(nowIso).slice(0, 10), nowMin = minutesOf(nowIso);
    const di = fc.daily && fc.daily.time ? fc.daily.time.indexOf(date) : -1;
    const lt = di >= 0 ? lightTimes(fc, di) : null;
    if (lt && isNum(lt.morning.blueStart) && isNum(lt.evening.blueEnd)) return nowMin < lt.morning.blueStart || nowMin >= lt.evening.blueEnd;
    return nightByClock(fc.latitude, fc.longitude, date, isNum(fc.utc_offset_seconds) ? fc.utc_offset_seconds : 0, nowMin);
}

function nightRoot() { return document.documentElement && document.documentElement.classList ? document.documentElement : document.body; }

/* Farbe der Statusleiste je Farbschema und Nacht (Bento wie der Grund, Nil Nile Blue bzw. Deep Indigo); liefert sie zurück.
   Beim Start zählt auch die Nachtklasse aus index.html, nightOn folgt erst mit den ersten Daten. */
function updateThemeColor() {
    const root = nightRoot();
    const night = nightOn || !!(root && root.classList && root.classList.contains("night"));
    const color = settings.scheme === "nil" ? (night ? "#051230" : "#bce4e5") : (night ? "#14121F" : "#ECEAF4");
    const meta = document.querySelector ? document.querySelector('meta[name="theme-color"]') : null;
    if (meta) meta.setAttribute("content", color);
    return color;
}

/* Farbschema: Klasse scheme-nil am Wurzelelement (index.html setzt sie vor dem ersten Zeichnen aus dem Speicher);
   bei Wechsel blendet die Seite wie beim Nachtwechsel eine Sekunde weich über. Ein geladenes Radar-Blatt lädt wie beim
   Nachtwechsel neu: radar.html liest das Schema selbst aus wetter:settings, das setSetting vor dem Anwenden speichert. */
function applyScheme(name) {
    const root = nightRoot();
    const on = name === "nil";
    const was = root && root.classList ? root.classList.contains("scheme-nil") : false;
    if (root && root.classList) root.classList.toggle("scheme-nil", on);
    updateThemeColor();
    if (was === on || !root || !root.classList) return;
    root.classList.add("fade");
    clearTimeout(nightFadeTimer);
    nightFadeTimer = setTimeout(function () { root.classList.remove("fade"); }, 1000);
    const frame = D("radarFrame");
    if (frame && frame.getAttribute && frame.getAttribute("src")) frame.setAttribute("src", radarEmbedUrl());
}

/* Setzt die Palette; bei Wechsel blendet die Seite eine Sekunde weich über. Liefert true bei Wechsel. */
function applyNight(on) {
    const root = nightRoot();
    const was = root && root.classList ? root.classList.contains("night") : nightOn;
    nightOn = on;
    if (root && root.classList) root.classList.toggle("night", on);
    /* Nur bei Änderung schreiben; die Prüfung läuft im Minutentakt */
    try { if (localStorage.getItem("wetter:night") !== (on ? "1" : "0")) localStorage.setItem("wetter:night", on ? "1" : "0"); } catch (e) {}
    updateThemeColor();
    paintModeButton(D("modeBtn"), on);
    if (was === on) return false;
    if (root && root.classList) {
        root.classList.add("fade");
        clearTimeout(nightFadeTimer);
        nightFadeTimer = setTimeout(function () { root.classList.remove("fade"); }, 1000);
    }
    /* Ein geladenes Radar-Blatt bekommt den neuen Nachtzustand mit (lädt neu) */
    const frame = D("radarFrame");
    if (frame && frame.getAttribute && frame.getAttribute("src")) frame.setAttribute("src", radarEmbedUrl());
    return true;
}

/* Zustand setzen; bei Wechsel die Tageszeit-Kacheln leise neu bauen */
let lastAuto = null;   /* automatischer Zustand bei der letzten Prüfung */
function settleNight(on) {
    if (!applyNight(on)) return;
    if (!lastData || !lastData.fc) return;
    renderDetails(lastData.fc, lastAir, { swap: true });
    applyLayout();
    if (openTile) setTileState(openTile, true);
}

/* Minütlich, beim Sichtbarwerden und in Tests mit fester Zeit: Automatik gegen die Handwahl */
function updateNight(nowIso) {
    if (!lastData || !lastData.fc) return;
    const fc = lastData.fc;
    lastAuto = nightNowAt(fc, nowIso || localNowIso(fc));
    settleNight(resolveNight(lastAuto));
}

/* Tipp auf den Schalter: Handwahl bis zum nächsten automatischen Wechsel */
function setNightManual(on) {
    writeNightMode(on ? "night" : "day", lastAuto === null ? nightOn : lastAuto);
    settleNight(on);
}

function countState() { return Object.assign({}, lastCounts); }

function initDesignApp() {
    settings = loadSettings();
    applySettings();
    let currentLoc = null;
    let loading = false;
    let pending = false;   /* Ortswechsel während eines laufenden Ladens: danach erneut laden */

    function setLocLabel(loc) {
        D("locName").textContent = (loc.source === "search" ? "🔍 " : "") + loc.name;
        D("gps").classList.toggle("hidden", loc.source !== "search");
    }

    /* Stand-Zeile auf derselben Basis wie die Aktualitätszeile: Ortszeit des Ortes */
    function setUpdatedLabel(iso, tz) { D("updated").textContent = updatedText(iso, tz); }

    async function load() {
        if (!currentLoc) return;
        if (loading) { pending = true; return; }
        loading = true;
        pending = false;
        const loc = currentLoc;
        D("refresh").classList.add("spin");
        D("banner").classList.add("hidden");
        setLocLabel(loc);
        /* Anderer Ort: die Aktualität der alten Daten gilt nicht mehr */
        if (loc.id !== loadedLocId) setLoaded(null, false, null, null);

        const results = await Promise.allSettled([
            fetchForecast(loc), fetchEnsemble(loc), fetchModels(loc), fetchAir(loc), fetchWarnings(loc), fetchNina(loc), fetchModelMeta()
        ]);
        /* Inzwischen ein anderer Ort (z. B. GPS nach gespeicherter Position)? Dann diese Antwort verwerfen. */
        if (currentLoc !== loc) { loading = false; return load(); }
        const val = function (i) { return results[i].status === "fulfilled" ? results[i].value : null; };
        const fc = val(0);

        const reason = results[0].reason && results[0].reason.message ? results[0].reason.message : "Netzwerkfehler";
        if (fc) {
            const payload = { fc: fc, ens: val(1), md: val(2), air: val(3), warn: val(4), nina: val(5), meta: val(6),
                              loc: { name: loc.name || "", lat: loc.lat, lon: loc.lon } };
            const at = new Date(nowMs()).toISOString();
            renderAllDesign(payload);
            saveCache(currentLoc, payload);
            setUpdatedLabel(at, fc.timezone);
            setLoaded(at, false, loc.id, fc.timezone);
            announce("Wetter für " + (loc.name || "deinen Standort") + " aktualisiert.");
            maybeAutoFilm();
        } else {
            const cached = loadCache(currentLoc);
            if (cached) {
                const tz = cached.payload && cached.payload.fc ? cached.payload.fc.timezone : null;
                renderAllDesign(cached.payload);
                setUpdatedLabel(cached.savedAt, tz);
                setLoaded(cached.savedAt, true, loc.id, tz);
                showBanner("Keine Verbindung – du siehst die zuletzt gespeicherten Daten.", false);
            } else if (loadedAt && loadedLocId === loc.id) {
                /* Kein Cache, aber die zuletzt gültigen Daten dieses Orts stehen noch da: stehen lassen und als gespeichert kennzeichnen */
                setLoaded(loadedAt, true, loc.id, loadedTz);
                showBanner("Die Wetterdaten konnten nicht aktualisiert werden (" + reason + ").", true, "Erneut versuchen", load);
            } else {
                clearRendered();
                setLoaded(null, false, null, null);
                showBanner("Die Wetterdaten konnten nicht geladen werden (" + reason + ").", true, "Erneut versuchen", load);
            }
        }
        D("refresh").classList.remove("spin");
        loading = false;
        if (pending) load();
    }

    function showBanner(text, isError, btnLabel, btnFn) {
        announce(text);
        if (isError) lastErrorText = String(text).replace(/<[^>]+>/g, "").slice(0, 300);
        const b = D("banner");
        b.className = "banner" + (isError ? " err" : "");
        b.innerHTML = text + (btnLabel ? '<button type="button" id="bannerBtn">' + btnLabel + '</button>' : '');
        if (btnLabel) D("bannerBtn").addEventListener("click", btnFn);
    }

    /* ---- GPS ---- */

    let lastFixAt = 0;   /* Zeitpunkt der letzten erfolgreichen Ortung; beim Sichtbarwerden wird erst nach GPS_MAX_AGE neu geortet */
    const GPS_MAX_AGE = 10 * 60 * 1000;

    function useGps(lat, lon) {
        lastFixAt = nowMs();
        const cachedPos = loadPos();
        const known = cachedPos && distanceKm(lat, lon, cachedPos.lat, cachedPos.lon) < 2 ? cachedPos.name : null;
        currentLoc = { id: locId(lat, lon), name: known || "Dein Standort", lat: lat, lon: lon, source: "gps" };
        savePos({ lat: lat, lon: lon, name: currentLoc.name });
        saveActiveLoc(currentLoc);
        if (!known) {
            fetchPlace(lat, lon).then(function (p) {
                if (!p || !currentLoc || currentLoc.source !== "gps") return;
                currentLoc.name = p;
                setLocLabel(currentLoc);
                savePos({ lat: lat, lon: lon, name: p });
                saveActiveLoc(currentLoc);
            });
        }
        load();
    }

    /* always: Fehler auch melden, wenn schon ein Ort steht (Tipp auf „Mein Standort“ ohne gespeicherte Position) */
    function locate(always) {
        if (window.PREVIEW_LOC) return;   /* Vorschau-Modus: fester Standort, keine Ortung */
        if (!("geolocation" in navigator)) {
            showBanner("Dein Browser unterstützt keine Standortabfrage.", true, "Ort suchen", openSheet);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            function (pos) { D("banner").classList.add("hidden"); useGps(pos.coords.latitude, pos.coords.longitude); },
            function (err) {
                if (currentLoc && !always) return;
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
        D("locBtn").setAttribute("aria-expanded", "true");
        showRecent();
        setTimeout(function () { D("q").focus(); }, 300);
    }
    /* Schließen: Eingabe und Liste leeren, laufende Suchen verfallen, Fokus zurück auf den Ortsknopf */
    function closeSheet() {
        sheetMode = null;
        document.body.classList.remove("sheet-open");
        D("locBtn").setAttribute("aria-expanded", "false");
        D("q").value = "";
        D("res").innerHTML = "";
        D("res").setAttribute("aria-busy", "false");
        searchSeq++;
        searchLast = null;
        D("locBtn").focus();
    }

    let searchSeq = 0, searchLast = null;

    function placeButtons(list, cls) {
        return list.map(function (r, i) {
            return '<button type="button" class="place' + (cls ? " " + cls : "") + '" data-i="' + i + '">' + r.name + '</button>';
        }).join("");
    }
    function bindPlaces(list) {
        D("res").querySelectorAll(".place").forEach(function (b) {
            b.addEventListener("click", function () { choosePlace(list[+b.getAttribute("data-i")]); });
        });
    }
    function resState(cls, text) {
        D("res").innerHTML = '<div class="place-none' + (cls ? " " + cls : "") + '" role="status">' + text + '</div>';
    }
    /* Ohne Eingabe: die zuletzt gewählten Suchorte, neuester zuerst */
    function showRecent() {
        const recent = loadRecentPlaces();
        const res = D("res");
        if (!recent.length) { res.innerHTML = ""; return; }
        res.innerHTML = '<div class="res-head">Zuletzt gewählt</div>' + placeButtons(recent, "recent");
        bindPlaces(recent);
    }
    /* Ein Suchtreffer oder ein bisheriger Ort wird aktiver Ort (auch fürs Radar) und zuletzt gewählter Suchort */
    let sheetMode = null;   /* "trip": die Suche wählt das Reiseziel statt des aktiven Orts */
    window.openTripSearch = function () { sheetMode = "trip"; openSheet(); };

    function choosePlace(r) {
        if (!r) return;
        if (sheetMode === "trip") {
            sheetMode = null;
            const today = localDate(new Date(nowMs())), old = settings.trip;
            const from = old ? old.from : today, to = old ? old.to : localDate(new Date(nowMs() + 7 * 86400000));
            setSetting("trip", { name: r.name, lat: r.lat, lon: r.lon, from: from, to: to });
            closeSheet();
            renderTrip();
            openSettings();
            announce("Reiseziel " + r.name + " gespeichert.");
            return;
        }
        currentLoc = { id: locId(r.lat, r.lon), name: r.name, lat: r.lat, lon: r.lon, source: "search" };
        saveActiveLoc(currentLoc);
        saveRecentPlace(currentLoc);
        closeSheet();
        load();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /* ---- Reise: Knöpfe im Feld, Wechsel in die Vorhersage dort und zurück ---- */
    function useTripPlace() {
        const t = settings.trip;
        if (!t) return;
        currentLoc = { id: locId(t.lat, t.lon), name: t.name, lat: t.lat, lon: t.lon, source: "search" };
        saveActiveLoc(currentLoc);
        load();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function initTrip() {
        const box = D("trip");
        if (!box || !box.addEventListener) return;
        box.addEventListener("click", function (ev) {
            const b = ev.target && ev.target.closest ? ev.target.closest(".trip-btn") : null;
            if (!b) return;
            if (b.getAttribute("data-trip") === "go") useTripPlace();
            else { saveActiveLoc(null); locate(); }
        });
    }
    /* Beim Start einmal am Tag in die Reisevorhersage wechseln, solange die Reise läuft */
    function tripAutoSwitch() {
        const t = settings.trip, today = localDate(new Date(nowMs()));
        const st = tripState(t, today);
        if (!st || st.phase !== "during" || settings.tripSwitched === today) return false;
        settings.tripSwitched = today;
        saveSettings(settings);
        currentLoc = { id: locId(t.lat, t.lon), name: t.name, lat: t.lat, lon: t.lon, source: "search" };
        saveActiveLoc(currentLoc);
        load();
        return true;
    }

    /* ---- Woher kommt das? (zweites Blatt) ---- */
    function initSource() {
        if (D("freshSrc")) D("freshSrc").addEventListener("click", function () { openSource(null, D("freshSrc")); });
        if (D("srcBg")) D("srcBg").addEventListener("click", closeSource);
        if (D("srcClose")) D("srcClose").addEventListener("click", closeSource);
        if (D("src")) D("src").addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeSource(); });
    }

    function initSearch() {
        let timer = null;
        D("locBtn").addEventListener("click", openSheet);
        D("sheetBg").addEventListener("click", closeSheet);
        D("sheetClose").addEventListener("click", closeSheet);
        D("sheet").addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeSheet(); });
        D("q").addEventListener("input", function () {
            const q = D("q").value.trim();
            clearTimeout(timer);
            searchSeq++;                       /* alles, was noch unterwegs ist, gehört zu einer älteren Eingabe */
            if (q.length < 2) { searchLast = null; showRecent(); return; }
            if (q === searchLast) return;      /* nur Leerzeichen geändert: Treffer stehen schon da */
            timer = setTimeout(async function () {
                const my = searchSeq;
                const res = D("res");
                if (res.innerHTML.indexOf('class="place"') < 0) resState("busy", "Suche läuft …");
                res.setAttribute("aria-busy", "true");
                let results = null;
                try { results = await searchPlaces(q); } catch (e) { results = null; }
                if (my !== searchSeq) return;  /* verspätete Antwort einer früheren Eingabe */
                res.setAttribute("aria-busy", "false");
                if (!results) {                /* Netzwerkfehler ist kein leeres Ergebnis */
                    searchLast = null;
                    resState("err", "Suche derzeit nicht möglich. Bitte Verbindung prüfen und erneut tippen.");
                    return;
                }
                searchLast = q;
                if (!results.length) { resState("", "Keine Orte gefunden."); return; }
                res.innerHTML = placeButtons(results, "");
                bindPlaces(results);
            }, 350);
        });
        /* „Mein Standort“: gespeicherte Position sofort zeigen und neu orten; ohne gespeicherte Position bleibt der
           bisherige Ort stehen, ein Ortungsfehler zeigt dann das Banner */
        D("gps").addEventListener("click", function () {
            closeSheet();
            const cached = loadPos();
            if (cached) {
                currentLoc = { id: locId(cached.lat, cached.lon), name: cached.name || "Dein Standort", lat: cached.lat, lon: cached.lon, source: "gps" };
                saveActiveLoc(currentLoc);
                load();
            }
            locate(!cached);
        });
    }

    /* ---- Tabs mit Scrollspy ---- */

    function initTabs() {
        const links = Array.prototype.slice.call(document.querySelectorAll(".tabs a[data-target]"));
        if (typeof IntersectionObserver === "undefined" || !links.length) return;
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                markTabs(links, links.filter(function (l) { return l.getAttribute("data-target") === e.target.id; })[0] || null);
                moveTabInk();
            });
        }, { rootMargin: "-40% 0px -50% 0px" });
        links.forEach(function (l) {
            const sec = D(l.getAttribute("data-target"));
            if (sec) io.observe(sec);
            /* Beim Antippen sofort markieren, die Pille gleitet dann vor dem Scrollen los */
            l.addEventListener("click", function () {
                markTabs(links, l);
                moveTabInk();
            });
        });
        if (typeof window !== "undefined" && window.addEventListener) { window.addEventListener("resize", moveTabInk); window.addEventListener("resize", moveActInk); }
        moveTabInk();
    }

    /* ---- Tag/Nacht-Schalter oben rechts ---- */

    function initModeToggle() {
        const b = D("modeBtn");
        if (!b) return;
        paintModeButton(b, nightOn);
        b.addEventListener("click", function () { setNightManual(!nightOn); announce(nightOn ? "Nachtmodus an." : "Nachtmodus aus."); });
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
            /* Aufklappbare Kachel: die Disclosure-Schaltfläche liegt über der ganzen Kachel (auch per Tastatur) */
            const tg = t.closest(".t-toggle");
            if (tg) {
                const tile = tg.closest(".tile");
                if (tile) toggleTile(tile.getAttribute("data-tile"));
                return;
            }
            const hl = t.closest(".hl-row");
            if (hl) { jumpToDay(parseInt(hl.getAttribute("data-day"), 10)); return; }
            const srcBtn = t.closest(".tp-src");
            if (srcBtn) { openSource(srcBtn.getAttribute("data-src"), srcBtn); return; }
            /* Kein Neustart der Animationen beim Antippen: Bewegung läuft nur bei neuen Daten und beim Aufklappen */
        });
    }

    /* Vorschauleiste: Jetzt-Knopf und Beobachtung, ob der Hero im Bild ist */
    function initPreviewBar() {
        const btn = D("previewNow");
        if (btn && btn.addEventListener) btn.addEventListener("click", backToNow);
        const hero = D("hero");
        /* Ohne Beobachter gilt der Hero als im Bild: die Leiste würde ihn sonst dauerhaft doppeln */
        if (typeof IntersectionObserver === "undefined" || !hero) { heroVisible = true; return; }
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { heroVisible = e.isIntersecting; });
            updatePreviewBar();
        }, { threshold: 0.15 });
        io.observe(hero);
    }

    /* Regenpausen: Dauer-Chips in der Nowcast-Karte */
    function initPause() {
        const card = D("nowcastCard");
        if (!card || !card.addEventListener) return;
        card.addEventListener("click", function (ev) {
            const t = ev.target;
            if (!t || !t.closest) return;
            const chip = t.closest(".pchip");
            if (chip) setPause(parseInt(chip.getAttribute("data-min"), 10));
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

    /* ---- Start ---- */

    D("refresh").addEventListener("click", function () { if (!currentLoc) locate(); else load(); });
    /* Sichtbarwerden: Aktualität und Nacht nachführen, Daten neu laden; ein GPS-Ort wird nur neu geortet,
       wenn die letzte Ortung älter als GPS_MAX_AGE ist */
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) return;
        updateFreshness();
        updateNight();
        if (!currentLoc) locate();
        else if (currentLoc.source === "gps" && nowMs() - lastFixAt > GPS_MAX_AGE) locate();
        else load();
    });

    initSearch();
    initSource();
    initHourKeys();
    initSettings();
    initFeedback();
    initTrip();
    if (D("trendBtn")) D("trendBtn").addEventListener("click", toggleTrend);
    initRadarSheet();
    initFilm();
    initTabs();
    initModeToggle();
    initViews();
    initReplay();
    initPreviewBar();
    loadActivity();
    initActivity();
    loadPause();
    initPause();
    initScrub();

    /* Ein per Suche gewählter Ort bleibt über Radar, Neuladen und Direktaufruf erhalten;
       ohne (gültigen) aktiven Ort gilt der GPS-Fluss wie bisher. */
    if (!window.PREVIEW_LOC && tripAutoSwitch()) return;
    const active = window.PREVIEW_LOC ? null : loadActiveLoc();
    if (active && active.source === "search") {
        currentLoc = { id: locId(active.lat, active.lon), name: active.name || "Gewählter Ort", lat: active.lat, lon: active.lon, source: "search" };
        load();
        return;
    }
    const cached = window.PREVIEW_LOC || loadPos();
    if (cached) {
        currentLoc = { id: locId(cached.lat, cached.lon), name: cached.name || "Dein Standort", lat: cached.lat, lon: cached.lon, source: "gps" };
        load();
    }
    locate();
}

if (typeof window !== "undefined") window.initDesignApp = initDesignApp;
