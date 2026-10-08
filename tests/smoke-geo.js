// Standort-Szenarien: Ablehnung -> Ortssuche; Suche wählt Ort; GPS-Button zurück;
// gemerkte Position bei Ablehnung; Offline mit/ohne Cache; fehlende Luftdaten.
const H = require('./harness');
const fs = require('fs');

const fc = H.mockForecast();
const data = { fc, ens: H.mockEnsemble(fc), md: H.mockModels(), air: H.mockAir(), geo: H.mockGeocode(),
               place: { city: 'München', principalSubdivision: 'Bayern' } };
const denied = { getCurrentPosition: (ok, err) => err({ code: 1, message: 'denied' }) };
const granted = { getCurrentPosition: ok => ok({ coords: { latitude: 48.137, longitude: 11.575 } }) };
const pos = JSON.stringify({ lat: 48.137, lon: 11.575, name: 'München, Bayern' });
const wait = ms => new Promise(r => setTimeout(r, ms));
// Cache-Schlüssel exakt wie in der App gebildet (toFixed rundet 11.575 -> 11.57)
const LOC_KEY = 'wetter:loc:' + (48.137).toFixed(2) + ',' + (11.575).toFixed(2);

(async () => {
  // 1) Ablehnung ohne gemerkte Position -> Hinweis + Suche-Button
  const sb1 = H.makeSandbox({ fetchImpl: H.okFetch(data), geolocation: denied });
  sb1.initWeatherApp();
  await wait(250);
  const n1 = sb1._nodes;
  H.check('Abgelehnt: Banner sichtbar', !n1.error.classList.contains('hidden'));
  H.check('Abgelehnt: Einstellungs-Tipp', n1.error.innerHTML.includes('Ortungsdienste'));
  H.check('Abgelehnt: Suche-Button statt Lignano', n1.error.innerHTML.includes('geoSearch') && !/lignano/i.test(n1.error.innerHTML), n1.error.innerHTML);
  sb1._dyn.geoSearch.trigger('click');
  H.check('Suche-Button fokussiert das Suchfeld', n1.placeSearch.focused === true);

  // 2) Ortssuche: Eingabe -> Ergebnisse -> Auswahl -> Laden im Such-Modus
  n1.placeSearch.value = 'Hamb';
  n1.placeSearch.trigger('input');
  await wait(500);
  const results = n1.placeResults.innerHTML;
  H.check('Suche: zwei Treffer gelistet', (results.match(/class="place"/g) || []).length === 2, results);
  H.check('Suche: Treffer mit Region und Land', results.includes('Hamburg, Hamburg · Deutschland'));
  H.check('Suche: Liste sichtbar', !n1.placeResults.classList.contains('hidden'));
  H.check('Suche: Geocoding mit Sprache de', sb1._fetchLog.some(u => u.includes('geocoding-api') && u.includes('language=de')));

  n1.placeResults._buttons[0].trigger('click');
  await wait(200);
  H.check('Suche: Kopfzeile zeigt gesuchten Ort', n1.subline.textContent.includes('🔍 Hamburg, Hamburg · Deutschland'), n1.subline.textContent);
  H.check('Suche: Daten für Hamburg geladen', n1.now.innerHTML.includes('17°') && sb1._fetchLog.some(u => u.includes('latitude=53.55')));
  H.check('Suche: Banner weg, Liste zu, Feld leer', n1.error.classList.contains('hidden') && n1.placeResults.classList.contains('hidden') && n1.placeSearch.value === '');
  H.check('Suche: GPS-Button eingeblendet', !n1.gpsBtn.classList.contains('hidden'));
  H.check('Suche: Position NICHT als GPS gespeichert', !sb1._store['wetter:pos']);

  // Zurück zu GPS -> ohne gemerkte Position und weiterhin abgelehnt: Banner wieder da
  n1.gpsBtn.trigger('click');
  await wait(150);
  H.check('GPS-Button: Ablehnungs-Banner erneut', !n1.error.classList.contains('hidden') && n1.error.innerHTML.includes('Ortungsdienste'));

  // 3) Ablehnung MIT gemerkter Position -> still laden, kein Banner
  const sb3 = H.makeSandbox({ fetchImpl: H.okFetch(data), storage: { 'wetter:pos': pos }, geolocation: denied });
  sb3.initWeatherApp();
  await wait(250);
  const n3 = sb3._nodes;
  H.check('Gemerkte Position: Daten gerendert', n3.now.innerHTML.includes('17°'));
  H.check('Gemerkte Position: Name aus Speicher', n3.subline.textContent.includes('📍 München, Bayern'), n3.subline.textContent);
  H.check('Gemerkte Position: kein Banner', n3.error.classList.contains('hidden'));
  H.check('Cache unter loc-Key gespeichert', Object.keys(sb3._store).some(k => k === LOC_KEY), Object.keys(sb3._store));

  // 4) Offline ohne Cache -> Fehlerbanner
  const sb4 = H.makeSandbox({ storage: { 'wetter:pos': pos }, geolocation: denied });
  sb4.initWeatherApp();
  await wait(250);
  H.check('Offline ohne Cache: Fehlerbanner', /konnten nicht geladen werden/.test(sb4._nodes.error.textContent), sb4._nodes.error.textContent);

  // 5) Offline mit Cache -> stale-Banner, alle Karten
  const payload = JSON.parse(fs.readFileSync(__dirname + '/payload.json', 'utf8'));
  const cached = JSON.stringify({ savedAt: '2026-09-25T12:00:00.000Z', payload });
  const sb5 = H.makeSandbox({ storage: { 'wetter:pos': pos, [LOC_KEY]: cached }, geolocation: denied });
  sb5.initWeatherApp();
  await wait(250);
  const n5 = sb5._nodes;
  H.check('Offline mit Cache: stale-Banner', !n5.stale.classList.contains('hidden'));
  H.check('Offline mit Cache: alle Karten inkl. Trend/Luft', n5.trend.innerHTML.includes('<svg') && n5.air.innerHTML.includes('aqi-val'));
  H.check('Offline mit Cache: Stand aus Cache', n5.updated.textContent.includes('25.09'), n5.updated.textContent);

  // 6) Luftqualität nicht verfügbar -> Hinweis, Rest rendert
  const sb6 = H.makeSandbox({ fetchImpl: H.okFetch(Object.assign({}, data, { air: null })), geolocation: granted });
  sb6.initWeatherApp();
  await wait(250);
  H.check('Ohne Luftdaten: Hinweis statt Absturz', sb6._nodes.air.innerHTML.includes('nicht verfügbar') && sb6._nodes.now.innerHTML.includes('17°'), sb6._nodes.air.innerHTML);

  // 7) Neuer Ort per GPS -> Name wird nachgeladen, Position aktualisiert
  const sb7 = H.makeSandbox({ fetchImpl: H.okFetch(data), storage: { 'wetter:pos': JSON.stringify({ lat: 52.52, lon: 13.4, name: 'Berlin' }) }, geolocation: granted });
  sb7.initWeatherApp();
  await wait(250);
  H.check('Ortswechsel: Name per Reverse-Geocoding erneuert', sb7._nodes.subline.textContent.includes('München, Bayern'), sb7._nodes.subline.textContent);
  H.check('Ortswechsel: neue Position gespeichert', (sb7._store['wetter:pos'] || '').includes('48.137'));

  H.finish();
})();
