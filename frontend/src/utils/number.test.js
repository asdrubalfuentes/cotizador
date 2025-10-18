import { describe, it, expect } from 'vitest'
import { formatNumberDot, formatAmount, formatRate } from './number'

describe('number formatting utils', () => {
  it('formatNumberDot with thousands and default 0 decimals', () => {
    expect(formatNumberDot(1234567)).toBe('1.234.567')
    expect(formatNumberDot(0)).toBe('0')
  })

  it('formatNumberDot with decimals using comma', () => {
    expect(formatNumberDot(1234.5, 2)).toBe('1.234,50')
    expect(formatNumberDot(12.3456, 4)).toBe('12,3456')
  })

  it('formatAmount respects currency decimals (CLP 0, others 1)', () => {
    expect(formatAmount(1234567, 'CLP')).toBe('1.234.567 CLP')
    expect(formatAmount(1234.5, 'USD')).toBe('1.234,5 USD')
  })

  it('formatRate shows 1 decimal (project rule)', () => {
    expect(formatRate(1.23456)).toBe('1,2')
  })
})
