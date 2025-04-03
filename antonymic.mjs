// antonymic.mjs
import fetch from 'node-fetch';

/**
 * WordsAPI config: keep your secrets (key/host) in env variables
 */
const API_HOST = process.env.WORDSAPI_HOST;  
const API_KEY  = process.env.WORDSAPI_KEY;

console.log('API_HOST:', API_HOST);
console.log('API_KEY:', API_KEY);

// A naive approach: 
// We'll say "important words" = any word longer than 3 letters, ignoring common short words.
function isImportantWord(word) {
  return word.length > 2;
}

/**
 * getAntonym(word): fetch an antonym from WordsAPI
 * @param {string} word - the word to look up
 * @returns {string|null} one antonym if found, else null
 */
async function getAntonym(word) {
  const url = `https://${API_HOST}/words/${encodeURIComponent(word)}/antonyms`;
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Host': API_HOST,
      'X-RapidAPI-Key': API_KEY
    }
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      // e.g. 404 means "No antonyms found"
      return null;
    }
    const data = await response.json();
    // data.antonyms might be an array: ["long", "extended", ...]
    if (data.antonyms && data.antonyms.length > 0) {
      // pick the first antonym or a random one
      return data.antonyms[0];
    }
    return null;
  } catch (err) {
    console.error('Error fetching antonym for', word, err);
    return null;
  }
}

/**
 * transformAntonymic(inputText):
 *  1) Split text by spaces -> tokens
 *  2) For each word that is "important," fetch an antonym
 *  3) If found, replace with that antonym. Otherwise keep the original
 */
export async function transformAntonymic(inputText) {
  const tokens = inputText.split(/\s+/);

  // We'll build an array of promises, one for each important word
  // Then we do Promise.all(...) at the end for concurrency
  const transformationPromises = tokens.map(async (token) => {
    // Basic strip punctuation? We'll do a naive approach or skip for brevity.
    // Check if "important"
    const lower = token.toLowerCase().replace(/[^\w'-]/g, ''); 
    // e.g. remove punctuation for the dictionary lookup
    if (isImportantWord(lower)) {
      const antonym = await getAntonym(lower);
      return antonym ? antonym : token; // if found, use it, else original
    } else {
      return token;
    }
  });

  // Wait for all lookups
  const transformedTokens = await Promise.all(transformationPromises);

  // Join the final text
  return transformedTokens.join(' ');
}
