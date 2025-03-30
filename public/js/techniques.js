
const DICTIONARY_API_URL = window.DICTIONARY_API_URL;
const DICTIONARY_API_KEY = window.DICTIONARY_API_KEY;

// Idea for N+7 Implementation was partially inspired by this source: https://github.com/Princeton-CDH/digital-oulipo  

// link to the API used: https://www.wordsapi.com/# 

// FIXING the 429 error issue (even though the month limit is not exceeded)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// request queue for throttling
let requestQueue = [];
let isProcessingQueue = false;

// processing the queue
async function processQueue() {
    if (isProcessingQueue || requestQueue.length === 0) return;
    isProcessingQueue = true;

    while (requestQueue.length > 0) {
        const { func, resolve, reject } = requestQueue.shift();

        try {
            const result = await func();
            resolve(result);
        } catch (error) {
            reject(error);
        }

        // delay between requests to respect the 10 requests/min limit (see: https://docs.rapidapi.com/docs/graphql-platform-api-release-notes)
        await delay(6000); // 1 request every 6 seconds
    }

    isProcessingQueue = false;
}

// function to add a request to the queue
function addToQueue(func) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ func, resolve, reject });
        processQueue();
    });
}

// fetch with retry logic for 429 responses
async function fetchWithRetry(url, options, retries = 5, backoff = 3000) {
    for (let i = 0; i < retries; i++) {
        const response = await fetch(url, options);

        if (response.status === 429) {
            console.warn(`Rate limit hit. Retrying in ${backoff * (i + 1)}ms...`);
            await delay(backoff * (i + 1));
            continue;
        }

        if (response.ok) {
            return response.json();
        }

        throw new Error(`Request failed with status: ${response.status}`);
    }

    throw new Error("Exceeded retry attempts");
}

// function to get a list of words matching specific letters
async function findWordsWithLetters(letters) {
    const letterPattern = `^[${letters.join('')}]+$`;
    const url = `${DICTIONARY_API_URL}/words?letterPattern=${encodeURIComponent(letterPattern)}`;
    const options = {
        headers: {
            'X-RapidAPI-Key': DICTIONARY_API_KEY,
            'X-RapidAPI-Host': 'wordsapiv1.p.rapidapi.com',
        },
    };

    const data = await fetchWithRetry(url, options);
    return data.results?.map(result => result.word) || [];
}

// N+7 Technique
export async function transformN7(inputText) {
    const words = inputText.split(/\s+/);
    const transformedWords = [];

    for (const word of words) {
        const letters = word.toLowerCase().split('');
        const matchingWords = await findWordsWithLetters(letters);
        const currentIndex = matchingWords.indexOf(word.toLowerCase());

        if (currentIndex >= 0 && currentIndex + 7 < matchingWords.length) {
            transformedWords.push(matchingWords[currentIndex + 7]);
        } else {
            transformedWords.push(word); // back to original word
        }
    }

    return transformedWords.join(' ');
}

// Acrostic Technique
export async function transformAcrostic(inputText) {
    const letters = inputText.replace(/\s+/g, '').toLowerCase().split('');
    const matchingWords = await findWordsWithLetters(letters);

    return matchingWords.length > 0 ? matchingWords[0] : "No matching word found.";
}

// Snowball Technique
export async function transformSnowball(inputText) {
    const letters = inputText.replace(/\s+/g, '').toLowerCase().split('');
    const matchingWords = await findWordsWithLetters(letters);

    if (matchingWords.length === 0) {
        return "No matching words found.";
    }

    const snowball = [];
    let currentLength = 1;

    while (true) {
        const nextWord = matchingWords.find(word => word.length === currentLength);
        if (!nextWord) break;

        snowball.push(nextWord);
        currentLength++;
    }

    return snowball.join('\n');
}