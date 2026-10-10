# Zeitreise Stufe 2 · Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vom Ring (gewählte Stunde) aus waagerecht ziehen wählt Stunde für Stunde; Ring und Hero folgen, die Leiste scrollt dabei nicht.

**Architecture:** Zustandsmaschine `scrub` in `design.js` mit testbaren Top-Level-Funktionen (`scrubStart`, `scrubMove`, `scrubEnd`, `columnAt`), Ereignisbindung per Delegation an `#hourly` in `initScrub()`. `selectHour`/`clearHour`/`updateHero` bekommen `quiet`. CSS: Griff mit `touch-action: pan-y`, Anheben während `scrubbing`.

**Tech Stack:** Vanilla JS, Touch- und Maus-Ereignisse, CSS in `modern.css`/`design.css`, Node-Smoke-Tests.

**Spezifikation:** `docs/superpowers/specs/2026-10-08-zeitreise-stufe2-design.md`

---

### Task 1: Zustandsmaschine mit Tests

**Files:**
- Modify: `design.js` (`updateHero`, `selectHour`, `clearHour`, neuer Block danach)
- Test: `tests/smoke-design.js`

- [ ] **Step 1: Failing Tests** — nach dem Check `'Zeitreise: Jetzt stellt Hoch/Tief/Gefühlt wieder her, kein Knopf mehr'` einfügen:

```js
  // Stufe 2: Ziehen vom Griff. Harness ohne Touch/Layout → Zustandsmaschine direkt, columnAt als Stub
  const colStub = (i, sel) => ({ classList: { contains: c => c === 'sel' && sel }, getAttribute: a => a === 'data-i' ? i : null });
  sb.selectHour(20);
  H.check('Ziehen: Start nur auf der markierten Spalte', sb.scrubStart(10, 10, colStub('20', false)) === false && sb.scrubStart(10, 10, colStub('20', true)) === true && !sb.scrubActive());
  sb.columnAt = (x) => x > 100 ? colStub('42', false) : (x < 0 ? colStub(null, false) : colStub('20', false));
  H.check('Ziehen: erster Zug waagerecht aktiviert, Hero bleibt bei 20 Uhr', sb.scrubMove(14, 12) === 'scrub' && sb.scrubActive() && G(sb,'hero').innerHTML.includes('Heute, 20 Uhr'));
  H.check('Ziehen: Zug auf Stunde 42 wechselt das Hero', sb.scrubMove(150, 12) === 'scrub' && G(sb,'hero').innerHTML.includes('Morgen, 18 Uhr'), G(sb,'hero').innerHTML.slice(0, 120));
  H.check('Ziehen: Zug auf "Jetzt" beendet die Vorschau, bleibt aber aktiv', sb.scrubMove(-5, 12) === 'scrub' && sb.scrubActive() && G(sb,'hero').innerHTML.includes('Hoch 18°'));
  H.check('Ziehen: zurück auf eine Stunde wählt wieder', sb.scrubMove(150, 12) === 'scrub' && G(sb,'hero').innerHTML.includes('Morgen, 18 Uhr'));
  sb.scrubEnd();
  H.check('Ziehen: Loslassen beendet, Auswahl bleibt', !sb.scrubActive() && G(sb,'hero').innerHTML.includes('Morgen, 18 Uhr') && sb.scrubMove(10, 10) === 'idle');
  H.check('Ziehen: senkrechter erster Zug gibt die Geste frei', sb.scrubStart(10, 10, colStub('42', true)) === true && sb.scrubMove(11, 40) === 'release' && !sb.scrubActive() && G(sb,'hero').innerHTML.includes('Morgen, 18 Uhr'));
  sb.clearHour();
```

- [ ] **Step 2: Fehlschlag prüfen** — `node tests/smoke-design.js 2>&1 | tail -4` → `TypeError: sb.scrubStart is not a function`.

- [ ] **Step 3: `quiet` einführen** — in `design.js`:

`function updateHero(f) {` → `function updateHero(f, quiet) {`; die beiden Zeilen `flip(meta);` und `chips.classList.toggle("preview", !f.now); flip(chips);` werden zu `if (!quiet) flip(meta);` bzw. `chips.classList.toggle("preview", !f.now); if (!quiet) flip(chips);`.

`selectHour`/`clearHour`:

```js
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
```

- [ ] **Step 4: Zustandsmaschine** — direkt nach `clearHour` einfügen:

```js
/* ---- Zeitreise Stufe 2: Ziehen vom Griff (markierte Spalte) ---- */

const scrub = { pending: false, active: false, x0: 0, y0: 0, lastX: 0, lastY: 0, raf: null, endedAt: 0 };
const SCRUB_EDGE = 36, SCRUB_STEP = 6;

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
    applyScrubColumn(columnAt(x, y));
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
        if (dx) { strip.scrollLeft += dx; applyScrubColumn(columnAt(scrub.lastX, scrub.lastY)); }
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
```

- [ ] **Step 5: Tests** — `npm test` → viermal „Alle Checks bestanden."

- [ ] **Step 6: Commit** — `git add design.js tests/smoke-design.js && git commit -m "Add the scrub state machine for dragging from the selected hour"`

---

### Task 2: Ereignisse, CSS, Klick-Schutz

**Files:**
- Modify: `design.js` (`initReplay` Klick-Delegat, neues `initScrub()` neben `initReplay`, Aufruf im Start-Block)
- Modify: `modern.css`, `design.css`

- [ ] **Step 1: `initScrub()`** — vor `function initParticles()` einfügen und im Start-Block nach `initReplay();` aufrufen:

```js
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
        window.addEventListener("mousemove", function (ev) { scrubMove(ev.clientX, ev.clientY); });
        window.addEventListener("mouseup", scrubEnd);
    }
```

Klick-Delegat in `initReplay`: als erste Zeile nach `if (!t || !t.closest) return;` ergänzen:

```js
            if (scrub.endedAt && Date.now() - scrub.endedAt < 300) return;   /* Klick nach Maus-Ziehen */
```

- [ ] **Step 2: CSS `modern.css`** — nach `.hcol.sel .t { … }`:

```css
.hcol.sel { touch-action: pan-y; cursor: grab; transition: transform 0.15s ease, box-shadow 0.15s ease; }
.strip { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.strip.scrubbing { cursor: grabbing; }
.strip.scrubbing .hcol.sel { transform: translateY(-2px) scale(1.04); box-shadow: 0 6px 16px rgba(30,27,46,0.18); }
```

`design.css` nach `.hcol.sel .t { … }`:

```css
.hcol.sel { touch-action: pan-y; cursor: grab; transition: transform 0.15s ease, box-shadow 0.15s ease; }
.strip { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.strip.scrubbing { cursor: grabbing; }
.strip.scrubbing .hcol.sel { transform: translateY(-2px) scale(1.04); box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
```

- [ ] **Step 3: Tests, Commit** — `npm test` grün; `git add design.js modern.css design.css && git commit -m "Drag from the selected hour to scrub through the forecast"`

---

### Task 3: Sichtprüfung, Version, README, Push

- [ ] **Step 1: Versions-Test** — Shell-Check `20261008m` in `tests/smoke-design.js` auf `20261008n` ändern (drei Vorkommen in der Zeile), Lauf → FAIL.
- [ ] **Step 2: Bump** — `sed -i '' 's/?v=20261008m"/?v=20261008n"/g' index.html radar.html klassisch.html`; README-Satz zur Zeitreise ergänzen: „Vom Ring aus lässt sich mit dem Finger durch die Stunden ziehen."
- [ ] **Step 3: Simulator** (`xcrun simctl openurl … "http://localhost:8000/?v=20261008n"`): Tipp auf Spalte, `swipe` vom Ring aus waagerecht (Dauer 0,8 s) → Hero und Ring folgen, Leiste nicht gescrollt; `swipe` vom Ring senkrecht → Seite scrollt; `swipe` von anderer Spalte → Leiste scrollt; Palette → klassisches Design dasselbe. Browser-Fenster: Maus-Ziehen per `computer left_click_drag`, Konsole ohne Fehler.
- [ ] **Step 4: Commit, Push, Pages** — `git add -A` der geänderten Dateien, Commit „Bump asset version for the hour scrubbing", `git push origin claude/lignano-weather-webapp-e346s0`, nach 60 s `curl` auf `index.html` (4× `v=20261008n`) und `design.js` (`function scrubMove`).
