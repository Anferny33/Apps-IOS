// Rendert icons/icon.svg zu den PNG-Größen für Homescreen und Manifest.
// Braucht Playwright mit Chromium. Das Projekt hat bewusst keine Abhängigkeiten in package.json,
// deshalb einmalig ohne Eintrag bereitstellen:
//   npm install --no-save playwright && npx playwright install chromium
// Aufruf: node tests/build-icons.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const REPO = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(REPO, 'icons', 'icon.svg'), 'utf8');
const SIZES = [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]];

(async () => {
  const browser = await chromium.launch();
  for (const [file, size] of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent('<!doctype html><html><body style="margin:0;background:#F6D35B">' +
      svg.replace(/width="1024" height="1024"/, 'width="' + size + '" height="' + size + '"') + '</body></html>');
    await page.screenshot({ path: path.join(REPO, 'icons', file), omitBackground: false });
    await page.close();
    console.log('geschrieben: icons/' + file, size + 'x' + size);
  }
  await browser.close();
})();
