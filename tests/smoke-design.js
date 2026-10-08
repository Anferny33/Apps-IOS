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
  H.check('Rausgehen: Spaziergang, fünf Fenster in Zeitfolge, die ersten drei', walk.windows.length === 5 && walk.windows.slice(0, 3).map(w => w.when + ' · ' + w.facts).join(' | ') === 'Heute 15 bis 21 Uhr · gefühlt 10°, kaum Regen, leichter Wind | Morgen 7 bis 11 Uhr · gefühlt 17°, kaum Regen, leichter Wind | Morgen 12 bis 18 Uhr · gefühlt 15°, kaum Regen, leichter Wind' && walk.windows[0].start === 15, walk.windows.map(w => w.when + ' · ' + w.facts).join(' | '));
  const sit = sb.activityWindows(sb.lastRendered(), actOf('sit'));
  H.check('Rausgehen: Draußen sitzen, Wochentag und Regen-/Windstufen', sit.windows.map(w => w.when + ' · ' + w.facts).join(' | ') === 'Morgen 9 bis 11 Uhr · gefühlt 18°, kaum Regen, leichter Wind | Sonntag 10 bis 13 Uhr · gefühlt 19°, Regen bis 20 %, wenig Wind', sit.windows.map(w => w.when + ' · ' + w.facts).join(' | '));
  const run = sb.activityWindows(sb.lastRendered(), actOf('run'));
  H.check('Rausgehen: Fenster über Mitternacht', run.windows[1] && run.windows[1].when === 'Heute 22 bis Morgen 4 Uhr' && run.windows[1].facts.startsWith('gefühlt 4°'), run.windows[1] && run.windows[1].when);
  const none = sb.activityWindows(sb.lastRendered(), { id: 'x', name: 'x', minH: 1, feel: [40, 50], prob: 30, light: 'any' });
  H.check('Rausgehen: kein Fenster mit häufigstem Grund', none.windows.length === 0 && none.reason === 'kalt' && sb.activityNote('kalt').includes('meist zu kalt'), JSON.stringify(none));
  H.check('Rausgehen: Spur mit 48 Zellen in der Leiste, 47 mit data-i', (G(sb,'hourly').innerHTML.match(/<div class="act-track">/g) || []).length === 1 && (G(sb,'hourly').innerHTML.match(/<i data-i="\d+"><\/i>/g) || []).length === 47 && G(sb,'hourly').innerHTML.includes('<div class="act-track"><i></i><i data-i="15"></i>'), G(sb,'hourly').innerHTML.slice(G(sb,'hourly').innerHTML.indexOf('act-track'), G(sb,'hourly').innerHTML.indexOf('act-track') + 80));
  const act = G(sb,'activity').innerHTML;
  H.check('Rausgehen: vier Chips, Spaziergang aktiv, drei Fenster mit Startindex', (act.match(/class="act-chip( on)?" data-act=/g) || []).length === 4 && act.includes('class="act-chip on" data-act="walk"') && act.includes('<button type="button" class="act-win" data-i="15"') && act.includes('<b>Heute 15 bis 21 Uhr</b><span>gefühlt 10°, kaum Regen, leichter Wind</span>') && (act.match(/class="act-win"/g) || []).length === 3 && !G(sb,'activityField').classList.contains('hidden'), act.slice(0, 300));
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
  const detx = G(sb,'details').innerHTML;
  H.check('Kacheln: data-tile an Wind/Regen/Sonne, Felder nach den Reihen in richtiger Reihenfolge', /<div class="tile wind" data-tile="wind"[\s\S]*?<\/div><div class="tpanel tp-wind" data-for="wind" id="tpanel-wind" role="region"/.test(detx) && /<div class="tile sun" data-tile="sun"[\s\S]*?<div class="tpanel tp-rain" data-for="rain"[\s\S]*?<div class="tpanel tp-sun" data-for="sun"/.test(detx) && (detx.match(/class="tpanel /g) || []).length === 3 && !/data-tile="uv"/.test(detx) && detx.indexOf('tp-wind') < detx.indexOf('class="tile rain"'), detx.slice(detx.indexOf('tp-wind') - 60, detx.indexOf('tp-wind') + 40));
  // Abendmodus: Lichtzeiten (verankert an 07:12 / 19:05), Phasen, Bewölkung, Darstellung
  const lt = sb.lightTimes(fc, 0);
  const f = m => sb.fmtMin(m);
  H.check('Abendmodus: goldene Stunde 18:24–19:24, blaue bis 19:48; morgens blau ab 06:29, gold 06:53–07:53', lt && f(lt.evening.goldenStart) === '18:24' && f(lt.evening.sunset) === '19:05' && f(lt.evening.goldenEnd) === '19:24' && f(lt.evening.blueEnd) === '19:48' && f(lt.morning.blueStart) === '06:29' && f(lt.morning.goldenStart) === '06:53' && f(lt.morning.goldenEnd) === '07:53', lt && [f(lt.evening.goldenStart), f(lt.evening.goldenEnd), f(lt.evening.blueEnd), f(lt.morning.blueStart), f(lt.morning.goldenStart), f(lt.morning.goldenEnd)].join(' '));
  const ltN = sb.lightTimes(fc, 1);
  H.check('Abendmodus: Phasentexte', sb.lightPhase(lt, 14 * 60 + 15, ltN).text === 'Goldene Stunde ab 18:24' && sb.lightPhase(lt, 18 * 60 + 40, ltN).text === 'Jetzt goldene Stunde · noch 44 min' && sb.lightPhase(lt, 19 * 60 + 30, ltN).phase === 'blue' && sb.lightPhase(lt, 19 * 60 + 30, ltN).text === 'Jetzt blaue Stunde · noch 18 min' && sb.lightPhase(lt, 21 * 60, ltN).text === 'Nacht · goldene Stunde morgen ab 06:53' && sb.lightPhase(lt, 7 * 60, ltN).text === 'Jetzt goldene Stunde · noch 53 min', [sb.lightPhase(lt, 14 * 60 + 15, ltN).text, sb.lightPhase(lt, 18 * 60 + 40, ltN).text, sb.lightPhase(lt, 19 * 60 + 30, ltN).text, sb.lightPhase(lt, 21 * 60, ltN).text].join(' | '));
  const sc = sb.sunsetClouds(fc, fc.daily.sunset[0]);
  const mk = (t, l, h) => ({ hourly: { time: fc.hourly.time, cloud_cover: fc.hourly.time.map(() => t), cloud_cover_low: fc.hourly.time.map(() => l), cloud_cover_high: fc.hourly.time.map(() => h) } });
  H.check('Abendmodus: Bewölkung zum Untergang interpoliert und eingeordnet', sc && sc.text === 'Zum Untergang 51 % Wolken, tief 20 %: hohe Wolken, gute Chance auf Farbe.' && /verdeckt/.test(sb.sunsetClouds(mk(80, 70, 10), fc.daily.sunset[0]).text) && /klar, wenig Farbe/.test(sb.sunsetClouds(mk(10, 5, 5), fc.daily.sunset[0]).text) && /wechselnd/.test(sb.sunsetClouds(mk(55, 50, 10), fc.daily.sunset[0]).text), sc && sc.text);
  const sunPanel = sb.sunPanelHtml(fc);
  H.check('Abendmodus: Lichtleiste mit vier Segmenten, Zeiten, Morgen- und Bewölkungszeile im Sonnenfeld', (sunPanel.match(/<i class="seg (day|gold|blue|night)"/g) || []).length === 4 && sunPanel.includes('>18:24<') && sunPanel.includes('>19:05<') && sunPanel.includes('>19:48<') && sunPanel.includes('Morgens blaue Stunde ab 06:29, goldene Stunde 06:53 bis 07:53.') && sunPanel.includes('gute Chance auf Farbe') && sunPanel.includes('<div class="light-now day">Goldene Stunde ab 18:24</div>') && !sunPanel.includes('class="now"'), sunPanel.slice(sunPanel.indexOf('light'), sunPanel.indexOf('light') + 200));
  H.check('Abendmodus: Kachel Sonne nennt die nächste goldene Stunde, Feld ohne Phasenklasse um 14:15', G(sb,'details').innerHTML.includes('Aufgang 07:12<br>Goldene Stunde ab 18:24') && G(sb,'details').innerHTML.includes('<div class="tpanel-body">'), G(sb,'details').innerHTML.slice(G(sb,'details').innerHTML.indexOf('goldene') - 40, G(sb,'details').innerHTML.indexOf('goldene') + 40));
  // Zähler: Gedächtnis statt Hochzählen von null; Tipp startet keine Zähler
  H.check('Zähler: erster Wert zählt hoch, gleicher Wert bleibt, geänderter gleitet', sb.countMode('t:UV:0', 4.3) === 'first' && sb.countMode('t:UV:0', 4.3) === 'same' && sb.countMode('t:UV:0', 5.1) === 'glide' && sb.countMode('t:UV:0', 5.1) === 'same');
  H.check('Zähler: Tipp-Delegat ruft keine Zähler mehr auf', !/else startCounters\(box\)/.test(DESIGN) && !/countUp\(box\.querySelector/.test(DESIGN) && /restartAnimations\(box\);\n\s*\}\);/.test(DESIGN));
  // Regenaussicht: aus den Stundenwerten ab jetzt (+4 h Nowcast-Fenster), nicht aus dem Tagesmaximum
  const clone = () => JSON.parse(JSON.stringify(fc));
  const dd0 = sb.lastRendered();
  H.check('Regen: Rest des Tages mit Tagesabschnitt und Menge', sb.rainOutlook(fc, dd0, 4).text === 'Heute Abend bis zu 71 % Regenrisiko · ca. 1,2 mm', sb.rainOutlook(fc, dd0, 4).text);
  const fcMid = clone(); fcMid.current.time = '2026-09-25T23:30';
  H.check('Regen: um Mitternacht springt die Aussicht auf morgen (Tageswechsel, Nachtstunden)', sb.rainOutlook(fcMid, dd0, 4).text === 'In der Nacht bis zu 71 % Regenrisiko · ca. 3,6 mm', sb.rainOutlook(fcMid, dd0, 4).text);
  const fcNull = clone(); fcNull.hourly.precipitation_probability = fcNull.hourly.precipitation_probability.map(() => null);
  H.check('Regen: fehlende Wahrscheinlichkeiten sind keine Trockenheit', sb.rainOutlook(fcNull, null, 4).text === 'Keine Regenprognose für die nächsten Stunden' && sb.rainOutlook(fcNull, null, 4).unknown === true, sb.rainOutlook(fcNull, null, 4).text);
  const fcPast = clone(); fcPast.hourly.precipitation_probability = fcPast.hourly.precipitation_probability.map((v, i) => i >= 8 && i <= 10 ? 90 : 5); fcPast.hourly.precipitation = fcPast.hourly.precipitation.map(() => 0);
  H.check('Regen: vergangener Vormittagsregen (90 %) erzeugt kein künftiges Risiko', sb.rainOutlook(fcPast, null, 4).text === 'Bis morgen Abend voraussichtlich trocken', sb.rainOutlook(fcPast, null, 4).text);
  const fcEve = clone(); fcEve.hourly.precipitation_probability = fcEve.hourly.precipitation_probability.map((v, i) => i === 20 ? 60 : 5); fcEve.hourly.precipitation = fcEve.hourly.precipitation.map((v, i) => i === 20 ? 0.6 : 0);
  const fcTom = clone(); fcTom.current.time = '2026-09-25T22:10'; fcTom.hourly.precipitation_probability = fcTom.hourly.precipitation_probability.map((v, i) => i === 39 ? 55 : 5); fcTom.hourly.precipitation = fcTom.hourly.precipitation.map(() => 0);
  H.check('Regen: „Heute Abend“ und „Morgen Nachmittag“ aus den Stundenwerten', sb.rainOutlook(fcEve, null, 4).text === 'Heute Abend bis zu 60 % Regenrisiko · ca. 0,6 mm' && sb.rainOutlook(fcTom, null, 4).text === 'Morgen Nachmittag bis zu 55 % Regenrisiko', sb.rainOutlook(fcEve, null, 4).text + ' | ' + sb.rainOutlook(fcTom, null, 4).text);
  const fcDry = clone(); fcDry.minutely_15.precipitation = fcDry.minutely_15.precipitation.map(() => 0);
  sb.renderHero(fcDry);
  H.check('Regen: trockener Nowcast zeigt die Aussicht statt des Tagesmaximums', G(sb,'insight').innerHTML.includes('<b>Kein Regen in den nächsten 4 Stunden</b><span>Heute Abend bis zu 71 % Regenrisiko · ca. 1,2 mm</span>') && !/Später am Tag/.test(G(sb,'insight').innerHTML), G(sb,'insight').innerHTML.slice(-160));
  const fcNc = clone(); fcNc.minutely_15.precipitation = fcNc.minutely_15.precipitation.map(() => null);
  sb.renderHero(fcNc);
  H.check('Regen: fehlende 15-Minuten-Werte heißen „nicht verfügbar“, nicht „kein Regen“', G(sb,'insight').innerHTML.includes('<b>Kurzfristprognose nicht verfügbar</b>') && !/Kein Regen/.test(G(sb,'insight').innerHTML) && G(sb,'insight').innerHTML.includes('Heute Nachmittag bis zu 71 % Regenrisiko'), G(sb,'insight').innerHTML.slice(-200));
  sb.renderHero(fc);
  // Aufklappbare Kacheln: Chevron, Disclosure-Schaltfläche, Zuordnung zum Detailfeld
  const detA = G(sb,'details').innerHTML;
  H.check('Kacheln: nur Wind, Regen, Sonne tragen Chevron und Disclosure-Schaltfläche', (detA.match(/class="chev"/g) || []).length === 3 && (detA.match(/class="t-toggle"/g) || []).length === 3 && detA.includes('<button type="button" class="t-toggle" aria-expanded="false" aria-controls="tpanel-wind" aria-label="Wind: Details anzeigen"></button>') && detA.includes('id="tpanel-wind" role="region" aria-label="Wind im Detail"') && !/class="tile uv"[^>]*>[\s\S]*?class="chev"[\s\S]*?class="tile wind"/.test(detA.replace(/<div class="tile wind"[\s\S]*/, '')), (detA.match(/class="t-toggle"/g) || []).length);
  H.check('Kacheln: keine verschachtelten Schaltflächen in den Kacheln', !/<button[^>]*>[^<]*<button/.test(detA) && (detA.match(/<\/button>/g) || []).length === 3, (detA.match(/<\/button>/g) || []).length);
  // Vorschauleiste: sichtbar während der Vorschau (Harness ohne IntersectionObserver = Hero nicht im Bild)
  sb.selectHour(42);
  H.check('Vorschauleiste: zeigt „Vorschau · Morgen, 18 Uhr“, solange eine Stunde gewählt ist', !G(sb,'previewBar').classList.contains('hidden') && G(sb,'previewLabel').textContent === 'Vorschau · Morgen, 18 Uhr', G(sb,'previewLabel').textContent);
  sb.backToNow();
  H.check('Vorschauleiste: „Jetzt“ blendet sie aus und stellt das aktuelle Wetter her', G(sb,'previewBar').classList.contains('hidden') && G(sb,'hero').innerHTML.includes('Hoch 18°'));
  H.check('Shell: Vorschauleiste mit Jetzt-Knopf in index.html', fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').includes('id="previewBar"') && fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').includes('id="previewNow"'));
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

  // Zeitreise: am selben Ort überlebt die gewählte Stunde (per Zeitstempel) ein Neurendern; Ortswechsel oder
  // fehlende Stunde setzen zurück. Das offene Detailfeld bleibt ebenfalls offen.
  const payloadSame = { fc, ens: data.ens, md: data.md, air: data.air, warn: sb.normalizeWarnings(data.warn), nina: sb.normalizeNina(data.nina) };
  sb.selectHour(42); sb.toggleTile('wind');
  sb.renderAllDesign(payloadSame);
  H.check('Zeitreise: Neurendern am selben Ort erhält die gewählte Stunde und das offene Feld', G(sb,'hero').innerHTML.includes('<span>Morgen, 18 Uhr</span>') && G(sb,'hero').innerHTML.includes('heroNow') && sb.openTileKey() === 'wind', G(sb,'hero').innerHTML.slice(0, 120) + ' ' + sb.openTileKey());
  const fcShift = JSON.parse(JSON.stringify(fc)); fcShift.hourly.time = fcShift.hourly.time.map(t => t.replace('2026-09-26T18:00', '2026-09-26T18:30'));
  sb.renderAllDesign(Object.assign({}, payloadSame, { fc: fcShift }));
  H.check('Zeitreise: nicht mehr vorhandene Stunde setzt die Vorschau zurück', G(sb,'hero').innerHTML.includes('Hoch 18°') && !G(sb,'hero').innerHTML.includes('heroNow'), G(sb,'hero').innerHTML.slice(0, 120));
  sb.selectHour(42);
  const fcOther = JSON.parse(JSON.stringify(fc)); fcOther.latitude = 53.55; fcOther.longitude = 9.99;
  sb.renderAllDesign(Object.assign({}, payloadSame, { fc: fcOther }));
  H.check('Zeitreise: Ortswechsel setzt Vorschau und offenes Feld zurück', G(sb,'hero').innerHTML.includes('Hoch 18°') && !G(sb,'hero').innerHTML.includes('heroNow') && sb.openTileKey() === null, G(sb,'hero').innerHTML.slice(0, 120));
  sb.renderAllDesign(payloadSame);
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

  // 3d) Suche speichert den aktiven Ort getrennt vom GPS-Ort; „Mein Standort“ wechselt zurück
  let gpsCalls = 0;
  const counting = { getCurrentPosition: ok => { gpsCalls++; ok({ coords: { latitude: 48.137, longitude: 11.575 } }); } };
  const sb8 = boot({ fetchImpl: H.okFetch(data), geolocation: counting });
  await wait(300);
  G(sb8,'locBtn').trigger('click'); await wait(350);
  G(sb8,'q').value = 'Hamb'; G(sb8,'q').trigger('input'); await wait(500);
  G(sb8,'res')._buttons[0].trigger('click'); await wait(300);
  const act8 = JSON.parse(sb8._store['wetter:active'] || 'null'), pos8 = JSON.parse(sb8._store['wetter:pos'] || 'null');
  H.check('Ort: Suche speichert aktiven Ort (Hamburg, search), GPS-Ort bleibt München', act8 && act8.source === 'search' && act8.lat === 53.55 && act8.name.startsWith('Hamburg') && pos8 && pos8.lat === 48.137, JSON.stringify([act8, pos8]));
  const callsBefore = gpsCalls;
  G(sb8,'gps').trigger('click'); await wait(300);
  const act8b = JSON.parse(sb8._store['wetter:active'] || 'null');
  H.check('Ort: „Mein Standort“ ortet neu und macht den GPS-Ort zum aktiven Ort', gpsCalls === callsBefore + 1 && act8b && act8b.source === 'gps' && act8b.lat === 48.137 && G(sb8,'locName').textContent === 'München, Bayern', JSON.stringify(act8b) + ' ' + G(sb8,'locName').textContent);

  // 3e) Neuladen / Direktaufruf mit gesuchtem Ort: kein GPS, Vorhersage für den gesuchten Ort
  gpsCalls = 0;
  const sb9 = boot({ fetchImpl: H.okFetch(data), geolocation: counting,
                     storage: { 'wetter:pos': JSON.stringify({ lat: 48.137, lon: 11.575, name: 'München' }), 'wetter:active': JSON.stringify({ lat: 53.55, lon: 9.99, name: 'Hamburg', source: 'search' }) } });
  await wait(300);
  const fc9 = sb9._fetchLog.filter(u => u.includes('api.open-meteo.com/v1/forecast') && !u.includes('models='));
  H.check('Ort: Start mit gesuchtem Ort lädt Hamburg ohne Ortung, GPS-Ort bleibt gespeichert', gpsCalls === 0 && fc9.length === 1 && fc9[0].includes('latitude=53.55') && G(sb9,'locName').textContent.includes('Hamburg') && JSON.parse(sb9._store['wetter:pos']).lat === 48.137, gpsCalls + ' ' + fc9.map(u => u.match(/latitude=[\d.]+/)[0]) + ' ' + G(sb9,'locName').textContent);
  H.check('Ort: GPS-Knopf sichtbar, wenn ein gesuchter Ort aktiv ist', !G(sb9,'gps').classList.contains('hidden'));

  // 3f) Ungültiger aktiver Ort → normaler GPS-Fluss
  gpsCalls = 0;
  const sb10 = boot({ fetchImpl: H.okFetch(data), geolocation: counting, storage: { 'wetter:active': '{"lat":"x","source":"search"}' } });
  await wait(300);
  H.check('Ort: ungültiger aktiver Ort wird ignoriert, Ortung läuft', gpsCalls === 1 && G(sb10,'locName').textContent === 'München, Bayern' && JSON.parse(sb10._store['wetter:active']).source === 'gps', gpsCalls + ' ' + G(sb10,'locName').textContent);

  // 4) Offline mit Cache
  const payload = { fc, ens: data.ens, md: data.md, air: data.air };
  const LOC_KEY = 'wetter:loc:' + (48.137).toFixed(2) + ',' + (11.575).toFixed(2);
  const sb5 = boot({ storage: { 'wetter:pos': JSON.stringify({ lat: 48.137, lon: 11.575, name: 'München' }),
                                [LOC_KEY]: JSON.stringify({ savedAt: '2026-10-08T06:00:00.000Z', payload }) }, geolocation: denied });
  await wait(300);
  H.check('Offline: Cache gerendert + Hinweis', G(sb5,'hero').innerHTML.includes('17°') && G(sb5,'banner').innerHTML.includes('zuletzt gespeicherten'), G(sb5,'banner').innerHTML);

  // 5) Ortssuche: zuletzt gewählte Orte, Zustände, verspätete Antworten, Schließen
  const hamburgDE = { name: 'Hamburg, Hamburg · Deutschland', lat: 53.55, lon: 9.99 };
  const hamburgNJ = { name: 'Hamburg, New Jersey · USA', lat: 41.15, lon: -74.57 };
  const berlin = { name: 'Berlin, Land Berlin · Deutschland', lat: 52.52, lon: 13.41 };
  const geoOf = (list) => ({ results: list.map(p => { const m = p.name.match(/^([^,]+), ([^·]+) · (.+)$/); return { name: m[1], admin1: m[2].trim(), country: m[3], latitude: p.lat, longitude: p.lon }; }) });
  // Geocoder nach Suchbegriff: "Hamb" langsam, "Berl" sofort, "Nix" leer, "Fehl" Netzwerkfehler
  const geoByQuery = async (url) => {
    if (url.includes('geocoding-api')) {
      const name = decodeURIComponent((url.match(/name=([^&]+)/) || [])[1] || '');
      if (name.startsWith('Fehl')) throw new Error('Failed to fetch');
      if (name.startsWith('Nix')) return { ok: true, json: async () => ({ results: [] }) };
      if (name.startsWith('Hamb')) { await wait(600); return { ok: true, json: async () => geoOf([hamburgDE, hamburgNJ]) }; }
      return { ok: true, json: async () => geoOf([berlin]) };
    }
    return H.okFetch(data)(url);
  };
  const places = s => (G(s,'res').innerHTML.match(/<button type="button" class="place[^"]*" data-i="\d+">[^<]*/g) || []).map(x => x.replace(/^.*>/, ''));

  // 5a) Ohne gespeicherte Orte: Sheet leer; Suche, Auswahl -> Ort gespeichert, Auswahl erneut -> keine Doppelung, zuletzt gewählt zuerst
  const sbS = boot({ fetchImpl: geoByQuery, geolocation: granted });
  await wait(300);
  G(sbS,'locBtn').trigger('click'); await wait(350);
  H.check('Suche: ohne gespeicherte Orte keine Liste', G(sbS,'res').innerHTML === '' && sbS.document.body.classList.contains('sheet-open'), G(sbS,'res').innerHTML);
  G(sbS,'q').value = 'Berl'; G(sbS,'q').trigger('input'); await wait(500);
  H.check('Suche: Treffer für Berlin', places(sbS).join('|') === berlin.name, G(sbS,'res').innerHTML);
  G(sbS,'res')._buttons[0].trigger('click'); await wait(300);
  let recent = JSON.parse(sbS._store['wetter:recent'] || '[]');
  H.check('Suchorte: Auswahl speichert den Ort (Name, lat, lon)', recent.length === 1 && recent[0].name === berlin.name && recent[0].lat === 52.52 && recent[0].lon === 13.41, sbS._store['wetter:recent']);
  H.check('Suchorte: aktiver Ort und GPS-Ort bleiben getrennt gespeichert', JSON.parse(sbS._store['wetter:active']).source === 'search' && JSON.parse(sbS._store['wetter:pos']).lat === 48.137, sbS._store['wetter:active'] + ' ' + sbS._store['wetter:pos']);
  H.check('Suche: Fokus nach der Auswahl zurück auf dem Ortsknopf', G(sbS,'locBtn').focused === true && !sbS.document.body.classList.contains('sheet-open'));
  G(sbS,'locBtn').trigger('click'); await wait(350);
  H.check('Suchorte: beim Öffnen steht Berlin unter „Zuletzt gewählt“', G(sbS,'res').innerHTML.includes('Zuletzt gewählt') && places(sbS).join('|') === berlin.name, G(sbS,'res').innerHTML);
  G(sbS,'q').value = 'Hamb'; G(sbS,'q').trigger('input'); await wait(500);
  H.check('Suche: Zustand „Suche läuft“ während der Antwort', G(sbS,'res').innerHTML.includes('Suche läuft') && !G(sbS,'res').innerHTML.includes('Zuletzt gewählt'), G(sbS,'res').innerHTML);
  await wait(500);
  H.check('Suche: zwei Hamburgs mit gleichem Namen, verschiedene Orte', places(sbS).length === 2 && places(sbS)[0] === hamburgDE.name && places(sbS)[1] === hamburgNJ.name, places(sbS).join('|'));
  G(sbS,'res')._buttons[1].trigger('click'); await wait(300);
  G(sbS,'locBtn').trigger('click'); await wait(350);
  G(sbS,'q').value = 'Hamb'; G(sbS,'q').trigger('input'); await wait(1100);
  G(sbS,'res')._buttons[0].trigger('click'); await wait(300);
  recent = JSON.parse(sbS._store['wetter:recent'] || '[]');
  H.check('Suchorte: Reihenfolge zuletzt gewählt zuerst, gleiche Namen bleiben getrennte Einträge', recent.map(r => r.lat).join(',') === '53.55,41.15,52.52', sbS._store['wetter:recent']);
  G(sbS,'locBtn').trigger('click'); await wait(350);
  G(sbS,'res')._buttons[2].trigger('click'); await wait(300);
  recent = JSON.parse(sbS._store['wetter:recent'] || '[]');
  const fcBerlin = sbS._fetchLog.filter(u => u.includes('api.open-meteo.com/v1/forecast') && u.includes('latitude=52.52') && !u.includes('models='));
  H.check('Suchorte: erneute Auswahl rückt nach vorn, keine Doppelung, Vorhersage geladen, aktiver Ort gesetzt', recent.map(r => r.lat).join(',') === '52.52,53.55,41.15' && fcBerlin.length === 2 && JSON.parse(sbS._store['wetter:active']).lat === 52.52 && G(sbS,'locName').textContent === '🔍 ' + berlin.name, sbS._store['wetter:recent'] + ' ' + fcBerlin.length);
  // vierter Ort verdrängt den ältesten
  G(sbS,'locBtn').trigger('click'); await wait(350);
  G(sbS,'q').value = 'Berl'; G(sbS,'q').trigger('input'); await wait(500);
  sbS._store['wetter:recent'] = JSON.stringify([{ name: 'A', lat: 1, lon: 1 }, { name: 'B', lat: 2, lon: 2 }, { name: 'C', lat: 3, lon: 3 }]);
  G(sbS,'res')._buttons[0].trigger('click'); await wait(300);
  recent = JSON.parse(sbS._store['wetter:recent'] || '[]');
  H.check('Suchorte: höchstens drei Einträge, der älteste fällt weg', recent.map(r => r.name).join(',') === berlin.name + ',A,B', sbS._store['wetter:recent']);
  H.check('Suchorte: ungültige Einträge werden beim Lesen verworfen', (() => { sbS._store['wetter:recent'] = JSON.stringify([{ name: 'X', lat: 'a', lon: 1 }, { name: '', lat: 1, lon: 1 }, { name: 'Ok', lat: 50, lon: 8 }, 7]); return sbS.loadRecentPlaces().map(p => p.name).join(',') === 'Ok'; })(), JSON.stringify(sbS.loadRecentPlaces()));
  sbS._store['wetter:recent'] = 'kaputt';
  H.check('Suchorte: kaputter Speicher ergibt leere Liste', sbS.loadRecentPlaces().length === 0);

  // 5b) Zustände: keine Treffer, Netzwerkfehler, wieder leere Eingabe -> Zuletzt-Liste
  const sbT = boot({ fetchImpl: geoByQuery, geolocation: granted, storage: { 'wetter:recent': JSON.stringify([berlin]) } });
  await wait(300);
  G(sbT,'locBtn').trigger('click'); await wait(350);
  G(sbT,'q').value = 'Nix'; G(sbT,'q').trigger('input'); await wait(500);
  H.check('Suche: leeres Ergebnis -> „Keine Orte gefunden“ als Statusmeldung', G(sbT,'res').innerHTML.includes('Keine Orte gefunden') && G(sbT,'res').innerHTML.includes('role="status"') && !G(sbT,'res').innerHTML.includes('nicht möglich'), G(sbT,'res').innerHTML);
  G(sbT,'q').value = 'Fehl'; G(sbT,'q').trigger('input'); await wait(500);
  H.check('Suche: Netzwerkfehler -> „Suche derzeit nicht möglich“, nicht „Keine Orte“', G(sbT,'res').innerHTML.includes('Suche derzeit nicht möglich') && !G(sbT,'res').innerHTML.includes('Keine Orte gefunden'), G(sbT,'res').innerHTML);
  const geoCalls = () => sbT._fetchLog.filter(u => u.includes('geocoding-api')).length;
  const before = geoCalls();
  G(sbT,'q').value = 'Fehl '; G(sbT,'q').trigger('input'); await wait(500);
  H.check('Suche: nach einem Fehler löst dieselbe Eingabe erneut eine Anfrage aus', geoCalls() === before + 1, geoCalls() - before);
  G(sbT,'q').value = 'Berl'; G(sbT,'q').trigger('input'); await wait(500);
  const b2 = geoCalls();
  G(sbT,'q').value = 'Berl '; G(sbT,'q').trigger('input'); await wait(500);
  H.check('Suche: gleiche Eingabe mit Leerzeichen löst keine neue Anfrage aus, Treffer bleiben', geoCalls() === b2 && places(sbT).join('|') === berlin.name, (geoCalls() - b2) + ' ' + places(sbT));
  G(sbT,'q').value = 'B'; G(sbT,'q').trigger('input'); await wait(500);
  H.check('Suche: unter zwei Zeichen keine Anfrage, Zuletzt-Liste wieder da', geoCalls() === b2 && G(sbT,'res').innerHTML.includes('Zuletzt gewählt') && places(sbT).join('|') === berlin.name, G(sbT,'res').innerHTML);

  // 5c) Verspätete Antworten: langsames „Hamb“, dann schnelles „Berl“ -> Berlin bleibt; langsames „Hamb“, dann leer -> Liste bleibt
  G(sbT,'q').value = 'Hamb'; G(sbT,'q').trigger('input'); await wait(400);
  G(sbT,'q').value = 'Berl'; G(sbT,'q').trigger('input'); await wait(500);
  H.check('Suche: schnelle Antwort der neuen Eingabe sichtbar', places(sbT).join('|') === berlin.name, places(sbT));
  await wait(700);
  H.check('Suche: verspätete Antwort der alten Eingabe überschreibt nichts', places(sbT).join('|') === berlin.name, places(sbT));
  G(sbT,'q').value = 'Hamb'; G(sbT,'q').trigger('input'); await wait(400);
  G(sbT,'q').value = ''; G(sbT,'q').trigger('input'); await wait(900);
  H.check('Suche: verspätete Antwort nach Leeren der Eingabe überschreibt die Zuletzt-Liste nicht', G(sbT,'res').innerHTML.includes('Zuletzt gewählt') && places(sbT).join('|') === berlin.name, G(sbT,'res').innerHTML);
  G(sbT,'q').value = 'Hamb'; G(sbT,'q').trigger('input'); await wait(400);
  G(sbT,'sheetClose').trigger('click'); await wait(900);
  H.check('Suche: Schließen-Knopf schließt, Fokus auf Ortsknopf, verspätete Antwort bleibt ohne Wirkung', !sbT.document.body.classList.contains('sheet-open') && G(sbT,'locBtn').focused === true && G(sbT,'res').innerHTML === '' && G(sbT,'q').value === '', G(sbT,'res').innerHTML);
  G(sbT,'locBtn').trigger('click'); await wait(350);
  G(sbT,'locBtn').focused = false;
  G(sbT,'sheet').trigger('keydown', { key: 'Escape' }); await wait(50);
  H.check('Suche: Escape im Dialog schließt und gibt den Fokus zurück', !sbT.document.body.classList.contains('sheet-open') && G(sbT,'locBtn').focused === true);
  H.check('Shell: Suchdialog mit Schließen-Knopf, Dialog-Attributen und Live-Region', (() => { const h = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8'); return h.includes('id="sheetClose"') && h.includes('id="sheet"') && h.includes('aria-modal="true"') && h.includes('id="res"') && /id="locBtn"[^>]*aria-haspopup="dialog"/.test(h) && h.includes('id="fresh"'); })());

  // 6) Aktualität: Zeitpunkt des erfolgreichen Ladens, Cache behält seinen Stand, Fehler überschreibt nichts
  const nowMs = Date.parse('2026-10-08T18:00:00Z');
  const ft = (iso, cached, tz) => sbT.freshnessText(iso, cached, nowMs, tz || 'Europe/Berlin');
  H.check('Aktualität: gerade eben', ft('2026-10-08T17:59:40Z') === 'Gerade eben aktualisiert', ft('2026-10-08T17:59:40Z'));
  H.check('Aktualität: Minuten (Singular/Plural)', ft('2026-10-08T17:59:00Z') === 'Vor 1 Minute aktualisiert' && ft('2026-10-08T17:56:00Z') === 'Vor 4 Minuten aktualisiert', ft('2026-10-08T17:56:00Z'));
  H.check('Aktualität: Stunden', ft('2026-10-08T16:58:00Z') === 'Vor 1 Stunde aktualisiert' && ft('2026-10-08T15:30:00Z') === 'Vor 2 Stunden aktualisiert', ft('2026-10-08T15:30:00Z'));
  H.check('Aktualität: älter als sechs Stunden -> Uhrzeit in Ortszeit (heute)', ft('2026-10-08T08:10:00Z') === 'Stand heute, 10:10 Uhr', ft('2026-10-08T08:10:00Z'));
  H.check('Aktualität: gestern', ft('2026-10-07T20:10:00Z') === 'Stand gestern, 22:10 Uhr', ft('2026-10-07T20:10:00Z'));
  H.check('Aktualität: älter -> Datum', ft('2026-10-05T20:10:00Z') === 'Stand 05.10., 22:10 Uhr', ft('2026-10-05T20:10:00Z'));
  H.check('Aktualität: gespeicherte Daten immer mit Stand, auch wenn frisch', ft('2026-10-08T17:56:00Z', true) === 'Stand heute, 19:56 Uhr · gespeicherte Daten', ft('2026-10-08T17:56:00Z', true));
  H.check('Aktualität: Zeitzone des Ortes (New York: 10:10 Uhr am Vortag aus Sicht Berlin ist dort „heute“)', ft('2026-10-08T08:10:00Z', false, 'America/New_York') === 'Stand heute, 04:10 Uhr Ortszeit', ft('2026-10-08T08:10:00Z', false, 'America/New_York'));
  H.check('Aktualität: ungültige Zeitzone fällt auf die Gerätezeit zurück', ft('2026-10-08T08:10:00Z', false, 'Nirgendwo/Stadt').startsWith('Stand heute, '), ft('2026-10-08T08:10:00Z', false, 'Nirgendwo/Stadt'));
  H.check('Aktualität: ohne Zeitpunkt leer', ft(null) === '' && ft('kaputt') === '');
  // Im Ablauf: nach dem Laden „Gerade eben“, Cache-Start zeigt den gespeicherten Stand, fehlgeschlagene Aktualisierung behält Daten + Stand
  H.check('Aktualität: nach erfolgreichem Laden „Gerade eben aktualisiert“', G(sb,'fresh').textContent === 'Gerade eben aktualisiert', G(sb,'fresh').textContent);
  H.check('Aktualität: Offline-Start aus dem Cache zeigt den gespeicherten Stand, nicht die Startzeit', G(sb5,'fresh').textContent.startsWith('Stand ') && G(sb5,'fresh').textContent.endsWith('· gespeicherte Daten') && G(sb5,'updated').textContent.includes('08.10.'), G(sb5,'fresh').textContent + ' | ' + G(sb5,'updated').textContent);
  let online = true;
  const flaky = async (url) => { if (!online) throw new Error('Failed to fetch'); return H.okFetch(data)(url); };
  const sbF = boot({ fetchImpl: flaky, geolocation: granted });
  await wait(300);
  const updatedBefore = G(sbF,'updated').textContent;
  const cachedIso = new Date(Date.now() - 10 * 60000).toISOString();
  const cachedText = () => sbT.freshnessText(cachedIso, true, Date.now(), 'Europe/Berlin');
  sbF._store[LOC_KEY] = JSON.stringify({ savedAt: cachedIso, payload: { fc, ens: data.ens, md: data.md, air: data.air } });
  online = false;
  G(sbF,'refresh').trigger('click'); await wait(300);
  H.check('Aktualität: fehlgeschlagene Aktualisierung behält Daten und markiert den gespeicherten Stand', G(sbF,'hero').innerHTML.includes('17°') && G(sbF,'fresh').textContent === cachedText() && cachedText().endsWith('· gespeicherte Daten') && G(sbF,'banner').innerHTML.includes('zuletzt gespeicherten'), G(sbF,'fresh').textContent + ' | ' + G(sbF,'hero').innerHTML.slice(0, 60));
  delete sbF._store[LOC_KEY];
  G(sbF,'refresh').trigger('click'); await wait(300);
  H.check('Aktualität: Fehler ohne Cache lässt die zuletzt gültigen Daten und ihren Stand stehen, Fehlerbanner mit Wiederholen', G(sbF,'hero').innerHTML.includes('17°') && G(sbF,'fresh').textContent === cachedText() && G(sbF,'banner').className.includes('err') && G(sbF,'banner').innerHTML.includes('bannerBtn'), G(sbF,'fresh').textContent + ' | ' + G(sbF,'banner').innerHTML);
  online = true;
  G(sbF,'refresh').trigger('click'); await wait(300);
  H.check('Aktualität: erfolgreiche Aktualisierung setzt wieder „Gerade eben“', G(sbF,'fresh').textContent === 'Gerade eben aktualisiert' && G(sbF,'banner').classList.contains('hidden'), G(sbF,'fresh').textContent);
  // Ortswechsel auf einen Ort ohne Daten und ohne Cache: nichts Altes bleibt stehen
  online = false;
  G(sbF,'locBtn').trigger('click'); await wait(350);
  sbF._store['wetter:recent'] = JSON.stringify([hamburgDE]);
  G(sbF,'q').value = ''; G(sbF,'q').trigger('input'); await wait(50);
  G(sbF,'res')._buttons[0].trigger('click'); await wait(300);
  H.check('Aktualität: Ortswechsel ohne Daten leert die Anzeige samt Stand', G(sbF,'fresh').textContent === '' && G(sbF,'hero').innerHTML.includes('Keine Daten') && G(sbF,'locName').textContent.includes('Hamburg'), G(sbF,'fresh').textContent + ' | ' + G(sbF,'locName').textContent);
  H.check('Aktualität: Zeile wird nur bei Änderung neu gesetzt (kein Flackern)', (() => { const n = G(sbF,'fresh'); let sets = 0; const orig = Object.getOwnPropertyDescriptor(n, 'textContent'); let v = n.textContent; Object.defineProperty(n, 'textContent', { get: () => v, set: (x) => { sets++; v = x; }, configurable: true }); sbF.updateFreshness(); sbF.updateFreshness(); if (orig) Object.defineProperty(n, 'textContent', orig); else { delete n.textContent; n.textContent = v; } return sets === 0; })());

  // Texte: Schwelle der blauen Felder, gefühlte Temperatur und Windworte in den Fenstern
  const dsrc = fs.readFileSync(require('path').join(__dirname, '..', 'design.js'), 'utf8');
  const thr = (dsrc.match(/const wet = i !== 0 && prob >= (\d+);/) || [])[1];
  H.check('Texte: Beschriftung der blauen Felder nennt dieselbe Schwelle wie die Berechnung', thr === '25' && fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').includes('Blaue Felder: Regenrisiko ab ' + thr + ' %'), thr);
  H.check('Texte: kein „windstill“ und kein „Regen wahrscheinlich“ mehr', !dsrc.includes('windstill') && !fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').includes('Regen wahrscheinlich'));

  // Shell-Markup: gleitende Tab-Pille und Design-Schleier liegen in beiden Seiten
  const idx = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const rad = fs.readFileSync(require('path').join(__dirname, '..', 'radar.html'), 'utf8');
  H.check('Shell: Tab-Pille und Design-Schleier in index.html und radar.html', [idx, rad].every(h => h.includes('<span class="tab-ink"') && h.includes('id="designVeil"')));
  H.check('Shell: Rausgehen-Feld in index.html', idx.includes('id="activityField"') && idx.includes('id="activity"'));
  H.check('Shell: keine klassische Ansicht mehr verlinkt oder vorhanden', !idx.includes('klassisch.html') && !fs.existsSync(require('path').join(__dirname, '..', 'klassisch.html')) && !fs.existsSync(require('path').join(__dirname, '..', 'wetter.css')));
  H.check('Shell: Versions-Query 20261008z an allen Asset-Links', (idx.match(/\?v=20261008z"/g) || []).length === 4 && (rad.match(/\?v=20261008z"/g) || []).length === 3, (idx.match(/\?v=\w+"/g) || []).join(','));

  if (process.env.DUMP) {
    fs.writeFileSync(__dirname + '/render-design.json', JSON.stringify({
      theme: [...body.classList.c].join(' '), hero: G(sb,'hero').innerHTML, warnings: G(sb,'warnings').innerHTML, insight: G(sb,'insight').innerHTML, hourly: G(sb,'hourly').innerHTML, nowcast: G(sb,'nowcast').innerHTML,
      days: G(sb,'days').innerHTML, details: G(sb,'details').innerHTML, models: G(sb,'models').innerHTML
    }));
  }
  H.finish();
})();
