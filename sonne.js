/* Sonnen- und Mondrechnung, von Startseite (design.js) und Radar (radar.js) gemeinsam genutzt.
 * Keine Abhängigkeiten, keine Seiteneffekte. Zeiten sind Minuten seit Mitternacht in der
 * Zeitzone, deren Versatz (offsetSec) übergeben wird. */
"use strict";

/* Deklination (rad) und Zeitgleichung (Minuten) für ein Datum YYYY-MM-DD */
function solarDecl(dateStr) {
    const p = String(dateStr).split("-").map(Number);
    if (p.length < 3 || p.some(isNaN)) return null;
    const dayN = Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(p[0], 0, 1)) / 86400000) + 1;
    const B = 2 * Math.PI / 365 * (dayN - 81);
    return { decl: 23.44 * Math.PI / 180 * Math.sin(B), eot: 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B) };
}

/* Sonnenmittag und halber Bogen (Minuten) für eine Sonnenhöhe; null, wenn die Höhe an dem Tag nicht erreicht wird */
function solarArc(lat, lon, dateStr, offsetSec, elevDeg) {
    const g = solarDecl(dateStr);
    if (!g) return null;
    const phi = lat * Math.PI / 180, h0 = elevDeg * Math.PI / 180;
    const cosW = (Math.sin(h0) - Math.sin(phi) * Math.sin(g.decl)) / (Math.cos(phi) * Math.cos(g.decl));
    if (cosW < -1 || cosW > 1) return null;
    return { noon: 720 - 4 * lon - g.eot + offsetSec / 60, half: Math.acos(cosW) * 180 / Math.PI * 4 };
}

/* Auf- und Untergangszeit für eine Sonnenhöhe (Grad) nach der klassischen Gleichung */
function solarTimes(lat, lon, dateStr, offsetSec, elevDeg) {
    const a = solarArc(lat, lon, dateStr, offsetSec, elevDeg);
    return a ? { rise: a.noon - a.half, set: a.noon + a.half } : null;
}

/* Nacht = Sonne tiefer als −8° (Ende der blauen Stunde). Erreicht die Sonne −8° an dem Tag nie:
   gibt es trotzdem einen Tag (−0,833°), bleibt es hell (helle Sommernächte), sonst entscheidet
   die Deklination (Polartag hell, Polarnacht dunkel). Der Abstand zum Mittag wird modulo Tag
   gerechnet, damit auch ferne Orte mit dem Geräteversatz stimmen. */
function nightByClock(lat, lon, dateStr, offsetSec, nowMin) {
    const a = solarArc(lat, lon, dateStr, offsetSec, -8);
    if (a) {
        let d = (((nowMin - a.noon) % 1440) + 1440) % 1440;
        if (d > 720) d = 1440 - d;
        return d > a.half;
    }
    if (solarArc(lat, lon, dateStr, offsetSec, -0.833)) return false;
    const g = solarDecl(dateStr);
    return !!g && lat * g.decl < 0;
}

/* Mondphase aus dem synodischen Monat ab dem Neumond vom 6.1.2000 18:14 UTC (auf einen Tag genau) */
const MOON_SYNODIC = 29.530588853;
const MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
const MOON_NAMES = ["Neumond", "Zunehmende Sichel", "Erstes Viertel", "Zunehmender Mond", "Vollmond", "Abnehmender Mond", "Letztes Viertel", "Abnehmende Sichel"];

function moonPhase(date) {
    const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
    if (isNaN(ms)) return null;
    const phase = ((((ms - MOON_REF) / 86400000) / MOON_SYNODIC) % 1 + 1) % 1;
    return { phase: phase, illum: (1 - Math.cos(2 * Math.PI * phase)) / 2, name: MOON_NAMES[Math.floor(((phase + 0.0625) % 1) * 8)] };
}

/* ---- Tag/Nacht-Schalter: Handwahl gilt, bis der Sonnenstand das nächste Mal wechselt ---- */
const NIGHT_MODE_KEY = "wetter:nightmode";

function readNightMode() {
    try {
        const p = JSON.parse(localStorage.getItem(NIGHT_MODE_KEY) || "null");
        return p && (p.force === "night" || p.force === "day") && typeof p.auto === "boolean" ? p : null;
    } catch (e) { return null; }
}
function writeNightMode(force, auto) {
    try { localStorage.setItem(NIGHT_MODE_KEY, JSON.stringify({ force: force, auto: !!auto })); } catch (e) {}
}
function clearNightMode() {
    try { localStorage.removeItem(NIGHT_MODE_KEY); } catch (e) {}
}
/* Automatik (auto) gegen die Handwahl: weicht die Automatik vom Stand beim Tippen ab, verfällt die Wahl */
function resolveNight(auto) {
    const m = readNightMode();
    if (!m) return auto;
    if (m.auto !== auto) { clearNightMode(); return auto; }
    return m.force === "night";
}

/* Knopf: Symbol zeigt den Zustand, aria-pressed den Schalter, der Titel die Wirkung des Tipps */
const MODE_ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MODE_ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z"/></svg>';
function paintModeButton(btn, night) {
    if (!btn) return;
    btn.innerHTML = night ? MODE_ICON_MOON : MODE_ICON_SUN;
    if (btn.setAttribute) {
        btn.setAttribute("aria-label", "Nachtmodus");
        btn.setAttribute("aria-pressed", night ? "true" : "false");
        btn.setAttribute("title", night ? "Nachtmodus ausschalten" : "Nachtmodus einschalten");
    }
}
