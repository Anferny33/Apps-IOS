// Design-Variante: Rendering aller Bereiche + Standort-/Suchfluss im Bottom-Sheet.
const H = require('./harness');
const vm = require('vm');
const fs = require('fs');

const DESIGN = fs.readFileSync(require('path').join(__dirname, '..', 'design.js'), 'utf8');
const fc = H.mockForecast();
const data = { fc, ens: H.mockEnsemble(fc), md: H.mockModels(), air: H.mockAir(), geo: H.mockGeocode(), warn: H.mockWarnings(), nina: H.mockNina(),
               place: { city: 'München', principalSubdivision: 'Bayern' } };
const granted = { getCurrentPosition: ok => ok({ coords: { latitude: 48.137, longitude: 11.575 } }) };
const denied = { getCurrentPosition: (ok, err) => err({ code: 1, message: 'denied' }) };
const wait = ms => new Promise(r => setTimeout(r, ms));
// Knoten liegen je nach ID im festen Satz oder im dynamischen Fallback
const G = (s, id) => s._nodes[id] || s._dyn[id];

function boot(opts) {
  const sb = H.makeSandbox(opts);
  sb.Math = Math;
  vm.runInContext(DESIGN, sb);
  sb.initDesignApp();
  return sb;
}

(async () => {
  // 1) Ortung ok -> alles gerendert
  const sb = boot({ fetchImpl: H.okFetch(data), geolocation: granted });
  // Inline-Höhen der Skelett-Platzhalter wie in index.html
  const E = id => sb.document.getElementById(id);
  E('hourly').style.height = '180px'; E('days').style.height = '260px'; E('models').style.height = '120px';
  await wait(300);
  const body = sb.document.body;

  H.check('Ortsname im Standort-Button', G(sb,'locName').textContent === 'München, Bayern', G(sb,'locName').textContent);
  H.check('Theme nach Wettercode 2 (wolkig, Tag) gesetzt', body.classList.contains('theme-partly-day'), [...body.classList.c]);
  const hero = G(sb,'hero').innerHTML;
  H.check('Hero: Temperatur groß', hero.includes('class="temp fade-in">17°'), hero.slice(0, 200));
  H.check('Hero: Zustand in der Kopfzeile + Gefühlt-Chip', hero.includes('<span>wolkig</span>') && hero.includes('Gefühlt 16°'), hero.slice(0, 200));
  H.check('Hero: Hoch/Tief-Chips', hero.includes('Hoch 18°') && hero.includes('Tief 8°'));
  H.check('Hero-Bauer: Vorschau-Markup ohne Staffelung, mit Jetzt-Knopf und drei Chips', (() => { const html = sb.heroHtml(sb.hourFacts(sb.lastRendered(), 42), false); return html.startsWith('<div class="meta"><span>Morgen, 18 Uhr</span><span>') && html.includes('<div class="temp">10°</div>') && html.includes('</span><button type="button" class="now-btn" id="heroNow">Jetzt</button></div><div class="main">') && html.includes('<div class="chips preview"><span>Gefühlt 9°</span><span>Regen 71 %</span><span>Wind 18 km/h</span></div>') && !html.includes('a-up'); })(), sb.heroHtml(sb.hourFacts(sb.lastRendered(), 42), false).slice(0, 220));
  H.check('Hero-Bauer: Jetzt-Markup entspricht dem gerenderten Hero', sb.heroHtml(sb.nowFacts(fc), true).replace(/animation-delay:[\d.]+s/g, 'D') === hero.replace(/animation-delay:[\d.]+s/g, 'D'), sb.heroHtml(sb.nowFacts(fc), true).slice(0, 160));
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
  // Rausgehen: Bewertung gegen die Mock-Daten (Jetzt = 25.09. 14:15)
  const actOf = id => sb.activityById(id);
  const walk = sb.activityWindows(sb.lastRendered(), actOf('walk'));
  H.check('Rausgehen: Spaziergang, fünf Fenster in Zeitfolge, die ersten drei', walk.windows.length === 5 && walk.windows.slice(0, 3).map(w => w.when + ' · ' + w.facts).join(' | ') === 'Heute 15 bis 21 Uhr · 10°, kaum Regen, wenig Wind | Morgen 7 bis 11 Uhr · 17°, kaum Regen, wenig Wind | Morgen 12 bis 18 Uhr · 15°, kaum Regen, wenig Wind' && walk.windows[0].start === 15, walk.windows.map(w => w.when + ' · ' + w.facts).join(' | '));
  const sit = sb.activityWindows(sb.lastRendered(), actOf('sit'));
  H.check('Rausgehen: Draußen sitzen, Wochentag und Regen-/Windstufen', sit.windows.map(w => w.when + ' · ' + w.facts).join(' | ') === 'Morgen 9 bis 11 Uhr · 18°, kaum Regen, wenig Wind | Sonntag 10 bis 13 Uhr · 19°, Regen bis 20 %, windstill', sit.windows.map(w => w.when + ' · ' + w.facts).join(' | '));
  const run = sb.activityWindows(sb.lastRendered(), actOf('run'));
  H.check('Rausgehen: Fenster über Mitternacht', run.windows[1] && run.windows[1].when === 'Heute 22 bis Morgen 4 Uhr' && run.windows[1].facts.startsWith('4°'), run.windows[1] && run.windows[1].when);
  const none = sb.activityWindows(sb.lastRendered(), { id: 'x', name: 'x', minH: 1, feel: [40, 50], prob: 30, light: 'any' });
  H.check('Rausgehen: kein Fenster mit häufigstem Grund', none.windows.length === 0 && none.reason === 'kalt' && sb.activityNote('kalt').includes('meist zu kalt'), JSON.stringify(none));
  H.check('Rausgehen: Spur mit 48 Zellen in der Leiste, 47 mit data-i', (G(sb,'hourly').innerHTML.match(/<div class="act-track">/g) || []).length === 1 && (G(sb,'hourly').innerHTML.match(/<i data-i="\d+"><\/i>/g) || []).length === 47 && G(sb,'hourly').innerHTML.includes('<div class="act-track"><i></i><i data-i="15"></i>'), G(sb,'hourly').innerHTML.slice(G(sb,'hourly').innerHTML.indexOf('act-track'), G(sb,'hourly').innerHTML.indexOf('act-track') + 80));
  const act = G(sb,'activity').innerHTML;
  H.check('Rausgehen: vier Chips, Spaziergang aktiv, drei Fenster mit Startindex', (act.match(/class="act-chip( on)?" data-act=/g) || []).length === 4 && act.includes('class="act-chip on" data-act="walk"') && act.includes('<button type="button" class="act-win" data-i="15"') && act.includes('<b>Heute 15 bis 21 Uhr</b><span>10°, kaum Regen, wenig Wind</span>') && (act.match(/class="act-win"/g) || []).length === 3 && !G(sb,'activityField').classList.contains('hidden'), act.slice(0, 300));
  sb.setActivity('sit');
  const act2 = G(sb,'activity').innerHTML;
  H.check('Rausgehen: Wechsel auf Draußen sitzen, Wahl gespeichert', act2.includes('class="act-chip on" data-act="sit"') && act2.includes('<b>Morgen 9 bis 11 Uhr</b>') && sb._store['wetter:activity'] === 'sit', act2.slice(0, 200));
  sb.setActivity('walk');
  // Modellunsicherheit: Summen und Satz aus den Stundenwerten
  const ms = sb.modelSums(data.md);
  H.check('Modelle: fünf Modelle, Summen heute/morgen aus Stundenwerten, Kurven mit 25 Punkten', ms.length === 5 && ms[0].id === 'icon_d2' && ms[0].today === 0 && ms[0].tomorrow === 2 && ms.find(m => m.id === 'ukmo_seamless').tomorrow === 6 && ms[4].id === 'gfs_seamless' && ms[0].cum.tomorrow.length === 25 && ms[0].cum.tomorrow[12] === 0 && Math.abs(ms[0].cum.tomorrow[16] - 2) < 1e-9 && ms[0].cum.tomorrow[24] === 2, JSON.stringify(ms.map(m => [m.id, m.today, m.tomorrow])));
  H.check('Modelle: Übereinstimmungssatz morgen (Spanne 4 mm > 2 mm)', sb.agreementText('morgen', ms.map(m => m.tomorrow)) === 'Für morgen sind sich die Modelle weitgehend einig: Regen, aber die Menge schwankt zwischen 2,0 und 6,0 mm.', sb.agreementText('morgen', ms.map(m => m.tomorrow)));
  H.check('Modelle: Sätze einig/uneinig', sb.agreementText('heute', [0, 0.2, 0.4]) === 'Für heute sind sich die Modelle einig: trocken.' && sb.agreementText('morgen', [3, 3.5, 4]) === 'Für morgen sind sich die Modelle einig: Regen, um 3,5 mm.' && sb.agreementText('morgen', [0, 0, 0, 2, 3, 4]) === 'Für morgen sind sich die Modelle uneinig: 3 von 6 rechnen mit Regen.' && sb.agreementText('morgen', [0, 2, 3, 4, 5, 6]) === 'Für morgen sind sich die Modelle weitgehend einig: 5 von 6 rechnen mit Regen.' && sb.agreementText('morgen', [1]) === '', [sb.agreementText('morgen', [0, 0, 0, 2, 3, 4]), sb.agreementText('morgen', [0, 2, 3, 4, 5, 6])].join(' | '));
  const band = sb.ensembleBand(data.ens, '2026-09-26');
  H.check('Modelle: Ensemble-Band morgen, 21 Läufe, 15 mit Regen (Hauptlauf zählt mit)', band && band.lo.length === 25 && band.hi.length === 25 && band.sums.length === 21 && band.sums.filter(v => v >= 0.1).length === 15 && band.hi[24] >= band.lo[24] && band.lo[0] === 0, band && JSON.stringify([band.sums.length, band.hi[24], band.lo[24]]));
  const mm = G(sb,'models').innerHTML;
  H.check('Modelle: Satz, SVG mit 10 Linien, Band, Jetzt-Marker, ICON-D2 hervorgehoben', mm.startsWith('<div class="agree">Für morgen sind sich die Modelle weitgehend einig') && (mm.match(/class="ml m-[a-z0-9_]+( hl)?" pathLength="1"/g) || []).length === 10 && (mm.match(/class="ml m-icon_d2 hl"/g) || []).length === 2 && (mm.match(/<polygon class="band"/g) || []).length === 2 && mm.includes('class="now"') && mm.includes('>Heute<') && mm.includes('>Morgen<') && mm.includes('>2,0 mm<'), mm.slice(0, 200));
  H.check('Modelle: Chips mit data-model, ICON-D2 hl, Werte aus Stundenwerten', mm.includes('class="mchip hl" data-model="icon_d2"') && mm.includes('data-model="ukmo_seamless"') && /data-count="6"[^>]*>6,0<\/span>/.test(mm) && (mm.match(/class="mchip( hl)?" data-model=/g) || []).length === 5, mm.slice(mm.indexOf('mchips'), mm.indexOf('mchips') + 200));
  H.check('Modelle: Ensemble-Zeile für morgen mit Zählwerten', /ICON-D2-Ensemble, morgen: 0 bis [\d,]+ mm, Median [\d,]+ mm · 15 von 21 Läufen mit Regen\./.test(mm) && !/% der/.test(mm), mm.slice(mm.indexOf('ICON-D2-Ensemble'), mm.indexOf('ICON-D2-Ensemble') + 100));
  H.check('Modelle: Temperaturspanne morgen als zweiter Satz', mm.includes('<div class="agree">Für morgen sind sich die Modelle weitgehend einig: Regen, aber die Menge schwankt zwischen 2,0 und 6,0 mm. <span class="tspan">Höchstwert morgen 17 bis 21°, die Modelle liegen 4° auseinander.</span></div>'), mm.slice(0, 260));
  H.check('Modelle: Temperatursatz bei Einigkeit und ohne Daten', sb.tempSpanText('morgen', [19, 19.4, 18.8]) === 'Höchstwert morgen um 19°, da sind sich die Modelle einig.' && sb.tempSpanText('morgen', [21]) === '' && sb.tempSpanText('morgen', [null, 20, 23]) === 'Höchstwert morgen 20 bis 23°, die Modelle liegen 3° auseinander.', sb.tempSpanText('morgen', [19, 19.4, 18.8]));
  sb.highlightModel('gfs_seamless');
  H.check('Modelle: Hervorhebung wechselbar ohne Fehler', true);
  // Regenpausen (Mock: Jetzt 14:15, Regen 14:45–16:15)
  const ncs = sb.nowcastSummary(fc);
  const p30 = sb.pauseInfo(ncs, 30), p60 = sb.pauseInfo(ncs, 60);
  H.check('Regenpause: 30 min beginnt jetzt, 60 min später und offen', p30.s === 0 && p30.e === 1 && !p30.open && p30.text === 'Jetzt trocken bis ca. 14:45, rund 30 Minuten.' && p60.s === 8 && p60.open && p60.text === 'Nächste trockene Phase: ab ca. 16:15, mindestens bis 18:15.', [p30.text, p60.text].join(' | '));
  const ncMid = { vals: ncs.vals.map((v, i) => (i >= 2 && i <= 3) || i >= 9 ? 0.4 : 0), times: ncs.times };
  const pMid = sb.pauseInfo(ncMid, 60);
  H.check('Regenpause: geschlossene spätere Phase mit Dauer', pMid.s === 4 && pMid.e === 8 && !pMid.open && pMid.text === 'Nächste trockene Phase: ca. 15:15 bis 16:30, rund 1 h 15 min.', pMid.text);
  H.check('Regenpause: keine Phase, mit und ohne Nachsatz', sb.pauseInfo({ vals: ncs.vals.map(() => 0.5), times: ncs.times }, 30).text === 'In den nächsten 4 Stunden keine trockene Phase von 30 Minuten.' && sb.pauseInfo({ vals: ncs.vals.map((v, i) => i === 5 ? 0 : 0.5), times: ncs.times }, 30).text === 'In den nächsten 4 Stunden keine trockene Phase von 30 Minuten, längstens rund 15 Minuten ab ca. 15:30.', sb.pauseInfo({ vals: ncs.vals.map((v, i) => i === 5 ? 0 : 0.5), times: ncs.times }, 30).text);
  const ncHtml = G(sb,'nowcast').innerHTML;
  H.check('Regenpause: Block mit Chips, 30 aktiv, Satz, Balken 0/1 markiert (1 weich)', ncHtml.includes('<div class="pause">') && ncHtml.includes('class="pchip on" data-min="30"') && (ncHtml.match(/class="pchip( on)?" data-min=/g) || []).length === 3 && ncHtml.includes('<div class="ptext">Jetzt trocken bis ca. 14:45, rund 30 Minuten.</div>') && /<div class="nc-bars"><i class="z p" [^>]*><\/i><i class="z p pe" /.test(ncHtml), ncHtml.slice(0, 200));
  sb.setPause(60);
  H.check('Regenpause: Wechsel auf 60 min, gespeichert', G(sb,'nowcast').innerHTML.includes('Nächste trockene Phase: ab ca. 16:15, mindestens bis 18:15.') && G(sb,'nowcast').innerHTML.includes('class="pchip on" data-min="60"') && sb._store['wetter:pause'] === '60', G(sb,'nowcast').innerHTML.slice(G(sb,'nowcast').innerHTML.indexOf('pause'), G(sb,'nowcast').innerHTML.indexOf('pause') + 300));
  sb.setPause(30);
  // Kacheln entfalten: Instrument-Bauer und Zustand
  const wp = sb.windPanelHtml(fc), rp = sb.rainPanelHtml(fc), spn = sb.sunPanelHtml(fc);
  H.check('Kacheln: Wind-Feld mit Kompassnadel 45°, Böensatz, 12 Doppelbalken', wp.includes('class="needle" style="--ang:45deg"') && wp.includes('Böen bis 36 km/h gegen 14 Uhr') && (wp.match(/<span class="gh">/g) || []).length === 12 && wp.includes('>N<') && wp.includes('aus SW'), wp.slice(0, 200));
  H.check('Kacheln: Regen-Feld mit 24 Balken, Wahrscheinlichkeiten, Satz', (rp.match(/<i class="(z )?rb"/g) || []).length === 24 && rp.includes('Heute trocken · Morgen 3,4 mm') && (rp.match(/\d+ %/g) || []).length === 8, rp.slice(0, 200));
  H.check('Kacheln: Sonnen-Feld mit Bogen 59 %, Zeiten und Fakten', spn.includes('--p:59') && spn.includes('>07:12<') && spn.includes('>19:05<') && spn.includes('Tageslänge</span>11 h 53 min') && spn.includes('Sonnenschein</span>6 h 00 min') && spn.includes('Morgen gleich lang'), spn.slice(0, 200));
  sb.toggleTile('wind');
  const t1 = sb.openTileKey(); sb.toggleTile('wind'); const t2 = sb.openTileKey(); sb.toggleTile('sun'); sb.toggleTile('rain'); const t3 = sb.openTileKey(); sb.toggleTile('rain');
  H.check('Kacheln: öffnen, schließen, wechseln', t1 === 'wind' && t2 === null && t3 === 'rain' && sb.openTileKey() === null, [t1, t2, t3].join(','));
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
  H.check('Hinweis-Feld: Nowcast (Regen ab 15:00) + Schirm', !G(sb,'insight').classList.contains('hidden') && G(sb,'insight').innerHTML.includes('Regen ab ca. 14:45 Uhr') && G(sb,'insight').innerHTML.includes('Schirm'), G(sb,'insight').innerHTML);
  H.check('Hero: SVG-Icon statt Emoji', hero.includes('<svg class="big-icon'));
  H.check('Hinweis bei Regen: Schirm mit Dach- und Tropfen-Ebene', G(sb,'insight').innerHTML.includes('<svg class="umb"') && G(sb,'insight').innerHTML.includes('class="umb-canopy"') && G(sb,'insight').innerHTML.includes('class="umb-drops"'));

  const wn = G(sb,'warnings').innerHTML;
  const dwdUrl = sb._fetchLog.find(u => u.includes('maps.dwd.de')) || '';
  H.check('Warnungen: DWD-WFS mit Punkt in Breite/Länge-Reihenfolge abgefragt', decodeURIComponent(dwdUrl).replace(/\+/g, ' ').includes('INTERSECTS(THE_GEOM,POINT(48.137 11.575))') && dwdUrl.includes('typeName=dwd%3AWarnungen_Gemeinden'), decodeURIComponent(dwdUrl));
  H.check('Warnungen: Feld sichtbar, 3 Einträge (2 DWD aktiv + 1 NINA; DWD-Doppelung aus NINA weg)', !G(sb,'warnings').classList.contains('hidden') && (wn.match(/<details class="field warn/g) || []).length === 3 && !wn.includes('FROST'), wn.slice(0, 200));
  H.check('Warnungen: Felder blenden gestaffelt ein, Dreieck wackelt, Megafon sendet Wellen', (wn.match(/ a-up" style="animation-delay:/g) || []).length === 3 && wn.includes('<svg class="wobble"') && wn.includes('<svg class="wave"') && wn.includes('class="w1"'), wn.slice(0, 120));
  H.check('Warnungen: Stufe 2 zuerst, dabei NINA vor DWD', /^<details class="field warn lvl-2 nina a-up"/.test(wn) && wn.indexOf('lvl-2 nina') < wn.indexOf('lvl-2 a-up"') && wn.indexOf('lvl-2 a-up"') < wn.indexOf('lvl-1'), wn.slice(0, 60));
  H.check('NINA: Katastrophenschutz-Zeile, Umbrüche, Quelle', wn.includes('Katastrophenschutz · seit') && wn.includes('Rauchentwicklung.<br>Betroffen') && wn.includes('class="instr">Fenster und Türen schließen.<br>Lüftung') && wn.includes('über NINA (warnung.bund.de) · Stadt München'), wn.match(/Katastrophenschutz[^<]*/));
  const ninaUrl = sb._fetchLog.find(u => u.includes('/nina?')) || '';
  H.check('NINA: Proxy mit Koordinaten abgefragt', ninaUrl.endsWith('/nina?lat=48.137&lon=11.575'), ninaUrl);
  H.check('Warnungen: bevorstehende mit "ab … bis …", Hinweis + Quelle', /Wetterwarnung · ab (\S+ )?\S+ Uhr bis (\S+ )?\S+ Uhr/.test(wn) && wn.includes('class="instr">Lose Gegenstände sichern.') && wn.includes('Quelle: Deutscher Wetterdienst · Stadt München'), wn.match(/Wetterwarnung · [^<]*/));

  const hh = G(sb,'hourly').innerHTML;
  H.check('Stunden: 48 Spalten', (hh.match(/class="hcol/g) || []).length === 48, (hh.match(/class="hcol/g) || []).length);
  H.check('Stunden: 48 Temperaturen', (hh.match(/class="v">-?\d+°</g) || []).length === 48, (hh.match(/class="v">-?\d+°</g) || []).length);
  H.check('Stunden: Regenstunden mit Füllstand (--p = Wahrscheinlichkeit), trockene ohne', /class="hcol[^"]* wet" style="[^"]*"><i class="fill" data-stagger="[\d.]+s" style="--p:\d+%;animation-delay:[\d.]+s"><\/i>/.test(hh) && !/class="hcol( newday)?" style="[^"]*"><i class="fill"/.test(hh), hh.match(/<i class="fill"[^>]*>/));
  H.check('Stunden: "Jetzt" dunkel, Regenstunden blau', hh.startsWith('<div class="strip"><div class="strip-inner"><div class="hcol now') && /class="hcol[^"]* wet"/.test(hh), hh.slice(0, 80));
  H.check('Stunden: "Jetzt" und Tageswechsel', hh.includes('>Jetzt<') && hh.includes('hcol newday'));
  H.check('Stunden: Ensemble-Wahrscheinlichkeiten', /class="p">\d+%/.test(hh));
  H.check('Stunden: Wahrscheinlichkeit in allen 48 Spalten (auch unter 10 %)', (hh.match(/class="p">\d+%/g) || []).length === 48, (hh.match(/class="p">\d+%/g) || []).length);
  H.check('Stunden: alle Spalten außer "Jetzt" tragen data-i (globaler Stundenindex 15..61)', (hh.match(/<div data-i="\d+" class="hcol/g) || []).length === 47 && hh.includes('data-i="15" class="hcol') && hh.includes('data-i="61" class="hcol') && !/data-i="\d+" class="hcol now/.test(hh), (hh.match(/<div data-i="\d+" class="hcol/g) || []).length);
  H.check('Stundenfakten: Index 42 = Morgen, 18 Uhr, Regen 71 %, Code 61', (() => { const f = sb.hourFacts(sb.lastRendered(), 42); return f && f.label === 'Morgen, 18 Uhr' && f.prob === 71 && f.code === 61 && Math.round(f.temp) === 10 && Math.round(f.wind) === 18 && f.desc === sb.wmo(61)[1]; })(), JSON.stringify(sb.hourFacts(sb.lastRendered(), 42)));
  H.check('Stundenfakten: Index 20 = Heute, 20 Uhr (Nacht), ungültige Indizes = null', (() => { const f = sb.hourFacts(sb.lastRendered(), 20); return f && f.label === 'Heute, 20 Uhr' && f.isDay === 0 && sb.hourFacts(sb.lastRendered(), -1) === null && sb.hourFacts(sb.lastRendered(), 99999) === null; })(), JSON.stringify(sb.hourFacts(sb.lastRendered(), 20)));

  const ncBars = [...G(sb,'nowcast').innerHTML.matchAll(/<i class="[^"]*" data-stagger="([\d.]+)s" style="height:\d+%;animation-delay:([\d.]+)s"/g)];
  H.check('Nowcast: 16 Balken mit aufsteigender Staffelung (Aufbau-Animation)', ncBars.length === 16 && ncBars.every((m, i) => i === 0 || (+m[2] > +ncBars[i-1][2] && +m[1] > +ncBars[i-1][1])), ncBars.length + ' ' + ncBars.slice(0,3).map(m => m[2]).join(','));
  H.check('Nowcast-Karte sichtbar (Regen in 4 h)', !G(sb,'nowcastCard').classList.contains('hidden') && (G(sb,'nowcast').innerHTML.match(/<i /g) || []).length === 16, G(sb,'nowcast').innerHTML.slice(0, 120));

  const dd = G(sb,'days').innerHTML;
  H.check('Tage: 14 Zeilen', (dd.match(/class="drow/g) || []).length === 14, (dd.match(/class="drow/g) || []).length);
  H.check('Tage: weitere 7 in aufklappbarem Container, ohne eigene Einblend-Verzögerung', /<div class="more-wrap"><div class="more-inner">(<div class="drow[^"]* more">[\s\S]*?){7}<\/div><\/div><button/.test(dd), dd.indexOf('more-wrap'));
  H.check('Tage: 7 sichtbar, 7 aufklappbar', (dd.match(/ more"/g) || []).length === 7 && dd.includes('Weitere 7 Tage'), (dd.match(/ more"/g) || []).length);
  H.check('Tage: Heute mit Jetzt-Punkt', /Heute[\s\S]*?<b style="left:/.test(dd));
  H.check('Tage: Spannen auf gemeinsamer Skala', (dd.match(/<i style="left:/g) || []).length === 14);
  H.check('Tage: Wahrscheinlichkeit auch unter 10 % (5 %, 0 %)', dd.includes('"pp">5%') && dd.includes('"pp">0%'), dd.match(/"pp">[^<]*/g));

  const det = G(sb,'details').innerHTML;
  H.check('Details: 8 Kacheln (6 + Luft + Pollen)', (det.match(/class="tile /g) || []).length === 8, (det.match(/class="tile /g) || []).length);
  H.check('Details: UV-Kachel mit Stufe + Maximum', det.includes('class="tile uv"') && det.includes('UV-Index') && det.includes('mittel') && det.includes('Maximum heute'));
  H.check('Details: Windpfeil zeigt wohin es weht (SW -> 45°)', det.includes('class="wdir" style="--ang:45deg"'), det.match(/wdir[^>]*>/));
  H.check('Details: Zählbare Werte (UV, Wind, Regen, Feuchte, Druck, Luft) mit data-count', (det.match(/class="big" data-count="/g) || []).length === 6 && det.includes('data-count="4.3" data-decimals="1"'), (det.match(/data-count="[^"]*"/g) || []).join(','));
  H.check('Modelle: beide Werte zählbar', (G(sb,'models').innerHTML.match(/<span data-count="/g) || []).length >= 6);
  H.check('Details: Wind-Kachel (aus SW, km/h)', det.includes('class="tile wind"') && det.includes('Aus SW') && det.includes('km/h'), det.match(/Aus [^<]*/));
  H.check('Details: Sonnen-Kachel (Untergang groß, Aufgang klein)', det.includes('class="tile sun"') && det.includes('class="big">19:05') && det.includes('Aufgang 07:12'));
  H.check('Details: Luftqualität-Meter + Wort', det.includes('Luftqualität') && det.includes('mäßig') && det.includes('class="meter"'));
  H.check('Details: Pollen-Chips (Gräser, Beifuß, Ambrosia)', det.includes('Gräser · mäßig') && det.includes('Beifuß · hoch') && det.includes('Ambrosia · gering') && !det.includes('Birke'), det.match(/pollen-chips[\s\S]{0,300}/));
  H.check('Modelle gerendert', G(sb,'models').innerHTML.includes('ICON-D2') && !G(sb,'models').classList.contains('skel'));
  H.check('Platzhalter-Höhen nach dem Rendern entfernt', ['hourly','days','models'].every(id => !G(sb,id).style.height), ['hourly','days','models'].map(id => G(sb,id).style.height));
  H.check('Stand-Zeile', G(sb,'updated').textContent.startsWith('Stand '));

  // Design-Umschalter: klassisch <-> modern, Wahl gespeichert
  G(sb,'designBtn').trigger('click');
  H.check('Umschalter: klassisches Design aktiv + gespeichert', sb._store['wetter:design'] === 'classic' && G(sb,'cssModern').disabled === true && G(sb,'cssClassic').disabled === false, sb._store['wetter:design']);
  G(sb,'designLink').trigger('click');
  H.check('Umschalter: zurück zu modern', sb._store['wetter:design'] === 'modern' && G(sb,'cssModern').disabled === false && G(sb,'cssClassic').disabled === true, sb._store['wetter:design']);

  // 2) Nacht + Regen -> anderes Theme, Nowcast-Karte ohne Regen ausgeblendet
  const fc2 = H.mockForecast();
  fc2.current.weather_code = 61; fc2.current.is_day = 0;
  fc2.minutely_15.precipitation = fc2.minutely_15.precipitation.map(() => 0);
  const sb2 = boot({ fetchImpl: H.okFetch(Object.assign({}, data, { fc: fc2, warn: { type: 'FeatureCollection', features: [] }, nina: { warnings: [] } })), geolocation: granted });
  await wait(300);
  H.check('Theme Regen', sb2.document.body.classList.contains('theme-rain'), [...sb2.document.body.classList.c]);
  H.check('Ohne Warnungen: Feld versteckt und leer', G(sb2,'warnings').classList.contains('hidden') && G(sb2,'warnings').innerHTML === '');
  const sb2b = boot({ fetchImpl: H.okFetch(Object.assign({}, data, { fc: fc2, warn: null, nina: null })), geolocation: granted });
  await wait(300);
  H.check('DWD und NINA nicht erreichbar: Wetter trotzdem gerendert, Warnfeld versteckt', G(sb2b,'hero').innerHTML.includes('17°') && G(sb2b,'warnings').classList.contains('hidden'));
  const sb2c = boot({ fetchImpl: H.okFetch(Object.assign({}, data, { fc: fc2, nina: null })), geolocation: granted });
  await wait(300);
  H.check('Nur NINA nicht erreichbar: DWD-Warnungen bleiben', (G(sb2c,'warnings').innerHTML.match(/<details class="field warn/g) || []).length === 2);
  H.check('Ohne Regen: Nowcast-Karte versteckt, Hinweis "Kein Regen"', G(sb2,'nowcastCard').classList.contains('hidden') && G(sb2,'insight').innerHTML.includes('Kein Regen in den nächsten 4 Stunden'), G(sb2,'insight').innerHTML);
  const fc3 = H.mockForecast(); fc3.current.weather_code = 0; fc3.current.is_day = 0;
  const sb3 = boot({ fetchImpl: H.okFetch(Object.assign({}, data, { fc: fc3 })), geolocation: granted });
  await wait(300);
  H.check('Theme klare Nacht + Mond-Icon', sb3.document.body.classList.contains('theme-clear-night') && G(sb3,'hero').innerHTML.includes('<svg class="big-icon wx wx-nacht"'), G(sb3,'hero').innerHTML.slice(0, 200));
  H.check('Hero-Icon nach Lage: Tag mit Wolken = Sonne hinter Wolke', hero.includes('wx wx-teils"') && hero.includes('class="cloud"') && hero.includes('class="sun"'));
  H.check('Regen-Icon mit Tropfen-Ebene', G(sb2,'hero').innerHTML.includes('wx wx-regen"') && G(sb2,'hero').innerHTML.includes('class="drops"'));
  H.check('Sonnenbogen: Sonne wandert mit (Winkel 107° für 14:15 bei 07:12–19:05) und startet im Morgenrot', /class="arc"[^>]*--ang:107deg[^>]*--c0:rgb\(232,121,74\)[^>]*--c4:rgb\(246,211,91\)/.test(det) && det.includes('<g class="sunpos"><circle class="dot" cx="8" cy="54"'), det.match(/class="arc"[^>]*/));
  H.check('Luftfeuchte: Füllung liegt in einer beschnittenen Gruppe (Wasser bleibt im Tropfen)', /<g clip-path="url\(#dropclip\)"><rect x="0" y="9\.5"/.test(det), det.match(/<g clip-path[^>]*><rect[^>]*>/));
  H.check('Kacheln: Mini-Icons und Skalen (Wind, Regen, Sonnenbogen, Tropfen, Druck, UV-Meter)',
    det.includes('class="windflow"') && det.includes('class="rain-ico"') && det.includes('class="arc"') && det.includes('class="drop-ico"') && det.includes('class="gauge-ico"') && /class="tile uv"[\s\S]*?class="meter"/.test(det));
  H.check('Einblend-Verzögerungen gestaffelt (Stunden, Tage, Kacheln)', /hcol now[^>]*animation-delay:0\.[89]\ds/.test(hh) && /drow[^>]*animation-delay:1\.[34]\ds/.test(dd) && /tile uv" style="animation-delay:(1\.00|0\.9\d)s/.test(det));

  // Zeitreise: ein Neurendern (Aktualisieren, Ortswechsel, Rückkehr in die App) beendet die Vorschau
  sb.selectHour(42);
  sb.renderAllDesign({ fc, ens: data.ens, md: data.md, air: data.air, warn: sb.normalizeWarnings(data.warn), nina: sb.normalizeNina(data.nina) });
  H.check('Zeitreise: Neurendern beendet die Vorschau', G(sb,'hero').innerHTML.includes('Hoch 18°') && !G(sb,'hero').innerHTML.includes('heroNow') && sb.lastRendered().fc === fc, G(sb,'hero').innerHTML.slice(0, 120));
  // Nach dem Neurendern wieder die Ausgangslage für die folgenden Checks herstellen
  H.check('Zeitreise: Ausgangs-Hero nach Neurendern identisch bis auf Verzögerungen', G(sb,'hero').innerHTML.replace(/animation-delay:[\d.]+s/g, 'D') === heroNow.replace(/animation-delay:[\d.]+s/g, 'D'));

  // 3) Ortung abgelehnt -> Banner mit "Ort suchen" -> Sheet öffnet -> Suche -> Auswahl
  const sb4 = boot({ fetchImpl: H.okFetch(data), geolocation: denied });
  await wait(300);
    H.check('Abgelehnt: Fehler-Banner mit Such-Button', G(sb4,'banner').className.includes('err') && G(sb4,'banner').innerHTML.includes('bannerBtn'), G(sb4,'banner').innerHTML);
  G(sb4,'bannerBtn').trigger('click');
  await wait(350);
  H.check('Sheet geöffnet, Feld fokussiert', sb4.document.body.classList.contains('sheet-open') && G(sb4,'q').focused === true);
  G(sb4,'q').value = 'Hamb'; G(sb4,'q').trigger('input');
  await wait(500);
  H.check('Suche: 2 Treffer', (G(sb4,'res').innerHTML.match(/class="place"/g) || []).length === 2, G(sb4,'res').innerHTML);
  G(sb4,'res')._buttons[0].trigger('click');
  await wait(300);
  H.check('Auswahl: Sheet zu, Ort geladen, GPS-Button sichtbar', !sb4.document.body.classList.contains('sheet-open') && G(sb4,'locName').textContent === '🔍 Hamburg, Hamburg · Deutschland' && !G(sb4,'gps').classList.contains('hidden'), G(sb4,'locName').textContent);
  H.check('Auswahl: Daten gerendert', G(sb4,'hero').innerHTML.includes('17°'));

  // 3b) Gespeicherte Position (Hamburg) + GPS meldet München: das zweite Laden darf nicht verschluckt werden
  const sb6 = boot({ fetchImpl: H.okFetch(data), geolocation: granted,
                     storage: { 'wetter:pos': JSON.stringify({ lat: 53.55, lon: 9.99, name: 'Hamburg' }) } });
  await wait(400);
  const fcUrls = sb6._fetchLog.filter(u => u.includes('api.open-meteo.com/v1/forecast') && !u.includes('models='));
  H.check('Ortswechsel beim Start: Vorhersage für GPS-Position nachgeladen', fcUrls.length === 2 && fcUrls[1].includes('latitude=48.137') && G(sb6,'locName').textContent === 'München, Bayern', fcUrls.map(u => u.match(/latitude=[\d.]+/)[0]) + ' ' + G(sb6,'locName').textContent);

  // 3c) Ortswechsel per Suche schlägt fehl: alte Daten dürfen nicht unter dem neuen Namen stehen bleiben
  const failHH = async (url) => { if (url.includes('latitude=53.55')) throw new Error('offline'); return H.okFetch(data)(url); };
  const sb7 = boot({ fetchImpl: failHH, geolocation: granted });
  await wait(300);
  H.check('Vor dem Wechsel: München gerendert', G(sb7,'hero').innerHTML.includes('17°') && !G(sb7,'warnings').classList.contains('hidden'));
  G(sb7,'locBtn').trigger('click'); await wait(350);
  G(sb7,'q').value = 'Hamb'; G(sb7,'q').trigger('input'); await wait(500);
  G(sb7,'res')._buttons[0].trigger('click'); await wait(300);
  H.check('Fehlgeschlagener Ortswechsel: Hero geleert, Warnungen weg, Fehlerbanner, Name Hamburg', !G(sb7,'hero').innerHTML.includes('17°') && G(sb7,'hero').innerHTML.includes('Keine Daten') && G(sb7,'warnings').classList.contains('hidden') && G(sb7,'banner').className.includes('err') && G(sb7,'locName').textContent.includes('Hamburg'), G(sb7,'hero').innerHTML.slice(0, 100) + ' | ' + G(sb7,'locName').textContent);

  // 4) Offline mit Cache
  const payload = { fc, ens: data.ens, md: data.md, air: data.air };
  const LOC_KEY = 'wetter:loc:' + (48.137).toFixed(2) + ',' + (11.575).toFixed(2);
  const sb5 = boot({ storage: { 'wetter:pos': JSON.stringify({ lat: 48.137, lon: 11.575, name: 'München' }),
                                [LOC_KEY]: JSON.stringify({ savedAt: '2026-10-08T06:00:00.000Z', payload }) }, geolocation: denied });
  await wait(300);
  H.check('Offline: Cache gerendert + Hinweis', G(sb5,'hero').innerHTML.includes('17°') && G(sb5,'banner').innerHTML.includes('zuletzt gespeicherten'), G(sb5,'banner').innerHTML);

  // Shell-Markup: gleitende Tab-Pille und Design-Schleier liegen in beiden Seiten
  const idx = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const rad = fs.readFileSync(require('path').join(__dirname, '..', 'radar.html'), 'utf8');
  H.check('Shell: Tab-Pille und Design-Schleier in index.html und radar.html', [idx, rad].every(h => h.includes('<span class="tab-ink"') && h.includes('id="designVeil"')));
  H.check('Shell: Rausgehen-Feld in index.html', idx.includes('id="activityField"') && idx.includes('id="activity"'));
  H.check('Shell: Versions-Query 20261008r an allen Asset-Links', (idx.match(/\?v=20261008r"/g) || []).length === 4 && (rad.match(/\?v=20261008r"/g) || []).length === 2 && fs.readFileSync(require('path').join(__dirname, '..', 'klassisch.html'), 'utf8').includes('wetter-core.js?v=20261008r"'), (idx.match(/\?v=\w+"/g) || []).join(','));

  if (process.env.DUMP) {
    fs.writeFileSync(__dirname + '/render-design.json', JSON.stringify({
      theme: [...body.classList.c].join(' '), hero: G(sb,'hero').innerHTML, warnings: G(sb,'warnings').innerHTML, insight: G(sb,'insight').innerHTML, hourly: G(sb,'hourly').innerHTML, nowcast: G(sb,'nowcast').innerHTML,
      days: G(sb,'days').innerHTML, details: G(sb,'details').innerHTML, models: G(sb,'models').innerHTML
    }));
  }
  H.finish();
})();
