// Baut die Vorschau im iPhone-Rahmen: die echte App (lokaler Arbeitsstand) mit
// eingebettetem CSS/JS in einem iframe, fester Standort statt GPS.
// Aufruf: node build-phone-preview.js [index|klassisch] [lat] [lon] [Ortsname]
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const page = process.argv[2] || 'index';
const lat = parseFloat(process.argv[3] || '48.137');
const lon = parseFloat(process.argv[4] || '11.575');
const name = process.argv[5] || 'München, Bayern';

let app = fs.readFileSync(path.join(REPO, page + '.html'), 'utf8');

// CSS- und JS-Dateien inline einbetten, damit die Vorschau aus einer Datei besteht
app = app.replace(/<link rel="stylesheet" href="([a-z-]+\.css)">/g, (m, f) =>
  '<style>' + fs.readFileSync(path.join(REPO, f), 'utf8') + '</style>');
app = app.replace(/<script src="([a-z-]+\.js)"><\/script>/g, (m, f) =>
  '<script>' + fs.readFileSync(path.join(REPO, f), 'utf8') + '</script>');

// Fester Vorschau-Standort vor dem App-Start
app = app.replace('<script>', '<script>window.PREVIEW_LOC = ' + JSON.stringify({ lat, lon, name }) + ';</script>\n<script>');

// iOS-Safe-Areas nachbilden: im Rahmen liefert env(safe-area-inset-*) 0,
// auf dem iPhone sitzt der Inhalt unter Dynamic Island und über dem Home-Balken
app = app.replace('</head>', '<style>.top{padding-top:62px !important} .tabs{padding-bottom:28px !important} ' +
  'body.classic-preview{padding-top:70px}</style></head>');
if (page !== 'index') app = app.replace('<body', '<body class="classic-preview"');

// Navigation innerhalb der Vorschau auf die Live-Seite umbiegen (lokale Dateien gibt es im Rahmen nicht)
app = app.replace(/href="(klassisch|radar|index|box-breathing)\.html"/g, 'href="https://anferny33.github.io/Apps-IOS/$1.html" target="_blank"');

const stamp = new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const frame = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>iPhone-Vorschau</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: #0e1117; color: #c9d1d9;
         font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         display: flex; flex-direction: column; align-items: center; padding: 14px 10px 24px; gap: 12px; }
  .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center; }
  .bar b { color: #fff; }
  .bar button { font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid #3a4150; background: #1c2230; color: #fff; cursor: pointer; }
  .stage { transform-origin: top center; }
  .device { position: relative; width: 414px; height: 868px; border-radius: 62px; background: #111;
            box-shadow: 0 0 0 2px #2a2f3a, 0 30px 60px rgba(0,0,0,0.6); padding: 12px; }
  .screen { position: relative; width: 390px; height: 844px; border-radius: 50px; overflow: hidden; background: #000; }
  .screen iframe { width: 390px; height: 844px; border: 0; display: block; background: #0b1a33; }
  .island { position: absolute; top: 11px; left: 50%; transform: translateX(-50%); width: 120px; height: 34px; border-radius: 20px; background: #000; z-index: 5; }
  .home { position: absolute; bottom: 9px; left: 50%; transform: translateX(-50%); width: 134px; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.85); z-index: 5; pointer-events: none; }
  .hint { max-width: 420px; text-align: center; color: #8b949e; line-height: 1.5; }
</style>
</head>
<body>
  <div class="bar">
    <span>Vorschau: <b>lokaler Arbeitsstand</b> von <b>${page}.html</b> · gebaut ${stamp}</span>
    <button type="button" id="reload">↻ Neu laden</button>
  </div>
  <div class="stage" id="stage">
    <div class="device">
      <div class="screen">
        <div class="island"></div>
        <iframe id="app" title="App-Vorschau" allow="geolocation"></iframe>
        <div class="home"></div>
      </div>
    </div>
  </div>
  <div class="hint">Die App lädt echte Wetterdaten über deinen Browser. Standort in der Vorschau: ${name} (kein GPS im Rahmen – über den Ortsnamen oben kannst du jeden Ort suchen).</div>
<script>
  const APP_HTML = ${JSON.stringify(app).replace(/<\//g, '<\\/')};
  const f = document.getElementById('app');
  function boot() { f.srcdoc = APP_HTML; }
  document.getElementById('reload').addEventListener('click', boot);
  function fit() {
    const avail = Math.max(300, window.innerWidth - 20);
    const s = Math.min(1, avail / 414);
    const st = document.getElementById('stage');
    st.style.transform = 'scale(' + s + ')';
    st.style.height = (868 * s) + 'px';
  }
  window.addEventListener('resize', fit);
  fit(); boot();
</script>
</body>
</html>`;

const out = path.join(__dirname, 'iphone-preview.html');
fs.writeFileSync(out, frame);
console.log('geschrieben:', out, (frame.length / 1024).toFixed(0) + ' KB');
