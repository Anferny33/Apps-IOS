// Gemeinsamer Harness: lädt wetter-core.js in eine Sandbox mit DOM-/Fetch-Stubs,
// stellt check/finish, feste Testzeit und die Versions-Query der Seiten für alle Suiten bereit.
// Bewusste Einschränkung: Die Suiten synchronisieren über feste Waits (300 bis 1100 ms nach boot(),
// Klicks auf refresh/gps und Klick-Sperren) statt über Haltepunkte aus der Sandbox. Ein Ladezähler in
// design.js plus Polling hier wäre ein Umbau an über 60 Stellen und ersetzt die Waits für Klick-Sperren
// und Animationen nicht; npm test braucht so rund eine halbe Minute, auf sehr langsamen Rechnern
// können einzelne Checks flattern. Dann die Waits erhöhen, nicht die Checks lockern.
// Feste Gerätezone, bevor irgendwo ein Date entsteht: design.js hängt „ Ortszeit“ an, sobald
// Intl.DateTimeFormat().resolvedOptions().timeZone von der Ortszone abweicht; Node übernimmt
// process.env.TZ auch für Intl. So laufen die Suiten in jeder Umgebung gleich (TZ=UTC, New York …).
process.env.TZ = 'Europe/Berlin';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Haltepunkt der Tests (window.TEST_NOW in der Sandbox): 25.09.2026, 14:15 Ortszeit wie in den Mock-Daten
const TEST_NOW = Date.parse('2026-09-25T12:15:00Z');

const SUN = fs.readFileSync(path.join(__dirname, '..', 'sonne.js'), 'utf8');
const CORE = fs.readFileSync(path.join(__dirname, '..', 'wetter-core.js'), 'utf8');

function el() {
  const children = {};
  const handlers = {};
  let html = '';
  const e = {
    // innerHTML-Zuweisung hält textContent wie im Browser synchron (Tags entfernt)
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); e.textContent = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '); },
    textContent: '', value: '', max: '0', className: '',
    style: {},
    classList: {
      c: new Set(),
      add(x){this.c.add(x)}, remove(x){this.c.delete(x)}, contains(x){return this.c.has(x)},
      toggle(x, force){ if (force) this.c.add(x); else this.c.delete(x); }
    },
    addEventListener(ev, fn) { handlers[ev] = fn; },
    trigger(ev, arg) { if (handlers[ev]) return handlers[ev].call(e, arg || {}); },
    setAttribute(k, v) { this[k] = String(v); }, getAttribute(k) { return k in this ? this[k] : null; }, removeAttribute(k) { delete this[k]; },
    focus() { e.focused = true; }, blur() {},
    getBoundingClientRect() { return { width: 640, left: 0 }; },
    querySelector(sel) { return children[sel] || (children[sel] = el()); },
    // Suchtreffer: aus dem innerHTML gerenderte Buttons als klickbare Stubs
    querySelectorAll(sel) {
      if (sel !== '.place') return [];
      const btns = [...e.innerHTML.matchAll(/data-i="(\d+)"/g)].map(m => {
        const h = {};
        return { getAttribute: () => m[1], addEventListener: (ev, fn) => { h[ev] = fn; }, trigger: ev => h[ev] && h[ev]() };
      });
      e._buttons = btns;
      return btns;
    }
  };
  return e;
}

const IDS = ['hourly', 'models', 'updated'];

// --- Mock-Wetterdaten ----------------------------------------------
function mockForecast() {
  const day = '2026-09-25';
  function hours(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const d = 25 + Math.floor(i / 24);
      out.push('2026-09-' + String(d).padStart(2,'0') + 'T' + String(i % 24).padStart(2,'0') + ':00');
    }
    return out;
  }
  const hTimes = hours(72);
  const days = Array.from({length: 14}, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 25 + i));
    return d.toISOString().slice(0, 10);
  });
  const fc = {
    latitude: 48.137, longitude: 11.575, elevation: 520, utc_offset_seconds: 7200, timezone: 'Europe/Berlin',
    current: { time: day + 'T14:15', temperature_2m: 17.4, apparent_temperature: 16.1,
               relative_humidity_2m: 71, precipitation: 0.0, weather_code: 2,
               wind_speed_10m: 12, wind_gusts_10m: 25, wind_direction_10m: 225,
               pressure_msl: 1018.4, cloud_cover: 55, is_day: 1 },
    minutely_15: {
      time: Array.from({length: 96}, (_, i) => day + 'T' + String(Math.floor(i/4)).padStart(2,'0') + ':' + String((i%4)*15).padStart(2,'0')),
      precipitation: Array.from({length: 96}, (_, i) => (i >= 60 && i < 66 ? 0.4 : 0))
    },
    hourly: {
      time: hTimes,
      temperature_2m: hTimes.map((_, i) => 12 + 8 * Math.sin((i % 24 - 5) / 24 * 2 * Math.PI)),
      apparent_temperature: hTimes.map((_, i) => 11 + 8 * Math.sin((i % 24 - 5) / 24 * 2 * Math.PI)),
      precipitation: hTimes.map((_, i) => (i % 7 === 0 ? 1.2 : 0)),
      precipitation_probability: hTimes.map((_, i) => (i * 7) % 100),
      weather_code: hTimes.map((_, i) => (i % 7 === 0 ? 61 : 2)),
      is_day: hTimes.map((_, i) => (i % 24 > 6 && i % 24 < 20 ? 1 : 0)),
      wind_speed_10m: hTimes.map((_, i) => 8 + 10 * Math.abs(Math.sin(i / 9))),
      wind_gusts_10m: hTimes.map((_, i) => 18 + 18 * Math.abs(Math.sin(i / 9))),
      wind_direction_10m: hTimes.map((_, i) => (200 + i * 3) % 360),
      uv_index: hTimes.map((_, i) => Math.max(0, 5 * Math.sin((i % 24 - 6) / 12 * Math.PI))),
      // Bewölkung: zum Sonnenuntergang (19:05) 50 → 60 %, tief 20 %, hoch 40 % → „hohe Wolken, gute Chance auf Farbe“
      cloud_cover: hTimes.map((_, i) => (i % 24 === 19 ? 50 : (i % 24 === 20 ? 60 : 45))),
      cloud_cover_low: hTimes.map(() => 20),
      cloud_cover_high: hTimes.map(() => 40)
    },
    daily: {
      time: days,
      weather_code: days.map((_, i) => [2,61,80,95,3,1,0][i % 7]),
      temperature_2m_max: days.map((_, i) => 18 + ((i * 5) % 9)),
      temperature_2m_min: days.map((_, i) => 8 + ((i * 3) % 6)),
      precipitation_sum: days.map((_, i) => [0, 3.4, 12.7, 22.1, 0.2, 0, 0][i % 7]),
      precipitation_probability_max: days.map((_, i) => [10, 55, 80, 90, 20, 5, 0][i % 7]),
      precipitation_hours: days.map((_, i) => [0,3,6,8,1,0,0][i % 7]),
      wind_speed_10m_max: days.map(() => 22),
      wind_gusts_10m_max: days.map(() => 48),
      wind_direction_10m_dominant: days.map(() => 240),
      uv_index_max: days.map(() => 4.6),
      sunrise: days.map(d => d + 'T07:12'),
      sunset: days.map(d => d + 'T19:05'),
      daylight_duration: days.map(() => 42780),
      sunshine_duration: days.map(() => 21600)
    }
  };
  // Sicht: tagsüber frei, am 26.9. um 05:00 und 06:00 Nebel; Taupunkt 3° unter der Temperatur
  fc.hourly.visibility = hTimes.map((_, i) => (i === 29 || i === 30 ? 400 : 24140));
  fc.hourly.dew_point_2m = fc.hourly.temperature_2m.map(t => t - 3);
  return fc;
}

function mockEnsemble(forecast) {
  const eHours = forecast.hourly.time.slice(0, 48);
  const ens = { hourly: { time: eHours } };
  ens.hourly.precipitation = eHours.map((_, i) => (i % 7 === 0 ? 1.0 : 0));
  for (let m = 1; m <= 20; m++) {
    const k = 'precipitation_member' + String(m).padStart(2, '0');
    ens.hourly[k] = eHours.map((_, i) => (i % 7 === 0 && m % 3 !== 0 ? 0.5 * m / 4 : 0));
  }
  return ens;
}

function mockModels() {
  const md = { daily: { time: ['2026-09-25','2026-09-26','2026-09-27'] }, hourly: { time: [] } };
  for (let h = 0; h < 72; h++) {
    const d = 25 + Math.floor(h / 24);
    md.hourly.time.push('2026-09-' + d + 'T' + String(h % 24).padStart(2, '0') + ':00');
  }
  ['icon_d2','icon_eu','ecmwf_ifs025','gfs_seamless','ukmo_seamless'].forEach((id, i) => {
    md.daily['precipitation_sum_' + id] = [0, 2 + i, 9 + i * 2];
    md.daily['temperature_2m_max_' + id] = [18 + i, 17 + i, 20];
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

function mockAir() {
  return {
    latitude: 48.1, longitude: 11.6, elevation: 524,
    current: {
      time: '2026-09-25T14:00', european_aqi: 34, pm10: 14.2, pm2_5: 8.1, nitrogen_dioxide: 11.3, ozone: 62,
      birch_pollen: 0, grass_pollen: 7, alder_pollen: 0, mugwort_pollen: 12, ragweed_pollen: 1.5, olive_pollen: 0
    },
    hourly: {
      time: Array.from({length: 24}, (_, i) => '2026-09-25T' + String(i).padStart(2,'0') + ':00'),
      grass_pollen: Array.from({length: 24}, (_, i) => (i === 16 ? 15 : 7)),
      mugwort_pollen: Array.from({length: 24}, () => 12),
      ragweed_pollen: Array.from({length: 24}, () => 1.5),
      birch_pollen: Array.from({length: 24}, () => 0),
      alder_pollen: Array.from({length: 24}, () => 0),
      olive_pollen: Array.from({length: 24}, () => 0)
    }
  };
}

// DWD-WFS-Antwort: eine markante Warnung (aktiv), eine Wetterwarnung (bevorstehend),
// eine abgelaufene und eine aufgehobene Meldung (beide müssen wegfallen).
// Zeiten relativ zur Testzeit: normalizeWarnings (wetter-core.js) filtert Abgelaufenes gegen coreNow(),
// fmtWarnTime (design.js) rechnet mit nowMs(); beide lesen window.TEST_NOW, die Mocks laufen also mit derselben Uhr.
function mockWarnings(now) {
  const h = 3600 * 1000;
  now = now || TEST_NOW;
  const iso = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const feat = (p) => ({ type: 'Feature', geometry: null, properties: p });
  return { type: 'FeatureCollection', features: [
    feat({ IDENTIFIER: 'w-wind', SEVERITY: 'Minor', MSGTYPE: 'Alert', EVENT: 'WINDBÖEN', HEADLINE: 'Amtliche WARNUNG vor WINDBÖEN',
           DESCRIPTION: 'Es treten Windböen mit Geschwindigkeiten um 55 km/h (15 m/s, 7 Bft) auf.', INSTRUCTION: '',
           ONSET: iso(now + 2 * h), EXPIRES: iso(now + 8 * h), NAME: 'Stadt München' }),
    feat({ IDENTIFIER: 'w-storm', SEVERITY: 'Moderate', MSGTYPE: 'Alert', EVENT: 'GEWITTER', HEADLINE: 'Amtliche WARNUNG vor GEWITTER',
           DESCRIPTION: 'Von Westen ziehen Gewitter auf.', INSTRUCTION: 'Lose Gegenstände sichern.',
           ONSET: iso(now - h), EXPIRES: iso(now + 3 * h), NAME: 'Stadt München' }),
    feat({ IDENTIFIER: 'w-old', SEVERITY: 'Severe', MSGTYPE: 'Alert', EVENT: 'STARKREGEN', HEADLINE: 'Amtliche UNWETTERWARNUNG vor STARKREGEN',
           ONSET: iso(now - 9 * h), EXPIRES: iso(now - 2 * h), NAME: 'Stadt München' }),
    feat({ IDENTIFIER: 'w-cancel', SEVERITY: 'Minor', MSGTYPE: 'Cancel', EVENT: 'FROST', HEADLINE: 'Aufhebung',
           ONSET: iso(now - h), EXPIRES: iso(now + h), NAME: 'Stadt München' })
  ] };
}

// Antwort des NINA-Proxys: eine Katastrophenschutz-Meldung (Stufe 2) und eine DWD-Doppelung, die wegfallen muss
// Zeiten fest relativ zu TEST_NOW: NINA-Meldungen werden nicht nach Ablauf gefiltert
function mockNina() {
  const iso = t => new Date(t).toISOString();
  return { ars: '091620000000', kreis: 'Kreisfreie Stadt München', fetchedAt: iso(TEST_NOW), warnings: [
    { id: 'mow.TEST-1', provider: 'MOWAS', providerLabel: 'Katastrophenschutz', level: 2, severity: 'Moderate', msgType: 'Alert',
      event: 'Gefahreninformation', headline: 'Großbrand im Gewerbegebiet: Fenster und Türen geschlossen halten',
      description: 'Starke Rauchentwicklung.\nBetroffen ist der Stadtteil Nord.', instruction: 'Fenster und Türen schließen.\nLüftung abschalten.',
      sent: iso(TEST_NOW - 1800 * 1000), onset: null, expires: null, area: 'Stadt München' },
    { id: 'dwd.TEST-2', provider: 'DWD', providerLabel: 'Deutscher Wetterdienst', level: 1, severity: 'Minor', msgType: 'Alert',
      headline: 'Amtliche WARNUNG vor FROST', description: '', instruction: '', sent: iso(TEST_NOW), area: 'Stadt München' }
  ] };
}

function mockGeocode() {
  return { results: [
    { name: 'Hamburg', admin1: 'Hamburg', country: 'Deutschland', latitude: 53.55, longitude: 9.99 },
    { name: 'Hamburg', admin1: 'New Jersey', country: 'USA', latitude: 41.15, longitude: -74.57 }
  ] };
}

// --- Sandbox --------------------------------------------------------
// opts: { fetchImpl, storage, geolocation }
function makeSandbox(opts) {
  opts = opts || {};
  const nodes = {};
  IDS.forEach(i => nodes[i] = el());
  const dyn = {};
  const store = opts.storage || {};
  const fetchLog = [];

  const sb = {
    console, URLSearchParams, Date, Math, Object, Array, JSON,
    isNaN, parseInt, Promise, setTimeout, clearTimeout, Uint8Array,
    atob: (b) => Buffer.from(b, 'base64').toString('binary'), btoa: (b) => Buffer.from(b, 'binary').toString('base64'),
    document: {
      getElementById: id => nodes[id] || (dyn[id] = dyn[id] || el()),
      querySelectorAll: () => [],
      body: el(),
      addEventListener() {}, hidden: false
    },
    scrollTo() {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    fetch: async (url, init) => {
      fetchLog.push(url);
      if (!opts.fetchImpl) throw new Error('Failed to fetch');
      return opts.fetchImpl(url, init);
    },
    navigator: opts.geolocation ? { geolocation: opts.geolocation } : {}
  };
  sb.window = sb;
  sb._nodes = nodes; sb._dyn = dyn; sb._store = store; sb._fetchLog = fetchLog;
  vm.createContext(sb);
  vm.runInContext(SUN, sb);
  vm.runInContext(CORE, sb);
  return sb;
}

function okFetch(data) {
  return async (url) => {
    let body;
    if (url.includes('meta.json')) body = data.meta;
    else if (url.includes('bigdatacloud')) body = data.place || {};
    else if (url.includes('geocoding-api')) body = data.geo || { results: [] };
    else if (url.includes('air-quality')) body = data.air;
    else if (url.includes('ensemble')) body = data.ens;
    else if (url.includes('models=')) body = data.md;
    else if (url.includes('maps.dwd.de')) body = data.warn;
    else if (url.includes('/nina?')) body = data.nina;
    else body = data.fc;
    if (body === undefined || body === null) throw new Error('not available');
    return { ok: true, json: async () => body };
  };
}

// --- Versions-Query der Seiten ---------------------------------------
// Referenz ist das erste ?v= am Stylesheet modern.css in index.html. Gesammelt werden alle lokalen
// css/js-Verweise und Icon-Links (icons/…) aus index.html und radar.html (auch ohne Query, damit ein
// vergessenes ?v= auffällt) sowie SW_VERSION aus sw.js.
const ASSET_RE = /(?:href|src)="([\w-]+\.(?:css|js)|icons\/[\w.-]+)(?:\?v=(\w+))?"/g;
function assetVersion() {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const idx = read('index.html');
  const version = (idx.match(/href="modern\.css\?v=(\w+)"/) || [])[1] || null;
  const refs = [];
  [['index.html', idx], ['radar.html', read('radar.html')]].forEach(([file, html]) => {
    for (const m of html.matchAll(ASSET_RE)) refs.push({ file, asset: m[1], v: m[2] || null });
  });
  refs.push({ file: 'sw.js', asset: 'SW_VERSION', v: (read('sw.js').match(/const SW_VERSION = "(\w+)"/) || [])[1] || null });
  return { version, refs, mismatches: refs.filter(r => r.v !== version) };
}

// --- Checks: „  ok   …“, „  FAIL … :: …“, am Ende „Alle Checks bestanden.“ -------
let failCount = 0;
function check(name, cond, extra) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : ' :: ' + String(extra).slice(0, 240)));
  if (!cond) failCount++;
}
function finish() {
  console.log(failCount === 0 ? '\nAlle Checks bestanden.' : '\n' + failCount + ' Check(s) fehlgeschlagen.');
  process.exit(failCount ? 1 : 0);
}

module.exports = { makeSandbox, okFetch, mockForecast, mockEnsemble, mockModels, mockAir, mockGeocode, mockWarnings, mockNina, check, finish, el, TEST_NOW, assetVersion };
