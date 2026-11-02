#!/usr/bin/env node
// Takes the screenshots in docs/images from the real app, so the README can be brought up to date
// whenever the screens change.
//
//   npm install --no-save playwright && npx playwright install chromium
//   node docs/screenshots.js
//
// It serves this folder on a local port, opens the app in Chromium with a fake microphone (a steady
// tone), loads the three sample clips, records two takes, adds lines and marks, and saves PNGs.
// Speech recognition is replaced by a stand-in that answers at once, so nothing is downloaded.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'images');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const LINES = 'One, two, three, go!\nLa la la, la la la.\nI never said she stole the money.';
const STANDIN = `
  export const env = { allowLocalModels: false, backends: { onnx: { wasm: {} } } };
  export async function pipeline() {
    return async () => ({ text: ' I never said she stole the money.', chunks: [{ text: ' I never said she stole the money.', timestamp: [0.2, 2.4] }] });
  }`;

function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const url = `http://localhost:${srv.address().port}/dub-booth.html`;
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ ...PHONE, colorScheme: 'light', serviceWorkers: 'block' });
  await ctx.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }, body: STANDIN }));
  const page = await ctx.newPage();
  const quiet = () => page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.hidden = true; });
  const shot = async (name, opts = {}) => { await quiet(); await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, name), ...opts }); console.log('saved', name); };
  const tab = async (v) => { await page.click(`#tabs .tab[data-view="${v}"]`); await page.waitForTimeout(250); };
  const scrollTo = (sel, offset = 12) => page.evaluate(([s, o]) => { const w = document.querySelector('.wrap'), el = document.querySelector(s); w.scrollTop += el.getBoundingClientRect().top - o; }, [sel, offset]);

  // ---- welcome
  await page.goto(url);
  await page.waitForSelector('#bSample');
  await shot('welcome.png');

  // ---- a small project: samples, lines, characters
  await page.click('#bSample');
  await page.waitForSelector('#work:not([hidden])');
  await tab('script');
  await page.click('#vScript details.more summary');
  await page.fill('#pasteLines', LINES);
  await page.click('#bPasteLines');
  const chars = ['Anna', 'Ben', 'Anna'];
  for (let i = 0; i < 3; i++) await page.fill(`#scriptTable .st-row:nth-child(${i + 1}) .st-char`, chars[i]);
  await page.click('#vScript .view-head h2'); // moves focus out of the fields

  // ---- two takes on cue 1, and a punch-in over part of it
  await tab('booth');
  await page.click('#bRec');
  await page.waitForFunction(() => !document.getElementById('bRec').classList.contains('is-off'));
  for (let i = 0; i < 2; i++) { await page.click('#bRec'); await page.waitForTimeout(4300); await page.click('#bRec'); await page.waitForTimeout(1600); }
  await page.waitForTimeout(3500);
  await shot('booth.png');

  // selection on the original: where a punch-in goes
  const g = await page.locator('#cvGuide').boundingBox();
  await page.mouse.move(g.x + g.width * 0.3, g.y + g.height / 2); await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(g.x + g.width * (0.3 + 0.25 * k / 8), g.y + g.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await shot('punch-in.png', { clip: { x: 0, y: 150, width: 390, height: 560 } });
  await page.click('#bPosClear').catch(() => {});

  // playback volume, open
  await page.click('#bVolume');
  await shot('volume.png', { clip: { x: 0, y: 470, width: 390, height: 374 } });
  await page.click('#bVolume');

  // ---- cue marks: approve cue 1; keep cue 2's original (it's music)
  await page.click('#bCueMenu');
  await page.click('#bStOk');
  await page.keyboard.press('Escape');
  await page.click('#bNext');
  await page.waitForTimeout(400);
  await page.click('#bCueMenu');
  await page.check('#cueKeep');
  await page.fill('#cueNote', 'Theme song: leave as it is');
  await page.waitForTimeout(200);
  await shot('cue-sheet.png');
  await page.keyboard.press('Escape');
  await page.click('#bNext');
  await page.waitForTimeout(400);
  await page.click('#bCueMenu');
  await page.click('#bStRedo');
  await page.keyboard.press('Escape');

  // ---- the cue list
  await tab('cues');
  await shot('cues.png');

  // ---- script: transcribe cue 3 (stand-in recognizer), then show the list with boxes
  await tab('script');
  await scrollTo('#vScript .group-box:nth-of-type(2)');
  await shot('script.png');
  await page.click('#bAsr');
  await page.waitForFunction(() => !window.__dubBooth.A.asr && /Transcribed/.test(document.getElementById('asrText').textContent));
  await scrollTo('.st-tools', 120);
  await shot('script-list.png');
  await page.click('#asrLang');
  await page.fill('#langSearch', 'ar');
  await shot('language.png');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

  // ---- export, after building the zip
  await tab('export');
  await page.click('#bExport');
  await page.waitForSelector('#expReady:not([hidden])', { timeout: 60000 });
  await scrollTo('#vExport .group-box:nth-of-type(3)', 80);
  await shot('export.png');

  // ---- settings: recording
  await tab('settings');
  await page.check('#micNoise');
  await shot('settings.png');
  await page.uncheck('#micNoise');

  // ---- a computer screen: the cue list beside the booth
  await tab('booth');
  await page.click('#bPrev'); await page.click('#bPrev');
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.waitForTimeout(600);
  await shot('desktop.png');

  await browser.close();
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
