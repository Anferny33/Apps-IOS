/* Offline-Hülle der Wetter-App. Hält Seiten, Stylesheet, Skripte und Icons vor, damit die
 * Homescreen-App auch ohne Netz startet; die Wetterdaten selbst liegen im Speicher der App.
 * SW_VERSION muss der Versions-Query der Seiten entsprechen und wird mit ihr erhöht. */
"use strict";

const SW_VERSION = "20261009h";
const CACHE = "wetter-shell-" + SW_VERSION;
const SHELL = [
    "./", "index.html", "radar.html", "manifest.webmanifest",
    "modern.css?v=" + SW_VERSION, "sonne.js?v=" + SW_VERSION, "wetter-core.js?v=" + SW_VERSION,
    "design.js?v=" + SW_VERSION, "radar.js?v=" + SW_VERSION,
    "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/icon.svg"
];
/* Fremde Dateien, die die Hülle braucht: aus dem Cache, im Hintergrund erneuert */
const RUNTIME_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com"];
/* Für die Tests sichtbar (Konstanten des Workers sind von außen nicht erreichbar) */
self.SW_INFO = { version: SW_VERSION, shell: SHELL };

self.addEventListener("install", function (e) {
    e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
    e.waitUntil(caches.keys().then(function (names) {
        return Promise.all(names.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); }));
});

function errorResponse() {
    return Response.error();
}

/* Eigene Dateien: Netz zuerst, Antwort in den Cache; ohne Netz aus dem Cache, Seitenaufrufe auf die Hülle */
function networkFirst(request) {
    return caches.open(CACHE).then(function (c) {
        return fetch(request).then(function (res) {
            if (res && res.ok) c.put(request, res.clone());
            return res;
        }).catch(function () {
            return c.match(request).then(function (hit) {
                if (hit) return hit;
                if (request.mode === "navigate") {
                    const path = new URL(request.url).pathname;
                    return c.match(/radar\.html$/.test(path) ? "radar.html" : "index.html").then(function (page) { return page || errorResponse(); });
                }
                return errorResponse();
            });
        });
    });
}

/* Schriften und Kartenbibliothek: aus dem Cache, dabei im Hintergrund erneuern */
function staleWhileRevalidate(request) {
    return caches.open(CACHE).then(function (c) {
        return c.match(request).then(function (hit) {
            const refresh = fetch(request).then(function (res) {
                if (res && res.ok) c.put(request, res.clone());
                return res;
            }).catch(function () { return hit || errorResponse(); });
            return hit || refresh;
        });
    });
}

self.addEventListener("fetch", function (e) {
    const req = e.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
    if (RUNTIME_HOSTS.indexOf(url.hostname) >= 0) { e.respondWith(staleWhileRevalidate(req)); return; }
    /* Wetterdaten, Warnungen, Radarbilder, Kartenkacheln: unverändert über das Netz */
});
