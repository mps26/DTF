// Browser test suite for AI background removal. In the dev app's console:
//   (await import('/scratch/bg_suite.js')).run()        // all cases
//   (await import('/scratch/bg_suite.js')).run(['svg'])  // selected cases
// Results: window.__out (subject % or error), window.__res (PNG data URLs),
// window.__done; show() overlays a labelled grid of results on a checkerboard.
export async function run(only) {
  window.__done = false; window.__out = {}; window.__res = {}; window.__in = {};
  const m = await import('/src/utils/aiBackgroundRemoval.ts');
  const toUrl = async (p) => { const b = await (await fetch(p)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); };
  const forest = new Image(); forest.src = '/scratch/forest_camping.png'; await forest.decode();
  const mk = (W, H, f, type = 'image/png', q) => { const c = document.createElement('canvas'); c.width = W; c.height = H; f(c.getContext('2d'), W, H); return c.toDataURL(type, q); };
  const svg = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#fff"/><circle cx="200" cy="150" r="100" fill="#e63946"/><text x="200" y="165" font-size="48" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">SALE</text></svg>');
  const cases = {
    badge: () => toUrl('/scratch/unrelated_badge.png'),
    forestPng: () => toUrl('/scratch/forest_camping.png'),
    forestJpg: () => mk(600, 600, (x, W, H) => { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(forest, 100, 80, 400, 465); }, 'image/jpeg', 0.8),
    gradient: () => mk(900, 700, (x, W, H) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7ab8e8'); g.addColorStop(1, '#f4efe6'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.drawImage(forest, 250, 80, 400, 465); }, 'image/jpeg', 0.85),
    text: () => mk(900, 400, (x) => { x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 400); x.fillStyle = '#c0392b'; x.font = 'bold 150px Arial'; x.fillText('BOOGIE', 60, 180); x.fillStyle = '#1d3557'; x.font = 'bold 90px Georgia'; x.fillText('Approved ®', 120, 330); }, 'image/jpeg', 0.9),
    svg: () => svg,
    tiny: () => mk(24, 24, (x) => { x.fillStyle = '#fff'; x.fillRect(0, 0, 24, 24); x.fillStyle = '#06c'; x.fillRect(6, 6, 12, 12); }),
    webp: () => mk(500, 500, (x, W, H) => { x.fillStyle = '#f0f0f0'; x.fillRect(0, 0, W, H); x.drawImage(forest, 60, 40, 380, 440); }, 'image/webp', 0.85),
    touchBorder: () => mk(400, 400, (x, W, H) => { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(forest, -60, 40, 520, 600); }, 'image/jpeg', 0.85),
    softEdge: () => mk(400, 400, (x) => { const g = x.createRadialGradient(200, 200, 60, 200, 200, 160); g.addColorStop(0, 'rgba(200,30,90,1)'); g.addColorStop(1, 'rgba(200,30,90,0)'); x.fillStyle = g; x.fillRect(0, 0, 400, 400); x.fillStyle = '#111'; x.font = 'bold 60px Arial'; x.fillText('GLOW', 120, 220); }),
    solid: () => mk(300, 300, (x) => { x.fillStyle = '#888'; x.fillRect(0, 0, 300, 300); }),
  };
  const rerun = new Set(['forestJpg', 'touchBorder', 'forestPng']);
  for (const [k, f] of Object.entries(cases)) {
    if (only && !only.includes(k)) continue;
    const u = await f();
    window.__in[k] = u;
    try {
      const r = await m.removeBackgroundAI(u);
      window.__out[k] = +r.subjectPercent.toFixed(1);
      window.__res[k] = r.dataUrl;
      if (rerun.has(k)) {
        try { const r2 = await m.removeBackgroundAI(r.dataUrl); window.__out[k + '_rerun'] = +r2.subjectPercent.toFixed(1); window.__res[k + '_rerun'] = r2.dataUrl; }
        catch (e) { window.__out[k + '_rerun'] = 'ERR ' + e.message; }
      }
    } catch (e) { window.__out[k] = 'ERR ' + (e.message || e); }
  }
  window.__done = true;
  return window.__out;
}

export function show(keys, height = 150) {
  document.getElementById('__t')?.remove();
  const d = document.createElement('div');
  d.id = '__t';
  d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:repeating-conic-gradient(#bbb 0 25%,#fff 0 50%) 0 0/20px 20px;display:flex;flex-wrap:wrap;gap:8px;padding:8px;align-content:flex-start;overflow:auto';
  for (const k of keys || Object.keys(window.__res)) {
    d.insertAdjacentHTML('beforeend', `<div style="text-align:center;font:11px sans-serif;background:rgba(255,255,255,.7)"><img src="${window.__res[k]}" style="height:${height}px;max-width:380px;object-fit:contain"><br>${k} ${window.__out[k]}</div>`);
  }
  document.body.appendChild(d);
}
