// Design-Variante: Rendering aller Bereiche + Standort-/Suchfluss im Bottom-Sheet.
const H = require('./harness');
const vm = require('vm');
const fs = require('fs');

const DESIGN = fs.readFileSync(require('path').join(__dirname, '..', 'design.js'), 'utf8');
const fc = H.mockForecast();
const data = { fc, ens: H.mockEnsemble(fc), md: H.mockModels(), air: H.mockAir(), geo: H.mockGeocode(), warn: H.mockWarnings(H.TEST_NOW), nina: H.mockNina(),
               meta: { last_run_initialisation_time: Date.UTC(2026, 8, 25, 9) / 1000, last_run_availability_time: Date.UTC(2026, 8, 25, 10, 20) / 1000, update_interval_seconds: 10800 },
               place: { city: 'München', principalSubdivision: 'Bayern' } };
const granted = { getCurrentPosition: ok => ok({ coords: { latitude: 48.137, longitude: 11.575 } }) };
const denied = { getCurrentPosition: (ok, err) => err({ code: 1, message: 'denied' }) };
const wait = ms => new Promise(r => setTimeout(r, ms));
// Knoten liegen je nach ID im festen Satz oder im dynamischen Fallback
const G = (s, id) => s._nodes[id] || s._dyn[id];

// opts.IntersectionObserver: Stub für die Vorschauleiste; opts.docEvents: Objekt, in dem die Dokument-Listener je Ereignis als Liste landen
function boot(opts) {
  const sb = H.makeSandbox(opts);
  sb.Math = Math;
  if (opts && opts.IntersectionObserver) sb.IntersectionObserver = opts.IntersectionObserver;
  if (opts && opts.docEvents) sb.document.addEventListener = function (ev, fn) { (opts.docEvents[ev] = opts.docEvents[ev] || []).push(fn); };
  vm.runInContext(DESIGN, sb);
  sb.TEST_NOW = H.TEST_NOW;   // 14:15 Ortszeit wie in den Mock-Daten: Nachtzustand bleibt deterministisch
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
  // Fehlende Werte: kein „Tief 0°“ und kein „Gefühlt 0°“, die vorhandenen Chips bleiben
  const fcGap = JSON.parse(JSON.stringify(fc)); fcGap.current.apparent_temperature = null; fcGap.daily.temperature_2m_min[0] = null;
  const heroGap = sb.heroHtml(sb.nowFacts(fcGap), false);
  H.check('Hero: fehlendes Tief und fehlendes Gefühlt werden weggelassen statt als 0° gezeigt', heroGap.includes('>Hoch 18°<') && !heroGap.includes('Tief') && !heroGap.includes('Gefühlt') && !heroGap.includes('0°<'), heroGap.slice(heroGap.indexOf('class="chips'), heroGap.indexOf('class="chips') + 160));
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
  H.check('Rausgehen: Spur mit 48 Zellen in der Leiste, 47 mit data-i', (G(sb,'hourly').innerHTML.match(/<div class="act-track" aria-hidden="true">/g) || []).length === 1 && (G(sb,'hourly').innerHTML.match(/<i data-i="\d+"><\/i>/g) || []).length === 47 && G(sb,'hourly').innerHTML.includes('<div class="act-track" aria-hidden="true"><i></i><i data-i="15"></i>'), G(sb,'hourly').innerHTML.slice(G(sb,'hourly').innerHTML.indexOf('act-track'), G(sb,'hourly').innerHTML.indexOf('act-track') + 80));
  const act = G(sb,'activity').innerHTML;
  H.check('Rausgehen: vier Chips, Spaziergang aktiv, drei Fenster mit Startindex', (act.match(/class="act-chip( on)?" data-act=/g) || []).length === 4 && act.includes('class="act-chip on" data-act="walk" aria-pressed="true"') && act.includes('class="act-ink"') && (act.match(/class="act-ico"/g) || []).length === 4 && act.includes('<span class="act-lbl">Spaziergang</span>') && act.includes('data-act="sit" aria-pressed="false" aria-label="Draußen sitzen"><svg class="act-ico"') && act.includes('<span class="act-lbl">Sitzen</span>') && act.includes('<button type="button" class="act-win" data-i="15"') && act.includes('<b>Heute 15 bis 21 Uhr</b><span>gefühlt 10°, kaum Regen, leichter Wind</span>') && (act.match(/class="act-win"/g) || []).length === 3 && !G(sb,'activityField').classList.contains('hidden'), act.slice(0, 300));
  sb.setActivity('sit');
  const act2 = G(sb,'activity').innerHTML;
  H.check('Rausgehen: Wechsel auf Draußen sitzen, Wahl gespeichert', act2.includes('class="act-chip on" data-act="sit" aria-pressed="true"') && act2.includes('class="act-chip" data-act="walk" aria-pressed="false"') && act2.includes('<b>Morgen 9 bis 11 Uhr</b>') && sb._store['wetter:activity'] === 'sit', act2.slice(0, 200));
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
  // Hervorhebung wechseln: Linien, Chips und Band im Feld; die Knoten liefert hier ein Stub statt des DOM
  H.check('Modelle: Hervorhebung wechselt auf GFS (Linie hl, Chip gedrückt, Band aus, ICON-D2 frei)', (() => {
    const box = G(sb,'models');
    const line = id => { const e = H.el(); e.classList.add('ml'); e.classList.add('m-' + id); if (id === 'icon_d2') e.classList.add('hl'); return e; };
    const chip = id => { const e = H.el(); e.setAttribute('data-model', id); e.setAttribute('aria-pressed', id === 'icon_d2' ? 'true' : 'false'); if (id === 'icon_d2') e.classList.add('hl'); return e; };
    const lines = [line('icon_d2'), line('gfs_seamless')], chips = [chip('icon_d2'), chip('gfs_seamless')], band = H.el();
    const orig = box.querySelectorAll;
    box.querySelectorAll = sel => sel === '.ml' ? lines : sel === '.mchip' ? chips : sel === '.band' ? [band] : [];
    sb.highlightModel('gfs_seamless');
    box.querySelectorAll = orig;
    return lines[1].classList.contains('hl') && !lines[0].classList.contains('hl') && chips[1].classList.contains('hl') && chips[1].getAttribute('aria-pressed') === 'true' && !chips[0].classList.contains('hl') && chips[0].getAttribute('aria-pressed') === 'false' && band.classList.contains('off');
  })());
  // Regenpausen (Mock: Jetzt 14:15, Regen 14:45–16:15)
  const ncs = sb.nowcastSummary(fc);
  const p30 = sb.pauseInfo(ncs, 30), p60 = sb.pauseInfo(ncs, 60);
  H.check('Regenpause: 30 min beginnt jetzt, 60 min später und offen', p30.s === 0 && p30.e === 1 && !p30.open && p30.text === 'Jetzt trocken bis ca. 14:45, rund 30 Minuten.' && p60.s === 8 && p60.open && p60.text === 'Nächste trockene Phase: ab ca. 16:15, mindestens bis 18:15.', [p30.text, p60.text].join(' | '));
  const ncMid = { vals: ncs.vals.map((v, i) => (i >= 2 && i <= 3) || i >= 9 ? 0.4 : 0), times: ncs.times };
  const pMid = sb.pauseInfo(ncMid, 60);
  H.check('Regenpause: geschlossene spätere Phase mit Dauer', pMid.s === 4 && pMid.e === 8 && !pMid.open && pMid.text === 'Nächste trockene Phase: ca. 15:15 bis 16:30, rund 1 h 15 min.', pMid.text);
  H.check('Regenpause: keine Phase, mit und ohne Nachsatz', sb.pauseInfo({ vals: ncs.vals.map(() => 0.5), times: ncs.times }, 30).text === 'In den nächsten 4 Stunden keine trockene Phase von 30 Minuten.' && sb.pauseInfo({ vals: ncs.vals.map((v, i) => i === 5 ? 0 : 0.5), times: ncs.times }, 30).text === 'In den nächsten 4 Stunden keine trockene Phase von 30 Minuten, längstens rund 15 Minuten ab ca. 15:30.', sb.pauseInfo({ vals: ncs.vals.map((v, i) => i === 5 ? 0 : 0.5), times: ncs.times }, 30).text);
  const ncHtml = G(sb,'nowcast').innerHTML;
  H.check('Regenpause: Block mit Chips, 30 aktiv, Satz, Balken 0/1 markiert (1 weich)', ncHtml.includes('<div class="pause">') && ncHtml.includes('class="pchip on" data-min="30"') && (ncHtml.match(/class="pchip( on)?" data-min=/g) || []).length === 3 && ncHtml.includes('<div class="ptext">Jetzt trocken bis ca. 14:45, rund 30 Minuten.</div>') && /<div class="nc-bars" aria-hidden="true"><i class="z p" [^>]*><\/i><i class="z p pe" /.test(ncHtml), ncHtml.slice(0, 200));
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
  H.check('Zähler: Tipp-Delegat ruft keine Zähler mehr auf', !/else startCounters\(box\)/.test(DESIGN) && !/countUp\(box\.querySelector/.test(DESIGN) && /Kein Neustart der Animationen beim Antippen/.test(DESIGN));
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
  H.check('Kacheln: keine verschachtelten Schaltflächen in den Kacheln (3 Disclosure, 3 Herkunft)', !/<button[^>]*>[^<]*<button/.test(detA) && (detA.match(/<\/button>/g) || []).length === 6, (detA.match(/<\/button>/g) || []).length);
  // Vorschauleiste: ohne IntersectionObserver gilt der Hero als im Bild, die Leiste bleibt zu (sie würde sonst das Hero doppeln);
  // mit Beobachter folgt sie dem Hero. Der Stub reicht die Rückruffunktion heraus, damit der Test „Hero aus dem Bild“ melden kann.
  sb.selectHour(42);
  H.check('Vorschauleiste: ohne IntersectionObserver bleibt sie zu, die Beschriftung steht bereit', G(sb,'previewBar').classList.contains('hidden') && G(sb,'previewLabel').textContent === 'Vorschau · Morgen, 18 Uhr', G(sb,'previewLabel').textContent);
  sb.backToNow();
  H.check('Vorschauleiste: „Jetzt“ stellt das aktuelle Wetter her', G(sb,'previewBar').classList.contains('hidden') && G(sb,'hero').innerHTML.includes('Hoch 18°'));
  let ioCb = null;
  const IOStub = function (cb) { ioCb = cb; this.observe = function () {}; };
  const sbIO = boot({ fetchImpl: H.okFetch(data), geolocation: granted, IntersectionObserver: IOStub });
  await wait(300);
  sbIO.selectHour(42);
  H.check('Vorschauleiste: mit Beobachter zu, solange der Hero im Bild ist', typeof ioCb === 'function' && G(sbIO,'previewBar').classList.contains('hidden'));
  ioCb([{ isIntersecting: false }]);
  H.check('Vorschauleiste: Hero aus dem Bild gescrollt → „Vorschau · Morgen, 18 Uhr“', !G(sbIO,'previewBar').classList.contains('hidden') && G(sbIO,'previewLabel').textContent === 'Vorschau · Morgen, 18 Uhr', G(sbIO,'previewLabel').textContent);
  ioCb([{ isIntersecting: true }]);
  H.check('Vorschauleiste: Hero wieder im Bild → Leiste zu, Vorschau bleibt', G(sbIO,'previewBar').classList.contains('hidden') && G(sbIO,'hero').innerHTML.includes('Morgen, 18 Uhr'));
  ioCb([{ isIntersecting: false }]);
  sbIO.backToNow();
  H.check('Vorschauleiste: „Jetzt“ blendet sie aus und stellt das aktuelle Wetter her', G(sbIO,'previewBar').classList.contains('hidden') && G(sbIO,'hero').innerHTML.includes('Hoch 18°'));
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

  // Vergleich mit gestern: Vortag abtrennen (Datenschicht) und Chip im Hero
  const withPast = (hoursYday) => {
    const f = clone();
    const yd = '2026-09-24';
    const hT = Array.from({length: hoursYday}, (_, i) => yd + 'T' + String(i).padStart(2, '0') + ':00');
    Object.keys(f.hourly).forEach(k => { f.hourly[k] = (k === 'time' ? hT : hT.map(() => 10)).concat(f.hourly[k]); });
    const mT = Array.from({length: 96}, (_, i) => yd + 'T' + String(Math.floor(i / 4)).padStart(2, '0') + ':' + String((i % 4) * 15).padStart(2, '0'));
    f.minutely_15.time = mT.concat(f.minutely_15.time); f.minutely_15.precipitation = mT.map(() => 0).concat(f.minutely_15.precipitation);
    Object.keys(f.daily).forEach(k => { f.daily[k] = [k === 'time' ? yd : f.daily[k][0]].concat(f.daily[k]); });
    return f;
  };
  const fp = sb.splitPastDay(withPast(24));
  H.check('Vortag: Stunden, Viertelstunden und Tage beginnen wieder mit heute', fp.hourly.time[0] === '2026-09-25T00:00' && fp.hourly.time.length === 72 && fp.minutely_15.time[0] === '2026-09-25T00:00' && fp.minutely_15.precipitation.length === 96 && fp.daily.time[0] === '2026-09-25' && fp.daily.time.length === 14, [fp.hourly.time[0], fp.minutely_15.time[0], fp.daily.time[0]].join(' | '));
  H.check('Vortag: past hält 24 Stunden, 96 Viertelstunden und einen Tag', !!fp.past && fp.past.hourly.time.length === 24 && fp.past.hourly.temperature_2m.length === 24 && fp.past.hourly.time[23] === '2026-09-24T23:00' && fp.past.minutely_15.time.length === 96 && fp.past.daily.time.length === 1 && fp.past.daily.time[0] === '2026-09-24', JSON.stringify(fp.past && fp.past.daily));
  const fp23 = sb.splitPastDay(withPast(23));
  H.check('Vortag: Grenze ist das Datum, nicht die Anzahl (23-Stunden-Tag)', fp23.past.hourly.time.length === 23 && fp23.hourly.time[0] === '2026-09-25T00:00' && fp23.hourly.time.length === 72, fp23.past.hourly.time.length + ' / ' + fp23.hourly.time[0]);
  const fp0 = sb.splitPastDay(clone());
  H.check('Vortag: Daten ohne Vortag bleiben unverändert und ohne past', !('past' in fp0) && fp0.hourly.time.length === 72 && fp0.daily.time[0] === '2026-09-25');
  H.check('Vortag: Abfrage holt past_days=1', (sb._fetchLog.find(u => u.includes('api.open-meteo.com/v1/forecast') && u.includes('forecast_days=14')) || '').includes('past_days=1'), sb._fetchLog.find(u => u.includes('forecast_days=14')));
  const yFc = (t14, t15) => { const f = clone(); f.past = { hourly: { time: Array.from({length: 24}, (_, i) => '2026-09-24T' + String(i).padStart(2, '0') + ':00'), temperature_2m: Array.from({length: 24}, (_, i) => i === 14 ? t14 : (i === 15 ? t15 : 10)) } }; return f; };
  H.check('Gestern: wärmer, kälter, gleich (14:15 zwischen 14 und 15 Uhr interpoliert)', sb.yesterdayText(yFc(15.0, 15.4)) === '2° wärmer als gestern' && sb.yesterdayText(yFc(20.6, 20.6)) === '3° kälter als gestern' && sb.yesterdayText(yFc(17.2, 17.2)) === 'Wie gestern', [sb.yesterdayText(yFc(15.0, 15.4)), sb.yesterdayText(yFc(20.6, 20.6)), sb.yesterdayText(yFc(17.2, 17.2))].join(' | '));
  H.check('Gestern: ohne Vortag kein Text', sb.yesterdayText(clone()) === null);
  const yLate = yFc(10, 10); yLate.current.time = '2026-09-25T23:30';
  const expLate = Math.round(17.4 - (10 + (yLate.hourly.temperature_2m[0] - 10) * 0.5));
  H.check('Gestern: 23:30 interpoliert mit 0 Uhr heute', sb.yesterdayText(yLate) === expLate + '° wärmer als gestern', sb.yesterdayText(yLate) + ' vs ' + expLate);
  const yGap = yFc(15, 15); yGap.past.hourly.time[14] = '2026-09-24T14:30';
  H.check('Gestern: fehlende Stunde heißt kein Vergleich', sb.yesterdayText(yGap) === null);
  sb.renderHero(yFc(15.0, 15.4));
  H.check('Hero: Chip „2° wärmer als gestern“ als vierter Chip im Jetzt-Zustand', />Gefühlt 16°<\/span><span class="a-up" style="animation-delay:[-\d.]+s">2° wärmer als gestern<\/span><\/div>/.test(G(sb,'hero').innerHTML), G(sb,'hero').innerHTML.slice(-220));
  sb.selectHour(42);
  H.check('Hero: in der Vorschau kein Vergleich mit gestern', !/gestern/.test(G(sb,'hero').innerHTML));
  sb.backToNow();
  sb.renderHero(fc);
  // Schirm-Schwelle: Rat nach Menge, stärkster Viertelstunde und Risiko
  const data0 = sb.prepareData(fc, data.ens);
  const ncOf = (vals) => ({ wet: true, vals: vals.concat(Array(16 - vals.length).fill(0)), times: ncs.times, text: '' });
  const advFull = sb.umbrellaAdvice(ncOf([0.4, 0.4, 0.4, 0.4, 0.4, 0.4]), fc, data0);
  const advLight = sb.umbrellaAdvice(ncOf([0.3, 0.3, 0.3, 0.3]), fc, data0);
  const advDrop = sb.umbrellaAdvice(ncOf([0.1, 0.1]), fc, data0);
  const advPeak = sb.umbrellaAdvice(ncOf([0.7]), fc, data0);
  H.check('Rat: Stufen Schirm, leicht, Tropfen; Spitze allein reicht für Schirm', advFull.level === 2 && advFull.text === 'Schirm einpacken' && advLight.level === 1 && advLight.text === 'Leichter Regen, eine Kapuze reicht' && advDrop.level === 0 && advDrop.text === 'Nur ein paar Tropfen, kein Schirm nötig' && advPeak.level === 2, [advFull.text, advLight.text, advDrop.text, advPeak.level].join(' | '));
  H.check('Rat: Symbol je Stufe (Regen-Schirm, ruhiger Schirm, Tropfen)', advFull.icon.includes('class="umb"') && !advLight.icon.includes('class="umb"') && advLight.icon.includes('M3 12a9 9 0 0 1 18 0z') && advDrop.icon.includes('M12 3s6 7 6 11'), advDrop.icon.slice(0, 60));
  const fcLow = clone(); fcLow.hourly.precipitation_probability = fcLow.hourly.precipitation_probability.map(() => 20);
  H.check('Rat: unter 30 % Risiko vorsichtiger', sb.umbrellaAdvice(ncOf([0.4, 0.4, 0.4, 0.4, 0.4, 0.4]), fcLow, null).text === 'Schirm zur Sicherheit, Risiko 20 %' && sb.umbrellaAdvice(ncOf([0.3, 0.3, 0.3, 0.3]), fcLow, null).text === 'Leichter Regen möglich, Risiko 20 %' && sb.umbrellaAdvice(ncOf([0.1, 0.1]), fcLow, null).text === 'Vielleicht ein paar Tropfen, Risiko 20 %', sb.umbrellaAdvice(ncOf([0.4, 0.4, 0.4, 0.4, 0.4, 0.4]), fcLow, null).text);
  const fcZero = clone(); fcZero.hourly.precipitation_probability = fcZero.hourly.precipitation_probability.map(() => 0);
  H.check('Rat: Risiko nahe null heißt „unter 10 %“, nicht „0 %“', sb.umbrellaAdvice(ncOf([0.4, 0.4, 0.4, 0.4, 0.4, 0.4]), fcZero, null).text === 'Schirm zur Sicherheit, Risiko unter 10 %', sb.umbrellaAdvice(ncOf([0.4, 0.4, 0.4, 0.4, 0.4, 0.4]), fcZero, null).text);
  H.check('Rat: Risiko ist das Maximum der Stunden im Nowcast-Fenster', sb.nowcastProb(fc, data0) === advFull.prob && advFull.prob >= 30 && sb.nowcastProb(fcLow, null) === 20, advFull.prob + ' / ' + sb.nowcastProb(fcLow, null));
  const fcLight = clone(); fcLight.minutely_15.precipitation = fcLight.minutely_15.precipitation.map((v, i) => (i >= 60 && i < 66 ? 0.2 : 0));
  sb.renderHero(fcLight);
  H.check('Hinweis bei leichtem Regen: Kapuze und ruhiger Schirm', G(sb,'insight').innerHTML.includes('<span>Leichter Regen, eine Kapuze reicht</span>') && !G(sb,'insight').innerHTML.includes('<svg class="umb"') && G(sb,'insight').innerHTML.includes('Regen ab ca. 14:45 Uhr · ca. 1,2 mm'), G(sb,'insight').innerHTML);
  const fcDrops = clone(); fcDrops.minutely_15.precipitation = fcDrops.minutely_15.precipitation.map((v, i) => (i === 60 || i === 61 ? 0.1 : 0));
  sb.renderHero(fcDrops);
  H.check('Hinweis bei Tropfen: kein Schirm nötig, Tropfen-Symbol', G(sb,'insight').innerHTML.includes('<span>Nur ein paar Tropfen, kein Schirm nötig</span>') && G(sb,'insight').innerHTML.includes('M12 3s6 7 6 11'), G(sb,'insight').innerHTML);
  sb.renderHero(fc);

  // Woher kommt das? Herkunftsblatt mit Quelle, Modell, Gitterpunkt, Rechenwegen und Stand
  // Verzeichnisse aus META_MODELS der Sandbox, damit die Liste nicht veraltet; genau ein Abruf je Modell
  const metaDirs = vm.runInContext('META_MODELS', sb).map(m => m.dir), metaFetches = sb._fetchLog.filter(u => u.includes('/static/meta.json'));
  H.check('Herkunft: Abfrage holt die Metadaten aller sechs Modelle aus META_MODELS, auch ARPEGE', metaDirs.length === 6 && metaDirs.includes('meteofrance_arpege_europe') && metaFetches.length === metaDirs.length && metaDirs.every(d => metaFetches.some(u => u.includes('/data/' + d + '/static/meta.json'))), metaFetches.join(' | '));
  H.check('Herkunft: Aktualitätszeile mit sichtbarem Knopf „Woher?“', G(sb,'freshTxt').textContent === 'Gerade eben aktualisiert' && !G(sb,'freshSrc').classList.contains('hidden'), G(sb,'freshTxt').textContent);
  H.check('Herkunft: Instrument-Felder enden mit „Woher kommt das?“', (G(sb,'details').innerHTML.match(/<button type="button" class="tp-src" data-src="(wind|rain|sun)">Woher kommt das\?<\/button><\/div><\/div><\/div>/g) || []).length === 3, (G(sb,'details').innerHTML.match(/tp-src/g) || []).length);
  sb.openSource('wind', null);
  const srcHtml = G(sb,'srcBody').innerHTML;
  H.check('Herkunft: Blatt öffnet beim Abschnitt Wind', sb.document.body.classList.contains('src-open') && G(sb,'src').getAttribute('data-section') === 'src-wind', G(sb,'src').getAttribute('data-section'));
  H.check('Herkunft: Ort und Modellpunkt mit Entfernung und Höhe', /Gewählter Ort: München[^(]*\(48,14° N, 11,57° O\)\./.test(srcHtml) && srcHtml.includes('Modellpunkt der Vorhersage: 48,14° N, 11,57° O, 0,0 km entfernt, 520 m Höhe.') && /Luft und Pollen: Punkt [\d,]+ km entfernt, Raster etwa 11 km\./.test(srcHtml), srcHtml.slice(srcHtml.indexOf('src-ort'), srcHtml.indexOf('src-ort') + 400));
  // openSource stempelt das Blatt mit nowMs(), also mit TEST_NOW: der Lauf von 11:00 Ortszeit ist „heute“
  const runTxt = sb.stampAt(Date.UTC(2026, 8, 25, 9), H.TEST_NOW, 'Europe/Berlin'), availTxt = sb.stampAt(Date.UTC(2026, 8, 25, 10, 20), H.TEST_NOW, 'Europe/Berlin');
  H.check('Herkunft: ICON-D2-Lauf aus den Metadaten in Ortszeit, Stempel mit der Testzeit', srcHtml.includes('ICON-D2-Lauf von ' + runTxt + ', verfügbar seit ' + availTxt + '. Neuer Lauf alle 3 Stunden.') && runTxt === 'heute, 11:00 Uhr', srcHtml.slice(srcHtml.indexOf('ICON-D2-Lauf'), srcHtml.indexOf('ICON-D2-Lauf') + 140));
  H.check('Herkunft: Ladezeitpunkt wie in der Aktualitätszeile', srcHtml.includes('<p>Gerade eben aktualisiert.</p>'));
  H.check('Herkunft: Läufe der Vergleichsmodelle mit Zeit, ARPEGE dabei', new RegExp('Läufe der Vergleichsmodelle: ICON-EU ' + runTxt + ', ECMWF IFS ' + runTxt + ', ARPEGE ' + runTxt + ', UKMO ' + runTxt + ', GFS ' + runTxt + '\\.').test(srcHtml), srcHtml.slice(srcHtml.indexOf('Läufe der Vergleichsmodelle'), srcHtml.indexOf('Läufe der Vergleichsmodelle') + 200));
  H.check('Herkunft: Modellvergleich nennt alle sechs Modelle aus MODELS, auch ARPEGE', srcHtml.includes('Modellvergleich: ICON-D2, ICON-EU, ECMWF IFS, ARPEGE, UKMO und GFS, jeweils eigener Lauf.'), srcHtml.slice(srcHtml.indexOf('Modellvergleich'), srcHtml.indexOf('Modellvergleich') + 120));
  H.check('Herkunft: Karte des Radars ist OpenFreeMap, nicht basemap.de', srcHtml.includes('Karte OpenFreeMap (OpenMapTiles-Schema, Daten OpenStreetMap)') && !srcHtml.includes('basemap.de'), srcHtml.slice(srcHtml.indexOf('Radar:'), srcHtml.indexOf('Radar:') + 160));
  H.check('Herkunft: Abschnitt Nächste Tage mit Regeln, Feld verlinkt dorthin', srcHtml.includes('<section class="src-sec" id="src-highlights"><h3>Nächste Tage</h3><p>Nächste Tage: Regeln auf den Tageswerten von morgen bis in sieben Tagen. Temperatursprung ab 5° zum Vortag') && G(sb,'highlights').innerHTML.endsWith('<button type="button" class="tp-src" data-src="highlights">Woher kommt das?</button>'), G(sb,'highlights').innerHTML.slice(-120));
  H.check('Herkunft: Regenrisiko als Anteil der Läufe', srcHtml.includes('Jetzt 15 von 21 Läufen, also 71 %.'), srcHtml.slice(srcHtml.indexOf('Regenrisiko je Stunde'), srcHtml.indexOf('Regenrisiko je Stunde') + 160));
  H.check('Herkunft: Nebelrisiko mit den aktuellen Zahlen', /Jetzt: Taupunktabstand 3,0°, Wind 18 km\/h, Bewölkung 45 %, Risiko gering\./.test(srcHtml), srcHtml.slice(srcHtml.indexOf('Jetzt: Taupunkt'), srcHtml.indexOf('Jetzt: Taupunkt') + 100));
  H.check('Herkunft: Vergleich mit gestern als Modellwert', srcHtml.includes('Vergleich mit gestern: Modellwert von gestern zur selben Uhrzeit') && srcHtml.includes('keine Messung'));
  H.check('Herkunft: Rausgehen-Schwellen aus der Tabelle', srcHtml.includes('Spaziergang: gefühlt 5 bis 28°, Regenrisiko unter 30 %, Böen unter 45 km/h, bis zur Dämmerung, mindestens 1 Stunde am Stück.') && srcHtml.includes('Draußen sitzen: gefühlt ab 17°, Regenrisiko unter 20 %, Wind unter 15 km/h, Böen unter 30 km/h, auch nachts, mindestens 2 Stunden am Stück.'), srcHtml.slice(srcHtml.indexOf('Spaziergang:'), srcHtml.indexOf('Spaziergang:') + 140));
  H.check('Herkunft: elf Abschnitte mit Überschriften', (srcHtml.match(/<section class="src-sec" id="src-/g) || []).length === 11 && ['ort','modelle','temp','regen','wind','sonne','sicht','rausgehen','highlights','luft','warn'].every(k => srcHtml.includes('id="src-' + k + '"')) && (srcHtml.match(/<h3>/g) || []).length === 11, (srcHtml.match(/<section class="src-sec" id="src-/g) || []).length);
  sb.closeSource();
  H.check('Herkunft: Schließen nimmt die Körperklasse weg', !sb.document.body.classList.contains('src-open'));
  const srcBare = sb.sourceSheetHtml(sb.prepareData(clone(), null), null, null, null, null, false, H.TEST_NOW);
  H.check('Herkunft: ohne Metadaten, Luftdaten, Ort und Ensemble bleibt das Blatt vollständig', !srcBare.includes('ICON-D2-Lauf') && !srcBare.includes('Luft und Pollen: Punkt') && !srcBare.includes('Gewählter Ort') && srcBare.includes('ohne Ensemble der Modellwert') && srcBare.includes('Modellpunkt der Vorhersage: 48,14° N, 11,57° O, 520 m Höhe.') && (srcBare.match(/<section/g) || []).length === 11, srcBare.slice(0, 300));
  await wait(320);   /* Klicks innerhalb von 300 ms nach einem Zieh-Ende werden verworfen */
  sb.document.body.trigger('click', { target: { closest: sel => sel === '.tp-src' ? { getAttribute: () => 'sicht', focus() {} } : null } });
  H.check('Herkunft: „Woher kommt das?“ im Feld öffnet beim Abschnitt Sicht', sb.document.body.classList.contains('src-open') && G(sb,'src').getAttribute('data-section') === 'src-sicht', G(sb,'src').getAttribute('data-section'));
  sb.closeSource();

  // Highlights der nächsten Tage: Kandidaten, Auswahl, Markup, Sprung in die Tagesliste
  const hlOf = (mut) => { const f = clone(); mut(f.daily, f); return f; };
  const cand = sb.dayHighlights(fc);
  const kinds = cand.map(c => c.kind + '@' + c.day + (c.dayTo ? '-' + c.dayTo : '')).join(',');
  H.check('Highlights: Kandidaten am Mock (Sprung, Nass, Gewitter, Trockenphase)', kinds === 'sprung@1,nass@2,nass@3,gewitter@3,trocken@4-7', kinds);
  H.check('Highlights: Texte der Kandidaten', cand[0].text === '5° wärmer, 23° statt 18°' && cand[1].text === 'Nass, rund 13 mm bei 80 % Risiko' && cand[3].text === 'Gewitter möglich' && cand[4].text === 'Trocken', cand.map(c => c.text).join(' | '));
  const picked = sb.pickHighlights(cand, 3);
  H.check('Highlights: Auswahl pro Tag die wichtigste, drei nach Priorität, nach Tagen sortiert', picked.map(c => c.kind + '@' + c.day).join(',') === 'sprung@1,nass@2,gewitter@3', picked.map(c => c.kind + '@' + c.day).join(','));
  const hlHtml = G(sb,'highlights').innerHTML;
  H.check('Highlights: drei Zeilen als Schaltflächen mit Tag und langem Wochentag', (hlHtml.match(/class="hl-row"/g) || []).length === 3 && hlHtml.includes('<button type="button" class="hl-row" data-day="2" aria-label="Sonntag: Nass, rund 13 mm bei 80 % Risiko"><span class="hl-day">' + sb.weekday('2026-09-27') + '</span><span class="hl-txt">Nass, rund 13 mm bei 80 % Risiko</span></button>') && !hlHtml.includes('hl-none'), hlHtml.slice(0, 300));
  const fFrost = hlOf(d => { d.temperature_2m_min[3] = -1; d.temperature_2m_min[5] = -2; });
  const cFrost = sb.dayHighlights(fFrost).filter(c => c.kind === 'frost');
  H.check('Highlights: erster Frost nur am ersten Frosttag', cFrost.length === 1 && cFrost[0].day === 3 && cFrost[0].text === 'Erster Frost, morgens -1°' && cFrost[0].prio === 8, JSON.stringify(cFrost));
  const fFrostToday = hlOf(d => { d.temperature_2m_min[0] = -0.5; d.temperature_2m_min[3] = -1; });
  const fFrostYday = hlOf((d, f) => { d.temperature_2m_min[3] = -1; f.past = { daily: { time: ['2026-09-24'], temperature_2m_min: [-2] } }; });
  H.check('Highlights: kein „erster Frost“, wenn heute oder gestern schon Frost war', !sb.dayHighlights(fFrostToday).some(c => c.kind === 'frost') && !sb.dayHighlights(fFrostYday).some(c => c.kind === 'frost'));
  const fWind = hlOf(d => { d.wind_gusts_10m_max[2] = 62; d.wind_gusts_10m_max[4] = 80; });
  const cWind = sb.dayHighlights(fWind).filter(c => c.kind === 'sturm');
  H.check('Highlights: Sturm in zwei Stufen', cWind.length === 2 && cWind[0].text === 'Stürmisch, Böen bis 62 km/h' && cWind[0].prio === 6 && cWind[1].text === 'Sturmböen bis 80 km/h' && cWind[1].prio === 9, JSON.stringify(cWind));
  H.check('Highlights: Sturmböen verdrängen schwächere Kandidaten', sb.pickHighlights(sb.dayHighlights(fWind), 3).some(c => c.kind === 'sturm' && c.day === 4));
  const fMix = hlOf(d => { d.weather_code[2] = 73; d.weather_code[4] = 45; d.temperature_2m_max[6] = 31; d.sunshine_duration[5] = 30000; });
  const cMix = sb.dayHighlights(fMix);
  const kindAt = (k) => cMix.find(c => c.kind === k);
  H.check('Highlights: Schnee, Nebel, Hitze, sonnigster Tag', kindAt('schnee') && kindAt('schnee').day === 2 && kindAt('schnee').text === 'Schnee' && kindAt('nebel') && kindAt('nebel').day === 4 && kindAt('nebel').text === 'Nebel' && kindAt('hitze') && kindAt('hitze').day === 6 && kindAt('hitze').text === 'Hitze, 31°' && kindAt('sonne') && kindAt('sonne').day === 5 && kindAt('sonne').text === 'Sonnig, 8 Stunden Sonne', cMix.map(c => c.kind + '@' + c.day + ':' + c.text).join(' | '));
  H.check('Highlights: Sonne unter 7 Stunden oder unter 70 % des Tageslichts zählt nicht', !sb.dayHighlights(hlOf(d => { d.sunshine_duration[5] = 28800; })).some(c => c.kind === 'sonne'));
  H.check('Highlights: Zeitraum-Beschriftung für die Trockenphase', sb.hlLabel(fc, cand[4]) === sb.weekday('2026-09-29') + '–' + sb.weekday('2026-10-02') && sb.hlLabel(fc, cand[0]) === sb.weekday('2026-09-26'), sb.hlLabel(fc, cand[4]));
  const fCalm = hlOf(d => { for (let i = 0; i < d.time.length; i++) { d.weather_code[i] = 2; d.precipitation_sum[i] = 0; d.precipitation_probability_max[i] = 40; d.temperature_2m_max[i] = 18; d.temperature_2m_min[i] = 8; d.wind_gusts_10m_max[i] = 30; d.sunshine_duration[i] = 21600; } });
  H.check('Highlights: ruhige Woche als ruhiger Satz', sb.dayHighlights(fCalm).length === 0 && sb.highlightsHtml(fCalm) === '<div class="hl-none">Die nächsten sieben Tage ohne Auffälligkeiten.</div>', sb.highlightsHtml(fCalm));
  H.check('Tage: Zeilen tragen data-day für den Sprung aus den Highlights', (G(sb,'days').innerHTML.match(/class="drow[^"]*" data-day="\d+"/g) || []).length === 14, (G(sb,'days').innerHTML.match(/data-day=/g) || []).length);
  sb.document.body.trigger('click', { target: { closest: sel => sel === '.hl-row' ? { getAttribute: () => '7' } : null } });
  H.check('Highlights: Tipp auf Tag 7 klappt die weiteren Tage auf', G(sb,'daysField').classList.contains('all') && G(sb,'daysMoreLabel').textContent === 'Weniger anzeigen', G(sb,'daysMoreLabel').textContent);
  G(sb,'daysField').classList.remove('all');
  H.check('Shell: Feld „Nächste Tage“ in index.html und Stile im Stylesheet', fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').includes('id="highlights"') && fs.readFileSync(require('path').join(__dirname, '..', 'modern.css'), 'utf8').includes('.hl-row') && fs.readFileSync(require('path').join(__dirname, '..', 'modern.css'), 'utf8').includes('.drow.flash'));

  // Zugänglichkeit, Stufe 1: Schrift folgt der Systemgröße (rem auf 17-px-Basis, Dynamic Type unter WebKit)
  const cssA = fs.readFileSync(require('path').join(__dirname, '..', 'modern.css'), 'utf8');
  const radarA = fs.readFileSync(require('path').join(__dirname, '..', 'radar.html'), 'utf8');
  const idxA = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  H.check('Schrift: 17-px-Grundschrift, unter WebKit auf Touch-Geräten die Systemgröße', cssA.includes('html { font-size: 17px; }') && /@supports \(font: -apple-system-body\)\s*\{\s*@media \(hover: none\) and \(pointer: coarse\)\s*\{\s*html \{ font: -apple-system-body; \}/.test(cssA) && cssA.includes('body {\n    font-family:') && /body \{[^}]*font-size: 1rem;/.test(cssA));
  const pxSizes = (cssA.match(/font-size: *[0-9.]+px/g) || []);
  const pxLines = cssA.split('\n').filter(l => /font-size: *[0-9.]+px/.test(l));
  H.check('Schrift: alle Textgrößen in rem, auch in SVG-Grafiken; Pixel nur an der Wurzel', pxSizes.length === 1 && pxLines.every(l => /^html \{ font-size: 17px; \}/.test(l)) && (cssA.match(/font-size: *[0-9.]+rem/g) || []).length >= 70, pxSizes.length + ' px: ' + pxLines.map(l => l.trim().slice(0, 40)).join(' | '));
  H.check('Schrift: große Zahlen über die Bildschirmbreite gedeckelt', /\.hero-field \.temp \{[^}]*font-size: min\([0-9.]+rem, [0-9.]+vw\)/.test(cssA) && /\.tile \.big \{[^}]*font-size: min\([0-9.]+rem, [0-9.]+vw\)/.test(cssA) && /\.tile\.plain \.big \{[^}]*font-size: min\([0-9.]+rem, [0-9.]+vw\)/.test(cssA) && /\.wind-now \.big \{[^}]*font-size: min\([0-9.]+rem, [0-9.]+vw\)/.test(cssA));
  H.check('Schrift: Zeilenhöhen ohne Pixel, Textzeilen mit Mindest- statt Festhöhe', !/line-height: *[0-9.]+px/.test(cssA) && /\.drow \{[^}]*min-height: 48px/.test(cssA) && !/\.drow \{[^}]*[^-]height: 48px/.test(cssA) && /\.days-more \{[^}]*min-height: 48px/.test(cssA) && /\.loc \{[^}]*min-height: 46px/.test(cssA) && /\.banner button \{[^}]*min-height: 44px/.test(cssA) && /\.preview-bar \.pb-now \{[^}]*min-height: 36px/.test(cssA), (cssA.match(/line-height: *[0-9.]+px/g) || []).join(','));
  H.check('Schrift: Textspalten der Tagesliste und Stundenspalten skalieren mit', /\.drow \.n \{[^}]*width: [0-9.]+rem/.test(cssA) && /\.drow \.lo, \.drow \.hi \{[^}]*width: [0-9.]+rem/.test(cssA) && /\.hl-day \{[^}]*min-width: [0-9.]+rem/.test(cssA) && /\.hcol \{[^}]*flex: 0 0 [0-9.]+rem/.test(cssA) && /\.act-track i \{[^}]*flex: 0 0 [0-9.]+rem/.test(cssA));
  H.check('Schrift: Radarseite ohne Pixel-Schriftgrößen', !/font-size: *[0-9.]+px/.test(radarA), (radarA.match(/font-size: *[0-9.]+px/g) || []).join(','));
  H.check('Breite Bildschirme: zwei Spalten ab 760 px, vier Kachelspalten', /@media \(min-width: 760px\) \{[\s\S]*#sec-today, #sec-days \{ display: block; columns: 2;[\s\S]*\.tiles \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/.test(cssA) && idxA.includes('id="hoursField"'));
  H.check('Bewegung: eine Kurve und drei Dauerstufen, keine losen Kurven mehr', cssA.includes('--ease: cubic-bezier(.2,.8,.2,1);') && cssA.includes('--d-fast: 0.3s; --d-base: 0.55s; --d-slow: 0.9s;') && (cssA.match(/cubic-bezier\(\.2,\.8,\.2,1\)/g) || []).length === 1 && (cssA.match(/var\(--d-(fast|base|slow)\) var\(--ease\)/g) || []).length >= 40 && cssA.includes('html.reduce *, html.reduce *::before, html.reduce *::after { animation: none !important; transition: none !important; }'), (cssA.match(/var\(--d-(fast|base|slow)\) var\(--ease\)/g) || []).length);
  H.check('Bewegung: Startchoreografie gestaucht, Seite ohne Verzögerung über 1,4 s, kein Neustart beim Antippen', /const INTRO_SCALE = 0\.6;/.test(DESIGN) && idxA.split('\n').every(l => !/animation-delay:([2-9]|1\.[5-9])/.test(l)) && !/restartAnimations\(box\)/.test(DESIGN) && !/if \(panel\) \{ restartAnimations\(panel\); return; \}/.test(DESIGN), (idxA.match(/animation-delay:[0-9.]+s/g) || []).slice(-3).join(','));
  H.check('Schrift: Obergrenze 1,6-fach im Kopfskript', /fontSize[\s\S]{0,200}27\.2|27\.2[\s\S]{0,200}fontSize/.test(idxA) && idxA.includes('Schriftgrenze'), idxA.slice(idxA.indexOf('Schriftgrenze') - 80, idxA.indexOf('Schriftgrenze') + 120));

  // Zugänglichkeit, Stufe 2: Stundenspalten als Schaltflächen mit Satz je Stunde, Pfeiltasten
  const hhA = G(sb,'hourly').innerHTML;
  H.check('Stundenspalten: Schaltflächen mit Satz je Stunde, Jetzt mit Tabstopp, übrige ohne', (hhA.match(/<button type="button" aria-label="/g) || []).length === 48 && /<button type="button" aria-label="Jetzt: [^,"]+, 17 Grad, gefühlt 16, Regenrisiko \d+ %, Wind 12 km\/h" tabindex="0" class="hcol now"/.test(hhA) && (hhA.match(/tabindex="-1" data-i="\d+" class="hcol/g) || []).length === 47 && /aria-label="Heute, 15 Uhr: [^,"]+, -?\d+ Grad, gefühlt -?\d+, Regenrisiko \d+ %, Wind \d+ km\/h" tabindex="-1" data-i="15" class="hcol/.test(hhA) && hhA.includes('<div class="act-track" aria-hidden="true">'), hhA.slice(hhA.indexOf('<button'), hhA.indexOf('<button') + 220));
  H.check('Stundenspalten: Tastenlogik', sb.hourKeyIndex('ArrowRight', 0, 48) === 1 && sb.hourKeyIndex('ArrowLeft', 0, 48) === 0 && sb.hourKeyIndex('ArrowRight', 47, 48) === 47 && sb.hourKeyIndex('Home', 20, 48) === 0 && sb.hourKeyIndex('End', 20, 48) === 47 && sb.hourKeyIndex('a', 20, 48) === null);
  const colStubs = [0, 15, 16].map((gi, k) => { const a = { tabindex: k === 0 ? '0' : '-1' }; const c = { gi, a, classList: { contains: () => false, add() {}, remove() {} }, getAttribute: (n) => n === 'data-i' ? (gi === 0 ? null : String(gi)) : (a[n] || null), setAttribute: (n, v) => { a[n] = String(v); }, focus() { c.focused = true; }, closest: (s) => s === '.hcol' ? c : null }; return c; });
  const hbox = G(sb,'hourly'); const origQSA2 = hbox.querySelectorAll;
  hbox.querySelectorAll = (sel) => sel === '.hcol' ? colStubs : [];
  hbox.trigger('keydown', { key: 'ArrowRight', target: colStubs[0], preventDefault() {} });
  H.check('Stundenspalten: Pfeil rechts fokussiert die nächste Spalte, wählt die Stunde und verschiebt den Tabstopp', colStubs[1].focused === true && colStubs[1].a.tabindex === '0' && colStubs[0].a.tabindex === '-1' && G(sb,'hero').innerHTML.includes('Heute, 15 Uhr'), G(sb,'hero').innerHTML.slice(0, 100) + ' | ' + JSON.stringify(colStubs.map(c => c.a)));
  hbox.trigger('keydown', { key: 'Home', target: colStubs[1], preventDefault() {} });
  H.check('Stundenspalten: Pos1 geht zurück auf Jetzt', colStubs[0].focused === true && colStubs[0].a.tabindex === '0' && colStubs[1].a.tabindex === '-1' && G(sb,'hero').innerHTML.includes('Hoch 18°'), JSON.stringify(colStubs.map(c => c.a)));
  hbox.querySelectorAll = origQSA2;
  // Stufe 3: Textalternativen je Diagramm
  const ncA = G(sb,'nowcast').innerHTML;
  H.check('Diagramme: Regenbalken mit Satz, Balken und Achse für Vorleser ausgeblendet', ncA.includes('<div class="nc-bars" aria-hidden="true">') && ncA.includes('<div class="nc-axis" aria-hidden="true">') && ncA.includes('<div class="vh">Regen je Viertelstunde der nächsten 4 Stunden: stärkste Viertelstunde um 14:45 Uhr mit 0,4 mm, insgesamt 2,4 mm.</div>'), ncA.slice(ncA.indexOf('class="vh"') - 10, ncA.indexOf('class="vh"') + 150));
  const detB = G(sb,'details').innerHTML;
  H.check('Diagramme: Böen- und Regenverlauf als Bild mit Beschreibung, Achsen ausgeblendet', /<div class="gusts" role="img" aria-label="Wind und Böen der nächsten 12 Stunden: Böen bis \d+ km\/h gegen \d+ Uhr\.">/.test(detB) && /<div class="rain24" role="img" aria-label="Regen der nächsten 24 Stunden: insgesamt [\d,]+ mm, am meisten um \d+ Uhr mit [\d,]+ mm\.">/.test(detB) && detB.includes('<div class="gust-axis" aria-hidden="true">') && detB.includes('<div class="rain-axis" aria-hidden="true">'), detB.slice(detB.indexOf('class="gusts"'), detB.indexOf('class="gusts"') + 120));
  H.check('Diagramme: Sichtverlauf als Bild mit dem Risikosatz', sb.sichtPanelHtml(fc).includes('<div class="vis24" role="img" aria-label="Sichtverlauf der nächsten 24 Stunden: Nebelrisiko hoch morgen von 5 bis 7 Uhr: Sicht unter 1 km.">'), sb.sichtPanelHtml(fc).slice(0, 160));
  H.check('Diagramme: Sonnenbogen mit verborgenem Satz', /<div class="vh">Tageslichtbogen: Aufgang 07:12, Untergang 19:05, \d+ % des Tages vergangen\.<\/div>/.test(sb.sunPanelHtml(fc)), sb.sunPanelHtml(fc).slice(sb.sunPanelHtml(fc).indexOf('class="vh"'), sb.sunPanelHtml(fc).indexOf('class="vh"') + 100));
  H.check('Diagramme: Modellkurven mit verborgenem Satz', G(sb,'models').innerHTML.includes('<div class="vh">Regensummen je Modell als Kurven: heute 0 mm, morgen 2,0 bis 6,0 mm.</div>'), G(sb,'models').innerHTML.slice(G(sb,'models').innerHTML.indexOf('class="vh"'), G(sb,'models').innerHTML.indexOf('class="vh"') + 100));
  const ddA = G(sb,'days').innerHTML;
  H.check('Diagramme: Tageszeilen als Bild mit Satz (Wetter, Risiko, Spanne, Menge, Böen)', /<div class="drow today" data-day="0" role="img" aria-label="Heute: [^,"]+, Regenrisiko 10 %, 8 bis 18 Grad, Böen bis 48 km\/h"/.test(ddA) && /data-day="1" role="img" aria-label="Samstag: [^,"]+, Regenrisiko 55 %, 11 bis 23 Grad, 3,4 mm, Böen bis 48 km\/h"/.test(ddA) && (ddA.match(/role="img"/g) || []).length === 14, ddA.slice(0, 220));
  H.check('Diagramme: verborgene Textklasse im Stylesheet', /\.vh \{[^}]*position: absolute[^}]*clip/.test(cssA));
  // Stufe 4: Kontrast, aus den Token des Stylesheets gerechnet
  const lumA = (h) => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const crA = (a, b) => { if (!a || !b) return 0; const x = lumA(a), y = lumA(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const tok = (block, name) => (block.match(new RegExp('--' + name + ': (#[0-9A-Fa-f]{6});')) || [])[1];
  const dayB = cssA.slice(0, cssA.indexOf('html.night {')), nightB = cssA.slice(cssA.indexOf('html.night {'));
  const tintDay = (cssA.match(/\n\.tile\.uv, \.tile\.wind, \.tile\.rain, \.tile\.sun, \.tp-wind, \.tp-rain, \.tp-sun \{ --ink-2: (#[0-9A-Fa-f]{6}); \}/) || [])[1];
  const tintNight = (cssA.match(/\nhtml\.night \.tile\.uv, html\.night \.tile\.wind, html\.night \.tile\.rain, html\.night \.tile\.sun, html\.night \.tp-wind, html\.night \.tp-rain, html\.night \.tp-sun \{ --ink-2: (#[0-9A-Fa-f]{6}); \}/) || [])[1];
  H.check('Kontrast: Nebentext auf getönten Kacheln und Feldern mindestens 4,5:1, Tag und Nacht', !!tintDay && ['uv', 'wind', 'rain', 'lilac'].every(k => crA(tintDay, tok(dayB, k)) >= 4.5) && !!tintNight && ['uv', 'wind', 'rain', 'lilac'].every(k => crA(tintNight, tok(nightB, k)) >= 4.5), [tintDay, tintNight].join(' ') + ' ' + ['uv', 'wind', 'rain', 'lilac'].map(k => crA(tintDay, tok(dayB, k)).toFixed(1) + '/' + crA(tintNight, tok(nightB, k)).toFixed(1)).join(' '));
  H.check('Kontrast: gedämpftes Grau auf dunklen Feldern mindestens 4,5:1, Tag und Nacht', crA(tok(nightB, 'dark-muted'), tok(nightB, 'dark')) >= 4.5 && crA(tok(dayB, 'dark-muted'), tok(dayB, 'dark')) >= 4.5, crA(tok(nightB, 'dark-muted'), tok(nightB, 'dark')).toFixed(1));
  const warnCol = (cssA.match(/\.wc-warning \{ color: (#[0-9A-Fa-f]{6}); \}/) || [])[1];
  H.check('Kontrast: windig-Grün, Warnwort und Grau auf hellen Flächen mindestens 4,5:1', crA(tok(dayB, 'windy-ink'), tok(dayB, 'wfill')) >= 4.5 && crA(tok(dayB, 'windy-ink'), tok(dayB, 'soft')) >= 4.5 && crA(warnCol, tok(dayB, 'card')) >= 4.5 && crA(tok(dayB, 'ink-2'), tok(dayB, 'card')) >= 4.5 && crA(tok(dayB, 'ink-2'), tok(dayB, 'soft')) >= 4.5 && crA(tok(nightB, 'ink-2'), tok(nightB, 'card')) >= 4.5 && crA(tok(nightB, 'windy-ink'), tok(nightB, 'wfill')) >= 4.5, [tok(dayB, 'windy-ink'), warnCol].join(' ') + ' ' + crA(tok(dayB, 'windy-ink'), tok(dayB, 'wfill')).toFixed(1));
  // Stufe 5: Live-Region
  H.check('Rückmeldungen: Live-Region in index.html', idxA.includes('<div class="vh" id="live" aria-live="polite" aria-atomic="true"></div>'));
  H.check('Rückmeldungen: Zeitreise und Rückkehr werden angesagt', (sb.selectHour(42), G(sb,'live').textContent === 'Vorschau Morgen, 18 Uhr.') && (sb.clearHour(), G(sb,'live').textContent === 'Zurück zum aktuellen Wetter.'), G(sb,'live').textContent);

  // Einstellungen: Blatt, Einheiten, Start, Bewegung, Rausgehen-Toleranzen
  H.check('Einstellungen: Knopf und Blatt in index.html, Ortsknopf lässt drei Knöpfen Platz', idxA.includes('id="settingsBtn"') && idxA.includes('id="settings" role="dialog"') && idxA.includes('id="settingsBody"') && cssA.includes('max-width: calc(100% - 170px)'));
  sb.openSettings();
  const setHtml = G(sb,'settingsBody').innerHTML;
  H.check('Einstellungen: Blatt offen mit Einheiten, Start, Bewegung, Rausgehen und Vorgaben', sb.document.body.classList.contains('settings-open') && ['Einheiten', 'Beim Start', 'Bewegung', 'Rausgehen'].every(t => setHtml.includes('<h3>' + t + '</h3>')) && setHtml.includes('data-key="temp" data-val="C" aria-pressed="true"') && setHtml.includes('data-key="wind" data-val="kmh" aria-pressed="true"') && setHtml.includes('data-key="startView" data-val="last" aria-pressed="true"') && setHtml.includes('data-key="rainTol" data-val="0" aria-pressed="true"'), setHtml.slice(0, 240));
  sb.setSetting('temp', 'F');
  const heroF = G(sb,'hero').innerHTML, hhF = G(sb,'hourly').innerHTML, ddF = G(sb,'days').innerHTML;
  H.check('Einstellungen: Fahrenheit im Hero, in Chips, Stundenspalten, Tagesliste und Highlights', heroF.includes('>63°</div>') && heroF.includes('>Hoch 64°<') && heroF.includes('>Tief 46°<') && heroF.includes('>Gefühlt 61°<') && /aria-label="Jetzt: [^,"]+, 63 Grad, gefühlt 61,/.test(hhF) && hhF.includes('<span class="v">64°</span>') && ddF.includes('<div class="lo">46°</div>') && ddF.includes('<div class="hi">64°</div>') && G(sb,'highlights').innerHTML.includes('9° wärmer, 73° statt 64°'), heroF.slice(heroF.indexOf('class="chips'), heroF.indexOf('class="chips') + 260) + ' | ' + G(sb,'highlights').innerHTML.slice(0, 120));
  H.check('Einstellungen: Fahrenheit auch im Satz zur Wärme und im Herkunftsblatt', /Höchstens 68° morgen um 11 Uhr, gefühlt 66°, nachts bis 39°\./.test(sb.answerWarm(fc)) && sb.sourceSheetHtml(sb.prepareData(fc, data.ens), null, null, null, null, false, H.TEST_NOW).includes('Spaziergang: gefühlt 41 bis 82°, Regenrisiko unter 30 %, Böen unter 45 km/h'), sb.answerWarm(fc));
  sb.setSetting('temp', 'C');
  sb.setSetting('wind', 'ms');
  const detW = G(sb,'details').innerHTML;
  H.check('Einstellungen: Wind in m/s in der Kachel, im Feld und im Satz je Stunde', detW.includes('3<small>m/s</small>') && detW.includes('Böen 7 m/s') && /Wind \d+ m\/s" tabindex="0" class="hcol now"/.test(G(sb,'hourly').innerHTML) && G(sb,'daysHint').textContent === 'Tief · Hoch', detW.slice(detW.indexOf('class="tile wind"'), detW.indexOf('class="tile wind"') + 400));
  sb.setSetting('wind', 'bft');
  H.check('Einstellungen: Beaufort rechnet Stufen', sb.wnd(12) === '3' && sb.wnd(0) === '0' && sb.wnd(120) === '12' && sb.wunit() === 'Bft' && G(sb,'details').innerHTML.includes('3<small>Bft</small>'));
  sb.setSetting('wind', 'kmh');
  H.check('Einstellungen: zurück auf °C und km/h, Markup wie vorher, Wahl gespeichert', G(sb,'hero').innerHTML.includes('>Hoch 18°<') && G(sb,'details').innerHTML.includes('12<small>km/h</small>') && sb._store['wetter:settings'].includes('"temp":"C"') && sb._store['wetter:settings'].includes('"wind":"kmh"'), sb._store['wetter:settings']);
  sb.document.documentElement = H.el();   /* Wurzelelement nur für diesen Check, die Nacht-Checks erwarten keins */
  sb.setSetting('motion', 'reduce');
  H.check('Einstellungen: Bewegung reduziert setzt die Klasse am Wurzelelement', sb.document.documentElement.classList.contains('reduce'));
  sb.setSetting('motion', 'system');
  const reduceOff = !sb.document.documentElement.classList.contains('reduce');
  delete sb.document.documentElement;
  H.check('Einstellungen: Rausgehen-Toleranzen verschieben die Schwellen', (sb.setSetting('rainTol', 10), sb.setSetting('feelAdj', 2), sb.actLimits({ feel: [5, 28], prob: 30, gust: 45 }).prob === 40 && sb.actLimits({ feel: [5, 28], prob: 30, gust: 45 }).feelMin === 7) && reduceOff, JSON.stringify(sb.actLimits({ feel: [5, 28], prob: 30, gust: 45 })));
  sb.setSetting('rainTol', 0); sb.setSetting('feelAdj', 0);
  G(sb,'settingsBody').trigger('click', { target: { closest: s => s === '.set-chip' ? { getAttribute: n => n === 'data-key' ? 'temp' : 'F' } : null } });
  H.check('Einstellungen: Chip-Klick setzt den Wert und sagt es an', sb.settingsValue('temp') === 'F' && G(sb,'live').textContent === 'Einheiten geändert.', sb.settingsValue('temp'));
  sb.setSetting('temp', 'C');
  sb.closeSettings();
  H.check('Einstellungen: Schließen', !sb.document.body.classList.contains('settings-open'));

  const wn = G(sb,'warnings').innerHTML;
  const dwdUrl = sb._fetchLog.find(u => u.includes('maps.dwd.de')) || '';
  H.check('Warnungen: DWD-WFS mit Punkt in Breite/Länge-Reihenfolge abgefragt', decodeURIComponent(dwdUrl).replace(/\+/g, ' ').includes('INTERSECTS(THE_GEOM,POINT(48.137 11.575))') && dwdUrl.includes('typeName=dwd%3AWarnungen_Gemeinden'), decodeURIComponent(dwdUrl));
  H.check('Warnungen: Feld sichtbar, 3 Einträge (2 DWD aktiv + 1 NINA; DWD-Doppelung aus NINA weg)', !G(sb,'warnings').classList.contains('hidden') && (wn.match(/<details class="field warn/g) || []).length === 3 && !wn.includes('FROST'), wn.slice(0, 200));
  H.check('Warnungen: Felder blenden gestaffelt ein, Dreieck wackelt, Megafon sendet Wellen', (wn.match(/ a-up" style="animation-delay:/g) || []).length === 3 && wn.includes('<svg class="wobble"') && wn.includes('<svg class="wave"') && wn.includes('class="w1"'), wn.slice(0, 120));
  H.check('Warnungen: Stufe 2 zuerst, dabei NINA vor DWD', /^<details class="field warn lvl-2 nina a-up"/.test(wn) && wn.indexOf('lvl-2 nina') < wn.indexOf('lvl-2 a-up"') && wn.indexOf('lvl-2 a-up"') < wn.indexOf('lvl-1'), wn.slice(0, 60));
  H.check('NINA: Katastrophenschutz-Zeile, Umbrüche, Quelle', wn.includes('Katastrophenschutz · seit') && wn.includes('Rauchentwicklung.<br>Betroffen') && wn.includes('class="instr">Fenster und Türen schließen.<br>Lüftung') && wn.includes('über NINA (warnung.bund.de) · Stadt München'), wn.match(/Katastrophenschutz[^<]*/));
  const ninaUrl = sb._fetchLog.find(u => u.includes('/nina?')) || '';
  H.check('NINA: Proxy mit Koordinaten abgefragt', ninaUrl.endsWith('/nina?lat=48.137&lon=11.575'), ninaUrl);
  // Mock-Zeiten relativ zu TEST_NOW (14:15): Windböen ab +2 h bis +8 h, Gewitter seit −1 h bis +3 h, alles am selben Tag, also nur Uhrzeiten
  H.check('Warnungen: Zeiten aus der Testzeit, bevorstehende "ab 16:15 Uhr bis 22:15 Uhr", laufende "bis 17:15 Uhr", Hinweis + Quelle', wn.includes('Wetterwarnung · ab 16:15 Uhr bis 22:15 Uhr') && wn.includes('Markante Wetterwarnung · bis 17:15 Uhr') && wn.includes('class="instr">Lose Gegenstände sichern.') && wn.includes('Quelle: Deutscher Wetterdienst · Stadt München'), wn.match(/Wetterwarnung · [^<]*/));
  // Zeiten der Warnungen relativ zur Testzeit (14:15 Ortszeit, Freitag): heute nur Uhrzeit, in der Woche Wochentag, sonst Datum
  const hMs = 3600 * 1000, isoAt = t => new Date(t).toISOString();
  H.check('Warnungen: Zeitangabe rechnet mit der Testzeit (heute, Wochentag, Datum)', sb.fmtWarnTime(isoAt(H.TEST_NOW + 2 * hMs)) === '16:15 Uhr' && sb.fmtWarnTime(isoAt(H.TEST_NOW + 26 * hMs)) === 'Sa 16:15 Uhr' && sb.fmtWarnTime(isoAt(H.TEST_NOW + 10 * 24 * hMs)) === '05.10., 14:15 Uhr' && sb.fmtWarnTime('kaputt') === '–', [sb.fmtWarnTime(isoAt(H.TEST_NOW + 2 * hMs)), sb.fmtWarnTime(isoAt(H.TEST_NOW + 26 * hMs)), sb.fmtWarnTime(isoAt(H.TEST_NOW + 10 * 24 * hMs))].join(' | '));
  // NINA-Meldungen mit abgelaufenem expires fallen weg (zweite Sicherung neben dem Worker), „bis …“ kommt aus expires
  const ninaOf = (id, expires) => ({ id: id, source: 'nina', provider: 'MOWAS', providerLabel: 'Katastrophenschutz', level: 2, severity: 'Moderate', event: 'Gefahreninformation', headline: 'Meldung ' + id, description: '', instruction: '', sent: isoAt(H.TEST_NOW - hMs), onset: null, expires: expires, area: 'Stadt München', upcoming: false });
  sb.renderWarnings([], [ninaOf('alt', isoAt(H.TEST_NOW - hMs)), ninaOf('offen', null), ninaOf('frisch', isoAt(H.TEST_NOW + 3 * hMs))]);
  const wnN = G(sb,'warnings').innerHTML;
  H.check('NINA: abgelaufene Meldung wird nicht mehr gezeigt, offene und laufende bleiben mit „bis“ aus expires', !wnN.includes('Meldung alt') && wnN.includes('Meldung offen') && wnN.includes('Meldung frisch') && wnN.includes('Katastrophenschutz · seit 13:15 Uhr · bis 17:15 Uhr') && (wnN.match(/<details class="field warn/g) || []).length === 2, wnN.match(/Katastrophenschutz[^<]*/g));
  sb.renderWarnings([], [ninaOf('alt', isoAt(H.TEST_NOW - hMs))]);
  H.check('NINA: nur abgelaufene Meldungen → Feld versteckt und leer', G(sb,'warnings').classList.contains('hidden') && G(sb,'warnings').innerHTML === '');
  sb.renderWarnings(sb.normalizeWarnings(data.warn), sb.normalizeNina(data.nina));

  const hh = G(sb,'hourly').innerHTML;
  H.check('Stunden: 48 Spalten', (hh.match(/class="hcol/g) || []).length === 48, (hh.match(/class="hcol/g) || []).length);
  H.check('Stunden: 48 Temperaturen', (hh.match(/class="v">-?\d+°</g) || []).length === 48, (hh.match(/class="v">-?\d+°</g) || []).length);
  H.check('Stunden: Regenstunden mit Füllstand (--p = Wahrscheinlichkeit), trockene ohne', /class="hcol[^"]* wet" style="[^"]*"><i class="fill" data-stagger="[\d.]+s" style="--p:\d+%;animation-delay:[\d.]+s"><\/i>/.test(hh) && !/class="hcol( newday)?" style="[^"]*"><i class="fill"/.test(hh), hh.match(/<i class="fill"[^>]*>/));
  H.check('Stunden: "Jetzt" dunkel, Regenstunden blau', hh.startsWith('<div class="strip"><div class="strip-inner"><button type="button" aria-label="Jetzt: ') && /class="hcol[^"]* wet"/.test(hh), hh.slice(0, 80));
  H.check('Stunden: "Jetzt" und Tageswechsel', hh.includes('>Jetzt<') && hh.includes('hcol newday'));
  H.check('Stunden: Ensemble-Wahrscheinlichkeiten', /class="p">\d+%/.test(hh));
  H.check('Stunden: Wahrscheinlichkeit in allen 48 Spalten (auch unter 10 %)', (hh.match(/class="p">\d+%/g) || []).length === 48, (hh.match(/class="p">\d+%/g) || []).length);
  H.check('Stunden: alle Spalten außer "Jetzt" tragen data-i (globaler Stundenindex 15..61)', (hh.match(/ tabindex="-1" data-i="\d+" class="hcol/g) || []).length === 47 && hh.includes('data-i="15" class="hcol') && hh.includes('data-i="61" class="hcol') && !/data-i="\d+" class="hcol now/.test(hh), (hh.match(/ tabindex="-1" data-i="\d+" class="hcol/g) || []).length);
  H.check('Stundenfakten: Index 42 = Morgen, 18 Uhr, Regen 71 %, Code 61', (() => { const f = sb.hourFacts(sb.lastRendered(), 42); return f && f.label === 'Morgen, 18 Uhr' && f.prob === 71 && f.code === 61 && Math.round(f.temp) === 10 && Math.round(f.wind) === 18 && f.desc === sb.wmo(61)[1]; })(), JSON.stringify(sb.hourFacts(sb.lastRendered(), 42)));
  H.check('Stundenfakten: Index 20 = Heute, 20 Uhr (Nacht), ungültige Indizes = null', (() => { const f = sb.hourFacts(sb.lastRendered(), 20); return f && f.label === 'Heute, 20 Uhr' && f.isDay === 0 && sb.hourFacts(sb.lastRendered(), -1) === null && sb.hourFacts(sb.lastRendered(), 99999) === null; })(), JSON.stringify(sb.hourFacts(sb.lastRendered(), 20)));

  const ncBars = [...G(sb,'nowcast').innerHTML.matchAll(/<i class="[^"]*" data-stagger="([\d.]+)s" style="height:\d+%;animation-delay:([\d.]+)s"/g)];
  H.check('Nowcast: 16 Balken mit aufsteigender Staffelung (Aufbau-Animation)', ncBars.length === 16 && ncBars.every((m, i) => i === 0 || (+m[2] > +ncBars[i-1][2] && +m[1] > +ncBars[i-1][1])), ncBars.length + ' ' + ncBars.slice(0,3).map(m => m[2]).join(','));
  H.check('Nowcast-Karte sichtbar (Regen in 4 h)', !G(sb,'nowcastCard').classList.contains('hidden') && (G(sb,'nowcast').innerHTML.match(/<i /g) || []).length === 16, G(sb,'nowcast').innerHTML.slice(0, 120));

  const dd = G(sb,'days').innerHTML;
  H.check('Tage: 14 Zeilen', (dd.match(/class="drow/g) || []).length === 14, (dd.match(/class="drow/g) || []).length);
  H.check('Tage: weitere 7 in aufklappbarem Container, ohne eigene Einblend-Verzögerung', /<div class="more-wrap"><div class="more-inner">(<div class="drow[^"]* more" data-day="\d+"[^>]*>[\s\S]*?){7}<\/div><\/div><button/.test(dd), dd.indexOf('more-wrap'));
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

  // Tag/Nacht-Schalter: Handwahl bis zum nächsten Sonnenwechsel
  H.check('Schalter: tagsüber Sonnensymbol, nicht gedrückt', G(sb,'modeBtn').innerHTML.includes('<circle cx="12" cy="12" r="4"/>') && G(sb,'modeBtn')['aria-pressed'] === 'false' && G(sb,'modeBtn')['aria-label'] === 'Nachtmodus', G(sb,'modeBtn')['aria-pressed']);
  G(sb,'modeBtn').trigger('click');
  H.check('Schalter: Tipp am Tag schaltet Nacht, Kacheln folgen, Wahl gespeichert', sb.document.body.classList.contains('night') && G(sb,'details').innerHTML.includes('>UV morgen<') && JSON.parse(sb._store['wetter:nightmode']).force === 'night' && JSON.parse(sb._store['wetter:nightmode']).auto === false && G(sb,'modeBtn')['aria-pressed'] === 'true' && G(sb,'modeBtn').innerHTML.includes('M20 14.5'), sb._store['wetter:nightmode']);
  sb.updateNight('2026-09-25T15:00');
  H.check('Schalter: Handwahl bleibt, solange der Sonnenstand gleich bleibt', sb.document.body.classList.contains('night') && sb._store['wetter:nightmode'] !== undefined);
  sb.updateNight('2026-09-25T21:00');
  H.check('Schalter: beim automatischen Wechsel verfällt die Handwahl (Nacht bleibt, Speicher leer)', sb.document.body.classList.contains('night') && sb._store['wetter:nightmode'] === undefined, sb._store['wetter:nightmode']);
  G(sb,'modeBtn').trigger('click');
  H.check('Schalter: Tipp in der Nacht schaltet Tag', !sb.document.body.classList.contains('night') && G(sb,'details').innerHTML.includes('UV-Index') && JSON.parse(sb._store['wetter:nightmode']).force === 'day' && G(sb,'modeBtn')['aria-pressed'] === 'false', sb._store['wetter:nightmode']);
  sb.updateNight('2026-09-26T10:00');
  H.check('Schalter: am Morgen verfällt die Tagwahl, Automatik übernimmt', !sb.document.body.classList.contains('night') && sb._store['wetter:nightmode'] === undefined);
  sb.updateNight('2026-09-25T14:15');

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
  H.check('Rückmeldungen: erfolgreiches Laden wird angesagt', /^Wetter für .+ aktualisiert\.$/.test(G(sb3,'live').textContent), G(sb3,'live').textContent);
  H.check('Theme klare Nacht + Mond-Icon', sb3.document.body.classList.contains('theme-clear-night') && G(sb3,'hero').innerHTML.includes('<svg class="big-icon wx wx-nacht"'), G(sb3,'hero').innerHTML.slice(0, 200));
  H.check('Hero-Icon nach Lage: Tag mit Wolken = Sonne hinter Wolke', hero.includes('wx wx-teils"') && hero.includes('class="cloud"') && hero.includes('class="sun"'));
  H.check('Regen-Icon mit Tropfen-Ebene', G(sb2,'hero').innerHTML.includes('wx wx-regen"') && G(sb2,'hero').innerHTML.includes('class="drops"'));
  // Nebel (Code 45/48) ist eine eigene Lage mit Nebellinien unter der Wolke; die Linien gibt es nur in dieser Lage
  const fogHero = sb.heroIcon(45, 1);
  H.check('Hero-Icon nach Lage: Nebel ist „nebel“ mit drei Nebellinien, bedeckt bleibt „bewoelkt“ ohne Linien', sb.heroKind(45, 1) === 'nebel' && sb.heroKind(48, 0) === 'nebel' && sb.heroKind(3, 1) === 'bewoelkt' && fogHero.includes('class="big-icon wx wx-nebel"') && /<g class="fog">(<line [^>]*\/>){3}<\/g>/.test(fogHero) && fogHero.indexOf('class="cloud"') < fogHero.indexOf('class="fog"') && !sb.heroIcon(3, 1).includes('class="fog"') && sb.themeFor(45, 1) === 'fog', fogHero.slice(fogHero.indexOf('class="fog"') - 20, fogHero.indexOf('class="fog"') + 140));
  H.check('Sonnenbogen: Sonne wandert mit (Winkel 107° für 14:15 bei 07:12–19:05) und startet im Morgenrot', /class="arc"[^>]*--ang:107deg[^>]*--c0:rgb\(232,121,74\)[^>]*--c4:rgb\(246,211,91\)/.test(det) && det.includes('<g class="sunpos"><circle class="dot" cx="8" cy="54"'), det.match(/class="arc"[^>]*/));
  // Die Maske trägt je Aufruf eine eigene ID, damit sich mehrere Tropfen (Vorschau, zweite Seite) nicht stören
  H.check('Luftfeuchte: Füllung liegt in einer beschnittenen Gruppe (Wasser bleibt im Tropfen), Maske mit eindeutiger ID', /<clipPath id="(dropclip\d+)"><path [^>]*\/><\/clipPath><g clip-path="url\(#\1\)"><rect x="0" y="9\.5"/.test(det), det.match(/<g clip-path[^>]*><rect[^>]*>/));
  H.check('Luftfeuchte: zwei Tropfen bekommen zwei verschiedene Masken-IDs', (() => { const a = sb.dropIcon(50).match(/id="(dropclip\d+)"/), b = sb.dropIcon(50).match(/id="(dropclip\d+)"/); return a && b && a[1] !== b[1] && sb.dropIcon(50).includes('url(#dropclip'); })());
  H.check('Kacheln: Mini-Icons und Skalen (Wind, Regen, Sonnenbogen, Tropfen, Druck, UV-Meter)',
    det.includes('class="windflow"') && det.includes('class="rain-ico"') && det.includes('class="arc"') && det.includes('class="drop-ico"') && det.includes('class="gauge-ico"') && /class="tile uv"[\s\S]*?class="meter"/.test(det));
  H.check('Einblend-Verzögerungen gestaffelt und gestaucht (Stunden 0,54 s, Tage 0,84 s, Kacheln 0,60 s)', /hcol now[^>]*animation-delay:0\.[45]\ds/.test(hh) && /drow[^>]*animation-delay:0\.[78]\ds/.test(dd) && /tile uv"[^>]*animation-delay:(0\.60|0\.5\d)s/.test(det));

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
  // Randwerte des Fensters: die aktuelle Stunde (Index 14 = w.start, Startstunde eines Rausgehen-Fensters) überlebt das Neurendern wie jede andere
  sb.selectHour(14);
  sb.renderAllDesign(payloadSame);
  H.check('Zeitreise: gewählte Stunde am Fensteranfang (Jetzt-Stunde) bleibt nach dem Neurendern erhalten', G(sb,'hero').innerHTML.includes('<span>Heute, 14 Uhr</span>') && G(sb,'hero').innerHTML.includes('heroNow'), G(sb,'hero').innerHTML.slice(0, 120));
  sb.clearHour();
  sb.renderAllDesign(payloadSame);

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

  // 3g) „Mein Standort“ scheitert ohne gespeicherte Position: der gesuchte Ort bleibt samt Daten stehen, Banner mit „Ort suchen“
  const sb11 = boot({ fetchImpl: H.okFetch(data), geolocation: denied, storage: { 'wetter:active': JSON.stringify({ lat: 53.55, lon: 9.99, name: 'Hamburg', source: 'search' }) } });
  await wait(300);
  G(sb11,'gps').trigger('click'); await wait(300);
  const fc11 = () => sb11._fetchLog.filter(u => u.includes('api.open-meteo.com/v1/forecast') && !u.includes('models=')).length;
  const n11 = fc11();
  H.check('Ort: gescheiterte Ortung ohne gespeicherte Position behält den vorherigen Ort, Daten stehen, Banner zeigt den Fehler', G(sb11,'locName').textContent.includes('Hamburg') && G(sb11,'hero').innerHTML.includes('17°') && G(sb11,'banner').className.includes('err') && G(sb11,'banner').innerHTML.includes('Standortzugriff abgelehnt') && G(sb11,'banner').innerHTML.includes('bannerBtn') && JSON.parse(sb11._store['wetter:active']).source === 'search', G(sb11,'locName').textContent + ' | ' + G(sb11,'banner').innerHTML.slice(0, 80));
  G(sb11,'refresh').trigger('click'); await wait(300);
  const lastFc11 = sb11._fetchLog.filter(u => u.includes('api.open-meteo.com/v1/forecast') && !u.includes('models=')).pop() || '';
  H.check('Ort: Aktualisieren lädt danach wieder den vorherigen Ort statt erneut zu orten', fc11() === n11 + 1 && lastFc11.includes('latitude=53.55'), (fc11() - n11) + ' ' + lastFc11.match(/latitude=[\d.]+/));

  // 3h) Sichtbarwerden: ein Listener für Aktualität, Nacht und Daten; bei GPS-Ort nur neu orten, wenn die Ortung älter als 10 Minuten ist
  const docEv = {};
  let gpsCalls2 = 0;
  const counting2 = { getCurrentPosition: ok => { gpsCalls2++; ok({ coords: { latitude: 48.137, longitude: 11.575 } }); } };
  const sbVis = boot({ fetchImpl: H.okFetch(data), geolocation: counting2, docEvents: docEv });
  await wait(300);
  const fcVis = () => sbVis._fetchLog.filter(u => u.includes('api.open-meteo.com/v1/forecast') && !u.includes('models=')).length;
  const nVis = fcVis();
  H.check('Sichtbarwerden: genau ein visibilitychange-Listener', Array.isArray(docEv.visibilitychange) && docEv.visibilitychange.length === 1 && typeof docEv.visibilitychange[0] === 'function', Object.keys(docEv).map(k => k + ':' + docEv[k].length).join(','));
  docEv.visibilitychange[0](); await wait(300);
  H.check('Sichtbarwerden: junge Ortung (unter 10 Minuten) wird nicht wiederholt, die Daten werden neu geladen', gpsCalls2 === 1 && fcVis() === nVis + 1, gpsCalls2 + ' ' + (fcVis() - nVis));
  sbVis.TEST_NOW = H.TEST_NOW + 11 * 60000;
  docEv.visibilitychange[0](); await wait(300);
  H.check('Sichtbarwerden: Ortung älter als 10 Minuten wird wiederholt', gpsCalls2 === 2 && fcVis() === nVis + 2, gpsCalls2 + ' ' + (fcVis() - nVis));
  sbVis.TEST_NOW = H.TEST_NOW;

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
  // Stand-Zeile der Fußzeile: dieselbe Basis wie die Aktualitätszeile, Ortszeit mit Zusatz bei fremder Zone
  H.check('Stand-Zeile: Ortszeit des Ortes, Zusatz „Ortszeit“ nur bei fremder Zone, leer ohne Zeitpunkt', sbT.updatedText('2026-10-08T08:10:00Z', 'Europe/Berlin') === 'Stand 08.10., 10:10 Uhr' && sbT.updatedText('2026-10-08T08:10:00Z', 'America/New_York') === 'Stand 08.10., 04:10 Uhr Ortszeit' && sbT.updatedText('2026-10-08T08:10:00Z', 'Nirgendwo/Stadt') === 'Stand 08.10., 10:10 Uhr' && sbT.updatedText('kaputt', 'Europe/Berlin') === '', sbT.updatedText('2026-10-08T08:10:00Z', 'America/New_York'));
  H.check('Stand-Zeile: nach dem Laden mit der Testzeit in Ortszeit', G(sb,'updated').textContent === 'Stand 25.09., 14:15 Uhr', G(sb,'updated').textContent);
  // Im Ablauf: nach dem Laden „Gerade eben“, Cache-Start zeigt den gespeicherten Stand, fehlgeschlagene Aktualisierung behält Daten + Stand
  H.check('Aktualität: nach erfolgreichem Laden „Gerade eben aktualisiert“', G(sb,'freshTxt').textContent === 'Gerade eben aktualisiert', G(sb,'freshTxt').textContent);
  H.check('Aktualität: Offline-Start aus dem Cache zeigt den gespeicherten Stand, nicht die Startzeit', G(sb5,'freshTxt').textContent.startsWith('Stand ') && G(sb5,'freshTxt').textContent.endsWith('· gespeicherte Daten') && G(sb5,'updated').textContent.includes('08.10.'), G(sb5,'freshTxt').textContent + ' | ' + G(sb5,'updated').textContent);
  let online = true;
  const flaky = async (url) => { if (!online) throw new Error('Failed to fetch'); return H.okFetch(data)(url); };
  const sbF = boot({ fetchImpl: flaky, geolocation: granted });
  await wait(300);
  const updatedBefore = G(sbF,'updated').textContent;
  // updateFreshness rechnet mit nowMs(), also mit TEST_NOW: der gespeicherte Stand liegt zehn Minuten davor
  const cachedIso = new Date(H.TEST_NOW - 10 * 60000).toISOString();
  const cachedText = () => sbT.freshnessText(cachedIso, true, H.TEST_NOW, 'Europe/Berlin');
  sbF._store[LOC_KEY] = JSON.stringify({ savedAt: cachedIso, payload: { fc, ens: data.ens, md: data.md, air: data.air } });
  online = false;
  G(sbF,'refresh').trigger('click'); await wait(300);
  H.check('Rückmeldungen: fehlgeschlagene Aktualisierung wird angesagt', G(sbF,'live').textContent.startsWith('Keine Verbindung'), G(sbF,'live').textContent);
  H.check('Aktualität: fehlgeschlagene Aktualisierung behält Daten und markiert den gespeicherten Stand', G(sbF,'hero').innerHTML.includes('17°') && G(sbF,'freshTxt').textContent === cachedText() && cachedText() === 'Stand heute, 14:05 Uhr · gespeicherte Daten' && G(sbF,'updated').textContent === 'Stand 25.09., 14:05 Uhr' && G(sbF,'banner').innerHTML.includes('zuletzt gespeicherten'), G(sbF,'freshTxt').textContent + ' | ' + G(sbF,'updated').textContent + ' | ' + G(sbF,'hero').innerHTML.slice(0, 60));
  delete sbF._store[LOC_KEY];
  G(sbF,'refresh').trigger('click'); await wait(300);
  H.check('Aktualität: Fehler ohne Cache lässt die zuletzt gültigen Daten und ihren Stand stehen, Fehlerbanner mit Wiederholen', G(sbF,'hero').innerHTML.includes('17°') && G(sbF,'freshTxt').textContent === cachedText() && G(sbF,'banner').className.includes('err') && G(sbF,'banner').innerHTML.includes('bannerBtn'), G(sbF,'freshTxt').textContent + ' | ' + G(sbF,'banner').innerHTML);
  online = true;
  G(sbF,'refresh').trigger('click'); await wait(300);
  H.check('Aktualität: erfolgreiche Aktualisierung setzt wieder „Gerade eben“', G(sbF,'freshTxt').textContent === 'Gerade eben aktualisiert' && G(sbF,'banner').classList.contains('hidden'), G(sbF,'freshTxt').textContent);
  // Ortswechsel auf einen Ort ohne Daten und ohne Cache: nichts Altes bleibt stehen
  online = false;
  G(sbF,'locBtn').trigger('click'); await wait(350);
  sbF._store['wetter:recent'] = JSON.stringify([hamburgDE]);
  G(sbF,'q').value = ''; G(sbF,'q').trigger('input'); await wait(50);
  G(sbF,'res')._buttons[0].trigger('click'); await wait(300);
  H.check('Aktualität: Ortswechsel ohne Daten leert die Anzeige samt Stand', G(sbF,'freshTxt').textContent === '' && G(sbF,'hero').innerHTML.includes('Keine Daten') && G(sbF,'locName').textContent.includes('Hamburg'), G(sbF,'freshTxt').textContent + ' | ' + G(sbF,'locName').textContent);
  H.check('Aktualität: Zeile wird nur bei Änderung neu gesetzt (kein Flackern)', (() => { const n = G(sbF,'freshTxt'); let sets = 0; const orig = Object.getOwnPropertyDescriptor(n, 'textContent'); let v = n.textContent; Object.defineProperty(n, 'textContent', { get: () => v, set: (x) => { sets++; v = x; }, configurable: true }); sbF.updateFreshness(); sbF.updateFreshness(); if (orig) Object.defineProperty(n, 'textContent', orig); else { delete n.textContent; n.textContent = v; } return sets === 0; })());

  // Texte: Schwelle der blauen Felder, gefühlte Temperatur und Windworte in den Fenstern
  const dsrc = fs.readFileSync(require('path').join(__dirname, '..', 'design.js'), 'utf8');
  const thr = (dsrc.match(/const wet = i !== 0 && prob >= (\d+)/) || [])[1];
  H.check('Texte: Beschriftung der blauen Felder nennt dieselbe Schwelle wie die Berechnung', thr === '25' && fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').includes('Blaue Felder: Regenrisiko ab ' + thr + ' %'), thr);
  H.check('Texte: kein „windstill“ und kein „Regen wahrscheinlich“ mehr', !dsrc.includes('windstill') && !fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').includes('Regen wahrscheinlich'));
  // Tote Pfade: unbenutzte UI-Icons, die Variable worst und die leere Überschrift sind weg; scrubActive bleibt als Testzugang
  const uiKeys = (dsrc.slice(dsrc.indexOf('const UI = {'), dsrc.indexOf('};', dsrc.indexOf('const UI = {'))).match(/^\s{4}(\w+): '<svg/gm) || []).map(l => l.trim().replace(/:.*$/, ''));
  H.check('Tote Pfade: UI hält nur die sieben benutzten Icons, worst und „Hintergrund-Partikel“ sind entfernt', uiKeys.sort().join(',') === 'alert,check,chevron,drop,megaphone,umbrella,umbrellaRain' && uiKeys.every(k => (dsrc.match(new RegExp('UI\\.' + k + '\\b', 'g')) || []).length >= 1) && !/\bworst\b/.test(dsrc) && !dsrc.includes('Hintergrund-Partikel') && /function scrubActive\(\)/.test(dsrc), uiKeys.join(','));
  // Zeitbasis: „jetzt“ läuft überall über nowMs(); Date.now() bleibt nur für Laufzeitmessungen von Bewegung und Film
  H.check('Zeitbasis: kein new Date() ohne Argument mehr, Date.now() nur in nowMs selbst, Bewegung, Zählern, Ziehen und Filmablauf', !/new Date\(\)/.test(dsrc) && (dsrc.match(/Date\.now\(\)/g) || []).length === 12 && /function nowMs\(\)[^\n]*Date\.now\(\)/.test(dsrc), (dsrc.match(/Date\.now\(\)/g) || []).length);

  // 7) Nachtpalette und Tageszeit-Kacheln
  const nightAt = iso => sb.nightNowAt(fc, iso);
  H.check('Nacht: Fenster aus den Lichtzeiten (14:15 hell, 19:30 hell, 20:00 dunkel, 06:00 dunkel, 06:45 hell)', nightAt('2026-09-25T14:15') === false && nightAt('2026-09-25T19:30') === false && nightAt('2026-09-25T20:00') === true && nightAt('2026-09-25T06:00') === true && nightAt('2026-09-25T06:45') === false, ['14:15','19:30','20:00','06:00','06:45'].map(t => nightAt('2026-09-25T' + t)).join(','));
  H.check('Nacht: Datum außerhalb der Tagesliste fällt auf die Sonnenrechnung zurück', nightAt('2027-01-01T02:00') === true && nightAt('2027-01-01T13:00') === false);
  H.check('Nacht: Sonnenrechnung, Polartag hell, Polarnacht dunkel', sb.nightByClock(48.137, 11.575, '2026-09-25', 7200, 20 * 60) === true && sb.nightByClock(48.137, 11.575, '2026-09-25', 7200, 14 * 60) === false && sb.nightByClock(78, 15, '2026-06-21', 7200, 60) === false && sb.nightByClock(78, 15, '2026-12-21', 3600, 12 * 60) === true, [sb.nightByClock(48.137, 11.575, '2026-09-25', 7200, 20 * 60), sb.nightByClock(78, 15, '2026-06-21', 7200, 60), sb.nightByClock(78, 15, '2026-12-21', 3600, 12 * 60)].join(','));
  const full = sb.moonPhase(new Date('2026-09-26T16:49:00Z')), neu = sb.moonPhase(new Date('2026-10-10T15:50:00Z')), q = sb.moonPhase(new Date('2026-10-18T12:00:00Z'));
  H.check('Mond: Vollmond 26.9.2026, Neumond 10.10.2026, erstes Viertel 18.10.2026', full.illum > 0.98 && full.name === 'Vollmond' && neu.illum < 0.02 && neu.name === 'Neumond' && q.name === 'Erstes Viertel' && Math.abs(q.illum - 0.5) < 0.1, [full, neu, q].map(m => m.name + ' ' + m.illum.toFixed(2)).join(' | '));
  H.check('Mond: Symbol mit Phase und Beleuchtung als Beschriftung', sb.moonIcon(full).includes('class="moon-ico"') && sb.moonIcon(full).includes('Vollmond, 100 % beleuchtet') && /Neumond, [01] % beleuchtet/.test(sb.moonIcon(neu)), sb.moonIcon(full));
  sb.clearHour(); sb.toggleTile('wind');
  const detDay = G(sb,'details').innerHTML;
  H.check('Nacht: tagsüber keine Nachtklasse, UV-Kachel wie gehabt', !sb.document.body.classList.contains('night') && detDay.includes('UV-Index') && !detDay.includes('UV morgen') && sb._store['wetter:night'] === '0', sb._store['wetter:night']);
  sb.updateNight('2026-09-25T21:00');
  const detN = G(sb,'details').innerHTML;
  H.check('Nacht: Wechsel setzt Klasse night und merkt den Zustand', sb.document.body.classList.contains('night') && sb._store['wetter:night'] === '1', sb._store['wetter:night']);
  H.check('Nacht: UV-Kachel wird zu „UV morgen“ mit Höchstwert 4,6 gegen 12 Uhr und Mondsymbol', detN.includes('>UV morgen<') && detN.includes('data-count="4.6"') && detN.includes('Höchstwert gegen 12 Uhr') && detN.includes('class="moon-ico"') && detN.includes('beleuchtet') && !detN.includes('UV-Index'), detN.slice(0, 400));
  H.check('Nacht: getauschte Kachel blendet ein, übrige stehen still', detN.includes('class="tile uv swap"') && (detN.match(/animation:none/g) || []).length >= 7 && (detN.match(/class="tile [^"]*swap"/g) || []).length === 1, (detN.match(/class="tile [^"]*"/g) || []).join(','));
  const seeded = sb.countState();
  H.check('Nacht: Zähler ohne Neustart (gesät, Modus same), offenes Feld bleibt offen', Object.keys(seeded).some(k => k.endsWith(':0') && seeded[k] === 4.6) && sb.countMode(Object.keys(seeded).find(k => k.endsWith(':0')), 4.6) === 'same' && sb.openTileKey() === 'wind', JSON.stringify(seeded) + ' ' + sb.openTileKey());
  sb.updateNight('2026-09-26T10:00');
  H.check('Nacht: Rückwechsel am Morgen, UV-Kachel blendet wieder ein', !sb.document.body.classList.contains('night') && G(sb,'details').innerHTML.includes('UV-Index') && G(sb,'details').innerHTML.includes('class="tile uv swap"') && sb._store['wetter:night'] === '0', G(sb,'details').innerHTML.slice(0, 120));
  sb.toggleTile('wind');
  // Der Minutentakt schreibt wetter:night nur, wenn sich der Zustand ändert
  const origSetItem = sb.localStorage.setItem; let nightWrites = 0;
  sb.localStorage.setItem = (k, v) => { if (k === 'wetter:night') nightWrites++; return origSetItem(k, v); };
  sb.updateNight('2026-09-25T14:15'); sb.updateNight('2026-09-25T14:16'); sb.updateNight('2026-09-25T14:17');
  const writesSame = nightWrites;
  sb.updateNight('2026-09-25T21:00'); sb.updateNight('2026-09-26T10:00');
  sb.localStorage.setItem = origSetItem;
  H.check('Nacht: unveränderter Zustand schreibt nichts in den Speicher, jeder Wechsel genau einmal', writesSame === 0 && nightWrites === 2 && sb._store['wetter:night'] === '0', writesSame + '/' + nightWrites);
  // Sicht statt Pollen
  const airNoPollen = JSON.parse(JSON.stringify(data.air));
  ['birch_pollen','grass_pollen','alder_pollen','mugwort_pollen','ragweed_pollen','olive_pollen'].forEach(k => { airNoPollen.current[k] = 0; airNoPollen.hourly[k] = airNoPollen.hourly[k].map(() => 0); });
  const sbV = boot({ fetchImpl: H.okFetch(Object.assign({}, data, { air: airNoPollen })), geolocation: granted });
  await wait(300);
  const detV = G(sbV,'details').innerHTML;
  H.check('Sicht: ohne nennenswerte Pollen zeigt der Platz die Sichtweite (24 km klar, Nebelrisiko hoch morgen gegen 5 Uhr)', (detV.match(/class="tile /g) || []).length === 8 && !detV.includes('>Pollen<') && detV.includes('>Sicht<') && detV.includes('data-count="24"') && detV.includes('<span class="word">klar</span>') && detV.includes('Nebelrisiko hoch morgen gegen 5 Uhr') && detV.includes('class="fog-ico"'), detV.match(/Sicht[\s\S]{0,300}/));
  H.check('Sicht: aufklappbares Feld mit 24 Säulen, zwei Nebelstunden grau, Satz zum Risiko', detV.includes('data-tile="sicht"') && detV.includes('id="tpanel-sicht"') && (detV.match(/<i class="(?:fog |haze )?vb"/g) || []).length === 24 && (detV.match(/<i class="fog vb"/g) || []).length === 2 && detV.includes('Nebelrisiko hoch morgen von 5 bis 7 Uhr: Sicht unter 1 km.') && detV.includes('aria-label="Sicht: Details anzeigen"'), detV.match(/tp-note">[^<]*/g));
  sbV.toggleTile('sicht');
  H.check('Sicht: Feld klappt auf wie Wind und Regen', sbV.openTileKey() === 'sicht');
  sbV.toggleTile('sicht');
  // „Pollen oder Sicht“ ausblenden trifft auch die Sicht-Kachel: sie trägt den Namen pollen, das Feld folgt, ein offenes Feld schließt
  H.check('Sicht: Kachel trägt zum Ausblenden den Namen „pollen“ (ein Platz für Pollen oder Sicht)', detV.includes('data-tile="sicht" data-name="pollen"') && !detV.includes('data-name="sicht"') && G(sb,'details').innerHTML.includes('data-name="pollen"'), detV.match(/data-tile="sicht"[^>]*/));
  const tileStub = (name, key) => { const e = H.el(); e.setAttribute('data-name', name); if (key) e.setAttribute('data-tile', key); return e; };
  const sichtT = tileStub('pollen', 'sicht'), windT = tileStub('wind', 'wind');
  const origDocQ = sbV.document.querySelectorAll;
  sbV.document.querySelectorAll = sel => sel === '.tile[data-name]' ? [sichtT, windT] : [];
  sbV.toggleTile('sicht');
  sbV.setSetting('hidden', ['pollen']);
  H.check('Sicht: Ausblenden „Pollen oder Sicht“ versteckt Kachel und Feld der Sicht und schließt das offene Feld', sichtT.classList.contains('user-hidden') && G(sbV,'tpanel-sicht').classList.contains('user-hidden') && !windT.classList.contains('user-hidden') && sbV.openTileKey() === null, [...sichtT.classList.c].join(',') + ' ' + sbV.openTileKey());
  sbV.setSetting('hidden', []);
  H.check('Sicht: wieder eingeblendet', !sichtT.classList.contains('user-hidden') && !G(sbV,'tpanel-sicht').classList.contains('user-hidden'));
  sbV.document.querySelectorAll = origDocQ;
  H.check('Sicht: mit Pollen kein Sicht-Feld', !G(sb,'details').innerHTML.includes('tpanel-sicht'));
  H.check('Nebelrisiko: Stufen aus Taupunktabstand, Wind und Bewölkung, Sicht schlägt alles', sb.fogRisk(null, 1, 5, 10) === 'hoch' && sb.fogRisk(null, 2.5, 15, 50) === 'gering' && sb.fogRisk(null, 1.5, 15, 50) === 'mittel' && sb.fogRisk(500, 10, 30, 100) === 'hoch' && sb.fogRisk(3000, 10, 30, 100) === 'mittel' && sb.fogRisk(null, 1, 25, 90) === 'gering' && sb.fogRisk(null, null, null, null) === 'gering', [sb.fogRisk(null, 1, 5, 10), sb.fogRisk(null, 2.5, 15, 50), sb.fogRisk(null, 1.5, 15, 50), sb.fogRisk(500, 10, 30, 100), sb.fogRisk(3000, 10, 30, 100), sb.fogRisk(null, 1, 25, 90)].join(','));
  H.check('Sicht: mit Pollen bleibt die Pollen-Kachel', G(sb,'details').innerHTML.includes('>Pollen<') && !G(sb,'details').innerHTML.includes('>Sicht<'));
  H.check('Sicht: ohne Luftdaten trotzdem da (7 Kacheln)', (() => { const d = JSON.parse(JSON.stringify(data)); d.air = null; const s2 = boot({ fetchImpl: H.okFetch(d), geolocation: granted }); return wait(300).then(() => { const h = G(s2,'details').innerHTML; return (h.match(/class="tile /g) || []).length === 7 && h.includes('>Sicht<'); }); })());
  const fcFog = JSON.parse(JSON.stringify(fc)); fcFog.hourly.visibility = fcFog.hourly.visibility.map(() => 24140); fcFog.hourly.visibility[14] = 400;
  const vi = sb.visibilityInfo(fcFog);
  H.check('Sicht: Nebel jetzt (400 m), danach frei: Risiko hoch mit Taupunkt', vi.vis === 400 && vi.word === 'Nebel' && vi.risk === 'hoch' && vi.riskAt === null && /^Nebelrisiko hoch · Taupunkt -?\d+°$/.test(vi.sub), JSON.stringify(vi));
  const fcHaze = JSON.parse(JSON.stringify(fcFog)); fcHaze.hourly.visibility[14] = 2500; fcHaze.hourly.dew_point_2m = fcHaze.hourly.temperature_2m.map(t => t - 1);
  const vh = sb.visibilityInfo(fcHaze);
  H.check('Sicht: diesig mit geringem Taupunktabstand ergibt Risiko mittel', vh.word === 'diesig' && vh.risk === 'mittel' && /^Nebelrisiko mittel · Taupunkt -?\d+°$/.test(vh.sub) && vh.big.includes('2,5') && vh.big.includes('km'), JSON.stringify(vh));
  const fcClear = JSON.parse(JSON.stringify(fcFog)); fcClear.hourly.visibility[14] = 24140;
  H.check('Sicht: klar und trocken ergibt Risiko gering', sb.visibilityInfo(fcClear).risk === 'gering' && /^Nebelrisiko gering · Taupunkt/.test(sb.visibilityInfo(fcClear).sub), sb.visibilityInfo(fcClear).sub);
  H.check('Sicht: ohne Sichtfeld keine Kachelangaben', sb.visibilityInfo(JSON.parse(JSON.stringify(H.mockForecast())).hourly ? (() => { const f = JSON.parse(JSON.stringify(fc)); delete f.hourly.visibility; return f; })() : fc) === null);
  // Zwei Nebelblöcke (5 bis 7 Uhr und 16 bis 17 Uhr): der Satz spannt über alle Stunden mit hohem Risiko, nicht nur den ersten Block
  const fcFog2 = JSON.parse(JSON.stringify(fc)); fcFog2.hourly.visibility[35] = 400;   /* zweiter Block morgen 11 Uhr, noch im 24-Stunden-Fenster */
  const fogNote = (sb.sichtPanelHtml(fcFog2).match(/<div class="tp-note">([^<]*)<\/div>/) || [])[1];
  H.check('Sicht: Nebelsatz umfasst alle Blöcke mit hohem Risiko (5 bis 12 Uhr), Säulen beider Blöcke grau', fogNote === 'Nebelrisiko hoch morgen von 5 bis 12 Uhr: Sicht unter 1 km.' && (sb.sichtPanelHtml(fcFog2).match(/<i class="fog vb"/g) || []).length === 3, fogNote);

  // 8) Ansicht nach Frage
  sb.setView('overview');
  const views = G(sb,'views').innerHTML;
  H.check('Ansicht: fünf Chips, Überblick gedrückt, kein Satz', (views.match(/class="view-chip/g) || []).length === 5 && views.includes('class="view-chip on" data-view="overview" aria-pressed="true"') && G(sb,'viewAnswer').classList.contains('hidden') && sb.currentView() === 'overview', views.slice(0, 200));
  const stripBefore = G(sb,'hourly').innerHTML, daysBefore = G(sb,'days').innerHTML;
  sb.selectHour(42);
  sb.setView('wind');
  let strip = G(sb,'hourly').innerHTML, days = G(sb,'days').innerHTML;
  H.check('Ansicht Wind: Pfeile, Wert und Böen je Spalte, grüne Füllung, Spalten stehen still', (strip.match(/class="hcol/g) || []).length === 48 && (strip.match(/class="ic arrow"/g) || []).length === 48 && strip.includes('style="--ang:242deg"') && strip.includes('<span class="v">18</span><span class="p">Böen 36</span>') && (strip.match(/fill wfill/g) || []).length === 47 && strip.includes('--p:60%') && !/class="hcol now[^"]*"[^>]*><i class="fill/.test(strip) && !strip.includes('animation-delay') && (strip.match(/animation:none/g) || []).length >= 48, strip.slice(0, 300));
  H.check('Ansicht Wind: Antwortsatz, Notiz, Kopfzeile, Wahl gespeichert, Zeitreise bleibt', G(sb,'viewAnswer').textContent === 'Jetzt Böen bis 36 km/h aus SW.' && !G(sb,'viewAnswer').classList.contains('hidden') && G(sb,'hourlyNote').textContent.startsWith('Grün:') && G(sb,'daysHint').textContent === 'Wind · Böen km/h' && sb._store['wetter:view'] === 'wind' && G(sb,'views').innerHTML.includes('data-view="wind" aria-pressed="true"') && G(sb,'hero').innerHTML.includes('<span>Morgen, 18 Uhr</span>'), G(sb,'viewAnswer').textContent);
  sb.clearHour();
  H.check('Ansicht Wind: Tagesliste mit Pfeil, Richtung, Wind, Böenbalken', (days.match(/class="drow/g) || []).length === 14 && days.includes('<div class="pp">SW</div><div class="lo">22</div><div class="bar"><i style="left:0.0%;width:100.0%;animation:none"></i></div><div class="hi">48</div>') && (days.match(/class="ic arrow"/g) || []).length === 14 && G(sb,'daysField').classList.contains('v-wind'), days.slice(0, 400));
  sb.setView('rain');
  strip = G(sb,'hourly').innerHTML; days = G(sb,'days').innerHTML;
  H.check('Ansicht Regen: Risiko als Wert, Menge darunter, Füllung ab 25 %, Satz, Tagesliste', strip.includes('<span class="v">71%</span><span class="p">1,2 mm</span>') && strip.includes('<i class="fill" style="--p:71%;animation:none"></i>') && G(sb,'viewAnswer').textContent === 'Regen bis 15 Uhr, dann trocken, ab 21 Uhr wieder Regen.' && G(sb,'daysHint').textContent === 'Risiko · Stunden · mm' && days.includes('<div class="pp">55%</div><div class="lo">3 h</div>') && days.includes('<div class="hi">3,4</div>') && G(sb,'daysField').classList.contains('v-rain') && !G(sb,'daysField').classList.contains('v-wind'), strip.slice(0, 300) + ' | ' + G(sb,'viewAnswer').textContent);
  H.check('Rückmeldungen: Ansichtswechsel wird angesagt', G(sb,'live').textContent === 'Ansicht Regen.', G(sb,'live').textContent);
  sb.setView('warm');
  strip = G(sb,'hourly').innerHTML;
  H.check('Ansicht Wärme: Tönung nach Temperatur, gefühlt darunter, Satz, Liste wie Überblick', strip.includes('class="hcol now tc4"') && strip.includes('class="hcol tc3"') && strip.includes('<span class="v">18°</span><span class="p">gef. 17°</span>') && (strip.match(/ tc2"/g) || []).length > 0 && G(sb,'viewAnswer').textContent === 'Höchstens 20° morgen um 11 Uhr, gefühlt 19°, nachts bis 4°.' && G(sb,'daysHint').textContent === 'Tief · Hoch' && G(sb,'days').innerHTML.includes('<div class="lo">8°</div>'), G(sb,'viewAnswer').textContent);
  // Fünf Stufen der Tönung, Grenzen einschließlich; die Regel für tc3 (8 bis 16 °C) legt modern.css an
  H.check('Ansicht Wärme: tempClass liefert alle fünf Stufen (bis 0, bis 8, bis 16, bis 24, darüber)', sb.tempClass(-3) === ' tc1' && sb.tempClass(0) === ' tc1' && sb.tempClass(8) === ' tc2' && sb.tempClass(12) === ' tc3' && sb.tempClass(16) === ' tc3' && sb.tempClass(24) === ' tc4' && sb.tempClass(24.5) === ' tc5' && sb.tempClass(null) === '', [-3, 0, 8, 12, 16, 24, 24.5].map(t => sb.tempClass(t)).join(','));
  sb.setView('light');
  strip = G(sb,'hourly').innerHTML; days = G(sb,'days').innerHTML;
  H.check('Ansicht Licht: UV-Wert, Bewölkung, Sonnenfüllung, 22 Nachtspalten gedämpft, Satz, Liste', strip.includes('<span class="v">UV 4</span><span class="p">45 %</span>') && (strip.match(/ dark"/g) || []).length === 22 && (strip.match(/fill lfill/g) || []).length === 25 && strip.includes('--p:55%') && strip.includes('<span class="v">–</span>') && G(sb,'viewAnswer').textContent === '6 h Sonne heute, UV mittel jetzt, goldene Stunde ab 18:24.' && days.includes('<div class="pp">UV 5</div><div class="lo"></div><div class="bar"><i style="left:0.0%;width:50.5%;animation:none"></i></div><div class="hi">6 h</div>') && G(sb,'daysHint').textContent === 'UV · Sonnenstunden', G(sb,'viewAnswer').textContent);
  sb.setView('overview');
  const norm = x => x.replace(/ style="[^"]*"/g, '').replace(/ data-stagger="[^"]*"/g, '');
  H.check('Ansicht Überblick: Markup wie zuvor bis auf die Einblendung, Satz verborgen, Notiz wie gehabt', norm(G(sb,'hourly').innerHTML) === norm(stripBefore) && norm(G(sb,'days').innerHTML) === norm(daysBefore) && G(sb,'viewAnswer').classList.contains('hidden') && G(sb,'hourlyNote').textContent === 'Blaue Felder: Regenrisiko ab 25 %' && sb._store['wetter:view'] === 'overview', norm(G(sb,'hourly').innerHTML).slice(0, 200));
  G(sb,'views').trigger('click', { target: { closest: () => ({ getAttribute: () => 'wind' }) } });
  H.check('Ansicht: Chip-Tipp über den Delegaten', sb.currentView() === 'wind' && G(sb,'hourly').innerHTML.includes('class="ic arrow"'));
  sb.setView('xyz');
  H.check('Ansicht: unbekannte Werte fallen auf Überblick', sb.currentView() === 'overview');
  // Sätze an Grenzfällen
  const vDry = clone(); vDry.hourly.precipitation = vDry.hourly.precipitation.map(() => 0); vDry.hourly.precipitation_probability = vDry.hourly.precipitation_probability.map(() => 5);
  const vWet = clone(); vWet.hourly.precipitation = vWet.hourly.precipitation.map(() => 0.5);
  const vLater = clone(); vLater.hourly.precipitation = vLater.hourly.precipitation.map((v, i) => (i >= 18 && i <= 20 ? 0.8 : 0)); vLater.hourly.precipitation_probability = vLater.hourly.precipitation_probability.map(() => 5);
  H.check('Sätze Regen: trocken, durchgehend, später mit Menge', sb.answerRain(sb.prepareData(vDry, null)) === 'Kein Regen in den nächsten 24 Stunden.' && sb.answerRain(sb.prepareData(vWet, null)) === 'Regen die nächsten 24 Stunden, etwa 12 mm.' && sb.answerRain(sb.prepareData(vLater, null)) === 'Trocken bis 18 Uhr, dann Regen bis 21 Uhr, etwa 2,4 mm.', [vDry, vWet, vLater].map(f => sb.answerRain(sb.prepareData(f, null))).join(' | '));
  const vCalm = clone(); vCalm.hourly.wind_gusts_10m = vCalm.hourly.wind_gusts_10m.map(() => 12);
  const vGust = clone(); vGust.hourly.wind_gusts_10m = vGust.hourly.wind_gusts_10m.map((g, i) => (i === 19 ? 52 : (i >= 26 ? 15 : 30)));
  H.check('Sätze Wind: kaum Wind, Höchstböe später mit Nachsatz', sb.answerWind(vCalm) === 'Kaum Wind in den nächsten 24 Stunden.' && sb.answerWind(vGust) === 'Böen bis 52 km/h aus W gegen 19 Uhr, später ruhig.', sb.answerWind(vGust));
  const vNight = clone(); vNight.current.time = '2026-09-25T22:15';
  H.check('Sätze Licht nachts: nächster Aufgang, Sonne morgen, UV', sb.answerLight(vNight) === 'Sonnenaufgang 07:12, morgen 6 h Sonne, UV mittel.', sb.answerLight(vNight));
  // Nachts zählt der Tag nach den Lichtzeiten: vor dem Aufgang heute, nach dem Untergang morgen, auch bei spätem Aufgang um 13 Uhr
  const vEarly = clone(); vEarly.current.time = '2026-09-25T02:15';
  const vLate = clone(); vLate.current.time = '2026-09-25T12:15'; vLate.hourly.is_day[12] = 0; vLate.daily.sunrise[0] = '2026-09-25T13:00'; vLate.daily.uv_index_max[1] = 7;
  H.check('Sätze Licht nachts: nach Mitternacht der heutige Aufgang, vor einem späten Aufgang (13 Uhr) ebenfalls heute', sb.answerLight(vEarly) === 'Sonnenaufgang 07:12, heute 6 h Sonne, UV mittel.' && sb.answerLight(vLate) === 'Sonnenaufgang 13:00, heute 6 h Sonne, UV mittel.', sb.answerLight(vEarly) + ' | ' + sb.answerLight(vLate));
  const vDayLow = clone(); vDayLow.hourly.temperature_2m = vDayLow.hourly.temperature_2m.map((t, i) => (i === 16 ? 2 : Math.max(t, 6)));
  H.check('Sätze Wärme: Tiefstwert am Tag mit Stunde', sb.answerWarm(vDayLow) === 'Höchstens 20° morgen um 11 Uhr, gefühlt 19°, tiefstens 2° um 16 Uhr.', sb.answerWarm(vDayLow));
  // Gespeicherte Ansicht beim Start
  const sbW = boot({ fetchImpl: H.okFetch(data), geolocation: granted, storage: { 'wetter:view': 'wind' } });
  await wait(300);
  H.check('Ansicht: gespeicherte Wahl beim Start, Spalten mit Einblendung', sbW.currentView() === 'wind' && G(sbW,'hourly').innerHTML.includes('class="ic arrow"') && G(sbW,'views').innerHTML.includes('data-view="wind" aria-pressed="true"') && G(sbW,'viewAnswer').textContent === 'Jetzt Böen bis 36 km/h aus SW.' && !G(sbW,'hourly').innerHTML.includes('animation:none') && G(sbW,'daysHint').textContent === 'Wind · Böen km/h', G(sbW,'viewAnswer').textContent);

  // Shell-Markup: gleitende Tab-Pille und Design-Schleier liegen in beiden Seiten
  const idx = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const rad = fs.readFileSync(require('path').join(__dirname, '..', 'radar.html'), 'utf8');
  const css = fs.readFileSync(require('path').join(__dirname, '..', 'modern.css'), 'utf8');
  H.check('Shell: Tab-Pille in index.html und radar.html, kein klassisches Design mehr, Schalter und Service Worker', [idx, rad].every(h => h.includes('<span class="tab-ink"') && !h.includes('designVeil') && !h.includes('design.css') && !h.includes('data-design') && !h.includes('wetter:design') && !h.includes('class="sky"') && h.includes('id="modeBtn"') && h.includes('serviceWorker.register("sw.js")')) && !idx.includes('designLink') && !fs.existsSync(require('path').join(__dirname, '..', 'design.css')));
  H.check('Shell: Rausgehen-Feld in index.html', idx.includes('id="activityField"') && idx.includes('id="activity"'));
  H.check('Shell: Ansicht nach Frage in index.html und Stylesheet mit Nacht-Token', idx.includes('id="views"') && idx.includes('id="viewAnswer"') && idx.includes('id="hourlyNote"') && idx.includes('id="daysHint"') && css.includes('.view-chip') && css.includes('--wfill: #BFE0C4') && css.includes('--wfill: #2F5A3A') && css.includes('.hcol.tc4:not(.now)') && css.includes('.days-field.v-light .drow .bar i') && css.includes('.vis24 i.fog') && css.includes('html.night .vis24 i.fog'));
  H.check('Shell: keine klassische Ansicht mehr verlinkt oder vorhanden', !idx.includes('klassisch.html') && !fs.existsSync(require('path').join(__dirname, '..', 'klassisch.html')) && !fs.existsSync(require('path').join(__dirname, '..', 'wetter.css')));
  // Versions-Query: Referenz aus index.html (modern.css), dort vier css/js-Verweise und zwei Icon-Links, in radar.html drei und einer, SW_VERSION in sw.js
  const av = H.assetVersion();
  H.check('Shell: Versions-Query aus index.html an allen css/js-Verweisen und Icon-Links beider Seiten und in SW_VERSION', typeof av.version === 'string' && av.refs.length === 11 && av.refs.filter(r => r.asset.startsWith('icons/')).length === 3 && av.mismatches.length === 0, av.version + ' | ' + av.refs.map(r => r.file + ':' + r.asset + '=' + r.v).join(','));
  H.check('Shell: Sonnenrechnung vor den App-Skripten, Nachtklasse vor dem ersten Zeichnen', [idx, rad].every(h => h.includes('<script src="sonne.js?v=') && /wetter:night[\s\S]{0,120}classList\.add\("night"\)/.test(h) && h.indexOf('wetter:night') < h.indexOf('<link rel="stylesheet" href="modern.css')));
  H.check('Shell: Nachtpalette im Stylesheet mit Token, Hero-Farben, Fade und Kachel-Einblendung', css.includes('html.night {') && css.includes('--card:') && css.includes('--soft:') && css.includes('--wet:') && css.includes('html.night .theme-rain') && css.includes('html.fade') && css.includes('.tile.swap') && css.includes('.field.white { background: var(--card); }') && /\.tile \{[^}]*background: var\(--card\)/.test(css) && /\.hcol\.wet \{ background: var\(--wet\)/.test(css), css.match(/\.field\.white[^\n]*/));

  if (process.env.DUMP) {
    fs.writeFileSync(__dirname + '/render-design.json', JSON.stringify({
      theme: [...body.classList.c].join(' '), hero: G(sb,'hero').innerHTML, warnings: G(sb,'warnings').innerHTML, insight: G(sb,'insight').innerHTML, hourly: G(sb,'hourly').innerHTML, nowcast: G(sb,'nowcast').innerHTML,
      days: G(sb,'days').innerHTML, details: G(sb,'details').innerHTML, models: G(sb,'models').innerHTML
    }));
  }
  // Startseite anpassen: Reihenfolge und Sichtbarkeit der Felder, Kacheln ausblenden
  H.check('Startseite: Kacheln tragen Namen zum Ausblenden', ['uv', 'wind', 'rain', 'sun', 'humidity', 'pressure', 'air', 'pollen'].every(n => G(sb,'details').innerHTML.includes('data-name="' + n + '"')), (G(sb,'details').innerHTML.match(/data-name="[a-z]+"/g) || []).join(','));
  H.check('Startseite: Vorgabe-Reihenfolge der Felder', sb.layoutOrder().join(',') === 'insight,views,hoursField,activityField,highlightsField,nowcastCard', sb.layoutOrder().join(','));
  sb.setSetting('order', ['nowcastCard', 'unbekannt', 'insight']);
  H.check('Startseite: gespeicherte Reihenfolge zuerst, Unbekanntes raus, Fehlendes hinten', sb.layoutOrder().join(',') === 'nowcastCard,insight,views,hoursField,activityField,highlightsField', sb.layoutOrder().join(','));
  sb.setSetting('hidden', ['insight', 'uv']);
  H.check('Startseite: ausgeblendetes Feld trägt die Klasse, Einstellung gespeichert', G(sb,'insight').classList.contains('user-hidden') && !G(sb,'views').classList.contains('user-hidden') && sb._store['wetter:settings'].includes('"hidden":["insight","uv"]'), sb._store['wetter:settings']);
  sb.openSettings();
  const setL = G(sb,'settingsBody').innerHTML;
  H.check('Startseite: Abschnitt mit Pfeilen je Feld und Sichtbar-Knöpfen, Zustand abgebildet', setL.includes('<h3>Startseite</h3>') && (setL.match(/class="set-mv"/g) || []).length === 12 && (setL.match(/class="set-vis"/g) || []).length === 14 && setL.includes('class="set-vis" data-id="insight" aria-pressed="false" aria-label="Hinweis sichtbar">Ausgeblendet</button>') && setL.includes('class="set-vis" data-id="uv" aria-pressed="false" aria-label="UV-Index sichtbar">Ausgeblendet</button>') && setL.indexOf('data-id="nowcardCard"') < 0 && setL.indexOf('Regen in 4 Stunden') < setL.indexOf('>Hinweis<'), setL.slice(setL.indexOf('Startseite'), setL.indexOf('Startseite') + 300));
  G(sb,'settingsBody').trigger('click', { target: { closest: s => s === '.set-mv' ? { getAttribute: n => n === 'data-id' ? 'views' : 'up' } : null } });
  H.check('Startseite: Pfeil nach oben verschiebt das Feld und sagt es an', sb.layoutOrder().join(',') === 'nowcardCard,views,insight,hoursField,activityField,highlightsField'.replace('nowcardCard', 'nowcastCard') && G(sb,'live').textContent === 'Reihenfolge geändert.', sb.layoutOrder().join(','));
  G(sb,'settingsBody').trigger('click', { target: { closest: s => s === '.set-vis' ? { getAttribute: () => 'insight' } : null } });
  H.check('Startseite: Sichtbar-Knopf blendet wieder ein', !G(sb,'insight').classList.contains('user-hidden') && sb.settingsValue('hidden').join(',') === 'uv' && G(sb,'live').textContent === 'Eingeblendet.');
  sb.setSetting('order', []); sb.setSetting('hidden', []);
  // Umhängen im DOM: sortierbare Felder tauschen nur untereinander die Plätze, Warnungen und Reise bleiben, wo sie sind.
  // Der Abschnitt ist hier ein Stub mit Kinderliste wie in index.html; insertBefore/appendChild pflegen die Liste.
  const secT = G(sb,'sec-today');
  const secIds = ['hero', 'warnings', 'insight', 'views', 'hoursField', 'activityField', 'highlightsField', 'tripField', 'nowcastCard'];
  let secKids = secIds.map(id => { const e = G(sb, id); e.id = id; e.parentNode = secT; return e; });
  secT.children = secKids;
  secT.insertBefore = (el, ref) => { secKids.splice(secKids.indexOf(el), 1); secKids.splice(secKids.indexOf(ref), 0, el); secT.children = secKids; };
  secT.appendChild = (el) => { secKids.splice(secKids.indexOf(el), 1); secKids.push(el); secT.children = secKids; };
  sb.setSetting('order', ['nowcastCard', 'insight']);
  H.check('Startseite: Umhängen hält Warnungen und Reise an ihrem Platz, die sortierbaren Felder füllen ihre Plätze in der neuen Reihenfolge', secKids.map(k => k.id).join(',') === 'hero,warnings,nowcastCard,insight,views,hoursField,activityField,tripField,highlightsField', secKids.map(k => k.id).join(','));
  sb.setSetting('order', []);
  H.check('Startseite: Vorgabe stellt die Reihenfolge aus index.html wieder her', secKids.map(k => k.id).join(',') === secIds.join(','), secKids.map(k => k.id).join(','));
  delete secT.children; delete secT.insertBefore; delete secT.appendChild;
  secIds.forEach(id => { delete G(sb, id).parentNode; });
  // Reise: Zustand, Feld mit Countdown, Einstellungen, automatischer Wechsel
  // renderTrip und tripAutoSwitch rechnen mit nowMs(): „heute“ ist der 25.09.2026 der Testzeit
  const dayAt = (n) => sb.localDate(new Date(H.TEST_NOW + n * 86400000));
  H.check('Reise: Tagesbasis ist die Testzeit', dayAt(0) === '2026-09-25', dayAt(0));
  H.check('Reise: Phasen vorher, unterwegs, vorbei', JSON.stringify(sb.tripState({ from: '2026-10-14', to: '2026-10-21' }, '2026-10-09')) === '{"phase":"before","days":5}' && JSON.stringify(sb.tripState({ from: '2026-10-14', to: '2026-10-21' }, '2026-10-16')) === '{"phase":"during","days":5}' && sb.tripState({ from: '2026-10-14', to: '2026-10-21' }, '2026-10-22').phase === 'after' && sb.tripState(null, '2026-10-09') === null);
  H.check('Reise: ungültige Angaben werden verworfen', sb.normalizeSettings({ trip: { name: 'X', lat: 1, lon: 2, from: '2026-10-21', to: '2026-10-14' } }).trip === null && sb.normalizeSettings({ trip: { name: 'Lignano', lat: 45.69, lon: 13.12, from: '2026-10-14', to: '2026-10-21' } }).trip.name === 'Lignano');
  sb.setSetting('trip', { name: 'Lignano', lat: 45.69, lon: 13.12, from: dayAt(5), to: dayAt(12) });
  sb.renderTrip();
  const tripA = G(sb,'trip').innerHTML;
  H.check('Reise: Feld mit Ziel, Zeitraum, Countdown und Knopf', !G(sb,'tripField').classList.contains('hidden') && tripA.includes('<b>Lignano</b>') && tripA.includes('In 5 Tagen geht es los.') && tripA.includes('data-trip="go">Wetter in Lignano ansehen</button>'), tripA);
  sb.setSetting('trip', { name: 'Lignano', lat: 45.69, lon: 13.12, from: dayAt(-1), to: dayAt(6) });
  sb.renderTrip();
  H.check('Reise: unterwegs mit Resttagen', G(sb,'trip').innerHTML.includes('Du bist unterwegs, noch 6 Tage.'), G(sb,'trip').innerHTML);
  sb.openSettings();
  const setT = G(sb,'settingsBody').innerHTML;
  H.check('Reise: Einstellungen mit Ort, Datumsfeldern und Löschen', setT.includes('<h3>Reise</h3>') && setT.includes('id="tripPick">Ort ändern</button>') && setT.includes('id="tripFrom" data-k="from" value="' + dayAt(-1) + '"') && setT.includes('id="tripDel">Reise löschen</button>'), setT.slice(setT.indexOf('<h3>Reise'), setT.indexOf('<h3>Reise') + 300));
  G(sb,'settingsBody').trigger('change', { target: { closest: s => s === '.trip-date' ? { getAttribute: () => 'to', value: dayAt(2) } : null } });
  H.check('Reise: Datumsänderung wird übernommen', sb.settingsValue('trip').to === dayAt(2) && G(sb,'trip').innerHTML.includes('noch 2 Tage.'), G(sb,'trip').innerHTML);
  G(sb,'settingsBody').trigger('click', { target: { closest: s => s === '#tripDel' ? {} : null } });
  H.check('Reise: Löschen leert Einstellung und Feld', sb.settingsValue('trip') === null && G(sb,'tripField').classList.contains('hidden') && G(sb,'live').textContent === 'Reise gelöscht.');
  sb.closeSettings();
  const sbTrip = boot({ fetchImpl: H.okFetch(data), geolocation: granted, storage: { 'wetter:settings': JSON.stringify({ trip: { name: 'Lignano', lat: 45.69, lon: 13.12, from: dayAt(-1), to: dayAt(3) } }) } });
  await wait(300);
  H.check('Reise: beim Start wechselt die App einmal am Tag in die Reisevorhersage', G(sbTrip,'locName').textContent === '🔍 Lignano' && JSON.parse(sbTrip._store['wetter:settings']).tripSwitched === dayAt(0) && G(sbTrip,'trip').innerHTML.includes('data-trip="home">Zurück zu meinem Standort</button>') && sbTrip._fetchLog.some(u => u.includes('latitude=45.69')), G(sbTrip,'locName').textContent + ' | ' + G(sbTrip,'trip').innerHTML.slice(-80));
  H.check('Shell: Reise-Feld in index.html, Stile für Startseite und Reise', idxA.includes('id="tripField"') && idxA.includes('id="trip"') && cssA.includes('.user-hidden { display: none !important; }') && cssA.includes('.trip-btn'));
  // Verlaufssicht: Meteogramm der nächsten 48 Stunden
  const trendA = sb.trendSvg(fc, sb.prepareData(fc, data.ens));
  H.check('Verlauf: Wolkenband, Temperaturlinie mit Extremen, Windpfeile, Regenbalken, Achse mit Tagesgrenzen', (trendA.match(/<rect class="cloud"/g) || []).length === 48 && /<polyline class="tline" points="(\d+\.\d,\d+\.\d ){47}\d+\.\d,\d+\.\d"\/>/.test(trendA) && trendA.includes('>20°</text>') && trendA.includes('>4°</text>') && (trendA.match(/<path class="wa"/g) || []).length === 16 && (trendA.match(/<rect class="rb"/g) || []).length === 7 && (trendA.match(/<line class="day"/g) || []).length === 2 && trendA.includes('>Sa</text>') && trendA.includes('>So</text>') && (trendA.match(/y="150" text-anchor="middle">\d\d<\/text>/g) || []).length === 8, trendA.slice(0, 200));
  H.check('Verlauf: verborgener Satz mit Spanne, Regen, Bewölkung und Wind', /<div class="vh">Verlauf der nächsten 48 Stunden: Temperatur zwischen 4 und 20 Grad, Regen insgesamt 8,4 mm, Bewölkung im Mittel \d+ %, Wind bis \d+ km\/h\.<\/div>/.test(trendA), trendA.slice(trendA.indexOf('class="vh"'), trendA.indexOf('class="vh"') + 160));
  sb.toggleTrend();
  H.check('Verlauf: Knopf klappt das Feld auf, rendert und sagt es an', G(sb,'trend').classList.contains('open') && G(sb,'trendBtn').getAttribute('aria-expanded') === 'true' && G(sb,'trendBody').innerHTML.includes('<svg class="trend"') && G(sb,'live').textContent === 'Verlauf geöffnet.', G(sb,'trendBody').innerHTML.slice(0, 60));
  sb.toggleTrend();
  H.check('Verlauf: wieder zu', !G(sb,'trend').classList.contains('open') && G(sb,'trendBtn').getAttribute('aria-expanded') === 'false');
  H.check('Shell: Verlaufsknopf und Feld in index.html, Stile', idxA.includes('id="trendBtn" aria-expanded="false" aria-controls="trend"') && idxA.includes('id="trend" role="region"') && cssA.includes('.trend .tline'));
  // Regenradar als Blatt
  H.check('Radar: Blatt mit Rahmen in index.html, Tab als Dialogöffner, Vollbild-Link, Radarseite kennt den Einbettungsmodus', idxA.includes('id="radarSheet" role="dialog"') && idxA.includes('<iframe id="radarFrame" title="Regenradar"') && idxA.includes('id="radarTab" aria-label="Radar" aria-haspopup="dialog"') && idxA.includes('class="src-link radar-full" href="radar.html">Vollbild</a>') && radarA.includes('document.documentElement.classList.add("embed")') && radarA.includes('html.embed .rshell .top, html.embed .tabs { display: none; }') && cssA.includes('body.radar-open #radarSheet { transform: none; }'));
  G(sb,'radarTab').trigger('click', { preventDefault() { this.prevented = true; } });
  H.check('Radar: Tipp auf den Tab öffnet das Blatt, der Rahmen lädt die eingebettete Radarseite mit Nachtzustand, Ansage', sb.document.body.classList.contains('radar-open') && G(sb,'radarFrame').src === 'radar.html?embed=1&night=0' && G(sb,'radarTab').getAttribute('aria-expanded') === 'true' && G(sb,'live').textContent === 'Regenradar geöffnet.', G(sb,'radarFrame').src);
  sb.closeRadar();
  H.check('Radar: Schließen, Fokus zurück auf den Tab', !sb.document.body.classList.contains('radar-open') && G(sb,'radarTab').focused === true);
  // Nachtwechsel: der geladene Rahmen bekommt den neuen Parameter (lädt neu), die Adresse folgt dem Zustand
  sb.updateNight('2026-09-25T21:00');
  const radarNight = G(sb,'radarFrame').src;
  sb.updateNight('2026-09-26T10:00');
  H.check('Radar: Nachtwechsel setzt night=1 am geladenen Rahmen, der Morgen wieder night=0', radarNight === 'radar.html?embed=1&night=1' && G(sb,'radarFrame').src === 'radar.html?embed=1&night=0' && sb.radarEmbedUrl() === 'radar.html?embed=1&night=0', radarNight + ' | ' + G(sb,'radarFrame').src);

  // Regen-Alarm: Abschnitt, Unterstützung, Abonnement-Nutzlast, Schlüssel
  sb.openSettings();
  const setP = G(sb,'settingsBody').innerHTML;
  H.check('Regen-Alarm: Abschnitt mit Hinweis, ohne Push-Unterstützung im Harness nur die Erklärung', setP.includes('<h3>Regen-Alarm</h3>') && !sb.pushSupported() && setP.includes('Dein Browser unterstützt keine Push-Nachrichten.') && setP.includes('Prüft alle 15 Minuten'), setP.slice(setP.indexOf('Regen-Alarm'), setP.indexOf('Regen-Alarm') + 200));
  sb.closeSettings();
  sb.setSetting('push', true);
  sb.openSettings();
  // Der Knopf für die Probenachricht erscheint nur, wenn Push unterstützt wird und der Alarm an ist; ohne Unterstützung bleibt er weg
  H.check('Regen-Alarm: ohne Push-Unterstützung kein Knopf für die Probenachricht, auch mit eingeschaltetem Alarm', !G(sb,'settingsBody').innerHTML.includes('id="pushTest"') && !G(sb,'settingsBody').innerHTML.includes('id="pushTestMsg"'), G(sb,'settingsBody').innerHTML.slice(G(sb,'settingsBody').innerHTML.indexOf('Regen-Alarm'), G(sb,'settingsBody').innerHTML.indexOf('Regen-Alarm') + 300));
  H.check('Regen-Alarm: Probenachricht ohne Push-Unterstützung meldet das statt zu scheitern', (await sb.testPush()) === false && G(sb,'live').textContent === 'Hier nicht möglich, bitte in der Homescreen-App.', G(sb,'live').textContent);
  sb.closeSettings();
  sb.setSetting('push', false);
  // Push-Unterstützung nachgestellt: Service Worker, PushManager und Notification als Stubs; der Worker antwortet je nach Modus
  let pushMode = 'ok'; const pushLog = [];
  const pushFetch = async (url, init) => {
    if (String(url).includes('/push/')) { pushLog.push(String(url).slice(String(url).indexOf('/push/'))); if (pushMode === 'down') throw new Error('offline'); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }
    return H.okFetch(data)(url);
  };
  const subStub = { endpoint: 'https://push.example/abc', unsubscribed: 0, unsubscribe: async function () { this.unsubscribed++; return true; }, toJSON: function () { return { endpoint: this.endpoint, keys: { p256dh: 'a', auth: 'b' } }; } };
  let subscribeCalls = 0, haveSub = false;
  const pushEnv = s => {
    s.navigator.serviceWorker = { ready: Promise.resolve({ pushManager: { getSubscription: async () => (haveSub ? subStub : null), subscribe: async () => { subscribeCalls++; haveSub = true; return subStub; } } }) };
    s.PushManager = function () {}; s.Notification = { requestPermission: async () => 'granted' };
  };
  const sbN = boot({ fetchImpl: pushFetch, geolocation: denied });
  await wait(300);
  pushEnv(sbN);
  H.check('Regen-Alarm: ohne geladenen Ort wird nicht abonniert, Hinweis statt verwaistem Abonnement', sbN.pushSupported() && (await sbN.enablePush()) === false && subscribeCalls === 0 && pushLog.length === 0 && G(sbN,'live').textContent === 'Noch kein Ort geladen.' && sbN.settingsValue('push') === false, G(sbN,'live').textContent + ' ' + subscribeCalls);
  const sbP = boot({ fetchImpl: pushFetch, geolocation: granted });
  await wait(300);
  pushEnv(sbP);
  H.check('Regen-Alarm: mit Ort wird abonniert und beim Worker angemeldet', (await sbP.enablePush()) === true && subscribeCalls === 1 && pushLog.join(',') === '/push/subscribe' && sbP.settingsValue('push') === true && sbP.settingsValue('pushLoc').lat === 48.137, pushLog.join(',') + ' ' + G(sbP,'live').textContent);
  sbP.openSettings();
  H.check('Regen-Alarm: mit Unterstützung und eingeschaltetem Alarm gibt es den Knopf für die Probenachricht', G(sbP,'settingsBody').innerHTML.includes('id="pushTest">Probenachricht senden</button>') && G(sbP,'settingsBody').innerHTML.includes('id="pushTestMsg"'));
  sbP.closeSettings();
  pushMode = 'down';
  H.check('Regen-Alarm: scheitert die Abmeldung beim Worker, bleibt der Versuch vorgemerkt, der Alarm ist lokal aus', (await sbP.disablePush()) === true && subStub.unsubscribed === 1 && sbP.settingsValue('push') === false && sbP.settingsValue('pushUnsub') === 'https://push.example/abc' && /wiederholt/.test(G(sbP,'live').textContent) && !G(sbP,'settingsBody').innerHTML.includes('id="pushTest"'), G(sbP,'live').textContent + ' ' + sbP.settingsValue('pushUnsub'));
  pushMode = 'ok'; const unsubBefore = pushLog.length;
  await sbP.syncPush();
  H.check('Regen-Alarm: der nächste Abgleich holt die Abmeldung nach und löscht die Vormerkung', pushLog.length === unsubBefore + 1 && pushLog[unsubBefore] === '/push/unsubscribe' && !sbP.settingsValue('pushUnsub') && sbP.settingsValue('push') === false, pushLog.slice(unsubBefore).join(',') + ' ' + sbP.settingsValue('pushUnsub'));
  haveSub = true;
  H.check('Regen-Alarm: gelingt die Abmeldung, bleibt nichts vorgemerkt', (await sbP.enablePush()) === true && (await sbP.disablePush()) === true && !sbP.settingsValue('pushUnsub') && G(sbP,'live').textContent === 'Regen-Alarm ausgeschaltet.', G(sbP,'live').textContent);
  // Abmeldung beim Worker gescheitert und das Browser-Abonnement blieb stehen (der Stub lässt unsubscribe wirkungslos):
  // Wiedereinschalten meldet dasselbe Abonnement an und räumt die Vormerkung; der Abgleich darf es nicht beim Worker löschen
  haveSub = true; await sbP.enablePush();
  pushMode = 'down'; await sbP.disablePush();
  const markedAgain = sbP.settingsValue('pushUnsub');
  pushMode = 'ok'; const reBefore = pushLog.length;
  const reOn = await sbP.enablePush();
  const clearedByEnable = sbP.settingsValue('pushUnsub');   /* schon enablePush räumt, nicht erst der Abgleich */
  await sbP.syncPush();
  H.check('Regen-Alarm: Wiedereinschalten mit stehendem Abonnement räumt die vorgemerkte Abmeldung, der Abgleich löscht das Abonnement nicht', markedAgain === 'https://push.example/abc' && reOn === true && clearedByEnable === null && sbP.settingsValue('push') === true && sbP.settingsValue('pushUnsub') === null && pushLog.slice(reBefore).join(',') === '/push/subscribe', pushLog.slice(reBefore).join(',') + ' ' + sbP.settingsValue('pushUnsub'));
  // Vormerkung aus einer älteren Fassung (Alarm an, aktives Abonnement mit demselben Endpunkt): der Abgleich verwirft sie ohne Aufruf
  sbP.setSetting('pushUnsub', 'https://push.example/abc'); const staleBefore = pushLog.length;
  await sbP.syncPush();
  H.check('Regen-Alarm: Abgleich verwirft eine Vormerkung für das aktive Abonnement, statt es beim Worker zu löschen', sbP.settingsValue('pushUnsub') === null && pushLog.length === staleBefore && sbP.settingsValue('push') === true, pushLog.slice(staleBefore).join(',') + ' ' + sbP.settingsValue('pushUnsub'));
  sbP.setSetting('pushUnsub', 'https://push.example/alt'); const altBefore = pushLog.length;
  await sbP.syncPush();
  H.check('Regen-Alarm: Vormerkung für einen anderen Endpunkt wird weiter nachgeholt', pushLog.slice(altBefore).join(',') === '/push/unsubscribe' && sbP.settingsValue('pushUnsub') === null, pushLog.slice(altBefore).join(','));
  await sbP.disablePush();
  H.check('Regen-Alarm: Nutzlast für den Worker und Schlüsselumwandlung', JSON.stringify(sb.pushBody({ endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' } }, { lat: 45.69, lon: 13.12, name: 'Lignano' })) === '{"subscription":{"endpoint":"https://x","keys":{"p256dh":"a","auth":"b"}},"lat":45.69,"lon":13.12,"name":"Lignano"}' && sb.urlBase64ToUint8Array(sb.pushPublicKey()).length === 65 && sb.urlBase64ToUint8Array(sb.pushPublicKey())[0] === 4, sb.pushPublicKey());
  H.check('Regen-Alarm: öffentlicher Schlüssel in App und Worker-Konfiguration identisch', fs.readFileSync(require('path').join(__dirname, '..', 'proxy', 'wrangler.toml'), 'utf8').includes('VAPID_PUBLIC_KEY = "' + sb.pushPublicKey() + '"') && /crons = \["\*\/15 \* \* \* \*"\]/.test(fs.readFileSync(require('path').join(__dirname, '..', 'proxy', 'wrangler.toml'), 'utf8')));

  // Tagesfilm: Szene, Zeitplan, Begrüßung, Einstellungen, Aufnahmeformat
  const scF = sb.filmScene(fc, { name: 'München' });
  H.check('Tagesfilm: Szene aus den Tageswerten (24 Stunden, Sonnenzeiten, Regen, Hoch und Tief, Abschlusszeile)', scF.place === 'München' && scF.dateLabel === 'Freitag, 25. September' && scF.temps.length === 24 && scF.rain.length === 24 && scF.rise === 432 && scF.set === 1145 && scF.riseLabel === '07:12' && scF.hi === 18 && scF.lo === 8 && Math.abs(scF.rainTotal - 4.8) < 0.01 && scF.outro === 'Mo: Gewitter möglich', JSON.stringify(scF).slice(0, 240));
  const tl0 = sb.filmTimeline(0), tl5 = sb.filmTimeline(5), tl10 = sb.filmTimeline(10);
  H.check('Tagesfilm: Zeitplan, Szenen überlagern sich weich und enden nach zehn Sekunden', tl0.title === 0 && tl0.arc === 0 && tl5.title === 1 && tl5.arc === 1 && tl5.temp > 0 && tl5.temp < 1 && tl5.rain === 0 && tl10.outro === 1 && tl10.done === true && !tl5.done, JSON.stringify(tl5));
  H.check('Tagesfilm: Format nach Unterstützung, Safari MP4 vor WebM, sonst nichts', sb.filmMime(m => m === 'video/mp4') === 'video/mp4' && sb.filmMime(m => m.startsWith('video/webm')) === 'video/webm;codecs=vp9' && sb.filmMime(() => false) === null && sb.filmMime(m => m === 'video/mp4;codecs=avc1' || m === 'video/webm') === 'video/mp4;codecs=avc1');
  H.check('Tagesfilm: ohne Zeichenfläche kein Film, keine Begrüßung, kein Fehler, Tagesmerker bleibt leer', sb.openFilm() === false && sb.maybeAutoFilm() === false && sb.settingsValue('filmShown') === null, sb.settingsValue('filmShown'));
  // Zähler des Films: in °F von 0° aus auf den Zielwert, nicht von 32° (erst umrechnen, dann anteilig zählen)
  const filmCalls = [], ctxStub = { clearRect() {}, fillRect() {}, fillText(t) { filmCalls.push(t); }, beginPath() {}, arc() {}, stroke() {}, fill() {}, moveTo() {}, lineTo() {} };
  sb.setSetting('temp', 'F');
  sb.filmFrame(ctxStub, scF, 3.55, sb.filmColors());
  const earlyF = filmCalls.filter(t => /^\d+°$/.test(t));
  filmCalls.length = 0;
  sb.filmFrame(ctxStub, scF, 10, sb.filmColors());
  const endF = filmCalls.filter(t => /^\d+°$/.test(t));
  sb.setSetting('temp', 'C');
  H.check('Tagesfilm: Zähler in °F beginnt nahe 0° und endet bei 63° (17,4 °C)', earlyF.length === 1 && parseInt(earlyF[0], 10) < 10 && endF[0] === '63°', earlyF.join(',') + ' | ' + endF.join(','));
  sb.setSetting('dayfilm', false);
  H.check('Tagesfilm: Begrüßung aus, Einstellung gespeichert', sb.maybeAutoFilm() === false && sb._store['wetter:settings'].includes('"dayfilm":false'));
  sb.setSetting('dayfilm', true);
  sb.openSettings();
  const setF = G(sb,'settingsBody').innerHTML;
  H.check('Tagesfilm: Abschnitt mit Schalter, Abspielknopf und Erklärung', setF.includes('<h3>Tagesfilm</h3>') && setF.includes('data-key="dayfilm" data-val="1" aria-pressed="true"') && setF.includes('id="filmPlay">Jetzt abspielen</button>') && setF.includes('nicht bei reduzierter Bewegung'), setF.slice(setF.indexOf('Tagesfilm'), setF.indexOf('Tagesfilm') + 200));
  G(sb,'settingsBody').trigger('click', { target: { closest: s => s === '.set-chip' ? { getAttribute: n => n === 'data-key' ? 'dayfilm' : '0' } : null } });
  H.check('Tagesfilm: Chip schaltet die Begrüßung aus und sagt es an', sb.settingsValue('dayfilm') === false && G(sb,'live').textContent === 'Tagesfilm morgens aus.');
  sb.setSetting('dayfilm', true);
  sb.closeSettings();
  H.check('Shell: Tagesfilm-Overlay mit Zeichenfläche 1080 × 1920, Teilen und Schließen', idxA.includes('<canvas id="filmCanvas" width="1080" height="1920"') && idxA.includes('id="filmShare">Als Video teilen</button>') && idxA.includes('id="filmClose">Schließen</button>') && cssA.includes('.film canvas'));

  /* VoiceOver-Durchlauf (Bedienungshilfen-Baum aus dem Simulator, 9. Oktober): geschlossene Blätter, zugeklappte
     Felder und die weiteren Tage standen im Baum; Modell-Chips waren vier lose Texte; Schalter ohne Feldnamen. */
  H.check('VoiceOver: geschlossene Blätter unsichtbar, beim Öffnen sofort sichtbar', /\.sheet \{[^}]*visibility: hidden;[^}]*transition: transform var\(--d-fast\) var\(--ease\), visibility 0s var\(--d-fast\);/.test(css) && /body\.sheet-open #sheet, body\.radar-open #radarSheet, body\.settings-open #settings, body\.src-open #src, body\.fb-open #fb \{ visibility: visible; transition: transform var\(--d-fast\) var\(--ease\), visibility 0s; \}/.test(css));
  H.check('VoiceOver: zugeklappte Detailfelder und weitere Tage unsichtbar, aufgeklappt sofort sichtbar', /\.tpanel \{[^}]*visibility: hidden;[^}]*transition: grid-template-rows var\(--d-base\) var\(--ease\), visibility 0s var\(--d-base\);/.test(css) && /\.tpanel\.open \{ grid-template-rows: 1fr; visibility: visible; transition: grid-template-rows var\(--d-base\) var\(--ease\), visibility 0s; \}/.test(css) && /\.days-field \.more-wrap \{[^}]*visibility: hidden;[^}]*transition: grid-template-rows var\(--d-slow\) var\(--ease\), visibility 0s var\(--d-slow\);/.test(css) && /\.days-field\.all \.more-wrap \{ grid-template-rows: 1fr; visibility: visible; transition: grid-template-rows var\(--d-slow\) var\(--ease\), visibility 0s; \}/.test(css));
  H.check('VoiceOver: Modell-Chips sind Schaltflächen mit einem Satz und Druckzustand', /<button type="button" class="mchip hl" data-model="icon_d2" aria-pressed="true" aria-label="ICON-D2: heute [\d,]+ mm, morgen [\d,]+ mm"/.test(mm) && /<button type="button" class="mchip" data-model="ukmo_seamless" aria-pressed="false" aria-label="UKMO: heute [\d,]+ mm, morgen 6,0 mm"/.test(mm) && !/<div class="mchip[ "]/.test(mm) && sb.modelChipLabel({ name: 'GFS', today: NaN, tomorrow: 1.25 }) === 'GFS: heute keine Angabe, morgen 1,3 mm', (mm.match(/<button[^>]*ukmo[^>]*>/) || [''])[0] + ' || ' + sb.modelChipLabel({ name: 'GFS', today: NaN, tomorrow: 1.25 }));
  H.check('VoiceOver: Modell-Chip-Klick setzt den Druckzustand um', (() => { const a = H.el(), b = H.el(); a.setAttribute('data-model', 'icon_d2'); a.setAttribute('aria-pressed', 'true'); b.setAttribute('data-model', 'ukmo_seamless'); b.setAttribute('aria-pressed', 'false'); sb.markModelChips([a, b], 'ukmo_seamless'); return a.getAttribute('aria-pressed') === 'false' && b.getAttribute('aria-pressed') === 'true' && b.classList.contains('hl') && !a.classList.contains('hl'); })());
  H.check('VoiceOver: Tab-Leiste markiert den aktuellen Bereich mit aria-current', (() => { const a = H.el(), b = H.el(); a.setAttribute('aria-current', 'page'); a.classList.add('on'); sb.markTabs([a, b], b); return a.getAttribute('aria-current') === null && b.getAttribute('aria-current') === 'page' && b.classList.contains('on') && !a.classList.contains('on'); })());
  sb.renderSettings();
  const setV = G(sb,'settingsBody').innerHTML;
  H.check('VoiceOver: Sichtbar-Schalter nennen ihr Feld', /<button type="button" class="set-vis" data-id="insight" aria-pressed="true" aria-label="Hinweis sichtbar">Sichtbar<\/button>/.test(setV) && /class="set-vis" data-id="uv" aria-pressed="true" aria-label="UV-Index sichtbar"/.test(setV), (setV.match(/class="set-vis"[^>]*>/g) || []).slice(0, 2).join('\n'));
  H.check('Radar-Blatt: eingebettete Seite mit Nachtzustand und der Versions-Query des Skripts', sb.radarEmbedUrl() === 'radar.html?embed=1&night=0' && (sb.ASSET_VERSION = 'test1', sb.radarEmbedUrl() === 'radar.html?embed=1&night=0&v=test1') && (sb.ASSET_VERSION = '', true), sb.radarEmbedUrl());
  H.check('VoiceOver: Live-Region am Seitenende, Fußzeilen-Trenner stumm, Tage-Knopf mit aria-expanded', idxA.indexOf('id="live"') > idxA.indexOf('</footer>') && (idxA.match(/<span aria-hidden="true"> · <\/span>/g) || []).length === 5 && /<button type="button" class="days-more" id="daysMore" aria-expanded="false">/.test(G(sb,'days').innerHTML));

  /* Rückkanal: Blatt, Senden an den Worker, Antworten, Warteschlange ohne Netz, Metadaten */
  const fbLog = [];
  let fbMode = 'ok';
  const fbFetch = async (url, init) => {
    if (String(url).includes('/feedback')) {
      fbLog.push({ url: String(url), init });
      if (fbMode === 'down') throw new Error('offline');
      if (fbMode === '429') return { ok: false, status: 429, json: async () => ({ error: 'zu viele' }) };
      if (fbMode === '400') return { ok: false, status: 400, json: async () => ({ error: 'ungültig' }) };
      if (fbMode === '500') return { ok: false, status: 500, json: async () => ({ error: 'kaputt' }) };
      return { ok: true, status: 200, json: async () => ({ ok: true, id: 'fb:1' }) };
    }
    return H.okFetch(data)(url);
  };
  const sbB = boot({ fetchImpl: fbFetch, geolocation: granted });
  const FB = id => sbB.document.getElementById(id);
  await wait(300);
  H.check('Rückmeldung: Blatt, Fußzeilen-Link und Hintergrund in index.html', idxA.includes('<div class="sheet fb" id="fb" role="dialog" aria-modal="true" aria-label="Rückmeldung">') && idxA.includes('id="fbBg"') && idxA.includes('id="fbClose"') && idxA.includes('id="fbBody"') && /<button type="button" class="src-link" id="fbLink" aria-haspopup="dialog" aria-expanded="false">Rückmeldung<\/button>/.test(idxA));
  sbB.renderSettings();
  H.check('Rückmeldung: Abschnitt in den Einstellungen mit Knopf', /<section class="set-sec"><h3>Rückmeldung<\/h3>[\s\S]*?id="fbOpen">Rückmeldung schreiben<\/button>/.test(G(sbB,'settingsBody').innerHTML));
  sbB.openFeedback(null);
  const fbHtml = FB('fbBody').innerHTML;
  H.check('Rückmeldung: Blatt mit Art-Chips (Idee vorgewählt), Textfeld, Namensfeld, Senden und Hinweis', sbB.document.body.classList.contains('fb-open') && /class="set-chip fb-kind" data-kind="idee" aria-pressed="true"/.test(fbHtml) && /data-kind="fehler" aria-pressed="false"/.test(fbHtml) && /<textarea id="fbText"[^>]*maxlength="2000"/.test(fbHtml) && /<input[^>]*id="fbName"[^>]*maxlength="40"/.test(fbHtml) && fbHtml.includes('id="fbSend">Senden</button>') && fbHtml.includes('nach 90 Tagen gelöscht') && fbHtml.includes('Kein Ort, keine Koordinaten'), fbHtml.slice(0, 300));
  H.check('Rückmeldung: Fußnote und Einstellungen nennen Gerät und Browser, weil der User-Agent mitgeht', fbHtml.includes('Mitgeschickt werden App-Version, Gerät und Browser (User-Agent), Bildschirmbreite') && G(sbB,'settingsBody').innerHTML.includes('Mitgeschickt werden nur Version, Gerät und Browser, kein Ort.'), fbHtml.slice(fbHtml.indexOf('Mitgeschickt'), fbHtml.indexOf('Mitgeschickt') + 90));
  FB('fbText').value = 'Hi';
  await sbB.sendFeedback();
  H.check('Rückmeldung: zu kurzer Text wird nicht gesendet', fbLog.length === 0 && FB('fbMsg').textContent === 'Bitte ein paar Worte mehr.', FB('fbMsg').textContent);
  FB('fbText').value = 'Der Regenbalken ist mir zu klein.';
  FB('fbName').value = 'Anna';
  sbB.setFeedbackKind('fehler');
  await sbB.sendFeedback();
  const sent1 = fbLog.length ? JSON.parse(fbLog[0].init.body) : null;
  const fbState = JSON.parse(sbB._store['wetter:feedback'] || '{}');
  H.check('Rückmeldung: Senden schickt Text, Art, Name, Kennung und Metadaten; Dank, Name gemerkt, Feld geleert', fbLog.length === 1 && fbLog[0].url.endsWith('/feedback') && fbLog[0].init.method === 'POST' && sent1 && sent1.text === 'Der Regenbalken ist mir zu klein.' && sent1.kind === 'fehler' && sent1.name === 'Anna' && /^[a-z0-9]{16}$/.test(sent1.id) && sent1.id === fbState.id && typeof sent1.meta.ua === 'string' && sent1.meta.ts === new Date(H.TEST_NOW).toISOString() && sent1.meta.view === 'overview' && typeof sent1.meta.standalone === 'boolean' && FB('fbMsg').textContent === 'Danke, angekommen.' && FB('fbText').value === '' && fbState.name === 'Anna' && G(sbB,'live').textContent === 'Rückmeldung gesendet.', JSON.stringify(sent1) + ' | ' + FB('fbMsg').textContent);
  fbMode = '429';
  FB('fbText').value = 'Noch eine Idee für die Stundenleiste.';
  await sbB.sendFeedback();
  H.check('Rückmeldung: 429 vom Worker wird erklärt, Text bleibt stehen', FB('fbMsg').textContent === 'Höchstens fünf Rückmeldungen pro Stunde, bitte später noch einmal.' && FB('fbText').value !== '', FB('fbMsg').textContent);
  fbMode = 'down';
  await sbB.sendFeedback();
  const queued = JSON.parse(sbB._store['wetter:feedback']).queue;
  H.check('Rückmeldung: ohne Netz gespeichert, Hinweis auf den nächsten Start, Feld geleert', queued.length === 1 && queued[0].text === 'Noch eine Idee für die Stundenleiste.' && FB('fbMsg').textContent === 'Kein Netz. Die Rückmeldung ist gespeichert und wird beim nächsten Start gesendet.' && FB('fbText').value === '', FB('fbMsg').textContent + ' ' + queued.length);
  fbMode = 'ok'; const fbBefore = fbLog.length;
  await sbB.flushFeedbackQueue();
  H.check('Rückmeldung: Warteschlange wird nachgeschickt und geleert', fbLog.length === fbBefore + 1 && JSON.parse(sbB._store['wetter:feedback']).queue.length === 0 && JSON.parse(fbLog[fbBefore].init.body).text === 'Noch eine Idee für die Stundenleiste.', fbLog.length - fbBefore);
  // Serverfehler (5xx) warten auf später; 4xx außer 429 ist ein Fehler der Nachricht, der Text bleibt zum Prüfen stehen
  fbMode = '500';
  FB('fbText').value = 'Der Worker stolpert gerade.';
  await sbB.sendFeedback();
  const q500 = JSON.parse(sbB._store['wetter:feedback']).queue;
  H.check('Rückmeldung: 5xx vom Worker reiht ein und sagt „später erneut“, Feld geleert', q500.length === 1 && q500[0].text === 'Der Worker stolpert gerade.' && FB('fbMsg').textContent === 'Der Worker antwortet gerade nicht. Die Rückmeldung ist gespeichert und wird später erneut gesendet.' && FB('fbText').value === '', FB('fbMsg').textContent + ' ' + q500.length);
  fbMode = '400';
  FB('fbText').value = 'Abgelehnter Text.';
  await sbB.sendFeedback();
  H.check('Rückmeldung: 400 vom Worker wird als Fehler gezeigt, nicht eingereiht, Text bleibt stehen', JSON.parse(sbB._store['wetter:feedback']).queue.length === 1 && FB('fbMsg').textContent === 'Der Worker hat die Rückmeldung abgelehnt (HTTP 400), bitte den Text prüfen.' && FB('fbText').value === 'Abgelehnter Text.', FB('fbMsg').textContent);
  // Beim Nachschicken verworfene Einträge werden angesagt und beim nächsten Öffnen des Blatts gezeigt
  await sbB.flushFeedbackQueue();
  H.check('Rückmeldung: vom Worker abgelehnter Wartelisteneintrag wird verworfen und gemeldet', JSON.parse(sbB._store['wetter:feedback']).queue.length === 0 && JSON.parse(sbB._store['wetter:feedback']).dropped === 1 && G(sbB,'live').textContent === '1 gespeicherte Rückmeldung hat der Worker abgelehnt, sie wurde verworfen.', G(sbB,'live').textContent);
  sbB.openFeedback(null);
  H.check('Rückmeldung: Hinweis auf die verworfene Rückmeldung im Blatt, danach gelöscht', FB('fbBody').innerHTML.includes('<div class="fb-msg">1 gespeicherte Rückmeldung hat der Worker abgelehnt, sie wurde verworfen.</div>') && !JSON.parse(sbB._store['wetter:feedback']).dropped, FB('fbBody').innerHTML.slice(FB('fbBody').innerHTML.indexOf('fb-msg'), FB('fbBody').innerHTML.indexOf('fb-msg') + 120));
  fbMode = 'ok';
  sbB.closeFeedback();
  H.check('Rückmeldung: Schließen entfernt die Klasse', !sbB.document.body.classList.contains('fb-open'));
  H.check('Rückmeldung: letzter Fehlertext wandert in die Metadaten', /nicht geladen werden|Keine Verbindung/.test(sbF.feedbackMeta().lastError) && sbB.feedbackMeta().lastError === '', sbF.feedbackMeta().lastError);
  H.check('Rückmeldung: Blatt über den Einstellungen, für Vorleser unsichtbar bis geöffnet', /#fbBg \{ z-index: 58; \}/.test(css) && /\.sheet\.fb \{ z-index: 59; \}/.test(css) && /body\.fb-open #fb \{ transform: none; \}/.test(css) && /body\.fb-open #fbBg \{ opacity: 1; pointer-events: auto; \}/.test(css) && /\.sheet\.fb input \{ padding-left: 14px; background-image: none; \}/.test(css));

  const sbSV = boot({ fetchImpl: H.okFetch(data), geolocation: granted, storage: { 'wetter:view': 'wind', 'wetter:settings': JSON.stringify({ startView: 'rain', motion: 'reduce' }) } });
  await wait(300);
  sbSV.document.documentElement = H.el(); sbSV.applySettings();
  H.check('Einstellungen: Startansicht überstimmt die gespeicherte Ansicht, Bewegung beim Start aus dem Speicher', sbSV.currentView() === 'rain' && sbSV.document.documentElement.classList.contains('reduce') && G(sbSV,'views').innerHTML.includes('data-view="rain" aria-pressed="true"'), sbSV.currentView());
  H.finish();
})();
