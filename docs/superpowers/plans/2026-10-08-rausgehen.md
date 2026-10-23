# Rausgehen · Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feld „Rausgehen" mit vier Aktivitäten, Fenster-Sätzen und grüner Spur unter den Stundenspalten.

**Architecture:** Reine Bewertungsfunktionen (`hourFail`, `activityWindows`) in `design.js`, Rendering `dActivity` aus `lastData`, Spur-Zellen in `dHourly`, Klassen-Update ohne Neurendern, Klick-Delegation `initActivity`. CSS in beiden Stylesheets.

**Tech Stack:** Vanilla JS, CSS, Node-Smoke-Tests.

**Spezifikation:** `docs/superpowers/specs/2026-10-08-rausgehen-design.md`

---

### Task 1: Bewertung und Fenster (reine Funktionen) mit Tests

**Files:** Modify `design.js` (nach `clearHour`-Block / vor Scrub-Block), Test `tests/smoke-design.js`

- [ ] **Step 1: Failing Tests** — nach `sb.clearHour();` am Ende des Zeitreise-Blocks (vor „Stufe 2") einfügen:

```js
  // Rausgehen: Bewertung gegen die Mock-Daten (Jetzt = 25.09. 14:15)
  const actOf = id => sb.ACTIVITIES.find(a => a.id === id);
  const walk = sb.activityWindows(sb.lastRendered(), actOf('walk'));
  H.check('Rausgehen: Spaziergang, drei Fenster in Zeitfolge', walk.windows.length === 3 && walk.windows.map(w => w.when + ' · ' + w.facts).join(' | ') === 'Heute 15 bis 21 Uhr · 10°, kaum Regen, wenig Wind | Morgen 7 bis 11 Uhr · 17°, kaum Regen, wenig Wind | Morgen 12 bis 18 Uhr · 15°, kaum Regen, wenig Wind' && walk.windows[0].start === 15, walk.windows.map(w => w.when + ' · ' + w.facts).join(' | '));
  const sit = sb.activityWindows(sb.lastRendered(), actOf('sit'));
  H.check('Rausgehen: Draußen sitzen, Wochentag und Regen-/Windstufen', sit.windows.map(w => w.when + ' · ' + w.facts).join(' | ') === 'Morgen 9 bis 11 Uhr · 18°, kaum Regen, wenig Wind | Sonntag 10 bis 13 Uhr · 19°, Regen bis 20 %, windstill', sit.windows.map(w => w.when + ' · ' + w.facts).join(' | '));
  const run = sb.activityWindows(sb.lastRendered(), actOf('run'));
  H.check('Rausgehen: Fenster über Mitternacht', run.windows[1] && run.windows[1].when === 'Heute 22 bis Morgen 4 Uhr' && run.windows[1].facts.startsWith('4°'), run.windows[1] && run.windows[1].when);
  const none = sb.activityWindows(sb.lastRendered(), { id: 'x', name: 'x', minH: 1, feel: [40, 50], prob: 30, light: 'any' });
  H.check('Rausgehen: kein Fenster mit häufigstem Grund', none.windows.length === 0 && none.reason === 'kalt' && sb.activityNote('kalt').includes('meist zu kalt'), JSON.stringify(none));
```

- [ ] **Step 2: Fehlschlag** — `node tests/smoke-design.js 2>&1 | tail -3` → `TypeError: Cannot read properties of undefined (reading 'find')`.

- [ ] **Step 3: Implementierung** — vor `/* ---- Zeitreise Stufe 2` einfügen:

```js
/* ---- Rausgehen: Aktivitätsfenster ---- */

const ACTIVITIES = [
    { id: "walk", name: "Spaziergang",    minH: 1, feel: [5, 28],  prob: 30, gust: 45,           light: "dusk" },
    { id: "bike", name: "Radfahren",      minH: 2, feel: [8, 30],  prob: 20, wind: 25, gust: 40, light: "day" },
    { id: "run",  name: "Joggen",         minH: 1, feel: [2, 24],  prob: 40, gust: 50,           light: "any" },
    { id: "sit",  name: "Draußen sitzen", minH: 2, feel: [17, 99], prob: 20, wind: 15, gust: 30, light: "any" }
];
const FAIL_WORDS = { nass: "meist zu nass", kalt: "meist zu kalt", warm: "meist zu warm", wind: "meist zu windig", dunkel: "nur bei Tageslicht" };

function sunsetHour(fc, date) {
    const d = fc.daily;
    if (!d || !Array.isArray(d.time) || !Array.isArray(d.sunset)) return null;
    const i = d.time.indexOf(date);
    return i >= 0 && d.sunset[i] ? parseInt(d.sunset[i].slice(11, 13), 10) : null;
}

/* null = Stunde passt, sonst der erste verletzte Grund */
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
```

- [ ] **Step 4: Tests** — `npm test` → viermal grün.
- [ ] **Step 5: Commit** — `git add design.js tests/smoke-design.js && git commit -m "Score hours for four outdoor activities and find time windows"`

---

### Task 2: Feld, Spur, Wahl, Tipp

**Files:** Modify `index.html` (nach dem Stundenfeld), `design.js` (`dHourly`, `renderAllDesign`, `clearRendered`, neue Funktionen, `initReplay`-Delegat, `initActivity`, Start-Block), `modern.css`, `design.css`; Test `tests/smoke-design.js`

- [ ] **Step 1: Failing Tests** — nach den Task-1-Checks einfügen:

```js
  H.check('Rausgehen: Spur mit 48 Zellen in der Leiste, 47 mit data-i', (hh.match(/<div class="act-track">/g) || []).length === 1 && (hh.match(/<i data-i="\d+"><\/i>/g) || []).length === 47 && hh.includes('<div class="act-track"><i></i><i data-i="15"></i>'), hh.slice(hh.indexOf('act-track'), hh.indexOf('act-track') + 80));
  const act = G(sb,'activity').innerHTML;
  H.check('Rausgehen: vier Chips, Spaziergang aktiv, drei Fenster mit Startindex', (act.match(/class="act-chip/g) || []).length === 4 && act.includes('class="act-chip on" data-act="walk"') && act.includes('<button type="button" class="act-win" data-i="15"') && act.includes('<b>Heute 15 bis 21 Uhr</b><span>10°, kaum Regen, wenig Wind</span>') && (act.match(/class="act-win"/g) || []).length === 3, act.slice(0, 300));
  sb.setActivity('sit');
  const act2 = G(sb,'activity').innerHTML;
  H.check('Rausgehen: Wechsel auf Draußen sitzen, Wahl gespeichert', act2.includes('class="act-chip on" data-act="sit"') && act2.includes('<b>Morgen 9 bis 11 Uhr</b>') && sb._store['wetter:activity'] === 'sit', act2.slice(0, 200));
  sb.setActivity('walk');
```

Dazu im Shell-Check am Ende: `idx.includes('id="activityField"')` ergänzen.

- [ ] **Step 2: Markup** — in `index.html` nach dem Stundenfeld (`</div>` nach `<div class="note">Blaue Felder…`):

```html
        <!-- Rausgehen: Zeitfenster für eine Aktivität, als Vorschlag aus festen Schwellen -->
        <div class="field white a-up hidden" id="activityField" style="animation-delay:.9s">
            <h2>Rausgehen <span class="r">Vorschlag</span></h2>
            <div id="activity"></div>
        </div>
```

- [ ] **Step 3: Spur in `dHourly`** — nach der Spalten-Schleife eine Zellen-Schleife, Markup `'<div class="strip"><div class="strip-inner">' + cols + '</div><div class="act-track">' + cells + '</div></div>'` mit `cells += i === 0 ? '<i></i>' : '<i data-i="' + gi + '"></i>'`.

- [ ] **Step 4: Rendering und Zustand** — nach `activityNote`:

```js
let activityId = "walk";

function loadActivity() {
    try { const v = localStorage.getItem("wetter:activity"); if (v && ACTIVITIES.some(function (a) { return a.id === v; })) activityId = v; } catch (e) { /* kein Speicher */ }
}

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
    const act = ACTIVITIES.filter(function (a) { return a.id === activityId; })[0] || ACTIVITIES[0];
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
    if (!ACTIVITIES.some(function (a) { return a.id === id; })) return;
    activityId = id;
    try { localStorage.setItem("wetter:activity", id); } catch (e) { /* kein Speicher */ }
    dActivity();
}
```

In `renderAllDesign` nach `dHourly(...)`: `dActivity();`. In `clearRendered` die ID-Liste um `"activity"` ergänzen und `activityField` verstecken: `["warnings", "insight", "nowcastCard", "activityField"]`. Im Start-Block vor `initScrub();`: `loadActivity(); initActivity();`.

`initActivity()` neben `initScrub`:

```js
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
            const col = D("hourly").querySelector ? D("hourly").querySelector('.hcol[data-i="' + gi + '"]') : null;
            if (col && col.scrollIntoView) col.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
        });
    }
```

Klick-Delegat in `initReplay`: `const col = t.closest(".hcol");` → `const col = t.closest(".hcol, .act-track i");`.

- [ ] **Step 5: CSS** — `modern.css` nach den `.hcol.sel`-Regeln:

```css
/* Rausgehen: Spur unter den Spalten (eigene Zeile, scrollt mit) */
.act-track { display: flex; gap: 6px; margin-top: 6px; height: 4px; }
.act-track i { flex: 0 0 54px; height: 4px; border-radius: 2px; background: transparent; transition: background 0.3s, transform 0.3s; }
.act-track i.on { background: rgba(46,125,79,0.9); }
.act-track i.on.cont { width: 60px; flex-basis: 60px; margin-right: -6px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.act-track i.on.cont:not(.first) { border-top-left-radius: 0; border-bottom-left-radius: 0; }
.act-track i.on.last:not(.first) { border-top-left-radius: 0; border-bottom-left-radius: 0; }
.act-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.act-chip { padding: 8px 14px; border: 0; border-radius: 999px; background: var(--ground); color: var(--ink); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.act-chip.on { background: var(--dark); color: var(--white); }
.act-list { display: flex; flex-direction: column; gap: 8px; }
.act-win { display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 12px 14px; border: 0; border-radius: 16px; background: #E4F1E8; color: var(--ink); font: inherit; cursor: pointer; animation: aUp 0.8s cubic-bezier(.2,.8,.2,1) both; }
.act-win b { font-size: 15px; font-weight: 700; }
.act-win span { font-size: 13px; color: var(--ink-2); }
```

`design.css` entsprechend (Zellen 58 px ohne Abstand, Glas-Chips `rgba(255,255,255,0.12)`, aktiv `rgba(255,255,255,0.28)`, Fenster `rgba(143,208,143,0.16)`, Animation `fadeUp`).

- [ ] **Step 6: Tests, Commit** — `npm test` grün; Commit „Add the Rausgehen field with activity windows and the hour track".

---

### Task 3: Sichtprüfung, Version, README, Push

- [ ] Versions-Query `20261008o` (Test zuerst, dann `sed` in index/radar/klassisch), README-Zeile um „Rausgehen: Zeitfenster für Spaziergang, Rad, Joggen, Draußen sitzen als Vorschlag" ergänzen.
- [ ] Simulator beide Designs: Spur sichtbar, Chip-Wechsel, Tipp auf Fenster → Hero und Leiste. Browser: Konsole.
- [ ] Commit, Push, Pages-Prüfung (`v=20261008o`, `function activityWindows`).
