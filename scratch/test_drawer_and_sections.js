import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const DIST_DIR = path.resolve('dist');
const PORT = 4174;

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
  const debugPort = 9223;
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

    // 1. Mobile 360x800 test
    await send(targetWs, 'Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true
    });
    await send(targetWs, 'Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await new Promise(r => setTimeout(r, 600));

    // Screenshot top hero
    let shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/mobile_hero_360.png'), Buffer.from(shot.data, 'base64'));

    // 2. Open hamburger menu
    await send(targetWs, 'Runtime.evaluate', {
      expression: `document.querySelector('button[aria-label="Open mobile navigation menu"]').click()`
    });
    await new Promise(r => setTimeout(r, 400));
    shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/mobile_drawer_open.png'), Buffer.from(shot.data, 'base64'));

    // 3. Click Sign In inside mobile drawer
    await send(targetWs, 'Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const signInBtn = buttons.find(b => b.textContent.includes('Sign In'));
        if (signInBtn) signInBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 500));
    shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/mobile_auth_modal.png'), Buffer.from(shot.data, 'base64'));

    // Close Auth modal
    await send(targetWs, 'Runtime.evaluate', {
      expression: `document.querySelector('button[title="Close modal"]')?.click()`
    });
    await new Promise(r => setTimeout(r, 400));

    // 4. Scroll down to Preview Console
    await send(targetWs, 'Runtime.evaluate', {
      expression: `window.scrollTo({ top: 600, behavior: 'instant' })`
    });
    await new Promise(r => setTimeout(r, 400));
    shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/mobile_preview_console.png'), Buffer.from(shot.data, 'base64'));

    // 5. Scroll down to Stats & Features
    await send(targetWs, 'Runtime.evaluate', {
      expression: `window.scrollTo({ top: 1350, behavior: 'instant' })`
    });
    await new Promise(r => setTimeout(r, 400));
    shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/mobile_features.png'), Buffer.from(shot.data, 'base64'));

    // 6. Scroll down to FAQ & Footer
    await send(targetWs, 'Runtime.evaluate', {
      expression: `window.scrollTo({ top: 3800, behavior: 'instant' })`
    });
    await new Promise(r => setTimeout(r, 400));
    shot = await send(targetWs, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/screenshots/mobile_faq.png'), Buffer.from(shot.data, 'base64'));

    console.log('Mobile interactive test screenshots saved successfully!');

    targetWs.close();
    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});

