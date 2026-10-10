// Radar-Seite (MapLibre + DWD-WMS): Metadaten (Zeitachse, REFERENCE_TIME, Abdeckung),
// Frame-Auswahl, Ladereihenfolge, Anzeige erst nach vollständigem Laden, Überblendung A/B,
// begrenzter Cache, Aktualisierung ohne Doppelabrufe, Pause bei Slider/Hintergrund,
// Abdeckungs- und Ladefehler, Zentrieren, Tag/Nacht-Schalter, Nachtzustand aus der URL im Radar-Blatt,
// Statusleiste je Farbschema und Schema-Skript in radar.html,
// Zonen-Zusatz am Badge, Rückfall ohne Zeitachse (Bild wird bei jedem Aktualisieren neu geholt),
// Sonnenrechnung an den Polen. Der Harness setzt die Gerätezone auf Europe/Berlin; ein Check
// wechselt sie vorübergehend nach New York.
const { check, finish } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(require('path').join(__dirname, '..', 'radar.js'), 'utf8');
const SUN = fs.readFileSync(require('path').join(__dirname, '..', 'sonne.js'), 'utf8');

const NOW = Date.parse('2026-10-08T11:07:00Z');
const capsA = '<WMS_Capabilities><Layer><Name>dwd:Niederschlagsradar</Name>' +
  '<EX_GeographicBoundingBox><westBoundLongitude>2.0</westBoundLongitude><eastBoundLongitude>18.0</eastBoundLongitude><southBoundLatitude>45.0</southBoundLatitude><northBoundLatitude>57.0</northBoundLatitude></EX_GeographicBoundingBox>' +
  '<Dimension name="time" default="current" units="ISO8601">2026-10-08T07:00:00.000Z/2026-10-08T13:05:00.000Z/PT5M</Dimension>' +
  '<Dimension name="REFERENCE_TIME" default="2026-10-08T11:05:00.000Z" units="ISO8601">2026-10-08T07:00:00.000Z,2026-10-08T11:05:00.000Z</Dimension>' +
  '</Layer></WMS_Capabilities>';
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
  let clock = NOW;                                // Date.now() der Sandbox, mit advance() verschiebbar

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
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [clock])); } static now() { return clock; } static parse(s) { return Date.parse(s); } },
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
      querySelector: sel => sel === 'meta[name="theme-color"]' ? (nodes.themeMeta || (nodes.themeMeta = el('themeMeta'))) : null,   // Statusleiste
      documentElement: { setAttribute(k, v) { this[k] = v; }, classList: { c: new Set(), add(x){this.c.add(x)}, remove(x){this.c.delete(x)}, contains(x){return this.c.has(x)}, toggle(x, f){ if (f) this.c.add(x); else this.c.delete(x); } } },
      addEventListener(ev, fn) { docHandlers[ev] = fn; }, hidden: false
    },
    localStorage: { store: {}, getItem(k) { if (k === 'wetter:pos') return opts.pos ? JSON.stringify(opts.pos) : null; if (k === 'wetter:active') return opts.active === undefined ? null : (typeof opts.active === 'string' ? opts.active : JSON.stringify(opts.active)); return this.store[k] || null; }, setItem(k, v) { this.store[k] = v; }, removeItem(k) { delete this.store[k]; } }
  };
  sb.window = sb;
  if (opts.location) sb.location = opts.location;   // Radar-Blatt: { search: '?embed=1&night=1' }
  vm.createContext(sb);
  vm.runInContext(SUN, sb);
  vm.runInContext(code, sb);
  return {
    sb, nodes, log, docHandlers,
    st: () => sb.radarState(),
    setBounds(b) { bounds = b; },
    advance(ms) { clock += ms; },
    defer(time) { let resolve; const promise = new Promise(r => { resolve = r; }); deferred[time] = { promise, resolve }; return () => { resolve(); delete deferred[time]; }; }
  };
}

(async () => {
  // ---- A: volle Zeitachse, Position München ----
  const A = run({ caps: capsA, pos: { lat: 48.137, lon: 11.575, name: 'München' } });
  await wait(120);
  const map = A.st().map;
  const N = A.nodes, L = A.log;
  const frames = A.st().frames;

  check('Nacht: Radar rechnet den Zustand aus Ort und Uhrzeit (22:30 Ortszeit dunkel, 13:07 hell)', A.sb.radarNight(Date.parse('2026-10-08T20:30:00Z')) === true && A.sb.radarNight(Date.parse('2026-10-08T11:07:00Z')) === false, A.sb.radarNight(Date.parse('2026-10-08T20:30:00Z')) + ' ' + A.sb.radarNight(Date.parse('2026-10-08T11:07:00Z')));
  check('Nacht: ohne Ort keine Entscheidung', run({ caps: capsA }).sb.radarNight(Date.parse('2026-10-08T20:30:00Z')) === null);
  // Erreicht die Sonne −8° nie, entscheidet die Mittagshöhe: Polartag und ein Tag ganz in der Dämmerung sind hell, Polarnacht dunkel
  const nbc = (lat, d, m) => A.sb.nightByClock(lat, 15, d, 3600, m);
  check('Sonne: Polartag hell, Polarnacht dunkel, Tag ganz in der Dämmerung hell (Pol zur Tagundnachtgleiche, 87° im März), Tromsø Dezember mittags hell, nachts dunkel', nbc(78, '2026-06-21', 60) === false && nbc(78, '2026-12-21', 720) === true && nbc(90, '2026-03-21', 720) === false && nbc(87, '2026-03-12', 0) === false && nbc(69.65, '2026-12-21', 720) === false && nbc(69.65, '2026-12-21', 0) === true, [nbc(78, '2026-06-21', 60), nbc(78, '2026-12-21', 720), nbc(90, '2026-03-21', 720), nbc(87, '2026-03-12', 0), nbc(69.65, '2026-12-21', 720), nbc(69.65, '2026-12-21', 0)].join(','));
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
  check('Vorleser: Regler nennt Zeitpunkt und Art statt der Positionsnummer', N.slider['aria-valuetext'] === localHM(T('11:05')) + ' Uhr, Beobachtung', N.slider['aria-valuetext']);
  check('Vorleser: Farbskala als Satz, Balken und Skala stumm, Marker und Kartentexte auf Deutsch', N.legend.innerHTML.includes('<span class="vh">Farbskala: Regen ab 0,1 bis über 150 mm/h, grau heißt keine Radardaten. Alle Stufen stehen unter „Alle Stufen“.</span><div class="lg-row" aria-hidden="true">') && N.legend.innerHTML.includes('<div class="lg-ticks" aria-hidden="true">') && L.marker.o.element.role === 'img' && /^(Gewählter Ort: .+|Dein Standort)$/.test(L.marker.o.element['aria-label']) && map.opts.locale['AttributionControl.ToggleAttribution'] === 'Quellenangaben ein- oder ausblenden' && map.opts.locale['Marker.Title'] === 'Gewählter Ort' && map.opts.locale['Map.Title'] === 'Kartenfläche', L.marker.o.element['aria-label'] + ' | ' + N.legend.innerHTML.slice(0, 160));
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
  check('Vorleser: Regler nach dem Verschieben mit Prognose-Zeit', N.slider['aria-valuetext'] === localHM(T('12:05')) + ' Uhr, Prognose', N.slider['aria-valuetext']);
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

  // Zentrieren und Tag/Nacht-Schalter
  N.recenter.trigger('click');
  check('Zurückzentrieren auf den gewählten Ort', map.eased && map.eased.center[0] === 11.575 && map.eased.center[1] === 48.137, JSON.stringify(map.eased));
  const rootN = () => A.sb.document.documentElement;
  N.modeBtn.trigger('click'); await wait(20);
  check('Schalter: Tipp am Tag erzwingt Nacht, Wahl gespeichert, Knopf gedrückt', rootN().classList.contains('night') === true && JSON.parse(A.sb.localStorage.store['wetter:nightmode']).force === 'night' && N.modeBtn['aria-pressed'] === 'true', JSON.stringify(A.sb.localStorage.store));
  check('Schalter: beim automatischen Wechsel verfällt die Handwahl', A.sb.radarNight(Date.parse('2026-10-08T20:30:00Z')) === true && A.sb.localStorage.store['wetter:nightmode'] === undefined);
  check('Schalter: zurück am Tag Automatik', A.sb.radarNight(Date.parse('2026-10-08T11:07:00Z')) === false && N.modeBtn['aria-pressed'] === 'false');
  // Statusleiste wie auf der Startseite: Bento wie der Grund, Schema Nil (Klasse scheme-nil aus radar.html) Nile Blue bzw. Deep Indigo
  const metaC = () => N.themeMeta && N.themeMeta.getAttribute('content');
  check('Statusleiste: Bento #ECEAF4 am Tag (nach radarNight gesetzt), #14121F nachts', metaC() === '#ECEAF4' && (rootN().classList.add('night'), A.sb.updateThemeColor() === '#14121F') && metaC() === '#14121F', metaC());
  rootN().classList.add('scheme-nil');
  check('Statusleiste: Schema Nil #051230 nachts, #bce4e5 am Tag', A.sb.updateThemeColor() === '#051230' && (rootN().classList.remove('night'), A.sb.updateThemeColor() === '#bce4e5') && metaC() === '#bce4e5', metaC());
  rootN().classList.remove('scheme-nil');
  const radHtml = fs.readFileSync(require('path').join(__dirname, '..', 'radar.html'), 'utf8');
  check('Seite: Klasse scheme-nil und Statusleiste aus wetter:settings vor dem Stylesheet (nach dem Nachtwert), Zeitachse mit Nil-Tönen', /<script>try \{[^<]*wetter:settings[^<]*scheme === "nil"[^<]*theme-color[^<]*classList\.add\("scheme-nil"\)[^<]*"#051230" : "#bce4e5"[^<]*catch \(e\) \{\}<\/script>/.test(radHtml) && radHtml.indexOf('wetter:night') < radHtml.indexOf('wetter:settings') && radHtml.indexOf('wetter:settings') < radHtml.indexOf('<link rel="stylesheet" href="modern.css') && radHtml.includes('html.scheme-nil { --tl-obs: rgba(5,18,48,0.34); }') && radHtml.includes('html.scheme-nil.night { --tl-obs: rgba(188,228,229,0.45); --tl-fc: #34454c; }'), radHtml.slice(radHtml.indexOf('wetter:settings') - 40, radHtml.indexOf('wetter:settings') + 120));

  // Gerätezone außerhalb des Radargebiets (MEZ/MESZ): Badge und Vorleser nennen die Zone, die Marke bleibt knapp
  process.env.TZ = 'America/New_York';
  A.sb.updateBadge(frames[5]); A.sb.updateTicks();
  check('Badge in fremder Gerätezone: Uhrzeit mit Zonen-Zusatz, Regler und Marke für Vorleser auch, Marke sichtbar ohne', /^07:05 Uhr (GMT-4|EDT)$/.test(N.frameTime.textContent) && /^07:05 Uhr (GMT-4|EDT), Beobachtung$/.test(N.slider['aria-valuetext']) && N.tlMarkTime.textContent === '07:05' && /^Zur jüngsten Beobachtung springen, 07:05 Uhr (GMT-4|EDT)$/.test(N.tlMark['aria-label']), N.frameTime.textContent + ' | ' + N.slider['aria-valuetext'] + ' | ' + N.tlMark['aria-label']);
  process.env.TZ = 'Europe/Berlin';
  A.sb.updateBadge(frames[5]); A.sb.updateTicks();
  check('Badge in MEZ/MESZ: Uhrzeit ohne Zusatz', N.frameTime.textContent === '13:05 Uhr' && N.slider['aria-valuetext'] === '13:05 Uhr, Beobachtung' && N.tlMark['aria-label'] === 'Zur jüngsten Beobachtung springen, 13:05 Uhr', N.frameTime.textContent + ' | ' + N.tlMark['aria-label']);

  // ---- Radar-Blatt (?embed=1): der Nachtzustand kommt von der Startseite, eine Handwahl dort bleibt unberührt ----
  const posM = { lat: 48.137, lon: 11.575, name: 'München' };
  const dayMs = Date.parse('2026-10-08T11:07:00Z'), nightMs = Date.parse('2026-10-08T20:30:00Z');
  const G1 = run({ caps: capsA, pos: posM, location: { search: '?embed=1&night=1&v=x' } });
  G1.sb.localStorage.store['wetter:nightmode'] = JSON.stringify({ force: 'night', auto: false });
  const G0 = run({ caps: capsA, pos: posM, location: { search: '?embed=1&night=0' } });
  const Gx = run({ caps: capsA, pos: posM, location: { search: '?embed=1' } });
  const Gs = run({ caps: capsA, pos: posM, location: { search: '?night=1' } });
  await wait(80);
  check('Blatt: night=1 am Tag erzwingt Nacht, Handwahl der Startseite bleibt gespeichert, wetter:night gesetzt', G1.sb.radarNight(dayMs) === true && G1.sb.document.documentElement.classList.contains('night') && G1.sb.localStorage.store['wetter:nightmode'] === JSON.stringify({ force: 'night', auto: false }) && G1.sb.localStorage.store['wetter:night'] === '1', JSON.stringify(G1.sb.localStorage.store));
  check('Blatt: night=0 in der Nacht erzwingt Tag', G0.sb.radarNight(nightMs) === false && !G0.sb.document.documentElement.classList.contains('night'));
  check('Blatt ohne night-Parameter und Seite mit night=1 ohne embed: eigene Rechnung nach Uhr', Gx.sb.radarNight(nightMs) === true && Gx.sb.radarNight(dayMs) === false && Gs.sb.radarNight(dayMs) === false && Gs.sb.radarNight(nightMs) === true, [Gx.sb.radarNight(nightMs), Gs.sb.radarNight(dayMs)].join(','));

  // ---- B: Metadaten blockiert → aktuelles Bild ohne Zeitraffer ----
  const optsB = { caps: null, pos: null };
  const B = run(optsB);
  await wait(80);
  check('Ohne Zeitachse: Marker und Beschriftung ausgeblendet, Regler ohne Zweiton', B.nodes.tlAxis.classList.contains('hidden') && !B.nodes.slider.style.background, B.nodes.slider.style.background);
  const G2 = run({ caps: capsA, pos: null, style: null });
  await wait(80);
  check('Legende ohne Stildefinition: DWD-Legendenbild statt erfundener Skala', /<img [^>]*GetLegendGraphic/.test(G2.nodes.legend.innerHTML) && !/gradient\(/.test(G2.nodes.legend.innerHTML), G2.nodes.legend.innerHTML.slice(0, 120));
  check('Ohne Metadaten: ein Bild ohne TIME, Badge "aktuell", Hinweis im Notiztext, Play aus, Deutschland-Mitte', B.log.maps.length === 1 && B.log.maps[0] === null && B.nodes.frameTime.textContent === 'aktuell' && /ohne Zeitraffer/.test(B.nodes.note.textContent) && B.nodes.play.textContent === '▶' && B.st().map.opts.center[1] === 51.16, B.nodes.note.textContent);
  // Aktualisieren ohne Zeitachse: das „aktuell“-Bild wird neu geholt (der Schlüssel trägt die Abrufzeit), nicht aus dem Cache gezeigt
  const shownUrl = R => { const m = R.st().map; const l = m.layers.find(l => m.paint[l.id + '|raster-opacity'] === 0.72); return l ? m.sources[l.id].url : null; };
  const urlB1 = shownUrl(B);
  B.advance(5 * 60000);
  await B.sb.refresh(true); await wait(30);
  check('Rückfall ohne Zeitachse: Aktualisieren holt das aktuelle Bild neu und zeigt es, Badge bleibt „aktuell“', B.log.maps.length === 2 && B.log.maps[1] === null && urlB1 && shownUrl(B) !== urlB1 && B.nodes.frameTime.textContent === 'aktuell', B.log.maps.length + ' ' + urlB1 + ' -> ' + shownUrl(B));
  // Zeitachse kehrt zurück: die „aktuell“-Bilder fliegen aus dem Cache, die 14 Zeitpunkte bleiben
  optsB.caps = capsA; B.advance(5 * 60000);
  await B.sb.refresh(true); await wait(120);
  check('Zeitachse kehrt zurück: 14 Zeitpunkte, „aktuell“-Bilder aus dem Cache geräumt, Badge mit Uhrzeit', B.st().frames.length === 14 && B.sb.cacheSize() === 14 && B.nodes.frameTime.textContent === localHM(T('11:05')) + ' Uhr', B.st().frames.length + ' cache ' + B.sb.cacheSize() + ' ' + B.nodes.frameTime.textContent);

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

  finish();
})().catch(e => { console.error(e); process.exit(1); });
