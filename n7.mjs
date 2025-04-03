import fs from 'fs';
import path from 'path';

const wordsFilePath = path.join(process.cwd(), 'words.txt');
const rawWords = fs.readFileSync(wordsFilePath, 'utf-8');
const wordList = rawWords
  .split('\n')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)
  .sort();

const wordIndexMap = new Map();
wordList.forEach((word, index) => {
  wordIndexMap.set(word, index);
});

// Same as before
function stripPunctuation(token) {
  const match = token.match(/^(\W*)([\w'-]+)(\W*)$/);
  if (!match) {
    return {
      prefix: '',
      core: token,
      suffix: ''
    };
  }
  return {
    prefix: match[1],
    core: match[2],
    suffix: match[3]
  };
}

// Same as before
function matchCase(originalWord, newWord) {
  if (originalWord === originalWord.toUpperCase()) {
    return newWord.toUpperCase();
  } else if (/^[A-Z]/.test(originalWord) && originalWord.slice(1) === originalWord.slice(1).toLowerCase()) {
    return newWord.charAt(0).toUpperCase() + newWord.slice(1).toLowerCase();
  } else {
    return newWord.toLowerCase();
  }
}

export function transformN7(inputText) {
  const tokens = inputText.split(/\s+/);

  const transformedTokens = tokens.map((token) => {
    const { prefix, core, suffix } = stripPunctuation(token);

    // Check if the core ends in 's' or 'S'
    let isPlural = false;
    let baseCore = core; // we might strip off the 's'
    if (baseCore.length > 1) {
      const lastChar = baseCore.slice(-1);
      if (lastChar === 's' || lastChar === 'S') {
        isPlural = true;
        // remove the last character from core before lookup
        baseCore = baseCore.slice(0, -1);
      }
    }

    // Convert to lowercase for dictionary lookup
    const lowerCore = baseCore.toLowerCase();

    // If it's in our dictionary
    if (wordIndexMap.has(lowerCore)) {
      const oldIndex = wordIndexMap.get(lowerCore);
      const newIndex = oldIndex + 7;

      if (newIndex < wordList.length) {
        let newWord = wordList[newIndex]; // e.g. "appointee"
        // Re-apply the original word's case pattern (on the base, ignoring final s)
        newWord = matchCase(baseCore, newWord);

        // If it was plural, re-attach "s" or "S"
        if (isPlural) {
          // We can decide to always append lowercase 's', or if the removed char was uppercase, add 'S'
          // For simplicity, let's do the same letter we removed:
          const lastRemovedChar = core.slice(-1); // 's' or 'S'
          newWord += lastRemovedChar;
        }

        return prefix + newWord + suffix;
      } else {
        // out of range → unchanged
        return token;
      }
    } else {
      // not found in dictionary => unchanged
      return token;
    }
  });

  return transformedTokens.join(' ');
}
