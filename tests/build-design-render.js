// Baut aus design.html + gerenderten Inhalten eine statische Vorschau (Tiefen-genaues Einsetzen).
const fs = require('fs');
const r = JSON.parse(fs.readFileSync(__dirname + '/render-design.json', 'utf8'));
let h = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
// Vorschau wahlweise im modernen (Standard) oder klassischen Design: DESIGN=classic
const cssFile = process.env.DESIGN === 'classic' ? 'design.css' : 'modern.css';
const css = fs.readFileSync(require('path').join(__dirname, '..', cssFile), 'utf8');
h = h.replace(/<link rel="stylesheet" href="modern\.css[^"]*" id="cssModern">/, '<style>' + css + '</style>');
h = h.replace(/<link rel="stylesheet" href="design\.css[^"]*" id="cssClassic" disabled>/, '');
if (process.env.DESIGN === 'classic') h = h.replace('data-design="modern"', 'data-design="classic"');
h = h.replace(/<script[\s\S]*?<\/script>\s*/g, '');
h = h.replace('<body class="theme-partly-day">', '<body class="' + r.theme + '">');

function inject(id, html) {
  const m = h.match(new RegExp('<([a-z]+) [^>]*id="' + id + '"[^>]*>'));
  if (!m) throw new Error('id fehlt: ' + id);
  const tag = m[1];
  const openStart = m.index, contentStart = openStart + m[0].length;
  // schließendes Tag per Tiefenzählung finden
  const re = new RegExp('<\\/?' + tag + '\\b', 'g');
  re.lastIndex = contentStart;
  let depth = 1, mm, closeStart = -1;
  while ((mm = re.exec(h))) {
    if (mm[0][1] === '/') depth--; else depth++;
    if (depth === 0) { closeStart = mm.index; break; }
  }
  // Skelett-Klasse entfernen (sowohl class="skel" als auch class="… skel"), sonst bleibt der Text transparent
  const open = m[0].replace(/ class="skel"/, '').replace(' skel', '').replace(/ style="[^"]*"/, '');
  h = h.slice(0, openStart) + open + html + h.slice(closeStart);
}
['hero','warnings','insight','hourly','nowcast','days','details','models'].forEach(id => inject(id, r[id]));
h = h.replace('class="field white a-up hidden" id="nowcastCard"', 'class="field white a-up" id="nowcastCard"');
h = h.replace('class="field dark insight a-up hidden" id="insight"', 'class="field dark insight a-up" id="insight"');
h = h.replace('Standort …', 'München, Bayern');
h = h.replace('<span id="updated"></span>', '<span id="updated">Stand 08.10., 09:15 Uhr</span>');
const extra = process.argv[2] || '';
h = h.replace('</style>', ' ' + extra + '</style>');
fs.writeFileSync(process.argv[3] || (__dirname + '/render-design.html'), h);
console.log('ok', h.length, 'skel left:', (h.match(/skel/g) || []).length);
