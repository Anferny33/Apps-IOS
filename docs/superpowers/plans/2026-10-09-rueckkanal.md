# Rückkanal – Umsetzungsplan

> Umsetzung direkt in der Sitzung, Tests zuerst. Spezifikation: `docs/superpowers/specs/2026-10-09-rueckkanal-design.md`.

- [x] KV-Namespace `FEEDBACK` anlegen, Geheimnis `FEEDBACK_TOKEN` erzeugen (`proxy/.dev.vars`) und hochladen.
- [x] Tests Worker (`tests/smoke-push.js`): Ablage, Kürzungen, Rate-Limit, Lesen mit Geheimnis, Markieren.
- [x] Tests App (`tests/smoke-design.js`): Markup, Einstellungsabschnitt, Blatt, Senden, 429, Warteschlange, Metadaten, Stylesheet.
- [x] Worker: Routen `/feedback`, `/feedback/ack`, Helfer `cleanFeedback`; `wrangler.toml` mit Namespace.
- [x] App: Blatt in `index.html`, Fußzeilen-Link, Einstellungsabschnitt, `design.js` (Zustand, Senden, Warteschlange, Metadaten, letzter Fehler), `modern.css`.
- [x] `proxy/feedback.sh`, README (App und Worker), Checkliste, Veröffentlichungs-Checkliste Phase 0.
- [x] Versions-Query `20261009q`, `npm test`, Browserfenster und Simulator.
