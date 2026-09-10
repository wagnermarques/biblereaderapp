// Converts a source Bible JSON into this app's per-book data format under
// public/data/<translation-id>/, where <translation-id> is one of the ids in
// src/translations.js.
//
// Usage: node scripts/import-bible-data.mjs <translation-id> <path-to-source.json>
//
// Two source shapes are recognized, both carrying the 66 books in canonical
// order — that order is what maps a book to its id here, since the sources name
// books inconsistently (or not at all):
//
//   1. { books: [ { name, chapters: [ { verses: [ { text } ] } ] } ] }
//      Used by https://github.com/BibliaJFAAL/JFAAL (`original/1911-JFAAtualizada.json`,
//      the 1911 Almeida, public domain).
//   2. [ { abbrev, chapters: [ [ "verse text", ... ] ] } ]
//      Used by https://github.com/damarals/biblias releases (BLIVRE.json,
//      the 2018 Bíblia Livre, CC BY 4.0).
//
// To re-fetch the sources yourself:
//   curl -L -o alm1911.json \
//     https://raw.githubusercontent.com/BibliaJFAAL/JFAAL/main/original/1911-JFAAtualizada.json
//   node scripts/import-bible-data.mjs alm1911 alm1911.json
//
//   curl -L -o blivre.json \
//     https://github.com/damarals/biblias/releases/download/v1.0.0/BLIVRE.json
//   node scripts/import-bible-data.mjs blivre blivre.json

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

// Book names for sources that ship only an abbreviation (shape 2). The app's
// own book list and headings read from books-index.json, so a source without
// full names would otherwise leave the reader with "Gn" everywhere.
const BOOK_NAMES = [
  'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute',
  '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias',
  'Ester', 'Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cânticos', 'Isaías', 'Jeremias',
  'Lamentações', 'Ezequiel', 'Daniel', 'Oseias', 'Joel', 'Amós', 'Obadias', 'Jonas', 'Miqueias',
  'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias',
  'Mateus', 'Marcos', 'Lucas', 'João', 'Atos', 'Romanos', '1 Coríntios', '2 Coríntios',
  'Gálatas', 'Efésios', 'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses',
  '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom', 'Hebreus', 'Tiago', '1 Pedro', '2 Pedro',
  '1 João', '2 João', '3 João', 'Judas', 'Apocalipse',
]

/** Normalizes either source shape into [{ name, chapters: [[verse, ...]] }]. */
function readBooks(source) {
  const books = Array.isArray(source) ? source : source.books
  if (!Array.isArray(books) || books.length !== BOOK_IDS.length) {
    throw new Error(
      `Expected ${BOOK_IDS.length} books in source, got ${books?.length}. ` +
        'Source shape may differ from the two documented in this script.'
    )
  }
  return books.map((book, i) => ({
    name: book.name ?? BOOK_NAMES[i],
    chapters: book.chapters.map((chapter) =>
      // Shape 1 wraps each verse in an object; shape 2 is the bare string. Both
      // carry stray spaces — leading, trailing, and doubled mid-verse. HTML
      // would collapse those on screen, but highlights are character offsets
      // into this string, so what is stored has to match what is read.
      (Array.isArray(chapter) ? chapter : chapter.verses)
        .map((verse) => (typeof verse === 'string' ? verse : verse.text))
        .map((text) => text.replace(/\s+/g, ' ').trim())
    ),
  }))
}

function main() {
  const [translationId, sourcePath] = process.argv.slice(2)
  if (!translationId || !sourcePath) {
    console.error('Usage: node scripts/import-bible-data.mjs <translation-id> <path-to-source.json>')
    process.exit(1)
  }

  const books = readBooks(JSON.parse(readFileSync(sourcePath, 'utf-8')))

  const outDataDir = path.join(ROOT, 'public', 'data', translationId)
  const outBooksDir = path.join(outDataDir, 'books')
  mkdirSync(outBooksDir, { recursive: true })

  const index = []

  books.forEach((book, i) => {
    const id = BOOK_IDS[i]
    const testament = i < OT_COUNT ? 'ot' : 'nt'

    // versesPerChapter lets the UI compute "is this chapter fully read" (from
    // per-verse read tracking) without fetching the whole book's text.
    index.push({
      id,
      name: book.name,
      testament,
      chapters: book.chapters.length,
      versesPerChapter: book.chapters.map((ch) => ch.length),
    })
    writeFileSync(
      path.join(outBooksDir, `${id}.json`),
      JSON.stringify({ id, name: book.name, testament, chapters: book.chapters }),
      'utf-8'
    )
  })

  writeFileSync(path.join(outDataDir, 'books-index.json'), JSON.stringify(index, null, 2), 'utf-8')

  console.log(
    `Wrote books-index.json and ${index.length} book files to public/data/${translationId}/`
  )
}

main()
