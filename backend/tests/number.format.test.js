const test = require('node:test')
const assert = require('node:assert/strict')

const { formatNumberDot, formatAmount } = require('../utils/number')

test('formatNumberDot adds dots and comma decimals', () => {
  assert.equal(formatNumberDot(1234567), '1.234.567')
  assert.equal(formatNumberDot(1234.5, 2), '1.234,50')
  assert.equal(formatNumberDot(12.3456, 4), '12,3456')
})

test('formatAmount appends currency and decimals per currency (CLP 0, others 1)', () => {
  assert.equal(formatAmount(1234567, 'CLP'), '1.234.567 CLP')
  assert.equal(formatAmount(1234.5, 'USD'), '1.234,5 USD')
})
