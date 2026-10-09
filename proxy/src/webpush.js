/* Web Push ohne Bibliothek: Nachricht nach RFC 8291 (aes128gcm) verschlüsseln und mit VAPID
 * (RFC 8292, ES256) ausweisen. Läuft mit WebCrypto im Cloudflare Worker und in Node. */

const te = new TextEncoder();

export function b64url(bytes) {
    const b = new Uint8Array(bytes);
    let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(str) {
    const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s + "===".slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function concat() {
    const arrs = Array.prototype.slice.call(arguments);
    const out = new Uint8Array(arrs.reduce(function (n, a) { return n + a.length; }, 0));
    let o = 0;
    arrs.forEach(function (a) { out.set(a, o); o += a.length; });
    return out;
}

export async function hkdf(salt, ikm, info, len) {
    const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt, info: info }, key, len * 8));
}

/* Schlüsselableitung nach RFC 8291 für beide Seiten (Sender verschlüsselt, Test entschlüsselt) */
export async function deriveKeys(uaPub, asPub, shared, auth, salt) {
    const ikm = await hkdf(auth, shared, concat(te.encode("WebPush: info\0"), uaPub, asPub), 32);
    return {
        cek: await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16),
        nonce: await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12)
    };
}

/* Nutzlast (Text) für ein Abonnement verschlüsseln: salt | rs | idlen | Senderschlüssel | Chiffrat */
export async function encryptPayload(subscription, payload) {
    const uaPub = fromB64url(subscription.keys.p256dh);
    const auth = fromB64url(subscription.keys.auth);
    const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
    const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const k = await deriveKeys(uaPub, asPub, shared, auth, salt);
    const plain = concat(te.encode(payload), new Uint8Array([2]));   /* 0x02: letzter Datensatz, kein weiteres Padding */
    const aesKey = await crypto.subtle.importKey("raw", k.cek, "AES-GCM", false, ["encrypt"]);
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: k.nonce }, aesKey, plain));
    const rs = 4096;
    const header = concat(salt, new Uint8Array([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]), new Uint8Array([asPub.length]), asPub);
    return concat(header, cipher);
}

/* VAPID-Kopf: signiertes JWT (ES256) für den Push-Dienst des Abonnements */
export async function vapidAuth(endpoint, publicKeyB64, privateD, subject, exp) {
    const aud = new URL(endpoint).origin;
    const header = b64url(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
    const claims = b64url(te.encode(JSON.stringify({ aud: aud, exp: exp || Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
    const pub = fromB64url(publicKeyB64);
    const jwk = { kty: "EC", crv: "P-256", x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: privateD };
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(header + "." + claims)));
    return "vapid t=" + header + "." + claims + "." + b64url(sig) + ", k=" + publicKeyB64;
}

/* Nachricht senden; liefert den HTTP-Status des Push-Dienstes (404/410: Abonnement ist weg) */
export async function sendWebPush(subscription, payload, opts) {
    const body = await encryptPayload(subscription, payload);
    const auth = await vapidAuth(subscription.endpoint, opts.publicKey, opts.privateKey, opts.subject);
    const doFetch = opts.fetch || fetch;
    const res = await doFetch(subscription.endpoint, {
        method: "POST",
        headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", "TTL": String(opts.ttl || 3600), "Urgency": opts.urgency || "high", "Authorization": auth },
        body: body
    });
    return res.status;
}
