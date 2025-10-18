// Formateo de números con separador de miles '.' y separador decimal ','
// - CLP: sin decimales por defecto
// - Otras monedas: 1 decimal por defecto

export function formatNumberDot(value, decimals = 0) {
  const num = Number(value ?? 0)
  if (!isFinite(num)) return String(value ?? '')
  const fixed = num.toFixed(Math.max(0, decimals))
  const [intPart, decPart] = fixed.split('.')
  const intWithDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decPart !== undefined ? `${intWithDots},${decPart}` : intWithDots
}

export function formatAmount(value, currency = 'CLP') {
  const decimals = currency === 'CLP' ? 0 : 1
  return `${formatNumberDot(value, decimals)} ${currency}`
}

export function formatRate(value) {
  // Factor/tipo de cambio con 1 decimal (regla del proyecto)
  const num = Number(value ?? 0)
  if (!isFinite(num)) return String(value ?? '')
  return formatNumberDot(num, 1)
}
