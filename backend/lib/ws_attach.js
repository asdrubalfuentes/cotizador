const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const livelog = require('./livelog');

function attachWs(server) {
  const adminWss = new WebSocket.Server({ noServer: true });
  const publicWss = new WebSocket.Server({ noServer: true });
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

  server.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, `http://${req.headers.host}`); } catch (e) { socket.destroy(); return; }
    const pathname = url.pathname || '/';
    if (pathname === '/ws') {
      adminWss.handleUpgrade(req, socket, head, (ws) => {
        // Auth
        let user = null;
        try { user = jwt.verify(url.searchParams.get('token') || '', JWT_SECRET); } catch (e) { user = null; }
        if (!user || user.role !== 'admin') {
          try { ws.close(4001, 'unauthorized'); } catch (e) { /* noop */ }
          return;
        }
        const unsub = livelog.addSubscriber((evt) => {
          try { ws.send(JSON.stringify(evt)); } catch (e) { /* noop */ }
        });
        ws.on('close', () => { try { unsub(); } catch (e) { /* noop */ } });
      });
    } else if (pathname === '/ws-public') {
      publicWss.handleUpgrade(req, socket, head, (ws) => {
        const unsub = livelog.addSubscriber((evt) => {
          if (evt.level === 'error' || evt.level === 'warn') {
            const safe = { ts: evt.ts, level: evt.level, type: evt.type, msg: evt.msg || '' };
            try { ws.send(JSON.stringify(safe)); } catch (e) { /* noop */ }
          }
        });
        ws.on('close', () => { try { unsub(); } catch (e) { /* noop */ } });
      });
    } else {
      socket.destroy();
    }
  });
}

module.exports = { attachWs };
