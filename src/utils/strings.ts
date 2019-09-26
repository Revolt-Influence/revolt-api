// Imports were messing up for some reason, require instead
const createEmojiRegex = require('emoji-regex')

// Change casing and remove accents
function normalizeString(text: string): string {
  const smallText = text.toLowerCase()
  // Got from StackOverflow, not to be overly trusted
  return smallText.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Regex to match any emoji or special character
const weirdCharacterRegex = new RegExp(`${createEmojiRegex().source}|[^a-z0-9]`)

function wordIsInText(text: string, word: string): boolean {
  // Ignore casing and accents
  const normalText = normalizeString(text)
  const normalWord = normalizeString(word)
  // Split text around special characters
  const allExtracts = normalText.split(weirdCharacterRegex).filter(extract => extract.length > 0)
  // Check each sub-string individually (even if there's only one)
  return allExtracts.some(extract => extract === normalWord)
}

export { normalizeString, wordIsInText }
