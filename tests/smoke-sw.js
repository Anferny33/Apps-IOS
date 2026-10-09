// Offline-Hülle (sw.js): Hülle beim Installieren, Version wie die Seiten, alte Caches weg,
// Netz zuerst mit Cache-Rückfall, Navigations-Rückfall, Datenquellen durchgereicht,
// Schriften aus dem Cache, andere Methoden unberührt.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let fail = 0;
const check = (n, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : ' :: ' + String(x).slice(0, 220))); if (!c) fail++; };
check('Hülle: Installation holt die Dateien am HTTP-Cache vorbei (cache: reload)', /c\.addAll\(SHELL\.map\(function \(u\) \{ return new Request\(u, \{ cache: "reload" \}\); \}\)\)/.test(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8')));

function run(opts) {
  opts = opts || {};
  const handlers = {}, stores = {}, putLog = [], netLog = [];
  const keyOf = r => (typeof r === 'string' ? r : r.url);
  const cacheOf = name => {
    if (!stores[name]) stores[name] = new Map();
    const m = stores[name];
    return {
      addAll: async reqs => { reqs.forEach(r => m.set(keyOf(r), { ok: true, url: keyOf(r), fromCache: true, cacheMode: r.cache })); },
      add: async u => { m.set(u, { ok: true, url: u, fromCache: true }); },
      put: async (req, res) => { m.set(keyOf(req), res); putLog.push(keyOf(req)); },
      match: async req => m.get(keyOf(req)),
      keys: async () => [...m.keys()]
    };
  };
  const sb = {
    console, Promise, Map, Set, URL, Object, Array, JSON, String, Error, Response: class { static error() { return { ok: false, status: 0, error: true }; } },
    Request: class { constructor(u, init) { this.url = u; this.cache = init && init.cache; } },
    location: { origin: 'http://localhost:8000', href: 'http://localhost:8000/sw.js' },
    registration: { scope: 'http://localhost:8000/' },
    caches: {
      open: async n => cacheOf(n), keys: async () => Object.keys(stores), delete: async n => { delete stores[n]; return true; },
      match: async req => { for (const m of Object.values(stores)) { const r = m.get(keyOf(req)); if (r) return r; } return undefined; }
    },
    fetch: async req => {
      const url = keyOf(req); netLog.push(url);
      if (opts.offline || (opts.fail && opts.fail(url))) throw new Error('offline');
      return { ok: true, status: 200, url, fromNet: true, clone() { return Object.assign({}, this); } };
    },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
    addEventListener: (ev, fn) => { handlers[ev] = fn; }
  };
  sb.self = sb;
  vm.createContext(sb);
  vm.runInContext(code, sb);
  const fire = async (ev, extra) => {
    let waited = null, responded = null;
    const e = Object.assign({ waitUntil: p => { waited = p; }, respondWith: p => { responded = p; } }, extra || {});
    handlers[ev](e);
    if (waited) await waited;
    return responded ? await responded : undefined;
  };
  const req = (url, mode, method) => ({ url, mode: mode || 'cors', method: method || 'GET' });
  return { sb, handlers, stores, putLog, netLog, fire, req, opts };
}

(async () => {
  const ver = (idx.match(/design\.js\?v=(\w+)"/) || [])[1];
  const A = run({});
  // Regen-Alarm: Push zeigt die Nachricht, Tipp holt die App nach vorn oder öffnet sie
  const shown = [], focused = [], opened = [];
  A.sb.registration.showNotification = async (t, o) => { shown.push({ t, o }); };
  A.sb.clients.matchAll = async () => [{ url: 'http://localhost:8000/index.html', focus: async () => { focused.push(1); } }];
  A.sb.clients.openWindow = async (u) => { opened.push(u); };
  await A.fire('push', { data: { json: () => ({ title: 'Regen ab 16:30 Uhr', body: 'Lignano: gegen 16:30 Uhr fängt es an zu regnen.', url: './' }) } });
  check('Push: Nachricht mit Titel, Text, Symbol und Ziel', shown.length === 1 && shown[0].t === 'Regen ab 16:30 Uhr' && shown[0].o.body.startsWith('Lignano') && shown[0].o.icon === 'icons/icon-192.png' && shown[0].o.tag === 'regen-alarm' && shown[0].o.data.url === './', JSON.stringify(shown));
  await A.fire('push', { data: null });
  check('Push: ohne Daten eine Standardmeldung', shown.length === 2 && shown[1].t === 'Regen in Sicht', JSON.stringify(shown[1]));
  await A.fire('notificationclick', { notification: { close() {}, data: { url: './' } } });
  check('Push: Tipp holt die offene App nach vorn', focused.length === 1 && opened.length === 0);
  A.sb.clients.matchAll = async () => [];
  await A.fire('notificationclick', { notification: { close() {}, data: { url: './' } } });
  check('Push: ohne offene App wird sie geöffnet', opened.length === 1 && opened[0] === 'http://localhost:8000/', opened.join(','));

  check('Version: Konstante im Worker entspricht der Versions-Query der Seiten', A.sb.SW_INFO.version === ver && typeof ver === 'string', A.sb.SW_INFO.version + ' vs ' + ver);
  check('Hülle: Startseite, Radar, Manifest, Stylesheet, Skripte mit Version, Icons', ['./', 'index.html', 'radar.html', 'manifest.webmanifest', 'modern.css?v=' + ver, 'sonne.js?v=' + ver, 'wetter-core.js?v=' + ver, 'design.js?v=' + ver, 'radar.js?v=' + ver, 'icons/icon-192.png', 'icons/apple-touch-icon.png'].every(u => A.sb.SW_INFO.shell.includes(u)) && !A.sb.SW_INFO.shell.some(u => u.includes('design.css')), A.sb.SW_INFO.shell.join(','));

  await A.fire('install');
  const cacheName = Object.keys(A.stores)[0];
  check('Installieren: Hülle liegt im versionierten Cache', cacheName === 'wetter-shell-' + ver && A.stores[cacheName].has('index.html') && A.stores[cacheName].has('design.js?v=' + ver), cacheName);

  A.stores['wetter-shell-alt'] = new Map([['index.html', {}]]);
  await A.fire('activate');
  check('Aktivieren: alte Caches gelöscht, aktueller bleibt', !A.stores['wetter-shell-alt'] && A.stores[cacheName], Object.keys(A.stores).join(','));

  const r1 = await A.fire('fetch', { request: A.req('http://localhost:8000/design.js?v=' + ver) });
  check('Eigene Datei online: Netz zuerst, Antwort in den Cache', r1 && r1.fromNet && A.putLog.includes('http://localhost:8000/design.js?v=' + ver), JSON.stringify(r1));

  A.opts.offline = true;
  const r2 = await A.fire('fetch', { request: A.req('http://localhost:8000/design.js?v=' + ver) });
  check('Eigene Datei offline: aus dem Cache', r2 && (r2.fromNet || r2.fromCache) && !r2.error, JSON.stringify(r2));
  const r3 = await A.fire('fetch', { request: A.req('http://localhost:8000/?v=zzz', 'navigate') });
  check('Seitenaufruf offline ohne Treffer: Startseite aus dem Cache', r3 && r3.url === 'index.html', JSON.stringify(r3));
  const r4 = await A.fire('fetch', { request: A.req('http://localhost:8000/radar.html?v=zzz', 'navigate') });
  check('Radaraufruf offline: Radarseite aus dem Cache', r4 && r4.url === 'radar.html', JSON.stringify(r4));
  const r5 = await A.fire('fetch', { request: A.req('http://localhost:8000/nicht-da.js') });
  check('Unbekannte Datei offline: Fehlerantwort statt Absturz', r5 && r5.error === true, JSON.stringify(r5));
  A.opts.offline = false;

  const before = A.putLog.length, netBefore = A.netLog.length;
  const r6 = await A.fire('fetch', { request: A.req('https://api.open-meteo.com/v1/forecast?latitude=48') });
  check('Datenquelle: nicht angefasst (kein respondWith, kein Abruf, nichts gespeichert), der Browser lädt selbst', r6 === undefined && A.putLog.length === before && A.netLog.length === netBefore);
  const r6b = await A.fire('fetch', { request: A.req('https://tiles.openfreemap.org/planet/7/68/44.pbf') });
  const r6c = await A.fire('fetch', { request: A.req('https://maps.dwd.de/geoserver/dwd/wms?SERVICE=WMS') });
  check('Kartenkacheln und Radarbilder: ebenfalls durchgereicht', r6b === undefined && r6c === undefined && A.putLog.length === before);

  const f1 = await A.fire('fetch', { request: A.req('https://fonts.gstatic.com/s/sora/x.woff2') });
  A.opts.offline = true;
  const f2 = await A.fire('fetch', { request: A.req('https://fonts.gstatic.com/s/sora/x.woff2') });
  check('Schrift: erst Netz und speichern, offline aus dem Cache', f1 && f1.fromNet && f2 && f2.ok && !f2.error, JSON.stringify([f1, f2]));
  const m1 = await A.fire('fetch', { request: A.req('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js') });
  check('Kartenbibliothek offline ohne Cache: Fehlerantwort', m1 && m1.error === true, JSON.stringify(m1));
  A.opts.offline = false;

  const p0 = A.putLog.length;
  const post = await A.fire('fetch', { request: A.req('http://localhost:8000/x', 'cors', 'POST') });
  check('Andere Methoden: unberührt', post === undefined && A.putLog.length === p0);

  console.log(fail === 0 ? '\nAlle Checks bestanden.' : '\n' + fail + ' Check(s) fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
})();
