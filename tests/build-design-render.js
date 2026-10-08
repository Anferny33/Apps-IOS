// Baut aus design.html + gerenderten Inhalten eine statische Vorschau (Tiefen-genaues Einsetzen).
const fs = require('fs');
const r = JSON.parse(fs.readFileSync(__dirname + '/render-design.json', 'utf8'));
let h = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(require('path').join(__dirname, '..', 'design.css'), 'utf8');
h = h.replace('<link rel="stylesheet" href="design.css">', '<style>' + css + '</style>');
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
  const open = m[0].replace(' skel', '').replace(/ style="[^"]*"/, '');
  h = h.slice(0, openStart) + open + html + h.slice(closeStart);
}
['hero','hourly','nowcast','days','details','models'].forEach(id => inject(id, r[id]));
h = h.replace('class="card hidden" id="nowcastCard"', 'class="card" id="nowcastCard"');
h = h.replace('Standort …', 'München, Bayern');
h = h.replace('<span id="updated"></span>', '<span id="updated">Stand 08.10., 09:15 Uhr</span>');
const extra = process.argv[2] || '';
h = h.replace('</style>', ' .hero{min-height:380px} ' + extra + '</style>');
fs.writeFileSync(process.argv[3] || (__dirname + '/render-design.html'), h);
console.log('ok', h.length, 'skel left:', (h.match(/skel/g) || []).length);
