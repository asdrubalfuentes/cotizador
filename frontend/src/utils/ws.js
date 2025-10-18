export function connectWS(url, { token, onMessage, onOpen, onClose, onError } = {}) {
  const full = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url
  let ws
  try {
    ws = new WebSocket(full)
  } catch (e) {
    onError && onError(e)
    return { close() {} }
  }
  if (onOpen) ws.addEventListener('open', onOpen)
  if (onClose) ws.addEventListener('close', onClose)
  if (onError) ws.addEventListener('error', onError)
  if (onMessage) ws.addEventListener('message', (ev) => {
    try { onMessage(JSON.parse(ev.data)) } catch { /* ignore */ }
  })
  return {
    close() { try { ws && ws.close && ws.close() } catch { /* ignore */ } }
  }
}
