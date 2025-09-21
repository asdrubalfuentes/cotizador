// Minimal SSE helper with reconnection and a callback per event
export function createSSE(url, listeners = {}, { onOpen, onError, retryDelay = 4000 } = {}) {
  let es
  let closed = false
  function connect() {
    if (closed) return
    try {
      es = new EventSource(url)
      if (onOpen) es.addEventListener('open', onOpen)
      es.addEventListener('error', (e) => {
        onError && onError(e)
        try { es.close() } catch (err) { console.warn('SSE close on error failed', err) }
        // Reconnect after delay
        if (!closed) setTimeout(connect, retryDelay)
      })
      Object.entries(listeners).forEach(([event, handler]) => {
        if (typeof handler === 'function') es.addEventListener(event, handler)
      })
    } catch (e) {
      onError && onError(e)
      if (!closed) setTimeout(connect, retryDelay)
    }
  }
  connect()
  return {
    close() {
      closed = true
      try { es && es.close && es.close() } catch (err) { console.warn('SSE close failed', err) }
    }
  }
}

// Utility to toggle a CSS class briefly for feedback
export function flashElement(el, className = 'flash', ms = 600) {
  if (!el) return
  el.classList.add(className)
  setTimeout(() => {
    try { el.classList.remove(className) } catch (err) { /* ignore */ }
  }, ms)
}
