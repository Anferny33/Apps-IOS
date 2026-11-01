# Regenpausen · Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Nowcast-Karte nennt die nächste trockene Phase für eine gewählte Dauer und markiert sie grün mit weichen Rändern.

**Architecture:** Reine Funktionen `dryRuns`, `pauseInfo`, `pauseClasses` in `design.js`; `dNowcast` rendert Klassen und Block; `setPause`/`updatePause` wechseln ohne Neurendern; Klick-Delegation `initPause`. CSS in beiden Stylesheets.

**Spezifikation:** `docs/superpowers/specs/2026-10-08-regenpausen-design.md`

---

### Task 1: Bewertung mit Tests

- [ ] Tests (vor `// Stufe 2: Ziehen vom Griff`):

```js
  // Regenpausen (Mock: Jetzt 14:15, Regen 14:45–16:15)
  const ncs = sb.nowcastSummary(fc);
  const p30 = sb.pauseInfo(ncs, 30), p60 = sb.pauseInfo(ncs, 60);
  H.check('Regenpause: 30 min beginnt jetzt, 60 min später und offen', p30.s === 0 && p30.e === 1 && !p30.open && p30.text === 'Jetzt trocken bis ca. 14:45, rund 30 Minuten.' && p60.s === 8 && p60.open && p60.text === 'Nächste trockene Phase: ab ca. 16:15, mindestens bis 18:15.', [p30.text, p60.text].join(' | '));
  const ncMid = { vals: ncs.vals.map((v, i) => (i >= 2 && i <= 3) || i >= 9 ? 0.4 : 0), times: ncs.times };
  const pMid = sb.pauseInfo(ncMid, 60);
  H.check('Regenpause: geschlossene spätere Phase mit Dauer', pMid.s === 4 && pMid.e === 8 && !pMid.open && pMid.text === 'Nächste trockene Phase: ca. 15:15 bis 16:30, rund 1 h 15 min.', pMid.text);
  H.check('Regenpause: keine Phase, mit und ohne Nachsatz', sb.pauseInfo({ vals: ncs.vals.map(() => 0.5), times: ncs.times }, 30).text === 'In den nächsten 4 Stunden keine trockene Phase von 30 Minuten.' && sb.pauseInfo({ vals: ncs.vals.map((v, i) => i === 5 ? 0 : 0.5), times: ncs.times }, 30).text === 'In den nächsten 4 Stunden keine trockene Phase von 30 Minuten, längstens rund 15 Minuten ab ca. 15:30.', sb.pauseInfo({ vals: ncs.vals.map((v, i) => i === 5 ? 0 : 0.5), times: ncs.times }, 30).text);
```

- [ ] Implementierung vor `function dNowcast(fc)`:

```js
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

/* Erste trockene Phase, die für die gewünschte Dauer reicht; Zeiten als „ca.", weil 15-Minuten-Raster */
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
```

- [ ] `npm test` grün, Commit „Find the next dry spell that fits a chosen duration".

### Task 2: Karte, Chips, Wahl, CSS

- [ ] Tests (hinter Task 1):

```js
  const ncHtml = G(sb,'nowcast').innerHTML;
  H.check('Regenpause: Block mit Chips, 30 aktiv, Satz, Balken 0/1 markiert (1 weich)', ncHtml.includes('<div class="pause">') && ncHtml.includes('class="pchip on" data-min="30"') && (ncHtml.match(/class="pchip( on)?" data-min=/g) || []).length === 3 && ncHtml.includes('<div class="ptext">Jetzt trocken bis ca. 14:45, rund 30 Minuten.</div>') && /<div class="nc-bars"><i class="z p" [^>]*><\/i><i class="z p pe" /.test(ncHtml), ncHtml.slice(0, 200));
  sb.setPause(60);
  H.check('Regenpause: Wechsel auf 60 min, gespeichert', G(sb,'nowcast').innerHTML.includes('Nächste trockene Phase: ab ca. 16:15, mindestens bis 18:15.') && G(sb,'nowcast').innerHTML.includes('class="pchip on" data-min="60"') && sb._store['wetter:pause'] === '60', G(sb,'nowcast').innerHTML.slice(G(sb,'nowcast').innerHTML.indexOf('pause'), G(sb,'nowcast').innerHTML.indexOf('pause') + 300));
  sb.setPause(30);
```

- [ ] `dNowcast` ersetzen (Balken mit Pause-Klassen, Block, Merken von `lastNc`); `setPause`, `updatePause`, `loadPause`; `initPause()` neben `initActivity` und im Start-Block; CSS beide Designs.
- [ ] `npm test` grün, Commit „Mark the next dry spell in the nowcast card".

### Task 3: Sichtprüfung, Version `r`, README, Push, Pages.
