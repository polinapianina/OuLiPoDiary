// snowball.mjs

// 1) Add ',' to the set of punctuation we strip off the end.
const STOP_CHARS = new Set(['.', '!', '?', ';', ':', ',']);

/**
 * transformSnowball(inputText):
 *  1) Split input by whitespace => tokens.
 *  2) For each token, remove trailing punctuation if in STOP_CHARS.
 *  3) Store (word, length, originalIndex).
 *  4) Sort by length ascending, then originalIndex ascending.
 *  5) Remove duplicates (keeping first occurrence).
 *  6) Capitalize each word (first letter uppercase, rest lowercase).
 *  7) Output as lines joined by '\n'.
 */
export function transformSnowball(inputText) {
  // Split by whitespace
  const tokens = inputText.split(/\s+/);

  // Build array with trailing punctuation removed
  const processed = tokens.map((token, index) => {
    const lastChar = token.slice(-1);
    let word = token;
    if (STOP_CHARS.has(lastChar)) {
      // remove the last char
      word = word.slice(0, -1);
    }
    return {
      word,
      length: word.length,
      originalIndex: index
    };
  });

  // Sort by length ascending, then by original index ascending
  processed.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    return a.originalIndex - b.originalIndex;
  });

  // Remove duplicates, keeping the first occurrence
  // We'll track what we've seen in a Set
  const seen = new Set();
  const unique = [];
  for (const item of processed) {
    // Convert to lowercase for checking duplicates so "THIS" and "this" are considered same
    const lower = item.word.toLowerCase();
    if (!seen.has(lower)) {
      unique.push(item.word);
      seen.add(lower);
    }
  }

  // Capitalize each word: first letter uppercase, rest lowercase
  // E.g. "dog" => "Dog", "WORLD" => "World"
  const capitalized = unique.map(w => {
    if (!w) return w; // edge case if something was empty
    return w[0].toUpperCase() + w.slice(1).toLowerCase();
  });

  // Join lines with newline
  return capitalized.join('\n');
}

