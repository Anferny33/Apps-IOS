// Regen-Alarm: Web-Push-Verschlüsselung (RFC 8291) und VAPID (RFC 8292) im Rundlauf prüfen,
// Regel für den Alarm, die Push-, NINA- und Feedback-Routen des Workers mit KV-Stub, dazu der echte
// Worker-Host und die Datenschicht (wetter-core.js) für NINA-Ablauf, Schalter und Einstellungen.
const H = require('./harness');
const { check, finish } = H;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const te = new TextEncoder(), td = new TextDecoder();

(async () => {
  const wp = await import(pathToFileURL(path.join(__dirname, '..', 'proxy', 'src', 'webpush.js')).href);
  const worker = await import(pathToFileURL(path.join(__dirname, '..', 'proxy', 'src', 'worker.js')).href);

  // Echter Worker-Host: NINA_PROXY in wetter-core.js zeigt auf den Worker aus wrangler.toml unter workers.dev;
  // README.md nennt dieselbe Adresse, proxy/README.md den Host mit dem Platzhalter <konto> für das Cloudflare-Konto
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  /* Die feste Adresse ist der letzte https-String der Zeile (Rückfall, wenn window.NINA_PROXY keine Zeichenkette ist) */
  const proxyUrl = (read('wetter-core.js').match(/const NINA_PROXY = [^\n]*"(https:\/\/[^"]+)"/) || [])[1] || '';
  const workerName = (read(path.join('proxy', 'wrangler.toml')).match(/^name = "([\w-]+)"/m) || [])[1] || '';
  const host = proxyUrl.replace(/^https:\/\//, '');
  check('Worker-Host: NINA_PROXY zeigt per https auf den Worker aus wrangler.toml unter workers.dev, ohne Pfad', workerName !== '' && /^[\w-]+\.[\w-]+\.workers\.dev$/.test(host) && host.startsWith(workerName + '.'), proxyUrl + ' | ' + workerName);
  check('Worker-Host: README.md nennt dieselbe Adresse, proxy/README.md den Host (mit Konto-Platzhalter)', read('README.md').includes(proxyUrl) && (read(path.join('proxy', 'README.md')).includes(proxyUrl) || read(path.join('proxy', 'README.md')).includes('https://' + workerName + '.<konto>.workers.dev')), proxyUrl);

  // Abonnent (Browser-Seite) mit eigenem Schlüsselpaar und auth-Geheimnis
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub = { endpoint: 'https://web.push.apple.com/QAbc123', keys: { p256dh: wp.b64url(uaPub), auth: wp.b64url(auth) } };
  const payload = JSON.stringify({ title: 'Regen ab 16:30 Uhr', body: 'Lignano: gegen 16:30 Uhr fängt es an zu regnen, etwa 1,2 mm in der nächsten Stunde.' });
  const body = await wp.encryptPayload(sub, payload);
  // Kopf lesen und wie der Browser entschlüsseln
  const salt = body.slice(0, 16), rs = (body[16] << 24 | body[17] << 16 | body[18] << 8 | body[19]) >>> 0, idlen = body[20], asPub = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const k = await wp.deriveKeys(uaPub, asPub, shared, auth, salt);
  const aes = await crypto.subtle.importKey('raw', k.cek, 'AES-GCM', false, ['decrypt']);
  let plain = null;
  try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: k.nonce }, aes, cipher)); } catch (e) { plain = null; }
  check('Verschlüsselung: Kopf nach RFC 8291 (Salz 16, rs 4096, Senderschlüssel 65 Bytes)', rs === 4096 && idlen === 65 && asPub[0] === 4, rs + '/' + idlen);
  check('Verschlüsselung: der Abonnent entschlüsselt die Nachricht, Padding-Trenner 0x02 am Ende', !!plain && plain[plain.length - 1] === 2 && td.decode(plain.slice(0, -1)) === payload, plain ? td.decode(plain) : 'keine Entschlüsselung');
  const body2 = await wp.encryptPayload(sub, payload);
  check('Verschlüsselung: jede Nachricht mit frischem Salz und Senderschlüssel', wp.b64url(body2.slice(0, 16)) !== wp.b64url(salt) && wp.b64url(body2.slice(21, 86)) !== wp.b64url(asPub));

  // VAPID: Schlüsselpaar erzeugen, Kopf bauen, Signatur mit dem öffentlichen Schlüssel prüfen
  const vk = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const vPub = wp.b64url(new Uint8Array(await crypto.subtle.exportKey('raw', vk.publicKey)));
  const vD = (await crypto.subtle.exportKey('jwk', vk.privateKey)).d;
  const hdr = await wp.vapidAuth(sub.endpoint, vPub, vD, 'mailto:test@example.org', 1800000000);
  const m = hdr.match(/^vapid t=([^,]+), k=(.+)$/);
  const parts = m ? m[1].split('.') : [];
  const claims = parts.length === 3 ? JSON.parse(td.decode(wp.fromB64url(parts[1]))) : {};
  const okSig = parts.length === 3 && await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk.publicKey, wp.fromB64url(parts[2]), te.encode(parts[0] + '.' + parts[1]));
  check('VAPID: Kopf mit JWT, Zielherkunft, Absender, Ablauf und gültiger ES256-Signatur', okSig && m[2] === vPub && claims.aud === 'https://web.push.apple.com' && claims.sub === 'mailto:test@example.org' && claims.exp === 1800000000, hdr.slice(0, 80));
  check('VAPID: base64url ohne Füllzeichen, Rückweg identisch', !/[+/=]/.test(vPub) && wp.b64url(wp.fromB64url(vPub)) === vPub);
  const hdrNl = await wp.vapidAuth(sub.endpoint, vPub + '\n', vD + '\n', 'mailto:test@example.org', 1800000000);
  check('VAPID: Zeilenumbruch am Schlüssel (vom Hochladen) stört nicht', hdrNl.endsWith(', k=' + vPub) && hdrNl.split('.').length === 3, hdrNl.slice(-50));

  // Alarmregel auf 15-Minuten-Werten: Regen in der nächsten Stunde, jetzt trocken
  /* Zeitstempel der Vorhersage sind Ortszeit ohne Zone; der Vergleichswert „jetzt“ wird genauso gelesen (als UTC) */
  const wall = (iso) => Date.parse(iso + 'Z');
  const timesFrom = (startWall) => Array.from({ length: 8 }, (_, i) => new Date(startWall + i * 15 * 60000).toISOString().slice(0, 16));
  const times = timesFrom(wall('2026-10-09T14:15'));
  const m15 = (vals) => ({ time: times, precipitation: vals });
  const now = wall('2026-10-09T14:20');
  const a1 = worker.rainAlert(m15([0, 0, 0.3, 0.6, 0.2, 0, 0, 0]), now);
  check('Alarmregel: Regen ab der dritten Viertelstunde, Menge der folgenden Stunde', a1 && a1.at === '14:45' && a1.mm === '1,1', JSON.stringify(a1));
  check('Alarmregel: kein Alarm, wenn es schon regnet oder nur später als 60 Minuten', worker.rainAlert(m15([0.4, 0.5, 0, 0, 0, 0, 0, 0]), now) === null && worker.rainAlert(m15([0, 0, 0, 0, 0, 0.5, 0.5, 0.5]), now) === null && worker.rainAlert(m15([0, 0, 0, 0, 0, 0, 0, 0]), now) === null);
  check('Alarmregel: Nieselspuren unter 0,1 mm zählen nicht', worker.rainAlert(m15([0, 0.05, 0.05, 0.05, 0, 0, 0, 0]), now) === null);

  // Push-Routen mit KV-Stub; neben den Abonnements (sub:) liegen dort die Zähler der Rate-Begrenzung (rate:)
  const kv = new Map();
  const env = { SUBS: { get: async k => kv.get(k) || null, put: async (k, v) => { kv.set(k, v); }, delete: async k => { kv.delete(k); }, list: async o => ({ keys: [...kv.keys()].filter(k => !o || !o.prefix || k.startsWith(o.prefix)).map(name => ({ name })) }) }, VAPID_PUBLIC_KEY: vPub, VAPID_PRIVATE_KEY: vD, VAPID_SUBJECT: 'mailto:test@example.org' };
  const subs = () => [...kv.keys()].filter(k => k.startsWith('sub:'));
  const subVal = () => JSON.parse(kv.get(subs()[0]));
  const ctx = { waitUntil() {} };
  const BASE = 'https://wetter-nina-proxy.example.workers.dev';
  const req = (path, body, method, headers) => new Request(BASE + path, { method: method || 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'Origin': 'https://anferny33.github.io', 'CF-Connecting-IP': '203.0.113.5' }, headers || {}), body: body === undefined ? undefined : JSON.stringify(body) });
  const r1 = await worker.default.fetch(req('/push/subscribe', { subscription: sub, lat: 45.69, lon: 13.12, name: 'Lignano' }), env, ctx);
  const j1 = await r1.json();
  const stored = subVal();
  check('Worker: Abonnieren legt den Eintrag unter dem Endpunkt-Hash ab, mit Ort und Zeit', r1.status === 200 && j1.ok === true && subs().length === 1 && stored.endpoint === sub.endpoint && stored.lat === 45.69 && stored.name === 'Lignano' && typeof stored.since === 'string' && r1.headers.get('Access-Control-Allow-Origin') === 'https://anferny33.github.io', JSON.stringify(j1) + ' ' + subs().length);
  const r2 = await worker.default.fetch(req('/push/subscribe', { subscription: { endpoint: 'http://unsicher', keys: {} }, lat: 1, lon: 2 }), env, ctx);
  check('Worker: ungültiges Abonnement wird abgewiesen', r2.status === 400 && subs().length === 1, r2.status);
  const r2b = await worker.default.fetch(req('/push/subscribe', { subscription: { endpoint: 'https://fremd.example/push/abc', keys: sub.keys }, lat: 1, lon: 2 }), env, ctx);
  const r2c = await worker.default.fetch(req('/push/subscribe', { subscription: { endpoint: 'https://wns2-par02p.notify.windows.com/w/?token=abc', keys: sub.keys }, lat: 1, lon: 2 }), env, ctx);
  check('Worker: Endpunkt muss auf einen bekannten Push-Dienst zeigen (fremder Host 400, *.notify.windows.com erlaubt)', r2b.status === 400 && r2c.status === 200 && subs().length === 2 && worker.knownPushEndpoint('https://fcm.googleapis.com/fcm/send/x') && worker.knownPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x') && !worker.knownPushEndpoint('http://web.push.apple.com/x') && !worker.knownPushEndpoint('https://web.push.apple.com/' + 'x'.repeat(2100)), r2b.status + ' ' + r2c.status);
  await worker.default.fetch(req('/push/unsubscribe', { endpoint: 'https://wns2-par02p.notify.windows.com/w/?token=abc' }), env, ctx);
  const r2d = await worker.default.fetch(req('/push/subscribe', { subscription: sub, lat: 45.69, lon: 13.12, name: 'x'.repeat(5000) }), env, ctx);
  check('Worker: Anfragekörper über 4 KB wird mit 413 abgewiesen', r2d.status === 413, r2d.status);
  const r3 = await worker.default.fetch(req('/push/unsubscribe', { endpoint: sub.endpoint }), env, ctx);
  check('Worker: Abmelden löscht den Eintrag', r3.status === 200 && subs().length === 0, subs().length);
  const r4 = await worker.default.fetch(req('/push/subscribe', undefined, 'OPTIONS'), env, ctx);
  check('Worker: Preflight erlaubt POST', r4.status === 204 && /POST/.test(r4.headers.get('Access-Control-Allow-Methods')), r4.headers.get('Access-Control-Allow-Methods'));
  const o1 = await worker.default.fetch(req('/health', undefined, 'GET', { Origin: 'https://fremd.example' }), env, ctx);
  const o2 = await worker.default.fetch(req('/push/subscribe', undefined, 'OPTIONS', { Origin: 'https://fremd.example' }), env, ctx);
  const o3 = await worker.default.fetch(new Request(BASE + '/health'), env, ctx);
  check('Worker: fremder Origin bekommt 403 (auch beim Preflight), ohne Origin-Header (curl) geht es durch', o1.status === 403 && o2.status === 403 && o3.status === 200 && (await o3.json()).ok === true, o1.status + ' ' + o2.status + ' ' + o3.status);
  const flood = (ip) => req('/push/subscribe', { subscription: sub, lat: 45.69, lon: 13.12 }, 'POST', { 'CF-Connecting-IP': ip });
  let floodLast;
  for (let i = 0; i < 121; i++) floodLast = await worker.default.fetch(flood('198.51.100.7'), env, ctx);
  const floodOther = await worker.default.fetch(flood('198.51.100.8'), env, ctx);
  check('Worker: höchstens 120 Anmeldungen je IP und Stunde, die 121. bekommt 429, eine andere IP nicht', floodLast.status === 429 && floodOther.status === 200 && subs().length === 1 && [...kv.keys()].some(k => k.startsWith('rate:sub:')), floodLast.status + ' ' + floodOther.status);
  await worker.default.fetch(req('/push/unsubscribe', { endpoint: sub.endpoint }), env, ctx);

  // Prüf-Lauf: Regen in 30 Minuten → eine Nachricht, danach Sperrfrist; verschwundenes Abonnement wird gelöscht
  await worker.default.fetch(req('/push/subscribe', { subscription: sub, lat: 45.69, lon: 13.12, name: 'Lignano' }), env, ctx);
  /* Der Worker rechnet mit echten Zeitpunkten (UTC) und dem Versatz des Orts (+2 h): Ortszeit 14:20 = 12:20 UTC */
  const OFF = 7200;
  let utcNow = now - OFF * 1000;
  const sent = [];
  const fakeFetch = async (url, init) => {
    /* Vorhersage ab der Viertelstunde vor „jetzt“ (Ortszeit), Regen ab der dritten */
    if (String(url).includes('open-meteo')) { const start = Math.floor((utcNow + OFF * 1000 - 5 * 60000) / (15 * 60000)) * 15 * 60000; return { ok: true, json: async () => ({ minutely_15: { time: timesFrom(start), precipitation: [0, 0, 0.3, 0.6, 0.2, 0, 0, 0] }, utc_offset_seconds: OFF }) }; }
    sent.push({ url: String(url), init });
    return { status: sent.length > 1 ? 410 : 201 };
  };
  const res1 = await worker.checkRain(env, { fetch: fakeFetch, now: utcNow });
  const after1 = subVal();
  check('Worker: Prüf-Lauf sendet bei Regen in 30 Minuten genau eine verschlüsselte Nachricht mit VAPID-Kopf', res1.sent === 1 && sent.length === 1 && sent[0].url === sub.endpoint && sent[0].init.headers['Content-Encoding'] === 'aes128gcm' && /^vapid t=/.test(sent[0].init.headers.Authorization) && sent[0].init.body.length > 100 && after1.lastSent === utcNow, JSON.stringify(res1));
  utcNow += 30 * 60000;
  const res2 = await worker.checkRain(env, { fetch: fakeFetch, now: utcNow });
  check('Worker: innerhalb der Sperrfrist keine zweite Nachricht', res2.sent === 0 && sent.length === 1, JSON.stringify(res2));
  utcNow += 4 * 3600000;
  const res3 = await worker.checkRain(env, { fetch: fakeFetch, now: utcNow });
  check('Worker: nach der Sperrfrist wird erneut gesendet; Antwort 410 löscht das Abonnement, zählt nicht als Erfolg', res3.sent === 0 && res3.removed === 1 && sent.length === 2 && subs().length === 0, JSON.stringify(res3) + ' ' + subs().length);

  // Probenachricht: unbekanntes Abonnement, Versand, Sperrfrist, verschwundenes Abonnement
  const t1 = await worker.default.fetch(req('/push/test', { endpoint: 'https://web.push.apple.com/unbekannt' }), env, ctx);
  check('Probenachricht: unbekannter Endpunkt wird mit 404 abgewiesen', t1.status === 404, t1.status);
  await worker.default.fetch(req('/push/subscribe', { subscription: sub, lat: 45.69, lon: 13.12, name: 'Lignano' }), env, ctx);
  const testSent = [];
  env.__fetch = async (url, init) => { testSent.push({ url: String(url), init }); return { status: 201 }; };
  const t2 = await worker.default.fetch(req('/push/test', { endpoint: sub.endpoint }), env, ctx);
  const j2 = await t2.json();
  const afterTest = subVal();
  check('Probenachricht: verschlüsselt mit VAPID-Kopf an den Endpunkt, Antwort ok, Zeitpunkt gemerkt', t2.status === 200 && j2.ok === true && testSent.length === 1 && testSent[0].url === sub.endpoint && testSent[0].init.headers['Content-Encoding'] === 'aes128gcm' && /^vapid t=/.test(testSent[0].init.headers.Authorization) && typeof afterTest.lastTest === 'number', JSON.stringify(j2));
  const t3 = await worker.default.fetch(req('/push/test', { endpoint: sub.endpoint }), env, ctx);
  check('Probenachricht: innerhalb von fünf Minuten keine zweite', t3.status === 429 && testSent.length === 1, t3.status);
  afterTest.lastTest = 0; kv.set(subs()[0], JSON.stringify(afterTest));
  env.__fetch = async (url, init) => ({ status: 410 });
  const t4 = await worker.default.fetch(req('/push/test', { endpoint: sub.endpoint }), env, ctx);
  check('Probenachricht: 410 vom Push-Dienst löscht das Abonnement und sagt es', t4.status === 410 && subs().length === 0, t4.status + ' ' + subs().length);
  delete env.__fetch;

  // Ohne VAPID_SUBJECT kein Versand: Probenachricht 500 mit Meldung, Cron-Lauf meldet den Fehler statt einer Beispieladresse
  await worker.default.fetch(req('/push/subscribe', { subscription: sub, lat: 45.69, lon: 13.12, name: 'Lignano' }), env, ctx);
  const envNoSubject = Object.assign({}, env, { VAPID_SUBJECT: undefined });
  const t5 = await worker.default.fetch(req('/push/test', { endpoint: sub.endpoint }), envNoSubject, ctx);
  const tj5 = await t5.json();
  const sentNo = [];
  const quiet = console.error; console.error = () => {};
  const rc = await worker.checkRain(envNoSubject, { fetch: async (u) => { sentNo.push(String(u)); return { ok: true, json: async () => ({}) }; }, now: utcNow });
  console.error = quiet;
  check('VAPID: ohne VAPID_SUBJECT verweigern Probenachricht (500 mit Meldung) und Cron-Lauf den Versand, keine Beispieladresse im Code', t5.status === 500 && /VAPID_SUBJECT/.test(tj5.error) && rc.sent === 0 && sentNo.length === 0 && /VAPID_SUBJECT/.test(rc.error) && !read(path.join('proxy', 'src', 'worker.js')).includes('example.org'), t5.status + ' ' + JSON.stringify(tj5) + ' ' + JSON.stringify(rc));
  await worker.default.fetch(req('/push/unsubscribe', { endpoint: sub.endpoint }), env, ctx);

  // NINA-Route: Dashboard und Details gestubbt. Cancel und abgelaufene Meldungen fallen weg, das Ablaufdatum
  // kommt je nach Anbieter aus info[].expires oder expiresDate und geht als ISO-Zeit (UTC) an die App
  const ninaNow = Math.floor(Date.now() / 1000) * 1000;   /* NINA stempelt sekundengenau */
  const berlin = ms => new Date(ms + 7200000).toISOString().slice(0, 19) + '+02:00';   /* derselbe Zeitpunkt mit Zonenversatz, wie NINA ihn liefert */
  const item = (id, provider, msgType, extra) => Object.assign({ id, sent: berlin(ninaNow - 600000), severity: 'Minor', type: 'ALERT', i18nTitle: { de: id + ' <b>Titel</b>' }, payload: { data: { provider, severity: 'Minor', msgType, headline: id } } }, extra || {});
  const dash = [
    item('mow.A', 'MOWAS', 'Alert', { severity: 'Moderate', payload: { data: { provider: 'MOWAS', severity: 'Moderate', msgType: 'Alert' } } }),
    item('kat.B', 'KATWARN', 'Alert', { expiresDate: berlin(ninaNow - 60000) }),
    item('mow.C', 'MOWAS', 'Cancel'),
    item('lhp.D', 'LHP', 'Alert'),
    item('biw.E', 'BIWAPP', 'Alert', { expiresDate: berlin(ninaNow + 7200000) })
  ];
  const details = {
    'mow.A': { msgType: 'Alert', info: [{ language: 'DE', event: 'Gefahreninformation', severity: 'Moderate', headline: 'Großbrand', description: 'Rauch<br>Fenster zu', expires: berlin(ninaNow + 3600000), area: [{ areaDesc: 'Stadt München' }] }] },
    'kat.B': { info: [{ language: 'DE', headline: 'Alt', severity: 'Minor' }] },
    'lhp.D': { info: [{ language: 'DE', headline: 'Hochwasser', severity: 'Minor', expires: 'kein Datum' }] }
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/dashboard/091620000000.json')) return { ok: true, json: async () => dash };
    const m = u.match(/\/warnings\/(.+)\.json$/);   /* IDs enthalten Punkte (mow.A) */
    const d = m && details[decodeURIComponent(m[1])];
    return d ? { ok: true, json: async () => d } : { ok: false, status: 404 };
  };
  globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
  const n1 = await worker.default.fetch(new Request(BASE + '/nina/091620000000', { headers: { Origin: 'https://anferny33.github.io' } }), env, ctx);
  const nj1 = await n1.json();
  globalThis.fetch = realFetch; delete globalThis.caches;
  const ids = (nj1.warnings || []).map(w => w.id).join(',');
  const wA = (nj1.warnings || []).find(w => w.id === 'mow.A') || {}, wD = (nj1.warnings || []).find(w => w.id === 'lhp.D') || {}, wE = (nj1.warnings || []).find(w => w.id === 'biw.E') || {};
  check('NINA-Route: Cancel und abgelaufene Meldung (expiresDate im Dashboard) fehlen, höchste Stufe zuerst, HTML im Titel bereinigt', n1.status === 200 && ids === 'mow.A,lhp.D,biw.E' && wA.level === 2 && wA.headline === 'mow.A Titel' && wA.description === 'Rauch\nFenster zu' && wA.area === 'Stadt München', n1.status + ' ' + ids);
  check('NINA-Route: expires als ISO-Zeit aus info[].expires bzw. expiresDate, unlesbares oder fehlendes Datum wird null', wA.expires === new Date(ninaNow + 3600000).toISOString() && wE.expires === new Date(ninaNow + 7200000).toISOString() && wD.expires === null, JSON.stringify([wA.expires, wE.expires, wD.expires]));
  const nExp = worker.normalize({ id: 'x', payload: { data: { provider: 'MOWAS', expires: '2026-10-10T14:00:00+02:00' } } }, null);
  check('NINA-Route: expires auch aus payload.data.expires, normalisiert nach UTC', nExp.expires === '2026-10-10T12:00:00.000Z' && nExp.providerLabel === 'Katastrophenschutz', nExp.expires);

  // Rückmeldungen: Ablage, Kürzungen, Rate-Limit, Lesen mit Geheimnis, als gelesen markieren
  const fbKv = new Map(), fbOpts = new Map();
  /* Der KV-Stub liefert wie Cloudflare seitenweise (hier 4 je Seite) mit cursor und list_complete */
  let cursorSeen = false;
  env.FEEDBACK = { get: async k => fbKv.get(k) || null, put: async (k, v, o) => { fbKv.set(k, v); fbOpts.set(k, o || {}); }, delete: async k => { fbKv.delete(k); }, list: async o => {
    const all = [...fbKv.keys()].filter(k => !o || !o.prefix || k.startsWith(o.prefix)).sort();
    const start = o && o.cursor ? Number(o.cursor) : 0;
    if (start > 0) cursorSeen = true;
    const done = start + 4 >= all.length;
    return { keys: all.slice(start, start + 4).map(name => ({ name })), list_complete: done, cursor: done ? undefined : String(start + 4) };
  } };
  env.FEEDBACK_TOKEN = 'geheim-token-123';
  const meta = { version: '20261009q', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', width: 402, font: 1.2, standalone: true, view: 'rain', lastError: 'Keine Verbindung', ts: '2026-10-09T12:00:00.000Z', extra: 'weg' };
  const f1 = await worker.default.fetch(req('/feedback', { text: '  Der Regenbalken ist zu klein.  ', kind: 'fehler', name: 'Anna', id: 'abcdefgh12345678', meta }), env, ctx);
  const fj1 = await f1.json();
  const fbKeys = () => [...fbKv.keys()].filter(k => k.startsWith('fb:')).sort();
  const e1 = fbKeys().length ? JSON.parse(fbKv.get(fbKeys()[0])) : null;
  check('Rückmeldung: unter fb: abgelegt, Text getrimmt, Art, Name, nur erlaubte Metadaten, ungelesen, 90 Tage Frist', f1.status === 200 && fj1.ok === true && fbKeys().length === 1 && e1 && e1.id === fbKeys()[0] && e1.text === 'Der Regenbalken ist zu klein.' && e1.kind === 'fehler' && e1.name === 'Anna' && e1.read === false && e1.meta.version === '20261009q' && e1.meta.width === 402 && e1.meta.standalone === true && e1.meta.lastError === 'Keine Verbindung' && e1.meta.extra === undefined && fbOpts.get(fbKeys()[0]).expirationTtl === 90 * 86400 && typeof e1.at === 'string' && e1.install === 'abcdefgh', JSON.stringify(e1) + ' ' + f1.status);
  const f2 = await worker.default.fetch(req('/feedback', { text: 'ok', kind: 'idee', id: 'abcdefgh12345678' }), env, ctx);
  const f3 = await worker.default.fetch(req('/feedback', { text: 'Text ohne Kennung', kind: 'idee' }), env, ctx);
  check('Rückmeldung: zu kurzer Text und fehlende Kennung werden abgewiesen', f2.status === 400 && f3.status === 400 && fbKeys().length === 1, f2.status + ' ' + f3.status);
  const f4 = await worker.default.fetch(req('/feedback', { text: 'Unbekannte Art und sehr langer Name', kind: 'quatsch', name: 'x'.repeat(80), id: 'abcdefgh12345678', meta: { ua: 'u'.repeat(400) } }), env, ctx);
  const e4 = [...fbKv.values()].map(v => JSON.parse(v)).find(e => e.text && e.text.startsWith('Unbekannte Art')) || null;
  check('Rückmeldung: unbekannte Art wird Idee, Name auf 40 und Browserkennung auf 200 Zeichen gekürzt', f4.status === 200 && e4 && e4.kind === 'idee' && e4.name.length === 40 && e4.meta.ua.length === 200, JSON.stringify(e4).slice(0, 200));
  let last;
  for (let i = 0; i < 4; i++) last = await worker.default.fetch(req('/feedback', { text: 'Noch eine Rückmeldung ' + i, kind: 'lob', id: 'abcdefgh12345678' }), env, ctx);
  check('Rückmeldung: höchstens fünf pro Stunde je Kennung, die sechste bekommt 429', last.status === 429 && fbKeys().length === 5, last.status + ' ' + fbKeys().length);
  const f5 = await worker.default.fetch(req('/feedback', { text: 'Anderes Gerät darf', kind: 'lob', id: 'zzzzzzzz00000000' }), env, ctx);
  check('Rückmeldung: andere Kennung ist nicht betroffen', f5.status === 200 && fbKeys().length === 6, f5.status);
  const fbGet = (t, q) => new Request('https://wetter-nina-proxy.example.workers.dev/feedback' + (q || ''), { method: 'GET', headers: t ? { Authorization: 'Bearer ' + t } : {} });
  const g0 = await worker.default.fetch(fbGet(null), env, ctx);
  const g1 = await worker.default.fetch(fbGet('falsch'), env, ctx);
  const g2 = await worker.default.fetch(fbGet('geheim-token-123'), env, ctx);
  const gj2 = await g2.json();
  check('Rückmeldung: Lesen nur mit dem Geheimnis, ungelesene Einträge in Zeitfolge über alle KV-Seiten (Cursor)', g0.status === 401 && g1.status === 401 && g2.status === 200 && gj2.count === 6 && gj2.items.length === 6 && cursorSeen && gj2.items.some(i => i.text === 'Der Regenbalken ist zu klein.') && gj2.items.every((i, n) => i.read === false && (n === 0 || i.at >= gj2.items[n - 1].at)), g0.status + ' ' + g1.status + ' ' + g2.status + ' ' + cursorSeen + ' ' + JSON.stringify(gj2).slice(0, 160));
  const fbAck = (t, ids) => new Request('https://wetter-nina-proxy.example.workers.dev/feedback/ack', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}), body: JSON.stringify({ ids }) });
  const fa1 = await worker.default.fetch(fbAck('geheim-token-123', gj2.items.slice(0, 2).map(i => i.id)), env, ctx);
  const faj1 = await fa1.json();
  const g3 = await (await worker.default.fetch(fbGet('geheim-token-123'), env, ctx)).json();
  const g4 = await (await worker.default.fetch(fbGet('geheim-token-123', '?all=1'), env, ctx)).json();
  const acked = JSON.parse(fbKv.get(gj2.items[0].id));
  check('Rückmeldung: Markieren setzt gelesen und hält die Restfrist; danach fehlen die Einträge, mit all=1 bleiben sie', fa1.status === 200 && faj1.acked === 2 && g3.count === 4 && g4.count === 6 && acked.read === true && fbOpts.get(gj2.items[0].id).expirationTtl > 0 && fbOpts.get(gj2.items[0].id).expirationTtl <= 90 * 86400, fa1.status + ' ' + JSON.stringify(faj1) + ' ' + g3.count + ' ' + g4.count);
  const fa2 = await worker.default.fetch(fbAck(null, []), env, ctx);
  check('Rückmeldung: Markieren ohne Geheimnis wird abgewiesen', fa2.status === 401, fa2.status);
  let ipLast;
  for (let i = 0; i < 21; i++) ipLast = await worker.default.fetch(req('/feedback', { text: 'Immer neue Kennung ' + i, kind: 'idee', id: 'kennung' + String(i).padStart(9, '0') }, 'POST', { 'CF-Connecting-IP': '198.51.100.9' }), env, ctx);
  const ipOther = await worker.default.fetch(req('/feedback', { text: 'Andere Adresse darf', kind: 'idee', id: 'kennung999999999' }, 'POST', { 'CF-Connecting-IP': '198.51.100.10' }), env, ctx);
  check('Rückmeldung: wechselnde Kennungen umgehen das Limit nicht, je IP höchstens 20 pro Stunde, die 21. bekommt 429', ipLast.status === 429 && ipOther.status === 200 && fbKeys().length === 6 + 20 + 1, ipLast.status + ' ' + ipOther.status + ' ' + fbKeys().length);

  // Datenschicht (wetter-core.js in der Sandbox des Harness): NINA-Ablauf im Client, Schalter, Standardwerte, Modelle
  const sb = H.makeSandbox();
  const iso = ms => new Date(ms).toISOString();
  const ninaIn = { warnings: [
    { id: 'alt', provider: 'MOWAS', expires: iso(H.TEST_NOW - 60000), headline: 'Vorbei' },
    { id: 'neu', provider: 'MOWAS', expires: iso(H.TEST_NOW + 3600000), headline: 'Aktuell' },
    { id: 'offen', provider: 'KATWARN', expires: null, headline: 'Unbefristet' },
    { id: 'dwd', provider: 'DWD', headline: 'Doppelt' },
    { id: 'weg', provider: 'MOWAS', msgType: 'Cancel', headline: 'Entwarnung' } ] };
  const ninaOut = sb.normalizeNina(ninaIn, H.TEST_NOW);
  check('Datenschicht: normalizeNina lässt abgelaufene, DWD- und Cancel-Meldungen weg (zweite Sicherung), expires bleibt für die Anzeige', ninaOut.map(w => w.id).join(',') === 'neu,offen' && ninaOut[0].expires === iso(H.TEST_NOW + 3600000) && ninaOut[1].expires === null, JSON.stringify(ninaOut.map(w => w.id)));
  const off = vm.createContext({ console, URLSearchParams, Date, Math, Object, Array, JSON, isNaN, parseInt, Promise, window: { NINA_PROXY: '' }, fetch: () => { throw new Error('fetch nicht erwartet'); } });
  vm.runInContext(read('wetter-core.js'), off);
  const offList = await off.fetchNina({ lat: 48.1, lon: 11.6 });
  check('Datenschicht: window.NINA_PROXY = "" schaltet NINA aus (kein Aufruf, leere Liste); nur undefined fällt auf die feste Adresse zurück', vm.runInContext('NINA_PROXY', off) === '' && Array.isArray(offList) && offList.length === 0 && vm.runInContext('NINA_PROXY', sb) === proxyUrl, JSON.stringify(vm.runInContext('NINA_PROXY', off)));
  const defaults = vm.runInContext('SETTINGS_DEFAULTS', sb);
  const trip = { name: 'Lignano', lat: 45.69, lon: 13.12, from: '2026-10-20', to: '2026-10-27' };
  const ns = sb.normalizeSettings({ trip, tripSwitched: '2026-10-20', filmShown: '2026-10-10', pushLoc: { lat: 48.1, lon: 11.5 } });
  check('Datenschicht: SETTINGS_DEFAULTS kennt pushLoc, pushUnsub, trip, tripSwitched, filmShown (null); normalizeSettings behält gültige Werte, verwirft kaputte', ['pushLoc', 'pushUnsub', 'trip', 'tripSwitched', 'filmShown'].every(k => k in defaults && defaults[k] === null) && JSON.stringify(ns.trip) === JSON.stringify(trip) && ns.tripSwitched === '2026-10-20' && ns.filmShown === '2026-10-10' && ns.pushLoc.lat === 48.1 && sb.normalizeSettings({}).trip === null && sb.normalizeSettings({ pushUnsub: 42 }).pushUnsub === null && sb.normalizeSettings({ pushUnsub: 'http://x' }).pushUnsub === null && sb.normalizeSettings({ pushUnsub: 'https://push.example/abc' }).pushUnsub === 'https://push.example/abc', JSON.stringify(defaults));
  const models = vm.runInContext('MODELS', sb), metaModels = vm.runInContext('META_MODELS', sb);
  check('Datenschicht: zu jedem Modell in MODELS (auch ARPEGE) gibt es ein Metadaten-Verzeichnis in META_MODELS', models.length === 6 && models.every(m => metaModels.some(x => x.id === m.id && /^[a-z0-9_]+$/.test(x.dir))), models.map(m => m.id).join(','));

  finish();
})().catch(e => { console.error(e); process.exit(1); });
