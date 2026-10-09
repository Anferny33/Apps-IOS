// Regen-Alarm: Web-Push-Verschlüsselung (RFC 8291) und VAPID (RFC 8292) im Rundlauf prüfen,
// Regel für den Alarm und die Push-Routen des Workers mit KV-Stub.
const path = require('path');
const { pathToFileURL } = require('url');

let fail = 0;
const check = (n, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : ' :: ' + String(x).slice(0, 220))); if (!c) fail++; };
const te = new TextEncoder(), td = new TextDecoder();

(async () => {
  const wp = await import(pathToFileURL(path.join(__dirname, '..', 'proxy', 'src', 'webpush.js')).href);
  const worker = await import(pathToFileURL(path.join(__dirname, '..', 'proxy', 'src', 'worker.js')).href);

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

  // Push-Routen mit KV-Stub
  const kv = new Map();
  const env = { SUBS: { get: async k => kv.get(k) || null, put: async (k, v) => { kv.set(k, v); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [...kv.keys()].map(name => ({ name })) }) }, VAPID_PUBLIC_KEY: vPub, VAPID_PRIVATE_KEY: vD, VAPID_SUBJECT: 'mailto:test@example.org' };
  const ctx = { waitUntil() {} };
  const req = (path, body, method) => new Request('https://wetter-nina-proxy.example.workers.dev' + path, { method: method || 'POST', headers: { 'Content-Type': 'application/json', 'Origin': 'https://anferny33.github.io' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const r1 = await worker.default.fetch(req('/push/subscribe', { subscription: sub, lat: 45.69, lon: 13.12, name: 'Lignano' }), env, ctx);
  const j1 = await r1.json();
  const stored = [...kv.values()].map(v => JSON.parse(v))[0];
  check('Worker: Abonnieren legt den Eintrag unter dem Endpunkt-Hash ab, mit Ort und Zeit', r1.status === 200 && j1.ok === true && kv.size === 1 && [...kv.keys()][0].startsWith('sub:') && stored.endpoint === sub.endpoint && stored.lat === 45.69 && stored.name === 'Lignano' && typeof stored.since === 'string' && r1.headers.get('Access-Control-Allow-Origin') === 'https://anferny33.github.io', JSON.stringify(j1) + ' ' + kv.size);
  const r2 = await worker.default.fetch(req('/push/subscribe', { subscription: { endpoint: 'http://unsicher', keys: {} }, lat: 1, lon: 2 }), env, ctx);
  check('Worker: ungültiges Abonnement wird abgewiesen', r2.status === 400 && kv.size === 1, r2.status);
  const r3 = await worker.default.fetch(req('/push/unsubscribe', { endpoint: sub.endpoint }), env, ctx);
  check('Worker: Abmelden löscht den Eintrag', r3.status === 200 && kv.size === 0, kv.size);
  const r4 = await worker.default.fetch(req('/push/subscribe', undefined, 'OPTIONS'), env, ctx);
  check('Worker: Preflight erlaubt POST', r4.status === 204 && /POST/.test(r4.headers.get('Access-Control-Allow-Methods')), r4.headers.get('Access-Control-Allow-Methods'));

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
  const after1 = JSON.parse([...kv.values()][0]);
  check('Worker: Prüf-Lauf sendet bei Regen in 30 Minuten genau eine verschlüsselte Nachricht mit VAPID-Kopf', res1.sent === 1 && sent.length === 1 && sent[0].url === sub.endpoint && sent[0].init.headers['Content-Encoding'] === 'aes128gcm' && /^vapid t=/.test(sent[0].init.headers.Authorization) && sent[0].init.body.length > 100 && after1.lastSent === utcNow, JSON.stringify(res1));
  utcNow += 30 * 60000;
  const res2 = await worker.checkRain(env, { fetch: fakeFetch, now: utcNow });
  check('Worker: innerhalb der Sperrfrist keine zweite Nachricht', res2.sent === 0 && sent.length === 1, JSON.stringify(res2));
  utcNow += 4 * 3600000;
  const res3 = await worker.checkRain(env, { fetch: fakeFetch, now: utcNow });
  check('Worker: nach der Sperrfrist wird erneut gesendet; Antwort 410 löscht das Abonnement, zählt nicht als Erfolg', res3.sent === 0 && res3.removed === 1 && sent.length === 2 && kv.size === 0, JSON.stringify(res3) + ' ' + kv.size);

  // Probenachricht: unbekanntes Abonnement, Versand, Sperrfrist, verschwundenes Abonnement
  const t1 = await worker.default.fetch(req('/push/test', { endpoint: 'https://web.push.apple.com/unbekannt' }), env, ctx);
  check('Probenachricht: unbekannter Endpunkt wird mit 404 abgewiesen', t1.status === 404, t1.status);
  await worker.default.fetch(req('/push/subscribe', { subscription: sub, lat: 45.69, lon: 13.12, name: 'Lignano' }), env, ctx);
  const testSent = [];
  env.__fetch = async (url, init) => { testSent.push({ url: String(url), init }); return { status: 201 }; };
  const t2 = await worker.default.fetch(req('/push/test', { endpoint: sub.endpoint }), env, ctx);
  const j2 = await t2.json();
  const afterTest = JSON.parse([...kv.values()][0]);
  check('Probenachricht: verschlüsselt mit VAPID-Kopf an den Endpunkt, Antwort ok, Zeitpunkt gemerkt', t2.status === 200 && j2.ok === true && testSent.length === 1 && testSent[0].url === sub.endpoint && testSent[0].init.headers['Content-Encoding'] === 'aes128gcm' && /^vapid t=/.test(testSent[0].init.headers.Authorization) && typeof afterTest.lastTest === 'number', JSON.stringify(j2));
  const t3 = await worker.default.fetch(req('/push/test', { endpoint: sub.endpoint }), env, ctx);
  check('Probenachricht: innerhalb von fünf Minuten keine zweite', t3.status === 429 && testSent.length === 1, t3.status);
  afterTest.lastTest = 0; kv.set([...kv.keys()][0], JSON.stringify(afterTest));
  env.__fetch = async (url, init) => ({ status: 410 });
  const t4 = await worker.default.fetch(req('/push/test', { endpoint: sub.endpoint }), env, ctx);
  check('Probenachricht: 410 vom Push-Dienst löscht das Abonnement und sagt es', t4.status === 410 && kv.size === 0, t4.status + ' ' + kv.size);
  delete env.__fetch;

  console.log(fail === 0 ? '\nAlle Checks bestanden.' : '\n' + fail + ' Check(s) fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
