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
