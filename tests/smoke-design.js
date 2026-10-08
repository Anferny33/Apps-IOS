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
  H.check('Hinweis-Feld: Nowcast (Regen ab 15:00) + Schirm', !G(sb,'insight').classList.contains('hidden') && G(sb,'insight').innerHTML.includes('Regen ab ca. 15:00 Uhr') && G(sb,'insight').innerHTML.includes('Schirm'), G(sb,'insight').innerHTML);
  H.check('Hero: SVG-Icon statt Emoji', hero.includes('<svg class="big-icon'));
  H.check('Hinweis bei Regen: Schirm mit Dach- und Tropfen-Ebene', G(sb,'insight').innerHTML.includes('<svg class="umb"') && G(sb,'insight').innerHTML.includes('class="umb-canopy"') && G(sb,'insight').innerHTML.includes('class="umb-drops"'));

  const wn = G(sb,'warnings').innerHTML;
  const dwdUrl = sb._fetchLog.find(u => u.includes('maps.dwd.de')) || '';
  H.check('Warnungen: DWD-WFS mit Punkt in Breite/Länge-Reihenfolge abgefragt', decodeURIComponent(dwdUrl).replace(/\+/g, ' ').includes('INTERSECTS(THE_GEOM,POINT(48.137 11.575))') && dwdUrl.includes('typeName=dwd%3AWarnungen_Gemeinden'), decodeURIComponent(dwdUrl));
  H.check('Warnungen: Feld sichtbar, 3 Einträge (2 DWD aktiv + 1 NINA; DWD-Doppelung aus NINA weg)', !G(sb,'warnings').classList.contains('hidden') && (wn.match(/<details class="field warn/g) || []).length === 3 && !wn.includes('FROST'), wn.slice(0, 200));
  H.check('Warnungen: Stufe 2 zuerst, dabei NINA vor DWD', /^<details class="field warn lvl-2 nina"/.test(wn) && wn.indexOf('lvl-2 nina') < wn.indexOf('lvl-2"') && wn.indexOf('lvl-2"') < wn.indexOf('lvl-1'), wn.slice(0, 60));
  H.check('NINA: Katastrophenschutz-Zeile, Umbrüche, Quelle', wn.includes('Katastrophenschutz · seit') && wn.includes('Rauchentwicklung.<br>Betroffen') && wn.includes('class="instr">Fenster und Türen schließen.<br>Lüftung') && wn.includes('über NINA (warnung.bund.de) · Stadt München'), wn.match(/Katastrophenschutz[^<]*/));
  const ninaUrl = sb._fetchLog.find(u => u.includes('/nina?')) || '';
  H.check('NINA: Proxy mit Koordinaten abgefragt', ninaUrl.endsWith('/nina?lat=48.137&lon=11.575'), ninaUrl);
  H.check('Warnungen: bevorstehende mit "ab … bis …", Hinweis + Quelle', /Wetterwarnung · ab \S+ Uhr bis \S+ Uhr/.test(wn) && wn.includes('class="instr">Lose Gegenstände sichern.') && wn.includes('Quelle: Deutscher Wetterdienst · Stadt München'), wn.match(/Wetterwarnung · [^<]*/));

  const hh = G(sb,'hourly').innerHTML;
  H.check('Stunden: 48 Spalten', (hh.match(/class="hcol/g) || []).length === 48, (hh.match(/class="hcol/g) || []).length);
  H.check('Stunden: 48 Temperaturen', (hh.match(/class="v">-?\d+°</g) || []).length === 48, (hh.match(/class="v">-?\d+°</g) || []).length);
  H.check('Stunden: "Jetzt" dunkel, Regenstunden blau', hh.startsWith('<div class="strip"><div class="strip-inner"><div class="hcol now') && /class="hcol[^"]* wet"/.test(hh), hh.slice(0, 80));
  H.check('Stunden: "Jetzt" und Tageswechsel', hh.includes('>Jetzt<') && hh.includes('hcol newday'));
  H.check('Stunden: Ensemble-Wahrscheinlichkeiten', /class="p">\d+%/.test(hh));
  H.check('Stunden: Wahrscheinlichkeit in allen 48 Spalten (auch unter 10 %)', (hh.match(/class="p">\d+%/g) || []).length === 48, (hh.match(/class="p">\d+%/g) || []).length);

  const ncBars = [...G(sb,'nowcast').innerHTML.matchAll(/<i class="[^"]*" data-stagger="([\d.]+)s" style="height:\d+%;animation-delay:([\d.]+)s"/g)];
  H.check('Nowcast: 16 Balken mit aufsteigender Staffelung (Aufbau-Animation)', ncBars.length === 16 && ncBars.every((m, i) => i === 0 || (+m[2] > +ncBars[i-1][2] && +m[1] > +ncBars[i-1][1])), ncBars.length + ' ' + ncBars.slice(0,3).map(m => m[2]).join(','));
  H.check('Nowcast-Karte sichtbar (Regen in 4 h)', !G(sb,'nowcastCard').classList.contains('hidden') && (G(sb,'nowcast').innerHTML.match(/<i /g) || []).length === 16, G(sb,'nowcast').innerHTML.slice(0, 120));

  const dd = G(sb,'days').innerHTML;
  H.check('Tage: 14 Zeilen', (dd.match(/class="drow/g) || []).length === 14, (dd.match(/class="drow/g) || []).length);
  H.check('Tage: 7 sichtbar, 7 aufklappbar', (dd.match(/ more"/g) || []).length === 7 && dd.includes('Weitere 7 Tage'), (dd.match(/ more"/g) || []).length);
  H.check('Tage: Heute mit Jetzt-Punkt', /Heute[\s\S]*?<b style="left:/.test(dd));
  H.check('Tage: Spannen auf gemeinsamer Skala', (dd.match(/<i style="left:/g) || []).length === 14);
  H.check('Tage: Wahrscheinlichkeit auch unter 10 % (5 %, 0 %)', dd.includes('"pp">5%') && dd.includes('"pp">0%'), dd.match(/"pp">[^<]*/g));

  const det = G(sb,'details').innerHTML;
  H.check('Details: 8 Kacheln (6 + Luft + Pollen)', (det.match(/class="tile /g) || []).length === 8, (det.match(/class="tile /g) || []).length);
  H.check('Details: UV-Kachel mit Stufe + Maximum', det.includes('class="tile uv"') && det.includes('UV-Index') && det.includes('mittel') && det.includes('Maximum heute'));
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

  // 4) Offline mit Cache
  const payload = { fc, ens: data.ens, md: data.md, air: data.air };
  const LOC_KEY = 'wetter:loc:' + (48.137).toFixed(2) + ',' + (11.575).toFixed(2);
  const sb5 = boot({ storage: { 'wetter:pos': JSON.stringify({ lat: 48.137, lon: 11.575, name: 'München' }),
                                [LOC_KEY]: JSON.stringify({ savedAt: '2026-10-08T06:00:00.000Z', payload }) }, geolocation: denied });
  await wait(300);
  H.check('Offline: Cache gerendert + Hinweis', G(sb5,'hero').innerHTML.includes('17°') && G(sb5,'banner').innerHTML.includes('zuletzt gespeicherten'), G(sb5,'banner').innerHTML);

  if (process.env.DUMP) {
    fs.writeFileSync(__dirname + '/render-design.json', JSON.stringify({
      theme: [...body.classList.c].join(' '), hero: G(sb,'hero').innerHTML, warnings: G(sb,'warnings').innerHTML, insight: G(sb,'insight').innerHTML, hourly: G(sb,'hourly').innerHTML, nowcast: G(sb,'nowcast').innerHTML,
      days: G(sb,'days').innerHTML, details: G(sb,'details').innerHTML, models: G(sb,'models').innerHTML
    }));
  }
  H.finish();
})();
