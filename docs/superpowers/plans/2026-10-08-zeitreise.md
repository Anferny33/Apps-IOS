# Zeitreise Stufe 1 · Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Tipp auf eine Stunde in der Leiste „Nächste Stunden" verwandelt das Hero-Feld in das Wetter dieser Stunde; „Jetzt" stellt das aktuelle Wetter wieder her.

**Architecture:** Alles passiert in `design.js` (Bento-Steuerung) auf vorhandenem Markup. Neu sind ein Modul-Zustand (`lastData`, `previewIdx`), Fakten-Helfer (`nowFacts`, `hourFacts`), gemeinsame Hero-Teilbauer (`heroHtml`, `heroMetaHtml`, `heroChipsHtml`), ein In-place-Update (`updateHero`) mit gleitender Zahl (`glideTo`) sowie eine Erweiterung des vorhandenen Klick-Delegaten. Beide Stylesheets bekommen Markierung, Knopf und Überblendungen.

**Tech Stack:** Vanilla JS (ES5-Stil wie im Rest der Datei), CSS in `modern.css` und `design.css`, Node-Smoke-Tests mit Fake-DOM (`tests/harness.js`), `npm test`.

**Spezifikation:** `docs/superpowers/specs/2026-10-08-zeitreise-design.md`

---

## Vorab

- Repo `~/Projekte/Apps-IOS`, Branch `claude/lignano-weather-webapp-e346s0`. Vor Beginn `git pull --ff-only` (parallele Cloud-Sitzung).
- Tests laufen mit `cd ~/Projekte/Apps-IOS && npm test`; alle vier Suiten müssen „Alle Checks bestanden." melden. Ein einzelner Lauf: `node tests/smoke-design.js`.
- Der Harness (`tests/harness.js`) kennt keine Klick-Delegation, `getAttribute()` liefert `null`, `querySelector()` liefert immer einen Stub, `firstElementChild` gibt es nicht, `requestAnimationFrame`/`matchMedia`/`getComputedStyle` fehlen. Die Tests rufen `sb.selectHour()`/`sb.clearHour()` direkt auf; `design.js` läuft per `vm.runInContext`, Top-Level-Funktionen sind deshalb als `sb.<name>` erreichbar.
- Mock-Daten (`H.mockForecast()`): `current.time = 2026-09-25T14:15`, Stundenindex = Stunden seit `2026-09-25T00:00`. Erwartungen, mit Node aus den Mocks berechnet:

| Index | Zeit | Tageswort | Temp | Gefühlt | Code | Tag | Regen % | Wind |
|---|---|---|---|---|---|---|---|---|
| 20 | 25.09. 20:00 | Heute | 6° | 5° | 2 | Nacht | 0 | 16 |
| 42 | 26.09. 18:00 | Morgen | 10° | 9° | 61 | Tag | 71 | 18 |

- Commit-Fußzeile für jeden Commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Git-Identität ist global gesetzt.

## Dateien

- Modify: `design.js` (Zustand, Fakten, Hero-Bauer, Auswahl, Delegat)
- Modify: `modern.css` (Markierung, Knopf, Überblendung)
- Modify: `design.css` (dasselbe fürs klassische Glas-Design, plus `@keyframes aFade`)
- Modify: `tests/smoke-design.js` (neue Checks)
- Modify: `index.html`, `radar.html`, `klassisch.html` (Versions-Query), `README.md` (Absatz)

---

### Task 1: Zustand, Stundenfakten und `data-i` in der Leiste

**Files:**
- Modify: `design.js` (Modul-Variablen bei Zeile 117, `dHourly` ab Zeile 280, `renderAllDesign` bei Zeile 665, `clearRendered` bei Zeile 632)
- Test: `tests/smoke-design.js`

- [ ] **Step 1: Failing Test schreiben**

In `tests/smoke-design.js` direkt nach dem Check `'Stunden: Wahrscheinlichkeit in allen 48 Spalten (auch unter 10 %)'` einfügen:

```js
  H.check('Stunden: alle Spalten außer "Jetzt" tragen data-i (globaler Stundenindex 15..61)', (hh.match(/<div data-i="\d+" class="hcol/g) || []).length === 47 && hh.includes('data-i="15" class="hcol') && hh.includes('data-i="61" class="hcol') && !/data-i="\d+" class="hcol now/.test(hh), (hh.match(/<div data-i="\d+" class="hcol/g) || []).length);
  H.check('Stundenfakten: Index 42 = Morgen, 18 Uhr, Regen 71 %, Code 61', (() => { const f = sb.hourFacts(sb.lastRendered(), 42); return f && f.label === 'Morgen, 18 Uhr' && f.prob === 71 && f.code === 61 && Math.round(f.temp) === 10 && Math.round(f.wind) === 18 && f.desc === sb.wmo(61)[1]; })(), JSON.stringify(sb.hourFacts(sb.lastRendered(), 42)));
  H.check('Stundenfakten: Index 20 = Heute, 20 Uhr (Nacht), ungültige Indizes = null', (() => { const f = sb.hourFacts(sb.lastRendered(), 20); return f && f.label === 'Heute, 20 Uhr' && f.isDay === 0 && sb.hourFacts(sb.lastRendered(), -1) === null && sb.hourFacts(sb.lastRendered(), 99999) === null; })(), JSON.stringify(sb.hourFacts(sb.lastRendered(), 20)));
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd ~/Projekte/Apps-IOS && node tests/smoke-design.js 2>&1 | tail -8`
Expected: Abbruch mit `TypeError: sb.hourFacts is not a function` (oder drei `FAIL`-Zeilen), Exit-Code 1.

- [ ] **Step 3: Zustand und Helfer in `design.js` anlegen**

Direkt nach `let lastTemp = null;` (Zeile 117) einfügen:

```js
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
```

Hinweis: `longWeekday` steht weiter unten in `design.js` (Zeile 233) und ist als Funktionsdeklaration überall erreichbar; `wmo`, `dayOf`, `isNum`, `ensembleSeries`, `ensembleStats` kommen aus `wetter-core.js`.

- [ ] **Step 4: `dHourly` auf die gemeinsame Rechnung umstellen und `data-i` ausgeben**

`dHourly` (ab Zeile 280) komplett ersetzen:

```js
function dHourly(fc, ens) {
    const box = D("hourly");
    unskel(box);
    const h = fc.hourly;
    const w = hourlyWindow(fc, 48);
    const n = w.end - w.start;
    if (n < 2) { box.innerHTML = '<div class="note">Keine Stundendaten.</div>'; return; }

    const data = lastData && lastData.fc === fc ? lastData : prepareData(fc, ens);

    let cols = "", prevDay = null;
    for (let i = 0; i < n; i++) {
        const gi = w.start + i;
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
    box.innerHTML = '<div class="strip"><div class="strip-inner">' + cols + '</div></div>';
}
```

`data-i` steht bewusst **vor** `class`, damit die vorhandenen Regex-Checks (`class="hcol… wet" style="…"><i class="fill"`) weiter greifen.

- [ ] **Step 5: `renderAllDesign` und `clearRendered` um den Zustand ergänzen**

`renderAllDesign` (Zeile 665) so ändern, dass die Daten vor dem Rendern gemerkt werden:

```js
function renderAllDesign(payload) {
    lastData = prepareData(payload.fc, payload.ens);
    previewIdx = null;
    renderHero(payload.fc);
    renderWarnings(payload.warn, payload.nina);
    dHourly(payload.fc, payload.ens);
    dNowcast(payload.fc);
    renderDays(payload.fc);
    renderDetails(payload.fc, payload.air);
    dModels(payload.md, payload.fc, payload.ens);
    startCounters(D("details"));
    startCounters(D("models"));
    moveTabInk();
}
```

In `clearRendered` (Zeile 632) nach `lastTemp = null;` zwei Zeilen einfügen:

```js
    lastData = null;
    previewIdx = null;
```

- [ ] **Step 6: Tests laufen lassen**

Run: `cd ~/Projekte/Apps-IOS && npm test 2>&1 | grep -E "FAIL|bestanden|fehlgeschlagen"`
Expected: viermal `Alle Checks bestanden.`, keine `FAIL`-Zeile.

- [ ] **Step 7: Commit**

```bash
cd ~/Projekte/Apps-IOS && git add design.js tests/smoke-design.js && git commit -m "Keep rendered data and expose hour facts for the hour preview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Hero-Teilbauer und Jetzt-Fakten

Ziel: `renderHero` erzeugt exakt das heutige Markup, aber aus Teilbauern, die die Vorschau wiederverwendet.

**Files:**
- Modify: `design.js` (`renderHero` ab Zeile 243)
- Test: `tests/smoke-design.js`

- [ ] **Step 1: Failing Test schreiben**

In `tests/smoke-design.js` nach dem Check `'Hero: Hoch/Tief-Chips'` einfügen:

```js
  H.check('Hero-Bauer: Vorschau-Markup ohne Staffelung, mit Jetzt-Knopf und drei Chips', (() => { const html = sb.heroHtml(sb.hourFacts(sb.lastRendered(), 42), false); return html.startsWith('<div class="meta"><span>Morgen, 18 Uhr</span><span>') && html.includes('<div class="temp">10°</div>') && html.includes('<button type="button" class="now-btn" id="heroNow">Jetzt</button><span>Gefühlt 9°</span><span>Regen 71 %</span><span>Wind 18 km/h</span>') && !html.includes('a-up'); })(), sb.heroHtml(sb.hourFacts(sb.lastRendered(), 42), false).slice(0, 220));
  H.check('Hero-Bauer: Jetzt-Markup entspricht dem gerenderten Hero', sb.heroHtml(sb.nowFacts(fc), true).replace(/animation-delay:[\d.]+s/g, 'D') === hero.replace(/animation-delay:[\d.]+s/g, 'D'), sb.heroHtml(sb.nowFacts(fc), true).slice(0, 160));
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd ~/Projekte/Apps-IOS && node tests/smoke-design.js 2>&1 | tail -6`
Expected: `TypeError: sb.heroHtml is not a function`, Exit-Code 1.

- [ ] **Step 3: Teilbauer schreiben und `renderHero` umbauen**

Vor `function renderHero(fc)` (Zeile 243) einfügen:

```js
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

function heroMetaHtml(f) {
    return '<span>' + f.label + '</span><span>' + f.desc + '</span>';
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
        out += '<button type="button" class="now-btn" id="heroNow">Jetzt</button>';
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
        '<div class="chips">' + heroChipsHtml(f, intro) + '</div>';
}
```

Dann in `renderHero` den Block von `const c = fc.current, d = fc.daily;` bis einschließlich `if (first) countUp(...)` ersetzen durch:

```js
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
```

Der Rest von `renderHero` (Hinweis-Feld ab `const ins = D("insight");`) bleibt unverändert; er nutzt weiterhin `d` und `nc`. Die frühere Variable `c` entfällt.

- [ ] **Step 4: Tests laufen lassen**

Run: `cd ~/Projekte/Apps-IOS && npm test 2>&1 | grep -E "FAIL|bestanden|fehlgeschlagen"`
Expected: viermal `Alle Checks bestanden.`. Insbesondere müssen die alten Checks `Hero: Temperatur groß` (`class="temp fade-in">17°`), `Hero: Zustand in der Kopfzeile + Gefühlt-Chip` und `Hero: Hoch/Tief-Chips` weiter bestehen.

- [ ] **Step 5: Commit**

```bash
cd ~/Projekte/Apps-IOS && git add design.js tests/smoke-design.js && git commit -m "Build the hero from shared parts so a preview can reuse them

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Auswahl, In-place-Update, gleitende Zahl, Tipp-Erkennung, CSS

**Files:**
- Modify: `design.js` (`countUpEl` Zeile 131, neue Funktionen nach `heroHtml`, Klick-Delegat Zeile 904)
- Modify: `modern.css` (nach `.hcol.now .t, .hcol.now .p` Zeile 179 und nach `.hero-field .chips span` Zeile 98)
- Modify: `design.css` (nach `.hcol.now` Zeile 226, nach `.hero-field .chips span:last-child::after` Zeile 167, Keyframes bei Zeile 211)
- Test: `tests/smoke-design.js`

- [ ] **Step 1: Failing Tests schreiben**

In `tests/smoke-design.js` nach den Checks aus Task 2 (hinter `'Hero-Bauer: Jetzt-Markup entspricht dem gerenderten Hero'`) einfügen:

```js
  // Zeitreise: Stunde wählen, Hero folgt; Jetzt stellt wieder her. Im Harness fehlt firstElementChild,
  // deshalb baut updateHero das Hero komplett neu und innerHTML ist prüfbar.
  const heroNow = G(sb,'hero').innerHTML;
  sb.selectHour(42);
  const hv = G(sb,'hero').innerHTML;
  H.check('Zeitreise: Hero zeigt Morgen, 18 Uhr mit Jetzt-Knopf, Regen- und Wind-Chip, ohne Hoch/Tief', hv.includes('<span>Morgen, 18 Uhr</span>') && hv.includes('id="heroNow"') && hv.includes('Regen 71 %') && hv.includes('Wind 18 km/h') && hv.includes('>10°<') && !hv.includes('Hoch '), hv.slice(0, 200));
  H.check('Zeitreise: Theme folgt der Stunde (Code 61 -> Regen)', body.classList.contains('theme-rain'), [...body.classList.c]);
  sb.selectHour(42);
  H.check('Zeitreise: erneuter Tipp auf dieselbe Stunde ändert nichts', G(sb,'hero').innerHTML === hv);
  sb.selectHour(-1); sb.selectHour(99999);
  H.check('Zeitreise: ungültige Indizes ändern nichts', G(sb,'hero').innerHTML === hv);
  sb.selectHour(20);
  H.check('Zeitreise: Wechsel auf Heute, 20 Uhr (Nacht)', G(sb,'hero').innerHTML.includes('<span>Heute, 20 Uhr</span>') && G(sb,'hero').innerHTML.includes('wx-teilsnacht') && G(sb,'hero').innerHTML.includes('>6°<'), G(sb,'hero').innerHTML.slice(0, 160));
  sb.clearHour();
  const hb = G(sb,'hero').innerHTML;
  H.check('Zeitreise: Jetzt stellt Hoch/Tief/Gefühlt wieder her, kein Knopf mehr', hb.includes('Hoch 18°') && hb.includes('Tief 8°') && hb.includes('Gefühlt 16°') && hb.includes('>17°<') && !hb.includes('heroNow') && body.classList.contains('theme-partly-day'), hb.slice(0, 200));
  sb.selectHour(42);
  sb.renderAllDesign({ fc, ens: data.ens, md: data.md, air: data.air, warn: data.warn, nina: data.nina });
  H.check('Zeitreise: Neurendern beendet die Vorschau', G(sb,'hero').innerHTML.includes('Hoch 18°') && !G(sb,'hero').innerHTML.includes('heroNow') && sb.lastRendered().fc === fc, G(sb,'hero').innerHTML.slice(0, 120));
  // Nach dem Neurendern wieder die Ausgangslage für die folgenden Checks herstellen
  H.check('Zeitreise: Ausgangs-Hero nach Neurendern identisch bis auf Verzögerungen', G(sb,'hero').innerHTML.replace(/animation-delay:[\d.]+s/g, 'D') === heroNow.replace(/animation-delay:[\d.]+s/g, 'D'));
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd ~/Projekte/Apps-IOS && node tests/smoke-design.js 2>&1 | tail -6`
Expected: `TypeError: sb.selectHour is not a function`, Exit-Code 1.

- [ ] **Step 3: `countUpEl` abbrechbar machen**

In `countUpEl` (Zeile 131) die beiden `requestAnimationFrame(step)`-Aufrufe so ändern, dass die Kennung am Element liegt, und ein laufendes Gleiten vorher abbrechen. Die Funktion danach vollständig:

```js
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
```

- [ ] **Step 4: Auswahl und In-place-Update schreiben**

Direkt nach `function heroHtml(f, intro) { … }` (aus Task 2) einfügen:

```js
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
function updateHero(f) {
    const hero = D("hero");
    if (!hero) return;
    setTheme(themeFor(f.code, f.isDay));
    lastTemp = isNum(f.temp) ? Math.round(f.temp) : null;
    const meta = hero.querySelector ? hero.querySelector(".meta") : null;
    if (!meta || !hero.firstElementChild) { hero.innerHTML = heroHtml(f, false); return; }

    meta.innerHTML = heroMetaHtml(f);
    flip(meta);
    const chips = hero.querySelector(".chips");
    if (chips) { chips.innerHTML = heroChipsHtml(f, false); flip(chips); }

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

function selectHour(gi) {
    const f = hourFacts(lastData, gi);
    if (!f || gi === previewIdx) return;
    previewIdx = gi;
    markHour(gi);
    updateHero(f);
}

function clearHour() {
    if (previewIdx === null || !lastData) return;
    previewIdx = null;
    markHour(null);
    updateHero(nowFacts(lastData.fc));
}
```

- [ ] **Step 5: Klick-Delegat erweitern**

Den Block bei Zeile 904 (`document.body.addEventListener("click", function (ev) {`) ersetzen durch:

```js
        document.body.addEventListener("click", function (ev) {
            const t = ev.target;
            if (!t || !t.closest) return;
            /* Zeitreise: Jetzt-Knopf im Hero, Spalte mit Stundenindex, Spalte „Jetzt" */
            if (t.closest("#heroNow")) { clearHour(); return; }
            const col = t.closest(".hcol");
            if (col) {
                const i = col.getAttribute("data-i");
                if (i === null) clearHour(); else selectHour(parseInt(i, 10));
                return;
            }
            if (t.closest("a, button, input")) return;
            const box = t.closest(".tile, .field");
            if (!box) return;
            restartAnimations(box);
            if (box.id === "hero" && lastTemp !== null) countUp(box.querySelector(".temp"), lastTemp);
            else startCounters(box);
        });
```

- [ ] **Step 6: CSS im Bento-Design (`modern.css`)**

Nach Zeile 179 (`.hcol.now .t, .hcol.now .p { … }`) einfügen:

```css
/* Zeitreise: gewählte Stunde. Ring als ::after, damit er über dem Regen-Füllstand liegt */
.hcol.sel::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px var(--ink); z-index: 2; pointer-events: none; }
.hcol.sel .t { color: var(--ink); font-weight: 700; }
```

Nach Zeile 98 (`.hero-field .chips span { … }`) einfügen:

```css
.hero-field .chips .now-btn { padding: 7px 12px; background: var(--dark); color: var(--white); border: 0; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.hero-field .flip { animation: aFade 0.25s ease both; }
.hero-field .big-icon.swap-in { animation: aFade 0.2s ease both; }
```

`aFade` existiert in `modern.css` bereits (Zeile 355).

- [ ] **Step 7: CSS im klassischen Design (`design.css`)**

Nach Zeile 226 (`.hcol.now { background: rgba(255,255,255,0.1); }`) einfügen:

```css
.hcol.sel::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.85); z-index: 2; pointer-events: none; }
.hcol.sel .t { color: var(--ink); font-weight: 600; }
```

Nach Zeile 167 (`.hero-field .chips span:last-child::after { content: none; }`) einfügen:

```css
.hero-field .chips .now-btn { padding: 6px 12px; background: rgba(255,255,255,0.18); color: var(--ink); border: 1px solid rgba(255,255,255,0.35); border-radius: 999px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.hero-field .flip { animation: aFade 0.25s ease both; }
.hero-field .big-icon.swap-in { animation: aFade 0.2s ease both; }
```

Neben `@keyframes fadeUp` (Zeile 211) ergänzen:

```css
@keyframes aFade { from { opacity: 0; } to { opacity: 1; } }
```

- [ ] **Step 8: Tests laufen lassen**

Run: `cd ~/Projekte/Apps-IOS && npm test 2>&1 | grep -E "FAIL|bestanden|fehlgeschlagen"`
Expected: viermal `Alle Checks bestanden.`.

- [ ] **Step 9: Commit**

```bash
cd ~/Projekte/Apps-IOS && git add design.js modern.css design.css tests/smoke-design.js && git commit -m "Tap an hour to preview it in the hero, back with Jetzt

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Sichtprüfung im Simulator, Versions-Query, README, Push

**Files:**
- Modify: `index.html` (Zeilen 19, 20, 135, 136), `radar.html` (17, 18), `klassisch.html` (97)
- Modify: `README.md` (Zeile 11)
- Test: `tests/smoke-design.js` (Shell-Check)

- [ ] **Step 1: Failing Test für die Versions-Query**

In `tests/smoke-design.js` den Shell-Check `'Shell: Tab-Pille und Design-Schleier in index.html und radar.html'` um eine Zeile ergänzen:

```js
  H.check('Shell: Versions-Query 20261008m an allen Asset-Links', (idx.match(/\?v=20261008m"/g) || []).length === 4 && (rad.match(/\?v=20261008m"/g) || []).length === 2 && fs.readFileSync(require('path').join(__dirname, '..', 'klassisch.html'), 'utf8').includes('wetter-core.js?v=20261008m"'), (idx.match(/\?v=\w+"/g) || []).join(','));
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd ~/Projekte/Apps-IOS && node tests/smoke-design.js 2>&1 | grep -E "FAIL|bestanden"`
Expected: eine `FAIL`-Zeile `Shell: Versions-Query 20261008m …`.

- [ ] **Step 3: Versions-Query erhöhen**

```bash
cd ~/Projekte/Apps-IOS && sed -i '' 's/?v=20261008l"/?v=20261008m"/g' index.html radar.html klassisch.html && grep -c "v=20261008m" index.html radar.html klassisch.html
```
Expected: `index.html:4`, `radar.html:2`, `klassisch.html:1`.

- [ ] **Step 4: README ergänzen**

In `README.md` Zeile 11 (Tabellenzeile `index.html` + `design.js`) den Text „Hero, Stundenfelder, Kacheln, 14 Tage, Modellvergleich, Ortssuche." erweitern zu:

```
Hero, Stundenfelder, Kacheln, 14 Tage, Modellvergleich, Ortssuche. Zeitreise: ein Tipp auf eine Stunde zeigt deren Wetter im Hero („Morgen, 17 Uhr"), „Jetzt" stellt das aktuelle Wetter wieder her.
```

- [ ] **Step 5: Tests laufen lassen**

Run: `cd ~/Projekte/Apps-IOS && npm test 2>&1 | grep -E "FAIL|bestanden|fehlgeschlagen"`
Expected: viermal `Alle Checks bestanden.`.

- [ ] **Step 6: Sichtprüfung im Simulator (beide Designs)**

Lokaler Server läuft auf Port 8000 (sonst `cd ~/Projekte/Apps-IOS && nohup npm start >/dev/null 2>&1 &`). iPhone 17 Pro, UDID `8E971BB2-02A2-4873-8D25-FC0454EDC203`:

```bash
xcrun simctl openurl 8E971BB2-02A2-4873-8D25-FC0454EDC203 "http://localhost:8000/?v=20261008m"
```

Mit dem Simulator-Werkzeug (`mcp__Claude_Code_iOS_Simulator__control`, Aktionen `screenshot`, `tap`, `swipe`) prüfen:

1. Tipp auf eine Spalte von morgen: Ring sichtbar, Hero-Meta „Morgen, NN Uhr", dunkler Knopf „Jetzt", Chips Gefühlt/Regen/Wind. Screenshots 0,2 s und 0,8 s nach dem Tipp: Zahl gleitet, kein Sprung über 0.
2. Zwei Tipps kurz hintereinander auf verschiedene Spalten: Zahl gleitet vom Zwischenwert weiter.
3. Tipp auf eine Spalte mit anderer Wetterart (Regen vs. Sonne): Icon wechselt, Hintergrund driftet; gleiche Wetterart: Icon-Schleife läuft ohne Neustart.
4. Wischen über die Leiste scrollt wie bisher, Ring bleibt auf der gewählten Spalte.
5. Tipp auf „Jetzt" im Hero und alternativ auf die Spalte „Jetzt": Hoch/Tief/Gefühlt zurück, Ring weg.
6. Tipp auf den Aktualisieren-Knopf während einer Vorschau: Vorschau endet.
7. Palette-Knopf: dasselbe im klassischen Design (weißer Ring, Glas-Knopf).
8. Browser-Fenster (`preview_start` auf http://localhost:8000): `read_console_messages` ohne Fehler.

Abweichungen zuerst in der Quelle beheben (Hypothese, kleinste Änderung, erneut prüfen), dann `npm test`.

- [ ] **Step 7: Commit und Push**

```bash
cd ~/Projekte/Apps-IOS && git add index.html radar.html klassisch.html README.md tests/smoke-design.js && git commit -m "Bump asset version and document the hour preview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push origin claude/lignano-weather-webapp-e346s0
```

- [ ] **Step 8: GitHub Pages prüfen**

```bash
sleep 60; curl -s "https://anferny33.github.io/Apps-IOS/index.html" | grep -c "v=20261008m"; curl -s "https://anferny33.github.io/Apps-IOS/design.js" | grep -c "function selectHour"
```
Expected: `4` und `1`. Falls `0`: nach 30 s wiederholen (Pages-Build).

Dem Nutzer anschließend sagen: Web-App auf dem iPhone einmal beenden und neu öffnen.

---

## Selbstprüfung gegen die Spezifikation

- Verhalten 1–6: Task 3 (Auswahl, Jetzt-Knopf, Jetzt-Spalte, kein Neustart bei Spalten-Tipp, Neurendern setzt zurück in Task 1, Theme über Body-Klasse).
- Hero in der Vorschau (Tabelle, Tageswort, Wahrscheinlichkeit aus derselben Rechnung, fehlende Werte, Knopf als `<button>`): Task 1 (`hourFacts`, `hourProb`), Task 2 (`heroChipsHtml`, `heroHtml`).
- Markierung (`data-i`, `sel`, Jetzt-Spalte ohne `sel`): Task 1 (`data-i`), Task 3 (`markHour`, CSS).
- Bewegung (Gleiten 0,5 s, Hintergrund unverändert, Icon nur bei Artwechsel, `flip` 0,25 s, reduzierte Bewegung): Task 3.
- Zustand und Datenfluss (`previewIdx`, `lastData`, `lastTemp`): Task 1 und 3.
- Fehlerfälle (ungültiger Index, fehlendes Ensemble, fehlendes `is_day`, Harness-Guards): Task 1 (`hourFacts`/`hourProb`), Task 3 (`updateHero`-Fallback, `markHour`-Guards, `glideTo`-Guards).
- Tests: Tasks 1–4 decken alle in der Spezifikation genannten Checks ab; Sichtprüfung in Task 4.
- Auslieferung (beide Stylesheets, Versions-Query `m`, README, Push, Pages-Check): Tasks 3 und 4.
