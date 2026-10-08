# Modellunsicherheit · Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Summenkurven je Modell für heute und morgen mit ICON-D2-Ensemble-Band und Übereinstimmungssatz im Feld „Modellvergleich".

**Architecture:** `fetchModels` lädt zusätzlich Stundenwerte. In `design.js` rechnen reine Funktionen Tagessummen, laufende Summen, Band und Satz; `dModels` baut Satz, SVG, Chips und Ensemble-Zeile; `highlightModel` wechselt per Klassen. CSS in beiden Stylesheets, Linien zeichnen sich über `pathLength`.

**Tech Stack:** Vanilla JS, inline SVG, CSS, Node-Smoke-Tests.

**Spezifikation:** `docs/superpowers/specs/2026-10-08-modellunsicherheit-design.md`

---

### Task 1: Daten und reine Funktionen mit Tests

**Files:** Modify `wetter-core.js` (`fetchModels`), `tests/harness.js` (`mockModels`), `design.js` (vor `dModels`); Test `tests/smoke-design.js`

- [ ] **Step 1: Mock erweitern** — in `tests/harness.js` `mockModels()`:

```js
function mockModels() {
  const md = { daily: { time: ['2026-09-25','2026-09-26','2026-09-27'] }, hourly: { time: [] } };
  for (let h = 0; h < 72; h++) {
    const d = 25 + Math.floor(h / 24);
    md.hourly.time.push('2026-09-' + d + 'T' + String(h % 24).padStart(2, '0') + ':00');
  }
  ['icon_d2','icon_eu','ecmwf_ifs025','gfs_seamless','ukmo_seamless'].forEach((id, i) => {
    md.daily['precipitation_sum_' + id] = [0, 2 + i, 9 + i * 2];
    // Stundenwerte passend zu den Tagessummen: morgen 12–15 Uhr, übermorgen 8–17 Uhr
    md.hourly['precipitation_' + id] = md.hourly.time.map((_, h) => {
      const day = Math.floor(h / 24), hr = h % 24;
      if (day === 1 && hr >= 12 && hr < 16) return (2 + i) / 4;
      if (day === 2 && hr >= 8 && hr < 18) return (9 + i * 2) / 10;
      return 0;
    });
  });
  return md; // ARPEGE fehlt absichtlich -> Zeile muss wegfallen
}
```

- [ ] **Step 2: Failing Tests** — vor `// Stufe 2: Ziehen vom Griff` einfügen:

```js
  // Modellunsicherheit: Summen und Satz aus den Stundenwerten
  const ms = sb.modelSums(data.md);
  H.check('Modelle: fünf Modelle, Summen heute/morgen aus Stundenwerten, Kurven mit 25 Punkten', ms.length === 5 && ms[0].id === 'icon_d2' && ms[0].today === 0 && ms[0].tomorrow === 2 && ms[4].tomorrow === 6 && ms[0].cum.tomorrow.length === 25 && ms[0].cum.tomorrow[12] === 0 && Math.abs(ms[0].cum.tomorrow[16] - 2) < 1e-9 && ms[0].cum.tomorrow[24] === 2, JSON.stringify(ms.map(m => [m.id, m.today, m.tomorrow])));
  H.check('Modelle: Übereinstimmungssatz morgen (Spanne 4 mm > 2 mm)', sb.agreementText('morgen', ms.map(m => m.tomorrow)) === 'Für morgen sind sich die Modelle weitgehend einig: Regen, aber die Menge schwankt zwischen 2,0 und 6,0 mm.', sb.agreementText('morgen', ms.map(m => m.tomorrow)));
  H.check('Modelle: Sätze einig/uneinig', sb.agreementText('heute', [0, 0.2, 0.4]) === 'Für heute sind sich die Modelle einig: trocken.' && sb.agreementText('morgen', [3, 3.5, 4]) === 'Für morgen sind sich die Modelle einig: Regen, um 3,5 mm.' && sb.agreementText('morgen', [0, 0, 0, 2, 3, 4]) === 'Für morgen sind sich die Modelle uneinig: 3 von 6 rechnen mit Regen.' && sb.agreementText('morgen', [0, 2, 3, 4, 5, 6]) === 'Für morgen sind sich die Modelle weitgehend einig: 5 von 6 rechnen mit Regen.' && sb.agreementText('morgen', [1]) === '', [sb.agreementText('morgen', [0, 0, 0, 2, 3, 4]), sb.agreementText('morgen', [0, 2, 3, 4, 5, 6])].join(' | '));
  const band = sb.ensembleBand(data.ens, '2026-09-26');
  H.check('Modelle: Ensemble-Band morgen, 21 Läufe, 14 mit Regen', band && band.lo.length === 25 && band.hi.length === 25 && band.sums.length === 21 && band.sums.filter(v => v >= 0.1).length === 14 && band.hi[24] >= band.lo[24] && band.lo[0] === 0, band && JSON.stringify([band.sums.length, band.hi[24], band.lo[24]]));
```

- [ ] **Step 3: Fehlschlag** — `node tests/smoke-design.js 2>&1 | tail -3` → `TypeError: sb.modelSums is not a function`.

- [ ] **Step 4: `fetchModels`** in `wetter-core.js`: `daily: "precipitation_sum"` → `daily: "precipitation_sum",\n        hourly: "precipitation"`.

- [ ] **Step 5: Funktionen** — in `design.js` vor `function dModels(`:

```js
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

/* Je Modell Tagessummen heute/morgen und Summenkurven, alles aus den Stundenwerten */
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
```

`quantile` und `fmtMm` kommen aus `wetter-core.js`.

- [ ] **Step 6: Tests, Commit** — `npm test` grün (die klassische Suite nutzt weiter `md.daily`); Commit „Compute model day sums, cumulative curves, ensemble band and agreement text".

---

### Task 2: Darstellung, Hervorhebung, CSS

**Files:** Modify `design.js` (`dModels`, `initReplay`-Delegat), `modern.css`, `design.css`; Test `tests/smoke-design.js`

- [ ] **Step 1: Failing Tests** — hinter den Task-1-Checks:

```js
  const mm = G(sb,'models').innerHTML;
  H.check('Modelle: Satz, SVG mit 10 Linien, Band, Jetzt-Marker, ICON-D2 hervorgehoben', mm.startsWith('<div class="agree">Für morgen sind sich die Modelle weitgehend einig') && (mm.match(/class="ml m-[a-z0-9_]+( hl)?" pathLength="1"/g) || []).length === 10 && (mm.match(/class="ml m-icon_d2 hl"/g) || []).length === 2 && (mm.match(/<polygon class="band"/g) || []).length === 2 && mm.includes('class="now"') && mm.includes('>Heute<') && mm.includes('>Morgen<') && mm.includes('>2,0 mm<'), mm.slice(0, 200));
  H.check('Modelle: Chips mit data-model, ICON-D2 hl, Werte aus Stundenwerten', mm.includes('class="mchip hl" data-model="icon_d2"') && mm.includes('data-model="ukmo_seamless"') && /data-count="6"[^>]*>6,0<\/span>/.test(mm) && (mm.match(/class="mchip( hl)?" data-model=/g) || []).length === 5, mm.slice(mm.indexOf('mchips'), mm.indexOf('mchips') + 200));
  H.check('Modelle: Ensemble-Zeile für morgen mit Zählwerten', /ICON-D2-Ensemble, morgen: 0 bis [\d,]+ mm, Median [\d,]+ mm · 14 von 21 Läufen mit Regen\./.test(mm) && !/% der/.test(mm), mm.slice(mm.indexOf('ICON-D2-Ensemble'), mm.indexOf('ICON-D2-Ensemble') + 100));
  sb.highlightModel('gfs_seamless');
  H.check('Modelle: Hervorhebung wechselbar ohne Fehler', true);
```

- [ ] **Step 2: `dModels` ersetzen**:

```js
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
            out += '<polygon class="band" points="' + pts.trim() + '"/>';
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

/* Hervorhebung wechseln: Klassen auf Pfaden und Chips, Band nur bei ICON-D2 sichtbar */
function highlightModel(id) {
    hlModel = id;
    const box = D("models");
    if (!box || !box.querySelectorAll) return;
    Array.prototype.slice.call(box.querySelectorAll(".ml, .mchip")).forEach(function (el) {
        const mine = el.classList.contains("m-" + id) || el.getAttribute("data-model") === id;
        el.classList.toggle("hl", !!mine);
    });
    Array.prototype.slice.call(box.querySelectorAll(".band")).forEach(function (el) { el.classList.toggle("off", id !== "icon_d2"); });
    Array.prototype.slice.call(box.querySelectorAll(".end")).forEach(function (el) { el.textContent = ""; });
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

    let agree = agreementText("morgen", models.map(function (m) { return m.tomorrow; }));
    if (isNum(nowHour) && nowHour < 12) {
        const t = agreementText("heute", models.map(function (m) { return m.today; }));
        if (t) agree = t + " " + agree;
    }

    const num = function (v) { return isNum(v) ? '<span data-count="' + Number(v.toFixed(1)) + '" data-decimals="' + (v >= 0.05 && v < 10 ? 1 : 0) + '">' + fmtMm(v) + '</span>' : '–'; };
    const chips = models.map(function (m, i) {
        return '<div class="mchip' + (m.id === hl ? ' hl' : '') + '" data-model="' + m.id + '" style="animation-delay:' + dl(2.0 + i * 0.07) + 's"><span class="k">' + m.name + '</span><span class="v">' + num(m.today) + ' / ' + num(m.tomorrow) + '</span></div>';
    }).join('');

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
```

Hinweis: `quantile(sorted, q)` aus `wetter-core.js` erwartet sortierte Werte; `b.sums` ist sortiert.

- [ ] **Step 3: Klick-Delegat** — in `initReplay` vor `if (t.closest("a, button, input")) return;` einfügen:

```js
            const chip = t.closest(".mchip");
            if (chip && chip.getAttribute("data-model")) { highlightModel(chip.getAttribute("data-model")); return; }
```

- [ ] **Step 4: CSS `modern.css`** — nach `.mchip .v { … }`:

```css
.mchip.hl { background: var(--dark); color: var(--white); }
.mchip.hl .k { color: var(--dark-muted); }
.agree { font-size: 14px; font-weight: 600; line-height: 1.4; margin-bottom: 10px; }
.mchart { width: 100%; height: auto; display: block; margin-bottom: 10px; overflow: visible; }
.mchart .base { stroke: rgba(30,27,46,0.18); stroke-width: 1; }
.mchart .lbl { font-size: 10px; font-weight: 700; fill: var(--ink-2); }
.mchart .end { font-size: 9px; font-weight: 700; fill: var(--ink); }
.mchart .now { stroke: var(--ink-2); stroke-width: 1; stroke-dasharray: 2 2; }
.mchart .band { fill: var(--rain); opacity: 0.7; animation: aFade 1.2s ease both; transition: opacity 0.4s; }
.mchart .band.off { opacity: 0; }
.mchart .ml { fill: none; stroke: #B9B4C8; stroke-width: 1.2; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1; animation: aDraw 1.6s ease-out both; transition: stroke 0.3s, stroke-width 0.3s; }
.mchart .ml.hl { stroke: var(--dark); stroke-width: 2.2; }
@keyframes aDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
```

`design.css` nach `.mchip .v { … }` (Keyframe `aDraw` dort ebenfalls anlegen):

```css
.mchip.hl { background: rgba(255,255,255,0.22); }
.agree { font-size: 14px; line-height: 1.4; margin-bottom: 10px; }
.mchart { width: 100%; height: auto; display: block; margin-bottom: 10px; overflow: visible; }
.mchart .base { stroke: rgba(255,255,255,0.2); stroke-width: 1; }
.mchart .lbl { font-size: 10px; fill: var(--ink-3); text-transform: uppercase; letter-spacing: 0.4px; }
.mchart .end { font-size: 9px; font-weight: 600; fill: var(--ink); }
.mchart .now { stroke: rgba(255,255,255,0.5); stroke-width: 1; stroke-dasharray: 2 2; }
.mchart .band { fill: rgba(143,208,255,0.25); animation: aFade 1.2s ease both; transition: opacity 0.4s; }
.mchart .band.off { opacity: 0; }
.mchart .ml { fill: none; stroke: rgba(255,255,255,0.35); stroke-width: 1.2; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1; animation: aDraw 1.6s ease-out both; transition: stroke 0.3s, stroke-width 0.3s; }
.mchart .ml.hl { stroke: #ffffff; stroke-width: 2.2; }
@keyframes aDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
```

- [ ] **Step 5: Tests, Commit** — `npm test` grün; Commit „Draw cumulative rain curves per model with the ICON-D2 ensemble band".

---

### Task 3: Sichtprüfung, Version, README, Push

- [ ] Versions-Query `20261008p` (Test zuerst), README: Modellvergleich-Beschreibung um Summenkurven und Übereinstimmungssatz ergänzen.
- [ ] Simulator beide Designs: Kurven zeichnen sich, Band am ICON-D2, Chip-Tipp hebt ein anderes Modell hervor und blendet das Band aus, Feld-Tipp zeichnet neu. Browser: Konsole.
- [ ] Commit, Push, Pages-Prüfung (`v=20261008p`, `function modelChartSvg`).
