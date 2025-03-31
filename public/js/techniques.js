import fs from 'fs';
import path from 'path';

// Load and parse words.txt
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

/**
 * Helper function to strip punctuation from the beginning and end of a token.
 *    Example: "Apple," => prefix "", core "Apple", suffix ","
 */
function stripPunctuation(token) {
  // This regex captures three groups: leading non-word chars, the "core" word, and trailing non-word chars.
  // Explanation:
  //  - ^(\W*)    - Group 1: any non-word characters at the start
  //  - ([\w'-]+) - Group 2: the "core" word (letters, digits, underscore, apostrophes, hyphens). Adjust as needed.
  //  - (\W*)$    - Group 3: any non-word chars at the end
  const match = token.match(/^(\W*)([\w'-]+)(\W*)$/);

  if (!match) {
    // If it doesn't match, we treat the entire token as "prefix" or "core"
    // so the user sees no change in punctuation logic
    return {
      prefix: '',
      core: token,
      suffix: ''
    };
  }

  return {
    prefix: match[1],  // e.g. ""
    core: match[2],    // e.g. "Apple"
    suffix: match[3]   // e.g. ","
  };
}

/**
 * 3) Preserve capitalization of the user's original core word.
 *    - ALL CAPS => keep the new word in ALL CAPS
 *    - Only first letter capital => keep that
 *    - Otherwise => force all-lowercase for the new word
 */
function matchCase(originalWord, newWord) {
  if (originalWord === originalWord.toUpperCase()) {
    // e.g. "APPLE"
    return newWord.toUpperCase();
  } else if (/^[A-Z]/.test(originalWord) && originalWord.slice(1) === originalWord.slice(1).toLowerCase()) {
    // e.g. "Apple" => first letter uppercase, rest lowercase
    return newWord.charAt(0).toUpperCase() + newWord.slice(1).toLowerCase();
  } else {
    // everything else => make the new word lowercase
    return newWord.toLowerCase();
  }
}

/**
 * 4) transformN7
 *    - Strips punctuation
 *    - Looks up the core word in wordIndexMap (case-insensitive)
 *    - Adds 7
 *    - Restores punctuation + capitalization
 */
export function transformN7(inputText) {
  // Split on whitespace to get tokens
  const tokens = inputText.split(/\s+/);

  // transform each token
  const transformedTokens = tokens.map((token) => {
    // 4a) Strip punctuation
    const { prefix, core, suffix } = stripPunctuation(token);

    // e.g. prefix = "", core = "Apple", suffix = ","

    // For dictionary lookup, use lowercase
    const lowerCore = core.toLowerCase();

    if (wordIndexMap.has(lowerCore)) {
      const oldIndex = wordIndexMap.get(lowerCore);
      const newIndex = oldIndex + 7;

      if (newIndex < wordList.length) {
        // We found the 7th word after
        let newWord = wordList[newIndex];
        // e.g. "appointee"

        // 4b) Re-apply user capitalization
        newWord = matchCase(core, newWord);
        // e.g. "Apple" => "Appointee"

        // 4c) Re-attach punctuation
        return prefix + newWord + suffix; // e.g. "Appointee,"
      } else {
        // out of range => keep original token
        return token;
      }
    } else {
      // not in dictionary => unchanged
      return token;
    }
  });

  return transformedTokens.join(' ');
}

//export { transformN7 };

