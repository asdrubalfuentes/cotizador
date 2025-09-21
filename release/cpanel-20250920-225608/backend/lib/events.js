const clients = new Set();

function addClient(res) {
  clients.add(res);
  return () => clients.delete(res);
}

function broadcast(event, payload) {
  const data = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch (_) { clients.delete(res); }
  }
}

module.exports = { addClient, broadcast };
