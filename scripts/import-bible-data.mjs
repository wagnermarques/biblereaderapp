// Converts a source Bible JSON (in the "books[].chapters[].verses[]" shape used by
// https://github.com/BibliaJFAAL/JFAAL, folder `original/1911-JFAAtualizada.json` —
// the 1911 João Ferreira de Almeida translation, public domain) into this app's
// per-book data format under public/data/.
//
// Usage: node scripts/import-bible-data.mjs <path-to-source.json>
//
// To re-fetch the source yourself:
//   curl -L -o source.json \
//     https://raw.githubusercontent.com/BibliaJFAAL/JFAAL/main/original/1911-JFAAtualizada.json
//   node scripts/import-bible-data.mjs source.json

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Canonical 66-book order (Protestant canon) with short ids, matching `nr` 1..66
// in the JFAAL source.
const BOOK_IDS = [
  // Old Testament (39)
  'gn', 'ex', 'lv', 'nm', 'dt', 'js', 'jz', 'rt', '1sm', '2sm',
  '1rs', '2rs', '1cr', '2cr', 'ed', 'ne', 'et', 'jb', 'sl', 'pv',
  'ec', 'ct', 'is', 'jr', 'lm', 'ez', 'dn', 'os', 'jl', 'am',
  'ob', 'jn', 'mq', 'na', 'hc', 'sf', 'ag', 'zc', 'ml',
  // New Testament (27)
  'mt', 'mc', 'lc', 'jo', 'at', 'rm', '1co', '2co', 'gl', 'ef',
  'fp', 'cl', '1ts', '2ts', '1tm', '2tm', 'tt', 'fm', 'hb', 'tg',
  '1pe', '2pe', '1jo', '2jo', '3jo', 'jd', 'ap',
]
const OT_COUNT = 39

function main() {
  const sourcePath = process.argv[2]
  if (!sourcePath) {
    console.error('Usage: node scripts/import-bible-data.mjs <path-to-source.json>')
    process.exit(1)
  }

  const source = JSON.parse(readFileSync(sourcePath, 'utf-8'))
  if (!Array.isArray(source.books) || source.books.length !== BOOK_IDS.length) {
    throw new Error(
      `Expected ${BOOK_IDS.length} books in source, got ${source.books?.length}. ` +
        'Source format may differ from BibliaJFAAL/JFAAL — check scripts/import-bible-data.mjs.'
    )
  }

  const outDataDir = path.join(ROOT, 'public', 'data')
  const outBooksDir = path.join(outDataDir, 'books')
  mkdirSync(outBooksDir, { recursive: true })

  const index = []

  source.books.forEach((book, i) => {
    const id = BOOK_IDS[i]
    const testament = i < OT_COUNT ? 'ot' : 'nt'
    const chapters = book.chapters.map((ch) => ch.verses.map((v) => v.text.trim()))

    index.push({ id, name: book.name, testament, chapters: chapters.length })
    writeFileSync(
      path.join(outBooksDir, `${id}.json`),
      JSON.stringify({ id, name: book.name, testament, chapters }),
      'utf-8'
    )
  })

  writeFileSync(path.join(outDataDir, 'books-index.json'), JSON.stringify(index, null, 2), 'utf-8')

  console.log(`Wrote books-index.json and ${index.length} book files to public/data/`)
}

main()
