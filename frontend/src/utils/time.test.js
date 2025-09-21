import { describe, it, expect } from 'vitest'
import { formatRelativeShortEs } from './time'

describe('formatRelativeShortEs', () => {
  const now = new Date('2025-09-20T12:00:00.000Z')

  it('returns ahora for <60s', () => {
    const d = new Date(now.getTime() - 30 * 1000)
    expect(formatRelativeShortEs(d, now)).toBe('ahora')
  })

  it('minutes format', () => {
    const d = new Date(now.getTime() - 5 * 60 * 1000)
    expect(formatRelativeShortEs(d, now)).toBe('hace 5min')
  })

  it('hours format', () => {
    const d = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    expect(formatRelativeShortEs(d, now)).toBe('hace 2h')
  })

  it('days format', () => {
    const d = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    expect(formatRelativeShortEs(d, now)).toBe('hace 2 dias')
  })

  it('weeks format', () => {
    const d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    expect(formatRelativeShortEs(d, now)).toBe('hace 2 sem')
  })

  it('months format', () => {
    const d = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000)
    expect(formatRelativeShortEs(d, now)).toBe('hace 3 mes')
  })

  it('years format', () => {
    const d = new Date(now.getTime() - 4 * 365 * 24 * 60 * 60 * 1000)
    expect(formatRelativeShortEs(d, now)).toBe('hace 4 añ')
  })
})
