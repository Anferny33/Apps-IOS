# Schirm-Schwelle und Vergleich mit gestern – Spezifikation

Stand: 9. Oktober 2026. Betrifft `wetter-core.js`, `design.js`, `tests/`. Ein neues Abfragefeld (`past_days`).

## Ziel

Zwei Punkte aus der UI/UX-Durchsicht vom 8. Oktober: Der Hinweis „Schirm einpacken“ erscheint
bisher, sobald eine einzige Viertelstunde 0,1 mm erreicht. Künftig wägt der Rat Menge, Intensität
und Wahrscheinlichkeit ab. Außerdem zeigt das Hero, wie sich die aktuelle Temperatur zu gestern
um dieselbe Uhrzeit verhält.

## Schirm-Schwelle

Die Regenkarte und der Satz „Regen ab ca. 14:45 Uhr · ca. 0,1 mm“ bleiben wie bisher ab 0,1 mm in
einer Viertelstunde. Nur die Zeile darunter und das Symbol im Hinweisfeld ändern sich.

Drei Stufen aus der Summe der nächsten 4 Stunden und der stärksten Viertelstunde:

| Stufe | Bedingung | Text | Symbol |
|---|---|---|---|
| Tropfen | Summe unter 0,5 mm und keine Viertelstunde ab 0,3 mm | Nur ein paar Tropfen, kein Schirm nötig | Tropfen |
| Leicht | Summe unter 2 mm und keine Viertelstunde ab 0,6 mm | Leichter Regen, eine Kapuze reicht | Schirm, ruhig |
| Schirm | sonst | Schirm einpacken | Schirm mit Regen (bisher) |

Wahrscheinlichkeit: das höchste Regenrisiko der Stunden im Nowcast-Fenster (aktuelle Stunde plus
vier), aus dem Ensemble, sonst aus der Stundenwahrscheinlichkeit. Liegt es bekannt unter 30 %,
werden die Texte vorsichtiger: „Vielleicht ein paar Tropfen, Risiko 25 %“, „Leichter Regen
möglich, Risiko 25 %“, „Schirm zur Sicherheit, Risiko 25 %“. Das Symbol folgt der Stufe.

## Vergleich mit gestern

Daten: Die Vorhersage-Abfrage erhält `past_days: 1`. Die Datenschicht trennt alles vor dem
heutigen Datum (Ortszeit aus `current.time`) als `fc.past` ab (`hourly`, `minutely_15`, `daily`)
und schneidet die drei Blöcke auf heute zu. Die Grenze ist das Datum, nicht eine Anzahl Werte,
damit Tage mit 23 oder 25 Stunden (Zeitumstellung) stimmen. Alle übrigen Funktionen sehen
weiterhin Tag 0 als heute. Gespeicherte Daten ohne `past` zeigen keinen Vergleich.

Rechnung: aktuelle Temperatur minus Modelltemperatur gestern zur selben Uhrzeit, linear zwischen
den beiden Nachbarstunden interpoliert; die Stunde nach 23 Uhr gestern ist 0 Uhr heute. Die
Differenz wird auf ganze Grad gerundet. Fehlt die Stunde (Zeitumstellung, Lücke), gibt es keinen
Vergleich.

Darstellung: vierter Chip im Hero, nur im Jetzt-Zustand, nicht in der Zeitreise-Vorschau. Texte
„2° wärmer als gestern“, „3° kälter als gestern“, bei gerundeter Null „Wie gestern“. Der Chip
blendet sich wie die anderen gestaffelt ein und rutscht auf dem iPhone in eine zweite Zeile.

Einschränkung: Die Werte von gestern stammen aus dem Modelllauf, nicht aus einer Messstation.

## Tests

- Abtrennen des Vortags: Stunden, Viertelstunden, Tage beginnen mit heute; Vortag mit 23 Stunden
  wird vollständig abgetrennt; Daten ohne Vortag bleiben unverändert und ohne `past`.
- Vergleich: wärmer, kälter, „Wie gestern“, Interpolation über Mitternacht, kein Vortag.
- Hero: Chip nur im Jetzt-Zustand; Abfrage-URL enthält `past_days=1`.
- Rat: drei Stufen, Vorsicht unter 30 %, Symbol je Stufe, Rendern im Hinweisfeld.

Versions-Query auf `20261009h`.
