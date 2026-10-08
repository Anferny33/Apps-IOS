// Radar-Seite (MapLibre + DWD-WMS): Metadaten (Zeitachse, REFERENCE_TIME, Abdeckung),
// Frame-Auswahl, Ladereihenfolge, Anzeige erst nach vollständigem Laden, Überblendung A/B,
// begrenzter Cache, Aktualisierung ohne Doppelabrufe, Pause bei Slider/Hintergrund,
// Abdeckungs- und Ladefehler, Zentrieren, Design-Wechsel.
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(require('path').join(__dirname, '..', 'radar.js'), 'utf8');

const NOW = Date.parse('2026-10-08T11:07:00Z');
const capsA = '<WMS_Capabilities><Layer><Name>dwd:Niederschlagsradar</Name>' +
  '<EX_GeographicBoundingBox><westBoundLongitude>2.0</westBoundLongitude><eastBoundLongitude>18.0</eastBoundLongitude><southBoundLatitude>45.0</southBoundLatitude><northBoundLatitude>57.0</northBoundLatitude></EX_GeographicBoundingBox>' +
  '<Dimension name="time" default="current" units="ISO8601">2026-10-08T07:00:00.000Z/2026-10-08T13:05:00.000Z/PT5M</Dimension>' +
  '<Dimension name="REFERENCE_TIME" default="2026-10-08T11:05:00.000Z" units="ISO8601">2026-10-08T07:00:00.000Z,2026-10-08T11:05:00.000Z</Dimension>' +
  '</Layer></WMS_Capabilities>';
// Lauf 11:05, aber Zeitachse reicht schon über "jetzt" hinaus: 11:10 ist Prognose, nicht Beobachtung
const capsB = capsA.replace('11:07', '11:07');
const T = s => '2026-10-08T' + s + ':00.000Z';
const sld = '<sld:StyledLayerDescriptor><sld:ColorMap type="intervals">' +
  '<sld:ColorMapEntry color="#7d7d7d" opacity="0.3" quantity="-10" label="Keine Daten"/>' +
  '<sld:ColorMapEntry color="#ffffff" opacity="0" quantity="0.008" label="mm/h"/>' +
  '<sld:ColorMapEntry color="#33ffff" quantity="0.017" label="[0.1 - 0.2)"/>' +
  '<sld:ColorMapEntry color="#1acc9a" quantity="0.033" label="[0.2 - 0.4)"/>' +
  '<sld:ColorMapEntry color="#019934" quantity="0.083" label="[0.4 - 1.0)"/>' +
  '<sld:ColorMapEntry color="#4db31b" quantity="0.167" label="[1.0 - 2.0)"/>' +
  '<sld:ColorMapEntry color="#99cc01" quantity="0.250" label="[2.0 - 3.0)"/>' +
  '<sld:ColorMapEntry color="#cce601" quantity="0.417" label="[3.0 - 5.0)"/>' +
  '<sld:ColorMapEntry color="#ffff01" quantity="0.625" label="[5.0 - 7.5)"/>' +
  '<sld:ColorMapEntry color="#ffc401" quantity="0.833" label="[7.5 - 10)"/>' +
  '<sld:ColorMapEntry color="#ff8901" quantity="1.250" label="[10 - 15)"/>' +
  '<sld:ColorMapEntry color="#ff4501" quantity="2.500" label="[15 - 30)"/>' +
  '<sld:ColorMapEntry color="#fe0000" quantity="3.750" label="[30 - 45)"/>' +
  '<sld:ColorMapEntry color="#e5004c" quantity="6.250" label="[45 - 75)"/>' +
  '<sld:ColorMapEntry color="#cc0098" quantity="8.333" label="[75 - 100)"/>' +
  '<sld:ColorMapEntry color="#6600cb" quantity="12.500" label="[100 - 150)"/>' +
  '<sld:ColorMapEntry color="#0000fe" quantity="25.000" label="&gt;= 150"/>' +
  '</sld:ColorMap></sld:StyledLayerDescriptor>';
const localHM = iso => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const wait = ms => new Promise(r => setTimeout(r, ms));

function el(id) {
  const h = {};
  return {
    id, innerHTML: '', textContent: '', value: '0', max: '0', className: '', src: '', title: '', offsetWidth: 10, disabled: false,
    style: {},
    classList: { c: new Set(), add(x){this.c.add(x)}, remove(x){this.c.delete(x)}, contains(x){return this.c.has(x)}, toggle(x, f){ if (f) this.c.add(x); else this.c.delete(x); } },
    addEventListener(ev, fn) { h[ev] = fn; }, trigger(ev, arg) { return h[ev] && h[ev].call(this, arg || {}); },
    setAttribute(k, v) { this[k] = v; }, getAttribute(k) { return this[k]; }
  };
}

function run(opts) {
  opts = opts || {};
  const nodes = {};
  const log = { caps: 0, maps: [], revoked: 0, created: 0 };
  let bounds = opts.bounds || [9, 47, 13, 50];   // w s e n
  const deferred = {};                            // time -> { promise, resolve }
  const failing = new Set(opts.failTimes || []);
  const docHandlers = {};

  class MapStub {
    constructor(o) {
      this.opts = o; this.style = o.style; this.sources = {}; this.layers = []; this.paint = {}; this.h = {}; this.zoom = o.zoom; this.center = o.center;
      this.touchZoomRotate = { disableRotation() {} }; this.keyboard = { disableRotation() {} };
      setTimeout(() => { this.emit('style.load'); this.emit('load'); }, 0);
    }
    on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); }
    once(ev, fn) { fn.once = true; this.on(ev, fn); }
    off(ev, fn) { if (this.h[ev]) this.h[ev] = this.h[ev].filter(f => f !== fn); }
    emit(ev, arg) { (this.h[ev] || []).slice().forEach(fn => { fn(arg); if (fn.once) this.off(ev, fn); }); }
    addSource(id, s) { const self = this; this.sources[id] = Object.assign({}, s, { updateImage(o) { this.url = o.url; this.coordinates = o.coordinates; setTimeout(() => self.emit('sourcedata', { sourceId: id, isSourceLoaded: true }), 0); } }); }
    addLayer(l, before) { this.layers.push(Object.assign({ before }, l)); }
    getSource(id) { return this.sources[id]; }
    getLayer(id) { return this.layers.find(l => l.id === id) || (this.style.layers.find(l => l.id === id)); }
    setPaintProperty(id, k, v) { this.paint[id + '|' + k] = v; }
    getBounds() { const b = bounds; return { getWest: () => b[0], getSouth: () => b[1], getEast: () => b[2], getNorth: () => b[3] }; }
    getCanvas() { return { clientWidth: 400, clientHeight: 600 }; }
    getZoom() { return this.zoom; }
    easeTo(o) { this.eased = o; }
    zoomIn() { this.zoom++; } zoomOut() { this.zoom--; }
    setStyle(s) { this.style = s; this.sources = {}; this.layers = []; this.paint = {}; setTimeout(() => this.emit('style.load'), 0); }
  }
  class MarkerStub { constructor(o) { this.o = o; } setLngLat(ll) { this.ll = ll; return this; } addTo() { log.marker = this; return this; } }

  const sb = {
    console, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, String, Number, Promise, Map, Set, RegExp, Error,
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static parse(s) { return Date.parse(s); } },
    setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {},
    devicePixelRatio: 1,
    maplibregl: { Map: MapStub, Marker: MarkerStub },
    URL: { createObjectURL: () => 'blob:' + (++log.created), revokeObjectURL: () => { log.revoked++; } },
    fetch: async (url) => {
      if (url.indexOf('GetCapabilities') >= 0) { log.caps++; if (opts.caps === null) throw new Error('blocked'); return { ok: true, text: async () => opts.caps }; }
      if (url.indexOf('GetStyles') >= 0) { log.styles = (log.styles || 0) + 1; if (opts.style === null) throw new Error('blocked'); return { ok: true, text: async () => sld }; }
      if (url.indexOf('GetMap') >= 0) {
        const m = /time=([^&]+)/.exec(url); const time = m ? decodeURIComponent(m[1]) : null;
        log.maps.push(time);
        if (failing.has(time)) throw new Error('offline');
        const resp = { ok: true, headers: { get: () => 'image/png' }, blob: async () => ({ size: 1000 }) };
        if (deferred[time]) { await deferred[time].promise; }
        return resp;
      }
      throw new Error('unexpected ' + url);
    },
    document: {
      getElementById: id => nodes[id] || (nodes[id] = el(id)),
      createElement: () => el('pin'),
      querySelector: () => null,
      documentElement: { setAttribute(k, v) { this[k] = v; } },
      addEventListener(ev, fn) { docHandlers[ev] = fn; }, hidden: false
    },
    localStorage: { store: {}, getItem(k) { if (k === 'wetter:pos') return opts.pos ? JSON.stringify(opts.pos) : null; if (k === 'wetter:active') return opts.active === undefined ? null : (typeof opts.active === 'string' ? opts.active : JSON.stringify(opts.active)); return this.store[k] || null; }, setItem(k, v) { this.store[k] = v; } }
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(code, sb);
  return {
    sb, nodes, log, docHandlers,
    st: () => sb.radarState(),
    setBounds(b) { bounds = b; },
    defer(time) { let resolve; const promise = new Promise(r => { resolve = r; }); deferred[time] = { promise, resolve }; return () => { resolve(); delete deferred[time]; }; }
  };
}

let fail = 0;
const check = (n, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : ' :: ' + String(x).slice(0, 220))); if (!c) fail++; };

(async () => {
  // ---- A: volle Zeitachse, Position München ----
  const A = run({ caps: capsA, pos: { lat: 48.137, lon: 11.575, name: 'München' } });
  await wait(120);
  const map = A.st().map;
  const N = A.nodes, L = A.log;
  const frames = A.st().frames;

  check('Karte: MapLibre mit Position München, Zoom 7, Marker, eigener Stil ohne Schlüssel', map.opts.center[0] === 11.575 && map.opts.zoom === 7 && L.marker && L.marker.ll[1] === 48.137 && map.style.sources.omt.url === 'https://tiles.openfreemap.org/planet' && !/key=|token=/.test(JSON.stringify(map.style)), JSON.stringify(map.opts.center));
  check('Stil: Wasser blassblau, Land zurückhaltend, nur Hauptstraßen ab Zoom 7, Nebenstraßen ab 10, Dörfer ab 10', map.style.layers.find(l => l.id === 'water').paint['fill-color'] === '#D4E4F7' && map.style.layers.find(l => l.id === 'bg').paint['background-color'] === '#EEF1EA' && map.style.layers.find(l => l.id === 'road-major').minzoom === 7 && map.style.layers.find(l => l.id === 'road-minor').minzoom === 10 && map.style.layers.find(l => l.id === 'place-village').minzoom === 10);
  check('Radar: genau zwei Bildebenen, eingefügt vor den Ortsnamen, zunächst unsichtbar', map.layers.length === 2 && map.layers.every(l => l.type === 'raster' && l.before === 'place-city' && l.paint['raster-opacity'] === 0) && Object.keys(map.sources).length === 2, JSON.stringify(map.layers.map(l => [l.id, l.before])));
  check('Frames: 6 Beobachtung + 8 Prognose aus Zeitachse und REFERENCE_TIME', frames.length === 14 && frames.filter(f => !f.isForecast).length === 6 && frames[5].time === Date.parse(T('11:05')) && frames[6].time === Date.parse(T('11:20')) && frames[13].time === Date.parse(T('13:05')), frames.map(f => new Date(f.time).toISOString().slice(11, 16) + (f.isForecast ? 'P' : '')).join(','));
  check('Start beim jüngsten Beobachtungsbild: Badge 13:05 Uhr lokal? nein: Zeit + "Beobachtung", Ladehinweis weg', N.frameTime.textContent.endsWith(' Uhr') && N.framePill.textContent === 'Beobachtung' && N.mapMsg.classList.contains('hidden') && !N.badge.classList.contains('loading'), N.frameTime.textContent + ' ' + N.framePill.textContent);
  check('Ladereihenfolge: erst das aktuelle Bild (11:05), dann die folgenden (11:20, 11:35 …), dann die früheren', L.maps[0] === T('11:05') && L.maps[1] === T('11:20') && L.maps[2] === T('11:35') && L.maps.indexOf(T('10:15')) > L.maps.indexOf(T('13:05')), L.maps.map(t => t && t.slice(11, 16)).join(','));
  check('Alle 14 Bilder nur je einmal angefragt (Cache + Warteschlange)', L.maps.length === 14 && new Set(L.maps).size === 14, L.maps.length);
  const shownA = map.layers.find(l => map.paint[l.id + '|raster-opacity'] === 0.72);
  check('Genau eine Ebene sichtbar mit dem Bild von 11:05, Überblendung konfiguriert', !!shownA && map.layers.filter(l => map.paint[l.id + '|raster-opacity'] === 0.72).length === 1 && map.sources[shownA.id].url.indexOf('blob:') === 0 && map.paint[shownA.id + '|raster-opacity-transition'].duration === 280, JSON.stringify(map.paint));
  check('Slider 0..13 auf 5, Wiedergabe läuft', N.slider.max === 13 && N.slider.value === 5 && N.play.textContent === '❚❚', N.slider.value);
  check('Zeitachse: Marker an der echten Grenze (Index 5 von 13), Zeitstempel der Beobachtung, Beschriftungen, Zweiton-Regler', N.tlMark.style.left === 'calc(13px + 0.3846 * (100% - 26px))' && N.tlMarkTime.textContent === localHM(T('11:05')) && /11:05|13:05/.test(N.tlMarkTime.textContent) === true && !N.tlAxis.classList.contains('hidden') && !N.tlObs.classList.contains('hidden') && !N.tlFc.classList.contains('hidden') && N.slider.style.background.indexOf('linear-gradient') === 0 && N.slider.style.background.indexOf('calc(13px + 0.3846 * (100% - 26px))') > 0 && /Beobachtung springen, /.test(N.tlMark['aria-label']), N.tlMark.style.left + ' ' + N.tlMarkTime.textContent + ' ' + N.slider.style.background);
  check('Legende: 15 Klassen aus der Stildefinition, untere Grenzen, offene Klasse, keine Daten, Details', (N.legend.innerHTML.match(/<i style="background:#[0-9a-f]{6}" title="/g) || []).length === 15 && N.legend.innerHTML.includes('<span>0,1</span>') && N.legend.innerHTML.includes('>≥150<') && N.legend.innerHTML.includes('keine Daten') && N.legend.innerHTML.includes('<details class="lg-more">') && N.legend.innerHTML.includes('0,1 bis 0,2 mm/h') && N.legend.innerHTML.includes('ab 150 mm/h') && !/gradient\(/.test(N.legend.innerHTML) && L.styles === 1, N.legend.innerHTML.slice(0, 200));
  check('WMS-Bild: EPSG:3857, Bbox mit 25 % Rand, Größe 1,5-fach aus dem Canvas, transparent', (() => { const u = A.sb.getMapUrl(frames[5].time, A.sb.viewOf(map)); return /crs=EPSG%3A3857/.test(u) && /width=600&height=900/.test(u) && /transparent=true/.test(u) && /bbox=890555\.93%2C5820502\.81%2C1558472\.87%2C6577190\.19/.test(u); })(), A.sb.getMapUrl(frames[5].time, A.sb.viewOf(map)));

  // Kleine Verschiebung innerhalb des geladenen Rands: nichts nachladen
  A.sb.setPlaying(false);
  const mapsSmall = L.maps.length;
  A.setBounds([9.5, 47.5, 13.5, 50.5]);
  await A.sb.showFrame(5); await wait(20);
  check('Kleine Verschiebung im Rand: keine neuen Bildabrufe, Ausschnitt bleibt', L.maps.length === mapsSmall && A.st().loadedView.lonlat[0] === 8, L.maps.length - mapsSmall);

  // Anzeige erst nach vollständigem Laden: Ausschnitt deutlich wechseln, Bild für 11:05 verzögern
  const release = A.defer(T('11:05'));
  A.setBounds([15, 50, 19, 53]);
  const badgeBefore = N.frameTime.textContent;
  const p = A.sb.showFrame(5);
  await wait(30);
  check('Neuer Ausschnitt: altes Bild bleibt, Badge lädt, keine Umschaltung vor dem Laden', N.badge.classList.contains('loading') && map.paint[shownA.id + '|raster-opacity'] === 0.72 && L.maps.length === mapsSmall + 1, JSON.stringify(map.paint));
  release(); await p; await wait(20);
  const shownB = map.layers.find(l => map.paint[l.id + '|raster-opacity'] === 0.72);
  check('Nach dem Laden: andere Ebene sichtbar (A/B getauscht), alte auf 0, Ladepunkt aus', shownB && shownB.id !== shownA.id && map.paint[shownA.id + '|raster-opacity'] === 0 && !N.badge.classList.contains('loading') && N.frameTime.textContent === badgeBefore, JSON.stringify(map.paint));
  await wait(30);

  // Cache begrenzt: weitere Ausschnitte
  A.setBounds([8, 50, 10, 51.5]); await A.sb.showFrame(5); await wait(30);
  A.setBounds([6, 51, 8, 52.5]); await A.sb.showFrame(5); await wait(30);
  check('Cache bleibt begrenzt (max 36), Verdrängte werden freigegeben, angezeigte nie', A.sb.cacheSize() <= 36 && L.revoked >= 6 && L.created >= 42, A.sb.cacheSize() + ' revoked ' + L.revoked + ' created ' + L.created);

  // Aktualisieren: gleiche Zeitachse → keine neuen Bildabrufe, kein Doppelabruf der Metadaten
  const mapsBefore = L.maps.length, capsBefore = L.caps;
  const r1 = A.sb.refresh(true), r2 = A.sb.refresh(true);
  check('Zwei gleichzeitige Aktualisierungen teilen sich einen Abruf', r1 === r2);
  await r1; await wait(30);
  check('Aktualisierung: vorhandene Bilder bleiben, keine erneuten Bildabrufe, Metadaten einmal', L.caps === capsBefore + 1 && L.maps.length === mapsBefore && A.st().frames.length === 14, L.caps + ' ' + (L.maps.length - mapsBefore));

  // Slider pausiert, Hintergrund pausiert, Rückkehr aktualisiert und setzt fort
  A.sb.setPlaying(true);
  N.slider.value = '9'; N.slider.trigger('input'); await wait(30);
  check('Zeitachse verschieben: Wiedergabe pausiert, Frame 9 (Prognose) angezeigt', N.play.textContent === '▶' && A.st().current === 9 && N.framePill.textContent === 'Prognose' && N.framePill.className === 'pill fc', N.play.textContent + ' ' + A.st().current);
  A.sb.setPlaying(true);
  N.tlMark.trigger('click'); await wait(30);
  check('Marker-Tipp: springt zur jüngsten Beobachtung (Frame 5) und pausiert', A.st().current === 5 && N.play.textContent === '▶' && N.framePill.textContent === 'Beobachtung', A.st().current + ' ' + N.play.textContent);
  A.sb.setPlaying(true);
  A.sb.document.hidden = true; A.docHandlers.visibilitychange(); 
  check('Im Hintergrund: pausiert', N.play.textContent === '▶');
  const capsBefore2 = L.caps;
  A.sb.document.hidden = false; A.docHandlers.visibilitychange(); await wait(40);
  check('Rückkehr kurz nach der letzten Aktualisierung: keine neuen Metadaten, Wiedergabe wieder an', L.caps === capsBefore2 && N.play.textContent === '❚❚', L.caps + ' ' + N.play.textContent);
  A.sb.setPlaying(false);
  const forced = L.caps; await A.sb.refresh(true); 
  check('Aktualisieren-Knopf lädt die Metadaten immer', L.caps === forced + 1, L.caps);
  A.sb.setPlaying(false);

  // Abdeckung: Lissabon liegt außerhalb → Hinweis, Radar aus; zurück → Hinweis weg
  A.setBounds([-10, 38, -8, 39]); await A.sb.showFrame(5); await wait(10);
  check('Außerhalb der Abdeckung: Hinweis nennt Abdeckung, Radarebenen aus, kein "kein Regen"', !N.mapMsg.classList.contains('hidden') && /abdeckung/i.test(N.mapMsg.textContent) && !/kein Regen/i.test(N.mapMsg.textContent) && map.layers.every(l => map.paint[l.id + '|raster-opacity'] === 0), N.mapMsg.textContent);
  A.setBounds([9, 47, 13, 50]); await A.sb.showFrame(5); await wait(30);
  check('Zurück in der Abdeckung: Hinweis weg, Radar sichtbar', N.mapMsg.classList.contains('hidden') && map.layers.some(l => map.paint[l.id + '|raster-opacity'] === 0.72));

  // Zentrieren und Design-Wechsel
  N.recenter.trigger('click');
  check('Zurückzentrieren auf den gewählten Ort', map.eased && map.eased.center[0] === 11.575 && map.eased.center[1] === 48.137, JSON.stringify(map.eased));
  N.designBtn.trigger('click'); await wait(20);
  check('Design-Wechsel: dunkler Kartenstil, Radarebenen neu eingefügt, Wahl gespeichert', map.style.layers.find(l => l.id === 'water').paint['fill-color'] === '#0f2744' && map.layers.length === 2 && A.sb.localStorage.store['wetter:design'] === 'classic', JSON.stringify(map.style.layers[0]));

  // ---- B: Metadaten blockiert → aktuelles Bild ohne Zeitraffer ----
  const B = run({ caps: null, pos: null });
  await wait(80);
  check('Ohne Zeitachse: Marker und Beschriftung ausgeblendet, Regler ohne Zweiton', B.nodes.tlAxis.classList.contains('hidden') && !B.nodes.slider.style.background, B.nodes.slider.style.background);
  const G2 = run({ caps: capsA, pos: null, style: null });
  await wait(80);
  check('Legende ohne Stildefinition: DWD-Legendenbild statt erfundener Skala', /<img [^>]*GetLegendGraphic/.test(G2.nodes.legend.innerHTML) && !/gradient\(/.test(G2.nodes.legend.innerHTML), G2.nodes.legend.innerHTML.slice(0, 120));
  check('Ohne Metadaten: ein Bild ohne TIME, Badge "aktuell", Hinweis im Notiztext, Play aus, Deutschland-Mitte', B.log.maps.length === 1 && B.log.maps[0] === null && B.nodes.frameTime.textContent === 'aktuell' && /ohne Zeitraffer/.test(B.nodes.note.textContent) && B.nodes.play.textContent === '▶' && B.st().map.opts.center[1] === 51.16, B.nodes.note.textContent);

  // ---- C: Bildabruf schlägt fehl → Status, altes Bild bleibt, nichts behauptet "kein Regen" ----
  const C = run({ caps: capsA, pos: null, failTimes: [T('11:20')] });
  await wait(100);
  C.sb.setPlaying(false);
  const before = C.nodes.frameTime.textContent;
  await C.sb.showFrame(6); await wait(20);
  check('Ladefehler: Status "nicht geladen", Badge bleibt beim alten Bild, Radar weiter sichtbar', !C.nodes.status.classList.contains('hidden') && /nicht geladen/.test(C.nodes.status.textContent) && C.nodes.frameTime.textContent === before && C.st().map.layers.some(l => C.st().map.paint[l.id + '|raster-opacity'] === 0.72), C.nodes.status.textContent);

  // ---- D: REFERENCE_TIME entscheidet über Beobachtung/Prognose, nicht die Uhr ----
  const capsD = capsA.replace('default="2026-10-08T11:05:00.000Z"', 'default="2026-10-08T10:55:00.000Z"');
  const D = run({ caps: capsD, pos: null });
  await wait(100);
  check('Grenze aus REFERENCE_TIME: Lauf 10:55 ist letzte Beobachtung, 11:00 und 11:05 zählen als Prognose', D.st().frames[5].time === Date.parse(T('10:55')) && D.st().frames[6].isForecast && D.st().frames[6].time === Date.parse(T('11:10')), D.st().frames.map(f => new Date(f.time).toISOString().slice(11, 16) + (f.isForecast ? 'P' : '')).join(','));

  // ---- E: aktiver Ort (Suche) hat Vorrang vor dem GPS-Ort; ungültiger aktiver Ort fällt auf GPS zurück ----
  const E = run({ caps: capsA, pos: { lat: 48.137, lon: 11.575, name: 'München' }, active: { lat: 53.55, lon: 9.99, name: 'Hamburg', source: 'search' } });
  await wait(80);
  const F = run({ caps: capsA, pos: { lat: 48.137, lon: 11.575, name: 'München' }, active: '{"lat":"x"}' });
  await wait(80);
  check('Radar: zentriert auf den aktiven Ort Hamburg, Marker dort', E.st().map.opts.center[0] === 9.99 && E.st().map.opts.center[1] === 53.55 && E.log.marker.ll[1] === 53.55, JSON.stringify(E.st().map.opts.center));
  check('Radar: ungültiger aktiver Ort → GPS-Ort München', F.st().map.opts.center[1] === 48.137, JSON.stringify(F.st().map.opts.center));

  console.log(fail === 0 ? '\nAlle Checks bestanden.' : '\n' + fail + ' fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
