import { wordIsInText, normalizeString } from '../src/utils/strings'

test('normalize string', () => {
  // Test casing and accent removal
  expect(normalizeString('WORLD CHAMPIONS')).toBe('world champions')
  expect(normalizeString('crème brûlée')).toBe('creme brulee')
  expect(normalizeString('CRÈME BRÛLÉE')).toBe('creme brulee')
  expect(normalizeString('#kony..2012')).toBe('#kony..2012')
  expect(normalizeString('  s p a c e  ')).toBe('  s p a c e  ')
  expect(normalizeString('😱 trololo 😡')).toBe('😱 trololo 😡')
})

test('find word match', () => {
  const text1 = 'New clip available'
  expect(wordIsInText(text1, 'CLIP')).toBe(true)
  expect(wordIsInText(text1, 'lip')).toBe(false)
  expect(wordIsInText(text1, 'new')).toBe(true)
  const text2 = 'Love BANANAS? Check my #snapchat'
  expect(wordIsInText(text2, 'love')).toBe(true)
  expect(wordIsInText(text2, 'bananas')).toBe(true)
  expect(wordIsInText(text2, 'ban')).toBe(false)
  expect(wordIsInText(text2, 'anas')).toBe(false)
  expect(wordIsInText(text2, 'snap')).toBe(false)
  expect(wordIsInText(text2, 'snapchat')).toBe(true)
  const text3 = '#Creme |insta| brûlée'
  expect(wordIsInText(text3, 'crème')).toBe(true)
  expect(wordIsInText(text3, 'insta')).toBe(true)
  expect(wordIsInText(text3, 'bru')).toBe(false)
  expect(wordIsInText(text3, 'eme')).toBe(false)
  const text4 = '💪hello there !meme👏review😱🤠 subscribe to pewdiepie🍆'
  expect(wordIsInText(text4, 'hello')).toBe(true)
  expect(wordIsInText(text4, 'meme')).toBe(true)
  expect(wordIsInText(text4, 'review')).toBe(true)
  expect(wordIsInText(text4, 'pewdiepie')).toBe(true)
  const text5 = 'lifestyle'
  expect(wordIsInText(text5, 'lifestyle')).toBe(true)
  const text6 = 'SNAPCHAT ➡️ KEYZSGS 🇩🇿✌🏼🌍 #PasCommeEux hello☺world'
  expect(wordIsInText(text6, 'chat')).toBe(false)
  expect(wordIsInText(text6, 'hello')).toBe(true)
})
