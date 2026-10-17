import englishWords from 'an-array-of-english-words';

// Server-side complete English dictionary (275,000 words: verbs, adjectives, adverbs, nouns, etc.)
// Cached in Node.js memory across API requests
const dictionarySets: Record<number, Set<string>> = {};

function initLengthSet(length: number): Set<string> {
  const set = new Set<string>();

  if (Array.isArray(englishWords)) {
    for (const w of englishWords) {
      if (w.length === length && /^[a-zA-Z]+$/.test(w)) {
        set.add(w.toUpperCase());
      }
    }
  }

  dictionarySets[length] = set;
  return set;
}

export function isServerValidWord(word: string, length: number): boolean {
  if (!word) return false;
  const clean = word.trim().toUpperCase();
  if (clean.length !== length) return false;

  let set = dictionarySets[length];
  if (!set) {
    set = initLengthSet(length);
  }

  return set.has(clean);
}
