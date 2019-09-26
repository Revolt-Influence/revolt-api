import { arrayDiff } from '../src/utils/array'

test('get array difference', async done => {
  const a = ['first', 'second']
  const b = ['first', 'second', 'third', 'fourth']
  expect(arrayDiff(a, b)).toEqual(['third', 'fourth'])
  const c = [2, 4, 6]
  const d = [6, 4, 2]
  expect(arrayDiff(c, d)).toEqual([])
  done()
})
