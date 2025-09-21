// Utilidad para mostrar tiempos relativos en español corto
// Ejemplos: "hace 1min", "hace 2h", "hace 2 dias", "hace 2 sem", "hace 3 mes", "hace 4 añ"

export function formatRelativeShortEs(inputDate, now = new Date()) {
  try {
    if (!inputDate) return ''
    const d = typeof inputDate === 'string' || typeof inputDate === 'number' ? new Date(inputDate) : inputDate
    if (isNaN(d.getTime())) return ''

    const diffMs = Math.max(0, now.getTime() - d.getTime())
    const sec = Math.floor(diffMs / 1000)
    if (sec < 60) return 'ahora'

    const min = Math.floor(sec / 60)
    if (min < 60) return `hace ${min}min`

    const hrs = Math.floor(min / 60)
    if (hrs < 24) return `hace ${hrs}h`

    const days = Math.floor(hrs / 24)
    if (days < 7) return `hace ${days} dias`

    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `hace ${weeks} sem`

    const months = Math.floor(days / 30)
    if (months < 12) return `hace ${months} mes`

    const years = Math.floor(days / 365)
    return `hace ${years} añ`
  } catch (_e) {
    return ''
  }
}

export default {
  formatRelativeShortEs
}
