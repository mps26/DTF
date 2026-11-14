import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const DIST_DIR = path.resolve('dist');
const PORT = 4173;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json'
};

// 1. Static file server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(DIST_DIR, reqPath);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback
    const indexHtml = path.join(DIST_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexHtml).pipe(res);
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
  
  // 2. Launch Chrome
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9222;
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    '--hide-scrollbars'
  ]);

  // Give Chrome a moment to start
  await new Promise(r => setTimeout(r, 1500));

  try {
    // 3. Get websocket debugger URL
    const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    const versionData = await res.json();
    const wsUrl = versionData.webSocketDebuggerUrl;
    console.log(`Connected to Chrome CDP at: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const curId = id++;
        const handler = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.id === curId) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    };

    // Create a new target page
    const target = await send('Target.createTarget', { url: `http://127.0.0.1:${PORT}` });
    const targetWs = new WebSocket(`ws://127.0.0.1:${debugPort}/devtools/page/${target.targetId}`);
    await new Promise(r => targetWs.onopen = r);

    const sendPage = (method, params = {}) => {
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

    await sendPage('Page.enable');
    await sendPage('DOM.enable');

    const viewports = [
      { name: '320x568 (Small mobile)', w: 320, h: 568 },
      { name: '360x800 (Standard mobile)', w: 360, h: 800 },
      { name: '375x812 (iPhone standard)', w: 375, h: 812 },
      { name: '390x844 (iPhone 12/13/14)', w: 390, h: 844 },
      { name: '414x896 (iPhone Plus)', w: 414, h: 896 },
      { name: '768x1024 (Tablet portrait)', w: 768, h: 1024 },
      { name: '1024x768 (Tablet landscape)', w: 1024, h: 768 },
      { name: '1280x800 (Small laptop)', w: 1280, h: 800 },
      { name: '1366x768 (Standard laptop)', w: 1366, h: 768 },
      { name: '1440x900 (Desktop)', w: 1440, h: 900 },
      { name: '1920x1080 (Large desktop)', w: 1920, h: 1080 }
    ];

    fs.mkdirSync(path.resolve('scratch/screenshots'), { recursive: true });

    console.log('\n--- TESTING VIEWPORT SIZES ---');

    for (const vp of viewports) {
      await sendPage('Emulation.setDeviceMetricsOverride', {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 1,
        mobile: vp.w < 768
      });

      await sendPage('Page.navigate', { url: `http://127.0.0.1:${PORT}` });
      await new Promise(r => setTimeout(r, 600));

      const evalRes = await sendPage('Runtime.evaluate', {
        expression: `(() => {
          const docW = document.documentElement.scrollWidth;
          const winW = window.innerWidth;
          const bodyW = document.body.scrollWidth;
          const overflow = docW > winW || bodyW > winW;
          
          // Check for overflowing elements
          const overflowEls = [];
          document.querySelectorAll('*').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > winW + 1) {
              overflowEls.push({
                tag: el.tagName,
                cls: (el.className || '').toString().slice(0, 40),
                right: Math.round(rect.right),
                excess: Math.round(rect.right - winW)
              });
            }
          });

          // Check mobile hamburger menu on mobile
          const hamburger = document.querySelector('button[aria-label="Open mobile navigation menu"]');
          const isHamburgerVisible = hamburger ? (window.getComputedStyle(hamburger).display !== 'none') : false;

          return {
            winW,
            docW,
            bodyW,
            overflow,
            overflowCount: overflowEls.length,
            overflowSample: overflowEls.slice(0, 3),
            isHamburgerVisible
          };
        })()`,
        returnByValue: true
      });

      const metrics = evalRes.result.value;
      const status = !metrics.overflow ? '✓ PASS' : '✗ FAIL (OVERFLOW)';
      console.log(`[${status}] ${vp.name.padEnd(28)} | win: ${metrics.winW}px | docScroll: ${metrics.docW}px | overflow: ${metrics.overflow} | hamburger: ${metrics.isHamburgerVisible}`);
      
      if (metrics.overflowCount > 0) {
        console.log(`    Excess elements:`, JSON.stringify(metrics.overflowSample));
      }

      // Take a screenshot
      const shot = await sendPage('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.resolve(`scratch/screenshots/${vp.w}x${vp.h}.png`), Buffer.from(shot.data, 'base64'));
    }

    console.log('\nAll viewport tests completed. Screenshots saved to scratch/screenshots/\n');

    targetWs.close();
    ws.close();
  } catch (err) {
    console.error('Error during testing:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});

