/* Offline-Hülle der Wetter-App. Hält Seiten, Stylesheet, Skripte und Icons vor, damit die
 * Homescreen-App auch ohne Netz startet; die Wetterdaten selbst liegen im Speicher der App.
 * SW_VERSION muss der Versions-Query der Seiten entsprechen und wird mit ihr erhöht. */
"use strict";

const SW_VERSION = "20261010a";
const CACHE = "wetter-shell-" + SW_VERSION;
const SHELL = [
    "./", "index.html", "radar.html", "manifest.webmanifest",
    "modern.css?v=" + SW_VERSION, "sonne.js?v=" + SW_VERSION, "wetter-core.js?v=" + SW_VERSION,
    "design.js?v=" + SW_VERSION, "radar.js?v=" + SW_VERSION,
    /* Icons mit derselben Query wie in index.html und im Manifest, sonst trifft der Cache offline nicht */
    "icons/icon-192.png?v=" + SW_VERSION, "icons/icon-512.png?v=" + SW_VERSION,
    "icons/apple-touch-icon.png?v=" + SW_VERSION, "icons/icon.svg?v=" + SW_VERSION
];
/* Fremde Dateien, die die Hülle braucht: aus dem Cache, im Hintergrund erneuert */
const RUNTIME_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com"];
/* Für die Tests sichtbar (Konstanten des Workers sind von außen nicht erreichbar) */
self.SW_INFO = { version: SW_VERSION, shell: SHELL };

self.addEventListener("install", function (e) {
    /* cache: "reload" holt die Hülle am HTTP-Cache vorbei, sonst landet nach einem Update eine alte Seite im neuen Shell-Cache */
    e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: "reload" }); })); }).then(function () { return self.skipWaiting(); }));
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

/* Regen-Alarm: Nachricht des Workers anzeigen; ein Tipp holt die App nach vorn oder öffnet sie */
self.addEventListener("push", function (e) {
    let data = {};
    try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data && e.data.text ? e.data.text() : "" }; }
    const title = data.title || "Regen in Sicht";
    e.waitUntil(self.registration.showNotification(title, {
        body: data.body || "",
        icon: "icons/icon-192.png",
        badge: "icons/icon-192.png",
        tag: "regen-alarm",
        renotify: true,
        data: { url: data.url || "./" }
    }));
});

self.addEventListener("notificationclick", function (e) {
    e.notification.close();
    const target = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
    e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
        const open = list.find(function (c) { return c.url.indexOf(self.registration.scope) === 0; });
        if (open) return open.focus();
        return self.clients.openWindow(target);
    }));
});
