import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const DIST_DIR = path.resolve('dist');
const PORT = 4175;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(DIST_DIR, reqPath);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    const indexHtml = path.join(DIST_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexHtml).pipe(res);
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9224;
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    '--hide-scrollbars'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    const versionData = await res.json();
    const ws = new WebSocket(versionData.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (targetWs, method, params = {}) => {
      return new Promise((resolve, reject) => {
        const curId = id++;
        const handler = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.id === curId) {
            targetWs.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        targetWs.addEventListener('message', handler);
        targetWs.send(JSON.stringify({ id: curId, method, params }));
      });
    };

    const target = await send(ws, 'Target.createTarget', { url: `http://127.0.0.1:${PORT}` });
    const targetWs = new WebSocket(`ws://127.0.0.1:${debugPort}/devtools/page/${target.targetId}`);
    await new Promise(r => targetWs.onopen = r);

    await send(targetWs, 'Page.enable');
    await send(targetWs, 'DOM.enable');

    // Viewport 360x800
    await send(targetWs, 'Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true
    });
    await send(targetWs, 'Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await new Promise(r => setTimeout(r, 600));

    // Scroll to console
    await send(targetWs, 'Runtime.evaluate', {
      expression: `document.querySelector('.mt-10.sm\\\\:mt-14')?.scrollIntoView({ behavior: 'instant', block: 'start' })`
    });
    await new Promise(r => setTimeout(r, 400));
    let shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/scrolled_console_360.png'), Buffer.from(shot.data, 'base64'));

    // Scroll to preflight checklist inside console
    await send(targetWs, 'Runtime.evaluate', {
      expression: `window.scrollBy({ top: 350, behavior: 'instant' })`
    });
    await new Promise(r => setTimeout(r, 400));
    shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/scrolled_preflight_360.png'), Buffer.from(shot.data, 'base64'));

    // Scroll to stats and features
    await send(targetWs, 'Runtime.evaluate', {
      expression: `document.getElementById('features')?.scrollIntoView({ behavior: 'instant', block: 'start' })`
    });
    await new Promise(r => setTimeout(r, 400));
    shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/scrolled_features_360.png'), Buffer.from(shot.data, 'base64'));

    // Tablet 768x1024
    await send(targetWs, 'Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: true
    });
    await send(targetWs, 'Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await new Promise(r => setTimeout(r, 600));
    shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/tablet_hero_768.png'), Buffer.from(shot.data, 'base64'));

    // Desktop 1440x900
    await send(targetWs, 'Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send(targetWs, 'Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await new Promise(r => setTimeout(r, 600));
    shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/desktop_hero_1440.png'), Buffer.from(shot.data, 'base64'));

    console.log('Scrolled section screenshots saved!');

    targetWs.close();
    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});

