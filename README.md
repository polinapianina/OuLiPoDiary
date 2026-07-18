# OuLiPo Diary

A constraint-based journaling app built for my Senior Honors Thesis in Comparative
Literature at NYU. Inspired by the OuLiPo (Ouvroir de littérature potentielle) — the
French workshop of writers and mathematicians who composed literature under formal
constraints — the app takes ordinary diary entries and transforms them using
OuLiPian procedures.

Write a plain entry about your day; read it back as something stranger.

## Constraints implemented

- **N+7** (`n7.mjs`) — after Jean Lescure's procedure: each word found in the
  dictionary is replaced by the word seven entries after it in an alphabetized
  word list (`words.txt`), with the original word's capitalization and plural
  ending preserved.
- **Antonymic translation** (`antonymic.mjs`) — inverts the entry by replacing
  each significant word with an antonym fetched live from WordsAPI, turning a
  diary of what happened into a diary of what didn't. Words with no antonym
  survive untouched.
- **Snowball** (`snowball.mjs`) — recomposes the entry into a snowball poem:
  its words are deduplicated and rearranged in order of ascending length, one
  word per line, so the entry melts into a column of its own growing vocabulary.

## Tech stack

- **Node.js / Express** — server and routing
- **MongoDB + Mongoose** — persists users and diary entries
- **Passport.js** — authentication, so each diarist keeps a private diary
- **WordsAPI** — live antonym lookups
- Custom dictionary indexing over `words.txt` for the N+7 transform

## Why

The thesis explored formal constraint as a generative device rather than a
limitation. This app was the practical demonstration accompanying the written
defense: what happens when you apply potential literature's methods to the most
unliterary genre there is — the daily diary entry.

## Running locally
npm install
node app.mjs

Requires a local MongoDB instance, a `config.mjs` with your connection string,
and `WORDSAPI_HOST` / `WORDSAPI_KEY` environment variables for the antonymic
transform.
