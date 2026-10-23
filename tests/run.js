// Testläufer für npm test: führt alle Suiten nacheinander aus (ohne Abhängigkeiten), reicht jede
// Ausgabe sofort durch, druckt am Ende eine Zusammenfassung je Suite und endet mit Exit-Code 1,
// sobald eine Suite fehlschlägt. Anders als die frühere &&-Kette laufen auch nach einer roten
// Suite alle weiteren noch.
// Aufruf: node tests/run.js
const path = require('path');
const { spawn } = require('child_process');

// DUMP=1 für smoke-design.js: schreibt render-design.json, das build-design-render.js braucht
const SUITES = [
    { file: 'smoke-design.js', env: { DUMP: '1' } },
    { file: 'smoke-radar.js' },
    { file: 'smoke-sw.js' },
    { file: 'smoke-push.js' }
];

function runSuite(suite) {
    return new Promise(function (resolve) {
        console.log('\n=== ' + suite.file + ' ===');
        const chunks = [];
        const child = spawn(process.execPath, [path.join(__dirname, suite.file)], {
            env: Object.assign({}, process.env, suite.env || {}),
            stdio: ['ignore', 'pipe', 'pipe']
        });
        /* Ausgabe durchreichen und zugleich für die Zusammenfassung sammeln */
        child.stdout.on('data', function (c) { chunks.push(c); process.stdout.write(c); });
        child.stderr.on('data', function (c) { chunks.push(c); process.stderr.write(c); });
        child.on('error', function (e) {
            console.error(suite.file + ': ' + e.message);
            resolve({ file: suite.file, code: 1, ok: 0, fail: 0 });
        });
        child.on('close', function (code) {
            const out = Buffer.concat(chunks).toString('utf8');
            resolve({
                file: suite.file,
                code: code === null ? 1 : code,
                ok: (out.match(/^  ok   /gm) || []).length,
                fail: (out.match(/^  FAIL /gm) || []).length
            });
        });
    });
}

(async function () {
    const results = [];
    for (const suite of SUITES) results.push(await runSuite(suite));
    const bad = results.filter(function (r) { return r.code !== 0 || r.fail > 0; });
    console.log('\nZusammenfassung:');
    results.forEach(function (r) {
        const state = r.code === 0 && r.fail === 0 ? 'ok  ' : 'FAIL';
        console.log('  ' + state + ' ' + r.file.padEnd(16) + ' ' + String(r.ok).padStart(4) + ' ok, ' + r.fail + ' FAIL' + (r.code !== 0 ? ' (Exit-Code ' + r.code + ')' : ''));
    });
    console.log(bad.length === 0 ? '\nAlle Suiten bestanden.' : '\n' + bad.length + ' Suite(n) fehlgeschlagen.');
    process.exit(bad.length ? 1 : 0);
})();
