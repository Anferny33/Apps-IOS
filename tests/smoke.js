// Vollständiges Rendering mit GPS-Position: alle Karten inkl. neuer Inhalte.
const H = require('./harness');

const fc = H.mockForecast();
const data = { fc, ens: H.mockEnsemble(fc), md: H.mockModels(), air: H.mockAir(),
               place: { city: 'München', principalSubdivision: 'Bayern', countryName: 'Deutschland' } };

const sb = H.makeSandbox({
  fetchImpl: H.okFetch(data),
  geolocation: { getCurrentPosition: ok => ok({ coords: { latitude: 48.137, longitude: 11.575 } }) }
});
sb.initWeatherApp();

setTimeout(() => {
  const n = sb._nodes;
  H.check('Kopfzeile: Ortsname per Reverse-Geocoding', n.subline.textContent.includes('📍 München, Bayern'), n.subline.textContent);
  H.check('Kopfzeile: kein Lignano-Bezug', !/Lignano/i.test(n.subline.textContent));
  H.check('Position gespeichert (wetter:pos)', (sb._store['wetter:pos'] || '').includes('München'), sb._store['wetter:pos']);
  H.check('GPS-Button versteckt im GPS-Modus', n.gpsBtn.classList.contains('hidden'));

  H.check('Aktuell: Temperatur', n.now.innerHTML.includes('17°'), n.now.innerHTML);
  H.check('Aktuell: Tagesspanne aus daily[0]', /now-range">Heute <span class="hi">↑ 18°<\/span> <span class="lo">↓ 8°<\/span>/.test(n.now.innerHTML), n.now.innerHTML.match(/now-range[^<]*<[^>]*>[^<]*/));
  H.check('Aktuell: Wind mit Richtung, Luftdruck, Bewölkung', /aus <b>SW<\/b>/.test(n.now.innerHTML) && n.now.innerHTML.includes('1018 hPa') && n.now.innerHTML.includes('55 %'), n.now.innerHTML);

  H.check('Nowcast: Regenbeginn 14:45 (Wert um 15:00 = Intervall 14:45–15:00)', /Regen ab ca\. 14:45 Uhr \(in 30 Minuten\)/.test(n.nowcast.innerHTML), n.nowcast.innerHTML.match(/Regen ab[^<]*/));
  H.check('Nowcast: Fenster beginnt nach jetzt (erste Säule 14:15, letzte 18:00)', n.nowcast.innerHTML.includes('title="14:15 ·') && n.nowcast.innerHTML.includes('title="18:00 ·') && !n.nowcast.innerHTML.includes('title="14:00 ·'), n.nowcast.innerHTML.match(/title="[^"]*"/g).slice(0, 2));

  const t = n.tempchart.innerHTML;
  H.check('Temp-Chart: SVG mit beiden Linien', t.includes('<svg') && t.includes('stroke="#b8821a"') && t.includes('stroke="#3d94e0"'));
  H.check('Temp-Chart: Min/Max-Labels', (t.match(/font-weight="600" fill="#eaf1fb">-?\d+°/g) || []).length === 2, t.match(/fill="#eaf1fb">-?\d+°/g));
  H.check('Temp-Chart: Legende', t.includes('Temperatur') && t.includes('gefühlt'));

  const s = n.sun.innerHTML;
  H.check('Sonne: Auf-/Untergang', s.includes('07:12') && s.includes('19:05'), s.slice(0, 300));
  H.check('Sonne: Tageslänge', s.includes('11 h 53 min'), s.match(/\d+ h \d+ min/g));
  H.check('UV: Stufe mit Symbol + Wort', /st warning">🟡 mittel/.test(s), s.match(/st \w+">[^<]*/g));
  H.check('Wind: Richtungspfeil + Böen', s.includes('rotate(225deg)') && s.includes('Böen bis 25 km/h'));
  const w = n.windchart.innerHTML;
  H.check('Windverlauf: Chart mit Wind + Böen', w.includes('stroke="#27a07a"') && w.includes('stroke="#8f7fd6"') && w.includes('Böen km/h'), w.slice(0, 200));
  H.check('Windverlauf: Nulllinie (zeroBase)', w.includes('>0<'), w.match(/>\d+</g));

  const hourCols = (n.hourly.innerHTML.match(/class="hour(?:"| )/g) || []).length;
  H.check('Stündlich: 48 Spalten', hourCols === 48, hourCols);
  H.check('Stündlich: Ensemble genutzt', n.hourlyNote.textContent.includes('ICON-D2-Ensemble'));

  H.check('7 Tage: genau 7 Zeilen trotz 14 Tagen Daten', (n.daily.innerHTML.match(/class="day"/g) || []).length === 7);
  H.check('7 Tage: Range-Balken', (n.daily.innerHTML.match(/class="day-range"/g) || []).length === 7);

  const tr = n.trend.innerHTML;
  H.check('Trend: SVG vorhanden', tr.includes('<svg'), tr.slice(0, 120));
  H.check('Trend: 14 Temperaturbalken', (tr.match(/fill="#b8821a"/g) || []).length === 14, (tr.match(/fill="#b8821a"/g) || []).length);
  H.check('Trend: Regensäulen nur an Regentagen (8)', (tr.match(/fill="#3d94e0"/g) || []).length === 8, (tr.match(/fill="#3d94e0"/g) || []).length);
  H.check('Trend: Heute + Wochentage', tr.includes('>Heute<') && tr.includes('>Sa<'));
  H.check('Trend: Legende', tr.includes('Temperaturspanne') && tr.includes('Niederschlag'));

  const a = n.air.innerHTML;
  H.check('Luft: AQI-Wert + Stufe', a.includes('aqi-val">34<') && /st good">🟢 mäßig/.test(a), a.slice(0, 300));
  H.check('Luft: Schadstoff-Chips', a.includes('PM2,5 <b>8 µg/m³') && a.includes('Ozon <b>62'));
  H.check('Pollen: Gräser mäßig mit Tagesmax', /Gräser[\s\S]*?🟡 mäßig[\s\S]*?7 · max\. 15 \/m³/.test(a), a.match(/Gräser[\s\S]{0,300}/));
  H.check('Pollen: Beifuß hoch (12 bei Schwellen 3/10/30)', /Beifuß[\s\S]*?🟠 hoch/.test(a), a.match(/Beifuß[\s\S]{0,200}/));
  H.check('Pollen: Birke keine', /Birke[\s\S]*?⚪ keine/.test(a));

  H.check('Modelle: 5 Zeilen (ARPEGE fehlt korrekt)', (n.models.innerHTML.match(/<tr><td class="model"/g) || []).length === 5);
  H.check('Modelle: UKMO dabei, ICON-2I nicht', n.models.innerHTML.includes('UKMO') && !n.models.innerHTML.includes('ICON-2I'));
  H.check('Stand-Zeile gesetzt', n.updated.textContent.startsWith('Stand:'));
  H.check('Forecast mit 14 Tagen + Luftqualität abgefragt', sb._fetchLog.some(u => u.includes('forecast_days=14')) && sb._fetchLog.some(u => u.includes('air-quality')));

  // Niederschlagsrate: 1 mm im 15-min-Intervall = 4 mm/h
  const fcRate = H.mockForecast(); fcRate.current.precipitation = 1.0; fcRate.current.interval = 900;
  const sbR = H.makeSandbox({ fetchImpl: H.okFetch(Object.assign({}, data, { fc: fcRate })),
    geolocation: { getCurrentPosition: ok => ok({ coords: { latitude: 48.137, longitude: 11.575 } }) } });
  sbR.initWeatherApp();
  // Gespeicherte Position Hamburg, GPS meldet München: zweites Laden darf nicht verschluckt werden
  const sbG = H.makeSandbox({ fetchImpl: H.okFetch(data),
    geolocation: { getCurrentPosition: ok => ok({ coords: { latitude: 48.137, longitude: 11.575 } }) },
    storage: { 'wetter:pos': JSON.stringify({ lat: 53.55, lon: 9.99, name: 'Hamburg' }) } });
  sbG.initWeatherApp();
  // Ortswechsel schlägt fehl: alte Daten dürfen nicht unter dem neuen Namen stehen bleiben
  const geo = { results: [{ name: 'Hamburg', admin1: 'Hamburg', country: 'Deutschland', latitude: 53.55, longitude: 9.99 }] };
  const failHH = async (url) => { if (url.includes('latitude=53.55')) throw new Error('offline'); return H.okFetch(Object.assign({}, data, { geo }))(url); };
  const sbF = H.makeSandbox({ fetchImpl: failHH, geolocation: { getCurrentPosition: ok => ok({ coords: { latitude: 48.137, longitude: 11.575 } }) } });
  sbF.initWeatherApp();
  setTimeout(() => {
    H.check('Aktuell: Niederschlagsrate aus Intervallmenge (1 mm / 15 min = 4,0 mm/h)', sbR._nodes.now.innerHTML.includes('<b>4,0 mm/h</b>'), sbR._nodes.now.innerHTML.match(/Niederschlag jetzt[^<]*<b>[^<]*/));
    const fcUrls = sbG._fetchLog.filter(u => u.includes('api.open-meteo.com/v1/forecast') && !u.includes('models='));
    H.check('Klassisch: Ortswechsel beim Start nachgeladen, Cache nur für den richtigen Ort', fcUrls.length === 2 && fcUrls[1].includes('latitude=48.137') && !Object.keys(sbG._store).some(k => k.includes('53.55')) && sbG._nodes.subline.textContent.includes('München'), fcUrls.map(u => u.match(/latitude=[\d.]+/)[0]) + ' ' + Object.keys(sbG._store));
    sbF._nodes.placeSearch.value = 'Hamb'; sbF._nodes.placeSearch.trigger('input');
    setTimeout(() => {
      sbF._nodes.placeResults._buttons[0].trigger('click');
      setTimeout(() => {
        H.check('Klassisch: Fehlgeschlagener Ortswechsel leert die alten Daten', !sbF._nodes.now.innerHTML.includes('17°') && sbF._nodes.now.innerHTML.includes('keine Daten') && !sbF._nodes.error.classList.contains('hidden') && sbF._nodes.subline.textContent.includes('Hamburg'), sbF._nodes.now.innerHTML.slice(0, 120) + ' | ' + sbF._nodes.subline.textContent);
        finish();
      }, 300);
    }, 500);
  }, 300);
  function finish() {
  if (process.env.DUMP) {
    require('fs').writeFileSync(__dirname + '/payload.json', JSON.stringify({ fc, ens: data.ens, md: data.md, air: data.air }));
    require('fs').writeFileSync(__dirname + '/render.json', JSON.stringify({
      tempchart: n.tempchart.innerHTML, sun: n.sun.innerHTML, windchart: n.windchart.innerHTML,
      daily: n.daily.innerHTML, trend: n.trend.innerHTML, air: n.air.innerHTML, now: n.now.innerHTML
    }));
  }
  H.finish();
  }
}, 300);
