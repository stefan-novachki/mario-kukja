// Headless Chrome driven over the DevTools protocol (Node's own WebSocket, nothing installed):
// open a page of the site, wait until it says it is ready (real time, so Web Workers such as
// the Draco decoder finish), then take a screenshot and/or collect the console.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withPage(urlPath, { w = 1600, h = 900, timeout = 120000, waitFor = "document.body.dataset.ready === '1'", screenshot = null, settle = 400, port = 8130, dpr = 1, evaluate = null } = {}) {
  const srv = spawn(process.execPath, ['tools/serve.mjs', 'site', String(port)], { stdio: 'ignore' });
  const dbg = 9300 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'villa-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run',
    `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  const logs = [];
  let ws;
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) {
      await sleep(150);
      try { target = (await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* starting */ }
    }
    if (!target) throw new Error('chrome did not start');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
      if (msg.method === 'Runtime.consoleAPICalled') logs.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      if (msg.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: dpr > 1 });
    await send('Page.navigate', { url: `http://localhost:${port}/${urlPath}` });
    const t0 = Date.now();
    let ok = false;
    while (Date.now() - t0 < timeout) {
      await sleep(250);
      const r = await send('Runtime.evaluate', { expression: `(() => { try { return !!(${waitFor}); } catch { return false; } })()`, returnByValue: true });
      if (r.result?.result?.value) { ok = true; break; }
    }
    await sleep(settle);
    if (screenshot) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(screenshot, Buffer.from(r.result.data, 'base64'));
    }
    let value;
    if (evaluate) {          // dev: read something out of the page (an expression, may be async)
      const r = await send('Runtime.evaluate', { expression: evaluate, returnByValue: true, awaitPromise: true });
      value = r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description;
    }
    return { ok, ms: Date.now() - t0, logs, value };
  } finally {
    try { ws?.close(); } catch { /* closed */ }
    chrome.kill();
    srv.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* still locked */ }
  }
}
