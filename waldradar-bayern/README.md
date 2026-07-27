# Waldradar Bayern

Webapp, um Wald- und Wiesengrundstücke in Bayern zu finden und ein gefundenes
Angebot sofort preislich einordnen zu können.

Eine einzelne `index.html` ohne Abhängigkeiten, Build oder Server. Läuft per
Doppelklick, lässt sich auf iOS über „Zum Home-Bildschirm" als App ablegen.

## Warum kein Live-Verzeichnis aller Grundstücke?

Es gibt in Deutschland **kein amtliches und kein offenes Verzeichnis** der
Grundstücke, die gerade zum Verkauf stehen. Die Angebote liegen verteilt bei
privaten Portalen, die keine offene Schnittstelle anbieten und deren
Nutzungsbedingungen automatisiertes Auslesen untersagen. Eine statische Webapp
könnte sie zudem wegen CORS gar nicht direkt abfragen.

Die App bündelt deshalb die **Zugänge** statt der Daten: Für den gewählten
Landkreis erzeugt sie fertige Suchlinks in alle relevanten Marktplätze,
Auktionsportale und regionalen Stellen — plus das Preiswissen, um ein Angebot
in Sekunden zu bewerten.

## Funktionen

| Tab | Inhalt |
|---|---|
| **Suchen** | 12 Quellen, für den gewählten Landkreis vorgefiltert, jeweils mit bayernweitem Fallback-Link |
| **Preis** | €/m², €/ha, Tagwerk-Umrechnung, Einordnung gegen das Regionsband, Nebenkostenrechner |
| **Regionen** | Ranking der Regierungsbezirke nach amtlichen Kaufwerten, abgeleitetes €/m²-Band |
| **Merkliste** | Gefundene Angebote lokal speichern, nach €/m² sortiert, Export als JSON/CSV |
| **Info** | Waldbund-Einordnung, Kauf-Checkliste, Quellen, Datenschutz |

Alle Daten liegen im `localStorage`. Kein Server, keine Konten, kein Tracking.

## Datengrundlage

- **Kaufwerte je Regierungsbezirk 2024** — Bayerisches Landesamt für Statistik,
  Pressemitteilung 278/2025 zum Statistischen Bericht M1700C. Bayernweit
  77.721 €/ha aus 5.965 Verkäufen über 8.167 ha.
  Oberbayern 150.382 · Niederbayern 126.989 · Oberpfalz 63.875 ·
  Mittelfranken 59.511 · Unterfranken 29.715 · Oberfranken 26.801 €/ha.
  **Für Schwaben war in der Pressemitteilung kein Bezirkswert ausgewiesen** —
  die App weist das als `k. A.` aus und rechnet dort mit dem Landesdurchschnitt,
  statt einen Wert zu erfinden.
- **Grünland Bayern 2024** — 60.335 €/ha, höchster Wert aller Bundesländer
  (bundesweit 26.794 €/ha).
- **Wald Bayern** — rund 29.000 €/ha gegenüber etwa 12.700 €/ha im Bundesschnitt.
- **Grunderwerbsteuer Bayern** — 3,5 %.
- **Tagwerk** — 3.407,27 m².

## Rechenweg für das Preisband

Für Wald und Grünland existiert keine amtliche Statistik je Regierungsbezirk.
Die App leitet das Band deshalb transparent ab:

```
regionalFaktor = (kaufwert_bezirk / 77.721) ^ 0,65
mittelwert     = basiswert_bayern × regionalFaktor
band           = 0,6 × mittelwert  …  1,7 × mittelwert
```

Der Exponent 0,65 dämpft die Streuung: Die Kaufwertestatistik erfasst
landwirtschaftliche Flächen und wird stark von Ackerland geprägt, dessen Preise
regional deutlich weiter auseinanderliegen als die von Wald und Wiese.

Die Kalibrierung passt zu den publizierten Beobachtungen — für Oberbayern
liefert das Modell 2,67–7,57 €/m², was die berichteten „6 bis 8 €/m² keine
Seltenheit" trifft, für Oberfranken 0,87–2,47 €/m².

Das Band ist eine **Orientierung, kein Gutachten**. Den amtlichen Wert für eine
konkrete Lage liefert [BORIS-Bayern](https://www.boris-bayern.de/).

## Bekannte Einschränkungen

- Die Deep-Links zu ImmobilienScout24 verwenden generierte Geo-Slugs. Die
  Netzwerk-Policy der Entwicklungsumgebung erlaubte keine Live-Prüfung der
  einzelnen Kreis-URLs, deshalb hat jede Regionalsuche einen bayernweiten
  Fallback-Link daneben.
- Kreisfreie Städte sind nicht in der Landkreis-Auswahl — Wald- und
  Wiesenflächen liegen praktisch immer im Landkreis.

Keine Rechts-, Steuer- oder Anlageberatung. Alle Angaben ohne Gewähr.
