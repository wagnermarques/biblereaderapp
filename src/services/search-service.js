import { bibleDataService } from './bible-data-service.js'

/** Strips accents so "genesis" matches "Gênesis" and "e" matches "é". */
function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

let allBooksLoaded = null

/** Loads every book's text in the background so search covers the whole Bible. */
async function ensureFullIndex() {
  if (!allBooksLoaded) {
    allBooksLoaded = (async () => {
      const index = await bibleDataService.getIndex()
      await Promise.all(index.map((b) => bibleDataService.getBook(b.id)))
    })()
  }
  return allBooksLoaded
}

export const searchService = {
  /** Kicks off background loading of the full text; call once on app startup. */
  warmUp() {
    ensureFullIndex()
  },

  /**
   * Searches every loaded (or being-loaded) book for a query string.
   * Returns [{ bookId, bookName, chapter, verse, text }], capped at `limit`.
   */
  async search(query, { limit = 100 } = {}) {
    const trimmed = query.trim()
    if (trimmed.length < 2) return []

    await ensureFullIndex()
    const needle = normalize(trimmed)
    const index = await bibleDataService.getIndex()
    const results = []

    for (const { id, name } of index) {
      const book = await bibleDataService.getBook(id)
      chapterLoop: for (let c = 0; c < book.chapters.length; c++) {
        const verses = book.chapters[c]
        for (let v = 0; v < verses.length; v++) {
          if (normalize(verses[v]).includes(needle)) {
            results.push({ bookId: id, bookName: name, chapter: c + 1, verse: v + 1, text: verses[v] })
            if (results.length >= limit) break chapterLoop
          }
        }
      }
      if (results.length >= limit) break
    }

    return results
  },
}
