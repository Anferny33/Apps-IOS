// Radar-Seite (DWD-WMS): Zeitachsen-Parsing, Frame-Auswahl, Fallback ohne Zeitachse,
// Zentrierung auf gemerkte Position.
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(require('path').join(__dirname, '..', 'radar.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const code = scripts[scripts.length - 1][1];

function el() {
  return {
    innerHTML: '', textContent: '', value: '0', max: '0', className: '',
    classList: { c: new Set(), add(x){this.c.add(x)}, remove(x){this.c.delete(x)}, contains(x){return this.c.has(x)} },
    addEventListener() {}
  };
}

// Fixe "Jetzt"-Zeit: 08.10.2026 11:07 UTC; Dienst liefert 07:00 .. 13:05 UTC im 5-min-Raster
// (Beobachtung bis 11:05, danach Prognose bis +120 min)
const NOW = Date.parse('2026-10-08T11:07:00Z');
const capsInterval = '<WMS_Capabilities><Layer><Name>dwd:Niederschlagsradar</Name><Dimension name="time" default="current" units="ISO8601">2026-10-08T07:00:00.000Z/2026-10-08T13:05:00.000Z/PT5M</Dimension></Layer></WMS_Capabilities>';
const capsList = '<WMS_Capabilities><Layer><Dimension name="time" units="ISO8601">2026-10-08T10:55:00.000Z,2026-10-08T11:00:00.000Z,2026-10-08T11:05:00.000Z</Dimension></Layer></WMS_Capabilities>';

function run(opts) {
  const nodes = {};
  ['map','frameTime','framePill','mapMsg','play','slider','tickStart','tickEnd','legend','legendImg','note'].forEach(i => nodes[i] = el());
  const addedLayers = new Set();
  const wmsOpts = [], markers = [];
  let mapOpts = null;
  function stubLayer() {
    return { opacity: 0, addTo() { addedLayers.add(this); return this; }, setOpacity(o) { this.opacity = o; }, bindPopup(t) { this.popup = t; return this; } };
  }
  const tileLayer = () => stubLayer();
  tileLayer.wms = (url, o) => { wmsOpts.push(o); return stubLayer(); };
  const L = {
    map: (id, o) => (mapOpts = o, { hasLayer: l => addedLayers.has(l), removeLayer: l => addedLayers.delete(l) }),
    tileLayer,
    marker: (latlng) => { const m = stubLayer(); m.latlng = latlng; markers.push(m); return m; },
    divIcon: () => ({})
  };
  const sb = {
    console, Math, Object, Array, JSON, parseInt, isNaN, String, Number,
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static parse(s) { return Date.parse(s); } },
    setInterval: () => 1, clearInterval: () => {},
    L,
    fetch: async () => { if (opts.caps === null) throw new Error('blocked'); return { ok: true, text: async () => opts.caps }; },
    document: { getElementById: id => nodes[id] || el(), addEventListener() {}, hidden: false },
    localStorage: { getItem: k => (k === 'wetter:pos' && opts.pos ? JSON.stringify(opts.pos) : null), setItem() {} }
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(code, sb);
  return { nodes, addedLayers, wmsOpts, markers, get mapOpts() { return mapOpts; } };
}

let fail = 0;
const check = (n, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : ' :: ' + x)); if (!c) fail++; };

const A = run({ caps: capsInterval, pos: { lat: 48.137, lon: 11.575, name: 'München' } });
const B = run({ caps: null, pos: null });
const C = run({ caps: capsList, pos: null });

setTimeout(() => {
  // A: volle Zeitachse
  const times = A.wmsOpts.map(o => o.time);
  check('WMS-Layer mit DWD-Layername + Version 1.3.0', A.wmsOpts.length > 0 && A.wmsOpts.every(o => o.layers === 'dwd:Niederschlagsradar' && o.version === '1.3.0' && o.transparent === true));
  check('14 Frames: 6 Beobachtung + 8 Prognose', A.wmsOpts.length === 14, A.wmsOpts.length + ' ' + times.join(','));
  check('Letzte Beobachtung 11:05 UTC (jüngster Zeitpunkt <= jetzt)', times[5] === '2026-10-08T11:05:00.000Z', times[5]);
  check('Beobachtung im 10-min-Raster ab -50', times.slice(0, 6).join(',') === ['10:15','10:25','10:35','10:45','10:55','11:05'].map(t => '2026-10-08T' + t + ':00.000Z').join(','), times.slice(0, 6));
  check('Prognose im 15-min-Raster bis +120', times[13] === '2026-10-08T13:05:00.000Z' && times[6] === '2026-10-08T11:20:00.000Z', times.slice(6));
  check('Slider-Maximum 13', A.nodes.slider.max === 13, A.nodes.slider.max);
  check('Start beim "jetzt"-Frame', A.nodes.framePill.textContent === 'jetzt', A.nodes.framePill.textContent);
  check('Ticks: -50 min / +2 h', A.nodes.tickStart.textContent === '–50 min' && A.nodes.tickEnd.textContent === '+2 h', A.nodes.tickStart.textContent + ' ' + A.nodes.tickEnd.textContent);
  check('Ladehinweis ausgeblendet, Play läuft', A.nodes.mapMsg.classList.contains('hidden') && A.nodes.play.textContent === '❚❚');
  check('Genau ein Frame sichtbar', [...A.addedLayers].filter(l => l.opacity > 0).length === 1);
  check('Mit Position: zentriert + Marker', A.mapOpts.center[0] === 48.137 && A.markers.length === 1 && A.markers[0].popup === 'München');

  // B: Capabilities blockiert -> aktuelles Bild ohne Zeitraffer
  check('Ohne Zeitachse: ein Layer ohne TIME', B.wmsOpts.length === 1 && B.wmsOpts[0].time === undefined, JSON.stringify(B.wmsOpts));
  check('Ohne Zeitachse: Hinweis im Notiztext, Badge "aktuell"', B.nodes.note.textContent.includes('ohne Zeitraffer') && B.nodes.frameTime.textContent === 'aktuell', B.nodes.note.textContent);
  check('Ohne Zeitachse: Play aus, Karte sichtbar', B.nodes.play.textContent === '▶' && B.nodes.mapMsg.classList.contains('hidden'));
  check('Ohne Position: Deutschland-Mitte, Zoom 6, kein Marker', B.mapOpts.center[0] === 51.16 && B.mapOpts.zoom === 6 && B.markers.length === 0);

  // C: Komma-Liste ohne Prognose
  check('Komma-Liste: nur passende Beobachtungs-Frames (2), keine Prognose', C.wmsOpts.length === 2 && C.nodes.tickEnd.textContent === 'jetzt', C.wmsOpts.map(o => o.time).join(',') + ' | ' + C.nodes.tickEnd.textContent);

  console.log(fail === 0 ? '\nAlle Checks bestanden.' : '\n' + fail + ' fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
}, 250);
